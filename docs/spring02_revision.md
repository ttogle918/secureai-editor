# Sprint 2 수정 계획

> 기준일: 2026-04-24
> Sprint 2 원본: Week 05-06 | AI Agent 기반 & MCP + 체크포인트 시스템

---

## 1. 수정 필요 사항

### 1-1. Flyway V023 → V008 번호 수정 ⚠️ 필수

**문제**: TASK-205 `AnalysisProgressLog` 마이그레이션이 V023으로 지정되어 있으나,
현재 V005까지 사용되었으므로 다음 사용 가능한 번호는 V008 (V006/V007은 Sprint 2 내 다른 TASK 사용).

**수정**:
- `V023__create_analysis_progress_log.sql` → **`V008__create_analysis_progress_log.sql`**

**Sprint 2 최종 마이그레이션 순서**:
```
V006 - analysis_sessions      (TASK-203, 원본 그대로)
V007 - vulnerabilities        (TASK-204, 원본 그대로)
V008 - analysis_progress_log  (TASK-205, V023 → 수정)
V009 - agent_checkpoints      (TASK-206, 원본 번호 미지정 → 신규)
```

> V009는 원본 백로그에 명시적 번호가 없음. LangGraph PostgresSaver가
> 자체 테이블(`checkpoints`, `checkpoint_blobs` 등)을 생성하지만,
> 앱 레벨에서 해당 테이블을 추적하려면 V009로 래퍼 마이그레이션 작성 권장.

---

## 2. TASK별 수정 사항

### TASK-205: AnalysisProgressLog

**변경**: 파일명만 수정
```
변경 전: V023__create_analysis_progress_log.sql
변경 후: V008__create_analysis_progress_log.sql
```

### TASK-206: LangGraph Checkpointer

**추가**: 명시적 마이그레이션 번호 배정 — **V009**

`langgraph-checkpoint-postgres` 라이브러리가 자동으로 테이블을 생성하지만,
Flyway 히스토리에 기록하려면 V009 마이그레이션에서 테이블 존재 여부 검증 또는 사전 생성 권장.

---

## 3. Sprint 2 완료 기준 (원본 유지, 번호만 수정)

원본 완료 기준 그대로 유지하되, 마이그레이션 파일명만 위 번호로 수정.

---

## 4. Sprint 2 → Sprint 3 이월 없음

Sprint 2는 Sprint 1과 달리 이월 항목 없음.
단, Flyway 번호를 잘못 생성하면 Sprint 3에서 `FlywayException` 발생하므로
**V008 수정이 Sprint 2의 가장 중요한 사전 조건**임.
