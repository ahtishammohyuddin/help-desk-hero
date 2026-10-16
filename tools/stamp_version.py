"""Give every game file a version stamp, so browsers always load the newest copy.

Browsers keep old copies of .js and .css files. This script adds ?v=<short hash of the
file's contents> to each one in game/index.html (the stylesheet, config.js, main.js, and an
import-map entry for every module in game/src). When a file changes, its address changes,
so no one is stuck on an old version and nobody needs Ctrl+F5.

Usage (from the repo root):
    python -m tools.stamp_version           # update game/index.html
    python -m tools.stamp_version --check   # exit 1 if game/index.html is out of date
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

GAME = Path(__file__).resolve().parent.parent / "game"
IMPORTMAP = re.compile(r'(<script type="importmap">\s*)(\{.*?\})(\s*</script>)', re.S)


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]


def stamped(game: Path) -> str:
    html = (game / "index.html").read_text(encoding="utf-8")

    def stamp_attr(text: str, attr: str, name: str) -> str:
        pattern = re.compile(rf'{attr}="{re.escape(name)}(\?v=[0-9a-f]+)?"')
        return pattern.sub(f'{attr}="{name}?v={file_hash(game / name)}"', text)

    html = stamp_attr(html, "href", "style.css")
    html = stamp_attr(html, "src", "config.js")
    html = stamp_attr(html, "src", "src/main.js")

    match = IMPORTMAP.search(html)
    if not match:
        raise SystemExit("game/index.html has no import map")
    imports = json.loads(match.group(2))["imports"]
    imports = {k: v for k, v in imports.items() if not k.startswith("./src/")}  # rebuilt below
    for module in sorted((game / "src").glob("*.js")):
        key = f"./src/{module.name}"
        imports[key] = f"{key}?v={file_hash(module)}"
    block = json.dumps({"imports": imports}, indent=2).replace("\n", "\n    ")
    return html[: match.start(2)] + block + html[match.end(2):]


def main(argv: list[str] | None = None, game: Path = GAME) -> int:
    argv = sys.argv[1:] if argv is None else argv
    new = stamped(game)
    current = (game / "index.html").read_text(encoding="utf-8")
    if "--check" in argv:
        if new != current:
            print("game/index.html is out of date: run python -m tools.stamp_version")
            return 1
        print("game/index.html version stamps are up to date")
        return 0
    if new != current:
        (game / "index.html").write_text(new, encoding="utf-8")
        print("Updated version stamps in game/index.html")
    else:
        print("Version stamps already up to date")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
