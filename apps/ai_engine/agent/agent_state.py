from typing import TypedDict


class AgentState(TypedDict):
    # 세션 식별
    session_id: str
    project_id: str
    workspace_root: str

    # 소스 타입 분기 — "local" | "github"
    source_type: str

    # GitHub 연동 정보 (source_type="github" 일 때만 사용)
    github_owner: str | None
    github_repo: str | None
    github_ref: str | None
    github_token: str | None  # 복호화된 값 (로그 출력 금지)

    # 스캔 대상
    files_to_scan: list[str]
    current_file_index: int

    # cache_check_node 가 계산한 현재 파일 SHA-256 (sast_node에서 캐시 저장에 재사용)
    current_file_sha256: str | None

    # 노드 간 신호
    cache_hit: bool

    # 누적 결과
    sast_results: list[dict]

    # 진행률 (0.0 ~ 100.0) — SSE 이벤트로 프론트엔드에 전달
    progress_percent: float

    # 세션 상태
    status: str          # running / completed / error
    error_message: str | None
