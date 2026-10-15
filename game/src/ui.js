// Everything drawn as HTML on top of the 3D view: player card, ticket list, ticket window,
// messages, the welcome card and the start-up screen.
// Text from the server is always escaped before display.

import { canSend, TEAM_ICONS } from './escalation.js';
import { COURSES, PATH, RESOURCES_REVIEWED, ROADMAPS } from './resources.js';
import { ACHIEVEMENTS } from './achievements.js';
import { countdown, EVENTS } from './events.js';
import { DISCLAIMER, NAME_MAX } from './cards.js';
import { missionStep, needsServerRoom, placesNeeded, SURVEY_SPOTS, surveyDone } from './handson.js';
import { jobStage, PLACES } from './jobs.js';
import {
  benchSummary, benchSvg, cabinetSvg, chipsHtml, deskSummary, deskSvg, displayModeHtml, laptopSummary, laptopSvg, pcDeskSummary, pcDeskSvg,
  printerSummary, printerSvg, switchSvg,
} from './stations.js';
import { benchReadings, CARRY_NAMES } from './handson.js';
import { topicStatus } from './shift.js';
import { PRIORITIES, RANKS, rankFor, streakMultiplier } from './tickets.js';

const $ = (id) => document.getElementById(id);

export const MAX_QUESTIONS = 3; // senior tech questions per ticket (keeps AI use and cost low)

// Plain words for priorities, so beginners don't need to know what "P2" means.
const PRIORITY_WORDS = { P1: 'Urgent', P2: 'High', P3: 'Normal', P4: 'Low' };

export function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function priorityBadge(priority) {
  return `<span class="chip" style="--c:${PRIORITIES[priority].color}">${PRIORITY_WORDS[priority]}</span>`;
}

