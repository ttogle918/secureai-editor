CREATE TABLE projects (
    id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id              UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                  VARCHAR(200) NOT NULL,
    description           TEXT,
    language              VARCHAR(50),
    framework             VARCHAR(50),
    source_type           VARCHAR(20)  NOT NULL,

    github_repo_full_name VARCHAR(200),
    github_default_branch VARCHAR(100),
    github_webhook_id     BIGINT,
    github_webhook_secret VARCHAR(64),

    latest_security_score SMALLINT,
    latest_session_id     UUID,

    is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at            TIMESTAMPTZ,

    CONSTRAINT uq_project_owner_name UNIQUE (owner_id, name)
);

CREATE INDEX idx_projects_owner_id   ON projects(owner_id)              WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_github_repo ON projects(github_repo_full_name) WHERE source_type = 'github';
