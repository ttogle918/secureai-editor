-- Stage C-2: KISA 컴플라이언스 피드 다국어 임베딩 컬럼 추가
-- 모델: BAAI/bge-m3 (fastembed, 1024차원, 100개 이상 언어 지원, 한국어 포함)
-- pgvector 확장은 V028 에서 이미 활성화됨 — IF NOT EXISTS 로 멱등성 보장
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE compliance_feed_items
    ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- 코사인 유사도 IVFFlat 인덱스 (V028 idx_guidelines_embedding 패턴 동일)
CREATE INDEX IF NOT EXISTS idx_cfi_embedding
    ON compliance_feed_items
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 10);

COMMENT ON COLUMN compliance_feed_items.embedding
    IS 'fastembed BAAI/bge-m3 1024차원 다국어 임베딩 (한국어/영어 등 100개 이상 언어 지원)';
