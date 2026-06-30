# [2026-06-30] 작업 세션 요약

**브랜치**: `main`
**작업 범위**: 백로그 감사 + 아키텍처 문서 정합 + FEAT-COMP-005 Stage A 구현(컴플라이언스 피드 DB+API)

---

## 1. 완료 작업

| 항목 | 주요 파일 | 커밋 |
|------|---------|------|
| 백로그 재정렬(IR 트랙) — Sprint 12-14 인덱싱 + VAL 재배치 | `docs/07_SPRINT_BACKLOG_V4.md`, `docs/backlog/` | `a0ef5c5` |
| 아키텍처 4종 정합 (네트워크·ERD·ADR·API) | `docs/00_ADR.md`, `docs/01_ERD.md`, `docs/02_API.md`, `docs/03_Deployment.md` | `a0ef5c5`, `be389c6` |
| SecurityDoc 빌드 복구(테스트 시그니처) | `apps/backend/.../test/*SecurityDocTest.java` | `7519ed8` |
| FEAT-COMP-005 Stage A 구현 (컴플라이언스 DB+API) | `apps/backend/.../compliance/`, `apps/frontend/src/app/compliance/`, V065 migration | `e32cc63`, `0a91c5a` |

---

## 2. 의논 내용 & 결정 맥락

### ① 백로그 감사 — 계획 vs 실제 괴리 인식

**발견 사항**:
- Sprint 12C(STAGE1-3)·13(EPIC-VAL 테스트)·14(제품 DAST + 리포트)가 실제로 코드 완료/검증 상태였으나 백로그에 "📋 계획" 표기로 뭉뚱그려져 있음 → 다음 세션 사람이 스코프를 오독할 가능성
- VAL(검증)·데모 트랙의 태스크들이 번호순(13→18)이 아닌 **가치/리스크순 재배치** 필요(IR/투자유치 논의 맥락)

**결정**:
- 백로그 V4에서 완료 태스크의 상태를 "✅ 완료" + 날짜로 명시
- **Phase 구조 도입**: Phase0(데모마감)→Phase1(VAL-1 대표런·원가)→Phase2(VAL-7,8 신뢰도)→Phase3(대시보드) 순서로 제배치
- **신규 태스크 등재**:
  - `TASK-1227` (제품 DAST 격리화·dast-isolated-net 배치화·권장안→필수로 상향)
  - `TASK-1220~1226` 기존 7건 그대로

### ② 아키텍처 문서 vs 코드 괴리 감사 & 정정

**발견 사항** (코드 그라운드트루스 대조):

1. **docs/03_Deployment.md § Network**
   - 문서: `trace-net`·`frontend-net`·`app-net` 3종 + 각 서비스 배치
   - 실제(docker-compose.yml): `app-net`·`ai-net` 2종만 존재, `trace-net`/`frontend-net` 미사용
   - **문제**: AI 엔진이 `ports: 8000:8000` expose → 외부에서 직접 접근 가능 (보안설계 "외부차단"과 불일치)
   - **또한**: 제품 DAST 샌드박스가 ai_engine 프로세스 내에서 httpx로 실행 → SSRF 측면이동 가능성

2. **docs/01_ERD.md**
   - V045(2026-05-15)~V064(2026-06-29) 약 12개 테이블/컬럼 신규 추가되었으나 문서 미반영
   - compliance_feed_items, security_doc_requests, compliance_mappings 등 최신 스키마 누락

3. **docs/00_ADR.md**
   - ADR-005(DAST 격리): "dast-isolated-net 별도 격리" 규정하나 현 구현은 ai_engine 프로세스 내부 executor 호출 (격리 미적용)
   - ADR-007(SAST 캐시): TTL 7일 규정하나 코드는 24시간 설정 (불일치)

4. **docs/02_API.md**
   - Sprint11~14 추가된 ~18개 새 엔드포인트(/compliance/feed, /compliance/mapping, /project/{id}/dast/batch 등) 미수록

**정정 전략**:
- 각 문서 **§0 정합 섹션** 추가 (현상태 기술·괴리 사항·계획)
- `docs/00_ADR.md` 최상단에 "⚠️ 현재 격리 미적용 상태" 명시 + TASK-1227 링크
- `docs/02_API.md` § Controller Inventory (백엔드 기동 후 Swagger 110경로 추출 + 마크다운 자동 생성 가능)
- `README.md` + `apps/README.md` 현행화 (포트·네트워크·주요 명령어)

**실행**:
- 백엔드 기동(`make backend`) 후 `/swagger-ui.html` 열어 라이브 API 와 문서 대조 → 일치 확인
- docs/02_API.md 최종 검수(마스터)

