import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RUN_AT, stickFromDrag } from '../src/touch.js';

test('joystick drag: up is forward, right is right, and it is capped at the edge', () => {
  assert.deepEqual(stickFromDrag(0, -60, 60), { x: 0, y: 1, len: 1 });
  const r = stickFromDrag(30, 0, 60);
  assert.equal(r.x, 0.5);
  assert.ok(Math.abs(r.y) < 1e-9);
  const far = stickFromDrag(600, 0, 60);
  assert.equal(far.x, 1);
  assert.equal(far.len, 1);
  assert.ok(far.len >= RUN_AT);
});

test('a tiny wobble near the centre does nothing', () => {
  assert.deepEqual(stickFromDrag(3, 2, 60), { x: 0, y: 0, len: 0 });
});