function hex(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function avatar(person, size = '') {
  return `<span class="avatar ${size}" style="--c:${hex(person.shirt)}" aria-hidden="true">${esc(person.name[0])}</span>`;
}

const key = (k) => `<kbd>${k}</kbd>`;

// ---------- start-up screen ----------

export function bootMessage(title, detail = '', { error = false, retry = null } = {}) {
  $('boot').hidden = false;
  $('boot-title').textContent = title;
  $('boot-detail').innerHTML = detail;
  $('boot').classList.toggle('error', error);
  $('boot-retry').hidden = !retry;
  $('boot-retry').onclick = retry;
}

export function hideBoot() {
  $('boot').hidden = true;
}

/** Move the loading bar to a step: { label, at } from menu.js. */
export function bootStep(step) {
  $('boot').hidden = false;
  $('boot').classList.remove('error');
  $('load-fill').style.width = `${step.at}%`;
  $('boot-title').textContent = step.id === 'ready' ? 'Ready!' : `${step.label}...`;
  $('boot-detail').textContent = '';
  $('boot-retry').hidden = true;
}

export function bootTip(text) {
  $('boot-tip').innerHTML = `<b>Tip:</b> ${esc(text)}`;
}

// ---------- main menu ----------

/**
 * Draw the main menu. view: 'main', 'name', 'settings' or 'reset'.
 * state: from menuState(); settings: { muted, quality, events }.
 */
export function renderMenu(state, view, settings, { error = '' } = {}) {
  let body;
  if (view === 'name' || state.needsName) {
    body = `
      <h1 class="menu-greeting">${state.needsName ? 'Welcome to the help desk!' : 'Change your name'}</h1>
      <p class="menu-sub">${state.needsName ? 'What should everyone in the office call you?' : 'This is the name we greet you with and put on your certificate.'}</p>
      <form data-menu-form="name">
        <label class="menu-field"><span class="small"><b>Your name</b></span>
          <input id="menu-name" maxlength="${NAME_MAX}" autocomplete="nickname" value="${esc(state.name)}" placeholder="For example, Ahtisham"></label>
        ${error ? `<p class="menu-error">${esc(error)}</p>` : ''}
        <p class="menu-note">🔒 Your name stays on this device. It is never sent to our server or the AI.</p>
        <div class="menu-list"><button class="btn big" type="submit">${state.needsName ? 'Continue' : 'Save'}</button>
        ${state.needsName ? '' : '<button class="btn ghost" type="button" data-menu="back">Back</button>'}</div>
      </form>`;
  } else if (view === 'settings') {
    body = `
      <h1 class="menu-greeting">Settings</h1>
      <p class="menu-sub">Saved on this device.</p>
      <div class="menu-settings">
        <label class="setting"><span><b>Sound effects</b><small>Clicks, ticket alerts and results</small></span>
          <input type="checkbox" class="switch" data-setting="sound" ${settings.muted ? '' : 'checked'}></label>
        <label class="setting"><span><b>Footsteps</b><small>Soft steps while you walk</small></span>
          <input type="checkbox" class="switch" data-setting="footsteps" ${settings.footsteps ? 'checked' : ''}></label>
        <label class="setting"><span><b>Background music</b><small>Very quiet, calm music</small></span>
          <input type="checkbox" class="switch" data-setting="music" ${settings.music ? 'checked' : ''}></label>
        <div class="setting"><span><b>Graphics</b><small>Smooth runs faster on laptops</small></span>
          <span class="seg"><button data-setting="smooth" class="${settings.quality === 'smooth' ? 'on' : ''}">Smooth</button><button data-setting="detailed" class="${settings.quality === 'detailed' ? 'on' : ''}">Detailed</button></span></div>
        <label class="setting"><span><b>Random events</b><small>Power flickers, phishing waves, VIP requests</small></span>
          <input type="checkbox" class="switch" data-setting="events" ${settings.events ? 'checked' : ''}></label>
      </div>
      <div class="menu-list"><button class="btn" data-menu="back">Back</button></div>`;
  } else if (view === 'reset') {
    body = `
      <h1 class="menu-greeting">Start a new game?</h1>
      <p class="menu-sub">This deletes your XP, rank, badges and daily challenge streak on this device. Your name and settings stay.</p>
      <div class="menu-list">
        <button class="btn danger-btn" data-menu="reset-yes">Yes, start over</button>
        <button class="btn ghost" data-menu="back">Cancel</button>
      </div>`;
  } else {
    body = `
      <h1 class="menu-greeting">${esc(state.greeting)}</h1>
      <p class="menu-sub">${esc(state.subtitle)}</p>
      <div class="menu-list">
        <button class="btn big" data-menu="play">${esc(state.primary)} ${key('Enter')}</button>
        <button class="btn ghost" data-menu="daily">📅 Daily challenge</button>
        <div class="menu-row">
          <button class="btn ghost" data-menu="progress">📊 My progress</button>
          <button class="btn ghost" data-menu="help">❓ How to play</button>
        </div>
        <button class="btn ghost" data-menu="settings">⚙️ Settings</button>
      </div>
      <div class="menu-links">
        <button class="menu-link" data-menu="name">Not ${esc(state.name)}? Change name</button>
        ${state.canReset ? '<button class="menu-link danger" data-menu="reset">New game</button>' : ''}
      </div>`;
  }
  $('menu-body').innerHTML = body;
  $('menu').hidden = false;
  const focus = $('menu-name') ?? $('menu-body').querySelector('[data-menu="play"]');
  setTimeout(() => focus?.focus(), 0);
}

export function hideMenu() {
  $('menu').hidden = true;
}

// ---------- welcome / how to play ----------

export function showHelp(firstTime) {
  $('help-start').textContent = firstTime ? 'Start my shift' : 'Back to work';
  $('help').hidden = false;
  setTimeout(() => $('help-start').focus(), 0);
}

export function hideHelp() {
  $('help').hidden = true;
}

// ---------- player card ----------

export function renderStatus(progress) {
  const rank = rankFor(progress.xp);
  const pct = rank.next ? ((progress.xp - rank.min) / (rank.next.min - rank.min)) * 100 : 100;
  const firstTry = progress.attempts ? Math.round((progress.firstTry / progress.attempts) * 100) : null;
  const streak =
    progress.streak >= 2
      ? `<div class="streak">${progress.streak} in a row${progress.streak >= 3 ? `, bonus ×${streakMultiplier(progress.streak)} XP` : ''}</div>`
      : '';
  $('status').innerHTML = `
    <div class="rank-row"><span class="rank">${esc(rank.name)}</span><span class="xp">${progress.xp} XP</span></div>
    <div class="bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><div style="width:${pct.toFixed(1)}%"></div></div>
    <div class="small">${rank.next ? `${rank.next.min - progress.xp} XP until ${esc(rank.next.name)}` : 'You reached the top rank'}</div>
    <div class="small">${progress.solved} solved${firstTry === null ? '' : `, ${firstTry}% right first time`}</div>
    ${streak}`;
}

// ---------- ticket list ----------

export function renderQueue(tickets, people, labelFor = () => '') {
  if (tickets.length === 0) {
    $('queue').innerHTML = '<p class="empty">No one needs help right now. New requests will appear here.</p>';
    return;
  }
  $('queue').innerHTML = tickets
    .map((t) => {
      const person = people.get(t.employee);
      const pct = Math.max(0, (t.secondsLeft / t.sla) * 100);
      const late = t.secondsLeft <= 0;
      const label = labelFor(t);
      return `<div class="qitem${late ? ' late' : ''}">
        ${avatar(person)}
        <div class="qmain">
          <div class="qtop"><b>${esc(t.employee)}</b>${t.vip ? '<span class="vip">VIP</span>' : ''}${priorityBadge(t.priority)}</div>
          ${label ? `<div class="small job-label">${esc(label)}</div>` : `<div class="small">${esc(t.category)}</div>`}
          <div class="bar thin"><div style="width:${pct}%;background:${PRIORITIES[t.priority].color}"></div></div>
          <div class="small ${late ? 'late-text' : ''}">${late ? 'Overdue: help them soon' : `${formatTime(t.secondsLeft)} left`}</div>
        </div>
      </div>`;
    })
    .join('');
}

// ---------- ticket window ----------

export function renderTicketPanel(person, ticket, detail) {
  const head = `
    <header class="tp-head">
      ${avatar(person, 'big')}
      <div class="tp-who"><div class="tp-name">${esc(person.name)}</div><div class="small">${esc(person.department)}, Desk ${person.desk}, ticket ${ticket.number}</div></div>
      <div class="tp-meta">${priorityBadge(ticket.priority)}<span id="tp-timer" class="timer"></span></div>
    </header>`;

  let body = '';
  let actions = '';

  if (detail.state === 'loading') {
    body = `<div class="bubble muted">${esc(person.name)} is describing the problem<span class="dots"></span></div>`;
    actions = `<button class="btn ghost" data-action="later">Come back later ${key('E')}</button>`;
  } else if (detail.state === 'error') {
    body = `<p class="notice bad">This ticket could not load. Check that the backend is still running, then try again.</p>`;
    actions = `<button class="btn" data-action="retry">Try again ${key('R')}</button><button class="btn ghost" data-action="later">Close ${key('E')}</button>`;
  } else if (detail.escalation && !detail.escalation.review) {
    const esc_ = detail.escalation;
    body = escalationFormHtml(detail);
    actions = `<button class="btn ghost" data-action="later">Come back later ${key('E')}</button>
      <button class="btn" data-action="send-escalation" ${canSend(esc_) ? '' : 'disabled'}>${esc_.sending ? 'Sending…' : 'Send escalation'}</button>`;
  } else if (detail.result) {
    const pending = jobStage(detail.job) !== 'finished';
    body = resultHtml(detail) + jobHtml(person, detail) + seniorHtml(detail);
    const asked = detail.chat.filter((t) => t.role === 'junior').length;
    const canAsk = !detail.chatOpen && asked < MAX_QUESTIONS;
    actions = `${canAsk ? `<button class="btn ghost" data-action="ask">Ask the senior tech ${key('Q')}</button>` : ''}
      <button class="btn" data-action="close">${pending ? 'On my way' : 'Close ticket'} ${key('E')}</button>`;
  } else if (detail.sim) {
    const hintsLeft = detail.problem.hint_count - detail.hints.length;
    const hintBtn = hintsLeft > 0 ? `<button class="btn ghost" data-action="hint">Hint (−25% XP) ${key('H')}</button>` : '';
    const testBtn = (primary) => `<button class="btn${primary ? '' : ' ghost'}" data-action="test" ${detail.answering ? 'disabled' : ''}>Ask ${esc(person.name)} to test ${key('T')}</button>`;
    const step = missionStep(detail.sim);
    if (detail.view === 'desk') {
      body = deskHtml(person, detail);
      actions = `${hintBtn}<button class="btn ghost" data-action="talk-view">Back ${key('B')}</button>${testBtn(true)}`;
    } else {
      body = handsOnTalkHtml(person, detail);
      const station = detail.sim.station;
      let main;
      if (station === 'survey') {
        main = surveyDone(detail.sim)
          ? `<button class="btn" data-action="report-wifi" ${detail.answering ? 'disabled' : ''}>Report the weak coverage</button>`
          : `<button class="btn" data-action="later">Go and measure ${key('E')}</button>`;
      } else if (step === 3) {
        main = testBtn(true);
      } else if (station === 'bench' && detail.sim.bench.where === 'bench') {
        main = `${testBtn(false)}<button class="btn" data-action="later">Go to the repair bench ${key('E')}</button>`;
      } else if (station === 'printer') {
        main = `${testBtn(false)}<button class="btn" data-action="later">Go to the printer ${key('E')}</button>`;
      } else {
        main = `${testBtn(false)}<button class="btn" data-action="inspect">Inspect Desk ${person.desk} ${key('I')}</button>`;
      }
      actions = `${hintBtn}${main}`;
    }
    } else {
    body = questionHtml(person, detail);
    const p = detail.problem;
    const hintsLeft = p.hint_count - detail.hints.length;
    actions = `${hintsLeft > 0 ? `<button class="btn ghost" data-action="hint">Get a hint, costs 25% XP ${key('H')}</button>` : ''}
      <button class="btn ghost" data-action="later">Come back later ${key('E')}</button>`;
  }

  const sheet = $('ticket');
  const wasOpen = !sheet.hidden;
  sheet.innerHTML = `${head}<div class="tp-body">${body}</div><footer class="tp-actions">${actions}</footer>`;
  sheet.hidden = false;
  // Newest chat message in view; otherwise start at the top when the window first opens.
  if (detail.result && detail.chatOpen) sheet.scrollTop = sheet.scrollHeight;
  else if (!wasOpen) sheet.scrollTop = 0;
}

// ---------- hands-on tickets ----------

/** Only the newest thing the player found, in one highlighted line. */
function latestHtml(detail) {
  const last = detail.log[detail.log.length - 1];
  return last ? `<div class="finding" aria-live="polite"><span aria-hidden="true">🔎</span> ${esc(last)}</div>` : '';
}

function hintsAndRetry(detail) {
  const lastWrong = detail.wrong[detail.wrong.length - 1];
  const retry = lastWrong
    ? `<div class="notice warn"><b>That didn't fix it.</b> ${esc(lastWrong.why)} One more wrong idea and the ticket fails.</div>`
    : '';
  return retry + detail.hints.map((h) => `<div class="hint"><b>Hint:</b> ${esc(h)}</div>`).join('');
}

// The three steps of every hands-on ticket, with words for where the player has to go.
function missionHtml(person, detail) {
  const sim = detail.sim;
  const step = missionStep(sim);
  const where = sim.station === 'bench' ? `Check Desk ${person.desk}'s PC`
    : sim.station === 'printer' ? 'Go to the printer'
    : sim.station === 'survey' ? 'Measure Wi-Fi at 3 spots'
      : `Inspect Desk ${person.desk}`;
  const fix = sim.station === 'survey' ? 'Note the weak spot' : sim.station === 'bench' ? 'Repair it at the bench' : 'Fix what you find';
  const test = sim.station === 'survey' ? 'Report it' : `Ask ${person.name} to test`;
  const items = [['🔍', 'Find it', where], ['🔧', 'Fix it', fix], ['✅', 'Test it', test]];
  return `<ol class="mission">${items
    .map(([icon, title, sub], i) => {
      const state = i + 1 < step ? 'done' : i + 1 === step ? 'now' : 'todo';
      return `<li class="${state}"><span class="m-icon" aria-hidden="true">${state === 'done' ? '✓' : icon}</span><b>${title}</b><small>${esc(sub)}</small></li>`;
    })
    .join('')}</ol>`;
}

// Where to go next, when it is somewhere else in the office.
function nextPlaceHtml(person, detail) {
  const sim = detail.sim;
  if (sim.station === 'bench') {
    const need = placesNeeded(sim);
    if (need.includes('parts_cabinet')) return `<div class="next-place"><span aria-hidden="true">📍</span> Next: a matching RAM stick from the <b>parts cabinet</b>. Follow the blue marker.</div>`;
    if (need.includes('repair_bench')) return `<div class="next-place"><span aria-hidden="true">📍</span> Next: the <b>repair bench</b> in the IT room. Follow the blue marker.</div>`;
    if (sim.bench.where === 'carried') return `<div class="next-place"><span aria-hidden="true">📍</span> Next: take the PC back to <b>Desk ${person.desk}</b> and plug it in.</div>`;
    return '';
  }
  if (needsServerRoom(sim)) return `<div class="next-place"><span aria-hidden="true">📍</span> Next: the <b>server room</b>. Follow the blue marker.</div>`;
  if (placesNeeded(sim).includes('parts_cabinet')) return `<div class="next-place"><span aria-hidden="true">📍</span> Next: the <b>parts cabinet</b>. Follow the blue marker.</div>`;
  return '';
}

function otherIdeasHtml(detail) {
  const ruledOut = new Set(detail.wrong.map((w) => w.id));
  const decoys = detail.handsOn.decoys
    .map((o, i) => {
      const out = ruledOut.has(o.id);
      return `<button class="opt small-opt${out ? ' out' : ''}" data-decoy="${o.id}" ${detail.answering || out ? 'disabled' : ''}>
        <span class="num">${i + 1}</span><span>${esc(o.text)}</span></button>`;
    })
    .join('');
  return `<details class="other-ideas"${detail.wrong.length ? ' open' : ''}><summary>Other ideas (a wrong one costs XP)</summary><div class="opts">${decoys}</div></details>`;
}

function handsOnTalkHtml(person, detail) {
  return `
    <div class="bubble">${esc(detail.description)}</div>
    ${missionHtml(person, detail)}
    ${detail.sim.station === 'survey' ? surveyHtml(detail) : ''}
    ${nextPlaceHtml(person, detail)}
    ${latestHtml(detail)}
    ${hintsAndRetry(detail)}
    ${otherIdeasHtml(detail)}`;
}

function surveyHtml(detail) {
  const readings = detail.sim.survey.readings;
  return chipsHtml(Object.entries(SURVEY_SPOTS).map(([k, spot]) => ({
    label: spot.name,
    value: k in readings ? `${readings[k]} of 4 bars` : 'not measured',
    ok: k in readings ? readings[k] >= 3 : null,
  })));
}

const HOVER_HINT = 'Point at anything that glows, then click it.';

/** The close-up at the person's desk (PC desk or laptop desk). */
function deskHtml(person, detail) {
  const laptop = detail.sim.station === 'laptop';
  if (detail.sim.station === 'bench') {
    return `
    <div id="station-hint" class="station-hint">${HOVER_HINT}</div>
    ${pcDeskSvg(detail.sim)}
    ${chipsHtml(pcDeskSummary(detail.sim))}
    ${nextPlaceHtml(person, detail)}
    ${latestHtml(detail)}
    ${hintsAndRetry(detail)}`;
  }
  return `
    <div id="station-hint" class="station-hint">${HOVER_HINT}</div>
    ${laptop ? laptopSvg(detail.sim) : deskSvg(detail.sim)}
    ${laptop ? displayModeHtml(detail.sim) : ''}
    ${chipsHtml(laptop ? laptopSummary(detail.sim) : deskSummary(detail.sim))}
    ${nextPlaceHtml(person, detail)}
    ${latestHtml(detail)}
    ${hintsAndRetry(detail)}`;
}

/** The server room switch, opened by walking there and pressing E. */
export function renderSwitchPanel(person, ticket, detail) {
  const sim = detail.sim;
  const canReport = sim.port.movedTo !== null && sim.required.includes('report_port') && !sim.done.report_port;
  const sheet = $('ticket');
  const wasOpen = !sheet.hidden;
  sheet.innerHTML = `
    <header class="tp-head">
      <span class="avatar big" style="--c:#2a3038" aria-hidden="true">S</span>
      <div class="tp-who"><div class="tp-name">Server room switch</div><div class="small">For ${esc(person.name)}, Desk ${person.desk}, ticket ${ticket.number}</div></div>
      <div class="tp-meta">${priorityBadge(ticket.priority)}<span id="tp-timer" class="timer"></span></div>
    </header>
    <div class="tp-body">
      <div id="station-hint" class="station-hint">Desk ${person.desk} is port ${sim.port.number}. ${sim.port.movedTo === null ? 'A dark light means no connection: click a spare port to move the cable.' : `Moved to port ${sim.port.movedTo}.`}</div>
      ${switchSvg(sim)}
      ${latestHtml(detail)}
      ${sim.port.movedTo !== null && !canReport ? `<div class="next-place"><span aria-hidden="true">📍</span> Done here. Go back to <b>${esc(person.name)}</b> and ask them to test.</div>` : ''}
    </div>
    <footer class="tp-actions">
      ${canReport ? `<button class="btn" data-action="report">Log the faulty port ${key('L')}</button>` : ''}
      <button class="btn ghost" data-action="close-station">Close ${key('E')}</button>
    </footer>`;
  sheet.hidden = false;
  if (!wasOpen) sheet.scrollTop = 0;
}

/** The shared printer, opened by walking to it and pressing E. */
export function renderPrinterPanel(person, ticket, detail) {
  const sim = detail.sim;
  const sheet = $('ticket');
  const wasOpen = !sheet.hidden;
  const done = placesNeeded(sim).length === 0
    ? `<div class="next-place"><span aria-hidden="true">📍</span> The printer looks fixed. Go back to <b>${esc(person.name)}</b> and ask them to print again.</div>`
    : '';
  sheet.innerHTML = `
    <header class="tp-head">
      <span class="avatar big" style="--c:#5b6b7c" aria-hidden="true">P</span>
      <div class="tp-who"><div class="tp-name">Shared printer</div><div class="small">For ${esc(person.name)}, Desk ${person.desk}, ticket ${ticket.number}</div></div>
      <div class="tp-meta">${priorityBadge(ticket.priority)}<span id="tp-timer" class="timer"></span></div>
    </header>
    <div class="tp-body">
      <div id="station-hint" class="station-hint">${HOVER_HINT} Start with the screen and a test page.</div>
      ${printerSvg(sim)}
      ${chipsHtml(printerSummary(sim))}
      ${nextPlaceHtml(person, detail)}${done}${latestHtml(detail)}
    </div>
    <footer class="tp-actions"><button class="btn ghost" data-action="close-station">Close ${key('E')}</button></footer>`;
  sheet.hidden = false;
  if (!wasOpen) sheet.scrollTop = 0;
}

/** The repair bench in the IT room, opened by walking there and pressing E. */
export function renderBenchPanel(person, ticket, detail) {
  const sim = detail.sim;
  const sheet = $('ticket');
  const wasOpen = !sheet.hidden;
  const fixed = benchReadings(sim).memoryOk;
  const done = fixed && !sim.bench.open && sim.bench.where === 'bench'
    ? '<div class="next-place"><span aria-hidden="true">📍</span> The memory is fixed. Pick up the PC and take it back to the desk.</div>'
    : '';
  sheet.innerHTML = `
    <header class="tp-head">
      <span class="avatar big" style="--c:#2f8f5b" aria-hidden="true">R</span>
      <div class="tp-who"><div class="tp-name">Repair bench</div><div class="small">For ${esc(person.name)}, Desk ${person.desk}, ticket ${ticket.number}</div></div>
      <div class="tp-meta">${priorityBadge(ticket.priority)}<span id="tp-timer" class="timer"></span></div>
    </header>
    <div class="tp-body">
      <div id="station-hint" class="station-hint">${HOVER_HINT} Work safely: strap on, power drained, then open the case.</div>
      ${benchSvg(sim)}
      ${chipsHtml(benchSummary(sim))}
      ${placesNeeded(sim).includes('parts_cabinet') ? nextPlaceHtml(person, detail) : ''}${done}${latestHtml(detail)}
    </div>
    <footer class="tp-actions"><button class="btn ghost" data-action="close-station">Close ${key('E')}</button></footer>`;
  sheet.hidden = false;
  if (!wasOpen) sheet.scrollTop = 0;
}

/** The parts cabinet: pick what you need. log: recent messages. */
export function renderCabinetPanel(carrying, log) {
  const sheet = $('ticket');
  const wasOpen = !sheet.hidden;
  sheet.innerHTML = `
    <header class="tp-head">
      <span class="avatar big" style="--c:#4a525c" aria-hidden="true">C</span>
      <div class="tp-who"><div class="tp-name">Parts cabinet</div><div class="small">${carrying ? `You are carrying: ${esc(CARRY_NAMES[carrying] ?? carrying)}` : 'Your hands are empty'}</div></div>
    </header>
    <div class="tp-body">
      <div id="station-hint" class="station-hint">Click the item you need. You carry one thing at a time.</div>
      ${cabinetSvg(carrying)}
      ${log.length ? `<div class="finding"><span aria-hidden="true">📦</span> ${esc(log[log.length - 1])}</div>` : ''}
    </div>
    <footer class="tp-actions">
      ${carrying ? `<button class="btn ghost" data-action="put-back">Put it back</button>` : ''}
      <button class="btn" data-action="close-station">Close ${key('E')}</button>
    </footer>`;
  sheet.hidden = false;
  if (!wasOpen) sheet.scrollTop = 0;
}

/** The small "Carrying" chip on screen. */
export function setCarrying(item) {
  $('carry').hidden = !item;
  $('carry').innerHTML = item ? `Carrying: <b>${esc(CARRY_NAMES[item] ?? item)}</b>` : '';
}

function questionHtml(person, detail) {
  const p = detail.problem;
  const ruledOut = new Set(detail.wrong.map((w) => w.id));
  const lastWrong = detail.wrong[detail.wrong.length - 1];
  const options = p.options
    .map((o, i) => {
      const out = ruledOut.has(o.id);
      return `<button class="opt${out ? ' out' : ''}" data-index="${i}" ${detail.answering || out ? 'disabled' : ''}>
        <span class="num">${i + 1}</span><span>${esc(o.text)}</span></button>`;
    })
    .join('');
  const retry = lastWrong
    ? `<div class="notice warn"><b>Not quite.</b> ${esc(lastWrong.why)}<br>Try once more. A right answer now still earns half the XP.</div>`
    : '';
  const hints = detail.hints.map((h) => `<div class="hint"><b>Hint:</b> ${esc(h)}</div>`).join('');
  return `
    <div class="bubble">${esc(detail.description)}</div>
    ${retry}${hints}
    <h3 class="ask">${lastWrong ? 'Which fix would you try instead?' : 'What would you do first?'}</h3>
    <div class="opts">${options}</div>
    ${detail.answerError ? '<p class="notice bad">Your answer did not reach the server. Pick it again.</p>' : ''}`;
}

function resultHtml(detail) {
  const r = detail.result;
  const byId = (id) => r.explanations.find((e) => e.option_id === id);
  const chosen = byId(r.chosen_option_id);
  const correct = r.explanations.find((e) => e.correct);
  const bonus = [r.mult > 1 ? `streak bonus ×${r.mult}` : '', r.extra || ''].filter(Boolean).join(', ');
  const bonusText = bonus ? ` (${bonus})` : '';

  let banner;
  const pending = jobStage(detail.job) !== 'finished';
  const review = detail.escalation?.review;
  const second = r.attempt === 1 ? '' : ' (second try)';
  if (review?.perfect) banner = `<div class="banner good"><span class="icon">✓</span><div><b>Escalated to the right team, with the right details!</b>${second} +${r.xp} XP${bonusText}</div></div>`;
  else if (review) banner = `<div class="banner warn"><span class="icon">!</span><div><b>Right fix, but the escalation needed work.</b> Half XP: +${r.xp} XP. See below what to change next time.</div></div>`;
  else if (pending) banner = `<div class="banner blue"><span class="icon">✓</span><div><b>Right fix!</b> Now do it in person to close the ticket. The timer is still running.</div></div>`;
  else if (detail.job && r.attempt === 1) banner = `<div class="banner good"><span class="icon">✓</span><div><b>Fixed in person!</b> +${r.xp} XP${bonusText}</div></div>`;
  else if (detail.job) banner = `<div class="banner good"><span class="icon">✓</span><div><b>Fixed in person on your second try.</b> +${r.xp} XP</div></div>`;
  else if (r.is_correct && r.attempt === 1) banner = `<div class="banner good"><span class="icon">✓</span><div><b>Solved!</b> +${r.xp} XP${bonusText}</div></div>`;
  else if (r.is_correct) banner = `<div class="banner good"><span class="icon">✓</span><div><b>Solved on your second try.</b> +${r.xp} XP${bonusText}</div></div>`;
  else banner = `<div class="banner bad"><span class="icon">✕</span><div><b>Not solved this time.</b> Here is what a senior tech would do.</div></div>`;

  const card = (cls, title, text) => `<div class="expl ${cls}"><div class="expl-t">${title}</div><p>${esc(text)}</p></div>`;
  const parts = [banner];
  if (review) parts.push(escalationReviewHtml(review));
  detail.wrong.forEach((w) => {
    const e = byId(w.id);
    parts.push(card('bad', `Why "${esc(e.text)}" didn't work`, e.why));
  });
  if (!r.is_correct) parts.push(card('bad', `Why "${esc(chosen.text)}" didn't work`, chosen.why));
  parts.push(card('good', `The right fix: ${esc(correct.text)}`, correct.why));
  if (r.real_world_tip) parts.push(`<div class="tip"><b>From real help desks:</b> ${esc(r.real_world_tip)}</div>`);
  return parts.join('');
}

// ---------- escalation ----------

function escalationFormHtml(detail) {
  const e = detail.escalation;
  const teams = e.form.teams
    .map((t) => `<button class="team${e.team === t.id ? ' on' : ''}" data-team="${esc(t.id)}" aria-pressed="${e.team === t.id}">
      <span class="team-icon" aria-hidden="true">${TEAM_ICONS[t.id] ?? '👥'}</span>${esc(t.name)}</button>`)
    .join('');
  const items = e.form.details
    .map((d) => {
      const on = e.picked.includes(d.id);
      return `<button class="send-item${on ? ' on' : ''}" data-detail="${d.id}" role="checkbox" aria-checked="${on}">
        <span class="box" aria-hidden="true">${on ? '✓' : ''}</span><span>${esc(d.text)}</span></button>`;
    })
    .join('');
  return `<div class="banner blue"><span class="icon">✓</span><div><b>Right call!</b> This one needs a specialist team. Escalate it to close the ticket. The timer is still running.</div></div>
    <div class="esc-step"><div class="esc-t"><span class="esc-n">1</span> Which team should take it?</div><div class="teams">${teams}</div></div>
    <div class="esc-step"><div class="esc-t"><span class="esc-n">2</span> What should the ticket include? <small>Tick everything useful. Leave out anything that doesn't belong.</small></div><div class="send-list">${items}</div></div>
    ${e.error ? '<p class="notice bad">Could not reach the server. Try sending again.</p>' : ''}`;
}

function escalationReviewHtml(review) {
  const rows = review.details
    .filter((d) => d.send || d.chosen)
    .map((d) => {
      const state = d.send && d.chosen ? 'good' : d.send ? 'missed' : 'bad';
      const label = state === 'good' ? '✓ Sent' : state === 'missed' ? 'Missed' : '✕ Should not be sent';
      return `<li class="${state}"><span class="tag">${label}</span><b>${esc(d.text)}</b><small>${esc(d.why)}</small></li>`;
    })
    .join('');
  const team = review.team_correct
    ? `<p><b>✓ ${esc(review.correct_team.name)}</b> was the right team. ${esc(review.team_why)}</p>`
    : `<p><b>✕ It should go to the ${esc(review.correct_team.name)}.</b> ${esc(review.team_why)}</p>`;
  return `<div class="expl esc-review"><div class="expl-t">Your escalation</div>${team}<ul class="esc-rows">${rows}</ul></div>`;
}

// The places to visit for a physical fix, ticked off as they are done.
function jobHtml(person, detail) {
  const job = detail.job;
  if (!job) return '';
  const stage = jobStage(job);
  const items = job.steps.map((step, i) => {
    const state = i < job.index ? 'done' : i === job.index && stage === 'place' ? 'now' : 'todo';
    return `<li class="${state}"><b>${esc(PLACES[step.place].name)}:</b> ${esc(step.action)}</li>`;
  });
  const back = stage === 'finished' ? 'done' : stage === 'return' ? 'now' : 'todo';
  items.push(back === 'done'
    ? `<li class="done"><b>Back to ${esc(person.name)}:</b> told them it is fixed</li>`
    : `<li class="${back}"><b>Back to ${esc(person.name)}:</b> press ${key('E')} to finish</li>`);
  return `<section class="job"><h3>${stage === 'finished' ? 'What you did' : 'Do the fix'}</h3><ol class="job-steps">${items.join('')}</ol>
    ${stage === 'place' ? '<p class="small">Follow the blue marker. It is on your map too.</p>' : ''}</section>`;
}

function seniorHtml(detail) {
  if (!detail.chatOpen && detail.chat.length === 0) return '';
  const asked = detail.chat.filter((t) => t.role === 'junior').length;
  const left = MAX_QUESTIONS - asked;
  const turns = detail.chat
    .map((t) => {
      if (t.role === 'junior') return `<div class="turn me">${esc(t.text)}</div>`;
      const note = t.source === 'fallback' ? '<span class="src">The senior tech is busy, so this comes from the ticket notes.</span>' : '';
      return `<div class="turn senior">${esc(t.source === 'fallback' ? t.text.replace(/^The senior tech is busy right now, but here's what the ticket notes say: /, '') : t.text)}${note}</div>`;
    })
    .join('');
  const thinking = detail.asking ? '<div class="turn senior muted">Typing<span class="dots"></span></div>' : '';
  const form =
    left > 0
      ? `<form id="ask-form" autocomplete="off">
           <input id="ask-input" maxlength="300" aria-label="Your question for the senior tech"
             placeholder="${asked ? 'Ask a follow-up question' : 'For example: why is that the first thing to check?'}" ${detail.asking ? 'disabled' : ''}>
           <button type="submit" class="btn" ${detail.asking ? 'disabled' : ''}>Send</button>
         </form>
         <div class="small">${left} question${left === 1 ? '' : 's'} left for this ticket. Press Esc to stop typing.</div>`
      : '<div class="small">The senior tech has answered 3 questions on this ticket.</div>';
  return `<section class="senior"><h3>Senior tech</h3>${turns}${thinking}${form}</section>`;
}

export function updateTicketTimer(ticket, closed = false) {
  const el = $('tp-timer');
  if (!el) return;
  el.textContent = closed ? 'Closed' : ticket.secondsLeft <= 0 ? 'Overdue' : formatTime(ticket.secondsLeft);
  el.classList.toggle('late', !closed && ticket.secondsLeft <= 0);
}

export function hideTicketPanel() {
  $('ticket').hidden = true;
  $('ticket').innerHTML = '';
}

// ---------- messages and XP pop-ups ----------

export function toast(html, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = html;
  $('toasts').appendChild(el);
  while ($('toasts').children.length > 3) $('toasts').firstElementChild.remove(); // keep the screen calm
  setTimeout(() => el.classList.add('out'), 3800);
  setTimeout(() => el.remove(), 4300);
}

export function xpPop(amount) {
  const el = document.createElement('div');
  el.className = 'xppop';
  el.textContent = `+${amount} XP`;
  $('status').appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

// ---------- end-of-shift report ----------

const STATUS_WORDS = { mastered: 'Mastered', good: 'Good', practise: 'Practise this', learning: 'Learning', new: 'Not tried yet' };

function badgeChips(badges) {
  return `<div class="badge-chips">${badges.map((b) => `<span class="badge-chip"><span aria-hidden="true">${b.icon}</span>${esc(b.name)}</span>`).join('')}</div>`;
}

export function showReport(summary, { shiftNumber, rankBefore, rankAfter, badges = [], events = [] }) {
  const s = summary;
  const time = s.avgSeconds === null ? '-' : formatTime(s.avgSeconds);
  const promoted = rankAfter.index > rankBefore.index
    ? `<p class="callout good"><b>You were promoted to ${esc(rankAfter.name)} during this shift.</b></p>`
    : '';
  const topics = Object.entries(s.byCategory)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, c]) => `<div class="topic"><span class="name">${esc(name)}</span><span class="small">${c.firstTry} of ${c.total} right first time</span>
       <div class="bar"><div style="width:${(c.firstTry / c.total) * 100}%"></div></div></div>`)
    .join('');
  const advice = [
    s.strongest ? `<p class="callout good"><b>Strongest today:</b> ${esc(s.strongest)}.</p>` : '',
    s.practise ? `<p class="callout warn"><b>Worth practising:</b> ${esc(s.practise)}. Ask the senior tech about these tickets next time.</p>` : '',
    s.overdue > 0 ? `<p class="callout blue">${s.overdue} ticket${s.overdue === 1 ? ' was' : 's were'} answered after the deadline. Check the list on the right often and start with urgent requests.</p>` : '',
  ].join('');

  const body = s.handled === 0
    ? `<p class="callout blue">You didn't close any tickets this shift. Walk to the people on the list and press E to help them.</p>`
    : `<div class="stat-row">
         <div class="stat"><b>${s.solved}</b><span>tickets solved</span></div>
         <div class="stat"><b>${s.firstTryRate}%</b><span>right first time</span></div>
         <div class="stat"><b>+${s.xp}</b><span>XP earned</span></div>
         <div class="stat"><b>${time}</b><span>average time per ticket</span></div>
       </div>
       <ul class="facts">
         <li>Right first time <b>${s.firstTry}</b></li>
         <li>Fixed on second try <b>${s.secondTry}</b></li>
         <li>Not solved <b>${s.failed}</b></li>
         <li>Answered late <b>${s.overdue}</b></li>
         <li>Still open at 5 PM <b>${s.leftOpen}</b></li>
       </ul>
       ${promoted}${advice}
       ${badges.length ? `<h2 class="section-title">Badges earned this shift</h2>${badgeChips(badges)}` : ''}
       <h2 class="section-title">Topics this shift</h2>
       <div class="topics">${topics}</div>`;

  const eventList = events.length
    ? `<h2 class="section-title">Events this shift</h2><ul class="facts">${events.map((e) => `<li><span><span aria-hidden="true">${EVENTS[e.id].icon}</span> ${esc(EVENTS[e.id].name)}</span><b>${e.solved} solved</b></li>`).join('')}</ul>`
    : '';
  $('report-card').innerHTML = `
    <h1 id="report-title">Shift ${shiftNumber} is over</h1>
    <p class="lead">It's 5 PM. Here is how your day at the help desk went.</p>
    <section id="coach" class="coach loading" aria-live="polite"><span class="coach-face" aria-hidden="true">🧑‍🔧</span><div><b>Senior tech</b><p>Writing you a note about today<span class="dots"></span></p></div></section>
    ${body}
    ${eventList}
    <div class="report-actions">
      <button class="btn ghost" data-action="open-progress">My progress</button>
      ${s.handled > 0 ? '<button class="btn ghost" data-action="share-result">Share my result</button>' : ''}
      <button class="btn big" data-action="next-shift">Start shift ${shiftNumber + 1}</button>
    </div>`;
  $('report').hidden = false;
  $('report-card').scrollTop = 0;
  setTimeout(() => $('report-card').querySelector('[data-action="next-shift"]')?.focus({ preventScroll: true }), 0);
}

