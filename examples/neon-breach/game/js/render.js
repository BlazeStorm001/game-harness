/* NEON BREACH - rendering: camera, world, HUD, screens, post-fx */
(function () {
  'use strict';
  var NB = window.NB;
  var T = 16, VW = 480, VH = 270;
  var G = NB.Game;
  var Spr = NB.Sprites;
  var FONT = "'Courier New', monospace";

  G.camX = 0; G.camY = 0;

  function txt(str, x, y, size, color, align, alpha) {
    var c = G.ctx;
    c.save();
    if (alpha !== undefined) c.globalAlpha = alpha;
    c.font = 'bold ' + size + 'px ' + FONT;
    c.textAlign = align || 'left';
    c.textBaseline = 'top';
    c.fillStyle = color;
    c.fillText(str, Math.round(x), Math.round(y));
    c.restore();
  }
  G.txt = txt;

  function camera() {
    var L = G.level;
    var p = G.player;
    var wx = L.w * T, wy = L.h * T;
    var tx = NB.clamp(p.x - VW / 2, 0, wx - VW);
    var ty = NB.clamp(p.y - VH / 2, 0, wy - VH);
    var k = Math.min(1, 8 * (1 / 60));
    G.camX = G.camX === undefined ? tx : NB.lerp(G.camX, tx, k);
    G.camY = G.camY === undefined ? ty : NB.lerp(G.camY, ty, k);
    if (G.shake > 0) {
      G.camX += (Math.random() - 0.5) * G.shake;
      G.camY += (Math.random() - 0.5) * G.shake;
    }
    return { x: G.camX, y: G.camY };
  }

  G.render = function () {
    var c = G.ctx;
    if (G.state === 'title') { renderTitle(); post(0); return; }

    var cam = camera();
    c.fillStyle = '#02030a';
    c.fillRect(0, 0, VW, VH);
    c.save();
    c.translate(-Math.round(cam.x), -Math.round(cam.y));

    c.drawImage(G.static, 0, 0);
    var L = G.level, p = G.player;

    /* exit pad */
    var ex = L.exit.x, ey = L.exit.y;
    var active = G.dataCount >= L.terminals.length;
    var pulse = (Math.sin(G.time * 3) + 1) / 2;
    c.globalAlpha = 0.5 + pulse * 0.5;
    c.strokeStyle = active ? '#4dff88' : '#334455';
    c.lineWidth = 1;
    c.strokeRect(ex + 2.5, ey + 2.5, 11, 11);
    c.globalAlpha = 1;
    if (active) {
      txt('EXIT', ex + 8, ey + 5.5, 5, '#4dff88', 'center');
      if (G.escapeT > 0) {
        c.strokeStyle = '#4dff88';
        c.beginPath();
        c.arc(ex + 8, ey + 8, 12, -Math.PI / 2, -Math.PI / 2 + G.escapeT * Math.PI * 2);
        c.stroke();
      }
    } else {
      c.fillStyle = '#334455';
      c.fillRect(ex + 6, ey + 4, 4, 8);
      c.fillStyle = '#4dff88';
      c.font = 'bold 6px ' + FONT;
      c.textAlign = 'center';
      c.fillText(G.dataCount + '/3', ex + 8, ey + 5.5);
    }

    /* doors: slabs retract toward the two sides that are wall */
    L.doors.forEach(function (d) {
      var dx = d.x * T, dy = d.y * T;
      var horizWall = d.x > 0 && d.x < L.w - 1 && L.grid[d.y][d.x - 1] === 1 && L.grid[d.y][d.x + 1] === 1;
      var w2 = Math.round(7 * (1 - d.open));
      c.fillStyle = '#16202f';
      c.strokeStyle = '#0a0f18';
      if (horizWall) {
        if (w2 > 0) {
          c.fillRect(dx + 1, dy + 3, w2, 10);
          c.fillRect(dx + 15 - w2, dy + 3, w2, 10);
        }
        c.fillStyle = d.open > 0.5 ? '#4dff88' : '#ff3366';
        c.fillRect(dx + 7, dy + 2, 2, 2);
      } else {
        if (w2 > 0) {
          c.fillRect(dx + 3, dy + 1, 10, w2);
          c.fillRect(dx + 3, dy + 15 - w2, 10, w2);
        }
        c.fillStyle = d.open > 0.5 ? '#4dff88' : '#ff3366';
        c.fillRect(dx + 7, dy + 7, 2, 2);
      }
    });

    /* lasers */
    L.lasers.forEach(function (l) {
      c.fillStyle = l.on ? '#ff4444' : '#551122';
      c.fillRect(l.ax - 2, l.ay - 2, 5, 5);
      c.fillRect(l.bx - 2, l.by - 2, 5, 5);
      if (l.on) {
        c.strokeStyle = 'rgba(255,40,60,0.35)';
        c.lineWidth = 4;
        c.beginPath(); c.moveTo(l.ax, l.ay); c.lineTo(l.bx, l.by); c.stroke();
        c.strokeStyle = '#ff4455';
        c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(l.ax, l.ay); c.lineTo(l.bx, l.by); c.stroke();
      } else {
        c.strokeStyle = 'rgba(255,40,60,0.12)';
        c.lineWidth = 1;
        c.setLineDash([2, 3]);
        c.beginPath(); c.moveTo(l.ax, l.ay); c.lineTo(l.bx, l.by); c.stroke();
        c.setLineDash([]);
      }
    });

    /* terminal screens */
    L.terminals.forEach(function (t) {
      var px = t.tx * T, py = t.ty * T;
      var col = t.done ? '#4dff88' : '#ffb020';
      var sc;
      if (t.face === 'down') sc = [px + 4, py + 9];
      else if (t.face === 'up') sc = [px + 4, py + 1];
      else if (t.face === 'right') sc = [px + 9, py + 4];
      else sc = [px + 1, py + 4];
      if (t.done) {
        c.fillStyle = col;
        c.globalAlpha = 0.6 + 0.4 * Math.sin(G.time * 4);
        c.fillRect(sc[0], sc[1], t.face === 'up' || t.face === 'down' ? 8 : 3, t.face === 'up' || t.face === 'down' ? 3 : 8);
        c.globalAlpha = 1;
      } else {
        c.fillStyle = '#0a2a12';
        c.fillRect(sc[0], sc[1], t.face === 'up' || t.face === 'down' ? 8 : 3, t.face === 'up' || t.face === 'down' ? 3 : 8);
        c.fillStyle = col;
        c.fillRect(sc[0], sc[1], t.face === 'up' || t.face === 'down' ? 2 : 1, t.face === 'up' || t.face === 'down' ? 1 : 2);
        var prog = t.hackTimer / 1.5;
        if (prog > 0.02) {
          c.strokeStyle = '#ffb020';
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc(t.x, t.y, 10, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
          c.stroke();
        }
      }
    });

    /* guard cones */
    G.guards.forEach(function (g) {
      if (g.stunT > 0) return;
      var rgb, a, range, half;
      if (g.state === 'alert') { rgb = '255,60,70'; a = 0.34; range = 150; half = 0.72; }
      else if (g.state === 'search') { rgb = '255,170,60'; a = 0.26; range = 120; half = 0.8; }
      else { rgb = '255,47,160'; a = 0.18 + g.det * 0.3; range = 118; half = 0.62; }
      Spr.drawCone(c, g.x, g.y, g.face, half, range, rgb, a,
        g.det > 0.04 || g.state === 'alert' ? p : null);
    });

    /* drone glow */
    G.drones.forEach(function (d) {
      var a = d.state === 'alert' ? 0.35 : d.det * 0.3;
      if (a > 0.03) {
        var gr = c.createRadialGradient(d.x, d.y, 2, d.x, d.y, 30);
        gr.addColorStop(0, 'rgba(255,50,70,' + a + ')');
        gr.addColorStop(1, 'rgba(255,50,70,0)');
        c.fillStyle = gr;
        c.beginPath(); c.arc(d.x, d.y, 30, 0, 6.283); c.fill();
      }
    });

    /* player ghosts */
    p.ghost.forEach(function (gh) {
      Spr.drawPlayer(c, gh.x, gh.y, { dir: gh.dir, phase: 0, moving: false, crouch: false, alpha: gh.life / 0.28 * 0.4 });
    });

    /* player (topples & fades as the trace is deleted) */
    if (p.dead) {
      var dk = 1 - NB.clamp(p.deathT / 1.5, 0, 1);
      c.save();
      c.translate(p.x, p.y);
      c.rotate(dk * 2.6);
      c.translate(-p.x, -p.y);
      Spr.drawPlayer(c, p.x, p.y, {
        dir: p.dir, phase: 0, moving: false, crouch: false, alpha: 0.6
      });
      c.restore();
    } else {
      var blink = p.inv > 0 && (Math.floor(G.time * 20) % 2 === 0);
      if (!blink) {
        var pdir = p.dir;
        if (p.inv > 0 && isFinite(p.face)) { /* turn toward whatever hit you */
          var ca = Math.cos(p.face), sa = Math.sin(p.face);
          pdir = Math.abs(ca) > Math.abs(sa) ? (ca < 0 ? 'left' : 'right') : (sa < 0 ? 'up' : 'down');
        }
        Spr.drawPlayer(c, p.x, p.y, {
          dir: pdir, phase: p.phase,
          moving: p.moving, crouch: p.crouch,
          alpha: 1
        });
      }
    }

    /* objective marker: chevron orbiting the player toward the next shard (or extraction) */
    if (!p.dead) {
      var obj = null, objKind = 0, bestD = Infinity;
      for (var oi = 0; oi < L.terminals.length; oi++) {
        var ot = L.terminals[oi];
        if (ot.done) continue;
        var od = (ot.x - p.x) * (ot.x - p.x) + (ot.y - p.y) * (ot.y - p.y);
        if (od < bestD) { bestD = od; obj = ot; objKind = 0; }
      }
      if (!obj && active) { obj = L.exit; objKind = 1; }
      if (obj) {
        var oa = Math.atan2(obj.y - p.y, obj.x - p.x);
        var orr = 13 + Math.sin(G.time * 5) * 1.5;
        c.save();
        c.translate(p.x, p.y);
        c.rotate(oa);
        c.globalAlpha = objKind === 1 ? 0.95 : 0.8;
        c.fillStyle = objKind === 1 ? '#4dff88' : '#54dcff';
        c.beginPath();
        c.moveTo(orr + 4, 0);
        c.lineTo(orr - 3, -4);
        c.lineTo(orr - 3, 4);
        c.closePath();
        c.fill();
        c.restore();
      }
    }

    /* guards */
    G.guards.forEach(function (g) {
      var showGun = g.det > 0.25 || g.state === 'alert';
      Spr.drawGuard(c, g.x, g.y, {
        dir: dirName(g.face), phase: g.phase,
        moving: g.moving, gun: showGun, gunDir: dirName(g.face),
        stun: g.stunT > 0, stunT: g.stunT
      });
      if (g.state === 'alert' || (g.det > 0.05 && g.det < 1 && g.state !== 'search')) {
        var col = g.state === 'alert' ? '#ff3355' : '#ffd24d';
        var ch = g.state === 'alert' ? '!' : '?';
        if (Math.floor(G.time * 6) % 2 === 0 || g.state === 'alert') txt(ch, g.x, g.y - 14, 8, col, 'center');
      } else if (g.state === 'search') {
        if (Math.floor(G.time * 6) % 2 === 0) txt('?', g.x, g.y - 14, 8, '#ffd24d', 'center');
      }
    });

    /* drones */
    G.drones.forEach(function (d) {
      Spr.drawDrone(c, d.x, d.y, { t: d.t, flash: d.flash > 0, underlight: d.state === 'alert' || d.stunT > 0 });
      if (d.det > 0.05 && d.stunT <= 0) {
        var dc = d.state === 'alert' ? '#ff3355' : '#ffd24d';
        var ch = d.state === 'alert' ? '!' : '?';
        if (Math.floor(G.time * 6) % 2 === 0 || d.state === 'alert') txt(ch, d.x, d.y - 13, 7, dc, 'center');
      }
    });

    /* bullets */
    G.bullets.forEach(function (b) {
      var a = Math.atan2(b.vy, b.vx);
      c.strokeStyle = '#ff4466';
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(b.x - Math.cos(a) * 4, b.y - Math.sin(a) * 4);
      c.lineTo(b.x + Math.cos(a) * 4, b.y + Math.sin(a) * 4);
      c.stroke();
      c.strokeStyle = '#ffdde5';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(b.x - Math.cos(a) * 3, b.y - Math.sin(a) * 3);
      c.lineTo(b.x + Math.cos(a) * 3, b.y + Math.sin(a) * 3);
      c.stroke();
    });

    /* particles */
    c.globalCompositeOperation = 'lighter';
    G.particles.forEach(function (pa) {
      var a = Math.max(0, pa.life / pa.max);
      if (pa.ring) {
        var rr = pa.size * (1 - a) + 6;
        c.strokeStyle = 'rgba(' + pa.color + ',' + a * 0.8 + ')';
        c.lineWidth = 2.5;
        c.beginPath(); c.arc(pa.x, pa.y, rr, 0, 6.283); c.stroke();
      } else {
        c.fillStyle = 'rgba(' + pa.color + ',' + a + ')';
        c.fillRect(pa.x - pa.size / 2, pa.y - pa.size / 2, pa.size, pa.size);
      }
    });
    c.globalCompositeOperation = 'source-over';

    /* floats */
    G.floats.forEach(function (f) {
      txt(f.txt, f.x, f.y, 7, 'rgb(' + f.rgb + ')', 'center', Math.min(1, f.life));
    });

    c.restore();
    post(1);
    /* HUD renders after post-fx so scanlines/vignette never dim the UI */
    G.renderHUD(active);
  };

  function dirName(a) {
    if (a === undefined || a === null) return 'down';
    var d = NB.angleDiff(0, a);
    if (d > 1.17 && d < 2 * 3.1416 - 1.17) return 'right';
    if (d < -1.17 || d > 1.17 + 3.1416) return 'left';
    return d >= 0 ? 'down' : 'up';
  }
  G.dirName = dirName;

  G.renderHUD = function (exitActive) {
    var c = G.ctx;
    if (!G.player) return;
    var p = G.player;
    /* top-left: hp + level */
    c.fillStyle = 'rgba(4,8,16,0.72)';
    c.fillRect(6, 6, 118, 30);
    c.strokeStyle = '#123a5c';
    c.strokeRect(6.5, 6.5, 117, 29);
    for (var i = 0; i < 6; i++) {
      c.fillStyle = i < p.hp ? '#ff3355' : 'rgba(255,51,85,0.15)';
      c.fillRect(10 + i * 10, 10, 8, 8);
    }
    var L = G.level;
    txt('SECTOR 0' + L.id + ' ' + L.name, 10, 22, 7, '#7fd4ff');
    if (G.hpWarn && Math.floor(G.time * 3) % 2 === 0)
      txt('INTEGRITY LOW', 10, 38, 6, '#ff3355');

    /* top-center: timer */
    txt(NB.fmtTime(G.time), VW / 2, 8, 9, G.alert > 0.4 ? '#ff6680' : '#cfe8ff', 'center');

    /* top-right: data */
    c.fillStyle = 'rgba(4,8,16,0.72)';
    c.fillRect(VW - 116, 6, 110, 30);
    c.strokeStyle = '#123a5c';
    c.strokeRect(VW - 115.5, 6.5, 109, 29);
    for (var d2 = 0; d2 < 3; d2++) {
      var x = VW - 96 + d2 * 20, y = 14;
      var on = d2 < G.dataCount;
      c.save();
      c.translate(x, y + 4);
      c.rotate(Math.PI / 4);
      c.fillStyle = on ? '#ffb020' : 'rgba(255,176,32,0.14)';
      if (on) { c.shadowColor = '#ffb020'; c.shadowBlur = 6; }
      c.fillRect(-4, -4, 8, 8);
      c.restore();
    }
    txt('DATA', VW - 96, 24, 7, G.dataCount >= 3 ? '#ffd24d' : '#5a7a99', 'left');
    txt(String(G.dataCount) + '/3', VW - 20, 24, 8, G.dataCount >= 3 ? '#4dff88' : '#ffd24d', 'right');

    /* minimap - below the data panel, 1px per tile */
    var Lm = G.level;
    var allData = G.dataCount >= Lm.terminals.length;
    if (G.minimap) {
      var mx = VW - 68, my = 40, mo = 2;
      c.fillStyle = 'rgba(3,6,14,0.82)';
      c.fillRect(mx, my, 64, 40);
      c.strokeStyle = '#14395c';
      c.strokeRect(mx + 0.5, my + 0.5, 63, 39);
      c.globalAlpha = 0.95;
      c.drawImage(G.minimap, mx + mo, my + mo);
      c.globalAlpha = 1;
      for (var mi = 0; mi < Lm.terminals.length; mi++) {
        var mt = Lm.terminals[mi];
        c.fillStyle = mt.done ? '#4dff88' : '#ffb020';
        c.fillRect(mx + mo + mt.tx + 0.3, my + mo + mt.ty + 0.3, 1.4, 1.4);
      }
      c.fillStyle = allData ? '#4dff88' : '#42506e';
      c.fillRect(mx + mo + Math.floor(Lm.exit.x / 16) + 0.2, my + mo + Math.floor(Lm.exit.y / 16) + 0.2, 1.6, 1.6);
      G.guards.forEach(function (g) {
        c.fillStyle = g.state === 'alert' ? '#ff3355' : '#8e2a44';
        c.fillRect(mx + mo + g.x / 16, my + mo + g.y / 16, 1, 1);
      });
      G.drones.forEach(function (d) {
        c.fillStyle = d.state === 'alert' ? '#ff5577' : '#5e5599';
        c.fillRect(mx + mo + d.x / 16, my + mo + d.y / 16, 1, 1);
      });
      c.fillStyle = '#7ff7ff';
      c.fillRect(mx + mo + p.x / 16 - 0.6, my + mo + p.y / 16 - 0.6, 2.2, 2.2);
    }

    /* reinforcement warning banner */
    if (G.reinfWarnT > 0) {
      var wa = Math.min(1, G.reinfWarnT / 0.4) * (0.55 + 0.45 * Math.sin(G.time * 12));
      txt('!! REINFORCEMENTS INBOUND !!', VW / 2, 44, 7, 'rgba(255,64,92,' + wa.toFixed(2) + ')', 'center');
    }

    /* bottom-left: abilities */
    c.fillStyle = 'rgba(4,8,16,0.72)';
    c.fillRect(6, VH - 22, 118, 16);
    /* dash pips */
    for (var d3 = 0; d3 < 4; d3++) {
      var ready = p.dashCd <= 0;
      c.fillStyle = ready ? '#4dc8ff' : 'rgba(77,200,255,0.18)';
      c.fillRect(10 + d3 * 8, VH - 18, 6, 8);
    }
    txt('DASH', 46, VH - 16, 6, ready ? '#7fd4ff' : '#44607a', 'left');
    /* emp */
    var ew = 26 * (1 - p.empCd / 12);
    c.fillStyle = 'rgba(122,200,255,0.2)';
    c.fillRect(76, VH - 18, 26, 8);
    c.fillStyle = p.empCd <= 0 ? '#7ac8ff' : '#3d6a8a';
    c.fillRect(76, VH - 18, ew, 8);
    txt('EMP', 76, VH - 24, 6, p.empCd <= 0 ? '#aee2ff' : '#44607a', 'left');
    if (NB.Audio.muted) txt('AUDIO MUTED [M]', VW - 8, VH - 15, 6, '#ff8a7a', 'right');

    /* detection bar */
    var bw = 150;
    var bx = VW / 2 - bw / 2;
    txt('DETECTION', VW / 2, 24, 6, G.alert > 0.6 ? '#ff6680' : '#5a7a99', 'center');
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.fillRect(bx, 33, bw, 5);
    var gv = c.createLinearGradient(bx, 0, bx + bw, 0);
    gv.addColorStop(0, '#ffb020');
    gv.addColorStop(1, '#ff2244');
    c.fillStyle = gv;
    c.fillRect(bx, 33, bw * G.alert, 5);
    c.strokeStyle = '#123a5c';
    c.strokeRect(bx + 0.5, 33.5, bw - 1, 4);

    /* hints - contextual, proximity-driven */
    if (G.state === 'play') {
      var hint = null, nearTerm = null, nTd = 16;
      var L2 = G.level;
      if (!p.dead) for (var hi = 0; hi < L2.terminals.length; hi++) {
        var ht = L2.terminals[hi];
        if (ht.done) continue;
        var hd = NB.dist(p.x, p.y, ht.x, ht.y);
        if (hd < nTd) { nTd = hd; nearTerm = ht; }
      }
      var nearExit = !p.dead && NB.dist(p.x, p.y, L2.exit.x, L2.exit.y) < 22;
      var allNow = G.dataCount >= L2.terminals.length;
      if (p.hacking) hint = 'EXTRACTING DATA...';
      else if (nearExit && allNow) hint = 'HOLD [E] TO ESCAPE';
      else if (nearTerm) hint = 'HOLD [E] EXTRACT SHARD';
      else if (nearExit) hint = 'EXTRACTION LOCKED - ' + G.dataCount + '/3 SHARDS';
      else if (allNow) hint = 'REACH EXTRACTION - HOLD [E] ON EXIT PAD';
      else if (G.hintT > 0) hint = 'HOLD [E] EXTRACT DATA   [SHIFT] DASH   [SPACE] EMP   [C] CROUCH';
      if (hint) txt(hint, VW / 2, VH - 14, 7, hint.indexOf('LOCKED') >= 0 ? '#ff7a8a' : '#9fd8ff', 'center', 0.75 + 0.25 * Math.sin(G.time * 5));
    }
  };

  /* ---------- overlays / screens ---------- */
  function panel(w, h, title, titleCol) {
    var c = G.ctx;
    c.fillStyle = 'rgba(3,6,14,0.86)';
    c.fillRect(VW / 2 - w / 2, VH / 2 - h / 2, w, h);
    c.strokeStyle = titleCol || '#1e5a8a';
    c.lineWidth = 1.5;
    c.strokeRect(VW / 2 - w / 2, VH / 2 - h / 2, w, h);
    c.strokeStyle = 'rgba(90,200,255,0.25)';
    c.lineWidth = 0.5;
    c.strokeRect(VW / 2 - w / 2 + 3, VH / 2 - h / 2 + 3, w - 6, h - 6);
  }

  G.renderOverlay = function () {
    var c = G.ctx;
    if (G.state === 'intro') {
      c.fillStyle = 'rgba(2,4,10,' + Math.min(0.75, G.stateT * 1.5) + ')';
      c.fillRect(0, 0, VW, VH);
      var L = G.level;
      txt('SECTOR 0' + L.id, VW / 2, VH / 2 - 34, 9, '#4dc8ff', 'center');
      txt(L.name, VW / 2, VH / 2 - 22, 18, '#e8fbff', 'center');
      txt('OBJECTIVE: EXTRACT 3 DATA SHARDS - REACH EXTRACTION', VW / 2, VH / 2 + 8, 8, '#9fd8ff', 'center');
      var TIPS = [
        'SNEAK PAST SENTRY CONES - HOLD [E] AT TERMINALS',
        'LASERS CYCLE - TIME YOUR RUNS - DOORS OPEN WHEN NEAR',
        'HEAVIEST SECTOR - EMP STUNS - WATCH THE CEILING'
      ];
      txt(TIPS[Math.min(2, G.levelIndex)] || '', VW / 2, VH / 2 + 22, 7, '#5a86a8', 'center');
      txt('PAR ' + NB.fmtTime(L.par) + ' FOR TIME BONUS', VW / 2, VH / 2 + 36, 7, '#4fd7b0', 'center');
    } else if (G.state === 'clear') {
      /* scanline wipe into the next sector in the final 0.6s */
      var wp = G.wipeT || 0;
      if (wp > 0 && wp < 1) {
        c.fillStyle = 'rgba(140,230,255,' + (0.16 * (1 - wp)).toFixed(3) + ')';
        c.fillRect(0, 0, VW, wp * VH);
        c.fillStyle = 'rgba(190,245,255,' + (0.7 * (1 - wp)).toFixed(3) + ')';
        c.fillRect(0, wp * VH - 1, VW, 3);
      }
      panel(300, 132, '#1e7a5a');
      var st = G.runStats[G.runStats.length - 1];
      txt('SECTOR CLEARED', VW / 2, VH / 2 - 50, 14, '#4dff88', 'center');
      txt('TIME   ' + NB.fmtTime(st.time), VW / 2 - 115, VH / 2 - 26, 8, '#cfe8ff');
      txt('STEALTH  +' + st.stealth, VW / 2 - 115, VH / 2 - 12, 8, st.stealth ? '#4dff88' : '#41586f');
      txt('UNTOUCHED  +' + st.nodmg, VW / 2 - 115, VH / 2 + 2, 8, st.nodmg ? '#4dff88' : '#41586f');
      txt('TIME BONUS  +' + st.timeB, VW / 2 - 115, VH / 2 + 16, 8, '#cfe8ff');
      txt('TOTAL  ' + G.totalScore, VW / 2 - 115, VH / 2 + 34, 9, '#ffd24d');
      if (Math.floor(G.titleT * 2) % 2 === 0)
        txt('PRESS ENTER - NEXT SECTOR', VW / 2, VH / 2 + 52, 8, '#7fd4ff', 'center');
    } else if (G.state === 'gameover') {
      c.fillStyle = 'rgba(20,0,8,0.66)';
      c.fillRect(0, 0, VW, VH);
      var jx = (Math.random() - 0.5) * 4;
      txt('SIGNAL LOST', VW / 2 + jx, VH / 2 - 40, 22, '#ff3355', 'center');
      txt('THE FACILITY DELETED YOUR TRACE', VW / 2, VH / 2 - 12, 8, '#c98a99', 'center');
      txt('SECTOR 0' + G.level.id + ' - DATA ' + G.dataCount + '/3', VW / 2, VH / 2 + 4, 8, '#9fd8ff', 'center');
      txt('RUN SCORE  ' + G.totalScore, VW / 2, VH / 2 + 16, 8, '#ffd24d', 'center');
      if (Math.floor(G.titleT * 2) % 2 === 0)
        txt('[ENTER] RETRY SECTOR    [Q] TITLE', VW / 2, VH / 2 + 30, 8, '#7fd4ff', 'center');
    } else if (G.state === 'victory') {
      panel(320, 170, '#1e7a8a');
      txt('EXTRACTION COMPLETE', VW / 2, VH / 2 - 66, 15, '#4dff88', 'center');
      var rank = G.rankFor(G.totalScore);
      var rc = rank === 'S' ? '#ffd24d' : rank === 'A' ? '#4dff88' : rank === 'B' ? '#4dc8ff' : '#9fd8ff';
      c.save();
      c.shadowColor = rc; c.shadowBlur = 12;
      txt(rank, VW / 2, VH / 2 - 40, 34, rc, 'center');
      c.restore();
      G.runStats.forEach(function (s, i) {
        txt('0' + s.id + ' ' + s.name + '   ' + NB.fmtTime(s.time) + '   ' + s.score, VW / 2 - 120, VH / 2 + 2 + i * 13, 8, '#cfe8ff');
      });
      txt('TOTAL SCORE  ' + G.totalScore, VW / 2 - 120, VH / 2 + 46, 9, '#ffd24d');
      if (G.newBest && Math.floor(G.titleT * 3) % 2 === 0)
        txt('NEW FACILITY RECORD', VW / 2 - 120, VH / 2 + 58, 8, '#ffd24d');
      if (Math.floor(G.titleT * 2) % 2 === 0)
        txt('[ENTER] RETURN TO TITLE', VW / 2, VH / 2 + 66, 8, '#7fd4ff', 'center');
    } else if (G.state === 'play' && G.paused) {
      c.fillStyle = 'rgba(2,4,10,0.8)';
      c.fillRect(0, 0, VW, VH);
      txt('PAUSED', VW / 2, VH / 2 - 44, 16, '#e8fbff', 'center');
      txt('SECTOR 0' + G.level.id + '   T+' + NB.fmtTime(G.time) + '   SCORE ' + G.totalScore, VW / 2, VH / 2 - 27, 8, '#7fb8d8', 'center');
      txt('WASD / ARROWS  MOVE      [C] CROUCH', VW / 2, VH / 2 - 14, 8, '#9fd8ff', 'center');
      txt('[SHIFT] DASH - I-FRAMES  [SPACE] EMP - STUNS GUARDS', VW / 2, VH / 2, 8, '#9fd8ff', 'center');
      txt('HOLD [E] AT TERMINAL - EXTRACT DATA', VW / 2, VH / 2 + 14, 8, '#9fd8ff', 'center');
      txt('[ENTER] RESUME   [R] RETRY SECTOR   [Q] TITLE   [M] MUTE', VW / 2, VH / 2 + 32, 8, '#5a86a8', 'center');
    }
  };

  function renderTitle() {
    var c = G.ctx;
    var t = G.titleT;
    c.fillStyle = '#02030a';
    c.fillRect(0, 0, VW, VH);
    /* drifting facility backdrop */
    var px = (t * 12) % 48, py = (t * 7) % 48;
    c.globalAlpha = 0.5;
    for (var gx = -px; gx < VW + 16; gx += 48)
      for (var gy = -py; gy < VH + 16; gy += 48) {
        c.fillStyle = '#0a1424';
        c.fillRect(gx, gy, 46, 46);
        c.fillStyle = '#0e1a2e';
        c.fillRect(gx + 2, gy + 2, 42, 42);
      }
    c.globalAlpha = 1;
    /* sweeping fake cones */
    for (var i = 0; i < 3; i++) {
      var cx2 = 90 + i * 150 + Math.sin(t * 0.7 + i * 2) * 30;
      var cy2 = 70 + i * 60;
      var fa = t * (0.8 + i * 0.2) + i * 2;
      Spr.drawCone(c, cx2, cy2, fa, 0.55, 110, '255,47,160', 0.10, null);
      c.fillStyle = '#221122';
      c.beginPath(); c.arc(cx2, cy2, 5, 0, 6.283); c.fill();
    }
    /* floating data diamonds */
    for (var d = 0; d < 5; d++) {
      var fx = (d * 97 + t * (14 + d * 4)) % (VW + 40) - 20;
      var fy = 40 + d * 46 + Math.sin(t + d) * 6;
      c.save();
      c.translate(VW - fx, fy);
      c.rotate(t * 0.8 + d);
      c.fillStyle = 'rgba(255,176,32,0.5)';
      c.fillRect(-3, -3, 6, 6);
      c.restore();
    }
    /* glitch slice */
    if (Math.sin(t * 1.7) > 0.96) {
      c.fillStyle = 'rgba(90,200,255,0.08)';
      c.fillRect(0, 90 + Math.sin(t * 30) * 40, VW, 6);
    }
    /* title */
    c.save();
    c.shadowColor = '#4dc8ff';
    c.shadowBlur = 16;
    txt('NEON BREACH', VW / 2, 64, 34, '#bdf3ff', 'center');
    c.restore();
    txt('NEON BREACH', VW / 2, 64, 34, '#ff2fa8', 'center', 0.25);
    txt('INFILTRATE // EXTRACT // ESCAPE', VW / 2, 106, 9, '#ff2fa8', 'center');
    if (Math.floor(t * 2) % 2 === 0)
      txt('PRESS ENTER TO JACK IN', VW / 2, 140, 10, '#e8fbff', 'center');
    txt('[WASD] MOVE   [C] CROUCH   [SHIFT] DASH   [SPACE] EMP   [E] EXTRACT/EXIT', VW / 2, 176, 8, '#5f9dc4', 'center');
    txt('AVOID SENTRY CONES - STEAL 3 DATA SHARDS - ESCAPE', VW / 2, 192, 8, '#5f9dc4', 'center');
    if (G.bestInfo) txt('FACILITY RECORD   ' + G.bestInfo.score + '   [' + G.bestInfo.rank + ']', VW / 2, 214, 8, '#ffd24d', 'center');
    txt('NEON BREACH v1.0   //   AUDIO ' + (NB.Audio.muted ? 'MUTED ' : 'ON ') + '[M]', VW / 2, 250, 7, NB.Audio.muted ? '#b3453f' : '#31506e', 'center');
  }

  function post(worldAlpha) {
    var c = G.ctx;
    /* scanlines */
    c.fillStyle = 'rgba(0,0,0,0.16)';
    for (var y = 0; y < VH; y += 2) c.fillRect(0, y, VW, 1);
    /* vignette */
    if (G.vig) c.drawImage(G.vig, 0, 0);
    /* red danger edge */
    if (worldAlpha && G.alert > 0.3) {
      c.globalAlpha = Math.min(0.7, (G.alert - 0.3) * 1.1) * (0.7 + 0.3 * Math.sin(G.time * 8));
      if (G.redEdge) c.drawImage(G.redEdge, 0, 0);
      c.globalAlpha = 1;
    }
    /* low-integrity pulse (hp <= 2) */
    if (worldAlpha && G.hpWarn) {
      c.globalAlpha = 0.14 + 0.12 * (0.5 + 0.5 * Math.sin(G.time * 6));
      if (G.redEdge) c.drawImage(G.redEdge, 0, 0);
      c.globalAlpha = 1;
    }
    /* damage / event flash */
    if (G.flash > 0) {
      c.fillStyle = 'rgba(' + G.flashRGB + ',' + G.flash * 0.4 + ')';
      c.fillRect(0, 0, VW, VH);
    }
  }

  /* main frame: simulate (fixed step) then render */
  G.frame = function (dtMs) {
    var dt = Math.min(0.1, dtMs / 1000);
    if (!G.testMode) {
      G.acc = (G.acc || 0) + dt;
      var STEP = 1 / 60;
      while (G.acc >= STEP) {
        G.simulate(STEP);
        G.acc -= STEP;
      }
    }
    G.render();
    G.renderOverlay();
    NB.Music.tick(G.state === 'play' && !G.paused ? G.alert : 0);
  };
})();
