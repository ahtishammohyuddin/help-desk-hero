"""Problem bank validator for Help Desk Hero.

Checks every problem JSON file against the schema and the bank-wide rules:
  - required fields and types
  - 3 to 4 options, exactly one correct, every option has a "why"
  - id format (L<level>-<CAT>-<NN>) matches the level and category fields
  - file name matches the id
  - no duplicate ids or titles across the bank
  - optional physical_steps: 1-3 steps, each with a known place and an action
  - optional hands_on: known faults that all break the goal, and valid required actions

Usage (from the repo root):
    python -m tools.validate_problems            # validates ./problems
    python -m tools.validate_problems path/to/dir
Exit code is 0 when everything is valid, 1 otherwise.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Category name -> short code used in problem ids.
CATEGORIES: dict[str, str] = {
    "Hardware": "HW",
    "Printers and scanners": "PR",
    "Windows and OS": "OS",
    "Accounts and passwords": "AC",
    "Email and Outlook / M365": "EM",
    "Networking and Wi-Fi": "NW",
    "Software and installs": "SW",
    "Security and phishing": "SC",
    "Mobile and phones": "MB",
    "Servers, backups, Active Directory": "SV",
    "Customer handling": "CH",
}

LEVELS = (1, 2, 3, 4, 5)
# Places in the office a physical fix can send the player to (see game/src/office.js).
PLACES = ("printer", "parts_cabinet", "server_room")
MAX_PHYSICAL_STEPS = 3

# Hands-on scenarios: what is broken (fault -> the symptom it causes), what must work again (goal),
# and extra actions the player must do before the ticket closes. The game simulates these.
HANDS_ON_FAULTS: dict[str, str] = {
    "network_cable_loose": "internet",  # network cable half out at the PC
    "wall_cable_loose": "internet",  # network cable loose at the wall port
    "switch_port_dead": "internet",  # this desk's port on the server room switch has no link
    "video_cable_loose": "display",  # monitor on, but its video cable is loose at the PC
    "monitor_power_loose": "display",  # monitor power cable loose, so the monitor is off
    "power_strip_off": "power",  # the power strip switch is off
    "pc_power_loose": "power",  # PC power cable loose at the back of the PC
    "keyboard_unplugged": "keyboard",
    "mouse_unplugged": "mouse",
}
HANDS_ON_GOALS = ("internet", "display", "power", "keyboard", "mouse")
HANDS_ON_REQUIRED = {"report_port": "switch_port_dead"}  # required action -> fault it needs
GENDERS = ("female", "male")
MIN_OPTIONS = 3
MAX_OPTIONS = 4
ID_PATTERN = re.compile(r"^L([1-5])-([A-Z]{2})-(\d{2})$")

REQUIRED_FIELDS = (
    "id",
    "level",
    "category",
    "title",
    "character",
    "symptom",
    "user_description",
    "options",
    "hints",
    "reviewed",
)


def _is_nonempty_str(value: object) -> bool:
    return isinstance(value, str) and value.strip() != ""


def validate_problem(problem: object) -> list[str]:
    """Return a list of error messages for one problem. Empty list means valid."""
    if not isinstance(problem, dict):
        return ["problem must be a JSON object"]

    errors: list[str] = []

    for field in REQUIRED_FIELDS:
        if field not in problem:
            errors.append(f"missing required field '{field}'")
    if errors:
        return errors  # no point checking further

    # --- level and category ---
    level = problem["level"]
    # bool is a subclass of int in Python, so exclude it explicitly.
    if isinstance(level, bool) or not isinstance(level, int) or level not in LEVELS:
        errors.append(f"level must be an integer 1-5, got {level!r}")
        level = None

    category = problem["category"]
    if category not in CATEGORIES:
        errors.append(f"unknown category {category!r}")
        category = None

    # --- id ---
    pid = problem["id"]
    if not _is_nonempty_str(pid):
        errors.append("id must be a non-empty string")
    else:
        match = ID_PATTERN.match(pid)
        if not match:
            errors.append(f"id {pid!r} must look like L1-HW-03")
        else:
            id_level, id_code, _ = match.groups()
            if level is not None and int(id_level) != level:
                errors.append(f"id {pid!r} says level {id_level} but level field is {level}")
            if category is not None and id_code != CATEGORIES[category]:
                errors.append(
                    f"id {pid!r} uses code {id_code} but category {category!r} "
                    f"should use {CATEGORIES[category]}"
                )

    # --- plain text fields ---
    for field in ("title", "symptom", "user_description"):
        if not _is_nonempty_str(problem[field]):
            errors.append(f"{field} must be a non-empty string")

    # --- character ---
    character = problem["character"]
    if not isinstance(character, dict):
        errors.append("character must be an object")
    else:
        for key in ("name", "department", "personality"):
            if not _is_nonempty_str(character.get(key)):
                errors.append(f"character.{key} must be a non-empty string")
        # Used to send the ticket to a matching employee (answer texts say "he"/"she").
        if character.get("gender") not in GENDERS:
            errors.append(f"character.gender must be one of {', '.join(GENDERS)}")

    # --- options ---
    options = problem["options"]
    if not isinstance(options, list):
        errors.append("options must be a list")
    else:
        if not MIN_OPTIONS <= len(options) <= MAX_OPTIONS:
            errors.append(f"must have {MIN_OPTIONS}-{MAX_OPTIONS} options, found {len(options)}")
        correct_count = 0
        seen_texts: set[str] = set()
        for i, option in enumerate(options, start=1):
            if not isinstance(option, dict):
                errors.append(f"option {i} must be an object")
                continue
            if not _is_nonempty_str(option.get("text")):
                errors.append(f"option {i}: text must be a non-empty string")
            else:
                key = option["text"].strip().lower()
                if key in seen_texts:
                    errors.append(f"option {i}: duplicate option text")
                seen_texts.add(key)
            if not isinstance(option.get("correct"), bool):
                errors.append(f"option {i}: 'correct' must be true or false")
            elif option["correct"]:
                correct_count += 1
            if not _is_nonempty_str(option.get("why")):
                errors.append(f"option {i}: 'why' explanation must be a non-empty string")
        if correct_count != 1:
            errors.append(f"must have exactly one correct option, found {correct_count}")

    # --- hints ---
    hints = problem["hints"]
    if not isinstance(hints, list) or not hints:
        errors.append("hints must be a non-empty list")
    elif not all(_is_nonempty_str(h) for h in hints):
        errors.append("every hint must be a non-empty string")

    # --- optional tip ---
    tip = problem.get("real_world_tip")
    if tip is not None and not _is_nonempty_str(tip):
        errors.append("real_world_tip, when present, must be a non-empty string")

    # --- optional physical steps: places to walk to after the right answer ---
    steps = problem.get("physical_steps")
    if steps is not None:
        if not isinstance(steps, list) or not 1 <= len(steps) <= MAX_PHYSICAL_STEPS:
            errors.append(f"physical_steps, when present, must be a list of 1-{MAX_PHYSICAL_STEPS} steps")
        else:
            for i, step in enumerate(steps, start=1):
                if not isinstance(step, dict):
                    errors.append(f"physical step {i} must be an object")
                    continue
                if step.get("place") not in PLACES:
                    errors.append(f"physical step {i}: place must be one of {', '.join(PLACES)}")
                if not _is_nonempty_str(step.get("action")):
                    errors.append(f"physical step {i}: action must be a non-empty string")

    # --- optional hands-on scenario ---
    hands_on = problem.get("hands_on")
    if hands_on is not None:
        errors.extend(_validate_hands_on(hands_on))
        if problem.get("physical_steps") is not None:
            errors.append("use either hands_on or physical_steps, not both")

    # --- reviewed ---
    if not isinstance(problem["reviewed"], bool):
        errors.append("reviewed must be true or false")

    return errors


def _validate_hands_on(hands_on: object) -> list[str]:
    if not isinstance(hands_on, dict):
        return ["hands_on must be an object"]
    errors: list[str] = []
    goal = hands_on.get("goal")
    if goal not in HANDS_ON_GOALS:
        errors.append(f"hands_on.goal must be one of {', '.join(HANDS_ON_GOALS)}")
    faults = hands_on.get("faults")
    if not isinstance(faults, list) or not faults:
        errors.append("hands_on.faults must be a non-empty list")
        faults = []
    for fault in faults:
        if fault not in HANDS_ON_FAULTS:
            errors.append(f"hands_on: unknown fault {fault!r}")
        elif goal in HANDS_ON_GOALS and HANDS_ON_FAULTS[fault] != goal:
            errors.append(f"hands_on: fault {fault!r} breaks {HANDS_ON_FAULTS[fault]}, not the goal {goal!r}")
    if len(set(f for f in faults if isinstance(f, str))) != len(faults):
        errors.append("hands_on.faults has a repeat")
    required = hands_on.get("required", [])
    if not isinstance(required, list):
        errors.append("hands_on.required, when present, must be a list")
        required = []
    for action in required:
        if action not in HANDS_ON_REQUIRED:
            errors.append(f"hands_on: unknown required action {action!r}")
        elif HANDS_ON_REQUIRED[action] not in faults:
            errors.append(f"hands_on: {action!r} needs the fault {HANDS_ON_REQUIRED[action]!r}")
    return errors


def load_problem_files(root: Path) -> list[Path]:
    return sorted(p for p in root.rglob("*.json") if p.is_file())


def validate_directory(root: Path) -> dict[str, list[str]]:
    """Validate every problem file under root.

    Returns a mapping of file path (relative to root) -> list of errors.
    Files with no errors are not included. Bank-wide problems (duplicate ids
    or titles) are reported against every file involved.
    """
    results: dict[str, list[str]] = {}
    ids: dict[str, list[str]] = {}
    titles: dict[str, list[str]] = {}

    def add(rel: str, message: str) -> None:
        results.setdefault(rel, []).append(message)

    for path in load_problem_files(root):
        # as_posix() keeps forward slashes on Windows too, so output and tests match on every OS.
        rel = path.relative_to(root).as_posix()
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            add(rel, f"invalid JSON: {exc}")
            continue

        for message in validate_problem(data):
            add(rel, message)

        if isinstance(data, dict):
            pid = data.get("id")
            if _is_nonempty_str(pid):
                ids.setdefault(pid, []).append(rel)
                if path.stem != pid:
                    add(rel, f"file name '{path.stem}.json' must match id '{pid}'")
            title = data.get("title")
            if _is_nonempty_str(title):
                titles.setdefault(title.strip().lower(), []).append(rel)

    for pid, files in ids.items():
        if len(files) > 1:
            for rel in files:
                add(rel, f"duplicate id {pid!r} also in: {', '.join(f for f in files if f != rel)}")
    for title, files in titles.items():
        if len(files) > 1:
            for rel in files:
                add(rel, f"duplicate title {title!r} also in: {', '.join(f for f in files if f != rel)}")

    return results


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    root = Path(args[0]) if args else Path("problems")
    if not root.is_dir():
        print(f"error: {root} is not a directory")
        return 1

    total = len(load_problem_files(root))
    results = validate_directory(root)

    for rel, messages in sorted(results.items()):
        print(f"FAIL {rel}")
        for message in messages:
            print(f"  - {message}")

    bad = len(results)
    print(f"\n{total - bad} valid, {bad} invalid, {total} total")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
