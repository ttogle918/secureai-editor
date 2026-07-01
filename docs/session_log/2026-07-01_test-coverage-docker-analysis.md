# [2026-07-01] 작업 세션 요약 — 테스트 커버리지 & Docker 분석

**브랜치**: `claude/test-coverage-docker-analysis-tbt5pd`
**작업 범위**: 전체 코드베이스 테스트 커버리지 감사 + Docker 컨테이너 필요성 분석 → 수정 목록·실행 계획 문서화
**산출물**: 본 세션로그 + [`docs/sprints/sprint-quality-infra.md`](../sprints/sprint-quality-infra.md) (실행 계획)

---

## 1. 완료 작업

| 항목 | 결과 | 파일 |
|------|------|------|
| 앱 6종 테스트 커버리지 실측 | frontend·android·vscode_ext 취약 식별 | 본 문서 §2 |
| Docker 기본 풋프린트 분석 | 기본 10개 중 6개 dev 불필요 판정 | 본 문서 §3 |
| 수정 목록 + 실행 계획 수립 | QA 8건 + INFRA 5건, 3-Stage | `docs/sprints/sprint-quality-infra.md` |

> 이번 세션은 **분석·계획 문서화**만 수행. 코드/compose 변경 없음.

---

## 2. 테스트 커버리지 감사 (실측)

| 앱 | 소스 | 테스트 | 비율 | 평가 |
|-----|------|--------|------|------|
| backend | 392 | 129 | ~33% | 🟢 컨트롤러 31/34·서비스 55/56, JaCoCo 연동 |
| ai_engine | 99 | 51 | ~52% | 🟢 pytest + `integration` 마커 |
| mcp_server | 10 | 5 | ~50% | 🟡 보통 |
| frontend | 120 | 19 | ~16% | 🔴 최우선 |
| android | 45 | 9 | ~20% | 🔴 취약 |
| vscode_ext | 3 | 0 | 0% | 🔴 없음 |

**핵심 공백**:
- **프론트엔드**: 테스트가 `lib/`·`store/`·`hooks/`·`ui/`에 편중. `src/app`(라우트/페이지), 에디터, DAST 실시간 로그 SSE(`/agent/dast/logs`) 구독, 분석 결과 뷰, API 클라이언트 에러/재시도 경로가 사실상 미테스트.
- **VSCode 확장**: 테스트 전무.
- **안드로이드**: ViewModel/Repository 계층 미검증.
- **AI 엔진**: 비율은 양호하나 리스크 집중 모듈(`agent/nodes/dast/executors`, `agent/validation/parsers`, `agent/llm`) 개별 확인 필요.
- **공통**: JaCoCo 리포트·Jest `collectCoverageFrom`는 있으나 **최소 임계값 미강제** → 커버리지 조용한 회귀 가능.
- **E2E**: `test-scripts/`에 날짜 스탬프 일회성 스크립트만 존재, 유지되는 통합 스위트 부재.

## 3. Docker 컨테이너 분석 (실측)

`make dev` = `docker compose up -d` → **기본 10개 기동** (k6·zap만 프로파일 격리).

| 그룹 | 컨테이너 | 판정 |
|------|----------|------|
| 핵심 | postgres, redis, backend, ai_engine | ✅ 유지 |
| 관측성 | jaeger, prometheus, loki, promtail, grafana | ⚠️ 상시기동 — dev 기본 불필요 → `obs` 프로파일로 |
| 게이트웨이 | nginx | ⚠️ dev는 backend/ai_engine 직접 통신 → `gateway`/`zap` 프로파일로 |
| 온디맨드(양호) | k6(`perf`), zap(`zap`), dast_runner·patch-verify·webgoat(빌드전용) | ✅ 변경 불필요 |

**결론**: 관측성 5 + nginx 1 = **6개를 프로파일 뒤로** 옮기면 dev 기본 **10 → 4**. 코드 변경 없이 compose 편집만으로 가능하고, 관측성은 `--profile obs`로 복구.

**부수 발견**:
- `mcp_server`·`frontend` compose 블록이 주석 처리 상태로 실 Dockerfile과 드리프트 → 정리 필요(INFRA-03).
- backend `DOCKER_HOST: tcp://host.docker.internal:2375` 하드코딩(Windows Docker Desktop 전용) → Linux/macOS 취약, env화 권장(INFRA-04).
- prometheus 스크레이프 타깃 = backend·ai_engine 2종 정상. Grafana 데이터소스 = prometheus + loki (일관).

## 4. 수정 목록 & 실행 계획 요약

전체 상세는 [`sprint-quality-infra.md`](../sprints/sprint-quality-infra.md). 핵심:

- **Stage 1 (빠른 승리, 코드무변경)**: INFRA-01(관측성 `obs` 프로파일)·INFRA-02(nginx 프로파일)·INFRA-05(Makefile `make obs`/`make gateway`) → dev 기본 4컨테이너화.
- **Stage 2 (게이트+프론트)**: QA-07(커버리지 CI 게이트, 초기값=현재값으로 회귀만 차단)·QA-01/02(프론트 에디터·DAST SSE·API 클라이언트)·QA-06(AI 엔진 리스크 모듈).
- **Stage 3 (확장·정리)**: QA-03(Playwright E2E 스모크)·QA-04(VSCode)·QA-05(안드로이드)·QA-08(test-scripts 통합)·INFRA-03/04.

## 5. 다음 세션에서 할 것

- [ ] **INFRA-01·02·05** 착수 — compose 프로파일 + Makefile 타깃 (리스크 최저, 즉효)
- [ ] **QA-07** 커버리지 게이트를 먼저 세워 이후 테스트가 수치 반영되게 함
- [ ] **QA-01/02** 프론트 최취약 영역(에디터·DAST SSE·API 클라이언트) 우선 보강
- [ ] 초기 커버리지 임계값을 현재 수준으로 고정 → 이후 스프린트에서 단계 상향
