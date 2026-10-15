"""Learning corner notes: built only from the reviewed problem file."""

from fastapi.testclient import TestClient

from backend.main import create_app
from tests.test_api import write
from tests.test_validate_problems import make


def test_notes_come_from_the_reviewed_file(tmp_path):
    p = make(reviewed=True)
    write(tmp_path, p)
    client = TestClient(create_app(tmp_path, ai_client=None))
    notes = client.get(f"/problems/{p['id']}/notes").json()
    right = next(o for o in p["options"] if o["correct"])
    assert notes["right_fix"] == right["text"]
    assert notes["why"] == right["why"]
    assert notes["symptom"] == p["symptom"]
    assert notes["tip"] == p.get("real_world_tip")
    assert notes["category"] == p["category"]


def test_unreviewed_and_unknown_problems_have_no_notes(tmp_path):
    p = make(reviewed=False)
    write(tmp_path, p)
    client = TestClient(create_app(tmp_path, ai_client=None))
    assert client.get(f"/problems/{p['id']}/notes").status_code == 404
    assert client.get("/problems/NOPE/notes").status_code == 404
