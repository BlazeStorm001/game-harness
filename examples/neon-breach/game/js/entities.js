// NEON BREACH — entities: player, guards, drones, cameras, bullets, smoke,
// and a lightweight particle system.

import { CFG } from "./config.js";
import { dda, findPath } from "./pathfind.js";
import { isSolidTile, moveCircle } from "./tiles.js";
import { rng } from "./rng.js";

const T = 32;
const TWO_PI = Math.PI * 2;

export function angDiff(a, b) {
  let d = (b - a) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

// ---------- particles ------------------------------------------------------
export class Particles {
  constructor() { this.list = []; }
  burst(x, y, color, n = 10, speed = 90, life = 0.5, size = 2) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TWO_PI;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.list.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        t: 0, life: life * (0.6 + Math.random() * 0.8),
        color, size: size * (0.6 + Math.random() * 0.8),
      });
    }
    if (this.list.length > 400) this.list.splice(0, this.list.length - 400);
  }
  ring(x, y, color, r = 10, life = 0.4) {
    this.list.push({ x, y, vx: 0, vy: 0, t: 0, life, color, size: r, ring: true });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      if (p.t >= p.life) { this.list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.9; p.vy *= 0.9;
    }
  }
  // Drawn in world space (the caller has already applied the camera transform).
  draw(ctx) {
    for (const p of this.list) {
      const a = 1 - p.t / p.life;
      if (p.ring) {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + (p.t / p.life) * 60, 0, TWO_PI);
        ctx.stroke();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }
}

