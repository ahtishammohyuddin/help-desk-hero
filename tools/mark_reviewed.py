"""Mark problems as human-reviewed (sets "reviewed": true).

Usage (from the repo root):
    python -m tools.mark_reviewed L1-HW-01 L1-HW-02     # specific ids
    python -m tools.mark_reviewed --all-in problems/level-1   # every problem in a folder
    python -m tools.mark_reviewed --undo L1-HW-01       # set back to false

A problem is only marked reviewed if it still passes validation.
Run this only AFTER you have actually read and approved the problem.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from tools.validate_problems import load_problem_files, validate_problem


def set_reviewed(path: Path, value: bool) -> list[str]:
    """Set the reviewed flag in one file. Returns errors (empty list on success)."""
    data = json.loads(path.read_text(encoding="utf-8"))
    errors = validate_problem(data)
    if errors:
        return errors
    data["reviewed"] = value
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return []


def find_by_ids(root: Path, ids: list[str]) -> tuple[list[Path], list[str]]:
    """Return (matching files, ids that were not found)."""
    by_stem = {p.stem: p for p in load_problem_files(root)}
    found = [by_stem[i] for i in ids if i in by_stem]
    missing = [i for i in ids if i not in by_stem]
    return found, missing


def main(argv: list[str] | None = None, root: Path = Path("problems")) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    value = True
    if "--undo" in args:
        args.remove("--undo")
        value = False

    if args and args[0] == "--all-in":
        if len(args) != 2:
            print("usage: --all-in <folder>")
            return 1
        folder = Path(args[1])
        if not folder.is_dir():
            print(f"error: {folder} is not a directory")
            return 1
        files, missing = load_problem_files(folder), []
    elif args:
        files, missing = find_by_ids(root, args)
    else:
        print(__doc__)
        return 1

    failed = bool(missing)
    for item in missing:
        print(f"not found: {item}")

    for path in files:
        errors = set_reviewed(path, value)
        if errors:
            failed = True
            print(f"SKIPPED {path.stem} (fails validation)")
            for message in errors:
                print(f"  - {message}")
        else:
            print(f"{'reviewed' if value else 'un-reviewed'}: {path.stem}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
