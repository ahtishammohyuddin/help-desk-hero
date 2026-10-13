import json

from tests.test_validate_problems import VALID, make
from tools.coverage_report import count_problems, main, render


def write(root, problem):
    folder = root / f"level-{problem['level']}"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{problem['id']}.json").write_text(json.dumps(problem), encoding="utf-8")


def test_empty_folder_all_zero(tmp_path):
    counts, skipped = count_problems(tmp_path)
    assert sum(counts.values()) == 0
    assert skipped == []


def test_counts_by_category_and_level(tmp_path):
    write(tmp_path, VALID)  # Hardware L1, reviewed false
    write(tmp_path, make(id="L1-HW-04", title="Second hardware", reviewed=True))
    write(tmp_path, make(id="L2-HW-01", level=2, title="Level two hardware"))
    counts, _ = count_problems(tmp_path)
    assert counts[("Hardware", 1)] == 2
    assert counts[("Hardware", 2)] == 1
    assert counts[("Networking and Wi-Fi", 1)] == 0


def test_reviewed_only(tmp_path):
    write(tmp_path, VALID)
    write(tmp_path, make(id="L1-HW-04", title="Second hardware", reviewed=True))
    counts, _ = count_problems(tmp_path, reviewed_only=True)
    assert counts[("Hardware", 1)] == 1


def test_unreadable_and_unknown_files_are_skipped(tmp_path):
    folder = tmp_path / "level-1"
    folder.mkdir()
    (folder / "broken.json").write_text("{nope", encoding="utf-8")
    (folder / "odd.json").write_text(json.dumps({"category": "Cooking", "level": 1}), encoding="utf-8")
    counts, skipped = count_problems(tmp_path)
    assert sum(counts.values()) == 0
    assert sorted(skipped) == ["level-1/broken.json", "level-1/odd.json"]


def test_render_shows_cells_and_missing(tmp_path):
    write(tmp_path, VALID)
    counts, _ = count_problems(tmp_path)
    text = render(counts)
    assert "drafted / target" in text
    assert "1/8" in text  # Hardware L1
    assert "1/203" in text  # grand total
    assert "Still missing: L1 35, L2 52, L3 47, L4 38, L5 30" in text


def test_render_marks_over_target(tmp_path):
    for n in range(1, 10):  # 9 hardware L1 problems, target is 8
        write(tmp_path, make(id=f"L1-HW-{n:02d}", title=f"Title {n}"))
    counts, _ = count_problems(tmp_path)
    text = render(counts)
    assert "9/8+" in text
    assert "Over target: Hardware L1 (+1)" in text


def test_main_output_and_exit_code(tmp_path, capsys):
    write(tmp_path, VALID)
    assert main([str(tmp_path), "--reviewed"]) == 0
    out = capsys.readouterr().out
    assert "reviewed / target" in out
    assert "0/203" in out


def test_main_missing_folder(tmp_path):
    assert main([str(tmp_path / "nope")]) == 1
