import assert from 'node:assert/strict';
import { test } from 'node:test';
import { doorShouldOpen, inDoorway, insideOffice, knockAnswer, PERMIT_SECONDS } from '../src/door.js';

const outside = { x: 33, z: -3.5 };
const inside = { x: 40, z: -8 };

test('the door is shut to a player who has not knocked or been called', () => {
  assert.equal(doorShouldOpen({ called: false, permitUntil: 0, now: 10, player: outside, managerNear: false }), false);
});

test('the door opens when the manager asked for help, after a "come in", or for the manager himself', () => {
  const base = { called: false, permitUntil: 0, now: 10, player: outside, managerNear: false };
  assert.equal(doorShouldOpen({ ...base, called: true }), true);
  assert.equal(doorShouldOpen({ ...base, permitUntil: 20 }), true);
  assert.equal(doorShouldOpen({ ...base, permitUntil: 5 }), false); // the "come in" ran out
  assert.equal(doorShouldOpen({ ...base, managerNear: true }), true);
});

test('the door never shuts on someone inside the office or in the doorway', () => {
  const base = { called: false, permitUntil: 0, now: 10, managerNear: false };
  assert.equal(insideOffice(inside), true);
  assert.equal(insideOffice({ x: 40, z: 5 }), false); // the phone booths side
  assert.equal(doorShouldOpen({ ...base, player: inside }), true);
  assert.equal(inDoorway({ x: 36.1, z: -3.5 }), true);
  assert.equal(doorShouldOpen({ ...base, player: { x: 36.1, z: -3.5 }, wasOpen: true }), true);
  // Walking up to a shut door does not open it.
  assert.equal(doorShouldOpen({ ...base, player: { x: 35.7, z: -3.5 }, wasOpen: false }), false);
});

test('knocking: he says come in when at his desk, no answer when away', () => {
  const yes = knockAnswer({ managerAtDesk: true, now: 100, pick: 1 });
  assert.equal(yes.allowed, true);
  assert.equal(yes.permitUntil, 100 + PERMIT_SECONDS);
  assert.match(yes.line, /come in/i);
  const no = knockAnswer({ managerAtDesk: false, now: 100 });
  assert.equal(no.allowed, false);
  assert.match(no.line, /not in his office/);
});
