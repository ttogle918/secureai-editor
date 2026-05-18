CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    session_id UUID REFERENCES analysis_sessions(id),
    user_id UUID NOT NULL REFERENCES users(id),
    format VARCHAR(10) NOT NULL CHECK (format IN ('PDF', 'JSON')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED')),
    file_path TEXT,
    download_token VARCHAR(64) UNIQUE,
    download_token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '90 days'
);
CREATE INDEX idx_reports_project_id ON reports(project_id);
CREATE INDEX idx_reports_download_token ON reports(download_token) WHERE download_token IS NOT NULL;
