// NEON BREACH — pixel-art sprite system.
// Sprites are defined as string grids (1 char = 1px) and prerendered to
// offscreen canvases. Everything the game draws comes from here + code.

const empty = () => null;

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

// Draw a pixel map onto a canvas. `pal` maps char -> color. '.'/space/'' = transparent.
export function drawPixels(ctx, rows, pal, x, y, scale = 1, mirror = false) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      const col = pal[ch];
      if (!col) continue;
      const cx = mirror ? row.length - 1 - c : c;
      ctx.fillStyle = col;
      ctx.fillRect(x + cx * scale, y + r * scale, scale, scale);
    }
  }
}

// Prerender a pixel map to a canvas (with optional glow).
export function sprite(rows, pal, glow) {
  const w = Math.max(...rows.map((r) => r.length));
  const c = makeCanvas(w, rows.length);
  const ctx = c.getContext("2d");
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 3;
  }
  drawPixels(ctx, rows, pal, 0, 0, 1);
  ctx.shadowBlur = 0;
  return c;
}

function mirrorCanvas(src) {
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext("2d");
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

// ---------------------------------------------------------------- agent ---
// 16x16 hooded operative. Directions: right is canonical, left is mirrored.
const AGENT = {
  idleR: [
    "................",
    "................",
    "....hhhhhh......",
    "...hhhhhhhh.....",
    "...hhhhhhhh.....",
    "...vvvvvvv......",
    "...hhhhhhhh.....",
    "....bbbbbb......",
    "...baaaaab......",
    "...baaaabb......",
    "...bbabb.b......",
    "....bbbb........",
    "....bb.bb.......",
    "....bb..bb......",
    "...bbb..bbb.....",
    "................",
  ],
  walkR: [
    "................",
    "................",
    "....hhhhhh......",
    "...hhhhhhhh.....",
    "...hhhhhhhh.....",
    "...vvvvvvv......",
    "...hhhhhhhh.....",
    "....bbbbbb......",
    "...baaaaab......",
    "...baaaabb......",
    "...bbabb.b......",
    "....bbbb........",
    "...bb...bb......",
    "..bbb...bbb.....",
    "..ff....ff......",
    "................",
  ],
  up: [
    "................",
    "................",
    "....hhhhhh......",
    "...hhhhhhhh.....",
    "...hhhhhhhh.....",
    "...hhhhhhhh.....",
    "...hhhhhhhh.....",
    "....bbbbbb......",
    "...bbbbbbb......",
    "...bbaaaab......",
    "...bbbbbbb......",
    "....bbbb........",
    "....bb.bb.......",
    "....bb..bb......",
    "...bbb..bbb.....",
    "................",
  ],
  down: [
    "................",
    "................",
    "....hhhhhh......",
    "...hhhhhhhh.....",
    "...hhhhhhhh.....",
    "...vvvvvvvv.....",
    "...vvvvvvvv.....",
    "....bbbbbb......",
    "...baaaaab......",
    "...baaaaab......",
    "...bbbbbbb......",
    "....bbbb........",
    "....bb.bb.......",
    "....bb..bb......",
    "...bbb..bbb.....",
    "................",
  ],
  crouch: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "....hhhhhh......",
    "...hhhhhhhh.....",
    "...vvvvvvv......",
    "...hhhhhhhh.....",
    "....bbbbbb......",
    "...baaaab.b.....",
    "...bbbbbbb......",
    "...bbbbb........",
    "...bbb.bbb......",
    "...ff...ff......",
  ],
};

const PAL_AGENT = {
  h: "#12304a", // hood
  v: "#3df6ff", // visor
  b: "#182742", // suit
  a: "#2fd9f2", // chest accent
  f: "#0c1526", // boots
};

const PAL_GUARD = {
  h: "#4a1220",
  v: "#ff3355",
  b: "#3a1420",
  a: "#ff5c7a",
  f: "#200a12",
};

function agentFrames(rows, pal, glow) {
  const right = sprite(rows, pal, glow);
  const left = mirrorCanvas(right);
  return { right, left, up: sprite(rows, pal, glow), down: sprite(rows, pal, glow) };
}

function buildAgent(pal, glow) {
  return {
    idle: {
      right: sprite(AGENT.idleR, pal, glow),
      left: mirrorCanvas(sprite(AGENT.idleR, pal, glow)),
      up: sprite(AGENT.up, pal, glow),
      down: sprite(AGENT.down, pal, glow),
    },
    walk: {
      right: sprite(AGENT.walkR, pal, glow),
      left: mirrorCanvas(sprite(AGENT.walkR, pal, glow)),
      up: sprite(AGENT.up, pal, glow),
      down: sprite(AGENT.down, pal, glow),
    },
    crouch: {
      right: sprite(AGENT.crouch, pal, glow),
      left: mirrorCanvas(sprite(AGENT.crouch, pal, glow)),
      up: sprite(AGENT.crouch, pal, glow),
      down: sprite(AGENT.crouch, pal, glow),
    },
  };
}

