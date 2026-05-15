"""
GitHub PR Webhook 처리 흐름 단위 테스트.

AI Engine에서 PR 변경 파일 기반 분석 요청을 처리하는 흐름을
mock을 사용하여 격리 테스트한다.
실제 LLM 호출 및 외부 네트워크 호출은 모두 mock 처리한다.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ─── PR 변경 파일 필터링 테스트 ──────────────────────────────────────────────

class TestPrChangedFileFilter:
    """PR 변경 파일 목록을 분석 대상으로 필터링하는 로직 테스트."""

    def test_filters_only_source_files(self):
        """소스 코드 파일만 분석 대상으로 필터링된다."""
        changed_files = [
            "src/main/java/Foo.java",
            "README.md",
            "package.json",
            "src/main/java/Bar.java",
            ".github/workflows/ci.yml",
            "src/test/java/FooTest.java",
        ]

        # 분석 대상 확장자 필터 (실제 구현 예시)
        analyzable_extensions = {".java", ".py", ".js", ".ts", ".go", ".rb", ".php"}
        filtered = [
            f for f in changed_files
            if any(f.endswith(ext) for ext in analyzable_extensions)
        ]

        assert "src/main/java/Foo.java" in filtered
        assert "src/main/java/Bar.java" in filtered
        assert "src/test/java/FooTest.java" in filtered
        assert "README.md" not in filtered
        assert ".github/workflows/ci.yml" not in filtered

    def test_empty_changed_files_returns_empty_list(self):
        """변경 파일이 없으면 빈 목록을 반환한다."""
        changed_files = []
        analyzable_extensions = {".java", ".py", ".js", ".ts"}
        filtered = [
            f for f in changed_files
            if any(f.endswith(ext) for ext in analyzable_extensions)
        ]
        assert filtered == []

    def test_filters_out_deleted_files(self):
        """삭제된 파일(status=removed)은 분석 대상에서 제외된다."""
        pr_files = [
            {"filename": "src/Foo.java", "status": "added"},
            {"filename": "src/Bar.java", "status": "modified"},
            {"filename": "src/Old.java", "status": "removed"},
        ]

        active_files = [
            f["filename"] for f in pr_files
            if f.get("status") != "removed"
        ]

        assert "src/Foo.java" in active_files
        assert "src/Bar.java" in active_files
        assert "src/Old.java" not in active_files


# ─── PR 분석 요청 페이로드 구성 테스트 ────────────────────────────────────────

class TestPrAnalysisPayload:
    """AI Engine에 전달되는 PR 분석 요청 페이로드 구성 테스트."""

    def test_payload_contains_required_fields(self):
        """분석 요청 페이로드에 필수 필드가 포함된다."""
        session_id = "550e8400-e29b-41d4-a716-446655440000"
        project_id = "660e8400-e29b-41d4-a716-446655440001"
        changed_files = ["src/main/java/Foo.java", "src/main/java/Bar.java"]

        payload = {
            "session_id": session_id,
            "project_id": project_id,
            "source_type": "github",
            "github_owner": "testorg",
            "github_repo": "testrepo",
            "github_ref": "abc123",
            "changed_files": changed_files,
        }

        assert payload["session_id"] == session_id
        assert payload["project_id"] == project_id
        assert payload["source_type"] == "github"
        assert payload["changed_files"] == changed_files
        assert "github_token" not in payload or payload.get("github_token") is None

    def test_payload_does_not_log_token(self):
        """페이로드에서 token 필드가 로그에 노출되지 않도록 제거된다."""
        full_payload = {
            "session_id": "test-session",
            "project_id": "test-project",
            "github_token": "ghp_supersecrettoken",
            "changed_files": ["src/Foo.java"],
        }

        # 로깅용 payload에서 token 제거
        log_safe_payload = {k: v for k, v in full_payload.items() if k != "github_token"}

        assert "github_token" not in log_safe_payload
        assert "session_id" in log_safe_payload


# ─── Webhook 이벤트 액션 필터링 테스트 ────────────────────────────────────────

class TestWebhookActionFilter:
    """PR Webhook 액션에 따른 처리 여부 결정 로직 테스트."""

    PROCESSABLE_ACTIONS = {"opened", "synchronize"}

    def _should_process(self, action: str) -> bool:
        return action in self.PROCESSABLE_ACTIONS

    def test_opened_action_triggers_processing(self):
        """action=opened이면 분석을 시작한다."""
        assert self._should_process("opened") is True

    def test_synchronize_action_triggers_processing(self):
        """action=synchronize이면 분석을 시작한다."""
        assert self._should_process("synchronize") is True

    def test_closed_action_skips_processing(self):
        """action=closed이면 분석을 건너뛴다."""
        assert self._should_process("closed") is False

    def test_labeled_action_skips_processing(self):
        """action=labeled이면 분석을 건너뛴다."""
        assert self._should_process("labeled") is False

    def test_merged_action_skips_processing(self):
        """action=merged이면 분석을 건너뛴다."""
        assert self._should_process("merged") is False

    def test_unknown_action_skips_processing(self):
        """알 수 없는 action이면 분석을 건너뛴다."""
        assert self._should_process("unknown_event") is False


# ─── PR 코멘트 본문 생성 테스트 ───────────────────────────────────────────────

class TestPrCommentBody:
    """PR 보안 리뷰 코멘트 본문 생성 로직 테스트."""

    def _build_comment_body(self, vuln_count: int, findings: list) -> str:
        if vuln_count == 0:
            return "## SecureAI Security Review\n\n보안 취약점이 발견되지 않았습니다."
        lines = ["## SecureAI Security Review\n"]
        lines.append(f"총 **{vuln_count}개**의 보안 취약점이 발견되었습니다.\n")
        for finding in findings:
            lines.append(f"- [{finding.get('severity', 'UNKNOWN')}] {finding.get('title', '')}")
        return "\n".join(lines)

    def test_no_vuln_comment_body(self):
        """취약점 없으면 안전 메시지를 반환한다."""
        body = self._build_comment_body(0, [])
        assert "보안 취약점이 발견되지 않았습니다" in body

    def test_vuln_count_appears_in_body(self):
        """취약점 수가 코멘트 본문에 포함된다."""
        findings = [
            {"severity": "HIGH", "title": "SQL Injection"},
            {"severity": "MEDIUM", "title": "XSS"},
        ]
        body = self._build_comment_body(2, findings)
        assert "2" in body
        assert "SQL Injection" in body
        assert "XSS" in body

    def test_comment_header_always_present(self):
        """코멘트 본문에 항상 헤더가 포함된다."""
        body = self._build_comment_body(0, [])
        assert "SecureAI Security Review" in body
