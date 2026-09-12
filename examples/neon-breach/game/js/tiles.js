// NEON BREACH — tile rendering + circle collision. The static floor/wall
// layer is prerendered to an offscreen canvas once per level.

export const T = 32;

export function isSolidTile(lvl, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= lvl.w || ty >= lvl.h) return true;
  const t = lvl.tiles[ty * lvl.w + tx];
  if (t === 1 || t === 2 || t === 3 || t === 9 || t === 10) return true;
  if (t === 7) {
    for (const d of lvl.doors) if (d.tx === tx && d.ty === ty) return !d.open;
  }
  return false;
}

export function moveCircle(lvl, e, r, dx, dy) {
  e.x += dx;
  resolveAxis(lvl, e, r, true, dx);
  e.y += dy;
  resolveAxis(lvl, e, r, false, dy);
}

function resolveAxis(lvl, e, r, isX, d) {
  const x0 = Math.floor((e.x - r) / T), x1 = Math.floor((e.x + r) / T);
  const y0 = Math.floor((e.y - r) / T), y1 = Math.floor((e.y + r) / T);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!isSolidTile(lvl, tx, ty)) continue;
      const cx = clamp(e.x, tx * T, (tx + 1) * T);
      const cy = clamp(e.y, ty * T, (ty + 1) * T);
      const ddx = e.x - cx, ddy = e.y - cy;
      if (ddx * ddx + ddy * ddy >= r * r) continue;
      if (isX) e.x = d > 0 ? cx - r - 0.001 : cx + r + 0.001;
      else e.y = d > 0 ? cy - r - 0.001 : cy + r + 0.001;
    }
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function buildWorldCanvas(lvl) {
  const c = document.createElement("canvas");
  c.width = lvl.w * T;
  c.height = lvl.h * T;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#04060f";
  ctx.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < lvl.h; y++)
    for (let x = 0; x < lvl.w; x++) {
      const t = lvl.tiles[y * lvl.w + x];
      const px = x * T, py = y * T;
      if (t === 0) drawFloor(ctx, px, py, x, y);
      else if (t === 4) drawVent(ctx, px, py);
      else if (t === 5) drawHazard(ctx, px, py);
      else if (t === 6) drawGlow(ctx, px, py);
      else if (t === 1) drawWall(ctx, px, py, lvl, x, y);
      else if (t === 2) drawPillar(ctx, px, py);
      else if (t === 3) drawConsole(ctx, px, py);
      else if (t === 8) drawExitPad(ctx, px, py);
    }
  return c;
}

function drawFloor(ctx, px, py, x, y) {
  ctx.fillStyle = "#0a0f1e";
  ctx.fillRect(px, py, T, T);
  ctx.strokeStyle = "rgba(30,45,80,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
  if ((x * 7 + y * 13) % 5 === 0) {
    ctx.fillStyle = "rgba(40,60,110,0.18)";
    ctx.fillRect(px + 8, py + 8, 16, 2);
  }
  if ((x * 11 + y * 5) % 7 === 0) {
    ctx.fillStyle = "rgba(33,230,255,0.06)";
    ctx.fillRect(px + 4, py + 20, 6, 2);
  }
}

function drawVent(ctx, px, py) {
  drawFloor(ctx, px, py);
  ctx.fillStyle = "#0d1526";
  ctx.fillRect(px + 4, py + 4, 24, 24);
  ctx.strokeStyle = "#22325a";
  for (let i = 0; i < 4; i++) ctx.strokeRect(px + 5.5, py + 7.5 + i * 5, 22, 3);
}

function drawHazard(ctx, px, py) {
  drawFloor(ctx, px, py);
  ctx.fillStyle = "rgba(255,194,51,0.10)";
  ctx.fillRect(px, py, T, T);
  ctx.strokeStyle = "rgba(255,194,51,0.5)";
  ctx.setLineDash([6, 5]);
  ctx.strokeRect(px + 3.5, py + 3.5, T - 7, T - 7);
  ctx.setLineDash([]);
}

