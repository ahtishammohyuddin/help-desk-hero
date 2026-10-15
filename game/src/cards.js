// Images the player can download: the shift result card (for LinkedIn) and the
// completion certificate. Drawn on a <canvas>, so nothing is uploaded anywhere:
// the player's name never leaves their computer.
//
// The text helpers at the top are pure and tested with Node. The draw functions
// need a browser.

export const DISCLAIMER = 'Completion of a training game, not an accredited certification.';
export const NAME_MAX = 40;

const C = {
  ink: '#1f2a37',
  muted: '#5b6b7c',
  line: '#e3e8ee',
  wash: '#f4f7fb',
  blue: '#2f6feb',
  blueSoft: '#e8f0fe',
  good: '#1f9d55',
  gold: '#b7791f',
};
const FONT = '"Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif';

// ---------- pure helpers ----------

/** Tidy a typed name for the certificate. Returns '' if it is too short to use. */
export function cleanName(raw) {
  const name = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '') // control characters
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
  return name.length >= 2 ? name : '';
}

/** "15 October 2026" (the same in every language setting). */
export function formatDate(date) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/** Minutes and seconds, like 1:05. */
export function clockTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Suggested LinkedIn post text for a finished shift. Only real numbers from the shift,
 * and it says plainly that this is a game.
 */
export function postText(summary, { shiftNumber, rankName, badgeNames = [] }) {
  const lines = [
    `I just finished shift ${shiftNumber} in Help Desk Hero, a 3D browser game that teaches IT support.`,
    '',
    `- ${summary.solved} ticket${summary.solved === 1 ? '' : 's'} solved`,
    `- ${summary.firstTryRate}% right first time`,
    `- Rank: ${rankName}`,
  ];
  if (summary.strongest) lines.push(`- Strongest topic: ${summary.strongest}`);
  if (badgeNames.length) lines.push(`- New badge${badgeNames.length === 1 ? '' : 's'}: ${badgeNames.join(', ')}`);
  lines.push('', '#ITSupport #HelpDesk #LearningByDoing');
  return lines.join('\n');
}

// ---------- drawing helpers (browser only) ----------

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, value, x, y, { size = 24, weight = 400, color = C.ink, align = 'left', maxWidth } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  // Shrink long text (a long name or topic) until it fits.
  if (maxWidth) {
    let s = size;
    while (s > 12 && ctx.measureText(value).width > maxWidth) {
      s -= 2;
      ctx.font = `${weight} ${s}px ${FONT}`;
    }
  }
  ctx.fillText(value, x, y);
}

/** Make sure the game font is ready, so the image does not fall back to a plain font. */
async function fontsReady() {
  try {
    await Promise.all([document.fonts.load(`400 24px ${FONT}`), document.fonts.load(`700 24px ${FONT}`)]);
  } catch {
    /* fonts unavailable: the fallback font is fine */
  }
}

// A small monitor-and-wrench logo mark, drawn with shapes (no image files).
function logoMark(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 64, s / 64);
  ctx.fillStyle = C.blue;
  roundRect(ctx, 0, 0, 64, 64, 16);
  ctx.fill();
  ctx.fillStyle = '#fff';
  roundRect(ctx, 12, 14, 40, 26, 4); // screen
  ctx.fill();
  ctx.fillRect(28, 40, 8, 6); // stand
  roundRect(ctx, 20, 46, 24, 5, 2.5);
  ctx.fill();
  ctx.fillStyle = C.blue;
  ctx.beginPath(); // check mark on the screen
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.blue;
  ctx.moveTo(23, 27);
  ctx.lineTo(29, 33);
  ctx.lineTo(41, 21);
  ctx.stroke();
  ctx.restore();
}

// ---------- shift result card: 1200 x 627, the size LinkedIn shows best ----------

/**
 * data: { summary, shiftNumber, rankName, badgeCount, badgeTotal, xp, nextRank: { name, min } | null }
 * Returns a PNG data URL.
 */
