// Close-up views for hands-on tickets, drawn as SVG inside the ticket window.
// Everything you can click has data-part (desk) or data-spare (switch).
// The look comes from readings(sim), so lights always match the kit.

import {
  DISPLAY_MODES, ITEM_NAMES, ITEMS, LAPTOP_PARTS, laptopReadings, PARTS, printerReadings, readings, SPARE_PORTS, SWITCH_PORTS,
} from './handson.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const CABLE = '#2a2f36';

/**
 * Text that always fits its box: wraps onto up to maxLines lines, then squeezes the
 * longest line if it is still too wide. Widths are estimated from the font size,
 * so nothing ever runs outside a screen or label.
 */
export function fitText(text, x, y, maxWidth, { size = 11, lineHeight = size + 2, cls = 'tiny', anchor = 'middle', maxLines = 3, weight = 400 } = {}) {
  const charW = size * (weight >= 700 ? 0.6 : 0.55);
  const perLine = Math.max(4, Math.floor(maxWidth / charW));
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > perLine && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) lines.splice(maxLines - 1, lines.length, lines.slice(maxLines - 1).join(' '));
  const top = y - ((lines.length - 1) * lineHeight) / 2;
  return lines
    .map((l, i) => {
      const squeeze = l.length * charW > maxWidth ? ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"` : '';
      return `<text x="${x}" y="${top + i * lineHeight}" text-anchor="${anchor}" class="${cls}" style="font-size:${size}px"${squeeze}>${esc(l)}</text>`;
    })
    .join('');
}
const GREEN = '#33d17a';
const DARK_LED = '#4a525c';

/**
 * A plug at the end of a cable. When loose, it is drawn pulled away from the port
 * (dx, dy) with a gap, which is the clue the player looks for.
 */
function plug(part, x, y, state, looked, { dx = 0, dy = 18, w = 16, h = 12, label, lx, ly, anchor = 'middle', name } = {}) {
  const partName = name ?? PARTS[part];
  const out = state === 'loose' || state === 'out';
  const px = out ? x + dx : x;
  const py = out ? y + dy : y;
  const tick = looked ? `<circle cx="${px + w / 2 + 6}" cy="${py - h / 2 - 4}" r="5" fill="#1f9d55"/><path d="M${px + w / 2 + 3.5} ${py - h / 2 - 4} l2 2 l3.5 -4" stroke="#fff" stroke-width="1.6" fill="none"/>` : '';
  return `<g class="part" data-part="${part}" tabindex="0" role="button" aria-label="Check the ${esc(partName)}">
      <title>Check the ${esc(partName)}</title>
      <rect x="${px - w / 2 - 8}" y="${py - h / 2 - 8}" width="${w + 16}" height="${h + 16}" rx="6" class="hit"/>
      <rect x="${px - w / 2}" y="${py - h / 2}" width="${w}" height="${h}" rx="2" fill="#11161c" stroke="#8a97a5" stroke-width="1.2"/>
      ${tick}
      ${label ? `<text x="${lx ?? x}" y="${ly ?? y + 30}" text-anchor="${anchor}" class="lbl">${esc(label)}</text>` : ''}
    </g>`;
}

