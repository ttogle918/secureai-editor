"""
planning_node — api_groups를 기반으로 분석 순서(stages)를 결정한다.

DETERMINISTIC 모드: api_groups의 name별로 파일을 묶어 stage 생성. 토큰 0.
LLM 모드          : Claude에게 파일 목록 + api_groups 요약을 주어 stage 배치를 요청.
                    실패·파싱오류 시 DETERMINISTIC으로 자동 fallback (세션 실패 금지).

출력 state 변경:
- stages         : [{stage_no, name, files:[경로...], reason}]
- files_to_scan  : stage 순서대로 평탄화한 리스트 (중복 제거, 원본 파일 보존)

보안:
- LLM이 반환한 경로는 원본 files_to_scan 집합(화이트리스트)에 속하는 것만 허용한다.
  LLM이 "../../../etc/passwd" 같은 외부 경로를 삽입해도 필터링된다.

idempotent:
- LangGraph resume 시 이 노드가 재실행되더라도, 이미 stages가 설정된 상태이면
  재계획/재정렬/current_file_index 리셋을 하지 않고 no-op 반환한다.
  이로써 체크포인트의 current_file_index와 files_to_scan이 보존된다.
"""
import json
import logging
from typing import Any

from agent.agent_state import AgentState

logger = logging.getLogger(__name__)

# ── 상수 ─────────────────────────────────────────────────────────────────────

_STAGE_OTHER_NAME = "공통/기타"
_PLANNING_MODE_DETERMINISTIC = "DETERMINISTIC"
_PLANNING_MODE_LLM = "LLM"

_LLM_MAX_TOKENS = 2048
_LLM_SYSTEM_PROMPT = """\
You are a security analysis planner. Given a list of source files and API groups,
group the files into analysis stages ordered by security relevance.
Each stage should focus on a related API or domain.
Respond ONLY with valid JSON — no markdown, no explanation:
{
  "stages": [
    {"stage_no": 1, "name": "Auth", "files": ["path/to/file.java"], "reason": "..."},
    ...
  ]
}
Rules:
- Every file in the input MUST appear in exactly one stage.
- stage_no starts at 1 and increments by 1.
- Keep related files (same API group) in the same stage.
- If a file does not belong to any API group, put it in the last stage named "공통/기타".
"""


# ── DETERMINISTIC 그룹핑 ──────────────────────────────────────────────────────

def _build_deterministic_stages(
    api_groups: list[dict],
    files_to_scan: list[str],
) -> list[dict]:
    """api_groups의 name별로 파일을 묶어 stage를 생성한다.

    1. api_groups 등장 순서를 기준으로 name → 파일 집합 매핑.
    2. api_groups에 포함되지 않은 나머지 파일은 마지막 _STAGE_OTHER_NAME stage.
    3. 모든 files_to_scan 파일이 정확히 하나의 stage에 속하도록 보장.
    """
    name_to_files: dict[str, list[str]] = {}
    name_order: list[str] = []

    for group in api_groups:
        name = group.get("name", "")
        if not name:
            continue
        if name not in name_to_files:
            name_to_files[name] = []
            name_order.append(name)
        for file_ref in group.get("files", []):
            path = file_ref.get("path", "") if isinstance(file_ref, dict) else file_ref
            if path and path not in name_to_files[name]:
                name_to_files[name].append(path)

    assigned: set[str] = {p for paths in name_to_files.values() for p in paths}
    others = [f for f in files_to_scan if f not in assigned]

    stages: list[dict] = []
    stage_no = 1
    for name in name_order:
        stage_files = [f for f in name_to_files[name] if f in set(files_to_scan)]
        if not stage_files:
            continue
        stages.append({
            "stage_no": stage_no,
            "name": name,
            "files": stage_files,
            "reason": "API group based grouping",
        })
        stage_no += 1

    if others:
        stages.append({
            "stage_no": stage_no,
            "name": _STAGE_OTHER_NAME,
            "files": others,
            "reason": "Files not associated with any API group",
        })

    if not stages and files_to_scan:
        stages.append({
            "stage_no": 1,
            "name": _STAGE_OTHER_NAME,
            "files": list(files_to_scan),
            "reason": "No API groups found — all files in single stage",
        })

    return stages


