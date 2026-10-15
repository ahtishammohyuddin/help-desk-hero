// Run with: node --test game/tests/handson.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSim, laptopAction, laptopReadings, measure, moveToSpare, needsServerRoom, placesNeeded, printerAction, printerReadings, readings,
  reportCoverage, reportPort, reseat, spotsLeft, stationFor, surveyDone, takeToner,
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
  laptop_charger_loose: 'charging', phone_cable_damaged: 'phone_charging', monitor_wrong_input: 'second_screen',
  display_mode_pc_only: 'second_screen', dock_power_unplugged: 'dock', laptop_on_cushion: 'cooling',
  laptop_vent_dusty: 'cooling', wifi_weak_corner: 'wifi_report',
};

test('every fault the validator allows really breaks its goal in the simulation', () => {
  for (const [fault, goal] of Object.entries(VALIDATOR_FAULTS)) {
    const s = createSim({ faults: [fault], goal }, 3);
    const works = s.station === 'printer' ? printerReadings(s).works
      : s.station === 'laptop' ? laptopReadings(s).works[goal]
        : s.station === 'survey' ? s.survey.reported
          : readings(s).works[goal];
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

// ---------- laptop desk ----------

const laptop = (faults, goal) => createSim({ faults, goal }, 2);
const lact = (s, ...actions) => actions.reduce((cur, a) => (Array.isArray(a) ? laptopAction(cur, ...a) : laptopAction(cur, a)).sim, s);

test('stations are chosen from the faults', () => {
  assert.equal(stationFor({ faults: ['keyboard_unplugged'] }), 'desk');
  assert.equal(stationFor({ faults: ['paper_jam'] }), 'printer');
  assert.equal(stationFor({ faults: ['dock_power_unplugged'] }), 'laptop');
  assert.equal(stationFor({ faults: ['wifi_weak_corner'] }), 'survey');
});

test('laptop charger loose at the wall: the charger light is the clue', () => {
  let s = laptop(['laptop_charger_loose'], 'charging');
  assert.equal(laptopReadings(s).chargerLight, false);
  assert.equal(laptopAction(s, 'chargerLaptop').changed, false); // the laptop end is fine
  const step = laptopAction(s, 'chargerWall');
  assert.match(step.message, /light on the charger comes on/);
  s = step.sim;
  assert.equal(tryIt(s, 'Kamran').solved, true);
});

test('damaged phone cable: needs a spare cable from the parts cabinet', () => {
  let s = laptop(['phone_cable_damaged'], 'phone_charging');
  assert.match(laptopAction(s, 'phonePort').message, /clean/);
  const look = laptopAction(s, 'phoneCable');
  assert.match(look.message, /bent and frayed/);
  assert.equal(look.changed, false);
  s = { ...look.sim, carrying: 'phone_cable' };
  s = lact(s, 'phoneCable');
  assert.equal(s.carrying, null);
  assert.equal(tryIt(s, 'Junaid').solved, true);
});

test('second monitor: right input, then Windows key + P and Extend', () => {
  let s = laptop(['monitor_wrong_input', 'display_mode_pc_only'], 'second_screen');
  assert.equal(laptopReadings(s).monitor, 'No signal on HDMI');
  s = lact(s, 'input');
  assert.equal(laptopReadings(s).monitor, 'No signal on DisplayPort'); // Windows still sends nothing
  assert.match(tryIt(s, 'Nargis').message, /still shows no picture/);
  s = lact(s, ['mode', 'duplicate']);
  assert.match(tryIt(s, 'Nargis').message, /same thing/);
  s = lact(s, ['mode', 'second_only']);
  assert.match(tryIt(s, 'Nargis').message, /laptop screen is off/);
  s = lact(s, ['mode', 'extend']);
  assert.equal(tryIt(s, 'Nargis').solved, true);
  assert.equal(laptopAction(s, 'mode', 'extend').changed, false);
});

test("dock: its own power adapter, with the dock light as the clue", () => {
  let s = laptop(['dock_power_unplugged'], 'dock');
  assert.equal(laptopReadings(s).dockLight, false);
  s = lact(s, 'dockCable'); // already in, no change
  assert.equal(tryIt(s, 'Waqas').ok, false);
  s = lact(s, 'dockPower');
  assert.equal(laptopReadings(s).dockWorks, true);
  assert.equal(tryIt(s, 'Waqas').solved, true);
});

test('overheating: both the cushion and the dusty vent must be dealt with', () => {
  let s = laptop(['laptop_on_cushion', 'laptop_vent_dusty'], 'cooling');
  assert.equal(laptopReadings(s).hot, true);
  s = lact(s, 'cushion');
  assert.equal(tryIt(s, 'Imtiaz').ok, false);
  s = lact(s, 'vent');
  assert.equal(tryIt(s, 'Imtiaz').solved, true);
});

// ---------- Wi-Fi survey ----------

test('Wi-Fi survey: measure all three spots, then report', () => {
  let s = createSim({ faults: ['wifi_weak_corner'], goal: 'wifi_report' }, 5);
  assert.deepEqual(spotsLeft(s), ['wifi_front', 'wifi_middle', 'wifi_corner']);
  assert.equal(reportCoverage(s).changed, false);
  s = measure(s, 'wifi_front').sim;
  const corner = measure(s, 'wifi_corner');
  assert.match(corner.message, /1 of 4 bars/);
  s = corner.sim;
  assert.equal(surveyDone(s), false);
  s = measure(s, 'wifi_middle').sim;
  assert.equal(surveyDone(s), true);
  assert.equal(tryIt(s, 'Amna').solved, false);
  s = reportCoverage(s).sim;
  assert.equal(tryIt(s, 'Amna').solved, true);
  assert.equal(reportCoverage(s).changed, false);
});
