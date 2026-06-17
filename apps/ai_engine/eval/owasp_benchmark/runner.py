"""
eval.owasp_benchmark.runner — OWASP BenchmarkJava 평가 하니스.

진입점: make eval LIMIT=N
  1. fetch.sh 로 클론된 BenchmarkJava expectedresults-*.csv 파싱
  2. SAST 파이프라인 호출 (analyze_for_sast + parse_sast_response)
  3. vuln_type ↔ CWE 매핑 → TP/FP/TN/FN 집계
  4. stdout: recall=.. fpr=.. score=..
  5. apps/ai_engine/eval/results/latest.json 산출

엣지 처리:
  - BenchmarkJava 레포 미존재 → 안내 메시지 후 비0 종료
  - 개별 케이스 분석 실패 → skip & log (FN 계상, 전체 중단 금지)
  - rate limit → 지수 백오프 + 부분 결과
  - 토큰/API 키 로그 금지

준수:
  - general.md: 개별 파일 실패 skip&log, 매직넘버 상수화
  - 도메인 파일 미수정 (sast_node.py 호출만)
"""
from __future__ import annotations

import asyncio
import csv
import json
import logging
import os
import time
from pathlib import Path

from agent.claude_client import analyze_for_sast
from agent.nodes.vuln_classifier import classify_and_enrich
from agent.response_parser import parse_sast_response
from eval.owasp_benchmark.scorer import (
    CaseResult,
    Metrics,
    compute,
    vuln_type_to_cwe,
)

logger = logging.getLogger(__name__)

# ── 상수 ─────────────────────────────────────────────────────────────────────

# BenchmarkJava 고정 태그 (fetch.sh 와 동기화 필요)
BENCHMARK_TAG = "1.2beta"

# CSV 컬럼명 (expectedresults-*.csv 스키마)
_CSV_COL_TEST_NAME    = "# test name"  # 또는 "test name"
_CSV_COL_CATEGORY     = "category"
_CSV_COL_REAL_VULN    = "real vulnerability"
_CSV_COL_CWE          = "cwe"

# 분석 실패 케이스의 기본 flagged 값 (FN 계상)
_FAILED_FLAGGED = False

# rate limit 백오프 설정
_MAX_RETRIES     = 3
_BACKOFF_BASE_SEC = 2.0

# SAST 결과에서 CWE 매핑 시 사용하는 필드명
_FINDING_CWE_FIELD = "cwe"

# eval 대상 provider/model 선택 env 키 (미설정 시 플랫폼 기본)
_ENV_PROVIDER     = "EVAL_PROVIDER"
_ENV_MODEL        = "EVAL_MODEL"
_DEFAULT_PROVIDER = "anthropic"
_DEFAULT_MODEL    = "claude-sonnet-4-5"

# 기본 경로
_PACKAGE_DIR = Path(__file__).parent
_BENCHMARK_DIR = _PACKAGE_DIR / "BenchmarkJava"
_TESTCODE_DIR  = _BENCHMARK_DIR / "src" / "main" / "java" / "org" / "owasp" / "benchmark" / "testcode"
_RESULTS_DIR   = Path(__file__).parent.parent / "results"
_LATEST_JSON   = _RESULTS_DIR / "latest.json"


# ── 공개 함수 ─────────────────────────────────────────────────────────────────

async def run_eval(
    limit: int | None = None,
    output_path: str | None = None,
) -> Metrics:
    """OWASP BenchmarkJava 평가를 실행한다.

    Args:
        limit:       vulnType별 최대 케이스 수 (None = 풀런)
        output_path: latest.json 저장 경로 (None = 기본 경로)

    Returns:
        Metrics — 전체 + 카테고리별 지표

    Raises:
        SystemExit(1): BenchmarkJava 레포 미존재
    """
    _check_benchmark_exists()

    csv_path = _find_expected_results_csv(_BENCHMARK_DIR)
    all_cases = _load_expected_results(csv_path)

    if limit is not None:
        all_cases = _sample_by_category(all_cases, limit)

    logger.info("[eval] %d 케이스 로드 완료 (limit=%s)", len(all_cases), limit)

    start_ts = time.monotonic()
    rows = await _run_cases(all_cases)
    elapsed_s = time.monotonic() - start_ts

    metrics = compute(rows)
    _print_headline(metrics)

    # latest.json에는 실제 eval에 사용된 모델을 기록 (EVAL_MODEL 우선)
    model = os.environ.get(_ENV_MODEL) or os.environ.get("ANTHROPIC_MODEL", _DEFAULT_MODEL)
    cost_est = _estimate_cost_usd(rows)

    payload = _build_payload(metrics, model, elapsed_s, cost_est, rows)
    _save_latest_json(payload, output_path)

    return metrics


