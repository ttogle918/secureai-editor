"""
🧪 mcp_github_tools.py 단위 테스트.

MCP 클라이언트(get_tool)를 mock으로 대체해 외부 네트워크 호출 없이 테스트한다.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from agent.tools.mcp_github_tools import (
    list_github_files,
    get_github_file_content,
    list_commits_via_mcp,
    get_commit_diff_via_mcp,
    SCANNABLE_EXTENSIONS,
)


# ─── 헬퍼 ────────────────────────────────────────────────────────────────────

def _make_tool_mock(return_value: str) -> MagicMock:
    """ainvoke 호출 시 지정한 문자열을 반환하는 MCP tool mock을 생성한다."""
    tool = MagicMock()
    tool.ainvoke = AsyncMock(return_value=return_value)
    return tool


# ─── list_github_files ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_github_files_passes_token():
    """복호화된 GitHub 토큰이 tool.ainvoke 호출 인자에 포함된다."""
    raw_listing = "src/Main.java\nsrc/utils/Helper.java\n"
    tool_mock = _make_tool_mock(raw_listing)

    with patch("agent.tools.mcp_github_tools.get_tool", return_value=tool_mock):
        files, _ = await list_github_files(
            session_id="sess-001",
            owner="myorg",
            repo="myrepo",
            ref="main",
            token="ghp_secret_token",
        )

    tool_mock.ainvoke.assert_called_once()
    call_args = tool_mock.ainvoke.call_args[0][0]
    assert call_args["token"] == "ghp_secret_token"
    assert call_args["owner"] == "myorg"
    assert call_args["repo"] == "myrepo"
    assert call_args["ref"] == "main"
    assert call_args["recursive"] is True
    assert "src/Main.java" in files
    assert "src/utils/Helper.java" in files


@pytest.mark.asyncio
async def test_list_github_files_filters_extensions():
    """스캔 가능 확장자만 결과에 포함된다 (바이너리, 빌드 파일 등 제외)."""
    raw_listing = "\n".join([
        "src/Main.java",
        "src/image.png",         # 이미지 제외
        "build.gradle",          # .gradle — 스캔 대상 아님
        "pom.xml",               # .xml — 스캔 대상 아님
        "src/Service.kt",
        "README.md",             # .md — 스캔 대상 아님
        "app.py",
        "index.ts",
    ])
    tool_mock = _make_tool_mock(raw_listing)

    with patch("agent.tools.mcp_github_tools.get_tool", return_value=tool_mock):
        files, _ = await list_github_files(
            session_id="sess-002",
            owner="testowner",
            repo="testrepo",
        )

    assert "src/Main.java" in files
    assert "src/Service.kt" in files
    assert "app.py" in files
    assert "index.ts" in files
    assert "src/image.png" not in files
    assert "build.gradle" not in files
    assert "pom.xml" not in files
    assert "README.md" not in files


@pytest.mark.asyncio
async def test_list_github_files_excludes_dirs():
    """디렉토리 항목 ('/' 로 끝나는 항목)은 결과에서 제외된다."""
    raw_listing = "\n".join([
        "src/",
        "src/main/",
        "src/main/java/",
        "src/main/java/App.java",
        "src/main/resources/",
        "src/main/resources/config.py",  # .py 확장자이므로 포함
    ])
    tool_mock = _make_tool_mock(raw_listing)

    with patch("agent.tools.mcp_github_tools.get_tool", return_value=tool_mock):
        files, _ = await list_github_files(
            session_id="sess-003",
            owner="testowner",
            repo="testrepo",
        )

    # 디렉토리 항목은 포함되지 않아야 함
    assert not any(e.endswith("/") for e in files)
    assert "src/main/java/App.java" in files
    assert "src/main/resources/config.py" in files


@pytest.mark.asyncio
async def test_list_github_files_no_token():
    """token이 None이면 ainvoke 인자에 'token' 키가 포함되지 않는다."""
    tool_mock = _make_tool_mock("src/Main.java\n")

    with patch("agent.tools.mcp_github_tools.get_tool", return_value=tool_mock):
        await list_github_files(
            session_id="sess-004",
            owner="publicowner",
            repo="publicrepo",
            token=None,
        )

    call_args = tool_mock.ainvoke.call_args[0][0]
    assert "token" not in call_args


@pytest.mark.asyncio
async def test_list_github_files_no_ref():
    """ref가 None이면 ainvoke 인자에 'ref' 키가 포함되지 않는다."""
    tool_mock = _make_tool_mock("src/Main.java\n")

    with patch("agent.tools.mcp_github_tools.get_tool", return_value=tool_mock):
        await list_github_files(
            session_id="sess-005",
            owner="owner",
            repo="repo",
            ref=None,
        )

    call_args = tool_mock.ainvoke.call_args[0][0]
    assert "ref" not in call_args


# ─── get_github_file_content ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_github_file_content_passes_args():
    """owner, repo, path, ref, token이 올바르게 tool.ainvoke 에 전달된다."""
    file_content = "public class Main { public static void main(String[] args) {} }"
    tool_mock = _make_tool_mock(file_content)

    with patch("agent.tools.mcp_github_tools.get_tool", return_value=tool_mock):
        result = await get_github_file_content(
            session_id="sess-006",
            owner="myorg",
            repo="myrepo",
            path="src/Main.java",
            ref="develop",
            token="ghp_secret",
        )

    tool_mock.ainvoke.assert_called_once()
    call_args = tool_mock.ainvoke.call_args[0][0]
    assert call_args["owner"] == "myorg"
    assert call_args["repo"] == "myrepo"
    assert call_args["path"] == "src/Main.java"
    assert call_args["ref"] == "develop"
    assert call_args["token"] == "ghp_secret"
    assert result == file_content


@pytest.mark.asyncio
async def test_get_github_file_content_list_result():
    """tool이 content list 형태로 응답해도 텍스트로 변환된다."""
    content_list = [
        {"type": "text", "text": "line1\n"},
        {"type": "text", "text": "line2\n"},
    ]
    tool_mock = _make_tool_mock(content_list)

    with patch("agent.tools.mcp_github_tools.get_tool", return_value=tool_mock):
        result = await get_github_file_content(
            session_id="sess-007",
            owner="owner",
            repo="repo",
            path="app.py",
        )

    assert "line1" in result
    assert "line2" in result


# ─── SCANNABLE_EXTENSIONS 상수 검증 ──────────────────────────────────────────

def test_scannable_extensions_contains_common_languages():
    """주요 언어 확장자가 SCANNABLE_EXTENSIONS에 포함된다."""
    expected = {".java", ".kt", ".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs"}
    assert expected.issubset(SCANNABLE_EXTENSIONS)


# ─── list_commits_via_mcp ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_commits_via_mcp_returns_list():
    """MCP list_commits 툴 응답(JSON 배열)을 파싱해 list를 반환한다."""
    import json
    commits = [
        {"sha": "abc123", "message": "fix bug", "date": "2026-01-01T00:00:00Z", "author": "alice"},
        {"sha": "def456", "message": "add feature", "date": "2026-01-02T00:00:00Z", "author": "bob"},
    ]
    tool_mock = _make_tool_mock(json.dumps(commits))

    with patch("agent.tools.mcp_github_tools.get_tool", return_value=tool_mock):
        result = await list_commits_via_mcp(
            session_id="sess-100",
            owner="myorg",
            repo="myrepo",
            page=1,
            per_page=30,
        )

    assert len(result) == 2
    assert result[0]["sha"] == "abc123"
    assert result[1]["author"] == "bob"


@pytest.mark.asyncio
async def test_list_commits_via_mcp_per_page_capped_at_100():
    """per_page가 100 초과면 100으로 제한되어 tool에 전달된다."""
    import json
    tool_mock = _make_tool_mock(json.dumps([]))

    with patch("agent.tools.mcp_github_tools.get_tool", return_value=tool_mock):
        await list_commits_via_mcp(
            session_id="sess-101",
            owner="owner",
            repo="repo",
            per_page=200,
        )

    call_args = tool_mock.ainvoke.call_args[0][0]
    assert call_args["per_page"] == 100


@pytest.mark.asyncio
async def test_list_commits_via_mcp_token_not_included_when_none():
    """token이 None이면 ainvoke 인자에 'token' 키가 포함되지 않는다."""
    import json
    tool_mock = _make_tool_mock(json.dumps([]))

    with patch("agent.tools.mcp_github_tools.get_tool", return_value=tool_mock):
        await list_commits_via_mcp(
            session_id="sess-102",
            owner="owner",
            repo="repo",
            token=None,
        )

    call_args = tool_mock.ainvoke.call_args[0][0]
    assert "token" not in call_args


@pytest.mark.asyncio
async def test_list_commits_via_mcp_invalid_json_returns_empty():
    """MCP 응답이 JSON 파싱 불가이면 빈 목록을 반환한다."""
    tool_mock = _make_tool_mock("not valid json {{")

    with patch("agent.tools.mcp_github_tools.get_tool", return_value=tool_mock):
        result = await list_commits_via_mcp(
            session_id="sess-103",
            owner="owner",
            repo="repo",
        )

    assert result == []


# ─── get_commit_diff_via_mcp ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_commit_diff_via_mcp_returns_dict():
    """MCP get_commit_diff 툴 응답(JSON 객체)을 파싱해 dict를 반환한다."""
    import json
    diff = {
        "sha": "abc123",
        "message": "fix bug",
        "date": "2026-01-01T00:00:00Z",
        "files": [
            {"filename": "src/app.py", "patch": "+secret_key = 'abc'", "status": "modified"}
        ],
    }
    tool_mock = _make_tool_mock(json.dumps(diff))

    with patch("agent.tools.mcp_github_tools.get_tool", return_value=tool_mock):
        result = await get_commit_diff_via_mcp(
            session_id="sess-200",
            owner="myorg",
            repo="myrepo",
            sha="abc123",
        )

    assert result["sha"] == "abc123"
    assert len(result["files"]) == 1
    assert result["files"][0]["filename"] == "src/app.py"


@pytest.mark.asyncio
async def test_get_commit_diff_via_mcp_token_passed():
    """token이 지정되면 ainvoke 인자에 포함된다."""
    import json
    tool_mock = _make_tool_mock(json.dumps({"sha": "abc", "files": []}))

    with patch("agent.tools.mcp_github_tools.get_tool", return_value=tool_mock):
        await get_commit_diff_via_mcp(
            session_id="sess-201",
            owner="owner",
            repo="repo",
            sha="abc123",
            token="ghp_test_pat_token",
        )

    call_args = tool_mock.ainvoke.call_args[0][0]
    assert call_args["token"] == "ghp_test_pat_token"
    assert call_args["sha"] == "abc123"


@pytest.mark.asyncio
async def test_get_commit_diff_via_mcp_invalid_json_returns_fallback():
    """MCP 응답이 JSON 파싱 불가이면 sha만 있는 fallback dict를 반환한다."""
    tool_mock = _make_tool_mock("ERROR: not found")

    with patch("agent.tools.mcp_github_tools.get_tool", return_value=tool_mock):
        result = await get_commit_diff_via_mcp(
            session_id="sess-202",
            owner="owner",
            repo="repo",
            sha="abc123def456",
        )

    assert result["sha"] == "abc123def456"
    assert result["files"] == []
