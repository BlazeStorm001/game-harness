// NEON BREACH — level definitions.
// Levels are built programmatically: floor + boundary walls + spine columns
// (pattern strings) + stamped wall runs + entity cells. This avoids
// hand-counting dot runs.
//
// ASCII legend (internal map format):
//   # wall    . floor       @ player start
//   p pillar (blocks)       c console (blocks)
//   v floor grate (walkable) % hazard floor     * glow floor
//   k keycard   D blast door (opens when any keycard is taken)
//   S server core (blocks)  T data terminal (blocks, 1 shard each)
//   C/L/U/V cameras (mounted, facing right/left/up/down)
//   G guard     X drone
//   H exit hatch (walkable)

export const TILE = {
  FLOOR: 0, WALL: 1, PILLAR: 2, CONSOLE: 3, VENT: 4, HAZARD: 5,
  GLOW: 6, DOOR: 7, EXIT: 8, SERVER: 9, TERMINAL: 10,
};

// Tiles that block movement / pathfinding / sight.
export const SOLID = new Set([
  TILE.WALL, TILE.PILLAR, TILE.CONSOLE, TILE.DOOR, TILE.SERVER, TILE.TERMINAL,
]);

function buildLevel(cfg) {
  const { w, h, spines = [], walls = [], cells = {} } = cfg;
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) row.push(y === 0 || y === h - 1 || x === 0 || x === w - 1 ? "#" : ".");
    rows.push(row);
  }
  for (const sp of spines) {
    for (let i = 0; i < sp.p.length; i++) rows[1 + i][sp.x] = sp.p[i];
  }
  for (const [x0, y0, x1, y1] of walls) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) rows[y][x] = "#";
  }
  for (const key of Object.keys(cells)) {
    const [x, y] = key.split(",").map(Number);
    rows[y][x] = cells[key];
  }
  return { name: cfg.name, sub: cfg.sub, rows: rows.map(r => r.join("")) };
}

// ── SECTOR 01 — 40x26 ──────────────────────────────────────────────────────
// Spine A x=13 (gaps y3-4, y12-13, y21-22); Spine B x=24 (D y5, gaps y15-16)
const L1 = buildLevel({
  name: "SECTOR 01 — INTAKE WING",
  sub: "Extract the data shards. A keycard clears every blast door.",
  w: 40, h: 26,
  spines: [
    { x: 13, p: "##..#######..#######..##" },
    { x: 24, p: "####D#########..########" },
  ],
  walls: [[24, 12, 38, 12]],
  cells: {
    "2,23": "@", "3,3": "k",
    "17,2": "T", "16,23": "T", "31,6": "S", "38,24": "H",
    "27,3": "C", "18,7": "G", "30,18": "G",
    "5,1": "c", "6,1": "c", "7,1": "c",
    "15,10": "p", "21,10": "p", "33,23": "p",
    "15,12": "v", "16,12": "v", "17,12": "v",
    "19,11": "%", "38,23": "*",
  },
});

// ── SECTOR 02 — 42x28 ──────────────────────────────────────────────────────
// Spine A x=13 (gaps y4-5, y13-14, y21-22; D y9); Spine B x=28 (gaps y4-5, y14-15, y21-22; D y18)
const L2 = buildLevel({
  name: "SECTOR 02 — RESEARCH DECK",
  sub: "Three strips, two blast doors. Watch the cameras.",
  w: 42, h: 28,
  spines: [
    { x: 13, p: "###..###D###..######..####" },
    { x: 28, p: "###..########..##D##..####" },
  ],
  cells: {
    "2,25": "@", "6,13": "k",
    "4,2": "T", "20,25": "T", "39,2": "T",
    "21,13": "S", "40,26": "H",
    "10,10": "G", "20,8": "G", "35,13": "G",
    "16,4": "C", "34,24": "C", "21,20": "X",
    "8,1": "c", "9,1": "c", "10,1": "c",
    "35,1": "c", "36,1": "c", "37,1": "c",
  },
});

// ── SECTOR 03 — 44x30 ──────────────────────────────────────────────────────
// Spine A x=14 (gaps y3-7, y12-13; D y8); Spine B x=28 (D y18 only)
// Vault: x18..24 wall box, D at (21,11), S inside at (21,15)
const L3 = buildLevel({
  name: "SECTOR 03 — CORE VAULT",
  sub: "The core is warded. Cameras inside the vault, drones on the wings.",
  w: 44, h: 30,
  spines: [
    { x: 14, p: "##.....D###..#############" },
    { x: 28, p: "#################D##########" },
  ],
  walls: [
    [18, 11, 20, 11], [22, 11, 24, 11],
    [18, 12, 18, 17], [24, 12, 24, 17],
    [18, 18, 24, 18],
  ],
  cells: {
    "2,27": "@", "9,3": "k",
    "2,2": "T", "15,26": "T", "40,27": "T",
    "21,15": "S", "41,27": "H",
    "7,10": "G", "20,6": "G", "34,10": "G", "33,24": "G",
    "19,12": "C", "23,12": "L", "35,3": "V",
    "20,8": "X", "33,15": "X",
    "15,1": "c", "19,1": "c", "23,1": "c",
    "17,15": "p", "16,10": "%", "30,27": "*",
    "21,11": "D",
  },
});

export const LEVELS = [L1, L2, L3];

// ── Parsing ────────────────────────────────────────────────────────────────

