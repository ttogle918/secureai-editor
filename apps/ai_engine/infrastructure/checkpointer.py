"""
LangGraph AsyncPostgresSaver 싱글턴.

main.py lifespan에서 초기화되고, analyze.py에서 참조한다.
순환 import 방지를 위해 별도 모듈로 분리.
"""
from __future__ import annotations

_checkpointer = None


def set_checkpointer(saver) -> None:
    global _checkpointer
    _checkpointer = saver


def get_checkpointer():
    """초기화 전에는 None을 반환한다. 호출부에서 None 처리 필요."""
    return _checkpointer
