from typing import TypedDict


class AgentState(TypedDict):
    # 세션 식별
    session_id: str
    project_id: str
    workspace_root: str

    # 스캔 대상
    files_to_scan: list[str]
    current_file_index: int

    # 노드 간 신호
    cache_hit: bool

    # 누적 결과
    sast_results: list[dict]

    # 세션 상태
    status: str          # running / completed / error
    error_message: str | None