def _flatten_stages_to_files(stages: list[dict]) -> list[str]:
    """stages 순서대로 파일 경로를 평탄화한다. 중복은 첫 번째 등장을 유지."""
    seen: set[str] = set()
    result: list[str] = []
    for stage in sorted(stages, key=lambda s: s.get("stage_no", 0)):
        for f in stage.get("files", []):
            if f not in seen:
                seen.add(f)
                result.append(f)
    return result


def _ensure_all_files_covered(
    stages: list[dict],
    files_to_scan: list[str],
) -> list[dict]:
    """stages에 포함되지 않은 파일을 마지막 _STAGE_OTHER_NAME stage에 보충한다."""
    covered: set[str] = {f for s in stages for f in s.get("files", [])}
    missing = [f for f in files_to_scan if f not in covered]
    if not missing:
        return stages

    last_other = next(
        (s for s in reversed(stages) if s.get("name") == _STAGE_OTHER_NAME),
        None,
    )
    if last_other is not None:
        last_other["files"].extend(missing)
    else:
        next_no = max((s.get("stage_no", 0) for s in stages), default=0) + 1
        stages.append({
            "stage_no": next_no,
            "name": _STAGE_OTHER_NAME,
            "files": missing,
            "reason": "Supplemented missing files",
        })
    return stages


def _filter_to_whitelist(stages: list[dict], whitelist: set[str]) -> list[dict]:
    """각 stage의 files에서 화이트리스트(원본 files_to_scan)에 없는 경로를 제거한다.

    보안 목적: LLM이 "../../../etc/passwd" 같은 외부 경로를 응답에 삽입해도
    원본 files_to_scan 집합에 속하지 않으면 폐기된다.
    DETERMINISTIC 모드에도 동일하게 적용할 수 있으나, DETERMINISTIC은
    files_to_scan에서 직접 경로를 가져오므로 이미 안전하다.
    """
    filtered: list[dict] = []
    for stage in stages:
        safe_files = [f for f in stage.get("files", []) if f in whitelist]
        if safe_files:
            filtered.append({**stage, "files": safe_files})
    return filtered


# ── LLM 그룹핑 ───────────────────────────────────────────────────────────────

def _build_api_groups_summary(api_groups: list[dict]) -> str:
    """api_groups를 LLM에 전달할 간결한 텍스트로 변환한다."""
    if not api_groups:
        return "(no API groups found)"
    lines: list[str] = []
    for g in api_groups[:30]:  # 과도한 컨텍스트 방지
        name = g.get("name", "?")
        url = g.get("url", "?")
        files = [
            (f.get("path", "") if isinstance(f, dict) else f)
            for f in g.get("files", [])
        ][:5]
        lines.append(f"- {name} | {url} | files: {', '.join(files)}")
    return "\n".join(lines)


async def _request_llm_stages(
    files_to_scan: list[str],
    api_groups: list[dict],
    model: str | None,
    api_key: str | None,
) -> tuple[list[dict], dict]:
    """Claude에 stage 배치를 요청하고 (raw stages, token_usage)를 반환한다.

    파싱 오류나 네트워크 오류는 호출 측에서 처리한다.
    """
    from agent.claude_client import _get_client
    from config.settings import settings

    client = _get_client(api_key)
    effective_model = model or settings.pipeline_model

    api_summary = _build_api_groups_summary(api_groups)
    file_list_text = "\n".join(f"- {f}" for f in files_to_scan[:200])

    user_message = (
        f"Files to scan ({len(files_to_scan)} total):\n{file_list_text}\n\n"
        f"API Groups:\n{api_summary}\n\n"
        "Group these files into analysis stages."
    )

    response = await client.messages.create(
        model=effective_model,
        max_tokens=_LLM_MAX_TOKENS,
        system=[
            {
                "type": "text",
                "text": _LLM_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_message}],
    )

    raw_text = response.content[0].text
    u = response.usage
    usage = {
        "input_tokens": u.input_tokens,
        "output_tokens": u.output_tokens,
        "cache_creation_input_tokens": getattr(u, "cache_creation_input_tokens", 0) or 0,
        "cache_read_input_tokens": getattr(u, "cache_read_input_tokens", 0) or 0,
    }

    parsed = json.loads(raw_text)
    stages: list[dict] = parsed["stages"]
    return stages, usage


# ── 메인 노드 ─────────────────────────────────────────────────────────────────

