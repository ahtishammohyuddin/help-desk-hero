// Builds the office from simple shapes (boxes, cylinders, spheres).
// Later we can swap any piece for a real low-poly model without changing the rest.
//
// Coordinates: X runs west (-) to east (+), Z runs north (-) to south (+), Y is up.
// The main office covers X -20..20 and Z -14..14; the east wing (kitchen, lounge, meeting room,
// learning corner) covers X 20..36, and the manager's office and phone booths X 36..46.
// One unit is roughly one metre.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addHeadset, makePerson, sitDown } from './people.js';

export const BOUNDS = { minX: -20, maxX: 46, minZ: -14, maxZ: 14 };
export const WING_MAX_X = 36; // the wall between the east wing and the manager's office / phone booths
export const MAIN_MAX_X = 20; // the wall between the main office and the east wing
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
  kitchenFloor: 0xd9d4ca,
  loungeRug: 0x7b8fa6,
  meetingCarpet: 0xbfc8d4,
  learnCarpet: 0xd8cfe6,
  sofa: 0x4f6d8f,
  wood: 0x9b7653,
  counter: 0xe9e4dc,
  fridge: 0xdfe4e8,
  managerFloor: 0x6b4f3a,
  managerRug: 0x8c2f39,
  leather: 0x3b2418,
  boothFloor: 0xc9d6cf,
};

