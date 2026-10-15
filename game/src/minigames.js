// Lounge mini-games at the arcade. Pure logic (no browser), tested with Node.
// They are for a break: no XP and no IT facts, just best scores kept on this device.

// ---------- Packet dash: steer a data packet between three lanes, dodging firewalls ----------
export const DASH_LANES = 3;
export const DASH_HIT_Y = 0.85; // where the packet sits (0 top .. 1 bottom)

export const newDash = () => ({ lane: 1, blocks: [], distance: 0, speed: 0.45, spawnIn: 0.6, over: false });

/** Move one lane left (-1) or right (+1). */
export const steerDash = (state, dir) => (state.over ? state : { ...state, lane: Math.min(DASH_LANES - 1, Math.max(0, state.lane + dir)) });

/** Advance by dt seconds. Blocks fall from the top; touching one ends the run. rng picks lanes. */
export function tickDash(state, dt, rng = Math.random) {
  if (state.over) return state;
  const speed = Math.min(1.4, state.speed + dt * 0.02); // screens per second, slowly faster
  let blocks = state.blocks.map((b) => ({ ...b, y: b.y + speed * dt })).filter((b) => b.y < 1.2);
  let spawnIn = state.spawnIn - dt;
  if (spawnIn <= 0) {
    // One or two lanes blocked, never all three.
    const lanes = [0, 1, 2].sort(() => rng() - 0.5).slice(0, rng() < 0.35 ? 2 : 1);
    blocks = [...blocks, ...lanes.map((lane) => ({ lane, y: -0.1 }))];
    spawnIn = Math.max(0.45, 1.1 - speed * 0.45);
  }
  const hit = blocks.some((b) => b.lane === state.lane && Math.abs(b.y - DASH_HIT_Y) < 0.06);
  return { ...state, blocks, speed, spawnIn, distance: state.distance + speed * dt * 10, over: hit };
}

export const dashScore = (state) => Math.floor(state.distance);

// ---------- Server stack: drop each server so it lands on the one below ----------
export const STACK_WIDTH = 0.5; // starting width (fraction of the play area)

export const newStack = () => ({ layers: [{ x: 0.25, w: STACK_WIDTH }], moving: { x: 0, w: STACK_WIDTH, dir: 1 }, speed: 0.55, over: false, perfect: 0 });

export function tickStack(state, dt) {
  if (state.over) return state;
  let { x, dir } = state.moving;
  x += dir * state.speed * dt;
  if (x + state.moving.w > 1) { x = 1 - state.moving.w; dir = -1; }
  if (x < 0) { x = 0; dir = 1; }
  return { ...state, moving: { ...state.moving, x, dir } };
}

/** Drop the moving server. The overhang is cut off; missing completely ends the game. */
export function dropStack(state) {
  if (state.over) return { state, result: 'ignored' };
  const top = state.layers[state.layers.length - 1];
  const m = state.moving;
  const left = Math.max(top.x, m.x);
  const right = Math.min(top.x + top.w, m.x + m.w);
  const w = right - left;
  if (w <= 0.005) return { state: { ...state, over: true }, result: 'miss' };
  const perfect = Math.abs(m.x - top.x) < 0.012;
  const layer = perfect ? { x: top.x, w: top.w } : { x: left, w };
  const layers = [...state.layers, layer];
  return {
    state: { ...state, layers, moving: { x: 0, w: layer.w, dir: 1 }, speed: Math.min(1.6, state.speed + 0.05), perfect: state.perfect + (perfect ? 1 : 0) },
    result: perfect ? 'perfect' : 'placed',
  };
}

export const stackScore = (state) => state.layers.length - 1;

// ---------- Switch lights: repeat the pattern of port lights ----------
export const SIMON_PADS = 4;

export const newSimon = (rng = Math.random) => ({ pattern: [Math.floor(rng() * SIMON_PADS)], input: [], over: false });

/** Press a pad. Returns { state, result: 'good' | 'round' (pattern done, one more added) | 'wrong' }. */
export function pressSimon(state, pad, rng = Math.random) {
  if (state.over) return { state, result: 'ignored' };
  const input = [...state.input, pad];
  if (state.pattern[input.length - 1] !== pad) return { state: { ...state, input, over: true }, result: 'wrong' };
  if (input.length === state.pattern.length) {
    return { state: { pattern: [...state.pattern, Math.floor(rng() * SIMON_PADS)], input: [], over: false }, result: 'round' };
  }
  return { state: { ...state, input }, result: 'good' };
}

export const simonScore = (state) => state.pattern.length - 1;

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
export const emptyBest = () => ({ dash: 0, stack: 0, simon: 0, match: 0, typer: 0 });

/** Is this a new best? For kit match fewer moves is better (0 means none yet). */
export function isBest(best, game, value) {
  if (game === 'match') return value > 0 && (best.match === 0 || value < best.match);
  return value > (best[game] ?? 0);
}
