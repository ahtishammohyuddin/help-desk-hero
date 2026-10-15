// Moves office staff around: from their desk to a break spot and back, or into a meeting.
// The decisions come from life.js (tested); routes come from nav.js (tested).

import { chooseBreak, isAway, MAX_AWAY, MEETING_EVERY, nextBreakIn, planMeeting } from './life.js';
import { findPath } from './nav.js';
import { animateWalk, sitDown, standUp } from './people.js';

const WALK_SPEED = 1.5;
const TURN = 8;
const OFF = { minX: 1e6, maxX: 1e6, minZ: 1e6, maxZ: 1e6 };

function setCollider(person, x, z) {
  if (!person.collider) return;
  Object.assign(person.collider, x === null ? OFF : { minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
}

function turnTo(group, target, dt) {
  let diff = target - group.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  group.rotation.y += diff * Math.min(1, TURN * dt);
}

/**
 * employees: from createEmployees (each gets desk position, collider). grid: nav grid.
 * isBusy(person): true while they have an open ticket or are talking to the player.
 */
export function createStaffLife({ employees, grid, isBusy, isTalking, rng = Math.random }) {
  const taken = new Set();
  let meetingIn = MEETING_EVERY[0] / 2 + rng() * 30;
  for (const p of employees) {
    p.life = { mode: 'desk', nextBreak: nextBreakIn(rng) * (0.5 + rng()), path: [], spot: null, until: 0, activity: null, phase: 0 };
    p.deskX = p.x;
    p.deskZ = p.z;
    p.deskFacing = p.facing;
  }

  function send(p, spot, seconds, activity) {
    const path = findPath(grid, { x: p.x, z: p.z }, spot);
    if (!path) return false;
    standUp(p.group);
    p.life = { ...p.life, mode: 'going', path: [...path, { x: spot.x, z: spot.z }], spot, until: seconds, activity };
    taken.add(spot.id);
    setCollider(p, null);
    return true;
  }

  function goBack(p) {
    if (p.life.spot) taken.delete(p.life.spot.id);
    const desk = { x: p.deskX, z: p.deskZ };
    const path = findPath(grid, { x: p.x, z: p.z }, desk) ?? [];
    standUp(p.group);
    p.life = { ...p.life, mode: 'back', path: [...path, desk], spot: null, activity: null };
    setCollider(p, null);
  }

  function arrive(p) {
    const { mode, spot } = p.life;
    if (mode === 'going') {
      p.group.rotation.y = spot.facing;
      p.facing = spot.facing;
      if (spot.sit) sitDown(p.group);
      else {
        standUp(p.group);
        p.group.userData.limbs.leftArm.rotation.x = p.group.userData.limbs.rightArm.rotation.x = -0.8; // hands on the controls / the cup
      }
      setCollider(p, spot.x, spot.z);
      p.life = { ...p.life, mode: 'there', path: [] };
    } else {
      p.x = p.deskX;
      p.z = p.deskZ;
      p.group.position.set(p.x, 0, p.z);
      p.group.rotation.y = p.deskFacing;
      p.facing = p.deskFacing;
      sitDown(p.group);
      setCollider(p, p.x, p.z);
      p.life = { ...p.life, mode: 'desk', path: [], nextBreak: nextBreakIn(rng) };
    }
  }

  function walk(p, dt) {
    const next = p.life.path[0];
    const dx = next.x - p.x;
    const dz = next.z - p.z;
    const dist = Math.hypot(dx, dz);
    const step = WALK_SPEED * dt;
    if (dist <= step) {
      p.x = next.x;
      p.z = next.z;
      p.life.path.shift();
    } else {
      p.x += (dx / dist) * step;
      p.z += (dz / dist) * step;
      turnTo(p.group, Math.atan2(dx, dz), dt);
    }
    p.group.position.set(p.x, 0, p.z);
    p.life.phase += dt * 8;
    animateWalk(p.group, p.life.phase, 0.7);
    if (!p.life.path.length) arrive(p);
  }

  return {
    update(dt) {
      // Meetings: every couple of minutes, a few people at their desks get together.
      meetingIn -= dt;
      if (meetingIn <= 0) {
        meetingIn = MEETING_EVERY[0] + rng() * (MEETING_EVERY[1] - MEETING_EVERY[0]);
        const meetingBusy = employees.some((p) => p.life.activity === 'meeting');
        const idle = employees.filter((p) => p.life.mode === 'desk' && !isBusy(p)).map((p) => p.name);
        const plan = meetingBusy ? null : planMeeting(idle, rng);
        if (plan) for (const { name, spot } of plan.people) send(employees.find((e) => e.name === name), spot, plan.seconds, 'meeting');
      }
      let away = employees.filter((p) => isAway(p.life.mode) && p.life.activity !== 'meeting').length;
      for (const p of employees) {
        if (isTalking(p)) continue; // stand still while the player talks to them
        const l = p.life;
        if (isBusy(p) && (l.mode === 'going' || l.mode === 'there')) {
          goBack(p); // they need help at their desk
          continue;
        }
        if (l.mode === 'desk') {
          l.nextBreak -= dt;
          if (l.nextBreak <= 0) {
            l.nextBreak = nextBreakIn(rng);
            if (!isBusy(p) && away < MAX_AWAY) {
              const b = chooseBreak(p.name, taken, rng);
              if (b && send(p, b.spot, b.seconds, b.activity)) away += 1;
            }
          }
        } else if (l.mode === 'going' || l.mode === 'back') {
          walk(p, dt);
        } else if (l.mode === 'there') {
          l.until -= dt;
          if (l.until <= 0) goBack(p);
        }
      }
    },
    /** What the screens should show: is anyone watching the TV, is a meeting on? */
    status() {
      const there = employees.filter((p) => p.life.mode === 'there');
      return {
        tvOn: there.some((p) => p.life.activity === 'lounge'),
        meetingOn: there.some((p) => p.life.activity === 'meeting'),
      };
    },
    /** A short line for the name tag, e.g. "in a meeting". */
    doing(p) {
      return p.life?.mode === 'there' ? p.life.activity : p.life?.mode === 'desk' ? null : 'walking';
    },
  };
}
