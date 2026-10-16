import assert from 'node:assert/strict';
import { test } from 'node:test';
import { daylight } from '../src/daylight.js';

test('the sun moves from east in the morning to west in the afternoon', () => {
  const morning = daylight(0);
  const evening = daylight(1);
  assert.equal(morning.hour, 9);
  assert.equal(evening.hour, 17);
  assert.ok(morning.sun.x > 8 && evening.sun.x < 8);
});

test('the sun is highest and brightest around midday', () => {
  const noon = daylight(3 / 8); // 12:00
  assert.ok(noon.sun.y > daylight(0).sun.y && noon.sun.y > daylight(1).sun.y);
  assert.ok(noon.sunIntensity > daylight(1).sunIntensity);
});

test('late afternoon light is warmer (more red, less blue) than midday', () => {
  const blue = (c) => c & 255;
  assert.ok(blue(daylight(1).sunColor) < blue(daylight(3 / 8).sunColor));
});

test('fractions outside the shift are clamped', () => {
  assert.deepEqual(daylight(-1), daylight(0));
  assert.deepEqual(daylight(2), daylight(1));
});
