# SecureAI — Claude Code 실행 가이드
> 대상: Claude Code를 사용해 SecureAI를 개발할 때 참고하는 메인 가이드  
> 위치: 프로젝트 루트 `docs/11_CLAUDE_CODE_GUIDE.md`  
> 작성일: 2026-04-19

---

## 0. 이 문서의 역할

이 문서는 **Claude Code가 가장 먼저 읽어야 하는 마스터 가이드**입니다.  
개발 시작 시 반드시 이 문서부터 읽고, 여기에 명시된 순서대로 다른 문서를 참조합니다.

**Claude Code 실행 명령 (프로젝트 시작 시)**:
```bash
cd ~/projects/secureai
claude code
```

첫 세션에서 Claude에게 다음 명령을 먼저 전달하세요:

> Please read `docs/11_CLAUDE_CODE_GUIDE.md` first. This is the master guide for this project. Follow the rules and document reading order specified in it.

---

## 1. 문서 읽기 순서 (우선순위)

Claude Code는 아래 순서대로 문서를 읽고 이해해야 합니다.

### Phase 1 — 프로젝트 이해 (필수)

```
1. 11_CLAUDE_CODE_GUIDE.md     ← 이 파일 (마스터 가이드)
2. 00_ARCHITECTURE_DECISIONS.md ← 왜 이렇게 설계했는가 (ADR)
3. 05_ARCHITECTURE_PHILOSOPHY.md ← 모듈러 모놀리스 + 마이크로서비스 하이브리드
4. 06_REPOSITORY_STRUCTURE_V2.md ← 전체 디렉토리 구조 (v2)
```

### Phase 2 — 상세 설계 (구현 시 참조)

```
5. 01_ERD.md                    ← DB 스키마 18개 테이블
6. 02_API_DESIGN.md             ← REST API 50개+
7. 03_DOCKER_INFRA.md           ← Docker 환경 구성
8. 08_CHECKPOINT_FLOW.md        ← 보안 점검 흐름 + 체크포인트 설계
```

### Phase 3 — UI/UX 작업 시 (프론트엔드/모바일만)

```
9. 09_DESIGN_SYSTEM.md          ← 디자인 시스템 MASTER (색상·타이포·간격)
10. 10_UI_UX_REVISIONS.md        ← 기존 UI 수정사항 + 체크리스트
```

### Phase 4 — 스프린트 진행 (매 스프린트 시작 시)

```
11. 07_SPRINT_BACKLOG_V2.md     ← 현재 스프린트의 TASK 확인
```

---

## 2. 개발 진행 룰 (반드시 준수)

### 2.1 🔴 절대 규칙

1. **스프린트 순서대로 개발**
   - Sprint 0부터 Sprint 9까지 순차 진행
   - 현재 스프린트의 TASK를 끝내기 전에 다음 스프린트 TASK 시작 금지
   - 예외: Critical 버그 수정, 스프린트 내부에서 "병렬 가능" 명시된 TASK

2. **한 번에 하나의 TASK**
   - 동시에 여러 TASK를 섞어 작업하지 않음
   - TASK 하나 완료 → 테스트 체크리스트 통과 → 커밋 → 다음 TASK

3. **TASK 완료 기준 = 테스트 체크리스트 전부 통과**
   - `07_SPRINT_BACKLOG_V2.md`의 각 TASK에 있는 🧪/🔬/✅/🛡️ 체크박스를 전부 체크
   - 미완료 항목이 하나라도 있으면 완료 아님

4. **새 기능 추가 전 설계 문서 확인**
   - ERD·API·레포 구조 문서와 다른 설계 시도 금지
   - 변경이 필요하면 먼저 해당 문서를 업데이트한 뒤 구현

5. **보안 규칙 엄수**
   - 민감 정보(`.env`, 키, 토큰)는 절대 커밋 금지
   - `AesEncryptionConverter` 적용 대상 컬럼에서 제외 금지
   - 사용자 입력 검증(`@Valid`) 누락 금지
   - Rate Limit·플랜 체크 우회 코드 작성 금지