function drawGlow(ctx, px, py) {
  drawFloor(ctx, px, py);
  const g = ctx.createRadialGradient(px + 16, py + 16, 2, px + 16, py + 16, 15);
  g.addColorStop(0, "rgba(33,230,255,0.35)");
  g.addColorStop(1, "rgba(33,230,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(px, py, T, T);
}

function drawWall(ctx, px, py, lvl, x, y) {
  ctx.fillStyle = "#111a2e";
  ctx.fillRect(px, py, T, T);
  const at = (dx, dy) => {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= lvl.w || ny >= lvl.h) return 1;
    return lvl.tiles[ny * lvl.w + nx];
  };
  const topOpen = at(0, -1) !== 1;
  // chunky bevel: darker bottom/right, lighter top/left
  ctx.fillStyle = "#1c2a45";
  ctx.fillRect(px, py, T, 5);
  ctx.fillRect(px, py, 4, T);
  ctx.fillStyle = "#0a1120";
  ctx.fillRect(px, py + T - 5, T, 5);
  ctx.fillRect(px + T - 4, py, 4, T);
  // inner panel detail
  ctx.fillStyle = "#141f38";
  ctx.fillRect(px + 7, py + 7, 18, 18);
  ctx.strokeStyle = "#0a1120";
  ctx.strokeRect(px + 7.5, py + 7.5, 17, 17);
  // neon trim on floor-facing edges
  if (topOpen || at(0, 1) !== 1 || at(-1, 0) !== 1 || at(1, 0) !== 1) {
    ctx.fillStyle = "rgba(33,230,255,0.16)";
    if (at(0, 1) !== 1) ctx.fillRect(px, py + T - 6, T, 2);
    if (topOpen) ctx.fillRect(px, py, T, 2);
    if (at(1, 0) !== 1) ctx.fillRect(px + T - 6, py, 2, T);
    if (at(-1, 0) !== 1) ctx.fillRect(px, py, 2, T);
  }
}

function drawPillar(ctx, px, py) {
  drawFloor(ctx, px, py);
  ctx.fillStyle = "#16223c";
  ctx.fillRect(px + 6, py + 6, 20, 20);
  ctx.fillStyle = "#233457";
  ctx.fillRect(px + 6, py + 6, 20, 4);
  ctx.fillStyle = "#0c1425";
  ctx.fillRect(px + 6, py + 22, 20, 4);
  ctx.strokeStyle = "rgba(33,230,255,0.35)";
  ctx.strokeRect(px + 6.5, py + 6.5, 19, 19);
}

function drawConsole(ctx, px, py) {
  drawFloor(ctx, px, py);
  ctx.fillStyle = "#101a30";
  ctx.fillRect(px + 4, py + 8, 24, 20);
  ctx.fillStyle = "#1d2c4d";
  ctx.fillRect(px + 4, py + 8, 24, 4);
  ctx.fillStyle = "#03222b";
  ctx.fillRect(px + 7, py + 14, 18, 10);
  // blinking-screen hint (static glow here; dynamic pulse in game loop)
  ctx.fillStyle = "rgba(33,230,255,0.55)";
  ctx.fillRect(px + 9, py + 16, 4, 6);
  ctx.fillStyle = "rgba(33,230,255,0.30)";
  ctx.fillRect(px + 15, py + 16, 8, 2);
  ctx.fillRect(px + 15, py + 20, 6, 2);
}

function drawExitPad(ctx, px, py) {
  drawFloor(ctx, px, py);
  const g = ctx.createRadialGradient(px + 16, py + 16, 2, px + 16, py + 16, 16);
  g.addColorStop(0, "rgba(127,255,255,0.4)");
  g.addColorStop(1, "rgba(127,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(px, py, T, T);
  ctx.strokeStyle = "rgba(127,255,255,0.8)";
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(px + 4.5, py + 4.5, 23, 23);
  ctx.setLineDash([]);
}

// Dynamic door tile (slides open when `open`, anim 0..1).
export function drawDoor(ctx, d, time) {
  const px = d.tx * T, py = d.ty * T;
  const a = d.anim;
  ctx.fillStyle = "#0a1120";
  ctx.fillRect(px, py, T, T);
  ctx.fillStyle = "#243456";
  ctx.fillRect(px + 2, py + 2, T - 4, T - 4);
  // two halves slide apart
  const half = (T - 8) / 2 * (1 - a);
  ctx.fillStyle = "#31446e";
  ctx.fillRect(px + 4, py + 4, Math.max(0, half), T - 8);
  ctx.fillRect(px + T - 4 - Math.max(0, half), py + 4, Math.max(0, half), T - 8);
  ctx.fillStyle = a > 0.98 ? "rgba(85,255,136,0.9)" : "rgba(255,71,102,0.9)";
  ctx.fillRect(px + T / 2 - 1, py + 6, 2, T - 12);
  if (a < 0.02) {
    ctx.fillStyle = "rgba(255,71,102,0.8)";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("LOCKED", px + T / 2, py - 2 + Math.sin(time * 4) * 0.5);
  }
}
