import json

from tools.mark_reviewed import main, set_reviewed
from tests.test_validate_problems import VALID


def write_problem(root, problem=None, name=None):
    problem = problem or VALID
    folder = root / f"level-{problem['level']}"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{name or problem['id']}.json"
    path.write_text(json.dumps(problem), encoding="utf-8")
    return path


def reviewed_flag(path):
    return json.loads(path.read_text(encoding="utf-8"))["reviewed"]


def test_set_reviewed_true_and_back(tmp_path):
    path = write_problem(tmp_path)
    assert set_reviewed(path, True) == []
    assert reviewed_flag(path) is True
    assert set_reviewed(path, False) == []
    assert reviewed_flag(path) is False


def test_invalid_problem_is_not_marked(tmp_path):
    bad = json.loads(json.dumps(VALID))
    bad["options"][0]["correct"] = False  # now zero correct options
    path = write_problem(tmp_path, bad)
    assert set_reviewed(path, True)  # returns errors
    assert reviewed_flag(path) is False


def test_main_by_id(tmp_path, capsys):
    path = write_problem(tmp_path)
    assert main(["L1-HW-03"], root=tmp_path) == 0
    assert reviewed_flag(path) is True
    assert "reviewed: L1-HW-03" in capsys.readouterr().out


def test_main_unknown_id(tmp_path, capsys):
    write_problem(tmp_path)
    assert main(["L9-XX-99"], root=tmp_path) == 1
    assert "not found: L9-XX-99" in capsys.readouterr().out


def test_main_all_in_folder(tmp_path):
    first = write_problem(tmp_path)
    other = json.loads(json.dumps(VALID))
    other["id"], other["title"] = "L1-HW-04", "Another title"
    second = write_problem(tmp_path, other)
    assert main(["--all-in", str(tmp_path / "level-1")], root=tmp_path) == 0
    assert reviewed_flag(first) and reviewed_flag(second)


def test_main_undo(tmp_path):
    path = write_problem(tmp_path)
    main(["L1-HW-03"], root=tmp_path)
    assert main(["--undo", "L1-HW-03"], root=tmp_path) == 0
    assert reviewed_flag(path) is False


def test_main_without_arguments_shows_usage(capsys):
    assert main([]) == 1
    assert "Usage" in capsys.readouterr().out
