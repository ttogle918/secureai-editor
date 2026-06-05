# [2026-06-06] 작업 세션 요약

**브랜치**: `main`  
**작업 범위**: TASK-1105 (Sprint 11 수동검증 부채 청산) — 실스택 런타임 검증 중 실배포 블로커 버그 1건 발견·수정 + 부채대장 작성 + ZAP 하니스 백로그 등록

---

## 1. 완료 작업

| 항목 | 주요 파일 |
|------|---------|
| 스택 전체 기동 (docker compose up -d) + npm run dev | `docker-compose.yml`, `apps/frontend/` |
| 런타임 검증 18항목 트리아지: SBOM 파서·야간스캔·GDPR·시크릿·ROI·스캔모드·Nginx 리다이렉트·백엔드·프론트 테스트 | `docs/sprints/sprint-11-task-1105-verification.md` |
| BUG-1105-1 발견·수정: k6 부하검증에서 MailHealthIndicator SMTP 락 → health p95 14.78s·에러59.94% | `apps/backend/src/main/resources/application.yaml` |
| 부채대장 작성 및 Sprint 10 체크리스트 갱신 | `docs/sprints/sprint-11-task-1105-verification.md`, `docs/sprints/sprint-10.md` |
| TASK-1203b 신규 등록: OWASP ZAP DAST 스캔 하니스 (Sprint 12 배정) | `docs/07_SPRINT_BACKLOG_V2.md` |
| 테스트 계정 생성: devtest@secureai.test | DB `users` 테이블 직접 처리 (email_verified=true) |

---

## 2. 의논 내용 & 결정 맥락

### 스프린트 우선순위 선택
이전 세션이 남긴 3안(Sprint 11 잔여 / Sprint 13 착수 / Sprint 12) 중 **(a) TASK-1105 수동검증 부채청산**을 선택.
- **이유**: 실배포 단계에서 발견될 버그를 사전에 잡는 것이 비용 대비 효과 최대 — 운영 k8s 환경에서 health 프로브 락이 모든 Pod 재시작으로 전파될 수 있었음.

### k6 부하검증의 핵심 수확
단순 "p95 초과" 기록에 그치지 않고 백엔드 로그 추적 → SMTP-in-health 안티패턴 발견.
- **근본 원인**: Spring Boot `MailHealthIndicator` 자동등록이 `/actuator/health` 호출마다 실시간 SMTP 로그인 시도 → Gmail "454 Too many login attempts" 계정락 → readiness DOWN(503) 연쇄.
- **검증 의미**: 단위테스트로는 절대 못 잡는 결함을 부하검증이 잡음 (TASK-1105 존재 이유 입증).

### 수정 방식 검토
3가지 대안 검토 및 최종 선택:
1. **그룹 제외** (`management.health.include` 제거): aggregate `/actuator/health`가 여전히 SMTP 호출하므로 근본해결 불가.
2. **캐싱**: 부하 시 재발 가능성 높음.
3. **비활성화** (`management.health.mail.enabled=false`): **Reviewer 승인**. 메일 발송 무영향, k8s readiness에 SMTP 가용성 포함은 안티패턴.

**재검증 결과**: health 응답시간 1s→12ms, k6 p95 9.52ms·에러0%·5405/5405 PASS.

### ZAP 하니스 = 구현결함 아닌 인프라 미비
- 레포에 OWASP ZAP 스캔 하니스 0건 → Sprint 8/10 결함으로 처리하지 않고 신규 태스크(TASK-1203b)로 분리.
- 이유: ZAP는 개발자 도구이며, 수동검증의 범위 밖.
- Sprint 12에서 CI 파이프라인 통합 전 로컬 make 하니스 우선 완성 필요.

### 테스트 계정 보안 처리
- 레포 평문 계정 기록 0건 확인 (seed 없음, 기존 계정은 BCrypt 해시).
- 신규 계정 `devtest@secureai.test` 생성하되 **보안규칙상 레포 미커밋**, 유저 로컬 메모리에만 보관.
- 이유: `.env` 미커밋과 동일 원칙 — 실장 중 계정 노출 방지.

---

## 3. 버그 수정 / 특이사항

### BUG-1105-1: MailHealthIndicator SMTP 락 (치명 결함)
- **증상**: k6 부하검증 중 `/actuator/health` p95=14.78s, 에러율=59.94%, 5405건 중 3200건 FAIL.
- **원인**: `MailHealthIndicator` 자동등록이 health 호출마다 실시간 SMTP 로그인 → Gmail 계정락 (454 Too many login attempts).
- **해결**: `application.yaml` `management.health.mail.enabled=false` 적용.
- **검증**: health 응답 1s→12ms, k6 재실행 p95 9.52ms·에러0% 달성.
- **운영 영향**: k8s readiness/liveness 프로브가 주기적으로 health 호출하므로, 이 수정이 없으면 부하 상황에서 Pod 재시작 연쇄 발생 가능.

### 스택 기동 시 Windows 특이사항
- `make` 명령어 미설치 → `docker compose` 직접 사용.
- Docker Desktop 사용자 기동 필요 (자동화 불가).
- 전체 서비스 기동 시간: ~60초 (backend/ai_engine/nginx/postgres/redis/prometheus/grafana/jaeger 병렬 시작).

---

## 4. 다음 세션에서 할 것

- [ ] `git push` (커밋 44f8d54 + 세션로그 커밋) — origin/main 동기화
- [ ] **브라우저 시각확인 5건** (사용자 계정 및 devtest 로그인): /settings, /team→대시보드, /projects/{id}/compliance, /editor 스캔모드UI, ROI PDF 렌더링
- [ ] VSCode Extension 수동 설치 검증 (사용자)
- [ ] **우선순위 재선택**: Sprint 13 `/stage 1` (EPIC-VAL) vs Sprint 12 계획 (`/sprint 12`, TASK-1201 Webhook + TASK-1203b ZAP 포함)
- [ ] (잔여 정리) git remote URL 이전: secureaiengine.git → secureai-editor.git (push 경고 해소)
- [ ] (잔여 정리) 시크릿스캔 100파일 실측 소요시간 기록 (기준: 15분)

**스택 상태**: backend 8080 + 프론트 3000 실행 중 (사용자 시각확인용)

