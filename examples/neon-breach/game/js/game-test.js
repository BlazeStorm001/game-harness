// __gameTest — deterministic headless/step-controlled contract for the game.
// Exposed as window.__gameTest by main.js. Real KeyboardEvents are dispatched
// to window, so the production Input listeners and game.update() path are
// exercised exactly as in normal play. step() drives update at a fixed
// FRAME_DT so runs are frame-deterministic (all gameplay RNG is seeded via
// js/rng.js; particles/audio use Math.random but never affect state).
import { seed } from "./rng.js";

const KEYS = new Set(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight",
  "Space","KeyE","KeyQ","KeyF","KeyR","KeyM","KeyP","Escape","Enter",
  "ShiftLeft","ShiftRight","ControlLeft","ControlRight","KeyC"]);

const r0 = (v) => Math.round(v);
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

function snap(g) {
  const p = g.player || null;
  const lvl = g.lvl || null;
  return {
    state: g.state,
    level: g.levelIdx,
    levelName: g.levelName || null,
    time: r2(g.time),
    score: g.score,
    shards: g.shards,
    alarm: r2(g.alarm),
    keycard: g.keycard,
    objectiveDone: g.objectiveDone,
    atExit: g.atExit,
    extractT: r2(g.extractT),
    msg: g.msgT > 0 ? g.msg : null,
    player: p ? {
      x: r1(p.x), y: r1(p.y), hp: r0(p.hp), emp: p.emp, smoke: p.smoke,
      dead: !!p.dead, crouching: !!p.crouching,
      channel: p.channel ? { kind: p.channel.kind, t: r3(p.channel.t), need: p.channel.need } : null,
      invuln: r1(p.invuln),
    } : null,
    server: lvl && lvl.server ? { x: lvl.server.x, y: lvl.server.y, done: !!lvl.server.done } : null,
    terminals: (lvl && lvl.terminals) ? lvl.terminals.map((t) => ({ x: t.x, y: t.y, done: !!t.done })) : [],
    keycards: (lvl && lvl.keycards) ? lvl.keycards.map((k) => ({ x: k.x, y: k.y, taken: !!k.taken })) : [],
    exit: lvl && lvl.exit ? { x: lvl.exit.x, y: lvl.exit.y } : null,
    doors: (lvl && lvl.doors) ? lvl.doors.map((d) => (d.open ? 1 : 0)) : [],
    guards: (g.guards || []).map((w) => ({ x: r1(w.x), y: r1(w.y), ang: r2(w.angle), state: w.state, susp: r0(w.susp), stun: r1(w.stun ?? 0), dead: !!w.dead })),
    drones: (g.drones || []).map((w) => ({ x: r1(w.x), y: r1(w.y), state: w.state, susp: r0(w.susp), stun: r1(w.stun ?? 0), hp: w.hp, dead: !!w.dead })),
    cameras: (g.cameras || []).map((c) => ({ x: r0(c.x), y: r0(c.y), susp: r0(c.susp), alerted: !!c.alerted, stunned: r1(c.stunned), dead: !!c.dead })),
    bullets: (g.bullets || []).map((b) => ({ x: r1(b.x), y: r1(b.y), from: b.from })),
    smokes: (g.smokes || []).map((s) => ({ x: r1(s.x), y: r1(s.y), r: r1(s.r), t: r2(s.t) })),
  };
}

export function createGameTest({ game, input, width, height, frameDt = 1 / 60 }) {
  let error = null;
  let active = false;

  const press = (code) => window.dispatchEvent(new KeyboardEvent("keydown", { code, key: code, bubbles: true }));
  const release = (code) => window.dispatchEvent(new KeyboardEvent("keyup", { code, key: code, bubbles: true }));

  const api = {
    get active() { return active; },

    reset(seedValue = 1) {
      active = true;
      seed(seedValue);
      input.down.clear();
      input.pressed.clear();
      game.hardReset();
      game.render(width, height);
      return snap(game);
    },

    actions() {
      return {
        "press":   "Hold a key down. payload: {code}",
        "release": "Release a held key. payload: {code}",
        "tap":     "Press and release a key in one call (edge consumed on next step). payload: {code}",
        "start":   "Tap Enter — start game / advance (retry on death, next level on clear)",
        "pause":   "Tap Escape — toggle pause",
      };
    },

    act(name, payload = {}) {
      active = true;
      error = null;
      try {
        if (name === "press") {
          const code = payload.code;
          if (!KEYS.has(code)) throw new Error(`unknown key code: ${code}`);
          press(code);
        } else if (name === "release") {
          const code = payload.code;
          if (!KEYS.has(code)) throw new Error(`unknown key code: ${code}`);
          release(code);
        } else if (name === "tap") {
          const code = payload.code;
          if (!KEYS.has(code)) throw new Error(`unknown key code: ${code}`);
          press(code);
          release(code);
        } else if (name === "start") {
          press("Enter");
          release("Enter");
        } else if (name === "pause") {
          press("Escape");
          release("Escape");
        } else {
          throw new Error(`unknown action: ${name}`);
        }
      } catch (e) {
        error = String(e && e.message || e);
      }
      return error ? { error } : { ok: true };
    },

    step(frames = 1) {
      active = true;
      error = null;
      const n = Math.max(1, Math.min(3600, frames | 0));
      for (let i = 0; i < n; i++) {
        try {
          game.update(frameDt);
          game.render(width, height);
        } catch (e) {
          error = String(e && e.message || e);
          break;
        }
      }
      return error ? { error } : null;
    },

    snapshot() {
      return snap(game);
    },
  };
  return api;
}
