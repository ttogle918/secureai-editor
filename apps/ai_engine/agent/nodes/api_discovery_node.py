"""
api_discovery_node — LLM 없이 정적 파싱으로 API 엔드포인트를 발견한다.

지원 프레임워크:
- Spring: @GetMapping, @PostMapping, @PutMapping, @DeleteMapping, @PatchMapping, @RequestMapping
- FastAPI: @router.get, @router.post, @router.put, @router.delete, @router.patch
- Next.js: app/api/**/route.ts 파일 (export async function GET/POST/PUT/DELETE/PATCH)
- React/TypeScript: axios.get/post/put/delete/patch 호출 (api.ts, client.ts 등)

출력: api_groups: [{name, url, files:[{path, line}]}]
파싱 실패 파일은 skip & log (전체 세션 실패 금지).
"""
import logging
import os
import re
from pathlib import Path

from agent.agent_state import AgentState

logger = logging.getLogger(__name__)

# ── 정규식 상수 ──────────────────────────────────────────────────────────────

# Spring @*Mapping 어노테이션: @GetMapping("/path"), @RequestMapping(value="/path", ...)
_SPRING_MAPPING_RE = re.compile(
    r'@(?:Get|Post|Put|Delete|Patch|Request)Mapping\s*\(\s*'
    r'(?:value\s*=\s*)?'
    r'"([^"]+)"',
    re.MULTILINE,
)

# FastAPI @router.* 데코레이터: @router.get("/path"), @router.post("/path", ...)
_FASTAPI_ROUTER_RE = re.compile(
    r'@router\.(get|post|put|delete|patch)\s*\(\s*"([^"]+)"',
    re.MULTILINE,
)

# Next.js route.ts export: export async function GET/POST/PUT/DELETE/PATCH
_NEXTJS_EXPORT_RE = re.compile(
    r'export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)',
    re.MULTILINE,
)

# React/TS axios 호출: axios.get('/api/...')
_AXIOS_CALL_RE = re.compile(
    r'axios\.(get|post|put|delete|patch)\s*\(\s*[\'"]([^\'"]+)[\'"]',
    re.MULTILINE,
)

# Python import 추적 (depth-1): from .xyz import YYY 또는 import xyz
_PYTHON_IMPORT_RE = re.compile(
    r'^(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))',
    re.MULTILINE,
)

# Java import 추적 (depth-1)
_JAVA_IMPORT_RE = re.compile(
    r'^import\s+([\w.]+);',
    re.MULTILINE,
)

# 그룹화 접미어 패턴 (Controller/Service/ServiceImpl/Repository/Mapper 우선순위 순)
_GROUP_SUFFIXES = [
    "Controller",
    "ServiceImpl",
    "Service",
    "Repository",
    "Mapper",
]

# 파일 이름으로 그룹명(접두사) 결정하는 패턴 — 접미사 앞 prefix만 캡처
# 예: AuthController/AuthService/AuthServiceImpl/AuthRepository/AuthMapper → "Auth"
_GROUP_SUFFIX_RE = re.compile(
    r'^([A-Za-z]+?)(?:Controller|ServiceImpl|Service|Repository|Mapper)$'
)


def _extract_group_name(file_path: str) -> str:
    """파일 경로에서 그룹명(접두사)을 추출한다.

    *Controller / *ServiceImpl / *Service / *Repository / *Mapper 의 접두사를 그룹명으로 사용.
    (예: AuthController → "Auth") 해당하지 않으면 파일명(확장자 제외)을 반환한다.
    """
    stem = Path(file_path).stem
    match = _GROUP_SUFFIX_RE.search(stem)
    if match:
        return match.group(1)
    return stem


def _parse_spring_file(file_path: str, content: str) -> list[dict]:
    """Spring Java 파일에서 API 엔드포인트를 추출한다."""
    findings = []
    lines = content.splitlines()

    # 클래스 레벨 @RequestMapping prefix 추출
    class_prefix = ""
    class_mapping_match = re.search(
        r'@RequestMapping\s*\(\s*(?:value\s*=\s*)?"([^"]+)"',
        content,
    )
    if class_mapping_match:
        class_prefix = class_mapping_match.group(1).rstrip("/")

    for line_no, line in enumerate(lines, start=1):
        method_match = re.search(
            r'@(?:Get|Post|Put|Delete|Patch)Mapping\s*\(\s*(?:value\s*=\s*)?"([^"]+)"',
            line,
        )
        if method_match:
            url = class_prefix + method_match.group(1)
            findings.append({"url": url, "line": line_no})

    return findings


