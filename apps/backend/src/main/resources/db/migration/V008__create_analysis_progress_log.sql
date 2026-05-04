CREATE TABLE IF NOT EXISTS analysis_progress_log (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   UUID        NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
    step_name    VARCHAR(50) NOT NULL,
    step_order   INT         NOT NULL,
    target       VARCHAR(500) NOT NULL DEFAULT '',
    status       VARCHAR(20) NOT NULL,
    started_at   TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_ms  INT,
    detail       TEXT,

    CONSTRAINT uk_progress_session_step_target UNIQUE (session_id, step_name, target)
);

CREATE INDEX idx_progress_session_order ON analysis_progress_log(session_id, step_order);