/** Builds everything into `scene`. Returns colliders and things that animate. */
export function buildOffice(scene) {
  // Furniture is built into `root` first, then merged into a few big meshes (one per material).
  // Drawing 30 merged meshes is far faster than drawing 350 small ones, which is what made the game lag.
  const root = new THREE.Group();
  const colliders = [];
  const windowGlass = new THREE.MeshStandardMaterial({ color: 0xa9d6e8, emissive: 0xcfe9ff, emissiveIntensity: 0.6, roughness: 0.2 });
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
  floorPatch(20.2, 36, -14, -6.5, COLORS.kitchenFloor);   // kitchen
  floorPatch(22, 31, -4.2, 3.8, COLORS.loungeRug);       // lounge rug
  floorPatch(26.2, 36, 6, 14, COLORS.meetingCarpet);      // meeting room
  floorPatch(20.2, 26, 6, 14, COLORS.learnCarpet);        // learning corner
  floorPatch(36.2, 46, -14, -1.2, COLORS.managerFloor);   // manager's office (wood)
  floorPatch(39.5, 44.5, -10.5, -5.5, COLORS.managerRug, 0.01); // rug under the desk area
  floorPatch(36.2, 46, -0.8, 14, COLORS.boothFloor);      // phone booths and lockers

  // ---------- outer walls ----------
  const T = 0.3; // wall thickness
  const H = 3; // wall height
  const width = BOUNDS.maxX - BOUNDS.minX;
  const midX = (BOUNDS.maxX + BOUNDS.minX) / 2;
  box(width + 2 * T, H, T, COLORS.wall, midX, 0, BOUNDS.minZ - T / 2, { collide: true }); // north
  box(T, H, 28, COLORS.wall, BOUNDS.minX - T / 2, 0, 0, { collide: true }); // west
  box(T, H, 28, COLORS.wall, BOUNDS.maxX + T / 2, 0, 0, { collide: true }); // east
  // The old east wall, now between the main office and the east wing, with a wide opening in the middle.
  box(T, H, 9, COLORS.wall, MAIN_MAX_X + T / 2, 0, -9.5, { collide: true });
  box(T, H, 9, COLORS.wall, MAIN_MAX_X + T / 2, 0, 9.5, { collide: true });
  // South wall is low so the camera can see over it. Gap in the middle is the entrance.
  box(18, 1, T, COLORS.wall, -11, 0, BOUNDS.maxZ + T / 2, { collide: true });
  box(18, 1, T, COLORS.wall, 11, 0, BOUNDS.maxZ + T / 2, { collide: true });
  box(16, 1, T, COLORS.wall, 28, 0, BOUNDS.maxZ + T / 2, { collide: true }); // east wing
  box(10, 1, T, COLORS.wall, 41, 0, BOUNDS.maxZ + T / 2, { collide: true }); // manager's office side
  // Wall between the east wing and the new rooms, with a door to each (manager z -4.4..-2.6, booths z 2.6..4.4).
  box(T, H, 9.6, COLORS.wall, WING_MAX_X + T / 2, 0, -9.2, { collide: true });
  box(T, H, 5.2, COLORS.wall, WING_MAX_X + T / 2, 0, 0, { collide: true });
  box(T, H, 9.6, COLORS.wall, WING_MAX_X + T / 2, 0, 9.2, { collide: true });
  // Wall between the manager's office and the booths area, door near the east end is not needed: closed wall.
  box(9.8, H, T, COLORS.wall, 41.1, 0, -1, { collide: true });
  box(4, 2.2, 0.1, COLORS.glass, 0, 0, BOUNDS.maxZ + T / 2, {
    collide: true, cast: false, extra: { transparent: true, opacity: 0.3 },
  }); // glass entrance door
  box(3, 0.02, 1.2, 0x6b4f3a, 0, 0, 13.2, { cast: false }); // doormat
  // Skirting trim along the inside of the tall walls
  box(width, 0.12, 0.05, COLORS.wallTrim, midX, 0, BOUNDS.minZ + 0.03);
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

  // ---------- east wing: kitchen ----------
  box(9, 0.9, 0.7, COLORS.counter, 26.5, 0, -13.5, { collide: true }); // counter
  box(9, 0.05, 0.75, 0x8a8f96, 26.5, 0.9, -13.5); // worktop
  box(0.55, 0.6, 0.45, 0x2b313a, 24, 0.95, -13.5); // coffee machine
  box(0.2, 0.08, 0.2, 0xc0392b, 24, 1.3, -13.25); // its button
  box(0.4, 0.3, 0.35, 0xeeeeee, 25.3, 0.95, -13.55); // kettle / microwave
  box(0.9, 0.9, 0.35, 0xb7c2cd, 28.8, 0.95, -13.7); // wall cupboard
  box(1, 2, 0.8, COLORS.fridge, 32, 0, -13.4, { collide: true }); // fridge
  box(0.05, 0.6, 0.04, 0x9aa4ae, 31.6, 1.1, -12.98); // fridge handle
  roundTable(28, -9.8, 0.75);
  chair(28, -10.9, 0); chair(28, -8.7, Math.PI); chair(26.9, -9.8, Math.PI / 2); chair(29.1, -9.8, -Math.PI / 2);
  box(0.4, 0.4, 0.3, 0xd33a3a, 34.8, 1.2, -13.8); // first aid box
  box(0.25, 0.08, 0.31, 0xffffff, 34.8, 1.36, -13.64);
  sign('KITCHEN', 1.8, 0.45, 0x5b3a1e, '#ffe2b8', 28, 2.3, -13.84, 0);
  plant(35.2, -7.4);

  // ---------- east wing: lounge (sofa, TV, game corner) ----------
  box(0.9, 0.45, 3.2, COLORS.sofa, 23.2, 0, 0, { collide: true }); // sofa seat
  box(0.25, 0.55, 3.2, 0x435d7a, 22.8, 0.45, 0); // sofa back
  box(0.9, 0.6, 0.25, 0x435d7a, 23.2, 0, -1.6); // arms
  box(0.9, 0.6, 0.25, 0x435d7a, 23.2, 0, 1.6);
  box(1.0, 0.4, 1.6, COLORS.wood, 25.6, 0, 0, { collide: true }); // coffee table
  box(0.5, 0.75, 1.0, 0x2b313a, 30.2, 0, 0, { collide: true }); // TV stand
  box(0.08, 1.1, 2.0, 0x11161c, 30.2, 0.95, 0); // TV
  const tvScreen = liveScreen(1.85, 0.95, 30.14, 1.5, 0, -Math.PI / 2); // TV picture (animated in main.js)
  beanbag(26.6, -2.8, 0xe0a64b);
  beanbag(26.6, 2.8, 0x5aa87a);
  // game corner: an arcade cabinet for the mini-games
  box(0.9, 1.7, 0.8, 0x3a2a6b, 33.6, 0, -2.6, { collide: true });
  box(0.7, 0.5, 0.05, 0x7ee0ff, 33.6, 1.15, -2.18, { extra: { emissive: 0x7ee0ff, emissiveIntensity: 0.6 } });
  box(0.7, 0.12, 0.3, 0x1f1640, 33.6, 0.9, -2.05);
  sign('GAME CORNER', 1.6, 0.4, 0x3a2a6b, '#ffd166', 33.6, 2.05, -2.15, 0);
  box(0.06, 2.4, 0.06, 0x5b6b7c, 26, 0, -4.66); // sign post
  sign('LOUNGE', 1.4, 0.4, 0x2c3e50, '#ffffff', 26, 2.6, -4.6, 0);
  plant(35.2, 4.6);

  // ---------- east wing: meeting room (glass walls, table, projector screen) ----------
  box(0.1, H, 3.2, COLORS.glass, 26.2, 0, 7.6, glass); // west glass, door gap at z 9.2..10.8
  box(0.1, H, 3.2, COLORS.glass, 26.2, 0, 12.4, glass);
  box(9.8, H, 0.1, COLORS.glass, 31.1, 0, 6, glass); // north glass
  box(3.4, 0.75, 1.3, COLORS.desk, 31.4, 0, 10, { collide: true }); // table
  for (const dx of [-1.1, 0, 1.1]) {
    chair(31.4 + dx, 8.9, 0);
    chair(31.4 + dx, 11.1, Math.PI);
  }
  box(0.06, 1.4, 2.6, 0xffffff, 35.8, 0.9, 10); // projector screen
  const projectorScreen = liveScreen(2.5, 1.3, 35.76, 1.6, 10, -Math.PI / 2); // the projected picture
  box(0.4, 0.15, 0.3, 0x2b313a, 31.4, 0.8, 10); // projector on the table
  box(0.4, 0.05, 0.3, 0x1f252d, 30.6, 0.8, 10.2); // conference phone
  sign('MEETING ROOM', 2.2, 0.45, 0x1f2a36, '#ffffff', 31.1, 2.5, 5.94, Math.PI);

  // ---------- east wing: learning corner (PC, bookshelf) ----------
  box(1.8, 0.75, 0.8, COLORS.desk, 23.2, 0, 12.8, { collide: true });
  monitor(23.2, 13.0, Math.PI);
  chair(23.2, 11.9, 0);
  box(0.45, 2, 2.4, COLORS.wood, 20.55, 0, 10.5, { collide: true }); // bookshelf
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 5; i++) {
      const colors = [0x2f6feb, 0xc0392b, 0x1f9d55, 0xb7791f, 0x6c5ce7];
      box(0.3, 0.32, 0.36, colors[(i + row) % 5], 20.75, 0.12 + row * 0.47, 9.6 + i * 0.45);
    }
  }
  sign('LEARNING HUB', 2.2, 0.45, 0x5a4a8a, '#ffffff', 23.2, 2.4, 13.84, Math.PI);
  // An archway over the way in, so you can see from across the office what this area is.
  box(0.14, 2.75, 0.14, 0x5a4a8a, 20.75, 0, 6.15, { collide: true });
  box(0.14, 2.75, 0.14, 0x5a4a8a, 25.6, 0, 6.15, { collide: true });
  box(5.0, 0.12, 0.16, 0x5a4a8a, 23.17, 2.75, 6.15);
  sign('LEARNING HUB', 3.0, 0.5, 0x5a4a8a, '#ffffff', 23.17, 2.42, 6.06, Math.PI); // seen from the north (the way in)
  sign('LEARNING HUB', 3.0, 0.5, 0x5a4a8a, '#ffffff', 23.17, 2.42, 6.24, 0); // seen from inside
  sign('Free courses · Notes · IT roadmaps', 2.6, 0.24, 0xefe9ff, '#3d2f73', 23.17, 2.05, 6.06, Math.PI);
  // A pull-up banner by the learning PC.
  box(0.7, 0.06, 0.25, 0x2b313a, 24.7, 0, 12.4);
  sign('LEARN HERE', 0.66, 1.5, 0x5a4a8a, '#ffffff', 24.7, 0.85, 12.3, Math.PI);

  // ---------- manager's office ----------
  // An executive desk facing the door, leather chair, guest chairs, bookshelf, sofa corner and a big window.
  box(2.6, 0.78, 1.1, 0x4a3022, 43.2, 0, -8, { collide: true }); // desk
  box(2.7, 0.05, 1.2, 0x2b1a12, 43.2, 0.78, -8); // desk top (darker wood)
  box(1.2, 0.78, 0.7, 0x4a3022, 44.2, 0, -6.6, { collide: true }); // return of the L-shaped desk
  monitor(43.6, -8.2, Math.PI / 2); // screen faces Haroon (he sits east of it, looking west)
  box(0.35, 0.03, 0.25, 0xf4f4f4, 42.6, 0.81, -7.7); // papers
  box(0.12, 0.2, 0.12, 0x2f6feb, 42.4, 0.81, -8.4); // pen pot
  executiveChair(44.2, -8, -Math.PI / 2);
  chair(41.6, -8.6, Math.PI / 2);
  chair(41.6, -7.4, Math.PI / 2);
  box(3.2, 2.2, 0.45, COLORS.wood, 41.5, 0, -13.6, { collide: true }); // bookshelf
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 7; i++) {
      const colors = [0x8c2f39, 0x1f2a37, 0xb7791f, 0x2f6feb, 0x5a4a8a];
      box(0.3, 0.34, 0.3, colors[(i * 2 + row) % 5], 40.2 + i * 0.42, 0.15 + row * 0.5, -13.45);
    }
  }
  addWindow(45.92, -7.5, 4.5, -Math.PI / 2); // big window behind the manager's desk
  box(0.1, 1.7, 0.1, 0xffffff, 45.9, 0.65, -9.8); box(0.1, 1.7, 0.1, 0xffffff, 45.9, 0.65, -5.2);
  box(2.2, 0.42, 0.85, COLORS.leather, 38.2, 0, -12.6, { collide: true }); // leather sofa
  box(2.2, 0.5, 0.22, 0x2a170f, 38.2, 0.42, -13.0);
  box(1.0, 0.4, 0.6, 0x2b1a12, 38.2, 0, -11.3, { collide: true }); // coffee table
  box(0.4, 0.04, 0.3, 0xb7791f, 38.2, 0.4, -11.3); // a magazine
  plant(45.2, -13.2);
  plant(37, -2);
  box(0.06, 0.25, 0.7, 0x1f2a37, 36.2, 1.55, -5.2); // nameplate frame by the door (on the wing side)
  sign('MANAGER', 0.65, 0.2, 0x1f2a37, '#e9d39b', 35.82, 1.6, -5.2, -Math.PI / 2);
  sign("MANAGER'S OFFICE", 1.8, 0.4, 0x2b1a12, '#e9d39b', 41.1, 2.4, -1.16, Math.PI);

  // ---------- phone booths and lockers ----------
  // Call team: people on support calls with headsets, in the two booths and at a row of desks.
  const callSeats = []; // [x, z]: a seated person facing east, towards their screen
  for (const bz of [3, 8]) {
    box(0.1, 2.3, 3, COLORS.glass, 42, 0, bz + 1.5, glass); // booth front glass, door gap on the west side
    box(4, 2.3, 0.1, COLORS.glass, 44, 0, bz, glass);
    box(0.9, 0.75, 0.6, COLORS.desk, 45.3, 0, bz + 1.5, { collide: true });
    chair(44.6, bz + 1.5, Math.PI / 2);
    monitor(45.5, bz + 1.5, -Math.PI / 2);
    callSeats.push([44.6, bz + 1.5]);
  }
  for (const cz of [6.2, 8.0, 9.8]) {
    box(0.65, 0.75, 1.3, COLORS.desk, 40.75, 0, cz, { collide: true });
    box(0.65, 0.4, 0.05, COLORS.divider, 40.75, 0.75, cz - 0.67); // low divider between desks
    monitor(40.95, cz, -Math.PI / 2);
    box(0.12, 0.03, 0.4, 0x2b313a, 40.62, 0.76, cz); // keyboard
    chair(40.05, cz, Math.PI / 2);
    callSeats.push([40.05, cz]);
  }
  sign('CALL TEAM', 1.4, 0.3, 0x2c3e50, '#ffffff', 41.9, 2.2, 8.0, -Math.PI / 2);
  box(4, 2.3, 0.1, COLORS.glass, 44, 0, 13, glass);
  for (let i = 0; i < 5; i++) box(0.75, 1.9, 0.5, i % 2 ? 0x5b7fa6 : 0x4a6a8f, 37.2 + i * 0.8, 0, 13.6, { collide: true }); // lockers
  sign('PHONE BOOTHS', 1.6, 0.36, 0x2c3e50, '#ffffff', 41.5, 2.4, -0.84, 0);

  // ---------- small real-office details ----------
  wallClock(-6, -13.82);
  for (const [fx, fz] of [[-3.2, 13.5], [20.8, -4.6], [35.5, 13.4]]) fireExtinguisher(fx, fz);
  sign('EXIT', 0.8, 0.3, 0x1f9d55, '#ffffff', 0, 2.5, 13.84, Math.PI);
  box(0.04, 1.0, 1.6, 0xc8a06b, -19.83, 1.2, 3.5); // IT notice board (cork)
  sign('NOTICE BOARD', 1.4, 0.25, 0x14335a, '#ffffff', -19.8, 1.85, 3.5, Math.PI / 2);
  box(0.12, 0.2, 0.06, 0x2b313a, 15.1, 1.1, -5.92); // badge reader by the server room door
  // new-starter laptop boxes waiting near the repair bench
  box(0.6, 0.12, 0.45, 0xf4f4f4, -17.6, 0, 13.4); box(0.6, 0.12, 0.45, 0xf4f4f4, -17.6, 0.12, 13.4); box(0.6, 0.12, 0.45, 0xf4f4f4, -17.5, 0.24, 13.38);
  // desk phones on every staff desk
  for (const [px, pz] of [[-7.3, -7.95], [3.4, -7.95], [-7.3, -0.95], [3.4, -0.95], [0.6, -2.05], [-6.7, -9.05]]) {
    box(0.22, 0.07, 0.18, 0x2b313a, px, 0.77, pz);
  }

  // ---------- extras ----------
  box(2.6, 1.3, 0.05, 0xffffff, -2.5, 1.0, -13.95); // whiteboard
  box(2.7, 0.06, 0.12, 0x9aa4ae, -2.5, 0.95, -13.9); // whiteboard tray
  waterCooler(4.5, -13.3);
  for (const [px, pz] of [[-11.4, 4.2], [8.4, 4.2], [-11.4, -12.2], [19.2, 13.2], [8.6, -12.6], [-19.2, 5.2]]) {
    plant(px, pz);
  }

  // Windows along the north and west walls of the main office (their glass glows with the daylight).
  for (const wx of [-12, -8.6, 2.2, 5.8]) addWindow(wx, -13.96, 1.8, 0);
  for (const wz of [-7, -2.5]) addWindow(-19.96, wz, 1.8, Math.PI / 2);
  mergeStatic(root, scene);
  const callAgents = makeCallAgents(callSeats);
  return { colliders, blinkers, screens: { tv: tvScreen, projector: projectorScreen }, callAgents, windowGlass };

  /** A window on a wall: white frame and glowing glass. facing: 0 = on the north wall, facing into the room. */
  function addWindow(x, z, width, facing) {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.12, 1.42, 0.05), mat(0xffffff));
    const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(width, 1.3), windowGlass);
    glassPane.position.z = 0.03;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, 0.02), mat(0xffffff));
    bar.position.z = 0.04;
    g.add(frame, glassPane, bar);
    g.position.set(x, 1.55, z);
    g.rotation.y = facing;
    scene.add(g);
  }

  /** Seated people on calls, wearing headsets. They are scenery: they never raise tickets. */
  function makeCallAgents(seats) {
    const looks = [
      { shirt: 0x2f6feb, hair: 0x1a1110, skin: 0xc68a5f },
      { shirt: 0x9b4dca, hair: 0x2b1d14, skin: 0xd9a77e },
      { shirt: 0x1f9d55, hair: 0x15100c, skin: 0xb07a52 },
      { shirt: 0xd35400, hair: 0x3a2a1c, skin: 0xe0b48f },
      { shirt: 0x34495e, hair: 0x23160f, skin: 0xc99a6e },
    ];
    return seats.map(([x, z], i) => {
      const person = makePerson(looks[i % looks.length]);
      addHeadset(person);
      person.position.set(x, 0, z);
      person.rotation.y = Math.PI / 2; // facing east, towards the screen
      sitDown(person);
      scene.add(person);
      colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
      return { group: person, base: person.rotation.y, phase: i * 1.7 };
    });
  }

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

  function executiveChair(x, z, facing) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.6), mat(COLORS.leather));
    seat.position.y = 0.48;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.1), mat(COLORS.leather));
    back.position.set(0, 0.95, -0.27);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42), mat(COLORS.deskLeg));
    post.position.y = 0.22;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 10), mat(COLORS.deskLeg));
    base.position.y = 0.03;
    for (const m of [seat, back, post, base]) m.castShadow = true;
    g.add(seat, back, post, base);
    g.position.set(x, 0, z);
    g.rotation.y = facing;
    root.add(g);
  }

  function roundTable(x, z, r) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.05, 20), mat(COLORS.wood));
    top.position.set(x, 0.74, z);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.72, 8), mat(COLORS.deskLeg));
    leg.position.set(x, 0.36, z);
    top.castShadow = leg.castShadow = true;
    root.add(top, leg);
    addCollider(x, z, r * 1.6, r * 1.6);
  }

  function beanbag(x, z, color) {
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), mat(color));
    bag.scale.set(1, 0.6, 1);
    bag.position.set(x, 0.27, z);
    bag.castShadow = true;
    root.add(bag);
    addCollider(x, z, 0.8, 0.8);
  }

  function fireExtinguisher(x, z) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 10), mat(0xd33a3a));
    body.position.set(x, 0.3, z);
    body.castShadow = true;
    root.add(body);
  }

  function wallClock(x, z) {
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 24), mat(0xffffff));
    face.rotation.x = Math.PI / 2;
    face.position.set(x, 2.3, z);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 24), mat(0x1f2a37));
    rim.position.set(x, 2.3, z + 0.02);
    root.add(face, rim);
    box(0.02, 0.22, 0.01, 0x1f2a37, x, 2.3, z + 0.04); // minute hand (points up)
    box(0.15, 0.02, 0.01, 0x1f2a37, x + 0.07, 2.29, z + 0.04); // hour hand (points right)
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

  /** A screen whose picture is a canvas, so main.js can draw on it (TV videos, meeting slides). */
  function liveScreen(w, h, x, y, z, rotY) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = Math.round((256 * h) / w);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#05080b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    scene.add(mesh);
    return { mesh, canvas, ctx, texture };
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