def _parse_fastapi_file(file_path: str, content: str) -> list[dict]:
    """FastAPI Python 파일에서 API 엔드포인트를 추출한다."""
    findings = []
    lines = content.splitlines()

    for line_no, line in enumerate(lines, start=1):
        match = _FASTAPI_ROUTER_RE.search(line)
        if match:
            url = match.group(2)
            findings.append({"url": url, "line": line_no})

    return findings


def _parse_nextjs_route_file(file_path: str, content: str) -> list[dict]:
    """Next.js app/api/**/route.ts 파일에서 HTTP 메서드를 추출한다.

    URL은 파일 경로에서 추론한다.
    app/api/users/[id]/route.ts → /api/users/{id}
    """
    # 경로에서 URL 추출: app/api/xxx/yyy/route.ts → /api/xxx/yyy
    # [param] → {param} 변환
    path_obj = Path(file_path)
    parts = path_obj.parts

    url_parts: list[str] = []
    in_api = False
    for part in parts:
        if part == "api":
            in_api = True
            url_parts.append("api")
        elif in_api and part not in ("route.ts", "route.tsx", "route.js"):
            # Next.js dynamic segment: [id] → {id}, [...slug] → {slug}
            converted = re.sub(r"\[\.\.\.(\w+)\]", r"{\1}", part)
            converted = re.sub(r"\[(\w+)\]", r"{\1}", converted)
            url_parts.append(converted)

    base_url = "/" + "/".join(url_parts) if url_parts else file_path

    findings = []
    lines = content.splitlines()

    for line_no, line in enumerate(lines, start=1):
        match = _NEXTJS_EXPORT_RE.search(line)
        if match:
            findings.append({"url": base_url, "line": line_no})

    return findings


def _parse_axios_file(file_path: str, content: str) -> list[dict]:
    """React/TS 파일에서 axios API 호출을 추출한다."""
    findings = []
    lines = content.splitlines()

    for line_no, line in enumerate(lines, start=1):
        match = _AXIOS_CALL_RE.search(line)
        if match:
            url = match.group(2)
            findings.append({"url": url, "line": line_no})

    return findings


def _is_spring_file(file_path: str, content: str) -> bool:
    """Spring Controller/Service/Repository/Mapper Java 파일 여부."""
    if not file_path.endswith(".java"):
        return False
    # @*Mapping 또는 @RestController / @Controller 어노테이션 포함 여부
    return bool(
        re.search(r'@(?:Rest)?Controller|@(?:Get|Post|Put|Delete|Patch|Request)Mapping', content)
    )


def _is_fastapi_file(file_path: str, content: str) -> bool:
    """FastAPI router 파일 여부."""
    if not file_path.endswith(".py"):
        return False
    return bool(re.search(r'@router\.(get|post|put|delete|patch)', content))


def _is_nextjs_route_file(file_path: str) -> bool:
    """Next.js app/api route 파일 여부."""
    normalized = file_path.replace("\\", "/")
    return bool(
        re.search(r'app/api/.+/route\.(ts|tsx|js)$', normalized)
    )


def _is_axios_file(file_path: str, content: str) -> bool:
    """axios 호출을 포함하는 TypeScript/JavaScript 파일 여부."""
    if not any(file_path.endswith(ext) for ext in (".ts", ".tsx", ".js", ".jsx")):
        return False
    return bool(_AXIOS_CALL_RE.search(content))


def _collect_depth1_imports(file_path: str, content: str, visited: set[str]) -> set[str]:
    """depth-1 import 추적으로 참조 파일 경로를 수집한다.

    순환 참조 방어: visited set으로 이미 처리한 파일 제외.
    """
    refs: set[str] = set()
    base_dir = str(Path(file_path).parent)

    if file_path.endswith(".java"):
        for match in _JAVA_IMPORT_RE.finditer(content):
            fqn = match.group(1)
            # 같은 패키지 내 클래스만 추적
            refs.add(fqn)
    elif file_path.endswith(".py"):
        for match in _PYTHON_IMPORT_RE.finditer(content):
            module = match.group(1) or match.group(2)
            if module:
                refs.add(module)

    # visited set에 현재 파일 추가 (순환 방어)
    visited.add(file_path)
    return refs - visited


def _parse_single_file(file_path: str, content: str) -> list[dict]:
    """단일 파일에서 API 엔드포인트 목록을 추출한다.

    반환: [{url, line}]
    """
    if _is_spring_file(file_path, content):
        return _parse_spring_file(file_path, content)
    if _is_fastapi_file(file_path, content):
        return _parse_fastapi_file(file_path, content)
    if _is_nextjs_route_file(file_path):
        return _parse_nextjs_route_file(file_path, content)
    if _is_axios_file(file_path, content):
        return _parse_axios_file(file_path, content)
    return []


