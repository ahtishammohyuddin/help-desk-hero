// Ticket rules: priorities, SLA timers, XP, ranks, and the queue that hands out tickets.
// Pure logic (no Three.js, no browser), so it is tested with Node.

export const PRIORITIES = {
  P1: { label: 'P1 Critical', sla: 75, xp: 2.0, color: '#ff5b5b' },
  P2: { label: 'P2 High', sla: 120, xp: 1.5, color: '#ff9f43' },
  P3: { label: 'P3 Normal', sla: 180, xp: 1.0, color: '#ffd43b' },
  P4: { label: 'P4 Low', sla: 240, xp: 0.75, color: '#69db7c' },
};

export const RANKS = [
  { name: 'Intern', min: 0 },
  { name: 'L1 Support', min: 150 },
  { name: 'L1+', min: 400 },
  { name: 'L2 Engineer', min: 900 },
  { name: 'Sysadmin', min: 1800 },
];

/** Current rank, its index, and the next rank (null at the top). */
export function rankFor(xp) {
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].min) index = i;
  return { ...RANKS[index], index, next: RANKS[index + 1] ?? null };
}

/** Highest problem level the player may get: Intern gets level 1, each rank unlocks one more. */
export function maxLevelFor(xp) {
  return Math.min(rankFor(xp).index + 1, 5);
}

/**
 * XP for one ticket.
 * Base is 10 per problem level, times the priority multiplier.
 * Solved on the second try (after a mistake): half XP.
 * -25% per hint the player asked for (never below 25% of the base), half XP if the SLA was
 * breached, +25% speed bonus if answered with more than half the SLA time left.
 * Not solved: 0.
 */
export const SECOND_TRY_XP = 0.5;

/** Bonus for answering several tickets in a row right on the first try. */
export function streakMultiplier(streak) {
  if (streak >= 5) return 1.5;
  if (streak >= 3) return 1.2;
  return 1;
}

export function xpFor({ level, priority, correct, attempt = 1, hintsUsed = 0, secondsLeft, sla }) {
  if (!correct) return 0;
  let xp = 10 * level * PRIORITIES[priority].xp;
  if (attempt > 1) xp *= SECOND_TRY_XP;
  xp *= Math.max(0.25, 1 - 0.25 * hintsUsed);
  if (secondsLeft <= 0) xp *= 0.5;
  else if (secondsLeft > sla / 2) xp *= 1.25;
  return Math.round(xp);
}

// How likely each priority is, by category. Security and servers tend to be urgent.
const PRIORITY_WEIGHTS = {
  'Security and phishing': { P1: 4, P2: 4, P3: 2, P4: 0 },
  'Servers, backups, Active Directory': { P1: 5, P2: 3, P3: 2, P4: 0 },
  'Networking and Wi-Fi': { P1: 2, P2: 4, P3: 3, P4: 1 },
  'Customer handling': { P1: 0, P2: 2, P3: 5, P4: 3 },
  default: { P1: 1, P2: 3, P3: 4, P4: 2 },
};

/** Pick a priority for a problem. rng() returns a number in [0, 1). */
export function choosePriority(category, rng = Math.random) {
  const weights = PRIORITY_WEIGHTS[category] ?? PRIORITY_WEIGHTS.default;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (const [priority, weight] of Object.entries(weights)) {
    if (roll < weight) return priority;
    roll -= weight;
  }
  return 'P3';
}

function shuffle(items, rng) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Hands out tickets over time.
 * - pool: problem summaries from the backend ({ id, level, category, title, character_name, gender }).
 * - employees: people in the office ({ name, gender }). Each can have one open ticket.
 * Problems are not repeated until every allowed problem has been used.
 */
export class TicketQueue {
  constructor({ rng = Math.random, maxOpen = 3, firstDelay = 4, minGap = 28, maxGap = 42 } = {}) {
    this.rng = rng;
    this.maxOpen = maxOpen;
    this.minGap = minGap;
    this.maxGap = maxGap;
    this.timer = firstDelay;
    this.pool = [];
    this.deck = [];
    this.used = new Set();
    this.open = [];
    this.nextNumber = 1001;
    this.paused = false; // a quiet spell: timers keep running, but no new tickets arrive
  }

