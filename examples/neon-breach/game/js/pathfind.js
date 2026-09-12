// NEON BREACH — pathfinding: A* (4-dir), DDA sight-line checks, BFS reach.

// solidFn(tx, ty) -> boolean. Returns a list of {x,y} waypoints (tile coords,
// excluding start, including goal) or null if unreachable.
export function aStar(w, h, solidFn, sx, sy, gx, gy, maxNodes = 6000) {
  if (sx === gx && sy === gy) return [];
  const idx = (x, y) => y * w + x;
  const N = w * h;
  const g = new Float32Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  // tiny binary heap keyed on f
  const heap = [];
  const hCost = (x, y) => Math.abs(x - gx) + Math.abs(y - gy);
  const push = (i, f) => {
    heap.push([f, i]);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heap[p][0] <= heap[c][0]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let p = 0;
      for (;;) {
        const l = p * 2 + 1, r = l + 1;
        let m = p;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === p) break;
        [heap[m], heap[p]] = [heap[p], heap[m]];
        p = m;
      }
    }
    return top[1];
  };

  const s = idx(sx, sy);
  g[s] = 0;
  push(s, hCost(sx, sy));
  const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
  let nodes = 0;
  while (heap.length) {
    const i = pop();
    if (closed[i]) continue;
    closed[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x === gx && y === gy) {
      const path = [];
      let c = i;
      while (c !== s && c !== -1) {
        path.push({ x: c % w, y: (c / w) | 0 });
        c = from[c];
      }
      path.reverse();
      return path;
    }
    if (++nodes > maxNodes) return null;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = idx(nx, ny);
      if (closed[j] || solidFn(nx, ny)) continue;
      const ng = g[i] + 1;
      if (ng < g[j]) {
        g[j] = ng;
        from[j] = i;
        push(j, ng + hCost(nx, ny));
      }
    }
  }
  return null;
}

// DDA (digital differential analyser) line test across tile grid.
// Returns true if the segment (x0,y0)->(x1,y1) in PIXEL space does not pass
// through any tile where solidAt(tx,ty) is true. Corners are forgiving:
// a solid tile only blocks if the ray's center path crosses its interior.
export function dda(lvl, x0, y0, x1, y1) {
  const T = 32;
  let tx = Math.floor(x0 / T), ty = Math.floor(y0 / T);
  const gx = Math.floor(x1 / T), gy = Math.floor(y1 / T);
  const dx = x1 - x0, dy = y1 - y0;
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
  let tMaxX = dx !== 0 ? ((dx > 0 ? (tx + 1) : tx) * T - x0) / dx : Infinity;
  let tMaxY = dy !== 0 ? ((dy > 0 ? (ty + 1) : ty) * T - y0) / dy : Infinity;
  const dTx = dx !== 0 ? T / Math.abs(dx) : Infinity;
  const dTy = dy !== 0 ? T / Math.abs(dy) : Infinity;
  for (let i = 0; i < 256; i++) {
    if (tx === gx && ty === gy) return true;
    const t = Math.min(tMaxX, tMaxY);
    if (t > 1) return false;
    if (tMaxX < tMaxY) { tx += stepX; tMaxX += dTx; }
    else { ty += stepY; tMaxY += dTy; }
    if (tx < 0 || ty < 0 || tx >= lvl.w || ty >= lvl.h) return false;
    const tile = lvl.tiles[ty * lvl.w + tx];
    if (tile === 1 || tile === 2 || tile === 3 || tile === 9 || tile === 10) return false;
    // closed doors block sight too
    if (tile === 7 && doorClosedAt(lvl, tx, ty)) return false;
  }
  return true;
}

function doorClosedAt(lvl, tx, ty) {
  for (const d of lvl.doors) if (d.tx === tx && d.ty === ty) return !d.open;
  return false;
}

// BFS from a start tile; returns a Set of reachable tile indices.
export function bfsReachable(lvl, sx, sy) {
  const { w, h, tiles } = lvl;
  const seen = new Uint8Array(w * h);
  const q = [sy * w + sx];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.shift();
    const x = i % w, y = (i / w) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (seen[j]) continue;
      const t = tiles[j];
      if (t === 1 || t === 2 || t === 3 || t === 9 || t === 10) continue;
      if (t === 7) {
        // door tile: passable only if some door is open (keycard logic)
        let anyOpen = false;
        for (const d of lvl.doors) if (d.open) anyOpen = true;
        if (!anyOpen) continue;
      }
      seen[j] = 1;
      q.push(j);
    }
  }
  return seen;
}

// Waypoints for a patrol: given a start tile, wander to N random reachable
// tiles and chain short A* paths. Returns flat list of tiles.
export function patrolPath(lvl, sx, sy, count = 3, rng = Math.random, radius = 6) {
  const reach = bfsReachable(lvl, sx, sy);
  const cells = [];
  const r2 = radius * radius;
  for (let i = 0; i < reach.length; i++) {
    if (!reach[i]) continue;
    const x = i % lvl.w, y = (i / lvl.w) | 0;
    const dx = x - sx, dy = y - sy;
    if (dx * dx + dy * dy <= r2) cells.push([x, y]);
  }
  if (!cells.length) cells.push([sx, sy]); // isolated corner: hold position
  const path = [];
  let cx = sx, cy = sy;
  for (let k = 0; k < count; k++) {
    const cand = cells[Math.floor(rng() * cells.length)];
    if (!cand) break;
    const p = findPath(lvl, cx, cy, cand[0], cand[1]);
    if (!p) break;
    path.push(...p);
    cx = cand[0]; cy = cand[1];
  }
  return path;
}

export function isSolid(lvl, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= lvl.w || ty >= lvl.h) return true;
  const t = lvl.tiles[ty * lvl.w + tx];
  if (t === 1 || t === 2 || t === 3 || t === 9 || t === 10) return true;
  if (t === 7) {
    for (const d of lvl.doors) if (d.tx === tx && d.ty === ty) return !d.open;
  }
  return false;
}

// Convenience: A* within a parsed level. Returns {x,y} tile waypoints or null.
export function findPath(lvl, sx, sy, gx, gy) {
  return aStar(lvl.w, lvl.h, (x, y) => isSolid(lvl, x, y), sx, sy, gx, gy);
}
