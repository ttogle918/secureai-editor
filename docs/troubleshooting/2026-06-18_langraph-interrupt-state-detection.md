# LangGraph interrupt 상태 미감지 트러블슈팅 기록

**날짜**: 2026-06-18  
**브랜치**: `feat/sprint12C-stage2-plan-confirm-gate`  
**관련 커밋**: `c36a479`

---

## 이슈 1 — 컨펌 게이트 분석 시작 시 사용자 컨펌 모달이 나타나지 않는 경우

### 증상

- TC-01(컨펌 게이트 분석 시작) 수동 E2E 검증 중 반복 재현
- 분석 시작 시 planning_node 이후 interrupt_after로 멈춰서 사용자 컨펌 모달을 띄워야 함
- 그래프가 interrupt 상태로 진입하지 않고 astream 루프를 **정상 종료**해버려, awaiting_confirmation 이벤트가 발행되지 않음
- 결과: 백엔드 분석 세션 상태가 PLANNING에서 진행되지 않음 (모달 미표시)

### 원인 분석

LangGraph의 interrupt 메커니즘이 두 가지 경로로 표출될 수 있음을 발견:

1. **expected path**: planning_node에서 NodeInterrupt 발생 → astream에서 GraphInterrupt 예외 발생 → except 블록에서 AWAITING_CONFIRMATION 이벤트 발행 ✓

2. **edge case** (미처리): planning_node에서 interrupt 설정되어 있으나, astream 루프가 정상적으로 모든 노드를 순회 후 종료되는 경우, **GraphInterrupt 예외가 발생하지 않음**. 대신 그래프 상태(state.next)에 다음 실행 대기 노드가 남아 있음.
   - 기존 코드: except GraphInterrupt 경로에만 의존 → 이 경우를 처리하지 못함
   - 결과: awaiting_confirmation 이벤트 미발행

### 해결

**apps/ai_engine/api/routes/analyze.py** — _run_analysis / _run_resume 양쪽 적용

```python
# astream 루프 종료 직후 (except GraphInterrupt 외부)
async for output in graph.astream(...):
    # ...

# 루프 정상 종료 후, 추가 확인
state = await graph.aget_state(config)
if state.next:  # 다음 노드가 있으면 interrupt 대기 상태
    event = AnalysisEvent(
        event_type="awaiting_confirmation",
        session_id=session_id,
        ...
    )
    await event_store.append(event)
    return result
```

동작:
- 루프 종료 후 state.next를 확인해 interrupt 대기 노드가 있는지 검증
- 있으면 awaiting_confirmation 이벤트 발행 → 사용자 컨펌 모달 트리거
- GraphInterrupt 예외 경로(except 블록)와 상호배타적으로 작동 (둘 다 이벤트 발행하지 않도록)

### 검증

- TC-01 반복 실행 (5회+): 모달 일관되게 나타남 ✓
- TC-02~TC-04 (분석 완료·보안문제·에러): 영향 없음 ✓
- TC-08~TC-09 (회귀): 통과 ✓

---

## 이슈 2 — DefaultAiAgentClient confirmPlanFallback 응답 보안 처리

### 증상

- TC-07(빈 스테이지 검증) 실행 시 AI Engine이 400 Bad Request 반환
- 기존 코드: 응답 본문 전체를 raw string으로 BusinessException(INVALID_INPUT)에 전파
- 보안 문제: 향후 detail 필드에 내부경로/스택트레이스가 들어오면 사용자 에러 메시지로 노출

### 원인 분석

general.md "에러 처리" 규칙 위반:
> 사용자에게 노출되는 에러 메시지에 스택 트레이스/내부 경로 포함 금지

기존 구현:
```java
throw new BusinessException(
    ErrorCode.INVALID_INPUT,
    hcee.getResponseBodyAsString()  // raw 응답 본문
);
```

문제: AI Engine 응답이 이미 구조화되어 있어도 검증 없이 그대로 전파.

### 해결

**apps/backend/.../DefaultAiAgentClient.java** — confirmPlanFallback 메서드

```java
try {
    // detail 필드만 파싱 추출
    ObjectMapper mapper = new ObjectMapper();
    JsonNode root = mapper.readTree(hcee.getResponseBodyAsString());
    String detail = root.path("detail").asText(null);
    
    // detail 추출 성공 → 상세 메시지 전파
    if (detail != null) {
        throw new BusinessException(ErrorCode.INVALID_INPUT, detail);
    }
    // detail 없거나 파싱 실패 → 기본 메시지로 폴백
    throw new BusinessException(ErrorCode.INVALID_INPUT);
} catch (JsonProcessingException e) {
    // JSON 파싱 실패 → 기본 메시지로 폴백
    throw new BusinessException(ErrorCode.INVALID_INPUT);
}
```

동작:
- detail 필드만 선택적으로 추출 (구조화된 응답 가정)
- 파싱 실패/detail 없음 → ErrorCode 기본 메시지로 폴백
- 검증 → compileJava 통과

### 검증

- TC-07 (빈 스테이지 400 응답): 정상 처리 ✓
- TC-05~TC-09: 영향 없음 ✓

---

## 부수 이슈 3 — status 컬럼 길이 부족

### 증상

- AWAITING_CONFIRMATION (21자)이 analysis_sessions.status VARCHAR(20)에 맞지 않음

### 해결

**V059__alter_analysis_sessions_status_varchar.sql** (신규 마이그레이션)
```sql
ALTER TABLE analysis_sessions ALTER COLUMN status TYPE VARCHAR(50);
```

---

## 부수 이슈 4 — Redis DB 인덱스 분리

### 증상

- 로컬 개발 환경에서 Redis 기본 DB(0) 사용
- 배포 환경과 설정 불일치

### 해결

**apps/backend/src/main/resources/application.yaml**
```yaml
redis:
  database: ${REDIS_DATABASE:1}
```

- 로컬: REDIS_DATABASE=1 (또는 기본값 1)
- 배포: 환경변수로 명시적 지정