export function parseLevel(def) {
  const h = def.rows.length;
  const w = def.rows[0].length;
  const tiles = new Uint8Array(w * h);
  const lvl = {
    w, h, name: def.name, sub: def.sub, tiles,
    start: null, doors: [], terminals: [], server: null, exit: null,
    cameras: [], guards: [], drones: [], keycards: [],
    shardsTotal: 0,
  };
  const put = (x, y, extra) =>
    Object.assign({ x: x * 32 + 16, y: y * 32 + 16, tx: x, ty: y }, extra);
  for (let y = 0; y < h; y++) {
    const row = def.rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      let t = TILE.FLOOR;
      switch (ch) {
        case "#": t = TILE.WALL; break;
        case "p": t = TILE.PILLAR; break;
        case "c": t = TILE.CONSOLE; break;
        case "v": t = TILE.VENT; break;
        case "%": t = TILE.HAZARD; break;
        case "*": t = TILE.GLOW; break;
        case "D":
          t = TILE.DOOR;
          lvl.doors.push(put(x, y, { open: false, anim: 0 }));
          break;
        case "S":
          t = TILE.SERVER;
          lvl.server = put(x, y, { done: false });
          break;
        case "T":
          t = TILE.TERMINAL;
          lvl.terminals.push(put(x, y, { done: false }));
          lvl.shardsTotal++;
          break;
        case "H":
          t = TILE.EXIT;
          lvl.exit = put(x, y, { done: false });
          break;
        case "@": lvl.start = put(x, y); break;
        case "k": lvl.keycards.push(put(x, y, { taken: false })); break;
        case "C": case "L": case "U": case "V": {
          const a = { C: 0, L: Math.PI, U: -Math.PI / 2, V: Math.PI / 2 }[ch];
          lvl.cameras.push(put(x, y, { angle: a, baseAngle: a, sweep: 0, susp: 0, stun: 0, dir: ch }));
          break;
        }
        case "G": lvl.guards.push(put(x, y, { state: "patrol", susp: 0, down: false })); break;
        case "X": lvl.drones.push(put(x, y, { dead: false, stun: 0, angle: 0 })); break;
      }
      tiles[y * w + x] = t;
    }
  }
  return lvl;
}

// Flood-fill validation. Doors are treated as passable (any keycard opens
// all of them). Terminals/server are solid, so they count as reachable when
// an adjacent floor tile is.
export function validateLevel(def) {
  const errs = [];
  const rows = def.rows;
  const h = rows.length;
  const w = rows[0] && rows[0].length;
  for (let y = 0; y < h; y++)
    if (rows[y].length !== w) errs.push(`row ${y}: length ${rows[y].length} != ${w}`);
  if (errs.length) return errs;
  const at = (x, y) => rows[y][x];
  for (let x = 0; x < w; x++) {
    if (at(x, 0) !== "#") errs.push(`boundary: (${x},0) not wall`);
    if (at(x, h - 1) !== "#") errs.push(`boundary: (${x},${h - 1}) not wall`);
  }
  for (let y = 0; y < h; y++) {
    if (at(0, y) !== "#") errs.push(`boundary: (0,${y}) not wall`);
    if (at(w - 1, y) !== "#") errs.push(`boundary: (${w - 1},${y}) not wall`);
  }
  const count = (ch) => rows.join("").split(ch).length - 1;
  for (const ch of ["@", "S", "H"])
    if (count(ch) !== 1) errs.push(`expected 1 '${ch}', found ${count(ch)}`);
  if (count("T") < 1) errs.push("no terminals 'T'");
  if (count("D") > 0 && count("k") < 1) errs.push("has doors but no keycard 'k'");
  const allowed = new Set("#.@pckDSTHv%*CGLUXVU".split(""));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (!allowed.has(rows[y][x])) errs.push(`bad char '${rows[y][x]}' at (${x},${y})`);

  const open = (ch) => !"#pcST".includes(ch); // doors passable
  let start = -1;
  for (let y = 0; y < h && start < 0; y++) start = rows[y].indexOf("@");
  if (start < 0) return [...errs, "no '@' start tile"];
  const seen = new Uint8Array(w * h);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (seen[j] || !open(rows[ny][nx])) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  const adjacentSeen = (x, y) =>
    ([1, 0, -1, 0].some((dx, i) => {
      const nx = x + (i < 2 ? dx : 0), ny = y + (i < 2 ? 0 : i === 2 ? 1 : -1);
      return nx >= 0 && ny >= 0 && nx < w && ny < h && seen[ny * w + nx];
    }));
  const bad = (ch, solid) => {
    const out = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (rows[y][x] === ch && !(solid ? adjacentSeen(x, y) : seen[y * w + x]))
          out.push(`(${x},${y})`);
    return out;
  };
  for (const ch of ["k", "H", "D", "G", "C", "X"]) {
    const b = bad(ch, false);
    if (b.length) errs.push(`unreachable '${ch}': ${b.join(",")}`);
  }
  for (const ch of ["T", "S"]) {
    const b = bad(ch, true);
    if (b.length) errs.push(`unreachable '${ch}': ${b.join(",")}`);
  }
  return errs;
}

export function validateAll() {
  const out = [];
  for (let i = 0; i < LEVELS.length; i++) {
    const errs = validateLevel(LEVELS[i]);
    if (errs.length) out.push({ level: i, errs });
  }
  return out;
}
