-- V053: users 테이블에 preferred_provider 컬럼 추가 (COST-4 멀티-프로바이더 BYOK)
-- null = 플랫폼 기본 anthropic 사용 (하위 호환)

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS preferred_provider VARCHAR(20)
        CHECK (preferred_provider IN ('anthropic', 'gemini', 'openai'));
