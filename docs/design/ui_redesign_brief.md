# SecureAI — UI 리디자인 브리프

> 작성일: 2026-05-17 | 브랜치: `refactor/http-client-hardening`  
> 목적: 디자이너(Claude / Figma / Canva)에게 전달할 리디자인 요청 문서

---

## 1. 제품 개요

| 항목 | 내용 |
|------|------|
| 제품명 | SecureAI Engine |
| 유형 | AI 기반 보안 분석 플랫폼 (SAST + DAST + 패치 추천), B2B SaaS |
| 타겟 사용자 | 개발자, 보안팀, 팀 관리자 (3가지 페르소나) |
| 톤 & 무드 | 전문적 + 신뢰감 / VSCode 에디터 느낌 + 보안 대시보드 |
| 스택 | Next.js 15, Monaco Editor, Zustand, Tailwind CSS, shadcn/ui |
| 다크모드 | 기본 다크모드, 라이트모드 옵션 제공 |
| 반응형 | 에디터 화면은 데스크탑 전용 허용, 나머지는 모바일 반응형 |

---

## 2. 현재 구조 (리디자인 기준점)

```
┌─────────────────────────────────────────────────────────────┐
│  AppHeader (로고 / 프로젝트 선택 / 사용자 메뉴)              │
├──────────┬──────────────────────────┬────────────────────────┤
│          │  [에디터 탭] [대시보드 탭] │                        │
│ FileTree │──────────────────────────│   RightPanel           │
│ (파일    │                          │   ├ VulnPanel (취약점)  │
│  트리)   │   Monaco Editor          │   ├ ChatPanel (AI 채팅) │
│          │   (코드 + 취약점 하이라이트)│   ├ DastTerminal       │
│          │                          │   └ VulnDetailPanel    │
└──────────┴──────────────────────────┴────────────────────────┘
```

**주요 문제점 (현행)**
- 에디터 ↔ 대시보드 전환이 탭 하나뿐 → 맥락 전환이 어색함
- 오른쪽 패널이 취약점/채팅/DAST를 탭으로 전환 → 동시 확인 불가
- 빈 상태(Empty State) UX 없음 — 첫 진입 사용자가 어디서 시작할지 모름
- 알림/진행 상태가 전역으로 노출되지 않음

---

## 3. 완성된 백엔드 기능 — 반드시 UI에 노출

> 아래 기능은 백엔드 API가 완성된 상태. 프론트엔드 UI가 없거나 불완전한 항목 포함.

### 3.1 인증 & 사용자
- [x] 이메일/비밀번호 로그인 & 회원가입
- [x] 이메일 인증 (`/auth/verify-email`)
- [x] GitHub OAuth 로그인
- [x] 비밀번호 재설정
- [x] BYOK (Bring Your Own Key) — 사용자 API 키 등록/제거
- [x] AI 모델 선택 (Haiku / Sonnet / Opus) + 크레딧 비용 표시
- [x] 크레딧 잔액 조회

### 3.2 프로젝트 & 분석
- [x] 프로젝트 CRUD (생성/조회/수정/삭제)
- [x] 분석 세션 시작
- [x] SSE 실시간 진행 로그 (파일별 진행률)
- [x] 분석 재개 (`/resume`) — UI 부재 ⚠️
- [x] 분석 중단 (`/stop`) — UI 부재 ⚠️
- [x] 분석 이력 조회

### 3.3 취약점 & 패치
- [x] 취약점 목록 (심각도/DAST 상태 필터)
- [x] 취약점 상세 (CWE, OWASP, 코드 스니펫, 호출 체인)
- [x] 패치 코드 추천 (원본 ↔ 패치 diff)
- [x] AI 채팅 (SSE 스트리밍, 맥락 유지)
- [x] 진행 체크리스트 MD 자동 표시

### 3.4 DAST (동적 분석)
- [x] 개별 취약점 DAST 테스트 시작
- [x] DAST 실행 터미널 (ANSI 컬러 로그 실시간)
- [x] DAST 결과 조회 (SUCCESS / FAILED / TIMEOUT 상태)
- [x] 도메인 소유권 확인 (DNS TXT 레코드)

### 3.5 GitHub 연동
- [x] GitHub 레포 연동 스캔 (`POST /analysis/github-scan`) — UI 부재 ❌
- [x] GitHub PR 리뷰 이력 (Webhook 기반)
- [x] Webhook URL 표시 & 복사
- [x] 커밋 시크릿 스캔 트리거 (`POST /analysis/commit-scan`) — UI 부재 ❌

