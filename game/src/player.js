// The player: an IT technician you move with WASD or the arrow keys.

import { animateWalk, makePerson } from './people.js';
import { moveDirection, moveWithCollisions, stepsBetween, turnToward } from './logic.js';

const WALK_SPEED = 3.6; // units per second
const RUN_SPEED = 6.0;
const RADIUS = 0.35;
const TURN_SPEED = 12; // radians per second

export function createPlayer(scene, start) {
  const group = makePerson({ shirt: 0x2563a8, hair: 0x1b1310, trousers: 0x232a33, badge: true });
  group.position.set(start.x, 0, start.z);
  scene.add(group);

  let walkTime = 0;
  let stride = 0; // 0 standing .. 1 full stride, eased so legs don't snap

  return {
    group,
    onStep: null, // called once per footstep (for the footstep sound)
    speedMult: 1, // above 1 while the coffee boost lasts
    get position() {
      return group.position;
    },

    update(dt, input, cameraYaw, colliders, frozen) {
      const dir = frozen ? { x: 0, z: 0 } : moveDirection(input, cameraYaw);
      const moving = dir.x !== 0 || dir.z !== 0;

      if (moving) {
        const speed = (input.run ? RUN_SPEED : WALK_SPEED) * this.speedMult;
        const next = moveWithCollisions(group.position, dir.x * speed * dt, dir.z * speed * dt, RADIUS, colliders);
        group.position.x = next.x;
        group.position.z = next.z;
        group.rotation.y = turnToward(group.rotation.y, Math.atan2(dir.x, dir.z), TURN_SPEED * dt);
        const before = walkTime;
        walkTime += dt * (input.run ? 10.5 : 7.2); // about 2 steps a second when walking
        // A foot lands each time the stride passes the middle (twice per full stride).
        if (stepsBetween(before, walkTime) > 0) this.onStep?.();
      }
      // Ease the stride in when starting and out when stopping.
      const targetStride = moving ? (input.run ? 1 : 0.75) : 0;
      stride += (targetStride - stride) * Math.min(1, dt * 10);
      animateWalk(group, walkTime, stride);
      // Body rises slightly on each step (twice per stride), in time with the legs.
      group.position.y = Math.abs(Math.sin(walkTime)) * 0.05 * stride;
    },

    /** Turn to face a point, e.g. the person you are talking to. */
    face(x, z) {
      group.rotation.y = Math.atan2(x - group.position.x, z - group.position.z);
    },
  };
}
