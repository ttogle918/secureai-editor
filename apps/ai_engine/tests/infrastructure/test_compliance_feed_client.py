"""
search_compliance_feed_by_topic 단위 테스트.

실제 임베딩 모델 / 실 DB 없이 psycopg pool 과 embed_text_multilingual 을 mock 으로 대체.
embed_text_multilingual 은 guidelines_client.py 안에서 지연 임포트되므로
패치 대상은 infrastructure.embedding_service.embed_text_multilingual (소스 모듈).

검증 항목:
- section 없을 때와 있을 때 SQL/파라미터 차이
- 인용 포맷 (title + summary + source_url + published_date, content 미포함)
- 0건 결과 시 빈 문자열 반환
- 예외 발생 시 빈 문자열 반환 (skip & log)
- None 필드(summary/source_url/date) 가 있으면 해당 줄 생략
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# patch("infrastructure.embedding_service.embed_text_multilingual") 가 동작하려면
# fastembed stub 이 sys.modules 에 등록된 후 서브모듈이 로드되어 있어야 한다.
# conftest.py 가 fastembed stub 을 먼저 등록하므로 여기서 임포트는 안전하다.
import infrastructure.embedding_service  # noqa: F401 — 패치 대상 모듈 사전 로드


# ── 픽스처 ────────────────────────────────────────────────────────────────────

def _make_pool_mock(rows: list[tuple]) -> tuple:
    """psycopg AsyncConnectionPool + cursor mock 을 반환한다."""
    cur_mock = AsyncMock()
    cur_mock.fetchall = AsyncMock(return_value=rows)

    # async with conn.cursor() as cur:
    cur_ctx = MagicMock()
    cur_ctx.__aenter__ = AsyncMock(return_value=cur_mock)
    cur_ctx.__aexit__ = AsyncMock(return_value=False)

    conn_mock = MagicMock()
    conn_mock.cursor.return_value = cur_ctx

    # async with pool.connection() as conn:
    conn_ctx = MagicMock()
    conn_ctx.__aenter__ = AsyncMock(return_value=conn_mock)
    conn_ctx.__aexit__ = AsyncMock(return_value=False)

    pool_mock = MagicMock()
    pool_mock.connection.return_value = conn_ctx

    return pool_mock, cur_mock


# ── 테스트: 정상 경로 ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_search_returns_formatted_citation_without_content():
    """검색 결과가 title/summary/source_url/date 형식으로 반환되고 content 는 제외된다."""
    rows = [
        (
            "SW 공급망 보안 강화 로드맵",
            "공급망 위협 예방 역량 강화 3대 전략 요약",
            "https://kisa.or.kr/abc",
            "2026-06-24",
        )
    ]
    pool_mock, _ = _make_pool_mock(rows)
    fake_embedding = [0.1] * 1024

    with (
        # 지연 임포트 소스 모듈을 패치
        patch(
            "infrastructure.embedding_service.embed_text_multilingual",
            return_value=fake_embedding,
        ),
        patch("infrastructure.guidelines_client.get_pool", new=AsyncMock(return_value=pool_mock)),
    ):
        from infrastructure.guidelines_client import search_compliance_feed_by_topic

        result = await search_compliance_feed_by_topic("공급망 보안")

    assert "SW 공급망 보안 강화 로드맵" in result
    assert "공급망 위협 예방 역량 강화" in result
    assert "https://kisa.or.kr/abc" in result
    assert "2026-06-24" in result
    assert result.strip() != ""


@pytest.mark.asyncio
async def test_search_with_section_passes_section_param():
    """section 인자를 지정하면 SQL 파라미터에 section 이 포함된다."""
    rows = [("KISA 권고문", "요약", "https://kisa.or.kr/", "2026-06-01")]
    pool_mock, cur_mock = _make_pool_mock(rows)
    fake_embedding = [0.5] * 1024

    with (
        patch(
            "infrastructure.embedding_service.embed_text_multilingual",
            return_value=fake_embedding,
        ),
        patch("infrastructure.guidelines_client.get_pool", new=AsyncMock(return_value=pool_mock)),
    ):
        from infrastructure.guidelines_client import search_compliance_feed_by_topic

        result = await search_compliance_feed_by_topic("보안 권고", section="GOV_RECOMMENDATION")

    # execute 호출 파라미터에 section 값이 포함됐는지 확인
    call_args = cur_mock.execute.call_args
    params = call_args[0][1]  # positional arg[1] = params tuple
    assert "GOV_RECOMMENDATION" in params
    assert result


@pytest.mark.asyncio
async def test_search_without_section_omits_section_in_params():
    """section=None 이면 SQL 파라미터에 section 이 없다."""
    rows = [("임의 항목", "요약", "https://kisa.or.kr/", "2026-06-01")]
    pool_mock, cur_mock = _make_pool_mock(rows)
    fake_embedding = [0.5] * 1024

    with (
        patch(
            "infrastructure.embedding_service.embed_text_multilingual",
            return_value=fake_embedding,
        ),
        patch("infrastructure.guidelines_client.get_pool", new=AsyncMock(return_value=pool_mock)),
    ):
        from infrastructure.guidelines_client import search_compliance_feed_by_topic

        result = await search_compliance_feed_by_topic("아무 쿼리")

    call_args = cur_mock.execute.call_args
    params = call_args[0][1]
    assert "GOV_RECOMMENDATION" not in str(params)
    assert "AGENCY_POST" not in str(params)


@pytest.mark.asyncio
async def test_search_returns_empty_string_on_zero_rows():
    """벡터 검색 결과가 0건이면 빈 문자열을 반환하고 예외를 전파하지 않는다."""
    pool_mock, _ = _make_pool_mock([])
    fake_embedding = [0.0] * 1024

    with (
        patch(
            "infrastructure.embedding_service.embed_text_multilingual",
            return_value=fake_embedding,
        ),
        patch("infrastructure.guidelines_client.get_pool", new=AsyncMock(return_value=pool_mock)),
    ):
        from infrastructure.guidelines_client import search_compliance_feed_by_topic

        result = await search_compliance_feed_by_topic("없는 주제")

    assert result == ""


@pytest.mark.asyncio
async def test_search_returns_empty_string_on_exception(caplog):
    """embed_text_multilingual 실패 시 빈 문자열을 반환하고 warning 을 로깅한다."""
    import logging

    with (
        patch(
            "infrastructure.embedding_service.embed_text_multilingual",
            side_effect=RuntimeError("model load failed"),
        ),
    ):
        from infrastructure.guidelines_client import search_compliance_feed_by_topic

        with caplog.at_level(logging.WARNING, logger="infrastructure.guidelines_client"):
            result = await search_compliance_feed_by_topic("에러 쿼리")

    assert result == ""
    assert any("compliance_feed" in r.message for r in caplog.records)


@pytest.mark.asyncio
async def test_search_omits_none_fields():
    """summary/source_url/published_date 가 None 이면 해당 줄이 생략된다."""
    rows = [("제목만 있는 항목", None, None, None)]
    pool_mock, _ = _make_pool_mock(rows)
    fake_embedding = [0.1] * 1024

    with (
        patch(
            "infrastructure.embedding_service.embed_text_multilingual",
            return_value=fake_embedding,
        ),
        patch("infrastructure.guidelines_client.get_pool", new=AsyncMock(return_value=pool_mock)),
    ):
        from infrastructure.guidelines_client import search_compliance_feed_by_topic

        result = await search_compliance_feed_by_topic("테스트")

    assert "제목만 있는 항목" in result
    assert "요약:" not in result
    assert "출처:" not in result
    assert "게시일:" not in result
