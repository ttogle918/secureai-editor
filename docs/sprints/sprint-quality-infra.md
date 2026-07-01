# Sprint QA/INFRA — 테스트 커버리지 보강 + Docker 풋프린트 정리

**계획 수립일**: 2026-07-01
**브랜치**: `claude/test-coverage-docker-analysis-tbt5pd`
**성격**: 기술부채(테스트 품질 + 인프라 경량화) 전용 스프린트 — 제품 기능 없음
**목표**:
1. 취약 앱(프론트·VSCode·안드로이드)의 테스트 공백을 메우고 커버리지 회귀를 **CI에서 강제**한다.
2. 개발 기본 Docker 풋프린트를 **10 → 4 컨테이너**로 줄이되, 관측성은 플래그 하나로 복구 가능하게 한다.

> **태스크 ID 규칙**: 제품 백로그(15xx~18xx)와 충돌하지 않도록 `QA-`(테스트)·`INFRA-`(도커) 네임스페이스를 사용한다.

---

## 1. 현황 실측 (2026-07-01 기준)

### 테스트 커버리지 (소스 : 테스트 파일 수)

| 앱 | 언어 | 소스 | 테스트 | 비율 | 상태 |
|-----|------|------|--------|------|------|
| backend | Kotlin/Spring | 392 | 129 | ~33% | 🟢 컨트롤러 31/34·서비스 55/56 |
| ai_engine | Python/FastAPI | 99 | 51 | ~52% | 🟢 양호 (integration 마커 분리) |
| mcp_server | TypeScript | 10 | 5 | ~50% | 🟡 보통 |
| **frontend** | Next.js/TS | 120 | 19 | ~16% | 🔴 취약 |
| **android** | Kotlin | 45 | 9 | ~20% | 🔴 취약 |
| **vscode_ext** | TypeScript | 3 | 0 | 0% | 🔴 없음 |

### Docker 기본 실행 (`make dev` = `docker compose up -d`)

- **기본 기동 10개**: postgres, redis, backend, ai_engine, jaeger, nginx, prometheus, loki, promtail, grafana
- **프로파일 격리(양호)**: k6(`perf`), zap(`zap`)
- **빌드 전용 이미지(양호)**: dast_runner, Dockerfile.patch-verify, webgoat compose
- **핵심 4개**: postgres, redis, backend, ai_engine
- **기본에서 뺄 수 있는 6개**: jaeger·prometheus·loki·promtail·grafana(관측성 5) + nginx(게이트웨이 1)

---

## 2. 태스크 목록

### QA 트랙 — 테스트 커버리지

| ID | 제목 | 대상 | 사이즈 | 우선 |
|----|------|------|--------|------|
| **QA-01** | 프론트 핵심 컴포넌트 테스트 (에디터·DAST 실시간 로그 뷰·분석 결과 뷰) | `apps/frontend/src/components`, `src/app` | L | P0 |
| **QA-02** | 프론트 API 클라이언트 에러/재시도 경로 + SSE 스트림 소비자(`/agent/dast/logs`) 테스트 | `apps/frontend/src/lib/api` | M | P0 |
| **QA-03** | E2E 스모크 (Playwright): 로그인 → 분석 실행 → 리포트 조회 | 신규 `tests/e2e/` | M | P1 |
| **QA-04** | VSCode 확장 activation + 커맨드 등록 테스트 (0 → 기본선) | `apps/vscode_ext` | S | P1 |
| **QA-05** | 안드로이드 ViewModel·Repository 유닛 테스트 | `apps/android/.../test` | M | P2 |
| **QA-06** | AI 엔진 리스크 모듈 커버리지 보강 (dast/executors·validation/parsers·llm) | `apps/ai_engine/agent` | M | P1 |
| **QA-07** | 커버리지 게이트 CI 강제 (JaCoCo `jacocoTestCoverageVerification` + Jest `coverageThreshold`) | backend build.gradle, frontend jest.config, CI | S | P0 |
| **QA-08** | `test-scripts/` 임시(날짜 스탬프) 스크립트 → 유지되는 통합 스위트로 통합 | `test-scripts/` → `tests/integration/` | S | P2 |

### INFRA 트랙 — Docker 풋프린트 정리

| ID | 제목 | 대상 | 사이즈 | 우선 |
|----|------|------|--------|------|
| **INFRA-01** | 관측성 5종(jaeger·prometheus·loki·promtail·grafana) → `profiles: ["obs"]` | `docker-compose.yml` | S | P0 |
| **INFRA-02** | nginx → `profiles: ["gateway","zap"]` (dev 기본에서 제외) | `docker-compose.yml` | S | P1 |
| **INFRA-03** | 죽은 주석 서비스(mcp_server·frontend) 정리 — 프로파일화 또는 삭제 | `docker-compose.yml` | S | P2 |
| **INFRA-04** | backend `DOCKER_HOST` 하드코딩(2375) → env 기반(기본 미설정) | `docker-compose.yml` | S | P2 |
| **INFRA-05** | Makefile 갱신 — `make dev`(핵심 4개) + `make obs` + `make gateway` 타깃 | `Makefile` | S | P0 |