// ---------- smoke ------------------------------------------------------------
export class Smoke {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.t = 0; this.dur = CFG.smoke.life;
    this.r = CFG.smoke.radius * 0.4;
    this.seed = Math.random() * 10;
  }
  get dead() { return this.t >= this.dur; }
  get blocked() { return this.t < 0.25; } // brief warm-up
  update(dt) {
    this.t += dt;
    this.r = CFG.smoke.radius * (0.4 + Math.min(0.6, this.t * 0.1));
  }
  contains(px, py) {
    if (this.blocked) return false;
    const dx = px - this.x, dy = py - this.y;
    return dx * dx + dy * dy < this.r * this.r;
  }
  draw(ctx, time) {
    const a = this.t > this.dur - 1.2
      ? Math.max(0, (this.dur - this.t) / 1.2)
      : Math.min(1, this.t / 0.3);
    ctx.save();
    ctx.globalAlpha = a * 0.55;
    for (let i = 0; i < 5; i++) {
      const ang = this.seed + i * 1.9 + time * 0.15;
      const rr = this.r * 0.55;
      const cx = this.x + Math.cos(ang) * rr * 0.5;
      const cy = this.y + Math.sin(ang) * rr * 0.5;
      const rad = this.r * (0.6 + 0.25 * Math.sin(this.seed + i + time));
      const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, rad);
      g.addColorStop(0, "rgba(160,190,220,0.5)");
      g.addColorStop(1, "rgba(160,190,220,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------- bullets ------------------------------------------------------------
export class Bullet {
  constructor(x, y, ang, from = "guard") {
    this.x = x; this.y = y;
    const s = from === "drone" ? CFG.drone.bulletSpeed : CFG.guard.bulletSpeed;
    this.vx = Math.cos(ang) * s;
    this.vy = Math.sin(ang) * s;
    this.from = from;
    this.dist = 0;
    this.max = from === "drone" ? 300 : 420;
    this.dead = false;
  }
  update(dt, lvl, game) {
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      this.x += (this.vx * dt) / steps;
      this.y += (this.vy * dt) / steps;
      this.dist += Math.hypot(this.vx, this.vy) * dt / steps;
      const tx = (this.x / T) | 0, ty = (this.y / T) | 0;
      if (isSolidTile(lvl, tx, ty)) {
        this.dead = true;
        game.particles.burst(this.x, this.y, "#ffb46a", 5, 60, 0.3, 2);
        return;
      }
      // hit player?
      const p = game.player;
      const dx = p.x - this.x, dy = p.y - this.y;
      if (dx * dx + dy * dy < 100) {
        this.dead = true;
        game.damagePlayer(this.from === "drone" ? CFG.drone.bulletDamage : CFG.guard.bulletDamage, this);
        return;
      }
      if (this.dist >= this.max) { this.dead = true; return; }
    }
  }
  draw(ctx) {
    const a = Math.atan2(this.vy, this.vx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(a);
    ctx.fillStyle = this.from === "drone" ? "#ffe066" : "#ff4d6d";
    ctx.fillRect(-7, -1.5, 14, 3);
    ctx.fillStyle = "#fff";
    ctx.fillRect(3, -1, 4, 2);
    ctx.restore();
  }
}

// ---------- player ------------------------------------------------------------
export class Player {
  constructor(lvl, game) {
    this.game = game;
    this.x = lvl.start.x;
    this.y = lvl.start.y;
    this.r = CFG.player.radius;
    this.hp = CFG.player.maxHp;
    this.maxHp = CFG.player.maxHp;
    this.emp = CFG.player.startEmp;
    this.smoke = CFG.player.startSmoke;
    this.facing = 1; // 1 right, -1 left (for sprite)
    this.dir = "side"; // for sprite frame (side = facing dir, matches initial sprite)
    this.moving = false;
    this.crouching = false;
    this.running = false;
    this.channel = null;   // {obj, t, need, kind}
    this.injuredT = 0;
    this.invuln = 0;
    this.animT = 0;
  }
  get speed() {
    if (this.crouching) return CFG.player.crouchSpeed;
    if (this.running) return CFG.player.runSpeed;
    return CFG.player.walkSpeed;
  }
  get noiseMult() {
    if (this.crouching) return CFG.detect.crouchFactor;
    if (this.running) return CFG.detect.runFactor;
    return 1;
  }
  update(dt, input, lvl) {
    const g = this.game;
    if (this.injuredT > 0) this.injuredT -= dt;
    if (this.invuln > 0) this.invuln -= dt;

    // channeling locks movement
    let mx = 0, my = 0;
    if (this.channel) {
      this.crouching = true;
      this.running = false;
      this.moving = false;
      this.updateChannel(dt);
    } else {
      mx = input.moveX; my = input.moveY;
      this.crouching = input.crouching;
      this.running = input.running;
      const len = Math.hypot(mx, my);
      this.moving = len > 0;
      if (this.moving) {
        const nx = mx / (len || 1), ny = my / (len || 1);
        const sp = this.speed;
        moveCircle(lvl, this, this.r, nx * sp * dt, ny * sp * dt);
        if (Math.abs(nx) > 0.2) this.facing = nx > 0 ? 1 : -1;
        this.dir = Math.abs(ny) > Math.abs(nx) ? (ny > 0 ? "down" : "up") : "side";
        this.animT += dt * (this.running ? 11 : this.crouching ? 5 : 8);
        // footstep audio
        g.audio.footstep(this.running, this.crouching);
      }
    }
  }
  updateChannel(dt) {
    const g = this.game;
    const c = this.channel;
    // keep facing the object
    const a = Math.atan2(c.obj.y - this.y, c.obj.x - this.x);
    this.dir = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a))
      ? "side" : (Math.sin(a) > 0 ? "down" : "up");
    this.facing = Math.cos(a) > 0 ? 1 : -1;
    c.t += dt;
    // interference tick sfx
    const prev = Math.floor((c.t / c.need) * 8);
    if (Math.floor(((c.t + dt) / c.need) * 8) !== prev) g.audio.channelTick(c.t / c.need);
    if (c.t >= c.need) {
      c.obj.done = true;
      this.channel = null;
      g.onChannelDone(c);
    }
  }
  startChannel(obj, kind, label = "LINKING") {
    this.channel = { obj, t: 0, need: kind === "server" ? CFG.downloadTime : 3, kind, label };
    this.game.audio.channelStart();
  }
  stopChannel() {
    if (!this.channel) return;
    this.channel = null;
    this.game.audio.channelStop(false);
  }
  draw(ctx, time) {
    const S = this.game.S;
    const state = this.channel || this.crouching ? "crouch" : (this.moving ? "walk" : "idle");
    let frame = "right";
    if (this.dir === "up") frame = "up";
    else if (this.dir === "down") frame = "down";
    else if (this.facing < 0) frame = "left";
    const img = S.agent[state][frame];
    const bob = this.moving && !this.crouching
      ? Math.abs(Math.sin(this.animT * Math.PI)) * 2 : 0;
    const flash = this.injuredT > 0 && Math.floor(time * 20) % 2 === 0;
    ctx.save();
    ctx.translate(this.x, this.y - bob);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 10, 8, 3, 0, 0, TWO_PI);
    ctx.fill();
    if (flash) ctx.globalAlpha = 0.5;
    ctx.drawImage(img, -16, -22, 32, 32);
    ctx.restore();
  }
}

