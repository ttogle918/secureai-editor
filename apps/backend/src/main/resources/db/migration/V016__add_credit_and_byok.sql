-- ── Plans: 크레딧 관련 컬럼 추가 ─────────────────────────────────────────────
ALTER TABLE plans
    ADD COLUMN monthly_credits INTEGER NOT NULL DEFAULT 0;

UPDATE plans SET monthly_credits = 50      WHERE name = 'free';
UPDATE plans SET monthly_credits = 2000    WHERE name = 'pro';
UPDATE plans SET monthly_credits = 10000   WHERE name = 'team';
UPDATE plans SET monthly_credits = -1      WHERE name = 'enterprise'; -- -1 = 무제한

-- ── Users: 크레딧 잔액 + BYOK + 선호 모델 ─────────────────────────────────────
ALTER TABLE users
    ADD COLUMN credit_balance    INTEGER     NOT NULL DEFAULT 100,
    ADD COLUMN anthropic_api_key BYTEA,
    ADD COLUMN preferred_model   VARCHAR(60) NOT NULL DEFAULT 'claude-haiku-4-5-20251001';

-- ── Credit Transactions: 크레딧 변동 이력 ─────────────────────────────────────
CREATE TABLE credit_transactions (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta         INTEGER      NOT NULL,        -- 양수 = 지급, 음수 = 차감
    reason        VARCHAR(50)  NOT NULL,        -- 'signup_bonus' | 'monthly_grant' | 'sast_scan' | 'byok_bypass' | 'refund'
    session_id    UUID         REFERENCES analysis_sessions(id) ON DELETE SET NULL,
    model         VARCHAR(60),
    files_count   INTEGER,
    balance_after INTEGER      NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_tx_user_created ON credit_transactions(user_id, created_at DESC);
