"""
fastembed 기반 텍스트 임베딩 서비스.

영어 모델 (BAAI/bge-small-en-v1.5, 384차원):
- security_guidelines RAG 검색용
- 첫 호출 시 자동 다운로드 (~24MB)

다국어 모델 (BAAI/bge-m3, 1024차원):
- KISA 컴플라이언스 피드 RAG 검색용 (한국어 포함 100개 이상 언어)
- 첫 호출 시 자동 다운로드 (~1.2GB) — 운영 이미지 사전 다운로드 권장

두 모델 모두 Lazy Singleton 패턴으로 프로세스 내에서 한 번만 로드한다.
ONNX Runtime 기반, PyTorch 불필요.
"""
import logging
from fastembed import TextEmbedding

logger = logging.getLogger(__name__)

# 영어 전용 모델 (기존 — 변경 금지)
_EN_MODEL_NAME = "BAAI/bge-small-en-v1.5"
_model: TextEmbedding | None = None

# 다국어 모델 (KISA 컴플라이언스 피드용)
_multilingual_model: TextEmbedding | None = None


def _get_model() -> TextEmbedding:
    """영어 모델을 지연 초기화하여 반환한다. 프로세스 수명 동안 한 번만 로드."""
    global _model
    if _model is None:
        logger.info("[embedding] loading en model=%s", _EN_MODEL_NAME)
        _model = TextEmbedding(model_name=_EN_MODEL_NAME)
        logger.info("[embedding] en model loaded model=%s", _EN_MODEL_NAME)
    return _model


def _get_multilingual_model() -> TextEmbedding:
    """다국어 모델을 지연 초기화하여 반환한다. 프로세스 수명 동안 한 번만 로드.

    모델명은 settings 에서 읽어 매직스트링을 피한다. 지연 임포트로 순환 의존을 방지한다.
    """
    global _multilingual_model
    if _multilingual_model is None:
        from config.settings import settings  # 지연 임포트 — 순환 의존 방지
        model_name = settings.embedding_multilingual_model
        logger.info("[embedding] loading multilingual model=%s", model_name)
        _multilingual_model = TextEmbedding(model_name=model_name)
        logger.info("[embedding] multilingual model loaded model=%s", model_name)
    return _multilingual_model


# ── 영어 모델 API (기존 — 시그니처 변경 금지) ──────────────────────────────────

def embed_text(text: str) -> list[float]:
    """단일 텍스트를 영어 모델로 384차원 벡터로 변환한다."""
    model = _get_model()
    embeddings = list(model.embed([text]))
    return embeddings[0].tolist()


def embed_texts(texts: list[str]) -> list[list[float]]:
    """복수 텍스트를 영어 모델로 배치 임베딩한다."""
    model = _get_model()
    return [e.tolist() for e in model.embed(texts)]


# ── 다국어 모델 API (KISA 컴플라이언스 피드용) ─────────────────────────────────

def embed_text_multilingual(text: str) -> list[float]:
    """단일 텍스트를 다국어 모델로 임베딩한다(한국어 포함 100개 이상 언어)."""
    model = _get_multilingual_model()
    embeddings = list(model.embed([text]))
    return embeddings[0].tolist()


def embed_texts_multilingual(texts: list[str]) -> list[list[float]]:
    """복수 텍스트를 다국어 모델로 배치 임베딩한다."""
    model = _get_multilingual_model()
    return [e.tolist() for e in model.embed(texts)]
