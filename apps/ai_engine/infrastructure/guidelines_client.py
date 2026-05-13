"""
security_guidelines 테이블에서 stack별 가이드라인을 조회한다.

- 프로세스 내 캐시 사용 — 동일 stack은 DB를 한 번만 조회
- DB 연결 실패 시 빈 문자열 반환, 분석은 계속 진행
- common 가이드라인은 항상 포함
"""
import logging

import psycopg

from config.settings import settings

logger = logging.getLogger(__name__)

# 프로세스 수명 동안 유지되는 in-memory 캐시 (stack → 가이드라인 텍스트)
_cache: dict[str, str] = {}


async def load_guidelines(target_stack: str) -> str:
    """target_stack + common 가이드라인을 DB에서 읽어 단일 문자열로 반환한다."""
    if target_stack in _cache:
        return _cache[target_stack]

    stacks = list({target_stack, "common"})

    try:
        async with await psycopg.AsyncConnection.connect(settings.postgres_url) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT title, content
                    FROM security_guidelines
                    WHERE target_stack = ANY(%s)
                    ORDER BY target_stack, category, title
                    """,
                    (stacks,),
                )
                rows = await cur.fetchall()
    except Exception as exc:
        logger.warning("[guidelines] DB query failed stack=%s error=%s", target_stack, exc)
        _cache[target_stack] = ""
        return ""

    if not rows:
        _cache[target_stack] = ""
        return ""

    text = "\n\n---\n\n".join(f"## {title}\n{content}" for title, content in rows)
    _cache[target_stack] = text
    logger.info(
        "[guidelines] loaded stack=%s rows=%d chars=%d",
        target_stack, len(rows), len(text),
    )
    return text
