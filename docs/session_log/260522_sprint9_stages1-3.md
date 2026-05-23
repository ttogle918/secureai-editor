# Sprint 9 Stage 1~3 세션 로그 (2026-05-22)

**브랜치**: `feat/sprint9`  
**작업 범위**: Stage 1 커밋 후 회귀 수정 → Stage 2 (TASK-906) → Stage 3 (TASK-907) → Docker 기동 버그 수정 → Stage 2+3 수동 검증

---

## 주요 작업 순서

### 1. 회귀 테스트 수정 (Stage 1/2 부산물)

Stage 1에서 UUID 검증 도입(`str(_uuid.UUID(...))`), Stage 2에서 `AnalysisMetrics` 추가로 기존 테스트 2건 회귀 발생.

| 파일 | 원인 | 수정 |
|------|------|------|
| `test_mcp_postgres_tools.py` | 비-UUID 문자열(`"proj-uuid-1234"`)이 UUID 검증에서 거부 → 빈 문자열 반환 | 유효한 UUID 형식(`"00000000-0000-0000-0000-000000001234"`)으로 교체 |
| `AnalysisServiceTest.java` | `AnalysisMetrics`가 `AnalysisService` 생성자에 추가됐으나 테스트에 `@Mock` 없어 NPE | `@Mock AnalysisMetrics` 추가 |

**커밋**: `eefac35` `test: 회귀 테스트 2건 수정`

---

### 2. Docker Compose 기동 버그 수정 (수동 검증 중 발견)

`docker compose up --build` 과정에서 순서대로 4개 문제 발견 및 수정.

#### 2-1. `GF_SECURITY_ADMIN_PASSWORD` 미설정

`.env`에 값이 없어 Docker Compose가 시작 거부.  
→ `.env`에 `GF_SECURITY_ADMIN_PASSWORD=admin1234` 추가 (수동 조치)

#### 2-2. Flyway V041 placeholder 키 불일치

`V041__create_mcp_readonly_user.sql`에서 `${MCP_RO_PASSWORD}`를 사용했지만, `application.yaml`에 등록된 Flyway placeholder 키는 `mcp-ro-password`(소문자+대시). Flyway가 키를 정확히 매칭하므로 치환 실패 → 앱 기동 불가.

**수정**: SQL의 `${MCP_RO_PASSWORD}` → `${mcp-ro-password}`  
**커밋**: `687945c` `fix: V041 Flyway placeholder 키 이름 불일치 수정`

#### 2-3. Nginx crash-loop (frontend 미기동)

`nginx.conf`의 `location /` 블록이 `proxy_pass http://frontend:3000`을 사용하는데, nginx는 시작 시 upstream hostname을 DNS 리졸브. `frontend` 서비스가 docker-compose에서 주석 처리되어 있어 리졸브 실패 → nginx exit code 1 무한 재시작.

**수정**: Docker 내부 DNS(`resolver 127.0.0.11 valid=30s ipv6=off`) + `set $frontend_upstream` 변수로 요청 시점 동적 리졸브로 전환.  
**커밋**: `4bc1300` `fix(nginx): frontend 미기동 시 nginx crash-loop 수정`

**부수 효과 해결**: Nginx crash-loop이 Docker 내부 DNS 불안정을 일으켜 backend → Redis DNS 리졸브 `SERVFAIL` 발생. 또한 Redis 컨테이너가 이전 실행에서 네트워크 없이 재사용됨 → `docker network connect secureai-editor_data-net secureai-redis` 수동 연결로 해소.

#### 2-4. SSL 인증서 없어 Nginx 재기동 실패

`nginx/certs/server.crt`, `server.key` 미생성 상태. `make ssl-cert` 실행 대신 Git Bash 경로 해석 문제(`/C=KR` → `C:` 드라이브 오해석)로 1회 실패. `MSYS_NO_PATHCONV=1` 환경변수로 재시도 성공.

---

### 3. Stage 2 수동 검증 (TASK-906)

