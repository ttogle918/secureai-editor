CREATE TABLE IF NOT EXISTS project_schedules (
    id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id     UUID        NOT NULL UNIQUE,
    is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
    last_scan_sha  VARCHAR(255),
    last_scan_at   TIMESTAMPTZ,
    scan_hour      SMALLINT    NOT NULL DEFAULT 1,  -- KST 01:00 기준 (UTC 16:00)
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_schedules_project_id ON project_schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_project_schedules_active ON project_schedules(is_active) WHERE is_active = TRUE;
