from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AliasChoices, Field


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

    # PostgreSQL (LangGraph Checkpointer)
    postgres_url: str = Field(
        "postgresql://secureai:secureai@postgres:5432/secureai",
        alias="POSTGRES_URL",
    )

    # PostgreSQL MCP (AI Agent Read-Only 조회용)
    # secureai_mcp_ro 전용 연결 문자열. 비어있으면 MCP DB 조회 비활성화.
    postgres_mcp_url: str = Field(
        default="",
        validation_alias=AliasChoices("POSTGRES_MCP_URL", "postgres_mcp_url"),
        description="MCP Read-Only PostgreSQL URL (없으면 MCP DB 조회 비활성화)",
    )

    # 임베딩 설정 (fastembed BAAI/bge-small-en-v1.5)
    embedding_model: str = Field("BAAI/bge-small-en-v1.5", alias="EMBEDDING_MODEL")
    embedding_top_k: int = Field(5, alias="EMBEDDING_TOP_K")

    # OpenTelemetry — 분산 트레이싱 (기본 비활성화, 프로덕션에서만 활성화)
    otel_enabled: bool = Field(False, alias="OTEL_ENABLED")
    otel_exporter_otlp_endpoint: str = Field("http://localhost:4317", alias="OTEL_EXPORTER_OTLP_ENDPOINT")
    otel_service_name: str = Field("secureai-ai-engine", alias="OTEL_SERVICE_NAME")


settings = Settings()
