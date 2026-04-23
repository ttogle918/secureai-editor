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
    claude_model: str = Field("claude-opus-4-7", alias="CLAUDE_MODEL")

    # LangSmith tracing
    langsmith_api_key: str = Field("", alias="LANGCHAIN_API_KEY")
    langsmith_project: str = Field("secureai-agent", alias="LANGCHAIN_PROJECT")
    langsmith_tracing: bool = Field(False, alias="LANGCHAIN_TRACING_V2")

    # Redis (rate-limit / cache)
    redis_url: str = Field("redis://redis:6379/1", alias="REDIS_URL")

    # MCP Server
    mcp_workspace_root: str = Field("/workspace", alias="MCP_WORKSPACE_ROOT")


settings = Settings()
