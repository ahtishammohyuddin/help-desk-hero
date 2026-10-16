// Stage F: how your technician looks, and the desk upgrades you earn with XP.
// Everything is saved only on this device. Pure logic, tested with Node.

export const LOOK_KEY = 'hdh-look';

export const LOOK_OPTIONS = {
  shirt: [
    { id: 'blue', name: 'Help desk blue', color: 0x2563a8 },
    { id: 'navy', name: 'Navy', color: 0x1f2a44 },
    { id: 'green', name: 'Green', color: 0x2f8f5b },
    { id: 'maroon', name: 'Maroon', color: 0x8c2f39 },
    { id: 'grey', name: 'Grey', color: 0x5b6573 },
    { id: 'white', name: 'White', color: 0xe9edf1 },
    { id: 'black', name: 'Black', color: 0x22252a },
  ],
  hair: [
    { id: 'black', name: 'Black', color: 0x1b1310 },
    { id: 'brown', name: 'Brown', color: 0x5a3a22 },
    { id: 'auburn', name: 'Auburn', color: 0x8a3b1e },
    { id: 'blonde', name: 'Blonde', color: 0xc9a25a },
    { id: 'grey', name: 'Grey', color: 0x9a9a9a },
  ],
  skin: [
    { id: 'light', name: 'Light', color: 0xf0c9a5 },
    { id: 'medium', name: 'Medium', color: 0xd9a77e },
    { id: 'tan', name: 'Tan', color: 0xb98157 },
    { id: 'brown', name: 'Brown', color: 0x8d5a3b },
    { id: 'dark', name: 'Dark', color: 0x5e3a26 },
  ],
  lanyard: [
    { id: 'blue', name: 'Blue', color: 0x2f6feb },
    { id: 'red', name: 'Red', color: 0xe5484d },
    { id: 'green', name: 'Green', color: 0x33d17a },
    { id: 'yellow', name: 'Yellow', color: 0xffb02e },
    { id: 'purple', name: 'Purple', color: 0x6c4fd1 },
  ],
};

export const LOOK_PARTS = { shirt: 'Shirt', hair: 'Hair', skin: 'Skin tone', lanyard: 'Lanyard' };
export const DEFAULT_LOOK = { shirt: 'blue', hair: 'black', skin: 'medium', lanyard: 'blue' };

/** A saved look (JSON text from storage), with anything unknown replaced by the default. */
export function parseLook(raw) {
  let data = {};
  try {
    data = JSON.parse(raw ?? '{}') ?? {};
  } catch {
    data = {};
  }
  const look = {};
  for (const part of Object.keys(DEFAULT_LOOK)) {
    look[part] = LOOK_OPTIONS[part].some((o) => o.id === data[part]) ? data[part] : DEFAULT_LOOK[part];
  }
  return look;
}

/** Change one part of the look. Unknown parts or choices leave it as it was. */
export function setLookPart(look, part, id) {
  if (!LOOK_OPTIONS[part]?.some((o) => o.id === id)) return look;
  return { ...look, [part]: id };
}

/** The colours for makePerson(). */
export function lookColors(look) {
  const color = (part) => LOOK_OPTIONS[part].find((o) => o.id === look[part]).color;
  return { shirt: color('shirt'), hair: color('hair'), skin: color('skin'), lanyard: color('lanyard') };
}

// ---------- desk upgrades ----------

/**
 * Upgrades for your help desk, unlocked by total XP (nothing is spent, so your rank never drops).
 * Only the mug changes anything in play, and only a little: it never changes answers or ticket XP.
 */
export const DESK_UPGRADES = [
  { id: 'plant', name: 'Desk plant', xp: 50, icon: '🪴', perk: null, text: 'A little green for your desk.' },
  { id: 'mug', name: 'Help desk mug', xp: 200, icon: '☕', perk: 'Coffee boost lasts 60 seconds instead of 45.', text: 'Your own mug for the coffee machine.' },
  { id: 'lamp', name: 'Desk lamp', xp: 400, icon: '💡', perk: null, text: 'A warm lamp for late tickets.' },
  { id: 'monitor', name: 'Third monitor', xp: 700, icon: '🖥️', perk: null, text: 'A third screen on a stand above the other two.' },
  { id: 'chair', name: 'Ergonomic chair', xp: 1100, icon: '🪑', perk: null, text: 'A high-back chair with a headrest.' },
  { id: 'trophy', name: 'Help Desk Hero trophy', xp: 1600, icon: '🏆', perk: null, text: 'For keeping the whole office running.' },
];

export const MUG_COFFEE_SECONDS = 60;

export function unlockedUpgrades(xp) {
  return DESK_UPGRADES.filter((u) => xp >= u.xp).map((u) => u.id);
}

/** Upgrades unlocked by going from xpBefore to xpAfter. */
export function newlyUnlocked(xpBefore, xpAfter) {
  return DESK_UPGRADES.filter((u) => xpBefore < u.xp && xpAfter >= u.xp);
}

/** The next upgrade still to unlock, and how much XP it needs (null when all are unlocked). */
export function nextUpgrade(xp) {
  const next = DESK_UPGRADES.find((u) => xp < u.xp);
  return next ? { ...next, needed: next.xp - xp } : null;
}

export function coffeeSecondsFor(xp, base) {
  return unlockedUpgrades(xp).includes('mug') ? MUG_COFFEE_SECONDS : base;
}
