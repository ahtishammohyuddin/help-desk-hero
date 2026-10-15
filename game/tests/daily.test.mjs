// Run with: node --test game/tests/daily.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  currentStreak, dailyPostText, dateKey, dayLabel, durationText, emptyDaily, playedOn, previousDay, recordDaily, untilTomorrow,
} from '../src/daily.js';

const R = (correct, seconds = 100) => ({ correct, total: 5, seconds, marks: [true, true, true, false, true].map((m, i) => i < correct || m) });

test('dates use the local calendar', () => {
  assert.equal(dateKey(new Date(2026, 9, 6)), '2026-10-06');
  assert.equal(previousDay('2026-10-01'), '2026-09-30');
  assert.equal(previousDay('2026-01-01'), '2025-12-31');
  assert.equal(previousDay('2028-03-01'), '2028-02-29'); // leap year
  assert.equal(dayLabel('2026-10-16'), '16 October 2026');
});

test('one try per day, and the streak grows on back-to-back days', () => {
  let s = emptyDaily();
  s = recordDaily(s, '2026-10-14', R(3));
  assert.equal(s.streak, 1);
  assert.equal(recordDaily(s, '2026-10-14', R(5)), s); // second try the same day is ignored
  s = recordDaily(s, '2026-10-15', R(4));
  s = recordDaily(s, '2026-10-16', R(5));
  assert.equal(s.streak, 3);
  assert.equal(s.best, 3);
  assert.equal(playedOn(s, '2026-10-16'), true);
  assert.equal(playedOn(s, '2026-10-17'), false);
});

test('missing a day starts the streak again, but the best is kept', () => {
  let s = recordDaily(recordDaily(emptyDaily(), '2026-10-01', R(5)), '2026-10-02', R(5));
  s = recordDaily(s, '2026-10-05', R(2));
  assert.equal(s.streak, 1);
  assert.equal(s.best, 2);
});

test('the shown streak drops to 0 once a day is missed', () => {
  const s = recordDaily(emptyDaily(), '2026-10-10', R(4));
  assert.equal(currentStreak(s, '2026-10-10'), 1);
  assert.equal(currentStreak(s, '2026-10-11'), 1); // can still keep it going today
  assert.equal(currentStreak(s, '2026-10-12'), 0);
});

test('share text shows squares and the score, never the answers', () => {
  const text = dailyPostText('2026-10-16', { correct: 4, total: 5, seconds: 161, marks: [true, true, false, true, true] }, 3);
  assert.match(text, /daily challenge, 16 October 2026/);
  assert.match(text, /🟩🟩🟥🟩🟩 4\/5 in 2:41/);
  assert.match(text, /3 days in a row/);
  assert.doesNotMatch(dailyPostText('2026-10-16', { correct: 5, total: 5, seconds: 60, marks: [true, true, true, true, true] }, 1), /days in a row/);
});

test('time helpers', () => {
  assert.equal(durationText(161), '2:41');
  assert.equal(untilTomorrow(new Date(2026, 9, 16, 18, 48, 0)), '5h 12m');
});
