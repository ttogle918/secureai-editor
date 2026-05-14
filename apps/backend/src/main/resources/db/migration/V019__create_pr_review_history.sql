CREATE TABLE pr_review_history (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID        NOT NULL,
    repo_owner  VARCHAR(255) NOT NULL,
    repo_name   VARCHAR(255) NOT NULL,
    pr_number   INTEGER      NOT NULL,
    head_sha    VARCHAR(40)  NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'pending',  -- pending / completed / error
    vuln_count  INTEGER      NOT NULL DEFAULT 0,
    check_run_id BIGINT,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_pr_review_history_project ON pr_review_history (project_id);
CREATE INDEX idx_pr_review_history_pr ON pr_review_history (repo_owner, repo_name, pr_number);
