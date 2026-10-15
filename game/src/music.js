// Quiet background music, made in code (no music files, nothing to license).
// Four styles to choose from, three volume levels, all slow and calm.
// The timing helpers are pure and tested; play/stop use the Web Audio API.

import { audioContext, output } from './sound.js';

export const MUSIC_KEY = 'hdh-music';
export const STYLE_KEY = 'hdh-music-style';
export const VOLUME_KEY = 'hdh-music-volume';

export const VOLUMES = { low: 0.018, medium: 0.032, high: 0.055 };

// C major 7, A minor 7, F major 7, G6: a calm, unresolved loop.
export const CHORDS = [
  [261.63, 329.63, 392.0, 493.88],
  [220.0, 261.63, 329.63, 392.0],
  [174.61, 220.0, 261.63, 329.63],
  [196.0, 246.94, 293.66, 329.63],
];

export const STYLES = {
  calm: { name: 'Calm chords', bar: 6, pad: 'triangle', padLevel: 0.25, melody: 2, filter: 1300 },
  ambient: { name: 'Ambient', bar: 10, pad: 'sine', padLevel: 0.32, melody: 0, filter: 900 },
  piano: { name: 'Soft piano', bar: 6, pad: null, padLevel: 0, melody: 0, arpeggio: 6, filter: 2200 },
  lofi: { name: 'Lo-fi beat', bar: 4, pad: 'sine', padLevel: 0.22, melody: 0, beat: true, filter: 1600 },
};
export const BAR_SECONDS = STYLES.calm.bar; // kept for older code and tests
export const MUSIC_VOLUME = VOLUMES.medium;

/** The chord for bar number n (loops forever). */
export const chordAt = (bar) => CHORDS[((bar % CHORDS.length) + CHORDS.length) % CHORDS.length];

/** Gentle melody notes for one bar: [{ freq, at }] with at in seconds from the bar start. */
export function melodyFor(bar, style = STYLES.calm) {
  const chord = chordAt(bar);
  const out = [];
  if (style.melody) {
    const picks = [[3, 1], [2, 0], [1, 3], [0, 2]][bar % 4];
    picks.slice(0, style.melody).forEach((i, k) => out.push({ freq: chord[i] * 2, at: style.bar * (0.2 + k * 0.35), length: 2.6 }));
  }
  if (style.arpeggio) {
    const gap = style.bar / style.arpeggio;
    for (let k = 0; k < style.arpeggio; k++) out.push({ freq: chord[[0, 1, 2, 3, 2, 1][k % 6]] * 2, at: k * gap, length: 1.6, pluck: true });
  }
  return out;
}

/** Drum hits for one bar of the lo-fi style: [{ kind: 'kick' | 'hat', at }]. */
export function beatFor(style) {
  if (!style.beat) return [];
  const beat = style.bar / 4;
  return [
    { kind: 'kick', at: 0 }, { kind: 'hat', at: beat * 0.5 }, { kind: 'hat', at: beat * 1.5 },
    { kind: 'kick', at: beat * 2 }, { kind: 'hat', at: beat * 2.5 }, { kind: 'hat', at: beat * 3.5 },
  ];
}

const readKey = (key, fallback, allowed) => {
  try {
    const v = localStorage.getItem(key);
    return v !== null && (!allowed || allowed.includes(v)) ? v : fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

let on = readKey(MUSIC_KEY, '1') === '1';
let style = readKey(STYLE_KEY, 'calm', Object.keys(STYLES));
let volume = readKey(VOLUME_KEY, 'low', Object.keys(VOLUMES));
let bus = null;
let timer = null;
let nextBar = 0;
let nextTime = 0;

function note(a, freq, start, duration, peak, type = 'sine', pluck = false) {
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  if (pluck) {
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.02); // quick strike, long fade: like a piano
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  } else {
    gain.gain.linearRampToValueAtTime(peak, start + duration * 0.35); // slow swell
    gain.gain.linearRampToValueAtTime(0.0001, start + duration);
  }
  osc.connect(gain).connect(bus);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function drum(a, kind, start) {
  const gain = a.createGain();
  if (kind === 'kick') {
    const osc = a.createOscillator();
    osc.frequency.setValueAtTime(110, start);
    osc.frequency.exponentialRampToValueAtTime(45, start + 0.18);
    gain.gain.setValueAtTime(0.5, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
    osc.connect(gain).connect(bus);
    osc.start(start);
    osc.stop(start + 0.3);
  } else {
    const buffer = a.createBuffer(1, Math.floor(a.sampleRate * 0.05), a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = a.createBufferSource();
    src.buffer = buffer;
    const hp = a.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;
    gain.gain.value = 0.08;
    src.connect(hp).connect(gain).connect(bus);
    src.start(start);
  }
}

function schedule() {
  const a = audioContext();
  if (!a || !bus) return;
  const s = STYLES[style];
  while (nextTime < a.currentTime + s.bar * 2) {
    if (s.pad) for (const f of chordAt(nextBar)) note(a, f, nextTime, s.bar * 1.6, s.padLevel, s.pad);
    for (const m of melodyFor(nextBar, s)) note(a, m.freq, nextTime + m.at, m.length, m.pluck ? 0.35 : 0.18, 'sine', m.pluck);
    for (const d of beatFor(s)) drum(a, d.kind, nextTime + d.at);
    nextBar += 1;
    nextTime += s.bar;
  }
}

function startPlaying() {
  const a = audioContext();
  const out = output();
  if (!a || !out) return;
  bus = a.createGain();
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = STYLES[style].filter; // soft and warm, no sharp edges
  bus.gain.setValueAtTime(0.0001, a.currentTime);
  bus.gain.linearRampToValueAtTime(VOLUMES[volume], a.currentTime + 3); // fade in
  bus.connect(filter).connect(out);
  nextTime = a.currentTime + 0.1;
  schedule();
  timer = setInterval(schedule, 1000);
}

function stopPlaying() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  const a = audioContext();
  if (a && bus) {
    const b = bus;
    b.gain.cancelScheduledValues(a.currentTime);
    b.gain.setValueAtTime(b.gain.value, a.currentTime);
    b.gain.linearRampToValueAtTime(0.0001, a.currentTime + 1); // fade out
    setTimeout(() => b.disconnect(), 1500);
  }
  bus = null;
}

export const music = {
  get on() {
    return on;
  },
  get playing() {
    return timer !== null;
  },
  get style() {
    return style;
  },
  get volume() {
    return volume;
  },
  /** Start playing if music is switched on (call after a click or key press). */
  start() {
    if (on && !timer) startPlaying();
  },
  set(next) {
    on = next;
    save(MUSIC_KEY, on ? '1' : '0');
    if (on) this.start();
    else stopPlaying();
  },
  setStyle(next) {
    if (!STYLES[next] || next === style) return;
    style = next;
    save(STYLE_KEY, style);
    if (timer) {
      stopPlaying();
      setTimeout(() => this.start(), 1100); // let the old style fade out first
    }
  },
  setVolume(next) {
    if (!VOLUMES[next]) return;
    volume = next;
    save(VOLUME_KEY, volume);
    const a = audioContext();
    if (a && bus) bus.gain.setTargetAtTime(VOLUMES[volume], a.currentTime, 0.3);
  },
};
