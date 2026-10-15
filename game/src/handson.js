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

// What is on the shelves of the parts cabinet. The player picks what they think they need.
export const ITEMS = {
  toner: 'Toner cartridge',
  network_cable: 'Network cable',
  video_cable: 'Video cable',
  phone_cable: 'Phone charging cable',
  laptop_charger: 'Laptop charger',
  dock_cable: 'Dock cable',
  usb_keyboard: 'Spare keyboard',
  usb_mouse: 'Spare mouse',
  ram_ddr4: 'RAM stick (DDR4)',
  ram_ddr5: 'RAM stick (DDR5)',
};
export const ITEM_NAMES = ITEMS;
// Things the player can carry that are not on the cabinet shelves.
export const CARRY_NAMES = { ...ITEMS, user_pc: 'PC for repair' };

// Printer faults (all break printing). The printer is shared, so its station is at the printer.
const PRINTER_FAULTS = {
  printer_off: 'the printer is switched off',
  printer_network_loose: 'the network cable is loose at the back of the printer',
  paper_jam: 'a sheet is jammed, and a torn scrap stays behind when it is pulled out',
  toner_low: 'the toner cartridge is nearly empty',
  toner_seal_left: 'the protective seal was left in the toner cartridge',
  needs_cleaning: 'the printer needs its cleaning routine',
};

// Laptop desk faults: a laptop with its charger, a dock, a second monitor and a work phone.
const LAPTOP_FAULTS = {
  laptop_charger_loose: 'the laptop charger plug is loose in the wall socket',
  phone_cable_damaged: "the phone's charging cable is damaged",
  monitor_wrong_input: 'the second monitor is set to the wrong input',
  display_mode_pc_only: 'Windows is showing on the PC screen only',
  dock_power_unplugged: "the dock's own power adapter is unplugged",
  laptop_on_cushion: 'the laptop sits on a cushion that blocks its vents',
  laptop_vent_dusty: 'dust is clogging the laptop vent',
};
// Wi-Fi survey: measure the signal at three spots, then report the weak corner.
const SURVEY_FAULTS = { wifi_weak_corner: 'weak Wi-Fi coverage in one corner of the office' };
export const SURVEY_SPOTS = {
  wifi_front: { name: 'Front of office', bars: 4, speed: 'fast' },
  wifi_middle: { name: 'Middle of office', bars: 3, speed: 'fine' },
  wifi_corner: { name: 'The corner', bars: 1, speed: 'very slow, keeps dropping' },
};

// Repair bench: the PC goes to the IT room bench for a hardware repair.
const BENCH_FAULTS = {
  ram_faulty: 'one RAM stick is faulty, so Windows crashes with blue screens',
};
export const RAM_SLOTS = ['A', 'B'];

