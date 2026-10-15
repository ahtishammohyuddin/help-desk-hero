// Physical fixes ("jobs"). Pure logic (no browser), tested with Node.
//
// Some problems have physical_steps in their reviewed JSON, for example
// "go to the parts cabinet and take a spare cable". After the player picks the right
// fix, the ticket stays open: they walk to each place in turn, press E there, then
// go back to the person to finish. XP is given at the end, so the timer still matters.

/**
 * Where each place is. (x, z) is the spot to stand on, in front of the furniture;
 * (markX, markZ) is the furniture itself, where the floating marker goes.
 */
export const PLACES = {
  printer: { name: 'Printer', x: -16.2, z: -11.7, markX: -16.2, markZ: -13.2 },
  parts_cabinet: { name: 'Parts cabinet', x: -18.6, z: 8, markX: -19.6, markZ: 8 },
  server_room: { name: 'Server room', x: 14, z: -11.2, markX: 14, markZ: -12.8 },
  // Wi-Fi survey spots (hands-on Wi-Fi tickets)
  wifi_front: { name: 'Front of office', x: 2, z: 11, markX: 2, markZ: 11 },
  wifi_middle: { name: 'Middle of office', x: -2.5, z: 2.5, markX: -2.5, markZ: 2.5 },
  wifi_corner: { name: 'The corner', x: -12.5, z: -10, markX: -12.5, markZ: -10 },
};

export const PLACE_RADIUS = 1.5; // how close you must be to use a place
export const WORK_SECONDS = 1.2; // how long the action takes once you press E

/** A new job from the steps sent with a right answer. */
export function createJob(steps) {
  return { steps: steps.map((s) => ({ place: s.place, action: s.action })), index: 0, finished: false };
}

/**
 * Where the job is:
 * - "place": walk to the next place and press E there
 * - "return": all places done, go back to the person
 * - "finished": ticket closed
 */
export function jobStage(job) {
  if (!job || job.finished) return 'finished';
  return job.index < job.steps.length ? 'place' : 'return';
}

/** The step to do next, or null when it is time to go back (or the job is over). */
export function currentStep(job) {
  return jobStage(job) === 'place' ? job.steps[job.index] : null;
}

/** The job after doing the current step (the original is unchanged). */
export function advance(job) {
  if (jobStage(job) !== 'place') return job;
  return { ...job, index: job.index + 1 };
}

/** The job once the person has been told it is fixed. */
export function finish(job) {
  return { ...job, finished: true };
}

/** Short status for the ticket list, like "Next: Parts cabinet" or "Next: back to Sana". */
export function jobLabel(job, employee) {
  const stage = jobStage(job);
  if (stage === 'place') return `Next: ${PLACES[currentStep(job).place].name}`;
  if (stage === 'return') return `Next: back to ${employee}`;
  return '';
}

/**
 * The nearest place with a step waiting, if the player is close enough.
 * jobs: [{ ticket, job }]. Returns { ticket, job, step, place } or null.
 */
export function placeInReach(position, jobs, radius = PLACE_RADIUS) {
  let best = null;
  let bestDist = Infinity;
  for (const entry of jobs) {
    const step = currentStep(entry.job);
    if (!step) continue;
    const place = PLACES[step.place];
    const dist = Math.hypot(place.x - position.x, place.z - position.z);
    if (dist <= radius && (best === null || dist < bestDist)) { // ties: the earlier ticket wins
      best = { ...entry, step, place };
      bestDist = dist;
    }
  }
  return best;
}

/** Places that have a step waiting (for markers on the map), without repeats. */
export function placesWaiting(jobs) {
  return [...new Set(jobs.map((e) => currentStep(e.job)?.place).filter(Boolean))];
}
