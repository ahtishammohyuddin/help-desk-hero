// Entry point: sets up Three.js, builds the office, connects to the backend,
// and runs the game loop (movement, camera, tickets, interface).

import * as THREE from 'three';
import { api, API_BASE } from './api.js';
import { FollowCamera } from './camera.js';
import {
  createSim, laptopAction, measure, moveToSpare, needsServerRoom, placesNeeded, printerAction, putBack, reportCoverage, reportPort,
  reseat, spotsLeft, takeItem, test as testFix,
} from './handson.js';
import { createEmployees } from './employees.js';
import { Input } from './input.js';
import { advance, createJob, finish, jobLabel, jobStage, PLACES, placeInReach, placesWaiting, WORK_SECONDS } from './jobs.js';
import { nearestWithin } from './logic.js';
import { Minimap } from './minimap.js';
import { BOUNDS, buildOffice, PLAYER_START } from './office.js';
import { makeAlertMarker } from './people.js';
import { createPlayer } from './player.js';
import { ACHIEVEMENTS, award, newlyEarned } from './achievements.js';
import { cleanName, drawCertificate, drawDailyCard, drawResultCard, postText } from './cards.js';
import {
  currentStreak, DAILY_XP_PER_RIGHT, dailyPostText, dateKey, dayLabel, emptyDaily, playedOn, recordDaily, untilTomorrow,
} from './daily.js';
import { confetti } from './confetti.js';
import { effectsAt, EVENTS, eventsStarting, planEvents, runningEvents, VIP_XP } from './events.js';
import { sound } from './sound.js';
import { clockFor, coachRequest, recordTopic, SHIFT_SECONDS, summarizeShift, topicStatus } from './shift.js';
import { maxLevelFor, PRIORITIES, RANKS, rankFor, streakMultiplier, TicketQueue, xpFor } from './tickets.js';
import * as ui from './ui.js';

