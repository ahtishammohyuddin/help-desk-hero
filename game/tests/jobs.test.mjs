// Run with: node --test game/tests/jobs.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advance, createJob, currentStep, finish, jobLabel, jobStage, PLACES, placeInReach, placesWaiting } from '../src/jobs.js';

const TONER = [
  { place: 'parts_cabinet', action: 'Take a new toner cartridge' },
  { place: 'printer', action: 'Replace the toner cartridge' },
];

test('every place the validator allows has a position', () => {
  for (const key of ['printer', 'parts_cabinet', 'server_room']) {
    assert.ok(PLACES[key].name && Number.isFinite(PLACES[key].x) && Number.isFinite(PLACES[key].z), key);
  }
});

test('a job goes through each place in order, then back to the person', () => {
  let job = createJob(TONER);
  assert.equal(jobStage(job), 'place');
  assert.equal(currentStep(job).place, 'parts_cabinet');
  assert.equal(jobLabel(job, 'Maryam'), 'Next: Parts cabinet');

  job = advance(job);
  assert.equal(currentStep(job).place, 'printer');
  assert.equal(jobLabel(job, 'Maryam'), 'Next: Printer');

  job = advance(job);
  assert.equal(jobStage(job), 'return');
  assert.equal(currentStep(job), null);
  assert.equal(jobLabel(job, 'Maryam'), 'Next: back to Maryam');
  assert.equal(advance(job), job); // nothing more to do at a place

  job = finish(job);
  assert.equal(jobStage(job), 'finished');
  assert.equal(jobLabel(job, 'Maryam'), '');
});

test('advance does not change the original job', () => {
  const job = createJob(TONER);
  advance(job);
  assert.equal(job.index, 0);
});

test('no job counts as finished', () => {
  assert.equal(jobStage(null), 'finished');
  assert.equal(currentStep(undefined), null);
});

test('a place is only in reach when close and when a step is waiting there', () => {
  const ticket = { number: 7 };
  const jobs = [{ ticket, job: createJob(TONER) }];
  const cab = PLACES.parts_cabinet;
  assert.equal(placeInReach({ x: cab.x + 1, z: cab.z }, jobs).place.name, 'Parts cabinet');
  assert.equal(placeInReach({ x: cab.x + 3, z: cab.z }, jobs), null); // too far
  const printer = PLACES.printer;
  assert.equal(placeInReach({ x: printer.x, z: printer.z }, jobs), null); // printer is the second step
  const later = [{ ticket, job: advance(createJob(TONER)) }];
  assert.equal(placeInReach({ x: printer.x, z: printer.z }, later).step.action, 'Replace the toner cartridge');
});

test('the nearest waiting place wins and places are listed once', () => {
  const a = { ticket: { number: 1 }, job: createJob([{ place: 'printer', action: 'A' }]) };
  const b = { ticket: { number: 2 }, job: createJob([{ place: 'printer', action: 'B' }]) };
  const c = { ticket: { number: 3 }, job: createJob([{ place: 'server_room', action: 'C' }]) };
  assert.equal(placeInReach(PLACES.printer, [a, b]).ticket.number, 1);
  assert.deepEqual(placesWaiting([a, b, c]).sort(), ['printer', 'server_room']);
  assert.deepEqual(placesWaiting([{ ticket: {}, job: finish(advance(createJob([{ place: 'printer', action: 'A' }]))) }]), []);
});
