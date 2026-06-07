"""Unit tests for the DAST exploit executors.

These executors are the actual vulnerability-detection logic of the DAST
pipeline — a false negative here means a real vulnerability ships undetected,
so the success/failure decision for each technique is worth pinning down.

Each executor builds its own ``httpx.AsyncClient`` internally, so we inject an
``httpx.MockTransport`` by patching ``httpx.AsyncClient`` per module. This
exercises the real request construction and response handling rather than
mocking the executor's own logic away.
"""
import json
from contextlib import contextmanager
from unittest.mock import patch

import httpx
import pytest

from agent.nodes.dast.executors import (
    sqli_executor,
    xss_executor,
    ssrf_executor,
    idor_executor,
    auth_bypass_executor,
)


@contextmanager
def mock_http(module, handler):
    """Patch ``module.httpx.AsyncClient`` so it routes through a MockTransport.

    The handler receives an ``httpx.Request`` and returns an ``httpx.Response``.
    """

    # Capture the genuine class before patching — patching module.httpx.AsyncClient
    # rebinds the shared httpx module attribute, so referencing it inside the
    # factory would recurse infinitely.
    real_client = httpx.AsyncClient

    def _factory(*args, **kwargs):
        kwargs.setdefault("transport", httpx.MockTransport(handler))
        return real_client(*args, **kwargs)

    with patch.object(module.httpx, "AsyncClient", _factory):
        yield


# ───────────────────────── SQLi ─────────────────────────

@pytest.mark.asyncio
async def test_sqli_detects_db_error_signature():
    def handler(request):
        return httpx.Response(200, text="You have an error in your SQL syntax near '1'")

    with mock_http(sqli_executor, handler):
        outcome = await sqli_executor.execute("http://t", "search", {"q": ""})

    assert outcome["success"] is True
    assert outcome["payload"] in (
        "' OR '1'='1", "'; DROP TABLE users; --", "' UNION SELECT NULL--",
    )
    assert "DB error" in outcome["evidence"]


@pytest.mark.asyncio
async def test_sqli_clean_response_is_not_flagged():
    def handler(request):
        return httpx.Response(200, text="no results found")

    with mock_http(sqli_executor, handler):
        outcome = await sqli_executor.execute("http://t", "search", {"q": ""})

    assert outcome["success"] is False
    assert outcome["error"] is None


@pytest.mark.asyncio
async def test_sqli_records_error_when_all_requests_fail():
    def handler(request):
        raise httpx.ConnectError("refused")

    with mock_http(sqli_executor, handler):
        outcome = await sqli_executor.execute("http://t", "search", {"q": ""})

    assert outcome["success"] is False
    assert outcome["error"] is not None


def test_sqli_contains_db_error_is_case_insensitive():
    assert sqli_executor._contains_db_error("ORA-00933: SQL command not properly ended")
    assert not sqli_executor._contains_db_error("everything is fine")


# ───────────────────────── XSS ─────────────────────────

@pytest.mark.asyncio
async def test_xss_detects_verbatim_reflection():
    def handler(request):
        # Echo the injected query value straight back into an HTML body.
        q = request.url.params.get("q", "")
        return httpx.Response(200, text=f"<html>{q}</html>")

    with mock_http(xss_executor, handler):
        outcome = await xss_executor.execute("http://t", "echo", {"q": ""})

    assert outcome["success"] is True
    assert outcome["payload"] == "<script>alert(1)</script>"


@pytest.mark.asyncio
async def test_xss_encoded_reflection_is_not_flagged():
    def handler(request):
        # A defended app reflects an escaped value, so no raw payload appears
        # verbatim. URL-encoding also neutralizes the bracket-free
        # "javascript:alert(1)" payload.
        from urllib.parse import quote

        q = request.url.params.get("q", "")
        return httpx.Response(200, text=f"<html>{quote(q)}</html>")

    with mock_http(xss_executor, handler):
        outcome = await xss_executor.execute("http://t", "echo", {"q": ""})

    assert outcome["success"] is False


# ───────────────────────── SSRF ─────────────────────────

@pytest.mark.asyncio
async def test_ssrf_detects_metadata_leak():
    def handler(request):
        return httpx.Response(200, text="ami-id: ami-12345\ninstance-id: i-abc")

    with mock_http(ssrf_executor, handler):
        outcome = await ssrf_executor.execute("http://t", "fetch", {"url": "http://ok"})

    assert outcome["success"] is True
    assert "param 'url'" in outcome["evidence"]