/** A cable from (x1, y1) to a plug at (x2, y2); follows the plug when it is pulled out. */
function cable(x1, y1, x2, y2, state, { dx = 0, dy = 18, bend = 40 } = {}) {
  const out = state === 'loose' || state === 'out';
  const ex = out ? x2 + dx : x2;
  const ey = out ? y2 + dy : y2;
  return `<path class="cable" d="M${x1} ${y1} C ${x1} ${y1 + bend}, ${ex} ${ey + bend}, ${ex} ${ey}" stroke="${CABLE}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
}

function led(x, y, on, { blink = false, color = GREEN } = {}) {
  return `<circle cx="${x}" cy="${y}" r="5" fill="${on ? color : DARK_LED}" class="${on && blink ? 'blink' : ''}"/>`;
}

function screen(r) {
  if (r.screen === 'picture') {
    return `<rect x="34" y="34" width="182" height="112" fill="#7fb8f0"/>
      <rect x="44" y="44" width="20" height="16" fill="#fff" opacity="0.85"/><rect x="44" y="68" width="20" height="16" fill="#fff" opacity="0.85"/>
      <rect x="90" y="56" width="100" height="62" fill="#fff" opacity="0.92"/><rect x="90" y="56" width="100" height="10" fill="#2f6feb"/>
      <rect x="34" y="136" width="182" height="10" fill="#1f2a37" opacity="0.8"/>`;
  }
  if (r.screen === 'no-signal') {
    return `<rect x="34" y="34" width="182" height="112" fill="#05080b"/>
      <rect x="78" y="76" width="94" height="28" fill="#1b2430" stroke="#5b6b7c"/>
      <text x="125" y="95" text-anchor="middle" class="nosignal">No Signal</text>`;
  }
  return '<rect x="34" y="34" width="182" height="112" fill="#020304"/>';
}

/** The desk: monitor, back of the PC, power strip, wall network port, keyboard and mouse. */
export function deskSvg(sim) {
  const d = sim.desk;
  const r = readings(sim);
  const L = sim.looked;
  // Ports on the back of the PC (x, y). Labels sit to the right of each port.
  const P = { power: [312, 64], video: [312, 120], net: [312, 176], kbd: [302, 232], mouse: [328, 232] };
  return `<svg class="station" viewBox="0 0 600 320" role="img" aria-label="Desk ${sim.deskNumber}: monitor, back of the PC, power strip and network wall port">
    <rect x="0" y="0" width="600" height="320" rx="12" fill="#e9edf2"/>
    <rect x="0" y="286" width="600" height="34" fill="#d8c6a6"/>

    <!-- monitor -->
    <rect x="22" y="22" width="206" height="136" rx="8" fill="#1f252d"/>
    ${screen(r)}
    ${led(214, 151, r.monitorOn)}
    <rect x="112" y="158" width="26" height="20" fill="#1f252d"/><rect x="84" y="176" width="82" height="7" rx="3" fill="#1f252d"/>

    <!-- power strip -->
    <rect x="20" y="292" width="214" height="22" rx="5" fill="#f4f4f4" stroke="#b7c2cd"/>
    ${[96, 140, 184].map((x) => `<rect x="${x - 7}" y="298" width="14" height="10" rx="2" fill="#cfd6de"/>`).join('')}

    <!-- PC back panel -->
    <rect x="282" y="18" width="134" height="262" rx="8" fill="#3a4450"/>
    <text x="349" y="38" text-anchor="middle" class="lbl light">Back of PC</text>
    ${led(398, 64, r.pcOn, { color: '#5aa9ff' })}
    <rect x="${P.power[0] - 13}" y="${P.power[1] - 9}" width="26" height="18" rx="2" fill="#11161c"/>
    <rect x="${P.video[0] - 17}" y="${P.video[1] - 7}" width="34" height="14" rx="2" fill="#11161c"/>
    <rect x="${P.net[0] - 9}" y="${P.net[1] - 8}" width="18" height="16" rx="2" fill="#11161c"/>
    ${led(398, P.net[1], r.link, { blink: true, color: '#ffb02e' })}
    <rect x="${P.kbd[0] - 8}" y="${P.kbd[1] - 5}" width="16" height="10" rx="1" fill="#11161c"/>
    <rect x="${P.mouse[0] - 8}" y="${P.mouse[1] - 5}" width="16" height="10" rx="1" fill="#11161c"/>
    <text x="340" y="${P.power[1] + 4}" class="tiny light">Power</text>
    <text x="340" y="${P.video[1] + 4}" class="tiny light">Video</text>
    <text x="340" y="${P.net[1] + 4}" class="tiny light">Network</text>
    <text x="348" y="${P.kbd[1] + 4}" class="tiny light">USB</text>

    <!-- wall network port -->
    <rect x="478" y="56" width="74" height="84" rx="6" fill="#fafafa" stroke="#b7c2cd"/>
    <rect x="506" y="88" width="18" height="16" rx="2" fill="#11161c"/>
    <text x="515" y="156" text-anchor="middle" class="lbl">Wall port</text>

    <!-- keyboard and mouse -->
    <rect x="430" y="238" width="128" height="38" rx="6" fill="#2b313a"/>
    ${Array.from({ length: 8 }, (_, i) => `<rect x="${438 + i * 14.5}" y="246" width="10" height="8" rx="1" fill="#4b5563"/>`).join('')}
    <rect x="452" y="260" width="84" height="8" rx="1" fill="#4b5563"/>
    <ellipse cx="578" cy="232" rx="12" ry="18" fill="#2b313a"/>

    <!-- cables first, so plugs sit on top -->
    ${cable(140, 300, P.power[0], P.power[1], d.pcPower, { bend: 70 })}
    ${cable(96, 300, 60, 168, d.monitorPower, { bend: -40 })}
    ${cable(228, 110, P.video[0], P.video[1], d.videoCable, { bend: 0 })}
    ${cable(515, 96, P.net[0], P.net[1], 'in', { bend: 70 })}
    ${cable(470, 240, P.kbd[0], P.kbd[1], d.keyboard, { bend: 40 })}
    ${cable(578, 214, P.mouse[0], P.mouse[1], d.mouse, { bend: 60 })}

    <!-- power strip switch (on top of the cables) -->
    <g class="part" data-part="powerStrip" tabindex="0" role="button" aria-label="Flip the power strip switch">
      <title>Flip the power strip switch</title>
      <rect x="22" y="288" width="44" height="30" rx="6" class="hit"/>
      <rect x="32" y="296" width="24" height="14" rx="3" fill="${r.stripOn ? '#e5484d' : '#6b7280'}" ${r.stripOn ? 'class="glow"' : ''}/>
      ${L.powerStrip ? '<circle cx="64" cy="290" r="5" fill="#1f9d55"/>' : ''}
    </g>
    <text x="244" y="306" class="lbl">Power strip: ${r.stripOn ? 'on' : 'off'}</text>

    ${plug('pcPower', P.power[0], P.power[1], d.pcPower, L.pcPower, { w: 22, h: 14 })}
    ${plug('monitorPower', 60, 168, d.monitorPower, L.monitorPower, { w: 16, h: 12, label: 'Monitor power', lx: 22, ly: 210, anchor: 'start' })}
    ${plug('videoCable', P.video[0], P.video[1], d.videoCable, L.videoCable, { w: 30, h: 12 })}
    ${plug('netPc', P.net[0], P.net[1], d.netPc, L.netPc, { w: 16, h: 14 })}
    ${plug('netWall', 515, 96, d.netWall, L.netWall, { w: 16, h: 14 })}
    ${plug('keyboard', P.kbd[0], P.kbd[1], d.keyboard, L.keyboard, { w: 14, h: 9 })}
    ${plug('mouse', P.mouse[0], P.mouse[1], d.mouse, L.mouse, { w: 14, h: 9 })}
  </svg>`;
}

/** The switch in the server room: one port per desk, two spares. */
export function switchSvg(sim) {
  const r = readings(sim);
  const W = 600;
  const portW = 40;
  const startX = (W - SWITCH_PORTS * portW) / 2;
  const ports = [];
  for (let n = 1; n <= SWITCH_PORTS; n++) {
    const x = startX + (n - 1) * portW + portW / 2;
    const spare = SPARE_PORTS.includes(n);
    const mine = n === sim.port.number;
    let cableIn;
    let lit;
    if (mine) {
      cableIn = sim.port.movedTo === null;
      lit = r.deskPortLit;
    } else if (spare) {
      cableIn = sim.port.movedTo === n;
      lit = cableIn && r.sparePortLit;
    } else {
      cableIn = true; // other desks, all working
      lit = true;
    }
    const canMove = spare && sim.port.movedTo === null;
    const body = `
      ${led(x, 70, lit, { blink: true })}
      <rect x="${x - 13}" y="84" width="26" height="22" rx="2" fill="#0d1116" stroke="${mine ? '#ffb02e' : '#55606c'}" stroke-width="${mine ? 2.5 : 1}"/>
      ${cableIn ? `<rect x="${x - 9}" y="88" width="18" height="16" rx="1" fill="${mine || (spare && cableIn) ? '#2f6feb' : '#7b8794'}"/><path d="M${x} 104 L${x} 150" stroke="${mine || (spare && cableIn) ? '#2f6feb' : '#7b8794'}" stroke-width="5"/>` : ''}
      <text x="${x}" y="${cableIn ? 168 : 128}" text-anchor="middle" class="tiny${mine ? ' strong' : ''}">${spare ? 'Spare' : `Desk ${n}`}</text>
      <text x="${x}" y="56" text-anchor="middle" class="tiny light">${n}</text>`;
    ports.push(
      canMove
        ? `<g class="part" data-spare="${n}" tabindex="0" role="button" aria-label="Move Desk ${sim.deskNumber}'s cable to spare port ${n}"><title>Move Desk ${sim.deskNumber}'s cable here</title><rect x="${x - 19}" y="58" width="38" height="56" rx="6" class="hit"/>${body}</g>`
        : body,
    );
  }
  return `<svg class="station" viewBox="0 0 600 190" role="img" aria-label="Network switch in the server room">
    <rect x="0" y="0" width="600" height="190" rx="12" fill="#2a3038"/>
    <rect x="${startX - 16}" y="40" width="${SWITCH_PORTS * portW + 32}" height="80" rx="6" fill="#3b4552" stroke="#566273"/>
    <text x="${startX - 4}" y="34" class="lbl light">Network switch</text>
    ${ports.join('')}
  </svg>`;
}

