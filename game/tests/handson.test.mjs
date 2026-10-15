// Run with: node --test game/tests/handson.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSim, moveToSpare, needsServerRoom, placesNeeded, printerAction, printerReadings, readings, reportPort, reseat, takeToner,
  test as tryIt,
} from '../src/handson.js';

const sim = (faults, goal, required = [], desk = 4) => createSim({ faults, goal, required }, desk);

test('with nothing broken, everything works and every light is on', () => {
  const r = readings(sim(['keyboard_unplugged'], 'keyboard'));
  assert.equal(r.pcOn, true);
  assert.equal(r.screen, 'picture');
  assert.equal(r.link, true);
  assert.equal(r.deskPortLit, true);
  assert.equal(r.works.keyboard, false); // only the fault is broken
  assert.equal(r.works.mouse, true);
});

test('a loose network cable: no link light until it is reseated', () => {
  let s = sim(['network_cable_loose'], 'internet');
  assert.equal(readings(s).link, false);
  assert.equal(readings(s).deskPortLit, false);
  assert.equal(tryIt(s, 'Ali').ok, false);
  const step = reseat(s, 'netPc');
  assert.equal(step.changed, true);
  assert.match(step.message, /was loose/);
  s = step.sim;
  assert.equal(readings(s).link, true);
  const t = tryIt(s, 'Ali');
  assert.equal(t.ok && t.solved, true);
  assert.match(t.message, /internet works again/);
});

test('checking a cable that is already in changes nothing', () => {
  const s = sim(['network_cable_loose'], 'internet');
  const step = reseat(s, 'netWall');
  assert.equal(step.changed, false);
  assert.match(step.message, /already firmly in/);
  assert.equal(step.sim.looked.netWall, true);
});

test('a dead switch port: the desk end is fine, so the clue points to the server room', () => {
  let s = sim(['switch_port_dead'], 'internet', ['report_port']);
  assert.equal(readings(s).link, false);
  assert.equal(needsServerRoom(s), false);
  // Testing before checking the cables gives no clue yet.
  assert.doesNotMatch(tryIt(s, 'Farah').message, /server room/);
  s = reseat(s, 'netPc').sim;
  s = reseat(s, 'netWall').sim;
  const t = tryIt(s, 'Farah');
  assert.match(t.message, /port on the switch in the server room/);
  s = t.sim;
  assert.equal(needsServerRoom(s), true);

  assert.equal(moveToSpare(s, 5).changed, false); // not a spare port
  const moved = moveToSpare(s, 11);
  assert.match(moved.message, /spare port 11\. Its light comes on/);
  s = moved.sim;
  assert.equal(readings(s).sparePortLit, true);
  assert.equal(readings(s).link, true);
  assert.equal(moveToSpare(s, 12).changed, false); // already moved

  // Works now, but the ticket is not done until the port is reported.
  let check = tryIt(s, 'Farah');
  assert.equal(check.ok, true);
  assert.equal(check.solved, false);
  assert.match(check.message, /log the faulty switch port/);
  assert.equal(needsServerRoom(s), true);
  s = reportPort(s).sim;
  assert.equal(needsServerRoom(s), false);
  check = tryIt(s, 'Farah');
  assert.equal(check.solved, true);
});

test('reporting before moving the cable does nothing', () => {
  const s = sim(['switch_port_dead'], 'internet', ['report_port']);
  assert.equal(reportPort(s).changed, false);
});

test('monitor faults: no power means a dark screen, a loose video cable means No Signal', () => {
  const off = sim(['monitor_power_loose'], 'display');
  assert.equal(readings(off).screen, 'off');
  assert.equal(readings(reseat(off, 'monitorPower').sim).screen, 'picture');
  const noSignal = sim(['video_cable_loose'], 'display');
  assert.equal(readings(noSignal).screen, 'no-signal');
  assert.equal(readings(reseat(noSignal, 'videoCable').sim).works.display, true);
});

