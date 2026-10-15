// Run with: node --test game/tests/events.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countdown, effectsAt, EVENTS, eventsStarting, planEvents, runningEvents } from '../src/events.js';
import { TicketQueue } from '../src/tickets.js';

function seeded(seed = 7) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test('a shift gets 1 or 2 events, inside the allowed window, never overlapping', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const plan = planEvents(480, { rng: seeded(seed) });
    assert.ok(plan.length >= 1 && plan.length <= 2, `seed ${seed}`);
    for (const e of plan) {
      assert.ok(e.at >= 60, `too early: ${e.at}`);
      assert.ok(e.at + EVENTS[e.id].duration <= 480 - 70, `runs into the last hour: ${e.id} at ${e.at}`);
    }
    if (plan.length === 2) {
      assert.notEqual(plan[0].id, plan[1].id);
      assert.ok(plan[0].at + EVENTS[plan[0].id].duration < plan[1].at, `overlap with seed ${seed}`);
    }
  }
});

test('unavailable events are never planned', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const plan = planEvents(480, { rng: seeded(seed), available: (id) => id === 'quiet' });
    assert.deepEqual(plan.map((e) => e.id), ['quiet']);
  }
  assert.deepEqual(planEvents(480, { available: () => false }), []);
});

test('events start once, and running events report their effects and time left', () => {
  const plan = [{ id: 'manager', at: 100 }, { id: 'vip', at: 300 }, { id: 'quiet', at: 400 }];
  assert.deepEqual(eventsStarting(plan, 99, 100).map((e) => e.id), ['manager']);
  assert.deepEqual(eventsStarting(plan, 100, 101), []);
  assert.deepEqual(runningEvents(plan, 130), [{ id: 'manager', left: 30 }]);
  assert.equal(effectsAt(plan, 130).xpMult, 1.5);
  assert.equal(effectsAt(plan, 160).xpMult, 1); // over
  assert.deepEqual(runningEvents(plan, 300), []); // instant events are not "running"
  assert.equal(effectsAt(plan, 410).paused, true);
  const wave = effectsAt([{ id: 'phishing_wave', at: 0 }], 5);
  assert.equal(wave.category, 'Security and phishing');
  assert.equal(wave.every, 12);
});

test('countdown text', () => {
  assert.equal(countdown(42), '0:42');
  assert.equal(countdown(65), '1:05');
});

// ---------- queue support for events ----------

const PEOPLE = [{ name: 'Ahmed', gender: 'male' }, { name: 'Sana', gender: 'female' }, { name: 'Imran', gender: 'male' }];
const POOL = [
  { id: 'L1-HW-01', level: 1, category: 'Hardware', gender: 'male' },
  { id: 'L1-SC-01', level: 1, category: 'Security and phishing', gender: 'female' },
  { id: 'L1-PR-01', level: 1, category: 'Printers and scanners', gender: 'male' },
];

test('spawn makes a ticket now, from a chosen category, with a forced priority and VIP flag', () => {
  const q = new TicketQueue({ rng: seeded(3) });
  q.setPool(POOL);
  const t = q.spawn(PEOPLE, 1, { category: 'Security and phishing', priority: 'P1', vip: true });
  assert.equal(t.category, 'Security and phishing');
  assert.equal(t.priority, 'P1');
  assert.equal(t.vip, true);
  assert.equal(t.employee, 'Sana'); // the only woman, matching the problem
  assert.equal(q.spawn(PEOPLE, 1, { category: 'Security and phishing' }), null); // only one such problem, already open
  assert.equal(q.hasCategory('Printers and scanners', 1), true);
  assert.equal(q.hasCategory('Servers, backups, Active Directory', 5), false);
});

test('spawn respects the open-ticket limit', () => {
  const q = new TicketQueue({ rng: seeded(4), maxOpen: 1 });
  q.setPool(POOL);
  assert.ok(q.spawn(PEOPLE, 1));
  assert.equal(q.spawn(PEOPLE, 1), null);
});

test('a paused queue still runs timers but creates no tickets', () => {
  const q = new TicketQueue({ rng: seeded(5), firstDelay: 0 });
  q.setPool(POOL);
  const first = q.update(1, PEOPLE, 1);
  assert.equal(first.length, 1);
  q.paused = true;
  q.timer = 0;
  assert.deepEqual(q.update(5, PEOPLE, 1), []);
  assert.equal(first[0].secondsLeft, first[0].sla - 5); // the 5 paused seconds still count
  q.paused = false;
  assert.equal(q.update(0.1, PEOPLE, 1).length, 1);
});