/** Plain-text list of what the lights say (for screen readers, and as a quick summary). */
export function deskSummary(sim) {
  const r = readings(sim);
  const screen = { picture: 'Desktop', 'no-signal': 'No Signal', off: 'Off' };
  return [
    { label: 'Power strip', value: r.stripOn ? 'On' : 'Off', ok: r.stripOn },
    { label: 'PC', value: r.pcOn ? 'On' : 'Off', ok: r.pcOn },
    { label: 'Monitor', value: screen[r.screen], ok: r.screen === 'picture' },
    { label: 'Network light', value: r.link ? 'Blinking' : 'Off', ok: r.link },
  ];
}

// ---------- the printer ----------

/** A clickable printer part. */
function pPart(action, label, inner, hit) {
  return `<g class="part" data-printer="${action}" tabindex="0" role="button" aria-label="${esc(label)}"><title>${esc(label)}</title>
    <rect x="${hit[0]}" y="${hit[1]}" width="${hit[2]}" height="${hit[3]}" rx="6" class="hit"/>${inner}</g>`;
}

/** The last test page, sticking out of the output tray. */
function testPage(quality) {
  if (!quality) return '';
  const lines = [];
  for (let i = 0; i < 6; i++) {
    const color = quality === 'faint' ? '#d9dee4' : '#3b4552';
    if (quality !== 'blank') lines.push(`<rect x="${98}" y="${30 + i * 9}" width="${i % 3 === 2 ? 40 : 64}" height="3" fill="${color}"/>`);
  }
  const streaks = quality === 'streaks'
    ? '<rect x="112" y="24" width="3" height="60" fill="#7b8794" opacity="0.7"/><rect x="141" y="24" width="2" height="60" fill="#7b8794" opacity="0.6"/>'
    : '';
  return `<rect x="90" y="22" width="80" height="62" fill="#fff" stroke="#cfd6de"/>${lines.join('')}${streaks}
    <text x="130" y="16" text-anchor="middle" class="tiny">Last test page</text>`;
}

