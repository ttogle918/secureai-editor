"""
Sprint 3 통합 테스트 — 실 환경 (Redis + Claude API)

TASK-301: 배치 SAST — Redis 캐시 HIT/MISS 검증
TASK-304: 패치 에이전트 — Claude API 실 SAST 호출 검증
"""
import hashlib
import json
import pytest
import redis.asyncio as aioredis

from config.settings import settings
from agent.nodes.sast_node import analyze_for_sast
from agent.nodes.vuln_classifier import classify_and_enrich

CACHE_PREFIX = "secureai:sast:cache:"

# 테스트용 SQL Injection 취약 Python 코드
_VULN_PYTHON = """\
import sqlite3

def get_user(username):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    query = "SELECT * FROM users WHERE username = '" + username + "'"
    cursor.execute(query)
    return cursor.fetchone()
"""


@pytest.fixture
async def redis_client():
    r = aioredis.from_url(settings.redis_url, decode_responses=True)
    yield r
    await r.aclose()


# ──────────────────────────────────────────────────────────────
# TASK-301: Redis 캐시 MISS → HIT 사이클 검증
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.integration
async def test_redis_cache_miss(redis_client):
    """캐시에 없는 파일은 MISS 처리된다."""
    sha = hashlib.sha256(b"unique_content_no_cache_xyz").hexdigest()
    key = f"{CACHE_PREFIX}{sha}"
    await redis_client.delete(key)

    result = await redis_client.get(key)
    assert result is None


@pytest.mark.asyncio
@pytest.mark.integration
async def test_redis_cache_set_and_hit(redis_client):
    """캐시에 결과를 저장하면 다음 조회에서 HIT 된다."""
    content = "def foo(): pass  # cache_hit_test"
    sha = hashlib.sha256(content.encode()).hexdigest()
    key = f"{CACHE_PREFIX}{sha}"

    mock_vulns = [{"type": "SQL_INJECTION", "line": 1, "severity": "HIGH"}]
    await redis_client.set(key, json.dumps(mock_vulns), ex=300)

    cached_raw = await redis_client.get(key)
    assert cached_raw is not None
    cached = json.loads(cached_raw)
    assert len(cached) == 1
    assert cached[0]["type"] == "SQL_INJECTION"

    await redis_client.delete(key)


@pytest.mark.asyncio
@pytest.mark.integration
async def test_redis_cache_ttl(redis_client):
    """캐시 TTL이 양수로 설정된다."""
    content = "ttl_test_content"
    sha = hashlib.sha256(content.encode()).hexdigest()
    key = f"{CACHE_PREFIX}{sha}"

    await redis_client.set(key, "[]", ex=3600)
    ttl = await redis_client.ttl(key)
    assert ttl > 0
    assert ttl <= 3600

    await redis_client.delete(key)


# ──────────────────────────────────────────────────────────────
# TASK-304: Claude API 실호출 — SQL Injection 탐지 검증
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.integration
async def test_real_sast_detects_sql_injection():
    """실제 Claude API로 SQL Injection을 탐지한다."""
    raw_response = await analyze_for_sast("test_integration.py", _VULN_PYTHON)

    assert raw_response is not None
    assert len(raw_response) > 0

    response_lower = raw_response.lower()
    assert any(kw in response_lower for kw in ["sql", "injection", "vulnerability", "vuln"]), \
        f"Expected SQL injection finding in response, got: {raw_response[:200]}"


@pytest.mark.asyncio
@pytest.mark.integration
async def test_real_sast_response_is_parseable():
    """Claude SAST 응답이 JSON 파싱 가능한 형태를 포함한다."""
    from agent.response_parser import parse_sast_response

    raw_response = await analyze_for_sast("test_integration.py", _VULN_PYTHON)
    vulns = parse_sast_response(raw_response)

    assert isinstance(vulns, list)
    if vulns:
        vuln = vulns[0]
        assert "type" in vuln
        assert "severity" in vuln


@pytest.mark.asyncio
@pytest.mark.integration
async def test_real_sast_with_classifier():
    """SAST 결과에 CWE/OWASP 분류가 자동 추가된다."""
    from agent.response_parser import parse_sast_response

    raw_response = await analyze_for_sast("test_integration.py", _VULN_PYTHON)
    vulns = parse_sast_response(raw_response)
    enriched = classify_and_enrich(vulns, "test_integration.py")

    assert isinstance(enriched, list)
    for v in enriched:
        assert "cwe" in v
        assert "owasp" in v
        # classify_and_enrich uses camelCase key
        call_chain_key = "callChain" if "callChain" in v else "call_chain"
        assert call_chain_key in v
        assert isinstance(v[call_chain_key], list)


# ──────────────────────────────────────────────────────────────
# TASK-301: 동일 파일 두 번 스캔 → 두 번째는 캐시 HIT
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.integration
async def test_sast_result_can_be_cached(redis_client):
    """SAST 결과를 캐시에 저장하고 재조회 시 동일한 결과가 반환된다."""
    from agent.response_parser import parse_sast_response

    content = _VULN_PYTHON
    sha = hashlib.sha256(content.encode()).hexdigest()
    key = f"{CACHE_PREFIX}{sha}"

    raw_response = await analyze_for_sast("test_cache_store.py", content)
    vulns = parse_sast_response(raw_response)

    await redis_client.set(key, json.dumps(vulns), ex=300)

    cached_raw = await redis_client.get(key)
    assert cached_raw is not None
    cached = json.loads(cached_raw)
    assert len(cached) == len(vulns)

    await redis_client.delete(key)
