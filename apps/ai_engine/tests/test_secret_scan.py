"""
시크릿 스캔 정규식 패턴 및 핵심 로직 단위 테스트.

외부 API (GitHub, Claude) 는 호출하지 않는다.
"""
import pytest

from api.routes.secret_scan import (
    _SECRET_PATTERNS,
    _DUMMY_PATTERNS,
    _extract_added_lines,
    _is_likely_dummy,
    _scan_diff_with_regex,
)


# ─── 헬퍼 ────────────────────────────────────────────────────────────────────

def _get_pattern(name: str):
    """패턴 이름으로 정규식 객체를 반환한다."""
    for pattern_name, pattern in _SECRET_PATTERNS:
        if pattern_name == name:
            return pattern
    raise KeyError(f"Pattern not found: {name}")


def _make_diff(sha: str, filename: str, patch: str) -> dict:
    return {
        "sha":     sha,
        "message": "test commit",
        "date":    "2026-01-01T00:00:00Z",
        "files":   [{"filename": filename, "patch": patch, "status": "modified"}],
    }


# ─── TC-1: AWS Access Key 패턴 매칭 ─────────────────────────────────────────

class TestAwsAccessKeyPattern:
    pattern = _get_pattern("AWS_ACCESS_KEY")

    def test_real_aws_access_key_matches(self):
        text = "aws_access_key_id = AKIAIOSFODNN7EXAMPLE"
        assert self.pattern.search(text) is not None

    def test_akia_prefix_with_20_chars(self):
        # AKIA + 정확히 16자리 영숫자
        text = "AWS_ACCESS_KEY_ID=AKIAABCDEFGHIJKLMNO1"
        assert self.pattern.search(text) is not None

    def test_non_akia_prefix_not_matched(self):
        text = "KEY_ID=NOTAKIAIOSFODNN7EXAMPLE123"
        assert self.pattern.search(text) is None

    def test_too_short_not_matched(self):
        text = "AKIA1234"
        assert self.pattern.search(text) is None


# ─── TC-2: GitHub Token 패턴 매칭 ────────────────────────────────────────────

class TestGitHubTokenPattern:
    pattern = _get_pattern("GITHUB_TOKEN")

    def test_ghs_token_matches(self):
        # ghs_ = GitHub Actions 서버 토큰
        text = "GITHUB_TOKEN=ghs_" + "A" * 36
        assert self.pattern.search(text) is not None

    def test_ghp_personal_access_token_matches(self):
        text = "token = ghp_" + "B" * 40
        assert self.pattern.search(text) is not None

    def test_gho_oauth_token_matches(self):
        text = "auth: gho_" + "C" * 36
        assert self.pattern.search(text) is not None

    def test_partial_gh_prefix_not_matched(self):
        text = "gh_not_a_token_format"
        assert self.pattern.search(text) is None

    def test_too_short_not_matched(self):
        text = "ghp_ABC"
        assert self.pattern.search(text) is None


# ─── TC-3: JWT Token 패턴 매칭 ───────────────────────────────────────────────

class TestJwtTokenPattern:
    pattern = _get_pattern("JWT_TOKEN")

    def test_valid_jwt_three_parts_matches(self):
        header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
        payload = "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ"
        sig = "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        text = f"Authorization: Bearer {header}.{payload}.{sig}"
        assert self.pattern.search(text) is not None

    def test_only_two_parts_not_matched(self):
        text = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0"
        assert self.pattern.search(text) is None

    def test_short_parts_not_matched(self):
        text = "eyJa.eyJz.abc"
        assert self.pattern.search(text) is None


# ─── TC-4: Private Key 패턴 매칭 ─────────────────────────────────────────────

class TestPrivateKeyPattern:
    pattern = _get_pattern("PRIVATE_KEY")

    def test_rsa_private_key_header_matches(self):
        assert self.pattern.search("-----BEGIN RSA PRIVATE KEY-----") is not None

    def test_ec_private_key_header_matches(self):
        assert self.pattern.search("-----BEGIN EC PRIVATE KEY-----") is not None

    def test_generic_private_key_header_matches(self):
        assert self.pattern.search("-----BEGIN PRIVATE KEY-----") is not None

    def test_openssh_private_key_header_matches(self):
        assert self.pattern.search("-----BEGIN OPENSSH PRIVATE KEY-----") is not None

    def test_public_key_not_matched(self):
        assert self.pattern.search("-----BEGIN PUBLIC KEY-----") is None


# ─── TC-5: 더미 패턴 필터 ────────────────────────────────────────────────────

