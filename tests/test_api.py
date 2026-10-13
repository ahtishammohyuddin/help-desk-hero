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
    assert set(first) == {"id", "level", "category", "title"}


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
