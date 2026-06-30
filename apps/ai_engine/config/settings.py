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
    # Audit: 빠른 비용 효율. Pipeline: 고품질 정밀 분석
    audit_model: str = Field("claude-haiku-4-5-20251001", alias="AUDIT_MODEL")
    pipeline_model: str = Field("claude-sonnet-4-6", alias="PIPELINE_MODEL")

    # OpenAI
    openai_api_key: str = Field("", alias="OPENAI_API_KEY")
    openai_model: str = Field("gpt-4o-mini", alias="OPENAI_MODEL")

    # Gemini
    gemini_api_key: str = Field("", alias="GEMINI_API_KEY")
    gemini_model: str = Field("gemini-2.5-flash", alias="GEMINI_MODEL")
    # G0 정정: gemini-2.0-flash 폐기(404) → gemini-2.5-flash
    gemini_base_url: str = Field(
        "https://generativelanguage.googleapis.com/v1beta/openai/",
        alias="GEMINI_BASE_URL",
    )

    # Provider 라우팅 (COST-1)
    # default_provider: fallback 기본 프로바이더
    # audit_provider:   AUDIT 모드(빠른 스캔) 에 사용할 프로바이더
    # pipeline_provider: PIPELINE 모드(정밀 분석) 에 사용할 프로바이더
    default_provider: str = Field("anthropic", alias="DEFAULT_PROVIDER")
    audit_provider: str = Field("anthropic", alias="AUDIT_PROVIDER")
    pipeline_provider: str = Field("anthropic", alias="PIPELINE_PROVIDER")

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

    # 임베딩 설정 (fastembed BAAI/bge-small-en-v1.5, 영어 전용, 384차원)
    embedding_model: str = Field("BAAI/bge-small-en-v1.5", alias="EMBEDDING_MODEL")
    embedding_top_k: int = Field(5, alias="EMBEDDING_TOP_K")

    # 다국어 임베딩 설정 (KISA 컴플라이언스 피드, 한국어/영어 등 100개 이상 언어 지원)
    # BAAI/bge-m3: fastembed >= 0.3.0 지원, 1024차원, 최고 수준 다국어 검색 품질
    embedding_multilingual_model: str = Field(
        "BAAI/bge-m3", alias="EMBEDDING_MULTILINGUAL_MODEL"
    )
    embedding_multilingual_top_k: int = Field(5, alias="EMBEDDING_MULTILINGUAL_TOP_K")

    # OpenTelemetry — 분산 트레이싱 (기본 비활성화, 프로덕션에서만 활성화)
    otel_enabled: bool = Field(False, alias="OTEL_ENABLED")
    otel_exporter_otlp_endpoint: str = Field("http://localhost:4317", alias="OTEL_EXPORTER_OTLP_ENDPOINT")
    otel_service_name: str = Field("secureai-ai-engine", alias="OTEL_SERVICE_NAME")

    # Sentry 에러 추적 — SENTRY_DSN 미설정 시 init 스킵 (env-gated, TASK-1804)
    sentry_dsn: str = Field("", alias="SENTRY_DSN")

    # AST 사전 필터링 활성화 여부 (VAL-1 검증 완료 전까지 기본값 False 권장)
    ast_pre_filter_enabled: bool = Field(False, alias="AST_PRE_FILTER_ENABLED")


settings = Settings()
