"""
tests.eval.test_owasp_scorer — scorer.py 단위 테스트.

검증 항목:
1. vuln_type_to_cwe() 매핑 정확성 (대소문자 무관)
2. compute() 혼동행렬 집계 정확성
3. compute() TPR/FPR/score 계산 정확성
4. compute() fpr_at_recall80 로직 (달성/미달)
5. compute() 빈 입력 처리
6. compute() by_category 분해
"""
from __future__ import annotations

import pytest

from eval.owasp_benchmark.scorer import (
    FIXED_RECALL_THRESHOLD,
    CaseResult,
    Metrics,
    compute,
    vuln_type_to_cwe,
)


# ── vuln_type_to_cwe() 테스트 ─────────────────────────────────────────────────

class TestVulnTypeToCwe:
    """vuln_type_to_cwe() 매핑 테스트."""

    def test_sqli_lowercase(self):
        assert vuln_type_to_cwe("sqli") == "CWE-89"

    def test_sqli_uppercase(self):
        assert vuln_type_to_cwe("SQLI") == "CWE-89"

    def test_xss(self):
        assert vuln_type_to_cwe("xss") == "CWE-79"

    def test_cmdi(self):
        assert vuln_type_to_cwe("cmdi") == "CWE-78"

    def test_pathtraver(self):
        assert vuln_type_to_cwe("pathtraver") == "CWE-22"

    def test_crypto(self):
        assert vuln_type_to_cwe("crypto") == "CWE-327"

    def test_weakrand(self):
        assert vuln_type_to_cwe("weakrand") == "CWE-330"

    def test_ldapi(self):
        assert vuln_type_to_cwe("ldapi") == "CWE-90"

    def test_xpathi(self):
        assert vuln_type_to_cwe("xpathi") == "CWE-643"

    def test_securecookie(self):
        assert vuln_type_to_cwe("securecookie") == "CWE-614"

    def test_trustbound(self):
        assert vuln_type_to_cwe("trustbound") == "CWE-501"

    def test_unknown_type_returns_empty(self):
        assert vuln_type_to_cwe("unknown_vuln") == ""

    def test_empty_string_returns_empty(self):
        assert vuln_type_to_cwe("") == ""

    def test_mixed_case(self):
        assert vuln_type_to_cwe("SqLi") == "CWE-89"

    def test_whitespace_stripped(self):
        assert vuln_type_to_cwe("  sqli  ") == "CWE-89"


# ── compute() 혼동행렬 테스트 ─────────────────────────────────────────────────

def _make_case(
    expected_vuln: bool,
    flagged: bool,
    category: str = "sqli",
    expected_cwe: str = "CWE-89",
    test_name: str = "BenchmarkTest00001",
) -> CaseResult:
    return CaseResult(
        test_name=test_name,
        category=category,
        expected_vuln=expected_vuln,
        expected_cwe=expected_cwe,
        flagged=flagged,
        predicted_cwes=[expected_cwe] if flagged else [],
    )


class TestComputeConfusionMatrix:
    """compute() 혼동행렬 집계 정확성 테스트."""

    def test_all_tp(self):
        rows = [_make_case(True, True) for _ in range(5)]
        m = compute(rows)
        assert m.tp == 5
        assert m.fp == 0
        assert m.tn == 0
        assert m.fn == 0
        assert m.total == 5

    def test_all_tn(self):
        rows = [_make_case(False, False) for _ in range(3)]
        m = compute(rows)
        assert m.tp == 0
        assert m.fp == 0
        assert m.tn == 3
        assert m.fn == 0
        assert m.total == 3

    def test_all_fp(self):
        rows = [_make_case(False, True) for _ in range(4)]
        m = compute(rows)
        assert m.tp == 0
        assert m.fp == 4
        assert m.tn == 0
        assert m.fn == 0
        assert m.total == 4

    def test_all_fn(self):
        rows = [_make_case(True, False) for _ in range(2)]
        m = compute(rows)
        assert m.tp == 0
        assert m.fp == 0
        assert m.tn == 0
        assert m.fn == 2
        assert m.total == 2

    def test_mixed_confusion_matrix(self):
        """TP=3, FP=2, TN=4, FN=1 케이스."""
        rows = (
            [_make_case(True, True) for _ in range(3)]      # TP×3
            + [_make_case(False, True) for _ in range(2)]   # FP×2
            + [_make_case(False, False) for _ in range(4)]  # TN×4
            + [_make_case(True, False) for _ in range(1)]   # FN×1
        )
        m = compute(rows)
        assert m.tp == 3
        assert m.fp == 2
        assert m.tn == 4
        assert m.fn == 1
        assert m.total == 10


