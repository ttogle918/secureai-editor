-- pgvector 익스텐션 활성화 (PostgreSQL 이미지에 pgvector 필요)
-- docker-compose.yml postgres 이미지를 pgvector/pgvector:pg15 또는 pgvector/pgvector:pg16 으로 변경 필요
CREATE EXTENSION IF NOT EXISTS vector;

-- 384차원 임베딩 컬럼 추가 (fastembed BAAI/bge-small-en-v1.5 모델)
ALTER TABLE security_guidelines
    ADD COLUMN IF NOT EXISTS embedding vector(384);

-- 코사인 유사도 IVFFlat 인덱스 (100개 이상 행 보유 시 효과적)
CREATE INDEX IF NOT EXISTS idx_guidelines_embedding
    ON security_guidelines
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 10);

COMMENT ON COLUMN security_guidelines.embedding IS 'fastembed BAAI/bge-small-en-v1.5 384차원 임베딩';
