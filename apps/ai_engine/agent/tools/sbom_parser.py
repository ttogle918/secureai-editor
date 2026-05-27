"""
SBOM 파서 모음 및 CycloneDX JSON 변환.

지원 형식:
- pom.xml       (Maven)
- package.json  (npm)
- requirements.txt (pip)
- go.mod        (Go modules)

반환 형식: [{"name": str, "version": str | None, "ecosystem": str}]
"""
import json
import logging
import re
import uuid
import xml.etree.ElementTree as ET
from typing import Any

logger = logging.getLogger(__name__)

# 지원하는 파일명 → ecosystem 매핑
_FILENAME_TO_ECOSYSTEM: dict[str, str] = {
    "pom.xml": "maven",
    "package.json": "npm",
    "requirements.txt": "pypi",
    "go.mod": "go",
    "cargo.toml": "cargo",
}

# go.mod require 블록 파싱 패턴
_GO_REQUIRE_INLINE = re.compile(r"^\s*require\s+(\S+)\s+(\S+)")
_GO_REQUIRE_BLOCK_START = re.compile(r"^\s*require\s*\(")
_GO_REQUIRE_BLOCK_ENTRY = re.compile(r"^\s*(\S+)\s+(\S+)")
_GO_REQUIRE_BLOCK_END = re.compile(r"^\s*\)")

# pip requirements.txt 파싱 패턴
_PIP_DEP_PATTERN = re.compile(
    r"^([A-Za-z0-9_\-\.]+)\s*(?:[><=!~^]+\s*([^\s#,;]+))?"
)


def _detect_ecosystem(file_path: str) -> str | None:
    """파일 경로에서 파일명을 추출하고 지원하는 ecosystem을 반환한다."""
    file_name = file_path.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    return _FILENAME_TO_ECOSYSTEM.get(file_name)


def parse_pom_xml(content: str) -> list[dict]:
    """Maven pom.xml 내용을 파싱하여 컴포넌트 목록을 반환한다.

    XXE 방어를 위해 xml.etree.ElementTree(기본 DTD 비활성화)를 사용한다.
    오류 발생 시 경고 로그 후 빈 목록을 반환한다.
    """
    result: list[dict] = []
    try:
        root = ET.fromstring(content)
        # 네임스페이스 제거를 위한 정규화
        ns_pattern = re.compile(r"\{[^}]+\}")

        for dep in root.iter():
            tag = ns_pattern.sub("", dep.tag)
            if tag != "dependency":
                continue

            group_id = None
            artifact_id = None
            version = None

            for child in dep:
                child_tag = ns_pattern.sub("", child.tag)
                text = (child.text or "").strip() or None
                if child_tag == "groupId":
                    group_id = text
                elif child_tag == "artifactId":
                    artifact_id = text
                elif child_tag == "version":
                    version = text

            if not artifact_id:
                continue

            name = f"{group_id}:{artifact_id}" if group_id else artifact_id
            result.append({"name": name, "version": version, "ecosystem": "maven"})

    except ET.ParseError as exc:
        logger.warning("[sbom-parser] pom.xml 파싱 실패: %s", exc)
    except Exception as exc:
        logger.warning("[sbom-parser] pom.xml 처리 중 오류: %s", exc)

    return result


def parse_package_json(content: str) -> list[dict]:
    """npm package.json 내용을 파싱하여 컴포넌트 목록을 반환한다.

    dependencies (isDirect=True) 와 devDependencies (isDirect=False) 를 모두 수집한다.
    오류 발생 시 경고 로그 후 빈 목록을 반환한다.
    """
    result: list[dict] = []
    try:
        data = json.loads(content)
        for section in ("dependencies", "devDependencies", "peerDependencies"):
            deps = data.get(section)
            if not isinstance(deps, dict):
                continue
            for name, version_spec in deps.items():
                version = _clean_npm_version(version_spec) if isinstance(version_spec, str) else None
                result.append({"name": name, "version": version, "ecosystem": "npm"})
    except json.JSONDecodeError as exc:
        logger.warning("[sbom-parser] package.json JSON 파싱 실패: %s", exc)
    except Exception as exc:
        logger.warning("[sbom-parser] package.json 처리 중 오류: %s", exc)

    return result


def _clean_npm_version(spec: str) -> str | None:
    """npm 버전 스펙에서 ^, ~, >=, 공백 등을 제거하고 순수 버전 문자열을 반환한다."""
    stripped = spec.strip().lstrip("^~>=<")
    return stripped if stripped else None


