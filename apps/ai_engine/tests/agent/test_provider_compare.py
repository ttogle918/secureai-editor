"""
COST-2 단위 테스트 — eval.provider_compare 집합 비교 로직.

DoD 체크:
  🧪 FindingKey 정규화 (line int 변환, type 대문자)
  🧪 집합 비교 교집합 정확 (consensus)
  🧪 A-only / B-only 정확 (recall gap / FP 후보)
  🧪 동일 findings → a_only=0, b_only=0
  🧪 완전 불일치 → consensus=0
  🧪 ProviderResult.finding_keys 변환 정확
  🧪 ProviderResult.severity_counts 정확
  🧪 build_summary_table 포함 문자열 검증
  🧪 _estimate_cost 0 이상 보장
  🧪 runner._is_rate_limit_error 패턴 판단
  🧪 runner._collect_files limit 동작
  🧪 runner._read_file_safe 실패 시 None
"""
import json
import logging
import os
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch


# ── FindingKey 테스트 ─────────────────────────────────────────────────────────

class TestFindingKey:
    def test_from_finding_basic(self):
        """type 대문자, line int 변환."""
        from eval.provider_compare.report import FindingKey
        finding = {"file": "app.py", "line": 42, "type": "sql_injection"}
        key = FindingKey.from_finding(finding)
        assert key.file == "app.py"
        assert key.line == 42
        assert key.vuln_type == "SQL_INJECTION"

    def test_from_finding_string_line(self):
        """line이 문자열이면 int 변환한다."""
        from eval.provider_compare.report import FindingKey
        key = FindingKey.from_finding({"line": "15", "type": "XSS"})
        assert key.line == 15

    def test_from_finding_invalid_line_defaults_to_zero(self):
        """line 변환 실패 시 0."""
        from eval.provider_compare.report import FindingKey
        key = FindingKey.from_finding({"line": "not_a_number", "type": "XSS"})
        assert key.line == 0

    def test_from_finding_missing_line_defaults_to_zero(self):
        """line 키 없으면 0."""
        from eval.provider_compare.report import FindingKey
        key = FindingKey.from_finding({"type": "XSS"})
        assert key.line == 0

    def test_from_finding_fallback_file_path(self):
        """finding에 file 없으면 file_path 인자 사용."""
        from eval.provider_compare.report import FindingKey
        key = FindingKey.from_finding({"line": 1, "type": "XSS"}, file_path="src/app.py")
        assert key.file == "src/app.py"

    def test_equality_case_insensitive_type(self):
        """type 대소문자 무관하게 동일 키."""
        from eval.provider_compare.report import FindingKey
        k1 = FindingKey.from_finding({"file": "a.py", "line": 1, "type": "sql_injection"})
        k2 = FindingKey.from_finding({"file": "a.py", "line": 1, "type": "SQL_INJECTION"})
        assert k1 == k2

    def test_hashable_usable_in_set(self):
        """FindingKey는 집합에 담을 수 있다."""
        from eval.provider_compare.report import FindingKey
        k = FindingKey(file="a.py", line=10, vuln_type="XSS")
        s = {k, k}
        assert len(s) == 1


# ── compare_findings 집합 비교 테스트 ────────────────────────────────────────

def _make_result(provider: str, file_findings: dict[str, list[dict]]) -> "ProviderResult":
    from eval.provider_compare.report import ProviderResult
    r = ProviderResult(provider=provider, file_findings=file_findings)
    r.findings = [f for flist in file_findings.values() for f in flist]
    return r


