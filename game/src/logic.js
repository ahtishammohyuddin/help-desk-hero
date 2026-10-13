// Pure game logic: no Three.js, no browser. This keeps it easy to test with Node.
//
// The office floor is flat, so all collision happens in 2D (the X/Z ground plane).
// Walls and furniture are axis-aligned boxes: { minX, maxX, minZ, maxZ }.
// The player is a circle with a radius.

/** True if a circle at (x, z) with radius r overlaps box b. */
export function circleHitsBox(x, z, r, b) {
  // Closest point on the box to the circle centre, then compare distance with the radius.
  const cx = Math.max(b.minX, Math.min(x, b.maxX));
  const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

/**
 * Move a circle by (dx, dz) without entering any box.
 * X and Z are tried separately, so the player slides along walls
 * instead of stopping dead when walking into them at an angle.
 */
export function moveWithCollisions(pos, dx, dz, r, boxes) {
  let { x, z } = pos;
  if (!boxes.some((b) => circleHitsBox(x + dx, z, r, b))) x += dx;
  if (!boxes.some((b) => circleHitsBox(x, z + dz, r, b))) z += dz;
  return { x, z };
}

/** The item in `items` (each with x and z) closest to pos, if within radius. */
export function nearestWithin(pos, items, radius) {
  let best = null;
  let bestDist = radius * radius;
  for (const item of items) {
    const d = (item.x - pos.x) ** 2 + (item.z - pos.z) ** 2;
    if (d <= bestDist) {
      best = item;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Turn key input into a world direction, relative to where the camera looks.
 * yaw = camera angle around the player (0 means the camera is south, looking north).
 * Returns a vector of length 0 or 1.
 */
export function moveDirection(input, yaw) {
  const forward = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const right = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (forward === 0 && right === 0) return { x: 0, z: 0 };

  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  // Camera forward on the ground is (-sin, -cos); camera right is (cos, -sin).
  let x = forward * -sin + right * cos;
  let z = forward * -cos + right * -sin;
  const len = Math.hypot(x, z);
  x /= len;
  z /= len;
  return { x, z };
}

/** Rotate angle `from` toward `to` by at most `step`, taking the short way round. */
export function turnToward(from, to, step) {
  let diff = ((to - from + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  if (Math.abs(diff) <= step) return to;
  return from + Math.sign(diff) * step;
}
