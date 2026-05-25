"""
secret_scan_node.py 단위 테스트.

LangGraph 노드 및 내부 헬퍼 함수를 격리하여 테스트한다.
외부 API (GitHub, OTel) 는 mock으로 대체한다.

TC 구성:
- TC-1: AWS Access Key 탐지
- TC-2: GitHub PAT (ghp_) 탐지
- TC-3: github_pat_ 형식 탐지
- TC-4: 더미/예제 값 필터링 (오탐 없음)
- TC-5: 삭제된 라인(-) 은 탐지 대상이 아님
- TC-6: matched_value 마스킹 확인 (실제 값 절대 노출 금지)
- TC-7: 고엔트로피 문자열 탐지
- TC-8: 개별 커밋 처리 실패 시 skip & log (전체 중단 금지)
- TC-9: 빈 커밋 목록이면 빈 결과 반환
- TC-10: private key 헤더 탐지
"""
import pytest
from unittest.mock import patch, MagicMock

from agent.nodes.secret_scan_node import (
    secret_scan_node,
    _scan_single_diff,
    _extract_added_lines,
    _is_high_entropy,
    _is_likely_dummy,
    _shannon_entropy,
    _MASKED_VALUE,
)


# ─── 헬퍼 ────────────────────────────────────────────────────────────────────

def _make_state(**overrides) -> dict:
    """secret_scan_node 에 필요한 최소 AgentState 딕셔너리를 반환한다."""
    base = {
        "session_id": "test-session-001",
        "project_id": "00000000-0000-0000-0000-000000000001",
        "workspace_root": "/workspace",
        "source_type": "github",
        "github_owner": "owner",
        "github_repo": "repo",
        "github_ref": "main",
        "github_token": None,
        "files_to_scan": [],
        "current_file_index": 0,
        "current_file_sha256": None,
        "cache_hit": False,
        "sast_results": [],
        "patch_results": [],
        "progress_percent": 0.0,
        "preferred_model": None,
        "user_api_key": None,
        "token_usage": {},
        "status": "running",
        "error_message": None,
        "commits": [],
    }
    base.update(overrides)
    return base


def _make_diff(sha: str, filename: str, patch: str) -> dict:
    """테스트용 커밋 diff 딕셔너리를 생성한다."""
    return {
        "sha": sha,
        "message": "test commit",
        "date": "2026-01-01T00:00:00Z",
        "files": [{"filename": filename, "patch": patch, "status": "modified"}],
    }


# ─── TC-1: AWS Access Key 탐지 ───────────────────────────────────────────────

def test_scan_detects_aws_access_key():
    """AKIA + 16자 대문자/숫자 패턴이 포함된 diff를 탐지한다."""
    patch_text = "+AWS_ACCESS_KEY_ID = AKIAIOSFODNN7REALKEY\n"
    diff = _make_diff("abc1234567890abcdef", "config/aws.py", patch_text)

    findings = _scan_single_diff(diff)

    assert len(findings) >= 1
    aws_findings = [f for f in findings if f["pattern_type"] == "AWS_ACCESS_KEY"]
    assert len(aws_findings) >= 1
    assert aws_findings[0]["sha"] == "abc1234567890abcdef"
    assert aws_findings[0]["file_path"] == "config/aws.py"


# ─── TC-2: GitHub PAT (ghp_) 탐지 ────────────────────────────────────────────

def test_scan_detects_github_pat_ghp():
    """ghp_ + 36자 이상 알파뉴머릭 패턴의 GitHub PAT를 탐지한다."""
    token = "ghp_" + "A" * 36
    patch_text = f"+GITHUB_TOKEN = {token}\n"
    diff = _make_diff("def4567890abcdef012", ".env", patch_text)

    findings = _scan_single_diff(diff)

    pat_findings = [f for f in findings if f["pattern_type"] == "GITHUB_PAT"]
    assert len(pat_findings) >= 1
    assert pat_findings[0]["file_path"] == ".env"


# ─── TC-3: github_pat_ 형식 탐지 ────────────────────────────────────────────

def test_scan_detects_github_pat_long_format():
    """github_pat_ + 82자 이상 패턴을 탐지한다."""
    token = "github_pat_" + "B" * 82
    patch_text = f"+token: {token}\n"
    diff = _make_diff("fff1234567890abcde1", "src/config.py", patch_text)

    findings = _scan_single_diff(diff)

    pat_findings = [f for f in findings if f["pattern_type"] == "GITHUB_PAT"]
    assert len(pat_findings) >= 1


