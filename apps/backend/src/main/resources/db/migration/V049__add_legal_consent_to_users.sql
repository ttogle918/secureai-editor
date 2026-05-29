-- V049: 법적 동의 컬럼 추가 (TASK-1104 — GDPR/PIPA 준수)
-- terms_accepted_at / privacy_accepted_at: 회원가입 시 동의 시각 기록 (분쟁 증빙)
-- marketing_opt_in: 광고성 정보 수신 동의 (선택)

ALTER TABLE users
    ADD COLUMN terms_accepted_at   TIMESTAMPTZ,
    ADD COLUMN privacy_accepted_at TIMESTAMPTZ,
    ADD COLUMN marketing_opt_in    BOOLEAN NOT NULL DEFAULT FALSE;