class TestCompareFindings:
    def test_identical_findings_zero_gap(self):
        """동일한 findings → a_only=0, b_only=0, consensus=전체."""
        from eval.provider_compare.report import compare_findings
        findings = [{"file": "a.py", "line": 10, "type": "XSS", "severity": "HIGH"}]
        ra = _make_result("anthropic", {"a.py": findings})
        rb = _make_result("gemini", {"a.py": findings})

        result = compare_findings(ra, rb)

        assert len(result.consensus) == 1
        assert len(result.a_only) == 0
        assert len(result.b_only) == 0

    def test_completely_different_findings_zero_consensus(self):
        """완전 불일치 → consensus=0, a_only·b_only 각각 1."""
        from eval.provider_compare.report import compare_findings
        fa = [{"file": "a.py", "line": 10, "type": "XSS", "severity": "HIGH"}]
        fb = [{"file": "a.py", "line": 20, "type": "SQLI", "severity": "CRITICAL"}]
        ra = _make_result("anthropic", {"a.py": fa})
        rb = _make_result("gemini", {"a.py": fb})

        result = compare_findings(ra, rb)

        assert len(result.consensus) == 0
        assert len(result.a_only) == 1
        assert len(result.b_only) == 1

    def test_partial_overlap(self):
        """부분 일치 — 교집합 1, 각 1개씩 only."""
        from eval.provider_compare.report import compare_findings
        shared = {"file": "a.py", "line": 10, "type": "XSS", "severity": "HIGH"}
        only_a = {"file": "a.py", "line": 20, "type": "SQLI", "severity": "CRITICAL"}
        only_b = {"file": "a.py", "line": 30, "type": "IDOR", "severity": "MEDIUM"}

        ra = _make_result("anthropic", {"a.py": [shared, only_a]})
        rb = _make_result("gemini", {"a.py": [shared, only_b]})

        result = compare_findings(ra, rb)

        assert len(result.consensus) == 1
        assert len(result.a_only) == 1
        assert len(result.b_only) == 1

    def test_a_only_is_recall_gap_for_b(self):
        """a_only = provider_b가 놓친 findings (recall gap for b)."""
        from eval.provider_compare.report import compare_findings
        fa = [{"file": "a.py", "line": 5, "type": "PATH_TRAVERSAL", "severity": "HIGH"}]
        ra = _make_result("anthropic", {"a.py": fa})
        rb = _make_result("gemini", {"a.py": []})

        result = compare_findings(ra, rb)

        assert result.recall_gap_b == 1
        assert result.recall_gap_a == 0

    def test_b_only_is_fp_candidate(self):
        """b_only = a가 찾지 못한 것 → b의 오탐 후보."""
        from eval.provider_compare.report import compare_findings
        fb = [{"file": "a.py", "line": 5, "type": "CODE_SMELL", "severity": "LOW"}]
        ra = _make_result("anthropic", {"a.py": []})
        rb = _make_result("gemini", {"a.py": fb})

        result = compare_findings(ra, rb)

        assert result.fp_candidate_b == 1
        assert result.recall_gap_a == 1

    def test_empty_both_providers(self):
        """두 provider 모두 findings 없음."""
        from eval.provider_compare.report import compare_findings
        ra = _make_result("anthropic", {})
        rb = _make_result("gemini", {})

        result = compare_findings(ra, rb)

        assert len(result.consensus) == 0
        assert len(result.a_only) == 0
        assert len(result.b_only) == 0

    def test_multiple_files(self):
        """여러 파일 걸친 비교 — 전체 키 집합 기준."""
        from eval.provider_compare.report import compare_findings
        ra = _make_result("anthropic", {
            "a.py": [{"file": "a.py", "line": 1, "type": "XSS"}],
            "b.py": [{"file": "b.py", "line": 2, "type": "SQLI"}],
        })
        rb = _make_result("gemini", {
            "a.py": [{"file": "a.py", "line": 1, "type": "XSS"}],
            # b.py 없음
        })

        result = compare_findings(ra, rb)

        assert len(result.consensus) == 1
        assert len(result.a_only) == 1  # b.py SQLI — b 미탐
        assert len(result.b_only) == 0

    def test_provider_names_preserved(self):
        """CompareResult에 provider 이름이 정확히 담긴다."""
        from eval.provider_compare.report import compare_findings
        ra = _make_result("anthropic", {})
        rb = _make_result("gemini", {})

        result = compare_findings(ra, rb)

        assert result.provider_a == "anthropic"
        assert result.provider_b == "gemini"

    def test_pure_function_no_mutation(self):
        """compare_findings는 인자를 변경하지 않는다."""
        from eval.provider_compare.report import compare_findings
        fa = [{"file": "a.py", "line": 1, "type": "XSS"}]
        ra = _make_result("anthropic", {"a.py": fa})
        rb = _make_result("gemini", {"a.py": []})

        original_findings_a = list(ra.findings)
        compare_findings(ra, rb)

        assert ra.findings == original_findings_a


