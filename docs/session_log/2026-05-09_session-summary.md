# [2026-05-09] 작업 세션 요약

**브랜치**: `feat/sprint4`  
**작업 범위**: SAST 품질 개선 — 보안 가이드라인 DB 임포트, false positive 감소, CODE_QUALITY 카테고리 시각화, 테스트 파일 분석 제외

---

## 1. 완료 작업

| 항목 | 주요 파일 |
|------|---------|
| SAST 워크플로우 문서화 (Mermaid) | `docs/security/E_SAST_WORKFLOW.md` |
| 보안 가이드라인 DB 임포트 스크립트 | `scripts/import_security_guidelines.py` |
| Claude 프롬프트 품질 개선 | `apps/ai_engine/agent/claude_client.py` |
| 응답 파서 category 기본값 보장 | `apps/ai_engine/agent/response_parser.py` |
| DB 마이그레이션 (category 컬럼) | `V018__add_vuln_category.sql` |
| Vulnerability 엔티티 category 필드 | `Vulnerability.java` |
| SaveVulnerabilitiesRequest category | `SaveVulnerabilitiesRequest.java` |
| VulnerabilityResponse category | `VulnerabilityResponse.java` |
| VulnerabilityService category 저장 | `VulnerabilityService.java` |
| AI Engine category 전송 | `infrastructure/backend_api_client.py` |
| Frontend VulnCategory 타입 정의 | `src/lib/mockData.ts` |
| SSE/API 응답 category 매핑 | `useSse.ts`, `useLoadLatestResults.ts`, `AppHeader.tsx` |
| VulnDetailPanel CODE QUALITY 배지 | `VulnDetailPanel.tsx` |
| scan_files_node 테스트 파일 제외 | `apps/ai_engine/agent/nodes/scan_files_node.py` |

---

## 2. 의논 내용 & 결정 맥락

### False Positive 분석

기존 Haiku 모델이 132개 취약점 중 ~40–50%를 false positive로 분류.  
주요 원인:
- React JSX `{variable}` 텍스트 렌더링을 XSS로 오진 (19건) — JSX는 HTML 자동 이스케이프
- `mockData.ts` 데모 데이터 패턴을 실제 취약점으로 분류 (7건)
- CSS-in-JS inline style을 CSS Injection으로 오진 (5건)
- `Date.now()` / `Math.random()` 비보안 ID를 CRITICAL로 분류

### 프롬프트 개선 — Framework-aware rules 추가

```
- React JSX {variable} → 자동 이스케이프, XSS 아님 (dangerouslySetInnerHTML만 위험)
- React inline styles → JS 객체, CSS Injection 아님
- mockData.ts, fixtures → 의도적 데모 패턴, CODE_QUALITY 또는 skip
- CSS 클래스 생성 (tailwind, clsx) → Injection 아님
- Date.now() / Math.random() 비보안 ID → CODE_QUALITY, CRITICAL 아님
```

### security_guidelines 테이블이 비어있었음

`docs/security/` 마크다운 17개 파일이 DB에 입력되지 않아 스택별 가이드라인이 적용되지 않고 있었음.  
`scripts/import_security_guidelines.py` 작성 후 컨테이너 내에서 실행 → **334개 행 삽입**.

```bash
docker exec secureai-ai-engine python /tmp/import_guidelines.py
# 완료: 334개 행 처리 (신규 334, 갱신 0)
```

이후 분석부터는 `frontend_react_nextjs`, `java_spring` 등 스택별 가이드라인이 시스템 프롬프트에 포함됨.

### SAST 워크플로우 문서화

LangGraph 실행 흐름 전체를 Mermaid 다이어그램으로 정리:
- scan_files → cache_check (Redis SHA256) → sast (Claude) → next_file → aggregate → Redis Pub/Sub → Spring SSE → Frontend

### CODE_QUALITY 카테고리 설계

Claude 응답 JSON에 `category: SECURITY | CODE_QUALITY` 필드 추가.  
전 스택 전파 경로:
```
Claude 응답 JSON
→ response_parser (기본값 SECURITY 보장)
→ backend_api_client (category 전송)
→ VulnerabilityService (DB 저장)
→ VulnerabilityResponse (API 응답)
→ useLoadLatestResults / AppHeader SSE handler (프론트엔드 매핑)
→ VulnDetailPanel (인디고 CODE QUALITY 배지 표시)
```

exploitable 취약점(SECURITY)과 코드 품질 이슈(CODE_QUALITY)를 시각적으로 구분.

### 테스트·목 파일 제외

`scan_files_node`에서 파일 수집 직후 필터링:
```python
_EXCLUDE_PATTERNS = (
    "mockData", "mock_data", "fixtures", "seeds",
    "__tests__", "__mocks__", ".test.", ".spec.",
    ".stories.", "setupTests", "jest.config", "vitest.config",
)
```
local/GitHub 소스 모두 적용, 제외 건수는 progress log에 기록.

---

## 3. 버그 수정

| 버그 | 원인 | 수정 |
|------|------|------|
| `POST /api/v1/projects` 403 오류 | `useAuth.ts`의 stale closure가 `storeSetToken(null)` 호출 | `loadUser`에서 `storeSetToken` 제거 |
| Spring 401 대신 403 반환 | `AuthenticationEntryPoint` 미설정 | `HttpStatusEntryPoint(UNAUTHORIZED)` 추가 |
| 취약점 카드 텍스트 안 보임 | 카드 높이 미고정으로 overflow | 헤더 height 52px 고정 + 텍스트 truncation |

---

## 4. 미해결 / 다음 세션

- [ ] **모델 교체**: `.env`에서 `CLAUDE_MODEL=claude-haiku-4-5` → `claude-sonnet-4-6` (사용자 직접 수정)  
  Sonnet 전환 시 React 프레임워크 인식 수준 향상으로 FP율 대폭 감소 예상
- [ ] Sprint 5 TASK-501 커밋 히스토리 시크릿 스캔
- [ ] Sprint 5 TASK-502 PR Webhook 자동 보안 리뷰