# ─── TC-4: 더미/예제 값 필터링 ────────────────────────────────────────────────

def test_scan_filters_dummy_aws_key():
    """EXAMPLE 등 더미 키워드가 포함된 값은 탐지하지 않는다."""
    patch_text = "+AWS_ACCESS_KEY_ID = AKIAIOSFODNN7EXAMPLE\n"
    diff = _make_diff("aaa1234567890abcde1", "test/fixtures.py", patch_text)

    findings = _scan_single_diff(diff)

    aws_findings = [f for f in findings if f["pattern_type"] == "AWS_ACCESS_KEY"]
    # EXAMPLE이 포함된 값은 더미로 필터링되어야 한다
    assert len(aws_findings) == 0


def test_scan_filters_test_keyword():
    """'test' 키워드가 포함된 GitHub 토큰은 더미로 필터링된다."""
    token = "ghp_test_token_for_testing_123456789012"
    patch_text = f"+token = {token}\n"
    diff = _make_diff("bbb1234567890abcde1", "tests/conftest.py", patch_text)

    findings = _scan_single_diff(diff)

    pat_findings = [f for f in findings if f["pattern_type"] == "GITHUB_PAT"]
    assert len(pat_findings) == 0


# ─── TC-5: 삭제된 라인은 탐지 대상이 아님 ─────────────────────────────────────

def test_scan_ignores_removed_lines():
    """- 로 시작하는 삭제된 라인에 있는 시크릿은 탐지하지 않는다."""
    patch_text = "-OLD_KEY = AKIAIOSFODNN7REALKEY\n+NEW_KEY = clean_value\n"
    diff = _make_diff("ccc1234567890abcde1", "src/config.py", patch_text)

    findings = _scan_single_diff(diff)

    aws_findings = [f for f in findings if f["pattern_type"] == "AWS_ACCESS_KEY"]
    assert len(aws_findings) == 0


# ─── TC-6: matched_value 마스킹 확인 ────────────────────────────────────────

def test_matched_value_is_always_masked():
    """탐지 결과의 matched_value는 항상 '****' 마스킹 — 실제 값 노출 금지."""
    real_token = "ghp_" + "Z" * 36
    patch_text = f"+GITHUB_TOKEN={real_token}\n"
    diff = _make_diff("ddd1234567890abcde1", "app.env", patch_text)

    findings = _scan_single_diff(diff)

    assert len(findings) >= 1
    for finding in findings:
        assert finding["matched_value"] == _MASKED_VALUE, (
            f"실제 시크릿 값이 matched_value에 노출되어서는 안 됩니다. "
            f"pattern_type={finding['pattern_type']}"
        )
        # 실제 토큰 값이 어디에도 포함되어서는 안 된다
        assert real_token not in str(finding), (
            "실제 토큰 값이 finding 딕셔너리에 포함되어서는 안 됩니다."
        )


# ─── TC-7: 고엔트로피 문자열 탐지 ────────────────────────────────────────────

def test_high_entropy_detection():
    """Shannon 엔트로피 > 4.5이고 길이 20+ 이면 HIGH_ENTROPY로 탐지한다."""
    # Base64 문자셋의 고엔트로피 문자열 — 33자, 모든 문자가 고유하여 엔트로피 ≈ 5.04
    high_entropy_str = "aB3xK7mN2pQ8rS5tV1wY4zC6eD9fG0hJ"
    assert _is_high_entropy(high_entropy_str), "고엔트로피 테스트 값이 탐지되지 않았습니다"

    low_entropy_str = "aaaaaaaaaaaaaaaaaaa"  # 단일 문자 반복 — 저엔트로피
    assert not _is_high_entropy(low_entropy_str)


def test_high_entropy_string_in_diff():
    """고엔트로피 문자열이 포함된 diff는 HIGH_ENTROPY 타입으로 탐지된다."""
    # 엔트로피 높은 문자열 (랜덤 base64처럼 보이는 값)
    high_entropy = "aB3xK7mN2pQ8rS5tV1wY4zC6eD9fG0h"  # 32자
    patch_text = f"+secret_value = {high_entropy}\n"
    diff = _make_diff("eee1234567890abcde1", "config/prod.yaml", patch_text)

    findings = _scan_single_diff(diff)

    entropy_findings = [f for f in findings if f["pattern_type"] == "HIGH_ENTROPY"]
    assert len(entropy_findings) >= 1


# ─── TC-8: 개별 커밋 처리 실패 시 skip & log ─────────────────────────────────

