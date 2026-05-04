# [2026-05-04] 작업 세션 요약

**브랜치**: `feat/sprint3`  
**작업 범위**: Sprint 3 전체 스택 기동 — 미머지 브랜치 통합 + Flyway 수정 + RestClient 빈 오류 해결

---

## 1. 세션 시작 시 상태 파악

### Sprint 3 완료 현황 (sprint-3.md 기준)
- TASK-301 ~ TASK-305 모두 2026-05-02 완료 처리됨
- 단위 테스트는 통과했으나 통합 테스트·수동 검증 전부 pending

### 문제 발견: 구현 커밋이 다른 브랜치에만 존재
`feat/sprint3` 브랜치에 Sprint 3 실제 구현 커밋 4개가 없었음.

| 커밋 | 내용 | 위치 |
|------|------|------|
| `fa47d1a` | Stage 1+2 — 배치 SAST, CWE 분류, GitHub 스캔 | `feat/task-304-305`만 |
| `7231b11` | task301 | `feat/task-304-305`만 |
| `7a77298` | TASK-304 — 패치 에이전트 | `feat/task-304-305`만 |
| `ee121dd` | TASK-305 — CVE DB & SBOM 파서 | `feat/task-304-305`만 |

→ V007~V012 Flyway 마이그레이션 파일이 현재 브랜치에 없었음

---

## 2. 브랜치 머지

```
git merge feat/task-304-305
```

**충돌 파일**: `docs/sprints/sprint-3.md`  
**충돌 내용**: `feat/sprint3`(HEAD)에는 TASK-304/305 완료 행·섹션 존재, `feat/task-304-305`에는 없음  
**해결**: HEAD 버전 유지 (완료 행·상세 섹션 보존)

**머지 후 마이그레이션 파일 목록**:
```
V001 ~ V006  (기존)
V007__create_vulnerabilities.sql          (신규 추가)
V008__create_analysis_progress_log.sql    (신규 추가)
V009__create_cve_data.sql                 (신규 추가)
V010__create_dependency_components.sql    (신규 추가)
V011__create_patch_suggestions.sql        (신규 추가)
V012__add_cve_component_mapping.sql       (신규 추가)
V015__create_security_guidelines.sql      (미추적, 신규)
```

---

## 3. Flyway `baseline-on-migrate` 버그 수정

**증상**: 백엔드 기동 시 `ERROR: relation "plans" does not exist` (V002 실패)

**원인**:
- `baseline-on-migrate: true` + Flyway 기본 `baseline-version: 1`
- Fresh DB에서 Flyway가 V001을 "베이스라인"으로 표시만 하고 **실제 실행하지 않음**
- V001이 건너뛰어져 `plans` 테이블 미생성 → V002 FK 오류

**수정** (`apps/backend/src/main/resources/application.yaml`):
```yaml
flyway:
  enabled: true
  baseline-on-migrate: true
  baseline-version: 0   # 추가 — V001부터 전체 실행 보장
  locations: classpath:db/migration
```

**추가 조치**: 첫 실패 시 `flyway_schema_history`에 잘못된 상태(V001=BASELINE 건너뜀, V002=FAILED)가 기록됨 → postgres 볼륨 초기화 필요

```
docker compose down -v
docker compose up -d
```

---

## 4. `NvdApiClient` RestClient.Builder 빈 오류 수정

**증상**: 백엔드 기동 시 `No qualifying bean of type 'RestClient$Builder' available`

**원인**: `NvdApiClient`가 생성자에서 `RestClient.Builder`를 DI로 주입받으려 했으나, Spring Boot 4.0.5에서 `RestClient.Builder` 자동 구성 미동작

**참고**: `GitHubRestClient`는 정적 `RestClient.builder()` 메서드를 사용해 문제 없었음

**수정** (`NvdApiClient.java`):
```java
// Before: @RequiredArgsConstructor + private final RestClient.Builder restClientBuilder;
// After:
public NvdApiClient(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
    this.redisTemplate = redisTemplate;
    this.objectMapper = objectMapper;
    this.restClient = RestClient.builder().build();
}
```
- `fetchWithRetry()` 내 `restClientBuilder.baseUrl(NVD_BASE_URL).build()` → `restClient` 직접 사용으로 변경
- `@RequiredArgsConstructor` 제거

