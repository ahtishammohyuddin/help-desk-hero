import test from 'node:test';
import assert from 'node:assert/strict';
import { addSeen, coffeeLeft, COFFEE_COOLDOWN, COFFEE_SECONDS, COFFEE_SPEED, drinkCoffee, emptyCoffee, libraryTopics, SEEN_MAX, speedFor } from '../src/perks.js';

test('coffee gives a short speed boost, then needs a cooldown', () => {
  let r = drinkCoffee(emptyCoffee(), 10);
  assert.equal(r.ok, true);
  assert.equal(speedFor(r.state, 11), COFFEE_SPEED);
  assert.equal(coffeeLeft(r.state, 11), COFFEE_SECONDS - 1);
  assert.equal(speedFor(r.state, 10 + COFFEE_SECONDS), 1);
  const again = drinkCoffee(r.state, 20);
  assert.equal(again.ok, false);
  assert.match(again.message, /seconds/);
  assert.equal(drinkCoffee(r.state, 10 + COFFEE_COOLDOWN).ok, true);
});

test('seen problems: no repeats, newest last, capped', () => {
  let seen = addSeen([], 'A');
  seen = addSeen(seen, 'B');
  seen = addSeen(seen, 'A');
  assert.deepEqual(seen, ['B', 'A']);
  assert.deepEqual(addSeen(seen, ''), seen);
  let many = [];
  for (let i = 0; i < SEEN_MAX + 5; i++) many = addSeen(many, `P${i}`);
  assert.equal(many.length, SEEN_MAX);
  assert.equal(many[0], 'P5');
});

test('library topics count unlocked notes per category', () => {
  const pool = [
    { id: 'L1-HW-01', category: 'Hardware', title: 'Keyboard', level: 1 },
    { id: 'L2-HW-01', category: 'Hardware', title: 'Laptop hot', level: 2 },
    { id: 'L1-PR-01', category: 'Printers and scanners', title: 'Offline', level: 1 },
  ];
  const topics = libraryTopics(pool, ['L2-HW-01', 'X']);
  assert.deepEqual(topics.map((t) => [t.category, t.total, t.unlocked.length]), [['Hardware', 2, 1], ['Printers and scanners', 1, 0]]);
  assert.equal(topics[0].unlocked[0].id, 'L2-HW-01');
});
