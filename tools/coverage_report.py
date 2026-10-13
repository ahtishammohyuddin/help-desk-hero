"""Coverage report: how many problems exist per category and level versus the targets.

Usage (from the repo root):
    python -m tools.coverage_report               # counts every drafted problem
    python -m tools.coverage_report --reviewed    # counts only reviewed problems (what the game loads)
    python -m tools.coverage_report path/to/problems

Each cell shows  have/target.  A cell with have > target is marked with '+'.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from tools.problem_titles import TARGETS
from tools.validate_problems import CATEGORIES, LEVELS, load_problem_files

Counts = dict[tuple[str, int], int]


def count_problems(root: Path, reviewed_only: bool = False) -> tuple[Counts, list[str]]:
    """Count problems per (category, level).

    Returns (counts, skipped) where skipped lists files that could not be counted
    (bad JSON, unknown category or level). Use the validator to see why.
    """
    counts: Counts = {(c, lv): 0 for c in CATEGORIES for lv in LEVELS}
    skipped: list[str] = []
    for path in load_problem_files(root):
        rel = path.relative_to(root).as_posix()
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            skipped.append(rel)
            continue
        if not isinstance(data, dict):
            skipped.append(rel)
            continue
        key = (data.get("category"), data.get("level"))
        if key not in counts:
            skipped.append(rel)
            continue
        if reviewed_only and data.get("reviewed") is not True:
            continue
        counts[key] += 1
    return counts, skipped


def render(counts: Counts, skipped: list[str] | None = None, reviewed_only: bool = False) -> str:
    name_width = max(len(c) for c in CATEGORIES) + 2
    cell = 7
    label = "reviewed" if reviewed_only else "drafted"
    lines = [f"Coverage ({label} / target)", ""]
    header = "Category".ljust(name_width) + "".join(f"L{lv}".rjust(cell) for lv in LEVELS) + "Total".rjust(cell + 3)
    lines.append(header)
    lines.append("-" * len(header))

    level_have = {lv: 0 for lv in LEVELS}
    level_target = {lv: 0 for lv in LEVELS}
    for category in CATEGORIES:
        row = category.ljust(name_width)
        have_total = target_total = 0
        for lv in LEVELS:
            have = counts[(category, lv)]
            target = TARGETS[category][lv - 1]
            mark = "+" if have > target else ""
            row += f"{have}/{target}{mark}".rjust(cell)
            have_total += have
            target_total += target
            level_have[lv] += have
            level_target[lv] += target
        row += f"{have_total}/{target_total}".rjust(cell + 3)
        lines.append(row)

    lines.append("-" * len(header))
    total_row = "Total".ljust(name_width)
    for lv in LEVELS:
        total_row += f"{level_have[lv]}/{level_target[lv]}".rjust(cell)
    all_have, all_target = sum(level_have.values()), sum(level_target.values())
    total_row += f"{all_have}/{all_target}".rjust(cell + 3)
    lines.append(total_row)
    lines.append("")

    missing = {lv: 0 for lv in LEVELS}
    over: list[str] = []
    for category in CATEGORIES:
        for lv in LEVELS:
            diff = TARGETS[category][lv - 1] - counts[(category, lv)]
            if diff > 0:
                missing[lv] += diff
            elif diff < 0:
                over.append(f"{category} L{lv} (+{-diff})")

    lines.append("Still missing: " + ", ".join(f"L{lv} {missing[lv]}" for lv in LEVELS))
    if all_have >= all_target and not over:
        lines.append("All targets met.")
    if over:
        lines.append("Over target: " + "; ".join(over))
    if skipped:
        lines.append(f"Could not count {len(skipped)} file(s) (run the validator): " + ", ".join(skipped))
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    reviewed_only = "--reviewed" in args
    if reviewed_only:
        args.remove("--reviewed")
    root = Path(args[0]) if args else Path("problems")
    if not root.is_dir():
        print(f"error: {root} is not a directory")
        return 1
    counts, skipped = count_problems(root, reviewed_only)
    print(render(counts, skipped, reviewed_only))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
