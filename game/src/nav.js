// Walking routes for office staff: a grid over the floor, with furniture blocked out, and A* search.
// Pure logic (no browser), tested with Node.

export const CELL = 0.5; // metres per grid cell

/**
 * Build the walk grid. colliders: [{ minX, maxX, minZ, maxZ }] (furniture and walls).
 * inflate keeps people a little away from furniture so they do not clip through it.
 */
export function buildGrid(colliders, bounds, { cell = CELL, inflate = 0.3 } = {}) {
  const cols = Math.round((bounds.maxX - bounds.minX) / cell);
  const rows = Math.round((bounds.maxZ - bounds.minZ) / cell);
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = bounds.minX + (c + 0.5) * cell;
      const z = bounds.minZ + (r + 0.5) * cell;
      const edge = x < bounds.minX + inflate || x > bounds.maxX - inflate || z < bounds.minZ + inflate || z > bounds.maxZ - inflate;
      if (edge || colliders.some((b) => x > b.minX - inflate && x < b.maxX + inflate && z > b.minZ - inflate && z < b.maxZ + inflate)) {
        blocked[r * cols + c] = 1;
      }
    }
  }
  return { cols, rows, cell, bounds, blocked };
}

export const toCell = (g, x, z) => ({
  c: Math.min(g.cols - 1, Math.max(0, Math.floor((x - g.bounds.minX) / g.cell))),
  r: Math.min(g.rows - 1, Math.max(0, Math.floor((z - g.bounds.minZ) / g.cell))),
});
export const toPoint = (g, c, r) => ({ x: g.bounds.minX + (c + 0.5) * g.cell, z: g.bounds.minZ + (r + 0.5) * g.cell });
export const isFree = (g, c, r) => c >= 0 && r >= 0 && c < g.cols && r < g.rows && !g.blocked[r * g.cols + c];

/** The nearest free cell to (x, z): seats are often inside a chair or sofa, so we stop next to them. */
export function nearestFree(g, x, z) {
  const start = toCell(g, x, z);
  if (isFree(g, start.c, start.r)) return start;
  for (let d = 1; d < 12; d++) {
    let best = null;
    let bestDist = Infinity;
    for (let dr = -d; dr <= d; dr++) {
      for (let dc = -d; dc <= d; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== d || !isFree(g, start.c + dc, start.r + dr)) continue;
        const p = toPoint(g, start.c + dc, start.r + dr);
        const dist = Math.hypot(p.x - x, p.z - z);
        if (dist < bestDist) {
          bestDist = dist;
          best = { c: start.c + dc, r: start.r + dr };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/** A* from one point to another. Returns a list of points (start excluded), or null if there is no way. */
export function findPath(g, from, to) {
  const a = nearestFree(g, from.x, from.z);
  const b = nearestFree(g, to.x, to.z);
  if (!a || !b) return null;
  const key = (c, r) => r * g.cols + c;
  const goal = key(b.c, b.r);
  const open = new Map([[key(a.c, a.r), { c: a.c, r: a.r, g: 0, f: 0 }]]);
  const came = new Map();
  const cost = new Map([[key(a.c, a.r), 0]]);
  const h = (c, r) => Math.hypot(c - b.c, r - b.r);
  while (open.size) {
    let cur = null;
    for (const n of open.values()) if (!cur || n.f < cur.f) cur = n;
    const ck = key(cur.c, cur.r);
    if (ck === goal) {
      const cells = [];
      for (let k = ck; k !== undefined; k = came.get(k)) cells.push(k);
      cells.reverse();
      return smooth(g, cells.map((k) => toPoint(g, k % g.cols, Math.floor(k / g.cols))));
    }
    open.delete(ck);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nc = cur.c + dc;
      const nr = cur.r + dr;
      if (!isFree(g, nc, nr)) continue;
      if (dc && dr && (!isFree(g, cur.c + dc, cur.r) || !isFree(g, cur.c, cur.r + dr))) continue; // no cutting corners
      const nk = key(nc, nr);
      const ng = cur.g + (dc && dr ? Math.SQRT2 : 1);
      if (ng >= (cost.get(nk) ?? Infinity)) continue;
      cost.set(nk, ng);
      came.set(nk, ck);
      open.set(nk, { c: nc, r: nr, g: ng, f: ng + h(nc, nr) });
    }
  }
  return null;
}

/** Can someone walk in a straight line between two points without touching blocked cells? */
export function clearLine(g, p, q) {
  const steps = Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / (g.cell / 3));
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    const { c, r } = toCell(g, p.x + (q.x - p.x) * t, p.z + (q.z - p.z) * t);
    if (!isFree(g, c, r)) return false;
  }
  return true;
}

/** Drop in-between points that a straight walk can skip, so routes look natural. */
export function smooth(g, points) {
  if (points.length <= 2) return points.slice(1);
  const out = [];
  let anchor = points[0];
  for (let i = 1; i < points.length; i++) {
    const next = points[i + 1];
    if (!next || !clearLine(g, anchor, next)) {
      out.push(points[i]);
      anchor = points[i];
    }
  }
  return out;
}
