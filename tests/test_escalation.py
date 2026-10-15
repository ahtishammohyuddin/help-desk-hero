"""Escalation: after the right answer, pick the right team and the right details to send.

The answers live in the reviewed problem file; the server checks them. No AI is involved.
"""

import copy

from fastapi.testclient import TestClient

from backend.main import create_app
from tests.test_api import write
from tests.test_validate_problems import has_error, make
from tools.validate_problems import ESCALATION_TEAMS, validate_problem

ESCALATION = {
    "team": "network",
    "team_why": "The network team runs DHCP.",
    "details": [
        {"text": "Which floor is affected", "send": True, "why": "Shows the size of the problem."},
        {"text": "When it started", "send": True, "why": "Matches it to a change."},
        {"text": "Everyone's passwords", "send": False, "why": "Never share passwords."},
        {"text": "Favourite websites", "send": False, "why": "Not related."},
    ],
}


def escalated(**changes):
    return make(id="L3-NW-01", level=3, category="Networking and Wi-Fi", title="Floor offline",
                reviewed=True, escalation=copy.deepcopy(ESCALATION), **changes)


def client_for(tmp_path, *problems):
    for p in problems:
        write(tmp_path, p)
    return TestClient(create_app(tmp_path, ai_client=None))


def correct_option(problem):
    return next(i for i, o in enumerate(problem["options"]) if o["correct"])


def wrong_option(problem):
    return next(i for i, o in enumerate(problem["options"]) if not o["correct"])


# ---------- validator ----------

def test_valid_escalation_passes():
    assert validate_problem(escalated()) == []


def test_unknown_team_rejected():
    p = escalated()
    p["escalation"]["team"] = "helpdesk"
    assert has_error(validate_problem(p), "escalation.team")


def test_needs_details_to_send_and_not_to_send():
    p = escalated()
    for d in p["escalation"]["details"]:
        d["send"] = True
    assert has_error(validate_problem(p), "at least one detail to send and one not to send")


def test_detail_count_limits():
    p = escalated()
    p["escalation"]["details"] = p["escalation"]["details"][:2]
    assert has_error(validate_problem(p), "escalation.details must be a list")


def test_detail_fields_checked_and_no_repeats():
    p = escalated()
    p["escalation"]["details"][0]["why"] = ""
    p["escalation"]["details"][1]["text"] = "Which floor is affected"
    errors = validate_problem(p)
    assert has_error(errors, "detail 1: why")
    assert has_error(errors, "repeated text")


def test_cannot_combine_with_hands_on():
    p = escalated(hands_on={"faults": ["keyboard_unplugged"], "goal": "keyboard"})
    assert has_error(validate_problem(p), "cannot be combined")


# ---------- API ----------

def test_form_only_after_right_answer_and_without_answers(tmp_path):
    p = escalated()
    client = client_for(tmp_path, p)
    wrong = client.post("/problems/L3-NW-01/check", json={"option_id": wrong_option(p), "attempt": 1}).json()
    assert wrong["escalation"] is None
    right = client.post("/problems/L3-NW-01/check", json={"option_id": correct_option(p), "attempt": 1}).json()
    form = right["escalation"]
    assert {t["id"] for t in form["teams"]} == set(ESCALATION_TEAMS)
    assert sorted(d["id"] for d in form["details"]) == [0, 1, 2, 3]
    assert all(set(d) == {"id", "text"} for d in form["details"])  # no "send" or "why"
    assert "network" not in str(form["details"])


def test_problem_without_escalation_sends_no_form(tmp_path):
    p = make(reviewed=True)
    client = client_for(tmp_path, p)
    right = client.post(f"/problems/{p['id']}/check", json={"option_id": correct_option(p), "attempt": 1}).json()
    assert right["escalation"] is None
    assert client.post(f"/problems/{p['id']}/escalate", json={"team": "network", "details": []}).status_code == 404


def test_perfect_escalation(tmp_path):
    client = client_for(tmp_path, escalated())
    r = client.post("/problems/L3-NW-01/escalate", json={"team": "network", "details": [1, 0]}).json()
    assert r["perfect"] and r["team_correct"]
    assert r["correct_team"] == {"id": "network", "name": "Network team"}
    assert [d["chosen"] for d in r["details"]] == [True, True, False, False]
    assert all(d["why"] for d in r["details"])


def test_wrong_team_is_not_perfect(tmp_path):
    client = client_for(tmp_path, escalated())
    r = client.post("/problems/L3-NW-01/escalate", json={"team": "security", "details": [0, 1]}).json()
    assert not r["perfect"] and not r["team_correct"]
    assert r["chosen_team"] == "security"
    assert r["team_why"]


def test_trap_or_missing_detail_is_not_perfect(tmp_path):
    client = client_for(tmp_path, escalated())
    trap = client.post("/problems/L3-NW-01/escalate", json={"team": "network", "details": [0, 1, 2]}).json()
    missing = client.post("/problems/L3-NW-01/escalate", json={"team": "network", "details": [0]}).json()
    assert trap["team_correct"] and not trap["perfect"]
    assert not missing["perfect"]


def test_bad_input_rejected(tmp_path):
    client = client_for(tmp_path, escalated())
    assert client.post("/problems/L3-NW-01/escalate", json={"team": "helpdesk", "details": []}).status_code == 400
    assert client.post("/problems/L3-NW-01/escalate", json={"team": "network", "details": [9]}).status_code == 400
    assert client.post("/problems/L3-NW-01/escalate", json={"team": "network", "details": list(range(11))}).status_code == 422
    assert client.post("/problems/NOPE/escalate", json={"team": "network", "details": []}).status_code == 404
