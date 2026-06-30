"""
compliance_feed_items 테이블의 다국어 임베딩을 생성·업데이트한다.

실행: python scripts/sync_compliance_embeddings.py

전제 조건:
- V067 마이그레이션 적용 (compliance_feed_items.embedding vector(1024) 컬럼)
- BAAI/bge-m3 모델이 fastembed 로 다운로드 가능해야 함 (~1.2GB, 최초 1회)
- DB 연결 정보: POSTGRES_URL 환경변수 또는 .env 파일
"""
import logging
import os
import sys
from pathlib import Path

import psycopg

# standalone 실행 시 ai_engine 패키지 루트를 sys.path에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.settings import settings
from infrastructure.embedding_service import embed_texts_multilingual

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

BATCH_SIZE = 5  # bge-m3 는 bge-small 보다 무겁다 — 배치 크기를 작게 유지


def _resolve_db_url() -> str:
    """로컬 실행 시 Docker 내부 호스트명 'postgres'를 'localhost'로 교체한다."""
    db_url = settings.postgres_url
    is_docker = (
        os.path.exists("/.dockerenv")
        or os.environ.get("INTERNAL_API_KEY") is not None
    )
    if not is_docker and "@postgres:" in db_url and "localhost" not in db_url:
        db_url = db_url.replace("@postgres:", "@localhost:")
    return db_url


def _fetch_rows_without_embedding(
    conn: psycopg.Connection,
) -> list[tuple[str, str]]:
    """embedding 컬럼이 NULL이고 임베딩 원천 텍스트가 있는 행을 반환한다.

    임베딩 입력: title + content(본문 우선) 또는 title + summary(폴백).
    반환: [(id::text, text), ...]
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id::text,
                   title || ' ' || COALESCE(content, summary, '')
            FROM compliance_feed_items
            WHERE embedding IS NULL
              AND (content IS NOT NULL OR summary IS NOT NULL)
            """
        )
        return cur.fetchall()


def _update_batch(
    conn: psycopg.Connection,
    batch: list[tuple[str, str]],
) -> int:
    """한 배치의 임베딩을 생성하고 DB를 업데이트한다. 성공 건수를 반환한다."""
    ids = [row[0] for row in batch]
    texts = [row[1] for row in batch]

    embeddings = embed_texts_multilingual(texts)

    updated = 0
    with conn.cursor() as cur:
        for row_id, embedding in zip(ids, embeddings):
            vector_str = f"[{','.join(str(v) for v in embedding)}]"
            cur.execute(
                "UPDATE compliance_feed_items SET embedding = %s::vector WHERE id = %s::uuid",
                (vector_str, row_id),
            )
            updated += 1
    conn.commit()
    return updated


def sync() -> None:
    """embedding IS NULL 인 행을 배치 처리해 다국어 임베딩을 채운다."""
    db_url = _resolve_db_url()
    logger.info(
        "[sync_compliance] start model=%s batch_size=%d",
        settings.embedding_multilingual_model, BATCH_SIZE,
    )

    try:
        with psycopg.connect(db_url) as conn:
            rows_without = _fetch_rows_without_embedding(conn)
            if not rows_without:
                logger.info("[sync_compliance] all rows already have embeddings — nothing to do")
                return

            logger.info("[sync_compliance] generating embeddings for %d rows", len(rows_without))
            total_updated = 0

            for batch_start in range(0, len(rows_without), BATCH_SIZE):
                batch = rows_without[batch_start : batch_start + BATCH_SIZE]
                try:
                    updated = _update_batch(conn, batch)
                    total_updated += updated
                    logger.info(
                        "[sync_compliance] batch done offset=%d updated=%d",
                        batch_start, updated,
                    )
                except Exception as exc:
                    logger.warning(
                        "[sync_compliance] batch failed offset=%d error=%s (skipping batch)",
                        batch_start, exc,
                    )

            logger.info("[sync_compliance] complete total_updated=%d", total_updated)

    except Exception as exc:
        logger.error("[sync_compliance] DB connection failed error=%s", exc)
        sys.exit(1)


def main() -> None:
    sync()


if __name__ == "__main__":
    main()
