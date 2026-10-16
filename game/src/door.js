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
