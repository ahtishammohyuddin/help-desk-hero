// Small sound effects made with the Web Audio API: no sound files to download.
// Browsers only allow audio after the player has pressed a key or clicked,
// so the audio system starts on the first sound request after that.

let ctx = null;
let master = null; // every sound goes through this, so the ♪ button can mute everything at once
const read = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback; // storage unavailable: keep default
  }
};
const write = (key, on) => {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    /* ignore */
  }
};
let allMuted = read('hdh-mute-all', false); // the ♪ button: no sound at all
let muted = read('hdh-muted', false); // sound effects off (clicks, alerts, results)
let footsteps = read('hdh-footsteps', true);

/** The shared audio system (created on first use, after the player has clicked or pressed a key). */
export function audioContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = allMuted ? 0 : 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Where every sound should connect (instead of the speakers directly). */
export function output() {
  return audioContext() ? master : null;
}

function audio() {
  return muted || allMuted ? null : audioContext();
}

// Footsteps: a soft, low "thud" (heel) and a quieter brush (sole), like shoes on carpet.
let noise = null;
function noiseBuffer(a) {
  if (!noise) {
    noise = a.createBuffer(1, Math.floor(a.sampleRate * 0.2), a.sampleRate);
    const data = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = last * 0.86 + (Math.random() * 2 - 1) * 0.14; // smoothed noise: duller, less hiss
      data[i] = last * 3;
    }
  }
  return noise;
}
let stepCount = 0;
function step() {
  if (!footsteps || allMuted) return;
  const a = audioContext();
  if (!a) return;
  const t = a.currentTime;
  const left = stepCount++ % 2 === 0;
  const vary = 0.9 + Math.random() * 0.2;
  // heel: short low thump
  const thump = a.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime((left ? 92 : 84) * vary, t);
  thump.frequency.exponentialRampToValueAtTime(48, t + 0.08);
  const tg = a.createGain();
  tg.gain.setValueAtTime(0.0001, t);
  tg.gain.exponentialRampToValueAtTime(0.045, t + 0.006);
  tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
  thump.connect(tg).connect(master);
  thump.start(t);
  thump.stop(t + 0.13);
  // sole: soft brush on the carpet
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a);
  src.playbackRate.value = vary;
  const band = a.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = left ? 420 : 380;
  band.Q.value = 0.9;
  const ng = a.createGain();
  ng.gain.setValueAtTime(0.0001, t + 0.01);
  ng.gain.exponentialRampToValueAtTime(0.03, t + 0.025);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  src.connect(band).connect(ng).connect(master);
  src.start(t + 0.01, Math.random() * 0.05, 0.15);
}

/** Play one note: frequency in Hz, start delay and duration in seconds. */
function tone(freq, start, duration, type = 'sine', volume = 0.12) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export const sound = {
  /** The ♪ button: everything off (effects, footsteps and music) or back on. */
  get allMuted() {
    return allMuted;
  },
  toggleAll() {
    allMuted = !allMuted;
    write('hdh-mute-all', allMuted);
    if (master && ctx) master.gain.setTargetAtTime(allMuted ? 0 : 1, ctx.currentTime, 0.05);
    return allMuted;
  },
  /** Sound effects only (clicks, alerts, results). */
  get muted() {
    return muted;
  },
  setEffects(on) {
    muted = !on;
    write('hdh-muted', muted);
  },
  get footsteps() {
    return footsteps;
  },
  setFootsteps(on) {
    footsteps = on;
    write('hdh-footsteps', on);
  },
  step,
  // Mini-game sounds (lounge games)
  gameStart() { tone(392, 0, 0.1, 'triangle', 0.08); tone(523, 0.1, 0.1, 'triangle', 0.08); tone(659, 0.2, 0.18, 'triangle', 0.08); },
  gamePoint() { tone(1047, 0, 0.07, 'square', 0.04); },
  gameMiss() { tone(196, 0, 0.15, 'triangle', 0.08); },
  gameWin() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.08, 0.22, 'triangle', 0.08)); },
  ticket() { tone(880, 0, 0.12); tone(1320, 0.13, 0.2); },
  urgent() { tone(988, 0, 0.1, 'square', 0.06); tone(988, 0.15, 0.1, 'square', 0.06); tone(1319, 0.3, 0.2, 'square', 0.06); },
  correct() { tone(523, 0, 0.12); tone(659, 0.1, 0.12); tone(784, 0.2, 0.25); },
  wrong() { tone(220, 0, 0.18, 'sawtooth', 0.06); tone(165, 0.16, 0.3, 'sawtooth', 0.06); },
  click() { tone(660, 0, 0.05, 'triangle', 0.06); },
  knock() { [0, 0.18, 0.36].forEach((t) => tone(110, t, 0.07, 'sine', 0.12)); }, // three knocks on a wooden door
  badge() { tone(784, 0, 0.1, 'triangle', 0.1); tone(1175, 0.1, 0.1, 'triangle', 0.1); tone(1568, 0.2, 0.3, 'triangle', 0.08); },
  rankUp() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle', 0.1)); },
};
