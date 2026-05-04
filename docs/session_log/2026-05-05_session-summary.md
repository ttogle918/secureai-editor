# [2026-05-05] 작업 세션 요약

**브랜치**: `feat/sprint3`  
**작업 범위**: Sprint 3 잔여 통합 테스트 완료 + Sprint 3 완료 처리 + Sprint 4 계획 수립

---

## 1. Sprint 3 잔여 통합 테스트 (test_sprint3_pending.py)

이전 세션에서 자동화 불가로 pending 처리된 항목 중 일부를 자동화 테스트로 전환.  
총 8개 테스트 신규 작성.

### 자동화된 항목

| 테스트 | TASK | 결과 |
|--------|------|------|
| 5 HIT + 5 MISS 시나리오 → Claude 호출 5회 검증 | TASK-301 | ✅ |
| 진행률 5/10 = 50% 정확성 | TASK-301 | ✅ |
| 각 단계별 진행률 계산 (10.0~100.0) | TASK-301 | ✅ |
| asyncio.gather 병렬 처리가 순차보다 빠른지 검증 | TASK-301 | ✅ |
| SQL Injection → PreparedStatement 패치 생성 | TASK-304 | ✅ |
| 동일 취약점 2차 요청 → 캐시 HIT (Claude 호출 없음) | TASK-304 | ✅ |
| 패치 적용 → is_applied / applied_at / applied_by 업데이트 | TASK-304 | ✅ |
| 의존성 컴포넌트 → CVE 매핑 저장 및 조회 | TASK-305 | ✅ |

### 발생한 오류 및 수정 (상세: troubleshooting 참조)

- `patch_node._redis` 전역 상태 → 테스트 간 asyncio 이벤트 루프 충돌 → `_redis = None` 리셋으로 해결
- `_generate_patch_for_vuln` mock: Claude가 마크다운 펜스로 JSON 감싸는 문제 → `_call_claude`를 직접 mock해 clean JSON 반환
- `test_backend_sprint3.py`: FK 체인 미생성으로 JSONB INSERT 실패 → users → projects → analysis_sessions → vulnerabilities 순서로 생성
- `psycopg3` SQL: `ILIKE '%s%'` 내 `%s`를 플레이스홀더로 인식 → `%%s%%` 또는 파라미터 바인딩으로 수정
- `jinja2` 미설치 → `pip install jinja2`

---

## 2. 최종 테스트 결과

```
AI 엔진 전체 테스트: 147 passed / 0 failed

  tests/integration/test_backend_sprint3.py      9 passed
  tests/integration/test_sprint3_integration.py  7 passed
  tests/integration/test_sprint3_pending.py      8 passed
  tests/api/test_analyze_route.py                9 passed
  tests/agent/ (단위)                           85 passed
  tests/infrastructure/ (단위)                  25 passed
  tests/integration/test_checkpointer_integration.py  4 passed
```

---

## 3. Sprint 3 완료 처리 (/done sprint 3)

`docs/sprints/sprint-3.md` 구현 방식 기록 완료.

### 이월 항목 (자동화 불가 — 수동 검증 필요)

| 항목 | 이유 |
|------|------|
| GitHub 레포 스캔 실제 동작 | 실제 GitHub API + 웹훅 필요 |
| NVD API 실제 CVE 조회 | 실제 NVD 네트워크 호출 필요 |
| AuthController 취약점 2건 수정 | URL 토큰 노출, Open Redirect |
| Zustand state 복합 시나리오 | e2e UI 검증 필요 |

---

## 4. Sprint 4 계획 수립 (/sprint 4)

`docs/sprints/sprint-4.md` 작성 완료.

### 태스크 요약

| TASK | 내용 | 우선순위 | 기간 |
|------|------|--------|------|
| TASK-401 | Monaco Editor 통합 | P1 | 5일 |
| TASK-402 | SSE 실시간 취약점 스트리밍 | P1 | 4일 |
| TASK-403 | VSCode 레이아웃 & 파일 트리 | P1 | 4일 |
| TASK-404 | 취약점 상세 패널 | P2 | 3일 |
| TASK-405 | AI 채팅 API | P2 | 4일 |
| TASK-406 | 진행률 체크리스트 Markdown | P0 | 3일 |

### 병렬 실행 순서

```
1단계 (May 5–9):   TASK-401 (FE) + TASK-403 (FE) + TASK-406 BE 동시
2단계 (May 10–12): TASK-402 SSE
3단계 (May 13–16): TASK-404 + TASK-406 FE 동시
4단계 (May 17–18): TASK-405 AI 채팅
```

---

## 5. 브랜치 전략 결정

- Sprint 4는 태스크별 브랜치 분리 없이 `feat/sprint4` 단일 브랜치에서 태스크 단위 커밋으로 진행
- 이유: 태스크 간 의존성 강함 (401/403 → 402 → 404/406 → 405), 분리 시 머지 오버헤드만 증가

---

## 6. 다음 세션에서 할 것

- [ ] `feat/sprint4` 브랜치 생성
- [ ] Docker 기동: `make dev`
- [ ] TASK-401: Monaco Editor SSR 검증부터 시작
- [ ] TASK-403: 3컬럼 레이아웃 병렬 진행
