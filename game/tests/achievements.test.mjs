// Run with: node --test game/tests/achievements.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACHIEVEMENTS, award, newlyEarned } from '../src/achievements.js';

const fresh = (extra = {}) => ({ xp: 0, solved: 0, attempts: 0, firstTry: 0, streak: 0, bestStreak: 0, topics: {}, shifts: 0, achievements: {}, ...extra });
const ids = (badges) => badges.map((b) => b.id).sort();
const ticket = (extra = {}) => ({ type: 'ticket', priority: 'P3', outcome: 'first', overdue: false, secondsLeft: 10, sla: 180, ...extra });
const summary = (extra = {}) => ({ solved: 5, overdue: 0, failed: 0, leftOpen: 0, ...extra });

test('every badge has a unique id, a name and a description', () => {
  const seen = new Set();
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.id && a.name && a.description, a.id);
    assert.ok(!seen.has(a.id), `duplicate ${a.id}`);
    seen.add(a.id);
  }
});

test('a brand new player has no badges', () => {
  assert.deepEqual(newlyEarned(fresh()), []);
});

test('the first solved ticket earns "First fix" once', () => {
  const p = fresh({ solved: 1 });
  assert.deepEqual(ids(newlyEarned(p, ticket())), ['first-fix']);
  p.achievements = award(p.achievements, newlyEarned(p, ticket()), 123);
  assert.equal(p.achievements['first-fix'], 123);
  assert.deepEqual(newlyEarned(p, ticket()), []); // never twice
});

test('ticket badges depend on what happened to that ticket', () => {
  const have = { 'first-fix': 1 };
  const p = fresh({ solved: 1, achievements: have });
  assert.deepEqual(ids(newlyEarned(p, ticket({ outcome: 'second' }))), ['second-chance']);
  assert.deepEqual(ids(newlyEarned(p, ticket({ priority: 'P1', sla: 75, secondsLeft: 20 }))), ['firefighter']);
  assert.deepEqual(newlyEarned(p, ticket({ priority: 'P1', overdue: true, secondsLeft: 0 })), []); // late does not count
  assert.deepEqual(newlyEarned(p, ticket({ priority: 'P1', outcome: 'failed' })), []);
  assert.deepEqual(ids(newlyEarned(p, ticket({ secondsLeft: 91 }))), ['speedy']);
  assert.deepEqual(newlyEarned(p, ticket({ secondsLeft: 90 })), []); // exactly half is not "more than half"
});

test('ticket-only badges are not given on load or at the end of a shift', () => {
  const p = fresh({ solved: 1, achievements: { 'first-fix': 1 } });
  assert.deepEqual(newlyEarned(p, { type: 'load' }), []);
  assert.deepEqual(newlyEarned(p, { type: 'shift', summary: summary({ solved: 1 }) }), []);
});

test('a clean shift needs 5 solved and nothing late, failed or left open', () => {
  const p = fresh({ shifts: 1, achievements: { 'first-shift': 1 } });
  const shift = (s) => newlyEarned(p, { type: 'shift', summary: summary(s) });
  assert.deepEqual(ids(shift({})), ['clean-shift']);
  assert.deepEqual(shift({ solved: 4 }), []);
  assert.deepEqual(shift({ overdue: 1 }), []);
  assert.deepEqual(shift({ failed: 1 }), []);
  assert.deepEqual(shift({ leftOpen: 1 }), []);
});

test('players who already had progress get their earned badges on load', () => {
  const topics = {
    Hardware: { attempts: 6, firstTry: 5, solved: 6 }, // mastered
    'Printers and scanners': { attempts: 1, firstTry: 1, solved: 1 },
    'Operating systems': { attempts: 1, firstTry: 0, solved: 1 },
    'Accounts and passwords': { attempts: 1, firstTry: 1, solved: 1 },
    'Email and Outlook': { attempts: 1, firstTry: 1, solved: 1 },
    'Networking and Wi-Fi': { attempts: 2, firstTry: 0, solved: 0 }, // tried but never solved
  };
  const p = fresh({ xp: 2000, solved: 30, bestStreak: 4, shifts: 2, topics });
  assert.deepEqual(ids(newlyEarned(p)), ['first-fix', 'first-shift', 'solved-25', 'streak-3', 'top-rank', 'topic-master']);
  // A sixth solved topic makes an all-rounder.
  p.topics = { ...topics, Software: { attempts: 1, firstTry: 1, solved: 1 } };
  assert.ok(ids(newlyEarned(p)).includes('all-rounder'));
});

test('award keeps the first time a badge was earned and does not change the original', () => {
  const start = { 'first-fix': 5 };
  const next = award(start, [{ id: 'first-fix' }, { id: 'streak-3' }], 9);
  assert.deepEqual(next, { 'first-fix': 5, 'streak-3': 9 });
  assert.deepEqual(start, { 'first-fix': 5 });
});
