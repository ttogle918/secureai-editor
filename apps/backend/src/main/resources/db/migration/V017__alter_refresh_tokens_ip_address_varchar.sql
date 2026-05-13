ALTER TABLE refresh_tokens
    ALTER COLUMN ip_address TYPE VARCHAR(45) USING ip_address::TEXT;
