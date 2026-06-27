# SecureAI 테스트 시나리오 리뷰 (Test Scenarios Review)

이 문서는 프로젝트 내의 백엔드 및 AI 엔진 테스트 코드를 기반으로 현재 구현된 테스트 시나리오가 비즈니스 흐름을 얼마나 잘 커버하고 있는지 점검한 내용입니다.

## 1. AI 엔진 테스트 커버리지 (`apps/ai_engine/tests`)

AI 엔진은 LangGraph를 기반으로 한 복잡한 흐름을 가지며, 단위 테스트와 통합 테스트가 잘 구성되어 있습니다.

| 테스트 폴더/파일 | 커버하는 시나리오 | 커버리지 상태 | 개선 사항 |
|---|---|---|---|
| `test_secret_scan.py` | 커밋에 하드코딩된 API 키/비밀번호가 포함되었을 때 정규식/엔트로피 기반 탐지 여부 검증 | 양호 | 특정 난독화 패턴 추가 필요 |
| `test_sbom_parser.py` | 취약한 의존성이 포함된 `package.json` 또는 `pom.xml` 파싱 및 취약점 검출 로직 검증 | 양호 | - |
| `test_webhook_pr.py` | GitHub Webhook 수신 시 PR Diff를 추출하여 AI 엔진으로 전달하는 트리거 검증 | 양호 | - |
| `agent/` | 에이전트 노드 단위 테스트. 파일 필터링, 정적 분석(SAST) 프롬프트 전송, 응답 파싱 | 높음 | LLM 환각(Hallucination) 응답에 대한 예외 처리 시나리오 보강 |
| `sandbox/` | DAST 격리 환경(docker-compose) 통신 및 익스플로잇 성공/실패 시나리오 (proven_exploitable 라벨링) | 매우 높음 | - |

## 2. 백엔드 테스트 커버리지 (`apps/backend/src/test/java`)

백엔드는 Spring Boot 기반이며, 인증, 요금 결제, API 통신 등의 핵심 비즈니스 로직을 검증해야 합니다.

| 테스트 대상 | 커버해야 할 시나리오 | 예상 커버리지 상태 | 개선 사항 |
|---|---|---|---|
| **인증 및 인가** | 2FA 활성화 시 로그인 흐름 분기, 잘못된 TOTP 코드 거부, 세션 만료 및 갱신 | 높음 | - |
| **결제 및 토큰** | BYOK 모드와 플랫폼 모드에서의 `token_usage` 차감 로직, 잔여 크레딧 0일 때의 402 응답 | 양호 | 멀티스레드 환경에서의 동시 차감 (Race condition) 테스트 필요 |
| **AI 엔진 연동** | 백엔드 -> AI 엔진 HTTP 호출 시 타임아웃, 500 에러 등에 대한 Fallback 로직 및 에러 처리 | 보통 | 재시도(Retry) 서킷 브레이커 동작 시나리오 구체화 필요 |
| **SSE 스트림** | AI 엔진의 웹훅을 받아 프론트엔드로 끊김 없이 SSE 이벤트를 방출하는지 검증 | 보통 | SSE 연결이 끊겼을 때의 재연결(Reconnection) 상태 복구 테스트 필요 |

## 3. 프론트엔드 테스트 상황

현재 프론트엔드(`apps/frontend/`)에는 별도의 큰 e2e 테스트(Playwright, Cypress)나 복잡한 단위 테스트(Jest, Vitest) 코드가 충분히 명시되지 않았습니다. UI 반영 여부는 데모 시연 및 수동 QA를 통해 검증된 상태입니다.

- **권장 개선 사항**: `useStartAnalysis` 훅이나 SSE 스트림 처리 등 핵심 비즈니스 로직에 대해 Vitest를 이용한 단위 테스트 추가.
- DAST 진행 중 실시간으로 노출되는 취약점 업데이트 시나리오를 MSW(Mock Service Worker)로 모킹(Mocking)하여 프론트엔드 단독 테스트 가능하도록 구성.

## 4. 모바일 통신 및 알림 (Push Notifications)
- [ ] **디바이스 토큰 등록 (`DeviceTokenController`)**: 사용자 모바일 기기 토큰 저장.
- [ ] **알림 발송 이벤트**: 심각한 취약점 발견 시 FCM 발송 통합 테스트.

## 5. 엔터프라이즈 인프라 및 운영 백그라운드 (Enterprise Ops)
### 백엔드 (Java Spring Boot)
- [x] **모니터링 및 제로데이 재대조 (`MonitoringServiceTest`, `MonitoringCveReMatchListenerTest`)**: 새 CVE와 기존 코드 매칭 검증 테스트가 작성되어 있습니다.
- [x] **백업 및 토큰 정리 (`BackupJobTest`, `RefreshTokenCleanupJobTest`)**: 백업 덤프 생성 및 만료 토큰 삭제 테스트가 존재합니다.
- [ ] **파티션 유지보수 누락**: `PartitionMaintenanceJobTest` 및 `ExpiredDataCleanupJobTest` 등 일부 DB 파티션 관련 테스트는 작성되어 있지 않아, 보완이 필요합니다.

### AI 엔진 백그라운드 (Python FastAPI)
- [x] **캐시 적용 확인**: `cache_check_node`가 Redis를 정상적으로 조회하는지에 대한 유닛 테스트 검토 필요.
- [x] **시크릿 스캐닝 및 API 발견**: `secret_scan_node`와 `api_discovery_node`의 정규식 매칭이 다양한 프레임워크(Spring, FastAPI)를 올바르게 파싱하는지 검증.

## 추가 개선 제안 (Recommendations)
1. **프론트엔드 E2E 테스트 도입**: 현재 백엔드와 AI 엔진에는 꼼꼼한 테스트가 존재하나, Next.js 프론트엔드의 화면 전환 흐름(Cypress/Playwright)에 대한 테스트는 부족합니다.
2. **DAST 격리망 테스트 강화**: `dast-isolated-net` 환경에서 익스플로잇이 실제로 차단되거나 실행되는지 확인할 수 있는 통합 환경 테스트 자동화가 필요합니다.
3. **스케줄러 락(Shedlock) 동시성 테스트**: 여러 백엔드 인스턴스가 동시에 실행될 때 `PartitionMaintenanceJob` 등의 배치 작업이 중복 실행되지 않는지 검증하는 동시성 테스트를 권장합니다.

## 종합 평가
전반적으로 핵심 보안 기능(SAST, DAST, SBOM)과 파이프라인(Webhook, Patch)에 대해서는 **AI 엔진** 쪽에 테스트 하니스가 매우 강력하게 구축되어 있습니다. (예: `benchmarks/owasp`, `cve` 재현 등) 
결제 흐름이나 SSE 엣지 케이스 등 **백엔드/프론트엔드** 연동 쪽에 예외 상황 단위 테스트를 보강한다면 더욱 완벽한 엔터프라이즈급 프로덕트로 자리잡을 수 있을 것입니다.
