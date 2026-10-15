import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGrid, clearLine, findPath, isFree, nearestFree, toCell } from '../src/nav.js';

const bounds = { minX: 0, maxX: 10, minZ: 0, maxZ: 10 };
// A wall across the middle with a gap near the bottom (z 8..10).
const wall = { minX: 4.8, maxX: 5.2, minZ: 0, maxZ: 7.6 };

test('furniture and the edges are blocked', () => {
  const g = buildGrid([wall], bounds);
  const c = toCell(g, 5, 3);
  assert.equal(isFree(g, c.c, c.r), false);
  const e = toCell(g, 0.1, 5);
  assert.equal(isFree(g, e.c, e.r), false);
  const f = toCell(g, 2, 2);
  assert.equal(isFree(g, f.c, f.r), true);
});

test('a route goes round the wall through the gap', () => {
  const g = buildGrid([wall], bounds);
  const path = findPath(g, { x: 2, z: 2 }, { x: 8, z: 2 });
  assert.ok(path && path.length >= 2);
  assert.ok(path.some((p) => p.z > 7.6), 'passes through the gap');
  const end = path[path.length - 1];
  assert.ok(Math.hypot(end.x - 8, end.z - 2) < 0.6);
  let prev = { x: 2, z: 2 };
  for (const p of path) {
    assert.ok(clearLine(g, prev, p), 'each straight leg is walkable');
    prev = p;
  }
});

test('a seat inside furniture ends at the nearest free spot', () => {
  const sofa = { minX: 6, maxX: 7, minZ: 2, maxZ: 4 };
  const g = buildGrid([sofa], bounds);
  const near = nearestFree(g, 6.5, 3);
  assert.ok(near);
  assert.ok(findPath(g, { x: 1, z: 1 }, { x: 6.5, z: 3 }));
});

test('no route when the way is shut', () => {
  const g = buildGrid([{ minX: 4.8, maxX: 5.2, minZ: 0, maxZ: 10 }], bounds);
  assert.equal(findPath(g, { x: 2, z: 5 }, { x: 8, z: 5 }), null);
});
