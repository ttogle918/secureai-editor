# SecureAI 기능 명세 및 코드 매핑 (Feature Map)

이 문서는 SecureAI 프로젝트의 주요 기능들과 해당 기능이 구현된 백엔드, AI 엔진, 프론트엔드의 파일 및 메서드/컴포넌트 위치를 정리한 맵입니다.

## 1. 인증 및 사용자 관리 (Auth & User Management)
| 기능 | Backend (Java Spring Boot) | AI Engine (Python FastAPI) | Frontend (Next.js) |
|---|---|---|---|
| 사용자 로그인/가입 | `AuthController.java` | - | `app/(auth)/login/page.tsx`<br>`app/onboarding/page.tsx` |
| 2FA (TOTP) 인증 | `TotpController.java` | - | `app/settings/security/page.tsx` |
| 사용자 프로필 관리 | `UserController.java` | - | `app/profile/page.tsx` |
| GDPR 데이터 관리 | `GdprController.java` | - | `app/legal/privacy/page.tsx` |

## 2. 조직 및 워크스페이스 (Organization & Workspace)
| 기능 | Backend (Java Spring Boot) | AI Engine (Python FastAPI) | Frontend (Next.js) |
|---|---|---|---|
| 조직 생성 및 조회 | `OrganizationController.java` | - | `app/team/page.tsx` |
| 멤버 초대 | `InvitationController.java` | - | `app/invite/page.tsx` |
| 워크스페이스 모드 전환 | `WorkspaceController.java` | - | - |
| 프로젝트 관리 | `ProjectController.java` | - | `app/projects/page.tsx` |

## 3. 정적 및 동적 보안 분석 (SAST & DAST)
| 기능 | Backend (Java Spring Boot) | AI Engine (Python FastAPI) | Frontend (Next.js) |
|---|---|---|---|
| 정적 분석 (SAST) 시작 | `AnalysisController.java` | `api/routes/analyze.py` (`/agent/analyze`)<br>`agent/nodes/sast_node.py` | `app/editor/page.tsx`<br>`app/github-scan/page.tsx` |
| 동적 분석 (DAST) 연동 | `DastController.java` | `api/routes/dast.py` (`/agent/dast`)<br>`agent/nodes/dast/` | - |
| 스크릿 스캐닝 | `CommitSecretController.java` | `api/routes/secret_scan.py` | `app/commit-scan/page.tsx` |
| 분석 진행률 추적 (SSE) | `ProgressLogController.java` | - | `app/editor/page.tsx` (Progress Panel) |
| 취약점 조회 및 관리 | `VulnerabilityController.java` | - | `app/editor/page.tsx` (VulnDetailPanel) |
| 패치 자동화 및 검증 | `PatchController.java` | `api/routes/confirm.py` (`/agent/confirm`) | - |

## 4. 컴플라이언스 및 리포트 (Compliance & Reports)
| 기능 | Backend (Java Spring Boot) | AI Engine (Python FastAPI) | Frontend (Next.js) |
|---|---|---|---|
| 컴플라이언스 매핑 | `ComplianceController.java`<br>`ComplianceFrameworkController.java` | - | `app/compliance/page.tsx` |
| 프로젝트 대시보드 | `DashboardController.java` | - | `app/projects/[id]/dashboard/page.tsx` |
| 기본 리포트 생성 및 다운로드 | `ReportController.java` (`/api/v1/reports`) | - | - |
| ROI 리포트 및 이메일 전송 | `ReportController.java` (`/roi/pdf`, `/send-email`) | - | - |
| 보안 문서 생성 (CISO/ISMS) | `SecurityDocController.java` (`/reports/security`) | - | - |
| SBOM 생성 | `SbomController.java` | `api/routes/sbom.py` | - |

## 6. 엔터프라이즈 인프라 및 운영 (Enterprise Ops)
| 기능 | Backend (Java Spring Boot) | AI Engine (Python FastAPI) | Frontend (Next.js) |
|---|---|---|---|
| 야간 자동 스캔 (Cron 스케줄링) | `ProjectScheduleController.java` | - | - |
| 데이터베이스 백업 | `BackupJob.java` | - | - |
| 만료 데이터 및 토큰 정리 (Retention) | `ExpiredDataCleanupJob.java`<br>`RefreshTokenCleanupJob.java` | - | - |
| 서버 상태 및 SSL 만료 모니터링 | `MonitoringJob.java`<br>`SslCertChecker.java` | - | - |
| 제로데이 CVE 지속 재검증 | `MonitoringCveReMatchListener.java` | - | - |
| FCM 모바일 푸시 알림 | `DeviceTokenController.java` | - | - |
| 스팸/바운스 이메일 웹훅 처리 | `EmailWebhookController.java` | - | - |

## 7. AI 에이전트 핵심 로직 및 최적화 (AI Engine Core)
| 기능 | Backend (Java Spring Boot) | AI Engine (Python FastAPI) | Frontend (Next.js) |
|---|---|---|---|
| 하드코딩된 시크릿 검사 (Secret Scan) | - | `agent/nodes/secret_scan_node.py` | - |
| API 엔드포인트 자동 식별 | - | `agent/nodes/api_discovery_node.py` | - |
| 스캔 결과 캐싱 (토큰 비용 절감) | - | `agent/nodes/cache_check_node.py` | - |
| URL API 민감 정보 노출 탐지 | - | `agent/nodes/vuln_classifier.py`<br>`V064__add_url_api_exposure_guideline.sql` | - |
| AI 챗봇 | `ChatController.java` | `api/routes/chat.py` | - |
| 자동 번역 | `TranslateController.java` | `api/routes/translate.py` | - |
| CVE 검색 | `CveSearchController.java` | - | - |
| GitHub 웹훅 처리 | `GitHubWebhookController.java` | - | - |
