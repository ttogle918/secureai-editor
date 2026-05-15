ALTER TABLE users
    ADD COLUMN is_admin       BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN avatar_url     VARCHAR(500),
    ADD COLUMN bio            TEXT,
    ADD COLUMN public_profile BOOLEAN      NOT NULL DEFAULT FALSE;

CREATE INDEX idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;