// ---------- shared detection ------------------------------------------------
// Returns {seen, dist, frac} — frac 0..1 is how "visible" the player is.
export function canSee(w, p, game) {
  if (w.stunned > 0 || w.dead) return { seen: false, dist: 0, frac: 0 };
  const dx = p.x - w.x, dy = p.y - w.y;
  const dist = Math.hypot(dx, dy);
  if (dist > w.range) return { seen: false, dist, frac: 0 };
  // field of view
  const a = Math.atan2(dy, dx);
  let dAng = Math.abs(angDiff(w.angle, a));
  const fov = w.fov;
  if (dAng > fov && dist > 48) return { seen: false, dist, frac: 0 };
  // line of sight
  if (!dda(game.lvl, w.x, w.y, p.x, p.y)) return { seen: false, dist, frac: 0 };
  // smoke blocks
  if (game.smokes.some((s) => s.contains((w.x + p.x) / 2, (w.y + p.y) / 2)))
    return { seen: false, dist, frac: 0 };
  const frac = 1 - (dist / w.range) * 0.75;
  return { seen: true, dist, frac };
}

export function suspicionRate(w, p, game) {
  // suspicion points/sec (0..100 scale)
  let rate = w.rate;
  rate *= p.noiseMult;                       // run vs crouch
  if (p.channel) rate *= 0.5;                // signal interference mercy
  const v = canSee(w, p, game);
  if (!v.seen) return 0;
  return rate * v.frac;
}

// ---------- guard -----------------------------------------------------------
export class Guard {
  constructor(x, y, angle) {
    this.x = x; this.y = y;
    this.r = CFG.guard.radius;
    this.angle = angle;
    this.range = CFG.detect.guardRange;
    this.fov = CFG.detect.guardFov;
    this.rate = CFG.detect.baseRate;
    this.state = "patrol";
    this.susp = 0;
    this.path = [];
    this.pathT = 0;
    this.repath = 0;
    this.shootCd = 0;
    this.stunned = 0;
    this.dead = false;
    this.lastSeen = null;
    this.loseT = 0;
    this.muzzle = 0;
    this.animT = 0;
    this.moving = false;
    this.searchT = 0;
    this.alerted = false;
  }

