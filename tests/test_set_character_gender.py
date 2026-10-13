import json

from tests.test_validate_problems import make
from tools.set_character_gender import GENDER, main


def write(root, problem):
    folder = root / "level-1"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{problem['id']}.json"
    path.write_text(json.dumps(problem), encoding="utf-8")
    return path


def test_adds_gender_and_keeps_review_flag(tmp_path):
    problem = make(reviewed=True)
    del problem["character"]["gender"]
    path = write(tmp_path, problem)
    assert main([], root=tmp_path) == 0
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["character"]["gender"] == "male"
    assert data["reviewed"] is True


def test_check_mode_changes_nothing(tmp_path):
    problem = make()
    del problem["character"]["gender"]
    path = write(tmp_path, problem)
    assert main(["--check"], root=tmp_path) == 0
    assert "gender" not in json.loads(path.read_text(encoding="utf-8"))["character"]


def test_unknown_name_is_reported(tmp_path, capsys):
    problem = make()
    problem["character"]["name"] = "Zorblax"
    write(tmp_path, problem)
    assert main([], root=tmp_path) == 1
    assert "Zorblax" in capsys.readouterr().out


def test_no_name_is_listed_twice():
    from tools.set_character_gender import FEMALE, MALE
    assert not set(FEMALE) & set(MALE)
    assert len(GENDER) == len(FEMALE) + len(MALE)
