// Everything drawn as HTML on top of the 3D view: player card, ticket list, ticket window,
// messages, the welcome card and the start-up screen.
// Text from the server is always escaped before display.

import { ACHIEVEMENTS } from './achievements.js';
import { countdown, EVENTS } from './events.js';
import { DISCLAIMER, NAME_MAX } from './cards.js';
import { missionStep, needsServerRoom, placesNeeded, SURVEY_SPOTS, surveyDone } from './handson.js';
import { jobStage, PLACES } from './jobs.js';
import {
  cabinetSvg, chipsHtml, deskSummary, deskSvg, displayModeHtml, laptopSummary, laptopSvg, printerSummary, printerSvg, switchSvg,
} from './stations.js';
import { ITEMS } from './handson.js';
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
  const where = sim.station === 'printer' ? 'Go to the printer'
    : sim.station === 'survey' ? 'Measure Wi-Fi at 3 spots'
      : `Inspect Desk ${person.desk}`;
  const fix = sim.station === 'survey' ? 'Note the weak spot' : 'Fix what you find';
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

/** The parts cabinet: pick what you need. log: recent messages. */
export function renderCabinetPanel(carrying, log) {
  const sheet = $('ticket');
  const wasOpen = !sheet.hidden;
  sheet.innerHTML = `
    <header class="tp-head">
      <span class="avatar big" style="--c:#4a525c" aria-hidden="true">C</span>
      <div class="tp-who"><div class="tp-name">Parts cabinet</div><div class="small">${carrying ? `You are carrying: ${esc(ITEMS[carrying])}` : 'Your hands are empty'}</div></div>
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
  $('carry').innerHTML = item ? `Carrying: <b>${esc(ITEMS[item])}</b>` : '';
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
  if (pending) banner = `<div class="banner blue"><span class="icon">✓</span><div><b>Right fix!</b> Now do it in person to close the ticket. The timer is still running.</div></div>`;
  else if (detail.job && r.attempt === 1) banner = `<div class="banner good"><span class="icon">✓</span><div><b>Fixed in person!</b> +${r.xp} XP${bonusText}</div></div>`;
  else if (detail.job) banner = `<div class="banner good"><span class="icon">✓</span><div><b>Fixed in person on your second try.</b> +${r.xp} XP</div></div>`;
  else if (r.is_correct && r.attempt === 1) banner = `<div class="banner good"><span class="icon">✓</span><div><b>Solved!</b> +${r.xp} XP${bonusText}</div></div>`;
  else if (r.is_correct) banner = `<div class="banner good"><span class="icon">✓</span><div><b>Solved on your second try.</b> +${r.xp} XP${bonusText}</div></div>`;
  else banner = `<div class="banner bad"><span class="icon">✕</span><div><b>Not solved this time.</b> Here is what a senior tech would do.</div></div>`;

  const card = (cls, title, text) => `<div class="expl ${cls}"><div class="expl-t">${title}</div><p>${esc(text)}</p></div>`;
  const parts = [banner];
  detail.wrong.forEach((w) => {
    const e = byId(w.id);
    parts.push(card('bad', `Why "${esc(e.text)}" didn't work`, e.why));
  });
  if (!r.is_correct) parts.push(card('bad', `Why "${esc(chosen.text)}" didn't work`, chosen.why));
  parts.push(card('good', `The right fix: ${esc(correct.text)}`, correct.why));
  if (r.real_world_tip) parts.push(`<div class="tip"><b>From real help desks:</b> ${esc(r.real_world_tip)}</div>`);
  return parts.join('');
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
