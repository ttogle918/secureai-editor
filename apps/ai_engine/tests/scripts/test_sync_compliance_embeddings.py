"""
sync_compliance_embeddings.py 단위 테스트.

실 DB / 실 임베딩 모델 없이 psycopg.connect 와 embed_texts_multilingual 을 mock 으로 대체.
embed_texts_multilingual 은 스크립트에서 모듈 레벨 임포트되므로
scripts.sync_compliance_embeddings.embed_texts_multilingual 패치로 충분하다.

검증 항목:
- embedding IS NULL 행만 처리(SELECT 쿼리 패턴 검증)
- 정상 경로: 배치 단위 UPDATE 호출 수 검증
- 첫 배치 embed 실패 시 skip, 두 번째 배치는 성공
- 모든 행에 이미 임베딩이 있으면 embed 와 UPDATE 호출 없음
- BATCH_SIZE 를 초과하면 여러 배치로 나뉨
"""
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# ai_engine 패키지 루트를 sys.path 에 추가 (scripts 패키지 임포트 가능하게)
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# patch("scripts.sync_compliance_embeddings.*") 가 동작하려면
# conftest.py 가 fastembed stub 을 먼저 등록한 후 서브모듈을 로드해야 한다.
# conftest.py 는 pytest 가 이 파일을 수집하기 전에 실행되므로 안전하다.
import scripts.sync_compliance_embeddings  # noqa: F401 — 패치 대상 모듈 사전 로드


# ── psycopg 커넥션 mock 헬퍼 ───────────────────────────────────────────────────

def _make_psycopg_mock(fetchall_rows: list[tuple]):
    """sync psycopg.connect(...) as conn 을 대체하는 mock 을 반환한다.

    psycopg 동기 드라이버이므로 일반 MagicMock 을 사용한다.
    커서는 MagicMock 기본 컨텍스트 매니저로 처리된다.
    """
    cur_mock = MagicMock()
    cur_mock.fetchall.return_value = fetchall_rows
    # with conn.cursor() as cur: 패턴
    cur_mock.__enter__ = MagicMock(return_value=cur_mock)
    cur_mock.__exit__ = MagicMock(return_value=False)

    conn_mock = MagicMock()
    conn_mock.cursor.return_value = cur_mock
    # with psycopg.connect(...) as conn: 패턴
    conn_mock.__enter__ = MagicMock(return_value=conn_mock)
    conn_mock.__exit__ = MagicMock(return_value=False)

    return conn_mock, cur_mock


def _execute_calls_matching(cur_mock, sql_fragment: str) -> list:
    """cur_mock.execute 호출 중 sql_fragment 를 포함하는 것만 필터링한다."""
    return [
        c for c in cur_mock.execute.call_args_list
        if sql_fragment in str(c)
    ]


# ── 테스트 ────────────────────────────────────────────────────────────────────

def test_sync_updates_only_null_embedding_rows():
    """SELECT 쿼리가 'embedding IS NULL' 조건을 포함하고 UPDATE 가 1회 호출된다."""
    rows = [("uuid-1", "제목 본문 내용")]
    conn_mock, cur_mock = _make_psycopg_mock(rows)
    fake_embeddings = [[0.1] * 1024]

    with (
        patch("psycopg.connect", return_value=conn_mock),
        patch(
            "scripts.sync_compliance_embeddings.embed_texts_multilingual",
            return_value=fake_embeddings,
        ),
        patch("scripts.sync_compliance_embeddings.settings"),
    ):
        from scripts import sync_compliance_embeddings
        # 모듈 재로드 방지: sync() 를 직접 호출
        sync_compliance_embeddings.sync()

    # SELECT 에 embedding IS NULL 포함 여부
    select_calls = _execute_calls_matching(cur_mock, "embedding IS NULL")
    assert len(select_calls) >= 1

    # UPDATE 가 1회 호출
    update_calls = _execute_calls_matching(cur_mock, "UPDATE compliance_feed_items")
    assert len(update_calls) == 1

    # commit 호출 여부
    conn_mock.commit.assert_called()


def test_sync_skips_batch_on_embedding_error():
    """embed_texts_multilingual 첫 호출 실패 시 해당 배치 skip, 다음 배치는 처리된다."""
    # BATCH_SIZE=5 기준 6행 → 2배치
    rows = [(f"uuid-{i}", f"텍스트 {i}") for i in range(6)]
    conn_mock, cur_mock = _make_psycopg_mock(rows)
    call_count = [0]

    def _failing_then_ok(texts):
        call_count[0] += 1
        if call_count[0] == 1:
            raise RuntimeError("GPU OOM")
        return [[0.2] * 1024 for _ in texts]

    with (
        patch("psycopg.connect", return_value=conn_mock),
        patch(
            "scripts.sync_compliance_embeddings.embed_texts_multilingual",
            side_effect=_failing_then_ok,
        ),
        patch("scripts.sync_compliance_embeddings.settings"),
    ):
        from scripts import sync_compliance_embeddings

        sync_compliance_embeddings.sync()  # 예외 전파 없이 완료해야 함

    # 첫 배치 skip, 두 번째 배치 1행(6-5=1) UPDATE
    update_calls = _execute_calls_matching(cur_mock, "UPDATE compliance_feed_items")
    assert len(update_calls) == 1


def test_sync_does_nothing_when_all_embedded():
    """모든 행에 이미 임베딩이 있으면(SELECT 결과 0건) embed 와 UPDATE 가 호출되지 않는다."""
    conn_mock, cur_mock = _make_psycopg_mock([])  # 빈 결과 = 모두 임베딩됨

    with (
        patch("psycopg.connect", return_value=conn_mock),
        patch(
            "scripts.sync_compliance_embeddings.embed_texts_multilingual",
        ) as mock_embed,
        patch("scripts.sync_compliance_embeddings.settings"),
    ):
        from scripts import sync_compliance_embeddings

        sync_compliance_embeddings.sync()

    mock_embed.assert_not_called()
    update_calls = _execute_calls_matching(cur_mock, "UPDATE")
    assert len(update_calls) == 0


def test_sync_processes_multiple_batches():
    """BATCH_SIZE 초과 행은 여러 배치로 나뉘어 모두 UPDATE 된다(11행 → 3배치)."""
    rows = [(f"uuid-{i}", f"텍스트 {i}") for i in range(11)]
    conn_mock, cur_mock = _make_psycopg_mock(rows)

    with (
        patch("psycopg.connect", return_value=conn_mock),
        patch(
            "scripts.sync_compliance_embeddings.embed_texts_multilingual",
            side_effect=lambda texts: [[0.3] * 1024 for _ in texts],
        ),
        patch("scripts.sync_compliance_embeddings.settings"),
    ):
        from scripts import sync_compliance_embeddings

        sync_compliance_embeddings.sync()

    update_calls = _execute_calls_matching(cur_mock, "UPDATE compliance_feed_items")
    assert len(update_calls) == 11
