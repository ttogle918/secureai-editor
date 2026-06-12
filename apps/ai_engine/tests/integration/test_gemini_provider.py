"""COST-1 Gemini 프로바이더 라이브 통합 테스트.

실 Gemini OpenAI호환 엔드포인트를 호출한다(키 필요). GEMINI_API_KEY 없으면 전체 스킵.
단위 커버리지(usage 정규화·펜스 스트립·빈응답 가드·factory)는 tests/agent/test_llm_factory.py 참조.
여기서는 mock으로는 증명 불가한 "실제 엔드포인트 거동"만 검증한다:

  1. reasoning_effort="none" 가 수락된다(1왕복) — thinking 비활성 방식 결정 근거.
  2. 구 extra_body.thinking_config 는 거부된다 — 왜 교체했는지 회귀 고정.
  3. analyze_for_sast(provider="gemini") 가 파싱 가능한 SAST JSON을 반환한다(블로커 해소 경로).

로컬 실행: cd apps/ai_engine && python -m pytest tests/integration/test_gemini_provider.py -v
(디렉터리 conftest가 루트 .env 로드 + integration 마커 자동 적용)
"""
import json
import os

import pytest
from openai import AsyncOpenAI, BadRequestError

from agent.claude_client import analyze_for_sast
from agent.llm.factory import GEMINI_BASE_URL

# 키 없으면 이 모듈 전체 스킵 (CI 단위 잡과 무관 — integration 디렉터리는 기본 제외)
pytestmark = pytest.mark.skipif(
    not os.environ.get("GEMINI_API_KEY"),
    reason="GEMINI_API_KEY 미설정 — 라이브 Gemini 통합 테스트 스킵",
)

_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
_PROMPT = [{"role": "user", "content": "Reply with the single word: ok"}]

_VULN_SNIPPET = (
    "import sqlite3\n"
    "def get_user(uid):\n"
    "    conn = sqlite3.connect('app.db')\n"
    "    return conn.execute(\"SELECT * FROM users WHERE id = '\" + uid + \"'\").fetchall()\n"
)


def _client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=os.environ["GEMINI_API_KEY"], base_url=GEMINI_BASE_URL)


async def test_reasoning_effort_none_is_accepted():
    """reasoning_effort='none' 는 거부 없이 수락된다(thinking 비활성 채택 방식)."""
    resp = await _client().chat.completions.create(
        model=_MODEL, messages=_PROMPT, max_tokens=50, reasoning_effort="none",
    )
    assert resp.usage is not None
    assert resp.choices[0].message.content is not None


async def test_thinking_config_extra_body_is_rejected():
    """구 extra_body.thinking_config 는 400 거부된다 — reasoning_effort 로 교체한 근거 고정."""
    with pytest.raises(BadRequestError):
        await _client().chat.completions.create(
            model=_MODEL, messages=_PROMPT, max_tokens=50,
            extra_body={"thinking_config": {"thinking_budget": 0}},
        )


async def test_analyze_for_sast_gemini_returns_parseable_json():
    """analyze_for_sast(provider='gemini') 가 파싱 가능한 SAST JSON을 반환한다(크레딧 0 경로)."""
    raw, usage = await analyze_for_sast(
        file_path="sample_vuln.py", content=_VULN_SNIPPET, provider="gemini",
    )
    parsed = json.loads(raw)
    assert "vulnerabilities" in parsed
    # usage 4키 정규화 형태 유지
    assert {"input_tokens", "output_tokens",
            "cache_creation_input_tokens", "cache_read_input_tokens"} <= usage.keys()
