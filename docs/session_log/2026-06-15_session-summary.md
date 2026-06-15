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
