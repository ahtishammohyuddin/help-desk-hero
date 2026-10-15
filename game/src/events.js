// Random events during a shift. Pure logic (no browser), tested with Node.
//
// Events never add IT content: they only change which reviewed problems arrive,
// how many, and how much XP they are worth.

export const EVENTS = {
  power_flicker: {
    name: 'Power flicker',
    icon: '⚡',
    banner: 'The lights flickered. Several people need help at once!',
    duration: 0,
    burst: 3, // tickets that arrive straight away (if there is room)
  },
  phishing_wave: {
    name: 'Phishing wave',
    icon: '🎣',
    banner: 'A suspicious email is going round the office. Expect security tickets.',
    duration: 60,
    category: 'Security and phishing',
    every: 12, // seconds between extra tickets from that category
  },
  month_end: {
    name: 'Month-end printing',
    icon: '🖨️',
    banner: 'Month-end: everyone is printing. Expect printer tickets.',
    duration: 60,
    category: 'Printers and scanners',
    every: 12,
  },
  manager: {
    name: 'Manager walk-round',
    icon: '👔',
    banner: 'The manager is walking round. Tickets you close now earn +50% XP.',
    duration: 60,
    xpMult: 1.5,
  },
  vip: {
    name: 'VIP request',
    icon: '⭐',
    banner: 'The CEO needs something fixed right now. One urgent ticket, worth double XP.',
    duration: 0,
    vip: true,
  },
  quiet: {
    name: 'Quiet spell',
    icon: '☕',
    banner: 'A quiet spell: no new tickets for 30 seconds. Catch up on anything overdue.',
    duration: 30,
    pause: true,
  },
};

export const VIP_XP = 2;
const EARLIEST = 60; // no events in the first real minute
const LATEST_GAP = 70; // and none in the last office hour (plus a little time to finish)

/**
 * Pick 1 or 2 events for a shift and when they start.
 * available(id): false for events that make no sense right now (e.g. no printer problems unlocked).
 * Returns [{ id, at }] sorted by time; events never overlap.
 */
export function planEvents(shiftSeconds, { rng = Math.random, available = () => true } = {}) {
  const ids = Object.keys(EVENTS).filter((id) => available(id));
  if (ids.length === 0) return [];
  const count = Math.min(ids.length, rng() < 0.5 ? 1 : 2);
  const latest = shiftSeconds - LATEST_GAP;
  const plan = [];
  const pool = [...ids];
  for (let i = 0; i < count; i++) {
    const id = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    // Two events: one in each half of the open window, so they cannot overlap.
    const span = (latest - EARLIEST) / count;
    const start = EARLIEST + i * span;
    const room = Math.max(0, span - EVENTS[id].duration - 10);
    plan.push({ id, at: Math.round(start + rng() * room) });
  }
  return plan.sort((a, b) => a.at - b.at);
}

/** Events that start between two moments (prev, now]. */
export function eventsStarting(plan, prev, now) {
  return plan.filter((e) => e.at > prev && e.at <= now);
}

/** Events running at this moment, with seconds left: [{ id, left }]. Instant events are not listed. */
export function runningEvents(plan, now) {
  return plan
    .filter((e) => EVENTS[e.id].duration > 0 && now >= e.at && now < e.at + EVENTS[e.id].duration)
    .map((e) => ({ id: e.id, left: Math.ceil(e.at + EVENTS[e.id].duration - now) }));
}

/** Combined effect of running events: { xpMult, paused, category, every }. */
export function effectsAt(plan, now) {
  const effect = { xpMult: 1, paused: false, category: null, every: 0 };
  for (const { id } of runningEvents(plan, now)) {
    const e = EVENTS[id];
    if (e.xpMult) effect.xpMult *= e.xpMult;
    if (e.pause) effect.paused = true;
    if (e.category) {
      effect.category = e.category;
      effect.every = e.every;
    }
  }
  return effect;
}

/** Minutes and seconds, like 0:42. */
export const countdown = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;
