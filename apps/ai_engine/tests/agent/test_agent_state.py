"""AgentState TypedDict 직렬화/역직렬화 테스트."""
import json

from agent.agent_state import AgentState


def _make_state(**kwargs) -> AgentState:
    base: AgentState = {
        "session_id": "sess-001",
        "project_id": "proj-001",
        "workspace_root": "/workspace",
        "source_type": "local",
        "github_owner": None,
        "github_repo": None,
        "github_ref": None,
        "github_token": None,
        "files_to_scan": [],
        "current_file_index": 0,
        "current_file_sha256": None,
        "cache_hit": False,
        "sast_results": [],
        "progress_percent": 0.0,
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


def test_github_source_type_fields():
    """source_type=github 상태에서 GitHub 필드가 직렬화/역직렬화된다."""
    state = _make_state(
        source_type="github",
        github_owner="myorg",
        github_repo="myrepo",
        github_ref="main",
        github_token="ghp_secret",
    )
    restored: AgentState = json.loads(json.dumps(state))
    assert restored["source_type"] == "github"
    assert restored["github_owner"] == "myorg"
    assert restored["github_repo"] == "myrepo"
    assert restored["github_ref"] == "main"
    assert restored["github_token"] == "ghp_secret"


def test_local_source_type_github_fields_are_none():
    """source_type=local 상태에서 GitHub 필드는 None이다."""
    state = _make_state(source_type="local")
    assert state["github_owner"] is None
    assert state["github_repo"] is None
    assert state["github_ref"] is None
    assert state["github_token"] is None


def test_progress_percent_defaults_zero():
    """progress_percent 기본값은 0.0이다."""
    state = _make_state()
    assert state["progress_percent"] == 0.0
