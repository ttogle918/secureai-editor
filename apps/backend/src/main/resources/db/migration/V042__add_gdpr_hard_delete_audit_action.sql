-- audit_logs.action 컬럼은 VARCHAR(100)이므로 GDPR_HARD_DELETE 값을 별도 DDL 없이 사용 가능.
-- UserRepository 에 GDPR 대기 삭제 목록 조회 시 사용하는 인덱스 추가.
CREATE INDEX IF NOT EXISTS idx_users_deleted_at
    ON users (deleted_at)
    WHERE deleted_at IS NOT NULL;
