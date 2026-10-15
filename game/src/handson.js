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
  return {
    goal: scenario.goal,
    required: [...(scenario.required ?? [])],
    deskNumber,
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

const GOAL_WORDS = {
  internet: ['the internet works again', 'there is still no internet'],
  display: ['the picture is back on the monitor', 'the monitor still shows no picture'],
  power: ['the PC starts up', 'the PC still will not turn on'],
  keyboard: ['typing works again', 'the keyboard still does not type'],
  mouse: ['the mouse pointer moves again', 'the mouse pointer still does not move'],
};

/**
 * Ask the person to try again. Returns { sim, ok, solved, message }.
 * ok: their problem is fixed. solved: fixed and every required action done.
 * A failed test can give a clue about where to look next.
 */
export function test(sim, name) {
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
