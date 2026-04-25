"""AgentState TypedDict 직렬화/역직렬화 테스트."""
import json

from agent.agent_state import AgentState


def _make_state(**kwargs) -> AgentState:
    base: AgentState = {
        "session_id": "sess-001",
        "project_id": "proj-001",
        "workspace_root": "/workspace",
        "files_to_scan": [],
        "current_file_index": 0,
        "current_file_sha256": None,
        "cache_hit": False,
        "sast_results": [],
        "status": "running",
        "error_message": None,
    }
    base.update(kwargs)
    return base


def test_serialization_roundtrip():
    state = _make_state(files_to_scan=["src/Main.java", "src/Dao.java"])
    restored: AgentState = json.loads(json.dumps(state))
    assert restored["session_id"] == state["session_id"]
    assert restored["files_to_scan"] == ["src/Main.java", "src/Dao.java"]


def test_empty_files_to_scan():
    state = _make_state()
    assert state["files_to_scan"] == []
    assert state["current_file_index"] == 0


def test_sha256_field_defaults_none():
    state = _make_state()
    assert state["current_file_sha256"] is None


def test_sha256_field_set():
    sha = "a" * 64
    state = _make_state(current_file_sha256=sha)
    restored: AgentState = json.loads(json.dumps(state))
    assert restored["current_file_sha256"] == sha


def test_sast_results_accumulation():
    state = _make_state(
        sast_results=[
            {"file": "A.java", "vulnerabilities": [{"type": "SQL_INJECTION"}]},
            {"file": "B.java", "vulnerabilities": []},
        ]
    )
    total = sum(len(r["vulnerabilities"]) for r in state["sast_results"])
    assert total == 1


def test_error_state():
    state = _make_state(status="error", error_message="MCP connection failed")
    restored: AgentState = json.loads(json.dumps(state))
    assert restored["status"] == "error"
    assert restored["error_message"] == "MCP connection failed"
