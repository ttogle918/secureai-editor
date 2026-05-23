CREATE TABLE security_doc_requests (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    requested_by     UUID         NOT NULL REFERENCES users(id),
    doc_type         VARCHAR(20)  NOT NULL CHECK (doc_type IN ('CISO', 'HANAFOS', 'ISMS')),
    status           VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                                  CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    download_token   VARCHAR(64)  UNIQUE,
    token_expires_at TIMESTAMPTZ,
    file_path        TEXT,
    error_message    TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    completed_at     TIMESTAMPTZ
);

CREATE INDEX idx_security_doc_requests_project ON security_doc_requests(project_id);
CREATE INDEX idx_security_doc_requests_token   ON security_doc_requests(download_token)
    WHERE download_token IS NOT NULL;
