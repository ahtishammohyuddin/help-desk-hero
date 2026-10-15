import test from 'node:test';
import assert from 'node:assert/strict';
import { greetingFor, hasSave, LOADING_STEPS, LOADING_TIPS, loadingStep, menuState, tipAt } from '../src/menu.js';

const fresh = { xp: 0, shifts: 0, attempts: 0 };

test('greeting follows the player clock', () => {
  assert.equal(greetingFor(new Date(2026, 9, 16, 9)), 'Good morning');
  assert.equal(greetingFor(new Date(2026, 9, 16, 13)), 'Good afternoon');
  assert.equal(greetingFor(new Date(2026, 9, 16, 21)), 'Good evening');
});

test('a new player is asked for a name and starts a first shift', () => {
  const m = menuState(fresh, '', new Date(2026, 9, 16, 9));
  assert.equal(m.needsName, true);
  assert.equal(m.primary, 'Start my first shift');
  assert.equal(m.canReset, false);
});

test('a returning player is greeted by name and can continue', () => {
  const m = menuState({ xp: 420, shifts: 3, attempts: 30 }, '  Ahtisham  ', new Date(2026, 9, 16, 21));
  assert.equal(m.name, 'Ahtisham');
  assert.equal(m.greeting, 'Good evening, Ahtisham');
  assert.equal(m.primary, 'Continue');
  assert.match(m.subtitle, /L1\+, 420 XP/);
  assert.equal(m.canReset, true);
});

test('names are cleaned: too short or only spaces counts as no name', () => {
  assert.equal(menuState(fresh, ' a ').needsName, true);
  assert.equal(menuState(fresh, 'x'.repeat(80)).name.length, 40);
});

test('save detection', () => {
  assert.equal(hasSave(fresh), false);
  assert.equal(hasSave({ ...fresh, attempts: 1 }), true);
  assert.equal(hasSave(null), false);
});

test('loading steps fill the bar in order and tips rotate', () => {
  const at = LOADING_STEPS.map((s) => s.at);
  assert.deepEqual(at, [...at].sort((a, b) => a - b));
  assert.equal(loadingStep('ready').at, 100);
  assert.equal(loadingStep('nope').id, 'office');
  assert.equal(tipAt(0), LOADING_TIPS[0]);
  assert.equal(tipAt(5), LOADING_TIPS[1]);
  assert.equal(tipAt(5 * LOADING_TIPS.length), LOADING_TIPS[0]);
});

test('during a shift the main button goes back to it', () => {
  assert.equal(menuState(fresh, 'Sana', new Date(), { inShift: true }).primary, 'Back to my shift');
});
