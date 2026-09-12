// Keyboard input — tracks held keys and edge-triggered presses.
const PREVENT = new Set([
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space",
  "Control", "ShiftLeft", "ShiftRight",
]);

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set(); // edge-triggered, consumed each frame
    this.onAnyKey = null;
    window.addEventListener("keydown", (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      if (this.onAnyKey) this.onAnyKey(e);
    });
    window.addEventListener("keyup", (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener("blur", () => {
      this.down.clear();
    });
  }

  isDown(...codes) { return codes.some((c) => this.down.has(c)); }
  wasPressed(...codes) {
    let hit = false;
    for (const c of codes) if (this.pressed.has(c)) hit = true;
    return hit;
  }
  // Call at the end of every update tick.
  endFrame() { this.pressed.clear(); }

  get moveX() {
    if (this.isDown("KeyA", "ArrowLeft")) return -1;
    if (this.isDown("KeyD", "ArrowRight")) return 1;
    return 0;
  }
  get moveY() {
    if (this.isDown("KeyW", "ArrowUp")) return -1;
    if (this.isDown("KeyS", "ArrowDown")) return 1;
    return 0;
  }
  get running() { return this.isDown("ShiftLeft", "ShiftRight"); }
  get crouching() { return this.isDown("ControlLeft", "ControlRight", "KeyC"); }
}

export const KEYS_HELP = [
  ["W A S D / Arrows", "move"],
  ["SHIFT (hold)", "sprint — loud"],
  ["CTRL (hold)", "crouch — quiet, slower"],
  ["SPACE", "takedown (melee)"],
  ["E (hold)", "interact — extract / exfiltrate"],
  ["Q", "EMP — stuns machines + guards"],
  ["F", "smoke canister — blocks vision"],
  ["P / ESC", "pause"],
  ["M", "mute"],
];
