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
The minimap (bottom left) shows everyone who needs help as a dot in their priority colour.
If the game feels slow, click Graphics: Smooth (top left). Add `?fps=1` to the address to show the frame rate.
(Opening `index.html` by double-clicking does not work: browsers only load JavaScript modules from a web server.)

To use a backend hosted elsewhere, add `?api=https://your-backend` to the game address.

Each shift runs 9 AM to 5 PM in 8 real minutes and ends with a shift report. "My progress" shows your accuracy per topic and your badges.

Some problems have `physical_steps` in their JSON (each with a `place`: `printer`, `parts_cabinet` or `server_room`, and an `action`). After the right answer, the player walks to each place, presses E, then goes back to the person to close the ticket. The steps are only sent with a right answer, so they never give the answer away. Like everything else in a problem, they are written for review and only used once reviewed.

Hands-on tickets: a problem can have a `hands_on` scenario instead, for example `{"faults": ["video_cable_loose"], "goal": "display"}`. The player inspects the desk (back of the PC, monitor, power strip, wall port, keyboard and mouse), the switch in the server room, the shared printer (screen, test page, cleaning routine, front door, paper path, toner cartridge, back panel), a laptop desk (charger, dock, second monitor with its input button and Windows key + P, work phone, vents), or walks the office measuring Wi-Fi signal before reporting weak coverage. Spare parts come from the parts cabinet, where the player picks the item they think they need, reseats cables, flips switches or moves a switch port, then asks the person to test. A small simulation (`game/src/handson.js`) works out the lights and screens from what is plugged in, so the clues are always consistent. The problem's wrong options become "other things to try", with their reviewed explanations. The allowed faults are listed in `tools/validate_problems.py`, and a test keeps that list in step with the game.

Repair bench (`ram_faulty`, goal `stable`): for the blue-screen ticket the player checks the stop code, runs Windows Memory Diagnostic at the desk, shuts down and unplugs the PC, and carries it to the repair bench in the IT room. There they put on the anti-static strap, drain leftover power, open the side panel, test one RAM stick at a time to find the faulty one, and fit a matching DDR4 stick from the parts cabinet (DDR5 will not fit). Then they carry the PC back, plug it in and test again.

Meeting room and lounge: the projector ticket (`projector_wrong_input`, `projector_hdmi_loose`, `projector_pc_only`, goal `projector`) has the player check the HDMI cable at both ends, pick the projector input the cable is in, and set Windows key + P on the laptop. The lounge TV ticket (`tv_cable_loose`, `tv_wifi_dropped`, goal `tv_online`) has them reseat the TV's cable or reconnect it to the devices network, not the staff network. While these tickets are open, the projector shows No signal and the TV shows No internet connection in the office. A desk can also lose its network because its cable is half out of the server room switch (`switch_cable_loose`): the player pushes it back in.

Desk phones (`phone_cable_loose`, goal `phone`; `phone_muted` and `handset_cord_loose`, goal `phone_audio`): the office's VoIP phones are powered through their network cable, so a loose cable means a blank screen and no dial tone; one-way audio comes from the mute button or a loose handset cord, and a test call checks both ways. New-starter laptop (`new_laptop_setup`, goal `laptop_ready`): at the repair bench the player sets up a boxed laptop in a sensible order (each step says what must come first), and shortcuts such as using your own admin account are refused with the reason.

Escalation (Level 3 and up): a problem can have an `escalation` with the right `team` (`network`, `security`, `server` or `vendor`), a `team_why`, and 3-6 `details`, each marked `send: true` or `false` with a `why`. After the right answer, the player picks the team and ticks what to include in the handover, for example the time it started and an example IP address, but never a user's password. The server checks the form against the reviewed file (`POST /problems/{id}/escalate`); a wrong team or wrong details halves the ticket's XP and shows why.

After each shift a "senior tech" coach writes a short note. The backend works out the facts from the shift numbers (no AI), picks real-world tips only from reviewed problems the player missed, and asks the AI to word a two-to-four sentence note from those facts and tips alone. The game sends no names or personal data, only numbers, topic names and problem ids. Without AI, the note is written from the numbers.