export function hideReport() {
  $('report').hidden = true;
}

// ---------- my progress ----------

function badgeGrid(achievements = {}) {
  const earned = ACHIEVEMENTS.filter((a) => achievements[a.id]).length;
  const cells = ACHIEVEMENTS.map((a) => {
    const has = Boolean(achievements[a.id]);
    return `<div class="badge ${has ? 'earned' : 'locked'}" title="${esc(a.description)}">
        <span class="badge-icon" aria-hidden="true">${a.icon}</span>
        <span class="badge-name">${esc(a.name)}</span>
        <span class="badge-desc">${has ? 'Earned' : esc(a.description)}</span>
      </div>`;
  }).join('');
  return `<h2 class="section-title">Badges <span class="small">${earned} of ${ACHIEVEMENTS.length}</span></h2><div class="badges">${cells}</div>`;
}

function certificateSection(progress, savedName) {
  const top = RANKS[RANKS.length - 1];
  if (progress.xp < top.min) {
    return `<section class="cert locked">
        <h2 class="section-title">Completion certificate</h2>
        <p class="small">Reach the ${esc(top.name)} rank (${top.min} XP) to unlock a certificate you can download. You need ${top.min - progress.xp} more XP.</p>
        <div class="bar"><div style="width:${(progress.xp / top.min) * 100}%"></div></div>
      </section>`;
  }
  return `<section class="cert">
      <h2 class="section-title">Completion certificate</h2>
      <p class="small">You reached ${esc(top.name)}. Type your name as you want it on the certificate.</p>
      <form id="cert-form" autocomplete="off">
        <input id="cert-name" maxlength="${NAME_MAX}" aria-label="Your name for the certificate" placeholder="Your full name" value="${esc(savedName)}">
        <button type="submit" class="btn">Create certificate</button>
      </form>
      <p id="cert-error" class="small bad-text" hidden>Please type a name with at least 2 letters.</p>
      <p class="small">Your name stays on this computer. It is never sent anywhere. The certificate says: "${esc(DISCLAIMER)}"</p>
    </section>`;
}