### 2.2 🟠 권장 규칙

1. **단위 테스트를 먼저 작성 (TDD)**
   - 기능 구현 전에 테스트부터 작성
   - 각 TASK의 🧪 체크리스트 항목이 테스트 대상

2. **커밋 메시지 규칙** (Conventional Commits)
   ```
   feat(auth): JWT Refresh Token Rotation 구현
   fix(analysis): SSE 연결 끊김 시 재연결 처리
   docs(readme): 빠른 시작 가이드 업데이트
   test(dast): Docker 샌드박스 타임아웃 테스트 추가
   refactor(frontend): useVulnFilter 훅 성능 개선
   ```

3. **PR 단위 작게 유지**
   - 하나의 TASK = 하나의 PR 원칙
   - 500줄 이상 변경되는 PR은 분할

4. **UI 구현 시 항상 Pre-delivery 체크리스트 실행**
   - `10_UI_UX_REVISIONS.md`의 우선순위 🔴 항목부터 확인

### 2.3 🟡 팁

1. **AI 보안 감사 도구를 만들고 있음을 항상 기억**
   - 보안 버그는 프로젝트 자체의 신뢰성 직결
   - 의심스러우면 엄격하게

2. **장애 격리 원칙**
   - AI Agent 장애가 Backend에 영향 주면 안 됨
   - Circuit Breaker fallback 반드시 정의

---

## 3. 빠른 시작 — Sprint 0 TASK 순서

**처음 시작하는 개발자를 위한 추천 순서**:

```
Step 1: TASK-001 (모노레포 초기화)
  → git clone, 디렉토리 골격, .gitignore, Makefile, README

Step 2: TASK-002 (Docker Compose)
  → postgres, redis 먼저 healthy 확인

Step 3a-c (병렬 가능):
  ├─ TASK-003: Spring Boot 초기화
  ├─ TASK-004: Python AI Agent 초기화
  └─ TASK-006: Next.js 프론트엔드 초기화

Step 4: TASK-005 (MCP Server)
  → AI Agent와 MCP 연결 테스트

Step 5: TASK-007 (CI 파이프라인)

Sprint 0 완료 검증: `make dev` → 모든 서비스 healthy
→ Sprint 1로 진입
```

---

## 4. Claude Code에게 제공할 프롬프트 템플릿

### 4.1 새 TASK 시작 시

```
새 TASK를 시작합니다: [TASK-XXX]

참고 문서:
- docs/07_SPRINT_BACKLOG_V2.md 에서 TASK-XXX 섹션 확인
- docs/06_REPOSITORY_STRUCTURE_V2.md 에서 관련 디렉토리 구조 확인
- docs/01_ERD.md 또는 02_API_DESIGN.md 에서 관련 스펙 확인 (필요시)

규칙:
1. TASK의 "하위 할일" 순서대로 구현
2. 각 단계 완료 시 "테스트 체크리스트" 항목도 함께 체크
3. 완료 시 🧪 단위 테스트 + 🔬 통합 테스트 모두 통과 확인
4. 테스트 통과 후 커밋 (Conventional Commits 형식)

시작해주세요.
```

### 4.2 UI 작업 시작 시

```
UI 작업 시작합니다: [TASK-XXX]

필수 참고 문서:
- docs/09_DESIGN_SYSTEM.md 의 색상·타이포·간격 토큰 사용
- docs/10_UI_UX_REVISIONS.md 의 수정 가이드 준수
- 특히 이모지 아이콘 금지 — lucide-react SVG 아이콘만 사용

Pre-delivery 체크리스트 (09_DESIGN_SYSTEM.md 섹션 8):
- [ ] SVG 아이콘 (이모지 X)
- [ ] cursor-pointer 필수
- [ ] focus-visible 링 필수
- [ ] prefers-reduced-motion 대응
- [ ] 375/768/1024/1440 4개 breakpoint 검증
- [ ] 텍스트 대비 4.5:1 이상

작업 시작해주세요.
```

