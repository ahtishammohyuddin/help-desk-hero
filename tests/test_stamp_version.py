import json
import re

from tools.stamp_version import main, stamped

HTML = """<html><head>
<link rel="stylesheet" href="style.css">
<script src="config.js"></script>
<script type="importmap">
  {"imports": {"three": "https://cdn.example/three.js"}}
</script></head><body>
<script type="module" src="src/main.js"></script></body></html>"""


def make_game(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "index.html").write_text(HTML)
    (tmp_path / "style.css").write_text("body{}")
    (tmp_path / "config.js").write_text("window.HDH_CONFIG={}")
    (tmp_path / "src" / "main.js").write_text("import './ui.js';")
    (tmp_path / "src" / "ui.js").write_text("export const a = 1;")
    return tmp_path


def imports_of(html):
    return json.loads(re.search(r'<script type="importmap">\s*(\{.*?\})\s*</script>', html, re.S).group(1))["imports"]


def test_every_file_gets_a_stamp_and_three_is_kept(tmp_path):
    game = make_game(tmp_path)
    html = stamped(game)
    assert re.search(r'href="style.css\?v=[0-9a-f]{10}"', html)
    assert re.search(r'src="config.js\?v=[0-9a-f]{10}"', html)
    assert re.search(r'src="src/main.js\?v=[0-9a-f]{10}"', html)
    imports = imports_of(html)
    assert imports["three"] == "https://cdn.example/three.js"
    assert re.fullmatch(r"\./src/ui\.js\?v=[0-9a-f]{10}", imports["./src/ui.js"])


def test_a_changed_file_gets_a_new_stamp_and_check_mode_notices(tmp_path):
    game = make_game(tmp_path)
    assert main([], game=game) == 0
    first = imports_of((game / "index.html").read_text())["./src/ui.js"]
    assert main(["--check"], game=game) == 0
    (game / "src" / "ui.js").write_text("export const a = 2;")
    assert main(["--check"], game=game) == 1
    main([], game=game)
    assert imports_of((game / "index.html").read_text())["./src/ui.js"] != first
    assert main([], game=game) == 0  # running again changes nothing