// ---------------------------------------------------------------- camera ---
const CAM_IDLE = [
  "................",
  "................",
  "......mmmm......",
  "....mmmmmmmm....",
  "...mmmmmmmmmm...",
  "...mlrrrrrrlm...",
  "...mlreereelm...",
  "...mlrrrrrrlm...",
  "...mmmmmmmmmm...",
  "....mmmmmmmm....",
  "......mmmm......",
  ".....mmmmmm.....",
  "......mmmm......",
  "................",
  "................",
  "................",
];
const PAL_CAM = { m: "#1c2740", l: "#2c3d61", r: "#ff3355", e: "#ffd0da" };

const CAM_STUN = [
  "................",
  "................",
  "......mmmm......",
  "....mmmmmmmm....",
  "...mmmmmmmmmm...",
  "...mlgggggggm...",
  "...mlgeggegm....",
  "...mlgggggggm...",
  "...mmmmmmmmmm...",
  "....mmmmmmmm....",
  "......mmmm......",
  ".....mmmmmm.....",
  "......mmmm......",
  "................",
  "................",
  "................",
];
const PAL_CAM_STUN = { ...PAL_CAM, r: "#3a466b", e: "#9fb4d8", g: "#5b6c96" };

// ---------------------------------------------------------------- drone ---
const DRONE = [
  "................",
  "..rr........rr..",
  ".rrrr......rrrr.",
  "..rr........rr..",
  ".....mmmm.......",
  "....mmmmmm......",
  "...mmmmmmmm.....",
  "...mmrrrrmm.....",
  "...mmeeremm.....",
  "...mmmmmmmm.....",
  "....mmmmmm......",
  ".....mmmm.......",
  "................",
  "................",
  "................",
  "................",
];
const PAL_DRONE = { r: "#ff3355", m: "#252f4a", e: "#ffd0da" };

const DRONE_STUN = [
  "................",
  "..rr........rr..",
  ".rrrr......rrrr.",
  "..rr........rr..",
  ".....mmmm.......",
  "....mmmmmm......",
  "...mmmmmmmm.....",
  "...mmggggmm.....",
  "...mmgeemmm.....",
  "...mmmmmmmm.....",
  "....mmmmmm......",
  ".....mmmm.......",
  "................",
  "................",
  "................",
  "................",
];
const PAL_DRONE_STUN = { ...PAL_DRONE, e: "#9fb4d8", g: "#5b6c96" };

// ---------------------------------------------------------------- shard ---
const SHARD = [
  "....cccc....",
    "...cwwwwc...",
    "..cwwwwwwc..",
    "..cwwCCwwc..",
    ".cwwCCCCwwc.",
    ".cwwCCCCwwc.",
    ".cwwwwwwwwc.",
    "..cwwwwwwc..",
    "..cwwwwwwc..",
    "...cwwwwc...",
    "....cccc....",
];
const PAL_SHARD = { c: "#0e7d95", w: "#7df9ff", C: "#e8ffff" };

const KEYCARD = [
  "..kkkkkk..",
  ".kYYYYYYYk",
  ".kYYCCYY.k",
  ".kYYCCYY.k",
  ".kYYYYYYYk",
  "..kkkkkk..",
];
const PAL_KEYCARD = { k: "#332200", Y: "#ffc233", C: "#fff2c2" };

// ---------------------------------------------------------------- server ---
// 32x32 server core cabinet
const SERVER = [
  "................................",
  ".FFFFFFFFFFFFFFFFFFFFFFFFFFFFFF.",
  ".rrrrrrrrrrrrrrrrrrrrrrrrrrrrrr.",
  ".F............................F.",
  ".F............................F.",
  ".F.........swwwwwwwwws........F.",
  ".F.........swCCwwwwCws........F.",
  ".F.........swwCCwwCCww........F.",
  ".F.........swCCwwwwCws........F.",
  ".F.........swwwwwwwwws........F.",
  ".F............................F.",
  ".F............................F.",
  ".F..l...l...l...l...l...l.....F.",
  ".F..l...l...l...l...l...l.....F.",
  ".F............................F.",
  ".rrrrrrrrrrrrrrrrrrrrrrrrrrrrrr.",
  ".F............................F.",
  ".F.......c.c.c.c.c.c.c........F.",
  ".F............................F.",
  ".F.......c.c.c.c.c.c.c........F.",
  ".F............................F.",
  ".F.......c.c.c.c.c.c.c........F.",
  ".F............................F.",
  ".F.......c.c.c.c.c.c.c........F.",
  ".F............................F.",
  ".F.......c.c.c.c.c.c.c........F.",
  ".F............................F.",
  ".F.......c.c.c.c.c.c.c........F.",
  ".F............................F.",
  ".F.......c.c.c.c.c.c.c........F.",
  ".FFFFFFFFFFFFFFFFFFFFFFFFFFFFFF.",
  "................................",
];
const PAL_SERVER = {
  F: "#0c1322",
  r: "#21e6ff",
  l: "#2fd9f2",
  s: "#0a2438",
  w: "#123a5c",
  C: "#7df9ff",
  c: "#3dff9a",
};

