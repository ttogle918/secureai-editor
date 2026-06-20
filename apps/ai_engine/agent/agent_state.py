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

    # VAL-3: 결정론적 검증 레이어 결과
    # validated_findings: 검증 통과 finding 목록 (save_vulnerabilities 대상)
    # discarded_findings: 검증 실패 finding 목록 (미저장, 할루시네이션 차단)
    validated_findings: list[dict]
    discarded_findings: list[dict]

    # secret_scan_node 입출력
    commits: list[dict]          # GitHub 커밋 목록 (secret_scan_node 입력)
    secrets_found: list[dict]    # 시크릿 탐지 결과 (secret_scan_node 출력)

    # 진행률 (0.0 ~ 100.0) — SSE 이벤트로 프론트엔드에 전달
    progress_percent: float

    # 스캔 모드 — "AUDIT" (빠른 비용 효율) | "PIPELINE" (고품질 정밀 분석, 기본값)
    scan_mode: str | None

    # 플래닝 모드 — "DETERMINISTIC" (토큰 0, 결정론적) | "LLM" (Claude 그룹핑)
    planning_mode: str | None

    # planning_node 출력 — [{stage_no, name, files:[경로...], reason}]
    stages: list[dict]

    # 사용자 모델·키·프로바이더 오버라이드 (BYOK + 멀티-프로바이더 COST-4)
    preferred_model: str | None
    user_api_key: str | None      # 복호화된 값 (로그 출력 금지)
    preferred_provider: str | None  # "anthropic" | "gemini" | "openai" | None

    # 토큰 사용량 누적 (input, output, cache_creation_input, cache_read_input)
    token_usage: dict

    # 실제 분석에 사용된 모델/프로바이더 (sast_node가 provider 결정 후 기록)
    # completed 이벤트에 포함되어 FE에 정확한 모델/비용 표시에 활용된다.
    resolved_model: str | None
    resolved_provider: str | None

    # STAGE-2: 사용자 컨펌 게이트
    # True = 사용자가 계획을 확인하고 분석 재개를 승인함
    # planning_node interrupt 후 /agent/confirm 으로 설정
    confirmed: bool

    # 세션 상태
    status: str          # running / completed / error
    error_message: str | None
