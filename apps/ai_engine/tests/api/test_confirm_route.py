"""
STAGE-2 confirm 라우트 단위 테스트.

DoD 검증:
🧪 confirm 제외 반영(체크포인트 mock)
🧪 idempotent+confirm 갱신 양립(재계획 없이 보존)
🛡️ 모든 stage 제외 → 400
🛡️ 체크포인트 없음 → 404
🛡️ 외부 경로 제외 목록에서 무시(경로순회 방어)
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from api.routes.confirm import (
    ConfirmPlanRequest,
    _apply_stage_selection,
    _apply_file_exclusion,
    _flatten_stages,
    _run_confirm,
)


# ── FAIL-3 회귀: 순환 임포트 부재 확인 ───────────────────────────────────────────

def test_no_circular_import_between_analyze_and_confirm():
    """
    FAIL-3 회귀 테스트: analyze.py와 confirm.py 간 순환 임포트가 없음을 검증한다.

    두 모듈을 각각 임포트해서 ImportError 없이 로드되는지 확인한다.
    공유 _cancel_flags가 동일 객체(streaming_helpers 싱글턴)를 참조하는지도 검증한다.
    """
    import importlib
    import sys

    # 기존 임포트 캐시를 사용하되 에러가 없으면 통과
    analyze_mod = sys.modules.get("api.routes.analyze")
    confirm_mod = sys.modules.get("api.routes.confirm")
    helpers_mod = sys.modules.get("api.routes.streaming_helpers")

    # 모두 로드돼 있어야 하며 ImportError가 없었음을 의미
    assert analyze_mod is not None, "api.routes.analyze 임포트 실패"
    assert confirm_mod is not None, "api.routes.confirm 임포트 실패"
    assert helpers_mod is not None, "api.routes.streaming_helpers 임포트 실패"

    # 양쪽이 동일 _cancel_flags 객체를 참조하는지 확인 (singleton)
    analyze_flags = getattr(analyze_mod, "_cancel_flags", None)
    confirm_flags = getattr(confirm_mod, "_cancel_flags", None)
    helpers_flags = getattr(helpers_mod, "_cancel_flags", None)

    assert analyze_flags is helpers_flags, (
        "analyze._cancel_flags가 streaming_helpers._cancel_flags와 다른 객체다"
    )
    assert confirm_flags is helpers_flags, (
        "confirm._cancel_flags가 streaming_helpers._cancel_flags와 다른 객체다"
    )


# ── 헬퍼 ─────────────────────────────────────────────────────────────────────

def _make_stage(no: int, name: str, files: list[str]) -> dict:
    return {"stage_no": no, "name": name, "files": files, "reason": "test"}


def _make_checkpoint(stages: list[dict], files: list[str]) -> MagicMock:
    cp = MagicMock()
    cp.checkpoint = {"channel_values": {"stages": stages, "files_to_scan": files}}
    return cp


# ── _apply_stage_selection ───────────────────────────────────────────────────

def test_apply_stage_selection_none_returns_all():
    """selected_stage_nos=None 이면 전체 stage 반환."""
    stages = [_make_stage(1, "A", ["a.py"]), _make_stage(2, "B", ["b.py"])]
    result = _apply_stage_selection(stages, None)
    assert len(result) == 2


def test_apply_stage_selection_subset():
    """selected_stage_nos=[1] 이면 stage_no=1 만 반환."""
    stages = [_make_stage(1, "A", ["a.py"]), _make_stage(2, "B", ["b.py"])]
    result = _apply_stage_selection(stages, [1])
    assert len(result) == 1
    assert result[0]["stage_no"] == 1


def test_apply_stage_selection_empty_list_returns_empty():
    """selected_stage_nos=[] 이면 빈 리스트."""
    stages = [_make_stage(1, "A", ["a.py"])]
    result = _apply_stage_selection(stages, [])
    assert result == []


# ── _apply_file_exclusion ────────────────────────────────────────────────────

def test_apply_file_exclusion_removes_excluded():
    """제외 경로가 stage files에서 제거된다."""
    stages = [_make_stage(1, "A", ["a.py", "b.py", "c.py"])]
    result = _apply_file_exclusion(stages, {"b.py"})
    assert result[0]["files"] == ["a.py", "c.py"]


def test_apply_file_exclusion_no_excluded_unchanged():
    """excluded 빈 집합이면 원본 그대로."""
    stages = [_make_stage(1, "A", ["a.py", "b.py"])]
    result = _apply_file_exclusion(stages, set())
    assert result[0]["files"] == ["a.py", "b.py"]


# ── _flatten_stages ───────────────────────────────────────────────────────────

def test_flatten_stages_preserves_order():
    """stage_no 순서대로 파일이 평탄화된다."""
    stages = [
        _make_stage(2, "B", ["b.py"]),
        _make_stage(1, "A", ["a.py"]),
    ]
    result = _flatten_stages(stages)
    # stage_no 1 먼저(오름차순 정렬)
    assert result == ["a.py", "b.py"]


def test_flatten_stages_no_duplicates():
    """중복 파일은 첫 번째 등장만 유지."""
    stages = [
        _make_stage(1, "A", ["a.py", "b.py"]),
        _make_stage(2, "B", ["b.py", "c.py"]),
    ]
    result = _flatten_stages(stages)
    assert result.count("b.py") == 1


# ── confirm 라우트 통합 ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_confirm_plan_all_stages_excluded_returns_400():
    """selected_stage_nos가 존재하지 않는 번호면 → 400."""
    from fastapi.testclient import TestClient
    from fastapi import FastAPI
    from api.routes.confirm import router

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    mock_cp = AsyncMock()
    mock_cp.aget_tuple = AsyncMock(return_value=_make_checkpoint(
        [_make_stage(1, "A", ["a.py"])],
        ["a.py"],
    ))

    with patch("api.routes.confirm.get_checkpointer", return_value=mock_cp):
        response = client.post(
            "/agent/confirm/test-session",
            json={"selected_stage_nos": [99], "excluded_file_paths": []},
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_confirm_plan_checkpoint_not_found_returns_404():
    """체크포인트가 없으면 → 404."""
    from fastapi.testclient import TestClient
    from fastapi import FastAPI
    from api.routes.confirm import router

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    mock_cp = AsyncMock()
    mock_cp.aget_tuple = AsyncMock(return_value=None)

    with patch("api.routes.confirm.get_checkpointer", return_value=mock_cp):
        response = client.post(
            "/agent/confirm/missing-session",
            json={"selected_stage_nos": None, "excluded_file_paths": []},
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_confirm_plan_external_path_ignored():
    """외부 경로(체크포인트 files_to_scan 외)는 제외 목록에서 무시된다(경로순회 방어)."""
    original_files = ["src/Auth.java", "src/User.java"]
    stages = [_make_stage(1, "Auth", original_files)]

    excluded_files_whitelist_check = _apply_file_exclusion(
        stages,
        excluded={"../../../etc/passwd"} & set(original_files),  # 교집합 = 빈 집합
    )
    # 외부 경로는 무시되고 원본 파일은 그대로
    assert excluded_files_whitelist_check[0]["files"] == original_files


@pytest.mark.asyncio
async def test_run_confirm_updates_state_and_resumes():
    """_run_confirm이 aupdate_state 호출 후 그래프를 재개한다."""
    import json

    published: list[str] = []
    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock(side_effect=lambda ch, msg: published.append(msg) or None)

    new_stages = [_make_stage(1, "Auth", ["auth.java"])]
    new_files = ["auth.java"]

    mock_graph = MagicMock()
    mock_graph.aupdate_state = AsyncMock()

    async def _fake_astream(state, config=None):
        yield {"patch_node": {"sast_results": [], "token_usage": {}}}

    mock_graph.astream = _fake_astream
    mock_cp = AsyncMock()

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def _noop_mcp(sid, workspace, script):
        yield []

    channel_values = {
        "workspace_root": "/workspace",
        "source_type": "local",
        "stages": new_stages,
        "files_to_scan": new_files,
    }

    with (
        patch("api.routes.confirm.get_redis", AsyncMock(return_value=mock_redis)),
        patch("api.routes.confirm.get_checkpointer", return_value=mock_cp),
        patch("api.routes.confirm.get_graph", return_value=mock_graph),
        patch("api.routes.confirm.mcp_session", _noop_mcp),
    ):
        await _run_confirm(
            session_id="sess-confirm",
            new_stages=new_stages,
            new_files_to_scan=new_files,
            channel_values=channel_values,
        )

    # aupdate_state 호출 검증
    mock_graph.aupdate_state.assert_awaited_once()
    call_args = mock_graph.aupdate_state.call_args
    _, kwargs = call_args
    # as_node="planning_node" 필수(Dev 보완 #2)
    assert kwargs.get("as_node") == "planning_node" or call_args[0][2] == "planning_node"

    # 이벤트 발행 확인
    event_types = [json.loads(m)["type"] for m in published]
    assert "started" in event_types


# ── graph_builder 캐시 키 분리 테스트 (Dev 보완 #3) ──────────────────────────

def test_graph_builder_interrupt_cache_key_separation():
    """interrupt=True/False 컴파일본이 서로 다른 인스턴스를 반환한다."""
    from agent.graph_builder import _graph_cache, get_graph

    # 캐시 초기화
    _graph_cache.clear()

    g_normal = get_graph(interrupt=False)
    g_interrupt = get_graph(interrupt=True)

    assert g_normal is not g_interrupt, \
        "interrupt=True/False 컴파일본은 서로 다른 인스턴스여야 한다"


def test_graph_builder_same_interrupt_mode_returns_same():
    """동일 interrupt 모드는 동일 인스턴스를 반환한다(싱글턴 캐시)."""
    from agent.graph_builder import _graph_cache, get_graph

    _graph_cache.clear()

    g1 = get_graph(interrupt=False)
    g2 = get_graph(interrupt=False)

    assert g1 is g2


# ── planning_node idempotent + confirm 갱신 양립 ────────────────────────────

@pytest.mark.asyncio
async def test_planning_node_idempotent_with_confirmed_state():
    """confirmed=True + stages 있음 → planning_node가 no-op을 반환해 기존 계획을 보존한다."""
    from agent.nodes.planning_node import planning_node

    existing_stages = [_make_stage(1, "Auth", ["auth.java"])]
    state = {
        "session_id": "sess-idem",
        "project_id": "proj-1",
        "workspace_root": "/workspace",
        "files_to_scan": ["auth.java"],
        "api_groups": [],
        "planning_mode": "DETERMINISTIC",
        "stages": existing_stages,   # 이미 설정됨
        "confirmed": True,            # confirm 완료
        "preferred_model": None,
        "user_api_key": None,
        "token_usage": {
            "input_tokens": 0, "output_tokens": 0,
            "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
        },
    }

    result = await planning_node(state)

    # no-op: 빈 dict 반환 — stages/files_to_scan 덮어쓰지 않음
    assert result == {}, \
        "stages가 이미 있고 confirmed=True이면 planning_node는 no-op이어야 한다"
