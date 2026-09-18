# NEON BREACH

A cyberpunk stealth infiltration game. Slip through a hostile server facility,
extract 3 data shards per sector, and get out before the security grid deletes
your trace. Top-down, pixel-art, neon-noir.

**Infiltrate // Extract // Escape**

---

## Running the game

No build step, no dependencies. Any static file server works:

```bash
# from this directory
python3 -m http.server 8123
# then open http://127.0.0.1:8123
```

(Any port / host is fine. Node's `npx serve`, Caddy, nginx, GitHub Pages, etc.
all work too. Opening `index.html` directly via `file://` also works in most
browsers since no network requests are made, but a server is recommended.)

Requirements: any modern browser (Chrome, Firefox, Safari, Edge). Keyboard
required.

## Controls

| Key | Action |
|---|---|
| `WASD` / `Arrows` | Move |
| `C` / `V` (hold) | Crouch (slower, harder to detect) |
| `Shift` | Dash (short burst + brief i-frames, 2.2s cooldown) |
| `Space` | EMP pulse (stuns nearby guards/drones for 3s, 12s cooldown) |
| `E` / `F` (hold) | Hack terminal (1.5s) / Escape from exit pad (1.0s) |
| `Enter` | Confirm / resume |
| `P` / `Esc` | Pause |
| `R` | Retry sector (from pause or game-over) |
| `M` | Mute / unmute |
| `Q` | Quit to title (from pause or game-over) |

## How to play

Each sector has **3 data terminals**. Stand next to one and **hold `E`** to
extract its shard (+1000 pts each). Once all 3 are extracted, the **exit pad**
on the map activates (green, pulsing) - stand on it and **hold `E`** to escape.

**Wayfinding**:
- A **minimap** (top right, below the data counter) shows the whole sector:
  walls, unextracted shards (amber, turning green), the exit pad, every guard
  (red) and drone (violet), and your position (cyan). It's a live tactical map -
  plan routes around patrols before you commit to a corridor.
- A small chevron orbits your character pointing at the nearest un-hacked
  terminal (cyan). When all data is collected it turns green and points at the
  exit pad.
- **Contextual prompts** replace the static hint line: `HOLD [E] EXTRACT SHARD`
  near a terminal, `HOLD [E] TO ESCAPE` on an armed exit pad, and
  `EXTRACTION LOCKED - n/3 SHARDS` if you reach the pad early.

### Stealth system

- **Guards** patrol fixed loops with a pink vision cone. Walk into a cone and
  their detection meter rises. Full detection = **ALERT**: the guard chases
  and fires, and all nearby drones switch to hunter mode. Spotted entities
  show a yellow `?` (suspicious) or red `!` (alert) marker above them.
- **Drones** hover in patrol loops with 360-degree passive detection (no cone
  - they sense movement in all directions). They show the same `?` / `!`
  markers while their sensor meter is hot.
- **Lasers** are static kill-zones that blink on a phase. Touch an active
  beam and you take damage.
- **Doors** slide open automatically when you get close.
- The **DETECTION** bar (top center) shows global alert level. It rises when
  anything sees you and slowly decays when no one is looking.
- Sustained high alert (>0.75 for 3.5s) triggers **reinforcement drones** to
  spawn at sector hardpoints. A blinking `!! REINFORCEMENTS INBOUND !!`
  banner warns you when that happens.
- Getting spotted is survivable - **dying is not**: 0 HP ends the run and
  returns you to the sector start (score earned in that sector is forfeited).
  The game-over screen shows your total run score.
- At **2 HP or less** the screen takes on a pulsing red edge and a blinking
  `INTEGRITY LOW` warning appears under the sector label, with a heartbeat in
  the audio - a clear signal to play it safe.
- Hunters give up: if an alerted guard or drone is blocked by geometry for
  ~0.7s it stops dead-ending in a corner and returns to search/patrol, so a
  stale chase can never soft-lock the sector.
- The tab **auto-pauses** when it loses focus, so you're never ambushed by an
  unattended run.
- Your best total score (and rank) is saved locally as the **Facility Record**
  - shown on the title screen, with a `NEW FACILITY RECORD` flag on the
  victory screen when you beat it.

### Player stats

- 6 HP (red pips, top left)
- Dash: 330 px/s for 0.16s, grants i-frames, 2.2s cooldown
- EMP: 90px radius, 3s stun, 12s cooldown
- Crouch: ~50% slower, detection gain reduced

### Scoring

Per sector, on top of 3000 for the three shards:

| Bonus | Points | Condition |
|---|---|---|
| Stealth | 500 | Never alerted, no damage |
| Untouched | 300 | Took no damage at all |
| Time | up to 1000 | `(par - time) * 10`, clamped to 1000 |

Par times: Sector 1 = 90s, Sector 2 = 130s, Sector 3 = 180s.

Final rank (shown on victory screen):

| Rank | Total score |
|---|---|
| S | 8000+ |
| A | 6000+ |
| B | 4000+ |
| C | below |

## Sectors

1. **INTAKE** - tutorial-style: 2 guards, 1 drone, 2 lasers, 2 auto-doors.
   Learn cone-reading and door timing.
2. **SERVER VAULT** - 3 guards, 2 drones, 4 lasers (two vertical beams gate
   the middle), 2 doors, more crates for cover. The heart of the facility.
3. **CORE** - the vault around the reactor core. 5 guards, 2 drones, 8 lasers
   forming four gates between wings, and the tightest corridors. No doors -
   laser timing is your friend.

## File layout

