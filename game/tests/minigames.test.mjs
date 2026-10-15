import test from 'node:test';
import assert from 'node:assert/strict';
import {
  closeMismatch, DASH_HIT_Y, dashScore, dropStack, flipCard, isBest, KIT, newDash, newMatch, newSimon, newStack, pickLine, pressSimon,
  simonScore, stackScore, steerDash, tickDash, tickStack, TYPING_LINES, typingScore,
} from '../src/minigames.js';

test('packet dash: steering stays inside the lanes, and a firewall ends the run', () => {
  let s = newDash();
  s = steerDash(steerDash(steerDash(s, -1), -1), -1);
  assert.equal(s.lane, 0);
  s = steerDash(steerDash(steerDash(s, 1), 1), 1);
  assert.equal(s.lane, 2);
  const crash = tickDash({ ...newDash(), lane: 1, blocks: [{ lane: 1, y: DASH_HIT_Y - 0.01 }] }, 0.01);
  assert.equal(crash.over, true);
  const safe = tickDash({ ...newDash(), lane: 0, blocks: [{ lane: 1, y: DASH_HIT_Y - 0.01 }] }, 0.01);
  assert.equal(safe.over, false);
});

test('packet dash: never blocks all three lanes, distance grows', () => {
  let s = newDash();
  for (let i = 0; i < 200; i++) {
    s = tickDash({ ...s, over: false, lane: -9 }, 0.05);
    const rows = new Map();
    for (const b of s.blocks) rows.set(b.y.toFixed(3), (rows.get(b.y.toFixed(3)) ?? 0) + 1);
    for (const n of rows.values()) assert.ok(n <= 2);
  }
  assert.ok(dashScore(s) > 0);
});

test('server stack: overhang is cut, a miss ends it, perfect keeps the width', () => {
  let s = newStack();
  s = { ...s, moving: { x: 0.35, w: 0.5, dir: 1 } };
  let r = dropStack(s);
  assert.equal(r.result, 'placed');
  assert.ok(Math.abs(r.state.layers[1].w - 0.4) < 1e-9);
  r = dropStack({ ...r.state, moving: { x: 0.35, w: 0.4, dir: 1 } });
  assert.equal(r.result, 'perfect');
  assert.equal(stackScore(r.state), 2);
  const miss = dropStack({ ...r.state, moving: { x: 0.9, w: 0.1, dir: 1 } });
  assert.equal(miss.result, 'miss');
  assert.equal(miss.state.over, true);
  const moved = tickStack({ ...newStack(), moving: { x: 0.49, w: 0.5, dir: 1 } }, 1);
  assert.equal(moved.moving.dir, -1); // bounced off the side
});

test('switch lights: repeat the pattern, it grows, a wrong pad ends it', () => {
  let s = newSimon(() => 0);
  assert.deepEqual(s.pattern, [0]);
  let r = pressSimon(s, 0, () => 0.5);
  assert.equal(r.result, 'round');
  assert.deepEqual(r.state.pattern, [0, 2]);
  r = pressSimon(r.state, 0);
  assert.equal(r.result, 'good');
  r = pressSimon(r.state, 3);
  assert.equal(r.result, 'wrong');
  assert.equal(simonScore(r.state), 1);
});

test('kit match: every item appears twice and pairs are found', () => {
  const s = newMatch(() => 0.5);
  assert.equal(s.deck.length, KIT.length * 2);
  for (const face of KIT) assert.equal(s.deck.filter((c) => c.face === face).length, 2);
  const a = 0;
  const b = s.deck.findIndex((c, i) => i !== a && c.face === s.deck[a].face);
  const wrong = s.deck.findIndex((c) => c.face !== s.deck[a].face);
  let r = flipCard(s, a);
  assert.equal(r.result, 'open');
  const miss = flipCard(r.state, wrong);
  assert.equal(miss.result, 'miss');
  assert.equal(flipCard(miss.state, b).result, 'ignored'); // two already open
  r = flipCard(closeMismatch(miss.state), a);
  r = flipCard(r.state, b);
  assert.equal(r.result, 'match');
  assert.equal(r.state.moves, 2);
});

test('kit match: finishing every pair ends the game', () => {
  let s = newMatch(() => 0.3);
  for (const face of KIT) {
    const [i, j] = s.deck.map((c, k) => (c.face === face ? k : -1)).filter((k) => k >= 0);
    s = flipCard(flipCard(s, i).state, j).state;
  }
  assert.equal(s.over, true);
  assert.equal(s.moves, KIT.length);
});

test('quick typer: speed and accuracy', () => {
  const line = 'abcde abcde';
  assert.deepEqual(typingScore(line, line, 12), { wpm: 11, accuracy: 100, done: true });
  assert.equal(typingScore(line, 'abxde', 6).accuracy, 80);
  assert.equal(typingScore(line, '', 0).wpm, 0);
  assert.equal(typingScore(line, 'a', 0.1).wpm, 0); // too early to measure
  assert.ok(TYPING_LINES.includes(pickLine(() => 0.99)));
});

test('best scores: higher is better, except kit match moves', () => {
  const best = { dash: 10, match: 12, typer: 40 };
  assert.equal(isBest(best, 'dash', 11), true);
  assert.equal(isBest(best, 'typer', 39), false);
  assert.equal(isBest(best, 'match', 10), true);
  assert.equal(isBest({ ...best, match: 0 }, 'match', 20), true);
  assert.equal(isBest(best, 'match', 0), false);
});
