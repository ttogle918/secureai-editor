CREATE TABLE IF NOT EXISTS cve_data (
    cve_id            VARCHAR(30)    PRIMARY KEY,
    description       TEXT,
    cvss_score        NUMERIC(4,1),
    cvss_vector       VARCHAR(100),
    severity          VARCHAR(10),
    published_at      TIMESTAMPTZ,
    modified_at       TIMESTAMPTZ,
    affected_products JSONB          NOT NULL DEFAULT '[]',
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cve_severity     ON cve_data(severity);
CREATE INDEX idx_cve_published_at ON cve_data(published_at DESC);