---

## 5. 최종 상태

```
docker compose ps 결과:
  secureai-postgres   ✅ healthy (5432)
  secureai-redis      ✅ healthy (6379)
  secureai-backend    ✅ Up / Started in 11.6s (8080)
  secureai-ai-engine  ✅ healthy (8000)

GET http://localhost:8080/actuator/health → {"status":"UP"}
GET http://localhost:8000/health          → {"status":"healthy","service":"SecureAI AI Engine"}

Flyway 마이그레이션: V001 ~ V012, V015 전체 정상 적용
```

---

## 6. Sprint 3 통합 테스트 — 이번 세션 결과 (2026-05-04 계속)

### 6-1. V013 마이그레이션 추가 및 수정

**목적**: `vulnerabilities.call_chain` 컬럼을 `TEXT → JSONB`로 변환 + GIN 인덱스 추가 (TASK-302)

**최초 오류 1** (`out-of-order`): V013은 V014/V015보다 늦게 추가됐기 때문에 Flyway가 거부
```yaml
# application.yaml에 추가
flyway:
  out-of-order: true
```

**최초 오류 2** (DEFAULT 변환 불가): `call_chain TEXT NOT NULL DEFAULT '[]'`에서 DEFAULT를 드랍하지 않으면 `USING` 변환 실패
```sql
-- V013 최종 버전
ALTER TABLE vulnerabilities ALTER COLUMN call_chain DROP DEFAULT;
ALTER TABLE vulnerabilities ALTER COLUMN call_chain TYPE JSONB USING call_chain::jsonb;
ALTER TABLE vulnerabilities ALTER COLUMN call_chain SET DEFAULT '[]'::jsonb;
CREATE INDEX idx_vuln_call_chain_gin ON vulnerabilities USING GIN(call_chain);
```

### 6-2. 테스트 수정 사항

| 파일 | 수정 내용 |
|------|-----------|
| `test_backend_sprint3.py` | JSONB INSERT 테스트: FK 체인(users→projects→analysis_sessions→vulnerabilities) 생성 후 삽입 |
| `test_sprint3_integration.py` | `agent.tools.response_parser` → `agent.response_parser` 경로 수정 |
| `test_sprint3_integration.py` | `classify_and_enrich` 반환값이 `callChain` (camelCase)임을 반영 |

### 6-3. 최종 테스트 결과

```
AI 엔진 전체 테스트: 139 passed / 0 failed (9.44s)

  tests/integration/test_backend_sprint3.py   9 passed  (TASK-302/304/305)
  tests/integration/test_sprint3_integration.py  7 passed  (TASK-301/304)
  tests/api/test_analyze_route.py             9 passed
  tests/agent/ (단위)                        85 passed
  tests/infrastructure/ (단위)               25 passed
  tests/integration/test_checkpointer_integration.py  4 passed
```

### 6-4. Sprint 3 자동 테스트 완료 항목

| TASK | 검증 항목 | 결과 |
|------|-----------|------|
| TASK-301 | Redis MISS/HIT/TTL 사이클 | ✅ |
| TASK-302 | call_chain JSONB + GIN 인덱스 검색 | ✅ |
| TASK-304 | Claude API SQL Injection 탐지, 파서, 분류기 | ✅ |
| TASK-304 | patch_suggestions 스키마 검증 | ✅ |
| TASK-305 | Flyway 테이블 존재 확인, CVE/SBOM 스키마 | ✅ |
| TASK-305 | NVD Redis 캐시 키 형식 검증 | ✅ |

---

## 7. 다음 세션에서 할 것

| 우선순위 | 항목 | TASK |
|---------|------|------|
| 1 | 프론트엔드에서 실제 분석 세션 생성 → 전체 SAST 플로우 E2E | TASK-303 |
| 2 | `AuthController.java` 취약점 2건 수정 (URL 토큰 노출, Open Redirect) | 이전 세션 발견 |

**참고**: 프론트엔드는 `cd apps/frontend && npm run dev`로 로컬 실행 필요 (docker-compose에 미포함)
