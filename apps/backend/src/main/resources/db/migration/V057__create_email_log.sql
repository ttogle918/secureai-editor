-- TASK-1210: 트랜잭션 이메일 발송 로그
-- 민감 데이터(토큰·링크) 미저장 — subject·to·status 수준만 기록

CREATE TABLE email_log (
    id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    to_address    VARCHAR(254) NOT NULL,
    subject       VARCHAR(998) NOT NULL,
    status        VARCHAR(12)  NOT NULL CHECK (status IN ('SENT', 'FAILED', 'SUPPRESSED')),
    provider      VARCHAR(32)  NOT NULL,
    attempts      INT          NOT NULL DEFAULT 0,
    error_message VARCHAR(500),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_email_log PRIMARY KEY (id)
);

CREATE INDEX idx_email_log_to_address ON email_log (to_address);
CREATE INDEX idx_email_log_status     ON email_log (status);
CREATE INDEX idx_email_log_created_at ON email_log (created_at);