class TestComputeRates:
    """compute() TPR/FPR/score 계산 정확성 테스트."""

    def test_perfect_classifier(self):
        """완벽한 분류기: recall=1.0, fpr=0.0, score=1.0."""
        rows = (
            [_make_case(True, True) for _ in range(10)]
            + [_make_case(False, False) for _ in range(10)]
        )
        m = compute(rows)
        assert m.recall == pytest.approx(1.0)
        assert m.fpr == pytest.approx(0.0)
        assert m.score == pytest.approx(1.0)

    def test_random_classifier(self):
        """무작위 분류기: recall=FPR → score≈0."""
        # TP=5, FN=5 → recall=0.5; FP=5, TN=5 → FPR=0.5 → score=0.0
        rows = (
            [_make_case(True, True) for _ in range(5)]
            + [_make_case(True, False) for _ in range(5)]
            + [_make_case(False, True) for _ in range(5)]
            + [_make_case(False, False) for _ in range(5)]
        )
        m = compute(rows)
        assert m.recall == pytest.approx(0.5)
        assert m.fpr == pytest.approx(0.5)
        assert m.score == pytest.approx(0.0)

    def test_specific_values(self):
        """TP=8, FP=2, TN=8, FN=2 → recall=0.8, fpr=0.2, score=0.6."""
        rows = (
            [_make_case(True, True) for _ in range(8)]
            + [_make_case(False, True) for _ in range(2)]
            + [_make_case(False, False) for _ in range(8)]
            + [_make_case(True, False) for _ in range(2)]
        )
        m = compute(rows)
        assert m.recall == pytest.approx(0.8)
        assert m.fpr == pytest.approx(0.2)
        assert m.score == pytest.approx(0.6, abs=1e-6)

    def test_precision_and_f1(self):
        """TP=4, FP=1 → precision=0.8, recall=1.0(fn=0)."""
        rows = (
            [_make_case(True, True) for _ in range(4)]
            + [_make_case(False, True) for _ in range(1)]
            + [_make_case(False, False) for _ in range(3)]
        )
        m = compute(rows)
        assert m.precision == pytest.approx(4 / 5)
        assert m.recall == pytest.approx(1.0)
        f1_expected = 2 * (4/5) * 1.0 / (4/5 + 1.0)
        assert m.f1 == pytest.approx(f1_expected, abs=1e-6)

    def test_score_formula(self):
        """score = TPR − FPR 공식 직접 검증."""
        rows = (
            [_make_case(True, True) for _ in range(7)]
            + [_make_case(True, False) for _ in range(3)]
            + [_make_case(False, True) for _ in range(1)]
            + [_make_case(False, False) for _ in range(9)]
        )
        m = compute(rows)
        # TPR = 7/(7+3) = 0.7, FPR = 1/(1+9) = 0.1, score = 0.6
        assert m.score == pytest.approx(m.recall - m.fpr, abs=1e-9)


class TestFprAtFixedRecall:
    """fpr_at_recall80 로직 테스트."""

    def test_recall_above_threshold_sets_fpr(self):
        """recall ≥ 0.8이면 fpr_at_recall80 = 현재 fpr."""
        # recall=0.8, fpr=0.2
        rows = (
            [_make_case(True, True) for _ in range(8)]
            + [_make_case(True, False) for _ in range(2)]
            + [_make_case(False, True) for _ in range(2)]
            + [_make_case(False, False) for _ in range(8)]
        )
        m = compute(rows)
        assert m.recall >= FIXED_RECALL_THRESHOLD
        assert m.fpr_at_fixed_recall is not None
        assert m.fpr_at_fixed_recall == pytest.approx(m.fpr, abs=1e-6)

    def test_recall_below_threshold_returns_none(self):
        """recall < 0.8이면 fpr_at_recall80 = None."""
        # recall = 0.5 (TP=5, FN=5)
        rows = (
            [_make_case(True, True) for _ in range(5)]
            + [_make_case(True, False) for _ in range(5)]
            + [_make_case(False, False) for _ in range(5)]
        )
        m = compute(rows)
        assert m.recall < FIXED_RECALL_THRESHOLD
        assert m.fpr_at_fixed_recall is None

    def test_perfect_recall_sets_fpr_zero(self):
        """recall=1.0이면 fpr_at_recall80=현재 fpr(0.0)."""
        rows = [_make_case(True, True) for _ in range(10)]
        rows += [_make_case(False, False) for _ in range(10)]
        m = compute(rows)
        assert m.fpr_at_fixed_recall == pytest.approx(0.0)


class TestComputeEdgeCases:
    """compute() 엣지 케이스 테스트."""

    def test_empty_rows_returns_zero_metrics(self):
        m = compute([])
        assert m.tp == 0
        assert m.fp == 0
        assert m.tn == 0
        assert m.fn == 0
        assert m.total == 0
        assert m.recall == 0.0
        assert m.fpr == 0.0
        assert m.score == 0.0
        assert m.fpr_at_fixed_recall is None

    def test_no_positives_recall_zero(self):
        """양성(real_vuln=True) 케이스가 없으면 recall=0.0."""
        rows = [_make_case(False, False) for _ in range(5)]
        m = compute(rows)
        assert m.recall == 0.0
        assert m.tn == 5

    def test_no_negatives_fpr_zero(self):
        """음성(real_vuln=False) 케이스가 없으면 fpr=0.0."""
        rows = [_make_case(True, True) for _ in range(5)]
        m = compute(rows)
        assert m.fpr == 0.0
        assert m.tp == 5


class TestComputeByCategory:
    """compute() by_category 분해 테스트."""

    def test_by_category_keys(self):
        rows = [
            _make_case(True, True, category="sqli"),
            _make_case(True, False, category="xss"),
            _make_case(False, True, category="sqli"),
        ]
        m = compute(rows)
        assert "sqli" in m.by_category
        assert "xss" in m.by_category

    def test_by_category_accuracy(self):
        rows = [
            _make_case(True, True, category="sqli"),   # TP
            _make_case(True, False, category="sqli"),  # FN
            _make_case(True, True, category="xss"),    # TP
            _make_case(False, False, category="xss"),  # TN
        ]
        m = compute(rows)
        sqli = m.by_category["sqli"]
        assert sqli.tp == 1
        assert sqli.fn == 1
        assert sqli.recall == pytest.approx(0.5)

        xss = m.by_category["xss"]
        assert xss.tp == 1
        assert xss.tn == 1
        assert xss.recall == pytest.approx(1.0)

    def test_total_matches_sum_of_categories(self):
        rows = (
            [_make_case(True, True, category="sqli") for _ in range(3)]
            + [_make_case(True, False, category="xss") for _ in range(2)]
        )
        m = compute(rows)
        cat_totals = sum(cm.total for cm in m.by_category.values())
        assert cat_totals == m.total
