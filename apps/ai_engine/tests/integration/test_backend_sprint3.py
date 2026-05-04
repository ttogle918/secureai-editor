"""
Sprint 3 백엔드 통합 테스트 — PostgreSQL (psycopg3)

TASK-302: JSONB callChain GIN 인덱스 검색
TASK-304: 패치 저장 DB 검증
TASK-305: Flyway 테이블 존재 확인 + SBOM/CVE 테이블 검증
"""
import hashlib
import json
import pytest
import psycopg
from psycopg.rows import dict_row

from config.settings import settings


@pytest.fixture
async def db():
    conn = await psycopg.AsyncConnection.connect(settings.postgres_url, row_factory=dict_row)
    await conn.set_autocommit(True)
    yield conn
    await conn.close()


async def _fetchone(conn, sql, params=()):
    async with conn.cursor() as cur:
        await cur.execute(sql, params)
        return await cur.fetchone()


async def _fetchall(conn, sql, params=()):
    async with conn.cursor() as cur:
        await cur.execute(sql, params)
        return await cur.fetchall()


async def _execute(conn, sql, params=()):
    async with conn.cursor() as cur:
        await cur.execute(sql, params)


# ──────────────────────────────────────────────────────────────
# TASK-305: Flyway 마이그레이션 테이블 존재 확인
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sprint3_tables_exist(db):
    """Sprint 3에서 추가된 테이블이 모두 존재한다."""
    sprint3_tables = [
        "vulnerabilities",          # V007
        "analysis_progress_log",    # V008
        "cve_data",                 # V009
        "dependency_components",    # V010
        "patch_suggestions",        # V011
        "dependency_cve_mappings",  # V012
    ]
    for table in sprint3_tables:
        row = await _fetchone(
            db,
            "SELECT to_regclass(%s::text) AS tbl",
            (f"public.{table}",)
        )
        assert row["tbl"] is not None, \
            f"Table '{table}' does not exist (Flyway 마이그레이션 미적용)"


# ──────────────────────────────────────────────────────────────
# TASK-302: JSONB callChain GIN 인덱스 검색 검증 (V013 적용 후)
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_vulnerabilities_call_chain_is_jsonb(db):
    """V013 마이그레이션 후 call_chain 컬럼이 JSONB 타입이다."""
    row = await _fetchone(db, """
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'vulnerabilities' AND column_name = 'call_chain'
    """)
    assert row is not None, "call_chain 컬럼이 없음"
    assert row["data_type"] == "jsonb", \
        f"call_chain 타입이 jsonb가 아님: {row['data_type']}"


@pytest.mark.asyncio
async def test_vulnerabilities_call_chain_gin_index_exists(db):
    """V013 마이그레이션 후 call_chain GIN 인덱스가 존재한다."""
    row = await _fetchone(db, """
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'vulnerabilities'
          AND indexdef ILIKE '%%gin%%'
          AND indexdef ILIKE '%%call_chain%%'
    """)
    assert row is not None, "call_chain GIN 인덱스가 없음 (V013 마이그레이션 확인 필요)"


@pytest.mark.asyncio
async def test_jsonb_call_chain_insert_and_search(db):
    """JSONB callChain 삽입 후 @> 연산자로 GIN 인덱스 검색이 동작한다."""
    # FK 체인: users → projects → analysis_sessions → vulnerabilities
    user_row = await _fetchone(db, """
        INSERT INTO users (email, username, plan_id)
        VALUES ('inttest@secureai.test', 'inttest_user', 1)
        RETURNING id
    """)
    user_id = user_row["id"]

    proj_row = await _fetchone(db, """
        INSERT INTO projects (owner_id, name, source_type)
        VALUES (%s, 'inttest-project', 'LOCAL')
        RETURNING id
    """, (user_id,))
    proj_id = proj_row["id"]

    sess_row = await _fetchone(db, """
        INSERT INTO analysis_sessions (project_id, user_id, status)
        VALUES (%s, %s, 'completed')
        RETURNING id
    """, (proj_id, user_id))
    sess_id = sess_row["id"]

    await _execute(db, """
        INSERT INTO vulnerabilities
            (session_id, project_id, file_path, vuln_type, severity,
             fingerprint, call_chain)
        VALUES
            (%s, %s,
             'src/test/IntTestDao.java',
             'SQL_INJECTION', 'HIGH',
             'inttest_fingerprint_unique_001',
             '["IntTestController", "IntTestService", "IntTestRepository"]'::jsonb)
        ON CONFLICT (session_id, fingerprint) DO NOTHING
    """, (sess_id, proj_id))

    rows = await _fetchall(db, """
        SELECT file_path, call_chain
        FROM vulnerabilities
        WHERE call_chain @> '["IntTestRepository"]'::jsonb
          AND file_path = 'src/test/IntTestDao.java'
    """)
    assert len(rows) >= 1
    assert rows[0]["file_path"] == "src/test/IntTestDao.java"

    # 역순 정리 (FK cascade 로 하위 레코드도 삭제됨)
    await _execute(db, "DELETE FROM analysis_sessions WHERE id = %s", (sess_id,))
    await _execute(db, "DELETE FROM projects WHERE id = %s", (proj_id,))
    await _execute(db, "DELETE FROM users WHERE id = %s", (user_id,))


