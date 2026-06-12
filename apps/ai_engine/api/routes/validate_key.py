"""
POST /agent/validate-key — BYOK API 키 경량 검증 (boolean 반환).

보안:
- api_key는 로그에 절대 출력 금지.
- 응답에 키 값 포함 금지 — valid: bool 만 반환.
"""
import logging

from fastapi import APIRouter, status
from pydantic import BaseModel

from agent.llm.factory import get_provider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["agent"])


class ValidateKeyRequest(BaseModel):
    provider: str    # anthropic | gemini | openai
    api_key: str     # 로그 출력 금지


@router.post("/validate-key", status_code=status.HTTP_200_OK)
async def validate_key(req: ValidateKeyRequest) -> dict:
    """
    provider + api_key로 1회 최소 ping을 수행하여 키 유효성을 검증한다.
    응답: {"valid": bool}
    키 값은 로그·응답에 포함하지 않는다.
    """
    try:
        provider = get_provider(req.provider, api_key=req.api_key)
        # 최소 토큰으로 ping — 실제 분석 없이 인증만 확인
        _text, _usage = await _ping_provider(provider, req.provider)
        logger.info("[validate-key] provider=%s valid=True", req.provider)
        return {"valid": True}
    except ValueError as e:
        # 미지원 provider
        logger.warning("[validate-key] provider=%s unsupported: %s", req.provider, e)
        return {"valid": False}
    except Exception as e:
        # 인증 실패 (401/403) 또는 네트워크 오류
        logger.warning("[validate-key] provider=%s valid=False reason=%s", req.provider, type(e).__name__)
        return {"valid": False}


async def _ping_provider(provider, provider_name: str) -> tuple[str, dict]:
    """최소 ping 요청으로 키 인증만 확인한다."""
    from agent.llm.anthropic_provider import AnthropicProvider
    from agent.llm.openai_compat_provider import OpenAICompatProvider
    from config.settings import settings

    system_text = "You are a key validation assistant."
    user_content = "Reply with exactly: ok"

    if isinstance(provider, AnthropicProvider):
        model = settings.audit_model  # Haiku — 최저 비용
    elif isinstance(provider, OpenAICompatProvider):
        if provider_name == "gemini":
            model = settings.gemini_model
        else:
            model = settings.openai_model
    else:
        model = settings.audit_model

    return await provider.analyze(
        system_text=system_text,
        user_content=user_content,
        model=model,
        max_tokens=10,  # 최소 토큰
    )
