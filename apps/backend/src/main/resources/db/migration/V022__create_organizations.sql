CREATE TABLE organizations (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    owner_id    UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    plan_id     SMALLINT     NOT NULL REFERENCES plans(id),
    avatar_url  VARCHAR(500),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,
    CONSTRAINT uq_org_slug UNIQUE (slug)
);
CREATE INDEX idx_org_owner ON organizations(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_org_slug  ON organizations(slug) WHERE deleted_at IS NULL;
