// Small sound effects made with the Web Audio API: no sound files to download.
// Browsers only allow audio after the player has pressed a key or clicked,
// so the audio system starts on the first sound request after that.

let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem('hdh-muted') === '1';
} catch {
  /* storage unavailable: keep default */
}

function audio() {
  if (muted) return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
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
    try {
      localStorage.setItem('hdh-muted', muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    return muted;
  },
  ticket() { tone(880, 0, 0.12); tone(1320, 0.13, 0.2); },
  urgent() { tone(988, 0, 0.1, 'square', 0.06); tone(988, 0.15, 0.1, 'square', 0.06); tone(1319, 0.3, 0.2, 'square', 0.06); },
  correct() { tone(523, 0, 0.12); tone(659, 0.1, 0.12); tone(784, 0.2, 0.25); },
  wrong() { tone(220, 0, 0.18, 'sawtooth', 0.06); tone(165, 0.16, 0.3, 'sawtooth', 0.06); },
  click() { tone(660, 0, 0.05, 'triangle', 0.06); },
  badge() { tone(784, 0, 0.1, 'triangle', 0.1); tone(1175, 0.1, 0.1, 'triangle', 0.1); tone(1568, 0.2, 0.3, 'triangle', 0.08); },
  rankUp() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle', 0.1)); },
};
