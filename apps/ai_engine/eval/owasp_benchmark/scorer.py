"""
eval.owasp_benchmark.scorer — OWASP Benchmark 채점 모듈.

외부 I/O 없는 순수 함수 모듈.
혼동행렬(TP/FP/TN/FN) → TPR/FPR/score 계산.

OWASP Benchmark 공식 채점 방식:
    score = TPR − FPR  (Youden 지수와 동일)

단위 테스트 대상:
    - compute(): 고정 입력 → 기대 지표 검증
    - vuln_type_to_cwe(): 매핑 정확성 검증
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import NamedTuple

# ── 상수 ─────────────────────────────────────────────────────────────────────

# OWASP score = TPR − FPR (Youden index)
# TPR = Recall = TP / (TP + FN)
# FPR = FP / (FP + TN)

# 고정 recall 임계값 — "recall 80%에서의 FPR" 계산에 사용
FIXED_RECALL_THRESHOLD = 0.8

# BenchmarkJava CSV의 Category 컬럼 → CWE 번호 매핑
# OWASP BenchmarkJava v1.2 기준 (2024년 최신 안정 태그 기준)
# 참고: https://owasp.org/www-project-benchmark/
VULN_TYPE_TO_CWE: dict[str, str] = {
    "cmdi":       "CWE-78",   # Command Injection
    "crypto":     "CWE-327",  # Use of a Broken or Risky Cryptographic Algorithm
    "hash":       "CWE-328",  # Use of Weak Hash
    "ldapi":      "CWE-90",   # LDAP Injection
    "pathtraver": "CWE-22",   # Path Traversal
    "securecookie": "CWE-614", # Sensitive Cookie in HTTPS Session Without 'Secure' Attribute
    "sqli":       "CWE-89",   # SQL Injection
    "trustbound": "CWE-501",  # Trust Boundary Violation
    "weakrand":   "CWE-330",  # Use of Insufficiently Random Values
    "xpathi":     "CWE-643",  # XPath Injection
    "xss":        "CWE-79",   # Cross-site Scripting
}

# 탐지율(TPR) 임계 — full/partial/none 분류용
COVERAGE_FULL_THRESHOLD = 0.7    # ≥ 70% → full
COVERAGE_PARTIAL_THRESHOLD = 0.3  # ≥ 30% → partial, 미만 → none


# ── 데이터 클래스 ─────────────────────────────────────────────────────────────

class CaseResult(NamedTuple):
    """단일 벤치마크 케이스 평가 결과."""
    test_name: str             # 예: BenchmarkTest00001
    category: str              # 예: sqli (소문자)
    expected_vuln: bool        # CSV의 real-vulnerability 컬럼
    expected_cwe: str          # 예: CWE-89
    flagged: bool              # 엔진이 expected_cwe와 일치하는 취약점을 신고했는지
    predicted_cwes: list[str]  # 엔진이 신고한 모든 CWE 목록


@dataclass
class Metrics:
    """혼동행렬 + 파생 지표."""
    tp: int = 0
    fp: int = 0
    tn: int = 0
    fn: int = 0
    total: int = 0

    # 파생 지표 (compute 후 채워짐)
    recall: float = 0.0   # TPR = TP / (TP + FN)
    fpr: float = 0.0      # FPR = FP / (FP + TN)
    precision: float = 0.0
    f1: float = 0.0
    score: float = 0.0    # OWASP score = TPR − FPR
    fpr_at_fixed_recall: float | None = None  # FIXED_RECALL_THRESHOLD에서의 FPR

    by_category: dict[str, "Metrics"] = field(default_factory=dict)


# ── 공개 함수 ──────────────────────────────────────────────────────────────────

def vuln_type_to_cwe(vuln_type: str) -> str:
    """vulnType(카테고리명)을 CWE 번호로 변환한다.

    대소문자 무관. 매핑 없으면 빈 문자열 반환.
    """
    return VULN_TYPE_TO_CWE.get(vuln_type.lower().strip(), "")


def compute(rows: list[CaseResult]) -> Metrics:
    """케이스 목록에서 혼동행렬 + OWASP 공식 지표를 계산한다.

    Args:
        rows: CaseResult 목록. 빈 목록이면 모든 지표 0.0.

    Returns:
        Metrics — 전체 지표 + by_category 딕셔너리.
    """
    overall = _accumulate(rows)
    _fill_rates(overall)

    # 카테고리별 분해
    by_cat: dict[str, list[CaseResult]] = {}
    for r in rows:
        by_cat.setdefault(r.category, []).append(r)

    for cat, cat_rows in sorted(by_cat.items()):
        m = _accumulate(cat_rows)
        _fill_rates(m)
        overall.by_category[cat] = m

    return overall


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

def _accumulate(rows: list[CaseResult]) -> Metrics:
    """rows를 순회해 TP/FP/TN/FN을 집계한다."""
    m = Metrics(total=len(rows))
    for r in rows:
        if r.expected_vuln and r.flagged:
            m.tp += 1
        elif not r.expected_vuln and r.flagged:
            m.fp += 1
        elif r.expected_vuln and not r.flagged:
            m.fn += 1
        else:
            m.tn += 1
    return m


def _fill_rates(m: Metrics) -> None:
    """Metrics 인스턴스에 TPR/FPR/score 등 파생 지표를 채운다. in-place."""
    pos = m.tp + m.fn  # 실제 양성 (real vulnerabilities)
    neg = m.fp + m.tn  # 실제 음성 (non-vulnerabilities)

    m.recall = m.tp / pos if pos > 0 else 0.0
    m.fpr    = m.fp / neg if neg > 0 else 0.0
    m.score  = m.recall - m.fpr  # OWASP 공식 score

    prec_denom = m.tp + m.fp
    m.precision = m.tp / prec_denom if prec_denom > 0 else 0.0

    f1_denom = m.precision + m.recall
    m.f1 = 2 * m.precision * m.recall / f1_denom if f1_denom > 0 else 0.0

    # 고정 recall 임계에서의 FPR 계산:
    # 단일 임계가 없으므로 "현재 recall ≥ FIXED_RECALL_THRESHOLD면 현재 FPR 그대로"
    # 미달이면 None (달성 미확인 — 풀런 후 의미 있음)
    if m.recall >= FIXED_RECALL_THRESHOLD:
        m.fpr_at_fixed_recall = m.fpr
    else:
        m.fpr_at_fixed_recall = None
