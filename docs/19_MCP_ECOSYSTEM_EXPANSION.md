# SecureAI — MCP 생태계 확장 계획 (Ecosystem & MCP Expansion)
> **문서 상태**: 제안 (Draft)
> **대상 스프린트**: Sprint 15 (Ecosystem & MCP 확장)
> **작성일**: 2026-06-12

## 1. 개요
현재 `apps/mcp_server`는 Filesystem, GitHub, DAST 샌드박스 실행 등 기본적인 분석 인프라 제어를 위해 구현되어 있습니다. 네트워크 오버헤드와 보안 취약점을 방지하기 위해 포트 노출 없이 `StdioServerTransport`로 통신하도록 아키텍처가 최적화되어 있습니다.

본 문서는 향후 AI Agent의 자율성과 분석 수준을 한 단계 높이기 위해, 다양한 인프라와 외부 서비스를 MCP(Model Context Protocol)로 확장하는 청사진을 정의합니다. 특히 Docker, PostgreSQL과 같은 내부 인프라뿐만 아니라 외부 보안 지식 베이스(NVD) 등을 MCP로 묶어 AI 엔진의 컨텍스트를 극대화하는 것이 목표입니다.

---

## 2. 확장 후보 도구 (MCP Tools)

### 2.1 인프라 제어 (Infrastructure MCP)
> **도입 배경**: AI가 백엔드를 거치지 않고도 인프라(Docker, DB)의 상태를 직접 모니터링하고 쿼리하여 원인 분석을 수행할 수 있게 합니다.

1. **Docker MCP**
   - `list_containers`: 현재 구동 중인 Docker 샌드박스 목록 및 상태(Running, Exited) 조회.
   - `get_container_logs`: 특정 샌드박스(DAST)에서 발생한 stdout/stderr 로그 실시간 조회.
   - `inspect_network`: `dast-isolated-net` 등 격리 네트워크에 의도치 않은 컨테이너가 접근하고 있는지 네트워크 브릿지 상태 확인.
   - `kill_container`: 무한 루프나 과도한 자원을 소모하는 DAST 공격 샌드박스를 AI가 스스로 판단해 강제 종료.

2. **PostgreSQL MCP**
   - `query_db`: 백엔드 API가 아직 구현되지 않은 데이터(예: `analysis_sessions`, `vulnerabilities` 통계 등)에 대해 AI가 직접 SQL을 생성하여 읽기 전용(Read-Only) 권한으로 조회.
   - `check_schema`: DB 마이그레이션(Flyway) 내역과 실제 테이블 스키마를 대조하여 취약점(예: 암호화 적용 누락 등) 파악.

### 2.2 보안 인텔리전스 (Security Intelligence MCP)
> **도입 배경**: 할루시네이션(Hallucination)을 막고 최신 위협 정보를 반영하기 위해 외부 신뢰할 수 있는 데이터베이스를 직접 호출합니다.

1. **NVD / CVE 탐색기 MCP**
   - `search_cve`: 발견한 소프트웨어 버전이나 라이브러리를 키워드로 최신 CVE 정보를 쿼리.
   - `get_cvss_vector`: 특정 CVE의 CVSS 점수와 공격 벡터(Vector String)를 가져와 DAST 페이로드 구성 시 활용.

2. **AST (Abstract Syntax Tree) 분석 MCP**
   - `get_call_graph`: 특정 함수의 호출 트리(Call Graph) 추적. 텍스트 검색(`grep`)의 한계를 넘어 소스코드 내 데이터 흐름(Taint Analysis) 추적 시 사용.
   - `find_usages`: 민감한 함수(예: `exec`, `eval`)가 사용된 모든 컨텍스트를 AST 레벨에서 추출.

### 2.3 팀 협업 및 통지 (Collaboration MCP)
> **도입 배경**: 발견된 심각한 취약점을 즉각적으로 개발/보안 팀에 전파하고 티켓팅 워크플로우를 자동화합니다.

1. **Jira / Linear 티켓팅 MCP**
   - `create_ticket`: Critical/High 취약점 발견 시 해당 내용, 재현 방법(DAST 증적 포함), 패치 제안 코드를 묶어 Jira 이슈로 생성.
   - `assign_issue`: 해당 코드의 마지막 커밋 작성자(git blame)를 파악해 자동으로 담당자 할당.

2. **Slack / MS Teams 알림 MCP**
   - `send_alert`: 보안 심사 중 긴급한 패치가 필요한 경우, 해당 채널에 멘션과 함께 알림 전송.

### 2.4 리포팅 및 지식 관리 (Reporting & Knowledge Management MCP)
> **도입 배경**: B2B 엔터프라이즈 환경에서 필수적인 보안 점검 결과, 컴플라이언스 맵핑 결과 등을 기존 사내 업무 툴(Notion, Excel 등)에 자동으로 동기화하여 보안 담당자(Security Manager)의 수작업을 없앱니다.

1. **Excel / Google Sheets MCP**
   - `export_vulnerabilities`: 발견된 취약점 리스트, 조치 상태, ROI 요약 데이터를 엑셀(.xlsx)로 직접 생성하거나 Google Sheets API를 통해 특정 스프레드시트에 행(Row) 단위로 자동 추가.
   - ISMS-P 등 정보보호 관리체계 인증 심사 시 필요한 원시 데이터(Raw Data) 추출 자동화.

2. **Notion / Confluence MCP**
   - `sync_compliance_wiki`: 분석된 프로젝트의 보안 점수, 취약점 패치 런북(Runbook), 보안 가이드라인 등을 사내 위키(Notion 데이터베이스, Confluence 스페이스)에 자동 생성 및 지속 동기화.

---

## 3. 구현 지침 및 보안 정책
MCP 서버에 도구가 추가될수록 AI의 권한이 강력해지므로 **안전 장치**가 필수적입니다.

1. **Read-Only 원칙 적용**: DB 쿼리(PostgreSQL) 도구 등은 반드시 읽기 전용 계정으로 연결되어야 하며, 데이터 파괴/수정이 불가능해야 합니다.
2. **명시적 승인 (Human-in-the-Loop)**: 인프라 상태를 바꾸는 작업(`kill_container`, 티켓 생성 등)은 실행 전 사용자(Security Manager)의 최종 승인을 묻는 프롬프트 단계를 LangGraph에 추가해야 합니다.
3. **네트워크 격리 유지**: 외부 통신을 하는 도구(NVD 쿼리, Jira API 연동 등)는 AI 엔진(혹은 MCP 서버 컨테이너)에서만 통신할 수 있도록 방화벽 아웃바운드 규칙을 통제합니다.

---

## 4. 로드맵 (Sprint 연계)
본 제안은 **Sprint 15 (Ecosystem & MCP 확장)** 단계에서 구체화되며, 다음과 같은 순서로 점진적으로 통합됩니다.
- **Phase 1**: PostgreSQL / Docker 상태 조회 (읽기 전용 도구 위주)
- **Phase 2**: NVD / AST 연동을 통한 SAST 성능 고도화
- **Phase 3**: Jira/Slack 등 알림/협업 파이프라인 자동 연동
