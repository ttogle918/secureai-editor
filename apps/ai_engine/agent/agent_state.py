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

    # API 중심 분석 (TASK-1106) — api_discovery_node 출력 / 선택 분석 입력
    api_groups: list[dict]            # [{name, url, files:[{path, line}]}]
    file_filter: list[str] | None     # None = 전체 분석 (하위 호환)

    # cache_check_node 가 계산한 현재 파일 SHA-256 (sast_node에서 캐시 저장에 재사용)
    current_file_sha256: str | None

    # 노드 간 신호
    cache_hit: bool

    # 누적 결과
    sast_results: list[dict]
    patch_results: list[dict]

    # secret_scan_node 입출력
    commits: list[dict]          # GitHub 커밋 목록 (secret_scan_node 입력)
    secrets_found: list[dict]    # 시크릿 탐지 결과 (secret_scan_node 출력)

    # 진행률 (0.0 ~ 100.0) — SSE 이벤트로 프론트엔드에 전달
    progress_percent: float

    # 스캔 모드 — "AUDIT" (빠른 비용 효율) | "PIPELINE" (고품질 정밀 분석, 기본값)
    scan_mode: str | None

    # 사용자 모델·키 오버라이드 (BYOK)
    preferred_model: str | None
    user_api_key: str | None  # 복호화된 값 (로그 출력 금지)

    # 토큰 사용량 누적 (input, output, cache_creation_input, cache_read_input)
    token_usage: dict

    # 세션 상태
    status: str          # running / completed / error
    error_message: str | None
