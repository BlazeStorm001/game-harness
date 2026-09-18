// NEON BREACH - headless simulation test (no browser needed)
// Stubs the DOM, loads the game scripts in browser order, then drives the
// real simulation with scripted scenarios:
//   T0 load & statics      T4 guard AI combat + death
//   T1 determinism         T5 EMP stun
//   T2 patrol coverage     T6 reinforcements
//   T3 full 3-level clear -> victory
//   T7 render smoke (title + play, all 3 levels)
//   T8 doors (solid/open/close)   T9 lasers (cycle + damage)
//   T10 escape channel/cancel     T11 hack accumulate/decay
//   T12 retry score subtraction   T13 best-score persistence
//   T14 AI unstuck               T15 state-machine transitions
//   T16 low-HP warning           T17 level-clear wipe
//   T18 alert transition juice   T19 per-run seed / test seed
//   T20 mute on every screen
//   T21 art anchors (exit/terminals on floor)
//   T22 tap-to-start interact buffer
//   T23 stun SFX fires on zap, not recovery
//   T24 player faces the thing that hurt them
//   T25 mute setting persists
//   T26 music duck on pause + game-over track
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import path from 'path';

const here = fileURLToPath(new URL('.', import.meta.url));
const JS = (f) => readFileSync(path.join(here, '..', 'js', f), 'utf8');

/* ---------------- DOM / browser stubs ---------------- */
function makeCtx(canvas) {
  const gradient = { addColorStop() {} };
  const target = {};
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'canvas') return canvas;
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern')
        return () => gradient;
      if (k === 'measureText') return () => ({ width: 4 });
      if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray((w | 0) * (h | 0) * 4) });
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}
function makeCanvas(w, h) {
  const c = {
    width: w || 0, height: h || 0, style: {},
    getContext: () => makeCtx(c),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: c.width, height: c.height })
  };
  return c;
}
globalThis.window = globalThis;
globalThis.document = {
  getElementById: (id) => (id === 'game' ? makeCanvas(480, 270) : null),
  createElement: () => makeCanvas(),
  addEventListener() {}, removeEventListener() {},
  body: { style: {} }, documentElement: { style: {} }
};
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.requestAnimationFrame = () => 0;
globalThis.performance = globalThis.performance || { now: () => Date.now() };

/* load scripts (indirect eval: `module` is undefined -> browser branches) */
for (const f of ['core.js', 'sprites.js', 'levels.js', 'game.js', 'render.js']) {
  (0, eval)(JS(f));
}

const NB = globalThis.NB;
const G = NB.Game;

/* ---------------- tiny harness ---------------- */
let checks = 0, failures = 0;
function ok(cond, msg) {
  checks++;
  if (cond) console.log('  ok: ' + msg);
  else { console.error('  FAIL: ' + msg); failures++; }
}
function section(name) { console.log('\n' + name); }

const ALL_KEYS = ['up', 'down', 'left', 'right', 'dash', 'emp', 'interact', 'crouch', 'pause', 'confirm', 'mute', 'restart', 'quit'];
function releaseAll() { ALL_KEYS.forEach((k) => NB.Input.release(k)); }

let frame = 0;
function step(n, opts) {
  opts = opts || {};
  for (let i = 0; i < n; i++) {
    const before = snapshotEntities();
    G.simulate(1 / 60);
    frame++;
    if (opts.travel && before) {
      snapshotEntities().guards.forEach((g, i) => {
        opts.travel.guards[i] = (opts.travel.guards[i] || 0) + dist(g, before.guards[i]);
      });
      snapshotEntities().drones.forEach((d, i) => {
        opts.travel.drones[i] = (opts.travel.drones[i] || 0) + dist(d, before.drones[i]);
      });
    }
    if (frame % 20 === 0) { try { G.render(); } catch (e) { renderErr = e; } }
  }
}
let renderErr = null;
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function snapshotEntities() {
  return {
    guards: G.guards.map((g) => ({ x: g.x, y: g.y })),
    drones: G.drones.map((d) => ({ x: d.x, y: d.y }))
  };
}
function freshPlay(seed) {
  G.testMode = true;
  G.acc = 0;
  releaseAll();
  G.reset(seed);
  G.state = 'play';
  G.stateT = 0;
}
function snap() {
  return JSON.stringify({
    p: [G.player.x, G.player.y], score: G.totalScore, t: G.time,
    a: G.alert, d: G.dataCount,
    g: G.guards.map((g) => [g.x, g.y, g.det, g.stunT]),
    dr: G.drones.map((d) => [d.x, d.y, d.det, d.stunT])
  });
}

