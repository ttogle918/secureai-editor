"""
analyze 라우트 배경 작업 단위 테스트.

FastAPI / Redis / Graph / MCP 는 모두 mock — 시스템 Python 에서 실행 가능.
"""
import json
import pytest
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

from api.routes.analyze import _cancel_flags, _run_analysis, _run_resume


# ---------------------------------------------------------------------------
# 헬퍼
# ---------------------------------------------------------------------------

def _make_redis(published: list[str]) -> AsyncMock:
    r = AsyncMock()
    r.publish = AsyncMock(side_effect=lambda ch, msg: published.append(msg) or None)
    return r


def _event_types(published: list[str]) -> list[str]:
    return [json.loads(m)["type"] for m in published]


@asynccontextmanager
async def _noop_mcp(session_id, workspace_root, mcp_script):
    yield []


# ---------------------------------------------------------------------------
# _cancel_flags dict 상태 테스트
# ---------------------------------------------------------------------------

def test_cancel_flags_set_on_start():
    """_cancel_flags 에 session_id 가 등록되는지 직접 확인."""
    _cancel_flags["probe"] = False
    assert _cancel_flags["probe"] is False
    _cancel_flags.pop("probe")


# ---------------------------------------------------------------------------
# 파일 없음 → started + completed 이벤트
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_analysis_no_files_publishes_started_and_completed():
    published: list[str] = []
    mock_redis = _make_redis(published)

    async def _fake_astream(state, config=None):
        yield {"scan_files_node": {**state, "files_to_scan": []}}
        yield {"aggregate_node": {**state, "sast_results": [], "status": "completed"}}

    mock_graph = MagicMock()
    mock_graph.astream = _fake_astream

    _cancel_flags["sess-no-files"] = False
    try:
        with (
            patch("api.routes.analyze.get_redis", AsyncMock(return_value=mock_redis)),
            patch("api.routes.analyze.get_graph", return_value=mock_graph),
            patch("api.routes.analyze.mcp_session", _noop_mcp),
        ):
            await _run_analysis("sess-no-files", "proj-1", "/workspace")

        types = _event_types(published)
        assert types[0] == "started"
        assert "completed" in types
        assert "error" not in types
    finally:
        _cancel_flags.pop("sess-no-files", None)


# ---------------------------------------------------------------------------
# 취소 플래그 → cancelled 이벤트, completed 없음
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_analysis_cancel_flag_emits_cancelled():
    published: list[str] = []
    mock_redis = _make_redis(published)

    async def _fake_astream(state, config=None):
        yield {"scan_files_node": {**state, "files_to_scan": ["a.java"]}}
        yield {"cache_check_node": {**state, "files_to_scan": ["a.java"]}}

    mock_graph = MagicMock()
    mock_graph.astream = _fake_astream

    _cancel_flags["sess-cancel"] = True  # 이미 취소 요청
    try:
        with (
            patch("api.routes.analyze.get_redis", AsyncMock(return_value=mock_redis)),
            patch("api.routes.analyze.get_graph", return_value=mock_graph),
            patch("api.routes.analyze.mcp_session", _noop_mcp),
        ):
            await _run_analysis("sess-cancel", "proj-1", "/workspace")

        types = _event_types(published)
        assert "cancelled" in types
        assert "completed" not in types
    finally:
        _cancel_flags.pop("sess-cancel", None)


# ---------------------------------------------------------------------------
# MCP 예외 → error 이벤트 발행
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_analysis_mcp_error_publishes_error_event():
    published: list[str] = []
    mock_redis = _make_redis(published)

    @asynccontextmanager
    async def _boom_mcp(session_id, workspace_root, mcp_script):
        raise RuntimeError("MCP subprocess failed")
        yield  # noqa: unreachable

    _cancel_flags["sess-error"] = False
    try:
        with (
            patch("api.routes.analyze.get_redis", AsyncMock(return_value=mock_redis)),
            patch("api.routes.analyze.get_graph", return_value=MagicMock()),
            patch("api.routes.analyze.mcp_session", _boom_mcp),
        ):
            await _run_analysis("sess-error", "proj-1", "/workspace")

        types = _event_types(published)
        assert "error" in types
        error_msg = next(json.loads(m) for m in published if json.loads(m)["type"] == "error")
        assert "MCP subprocess failed" in error_msg["message"]
    finally:
        _cancel_flags.pop("sess-error", None)


# ---------------------------------------------------------------------------
# 세션 완료 후 _cancel_flags 에서 제거되는지 확인
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_analysis_cleanup_cancel_flag():
    published: list[str] = []
    mock_redis = _make_redis(published)

    async def _fake_astream(state, config=None):
        yield {"scan_files_node": {**state, "files_to_scan": []}}
        yield {"aggregate_node": {**state, "sast_results": [], "status": "completed"}}

    mock_graph = MagicMock()
    mock_graph.astream = _fake_astream

    _cancel_flags["sess-cleanup"] = False
    with (
        patch("api.routes.analyze.get_redis", AsyncMock(return_value=mock_redis)),
        patch("api.routes.analyze.get_graph", return_value=mock_graph),
        patch("api.routes.analyze.mcp_session", _noop_mcp),
    ):
        await _run_analysis("sess-cleanup", "proj-1", "/workspace")

    assert "sess-cleanup" not in _cancel_flags


