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
- [ ] Bigger, realistic office:
  - [x] Every person who reports a PC problem sits at a real desk with a PC (no one standing in open space);
        desk tickets only go to people who actually have a PC there
  - [x] Stage A: east wing built (kitchen, lounge with sofa and TV, game corner, meeting room, learning corner)
        plus details: wall clock, fire extinguishers, exit sign, first aid box, notice board, server room badge
        reader, new-starter laptop boxes, desk phones
  - [ ] Stage B: things to use: coffee machine (short speed boost), learning corner PC (notes built from the
        reviewed problems, plus free certification and roadmap links, checked before adding), notice board
        (badges and streaks)
  - [ ] Stage C: lounge mini-games at the game corner (with the mini-game sounds)
  - [ ] Stage D: staff walk around (kitchen, printer, meeting room) when they have no open ticket
  - [ ] Stage E: windows and light that follow the shift clock, server room badge door, desk phone tickets,
        meeting room projector tickets, new-starter laptop setup at the bench
  - [ ] Stage F: desk upgrades and technician customisation
- [ ] Three graphics modes: Smooth, Balanced, Realistic (the current detailed look)
- [x] Sound: footsteps while walking and very quiet calm background music (made in code), each with its own
      on/off switch in Settings. Mini-game sounds are ready and get used when the lounge games are built.

## Phase 8
- [ ] Free-text answers graded against reviewed answers
- [ ] Voice

## Phase 9: launch
- [ ] Version numbers on game files so browsers always load the latest copy
- [ ] Hosting, final README, LinkedIn launch post

## After launch
- [ ] Leaderboard
- [ ] Levels 4 and 5
