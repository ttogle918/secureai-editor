"""
TASK-206 통합 테스트 — AsyncPostgresSaver 실동작 검증.

실 PostgreSQL 연결이 필요하다. 연결 불가 시 전체 스킵.

로컬 (postgres 없음) : 자동 스킵
Docker 컨테이너 실행 : docker exec secureai-ai-engine python -m pytest tests/integration/ -v

검증 항목:
  1. 그래프 실행 후 체크포인트가 DB에 저장됨
  2. thread_id(=session_id) 격리 — 두 세션의 체크포인트 섞이지 않음
  3. interrupt_after 중단 → 재개 시 나머지 노드만 실행 (핵심: 분석 재개 시나리오)
  4. 완료된 스레드 재개 → 추가 실행 없음
"""
import uuid
import pytest
import pytest_asyncio
from typing import TypedDict

from langgraph.graph import END, StateGraph

try:
    from psycopg_pool import AsyncConnectionPool
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    _HAS_DEPS = True
except ImportError:
    _HAS_DEPS = False


# ---------------------------------------------------------------------------
# 헬퍼
# ---------------------------------------------------------------------------

def _tid(prefix: str) -> str:
    """테스트마다 고유한 thread_id를 생성한다. 실 데이터와 충돌 방지."""
    return f"integ-{prefix}-{uuid.uuid4().hex[:8]}"


def _build_counter_graph(checkpointer, *, interrupt_after=None):
    """
    단계별 카운터 그래프.

    step_one(count +1, visited += ["step_one"])
      → step_two(count +10, visited += ["step_two"])
      → END
    """
    class CounterState(TypedDict):
        count: int
        visited: list

    def step_one(state: CounterState) -> dict:
        return {
            "count": state["count"] + 1,
            "visited": list(state.get("visited", [])) + ["step_one"],
        }

    def step_two(state: CounterState) -> dict:
        return {
            "count": state["count"] + 10,
            "visited": list(state.get("visited", [])) + ["step_two"],
        }

    builder = StateGraph(CounterState)
    builder.add_node("step_one", step_one)
    builder.add_node("step_two", step_two)
    builder.set_entry_point("step_one")
    builder.add_edge("step_one", "step_two")
    builder.add_edge("step_two", END)

    compile_kwargs = {"checkpointer": checkpointer}
    if interrupt_after:
        compile_kwargs["interrupt_after"] = interrupt_after
    return builder.compile(**compile_kwargs)


async def _run_all(graph, initial_state, config) -> list[str]:
    """그래프를 끝까지 실행하고 방문한 노드 이름 목록을 반환한다."""
    visited = []
    async for event in graph.astream(initial_state, config):
        visited.append(next(iter(event)))
    return visited


async def _resume_all(graph, config) -> list[str]:
    """체크포인트에서 재개하여 방문한 노드 이름 목록을 반환한다."""
    visited = []
    async for event in graph.astream(None, config):
        visited.append(next(iter(event)))
    return visited


# ---------------------------------------------------------------------------
# 픽스처
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def saver():
    """
    실 PostgreSQL에 연결된 AsyncPostgresSaver를 제공한다.

    연결 실패(postgres 미실행, 패키지 미설치) 시 테스트를 스킵한다.
    """
    if not _HAS_DEPS:
        pytest.skip("psycopg_pool 미설치 — requirements.txt 확인")

    from config.settings import settings

    pool = None
    instance = None
    try:
        pool = AsyncConnectionPool(
            conninfo=settings.postgres_url,
            min_size=1,
            max_size=3,
            kwargs={"autocommit": True},
            open=False,
        )
        await pool.open(timeout=3)
        await pool.wait(timeout=3)  # 실제 연결 수립 대기 (미연결 시 즉시 실패)
        instance = AsyncPostgresSaver(pool)
        await instance.setup()
    except Exception as exc:
        if pool is not None:
            await pool.close()
        pytest.skip(f"PostgreSQL 연결 불가 (Docker 환경에서 실행하세요): {exc}")

    yield instance

    await pool.close()


# ---------------------------------------------------------------------------
# 테스트 1: 실행 후 체크포인트 DB 저장 확인
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_checkpoint_saved_after_run(saver):
    """그래프를 완전히 실행하면 최종 상태가 DB에 저장돼야 한다."""
    graph = _build_counter_graph(saver)
    config = {"configurable": {"thread_id": _tid("save")}}

    visited = await _run_all(graph, {"count": 0, "visited": []}, config)
    assert visited == ["step_one", "step_two"]

    ct = await saver.aget_tuple(config)
    assert ct is not None, "그래프 완료 후 체크포인트가 DB에 없음"

    values = ct.checkpoint.get("channel_values", {})
    assert values.get("count") == 11,     f"count 기대 11, 실제 {values.get('count')}"
    assert values.get("visited") == ["step_one", "step_two"]


