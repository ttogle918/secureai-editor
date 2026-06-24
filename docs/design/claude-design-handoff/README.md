# Claude Design 핸드오프 패키지 (self-contained)

> 이 폴더 **하나만** Claude Design에 주면 된다. frontend 전체/`apps/`는 불필요.
> 대표 컴포넌트는 링크가 아니라 **실제 파일 복사본**(`02_current_components/`)이라 자기완결적이다.

## 넣는 순서 (중요도순)
1. **`00_BRIEF.md`** — 주 입력. IA + 페르소나 + 데모 critical path + 화면별 기능매핑 + ★UI 공백 2개 + 그대로 쓸 프롬프트.
2. **`01_DESIGN_TOKENS.md`** — 비주얼 언어(색·간격·badge). 룩 매칭의 근거.
3. **`02_current_components/`** — 현재 룩 레퍼런스(실제 코드). "이게 현재 모습 + 여기에 ★공백을 통합".
4. **`03_DATA_MODEL.md`** — 컴포넌트가 표시하는 데이터 모양(취약점/패치/DAST).

## 안 넣는 것
backend · ai_engine · android · mcp_server · hooks · lib(api) · locales · tests
→ UI 디자인과 무관. 노이즈.

## 팁
- 가능하면 현재 화면 **스크린샷 2~3장**을 함께 첨부하면 룩 매칭이 더 정확해진다.
- Claude Design은 코드 리더가 아니라 디자인 툴이다. **브리프가 1순위**, 코드는 스타일 레퍼런스(2순위).