```
index.html          Canvas + boot (loads all scripts)
js/core.js          Math, RNG (mulberry32), Input, WebAudio SFX + music
js/levels.js        Declarative level data + parser (3 sectors)
js/sprites.js       Procedural pixel-art (player, guards, drones, cones, tiles)
js/game.js          Simulation: state machine, collision, AI, scoring
js/render.js        All drawing: world, HUD, overlays, post-FX
js/main.js          Boot, rAF loop, window.__gameTest harness
scripts/check-levels.mjs   Level validation (reachability, patrol clearance)
scripts/sim-test.mjs       Headless simulation test-suite (80 checks)
```

### Architecture notes

- **Resolution**: internal 480x270 canvas, upscaled with `image-rendering:
  pixelated`. 16px tiles, ~60x36-tile maps.
- **Loop**: fixed 60Hz timestep with an accumulator in `G.frame`; `G.simulate`
  is the single simulation entry point; `G.stepPlay` is gameplay only.
- **Levels** are declarative data (floor rects, carve ops, entity arrays)
  parsed by `NB.Levels.parseLevel` into a grid + runtime entities. `scripts/
  check-levels.mjs` BFS-checks that every terminal/exit/guard is reachable
  from the spawn.
- **Sprites** are 100% procedural (no image assets): drawn per-entity into
  the canvas each frame; the static tile layer is pre-rendered once per level
  by `Sprites.buildStatic`.
- **Audio** is 100% WebAudio: procedural SFX (hacks, EMP, hits, doors, UI)
  and a small step-sequenced synth track, all generated in `core.js`. No
  audio files.
- **Determinism**: a single seeded `mulberry32` RNG drives level-neutral
  randomness. Test-mode runs are reproducible per seed; production runs
  reseed on every jack-in from the title so guard facing differs each run.
- **Persistence**: `NB.Store` (in `core.js`) keeps the facility record best
  score in `localStorage` under `neonBreach.best.v1`, guarded by try/catch so
  the game runs fine in sandboxes where storage is unavailable. The title
  screen reads it once into `G.bestInfo`.
- **Minimap**: each level's tile grid is pre-rendered once at 1px/tile into
  `G.minimap` by `Sprites.buildMinimap`; the HUD blits it plus live entity
  dots every frame.
- **Bullet collision** uses a sweep test (point-to-segment from the bullet's
  previous to current position), so fast/point-blank shots can never tunnel
  through the player.
- **Camera** snaps to the clamped view target at the spawn point on level
  start (no cross-map pans), then eases toward the player each frame.
- **HUD** is drawn after the scanline/vignette post-FX pass so the UI stays
  bright and legible in the corners.

### Test harness

A small deterministic test API is exposed on `window.__gameTest` (used by the
automated play-throughs; harmless in normal play):

```js
__gameTest.reset(seed)     // force testMode, start a fresh run
__gameTest.actions()       // list of debug actions
__gameTest.act(name, p)    // 'teleport', 'hold'/'release' {key}, 'hack_all',
                           // 'set_alert', 'set_hp', 'damage', 'emp', 'dash',
                           // 'next_level', 'confirm', 'pause', 'restart', 'quit' ...
__gameTest.step(frames)    // advance simulation N frames at 60Hz
__gameTest.snapshot()      // state, hp, score, data, level, alert, guards, drones,
                           // reinfWarn, newBest, best ...
```

In test mode the page's render loop still runs, so screenshots of the canvas
reflect live game state after each `step()`.

Normal play is unaffected; the real game loop runs from `requestAnimationFrame`
and the `__gameTest.reset` state is only entered when a test calls it.

## Automated testing

Both scripts run headless in Node (no browser needed):

```bash
node scripts/check-levels.mjs   # geometry: reachability, patrol-path clearance
node scripts/sim-test.mjs       # 80 sim checks, see below
```

`sim-test.mjs` loads the real `js/*.js` files in a DOM/canvas-stubbed
environment and drives `G.simulate(1/60)` directly, so it exercises the exact
shipped simulation code. Coverage:

| Section | Checks |
|---|---|
| T0 load | modules, static-layer rendering, fonts |
| T1 determinism | two identical seeded runs produce identical state hashes |
| T2 patrol | guards/drones actually travel their paths |
| T3 full clear | cheat-run all 3 sectors to the victory screen, back to title |
| T4 combat | standing in a guard cone -> damage -> death -> retry with full HP |
| T5 EMP | stuns a guard in range, stun wears off, guard frozen while stunned |
| T6 reinforcements | sustained alert spawns +2 drones |
| T7 render smoke | no exceptions across title/play/pause/gameover, all 3 levels |
| T8 doors | solid below the open threshold, opens for a nearby player, closes on leaving |
| T9 lasers | on/off cycle observed, contact deals damage |
| T10 escape | channel progresses, releasing cancels it, re-hold completes |
| T11 hacking | progress accumulates while held and decays when released |
| T12 retry | restarting subtracts the sector's earned score |
| T13 best score | Store submit/load semantics + victory persists final score/rank |
| T14 AI unstuck | a chaser blocked in a corner gives up to search within ~0.7s |
| T15 state machine | pause->quit to title; clear auto-advances to the next sector |
| T16 low HP | hpWarn on at 2, off at 3, no self-damage over time |
| T17 clear wipe | transition wipe reaches full before the next sector loads |
| T18 alert juice | entering alert spawns a burst + screen shake |
| T19 run seed | test mode keeps its seed; production gets a fresh one per run |
| T20 mute | mute toggles from play, game-over and clear screens |

## Credits

Built as a self-contained browser game. All art, audio, and code generated
procedurally - zero external assets or libraries.
