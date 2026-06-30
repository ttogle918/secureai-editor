"""
SAST/DAST compliance 통합 best-effort 테스트.

검증 항목:
- compliance 검색이 예외를 던져도 SAST/DAST 노드가 죽지 않고 기존 guidelines 로 진행
- compliance 검색 성공 시 guidelines 에 KISA 섹션이 병합됨
- _search_compliance 가 None 이면 조용히 skip
- 기존 load_guidelines / search_guidelines_by_vuln_type 동작 회귀 없음
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ── SAST 통합 테스트 ──────────────────────────────────────────────────────────

def _make_sast_state(**overrides):
    base = {
        "session_id": "test-session-comp-001",
        "project_id": "00000000-0000-0000-0000-000000000001",
        "files_to_scan": ["/app/src/main.py"],
        "current_file_index": 0,
        "current_file_sha256": None,
        "source_type": "local",
        "scan_mode": "PIPELINE",
        "preferred_model": None,
        "user_api_key": None,
        "sast_results": [],
        "token_usage": None,
    }
    base.update(overrides)
    return base


def _make_fake_usage():
    return {
        "input_tokens": 10, "output_tokens": 5,
        "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
    }


def _make_redis_mock() -> MagicMock:
    """Redis publish 가 await 가능하도록 AsyncMock 을 조합한 mock 을 반환한다."""
    redis_mock = MagicMock()
    redis_mock.publish = AsyncMock()
    redis_mock.get = AsyncMock(return_value=None)
    redis_mock.setex = AsyncMock()
    return redis_mock


@pytest.mark.asyncio
async def test_sast_node_continues_when_compliance_search_raises():
    """compliance 검색이 예외를 던져도 sast_node 가 정상 완료된다."""
    fake_usage = _make_fake_usage()

    async def _analyze(file_path, content, guidelines="",
                        model=None, api_key=None, provider="anthropic"):
        return ([], fake_usage)

    with (
        patch("agent.nodes.sast_node.read_file", new=AsyncMock(return_value="x = 1")),
        patch("agent.nodes.sast_node.load_guidelines", new=AsyncMock(return_value="base guide")),
        patch("agent.nodes.sast_node.should_skip_llm", return_value=False),
        patch("agent.nodes.sast_node._analyze_chunks", new=AsyncMock(side_effect=_analyze)),
        patch("agent.nodes.sast_node.log_started", new=AsyncMock()),
        patch("agent.nodes.sast_node.log_completed", new=AsyncMock()),
        patch("agent.nodes.sast_node.classify_and_enrich", return_value=[]),
        patch("agent.nodes.sast_node._get_redis", return_value=_make_redis_mock()),
        patch("agent.nodes.sast_node._fetch_prev_vuln_context", new=AsyncMock(return_value="")),
        # compliance 검색이 예외를 던짐
        patch(
            "agent.nodes.sast_node._search_compliance",
            new=AsyncMock(side_effect=RuntimeError("DB unavailable")),
        ),
        patch("agent.nodes.sast_node._ai_tokens_counter", MagicMock()),
    ):
        from agent.nodes.sast_node import sast_node

        result = await sast_node(_make_sast_state())  # 예외 전파 없이 완료되어야 함

    assert "sast_results" in result


@pytest.mark.asyncio
async def test_sast_node_merges_compliance_context_when_present():
    """compliance 검색이 성공하면 guidelines 에 KISA 섹션이 추가된다."""
    fake_usage = _make_fake_usage()
    captured_guidelines: list[str] = []

    async def _capture_analyze(file_path, content, guidelines="",
                                model=None, api_key=None, provider="anthropic"):
        captured_guidelines.append(guidelines)
        return ([], fake_usage)

    with (
        patch("agent.nodes.sast_node.read_file", new=AsyncMock(return_value="x = 1")),
        patch("agent.nodes.sast_node.load_guidelines", new=AsyncMock(return_value="base guide")),
        patch("agent.nodes.sast_node.should_skip_llm", return_value=False),
        patch("agent.nodes.sast_node._analyze_chunks", new=AsyncMock(side_effect=_capture_analyze)),
        patch("agent.nodes.sast_node.log_started", new=AsyncMock()),
        patch("agent.nodes.sast_node.log_completed", new=AsyncMock()),
        patch("agent.nodes.sast_node.classify_and_enrich", return_value=[]),
        patch("agent.nodes.sast_node._get_redis", return_value=_make_redis_mock()),
        patch("agent.nodes.sast_node._fetch_prev_vuln_context", new=AsyncMock(return_value="")),
        patch(
            "agent.nodes.sast_node._search_compliance",
            new=AsyncMock(
                return_value="KISA 공급망 보안 가이드\n요약: ...\n출처: https://kisa.or.kr/"
            ),
        ),
        patch("agent.nodes.sast_node._ai_tokens_counter", MagicMock()),
    ):
        from agent.nodes.sast_node import sast_node

        await sast_node(_make_sast_state())

    assert len(captured_guidelines) == 1
    assert "관련 KISA 컴플라이언스 가이드" in captured_guidelines[0]
    assert "KISA 공급망 보안 가이드" in captured_guidelines[0]


@pytest.mark.asyncio
async def test_sast_node_skips_compliance_when_search_func_is_none():
    """_search_compliance 가 None 이면 KISA 섹션 없이 기존 guidelines 만 사용한다."""
    fake_usage = _make_fake_usage()
    captured_guidelines: list[str] = []

    async def _capture_analyze(file_path, content, guidelines="",
                                model=None, api_key=None, provider="anthropic"):
        captured_guidelines.append(guidelines)
        return ([], fake_usage)

    with (
        patch("agent.nodes.sast_node.read_file", new=AsyncMock(return_value="x = 1")),
        patch("agent.nodes.sast_node.load_guidelines", new=AsyncMock(return_value="base guide")),
        patch("agent.nodes.sast_node.should_skip_llm", return_value=False),
        patch("agent.nodes.sast_node._analyze_chunks", new=AsyncMock(side_effect=_capture_analyze)),
        patch("agent.nodes.sast_node.log_started", new=AsyncMock()),
        patch("agent.nodes.sast_node.log_completed", new=AsyncMock()),
        patch("agent.nodes.sast_node.classify_and_enrich", return_value=[]),
        patch("agent.nodes.sast_node._get_redis", return_value=_make_redis_mock()),
        patch("agent.nodes.sast_node._fetch_prev_vuln_context", new=AsyncMock(return_value="")),
        patch("agent.nodes.sast_node._search_compliance", None),  # None = 미설치
        patch("agent.nodes.sast_node._ai_tokens_counter", MagicMock()),
    ):
        from agent.nodes.sast_node import sast_node

        await sast_node(_make_sast_state())

    assert len(captured_guidelines) == 1
    assert captured_guidelines[0] == "base guide"


# ── DAST 통합 테스트 ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dast_load_guidelines_continues_when_compliance_raises():
    """_load_dast_guidelines 는 compliance 검색 예외에도 base guidelines 를 반환한다."""
    with (
        patch(
            "agent.nodes.dast.dast_node.search_guidelines_by_vuln_type",
            new=AsyncMock(return_value="dast base guide"),
        ),
        patch(
            "agent.nodes.dast.dast_node._search_compliance",
            new=AsyncMock(side_effect=RuntimeError("compliance DB down")),
        ),
    ):
        from agent.nodes.dast.dast_node import _load_dast_guidelines

        result = await _load_dast_guidelines("SQL_INJECTION")

    assert "dast base guide" in result
    assert "KISA" not in result


@pytest.mark.asyncio
async def test_dast_load_guidelines_merges_compliance_when_present():
    """compliance 검색 성공 시 KISA 섹션이 병합된다."""
    with (
        patch(
            "agent.nodes.dast.dast_node.search_guidelines_by_vuln_type",
            new=AsyncMock(return_value="dast base guide"),
        ),
        patch(
            "agent.nodes.dast.dast_node._search_compliance",
            new=AsyncMock(
                return_value="- KISA XSS 가이드\n  요약: ...\n  출처: https://kisa.or.kr/"
            ),
        ),
    ):
        from agent.nodes.dast.dast_node import _load_dast_guidelines

        result = await _load_dast_guidelines("XSS")

    assert "dast base guide" in result
    assert "관련 KISA 컴플라이언스 가이드" in result
    assert "KISA XSS 가이드" in result


@pytest.mark.asyncio
async def test_dast_load_guidelines_skips_when_compliance_is_none():
    """_search_compliance 가 None 이면 KISA 섹션 없이 base guidelines 를 반환한다."""
    with (
        patch(
            "agent.nodes.dast.dast_node.search_guidelines_by_vuln_type",
            new=AsyncMock(return_value="dast base guide"),
        ),
        patch("agent.nodes.dast.dast_node._search_compliance", None),
    ):
        from agent.nodes.dast.dast_node import _load_dast_guidelines

        result = await _load_dast_guidelines("IDOR")

    assert result == "dast base guide"
    assert "KISA" not in result