# ── 내부: 검증·로드 ──────────────────────────────────────────────────────────

def _check_benchmark_exists() -> None:
    """BenchmarkJava 레포가 없으면 안내 메시지 출력 후 종료한다."""
    if not _BENCHMARK_DIR.exists():
        print(
            f"\n[eval] ERROR: BenchmarkJava 레포가 없습니다.\n"
            f"  위치: {_BENCHMARK_DIR}\n\n"
            f"  먼저 다음 명령으로 레포를 클론하세요:\n"
            f"    bash apps/ai_engine/eval/owasp_benchmark/fetch.sh\n"
            f"  또는: make eval-fetch\n"
        )
        raise SystemExit(1)


def _find_expected_results_csv(benchmark_dir: Path) -> Path:
    """BenchmarkJava 디렉터리에서 expectedresults-*.csv를 찾는다."""
    candidates = sorted(benchmark_dir.glob("expectedresults*.csv"))
    if not candidates:
        candidates = sorted((benchmark_dir / "scorecard").glob("expectedresults*.csv"))
    if not candidates:
        logger.error("[eval] expectedresults*.csv 파일을 찾을 수 없습니다: %s", benchmark_dir)
        raise SystemExit(1)
    logger.info("[eval] CSV 사용: %s", candidates[-1])
    return candidates[-1]


def _load_expected_results(csv_path: Path) -> list[dict]:
    """expectedresults-*.csv를 파싱해 케이스 목록을 반환한다.

    파싱 실패 행은 skip & 경고 로그 (전체 중단 금지).
    """
    cases: list[dict] = []
    try:
        with open(csv_path, encoding="utf-8", newline="") as fh:
            # BOM 제거 (UTF-8 BOM 있는 경우 대비)
            content = fh.read().lstrip("﻿")
            reader = csv.DictReader(content.splitlines(), skipinitialspace=True)
            for i, row in enumerate(reader, start=2):  # 2행부터 (1행=헤더)
                try:
                    case = _parse_csv_row(row)
                    if case:
                        cases.append(case)
                except Exception as exc:
                    logger.warning("[eval] CSV %d행 파싱 실패, skip: %s", i, exc)
    except OSError as exc:
        logger.error("[eval] CSV 읽기 실패: %s", exc)
        raise SystemExit(1)

    logger.info("[eval] expectedresults CSV 파싱 완료: %d 케이스", len(cases))
    return cases


def _parse_csv_row(row: dict) -> dict | None:
    """단일 CSV 행을 케이스 dict로 변환한다. 필수 컬럼 없으면 None."""
    # 헤더명이 "# test name" 또는 "test name" (버전마다 다름)
    test_name = (
        row.get("# test name")
        or row.get("test name")
        or row.get("Test Name")
        or ""
    ).strip()
    if not test_name:
        return None

    category = row.get("category", "").strip().lower()
    real_vuln_raw = row.get("real vulnerability", "").strip().lower()
    cwe_raw = row.get("cwe", "").strip()

    if not category:
        return None

    # "true"/"false" → bool
    real_vuln = real_vuln_raw in ("true", "1", "yes")

    # CWE 정규화: "89" → "CWE-89", "CWE-89" → "CWE-89"
    cwe = _normalize_cwe(cwe_raw) if cwe_raw else vuln_type_to_cwe(category)

    return {
        "test_name": test_name,
        "category": category,
        "expected_vuln": real_vuln,
        "expected_cwe": cwe,
    }


def _normalize_cwe(raw: str) -> str:
    """CWE 번호를 'CWE-N' 형식으로 정규화한다."""
    raw = raw.strip()
    if raw.upper().startswith("CWE-"):
        return raw.upper()
    if raw.isdigit():
        return f"CWE-{raw}"
    return raw.upper()


def _sample_by_category(cases: list[dict], limit: int) -> list[dict]:
    """카테고리별로 최대 limit 건씩 균형 표본 추출한다."""
    by_cat: dict[str, list[dict]] = {}
    for c in cases:
        by_cat.setdefault(c["category"], []).append(c)

    sampled: list[dict] = []
    for cat_cases in by_cat.values():
        sampled.extend(cat_cases[:limit])

    logger.info(
        "[eval] 샘플 추출: %d → %d 케이스 (카테고리별 최대 %d)",
        len(cases), len(sampled), limit,
    )
    return sampled