def discover_api_groups(
    file_contents: dict[str, str],
) -> list[dict]:
    """파일 내용 맵에서 API 그룹 목록을 생성한다.

    Args:
        file_contents: {파일경로: 파일내용} 딕셔너리

    Returns:
        api_groups: [{name, url, files:[{path, line}]}]
        파싱 실패 파일은 skip & log.
    """
    # 그룹명 → {url → [{path, line}]} 매핑
    group_map: dict[str, dict[str, list[dict]]] = {}
    visited: set[str] = set()

    for file_path, content in file_contents.items():
        if file_path in visited:
            continue

        try:
            endpoints = _parse_single_file(file_path, content)
            visited.add(file_path)

            if not endpoints:
                continue

            group_name = _extract_group_name(file_path)

            if group_name not in group_map:
                group_map[group_name] = {}

            for ep in endpoints:
                url = ep["url"]
                line = ep["line"]
                if url not in group_map[group_name]:
                    group_map[group_name][url] = []
                group_map[group_name][url].append({"path": file_path, "line": line})

        except Exception as exc:
            # 개별 파일 파싱 실패 — skip & log (전체 세션 실패 금지)
            logger.warning("[api_discovery] skip file=%s error=%s", file_path, exc)
            continue

    # 같은 prefix(그룹명)의 연관 파일(*Service/*ServiceImpl/*Repository/*Mapper 등) 수집.
    # 엔드포인트가 없어도 동일 그룹에 묶어 분석 대상으로 노출 (예: AuthController → AuthService/AuthRepository).
    group_siblings: dict[str, list[str]] = {}
    for file_path in file_contents:
        gname = _extract_group_name(file_path)
        if gname in group_map:
            group_siblings.setdefault(gname, []).append(file_path)

    # group_map → api_groups 변환 (엔드포인트 파일 + 연관 파일 병합)
    api_groups: list[dict] = []
    for group_name, url_map in group_map.items():
        siblings = sorted(group_siblings.get(group_name, []))
        for url, file_refs in url_map.items():
            ref_paths = {f["path"] for f in file_refs}
            merged = list(file_refs) + [
                {"path": p, "line": 1} for p in siblings if p not in ref_paths
            ]
            api_groups.append({
                "name": group_name,
                "url": url,
                "files": merged,
            })

    return api_groups


async def api_discovery_node(state: AgentState) -> dict:
    """scan_files_node 이후 실행되는 API 엔드포인트 발견 노드.

    LLM 없이 정적 파싱으로 API 그룹을 생성한다.
    파싱 실패 시 빈 api_groups를 반환하고 세션을 계속 진행한다 (skip-and-continue).

    State 출력:
    - api_groups: [{name, url, files:[{path, line}]}]
    """
    session_id = state.get("session_id", "unknown")
    workspace_root = state.get("workspace_root", "")
    files_to_scan = state.get("files_to_scan", [])
    file_filter = state.get("file_filter")

    logger.info(
        "[api_discovery] session=%s workspace=%s total_files=%d",
        session_id, workspace_root, len(files_to_scan),
    )

    # fileFilter 적용: 필터 있으면 해당 파일만 대상
    target_files = files_to_scan
    if file_filter:
        filter_set = set(file_filter)
        target_files = [f for f in files_to_scan if f in filter_set]
        logger.info(
            "[api_discovery] session=%s file_filter applied: %d/%d files",
            session_id, len(target_files), len(files_to_scan),
        )

    file_contents: dict[str, str] = {}
    for file_path in target_files:
        # 절대 경로 구성
        if workspace_root and not os.path.isabs(file_path):
            abs_path = os.path.join(workspace_root, file_path)
        else:
            abs_path = file_path

        try:
            with open(abs_path, encoding="utf-8", errors="replace") as f:
                file_contents[file_path] = f.read()
        except Exception as exc:
            # 읽기 실패 — skip & log
            logger.warning("[api_discovery] skip read file=%s error=%s", file_path, exc)
            continue

    try:
        api_groups = discover_api_groups(file_contents)
        logger.info(
            "[api_discovery] session=%s discovered %d api_groups",
            session_id, len(api_groups),
        )
    except Exception as exc:
        # 발견 전체 실패 — 빈 목록으로 계속 진행
        logger.error("[api_discovery] session=%s discovery failed: %s", session_id, exc)
        api_groups = []

    return {"api_groups": api_groups}
