// Achievements (badges). Pure logic (no browser), tested with Node.
//
// Each badge has a check that looks at the saved progress and, optionally, at the
// event that just happened:
//   { type: 'ticket', priority, outcome, overdue, secondsLeft, sla }  after a ticket is closed
//   { type: 'shift', summary }                                        at the end of a shift
//   { type: 'load' }                                                  when the game starts
// Badges that only depend on totals are also awarded on 'load', so players who
// already had progress before badges existed get the ones they have earned.

import { RANKS } from './tickets.js';
import { topicStatus } from './shift.js';

const TOP_RANK = RANKS[RANKS.length - 1];
const solvedTopics = (progress) => Object.values(progress.topics ?? {}).filter((t) => t.solved > 0).length;
const isTicket = (event, check) => event?.type === 'ticket' && check(event);

export const ACHIEVEMENTS = [
  {
    id: 'first-fix',
    icon: '🔧',
    name: 'First fix',
    description: 'Solve your first ticket.',
    check: (p) => p.solved >= 1,
  },
  {
    id: 'second-chance',
    icon: '🔁',
    name: 'Second chance',
    description: 'Fix a ticket on your second try.',
    check: (p, e) => isTicket(e, (t) => t.outcome === 'second'),
  },
  {
    id: 'firefighter',
    icon: '🔥',
    name: 'Firefighter',
    description: 'Solve an Urgent ticket before its timer runs out.',
    check: (p, e) => isTicket(e, (t) => t.priority === 'P1' && t.outcome !== 'failed' && !t.overdue),
  },
  {
    id: 'speedy',
    icon: '⚡',
    name: 'Quick fix',
    description: 'Solve a ticket with more than half of its time left.',
    check: (p, e) => isTicket(e, (t) => t.outcome !== 'failed' && t.secondsLeft > t.sla / 2),
  },
  {
    id: 'streak-3',
    icon: '🎯',
    name: 'On a roll',
    description: 'Get 3 tickets right first time in a row.',
    check: (p) => p.bestStreak >= 3,
  },
  {
    id: 'streak-10',
    icon: '🚀',
    name: 'Unstoppable',
    description: 'Get 10 tickets right first time in a row.',
    check: (p) => p.bestStreak >= 10,
  },
  {
    id: 'first-shift',
    icon: '🕔',
    name: 'Clocked out',
    description: 'Finish your first full shift.',
    check: (p) => p.shifts >= 1,
  },
  {
    id: 'clean-shift',
    icon: '✨',
    name: 'Clean shift',
    description: 'Solve 5+ in one shift with nothing late, failed or left open.',
    check: (p, e) =>
      e?.type === 'shift' &&
      e.summary.solved >= 5 &&
      e.summary.overdue === 0 &&
      e.summary.failed === 0 &&
      e.summary.leftOpen === 0,
  },
  {
    id: 'all-rounder',
    icon: '🧰',
    name: 'All-rounder',
    description: 'Solve tickets in 6 different topics.',
    check: (p) => solvedTopics(p) >= 6,
  },
  {
    id: 'topic-master',
    icon: '🎓',
    name: 'Topic master',
    description: 'Do 5+ tickets in one topic, 80% right first time.',
    check: (p) => Object.values(p.topics ?? {}).some((t) => topicStatus(t) === 'mastered'),
  },
  {
    id: 'solved-25',
    icon: '⭐',
    name: 'Regular',
    description: 'Solve 25 tickets.',
    check: (p) => p.solved >= 25,
  },
  {
    id: 'solved-100',
    icon: '🏅',
    name: 'Veteran',
    description: 'Solve 100 tickets.',
    check: (p) => p.solved >= 100,
  },
  {
    id: 'top-rank',
    icon: '👑',
    name: TOP_RANK.name,
    description: `Reach ${TOP_RANK.min} XP. Unlocks your certificate.`,
    check: (p) => p.xp >= TOP_RANK.min,
  },
];

/**
 * Badges earned by this event that the player does not have yet.
 * progress.achievements maps badge id -> when it was earned (ms since 1970).
 */
export function newlyEarned(progress, event = { type: 'load' }) {
  const have = progress.achievements ?? {};
  return ACHIEVEMENTS.filter((a) => !have[a.id] && a.check(progress, event));
}

/** Record badges as earned (returns a new map, the original is unchanged). */
export function award(achievements, badges, now = Date.now()) {
  const next = { ...(achievements ?? {}) };
  for (const b of badges) next[b.id] ??= now;
  return next;
}
