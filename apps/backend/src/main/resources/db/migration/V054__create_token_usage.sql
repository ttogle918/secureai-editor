-- COST-3: provider 인지 토큰 원가 계측 테이블
-- 세션 종료 시 1회 집계된 토큰 사용량을 기록한다.

CREATE TABLE token_usage (
    id               UUID        NOT NULL DEFAULT gen_random_uuid(),
    session_id       UUID        NOT NULL,
    user_id          UUID        NOT NULL,
    project_id       UUID        NOT NULL,
    provider         VARCHAR(20) NOT NULL,
    model            VARCHAR(60) NOT NULL,
    input_tokens     BIGINT      NOT NULL DEFAULT 0,
    output_tokens    BIGINT      NOT NULL DEFAULT 0,
    cache_creation_tokens BIGINT NOT NULL DEFAULT 0,
    cache_read_tokens     BIGINT NOT NULL DEFAULT 0,
    cost_usd         NUMERIC(12,6) NOT NULL DEFAULT 0,
    occurred_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_token_usage PRIMARY KEY (id)
);

CREATE INDEX idx_token_usage_user_occurred ON token_usage (user_id, occurred_at);
CREATE INDEX idx_token_usage_session       ON token_usage (session_id);