# ── ProviderResult 테스트 ─────────────────────────────────────────────────────

class TestProviderResult:
    def test_finding_keys_from_file_findings(self):
        """file_findings에서 FindingKey 집합이 정확히 생성된다."""
        from eval.provider_compare.report import ProviderResult, FindingKey
        r = ProviderResult(provider="anthropic", file_findings={
            "a.py": [{"line": 10, "type": "XSS"}],
            "b.py": [{"line": 5, "type": "SQLI"}],
        })
        keys = r.finding_keys
        assert FindingKey(file="a.py", line=10, vuln_type="XSS") in keys
        assert FindingKey(file="b.py", line=5, vuln_type="SQLI") in keys
        assert len(keys) == 2

    def test_severity_counts(self):
        """severity_counts가 각 레벨을 정확히 집계한다."""
        from eval.provider_compare.report import ProviderResult
        r = ProviderResult(provider="anthropic", findings=[
            {"severity": "CRITICAL"},
            {"severity": "HIGH"},
            {"severity": "HIGH"},
            {"severity": "medium"},   # 소문자도 처리
            {"severity": "LOW"},
        ])
        counts = r.severity_counts()
        assert counts["CRITICAL"] == 1
        assert counts["HIGH"] == 2
        assert counts["MEDIUM"] == 1
        assert counts["LOW"] == 1

    def test_severity_counts_unknown_maps_to_unknown(self):
        """미등록 severity는 UNKNOWN으로 집계된다."""
        from eval.provider_compare.report import ProviderResult
        r = ProviderResult(provider="anthropic", findings=[
            {"severity": "VERY_HIGH"},
        ])
        counts = r.severity_counts()
        assert counts["UNKNOWN"] == 1


# ── build_summary_table 테스트 ────────────────────────────────────────────────

class TestBuildSummaryTable:
    def test_table_contains_provider_name(self):
        """표에 provider 이름이 포함된다."""
        from eval.provider_compare.report import ProviderResult, build_summary_table
        r = ProviderResult(provider="anthropic")
        table = build_summary_table([r])
        assert "anthropic" in table

    def test_table_contains_compare_section_when_provided(self):
        """compare 결과가 있으면 집합 비교 섹션이 포함된다."""
        from eval.provider_compare.report import (
            ProviderResult, compare_findings, build_summary_table,
        )
        ra = _make_result("anthropic", {"a.py": [{"file": "a.py", "line": 1, "type": "XSS"}]})
        rb = _make_result("gemini", {"a.py": []})
        cmp = compare_findings(ra, rb)

        table = build_summary_table([ra, rb], cmp)

        assert "Recall Gap" in table
        assert "Consensus" in table

    def test_table_omits_compare_section_when_none(self):
        """compare=None이면 집합 비교 섹션이 없다."""
        from eval.provider_compare.report import ProviderResult, build_summary_table
        r = ProviderResult(provider="anthropic")
        table = build_summary_table([r], compare=None)
        assert "Recall Gap" not in table

    def test_table_with_multiple_providers(self):
        """두 provider 표에 모두 이름이 나타난다."""
        from eval.provider_compare.report import ProviderResult, build_summary_table
        ra = ProviderResult(provider="anthropic")
        rb = ProviderResult(provider="gemini")
        table = build_summary_table([ra, rb])
        assert "anthropic" in table
        assert "gemini" in table

    def test_table_empty_results(self):
        """results 빈 목록 — 오류 없이 표 생성."""
        from eval.provider_compare.report import build_summary_table
        table = build_summary_table([])
        assert isinstance(table, str)


# ── _estimate_cost 테스트 ─────────────────────────────────────────────────────

class TestEstimateCost:
    def test_cost_non_negative(self):
        """추정 비용은 항상 0 이상."""
        from eval.provider_compare.report import _estimate_cost
        assert _estimate_cost("anthropic", 0, 0) >= 0.0
        assert _estimate_cost("gemini", 1000, 500) >= 0.0

    def test_unknown_provider_uses_default(self):
        """미등록 provider는 오류 없이 기본 단가 사용."""
        from eval.provider_compare.report import _estimate_cost
        cost = _estimate_cost("unknown_provider", 1000, 500)
        assert cost > 0.0

    def test_cost_increases_with_tokens(self):
        """토큰 수가 많을수록 비용이 커진다."""
        from eval.provider_compare.report import _estimate_cost
        c1 = _estimate_cost("anthropic", 1000, 500)
        c2 = _estimate_cost("anthropic", 2000, 1000)
        assert c2 > c1


