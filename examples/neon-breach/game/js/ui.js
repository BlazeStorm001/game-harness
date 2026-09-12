// NEON BREACH — HUD & screen overlays (drawn on the main canvas)
import { CFG, COLORS, RANKS, rankFor } from "./config.js";

const FONT = "ui-monospace, 'Cascadia Mono', 'JetBrains Mono', Menlo, monospace";

function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(4,10,22,${alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(33,230,255,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function bar(ctx, x, y, w, h, frac, color, bg = "rgba(10,16,32,0.9)") {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
}

// Top-left: vitals + gadgets
function drawVitals(ctx, game) {
  const p = game.player;
  panel(ctx, 14, 14, 250, 92);
  // HP segments (10)
  ctx.fillStyle = "#9fd8ff";
  ctx.font = `700 11px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("INTEGRITY", 26, 30);
  const segs = 10, segW = 18, segH = 10;
  for (let i = 0; i < segs; i++) {
    const on = p.hp > (i * 100) / segs;
    ctx.fillStyle = on
      ? (p.hp > 30 ? "#3dff9a" : (p.hp > 15 ? "#ffc233" : "#ff3355"))
      : "rgba(30,44,74,0.9)";
    ctx.fillRect(26 + i * (segW + 2), 38, segW, segH);
  }
  // gadget slots
  const slots = [
    { label: "EMP", key: "Q", n: p.emp, cd: game.empCd },
    { label: "SMK", key: "F", n: p.smoke, cd: 0 },
  ];
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const x = 26 + i * 64, y = 58;
    const ready = s.n > 0;
    ctx.fillStyle = ready ? "rgba(33,230,255,0.16)" : "rgba(20,28,48,0.9)";
    ctx.fillRect(x, y, 58, 36);
    ctx.strokeStyle = ready ? "rgba(33,230,255,0.8)" : "rgba(70,90,130,0.5)";
    ctx.strokeRect(x + 0.5, y + 0.5, 57, 35);
    ctx.fillStyle = ready ? "#21e6ff" : "#5a6c8c";
    ctx.font = `700 10px ${FONT}`;
    ctx.fillText(s.label, x + 6, y + 13);
    ctx.font = `400 9px ${FONT}`;
    ctx.fillText(`[${s.key}]`, x + 34, y + 25);
    ctx.font = `700 15px ${FONT}`;
    ctx.fillStyle = ready ? "#eaf9ff" : "#5a6c8c";
    ctx.fillText(`${s.n}`, x + 12, y + 30);
    if (s.cd > 0) {
      ctx.fillStyle = "rgba(255,194,51,0.85)";
      ctx.font = `700 10px ${FONT}`;
      ctx.fillText(s.cd.toFixed(1), x + 34, y + 13);
    }
  }
  // shards — per-level progress (run total appears on the death/clear/win screens)
  const lvl = game.lvl;
  const have = lvl ? lvl.terminals.filter((t) => t.done).length : 0;
  const total = lvl ? lvl.shardsTotal : 0;
  ctx.fillStyle = "#ffc233";
  ctx.font = `700 13px ${FONT}`;
  ctx.fillText(`◈ ${have}/${total}`, 162, 92);
}

// Top-right: level name, alarm meter, minimap, exit compass
function drawTopRight(ctx, game, W) {
  const mm = 132, pad = 14;
  // alarm meter (row 1: level name, row 2: status + alarm bar)
  panel(ctx, W - mm - pad, 14, mm, 46);
  ctx.fillStyle = "#9fd8ff";
  ctx.textAlign = "left";
  let fs = 10;
  ctx.font = `700 ${fs}px ${FONT}`;
  const name = game.levelName || "";
  while (ctx.measureText(name).width > mm - 16 && fs > 6) {
    fs -= 0.5;
    ctx.font = `700 ${fs}px ${FONT}`;
  }
  ctx.fillText(name, W - mm - pad + 8, 27);
  const a = game.alarm;
  const ax = W - mm - pad + 8, aw = mm - 16;
  bar(ctx, ax, 48, aw, 5, a, a > 0.66 ? "#ff3355" : a > 0.33 ? "#ffc233" : "#3dff9a");
  ctx.textAlign = "right";
  ctx.font = `700 8px ${FONT}`;
  ctx.fillStyle = a >= 1 ? "#ff3355" : "#7f96b8";
  ctx.fillText(a >= 1 ? "EXPOSED" : "SILENCE", W - pad - 8, 43);
  // minimap
  const my = 66;
  panel(ctx, W - mm - pad, my, mm, mm, 0.72);
  drawMinimap(ctx, game, W - mm - pad + 6, my + 6, mm - 12);
  // exit compass under minimap
  const cx = W - pad - 16, cy = my + mm + 22;
  const e = game.exitWorld;
  if (e) {
    const ang = Math.atan2(e.y - game.player.y, e.x - game.player.x);
    ctx.save();
    ctx.translate(cx, cy);
    panel(ctx, -16, -16, 32, 32, 0.72);
    ctx.rotate(ang);
    ctx.fillStyle = game.objectiveDone ? "#3dff9a" : "#21e6ff";
    ctx.beginPath();
    ctx.moveTo(12, 0); ctx.lineTo(-6, 7); ctx.lineTo(-2, 0); ctx.lineTo(-6, -7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawMinimap(ctx, game, x, y, s) {
  const lvl = game.lvl;
  const k = Math.min((s - 4) / lvl.w, (s - 4) / lvl.h);
  const ox = x + (s - lvl.w * k) / 2, oy = y + (s - lvl.h * k) / 2;
  ctx.fillStyle = "rgba(56,84,138,0.55)";
  for (let ty = 0; ty < lvl.h; ty++)
    for (let tx = 0; tx < lvl.w; tx++) {
      const t = lvl.tiles[ty * lvl.w + tx];
      if (t === 1 || t === 2 || t === 3 || t === 7)
        ctx.fillRect(x + ox + tx * k, y + oy + ty * k, Math.ceil(k), Math.ceil(k));
    }
  const dot = (wx, wy, c, r = 2) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x + ox + (wx / 32) * k, y + oy + (wy / 32) * k, r, 0, 6.284);
    ctx.fill();
  };
  for (const g of game.guards) if (!g.dead)
    dot(g.x, g.y, g.state === "chase" ? "#ff3355" : "#ff8ba0");
  for (const d of game.drones) if (!d.dead) dot(d.x, d.y, "#ffe066");
  for (const cam of game.cameras)
    dot(cam.x, cam.y, cam.alerted ? "#ff3355" : "#8b93a8", 1.6);
  if (!game.objectiveDone) dot(lvl.server.x, lvl.server.y, "#ffc233", 2.4);
  dot(lvl.exit.x, lvl.exit.y, "#3dff9a", 2.4);
  dot(game.player.x, game.player.y, "#21e6ff", 2.6);
}

function drawObjectives(ctx, game, H) {
  const l = game.lvl;
  const lines = [];
  if (l && l.keycards.length) {
    lines.push({ done: game.keycard, txt: game.keycard ? "KEYCARD — DOORS UNLOCKED" : "OBTAIN THE KEYCARD" });
  }
  lines.push({ done: game.objectiveDone, txt: game.objectiveDone ? "CORE BREACHED" : "BREACH THE CORE" });
  if (game.objectiveDone) {
    lines.push({ done: game.atExit, txt: "REACH THE EXIT" });
  }
  if (l && l.shardsTotal) {
    const have = l.terminals.filter((t) => t.done).length;
    lines.push({ done: have >= l.shardsTotal, txt: `DATA SHARDS ${have}/${l.shardsTotal} (BONUS)` });
  }
  const w = 240;
  panel(ctx, 14, H - 14 - lines.length * 17 - 8, w, lines.length * 17 + 10);
  ctx.textAlign = "left";
  lines.forEach((ln, i) => {
    const yy = H - 14 - (lines.length - 1 - i) * 17 - 8 + 4;
    ctx.fillStyle = ln.done ? "#3dff9a" : "#cfe8ff";
    ctx.font = `700 10px ${FONT}`;
    ctx.fillText((ln.done ? "■ " : "□ ") + ln.txt, 24, yy + 8);
  });
}

function drawCenter(ctx, game, W, H, ox = 0, oy = 0) {
  // channeling progress
  const p = game.player;
  if (p.channel) {
    const c = p.channel;
    const w = 160, x = W / 2 - w / 2, y = H / 2 + 46;
    panel(ctx, x - 8, y - 16, w + 16, 44, 0.7);
    ctx.textAlign = "center";
    ctx.fillStyle = "#21e6ff";
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText(c.label.toUpperCase(), W / 2, y - 2);
    bar(ctx, x, y + 6, w, 8, c.t / c.need, "#21e6ff");
    ctx.fillStyle = "#cfe8ff";
    ctx.font = `400 9px ${FONT}`;
    ctx.fillText("HOLD — SIGNAL INTERFERENCE ACTIVE", W / 2, y + 28);
  }
  // center messages
  if (game.msgT > 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = `rgba(234,249,255,${Math.min(1, game.msgT)})`;
    ctx.font = `700 15px ${FONT}`;
    ctx.shadowColor = "#21e6ff"; ctx.shadowBlur = 12;
    ctx.fillText(game.msg, W / 2, H / 2 - 70);
    ctx.shadowBlur = 0;
  }
  // interact prompt — only when in range of a valid target (same logic as handleInteract)
  const nearI = game.nearInteract();
  if (nearI && !p.channel && !p.dead) {
    const pulse = 0.7 + 0.3 * Math.sin(game.time * 8);
    ctx.textAlign = "center";
    ctx.fillStyle = `rgba(127,208,255,${pulse})`;
    ctx.shadowColor = "#21e6ff"; ctx.shadowBlur = 8;
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText(`[E] ${nearI.label}`, nearI.obj.x + ox, nearI.obj.y + oy - 24);
    ctx.shadowBlur = 0;
  }
  // takedown prompt — screen space (takedownTarget only returns valid targets)
  const near = game.takedownTarget();
  if (near && !p.dead) {
    const pulse = 0.75 + 0.25 * Math.sin(game.time * 8);
    ctx.textAlign = "center";
    ctx.fillStyle = `rgba(255,154,181,${pulse})`;
    ctx.shadowColor = "#ff3355"; ctx.shadowBlur = 8;
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText("[SPACE] SILENCE GUARD", p.x + ox, p.y + oy - 30);
    ctx.shadowBlur = 0;
  }
  // low HP vignette
  if (p.hp < 30 && !p.dead) {
    const a = (0.35 - p.hp / 100) * (0.6 + 0.4 * Math.sin(game.time * 5));
    const g = ctx.createRadialGradient(W / 2, H / 2, H / 3, W / 2, H / 2, H * 0.8);
    g.addColorStop(0, "rgba(255,0,40,0)");
    g.addColorStop(1, `rgba(255,0,40,${Math.max(0, a)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

function screen(ctx, W, H, dim = 0.78) {
  ctx.fillStyle = `rgba(2,5,12,${dim})`;
  ctx.fillRect(0, 0, W, H);
}
function center(ctx, W, H, txt, y, size, color, glow) {
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px ${FONT}`;
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 18; }
  ctx.fillText(txt, W / 2, y);
  ctx.shadowBlur = 0;
}

function drawMenu(ctx, game, W, H) {
  screen(ctx, W, H, 0.55);
  center(ctx, W, H, "NEON BREACH", H * 0.3, 46, "#21e6ff", "#21e6ff");
  center(ctx, W, H, "A TACTICAL STEALTH INFILTRATION", H * 0.3 + 26, 12, "#7fd0ff");
  const rows = [
    "WASD / ARROWS  MOVE    SHIFT  SPRINT    CTRL  CROUCH",
    "E (HOLD)  INTERACT    SPACE  SILENCE (MELEE)",
    "Q  EMP PULSE    F  SMOKE CANISTER    ESC  PAUSE    M  MUTE",
  ];
  rows.forEach((r, i) => center(ctx, W, H, r, H * 0.52 + i * 20, 12, "#cfe8ff"));
  center(ctx, W, H, "STAY IN THE SHADOWS. BREACH THE CORE. EXTRACT.", H * 0.52 + rows.length * 20 + 16, 11, "#ffc233");
  const pulse = 0.6 + 0.4 * Math.sin(game.time * 4);
  center(ctx, W, H, "PRESS ENTER TO INJECT", H * 0.82, 16, `rgba(61,255,154,${pulse})`, "#3dff9a");
}
function drawPause(ctx, game, W, H) {
  screen(ctx, W, H, 0.5);
  center(ctx, W, H, "PAUSED", H / 2 - 10, 30, "#21e6ff", "#21e6ff");
  center(ctx, W, H, "ESC RESUME    R RESTART LEVEL", H / 2 + 22, 12, "#cfe8ff");
}
function drawDead(ctx, game, W, H) {
  screen(ctx, W, H, 0.8);
  center(ctx, W, H, "TERMINATED", H / 2 - 26, 34, "#ff3355", "#ff3355");
  center(ctx, W, H, `THE GRID KEEPS YOUR GHOST — SHARDS BANKED: ${game.shards}`, H / 2 + 8, 13, "#cfe8ff");
  center(ctx, W, H, "ENTER  RETRY LEVEL      ESC  MENU", H / 2 + 40, 12, "#ffc233");
}
function drawClear(ctx, game, W, H) {
  screen(ctx, W, H, 0.7);
  center(ctx, W, H, "SECTOR CLEARED", H / 2 - 34, 32, "#3dff9a", "#3dff9a");
  const r = rankFor(game.score + game.shards * 5);
  center(ctx, W, H, `RANK ${r.name} — ${r.title}   SHARDS ${game.shards}   SCORE ${game.score}`, H / 2 + 4, 14, r.color);
  center(ctx, W, H, "ENTER  CONTINUE", H / 2 + 40, 13, "#ffc233");
}
function drawWin(ctx, game, W, H) {
  screen(ctx, W, H, 0.75);
  center(ctx, W, H, "EXTRACTION COMPLETE", H / 2 - 40, 32, "#21e6ff", "#21e6ff");
  const r = rankFor(game.score + game.shards * 5);
  center(ctx, W, H, `FINAL RANK  ${r.name} — ${r.title}`, H / 2 - 4, 15, r.color);
  center(ctx, W, H, `TOTAL SCORE ${game.score}    SHARDS ${game.shards}`, H / 2 + 24, 13, "#cfe8ff");
  center(ctx, W, H, "ENTER  PLAY AGAIN", H / 2 + 58, 13, "#3dff9a");
}

export function drawUI(ctx, game, W, H, ox = 0, oy = 0) {
  if (game.state === "menu") { drawMenu(ctx, game, W, H); return; }
  if (game.state === "dead") { drawDead(ctx, game, W, H); return; }
  if (game.state === "win") { drawWin(ctx, game, W, H); return; }
  if (game.state === "clear") { drawClear(ctx, game, W, H); return; }
  if (game.state === "pause") { drawPause(ctx, game, W, H); return; }
  drawVitals(ctx, game);
  drawTopRight(ctx, game, W);
  drawObjectives(ctx, game, H);
  drawCenter(ctx, game, W, H, ox, oy);
}

// --- post fx -------------------------------------------------------------
let _scan = null;
function scanPattern() {
  if (_scan) return _scan;
  const c = document.createElement("canvas");
  c.width = 4; c.height = 3;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(0,0,0,0.16)";
  g.fillRect(0, 2, 4, 1);
  _scan = g.createPattern(c, "repeat");
  return _scan;
}
export function drawPost(ctx, game, W, H) {
  ctx.fillStyle = scanPattern();
  ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  if (game.alarm > 0.55) {
    const a = (game.alarm - 0.55) * 1.1 * (0.6 + 0.4 * Math.sin(game.time * 7));
    ctx.strokeStyle = `rgba(255,45,95,${a})`;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, W - 10, H - 10);
  }
}
export function drawKeycard(ctx, k, time, S) {
  const bob = Math.sin(time * 3 + k.x) * 3;
  ctx.save();
  ctx.translate(k.x, k.y + bob);
  ctx.shadowColor = "#ffc233"; ctx.shadowBlur = 14;
  ctx.drawImage(S.keycard, -5, -4, 10, 6);
  ctx.restore();
}
