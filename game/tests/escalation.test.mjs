import test from 'node:test';
import assert from 'node:assert/strict';
import { canSend, escalationBody, newEscalation, pickTeam, reviewSummary, TEAM_ICONS, toggleDetail } from '../src/escalation.js';

const form = {
  teams: [{ id: 'network', name: 'Network team' }, { id: 'security', name: 'Security team' }, { id: 'server', name: 'Server team' }, { id: 'vendor', name: 'Vendor support' }],
  details: [{ id: 2, text: 'c' }, { id: 0, text: 'a' }, { id: 1, text: 'b' }],
};

test('every team has an icon', () => {
  for (const t of form.teams) assert.ok(TEAM_ICONS[t.id]);
});

test('needs a team and at least one detail before sending', () => {
  let e = newEscalation(form);
  assert.equal(canSend(e), false);
  e = pickTeam(e, 'network');
  assert.equal(canSend(e), false);
  e = toggleDetail(e, 1);
  assert.equal(canSend(e), true);
  assert.equal(canSend({ ...e, sending: true }), false);
});

test('details toggle on and off, unknown ids and teams are ignored', () => {
  let e = newEscalation(form);
  e = toggleDetail(e, 2);
  e = toggleDetail(e, 0);
  e = toggleDetail(e, 2);
  e = toggleDetail(e, 9);
  assert.deepEqual(e.picked, [0]);
  assert.equal(pickTeam(e, 'helpdesk').team, null);
});

test('body sorts the detail ids', () => {
  let e = pickTeam(newEscalation(form), 'security');
  e = toggleDetail(toggleDetail(e, 2), 0);
  assert.deepEqual(escalationBody(e), { team: 'security', details: [0, 2] });
});

test('nothing changes once reviewed', () => {
  const e = { ...pickTeam(newEscalation(form), 'network'), review: { perfect: true } };
  assert.equal(pickTeam(e, 'vendor').team, 'network');
  assert.deepEqual(toggleDetail(e, 1).picked, []);
  assert.equal(canSend(e), false);
});

test('review summary counts missed and extra details', () => {
  const review = {
    perfect: false, team_correct: true,
    details: [{ send: true, chosen: true }, { send: true, chosen: false }, { send: false, chosen: true }, { send: false, chosen: false }],
  };
  assert.deepEqual(reviewSummary(review), { perfect: false, teamCorrect: true, missed: 1, extra: 1 });
});
