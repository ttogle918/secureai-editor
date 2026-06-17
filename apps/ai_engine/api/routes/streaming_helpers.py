"""
STAGE-2 FAIL-3: 순환 임포트 해소를 위한 공유 스트리밍 헬퍼 모듈.

analyze.py와 confirm.py가 공통으로 사용하는 함수·상태를 여기에 두고
각 모듈 상단에서 임포트한다. confirm.py가 함수 본문에서 analyze.py를
런타임 임포트하던 패턴을 제거한다.

공개 인터페이스:
  _cancel_flags              — 세션 취소 플래그 딕셔너리 (singleton)
  _publish_confirmation_events(publish, full_state)
  _handle_node_event(publish, node_name, state, last_stage_no, session_id, cancel_flags)
  _update_last_stage_no(node_name, state, last_stage_no)
"""
import logging

logger = logging.getLogger(__name__)


# ── 세션 취소 플래그 (모듈 싱글턴) ─────────────────────────────────────────────
# analyze.py, confirm.py 양쪽이 동일 dict 객체를 참조해야 취소 신호가 전달된다.
_cancel_flags: dict[str, bool] = {}


# ── 내부 stage 유틸 ────────────────────────────────────────────────────────────

def _find_stage_for_file(file_path: str, stages: list[dict]) -> dict | None:
    """파일이 속한 stage를 반환한다. 없으면 None."""
    for stage in stages:
        if file_path in stage.get("files", []):
            return stage
    return None


async def _emit_stage_events(
    publish,
    file_path: str,
    stages: list[dict],
    last_stage_no: int | None,
) -> int | None:
    """파일의 stage가 직전과 달라지면 stage_started 이벤트를 발행한다.

    Returns:
        현재 stage_no (이벤트 발행 여부와 무관하게 최신값 반환)
    """
    if not stages:
        return last_stage_no

    stage = _find_stage_for_file(file_path, stages)
    if stage is None:
        return last_stage_no

    current_stage_no = stage.get("stage_no")
    if current_stage_no != last_stage_no:
        await publish(
            "stage_started",
            stage_no=current_stage_no,
            name=stage.get("name"),
            total_in_stage=len(stage.get("files", [])),
        )
    return current_stage_no


def _get_stage_files(stages: list[dict], stage_no: int) -> list[str]:
    """stage_no에 해당하는 파일 목록을 반환한다. stage가 없으면 빈 목록."""
    for stage in stages:
        if stage.get("stage_no") == stage_no:
            return list(stage.get("files", []))
    return []


def _is_stage_completed(
    files: list[str],
    stages: list[dict],
    next_idx: int,
    last_stage_no: int,
) -> bool:
    """next_file_node 이후 stage 완료 여부를 판정한다.

    다음 처리 파일(next_idx)의 stage가 last_stage_no와 다르거나
    파일이 소진됐으면 stage 완료로 간주한다.
    """
    if next_idx >= len(files):
        return True
    next_file = files[next_idx]
    next_stage = _find_stage_for_file(next_file, stages)
    if next_stage is None:
        return False
    return next_stage.get("stage_no") != last_stage_no


# ── 공개 헬퍼 ─────────────────────────────────────────────────────────────────

async def _publish_confirmation_events(publish, full_state: dict) -> None:
    """GraphInterrupt 후 stage_plan + awaiting_confirmation 이벤트를 발행한다.

    stage_plan: 진행바 초기화용(file_count 요약)
    awaiting_confirmation: 컨펌모달 렌더용(files 상세 포함)
    두 역할을 분리하여 프론트엔드가 각각 처리할 수 있도록 한다.
    """
    stages: list[dict] = full_state.get("stages", [])
    await publish(
        "stage_plan",
        stages=[
            {
                "stage_no": s.get("stage_no"),
                "name": s.get("name"),
                "file_count": len(s.get("files", [])),
            }
            for s in stages
        ],
    )
    await publish(
        "awaiting_confirmation",
        stages=[
            {
                "stage_no": s.get("stage_no"),
                "name": s.get("name"),
                "file_count": len(s.get("files", [])),
                "files": s.get("files", []),
            }
            for s in stages
        ],
    )


async def _handle_node_event(
    publish,
    node_name: str,
    state: dict,
    last_stage_no: int | None,
    session_id: str,
    cancel_flags: dict,
) -> None:
    """노드 이벤트를 처리해 Redis에 진행 이벤트를 발행한다."""
    if node_name == "scan_files_node":
        files = state.get("files_to_scan", [])
        await publish("scan_complete", total=len(files), files=files)

    elif node_name == "api_discovery_node":
        await publish("api_plan", api_groups=state.get("api_groups", []))

    elif node_name == "planning_node":
        # interrupt 없는 일반 모드에서만 도달. interrupt 모드는 GraphInterrupt catch로 처리.
        stages = state.get("stages", [])
        await publish(
            "stage_plan",
            stages=[
                {
                    "stage_no": s.get("stage_no"),
                    "name": s.get("name"),
                    "file_count": len(s.get("files", [])),
                }
                for s in stages
            ],
        )

    elif node_name == "cache_check_node":
        idx = state.get("current_file_index", 0)
        files = state.get("files_to_scan", [])
        stages = state.get("stages", [])
        file_path = files[idx] if idx < len(files) else ""
        hit = state.get("cache_hit", False)
        await _emit_stage_events(publish, file_path, stages, last_stage_no)
        await publish(
            "progress",
            node="cache_check",
            phase="checking",
            file=file_path,
            current=idx + 1,
            total=len(files),
            cache_hit=hit,
        )

    elif node_name == "sast_node":
        idx = state.get("current_file_index", 0)
        files = state.get("files_to_scan", [])
        file_path = files[idx] if idx < len(files) else ""
        await publish(
            "progress",
            node="sast",
            phase="done",
            file=file_path,
            current=idx + 1,
            total=len(files),
        )

    elif node_name == "next_file_node":
        files = state.get("files_to_scan", [])
        stages = state.get("stages", [])
        next_idx = state.get("current_file_index", 0)
        if last_stage_no is not None:
            completed = _is_stage_completed(files, stages, next_idx, last_stage_no)
            if completed:
                stage_files = _get_stage_files(stages, last_stage_no)
                await publish(
                    "stage_completed",
                    stage_no=last_stage_no,
                    files=stage_files,
                )

    elif node_name == "aggregate_node":
        results = state.get("sast_results", [])
        vuln_count = sum(len(r.get("vulnerabilities", [])) for r in results)
        await publish("progress", node="aggregate", vuln_count=vuln_count)

    elif node_name == "patch_node":
        results = state.get("sast_results", [])
        vuln_count = sum(len(r.get("vulnerabilities", [])) for r in results)
        token_usage = state.get("token_usage", {})
        await publish("completed", vuln_count=vuln_count, results=results, token_usage=token_usage)


def _update_last_stage_no(
    node_name: str,
    state: dict,
    last_stage_no: int | None,
) -> int | None:
    """cache_check_node 이벤트에서 last_stage_no를 갱신한다."""
    if node_name != "cache_check_node":
        return last_stage_no
    idx = state.get("current_file_index", 0)
    files = state.get("files_to_scan", [])
    stages = state.get("stages", [])
    file_path = files[idx] if idx < len(files) else ""
    if not stages or not file_path:
        return last_stage_no
    stage = _find_stage_for_file(file_path, stages)
    if stage is None:
        return last_stage_no
    return stage.get("stage_no", last_stage_no)
