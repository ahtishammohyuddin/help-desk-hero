// Entry point: sets up Three.js, builds the office, connects to the backend,
// and runs the game loop (movement, camera, tickets, interface).

import * as THREE from 'three';
import { api, API_BASE } from './api.js';
import { FollowCamera } from './camera.js';
import { createEmployees } from './employees.js';
import { Input } from './input.js';
import { nearestWithin } from './logic.js';
import { buildOffice, PLAYER_START } from './office.js';
import { createPlayer } from './player.js';
import { confetti } from './confetti.js';
import { sound } from './sound.js';
import { maxLevelFor, PRIORITIES, rankFor, streakMultiplier, TicketQueue, xpFor } from './tickets.js';
import * as ui from './ui.js';

const TALK_RADIUS = 1.8; // how close you must be to talk to someone
const LABEL_RADIUS = 8; // name tags show within this distance (always shown for open tickets)
const SAVE_KEY = 'hdh-progress';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- saved progress (this browser only; Phase 5 adds the full dashboard) ----------
function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (saved && Number.isFinite(saved.xp)) {
      return {
        xp: saved.xp, solved: saved.solved || 0, attempts: saved.attempts || 0, firstTry: saved.firstTry || 0,
        streak: saved.streak || 0, bestStreak: saved.bestStreak || 0,
      };
    }
  } catch {
    /* no saved data or storage blocked */
  }
  return { xp: 0, solved: 0, attempts: 0, firstTry: 0, streak: 0, bestStreak: 0 };
}
function saveProgress(progress) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
  } catch {
    /* storage blocked: progress lasts until the tab closes */
  }
}

