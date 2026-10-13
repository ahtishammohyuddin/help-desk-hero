// Keyboard input. Tracks which movement keys are held and fires one-off key presses.

const MOVE_KEYS = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};

export class Input {
  constructor(target = window) {
    this.state = { forward: false, back: false, left: false, right: false, run: false };
    this.pressHandlers = new Map();

    target.addEventListener('keydown', (e) => {
      const action = MOVE_KEYS[e.code];
      if (action) {
        this.state[action] = true;
        if (e.code.startsWith('Arrow')) e.preventDefault(); // stop the page scrolling
      }
      if (!e.repeat && this.pressHandlers.has(e.code)) this.pressHandlers.get(e.code)();
    });
    target.addEventListener('keyup', (e) => {
      const action = MOVE_KEYS[e.code];
      if (action) this.state[action] = false;
    });
    // If the window loses focus while a key is held, release everything.
    window.addEventListener('blur', () => {
      for (const key of Object.keys(this.state)) this.state[key] = false;
    });
  }

  /** Run `handler` once each time `code` (e.g. 'KeyE') is pressed. */
  onPress(code, handler) {
    this.pressHandlers.set(code, handler);
  }
}
