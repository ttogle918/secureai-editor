-- TASK-1202b: 세션 이력 관리 및 강제 로그아웃
-- JWT jti 기반 세션 추적 테이블

CREATE TABLE user_sessions (
    id           UUID        NOT NULL DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jwt_jti      VARCHAR(64) NOT NULL,
    device_info  VARCHAR(500),
    ip           VARCHAR(45),
    user_agent   VARCHAR(500),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at   TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ NOT NULL,
    CONSTRAINT pk_user_sessions PRIMARY KEY (id)
);

CREATE UNIQUE INDEX idx_user_sessions_jti ON user_sessions (jwt_jti);
CREATE INDEX idx_user_sessions_user_active ON user_sessions (user_id, revoked_at) WHERE revoked_at IS NULL;