export function showProgress(progress, categories, { certName = '' } = {}) {
  const rank = rankFor(progress.xp);
  const rate = progress.attempts ? Math.round((progress.firstTry / progress.attempts) * 100) : null;
  const order = { practise: 0, learning: 1, good: 2, mastered: 3, new: 4 };
  const all = categories
    .map((name) => ({ name, t: progress.topics[name] ?? { attempts: 0, firstTry: 0 }, status: topicStatus(progress.topics[name]) }))
    .sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
  const untried = all.filter((r) => r.status === 'new').map((r) => esc(r.name));
  const rows = all
    .filter((r) => r.status !== 'new')
    .map(({ name, t, status }) => `<div class="topic">
        <span class="name">${esc(name)}</span><span class="status ${status}">${STATUS_WORDS[status]}</span>
        <div class="bar"><div style="width:${t.attempts ? (t.firstTry / t.attempts) * 100 : 0}%"></div></div>
        <span class="small">${t.attempts ? `${t.firstTry} of ${t.attempts} right first time` : 'No tickets on this topic yet'}</span>
      </div>`)
    .join('');
  $('progress-card').innerHTML = `
    <h1 id="progress-title">My progress</h1>
    <p class="lead">Your record across all shifts on this computer.</p>
    <div class="stat-row">
      <div class="stat"><b>${esc(rank.name)}</b><span>${progress.xp} XP</span></div>
      <div class="stat"><b>${progress.solved}</b><span>tickets solved</span></div>
      <div class="stat"><b>${rate === null ? '-' : `${rate}%`}</b><span>right first time</span></div>
      <div class="stat"><b>${progress.shifts}</b><span>shifts finished</span></div>
    </div>
    <p class="small">Best streak: ${progress.bestStreak} right in a row. Topics marked "Practise this" are the best place to improve.</p>
    <h2 class="section-title">Topics</h2>
    ${rows ? `<div class="topics">${rows}</div>` : '<p class="small">Solve a few tickets and your topics will appear here.</p>'}
    ${untried.length ? `<p class="small">Not tried yet: ${untried.join(', ')}.</p>` : ''}
    ${badgeGrid(progress.achievements)}
    ${certificateSection(progress, certName)}
    <div class="report-actions">
      <button class="link-btn" data-action="reset-progress">Reset all progress</button>
      <button class="btn big" data-action="close-progress">Back to work</button>
    </div>`;
  $('progress').hidden = false;
  $('progress-card').scrollTop = 0;
  setTimeout(() => $('progress-card').querySelector('[data-action="close-progress"]')?.focus({ preventScroll: true }), 0);
}