The daily challenge gives everyone the same 5 question tickets each day. The server picks them from a hash of the date, using only reviewed level 1-2 question tickets. One try per day, scored on right answers and time spent choosing, with a day streak and a share card whose squares show right and wrong without giving answers away.

Random events make shifts different: a power flicker (a burst of tickets), a phishing wave or month-end printing (more tickets from that topic), a manager walk-round (+50% XP for a minute), a VIP request (one urgent ticket worth double XP) and a quiet spell (no new tickets for 30 seconds). Events never add new IT content; they only change which reviewed problems arrive and what they are worth. They can be switched off in the help card.

Badges are earned for things like a first fix, solving an urgent ticket in time, or a clean shift. After a shift, "Share my result" makes an image and suggested text for a LinkedIn post. Reaching the Sysadmin rank unlocks a downloadable completion certificate. It states: "Completion of a training game, not an accredited certification." Both images are drawn in the browser, so the name typed for the certificate never leaves the player's computer.

Game logic tests (optional, needs Node.js): `node --test game/tests/logic.test.mjs game/tests/tickets.test.mjs game/tests/shift.test.mjs game/tests/achievements.test.mjs game/tests/cards.test.mjs game/tests/jobs.test.mjs game/tests/handson.test.mjs`

## Main menu and player name

The game opens on a loading screen (logo, progress bar and game tips), then the main menu: Continue, Daily challenge, My progress, How to play, Settings (sound, graphics, random events) and New game. On the first visit it asks for the player's name. The name is stored only in the browser (`localStorage`), is used for greetings and as the default certificate name, and is never sent to the backend or the AI. If the game's files fail to load, the loading screen says so after 20 seconds and suggests Ctrl+F5.

Sound is all made in code with the Web Audio API, so there are no audio files and nothing to license: sound effects, soft footsteps while walking, and very quiet background music (a slow loop of soft chords, `game/src/music.js`). Each has its own switch in Settings.

## The office

The office has the main open-plan area, the server room, the IT corner (help desk, parts cabinet, repair bench, notice board), and an east wing with a kitchen (coffee machine boost), a lounge with a TV, a game corner arcade (5 mini-games, no XP), a meeting room, a learning hub under a purple archway (notes unlocked from the problems you have worked on, plus free course links), a manager's office and a call team (people on calls with headsets, in the phone booths and at a row of desks). The manager's door stays shut: knock (E) and Haroon says come in if he is at his desk, or it opens by itself when he has asked for help. Haroon is the manager, so he never reports a problem that staff would take to their manager (approvals, "ask your manager"); the backend marks those problems with `involves_manager`. The light follows the shift clock (morning sun from the east, warm late-afternoon light, windows that glow with it), and the server room has a sliding glass door: tap your badge on the reader outside (E) to open it; from inside it opens as you walk up to it.

Staff take breaks when they do not need help: they get a coffee, watch the lounge TV, play at the arcade, or hold meetings with slides on the projector. Routes are planned on a grid with A* search (`game/src/nav.js`); who goes where is decided in `game/src/life.js`. Anyone with an open ticket walks back to their desk.

Graphics: Smooth (no shadows, fewer pixels), Balanced and Realistic. The 3D office is not redrawn while a full-screen card (menu, arcade, notes) is open.

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
| `POST /problems/{id}/escalate` | Check an escalation (team and details) against the reviewed answer |
| `GET /problems/{id}/notes` | Study notes from the reviewed file (right fix, why, tip) for the learning corner |
| `GET /problems/{id}/hints/{n}` | Hint number n (1 is the gentlest) |
| `POST /problems/{id}/rephrase` | Fresh AI wording of the employee's complaint |
| `POST /problems/{id}/ask` | "Ask the senior tech" follow-up question |
| `POST /coach` | End-of-shift note from the shift numbers (no personal data) |
| `GET /daily/{YYYY-MM-DD}` | The day's 5 challenge tickets, the same for everyone on that date |

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
