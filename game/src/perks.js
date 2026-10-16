// Things to use around the office: the coffee machine boost, and the list of problems the
// player has done (which unlocks their notes in the learning corner). Pure logic, tested with Node.

export const COFFEE_SECONDS = 45; // how long the boost lasts (real seconds)
export const COFFEE_COOLDOWN = 120; // time from one coffee to the next
export const COFFEE_SPEED = 1.3; // walking speed while the boost lasts
export const SEEN_MAX = 400;

export const emptyCoffee = () => ({ until: 0, readyAt: 0 });

/** Make a coffee at time `now` (seconds). Returns { state, ok, message }. */
export function drinkCoffee(state, now, seconds = COFFEE_SECONDS) {
  if (now < state.readyAt) {
    const wait = Math.ceil(state.readyAt - now);
    return { state, ok: false, message: `The coffee machine is still heating up. Try again in ${wait} seconds.` };
  }
  return {
    state: { until: now + seconds, readyAt: now + COFFEE_COOLDOWN },
    ok: true,
    message: `Coffee time! You walk ${Math.round((COFFEE_SPEED - 1) * 100)}% faster for ${seconds} seconds.`,
  };
}

export const coffeeLeft = (state, now) => Math.max(0, Math.ceil(state.until - now));
export const speedFor = (state, now) => (now < state.until ? COFFEE_SPEED : 1);

/** Remember that a problem has been done (newest last, no repeats, capped). */
export function addSeen(seen = [], id) {
  if (!id) return seen;
  const next = seen.filter((x) => x !== id);
  next.push(id);
  return next.slice(-SEEN_MAX);
}

/**
 * The learning corner's topic list: every category in the pool, with how many of its
 * problems the player has done. pool: [{ id, category, title, level }].
 */
export function libraryTopics(pool, seen) {
  const done = new Set(seen);
  const topics = new Map();
  for (const p of pool) {
    if (!topics.has(p.category)) topics.set(p.category, { category: p.category, total: 0, unlocked: [] });
    const t = topics.get(p.category);
    t.total += 1;
    if (done.has(p.id)) t.unlocked.push(p);
  }
  return [...topics.values()]
    .map((t) => ({ ...t, unlocked: t.unlocked.sort((a, b) => a.level - b.level || a.title.localeCompare(b.title)) }))
    .sort((a, b) => a.category.localeCompare(b.category));
}