/* ---------------- T0: load & statics ---------------- */
section('T0 load');
ok(!!(NB && NB.Game && NB.Levels && NB.Sprites), 'modules loaded (NB.Game/Levels/Sprites)');
let staticsOk = true;
for (const def of NB.Levels.LEVELS) {
  const L = NB.Levels.parseLevel(def);
  const s = NB.Sprites.buildStatic(L);
  if (!s || !s.width) staticsOk = false;
}
ok(staticsOk, 'buildStatic works for all 3 levels');
G.init(makeCanvas(480, 270));
G.vig = makeCanvas(G.W, G.H);
G.redEdge = makeCanvas(G.W, G.H);
ok(true, 'G.init with stub canvas');

/* ---------------- T1: determinism ---------------- */
section('T1 determinism (seed 42, hold right 10s)');
freshPlay(42);
G.testAct('hold', { key: 'right' });
let travel1 = { guards: [], drones: [] };
step(600, { travel: travel1 });
const s1 = snap();
releaseAll();
freshPlay(42);
G.testAct('hold', { key: 'right' });
step(600);
const s2 = snap();
ok(s1 === s2, 'two identical runs produce identical state');

/* ---------------- T2: patrol coverage (soft-lock test) ---------------- */
section('T2 guards/drones actually patrol (no soft-lock)');
G.guards.forEach((g, i) => {
  ok((travel1.guards[i] || 0) > 150,
    `guard ${i} traveled ${(travel1.guards[i] || 0).toFixed(0)}px in 10s (>150)`);
});
G.drones.forEach((d, i) => {
  ok((travel1.drones[i] || 0) > 80,
    `drone ${i} traveled ${(travel1.drones[i] || 0).toFixed(0)}px in 10s (>80)`);
});

/* ---------------- T3: full clear -> victory ---------------- */
section('T3 full run (cheat clear) L1 -> L2 -> L3 -> victory');
freshPlay(7);
let reachedVictory = false;
for (let lvl = 0; lvl < 3; lvl++) {
  let w = 0;
  while (G.state !== 'play' && w < 400) { step(10); w += 10; } /* intro / clear */
  ok(G.state === 'play', `L${G.level ? G.level.id : '?'} reached play (state=${G.state})`);
  const L = G.level;
  G.testAct('release', { key: 'interact' });
  G.testAct('hack_all');
  ok(G.dataCount === 3, `L${L.id} all terminals hacked`);
  const tx = Math.round((L.exit.x - 8) / 16), ty = Math.round((L.exit.y - 8) / 16);
  G.testAct('teleport', { tx, ty });
  G.testAct('set_hp', { n: 6 });
  G.testAct('emp'); /* clear any drone/guard camped on the exit */
  G.testAct('hold', { key: 'interact' }); /* channeling escape */
  let waited = 0;
  while (G.state === 'play' && waited < 200) { step(10); waited += 10; }
  ok(G.state === 'clear' || G.state === 'victory',
    `L${L.id} cleared via exit (state=${G.state}, waited ${waited}f)`);
  if (G.state === 'victory') { reachedVictory = true; break; }
}
ok(reachedVictory || G.state === 'victory', 'victory screen reached');
ok(G.runStats.length === 3, 'runStats has 3 levels: ' + (G.runStats || []).map((r) => r.id).join(','));
if (G.state === 'victory') {
  step(60);
  G.testAct('confirm');
  step(1);
  ok(G.state === 'title', 'confirm on victory returns to title');
}

