// The player's own help desk, and the upgrades that appear on it as you earn XP (see custom.js).

import * as THREE from 'three';

const m = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });

/** Desk at x -17.4..-14.6, z 10.75..11.65, top at 0.75; monitors at z 11.4 facing the chair at z 10.1. */
export function createDeskUpgrades(scene) {
  const TOP = 0.76;
  const pieces = {};
  const group = (id, build) => {
    const g = new THREE.Group();
    build(g);
    g.visible = false;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    pieces[id] = g;
  };
  const mesh = (g, geo, mat, x, y, z) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(x, y, z);
    g.add(o);
    return o;
  };

  group('plant', (g) => {
    mesh(g, new THREE.CylinderGeometry(0.09, 0.07, 0.14, 12), m(0xc0643b), -17.2, TOP + 0.07, 10.95);
    mesh(g, new THREE.IcosahedronGeometry(0.13, 0), m(0x3f9b55), -17.2, TOP + 0.24, 10.95);
  });
  group('mug', (g) => {
    mesh(g, new THREE.CylinderGeometry(0.05, 0.05, 0.11, 14), m(0x2f6feb), -14.9, TOP + 0.055, 10.95);
    const handle = mesh(g, new THREE.TorusGeometry(0.03, 0.01, 6, 12), m(0x2f6feb), -14.84, TOP + 0.06, 10.95);
    handle.rotation.y = Math.PI / 2;
  });
  group('lamp', (g) => {
    mesh(g, new THREE.CylinderGeometry(0.08, 0.09, 0.03, 14), m(0x2b313a), -14.8, TOP + 0.015, 11.5);
    const arm = mesh(g, new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), m(0x2b313a), -14.8, TOP + 0.22, 11.45);
    arm.rotation.x = -0.25;
    const head = mesh(g, new THREE.ConeGeometry(0.08, 0.12, 14, 1, true), m(0x2b313a, { side: THREE.DoubleSide }), -14.8, TOP + 0.42, 11.33);
    head.rotation.x = 0.5;
    mesh(g, new THREE.SphereGeometry(0.035, 10, 8), m(0xfff1c2, { emissive: 0xffe08a, emissiveIntensity: 1.2 }), -14.8, TOP + 0.38, 11.31);
  });
  group('monitor', (g) => {
    mesh(g, new THREE.BoxGeometry(0.06, 0.55, 0.06), m(0x1f252d), -16, TOP + 0.6, 11.55); // stand pole behind the two screens
    mesh(g, new THREE.BoxGeometry(0.7, 0.42, 0.05), m(0x1f252d), -16, TOP + 1.02, 11.5);
    const screen = mesh(g, new THREE.PlaneGeometry(0.64, 0.36), m(0x2a5a8f, { emissive: 0x3b78c4, emissiveIntensity: 0.6 }), -16, TOP + 1.02, 11.474);
    screen.rotation.y = Math.PI; // faces the chair (towards -z)
  });
  group('chair', (g) => {
    const leather = m(0x1f2a44);
    mesh(g, new THREE.BoxGeometry(0.58, 0.95, 0.1), leather, -16, 1.0, 9.83); // high back
    mesh(g, new THREE.BoxGeometry(0.34, 0.2, 0.1), leather, -16, 1.6, 9.85); // headrest
    for (const side of [-1, 1]) mesh(g, new THREE.BoxGeometry(0.06, 0.05, 0.42), m(0x2b313a), -16 + side * 0.3, 0.68, 10.08); // armrests
  });
  group('trophy', (g) => {
    const gold = m(0xd4a62a, { metalness: 0.7, roughness: 0.3 });
    mesh(g, new THREE.BoxGeometry(0.14, 0.05, 0.14), m(0x2b1a12), -17.2, TOP + 0.025, 11.5);
    mesh(g, new THREE.CylinderGeometry(0.015, 0.03, 0.1, 10), gold, -17.2, TOP + 0.1, 11.5);
    mesh(g, new THREE.CylinderGeometry(0.07, 0.035, 0.12, 14), gold, -17.2, TOP + 0.21, 11.5);
  });

  return {
    /** Show exactly the unlocked upgrades. ids: from unlockedUpgrades(). */
    update(ids) {
      for (const [id, g] of Object.entries(pieces)) g.visible = ids.includes(id);
    },
    pieces,
  };
}
