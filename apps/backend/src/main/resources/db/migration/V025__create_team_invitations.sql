CREATE TABLE team_invitations (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID         REFERENCES organizations(id) ON DELETE CASCADE,
    project_id  UUID         REFERENCES projects(id) ON DELETE CASCADE,
    email       VARCHAR(255) NOT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'member',
    token       VARCHAR(64)  NOT NULL UNIQUE,
    invited_by  UUID         NOT NULL REFERENCES users(id),
    expires_at  TIMESTAMPTZ  NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_invitation_target CHECK (
        (org_id IS NOT NULL AND project_id IS NULL) OR
        (org_id IS NULL AND project_id IS NOT NULL)
    )
);
CREATE INDEX idx_invitations_token ON team_invitations(token) WHERE accepted_at IS NULL;
CREATE INDEX idx_invitations_email ON team_invitations(email) WHERE accepted_at IS NULL;
