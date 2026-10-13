// Run with: node --test game/tests/tickets.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { choosePriority, maxLevelFor, PRIORITIES, rankFor, streakMultiplier, TicketQueue, xpFor } from '../src/tickets.js';

// Repeatable "random" numbers so tests always behave the same.
function seeded(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const PEOPLE = [{ name: 'Ahmed' }, { name: 'Sana' }, { name: 'Imran' }, { name: 'Farah' }];
const POOL = [
  { id: 'L1-HW-01', level: 1, category: 'Hardware' },
  { id: 'L1-HW-02', level: 1, category: 'Hardware' },
  { id: 'L1-PR-01', level: 1, category: 'Printers and scanners' },
  { id: 'L2-NW-01', level: 2, category: 'Networking and Wi-Fi' },
];

// ---------- ranks ----------

test('ranks follow XP thresholds', () => {
  assert.equal(rankFor(0).name, 'Intern');
  assert.equal(rankFor(149).name, 'Intern');
  assert.equal(rankFor(150).name, 'L1 Support');
  assert.equal(rankFor(150).next.name, 'L1+');
  assert.equal(rankFor(5000).name, 'Sysadmin');
  assert.equal(rankFor(5000).next, null);
});

test('each rank unlocks one more problem level', () => {
  assert.equal(maxLevelFor(0), 1);
  assert.equal(maxLevelFor(150), 2);
  assert.equal(maxLevelFor(99999), 5);
});

// ---------- XP ----------

const base = { level: 1, priority: 'P3', correct: true, hintsUsed: 0, secondsLeft: 60, sla: 180 };

test('wrong answers earn nothing', () => {
  assert.equal(xpFor({ ...base, correct: false }), 0);
});

test('base XP is 10 per level times the priority multiplier', () => {
  assert.equal(xpFor(base), 10);
  assert.equal(xpFor({ ...base, level: 2, priority: 'P1', sla: 75, secondsLeft: 10 }), 40);
});

test('fast answers get a 25% bonus, breached SLAs lose half', () => {
  assert.equal(xpFor({ ...base, secondsLeft: 150 }), 13); // 12.5 rounds to 13
  assert.equal(xpFor({ ...base, secondsLeft: -5 }), 5);
});

test('solving on the second try earns half XP', () => {
  assert.equal(xpFor({ ...base, level: 2, attempt: 2 }), 10);
  assert.equal(xpFor({ ...base, level: 2, attempt: 1 }), 20);
  assert.equal(xpFor({ ...base, level: 2, attempt: 2, correct: false }), 0);
});

test('each hint costs 25%, but never below a quarter', () => {
  assert.equal(xpFor({ ...base, level: 4, hintsUsed: 1 }), 30);
  assert.equal(xpFor({ ...base, level: 4, hintsUsed: 9 }), 10);
});

test('streak bonus starts at 3 in a row and grows at 5', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(streakMultiplier), [1, 1, 1, 1.2, 1.2, 1.5, 1.5]);
});

// ---------- priorities ----------

test('choosePriority only returns real priorities and respects zero weights', () => {
  const rng = seeded(7);
  for (let i = 0; i < 300; i++) {
    assert.ok(choosePriority('Hardware', rng) in PRIORITIES);
    assert.notEqual(choosePriority('Security and phishing', rng), 'P4');
    assert.notEqual(choosePriority('Customer handling', rng), 'P1');
  }
});

// ---------- queue ----------

test('first ticket arrives after the first delay', () => {
  const q = new TicketQueue({ rng: seeded(), firstDelay: 4 });
  q.setPool(POOL);
  assert.deepEqual(q.update(3, PEOPLE, 1), []);
  const [ticket] = q.update(1.5, PEOPLE, 1);
  assert.ok(ticket);
  assert.equal(ticket.secondsLeft, PRIORITIES[ticket.priority].sla);
  assert.ok(PEOPLE.some((p) => p.name === ticket.employee));
});

test('only problems at or below the allowed level are used', () => {
  const q = new TicketQueue({ rng: seeded(), firstDelay: 0, minGap: 0, maxGap: 0, maxOpen: 10 });
  q.setPool(POOL);
  for (let i = 0; i < 3; i++) q.update(0.01, PEOPLE, 1);
  assert.ok(q.open.every((t) => t.level === 1));
});

