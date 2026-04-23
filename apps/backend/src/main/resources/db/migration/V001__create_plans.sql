CREATE TABLE plans (
    id                     SMALLINT     PRIMARY KEY,
    name                   VARCHAR(20)  NOT NULL UNIQUE,
    display_name           VARCHAR(50)  NOT NULL,
    monthly_price_krw      INTEGER      NOT NULL DEFAULT 0,
    max_members            SMALLINT     NOT NULL DEFAULT 1,
    monthly_sast_limit     INTEGER      NOT NULL DEFAULT 50,
    allow_private_repo     BOOLEAN      NOT NULL DEFAULT FALSE,
    allow_dast             BOOLEAN      NOT NULL DEFAULT FALSE,
    allow_monitoring       BOOLEAN      NOT NULL DEFAULT FALSE,
    allow_pdf_report       BOOLEAN      NOT NULL DEFAULT FALSE,
    allow_sbom             BOOLEAN      NOT NULL DEFAULT FALSE,
    allow_sso              BOOLEAN      NOT NULL DEFAULT FALSE,
    api_rate_limit_per_min SMALLINT     NOT NULL DEFAULT 10,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO plans (id, name, display_name, monthly_price_krw, max_members, monthly_sast_limit,
                   allow_private_repo, allow_dast, allow_monitoring, allow_pdf_report, allow_sbom,
                   allow_sso, api_rate_limit_per_min)
VALUES
    (1, 'free',       '무료',       0,      1,  50,  false, false, false, false, false, false, 10),
    (2, 'pro',        'Pro',        19900,  1,  -1,  true,  true,  false, true,  true,  false, 60),
    (3, 'team',       'Team',       59000,  5,  -1,  true,  true,  true,  true,  true,  false, 120),
    (4, 'enterprise', 'Enterprise', 0,      -1, -1,  true,  true,  true,  true,  true,  true,  -1);
