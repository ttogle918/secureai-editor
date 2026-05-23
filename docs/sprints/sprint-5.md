# Sprint 5 — GitHub Layer 2 완성
**기간**: 2026-05-14 ~ 2026-05-28 (Week 11–12)  
**목표**: 커밋 히스토리 시크릿 스캔 + PR Webhook 자동 보안 리뷰 + SAST 최적화 + SBOM 완성

---

## 실행 계획

### 선행 조건 (스프린트 착수 전 필수)

```
1. feat/sprint4 PR 생성 및 main 머지 (patch_node 코드)
2. feat/frontend-ui PR #62 머지
3. feat/i18n PR #63 머지
4. git checkout -b feat/sprint5
5. .env.local에 GITHUB_PAT 추가 + 통합 테스트용 레포 준비
```

---

### 이월 태스크 (최상단 우선 처리)

| 출처 | 태스크 | 내용 | 우선순위 |
|------|--------|------|---------|
| Sprint 3→5 | TASK-303 통합 테스트 8건 | GitHub API 실제 연동 검증 (공개·비공개 레포, 파일 트리, 바이너리 제외 등) | P0 |
| Sprint 4 | patch_node 동작 검증 | `/sessions/{id}/patches` 실제 응답 확인 | P0 |
| Sprint 4 | AuthController 보안 수정 | URL 토큰 노출 + Open Redirect 2건 | P1 (보안) |
| Sprint 4 | NVD API 실제 CVE 조회 | 실제 NVD 네트워크 호출 검증 | P2 |

---

### 태스크 목록

| 순서 | TASK | 제목 | 중요도 | 선행 태스크 | 담당 레이어 | 복잡도 |
|------|------|------|--------|------------|------------|--------|
| 0-A | **이월** TASK-303 통합 | GitHub API 실제 연동 검증 | 🔴 P0 | — | BE+AI | 낮음(검증) |
| 0-B | **이월** patch_node 검증 | `/sessions/{id}/patches` 실제 응답 | 🔴 P0 | feat/sprint4 머지 | AI+BE | 낮음(검증) |
| 0-C | **이월** AuthController 보안 | URL 토큰 노출·Open Redirect 수정 | 🔴 P1 보안 | — | BE | 낮음 |
| 1 | TASK-501 | GitHub 커밋 히스토리 시크릿 스캔 | 🔴 Critical | 0-A | MCP+AI+BE | 높음 |
| 2 | TASK-504 | SBOM 완성 & CVE 매칭 | 🟠 High | 0-A | AI+BE | 높음 |
| 3 | TASK-503 | GitHub SAST 전체 파일 최적화 | 🟠 High | 0-A | AI | 중간 |
| 4 | TASK-502 | GitHub PR Webhook 자동 보안 리뷰 | 🔴 Critical | TASK-501·503 | BE+MCP | 높음 |
| 5 | TASK-505 | GitHub 연동 설정 UI | 🟡 Medium | TASK-502 | FE | 중간 |

---

### 병렬 실행 그룹

```
0단계 — 이월 처리 (동시 시작, 블로커 해제)
├── 0-A: TASK-303 GitHub API 실제 연동 검증 (8개 통합 테스트)
├── 0-B: patch_node 동작 검증 → /sessions/{id}/patches 응답 확인
└── 0-C: AuthController 보안 수정 (URL 토큰 노출, Open Redirect)

          ↓ 0-A 완료 후 (GitHub API 동작 확인됨)

1단계 — 핵심 기능 (동시 진행)
├── TASK-501: list_commits.ts + get_commit_diff.ts + 시크릿 탐지 노드 + CommitHistoryScanner.java
├── TASK-504: 의존성 파일 감지 + SBOM 파서 4종 + CVE 매칭 + CycloneDX JSON
└── TASK-503: 파일 우선순위 정렬 + asyncio.gather 병렬화 + 진행률 SSE 정확도

          ↓ TASK-501 + TASK-503 완료 후

2단계 — Webhook 통합
└── TASK-502: GitHubWebhookController (HMAC) + PR diff 스캔 + create_pr_comment.ts + Check Run API

          ↓ TASK-502 완료 후

3단계 — UI 마무리
└── TASK-505: 설정 페이지 GitHub 섹션 + PrReviewHistory.tsx + 저장소 목록 드롭다운
```

---

### 리스크 & 완화 전략

| 리스크 | 영향 | 완화 |
|--------|------|------|
| GitHub Webhook 로컬 수신 불가 | TASK-502 차단 | ngrok 터널 또는 GitHub Codespaces 활용 |
| TASK-303 통합 테스트 — GitHub 토큰 없음 | 0-A 전체 블록 | `.env.local`에 `GITHUB_PAT` 추가, 테스트 레포 준비 |
| SBOM 파서 4종 생태계 차이 | TASK-504 범위 초과 | pom.xml·package.json·requirements.txt·go.mod 4개로 한정 |
| AuthController PR 배포 전 보안 노출 | 실제 서비스 취약 | 0-C를 최우선 처리, 별도 커밋으로 분리 |
| feat/sprint4 미머지로 인한 코드 불일치 | patch_node 검증 불가 | 0단계 시작 전 3개 브랜치 모두 머지 확인 |

---

### 테스트 마일스톤

| # | 마일스톤 | 달성 기준 | TASK |
|---|---------|---------|------|
| M0 | 이월 해소 | GitHub API 실제 레포 파일 목록 조회 + patches 응답 확인 | 이월 0-A/0-B |
| M1 | 시크릿 탐지 | 삭제된 시크릿 커밋 → 탐지 리포트 생성 ⭐ | TASK-501 |
| M2 | SBOM 완성 | pom.xml → CVE 매칭 JSON 내보내기 | TASK-504 |
| M3 | GitHub 3단계 검사 | API 스캔 + 전체 파일 SAST + 히스토리 스캔 모두 동작 ⭐ | 503+501 |
| M4 | PR Webhook | PR 생성 → 자동 분석 → GitHub 코멘트 등록 ⭐ | TASK-502 |
| M5 | UI 완성 | 설정 페이지에서 저장소 선택 + PR 이력 확인 | TASK-505 |

---

### 완료 기준 (DoD)

```
[ ] GitHub 커밋 히스토리에서 삭제된 시크릿 탐지 ⭐
[ ] PR 생성 → 자동 분석 → PR 코멘트 등록 ⭐
[ ] GitHub 레포 100개+ 파일 15분 내 완료
[ ] SBOM 4개 생태계 파서 + CVE 매칭
[ ] GitHub 3단계 검사 완료 ⭐ (API 코드 + 나머지 파일 + 히스토리)
[ ] AuthController 보안 취약점 2건 수정
```

---

## 구현 완료 기록

<!-- 각 TASK 완료 시 아래에 추가 -->
