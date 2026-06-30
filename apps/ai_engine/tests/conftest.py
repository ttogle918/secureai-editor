"""
테스트 환경 공통 설정.

settings 는 모듈 import 시점에 초기화되므로
환경변수를 fixture 가 아닌 모듈 레벨에서 주입한다.
"""
import os
import sys
from unittest.mock import MagicMock

os.environ.setdefault("INTERNAL_API_KEY", "test-internal-key")
os.environ.setdefault("CLAUDE_API_KEY", "test-claude-key")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ.setdefault("MCP_WORKSPACE_ROOT", "/workspace")
os.environ.setdefault("MCP_SERVER_SCRIPT", "/app/mcp_server/dist/index.js")
# POSTGRES_URL은 .env 파일에서 읽는다 — 통합 테스트 실행 시 올바른 URL 필요

# ── fastembed 스텁 ────────────────────────────────────────────────────────────
# fastembed 는 Docker 이미지 내에서만 설치된다.
# 로컬 pytest 실행 시 임베딩 모델 다운로드 없이 임포트가 가능하도록
# 경량 스텁을 sys.modules 에 사전 등록한다.
# 이 스텁이 없으면 embedding_service.py 임포트 자체가 실패한다.
if "fastembed" not in sys.modules:
    _fastembed_stub = MagicMock()
    # TextEmbedding 클래스: 인스턴스 생성 및 embed() 호출이 MagicMock 으로 처리됨
    _fastembed_stub.TextEmbedding = MagicMock
    sys.modules["fastembed"] = _fastembed_stub