/* ---------------- T4: guard AI combat + death ---------------- */
section('T4 combat: stand in a guard cone, get hit, die, retry');
freshPlay(42);
G.testAct('set_hp', { n: 6 });
/* L1 guard 1 spawns at tile (45,26) facing wp0 (38,21): stand in that path */
G.testAct('teleport', { tx: 43, ty: 24 });
G.testAct('set_alert', { v: 0.8 });
let sawDamage = false, died = false, gameOver = false;
for (let i = 0; i < 1200; i++) {
  step(1);
  if (G.player.hp < 6) sawDamage = true;
  if (G.player.dead) died = true;
  if (G.state === 'gameover') { gameOver = true; break; }
}
ok(sawDamage, 'player took guard damage');
ok(died, 'player died');
ok(gameOver, 'gameover screen shown');
if (gameOver) {
  step(40); /* allow 0.6s confirm window */
  G.testAct('confirm');
  step(2);
  ok((G.state === 'intro' || G.state === 'play') && G.level.id === 1 && G.player.hp === 6 && G.dataCount === 0,
    'retry restarts current level with full HP (state=' + G.state + ')');
}

/* ---------------- T5: EMP stun ---------------- */
section('T5 EMP stuns nearby guard');
freshPlay(42);
G.testAct('set_hp', { n: 6 });
G.testAct('teleport', { tx: 16, ty: 17 }); /* next to guard 0 spawn (16,16) */
G.testAct('set_alert', { v: 1 });
G.testAct('emp');
step(1); /* let the sim process the EMP press */
const g0 = G.guards[0];
ok(g0.stunT > 2.5, `guard stunned (stunT=${g0.stunT.toFixed(2)})`);
const gx = g0.x, gy = g0.y;
step(30);
ok(dist(g0, { x: gx, y: gy }) < 2, 'stunned guard does not move');
ok(g0.stunT < 3 && g0.stunT > 2, 'stun timer counting down');
step(170);
ok(g0.stunT === 0, 'stun wore off (stunT=' + g0.stunT + ')');

/* ---------------- T6: reinforcements ---------------- */
section('T6 sustained alert spawns reinforcement drones');
freshPlay(42);
const baseDrones = G.drones.length;
for (let i = 0; i < 260; i++) {
  if (i % 30 === 0) G.testAct('set_alert', { v: 1 });
  step(1);
}
ok(G.reinforced === true, 'reinforcement flag set');
ok(G.drones.length === baseDrones + 2,
  `drone count ${baseDrones} -> ${G.drones.length}`);

/* ---------------- T7: render smoke (headless ctx) ---------------- */
section('T7 render smoke (no exceptions across states)');
renderErr = null;
G.state = 'title'; G.stateT = 0;
step(90);
ok(!renderErr, 'title renders ' + (renderErr ? renderErr.message : 'clean'));
freshPlay(99);
step(180);
ok(!renderErr, 'play L1 renders ' + (renderErr ? renderErr.message : 'clean'));
G.testAct('next_level'); step(120);
ok(G.level.id === 2 && !renderErr, 'L2 renders ' + (renderErr ? renderErr.message : 'clean'));
G.testAct('next_level'); step(120);
ok(G.level.id === 3 && !renderErr, 'L3 renders ' + (renderErr ? renderErr.message : 'clean'));
/* pause + gameover overlays */
G.testAct('pause'); step(30);
ok(!renderErr, 'pause overlay renders ' + (renderErr ? renderErr.message : 'clean'));
G.testAct('pause');
G.testAct('damage', { n: 6 }); step(90);
ok(!renderErr, 'gameover renders ' + (renderErr ? renderErr.message : 'clean'));

/* ---------------- T8: doors (open, solid-while-closing, close-away) ---------------- */
section('T8 doors: solid while open<0.6, opens for nearby player, closes when far');
{
  freshPlay(42);
  const d0 = G.level.doors[0]; /* L1 door tile (20,9), center (328,152) */
  ok(!!d0, 'level exposes doors array (door at tile 20,9)');
  G.testAct('teleport', { tx: 20, ty: 10 }); /* 16px below the door center */
  d0.open = 0;
  G.testAct('hold', { key: 'up' });
  step(3); /* walks until the collision circle touches the door row */
  const yA = G.player.y;
  step(5); /* door open ~0.1-0.3: still below the 0.6 passable threshold */
  const moved = Math.abs(G.player.y - yA);
  ok(moved < 1.0,
    'player blocked while door still below threshold (moved ' + moved.toFixed(1) + 'px in 5f, open=' + d0.open.toFixed(2) + ')');
  step(30); /* door crosses 0.6 at ~f12, then 1.0 */
  ok(d0.open > 0.9, 'door fully open for nearby player (open=' + d0.open.toFixed(2) + ')');
  const yB = G.player.y;
  step(60);
  ok(yB - G.player.y > 25, 'player walked through the open door (y ' + yB.toFixed(0) + ' -> ' + G.player.y.toFixed(0) + ')');
  G.testAct('release', { key: 'up' });
  G.testAct('teleport', { tx: 4, ty: 29 }); /* far away (spawn area) */
  step(90);
  ok(d0.open < 0.1, 'door closed after player left (open=' + d0.open.toFixed(2) + ')');
}

