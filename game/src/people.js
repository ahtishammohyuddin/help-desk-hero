// Low-poly people built from basic shapes. Used for the player and the employees.
// The figure faces +Z when its rotation is 0.

import * as THREE from 'three';

const shared = new Map();
function mat(color) {
  if (!shared.has(color)) shared.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  return shared.get(color);
}

export function makePerson({ shirt, hair, skin = 0xd9a77e, trousers = 0x2f3640, badge = false }) {
  const g = new THREE.Group();
  const parts = [];
  const add = (mesh, x, y, z) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    parts.push(mesh);
    return mesh;
  };

  // A limb hangs from a pivot (hip or shoulder). Rotating the pivot swings the
  // whole limb from that joint, like a real leg or arm, not around its middle.
  const limb = (geometry, color, jointX, jointY, length) => {
    const pivot = new THREE.Group();
    pivot.position.set(jointX, jointY, 0);
    const mesh = new THREE.Mesh(geometry, mat(color));
    mesh.position.y = -length / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    g.add(pivot);
    return pivot;
  };

  // Legs (hips at 0.8 high), body, then arms (shoulders at 1.28 high)
  const leftLeg = limb(new THREE.BoxGeometry(0.16, 0.8, 0.2), trousers, -0.11, 0.8, 0.8);
  const rightLeg = limb(new THREE.BoxGeometry(0.16, 0.8, 0.2), trousers, 0.11, 0.8, 0.8);
  add(new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.42, 4, 10), mat(shirt)), 0, 1.07, 0);
  const leftArm = limb(new THREE.CapsuleGeometry(0.07, 0.48, 3, 6), shirt, -0.32, 1.3, 0.56);
  const rightArm = limb(new THREE.CapsuleGeometry(0.07, 0.48, 3, 6), shirt, 0.32, 1.3, 0.56);
  g.userData.limbs = { leftLeg, rightLeg, leftArm, rightArm };
  // Head, hair, and a nose so you can tell which way they face
  add(new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), mat(skin)), 0, 1.58, 0);
  const hairMesh = add(
    new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(hair)),
    0, 1.61, -0.02,
  );
  hairMesh.rotation.x = -0.25;
  add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.06), mat(skin)), 0, 1.56, 0.19);
  if (badge) {
    // A lanyard badge for the IT technician
    add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.02), mat(0xffffff)), 0.08, 1.05, 0.24);
  }
  return g;
}

/**
 * Pose a person mid-walk.
 * phase: where in the stride they are (keeps increasing while walking).
 * amount: 0 = standing still, 1 = full stride. Blend it so starting and stopping look smooth.
 */
export function animateWalk(person, phase, amount) {
  const { leftLeg, rightLeg, leftArm, rightArm } = person.userData.limbs;
  const swing = Math.sin(phase) * 0.6 * amount; // about 35 degrees at full stride
  // Legs swing opposite each other; each arm swings opposite its own leg.
  leftLeg.rotation.x = swing;
  rightLeg.rotation.x = -swing;
  leftArm.rotation.x = -swing * 0.8;
  rightArm.rotation.x = swing * 0.8;
}

/** A floating "!" shown above someone who needs help. */
export function makeAlertMarker() {
  const g = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffc94a, emissive: 0xffb300, emissiveIntensity: 0.6 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.12), yellow);
  bar.position.y = 0.26;
  const dot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), yellow);
  g.add(bar, dot);
  g.position.y = 2.15;
  return g;
}