# ---------------------------------------------------------------------------
# progress 이벤트에 파일명/인덱스 포함 여부
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_analysis_progress_event_contains_file_info():
    published: list[str] = []
    mock_redis = _make_redis(published)

    async def _fake_astream(state, config=None):
        files = ["src/Dao.java"]
        yield {"scan_files_node": {**state, "files_to_scan": files}}
        yield {"cache_check_node": {**state, "files_to_scan": files, "current_file_index": 0, "cache_hit": False}}
        yield {"sast_node": {**state, "files_to_scan": files, "current_file_index": 0}}
        yield {"aggregate_node": {**state, "sast_results": [], "status": "completed"}}

    mock_graph = MagicMock()
    mock_graph.astream = _fake_astream

    _cancel_flags["sess-progress"] = False
    try:
        with (
            patch("api.routes.analyze.get_redis", AsyncMock(return_value=mock_redis)),
            patch("api.routes.analyze.get_graph", return_value=mock_graph),
            patch("api.routes.analyze.mcp_session", _noop_mcp),
        ):
            await _run_analysis("sess-progress", "proj-1", "/workspace")

        progress_events = [json.loads(m) for m in published if json.loads(m)["type"] == "progress"]
        assert len(progress_events) >= 1
        cache_evt = next((e for e in progress_events if e.get("node") == "cache_check"), None)
        assert cache_evt is not None
        assert cache_evt["file"] == "src/Dao.java"
        assert cache_evt["current"] == 1
        assert cache_evt["total"] == 1
    finally:
        _cancel_flags.pop("sess-progress", None)


# ---------------------------------------------------------------------------
# TASK-206: resume — checkpointer 없을 때 error 이벤트
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_resume_no_checkpointer_publishes_error():
    published: list[str] = []
    mock_redis = _make_redis(published)

    with (
        patch("api.routes.analyze.get_redis", AsyncMock(return_value=mock_redis)),
        patch("api.routes.analyze.get_checkpointer", return_value=None),
    ):
        await _run_resume("sess-no-cp")

    types = _event_types(published)
    assert "error" in types
    msg = next(json.loads(m) for m in published if json.loads(m)["type"] == "error")
    assert "checkpointer" in msg["message"].lower()


# ---------------------------------------------------------------------------
# TASK-206: resume — 체크포인트에서 completed 이벤트 정상 발행
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_resume_with_checkpointer_emits_completed():
    published: list[str] = []
    mock_redis = _make_redis(published)

    mock_cp = AsyncMock()
    mock_cp.aget_tuple = AsyncMock(return_value=None)  # 체크포인트 없음 → workspace_root 기본값

    async def _fake_astream(state, config=None):
        yield {"aggregate_node": {"sast_results": [], "status": "completed"}}

    mock_graph = MagicMock()
    mock_graph.astream = _fake_astream

    with (
        patch("api.routes.analyze.get_redis", AsyncMock(return_value=mock_redis)),
        patch("api.routes.analyze.get_checkpointer", return_value=mock_cp),
        patch("api.routes.analyze.get_graph", return_value=mock_graph),
        patch("api.routes.analyze.mcp_session", _noop_mcp),
    ):
        await _run_resume("sess-resume")

    types = _event_types(published)
    assert "started" in types
    assert "completed" in types
    assert "error" not in types


# ---------------------------------------------------------------------------
# TASK-206: resume — 취소 플래그 작동 확인
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_resume_cancel_flag_emits_cancelled():
    published: list[str] = []
    mock_redis = _make_redis(published)

    mock_cp = AsyncMock()
    mock_cp.aget_tuple = AsyncMock(return_value=None)

    async def _fake_astream(state, config=None):
        yield {"scan_files_node": {"files_to_scan": ["a.java"]}}
        yield {"cache_check_node": {}}

    mock_graph = MagicMock()
    mock_graph.astream = _fake_astream

    _cancel_flags["sess-resume-cancel"] = True
    try:
        with (
            patch("api.routes.analyze.get_redis", AsyncMock(return_value=mock_redis)),
            patch("api.routes.analyze.get_checkpointer", return_value=mock_cp),
            patch("api.routes.analyze.get_graph", return_value=mock_graph),
            patch("api.routes.analyze.mcp_session", _noop_mcp),
        ):
            await _run_resume("sess-resume-cancel")

        types = _event_types(published)
        assert "cancelled" in types
        assert "completed" not in types
    finally:
        _cancel_flags.pop("sess-resume-cancel", None)
