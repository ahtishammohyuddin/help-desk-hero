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
- [ ] Loading screen and main menu (Continue, New game, Daily challenge, My progress, Settings, How to play),
      player name stored only on the player's device, never sent to the AI or server
- [ ] More professional certificate (logo, frame, signature-style line, certificate ID; still says it is a
      training game, not an accredited certification)
- [ ] Bigger, realistic office:
  - [x] Every person who reports a PC problem sits at a real desk with a PC (no one standing in open space);
        desk tickets only go to people who actually have a PC there
  - [ ] Office staff move around (walk to the printer, kitchen, meetings)
  - [ ] Lounge / chill area with a sofa and TV, where the player can play small mini-games
  - [ ] Learning area: open the PC there to browse notes on every IT support topic, written simply,
        plus links to free IT certifications and an IT support roadmap
  - [ ] Small real-office details (sitting area, plants, kitchen, meeting room)
  - [ ] Desk upgrades and technician customisation
- [ ] Three graphics modes: Smooth, Balanced, Realistic (the current detailed look)
- [ ] Sound: footsteps while walking, sounds for the mini-games, and very quiet calm background music,
      each with its own on/off switch in Settings (music made in code or free-licensed, nothing that costs money)

## Phase 8
- [ ] Free-text answers graded against reviewed answers
- [ ] Voice

## Phase 9: launch
- [ ] Version numbers on game files so browsers always load the latest copy
- [ ] Hosting, final README, LinkedIn launch post

## After launch
- [ ] Leaderboard
- [ ] Levels 4 and 5
