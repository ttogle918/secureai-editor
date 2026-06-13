"""
ZAP 게이트 집계 로직 단위 테스트 (infra/zap/gate.py)

실행:
    pytest tests/zap/test_gate.py -v

Docker/make dev 없이 순수 Python으로 검증합니다.
"""

import json
import sys
import tempfile
from pathlib import Path

import pytest

# gate.py 위치를 sys.path에 추가
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "infra" / "zap"))

from gate import (
    GATE_MIN_RISKCODE,
    count_by_risk,
    evaluate_gate,
    extract_alerts,
    load_report,
)


# ---------------------------------------------------------------------------
# 픽스처
# ---------------------------------------------------------------------------

def make_report(alerts: list[dict]) -> dict:
    """ZAP JSON 리포트 구조를 생성합니다."""
    return {"site": [{"alerts": alerts}]}


def make_alert(riskcode: int, name: str = "Test Alert") -> dict:
    """단일 alert dict를 생성합니다."""
    return {
        "riskcode": str(riskcode),
        "name": name,
        "instances": [{"uri": "http://localhost:8080/"}],
    }


# ---------------------------------------------------------------------------
# extract_alerts 테스트
# ---------------------------------------------------------------------------

class TestExtractAlerts:
    def test_빈_리포트_반환_빈_리스트(self):
        report = {"site": []}
        assert extract_alerts(report) == []

    def test_단일_사이트_alerts_추출(self):
        report = make_report([make_alert(3), make_alert(2)])
        alerts = extract_alerts(report)
        assert len(alerts) == 2

    def test_여러_사이트_alerts_합산(self):
        report = {
            "site": [
                {"alerts": [make_alert(3)]},
                {"alerts": [make_alert(2), make_alert(1)]},
            ]
        }
        alerts = extract_alerts(report)
        assert len(alerts) == 3

    def test_site_키_없으면_빈_리스트(self):
        assert extract_alerts({}) == []


# ---------------------------------------------------------------------------
# count_by_risk 테스트
# ---------------------------------------------------------------------------

class TestCountByRisk:
    def test_빈_alerts_반환_빈_dict(self):
        assert count_by_risk([]) == {}

    def test_단일_High_카운트(self):
        alerts = [make_alert(3)]
        counts = count_by_risk(alerts)
        assert counts == {3: 1}

    def test_여러_위험도_혼합(self):
        alerts = [
            make_alert(3),
            make_alert(3),
            make_alert(2),
            make_alert(1),
            make_alert(0),
        ]
        counts = count_by_risk(alerts)
        assert counts == {3: 2, 2: 1, 1: 1, 0: 1}

    def test_riskcode_문자열도_정수로_변환(self):
        # ZAP 리포트가 riskcode를 문자열로 내보내는 경우
        alert = {"riskcode": "3", "name": "Test"}
        counts = count_by_risk([alert])
        assert counts == {3: 1}

    def test_riskcode_숫자형도_처리(self):
        alert = {"riskcode": 3, "name": "Test"}
        counts = count_by_risk([alert])
        assert counts == {3: 1}

    def test_riskcode_없으면_0으로_처리(self):
        alert = {"name": "No riskcode"}
        counts = count_by_risk([alert])
        assert counts == {0: 1}


# ---------------------------------------------------------------------------
# evaluate_gate 테스트 (게이트 핵심 로직)
# ---------------------------------------------------------------------------

class TestEvaluateGate:
    def test_게이트_통과_High_0건(self):
        counts = {2: 5, 1: 10}  # Medium, Low만 있음
        assert evaluate_gate(counts) == 0

    def test_게이트_차단_High_1건(self):
        counts = {3: 1}
        assert evaluate_gate(counts) == 1

    def test_게이트_차단_High_다수(self):
        counts = {3: 5, 2: 3}
        assert evaluate_gate(counts) == 1

    def test_게이트_차단_Critical_4건(self):
        # riskcode 4 = Critical (일부 ZAP 플러그인)
        counts = {4: 2}
        assert evaluate_gate(counts) == 1

    def test_빈_counts_통과(self):
        assert evaluate_gate({}) == 0

    def test_Info_Low_Medium만_통과(self):
        counts = {0: 3, 1: 7, 2: 4}
        assert evaluate_gate(counts) == 0

    def test_GATE_MIN_RISKCODE_는_3이어야_한다(self):
        # 정책 변경을 방지하는 회귀 테스트
        assert GATE_MIN_RISKCODE == 3, (
            "게이트 최소 위험도는 High(3) 이상이어야 합니다. "
            "변경이 필요하면 이 테스트와 docs/runbooks/zap-dast.md를 함께 수정하세요."
        )


# ---------------------------------------------------------------------------
# load_report 테스트
# ---------------------------------------------------------------------------

class TestLoadReport:
    def test_유효한_JSON_파일_로드(self, tmp_path: Path):
        report_data = make_report([make_alert(3)])
        report_file = tmp_path / "zap-report.json"
        report_file.write_text(json.dumps(report_data), encoding="utf-8")
        loaded = load_report(report_file)
        assert loaded == report_data

    def test_파일_없으면_SystemExit_2(self, tmp_path: Path):
        with pytest.raises(SystemExit) as exc_info:
            load_report(tmp_path / "nonexistent.json")
        assert exc_info.value.code == 2

    def test_잘못된_JSON_이면_SystemExit_2(self, tmp_path: Path):
        bad_file = tmp_path / "bad.json"
        bad_file.write_text("not valid json {{{", encoding="utf-8")
        with pytest.raises(SystemExit) as exc_info:
            load_report(bad_file)
        assert exc_info.value.code == 2


# ---------------------------------------------------------------------------
# 통합 시나리오 테스트
# ---------------------------------------------------------------------------

class TestIntegrationScenarios:
    def test_취약점_없는_리포트_PASS(self, tmp_path: Path):
        report = make_report([make_alert(1), make_alert(0)])
        report_file = tmp_path / "report.json"
        report_file.write_text(json.dumps(report), encoding="utf-8")

        loaded = load_report(report_file)
        alerts = extract_alerts(loaded)
        counts = count_by_risk(alerts)
        assert evaluate_gate(counts) == 0

    def test_High_취약점_있는_리포트_FAIL(self, tmp_path: Path):
        report = make_report([make_alert(3, "SQL Injection"), make_alert(2)])
        report_file = tmp_path / "report.json"
        report_file.write_text(json.dumps(report), encoding="utf-8")

        loaded = load_report(report_file)
        alerts = extract_alerts(loaded)
        counts = count_by_risk(alerts)
        assert evaluate_gate(counts) == 1

    def test_보안_헤더_누락_Medium_리포트_PASS(self, tmp_path: Path):
        """보안 헤더 누락은 Medium → 게이트 통과(WARN)"""
        headers_alerts = [
            make_alert(2, "Content-Security-Policy Header Not Set"),
            make_alert(2, "X-Frame-Options Header Not Set"),
            make_alert(1, "Timestamp Disclosure - Unix"),
        ]
        report = make_report(headers_alerts)
        report_file = tmp_path / "report.json"
        report_file.write_text(json.dumps(report), encoding="utf-8")

        loaded = load_report(report_file)
        alerts = extract_alerts(loaded)
        counts = count_by_risk(alerts)
        # Medium(2)은 게이트 차단 대상 아님 → PASS
        assert evaluate_gate(counts) == 0
