// Main menu and loading screen: pure logic (no browser), tested with Node.
// The player's name lives only in this browser (localStorage). It is never sent to the
// server or the AI: it is only used for greetings and the certificate.

import { cleanName } from './cards.js';
import { rankFor } from './tickets.js';

export const PLAYER_NAME_KEY = 'hdh-name';

// Game tips shown while loading. They describe how the game works, not IT facts.
export const LOADING_TIPS = [
  'Urgent tickets are worth double XP, so check the list on the right often.',
  'A wrong answer gives you a hint and one more try, worth half the XP.',
  'Follow the blue marker on the map when a fix needs you somewhere else.',
  'Get 3 tickets right in a row for a streak bonus.',
  'The daily challenge is the same for everyone. Can you keep your streak going?',
  'Stuck after a ticket? Ask the senior tech what they would have done.',
  'Hands-on tickets: find it, fix it, then ask the person to test it.',
  'Escalating? Pick the right team and never send anyone a password.',
];

/** Loading steps, in order, with how full the bar is when each one starts. */
export const LOADING_STEPS = [
  { id: 'office', label: 'Building the office', at: 15 },
  { id: 'server', label: 'Connecting to the help desk server', at: 55 },
  { id: 'tickets', label: 'Loading tickets', at: 85 },
  { id: 'ready', label: 'Ready', at: 100 },
];

export function loadingStep(id) {
  return LOADING_STEPS.find((s) => s.id === id) ?? LOADING_STEPS[0];
}

/** A tip that changes every few seconds. */
export function tipAt(seconds, every = 5) {
  return LOADING_TIPS[Math.floor(seconds / every) % LOADING_TIPS.length];
}

/** "Good morning" / "Good afternoon" / "Good evening" for the player's own clock. */
export function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Has this player played before (so the menu offers Continue)? */
export const hasSave = (progress) => (progress?.xp ?? 0) > 0 || (progress?.shifts ?? 0) > 0 || (progress?.attempts ?? 0) > 0;

/** What the main menu shows for this player. */
export function menuState(progress, rawName, date = new Date(), { inShift = false } = {}) {
  const name = cleanName(rawName);
  const rank = rankFor(progress?.xp ?? 0);
  return {
    name,
    needsName: !name,
    greeting: name ? `${greetingFor(date)}, ${name}` : 'Welcome to the help desk',
    subtitle: hasSave(progress) ? `${rank.name}, ${progress.xp} XP` : 'Your first day as the office IT technician',
    primary: inShift ? 'Back to my shift' : hasSave(progress) ? 'Continue' : 'Start my first shift',
    canReset: hasSave(progress),
  };
}
