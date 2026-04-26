"""
TASK-205 — progress_log_client 단위 테스트.

log_started / log_completed / log_failed 의 페이로드 형태와
HTTP 오류 시 예외 비전파를 검증한다.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from infrastructure.progress_log_client import (
    log_completed,
    log_failed,
    log_started,
    log_progress,
)


def _make_mock_client(saved_payload: dict):
    """페이로드를 캡처하는 mock httpx.AsyncClient 를 반환한다."""

    async def _fake_post(url, json=None, headers=None):
        saved_payload["payload"] = json
        resp = MagicMock()
        resp.raise_for_status = MagicMock()
        return resp

    mock_client = AsyncMock()
    mock_client.post = _fake_post
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return mock_client


# ---------------------------------------------------------------------------
# log_started
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_log_started_payload():
    captured = {}
    with patch("infrastructure.progress_log_client.httpx.AsyncClient",
               return_value=_make_mock_client(captured)):
        await log_started("sess-1", "scan_files", 1)

    p = captured["payload"]
    assert p["sessionId"] == "sess-1"
    assert p["stepName"] == "scan_files"
    assert p["stepOrder"] == 1
    assert p["status"] == "started"
    assert p["target"] == ""
    assert "detail" not in p


@pytest.mark.asyncio
async def test_log_started_with_target():
    captured = {}
    with patch("infrastructure.progress_log_client.httpx.AsyncClient",
               return_value=_make_mock_client(captured)):
        await log_started("sess-2", "sast", 2, target="/src/Foo.java")

    assert captured["payload"]["target"] == "/src/Foo.java"


# ---------------------------------------------------------------------------
# log_completed
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_log_completed_payload():
    captured = {}
    with patch("infrastructure.progress_log_client.httpx.AsyncClient",
               return_value=_make_mock_client(captured)):
        await log_completed("sess-1", "sast", 2, target="/src/Foo.java", detail={"vulnCount": 3})

    p = captured["payload"]
    assert p["status"] == "completed"
    assert p["target"] == "/src/Foo.java"
    assert p["detail"] == {"vulnCount": 3}


@pytest.mark.asyncio
async def test_log_completed_no_detail_omits_key():
    captured = {}
    with patch("infrastructure.progress_log_client.httpx.AsyncClient",
               return_value=_make_mock_client(captured)):
        await log_completed("sess-1", "aggregate", 3)

    assert "detail" not in captured["payload"]


# ---------------------------------------------------------------------------
# log_failed
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_log_failed_status():
    captured = {}
    with patch("infrastructure.progress_log_client.httpx.AsyncClient",
               return_value=_make_mock_client(captured)):
        await log_failed("sess-2", "sast", 2, target="/src/Bar.java", detail={"error": "timeout"})

    p = captured["payload"]
    assert p["status"] == "failed"
    assert p["detail"] == {"error": "timeout"}


# ---------------------------------------------------------------------------
# 오류 내성 — HTTP 실패 시 예외 전파 없음
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_log_progress_http_error_does_not_raise():
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(side_effect=Exception("connection refused"))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("infrastructure.progress_log_client.httpx.AsyncClient", return_value=mock_client):
        await log_started("sess-err", "scan_files", 1)  # 예외 전파 없어야 함


@pytest.mark.asyncio
async def test_log_completed_http_error_does_not_raise():
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(side_effect=Exception("timeout"))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("infrastructure.progress_log_client.httpx.AsyncClient", return_value=mock_client):
        await log_completed("sess-err", "sast", 2, target="/src/X.java")


# ---------------------------------------------------------------------------
# URL 확인
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_log_progress_posts_to_correct_url():
    captured_url = {}

    async def _fake_post(url, json=None, headers=None):
        captured_url["url"] = url
        resp = MagicMock()
        resp.raise_for_status = MagicMock()
        return resp

    mock_client = AsyncMock()
    mock_client.post = _fake_post
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("infrastructure.progress_log_client.httpx.AsyncClient", return_value=mock_client):
        await log_started("s", "scan_files", 1)

    assert captured_url["url"].endswith("/api/v1/internal/progress-logs")
