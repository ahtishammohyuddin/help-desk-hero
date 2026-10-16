"""Matching the player's own words to a listed option. The AI never sees which option is correct."""

from fastapi.testclient import TestClient

from backend.ai_service import AIService, keyword_match, redact
from backend.main import create_app
from tests.test_ai import FakeAI, PROBLEM
from tests.test_validate_problems import make, write

OPTIONS = [(i, o["text"]) for i, o in enumerate(PROBLEM["options"])]


def test_ai_match_uses_only_option_texts():
    fake = FakeAI({"option": 2, "sure": True})
    found, source = AIService(fake).match_answer(PROBLEM["id"], OPTIONS, "my answer here", "p1")
    assert (found, source) == (2, "ai")
    prompt = fake.calls[0]["prompt"] + fake.calls[0]["system"]
    for option in PROBLEM["options"]:
        assert option["why"] not in prompt  # explanations never go to the AI
    assert "correct" not in fake.calls[0]["prompt"].lower()


def test_ai_unsure_or_out_of_range_means_no_match():
    assert AIService(FakeAI({"option": 1, "sure": False})).match_answer("X", OPTIONS, "something", "p1") == (None, "ai")
    assert AIService(FakeAI({"option": 99, "sure": True})).match_answer("Y", OPTIONS, "something", "p1") == (None, "ai")


def test_bad_ai_reply_falls_back_to_keywords():
    found, source = AIService(FakeAI({"nope": 1})).match_answer("Z", OPTIONS, "zzzz qqqq", "p1")
    assert (found, source) == (None, "none")


def test_keyword_match_needs_a_clear_winner():
    opts = [(0, "Restart the printer and print a test page"), (1, "Replace the monitor cable"), (2, "Reinstall Windows")]
    assert keyword_match("I would restart the printer then print a test page", opts) == 0
    assert keyword_match("no idea at all", opts) is None


def test_personal_data_is_removed_before_matching():
    fake = FakeAI({"option": 0, "sure": True})
    AIService(fake).match_answer("W", OPTIONS, "email me at ali@example.com or call 0300 1234567", "p1")
    assert "ali@example.com" not in fake.calls[0]["prompt"]
    assert "1234567" not in fake.calls[0]["prompt"]
    assert redact("a@b.co") == "[email]"


def test_match_endpoint_without_ai_returns_option_but_no_verdict(tmp_path):
    write(tmp_path, make(reviewed=True))
    client = TestClient(create_app(tmp_path, ai_client=None))
    p = client.get("/problems").json()[0]
    full = client.get(f"/problems/{p['id']}").json()
    words = full["options"][0]["text"]
    r = client.post(f"/problems/{p['id']}/match", json={"text": words}).json()
    assert r["source"] in ("keywords", "none")
    assert set(r) == {"problem_id", "option_id", "option_text", "source"}  # nothing about right or wrong
    assert client.post(f"/problems/{p['id']}/match", json={"text": "x"}).status_code == 422