test('the power strip powers everything, and switching it off breaks things again', () => {
  let s = sim(['power_strip_off'], 'power');
  let r = readings(s);
  assert.equal(r.pcOn, false);
  assert.equal(r.screen, 'off');
  assert.equal(r.works.internet, false);
  s = reseat(s, 'powerStrip').sim;
  r = readings(s);
  assert.equal(r.pcOn && r.monitorOn && r.works.internet, true);
  s = reseat(s, 'powerStrip').sim; // flipping it again turns it off
  assert.equal(readings(s).pcOn, false);
});

test('keyboard and mouse plugs', () => {
  const k = sim(['keyboard_unplugged'], 'keyboard');
  const step = reseat(k, 'keyboard');
  assert.match(step.message, /was unplugged/);
  assert.equal(tryIt(step.sim, 'Ahmed').solved, true);
  const m = sim(['mouse_unplugged'], 'mouse');
  assert.equal(tryIt(m, 'Ahmed').ok, false);
  assert.equal(tryIt(reseat(m, 'mouse').sim, 'Ahmed').solved, true);
});

test('actions never change the original simulation', () => {
  const s = sim(['network_cable_loose'], 'internet');
  reseat(s, 'netPc');
  assert.equal(s.desk.netPc, 'loose');
});

// Must match HANDS_ON_FAULTS in tools/validate_problems.py (the validator decides what content may use).
const VALIDATOR_FAULTS = {
  network_cable_loose: 'internet', wall_cable_loose: 'internet', switch_port_dead: 'internet',
  video_cable_loose: 'display', monitor_power_loose: 'display', power_strip_off: 'power',
  pc_power_loose: 'power', keyboard_unplugged: 'keyboard', mouse_unplugged: 'mouse',
  printer_off: 'print', printer_network_loose: 'print', paper_jam: 'print', toner_low: 'print',
  toner_seal_left: 'print', needs_cleaning: 'print',
};

test('every fault the validator allows really breaks its goal in the simulation', () => {
  for (const [fault, goal] of Object.entries(VALIDATOR_FAULTS)) {
    const s = createSim({ faults: [fault], goal }, 3);
    const works = goal === 'print' ? printerReadings(s).works : readings(s).works[goal];
    assert.equal(works, false, fault);
  }
});

// ---------- printer ----------

const printer = (faults) => createSim({ faults, goal: 'print' }, 6);
const act = (s, ...actions) => actions.reduce((cur, a) => printerAction(cur, a).sim, s);

test('printer offline: the screen says no network until the cable is reseated', () => {
  let s = printer(['printer_network_loose']);
  assert.equal(s.station, 'printer');
  assert.equal(printerReadings(s).screen, 'No network connection');
  assert.deepEqual(placesNeeded(s), ['printer']);
  assert.match(tryIt(s, 'Nida').message, /offline on the PC/);
  // The test page still prints: it does not need the network.
  assert.equal(act(s, 'test').testPage, 'good');
  s = act(s, 'net');
  assert.equal(printerReadings(s).screen, 'Ready');
  assert.deepEqual(placesNeeded(s), []);
  assert.equal(tryIt(s, 'Nida').solved, true);
});

test('paper jam: the sheet and then the torn scrap must both come out, and the door must close', () => {
  let s = printer(['paper_jam']);
  assert.match(printerReadings(s).screen, /Paper jam/);
  assert.equal(printerAction(s, 'sheet').changed, false); // door still closed
  s = act(s, 'door');
  assert.equal(printerAction(s, 'scrap').changed, false); // the sheet comes first
  s = act(s, 'sheet');
  assert.equal(printerReadings(s).jammed, true); // the scrap is still inside
  s = act(s, 'door');
  assert.match(tryIt(s, 'Asad').message, /still says paper jam/);
  s = act(s, 'door', 'scrap');
  assert.match(tryIt(s, 'Asad').message, /front door is open/);
  s = act(s, 'door');
  assert.equal(tryIt(s, 'Asad').solved, true);
});

