"""
eval.provider_compare.report — SAST findings 집합 비교 및 표 생성.

핵심 타입:
  - FindingKey: (file, line, type) 정규화 튜플
  - ProviderResult: provider별 분석 결과 컨테이너
  - CompareResult: 집합 비교 결과 (교집합/각사 only)
  - build_summary_table: 텍스트 표 생성

집합 비교 로직은 순수함수 — 부수효과 없음, 단위테스트 가능.
VAL-1 절대채점과의 중복 회피: 상대 비교 + 수동 spot-check MVP.
scorer 확장 포인트는 FindingKey 표준화로 VAL-1 재사용 가능.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import NamedTuple

# ── 상수 ─────────────────────────────────────────────────────────────────────
# severity 표시 순서 및 미지정 기본값
SEVERITY_ORDER = ("CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN")
SEVERITY_DEFAULT = "UNKNOWN"

# 수치 표 컬럼 너비 (텍스트 렌더링용)
_COL_PROVIDER = 12
_COL_FILES = 7
_COL_FINDINGS = 9
_COL_SEVERITY = 28  # "C:0 H:0 M:0 L:0" 형식
_COL_LATENCY = 10
_COL_COST = 12


# ── 핵심 타입 ─────────────────────────────────────────────────────────────────

class FindingKey(NamedTuple):
    """finding 식별 키 — (file, line, type) 정규화.

    VAL-1 scorer가 이 타입을 재사용할 수 있도록 NamedTuple로 공개.
    line은 int 0 이상. type은 대문자 정규화.
    """
    file: str
    line: int
    vuln_type: str

    @classmethod
    def from_finding(cls, finding: dict, file_path: str = "") -> "FindingKey":
        """finding dict에서 FindingKey를 생성한다.

        file 필드 없으면 file_path 인자를 사용.
        line은 int 변환 실패 시 0. type은 대문자 strip.
        """
        file = finding.get("file") or file_path or ""
        raw_line = finding.get("line", 0)
        try:
            line = int(raw_line)
        except (TypeError, ValueError):
            line = 0
        vuln_type = str(finding.get("type", "")).strip().upper()
        return cls(file=file, line=line, vuln_type=vuln_type)


@dataclass
class ProviderResult:
    """provider 하나의 분석 결과."""
    provider: str
    findings: list[dict] = field(default_factory=list)
    # 파일 경로 → findings 목록 (file별 집계용)
    file_findings: dict[str, list[dict]] = field(default_factory=dict)
    latency_sec: float = 0.0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    cache_creation_tokens: int = 0
    cache_read_tokens: int = 0
    error_files: list[str] = field(default_factory=list)

    @property
    def finding_keys(self) -> frozenset[FindingKey]:
        """전체 findings를 FindingKey 집합으로 반환한다."""
        return frozenset(
            FindingKey.from_finding(f, file_path=fp)
            for fp, flist in self.file_findings.items()
            for f in flist
        )

    def severity_counts(self) -> dict[str, int]:
        """severity별 finding 수를 반환한다."""
        counts: dict[str, int] = {s: 0 for s in SEVERITY_ORDER}
        for f in self.findings:
            sev = str(f.get("severity", SEVERITY_DEFAULT)).upper()
            if sev not in counts:
                sev = SEVERITY_DEFAULT
            counts[sev] += 1
        return counts


@dataclass
class CompareResult:
    """두 provider 집합 비교 결과.

    합의   = 교집합: 두 provider 모두 동일 (file, line, type) 발견
    a_only = provider_a만 발견 → provider_b 관점에서 미탐(recall gap) 후보
    b_only = provider_b만 발견 → provider_a 관점에서 미탐; b 측 오탐 후보
    """
    provider_a: str
    provider_b: str
    consensus: frozenset[FindingKey]
    a_only: frozenset[FindingKey]   # provider_a만 발견 (= b 미탐 후보)
    b_only: frozenset[FindingKey]   # provider_b만 발견 (= a 미탐/b 오탐 후보)

    @property
    def recall_gap_a(self) -> int:
        """provider_a 기준 미탐 후보 수 (b_only 크기)."""
        return len(self.b_only)

    @property
    def recall_gap_b(self) -> int:
        """provider_b 기준 미탐 후보 수 (a_only 크기)."""
        return len(self.a_only)

    @property
    def fp_candidate_b(self) -> int:
        """provider_b 오탐 후보 수 (b_only — a가 찾지 못한 것)."""
        return len(self.b_only)


def compare_findings(
    result_a: ProviderResult,
    result_b: ProviderResult,
) -> CompareResult:
    """두 ProviderResult의 FindingKey 집합을 비교해 CompareResult를 반환한다.

    순수함수 — 인자를 변경하지 않는다.

    Args:
        result_a: 기준 provider 결과 (보통 anthropic/claude)
        result_b: 비교 provider 결과 (보통 gemini)

    Returns:
        CompareResult: 교집합/A-only/B-only 집합
    """
    keys_a = result_a.finding_keys
    keys_b = result_b.finding_keys

    consensus = keys_a & keys_b
    a_only = keys_a - keys_b
    b_only = keys_b - keys_a

    return CompareResult(
        provider_a=result_a.provider,
        provider_b=result_b.provider,
        consensus=consensus,
        a_only=a_only,
        b_only=b_only,
    )


def build_summary_table(
    results: list[ProviderResult],
    compare: CompareResult | None = None,
) -> str:
    """분석 결과 수치 표와 집합 비교 요약을 텍스트로 반환한다.

    Args:
        results: provider별 ProviderResult 목록
        compare: 두 provider 비교 결과 (None이면 집합 비교 섹션 생략)

    Returns:
        출력용 텍스트 표 문자열
    """
    lines: list[str] = []

    # ── provider별 수치 표 ────────────────────────────────────────────────────
    header = (
        f"{'Provider':<{_COL_PROVIDER}} "
        f"{'Files':>{_COL_FILES}} "
        f"{'Findings':>{_COL_FINDINGS}} "
        f"{'Severity (C/H/M/L)':<{_COL_SEVERITY}} "
        f"{'Latency(s)':>{_COL_LATENCY}} "
        f"{'Est.Cost($)':>{_COL_COST}}"
    )
    separator = "-" * len(header)
    lines.append(separator)
    lines.append(header)
    lines.append(separator)

    for r in results:
        sev = r.severity_counts()
        sev_str = (
            f"C:{sev['CRITICAL']} H:{sev['HIGH']} "
            f"M:{sev['MEDIUM']} L:{sev['LOW']}"
        )
        file_count = len(r.file_findings)
        cost = _estimate_cost(r.provider, r.total_input_tokens, r.total_output_tokens)
        lines.append(
            f"{r.provider:<{_COL_PROVIDER}} "
            f"{file_count:>{_COL_FILES}} "
            f"{len(r.findings):>{_COL_FINDINGS}} "
            f"{sev_str:<{_COL_SEVERITY}} "
            f"{r.latency_sec:>{_COL_LATENCY}.1f} "
            f"{cost:>{_COL_COST}.6f}"
        )
        if r.error_files:
            lines.append(f"  [skip] {len(r.error_files)} file(s) errored: {r.error_files[:3]}")

    lines.append(separator)

    # ── 집합 비교 요약 ────────────────────────────────────────────────────────
    if compare is not None:
        lines.append("")
        lines.append("=== Recall Gap / FP Candidate Analysis ===")
        lines.append(
            f"Consensus (both found)   : {len(compare.consensus):>4} findings"
        )
        lines.append(
            f"{compare.provider_a}-only (recall gap for {compare.provider_b})"
            f"  : {len(compare.a_only):>4} findings"
        )
        lines.append(
            f"{compare.provider_b}-only (recall gap for {compare.provider_a}"
            f" / FP candidate): {len(compare.b_only):>4} findings"
        )
        total_union = len(compare.consensus) + len(compare.a_only) + len(compare.b_only)
        if total_union > 0:
            denom_a = len(compare.consensus) + len(compare.b_only)
            denom_b = len(compare.consensus) + len(compare.a_only)
            recall_a = len(compare.consensus) / denom_a if denom_a > 0 else 1.0
            recall_b = len(compare.consensus) / denom_b if denom_b > 0 else 1.0
            lines.append(
                f"Relative recall {compare.provider_a}: {recall_a:.1%}  "
                f"{compare.provider_b}: {recall_b:.1%}  "
                f"(vs each other — spot-check required for ground truth)"
            )
        lines.append("")
        lines.append("NOTE: This is relative comparison only.")
        lines.append(
            "  Manual spot-check recommended for FP candidates "
            f"({compare.provider_b}-only findings)."
        )

    return "\n".join(lines)


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

# 추정 단가 (USD per 1K tokens) — 실제 단가는 COST-3 PricingTable로 대체 예정
# 하드코딩 운영부채 회피: COST-3 이전 임시 참조용 상수로 분리
_COST_PER_1K: dict[str, dict[str, float]] = {
    "anthropic": {"input": 0.00025, "output": 0.00125},  # claude-haiku-4-5
    "gemini":    {"input": 0.000075, "output": 0.0003},   # gemini-2.5-flash
    "openai":    {"input": 0.00015, "output": 0.0006},    # gpt-4o-mini
}
_COST_PER_1K_DEFAULT = {"input": 0.001, "output": 0.003}


def _estimate_cost(provider: str, input_tokens: int, output_tokens: int) -> float:
    """토큰 수로 추정 비용(USD)을 계산한다.

    COST-3 PricingTable 구현 전 임시 단가 사용.
    미등록 provider는 기본 단가로 계산 후 0 이상을 보장한다.
    """
    rates = _COST_PER_1K.get(provider, _COST_PER_1K_DEFAULT)
    cost = (input_tokens / 1000.0) * rates["input"] + (output_tokens / 1000.0) * rates["output"]
    return max(0.0, cost)
