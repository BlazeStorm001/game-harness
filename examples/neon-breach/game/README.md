# NEON BREACH

A tactical stealth infiltration game. You are a ghost operative inside a
corporate kill-grid. Move through the shadows, spoof the cameras, silence the
guards, breach the core, and extract.

Built in vanilla JS + Canvas 2D. **Zero runtime dependencies** — no build step,
no engine, no `node_modules` for the game itself.

## Run

```bash
npm start          # serves the game at http://localhost:8000  (PORT=xxxx npm start to override)
```

Then open <http://localhost:8000/> in a desktop browser (keyboard required).
Any static file server works too — the game is just `index.html` + `js/*.js`
ES modules.

## Play

| Input | Action |
| --- | --- |
| `WASD` / `Arrows` | Move (walking is quiet) |
| `Shift` (hold) | Sprint — fast but **loud** |
| `Ctrl` / `C` | Crouch — quiet, slow, smaller noise |
| `E` (hold) | Interact / channel (keycard, server breach, exit) |
| `Space` | Silence — melee takedown of a guard behind you |
| `Q` | EMP pulse (stuns cameras, guards, and drones in radius) |
| `F` | Smoke canister (blocks line of sight) |
| `Enter` | Confirm / start / advance |
| `Esc` / `P` | Pause |
| `M` | Mute |

### Objectives (per sector)

1. **Take a keycard** — any keycard opens every blast door in the sector.
2. **Reach the core server** and hold `E` for ~5 s to channel the breach.
3. **Stand on the exit** — extraction auto-channels (~1.3 s) once the core
   is breached.

Data terminals (hold `E` for ~3 s) bank **shards** — optional score used for
your final rank. Get spotted and nearby units converge on your last seen
position; guards and drones fire when they have a clear look, and hits drain
your integrity (100 HP, 0.5 s of invulnerability after each hit). You start
each sector with 3 EMP pulses and 2 smoke canisters. Finish
all three sectors and your total score (shards count 5×) sets a final rank —
`S — GHOST PROTOCOL` is the top one.

The camera follows the player; the map is larger than the viewport. The
minimap (top-right) shows the player, guards, drones, cameras, the server,
and the extraction point.

## Architecture

```
index.html          page shell (canvas, no frameworks)
js/config.js        tunables: tile size, speeds, HP, vision, scoring
js/rng.js           seeded PRNG (mulberry32) — gameplay is deterministic
js/input.js         keyboard state (held + edge-triggered presses)
js/levels.js        the 3 sectors: tile maps, entity spawns, validation
js/pathfind.js      A* over the tile grid (guards/drones)
js/entities.js      guards, drones, cameras, items, particles, projectiles
js/tiles.js         tile rendering (walls, floors, doors, exits, decals)
js/sprites.js       pixel-art sprites as string maps, built at load
js/game.js          the Game class: state machine, update loop, collisions
js/audio.js         procedural WebAudio SFX (no asset files)
js/ui.js            HUD, menus, pause/death/win screens, minimap
js/main.js          bootstrap: canvas, rAF loop, resize, module wiring
js/game-test.js     the window.__gameTest automation contract
test/e2e.mjs        zero-dependency test runner (static + opt-in browser)
tools/              level/sprite validators used during development
scripts/serve.mjs   tiny zero-dep static server for `npm start`
```

Design notes:

- **Fixed timestep.** The update loop steps at 60 Hz (rAF-driven, with a
  spiral-of-death clamp); rendering happens every frame.
- **Determinism.** All randomness flows through a seeded PRNG keyed per run,
  so identical input sequences produce identical states.
- **No assets to load.** Sprites are generated from compact pixel maps,
  audio is synthesized in WebAudio. The game boots with zero network
  requests after the initial page load.

## Test

```bash
npm test               # static checks: syntax, level reachability, sprites, config
E2E_BROWSER=1 npm test # additionally drives a real Chromium page via playwright
```

The static suite runs anywhere (it is also what `npm test` does by default).
The browser portion loads the game, starts a run from the menu with a real
key press, and asserts there are no console errors.

### Automation contract (`window.__gameTest`)

The game exposes a deterministic, JSON-serializable test contract (it does
not alter production behavior):

```js
window.__gameTest.reset(seed)   // full reset to menu; returns snapshot
window.__gameTest.actions()     // {actionName: description}
window.__gameTest.act(name, payload)
window.__gameTest.step(frames)  // advance the real game loop N frames (1/60 s each)
window.__gameTest.snapshot()    // JSON-serializable state: time, state, level, player, ...
```

Actions: `press`, `release`, `tap` (payload `{code}`), `start`, `pause`.
While automation is active the rAF loop is bypassed and only `step()`
advances time, which is what makes run-to-run determinism exact. A recorded
run (`.playwright-mcp/contract-test.mjs`) verifies reset → start → move →
determinism → pause → death → retry against the live page.

## Known limitations

- Desktop keyboard only (no touch controls).
- Audio unlocks on the first key press or click (browser autoplay policy).
- 3 handcrafted sectors; content is not procedurally generated at runtime
  (the seeded PRNG governs in-run events, not level layout).
- No persistent save; a page refresh restarts from the menu.
