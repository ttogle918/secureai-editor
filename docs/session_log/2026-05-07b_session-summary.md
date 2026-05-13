# [2026-05-07] 작업 세션 요약 (2차)

**브랜치**: `feat/sprint3` → `feat/sprint4`  
**작업 범위**: 크레딧 시스템 · BYOK · 모델 선택 전 스택 구현, Sprint 4 백로그 갱신, Docker 빌드 오류 수정

---

## 1. 완료 작업

| 항목 | 주요 파일 |
|------|---------|
| DB 마이그레이션 (크레딧·BYOK) | `V016__add_credit_and_byok.sql` |
| 모델 상수 정의 | `ModelConstants.java` |
| CreditTransaction 엔티티·레포 | `CreditTransaction.java`, `CreditTransactionRepository.java` |
| CreditService | `CreditService.java` |
| User·Plan 엔티티 필드 추가 | `User.java`, `Plan.java` |
| UserService 기능 확장 | `UserService.java` |
| UserController 엔드포인트 추가 | `UserController.java` |
| DTO 신규 작성 | `SaveApiKeyRequest.java`, `UpdateSettingsRequest.java`, `CreditSummaryResponse.java` |
| UserMeResponse CreditInfo 추가 | `UserMeResponse.java` |
| AiAgentClient 파라미터 확장 | `AiAgentClient.java`, `DefaultAiAgentClient.java` |
| AnalysisService 모델·키 주입 | `AnalysisService.java` |
| AI Engine AgentState 확장 | `agent_state.py` |
| claude_client BYOK 지원 | `claude_client.py` |
| sast_node 모델·키 전달 | `sast_node.py` |
| analyze 라우트 파라미터 확장 | `api/routes/analyze.py` |
| chat_client 모델·키 오버라이드 | `chat_client.py` |
| chat 라우트 파라미터 확장 | `api/routes/chat.py` |
| useAuth credits 인터페이스 추가 | `hooks/useAuth.ts` |
| AppHeader 설정 아이콘 추가 | `components/layout/AppHeader.tsx` |
| middleware 설정 경로 보호 | `middleware.ts` |
| 설정 페이지 신설 | `app/settings/page.tsx` |
| 랜딩 가격 섹션 추가 | `app/page.tsx` |
| Sprint 4 백로그 TASK-408 추가 | `docs/07_SPRINT_BACKLOG_V2.md` |
| Docker 빌드 오류 수정 | `AnalysisService.java` import 누락 수정 |

---

## 2. 의논 내용 & 결정 맥락

### 크레딧 시스템 설계
토큰 단위가 아닌 **파일 단위** 크레딧 과금으로 결정.
사용자가 이해하기 쉽고 예측 가능하기 때문.

| 모델 | 크레딧/파일 |
|---|---|
| Claude Haiku | 1 cr |
| Claude Sonnet | 5 cr |
| Claude Opus | 20 cr |

플랜별 월 크레딧: Free 100 · Pro 2,000 · Team 10,000.

### BYOK (Bring Your Own Key)
Anthropic API 키를 직접 등록하면 크레딧 소모 없이 무제한 분석.  
키는 기존 `AesEncryptionConverter`(AES-256-GCM)로 암호화해 BYTEA 컬럼에 저장.  
분석 시작 전 `UserService.getAnalysisSettings()`로 복호화해 AI Engine에 전달, 로그 출력 금지.

### BYOK 클라이언트 설계 (AI Engine)
`claude_client.py`에서 `api_key`가 있으면 싱글턴 클라이언트 대신 **1회용 `AsyncAnthropic` 인스턴스** 생성.  
캐싱 없이 per-request로 만드는 이유: 사용자 키를 프로세스 메모리에 장기 보관하지 않기 위함.

### 모델 오버라이드 전달 경로
```
UserController ← 설정 저장
UserService.getAnalysisSettings() → (preferredModel, apiKey)
AnalysisService → AiAgentClient.startAnalysis()
DefaultAiAgentClient → POST /agent/analyze {preferred_model, user_api_key}
AgentState → sast_node → _analyze_chunks() → analyze_for_sast()
```
Chat도 동일 경로: `ChatRequest.preferred_model/user_api_key` → `stream_chat()`.

### 설정 페이지 UX 설계
- **크레딧 카드**: 잔액·BYOK 상태·현재 모델 한눈에 표시
- **BYOK 입력**: 마스킹 + 눈 아이콘 토글, 저장 시 즉시 상태 갱신
- **모델 선택**: 라디오 스타일 카드, 파일당 크레딧 비용 배지 표시, 클릭 즉시 저장

### Docker 빌드 오류 원인
`AnalysisService.java`에 `UserService` 필드와 사용 코드는 있었으나 **import 문 누락**.  
`@RequiredArgsConstructor` 에러도 실제로는 동일 원인 — Lombok이 알 수 없는 타입의 생성자 생성 실패.  
`import io.secureai.backend.domain.user.service.UserService;` 한 줄로 해결.

---

## 3. 버그 수정

| 버그 | 원인 | 수정 |
|---|---|---|
| Docker build `compileJava` 실패 | `AnalysisService`에 `UserService` import 누락 | import 추가 |

---

## 4. 다음 세션에서 할 것

### 단기
- [ ] Railway 배포 완료 (backend, ai_engine 서비스 추가 + 환경변수 설정)
- [ ] Vercel frontend 배포
- [ ] 실 서비스 연동 E2E 테스트 (회원가입 → 분석 → SSE 수신)

### Sprint 5 (GitHub Layer 2)
- [ ] TASK-501 커밋 히스토리 시크릿 스캔
- [ ] TASK-502 PR Webhook 자동 보안 리뷰
- [ ] TASK-503 전체 레포 SAST 최적화