test('toner low: faint test page, a new cartridge from the parts cabinet, then good prints', () => {
  let s = printer(['toner_low']);
  assert.equal(act(s, 'test').testPage, 'faint');
  s = act(s, 'door', 'cartridge');
  assert.equal(s.printer.cartridge, 'out');
  assert.deepEqual(placesNeeded(s), ['printer', 'parts_cabinet']);
  assert.equal(printerAction(s, 'door').changed, false); // cannot close with the cartridge out
  s = act(s, 'cartridge'); // put the old one back: still low
  assert.equal(s.printer.tonerLow, true);
  s = takeToner(s).sim;
  assert.equal(takeToner(s).changed, false);
  assert.deepEqual(placesNeeded(s), ['printer']);
  s = act(s, 'cartridge', 'cartridge'); // take the old one out, put the new one in
  assert.equal(s.printer.tonerLow, false);
  assert.equal(s.carrying, null);
  s = act(s, 'door');
  assert.equal(act(s, 'test').testPage, 'good');
  assert.equal(tryIt(s, 'Maryam').solved, true);
});

test('streaks: the cleaning routine fixes them, but only with the printer on and the door shut', () => {
  let s = printer(['needs_cleaning']);
  const first = printerAction(s, 'test');
  assert.equal(first.sim.testPage, 'streaks');
  assert.match(first.message, /fault is in the printer itself/);
  assert.equal(printerAction(act(s, 'door'), 'clean').changed, false);
  assert.equal(printerAction(act(s, 'power'), 'clean').changed, false);
  s = act(s, 'clean');
  assert.equal(act(s, 'test').testPage, 'good');
  assert.equal(tryIt(s, 'Shazia').solved, true);
});

test('blank pages: the protective seal must be pulled from the cartridge', () => {
  let s = printer(['toner_seal_left']);
  assert.equal(act(s, 'test').testPage, 'blank');
  s = act(s, 'door');
  const out = printerAction(s, 'cartridge');
  assert.match(out.message, /protective seal tab/);
  s = act(out.sim, 'seal', 'cartridge', 'door');
  assert.equal(act(s, 'test').testPage, 'good');
  assert.equal(tryIt(s, 'Tahira').solved, true);
});

test('a printer that is off shows a blank screen and prints nothing', () => {
  let s = printer(['printer_off']);
  assert.equal(printerReadings(s).screen, '');
  assert.match(printerAction(s, 'test').message, /printer is off/);
  s = act(s, 'power');
  assert.equal(tryIt(s, 'Nida').solved, true);
});

// ---------- parts cabinet ----------
import { ITEMS, putBack, takeItem } from '../src/handson.js';

test('the parts cabinet: carry one item at a time, swap or put it back', () => {
  let step = takeItem(null, 'video_cable');
  assert.equal(step.carrying, 'video_cable');
  assert.match(step.message, /take the video cable/);
  step = takeItem(step.carrying, 'toner');
  assert.equal(step.carrying, 'toner');
  assert.match(step.message, /put the video cable back/);
  assert.equal(takeItem('toner', 'toner').changed, false);
  assert.equal(takeItem('toner', 'unicorn').changed, false);
  assert.equal(putBack('toner').carrying, null);
  assert.equal(putBack(null).changed, false);
  assert.ok(Object.keys(ITEMS).length >= 6);
});

test('bringing the wrong item to the printer does not fix low toner', () => {
  let s = { ...printer(['toner_low']), carrying: 'network_cable' };
  s = act(s, 'door', 'cartridge');
  const back = printerAction(s, 'cartridge');
  assert.match(back.message, /will not fit here/);
  assert.equal(back.sim.printer.tonerLow, true);
  assert.equal(back.sim.carrying, 'network_cable');
});