### 4.3 에러 디버깅 시

```
[에러 내용]

다음 순서로 조사해주세요:

1. 설계 문서 확인:
   - 해당 기능이 docs/02_API_DESIGN.md 또는 01_ERD.md 와 일치하는지
2. 관련 TASK의 테스트 체크리스트 확인:
   - docs/07_SPRINT_BACKLOG_V2.md 에서 해당 TASK 찾기
   - 누락된 테스트가 에러 원인인지 확인
3. 로그 분석
4. 수정 + 테스트 케이스 추가

에러의 근본 원인과 수정안을 제시해주세요.
```

---

## 5. 추천 Claude Code 스킬·MCP 설치

프로젝트에 유용한 오픈소스 스킬 리스트. **Sprint 0 시작 전**에 설치 권장.

### 5.1 필수 — UI UX Pro Max

**이유**: SecureAI는 Cybersecurity Platform 카테고리로 전용 규칙이 161개 존재. 디자인 품질 보장.

```bash
# CLI 설치
npm install -g uipro-cli

# 프로젝트 디렉토리에서
cd ~/projects/secureai
uipro init --ai claude

# Design System 생성 (선택, 이미 09_DESIGN_SYSTEM.md 작성됨)
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "cybersecurity platform" --design-system -p "SecureAI" --persist
```

**설치 후 Claude가 자동으로 UI 작업 시 161개 규칙 + 체크리스트 적용.**

### 5.2 강력 권장 — Claude Mem (세션 간 메모리)

**이유**: 20주 장기 프로젝트. 매 세션마다 설계 컨텍스트를 다시 설명하면 시간 낭비.

```bash
# https://github.com/thedotmack/claude-mem 참고 설치
```

### 5.3 권장 — LightRAG (코드베이스 이해)

**이유**: 6개 서비스, 수천 개 파일이 생길 것. Claude가 전체 코드베이스 구조를 그래프 + 벡터로 이해하면 리팩터링·디버깅 효율 상승.

```bash
# https://github.com/hkuds/lightrag 참고
```

### 5.4 권장 — Awesome Claude Code

**이유**: 커뮤니티 검증된 slash 커맨드·훅·오케스트레이터 모음. 개발 중 유용한 스킬 발견.

```bash
# https://github.com/hesreallyhim/awesome-claude-code 참고
```

### 5.5 선택 — Everything Claude Code

**이유**: 보안 스캔 포함 에이전트 하네스. SecureAI가 자기 자신을 분석하는 self-scan CI에 활용 가능.

```bash
# https://github.com/affaan-m/everything-claude-code 참고
```

### 5.6 설치 우선순위 정리

| 우선순위 | 스킬 | 사용처 | 설치 시점 |
|---------|------|-------|---------|
| 🔴 필수 | UI UX Pro Max | UI 작업 전반 | Sprint 0 시작 전 |
| 🟠 강권장 | Claude Mem | 세션 간 컨텍스트 유지 | Sprint 0 시작 전 |
| 🟠 강권장 | LightRAG | 대규모 코드 이해 | Sprint 2 이후 |
| 🟡 권장 | Awesome Claude Code | 커뮤니티 스킬 검색 | 필요 시 |
| 🟢 선택 | Everything Claude Code | 자체 보안 스캔 | Sprint 8 이후 |

---

## 6. MCP 서버 추가 설치 (SecureAI 프로젝트 외부용)

SecureAI 프로젝트 자체의 MCP Server(filesystem, github)는 코드베이스 내부에 있지만,  
**Claude Code가 개발 보조용으로 쓸 외부 MCP 서버**는 별도 설치:

```bash
# GitHub MCP (SecureAI 개발 시 GitHub API 조회용)
# Claude Code 설정에 추가
```

---

## 7. 개발 환경 체크리스트

개발 시작 전 아래가 모두 준비되어야 합니다:

