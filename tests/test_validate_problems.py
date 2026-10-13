import copy
import json
from pathlib import Path

import pytest

from tools.validate_problems import main, validate_directory, validate_problem

VALID = {
    "id": "L1-HW-03",
    "level": 1,
    "category": "Hardware",
    "title": "Black screen, PC running",
    "character": {"name": "Ahmed", "department": "Accounts", "personality": "polite, rushed"},
    "symptom": "Screen is black but the computer fans are running",
    "user_description": "My screen just went black but I can hear the computer is still on!",
    "options": [
        {
            "text": "Check the monitor power and cable",
            "correct": True,
            "why": "Fans running means the PC is on. Check physical connections first.",
        },
        {
            "text": "Reinstall Windows",
            "correct": False,
            "why": "Far too drastic. Never start with the most destructive fix.",
        },
        {
            "text": "Restart the computer",
            "correct": False,
            "why": "Might work by luck, but skips the real cause.",
        },
    ],
    "hints": ["Is the computer itself on?", "What connects the PC to the screen?"],
    "real_world_tip": "Check the cable before anything else.",
    "reviewed": False,
}


def make(**changes):
    problem = copy.deepcopy(VALID)
    problem.update(changes)
    return problem


def write(root: Path, problem: dict, name: str | None = None) -> None:
    folder = root / f"level-{problem['level']}"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{name or problem['id']}.json").write_text(json.dumps(problem), encoding="utf-8")


def has_error(errors, text):
    return any(text in e for e in errors)


# ---------- single problem ----------

def test_valid_problem_passes():
    assert validate_problem(VALID) == []


def test_real_world_tip_is_optional():
    problem = make()
    del problem["real_world_tip"]
    assert validate_problem(problem) == []


def test_non_object_rejected():
    assert validate_problem([1, 2]) == ["problem must be a JSON object"]


@pytest.mark.parametrize("field", ["id", "level", "category", "title", "options", "hints", "reviewed"])
def test_missing_required_field(field):
    problem = make()
    del problem[field]
    assert has_error(validate_problem(problem), f"missing required field '{field}'")


@pytest.mark.parametrize("level", [0, 6, "1", 1.5, True, None])
def test_bad_level(level):
    assert has_error(validate_problem(make(level=level)), "level must be an integer 1-5")


def test_unknown_category():
    assert has_error(validate_problem(make(category="Cooking")), "unknown category")


@pytest.mark.parametrize("bad_id", ["L1-HW-3", "l1-hw-03", "L1-HW03", "HW-03", "L9-HW-03", ""])
def test_bad_id_format(bad_id):
    assert validate_problem(make(id=bad_id))


def test_id_level_must_match_level_field():
    assert has_error(validate_problem(make(id="L2-HW-03")), "level field is 1")


def test_id_code_must_match_category():
    assert has_error(validate_problem(make(id="L1-NW-03")), "should use HW")


def test_too_few_options():
    problem = make()
    problem["options"] = problem["options"][:2]
    assert has_error(validate_problem(problem), "must have 3-4 options")


def test_too_many_options():
    problem = make()
    extra = [{"text": f"Extra {i}", "correct": False, "why": "No."} for i in range(3)]
    problem["options"] = problem["options"] + extra
    assert has_error(validate_problem(problem), "must have 3-4 options")


def test_four_options_is_fine():
    problem = make()
    problem["options"].append({"text": "Call the vendor", "correct": False, "why": "Too early."})
    assert validate_problem(problem) == []


def test_no_correct_option():
    problem = make()
    problem["options"][0]["correct"] = False
    assert has_error(validate_problem(problem), "exactly one correct option, found 0")


def test_two_correct_options():
    problem = make()
    problem["options"][1]["correct"] = True
    assert has_error(validate_problem(problem), "exactly one correct option, found 2")


def test_correct_must_be_boolean():
    problem = make()
    problem["options"][0]["correct"] = "yes"
    assert has_error(validate_problem(problem), "'correct' must be true or false")


def test_option_needs_why():
    problem = make()
    problem["options"][1]["why"] = "  "
    assert has_error(validate_problem(problem), "'why' explanation")


def test_duplicate_option_text():
    problem = make()
    problem["options"][2]["text"] = "reinstall windows"
    assert has_error(validate_problem(problem), "duplicate option text")


def test_empty_hints_rejected():
    assert has_error(validate_problem(make(hints=[])), "hints must be a non-empty list")


def test_blank_hint_rejected():
    assert has_error(validate_problem(make(hints=["ok", ""])), "every hint")


def test_character_fields_required():
    problem = make(character={"name": "Ahmed"})
    errors = validate_problem(problem)
    assert has_error(errors, "character.department")
    assert has_error(errors, "character.personality")


def test_reviewed_must_be_boolean():
    assert has_error(validate_problem(make(reviewed="true")), "reviewed must be true or false")


def test_blank_tip_rejected():
    assert has_error(validate_problem(make(real_world_tip="")), "real_world_tip")


# ---------- whole directory ----------

def test_directory_all_valid(tmp_path):
    write(tmp_path, VALID)
    other = make(id="L1-HW-04", title="Mouse not moving")
    write(tmp_path, other)
    assert validate_directory(tmp_path) == {}


def test_directory_invalid_json(tmp_path):
    folder = tmp_path / "level-1"
    folder.mkdir()
    (folder / "broken.json").write_text("{not json", encoding="utf-8")
    results = validate_directory(tmp_path)
    assert has_error(results["level-1/broken.json"], "invalid JSON")


def test_directory_duplicate_ids(tmp_path):
    write(tmp_path, VALID)
    dup = make(title="A different title")
    write(tmp_path, dup, name="L1-HW-03-copy")
    results = validate_directory(tmp_path)
    assert has_error(results["level-1/L1-HW-03.json"], "duplicate id")
    assert has_error(results["level-1/L1-HW-03-copy.json"], "duplicate id")


def test_directory_duplicate_titles(tmp_path):
    write(tmp_path, VALID)
    write(tmp_path, make(id="L1-HW-04", title="  black SCREEN, pc running "))
    results = validate_directory(tmp_path)
    assert has_error(results["level-1/L1-HW-03.json"], "duplicate title")
    assert has_error(results["level-1/L1-HW-04.json"], "duplicate title")


def test_directory_filename_must_match_id(tmp_path):
    write(tmp_path, VALID, name="wrong-name")
    results = validate_directory(tmp_path)
    assert has_error(results["level-1/wrong-name.json"], "must match id")


# ---------- command line ----------

def test_main_returns_zero_when_valid(tmp_path, capsys):
    write(tmp_path, VALID)
    assert main([str(tmp_path)]) == 0
    assert "1 valid, 0 invalid, 1 total" in capsys.readouterr().out


def test_main_returns_one_when_invalid(tmp_path, capsys):
    bad = make()
    bad["options"][0]["correct"] = False
    write(tmp_path, bad)
    assert main([str(tmp_path)]) == 1
    assert "FAIL" in capsys.readouterr().out


def test_main_missing_directory(tmp_path):
    assert main([str(tmp_path / "nope")]) == 1
