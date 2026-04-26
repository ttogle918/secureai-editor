from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Service
    app_name: str = "SecureAI AI Engine"
    debug: bool = False

    # Internal auth (Backend → AI Engine)
    internal_api_key: str = Field(..., alias="INTERNAL_API_KEY")

    # Anthropic
    claude_api_key: str = Field(..., alias="CLAUDE_API_KEY")
    claude_model: str = Field("claude-haiku-4-5-20251001", alias="CLAUDE_MODEL")

    # OpenAI
    openai_api_key: str = Field("", alias="OPENAI_API_KEY")
    openai_model: str = Field("gpt-4o-mini", alias="OPENAI_MODEL")

    # Gemini
    gemini_api_key: str = Field("", alias="GEMINI_API_KEY")
    gemini_model: str = Field("gemini-2.0-flash", alias="GEMINI_MODEL")

    # LangSmith tracing
    langsmith_api_key: str = Field("", alias="LANGCHAIN_API_KEY")
    langsmith_project: str = Field("secureai-agent", alias="LANGCHAIN_PROJECT")
    langsmith_tracing: bool = Field(False, alias="LANGCHAIN_TRACING_V2")

    # Redis (rate-limit / cache)
    redis_url: str = Field("redis://redis:6379/1", alias="REDIS_URL")

    # MCP Server
    mcp_workspace_root: str = Field("/workspace", alias="MCP_WORKSPACE_ROOT")
    mcp_server_script: str = Field("/app/mcp_server/dist/index.js", alias="MCP_SERVER_SCRIPT")

    # Backend 내부 API
    backend_internal_url: str = Field("http://backend:8080", alias="BACKEND_INTERNAL_URL")


settings = Settings()
