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
export async function drawCertificate(data) {
  await fontsReady();
  const W = 1600;
  const H = 1131;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const cx = W / 2;

  ctx.fillStyle = '#fffdf8';
  ctx.fillRect(0, 0, W, H);
  // double border
  ctx.strokeStyle = C.blue;
  ctx.lineWidth = 10;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = '#b9cdf6';
  ctx.lineWidth = 3;
  ctx.strokeRect(66, 66, W - 132, H - 132);

  logoMark(ctx, cx - 40, 120, 80);
  text(ctx, 'HELP DESK HERO', cx, 248, { size: 30, weight: 700, color: C.blue, align: 'center' });
  text(ctx, 'Certificate of Completion', cx, 345, { size: 76, weight: 700, align: 'center' });
  text(ctx, 'This is to certify that', cx, 430, { size: 32, color: C.muted, align: 'center' });

  text(ctx, data.name, cx, 535, { size: 84, weight: 700, color: C.ink, align: 'center', maxWidth: W - 300 });
  ctx.fillStyle = C.gold;
  ctx.fillRect(cx - 360, 566, 720, 3);

  text(ctx, 'completed the Help Desk Hero training game and reached the rank of', cx, 640, { size: 32, align: 'center', maxWidth: W - 300 });
  text(ctx, data.rankName, cx, 700, { size: 44, weight: 700, color: C.blue, align: 'center' });

  const facts = [
    `${data.solved} tickets solved`,
    `${data.firstTryRate}% right first time`,
    `${data.shifts} shift${data.shifts === 1 ? '' : 's'} worked`,
    `${data.mastered} topic${data.mastered === 1 ? '' : 's'} mastered`,
  ].join('   ·   ');
  text(ctx, facts, cx, 790, { size: 28, color: C.muted, align: 'center', maxWidth: W - 300 });

  text(ctx, formatDate(data.date), 260, 920, { size: 30, weight: 700, align: 'center' });
  ctx.fillStyle = C.line;
  ctx.fillRect(140, 940, 240, 2);
  text(ctx, 'Date', 260, 975, { size: 24, color: C.muted, align: 'center' });

  // seal
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.arc(W - 260, 920, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(W - 260, 920, 58, 0, Math.PI * 2);
  ctx.stroke();
  text(ctx, 'GAME', W - 260, 914, { size: 20, weight: 700, color: '#fff', align: 'center' });
  text(ctx, 'COMPLETE', W - 260, 938, { size: 16, weight: 700, color: '#fff', align: 'center' });

  text(ctx, DISCLAIMER, cx, 1030, { size: 26, weight: 700, color: C.muted, align: 'center' });
  return canvas.toDataURL('image/png');
}
