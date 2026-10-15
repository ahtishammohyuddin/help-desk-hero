import json

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from backend.problems import ProblemStore
from tests.test_validate_problems import VALID, make


def write(root, problem):
    folder = root / f"level-{problem['level']}"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{problem['id']}.json").write_text(json.dumps(problem), encoding="utf-8")


@pytest.fixture
def problems_dir(tmp_path):
    write(tmp_path, make(reviewed=True))  # L1-HW-03, Hardware, level 1
    write(tmp_path, make(id="L1-HW-04", title="Mouse frozen", reviewed=True))
    write(
        tmp_path,
        make(id="L2-NW-01", level=2, category="Networking and Wi-Fi", title="Slow Wi-Fi", reviewed=True),
    )
    write(tmp_path, make(id="L1-HW-05", title="Not reviewed yet", reviewed=False))
    return tmp_path


@pytest.fixture
def client(problems_dir):
    # ai_client=None: fallback mode, so tests never depend on a real API key.
    return TestClient(create_app(problems_dir, ai_client=None))


# ---------- store ----------

def test_store_only_loads_reviewed(problems_dir):
    store = ProblemStore(problems_dir)
    assert len(store) == 3
    assert store.unreviewed_count == 1
    assert store.get("L1-HW-05") is None


def test_store_skips_reviewed_but_invalid(tmp_path):
    broken = make(reviewed=True)
    broken["options"][0]["correct"] = False  # now no correct answer
    write(tmp_path, broken)
    store = ProblemStore(tmp_path)
    assert len(store) == 0
    assert store.skipped == ["L1-HW-03.json"]


def test_store_handles_missing_folder(tmp_path):
    assert len(ProblemStore(tmp_path / "nope")) == 0


def test_store_skips_unreadable_json(tmp_path):
    (tmp_path / "bad.json").write_text("{nope", encoding="utf-8")
    store = ProblemStore(tmp_path)
    assert len(store) == 0
    assert store.skipped == ["bad.json"]


# ---------- health ----------

def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "problems_loaded": 3, "ai_enabled": False}


# ---------- list ----------

def test_list_returns_reviewed_only_sorted(client):
    ids = [p["id"] for p in client.get("/problems").json()]
    assert ids == ["L1-HW-03", "L1-HW-04", "L2-NW-01"]


def test_list_filters_by_level(client):
    ids = [p["id"] for p in client.get("/problems", params={"level": 2}).json()]
    assert ids == ["L2-NW-01"]


def test_list_filters_by_category(client):
    ids = [p["id"] for p in client.get("/problems", params={"category": "Hardware"}).json()]
    assert ids == ["L1-HW-03", "L1-HW-04"]


def test_list_rejects_bad_level(client):
    assert client.get("/problems", params={"level": 9}).status_code == 422


def test_list_summary_has_no_answers(client):
    first = client.get("/problems").json()[0]
    assert set(first) == {"id", "level", "category", "title", "character_name", "gender"}
    assert first["character_name"] == "Ahmed" and first["gender"] == "male"


# ---------- single problem ----------

def test_get_problem_hides_all_answer_data(client):
    data = client.get("/problems/L1-HW-03").json()
    text = json.dumps(data)
    for secret in ("correct", "why", "hints\"", "symptom", "real_world_tip", "reviewed"):
        assert secret not in text
    assert data["hint_count"] == 2
    assert data["character"]["name"] == "Ahmed"
    assert data["user_description"].startswith("My screen just went black")


def test_get_problem_options_keep_original_ids(client):
    data = client.get("/problems/L1-HW-03").json()
    by_id = {o["id"]: o["text"] for o in data["options"]}
    assert by_id == {
        0: "Check the monitor power and cable",
        1: "Reinstall Windows",
        2: "Restart the computer",
    }


def test_unreviewed_problem_is_not_served(client):
    assert client.get("/problems/L1-HW-05").status_code == 404


def test_unknown_problem_404(client):
    assert client.get("/problems/L9-XX-99").status_code == 404


# ---------- answers ----------

def test_correct_answer(client):
    response = client.post("/problems/L1-HW-03/answer", json={"option_id": 0})
    assert response.status_code == 200
    body = response.json()
    assert body["is_correct"] is True
    assert body["correct_option_id"] == 0
    assert len(body["explanations"]) == 3
    assert body["real_world_tip"] == "Check the cable before anything else."


def test_wrong_answer_explains_everything(client):
    body = client.post("/problems/L1-HW-03/answer", json={"option_id": 1}).json()
    assert body["is_correct"] is False
    assert body["chosen_option_id"] == 1
    assert body["correct_option_id"] == 0
    chosen = next(e for e in body["explanations"] if e["option_id"] == 1)
    assert chosen["correct"] is False
    assert "drastic" in chosen["why"]


@pytest.mark.parametrize("option_id", [-1, 3, 99])
def test_answer_unknown_option_is_400(client, option_id):
    assert client.post("/problems/L1-HW-03/answer", json={"option_id": option_id}).status_code == 400


def test_answer_bad_body_is_422(client):
    assert client.post("/problems/L1-HW-03/answer", json={"option_id": "first"}).status_code == 422
    assert client.post("/problems/L1-HW-03/answer", json={}).status_code == 422


