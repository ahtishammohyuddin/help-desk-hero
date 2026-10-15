// Office life: where staff go when they do not need help (kitchen, lounge TV, arcade, meetings).
// Pure planning logic (no browser), tested with Node. staff.js moves the people in 3D.

const N = Math.PI; // facing north (towards -z)
const S = 0; // facing south (+z)
const E = Math.PI / 2; // facing east (+x)
const W = -Math.PI / 2; // facing west (-x)

// Places to be, with how the person sits or stands there.
export const SPOTS = {
  kitchen: [
    { id: 'k1', x: 28, z: -10.9, facing: S, sit: true },
    { id: 'k2', x: 28, z: -8.7, facing: N, sit: true },
    { id: 'k3', x: 26.9, z: -9.8, facing: E, sit: true },
    { id: 'k4', x: 29.1, z: -9.8, facing: W, sit: true },
    { id: 'k5', x: 24, z: -12.5, facing: N, sit: false }, // at the coffee machine
  ],
  lounge: [
    { id: 'l1', x: 23.35, z: -0.9, facing: E, sit: true },
    { id: 'l2', x: 23.35, z: 0.1, facing: E, sit: true },
    { id: 'l3', x: 23.35, z: 1.1, facing: E, sit: true },
    { id: 'l4', x: 26.6, z: -2.8, facing: E, sit: true }, // beanbags
    { id: 'l5', x: 26.6, z: 2.8, facing: E, sit: true },
  ],
  arcade: [{ id: 'a1', x: 33.6, z: -1.45, facing: N, sit: false }],
  meeting: [
    { id: 'm1', x: 30.3, z: 8.9, facing: S, sit: true },
    { id: 'm2', x: 31.4, z: 8.9, facing: S, sit: true },
    { id: 'm3', x: 32.5, z: 8.9, facing: S, sit: true },
    { id: 'm4', x: 30.3, z: 11.1, facing: N, sit: true },
    { id: 'm5', x: 31.4, z: 11.1, facing: N, sit: true },
    { id: 'm6', x: 32.5, z: 11.1, facing: N, sit: true },
  ],
};

export const ACTIVITIES = {
  kitchen: { label: 'getting a coffee', min: 20, max: 35, weight: 3 },
  lounge: { label: 'watching videos in the lounge', min: 35, max: 60, weight: 3 },
  arcade: { label: 'playing at the game corner', min: 25, max: 40, weight: 2 },
  meeting: { label: 'in a meeting', min: 60, max: 90, weight: 0 }, // only planned as a group
};

export const MAX_AWAY = 3; // never empty the office: at most this many on a break at once (meetings aside)
export const MEETING_EVERY = [120, 200]; // seconds between meetings
export const STAYS_PUT = new Set(['Saima']); // reception is always staffed

const between = (rng, [a, b]) => a + rng() * (b - a);

/** Seconds until this person next takes a break. */
export const nextBreakIn = (rng = Math.random) => between(rng, [35, 100]);

/** Free spots for an activity, given the ids already taken. */
export const freeSpots = (activity, taken) => SPOTS[activity].filter((s) => !taken.has(s.id));

/**
 * Pick a break for someone: { activity, spot, seconds } or null if nothing is free.
 * The manager only goes to meetings.
 */
export function chooseBreak(name, taken, rng = Math.random) {
  if (STAYS_PUT.has(name)) {
    const spots = freeSpots('kitchen', taken);
    return spots.length && rng() < 0.3 ? { activity: 'kitchen', spot: spots[0], seconds: 20 } : null;
  }
  if (name === 'Haroon') return null;
  const options = ['kitchen', 'lounge', 'arcade'].filter((a) => freeSpots(a, taken).length);
  if (!options.length) return null;
  const total = options.reduce((n, a) => n + ACTIVITIES[a].weight, 0);
  let roll = rng() * total;
  let activity = options[options.length - 1];
  for (const a of options) {
    if (roll < ACTIVITIES[a].weight) {
      activity = a;
      break;
    }
    roll -= ACTIVITIES[a].weight;
  }
  const spots = freeSpots(activity, taken);
  const spot = spots[Math.floor(rng() * spots.length)];
  return { activity, spot, seconds: between(rng, [ACTIVITIES[activity].min, ACTIVITIES[activity].max]) };
}

/**
 * Plan a meeting from the people at their desks: 3 or 4 of them (the manager joins when free).
 * idle: names of people at their desks with no open ticket. Returns { people: [{ name, spot }], seconds } or null.
 */
export function planMeeting(idle, rng = Math.random) {
  const pool = idle.filter((n) => !STAYS_PUT.has(n));
  if (pool.length < 3) return null;
  const size = Math.min(pool.length, rng() < 0.5 ? 3 : 4);
  const chosen = [];
  if (pool.includes('Haroon')) chosen.push('Haroon');
  const others = pool.filter((n) => n !== 'Haroon').sort(() => rng() - 0.5);
  while (chosen.length < size && others.length) chosen.push(others.shift());
  return {
    people: chosen.map((name, i) => ({ name, spot: SPOTS.meeting[i] })),
    seconds: between(rng, [ACTIVITIES.meeting.min, ACTIVITIES.meeting.max]),
  };
}

/** Is somebody away from their desk right now? (modes: desk, going, there, back) */
export const isAway = (mode) => mode !== 'desk';
