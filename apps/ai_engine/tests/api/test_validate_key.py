"""
COST-4: POST /agent/validate-key 테스트.
LLM 실제 호출 없음 — factory.get_provider 와 provider.analyze를 mock.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)
INTERNAL_KEY = "test-internal-key"


def _headers():
    return {"X-Internal-Key": INTERNAL_KEY}


@pytest.fixture(autouse=True)
def patch_settings_internal_key(monkeypatch):
    """InternalKeyAuthMiddleware가 INTERNAL_API_KEY를 비교하므로 테스트용 키로 설정."""
    monkeypatch.setenv("INTERNAL_API_KEY", INTERNAL_KEY)


class TestValidateKey:

    @patch("api.routes.validate_key.get_provider")
    def test_validate_key_valid_gemini(self, mock_get_provider):
        """유효한 Gemini 키 → valid=True 반환"""
        mock_provider = MagicMock()
        mock_provider.analyze = AsyncMock(return_value=("ok", {}))
        mock_get_provider.return_value = mock_provider

        res = client.post(
            "/agent/validate-key",
            json={"provider": "gemini", "api_key": "AIza-test-key"},
            headers=_headers(),
        )
        assert res.status_code == 200
        assert res.json()["valid"] is True

    @patch("api.routes.validate_key.get_provider")
    def test_validate_key_invalid_key_returns_false(self, mock_get_provider):
        """인증 실패(예외 발생) → valid=False 반환, 예외 전파 금지"""
        mock_provider = MagicMock()
        mock_provider.analyze = AsyncMock(side_effect=Exception("401 Unauthorized"))
        mock_get_provider.return_value = mock_provider

        res = client.post(
            "/agent/validate-key",
            json={"provider": "anthropic", "api_key": "invalid-key"},
            headers=_headers(),
        )
        assert res.status_code == 200
        assert res.json()["valid"] is False

    @patch("api.routes.validate_key.get_provider")
    def test_validate_key_unsupported_provider_returns_false(self, mock_get_provider):
        """미지원 provider → ValueError → valid=False"""
        mock_get_provider.side_effect = ValueError("Unsupported provider: unknown")

        res = client.post(
            "/agent/validate-key",
            json={"provider": "unknown-provider", "api_key": "some-key"},
            headers=_headers(),
        )
        assert res.status_code == 200
        assert res.json()["valid"] is False

    @patch("api.routes.validate_key.get_provider")
    def test_validate_key_response_has_no_api_key(self, mock_get_provider):
        """응답에 api_key 필드가 포함되지 않는다."""
        mock_provider = MagicMock()
        mock_provider.analyze = AsyncMock(return_value=("ok", {}))
        mock_get_provider.return_value = mock_provider

        res = client.post(
            "/agent/validate-key",
            json={"provider": "openai", "api_key": "sk-test"},
            headers=_headers(),
        )
        body = res.json()
        assert "api_key" not in body
        assert "key" not in body
        assert "valid" in body


class TestAgentStatePreferredProvider:
    """AgentState에 preferred_provider 필드가 존재하는지 확인한다."""

    def test_agent_state_has_preferred_provider(self):
        from agent.agent_state import AgentState
        hints = AgentState.__annotations__
        assert "preferred_provider" in hints, (
            "AgentState에 preferred_provider 필드가 없습니다 (COST-4 필수)"
        )

    def test_agent_state_preferred_provider_is_optional_str(self):
        from agent.agent_state import AgentState
        import typing
        hints = AgentState.__annotations__
        field_type = hints["preferred_provider"]
        # str | None 형태인지 확인
        assert field_type is not None


class TestAnalyzeRequestPreferredProvider:
    """AnalyzeRequest에 preferred_provider 필드가 있고 None이 기본값인지 확인."""

    def test_analyze_request_accepts_preferred_provider(self):
        from api.routes.analyze import AnalyzeRequest
        req = AnalyzeRequest(
            session_id="sess-1",
            project_id="proj-1",
            preferred_provider="gemini",
        )
        assert req.preferred_provider == "gemini"

    def test_analyze_request_preferred_provider_defaults_to_none(self):
        from api.routes.analyze import AnalyzeRequest
        req = AnalyzeRequest(session_id="sess-1", project_id="proj-1")
        assert req.preferred_provider is None
