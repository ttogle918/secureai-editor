"""
docs/security/ 하위 MD 파일을 security_guidelines 테이블에 동기화하고
fastembed로 임베딩을 생성한다.

실행: python scripts/sync_guidelines.py [--docs-path ../../docs/security]

전제 조건:
- PostgreSQL에 pgvector 익스텐션 설치 필요 (V028 마이그레이션 적용 후)
- DB 연결 정보: POSTGRES_URL 환경변수 또는 .env 파일
"""
import argparse
import asyncio
import json
import logging
import re
import sys
from pathlib import Path

import psycopg

# standalone 실행 시 ai_engine 패키지 루트를 sys.path에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.settings import settings
from infrastructure.embedding_service import embed_text, embed_texts

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

BATCH_SIZE = 10
SKIP_FILES = {"D_MASTER.md", "D_종합_마스터_지침서.md", "INJECTION_STRATEGY.md"}

_DEFAULT_STACK = "common"
# STACK_<name>.md 파일명에서 target_stack을 동적 도출한다.
# 예: STACK_python_django → python_django, STACK_common_js → common_js
_STACK_FILE_RE = re.compile(r"^STACK_(.+)$", re.IGNORECASE)


def _infer_target_stack(file_path: Path) -> str:
    """파일에서 target_stack을 추론한다.

    - ``STACK_<name>.md`` → target_stack = ``<name>`` (파일명에서 동적 도출).
      새 스택 문서를 추가해도 코드 수정 없이 읽기측(sast_node._detect_stacks)과
      자동으로 정합된다. 예: STACK_python_django.md → "python_django",
      STACK_common_js.md → "common_js".
    - 그 외(attacks/B*, A/C/E 등 범용 기준 문서) → "common".
      load_guidelines가 항상 "common"을 포함하므로 모든 파일에 적용된다.
    - 추론 실패 시 "common" 폴백 — 적재 누락(지침 미주입)보다 과적재가 안전하다.
    """
    try:
        match = _STACK_FILE_RE.match(file_path.stem)
        if match:
            name = match.group(1).strip().lower()
            return name or _DEFAULT_STACK
        return _DEFAULT_STACK
    except Exception as exc:  # noqa: BLE001 — 추론 실패는 폴백으로 흡수
        logger.warning(
            "[sync] target_stack 추론 실패 file=%s error=%s → '%s' 폴백",
            file_path, exc, _DEFAULT_STACK,
        )
        return _DEFAULT_STACK


def parse_md_file(file_path: Path, docs_root: Path) -> dict:
    """마크다운 파일을 파싱하여 지침 데이터를 반환한다."""
    content = file_path.read_text(encoding="utf-8")

    title_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else file_path.stem

    # category: 파일 경로에서 docs_root 기준 첫 번째 디렉토리 이름
    try:
        relative = file_path.relative_to(docs_root)
        category = relative.parts[0] if len(relative.parts) > 1 else "general"
    except ValueError:
        category = "general"

    sub_category = file_path.stem
    target_stack = _infer_target_stack(file_path)

    metadata: dict = {}
    cwe_match = re.search(r"CWE-\d+", content)
    if cwe_match:
        metadata["cwe_id"] = cwe_match.group(0)

    owasp_match = re.search(r"A\d+:\d+", content)
    if owasp_match:
        metadata["owasp_id"] = owasp_match.group(0)

    try:
        source_path = str(file_path.relative_to(docs_root))
    except ValueError:
        source_path = str(file_path)

    return {
        "title": title,
        "content": content,
        "category": category,
        "sub_category": sub_category,
        "target_stack": target_stack,
        "metadata": json.dumps(metadata),
        "source_path": source_path,
    }


def _upsert_guidelines(conn: psycopg.Connection, guidelines: list[dict]) -> None:
    """가이드라인 목록을 DB에 Upsert한다."""
    with conn.cursor() as cur:
        for g in guidelines:
            cur.execute(
                """
                INSERT INTO security_guidelines
                    (category, sub_category, target_stack, title, content, metadata, source_path, updated_at)
                VALUES
                    (%(category)s, %(sub_category)s, %(target_stack)s, %(title)s,
                     %(content)s, %(metadata)s, %(source_path)s, NOW())
                ON CONFLICT (title, target_stack)
                DO UPDATE SET
                    content      = EXCLUDED.content,
                    category     = EXCLUDED.category,
                    sub_category = EXCLUDED.sub_category,
                    metadata     = EXCLUDED.metadata,
                    source_path  = EXCLUDED.source_path,
                    updated_at   = NOW()
                """,
                g,
            )
    conn.commit()


