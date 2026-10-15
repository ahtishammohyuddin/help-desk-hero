import test from 'node:test';
import assert from 'node:assert/strict';
import { BAR_SECONDS, CHORDS, chordAt, melodyFor, MUSIC_VOLUME } from '../src/music.js';

test('the chord loop repeats every 4 bars', () => {
  assert.equal(chordAt(0), CHORDS[0]);
  assert.equal(chordAt(4), CHORDS[0]);
  assert.equal(chordAt(7), CHORDS[3]);
  assert.equal(chordAt(-1), CHORDS[3]);
});

test('melody notes come from the bar chord, an octave up, inside the bar', () => {
  for (let bar = 0; bar < 8; bar++) {
    const notes = melodyFor(bar);
    assert.equal(notes.length, 2);
    for (const n of notes) {
      assert.ok(chordAt(bar).some((f) => Math.abs(f * 2 - n.freq) < 1e-9));
      assert.ok(n.at > 0 && n.at < BAR_SECONDS);
    }
  }
});

test('music stays very quiet', () => {
  assert.ok(MUSIC_VOLUME <= 0.05);
});
