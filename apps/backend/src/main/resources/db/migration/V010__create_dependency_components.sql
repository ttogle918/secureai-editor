CREATE TABLE IF NOT EXISTS dependency_components (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID         NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
    project_id      UUID         NOT NULL REFERENCES projects(id)          ON DELETE CASCADE,
    package_manager VARCHAR(20)  NOT NULL,
    group_id        VARCHAR(200),
    artifact_id     VARCHAR(200) NOT NULL,
    version         VARCHAR(100),
    scope           VARCHAR(50),
    is_direct       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dep_session    ON dependency_components(session_id);
CREATE INDEX idx_dep_project    ON dependency_components(project_id);
CREATE INDEX idx_dep_artifact   ON dependency_components(artifact_id);