# ---------------------------------------------------------------------------
# 테스트 2: thread_id 격리 — 두 세션의 체크포인트 섞이지 않음
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_thread_id_isolation(saver):
    """서로 다른 session_id는 독립된 체크포인트를 가져야 한다."""
    graph = _build_counter_graph(saver)

    cfg_a = {"configurable": {"thread_id": _tid("iso-a")}}
    cfg_b = {"configurable": {"thread_id": _tid("iso-b")}}

    await _run_all(graph, {"count": 5,  "visited": []}, cfg_a)
    await _run_all(graph, {"count": 99, "visited": []}, cfg_b)

    ct_a = await saver.aget_tuple(cfg_a)
    ct_b = await saver.aget_tuple(cfg_b)

    count_a = ct_a.checkpoint["channel_values"]["count"]
    count_b = ct_b.checkpoint["channel_values"]["count"]

    assert count_a == 16,  f"세션 A: 5+1+10=16 이어야 하는데 {count_a}"
    assert count_b == 110, f"세션 B: 99+1+10=110 이어야 하는데 {count_b}"
    assert count_a != count_b, "두 세션의 체크포인트 값이 같으면 격리 실패"


# ---------------------------------------------------------------------------
# 테스트 3: interrupt_after 중단 → 재개 시 나머지 노드만 실행
#
# 핵심 시나리오: AI Agent 프로세스가 step_one 완료 직후 재시작됐을 때,
# 재개 시 step_one이 재실행되지 않고 step_two부터 진행되어야 한다.
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_resume_runs_only_remaining_nodes(saver):
    """interrupt_after=["step_one"] 로 중단 후 재개 시 step_two만 실행돼야 한다."""
    graph = _build_counter_graph(saver, interrupt_after=["step_one"])
    config = {"configurable": {"thread_id": _tid("resume")}}

    # 1차 실행: step_one에서 자동 중단
    first_nodes = []
    async for event in graph.astream({"count": 0, "visited": []}, config):
        first_nodes.append(next(iter(event)))

    assert first_nodes == ["step_one"], \
        f"interrupt_after 설정 시 step_one에서 멈춰야 함. 실제: {first_nodes}"

    ct_mid = await saver.aget_tuple(config)
    assert ct_mid is not None
    assert ct_mid.checkpoint["channel_values"]["count"] == 1, \
        "중단 지점에서 step_one만 반영됐어야 함"

    # 2차 실행 (재개): step_two만 실행돼야 함
    second_nodes = []
    async for event in graph.astream(None, config):
        second_nodes.append(next(iter(event)))

    assert "step_one" not in second_nodes, \
        f"재개 시 이미 완료된 step_one이 재실행되면 안 됨. 실행된 노드: {second_nodes}"
    assert "step_two" in second_nodes, \
        f"재개 시 step_two가 실행돼야 함. 실행된 노드: {second_nodes}"

    ct_final = await saver.aget_tuple(config)
    final_values = ct_final.checkpoint["channel_values"]
    assert final_values["count"] == 11, f"최종 count 기대 11, 실제 {final_values['count']}"
    assert final_values["visited"] == ["step_one", "step_two"]


# ---------------------------------------------------------------------------
# 테스트 4: 완료된 스레드 재개 → 추가 실행 없음
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_resume_of_completed_thread_is_noop(saver):
    """이미 END 상태인 스레드를 재개해도 노드가 다시 실행되지 않아야 한다."""
    graph = _build_counter_graph(saver)
    config = {"configurable": {"thread_id": _tid("done")}}

    await _run_all(graph, {"count": 0, "visited": []}, config)

    count_before = (await saver.aget_tuple(config)).checkpoint["channel_values"]["count"]

    # 재개 시도 — 아무 이벤트도 발행되지 않아야 함
    resume_events = []
    async for event in graph.astream(None, config):
        resume_events.append(event)

    assert len(resume_events) == 0, \
        f"완료된 그래프를 재개하면 이벤트가 없어야 함. 실제: {resume_events}"

    count_after = (await saver.aget_tuple(config)).checkpoint["channel_values"]["count"]
    assert count_before == count_after, "재개 후 상태가 변경되면 안 됨"
