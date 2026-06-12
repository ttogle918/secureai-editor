"""
COST-3: 세션 종료 시 토큰 사용량 콜백 단위 테스트.

검증 항목:
- report_token_usage 함수의 HTTP payload 구조
- patch_node의 _report_session_token_usage 함수:
  - provider/model 결정 (preferred_provider 우선 → scan_mode fallback)
  - user_id 없으면 경고 후 생략
  - backend 실패 시 예외 전파 없음
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ── report_token_usage 함수 테스트 ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_report_token_usage_sends_correct_payload():
    """report_token_usage 가 올바른 payload 로 POST 를 전송한다."""
    from infrastructure.backend_api_client import report_token_usage

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()

    with patch("infrastructure.backend_api_client._client") as mock_client:
        mock_client.post = AsyncMock(return_value=mock_response)

        await report_token_usage(
            session_id="sess-001",
            user_id="user-001",
            project_id="proj-001",
            provider="anthropic",
            model="claude-haiku-4-5",
            input_tokens=1000,
            output_tokens=500,
            cache_creation=200,
            cache_read=100,
        )

    mock_client.post.assert_called_once()
    call_kwargs = mock_client.post.call_args
    url = call_kwargs[0][0] if call_kwargs[0] else call_kwargs[1].get("url") or call_kwargs[0][0]
    # URL 검증
    assert "sess-001" in url or "token-usage" in url

    payload = call_kwargs[1]["json"]
    assert payload["userId"] == "user-001"
    assert payload["projectId"] == "proj-001"
    assert payload["provider"] == "anthropic"
    assert payload["model"] == "claude-haiku-4-5"
    assert payload["inputTokens"] == 1000
    assert payload["outputTokens"] == 500
    assert payload["cacheCreation"] == 200
    assert payload["cacheRead"] == 100


@pytest.mark.asyncio
async def test_report_token_usage_swallows_exception():
    """report_token_usage 가 실패해도 예외를 전파하지 않는다."""
    from infrastructure.backend_api_client import report_token_usage

    with patch("infrastructure.backend_api_client._client") as mock_client:
        mock_client.post = AsyncMock(side_effect=Exception("connection refused"))

        # 예외 없이 완료돼야 함
        await report_token_usage(
            session_id="sess-fail",
            user_id="user-001",
            project_id="proj-001",
            provider="gemini",
            model="gemini-2.5-flash",
            input_tokens=100,
            output_tokens=50,
            cache_creation=0,
            cache_read=0,
        )


# ── _report_session_token_usage 함수 테스트 ────────────────────────────────────

@pytest.mark.asyncio
async def test_session_usage_callback_uses_preferred_provider():
    """preferred_provider 가 있으면 그 값을 provider 로 사용한다."""
    from agent.nodes.patch_node import _report_session_token_usage

    state = {
        "session_id": "sess-001",
        "user_id": "user-001",
        "project_id": "proj-001",
        "preferred_provider": "gemini",
        "preferred_model": "gemini-2.5-flash",
        "scan_mode": "AUDIT",
        "token_usage": {
            "input_tokens": 500,
            "output_tokens": 200,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 50,
        },
    }

    with patch("agent.nodes.patch_node.report_token_usage", new_callable=AsyncMock) as mock_report:
        await _report_session_token_usage(state)

    mock_report.assert_called_once_with(
        session_id="sess-001",
        user_id="user-001",
        project_id="proj-001",
        provider="gemini",
        model="gemini-2.5-flash",
        input_tokens=500,
        output_tokens=200,
        cache_creation=0,
        cache_read=50,
    )


@pytest.mark.asyncio
async def test_session_usage_callback_audit_scan_mode_fallback():
    """preferred_provider 없고 scan_mode=AUDIT 이면 audit_provider 를 사용한다."""
    from agent.nodes.patch_node import _report_session_token_usage

    state = {
        "session_id": "sess-002",
        "user_id": "user-002",
        "project_id": "proj-002",
        "preferred_provider": None,
        "preferred_model": None,
        "scan_mode": "AUDIT",
        "token_usage": {
            "input_tokens": 300,
            "output_tokens": 100,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 0,
        },
    }

    with patch("agent.nodes.patch_node.report_token_usage", new_callable=AsyncMock) as mock_report:
        with patch("agent.nodes.patch_node.settings") as mock_settings:
            mock_settings.audit_provider = "gemini"
            mock_settings.gemini_model   = "gemini-2.5-flash"
            mock_settings.pipeline_provider = "anthropic"
            mock_settings.pipeline_model    = "claude-sonnet-4-6"

            await _report_session_token_usage(state)

    called_kwargs = mock_report.call_args[1]
    assert called_kwargs["provider"] == "gemini"
    assert called_kwargs["model"] == "gemini-2.5-flash"


@pytest.mark.asyncio
async def test_session_usage_callback_pipeline_scan_mode_fallback():
    """preferred_provider 없고 scan_mode=PIPELINE 이면 pipeline_provider 를 사용한다."""
    from agent.nodes.patch_node import _report_session_token_usage

    state = {
        "session_id": "sess-003",
        "user_id": "user-003",
        "project_id": "proj-003",
        "preferred_provider": None,
        "preferred_model": None,
        "scan_mode": "PIPELINE",
        "token_usage": {"input_tokens": 1000, "output_tokens": 400,
                        "cache_creation_input_tokens": 100, "cache_read_input_tokens": 200},
    }

    with patch("agent.nodes.patch_node.report_token_usage", new_callable=AsyncMock) as mock_report:
        with patch("agent.nodes.patch_node.settings") as mock_settings:
            mock_settings.audit_provider = "gemini"
            mock_settings.gemini_model   = "gemini-2.5-flash"
            mock_settings.pipeline_provider = "anthropic"
            mock_settings.pipeline_model    = "claude-sonnet-4-6"

            await _report_session_token_usage(state)

    called_kwargs = mock_report.call_args[1]
    assert called_kwargs["provider"] == "anthropic"
    assert called_kwargs["model"] == "claude-sonnet-4-6"


@pytest.mark.asyncio
async def test_session_usage_callback_no_user_id_skips():
    """user_id 가 없으면 report_token_usage 를 호출하지 않는다."""
    from agent.nodes.patch_node import _report_session_token_usage

    state = {
        "session_id": "sess-004",
        "user_id": None,
        "project_id": "proj-004",
        "preferred_provider": "anthropic",
        "preferred_model": "claude-haiku-4-5",
        "scan_mode": "PIPELINE",
        "token_usage": {"input_tokens": 100, "output_tokens": 50,
                        "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0},
    }

    with patch("agent.nodes.patch_node.report_token_usage", new_callable=AsyncMock) as mock_report:
        await _report_session_token_usage(state)

    mock_report.assert_not_called()


@pytest.mark.asyncio
async def test_session_usage_callback_aggregates_all_token_keys():
    """state.token_usage 의 4개 키 모두 올바르게 읽어 전달된다."""
    from agent.nodes.patch_node import _report_session_token_usage

    state = {
        "session_id": "sess-005",
        "user_id": "user-005",
        "project_id": "proj-005",
        "preferred_provider": "anthropic",
        "preferred_model": "claude-sonnet-4-6",
        "scan_mode": "PIPELINE",
        "token_usage": {
            "input_tokens": 12345,
            "output_tokens": 6789,
            "cache_creation_input_tokens": 111,
            "cache_read_input_tokens": 222,
        },
    }

    with patch("agent.nodes.patch_node.report_token_usage", new_callable=AsyncMock) as mock_report:
        await _report_session_token_usage(state)

    called_kwargs = mock_report.call_args[1]
    assert called_kwargs["input_tokens"] == 12345
    assert called_kwargs["output_tokens"] == 6789
    assert called_kwargs["cache_creation"] == 111
    assert called_kwargs["cache_read"] == 222
