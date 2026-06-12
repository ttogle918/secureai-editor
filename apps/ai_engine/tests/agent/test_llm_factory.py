"""
COST-1 — LLM 팩토리·프로바이더 단위 테스트.

DoD:
  🧪 get_provider: gemini base_url 정확 / anthropic 싱글턴 / 미지원 ValueError
  🧪 analyze_for_sast(provider="anthropic") 기존 회귀 0
  🧪 OpenAI usage 정규화 정확 (prompt_tokens→input_tokens 등)
  🧪 OpenAI 빈 응답 가드
  🧪 OpenAI markdown 펜스 스트립
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ── 공통 픽스처 ──────────────────────────────────────────────────────────────

def _make_openai_usage(prompt: int = 100, completion: int = 50, total: int = 160) -> MagicMock:
    """OpenAI 응답 usage 객체를 흉내 낸다."""
    u = MagicMock()
    u.prompt_tokens = prompt
    u.completion_tokens = completion
    u.total_tokens = total
    return u


def _make_openai_response(content: str, prompt: int = 100, completion: int = 50) -> MagicMock:
    """OpenAI chat.completions.create 응답 객체를 흉내 낸다."""
    choice = MagicMock()
    choice.message.content = content
    response = MagicMock()
    response.choices = [choice]
    response.usage = _make_openai_usage(prompt, completion)
    return response


# ── factory.get_provider 테스트 ───────────────────────────────────────────────

class TestGetProvider:
    """factory.get_provider 의 프로바이더 선택·싱글턴·오류 경로를 검증한다."""

    def test_anthropic_returns_anthropic_provider(self):
        """get_provider('anthropic') 는 AnthropicProvider 를 반환한다."""
        from agent.llm.factory import get_provider
        from agent.llm.anthropic_provider import AnthropicProvider

        with patch("agent.llm.factory.settings") as mock_settings:
            mock_settings.claude_api_key = "test-key"
            provider = get_provider("anthropic")

        assert isinstance(provider, AnthropicProvider)

    def test_anthropic_platform_singleton(self):
        """BYOK 없이 두 번 호출하면 같은 인스턴스를 반환한다(싱글턴)."""
        import agent.llm.factory as fac
        # 싱글턴 초기화 보장
        fac._anthropic_singleton = None

        with patch("agent.llm.factory.settings") as mock_settings:
            mock_settings.claude_api_key = "test-key"
            p1 = fac.get_provider("anthropic")
            p2 = fac.get_provider("anthropic")

        assert p1 is p2, "플랫폼 키 anthropic 싱글턴이어야 한다"

    def test_anthropic_byok_returns_new_instance_each_time(self):
        """BYOK api_key 가 있으면 매번 새 인스턴스를 반환한다."""
        from agent.llm.factory import get_provider

        p1 = get_provider("anthropic", api_key="byok-key-1")
        p2 = get_provider("anthropic", api_key="byok-key-2")
        assert p1 is not p2

    def test_gemini_returns_openai_compat_provider(self):
        """get_provider('gemini') 는 OpenAICompatProvider 를 반환한다."""
        from agent.llm.factory import get_provider, GEMINI_BASE_URL
        from agent.llm.openai_compat_provider import OpenAICompatProvider

        with patch("agent.llm.factory.settings") as mock_settings:
            mock_settings.gemini_api_key = "gemini-test-key"
            provider = get_provider("gemini")

        assert isinstance(provider, OpenAICompatProvider)

    def test_gemini_base_url_is_correct(self):
        """GEMINI_BASE_URL 상수가 정확한 Gemini OpenAI호환 엔드포인트이다."""
        from agent.llm.factory import GEMINI_BASE_URL
        assert GEMINI_BASE_URL == "https://generativelanguage.googleapis.com/v1beta/openai/"

    def test_gemini_without_key_raises_value_error(self):
        """Gemini 키 없이 get_provider('gemini') 호출 시 ValueError 발생한다."""
        from agent.llm.factory import get_provider

        with patch("agent.llm.factory.settings") as mock_settings:
            mock_settings.gemini_api_key = ""
            with pytest.raises(ValueError, match="GEMINI_API_KEY"):
                get_provider("gemini")

    def test_openai_returns_openai_compat_provider(self):
        """get_provider('openai') 는 OpenAICompatProvider 를 반환한다."""
        from agent.llm.factory import get_provider
        from agent.llm.openai_compat_provider import OpenAICompatProvider

        with patch("agent.llm.factory.settings") as mock_settings:
            mock_settings.openai_api_key = "openai-test-key"
            provider = get_provider("openai")

        assert isinstance(provider, OpenAICompatProvider)

    def test_unsupported_provider_raises_value_error(self):
        """지원하지 않는 provider 문자열은 ValueError 를 발생시킨다."""
        from agent.llm.factory import get_provider

        with pytest.raises(ValueError, match="Unsupported provider"):
            get_provider("cohere")

    def test_gemini_byok_key_takes_precedence(self):
        """api_key 가 전달되면 settings.gemini_api_key 를 무시한다."""
        from agent.llm.factory import get_provider
        from agent.llm.openai_compat_provider import OpenAICompatProvider

        with patch("agent.llm.factory.settings") as mock_settings:
            mock_settings.gemini_api_key = ""  # 플랫폼 키 없음
            provider = get_provider("gemini", api_key="byok-gemini-key")

        assert isinstance(provider, OpenAICompatProvider)


# ── OpenAICompatProvider.analyze 테스트 ──────────────────────────────────────

class TestOpenAICompatProviderAnalyze:
    """OpenAICompatProvider.analyze 의 usage 정규화·빈응답·펜스스트립을 검증한다."""

    @pytest.mark.asyncio
    async def test_usage_normalization(self):
        """prompt_tokens/completion_tokens 가 input_tokens/output_tokens 로 정규화된다."""
        from agent.llm.openai_compat_provider import OpenAICompatProvider

        fake_response = _make_openai_response('{"vulnerabilities": []}', prompt=80, completion=40)

        provider = OpenAICompatProvider(api_key="test-key")
        provider._client = MagicMock()
        provider._client.chat.completions.create = AsyncMock(return_value=fake_response)

        _, usage = await provider.analyze("system", "user", "gemini-2.5-flash")

        assert usage["input_tokens"] == 80
        assert usage["output_tokens"] == 40
        assert usage["cache_creation_input_tokens"] == 0
        assert usage["cache_read_input_tokens"] == 0

    @pytest.mark.asyncio
    async def test_empty_response_returns_empty_json(self):
        """빈 응답("")이면 {"vulnerabilities": []} JSON을 반환한다."""
        from agent.llm.openai_compat_provider import OpenAICompatProvider

        fake_response = _make_openai_response("")

        provider = OpenAICompatProvider(api_key="test-key")
        provider._client = MagicMock()
        provider._client.chat.completions.create = AsyncMock(return_value=fake_response)

        raw, _ = await provider.analyze("system", "user", "gemini-2.5-flash")

        assert raw == '{"vulnerabilities": []}'

    @pytest.mark.asyncio
    async def test_empty_whitespace_response_returns_empty_json(self):
        """공백만 있는 응답도 빈 응답으로 처리한다."""
        from agent.llm.openai_compat_provider import OpenAICompatProvider

        fake_response = _make_openai_response("   \n  ")

        provider = OpenAICompatProvider(api_key="test-key")
        provider._client = MagicMock()
        provider._client.chat.completions.create = AsyncMock(return_value=fake_response)

        raw, _ = await provider.analyze("system", "user", "gemini-2.5-flash")

        assert raw == '{"vulnerabilities": []}'

    @pytest.mark.asyncio
    async def test_markdown_fence_stripped(self):
        """응답에 ```json ... ``` 펜스가 있으면 제거한다."""
        from agent.llm.openai_compat_provider import OpenAICompatProvider

        fenced = '```json\n{"vulnerabilities": []}\n```'
        fake_response = _make_openai_response(fenced)

        provider = OpenAICompatProvider(api_key="test-key")
        provider._client = MagicMock()
        provider._client.chat.completions.create = AsyncMock(return_value=fake_response)

        raw, _ = await provider.analyze("system", "user", "gemini-2.5-flash")

        assert raw == '{"vulnerabilities": []}'

    @pytest.mark.asyncio
    async def test_markdown_fence_without_json_tag_stripped(self):
        """``` ``` (json 태그 없는) 펜스도 제거한다."""
        from agent.llm.openai_compat_provider import OpenAICompatProvider

        fenced = '```\n{"vulnerabilities": []}\n```'
        fake_response = _make_openai_response(fenced)

        provider = OpenAICompatProvider(api_key="test-key")
        provider._client = MagicMock()
        provider._client.chat.completions.create = AsyncMock(return_value=fake_response)

        raw, _ = await provider.analyze("system", "user", "gemini-2.5-flash")

        assert raw == '{"vulnerabilities": []}'

    @pytest.mark.asyncio
    async def test_no_fence_passes_through(self):
        """펜스 없는 JSON은 원문 그대로 반환한다."""
        from agent.llm.openai_compat_provider import OpenAICompatProvider

        json_text = '{"vulnerabilities": [{"type": "XSS"}]}'
        fake_response = _make_openai_response(json_text)

        provider = OpenAICompatProvider(api_key="test-key")
        provider._client = MagicMock()
        provider._client.chat.completions.create = AsyncMock(return_value=fake_response)

        raw, _ = await provider.analyze("system", "user", "gemini-2.5-flash")

        assert raw == json_text

    @pytest.mark.asyncio
    async def test_system_message_passed_as_first_message(self):
        """system 텍스트가 messages[0] role=system 으로 전달된다."""
        from agent.llm.openai_compat_provider import OpenAICompatProvider

        fake_response = _make_openai_response('{"vulnerabilities": []}')

        provider = OpenAICompatProvider(api_key="test-key")
        provider._client = MagicMock()
        mock_create = AsyncMock(return_value=fake_response)
        provider._client.chat.completions.create = mock_create

        await provider.analyze("MY_SYSTEM_PROMPT", "MY_USER_CONTENT", "gemini-2.5-flash")

        call_kwargs = mock_create.call_args.kwargs
        messages = call_kwargs["messages"]
        assert messages[0]["role"] == "system"
        assert messages[0]["content"] == "MY_SYSTEM_PROMPT"
        assert messages[1]["role"] == "user"
        assert messages[1]["content"] == "MY_USER_CONTENT"


# ── analyze_for_sast 하위 호환성 테스트 ──────────────────────────────────────

class TestAnalyzeForSastRegression:
    """analyze_for_sast 기존 시그니처와 provider='anthropic' 기본값을 검증한다."""

    @pytest.mark.asyncio
    async def test_default_provider_is_anthropic(self):
        """provider 인자 없이 호출 시 AnthropicProvider 가 사용된다."""
        from agent.llm.anthropic_provider import AnthropicProvider

        captured_provider = []

        async def fake_analyze(system_text, user_content, model, max_tokens=4096):
            return ('{"vulnerabilities": []}', {
                "input_tokens": 10, "output_tokens": 5,
                "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
            })

        mock_llm = MagicMock(spec=AnthropicProvider)
        mock_llm.analyze = fake_analyze

        with patch("agent.claude_client.get_provider", return_value=mock_llm) as mock_get:
            from agent.claude_client import analyze_for_sast
            await analyze_for_sast("/app/test.py", "x = 1")

        mock_get.assert_called_once_with("anthropic", None)

    @pytest.mark.asyncio
    async def test_provider_keyword_only_gemini(self):
        """provider='gemini' 로 호출 시 get_provider('gemini', ...) 가 호출된다."""
        async def fake_analyze(system_text, user_content, model, max_tokens=4096):
            return ('{"vulnerabilities": []}', {
                "input_tokens": 10, "output_tokens": 5,
                "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
            })

        mock_llm = MagicMock()
        mock_llm.analyze = fake_analyze

        with patch("agent.claude_client.get_provider", return_value=mock_llm) as mock_get:
            with patch("agent.claude_client.settings") as mock_settings:
                mock_settings.gemini_model = "gemini-2.5-flash"
                mock_settings.claude_model = "claude-haiku-4-5-20251001"
                mock_settings.openai_model = "gpt-4o-mini"
                from agent.claude_client import analyze_for_sast
                await analyze_for_sast("/app/test.py", "x = 1", provider="gemini")

        mock_get.assert_called_once_with("gemini", None)

    @pytest.mark.asyncio
    async def test_api_key_passed_to_provider(self):
        """api_key 가 있으면 get_provider 에 전달된다."""
        async def fake_analyze(system_text, user_content, model, max_tokens=4096):
            return ('{"vulnerabilities": []}', {
                "input_tokens": 10, "output_tokens": 5,
                "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
            })

        mock_llm = MagicMock()
        mock_llm.analyze = fake_analyze

        with patch("agent.claude_client.get_provider", return_value=mock_llm) as mock_get:
            with patch("agent.claude_client.settings") as mock_settings:
                mock_settings.claude_model = "claude-haiku-4-5-20251001"
                mock_settings.gemini_model = "gemini-2.5-flash"
                mock_settings.openai_model = "gpt-4o-mini"
                from agent.claude_client import analyze_for_sast
                await analyze_for_sast("/app/test.py", "x = 1", api_key="byok-key")

        mock_get.assert_called_once_with("anthropic", "byok-key")


# ── LLMProvider Protocol 충족 테스트 ─────────────────────────────────────────

class TestLLMProviderProtocol:
    """AnthropicProvider 와 OpenAICompatProvider 가 LLMProvider Protocol을 충족하는지 검증한다."""

    def test_anthropic_provider_satisfies_protocol(self):
        """AnthropicProvider 는 LLMProvider Protocol 을 충족한다."""
        from agent.llm.base import LLMProvider
        from agent.llm.anthropic_provider import AnthropicProvider

        provider = AnthropicProvider(api_key="test")
        assert isinstance(provider, LLMProvider)

    def test_openai_compat_provider_satisfies_protocol(self):
        """OpenAICompatProvider 는 LLMProvider Protocol 을 충족한다."""
        from agent.llm.base import LLMProvider
        from agent.llm.openai_compat_provider import OpenAICompatProvider

        provider = OpenAICompatProvider(api_key="test", base_url="https://example.com/")
        assert isinstance(provider, LLMProvider)
