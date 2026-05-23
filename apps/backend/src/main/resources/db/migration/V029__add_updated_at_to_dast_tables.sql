ALTER TABLE dast_results  ADD COLUMN updated_at TIMESTAMPTZ;
ALTER TABLE scan_targets  ADD COLUMN updated_at TIMESTAMPTZ;

UPDATE dast_results  SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE scan_targets  SET updated_at = created_at WHERE updated_at IS NULL;
