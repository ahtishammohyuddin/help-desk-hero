// Builds the office from simple shapes (boxes, cylinders, spheres).
// Later we can swap any piece for a real low-poly model without changing the rest.
//
// Coordinates: X runs west (-) to east (+), Z runs north (-) to south (+), Y is up.
// The office floor covers X -20..20 and Z -14..14. One unit is roughly one metre.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const BOUNDS = { minX: -20, maxX: 20, minZ: -14, maxZ: 14 };
export const PLAYER_START = { x: -15, z: 9 };

const COLORS = {
  floor: 0xe8e2d8,
  outside: 0xcfd7de,
  wall: 0xf4f1ec,
  wallTrim: 0xcfc8bd,
  carpetOffice: 0xc8d2db,
  carpetPrint: 0xdacdb5,
  carpetHelp: 0xcadfd2,
  serverFloor: 0x7d8895,
  desk: 0xd9c3a0,
  deskLeg: 0x5d6670,
  divider: 0x8fa3b5,
  monitor: 0x1f252d,
  screen: 0x8fc7ff,
  chair: 0x37414d,
  rack: 0x2a3038,
  printer: 0xeceff2,
  printerDark: 0x4a525c,
  plantPot: 0xc0704b,
  plant: 0x5f9e5a,
  glass: 0xa9d6e8,
};

