CREATE TABLE security_guidelines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category        VARCHAR(50) NOT NULL,          -- Injection, Cryptography 등
    sub_category    VARCHAR(50),                   -- SQLi, XSS, JWT 등
    target_stack    VARCHAR(50) NOT NULL,          -- java_spring, python_fastapi, common 등
    title           VARCHAR(255) NOT NULL,
    content         TEXT NOT NULL,                 -- 가이드 본문 (마크다운)
    metadata        JSONB DEFAULT '{}',            -- CWE ID, OWASP ID, 참고 링크 등
    source_path     VARCHAR(500),                  -- 출처 파일 경로 (동기화용)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_guideline_title_stack UNIQUE (title, target_stack)
);

CREATE INDEX idx_guidelines_category ON security_guidelines(category, sub_category);
CREATE INDEX idx_guidelines_stack    ON security_guidelines(target_stack);
CREATE INDEX idx_guidelines_metadata ON security_guidelines USING GIN(metadata);