/** Which close-up a scenario uses: 'desk', 'printer', 'laptop', 'survey' or 'bench'. */
export function stationFor(scenario) {
  if (scenario.faults.some((f) => f in BENCH_FAULTS)) return 'bench';
  if (scenario.faults.some((f) => f in SURVEY_FAULTS)) return 'survey';
  if (scenario.faults.some((f) => f in LAPTOP_FAULTS)) return 'laptop';
  if (scenario.faults.some((f) => f in PRINTER_FAULTS)) return 'printer';
  return 'desk';
}

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
  const station = stationFor(scenario);
  const laptop = station === 'laptop'
    ? {
        chargerWall: has('laptop_charger_loose') ? 'loose' : 'in',
        chargerLaptop: 'in',
        phoneCable: has('phone_cable_damaged') ? 'damaged' : 'ok',
        monitorInput: has('monitor_wrong_input') ? 'HDMI' : 'DisplayPort', // the cable is DisplayPort
        displayMode: has('display_mode_pc_only') ? 'pc_only' : 'extend',
        dockPower: has('dock_power_unplugged') ? 'out' : 'in',
        dockCable: 'in',
        onCushion: has('laptop_on_cushion'),
        dusty: has('laptop_vent_dusty'),
      }
    : null;
  const survey = station === 'survey' ? { readings: {}, reported: false } : null;
  const bench = station === 'bench'
    ? {
        where: 'desk', // 'desk', 'carried' or 'bench'
        on: true, // Windows is running
        plugged: true,
        diag: null, // last memory test at the desk: 'errors' or 'clean'
        strap: false, // anti-static wrist strap on
        drained: false, // power button held after unplugging
        open: false, // side panel off
        slots: { A: 'orig', B: 'orig' }, // 'orig', 'new' or 'empty'
        bad: deskNumber % 2 === 1 ? 'A' : 'B', // which original stick is faulty
        lastBoot: null, // the last test boot at the bench: { slots: ['A'], errors }
      }
    : null;
  return {
    goal: scenario.goal,
    required: [...(scenario.required ?? [])],
    deskNumber,
    station,
    printer,
    laptop,
    survey,
    bench,
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
      if (p.tonerLow && sim.carrying) {
        return changedPrinter(sim, { cartridge: 'in' }, `You put the old cartridge back. The ${ITEMS[sim.carrying].toLowerCase()} you brought will not fit here: this needs a new toner cartridge.`);
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

/**
 * Take an item from the parts cabinet. You carry one thing at a time, so anything
 * you were holding goes back on the shelf. Returns { carrying, message, changed }.
 */
export function takeItem(carrying, item) {
  if (!(item in ITEMS)) return { carrying, message: '', changed: false };
  if (carrying === 'user_pc') return { carrying, message: 'Your hands are full with the PC. Put it down on the repair bench first.', changed: false };
  if (carrying === item) return { carrying, message: `You are already carrying the ${ITEMS[item].toLowerCase()}.`, changed: false };
  const swap = carrying ? ` You put the ${ITEMS[carrying].toLowerCase()} back on the shelf.` : '';
  return { carrying: item, message: `You take the ${ITEMS[item].toLowerCase()}.${swap}`, changed: true };
}

/** Put the carried item back in the cabinet. */
export function putBack(carrying) {
  if (!carrying) return { carrying, message: '', changed: false };
  if (!(carrying in ITEMS)) return { carrying, message: 'The PC does not go in the cabinet. Take it to the repair bench.', changed: false };
  return { carrying: null, message: `You put the ${ITEMS[carrying].toLowerCase()} back on the shelf.`, changed: true };
}

/** Take a new toner cartridge (kept for the printer flow and tests). */
export function takeToner(sim) {
  const step = takeItem(sim.carrying, 'toner');
  return { sim: { ...sim, carrying: step.carrying }, message: step.message, changed: step.changed };
}

/** Places this ticket needs right now, for markers: 'printer', 'parts_cabinet'. */
export function placesNeeded(sim) {
  if (sim?.station === 'bench') return benchPlaces(sim);
  if (sim?.station === 'laptop') {
    const l = sim.laptop;
    return l.phoneCable === 'damaged' && sim.looked.phoneCable && sim.carrying !== 'phone_cable' ? ['parts_cabinet'] : [];
  }
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

// ---------- the laptop desk ----------

export const LAPTOP_PARTS = {
  chargerWall: 'charger plug at the wall socket',
  chargerLaptop: 'charger plug at the laptop',
  dockPower: "dock's power adapter",
  dockCable: 'cable from the dock to the laptop',
};
export const DISPLAY_MODES = { pc_only: 'PC screen only', duplicate: 'Duplicate', extend: 'Extend', second_only: 'Second screen only' };

/** Lights, screens and what works at the laptop desk. */
export function laptopReadings(sim) {
  const l = sim.laptop;
  const chargerLight = l.chargerWall === 'in';
  const charging = chargerLight && l.chargerLaptop === 'in';
  const dockLight = l.dockPower === 'in';
  const dockWorks = dockLight && l.dockCable === 'in';
  const rightInput = l.monitorInput === 'DisplayPort';
  // The second monitor gets a picture only on the right input, and only if Windows sends one.
  const monitor = !rightInput ? `No signal on ${l.monitorInput}` : l.displayMode === 'pc_only' ? 'No signal on DisplayPort' : 'desktop';
  const hot = l.onCushion || l.dusty;
  return {
    chargerLight,
    charging,
    phoneCharging: l.phoneCable === 'ok',
    dockLight,
    dockWorks,
    monitor,
    laptopScreenOn: l.displayMode !== 'second_only',
    hot,
    works: {
      charging,
      phone_charging: l.phoneCable === 'ok',
      second_screen: monitor === 'desktop' && l.displayMode === 'extend',
      dock: dockWorks,
      cooling: !hot,
    },
  };
}

const changedLaptop = (sim, patch, message, extra = {}) => ({ sim: { ...sim, ...extra, laptop: { ...sim.laptop, ...patch } }, message, changed: true });

/** Every laptop desk action, by name (arg for the display mode). Returns { sim, message, changed }. */
export function laptopAction(sim, action, arg) {
  const l = sim.laptop;
  const looked = (k) => ({ looked: { ...sim.looked, [k]: true } });
  if (action in LAPTOP_PARTS) {
    if (l[action] === 'in') return same({ ...sim, ...looked(action) }, `You check the ${LAPTOP_PARTS[action]}. It is already firmly in.`);
    const was = l[action] === 'out' ? 'unplugged' : 'loose';
    const after = action === 'chargerWall' ? ' The light on the charger comes on.' : action === 'dockPower' ? " The dock's light comes on." : '';
    return changedLaptop(sim, { [action]: 'in' }, `The ${LAPTOP_PARTS[action]} was ${was}. You push it in firmly.${after}`, looked(action));
  }
  switch (action) {
    case 'input': {
      const next = l.monitorInput === 'HDMI' ? 'DisplayPort' : 'HDMI';
      return changedLaptop(sim, { monitorInput: next }, `You press the input button on the second monitor. It switches to ${next}. (Its cable is DisplayPort.)`);
    }
    case 'mode':
      if (!(arg in DISPLAY_MODES) || l.displayMode === arg) return same(sim, '');
      return changedLaptop(sim, { displayMode: arg }, `You press Windows key + P and choose "${DISPLAY_MODES[arg]}".`);
    case 'phoneCable':
      if (l.phoneCable === 'ok') return same({ ...sim, ...looked('phoneCable') }, 'You look along the phone cable. It looks fine.');
      if (sim.carrying === 'phone_cable') {
        return changedLaptop(sim, { phoneCable: 'ok' }, 'You swap in the spare phone charging cable. The phone shows the charging symbol.', { carrying: null, ...looked('phoneCable') });
      }
      return same({ ...sim, ...looked('phoneCable') }, 'You look along the phone cable. One section is bent and frayed. Try another cable: there are spares in the parts cabinet.');
    case 'phonePort':
      return same({ ...sim, ...looked('phonePort') }, 'You look into the phone\'s charging port with a light. It is clean, no dirt or fluff.');
    case 'cushion':
      if (!l.onCushion) return same(sim, 'The laptop is already on the hard, flat desk.');
      return changedLaptop(sim, { onCushion: false }, 'You move the laptop off the cushion onto the hard, flat desk, so air can reach the vents underneath.');
    case 'vent':
      if (!l.dusty) return same({ ...sim, ...looked('vent') }, 'You check the vent. It is clear.');
      return changedLaptop(sim, { dusty: false }, 'The vent is clogged with dust. You clear it carefully so air can flow out.', looked('vent'));
    default:
      return same(sim, '');
  }
}

// ---------- the Wi-Fi survey ----------

/** Measure the Wi-Fi signal at one spot. */
export function measure(sim, spot) {
  if (!sim.survey || !(spot in SURVEY_SPOTS)) return same(sim, '');
  const s = SURVEY_SPOTS[spot];
  return {
    sim: { ...sim, survey: { ...sim.survey, readings: { ...sim.survey.readings, [spot]: s.bars } } },
    message: `${s.name}: ${s.bars} of 4 bars, speed ${s.speed}.`,
    changed: true,
  };
}

export const surveyDone = (sim) => Boolean(sim?.survey) && Object.keys(SURVEY_SPOTS).every((k) => k in sim.survey.readings);

/** Spots still to measure (for markers). */
export const spotsLeft = (sim) => (sim?.survey ? Object.keys(SURVEY_SPOTS).filter((k) => !(k in sim.survey.readings)) : []);

/** Report the weak coverage once all three spots are measured. */
export function reportCoverage(sim) {
  if (!surveyDone(sim) || sim.survey.reported) return same(sim, '');
  return {
    sim: { ...sim, survey: { ...sim.survey, reported: true } },
    message: 'You report the weak coverage to the network team, with your readings: 4 bars at the front, 3 in the middle, 1 in the corner. They can move or add an access point.',
    changed: true,
  };
}

// ---------- the repair bench ----------

const installed = (b) => RAM_SLOTS.filter((s) => b.slots[s] !== 'empty');
const badInstalled = (b) => b.slots[b.bad] === 'orig';

/** What the PC is like now. */
export function benchReadings(sim) {
  const b = sim.bench;
  const running = b.where === 'desk' && b.on && b.plugged;
  const memoryOk = !badInstalled(b) && installed(b).length === RAM_SLOTS.length;
  return {
    running,
    screen: !running ? 'off' : badInstalled(b) ? 'crashes' : 'desktop',
    memoryOk,
    needsRam: badInstalled(b) || installed(b).length < RAM_SLOTS.length,
    works: { stable: running && memoryOk },
  };
}

const changedBench = (sim, patch, message, extra = {}) => ({ sim: { ...sim, ...extra, bench: { ...sim.bench, ...patch } }, message, changed: true });
const slotName = (slot) => `slot ${slot}`;

/** Every repair action, at the desk or at the bench. Returns { sim, message, changed }. */
export function benchAction(sim, action) {
  const b = sim.bench;
  const looked = (k) => ({ looked: { ...sim.looked, [k]: true } });
  const atBench = b.where === 'bench';
  switch (action) {
    // --- at the person's desk ---
    case 'screen':
      if (b.where !== 'desk') return same(sim, 'The PC is not here: it is with you or on the repair bench.');
      if (!b.on) return same({ ...sim, ...looked('screen') }, 'The PC is switched off.');
      if (badInstalled(b)) {
        return same({ ...sim, ...looked('screen') }, 'You look at the photo of the blue screen. The stop code says MEMORY_MANAGEMENT, which points to the memory (RAM).');
      }
      return same({ ...sim, ...looked('screen') }, 'Windows is running normally.');
    case 'diag': {
      if (b.where !== 'desk' || !b.on) return same(sim, 'The PC needs to be at the desk and switched on to run the memory test.');
      const errors = badInstalled(b);
      return changedBench(
        sim,
        { diag: errors ? 'errors' : 'clean' },
        errors
          ? 'You run Windows Memory Diagnostic (mdsched.exe). The PC restarts and tests its memory. After signing in, the result says it found memory errors. The RAM needs replacing.'
          : 'You run Windows Memory Diagnostic again. The PC restarts and tests its memory: no errors found this time.',
        looked('diag'),
      );
    }
    case 'shutdown':
      if (b.where !== 'desk') return same(sim, '');
      if (!b.on) return same(sim, 'It is already shut down and unplugged.');
      return changedBench(sim, { on: false, plugged: false }, 'You shut down Windows properly, then unplug the power cable from the back of the PC.');
    case 'pc':
      // Pick the PC up (at the desk or the bench), or put it down where you are.
      if (b.where === 'carried') return same(sim, '');
      if (b.on) return same(sim, 'Shut it down and unplug it before you move it.');
      if (b.open) return same(sim, 'Put the side panel back on before you move the PC.');
      if (sim.carrying) return same(sim, `Your hands are full. Put the ${(CARRY_NAMES[sim.carrying] ?? 'item').toLowerCase()} back first.`);
      return changedBench(sim, { where: 'carried' }, b.where === 'desk'
        ? 'You pick up the PC. Take it to the repair bench in the IT room.'
        : 'You pick up the PC. Take it back to its desk.', { carrying: 'user_pc' });
    case 'putDesk':
      if (b.where !== 'carried' || sim.carrying !== 'user_pc') return same(sim, '');
      return changedBench(sim, { where: 'desk', plugged: true, on: true, drained: false },
        'You put the PC back under the desk, plug it in and switch it on. Windows starts.', { carrying: null });
    // --- at the repair bench ---
    case 'putBench':
      if (b.where !== 'carried' || sim.carrying !== 'user_pc') return same(sim, '');
      return changedBench(sim, { where: 'bench', drained: false }, 'You set the PC down on the anti-static mat.', { carrying: null });
    case 'strap':
      if (b.strap) return same(sim, 'You are already wearing the anti-static strap.');
      return changedBench(sim, { strap: true }, 'You put on the anti-static wrist strap and clip it to the bench. Now static from your body cannot damage the parts.');
    case 'button':
      if (!atBench) return same(sim, '');
      return changedBench(sim, { drained: true }, 'With the power cable out, you hold the power button for a few seconds to drain any leftover power.');
    case 'panel':
      if (!atBench) return same(sim, '');
      if (b.open) return changedBench(sim, { open: false }, 'You slide the side panel back on and screw it shut.');
      if (!b.drained) return same(sim, 'Hold the power button for a few seconds first, to drain any leftover power.');
      return changedBench(sim, { open: true }, 'You undo the screws and slide off the side panel. Two RAM sticks sit in slots A and B.', looked('panel'));
    case 'boot': {
      if (!atBench) return same(sim, '');
      const sticks = installed(b);
      if (!sticks.length) return same(sim, 'With no memory in it, the PC just beeps and will not start. Put at least one stick in first.');
      const errors = badInstalled(b);
      const which = sticks.length === 1 ? `only the stick in ${slotName(sticks[0])}` : 'both sticks';
      return changedBench(
        sim,
        { lastBoot: { slots: sticks, errors }, drained: true },
        `You plug it into the bench power, start it with ${which} and run the memory test: ${errors ? 'memory errors found' : 'no errors'}. Then you shut it down, unplug it and drain the power again.`,
      );
    }
    case 'A':
    case 'B': {
      if (!atBench || !b.open) return same(sim, '');
      if (!b.strap) return same(sim, 'Put on the anti-static strap before you touch anything inside. Static from your hands can damage the parts.');
      const slot = action;
      const state = b.slots[slot];
      if (state === 'orig') {
        return changedBench(sim, { slots: { ...b.slots, [slot]: 'empty' } }, `You press the clips on ${slotName(slot)} and lift the stick out. It goes on the mat.`);
      }
      if (state === 'new') return same(sim, `The new stick in ${slotName(slot)} is in, with both clips closed.`);
      if (sim.carrying === 'ram_ddr4') {
        return changedBench(sim, { slots: { ...b.slots, [slot]: 'new' } }, `You line up the notch with the slot and press the new DDR4 stick into ${slotName(slot)} until both clips click.`, { carrying: null });
      }
      if (sim.carrying === 'ram_ddr5') {
        return same(sim, 'The DDR5 stick will not go in: its notch is in a different place. This PC takes DDR4.');
      }
      if (sim.carrying) return same(sim, `The ${CARRY_NAMES[sim.carrying].toLowerCase()} does not go in a memory slot.`);
      return changedBench(sim, { slots: { ...b.slots, [slot]: 'orig' } }, `You put the original stick back into ${slotName(slot)} until the clips click.`);
    }
    default:
      return same(sim, '');
  }
}

/** Which original stick a single-stick test boot showed to be faulty, if any. */
export function badStickFound(sim) {
  const boot = sim.bench?.lastBoot;
  if (!boot || boot.slots.length !== 1) return null;
  const [slot] = boot.slots;
  if (boot.errors) return slot;
  return RAM_SLOTS.find((s) => s !== slot);
}

function benchPlaces(sim) {
  const b = sim.bench;
  const r = benchReadings(sim);
  if (b.where === 'carried') return r.memoryOk ? [] : ['repair_bench'];
  if (b.where !== 'bench') return [];
  if (b.open && r.needsRam && sim.carrying !== 'ram_ddr4') return ['parts_cabinet'];
  return ['repair_bench'];
}

const GOAL_WORDS = {
  internet: ['the internet works again', 'there is still no internet'],
  display: ['the picture is back on the monitor', 'the monitor still shows no picture'],
  power: ['the PC starts up', 'the PC still will not turn on'],
  keyboard: ['typing works again', 'the keyboard still does not type'],
  mouse: ['the mouse pointer moves again', 'the mouse pointer still does not move'],
  print: ['the document prints properly', null], // failures come from printFailure()
  charging: ['the battery is charging again', 'the battery still is not charging'],
  phone_charging: ['the phone shows it is charging', 'the phone still is not charging'],
  second_screen: ['the second monitor shows the desktop as an extra screen', 'the second monitor still shows no picture'],
  dock: ['the monitors, keyboard and mouse all work through the dock', 'the monitors, keyboard and mouse are still dead'],
  cooling: ['the laptop stays cool and the fan is quiet', 'the laptop is still hot and the fan is loud'],
  wifi_report: ['the weak corner has been reported to the network team', 'the weak corner has not been reported yet'],
  stable: ['the PC runs all morning with no more blue screens', null], // failures come from benchFailure()
};

function benchFailure(sim) {
  const b = sim.bench;
  if (b.where !== 'desk') return 'the PC is not back at the desk yet';
  if (!b.on) return 'the PC is still switched off';
  if (badInstalled(b)) return 'it crashes with a blue screen again';
  return 'it only has half its memory now, so it is very slow. Fill both memory slots';
}

/**
 * Ask the person to try again. Returns { sim, ok, solved, message }.
 * ok: their problem is fixed. solved: fixed and every required action done.
 * A failed test can give a clue about where to look next.
 */
export function test(sim, name) {
  if (sim.station === 'bench') {
    const ok = benchReadings(sim).works.stable;
    return { sim, ok, solved: ok, message: `${name} tries the PC: ${ok ? GOAL_WORDS.stable[0] : benchFailure(sim)}.` };
  }
  if (sim.station === 'laptop') {
    const r = laptopReadings(sim);
    const ok = r.works[sim.goal];
    let why = GOAL_WORDS[sim.goal][1];
    if (sim.goal === 'second_screen' && !ok && r.monitor === 'desktop') {
      why = sim.laptop.displayMode === 'second_only'
        ? 'the second monitor works, but now the laptop screen is off'
        : 'both screens show the same thing, so it is not an extra screen';
    }
    return { sim, ok, solved: ok, message: `${name} tries again: ${ok ? GOAL_WORDS[sim.goal][0] : why}.` };
  }
  if (sim.station === 'survey') {
    const ok = sim.survey.reported;
    return { sim, ok, solved: ok, message: ok ? `${name} is told the network team will fix the coverage.` : `Measure the signal at all three spots, then report it.` };
  }
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

// ---------- progress, for the mission card ----------

/** Is the person's problem fixed (and every required action done)? The survey counts once measured. */
export function isFixed(sim) {
  if (sim.station === 'bench') return benchReadings(sim).works.stable;
  if (sim.station === 'printer') return printerReadings(sim).works;
  if (sim.station === 'laptop') return Boolean(laptopReadings(sim).works[sim.goal]);
  if (sim.station === 'survey') return surveyDone(sim);
  return readings(sim).works[sim.goal] && sim.required.every((a) => sim.done[a]);
}

/** Where the player is: 1 = find the problem, 2 = fix it, 3 = test it with the person. */
export function missionStep(sim) {
  if (isFixed(sim)) return 3;
  const started =
    sim.visited ||
    Object.keys(sim.looked).length > 0 ||
    (sim.survey && Object.keys(sim.survey.readings).length > 0) ||
    sim.port.movedTo !== null;
  return started ? 2 : 1;
}