export function hideProgress() {
  $('progress').hidden = true;
}

// ---------- share window: preview of a downloadable image ----------

/** opts: { title, lead, imageUrl, fileName, text } (text is the suggested post, optional) */
export function showShare({ title, lead, imageUrl, fileName, text = '' }) {
  $('share-card').innerHTML = `
    <h1 id="share-title">${esc(title)}</h1>
    <p class="lead">${esc(lead)}</p>
    <img class="share-img" src="${imageUrl}" alt="${esc(title)}">
    ${text ? `<h2 class="section-title">Suggested post text</h2>
      <textarea id="share-text" class="share-text" rows="9" readonly aria-label="Suggested post text">${esc(text)}</textarea>` : ''}
    <div class="report-actions">
      <button class="link-btn" data-action="close-share">Close</button>
      ${text ? '<button class="btn ghost" data-action="copy-text">Copy text</button>' : ''}
      <a class="btn big" href="${imageUrl}" download="${esc(fileName)}">Download image</a>
    </div>`;
  $('share').hidden = false;
  $('share-card').scrollTop = 0;
}

export function hideShare() {
  $('share').hidden = true;
  $('share-card').innerHTML = '';
}

// ---------- daily challenge ----------

function dailyShow(html) {
  $('daily-card').innerHTML = html;
  $('daily').hidden = false;
  $('daily-card').scrollTop = 0;
  setTimeout(() => $('daily-card').querySelector('.btn.big')?.focus({ preventScroll: true }), 0);
}

