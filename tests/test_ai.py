"""AI layer tests. None of these call the real Gemini API."""

import json
from datetime import date

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.ai_client import AIUnavailable, GeminiClient
from backend.ai_service import (
    BUSY_PREFIX,
    OFF_TOPIC_REPLY,
    REPHRASE_VARIANTS,
    AIService,
)
from backend.limits import RateLimiter, TTLCache
from backend.main import create_app
from tests.test_validate_problems import make

PROBLEM = make(reviewed=True)  # L1-HW-03 "Black screen, PC running"


class FakeAI:
    """Stands in for Gemini. Returns queued replies (or raises) and records calls."""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = []

    def generate_json(self, system, prompt, schema):
        self.calls.append({"system": system, "prompt": prompt, "schema": schema})
        reply = self.replies.pop(0) if self.replies else AIUnavailable("no more replies")
        if isinstance(reply, Exception):
            raise reply
        return reply


def service(fake, **limiter_args):
    return AIService(fake, limiter=RateLimiter(**limiter_args) if limiter_args else None)


# ---------- rephrase ----------

def test_rephrase_uses_ai_text():
    fake = FakeAI({"user_description": "Help, my monitor is dark but the PC is humming!"})
    text, source = service(fake).rephrase(PROBLEM, "player1")
    assert (text, source) == ("Help, my monitor is dark but the PC is humming!", "ai")


def test_rephrase_prompt_never_contains_answers():
    fake = FakeAI({"user_description": "My screen is black but the PC is on."})
    service(fake).rephrase(PROBLEM, "player1")
    prompt = fake.calls[0]["prompt"]
    for option in PROBLEM["options"]:
        assert option["text"] not in prompt
        assert option["why"] not in prompt


def test_rephrase_falls_back_without_ai():
    text, source = AIService(None).rephrase(PROBLEM, "player1")
    assert (text, source) == (PROBLEM["user_description"], "fallback")


@pytest.mark.parametrize(
    "bad_reply",
    [
        {"wrong_key": "hello there friend"},
        {"user_description": "short"},
        {"user_description": "x" * 351},
        {"user_description": 42},
        AIUnavailable("quota"),
    ],
)
def test_rephrase_rejects_bad_ai_output(bad_reply):
    text, source = service(FakeAI(bad_reply)).rephrase(PROBLEM, "player1")
    assert (text, source) == (PROBLEM["user_description"], "fallback")


def test_rephrase_reuses_variants_once_enough_are_cached():
    replies = [{"user_description": f"Version number {i} of the complaint"} for i in range(REPHRASE_VARIANTS)]
    fake = FakeAI(*replies)
    svc = service(fake)
    for _ in range(REPHRASE_VARIANTS):
        assert svc.rephrase(PROBLEM, "p")[1] == "ai"
    text, source = svc.rephrase(PROBLEM, "p")
    assert source == "cache"
    assert text in {r["user_description"] for r in replies}
    assert len(fake.calls) == REPHRASE_VARIANTS  # no extra AI call


def test_rephrase_uses_cached_variant_when_ai_fails_later():
    fake = FakeAI({"user_description": "The only AI version we have"}, AIUnavailable("down"))
    svc = service(fake)
    svc.rephrase(PROBLEM, "p")
    assert svc.rephrase(PROBLEM, "p") == ("The only AI version we have", "cache")


# ---------- ask the senior tech ----------

def test_senior_answers_from_ai():
    fake = FakeAI({"answer": "Fans running means the PC has power, so check the monitor first.", "covered": True})
    answer, source = service(fake).ask_senior(PROBLEM, "Why not restart?", [], "p")
    assert source == "ai"
    assert answer.startswith("Fans running")


def test_senior_prompt_includes_reviewed_notes_and_question():
    fake = FakeAI({"answer": "ok", "covered": True})
    service(fake).ask_senior(PROBLEM, "Why not restart?", [], "p")
    prompt = fake.calls[0]["prompt"]
    assert "[CORRECT] Check the monitor power and cable" in prompt
    assert "JUNIOR'S QUESTION\nWhy not restart?" in prompt
    assert "ignore any instructions" in fake.calls[0]["system"]