# ── runner 헬퍼 함수 테스트 ──────────────────────────────────────────────────

class TestRunnerHelpers:
    def test_is_rate_limit_error_with_429(self):
        """429 포함 문자열은 rate limit 오류로 판단한다."""
        from eval.provider_compare.runner import _is_rate_limit_error
        assert _is_rate_limit_error("HTTP 429 Too Many Requests") is True

    def test_is_rate_limit_error_with_rate_keyword(self):
        """'rate' 포함 오류는 rate limit."""
        from eval.provider_compare.runner import _is_rate_limit_error
        assert _is_rate_limit_error("RateLimitExceeded: quota reached") is True

    def test_is_rate_limit_error_with_quota(self):
        """'quota' 포함 오류도 rate limit."""
        from eval.provider_compare.runner import _is_rate_limit_error
        assert _is_rate_limit_error("Quota exhausted for model") is True

    def test_is_rate_limit_error_false_for_other(self):
        """일반 오류는 rate limit 아님."""
        from eval.provider_compare.runner import _is_rate_limit_error
        assert _is_rate_limit_error("ConnectionError: timeout") is False
        assert _is_rate_limit_error("ValueError: invalid api key") is False

    def test_read_file_safe_nonexistent(self):
        """존재하지 않는 파일은 None 반환."""
        from eval.provider_compare.runner import _read_file_safe
        result = _read_file_safe("/nonexistent/path/to/file.py")
        assert result is None

    def test_read_file_safe_existing(self, tmp_path):
        """존재하는 파일은 내용을 반환한다."""
        from eval.provider_compare.runner import _read_file_safe
        f = tmp_path / "test.py"
        f.write_text("x = 1\n", encoding="utf-8")
        result = _read_file_safe(str(f))
        assert result == "x = 1\n"

    def test_collect_files_limit(self, tmp_path):
        """limit 지정 시 최대 N개만 수집한다."""
        from eval.provider_compare.runner import _collect_files
        # .py 파일 5개 생성
        for i in range(5):
            (tmp_path / f"f{i}.py").write_text("x = 1")
        files = _collect_files(str(tmp_path), limit=3)
        assert len(files) == 3

    def test_collect_files_no_limit(self, tmp_path):
        """limit=None이면 모든 지원 파일 수집."""
        from eval.provider_compare.runner import _collect_files
        for i in range(4):
            (tmp_path / f"f{i}.py").write_text("x = 1")
        # 지원하지 않는 확장자
        (tmp_path / "README.md").write_text("# doc")
        files = _collect_files(str(tmp_path), limit=None)
        assert len(files) == 4

    def test_collect_files_unsupported_extension_excluded(self, tmp_path):
        """.md, .txt 등 지원하지 않는 확장자는 제외된다."""
        from eval.provider_compare.runner import _collect_files
        (tmp_path / "notes.txt").write_text("hello")
        (tmp_path / "README.md").write_text("# doc")
        (tmp_path / "app.py").write_text("x = 1")
        files = _collect_files(str(tmp_path), limit=None)
        assert len(files) == 1
        assert files[0].endswith("app.py")

    def test_collect_files_nonexistent_dir(self):
        """존재하지 않는 디렉터리는 빈 목록 반환."""
        from eval.provider_compare.runner import _collect_files
        files = _collect_files("/nonexistent/path", limit=None)
        assert files == []


# ── run_compare 통합 mock 테스트 ─────────────────────────────────────────────

