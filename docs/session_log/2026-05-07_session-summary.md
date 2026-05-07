# [2026-05-07] 작업 세션 요약

**브랜치**: `feat/sprint4`  
**작업 범위**: 분석 API 연결, 프롬프트 최적화, 랜딩 페이지, Tauri 데스크탑 앱 초기 설정

---

## 1. 완료 작업

| 항목 | 주요 파일 |
|------|---------|
| `useSse.ts` JWT 토큰 버그 수정 | `src/hooks/useSse.ts` |
| 분석 버튼 → 실 API 연결 | `useStartAnalysis.ts`, `useSecureStore.ts`, `AppHeader.tsx`, `AppSidebar.tsx` |
| Security Guidelines DB 구축 | `generate_guidelines_sql.py` → Docker psql 15행 삽입 |
| SAST 프롬프트 캐싱 활성화 | `guidelines_client.py`, `sast_node.py`, `claude_client.py` |
| Chat 프롬프트 캐싱 활성화 | `chat_client.py` |
| 랜딩 페이지 (`/`) 신설 | `app/page.tsx` |
| 에디터 라우트 보호 | `app/editor/page.tsx`, `middleware.ts` |
| API v3 문서 | `docs/02_API_DESIGN_V3.md` |
| 현재 아키텍처 문서 (Mermaid) | `docs/16_ARCHITECTURE_CURRENT.md` |
| Tauri v2 초기 설정 | `src-tauri/`, `src/lib/tauri.ts`, `useWorkspace.ts` |

---

## 2. 의논 내용 & 결정 맥락

### useSse.ts JWT 버그
`localStorage.getItem('jwt')`로 토큰을 읽고 있었으나, 앱은 메모리 기반 토큰(`getAccessToken()`)을 사용. 브라우저 보안 정책상 httpOnly 쿠키는 JS 접근 불가이므로 memory 변수에 저장하는 구조였음.  
`jest.spyOn`은 ES 모듈의 non-configurable export에 적용 불가 → `jest.mock`으로 교체.

### 프롬프트 캐싱이 동작하지 않던 이유
Anthropic `cache_control: ephemeral`은 **1,024 tokens 이상**인 시스템 프롬프트에만 적용된다.  
SAST 시스템 프롬프트 ~200 tokens, Chat ~100 tokens — 모두 임계치 미달이었음.  
해결: `security_guidelines` DB의 stack별 가이드라인을 시스템 프롬프트에 주입 → 자연스럽게 초과. 동일 stack 파일 연속 분석 시 두 번째 호출부터 cache HIT.

### Security Guidelines DB 구축 방법
`docs/security/` 마크다운을 DB에 직접 sync하는 Python 스크립트(`sync_guidelines.py`)를 먼저 검토했으나, Docker 컨테이너 내에서 실행해야 해 복잡했음.  
대안으로 **SQL 생성 스크립트**(`generate_guidelines_sql.py`)를 만들어 호스트에서 실행 후 `docker exec psql`로 파이프 — 더 단순하고 재현 가능.

### 모델 선택 & 운영 권장
현재: `claude-haiku-4-5-20251001` (기본값).  
운영 배포 시에는 `.env`의 `CLAUDE_MODEL=claude-sonnet-4-6`으로만 교체하면 됨 — 코드 변경 불필요.  
SAST·Patch: Sonnet 권장 (미묘한 취약점 탐지력 차이), Chat: Haiku 유지 (대화형 = 속도 우선).

### 랜딩 페이지 & 라우팅 재설계
기존 `app/page.tsx`가 바로 에디터였음 — 서비스 소개도, 인증 가드도 없는 구조.  
결정:
- `/` → 랜딩 페이지 (공개)
- `/editor` → 에디터 (보호, auth guard 2중: middleware + client-side)
- 로그인 후 `/editor`, 로그아웃 후 `/` 로 리다이렉트

### Tauri vs Electron
VS Code·Cursor·Antigravity는 Electron 기반이지만, 신규 개발이므로 **Tauri v2** 선택.  
이유: Chromium 내장 없이 Windows WebView2(Edge) 사용 → 번들 ~5MB vs ~150MB.  
백엔드(Spring Boot + AI Engine)는 클라우드에 두고 프론트+파일접근만 데스크탑으로 가져오는 구조.  
Android 대시보드도 같은 백엔드 API를 사용하므로 Tauri 선택이 더 유리.

### Tauri 파일 분기 전략
`isTauri()` (`window.__TAURI_INTERNALS__` 존재 여부) 로 환경 감지.  
데스크탑: `@tauri-apps/plugin-dialog` 네이티브 폴더 선택 → `@tauri-apps/plugin-fs` 직접 읽기.  
웹: 기존 File System Access API → 백엔드 Redis 업로드. 동일 인터페이스, 다른 구현.

---

## 3. 버그 수정 / 특이사항

- `generate_guidelines_sql.py` Windows cp949 인코딩 이슈: `sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")`로 해결
- `tauri icon` 소스 파일 위치: `src-tauri/icons/`가 아닌 **프론트엔드 루트**에 있어야 함
- Tauri 첫 빌드 5~10분 소요 (Rust 의존성 컴파일)
- `tsconfig.tsbuildinfo`는 빌드 아티팩트 — `.gitignore` 추가 권장

---

## 4. 커밋 목록

| 커밋 | 내용 |
|------|------|
| `171987c` | feat(ai-engine): guidelines 주입 + 프롬프트 캐싱 활성화 |
| `1fb9fbe` | feat(frontend): 분석 버튼 실 API 연결 (useStartAnalysis) |
| `1d80606` | docs: API v3 + 현재 아키텍처 문서 (Mermaid 10개) |
| `06dab99` | feat(frontend): 랜딩 페이지 + 에디터 라우트 auth guard |
| `e13c517` | feat(desktop): Tauri v2 초기 설정 |

---

## 5. 다음 세션에서 할 것

### 단기 (Sprint 4 마무리)
- [ ] 크레딧 시스템 백엔드 설계 (`user_credits` 테이블, 모델별 토큰 소비량)
- [ ] 모델 선택 UI (설정 페이지 — Haiku / Sonnet / Opus + 자체 API 키)
- [ ] Android 대시보드 (`apps/android/`) 백엔드 API 연결
- [ ] `tsconfig.tsbuildinfo` `.gitignore` 추가

### 중기 (운영 준비)
- [ ] 웹 배포 설정 (Vercel 또는 Docker + Nginx)
- [ ] Tauri 아이콘 정식 디자인 (현재 임시 플레이스홀더)
- [ ] 랜딩 페이지 가격 정책 섹션 추가
- [ ] GitHub PR 자동 리뷰 (Layer 2) 구현
- [ ] DAST 샌드박스 (Layer 3) 구현
