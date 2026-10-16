// Run with: node --test game/tests/logic.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { circleHitsBox, moveDirection, moveWithCollisions, nearestWithin, turnToward } from '../src/logic.js';

const wall = { minX: 0, maxX: 1, minZ: -5, maxZ: 5 };
const close = (a, b) => Math.abs(a - b) < 1e-9;

test('circle touching a box collides, a circle far away does not', () => {
  assert.equal(circleHitsBox(-0.2, 0, 0.3, wall), true);
  assert.equal(circleHitsBox(-1, 0, 0.3, wall), false);
});

test('circle near a box corner uses true distance, not the bounding square', () => {
  // 0.3 left and 0.3 above the corner: distance ~0.42, radius 0.35, so no hit.
  assert.equal(circleHitsBox(-0.3, -5.3, 0.35, wall), false);
});

test('moving into a wall is blocked', () => {
  const next = moveWithCollisions({ x: -0.5, z: 0 }, 0.4, 0, 0.3, [wall]);
  assert.deepEqual(next, { x: -0.5, z: 0 });
});

test('moving diagonally into a wall slides along it', () => {
  const next = moveWithCollisions({ x: -0.5, z: 0 }, 0.4, 0.4, 0.3, [wall]);
  assert.equal(next.x, -0.5);
  assert.ok(close(next.z, 0.4));
});

test('free movement is unchanged', () => {
  assert.deepEqual(moveWithCollisions({ x: -3, z: 0 }, 0.5, -0.5, 0.3, [wall]), { x: -2.5, z: -0.5 });
});

test('nearestWithin picks the closest item inside the radius', () => {
  const people = [{ name: 'A', x: 1, z: 0 }, { name: 'B', x: 0.5, z: 0 }, { name: 'C', x: 9, z: 9 }];
  assert.equal(nearestWithin({ x: 0, z: 0 }, people, 2).name, 'B');
  assert.equal(nearestWithin({ x: 20, z: 20 }, people, 2), null);
});

test('moveDirection: W moves away from the camera, D moves to its right', () => {
  const fwd = moveDirection({ forward: true }, 0);
  assert.ok(close(fwd.x, 0) && close(fwd.z, -1)); // camera south, so forward is north (-z)
  const right = moveDirection({ right: true }, 0);
  assert.ok(close(right.x, 1) && close(right.z, 0));
  const rotated = moveDirection({ forward: true }, Math.PI / 2); // camera east, so forward is west
  assert.ok(close(rotated.x, -1) && close(rotated.z, 0));
});

test('moveDirection: diagonal input is not faster than straight', () => {
  const d = moveDirection({ forward: true, right: true }, 0);
  assert.ok(close(Math.hypot(d.x, d.z), 1));
  assert.deepEqual(moveDirection({}, 0), { x: 0, z: 0 });
  assert.deepEqual(moveDirection({ forward: true, back: true }, 0), { x: 0, z: 0 });
});

test('turnToward takes the short way round and stops at the target', () => {
  assert.ok(close(turnToward(0, 0.1, 1), 0.1));
  assert.ok(close(turnToward(0, 2, 0.5), 0.5));
  // From 3.1 to -3.1 is only ~0.08 the short way (across PI), so a small step goes UP past 3.1,
  // instead of spinning down through 0.
  assert.ok(close(turnToward(3.1, -3.1, 0.01), 3.11));
});

test('a footstep lands each time the stride passes the middle', async () => {
  const { stepsBetween } = await import('../src/logic.js');
  assert.equal(stepsBetween(0, 1), 0);
  assert.equal(stepsBetween(3, 3.2), 1); // passes pi
  assert.equal(stepsBetween(3.2, 6.2), 0);
  assert.equal(stepsBetween(6.2, 6.4), 1); // passes 2 pi
  assert.equal(stepsBetween(5, 5), 0);
});

test('the on-screen joystick moves relative to the camera, like the keys', () => {
  const keys = moveDirection({ forward: true }, 0);
  const stick = moveDirection({ stickX: 0, stickY: 1 }, 0);
  assert.ok(Math.abs(keys.x - stick.x) < 1e-9 && Math.abs(keys.z - stick.z) < 1e-9);
  const diag = moveDirection({ stickX: 0.5, stickY: 0.5 }, 0);
  assert.ok(Math.abs(Math.hypot(diag.x, diag.z) - 1) < 1e-9);
  assert.deepEqual(moveDirection({ stickX: 0, stickY: 0 }, 0), { x: 0, z: 0 });
});
