from tools.problem_titles import TARGETS, TITLES, all_entries, problem_id
from tools.validate_problems import CATEGORIES, ID_PATTERN


def test_every_category_has_targets_and_titles():
    assert set(TITLES) == set(CATEGORIES)
    assert set(TARGETS) == set(CATEGORIES)


def test_counts_match_targets_per_cell():
    for category, targets in TARGETS.items():
        for level, target in enumerate(targets, start=1):
            assert len(TITLES[category][level]) == target, (category, level)


def test_target_totals_match_brief():
    per_level = [sum(TARGETS[c][i] for c in TARGETS) for i in range(5)]
    assert per_level == [36, 58, 49, 38, 30]
    assert len(all_entries()) == 211


def test_titles_unique_ignoring_case():
    titles = [e["title"].strip().lower() for e in all_entries()]
    assert len(titles) == len(set(titles))


def test_ids_unique_and_valid():
    ids = [e["id"] for e in all_entries()]
    assert len(ids) == len(set(ids))
    assert all(ID_PATTERN.match(i) for i in ids)


def test_example_problem_id_matches_title_list():
    # problems/level-1/L1-HW-03.json is the example from the brief.
    assert problem_id(1, "Hardware", 3) == "L1-HW-03"
    assert TITLES["Hardware"][1][2] == "Black screen, PC running"


def test_problem_files_match_planned_titles():
    """Every problem file in the repo must use the title approved in the title list."""
    import json
    from pathlib import Path

    planned = {e["id"]: e for e in all_entries()}
    root = Path(__file__).resolve().parent.parent / "problems"
    for path in sorted(root.rglob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        entry = planned.get(data["id"])
        assert entry is not None, f"{path.name}: id is not in the planned title list"
        assert data["title"] == entry["title"], f"{path.name}: title differs from the planned title"
        assert data["level"] == entry["level"] and data["category"] == entry["category"], path.name
