"""
BAAI/bge-small-en-v1.5 모델로 텍스트 임베딩을 생성한다.

- ONNX Runtime 기반, PyTorch 불필요
- 384차원 벡터
- 첫 호출 시 모델 자동 다운로드 (~24MB)
- Lazy Singleton 패턴으로 모델 인스턴스를 프로세스 내에서 한 번만 로드
"""
import logging
from fastembed import TextEmbedding

logger = logging.getLogger(__name__)

MODEL_NAME = "BAAI/bge-small-en-v1.5"
_model: TextEmbedding | None = None


def _get_model() -> TextEmbedding:
    """모델을 지연 초기화하여 반환한다. 프로세스 수명 동안 한 번만 로드."""
    global _model
    if _model is None:
        logger.info("[embedding] loading model=%s", MODEL_NAME)
        _model = TextEmbedding(model_name=MODEL_NAME)
        logger.info("[embedding] model loaded successfully model=%s", MODEL_NAME)
    return _model


def embed_text(text: str) -> list[float]:
    """단일 텍스트를 384차원 벡터로 변환한다."""
    model = _get_model()
    embeddings = list(model.embed([text]))
    return embeddings[0].tolist()


def embed_texts(texts: list[str]) -> list[list[float]]:
    """복수 텍스트를 배치 임베딩한다."""
    model = _get_model()
    return [e.tolist() for e in model.embed(texts)]