// 24x24 data terminal (shard pedestal)
const TERMINAL = [
  "........................",
  "..gggggggggggggggggggg..",
  "..gFFFFFFFFFFFFFFFFFFg..",
  "..gFccccccccccccccccFg..",
  "..gFccccccDDDDccccccFg..",
  "..gFcccccDDDDDDcccccFg..",
  "..gFccccDCCCCCCDccccFg..",
  "..gFccccDCCCCCCDccccFg..",
  "..gFcccccDDDDDDcccccFg..",
  "..gFccccccDDDDccccccFg..",
  "..gFccccccccccccccccFg..",
  "..gFFFFFFFFFFFFFFFFFFg..",
  "....gggggggggggggggg....",
  "....pppppppppppppppp....",
  "....pppppppppppppppp....",
  "....pp............pp....",
  "....pp............pp....",
  "....pp............pp....",
  "...ppp............ppp...",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
];
const PAL_TERM = { g: "#0c1322", F: "#22325a", c: "#0e2a44", D: "#123a5c", p: "#151d33" };

// 32x32 blast door (frame drawn around tile, panel inside)
const DOOR = [
  "hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh",
  "hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh",
  "hhPYLPPPPPPPPPPRRPPPPPPPPPPLYPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPPLPPPPPPPPPPffPPPPPPPPPPLPPhh",
  "hhPYLPPPPPPPPPPffPPPPPPPPPPLYPhh",
  "hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh",
  "hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh",
];
const PAL_DOOR = { h: "#0c1322", P: "#1a2745", L: "#21e6ff", f: "#0a1120", Y: "#ffc233", R: "#ff3355" };

// 32x32 exit pod
const EXIT = [
  "................................",
  "............ddddddd.............",
  ".........ddddddddddddd..........",
  ".......ddddddddddddddddd........",
  "......ddddddcccccccdddddd.......",
  ".....dddddcccccccccccddddd......",
  "....ddddcccccccccccccccdddd.....",
  "...ddddccDDDDDDDDcccccccdddd....",
  "...dddccDDDDDDDDDccccccccddd....",
  "..ddddccDDDDDDDDDccccccccdddd...",
  "..dddcccccccccccccccccccccddd...",
  "..dddcccccccccccccccccccccddd...",
  ".dddcccccccccccEEccccccccccddd..",
  ".dddcccccccccccEEccccccccccddd..",
  ".dddcccccccccccccccccccccccddd..",
  ".dddccccDDDDDDDDDccccccccccddd..",
  ".dddccccDDDDDDDDDccccccccccddd..",
  ".dddccccDDDDDDDDDccccccccccddd..",
  ".dddcccccccccccccccccccccccddd..",
  "..dddcccccccccccccccccccccddd...",
  "..dddcccccccccccccccccccccddd...",
  "..ddddcccccccccccccccccccdddd...",
  "...dddcccccccccccccccccccddd....",
  "...ddddcccccccccccccccccdddd....",
  "....ddddcccccccccccccccdddd.....",
  ".....dddddcccccccccccddddd......",
  "......ddddddcccccccdddddd.......",
  ".......ddddddddddddddddd........",
  ".........ddddddddddddd..........",
  "............ddddddd.............",
  "................................",
  "................................",
];
const PAL_EXIT = { d: "#0c1322", c: "#0e2a44", D: "#7df9ff", E: "#e8ffff" };

export function buildAll() {
  return {
    agent: buildAgent(PAL_AGENT, "#2ff3ff55"),
    guard: buildAgent(PAL_GUARD, "#ff335555"),
    camIdle: sprite(CAM_IDLE, PAL_CAM, "#ff335588"),
    camStun: sprite(CAM_STUN, PAL_CAM_STUN),
    drone: sprite(DRONE, PAL_DRONE, "#ff335588"),
    droneStun: sprite(DRONE_STUN, PAL_DRONE_STUN),
    shard: sprite(SHARD, PAL_SHARD, "#7df9ff"),
    keycard: sprite(KEYCARD, PAL_KEYCARD, "#ffc233"),
    server: sprite(SERVER, PAL_SERVER, "#21e6ff44"),
    terminal: sprite(TERMINAL, PAL_TERM),
    door: sprite(DOOR, PAL_DOOR),
    exit: sprite(EXIT, PAL_EXIT, "#7df9ff88"),
  };
}
