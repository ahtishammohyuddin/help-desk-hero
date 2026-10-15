import test from 'node:test';
import assert from 'node:assert/strict';
import { beatFor, CHORDS, chordAt, melodyFor, STYLES, VOLUMES } from '../src/music.js';

test('the chord loop repeats every 4 bars', () => {
  assert.equal(chordAt(0), CHORDS[0]);
  assert.equal(chordAt(4), CHORDS[0]);
  assert.equal(chordAt(7), CHORDS[3]);
  assert.equal(chordAt(-1), CHORDS[3]);
});

test('every style keeps its notes inside the bar and uses the bar chord', () => {
  for (const style of Object.values(STYLES)) {
    for (let bar = 0; bar < 8; bar++) {
      for (const n of melodyFor(bar, style)) {
        assert.ok(chordAt(bar).some((f) => Math.abs(f * 2 - n.freq) < 1e-9));
        assert.ok(n.at >= 0 && n.at < style.bar);
      }
    }
  }
});

test('styles are slow and calm, only lo-fi has a beat', () => {
  for (const [id, s] of Object.entries(STYLES)) {
    assert.ok(s.bar >= 4, id);
    assert.equal(beatFor(s).length > 0, id === 'lofi');
  }
  for (const d of beatFor(STYLES.lofi)) assert.ok(d.at < STYLES.lofi.bar);
});

test('volume levels stay quiet', () => {
  assert.ok(VOLUMES.low < VOLUMES.medium && VOLUMES.medium < VOLUMES.high);
  assert.ok(VOLUMES.high <= 0.06);
});
