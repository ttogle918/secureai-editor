-- TASK-1210: 이메일 억제(suppression) 목록
-- 바운스/스팸 신고로 수신 거부된 이메일 주소를 보관하고 발송을 스킵한다.

CREATE TABLE email_suppression (
    id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    email_address VARCHAR(254) NOT NULL,
    reason        VARCHAR(12)  NOT NULL CHECK (reason IN ('BOUNCE', 'COMPLAINT')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_email_suppression    PRIMARY KEY (id),
    CONSTRAINT uq_email_suppression_address UNIQUE (email_address)
);

CREATE INDEX idx_email_suppression_address ON email_suppression (email_address);
