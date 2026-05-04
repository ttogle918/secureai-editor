"""
TASK-304 — diff_generator 단위 테스트.

외부 I/O(Claude API, Redis) 없이 순수 함수만 검증한다.
"""
import json

import pytest

from agent.nodes.diff_generator import (
    PatchResult,
    generate_unified_diff,
    parse_patch_response,
)

# ---------------------------------------------------------------------------
# generate_unified_diff
# ---------------------------------------------------------------------------

ORIGINAL = "String q = \"SELECT * FROM users WHERE id = \" + userId;\n"
PATCHED = "String q = \"SELECT * FROM users WHERE id = ?\";\nps.setString(1, userId);\n"


def test_unified_diff_contains_required_headers():
    """unified diff에 --- / +++ / @@ 헤더가 모두 포함되어야 한다."""
    diff = generate_unified_diff(ORIGINAL, PATCHED, "src/Dao.java")
    assert "---" in diff
    assert "+++" in diff
    assert "@@" in diff


def test_unified_diff_shows_removed_line():
    diff = generate_unified_diff(ORIGINAL, PATCHED, "src/Dao.java")
    assert any(line.startswith("-") for line in diff.splitlines())


def test_unified_diff_shows_added_line():
    diff = generate_unified_diff(ORIGINAL, PATCHED, "src/Dao.java")
    assert any(line.startswith("+") for line in diff.splitlines())


def test_unified_diff_identical_inputs_returns_empty():
    diff = generate_unified_diff(ORIGINAL, ORIGINAL, "src/Dao.java")
    assert diff == ""


def test_unified_diff_file_path_appears_in_headers():
    diff = generate_unified_diff(ORIGINAL, PATCHED, "my/file.java")
    assert "my/file.java" in diff


# ---------------------------------------------------------------------------
# parse_patch_response — 정상 케이스
# ---------------------------------------------------------------------------

def _make_raw(patched_snippet: str, unified_diff: str = "", explanation: str = "Fixed.") -> str:
    return json.dumps({
        "patched_snippet": patched_snippet,
        "unified_diff": unified_diff,
        "explanation": explanation,
    })


def test_parse_patch_response_returns_patch_result():
    vuln = {"type": "SQL_INJECTION", "severity": "HIGH", "code_snippet": ORIGINAL}
    raw = _make_raw(PATCHED, "--- original\n+++ patched\n@@ -1 +1,2 @@\n-old\n+new\n")
    result = parse_patch_response(raw, vuln, "src/Dao.java")
    assert isinstance(result, PatchResult)


def test_parse_patch_response_fields_are_populated():
    vuln = {"type": "XSS", "code_snippet": "old code"}
    raw = _make_raw("safe code", "--- a\n+++ b\n@@ -1 +1 @@\n-old\n+safe\n", "Escaped output.")
    result = parse_patch_response(raw, vuln, "src/View.java")
    assert result is not None
    assert result.file_path == "src/View.java"
    assert result.vuln_type == "XSS"
    assert result.patched_snippet == "safe code"
    assert result.explanation == "Escaped output."
    assert result.original_snippet == "old code"


def test_parse_patch_response_generates_diff_when_unified_diff_missing():
    """unified_diff 필드가 빈 문자열이면 원본·수정본으로 diff를 자동 생성한다."""
    vuln = {"type": "PATH_TRAVERSAL", "code_snippet": ORIGINAL}
    raw = _make_raw(PATCHED, unified_diff="")
    result = parse_patch_response(raw, vuln, "src/FileUtil.java")
    assert result is not None
    assert "---" in result.unified_diff


def test_parse_patch_response_to_dict_contains_all_fields():
    vuln = {"type": "SQL_INJECTION", "code_snippet": ORIGINAL}
    raw = _make_raw(PATCHED, "--- a\n+++ b\n@@ -1 +1 @@\n-x\n+y\n")
    result = parse_patch_response(raw, vuln, "src/Dao.java")
    assert result is not None
    d = result.to_dict()
    for key in ("file_path", "vuln_type", "original_snippet", "patched_snippet", "unified_diff", "explanation"):
        assert key in d


# ---------------------------------------------------------------------------
# parse_patch_response — 오류 케이스
# ---------------------------------------------------------------------------

def test_parse_patch_response_invalid_json_returns_none():
    vuln = {"type": "SQL_INJECTION"}
    result = parse_patch_response("not json {{{", vuln, "src/Dao.java")
    assert result is None


def test_parse_patch_response_empty_patched_snippet_returns_none():
    vuln = {"type": "XSS"}
    raw = json.dumps({"patched_snippet": "", "unified_diff": "", "explanation": "done"})
    result = parse_patch_response(raw, vuln, "src/View.java")
    assert result is None


def test_parse_patch_response_missing_patched_snippet_returns_none():
    vuln = {"type": "XSS"}
    raw = json.dumps({"unified_diff": "diff", "explanation": "done"})
    result = parse_patch_response(raw, vuln, "src/View.java")
    assert result is None
