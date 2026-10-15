// Close-up views for hands-on tickets, drawn as SVG inside the ticket window.
// Everything you can click has data-part (desk) or data-spare (switch).
// The look comes from readings(sim), so lights always match the kit.

import { PARTS, printerReadings, readings, SPARE_PORTS, SWITCH_PORTS } from './handson.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const CABLE = '#2a2f36';
const GREEN = '#33d17a';
const DARK_LED = '#4a525c';

/**
 * A plug at the end of a cable. When loose, it is drawn pulled away from the port
 * (dx, dy) with a gap, which is the clue the player looks for.
 */
function plug(part, x, y, state, looked, { dx = 0, dy = 18, w = 16, h = 12, label, lx, ly, anchor = 'middle' } = {}) {
  const out = state === 'loose' || state === 'out';
  const px = out ? x + dx : x;
  const py = out ? y + dy : y;
  const tick = looked ? `<circle cx="${px + w / 2 + 6}" cy="${py - h / 2 - 4}" r="5" fill="#1f9d55"/><path d="M${px + w / 2 + 3.5} ${py - h / 2 - 4} l2 2 l3.5 -4" stroke="#fff" stroke-width="1.6" fill="none"/>` : '';
  return `<g class="part" data-part="${part}" tabindex="0" role="button" aria-label="Check the ${esc(PARTS[part])}">
      <title>Check the ${esc(PARTS[part])}</title>
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
  const screenWords = { picture: 'showing the desktop', 'no-signal': 'on, showing "No Signal"', off: 'dark, power light off' };
  return [
    `Power strip: ${r.stripOn ? 'on' : 'off'}`,
    `PC power light: ${r.pcOn ? 'on' : 'off'}`,
    `Monitor: ${screenWords[r.screen]}`,
    `Network light on the PC: ${r.link ? 'blinking' : 'off'}`,
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
  const words = r.screen.split('. ');
  const screenText = words.map((w, i) => `<text x="310" y="${88 + i * 13}" text-anchor="middle" class="screen-text">${esc(w)}</text>`).join('');

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
    ? `${pPart('cartridge', p.tonerLow && sim.carrying === 'toner' ? 'Put in the new toner cartridge' : 'Put the toner cartridge back', `<rect x="420" y="250" width="140" height="28" rx="4" fill="#11161c" stroke="#5b6b7c"/><text x="490" y="269" text-anchor="middle" class="tiny light">${p.tonerLow ? 'Toner: 3% left' : 'Toner cartridge'}</text>`, [414, 244, 152, 40])}
       ${p.seal ? pPart('seal', 'Pull out the protective seal', '<rect x="560" y="256" width="30" height="16" rx="3" fill="#ff8a1f"/><text x="575" y="290" text-anchor="middle" class="tiny strong">seal</text>', [554, 248, 42, 46]) : ''}
       <text x="490" y="240" text-anchor="middle" class="lbl">Taken out</text>`
    : '';
  const carrying = sim.carrying === 'toner'
    ? '<rect x="420" y="214" width="60" height="14" rx="3" fill="#11161c"/><text x="488" y="225" class="tiny">You have a new toner cartridge</text>'
    : '';

  return `<svg class="station" viewBox="0 0 600 310" role="img" aria-label="The shared printer">
    <rect x="0" y="0" width="600" height="310" rx="12" fill="#e9edf2"/>
    <!-- body -->
    <rect x="40" y="34" width="340" height="24" rx="6" fill="#c9d1da"/>
    <rect x="40" y="56" width="340" height="244" rx="8" fill="#eceff2" stroke="#b7c2cd"/>
    <rect x="70" y="62" width="160" height="10" rx="3" fill="#b7c2cd"/>
    ${testPage(sim.testPage)}
    <!-- control panel -->
    <rect x="252" y="70" width="116" height="104" rx="6" fill="#2b313a"/>
    <rect x="260" y="76" width="100" height="32" rx="3" fill="${r.powered ? '#cdeccf' : '#151a20'}"/>
    ${screenText}
    ${pPart('power', r.powered ? 'Switch the printer off' : 'Switch the printer on', `<circle cx="274" cy="130" r="11" fill="#11161c" stroke="#5b6b7c"/><circle cx="274" cy="130" r="4" fill="${r.powered ? '#33d17a' : '#4a525c'}"/>`, [260, 116, 28, 28])}
    <text x="274" y="160" text-anchor="middle" class="tiny light">power</text>
    ${pPart('test', 'Print a test page', '<rect x="296" y="118" width="64" height="20" rx="4" fill="#4b5563"/><text x="328" y="132" text-anchor="middle" class="tiny light">Test page</text>', [292, 114, 72, 28])}
    ${pPart('clean', 'Run the cleaning routine', '<rect x="296" y="144" width="64" height="20" rx="4" fill="#4b5563"/><text x="328" y="158" text-anchor="middle" class="tiny light">Cleaning</text>', [292, 140, 72, 28])}
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
  const page = { good: 'clean', faint: 'very faint', streaks: 'streaky', blank: 'blank' };
  return [
    `Screen: ${r.powered ? r.screen : 'off'}`,
    `Network light: ${r.online ? 'blinking' : 'off'}`,
    `Front door: ${sim.printer.door}`,
    `Last test page: ${sim.testPage ? page[sim.testPage] : 'none yet'}`,
  ];
}