/** Front of the shared printer, its back panel, and the toner cartridge when it is out. */
export function printerSvg(sim) {
  const p = sim.printer;
  const r = printerReadings(sim);
  const open = p.door === 'open';
  const screenText = r.screen ? fitText(r.screen.replace(/\. /g, '. '), 310, 95, 92, { size: 10, lineHeight: 11, cls: 'screen-text', weight: 700 }) : '';

  const interior = open
    ? `<rect x="60" y="130" width="180" height="150" rx="4" fill="#1f252d"/>
       <path d="M70 236 L230 236" stroke="#4a525c" stroke-width="3" stroke-dasharray="6 5"/>
       <text x="150" y="272" text-anchor="middle" class="tiny light">paper path</text>
       ${p.cartridge === 'in' ? pPart('cartridge', 'Take out the toner cartridge', `<rect x="80" y="148" width="140" height="30" rx="4" fill="#11161c" stroke="#5b6b7c"/><text x="150" y="168" text-anchor="middle" class="tiny light">Toner cartridge</text>`, [74, 142, 152, 42]) : '<rect x="80" y="148" width="140" height="30" rx="4" fill="none" stroke="#5b6b7c" stroke-dasharray="4 4"/>'}
       ${p.jamSheet ? pPart('sheet', 'Pull out the jammed sheet', '<path d="M96 222 L196 214 L204 248 L104 256 Z" fill="#fafafa" stroke="#cfd6de"/><path d="M110 232 l70 -5 M112 240 l70 -5" stroke="#cfd6de"/>', [90, 208, 120, 54]) : ''}
       ${!p.jamSheet && p.jamScrap ? pPart('scrap', 'Remove the torn scrap of paper', '<path d="M168 228 l12 -4 l4 9 l-6 3 l3 6 l-11 2 Z" fill="#fafafa" stroke="#cfd6de"/>', [158, 216, 34, 32]) : ''}
       ${pPart('door', 'Close the front door', '<rect x="60" y="282" width="180" height="14" rx="3" fill="#cfd6de"/><text x="150" y="293" text-anchor="middle" class="tiny">close door</text>', [56, 278, 188, 22])}`
    : pPart('door', 'Open the front door', `<rect x="60" y="130" width="180" height="150" rx="4" fill="#dfe4ea" stroke="#b7c2cd"/>
        <rect x="120" y="140" width="60" height="8" rx="4" fill="#9aa4ae"/><text x="150" y="214" text-anchor="middle" class="lbl">Front door</text>`, [56, 126, 188, 158]);

  const cartridgeOut = p.cartridge === 'out'
    ? `${pPart('cartridge', p.tonerLow && sim.carrying === 'toner' ? 'Put in the new toner cartridge' : 'Put the toner cartridge back', `<rect x="420" y="250" width="140" height="28" rx="4" fill="#11161c" stroke="#5b6b7c"/>${fitText(p.tonerLow ? 'Toner: 3% left' : 'Toner cartridge', 490, 268, 128, { cls: 'tiny light' })}`, [414, 244, 152, 40])}
       ${p.seal ? pPart('seal', 'Pull out the protective seal', '<rect x="560" y="256" width="30" height="16" rx="3" fill="#ff8a1f"/><text x="575" y="290" text-anchor="middle" class="tiny strong">seal</text>', [554, 248, 42, 46]) : ''}
       <text x="490" y="240" text-anchor="middle" class="lbl">Taken out</text>`
    : '';
  const carrying = sim.carrying
    ? `<rect x="414" y="204" width="162" height="28" rx="6" fill="#fff8db"/>${fitText(`Carrying: ${ITEM_NAMES[sim.carrying] ?? sim.carrying}`, 495, 222, 150, { size: 11, weight: 700, cls: 'tiny ink' })}`
    : '';

  return `<svg class="station" viewBox="0 0 600 310" role="img" aria-label="The shared printer">
    <rect x="0" y="0" width="600" height="310" rx="12" fill="#e9edf2"/>
    <!-- body -->
    <rect x="40" y="34" width="340" height="24" rx="6" fill="#c9d1da"/>
    <rect x="40" y="56" width="340" height="244" rx="8" fill="#eceff2" stroke="#b7c2cd"/>
    <rect x="70" y="62" width="160" height="10" rx="3" fill="#b7c2cd"/>
    ${testPage(sim.testPage)}
    <!-- control panel -->
    <rect x="252" y="70" width="116" height="106" rx="6" fill="#2b313a"/>
    <rect x="258" y="76" width="104" height="38" rx="3" fill="${r.powered ? '#cdeccf' : '#151a20'}"/>
    ${screenText}
    ${pPart('power', r.powered ? 'Switch the printer off' : 'Switch the printer on', `<circle cx="274" cy="136" r="11" fill="#11161c" stroke="#5b6b7c"/><circle cx="274" cy="136" r="4" fill="${r.powered ? '#33d17a' : '#4a525c'}"/>`, [260, 122, 28, 28])}
    <text x="274" y="165" text-anchor="middle" class="tiny light">power</text>
    ${pPart('test', 'Print a test page', '<rect x="296" y="122" width="64" height="20" rx="4" fill="#4b5563"/><text x="328" y="136" text-anchor="middle" class="tiny light">Test page</text>', [292, 118, 72, 28])}
    ${pPart('clean', 'Run the cleaning routine', '<rect x="296" y="147" width="64" height="20" rx="4" fill="#4b5563"/><text x="328" y="161" text-anchor="middle" class="tiny light">Cleaning</text>', [292, 143, 72, 28])}
    ${interior}
    <!-- back of the printer -->
    <rect x="410" y="34" width="170" height="160" rx="8" fill="#3a4450"/>
    <text x="495" y="54" text-anchor="middle" class="lbl light">Back of printer</text>
    <rect x="430" y="76" width="26" height="18" rx="2" fill="#11161c"/>
    <path class="cable" d="M443 85 C 443 140, 420 150, 420 194" stroke="#2a2f36" stroke-width="5" fill="none"/>
    <text x="466" y="89" class="tiny light">Power</text>
    <rect x="${505 - 9}" y="${130 - 8}" width="18" height="16" rx="2" fill="#11161c"/>
    ${cable(505, 194, 505, 130, p.net, { bend: -20 })}
    ${led(540, 130, r.online, { blink: true, color: '#ffb02e' })}
    <text x="505" y="170" text-anchor="middle" class="tiny light">Network</text>
    ${pPart('net', 'Check the printer network cable', `<rect x="${505 - 8}" y="${(p.net === 'loose' ? 148 : 130) - 7}" width="16" height="14" rx="2" fill="#11161c" stroke="#8a97a5" stroke-width="1.2"/>${sim.looked.printerNet ? `<circle cx="519" cy="${(p.net === 'loose' ? 148 : 130) - 11}" r="5" fill="#1f9d55"/>` : ''}`, [485, p.net === 'loose' ? 133 : 115, 40, 32])}
    ${carrying}
    ${cartridgeOut}
  </svg>`;
}

