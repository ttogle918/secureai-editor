# Sprint 3 수정 계획

> 기준일: 2026-04-24
> Sprint 3 원본: Week 07-08 | SAST 파이프라인 완성 & GitHub 레포 스캔

---

## 1. Sprint 1에서 이월된 항목

### 1-1. AuditLogAspect 활성화 (TASK-103에서 이월)

**이월 이유**: `audit_logs` 테이블이 Sprint 1에 정의되지 않아 Spring 빈 비활성화 상태로 남아있음.

**추가 작업**:

**신규 Flyway 마이그레이션: `V010__create_audit_logs.sql`** ← 아래 번호 체계 참고

```sql
CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,
    resource    VARCHAR(100),
    resource_id VARCHAR(255),
    ip_address  INET,
    user_agent  TEXT,
    request_uri TEXT,
    extra_data  JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor_id  ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action    ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

**AuditLogAspect 활성화**:

`global/aop/AuditLogAspect.java` — 주석 해제 후 실제 DB 저장 구현:

```java
@Aspect
@Component
@RequiredArgsConstructor
public class AuditLogAspect {

    private final AuditLogRepository auditLogRepository;

    @AfterReturning("@annotation(io.secureai.backend.global.aop.AuditLog)")
    public void logAudit(JoinPoint joinPoint) {
        MethodSignature sig = (MethodSignature) joinPoint.getSignature();
        AuditLog annotation = sig.getMethod().getAnnotation(AuditLog.class);

        String action = annotation.action().isEmpty() ? sig.getMethod().getName() : annotation.action();
        UUID actorId = resolveActorId();

        AuditLogEntity log = AuditLogEntity.builder()
            .actorId(actorId)
            .action(action)
            .resource(annotation.resource())
            .build();
        auditLogRepository.save(log);
    }
    // ...
}
```

**추가 필요 파일**:
- `domain/audit/entity/AuditLogEntity.java`
- `domain/audit/repository/AuditLogRepository.java`
- `AuditLog.java` 어노테이션에 `resource`, `resourceId` 속성 활용 검토

---

## 2. Flyway 마이그레이션 번호 전면 수정 ⚠️ 중요

### 문제점

원본 백로그의 마이그레이션 번호가 비순차적. Flyway는 버전 순서를 엄격하게 관리하므로
**번호가 충돌하면 애플리케이션이 시작되지 않음**.

### 실제 충돌 목록

| 원본 번호 | TASK | 문제 |
|---------|------|------|
| V023 | TASK-205 AnalysisProgressLog | V006 다음이므로 V008이어야 함, V023은 공백 발생 |
| V009 | TASK-304 PatchSuggestion | Sprint 2 V009 (agent_checkpoints)와 충돌 |
| V014~V016 | TASK-305 CVE 데이터 | Sprint 5 V013 (PrReviewHistory)보다 뒤에 위치, 역전 발생 |
| V013 | TASK-502 PrReviewHistory | Sprint 3 V014와 역전 |

### 수정된 마이그레이션 번호 계획

```
Sprint 0 (완료):
  V001 - plans
  V002 - users
  V003 - refresh_tokens
  V004 - projects
  V005 - team_members

Sprint 1: 추가 마이그레이션 없음

Sprint 2:
  V006 - analysis_sessions         (TASK-203, 원본 그대로 ✅)
  V007 - vulnerabilities           (TASK-204, 원본 그대로 ✅)
  V008 - analysis_progress_log     (TASK-205, 원본 V023 → 수정 필요 ⚠️)
  V009 - agent_checkpoints         (TASK-206, 원본에 번호 미지정 → 신규)

Sprint 3:
  V010 - audit_logs                (Sprint 1 이월, 원본에 없음 → 신규)
  V011 - patch_suggestions         (TASK-304, 원본 V009 → 수정 필요 ⚠️)
  V012 - cve_data                  (TASK-305, 원본 V014 → 수정 필요 ⚠️)
  V013 - dependency_components     (TASK-305, 원본 V015 → 수정 필요 ⚠️)
  V014 - vulnerability_components  (TASK-305, 원본 V016 → 수정 필요 ⚠️)

Sprint 4: 추가 마이그레이션 없음 (기존 테이블 활용)

Sprint 5:
  V015 - pr_review_history         (TASK-502, 원본 V013 → 수정 필요 ⚠️)

Sprint 6 이후: V016 ~
```

> **적용 방법**: Sprint 2 시작 전 TASK-205의 파일명을 `V008__create_analysis_progress_log.sql`로
> 생성하고, 이후 모든 마이그레이션 파일도 위 번호를 따라야 합니다.

---

## 3. Sprint 3 TASK별 수정 사항

### TASK-301: 파일 배치 SAST — 마이그레이션 번호 변경 없음
- V006~V007은 Sprint 2에서 이미 정의됨, 참조만

### TASK-304: 패치 에이전트
- **V009 → V011** 로 파일명 수정 (`V011__create_patch_suggestions.sql`)

### TASK-305: CVE 기초 데이터베이스 & SBOM 파서
- **V014 → V012** (`V012__create_cve_data.sql`)
- **V015 → V013** (`V013__create_dependency_components.sql`)
- **V016 → V014** (`V014__create_vulnerability_components.sql`)

### 추가 TASK (Sprint 1 이월): AuditLog 시스템
- **신규 V010** (`V010__create_audit_logs.sql`)
- `AuditLogAspect.java` 활성화
- `AuditLogEntity.java`, `AuditLogRepository.java` 신규 구현
- 예상 공수: 0.5일

---

## 4. Sprint 3 완료 기준 (수정)

원본 완료 기준에 아래 항목 추가:

- [ ] **AuditLog 동작**: `@AuditLog` 어노테이션이 붙은 컨트롤러 메서드 호출 시 `audit_logs` 테이블에 레코드 생성
- [ ] **Flyway 번호 순서**: V001~V014 사이 공백 없이 순차 실행

---

## 5. 참고: Sprint 4로 이월된 Sprint 1 항목

(sprint01_revision.md 에 기재됨, 여기서는 연결만)

| 항목 | 구현 위치 | Sprint 4 작업 내용 |
|------|---------|-----------------|
| User 30일 하드 삭제 | `UserService.deleteMe()` | `@Scheduled` + `UserRepository.deleteHardDeleted()` |
| Project 72시간 하드 삭제 | `ProjectDeletedEventListener` | 리스너에 스케줄링 또는 `@Scheduled` 추가 |