export function hideDaily() {
  $('daily').hidden = true;
}

export function showDailyIntro({ dateLabel, streak }) {
  dailyShow(`
    <h1 id="daily-title">📅 Daily challenge</h1>
    <p class="lead">${esc(dateLabel)}. Everyone gets the same 5 tickets today.</p>
    <ul class="daily-rules">
      <li><b>5 tickets</b>, one try each</li>
      <li><b>The clock</b> runs while you choose</li>
      <li><b>One go per day</b>, so take your time to read</li>
    </ul>
    ${streak > 0 ? `<p class="callout good">🔥 ${streak} day${streak === 1 ? '' : 's'} in a row. Play today to keep it going.</p>` : ''}
    <div class="report-actions">
      <button class="link-btn" data-action="daily-close">Not now</button>
      <button class="btn big" data-action="daily-start">Start</button>
    </div>`);
}

export function showDailyLoading(message = 'Getting today\'s tickets') {
  dailyShow(`<h1 id="daily-title">📅 Daily challenge</h1><p class="lead">${esc(message)}<span class="dots"></span></p>
    <div class="report-actions"><button class="btn ghost" data-action="daily-close">Close</button></div>`);
}

/** state: { problems, index, marks, feedback: null | { correct, chosenWhy, rightText, rightWhy } } */
export function showDailyQuestion(state) {
  const p = state.problems[state.index];
  const dots = state.problems.map((_, i) => {
    const cls = i < state.marks.length ? (state.marks[i] ? 'ok' : 'bad') : i === state.index ? 'now' : '';
    return `<span class="dd ${cls}"></span>`;
  }).join('');
  const f = state.feedback;
  const options = p.options.map((o, i) => `<button class="opt" data-daily-option="${o.id}" ${f || state.answering ? 'disabled' : ''}>
      <span class="num">${i + 1}</span><span>${esc(o.text)}</span></button>`).join('');
  const feedback = f
    ? `<div class="banner ${f.correct ? 'good' : 'bad'}"><span class="icon">${f.correct ? '✓' : '✕'}</span><div><b>${f.correct ? 'Right!' : 'Not this time.'}</b></div></div>
       ${f.correct ? '' : `<div class="expl bad"><div class="expl-t">Why not</div><p>${esc(f.chosenWhy)}</p></div>`}
       <div class="expl good"><div class="expl-t">The right fix: ${esc(f.rightText)}</div><p>${esc(f.rightWhy)}</p></div>`
    : '';
  const last = state.index === state.problems.length - 1;
  dailyShow(`
    <div class="daily-top"><span class="small">Ticket ${state.index + 1} of ${state.problems.length}</span><span class="daily-dots">${dots}</span></div>
    <div class="tp-head daily-head">
      <span class="avatar big" style="--c:#5b6b7c" aria-hidden="true">${esc(p.character.name[0])}</span>
      <div class="tp-who"><div class="tp-name">${esc(p.character.name)}</div><div class="small">${esc(p.character.department)}, ${esc(p.category)}</div></div>
    </div>
    <div class="bubble">${esc(p.user_description)}</div>
    ${f ? feedback : `<h3 class="ask">What would you do first?</h3><div class="opts">${options}</div>`}
    ${state.error ? '<p class="notice bad">That answer did not reach the server. Pick it again.</p>' : ''}
    <div class="report-actions">
      ${f ? `<button class="btn big" data-action="daily-next">${last ? 'See my score' : 'Next ticket'}</button>` : ''}
    </div>`);
}