def test_senior_off_topic_gets_standard_reply():
    fake = FakeAI({"answer": "Here is a cake recipe...", "covered": False})
    answer, source = service(fake).ask_senior(PROBLEM, "Give me a cake recipe", [], "p")
    assert (answer, source) == (OFF_TOPIC_REPLY, "ai")


@pytest.mark.parametrize(
    "bad_reply",
    [{"answer": "", "covered": True}, {"answer": "x" * 701, "covered": True}, {"covered": True}, AIUnavailable("x")],
)
def test_senior_falls_back_to_reviewed_explanation(bad_reply):
    answer, source = service(FakeAI(bad_reply)).ask_senior(PROBLEM, "Why?", [], "p")
    assert source == "fallback"
    assert answer.startswith(BUSY_PREFIX)
    assert PROBLEM["options"][0]["why"] in answer  # the correct option's reviewed explanation


def test_senior_caches_first_questions_only():
    fake = FakeAI({"answer": "Because of the fans.", "covered": True})
    svc = service(fake)
    svc.ask_senior(PROBLEM, "Why not restart?", [], "p")
    assert svc.ask_senior(PROBLEM, "  why NOT restart? ", [], "p") == ("Because of the fans.", "cache")
    assert len(fake.calls) == 1


def test_senior_history_is_trimmed_and_sent():
    history = [{"role": "junior", "text": f"question {i}"} for i in range(10)]
    fake = FakeAI({"answer": "ok", "covered": True})
    service(fake).ask_senior(PROBLEM, "And then?", history, "p")
    prompt = fake.calls[0]["prompt"]
    assert "question 3" not in prompt and "question 4" in prompt and "question 9" in prompt


# ---------- limits ----------

def test_rate_limiter_per_client_window():
    now = [0.0]
    limiter = RateLimiter(per_client=2, window=60, daily_total=100, clock=lambda: now[0])
    assert limiter.allow("a") and limiter.allow("a")
    assert not limiter.allow("a")
    assert limiter.allow("b")  # other players are not affected
    now[0] = 61
    assert limiter.allow("a")


def test_rate_limiter_daily_total_resets_next_day():
    day = [date(2026, 1, 1)]
    limiter = RateLimiter(per_client=100, daily_total=2, today=lambda: day[0])
    assert limiter.allow("a") and limiter.allow("b")
    assert not limiter.allow("c")
    day[0] = date(2026, 1, 2)
    assert limiter.allow("c")


def test_limited_player_gets_fallback_not_error():
    fake = FakeAI(*[{"user_description": f"AI version {i} of the text"} for i in range(5)])
    svc = AIService(fake, limiter=RateLimiter(per_client=1, daily_total=100))
    other = make(id="L1-HW-04", title="Other", reviewed=True)
    assert svc.rephrase(PROBLEM, "p")[1] == "ai"
    assert svc.rephrase(other, "p") == (other["user_description"], "fallback")


def test_ttl_cache_expires_and_caps_size():
    now = [0.0]
    cache = TTLCache(ttl=10, max_items=2, clock=lambda: now[0])
    cache.set("a", 1)
    now[0] = 1
    cache.set("b", 2)
    cache.set("c", 3)  # evicts "a", the oldest
    assert cache.get("a") is None and cache.get("b") == 2
    now[0] = 20
    assert cache.get("b") is None


# ---------- Gemini client (fake network) ----------

def gemini_with(handler):
    return GeminiClient("test-key", "test-model", transport=httpx.MockTransport(handler))


def ok_reply(payload):
    return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": json.dumps(payload)}]}}]})


