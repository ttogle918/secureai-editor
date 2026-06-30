"""
security_guidelines 테이블에서 stack별 가이드라인을 조회한다.

- 프로세스 내 캐시 사용 — 동일 stacks 조합은 DB를 한 번만 조회
- DB 연결 실패 시 빈 문자열 반환, 분석은 계속 진행
- common 가이드라인은 항상 포함 (load_guidelines 내부에서 자동 추가)
- 다중 스택 지원: stacks 인자로 str 또는 list[str] 모두 수용 (하위호환)
- search_guidelines_by_vuln_type: pgvector 코사인 유사도 기반 의미론적 검색
  - pgvector 미설치 또는 embedding 컬럼 없을 시 load_guidelines("common")으로 폴백
"""
import asyncio
import logging

import psycopg
from psycopg_pool import AsyncConnectionPool

from config.settings import settings

logger = logging.getLogger(__name__)

# 프로세스 수명 동안 유지되는 in-memory 캐시
# 캐시 키: 정렬된 stacks 집합을 "|" 로 결합한 문자열 (단일↔다중 호출 캐시 오염 방지)
_cache: dict[str, str] = {}

_ALWAYS_INCLUDED_STACK = "common"
_pool: AsyncConnectionPool | None = None
_pool_lock = asyncio.Lock()


async def get_pool() -> AsyncConnectionPool:
    """AsyncConnectionPool 싱글톤을 초기화하고 반환한다."""
    global _pool
    if _pool is None:
        async with _pool_lock:
            if _pool is None:
                _pool = AsyncConnectionPool(
                    conninfo=settings.postgres_url,
                    min_size=1,
                    max_size=5,
                    kwargs={"autocommit": True},
                    open=False,
                )
                await _pool.open()
    return _pool


async def close_pool() -> None:
    """AsyncConnectionPool 싱글톤을 닫고 해제한다."""
    global _pool
    if _pool is not None:
        await _pool.close()
        logger.info("[guidelines] Database connection pool closed.")
        _pool = None


def _normalize_stacks(stacks: "str | list[str]") -> list[str]:
    """stacks 인자를 list[str]로 정규화하고 common을 항상 포함시킨다.

    중복 제거 및 정렬은 캐시 키 생성 시에 수행한다.
    """
    if isinstance(stacks, str):
        raw = [stacks]
    else:
        raw = list(stacks)
    # common은 항상 포함
    if _ALWAYS_INCLUDED_STACK not in raw:
        raw.append(_ALWAYS_INCLUDED_STACK)
    return raw


def _make_cache_key(stacks: list[str]) -> str:
    """정렬된 고유 stacks 집합으로 캐시 키를 생성한다."""
    return "|".join(sorted(set(stacks)))


async def load_guidelines(stacks: "str | list[str]") -> str:
    """stacks + common 가이드라인을 DB에서 읽어 단일 문자열로 반환한다.

    Args:
        stacks: 단일 스택 이름(str) 또는 여러 스택 이름(list[str]).
                str을 전달하면 [str, "common"] 과 동일하게 동작한다(하위호환).
    """
    normalized = _normalize_stacks(stacks)
    cache_key = _make_cache_key(normalized)

    if cache_key in _cache:
        return _cache[cache_key]

    query_stacks = list(set(normalized))

    try:
        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT title, content
                    FROM security_guidelines
                    WHERE target_stack = ANY(%s)
                    ORDER BY target_stack, category, title
                    """,
                    (query_stacks,),
                )
                rows = await cur.fetchall()
    except Exception as exc:
        logger.warning("[guidelines] DB query failed stacks=%s error=%s", cache_key, exc)
        _cache[cache_key] = ""
        return ""

    if not rows:
        _cache[cache_key] = ""
        return ""

    text = "\n\n---\n\n".join(f"## {title}\n{content}" for title, content in rows)
    _cache[cache_key] = text
    logger.info(
        "[guidelines] loaded stacks=%s rows=%d chars=%d",
        cache_key, len(rows), len(text),
    )
    return text


def _build_compliance_sql(
    section: str | None,
    vector_str: str,
    top_k: int,
) -> tuple[str, tuple]:
    """section 유무에 따라 compliance_feed_items 벡터 검색 SQL 과 파라미터를 반환한다.

    SQL 파라미터 바인딩만 담당 — 실행은 호출자가 수행한다.
    """
    if section is not None:
        sql = """
            SELECT title, summary, source_url, published_date
            FROM compliance_feed_items
            WHERE embedding IS NOT NULL
              AND section = %s
            ORDER BY embedding <=> %s::vector
            LIMIT %s
        """
        return sql, (section, vector_str, top_k)

    sql = """
        SELECT title, summary, source_url, published_date
        FROM compliance_feed_items
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> %s::vector
        LIMIT %s
    """
    return sql, (vector_str, top_k)


def _format_compliance_results(rows: list[tuple]) -> str:
    """검색 결과 행을 인용 문자열로 변환한다.

    content 원문은 포함하지 않는다 (원문 복제금지 규칙).
    각 행은 "title / 요약 / 출처 / 게시일" 형식으로 포맷하며,
    None 필드는 해당 줄을 생략한다.
    """
    parts = []
    for title, summary, source_url, published_date in rows:
        lines = [f"- {title}"]
        if summary:
            lines.append(f"  요약: {summary}")
        if source_url:
            lines.append(f"  출처: {source_url}")
        if published_date:
            lines.append(f"  게시일: {published_date}")
        parts.append("\n".join(lines))
    return "\n\n".join(parts)


async def search_compliance_feed_by_topic(
    topic: str,
    section: str | None = None,
    top_k: int | None = None,
) -> str:
    """컴플라이언스 피드를 다국어 벡터 검색으로 조회한다.

    결과 0건 또는 실패 시 빈 문자열 반환(예외 전파 금지).
    반환 형식: title + summary + source_url + published_date (content 원문 제외).
    """
    from infrastructure.embedding_service import embed_text_multilingual  # 지연 임포트

    effective_top_k = top_k if top_k is not None else settings.embedding_multilingual_top_k

    try:
        loop = asyncio.get_running_loop()  # get_event_loop() deprecated — get_running_loop() 사용
        embedding: list[float] = await loop.run_in_executor(
            None, embed_text_multilingual, topic
        )
        vector_str = f"[{','.join(str(v) for v in embedding)}]"
        sql, params = _build_compliance_sql(section, vector_str, effective_top_k)

        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(sql, params)
                rows = await cur.fetchall()

        if not rows:
            logger.warning(
                "[compliance_feed] vector search 0 results topic=%s section=%s",
                topic, section,
            )
            return ""

        result = _format_compliance_results(rows)
        logger.info(
            "[compliance_feed] vector search topic=%s section=%s rows=%d chars=%d",
            topic, section, len(rows), len(result),
        )
        return result

    except Exception as exc:
        logger.warning(
            "[compliance_feed] search failed topic=%s error=%s (skip)",
            topic, exc,
        )
        return ""


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

        pool = await get_pool()
        async with pool.connection() as conn:
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