@pytest.mark.asyncio
async def test_ssrf_non_200_is_not_flagged():
    def handler(request):
        return httpx.Response(404, text="ami-id present but wrong status")

    with mock_http(ssrf_executor, handler):
        outcome = await ssrf_executor.execute("http://t", "fetch", {"url": "http://ok"})

    assert outcome["success"] is False


def test_ssrf_find_url_param_key_prefers_known_keys():
    assert ssrf_executor._find_url_param_key({"foo": 1, "redirect": 2}) == "redirect"
    assert ssrf_executor._find_url_param_key({"foo": 1}) == "foo"
    assert ssrf_executor._find_url_param_key({}) == "url"


# ───────────────────────── IDOR ─────────────────────────

@pytest.mark.asyncio
async def test_idor_flags_significant_size_difference():
    def handler(request):
        # Baseline (first probe) is tiny; subsequent probe returns a big body.
        rid = request.url.params.get("id", "")
        body = "x" if rid == "1" else "y" * 500
        return httpx.Response(200, text=body)

    with mock_http(idor_executor, handler):
        outcome = await idor_executor.execute("http://t", "users", {})

    assert outcome["success"] is True
    assert "Response size differs" in outcome["evidence"]


@pytest.mark.asyncio
async def test_idor_uniform_sizes_not_flagged():
    def handler(request):
        return httpx.Response(200, text="same-size-body")

    with mock_http(idor_executor, handler):
        outcome = await idor_executor.execute("http://t", "users", {})

    assert outcome["success"] is False


def test_idor_build_probe_ids_prioritizes_neighbor_of_user_id():
    ids = idor_executor._build_probe_ids({"user_id": "10"})
    assert ids[0] == 11
    # Non-numeric user_id falls back to defaults without raising.
    assert idor_executor._build_probe_ids({"user_id": "abc"}) == list(idor_executor._PROBE_IDS)


# ───────────────────────── Auth bypass ─────────────────────────

def _make_jwt(header: dict, payload: dict) -> str:
    enc = auth_bypass_executor._b64url_encode
    return f"{enc(json.dumps(header).encode())}.{enc(json.dumps(payload).encode())}.sig"


def test_b64url_roundtrip_without_padding():
    data = b"hello-world"
    encoded = auth_bypass_executor._b64url_encode(data)
    assert "=" not in encoded
    assert auth_bypass_executor._b64url_decode(encoded) == data


def test_build_alg_none_token_strips_signature():
    token = _make_jwt({"alg": "HS256", "typ": "JWT"}, {"sub": "u1"})
    forged = auth_bypass_executor._build_alg_none_token(token)
    assert forged is not None
    header = json.loads(auth_bypass_executor._b64url_decode(forged.split(".")[0]))
    assert header["alg"] == "none"
    assert forged.endswith(".")  # empty signature segment


def test_build_admin_role_token_sets_admin():
    token = _make_jwt({"alg": "HS256"}, {"sub": "u1", "role": "user"})
    forged = auth_bypass_executor._build_admin_role_token(token)
    assert forged is not None
    payload = json.loads(auth_bypass_executor._b64url_decode(forged.split(".")[1]))
    assert payload["role"] == "admin"


def test_build_alg_none_token_rejects_malformed_token():
    assert auth_bypass_executor._build_alg_none_token("not-a-jwt") is None


@pytest.mark.asyncio
async def test_auth_bypass_flags_200_response():
    def handler(request):
        return httpx.Response(200, text="welcome admin")

    with mock_http(auth_bypass_executor, handler):
        outcome = await auth_bypass_executor.execute("http://t", "admin", {})

    assert outcome["success"] is True
    # With no original token, the empty-Bearer attempt is the one that fires.
    assert "Empty Bearer token" in outcome["payload"]


@pytest.mark.asyncio
async def test_auth_bypass_all_403_not_flagged():
    def handler(request):
        return httpx.Response(403, text="forbidden")

    with mock_http(auth_bypass_executor, handler):
        outcome = await auth_bypass_executor.execute(
            "http://t", "admin", {"jwt_token": _make_jwt({"alg": "HS256"}, {"role": "user"})}
        )

    assert outcome["success"] is False