export function showDailyDone({ dateLabel, result, streak, best, wait }) {
  const squares = result.marks.map((ok) => `<span class="dsq ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✕'}</span>`).join('');
  const m = Math.floor(result.seconds / 60);
  const s = String(Math.round(result.seconds) % 60).padStart(2, '0');
  dailyShow(`
    <h1 id="daily-title">📅 ${esc(dateLabel)}</h1>
    <div class="daily-score"><div class="daily-squares">${squares}</div>
      <div><b>${result.correct}/${result.total}</b> right in <b>${m}:${s}</b></div></div>
    <div class="stat-row three">
      <div class="stat"><b>🔥 ${streak}</b><span>day${streak === 1 ? '' : 's'} in a row</span></div>
      <div class="stat"><b>${best}</b><span>best streak</span></div>
      <div class="stat"><b>${wait}</b><span>until the next challenge</span></div>
    </div>
    <div class="report-actions">
      <button class="btn ghost" data-action="daily-close">Back to work</button>
      <button class="btn big" data-action="daily-share">Share my score</button>
    </div>`);
}

/** Fill in the senior tech's note on the shift report (null hides it if the server could not be reached). */
export function setCoach(note) {
  const el = $('coach');
  if (!el) return;
  if (!note) {
    el.remove();
    return;
  }
  el.classList.remove('loading');
  const tips = note.tips.length
    ? `<ul class="coach-tips">${note.tips.map((t) => `<li><b>${esc(t.problem_title)}:</b> ${esc(t.tip)}</li>`).join('')}</ul>`
    : '';
  const by = note.source === 'fallback' ? 'Written from your shift numbers.' : 'Worded by AI from your shift numbers and the ticket notes.';
  el.innerHTML = `<span class="coach-face" aria-hidden="true">🧑‍🔧</span>
    <div><b>Senior tech</b><p>${esc(note.message)}</p>${tips}<span class="small">${by}</span></div>`;
}

/** The banner for events that are running now: [{ id, left }]. */
export function setEvents(running) {
  const el = $('event-banner');
  const html = running
    .map(({ id, left }) => `<span class="ev"><span aria-hidden="true">${EVENTS[id].icon}</span> <b>${esc(EVENTS[id].name)}</b> ${countdown(left)}</span>`)
    .join('');
  if (el.innerHTML !== html) el.innerHTML = html;
  el.hidden = running.length === 0;
}

export function setClock(label, late) {
  $('clock').textContent = label;
  $('clock').classList.toggle('late', late);
}

// ---------- learning corner ----------

/**
 * topics: from libraryTopics(); selected: category name; notes: Map id -> notes or 'loading' / 'error'.
 * tab: 'notes' or 'links'.
 */
export function renderLibrary(topics, selected, notes, tab = 'notes') {
  const done = topics.reduce((n, t) => n + t.unlocked.length, 0);
  const total = topics.reduce((n, t) => n + t.total, 0);
  let body;
  if (tab === 'links') {
    body = RESOURCES_REVIEWED
      ? `<h3>Free courses</h3><div class="res-list">${COURSES.map((c) => `<a href="${esc(c.url)}" target="_blank" rel="noopener"><b>${esc(c.name)}</b><small>${esc(c.note)}</small></a>`).join('')}</div>
         <h3>A simple path into IT support</h3><ol class="res-path">${PATH.map((step) => `<li>${esc(step)}</li>`).join('')}</ol>
         <h3>Roadmaps</h3><div class="res-list">${ROADMAPS.map((c) => `<a href="${esc(c.url)}" target="_blank" rel="noopener"><b>${esc(c.name)}</b><small>${esc(c.note)}</small></a>`).join('')}</div>
         <p class="small">Links open in a new tab. Check each site for current details before you sign up.</p>`
      : '<p class="lib-empty">Free course and roadmap links are being checked. They will appear here soon.</p>';
  } else {
    const topic = topics.find((t) => t.category === selected) ?? topics[0];
    const list = !topic
      ? '<p class="lib-empty">No topics yet.</p>'
      : topic.unlocked.length === 0
        ? `<p class="lib-empty">No notes for ${esc(topic.category)} yet. Solve a ticket on this topic (right or wrong) and its notes unlock here.</p>`
        : topic.unlocked.map((p) => {
          const n = notes.get(p.id);
          const inner = !n || n === 'loading'
            ? '<p class="small">Loading<span class="dots"></span></p>'
            : n === 'error'
              ? '<p class="small">Could not load these notes. Check the backend is running.</p>'
              : `<div><b>The problem:</b> ${esc(n.symptom)}</div>
                 <div><b>The right fix:</b> ${esc(n.right_fix)}</div>
                 <div><b>Why:</b> ${esc(n.why)}</div>
                 ${n.tip ? `<div class="tip"><b>From real help desks:</b> ${esc(n.tip)}</div>` : ''}`;
          return `<details class="lib-item" data-note="${esc(p.id)}"><summary>${esc(p.title)} <small>Level ${p.level}</small></summary><div class="lib-body">${inner}</div></details>`;
        }).join('');
    body = `<div class="lib">
      <div class="lib-topics">${topics.map((t) => `<button data-topic="${esc(t.category)}" class="${topic && t.category === topic.category ? 'on' : ''}">${esc(t.category)} <small>${t.unlocked.length}/${t.total}</small></button>`).join('')}</div>
      <div class="lib-list">${list}</div></div>`;
  }
  $('library-card').innerHTML = `
    <h1 id="library-title">📚 Learning corner</h1>
    <p class="lead">Notes on every ticket you have worked on, written by the senior team. ${done} of ${total} unlocked.</p>
    <div class="lib-tabs"><button data-libtab="notes" class="${tab === 'notes' ? 'on' : ''}">My notes</button><button data-libtab="links" class="${tab === 'links' ? 'on' : ''}">Free courses and roadmap</button></div>
    ${body}
    <div class="menu-list" style="margin-top:16px"><button class="btn ghost" data-action="close-library">Close ${key('Esc')}</button></div>`;
  $('library').hidden = false;
}

