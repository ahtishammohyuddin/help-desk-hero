// Small sound effects made with the Web Audio API: no sound files to download.
// Browsers only allow audio after the player has pressed a key or clicked,
// so the audio system starts on the first sound request after that.

let ctx = null;
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
let muted = read('hdh-muted', false); // sound effects off
let footsteps = read('hdh-footsteps', true);

/** The shared audio system (created on first use, after the player has clicked or pressed a key). */
export function audioContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function audio() {
  return muted ? null : audioContext();
}

// A short burst of soft noise, reused for every footstep.
let noise = null;
function noiseBuffer(a) {
  if (!noise) {
    noise = a.createBuffer(1, Math.floor(a.sampleRate * 0.12), a.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  }
  return noise;
}
let stepCount = 0;
function step() {
  if (!footsteps) return;
  const a = audioContext();
  if (!a) return;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a);
  src.playbackRate.value = stepCount++ % 2 ? 0.9 : 1.05; // left and right feet sound slightly different
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  const gain = a.createGain();
  gain.gain.value = 0.1;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start();
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
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export const sound = {
  get muted() {
    return muted;
  },
  toggle() {
    muted = !muted;
    write('hdh-muted', muted);
    return muted;
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
  badge() { tone(784, 0, 0.1, 'triangle', 0.1); tone(1175, 0.1, 0.1, 'triangle', 0.1); tone(1568, 0.2, 0.3, 'triangle', 0.08); },
  rankUp() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle', 0.1)); },
};