/* ---------------- T9: laser cycle + damage ---------------- */
section('T9 lasers: cycle on/off and damage on contact');
{
  freshPlay(42);
  G.testAct('set_hp', { n: 6 });
  const l = G.level.lasers[0]; /* x=696 line, y 232..280 */
  G.testAct('teleport', { x: 698, y: 256 }); /* 2px off the beam centerline */
  let sawOn = false, sawOff = false;
  for (let i = 0; i < 240; i++) { /* 4s: covers one full 3s cycle */
    step(1);
    if (l.on) sawOn = true; else sawOff = true;
  }
  ok(6 - G.player.hp > 0, 'player damaged by laser (' + (6 - G.player.hp) + ' hp lost)');
  ok(sawOn && sawOff, 'laser cycles on and off during the run');
}

/* ---------------- T10: escape channeling + cancel ---------------- */
section('T10 escape: channels on exit pad, cancels on release');
{
  freshPlay(7);
  G.testAct('hack_all');
  const L = G.level;
  G.testAct('teleport', { tx: Math.round((L.exit.x - 8) / 16), ty: Math.round((L.exit.y - 8) / 16) });
  G.testAct('set_hp', { n: 6 });
  G.testAct('emp');
  G.testAct('hold', { key: 'interact' });
  step(40);
  const mid = G.escapeT;
  ok(mid > 0.4 && mid < 1.0, 'escape channeling (t=' + mid.toFixed(2) + ')');
  G.testAct('release', { key: 'interact' });
  step(30);
  ok(G.escapeT < 0.2, 'escape progress cancels/decays on release (' + G.escapeT.toFixed(2) + ')');
  G.testAct('hold', { key: 'interact' });
  let w = 0;
  while (G.state === 'play' && w < 200) { step(10); w += 10; }
  ok(G.state === 'clear', 'escape completes after re-hold (state=' + G.state + ')');
}

/* ---------------- T11: terminal hack decay ---------------- */
section('T11 hacking: progress accumulates and decays when idle');
{
  freshPlay(7);
  G.testAct('set_hp', { n: 6 });
  const t0 = G.level.terminals[0]; /* (104,200) */
  G.testAct('teleport', { x: t0.x, y: t0.y + 14 });
  G.testAct('emp'); /* stun nearby guard for the test window */
  G.testAct('hold', { key: 'interact' });
  step(45);
  const h1 = t0.hackTimer;
  ok(h1 > 0.5 && h1 < 1.5, 'hack in progress (' + h1.toFixed(2) + '/1.5)');
  G.testAct('release', { key: 'interact' });
  step(45);
  ok(t0.hackTimer < 0.2 && t0.hackTimer < h1,
    'hack decays when released (' + h1.toFixed(2) + ' -> ' + t0.hackTimer.toFixed(2) + ')');
  ok(G.dataCount === 0, 'no shard awarded for interrupted hack');
}

/* ---------------- T12: retry subtracts earned score ---------------- */
section('T12 retry from game over does not keep lost progress');
{
  freshPlay(7);
  G.testAct('hack_all');
  ok(G.totalScore === 3000, 'earned 3000 on L1 (total=' + G.totalScore + ')');
  G.restartLevel();
  ok(G.totalScore === 0, 'restart subtracts earned score (total=' + G.totalScore + ')');
  ok(G.dataCount === 0 && G.level.id === 1, 'progress reset, back to L1');
  let w = 0;
  while (G.state !== 'play' && w < 400) { step(10); w += 10; }
  ok(G.state === 'play', 'intro -> play after restart');
}