### 3.6 SBOM & CVE
- [x] SBOM 파싱 결과 조회 — UI 부재 ❌
- [x] CVE 매칭 결과 조회 — UI 부재 ❌

### 3.7 팀 & 조직
- [x] 조직(Organization) 생성/조회
- [x] 팀 멤버 초대 (이메일 발송)
- [x] 초대 수락 페이지 (`/invite/[token]`)
- [x] 멤버 역할 관리 (owner / admin / member)

### 3.8 플랜 & 관리자
- [x] 플랜 조회 & 비교
- [x] SAST 사용량 표시 (월별)
- [x] 관리자 — 사용자 목록 조회
- [x] 관리자 — 플랜 관리

---

## 4. 추가 설계해야 할 화면 (현재 ❌ 없음)

### 4.1 핵심 — 없으면 기능 접근 불가

| 화면 | 설명 | 우선순위 |
|------|------|---------|
| **GitHub 레포 스캔 설정** | 레포 선택 → 브랜치 선택 → 스캔 시작 플로우 | 🔴 Critical |
| **커밋 시크릿 스캔** | 커밋 범위 선택 입력, 진행률, 탐지된 시크릿 목록 표시 | 🔴 Critical |
| **SBOM & CVE 결과** | 의존성 목록, CVE 심각도 배지, 영향받는 버전 표시 | 🔴 Critical |
| **분석 재개/중단 UX** | 진행 중 세션이 있을 때 "재개" / "새로 시작" / "중단" 옵션 모달 | 🟠 High |

### 4.2 Sprint 7 선 디자인 (백엔드 구현 예정)

| 화면 | 설명 | 우선순위 |
|------|------|---------|
| **PDF 리포트 생성/다운로드** | 리포트 생성 트리거 버튼, 생성 진행 상태, 다운로드 토큰 기반 다운로드 | 🔴 Critical |
| **대시보드 독립 뷰** | SecurityScoreRing, SeverityBarChart, TrendLineChart, FileHeatmap, OwaspCoverageMatrix 통합 | 🟠 High |
| **알림 센터** | 분석 완료, 새 CVE 발견, SLA 초과 알림 목록 (헤더 벨 아이콘) | 🟠 High |
| **온보딩 플로우** | 신규 사용자 최초 진입 → 프로젝트 생성 → 첫 분석 시작 가이드 (Step 1/2/3) | 🔴 Critical |

### 4.3 UX 품질 개선

| 기능 | 설명 | 우선순위 |
|------|------|---------|
| **전역 검색** (Cmd+K) | 취약점 / 파일 / 프로젝트 검색 패널 — IDE 필수 기능 | 🟠 High |
| **키보드 단축키 오버레이** | `?` 누르면 단축키 목록 팝업 | 🟡 Medium |
| **빈 상태 (Empty State)** | 취약점 0개 / 첫 프로젝트 전 / 스캔 전 각각 다른 일러스트 + CTA | 🔴 Critical |
| **에러 상태** | AI 서버 다운 / 타임아웃 / 분석 실패 각각의 UX (토스트 + 패널) | 🟠 High |
| **로컬 폴더 열기** | showDirectoryPicker API — 드래그앤드롭 또는 버튼 | 🟡 Medium |

---

## 5. 화면별 플로우 다이어그램

### 5.1 신규 사용자 온보딩
```
랜딩 → 회원가입 → 이메일 인증 → [온보딩 Step 1: 프로젝트 생성]
  → [Step 2: 분석 소스 선택 (로컬폴더 / GitHub 레포 / 파일 업로드)]
  → [Step 3: 첫 분석 시작] → 에디터(분석 진행 중)
```

### 5.2 분석 시작 플로우 (기존 사용자)
```
에디터 진입
  → 진행 중 세션 있음? → 재개 / 새로 시작 / 중단 모달
  → 진행 중 세션 없음? → 분석 소스 선택 → 분석 시작
```

### 5.3 DAST 플로우
```
취약점 목록 → 개별 취약점 선택 → [DAST 테스트 버튼]
  → 동의 모달 (도메인 소유 확인) → DAST 터미널 (실시간 로그)
  → 결과 패널 (EXPLOITED / FAILED / TIMEOUT 배지)
```

### 5.4 GitHub 레포 스캔 플로우
```
에디터 or 설정 → [GitHub 레포 스캔] 버튼
  → 레포 선택 드롭다운 (OAuth 연동 레포 목록)
  → 브랜치 선택 → 스캔 대상 파일 필터 (선택)
  → 스캔 시작 → SSE 실시간 진행 → 결과 에디터 뷰
```

