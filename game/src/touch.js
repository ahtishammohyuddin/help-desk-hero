// Touch controls for phones and tablets: a joystick to walk and a button for E.
// Turning the camera already works by swiping on the 3D view (camera.js).

/** Joystick position (pixels from its centre) to a stick value: -1..1 each way, with a small dead zone. */
export function stickFromDrag(dx, dy, radius, deadZone = 0.15) {
  let x = dx / radius;
  let y = -dy / radius; // dragging up means forward
  const len = Math.hypot(x, y);
  if (len < deadZone) return { x: 0, y: 0, len: 0 };
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y, len: Math.min(len, 1) };
}

export const RUN_AT = 0.92; // push the stick to the edge to run

/** Is this a touch screen without a mouse? */
export const isTouchDevice = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches && 'ontouchstart' in window;

export function createTouchControls(input, { force = false } = {}) {
  if (!force && !isTouchDevice()) return null;
  document.body.classList.add('touch');
  const wrap = document.createElement('div');
  wrap.id = 'touch';
  wrap.innerHTML = `
    <div id="touch-stick" aria-label="Walk: drag the circle"><div id="touch-knob"></div></div>
    <button id="touch-e" type="button" aria-label="Use, talk or close (E)">E</button>`;
  document.body.appendChild(wrap);
  const base = wrap.querySelector('#touch-stick');
  const knob = wrap.querySelector('#touch-knob');
  let pointer = null;
  let centre = { x: 0, y: 0 };

  const release = () => {
    pointer = null;
    Object.assign(input.state, { stickX: 0, stickY: 0, run: false });
    knob.style.transform = 'translate(-50%, -50%)';
  };
  base.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pointer = e.pointerId;
    base.setPointerCapture(e.pointerId);
    const r = base.getBoundingClientRect();
    centre = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    move(e);
  });
  const move = (e) => {
    if (e.pointerId !== pointer) return;
    const radius = base.clientWidth / 2;
    const s = stickFromDrag(e.clientX - centre.x, e.clientY - centre.y, radius);
    Object.assign(input.state, { stickX: s.x, stickY: s.y, run: s.len >= RUN_AT });
    knob.style.transform = `translate(calc(-50% + ${s.x * radius}px), calc(-50% + ${-s.y * radius}px))`;
  };
  base.addEventListener('pointermove', move);
  base.addEventListener('pointerup', release);
  base.addEventListener('pointercancel', release);

  wrap.querySelector('#touch-e').addEventListener('click', (e) => {
    e.preventDefault();
    input.press('KeyE');
  });
  // The "Press E to ..." prompt can be tapped too.
  document.getElementById('prompt')?.addEventListener('click', () => input.press('KeyE'));
  return { release };
}
