-- call_chain: TEXT → JSONB 변환 + GIN 인덱스 추가
-- DEFAULT '[]' (TEXT)를 먼저 드랍해야 USING 절 변환이 가능

ALTER TABLE vulnerabilities
    ALTER COLUMN call_chain DROP DEFAULT;

ALTER TABLE vulnerabilities
    ALTER COLUMN call_chain TYPE JSONB USING call_chain::jsonb;

ALTER TABLE vulnerabilities
    ALTER COLUMN call_chain SET DEFAULT '[]'::jsonb;

CREATE INDEX idx_vuln_call_chain_gin ON vulnerabilities USING GIN(call_chain);