  update(dt, input, game) {
    const lvl = game.lvl;
    const p = game.player;
    if (this.dead) return;
    if (this.muzzle > 0) this.muzzle -= dt;
    if (this.stunned > 0) {
      this.stunned -= dt;
      this.susp = Math.min(this.susp, 30);
      return;
    }
    if (this.shootCd > 0) this.shootCd -= dt;

    const v = canSee(this, p, game);
    // close-range ambush check: player within melee with LOS -> instant alert
    const pdx = p.x - this.x, pdy = p.y - this.y;
    const pdist = Math.hypot(pdx, pdy);

    if (v.seen) {
      this.susp = Math.min(100, this.susp + suspicionRate(this, p, game) * dt);
      this.lastSeen = { x: p.x, y: p.y };
      this.loseT = 0;
      if (this.susp >= 100 && !this.alerted) {
        this.alerted = true;
        this.state = "chase";
        game.onGuardAlert(this, true);
      } else if (this.susp >= CFG.detect.suspiciousAt && this.state === "patrol") {
        this.state = "search";
        game.audio.suspicious();
      }
    } else {
      this.loseT += dt;
      this.susp = Math.max(0, this.susp - 22 * dt);
      if (this.alerted && this.susp < 40) this.alerted = false;
      if (this.state === "chase" && this.loseT > 2.6) {
        this.state = "search";
        this.searchT = 5;
      }
      if (this.state === "search" && this.loseT > 6) {
        this.state = "patrol";
        this.susp = 0;
        game.newPatrol(this);
      }
    }

    // instant alert when player is right on top — but not if they slipped in behind
    const fromBack = Math.abs(angDiff(this.angle, Math.atan2(pdy, pdx))) > 1.9;
    if (pdist < CFG.player.takedownRange + 6 &&
        dda(lvl, this.x, this.y, p.x, p.y) &&
        this.state !== "chase" && !fromBack && !this.alerted) {
      this.susp = 100;
      this.alerted = true;
      this.state = "chase";
      game.onGuardAlert(this, false);
    }

    // noise hearing
    if (this.state === "patrol") {
      const noise = p.crouching ? CFG.player.noiseCrouch
        : p.running ? CFG.player.noiseRun : CFG.player.noiseWalk;
      if (p.moving && pdist < noise && this.susp < 45) {
        this.state = "search";
        this.lastSeen = { x: p.x, y: p.y };
        this.susp = Math.max(this.susp, 30);
        this.loseT = 0;
      }
    }

    // movement per state
    const speed = this.state === "chase" ? CFG.guard.chaseSpeed
      : this.state === "search" ? CFG.guard.searchSpeed : CFG.guard.patrolSpeed;

    if (this.state === "chase") this.chase(p, lvl, dt, speed, v);
    else if (this.state === "search") this.search(lvl, dt, speed);
    else {
      if (!this.path.length) game.newPatrol(this);
      this.walkPath(lvl, dt, speed);
    }

    // firing
    if (this.state === "chase" && v.seen && pdist < CFG.guard.shootRange &&
        this.shootCd <= 0 && dda(lvl, this.x, this.y, p.x, p.y)) {
      this.shootCd = CFG.guard.shootInterval;
      const a = Math.atan2(pdy, pdx) + (rng() - 0.5) * 0.16;
      game.bullets.push(new Bullet(this.x, this.y - 4, a, "guard"));
      game.audio.laser();
      this.muzzle = 0.08;
    }
  }

  chase(p, lvl, dt, speed, v) {
    // direct pursue if visible, else path to last seen
    let tx, ty;
    if (v.seen) { tx = p.x; ty = p.y; }
    else if (this.lastSeen) { tx = this.lastSeen.x; ty = this.lastSeen.y; }
    if (tx === undefined) return;
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.repath -= dt;
    if (!v.seen) {
      // re-path periodically
      if (this.repath <= 0) {
        this.repath = 0.5;
        const path = findPath(lvl,
          (this.x / T) | 0, (this.y / T) | 0,
          (tx / T) | 0, (ty / T) | 0);
        if (path && path.length) this.path = path;
        else { this.path = []; this.walkToward(tx, ty, speed, dt, lvl); }
      }
      if (this.path.length) this.walkPath(lvl, dt, speed);
      else this.walkToward(tx, ty, speed, dt, lvl);
    } else {
      this.walkToward(tx, ty, speed, dt, lvl);
      // face the player
      const ta = Math.atan2(dy, dx);
      this.angle += angDiff(this.angle, ta) * Math.min(1, 10 * dt);
    }
  }

  search(lvl, dt, speed) {
    this.searchT -= dt;
    if (this.lastSeen) {
      const dx = this.lastSeen.x - this.x, dy = this.lastSeen.y - this.y;
      if (dx * dx + dy * dy < 24 * 24) {
        // arrived: sweep in place
        this.moving = false;
        this.angle += Math.sin(this.searchT * 3) * 0.5 * dt * 8;
      } else {
        this.walkToward(this.lastSeen.x, this.lastSeen.y, speed, dt, lvl);
      }
    }
  }

