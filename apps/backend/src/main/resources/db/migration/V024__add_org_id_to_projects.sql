ALTER TABLE projects
    ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX idx_projects_org_id ON projects(org_id) WHERE org_id IS NOT NULL;
