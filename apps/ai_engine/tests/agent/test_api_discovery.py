"""TASK-1106 — api_discovery_node 정적 파싱/그룹화 검증 (LLM 미사용)."""
from agent.nodes.api_discovery_node import discover_api_groups


SPRING_AUTH_CONTROLLER = """
package io.secureai.backend.domain.auth.controller;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    @PostMapping("/login")
    public Object login() { return null; }

    @PostMapping("/register")
    public Object register() { return null; }
}
"""

FASTAPI_ROUTER = """
from fastapi import APIRouter
router = APIRouter()

@router.post("/agent/analyze")
async def analyze(): ...

@router.get("/agent/health")
async def health(): ...
"""


def test_spring_controller_grouped_by_prefix_with_siblings():
    # 같은 prefix(Auth)의 연관 파일이 한 그룹으로 묶여야 한다 (DoD)
    files = {
        "AuthController.java": SPRING_AUTH_CONTROLLER,
        "AuthService.java": "public interface AuthService {}",
        "AuthServiceImpl.java": "public class AuthServiceImpl implements AuthService {}",
        "AuthRepository.java": "public interface AuthRepository {}",
    }
    groups = discover_api_groups(files)
    assert groups, "Spring 컨트롤러에서 api_group이 추출되어야 한다"
    # 그룹명은 prefix 'Auth'
    assert all(g["name"] == "Auth" for g in groups)
    # URL은 클래스 + 메서드 경로 결합
    urls = {g["url"] for g in groups}
    assert "/api/v1/auth/login" in urls and "/api/v1/auth/register" in urls
    # 각 그룹 files에 Controller + Service + ServiceImpl + Repository 가 모두 포함
    paths = {f["path"] for g in groups for f in g["files"]}
    assert {"AuthController.java", "AuthService.java", "AuthServiceImpl.java", "AuthRepository.java"} <= paths


def test_fastapi_router_endpoints_discovered():
    groups = discover_api_groups({"routes/analyze.py": FASTAPI_ROUTER})
    urls = {g["url"] for g in groups}
    assert "/agent/analyze" in urls
    assert "/agent/health" in urls


def test_non_api_file_yields_no_group():
    groups = discover_api_groups({"utils.py": "def helper():\n    return 1\n"})
    assert groups == []


def test_empty_input():
    assert discover_api_groups({}) == []
