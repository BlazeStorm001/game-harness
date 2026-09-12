// NEON BREACH — Game orchestration
import { CFG } from "./config.js";
import { LEVELS, parseLevel } from "./levels.js";
import { patrolPath } from "./pathfind.js";
import { buildWorldCanvas, drawDoor, T } from "./tiles.js";
import { Player, Guard, Camera, Drone, Bullet, Smoke, Particles } from "./entities.js";
import { drawUI, drawPost, drawKeycard } from "./ui.js";
import { rng } from "./rng.js";

const DIRS = { C: 0, L: Math.PI, U: -Math.PI / 2, V: Math.PI / 2 };

export class Game {
  constructor(canvas, input, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.input = input;
    this.audio = audio;
    this.state = "menu";
    this.time = 0;
    this.levelIdx = 0;
    this.shards = 0;
    this.score = 0;
    this.msg = "";
    this.msgT = 0;
    this.empCd = 0;
    this.tdkCd = 0;
    this.alertSfxCd = 0;
    this.extractT = 0;
    this.deadT = 0;
    this.atExit = false;
    this.objectiveDone = false;
    this.keycard = false;
    this.bullets = [];
    this.smokes = [];
    this.particles = new Particles();
    this.shake = 0;
    this.exitWorld = null;
    this.levelName = "";
    this.alarm = 0;
    this.levelT = 0;
  }
  start() { this.loadLevel(0); this.state = "play"; this.audio.startMusic(); }
  say(text, t = 3) { this.msg = text; this.msgT = t; }
  loadLevel(i) {
    this.levelIdx = i;
    const def = LEVELS[i];
    const lvl = parseLevel(def);
    this.lvl = lvl;
    this.worldCanvas = buildWorldCanvas(lvl);
    this.player = new Player(lvl, this);
    this.guards = [];
    this.cameras = [];
    this.drones = [];
    this.bullets = [];
    this.smokes = [];
    this.particles = new Particles();
    this.keycard = false;
    this.objectiveDone = false;
    this.atExit = false;
    this.extractT = 0;
    this.levelTime0 = this.time;
    this.empCd = 0;
    this.tdkCd = 0;
    this.alertSfxCd = 0;
    this.alarm = 0;
    this.deadT = 0;
    this.levelT = 0;
    this.levelName = `${def.name}`;
    this.exitWorld = lvl.exit;
    for (const e of lvl.guards) {
      const g = new Guard(e.x, e.y, e.angle ?? 0);
      g.homeX = e.tx; g.homeY = e.ty; g.patrolR = 6;
      g.path = patrolPath(lvl, e.tx, e.ty, 3, rng, 6);
      this.guards.push(g);
    }
    for (const e of lvl.cameras) {
      const c = new Camera(e.x, e.y, DIRS[e.dir] ?? 0);
      this.cameras.push(c);
    }
    for (const e of lvl.drones) {
      const d = new Drone(e.x, e.y, 0);
      d.homeX = e.tx; d.homeY = e.ty; d.patrolR = 5;
      d.path = patrolPath(lvl, e.tx, e.ty, 3, rng, 5);
      this.drones.push(d);
    }
    for (const d of lvl.doors) d.open = false, d.anim = 0;
    this.msg = `${def.name} — ${def.sub}`;
    this.msgT = 4;
  }
  newPatrol(w) {
    const hx = w.homeX ?? ((w.x / T) | 0), hy = w.homeY ?? ((w.y / T) | 0);
    w.path = patrolPath(this.lvl, hx, hy, 3, rng, w.patrolR ?? 6);
  }

