CREATE TABLE users (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email                   VARCHAR(255) NOT NULL UNIQUE,
    password_hash           VARCHAR(255),
    username                VARCHAR(100) NOT NULL UNIQUE,
    display_name            VARCHAR(100),
    plan_id                 SMALLINT     NOT NULL DEFAULT 1 REFERENCES plans(id),

    github_id               BIGINT       UNIQUE,
    github_login            VARCHAR(100),
    github_token            BYTEA,
    github_token_expires_at TIMESTAMPTZ,

    sast_usage_this_month   INTEGER      NOT NULL DEFAULT 0,
    sast_usage_reset_at     TIMESTAMPTZ  NOT NULL DEFAULT (DATE_TRUNC('month', NOW()) + INTERVAL '1 month'),

    email_verified          BOOLEAN      NOT NULL DEFAULT FALSE,
    email_verify_token      VARCHAR(64),
    email_verify_expires_at TIMESTAMPTZ,
    is_active               BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login_at           TIMESTAMPTZ,
    login_fail_count        SMALLINT     NOT NULL DEFAULT 0,
    locked_until            TIMESTAMPTZ,

    timezone                VARCHAR(50)  NOT NULL DEFAULT 'Asia/Seoul',
    locale                  VARCHAR(10)  NOT NULL DEFAULT 'ko',
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_users_email    ON users(email)     WHERE deleted_at IS NULL;
CREATE INDEX idx_users_username ON users(username)  WHERE deleted_at IS NULL;
CREATE INDEX idx_users_github   ON users(github_id) WHERE github_id IS NOT NULL;