class TestRunCompare:
    @pytest.mark.asyncio
    async def test_run_compare_skips_no_key_provider(self, tmp_path):
        """키 없음 provider는 스킵 — ValueError catch."""
        from eval.provider_compare.runner import run_compare

        f = tmp_path / "app.py"
        f.write_text("x = 1\n")

        call_count = 0

        async def fake_analyze(file_path, content, guidelines="", model=None, api_key=None, *, provider="anthropic"):
            nonlocal call_count
            call_count += 1
            if provider == "gemini":
                raise ValueError("GEMINI_API_KEY not configured")
            return ('{"vulnerabilities": []}', {
                "input_tokens": 10, "output_tokens": 5,
                "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
            })

        with patch("eval.provider_compare.runner.analyze_for_sast", side_effect=fake_analyze):
            payload = await run_compare(
                target_dir=str(tmp_path),
                providers=["gemini", "anthropic"],
                limit=1,
                output_path=str(tmp_path / "latest.json"),
            )

        # gemini 스킵, anthropic만 결과에 있어야 함
        assert "anthropic" in payload["providers_ran"]
        assert "gemini" not in payload["providers_ran"]

    @pytest.mark.asyncio
    async def test_run_compare_partial_file_failure_skip_and_log(self, tmp_path, caplog):
        """개별 파일 오류는 skip & log — 전체 실패 금지."""
        from eval.provider_compare.runner import run_compare

        good = tmp_path / "good.py"
        good.write_text("x = 1\n")
        bad = tmp_path / "bad.py"
        bad.write_text("y = 2\n")

        call_count = {"n": 0}

        async def fake_analyze(file_path, content, guidelines="", model=None, api_key=None, *, provider="anthropic"):
            call_count["n"] += 1
            if "bad.py" in file_path:
                raise RuntimeError("network error")
            return ('{"vulnerabilities": [{"type": "XSS", "line": 1, "severity": "HIGH"}]}', {
                "input_tokens": 10, "output_tokens": 5,
                "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
            })

        with patch("eval.provider_compare.runner.analyze_for_sast", side_effect=fake_analyze):
            with caplog.at_level(logging.WARNING):
                payload = await run_compare(
                    target_dir=str(tmp_path),
                    providers=["anthropic"],
                    limit=None,
                    output_path=str(tmp_path / "latest.json"),
                )

        assert "anthropic" in payload["providers_ran"]
        # error_files에 bad.py 기록됨
        stats = next(s for s in payload["provider_stats"] if s["provider"] == "anthropic")
        assert any("bad.py" in ef for ef in stats["error_files"])

    @pytest.mark.asyncio
    async def test_run_compare_saves_latest_json(self, tmp_path):
        """output_path에 latest.json이 저장된다."""
        from eval.provider_compare.runner import run_compare

        f = tmp_path / "app.py"
        f.write_text("x = 1\n")
        out_path = tmp_path / "out" / "latest.json"

        async def fake_analyze(file_path, content, guidelines="", model=None, api_key=None, *, provider="anthropic"):
            return ('{"vulnerabilities": []}', {
                "input_tokens": 10, "output_tokens": 5,
                "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
            })

        with patch("eval.provider_compare.runner.analyze_for_sast", side_effect=fake_analyze):
            await run_compare(
                target_dir=str(tmp_path),
                providers=["anthropic"],
                limit=1,
                output_path=str(out_path),
            )

        assert out_path.exists()
        data = json.loads(out_path.read_text())
        assert "provider_stats" in data

    @pytest.mark.asyncio
    async def test_run_compare_two_providers_generates_compare_section(self, tmp_path):
        """두 provider 실행 시 compare 섹션이 생성된다."""
        from eval.provider_compare.runner import run_compare

        f = tmp_path / "app.py"
        f.write_text("x = 1\n")

        async def fake_analyze(file_path, content, guidelines="", model=None, api_key=None, *, provider="anthropic"):
            if provider == "anthropic":
                return ('{"vulnerabilities": [{"type": "XSS", "line": 1, "severity": "HIGH"}]}', {
                    "input_tokens": 10, "output_tokens": 5,
                    "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
                })
            return ('{"vulnerabilities": []}', {
                "input_tokens": 10, "output_tokens": 5,
                "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
            })

        with patch("eval.provider_compare.runner.analyze_for_sast", side_effect=fake_analyze):
            payload = await run_compare(
                target_dir=str(tmp_path),
                providers=["anthropic", "gemini"],
                limit=1,
                output_path=str(tmp_path / "latest.json"),
            )

        assert payload["compare"] is not None
        assert payload["compare"]["a_only_count"] == 1   # anthropic-only → gemini 미탐
        assert payload["compare"]["b_only_count"] == 0
        assert payload["compare"]["consensus_count"] == 0
