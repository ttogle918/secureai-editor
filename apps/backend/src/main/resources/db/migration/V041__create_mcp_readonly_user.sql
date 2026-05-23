-- MCP PostgreSQL Read-Only 계정 생성
-- AI Agent가 취약점·패치 이력을 읽기 전용으로 조회하기 위한 전용 계정이다.
-- 비밀번호는 Flyway placeholder ${mcp-ro-password}로 주입된다.
-- (spring.flyway.placeholders.mcp-ro-password 설정값 사용)
-- IF NOT EXISTS 조건으로 멱등성을 보장한다.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'secureai_mcp_ro') THEN
        CREATE USER secureai_mcp_ro WITH PASSWORD '${mcp-ro-password}';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE "${flyway:database}" TO secureai_mcp_ro;
GRANT USAGE ON SCHEMA public TO secureai_mcp_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO secureai_mcp_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO secureai_mcp_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE INSERT, UPDATE, DELETE ON TABLES FROM secureai_mcp_ro;
