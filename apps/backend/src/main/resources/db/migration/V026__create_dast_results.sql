CREATE TABLE dast_results (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID         NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
    vuln_id          UUID         REFERENCES vulnerabilities(id) ON DELETE SET NULL,
    vuln_type        VARCHAR(50)  NOT NULL,
    target_url       TEXT         NOT NULL,
    payload          TEXT,
    success          BOOLEAN      NOT NULL DEFAULT FALSE,
    evidence         TEXT,
    response_snippet TEXT,
    container_id     VARCHAR(64),
    duration_ms      BIGINT,
    retry_count      INTEGER      NOT NULL DEFAULT 0,
    status           VARCHAR(20)  NOT NULL DEFAULT 'pending',
    executed_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dast_results_session ON dast_results(session_id);
CREATE INDEX idx_dast_results_vuln ON dast_results(vuln_id) WHERE vuln_id IS NOT NULL;
