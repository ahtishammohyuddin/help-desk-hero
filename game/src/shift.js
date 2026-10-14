// Shift rules and statistics. Pure logic (no browser), tested with Node.
//
// A shift is a working day from 9:00 to 17:00, squeezed into 8 real minutes,
// so one real minute is one office hour.

export const SHIFT_SECONDS = 8 * 60;
const START_HOUR = 9;
const END_HOUR = 17;

/** Wall-clock time for a number of seconds into the shift. */
export function clockFor(elapsed) {
  const fraction = Math.min(Math.max(elapsed / SHIFT_SECONDS, 0), 1);
  const minutes = Math.floor(fraction * (END_HOUR - START_HOUR) * 60);
  const h24 = START_HOUR + Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  return { fraction, label: `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}` };
}

/**
 * How well a topic is going, from all-time numbers.
 * - "new": not tried yet
 * - "learning": fewer than 3 tries, too early to say
 * - "mastered": 5+ tries and at least 80% right first time
 * - "practise": 3+ tries and under 50% right first time
 * - "good": everything in between
 */
export function topicStatus({ attempts = 0, firstTry = 0 } = {}) {
  if (attempts === 0) return 'new';
  if (attempts < 3) return 'learning';
  const rate = firstTry / attempts;
  if (attempts >= 5 && rate >= 0.8) return 'mastered';
  if (rate < 0.5) return 'practise';
  return 'good';
}

/**
 * Add one finished ticket to the all-time topic stats (returns a new object).
 * outcome: "first" (right first time), "second" (right on the second try) or "failed".
 */
export function recordTopic(topics, category, outcome) {
  const prev = topics[category] ?? { attempts: 0, firstTry: 0, solved: 0 };
  return {
    ...topics,
    [category]: {
      attempts: prev.attempts + 1,
      firstTry: prev.firstTry + (outcome === 'first' ? 1 : 0),
      solved: prev.solved + (outcome === 'failed' ? 0 : 1),
    },
  };
}

/**
 * Summary of one shift for the end-of-shift report.
 * records: finished tickets { category, outcome, overdue, seconds, xp }
 * leftOpen: how many tickets were still open when the shift ended
 */
export function summarizeShift(records, leftOpen = 0) {
  const count = (outcome) => records.filter((r) => r.outcome === outcome).length;
  const byCategory = {};
  for (const r of records) {
    const c = (byCategory[r.category] ??= { total: 0, firstTry: 0 });
    c.total += 1;
    if (r.outcome === 'first') c.firstTry += 1;
  }

  // Strongest: best first-time rate among topics seen at least twice. To practise: worst, if below 100%.
  const ranked = Object.entries(byCategory)
    .filter(([, c]) => c.total >= 2)
    .map(([name, c]) => ({ name, rate: c.firstTry / c.total }))
    .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
  const strongest = ranked.length && ranked[0].rate > 0 ? ranked[0].name : null;
  const weakest = ranked.length > 1 && ranked[ranked.length - 1].rate < 1 ? ranked[ranked.length - 1].name : null;

  const solved = count('first') + count('second');
  const times = records.map((r) => r.seconds);
  return {
    handled: records.length,
    solved,
    firstTry: count('first'),
    secondTry: count('second'),
    failed: count('failed'),
    leftOpen,
    overdue: records.filter((r) => r.overdue).length,
    avgSeconds: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    xp: records.reduce((a, r) => a + r.xp, 0),
    firstTryRate: records.length ? Math.round((count('first') / records.length) * 100) : null,
    byCategory,
    strongest,
    practise: weakest === strongest ? null : weakest,
  };
}
