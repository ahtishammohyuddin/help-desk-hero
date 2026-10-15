import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITIES, chooseBreak, freeSpots, planMeeting, SPOTS } from '../src/life.js';

const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };

test('breaks go to a free spot for a real activity', () => {
  for (let i = 0; i < 50; i++) {
    const b = chooseBreak('Imran', new Set());
    assert.ok(['kitchen', 'lounge', 'arcade'].includes(b.activity));
    assert.ok(SPOTS[b.activity].includes(b.spot));
    assert.ok(b.seconds >= ACTIVITIES[b.activity].min && b.seconds <= ACTIVITIES[b.activity].max);
  }
});

test('taken spots are skipped, and full places are not chosen', () => {
  const taken = new Set(['a1', 'l1', 'l2', 'l3', 'l4', 'l5']);
  assert.equal(freeSpots('arcade', taken).length, 0);
  for (let i = 0; i < 30; i++) assert.equal(chooseBreak('Sana', taken).activity, 'kitchen');
  const all = new Set(Object.values(SPOTS).flat().map((s) => s.id));
  assert.equal(chooseBreak('Sana', all), null);
});

test('the manager only goes to meetings, reception mostly stays put', () => {
  assert.equal(chooseBreak('Haroon', new Set()), null);
  assert.equal(chooseBreak('Saima', new Set(), () => 0.9), null);
  assert.equal(chooseBreak('Saima', new Set(), () => 0.1).activity, 'kitchen');
});

test('meetings need at least 3 people, include the manager, and use meeting chairs', () => {
  assert.equal(planMeeting(['Ahmed', 'Saima', 'Haroon']), null); // Saima stays at reception
  const m = planMeeting(['Ahmed', 'Sana', 'Imran', 'Haroon', 'Farah'], seq(0.9, 0.3, 0.7, 0.1, 0.5));
  assert.ok(m.people.length >= 3 && m.people.length <= 4);
  assert.equal(m.people[0].name, 'Haroon');
  assert.equal(new Set(m.people.map((p) => p.spot.id)).size, m.people.length);
  for (const p of m.people) assert.ok(SPOTS.meeting.includes(p.spot));
});
