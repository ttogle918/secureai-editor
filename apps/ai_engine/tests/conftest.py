"""
테스트 환경 공통 설정.

settings 는 모듈 import 시점에 초기화되므로
환경변수를 fixture 가 아닌 모듈 레벨에서 주입한다.
"""
import os

os.environ.setdefault("INTERNAL_API_KEY", "test-internal-key")
os.environ.setdefault("CLAUDE_API_KEY", "test-claude-key")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ.setdefault("MCP_WORKSPACE_ROOT", "/workspace")
os.environ.setdefault("MCP_SERVER_SCRIPT", "/app/mcp_server/dist/index.js")
os.environ.setdefault("POSTGRES_URL", "postgresql://test:test@localhost:5432/test")