/** Builds everything into `scene`. Returns colliders and things that animate. */
export function buildOffice(scene) {
  // Furniture is built into `root` first, then merged into a few big meshes (one per material).
  // Drawing 30 merged meshes is far faster than drawing 350 small ones, which is what made the game lag.
  const root = new THREE.Group();
  const colliders = [];
  const blinkers = []; // server LEDs

  // Material cache so identical colours share one material (faster to draw).
  const materials = new Map();
  const mat = (color, extra = {}) => {
    const key = color + JSON.stringify(extra);
    if (!materials.has(key)) {
      materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }));
    }
    return materials.get(key);
  };

  /** Add a box. (x, z) is the centre on the floor; y is the height of its bottom. */
  function box(w, h, d, color, x, y, z, { collide = false, cast = true, extra } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, extra));
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    root.add(mesh);
    if (collide) addCollider(x, z, w, d);
    return mesh;
  }

  function addCollider(x, z, w, d) {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  function floorPatch(minX, maxX, minZ, maxZ, color, y = 0.005) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ), mat(color));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((minX + maxX) / 2, y, (minZ + maxZ) / 2);
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  // ---------- floor ----------
  floorPatch(-60, 60, -50, 50, COLORS.outside, -0.02);
  floorPatch(BOUNDS.minX, BOUNDS.maxX, BOUNDS.minZ, BOUNDS.maxZ, COLORS.floor, 0);
  floorPatch(-12, 9, -12.5, 4.5, COLORS.carpetOffice);   // open office
  floorPatch(-20, -13, -14, -7.5, COLORS.carpetPrint);   // printer corner
  floorPatch(-20, -11, 5.5, 14, COLORS.carpetHelp);      // IT help desk
  floorPatch(10, 20, -14, -6, COLORS.serverFloor);       // server room

  // ---------- outer walls ----------
  const T = 0.3; // wall thickness
  const H = 3; // wall height
  box(40 + 2 * T, H, T, COLORS.wall, 0, 0, BOUNDS.minZ - T / 2, { collide: true }); // north
  box(T, H, 28, COLORS.wall, BOUNDS.minX - T / 2, 0, 0, { collide: true }); // west
  box(T, H, 28, COLORS.wall, BOUNDS.maxX + T / 2, 0, 0, { collide: true }); // east
  // South wall is low so the camera can see over it. Gap in the middle is the entrance.
  box(18, 1, T, COLORS.wall, -11, 0, BOUNDS.maxZ + T / 2, { collide: true });
  box(18, 1, T, COLORS.wall, 11, 0, BOUNDS.maxZ + T / 2, { collide: true });
  box(4, 2.2, 0.1, COLORS.glass, 0, 0, BOUNDS.maxZ + T / 2, {
    collide: true, cast: false, extra: { transparent: true, opacity: 0.3 },
  }); // glass entrance door
  box(3, 0.02, 1.2, 0x6b4f3a, 0, 0, 13.2, { cast: false }); // doormat
  // Skirting trim along the inside of the tall walls
  box(40, 0.12, 0.05, COLORS.wallTrim, 0, 0, BOUNDS.minZ + 0.03);
  box(0.05, 0.12, 28, COLORS.wallTrim, BOUNDS.minX + 0.03, 0, 0);
  box(0.05, 0.12, 28, COLORS.wallTrim, BOUNDS.maxX - 0.03, 0, 0);

  // ---------- server room (glass walls, door gap at x 13..15) ----------
  const glass = { collide: true, cast: false, extra: { transparent: true, opacity: 0.25 } };
  box(3, H, 0.1, COLORS.glass, 11.5, 0, -6, glass);
  box(5, H, 0.1, COLORS.glass, 17.5, 0, -6, glass);
  box(0.1, H, 8, COLORS.glass, 10, 0, -10, glass);
  box(2, 0.12, 0.12, 0x6c7783, 14, H - 0.12, -6); // door frame top
  // Three blink groups share three materials, so all LEDs merge into three meshes.
  const ledMaterials = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ color: 0x0b1a0f, emissive: 0x39ff6a, emissiveIntensity: 1 }));
  ledMaterials.forEach((material, k) => blinkers.push({ material, speed: 2 + k * 1.7, phase: k * 2.1 }));
  for (let i = 0; i < 5; i++) {
    const rx = 11.6 + i * 1.6;
    box(1.1, 2.2, 1, COLORS.rack, rx, 0, -12.8, { collide: true });
    for (let row = 0; row < 6; row++) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.02), ledMaterials[(i + row) % 3]);
      led.position.set(rx - 0.35 + (row % 2) * 0.12, 0.5 + row * 0.25, -12.29);
      root.add(led);
    }
  }
  box(1.4, 0.75, 0.7, COLORS.desk, 18.2, 0, -8.2, { collide: true }); // admin bench
  monitor(18.2, -8.35, 0);
  sign('SERVER ROOM', 2.4, 0.5, 0x1f2a36, '#9fe7ff', 14, 2.55, -5.94, 0);

  // ---------- printer corner ----------
  box(1.6, 0.9, 0.8, COLORS.printerDark, -17.6, 0, -13.2, { collide: true }); // cabinet
  box(1.2, 0.55, 0.7, COLORS.printer, -17.6, 0.9, -13.2); // printer body
  box(0.9, 0.06, 0.4, 0xffffff, -17.6, 1.45, -13.1); // paper on top
  box(1.3, 1.25, 0.9, COLORS.printer, -14.8, 0, -13.1, { collide: true }); // big multifunction printer
  box(1.0, 0.08, 0.6, COLORS.printerDark, -14.8, 1.25, -13.1); // scanner lid
  box(0.5, 1.6, 2.4, 0x9b8064, -19.6, 0, -10, { collide: true }); // paper shelf
  for (let i = 0; i < 4; i++) box(0.35, 0.18, 0.5, 0xffffff, -19.6, 0.25 + i * 0.35, -10.6 + (i % 2) * 1.2);
  sign('PRINT & SCAN', 2.4, 0.5, 0x3a2f24, '#ffd58a', -16.2, 2.4, -13.84, 0);

  // ---------- IT help desk (where the player starts) ----------
  box(2.8, 0.75, 0.9, COLORS.desk, -16, 0, 11.2, { collide: true });
  monitor(-16.6, 11.4, Math.PI);
  monitor(-15.4, 11.4, Math.PI);
  chair(-16, 10.1, 0);
  // Spare-parts cabinet against the west wall, facing into the room (physical fixes start here).
  box(0.5, 1.9, 0.9, COLORS.printerDark, -19.6, 0, 8, { collide: true });
  box(0.02, 1.7, 0.02, 0x9aa4ae, -19.34, 0.1, 8); // gap between the two doors
  sign('SPARE PARTS', 0.8, 0.22, 0xffc94a, '#1f2a37', -19.33, 1.6, 8, Math.PI / 2);
  // Repair bench against the west wall: anti-static mat, a PC on it, a lamp and a tool tray.
  box(0.9, 0.75, 1.9, 0x8a6f52, -19.45, 0, 12.6, { collide: true }); // bench
  box(0.7, 0.01, 1.3, 0x2f8f5b, -19.4, 0.75, 12.5, { cast: false }); // green anti-static mat
  box(0.42, 0.45, 0.2, 0x2b313a, -19.5, 0.76, 13.2); // a PC waiting for repair
  box(0.3, 0.06, 0.4, 0xc0392b, -19.5, 0.76, 11.95); // red tool tray
  box(0.05, 0.6, 0.05, 0x5b6b7c, -19.75, 0.76, 12.0); // lamp arm
  box(0.25, 0.08, 0.18, 0xffd36b, -19.6, 1.36, 12.0, { extra: { emissive: 0xffd36b, emissiveIntensity: 0.4 } }); // lamp head
  sign('REPAIR BENCH', 1.0, 0.24, 0x2f8f5b, '#ffffff', -19.84, 1.75, 12.6, Math.PI / 2);
  box(1.2, 0.8, 0.8, 0x7a8a9a, -12.2, 0, 13.2, { collide: true }); // returns trolley
  sign('IT HELP DESK', 3, 0.6, 0x14335a, '#ffffff', -19.84, 2.2, 10, Math.PI / 2);

  // ---------- open office: four desk pods ----------
  const pods = [
    [-7, -8.5], [2, -8.5],
    [-7, -1.5], [2, -1.5],
  ];
  for (const [cx, cz] of pods) deskPod(cx, cz);

  // ---------- reception ----------
  box(3, 0.75, 0.8, COLORS.desk, 12, 0, 9.5, { collide: true });
  box(3, 1.1, 0.12, COLORS.divider, 12, 0, 9.96, { collide: true }); // front panel
  box(3.1, 0.05, 0.4, 0xbfa57e, 12, 1.1, 10.0); // counter top
  monitor(11.4, 9.6, Math.PI);
  chair(11.4, 8.6, 0);
  box(2.4, 0.45, 0.8, 0x7f95a8, 16.5, 0, 12.6, { collide: true }); // waiting sofa
  box(2.4, 0.5, 0.2, 0x6c8296, 16.5, 0.45, 12.95);
  sign('WELCOME', 2.2, 0.5, 0x2c3e50, '#ffffff', 19.84, 2.2, 9.5, -Math.PI / 2);

  // ---------- extras ----------
  box(2.6, 1.3, 0.05, 0xffffff, -2.5, 1.0, -13.95); // whiteboard
  box(2.7, 0.06, 0.12, 0x9aa4ae, -2.5, 0.95, -13.9); // whiteboard tray
  waterCooler(4.5, -13.3);
  for (const [px, pz] of [[-11.4, 4.2], [8.4, 4.2], [-11.4, -12.2], [19.2, 13.2], [8.6, -12.6], [-19.2, 5.2]]) {
    plant(px, pz);
  }

  mergeStatic(root, scene);
  return { colliders, blinkers };

  // ---------- small furniture helpers ----------

  function monitor(x, z, facing) {
    const g = new THREE.Group();
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), mat(COLORS.monitor));
    stand.position.y = 0.15;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.05), mat(COLORS.monitor));
    frame.position.y = 0.45;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.34),
      mat(COLORS.screen, { emissive: COLORS.screen, emissiveIntensity: 0.55 }),
    );
    screen.position.set(0, 0.45, 0.026);
    for (const m of [stand, frame]) m.castShadow = true;
    g.add(stand, frame, screen);
    g.position.set(x, 0.79, z);
    g.rotation.y = facing;
    root.add(g);
  }

  function chair(x, z, facing) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), mat(COLORS.chair));
    seat.position.y = 0.45;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.07), mat(COLORS.chair));
    back.position.set(0, 0.75, -0.22);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4), mat(COLORS.deskLeg));
    post.position.y = 0.22;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 10), mat(COLORS.deskLeg));
    base.position.y = 0.03;
    for (const m of [seat, back, post, base]) m.castShadow = true;
    g.add(seat, back, post, base);
    g.position.set(x, 0, z);
    g.rotation.y = facing;
    root.add(g);
  }

  /** Four desks: two facing north, two facing south, with a low divider. */
  function deskPod(cx, cz) {
    for (const side of [-1, 1]) {
      for (const dx of [-0.85, 0.85]) {
        const z = cz + side * 0.45;
        box(1.6, 0.05, 0.8, COLORS.desk, cx + dx, 0.72, z);
        box(0.05, 0.72, 0.7, COLORS.deskLeg, cx + dx - 0.75, 0, z);
        box(0.05, 0.72, 0.7, COLORS.deskLeg, cx + dx + 0.75, 0, z);
        // Monitor sits near the divider, facing the chair on the outside.
        monitor(cx + dx, cz + side * 0.2, side > 0 ? 0 : Math.PI);
        chair(cx + dx, cz + side * 1.3, side > 0 ? Math.PI : 0);
      }
    }
    box(3.4, 0.45, 0.06, COLORS.divider, cx, 0.77, cz); // divider
    addCollider(cx, cz, 3.4, 1.8);
  }

  function plant(x, z) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 10), mat(COLORS.plantPot));
    pot.position.set(x, 0.25, z);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mat(COLORS.plant, { flatShading: true }));
    leaves.position.set(x, 0.95, z);
    pot.castShadow = leaves.castShadow = true;
    root.add(pot, leaves);
    addCollider(x, z, 0.6, 0.6);
  }

  function waterCooler(x, z) {
    box(0.45, 1.0, 0.45, 0xe4e8ec, x, 0, z, { collide: true });
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.45, 12),
      mat(0x8ccbe8, { transparent: true, opacity: 0.7 }),
    );
    bottle.position.set(x, 1.23, z);
    root.add(bottle);
  }

  /** A flat sign with text, drawn on a canvas and used as a texture. */
  function sign(text, w, h, bg, fg, x, y, z, rotY) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = Math.round((512 * h) / w);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#' + bg.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = fg;
    ctx.font = `700 ${Math.round(canvas.height * 0.5)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    scene.add(mesh);
  }
}

/**
 * Bake every mesh in `root` into one mesh per (material, casts-shadow) pair and add those to the scene.
 * Positions and rotations are applied to the geometry, so the result looks identical.
 */
function mergeStatic(root, scene) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const geometry = (obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone()).applyMatrix4(obj.matrixWorld);
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name); // no textures here
    }
    const key = `${obj.material.uuid}|${obj.castShadow}`;
    if (!buckets.has(key)) buckets.set(key, { material: obj.material, cast: obj.castShadow, geometries: [] });
    buckets.get(key).geometries.push(geometry);
  });
  for (const { material, cast, geometries } of buckets.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.castShadow = cast && !material.transparent;
    mesh.receiveShadow = true;
    scene.add(mesh);
    geometries.forEach((g) => g.dispose());
  }
}
