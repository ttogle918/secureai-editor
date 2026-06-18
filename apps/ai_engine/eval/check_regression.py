"""
eval.check_regression — VAL-2 평가 CI 게이트.

baseline.json 대비 latest.json의 score/recall/fpr 하락폭을 계산한다.
하락폭이 임계를 초과하면 GitHub Actions 경고 어노테이션을 출력한다.

설계 원칙:
  - LLM 미사용 (순수 JSON 비교 — 비용 0, 결정론적)
  - Non-blocking: 경고만 출력, 항상 exit 0 (LLM 변동성 고려)
    → 추후 blocking 전환 시: sys.exit(1) 주석 참조
  - baseline/latest 파일 없으면 graceful 안내 후 exit 0
  - 매직넘버 상수화

사용:
  python -m eval.check_regression [--baseline PATH] [--latest PATH] [--threshold 0.02]
  make eval-check

GitHub Actions 어노테이션:
  ::warning:: 형식 (PR 체크 탭에 노란 경고로 표시)
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# ── 상수 ─────────────────────────────────────────────────────────────────────

# 기본 파일 경로
_EVAL_DIR = Path(__file__).parent
_DEFAULT_BASELINE = _EVAL_DIR / "baseline.json"
_DEFAULT_LATEST   = _EVAL_DIR / "results" / "latest.json"

# 기본 회귀 임계: 이 값 초과 하락 시 경고
# −2%p = 0.02 (score·recall·fpr 모두 동일 기준 적용)
DEFAULT_THRESHOLD = 0.02

# 비교 대상 지표 (key, 표시명, 방향: "lower_is_better" or "higher_is_better")
_METRICS: list[tuple[str, str, str]] = [
    ("score",  "OWASP Score (TPR-FPR)", "higher_is_better"),
    ("recall", "Recall (TPR)",          "higher_is_better"),
    ("fpr",    "FPR",                   "lower_is_better"),
]

# by_category 에서 비교할 지표
_CAT_METRICS: list[tuple[str, str, str]] = [
    ("score",  "score",  "higher_is_better"),
    ("recall", "recall", "higher_is_better"),
]


# ── 공개 API ─────────────────────────────────────────────────────────────────

def check_regression(
    baseline_path: Path = _DEFAULT_BASELINE,
    latest_path: Path = _DEFAULT_LATEST,
    threshold: float = DEFAULT_THRESHOLD,
) -> bool:
    """baseline 대비 latest 회귀 여부를 반환한다.

    Args:
        baseline_path: baseline.json 경로
        latest_path:   latest.json 경로 (VAL-1 산출물)
        threshold:     하락폭 임계 (기본 0.02 = 2%p)

    Returns:
        True  — 회귀 없음 (게이트 PASS)
        False — 임계 초과 하락 감지 (경고 출력, 비차단)

    Side effects:
        경고는 stdout에 GitHub Actions ::warning:: 형식으로 출력된다.
    """
    baseline = _load_json(baseline_path, "baseline")
    if baseline is None:
        return True  # 파일 없으면 게이트 미적용

    latest = _load_json(latest_path, "latest")
    if latest is None:
        return True  # 파일 없으면 게이트 미적용

    warnings_found = False

    # 전체 지표 비교
    for key, label, direction in _METRICS:
        base_val = baseline.get(key)
        curr_val = latest.get(key)
        if base_val is None or curr_val is None:
            _info(f"  지표 '{key}' 값 없음 — 비교 스킵")
            continue

        drop = _calc_drop(base_val, curr_val, direction)
        if drop is not None and drop > threshold:
            _warn(
                f"eval 회귀 감지 — {label}: "
                f"baseline={base_val:.4f} → latest={curr_val:.4f} "
                f"(하락폭={drop:.4f} > 임계={threshold:.4f})"
            )
            warnings_found = True
        else:
            change_str = _format_change(base_val, curr_val, direction)
            _info(f"  {label}: baseline={base_val:.4f} → latest={curr_val:.4f} {change_str}")

    # by_category 카테고리별 회귀 (가점 항목)
    base_cats: dict[str, dict] = baseline.get("by_category", {})
    curr_cats: dict[str, dict] = latest.get("by_category", {})
    if base_cats and curr_cats:
        cat_regressions: list[str] = []
        for cat in sorted(base_cats.keys()):
            if cat not in curr_cats:
                continue
            for key, label, direction in _CAT_METRICS:
                bv = base_cats[cat].get(key)
                cv = curr_cats[cat].get(key)
                if bv is None or cv is None:
                    continue
                drop = _calc_drop(bv, cv, direction)
                if drop is not None and drop > threshold:
                    cat_regressions.append(
                        f"    [{cat}] {label}: {bv:.4f} → {cv:.4f} (하락폭={drop:.4f})"
                    )
        if cat_regressions:
            _warn(
                "카테고리별 eval 회귀 감지:\n" + "\n".join(cat_regressions)
            )
            warnings_found = True

    # 요약 출력
    _print_summary(baseline, latest, warnings_found)

    # Non-blocking: 항상 True 반환 (exit 0)
    # 추후 blocking 전환 시: return not warnings_found
    return True


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

def _load_json(path: Path, label: str) -> dict | None:
    """JSON 파일을 읽어 dict를 반환한다. 없으면 None."""
    if not path.exists():
        _info(
            f"[check_regression] {label}.json 없음 — 게이트 미적용\n"
            f"  경로: {path}"
        )
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            _info(f"[check_regression] {label}.json 형식 오류 (dict 아님) — 게이트 미적용")
            return None
        return data
    except (OSError, json.JSONDecodeError) as exc:
        _info(f"[check_regression] {label}.json 읽기 실패: {exc} — 게이트 미적용")
        return None


def _calc_drop(
    base_val: float,
    curr_val: float,
    direction: str,
) -> float | None:
    """하락폭을 계산한다.

    higher_is_better: drop = base − curr  (줄었으면 양수)
    lower_is_better:  drop = curr − base  (늘었으면 양수)
    """
    if direction == "higher_is_better":
        return base_val - curr_val
    if direction == "lower_is_better":
        return curr_val - base_val
    return None


def _format_change(base_val: float, curr_val: float, direction: str) -> str:
    """변화량을 사람이 읽기 좋은 문자열로 반환한다."""
    delta = curr_val - base_val
    sign = "+" if delta >= 0 else ""
    verdict = ""
    if direction == "higher_is_better":
        verdict = " [OK]" if delta >= 0 else " [주의]"
    else:
        verdict = " [OK]" if delta <= 0 else " [주의]"
    return f"(변화={sign}{delta:.4f}){verdict}"


def _print_summary(baseline: dict, latest: dict, warnings_found: bool) -> None:
    """비교 요약을 stdout에 출력한다."""
    print("\n" + "=" * 60)
    print("eval 회귀 게이트 요약")
    print("=" * 60)
    print(f"  baseline: score={baseline.get('score', 'N/A')} "
          f"recall={baseline.get('recall', 'N/A')} "
          f"fpr={baseline.get('fpr', 'N/A')} "
          f"model={baseline.get('model', 'N/A')} "
          f"total={baseline.get('total', 'N/A')}")
    print(f"  latest  : score={latest.get('score', 'N/A')} "
          f"recall={latest.get('recall', 'N/A')} "
          f"fpr={latest.get('fpr', 'N/A')} "
          f"model={latest.get('model', 'N/A')} "
          f"total={latest.get('total', 'N/A')}")
    if warnings_found:
        print("  결과: 경고 (임계 초과 하락 감지 — 비차단, PR 경고로 표기)")
    else:
        print("  결과: PASS (임계 이내)")
    print("=" * 60)


def _warn(message: str) -> None:
    """GitHub Actions ::warning:: 어노테이션 + 일반 출력."""
    # ::warning:: 형식: PR 체크 탭에 노란 경고 아이콘으로 표시됨
    print(f"::warning::{message}")
    print(f"[WARN] {message}")


def _info(message: str) -> None:
    """일반 정보 출력."""
    print(message)


# ── CLI 진입점 ─────────────────────────────────────────────────────────────────

def main() -> None:
    """CLI: python -m eval.check_regression [--baseline PATH] [--latest PATH] [--threshold 0.02]"""
    parser = argparse.ArgumentParser(
        description=(
            "VAL-2 eval CI 게이트 — baseline 대비 score/recall/fpr 회귀 감시.\n"
            "임계 초과 시 GitHub Actions 경고 출력 (비차단, exit 0)."
        ),
    )
    parser.add_argument(
        "--baseline",
        default=str(_DEFAULT_BASELINE),
        help=f"baseline.json 경로 (기본: {_DEFAULT_BASELINE})",
    )
    parser.add_argument(
        "--latest",
        default=str(_DEFAULT_LATEST),
        help=f"latest.json 경로 (기본: {_DEFAULT_LATEST})",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=DEFAULT_THRESHOLD,
        help=f"하락폭 임계 (기본: {DEFAULT_THRESHOLD} = {DEFAULT_THRESHOLD*100:.0f}%%p)",
    )
    args = parser.parse_args()

    check_regression(
        baseline_path=Path(args.baseline),
        latest_path=Path(args.latest),
        threshold=args.threshold,
    )
    # Non-blocking: 항상 exit 0
    # 추후 blocking 전환 시: sys.exit(0 if passed else 1)
    sys.exit(0)


if __name__ == "__main__":
    main()