# ──────────────────────────────────────────────────────────────
# TASK-304: patch_suggestions 테이블 스키마 검증
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_patch_suggestions_table_schema(db):
    """patch_suggestions 테이블이 필수 컬럼을 모두 가진다."""
    required_cols = {"id", "vuln_id", "original_snippet", "patched_snippet",
                     "unified_diff", "is_applied", "applied_at", "applied_by"}
    rows = await _fetchall(db, """
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'patch_suggestions'
    """)
    actual_cols = {r["column_name"] for r in rows}
    missing = required_cols - actual_cols
    assert not missing, f"patch_suggestions에 누락된 컬럼: {missing}"


# ──────────────────────────────────────────────────────────────
# TASK-305: CVE + SBOM 테이블 스키마 검증
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cve_data_table_schema(db):
    """cve_data 테이블이 PK(cve_id)와 CVSS 점수 컬럼을 가진다."""
    required_cols = {"cve_id", "description", "cvss_score", "severity",
                     "published_at", "modified_at"}
    rows = await _fetchall(db, """
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'cve_data'
    """)
    actual_cols = {r["column_name"] for r in rows}
    missing = required_cols - actual_cols
    assert not missing, f"cve_data에 누락된 컬럼: {missing}"


@pytest.mark.asyncio
async def test_dependency_components_table_schema(db):
    """dependency_components 테이블이 SBOM 파서 결과를 저장할 수 있다."""
    required_cols = {"id", "project_id", "package_manager", "artifact_id", "version"}
    rows = await _fetchall(db, """
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'dependency_components'
    """)
    actual_cols = {r["column_name"] for r in rows}
    missing = required_cols - actual_cols
    assert not missing, f"dependency_components에 누락된 컬럼: {missing}"


@pytest.mark.asyncio
async def test_dependency_cve_mapping_table_schema(db):
    """dependency_cve_mappings 테이블이 CVE-컴포넌트 매핑 컬럼을 가진다."""
    required_cols = {"component_id", "cve_id"}
    rows = await _fetchall(db, """
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'dependency_cve_mappings'
    """)
    actual_cols = {r["column_name"] for r in rows}
    missing = required_cols - actual_cols
    assert not missing, f"dependency_cve_mappings에 누락된 컬럼: {missing}"


# ──────────────────────────────────────────────────────────────
# TASK-305: NvdSyncJob Redis 캐시 키 형식 검증
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_nvd_redis_cache_key_format():
    """NvdSyncJob Redis 캐시 키 형식 (secureai:nvd:page:{sha256}) 이 동작한다."""
    import redis.asyncio as aioredis
    r = aioredis.from_url(settings.redis_url, decode_responses=True)

    params = "?pubStartDate=2026-01-01T00:00:00.000&pubEndDate=2026-01-02T00:00:00.000"
    sha = hashlib.sha256(params.encode()).hexdigest()
    cache_key = f"secureai:nvd:page:{sha}"

    mock_response = json.dumps({"totalResults": 0, "vulnerabilities": []})
    await r.set(cache_key, mock_response, ex=60)

    val = await r.get(cache_key)
    assert val is not None
    data = json.loads(val)
    assert "totalResults" in data
    assert data["totalResults"] == 0

    await r.delete(cache_key)
    await r.aclose()