export function printerSummary(sim) {
  const r = printerReadings(sim);
  const page = { good: 'Clean', faint: 'Faint', streaks: 'Streaky', blank: 'Blank' };
  return [
    { label: 'Screen', value: r.powered ? r.screen : 'Off', ok: r.screen === 'Ready' },
    { label: 'Network light', value: r.online ? 'Blinking' : 'Off', ok: r.online },
    { label: 'Front door', value: sim.printer.door === 'open' ? 'Open' : 'Closed', ok: sim.printer.door === 'closed' },
    { label: 'Test page', value: sim.testPage ? page[sim.testPage] : 'Not printed', ok: sim.testPage ? sim.testPage === 'good' : null },
  ];
}

// ---------- the parts cabinet ----------

// A simple picture for each item, drawn around (0, 0) in a box about 70 x 40.
const ITEM_ICONS = {
  toner: '<rect x="-34" y="-11" width="68" height="22" rx="4" fill="#11161c"/><rect x="-30" y="-4" width="14" height="8" rx="2" fill="#2f6feb"/>',
  network_cable: '<path d="M-26 6 C -10 -18, 10 18, 26 -6" stroke="#2f6feb" stroke-width="5" fill="none"/><rect x="-34" y="2" width="12" height="10" rx="2" fill="#cfd6de"/><rect x="22" y="-12" width="12" height="10" rx="2" fill="#cfd6de"/>',
  video_cable: '<path d="M-26 6 C -10 -18, 10 18, 26 -6" stroke="#1f252d" stroke-width="5" fill="none"/><rect x="-36" y="1" width="16" height="10" rx="2" fill="#5b6b7c"/><rect x="20" y="-13" width="16" height="10" rx="2" fill="#5b6b7c"/>',
  phone_cable: '<path d="M-26 6 C -10 -18, 10 18, 26 -6" stroke="#9aa4ae" stroke-width="6" fill="none"/><path d="M-26 6 C -10 -18, 10 18, 26 -6" stroke="#ffffff" stroke-width="3" fill="none"/><rect x="-34" y="2" width="10" height="7" rx="2" fill="#9aa4ae"/><rect x="24" y="-10" width="8" height="6" rx="2" fill="#9aa4ae"/>',
  laptop_charger: '<rect x="-18" y="-10" width="36" height="20" rx="4" fill="#1f252d"/><circle cx="10" cy="-3" r="2" fill="#33d17a"/><path d="M18 0 C 30 0, 30 12, 36 12" stroke="#1f252d" stroke-width="3" fill="none"/>',
  dock_cable: '<path d="M-26 6 C -10 -18, 10 18, 26 -6" stroke="#5b6b7c" stroke-width="4" fill="none"/><rect x="-34" y="2" width="11" height="7" rx="3" fill="#1f252d"/><rect x="23" y="-10" width="11" height="7" rx="3" fill="#1f252d"/>',
  usb_keyboard: '<rect x="-34" y="-10" width="68" height="20" rx="3" fill="#2b313a"/><rect x="-28" y="-5" width="56" height="4" fill="#4b5563"/><rect x="-22" y="2" width="44" height="4" fill="#4b5563"/>',
  usb_mouse: '<ellipse cx="0" cy="0" rx="11" ry="15" fill="#2b313a"/><path d="M0 -15 L0 -4" stroke="#4b5563" stroke-width="2"/>',
};

