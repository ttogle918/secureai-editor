-- AesEncryptionConverter가 byte[] → String(Base64) 반환으로 변경됨에 따라
-- bytea 타입 컬럼을 TEXT로 변환한다.
-- 기존 bytea 값이 있으면 encode()로 hex 문자열로 변환하고, null은 그대로 유지한다.
ALTER TABLE users
    ALTER COLUMN github_token      TYPE TEXT USING encode(github_token, 'escape'),
    ALTER COLUMN anthropic_api_key TYPE TEXT USING encode(anthropic_api_key, 'escape');
