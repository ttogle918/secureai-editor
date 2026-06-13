-- TASK-1202a: 감사 로그 불변성 — 해시 체이닝
-- audit_logs 테이블에 SHA-256 해시 체인 컬럼 추가.
-- prev_hash : 직전 로그의 current_hash (genesis 로그는 64자 '0'으로 채움).
-- current_hash : SHA-256(prev_hash || canonical_payload) 결과값 (hex 64자).
-- 기존 행은 NULL 허용 (마이그레이션 이전 데이터 호환).

ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS prev_hash    VARCHAR(64),
    ADD COLUMN IF NOT EXISTS current_hash VARCHAR(64);

-- 체인 무결성 검증을 위한 순서 인덱스
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at ASC);
