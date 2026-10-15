// Run with: node --test game/tests/handson.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSim, moveToSpare, needsServerRoom, readings, reportPort, reseat, test as tryIt } from '../src/handson.js';

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
};

test('every fault the validator allows really breaks its goal in the simulation', () => {
  for (const [fault, goal] of Object.entries(VALIDATOR_FAULTS)) {
    assert.equal(readings(createSim({ faults: [fault], goal }, 3)).works[goal], false, fault);
  }
});