  setPool(problems) {
    this.pool = problems;
    this.deck = [];
  }

  /** Advance time by dt seconds. Returns the list of newly created tickets (usually empty). */
  update(dt, employees, maxLevel) {
    for (const ticket of this.open) ticket.secondsLeft -= dt;
    if (this.paused) return [];

    // Never leave the player idle for long: an empty queue brings the next ticket closer.
    if (this.open.length === 0 && this.timer > 8) this.timer = 8;
    this.timer -= dt;
    if (this.timer > 0 || this.open.length >= this.maxOpen) return [];

    this.timer = this.minGap + this.rng() * (this.maxGap - this.minGap);
    const ticket = this.#create(employees, maxLevel);
    return ticket ? [ticket] : [];
  }

  /**
   * Create a ticket now (used by events), if there is room.
   * options: category (only problems in it), priority (forced), vip (double XP, shown in the list).
   * Returns the ticket, or null if the queue is full or nothing fits.
   */
  spawn(employees, maxLevel, options = {}) {
    if (this.open.length >= this.maxOpen) return null;
    return this.#create(employees, maxLevel, options);
  }

  /** Does the pool have a problem in this category at or below this level? */
  hasCategory(category, maxLevel) {
    return this.pool.some((p) => p.category === category && p.level <= maxLevel);
  }

  #create(employees, maxLevel, { category = null, priority: forced = null, vip = false } = {}) {
    const busy = new Set(this.open.map((t) => t.employee));
    const free = employees.filter((e) => !busy.has(e.name));
    if (free.length === 0) return null;

    // Only pick problems that a free employee can "own": answer texts say he/she,
    // so a problem about a woman goes to a female employee and vice versa.
    const freeGenders = new Set(free.map((e) => e.gender));
    const fits = (p) => (!p.gender || freeGenders.has(p.gender)) && (!category || p.category === category);
    const problem = this.#drawProblem(maxLevel, fits);
    if (!problem) return null;

    const matching = free.filter((e) => !problem.gender || e.gender === problem.gender);
    // If the problem's character works in this office (same name), they report it themselves.
    const owner =
      matching.find((e) => e.name === problem.character_name) ??
      matching[Math.floor(this.rng() * matching.length)];

    const priority = forced ?? choosePriority(problem.category, this.rng);
    const ticket = {
      number: this.nextNumber++,
      problemId: problem.id,
      level: problem.level,
      category: problem.category,
      priority,
      sla: PRIORITIES[priority].sla,
      secondsLeft: PRIORITIES[priority].sla,
      employee: owner.name,
      hintsUsed: 0,
      handsOn: Boolean(problem.hands_on), // solved by investigating in the office
      vip, // a VIP request: double XP
    };
    this.open.push(ticket);
    return ticket;
  }

  /** Next problem from the shuffled deck that is allowed and fits(); refills the deck as needed. */
  #drawProblem(maxLevel, fits = () => true) {
    const openIds = new Set(this.open.map((t) => t.problemId));
    const allowed = (p) => p.level <= maxLevel && !openIds.has(p.id);
    const ok = (p) => allowed(p) && fits(p);

    this.deck = this.deck.filter(allowed);
    let index = this.deck.findLastIndex(ok);
    if (index === -1) {
      const inDeck = new Set(this.deck.map((p) => p.id));
      let fresh = this.pool.filter((p) => allowed(p) && !inDeck.has(p.id) && !this.used.has(p.id));
      if (!fresh.some(fits)) {
        this.used.clear(); // every fitting problem has been seen: start a new cycle
        fresh = this.pool.filter((p) => allowed(p) && !inDeck.has(p.id));
      }
      // New cards go underneath, so problems already in the deck come out first.
      this.deck = [...shuffle(fresh, this.rng), ...this.deck];
      index = this.deck.findLastIndex(ok);
      if (index === -1) return null;
    }
    const [problem] = this.deck.splice(index, 1);
    this.used.add(problem.id);
    return problem;
  }

  /** Remove a ticket once it has been answered. */
  close(number) {
    this.open = this.open.filter((t) => t.number !== number);
  }

  forEmployee(name) {
    return this.open.find((t) => t.employee === name) ?? null;
  }
}
