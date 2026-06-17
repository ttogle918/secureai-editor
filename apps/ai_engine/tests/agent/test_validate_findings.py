"""
VAL-3 결정론적 검증 레이어 단위 테스트.

테스트 범위:
  - ast_verifier.verify_finding: 언어별 검증 로직
  - parsers/python.py: Python AST 기반 검증
  - parsers/java.py: Java 라인 기반 검증
  - parsers/ts.py: TypeScript/JavaScript 정규식 검증
  - validate_findings_node: 노드 상태 변환 (mock 파일 읽기)

DoD 검증 항목:
  [x] 가짜 finding(없는 line / 주석 라인) → 폐기
  [x] 실재 finding → 통과
  [x] Java 검증 동작
  [x] Python 검증 동작
  [x] TS/JS 정규식 검증
  [x] 미지원 언어 보류(pass-through)
  [x] discarded 카운트 노출
  [x] 저장된 findings는 모두 라인 실재("가짜인용 0건")
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

# ─── Python 파서 테스트 ───────────────────────────────────────────────────────

from agent.validation.parsers.python import verify_line as py_verify


PYTHON_CODE = """\
def greet(name):
    # 인사 함수
    print(f"Hello, {name}")
    return name
"""


def test_python_valid_code_line_passes():
    """실재 코드 라인 → verified=True."""
    result = py_verify(PYTHON_CODE, 1)
    assert result["verified"] is True


def test_python_comment_line_discarded():
    """주석 라인(#으로 시작) → verified=False."""
    result = py_verify(PYTHON_CODE, 2)
    assert result["verified"] is False
    assert "comment" in result["reason"]


def test_python_code_inside_function_passes():
    """함수 내부 코드 라인 → verified=True."""
    result = py_verify(PYTHON_CODE, 3)
    assert result["verified"] is True


def test_python_out_of_range_line_discarded():
    """파일 라인 수를 초과하는 라인 → verified=False."""
    result = py_verify(PYTHON_CODE, 999)
    assert result["verified"] is False
    assert "out of range" in result["reason"]


def test_python_zero_line_discarded():
    """라인 0 → verified=False (1-based)."""
    result = py_verify(PYTHON_CODE, 0)
    assert result["verified"] is False


def test_python_syntax_error_pass_through():
    """구문 오류 있는 파일 → 보류(pass-through)."""
    broken = "def foo(\n    invalid syntax here!!!\n"
    result = py_verify(broken, 1)
    assert result["verified"] is True
    assert "pass-through" in result["reason"]


def test_python_empty_line_discarded():
    """빈 라인 → verified=False."""
    code = "x = 1\n\ny = 2\n"
    result = py_verify(code, 2)
    assert result["verified"] is False


# ─── Java 파서 테스트 ─────────────────────────────────────────────────────────

from agent.validation.parsers.java import verify_line as java_verify, _classify_lines


JAVA_CODE = """\
public class Example {
    // 단행 주석
    /* 블록 주석 시작
       블록 주석 끝 */
    public void run() {
        System.out.println("hello");
    }
}
"""


def test_java_class_declaration_passes():
    """클래스 선언 라인 → verified=True."""
    result = java_verify(JAVA_CODE, 1)
    assert result["verified"] is True


def test_java_single_line_comment_discarded():
    """// 주석 라인 → verified=False."""
    result = java_verify(JAVA_CODE, 2)
    assert result["verified"] is False
    assert "comment" in result["reason"]


def test_java_block_comment_lines_discarded():
    """/* */ 블록 주석 내부 라인 → verified=False."""
    result = java_verify(JAVA_CODE, 3)
    assert result["verified"] is False
    result2 = java_verify(JAVA_CODE, 4)
    assert result2["verified"] is False


def test_java_method_declaration_passes():
    """메서드 선언 라인 → verified=True."""
    result = java_verify(JAVA_CODE, 5)
    assert result["verified"] is True


def test_java_out_of_range_discarded():
    """파일 범위 초과 라인 → verified=False."""
    result = java_verify(JAVA_CODE, 100)
    assert result["verified"] is False
    assert "out of range" in result["reason"]


def test_java_classify_lines_counts():
    """_classify_lines가 코드 라인과 비코드 라인을 정확히 분류한다."""
    lines = JAVA_CODE.splitlines()
    classified = _classify_lines(lines)
    # 라인 1: public class → True
    assert classified[0] is True
    # 라인 2: // 주석 → False
    assert classified[1] is False
    # 라인 3: /* 시작 → False
    assert classified[2] is False
    # 라인 4: 블록 내부 → False
    assert classified[3] is False
    # 라인 5: public void → True
    assert classified[4] is True


# ─── TypeScript/JavaScript 파서 테스트 ────────────────────────────────────────

from agent.validation.parsers.ts import verify_line as ts_verify


TS_CODE = """\
// TypeScript 파일 예시
const greeting = (name: string): string => {
    /* 블록 주석 */
    return `Hello, ${name}`;
};

export default greeting;
"""


def test_ts_single_comment_discarded():
    """// 주석 라인 → verified=False."""
    result = ts_verify(TS_CODE, 1)
    assert result["verified"] is False
    assert "comment" in result["reason"]


def test_ts_code_line_passes():
    """실재 코드 라인 → verified=True."""
    result = ts_verify(TS_CODE, 2)
    assert result["verified"] is True


def test_ts_block_comment_discarded():
    """/* */ 블록 주석 → verified=False."""
    result = ts_verify(TS_CODE, 3)
    assert result["verified"] is False


def test_ts_return_statement_passes():
    """return 구문 → verified=True."""
    result = ts_verify(TS_CODE, 4)
    assert result["verified"] is True


def test_ts_empty_line_discarded():
    """빈 라인(6번) → verified=False."""
    result = ts_verify(TS_CODE, 6)
    assert result["verified"] is False


def test_ts_out_of_range_discarded():
    """범위 초과 → verified=False."""
    result = ts_verify(TS_CODE, 999)
    assert result["verified"] is False


def test_js_extension_also_works():
    """JS 파일도 동일 파서로 처리된다."""
    js_code = "// comment\nconst x = 1;\n"
    assert ts_verify(js_code, 1)["verified"] is False
    assert ts_verify(js_code, 2)["verified"] is True


# ─── ast_verifier.verify_finding 통합 테스트 ──────────────────────────────────

from agent.validation.ast_verifier import verify_finding


def test_verify_finding_python_real_line_passes():
    """Python 실재 코드 라인 → verified=True."""
    finding = {"file": "src/app.py", "line": 3, "type": "SQL_INJECTION"}
    result = verify_finding(finding, PYTHON_CODE, "python")
    assert result["verified"] is True


def test_verify_finding_python_comment_line_discarded():
    """Python 주석 라인 → verified=False."""
    finding = {"file": "src/app.py", "line": 2, "type": "XSS"}
    result = verify_finding(finding, PYTHON_CODE, "python")
    assert result["verified"] is False


def test_verify_finding_nonexistent_line_discarded():
    """존재하지 않는 라인 번호 → verified=False."""
    finding = {"file": "src/app.py", "line": 9999, "type": "SQL_INJECTION"}
    result = verify_finding(finding, PYTHON_CODE, "python")
    assert result["verified"] is False


def test_verify_finding_no_line_info_pass_through():
    """line 정보 없는 finding → file 존재만 확인, pass-through."""
    finding = {"file": "src/app.py", "type": "SQL_INJECTION"}
    result = verify_finding(finding, PYTHON_CODE, "python")
    assert result["verified"] is True
    assert "no line info" in result["reason"]


def test_verify_finding_zero_line_pass_through():
    """line=0인 finding → pass-through."""
    finding = {"file": "src/app.py", "line": 0, "type": "SQL_INJECTION"}
    result = verify_finding(finding, PYTHON_CODE, "python")
    assert result["verified"] is True


def test_verify_finding_unsupported_language_pass_through():
    """미지원 언어(Go, Ruby 등) → 보류(pass-through)."""
    finding = {"file": "src/main.go", "line": 5, "type": "SQL_INJECTION"}
    result = verify_finding(finding, "package main\n\nfunc main() {}\n", "go")
    assert result["verified"] is True
    assert "unsupported" in result["reason"]


def test_verify_finding_java_real_line_passes():
    """Java 실재 코드 라인 → verified=True."""
    finding = {"file": "src/Main.java", "line": 1, "type": "SQL_INJECTION"}
    result = verify_finding(finding, JAVA_CODE, "java")
    assert result["verified"] is True


def test_verify_finding_java_comment_discarded():
    """Java 주석 라인 → verified=False."""
    finding = {"file": "src/Main.java", "line": 2, "type": "XSS"}
    result = verify_finding(finding, JAVA_CODE, "java")
    assert result["verified"] is False


def test_verify_finding_ts_comment_discarded():
    """TypeScript 주석 라인 → verified=False."""
    finding = {"file": "src/app.ts", "line": 1, "type": "XSS"}
    result = verify_finding(finding, TS_CODE, "typescript")
    assert result["verified"] is False


def test_verify_finding_ts_code_passes():
    """TypeScript 코드 라인 → verified=True."""
    finding = {"file": "src/app.ts", "line": 2, "type": "XSS"}
    result = verify_finding(finding, TS_CODE, "typescript")
    assert result["verified"] is True


def test_verify_finding_path_traversal_blocked():
    """경로 순회 패턴이 포함된 finding → pass-through (차단 후 안전 처리)."""
    finding = {"file": "../../etc/passwd", "line": 1, "type": "PATH_TRAVERSAL"}
    result = verify_finding(finding, "root:x:0:0\n", "python")
    assert result["verified"] is True  # 차단하지만 폐기하지 않음(pass-through)
    assert "path traversal" in result["reason"]


def test_verify_finding_empty_file_content_pass_through():
    """파일 내용이 없으면 → pass-through."""
    finding = {"file": "src/app.py", "line": 5, "type": "SQL_INJECTION"}
    result = verify_finding(finding, "", "python")
    assert result["verified"] is True


def test_verify_finding_infers_language_from_extension():
    """언어 파라미터 없어도 파일 확장자로 파서를 선택한다."""
    finding = {"file": "src/app.py", "line": 2, "type": "XSS"}
    # language 파라미터를 빈 문자열로 전달 → 파일 경로 확장자로 파서 선택
    result = verify_finding(finding, PYTHON_CODE, "")
    # .py 확장자 → python 파서 → 주석 라인 → False
    assert result["verified"] is False


# ─── validate_findings_node 단위 테스트 (mock 사용) ───────────────────────────

from agent.nodes.validate_findings_node import validate_findings_node


def _make_state(**kwargs) -> dict:
    """테스트용 최소 AgentState를 생성한다."""
    base = {
        "session_id": "sess-test",
        "project_id": "proj-test",
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
        "validated_findings": [],
        "discarded_findings": [],
        "patch_results": [],
        "progress_percent": 0.0,
        "status": "running",
        "error_message": None,
        "scan_mode": None,
        "planning_mode": None,
        "stages": [],
        "preferred_model": None,
        "user_api_key": None,
        "preferred_provider": None,
        "token_usage": {},
        "confirmed": False,
        "commits": [],
        "secrets_found": [],
        "api_groups": [],
        "file_filter": None,
    }
    base.update(kwargs)
    return base


@pytest.mark.asyncio
async def test_validate_node_empty_sast_results():
    """sast_results가 없으면 빈 dict 반환 — 에러 없음."""
    state = _make_state()
    result = await validate_findings_node(state)
    assert result == {}


@pytest.mark.asyncio
async def test_validate_node_real_finding_passes():
    """실재 코드 라인 finding → validated_findings에 추가, save 호출."""
    python_content = "def foo():\n    x = input()\n    return x\n"
    sast_results = [
        {"file": "src/app.py", "vulnerabilities": [{"file": "src/app.py", "line": 2, "type": "SQL_INJECTION"}], "cached": False}
    ]
    state = _make_state(sast_results=sast_results)

    with patch("agent.nodes.validate_findings_node.read_file", new_callable=AsyncMock) as mock_read, \
         patch("agent.nodes.validate_findings_node.save_vulnerabilities", new_callable=AsyncMock) as mock_save:
        mock_read.return_value = python_content
        result = await validate_findings_node(state)

    assert len(result["validated_findings"]) == 1
    assert len(result["discarded_findings"]) == 0
    mock_save.assert_called_once()


@pytest.mark.asyncio
async def test_validate_node_comment_finding_discarded():
    """주석 라인 finding → discarded_findings에 이동, save 미호출."""
    python_content = "def foo():\n    # 주석\n    return 1\n"
    finding = {"file": "src/app.py", "line": 2, "type": "XSS"}
    sast_results = [
        {"file": "src/app.py", "vulnerabilities": [finding], "cached": False}
    ]
    state = _make_state(sast_results=sast_results)

    with patch("agent.nodes.validate_findings_node.read_file", new_callable=AsyncMock) as mock_read, \
         patch("agent.nodes.validate_findings_node.save_vulnerabilities", new_callable=AsyncMock) as mock_save:
        mock_read.return_value = python_content
        result = await validate_findings_node(state)

    assert len(result["validated_findings"]) == 0
    assert len(result["discarded_findings"]) == 1
    assert "_discard_reason" in result["discarded_findings"][0]
    mock_save.assert_not_called()


@pytest.mark.asyncio
async def test_validate_node_out_of_range_finding_discarded():
    """존재하지 않는 라인 → discarded_findings."""
    python_content = "x = 1\n"
    finding = {"file": "src/app.py", "line": 9999, "type": "SQL_INJECTION"}
    sast_results = [
        {"file": "src/app.py", "vulnerabilities": [finding], "cached": False}
    ]
    state = _make_state(sast_results=sast_results)

    with patch("agent.nodes.validate_findings_node.read_file", new_callable=AsyncMock) as mock_read, \
         patch("agent.nodes.validate_findings_node.save_vulnerabilities", new_callable=AsyncMock):
        mock_read.return_value = python_content
        result = await validate_findings_node(state)

    assert len(result["discarded_findings"]) == 1
    assert len(result["validated_findings"]) == 0


@pytest.mark.asyncio
async def test_validate_node_mixed_findings():
    """실재 finding + 가짜 finding 혼재 → 올바르게 분리."""
    python_content = "def foo():\n    # 주석\n    return 1\n"
    findings = [
        {"file": "src/app.py", "line": 1, "type": "SQL_INJECTION"},  # 실재
        {"file": "src/app.py", "line": 2, "type": "XSS"},             # 주석
        {"file": "src/app.py", "line": 3, "type": "PATH_TRAVERSAL"},  # 실재
    ]
    sast_results = [{"file": "src/app.py", "vulnerabilities": findings, "cached": False}]
    state = _make_state(sast_results=sast_results)

    with patch("agent.nodes.validate_findings_node.read_file", new_callable=AsyncMock) as mock_read, \
         patch("agent.nodes.validate_findings_node.save_vulnerabilities", new_callable=AsyncMock) as mock_save:
        mock_read.return_value = python_content
        result = await validate_findings_node(state)

    assert len(result["validated_findings"]) == 2
    assert len(result["discarded_findings"]) == 1
    # save는 validated만 호출
    mock_save.assert_called_once()
    saved_findings = mock_save.call_args[0][3]  # 4번째 positional arg
    assert len(saved_findings) == 2


@pytest.mark.asyncio
async def test_validate_node_file_read_failure_all_pass_through():
    """파일 읽기 실패 → 모든 findings pass-through (전체 중단 금지)."""
    finding = {"file": "src/app.py", "line": 5, "type": "SQL_INJECTION"}
    sast_results = [{"file": "src/app.py", "vulnerabilities": [finding], "cached": False}]
    state = _make_state(sast_results=sast_results)

    with patch("agent.nodes.validate_findings_node.read_file", new_callable=AsyncMock) as mock_read, \
         patch("agent.nodes.validate_findings_node.save_vulnerabilities", new_callable=AsyncMock) as mock_save:
        mock_read.side_effect = Exception("MCP connection failed")
        result = await validate_findings_node(state)

    # 파일 읽기 실패 → 모두 pass-through
    assert len(result["validated_findings"]) == 1
    assert len(result["discarded_findings"]) == 0
    mock_save.assert_called_once()


@pytest.mark.asyncio
async def test_validate_node_accumulates_across_files():
    """누적: 두 번 호출 시 validated_findings / discarded_findings가 올바르게 누적된다."""
    python_content = "def foo():\n    # 주석\n    return 1\n"
    findings_1 = [{"file": "a.py", "line": 1, "type": "SQL_INJECTION"}]  # 통과
    findings_2 = [{"file": "b.py", "line": 2, "type": "XSS"}]             # 폐기(주석)

    sast_results_1 = [{"file": "a.py", "vulnerabilities": findings_1, "cached": False}]
    state_1 = _make_state(sast_results=sast_results_1)

    with patch("agent.nodes.validate_findings_node.read_file", new_callable=AsyncMock) as mock_read, \
         patch("agent.nodes.validate_findings_node.save_vulnerabilities", new_callable=AsyncMock):
        mock_read.return_value = python_content
        result_1 = await validate_findings_node(state_1)

    # 두 번째 파일 처리
    sast_results_2 = result_1.get("sast_results", sast_results_1) + [
        {"file": "b.py", "vulnerabilities": findings_2, "cached": False}
    ]
    state_2 = _make_state(
        sast_results=sast_results_2,
        validated_findings=result_1.get("validated_findings", []),
        discarded_findings=result_1.get("discarded_findings", []),
    )

    with patch("agent.nodes.validate_findings_node.read_file", new_callable=AsyncMock) as mock_read, \
         patch("agent.nodes.validate_findings_node.save_vulnerabilities", new_callable=AsyncMock):
        mock_read.return_value = python_content
        result_2 = await validate_findings_node(state_2)

    assert len(result_2["validated_findings"]) == 1
    assert len(result_2["discarded_findings"]) == 1


@pytest.mark.asyncio
async def test_validate_node_discarded_finding_not_saved():
    """폐기된 findings는 save_vulnerabilities에 전달되지 않는다 — 가짜인용 0건 DoD."""
    python_content = "# 전체가 주석\n# 두번째 주석\n"
    findings = [
        {"file": "src/app.py", "line": 1, "type": "SQL_INJECTION"},
        {"file": "src/app.py", "line": 2, "type": "XSS"},
    ]
    sast_results = [{"file": "src/app.py", "vulnerabilities": findings, "cached": False}]
    state = _make_state(sast_results=sast_results)

    with patch("agent.nodes.validate_findings_node.read_file", new_callable=AsyncMock) as mock_read, \
         patch("agent.nodes.validate_findings_node.save_vulnerabilities", new_callable=AsyncMock) as mock_save:
        mock_read.return_value = python_content
        result = await validate_findings_node(state)

    # 모두 폐기
    assert len(result["validated_findings"]) == 0
    assert len(result["discarded_findings"]) == 2
    # save_vulnerabilities가 호출되지 않아야 함
    mock_save.assert_not_called()


@pytest.mark.asyncio
async def test_validate_node_java_comment_discarded():
    """Java 주석 라인 finding → discarded."""
    java_content = "public class A {\n    // 주석\n    void run() {}\n}\n"
    finding = {"file": "A.java", "line": 2, "type": "SQL_INJECTION"}
    sast_results = [{"file": "A.java", "vulnerabilities": [finding], "cached": False}]
    state = _make_state(sast_results=sast_results)

    with patch("agent.nodes.validate_findings_node.read_file", new_callable=AsyncMock) as mock_read, \
         patch("agent.nodes.validate_findings_node.save_vulnerabilities", new_callable=AsyncMock) as mock_save:
        mock_read.return_value = java_content
        result = await validate_findings_node(state)

    assert len(result["discarded_findings"]) == 1
    mock_save.assert_not_called()


@pytest.mark.asyncio
async def test_validate_node_unsupported_language_pass_through():
    """미지원 언어(Go) → 모두 pass-through."""
    go_content = "package main\n\nfunc main() {}\n"
    finding = {"file": "main.go", "line": 3, "type": "SQL_INJECTION"}
    sast_results = [{"file": "main.go", "vulnerabilities": [finding], "cached": False}]
    state = _make_state(sast_results=sast_results)

    with patch("agent.nodes.validate_findings_node.read_file", new_callable=AsyncMock) as mock_read, \
         patch("agent.nodes.validate_findings_node.save_vulnerabilities", new_callable=AsyncMock) as mock_save:
        mock_read.return_value = go_content
        result = await validate_findings_node(state)

    # 미지원 언어 → pass-through → validated
    assert len(result["validated_findings"]) == 1
    assert len(result["discarded_findings"]) == 0
    mock_save.assert_called_once()


@pytest.mark.asyncio
async def test_validate_node_sast_results_updated_with_validated_only():
    """sast_results의 마지막 항목의 vulnerabilities가 validated만 포함하도록 갱신된다."""
    python_content = "def foo():\n    # 주석\n    return 1\n"
    findings = [
        {"file": "src/app.py", "line": 1, "type": "SQL_INJECTION"},  # 통과
        {"file": "src/app.py", "line": 2, "type": "XSS"},             # 폐기
    ]
    sast_results = [{"file": "src/app.py", "vulnerabilities": findings, "cached": False}]
    state = _make_state(sast_results=sast_results)

    with patch("agent.nodes.validate_findings_node.read_file", new_callable=AsyncMock) as mock_read, \
         patch("agent.nodes.validate_findings_node.save_vulnerabilities", new_callable=AsyncMock):
        mock_read.return_value = python_content
        result = await validate_findings_node(state)

    # sast_results가 갱신되어 validated만 포함
    assert len(result["sast_results"][0]["vulnerabilities"]) == 1
    assert result["sast_results"][0]["vulnerabilities"][0]["type"] == "SQL_INJECTION"
