"""
TASK-206 — infrastructure/checkpointer 단위 테스트.

AsyncPostgresSaver 없이 get/set 인터페이스만 검증한다.
"""
import infrastructure.checkpointer as cp_module
from infrastructure.checkpointer import get_checkpointer, set_checkpointer


def _reset():
    cp_module._checkpointer = None


def test_get_checkpointer_initially_none():
    _reset()
    assert get_checkpointer() is None


def test_set_and_get_checkpointer():
    _reset()
    sentinel = object()
    set_checkpointer(sentinel)
    assert get_checkpointer() is sentinel
    _reset()


def test_set_overrides_previous():
    _reset()
    first = object()
    second = object()
    set_checkpointer(first)
    set_checkpointer(second)
    assert get_checkpointer() is second
    _reset()


def test_set_none_clears_checkpointer():
    _reset()
    set_checkpointer(object())
    set_checkpointer(None)
    assert get_checkpointer() is None