export async function drawResultCard(data) {
  await fontsReady();
  const W = 1200;
  const H = 627;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const s = data.summary;

  ctx.fillStyle = C.wash;
  ctx.fillRect(0, 0, W, H);
  // soft decorative circles
  ctx.fillStyle = C.blueSoft;
  ctx.beginPath();
  ctx.arc(W - 90, 70, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#dde8fd';
  ctx.beginPath();
  ctx.arc(W - 20, 170, 90, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  roundRect(ctx, 48, 48, W - 96, H - 132, 28);
  ctx.fill();

  logoMark(ctx, 88, 86, 56);
  text(ctx, 'HELP DESK HERO', 160, 113, { size: 22, weight: 700, color: C.blue });
  text(ctx, `Shift ${data.shiftNumber} report`, 88, 205, { size: 54, weight: 700 });

  // rank pill
  ctx.font = `700 26px ${FONT}`;
  const rankLabel = `Rank: ${data.rankName}`;
  const pillW = ctx.measureText(rankLabel).width + 44;
  ctx.fillStyle = C.ink;
  roundRect(ctx, W - 88 - pillW, 160, pillW, 52, 26);
  ctx.fill();
  text(ctx, rankLabel, W - 88 - pillW / 2, 195, { size: 26, weight: 700, color: '#fff', align: 'center' });

  // four numbers
  const stats = [
    [String(s.solved), 'tickets solved'],
    [`${s.firstTryRate}%`, 'right first time'],
    [`+${s.xp}`, 'XP earned'],
    [s.avgSeconds === null ? '-' : clockTime(s.avgSeconds), 'average time'],
  ];
  const boxW = (W - 176 - 3 * 20) / 4;
  stats.forEach(([big, small], i) => {
    const x = 88 + i * (boxW + 20);
    ctx.fillStyle = C.wash;
    roundRect(ctx, x, 245, boxW, 130, 18);
    ctx.fill();
    text(ctx, big, x + 24, 315, { size: 52, weight: 700, color: i === 1 ? C.good : C.ink, maxWidth: boxW - 48 });
    text(ctx, small, x + 24, 352, { size: 22, color: C.muted });
  });

  const strongest = s.strongest ? `Strongest topic: ${s.strongest}` : 'Every ticket is practice';
  text(ctx, strongest, 88, 432, { size: 26, weight: 700, maxWidth: 640 });
  text(ctx, `Badges: ${data.badgeCount} of ${data.badgeTotal}`, W - 88, 432, { size: 26, weight: 700, color: C.gold, align: 'right' });

  // progress towards the next rank
  ctx.fillStyle = C.line;
  ctx.fillRect(88, 455, W - 176, 2);
  if (data.nextRank) {
    text(ctx, `Next rank: ${data.nextRank.name}`, 88, 494, { size: 22, color: C.muted });
    text(ctx, `${data.xp} / ${data.nextRank.min} XP`, W - 88, 494, { size: 22, weight: 700, color: C.muted, align: 'right' });
    ctx.fillStyle = C.wash;
    roundRect(ctx, 88, 508, W - 176, 12, 6);
    ctx.fill();
    ctx.fillStyle = C.blue;
    roundRect(ctx, 88, 508, Math.max(12, (W - 176) * Math.min(1, data.xp / data.nextRank.min)), 12, 6);
    ctx.fill();
  } else {
    text(ctx, `Top rank reached with ${data.xp} XP`, 88, 502, { size: 24, weight: 700, color: C.good });
  }

  // footer strip
  text(ctx, 'A 3D browser game that teaches real IT support skills', 48, H - 30, { size: 24, color: C.muted });
  return canvas.toDataURL('image/png');
}

// ---------- completion certificate: 1600 x 1131 (A4 landscape shape) ----------

/**
 * data: { name, rankName, solved, firstTryRate, shifts, mastered, date }
 * Returns a PNG data URL.
 */
/**
 * A short ID printed on the certificate, made from its own details (name, date, numbers).
 * The same details always give the same ID. It labels the image; it is not a record kept anywhere.
 */
export function certificateId({ name, date, solved, firstTryRate, shifts }) {
  const d = date instanceof Date ? date : new Date(date);
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  let h = 0x811c9dc5; // FNV-1a
  for (const ch of `${name}|${day}|${solved}|${firstTryRate}|${shifts}`) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `HDH-${day}-${h.toString(16).toUpperCase().padStart(8, '0').slice(0, 6)}`;
}

export const CERT_SIGNER = { signature: 'A. Mohyuddin', caption: 'Ahtisham Mohyuddin, creator of Help Desk Hero' };
const SCRIPT_FONT = '"Dancing Script", "Segoe Script", "Brush Script MT", cursive';


const SERIF = '"Cormorant Garamond", Georgia, "Times New Roman", serif';

function serif(ctx, value, x, y, { size = 40, weight = 600, italic = false, color = C.ink, align = 'center', maxWidth, spacing } = {}) {
  ctx.save();
  const font = (s) => `${italic ? 'italic ' : ''}${weight} ${s}px ${SERIF}`;
  ctx.font = font(size);
  if (spacing && 'letterSpacing' in ctx) ctx.letterSpacing = spacing;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  if (maxWidth) {
    let s = size;
    while (s > 14 && ctx.measureText(value).width > maxWidth) {
      s -= 2;
      ctx.font = font(s);
    }
  }
  ctx.fillText(value, x, y);
  ctx.restore();
}

// A plain embossed-style seal: navy disc, gold rings, monogram and text around the edge.
function seal(ctx, x, y) {
  const navy = '#1c2b45';
  const gold = '#b8892d';
  ctx.save();
  ctx.fillStyle = navy;
  ctx.beginPath();
  ctx.arc(x, y, 74, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 66, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 44, 0, Math.PI * 2);
  ctx.stroke();
  // words around the ring
  const words = '• HELP DESK HERO • COMPLETED ';
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = '#e9d39b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const step = (Math.PI * 2) / words.length;
  for (let i = 0; i < words.length; i++) {
    const a = -Math.PI / 2 + i * step;
    ctx.save();
    ctx.translate(x + Math.cos(a) * 55, y + Math.sin(a) * 55);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(words[i], 0, 0);
    ctx.restore();
  }
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
  serif(ctx, 'HDH', x, y + 12, { size: 34, weight: 700, color: '#e9d39b' });
}

/**
 * The completion certificate (1600 x 1131, A4 landscape shape). Returns a PNG data URL.
 * A plain, formal design: serif type, thin navy and gold rules, no cartoon logo.
 * data: { name, rankName, solved, firstTryRate, shifts, mastered, date }
 */
export async function drawCertificate(data) {
  await fontsReady();
  try {
    await Promise.all([
      document.fonts.load(`600 60px ${SCRIPT_FONT}`),
      document.fonts.load(`600 60px ${SERIF}`),
      document.fonts.load(`700 60px ${SERIF}`),
      document.fonts.load(`italic 500 40px ${SERIF}`),
    ]);
  } catch {
    /* fallback fonts are fine */
  }
  const W = 1600;
  const H = 1131;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const cx = W / 2;
  const navy = '#1c2b45';
  const gold = '#b8892d';

  ctx.fillStyle = '#fdfcf8';
  ctx.fillRect(0, 0, W, H);

  // border: a solid navy rule, a thin gold rule inside it, and small corner brackets
  ctx.strokeStyle = navy;
  ctx.lineWidth = 6;
  ctx.strokeRect(44, 44, W - 88, H - 88);
  ctx.strokeStyle = gold;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(62, 62, W - 124, H - 124);
  ctx.strokeStyle = gold;
  ctx.lineWidth = 3;
  for (const [x, y, dx, dy] of [[78, 78, 1, 1], [W - 78, 78, -1, 1], [78, H - 78, 1, -1], [W - 78, H - 78, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * 46);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * 46, y);
    ctx.stroke();
  }

  // header
  ctx.save();
  ctx.font = `700 22px ${FONT}`;
  ctx.fillStyle = navy;
  ctx.textAlign = 'center';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '8px';
  ctx.fillText('HELP DESK HERO', cx, 168);
  ctx.restore();
  ctx.fillStyle = gold;
  ctx.fillRect(cx - 200, 192, 140, 1.5);
  ctx.fillRect(cx + 60, 192, 140, 1.5);
  ctx.save();
  ctx.translate(cx, 192.75);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-5, -5, 10, 10);
  ctx.restore();

  serif(ctx, 'Certificate of Completion', cx, 300, { size: 92, weight: 600, color: navy });
  serif(ctx, 'This is to certify that', cx, 392, { size: 36, weight: 500, italic: true, color: C.muted });

  serif(ctx, data.name, cx, 500, { size: 96, weight: 700, color: navy, maxWidth: W - 380 });
  ctx.fillStyle = gold;
  ctx.fillRect(cx - 360, 528, 720, 1.5);

  text(ctx, 'has completed the Help Desk Hero IT support training game and achieved the rank of', cx, 596, { size: 26, color: C.ink, align: 'center', maxWidth: W - 360 });
  serif(ctx, data.rankName, cx, 664, { size: 54, weight: 700, color: navy });

  const facts = [
    `${data.solved} tickets solved`,
    `${data.firstTryRate}% right first time`,
    `${data.shifts} shift${data.shifts === 1 ? '' : 's'} worked`,
    `${data.mastered} topic${data.mastered === 1 ? '' : 's'} mastered`,
  ].join('     |     ');
  serif(ctx, facts, cx, 736, { size: 28, weight: 600, color: C.muted, maxWidth: W - 360 });

  // date, seal, signature
  const rowY = 900;
  serif(ctx, formatDate(data.date), 340, rowY, { size: 34, weight: 700, color: navy });
  ctx.fillStyle = navy;
  ctx.fillRect(200, rowY + 16, 280, 1.5);
  text(ctx, 'Date', 340, rowY + 48, { size: 20, color: C.muted, align: 'center' });

  seal(ctx, cx, rowY - 6);

  ctx.font = `600 54px ${SCRIPT_FONT}`;
  ctx.fillStyle = navy;
  ctx.textAlign = 'center';
  ctx.fillText(CERT_SIGNER.signature, W - 340, rowY + 2);
  ctx.fillStyle = navy;
  ctx.fillRect(W - 490, rowY + 16, 300, 1.5);
  text(ctx, CERT_SIGNER.caption, W - 340, rowY + 48, { size: 18, color: C.muted, align: 'center', maxWidth: 340 });

  serif(ctx, `Certificate ID: ${certificateId(data)}`, cx, 1010, { size: 22, weight: 600, color: C.muted });
  text(ctx, DISCLAIMER, cx, 1040, { size: 20, weight: 700, color: C.muted, align: 'center' });
  return canvas.toDataURL('image/png');
}

// ---------- daily challenge card: 1200 x 627 ----------

/**
 * data: { dateLabel, correct, total, seconds, marks: [true/false], streak }
 * Squares show right and wrong without giving any answer away. Returns a PNG data URL.
 */
export async function drawDailyCard(data) {
  await fontsReady();
  const W = 1200;
  const H = 627;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1f2a37';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2b3a4d';
  ctx.beginPath();
  ctx.arc(W - 120, 110, 220, 0, Math.PI * 2);
  ctx.fill();

  logoMark(ctx, 72, 64, 56);
  text(ctx, 'HELP DESK HERO', 144, 102, { size: 22, weight: 700, color: '#8fb4ff' });
  text(ctx, 'Daily challenge', 72, 200, { size: 60, weight: 700, color: '#ffffff' });
  text(ctx, data.dateLabel, 72, 248, { size: 28, color: '#c3cfdb' });

  // one square per ticket
  const size = 110;
  const gap = 22;
  const startX = 72;
  data.marks.forEach((ok, i) => {
    ctx.fillStyle = ok ? '#1f9d55' : '#d93b40';
    roundRect(ctx, startX + i * (size + gap), 300, size, size, 18);
    ctx.fill();
    text(ctx, ok ? '✓' : '✕', startX + i * (size + gap) + size / 2, 300 + size / 2 + 22, { size: 60, weight: 700, color: '#ffffff', align: 'center' });
  });

  text(ctx, `${data.correct}/${data.total}`, 72, 520, { size: 72, weight: 700, color: '#ffffff' });
  text(ctx, `right in ${clockTime(data.seconds)}`, 250, 520, { size: 34, color: '#c3cfdb' });
  if (data.streak > 1) text(ctx, `${data.streak} days in a row`, W - 72, 520, { size: 34, weight: 700, color: '#ffd43b', align: 'right' });
  text(ctx, 'A 3D browser game that teaches real IT support skills', 72, H - 40, { size: 24, color: '#8a97a5' });
  return canvas.toDataURL('image/png');
}
