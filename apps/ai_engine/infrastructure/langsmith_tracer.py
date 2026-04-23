import os
from config.settings import settings


def configure_langsmith() -> None:
    """Set LangSmith environment variables before any LangChain import."""
    if settings.langsmith_api_key:
        os.environ["LANGCHAIN_API_KEY"] = settings.langsmith_api_key
        os.environ["LANGCHAIN_PROJECT"] = settings.langsmith_project
        os.environ["LANGCHAIN_TRACING_V2"] = str(settings.langsmith_tracing).lower()
