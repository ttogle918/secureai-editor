"""
tests.eval.test_owasp_runner — runner.py 단위 테스트.

검증 항목:
1. _parse_csv_row() — CSV 행 파싱 및 필드 정규화
2. _normalize_cwe() — CWE 번호 정규화
3. _sample_by_category() — 카테고리별 균형 샘플링
4. _is_flagged() — CWE 일치 판정 (대소문자 무관)
5. _is_rate_limit_error() — rate limit 오류 감지
6. _build_payload() — latest.json 페이로드 스키마 검증
"""
from __future__ import annotations

import pytest

from eval.owasp_benchmark.runner import (
    _build_payload,
    _is_flagged,
    _is_rate_limit_error,
    _normalize_cwe,
    _parse_csv_row,
    _sample_by_category,
)
from eval.owasp_benchmark.scorer import CaseResult, Metrics, compute


# ── _normalize_cwe() 테스트 ───────────────────────────────────────────────────

class TestNormalizeCwe:
    def test_numeric_only(self):
        assert _normalize_cwe("89") == "CWE-89"

    def test_already_prefixed(self):
        assert _normalize_cwe("CWE-89") == "CWE-89"

    def test_lowercase_prefix(self):
        assert _normalize_cwe("cwe-89") == "CWE-89"

    def test_whitespace_stripped(self):
        assert _normalize_cwe("  89  ") == "CWE-89"

    def test_three_digits(self):
        assert _normalize_cwe("327") == "CWE-327"

    def test_non_numeric_passthrough(self):
        # 숫자도 아니고 CWE 접두어도 아닌 경우 대문자로만 변환
        result = _normalize_cwe("UNKNOWN")
        assert result == "UNKNOWN"


# ── _parse_csv_row() 테스트 ──────────────────────────────────────────────────

class TestParseCsvRow:
    def test_standard_row_true_vuln(self):
        row = {
            "# test name": "BenchmarkTest00001",
            "category": "sqli",
            "real vulnerability": "true",
            "cwe": "89",
        }
        result = _parse_csv_row(row)
        assert result is not None
        assert result["test_name"] == "BenchmarkTest00001"
        assert result["category"] == "sqli"
        assert result["expected_vuln"] is True
        assert result["expected_cwe"] == "CWE-89"

    def test_standard_row_false_vuln(self):
        row = {
            "# test name": "BenchmarkTest00002",
            "category": "xss",
            "real vulnerability": "false",
            "cwe": "79",
        }
        result = _parse_csv_row(row)
        assert result is not None
        assert result["expected_vuln"] is False

    def test_alternate_header_test_name(self):
        """'test name' (# 없는 헤더) 대응."""
        row = {
            "test name": "BenchmarkTest00003",
            "category": "cmdi",
            "real vulnerability": "true",
            "cwe": "78",
        }
        result = _parse_csv_row(row)
        assert result is not None
        assert result["test_name"] == "BenchmarkTest00003"

    def test_missing_test_name_returns_none(self):
        row = {
            "category": "sqli",
            "real vulnerability": "true",
            "cwe": "89",
        }
        result = _parse_csv_row(row)
        assert result is None

    def test_missing_category_returns_none(self):
        row = {
            "# test name": "BenchmarkTest00004",
            "real vulnerability": "true",
            "cwe": "89",
        }
        result = _parse_csv_row(row)
        assert result is None

    def test_empty_category_returns_none(self):
        row = {
            "# test name": "BenchmarkTest00005",
            "category": "",
            "real vulnerability": "true",
            "cwe": "89",
        }
        result = _parse_csv_row(row)
        assert result is None

    def test_category_normalized_lowercase(self):
        row = {
            "# test name": "BenchmarkTest00006",
            "category": "SQLI",
            "real vulnerability": "true",
            "cwe": "89",
        }
        result = _parse_csv_row(row)
        assert result is not None
        assert result["category"] == "sqli"

    def test_real_vuln_false_string(self):
        for falsy in ["false", "False", "FALSE", "0", "no"]:
            row = {
                "# test name": "X",
                "category": "xss",
                "real vulnerability": falsy,
                "cwe": "79",
            }
            result = _parse_csv_row(row)
            assert result is not None
            assert result["expected_vuln"] is False, f"failed for: {falsy}"

    def test_real_vuln_true_variants(self):
        for truthy in ["true", "True", "TRUE", "1", "yes"]:
            row = {
                "# test name": "X",
                "category": "xss",
                "real vulnerability": truthy,
                "cwe": "79",
            }
            result = _parse_csv_row(row)
            assert result is not None
            assert result["expected_vuln"] is True, f"failed for: {truthy}"

    def test_cwe_fallback_from_category(self):
        """cwe 컬럼 없으면 vuln_type_to_cwe()로 대체."""
        row = {
            "# test name": "BenchmarkTest00007",
            "category": "sqli",
            "real vulnerability": "true",
            "cwe": "",
        }
        result = _parse_csv_row(row)
        assert result is not None
        assert result["expected_cwe"] == "CWE-89"

    def test_cwe_already_prefixed_in_csv(self):
        """CWE-89처럼 이미 접두어 있는 경우."""
        row = {
            "# test name": "BenchmarkTest00008",
            "category": "sqli",
            "real vulnerability": "true",
            "cwe": "CWE-89",
        }
        result = _parse_csv_row(row)
        assert result is not None
        assert result["expected_cwe"] == "CWE-89"


# ── _sample_by_category() 테스트 ─────────────────────────────────────────────

