-- V052: 멀티-프로바이더 BYOK 키 저장 테이블
-- user_provider_keys: 사용자별 provider(anthropic/gemini/openai) API 키 관리
-- encrypted_key: AES-256-GCM 암호화 저장 (AesEncryptionConverter 동일 방식)
-- UNIQUE(user_id, provider): 프로바이더당 단 하나의 키만 허용 (upsert 지원)

CREATE TABLE user_provider_keys (
    id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider      VARCHAR(20) NOT NULL CHECK (provider IN ('anthropic', 'gemini', 'openai')),
    encrypted_key TEXT        NOT NULL,
    default_model VARCHAR(60),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_provider UNIQUE (user_id, provider)
);

CREATE INDEX idx_user_provider_keys_user_id ON user_provider_keys (user_id);
