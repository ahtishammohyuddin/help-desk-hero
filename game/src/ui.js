// Everything drawn as HTML on top of the 3D view: status, ticket queue, ticket panel,
// toasts and the start-up screen. Text from the server is always escaped before display.

import { PRIORITIES, rankFor } from './tickets.js';

const $ = (id) => document.getElementById(id);

export function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function priorityBadge(priority) {
  return `<span class="pri" style="--pri:${PRIORITIES[priority].color}">${priority}</span>`;
}

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

// ---------- status card ----------

export function renderStatus(progress) {
  const rank = rankFor(progress.xp);
  const from = rank.min;
  const to = rank.next ? rank.next.min : rank.min;
  const pct = rank.next ? ((progress.xp - from) / (to - from)) * 100 : 100;
  const accuracy = progress.attempts ? Math.round((progress.solved / progress.attempts) * 100) : null;
  $('status').innerHTML = `
    <div class="rank">${esc(rank.name)}</div>
    <div class="xpbar"><div style="width:${pct.toFixed(1)}%"></div></div>
    <div class="xptext">${progress.xp} XP${rank.next ? ` · ${rank.next.min - progress.xp} to ${esc(rank.next.name)}` : ' · top rank'}</div>
    <div class="stats">Solved ${progress.solved}${accuracy === null ? '' : ` · Accuracy ${accuracy}%`}</div>`;
}

// ---------- ticket queue ----------

export function renderQueue(tickets) {
  if (tickets.length === 0) {
    $('queue').innerHTML = '<div class="empty">No open tickets. Enjoy your tea while it lasts.</div>';
    return;
  }
  $('queue').innerHTML = tickets
    .map((t) => {
      const pct = Math.max(0, (t.secondsLeft / t.sla) * 100);
      const breached = t.secondsLeft <= 0;
      return `<div class="qitem${breached ? ' breached' : ''}">
        <div class="qtop">${priorityBadge(t.priority)}<b>${esc(t.employee)}</b><span class="qnum">#${t.number}</span></div>
        <div class="qcat">${esc(t.category)}</div>
        <div class="qbar"><div style="width:${pct}%;background:${PRIORITIES[t.priority].color}"></div></div>
        <div class="qtime">${breached ? 'SLA BREACHED' : formatTime(t.secondsLeft) + ' left'}</div>
      </div>`;
    })
    .join('');
}

// ---------- ticket panel ----------

export function renderTicketPanel(person, ticket, detail) {
  const head = `
    <div class="tp-head">
      <div><div class="tp-name">${esc(person.name)}</div><div class="tp-dept">${esc(person.department)} · Ticket #${ticket.number}</div></div>
      <div class="tp-right">${priorityBadge(ticket.priority)}<span id="tp-timer" class="tp-timer"></span></div>
    </div>`;

  let body = '';
  let foot = '<kbd>E</kbd> close and come back later';

  if (detail.state === 'loading') {
    body = `<p class="tp-quote muted">${esc(person.name)} is explaining the problem<span class="dots"></span></p>`;
  } else if (detail.state === 'error') {
    body = `<p class="tp-error">Could not load this ticket. Is the backend still running?</p>`;
    foot = '<kbd>R</kbd> retry · <kbd>E</kbd> close';
  } else if (detail.result) {
    body = resultHtml(detail);
    foot = '<kbd>E</kbd> close ticket';
  } else {
    const p = detail.problem;
    const hints = detail.hints.map((h, i) => `<li><b>Hint ${i + 1}:</b> ${esc(h)}</li>`).join('');
    const options = p.options
      .map((o, i) => `<button class="opt" data-index="${i}" ${detail.answering ? 'disabled' : ''}><kbd>${i + 1}</kbd>${esc(o.text)}</button>`)
      .join('');
    body = `
      <p class="tp-quote">"${esc(detail.description)}"</p>
      ${hints ? `<ul class="tp-hints">${hints}</ul>` : ''}
      <div class="tp-ask">What do you do?</div>
      <div class="opts">${options}</div>`;
    const hintsLeft = p.hint_count - detail.hints.length;
    foot = `${hintsLeft > 0 ? `<kbd>H</kbd> hint (${hintsLeft} left, costs XP) · ` : ''}<kbd>1</kbd>-<kbd>${p.options.length}</kbd> answer · <kbd>E</kbd> later`;
    if (detail.answerError) foot = `<span class="tp-error">Could not send your answer. Try again.</span> · ${foot}`;
  }

  $('ticket').innerHTML = `${head}<div class="tp-body">${body}</div><div class="tp-foot">${foot}</div>`;
  $('ticket').hidden = false;
}

function resultHtml(detail) {
  const r = detail.result;
  const chosen = r.explanations.find((e) => e.option_id === r.chosen_option_id);
  const correct = r.explanations.find((e) => e.correct);
  const verdict = r.is_correct
    ? `<div class="verdict good">Correct! <span class="xpgain">+${r.xp} XP</span></div>`
    : `<div class="verdict bad">Not quite.</div>`;
  const yours = `<div class="expl ${r.is_correct ? 'good' : 'bad'}"><div class="expl-t">Your choice: ${esc(chosen.text)}</div><div>${esc(chosen.why)}</div></div>`;
  const right = r.is_correct
    ? ''
    : `<div class="expl good"><div class="expl-t">Best answer: ${esc(correct.text)}</div><div>${esc(correct.why)}</div></div>`;
  const tip = r.real_world_tip ? `<div class="tip"><b>From the field:</b> ${esc(r.real_world_tip)}</div>` : '';
  return verdict + yours + right + tip;
}

export function updateTicketTimer(ticket, closed = false) {
  const el = $('tp-timer');
  if (!el) return;
  el.textContent = closed ? 'CLOSED' : ticket.secondsLeft <= 0 ? 'BREACHED' : formatTime(ticket.secondsLeft);
  el.classList.toggle('late', !closed && ticket.secondsLeft <= 0);
}

export function hideTicketPanel() {
  $('ticket').hidden = true;
  $('ticket').innerHTML = '';
}

// ---------- toasts and XP pop-ups ----------

export function toast(html, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = html;
  $('toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 3600);
  setTimeout(() => el.remove(), 4200);
}

export function xpPop(amount) {
  const el = document.createElement('div');
  el.className = 'xppop';
  el.textContent = `+${amount} XP`;
  $('status').appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

export { priorityBadge };