---

## 3. 실행 계획 (Stage)

### Stage 1 — 인프라 경량화 (충돌 없음, 빠른 승리)
> 코드 변경 없이 compose/Makefile만 손대므로 리스크 최저. 먼저 착수해 개발 루프를 가볍게 한다.

1. **INFRA-01**: 관측성 5종에 `profiles: ["obs"]` 부여. 백엔드/ai_engine의 OTEL·Sentry 익스포터는 env-gated라 컬렉터 부재 시 우아하게 degrade → 안전.
2. **INFRA-02**: nginx에 `profiles: ["gateway","zap"]` 부여. zap 서비스가 이미 nginx를 `depends_on` → zap 프로파일 기동 시 자동 동반.
3. **INFRA-05**: Makefile
   - `make dev` → `docker compose up -d`가 **핵심 4개만** 기동
   - `make obs` → `docker compose --profile obs up -d` (관측성 복구)
   - `make gateway` → `docker compose --profile gateway up -d`
4. **검증**: `docker compose config`로 프로파일 파싱 확인 → `make dev` 후 `docker ps`가 4개인지, `make obs` 후 9개인지 확인.

**완료 기준**: `make dev` 기본 컨테이너 10 → 4. 관측성은 `--profile obs`로 1:1 복구.

### Stage 2 — 커버리지 게이트 + 프론트 핵심 (병렬)
> Stage 1과 독립. 게이트를 먼저 세워 이후 추가 테스트가 수치로 반영되게 한다.

- **QA-07**: JaCoCo `jacocoTestCoverageVerification`(초기 임계값은 **현재값 -0%**로 잡아 회귀만 차단, 이후 상향) + Jest `coverageThreshold`. CI 스텝 추가.
- **QA-01 / QA-02**: 프론트 최취약 영역(에디터·DAST SSE·API 클라이언트) 우선. 각 테스트가 QA-07 게이트에 즉시 반영.
- **QA-06**: AI 엔진 리스크 모듈(신뢰불가 입력 파싱·샌드박스 조율) 보강.

**완료 기준**: CI가 커버리지 하락 시 RED. 프론트 비율 16% → 목표선(예: 35%) 진입.

### Stage 3 — 확장 + 정리 (후속)
- **QA-03**: Playwright E2E 스모크 (이 실행 환경에 Chromium/Playwright 선설치됨 — 재설치 불필요).
- **QA-04**: VSCode 확장 기본선 테스트.
- **QA-05**: 안드로이드 ViewModel/Repository.
- **QA-08**: `test-scripts/` 통합.
- **INFRA-03 / INFRA-04**: 죽은 compose 블록 정리 + DOCKER_HOST env화.

---

## 4. 완료 기준 (Definition of Done)

- [ ] `make dev` 기본 기동 컨테이너 = 4개 (postgres·redis·backend·ai_engine)
- [ ] `make obs` / `make gateway`로 관측성·게이트웨이 온디맨드 복구
- [ ] CI가 커버리지 회귀 시 실패 (backend JaCoCo + frontend Jest 임계값)
- [ ] 프론트 테스트 파일 19 → 목표선 이상, 에디터·DAST SSE·API 클라이언트 커버
- [ ] VSCode 확장 테스트 0 → 최소 activation/command 스위트
- [ ] `test-scripts/` 날짜 스탬프 스크립트가 `tests/integration/`로 통합·CI 편입

## 5. 리스크 & 유의점

- **관측성 프로파일화(INFRA-01)**: env-gated 익스포터 확인 완료 — 백엔드/ai_engine 코드 변경 불필요. 단, Grafana 대시보드로 상시 모니터링하는 팀원이 있다면 `make obs` 사용법 공지 필요.
- **커버리지 임계값(QA-07)**: 초기값을 현재 수준으로 잡아 "빌드가 갑자기 RED" 되는 사태를 방지하고, 이후 스프린트에서 단계 상향.
- **프론트 SSE 테스트(QA-02)**: `/agent/dast/logs` 스트림은 mock EventSource로 결정적 테스트 구성 필요.
- **INFRA-04(DOCKER_HOST)**: Windows Docker Desktop 사용자 환경 회귀 주의 — 기본 미설정 + `.env.example`에 옵션 안내로 대응.