/* ---------------- T13: best-score persistence ---------------- */
section('T13 best score: Store submit/load + victory wiring');
{
  let storeMap = {};
  const stub = {
    getItem: (k) => (k in storeMap ? storeMap[k] : null),
    setItem: (k, v) => { storeMap[k] = String(v); },
    removeItem: (k) => { delete storeMap[k]; },
    clear: () => { storeMap = {}; }
  };
  globalThis.localStorage = stub;
  ok(NB.Store.load() === null, 'no stored best initially');
  ok(NB.Store.submit(7000, 'A') === true, 'first submit is a new best');
  ok(NB.Store.submit(5000, 'B') === false, 'lower score is not a new best');
  ok(NB.Store.load() && NB.Store.load().score === 7000, 'best persisted at 7000');
  /* full run -> victory must save the final score */
  freshPlay(7);
  let won = false;
  for (let lvl = 0; lvl < 3; lvl++) {
    let w = 0;
    while (G.state !== 'play' && w < 400) { step(10); w += 10; }
    G.testAct('release', { key: 'interact' });
    G.testAct('hack_all');
    const L = G.level;
    G.testAct('teleport', { tx: Math.round((L.exit.x - 8) / 16), ty: Math.round((L.exit.y - 8) / 16) });
    G.testAct('set_hp', { n: 6 });
    G.testAct('emp');
    G.testAct('hold', { key: 'interact' });
    let waited = 0;
    while (G.state === 'play' && waited < 240) { step(10); waited += 10; }
    if (G.state === 'victory') { won = true; break; }
  }
  ok(won || G.state === 'victory', 'reached victory screen');
  const stored = NB.Store.load();
  ok(G.newBest === true, 'victory flagged newBest (score ' + G.totalScore + ' > 7000)');
  ok(!!stored && stored.score === G.totalScore, 'final score persisted (' + (stored && stored.score) + ')');
  ok(!!stored && stored.rank === G.rankFor(G.totalScore), 'final rank persisted (' + (stored && stored.rank) + ')');
}

/* ---------------- T14: AI unstuck ---------------- */
section('T14 AI unstuck: guard blocked in a corner gives up instead of parking');
{
  freshPlay(42);
  G.testAct('set_hp', { n: 6 });
  G.testAct('teleport', { tx: 50, ty: 8 }); /* player far away, out of sight */
  const g = G.guards[0];
  g.x = 3 * 16 + 8; g.y = 24 * 16 + 8;     /* spawn-room corner (tile 3,24) */
  g.state = 'alert'; g.det = 1; g.noSeeT = 0;
  g.lkp.x = g.x - 70; g.lkp.y = g.y - 70;  /* chase straight into the NW corner */
  let leftAlertAt = -1;
  for (let i = 0; i < 200; i++) {
    step(1);
    if (g.state !== 'alert') { leftAlertAt = i; break; }
  }
  ok(leftAlertAt >= 0 && leftAlertAt < 120,
    'blocked chaser unstuck within ~0.7s (left alert at frame ' + leftAlertAt + ', state=' + g.state + ')');
}

/* ---------------- T15: state-machine transitions ---------------- */
section('T15 state machine: pause->quit, clear auto-advance to L2');
{
  freshPlay(42);
  G.testAct('pause'); step(2);
  ok(G.paused, 'pause engages');
  G.testAct('quit'); step(2);
  ok(G.state === 'title', 'quit to title from pause (state=' + G.state + ')');

  freshPlay(7);
  G.testAct('hack_all');
  const L = G.level;
  G.testAct('teleport', { tx: Math.round((L.exit.x - 8) / 16), ty: Math.round((L.exit.y - 8) / 16) });
  G.testAct('set_hp', { n: 6 });
  G.testAct('emp');
  G.testAct('hold', { key: 'interact' });
  let w = 0;
  while (G.state === 'play' && w < 200) { step(10); w += 10; }
  ok(G.state === 'clear', 'L1 clear screen shown (state=' + G.state + ')');
  let adv = 0;
  while (G.state === 'clear' && adv < 260) { step(10); adv += 10; }
  ok(G.state !== 'clear' && G.level && G.level.id === 2,
    'clear auto-advances to L2 (state=' + G.state + ', level=' + (G.level && G.level.id) + ')');
}

