// Hands-on tickets: a tiny simulation of a desk's kit and the server room switch.
// Pure logic (no browser), tested with Node.
//
// A scenario (from the reviewed problem JSON) lists what is broken, e.g.
// { faults: ["video_cable_loose"], goal: "display" }. The player looks at the kit,
// reseats cables, flips switches or moves a switch port, then asks the person to test.
// Lights and screens come from the state, so the clues are always consistent.

export const SWITCH_PORTS = 12; // ports 1-10 are desks, 11-12 are spares
export const SPARE_PORTS = [11, 12];

// Everything at the desk that can be reseated or switched, with a plain name.
export const PARTS = {
  powerStrip: 'power strip switch',
  pcPower: 'PC power cable',
  monitorPower: 'monitor power cable',
  videoCable: 'video cable',
  netPc: 'network cable at the PC',
  netWall: 'network cable at the wall port',
  keyboard: 'keyboard plug',
  mouse: 'mouse plug',
};

// fault -> the part it breaks and the broken state
const FAULT_PARTS = {
  network_cable_loose: ['netPc', 'loose'],
  wall_cable_loose: ['netWall', 'loose'],
  video_cable_loose: ['videoCable', 'loose'],
  monitor_power_loose: ['monitorPower', 'loose'],
  power_strip_off: ['powerStrip', 'off'],
  pc_power_loose: ['pcPower', 'loose'],
  keyboard_unplugged: ['keyboard', 'out'],
  mouse_unplugged: ['mouse', 'out'],
};

// Printer faults (all break printing). The printer is shared, so its station is at the printer.
const PRINTER_FAULTS = {
  printer_off: 'the printer is switched off',
  printer_network_loose: 'the network cable is loose at the back of the printer',
  paper_jam: 'a sheet is jammed, and a torn scrap stays behind when it is pulled out',
  toner_low: 'the toner cartridge is nearly empty',
  toner_seal_left: 'the protective seal was left in the toner cartridge',
  needs_cleaning: 'the printer needs its cleaning routine',
};

/** Is this a printer scenario (station at the printer) rather than a desk one? */
export const isPrinterScenario = (scenario) => scenario.faults.some((f) => f in PRINTER_FAULTS);

/** A new simulation for one ticket. deskNumber is the person's desk (and switch port). */
export function createSim(scenario, deskNumber) {
  const desk = {
    powerStrip: 'on', pcPower: 'in', monitorPower: 'in', videoCable: 'in',
    netPc: 'in', netWall: 'in', keyboard: 'in', mouse: 'in',
  };
  let portDead = false;
  for (const fault of scenario.faults) {
    if (fault === 'switch_port_dead') portDead = true;
    else if (FAULT_PARTS[fault]) {
      const [part, broken] = FAULT_PARTS[fault];
      desk[part] = broken;
    }
  }
  const has = (f) => scenario.faults.includes(f);
  const printer = isPrinterScenario(scenario)
    ? {
        power: has('printer_off') ? 'off' : 'on',
        net: has('printer_network_loose') ? 'loose' : 'in',
        door: 'closed',
        jamSheet: has('paper_jam'),
        jamScrap: has('paper_jam'),
        cartridge: 'in',
        tonerLow: has('toner_low'),
        seal: has('toner_seal_left'),
        dirty: has('needs_cleaning'),
      }
    : null;
  return {
    goal: scenario.goal,
    required: [...(scenario.required ?? [])],
    deskNumber,
    station: printer ? 'printer' : 'desk',
    printer,
    carrying: null, // e.g. 'toner' after taking a cartridge from the parts cabinet
    testPage: null, // the last printer test page: 'good', 'faint', 'streaks', 'blank'
    desk,
    port: { number: deskNumber, dead: portDead, movedTo: null },
    done: {}, // required actions done, e.g. { report_port: true }
    looked: {}, // parts the player has checked
    serverClue: false, // set once the desk is ruled out for a network fault
  };
}