export function hideLibrary() {
  $('library').hidden = true;
}

// ---------- notice board ----------

/** data: { name, rankName, xp, solved, bestStreak, dailyStreak, shifts, badges: [{ icon, name }] } */
export function renderBoard(data) {
  const pins = [
    [data.rankName, `Rank, ${data.xp} XP`],
    [data.solved, 'Tickets solved'],
    [data.bestStreak, 'Best streak (right first time)'],
    [data.dailyStreak, 'Daily challenge streak'],
    [data.shifts, 'Shifts worked'],
    [data.badges.length, 'Badges earned'],
  ];
  $('board-card').innerHTML = `
    <h1 id="board-title">📌 IT team notice board</h1>
    <p class="lead">${data.name ? `${esc(data.name)}'s` : 'Your'} wall of fame.</p>
    <div class="board-pins">${pins.map(([v, l]) => `<div class="board-pin"><b>${esc(String(v))}</b><small>${esc(l)}</small></div>`).join('')}</div>
    ${data.badges.length ? `<h3>Badges</h3><div class="board-badges">${data.badges.map((b) => `<span class="badge-chip"><span aria-hidden="true">${b.icon}</span> ${esc(b.name)}</span>`).join('')}</div>` : '<p class="lib-empty">No badges pinned yet. Solve tickets to earn your first one.</p>'}
    <div class="menu-list"><button class="btn ghost" data-action="close-board">Close ${key('Esc')}</button></div>`;
  $('board').hidden = false;
}

export function hideBoard() {
  $('board').hidden = true;
}

let lastBoost = -1;
export function setBoost(seconds) {
  if (seconds === lastBoost) return; // called every frame: only touch the page when it changes
  lastBoost = seconds;
  $('boost').hidden = seconds <= 0;
  if (seconds > 0) $('boost').innerHTML = `☕ Coffee boost: <b>${seconds}s</b>`;
}

// ---------- lounge arcade ----------

const ARCADE_GAMES = [
  { id: 'rush', icon: '🎫', name: 'Ticket rush', about: 'Click the tickets before they disappear. 30 seconds.', best: (b) => (b.rush ? `Best: ${b.rush} tickets` : 'No score yet') },
  { id: 'match', icon: '🧩', name: 'Kit match', about: 'Find the pairs of office kit in as few moves as you can.', best: (b) => (b.match ? `Best: ${b.match} moves` : 'No score yet') },
  { id: 'typer', icon: '⌨️', name: 'Quick typer', about: 'Type a help desk line as fast and accurately as you can.', best: (b) => (b.typer ? `Best: ${b.typer} words per minute` : 'No score yet') },
];

/** view: 'select' | 'rush' | 'match' | 'typer' | 'result'. data depends on the view. */
export function renderArcade(view, data, best) {
  let body;
  if (view === 'rush') {
    const s = data;
    body = `<div class="arc-bar"><span>⏱ ${Math.ceil(s.timeLeft)}s</span><span>🎫 ${s.score}</span><span>❌ ${s.missed}</span></div>
      <div class="rush-grid">${s.cells.map((c, i) => `<button class="rush-cell${c ? ' on' : ''}" data-rush="${i}" aria-label="${c ? 'Ticket' : 'Empty'}">${c ? '🎫' : ''}</button>`).join('')}</div>`;
  } else if (view === 'match') {
    const s = data;
    body = `<div class="arc-bar"><span>Moves: ${s.moves}</span><span>Pairs: ${s.deck.filter((c) => c.matched).length / 2} of ${s.deck.length / 2}</span></div>
      <div class="match-grid">${s.deck.map((c, i) => {
        const shown = c.matched || s.open.includes(i);
        return `<button class="match-card${shown ? ' shown' : ''}${c.matched ? ' done' : ''}" data-card="${i}" aria-label="${shown ? 'Card' : 'Hidden card'}">${shown ? c.face : '?'}</button>`;
      }).join('')}</div>`;
  } else if (view === 'typer') {
    const { line, typed, score } = data;
    const chars = [...line].map((ch, i) => {
      const cls = i < typed.length ? (typed[i] === ch ? 'ok' : 'bad') : i === typed.length ? 'now' : '';
      return `<span class="${cls}">${esc(ch)}</span>`;
    }).join('');
    body = `<div class="arc-bar"><span>${score.wpm} words per minute</span><span>${score.accuracy}% accurate</span></div>
      <div class="typer-line">${chars}</div>
      <input id="typer-input" class="typer-input" autocomplete="off" spellcheck="false" maxlength="${line.length}" value="${esc(typed)}" aria-label="Type the line here" placeholder="Start typing...">`;
  } else if (view === 'result') {
    body = `<div class="arc-result"><div class="arc-big">${esc(data.headline)}</div><p>${esc(data.detail)}</p>${data.newBest ? '<p class="arc-best">🏆 New best score!</p>' : ''}</div>
      <div class="menu-list"><button class="btn" data-arcade="${esc(data.game)}">Play again</button><button class="btn ghost" data-arcade="select">Other games</button></div>`;
  } else {
    body = `<div class="arc-games">${ARCADE_GAMES.map((g) => `<button class="arc-game" data-arcade="${g.id}"><span class="arc-icon">${g.icon}</span><b>${esc(g.name)}</b><small>${esc(g.about)}</small><em>${esc(g.best(best))}</em></button>`).join('')}</div>`;
  }
  $('arcade-card').innerHTML = `
    <h1 id="arcade-title">🕹️ Game corner</h1>
    <p class="lead">${view === 'select' ? 'Take a short break. Your shift is paused while you play.' : esc(ARCADE_GAMES.find((g) => g.id === (data?.game ?? view))?.name ?? '')}</p>
    ${body}
    <div class="menu-list" style="margin-top:14px"><button class="btn ghost" data-action="close-arcade">Back to work ${key('Esc')}</button></div>`;
  $('arcade').hidden = false;
  if (view === 'typer') {
    const box = $('typer-input');
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }
}

/** Update the ticket rush board in place, so a click is never lost to a redraw. */
export function updateRush(s) {
  const cells = document.querySelectorAll('#arcade .rush-cell');
  const bar = document.querySelector('#arcade .arc-bar');
  if (cells.length !== s.cells.length || !bar) return false;
  cells.forEach((el, i) => {
    const on = Boolean(s.cells[i]);
    if (el.classList.contains('on') !== on) {
      el.classList.toggle('on', on);
      el.textContent = on ? '🎫' : '';
      el.setAttribute('aria-label', on ? 'Ticket' : 'Empty');
    }
  });
  bar.innerHTML = `<span>⏱ ${Math.ceil(s.timeLeft)}s</span><span>🎫 ${s.score}</span><span>❌ ${s.missed}</span>`;
  return true;
}

export function hideArcade() {
  $('arcade').hidden = true;
}
