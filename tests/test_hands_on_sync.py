"""The validator and the game must agree on which hands-on faults exist.

The game simulates faults in game/src/handson.js; the validator decides which ones
problem files may use. If one side gains a fault the other does not know, this fails.
"""

import re
from pathlib import Path

from tools.validate_problems import HANDS_ON_FAULTS

GAME = Path(__file__).resolve().parent.parent / "game"


def _keys(text: str, block: str) -> set[str]:
    body = re.search(block + r" = \{(.*?)\n\};", text, re.S).group(1)
    return set(re.findall(r"^\s*(\w+):", body, re.M))


def test_game_simulates_every_validator_fault():
    source = (GAME / "src" / "handson.js").read_text(encoding="utf-8")
    simulated = _keys(source, "const FAULT_PARTS") | _keys(source, "const PRINTER_FAULTS") | {"switch_port_dead"}
    assert simulated == set(HANDS_ON_FAULTS)


def test_game_test_list_matches_validator():
    source = (GAME / "tests" / "handson.test.mjs").read_text(encoding="utf-8")
    pairs = dict(re.findall(r"(\w+): '(\w+)'", re.search(r"VALIDATOR_FAULTS = \{(.*?)\};", source, re.S).group(1)))
    assert pairs == HANDS_ON_FAULTS