/** Lights, screens and what works, worked out from the kit. */
export function readings(sim) {
  const d = sim.desk;
  const stripOn = d.powerStrip === 'on';
  const pcOn = stripOn && d.pcPower === 'in';
  const monitorOn = stripOn && d.monitorPower === 'in';
  const screen = !monitorOn ? 'off' : pcOn && d.videoCable === 'in' ? 'picture' : 'no-signal';
  const portOk = sim.port.movedTo !== null || !sim.port.dead;
  const cableOk = d.netPc === 'in' && d.netWall === 'in';
  const link = pcOn && cableOk && portOk;
  return {
    stripOn,
    pcOn,
    monitorOn,
    screen,
    link, // the light next to the network port on the PC
    // Switch lights: the desk's own port, and the spare port if the cable was moved there.
    deskPortLit: pcOn && cableOk && sim.port.movedTo === null && !sim.port.dead,
    sparePortLit: pcOn && cableOk && sim.port.movedTo !== null,
    works: {
      power: pcOn,
      display: screen === 'picture',
      internet: link,
      keyboard: pcOn && d.keyboard === 'in',
      mouse: pcOn && d.mouse === 'in',
    },
  };
}

const plugged = (state) => state === 'in' || state === 'on';

/** Push a cable or plug in firmly. Returns { sim, message, changed }. */
export function reseat(sim, part) {
  const state = sim.desk[part];
  const looked = { ...sim.looked, [part]: true };
  if (part === 'powerStrip') return toggleStrip(sim);
  if (plugged(state)) {
    return { sim: { ...sim, looked }, message: `You check the ${PARTS[part]}. It is already firmly in.`, changed: false };
  }
  return {
    sim: { ...sim, looked, desk: { ...sim.desk, [part]: 'in' } },
    message: `The ${PARTS[part]} was ${state === 'out' ? 'unplugged' : 'loose'}. You push it in firmly until it clicks.`,
    changed: true,
  };
}

function toggleStrip(sim) {
  const on = sim.desk.powerStrip === 'on';
  return {
    sim: { ...sim, looked: { ...sim.looked, powerStrip: true }, desk: { ...sim.desk, powerStrip: on ? 'off' : 'on' } },
    message: on ? 'You switch the power strip off. Everything on it loses power.' : 'You switch the power strip on. Its light comes on.',
    changed: true,
  };
}

/** Move this desk's cable on the switch to a spare port. */
export function moveToSpare(sim, port) {
  if (!SPARE_PORTS.includes(port) || sim.port.movedTo !== null) return { sim, message: '', changed: false };
  const next = { ...sim, port: { ...sim.port, movedTo: port } };
  const lit = readings(next).sparePortLit;
  return {
    sim: next,
    message: `You move Desk ${sim.deskNumber}'s cable from port ${sim.port.number} to spare port ${port}.${lit ? ' Its light comes on.' : ''}`,
    changed: true,
  };
}

/** Write a note for the network team about the faulty port. */
export function reportPort(sim) {
  if (sim.port.movedTo === null) return { sim, message: '', changed: false };
  return {
    sim: { ...sim, done: { ...sim.done, report_port: true } },
    message: `You log a note for the network team: port ${sim.port.number} has no link, Desk ${sim.deskNumber} moved to port ${sim.port.movedTo}.`,
    changed: true,
  };
}

// ---------- the printer ----------

/** What the printer shows and whether it can print. */
export function printerReadings(sim) {
  const p = sim.printer;
  const powered = p.power === 'on';
  const online = powered && p.net === 'in';
  const jammed = p.jamSheet || p.jamScrap;
  let screen;
  if (!powered) screen = '';
  else if (p.door === 'open') screen = 'Front door open';
  else if (jammed) screen = 'Paper jam. Open the front door';
  else if (!online) screen = 'No network connection';
  else if (p.tonerLow) screen = 'Toner low (3%)';
  else screen = 'Ready';
  const canPrint = powered && p.door === 'closed' && !jammed && p.cartridge === 'in';
  const quality = p.seal ? 'blank' : p.tonerLow ? 'faint' : p.dirty ? 'streaks' : 'good';
  return { powered, online, jammed, screen, canPrint, quality, works: online && canPrint && quality === 'good' };
}

