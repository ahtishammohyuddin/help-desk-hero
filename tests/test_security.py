"""Safety checks: who is calling (for AI limits) and the headers on every reply."""

from fastapi.testclient import TestClient

from backend.main import create_app
from tests.test_validate_problems import make, write


def client(tmp_path):
    write(tmp_path, make(reviewed=True))
    return TestClient(create_app(tmp_path, ai_client=None))


def test_safety_headers_on_every_reply(tmp_path):
    r = client(tmp_path).get("/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["referrer-policy"] == "no-referrer"


def test_player_cannot_fake_who_they_are():
    from starlette.requests import Request

    from backend.main import _client_id

    def req(headers):
        return Request({"type": "http", "headers": [(k.encode(), v.encode()) for k, v in headers.items()], "client": ("9.9.9.9", 1)})

    # The host's own header wins over anything the player sends.
    assert _client_id(req({"x-vercel-forwarded-for": "1.2.3.4", "x-forwarded-for": "6.6.6.6"})) == "1.2.3.4"
    assert _client_id(req({"x-real-ip": "1.2.3.4"})) == "1.2.3.4"
    # A made-up address at the front of x-forwarded-for is ignored: the last one (from the host) counts.
    assert _client_id(req({"x-forwarded-for": "6.6.6.6, 1.2.3.4"})) == "1.2.3.4"
    assert _client_id(req({})) == "9.9.9.9"