function start() {
  // ---------- renderer, scene, camera ----------
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (err) {
    $('error').hidden = false;
    $('boot').hidden = true;
    console.error(err);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe6ec);
  scene.fog = new THREE.Fog(0xdfe6ec, 35, 70);
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 1.4));
  const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
  sun.position.set(14, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 22, bottom: -22, near: 1, far: 70 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // ---------- world ----------
  const { colliders, blinkers } = buildOffice(scene);
  const employees = createEmployees(scene, colliders, $('labels'));
  const byName = new Map(employees.map((e) => [e.name, e]));
  const player = createPlayer(scene, PLAYER_START);
  const followCam = new FollowCamera(camera, renderer.domElement);
  const input = new Input();

  // ---------- game state ----------
  const progress = loadProgress();
  const queue = new TicketQueue();
  const details = new Map(); // ticket number -> what we fetched for it
  let backendReady = false;
  let shiftStarted = false; // tickets only arrive after the player presses "Start my shift"
  let helpOpen = false;
  let nearby = null;
  let talkingTo = null; // the employee in conversation
  let activeTicket = null; // the ticket shown in the ticket panel, if any

  ui.renderStatus(progress);
  ui.renderQueue([], byName);
  $('sound-btn').classList.toggle('off', sound.muted);

  // ---------- start-up: wait for the backend ----------
  async function boot() {
    const started = performance.now();
    for (let attempt = 0; attempt < 45; attempt++) {
      try {
        const health = await api.health();
        if (health.problems_loaded === 0) {
          ui.bootMessage('No reviewed problems found', 'Mark problems as reviewed with <code>python -m tools.mark_reviewed</code>.', { error: true, retry: boot });
          return;
        }
        const problems = await api.listProblems();
        queue.setPool(problems);
        backendReady = true;
        ui.hideBoot();
        let seenHelp = false;
        try {
          seenHelp = localStorage.getItem('hdh-seen-help') === '1';
        } catch {
          /* storage blocked: show the welcome card */
        }
        if (seenHelp) startShift();
        else openHelp(true);
        return;
      } catch {
        const waited = Math.round((performance.now() - started) / 1000);
        ui.bootMessage('Waking up the office...', `Connecting to the help desk server${waited > 3 ? ` (${waited}s)` : ''}`);
        await sleep(2000);
      }
    }
    ui.bootMessage(
      'Cannot reach the help desk server',
      `Tried <code>${ui.esc(API_BASE)}</code>.<br>Start the backend in another terminal:<br><code>uvicorn backend.main:app --reload</code>`,
      { error: true, retry: boot },
    );
  }
  boot();

  // ---------- tickets ----------
  function onNewTicket(ticket) {
    const person = byName.get(ticket.employee);
    person.marker.visible = true;
    for (const part of person.marker.children) {
      part.material.color.set(PRIORITIES[ticket.priority].color);
      part.material.emissive.set(PRIORITIES[ticket.priority].color);
    }
    if (ticket.priority === 'P1') sound.urgent();
    else sound.ticket();
    ui.toast(`<b>${ui.esc(person.name)}</b> needs help ${ui.priorityBadge(ticket.priority)}`);
    fetchTicket(ticket);
  }

  // Load the problem and the AI-reworded complaint as soon as the ticket arrives,
  // so there is no waiting when the player walks over.
  function fetchTicket(ticket) {
    const detail = {
      state: 'loading', hints: [], problem: null, description: '', result: null, answering: false,
      attempt: 1, // which try is next (1 or 2)
      wrong: [], // wrong tries so far: { id, why }
      chat: [], // senior tech conversation: { role: 'junior' | 'senior', text, source }
      chatOpen: false,
      asking: false,
    };
    details.set(ticket.number, detail);
    Promise.all([api.getProblem(ticket.problemId), api.rephrase(ticket.problemId).catch(() => null)])
      .then(([problem, reworded]) => {
        detail.problem = problem;
        detail.description = reworded?.user_description || problem.user_description; // fallback text
        detail.state = 'ready';
      })
      .catch(() => {
        detail.state = 'error';
      })
      .finally(refreshTicketPanel);
  }

  function refreshTicketPanel() {
    if (activeTicket && talkingTo) ui.renderTicketPanel(talkingTo, activeTicket, details.get(activeTicket.number));
  }

  async function chooseOption(index) {
    if (!activeTicket) return;
    const ticket = activeTicket;
    const detail = details.get(ticket.number);
    if (detail.state !== 'ready' || detail.result || detail.answering) return;
    const option = detail.problem.options[index];
    if (!option || detail.wrong.some((w) => w.id === option.id)) return; // already ruled out

    detail.answering = true;
    detail.answerError = false;
    sound.click();
    refreshTicketPanel();
    try {
      const result = await api.check(ticket.problemId, option.id, detail.attempt, detail.hints.length + 1);

      if (!result.final) {
        // Wrong, but there is another try: explain this choice, add a free hint, keep the ticket open.
        detail.wrong.push({ id: option.id, why: result.chosen_why });
        if (result.hint) detail.hints.push(result.hint);
        detail.attempt += 1;
        sound.wrong();
        return;
      }

      const baseXp = xpFor({
        level: ticket.level,
        priority: ticket.priority,
        correct: result.is_correct,
        attempt: result.attempt,
        hintsUsed: ticket.hintsUsed,
        secondsLeft: ticket.secondsLeft,
        sla: ticket.sla,
      });
      // Streak: tickets in a row solved on the first try. A mistake resets it.
      const firstTryWin = result.is_correct && result.attempt === 1;
      progress.streak = firstTryWin ? progress.streak + 1 : 0;
      progress.bestStreak = Math.max(progress.bestStreak, progress.streak);
      const mult = firstTryWin ? streakMultiplier(progress.streak) : 1;
      const xp = Math.round(baseXp * mult);

      const before = rankFor(progress.xp);
      progress.xp += xp;
      progress.attempts += 1;
      if (result.is_correct) progress.solved += 1;
      if (result.is_correct && result.attempt === 1) progress.firstTry += 1;
      saveProgress(progress);
      detail.result = { ...result, xp, mult };

      queue.close(ticket.number);
      byName.get(ticket.employee).marker.visible = false;
      ui.renderStatus(progress);
      ui.renderQueue(queue.open, byName);
      if (result.is_correct) {
        sound.correct();
        if (xp > 0) ui.xpPop(xp);
      } else {
        sound.wrong();
      }
      if (firstTryWin && [3, 5, 10, 15, 20].includes(progress.streak)) {
        ui.toast(`${progress.streak} right in a row! Bonus ×${mult} XP`, 'big');
      }
      const after = rankFor(progress.xp);
      if (after.index > before.index) {
        setTimeout(() => sound.rankUp(), 500);
        setTimeout(() => confetti(), 300);
        const unlocked = queue.pool.some((p) => p.level === maxLevelFor(progress.xp));
        ui.toast(`Promoted to ${ui.esc(after.name)}!${unlocked ? ' Harder tickets unlocked.' : ''}`, 'big');
      }
    } catch {
      detail.answerError = true;
    } finally {
      detail.answering = false;
      refreshTicketPanel();
    }
  }

  async function takeHint() {
    if (!activeTicket) return;
    const ticket = activeTicket;
    const detail = details.get(ticket.number);
    if (detail.state !== 'ready' || detail.result || detail.hints.length >= detail.problem.hint_count) return;
    try {
      const { hint } = await api.hint(ticket.problemId, detail.hints.length + 1);
      detail.hints.push(hint);
      ticket.hintsUsed += 1; // only hints the player asks for cost XP
      sound.click();
      refreshTicketPanel();
    } catch {
      /* hint failed: the player can try again */
    }
  }

  // ---------- ask the senior tech (after a ticket is answered) ----------
  async function askSenior(question) {
    if (!activeTicket) return;
    const ticket = activeTicket;
    const detail = details.get(ticket.number);
    const asked = detail.chat.filter((t) => t.role === 'junior').length;
    if (!detail.result || detail.asking || asked >= ui.MAX_QUESTIONS) return;

    // Earlier turns go along so follow-up questions make sense (the backend keeps the last 6).
    const history = detail.chat.slice(-6).map((t) => ({ role: t.role, text: t.text.slice(0, 700) }));
    detail.chat.push({ role: 'junior', text: question });
    detail.asking = true;
    refreshTicketPanel();
    try {
      const reply = await api.ask(ticket.problemId, question, history);
      detail.chat.push({ role: 'senior', text: reply.answer, source: reply.source });
    } catch {
      detail.chat.pop(); // not counted: the question never reached the senior tech
      ui.toast('The senior tech could not be reached. Check the backend is running, then ask again.');
    } finally {
      detail.asking = false;
      refreshTicketPanel();
      focusAskBox();
    }
  }

  function focusAskBox() {
    // After the key press finishes, so the "q" is not typed into the box.
    setTimeout(() => document.getElementById('ask-input')?.focus(), 0);
  }

  $('ticket').addEventListener('submit', (e) => {
    e.preventDefault();
    const box = document.getElementById('ask-input');
    const question = box?.value.trim() ?? '';
    if (question.length >= 2) askSenior(question);
  });
  $('ticket').addEventListener('keydown', (e) => {
    if (e.target.id === 'ask-input' && e.key === 'Escape') e.target.blur(); // back to game keys
  });

  // ---------- talking ----------
  function openConversation(person) {
    talkingTo = person;
    player.face(person.x, person.z);
    person.group.rotation.y = Math.atan2(player.position.x - person.x, player.position.z - person.z);
    $('prompt').hidden = true;

    const ticket = queue.forEmployee(person.name);
    if (ticket) {
      activeTicket = ticket;
      refreshTicketPanel();
    } else {
      $('panel-name').textContent = person.name;
      $('panel-dept').textContent = person.department;
      $('panel-text').textContent = person.line;
      $('panel-avatar').textContent = person.name[0];
      $('panel-avatar').style.setProperty('--c', `#${person.shirt.toString(16).padStart(6, '0')}`);
      $('panel').hidden = false;
    }
  }

  function closeConversation() {
    if (!talkingTo) return;
    talkingTo.group.rotation.y = talkingTo.facing;
    // Answered tickets are finished: forget their details.
    if (activeTicket && details.get(activeTicket.number)?.result) details.delete(activeTicket.number);
    talkingTo = null;
    activeTicket = null;
    $('panel').hidden = true;
    ui.hideTicketPanel();
  }

  input.onPress('KeyE', () => {
    if (talkingTo) closeConversation();
    else if (nearby) openConversation(nearby);
  });
  input.onPress('Escape', () => (helpOpen ? closeHelp() : closeConversation()));
  input.onPress('KeyH', takeHint);
  input.onPress('KeyQ', openChat);
  input.onPress('KeyR', retryTicket);
  input.onPress('KeyM', toggleSound);

  function openChat() {
    const detail = activeTicket && details.get(activeTicket.number);
    if (!detail?.result) return;
    detail.chatOpen = true;
    refreshTicketPanel();
    focusAskBox();
  }
  function retryTicket() {
    const detail = activeTicket && details.get(activeTicket.number);
    if (detail?.state === 'error') {
      fetchTicket(activeTicket);
      refreshTicketPanel();
    }
  }
  function toggleSound() {
    const muted = sound.toggle();
    $('sound-btn').classList.toggle('off', muted);
    ui.toast(muted ? 'Sound off' : 'Sound on');
  }

  // ---------- welcome card ----------
  function openHelp(firstTime) {
    helpOpen = true;
    ui.showHelp(firstTime);
  }
  function closeHelp() {
    helpOpen = false;
    ui.hideHelp();
    if (!shiftStarted) startShift();
  }
  function startShift() {
    shiftStarted = true;
    try {
      localStorage.setItem('hdh-seen-help', '1');
    } catch {
      /* ignore */
    }
    ui.toast('Your shift has started. Requests will appear on the right.');
  }
  $('help-start').addEventListener('click', closeHelp);
  $('help-btn').addEventListener('click', () => openHelp(false));
  $('sound-btn').addEventListener('click', toggleSound);
  $('panel').addEventListener('click', (e) => {
    if (e.target.closest('[data-action="bye"]')) closeConversation();
  });
  for (let i = 1; i <= 4; i++) {
    input.onPress(`Digit${i}`, () => chooseOption(i - 1));
    input.onPress(`Numpad${i}`, () => chooseOption(i - 1));
  }
  $('ticket').addEventListener('click', (e) => {
    const option = e.target.closest('.opt');
    if (option) return chooseOption(Number(option.dataset.index));
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'hint') takeHint();
    else if (action === 'later' || action === 'close') closeConversation();
    else if (action === 'ask') openChat();
    else if (action === 'retry') retryTicket();
  });

  // ---------- resize ----------
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- game loop ----------
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  let hudTimer = 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05); // cap so a slow frame can't teleport the player
    const time = clock.elapsedTime;

    player.update(dt, input.state, followCam.yaw, colliders, talkingTo !== null || helpOpen);
    followCam.focusTarget = activeTicket ? 1 : 0;
    followCam.update(dt, player.position);

    if (backendReady && shiftStarted && !helpOpen) {
      for (const ticket of queue.update(dt, employees, maxLevelFor(progress.xp))) onNewTicket(ticket);
    }

    // Who is close enough to talk to?
    nearby = talkingTo ? null : nearestWithin(player.position, employees, TALK_RADIUS);
    if (nearby) {
      const hasTicket = queue.forEmployee(nearby.name);
      $('prompt').innerHTML = `Press <kbd>E</kbd> to ${hasTicket ? 'help' : 'talk to'} <b>${ui.esc(nearby.name)}</b>`;
      $('prompt').hidden = false;
    } else {
      $('prompt').hidden = true;
    }
    if (talkingTo && nearestWithin(player.position, [talkingTo], TALK_RADIUS + 0.5) === null) closeConversation();
    if (activeTicket) ui.updateTicketTimer(activeTicket, Boolean(details.get(activeTicket.number)?.result));

    // Name tags, with priority and time left for anyone who has an open ticket
    hudTimer -= dt;
    const refreshHud = hudTimer <= 0;
    if (refreshHud) hudTimer = 0.25;
    for (const person of employees) {
      const ticket = queue.forEmployee(person.name);
      const dist = Math.hypot(person.x - player.position.x, person.z - player.position.z);
      tmp.set(person.x, ticket ? 2.6 : 2.0, person.z).project(camera);
      const onScreen = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
      person.label.hidden = !(onScreen && (ticket || dist < LABEL_RADIUS));
      if (!person.label.hidden) {
        person.label.style.left = `${(tmp.x * 0.5 + 0.5) * window.innerWidth}px`;
        person.label.style.top = `${(-tmp.y * 0.5 + 0.5) * window.innerHeight}px`;
        if (refreshHud) {
          const bar = ticket
            ? `<div class="lbar"><div style="width:${Math.max(0, (ticket.secondsLeft / ticket.sla) * 100)}%;background:${PRIORITIES[ticket.priority].color}"></div></div>`
            : '';
          person.label.innerHTML = `<div class="row">${ui.esc(person.name)}${ticket ? ui.priorityBadge(ticket.priority) : ''}</div>${bar}`;
        }
      }
      if (person.marker.visible) {
        person.marker.position.y = 2.15 + Math.sin(time * 3) * 0.08;
        person.marker.rotation.y = time * 2;
      }
    }
    if (refreshHud) ui.renderQueue(queue.open, byName);

    for (const led of blinkers) {
      led.material.emissiveIntensity = Math.sin(time * led.speed + led.phase) > 0.2 ? 1.2 : 0.1;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Handy for debugging in the browser console: helpDeskHero.queue.open
  window.helpDeskHero = { player, followCam, employees, scene, queue, details, progress };
}

start();
