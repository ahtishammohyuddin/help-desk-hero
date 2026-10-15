// Run with: node --test game/tests/shift.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clockFor, recordTopic, SHIFT_SECONDS, summarizeShift, topicStatus } from '../src/shift.js';

test('the shift clock runs from 9:00 AM to 5:00 PM', () => {
  assert.equal(clockFor(0).label, '9:00 AM');
  assert.equal(clockFor(SHIFT_SECONDS / 8).label, '10:00 AM'); // one real minute = one hour
  assert.equal(clockFor(SHIFT_SECONDS * 0.375).label, '12:00 PM');
  assert.equal(clockFor(SHIFT_SECONDS * 0.5 + 45).label, '1:45 PM');
  assert.equal(clockFor(SHIFT_SECONDS).label, '5:00 PM');
  assert.equal(clockFor(SHIFT_SECONDS * 2).label, '5:00 PM'); // never past the end
  assert.equal(clockFor(-5).fraction, 0);
});

test('topic status needs enough tries before judging', () => {
  assert.equal(topicStatus(), 'new');
  assert.equal(topicStatus({ attempts: 2, firstTry: 0 }), 'learning');
  assert.equal(topicStatus({ attempts: 5, firstTry: 4 }), 'mastered');
  assert.equal(topicStatus({ attempts: 4, firstTry: 4 }), 'good'); // not enough tries for mastered
  assert.equal(topicStatus({ attempts: 4, firstTry: 1 }), 'practise');
  assert.equal(topicStatus({ attempts: 6, firstTry: 3 }), 'good');
});

test('recordTopic adds to the right counters without changing the original', () => {
  const start = { Hardware: { attempts: 1, firstTry: 1, solved: 1 } };
  const next = recordTopic(recordTopic(start, 'Hardware', 'second'), 'Printers and scanners', 'failed');
  assert.deepEqual(next.Hardware, { attempts: 2, firstTry: 1, solved: 2 });
  assert.deepEqual(next['Printers and scanners'], { attempts: 1, firstTry: 0, solved: 0 });
  assert.deepEqual(start.Hardware, { attempts: 1, firstTry: 1, solved: 1 });
});

const R = (category, outcome, extra = {}) => ({ category, outcome, overdue: false, seconds: 60, xp: 10, ...extra });

test('shift summary counts outcomes, overdue tickets, time and XP', () => {
  const s = summarizeShift(
    [
      R('Hardware', 'first', { seconds: 30, xp: 12 }),
      R('Hardware', 'second', { seconds: 90, xp: 5, overdue: true }),
      R('Printers and scanners', 'failed', { seconds: 60, xp: 0 }),
    ],
    2,
  );
  assert.equal(s.handled, 3);
  assert.equal(s.solved, 2);
  assert.equal(s.firstTry, 1);
  assert.equal(s.secondTry, 1);
  assert.equal(s.failed, 1);
  assert.equal(s.leftOpen, 2);
  assert.equal(s.overdue, 1);
  assert.equal(s.avgSeconds, 60);
  assert.equal(s.xp, 17);
  assert.equal(s.firstTryRate, 33);
  assert.deepEqual(s.byCategory.Hardware, { total: 2, firstTry: 1 });
});

test('strongest and practise topics need at least two tickets each', () => {
  const s = summarizeShift([
    R('Hardware', 'first'), R('Hardware', 'first'),
    R('Networking and Wi-Fi', 'failed'), R('Networking and Wi-Fi', 'second'),
    R('Printers and scanners', 'failed'), // only one ticket: ignored
  ]);
  assert.equal(s.strongest, 'Hardware');
  assert.equal(s.practise, 'Networking and Wi-Fi');
});

test('an empty shift has no averages or topics', () => {
  const s = summarizeShift([], 1);
  assert.equal(s.avgSeconds, null);
  assert.equal(s.firstTryRate, null);
  assert.equal(s.strongest, null);
  assert.equal(s.practise, null);
  assert.equal(s.leftOpen, 1);
});

test('the coach is sent numbers, topics and missed problem ids only', async () => {
  const { coachRequest } = await import('../src/shift.js');
  const records = [
    R('Hardware', 'first', { problemId: 'L1-HW-01' }),
    R('Hardware', 'second', { problemId: 'L1-HW-02' }),
    R('Printers and scanners', 'failed', { problemId: 'L1-PR-01' }),
    R('Printers and scanners', 'failed', { problemId: 'L1-PR-01' }),
  ];
  const body = coachRequest(summarizeShift(records, 1), records);
  assert.deepEqual(body.missed, ['L1-HW-02', 'L1-PR-01']);
  assert.equal(body.handled, 4);
  assert.equal(body.first_try, 1);
  assert.equal(body.left_open, 1);
  assert.deepEqual(body.topics, [
    { category: 'Hardware', total: 2, first_try: 1 },
    { category: 'Printers and scanners', total: 2, first_try: 0 },
  ]);
  assert.deepEqual(Object.keys(body).sort(), ['failed', 'first_try', 'handled', 'left_open', 'missed', 'overdue', 'solved', 'topics']);
});
