"""
planning_node 단위 테스트.

검증 항목:
1. DETERMINISTIC: api_groups → stages 그룹핑 (이름별 묶음)
2. DETERMINISTIC: api_groups에 없는 파일은 마지막 stage(_STAGE_OTHER_NAME)
3. 모든 파일이 정확히 하나의 stage에 속함 (중복/누락 없음)
4. LLM 실패 시 DETERMINISTIC fallback (세션 실패 금지)
5. api_groups 없으면 모든 파일이 단일 stage
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from agent.nodes.planning_node import (
    _STAGE_OTHER_NAME,
    _build_deterministic_stages,
    _ensure_all_files_covered,
    _flatten_stages_to_files,
    planning_node,
)


# ── 헬퍼 ─────────────────────────────────────────────────────────────────────

def _make_state(**overrides):
    base = {
        "session_id": "test-session",
        "project_id": "proj-1",
        "workspace_root": "/workspace",
        "files_to_scan": [],
        "api_groups": [],
        "planning_mode": "DETERMINISTIC",
        "stages": [],
        "preferred_model": None,
        "user_api_key": None,
        "token_usage": {"input_tokens": 0, "output_tokens": 0,
                        "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0},
    }
    base.update(overrides)
    return base


def _api_group(name: str, url: str, paths: list[str]) -> dict:
    return {
        "name": name,
        "url": url,
        "files": [{"path": p, "line": 1} for p in paths],
    }


# ── _build_deterministic_stages ───────────────────────────────────────────────

def test_deterministic_groups_files_by_api_group_name():
    """api_groups의 name을 기준으로 파일이 묶인다."""
    api_groups = [
        _api_group("Auth", "/api/auth", ["AuthController.java", "AuthService.java"]),
        _api_group("User", "/api/user", ["UserController.java"]),
    ]
    files = ["AuthController.java", "AuthService.java", "UserController.java"]

    stages = _build_deterministic_stages(api_groups, files)

    names = [s["name"] for s in stages]
    assert "Auth" in names
    assert "User" in names
    assert _STAGE_OTHER_NAME not in names


def test_deterministic_ungrouped_files_go_to_other_stage():
    """api_groups에 포함되지 않은 파일은 마지막 stage(공통/기타)에 배정된다."""
    api_groups = [
        _api_group("Auth", "/api/auth", ["AuthController.java"]),
    ]
    files = ["AuthController.java", "utils.py", "config.py"]

    stages = _build_deterministic_stages(api_groups, files)

    other_stage = next((s for s in stages if s["name"] == _STAGE_OTHER_NAME), None)
    assert other_stage is not None
    assert "utils.py" in other_stage["files"]
    assert "config.py" in other_stage["files"]


def test_deterministic_no_api_groups_single_stage():
    """api_groups가 없으면 모든 파일이 하나의 stage에 배정된다."""
    files = ["a.py", "b.py", "c.java"]
    stages = _build_deterministic_stages([], files)

    assert len(stages) == 1
    assert stages[0]["name"] == _STAGE_OTHER_NAME
    assert set(stages[0]["files"]) == set(files)


def test_deterministic_stage_order_follows_api_group_order():
    """stage 순서는 api_groups 등장 순서를 따른다."""
    api_groups = [
        _api_group("Z_Group", "/z", ["z.java"]),
        _api_group("A_Group", "/a", ["a.java"]),
    ]
    files = ["z.java", "a.java"]
    stages = _build_deterministic_stages(api_groups, files)
    names = [s["name"] for s in stages]
    assert names.index("Z_Group") < names.index("A_Group")


def test_deterministic_duplicate_name_files_merged():
    """동일 name의 api_group이 여러 url을 가질 때 같은 stage에 중복 없이 묶인다."""
    api_groups = [
        _api_group("Auth", "/api/auth/login", ["AuthController.java", "AuthService.java"]),
        _api_group("Auth", "/api/auth/register", ["AuthController.java", "AuthRepo.java"]),
    ]
    files = ["AuthController.java", "AuthService.java", "AuthRepo.java"]
    stages = _build_deterministic_stages(api_groups, files)

    auth_stages = [s for s in stages if s["name"] == "Auth"]
    all_files_in_auth = [f for s in auth_stages for f in s["files"]]
    # AuthController.java가 두 번 포함되지 않는다
    assert all_files_in_auth.count("AuthController.java") == 1


# ── 모든 파일 커버리지 검증 ───────────────────────────────────────────────────

def test_all_files_covered_exactly_once():
    """flatten_stages_to_files는 모든 파일을 정확히 한 번만 포함한다."""
    stages = [
        {"stage_no": 1, "name": "Auth", "files": ["a.java", "b.java"], "reason": ""},
        {"stage_no": 2, "name": "User", "files": ["c.java"], "reason": ""},
        {"stage_no": 3, "name": _STAGE_OTHER_NAME, "files": ["d.py"], "reason": ""},
    ]
    result = _flatten_stages_to_files(stages)
    assert len(result) == 4
    assert len(set(result)) == 4  # 중복 없음


def test_ensure_all_files_covered_supplements_missing():
    """stages에 포함되지 않은 파일을 _ensure_all_files_covered가 보완한다."""
    stages = [
        {"stage_no": 1, "name": "Auth", "files": ["a.java"], "reason": ""},
    ]
    all_files = ["a.java", "missing.py", "also_missing.ts"]
    result = _ensure_all_files_covered(stages, all_files)

    all_covered = [f for s in result for f in s["files"]]
    assert "missing.py" in all_covered
    assert "also_missing.ts" in all_covered


def test_ensure_all_files_covered_no_duplicates():
    """이미 stages에 있는 파일은 중복 추가되지 않는다."""
    stages = [
        {"stage_no": 1, "name": "Auth", "files": ["a.java"], "reason": ""},
    ]
    result = _ensure_all_files_covered(stages, ["a.java"])
    all_files = [f for s in result for f in s["files"]]
    assert all_files.count("a.java") == 1


# ── planning_node 통합 (DETERMINISTIC) ───────────────────────────────────────

@pytest.mark.asyncio
async def test_planning_node_deterministic_returns_stages():
    """planning_node DETERMINISTIC 실행 시 stages와 정렬된 files_to_scan을 반환한다."""
    api_groups = [
        _api_group("Auth", "/api/auth", ["AuthController.java", "AuthService.java"]),
    ]
    state = _make_state(
        files_to_scan=["AuthController.java", "AuthService.java", "utils.py"],
        api_groups=api_groups,
        planning_mode="DETERMINISTIC",
    )
    result = await planning_node(state)

    assert "stages" in result
    assert len(result["stages"]) >= 1

    # 모든 파일이 반환된 files_to_scan에 포함된다
    all_returned = set(result["files_to_scan"])
    assert {"AuthController.java", "AuthService.java", "utils.py"} <= all_returned


@pytest.mark.asyncio
async def test_planning_node_deterministic_resets_file_index():
    """planning_node는 current_file_index를 0으로 초기화한다."""
    state = _make_state(
        files_to_scan=["a.java"],
        api_groups=[],
        planning_mode="DETERMINISTIC",
    )
    result = await planning_node(state)
    assert result["current_file_index"] == 0


@pytest.mark.asyncio
async def test_planning_node_empty_files_returns_empty_stages():
    """files_to_scan이 빈 경우 stages는 빈 리스트다."""
    state = _make_state(files_to_scan=[], api_groups=[], planning_mode="DETERMINISTIC")
    result = await planning_node(state)
    assert result["stages"] == []
    assert result["files_to_scan"] == []


# ── planning_node LLM 실패 시 fallback ───────────────────────────────────────

@pytest.mark.asyncio
async def test_planning_node_llm_failure_falls_back_to_deterministic():
    """LLM 호출이 실패해도 DETERMINISTIC fallback으로 세션이 계속된다."""
    api_groups = [_api_group("Auth", "/api/auth", ["auth.java"])]
    state = _make_state(
        files_to_scan=["auth.java", "util.py"],
        api_groups=api_groups,
        planning_mode="LLM",
    )

    with patch(
        "agent.nodes.planning_node._request_llm_stages",
        side_effect=RuntimeError("Claude API timeout"),
    ):
        result = await planning_node(state)

    # fallback으로 stages가 생성된다
    assert len(result["stages"]) >= 1
    # 모든 파일이 포함된다
    assert set(result["files_to_scan"]) == {"auth.java", "util.py"}


@pytest.mark.asyncio
async def test_planning_node_llm_success_uses_llm_stages():
    """LLM 호출 성공 시 LLM이 반환한 stages를 사용한다."""
    state = _make_state(
        files_to_scan=["a.java", "b.java"],
        api_groups=[],
        planning_mode="LLM",
    )

    llm_stages = [
        {"stage_no": 1, "name": "LLM_Stage", "files": ["a.java", "b.java"], "reason": "LLM decided"},
    ]
    fake_usage = {"input_tokens": 100, "output_tokens": 50,
                  "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0}

    with patch(
        "agent.nodes.planning_node._request_llm_stages",
        new=AsyncMock(return_value=(llm_stages, fake_usage)),
    ):
        result = await planning_node(state)

    assert result["stages"][0]["name"] == "LLM_Stage"
    # token_usage가 누적된다
    assert result["token_usage"]["input_tokens"] == 100


@pytest.mark.asyncio
async def test_planning_node_llm_partial_files_supplemented():
    """LLM이 일부 파일을 누락해도 ensure_all_files_covered가 보완한다."""
    state = _make_state(
        files_to_scan=["a.java", "b.java", "missing.py"],
        api_groups=[],
        planning_mode="LLM",
    )

    # LLM이 missing.py를 누락한 응답 반환
    llm_stages = [
        {"stage_no": 1, "name": "Group", "files": ["a.java", "b.java"], "reason": ""},
    ]
    fake_usage = {"input_tokens": 10, "output_tokens": 5,
                  "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0}

    with patch(
        "agent.nodes.planning_node._request_llm_stages",
        new=AsyncMock(return_value=(llm_stages, fake_usage)),
    ):
        result = await planning_node(state)

    all_in_stages = [f for s in result["stages"] for f in s["files"]]
    assert "missing.py" in all_in_stages


# ── sast_node scanning 이벤트 ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sast_node_publishes_scanning_event_on_start():
    """sast_node 시작 시 Redis에 scanning 이벤트가 publish된다."""
    import json
    published: list[str] = []

    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock(
        side_effect=lambda ch, msg: published.append(msg) or None
    )

    fake_usage = {
        "input_tokens": 10, "output_tokens": 5,
        "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
    }

    with (
        patch("agent.nodes.sast_node.read_file", new=AsyncMock(return_value="x = 1")),
        patch("agent.nodes.sast_node.load_guidelines", new=AsyncMock(return_value="")),
        patch("agent.nodes.sast_node._analyze_chunks", new=AsyncMock(return_value=([], fake_usage))),
        # VAL-3: save_vulnerabilities는 validate_findings_node로 이관 — sast_node에 없음
        patch("agent.nodes.sast_node.log_started", new=AsyncMock()),
        patch("agent.nodes.sast_node.log_completed", new=AsyncMock()),
        patch("agent.nodes.sast_node.classify_and_enrich", return_value=[]),
        patch("agent.nodes.sast_node._get_redis", return_value=mock_redis),
        patch("agent.nodes.sast_node._fetch_prev_vuln_context", new=AsyncMock(return_value="")),
        patch("agent.nodes.sast_node._ai_tokens_counter", MagicMock()),
    ):
        from agent.nodes.sast_node import sast_node
        state = {
            "session_id": "sess-scan",
            "project_id": "proj-1",
            "files_to_scan": ["/src/main.py", "/src/util.py"],
            "current_file_index": 0,
            "current_file_sha256": None,
            "source_type": "local",
            "scan_mode": "PIPELINE",
            "preferred_model": None,
            "user_api_key": None,
            "sast_results": [],
            "token_usage": None,
        }
        await sast_node(state)

    scanning_msgs = [
        json.loads(m) for m in published
        if json.loads(m).get("type") == "progress"
        and json.loads(m).get("phase") == "scanning"
    ]
    assert len(scanning_msgs) >= 1, "scanning 이벤트가 발행돼야 한다"
    msg = scanning_msgs[0]
    assert msg["session_id"] == "sess-scan"
    assert msg["node"] == "sast"
    assert msg["phase"] == "scanning"
    assert msg["file"] == "/src/main.py"
    assert msg["current"] == 1
    assert msg["total"] == 2


@pytest.mark.asyncio
async def test_sast_node_scanning_publish_failure_does_not_break_analysis():
    """scanning publish 실패해도 분석 흐름이 중단되지 않는다."""
    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock(side_effect=ConnectionError("Redis down"))

    fake_usage = {
        "input_tokens": 10, "output_tokens": 5,
        "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
    }

    with (
        patch("agent.nodes.sast_node.read_file", new=AsyncMock(return_value="x = 1")),
        patch("agent.nodes.sast_node.load_guidelines", new=AsyncMock(return_value="")),
        patch("agent.nodes.sast_node._analyze_chunks", new=AsyncMock(return_value=([], fake_usage))),
        # VAL-3: save_vulnerabilities는 validate_findings_node로 이관 — sast_node에 없음
        patch("agent.nodes.sast_node.log_started", new=AsyncMock()),
        patch("agent.nodes.sast_node.log_completed", new=AsyncMock()),
        patch("agent.nodes.sast_node.classify_and_enrich", return_value=[]),
        patch("agent.nodes.sast_node._get_redis", return_value=mock_redis),
        patch("agent.nodes.sast_node._fetch_prev_vuln_context", new=AsyncMock(return_value="")),
        patch("agent.nodes.sast_node._ai_tokens_counter", MagicMock()),
    ):
        from agent.nodes.sast_node import sast_node
        state = {
            "session_id": "sess-redis-fail",
            "project_id": "proj-1",
            "files_to_scan": ["/src/main.py"],
            "current_file_index": 0,
            "current_file_sha256": None,
            "source_type": "local",
            "scan_mode": "PIPELINE",
            "preferred_model": None,
            "user_api_key": None,
            "sast_results": [],
            "token_usage": None,
        }
        # 예외 없이 정상 완료돼야 한다
        result = await sast_node(state)

    assert "sast_results" in result