# ── 내부: 케이스 실행 ─────────────────────────────────────────────────────────

async def _run_cases(cases: list[dict]) -> list[CaseResult]:
    """모든 케이스를 순차 실행해 CaseResult 목록을 반환한다.

    개별 케이스 실패 → skip & log, FN 계상 (전체 중단 금지).
    """
    results: list[CaseResult] = []
    total = len(cases)

    for i, case in enumerate(cases, start=1):
        if i % 50 == 0 or i == total:
            logger.info("[eval] 진행: %d/%d", i, total)

        result = await _run_single_case(case)
        results.append(result)

    return results


async def _run_single_case(case: dict) -> CaseResult:
    """단일 케이스를 실행해 CaseResult를 반환한다.

    분석 실패 시 flagged=False(FN 계상)로 처리.
    """
    test_name    = case["test_name"]
    category     = case["category"]
    expected_vuln = case["expected_vuln"]
    expected_cwe  = case["expected_cwe"]

    java_file = _find_java_file(test_name)
    if java_file is None:
        logger.warning("[eval] 소스파일 없음, FN 계상: %s", test_name)
        return CaseResult(
            test_name=test_name,
            category=category,
            expected_vuln=expected_vuln,
            expected_cwe=expected_cwe,
            flagged=_FAILED_FLAGGED,
            predicted_cwes=[],
        )

    try:
        content = java_file.read_text(encoding="utf-8", errors="replace")
        predicted_cwes = await _analyze_with_retry(str(java_file), content)
        flagged = _is_flagged(predicted_cwes, expected_cwe)
    except Exception as exc:
        logger.warning("[eval] 케이스 분석 실패, FN 계상: %s error=%s", test_name, exc)
        predicted_cwes = []
        flagged = _FAILED_FLAGGED

    return CaseResult(
        test_name=test_name,
        category=category,
        expected_vuln=expected_vuln,
        expected_cwe=expected_cwe,
        flagged=flagged,
        predicted_cwes=predicted_cwes,
    )


def _find_java_file(test_name: str) -> Path | None:
    """test_name에 해당하는 .java 파일 경로를 반환한다.

    경로 순회 방어: _TESTCODE_DIR 하위로만 탐색한다.
    """
    # BenchmarkJava testcode 디렉터리 직접 탐색
    candidate = _TESTCODE_DIR / f"{test_name}.java"
    if candidate.exists():
        # 경로 순회 방어
        try:
            candidate.resolve().relative_to(_TESTCODE_DIR.resolve())
        except ValueError:
            logger.warning("[eval] 경로 순회 시도 차단: %s", test_name)
            return None
        return candidate

    # testcode 하위 전체 탐색 (서브패키지 가능성)
    if _BENCHMARK_DIR.exists():
        matches = list(_TESTCODE_DIR.rglob(f"{test_name}.java")) if _TESTCODE_DIR.exists() else []
        if matches:
            return matches[0]

    return None


async def _analyze_with_retry(
    file_path: str,
    content: str,
) -> list[str]:
    """파일을 analyze_for_sast로 분석하고 CWE 목록을 반환한다.

    rate limit 시 지수 백오프 재시도.
    최대 재시도 초과 시 빈 목록 반환 (FN 계상).
    """
    provider = os.environ.get(_ENV_PROVIDER, _DEFAULT_PROVIDER)
    model = os.environ.get(_ENV_MODEL, None)
    for attempt in range(_MAX_RETRIES):
        try:
            raw, _usage = await analyze_for_sast(file_path, content, provider=provider, model=model)
            findings = parse_sast_response(raw, file_path)
            enriched = classify_and_enrich(findings, file_path)
            return [
                f[_FINDING_CWE_FIELD]
                for f in enriched
                if f.get(_FINDING_CWE_FIELD)
            ]

        except Exception as exc:
            err_str = str(exc)
            is_rate_limit = _is_rate_limit_error(err_str)
            if is_rate_limit and attempt < _MAX_RETRIES - 1:
                wait = _BACKOFF_BASE_SEC * (2 ** attempt)
                logger.warning(
                    "[eval] rate limit file=%s attempt=%d wait=%.1fs",
                    file_path, attempt + 1, wait,
                )
                await asyncio.sleep(wait)
                continue

            logger.warning(
                "[eval] 분석 오류 file=%s attempt=%d: %s",
                file_path, attempt + 1, exc,
            )
            return []

    return []


