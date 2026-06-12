"""
eval.provider_compare.runner — provider별 SAST 실행 하니스.

진입점: run_compare(target_dir, providers, limit, output_path)
  - 동일 파일셋을 provider별로 순차 분석
  - 분석 결과를 ProviderResult로 수집
  - report.py로 집합 비교 + 표 생성
  - latest.json 산출

엣지 처리:
  - 키없음 provider: 경고 로그 후 스킵 (ValueError catch)
  - 개별 파일 실패: skip & log (전체 실패 금지)
  - rate limit: 지수 백오프 재시도 (최대 MAX_RETRIES회)

토큰/키 로그 금지. 빈 catch 금지.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from pathlib import Path

from agent.claude_client import analyze_for_sast
from agent.llm.factory import PROVIDER_ANTHROPIC, PROVIDER_GEMINI, PROVIDER_OPENAI
from agent.response_parser import parse_sast_response
from eval.provider_compare.report import (
    ProviderResult,
    CompareResult,
    compare_findings,
    build_summary_table,
)

logger = logging.getLogger(__name__)

# ── 상수 ─────────────────────────────────────────────────────────────────────
# rate limit 백오프 설정
_MAX_RETRIES = 3
_BACKOFF_BASE_SEC = 2.0  # 재시도 대기: base * (2 ** attempt)

# 지원 파일 확장자 (SAST 의미없는 파일 제외)
_SUPPORTED_EXTENSIONS = frozenset({
    ".py", ".java", ".kt", ".js", ".ts", ".tsx", ".jsx",
    ".go", ".php", ".rb", ".cs", ".cpp", ".c", ".h",
})

# latest.json 파일명
_LATEST_JSON = "latest.json"

# 기본 출력 경로 (eval 결과물 저장)
_DEFAULT_OUTPUT_DIR = Path(__file__).parent / "results"


# ── 공개 인터페이스 ───────────────────────────────────────────────────────────

async def run_compare(
    target_dir: str,
    providers: list[str],
    limit: int | None = None,
    output_path: str | None = None,
) -> dict:
    """동일 파일셋에 대해 provider별 SAST를 실행하고 비교 결과를 반환한다.

    Args:
        target_dir:  분석 대상 디렉터리 경로
        providers:   분석할 provider 목록 (예: ["gemini", "anthropic"])
        limit:       분석할 최대 파일 수 (None이면 제한 없음)
        output_path: latest.json 저장 경로 (None이면 기본 경로 사용)

    Returns:
        비교 결과 dict — latest.json과 동일한 구조
    """
    files = _collect_files(target_dir, limit)
    if not files:
        logger.warning("[runner] no supported files found in %s", target_dir)

    results: list[ProviderResult] = []
    for provider in providers:
        result = await _run_provider(provider, files)
        if result is not None:
            results.append(result)

    compare: CompareResult | None = None
    if len(results) == 2:
        compare = compare_findings(results[0], results[1])
    elif len(results) > 2:
        # 2개 초과: 첫 번째 vs 나머지 전체 합산 비교는 미지원 — 쌍별 비교는 COST-3 이후
        logger.info("[runner] >2 providers: showing individual stats only (pairwise compare requires 2)")

    table = build_summary_table(results, compare)
    print(table)

    payload = _build_payload(target_dir, providers, results, compare)
    _save_latest_json(payload, output_path)

    return payload


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

def _collect_files(target_dir: str, limit: int | None) -> list[str]:
    """대상 디렉터리에서 지원 확장자 파일 목록을 수집한다."""
    root = Path(target_dir).resolve()
    if not root.is_dir():
        logger.error("[runner] target_dir not found: %s", target_dir)
        return []

    collected: list[str] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in _SUPPORTED_EXTENSIONS:
            continue
        collected.append(str(path))
        if limit is not None and len(collected) >= limit:
            break

    logger.info("[runner] collected %d files from %s (limit=%s)", len(collected), target_dir, limit)
    return collected


async def _run_provider(
    provider: str,
    files: list[str],
) -> ProviderResult | None:
    """단일 provider로 모든 파일을 분석하고 ProviderResult를 반환한다.

    키 없음(ValueError) 시 경고 로그 후 None 반환 — 스킵.
    개별 파일 실패는 skip & log.
    """
    logger.info("[runner] starting provider=%s files=%d", provider, len(files))
    start = time.monotonic()

    result = ProviderResult(provider=provider)

    for file_path in files:
        file_findings = await _analyze_file_with_retry(provider, file_path)
        if file_findings is None:
            # ValueError (키없음) 등 치명 오류 — provider 전체 스킵
            logger.warning("[runner] provider=%s skipped (no key or unsupported)", provider)
            return None
        if file_findings == _SKIP_SENTINEL:
            # 개별 파일 오류 — skip & log (이미 로그됨)
            result.error_files.append(file_path)
            continue

        result.file_findings[file_path] = file_findings
        result.findings.extend(file_findings)

    result.latency_sec = time.monotonic() - start
    logger.info(
        "[runner] provider=%s done: files=%d findings=%d latency=%.1fs errors=%d",
        provider, len(result.file_findings), len(result.findings),
        result.latency_sec, len(result.error_files),
    )
    return result


# 파일 스킵 센티널 — None(provider 스킵)과 구분하기 위한 상수
_SKIP_SENTINEL: list = []  # type: ignore[assignment]


async def _analyze_file_with_retry(
    provider: str,
    file_path: str,
) -> list[dict] | None:
    """단일 파일을 analyze_for_sast로 분석하고 findings를 반환한다.

    Returns:
        list[dict]: findings (빈 목록 포함)
        None:       provider 키 없음 등 치명 오류 → provider 전체 스킵 신호
        _SKIP_SENTINEL: 파일 개별 오류 → 이 파일만 스킵
    """
    content = _read_file_safe(file_path)
    if content is None:
        logger.warning("[runner] file read failed, skipping: %s", file_path)
        return _SKIP_SENTINEL  # type: ignore[return-value]

    for attempt in range(_MAX_RETRIES):
        try:
            raw, usage = await analyze_for_sast(
                file_path, content, provider=provider
            )
            findings = parse_sast_response(raw, file_path)
            return findings

        except ValueError as exc:
            # 키 없음 또는 미지원 provider → provider 전체 스킵
            logger.warning(
                "[runner] provider=%s config error (skipping provider): %s",
                provider, exc,
            )
            return None

        except Exception as exc:
            err_str = str(exc)
            is_rate_limit = _is_rate_limit_error(err_str)
            if is_rate_limit and attempt < _MAX_RETRIES - 1:
                wait = _BACKOFF_BASE_SEC * (2 ** attempt)
                logger.warning(
                    "[runner] provider=%s rate_limit file=%s attempt=%d wait=%.1fs",
                    provider, file_path, attempt + 1, wait,
                )
                await asyncio.sleep(wait)
                continue

            logger.warning(
                "[runner] provider=%s file=%s error (skipping file): %s",
                provider, file_path, exc,
            )
            return _SKIP_SENTINEL  # type: ignore[return-value]

    return _SKIP_SENTINEL  # type: ignore[return-value]


def _read_file_safe(file_path: str) -> str | None:
    """파일을 읽어 내용을 반환한다. 실패 시 None."""
    try:
        with open(file_path, encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except OSError as exc:
        logger.warning("[runner] cannot read file=%s: %s", file_path, exc)
        return None


def _is_rate_limit_error(err_str: str) -> bool:
    """오류 문자열이 rate limit 관련인지 판단한다."""
    lowered = err_str.lower()
    return "rate" in lowered or "429" in lowered or "quota" in lowered


def _build_payload(
    target_dir: str,
    providers: list[str],
    results: list[ProviderResult],
    compare: CompareResult | None,
) -> dict:
    """latest.json에 저장할 dict를 구성한다."""
    provider_stats = []
    for r in results:
        sev = r.severity_counts()
        provider_stats.append({
            "provider": r.provider,
            "file_count": len(r.file_findings),
            "finding_count": len(r.findings),
            "severity": sev,
            "latency_sec": round(r.latency_sec, 2),
            "input_tokens": r.total_input_tokens,
            "output_tokens": r.total_output_tokens,
            "error_files": r.error_files,
        })

    compare_dict: dict | None = None
    if compare is not None:
        compare_dict = {
            "provider_a": compare.provider_a,
            "provider_b": compare.provider_b,
            "consensus_count": len(compare.consensus),
            "a_only_count": len(compare.a_only),
            "b_only_count": len(compare.b_only),
            "recall_gap_for_a": compare.recall_gap_a,
            "recall_gap_for_b": compare.recall_gap_b,
            "fp_candidate_b": compare.fp_candidate_b,
            # 상세 목록은 spot-check용으로 포함 (최대 100개)
            "a_only_sample": [_key_to_dict(k) for k in list(compare.a_only)[:100]],
            "b_only_sample": [_key_to_dict(k) for k in list(compare.b_only)[:100]],
        }

    return {
        "target_dir": target_dir,
        "providers_requested": providers,
        "providers_ran": [r.provider for r in results],
        "provider_stats": provider_stats,
        "compare": compare_dict,
    }


def _key_to_dict(key) -> dict:
    return {"file": key.file, "line": key.line, "type": key.vuln_type}


def _save_latest_json(payload: dict, output_path: str | None) -> None:
    """latest.json을 저장한다. 디렉터리가 없으면 생성한다."""
    if output_path is None:
        _DEFAULT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        out = _DEFAULT_OUTPUT_DIR / _LATEST_JSON
    else:
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)

    try:
        out.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        logger.info("[runner] saved latest.json to %s", out)
    except OSError as exc:
        logger.error("[runner] failed to save latest.json: %s", exc)


# ── CLI 진입점 ────────────────────────────────────────────────────────────────

def main() -> None:
    """CLI: python -m eval.provider_compare.runner <args>"""
    import argparse

    parser = argparse.ArgumentParser(
        description="SecureAI provider compare harness: run SAST across providers and compare findings.",
    )
    parser.add_argument("--target", required=True, help="분석 대상 디렉터리")
    parser.add_argument(
        "--providers",
        default="gemini,anthropic",
        help="콤마 구분 provider 목록 (기본: gemini,anthropic)",
    )
    parser.add_argument("--limit", type=int, default=None, help="분석할 최대 파일 수")
    parser.add_argument("--output", default=None, help="latest.json 저장 경로")
    parser.add_argument("--verbose", action="store_true", help="DEBUG 로그 활성화")

    args = parser.parse_args()

    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(level=log_level, format="%(levelname)s %(name)s %(message)s")

    provider_list = [p.strip() for p in args.providers.split(",") if p.strip()]
    asyncio.run(
        run_compare(
            target_dir=args.target,
            providers=provider_list,
            limit=args.limit,
            output_path=args.output,
        )
    )


if __name__ == "__main__":
    main()
