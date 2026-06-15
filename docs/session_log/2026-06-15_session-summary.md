# [2026-06-15] 작업 세션 요약

**브랜치**: feat/sprint12-* (Stage 3~6 스테이지별) → main 머지 완료
**작업 범위**: Sprint 12 본진(보안 코어 & 관측성) 트랙 A·B — Stage 3~6 /stage 파이프라인 실행 및 main 머지

---

## 1. 완료 작업

| Stage | 태스크 | 주요 파일 | 구현커밋 | 머지커밋 |
|---|---|---|---|---|
| 3 (본진A) | TASK-1202a 감사로그 해시체인(V055) + TASK-1202b 세션관리·강제로그아웃(V056) | `domain/auditlog/AuditLogHashService.java`, `domain/auditlog/ChainAppender.java`, `domain/auditlog/AuditVerifyService.java`, `global/aop/AuditLogAspect.java`, `domain/user/UserSessionService.java`, `domain/user/JwtAuthenticationFilter.java`, Flyway V055·V056 | 9f1a964 | 61fc96d |
| — | docs(memo) 기능 개요 문서(사용자 요청 별도 커밋) | `docs/features/memopad.md` | 79b6508 | (main 직접) |
| 4 (본진B) | TASK-1203b OWASP ZAP DAST 하니스 + Critical 게이트 | `infra/zap/gate.py`, `.github/workflows/ci-dast.yml` | 0101624 | 3f958ca |
| 5 (본진B) | TASK-1203 CI/CD 품질게이트(k6+ZAP+SCA+커버리지) | `.github/workflows/ci-quality-gate.yml`, `build.gradle.kts`(커버리지 임계값 58%), `infra/k6/load.js` | ebc4329 | ad9d8a2 |
| 6 (본진B) | TASK-1603 Loki + TASK-1804 Sentry (관측성) | `docker-compose.yml`(Loki/Promtail/Sentry 스택), `infra/loki/loki-config.yaml`, `infra/loki/promtail-config.yaml`, `grafana/provisioning/datasources/loki.yaml`, `grafana/provisioning/dashboards/loki-dashboard.json`, `app/src/main/java/com/secureai/infra/sentry/SentryPiiScrubber.java`, `apps/ai_engine/src/config/sentry_filter.py`, `apps/frontend/sentry.*.config.ts`, `logback-spring.xml` | 795c1e0 | 1d118a7 |

---

## 2. 의논 내용 & 결정 맥락

### 2.1 트랙 선택 — 본진(C) 분기 확정
- 이전 세션(2026-06-13) 로그에서 "택1 분기: 보안우선(본진A) vs 관측성우선(본진B)" 제시
- 사용자가 **보안 코어(본진 1202a/b) 우선**, 이후 관측성 포함 B 트랙 자연 확장 선택
- Stage 3부터 병렬 Dev 파이프라인 시작

### 2.2 본진 트랙 B 스코프 분리 결정
- Stage 4·5·6 분리 근거: 
  - docker-compose.yml 공유(레이스 경합 회피)
  - 1203b → 1203 선행 의존 관계
  - 각 단독 스테이지로 병렬화 불가능 → 순차 정확성 보장
- "플랜의 '코드충돌 0'은 12C·12D 대비일 뿐, 트랙 B 내부 인프라 파일은 공유"라는 점 명확히

### 2.3 TASK-1202a 해시체인 동시성 설계
- Virtual Threads 환경에서 체인 순서 보장:
  - ReentrantLock (pinning 회피) + REPEATABLE_READ 격리 + SELECT FOR UPDATE 단일라이터
  - 저장 실패 → try-catch 격리 (원요청 무영향)
- 트레이드오프: 성능 < 데이터 무결성(감사로그 규정 준수)

