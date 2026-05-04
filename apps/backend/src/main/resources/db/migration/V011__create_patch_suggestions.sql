CREATE TABLE patch_suggestions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID        NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
    vuln_id         UUID        REFERENCES vulnerabilities(id) ON DELETE SET NULL,
    file_path       TEXT        NOT NULL,
    vuln_type       VARCHAR(50) NOT NULL,
    original_snippet TEXT,
    patched_snippet  TEXT,
    unified_diff     TEXT,
    explanation      TEXT,
    cache_key        VARCHAR(200),
    is_applied       BOOLEAN     NOT NULL DEFAULT FALSE,
    applied_at       TIMESTAMPTZ,
    applied_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_patch_session  ON patch_suggestions (session_id);
CREATE INDEX idx_patch_vuln     ON patch_suggestions (vuln_id);
CREATE INDEX idx_patch_cache_key ON patch_suggestions (cache_key);
