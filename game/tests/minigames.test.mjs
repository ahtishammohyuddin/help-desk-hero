import test from 'node:test';
import assert from 'node:assert/strict';
import {
  closeMismatch, flipCard, hitRush, isBest, KIT, newMatch, newRush, pickLine, RUSH_SECONDS, rushPace, tickRush, TYPING_LINES, typingScore,
} from '../src/minigames.js';

test('ticket rush: tickets appear, can be hit, and expire as misses', () => {
  let s = tickRush(newRush(), 0.5, () => 0);
  const idx = s.cells.findIndex(Boolean);
  assert.equal(idx, 0);
  const hit = hitRush(s, idx);
  assert.equal(hit.hit, true);
  assert.equal(hit.state.score, 1);
  assert.equal(hitRush(hit.state, idx).hit, false); // nothing left there
  s = tickRush(s, 2, () => 0); // the first ticket times out
  assert.ok(s.missed >= 1);
});

test('ticket rush: ends after the time and speeds up', () => {
  let s = newRush();
  for (let t = 0; t < RUSH_SECONDS + 1; t += 0.5) s = tickRush(s, 0.5);
  assert.equal(s.over, true);
  assert.ok(rushPace(25).life < rushPace(0).life);
  assert.ok(rushPace(25).gap < rushPace(0).gap);
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
  const best = { rush: 10, match: 12, typer: 40 };
  assert.equal(isBest(best, 'rush', 11), true);
  assert.equal(isBest(best, 'typer', 39), false);
  assert.equal(isBest(best, 'match', 10), true);
  assert.equal(isBest({ ...best, match: 0 }, 'match', 20), true);
  assert.equal(isBest(best, 'match', 0), false);
});