test('never more than maxOpen tickets, and one ticket per employee', () => {
  const q = new TicketQueue({ rng: seeded(), firstDelay: 0, minGap: 0, maxGap: 0, maxOpen: 3 });
  q.setPool(POOL);
  for (let i = 0; i < 10; i++) q.update(0.01, PEOPLE, 2);
  assert.equal(q.open.length, 3);
  assert.equal(new Set(q.open.map((t) => t.employee)).size, 3);
});

test('problems do not repeat until all have been used', () => {
  const q = new TicketQueue({ rng: seeded(3), firstDelay: 0, minGap: 0, maxGap: 0, maxOpen: 1 });
  q.setPool(POOL);
  const seen = [];
  for (let i = 0; i < 4; i++) {
    const [t] = q.update(0.01, PEOPLE, 2);
    seen.push(t.problemId);
    q.close(t.number);
  }
  assert.equal(new Set(seen).size, 4);
});

test('timers count down and an empty queue brings the next ticket closer', () => {
  const q = new TicketQueue({ rng: seeded(), firstDelay: 0, minGap: 30, maxGap: 30, maxOpen: 3 });
  q.setPool(POOL);
  const [t] = q.update(0.01, PEOPLE, 1);
  q.update(10, PEOPLE, 1);
  assert.ok(Math.abs(t.secondsLeft - (t.sla - 10)) < 1e-9); // a new ticket starts with its full SLA
  q.close(t.number);
  assert.equal(q.update(8.5, PEOPLE, 1).length, 1); // would have waited 30s, capped to 8
});

// ---------- gender matching ----------

const STAFF = [
  { name: 'Ahmed', gender: 'male' }, { name: 'Imran', gender: 'male' },
  { name: 'Sana', gender: 'female' }, { name: 'Nida', gender: 'female' },
];
const GENDERED = [
  { id: 'F1', level: 1, category: 'Hardware', gender: 'female', character_name: 'Hira' },
  { id: 'F2', level: 1, category: 'Hardware', gender: 'female', character_name: 'Nida' },
  { id: 'M1', level: 1, category: 'Hardware', gender: 'male', character_name: 'Salman' },
  { id: 'M2', level: 1, category: 'Hardware', gender: 'male', character_name: 'Usman' },
];

test('every ticket goes to an employee of the same gender as the problem character', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const q = new TicketQueue({ rng: seeded(seed), firstDelay: 0, minGap: 0, maxGap: 0, maxOpen: 4 });
    q.setPool(GENDERED);
    for (let i = 0; i < 4; i++) q.update(0.01, STAFF, 1);
    for (const t of q.open) {
      const problem = GENDERED.find((p) => p.id === t.problemId);
      const person = STAFF.find((e) => e.name === t.employee);
      assert.equal(person.gender, problem.gender, `seed ${seed}: ${t.problemId} went to ${t.employee}`);
    }
  }
});

test("a character who works in the office reports their own problem", () => {
  const q = new TicketQueue({ rng: seeded(5), firstDelay: 0, minGap: 0, maxGap: 0, maxOpen: 1 });
  q.setPool([GENDERED[1]]); // F2 belongs to Nida
  const [t] = q.update(0.01, STAFF, 1);
  assert.equal(t.employee, 'Nida');
});

test('if only men are free, only male problems are handed out', () => {
  const q = new TicketQueue({ rng: seeded(9), firstDelay: 0, minGap: 0, maxGap: 0, maxOpen: 5 });
  q.setPool(GENDERED);
  const men = STAFF.filter((e) => e.gender === 'male');
  for (let i = 0; i < 5; i++) q.update(0.01, men, 1);
  assert.equal(q.open.length, 2); // two men, two male problems
  assert.ok(q.open.every((t) => t.problemId.startsWith('M')));
});

test('forEmployee finds the open ticket', () => {
  const q = new TicketQueue({ rng: seeded(), firstDelay: 0 });
  q.setPool(POOL);
  const [t] = q.update(0.01, PEOPLE, 1);
  assert.equal(q.forEmployee(t.employee), t);
  assert.equal(q.forEmployee('Nobody'), null);
});

test('no tickets when everyone is busy or the pool is empty', () => {
  const q = new TicketQueue({ rng: seeded(), firstDelay: 0, minGap: 0, maxGap: 0, maxOpen: 10 });
  q.setPool([]);
  assert.deepEqual(q.update(1, PEOPLE, 1), []);
  q.setPool(POOL);
  for (let i = 0; i < 10; i++) q.update(0.01, [{ name: 'Solo' }], 2);
  assert.equal(q.open.length, 1);
});
