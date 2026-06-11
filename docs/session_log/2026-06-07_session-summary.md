# [2026-06-07] 브랜치 통합·정리 + 테스트 그린화 + 보안지침 재구조화 + SAST 진행률 운영검증

**브랜치**: `main` (작업 후 모든 브랜치 main으로 통합)
**모델**: Claude Opus 4.8
**범위**: git-workflow 룰 신설 → 산재 브랜치/미커밋 전부 main 통합·정리 → 3개 스위트 테스트 그린화 → docs/security 재구조화 코드 완료 + 지침 재sync → 실 SAST 스캔으로 진행률 기능 운영검증

---

## 1. 형상관리(Git) 정비

### git-workflow 룰 신설 (`.claude/rules/git-workflow.md`, gitignored)
- 사용자 질문("형상관리 전용 에이전트 둘까?")에 **전용 에이전트 불필요** 결론 — git 실행=마스터, 게이트=Reviewer, 정책=문서. (cold 에이전트는 맥락 재구성 비용만)
- 핵심: **작업 착수 전 미머지 브랜치 충돌 사전점검**(`git branch --no-merged` + `diff --name-only`로 파일 겹침 확인), feat 브랜치 vs direct-main 기준, Reviewer 후 커밋/머지/푸시, main force-push 금지. CLAUDE.md에 포인터 추가.
- ⚠️ `.claude/`·`CLAUDE.md`는 레포에서 **gitignore** → 룰은 로컬 적용만(커밋 안 됨, 기존 general.md·test.md와 동일).

### 브랜치 통합 (산재 작업 → main)
- **발견**: 작업 중 브랜치가 `main`이 아니라 `refactor/frontend-ui-responsive`로 전환돼 있었음(내 `push origin main`이 no-op이던 원인). 미병합: 로컬 refactor(+3 + 방대한 미커밋) / origin claude **보안수정(+4)** / origin claude **테스트(+19)**. 나머지 로컬 브랜치는 이미 병합됨.
- **통합**: 미커밋 전부 커밋(`7cffe7b`) → main에서 refactor ff-merge → 보안브랜치(+4) **무충돌** → 테스트브랜치(+19) 병합(충돌 2건 해소). push.
- **충돌 해소**: `test_analyze_route.py`(내 patch_node 변경 + 그쪽 주석 양쪽 유지), `test_progress_log_client.py`(테스트커버리지 정본 채택).
- **정리**: 병합완료 브랜치 **로컬 11 + 원격 11 삭제**(`--merged` 확인 후), **stash 8개 전부 clear**. → **최종 `main` 단일 브랜치**.

## 2. 테스트 그린화

| 스위트 | 결과 |
|------|------|
| 백엔드 | ✅ BUILD SUCCESSFUL (보안+테스트 브랜치 병합분 포함) |
| AI엔진 | ✅ 407 passed. **28 "errors"는 Windows asyncio 소켓(WinError 10014) 스위트 플레이크** — 격리 실행 시 통과(가짜). 코드/병합 문제 아님 |
| 프론트 | 🐞→✅ stale 2건 수정 후 68 passed (`94623a2`) |

- **프론트 stale 원인**(병합으로 드러남): `useAuth.login`이 TASK-1102로 토큰 세팅 후 `loadUser()`(GET /me) 호출 + `router.replace`(push 아님) → 테스트가 GET mock 안 해 loadUser catch가 토큰정리 → null. `register`는 TASK-1104 동의필드 미반영. → GET mock 추가 + replace 단언 + 동의필드 기대값으로 현행화.

## 3. 보안지침 재구조화 — 코드 완료 (사용자 콘텐츠 작업 연계)

### 핵심 발견: 임포트 도구 2개 + 택소노미 불일치
- 사용자가 docs/security를 재구조화(옛 번들 7 → **개별 20분할** B01_sqli~B20_cicd + 신규 스택 `STACK_common_js`·`STACK_python_django`) + SAST/DAST가 지침 참조하도록 의도.
- **사용자 스크립트 `apps/ai_engine/scripts/sync_guidelines.py`**(자동탐색 + fastembed 임베딩)가 정본인데, 내가/Dev가 만진 루트 `import_security_guidelines.py`(하드코딩 FILE_META, 임베딩無)는 2차. 게다가 sync의 `_infer_target_stack`(java/python/frontend 키워드만)이 신규 세분스택(common_python/common_js/python_django)을 못 만들어 **읽기측과 불일치**.

### 처리 (Reviewer 점검 후, 사용자 결정=sync 정본·유연하게)
- `guidelines_client.load_guidelines`: **다중 스택**(str|list) + 항상 common + 캐시키 정렬튜플.
- `sast_node._detect_stacks(file,content)`: **내용기반 다중 반환** — .py는 django/flask/fastapi 감지 + common_python, .js/.ts류 + common_js.
- `sync_guidelines._infer_target_stack`: **`STACK_<name>` → target_stack 동적 도출 + try/except 폴백**(키워드 매핑 제거, 신규 스택 자동대응). 검증: 모든 STACK 파일이 정확한 target_stack으로 매핑.
- 루트 `import_security_guidelines.py` **제거**(sync로 대체). 커밋 `d539140`(콘텐츠·UI는 `7cffe7b`로 통합).