const changedPrinter = (sim, patch, message, extra = {}) => ({
  sim: { ...sim, ...extra, printer: { ...sim.printer, ...patch } },
  message,
  changed: true,
});
const same = (sim, message) => ({ sim, message, changed: false });

/** Every printer action, by name. Returns { sim, message, changed }. */
export function printerAction(sim, action) {
  const p = sim.printer;
  const r = printerReadings(sim);
  const looked = (k) => ({ looked: { ...sim.looked, [k]: true } });
  switch (action) {
    case 'power':
      return changedPrinter(sim, { power: r.powered ? 'off' : 'on' }, r.powered ? 'You switch the printer off.' : 'You switch the printer on. It warms up.');
    case 'net':
      if (p.net === 'in') return same({ ...sim, ...looked('printerNet') }, 'You check the network cable at the back of the printer. It is already firmly in.');
      return changedPrinter(sim, { net: 'in' }, 'The network cable at the back of the printer was loose. You push it in until it clicks.', looked('printerNet'));
    case 'door':
      if (p.door === 'open' && p.cartridge === 'out') return same(sim, 'Put the toner cartridge back before closing the door.');
      return changedPrinter(sim, { door: p.door === 'open' ? 'closed' : 'open' }, p.door === 'open' ? 'You close the front door.' : 'You open the front door.');
    case 'sheet':
      if (p.door !== 'open' || !p.jamSheet) return same(sim, '');
      return changedPrinter(sim, { jamSheet: false }, 'You gently pull the jammed sheet out along the paper path. Check that nothing is left inside.');
    case 'scrap':
      if (p.door !== 'open' || p.jamSheet || !p.jamScrap) return same(sim, '');
      return changedPrinter(sim, { jamScrap: false }, 'You remove a small torn scrap of paper that was still stuck inside.');
    case 'cartridge':
      if (p.door !== 'open') return same(sim, '');
      if (p.cartridge === 'in') {
        const note = p.tonerLow
          ? 'It feels very light, and the level shows 3%. You need a new toner cartridge from the parts cabinet.'
          : p.seal
            ? 'An orange protective seal tab is still sticking out of it.'
            : 'It looks fine.';
        return changedPrinter(sim, { cartridge: 'out' }, `You take out the toner cartridge. ${note}`, looked('cartridge'));
      }
      if (p.tonerLow && sim.carrying === 'toner') {
        return changedPrinter(sim, { cartridge: 'in', tonerLow: false }, 'You put in the new toner cartridge. The old one goes in the recycling box.', { carrying: null });
      }
      return changedPrinter(sim, { cartridge: 'in' }, 'You put the toner cartridge back in.');
    case 'seal':
      if (p.cartridge !== 'out' || !p.seal) return same(sim, '');
      return changedPrinter(sim, { seal: false }, 'You pull out the orange protective seal. New cartridges ship with it, and it blocks the toner.');
    case 'clean':
      if (!r.powered) return same(sim, 'The printer is off.');
      if (p.door === 'open') return same(sim, 'Close the front door first.');
      return changedPrinter(sim, { dirty: false }, 'You run the cleaning routine from the printer menu. It takes about a minute.');
    case 'test': {
      if (!r.powered) return same(sim, 'The printer is off, so nothing prints.');
      if (!r.canPrint) return same({ ...sim, testPage: null }, `The test page does not print: the screen says "${r.screen}".`);
      const words = {
        good: 'The test page comes out clean and sharp.',
        faint: 'The test page comes out very light and faded.',
        streaks: 'The test page has streaks running down it. So the fault is in the printer itself, not the document.',
        blank: 'The test page comes out completely blank. So the fault is in the printer itself, not the document or the driver.',
      };
      return { sim: { ...sim, testPage: r.quality }, message: words[r.quality], changed: true };
    }
    default:
      return same(sim, '');
  }
}