def test_answer_unreviewed_is_404(client):
    assert client.post("/problems/L1-HW-05/answer", json={"option_id": 0}).status_code == 404


# ---------- hints ----------

def test_hints_are_progressive(client):
    first = client.get("/problems/L1-HW-03/hints/1").json()
    second = client.get("/problems/L1-HW-03/hints/2").json()
    assert first == {
        "problem_id": "L1-HW-03",
        "number": 1,
        "total": 2,
        "hint": "Is the computer itself on?",
    }
    assert second["hint"] == "What connects the PC to the screen?"


def test_no_hint_beyond_the_last(client):
    assert client.get("/problems/L1-HW-03/hints/3").status_code == 404


def test_hint_number_must_be_positive(client):
    assert client.get("/problems/L1-HW-03/hints/0").status_code == 422


def test_hint_for_unreviewed_is_404(client):
    assert client.get("/problems/L1-HW-05/hints/1").status_code == 404


# ---------- CORS ----------

def test_cors_allows_configured_origin(problems_dir, monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://my-game.netlify.app")
    client = TestClient(create_app(problems_dir, ai_client=None))
    allowed = client.get("/health", headers={"Origin": "https://my-game.netlify.app"})
    assert allowed.headers["access-control-allow-origin"] == "https://my-game.netlify.app"
    other = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in other.headers


# ---------- second chance (/check) ----------

def test_check_correct_first_try_reveals_everything(client):
    body = client.post("/problems/L1-HW-03/check", json={"option_id": 0, "attempt": 1}).json()
    assert body["is_correct"] is True and body["final"] is True
    assert body["correct_option_id"] == 0
    assert len(body["explanations"]) == 3
    assert body["hint"] is None


def test_check_wrong_first_try_hides_the_answer(client):
    response = client.post("/problems/L1-HW-03/check", json={"option_id": 1, "attempt": 1, "next_hint": 1})
    body = response.json()
    assert body["is_correct"] is False
    assert body["final"] is False
    assert body["attempts_left"] == 1
    assert "drastic" in body["chosen_why"]
    assert body["hint"] == "Is the computer itself on?"
    # Nothing that identifies the correct option may be sent before the final try.
    assert body["correct_option_id"] is None
    assert body["explanations"] is None
    assert "Check the monitor power and cable" not in response.text


def test_check_hint_number_follows_hints_already_seen(client):
    body = client.post("/problems/L1-HW-03/check", json={"option_id": 1, "attempt": 1, "next_hint": 2}).json()
    assert body["hint"] == "What connects the PC to the screen?"
    body = client.post("/problems/L1-HW-03/check", json={"option_id": 1, "attempt": 1, "next_hint": 3}).json()
    assert body["hint"] is None  # no hints left, still no answer revealed
    assert body["correct_option_id"] is None


def test_check_second_try_correct(client):
    body = client.post("/problems/L1-HW-03/check", json={"option_id": 0, "attempt": 2}).json()
    assert body["is_correct"] is True and body["final"] is True and body["attempt"] == 2


def test_check_wrong_last_try_reveals_answer(client):
    body = client.post("/problems/L1-HW-03/check", json={"option_id": 2, "attempt": 2}).json()
    assert body["is_correct"] is False and body["final"] is True
    assert body["correct_option_id"] == 0
    assert body["attempts_left"] == 0


@pytest.mark.parametrize("payload", [{"option_id": 0, "attempt": 0}, {"option_id": 0, "attempt": 3}, {"attempt": 1}])
def test_check_validates_input(client, payload):
    assert client.post("/problems/L1-HW-03/check", json=payload).status_code == 422


def test_check_unknown_option_and_unreviewed(client):
    assert client.post("/problems/L1-HW-03/check", json={"option_id": 7}).status_code == 400
    assert client.post("/problems/L1-HW-05/check", json={"option_id": 0}).status_code == 404


# ---------- physical steps ----------

STEPS = [{"place": "parts_cabinet", "action": "Take a spare video cable"}]


@pytest.fixture
def physical_client(tmp_path):
    write(tmp_path, make(reviewed=True, physical_steps=STEPS))
    return TestClient(create_app(tmp_path, ai_client=None))


def test_physical_steps_only_come_with_a_right_answer(physical_client):
    # Never in the ticket itself: the steps would give the answer away.
    assert "physical_steps" not in physical_client.get("/problems/L1-HW-03").text
    assert "spare video cable" not in physical_client.get("/problems/L1-HW-03").text
    wrong = physical_client.post("/problems/L1-HW-03/check", json={"option_id": 1, "attempt": 1}).json()
    assert wrong["physical_steps"] is None
    last_wrong = physical_client.post("/problems/L1-HW-03/check", json={"option_id": 1, "attempt": 2}).json()
    assert last_wrong["physical_steps"] is None
    right = physical_client.post("/problems/L1-HW-03/check", json={"option_id": 0, "attempt": 1}).json()
    assert right["physical_steps"] == STEPS


def test_problems_without_steps_send_none(client):
    body = client.post("/problems/L1-HW-03/check", json={"option_id": 0, "attempt": 1}).json()
    assert body["physical_steps"] is None
