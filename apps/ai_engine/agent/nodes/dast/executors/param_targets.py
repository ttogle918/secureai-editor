"""DAST 익스플로잇 주입 대상 파라미터 후보.

api_discovery가 엔드포인트의 파라미터명을 넘기지 않을 때(params={}),
실제 쿼리 파라미터를 모르므로 흔한 이름 후보를 순회 시도한다.
이렇게 하면 /greet?name= , /users/search?q= 처럼 키가 제각각인
엔드포인트에도 페이로드가 올바른 파라미터로 주입된다.
"""

# 흔한 쿼리 파라미터 이름 — params가 비었을 때 주입 대상 후보(순서 = 우선순위)
COMMON_PARAM_KEYS: tuple[str, ...] = (
    "q", "name", "search", "query", "keyword", "input", "text",
    "message", "comment", "id", "user", "username", "host",
    "url", "path", "file", "term", "value",
)


def candidate_param_sets(params: dict, payload: str) -> list[dict]:
    """주입할 파라미터 dict 후보 목록을 만든다.

    - params가 있으면: 제공된 모든 키에 payload를 넣은 dict 1개(기존 동작 유지).
    - params가 비었으면: 흔한 후보 키마다 payload를 넣은 dict들(키당 1개).
    """
    if params:
        return [{k: payload for k in params}]
    return [{key: payload} for key in COMMON_PARAM_KEYS]
