// The manager's office door. It stays shut unless the manager has asked for help,
// or the player knocks and he answers. Pure logic, tested with Node.

/** The doorway in the wall between the east wing and the manager's office (wall at x 36.15). */
export const DOORWAY = { x: 36.15, minZ: -4.4, maxZ: -2.6 };
/** Blocks the doorway while the door is shut. */
export const DOOR_BLOCK = { minX: 35.95, maxX: 36.35, minZ: -4.4, maxZ: -2.6 };
export const PERMIT_SECONDS = 30; // how long "come in" lasts if you do not go in
export const LINGER_SECONDS = 4; // the door stays open this long after you leave the office

export const COME_IN = ['Come in!', 'Yes, come in.', "Door's open, come in.", 'Come in, have a seat.'];

/** Is this point inside the manager's office? (east of the wing wall, north of the booths wall) */
export function insideOffice(p) {
  return p.x > 36.3 && p.z < -1;
}

/** Is this point standing in or right next to the doorway? The door never shuts on someone. */
export function inDoorway(p) {
  return p.x > 35.4 && p.x < 36.9 && p.z > DOORWAY.minZ - 0.3 && p.z < DOORWAY.maxZ + 0.3;
}

/**
 * Should the door be open right now?
 * called: the manager has an open ticket (he asked for help).
 * permitUntil: time until which a "come in" holds. managerNear: he is walking through it himself.
 * wasOpen: the door is open right now.
 */
export function doorShouldOpen({ called, permitUntil, now, player, managerNear, wasOpen = false }) {
  // Standing in the doorway only keeps an open door open; it never opens a shut one.
  return called || now < permitUntil || insideOffice(player) || (wasOpen && inDoorway(player)) || managerNear;
}

/** What happens when the player knocks. */
export function knockAnswer({ managerAtDesk, now, pick = 0 }) {
  if (!managerAtDesk) {
    return { allowed: false, permitUntil: 0, line: 'No answer. Haroon is not in his office right now.' };
  }
  return { allowed: true, permitUntil: now + PERMIT_SECONDS, line: `Haroon: "${COME_IN[pick % COME_IN.length]}"` };
}

// ---------- the server room badge door ----------

/** The sliding glass door in the server room's south wall (x 13..15 at z -6). The reader is outside, at x 15.1. */
export const SERVER_DOORWAY = { z: -6, minX: 13, maxX: 15 };
export const SERVER_DOOR_BLOCK = { minX: 13, maxX: 15, minZ: -6.15, maxZ: -5.85 };
export const BADGE_OPEN_SECONDS = 5;

export function insideServerRoom(p) {
  return p.x > 10 && p.x < 20 && p.z > -14 && p.z < -6;
}

function nearServerDoor(p, reach) {
  return p.x > SERVER_DOORWAY.minX - 0.5 && p.x < SERVER_DOORWAY.maxX + 0.5 && Math.abs(p.z - SERVER_DOORWAY.z) < reach;
}

/**
 * Should the server room door be open?
 * Outside, it opens only for a badge tap (openUntil). Inside, walking up to it opens it
 * (like a real exit sensor). It never shuts on someone standing in it.
 */
export function serverDoorShouldOpen({ openUntil, now, player, wasOpen = false }) {
  if (now < openUntil) return true;
  if (insideServerRoom(player) && nearServerDoor(player, 1.6)) return true;
  return wasOpen && nearServerDoor(player, 0.6);
}