def _fetch_rows_without_embedding(conn: psycopg.Connection) -> list[tuple[str, str]]:
    """embedding 컬럼이 NULL인 (id, title||content) 행을 반환한다."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id::text, title || ' ' || content
            FROM security_guidelines
            WHERE embedding IS NULL
            """
        )
        return cur.fetchall()


def _update_embeddings(
    conn: psycopg.Connection,
    id_text_pairs: list[tuple[str, str]],
) -> int:
    """배치로 임베딩을 생성하고 DB를 업데이트한다. 성공 건수를 반환한다."""
    updated = 0
    ids = [row[0] for row in id_text_pairs]
    texts = [row[1] for row in id_text_pairs]

    embeddings = embed_texts(texts)

    with conn.cursor() as cur:
        for row_id, embedding in zip(ids, embeddings):
            vector_str = f"[{','.join(str(v) for v in embedding)}]"
            cur.execute(
                "UPDATE security_guidelines SET embedding = %s::vector WHERE id = %s::uuid",
                (vector_str, row_id),
            )
            updated += 1
    conn.commit()
    return updated


def sync(docs_path: Path) -> None:
    """MD 파일 동기화 + 임베딩 생성을 실행한다."""
    if not docs_path.exists():
        logger.error("[sync] docs-path not found: %s", docs_path)
        sys.exit(1)

    logger.info("[sync] scanning docs_path=%s", docs_path)

    guidelines = []
    for md_file in docs_path.glob("**/*.md"):
        if md_file.name in SKIP_FILES:
            logger.debug("[sync] skipping %s", md_file.name)
            continue
        try:
            data = parse_md_file(md_file, docs_path)
            guidelines.append(data)
            logger.debug("[sync] parsed %s", md_file.name)
        except Exception as exc:
            logger.warning("[sync] parse failed file=%s error=%s", md_file.name, exc)

    if not guidelines:
        logger.warning("[sync] no guidelines found — nothing to sync")
        return

    logger.info("[sync] upserting %d guidelines", len(guidelines))

    db_url = settings.postgres_url
    # 로컬 실행 시 Docker 내부 호스트명 'postgres'를 'localhost'로 교체
    if "@postgres:" in db_url and "localhost" not in db_url:
        db_url = db_url.replace("@postgres:", "@localhost:")

    try:
        with psycopg.connect(db_url) as conn:
            _upsert_guidelines(conn, guidelines)
            logger.info("[sync] upsert complete count=%d", len(guidelines))

            # 임베딩이 없는 행을 배치로 처리
            rows_without = _fetch_rows_without_embedding(conn)
            if not rows_without:
                logger.info("[sync] all rows already have embeddings")
                return

            logger.info("[sync] generating embeddings for %d rows", len(rows_without))
            total_updated = 0

            for batch_start in range(0, len(rows_without), BATCH_SIZE):
                batch = rows_without[batch_start : batch_start + BATCH_SIZE]
                try:
                    updated = _update_embeddings(conn, batch)
                    total_updated += updated
                    logger.info(
                        "[sync] embedding batch done offset=%d updated=%d",
                        batch_start, updated,
                    )
                except Exception as exc:
                    logger.warning(
                        "[sync] embedding batch failed offset=%d error=%s (skipping)",
                        batch_start, exc,
                    )

            logger.info("[sync] embedding generation complete total_updated=%d", total_updated)

    except Exception as exc:
        logger.error("[sync] DB connection failed error=%s", exc)
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync MD guidelines to DB with embeddings")
    parser.add_argument(
        "--docs-path",
        type=Path,
        default=Path(__file__).parent.parent.parent.parent / "docs" / "security",
        help="docs/security 디렉토리 경로 (기본값: ../../docs/security)",
    )
    args = parser.parse_args()
    sync(args.docs_path)


if __name__ == "__main__":
    main()
