# 2026-06-28 (b) — DAST 워크스페이스 취약점-엔드포인트 연결 수정 + 데모 검증

> 세션 성격: 스프린트 외 버그 수정. VC 데모 녹화 전 DAST 클라이맥스(EXPLOITED) 동작 검증 중 발견·수정.
> 커밋: `855ee1b` (fix/dast-endpoint-wiring → main, 푸시 완료).

---

## 1. 배경
데모 7씬 중 **씬3 DAST 증명**이 실제 도는지 브라우저로 검증하다가, DAST 워크스페이스가 "HTTP API 엔드포인트가 발견되지 않았습니다"로 항상 비어 있는 것을 발견. 원인 추적(옵션 B) 진행.

## 2. 근본 원인 (코드로 확정)
- `DastWorkspacePage.tsx`가 `vulns.filter(v => !!v.apiEndpoint)`로 DAST 타깃을 거름.
- 그러나 **`apiEndpoint`는 백엔드 DB에 컬럼이 없는 프론트 파생 필드**(`vulnUtils.ts` 주석). 취약점을 store에 넣는 3곳(`AppHeader`·`AppSidebar`·`AnalysisHistoryModal`)은 `apiGroup`만 파생(`deriveApiGroup`)하고 **`apiEndpoint`는 세팅 안 함**.
- 결과: `apiGroup`(필터칩)은 뜨지만 `apiEndpoint`는 항상 `undefined` → DAST 타깃 0건.
- 한편 api_discovery가 발견한 실제 엔드포인트(`/fetch`·`/ping`·`/users/search`·`/users/{user_id}`)는 `store.apiGroups`(별도 상태)에 있으나 **개별 취약점과 연결돼 있지 않았음**.

## 3. 수정 (옵션 2 — 진짜 발견 엔드포인트 연결)
`DastWorkspacePage.tsx`:
- `resolveEndpoint(v, apiGroups)`: 취약점 `filePath`(+basename 폴백)를 `apiGroups[].files[].path`와 매칭, 같은 파일 다중 엔드포인트는 **취약점 라인(`lineStart`) 바로 위 선언**을 선택.
- `dastableVulns`를 `v.apiEndpoint ?? resolveEndpoint(...)`로 보강, `handleBatchRun`이 보강된 목록을 쓰도록 변경(배치 요청에 endpoint 포함).
- **브라우저 검증 완료:** fastapi-vuln-sample 분석 후 DAST 타깃 **4건 정상 표시**(SSRF /fetch · CmdI /ping · SQLi /users/search · BAC /users/{user_id}).

## 4. 검증 과정에서 배운 제약 (다음에 중요)
- **`apiGroups`는 세션 전용(DB 비저장)** — 분석 시작 시 clear, `api_plan` 이벤트로 재적재. → **DAST는 분석 직후 *리로드 없이* 진입해야** 타깃이 보임.
- 캐시 키 prefix = `secureai:sast:cache:*`(DB1). 캐시 히트면 LangGraph가 안 돌아 `api_plan` 미발생 → apiGroups 빈다. **라이브 진행률 + 엔드포인트 발견엔 캐시 클리어 필수.**
- 프론트 = **호스트 `npm run dev`(Next dev, Fast Refresh)** — 코드 수정 자동 반영.
- 백엔드 → 타깃 도달: 둘 다 `secureai-editor_app-net`, 백엔드 컨테이너에서 `fastapi-vuln` → 172.21.0.10 정상 해석. **타깃 URL은 `http://fastapi-vuln:8000`(도커 DNS), localhost 아님.**

## 5. 남은 블로커 → 다음 작업 (옵션 A 결정됨)
- 배치 실행 시 **`DAST_DOMAIN_NOT_VERIFIED`**(도메인 소유권 검증 통제). `DastController.LOCALHOST_DOMAINS = {localhost,127.0.0.1,0.0.0.0}`만 검증 생략, `fastapi-vuln`은 미포함.
- `assertDastAllowed` = 도메인검증(DB `scan_targets.verified`) + 동의 + RateLimit(3/h) + 분산락.
- **결정: 옵션 A** — `DastController`의 데모 허용목록에 데모 타깃 추가(가능하면 config로 `secureai.dast.demo-domains` 외부화). ⚠️ 백엔드(Spring) 재빌드 필요. (마감까지 ~6h, 여유 있음.)

## 6. 별개 관찰 (백로그)
- 같은 세션 재분석 시 `uk_vuln_session_fp` **중복키 위반**(취약점 fingerprint 중복 insert). 재분석 시 upsert/스킵 처리 필요 — DAST와 무관.

## 7. 다음 단계
1. 옵션 A 구현(`DastController` 데모 허용목록 + 재빌드) → 배치 실행 → **EXPLOITED 확인**.
2. 되면 7씬, 안 되면 6씬으로 데모 녹화.
3. (선택) `uk_vuln_session_fp` 재분석 중복키 처리.