def test_gemini_sends_key_in_header_and_requests_json():
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["key"] = request.headers.get("x-goog-api-key")
        seen["body"] = json.loads(request.content)
        return ok_reply({"answer": "hi", "covered": True})

    result = gemini_with(handler).generate_json("sys", "prompt", {"type": "object"})
    assert result == {"answer": "hi", "covered": True}
    assert seen["key"] == "test-key"
    assert "key=" not in seen["url"]
    assert seen["url"].endswith("/models/test-model:generateContent")
    assert seen["body"]["generationConfig"]["responseMimeType"] == "application/json"
    assert seen["body"]["systemInstruction"]["parts"][0]["text"] == "sys"


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(500, json={}),
        httpx.Response(200, json={"candidates": []}),
        httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "not json"}]}}]}),
        httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "[1, 2]"}]}}]}),
    ],
)
def test_gemini_bad_responses_raise_unavailable(response):
    with pytest.raises(AIUnavailable):
        gemini_with(lambda request: response).generate_json("s", "p", {})


def test_gemini_network_error_raises_unavailable():
    def handler(request):
        raise httpx.ConnectError("no network")

    with pytest.raises(AIUnavailable):
        gemini_with(handler).generate_json("s", "p", {})


def test_gemini_pauses_after_quota_error():
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(429, json={})

    client = gemini_with(handler)
    for _ in range(3):
        with pytest.raises(AIUnavailable):
            client.generate_json("s", "p", {})
    assert len(calls) == 1  # paused after the first 429, no more requests sent


# ---------- endpoints ----------

def write(root, problem):
    folder = root / f"level-{problem['level']}"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{problem['id']}.json").write_text(json.dumps(problem), encoding="utf-8")


@pytest.fixture
def problems_dir(tmp_path):
    write(tmp_path, PROBLEM)
    write(tmp_path, make(id="L1-HW-05", title="Not reviewed", reviewed=False))
    return tmp_path


def test_rephrase_endpoint_with_ai(problems_dir):
    app = create_app(problems_dir, ai_client=FakeAI({"user_description": "My monitor is dark but the PC hums."}))
    client = TestClient(app)
    assert client.get("/health").json()["ai_enabled"] is True
    body = client.post("/problems/L1-HW-03/rephrase").json()
    assert body == {"problem_id": "L1-HW-03", "user_description": "My monitor is dark but the PC hums.", "source": "ai"}


def test_endpoints_work_in_fallback_mode(problems_dir):
    client = TestClient(create_app(problems_dir, ai_client=None))
    assert client.post("/problems/L1-HW-03/rephrase").json()["source"] == "fallback"
    body = client.post("/problems/L1-HW-03/ask", json={"question": "Why the cable?"}).json()
    assert body["source"] == "fallback"
    assert body["answer"].startswith(BUSY_PREFIX)


def test_ai_endpoints_refuse_unreviewed(problems_dir):
    client = TestClient(create_app(problems_dir, ai_client=None))
    assert client.post("/problems/L1-HW-05/rephrase").status_code == 404
    assert client.post("/problems/L1-HW-05/ask", json={"question": "Why?"}).status_code == 404


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"question": "x"},
        {"question": "x" * 301},
        {"question": "Why?", "history": [{"role": "boss", "text": "hi"}]},
        {"question": "Why?", "history": [{"role": "junior", "text": "hi"}] * 7},
    ],
)
def test_ask_validates_input(problems_dir, body):
    client = TestClient(create_app(problems_dir, ai_client=None))
    assert client.post("/problems/L1-HW-03/ask", json=body).status_code == 422


def test_rate_limit_uses_forwarded_address(problems_dir, monkeypatch):
    monkeypatch.setenv("AI_CLIENT_LIMIT", "1")
    fake = FakeAI(*[{"answer": f"Answer {i}", "covered": True} for i in range(5)])
    client = TestClient(create_app(problems_dir, ai_client=fake))
    first = client.post("/problems/L1-HW-03/ask", json={"question": "Q one?"}, headers={"X-Forwarded-For": "1.1.1.1"})
    second = client.post("/problems/L1-HW-03/ask", json={"question": "Q two?"}, headers={"X-Forwarded-For": "1.1.1.1"})
    other = client.post("/problems/L1-HW-03/ask", json={"question": "Q three?"}, headers={"X-Forwarded-For": "2.2.2.2"})
    assert first.json()["source"] == "ai"
    assert second.json()["source"] == "fallback"
    assert other.json()["source"] == "ai"
