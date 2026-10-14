// Entry point: sets up Three.js, builds the office, connects to the backend,
// and runs the game loop (movement, camera, tickets, interface).

import * as THREE from 'three';
import { api, API_BASE } from './api.js';
import { FollowCamera } from './camera.js';
import { createEmployees } from './employees.js';
import { Input } from './input.js';
import { nearestWithin } from './logic.js';
import { Minimap } from './minimap.js';
import { BOUNDS, buildOffice, PLAYER_START } from './office.js';
import { createPlayer } from './player.js';
import { ACHIEVEMENTS, award, newlyEarned } from './achievements.js';
import { cleanName, drawCertificate, drawResultCard, postText } from './cards.js';
import { confetti } from './confetti.js';
import { sound } from './sound.js';
import { clockFor, recordTopic, SHIFT_SECONDS, summarizeShift, topicStatus } from './shift.js';
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
  const minimap = new Minimap($('minimap-canvas'), BOUNDS, colliders);

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
  let backendReady = false;
  let shiftStarted = false; // tickets only arrive after the player presses "Start my shift"
  let helpOpen = false;
  let reportOpen = false;
  let progressOpen = false;
  let shareOpen = false;
  let lastReport = null; // the most recent shift report, for the share card
  const overlayOpen = () => helpOpen || reportOpen || progressOpen || shareOpen; // pauses the shift and the player

  // Badges already earned before badges existed (or on another version) are given quietly.
  const backfill = newlyEarned(progress, { type: 'load' });
  if (backfill.length) {
    progress.achievements = award(progress.achievements, backfill);
    saveProgress(progress);
  }

  // ---------- the shift: 9 AM to 5 PM in 8 real minutes ----------
  function newShift() {
    return { number: progress.shifts + 1, elapsed: 0, records: [], badges: [], rankBefore: rankFor(progress.xp), warned: false, ended: false };
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
      const outcome = !result.is_correct ? 'failed' : result.attempt === 1 ? 'first' : 'second';
      progress.topics = recordTopic(progress.topics, ticket.category, outcome);
      shift.records.push({
        category: ticket.category,
        outcome,
        overdue: ticket.secondsLeft <= 0,
        seconds: shift.elapsed - (ticket.openedAt ?? shift.elapsed),
        xp,
      });
      saveProgress(progress);
      earnBadges({ type: 'ticket', priority: ticket.priority, outcome, overdue: ticket.secondsLeft <= 0, secondsLeft: ticket.secondsLeft, sla: ticket.sla });
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
    ui.renderQueue(queue.open, byName);
    progress.shifts += 1;
    saveProgress(progress);
    const summary = summarizeShift(shift.records, leftOpen);
    earnBadges({ type: 'shift', summary }, { quiet: true }); // the report lists them
    reportOpen = true;
    sound.rankUp();
    lastReport = { summary, shiftNumber: shift.number, rankName: rankFor(progress.xp).name, badges: [...shift.badges] };
    ui.showReport(summary, {
      shiftNumber: shift.number,
      rankBefore: shift.rankBefore,
      rankAfter: rankFor(progress.xp),
      badges: shift.badges,
    });
  }

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
    if (talkingTo) closeConversation();
    else if (nearby) openConversation(nearby);
  });
  input.onPress('Escape', () => {
    if (shareOpen) closeShare();
    else if (progressOpen) closeProgress();
    else if (helpOpen) closeHelp();
    else if (!reportOpen) closeConversation();
  });
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

    player.update(dt, input.state, followCam.yaw, colliders, talkingTo !== null || overlayOpen());
    followCam.focusTarget = activeTicket ? 1 : 0;
    followCam.update(dt, player.position);

    const shiftRunning = backendReady && shiftStarted && !overlayOpen() && !shift.ended;
    if (shiftRunning) {
      shift.elapsed += dt;
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
        const lx = (tmp.x * 0.5 + 0.5) * window.innerWidth;
        const ly = (-tmp.y * 0.5 + 0.5) * window.innerHeight;
        person.label.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px) translate(-50%, -100%)`;
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
  window.helpDeskHero = {
    player, followCam, employees, scene, queue, details, progress, renderer, applyQuality, gpuName, endShift,
    get shift() { return shift; },
  };
}

start();
