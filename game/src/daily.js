// Daily challenge: dates, streaks and share text. Pure logic (no browser), tested with Node.
// The server picks the day's 5 problems from the date; this file keeps the player's own record.

export const DAILY_XP_PER_RIGHT = 10;

/** The player's local date as YYYY-MM-DD (the day changes at their midnight). */
export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The day before a YYYY-MM-DD key. */
export function previousDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

/** A fresh record. */
export const emptyDaily = () => ({ lastDate: null, streak: 0, best: 0, results: {} });

export const playedOn = (state, key) => Boolean(state.results?.[key]);

/**
 * Save today's result and update the day streak (returns a new state).
 * result: { correct, total, seconds, marks: [true/false per ticket] }
 */
export function recordDaily(state, key, result) {
  if (playedOn(state, key)) return state; // one try per day
  const streak = state.lastDate === previousDay(key) ? state.streak + 1 : 1;
  return {
    lastDate: key,
    streak,
    best: Math.max(state.best ?? 0, streak),
    results: { ...state.results, [key]: result },
  };
}

/** The streak still counts if the player played today or yesterday. */
export function currentStreak(state, key) {
  return state.lastDate === key || state.lastDate === previousDay(key) ? state.streak : 0;
}

/** "16 October 2026" for a YYYY-MM-DD key. */
export function dayLabel(key) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}

/** Time until the next challenge, like "5h 12m". */
export function untilTomorrow(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mins = Math.max(1, Math.ceil((next - now) / 60000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const time = (s) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

/** Suggested post text. The squares show right and wrong without giving answers away. */
export function dailyPostText(key, result, streak) {
  const squares = result.marks.map((ok) => (ok ? '🟩' : '🟥')).join('');
  return [
    `Help Desk Hero daily challenge, ${dayLabel(key)}`,
    `${squares} ${result.correct}/${result.total} in ${time(result.seconds)}`,
    streak > 1 ? `${streak} days in a row` : '',
    '',
    'A 3D browser game that teaches IT support. Can you beat my score?',
    '#ITSupport #HelpDesk #LearningByDoing',
  ].filter((line, i, all) => line !== '' || all[i - 1] !== '').join('\n');
}

export { time as durationText };