/* ---------------- T16: low-HP warning ---------------- */
section('T16 low-HP warning: flag on at <=2, off at 3, no self-damage');
{
  freshPlay(42);
  G.testAct('set_hp', { n: 2 });
  step(2);
  ok(G.hpWarn === 1, 'hpWarn set at 2 hp');
  step(180);
  ok(G.player.hp === 2, 'no damage over 3s at spawn (hp=' + G.player.hp + ')');
  ok(G.hpWarn === 1, 'hpWarn persists');
  G.testAct('set_hp', { n: 3 }); step(1);
  ok(G.hpWarn === 0, 'hpWarn clears at 3 hp');
}

/* ---------------- T17: level-clear wipe ---------------- */
section('T17 clear screen plays transition wipe before advancing');
{
  freshPlay(7);
  G.testAct('hack_all');
  const L = G.level;
  G.testAct('teleport', { tx: Math.round((L.exit.x - 8) / 16), ty: Math.round((L.exit.y - 8) / 16) });
  G.testAct('set_hp', { n: 6 });
  G.testAct('emp');
  G.testAct('hold', { key: 'interact' });
  let maxWipe = 0, left = false;
  for (let i = 0; i < 300; i++) {
    step(1);
    if (G.state === 'clear') maxWipe = Math.max(maxWipe, G.wipeT || 0);
    if (G.state !== 'clear' && i > 60) { left = true; break; }
  }
  ok(maxWipe > 0.8, 'wipeT reaches full during clear (max=' + maxWipe.toFixed(2) + ')');
  ok(left, 'left clear state (state=' + G.state + ')');
}

/* ---------------- T18: alert transition juice ---------------- */
section('T18 alert transition emits burst + shake');
{
  freshPlay(42);
  G.testAct('set_hp', { n: 6 });
  G.testAct('teleport', { tx: 50, ty: 8 });      /* player at (808,136) */
  const g = G.guards[0];
  g.x = 50 * 16 + 8; g.y = 6 * 16 + 8;           /* 32px above the player */
  g.face = Math.PI / 2;                          /* facing down, straight at the player */
  g.det = 1;                                     /* seen + full det -> alert next frame */
  G.particles.length = 0;
  G.shake = 0;
  step(1);
  ok(g.state === 'alert', 'guard enters alert');
  ok(G.particles.length > 0, 'alert burst spawned particles (' + G.particles.length + ')');
  ok(G.shake > 0, 'alert shake triggered (shake=' + G.shake.toFixed(2) + ')');
}

/* ---------------- T19: per-run seed ---------------- */
section('T19 run seed: fresh per production run, stable in test mode');
{
  freshPlay(999);
  G.state = 'title'; G.stateT = 0;
  G.testAct('start'); step(2);
  ok(G.seed === 999, 'test-mode start keeps explicit seed (seed=' + G.seed + ')');
  ok(G.state === 'intro' || G.state === 'play', 'test-mode start enters run (state=' + G.state + ')');
  G.testMode = false;
  G.state = 'title';
  const s1 = G.seed;
  G.testAct('start'); step(2);
  const s2 = G.seed;
  G.state = 'title';
  G.testAct('start'); step(2);
  const s3 = G.seed;
  ok((s2 !== s1) || (s3 !== s2),
    'production runs get fresh seeds (' + s1 + ' -> ' + s2 + ' -> ' + s3 + ')');
  G.testMode = true;
}

/* ---------------- T20: mute on every screen ---------------- */
section('T20 mute toggle works from every screen');
{
  freshPlay(42);
  const m0 = !!NB.Audio.muted;
  G.testAct('mute'); step(1);
  ok(!!NB.Audio.muted !== m0, 'mute toggles from play');
  G.state = 'gameover'; G.stateT = 1;
  G.testAct('mute'); step(1);
  ok(!!NB.Audio.muted === m0, 'mute toggles from gameover');
  G.state = 'clear'; G.stateT = 1; G.runStats.length = Math.max(1, G.runStats.length);
  G.testAct('mute'); step(1);
  ok(!!NB.Audio.muted !== m0, 'mute toggles from clear');
  NB.Audio.setMuted(m0);
}

/* ---------------- T21: static art anchors ---------------- */
section('T21 static art: exit pad & terminal racks anchored on floor tiles');
{
  const rawLevels = NB.Levels.LEVELS;
  for (let i = 0; i < rawLevels.length; i++) {
    const L = NB.Levels.parseLevel(rawLevels[i]);
    const e = L.exit;
    ok(e.tx !== undefined && e.ty !== undefined && L.grid[e.ty][e.tx] === 0,
      'L' + L.id + ' exit pad anchored on floor tile (' + e.tx + ',' + e.ty + ')');
    const okT = L.terminals.every((t) => L.grid[t.ty][t.tx] === 0);
    ok(okT, 'L' + L.id + ' all terminal racks anchored on floor tiles');
  }
}

