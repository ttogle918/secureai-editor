# Sprint 7 — 리포트 & 대시보드 & Android MVP
**기간**: 2026-05-18 ~ 2026-05-31 (Week 15–16)  
**목표**: PDF 리포트(iText7/OpenPDF) + 웹 대시보드 5개 차트 + Android MVP(로그인·대시보드·취약점 목록·FCM 알림) 완성

---

## 사전 발견 사항 (착수 전 보정)

| 항목 | 백로그 명세 | 실제 상태 | 조치 |
|------|-----------|---------|------|
| Flyway V010 | Report 테이블 | **이미 사용됨** (다른 마이그레이션) | **V035**로 변경 |
| iText7 의존성 | `build.gradle.kts` | **미포함** — Maven Central에서 추가 필요 | AGPL 라이선스 검토 후 의존성 추가 |
| Recharts | 프론트엔드 차트 | **설치됨** (2.12.4) | 별도 설치 불필요 |
| `apps/android/` | Android 프로젝트 | **빈 shell** — Compose/Hilt/Room/Firebase 전무 | `libs.versions.toml` 세팅이 TASK-703 첫 번째 하위 할일 |
| `VulnerabilityQueryService` trend | 일별 집계 API | **없음** — `countBySeverity`/`countByFilePath`만 존재 | TASK-702 백엔드에서 JPQL 집계 쿼리 신규 작성 |
| Firebase 프로젝트 | `google-services.json` | **미생성** | Stage 4 진입 전 Firebase Console 수동 등록 필요 |

---

## 이월 태스크

- **TASK-501/502/505** (Sprint 5 GitHub Layer): `feat/sprint5-github` 브랜치에서 별도 진행 — Sprint 7 범위 외

---

## Stage 0 — 사전 결정 사항 (착수 전 확정)

> 코드 구현 없음. 아래 항목을 먼저 결정한 뒤 Stage 1 진입.

| # | 항목 | 내용 | 결정 |
|---|------|------|------|
| 1 | **PDF 라이브러리** | iText7 Community = AGPL (상용 배포 시 라이선스 계약 필요). OpenPDF(LGPL)로 대체 가능 | ⬜ |
| 2 | **Firebase Console 등록** | `google-services.json` + Admin SDK 서비스 계정 키 발급 (Stage 4 전 수동 작업) | ⬜ |
| 3 | **`google-services.json` `.gitignore` 등록** | `apps/android/app/google-services.json` | ⬜ |
| 4 | **대시보드 API 스키마** | `GET /projects/{id}/dashboard` 단일 엔드포인트 vs 차트별 다중 엔드포인트 | ⬜ |
| 5 | **FCM 페이로드 스키마** | `data: { sessionId, projectId, deeplink: "secureai://session/{id}" }` (권장) | ⬜ |

---

## 실행 계획

### Stage 1 — 기반 구축 (병렬)

| TASK | 제목 | 서비스 | 파일 | 선행 |
|------|------|--------|------|------|
| TASK-701 (백엔드) | PDF/JSON 리포트 생성 | backend | `Report.java`, `V035__create_reports.sql`, `PdfGeneratorService.java`, `JsonReportGenerator.java`, `ReportController.java`, 다운로드 토큰 | Stage 0 #1 |
| TASK-703 | Android 프로젝트 초기화 & 인증 | android | `libs.versions.toml`, `NetworkModule.kt`, `TokenStorage.kt`, `LoginScreen.kt`, `RegisterScreen.kt`, `AuthViewModel.kt`, `NavGraph.kt` | — |

> **병렬 안전**: TASK-701은 `apps/backend/`, TASK-703은 `apps/android/` — 파일 영역 완전 분리

---

### Stage 2 — 백엔드 집계 + Android 화면 (병렬)

| TASK | 제목 | 서비스 | 파일 | 선행 |
|------|------|--------|------|------|
| TASK-702 (백엔드) | 차트 집계 API | backend | `VulnerabilityRepository` 일별 GROUP BY `@Query`, `VulnerabilityQueryService` 집계 메서드, `GET /projects/{id}/vulnerabilities/trend`, Redis 캐시 | Stage 0 #4 |
| TASK-704 | Android 대시보드 & 취약점 목록 | android | `DashboardScreen.kt`, `VulnListScreen.kt`, `VulnDetailScreen.kt`, `SecurityScoreGauge.kt`, Room DB 엔티티 + DAO, `VulnRepository.kt` | TASK-703 |

