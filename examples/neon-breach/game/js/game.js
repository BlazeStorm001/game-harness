/* NEON BREACH - simulation: entities, AI, state machine */
(function () {
  'use strict';
  var NB = window.NB;
  var T = 16, STEP = 1 / 60;
  var G = NB.Game = {};
  G.W = 480; G.H = 270;
  var CONE_HALF = 0.62, CONE_RANGE = 118;
  var PLAYER_R = 5;

  G.init = function (canvas) {
    G.cv = canvas;
    G.ctx = canvas.getContext('2d');
    G.ctx.imageSmoothingEnabled = false;
    NB.Input.init();
    G.bestInfo = NB.Store.load();
    G.titleStatic = NB.Sprites.buildStatic(NB.Levels.parseLevel(NB.Levels.LEVELS[0]));
    G.state = 'title';
    G.stateT = 0;
    G.titleT = 0;
    G.paused = false;
    G.testMode = false;
    G.seed = 12345;
    G.totalScore = 0;
    G.levelEarned = 0;
    G.runStats = [];
    G.frameCount = 0;
    G.hintT = 0;
    G.dataCount = 0; G.alert = 0; G.time = 0; G.escapeT = 0;
    G.bullets = []; G.particles = []; G.floats = [];
    G.guards = []; G.drones = []; G.level = null; G.levelIndex = 0;
    G.flash = 0; G.flashRGB = '255,255,255'; G.shake = 0;
    G.alertEver = false; G.noDamage = true; G.reinforced = false; G.reinforceT = 0;
    G.wipeT = 0; G.hpWarn = 0; G.hpBeatT = 0;
    G.interactBuf = 0;
  };

  G.reset = function (seed) {
    if (seed !== undefined) G.seed = seed | 0;
    G.totalScore = 0;
    G.runStats = [];
    G.newBest = false;
    G.bestInfo = null;
    G.startLevel(0);
    G.state = 'intro';
    G.stateT = 0;
  };

  /* rank a finished-run score */
  G.rankFor = function (s) { return s >= 8000 ? 'S' : s >= 6000 ? 'A' : s >= 4000 ? 'B' : 'C'; };

  G.startLevel = function (i) {
    var L = NB.Levels.parseLevel(NB.Levels.LEVELS[i]);
    G.levelIndex = i;
    G.level = L;
    G.lrng = NB.makeRng(G.seed + i * 7919);
    G.static = NB.Sprites.buildStatic(L);
    G.minimap = NB.Sprites.buildMinimap(L);
    G.reinfWarnT = 0; G.wipeT = 0; G.interactBuf = 0;
    /* snap camera to the clamped view target at spawn (no cross-sector pans) */
    G.camX = NB.clamp(L.spawn.x - 240, 0, L.w * 16 - 480);
    G.camY = NB.clamp(L.spawn.y - 135, 0, L.h * 16 - 270);
    var p = G.player || (G.player = {});
    p.x = L.spawn.x; p.y = L.spawn.y;
    p.hp = 6; p.dir = 'down'; p.phase = 0; p.crouch = false;
    p.dashT = 0; p.dashCd = 0; p.dashDx = 0; p.dashDy = 0;
    p.inv = 0; p.ghost = []; p.moving = false; p.face = Math.PI / 2;
    p.dead = false; p.deathT = 0; p.hacking = null; p.empCd = 0;
    G.time = 0; G.alert = 0; G.alertEver = false; G.noDamage = true;
    G.reinforced = false; G.reinforceT = 0;
    G.dataCount = 0; G.escapeT = 0;
    G.bullets = []; G.particles = []; G.floats = [];
    G.shake = 0; G.flash = 0; G.flashRGB = '255,255,255';
    G.levelEarned = 0; G.hintT = 8;
    G.lastBonus = null;
    G.guards = L.guards.map(function (g) {
      return { x: g.x, y: g.y, path: g.path, pi: 0, state: 'patrol', det: 0,
        face: G.lrng.range(0, 6.28), lkp: { x: g.x, y: g.y }, searchT: 0, noSeeT: 0,
        fireCd: 0, burst: 0, burstT: 0, stunT: 0, phase: 0, moving: false };
    });
    G.drones = L.drones.map(function (d) {
      return { x: d.x, y: d.y, path: d.path, pi: 0, state: 'patrol', det: 0,
        face: 0, t: G.lrng.range(0, 6), fireCd: 1, stunT: 0, lkp: { x: d.x, y: d.y }, noSeeT: 0, flash: 0 };
    });
  };

  G.restartLevel = function () {
    G.totalScore -= G.levelEarned || 0;
    G.startLevel(G.levelIndex);
    G.state = 'intro';
    G.stateT = 0;
    if (NB.Music.track !== 'play') NB.Music.start('play'); /* restore combat track after game over */
  };

  /* ---------- geometry ---------- */
  G.solidPx = function (px, py) {
    if (!isFinite(px) || !isFinite(py)) return true;
    var L = G.level;
    var tx = Math.floor(px / T), ty = Math.floor(py / T);
    if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) return true;
    var t = L.grid[ty][tx];
    if (t === 1 || t === 2) return true;
    if (t === 3) {
      for (var i = 0; i < L.doors.length; i++) {
        var d = L.doors[i];
        if (d.x === tx && d.y === ty) return d.open < 0.6;
      }
    }
    return false;
  };
  G.circleHits = function (x, y, r) {
    var s = 0.75 * r;
    return G.solidPx(x + s, y) || G.solidPx(x - s, y) || G.solidPx(x, y + s) || G.solidPx(x, y - s) ||
      G.solidPx(x + s * 0.7, y + s * 0.7) || G.solidPx(x - s * 0.7, y + s * 0.7) ||
      G.solidPx(x + s * 0.7, y - s * 0.7) || G.solidPx(x - s * 0.7, y - s * 0.7);
  };
  G.moveCircle = function (e, dx, dy, r) {
    var nx = e.x + dx;
    if (!G.circleHits(nx, e.y, r)) e.x = nx;
    var ny = e.y + dy;
    if (!G.circleHits(e.x, ny, r)) e.y = ny;
  };
  G.losClear = function (x1, y1, x2, y2) {
    var d = NB.dist(x1, y1, x2, y2), n = Math.max(1, Math.ceil(d / 5));
    for (var i = 1; i < n; i++) {
      var t = i / n;
      if (G.solidPx(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
    }
    return true;
  };
  G.canSee = function (e, isDrone) {
    var p = G.player;
    if (p.dead) return false;
    var d = NB.dist(e.x, e.y, p.x, p.y);
    if (d > (isDrone ? 88 : CONE_RANGE)) return false;
    if (!G.losClear(e.x, e.y, p.x, p.y)) return false;
    if (isDrone) return true;
    if (d < 26) return true;
    var ang = Math.atan2(p.y - e.y, p.x - e.x);
    return Math.abs(NB.angleDiff(e.face, ang)) < CONE_HALF;
  };
  G.closestPt = function (px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var l2 = dx * dx + dy * dy;
    var t = l2 ? NB.clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1) : 0;
    return { x: x1 + dx * t, y: y1 + dy * t };
  };
  G.ptSegDist = function (px, py, x1, y1, x2, y2) {
    var q = G.closestPt(px, py, x1, y1, x2, y2);
    return NB.dist(px, py, q.x, q.y);
  };

  G.burst = function (x, y, rgb, n, spd, size) {
    for (var i = 0; i < n; i++) {
      var a = G.lrng.range(0, 6.283), v = G.lrng.range(0.3, 1) * (spd || 60);
      G.particles.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: G.lrng.range(0.25, 0.7), max: 0.7, color: rgb, size: size || 2, drag: 0.9, ring: false });
    }
  };
  G.floatText = function (x, y, txt, rgb) {
    G.floats.push({ x: x, y: y, txt: txt, rgb: rgb, life: 1.2 });
  };

  G.damagePlayer = function (n, force, srcX, srcY) {
    var p = G.player;
    if (p.dead || (p.inv > 0 && !force)) return;
    /* (damagePlayer) source point, when given, turns the player toward it */
    p.hp -= n;
    G.noDamage = false;
    p.inv = 1.1;
    G.flash = 0.45; G.flashRGB = '255,70,90';
    G.shake = Math.max(G.shake, 7);
    if (srcX !== undefined && srcX !== null) p.face = Math.atan2(srcY - p.y, srcX - p.x);
    NB.Sfx.hit();
    G.burst(p.x, p.y, '255,70,90', 14, 90, 2);
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      p.deathT = 1.5;
      NB.Sfx.die();
      G.burst(p.x, p.y, '90,240,255', 26, 120, 3);
      G.shake = 12;
    }
  };

  /* ---------- state machine ---------- */
  G.simulate = function (dt) {
    G.frameCount++;
    var I = NB.Input;
    G.titleT += dt; /* global anim clock - advances on every screen (prompt blinks) */
    if (I.wasPressed('mute')) NB.Audio.setMuted(!NB.Audio.muted); /* works on every screen */
    switch (G.state) {
      case 'title':
        G.bestInfo = NB.Store.load();
        /* fresh run: reseed each jack-in (test mode keeps its explicit seed) */
        if (I.wasPressed('confirm')) { NB.Sfx.ui(); NB.Music.start('play'); G.reset(G.testMode ? G.seed : ((Math.random() * 0x7fffffff) | 0) + 1); }
        break;
      case 'intro':
        G.stateT += dt;
        if (G.stateT > 2.4 || I.wasPressed('confirm')) { G.state = 'play'; G.stateT = 0; }
        break;
      case 'play':
        if (G.paused) {
          NB.Music.duck(true);
          if (I.wasPressed('restart')) { G.paused = false; NB.Music.duck(false); G.restartLevel(); }
          else if (I.wasPressed('quit')) { G.paused = false; NB.Music.duck(false); G.state = 'title'; NB.Music.start('menu'); }
          else if (I.wasPressed('confirm') || I.wasPressed('pause')) { G.paused = false; NB.Music.duck(false); }
        } else if (I.wasPressed('pause')) {
          G.paused = true;
          NB.Music.duck(true);
        } else G.stepPlay(dt);
        break;
      case 'clear':
        G.stateT += dt;
        G.wipeT = NB.clamp((G.stateT - 2.6) / 0.6, 0, 1); /* scanline wipe into the next sector */
        if (G.stateT > 3.2 || I.wasPressed('confirm')) {
          G.startLevel(G.levelIndex + 1);
          G.state = 'intro';
          G.stateT = 0;
        }
        break;
      case 'gameover':
        G.stateT += dt;
        if (I.wasPressed('confirm') && G.stateT > 0.6) { NB.Sfx.ui(); G.restartLevel(); }
        if (I.wasPressed('quit')) { G.state = 'title'; NB.Music.start('menu'); }
        break;
      case 'victory':
        G.stateT += dt;
        if (I.wasPressed('confirm') && G.stateT > 1) { G.state = 'title'; NB.Music.start('menu'); }
        break;
    }
    I.clearPressed();
  };

  G.stepPlay = function (dt) {
    var I = NB.Input, L = G.level, p = G.player;
    if (G.reinfWarnT > 0) G.reinfWarnT -= dt;

    /* low-integrity warning: pulsing vignette + heartbeat */
    G.hpWarn = (!p.dead && p.hp <= 2) ? 1 : 0;
    if (G.hpWarn) {
      G.hpBeatT -= dt;
      if (G.hpBeatT <= 0) { NB.Sfx.heartbeat(); G.hpBeatT = 0.7; }
    } else { G.hpBeatT = 0; }
    G.time += dt;
    G.shake = Math.max(0, G.shake - 10 * dt);
    G.flash = Math.max(0, G.flash - 1.6 * dt);
    if (G.hintT > 0) G.hintT -= dt;

    if (p.dead) {
      p.deathT -= dt;
      if (p.deathT <= 0) { G.state = 'gameover'; G.stateT = 0; NB.Music.start('down'); }
    } else {
      stepPlayer(dt);
    }

    var maxDet = 0;
    G.guards.forEach(function (g) {
      var wasAlert = g.state === 'alert';
      updateGuard(g, dt);
      if (g.state === 'alert' && !wasAlert) {
        NB.Sfx.alert(); G.alertEver = true;
        G.burst(g.x, g.y, '255,60,80', 8, 70, 1.5);
        G.shake = Math.max(G.shake, 2);
      }
      if (g.stunT > 0) return;
      var v = (g.state === 'alert') ? 1 : g.det;
      if (v > maxDet) maxDet = v;
    });
    G.drones.forEach(function (d) {
      var wasAlert = d.state === 'alert';
      updateDrone(d, dt);
      if (d.state === 'alert' && !wasAlert) { G.burst(d.x, d.y, '255,80,120', 6, 60, 1.2); G.shake = Math.max(G.shake, 1.5); }
      if (d.stunT > 0) return;
      var v = (d.state === 'alert') ? 1 : d.det;
      if (v > maxDet) maxDet = v;
    });

    G.alert = NB.lerp(G.alert, maxDet, Math.min(1, (maxDet > G.alert ? 6 : 1.6) * dt));
    if (!G.reinforced && G.alert > 0.75) {
      G.reinforceT += dt;
      if (G.reinforceT > 3.5) {
        G.reinforced = true;
        L.reinforce.forEach(function (r) {
          G.drones.push({
            x: r.x, y: r.y,
            path: [{ x: r.x, y: r.y }, { x: r.x + 22, y: r.y }, { x: r.x, y: r.y }, { x: r.x - 22, y: r.y }],
            pi: 0, state: 'patrol', det: 0, face: 0, t: 0, fireCd: 1, stunT: 0,
            lkp: { x: r.x, y: r.y }, noSeeT: 0, flash: 0
          });
        });
        G.flash = 0.3; G.flashRGB = '255,40,60';
        G.reinfWarnT = 2.5;
        NB.Sfx.alert();
      }
    } else if (G.alert <= 0.75) {
      G.reinforceT = Math.max(0, G.reinforceT - 2 * dt);
    }

    L.lasers.forEach(function (l) {
      l.timer += dt;
      l.on = ((l.timer + l.phase * 3) % 3.0) < 1.8;
      if (l.on && !p.dead && p.inv <= 0) {
        var lp = G.closestPt(p.x, p.y, l.ax, l.ay, l.bx, l.by);
        if (NB.dist(p.x, p.y, lp.x, lp.y) < 6.5) {
          G.damagePlayer(1, false, lp.x, lp.y); /* face the beam */
          G.guards.forEach(function (g) { g.det = Math.max(g.det, 0.5); });
          NB.Sfx.laser();
        }
      }
    });

    L.doors.forEach(function (d) {
      var wasOpen = d.open;
      var near = !p.dead && NB.dist(d.x * T + 8, d.y * T + 8, p.x, p.y) < 34;
      d.open = NB.clamp(d.open + (near ? 3.2 : -2.2) * dt, 0, 1);
      if (near && wasOpen < 0.3 && d.open >= 0.3) NB.Sfx.door();
    });

    for (var bi = G.bullets.length - 1; bi >= 0; bi--) {
      var b = G.bullets[bi];
      var bpx = b.x, bpy = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.life -= dt;
      var dead = b.life <= 0 || G.solidPx(b.x, b.y);
      /* sweep test (prev->new pos) so point-blank / fast shots can't tunnel past the player */
      if (!dead && !p.dead && p.inv <= 0 &&
          (NB.dist(b.x, b.y, p.x, p.y) < 6.5 || G.ptSegDist(p.x, p.y, bpx, bpy, b.x, b.y) < 6.5)) {
        G.damagePlayer(1, false, bpx, bpy); /* face the shooter */
        dead = true;
      }
      if (dead) { G.burst(b.x, b.y, '255,80,90', 4, 50, 1.5); G.bullets.splice(bi, 1); }
    }

    for (var i = G.particles.length - 1; i >= 0; i--) {
      var pa = G.particles[i];
      pa.life -= dt;
      if (pa.life <= 0) { G.particles.splice(i, 1); continue; }
      if (!pa.ring) {
        pa.x += pa.vx * dt; pa.y += pa.vy * dt;
        var dr = Math.pow(pa.drag || 0.9, dt * 60);
        pa.vx *= dr; pa.vy *= dr;
      }
    }
    for (var f = G.floats.length - 1; f >= 0; f--) {
      G.floats[f].life -= dt;
      G.floats[f].y -= 14 * dt;
      if (G.floats[f].life <= 0) G.floats.splice(f, 1);
    }
  };

  function stepPlayer(dt) {
    var I = NB.Input, L = G.level, p = G.player;
    var dx = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0);
    var dy = (I.down('down') ? 1 : 0) - (I.down('up') ? 1 : 0);
    var len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; }
    p.crouch = I.down('crouch');

    /* brief [E] press buffer: a quick tap can START a channel; holding sustains it */
    if (I.wasPressed('interact')) G.interactBuf = 0.35;
    G.interactBuf = Math.max(0, (G.interactBuf || 0) - dt);
    var holding = I.down('interact') || G.interactBuf > 0;

    var term = nearestTerminal(p.x, p.y, 26);
    p.hacking = (holding && term) ? term : null;
    if (p.hacking && p.hacking.done) p.hacking = null;

    if (I.wasPressed('dash') && p.dashCd <= 0 && !p.hacking) {
      p.dashT = 0.16; p.dashCd = 2.2;
      var da;
      if (len > 0) da = Math.atan2(dy, dx);
      else da = p.dir === 'left' ? Math.PI : p.dir === 'right' ? 0 : p.dir === 'up' ? -Math.PI / 2 : Math.PI / 2;
      p.dashDx = Math.cos(da); p.dashDy = Math.sin(da);
      NB.Sfx.dash();
    }

    p.dashCd = Math.max(0, p.dashCd - dt);
    p.empCd = Math.max(0, p.empCd - dt);
    if (I.wasPressed('emp') && p.empCd <= 0 && !p.hacking) {
      p.empCd = 12;
      NB.Sfx.emp();
      G.shake = Math.max(G.shake, 4);
      G.burst(p.x, p.y, '90,240,255', 26, 150, 2);
      G.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.45, max: 0.45, color: '90,240,255', size: 84, drag: 1, ring: true });
      var zapped = 0;
      G.guards.forEach(function (g) {
        if (NB.dist(g.x, g.y, p.x, p.y) < 90) {
          g.stunT = 3; g.det = 0; g.state = 'patrol'; g.burst = 0; zapped++;
          G.burst(g.x, g.y, '150,230,255', 10, 85, 0.5);
        }
      });
      G.drones.forEach(function (d) {
        if (NB.dist(d.x, d.y, p.x, p.y) < 90) {
          d.stunT = 3; d.det = 0; d.state = 'patrol'; d.burst = 0; d.burstT = 0; zapped++;
          G.burst(d.x, d.y, '150,230,255', 10, 85, 0.5);
        }
      });
      if (zapped) NB.Sfx.stun(); /* zap is heard on the hit, not when the stun wears off */
      G.bullets = G.bullets.filter(function (b) { return NB.dist(b.x, b.y, p.x, p.y) > 90; });
    }

    var vdx, vdy;
    if (p.dashT > 0) {
      p.dashT -= dt;
      vdx = p.dashDx * 330; vdy = p.dashDy * 330;
      p.inv = Math.max(p.inv, 0.12);
      if (G.frameCount % 2 === 0) p.ghost.push({ x: p.x, y: p.y, dir: p.dir, life: 0.28 });
    } else {
      var spd = (p.crouch ? 50 : 96) * (p.hacking ? 0 : 1);
      vdx = dx * spd; vdy = dy * spd;
    }
    p.moving = (vdx !== 0 || vdy !== 0) && !p.hacking;
    G.moveCircle(p, vdx * dt, vdy * dt, PLAYER_R);
    if (p.moving) {
      p.phase += dt * 11;
      if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
      else if (dy !== 0) p.dir = dy > 0 ? 'down' : 'up';
      if (G.frameCount % 9 === 0) NB.Sfx.step();
    }
    p.inv = Math.max(0, p.inv - dt);
    for (var i = p.ghost.length - 1; i >= 0; i--) {
      p.ghost[i].life -= dt;
      if (p.ghost[i].life <= 0) p.ghost.splice(i, 1);
    }

    if (p.hacking) {
      p.hacking.hackTimer += dt;
      if (G.frameCount % 9 === 0) NB.Sfx.hackTick(Math.min(1, p.hacking.hackTimer / 1.5));
      if (p.hacking.hackTimer >= 1.5) {
        var t = p.hacking;
        t.done = true;
        G.dataCount++;
        G.totalScore += 1000;
        G.levelEarned += 1000;
        NB.Sfx.shard();
        G.floatText(t.x, t.y - 12, '+1000', '255,190,60');
        G.burst(t.x, t.y, '255,176,32', 18, 80, 2);
        G.flash = Math.max(G.flash, 0.22); G.flashRGB = '255,176,32';
        G.guards.forEach(function (g) {
          if (NB.dist(g.x, g.y, t.x, t.y) < 160) {
            g.det = Math.max(g.det, 0.45);
            g.face = Math.atan2(t.y - g.y, t.x - g.x);
          }
        });
        p.hacking = null;
      }
    } else {
      L.terminals.forEach(function (t) { if (!t.done) t.hackTimer = Math.max(0, t.hackTimer - 2.5 * dt); });
    }

    var nearExit = NB.dist(p.x, p.y, L.exit.x, L.exit.y) < 22;
    var allData = G.dataCount >= L.terminals.length;
    if (nearExit && allData && holding) {
      G.escapeT += dt;
      if (G.frameCount % 10 === 0) NB.Sfx.hackTick(Math.min(1, G.escapeT));
      if (G.escapeT >= 1.0) { G.levelClear(); }
    } else {
      G.escapeT = Math.max(0, G.escapeT - 2 * dt);
    }
  }

  function nearestTerminal(x, y, r) {
    var L = G.level, best = null, bd = r;
    for (var i = 0; i < L.terminals.length; i++) {
      var t = L.terminals[i];
      if (t.done) continue;
      var d = NB.dist(x, y, t.x, t.y);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  function updateGuard(g, dt) {
    var p = G.player;
    if (g.stunT > 0) {
      g.stunT -= dt;
      if (g.stunT <= 0) { g.stunT = 0; G.burst(g.x, g.y - 4, '160,220,255', 6, 50, 0.35); }
      return;
    }
    var sees = G.canSee(g, false);
    var rate = sees ? ((p.crouch ? 0.42 : 1) * (p.moving ? 1.25 : 1)) : -0.5;
    g.det = NB.clamp(g.det + rate * dt, 0, 1);
    var d = NB.dist(g.x, g.y, p.x, p.y);
    var ang = Math.atan2(p.y - g.y, p.x - g.x);
    g.moving = false;

    if (g.det >= 1 && g.state !== 'alert') { g.state = 'alert'; g.lkp.x = p.x; g.lkp.y = p.y; g.noSeeT = 0; }

    if (g.state === 'alert') {
      if (sees) { g.lkp.x = p.x; g.lkp.y = p.y; g.noSeeT = 0; }
      else g.noSeeT += dt;
      var dl = NB.dist(g.x, g.y, g.lkp.x, g.lkp.y);
      if (dl > 8) {
        var mx = (g.lkp.x - g.x) / dl, my = (g.lkp.y - g.y) / dl;
        var ox = g.x, oy = g.y;
        G.moveCircle(g, mx * 88 * dt, my * 88 * dt, 6);
        g.face = Math.atan2(my, mx);
        g.phase += dt * 13;
        g.moving = true;
        /* unstuck: chase blocked by geometry for ~0.7s -> give up and search */
        var moved = Math.hypot(g.x - ox, g.y - oy);
        g.stuckT = moved < 88 * dt * 0.5 ? (g.stuckT || 0) + dt : 0;
        if (g.stuckT > 0.7) { g.stuckT = 0; g.state = 'search'; g.searchT = 0; g.det = 0.5; }
      }
      if (g.noSeeT > 3.2) { g.state = 'search'; g.searchT = 0; g.det = 0.5; g.face = Math.atan2(g.lkp.y - g.y, g.lkp.x - g.x); }
      g.fireCd -= dt;
      if (sees && d < 175 && !p.dead) {
        g.face = ang;
        if (g.burst > 0) {
          g.burstT -= dt;
          if (g.burstT <= 0) {
            fireBullets(g, ang);
            g.burst--;
            if (g.burst > 0) g.burstT = 0.16;
            else g.fireCd = 0.95;
          }
        } else if (g.fireCd <= 0) {
          g.burst = 3; g.burstT = 0;
        }
      }
    } else if (g.state === 'search') {
      g.stuckT = 0;
      g.searchT += dt;
      g.face += dt * 2.6;
      if (g.searchT > 2.4) { g.state = 'patrol'; g.det = 0; }
    } else {
      g.stuckT = 0;
      var wp = g.path[g.pi];
      var dw = NB.dist(g.x, g.y, wp.x, wp.y);
      if (dw < 7) { g.pi = (g.pi + 1) % g.path.length; wp = g.path[g.pi]; dw = NB.dist(g.x, g.y, wp.x, wp.y); }
      if (dw > 1) {
        var m2x = (wp.x - g.x) / dw, m2y = (wp.y - g.y) / dw;
        G.moveCircle(g, m2x * 46 * dt, m2y * 46 * dt, 6);
        g.face = Math.atan2(wp.y - g.y, wp.x - g.x);
        g.phase += dt * 9;
        g.moving = true;
      }
    }
  }

  function updateDrone(d, dt) {
    var p = G.player;
    if (d.stunT > 0) {
      d.stunT -= dt; d.t += dt; if (d.flash) d.flash -= dt;
      if (d.stunT <= 0) { d.stunT = 0; G.burst(d.x, d.y - 4, '160,220,255', 6, 50, 0.35); }
      return;
    }
    d.t += dt;
    if (d.flash) d.flash = Math.max(0, d.flash - dt);
    var sees = G.canSee(d, true);
    d.det = NB.clamp(d.det + (sees ? (p.crouch ? 0.75 : 1.3) : -0.6) * dt, 0, 1);
    var dist = NB.dist(d.x, d.y, p.x, p.y);
    if (d.det >= 1 && d.state !== 'alert') { d.state = 'alert'; d.lkp.x = p.x; d.lkp.y = p.y; d.noSeeT = 0; }

    if (d.state === 'alert') {
      if (sees) { d.lkp.x = p.x; d.lkp.y = p.y; d.noSeeT = 0; }
      else d.noSeeT += dt;
      if (d.noSeeT > 3.0) { d.state = 'patrol'; d.det = 0; }
      var dl = NB.dist(d.x, d.y, d.lkp.x, d.lkp.y);
      if (dl > 10) {
        var mx = (d.lkp.x - d.x) / dl, my = (d.lkp.y - d.y) / dl;
        var ox = d.x, oy = d.y;
        moveDrone(d, mx * 72 * dt, my * 72 * dt);
        d.face = Math.atan2(my, mx);
        /* unstuck: chase blocked for ~0.8s -> give up, back to patrol */
        var moved = Math.hypot(d.x - ox, d.y - oy);
        d.stuckT = moved < 72 * dt * 0.5 ? (d.stuckT || 0) + dt : 0;
        if (d.stuckT > 0.8) { d.stuckT = 0; d.state = 'patrol'; d.det = 0; d.noSeeT = 0; }
      }
      d.fireCd -= dt;
      if (sees && dist < 150 && d.fireCd <= 0 && !p.dead) {
        d.fireCd = 1.25;
        fireBullets(d, Math.atan2(p.y - d.y, p.x - d.x));
        d.flash = 0.1;
      }
    } else {
      d.stuckT = 0;
      var wp = d.path[d.pi];
      var dw = NB.dist(d.x, d.y, wp.x, wp.y);
      if (dw < 8) { d.pi = (d.pi + 1) % d.path.length; wp = d.path[d.pi]; dw = NB.dist(d.x, d.y, wp.x, wp.y); }
      if (dw > 1) {
        var m2x = (wp.x - d.x) / dw, m2y = (wp.y - d.y) / dw;
        moveDrone(d, m2x * 40 * dt, m2y * 40 * dt);
        d.face = Math.atan2(m2y, m2x);
      }
    }
  }
  function moveDrone(d, dx, dy) {
    var nx = d.x + dx;
    if (!G.circleHits(nx, d.y, 5)) d.x = nx;
    var ny = d.y + dy;
    if (!G.circleHits(d.x, ny, 5)) d.y = ny;
  }

  function fireBullets(from, ang) {
    NB.Sfx.gun();
    var sx = from.x + Math.cos(ang) * 10, sy = from.y + Math.sin(ang) * 10;
    G.bullets.push({ x: sx, y: sy, vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260, life: 0.95 });
    G.burst(sx, sy, '255,120,120', 3, 40, 1.5);
  }

  G.levelClear = function () {
    var L = G.level;
    var stealth = G.noDamage && !G.alertEver ? 500 : 0;
    var nodmg = G.noDamage ? 300 : 0;
    var timeB = NB.clamp(Math.round((L.par - G.time) * 10), 0, 1000);
    G.totalScore += stealth + nodmg + timeB;
    G.levelEarned += stealth + nodmg + timeB;
    G.runStats.push({ id: L.id, name: L.name, time: G.time, stealth: stealth, nodmg: nodmg, timeB: timeB, score: G.totalScore });
    G.lastBonus = { stealth: stealth, nodmg: nodmg, timeB: timeB };
    NB.Sfx.escape();
    G.burst(G.player.x, G.player.y, '90,240,255', 30, 120);
    G.flash = 0.5; G.flashRGB = '160,240,255';
    G.shake = Math.max(G.shake, 8);
    G.state = (G.levelIndex + 1 < NB.Levels.LEVELS.length) ? 'clear' : 'victory';
    if (G.state === 'victory') {
      G.newBest = NB.Store.submit(G.totalScore, G.rankFor(G.totalScore));
      NB.Sfx.victory();
      NB.Music.stop(); /* let the fanfare ring out over silence */
    }
    G.stateT = 0;
  };

  /* ---------- test hook ---------- */
  G.testAct = function (name, p) {
    p = p || {};
    var I = NB.Input;
    function tap(n) { I.release(n); I.press(n); }
    switch (name) {
      case 'start': tap('confirm'); break;
      case 'pause': tap('pause'); break;
      case 'restart': tap('restart'); break;
      case 'quit': tap('quit'); break;
      case 'confirm': tap('confirm'); break;
      case 'hold': tap(p.key); break;
      case 'release': I.release(p.key); break;
      case 'tap':
        I.release(p.key); I.press(p.key); I.release(p.key); /* one-frame press: feeds the interact buffer */
        break;
      case 'dash': tap('dash'); break;
      case 'emp': tap('emp'); break;
      case 'mute': tap('mute'); break;
      case 'teleport':
        if (p.tx !== undefined) {
          G.player.x = p.tx * T + 8; G.player.y = p.ty * T + 8;
        } else { G.player.x = p.x; G.player.y = p.y; }
        G.player.hacking = null;
        break;
      case 'set_hp': G.player.hp = NB.clamp(p.n === undefined ? 6 : p.n, 0, 6); break;
      case 'damage': G.damagePlayer(p.n === undefined ? 1 : p.n, true); break;
      case 'next_level': G.startLevel(Math.min(G.levelIndex + 1, NB.Levels.LEVELS.length - 1)); G.state = 'play'; G.stateT = 0; break;
      case 'hack_all':
        G.level.terminals.forEach(function (t) {
          if (!t.done) {
            t.done = true; G.dataCount++;
            G.totalScore += 1000; G.levelEarned += 1000;
          }
        });
        break;
      case 'set_alert':
        G.guards.forEach(function (g) { g.det = NB.clamp(p.v, 0, 1); });
        break;
    }
  };
})();
