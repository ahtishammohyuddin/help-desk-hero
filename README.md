# Help Desk Hero

A third-person 3D browser game that teaches IT technical support, from basic to advanced.
Built with Three.js, a FastAPI backend and a reviewed, data-driven problem bank.

> Status: Phase 4 (ticket loop). README will be expanded at release.

## Key idea
Correct answers and explanations are fixed in reviewed JSON files. The AI only rephrases,
gives progressive hints and answers follow-up questions using that problem's own content.

## Repo layout
- `game/` Three.js front end
- `backend/` FastAPI app
- `problems/` one JSON file per problem, grouped by level
- `tools/` validator, generator, coverage report
- `tests/` pytest tests

## Run the checks
```
python -m pytest
python -m tools.validate_problems
```

## Run the game
The game needs the backend running (it serves the problems and checks answers). Use two terminals:
```
uvicorn backend.main:app --reload                 # terminal 1 (inside the venv)
python -m http.server 5173 --directory game       # terminal 2
```
Open http://localhost:5173 . Tickets arrive in the queue with a priority (P1-P4) and an SLA timer.
Walk to the employee with the "!" and press E. Answer with 1-4, H for a hint (costs XP).
A wrong first answer gets an explanation and a free hint, then one more try for 50% XP.
After answering, press Q to ask the senior tech up to 3 follow-up questions. First-try answers in a row build a streak (x1.2 XP at 3, x1.5 at 5).
Move with WASD or the arrow keys, drag to rotate the camera, scroll to zoom, M toggles sound.
(Opening `index.html` by double-clicking does not work: browsers only load JavaScript modules from a web server.)

To use a backend hosted elsewhere, add `?api=https://your-backend` to the game address.

Game logic tests (optional, needs Node.js): `node --test game/tests/logic.test.mjs game/tests/tickets.test.mjs`

## Run the backend
```
pip install -r requirements-dev.txt
uvicorn backend.main:app --reload
```
Open http://127.0.0.1:8000/docs for the interactive API page.

| Endpoint | What it does |
|---|---|
| `GET /health` | Status and how many reviewed problems are loaded |
| `GET /problems?level=&category=` | List reviewed problems (titles only) |
| `GET /problems/{id}` | One problem for play, with no answers or explanations |
| `POST /problems/{id}/answer` | Check an answer, returns explanations for every option |
| `POST /problems/{id}/check` | One try (used by the game). A wrong first try returns only why that choice is wrong plus a hint; the correct answer is revealed only on the final try |
| `GET /problems/{id}/hints/{n}` | Hint number n (1 is the gentlest) |
| `POST /problems/{id}/rephrase` | Fresh AI wording of the employee's complaint |
| `POST /problems/{id}/ask` | "Ask the senior tech" follow-up question |

Only problems with `"reviewed": true` are ever served.
Settings: `PROBLEMS_DIR`, `ALLOWED_ORIGINS`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_DAILY_LIMIT`, `AI_CLIENT_LIMIT`.

## How the AI is controlled
- **The AI never decides what is correct.** Answers and explanations live in reviewed JSON files.
- **Rephrase** only sees the symptom and the employee's original words, never the options,
  so it cannot leak the answer.
- **Ask the senior tech** answers only from that problem's reviewed notes (retrieval over our own data).
  Off-topic questions get a standard reply, and text inside the question is treated as a question, never as instructions.
- **Every AI reply is JSON** and is checked for shape and length. Anything invalid is discarded.
- **Fallback mode:** no key, a quota error, a timeout or a bad reply all fall back to pre-written text.
  Each response says `"source": "ai" | "cache" | "fallback"`.
- **Cost control:** per-player and daily call limits, a cache of replies, a pause after quota errors,
  and short, capped prompts. Runs on the Gemini free tier.
