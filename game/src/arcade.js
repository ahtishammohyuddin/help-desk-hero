// The game corner arcade: draws the menu and the five games inside #arcade-card.
// Game rules live in minigames.js (tested); this file only handles screens, input and drawing.
// Canvas games run on their own animation loop, so they stay smooth while the office is paused.

import {
  closeMismatch, dashScore, DASH_HIT_Y, DASH_LANES, dropStack, flipCard, isBest, newDash, newMatch, newSimon, newStack,
  pickLine, pressSimon, simonScore, SIMON_PADS, stackScore, steerDash, tickDash, tickStack, typingScore,
} from './minigames.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const GAMES = [
  { id: 'dash', icon: '📦', name: 'Packet dash', about: 'Steer the data packet left and right to dodge the firewalls.', keys: 'Arrow keys or A / D, or tap the left / right side', best: (v) => `${v} metres` },
  { id: 'stack', icon: '🗄️', name: 'Server stack', about: 'Drop each server so it lands on the one below. How high can you go?', keys: 'Space or click to drop', best: (v) => `${v} servers` },
  { id: 'simon', icon: '💡', name: 'Switch lights', about: 'Watch the port lights, then repeat the pattern. It grows each round.', keys: 'Click the lights, or keys 1 to 4', best: (v) => `${v} rounds` },
  { id: 'match', icon: '🧩', name: 'Kit match', about: 'Find the pairs of office kit in as few moves as you can.', keys: 'Click two cards', best: (v) => `${v} moves` },
  { id: 'typer', icon: '⌨️', name: 'Quick typer', about: 'Type a help desk line as fast and accurately as you can.', keys: 'Just type', best: (v) => `${v} words per minute` },
];
const PAD_COLORS = ['#33d17a', '#ffb02e', '#2f6feb', '#e5484d'];