@pytest.mark.asyncio
async def test_node_skips_failed_commit_and_continues():
    """한 커밋 처리 중 예외 발생 시 skip & log하고 나머지를 계속 처리한다."""
    good_token = "ghp_" + "A" * 36
    good_diff = _make_diff("fff0000000000000001", "src/app.py", f"+TOKEN={good_token}\n")
    bad_diff = None  # None은 처리 시 오류 발생

    commits = [bad_diff, good_diff]
    state = _make_state(commits=commits)

    # OTel tracer를 mock으로 대체
    mock_span = MagicMock()
    mock_span.__enter__ = MagicMock(return_value=mock_span)
    mock_span.__exit__ = MagicMock(return_value=False)
    mock_tracer = MagicMock()
    mock_tracer.start_as_current_span.return_value = mock_span

    with patch("agent.nodes.secret_scan_node.tracer", mock_tracer):
        result = await secret_scan_node(state)

    # 전체 세션이 실패하지 않고 결과를 반환해야 한다
    assert "secrets_found" in result


# ─── TC-9: 빈 커밋 목록이면 빈 결과 반환 ─────────────────────────────────────

@pytest.mark.asyncio
async def test_node_empty_commits_returns_empty():
    """commits가 빈 목록이면 secrets_found도 빈 목록을 반환한다."""
    state = _make_state(commits=[])

    mock_span = MagicMock()
    mock_span.__enter__ = MagicMock(return_value=mock_span)
    mock_span.__exit__ = MagicMock(return_value=False)
    mock_tracer = MagicMock()
    mock_tracer.start_as_current_span.return_value = mock_span

    with patch("agent.nodes.secret_scan_node.tracer", mock_tracer):
        result = await secret_scan_node(state)

    assert result["secrets_found"] == []


# ─── TC-10: Private Key 헤더 탐지 ────────────────────────────────────────────

def test_scan_detects_private_key_header():
    """-----BEGIN RSA PRIVATE KEY----- 헤더가 포함된 diff를 탐지한다."""
    patch_text = "+-----BEGIN RSA PRIVATE KEY-----\n"
    diff = _make_diff("ggg1234567890abcde1", "secrets/key.pem", patch_text)

    findings = _scan_single_diff(diff)

    key_findings = [f for f in findings if f["pattern_type"] == "PRIVATE_KEY"]
    assert len(key_findings) >= 1
    assert key_findings[0]["file_path"] == "secrets/key.pem"


# ─── 헬퍼 함수 단위 테스트 ───────────────────────────────────────────────────

class TestExtractAddedLines:
    def test_plus_lines_are_extracted(self):
        patch_text = "@@ -1,3 +1,5 @@\n context\n+added line 1\n+added line 2\n-removed\n"
        result = _extract_added_lines(patch_text)
        contents = [line for _, line in result]
        assert "added line 1" in contents
        assert "added line 2" in contents

    def test_removed_lines_not_included(self):
        patch_text = "-removed with SECRET_KEY=abc123\n+clean line\n"
        result = _extract_added_lines(patch_text)
        contents = [line for _, line in result]
        assert "removed with SECRET_KEY=abc123" not in contents
        assert "clean line" in contents

    def test_empty_patch_returns_empty(self):
        assert _extract_added_lines(None) == []
        assert _extract_added_lines("") == []

    def test_line_numbers_are_1_based(self):
        patch_text = "+first\n+second\n"
        result = _extract_added_lines(patch_text)
        assert result[0][0] == 1
        assert result[1][0] == 2


class TestShannonEntropy:
    def test_uniform_string_has_max_entropy(self):
        # 각 문자가 한 번씩만 등장하는 문자열은 엔트로피가 높다
        text = "abcdefghij"  # 10개 고유 문자
        entropy = _shannon_entropy(text)
        assert entropy > 3.0

    def test_single_char_string_has_zero_entropy(self):
        assert _shannon_entropy("aaaaaaaaaa") == 0.0

    def test_empty_string_has_zero_entropy(self):
        assert _shannon_entropy("") == 0.0


class TestIsDummy:
    def test_example_keyword_detected(self):
        assert _is_likely_dummy("AKIAIOSFODNN7EXAMPLE") is True

    def test_test_keyword_detected(self):
        assert _is_likely_dummy("ghp_test_token_123456789012345678901234567890") is True

    def test_placeholder_detected(self):
        assert _is_likely_dummy("your-api-key-here") is True

    def test_real_looking_value_not_dummy(self):
        assert _is_likely_dummy("AKIAIOSFODNN7QWERTYU") is False
