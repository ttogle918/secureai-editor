CREATE TABLE IF NOT EXISTS dependency_cve_mappings (
    component_id UUID        NOT NULL REFERENCES dependency_components(id) ON DELETE CASCADE,
    cve_id       VARCHAR(30) NOT NULL REFERENCES cve_data(cve_id)          ON DELETE CASCADE,

    PRIMARY KEY (component_id, cve_id)
);

CREATE INDEX idx_dep_cve_mapping_cve ON dependency_cve_mappings(cve_id);
