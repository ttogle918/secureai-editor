"""
TASK-204 — backend_api_client 단위 테스트.

fingerprint 생성 규칙 및 save_vulnerabilities 동작을 검증한다.
"""
import hashlib
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from infrastructure.backend_api_client import _fingerprint, save_vulnerabilities


# ---------------------------------------------------------------------------
# fingerprint 결정론적 생성
# ---------------------------------------------------------------------------

def test_fingerprint_same_inputs_are_equal():
    a = _fingerprint("/src/Dao.java", 42, "SQL_INJECTION")
    b = _fingerprint("/src/Dao.java", 42, "SQL_INJECTION")
    assert a == b


def test_fingerprint_different_line_differs():
    a = _fingerprint("/src/Dao.java", 42, "SQL_INJECTION")
    b = _fingerprint("/src/Dao.java", 43, "SQL_INJECTION")
    assert a != b


def test_fingerprint_different_type_differs():
    a = _fingerprint("/src/Dao.java", 42, "SQL_INJECTION")
    b = _fingerprint("/src/Dao.java", 42, "XSS")
    assert a != b


def test_fingerprint_different_file_differs():
    a = _fingerprint("/src/Dao.java", 42, "SQL_INJECTION")
    b = _fingerprint("/src/Service.java", 42, "SQL_INJECTION")
    assert a != b


def test_fingerprint_none_line_uses_zero():
    fp = _fingerprint("/src/Dao.java", None, "SQL_INJECTION")
    expected = hashlib.sha256("/src/Dao.java:0:SQL_INJECTION".encode()).hexdigest()
    assert fp == expected


def test_fingerprint_is_64_hex_chars():
    fp = _fingerprint("/any/file.py", 1, "XSS")
    assert len(fp) == 64
    assert all(c in "0123456789abcdef" for c in fp)


# ---------------------------------------------------------------------------
# save_vulnerabilities — HTTP 호출 mock
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_save_vulnerabilities_empty_list_returns_zero():
    result = await save_vulnerabilities("sess", "proj", "/file.java", [])
    assert result == 0


@pytest.mark.asyncio
async def test_save_vulnerabilities_success():
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"data": {"saved": 2}}

    # backend_api_client 는 모듈 레벨 ``_client`` 를 재사용하므로 인스턴스를 패치한다.
    mock_client = MagicMock()
    mock_client.post = AsyncMock(return_value=mock_resp)

    with patch("infrastructure.backend_api_client._client", mock_client):
        result = await save_vulnerabilities(
            "sess-1", "proj-1", "/src/Dao.java",
            [
                {"type": "SQL_INJECTION", "severity": "HIGH", "line": 42},
                {"type": "XSS",           "severity": "MEDIUM", "line": 10},
            ],
        )

    assert result == 2


@pytest.mark.asyncio
async def test_save_vulnerabilities_http_error_returns_zero():
    mock_client = MagicMock()
    mock_client.post = AsyncMock(side_effect=Exception("connection refused"))

    with patch("infrastructure.backend_api_client._client", mock_client):
        result = await save_vulnerabilities(
            "sess-err", "proj-err", "/src/Fail.java",
            [{"type": "XSS", "severity": "LOW", "line": 1}],
        )

    assert result == 0


@pytest.mark.asyncio
async def test_save_vulnerabilities_payload_shape():
    """전송 payload에 sessionId, projectId, filePath, vulnerabilities 포함 확인."""
    captured = {}

    async def _fake_post(url, json=None, headers=None):
        captured["payload"] = json
        resp = MagicMock()
        resp.raise_for_status = MagicMock()
        resp.json.return_value = {"data": {"saved": 1}}
        return resp

    mock_client = MagicMock()
    mock_client.post = _fake_post

    with patch("infrastructure.backend_api_client._client", mock_client):
        await save_vulnerabilities(
            "s1", "p1", "/path/File.java",
            [{"type": "PATH_TRAVERSAL", "severity": "HIGH", "line": 5}],
        )

    payload = captured["payload"]
    assert payload["sessionId"] == "s1"
    assert payload["projectId"] == "p1"
    assert payload["filePath"] == "/path/File.java"
    assert len(payload["vulnerabilities"]) == 1
    item = payload["vulnerabilities"][0]
    assert item["vulnType"] == "PATH_TRAVERSAL"
    assert item["severity"] == "HIGH"
    assert len(item["fingerprint"]) == 64
