"""Loads the problem bank from disk.

Only problems that are BOTH valid and marked "reviewed": true are served.
This is the safety rule from the project brief: the game never shows content
that a human has not approved.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from tools.validate_problems import load_problem_files, validate_problem

logger = logging.getLogger(__name__)


class ProblemStore:
    """In-memory copy of all reviewed problems, keyed by id."""

    def __init__(self, root: Path):
        self.root = Path(root)
        self._problems: dict[str, dict] = {}
        self.unreviewed_count = 0
        self.skipped: list[str] = []  # files that are reviewed but unusable
        self.load()

    def load(self) -> None:
        self._problems = {}
        self.unreviewed_count = 0
        self.skipped = []

        if not self.root.is_dir():
            logger.warning("Problems folder not found: %s", self.root)
            return

        for path in load_problem_files(self.root):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError) as exc:
                logger.warning("Skipping %s: cannot read (%s)", path.name, exc)
                self.skipped.append(path.name)
                continue

            if not isinstance(data, dict) or data.get("reviewed") is not True:
                self.unreviewed_count += 1
                continue

            errors = validate_problem(data)
            if errors:
                logger.warning("Skipping reviewed problem %s: %s", path.name, "; ".join(errors))
                self.skipped.append(path.name)
                continue

            if data["id"] in self._problems:
                logger.warning("Skipping %s: duplicate id %s", path.name, data["id"])
                self.skipped.append(path.name)
                continue

            self._problems[data["id"]] = data

    def __len__(self) -> int:
        return len(self._problems)

    def get(self, problem_id: str) -> dict | None:
        return self._problems.get(problem_id)

    def list(self, level: int | None = None, category: str | None = None) -> list[dict]:
        """Reviewed problems, sorted by id, optionally filtered."""
        items = [
            p
            for p in self._problems.values()
            if (level is None or p["level"] == level)
            and (category is None or p["category"] == category)
        ]
        return sorted(items, key=lambda p: p["id"])
