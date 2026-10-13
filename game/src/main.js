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
import { sound } from './sound.js';
import { maxLevelFor, PRIORITIES, rankFor, TicketQueue, xpFor } from './tickets.js';
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
    if (saved && Number.isFinite(saved.xp)) return { xp: saved.xp, solved: saved.solved || 0, attempts: saved.attempts || 0 };
  } catch {
    /* no saved data or storage blocked */
  }
  return { xp: 0, solved: 0, attempts: 0 };
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
  let nearby = null;
  let talkingTo = null; // the employee in conversation
  let activeTicket = null; // the ticket shown in the ticket panel, if any

  ui.renderStatus(progress);
  ui.renderQueue([]);

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
        ui.toast(`Shift started. ${problems.length} problem types loaded. Watch the queue for tickets.`);
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
    ui.toast(`${ui.priorityBadge(ticket.priority)} New ticket from <b>${ui.esc(person.name)}</b> (${ui.esc(person.department)})`);
    fetchTicket(ticket);
  }

  // Load the problem and the AI-reworded complaint as soon as the ticket arrives,
  // so there is no waiting when the player walks over.
  function fetchTicket(ticket) {
    const detail = { state: 'loading', hints: [], problem: null, description: '', result: null, answering: false };
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
    if (!option) return;

    detail.answering = true;
    detail.answerError = false;
    sound.click();
    refreshTicketPanel();
    try {
      const result = await api.answer(ticket.problemId, option.id);
      const xp = xpFor({
        level: ticket.level,
        priority: ticket.priority,
        correct: result.is_correct,
        hintsUsed: ticket.hintsUsed,
        secondsLeft: ticket.secondsLeft,
        sla: ticket.sla,
      });
      const before = rankFor(progress.xp);
      progress.xp += xp;
      progress.attempts += 1;
      if (result.is_correct) progress.solved += 1;
      saveProgress(progress);
      detail.result = { ...result, xp };

      queue.close(ticket.number);
      byName.get(ticket.employee).marker.visible = false;
      ui.renderStatus(progress);
      if (result.is_correct) {
        sound.correct();
        if (xp > 0) ui.xpPop(xp);
      } else {
        sound.wrong();
      }
      const after = rankFor(progress.xp);
      if (after.index > before.index) {
        setTimeout(() => sound.rankUp(), 500);
        const unlocked = queue.pool.some((p) => p.level === maxLevelFor(progress.xp));
        ui.toast(`Promoted to <b>${ui.esc(after.name)}</b>!${unlocked ? ' Harder tickets unlocked.' : ''}`, 'big');
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
      ticket.hintsUsed = detail.hints.length;
      sound.click();
      refreshTicketPanel();
    } catch {
      /* hint failed: the player can try again */
    }
  }

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
      $('panel-text').textContent = `"${person.line}"`;
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
  input.onPress('Escape', closeConversation);
  input.onPress('KeyH', takeHint);
  input.onPress('KeyR', () => {
    const detail = activeTicket && details.get(activeTicket.number);
    if (detail?.state === 'error') {
      fetchTicket(activeTicket);
      refreshTicketPanel();
    }
  });
  input.onPress('KeyM', () => ui.toast(sound.toggle() ? 'Sound off' : 'Sound on'));
  for (let i = 1; i <= 4; i++) {
    input.onPress(`Digit${i}`, () => chooseOption(i - 1));
    input.onPress(`Numpad${i}`, () => chooseOption(i - 1));
  }
  $('ticket').addEventListener('click', (e) => {
    const button = e.target.closest('.opt');
    if (button) chooseOption(Number(button.dataset.index));
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

    player.update(dt, input.state, followCam.yaw, colliders, talkingTo !== null);
    followCam.focusTarget = activeTicket ? 1 : 0;
    followCam.update(dt, player.position);

    if (backendReady) {
      for (const ticket of queue.update(dt, employees, maxLevelFor(progress.xp))) onNewTicket(ticket);
    }

    // Who is close enough to talk to?
    nearby = talkingTo ? null : nearestWithin(player.position, employees, TALK_RADIUS);
    if (nearby) {
      const hasTicket = queue.forEmployee(nearby.name);
      $('prompt').innerHTML = `<kbd>E</kbd> ${hasTicket ? 'Help' : 'Talk to'} <b>${ui.esc(nearby.name)}</b>`;
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
          person.label.innerHTML = `${ui.esc(person.name)}${ticket ? ui.priorityBadge(ticket.priority) : `<small>${ui.esc(person.department)}</small>`}${bar}`;
        }
      }
      if (person.marker.visible) {
        person.marker.position.y = 2.15 + Math.sin(time * 3) * 0.08;
        person.marker.rotation.y = time * 2;
      }
    }
    if (refreshHud) ui.renderQueue(queue.open);

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