  update(dt) {
    this.time += dt;
    if (this.msgT > 0) this.msgT -= dt;
    // global keys
    if (this.input.wasPressed("Escape", "KeyP")) {
      if (this.state === "play") this.state = "pause";
      else if (this.state === "pause") this.state = "play";
      else if (this.state !== "menu") this.toMenu();
    }
    if (this.input.wasPressed("KeyM")) this.audio.toggleMute();
    if (this.input.wasPressed("Enter")) this.advance();
    if (this.input.wasPressed("KeyR") && (this.state === "pause" || this.state === "dead")) this.retryLevel();
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2);
    if (this.state !== "play") { this.input.endFrame(); return; }
    this.levelT += dt;
    if (this.empCd > 0) this.empCd -= dt;
    if (this.tdkCd > 0) this.tdkCd -= dt;
    if (this.alertSfxCd > 0) this.alertSfxCd -= dt;
    const p = this.player;
    if (p.dead) {
      // death cinematic: world keeps running, player input is dead
      if (this.deadT > 0) {
        this.deadT -= dt;
        if (this.deadT <= 0) { this.deadT = 0; this.state = "dead"; }
      }
    } else {
      p.update(dt, this.input, this.lvl, this);
      // gadgets
      if (this.input.wasPressed("KeyQ") && p.emp > 0 && this.empCd <= 0) this.fireEmp();
      if (this.input.wasPressed("KeyF") && p.smoke > 0) this.throwSmoke();
      // takedown
      const tg = this.takedownTarget();
      if (this.input.wasPressed("Space") && tg) this.doTakedown(tg);
      // interact / channel
      this.handleInteract(dt);
    }
    // watchers
    for (const g of this.guards) g.update(dt, this.input, this);
    for (const c of this.cameras) c.update(dt, this);
    for (const d of this.drones) d.update(dt, this);
    for (const b of this.bullets) b.update(dt, this.lvl, this);
    this.bullets = this.bullets.filter(b => !b.dead);
    for (const s of this.smokes) s.update(dt);
    this.smokes = this.smokes.filter(s => !s.dead);
    this.particles.update(dt);
    // doors
    for (const d of this.lvl.doors) {
      const t = d.open ? 1 : 0;
      d.anim += (t - d.anim) * Math.min(1, dt * 4);
    }
    // keycards
    for (const k of this.lvl.keycards) {
      if (!k.taken && !p.dead && Math.hypot(p.x - k.x, p.y - k.y) < 22) {
        k.taken = true;
        this.keycard = true;
        this.score += 150;
        for (const d of this.lvl.doors) d.open = true;
        this.say("KEYCARD — ALL BLAST DOORS UNLOCKED", 3.5);
        this.audio.keycardGet();
        this.particles.burst(k.x, k.y, "#ffc233", 18, 120, 0.8, 3);
      }
    }
    // exit
    this.atExit = Math.hypot(p.x - this.exitWorld.x, p.y - this.exitWorld.y) < 26;
    if (this.atExit && this.objectiveDone && this.extractT <= 0 && !p.channel && !p.dead) {
      this.extractT = CFG.extractTime;
    }
    // extraction
    if (this.extractT > 0) {
      this.extractT -= dt;
      if (this.extractT <= 0) this.clearLevel();
    }
    // alarm = loudest watcher
    let a = 0;
    for (const g of this.guards) if (!g.dead) a = Math.max(a, g.susp / 100);
    for (const c of this.cameras) a = Math.max(a, c.susp / 100);
    for (const d of this.drones) if (!d.dead) a = Math.max(a, d.susp / 100);
    a = Math.min(1, a);
    this.alarm = Math.max(a, this.alarm - dt * 0.5);
    if (a >= 1 && !this.klaxonOn) { this.audio.startKlaxon(); this.klaxonOn = true; }
    if (a < 0.98 && this.klaxonOn) { this.audio.stopKlaxon(); this.klaxonOn = false; }
    this.input.endFrame();
  }
  fireEmp() {
    const p = this.player;
    p.emp -= 1;
    this.empCd = CFG.emp.cooldown;
    this.audio.emp();
    this.particles.ring(p.x, p.y, "#21e6ff", CFG.emp.radius, 0.5);
    for (const g of this.guards) {
      if (!g.dead && Math.hypot(g.x - p.x, g.y - p.y) < CFG.emp.radius) {
        g.stunned = CFG.emp.guardStun;
        g.state = g.susp >= 100 ? "chase" : "stunned";
      }
    }
    for (const c of this.cameras)
      if (Math.hypot(c.x - p.x, c.y - p.y) < CFG.emp.radius) c.stunned = CFG.emp.camStun;
    for (const d of this.drones) {
      if (!d.dead && Math.hypot(d.x - p.x, d.y - p.y) < CFG.emp.radius) {
        d.stun = 5;
        if (d.hp > 0) {
          d.hp -= 1;
          if (d.hp <= 0) {
            d.dead = true;
            this.score += 250;
            this.particles.burst(d.x, d.y, "#ffe066", 22, 150, 0.9, 3);
          }
        }
      }
    }
  }
  throwSmoke() {
    const p = this.player;
    p.smoke -= 1;
    // idle players throw in the last direction they faced, not an arbitrary default
    let fx = p.facing, fy = 0;
    if (p.dir === "up") { fx = 0; fy = -1; }
    else if (p.dir === "down") { fx = 0; fy = 1; }
    const a = Math.atan2(fy, fx);
    const sp = 260, t = 0.55;
    const nx = p.x + Math.cos(a) * sp * t, ny = p.y + Math.sin(a) * sp * t;
    const s = new Smoke(nx, ny);
    this.smokes.push(s);
    this.audio.smoke();
  }
  takedownTarget() {
    const p = this.player;
    let best = null, bd = 1e9;
    for (const g of this.guards) {
      if (g.dead || !g.takedownable(p)) continue;
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < CFG.player.takedownRange && d < bd) { bd = d; best = g; }
    }
    return best;
  }
  doTakedown(g) {
    if (this.tdkCd > 0 || g.dead) return;
    const p = this.player;
    if (!g.takedownable(p)) return; // only acts when the prompt is valid
    this.tdkCd = CFG.player.takedownCooldown;
    g.dead = true;
    this.score += 200;
    this.audio.takedown();
    this.particles.burst(g.x, g.y, "#ff3355", 16, 90, 0.7, 3);
    this.say("GUARD SILENCED", 1.5);
  }
  // nearest interactable target within range — shared by handleInteract and the [E] prompt
  nearInteract() {
    const p = this.player;
    if (this.lvl.server && !this.lvl.server.done &&
        Math.hypot(p.x - this.lvl.server.x, p.y - this.lvl.server.y) < 42)
      return { obj: this.lvl.server, kind: "server", label: "BREACHING CORE" };
    for (const t of this.lvl.terminals)
      if (!t.done && Math.hypot(p.x - t.x, p.y - t.y) < 38)
        return { obj: t, kind: "terminal", label: "DUMPING DATA" };
    return null;
  }
  handleInteract(dt) {
    const p = this.player;
    const e = this.input;
    const near = this.nearInteract();
    if (e.wasPressed("KeyE") && !p.channel) {
      if (near) { p.startChannel(near.obj, near.kind, near.label); }
      else if (this.atExit && !this.objectiveDone) { this.say("SECURITY LOCK — BREACH THE CORE FIRST", 2); this.audio.doorDenied(); }
    }
    if (p.channel && !e.isDown("KeyE")) p.stopChannel();
  }
  damagePlayer(dmg, src) {
    const p = this.player;
    if (p.dead || p.invuln > 0) return;
    p.hp -= dmg;
    p.invuln = 0.5;
    p.injuredT = 1;
    this.shake = 1;
    this.audio.hitPlayer();
    if (p.channel) p.stopChannel();
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      this.audio.stopMusic();
      this.audio.stopKlaxon();
      this.particles.burst(p.x, p.y, "#21e6ff", 30, 160, 1, 4);
      this.deadT = 0.7;
    }
  }
  dispatchGuards(x, y, radius = Infinity) {
    // guards: investigate as search; drones: rush in as chase (they only fire on real sight)
    for (const g of this.guards) {
      if (g.dead || g.stunned > 0 || g.state === "chase") continue;
      if (Math.hypot(g.x - x, g.y - y) > radius) continue;
      g.state = "search";
      g.lastSeen = { x, y };
      g.searchT = 6;
      g.susp = Math.max(g.susp, 30);
      g.loseT = 0;
      g.path = [];
    }
    for (const d of this.drones) {
      if (d.dead || d.stun > 0 || d.state === "chase") continue;
      if (Math.hypot(d.x - x, d.y - y) > radius) continue;
      d.state = "chase";
      d.lastSeen = { x, y };
      d.loseT = 0;
      d.path = [];
    }
  }
  playAlertSfx() {
    if (this.alertSfxCd > 0) return;
    this.alertSfxCd = 1.2;
    this.audio.alert();
  }
  onGuardAlert(g) {
    this.alarm = 1;
    this.say("DETECTED — EVADE!", 2.5);
    this.playAlertSfx();
    // alarm propagation: nearby units investigate the last seen spot
    if (g.lastSeen) this.dispatchGuards(g.lastSeen.x, g.lastSeen.y, 340);
  }
  onWatcherAlert(c) {
    this.alarm = 1;
    this.say("CAMERA TRIPWIRE — GUARDS DISPATCHED", 2.5);
    this.playAlertSfx();
    this.dispatchGuards(c.x, c.y);
  }
  onChannelDone(c) {
    const p = this.player;
    this.audio.channelStop(true);
    if (c.kind === "server") {
      this.objectiveDone = true;
      this.score += 500;
      this.say("CORE BREACHED — REACH THE EXIT", 3.5);
      this.particles.burst(this.lvl.server.x, this.lvl.server.y, "#3dff9a", 26, 140, 1, 3);
    } else {
      this.score += 100;
      this.shards += 1;
      this.audio.shardGet();
      this.say("+1 DATA SHARD", 1.6);
    }
  }
  clearLevel() {
    const last = this.levelIdx >= LEVELS.length - 1;
    const timeBonus = Math.max(0, 200 - Math.floor(this.levelT));
    this.score += 500 + timeBonus;
    this.audio.levelClear();
    this.audio.stopKlaxon();
    this.klaxonOn = false;
    if (last) { this.state = "win"; }
    else this.state = "clear";
  }
  nextLevel() {
    this.loadLevel(this.levelIdx + 1);
    this.state = "play";
    this.audio.startMusic();
  }
  retryLevel() {
    this.loadLevel(this.levelIdx);
    this.state = "play";
  }
  toMenu() {
    this.state = "menu";
    this.audio.stopMusic();
    this.audio.stopKlaxon();
  }
  // Full deterministic reset for the __gameTest contract: same fields as a
  // fresh `new Game(...)` (state "menu"), so reset(seed) can restart the run.
  hardReset() {
    this.state = "menu";
    this.lvl = undefined;
    this.worldCanvas = null;
    this.player = null;
    this.guards = [];
    this.cameras = [];
    this.drones = [];
    this.bullets = [];
    this.smokes = [];
    this.particles = new Particles();
    this.time = 0;
    this.levelIdx = 0;
    this.shards = 0;
    this.score = 0;
    this.msg = "";
    this.msgT = 0;
    this.empCd = 0;
    this.tdkCd = 0;
    this.alertSfxCd = 0;
    this.extractT = 0;
    this.deadT = 0;
    this.atExit = false;
    this.objectiveDone = false;
    this.keycard = false;
    this.shake = 0;
    this.exitWorld = null;
    this.levelName = "";
    this.alarm = 0;
    this.levelT = 0;
    this.klaxonOn = false;
    this.audio.stopMusic();
    this.audio.stopKlaxon();
  }
  advance() {
    if (this.state === "menu") this.start();
    else if (this.state === "clear") this.nextLevel();
    else if (this.state === "dead") this.retryLevel();
    else if (this.state === "win") { this.shards = 0; this.score = 0; this.start(); }
  }
  render(W, H) {
    const ctx = this.ctx;
    const S = this.S;
    ctx.fillStyle = "#04060f";
    ctx.fillRect(0, 0, W, H);
    if (!this.lvl) { drawUI(ctx, this, W, H); return; }
    const p = this.player;
    let ox = (W / 2) - p.x, oy = (H / 2) - p.y;
    if (this.lvl.w * T < W) ox = (W - this.lvl.w * T) / 2;
    else ox = Math.max(W - this.lvl.w * T - 20, Math.min(20, ox));
    if (this.lvl.h * T < H) oy = (H - this.lvl.h * T) / 2;
    else oy = Math.max(H - this.lvl.h * T - 20, Math.min(20, oy));
    if (this.shake > 0) { ox += (Math.random() - 0.5) * this.shake * 8; oy += (Math.random() - 0.5) * this.shake * 8; }
    ox = Math.round(ox); oy = Math.round(oy);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.drawImage(this.worldCanvas, 0, 0);
    // dynamic doors
    for (const d of this.lvl.doors) if (d.anim < 0.99) drawDoor(ctx, d, this.time);
    // floor items (keycards, shard glints)
    for (const k of this.lvl.keycards) if (!k.taken) drawKeycard(ctx, k, this.time, S);
    for (const s of this.smokes) s.draw(ctx, this.time);
    for (const c of this.cameras) c.draw(ctx, this.time, S);
    for (const d of this.drones) d.draw(ctx, this.time, S);
    for (const g of this.guards) g.draw(ctx, this.time, S);
    for (const b of this.bullets) b.draw(ctx);
    p.draw(ctx, this.time, S);
    this.particles.draw(ctx);
    ctx.restore();
    // post: scanlines + vignette + HUD
    drawPost(ctx, this, W, H);
    drawUI(ctx, this, W, H, ox, oy);
  }
}