### 로컬 환경
- [ ] Docker Desktop (또는 Docker Engine) 설치
- [ ] Node.js 20.x (nvm 권장)
- [ ] Java 21 (SDKMAN 권장)
- [ ] Python 3.12+
- [ ] Android Studio (Android 앱 개발 시, Sprint 7부터)
- [ ] Gradle 8.x

### 계정·키
- [ ] GitHub 계정 (OAuth App, Webhook)
- [ ] Anthropic API 키 (Claude API)
- [ ] LangSmith 계정 (트레이싱)
- [ ] Firebase 프로젝트 (FCM, Sprint 7부터)
- [ ] NVD API 키 (선택, CVE 동기화)

### 도구
- [ ] GitHub CLI (`gh`) — 이슈 자동 등록에 필요
- [ ] `jq` — JSON 처리
- [ ] `make` — Makefile 실행

### VSCode 확장 (권장)
- [ ] Extension Pack for Java
- [ ] Python (Microsoft)
- [ ] ES7+ React/Redux/React-Native snippets
- [ ] Tailwind CSS IntelliSense
- [ ] Docker
- [ ] Prisma (또는 DB Tool)
- [ ] Thunder Client (API 테스트)
- [ ] GitLens

---

## 8. 스프린트 진행 리듬

### 스프린트 시작 시 (2주 주기)

1. `07_SPRINT_BACKLOG_V2.md` 에서 현재 스프린트 섹션 읽기
2. GitHub Projects에서 해당 스프린트 이슈를 "In Progress" 컬럼으로 이동
3. 스프린트 목표(🎯 Sprint X 완료 기준) 팀 공유
4. TASK 담당자 배정

### 일일 리듬

1. 아침: 어제 진행 상황 + 오늘 작업할 TASK 확인
2. TDD: 테스트 체크리스트 → 테스트 코드 → 구현 → 통과 확인
3. 커밋 + PR 생성 (작업 단위로 자주)

### 스프린트 종료 시

1. 완료 기준 확인 (모든 TASK의 테스트 체크리스트 통과 여부)
2. 미완료 항목 다음 스프린트로 이월 또는 Backlog로 복귀
3. 회고: 무엇이 잘 됐고 무엇이 개선 필요한지

---

## 9. 자주 묻는 질문

### Q1. docs 디렉토리의 설계 문서를 Claude Code가 매번 읽어야 하나요?

**A**. 첫 세션에서 한 번 전체 읽기. 이후 세션부터는 **Claude Mem(세션 간 메모리)** 스킬이 설치되어 있으면 자동으로 컨텍스트 유지. 없을 경우 매 세션 `docs/11_CLAUDE_CODE_GUIDE.md` + 현재 스프린트 문서만 먼저 읽게 지시.

### Q2. 설계 문서와 다르게 구현해도 되는 경우는?

**A**. 다음 3가지 경우에만 허용:
1. 설계 문서에 명백한 오류가 있을 때 → 먼저 문서 수정 PR → 그 후 구현
2. 외부 라이브러리 API 변경으로 문서 내용이 불가능해졌을 때 → ADR 추가
3. 성능·보안 이유로 더 나은 방법을 발견했을 때 → 설계자 리뷰 → 문서 업데이트

### Q3. 테스트를 다 작성하기 어려울 때는?

**A**. 최소한 🛡️ 보안 검증 + 🔬 핵심 통합 테스트는 반드시 통과. 🧪 단위 테스트는 커버리지 60% 이상 목표.  
Sprint 2~4의 백엔드 핵심 로직은 테스트 없이 PR 머지 금지.

### Q4. AI Agent(Python)과 Backend(Spring Boot)를 동시에 개발할 때 충돌은?

**A**. 계약(API 스펙)을 먼저 고정. `02_API_DESIGN.md` 기준으로 OpenAPI 스펙을 작성한 뒤 양쪽 팀/담당자가 각자 목업(mock)으로 개발 → 통합 테스트 단계에서 연결.

### Q5. 와이어프레임 HTML 파일은 어떻게 활용?

