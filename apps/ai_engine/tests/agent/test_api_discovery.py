"""TASK-1106 — api_discovery_node 정적 파싱/그룹화 검증 (LLM 미사용).

STAGE-3 추가:
- _is_hub_file 휴리스틱 정확성
- 허브 우선 정렬 적용 검증
- 기존 api_groups 회귀 0 (출력계약 불변)
"""
from agent.nodes.api_discovery_node import (
    _is_hub_file,
    discover_api_groups,
)


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


# ── STAGE-3: _is_hub_file 단위 테스트 ──────────────────────────────────────────

class TestIsHubFile:
    """_is_hub_file 휴리스틱 — True/False 분류 정확성."""

    # ── True 케이스 ──────────────────────────────────────────────────────────

    def test_spring_controller_java(self):
        assert _is_hub_file("AuthController.java") is True

    def test_spring_controller_java_with_path(self):
        assert _is_hub_file("src/main/java/io/secureai/auth/AuthController.java") is True

    def test_spring_controller_package_pattern(self):
        assert _is_hub_file("domain/user/controller/UserController.java") is True

    def test_spring_any_java_in_controller_dir(self):
        # **/controller/**.java — 이름이 Controller로 끝나지 않아도 controller/ 패키지면 허브
        assert _is_hub_file("src/main/java/io/secureai/controller/ApiGateway.java") is True

    def test_nextjs_route_ts(self):
        assert _is_hub_file("app/api/users/route.ts") is True

    def test_nextjs_route_tsx(self):
        assert _is_hub_file("src/app/api/auth/[id]/route.tsx") is True

    def test_nextjs_route_js(self):
        assert _is_hub_file("app/api/health/route.js") is True

    def test_ts_api_suffix(self):
        assert _is_hub_file("lib/api.ts") is True

    def test_js_api_suffix(self):
        assert _is_hub_file("src/api.js") is True

    def test_ts_client_suffix(self):
        assert _is_hub_file("src/client.ts") is True

    def test_js_client_suffix(self):
        assert _is_hub_file("utils/client.js") is True

    def test_ts_axios_suffix(self):
        assert _is_hub_file("src/axios.ts") is True

    def test_js_axios_suffix(self):
        assert _is_hub_file("axios.js") is True

    def test_fastapi_routes_directory_py(self):
        assert _is_hub_file("api/routes/analyze.py") is True

    def test_fastapi_routes_nested_py(self):
        assert _is_hub_file("app/api/routes/users.py") is True

    def test_windows_path_separator_normalized(self):
        # 윈도우 경로 구분자도 정규화하여 처리
        assert _is_hub_file("domain\\user\\controller\\UserApi.java") is True

    # ── False 케이스 ────────────────────────────────────────────────────────

    def test_service_java_not_hub(self):
        assert _is_hub_file("AuthService.java") is False

    def test_entity_java_not_hub(self):
        assert _is_hub_file("User.java") is False

    def test_dto_java_not_hub(self):
        assert _is_hub_file("LoginRequest.java") is False

    def test_repository_java_not_hub(self):
        assert _is_hub_file("UserRepository.java") is False

    def test_util_py_not_hub(self):
        assert _is_hub_file("utils.py") is False

    def test_model_py_not_hub(self):
        assert _is_hub_file("models/user.py") is False

    def test_generic_ts_not_hub(self):
        # 단순 컴포넌트 .tsx는 허브 아님
        assert _is_hub_file("components/Button.tsx") is False

    def test_generic_ts_no_api_keyword_not_hub(self):
        assert _is_hub_file("src/hooks/useAuth.ts") is False

    def test_non_route_api_directory_ts_not_hub(self):
        # app/api 경로지만 route.* 파일명 아님 → 허브 아님
        assert _is_hub_file("app/api/utils/helper.ts") is False

    def test_known_false_positive_non_api_route_tsx(self):
        # 알려진 false positive: 비-API 경로의 route.tsx도 **/route.tsx 패턴에 매칭되어 허브로 분류됨.
        # A안에서 무해 — _parse_single_file의 _is_nextjs_route_file(app/api/.../route.*)에서 걸러져
        # api_groups 출력계약에는 영향 없음(읽기 우선순위에만 영향).
        assert _is_hub_file("src/components/route.tsx") is True


# ── STAGE-3: 허브 우선 정렬 적용 검증 ─────────────────────────────────────────

import pytest


@pytest.mark.asyncio
async def test_hub_files_processed_before_non_hub(monkeypatch):
    """api_discovery_node가 허브 파일을 비허브보다 먼저 읽어야 한다."""
    import os
    from agent.nodes.api_discovery_node import api_discovery_node

    read_order: list[str] = []

    def fake_open(path, *args, **kwargs):
        # workspace_root + file_path 를 분리해 파일명만 추적
        read_order.append(os.path.basename(path))
        import io
        return io.StringIO("")

    monkeypatch.setattr("builtins.open", fake_open)

    state = {
        "session_id": "test-hub-order",
        "workspace_root": "",
        "files_to_scan": [
            "utils.py",            # 비허브
            "models/user.py",      # 비허브
            "AuthController.java", # 허브
            "api/routes/auth.py",  # 허브
            "AuthService.java",    # 비허브
        ],
        "file_filter": None,
    }

    await api_discovery_node(state)

    hub_names = {"AuthController.java", "auth.py"}
    non_hub_names = {"utils.py", "user.py", "AuthService.java"}

    # read_order 에서 허브 파일이 모두 비허브보다 앞서 등장해야 한다
    hub_indices = [i for i, name in enumerate(read_order) if name in hub_names]
    non_hub_indices = [i for i, name in enumerate(read_order) if name in non_hub_names]

    assert hub_indices, "허브 파일이 읽혀야 한다"
    assert non_hub_indices, "비허브 파일이 읽혀야 한다"
    assert max(hub_indices) < min(non_hub_indices), (
        f"모든 허브 파일이 비허브보다 먼저 읽혀야 한다. "
        f"read_order={read_order}"
    )


def test_api_groups_unaffected_by_hub_ordering():
    """허브 우선 정렬이 api_groups 출력계약에 영향을 주지 않아야 한다 (회귀 0).

    동일 file_contents를 원래 순서와 허브 우선 정렬 순서로 각각 discover_api_groups에
    전달했을 때 동일한 그룹명·URL 집합을 반환해야 한다.
    """
    files_original_order = {
        "AuthService.java": "public interface AuthService {}",
        "AuthController.java": SPRING_AUTH_CONTROLLER,  # 허브
        "AuthRepository.java": "public interface AuthRepository {}",
    }

    # 허브 우선 순서 (AuthController 먼저)
    files_hub_first_order = {
        "AuthController.java": SPRING_AUTH_CONTROLLER,  # 허브 먼저
        "AuthService.java": "public interface AuthService {}",
        "AuthRepository.java": "public interface AuthRepository {}",
    }

    groups_original = discover_api_groups(files_original_order)
    groups_hub_first = discover_api_groups(files_hub_first_order)

    # 그룹명·URL 집합이 동일해야 한다
    def extract_key_set(groups: list[dict]) -> set[tuple[str, str]]:
        return {(g["name"], g["url"]) for g in groups}

    assert extract_key_set(groups_original) == extract_key_set(groups_hub_first), (
        "허브 우선 정렬 후에도 api_groups의 (name, url) 집합은 동일해야 한다"
    )