def _is_rate_limit_error(err_str: str) -> bool:
    """오류 문자열이 rate limit 관련인지 판단한다."""
    lowered = err_str.lower()
    return "rate" in lowered or "429" in lowered or "quota" in lowered


def _is_flagged(predicted_cwes: list[str], expected_cwe: str) -> bool:
    """예측된 CWE 목록에 expected_cwe가 포함되어 있으면 True.

    비교는 대소문자 무관, 접두어(CWE-) 정규화 후 수행한다.
    """
    if not expected_cwe or not predicted_cwes:
        return False
    norm_expected = _normalize_cwe(expected_cwe)
    return any(_normalize_cwe(cwe) == norm_expected for cwe in predicted_cwes)


# ── 내부: 결과 출력·저장 ─────────────────────────────────────────────────────

def _print_headline(m: Metrics) -> None:
    """stdout에 핵심 지표를 출력한다."""
    fpr_fixed = (
        f"{m.fpr_at_fixed_recall:.4f}"
        if m.fpr_at_fixed_recall is not None
        else "N/A (recall < 80%)"
    )
    print(
        f"recall={m.recall:.4f} "
        f"fpr={m.fpr:.4f} "
        f"score={m.score:.4f} "
        f"(tp={m.tp} fp={m.fp} tn={m.tn} fn={m.fn} total={m.total})"
    )
    print(f"fpr_at_recall80={fpr_fixed}")


def _estimate_cost_usd(rows: list[CaseResult]) -> float:
    """입력 토큰 기반 비용 추정 (claude-sonnet-4-5 기준).

    실제 토큰 수를 수집하지 않으므로 케이스 수 기반 근사값.
    풀런(2,740 케이스) 기준 ~$5–15 USD 예상.
    케이스당 ~2,000 input + ~500 output token 가정.
    가격: input $3/MTok, output $15/MTok (2026 기준 예상).
    """
    # 비용 추정은 참고용 — 실제 청구액과 다를 수 있음
    n = len(rows)
    input_tokens_est  = n * 2000
    output_tokens_est = n * 500
    cost = (input_tokens_est / 1_000_000) * 3.0 + (output_tokens_est / 1_000_000) * 15.0
    return round(cost, 4)


def _build_payload(
    m: Metrics,
    model: str,
    elapsed_s: float,
    cost_usd_est: float,
    rows: list[CaseResult],
) -> dict:
    """latest.json 페이로드를 구성한다."""
    return {
        "total": m.total,
        "tp": m.tp,
        "fp": m.fp,
        "tn": m.tn,
        "fn": m.fn,
        "recall": round(m.recall, 6),
        "fpr": round(m.fpr, 6),
        "score": round(m.score, 6),
        "precision": round(m.precision, 6),
        "f1": round(m.f1, 6),
        "fpr_at_recall80": (
            round(m.fpr_at_fixed_recall, 6)
            if m.fpr_at_fixed_recall is not None
            else None
        ),
        "model": model,
        "elapsed_s": round(elapsed_s, 2),
        "cost_usd_est": cost_usd_est,
        "benchmark_tag": BENCHMARK_TAG,
        "by_category": {
            cat: {
                "tp": cm.tp, "fp": cm.fp, "tn": cm.tn, "fn": cm.fn,
                "recall": round(cm.recall, 6),
                "fpr": round(cm.fpr, 6),
                "score": round(cm.score, 6),
            }
            for cat, cm in m.by_category.items()
        },
    }


def _save_latest_json(payload: dict, output_path: str | None) -> None:
    """latest.json을 저장한다. 디렉터리가 없으면 생성한다."""
    if output_path is None:
        _RESULTS_DIR.mkdir(parents=True, exist_ok=True)
        out = _LATEST_JSON
    else:
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)

    try:
        out.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        logger.info("[eval] latest.json 저장: %s", out)
    except OSError as exc:
        logger.error("[eval] latest.json 저장 실패: %s", exc)


# ── CLI 진입점 ────────────────────────────────────────────────────────────────

def main() -> None:
    """CLI: python -m eval.owasp_benchmark.runner [--limit N]"""
    import argparse

    parser = argparse.ArgumentParser(
        description="OWASP BenchmarkJava 평가 하니스 — SecureAI SAST 탐지 정확도 측정",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="vulnType별 최대 케이스 수 (기본: 제한 없음=풀런)",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="latest.json 저장 경로 (기본: eval/results/latest.json)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="DEBUG 로그 활성화",
    )
    args = parser.parse_args()

    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    asyncio.run(
        run_eval(
            limit=args.limit,
            output_path=args.output,
        )
    )


if __name__ == "__main__":
    main()