> TASK-702(백엔드)와 TASK-704(Android)는 독립 서비스 — 병렬 가능. 단 TASK-704는 TASK-703 완료 후 시작.

---

### Stage 3 — 프론트엔드 통합 + FCM 백엔드

| TASK | 제목 | 서비스 | 파일 | 선행 |
|------|------|--------|------|------|
| TASK-701 (프론트엔드) | 리포트 다운로드 UI | frontend | 리포트 생성 버튼, 다운로드 토큰 처리, 상태 폴링 | Stage 1 TASK-701 |
| TASK-702 (프론트엔드) | 대시보드 차트 5종 | frontend | `SecurityScoreRing`, `SeverityBarChart`, `TrendLineChart`, `FileHeatmap`, `OwaspCoverageMatrix`, `dashboard/page.tsx` | Stage 2 TASK-702 |
| TASK-705 (백엔드) | FCM Push 백엔드 | backend | Firebase Admin SDK 의존성, `FcmPushService.java`, `AnalysisService`의 `SessionCompletedEvent` 발행 지점 연동 | Stage 0 #2 #5 |

> Stage 3 프론트엔드 두 태스크(`dashboard/page.tsx` 공유 가능)는 공유 레이아웃 수정 겹칠 경우 순차 진행 권장.

---

### Stage 4 — FCM Android 연동 & E2E 검증

| TASK | 제목 | 서비스 | 파일 | 선행 |
|------|------|--------|------|------|
| TASK-705 (Android) | FCM Android + SSE 이중 전략 | android | `google-services.json`, `SecureAiFcmService.kt`, `SseClient.kt`, `AnalysisViewModel.kt`, 알림 채널 설정 | Stage 3 TASK-705 백엔드, TASK-704 |

---

## 병렬 실행 그룹

```
Stage 1 (동시 시작 — 선행 의존성 없음)
├── TASK-701 (BE) : backend Report 엔티티 + V035 + PdfGeneratorService + ReportController
└── TASK-703      : android 의존성 세팅 + NetworkModule + TokenStorage + Login/Register + NavGraph

           ↓ Stage 1 완료 후

Stage 2 (병렬 — 다른 서비스)
├── TASK-702 (BE) : backend VulnerabilityRepository 집계 쿼리 + trend API + Redis 캐시
└── TASK-704      : android DashboardScreen + VulnListScreen + Room DAO
  (TASK-704는 TASK-703 완료 후에만 시작 가능)

           ↓ Stage 2 완료 후

Stage 3 (프론트엔드 순차 + 백엔드 병렬)
├── TASK-701 (FE) : frontend 리포트 다운로드 UI
├── TASK-702 (FE) : frontend 5개 차트 컴포넌트 + dashboard/page.tsx
└── TASK-705 (BE) : backend FCM Push + SessionCompletedEvent 연동

           ↓ Stage 3 완료 후

Stage 4 (순차)
└── TASK-705 (Android) : android FCM + SSE 이중 전략 + E2E 검증
```

---

## 리스크 & 완화

| 리스크 | 영향도 | 완화 |
|--------|-------|------|
| **iText7 AGPL** — 상용 배포 시 라이선스 계약 필요 | 🔴 | Stage 0에서 OpenPDF(LGPL) 대체 여부 확정 후 의존성 추가 |
| **Flyway V010 충돌** — 이미 다른 마이그레이션이 사용 | 🔴 | V035로 즉시 수정 (실행 시 즉시 오류 발생) |
| **Firebase 미등록** — `google-services.json` 없으면 Stage 4 전체 차단 | 🔴 | Stage 3 진행 중 사용자가 Firebase Console에서 프로젝트 생성 병행 |
| **Android 의존성 전무** — Compose/Hilt/Room/OkHttp/Security-Crypto 미등록 | 🔴 | TASK-703 첫 번째 하위 할일로 `libs.versions.toml` 세팅 필수 |
| **대시보드 API 스키마 미정** — 프론트/백엔드 경계 불분명 | 🟠 | Stage 0 #4에서 응답 JSON 구조 합의 후 진입 |
| **PDF 생성 30초 SLA** — 취약점·패치 코드 많을 경우 초과 가능 | 🟠 | `@Async` + `GET /reports/{id}/status` 폴링 엔드포인트 설계에 포함 |
| **Android 인증서 피닝 개발환경** — 자체 서명 인증서에서 즉시 연결 실패 | 🟡 | `NetworkSecurityConfig`로 debug flavor에서만 피닝 비활성화, release에서 활성화 |
| **Stage 3 프론트엔드 파일 충돌** — `dashboard/page.tsx` 두 태스크 동시 수정 | 🟡 | 공유 파일 수정 시 순차 진행 또는 Dev 에이전트에 파일 경계 명시 |