---

## 6. 디자인 시스템 요구사항

### 6.1 컬러 토큰 (현행 추정 + 확장)
```
--color-bg-primary      : #0d1117 (dark) / #ffffff (light)
--color-bg-secondary    : #161b22 (dark) / #f6f8fa (light)
--color-bg-surface      : #21262d (dark) / #ffffff (light)
--color-border          : #30363d (dark) / #d0d7de (light)
--color-text-primary    : #e6edf3
--color-text-secondary  : #8b949e
--color-accent          : #388bfd  (blue — 주 CTA)
--color-success         : #3fb950  (green)
--color-warning         : #d29922  (yellow)
--color-danger          : #f85149  (red)
--color-critical        : #ff4444  (취약점 CRITICAL)
--color-high            : #ff8800  (취약점 HIGH)
--color-medium          : #ffcc00  (취약점 MEDIUM)
--color-low             : #22c55e  (취약점 LOW)
```

### 6.2 타이포그래피
```
코드 영역   : JetBrains Mono / Fira Code (monospace)
UI 텍스트   : Inter / Geist Sans
제목        : 16-24px, font-weight: 600
본문        : 14px, font-weight: 400
캡션/배지   : 12px, font-weight: 500
```

### 6.3 컴포넌트 라이브러리
- 기반: `shadcn/ui` (Radix UI 기반)
- 아이콘: `lucide-react`
- 차트: `recharts` (이미 사용 중)
- 에디터: `@monaco-editor/react`

### 6.4 반응형 브레이크포인트
```
mobile  : < 768px  → 에디터 숨김, 취약점 목록 + 채팅만
tablet  : 768-1280px → 2단 (에디터 + 패널)
desktop : > 1280px → 3단 풀 레이아웃
```

---

## 7. 디자이너에게 전달할 요청 프롬프트 (템플릿)

```
[제품 개요]
SecureAI Engine — AI 기반 보안 분석 플랫폼 (SAST + DAST + 패치 추천)
- 타겟: 개발자/보안팀, B2B SaaS
- 톤: 전문적 + 신뢰감, VSCode 에디터 느낌 + 보안 대시보드

[현재 구조]
3단 레이아웃: 파일트리 | Monaco 에디터 | 취약점/채팅 패널
상단 탭: 에디터 ↔ 대시보드 전환

[리디자인 요청]
1. 전체 페이지 목록 (섹션 3~4 참조)에 대한 UI 리디자인
2. 디자인 시스템 수립 (컬러 토큰, 타이포그래피, 컴포넌트)
3. 특히 중요한 화면: 메인 에디터, 온보딩 플로우, SBOM/CVE 결과, 대시보드

[완성된 백엔드 기능]
(섹션 3의 전체 목록)

[추가 요구사항]
- 다크모드 기본, 라이트모드 옵션
- 모바일 반응형 (에디터는 데스크탑 전용 허용)
- Tailwind CSS + shadcn/ui 기반
- Design token 시스템 구성
- 빈 상태(Empty State)와 에러 상태 UX 포함
- 전역 검색 (Cmd+K), 알림 센터 포함
```

---

## 8. 작업 순서 (권장)

```
Phase 1 — 디자인 (현재)
  1. 디자인 시스템 수립 (컬러 토큰, 타이포그래피, 컴포넌트)
  2. 핵심 화면 리디자인 (에디터, 대시보드, 온보딩)
  3. 미구현 화면 신규 설계 (SBOM, GitHub 스캔, 시크릿 스캔)
  4. 빈 상태 & 에러 상태 UX

Phase 2 — 코드 품질 (다음)
  1. useChat.ts 토큰 관리 통일 (localStorage → getAccessToken)
  2. API Base URL 중앙화 (lib/api/client.ts)
  3. SSE 연결 방식 통일
  4. R-00-B: DastController IP 검증 강화

Phase 3 — 미구현 기능 UI 코딩
  1. SBOM & CVE UI
  2. GitHub 레포 스캔 UI
  3. 커밋 시크릿 스캔 UI
  4. 분석 재개/중단 모달
  5. PDF 리포트 다운로드
  6. 온보딩 플로우
  7. 알림 센터
```

---

*관련 문서: `principles.md` (설계 원칙), `../07_SPRINT_BACKLOG_V3.md` (기능 백로그)*
