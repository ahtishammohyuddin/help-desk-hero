// Everything drawn as HTML on top of the 3D view: status, ticket queue, ticket panel,
// toasts and the start-up screen. Text from the server is always escaped before display.

import { PRIORITIES, rankFor, streakMultiplier } from './tickets.js';

const $ = (id) => document.getElementById(id);

export const MAX_QUESTIONS = 3; // senior tech questions per ticket (keeps AI use and cost low)

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
  const accuracy = progress.attempts ? Math.round((progress.firstTry / progress.attempts) * 100) : null;
  $('status').innerHTML = `
    <div class="rank">${esc(rank.name)}</div>
    <div class="xpbar"><div style="width:${pct.toFixed(1)}%"></div></div>
    <div class="xptext">${progress.xp} XP${rank.next ? ` · ${rank.next.min - progress.xp} to ${esc(rank.next.name)}` : ' · top rank'}</div>
    <div class="stats">Solved ${progress.solved}${accuracy === null ? '' : ` · First try ${accuracy}%`}</div>
    ${progress.streak >= 2
      ? `<div class="streak">Streak ${progress.streak}${progress.streak >= 3 ? ` · XP ×${streakMultiplier(progress.streak)}` : ''}</div>`
      : progress.bestStreak >= 3 ? `<div class="streak cold">Best streak ${progress.bestStreak}</div>` : ''}`;
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
    body = resultHtml(detail) + seniorHtml(detail);
    const left = MAX_QUESTIONS - detail.chat.filter((t) => t.role === 'junior').length;
    foot = `${left > 0 ? '<kbd>Q</kbd> ask the senior tech · ' : ''}<kbd>E</kbd> close ticket`;
  } else {
    const p = detail.problem;
    const hints = detail.hints.map((h, i) => `<li><b>Hint ${i + 1}:</b> ${esc(h)}</li>`).join('');
    const ruledOut = new Set(detail.wrong.map((w) => w.id));
    const options = p.options
      .map((o, i) => {
        const out = ruledOut.has(o.id);
        return `<button class="opt${out ? ' out' : ''}" data-index="${i}" ${detail.answering || out ? 'disabled' : ''}><kbd>${i + 1}</kbd>${esc(o.text)}</button>`;
      })
      .join('');
    const lastWrong = detail.wrong[detail.wrong.length - 1];
    const retry = lastWrong
      ? `<div class="retry"><div class="retry-t">Not quite.</div><div>${esc(lastWrong.why)}</div>
         <div class="retry-sub">Read the hint and try once more. Fixing it now still earns 50% XP.</div></div>`
      : '';
    body = `
      <p class="tp-quote">"${esc(detail.description)}"</p>
      ${retry}
      ${hints ? `<ul class="tp-hints">${hints}</ul>` : ''}
      <div class="tp-ask">${lastWrong ? 'Second try: what do you do?' : 'What do you do?'}</div>
      <div class="opts">${options}</div>`;
    const hintsLeft = p.hint_count - detail.hints.length;
    foot = `${hintsLeft > 0 ? `<kbd>H</kbd> hint (${hintsLeft} left, costs XP) · ` : ''}<kbd>1</kbd>-<kbd>${p.options.length}</kbd> answer · <kbd>E</kbd> later`;
    if (detail.answerError) foot = `<span class="tp-error">Could not send your answer. Try again.</span> · ${foot}`;
  }

  $('ticket').innerHTML = `${head}<div class="tp-body">${body}</div><div class="tp-foot">${foot}</div>`;
  $('ticket').hidden = false;
}

function seniorHtml(detail) {
  const asked = detail.chat.filter((t) => t.role === 'junior').length;
  const left = MAX_QUESTIONS - asked;
  const turns = detail.chat
    .map((t) => {
      if (t.role === 'junior') return `<div class="turn me">${esc(t.text)}</div>`;
      // Fallback replies already say the senior tech is busy, so they get no "Senior tech:" label.
      if (t.source === 'fallback') return `<div class="turn senior">${esc(t.text)}<span class="src">from the ticket notes</span></div>`;
      return `<div class="turn senior"><b>Senior tech:</b> ${esc(t.text)}</div>`;
    })
    .join('');
  const thinking = detail.asking ? '<div class="turn senior muted">Senior tech is typing<span class="dots"></span></div>' : '';
  const form = left > 0
    ? `<form id="ask-form" autocomplete="off">
         <input id="ask-input" maxlength="300" placeholder="${asked ? 'Ask a follow-up...' : 'e.g. Why is that the first thing to check?'}" ${detail.asking ? 'disabled' : ''}>
         <button type="submit" ${detail.asking ? 'disabled' : ''}>Ask</button>
       </form>
       <div class="senior-note">${left} question${left === 1 ? '' : 's'} left on this ticket</div>`
    : '<div class="senior-note">That is all the senior tech has time for on this ticket.</div>';
  return `<div class="senior"><div class="senior-title">Ask the senior tech</div>${turns}${thinking}${form}</div>`;
}

function resultHtml(detail) {
  const r = detail.result;
  const byId = (id) => r.explanations.find((e) => e.option_id === id);
  const chosen = byId(r.chosen_option_id);
  const correct = r.explanations.find((e) => e.correct);
  const bonus = r.mult > 1 ? `<span class="mult">streak ×${r.mult}</span>` : '';
  const xp = r.xp > 0 ? ` <span class="xpgain">+${r.xp} XP${bonus}</span>` : '';
  let verdict;
  if (r.is_correct && r.attempt === 1) verdict = `<div class="verdict good">Correct!${xp}</div>`;
  else if (r.is_correct) verdict = `<div class="verdict good">Fixed on the second try!${xp}</div>`;
  else verdict = `<div class="verdict bad">Not solved this time.</div><div class="retry-sub">Here is what a senior tech would do, so you know it next time.</div>`;

  // Show the mistakes first, then the fix, so the player sees what changed.
  const mistakes = detail.wrong
    .map((w, i) => {
      const e = byId(w.id);
      return `<div class="expl bad"><div class="expl-t">${detail.wrong.length > 1 ? `Try ${i + 1}` : 'First try'}: ${esc(e.text)}</div><div>${esc(e.why)}</div></div>`;
    })
    .join('');
  const last = r.is_correct
    ? ''
    : `<div class="expl bad"><div class="expl-t">Second try: ${esc(chosen.text)}</div><div>${esc(chosen.why)}</div></div>`;
  const yours = r.is_correct
    ? `<div class="expl good"><div class="expl-t">${r.attempt === 1 ? 'Your choice' : 'Your fix'}: ${esc(chosen.text)}</div><div>${esc(chosen.why)}</div></div>`
    : '';
  const right = r.is_correct
    ? ''
    : `<div class="expl good"><div class="expl-t">Best answer: ${esc(correct.text)}</div><div>${esc(correct.why)}</div></div>`;
  const tip = r.real_world_tip ? `<div class="tip"><b>From the field:</b> ${esc(r.real_world_tip)}</div>` : '';
  return verdict + mistakes + last + yours + right + tip;
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
