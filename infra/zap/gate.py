#!/usr/bin/env python3
"""
ZAP DAST 스캔 게이트 — Critical/High 집계 → exit code 결정

사용법:
    python gate.py <zap-report.json>

종료코드:
    0  : PASS — Critical/High 0건
    1  : FAIL — Critical/High 1건 이상 (게이트 차단)
    2  : ERROR — 리포트 파일 파싱 실패 또는 파일 없음

ZAP baseline.py PASS/WARN/FAIL 매핑:
    PASS : 0건 (이 스크립트도 exit 0)
    WARN : Medium/Low/Info 1건 이상 (이 스크립트는 exit 0, CI 경고로 처리)
    FAIL : Critical/High 1건 이상 (이 스크립트는 exit 1)

ZAP riskcode 참조:
    3 = High, 4 = Critical (ZAP는 3을 최고 위험으로 사용)
    실제 ZAP JSON 리포트에서 riskcode 3 = High, 2 = Medium, 1 = Low, 0 = Info
    Critical은 ZAP baseline에서 별도 riskcode 없음 — High(3)를 Critical로 간주
"""

import json
import sys
from pathlib import Path

# 게이트를 차단하는 최소 위험도 (이상 포함)
GATE_MIN_RISKCODE = 3  # 3 = High, ZAP에서 최고 위험

# ZAP riskcode → 레이블 매핑
RISK_LABELS = {
    0: "Informational",
    1: "Low",
    2: "Medium",
    3: "High",
    4: "Critical",  # ZAP 표준 외 일부 플러그인이 사용
}


def load_report(report_path: Path) -> dict:
    """ZAP JSON 리포트를 로드합니다."""
    if not report_path.exists():
        print(f"[ERROR] 리포트 파일을 찾을 수 없습니다: {report_path}", file=sys.stderr)
        sys.exit(2)
    with report_path.open(encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError as exc:
            print(f"[ERROR] 리포트 JSON 파싱 실패: {exc}", file=sys.stderr)
            sys.exit(2)


def extract_alerts(report: dict) -> list[dict]:
    """ZAP 리포트에서 전체 alert 목록을 추출합니다."""
    alerts = []
    # ZAP JSON 리포트 구조: {"site": [{"alerts": [...]}]}
    for site in report.get("site", []):
        alerts.extend(site.get("alerts", []))
    return alerts


def count_by_risk(alerts: list[dict]) -> dict[int, int]:
    """riskcode 별 건수를 집계합니다."""
    counts: dict[int, int] = {}
    for alert in alerts:
        try:
            riskcode = int(alert.get("riskcode", 0))
        except (ValueError, TypeError):
            riskcode = 0
        counts[riskcode] = counts.get(riskcode, 0) + 1
    return counts


def print_summary(counts: dict[int, int]) -> None:
    """위험도별 집계를 출력합니다."""
    print("=" * 50)
    print("ZAP DAST 스캔 결과 요약")
    print("=" * 50)
    for riskcode in sorted(counts.keys(), reverse=True):
        label = RISK_LABELS.get(riskcode, f"Unknown({riskcode})")
        count = counts[riskcode]
        marker = " <-- 게이트 차단 대상" if riskcode >= GATE_MIN_RISKCODE else ""
        print(f"  {label:15s}: {count:4d}건{marker}")
    print("=" * 50)


def evaluate_gate(counts: dict[int, int]) -> int:
    """
    게이트 판정 후 종료코드를 반환합니다.

    Returns:
        0: PASS (Critical/High 0건)
        1: FAIL (Critical/High 1건 이상)
    """
    blocked_count = sum(
        count
        for riskcode, count in counts.items()
        if riskcode >= GATE_MIN_RISKCODE
    )

    if blocked_count == 0:
        print("[PASS] Critical/High 0건 — 게이트 통과")
        return 0

    print(
        f"[FAIL] Critical/High {blocked_count}건 발견 — 게이트 차단 (exit 1)",
        file=sys.stderr,
    )
    print(
        "  수정 후 재스캔하거나, 오탐이면 infra/zap/rules.tsv 에서 IGNORE 등록",
        file=sys.stderr,
    )
    return 1


def main() -> None:
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <zap-report.json>", file=sys.stderr)
        sys.exit(2)

    report_path = Path(sys.argv[1])
    report = load_report(report_path)
    alerts = extract_alerts(report)
    counts = count_by_risk(alerts)
    print_summary(counts)
    exit_code = evaluate_gate(counts)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
