"""Daily challenge: the same problems for everyone on a date, chosen from reviewed question tickets."""

from fastapi.testclient import TestClient

from backend.main import DAILY_COUNT, create_app, daily_problem_ids
from tests.test_api import write
from tests.test_validate_problems import make


def bank(tmp_path, n=9):
    for i in range(1, n + 1):
        write(tmp_path, make(id=f"L1-HW-{i:02d}", title=f"Problem {i}", reviewed=True))
    write(tmp_path, make(id="L2-NW-01", level=2, category="Networking and Wi-Fi", title="Level two", reviewed=True))
    write(tmp_path, make(id="L3-NW-01", level=3, category="Networking and Wi-Fi", title="Too hard", reviewed=True))
    write(tmp_path, make(id="L1-HW-20", title="Hands-on one", reviewed=True, hands_on={"faults": ["keyboard_unplugged"], "goal": "keyboard"}))
    write(tmp_path, make(id="L1-HW-21", title="Not reviewed", reviewed=False))
    return TestClient(create_app(tmp_path, ai_client=None))


def test_same_date_same_problems_and_order(tmp_path):
    client = bank(tmp_path)
    a = [p["id"] for p in client.get("/daily/2026-10-16").json()["problems"]]
    b = [p["id"] for p in client.get("/daily/2026-10-16").json()["problems"]]
    assert a == b
    assert len(a) == DAILY_COUNT == len(set(a))


def test_different_dates_usually_differ(tmp_path):
    client = bank(tmp_path)
    days = [f"2026-10-{d:02d}" for d in range(1, 15)]
    sets = {tuple(p["id"] for p in client.get(f"/daily/{d}").json()["problems"]) for d in days}
    assert len(sets) > 10


def test_only_reviewed_question_tickets_at_levels_1_and_2(tmp_path):
    client = bank(tmp_path)
    for d in range(1, 31):
        ids = {p["id"] for p in client.get(f"/daily/2026-11-{d:02d}").json()["problems"]}
        assert not ids & {"L3-NW-01", "L1-HW-20", "L1-HW-21"}


def test_no_answers_are_sent(tmp_path):
    response = bank(tmp_path).get("/daily/2026-10-16")
    assert '"correct"' not in response.text
    assert '"why"' not in response.text
    assert "real_world_tip" not in response.text


def test_bad_dates_are_rejected(tmp_path):
    client = bank(tmp_path)
    assert client.get("/daily/2026-13-40").status_code == 422
    assert client.get("/daily/16-10-2026").status_code == 422
    assert client.get("/daily/today").status_code == 422


def test_small_banks_give_what_they_have():
    problems = [{"id": "L1-HW-01", "level": 1}, {"id": "L1-HW-02", "level": 1}]
    assert sorted(daily_problem_ids(problems, "2026-10-16")) == ["L1-HW-01", "L1-HW-02"]
