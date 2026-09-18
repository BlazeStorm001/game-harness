// Level integrity checker: reachability, entity placement, guard paths.
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const here = fileURLToPath(new URL('.', import.meta.url));
const levels = require(here + '../js/levels.js');

let failures = 0;
function fail(msg) { console.error('  FAIL: ' + msg); failures++; }
function ok(msg) { console.log('  ok: ' + msg); }

/* sample a straight patrol segment; report if it comes within `rad` of any solid tile */
function segClearance(L, walkable, a, b, rad) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(dist / 4));
  for (let s = 0; s <= n; s++) {
    const px = a.x + (b.x - a.x) * s / n;
    const py = a.y + (b.y - a.y) * s / n;
    const tx0 = Math.floor((px - rad - 16) / 16), tx1 = Math.floor((px + rad + 16) / 16);
    const ty0 = Math.floor((py - rad - 16) / 16), ty1 = Math.floor((py + rad + 16) / 16);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) continue;
      if (walkable(tx, ty)) continue;
      const cx = Math.max(tx * 16, Math.min(px, tx * 16 + 16));
      const cy = Math.max(ty * 16, Math.min(py, ty * 16 + 16));
      if (Math.hypot(px - cx, py - cy) < rad) {
        return `near solid tile (${tx},${ty}) at x=${px.toFixed(0)},y=${py.toFixed(0)}`;
      }
    }
  }
  return null;
}
function checkLoop(L, walkable, pts, rad, label) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const hit = segClearance(L, walkable, a, b, rad);
    if (hit) fail(`${label} segment ${i} clips solid: ${hit}`);
  }
}

/* runtime path: spawn -> wp0 -> wp1 -> ... -> wpN -> wp0 (loop). The game never
   returns to the spawn, so spawn->wp0 is a one-shot segment. */
function checkEntity(L, walkable, ent, path, rad, label) {
  const hit0 = segClearance(L, walkable, ent, path[0], rad);
  if (hit0) fail(`${label} spawn->wp0 clips solid: ${hit0}`);
  checkLoop(L, walkable, path, rad, label);
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

for (const def of levels.LEVELS) {
  const L = levels.parseLevel(def);
  console.log(`Level ${L.id} (${L.name}) ${L.w}x${L.h}`);
  // grid 0 = floor, 3 = auto-opening door (passable). 1 wall, 2 crate block.
  const walkable = (x, y) => x >= 0 && y >= 0 && x < L.w && y < L.h && (L.grid[y][x] === 0 || L.grid[y][x] === 3);

  // BFS from spawn
  const sx = Math.floor(L.spawn.x / 16), sy = Math.floor(L.spawn.y / 16);
  if (!walkable(sx, sy)) fail(`spawn not walkable at ${sx},${sy}`);
  const seen = new Set();
  const q = [[sx, sy]];
  seen.add(sx + ',' + sy);
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      const k = nx + ',' + ny;
      if (walkable(nx, ny) && !seen.has(k)) { seen.add(k); q.push([nx, ny]); }
    }
  }
  ok(`reachable tiles: ${seen.size}`);

  for (const t of L.terminals) {
    const tx = Math.floor(t.x / 16), ty = Math.floor(t.y / 16);
    if (!walkable(tx, ty)) fail(`terminal not on floor at ${tx},${ty}`);
    else if (!seen.has(tx + ',' + ty)) fail(`terminal unreachable at ${tx},${ty}`);
  }
  const etx = Math.floor(L.exit.x / 16), ety = Math.floor(L.exit.y / 16);
  if (!walkable(etx, ety)) fail('exit not on floor');
  else if (!seen.has(etx + ',' + ety)) fail('exit unreachable');

  for (let gi = 0; gi < L.guards.length; gi++) {
    const g = L.guards[gi];
    const gx = Math.floor(g.x / 16), gy = Math.floor(g.y / 16);
    if (!walkable(gx, gy)) fail(`guard ${gi} spawn not floor ${gx},${gy}`);
    checkEntity(L, walkable, g, g.path, 6, `guard ${gi}`); // r=6 collision radius
  }
  for (let di = 0; di < L.drones.length; di++) {
    const d = L.drones[di];
    const dx = Math.floor(d.x / 16), dy = Math.floor(d.y / 16);
    if (!walkable(dx, dy)) fail(`drone ${di} spawn not floor ${dx},${dy}`);
    checkEntity(L, walkable, d, d.path, 5, `drone ${di}`);
  }
  for (const r of L.reinforce) {
    const rtx = Math.floor(r.x / 16), rty = Math.floor(r.y / 16);
    if (!walkable(rtx, rty)) fail(`reinforce point not floor ${rtx},${rty}`);
    // reinforcements patrol a small horizontal loop around their point
    checkLoop(L, walkable, [
      { x: r.x, y: r.y }, { x: r.x + 22, y: r.y },
      { x: r.x, y: r.y }, { x: r.x - 22, y: r.y }
    ], 5, `reinforce ${rtx},${rty}`);
  }
  for (const l of L.lasers) {
    const ax = Math.floor(l.ax / 16), ay = Math.floor(l.ay / 16);
    const bx = Math.floor(l.bx / 16), by = Math.floor(l.by / 16);
    const midx = Math.floor((l.ax + l.bx) / 2 / 16), midy = Math.floor((l.ay + l.by) / 2 / 16);
    if (!walkable(midx, midy)) fail(`laser mid not floor (${midx},${midy})`);
    // endpoints: wall or floor both ok
  }
  for (const d of L.doors) {
    if (L.grid[d.y][d.x] !== 3) fail(`door grid not 3 at ${d.x},${d.y}`);
    // door must be reachable from both sides
    const sides = DIRS.filter(([dx, dy]) => walkable(d.x + dx, d.y + dy));
    if (sides.length < 2) fail(`door has <2 floor neighbors at ${d.x},${d.y}`);
  }
  // terminal count
  if (L.terminals.length !== 3) fail(`expected 3 terminals, got ${L.terminals.length}`);
  if (L.guards.length === 0) fail('no guards');
  console.log(`  guards=${L.guards.length} drones=${L.drones.length} lasers=${L.lasers.length} doors=${L.doors.length} crates=${def.crates.length}`);
}
console.log(failures === 0 ? '\nALL LEVEL CHECKS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
