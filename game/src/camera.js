// Third-person camera that follows the player from behind and above.
// Drag with the mouse (or a finger) to orbit around the player; scroll to zoom.

import * as THREE from 'three';

export class FollowCamera {
  constructor(camera, dom) {
    this.camera = camera;
    this.yaw = 0; // 0 = camera south of the player, looking north
    this.distance = 10;
    this.pitch = 0.78; // radians above the horizon (about 45 degrees)
    this.target = new THREE.Vector3();
    this.smoothTarget = new THREE.Vector3();
    this.snapped = false;
    this.focus = 0; // 0 normal, 1 = conversation (shifts the view so people sit above the dialogue box)
    this.focusTarget = 0;

    let dragging = false;
    let lastX = 0;
    dom.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      this.yaw -= (e.clientX - lastX) * 0.006;
      lastX = e.clientX;
    });
    const stop = () => { dragging = false; };
    dom.addEventListener('pointerup', stop);
    dom.addEventListener('pointercancel', stop);
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.distance = THREE.MathUtils.clamp(this.distance + e.deltaY * 0.01, 6, 18);
    }, { passive: false });
  }

  update(dt, playerPosition) {
    // During a conversation, aim a little toward the camera so the people appear higher on screen.
    this.focus += (this.focusTarget - this.focus) * (1 - Math.exp(-6 * dt));
    const shift = this.focus * 2.6;
    this.target.set(
      playerPosition.x + Math.sin(this.yaw) * shift,
      1.2 - this.focus * 0.6,
      playerPosition.z + Math.cos(this.yaw) * shift,
    );
    if (!this.snapped) {
      this.smoothTarget.copy(this.target);
      this.snapped = true;
    }
    // Ease toward the player so the camera feels smooth, not jerky.
    this.smoothTarget.lerp(this.target, 1 - Math.exp(-8 * dt));

    const flat = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      this.smoothTarget.x + Math.sin(this.yaw) * flat,
      this.smoothTarget.y + Math.sin(this.pitch) * this.distance,
      this.smoothTarget.z + Math.cos(this.yaw) * flat,
    );
    this.camera.lookAt(this.smoothTarget);
  }
}
