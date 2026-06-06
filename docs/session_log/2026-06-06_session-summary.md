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

---

# (이어서) 시각확인 중 2번째 버그 발견·수정 + 사용자 매뉴얼

> 위 /done 이후 사용자가 브라우저 시각확인을 진행하며 추가로 발생한 작업.

## 5. BUG-1105-2 — 팀 초대 버튼 미표시 (실버그) ✅ 수정 (`1e4ea2d`)

- **발견 경위**: 사용자가 `/team/team1/members`에서 "팀 초대가 안 보여"라고 보고. team1 owner인데도 초대 버튼이 안 보임.
- **근본원인**: `GET /api/v1/organizations/{slug}` 응답 DTO(`OrgResponse`)에 요청자 역할(`role`)이 없고, `getOrg` 컨트롤러가 `@AuthenticationPrincipal`를 안 받음 → 프론트 멤버 페이지의 게이팅 `isAdminOrAbove = meta.role === 'owner'|'admin'`이 **항상 false** → 초대/역할변경/강퇴 버튼이 owner 포함 전원에게 숨겨짐.
- **실측 확인**: devtest로 `GET /organizations/team1` 호출 시 응답에 role 키 자체가 없음.
- **수정 (Dev 위임)**: `OrgResponse`에 `String role` 추가, `getOrg`에 userId 수신, `OrganizationService.toOrgResponse(org,userId)`로 통일해 `orgMemberRepository`로 요청자 role 조회(비멤버/미수락 null). `listMyOrgs/createOrg/updateOrg` 동일. 단위테스트 4건 추가(owner/member/비멤버/listMyOrgs) → 13건 통과.
- **Reviewer**: PASS (비멤버 role=null은 `authenticated()` 게이트라 정보노출 확대 아님). 후속 non-blocking: `listMyOrgs` N+1 → 벌크조회 개선 권고.
- **재검증**: 백엔드 재빌드 후 `GET /organizations/team1`(owner) → **`role="owner"`** 확인. 초대버튼 표시조건 충족.
- **의미**: BUG-1105-1(부하)에 이어 **시각확인이 잡은 2번째 실버그**. 팀 협업 기능 전체(초대 없으면 멤버 못 늘림)를 막던 결함.

## 6. 사용자 매뉴얼 HTML 작성 (`1ea1f3b`)

- 사용자 요청: 배포 시 보여줄 **실동작형 UI 매뉴얼**, 빨간 네모로 클릭 유도 + 단계 표시, 전 기능.
- **산출물**: `docs/manual/2026-06-06/index.html` (+ README). 단일 HTML, 외부 의존성 0.
  - 17개 기능을 카테고리별 사이드바 + 단계별 진행(이전/다음·키보드 ←→) + **빨간 점선 하이라이트(👆 힌트)** + `기능 N/17·단계 N/M` 인디케이터.
  - 회원가입·이메일인증·로그인(이메일/GitHub)·온보딩·코드분석·취약점트리아지/오탐·AI채팅·스캔모드·GitHub스캔·시크릿스캔·Compliance·SBOM·대시보드/ROI PDF·팀초대·설정·프로필·로그아웃.
  - Pagori 실제 디자인 토큰(Dark OLED + Orange `#f97316`) 기반 충실 목업(브라우저 캡처 도구 부재로 실 스크린샷 대신 목업, 라우트·동선은 코드와 일치).

## 7. 마무리 처리

- **테스트 계정**(재확인): `devtest@secureai.test` / `Test1234` — team1 owner, 이메일 인증 완료. 로컬 메모리(`local-dev-test-account.md`)에 보관, 레포 미커밋.
- **git remote URL 이전 완료**: `secureaiengine.git` → `secureai-editor.git` ("repository moved" 경고 해소).
- **부채대장 갱신**(`8796787`): BUG-1105-2 추가, TeamMgmt 항목 ✅로 전환. 집계 = ✅검증완료 **10** / 🐞수정 **2** / 👁시각대기 **4**(팀대시보드·ROI PDF·스캔모드UI·Compliance) / ✋VSCode 1 / 🧰ZAP 1 / ⏭이월 2.

## 8. 이번 세션 전체 커밋 (origin/main 동기화, HEAD=`8796787`)

| 커밋 | 내용 |
|------|------|
| `3edb524` | fix(backend): MailHealthIndicator 비활성화 (BUG-1105-1) |
| `ed6a1dc` | docs(sprint): 부채대장 작성 + Sprint10 체크리스트 |
| `44f8d54` | docs(backlog): TASK-1203b ZAP 하니스 (실제 파일 = `07_SPRINT_BACKLOG_V4_260523.md`) |
| `316eb79` | docs(session): 세션 로그(전반부) |
| `1e4ea2d` | fix(backend): OrgResponse role 추가 (BUG-1105-2) |
| `1ea1f3b` | docs(manual): 사용자 매뉴얼 HTML |
| `8796787` | docs(sprint): 부채대장 BUG-1105-2 반영 |

## 9. 다음 세션에서 할 것 (갱신)

- [ ] **남은 시각확인 4건**: 팀대시보드(/team/{slug}) · ROI PDF(/editor 대시보드 Executive) · 스캔모드 UI · Compliance(/projects/{id}/compliance). → 끝나면 Sprint 11 공식 종료(부채대장 잔여 0).
- [ ] VSCode Extension 수동 설치 검증.
- [ ] **우선순위 재선택**: Sprint 13 `/stage 1`(EPIC-VAL) vs `/sprint 12`(TASK-1201 Webhook + 1203b ZAP).
- [ ] (잔여) 시크릿스캔 100파일 실측 시간 / listMyOrgs N+1 개선 태스크화.

