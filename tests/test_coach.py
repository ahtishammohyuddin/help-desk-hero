"""End-of-shift coach. None of these call the real Gemini API."""

import pytest
from fastapi.testclient import TestClient

from backend.ai_service import AIService, coach_facts, fallback_coach_message
from backend.main import create_app
from tests.test_ai import FakeAI
from tests.test_api import write
from tests.test_validate_problems import make

TIP = make()["real_world_tip"]

SHIFT = {
    "handled": 5, "solved": 4, "first_try": 3, "failed": 1, "overdue": 1, "left_open": 0,
    "topics": [
        {"category": "Hardware", "total": 3, "first_try": 3},
        {"category": "Networking and Wi-Fi", "total": 2, "first_try": 0},
    ],
    "missed": [],
}


@pytest.fixture
def folder(tmp_path):
    write(tmp_path, make(reviewed=True))  # L1-HW-03, Hardware, has a tip
    write(tmp_path, make(id="L2-NW-01", level=2, category="Networking and Wi-Fi", title="Slow Wi-Fi",
                         real_world_tip="Walk the area and note the signal bars.", reviewed=True))
    write(tmp_path, make(id="L1-HW-05", title="Not reviewed", real_world_tip="Secret tip", reviewed=False))
    return tmp_path


def client_with(folder, ai):
    return TestClient(create_app(folder, ai_client=ai))


# ---------- facts are worked out without AI ----------

def test_facts_find_strongest_and_weakest_topics():
    f = coach_facts(SHIFT)
    assert f["rate"] == 60
    assert f["strongest"]["category"] == "Hardware"
    assert f["weakest"]["category"] == "Networking and Wi-Fi"


def test_topics_with_one_ticket_are_not_judged():
    f = coach_facts({**SHIFT, "topics": [{"category": "Hardware", "total": 1, "first_try": 0}]})
    assert f["strongest"] is None and f["weakest"] is None


def test_fallback_message_uses_only_the_numbers():
    text = fallback_coach_message(coach_facts(SHIFT))
    assert "You solved 4 of 5 tickets, 60% right first time." in text
    assert "Hardware went well: 3 of 3" in text
    assert "Networking and Wi-Fi is worth practising" in text
    assert "1 answered late" in text
    quiet = fallback_coach_message(coach_facts({**SHIFT, "handled": 0, "solved": 0, "first_try": 0, "topics": []}))
    assert "quiet shift" in quiet.lower()


# ---------- the endpoint ----------

def test_coach_without_ai_uses_the_fallback_and_real_tips(folder):
    body = client_with(folder, None).post("/coach", json={**SHIFT, "missed": ["L2-NW-01"]}).json()
    assert body["source"] == "fallback"
    assert body["message"].startswith("You solved 4 of 5")
    assert body["tips"] == [{"problem_title": "Slow Wi-Fi", "tip": "Walk the area and note the signal bars."}]


def test_tips_never_come_from_unreviewed_or_unknown_problems(folder):
    body = client_with(folder, None).post("/coach", json={**SHIFT, "missed": ["L1-HW-05", "L9-XX-99"]}).json()
    assert all(t["tip"] != "Secret tip" for t in body["tips"])
    # The topic to practise still gives a real tip.
    assert body["tips"][0]["problem_title"] == "Slow Wi-Fi"


def test_coach_uses_ai_words_with_facts_and_tips_only(folder):
    fake = FakeAI({"message": "Hardware went really well today. On networking, walk the area and note the signal bars before reporting."})
    body = client_with(folder, fake).post("/coach", json={**SHIFT, "missed": ["L2-NW-01"]}).json()
    assert body["source"] == "ai"
    assert body["message"].startswith("Hardware went really well")
    prompt = fake.calls[0]["prompt"]
    assert "Right first time: 3 (60%)" in prompt
    assert "Walk the area and note the signal bars." in prompt
    assert "Secret tip" not in prompt
    assert "never add other technical" in fake.calls[0]["system"]


def test_bad_ai_replies_fall_back(folder):
    for reply in ({"message": "short"}, {"message": "x" * 700}, {"wrong": "shape"}):
        body = client_with(folder, FakeAI(reply)).post("/coach", json=SHIFT).json()
        assert body["source"] == "fallback", reply


def test_same_shift_numbers_reuse_the_cached_note(folder):
    fake = FakeAI({"message": "A solid shift with good hardware work. Practise networking next."})
    client = client_with(folder, fake)
    assert client.post("/coach", json=SHIFT).json()["source"] == "ai"
    assert client.post("/coach", json=SHIFT).json()["source"] == "cache"
    assert len(fake.calls) == 1


def test_quiet_shift_never_calls_the_ai(folder):
    fake = FakeAI({"message": "This should not be used at all, ever."})
    quiet = {**SHIFT, "handled": 0, "solved": 0, "first_try": 0, "failed": 0, "overdue": 0, "topics": []}
    assert client_with(folder, fake).post("/coach", json=quiet).json()["source"] == "fallback"
    assert fake.calls == []


@pytest.mark.parametrize("change", [
    {"topics": [{"category": "Cooking", "total": 1, "first_try": 1}]},
    {"topics": [{"category": "Hardware", "total": 1, "first_try": 2}]},
    {"handled": -1},
    {"missed": ["x"] * 21},
])
def test_bad_input_is_rejected(folder, change):
    assert client_with(folder, None).post("/coach", json={**SHIFT, **change}).status_code == 422


def test_service_alone(folder):
    message, source = AIService(None).coach(coach_facts(SHIFT), [], "p1")
    assert source == "fallback" and "60%" in message