async def planning_node(state: AgentState) -> dict:
    """api_discovery_node 이후 실행. files_to_scan을 stage 순으로 재정렬한다.

    - DETERMINISTIC: api_groups 기반 결정론적 그룹핑 (토큰 0)
    - LLM: Claude 호출, 실패 시 DETERMINISTIC fallback

    idempotent(resume 안전):
        LangGraph resume 시 이 노드가 재실행되더라도, state.stages가 이미
        설정돼 있으면 재계획/재정렬/current_file_index 리셋을 하지 않고
        no-op({})을 반환한다. 이로써 체크포인트에 저장된
        current_file_index와 files_to_scan이 그대로 보존되어 중복 스캔이 방지된다.

    보안(경로순회 방어):
        LLM 모드에서 LLM이 반환한 stage.files는 원본 files_to_scan 집합
        (화이트리스트)에 속하는 경로만 허용한다. 화이트리스트 밖 경로는
        _filter_to_whitelist()에서 폐기된다. _ensure_all_files_covered 보완
        후에도 동일 화이트리스트를 재적용하여 누락 보완 시 외부 경로가
        섞이지 않도록 보장한다.
    """
    session_id = state.get("session_id", "unknown")
    files_to_scan: list[str] = state.get("files_to_scan") or []
    api_groups: list[dict] = state.get("api_groups") or []
    planning_mode: str = state.get("planning_mode") or _PLANNING_MODE_DETERMINISTIC

    _EMPTY_USAGE: dict[str, Any] = {
        "input_tokens": 0, "output_tokens": 0,
        "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
    }

    # ── idempotent: resume 시 재실행돼도 기존 계획을 덮어쓰지 않는다 ──────────
    # stages가 이미 설정된 상태이면 재계획과 current_file_index 리셋을 건너뛴다.
    # 이 분기는 LangGraph가 체크포인트에서 재개할 때 planning_node가 다시
    # 실행되더라도 이미 처리한 파일 인덱스가 0으로 되돌아가는 것을 방지한다.
    existing_stages: list[dict] = state.get("stages") or []
    if existing_stages:
        logger.info(
            "[planning] session=%s no-op (stages already set, count=%d) — resume safe",
            session_id, len(existing_stages),
        )
        return {}

    logger.info(
        "[planning] session=%s mode=%s files=%d api_groups=%d",
        session_id, planning_mode, len(files_to_scan), len(api_groups),
    )

    # 화이트리스트: 원본 files_to_scan에 있는 경로만 허용 (경로순회 방어)
    whitelist: set[str] = set(files_to_scan)

    stages: list[dict] = []
    plan_usage: dict = dict(_EMPTY_USAGE)

    if planning_mode == _PLANNING_MODE_LLM and files_to_scan:
        try:
            preferred_model = state.get("preferred_model")
            user_api_key = state.get("user_api_key")
            stages, plan_usage = await _request_llm_stages(
                files_to_scan, api_groups, preferred_model, user_api_key
            )
            # 보안: LLM 반환 경로 중 화이트리스트 밖 경로 제거
            stages = _filter_to_whitelist(stages, whitelist)
            # 누락 파일 보완 (보완 출처는 whitelist = files_to_scan이므로 안전)
            stages = _ensure_all_files_covered(stages, files_to_scan)
            logger.info("[planning] session=%s LLM stages=%d", session_id, len(stages))
        except Exception as exc:
            logger.warning(
                "[planning] session=%s LLM failed, fallback to DETERMINISTIC: %s",
                session_id, exc,
            )
            stages = []
            plan_usage = dict(_EMPTY_USAGE)

    if not stages:
        # DETERMINISTIC은 files_to_scan에서 직접 경로를 가져오므로 이미 안전하다.
        stages = _build_deterministic_stages(api_groups, files_to_scan)
        logger.info("[planning] session=%s DETERMINISTIC stages=%d", session_id, len(stages))

    ordered_files = _flatten_stages_to_files(stages)

    # files_to_scan에 있었지만 stages에 누락된 파일을 보완 (방어 코드)
    # 보완 출처가 원본 files_to_scan이므로 경로순회 위험 없음
    covered = set(ordered_files)
    for f in files_to_scan:
        if f not in covered:
            ordered_files.append(f)

    prev_usage = state.get("token_usage") or dict(_EMPTY_USAGE)
    merged_usage = {k: prev_usage.get(k, 0) + plan_usage.get(k, 0) for k in _EMPTY_USAGE}

    return {
        "stages": stages,
        "files_to_scan": ordered_files,
        "current_file_index": 0,
        "token_usage": merged_usage,
    }
