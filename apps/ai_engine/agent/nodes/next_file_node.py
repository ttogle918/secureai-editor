from agent.agent_state import AgentState


async def next_file_node(state: AgentState) -> dict:
    """파일 인덱스를 1 증가시키고 캐시 관련 임시 필드를 초기화한다."""
    return {
        "current_file_index": state["current_file_index"] + 1,
        "current_file_sha256": None,
        "cache_hit": False,
    }
