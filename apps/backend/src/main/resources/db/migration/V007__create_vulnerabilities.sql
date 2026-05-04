CREATE TABLE IF NOT EXISTS vulnerabilities (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID        NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
    project_id  UUID        NOT NULL REFERENCES projects(id)          ON DELETE CASCADE,
    file_path   TEXT        NOT NULL,
    line_number INT,
    vuln_type   VARCHAR(50) NOT NULL,
    severity    VARCHAR(10) NOT NULL,
    cwe         VARCHAR(20),
    owasp       VARCHAR(10),
    description TEXT,
    code_snippet TEXT,
    call_chain  TEXT        NOT NULL DEFAULT '[]',
    fingerprint VARCHAR(64) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_vuln_session_fp UNIQUE (session_id, fingerprint)
);

CREATE INDEX idx_vuln_session  ON vulnerabilities(session_id);
CREATE INDEX idx_vuln_project  ON vulnerabilities(project_id);
CREATE INDEX idx_vuln_severity ON vulnerabilities(severity);
