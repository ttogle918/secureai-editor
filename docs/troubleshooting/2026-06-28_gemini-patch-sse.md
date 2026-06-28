# [2026-06-28] Gemini 모델로 SAST 시 패치·완료·SSE 경로 버그 (데모 드라이런)

**맥락**: VC 데모 녹화 준비 중, 모델을 **Gemini 2.5 Flash**(`/settings` → 선호 AI 모델)로
선택하고 작은 취약 샘플 `demo-vuln-sample`(5파일, SQLi·SSRF·커맨드인젝션·경로순회·역직렬화·
하드코딩시크릿)을 SAST 스캔하니, **취약점은 19개 정상 검출되는데 "분석 완료"가 화면에 안 뜨고
진행률·취약점이 0**이었음. 브라우저 자동화(/chrome)로 재현·추적.

> 참고: 기본 SAST 모델은 Gemini가 아니라 **Claude Haiku 4.5**(빠름)/Sonnet 4.6(정밀).
> Gemini는 `/settings`에서 명시 선택 필요. BYOK 미연결 시 서버 `GEMINI_API_KEY`(플랫폼)로 호출.

## 발견된 버그 4건

| # | 증상 | 근본 원인 | 상태 |
|---|------|-----------|------|
| 1 | 패치 단계 19개 전부 404 | `patch_node._call_claude`가 `AsyncAnthropic` 직접 사용 + `preferred_model=gemini-2.5-flash`를 그대로 전달 → **Anthropic API에 gemini 모델** 요청(`req_011C...` = Anthropic 요청ID, `not_found_error`). `preferred_provider` 무시. | ✅ 수정 |
| 2 | 분석이 완료 직전 크래시 | patch 이후 노드가 `None` 업데이트 반환 → `analyze.py:149 full_state.update(None)` → `TypeError: 'NoneType' object is not iterable`. 완료 이벤트(`completed`) 발행 전 중단. | ✅ 수정 |
| 3 | 패치 저장 실패(500) | ai_engine `save_patch_results`가 `PatchResult.to_dict()`(snake_case)를 그대로 POST. 백엔드 `SavePatchResultsRequest.PatchItem`은 **camelCase** 기대 → `explanation`(단일단어)만 매핑되고 `file_path/vuln_type/...`는 null → `patch_suggestions.file_path` NOT NULL 제약위반. | ✅ 수정 |
| 4 | FE가 진행률·완료를 실시간 수신 못함 | `GET /analysis/sessions/{id}/stream` → **503**. DEBUG 로깅 결과: 캐시로 분석이 1초 내 완료된 뒤 SSE가 연결되는 **완료-레이스** — 즉시 완료된 `SseEmitter`를 async 디스패치가 거부(503). | ⚠️ 미수정(원인규명) |

## 수정 내역 (커밋 `79f1ae3`, branch `fix/gemini-patch-sse`)

- **patch_node.py**: `_call_claude` → `_call_llm(prompt, provider, ...)`로 교체, `get_provider(provider).analyze(...)` 사용. `patch_node`에서 `preferred_provider` → scan_mode fallback → gemini 키 없으면 anthropic 폴백(= sast_node와 동일 규칙)으로 provider/model 해석.
- **analyze.py**: `_run_analysis`·`_run_resume` 양쪽 astream 루프에 `if update is not None:` 가드.
- **backend_api_client.py**: `_snake_to_camel`/`_camelize_keys` 추가, `save_patch_results`가 patch dict 키를 camelCase로 변환 후 전송.

**검증(로그)**: `aggregate files=5 vulns=19` → patch가 `generativelanguage.googleapis.com 200 OK`로 호출 → `[patch] generated=19` → `graph completed natively, total_vulns=19`(크래시 없음) → 백엔드 `[patch] saved=19`(제약위반 없음). 새로고침 시 FE가 취약점 19개·완료 상태 정상 표시.

## 남은 이슈 #4 — SSE /stream 503 (완료-레이스)

- **근거**: DEBUG 로그상 세션 `completed`(RedisSubscriber) 직후(수십 ms) /stream이 연결되고, `WebAsyncManager: Async result set` → `ASYNC dispatch` → 503. 컨트롤러가 완료 상태를 즉시 `SseEmitter`로 동기 완료 반환하는 경로에서 Spring async가 거부.
- **영향**: *라이브* 진행률·완료 갱신만 막힘. 취약점 데이터는 DB에 정상 저장되어 **새로고침 시 REST(`/vulnerabilities`)로 로드되어 표시됨**. 캐시 안 된 신규 스캔(~30s)은 SSE가 실행 중 연결되므로 영향이 덜할 가능성(미확정).
- **권장 수정 방향**: 컨트롤러 late-connect replay 경로에서 `SseEmitter`를 **핸들러 내 동기 complete 금지** — 등록 후 별도 스레드/직후에 `completed` 이벤트 전송. 또는 완료 세션은 SSE 대신 200 JSON으로 응답(FE가 즉시 fetch). `spring.threads.virtual.enabled=true` + SseEmitter 상호작용도 함께 점검.
- **데모 회피책**: 동일 파일 재스캔(캐시 즉시완료) 대신 신규 코드 스캔. 또는 스캔 후 **새로고침**하면 완료 화면·취약점 표시됨.

## 미해결 부수 사항
- `[patch] token_usage report skipped: user_id missing` — 분석 요청에 `user_id` 미전달 → 토큰 사용량/크레딧 차감 콜백 스킵(별도 확인 필요).
