"""Add "gender" to each problem's character, so tickets go to a matching employee.

Why: answer texts use "he/she" ("Tell her not to click"), so a problem written
about a woman must be handled by a female employee in the office, and vice versa.

The genders below come from the character names, cross-checked against the
pronouns used in each problem's own text. Please review the printed list.

Usage (from the repo root):
    python -m tools.set_character_gender            # update files in ./problems
    python -m tools.set_character_gender --check    # only report, change nothing

Safe to run more than once. Your "reviewed" flags and any edits are kept.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from tools.validate_problems import load_problem_files

FEMALE = """
Aiman Aleena Amna Anam Asma Ayesha Bushra Eman Farah Hafsa Hania Hina Hira Iqra
Kiran Laiba Lubna Maheen Mahnoor Mariam Maryam Mehwish Naila Nargis Nida Nimra
Rabia Rida Rubina Saba Sadia Saima Samina Sana Sehrish Shazia Sidra Sobia Sumaira
Tahira Warda Zainab Zoya
""".split()

MALE = """
Adeel Adnan Ahmed Arslan Asad Babar Danial Danish Fahad Faisal Fawad Furqan Hammad
Haris Ibrahim Imran Imtiaz Irfan Junaid Kamil Kamran Kashif Moiz Naveed Noman Owais
Rafay Rehan Rizwan Salar Salman Shaheer Shahid Shoaib Tahir Talha Tariq Umair Usman
Uzair Waleed Waqas Yasir Zubair
""".split()

GENDER = {**{n: "female" for n in FEMALE}, **{n: "male" for n in MALE}}


def main(argv: list[str] | None = None, root: Path = Path("problems")) -> int:
    args = sys.argv[1:] if argv is None else argv
    check_only = "--check" in args
    unknown, changed, counts = [], 0, {"female": 0, "male": 0}

    for path in load_problem_files(root):
        data = json.loads(path.read_text(encoding="utf-8"))
        character = data.get("character", {})
        name = character.get("name")
        gender = GENDER.get(name)
        if gender is None:
            unknown.append(f"{path.name} ({name})")
            continue
        counts[gender] += 1
        if character.get("gender") != gender:
            changed += 1
            if not check_only:
                character["gender"] = gender
                path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"female: {counts['female']}   male: {counts['male']}")
    verb = "would update" if check_only else "updated"
    print(f"{verb} {changed} file(s)")
    if unknown:
        print("No gender listed for these names. Add them to FEMALE or MALE in this script:")
        for item in unknown:
            print(f"  - {item}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
