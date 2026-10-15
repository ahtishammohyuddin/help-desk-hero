// Lounge mini-games at the arcade. Pure logic (no browser), tested with Node.
// They are for a break: no XP and no IT facts, just best scores kept on this device.

// ---------- Ticket rush: click tickets before they vanish ----------
export const RUSH_SECONDS = 30;
export const RUSH_CELLS = 9;

export const newRush = () => ({ timeLeft: RUSH_SECONDS, cells: Array(RUSH_CELLS).fill(null), score: 0, missed: 0, spawnIn: 0.4, elapsed: 0, over: false });

/** How long a ticket stays, and the gap between tickets: both shrink as the round goes on. */
export const rushPace = (elapsed) => ({ life: Math.max(0.75, 1.5 - elapsed * 0.025), gap: Math.max(0.35, 0.8 - elapsed * 0.015) });

/** Advance the round by dt seconds. rng() picks the free cell. */
export function tickRush(state, dt, rng = Math.random) {
  if (state.over) return state;
  const elapsed = state.elapsed + dt;
  let missed = state.missed;
  const cells = state.cells.map((c) => {
    if (c && c.left - dt <= 0) {
      missed += 1;
      return null;
    }
    return c ? { left: c.left - dt } : null;
  });
  let spawnIn = state.spawnIn - dt;
  const pace = rushPace(elapsed);
  if (spawnIn <= 0) {
    const free = cells.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
    if (free.length) cells[free[Math.floor(rng() * free.length)]] = { left: pace.life };
    spawnIn = pace.gap;
  }
  const timeLeft = Math.max(0, state.timeLeft - dt);
  return { ...state, cells, missed, spawnIn, elapsed, timeLeft, over: timeLeft === 0 };
}

/** Click a cell: a ticket there scores a point. Returns { state, hit }. */
export function hitRush(state, index) {
  if (state.over || !state.cells[index]) return { state, hit: false };
  const cells = [...state.cells];
  cells[index] = null;
  return { state: { ...state, cells, score: state.score + 1 }, hit: true };
}

// ---------- Kit match: find the pairs ----------
export const KIT = ['🖥️', '💻', '🖨️', '⌨️', '🖱️', '📱', '🎧', '🔌'];

export function newMatch(rng = Math.random) {
  const deck = [...KIT, ...KIT].map((face, i) => ({ id: i, face, matched: false }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return { deck, open: [], moves: 0, over: false };
}

/**
 * Flip card at position i. Two open cards that match stay matched; two that do not
 * stay open until closeMismatch() (the UI waits a moment so the player can see them).
 * Returns { state, result: 'open' | 'match' | 'miss' | 'ignored' }.
 */
export function flipCard(state, i) {
  const card = state.deck[i];
  if (state.over || !card || card.matched || state.open.includes(i) || state.open.length >= 2) return { state, result: 'ignored' };
  const open = [...state.open, i];
  if (open.length < 2) return { state: { ...state, open }, result: 'open' };
  const [a, b] = open;
  const moves = state.moves + 1;
  if (state.deck[a].face === state.deck[b].face) {
    const deck = state.deck.map((c, k) => (k === a || k === b ? { ...c, matched: true } : c));
    return { state: { ...state, deck, open: [], moves, over: deck.every((c) => c.matched) }, result: 'match' };
  }
  return { state: { ...state, open, moves }, result: 'miss' };
}

export const closeMismatch = (state) => ({ ...state, open: [] });

// ---------- Quick typer: type the line as fast and accurately as you can ----------
export const TYPING_LINES = [
  'Have you tried turning it off and on again?',
  'Please describe the problem in as much detail as you can.',
  'I have logged a ticket and will update you within the hour.',
  'Thank you for your patience while we look into this.',
  'Could you tell me when the problem first started?',
];

export const pickLine = (rng = Math.random) => TYPING_LINES[Math.floor(rng() * TYPING_LINES.length)];

/** Words per minute (5 characters = 1 word) and accuracy % for what was typed. */
export function typingScore(target, typed, seconds) {
  const correct = [...typed].filter((ch, i) => ch === target[i]).length;
  const accuracy = typed.length ? Math.round((correct / typed.length) * 100) : 0;
  // Too early to tell in the first moments (one key in 0.1 s is not 120 words per minute).
  const wpm = seconds >= 1.5 ? Math.round((correct / 5) / (seconds / 60)) : 0;
  return { wpm, accuracy, done: typed.length >= target.length };
}

// ---------- best scores ----------
export const emptyBest = () => ({ rush: 0, match: 0, typer: 0 });

/** Is this a new best? For kit match fewer moves is better (0 means none yet). */
export function isBest(best, game, value) {
  if (game === 'match') return value > 0 && (best.match === 0 || value < best.match);
  return value > (best[game] ?? 0);
}
