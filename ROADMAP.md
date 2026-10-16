# Help Desk Hero roadmap

## Done
- **Phases 1–5:** problem bank (Levels 1–2), validator, FastAPI backend, 3D office, ticket queue,
  shifts, ranks, badges, certificate, share cards.
- **Hands-on stations:** desk, server room switch, printer, laptop desk, Wi-Fi survey, parts cabinet.
- **Phase 6:** random events, AI coach (with a no-AI fallback), daily challenge.

## Now: Level 3
- [x] Level 3, batch 1 (12 problems, reviewed)
- [x] Level 3, batches 2-4 (35 problems), awaiting review (`reviewed: false`)
- [x] Escalation form: pick the right team and the right details to send (answers fixed in reviewed JSON)
- [x] Repair bench in the IT room: carry the PC there and replace faulty RAM (for L3-HW-01)
- [x] All 47 planned Level 3 problems written

## Phase 7: make it look and feel like a real game
- [x] Game logo (designed by Ahtisham; in `game/assets/`)
- [x] Loading screen and main menu (Continue, New game, Daily challenge, My progress, Settings, How to play),
      player name stored only on the player's device, never sent to the AI or server
- [x] More professional certificate (formal serif design without the cartoon logo, frame, seal, signature line, certificate ID; still says it is a
      training game, not an accredited certification)
- [x] Bigger, realistic office:
  - [x] Every person who reports a PC problem sits at a real desk with a PC (no one standing in open space);
        desk tickets only go to people who actually have a PC there
  - [x] Stage A: east wing built (kitchen, lounge with sofa and TV, game corner, meeting room, learning corner)
        plus details: wall clock, fire extinguishers, exit sign, first aid box, notice board, server room badge
        reader, new-starter laptop boxes, desk phones
  - [x] Stage B: things to use: coffee machine (short speed boost), learning corner PC (notes built from the
        reviewed problems), notice board (badges and streaks). Free course and roadmap links are written in
        `game/src/resources.js` and stay hidden until reviewed (RESOURCES_REVIEWED = true)
  - [x] Stage C: game corner arcade with 5 mini-games (Packet dash, Server stack, Switch lights, Kit match,
        Quick typer), smooth canvas games, sounds and best scores on this device; no XP, the shift pauses
  - [x] Stage D: staff walk around when they have no open ticket: kitchen, lounge (sit and watch videos on the TV),
        game corner (play), meeting room (meetings with slides on the projector); A* routes, back to the desk for tickets
  - [x] Manager's office (executive desk, leather chair, bookshelf, leather sofa, rug, window) with Haroon at Desk 8,
        plus phone booths and lockers
  - [x] New hands-on tickets: meeting room projector shows no signal (cable, input, Windows key + P), lounge TV
        with no internet (cable or devices network), network cable loose at the server room switch; the projector and
        TV show the fault in the office while the ticket is open (written, awaiting review)
  - [x] Server room tickets: UPS alarm, room too hot, amber disk light, server not responding, tailgating
        (escalation to the server or security team; written, awaiting review)
  - [x] Free course and roadmap links approved and shown in the learning corner
  - [x] Learning hub archway and signs, call team with headsets in the phone booths area, manager's door that you
        knock on (opens by itself when Haroon asks for help), the manager never gets "ask your manager" tickets
  - [x] Stage E:
    - [x] Windows and daylight that follow the shift clock
    - [x] Server room badge door (tap your badge to go in, exit sensor on the way out)
    - [x] Desk phone tickets: blank screen and no dial tone, caller can't hear me (awaiting review)
    - [x] New-starter laptop setup at the repair bench (awaiting review)
  - [x] Stage F: technician customisation (shirt, hair, skin tone, lanyard; saved on this device) and six desk
        upgrades unlocked by total XP, shown on your help desk (only the mug has a small perk: a 60-second coffee boost)
- [x] Three graphics modes: Smooth, Balanced, Realistic; the office is not redrawn behind full-screen cards
- [x] Sound: realistic soft footsteps, background music made in code with 4 styles (Calm chords, Ambient,
      Soft piano, Lo-fi beat) and 3 volumes, separate switches, and a ♪ button that mutes everything

## Phase 8
- [x] Answer in your own words: the AI (or a word match without AI) only says which option your words sound like;
      you confirm it and the reviewed answer decides right or wrong
- [x] Voice: speech-to-text answers (off by default, privacy note) and read-aloud of the person's message

## Phase 9: launch
- [x] Version stamps on game files so browsers always load the latest copy (`tools/stamp_version.py`)
- [x] Hosting setup: GitHub Pages workflow for the game, `app.py` for Vercel (free Hobby plan, no card); `render.yaml` kept as an alternative, `game/config.js` for the online address
- [x] Live: game on GitHub Pages (https://ahtishammohyuddin.github.io/help-desk-hero/), backend on Vercel's free Hobby plan (https://help-desk-hero-nine.vercel.app)
- [ ] Final README pass and LinkedIn launch post

## After launch
- [ ] Leaderboard
- [ ] Levels 4 and 5
