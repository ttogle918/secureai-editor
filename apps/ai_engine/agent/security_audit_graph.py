"""
보안 감사 그래프의 노드 함수 모음.
각 노드는 AgentState를 받아 부분 업데이트 dict를 반환한다.
실제 MCP / Claude 연동은 TASK-202에서 각 nodes/ 모듈로 분리된다.
"""

import logging
from typing import Literal

from agent.agent_state import AgentState

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 노드 함수
# ---------------------------------------------------------------------------

async def scan_files_node(state: AgentState) -> dict:
    """workspace_root에서 스캔 대상 파일 목록을 수집한다."""
    logger.info("[scan_files] session=%s root=%s", state["session_id"], state["workspace_root"])
    # TASK-202에서 MCP list_directory / search_files 호출로 교체
    return {
        "files_to_scan": state.get("files_to_scan", []),
        "current_file_index": 0,
        "status": "running",
    }


async def cache_check_node(state: AgentState) -> dict:
    """현재 파일의 SHA-256 해시를 Redis에서 조회한다."""
    idx = state["current_file_index"]
    file_path = state["files_to_scan"][idx]
    logger.info("[cache_check] session=%s file=%s", state["session_id"], file_path)
    # TASK-202에서 Redis 조회 로직으로 교체
    return {"cache_hit": False}


async def sast_node(state: AgentState) -> dict:
    """Claude + MCP를 사용해 현재 파일의 SAST 분석을 수행한다."""
    idx = state["current_file_index"]
    file_path = state["files_to_scan"][idx]
    logger.info("[sast] session=%s file=%s", state["session_id"], file_path)
    # TASK-202에서 실제 분석 로직으로 교체
    new_result = {"file": file_path, "vulnerabilities": []}
    return {"sast_results": state.get("sast_results", []) + [new_result]}


async def next_file_node(state: AgentState) -> dict:
    """파일 인덱스를 1 증가시킨다."""
    return {"current_file_index": state["current_file_index"] + 1}


async def aggregate_node(state: AgentState) -> dict:
    """모든 파일 분석이 끝난 후 최종 집계를 수행한다."""
    total_vulns = sum(
        len(r.get("vulnerabilities", [])) for r in state.get("sast_results", [])
    )
    logger.info(
        "[aggregate] session=%s total_files=%d total_vulns=%d",
        state["session_id"],
        len(state.get("files_to_scan", [])),
        total_vulns,
    )
    return {"status": "completed"}


# ---------------------------------------------------------------------------
# 조건부 엣지 함수
# ---------------------------------------------------------------------------

def route_after_scan(state: AgentState) -> Literal["cache_check_node", "__end__"]:
    """스캔 대상 파일이 없으면 바로 종료한다."""
    if not state.get("files_to_scan"):
        return "__end__"
    return "cache_check_node"


def route_after_cache(state: AgentState) -> Literal["next_file_node", "sast_node"]:
    """캐시 히트 시 SAST를 건너뛴다."""
    if state.get("cache_hit"):
        return "next_file_node"
    return "sast_node"


def route_after_next(state: AgentState) -> Literal["cache_check_node", "aggregate_node"]:
    """처리할 파일이 남아 있으면 루프, 없으면 집계로 이동한다."""
    idx = state["current_file_index"]
    if idx < len(state.get("files_to_scan", [])):
        return "cache_check_node"
    return "aggregate_node"
