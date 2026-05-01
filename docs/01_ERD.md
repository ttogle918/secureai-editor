# SecureAI — ERD 설계서 (Entity Relationship Design)
> 작성자: 데이터 아키텍처 전문가 / 시니어 백엔드 개발자 공동 작성  
> 기준 DB: PostgreSQL 15 | ORM: Spring Data JPA (Hibernate 6)  
> 작성일: 2026-04-19 | 버전: v1.0

---

## 목차

1. [전체 ERD 다이어그램](#1-전체-erd-다이어그램)
2. [테이블 상세 명세](#2-테이블-상세-명세)
3. [인덱스 전략](#3-인덱스-전략)
4. [파티셔닝 전략](#4-파티셔닝-전략)
5. [성능 최적화 설계](#5-성능-최적화-설계)
6. [Flyway 마이그레이션 순서](#6-flyway-마이그레이션-순서)
7. [Redis 데이터 모델](#7-redis-데이터-모델)

---

## 1. 전체 ERD 다이어그램

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           SecureAI — ERD v1.0                                   │
└──────────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│    PLANS    │◄────│    USERS     │────►│  REFRESH_TOKENS │
└─────────────┘     └──────┬───────┘     └─────────────────┘
                           │1
                           │ has many
                    ┌──────┴────────────────────────────────────────┐
                    │                                                │
                   N│                                               N│
          ┌─────────┴───────┐                           ┌────────────┴──────┐
          │    PROJECTS     │                           │  TEAM_MEMBERS     │
          └─────────┬───────┘                           └───────────────────┘
                    │1
                    │ has many
                    │N
          ┌─────────┴──────────────┐
          │   ANALYSIS_SESSIONS    │
          └─────────┬──────────────┘
                    │1
          ┌─────────┼────────────────────────┐
          │         │                        │
         N│        N│                       1│
┌─────────┴───┐ ┌──┴────────────┐  ┌────────┴────────┐
│VULNERABILITIES│ │    REPORTS   │  │  SCAN_TARGETS   │
└──────┬──────┘ └───────────────┘  └─────────────────┘
       │1
       ├──────────────────────┐
      N│                     N│
┌──────┴──────────┐  ┌────────┴──────────┐
│ EXPLOIT_RESULTS │  │ PATCH_SUGGESTIONS │
└─────────────────┘  └───────────────────┘
       │
      N│ (each vuln may reference many CVEs)
┌──────┴───────────────────┐
│ VULNERABILITY_CVE_MAPPING │
└──────┬───────────────────┘
       │N
       │1
┌──────┴──────┐
│   CVE_DATA  │
└─────────────┘

별도 도메인:
┌───────────────────┐   ┌──────────────────────┐   ┌─────────────────────┐
│   GITHUB_CONFIGS  │   │   MONITORING_TARGETS  │   │  AUDIT_LOGS         │
│   (per project)   │   │   (Phase 3)           │   │  (시스템 감사 로그)  │
└───────────────────┘   └──────────────────────┘   └─────────────────────┘
```

---

## 2. 테이블 상세 명세

### 2.1 PLANS — 구독 플랜

```sql
CREATE TABLE plans (
    id                    SMALLINT        PRIMARY KEY,           -- 1:Free, 2:Pro, 3:Team, 4:Enterprise
    name                  VARCHAR(20)     NOT NULL UNIQUE,       -- 'free', 'pro', 'team', 'enterprise'
    display_name          VARCHAR(50)     NOT NULL,
    monthly_price_krw     INTEGER         NOT NULL DEFAULT 0,    -- 월 구독료 (원)
    max_members           SMALLINT        NOT NULL DEFAULT 1,
    monthly_sast_limit    INTEGER         NOT NULL DEFAULT 50,   -- -1 = 무제한
    allow_private_repo    BOOLEAN         NOT NULL DEFAULT FALSE,
    allow_dast            BOOLEAN         NOT NULL DEFAULT FALSE,
    allow_monitoring      BOOLEAN         NOT NULL DEFAULT FALSE,
    allow_pdf_report      BOOLEAN         NOT NULL DEFAULT FALSE,
    allow_sbom            BOOLEAN         NOT NULL DEFAULT FALSE,
    allow_sso             BOOLEAN         NOT NULL DEFAULT FALSE,
    api_rate_limit_per_min SMALLINT       NOT NULL DEFAULT 10,
    created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- 초기 데이터 (Flyway seed)
INSERT INTO plans VALUES
(1, 'free',       '무료',        0,      1,  50,  false, false, false, false, false, false, 10),
(2, 'pro',        'Pro',         19900,  1,  -1,  true,  true,  false, true,  true,  false, 60),
(3, 'team',       'Team',        59000,  5,  -1,  true,  true,  true,  true,  true,  false, 120),
(4, 'enterprise', 'Enterprise',  0,      -1, -1,  true,  true,  true,  true,  true,  true,  -1);
```

---

### 2.2 USERS — 사용자

```sql
CREATE TABLE users (
    id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    email                 VARCHAR(255)    NOT NULL UNIQUE,
    password_hash         VARCHAR(255),                         -- NULL = OAuth 전용 계정
    username              VARCHAR(100)    NOT NULL UNIQUE,
    display_name          VARCHAR(100),
    plan_id               SMALLINT        NOT NULL DEFAULT 1 REFERENCES plans(id),

    -- GitHub OAuth
    github_id             BIGINT          UNIQUE,               -- GitHub user id
    github_login          VARCHAR(100),
    github_token          BYTEA,                                -- AES-256-GCM 암호화
    github_token_expires_at TIMESTAMPTZ,

    -- 사용량 추적
    sast_usage_this_month INTEGER         NOT NULL DEFAULT 0,
    sast_usage_reset_at   TIMESTAMPTZ     NOT NULL DEFAULT DATE_TRUNC('month', NOW()) + INTERVAL '1 month',

    -- 계정 상태
    email_verified        BOOLEAN         NOT NULL DEFAULT FALSE,
    email_verify_token    VARCHAR(64),
    email_verify_expires_at TIMESTAMPTZ,
    is_active             BOOLEAN         NOT NULL DEFAULT TRUE,
    last_login_at         TIMESTAMPTZ,
    login_fail_count      SMALLINT        NOT NULL DEFAULT 0,
    locked_until          TIMESTAMPTZ,                          -- 로그인 실패 5회 → 잠금

    -- 메타
    timezone              VARCHAR(50)     NOT NULL DEFAULT 'Asia/Seoul',
    locale                VARCHAR(10)     NOT NULL DEFAULT 'ko',
    created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at            TIMESTAMPTZ                           -- Soft Delete
);

COMMENT ON COLUMN users.github_token IS 'AES-256-GCM encrypted. Key from env SECUREAI_ENCRYPTION_KEY';
COMMENT ON COLUMN users.sast_usage_this_month IS 'Incremented on each SAST session start. Reset monthly by scheduler';
```

---

### 2.3 REFRESH_TOKENS — Refresh Token 관리

```sql
CREATE TABLE refresh_tokens (
    id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash        VARCHAR(64)     NOT NULL UNIQUE,          -- SHA-256(token)
    device_info       VARCHAR(255),                             -- User-Agent 요약
    ip_address        INET,
    issued_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at        TIMESTAMPTZ     NOT NULL,                 -- issued_at + 30 days
    revoked_at        TIMESTAMPTZ,
    revoked_reason    VARCHAR(50)                               -- 'logout', 'rotation', 'security'
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at)
    WHERE revoked_at IS NULL;
```

---

### 2.4 PROJECTS — 분석 대상 프로젝트

```sql
CREATE TABLE projects (
    id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id          UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name              VARCHAR(200)    NOT NULL,
    description       TEXT,
    language          VARCHAR(50),                              -- 'java', 'typescript', 'python' 등 (자동 감지)
    framework         VARCHAR(50),                              -- 'spring-boot', 'nextjs', 'fastapi'
    source_type       VARCHAR(20)     NOT NULL,                -- 'local', 'github', 'url'

    -- GitHub 연동 (source_type = 'github')
    github_repo_full_name VARCHAR(200),                        -- 'owner/repo'
    github_default_branch VARCHAR(100),
    github_webhook_id     BIGINT,
    github_webhook_secret VARCHAR(64),

    -- 보안 점수 (마지막 분석 기준)
    latest_security_score SMALLINT,                           -- 0~100
    latest_session_id     UUID,                               -- 마지막 세션 FK (순환 참조 방지를 위해 FK 없이 저장)

    -- 상태
    is_active         BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ

    CONSTRAINT uq_project_owner_name UNIQUE (owner_id, name)
);

CREATE INDEX idx_projects_owner_id ON projects(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_github_repo ON projects(github_repo_full_name)
    WHERE source_type = 'github';
```

---

### 2.5 TEAM_MEMBERS — 팀 멤버십

```sql
CREATE TABLE team_members (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL DEFAULT 'viewer',        -- 'owner', 'admin', 'viewer'
    invited_by  UUID        REFERENCES users(id),
    invited_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    CONSTRAINT uq_team_member UNIQUE (project_id, user_id)
);
```

---

### 2.6 ANALYSIS_SESSIONS — 분석 세션 (핵심 테이블)

```sql
CREATE TABLE analysis_sessions (
    id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id        UUID            NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id           UUID            NOT NULL REFERENCES users(id),

    -- 분석 타입
    layer_type        VARCHAR(10)     NOT NULL,                -- 'sast', 'github', 'dast', 'full'
    target_path       TEXT,                                    -- 로컬 경로 또는 GitHub repo url
    target_branch     VARCHAR(100),

    -- 상태 머신
    -- pending → running → completed | failed | cancelled
    status            VARCHAR(20)     NOT NULL DEFAULT 'pending',
    current_step      VARCHAR(50),                            -- 'sast_scanning', 'dast_running', 'patch_generating'
    progress_pct      SMALLINT        NOT NULL DEFAULT 0,     -- 0~100 (SSE로 실시간 전송)
    error_message     TEXT,

    -- 분석 결과 집계 (캐시 역할 — Vuln 테이블 매번 집계 방지)
    security_score    SMALLINT,                               -- 0~100
    vuln_count_critical SMALLINT      NOT NULL DEFAULT 0,
    vuln_count_high   SMALLINT        NOT NULL DEFAULT 0,
    vuln_count_medium SMALLINT        NOT NULL DEFAULT 0,
    vuln_count_low    SMALLINT        NOT NULL DEFAULT 0,
    vuln_count_total  SMALLINT        NOT NULL DEFAULT 0,
    patched_count     SMALLINT        NOT NULL DEFAULT 0,

    -- 스캔 메타
    files_scanned     INTEGER         NOT NULL DEFAULT 0,
    lines_scanned     INTEGER         NOT NULL DEFAULT 0,
    ai_tokens_used    INTEGER         NOT NULL DEFAULT 0,     -- 비용 추적

    -- 시간
    started_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    completed_at      TIMESTAMPTZ,
    duration_seconds  INTEGER,                                -- completed_at - started_at

    -- 캐시 최적화: 동일 파일셋 재분석 방지
    file_tree_hash    VARCHAR(64),                            -- 전체 파일 목록의 SHA-256

    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- 월별 파티션 (2026년 기준, 이후 자동화)
CREATE TABLE analysis_sessions_2026_04 PARTITION OF analysis_sessions
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE analysis_sessions_2026_05 PARTITION OF analysis_sessions
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
-- ... (Flyway + pg_partman으로 자동 생성)

CREATE INDEX idx_sessions_project_id ON analysis_sessions(project_id, created_at DESC);
CREATE INDEX idx_sessions_user_id ON analysis_sessions(user_id, created_at DESC);
CREATE INDEX idx_sessions_status ON analysis_sessions(status) WHERE status IN ('pending', 'running');
```

---

### 2.7 VULNERABILITIES — 취약점

```sql
CREATE TABLE vulnerabilities (
    id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id        UUID            NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
    project_id        UUID            NOT NULL REFERENCES projects(id),  -- 빠른 조회용 역정규화

    -- 분류
    vuln_type         VARCHAR(100)    NOT NULL,               -- 'SQL_INJECTION', 'XSS', 'IDOR' ...
    severity          VARCHAR(10)     NOT NULL,               -- 'critical', 'high', 'medium', 'low'
    cvss_score        DECIMAL(3,1),                          -- 0.0 ~ 10.0

    -- OWASP / CWE 분류
    owasp_category    VARCHAR(20),                           -- 'A03:2021'
    cwe_id            INTEGER,                               -- 89 (SQL Injection)
    cwe_name          VARCHAR(200),

    -- 위치 (파일)
    file_path         TEXT            NOT NULL,
    line_start        INTEGER,
    line_end          INTEGER,
    column_start      INTEGER,
    column_end        INTEGER,
    code_snippet      TEXT,                                  -- 취약한 코드 발췌 (최대 500자)

    -- API 호출 체인 (JSON)
    -- [{"node":"LoginPage.tsx:18","type":"frontend"}, {"node":"UserController:46","type":"vuln"}]
    call_chain        JSONB,

    -- AI 분석 결과
    description       TEXT            NOT NULL,
    attack_scenario   TEXT,                                  -- 공격 시나리오 설명
    remediation       TEXT,                                  -- 수정 방법 설명
    references        JSONB,                                 -- 외부 참조 링크 배열

    -- API 그룹 필터용 (UI 필터 성능 최적화)
    api_group         VARCHAR(200),                          -- '/api/users'
    is_api_related    BOOLEAN         NOT NULL DEFAULT FALSE,

    -- 상태 관리
    -- 'open', 'in_progress', 'fixed', 'accepted_risk', 'false_positive'
    status            VARCHAR(20)     NOT NULL DEFAULT 'open',
    fixed_at          TIMESTAMPTZ,
    fixed_by          UUID            REFERENCES users(id),
    false_positive_reason TEXT,

    -- 중복 탐지 (동일 취약점 여러 세션에서 중복 등록 방지)
    vuln_fingerprint  VARCHAR(64),                           -- SHA-256(file_path+line+type)

    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vulns_session_id ON vulnerabilities(session_id);
CREATE INDEX idx_vulns_project_severity ON vulnerabilities(project_id, severity, status);
CREATE INDEX idx_vulns_api_group ON vulnerabilities(session_id, api_group) WHERE api_group IS NOT NULL;
CREATE INDEX idx_vulns_status ON vulnerabilities(status) WHERE status = 'open';
CREATE INDEX idx_vulns_fingerprint ON vulnerabilities(vuln_fingerprint, project_id);
-- JSONB GIN 인덱스 (call_chain 검색)
CREATE INDEX idx_vulns_call_chain ON vulnerabilities USING GIN(call_chain);
```

---

### 2.8 EXPLOIT_RESULTS — DAST 익스플로잇 결과

```sql
CREATE TABLE exploit_results (
    id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    vulnerability_id  UUID            NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,
    session_id        UUID            NOT NULL REFERENCES analysis_sessions(id),

    -- 실행 정보
    exploit_type      VARCHAR(50)     NOT NULL,               -- 'sqli', 'xss', 'idor', 'ssrf'
    target_endpoint   VARCHAR(500),                           -- 실제 공격 대상 URL
    http_method       VARCHAR(10),                            -- 'GET', 'POST'

    -- 페이로드 (암호화 저장)
    payload_encrypted BYTEA,                                  -- AES-256-GCM
    payload_summary   VARCHAR(200),                          -- 요약 (비암호화, 로그 노출용)

    -- 결과
    is_success        BOOLEAN         NOT NULL DEFAULT FALSE,
    http_status_code  SMALLINT,
    response_snippet  TEXT,                                   -- 응답 일부 (최대 1000자)
    evidence_type     VARCHAR(50),                            -- 'db_dump', 'cookie_theft', 'redirect'

    -- 실행 로그 (암호화 저장)
    sandbox_log_encrypted BYTEA,                              -- AES-256-GCM

    -- Docker 실행 메타
    container_id      VARCHAR(64),
    execution_time_ms INTEGER,
    retry_count       SMALLINT        NOT NULL DEFAULT 0,

    executed_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW() + INTERVAL '30 days'  -- GDPR 30일 삭제
);

CREATE INDEX idx_exploit_vuln_id ON exploit_results(vulnerability_id);
CREATE INDEX idx_exploit_expires_at ON exploit_results(expires_at);  -- 삭제 스케줄러용
```

---

### 2.9 PATCH_SUGGESTIONS — 패치 제안

```sql
CREATE TABLE patch_suggestions (
    id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    vulnerability_id  UUID            NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,

    -- 패치 코드
    original_code     TEXT            NOT NULL,               -- 원본 코드
    patched_code      TEXT            NOT NULL,               -- 수정된 코드
    diff_unified      TEXT,                                   -- unified diff 형식
    explanation       TEXT            NOT NULL,               -- 패치 설명
    patch_language    VARCHAR(50),                            -- 'java', 'typescript'

    -- AI 생성 메타
    ai_model          VARCHAR(50)     NOT NULL DEFAULT 'claude-sonnet-4',
    ai_tokens_used    INTEGER,
    confidence_score  DECIMAL(3,2),                           -- 0.00 ~ 1.00

    -- 적용 상태
    is_applied        BOOLEAN         NOT NULL DEFAULT FALSE,
    applied_at        TIMESTAMPTZ,
    applied_by        UUID            REFERENCES users(id),

    -- 검증
    is_verified       BOOLEAN         NOT NULL DEFAULT FALSE, -- 재분석으로 수정 확인
    verified_at       TIMESTAMPTZ,

    -- 캐시 최적화: 동일 취약점 유형 패치 재사용
    patch_template_key VARCHAR(100),                          -- 'sqli_prepared_statement_java'

    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patches_vuln_id ON patch_suggestions(vulnerability_id);
CREATE INDEX idx_patches_template ON patch_suggestions(patch_template_key)
    WHERE is_applied = TRUE;
```

---

### 2.10 REPORTS — 분석 리포트

```sql
CREATE TABLE reports (
    id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id        UUID            NOT NULL REFERENCES analysis_sessions(id),
    project_id        UUID            NOT NULL REFERENCES projects(id),
    generated_by      UUID            NOT NULL REFERENCES users(id),

    -- 리포트 형식
    format            VARCHAR(10)     NOT NULL DEFAULT 'pdf',  -- 'pdf', 'json', 'html'
    title             VARCHAR(300)    NOT NULL,

    -- 집계 스냅샷 (세션 삭제 후에도 리포트 내용 유지)
    security_score    SMALLINT,
    summary_json      JSONB           NOT NULL,                -- {vuln_counts, top_issues, owasp_coverage}

    -- 파일 저장
    file_path         VARCHAR(500),                           -- 서버 내 저장 경로
    file_size_bytes   INTEGER,
    download_token    VARCHAR(64)     UNIQUE,                  -- 서명된 다운로드 토큰 (24h 유효)
    download_token_expires_at TIMESTAMPTZ,

    -- 공유
    is_public_share   BOOLEAN         NOT NULL DEFAULT FALSE,
    public_share_token VARCHAR(64)    UNIQUE,

    -- 상태
    status            VARCHAR(20)     NOT NULL DEFAULT 'generating',  -- 'generating', 'ready', 'failed'
    generated_at      TIMESTAMPTZ,
    expires_at        TIMESTAMPTZ     DEFAULT NOW() + INTERVAL '90 days',

    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_session_id ON reports(session_id);
CREATE INDEX idx_reports_project_id ON reports(project_id, created_at DESC);
CREATE INDEX idx_reports_download_token ON reports(download_token) WHERE download_token IS NOT NULL;
```

---

### 2.11 SCAN_TARGETS — 배포 앱 스캔 대상 (DAST Layer 3)

```sql
CREATE TABLE scan_targets (
    id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id        UUID            NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id           UUID            NOT NULL REFERENCES users(id),

    -- 대상 URL (암호화 저장)
    target_url_encrypted BYTEA        NOT NULL,               -- AES-256-GCM
    target_host       VARCHAR(255)    NOT NULL,               -- 도메인 (평문, 필터/중복 체크용)

    -- 도메인 소유권 확인
    -- 'pending', 'txt_record', 'file_upload', 'verified', 'failed'
    verification_status VARCHAR(20)   NOT NULL DEFAULT 'pending',
    verification_method VARCHAR(20),                          -- 'txt_record', 'file_upload'
    verification_token  VARCHAR(64),                          -- DNS TXT 또는 파일 내용
    verified_at         TIMESTAMPTZ,
    verification_expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',

    -- 스캔 제어
    is_monitoring_enabled BOOLEAN     NOT NULL DEFAULT FALSE, -- Phase 3 지속 모니터링
    monitoring_interval_hours SMALLINT NOT NULL DEFAULT 24,
    last_scanned_at   TIMESTAMPTZ,
    next_scan_at      TIMESTAMPTZ,

    -- 면책 동의
    consent_accepted  BOOLEAN         NOT NULL DEFAULT FALSE,
    consent_accepted_at TIMESTAMPTZ,
    consent_ip        INET,

    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scan_targets_host ON scan_targets(target_host);
CREATE INDEX idx_scan_targets_next_scan ON scan_targets(next_scan_at)
    WHERE is_monitoring_enabled = TRUE AND verification_status = 'verified';
```

---

### 2.12 GITHUB_CONFIGS — GitHub 연동 설정

```sql
CREATE TABLE github_configs (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id            UUID        NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,

    -- 저장소 정보
    repo_full_name        VARCHAR(200) NOT NULL,             -- 'owner/repo'
    default_branch        VARCHAR(100) NOT NULL DEFAULT 'main',
    repo_private          BOOLEAN     NOT NULL DEFAULT FALSE,

    -- PR 자동 리뷰 설정
    auto_review_enabled   BOOLEAN     NOT NULL DEFAULT TRUE,
    block_merge_on_critical BOOLEAN   NOT NULL DEFAULT FALSE, -- Branch Protection 연동
    comment_on_pr         BOOLEAN     NOT NULL DEFAULT TRUE,

    -- Webhook
    webhook_id            BIGINT,
    webhook_secret_hash   VARCHAR(64),                       -- SHA-256(secret) 저장

    -- 마지막 동기화
    last_commit_sha       VARCHAR(40),
    last_synced_at        TIMESTAMPTZ,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 2.13 PR_REVIEW_HISTORY — PR 보안 리뷰 이력

```sql
CREATE TABLE pr_review_history (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id        UUID        NOT NULL REFERENCES projects(id),
    session_id        UUID        REFERENCES analysis_sessions(id),

    pr_number         INTEGER     NOT NULL,
    pr_title          VARCHAR(500),
    pr_author         VARCHAR(100),
    head_sha          VARCHAR(40),
    base_branch       VARCHAR(100),
    compare_branch    VARCHAR(100),

    -- 리뷰 결과
    -- 'pending', 'approved', 'changes_required', 'failed'
    review_status     VARCHAR(20) NOT NULL DEFAULT 'pending',
    security_score    SMALLINT,
    vuln_count_new    SMALLINT    NOT NULL DEFAULT 0,        -- 신규 취약점 수
    vuln_count_fixed  SMALLINT    NOT NULL DEFAULT 0,        -- 이 PR에서 수정된 취약점 수
    github_comment_id BIGINT,                                -- GitHub PR 코멘트 ID

    reviewed_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()

    CONSTRAINT uq_pr_review UNIQUE (project_id, pr_number, head_sha)
);

CREATE INDEX idx_pr_review_project_id ON pr_review_history(project_id, created_at DESC);
```

---

### 2.14 CVE_DATA — CVE 취약점 데이터베이스

```sql
CREATE TABLE cve_data (
    id              SERIAL          PRIMARY KEY,
    cve_id          VARCHAR(30)     NOT NULL UNIQUE,           -- 'CVE-2024-12345'
    description     TEXT            NOT NULL,
    cvss_v3_score   DECIMAL(3,1),
    cvss_v3_vector  VARCHAR(100),
    severity        VARCHAR(10),                               -- NVD 기준 severity
    published_at    DATE,
    modified_at     DATE,
    references_json JSONB,                                     -- NVD references
    affected_packages JSONB,                                   -- [{name, ecosystem, version_range}]
    synced_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cve_severity ON cve_data(severity, cvss_v3_score DESC);
CREATE INDEX idx_cve_published ON cve_data(published_at DESC);
-- 패키지 이름으로 빠른 검색
CREATE INDEX idx_cve_affected_packages ON cve_data USING GIN(affected_packages);
```

---

### 2.15 VULNERABILITY_CVE_MAPPING — 취약점 ↔ CVE 연결

```sql
CREATE TABLE vulnerability_cve_mapping (
    vulnerability_id  UUID    NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,
    cve_id            VARCHAR(30) NOT NULL REFERENCES cve_data(cve_id),
    match_confidence  DECIMAL(3,2),                           -- 매칭 신뢰도 0.00~1.00
    PRIMARY KEY (vulnerability_id, cve_id)
);
```

---

### 2.16 DEPENDENCY_COMPONENTS — 의존성 컴포넌트 (SBOM)

```sql
CREATE TABLE dependency_components (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID        NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
    project_id      UUID        NOT NULL REFERENCES projects(id),

    -- 패키지 정보
    package_name    VARCHAR(300) NOT NULL,
    package_version VARCHAR(100) NOT NULL,
    ecosystem       VARCHAR(30)  NOT NULL,                    -- 'maven', 'npm', 'pip'
    package_type    VARCHAR(20)  NOT NULL DEFAULT 'library',  -- 'library', 'framework'
    is_direct       BOOLEAN      NOT NULL DEFAULT TRUE,        -- 직접 의존 vs 간접

    -- 파일 출처
    source_file     VARCHAR(200),                             -- 'pom.xml', 'package.json'

    -- 취약 여부 (CVE 매칭 후 업데이트)
    has_known_vuln  BOOLEAN      NOT NULL DEFAULT FALSE,
    vuln_cve_ids    TEXT[],                                   -- CVE ID 배열

    -- SBOM 표준 (CycloneDX)
    purl            VARCHAR(500),                             -- pkg:maven/org.springframework/spring-core@5.3.0
    license         VARCHAR(200),

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dep_session_id ON dependency_components(session_id);
CREATE INDEX idx_dep_package ON dependency_components(package_name, package_version, ecosystem);
CREATE INDEX idx_dep_has_vuln ON dependency_components(session_id) WHERE has_known_vuln = TRUE;
```

---

### 2.17 MONITORING_RESULTS — 지속 모니터링 결과 (Phase 3)

```sql
CREATE TABLE monitoring_results (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_target_id    UUID        NOT NULL REFERENCES scan_targets(id) ON DELETE CASCADE,
    project_id        UUID        NOT NULL REFERENCES projects(id),

    check_type        VARCHAR(30) NOT NULL,                   -- 'passive_scan', 'ssl_check', 'header_check', 'cve_alert'
    status            VARCHAR(20) NOT NULL,                   -- 'ok', 'warning', 'critical'
    summary           TEXT,
    details_json      JSONB,

    -- 알림 발송 여부
    notification_sent BOOLEAN     NOT NULL DEFAULT FALSE,
    notified_at       TIMESTAMPTZ,
    notified_channels TEXT[],                                 -- ['email', 'slack']

    checked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (checked_at);

CREATE TABLE monitoring_results_2026_04 PARTITION OF monitoring_results
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
```

---

### 2.18 AUDIT_LOGS — 시스템 감사 로그

```sql
CREATE TABLE audit_logs (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         UUID            REFERENCES users(id),
    action          VARCHAR(100)    NOT NULL,                  -- 'DAST_RUN', 'REPORT_EXPORT', 'TOKEN_REVOKE'
    resource_type   VARCHAR(50),                              -- 'analysis_session', 'vulnerability'
    resource_id     VARCHAR(36),
    ip_address      INET,
    user_agent      TEXT,
    request_details JSONB,                                    -- 요청 파라미터 (민감정보 제외)
    result          VARCHAR(20),                              -- 'success', 'fail', 'forbidden'
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- 컴플라이언스 요구: 최소 1년 보관
CREATE TABLE audit_logs_2026_04 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
```

---

## 3. 인덱스 전략

### 3.1 핵심 쿼리별 인덱스 최적화

```sql
-- Q1. 프로젝트의 최근 분석 세션 목록 (대시보드 진입 시)
-- 쿼리: WHERE project_id = ? ORDER BY created_at DESC LIMIT 10
CREATE INDEX idx_sessions_project_created ON analysis_sessions(project_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- Q2. 세션의 Critical 취약점만 필터 (필터바 클릭 시)
-- 쿼리: WHERE session_id = ? AND severity = 'critical' AND status = 'open'
CREATE INDEX idx_vulns_session_severity_status ON vulnerabilities(session_id, severity, status);

-- Q3. 사용자의 월별 SAST 사용량 확인 (Plan 제한 체크)
-- users 테이블 컬럼 자체가 카운터이므로 별도 인덱스 불필요

-- Q4. 다음 모니터링 스캔 대상 조회 (MonitoringJob)
-- 위 scan_targets 테이블에 idx_scan_targets_next_scan 이미 정의됨

-- Q5. CVE 패키지명 검색 (SBOM 매칭)
-- 위 cve_data에 idx_cve_affected_packages GIN 인덱스 이미 정의됨

-- Q6. 지문(fingerprint) 기반 중복 취약점 방지
-- 위 vulnerabilities에 idx_vulns_fingerprint 이미 정의됨
```

### 3.2 부분 인덱스(Partial Index) 활용 원칙
- `WHERE deleted_at IS NULL` — 소프트 삭제 테이블 전반
- `WHERE status IN ('pending', 'running')` — 활성 세션만 인덱싱
- `WHERE is_monitoring_enabled = TRUE` — 모니터링 활성 대상만
- `WHERE has_known_vuln = TRUE` — 취약 컴포넌트만

---

## 4. 파티셔닝 전략

### 4.1 대상 테이블

| 테이블 | 파티션 키 | 방식 | 보관 정책 |
|--------|----------|------|----------|
| `analysis_sessions` | `created_at` | RANGE 월별 | 무기한 (비즈니스 이력) |
| `monitoring_results` | `checked_at` | RANGE 월별 | 12개월 후 DROP |
| `audit_logs` | `created_at` | RANGE 월별 | 13개월 후 DROP |
| `exploit_results` | - | 파티션 불필요, `expires_at`으로 행 삭제 | 30일 후 행 삭제 |

### 4.2 자동 파티션 생성
- `pg_partman` 확장 활용 또는 스케줄러(`PartitionMaintenanceJob`)가 매월 1일 다음 달 파티션 생성

---

## 5. 성능 최적화 설계

### 5.1 역정규화 (Denormalization)

| 목적 | 위치 | 내용 |
|------|------|------|
| 세션 집계 캐시 | `analysis_sessions.vuln_count_*` | 취약점 추가/상태 변경 시 업데이트 트리거 |
| 프로젝트 최신 점수 | `projects.latest_security_score` | 세션 완료 시 업데이트 |
| 취약점 프로젝트 ID | `vulnerabilities.project_id` | session → project JOIN 제거 |

### 5.2 PostgreSQL 트리거 (집계 동기화)

```sql
-- 취약점 삽입/삭제 시 세션 집계 자동 업데이트
CREATE OR REPLACE FUNCTION update_session_vuln_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE analysis_sessions
        SET vuln_count_total = vuln_count_total + 1,
            vuln_count_critical = CASE WHEN NEW.severity = 'critical' THEN vuln_count_critical + 1 ELSE vuln_count_critical END,
            vuln_count_high     = CASE WHEN NEW.severity = 'high'     THEN vuln_count_high + 1     ELSE vuln_count_high     END,
            vuln_count_medium   = CASE WHEN NEW.severity = 'medium'   THEN vuln_count_medium + 1   ELSE vuln_count_medium   END,
            vuln_count_low      = CASE WHEN NEW.severity = 'low'      THEN vuln_count_low + 1      ELSE vuln_count_low      END
        WHERE id = NEW.session_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vuln_count_sync
AFTER INSERT ON vulnerabilities
FOR EACH ROW EXECUTE FUNCTION update_session_vuln_counts();
```

### 5.3 JSONB 활용 전략

| 컬럼 | 사유 |
|------|------|
| `call_chain JSONB` | 가변 길이 노드 배열, GIN 인덱스로 특정 노드 검색 가능 |
| `summary_json JSONB` | 리포트 스냅샷 — 자유 형식 집계 데이터 |
| `affected_packages JSONB` | CVE별 영향 패키지 목록 (배열) |
| `details_json JSONB` | 모니터링 결과 세부 내용 (타입별 형식 다름) |

### 5.4 Connection Pool 설정 (HikariCP)

```yaml
# application.yml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20        # CPU * 2 + spinner
      minimum-idle: 5
      connection-timeout: 3000     # ms
      idle-timeout: 600000         # 10분
      max-lifetime: 1800000        # 30분
      keepalive-time: 300000       # 5분 (RDS proxy idle 방지)
```

---

## 6. Flyway 마이그레이션 순서

> 번호 체계는 `spring02_revision.md`, `spring3_revision.md` 기준으로 전면 수정됨.  
> V016 이후는 해당 스프린트 시작 시 순차 배정.

```
-- Sprint 0 (완료) --
V001__create_plans.sql
V002__create_users.sql
V003__create_refresh_tokens.sql
V004__create_projects.sql
V005__create_team_members.sql

-- Sprint 2 --
V006__create_analysis_sessions_partitioned.sql
V007__create_vulnerabilities.sql
V008__create_analysis_progress_log.sql          ← (원본 V023 → 수정)
V009__create_agent_checkpoints.sql              ← (원본 미지정 → 신규)

-- Sprint 3 --
V010__create_audit_logs.sql                     ← (Sprint 1 이월, 원본 V018 → 신규)
V011__create_patch_suggestions.sql              ← (원본 V009 → 수정)
V012__create_cve_data.sql                       ← (원본 V014 → 수정)
V013__create_dependency_components.sql          ← (원본 V016 → 수정)
V014__create_vulnerability_components.sql       ← (원본 V015 → 수정)

-- Sprint 5 --
V015__create_pr_review_history.sql              ← (원본 V013 → 수정)

-- Sprint 6 이후 (순차 배정 예정) --
V016~ : github_configs, exploit_results, scan_targets, reports,
        monitoring_results_partitioned, indexes, triggers,
        seed_plans, seed_initial_partitions_2026
```

---

## 7. Redis 데이터 모델

### 7.1 키 네임스페이스 규칙

```
secureai:{domain}:{identifier}
```

### 7.2 전체 Redis 키 목록

| 키 패턴 | 타입 | TTL | 용도 |
|---------|------|-----|------|
| `secureai:sast:{sha256}:{lang}` | Hash | 24h | SAST 결과 캐시 |
| `secureai:session:{sessionId}:status` | String | 2h | 세션 진행 상태 |
| `secureai:session:{sessionId}:progress` | String | 2h | 진행률 (0~100) |
| `secureai:sse:{sessionId}` | Pub/Sub Channel | - | SSE 브릿지 채널 |
| `secureai:cve:{cveId}` | Hash | 6h | CVE 상세 캐시 |
| `secureai:nvd:modified_since` | String | 6h | NVD API 마지막 동기화 시각 |
| `secureai:ratelimit:{userId}:api` | Counter | 1min | API Rate Limit |
| `secureai:ratelimit:{domain}:dast` | Counter | 1h | DAST 도메인별 횟수 |
| `secureai:dast:lock:{domain}` | String (SETNX) | 30min | DAST 중복 실행 방지 락 |
| `secureai:user:{userId}:plan` | Hash | 5min | 플랜 정보 캐시 |
| `secureai:github:repo:{repoFullName}` | Hash | 10min | GitHub 저장소 메타 캐시 |
| `secureai:patch:template:{key}` | String | 7d | 패치 템플릿 캐시 |
| `secureai:report:{reportId}:status` | String | 1h | 리포트 생성 상태 |

### 7.3 SSE Pub/Sub 채널 메시지 형식

```json
{
  "type": "progress",
  "sessionId": "uuid",
  "step": "sast_scanning",
  "progressPct": 35,
  "message": "UserController.java 분석 중...",
  "timestamp": "2026-04-19T14:32:01Z"
}

{
  "type": "vuln_found",
  "sessionId": "uuid",
  "vulnerability": {
    "id": "uuid",
    "type": "SQL_INJECTION",
    "severity": "critical",
    "filePath": "src/UserController.java",
    "lineStart": 46
  }
}

{
  "type": "completed",
  "sessionId": "uuid",
  "securityScore": 72,
  "vulnCountTotal": 6
}
```

---

*다음 문서: [02_API_DESIGN.md] — REST API 상세 설계서*
