"""
POST /agent/translate — 보안 취약점 설명 번역

Request:
    {
        "text": "...",
        "target_lang": "ko",
        "user_api_key": "sk-ant-..." | null
    }

Response:
    { "translated_text": "..." }
"""
import logging

from anthropic import AsyncAnthropic
from fastapi import APIRouter
from pydantic import BaseModel

from config.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["translate"])

_SYSTEM_PROMPT = (
    "You are a professional technical translator specializing in cybersecurity. "
    "Translate the given security vulnerability description accurately into the target language. "
    "Preserve technical terms (CWE, OWASP, SQL Injection, XSS, etc.) as-is. "
    "Respond ONLY with the translated text — no explanation, no prefix."
)


class TranslateRequest(BaseModel):
    text: str
    target_lang: str = "ko"
    user_api_key: str | None = None


class TranslateResponse(BaseModel):
    translated_text: str


@router.post("/translate", response_model=TranslateResponse)
async def translate_endpoint(req: TranslateRequest) -> TranslateResponse:
    if not req.text.strip():
        return TranslateResponse(translated_text=req.text)

    api_key = req.user_api_key or settings.claude_api_key
    client = AsyncAnthropic(api_key=api_key)

    lang_label = "Korean" if req.target_lang == "ko" else req.target_lang

    response = await client.messages.create(
        model=settings.claude_model,
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Translate to {lang_label}:\n\n{req.text}",
            }
        ],
    )

    translated = response.content[0].text.strip()
    logger.debug("[translate] target=%s chars_in=%d chars_out=%d", req.target_lang, len(req.text), len(translated))
    return TranslateResponse(translated_text=translated)
