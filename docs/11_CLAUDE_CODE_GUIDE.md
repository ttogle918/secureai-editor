# SecureAI — Claude Code 실행 가이드
> 대상: Claude Code를 사용해 SecureAI를 개발할 때 참고하는 메인 가이드

---

## 0. 이 문서의 역할

프로젝트 구조·규칙의 빠른 참조용. 신규 세션 시작 시 먼저 읽는다.

---

## 1. 문서 읽기 순서

```
# 프로젝트 이해 (첫 세션)
00_ARCHITECTURE_DECISIONS.md  ← ADR (왜 이렇게 설계했는가)
06_REPOSITORY_STRUCTURE_V2.md ← 전체 디렉토리 구조

# 구현 시 참조
01_ERD.md          ← DB 스키마
02_API_DESIGN.md   ← REST API
08_CHECKPOINT_FLOW.md ← 보안 점검 흐름

# 스프린트 시작 시
07_SPRINT_BACKLOG_V2.md  ← 현재 스프린트 TASK

# UI 작업 시
09_DESIGN_SYSTEM.md  ← 색상·타이포·간격 토큰
10_UI_UX_REVISIONS.md ← 수정 가이드
```

---

## 2. 개발 진행 룰

### 절대 규칙

1. **스프린트 순서** — 현재 스프린트 TASK 완료 전 다음 스프린트 시작 금지
2. **한 번에 하나의 TASK** — 완료 → 테스트 통과 → 커밋 → 다음 TASK
3. **완료 기준** — 백로그의 🧪/🔬/✅/🛡️ 체크리스트 모두 통과
4. **설계 문서 우선** — ERD·API 문서와 다른 구현 시도 전 문서 수정 먼저
5. **보안 규칙** — `.env`·키·토큰 커밋 금지, `@Valid` 누락 금지, Rate Limit 우회 금지

### 권장 규칙

- TDD 우선 — 🧪 체크리스트를 테스트 대상으로
- Conventional Commits: `feat(scope)`, `fix(scope)`, `test`, `refactor`, `docs`, `chore`
- PR 단위 작게 — 하나의 TASK = 하나의 PR, 500줄 이상 시 분할

### 팁

- AI 보안 감사 도구 특성상 보안 버그는 프로젝트 신뢰성 직결 → 의심스러우면 엄격하게
- Circuit Breaker fallback 항상 정의 (AI Agent 장애 → Backend 전파 방지)