class TestDummyFilter:
    def test_example_keyword_is_dummy(self):
        assert _is_likely_dummy("AKIAIOSFODNN7EXAMPLE") is True

    def test_test_keyword_is_dummy(self):
        assert _is_likely_dummy("ghp_test_token_for_testing") is True

    def test_placeholder_is_dummy(self):
        assert _is_likely_dummy("your-api-key-here") is True

    def test_real_looking_value_not_dummy(self):
        assert _is_likely_dummy("AKIAIOSFODNN7QWERTYU") is False

    def test_xxx_is_dummy(self):
        assert _is_likely_dummy("apikey=xxxxxxxxxxxxxxxxxxxxxxxx") is True


# ─── TC-6: diff 추가 라인 추출 ───────────────────────────────────────────────

class TestExtractAddedLines:
    def test_plus_lines_are_extracted(self):
        patch = "@@ -1,3 +1,5 @@\n context\n+added line 1\n+added line 2\n-removed line\n"
        result = _extract_added_lines(patch)
        assert "added line 1" in result
        assert "added line 2" in result

    def test_removed_lines_not_included(self):
        patch = "-removed line with SECRET_KEY=abc123\n+clean line\n"
        result = _extract_added_lines(patch)
        assert "removed line" not in result
        assert "clean line" in result

    def test_diff_header_excluded(self):
        patch = "+++ b/config.py\n+real_line = 'value'\n"
        result = _extract_added_lines(patch)
        assert "+++ b/config.py" not in result
        assert "real_line" in result

    def test_empty_patch_returns_empty(self):
        assert _extract_added_lines(None) == ""
        assert _extract_added_lines("") == ""


# ─── TC-7: 전체 diff 스캔 흐름 ───────────────────────────────────────────────

class TestScanDiffWithRegex:
    def test_aws_key_in_diff_detected(self):
        sha = "abc1234567890"
        patch = "+AWS_ACCESS_KEY_ID = AKIAIOSFODNN7REALKEY\n"
        diff = _make_diff(sha, "config/aws.py", patch)
        findings = _scan_diff_with_regex(diff)
        assert len(findings) >= 1
        assert findings[0]["sha"] == sha
        assert findings[0]["filename"] == "config/aws.py"
        assert findings[0]["pattern_type"] == "AWS_ACCESS_KEY"

    def test_dummy_value_filtered_out(self):
        patch = "+AWS_ACCESS_KEY_ID = AKIAIOSFODNN7EXAMPLE\n"
        diff = _make_diff("sha123", "test/fixtures.py", patch)
        findings = _scan_diff_with_regex(diff)
        # EXAMPLE 포함 → 더미로 필터링
        assert len(findings) == 0

    def test_removed_line_not_detected(self):
        # 삭제된 라인에 있는 시크릿은 감지 대상이 아님
        patch = "-OLD_KEY = AKIAIOSFODNN7REALKEY\n+NEW_KEY = empty\n"
        diff = _make_diff("sha456", "src/config.py", patch)
        findings = _scan_diff_with_regex(diff)
        assert len(findings) == 0

    def test_github_token_in_diff_detected(self):
        token = "ghs_" + "A" * 36
        patch = f"+GITHUB_TOKEN={token}\n"
        diff = _make_diff("def7890", ".env", patch)
        findings = _scan_diff_with_regex(diff)
        assert any(f["pattern_type"] == "GITHUB_TOKEN" for f in findings)

    def test_no_patch_file_skipped(self):
        diff = {
            "sha": "abc",
            "message": "binary commit",
            "date": "2026-01-01T00:00:00Z",
            "files": [{"filename": "image.png", "patch": None, "status": "added"}],
        }
        findings = _scan_diff_with_regex(diff)
        assert len(findings) == 0

    def test_multiple_secrets_in_one_diff(self):
        aws_key = "AKIAIOSFODNN7REALKEY"
        jwt = (
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
            ".eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0"
            ".SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        )
        patch = f"+AWS_KEY={aws_key}\n+token={jwt}\n"
        diff = _make_diff("multi1", "src/secrets.py", patch)
        findings = _scan_diff_with_regex(diff)
        types_found = {f["pattern_type"] for f in findings}
        assert "AWS_ACCESS_KEY" in types_found
        assert "JWT_TOKEN" in types_found


# ─── TC-8: 민감 정보 로그 차단 확인 (matched_value 마스킹 검증) ───────────────

class TestRedactedOutput:
    def test_added_line_in_finding_is_redacted(self):
        token = "ghs_" + "Z" * 36
        patch = f"+GITHUB_TOKEN={token}\n"
        diff = _make_diff("redact1", "app.env", patch)
        findings = _scan_diff_with_regex(diff)
        assert len(findings) >= 1
        # added_line 필드에 실제 토큰 값이 포함되지 않아야 한다
        for finding in findings:
            assert token not in finding.get("added_line", ""), \
                "Secret value must be redacted in added_line field"