---

## 테스트 마일스톤

| # | 마일스톤 | 달성 기준 | TASK |
|---|---------|---------|------|
| M1 | 리포트 생성 API | `POST /api/v1/reports` → 30초 내 PDF 파일 생성 + 다운로드 토큰 반환 | TASK-701 |
| M2 | Android 로그인 | 에뮬레이터에서 로그인 성공 → 대시보드 화면 진입 | TASK-703 |
| M3 | 차트 집계 API | `GET /projects/{id}/vulnerabilities/trend` → 7일 일별 집계 응답 정확성 | TASK-702 |
| M4 | Android 취약점 화면 | 목록 → 상세 네비게이션 + 오프라인 시 Room 캐시 표시 | TASK-704 |
| M5 ⭐ | 웹 대시보드 완성 | 5개 차트 모두 렌더링 + 리포트 PDF 다운로드 성공 | TASK-701+702 |
| M6 ⭐ | FCM E2E | 분석 완료 → FCM Push 수신 → 딥링크로 해당 세션 진입 (foreground/background 전환 포함) | TASK-705 |

---

## 구현 완료 기록

### Stage 1 완료 (2026-05-18)

**커밋**: `e01dd5e` — `feat(sprint7-stage1): PDF 리포트 백엔드 + Android 인증 기반`

#### TASK-701 (백엔드)
- `build.gradle.kts`: OpenPDF 1.3.30 (LGPL) 의존성 추가
- `V035__create_reports.sql`: reports 테이블 (UUID PK, download_token UNIQUE, expires_at 90일)
- `Report.java`: 엔티티 — `markGenerating()`, `markCompleted()`, `markFailed()` 도메인 메서드
- `PdfReportGenerator.java`: Template Method — 표지→심각도 요약→취약점 목록→OWASP 매핑
- `JsonReportGenerator.java`: CycloneDX 1.5 포맷
- `ReportService.java`: 생성 요청, 상태 조회, 다운로드 — `REPORT_BASE_DIR.startsWith()` Path Traversal 방어
- `ReportAsyncProcessor.java`: `@Async` 분리 — SRP (비동기 실행만 담당)
- `ReportController.java`: POST/GET/다운로드 엔드포인트
- **단위 테스트**: ReportServiceTest 10개 + PdfReportGeneratorTest 4개 = 14개 통과

**Reviewer 지적 사항**: `readFileAsResource()`에 `REPORT_BASE_DIR` 기반 경로 검증 추가로 해결

#### TASK-703 (Android)
- `libs.versions.toml`: Compose BOM, Hilt, Retrofit, OkHttp, Room, Security-Crypto 등 세팅
- `TokenStorage.kt`: EncryptedSharedPreferences + Android Keystore AES256_GCM
- `NetworkModule.kt`: OkHttp (Authorization 인터셉터, DEBUG=BODY/release=NONE)
- `AuthRepository.kt` (인터페이스) + `AuthRepositoryImpl.kt` — DIP
- `AuthViewModel.kt`: `sealed interface AuthUiState`, SharedFlow 네비게이션 이벤트
- `LoginScreen.kt`, `RegisterScreen.kt`: Compose UI
- `NavGraph.kt`: `isLoggedIn()` 기반 startDestination 동적 결정
- `RootDetector.kt`: su 바이너리 + 루트 패키지 감지
- `network_security_config.xml`: release cleartext 차단, debug 10.0.2.2 예외
- **단위 테스트**: AuthViewModelTest 8 + TokenStorageTest 8 + AuthRepositoryImplTest 6 = 22개 통과 (JVM 타겟 11 수정, Loading 중복 호출 방어 버그 수정 포함)

---

## 완료 기준 (DoD)

```
[ ] PDF 리포트 30초 내 생성 + 다운로드 토큰 24시간 만료 동작 ⭐
[ ] 대시보드 5개 차트 모두 렌더링 (2초 내 로딩, Redis 캐시) ⭐
[ ] Android 로그인 → 대시보드 → 취약점 목록 네비게이션 완성 ⭐
[ ] FCM Push (background) + SSE (foreground) 이중 전략 동작 ⭐
[ ] 다운로드 토큰 만료 후 접근 거부 (403)
[ ] Room 오프라인 캐시 — 네트워크 끊김 시 마지막 데이터 표시
[ ] 단위·통합 테스트 모두 통과 (CI 그린)
```