| 항목 | 결과 |
|------|------|
| Prometheus `secureai-backend` UP | ✅ (처음엔 401 → SecurityConfig `/actuator/prometheus` permitAll 추가 후 UP) |
| Prometheus `secureai-ai-engine` UP | ✅ |
| Grafana 대시보드 4개 패널 | ✅ ("SecureAI Engine — Operations" 프로비저닝) |
| `secureai_*` 커스텀 메트릭 노출 | ✅ (`secureai_analysis_sessions_total` 외 3종) |

**추가 수정**: `SecurityConfig.java`에 `/actuator/prometheus` permitAll 누락 → 추가  
**커밋**: `cdd7e92` `fix(security): /actuator/prometheus Prometheus 스크래핑 허용`

`.env` `GF_SECURITY_ADMIN_PASSWORD` 인라인 주석(`# 비밀번호`) 포함으로 실제 비밀번호에 주석 문자열까지 포함됨 → 인라인 주석 제거 (수동 조치).

---

### 4. Stage 3 자동 검증 (TASK-907)

| 테스트 | 결과 |
|--------|------|
| `GdprHardDeleteServiceTest` 8개 | ✅ 전부 통과 |
| `GdprServiceTest` 11개 | ✅ 전부 통과 |
| 감사 로그 선행 → 이벤트 → deleteById 순서 | ✅ 단위 테스트로 검증 |
| 29일 경계 조건 | ✅ cutoff 쿼리 단위 테스트 통과 |
| `/api/v1/admin/gdpr/pending-deletions` 인증 | ✅ 미인증 → 401 반환 |

**잔여 검증** (통합 환경 필요):
- 30일 경과 시뮬레이션 통합 테스트
- ShedLock 다중 인스턴스 1회 실행 검증
- 삭제 완료 이메일 수신 (수동)

---

## 최종 커밋 목록

| 커밋 | 내용 |
|------|------|
| `938ac29` | feat(sprint9/stage1): PostgreSQL MCP + Docker DAST MCP 연동 |
| `4992551` | feat(sprint9/stage2): Prometheus + Grafana 운영 대시보드 |
| `e2175fc` | feat(sprint9/stage3): GDPR 하드 삭제 스케줄러 |
| `eefac35` | test: 회귀 테스트 2건 수정 |
| `687945c` | fix: V041 Flyway placeholder 키 이름 불일치 수정 |
| `4bc1300` | fix(nginx): frontend 미기동 시 nginx crash-loop 수정 |
| `cdd7e92` | fix(security): /actuator/prometheus Prometheus 스크래핑 허용 |

---

## 아키텍처 결정 사항

- **MCP PostgreSQL**: `@modelcontextprotocol/server-postgres` v0.6.2 공식 패키지 채택 (`npx -y` 방식)
- **MCP Docker**: npm 공식 패키지 미존재 → `mcp-server-docker` v1.0.0 채택
- **TASK-905 Option B**: AI Engine → MCP → Backend HTTP → Docker SDK (thin wrapper). Backend `DastExecutionService` 권한·격리 정책 변경 없음
- **GDPR 소프트 삭제 전환**: `POST /api/v1/users/me/gdpr/delete`가 즉시 하드 삭제 → `deleted_at` 기록 + `isActive=false` 소프트 삭제로 변경. 기존 API 동작 변경이므로 주요 결정

---

## 다음 단계

- **Stage 4**: TASK-901 지속 모니터링 서비스 (`/stage 4`)
- **Stage 5**: TASK-902 VSCode Extension MVP + TASK-903 Android 고도화 (병렬, `/stage 5`)
- **수동 검증 잔여**:
  - `make perf-test` k6 부하 테스트
  - OWASP ZAP Full Scan
  - 2FA QR 스캔 (Google Authenticator)
  - 보안 문서 PDF E2E (CISO/행안부/ISMS-P)
  - Nginx HTTP→HTTPS 리다이렉트
  - GDPR 하드 삭제 30일 시뮬레이션 + 이메일 수신
