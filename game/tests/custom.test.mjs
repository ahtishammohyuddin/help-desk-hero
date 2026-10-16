import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  coffeeSecondsFor, DEFAULT_LOOK, DESK_UPGRADES, lookColors, newlyUnlocked, nextUpgrade, parseLook, setLookPart, unlockedUpgrades,
} from '../src/custom.js';

test('a missing, broken or odd saved look falls back to the default', () => {
  assert.deepEqual(parseLook(null), DEFAULT_LOOK);
  assert.deepEqual(parseLook('not json'), DEFAULT_LOOK);
  assert.deepEqual(parseLook('{"shirt":"pink","hair":"brown"}'), { ...DEFAULT_LOOK, hair: 'brown' });
});

test('changing one part keeps the rest; unknown choices are ignored', () => {
  const look = setLookPart(DEFAULT_LOOK, 'shirt', 'green');
  assert.equal(look.shirt, 'green');
  assert.equal(look.hair, DEFAULT_LOOK.hair);
  assert.equal(setLookPart(look, 'shirt', 'rainbow'), look);
  assert.equal(setLookPart(look, 'hat', 'red'), look);
  assert.equal(lookColors(look).shirt, 0x2f8f5b);
});

test('desk upgrades unlock by total XP, in order, and never take XP away', () => {
  assert.deepEqual(unlockedUpgrades(0), []);
  assert.deepEqual(unlockedUpgrades(250), ['plant', 'mug']);
  assert.deepEqual(unlockedUpgrades(99999), DESK_UPGRADES.map((u) => u.id));
  assert.deepEqual(newlyUnlocked(180, 420).map((u) => u.id), ['mug', 'lamp']);
  assert.deepEqual(newlyUnlocked(420, 430), []);
  assert.equal(nextUpgrade(250).id, 'lamp');
  assert.equal(nextUpgrade(250).needed, 150);
  assert.equal(nextUpgrade(99999), null);
});

test('only the mug changes play: a slightly longer coffee boost', () => {
  assert.equal(coffeeSecondsFor(0, 45), 45);
  assert.equal(coffeeSecondsFor(200, 45), 60);
  assert.equal(DESK_UPGRADES.filter((u) => u.perk).length, 1);
});
