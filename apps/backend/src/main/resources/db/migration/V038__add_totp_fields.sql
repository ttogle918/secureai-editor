-- users 테이블 TOTP 컬럼 추가
ALTER TABLE users
    ADD COLUMN totp_secret  TEXT,
    ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- TOTP 복구 코드 테이블
CREATE TABLE totp_recovery_codes (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash  TEXT        NOT NULL,   -- BCrypt 해시 저장
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recovery_codes_user_id ON totp_recovery_codes(user_id);
