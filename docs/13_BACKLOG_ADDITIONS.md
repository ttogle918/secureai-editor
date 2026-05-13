# SecureAI — 추가 기능 & MCP 백로그
> 작성일: 2026-04-25 | 버전: v1.0  
> 목적: `07_SPRINT_BACKLOG_V2.md` 미포함 항목 중 추가가 필요한 기능 및 MCP 도구 목록  
> 우선순위: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low

---

## 목차

1. [추가 MCP 서버 도입](#1-추가-mcp-서버-도입)
2. [보안 강화 기능](#2-보안-강화-기능)
3. [API 기능 보완](#3-api-기능-보완)
4. [AI Agent 고도화](#4-ai-agent-고도화)
5. [운영 / 관측성 기능](#5-운영--관측성-기능)
6. [컴플라이언스 & 감사 기능](#6-컴플라이언스--감사-기능)

---

## 1. 추가 MCP 서버 도입

현재 `11_CLAUDE_CODE_GUIDE.md`에 명시된 MCP는 `filesystem`, `github` 두 가지입니다.  
아래는 SecureAI 개발 및 자체 보안 분석 품질 향상을 위해 추가 도입이 필요한 MCP 서버입니다.

---

### MCP-001 🔴 `mcp-server-postgres`
**용도**: AI Agent가 분석 세션 결과, 취약점 데이터를 직접 DB 조회해 컨텍스트로 활용  
**시나리오**:
- SAST 분석 후 "이 프로젝트에서 이전에 발견된 동일 유형 취약점" 참조
- Patch Agent가 이전 패치 이력을 조회해 일관된 패치 스타일 유지

```json
// claude_code_config.json 추가 예시
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "${DATABASE_URL}"]
    }
  }
}
```

**주의**: Read-Only 계정으로 연결 (INSERT/UPDATE/DELETE 권한 제거)

---

### MCP-002 🔴 `mcp-server-docker`
**용도**: DAST 샌드박스 컨테이너 생성/모니터링/종료를 AI Agent가 직접 제어  
**시나리오**:
- LangGraph DAST 노드에서 Docker 컨테이너 생명주기 직접 관리
- 컨테이너 실시간 로그 스트리밍 → SSE 중계

```bash
# 커뮤니티 MCP Docker 서버
npx @modelcontextprotocol/server-docker
```

**현재 상태**: Spring Boot Java Docker SDK로 우회 구현 중 → MCP 전환 시 AI Agent 주도 제어 가능

---

### MCP-003 🟠 `mcp-server-redis`
**용도**: AI Agent가 캐시 히트율 확인, 분산 락 상태 조회, SSE 채널 상태 디버깅  
**시나리오**:
- 분석 중 캐시 히트/미스 통계를 Agent가 직접 읽어 최적화 판단
- DAST 락 상태 확인 후 중복 실행 방지 로직 Agent 측에서 처리

---

### MCP-004 🟠 `mcp-server-brave-search` 또는 `mcp-server-exa`
**용도**: AI Agent가 CVE 정보, 보안 권고(Security Advisory) 실시간 검색  
**시나리오**:
- NVD API 캐시 미스 시 웹 검색으로 최신 CVE 정보 보완
- 패치 생성 시 "이 라이브러리의 최신 보안 버전" 검색

```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": { "BRAVE_API_KEY": "${BRAVE_API_KEY}" }
    }
  }
}
```

---

### MCP-005 🟠 `mcp-server-github` (확장)
**현재**: 기본 파일 조회 수준  
**추가 활용**:
- PR diff를 직접 읽어 변경된 코드만 분석 (전체 파일 대신 diff 분석 → 토큰 절감)
- GitHub Security Advisory 조회
- Dependabot Alert 조회 → SecureAI CVE 결과와 교차 검증

---

### MCP-006 🟡 `mcp-server-slack`
**용도**: 보안 이슈 발견 시 지정 채널에 자동 알림 (Phase 3 모니터링 연동)  
**시나리오**:
- Critical 취약점 발견 시 `#security-alerts` 채널 즉시 알림
- 모니터링 스캔 결과 요약 자동 발송

---

### MCP-007 🟡 `mcp-server-filesystem` (확장)
**현재**: 기본 파일 읽기  
**추가 필요**:
- 분석 대상 디렉토리 외부 접근 차단 (샌드박스 경로 제한)
- 바이너리 파일 자동 스킵 설정
- `.gitignore` 패턴 자동 반영 (분석 제외 경로)

---

### MCP-008 🟢 `mcp-server-sentry`
**용도**: 운영 중 에러 트래킹 데이터를 AI Agent가 조회해 자동 버그 분류  
**시나리오**:
- Sentry 이슈 발생 시 관련 코드 자동 분석 → 취약점 연관성 확인

---

## 2. 보안 강화 기능

### FEAT-SEC-001 🔴 2단계 인증 (2FA / TOTP)
**현재 상태**: 미구현  
**필요성**: Enterprise 플랜 고객, 보안 전문가 계정 보호  
**구현 방향**:
- TOTP (Google Authenticator 호환): `dev.samstevens.totp` 라이브러리
- 복구 코드 8개 생성 (1회용, AES-256 암호화 저장)
- API: `POST /auth/2fa/setup`, `POST /auth/2fa/verify`, `DELETE /auth/2fa`
- 플랜 적용: Team 이상 강제 활성화 옵션 (Enterprise 관리자 설정)

**추가할 ERD**:
```sql
ALTER TABLE users ADD COLUMN totp_secret VARCHAR(100);  -- AES 암호화
ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT FALSE;
CREATE TABLE totp_recovery_codes (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    code_hash VARCHAR(64),  -- SHA-256
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### FEAT-SEC-002 🔴 IP 허용 목록 (IP Allowlist)
**현재 상태**: 미구현  
**필요성**: Enterprise 고객 — 사내 IP에서만 API 접근 허용  
**구현 방향**:
- `team_settings` 테이블에 `allowed_ip_ranges CIDR[]` 컬럼 추가
- Spring Security `OncePerRequestFilter`로 IP 검증
- CIDR 범위 지원 (`192.168.1.0/24`)
- API: `PUT /admin/teams/{teamId}/ip-allowlist`

---

### FEAT-SEC-003 🟠 세션 활동 이력 조회
**현재 상태**: 미구현  
**필요성**: 사용자가 자신의 활성 세션(기기별) 확인 및 강제 로그아웃  
**구현 방향**:
- `user_sessions` 테이블: `user_id`, `device_info`, `ip_address`, `last_active_at`
- API: `GET /users/me/sessions`, `DELETE /users/me/sessions/{sessionId}`
- 동시 접속 기기 제한 옵션 (Free: 1기기, Pro: 3기기)

---

### FEAT-SEC-004 🟠 Secrets Detection 강화
**현재 상태**: GitHub 커밋 히스토리 스캔만 지원 (`POST /github/scan/history`)  
**추가 필요**:
- 실시간 코드 업로드 시 시크릿 패턴 즉시 감지 (SAST 전 단계)
- 패턴 목록: AWS 키, GCP SA 키, GitHub PAT, Slack Token, Stripe 키, JWT 시크릿 등 50+
- `.env` 파일 특별 처리: 파일 분석 대상에서 자동 제외 + 발견 시 Critical 경고
- API: `POST /analysis/sessions/{id}/secrets-scan` (별도 엔드포인트)

---

### FEAT-SEC-005 🟡 취약점 SLA 관리
**현재 상태**: 취약점 상태 변경만 존재  
**필요성**: 보안팀이 취약점 수정 기한을 설정하고 초과 시 알림  
**구현 방향**:
- `vulnerabilities` 테이블에 `due_date`, `sla_breached_at`, `assigned_to` 컬럼 추가
- 심각도별 기본 SLA: Critical 3일, High 7일, Medium 30일, Low 90일
- SLA 초과 시 이메일 + Slack 알림
- API: `PATCH /vulnerabilities/{id}/sla`, `GET /projects/{id}/vulnerabilities/sla-breach`

---

### FEAT-SEC-006 🔴 동적 보안 지식 동기화 (RAG 기반)
**현재 상태**: 전문가용 MD 파일로 관리 중  
**필요성**: 전문가의 노하우와 외부 보안 피드를 결합하여 AI가 항상 최신 기준으로 검사하도록 함  
**구현 방향**:
- `security_guidelines` 테이블 구축 및 벡터 검색(pgvector) 연동
- 전문가 MD 파일 → DB 자동 동기화 (TASK-306)
- 하루 한 번 외부 보안 피드(NVD, GitHub Advisory) 수집 및 요약 저장
- `sast_node.py` 분석 시 관련 지침 동적 검색(Retrieval) 적용

---

## 3. API 기능 보완

### FEAT-API-001 🔴 분석 비교 API (Diff)
**현재 상태**: 미구현  
**필요성**: 두 분석 세션 간 취약점 증감 비교 (PR 리뷰 후 개선 여부 확인)  
**API**:
```
GET /analysis/sessions/compare?baseSessionId={id}&headSessionId={id}
Response: {
  "newVulnerabilities": [...],
  "fixedVulnerabilities": [...],
  "persistingVulnerabilities": [...],
  "securityScoreDelta": +15
}
```

---

### FEAT-API-002 🟠 취약점 내보내기 (Export)
**현재 상태**: PDF 리포트만 지원  
**추가 포맷**:
- **CSV**: 스프레드시트 연동용
- **JSON**: 외부 SIEM 연동용
- **SARIF**: GitHub Code Scanning 결과 파일 형식 (GitHub Security tab 연동)
- **JIRA XML**: Jira 이슈 일괄 임포트용

**API**:
```
GET /analysis/sessions/{id}/export?format=sarif
GET /analysis/sessions/{id}/export?format=csv
```

---

### FEAT-API-003 🟠 웹훅 발송 (Outbound Webhook)
**현재 상태**: GitHub 수신 웹훅만 구현  
**추가 필요**: SecureAI 이벤트를 외부 시스템으로 발송  
**이벤트 종류**:
- `analysis.completed` — 분석 완료 시
- `vulnerability.critical_found` — Critical 취약점 발견 시
- `sla.breached` — SLA 초과 시

**API**:
```
POST /projects/{id}/webhooks        # 웹훅 등록
GET  /projects/{id}/webhooks        # 목록 조회
DELETE /projects/{id}/webhooks/{id} # 삭제
```

---

### FEAT-API-004 🟡 SBOM 다운로드 포맷 추가
**현재 상태**: CycloneDX JSON만 생성  
**추가 포맷**:
- **SPDX 2.3** (NTIA 준수)
- **CycloneDX XML**
- **CSV** (의존성 목록)

---

### FEAT-API-005 🟡 분석 스케줄링 API
**현재 상태**: 수동 분석 시작만 지원  
**추가 필요**: 정기 자동 분석 예약  
**API**:
```
POST /projects/{id}/analysis/schedule
Body: { "cronExpression": "0 9 * * MON", "options": {...} }
```

---

## 4. AI Agent 고도화

### FEAT-AI-001 🔴 멀티 파일 컨텍스트 분석
**현재 상태**: 파일별 개별 분석  
**추가 필요**: 파일 간 데이터 흐름 추적 (Taint Analysis)  
**예시**: `LoginController.java`의 입력이 `UserRepository.java`의 쿼리로 흘러가는 경로 추적  
**구현**: LangGraph 그래프에 `taint_analysis` 노드 추가, 파일 의존성 그래프 구축

---

### FEAT-AI-002 🟠 패치 자동 적용 (PR 생성)
**현재 상태**: 패치 코드 제안만 제공  
**추가 필요**: GitHub PR 자동 생성  
**흐름**:
```
패치 승인 → GitHub API로 브랜치 생성 → 파일 수정 커밋 → PR 생성
제목: "fix(security): [SecureAI] SQL Injection 취약점 수정 - UserController.java:46"
```
**API**: `POST /patches/{id}/create-pr`

---

### FEAT-AI-003 🟠 취약점 오탐(False Positive) 학습
**현재 상태**: 취약점 상태를 `accepted_risk`로 변경 가능  
**추가 필요**: 오탐 패턴을 프로젝트별로 학습해 재분석 시 동일 패턴 필터링  
**구현**: `false_positive_patterns` 테이블 + SAST 전처리 필터

---

### FEAT-AI-004 🟡 다국어 코드 지원 확장
**현재 상태**: Java, TypeScript, Python  
**추가 필요**: Go, Rust, C/C++, PHP, Ruby  
**구현**: 언어별 취약점 패턴 프롬프트 확장, 파서 추가

---

## 5. 운영 / 관측성 기능

### FEAT-OPS-001 🔴 OpenTelemetry 통합
**현재 상태**: LangSmith 트레이싱만 (AI Agent)  
**추가 필요**: Spring Boot + Python Agent 전체 분산 트레이싱  
**구현**:
- `opentelemetry-spring-boot-starter` 적용
- Jaeger 또는 Grafana Tempo로 트레이스 수집
- 분석 파이프라인 각 단계별 Span 생성

---

### FEAT-OPS-002 🟠 Prometheus + Grafana 대시보드
**현재 상태**: Actuator `/metrics` 엔드포인트만  
**추가 필요**:
- 커스텀 메트릭: 분석 완료 수, 평균 분석 시간, DAST 성공률, AI 토큰 사용량
- Grafana 대시보드: 일별 분석 트렌드, 플랜별 사용량, 에러율

---

### FEAT-OPS-003 🟡 자동 백업 & 복구 스크립트
**현재 상태**: Docker Volume만 사용  
**추가 필요**:
- PostgreSQL `pg_dump` 일 1회 자동 실행 → S3 업로드
- 백업 무결성 검증 스크립트
- 복구 절차 문서화 (`RUNBOOK.md`)

---

## 6. 컴플라이언스 & 감사 기능

### FEAT-COMP-001 🟠 GDPR 데이터 삭제 요청 API
**현재 상태**: 계정 탈퇴 시 Soft Delete만  
**추가 필요**: 데이터 주체 요청(DSR) 처리 API  
**API**:
```
POST /users/me/gdpr/export   # 내 전체 데이터 JSON 다운로드
POST /users/me/gdpr/delete   # 즉시 하드 삭제 요청 (30일 유예 없이)
```

---

### FEAT-COMP-002 🟡 컴플라이언스 매핑 리포트
**현재 상태**: OWASP Top 10 카테고리만 표시  
**추가 필요**: 취약점을 컴플라이언스 프레임워크에 매핑  
- **ISO 27001** 통제 항목 매핑
- **NIST CSF** 기능 매핑
- **PIMS (개인정보보호 관리체계)** 항목 매핑
- **PCI-DSS** Requirement 매핑

---

### FEAT-COMP-003 🟡 감사 로그 불변성 보장
**현재 상태**: 감사 로그 DB 저장  
**추가 필요**: 감사 로그 위변조 방지  
**구현 방향**:
- 로그 항목마다 이전 항목 해시 체이닝 (블록체인 유사 구조)
- 또는 AWS CloudTrail / Azure Monitor로 외부 전송
- 감사 로그 무결성 검증 API: `GET /admin/audit-logs/verify`

---

## 우선순위 로드맵

| 항목 | 우선순위 | 권장 Sprint |
|------|---------|------------|
| MCP-001 (PostgreSQL MCP) | 🔴 | Sprint 2 |
| MCP-002 (Docker MCP) | 🔴 | Sprint 6 |
| FEAT-SEC-001 (2FA) | 🔴 | Sprint 8 |
| FEAT-AI-001 (멀티파일 분석) | 🔴 | Sprint 4 |
| MCP-003 (Redis MCP) | 🟠 | Sprint 3 |
| MCP-004 (Search MCP) | 🟠 | Sprint 3 |
| FEAT-SEC-002 (IP Allowlist) | 🟠 | Sprint 8 |
| FEAT-API-001 (Diff API) | 🟠 | Sprint 7 |
| FEAT-API-002 (Export) | 🟠 | Sprint 7 |
| FEAT-OPS-001 (OpenTelemetry) | 🔴 | Sprint 8 |
| FEAT-COMP-001 (GDPR DSR API) | 🟠 | Sprint 8 |

---

*관련 문서: `07_SPRINT_BACKLOG_V2.md` (현행 백로그), `14_SECURITY_TEAM_FEATURES.md` (보안팀 전용 기능)*