### 2.4 TASK-1202a/b 병렬 Dev 가능성 재확인
- SecurityConfig anyRequest().authenticated() 기준선
- 1202a(해시체인): domain/auditlog/** 신규
- 1202b(세션관리): domain/user/** + filter 신규
- **파일 충돌 0 확정** → 병렬 Dev 승인

### 2.5 커버리지 게이트 70% → 58%로 현실화
- 실측: 59.73% (Stage 5 빌드 실패 회피)
- Reviewer 의견: "70%는 항상 부채, 58%는 정직한 하드게이트"
- 결정: build.gradle.kts에 **S14 로드맵 명시**(70% 점진상향)
- 기존 "70%+continue-on-error"는 가짜 성공 신호 제거

### 2.6 frontend npm audit 경보전용 유지
- 현황: next.js 부채 1 high + 1 critical (연쇄 미해결)
- 10% 확률의 false positive audit와 비교 → "경보전용 + S13 전 audit-ci allowlist 전환" 권고
- continue-on-error 유지로 PR 블락 회피

### 2.7 관측성 스코프 제약 (Stage 6)
- analyze.py 에러핸들러 미수정(12C STAGE-2와 충돌 회피)
- ai_engine 변경: main.py + 설정만 (도메인 코드 불개입)
- Sentry: 전 런타임 DSN env-gated, before_send PII 스크럽 **필수**

### 2.8 Docker 라이브 검증 도입
- Stage 6 검증 도구: `docker compose up -d grafana` 실기동
- 단위테스트로 못 잡는 **Grafana 크래시 버그 포착** (아래 트러블슈팅)
- 인프라 버그의 가치: 사용자가 Docker Desktop 켜 줄 때만 발견 가능

### 2.9 데모 잔재 정리
- origin/demo/webhook-sast: 원격 이미 삭제 → 로컬 stale ref prune
- stray docs/memo 기능개요: 사용자 "필요" 요청 → 별도 docs 커밋 79b6508

---

## 3. 버그 수정 / 특이사항

- **Grafana Loki 데이터소스 크래시 루프**: 자세한 증상/원인/해결 → `docs/troubleshooting/2026-06-15_grafana-loki-plugin-crashloop.md` 참조
  - 요약: GF_INSTALL_PLUGINS에서 grafana-loki-datasource 제거(빌트인 코어) → 재기동 healthy
  - 교훈: 라이브 검증이 단위테스트를 보완
- Reviewer 비차단 권고 즉시 반영:
  - Stage 3: (기록만)
  - Stage 6: Set-Cookie 헤더 Sentry PII 스크럽 추가

---

## 4. 다음 세션에서 할 것

### 수동검증 (일괄)
- [ ] Loki 실로그 적재 및 LogQL 쿼리 검증 (up --build backend ai_engine)
- [ ] Trace ID 풀스택 상관관계 확인
- [ ] Sentry 실 DSN 이벤트 도달 + PII 마스킹 검증
- [ ] Frontend npm install (@sentry/nextjs) + build
- [ ] GH Actions CI 게이트 실동작 검증
- [ ] TASK-1202a/b 수동검증:
  - 해시체인 위변조 감지 시나리오
  - 강제로그아웃 → 401/403 응답 검증
- [ ] ZAP 실스캔 (Sprint 8 부채 청산)

### 다음 스테이지
- [ ] TASK-1205 백업·S3 (본진 트랙 B 마지막) → /stage 7
- [ ] TASK-1210 트랜잭션 이메일 (본진 트랙 A 잔여)

### 누적 비차단 권고 (S13 전 처리)
- [ ] TASK-1202a: recordSession deviceInfo/UA 분리 및 audit 정렬 (ULID)
- [ ] infra/zap: gate.py why 주석 추가 + evaluate_gate 함수 추출
- [ ] infra/zap/.gitignore: *.md 범위 확대
- [ ] runbook HTTPS 지정
- [ ] frontend: npm audit → audit-ci allowlist 전환
- [ ] build.gradle.kts: 커버리지 65% (S13) 계획
- [ ] .github/workflows/ci-k6.yml: env 값 전달 검증

---

## 형상 상태 (세션 종료)

- **main HEAD**: 1d118a7 (Stage 6 머지 커밋)
- **origin 동기화**: 완료
- **워킹트리**: clean
- **feature 브랜치**: 모두 머지 및 삭제
- **Flyway 마이그레이션 최종**: V055 (1202a) / V056 (1202b)
- **실행 중 컨테이너** (수동테스트용 유지): loki, promtail, grafana, prometheus

---

## 후반부 (이어서) — 검증 방법 보강 + Sentry DSN 안내

### 개요
/done 후 사용자가 "검증 방법" 추가 요청. 기존 메모 2종(`docs/memo/SECUREAI_BENCHMARK_GUIDE.md`, `SECUREAI_VALIDATION_ROADMAP.md`)과 백로그(`EPIC-VAL`)를 대조하여 빠진 검증 항목을 신규 추가하고, Sentry DSN 구성(단일 vs 다중)에 대한 의논 정리.

### 1. 검증 방법 정합 & 신규 항목 추가

#### 작업 범위
- 메모의 검증 지침과 기존 백로그 정합 확인
- 중복 제거 + 빠진 항목 식별 및 신설
- 커밋: `4f2a761` docs(validation): EPIC-VAL 신규 항목 VAL-7~13 추가 + 메모 보강

#### 결정 맥락 — "싸고·빠르고·IR숫자 즉효" 원칙
메모에서 제시한 검증 선정 기준 도입:
- ✓ 비용 최소(free/open bench, 공개 도구, 자동화)
- ✓ 피드백 빠름(하루 이내 실행)
- ✓ 혼자 가능(인력 의존도 低)
- ✓ 수치 즉효(IR 메트릭으로 즉시 계량)

#### 신규 항목 추가 (EPIC-VAL 확장)

| VAL ID | 제목 | 단계 | 원칙 | 설명 |
|--------|------|------|------|------|
| **VAL-7** | 실CVE 재현 (S13 벤치 재점검) | Sprint 13 | 빠름 | Benchmark OWASP-2021 + CWE-20,89,78... 재현 자동화. 기존 VAL-1 범위 확장. |
| **VAL-8** | 도구 비교: Semgrep vs CodeQL | S13말~14 | 비용 | 정량 고정SAST vs LLM-SAST 탐지율(TPR/FPR/F1) 비교표. 시장 차별화. |
| **VAL-9** ⭐ | **패치 유효성 검증** | S14 | 즉효·차별 | 패치 적용→재스캔 소거율 + 대상 테스트 무회귀(delta). **경쟁 도구(Semgrep/CodeQL)가 구조적으로 못 내는 수치** → 최대 차별점. |
| **VAL-10** | 결정성/안정성 측정 | S13 | 공짜 | Jaccard 계수(반복 분석 간 결과 일관성) → "LLM 매번 다르지 않나"에 정량 응답. VAL-3(AST 가드)의 효과 검증. |
| **VAL-11** | CWE 커버리지 매트릭스 | S13 | 비용 | Top-25 CWE 탐지 범위 & 거짓음성(FN) 수치. 카테고리별 강점 시각화. |
| **VAL-12** | 분석기 적대적 견고성 | S14+ | 비용 | 패턴 혼동(예: 의심 코드→무해로 난독화) 시 재스캔 정확성. advanced adversarial benchmark. |
| **VAL-13** | SARIF 출력 검증 | S13말~14 | 공짜 | SBOM/IDE/SIEM 연동 표준 출력. 단위테스트만으로 다룸. |

#### 정합 확인 (중복 제거)
- **기존 VAL-1** (OWASP Benchmark): VAL-7로 확장 유지
- **기존 VAL-2** (eval CI 게이트): 그대로 유지
- **기존 VAL-3** (AST 가드): 별도
- **기존 VAL-4** (Juliet/DAST): VAL-1/VAL-4 범위 확장으로 흡수 → WebGoat·Juice Shop 추가
- 메모의 "성능 벤치마크": VAL-10(결정성)과 구분 → 별도 이슈화 대기
- 메모의 "감시 타이핑 검증": Taint Analysis(기존 계획)에 통합

#### 메모 2종 보강 사항
1. `SECUREAI_BENCHMARK_GUIDE.md`:
   - OWASP Benchmark 확대: Top-25 CWE 커버리지 추가 (VAL-11)
   - 패치 검증 섹션 신규 (VAL-9: 소거율 측정, 무회귀 테스트)
   - Semgrep/CodeQL 비교 (VAL-8): TPR/FPR/F1 명시

2. `SECUREAI_VALIDATION_ROADMAP.md`:
   - S13 ~ S14 분할 재정의
   - VAL-9 (패치 유효성): 최우선 & 차별화 → 강조

### 2. Sentry DSN 구성 — 3개 권장 (아키텍처 정정)

#### 의논 내용 — "단일 DSN vs 서비스별 3개"

**최종 결정: 서비스별 3개 DSN 권장**

근거:
- **이슈스트림 분리**: Backend, AI Engine, Frontend 각각 독립적 이슈 추적 (noise isolation)
- **플랫폼별 grouping**: 프론트엔드는 소스맵/세션정보, 백엔드는 트랜잭션 추적, AI는 모델 context 필요 → DSN별 규칙 달라짐
- **쿼터 & 알림**: Sentry 무료 플랜 = 쿼터·이벤트 한도가 계정 단위 (프로젝트 개수 무관) → 비용 증가 없음
- **기존 코드 이미 3개 전제로 배선됨**: docker-compose 환경변수 + env-gated (단일 DSN에서 선택적 활성화 가능하지만 아키텍처상 분리가 나음)

#### 구현 현황 & env 예시 확정

**docker-compose.yml 환경 전달**:
```yaml
services:
  backend:
    environment:
      BACKEND_SENTRY_DSN: https://key1@sentry.io/project1  # Backend 프로젝트
  ai_engine:
    environment:
      AI_ENGINE_SENTRY_DSN: https://key2@sentry.io/project2  # AI Engine 프로젝트
  frontend:
    environment:
      NEXT_PUBLIC_SENTRY_DSN: https://key3@sentry.io/project3  # Frontend Client
      SENTRY_DSN: https://key3@sentry.io/project3  # Frontend Server (동일 프로젝트)
```

**코드 배선**:
- Backend: `SentryConfiguration.java` → `@Value("${BACKEND_SENTRY_DSN:}")` 초기화
- AI Engine: `sentry_filter.py` → `os.getenv("AI_ENGINE_SENTRY_DSN")`
- Frontend: `sentry.client.config.ts` + `sentry.server.config.ts` → `process.env.NEXT_PUBLIC_SENTRY_DSN` / `process.env.SENTRY_DSN`

**신규 파일**: 커밋 `6f240e8` docs(env)
- `.env.example` (Backend/AI): `BACKEND_SENTRY_DSN=`, `AI_ENGINE_SENTRY_DSN=` 추가
- **`apps/frontend/.env.local.example`** (新): Frontend 전용 env 예시
  ```
  NEXT_PUBLIC_SENTRY_DSN=https://key@sentry.io/project3
  SENTRY_DSN=https://key@sentry.io/project3
  ```

### 3. 미커밋 WIP (의도적 보존)

세션 중 사용자 수동테스트 진행 중 발생한 변경물이 워킹트리에 미커밋 상태 존재:

**패키지 의존성** (커밋 가치 있음):
- `apps/frontend/package.json`, `package-lock.json`: `@sentry/nextjs` 정식 추가
  → **다음 세션에서 정식 커밋 권장** (테스트 완료 후)

**Sentry 실 검증 코드** (일회성, 정리 권장):
- `apps/backend/src/main/java/org/.../admin/controller/SentryTestController.java`: 테스트 이벤트 발송용
- `apps/backend/src/main/java/org/...` (디렉토리): 관련 파일들
  → **다음 세션에서 삭제** (테스트 완료 후)

**설정/스택 파일** (검토 후 정식 반영 여부 결정):
- `apps/ai_engine/main.py` (수정): Sentry 초기화 코드
- `docker-compose.yml` (수정): Sentry 환경변수 추가
  → 메인 스택에 이미 병합됨(1d118a7), 워킹트리 변경분은 추가 수정 사항 확인 필요

### 4. 다음 세션에서 할 것

#### WIP 정리 (우선순위 높음)
- [ ] **정식 커밋**: `apps/frontend` @sentry/nextjs 의존성 및 설정 → `commit -m "deps(frontend): add @sentry/nextjs for error tracking"`
- [ ] **일회성 삭제**: SentryTestController + org/ 디렉토리 정리
- [ ] **검토**: main.py, docker-compose.yml 수정분 → 정식 반영 or 롤백

#### 수동검증 (기존 이월)
- [ ] Loki 실로그 적재 (LogQL 쿼리 검증)
- [ ] Sentry 실 DSN 이벤트 도달 검증
- [ ] CI 게이트 실동작 (npm audit, ZAP)

#### 다음 스테이지
- [ ] `/sprint 13` 착수: EPIC-VAL(VAL-1, 3, 4, 7, 10, 11) 편성 + DoD 확정
- [ ] `/stage 7`: TASK-1205 (백업·S3) — 트랙 B 마지막
- [ ] `/stage`: TASK-1210 (트랜잭션 이메일) — 트랙 A 잔여

### 형상 상태 (후반부 종료)

- **main HEAD**: 6f240e8 (Sentry DSN env 예시 추가)
- **origin 동기화**: 완료
- **워킹트리**: 미커밋 WIP 존재 (Sentry 실 검증 코드) — 다음 세션에서 정리
- **추가 커밋**: 
  - `4f2a761`: docs(validation) — EPIC-VAL 확장
  - `6f240e8`: docs(env) — Sentry DSN 예시