class TestSampleByCategory:
    def _make_cases(self, category: str, n: int) -> list[dict]:
        return [
            {
                "test_name": f"Test{i:05d}",
                "category": category,
                "expected_vuln": True,
                "expected_cwe": "CWE-89",
            }
            for i in range(n)
        ]

    def test_limit_applied_per_category(self):
        cases = self._make_cases("sqli", 50) + self._make_cases("xss", 30)
        sampled = _sample_by_category(cases, limit=10)
        sqli_count = sum(1 for c in sampled if c["category"] == "sqli")
        xss_count  = sum(1 for c in sampled if c["category"] == "xss")
        assert sqli_count == 10
        assert xss_count  == 10

    def test_limit_larger_than_category_size(self):
        """limit이 카테고리 케이스 수보다 크면 전체 포함."""
        cases = self._make_cases("sqli", 5)
        sampled = _sample_by_category(cases, limit=100)
        assert len(sampled) == 5

    def test_empty_cases(self):
        sampled = _sample_by_category([], limit=10)
        assert sampled == []

    def test_total_is_bounded(self):
        """limit=5, 3개 카테고리 → 최대 15개."""
        cases = (
            self._make_cases("sqli", 20)
            + self._make_cases("xss", 20)
            + self._make_cases("cmdi", 20)
        )
        sampled = _sample_by_category(cases, limit=5)
        assert len(sampled) == 15


# ── _is_flagged() 테스트 ─────────────────────────────────────────────────────

class TestIsFlagged:
    def test_exact_match(self):
        assert _is_flagged(["CWE-89"], "CWE-89") is True

    def test_case_insensitive(self):
        assert _is_flagged(["cwe-89"], "CWE-89") is True

    def test_numeric_cwe_in_predicted(self):
        """예측이 숫자만인 경우 정규화 후 비교."""
        assert _is_flagged(["89"], "CWE-89") is True

    def test_numeric_cwe_in_expected(self):
        assert _is_flagged(["CWE-89"], "89") is True

    def test_no_match(self):
        assert _is_flagged(["CWE-79", "CWE-22"], "CWE-89") is False

    def test_empty_predicted(self):
        assert _is_flagged([], "CWE-89") is False

    def test_empty_expected(self):
        assert _is_flagged(["CWE-89"], "") is False

    def test_both_empty(self):
        assert _is_flagged([], "") is False

    def test_multiple_predictions_one_matches(self):
        assert _is_flagged(["CWE-79", "CWE-89", "CWE-22"], "CWE-89") is True


# ── _is_rate_limit_error() 테스트 ────────────────────────────────────────────

class TestIsRateLimitError:
    def test_rate_in_message(self):
        assert _is_rate_limit_error("rate limit exceeded") is True

    def test_429_in_message(self):
        assert _is_rate_limit_error("HTTP 429 Too Many Requests") is True

    def test_quota_in_message(self):
        assert _is_rate_limit_error("quota exceeded for today") is True

    def test_generic_error_false(self):
        assert _is_rate_limit_error("connection refused") is False

    def test_empty_string_false(self):
        assert _is_rate_limit_error("") is False

    def test_uppercase_rate(self):
        assert _is_rate_limit_error("RATE LIMIT") is True


# ── _build_payload() 스키마 검증 ─────────────────────────────────────────────

class TestBuildPayload:
    def _make_rows(self) -> list[CaseResult]:
        return [
            CaseResult("T1", "sqli", True, "CWE-89", True, ["CWE-89"]),
            CaseResult("T2", "xss", True, "CWE-79", False, []),
            CaseResult("T3", "sqli", False, "CWE-89", False, []),
        ]

    def test_required_keys_present(self):
        rows = self._make_rows()
        metrics = compute(rows)
        payload = _build_payload(metrics, "claude-test", 10.5, 0.05, rows)

        required_keys = {
            "total", "tp", "fp", "tn", "fn",
            "recall", "fpr", "score",
            "model", "elapsed_s", "cost_usd_est",
        }
        for key in required_keys:
            assert key in payload, f"missing key: {key}"

    def test_total_matches_row_count(self):
        rows = self._make_rows()
        metrics = compute(rows)
        payload = _build_payload(metrics, "claude-test", 5.0, 0.01, rows)
        assert payload["total"] == len(rows)

    def test_model_stored(self):
        rows = self._make_rows()
        metrics = compute(rows)
        payload = _build_payload(metrics, "claude-sonnet-4-5", 5.0, 0.01, rows)
        assert payload["model"] == "claude-sonnet-4-5"

    def test_by_category_in_payload(self):
        rows = self._make_rows()
        metrics = compute(rows)
        payload = _build_payload(metrics, "m", 1.0, 0.0, rows)
        assert "by_category" in payload
        assert "sqli" in payload["by_category"]
        assert "xss" in payload["by_category"]

    def test_score_equals_recall_minus_fpr(self):
        """payload의 score = recall − fpr."""
        rows = self._make_rows()
        metrics = compute(rows)
        payload = _build_payload(metrics, "m", 1.0, 0.0, rows)
        assert payload["score"] == pytest.approx(
            payload["recall"] - payload["fpr"], abs=1e-5
        )

    def test_fpr_at_recall80_is_none_when_below_threshold(self):
        """recall < 0.8이면 fpr_at_recall80=None."""
        # FN만 있으면 recall=0
        rows = [CaseResult("T1", "sqli", True, "CWE-89", False, [])]
        metrics = compute(rows)
        payload = _build_payload(metrics, "m", 1.0, 0.0, rows)
        assert payload["fpr_at_recall80"] is None