export function createArcade({ card, overlay, sound, best, saveBest, onClose }) {
  let view = 'select';
  let state = null;
  let raf = 0;
  let canvas = null;
  let simonBusy = false;
  let simonFlash = -1;

  const frame = (inner, lead) => {
    card.innerHTML = `<h1 id="arcade-title">🕹️ Game corner</h1><p class="lead">${lead}</p>${inner}
      <div class="menu-list" style="margin-top:14px"><button class="btn ghost" data-action="close-arcade">Back to work <kbd>Esc</kbd></button></div>`;
  };
  const gameInfo = (id) => GAMES.find((g) => g.id === id);

  function showSelect() {
    stopLoop();
    view = 'select';
    frame(`<div class="arc-games">${GAMES.map((g) => `<button class="arc-game" data-arcade="${g.id}"><span class="arc-icon">${g.icon}</span><b>${esc(g.name)}</b><small>${esc(g.about)}</small><em>${best[g.id] ? `Best: ${esc(g.best(best[g.id]))}` : 'No score yet'}</em></button>`).join('')}</div>`,
      'Take a short break. Your shift is paused while you play.');
  }

  function showResult(game, value, detail) {
    stopLoop();
    const newBest = isBest(best, game, value);
    if (newBest) {
      best[game] = value;
      saveBest(best);
    }
    sound.gameWin();
    view = 'result';
    const g = gameInfo(game);
    frame(`<div class="arc-result"><div class="arc-big">${esc(g.best(value))}</div><p>${esc(detail)}</p>${newBest ? '<p class="arc-best">🏆 New best score!</p>' : `<p class="small">Best: ${esc(g.best(best[game]))}</p>`}</div>
      <div class="menu-list"><button class="btn" data-arcade="${game}">Play again</button><button class="btn ghost" data-arcade="select">Other games</button></div>`, esc(g.name));
  }

  // ---------- canvas games ----------
  function canvasView(game) {
    const g = gameInfo(game);
    frame(`<div class="arc-bar"><span id="arc-score">0</span><span class="small-light">${esc(g.keys)}</span></div><canvas id="arc-canvas" class="arc-canvas" width="480" height="420" aria-label="${esc(g.name)}"></canvas>`, esc(g.name));
    canvas = card.querySelector('#arc-canvas');
  }
  function loop(step) {
    let last = performance.now();
    const tick = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (step(dt) !== false) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  function stopLoop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  const setScore = (text) => {
    const el = card.querySelector('#arc-score');
    if (el) el.textContent = text;
  };

  function drawDash(ctx, s) {
    const W = canvas.width;
    const H = canvas.height;
    const lane = W / DASH_LANES;
    ctx.fillStyle = '#141a2e';
    ctx.fillRect(0, 0, W, H);
    // moving grid lines give a sense of speed
    ctx.strokeStyle = 'rgba(127, 184, 240, 0.12)';
    ctx.lineWidth = 2;
    const offset = (s.distance * 8) % 40;
    for (let y = -40 + offset; y < H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let i = 1; i < DASH_LANES; i++) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.setLineDash([12, 12]);
      ctx.beginPath();
      ctx.moveTo(i * lane, 0);
      ctx.lineTo(i * lane, H);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const b of s.blocks) {
      const x = b.lane * lane + 14;
      const y = b.y * H - 18;
      ctx.fillStyle = '#e5484d';
      ctx.fillRect(x, y, lane - 28, 36);
      ctx.fillStyle = '#ff9b9e';
      for (let i = 0; i < 4; i++) ctx.fillRect(x + 6 + i * ((lane - 40) / 4), y + 6, (lane - 40) / 4 - 4, 10);
      ctx.fillStyle = '#7a1f22';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FIREWALL', x + (lane - 28) / 2, y + 31);
    }
    const px = s.lane * lane + lane / 2;
    const py = DASH_HIT_Y * H;
    ctx.fillStyle = s.over ? '#ffb02e' : '#33d17a';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(px - 22, py - 18, 44, 36, 8) : ctx.rect(px - 22, py - 18, 44, 36);
    ctx.fill();
    ctx.fillStyle = '#0b3d22';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('01', px, py + 5);
  }

  function startDash() {
    view = 'dash';
    state = newDash();
    canvasView('dash');
    const ctx = canvas.getContext('2d');
    loop((dt) => {
      state = tickDash(state, dt);
      drawDash(ctx, state);
      setScore(`📦 ${dashScore(state)} m`);
      if (state.over) {
        sound.gameMiss();
        setTimeout(() => showResult('dash', dashScore(state), 'A firewall stopped your packet. Try again?'), 700);
        return false;
      }
      return true;
    });
  }

  function drawStack(ctx, s) {
    const W = canvas.width;
    const H = canvas.height;
    const rowH = 26;
    const visible = Math.floor((H - 40) / rowH);
    const shift = Math.max(0, s.layers.length + 1 - visible);
    ctx.fillStyle = '#eef2f6';
    ctx.fillRect(0, 0, W, H);
    const drawServer = (x, w, row, color) => {
      const y = H - 20 - (row - shift + 1) * rowH;
      ctx.fillStyle = color;
      ctx.fillRect(x * W, y, w * W, rowH - 3);
      ctx.fillStyle = '#33d17a';
      for (let i = 0; i < Math.max(1, Math.floor((w * W) / 30)); i++) ctx.fillRect(x * W + 8 + i * 30, y + 8, 6, 6);
    };
    s.layers.forEach((l, i) => drawServer(l.x, l.w, i, i === 0 ? '#5b6b7c' : '#2b313a'));
    if (!s.over) drawServer(s.moving.x, s.moving.w, s.layers.length, '#2f6feb');
  }

  function startStack() {
    view = 'stack';
    state = newStack();
    canvasView('stack');
    const ctx = canvas.getContext('2d');
    loop((dt) => {
      state = tickStack(state, dt);
      drawStack(ctx, state);
      setScore(`🗄️ ${stackScore(state)} servers${state.perfect ? `, ${state.perfect} perfect` : ''}`);
      return !state.over;
    });
  }
  function dropServer() {
    if (view !== 'stack' || state.over) return;
    const r = dropStack(state);
    state = r.state;
    if (r.result === 'miss') {
      sound.gameMiss();
      drawStack(canvas.getContext('2d'), state);
      setTimeout(() => showResult('stack', stackScore(state), 'The rack is full of servers. Nice building!'), 600);
    } else sound.gamePoint();
  }

  // ---------- switch lights ----------
  function drawSimon() {
    const pads = Array.from({ length: SIMON_PADS }, (_, i) =>
      `<button class="simon-pad${simonFlash === i ? ' lit' : ''}" style="--c:${PAD_COLORS[i]}" data-pad="${i}" ${simonBusy ? 'disabled' : ''} aria-label="Light ${i + 1}"><span>${i + 1}</span></button>`).join('');
    frame(`<div class="arc-bar"><span>Round ${state.pattern.length}</span><span class="small-light">${simonBusy ? 'Watch the lights...' : 'Your turn: repeat the pattern'}</span></div><div class="simon-grid">${pads}</div>`, 'Switch lights');
  }
  function playPattern() {
    simonBusy = true;
    drawSimon();
    state.pattern.forEach((pad, i) => {
      setTimeout(() => {
        if (view !== 'simon') return;
        simonFlash = pad;
        sound.gamePoint();
        drawSimon();
        setTimeout(() => {
          if (view !== 'simon') return;
          simonFlash = -1;
          if (i === state.pattern.length - 1) simonBusy = false;
          drawSimon();
        }, 380);
      }, 600 + i * 620);
    });
  }
  function startSimon() {
    view = 'simon';
    state = newSimon();
    playPattern();
  }
  function pressPad(pad) {
    if (view !== 'simon' || simonBusy) return;
    const r = pressSimon(state, pad);
    state = r.state;
    simonFlash = pad;
    drawSimon();
    setTimeout(() => {
      if (view === 'simon' && simonFlash === pad) {
        simonFlash = -1;
        if (!simonBusy) drawSimon();
      }
    }, 200);
    if (r.result === 'wrong') {
      sound.gameMiss();
      setTimeout(() => showResult('simon', simonScore(state), 'That light was out of order.'), 500);
    } else if (r.result === 'round') {
      sound.gameStart();
      setTimeout(playPattern, 500);
    } else sound.click();
  }

  // ---------- kit match and quick typer (no animation loop needed) ----------
  function drawMatch() {
    frame(`<div class="arc-bar"><span>Moves: ${state.moves}</span><span>Pairs: ${state.deck.filter((c) => c.matched).length / 2} of ${state.deck.length / 2}</span></div>
      <div class="match-grid">${state.deck.map((c, i) => {
        const shown = c.matched || state.open.includes(i);
        return `<button class="match-card${shown ? ' shown' : ''}${c.matched ? ' done' : ''}" data-card="${i}">${shown ? c.face : '?'}</button>`;
      }).join('')}</div>`, 'Kit match');
  }
  function flip(i) {
    const r = flipCard(state, i);
    if (r.result === 'ignored') return;
    state = r.state;
    if (r.result === 'match') sound.gamePoint();
    else if (r.result === 'miss') {
      sound.gameMiss();
      const shown = state;
      setTimeout(() => {
        if (view === 'match' && state === shown) {
          state = closeMismatch(shown);
          drawMatch();
        }
      }, 700);
    } else sound.click();
    if (state.over) return showResult('match', state.moves, 'All the kit matched. Fewer moves is better.');
    drawMatch();
  }
  function drawTyper(focus = true) {
    const { line, typed, score } = state;
    const chars = [...line].map((ch, i) => `<span class="${i < typed.length ? (typed[i] === ch ? 'ok' : 'bad') : i === typed.length ? 'now' : ''}">${esc(ch)}</span>`).join('');
    const bar = card.querySelector('.arc-bar');
    const lineEl = card.querySelector('.typer-line');
    if (bar && lineEl) {
      // Update in place so the text box keeps focus and the cursor while typing.
      bar.innerHTML = `<span>${score.wpm ? `${score.wpm} words per minute` : 'Speed shows after a moment'}</span><span>${score.accuracy}% accurate</span>`;
      lineEl.innerHTML = chars;
      return;
    }
    frame(`<div class="arc-bar"><span>Speed shows after a moment</span><span>0% accurate</span></div><div class="typer-line">${chars}</div>
      <input id="typer-input" class="typer-input" autocomplete="off" spellcheck="false" maxlength="${line.length}" aria-label="Type the line here" placeholder="Start typing...">`, 'Quick typer');
    if (focus) card.querySelector('#typer-input').focus();
  }

  function start(game) {
    stopLoop();
    view = game;
    simonBusy = false;
    simonFlash = -1;
    sound.gameStart();
    if (game === 'dash') startDash();
    else if (game === 'stack') startStack();
    else if (game === 'simon') startSimon();
    else if (game === 'match') {
      state = newMatch();
      drawMatch();
    } else if (game === 'typer') {
      state = { line: pickLine(), typed: '', started: 0, score: { wpm: 0, accuracy: 0, done: false } };
      card.innerHTML = '';
      drawTyper();
    }
  }

  // ---------- input ----------
  overlay.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-arcade]')?.dataset.arcade;
    if (pick === 'select') return showSelect();
    if (pick) return start(pick);
    if (e.target.closest('[data-action="close-arcade"]')) return api.close();
    const card2 = e.target.closest('[data-card]');
    if (card2 && view === 'match') return flip(Number(card2.dataset.card));
  });
  overlay.addEventListener('pointerdown', (e) => {
    const pad = e.target.closest('[data-pad]');
    if (pad) return pressPad(Number(pad.dataset.pad));
    if (e.target.id !== 'arc-canvas') return;
    if (view === 'stack') dropServer();
    else if (view === 'dash') {
      const r = canvas.getBoundingClientRect();
      state = steerDash(state, e.clientX - r.left < r.width / 2 ? -1 : 1);
    }
  });
  overlay.addEventListener('input', (e) => {
    if (e.target.id !== 'typer-input' || view !== 'typer') return;
    const started = state.started || performance.now();
    const typed = e.target.value;
    const score = typingScore(state.line, typed, (performance.now() - started) / 1000);
    state = { ...state, typed, started, score };
    if (score.done) return showResult('typer', score.wpm, `${score.accuracy}% accurate.`);
    drawTyper(false);
  });
  window.addEventListener('keydown', (e) => {
    if (overlay.hidden) return;
    if (view === 'dash' && ['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(e.code)) {
      e.preventDefault();
      state = steerDash(state, e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : 1);
    } else if (view === 'stack' && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      if (!e.repeat) dropServer();
    } else if (view === 'simon' && /^Digit[1-4]$/.test(e.code)) {
      pressPad(Number(e.code.slice(5)) - 1);
    }
  });

  const api = {
    open() {
      overlay.hidden = false;
      showSelect();
    },
    close() {
      stopLoop();
      view = 'select';
      overlay.hidden = true;
      onClose();
    },
  };
  return api;
}