  walkToward(tx, ty, speed, dt, lvl) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const step = Math.min(speed * dt, d);
    this.moving = step > 0.01;
    if (this.moving) {
      moveCircle(lvl, this, this.r, (dx / d) * step, (dy / d) * step);
      this.angle = Math.atan2(dy, dx);
      this.animT += dt * 8;
    }
  }

  walkPath(lvl, dt, speed) {
    if (!this.path.length) return;
    const wp = this.path[0];
    this.walkToward(wp.x * T + T / 2, wp.y * T + T / 2, speed, dt, lvl);
    const dx = this.x - (wp.x * T + T / 2), dy = this.y - (wp.y * T + T / 2);
    if (dx * dx + dy * dy < 10 * 10) this.path.shift();
  }

  // can the player takedown this guard? stunned or behind → yes; low awareness also works
  takedownable(p) {
    if (this.dead) return false;
    if (this.stunned > 0) return true;
    const a = Math.atan2(p.y - this.y, p.x - this.x);
    return Math.abs(angDiff(this.angle, a)) > 1.9 || this.susp < 20;
  }
  draw(ctx, time, S) {
    if (this.dead) {
      // downed body
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.PI / 2);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(S.guard.crouch.right, -16, -16, 32, 32);
      ctx.restore();
      return;
    }
    const state = this.stunned > 0 ? "crouch"
      : (this.state === "patrol" && !this.moving) ? "idle" : "walk";
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    let frame;
    if (Math.abs(c) > Math.abs(s)) frame = c > 0 ? "right" : "left";
    else frame = s > 0 ? "down" : "up";
    const img = S.guard[state][frame];
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 10, 8, 3, 0, 0, TWO_PI);
    ctx.fill();
    ctx.drawImage(img, -16, -22, 32, 32);
    if (this.stunned > 0) {
      ctx.strokeStyle = "rgba(33,230,255,0.9)";
      ctx.beginPath();
      ctx.arc(0, -12, 12 + Math.sin(time * 20) * 2, 0, TWO_PI);
      ctx.stroke();
    }
    if (this.muzzle > 0) {
      ctx.fillStyle = "#ffd8a8";
      const mx = Math.cos(this.angle) * 16, my = -8 + Math.sin(this.angle) * 16;
      ctx.beginPath();
      ctx.arc(mx, my, 5, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------- camera ----------------------------------------------------------
export class Camera {
  constructor(x, y, baseAngle, amp = 0.95, speed = 0.9) {
    this.x = x; this.y = y;
    this.baseAngle = baseAngle;
    this.angle = baseAngle;
    this.amp = amp;
    this.speed = speed;
    this.phase = rng() * 6.28;
    this.range = CFG.detect.cameraRange;
    this.fov = CFG.detect.cameraFov;
    this.rate = CFG.detect.cameraRate;
    this.susp = 0;
    this.stunned = 0;
    this.dead = false;
    this.alerted = false;
  }
  update(dt, game) {
    if (this.stunned > 0) {
      this.stunned -= dt;
      this.susp = Math.max(0, this.susp - 30 * dt);
      return;
    }
    this.angle = this.baseAngle + Math.sin(game.time * this.speed + this.phase) * this.amp;
    const p = game.player;
    const v = canSee(this, p, game);
    if (v.seen) {
      this.susp += suspicionRate(this, p, game) * dt;
      if (this.susp >= 100 && !this.alerted) {
        this.alerted = true;
        game.onWatcherAlert(this);
      }
    } else {
      this.susp = Math.max(0, this.susp - 12 * dt);
      if (this.susp < 10 && this.alerted) this.alerted = false;
    }
  }
  draw(ctx, time, S) {
    const img = this.stunned > 0 ? S.camStun : S.camIdle;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    if (this.susp > CFG.detect.suspiciousAt || this.alerted) {
      ctx.strokeStyle = this.alerted ? "rgba(255,45,95,0.8)" : "rgba(255,194,51,0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 13 + Math.sin(time * 10) * 1.5, 0, TWO_PI);
      ctx.stroke();
    }
    ctx.drawImage(img, -11, -11, 22, 22);
    if (this.stunned > 0) {
      ctx.strokeStyle = "rgba(33,230,255,0.7)";
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, TWO_PI);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------- drone -----------------------------------------------------------
export class Drone {
  constructor(x, y, angle = 0) {
    this.x = x; this.y = y;
    this.r = CFG.drone.radius;
    this.angle = angle;
    this.range = CFG.detect.droneRange;
    this.fov = CFG.detect.droneFov;
    this.rate = CFG.detect.droneRate;
    this.state = "patrol";
    this.susp = 0;
    this.path = [];
    this.repath = 0;
    this.shootCd = 0;
    this.stun = 0;
    this.hp = CFG.drone.hp;
    this.dead = false;
    this.lastSeen = null;
    this.loseT = 0;
    this.bob = rng() * 6.28;
    this.muzzle = 0;
  }
  update(dt, game) {
    if (this.dead) return;
    const p = game.player;
    const lvl = game.lvl;
    if (this.muzzle > 0) this.muzzle -= dt;
    this.bob += dt * 4;
    if (this.stun > 0) {
      this.stun -= dt;
      this.susp = 0;
      if (this.stun <= 0 && this.hp > 0) { this.stun = 0; }
      return;
    }
    if (this.shootCd > 0) this.shootCd -= dt;
    const v = canSee(this, p, game);
    if (v.seen) {
      this.susp += suspicionRate(this, p, game) * dt;
      this.lastSeen = { x: p.x, y: p.y };
      this.loseT = 0;
      if (this.susp >= 60) this.state = "chase";
    } else {
      this.loseT += dt;
      this.susp = Math.max(0, this.susp - 18 * dt);
      if (this.state === "chase" && this.loseT > 3.5) {
        this.state = "patrol";
        this.susp = 0;
        game.newPatrol(this);
      }
    }
    const chase = this.state === "chase";
    const speed = chase ? CFG.drone.chaseSpeed : CFG.drone.patrolSpeed;
    if (chase && this.lastSeen) {
      this.repath -= dt;
      if (this.repath <= 0) {
        this.repath = 0.5;
        const path = findPath(lvl,
          (this.x / T) | 0, (this.y / T) | 0,
          (this.lastSeen.x / T) | 0, (this.lastSeen.y / T) | 0);
        if (path && path.length) this.path = path;
        else this.path = [];
      }
      if (this.path.length) {
        const wp = this.path[0];
        const dx = wp.x * T + 16 - this.x, dy = wp.y * T + 16 - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.x += (dx / d) * speed * dt;
        this.y += (dy / d) * speed * dt;
        this.angle = Math.atan2(dy, dx);
        if (d < 8) this.path.shift();
      } else {
        const dx = this.lastSeen.x - this.x, dy = this.lastSeen.y - this.y;
        this.angle = Math.atan2(dy, dx);
      }
      // fire
      if (v.seen && this.shootCd <= 0 &&
          Math.hypot(p.x - this.x, p.y - this.y) < CFG.drone.shootRange) {
        this.shootCd = CFG.drone.shootInterval;
        const a = Math.atan2(p.y - this.y, p.x - this.x) + (rng() - 0.5) * 0.14;
        game.bullets.push(new Bullet(this.x, this.y, a, "drone"));
        game.audio.droneShot();
        this.muzzle = 0.08;
      }
    } else if (this.path.length) {
      const wp = this.path[0];
      const dx = wp.x * T + 16 - this.x, dy = wp.y * T + 16 - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.x += (dx / d) * speed * dt;
      this.y += (dy / d) * speed * dt;
      this.angle = Math.atan2(dy, dx);
      if (d < 8) this.path.shift();
    } else {
      game.newPatrol(this);
    }
  }
  draw(ctx, time, S) {
    if (this.dead) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.PI / 2);
      ctx.globalAlpha = 0.6;
      ctx.drawImage(S.droneStun, -16, -16, 32, 32);
      ctx.restore();
      return;
    }
    const bobY = this.stun > 0 ? Math.sin(this.bob) * 3 : Math.sin(this.bob) * 2;
    ctx.save();
    ctx.translate(this.x, this.y + bobY);
    // hover shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 14 - bobY, 10, 3, 0, 0, TWO_PI);
    ctx.fill();
    const img = this.stun > 0 ? S.droneStun : S.drone;
    ctx.drawImage(img, -14, -14, 28, 28);
    if (this.muzzle > 0) {
      ctx.fillStyle = "#ffe066";
      const mx = Math.cos(this.angle) * 14, my = Math.sin(this.angle) * 14;
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, TWO_PI);
      ctx.fill();
    }
    // alert ring
    if (this.state === "chase" || this.stun > 0) {
      ctx.strokeStyle = this.stun > 0
        ? "rgba(33,230,255,0.8)" : "rgba(255,45,95,0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 16 + Math.sin(time * 12) * 2, 0, TWO_PI);
      ctx.stroke();
    }
    ctx.restore();
  }
}