def parse_requirements_txt(content: str) -> list[dict]:
    """pip requirements.txt 내용을 파싱하여 컴포넌트 목록을 반환한다.

    주석 라인(#)과 옵션 플래그(-r, -c 등)는 건너뛴다.
    오류 발생 시 경고 로그 후 빈 목록을 반환한다.
    """
    result: list[dict] = []
    try:
        for raw_line in content.splitlines():
            line = _strip_comment(raw_line).strip()
            if not line or line.startswith("-"):
                continue

            match = _PIP_DEP_PATTERN.match(line)
            if not match:
                continue

            name = match.group(1)
            version = match.group(2) or None
            result.append({"name": name, "version": version, "ecosystem": "pypi"})

    except Exception as exc:
        logger.warning("[sbom-parser] requirements.txt 처리 중 오류: %s", exc)

    return result


def _strip_comment(line: str) -> str:
    idx = line.find("#")
    return line[:idx] if idx >= 0 else line


def parse_go_mod(content: str) -> list[dict]:
    """Go go.mod 내용을 파싱하여 컴포넌트 목록을 반환한다.

    require 블록과 인라인 require 구문을 모두 처리한다.
    // indirect 주석이 있는 간접 의존성도 포함한다.
    오류 발생 시 경고 로그 후 빈 목록을 반환한다.
    """
    result: list[dict] = []
    try:
        in_require_block = False

        for raw_line in content.splitlines():
            line = raw_line.strip()

            if not in_require_block:
                # 인라인 require
                m = _GO_REQUIRE_INLINE.match(line)
                if m:
                    result.append({
                        "name": m.group(1),
                        "version": m.group(2),
                        "ecosystem": "go",
                    })
                    continue

                # require 블록 시작
                if _GO_REQUIRE_BLOCK_START.match(line):
                    in_require_block = True
                    continue
            else:
                # 블록 끝
                if _GO_REQUIRE_BLOCK_END.match(line):
                    in_require_block = False
                    continue

                # 주석 제거
                clean = _strip_comment(line).strip()
                if not clean:
                    continue

                m = _GO_REQUIRE_BLOCK_ENTRY.match(clean)
                if m:
                    result.append({
                        "name": m.group(1),
                        "version": m.group(2),
                        "ecosystem": "go",
                    })

    except Exception as exc:
        logger.warning("[sbom-parser] go.mod 처리 중 오류: %s", exc)

    return result


def parse_cargo_toml(content: str) -> list[dict]:
    """Cargo.toml 내용을 파싱하여 컴포넌트 목록을 반환한다.

    [dependencies] 및 [dev-dependencies] 섹션을 처리한다.

    지원 형식:
    - 인라인 버전:   serde = "1.0"
    - 상세 버전:     serde = { version = "1.0", features = ["derive"] }
    - 경로/git 의존성은 버전 없이 이름만 포함한다.

    오류 발생 시 경고 로그 후 빈 목록을 반환한다.
    """
    result: list[dict] = []
    try:
        # 파싱 대상 섹션: [dependencies], [dev-dependencies]
        _CARGO_SECTION = re.compile(
            r"^\s*\[((?:dev-)?dependencies)\]", re.IGNORECASE
        )
        # 인라인 버전: name = "1.0" 또는 name = '1.0'
        _CARGO_INLINE_VER = re.compile(
            r"""^\s*([A-Za-z0-9_\-]+)\s*=\s*["']([^"']+)["']"""
        )
        # 상세 버전: name = { version = "1.0", ... }
        _CARGO_TABLE_VER = re.compile(
            r"""^\s*([A-Za-z0-9_\-]+)\s*=\s*\{[^}]*version\s*=\s*["']([^"']+)["'][^}]*\}"""
        )
        # 이름만 있는 테이블(경로/git 의존성 등): name = { path = "..." }
        _CARGO_TABLE_NAME = re.compile(
            r"""^\s*([A-Za-z0-9_\-]+)\s*=\s*\{"""
        )

        in_dep_section = False

        for raw_line in content.splitlines():
            line = raw_line.strip()

            # 빈 줄이나 주석은 건너뜀
            if not line or line.startswith("#"):
                continue

            # 섹션 헤더 감지
            sec_match = _CARGO_SECTION.match(line)
            if sec_match:
                in_dep_section = True
                continue

            # 다른 섹션 시작 시 의존성 섹션 종료
            if line.startswith("[") and not _CARGO_SECTION.match(line):
                in_dep_section = False
                continue

            if not in_dep_section:
                continue

            # 주석 제거 후 파싱
            clean = _strip_comment(line).strip()
            if not clean:
                continue

            # 상세 버전 테이블 (version 필드 포함)
            table_ver_match = _CARGO_TABLE_VER.match(clean)
            if table_ver_match:
                result.append({
                    "name": table_ver_match.group(1),
                    "version": table_ver_match.group(2),
                    "ecosystem": "cargo",
                })
                continue

            # 인라인 버전
            inline_match = _CARGO_INLINE_VER.match(clean)
            if inline_match:
                result.append({
                    "name": inline_match.group(1),
                    "version": inline_match.group(2),
                    "ecosystem": "cargo",
                })
                continue

            # 테이블이지만 version 없는 경우 (path/git 의존성)
            table_name_match = _CARGO_TABLE_NAME.match(clean)
            if table_name_match:
                result.append({
                    "name": table_name_match.group(1),
                    "version": None,
                    "ecosystem": "cargo",
                })

    except Exception as exc:
        logger.warning("[sbom-parser] Cargo.toml 처리 중 오류: %s", exc)

    return result