### ③ DAST 격리 아키텍처 분석 — 현상태 vs 권장안 트레이드오프

**현상태**:
- ai_engine 프로세스 내에서 dast-runner(FastAPI)가 executor 노드(execute_xss 등)를 Python subprocess로 호출
- 네트워크 격리: app-net (ai-net과 분리 안 됨) → SSRF 공격자가 ai_engine 컨텍스트에서 내부 타깃 탐색 가능
- **장점**: 배포 간단, 레이턴시 낮음
- **단점**: 프로덕션·멀티테넌트 환경에서 격리 미흡, 컴플라이언스(SOC2·ISO27001) 위반 가능

**권장안** (ADR-005):
- dast-isolated-net 전용 네트워크 격리 (docker-compose에 `dast-sandbox` 서비스 추가)
- executor 호출을 격리 네트워크 상의 API endpoint로 변경
- 배치 작업은 dast-isolated-net으로 라우팅
- **단점**: 배포 복잡, 레이턴시 증가, 운영비용 증가
- **요청자**: IR 투자 유치 논의에서 "멀티테넌트 보안 승인" 필수 → 권장안 채택 권고

**결정**: TASK-1227로 등재, Sprint 14 후 Phase1 우선순위로 설정

### ④ FEAT-COMP-005 Stage A 스코프 & 실행 결정

**비전**(WEDGE-6):
- KISA 공식자료(보안 가이드, 취약점 공개 정보 등)를 RAG로 인제스트
- 평가(compliance_mapping) 시 정부 기준 매핑 자동화

**단계화 합의**(Agile 점진)**:
1. Stage A (현재): DB + API 기반 (compliance_feed_items 테이블 + GET /api/v1/compliance/feed)
2. Stage B (후속): 크롤러 (외부 KISA 페이지 자동 긁기)
3. Stage C (후속): RAG (WEDGE-6 병렬 진행·별 태스크)

**Stage A 스코프**:
- V065 Flyway 마이그레이션: `compliance_feed_items` (id, title, content, content_hash, source_url, created_at)
- 백엔드: ComplianceFeedService + GET /api/v1/compliance/feed (JWT 인증)
- 프론트: /compliance 페이지 mock → API 연결 (현재 JSON stub은 유지·별도 변경 없음)
- **크롤러 삽입점**: ComplianceFeedService 내 `POST /api/v1/compliance/feed` (501 Not Implemented)

**기존 assets 미접촉**: `compliance-feed.json` items + `ComplianceMappingService` (독립 기능, Stage A 영향 없음)

**Reviewer 지적 & 적용**:
1. 프론트 console.warn 2건 제거 ✅
2. /compliance 페이지 key={item.id} (f.name 아님) 수정 ✅
3. StubComplianceFeed 삭제 여부 검토 → 현재 유지 (테스트용)

**백로그 등재**: 
- **TASK-1221**: Compliance Feed Crawler (Stage B, M)
- **WEDGE-6**: Compliance RAG (Stage C, L, 별 트랙)

---

## 3. 버그 수정 / 특이사항

### ③-1 백엔드 테스트 모듈 빌드 깨짐 (기존·Pre-FEAT-COMP-005)

**증상**: `./gradlew compileTestJava` 실패 (7 errors), 테스트 스위트 전체 RED

**원인**: V063(framework_version) 작업에서 `SecurityDocService.createRequest()` 시그니처가 변경(version 파라미터 추가)되었으나, 테스트 호출부 7곳이 미반영 → 컴파일 에러

**해결**: 테스트 호출부에 `version=null` 인자 보강 (7519ed8)

상세는 [트러블슈팅 문서](../troubleshooting/2026-06-30_backend-test-build.md) 참조.

---

## 4. 다음 세션에서 할 것

- [ ] Phase0 완료 검증 (TASK-1220~1226 중 완료 기준 재확인, 필요 시 문서 업데이트)
- [ ] Phase1 시작: VAL-1 대표런 (TASK-1228)
  - 실 취약 앱(WebGoat 대체, fastapi-vuln + 제품 DAST 공식 타깃)으로 E2E 검증
  - 보고서·규제 문서·컴플라이언스 매핑 통합 검증
- [ ] TASK-1227 (DAST 격리화) 설계 상세화
  - dast-isolated-net 구성
  - executor API endpoint 리팩토링
  - 배치 파이프라인 라우팅
- [ ] FEAT-COMP-005 Stage B (Compliance Feed Crawler) 구현 착수