const TALK_RADIUS = 1.8; // how close you must be to talk to someone
const LABEL_RADIUS = 8; // name tags show within this distance (always shown for open tickets)
const SAVE_KEY = 'hdh-progress';
const CERT_NAME_KEY = 'hdh-cert-name'; // the name typed for the certificate (stays in this browser)

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
        topics: saved.topics || {}, shifts: saved.shifts || 0, achievements: saved.achievements || {},
      };
    }
  } catch {
    /* no saved data or storage blocked */
  }
  return emptyProgress();
}
function emptyProgress() {
  return { xp: 0, solved: 0, attempts: 0, firstTry: 0, streak: 0, bestStreak: 0, topics: {}, shifts: 0, achievements: {} };
}
function readSetting(key) {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
function writeSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked */
  }
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  // Which chip is drawing the 3D? If it is a software renderer, the browser is not using the
  // graphics card and everything is many times slower, so we lower the resolution and tell the player.
  const gpuName = (() => {
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  })();
  const softwareRendering = /swiftshader|llvmpipe|software|basic render/i.test(gpuName);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe6ec);
  scene.fog = new THREE.Fog(0xdfe6ec, 35, 70);
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 1.4);
  scene.add(hemi);
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
  const minimap = new Minimap($('minimap-canvas'), BOUNDS, colliders);

  // A blue marker above each place, and a ring on the floor where to stand.
  // Shown only while a physical fix needs the player there.
  const placeMarkers = new Map();
  for (const [key, place] of Object.entries(PLACES)) {
    const marker = makeAlertMarker();
    for (const part of marker.children) {
      part.material = part.material.clone();
      part.material.color.set(0x2f6feb);
      part.material.emissive.set(0x2f6feb);
    }
    marker.position.set(place.markX, 0, place.markZ);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.6, 32),
      new THREE.MeshBasicMaterial({ color: 0x2f6feb, transparent: true, opacity: 0.8 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(place.x, 0.02, place.z);
    const group = new THREE.Group();
    group.add(marker, ring);
    group.visible = false;
    scene.add(group);
    placeMarkers.set(key, { group, marker, ring });
  }

  // ---------- graphics quality ----------
  // "smooth": normal resolution and simpler shadows, for laptops. "detailed": sharper and softer.
  const QUALITY_KEY = 'hdh-quality';
  let quality = 'detailed';
  let qualityChosen = false; // true once the player picks, so auto-switching never overrides them
  try {
    const saved = localStorage.getItem(QUALITY_KEY);
    if (saved === 'smooth' || saved === 'detailed') {
      quality = saved;
      qualityChosen = true;
    }
  } catch {
    /* storage blocked */
  }
  function applyQuality(next) {
    quality = next;
    const smooth = next === 'smooth';
    // Without a graphics card, drawing fewer pixels is the only thing that really helps.
    renderer.setPixelRatio(smooth ? (softwareRendering ? 0.5 : 1) : Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Shadows are the most expensive part of each frame, so Smooth turns them off completely.
    renderer.shadowMap.enabled = !smooth;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sun.castShadow = !smooth;
    sun.shadow.mapSize.set(2048, 2048);
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null; // rebuilt at the new size on the next frame
    }
    scene.traverse((obj) => {
      if (obj.material) obj.material.needsUpdate = true;
    });
    $('quality-btn').textContent = `Graphics: ${smooth ? 'Smooth' : 'Detailed'}`;
  }
  applyQuality(quality);
  $('quality-btn').addEventListener('click', () => {
    applyQuality(quality === 'smooth' ? 'detailed' : 'smooth');
    qualityChosen = true;
    try {
      localStorage.setItem(QUALITY_KEY, quality);
    } catch {
      /* ignore */
    }
  });
  const showFps = new URLSearchParams(window.location.search).has('fps');
  $('fps').hidden = !showFps;

  if (softwareRendering) {
    if (!qualityChosen) applyQuality('smooth');
    $('gpu-warning').hidden = false;
  }
  $('gpu-warning-close').addEventListener('click', () => {
    $('gpu-warning').hidden = true;
  });

  // ---------- game state ----------
  const progress = loadProgress();
  const queue = new TicketQueue();
  const details = new Map(); // ticket number -> what we fetched for it
  const queueLabel = (t) => {
    const d = details.get(t.number);
    if (needsServerRoom(d?.sim)) return 'Next: Server room';
    if (d?.sim?.station === 'survey' && !d.result) {
      const left = spotsLeft(d.sim).length;
      return left ? `Next: measure Wi-Fi (${3 - left} of 3 done)` : `Next: report to ${t.employee}`;
    }
    if (d?.sim?.station === 'laptop' && placesNeeded(d.sim).length && !d.result) return 'Next: Parts cabinet';
    if (d?.sim?.station === 'printer' && !d.result) {
      const need = placesNeeded(d.sim);
      return need.includes('parts_cabinet') ? 'Next: Parts cabinet' : need.length ? 'Next: Printer' : `Next: back to ${t.employee}`;
    }
    if (d?.sim && d.sim.port.movedTo !== null && !d.result) return `Next: back to ${t.employee}`;
    return jobLabel(d?.job, t.employee);
  };
  // Open tickets that need the player somewhere: [{ ticket, job, kind }]
  // Physical fixes have real jobs; a hands-on network ticket may need the server room switch.
  const activeJobs = () =>
    queue.open.flatMap((ticket) => {
      const d = details.get(ticket.number);
      if (jobStage(d?.job) !== 'finished') return [{ ticket, job: d.job }];
      const visit = (kind, place, action) => ({ ticket, kind, job: { steps: [{ place, action }], index: 0, finished: false } });
      if (needsServerRoom(d?.sim)) return [visit('switch', 'server_room', `Check Desk ${byName.get(ticket.employee).desk}'s port on the switch`)];
      if (d?.sim?.station === 'survey' && !d.result) {
        return spotsLeft(d.sim).map((spot) => visit('survey', spot, `Measure the Wi-Fi signal here for ${ticket.employee}`));
      }
      if (d?.sim?.station === 'laptop' && !d.result) {
        return placesNeeded(d.sim).map(() => visit('cabinet', 'parts_cabinet', 'Open the parts cabinet'));
      }
      if (d?.sim?.station === 'printer' && !d.result) {
        // The cabinet itself is always open to use (below); here it only adds its marker.
        return placesNeeded(d.sim).map((place) =>
          place === 'printer'
            ? visit('printer', 'printer', `Check the printer for ${ticket.employee}`)
            : visit('cabinet', 'parts_cabinet', 'Open the parts cabinet'));
      }
      return [];
    });
  // The parts cabinet can always be opened. It only gets a marker when a ticket needs it.
  const CABINET = { ticket: null, kind: 'cabinet', quiet: true, job: { steps: [{ place: 'parts_cabinet', action: 'Open the parts cabinet' }], index: 0, finished: false } };
  const allPlaces = () => [...activeJobs(), CABINET];
  let working = null; // { ticket, step, place, t }: the player is doing a step at a place
  let nearPlace = null; // a place in reach with a step waiting
  let backendReady = false;
  let shiftStarted = false; // tickets only arrive after the player presses "Start my shift"
  let helpOpen = false;
  let reportOpen = false;
  let progressOpen = false;
  let shareOpen = false;
  let dailyOpen = false;
  let lastReport = null; // the most recent shift report, for the share card
  const overlayOpen = () => helpOpen || reportOpen || progressOpen || shareOpen || dailyOpen; // pauses the shift and the player

  // Badges already earned before badges existed (or on another version) are given quietly.
  const backfill = newlyEarned(progress, { type: 'load' });
  if (backfill.length) {
    progress.achievements = award(progress.achievements, backfill);
    saveProgress(progress);
  }

  // ---------- the shift: 9 AM to 5 PM in 8 real minutes ----------
  function newShift() {
    return {
      number: progress.shifts + 1, elapsed: 0, records: [], badges: [], rankBefore: rankFor(progress.xp), warned: false, ended: false,
      events: null, // planned when the shift starts running (the problem list must be loaded first)
      eventLog: [], // events that happened: { id, solved }
      waveTimer: 0, // seconds until the next extra ticket during a phishing wave or month-end
      vipPending: false, // a VIP request is waiting for room in the queue
    };
  }

  // ---------- random events ----------
  const EVENTS_KEY = 'hdh-events';
  let eventsOn = readSetting(EVENTS_KEY) !== 'off';
  let flicker = 0; // seconds left of the power-flicker light dip

  function planShiftEvents() {
    if (!eventsOn) return [];
    const level = maxLevelFor(progress.xp);
    const available = (id) =>
      id === 'phishing_wave' ? queue.hasCategory('Security and phishing', level)
        : id === 'month_end' ? queue.hasCategory('Printers and scanners', level)
          : true;
    return planEvents(SHIFT_SECONDS, { available });
  }

  function spawnTicket(options, eventId) {
    const ticket = queue.spawn(employees, maxLevelFor(progress.xp), options);
    if (!ticket) return false;
    ticket.event = eventId;
    onNewTicket(ticket);
    return true;
  }

  function startEvent(id) {
    const e = EVENTS[id];
    shift.eventLog.push({ id, solved: 0 });
    sound.urgent();
    ui.toast(`<span aria-hidden="true">${e.icon}</span> <b>${ui.esc(e.name)}:</b> ${ui.esc(e.banner)}`, 'big event');
    if (e.burst) {
      flicker = 0.6;
      for (let i = 0; i < e.burst; i++) spawnTicket({}, id);
    }
    if (e.vip && !spawnTicket({ priority: 'P1', vip: true }, id)) shift.vipPending = true;
    if (e.category) shift.waveTimer = 0; // the first extra ticket comes straight away
  }

  /** Called every frame while the shift runs. */
  function updateEvents(prev, dt) {
    if (shift.events === null) shift.events = planShiftEvents();
    for (const e of eventsStarting(shift.events, prev, shift.elapsed)) startEvent(e.id);
    const fx = effectsAt(shift.events, shift.elapsed);
    queue.paused = fx.paused;
    if (fx.category) {
      shift.waveTimer -= dt;
      if (shift.waveTimer <= 0) {
        shift.waveTimer = fx.every;
        const id = runningEvents(shift.events, shift.elapsed).find((r) => EVENTS[r.id].category)?.id;
        spawnTicket({ category: fx.category }, id);
      }
    }
    if (shift.vipPending && spawnTicket({ priority: 'P1', vip: true }, 'vip')) shift.vipPending = false;
  }

  /** Count a solved ticket for the event it belongs to (or that was running). */
  function creditEvent(ticket) {
    const ids = new Set(runningEvents(shift.events ?? [], shift.elapsed).map((r) => r.id));
    if (ticket.event) ids.add(ticket.event);
    for (const entry of shift.eventLog) if (ids.has(entry.id)) entry.solved += 1;
  }
  let shift = newShift();
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
    ticket.openedAt = shift.elapsed;
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
      // hands-on tickets only:
      handsOn: null, // scenario from the server (what is broken, decoys)
      sim: null, // the simulated desk and switch
      view: 'talk', // 'talk' or 'desk'
      log: [], // what happened when the player checked things
    };
    details.set(ticket.number, detail);
    const person = byName.get(ticket.employee);
    Promise.all([
      api.getProblem(ticket.problemId),
      api.rephrase(ticket.problemId).catch(() => null),
      ticket.handsOn ? api.handsOn(ticket.problemId) : null,
    ])
      .then(([problem, reworded, scenario]) => {
        detail.problem = problem;
        detail.description = reworded?.user_description || problem.user_description; // fallback text
        if (scenario) {
          detail.handsOn = scenario;
          detail.sim = { ...createSim(scenario, person.desk), carrying: carried };
        }
        detail.state = 'ready';
      })
      .catch(() => {
        detail.state = 'error';
      })
      .finally(refreshTicketPanel);
  }

  function refreshTicketPanel() {
    if (activeTicket && talkingTo) ui.renderTicketPanel(talkingTo, activeTicket, details.get(activeTicket.number));
    ui.renderQueue(queue.open, byName, queueLabel);
  }

  // ---------- badges ----------
  // Checks the event, saves any new badges, and (unless quiet) announces them one by one.
  function earnBadges(event, { quiet = false } = {}) {
    const fresh = newlyEarned(progress, event);
    if (!fresh.length) return [];
    progress.achievements = award(progress.achievements, fresh);
    shift.badges.push(...fresh);
    saveProgress(progress);
    if (!quiet) {
      fresh.forEach((badge, i) => {
        setTimeout(() => {
          sound.badge();
          ui.toast(`<span aria-hidden="true">${badge.icon}</span> Badge earned: <b>${ui.esc(badge.name)}</b>`, 'big');
        }, 900 + i * 1400);
      });
    }
    return fresh;
  }

  // Close a ticket for good: XP, streak, stats, badges.
  function finishTicket(ticket, detail, result) {
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
    // Event bonuses: the manager walk-round, and VIP requests.
    const eventMult = effectsAt(shift.events ?? [], shift.elapsed).xpMult * (ticket.vip ? VIP_XP : 1);
    const xp = Math.round(baseXp * mult * eventMult);
    if (result.is_correct) creditEvent(ticket);
    const extra = [ticket.vip ? 'VIP ×2' : '', eventMult / (ticket.vip ? VIP_XP : 1) > 1 ? 'manager bonus ×1.5' : ''].filter(Boolean).join(', ');

    const before = rankFor(progress.xp);
    progress.xp += xp;
    progress.attempts += 1;
    if (result.is_correct) progress.solved += 1;
    if (result.is_correct && result.attempt === 1) progress.firstTry += 1;
    const outcome = !result.is_correct ? 'failed' : result.attempt === 1 ? 'first' : 'second';
    progress.topics = recordTopic(progress.topics, ticket.category, outcome);
    shift.records.push({
      problemId: ticket.problemId,
      category: ticket.category,
      outcome,
      overdue: ticket.secondsLeft <= 0,
      seconds: shift.elapsed - (ticket.openedAt ?? shift.elapsed),
      xp,
    });
    saveProgress(progress);
    earnBadges({ type: 'ticket', priority: ticket.priority, outcome, overdue: ticket.secondsLeft <= 0, secondsLeft: ticket.secondsLeft, sla: ticket.sla });
    detail.result = { ...result, xp, mult, extra };

    queue.close(ticket.number);
    byName.get(ticket.employee).marker.visible = false;
    ui.renderStatus(progress);
    ui.renderQueue(queue.open, byName, queueLabel);
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
    if (detail.job) detail.job = finish(detail.job);
  }

  async function chooseOption(index) {
    if (dailyOpen) {
      const option = daily && !daily.feedback ? daily.problems[daily.index].options[index] : null;
      if (option) answerDaily(option.id);
      return;
    }
    if (!activeTicket) return;
    const detail = details.get(activeTicket.number);
    if (detail?.sim) {
      if (detail.view === 'talk' && detail.handsOn.decoys[index]) chooseOptionById(detail.handsOn.decoys[index].id);
      return;
    }
    if (detail?.problem?.options[index]) chooseOptionById(detail.problem.options[index].id);
  }

  async function chooseOptionById(optionId) {
    if (!activeTicket) return;
    const ticket = activeTicket;
    const detail = details.get(ticket.number);
    if (detail.state !== 'ready' || detail.result || detail.answering) return;
    const option = { id: optionId };
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

      // A physical fix: the right answer, but the job is not done until the player has
      // walked to each place and back. XP is given then, so the timer keeps counting.
      if (result.is_correct && result.physical_steps?.length) {
        detail.result = { ...result, xp: null, mult: 1 };
        detail.job = createJob(result.physical_steps);
        sound.correct();
        return;
      }
      finishTicket(ticket, detail, result);
    } catch {
      detail.answerError = true;
    } finally {
      detail.answering = false;
      refreshTicketPanel();
    }
  }

  // ---------- hands-on tickets ----------
  function simAction(detail, step) {
    if (!step.message) return;
    detail.sim = step.sim;
    detail.log.push(step.message);
    if (step.changed) sound.click();
  }

  function onDeskPart(part, mode) {
    const detail = activeTicket && details.get(activeTicket.number);
    if (!detail?.sim || detail.result || detail.view !== 'desk') return;
    if (detail.sim.station === 'laptop') {
      const step = laptopAction({ ...detail.sim, carrying: carried }, part, mode);
      simAction(detail, step);
      if (step.message) setCarried(step.sim.carrying);
    } else {
      simAction(detail, reseat(detail.sim, part));
    }
    refreshTicketPanel();
  }

  function reportWifi() {
    const detail = activeTicket && details.get(activeTicket.number);
    if (!detail?.sim?.survey || detail.result) return;
    simAction(detail, reportCoverage(detail.sim));
    runTest(); // reporting it is what closes this ticket
  }

  async function runTest() {
    if (!activeTicket || !talkingTo) return;
    const ticket = activeTicket;
    const detail = details.get(ticket.number);
    if (!detail?.sim || detail.result || detail.answering) return;
    const outcome = testFix(detail.sim, talkingTo.name);
    detail.sim = outcome.sim;
    detail.log.push(outcome.message);
    if (!outcome.solved) {
      if (outcome.ok) sound.click();
      else sound.wrong();
      refreshTicketPanel();
      return;
    }
    detail.answering = true;
    refreshTicketPanel();
    try {
      const result = await api.finishHandsOn(ticket.problemId, detail.attempt);
      finishTicket(ticket, detail, result);
    } catch {
      detail.log.push('Could not reach the server to close the ticket. Ask them to test again.');
    } finally {
      detail.answering = false;
      refreshTicketPanel();
    }
  }

  // Stations away from the desk (the server room switch, the printer), opened by walking there and pressing E.
  let switchTicket = null; // the ticket a station is open for
  let stationKind = null; // 'switch' or 'printer'
  function openSwitch(ticket, kind = 'switch') {
    switchTicket = ticket;
    stationKind = kind;
    const d = details.get(ticket.number);
    if (d?.sim) d.sim = { ...d.sim, visited: true };
    renderSwitch();
  }
  // What the player is carrying from the parts cabinet (one item at a time).
  let carried = null;
  const cabinetLog = [];
  function setCarried(item) {
    carried = item;
    ui.setCarrying(item);
    // Every open hands-on ticket sees what the player is holding.
    for (const d of details.values()) if (d.sim) d.sim = { ...d.sim, carrying: item };
  }
  function openCabinet() {
    switchTicket = null;
    stationKind = 'cabinet';
    cabinetLog.length = 0;
    sound.click();
    renderSwitch();
  }
  function onCabinet(action, item) {
    const step = action === 'take' ? takeItem(carried, item) : putBack(carried);
    if (!step.message) return;
    setCarried(step.carrying);
    cabinetLog.push(step.message);
    if (step.changed) sound.click();
    renderSwitch();
    ui.renderQueue(queue.open, byName, queueLabel);
  }

  function renderSwitch() {
    if (stationKind === 'cabinet') return ui.renderCabinetPanel(carried, cabinetLog);
    const detail = switchTicket && details.get(switchTicket.number);
    if (!detail) return closeSwitch();
    const person = byName.get(switchTicket.employee);
    if (stationKind === 'printer') ui.renderPrinterPanel(person, switchTicket, detail);
    else ui.renderSwitchPanel(person, switchTicket, detail);
  }
  function closeSwitch() {
    switchTicket = null;
    stationKind = null;
    ui.hideTicketPanel();
  }
  function onSwitchAction(action, arg) {
    const detail = switchTicket && details.get(switchTicket.number);
    if (!detail?.sim) return;
    if (action === 'move') simAction(detail, moveToSpare(detail.sim, arg));
    else if (action === 'report') simAction(detail, reportPort(detail.sim));
    else if (action === 'printer') {
      // The printer may use what the player is carrying (a new toner cartridge).
      const step = printerAction({ ...detail.sim, carrying: carried }, arg);
      simAction(detail, step);
      if (step.message) setCarried(step.sim.carrying);
    }
    renderSwitch();
    ui.renderQueue(queue.open, byName, queueLabel);
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
  // Hovering a part in a close-up shows what it is, in the hint line above the drawing.
  let hintDefault = '';
  $('ticket').addEventListener('mouseover', (e) => {
    const hint = document.getElementById('station-hint');
    if (!hint) return;
    const part = e.target.closest('.station .part');
    if (!part) {
      if (hintDefault) hint.textContent = hintDefault;
      return;
    }
    if (!hint.classList.contains('pointing')) hintDefault = hint.textContent;
    hint.textContent = `${part.getAttribute('aria-label')}?`;
    hint.classList.add('pointing');
  });
  $('ticket').addEventListener('mouseout', (e) => {
    const hint = document.getElementById('station-hint');
    if (hint && e.target.closest('.station .part') && !e.relatedTarget?.closest?.('.station .part')) {
      hint.textContent = hintDefault || hint.textContent;
      hint.classList.remove('pointing');
    }
  });

  $('ticket').addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('.part')) {
      e.preventDefault();
      e.target.closest('.part').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return;
    }
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
      const detail = details.get(ticket.number);
      if (jobStage(detail?.job) === 'return') finishTicket(ticket, detail, detail.result); // back after the physical fix
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
    const done = activeTicket && details.get(activeTicket.number);
    if (done?.result && jobStage(done.job) === 'finished') details.delete(activeTicket.number);
    talkingTo = null;
    activeTicket = null;
    $('panel').hidden = true;
    ui.hideTicketPanel();
    if (shift.ended && !reportOpen) endShift(); // 5 PM passed while talking: report now
  }

  // ---------- end of shift ----------
  function endShift() {
    // Tickets still open at 5 PM are counted, then cleared for tomorrow.
    const leftOpen = queue.open.length;
    for (const t of queue.open) byName.get(t.employee).marker.visible = false;
    for (const t of [...queue.open]) {
      queue.close(t.number);
      details.delete(t.number);
    }
    ui.renderQueue(queue.open, byName, queueLabel);
    progress.shifts += 1;
    saveProgress(progress);
    const summary = summarizeShift(shift.records, leftOpen);
    earnBadges({ type: 'shift', summary }, { quiet: true }); // the report lists them
    reportOpen = true;
    sound.rankUp();
    lastReport = { summary, shiftNumber: shift.number, rankName: rankFor(progress.xp).name, badges: [...shift.badges] };
    queue.paused = false;
    ui.setEvents([]);
    ui.showReport(summary, {
      shiftNumber: shift.number,
      rankBefore: shift.rankBefore,
      rankAfter: rankFor(progress.xp),
      badges: shift.badges,
      events: shift.eventLog,
    });
    // The senior tech's note: worked out from the numbers, worded by the AI when it is available.
    const shown = shift.number;
    api.coach(coachRequest(summary, shift.records))
      .then((note) => { if (reportOpen && shift.number === shown) ui.setCoach(note); })
      .catch(() => ui.setCoach(null));
  }

  // ---------- daily challenge ----------
  const DAILY_KEY = 'hdh-daily';
  let dailyRecord = (() => {
    try {
      return { ...emptyDaily(), ...JSON.parse(localStorage.getItem(DAILY_KEY)) };
    } catch {
      return emptyDaily();
    }
  })();
  let daily = null; // the run in progress: { key, problems, index, marks, feedback, seconds, shownAt, answering }

  function openDaily() {
    if (reportOpen || helpOpen) return;
    if (talkingTo) closeConversation();
    if (stationKind) closeSwitch();
    dailyOpen = true;
    const key = dateKey();
    if (playedOn(dailyRecord, key)) return showDailyDone(key);
    ui.showDailyIntro({ dateLabel: dayLabel(key), streak: currentStreak(dailyRecord, key) });
  }

  function showDailyDone(key) {
    ui.showDailyDone({
      dateLabel: dayLabel(key),
      result: dailyRecord.results[key],
      streak: currentStreak(dailyRecord, key),
      best: dailyRecord.best,
      wait: untilTomorrow(),
    });
  }

  async function startDaily() {
    const key = dateKey();
    if (playedOn(dailyRecord, key)) return showDailyDone(key);
    ui.showDailyLoading();
    try {
      const data = await api.daily(key);
      if (!dailyOpen) return;
      if (!data.problems.length) return ui.showDailyLoading('No tickets are ready for the daily challenge yet.');
      daily = { key, problems: data.problems, index: 0, marks: [], feedback: null, seconds: 0, shownAt: performance.now(), answering: false };
      ui.showDailyQuestion(daily);
    } catch {
      ui.showDailyLoading('Could not reach the help desk server. Check the backend is running, then try again.');
    }
  }

  async function answerDaily(optionId) {
    if (!daily || daily.feedback || daily.answering) return;
    const problem = daily.problems[daily.index];
    daily.answering = true;
    daily.error = false;
    const thinking = (performance.now() - daily.shownAt) / 1000; // only time spent choosing counts
    try {
      // One try each: asking as the last try reveals the answer straight away.
      const result = await api.check(problem.id, optionId, 2, 1);
      daily.seconds += thinking;
      const right = result.explanations.find((e) => e.correct);
      daily.marks.push(result.is_correct);
      daily.feedback = { correct: result.is_correct, chosenWhy: result.chosen_why, rightText: right.text, rightWhy: right.why };
      if (result.is_correct) sound.correct();
      else sound.wrong();
    } catch {
      daily.error = true;
    } finally {
      daily.answering = false;
      if (dailyOpen) ui.showDailyQuestion(daily);
    }
  }

  function nextDaily() {
    if (!daily?.feedback) return;
    if (daily.index < daily.problems.length - 1) {
      daily.index += 1;
      daily.feedback = null;
      daily.shownAt = performance.now();
      return ui.showDailyQuestion(daily);
    }
    const correct = daily.marks.filter(Boolean).length;
    const result = { correct, total: daily.problems.length, seconds: Math.round(daily.seconds), marks: daily.marks };
    dailyRecord = recordDaily(dailyRecord, daily.key, result);
    try {
      localStorage.setItem(DAILY_KEY, JSON.stringify(dailyRecord));
    } catch {
      /* storage blocked: the result lasts until the tab closes */
    }
    const xp = correct * DAILY_XP_PER_RIGHT;
    if (xp) {
      progress.xp += xp;
      saveProgress(progress);
      ui.renderStatus(progress);
      ui.toast(`Daily challenge: +${xp} XP`);
    }
    sound.rankUp();
    if (correct === result.total) confetti();
    showDailyDone(daily.key);
    daily = null;
  }

  async function shareDaily() {
    const key = dateKey();
    const result = dailyRecord.results[key];
    if (!result) return;
    const streak = currentStreak(dailyRecord, key);
    const imageUrl = await drawDailyCard({ dateLabel: dayLabel(key), ...result, streak });
    shareOpen = true;
    ui.showShare({
      title: 'Your daily challenge score',
      lead: 'Download the image and paste the text into a post. The squares show how you did without giving the answers away.',
      imageUrl,
      fileName: `help-desk-hero-daily-${key}.png`,
      text: dailyPostText(key, result, streak),
    });
  }

  function closeDaily() {
    if (daily && daily.marks.length > 0 && daily.marks.length < daily.problems.length) {
      if (!window.confirm('Leave the daily challenge? You only get one go per day, so it will count as finished.')) return;
      while (daily.marks.length < daily.problems.length) daily.marks.push(false);
      daily.index = daily.problems.length - 1;
      daily.feedback = { correct: false };
      nextDaily();
    }
    daily = null;
    dailyOpen = false;
    ui.hideDaily();
  }

  $('daily-btn').addEventListener('click', () => (dailyOpen ? closeDaily() : openDaily()));
  $('daily').addEventListener('click', (e) => {
    const option = e.target.closest('[data-daily-option]');
    if (option) return answerDaily(Number(option.dataset.dailyOption));
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'daily-start') startDaily();
    else if (action === 'daily-next') nextDaily();
    else if (action === 'daily-share') shareDaily();
    else if (action === 'daily-close') closeDaily();
  });

  // ---------- share card and certificate ----------
  async function shareResult() {
    if (!lastReport || lastReport.summary.handled === 0) return;
    const { summary, shiftNumber, rankName, badges } = lastReport;
    const imageUrl = await drawResultCard({
      summary, shiftNumber, rankName,
      badgeCount: Object.keys(progress.achievements).length,
      badgeTotal: ACHIEVEMENTS.length,
      xp: progress.xp,
      nextRank: rankFor(progress.xp).next,
    });
    shareOpen = true;
    ui.showShare({
      title: `Your shift ${shiftNumber} result`,
      lead: 'Download the image, then start a LinkedIn post, add the image and paste the text. Change the words so they sound like you.',
      imageUrl,
      fileName: `help-desk-hero-shift-${shiftNumber}.png`,
      text: postText(summary, { shiftNumber, rankName, badgeNames: badges.map((b) => b.name) }),
    });
  }

  async function createCertificate() {
    const top = RANKS[RANKS.length - 1];
    if (progress.xp < top.min) return;
    const box = document.getElementById('cert-name');
    const name = cleanName(box?.value);
    document.getElementById('cert-error').hidden = Boolean(name);
    if (!name) {
      box?.focus();
      return;
    }
    writeSetting(CERT_NAME_KEY, name);
    const imageUrl = await drawCertificate({
      name,
      rankName: top.name,
      solved: progress.solved,
      firstTryRate: progress.attempts ? Math.round((progress.firstTry / progress.attempts) * 100) : 0,
      shifts: progress.shifts,
      mastered: Object.values(progress.topics).filter((t) => topicStatus(t) === 'mastered').length,
      date: new Date(),
    });
    shareOpen = true;
    ui.showShare({
      title: 'Your completion certificate',
      lead: 'Well done! Download it as an image. It shows that you finished the game, so describe it that way if you share it.',
      imageUrl,
      fileName: 'help-desk-hero-certificate.png',
    });
  }

  function closeShare() {
    shareOpen = false;
    ui.hideShare();
  }

  async function copyShareText() {
    const box = document.getElementById('share-text');
    if (!box) return;
    try {
      await navigator.clipboard.writeText(box.value);
    } catch {
      box.select(); // clipboard blocked: select it so Ctrl+C works
      document.execCommand?.('copy');
    }
    ui.toast('Post text copied');
  }

  function startNextShift() {
    ui.hideReport();
    reportOpen = false;
    shift = newShift();
    queue.timer = 4; // first ticket of the day arrives quickly
    ui.toast(`Shift ${shift.number} has started. Good morning!`);
  }

  function openProgress() {
    progressOpen = true;
    const categories = [...new Set([...queue.pool.map((p) => p.category), ...Object.keys(progress.topics)])];
    ui.showProgress(progress, categories, { certName: readSetting(CERT_NAME_KEY) });
  }
  function closeProgress() {
    progressOpen = false;
    ui.hideProgress();
  }

  $('progress-btn').addEventListener('click', () => (progressOpen ? closeProgress() : openProgress()));
  $('report').addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'next-shift') startNextShift();
    else if (action === 'open-progress') openProgress();
    else if (action === 'share-result') shareResult();
  });
  $('share').addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close-share' || e.target.id === 'share') closeShare();
    else if (action === 'copy-text') copyShareText();
  });
  $('progress').addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.target.id === 'cert-form') createCertificate();
  });
  $('progress').addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close-progress') closeProgress();
    else if (action === 'reset-progress' && window.confirm('Reset all XP, ranks and topic stats on this computer?')) {
      Object.assign(progress, emptyProgress());
      saveProgress(progress);
      ui.renderStatus(progress);
      openProgress();
    }
  });

  input.onPress('KeyE', () => {
    if (stationKind) closeSwitch();
    else if (talkingTo) closeConversation();
    else if (working || overlayOpen()) return;
    else if (nearPlace) startWork(nearPlace);
    else if (nearby) openConversation(nearby);
  });

  // ---------- physical fixes ----------
  function startWork(target) {
    if (target.kind === 'cabinet') return openCabinet();
    if (target.kind === 'switch' || target.kind === 'printer') return openSwitch(target.ticket, target.kind);
    working = { ...target, t: 0 };
    player.face(target.place.markX, target.place.markZ);
    sound.click();
  }

  function updateWork(dt) {
    working.t += dt;
    const pct = Math.min(1, working.t / WORK_SECONDS) * 100;
    $('prompt').innerHTML = `<div>${ui.esc(working.step.action)}<span class="dots"></span></div><div class="work-bar"><div style="width:${pct}%"></div></div>`;
    $('prompt').hidden = false;
    if (working.t < WORK_SECONDS) return;
    const detail = details.get(working.ticket.number);
    if (working.kind === 'survey' && detail?.sim) {
      const step = measure(detail.sim, working.step.place);
      simAction(detail, step);
      sound.correct();
      ui.toast(`${ui.esc(step.message)}`);
      ui.renderQueue(queue.open, byName, queueLabel);
    } else if (detail?.job) {
      detail.job = advance(detail.job);
      sound.correct();
      const next = jobLabel(detail.job, working.ticket.employee).replace(/^Next: /, '');
      ui.toast(`Done. Next: <b>${ui.esc(next)}</b>`);
      ui.renderQueue(queue.open, byName, queueLabel);
    }
    working = null;
  }
  input.onPress('Escape', () => {
    if (stationKind && !overlayOpen()) closeSwitch();
    else if (shareOpen) closeShare();
    else if (dailyOpen) closeDaily();
    else if (progressOpen) closeProgress();
    else if (helpOpen) closeHelp();
    else if (!reportOpen) closeConversation();
  });
  input.onPress('KeyH', takeHint);
  input.onPress('KeyI', () => setDeskView('desk'));
  input.onPress('KeyB', () => setDeskView('talk'));
  input.onPress('KeyT', runTest);
  input.onPress('KeyL', () => switchTicket && onSwitchAction('report'));
  function setDeskView(view) {
    const detail = activeTicket && talkingTo && details.get(activeTicket.number);
    if (!detail?.sim || detail.result || detail.state !== 'ready') return;
    if (view === 'desk' && !['desk', 'laptop'].includes(detail.sim.station)) return; // printer and Wi-Fi work elsewhere
    detail.view = view;
    if (view === 'desk') detail.sim = { ...detail.sim, visited: true }; // the mission card moves on to "Fix it"
    refreshTicketPanel();
  }
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
    if (stationKind) {
      const item = e.target.closest('[data-item]');
      if (item) return onCabinet('take', item.dataset.item);
      if (e.target.closest('[data-action="put-back"]')) return onCabinet('put-back');
      const spare = e.target.closest('[data-spare]');
      if (spare) return onSwitchAction('move', Number(spare.dataset.spare));
      const printerPart = e.target.closest('[data-printer]');
      if (printerPart) return onSwitchAction('printer', printerPart.dataset.printer);
      const act = e.target.closest('[data-action]')?.dataset.action;
      if (act === 'report') onSwitchAction('report');
      else if (act === 'close-station') closeSwitch();
      return;
    }
    const part = e.target.closest('[data-part]');
    if (part) return onDeskPart(part.dataset.part);
    const mode = e.target.closest('[data-mode]');
    if (mode) return onDeskPart('mode', mode.dataset.mode);
    if (e.target.closest('[data-action="report-wifi"]')) return reportWifi();
    const decoy = e.target.closest('[data-decoy]');
    if (decoy) return chooseOptionById(Number(decoy.dataset.decoy));
    const option = e.target.closest('.opt');
    if (option) return chooseOption(Number(option.dataset.index));
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'inspect') return setDeskView('desk');
    if (action === 'talk-view') return setDeskView('talk');
    if (action === 'test') return runTest();
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

  // ---------- wall clock ----------
  let lastClock = '';
  function refreshClock(current) {
    const { label } = clockFor(current.elapsed);
    const text = `Shift ${current.number}, ${label}`;
    if (text === lastClock) return false;
    lastClock = text;
    ui.setClock(text, current.elapsed >= SHIFT_SECONDS - 60);
    return true;
  }

  // ---------- game loop ----------
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  let hudTimer = 0;
  let mapTimer = 0;
  // Frame-rate tracking: for the optional FPS counter, and to switch slow machines to Smooth.
  let fpsFrames = 0;
  let fpsTime = 0;
  let autoCheckFrames = 0;
  let autoCheckTime = 0;
  let autoChecked = false;

  function frame() {
    const rawDt = clock.getDelta(); // real time since the last frame
    const dt = Math.min(rawDt, 0.05); // cap so a slow frame can't teleport the player
    const time = clock.elapsedTime;

    player.update(dt, input.state, followCam.yaw, colliders, talkingTo !== null || overlayOpen() || working !== null || stationKind !== null);
    if (switchTicket && !queue.open.includes(switchTicket)) closeSwitch();
    followCam.focusTarget = activeTicket ? 1 : 0;
    followCam.update(dt, player.position);

    const shiftRunning = backendReady && shiftStarted && !overlayOpen() && !shift.ended;
    if (shiftRunning) {
      const before = shift.elapsed;
      shift.elapsed += dt;
      updateEvents(before, dt);
      // No new tickets in the last office half hour, so the day can wind down.
      const nearEnd = shift.elapsed > SHIFT_SECONDS - 30;
      const fresh = queue.update(dt, employees, maxLevelFor(progress.xp));
      for (const ticket of fresh) {
        if (nearEnd) queue.close(ticket.number);
        else onNewTicket(ticket);
      }
      if (!shift.warned && shift.elapsed >= SHIFT_SECONDS - 60) {
        shift.warned = true;
        ui.toast('It is 4 PM. One hour left in your shift.');
      }
      if (shift.elapsed >= SHIFT_SECONDS) {
        shift.ended = true;
        if (!talkingTo) endShift();
        else ui.toast('It is 5 PM. Finish this ticket to see your shift report.');
      }
    }
    refreshClock(shift);

    // Physical fixes: a place with a step waiting comes before people nearby.
    const jobs = activeJobs();
    const places = allPlaces();
    if (working && (!queue.open.includes(working.ticket) || overlayOpen())) {
      if (!queue.open.includes(working.ticket)) working = null; // shift ended mid-step
    } else if (working) {
      updateWork(dt);
    }
    nearPlace = talkingTo || working || stationKind ? null : placeInReach(player.position, places);

    // Who is close enough to talk to?
    nearby = talkingTo || working || stationKind ? null : nearestWithin(player.position, employees, TALK_RADIUS);
    if (nearPlace && nearby) {
      // Both in reach (Nida stands next to the printer): use whichever is closer.
      const toPlace = Math.hypot(nearPlace.place.x - player.position.x, nearPlace.place.z - player.position.z);
      const toPerson = Math.hypot(nearby.x - player.position.x, nearby.z - player.position.z);
      if (toPerson < toPlace) nearPlace = null;
      else nearby = null;
    }
    if (stationKind) {
      $('prompt').hidden = true;
    } else if (working) {
      // the prompt shows the progress bar (updateWork)
    } else if (nearPlace) {
      $('prompt').innerHTML = `Press <kbd>E</kbd> to ${ui.esc(nearPlace.step.action.charAt(0).toLowerCase() + nearPlace.step.action.slice(1))}`;
      $('prompt').hidden = false;
    } else if (nearby) {
      const ticket = queue.forEmployee(nearby.name);
      const stage = ticket ? jobStage(details.get(ticket.number)?.job) : 'finished';
      const verb = !ticket ? 'talk to' : stage === 'return' ? 'finish the fix for' : 'help';
      $('prompt').innerHTML = `Press <kbd>E</kbd> to ${verb} <b>${ui.esc(nearby.name)}</b>`;
      $('prompt').hidden = false;
    } else {
      $('prompt').hidden = true;
    }
    const waiting = new Set(placesWaiting(jobs));
    for (const [key, m] of placeMarkers) {
      m.group.visible = waiting.has(key);
      if (m.group.visible) {
        m.marker.position.y = 2.4 + Math.sin(time * 3) * 0.08;
        m.marker.rotation.y = time * 2;
        m.ring.material.opacity = 0.55 + 0.35 * Math.sin(time * 4);
      }
    }
    if (talkingTo && nearestWithin(player.position, [talkingTo], TALK_RADIUS + 0.5) === null) closeConversation();
    if (switchTicket) ui.updateTicketTimer(switchTicket, false);
    if (activeTicket) {
      const d = details.get(activeTicket.number);
      ui.updateTicketTimer(activeTicket, Boolean(d?.result) && jobStage(d.job) === 'finished');
    }

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
        const lx = (tmp.x * 0.5 + 0.5) * window.innerWidth;
        const ly = (-tmp.y * 0.5 + 0.5) * window.innerHeight;
        person.label.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px) translate(-50%, -100%)`;
        if (refreshHud) {
          const bar = ticket
            ? `<div class="lbar"><div style="width:${Math.max(0, (ticket.secondsLeft / ticket.sla) * 100)}%;background:${PRIORITIES[ticket.priority].color}"></div></div>`
            : '';
          person.label.innerHTML = `<div class="row">${ui.esc(person.name)} <span class="desk-no">Desk ${person.desk}</span>${ticket ? ui.priorityBadge(ticket.priority) : ''}</div>${bar}`;
        }
      }
      if (person.marker.visible) {
        person.marker.position.y = 2.15 + Math.sin(time * 3) * 0.08;
        person.marker.rotation.y = time * 2;
      }
    }
    if (refreshHud) {
      ui.renderQueue(queue.open, byName, queueLabel);
      ui.setEvents(shiftRunning ? runningEvents(shift.events ?? [], shift.elapsed) : []);
    }
    if (flicker > 0) {
      flicker -= dt;
      const dip = flicker > 0 && Math.floor(flicker * 20) % 2 === 0 ? 0.25 : 1;
      hemi.intensity = 1.4 * dip;
      sun.intensity = 2.2 * dip;
    }

    for (const led of blinkers) {
      led.material.emissiveIntensity = Math.sin(time * led.speed + led.phase) > 0.2 ? 1.2 : 0.1;
    }

    // Minimap, about 15 times a second (plenty for a map, and cheap)
    mapTimer -= dt;
    if (mapTimer <= 0) {
      mapTimer = 0.066;
      minimap.draw({
        player: player.position,
        playerAngle: player.group.rotation.y,
        cameraYaw: followCam.yaw,
        people: employees,
        ticketFor: (name) => queue.forEmployee(name),
        targets: [...waiting].map((key) => PLACES[key]),
        time,
      });
    }
    document.body.classList.toggle('talking', talkingTo !== null);

    renderer.render(scene, camera);

    fpsFrames += 1;
    fpsTime += rawDt;
    if (fpsTime >= 0.5) {
      if (showFps) $('fps').textContent = `${Math.round(fpsFrames / fpsTime)} fps, ${renderer.info.render.calls} draw calls, ${gpuName}`;
      fpsFrames = 0;
      fpsTime = 0;
    }
    if (!autoChecked && !qualityChosen && time > 2) {
      autoCheckFrames += 1;
      autoCheckTime += rawDt;
      if (autoCheckTime >= 3) {
        autoChecked = true;
        if (autoCheckFrames / autoCheckTime < 40 && quality === 'detailed') {
          applyQuality('smooth');
          ui.toast('Switched to smooth graphics so the game runs better on this computer.');
        }
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Handy for debugging in the browser console: helpDeskHero.queue.open
  // Events switch in the help card
  $('events-toggle').checked = eventsOn;
  $('events-toggle').addEventListener('change', (e) => {
    eventsOn = e.target.checked;
    writeSetting(EVENTS_KEY, eventsOn ? 'on' : 'off');
    if (!eventsOn && shift.events) shift.events = shift.events.filter((ev) => ev.at <= shift.elapsed); // drop upcoming ones
  });

  window.helpDeskHero = {
    triggerEvent: (id) => {
      shift.events = [...(shift.events ?? []), { id, at: shift.elapsed + 0.01 }];
    },
    player, followCam, employees, scene, queue, details, progress, renderer, applyQuality, gpuName, endShift,
    get shift() { return shift; },
  };
}

start();
