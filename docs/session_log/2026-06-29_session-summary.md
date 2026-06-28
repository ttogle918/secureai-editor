# [2026-06-29] 작업 세션 요약

**브랜치**: `main`
**작업 범위**: VC 데모 녹화 준비 — DAST EXPLOITED 체인 완성 + 풀 드라이런 + 발견 버그 5종 수정(DAST 별칭·billing 가격·리포트 세션폴백·규제문서 비동기 2종)

---

## 1. 완료 작업

| 항목 | 주요 파일 | 커밋 |
|------|---------|------|
| DAST executor 별칭 추가(XSS/IDOR) | apps/ai_engine/agent/nodes/dast/dast_runner.py | `6251f4b` |
| 요금제 크레딧 단가 정합(Pro/Team/Starter) | apps/frontend/src/app/billing/page.tsx | `a4af00d` |
| 리포트 세션 미지정 폴백(최신 세션) | apps/backend/.../report/service/ReportAsyncProcessor.java | `2ea52c5` |
| 규제 문서 @Async afterCommit 이동 | apps/backend/.../report/service/SecurityDocService.java | `4dd61de` |
| 규제 문서 LazyInitializationException 해결(JOIN FETCH) | SecurityDocRequestRepository.java, SecurityDocAsyncProcessor.java | `3b621b2` |

---

## 2. 의논 내용 & 결정 맥락

- **데모 클라이맥스 취약점 선정 변경(SSRF→XSS)**: 격리망(dast-isolated-net)에 SSRF 내부 타깃(메타데이터/내부서비스)이 없어 SSRF는 "안전"으로 표기됨. 실제 EXPLOITED 검증된 건 XSS `/greet`뿐 → 정직성(1종 완주) 원칙에 따라 데모 클라이맥스는 XSS 하나로 통일.

- **씬5(Patch) PR 생성 실패 → 레포 푸시로 해결**: 패치 대상 파일이 GitHub kkebi 레포에 존재해야 PR 생성 가능(없으면 PATCH_CONTENT_UNAVAILABLE). fastapi-vuln-sample이 미푸시 상태라 XSS PR 실패 → kkebi 레포에 fastapi-vuln-sample 커밋·푸시 → XSS PR #3 생성 성공(별개 PR #2=demo-vuln-sample/app.py SQLi).

- **규제 문서 vs 보고서 생성 기능 분리**: "규제 문서"(ISMS-P/CISO/행안부 3종, 결정론적 매핑)와 "보고서 생성"(OWASP Top10 PDF)은 별개 기능. 초기에 혼동했다가 정정하여 각각 독립적인 async processor로 처리.

- **데모 대본 갱신**: `docs/portfolio/깨비_데모대본_v1.md` → v2로 갱신(씬3 XSS 수정·씬6 정정·씬7 가격 업데이트·prep 체크리스트 추가). (gitignore, 커밋 불포함)

---

## 3. 버그 수정 / 특이사항

DAST·Report·SecurityDoc 파이프라인에서 발견된 5개 버그 수정. 상세는 [트러블슈팅 문서](../troubleshooting/2026-06-29_demo-dryrun-fixes.md) 참조.

- 배치 DAST SSE 스트림 연결 실패 (관련: `6fa590d`)
- DAST 배치 취약점 EXPLOITED 미표기(executor 별칭) 및 MSYS 경로변환 함정
- 규제 문서 생성 타임아웃(transactional 타이밍) 및 LazyInitializationException 연쇄
- 리포트 생성 시 프로젝트 누적 취약점 표기 (세션 폴백)

---

## 4. 다음 세션에서 할 것

- [ ] 백로그 `docs/07_SPRINT_BACKLOG_V4_260523.md`의 **Sprint 12C(TASK-1220~1226)** 참조 및 구현 시작
  - DAST executor 확장(SQLi·SSRF·CmdI·IDOR/BAC)
  - apiGroups 영속화 및 캐싱
  - DAST 런타임 compose 자동화
  - 요금제 DB↔UI 정합 통합 테스트
  - ai_engine RAG 임베딩 모델 통합
  - SSE 캐시 레이스 조건 해결
  - 인앱 뷰 전환 플레이키 구현
