CREATE TABLE scan_targets (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    domain              VARCHAR(255) NOT NULL,
    verified            BOOLEAN      NOT NULL DEFAULT FALSE,
    verification_token  VARCHAR(64)  NOT NULL,
    verified_at         TIMESTAMPTZ,
    consent_given       BOOLEAN      NOT NULL DEFAULT FALSE,
    consent_ip          INET,
    consent_given_at    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, domain)
);
CREATE INDEX idx_scan_targets_domain ON scan_targets(domain) WHERE verified = TRUE;