/* ---------------- T22: interact buffer ---------------- */
section('T22 interact buffer: a tap can start a hack channel, but not sustain it');
{
  freshPlay(7);
  G.testAct('set_hp', { n: 6 });
  const t0 = G.level.terminals[0]; /* (104,200) */
  G.testAct('teleport', { x: t0.x, y: t0.y + 14 });
  G.testAct('emp'); /* keep the local guard quiet */
  G.testAct('tap', { key: 'interact' });
  step(6);
  const h1 = t0.hackTimer;
  ok(h1 > 0.02, 'tap started the channel (t=' + h1.toFixed(2) + ')');
  step(40);
  ok(t0.hackTimer < 0.15 && t0.hackTimer < h1,
    'unheld channel decays (' + h1.toFixed(2) + ' -> ' + t0.hackTimer.toFixed(2) + ')');
  ok(G.dataCount === 0, 'a tap alone does not steal the shard');
}

/* ---------------- T23: stun SFX timing ---------------- */
section('T23 EMP: stun SFX fires on zap, not when the stun wears off');
{
  freshPlay(42);
  G.testAct('set_hp', { n: 6 });
  G.testAct('teleport', { tx: 16, ty: 17 }); /* next to guard 0 spawn (16,16) */
  const realStun = NB.Sfx.stun;
  let calls = 0;
  NB.Sfx.stun = function () { calls++; };
  G.testAct('emp'); step(1);
  const atZap = calls;
  step(240); /* stun lasts 3s = 180 frames */
  NB.Sfx.stun = realStun;
  ok(atZap >= 1, 'stun SFX on EMP zap (calls=' + atZap + ')');
  ok(calls === atZap, 'no extra stun SFX on recovery (total=' + calls + ')');
}

/* ---------------- T24: damage source facing ---------------- */
section('T24 damage: the player turns to face the threat');
{
  freshPlay(42);
  G.testAct('set_hp', { n: 6 });
  G.testAct('teleport', { x: 698, y: 256 }); /* 2px right of the x=696 beam */
  let hit = false;
  for (let i = 0; i < 240 && !hit; i++) { step(1); if (G.player.hp < 6) hit = true; }
  ok(hit, 'player damaged by laser');
  const f = G.player.face;
  const facesBeam = isFinite(f) && Math.abs(Math.cos(f) - (-1)) < 0.2 && Math.abs(Math.sin(f)) < 0.2;
  ok(facesBeam, 'player faces the beam (face=' + (isFinite(f) ? f.toFixed(2) : 'NaN') + ')');
}

/* ---------------- T25: settings persistence ---------------- */
section('T25 settings: mute persists via the store');
{
  const before = !!NB.Audio.muted;
  NB.Audio.setMuted(true);
  ok(NB.Store.loadSettings().muted === true, 'mute=true persisted');
  NB.Audio.setMuted(false);
  ok(NB.Store.loadSettings().muted === false, 'mute=false persisted');
  NB.Audio.setMuted(before);
}

/* ---------------- T26: music ducking + game-over track ---------------- */
section('T26 music: ducks under pause, dirge track on game over');
{
  freshPlay(42);
  G.testAct('pause'); step(1);
  ok(G.paused === true && NB.Music.ducked === true, 'music ducks while paused');
  G.testAct('confirm'); step(1);
  ok(G.paused === false && NB.Music.ducked === false, 'music un-ducks on resume');
  G.testAct('damage', { n: 6 });
  let w = 0;
  while (G.state !== 'gameover' && w < 300) { step(1); w++; }
  ok(G.state === 'gameover', 'reached game over');
  ok(NB.Music.track === 'down', 'game-over dirge track armed (track=' + NB.Music.track + ')');
  NB.Music.track = null; NB.Music.pending = null;
}

/* ---------------- summary ---------------- */
console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.error(`${failures} FAILURES`);
  process.exit(1);
} else {
  console.log('ALL SIM TESTS PASSED');
}
