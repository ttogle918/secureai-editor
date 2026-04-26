-- Flyway 재활성화 시 사용. 현재는 ddl-auto:update 로 관리.
CREATE TABLE IF NOT EXISTS analysis_sessions (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id       UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_files   INT         NOT NULL DEFAULT 0,
    scanned_files INT         NOT NULL DEFAULT 0,
    vuln_count    INT         NOT NULL DEFAULT 0,
    started_at    TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_project ON analysis_sessions(project_id);
CREATE INDEX idx_sessions_user    ON analysis_sessions(user_id);
CREATE INDEX idx_sessions_status  ON analysis_sessions(status);
