// Very quiet, calm background music, made in code (no music files, nothing to license).
// A slow loop of soft chords with a few gentle notes on top. Pure timing helpers are
// exported for tests; play/stop use the Web Audio API.

import { audioContext } from './sound.js';

export const MUSIC_KEY = 'hdh-music';
export const BAR_SECONDS = 4; // one chord every 4 seconds
export const MUSIC_VOLUME = 0.035; // kept well under the sound effects

// C major 7, A minor 7, F major 7, G6: a calm, unresolved loop.
export const CHORDS = [
  [261.63, 329.63, 392.0, 493.88],
  [220.0, 261.63, 329.63, 392.0],
  [174.61, 220.0, 261.63, 329.63],
  [196.0, 246.94, 293.66, 329.63],
];

/** The chord for bar number n (loops forever). */
export const chordAt = (bar) => CHORDS[((bar % CHORDS.length) + CHORDS.length) % CHORDS.length];

/** Gentle melody notes for one bar: [{ freq, at }] with at in seconds from the bar start. */
export function melodyFor(bar) {
  const chord = chordAt(bar);
  // A different two-note pattern each bar, an octave up, so it never feels busy.
  const picks = [[3, 1], [2, 0], [1, 3], [0, 2]][bar % 4];
  return picks.map((i, k) => ({ freq: chord[i] * 2, at: 1 + k * 1.5 }));
}

let on = (() => {
  try {
    const v = localStorage.getItem(MUSIC_KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
})();
let master = null;
let timer = null;
let nextBar = 0;
let nextTime = 0;

function note(a, freq, start, duration, peak, type = 'sine') {
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + duration * 0.35); // slow swell
  gain.gain.linearRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function schedule() {
  const a = audioContext();
  if (!a || !master) return;
  // Keep about 2 bars queued ahead of the clock.
  while (nextTime < a.currentTime + BAR_SECONDS * 2) {
    for (const f of chordAt(nextBar)) note(a, f, nextTime, BAR_SECONDS * 1.6, 0.25, 'triangle');
    for (const m of melodyFor(nextBar)) note(a, m.freq, nextTime + m.at, 2.2, 0.18);
    nextBar += 1;
    nextTime += BAR_SECONDS;
  }
}

export const music = {
  get on() {
    return on;
  },
  get playing() {
    return timer !== null;
  },
  /** Start playing if music is switched on (call after a click or key press). */
  start() {
    if (!on || timer) return;
    const a = audioContext();
    if (!a) return;
    master = a.createGain();
    const filter = a.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400; // soft and warm, no sharp edges
    master.gain.setValueAtTime(0.0001, a.currentTime);
    master.gain.linearRampToValueAtTime(MUSIC_VOLUME, a.currentTime + 3); // fade in
    master.connect(filter).connect(a.destination);
    nextTime = a.currentTime + 0.1;
    schedule();
    timer = setInterval(schedule, 1000);
  },
  stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
    const a = audioContext();
    if (a && master) {
      const m = master;
      m.gain.cancelScheduledValues(a.currentTime);
      m.gain.setValueAtTime(m.gain.value, a.currentTime);
      m.gain.linearRampToValueAtTime(0.0001, a.currentTime + 1); // fade out
      setTimeout(() => m.disconnect(), 1500);
    }
    master = null;
  },
  set(next) {
    on = next;
    try {
      localStorage.setItem(MUSIC_KEY, on ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (on) this.start();
    else this.stop();
  },
};