**A**. **시각적 레퍼런스**로만 사용. 실제 구현은 `06_REPOSITORY_STRUCTURE_V2.md`의 React 컴포넌트 구조대로 작성하고, UI UX Pro Max 규칙(`10_UI_UX_REVISIONS.md`)에 따라 이모지 아이콘 등 수정 필요.

---

## 10. 이 문서 자체의 유지보수

**업데이트 시점**:
- 새 스프린트 시작 시 — 지난 스프린트에서 배운 교훈 반영
- 아키텍처 변경 시 — 관련 섹션 동기화
- 새 스킬·MCP 추가 시 — 섹션 5, 6 갱신
- Claude Code 도구 업데이트 시 — 섹션 4 프롬프트 템플릿 조정

**유지 관리자**: 프로젝트 리드 (또는 아키텍처 담당)

---

## 부록 A — 전체 문서 목록

프로젝트 `docs/` 디렉토리 구조:

```
docs/
├── 00_ARCHITECTURE_DECISIONS.md      # ADR — 왜 이렇게 설계했는가
├── 01_ERD.md                          # DB 스키마 18개 테이블
├── 02_API_DESIGN.md                   # REST API 50개+
├── 03_DOCKER_INFRA.md                 # Docker 환경 구성
├── 04_REPOSITORY_STRUCTURE.md         # [구버전] 레포 구조 v1
├── 05_ARCHITECTURE_PHILOSOPHY.md      # 모듈러 모놀리스 + 마이크로서비스
├── 06_REPOSITORY_STRUCTURE_V2.md      # 레포 구조 v2 (현행)
├── 07_SPRINT_BACKLOG_V2.md            # 스프린트 백로그 v2 (현행)
├── 07_GITHUB_PROJECTS_V2.yml          # GitHub Projects 자동 등록
├── 08_CHECKPOINT_FLOW.md              # 보안 점검 흐름 + 체크포인트
├── 09_DESIGN_SYSTEM.md                # 디자인 시스템 MASTER
├── 10_UI_UX_REVISIONS.md              # UI/UX 수정사항 목록
├── 11_CLAUDE_CODE_GUIDE.md            # 이 파일 (마스터 가이드)
├── setup_github_projects.sh           # GitHub 이슈 자동 등록 스크립트
└── wireframes/
    ├── secureai-wireframe.html        # 와이어프레임 초안
    ├── secureai-webapp.html            # 웹앱 목업
    └── secureai-mobile.html            # 모바일 목업
```

---

## 부록 B — Claude Code 첫 실행 체크리스트

처음 이 프로젝트에서 Claude Code를 실행할 때:

1. [ ] 개발 환경 체크리스트 (섹션 7) 전부 통과
2. [ ] `git clone <repo>` 후 `cd secureai`
3. [ ] `cp .env.example .env` 후 API 키 입력
4. [ ] UI UX Pro Max 스킬 설치 (섹션 5.1)
5. [ ] `claude code` 실행
6. [ ] Claude에게 아래 프롬프트 전달:

```
이 프로젝트에서 개발을 시작합니다.

먼저 다음 순서로 문서를 읽어주세요:
1. docs/11_CLAUDE_CODE_GUIDE.md (이 프로젝트의 마스터 가이드)
2. docs/00_ARCHITECTURE_DECISIONS.md
3. docs/05_ARCHITECTURE_PHILOSOPHY.md
4. docs/06_REPOSITORY_STRUCTURE_V2.md

읽은 후 다음을 확인해주세요:
- 현재 진행할 스프린트는 Sprint 0
- 첫 TASK는 TASK-001 (모노레포 초기화)
- 11_CLAUDE_CODE_GUIDE.md의 섹션 2 "개발 진행 룰"을 준수

준비되면 "Sprint 0 TASK-001부터 시작하겠습니다"라고 알려주세요.
```

---

**이 가이드를 따르면 20주 내에 SecureAI 런칭까지 체계적으로 진행 가능합니다.**

---

*업데이트 이력*
- 2026-04-19 v1.0 — 최초 작성
