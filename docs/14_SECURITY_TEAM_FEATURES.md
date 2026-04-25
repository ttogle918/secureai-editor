# SecureAI — 보안 전문가 / 보안 담당자용 기능 정의서
> 작성일: 2026-04-25 | 버전: v1.0  
> 대상: 기업 내 보안팀, 보안 전문가, 컴플라이언스 담당자  
> 관련 문서: `02_API_DESIGN.md`, `12_API_SECURITY_CHECKLIST.md`, `13_BACKLOG_ADDITIONS.md`

---

## 개요

이 문서는 SecureAI를 **기업 내 보안 조직이 업무 도구로 사용할 때** 필요한 기능을 정의합니다.  
일반 개발자용 기능(SAST/DAST 분석, 패치 제안)과 달리, 보안팀 고유 워크플로우인  
**보안 감사, 취약점 추적·관리, 보고서 작성, 규정 준수 점검**에 초점을 맞춥니다.

**대상 페르소나**:
- 기업 CISO / 보안 팀장
- 보안 엔지니어 (Offensive / Defensive)
- 컴플라이언스 담당자 (ISO 27001, PIMS, PCI-DSS)
- 외부 보안 감사인 (Auditor)

---

## 목차

1. [보안 대시보드 (Security Dashboard)](#1-보안-대시보드)
2. [취약점 관리 워크플로우](#2-취약점-관리-워크플로우)
3. [보안 감사 리포트 시스템](#3-보안-감사-리포트-시스템)
4. [컴플라이언스 점검 기능](#4-컴플라이언스-점검-기능)
5. [보안팀 전용 API 엔드포인트](#5-보안팀-전용-api-엔드포인트)
6. [알림 & 에스컬레이션](#6-알림--에스컬레이션)
7. [외부 감사인 접근 관리](#7-외부-감사인-접근-관리)
8. [보안팀 역할 & 권한 모델](#8-보안팀-역할--권한-모델)

---

## 1. 보안 대시보드

### 1.1 조직 전체 보안 현황판

보안팀이 **조직 내 전체 프로젝트**의 보안 상태를 한눈에 파악할 수 있는 뷰.

**표시 항목**:
```
┌─────────────────────────────────────────────────────────────┐
│  조직 보안 현황  (2026-04-25 기준)                           │
│                                                             │
│  전체 프로젝트: 24개       평균 보안 점수: 68/100            │
│  활성 취약점: 142개        이번 주 신규: +18개               │
│                                                             │
│  ■ Critical   12개 (SLA 3일)   — 8개 기한 초과              │
│  ■ High       35개 (SLA 7일)   — 12개 기한 초과             │
│  ■ Medium     64개 (SLA 30일)                               │
│  ■ Low        31개 (SLA 90일)                               │
│                                                             │
│  [가장 위험한 프로젝트 TOP 5]  [SLA 초과 현황]  [월별 트렌드] │
└─────────────────────────────────────────────────────────────┘
```

**API**:
```
GET /security/dashboard/overview?orgId={id}&period=30d
Response: {
  "totalProjects": 24,
  "averageSecurityScore": 68,
  "activeVulnerabilities": { "critical": 12, "high": 35, "medium": 64, "low": 31 },
  "slaBreached": { "critical": 8, "high": 12 },
  "topRiskyProjects": [...],
  "weeklyTrend": [...]
}
```

**권한**: `ROLE_SECURITY_MANAGER` 이상

---

### 1.2 프로젝트별 보안 점수 매트릭스

| 프로젝트 | 보안 점수 | Critical | High | 마지막 스캔 | 트렌드 |
|---------|---------|---------|------|-----------|-------|
| backend-api | 45 🔴 | 3 | 8 | 2일 전 | ↓-12 |
| frontend-web | 72 🟡 | 0 | 3 | 1일 전 | ↑+8 |
| payment-service | 88 🟢 | 0 | 1 | 오늘 | → 0 |

**API**:
```
GET /security/dashboard/matrix?orgId={id}&sort=score,asc
```

---

### 1.3 보안 KPI 지표

보안팀이 경영진에게 보고하는 핵심 지표:

| 지표 | 설명 | API 파라미터 |
|------|------|------------|
| MTTD | 취약점 평균 발견 소요 시간 | `metric=mttd` |
| MTTR | 취약점 평균 수정 소요 시간 | `metric=mttr` |
| SLA 준수율 | 기한 내 수정 비율 | `metric=sla_compliance` |
| 재발률 | 수정 후 동일 유형 재발 비율 | `metric=recurrence_rate` |
| 스캔 커버리지 | 전체 프로젝트 대비 스캔 완료 비율 | `metric=scan_coverage` |

```
GET /security/kpi?orgId={id}&period=monthly&metrics=mttd,mttr,sla_compliance
```

---

## 2. 취약점 관리 워크플로우

### 2.1 취약점 생명주기 상태 확장

현행 상태(`open`, `fixed`, `accepted_risk`, `false_positive`) 외 보안팀 워크플로우용 상태 추가:

```
open
  → in_review        (보안팀 검토 중)
  → confirmed        (실제 취약점으로 확인)
  → assigned         (담당 개발자 배정됨)
  → in_remediation   (수정 작업 중)
  → fixed            (수정 완료 — 개발자 확인)
  → verified_fixed   (보안팀 재검증 완료)
  → accepted_risk    (위험 수용 — CISO 승인 필요)
  → false_positive   (오탐 처리)
  → wont_fix         (수정 불가 결정 — 근거 필수)
```

**API**:
```
PATCH /vulnerabilities/{id}/status
Body: {
  "status": "confirmed",
  "reason": "실제로 SQL Injection 가능성 재현 확인",
  "assignedTo": "user-uuid",
  "dueDate": "2026-04-28"
}
```

---

### 2.2 취약점 심층 분석 요청

보안팀이 특정 취약점에 대해 **심층 수동 분석**을 요청하는 기능.

```
POST /vulnerabilities/{id}/deep-analysis
Body: {
  "requestType": "manual_verify",    // manual_verify | exploit_poc | threat_model
  "note": "결제 API에서 발견 — 실제 익스플로잇 가능 여부 검증 필요",
  "priority": "urgent"
}
```

**처리 흐름**:
1. 보안팀 → 요청 생성
2. 알림: 담당 보안 엔지니어에게 할당 알림 발송
3. 보안 엔지니어 → DAST 직접 실행 또는 수동 PoC 작성
4. 결과 → `deep_analysis_results` 테이블 저장
5. 결과 → 보안 감사 리포트에 포함

---

### 2.3 취약점 배정 & 추적

```
PATCH /vulnerabilities/{id}/assign
Body: {
  "assigneeId": "developer-uuid",
  "dueDate": "2026-04-28T17:00:00Z",
  "slaPriority": "critical"
}

GET /security/assignments?assigneeId={id}&status=overdue
GET /security/assignments?status=unassigned&severity=critical
```

**ERD 추가 컬럼**:
```sql
ALTER TABLE vulnerabilities ADD COLUMN assigned_to UUID REFERENCES users(id);
ALTER TABLE vulnerabilities ADD COLUMN assigned_at TIMESTAMPTZ;
ALTER TABLE vulnerabilities ADD COLUMN due_date TIMESTAMPTZ;
ALTER TABLE vulnerabilities ADD COLUMN sla_breached_at TIMESTAMPTZ;
ALTER TABLE vulnerabilities ADD COLUMN verified_by UUID REFERENCES users(id);
ALTER TABLE vulnerabilities ADD COLUMN verified_at TIMESTAMPTZ;
ALTER TABLE vulnerabilities ADD COLUMN review_notes TEXT;  -- AES 암호화
```

---

### 2.4 위험 수용 (Risk Acceptance) 승인 프로세스

Critical/High 취약점을 `accepted_risk`로 처리 시 **CISO 또는 보안 관리자 승인 필수**.

```
POST /vulnerabilities/{id}/risk-acceptance/request
Body: {
  "justification": "내부 망에서만 접근 가능한 API, 외부 노출 없음",
  "mitigatingControls": "방화벽 정책 XXX 적용 중",
  "reviewDate": "2026-07-01"   // 재검토 일자
}

POST /vulnerabilities/{id}/risk-acceptance/approve
권한: ROLE_SECURITY_MANAGER, ROLE_CISO
Body: { "approved": true, "approverNote": "..." }
```

**ERD 추가 테이블**:
```sql
CREATE TABLE risk_acceptances (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    vulnerability_id UUID       REFERENCES vulnerabilities(id),
    requested_by    UUID        REFERENCES users(id),
    justification   TEXT        NOT NULL,
    mitigating_controls TEXT,
    review_date     DATE,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/approved/rejected
    reviewed_by     UUID        REFERENCES users(id),
    reviewer_note   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ
);
```

---

## 3. 보안 감사 리포트 시스템

### 3.1 리포트 유형

현행 PDF 리포트 외 보안팀 전용 리포트 유형 추가:

| 리포트 유형 | 대상 독자 | 포함 내용 |
|-----------|---------|---------|
| **Executive Summary** | CISO, 경영진 | 보안 점수, 위험 요약, KPI (1~2페이지) |
| **Technical Detail** | 개발팀, 보안 엔지니어 | 전체 취약점 + 코드 스니펫 + 패치 코드 |
| **Compliance Report** | 컴플라이언스 담당, 감사인 | 컴플라이언스 프레임워크 매핑 결과 |
| **Remediation Tracking** | 프로젝트 매니저 | SLA 준수율, 수정 진행 현황 |
| **Penetration Test Summary** | 보안팀, 고객 | DAST 결과 + 익스플로잇 증거 |
| **Delta Report** | 개발팀 | 이전 스캔 대비 취약점 증감 |

**API**:
```
POST /reports
Body: {
  "sessionId": "uuid",
  "format": "pdf",
  "reportType": "executive_summary",   // 추가 필드
  "title": "2026년 Q1 보안 감사 리포트",
  "options": {
    "includeExploitDetails": true,
    "includeSourceCode": false,
    "includePatchCode": false,
    "includeComplianceMapping": true,
    "includeRiskAcceptances": true,
    "language": "ko",
    "classificationLevel": "confidential"   // 문서 등급 표시
  }
}
```

---

### 3.2 Executive Summary 리포트 구성

경영진 보고용 요약 리포트 자동 생성:

```markdown
# SecureAI 보안 현황 요약 보고서
**보고 기간**: 2026년 1분기 (2026-01-01 ~ 2026-03-31)
**작성일**: 2026-04-25
**문서 등급**: 대외비 (Confidential)

## 보안 현황 요약

| 구분 | 금번 | 전분기 | 변화 |
|------|------|------|------|
| 전체 보안 점수 | 68/100 | 54/100 | ▲+14 |
| Critical 취약점 | 3건 | 8건 | ▼-5 |
| SLA 준수율 | 84% | 71% | ▲+13% |
| 미수정 취약점(30일+) | 7건 | 18건 | ▼-11 |

## 주요 위험 항목 (Top 3)
1. SQL Injection — payment-service (CVSS 9.8) — 즉시 조치 필요
2. 인증 우회 가능성 — auth-service (CVSS 8.1)
3. 민감 데이터 노출 — user-api (CVSS 7.5)

## 조치 권고사항
- Critical 3건: 2026-04-28까지 수정 완료 요청
- 보안 교육: 개발팀 대상 SQL Injection 예방 교육 권장

## 다음 분기 목표
- 전체 보안 점수 75점 달성
- SLA Critical 준수율 100% 달성
```

---

### 3.3 보안 감사 증적 자료 패키지

외부 감사 또는 인증 심사 시 제출용 증적 자료 일괄 생성:

```
POST /security/audit-package
Body: {
  "period": { "from": "2026-01-01", "to": "2026-03-31" },
  "includeItems": [
    "scan_history",          // 전체 스캔 이력
    "vulnerability_log",      // 취약점 발견/수정 이력
    "risk_acceptances",       // 위험 수용 결정 이력
    "audit_trail",            // 감사 로그
    "compliance_mapping",     // 컴플라이언스 매핑
    "sla_report"              // SLA 준수 현황
  ],
  "format": "zip"
}

Response 202: {
  "packageId": "uuid",
  "estimatedSeconds": 60,
  "downloadUrl": "(생성 완료 후)"
}
```

---

### 3.4 리포트 전자 서명 & 위변조 방지

보안 감사 리포트의 무결성 보장:

```
POST /reports/{reportId}/sign
Body: { "signerName": "홍길동 CISO", "organization": "SecureAI Inc." }

Response: {
  "reportId": "uuid",
  "signatureHash": "sha256:abc123...",
  "signedAt": "2026-04-25T10:00:00Z",
  "verifyUrl": "/reports/{reportId}/verify"
}

GET /reports/{reportId}/verify
Response: { "valid": true, "signedBy": "홍길동 CISO", "signedAt": "..." }
```

---

## 4. 컴플라이언스 점검 기능

### 4.1 지원 컴플라이언스 프레임워크

| 프레임워크 | 설명 | 자동 매핑 |
|-----------|------|---------|
| OWASP Top 10 2021 | 현재 지원 | 자동 |
| CWE/SANS Top 25 | 소프트웨어 취약점 | 자동 |
| OWASP API Top 10 | API 보안 | 자동 |
| ISO/IEC 27001:2022 | 정보보안 관리체계 | 자동 |
| NIST CSF 2.0 | 사이버보안 프레임워크 | 자동 |
| PIMS (개인정보보호 관리체계) | 한국 개인정보보호 | 자동 |
| PCI-DSS v4.0 | 카드 결제 보안 | 자동 |
| KISA 전자금융 보안기준 | 한국 전자금융 | 매핑 테이블 기반 |
| GDPR Article 25 | 개인정보 설계 반영 | 매핑 테이블 기반 |

---

### 4.2 컴플라이언스 매핑 결과 API

```
GET /analysis/sessions/{sessionId}/compliance?framework=iso27001

Response: {
  "framework": "ISO/IEC 27001:2022",
  "overallCompliance": 78,
  "controlMapping": [
    {
      "controlId": "A.14.2.1",
      "controlName": "보안 개발 정책",
      "status": "non_compliant",
      "relatedVulnerabilities": ["vuln-uuid-1", "vuln-uuid-2"],
      "recommendation": "SQL Injection 방지를 위한 개발 가이드라인 필요"
    },
    {
      "controlId": "A.9.4.2",
      "controlName": "보안 로그온 절차",
      "status": "compliant",
      "relatedVulnerabilities": []
    }
  ]
}
```

---

### 4.3 컴플라이언스 갭 분석

```
GET /security/compliance/gap-analysis?orgId={id}&framework=pci_dss

Response: {
  "framework": "PCI-DSS v4.0",
  "totalRequirements": 12,
  "compliant": 8,
  "nonCompliant": 3,
  "partiallyCompliant": 1,
  "gaps": [
    {
      "requirement": "Requirement 6.3: Develop and maintain secure systems",
      "currentState": "SQL Injection 취약점 3건 미수정",
      "remediation": "PreparedStatement 적용 + 코드 리뷰 프로세스 강화",
      "effort": "high",
      "priority": "critical"
    }
  ]
}
```

---

### 4.4 정기 컴플라이언스 점검 스케줄

```
POST /security/compliance/schedule
Body: {
  "framework": "iso27001",
  "frequency": "quarterly",
  "notifyUsers": ["ciso@company.com", "security@company.com"],
  "autoGenerateReport": true
}
```

---

## 5. 보안팀 전용 API 엔드포인트

> 권한: `ROLE_SECURITY_ENGINEER` 이상

### 5.1 전체 프로젝트 취약점 통합 조회

```
GET /security/vulnerabilities
  ?orgId={id}
  &severity=critical,high
  &status=open,confirmed
  &assignedTo=unassigned
  &slaBreached=true
  &page=0&size=50

Response: 취약점 목록 + 프로젝트 정보 + 담당자 정보 포함
```

---

### 5.2 보안 스캔 강제 실행

보안팀이 특정 프로젝트에 대해 즉시 전체 스캔 실행 (플랜 제한 우회):

```
POST /security/scan/force
권한: ROLE_SECURITY_MANAGER
Body: {
  "projectId": "uuid",
  "layerType": "full",
  "reason": "긴급 보안 감사 대응",
  "notifyOwner": true
}
```

---

### 5.3 취약점 대량 조치 (Bulk Action)

```
POST /security/vulnerabilities/bulk
Body: {
  "vulnerabilityIds": ["uuid1", "uuid2", ...],
  "action": "assign",    // assign | change_status | set_due_date
  "assigneeId": "uuid",
  "dueDate": "2026-04-30"
}
```

---

### 5.4 보안 점수 재계산

```
POST /security/projects/{projectId}/recalculate-score
권한: ROLE_SECURITY_ENGINEER
Body: {
  "reason": "위험 수용 결정 반영 후 재계산"
}
```

---

### 5.5 시크릿 노출 긴급 대응

커밋에서 시크릿이 발견된 경우 긴급 대응 절차 트리거:

```
POST /security/incident/secret-exposure
Body: {
  "projectId": "uuid",
  "secretType": "github_pat",    // github_pat | aws_key | db_credential
  "commitSha": "abc123",
  "affectedFile": ".env.production",
  "action": "revoke_and_notify"  // notify_only | revoke_and_notify | full_incident
}

Response: {
  "incidentId": "uuid",
  "actionsTriggered": [
    "Slack #security-incidents 알림 발송",
    "GitHub 토큰 즉시 폐기 요청 알림",
    "관련 팀 이메일 발송",
    "감사 로그 기록"
  ]
}
```

---

## 6. 알림 & 에스컬레이션

### 6.1 보안 알림 규칙 설정

```
POST /security/notification-rules
Body: {
  "name": "Critical 취약점 즉시 알림",
  "trigger": {
    "event": "vulnerability_found",
    "conditions": { "severity": "critical" }
  },
  "channels": [
    { "type": "email", "recipients": ["ciso@company.com", "security@company.com"] },
    { "type": "slack", "webhookUrl": "...", "channel": "#security-alerts" },
    { "type": "webhook", "url": "https://pagerduty.com/..." }
  ],
  "throttle": "5m"   // 5분 내 중복 알림 묶음 처리
}
```

### 6.2 에스컬레이션 정책

| 단계 | 조건 | 대상 | 방법 |
|------|------|------|------|
| Level 1 | Critical 발견 즉시 | 담당 보안 엔지니어 | Slack |
| Level 2 | 24시간 미조치 | 보안 팀장 | Email + Slack |
| Level 3 | 72시간 미조치 (SLA 초과) | CISO | Email + 전화 |
| Level 4 | 주간 SLA 준수율 < 70% | 경영진 보고 | Executive Report |

```
PUT /security/escalation-policy
Body: {
  "levels": [
    { "level": 1, "triggerAfterHours": 0, "notifyRole": "security_engineer", "channels": ["slack"] },
    { "level": 2, "triggerAfterHours": 24, "notifyRole": "security_manager", "channels": ["email", "slack"] },
    { "level": 3, "triggerAfterHours": 72, "notifyRole": "ciso", "channels": ["email", "sms"] }
  ]
}
```

---

### 6.3 보안 주간 요약 보고 자동화

매주 월요일 09:00, 보안팀에 지난 주 현황 자동 발송:

```
POST /security/reports/weekly-digest/schedule
Body: {
  "cronExpression": "0 9 * * MON",
  "recipients": ["security-team@company.com"],
  "includeProjects": "all",   // all | critical_only | changed_only
  "format": "email"           // email | slack | pdf
}
```

---

## 7. 외부 감사인 접근 관리

### 7.1 임시 감사인 계정 생성

```
POST /security/auditors
권한: ROLE_SECURITY_MANAGER
Body: {
  "email": "auditor@external-firm.com",
  "name": "김감사 (ABC 감사법인)",
  "accessScope": {
    "projects": ["uuid1", "uuid2"],   // 접근 허용 프로젝트
    "features": ["view_vulnerabilities", "download_reports", "view_audit_logs"],
    "dataClassification": ["public", "internal"]   // confidential 제외
  },
  "expiresAt": "2026-05-31T17:00:00Z",
  "ipAllowlist": ["1.2.3.4/32"]   // 감사 법인 IP
}

Response: {
  "auditorId": "uuid",
  "temporaryPassword": "...",   // 첫 로그인 시 변경 강제
  "accessUrl": "https://secureai.io/audit/{token}"
}
```

---

### 7.2 감사인 활동 추적

```
GET /security/auditors/{auditorId}/activity-log
Response: [
  {
    "timestamp": "2026-04-25T10:32:00Z",
    "action": "report_downloaded",
    "resource": "report-uuid-123",
    "ipAddress": "1.2.3.4"
  }
]
```

---

### 7.3 감사인 접근 즉시 철회

```
DELETE /security/auditors/{auditorId}/access
권한: ROLE_SECURITY_MANAGER
```

---

## 8. 보안팀 역할 & 권한 모델

### 8.1 역할 정의

| 역할 | 설명 | 주요 권한 |
|------|------|---------|
| `ROLE_CISO` | 최고 정보보안 책임자 | 전체 조회, 위험 수용 최종 승인, 감사인 관리 |
| `ROLE_SECURITY_MANAGER` | 보안 팀장 | 보안 스캔 강제 실행, 알림 정책 설정, 에스컬레이션 관리 |
| `ROLE_SECURITY_ENGINEER` | 보안 엔지니어 | 취약점 심층 분석, 상태 변경, 리포트 생성 |
| `ROLE_COMPLIANCE_OFFICER` | 컴플라이언스 담당 | 컴플라이언스 조회, 감사 패키지 다운로드, 리포트 생성 |
| `ROLE_AUDITOR` | 외부 감사인 (임시) | 조회 전용, 지정된 프로젝트만, TTL 설정 |

### 8.2 권한 매트릭스

| 기능 | CISO | Security Manager | Security Engineer | Compliance | Auditor |
|------|------|-----------------|------------------|------------|---------|
| 조직 전체 대시보드 | ✅ | ✅ | ✅ | ✅ | 제한적 |
| 취약점 상태 변경 | ✅ | ✅ | ✅ | ✗ | ✗ |
| 위험 수용 승인 | ✅ | ✅ | ✗ | ✗ | ✗ |
| 보안 스캔 강제 실행 | ✅ | ✅ | ✗ | ✗ | ✗ |
| 감사인 계정 관리 | ✅ | ✅ | ✗ | ✗ | ✗ |
| 컴플라이언스 리포트 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 감사 패키지 다운로드 | ✅ | ✅ | ✗ | ✅ | ✗ |
| 알림 정책 설정 | ✅ | ✅ | ✗ | ✗ | ✗ |
| 보안 KPI 조회 | ✅ | ✅ | ✅ | ✅ | ✗ |
| IP 허용 목록 관리 | ✅ | ✅ | ✗ | ✗ | ✗ |

### 8.3 역할 부여 API

```
POST /admin/users/{userId}/security-roles
권한: ROLE_CISO, ROLE_ADMIN
Body: {
  "role": "ROLE_SECURITY_ENGINEER",
  "scope": "org",        // org | team | project
  "scopeId": "org-uuid"
}
```

---

## 구현 로드맵

| 기능 그룹 | 우선순위 | 권장 Sprint | 의존성 |
|---------|---------|------------|------|
| 보안 역할 모델 (섹션 8) | 🔴 Critical | Sprint 1 | 인증 시스템 |
| 취약점 상태 확장 (섹션 2.1) | 🔴 Critical | Sprint 3 | SAST 완성 후 |
| 보안 대시보드 기본 (섹션 1.1) | 🔴 Critical | Sprint 4 | 취약점 데이터 필요 |
| SLA 관리 (섹션 2.3) | 🟠 High | Sprint 5 | 상태 확장 후 |
| 컴플라이언스 매핑 (섹션 4) | 🟠 High | Sprint 7 | 리포트 시스템 후 |
| Executive Summary 리포트 (섹션 3.1) | 🟠 High | Sprint 7 | 리포트 시스템 후 |
| 위험 수용 승인 프로세스 (섹션 2.4) | 🟠 High | Sprint 7 | 역할 모델 후 |
| 감사인 접근 관리 (섹션 7) | 🟡 Medium | Sprint 8 | 역할 모델 후 |
| 에스컬레이션 정책 (섹션 6.2) | 🟡 Medium | Sprint 8 | 알림 시스템 후 |
| 감사 패키지 (섹션 3.3) | 🟡 Medium | Sprint 8 | 모든 기능 완성 후 |
| 리포트 전자 서명 (섹션 3.4) | 🟢 Low | Sprint 9 | - |

---

*관련 문서: `02_API_DESIGN.md` (기본 API), `12_API_SECURITY_CHECKLIST.md` (보안 점검), `13_BACKLOG_ADDITIONS.md` (추가 기능 목록)*  
*보안팀 문의: `docs/` 디렉토리 내 설계 문서 또는 GitHub Issues의 `security-team` 레이블 사용*