/** The open parts cabinet. carrying: the item in your hands, which is missing from its shelf. */
export function cabinetSvg(carrying) {
  const keys = Object.keys(ITEMS);
  const cols = 3;
  const cellW = 120;
  const cellH = 78;
  const left = 120;
  const top = 34;
  const cells = keys.map((key, i) => {
    const cx = left + (i % cols) * cellW + cellW / 2;
    const cy = top + Math.floor(i / cols) * cellH + 34;
    const taken = carrying === key;
    const label = fitText(ITEMS[key], cx, cy + 32, cellW - 14, { size: 11, cls: 'tiny ink', maxLines: 2, lineHeight: 12 });
    if (taken) {
      return `<rect x="${cx - 40}" y="${cy - 18}" width="80" height="36" rx="6" fill="none" stroke="#9aa4ae" stroke-dasharray="4 4"/>${fitText('(you have it)', cx, cy + 32, cellW - 14, { size: 11, cls: 'tiny' })}`;
    }
    return `<g class="part" data-item="${key}" tabindex="0" role="button" aria-label="Take the ${esc(ITEMS[key].toLowerCase())}"><title>Take the ${esc(ITEMS[key].toLowerCase())}</title>
      <rect x="${cx - 54}" y="${cy - 28}" width="108" height="72" rx="8" class="hit"/>
      <g transform="translate(${cx} ${cy})">${ITEM_ICONS[key] ?? ''}</g>${label}</g>`;
  });
  const rows = Math.ceil(keys.length / cols);
  const shelves = Array.from({ length: rows }, (_, r) => `<rect x="${left - 10}" y="${top + (r + 1) * cellH - 6}" width="${cols * cellW + 20}" height="6" fill="#9aa4ae"/>`).join('');
  const h = top + rows * cellH + 24;
  return `<svg class="station" viewBox="0 0 600 ${h}" role="img" aria-label="The open parts cabinet">
    <rect x="0" y="0" width="600" height="${h}" rx="12" fill="#e9edf2"/>
    <rect x="${left - 18}" y="14" width="${cols * cellW + 36}" height="${h - 24}" rx="6" fill="#4a525c"/>
    <rect x="${left - 10}" y="22" width="${cols * cellW + 20}" height="${h - 40}" fill="#f4f6f8"/>
    <path d="M${left - 18} 14 L${left - 92} 34 L${left - 92} ${h - 30} L${left - 18} ${h - 10} Z" fill="#5b6570"/>
    <path d="M${left + cols * cellW + 18} 14 L${left + cols * cellW + 92} 34 L${left + cols * cellW + 92} ${h - 30} L${left + cols * cellW + 18} ${h - 10} Z" fill="#5b6570"/>
    <rect x="${left - 70}" y="${h / 2 - 12}" width="6" height="24" rx="3" fill="#cfd6de"/><rect x="${left + cols * cellW + 64}" y="${h / 2 - 12}" width="6" height="24" rx="3" fill="#cfd6de"/>
    ${shelves}${cells.join('')}
  </svg>`;
}

// ---------- the laptop desk ----------

