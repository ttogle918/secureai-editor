"""
validate_findings_node — 결정론적 AST 할루시네이션 가드 노드 (VAL-3).

그래프 위치: sast_node(또는 cache_check_node 캐시 히트 경로) → validate_findings_node → next_file_node

책임:
  - 현재 파일 분석 결과(sast_results 마지막 항목)의 findings를 검증
  - verified=True → validated_findings 이동 (이후 persist에서 save_vulnerabilities 호출)
  - verified=False → discarded_findings 이동 (미저장, 할루시네이션 차단)
  - 폐기 건수를 Prometheus 카운터로 기록 (VC 숫자: 가짜인용 차단 수)

설계 원칙:
  - 결정론적 (LLM 미사용 — 비용 0, 재현성 100%)
  - 개별 finding 오류가 전체 분석을 중단하지 않음 (skip & log)
  - 불확실 시 통과 (recall 보호 최우선)
"""
import logging
import os

from prometheus_client import Counter

from agent.agent_state import AgentState
from agent.tools.mcp_filesystem_tools import read_file
from agent.tools.mcp_github_tools import get_github_file_content
from agent.validation.ast_verifier import verify_finding
from infrastructure.backend_api_client import save_vulnerabilities

logger = logging.getLogger(__name__)

# Prometheus 카운터 — 할루시네이션 차단 건수 (VC 숫자)
_discarded_counter = Counter(
    "secureai_hallucination_discarded_total",
    "Number of findings discarded by the AST hallucination guard",
    ["session_id"],
)

# 확장자 → 언어명 매핑 (ast_verifier 언어 파라미터)
_EXT_TO_LANGUAGE: dict[str, str] = {
    ".py": "python",
    ".java": "java",
    ".kt": "kotlin",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
}


def _detect_language(file_path: str) -> str:
    """파일 경로에서 언어를 감지한다. 미지원 확장자는 빈 문자열 반환."""
    ext = os.path.splitext(file_path)[1].lower()
    return _EXT_TO_LANGUAGE.get(ext, "")


async def validate_findings_node(state: AgentState) -> dict:
    """sast_results 마지막 항목의 findings를 결정론적으로 검증한다.

    캐시 히트 결과와 신규 분석 결과 모두 이 노드를 경유한다.
    verified=True만 이후 persist 노드에서 save_vulnerabilities로 저장된다.

    Returns:
        dict with:
            validated_findings: list[dict] — 검증 통과 결과 (누적)
            discarded_findings: list[dict] — 검증 실패 결과 (누적, 미저장)
    """
    session_id = state["session_id"]
    sast_results: list[dict] = state.get("sast_results", [])

    if not sast_results:
        logger.debug("[validate_findings] session=%s no sast_results to validate", session_id)
        return {}

    # 현재 파일 = sast_results 마지막 항목 (방금 추가된 결과)
    current_result = sast_results[-1]
    file_path: str = current_result.get("file", "")
    findings: list[dict] = current_result.get("vulnerabilities", [])

    logger.info(
        "[validate_findings] session=%s file=%s findings=%d",
        session_id, file_path, len(findings),
    )

    # 파일 내용 읽기 — 검증에 필요 (실패 시 모두 pass-through)
    file_content = await _fetch_file_content(state, file_path, session_id)

    language = _detect_language(file_path)
    validated: list[dict] = []
    discarded: list[dict] = []

    for finding in findings:
        try:
            result = verify_finding(
                finding=finding,
                file_content=file_content,
                language=language,
            )
            if result["verified"]:
                validated.append(finding)
            else:
                discarded.append({**finding, "_discard_reason": result["reason"]})
                logger.info(
                    "[validate_findings] DISCARD session=%s file=%s line=%s type=%s reason=%s",
                    session_id, file_path,
                    finding.get("line"), finding.get("type"),
                    result["reason"],
                )
        except Exception as exc:
            # 개별 finding 오류 → pass-through (전체 중단 금지)
            logger.warning(
                "[validate_findings] skip finding session=%s file=%s line=%s: %s",
                session_id, file_path, finding.get("line"), exc,
            )
            validated.append(finding)

    discarded_count = len(discarded)
    if discarded_count > 0:
        _discarded_counter.labels(session_id=session_id).inc(discarded_count)
        logger.info(
            "[validate_findings] session=%s file=%s discarded=%d verified=%d",
            session_id, file_path, discarded_count, len(validated),
        )

    # sast_results 마지막 항목의 vulnerabilities를 검증 통과 목록으로 교체
    # (이후 aggregate_node, patch_node가 sast_results를 참조하므로 일관성 유지)
    updated_result = {**current_result, "vulnerabilities": validated}
    updated_sast_results = sast_results[:-1] + [updated_result]

    # 검증 통과 findings만 Backend에 저장 (save 이관 — sast_node에서 제거됨)
    # 캐시 히트(current_result["cached"]=True)든 신규 분석이든 동일하게 처리
    if validated:
        try:
            await save_vulnerabilities(session_id, state["project_id"], file_path, validated)
        except Exception as exc:
            logger.error(
                "[validate_findings] save_vulnerabilities failed session=%s file=%s: %s",
                session_id, file_path, exc,
            )
            # 저장 실패는 검증 결과에 영향 없음 — 상태는 그대로 진행
    else:
        logger.info(
            "[validate_findings] session=%s file=%s no validated findings to save",
            session_id, file_path,
        )

    prev_validated: list[dict] = state.get("validated_findings", [])
    prev_discarded: list[dict] = state.get("discarded_findings", [])

    return {
        "sast_results": updated_sast_results,
        "validated_findings": prev_validated + validated,
        "discarded_findings": prev_discarded + discarded,
        "current_file_content": None,
    }


async def _fetch_file_content(state: AgentState, file_path: str, session_id: str) -> str:
    """소스 타입(local/github)에 따라 파일 내용을 읽어 반환한다.

    읽기 실패 시 빈 문자열을 반환하고 findings를 모두 pass-through 처리한다.
    (개별 파일 오류로 전체 분석 중단 금지)
    """
    if not file_path:
        return ""

    content = state.get("current_file_content")
    if content is not None:
        return content

    try:
        source_type = state.get("source_type", "local")
        if source_type == "github":
            return await get_github_file_content(
                session_id,
                state["github_owner"],
                state["github_repo"],
                file_path,
                state.get("github_ref"),
                state.get("github_token"),
            )
        return await read_file(session_id, file_path)
    except Exception as exc:
        logger.warning(
            "[validate_findings] file read failed session=%s file=%s: %s — pass-through all findings",
            session_id, file_path, exc,
        )
        return ""