def parse_file(file_name: str, content: str) -> list[dict]:
    """파일명에 따라 적절한 파서를 선택하여 컴포넌트 목록을 반환한다.

    지원하지 않는 파일명이면 빈 목록을 반환하고 경고를 기록한다.
    """
    # 경로에서 파일명만 추출
    name = file_name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    parser_map = {
        "pom.xml": parse_pom_xml,
        "package.json": parse_package_json,
        "requirements.txt": parse_requirements_txt,
        "go.mod": parse_go_mod,
        "cargo.toml": parse_cargo_toml,
    }
    parser = parser_map.get(name.lower()) or parser_map.get(name)
    if parser is None:
        logger.warning("[sbom-parser] 지원하지 않는 파일: %s", file_name)
        return []
    return parser(content)


def to_cyclonedx(components: list[dict], cve_matches: list[dict]) -> dict:
    """컴포넌트 목록과 CVE 매칭 결과를 CycloneDX 1.4 BOM JSON 포맷으로 변환한다.

    최소 필드: bomFormat, specVersion, serialNumber, version, components, vulnerabilities

    Args:
        components: parse_* 함수가 반환하는 컴포넌트 목록
        cve_matches: match_cve 함수가 반환하는 CVE 매칭 결과 목록

    Returns:
        CycloneDX 1.4 포맷 딕셔너리
    """
    bom_components: list[dict[str, Any]] = []
    component_ref_map: dict[str, str] = {}

    for comp in components:
        ref = f"pkg:{comp.get('ecosystem', 'generic')}/{comp['name']}"
        if comp.get("version"):
            ref += f"@{comp['version']}"

        component_ref_map[comp["name"]] = ref

        entry: dict[str, Any] = {
            "type": "library",
            "bom-ref": ref,
            "name": comp["name"],
        }
        if comp.get("version"):
            entry["version"] = comp["version"]

        bom_components.append(entry)

    vulnerabilities: list[dict[str, Any]] = []
    for match in cve_matches:
        comp_info = match.get("component", {})
        cve_list = match.get("cves", [])
        comp_ref = component_ref_map.get(comp_info.get("name", ""), "")

        for cve in cve_list:
            vuln_entry: dict[str, Any] = {
                "id": cve.get("cveId", ""),
                "description": cve.get("description", ""),
            }
            if comp_ref:
                vuln_entry["affects"] = [{"ref": comp_ref}]

            ratings: list[dict] = []
            if cve.get("cvssScore") is not None:
                ratings.append({
                    "score": cve["cvssScore"],
                    "severity": (cve.get("severity") or "unknown").lower(),
                    "vector": cve.get("cvssVector"),
                })
            if ratings:
                vuln_entry["ratings"] = ratings

            vulnerabilities.append(vuln_entry)

    return {
        "bomFormat": "CycloneDX",
        "specVersion": "1.4",
        "serialNumber": f"urn:uuid:{uuid.uuid4()}",
        "version": 1,
        "components": bom_components,
        "vulnerabilities": vulnerabilities,
    }