/** Take a new toner cartridge from the parts cabinet. */
export function takeToner(sim) {
  if (sim.carrying === 'toner') return same(sim, 'You are already carrying a new toner cartridge.');
  return { sim: { ...sim, carrying: 'toner' }, message: 'You take a new toner cartridge from the parts cabinet.', changed: true };
}

/** Places this ticket needs right now, for markers: 'printer', 'parts_cabinet'. */
export function placesNeeded(sim) {
  if (!sim || sim.station !== 'printer') return [];
  if (printerReadings(sim).works) return [];
  const places = ['printer'];
  if (sim.printer.tonerLow && sim.looked.cartridge && sim.carrying !== 'toner') places.push('parts_cabinet');
  return places;
}

// Why printing still fails, in the person's words, worked out from the printer.
function printFailure(sim) {
  const r = printerReadings(sim);
  if (!r.powered) return 'the printer is still off';
  if (r.jammed) return 'the printer still says paper jam';
  if (sim.printer.door === 'open' || sim.printer.cartridge === 'out') return 'the printer says its front door is open';
  if (!r.online) return 'the printer still shows as offline on the PC';
  if (r.quality === 'blank') return 'the page still comes out blank';
  if (r.quality === 'faint') return 'the print is still very light and faded';
  if (r.quality === 'streaks') return 'there are still streaks down the page';
  return 'it still does not print';
}

const GOAL_WORDS = {
  internet: ['the internet works again', 'there is still no internet'],
  display: ['the picture is back on the monitor', 'the monitor still shows no picture'],
  power: ['the PC starts up', 'the PC still will not turn on'],
  keyboard: ['typing works again', 'the keyboard still does not type'],
  mouse: ['the mouse pointer moves again', 'the mouse pointer still does not move'],
  print: ['the document prints properly', null], // failures come from printFailure()
};

/**
 * Ask the person to try again. Returns { sim, ok, solved, message }.
 * ok: their problem is fixed. solved: fixed and every required action done.
 * A failed test can give a clue about where to look next.
 */
export function test(sim, name) {
  if (sim.station === 'printer') {
    const ok = printerReadings(sim).works;
    return { sim, ok, solved: ok, message: `${name} prints again: ${ok ? GOAL_WORDS.print[0] : printFailure(sim)}.` };
  }
  const r = readings(sim);
  const ok = r.works[sim.goal];
  const missing = sim.required.filter((a) => !sim.done[a]);
  if (ok) {
    const note = missing.includes('report_port')
      ? ' Before closing the ticket, log the faulty switch port for the network team (in the server room).'
      : '';
    return { sim, ok, solved: missing.length === 0, message: `${name} tries again: ${GOAL_WORDS[sim.goal][0]}.${note}` };
  }
  let message = `${name} tries again: ${GOAL_WORDS[sim.goal][1]}.`;
  let next = sim;
  // The desk end is fine but there is no link: the fault is further along the cable.
  if (sim.goal === 'internet' && r.pcOn && sim.desk.netPc === 'in' && sim.desk.netWall === 'in' && sim.looked.netPc && sim.looked.netWall) {
    message += ` Both ends of the cable are firm, but the network light on the PC stays off. Check Desk ${sim.deskNumber}'s port on the switch in the server room.`;
    next = { ...sim, serverClue: true };
  }
  return { sim: next, ok: false, solved: false, message };
}

/** Does this ticket need the player in the server room right now? */
export function needsServerRoom(sim) {
  if (!sim || !sim.serverClue) return false;
  return sim.port.movedTo === null || (sim.required.includes('report_port') && !sim.done.report_port);
}
