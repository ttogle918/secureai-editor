"""DAST LangGraph 그래프 상태 정의."""
from typing import TypedDict


class DastState(TypedDict):
    session_id: str
    vuln_id: str
    vuln_type: str        # SQL_INJECTION | XSS | IDOR | SSRF | AUTH_BYPASS
    target_url: str       # 로그 출력 금지
    endpoint: str
    params: dict
    retry_count: int
    max_retries: int      # 항상 3
    exploit_outcome: dict | None   # ExploitOutcome 내용을 dict로
    dast_guidelines: str  # 벡터 검색으로 가져온 관련 지침
    status: str           # running | success | failed | timeout
    log_messages: list[str]  # SSE로 보낼 로그 줄 목록
