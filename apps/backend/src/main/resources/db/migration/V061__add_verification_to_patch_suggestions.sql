-- V061: patch_suggestions 에 검증(verification) 관련 컬럼 추가 (TASK-1402)
--
-- verification_status : PENDING(기본) / VERIFIED / FAILED — Python+pytest 검증 결과
-- verified_at         : 검증 완료 시각 (VERIFIED 또는 FAILED 전이 시 기록)
-- test_code           : Claude가 생성한 임시 pytest 테스트 코드 (감사 목적 보존)
-- verification_log    : 컨테이너 실행 로그 (stdout + stderr 요약, 최대 4096자 권장)

ALTER TABLE patch_suggestions
    ADD COLUMN IF NOT EXISTS verification_status VARCHAR(10)
        NOT NULL DEFAULT 'PENDING'
        CHECK (verification_status IN ('PENDING', 'VERIFIED', 'FAILED')),
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS test_code TEXT NULL,
    ADD COLUMN IF NOT EXISTS verification_log TEXT NULL;