### 지침 DB 재sync (스캔 prep)
- 기존 DB는 옛 import 잔재(common/java_spring…, 임베딩 0, 신규 택소노미 없음) → **wipe 후 sync 재실행**.
- 실행: scripts·docs를 ai_engine 컨테이너로 `docker cp` + 호스트명 `secureai-postgres`로 우회(sync의 @postgres→@localhost 재작성 회피) → **32행 적재(새 택소노미: common_python·common_js·python_django·python_flask 등)**.
- ⚠️ **임베딩 실패**: 컨테이너 fastembed 모델 다운로드 `Permission denied(os error 13)` — 모델캐시 쓰기권한. **SAST 무관**(load_guidelines는 임베딩 불요), **DAST 벡터검색만 보류**.

## 4. 실 SAST 스캔 — 진행률 기능 운영검증

- 컨테이너 재빌드(새 다중스택 코드 + 보안브랜치 백엔드) 후 사용자가 backend 프로젝트(407파일) 스캔.
- **✅ 진행률 기능 운영 입증**: `stage_plan` 1 / **stage_started 23 / stage_completed 22** / `progress` 845 / 파일별 scanning(current/total). full_state 픽스(전일 수정)가 실서비스에서 정상.
- **❌ Anthropic 크레딧 고갈**: completed 5 / **failed 402** 전부 `400 credit balance too low` → 저장 취약점 0. 충전이 (올바른 계정에) 반영 안 됨. **진행률 데모는 충분하나 실 분석은 크레딧이 유일 잔여조건.**

---

## 5. 의논·결정 요약 (왜)
- **형상관리 = 정책>에이전트**: 결정론적·맥락결합 작업이라 전용 에이전트는 비용만↑. 룰 문서 + 충돌 사전점검으로 규율.
- **브랜치 전부 통합 후 재분기**: 사용자 의도 — 산재 작업(보안·테스트·UI) 일단 main에 모으고 각자 새 브랜치에서 계속. 미완 UI/docs도 "에러 없으니 합쳐도 OK"로 통합.
- **AI엔진 28 errors = 가짜**: 전체 스위트 동시 실행 시 Windows async 소켓 고갈. 격리 시 통과 확인 → 코드 정상 판정(테스트 인프라 개선은 별도).
- **지침: sync 정본 + 유연 매핑**: 사용자 스크립트(임베딩 보유)가 우월 → 루트 import 폐기. `_infer`를 `STACK_<name>` 동적도출로 만들어 미래 스택 자동대응.
- **스캔 prep 컨테이너 우회**: 호스트 fastembed 부재 + sync의 top-import 의존 → 컨테이너 실행, DB 호스트명으로 재작성 회피.

## 6. 이번 세션 커밋 (origin/main 동기화, `94623a2`)
| 커밋 | 내용 |
|------|------|
| `b33aa96` | refactor(frontend): 랜딩 반응형 (사용자) |
| `ac77d9f` | fix(frontend): 스캔모드 기본값 localStorage 반영 |
| `d539140` | feat(ai-engine): 지침 다중스택 로딩 + sync 유연화, 루트 import 제거 |
| `7cffe7b` | feat: 미커밋 UI/신규페이지/i18n + docs/security 분할 통합 |
| `c2d6a4a`·`21421fa` | merge: claude 보안수정(+4) · 테스트(+19) |
| `94623a2` | test(frontend): useAuth 현행화 |
> 병합으로 main에 흡수된 외부 커밋: 보안(5c8978e·70925f4·0fe1219·59f15c6) + 테스트커버리지 19건.
> git-workflow 룰은 gitignored(.claude) → 커밋 없음(로컬 적용).

## 7. 다음 세션에서 할 것
- [ ] **Anthropic 크레딧 충전 확인**(`.env` CLAUDE_API_KEY 계정) → 재스캔하면 실 취약점 + 새 지침 주입 확인 가능.
- [ ] **DAST 임베딩 권한 fix**: 컨테이너 fastembed 모델캐시 쓰기경로(예: `FASTEMBED_CACHE_PATH` 쓰기가능 볼륨/디렉토리) → sync 재실행해 임베딩 생성 → DAST 벡터검색 활성화.
- [ ] **프론트 진행률 바 UI**: 데이터(SSE)는 정상, 렌더링 이슈는 사용자가 별도 작업 중.
- [ ] (선택) AI엔진 테스트 스위트 Windows async 격리 개선(pytest-asyncio loop scope/forked).
- [ ] Sprint 11 공식 종료(수동검증 체크리스트 A/C PASS 기록 완료, VSCode B-1만 잔여).
</content>
