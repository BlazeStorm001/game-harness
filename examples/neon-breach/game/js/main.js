// NEON BREACH — bootstrap
import { Input } from "./input.js";
import { AudioEngine } from "./audio.js";
import { Game } from "./game.js";
import { buildAll } from "./sprites.js";
import { createGameTest } from "./game-test.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = 960, H = 600;
canvas.width = W; canvas.height = H;

const input = new Input();
const audio = new AudioEngine();
const game = new Game(canvas, input, audio);
window.__game = game; // debug hook
game.S = buildAll();

const resume = () => audio.init();
input.onAnyKey = resume;
window.addEventListener("pointerdown", resume);

// Deterministic step-control contract (window.__gameTest). While active, the
// real-time loop stops driving the game; tests call step(frames) instead.
const gameTest = createGameTest({ game, input, width: W, height: H });
window.__gameTest = gameTest;

function fit() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = `${Math.floor(W * s)}px`;
  canvas.style.height = `${Math.floor(H * s)}px`;
}
window.addEventListener("resize", fit);
fit();

let last = performance.now();
const logged = new Set();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!gameTest.active) {
    try {
      game.update(dt);
      game.render(W, H);
    } catch (err) {
      // keep the loop alive; report each distinct error once
      if (!logged.has(err.message)) { logged.add(err.message); console.error(err); }
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
