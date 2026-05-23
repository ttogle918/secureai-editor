"""
security_guidelines 테이블에서 stack별 가이드라인을 조회한다.

- 프로세스 내 캐시 사용 — 동일 stack은 DB를 한 번만 조회
- DB 연결 실패 시 빈 문자열 반환, 분석은 계속 진행
- common 가이드라인은 항상 포함
- search_guidelines_by_vuln_type: pgvector 코사인 유사도 기반 의미론적 검색
  - pgvector 미설치 또는 embedding 컬럼 없을 시 load_guidelines("common")으로 폴백
"""
import asyncio
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


async def search_guidelines_by_vuln_type(vuln_type: str, top_k: int = 5) -> str:
    """
    취약점 유형에 맞는 지침을 pgvector 코사인 유사도로 검색한다.

    vuln_type 예: SQL_INJECTION, XSS, SSRF, IDOR, AUTH_BYPASS

    pgvector 미설치 또는 embedding 컬럼 없을 시 기존 필터 방식(load_guidelines)으로 폴백.
    embed_text()는 동기 함수이므로 ThreadPoolExecutor를 통해 async 컨텍스트에서 호출한다.
    """
    from infrastructure.embedding_service import embed_text  # 지연 임포트 (모델 로드 시점 제어)

    query = f"DAST exploit for {vuln_type.replace('_', ' ').lower()} vulnerability"

    try:
        # embed_text는 동기 함수 — 이벤트 루프 차단을 막기 위해 executor로 실행
        loop = asyncio.get_event_loop()
        embedding: list[float] = await loop.run_in_executor(None, embed_text, query)

        # pgvector 형식 문자열 변환
        vector_str = f"[{','.join(str(v) for v in embedding)}]"

        sql = """
            SELECT title, content
            FROM security_guidelines
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> %s::vector
            LIMIT %s
        """

        async with await psycopg.AsyncConnection.connect(settings.postgres_url) as conn:
            async with conn.cursor() as cur:
                await cur.execute(sql, (vector_str, top_k))
                rows = await cur.fetchall()

        if not rows:
            logger.warning(
                "[guidelines] vector search returned 0 rows vuln_type=%s, falling back",
                vuln_type,
            )
            return await load_guidelines("common")

        text = "\n\n---\n\n".join(f"## {title}\n{content}" for title, content in rows)
        logger.info(
            "[guidelines] vector search vuln_type=%s rows=%d chars=%d",
            vuln_type, len(rows), len(text),
        )
        return text

    except Exception as exc:
        logger.warning(
            "[guidelines] vector search failed vuln_type=%s error=%s, falling back to load_guidelines",
            vuln_type, exc,
        )
        return await load_guidelines("common")
