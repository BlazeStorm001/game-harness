/* NEON BREACH - procedural pixel-art rendering */
(function () {
  'use strict';
  var NB = window.NB;
  var T = NB.TILE = 16;

  var PAL = {
    player: {
      outline: '#041018', dark: '#0a3040', body: '#0e5f7d', light: '#199fc4',
      hood: '#0d7292', visor: '#8ffbff', glow: 'rgba(90,240,255,'
    },
    guard: {
      outline: '#140309', dark: '#4d0c26', body: '#93113f', light: '#d31f63',
      hood: '#b0164c', visor: '#ffe3f2', glow: 'rgba(255,60,150,'
    },
    drone: {
      outline: '#0d0618', dark: '#1c1030', body: '#2c1a4e', light: '#4a2d78',
      rotor: '#9aa4c8', eye: '#ff3355'
    }
  };
  NB.PAL = PAL;

  function r(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w, h); }

  /* generic humanoid, 16px tall, centered at (x,y) = body center */
  function drawChar(ctx, x, y, o) {
    var p = o.pal;
    var dir = o.dir || 'down';
    var ph = o.phase || 0;
    var walk = o.moving ? Math.sin(ph) * 2.2 : 0;
    var crouch = o.crouch;
    var ox = Math.round(x), oy = Math.round(y);
    var legLiftL = Math.max(0, Math.round(walk));
    var legLiftR = Math.max(0, Math.round(-walk));
    var bodyDrop = crouch ? 2 : 0;

    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;

    /* legs */
    if (!crouch) {
      r(ctx, ox - 4, oy + 3 - 0, 3, 5 - legLiftL, p.dark);
      r(ctx, ox + 1, oy + 3, 3, 5 - legLiftR, p.dark);
      r(ctx, ox - 4, oy + 7 - legLiftL, 3, 1, p.outline);
      r(ctx, ox + 1, oy + 7 - legLiftR, 3, 1, p.outline);
      /* boots */
      r(ctx, ox - 4, oy + 6 - legLiftL, 3, 1, p.body);
      r(ctx, ox + 1, oy + 6 - legLiftR, 3, 1, p.body);
    } else {
      r(ctx, ox - 4, oy + 4, 3, 3, p.dark);
      r(ctx, ox + 1, oy + 4, 3, 3, p.dark);
    }

    /* arms */
    var ay = oy - 1 + bodyDrop;
    r(ctx, ox - 7, ay, 2, 5, p.dark);
    r(ctx, ox + 5, ay, 2, 5, p.dark);

    /* torso */
    var ty = oy - 2 + bodyDrop;
    r(ctx, ox - 5, ty, 10, 7, p.outline);
    r(ctx, ox - 4, ty + 1, 8, 5, p.body);
    r(ctx, ox - 4, ty + 1, 8, 2, p.light);
    if (crouch) r(ctx, ox - 4, ty + 5, 8, 1, p.dark);

    /* head */
    var hy = oy - 8 + bodyDrop;
    r(ctx, ox - 4, hy, 8, 6, p.outline);
    r(ctx, ox - 3, hy + 1, 6, 4, p.hood);
    r(ctx, ox - 3, hy + 1, 6, 1, p.light);
    /* visor by direction */
    if (dir === 'down') {
      r(ctx, ox - 3, hy + 2, 6, 2, p.visor);
      r(ctx, ox - 2, hy + 2, 2, 1, '#ffffff');
    } else if (dir === 'left') {
      r(ctx, ox - 4, hy + 2, 3, 2, p.visor);
    } else if (dir === 'right') {
      r(ctx, ox + 1, hy + 2, 3, 2, p.visor);
    }
    /* up: back of head, small neck seam */
    if (dir === 'up') r(ctx, ox - 1, hy + 3, 2, 2, p.dark);

    /* gun */
    if (o.gun) {
      var g = o.gunDir || dir;
      if (g === 'down') { r(ctx, ox + 3, oy + 1 + bodyDrop, 2, 5, '#2a2f3f'); r(ctx, ox + 3, oy + 5 + bodyDrop, 2, 1, '#ff4d6d'); }
      else if (g === 'up') { r(ctx, ox - 5, oy - 2 + bodyDrop, 2, 5, '#2a2f3f'); r(ctx, ox - 5, oy - 3 + bodyDrop, 2, 1, '#ff4d6d'); }
      else if (g === 'left') { r(ctx, ox - 9, oy + 1 + bodyDrop, 5, 2, '#2a2f3f'); r(ctx, ox - 9, oy + 1 + bodyDrop, 1, 2, '#ff4d6d'); }
      else { r(ctx, ox + 4, oy + 1 + bodyDrop, 5, 2, '#2a2f3f'); r(ctx, ox + 8, oy + 1 + bodyDrop, 1, 2, '#ff4d6d'); }
    }

    /* stun flicker */
    if (o.stun) {
      r(ctx, ox - 5, hy, 10, 7, 'rgba(255,255,255,' + (0.25 + 0.2 * Math.sin(o.stunT * 30)) + ')');
    }
    ctx.globalAlpha = 1;
  }
  NB.Sprites = NB.Sprites || {};
  NB.Sprites.drawPlayer = function (ctx, x, y, o) {
    o = o || {};
    o.pal = PAL.player;
    drawChar(ctx, x, y, o);
  };
  NB.Sprites.drawGuard = function (ctx, x, y, o) {
    o = o || {};
    o.pal = PAL.guard;
    drawChar(ctx, x, y, o);
  };
  NB.Sprites.drawDrone = function (ctx, x, y, o) {
    o = o || {};
    var p = PAL.drone;
    var t = o.t || 0;
    var bob = Math.sin(t * 3) * 1.5;
    var ox = Math.round(x), oy = Math.round(y + bob);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    /* rotors */
    var spin = Math.floor(t * 14) % 2 === 0;
    var rw = spin ? 4 : 2, rh = spin ? 2 : 1;
    [[-6, -4], [6, -4], [-6, 4], [6, 4]].forEach(function (q) {
      r(ctx, ox + q[0] - (rw / 2), oy + q[1] - 1, rw, 1, p.rotor);
    });
    /* arms */
    r(ctx, ox - 6, oy - 2, 3, 1, p.dark); r(ctx, ox + 3, oy - 2, 3, 1, p.dark);
    r(ctx, ox - 6, oy + 1, 3, 1, p.dark); r(ctx, ox + 3, oy + 1, 3, 1, p.dark);
    /* body */
    r(ctx, ox - 4, oy - 3, 8, 7, p.outline);
    r(ctx, ox - 3, oy - 2, 6, 5, p.body);
    r(ctx, ox - 3, oy - 2, 6, 2, p.light);
    /* dome */
    r(ctx, ox - 2, oy - 4, 4, 2, p.outline);
    r(ctx, ox - 1, oy - 3, 2, 1, p.light);
    /* eye */
    var flash = o.flash || 0;
    r(ctx, ox - 1, oy, 2, 2, flash ? '#ffffff' : p.eye);
    if (o.underlight) {
      NB.Glow.circle(ctx, ox, oy + 6, 10, 'rgba(255,50,80,0.20)');
    }
    ctx.globalAlpha = 1;
  };

  NB.Glow = {
    circle: function (ctx, x, y, r, color) {
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      var old = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.globalCompositeOperation = old;
    }
  };

  /* vision cone */
  NB.Sprites.drawCone = function (ctx, x, y, angle, half, range, rgb, alpha, dashTo) {
    ctx.save();
    var g = ctx.createRadialGradient(x, y, 4, x, y, range);
    g.addColorStop(0, 'rgba(' + rgb + ',' + (alpha * 0.55) + ')');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, range, angle - half, angle + half);
    ctx.closePath();
    ctx.fill();
    if (dashTo) {
      ctx.strokeStyle = 'rgba(' + rgb + ',0.85)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(dashTo.x, dashTo.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  };

  /* ---------- 1px-per-tile minimap (pre-rendered per level) ---------- */
  NB.Sprites.buildMinimap = function (L) {
    var c = document.createElement('canvas');
    c.width = L.w; c.height = L.h;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#04070f';
    ctx.fillRect(0, 0, L.w, L.h);
    for (var y = 0; y < L.h; y++) for (var x = 0; x < L.w; x++) {
      var t = L.grid[y][x];
      if (t === 1) ctx.fillStyle = '#26314f';
      else if (t === 2) ctx.fillStyle = '#3d4a72';
      else ctx.fillStyle = '#0f1a31';
      ctx.fillRect(x, y, 1, 1);
    }
    return c;
  };

  /* ---------- static level layer ---------- */
  function hash2(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + s * 974634) | 0;
    h = (h ^ (h >> 13)) * 1274126177 | 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  }

  NB.Sprites.buildStatic = function (L) {
    var c = document.createElement('canvas');
    c.width = L.w * T; c.height = L.h * T;
    var ctx = c.getContext('2d');
    var i, j;
    /* void */
    ctx.fillStyle = '#03040a';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = 'rgba(50,70,140,0.05)';
    ctx.lineWidth = 1;
    for (i = 0; i <= c.width; i += 32) { ctx.beginPath(); ctx.moveTo(i + 0.5, 0); ctx.lineTo(i + 0.5, c.height); ctx.stroke(); }
    for (j = 0; j <= c.height; j += 32) { ctx.beginPath(); ctx.moveTo(0, j + 0.5); ctx.lineTo(c.width, j + 0.5); ctx.stroke(); }

    var inb = function (x, y) { return x >= 0 && y >= 0 && x < L.w && y < L.h; };
    var FLOOR_SHADES = ['#0a0e1c', '#0b101f', '#090d1a'];

    /* floor */
    for (j = 0; j < L.h; j++) for (i = 0; i < L.w; i++) {
      var t = L.grid[j][i];
      if (t === 1 || t === 2) continue;
      var px = i * T, py = j * T;
      var hsh = hash2(i, j, 7);
      ctx.fillStyle = FLOOR_SHADES[Math.min(2, hsh * 3 | 0)];
      ctx.fillRect(px, py, T, T);
      ctx.strokeStyle = 'rgba(30,42,80,0.55)';
      ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
      /* subtle tile inner detail */
      if (hsh > 0.86) { ctx.fillStyle = 'rgba(18,26,52,0.6)'; ctx.fillRect(px + 3, py + 3, T - 6, T - 6); }
      if (hash2(i, j, 11) > 0.93) { ctx.fillStyle = 'rgba(60,80,150,0.10)'; ctx.fillRect(px + 1, py + 1, T - 2, 2); }
    }

    /* floor decor: vents */
    for (j = 0; j < L.h; j++) for (i = 0; i < L.w; i++) {
      if (L.grid[j][i] !== 0) continue;
      var hv = hash2(i, j, 23);
      if (hv > 0.965) {
        var px = i * T, py = j * T;
        ctx.fillStyle = '#0c1120'; ctx.fillRect(px + 2, py + 3, 12, 10);
        ctx.fillStyle = '#151d38';
        for (var s = 0; s < 4; s++) ctx.fillRect(px + 3, py + 4 + s * 2, 10, 1);
      }
    }
    /* wall-hugging decor: server racks & pipes (only on floor tiles next to wall) */
    for (j = 0; j < L.h; j++) for (i = 0; i < L.w; i++) {
      if (L.grid[j][i] !== 0) continue;
      var up = inb(i, j - 1) && L.grid[j - 1][i] === 1;
      var dn = inb(i, j + 1) && L.grid[j + 1][i] === 1;
      var lf = inb(i - 1, j) && L.grid[j][i - 1] === 1;
      var rt = inb(i + 1, j) && L.grid[j][i + 1] === 1;
      var px = i * T, py = j * T;
      var hd = hash2(i, j, 31);
      if (up && !dn && hd > 0.72 && L.occupies[i][j] === 0) {
        /* console against wall */
        ctx.fillStyle = '#10162c'; ctx.fillRect(px + 1, py + 1, 14, 10);
        ctx.fillStyle = '#1a2342'; ctx.fillRect(px + 2, py + 2, 12, 8);
        ctx.fillStyle = '#2de0ff';
        if (hash2(i, j, 33) > 0.5) ctx.fillRect(px + 3, py + 4, 4, 2);
        else ctx.fillRect(px + 8, py + 3, 3, 3);
        ctx.fillStyle = '#0c1120'; ctx.fillRect(px + 1, py + 9, 14, 2);
      } else if ((lf || rt) && hd > 0.8 && L.occupies[i][j] === 0) {
        /* wall pipe run */
        ctx.fillStyle = '#141b33';
        if (lf) ctx.fillRect(px + 1, py + 5, 14, 3);
        if (rt) ctx.fillRect(px + 1, py + 5, 14, 3);
        ctx.fillStyle = '#232e55';
        if (lf) ctx.fillRect(px + 1, py + 5, 14, 1);
        if (rt) ctx.fillRect(px + 1, py + 5, 14, 1);
      }
    }

    /* crates */
    for (j = 0; j < L.h; j++) for (i = 0; i < L.w; i++) {
      if (L.grid[j][i] !== 2) continue;
      var px = i * T, py = j * T;
      ctx.fillStyle = '#0d1220'; ctx.fillRect(px + 1, py + 1, 14, 14);
      ctx.fillStyle = '#232b46'; ctx.fillRect(px + 2, py + 2, 12, 12);
      ctx.fillStyle = '#2c3654'; ctx.fillRect(px + 3, py + 3, 10, 10);
      ctx.fillStyle = '#171e36'; ctx.fillRect(px + 4, py + 7, 8, 1);
      /* corner brackets */
      ctx.fillStyle = '#ff9a2a';
      ctx.fillRect(px + 2, py + 2, 3, 1); ctx.fillRect(px + 2, py + 2, 1, 3);
      ctx.fillRect(px + 11, py + 2, 3, 1); ctx.fillRect(px + 13, py + 3, 1, 2);
      ctx.fillRect(px + 2, py + 13, 3, 1); ctx.fillRect(px + 2, py + 11, 1, 3);
      ctx.fillRect(px + 11, py + 13, 3, 1); ctx.fillRect(px + 13, py + 11, 1, 2);
    }

    /* walls */
    for (j = 0; j < L.h; j++) for (i = 0; i < L.w; i++) {
      if (L.grid[j][i] !== 1) continue;
      var px = i * T, py = j * T;
      ctx.fillStyle = '#0e1226';
      ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#141a33';
      ctx.fillRect(px + 1, py + 1, T - 2, T - 2);
      /* bevels toward open sides */
      var nw = !inb(i, j - 1) || L.grid[j - 1][i] !== 1;
      var sw = !inb(i, j + 1) || L.grid[j + 1][i] !== 1;
      var nw2 = !inb(i - 1, j) || L.grid[j][i - 1] !== 1;
      var ne2 = !inb(i + 1, j) || L.grid[j][i + 1] !== 1;
      if (nw) { ctx.fillStyle = '#2b3560'; ctx.fillRect(px, py, T, 2); ctx.fillStyle = '#4a5a95'; ctx.fillRect(px, py, T, 1); }
      if (sw) { ctx.fillStyle = '#060812'; ctx.fillRect(px, py + T - 2, T, 2); }
      if (nw2) { ctx.fillStyle = '#1a2140'; ctx.fillRect(px, py, 2, T); }
      if (ne2) { ctx.fillStyle = '#060812'; ctx.fillRect(px + T - 2, py, 2, T); }
      /* panel details */
      var hp = hash2(i, j, 41);
      if (hp > 0.6) {
        ctx.fillStyle = '#1c2547';
        ctx.fillRect(px + 4, py + 5, 8, 6);
        ctx.fillStyle = '#2a3560';
        ctx.fillRect(px + 5, py + 6, 6, 4);
      }
      /* rivets */
      ctx.fillStyle = '#232c52';
      ctx.fillRect(px + 2, py + 2, 1, 1); ctx.fillRect(px + T - 3, py + 2, 1, 1);
      ctx.fillRect(px + 2, py + T - 3, 1, 1); ctx.fillRect(px + T - 3, py + T - 3, 1, 1);
    }

    /* door frames */
    L.doors.forEach(function (d) {
      var px = d.x * T, py = d.y * T;
      ctx.fillStyle = '#181f3a';
      ctx.fillRect(px - 1, py - 1, T + 2, T + 2);
      ctx.fillStyle = '#2c3a63';
      ctx.fillRect(px - 1, py - 1, T + 2, 2);
      ctx.fillRect(px - 1, py - 1, 2, T + 2);
      ctx.fillRect(px + T - 1, py - 1, 2, T + 2);
      ctx.fillStyle = '#0a0e1e';
      ctx.fillRect(px, py, T, T);
    });

    /* laser emitters (l.ax/l.ay are pixel coords -> snap to the enclosing tile) */
    L.lasers.forEach(function (l) {
      [[l.ax, l.ay], [l.bx, l.by]].forEach(function (q) {
        var px = Math.round((q[0] - 8) / T) * T + 4, py = Math.round((q[1] - 8) / T) * T + 4;
        ctx.fillStyle = '#10142a'; ctx.fillRect(px - 1, py - 1, 10, 10);
        ctx.fillStyle = '#1d2440'; ctx.fillRect(px, py, 8, 8);
        ctx.fillStyle = '#ff2038'; ctx.fillRect(px + 2, py + 2, 4, 4);
      });
    });

    /* terminal racks (tx/ty are the rack's tile; t.x/t.y are the pixel centre) */
    L.terminals.forEach(function (t) {
      var px = t.tx * T, py = t.ty * T;
      var f = t.face; /* 'up' means rack sits with screen facing down (toward floor below) */
      ctx.fillStyle = '#0d1220';
      ctx.fillRect(px + 1, py + 1, 14, 14);
      ctx.fillStyle = '#1a2140';
      ctx.fillRect(px + 2, py + 2, 12, 12);
      /* rack body with screen on floor-facing side */
      ctx.fillStyle = '#252e52';
      if (f === 'down') ctx.fillRect(px + 3, py + 3, 10, 8);
      if (f === 'up') ctx.fillRect(px + 3, py + 5, 10, 8);
      if (f === 'left') ctx.fillRect(px + 5, py + 3, 8, 10);
      if (f === 'right') ctx.fillRect(px + 3, py + 3, 8, 10);
    });

    /* exit pad (e.x/e.y are the pixel centre; draw the tile it occupies) */
    var e = L.exit;
    var etx = (e.tx !== undefined) ? e.tx : Math.round((e.x - 8) / T);
    var ety = (e.ty !== undefined) ? e.ty : Math.round((e.y - 8) / T);
    var px = etx * T, py = ety * T;
    ctx.fillStyle = '#0a0f20';
    ctx.fillRect(px - 2, py - 2, T + 4, T + 4);
    ctx.fillStyle = '#101a33';
    ctx.fillRect(px - 1, py - 1, T + 2, T + 2);
    ctx.fillStyle = '#060a16';
    ctx.fillRect(px, py, T, T);

    return c;
  };
})();