/** A clickable laptop-desk part (not a plug). */
function lPart(part, label, inner, hit) {
  return `<g class="part" data-part="${part}" tabindex="0" role="button" aria-label="${esc(label)}"><title>${esc(label)}</title>
    <rect x="${hit[0]}" y="${hit[1]}" width="${hit[2]}" height="${hit[3]}" rx="6" class="hit"/>${inner}</g>`;
}

/** Laptop with charger, dock, second monitor and work phone. */
export function laptopSvg(sim) {
  const l = sim.laptop;
  const r = laptopReadings(sim);
  const L = sim.looked;
  const lift = l.onCushion ? -14 : 0; // the laptop sits higher on a cushion
  const screenFill = r.laptopScreenOn ? '#7fb8f0' : '#05080b';
  const monitorScreen = r.monitor === 'desktop'
    ? '<rect x="382" y="44" width="168" height="98" fill="#7fb8f0"/><rect x="424" y="66" width="84" height="50" fill="#fff" opacity="0.9"/><rect x="424" y="66" width="84" height="8" fill="#2f6feb"/>'
    : `<rect x="382" y="44" width="168" height="98" fill="#05080b"/><rect x="408" y="80" width="116" height="26" fill="#1b2430" stroke="#5b6b7c"/>${fitText(r.monitor, 466, 97, 108, { size: 11, cls: 'nosignal', weight: 700 })}`;
  const battery = `<rect x="198" y="${100 + lift}" width="24" height="12" rx="2" fill="none" stroke="#1f2a37" stroke-width="1.5"/><rect x="200" y="${102 + lift}" width="8" height="8" fill="${r.charging ? '#1f9d55' : '#e5484d'}"/>
    ${r.charging ? `<path d="M213 ${101 + lift} l-4 6 h4 l-3 5" stroke="#1f9d55" stroke-width="1.6" fill="none"/>` : ''}`;
  const heat = r.hot
    ? [0, 1, 2].map((i) => `<path d="M${110 + i * 40} ${80 + lift} q 6 -8 0 -16 q -6 -8 0 -16" stroke="#e5484d" stroke-width="2" fill="none" opacity="0.7"/>`).join('')
    : '';
  const dust = l.dusty
    ? `<circle cx="186" cy="${236 + lift}" r="4" fill="#b0a596"/><circle cx="198" cy="${234 + lift}" r="4.5" fill="#b0a596"/><circle cx="210" cy="${237 + lift}" r="3.5" fill="#b0a596"/>`
    : '';
  return `<svg class="station" viewBox="0 0 600 330" role="img" aria-label="Laptop desk with charger, dock, second monitor and phone">
    <rect x="0" y="0" width="600" height="330" rx="12" fill="#e9edf2"/>
    <rect x="0" y="262" width="600" height="68" fill="#d8c6a6"/>

    <!-- wall socket (laptop charger and phone adapter) -->
    <rect x="8" y="120" width="44" height="86" rx="6" fill="#fafafa" stroke="#b7c2cd"/>
    <circle cx="30" cy="144" r="8" fill="#e9edf2" stroke="#b7c2cd"/><circle cx="30" cy="182" r="8" fill="#e9edf2" stroke="#b7c2cd"/>
    ${fitText('Wall socket', 30, 110, 60, { size: 10, cls: 'tiny' })}

    <!-- cushion, laptop, vent -->
    ${l.onCushion ? lPart('cushion', 'Move the laptop onto the hard desk', '<rect x="64" y="248" width="214" height="26" rx="13" fill="#d98fa0"/>', [60, 244, 222, 34]) : ''}
    ${heat}
    <rect x="86" y="${92 + lift}" width="150" height="128" rx="6" fill="#1f252d"/>
    <rect x="94" y="${100 + lift}" width="134" height="110" fill="${screenFill}"/>
    ${r.laptopScreenOn ? battery : ''}
    <path d="M72 ${222 + lift} L250 ${222 + lift} L266 ${248 + lift} L56 ${248 + lift} Z" fill="#2b313a"/>
    ${lPart('vent', 'Check the laptop vent', `<rect x="176" y="${230 + lift}" width="44" height="12" rx="2" fill="#11161c"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="${180 + i * 8}" y="${232 + lift}" width="4" height="8" fill="#3b4552"/>`).join('')}${dust}`, [170, 224 + lift, 56, 24])}
    ${fitText(r.hot ? 'Fan: loud, laptop hot' : 'Fan: quiet', 161, 40, 180, { size: 12, cls: `tiny ${r.hot ? 'hot' : 'ink'}`, weight: 700 })}

    <!-- laptop charger brick and cables -->
    <rect x="132" y="300" width="46" height="20" rx="4" fill="#1f252d"/>
    ${led(170, 310, r.chargerLight)}
    ${cable(30, 144, 132, 310, 'in', { bend: 60 })}
    ${cable(150, 300, 64, 238 + lift, 'in', { bend: -30 })}
    ${plug('chargerWall', 30, 144, l.chargerWall, L.chargerWall, { dx: 18, dy: 12, w: 16, h: 12, name: LAPTOP_PARTS.chargerWall })}
    ${plug('chargerLaptop', 64, 238 + lift, l.chargerLaptop, L.chargerLaptop, { w: 12, h: 10, name: LAPTOP_PARTS.chargerLaptop })}

    <!-- phone, charging from the power strip -->
    <rect x="432" y="302" width="70" height="24" rx="5" fill="#2b313a"/>
    <rect x="438" y="306" width="52" height="16" rx="2" fill="${r.phoneCharging ? '#1f9d55' : '#3b4552'}"/>
    ${r.phoneCharging ? '<path d="M466 307 l-4 6 h4 l-3 6" stroke="#fff" stroke-width="1.6" fill="none"/>' : ''}
    ${lPart('phonePort', "Look into the phone's charging port", '<rect x="500" y="310" width="8" height="8" rx="1" fill="#11161c"/>', [494, 302, 20, 24])}
    ${lPart('phoneCable', 'Check the phone charging cable', `<path d="M578 304 C 578 330, 530 330, 508 314" stroke="#9aa4ae" stroke-width="6" fill="none"/><path d="M578 304 C 578 330, 530 330, 508 314" stroke="#ffffff" stroke-width="3" fill="none"/>${l.phoneCable === 'damaged' ? '<path d="M532 318 l5 -6 l4 8 l5 -6" stroke="#ff8a1f" stroke-width="3" fill="none"/>' : ''}`, [518, 306, 66, 24])}
    ${fitText('Phone', 467, 296, 60, { size: 10, cls: 'tiny' })}

    <!-- dock and its power adapter -->
    <rect x="320" y="270" width="120" height="26" rx="5" fill="#3b4552"/>
    ${led(428, 283, r.dockLight)}
    ${fitText('Dock', 352, 287, 60, { size: 11, cls: 'tiny light', weight: 700 })}
    <rect x="520" y="300" width="70" height="20" rx="5" fill="#f4f4f4" stroke="#b7c2cd"/>
    ${cable(555, 300, 448, 283, 'in', { bend: -20 })}
    ${plug('dockPower', 448, 283, l.dockPower, L.dockPower, { dx: 24, dy: 6, w: 14, h: 12, name: LAPTOP_PARTS.dockPower })}
    ${fitText('Power strip', 555, 316, 64, { size: 10, cls: 'tiny' })}
    ${cable(330, 283, 274, 236 + lift, 'in', { bend: 20 })}
    ${plug('dockCable', 274, 236 + lift, l.dockCable, L.dockCable, { w: 12, h: 10, name: LAPTOP_PARTS.dockCable })}

    <!-- second monitor, cabled to the dock with DisplayPort -->
    <rect x="372" y="34" width="188" height="118" rx="8" fill="#1f252d"/>
    ${monitorScreen}
    <rect x="452" y="152" width="28" height="22" fill="#1f252d"/>
    ${cable(380, 270, 466, 174, 'in', { bend: -40 })}
    ${fitText('DisplayPort cable', 336, 210, 96, { size: 10, cls: 'tiny' })}
    ${lPart('input', 'Press the monitor input button', `<rect x="528" y="140" width="24" height="9" rx="3" fill="#5b6b7c"/>`, [520, 134, 40, 20])}
    ${fitText(`Input: ${l.monitorInput}`, 520, 190, 110, { size: 11, cls: 'tiny ink', weight: 700 })}
  </svg>`;
}

/** The Windows key + P menu, as buttons under the drawing. */
export function displayModeHtml(sim) {
  return `<div class="winp"><span class="small"><b>Windows key + P</b> on the laptop:</span>
    ${Object.entries(DISPLAY_MODES).map(([k, v]) => `<button class="mode${sim.laptop.displayMode === k ? ' on' : ''}" data-mode="${k}">${esc(v)}</button>`).join('')}</div>`;
}

export function laptopSummary(sim) {
  const r = laptopReadings(sim);
  return [
    { label: 'Battery', value: r.charging ? 'Charging' : 'Not charging', ok: r.charging },
    { label: 'Phone', value: r.phoneCharging ? 'Charging' : 'Not charging', ok: r.phoneCharging },
    { label: 'Dock light', value: r.dockLight ? 'On' : 'Off', ok: r.dockLight },
    { label: '2nd monitor', value: r.monitor === 'desktop' ? 'Desktop' : r.monitor, ok: r.monitor === 'desktop' },
    { label: 'Laptop', value: r.hot ? 'Hot, fan loud' : 'Cool', ok: !r.hot },
  ];
}

/** Status chips: a coloured dot, a label and a value (ok: true green, false red, null grey). */
export function chipsHtml(items) {
  return `<div class="chips">${items
    .map(({ label, value, ok }) => `<span class="schip ${ok === true ? 'ok' : ok === false ? 'bad' : ''}"><span class="dot"></span>${esc(label)}: <b>${esc(value)}</b></span>`)
    .join('')}</div>`;
}
