async (page) => {
  const r = await page.evaluate(() => {
    const gt = window.__gameTest, g = window.__game, T = 32, L = [];
    const P = () => g.player;
    const solid = (x, y) => {
      const v = g.lvl;
      if (x < 0 || y < 0 || x >= v.w || y >= v.h) return true;
      const t = v.tiles[y * v.w + x];
      if (t === 1 || t === 2 || t === 3 || t === 9 || t === 10) return true;
      if (t === 7) for (const d of v.doors) if (d.tx === x && d.ty === y) return !d.open;
      return false;
    };
    const astar = (sx, sy, gx, gy) => {
      const W = g.lvl.w;
      if (solid(gx, gy) || (sx === gx && sy === gy)) return [[sx, sy]];
      const K = (x, y) => y * W + x, H = (x, y) => Math.abs(x - gx) + Math.abs(y - gy);
      const open = [[sx, sy, 0]], best = new Map([[K(sx, sy), 0]]), came = new Map();
      for (let i = 0; i < 5000 && open.length; i++) {
        let b = 0;
        for (let j = 1; j < open.length; j++) if (open[j][2] + H(open[j][0], open[j][1]) < open[b][2] + H(open[b][0], open[b][1])) b = j;
        const [cx, cy, gc] = open.splice(b, 1)[0];
        if (cx === gx && cy === gy) { const p = []; let k = K(cx, cy); while (k !== undefined) { p.push([k % W, k / W | 0]); k = came.get(k); } return p.reverse(); }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (solid(nx, ny)) continue;
          const nk = K(nx, ny), ng = gc + 1;
          if (best.has(nk) && best.get(nk) <= ng) continue;
          best.set(nk, ng); came.set(nk, K(cx, cy)); open.push([nx, ny, ng]);
        }
      }
      return null;
    };
    let held = [];
    const keys = (w) => {
      const s = new Set(w);
      for (const k of held) if (!s.has(k)) gt.act("release", { code: k });
      for (const k of w) if (!held.includes(k)) gt.act("press", { code: k });
      held = w;
    };
    const nearGuard = (d) => { const p = P(); for (const gr of g.lvl.guards) if (!gr.dead && Math.hypot(gr.x - p.x, gr.y - p.y) < d) return true; return false; };
    const moveTo = (tx, ty, tag, maxF = 4200) => {
      const p = P(); let path = null, pi = 0, stuck = 0, lx = p.x, ly = p.y;
      for (let f = 0; f < maxF; f++) {
        if (g.state !== "play" || p.dead) { L.push(tag + ":" + (p.dead ? "DEAD" : g.state)); return false; }
        const cx = p.x / T | 0, cy = p.y / T | 0;
        if (!path || pi >= path.length) {
          path = astar(cx, cy, tx, ty); pi = 0;
          if (!path) { L.push(tag + ":NOPATH@" + cx + "," + cy); return false; }
        }
        while (pi < path.length && Math.hypot(p.x - (path[pi][0] * T + 16), p.y - (path[pi][1] * T + 16)) < 12) pi++;
        if (pi >= path.length) { keys([]); L.push(tag + ":OK"); return true; }
        const dx = path[pi][0] * T + 16 - p.x, dy = path[pi][1] * T + 16 - p.y, w = [];
        if (dx < -6) w.push("KeyA"); else if (dx > 6) w.push("KeyD");
        if (dy < -6) w.push("KeyW"); else if (dy > 6) w.push("KeyS");
        if (nearGuard(90)) w.push("KeyC");
        keys(w); gt.step(1);
        const mv = Math.hypot(p.x - lx, p.y - ly); lx = p.x; ly = p.y;
        if (mv < .3) { if (++stuck > 130) { path = null; stuck = 0; } } else stuck = 0;
      }
      keys([]); L.push(tag + ":TIMEOUT@" + Math.round(p.x) + "," + Math.round(p.y)); return false;
    };
    const channel = (obj, frames, tag) => {
      const p = P(); let retry = 0;
      gt.act("press", { code: "KeyE" });
      for (let f = 0; f < frames + 90; f++) {
        if (g.state !== "play" || p.dead) { L.push(tag + ":" + (p.dead ? "DEAD" : g.state)); gt.act("release", { code: "KeyE" }); return false; }
        if (obj.done) { gt.act("release", { code: "KeyE" }); L.push(tag + ":DONE@" + f); return true; }
        if (!p.channel) { if (++retry > 2) { gt.act("release", { code: "KeyE" }); L.push(tag + ":INTERRUPT"); return false; } gt.act("press", { code: "KeyE" }); }
        gt.step(1);
      }
      gt.act("release", { code: "KeyE" }); L.push(tag + ":TIMEOUT"); return false;
    };
    const wait = (cond, frames, tag) => {
      for (let f = 0; f < frames; f++) {
        if (cond()) { L.push(tag + ":OK@" + f); return true; }
        const e = gt.step(1);
        if (e) { L.push(tag + ":ERR"); return false; }
        if (g.state !== "play") { L.push(tag + ":" + g.state + "@" + f); return g.state === "clear" || g.state === "win"; }
      }
      L.push(tag + ":TIMEOUT"); return false;
    };

    gt.reset(7); gt.act("start"); gt.step(60);
    if (g.state !== "play") return { log: ["START-FAIL:" + g.state] };
    L.push("play key=" + !!g.keycard);
    if (!moveTo(3, 3, "keycard")) return { log: L };
    L.push("key=" + !!g.keycard + " door=" + g.lvl.doors.map(d => d.open).join(","));
    gt.act("press", { code: "KeyQ" }); gt.step(3); gt.act("release", { code: "KeyQ" });
    L.push("camStun=" + ((g.lvl.cameras[0] && g.lvl.cameras[0].stunned) | 0));
    if (!moveTo(32, 6, "srvAdj")) return { log: L };
    if (!channel(g.lvl.server, 300, "server")) return { log: L };
    L.push("obj=" + !!g.objectiveDone + " hp=" + Math.round(P().hp) + " score=" + g.score);
    if (!moveTo(38, 24, "exit")) return { log: L };
    const ok = wait(() => g.state === "clear", 160, "extract");
    L.push("state=" + g.state);
    return { log: L, cleared: !!ok, state: g.state, score: g.score, levelIdx: g.levelIdx };
  });
  let extra = {};
  if (r.cleared) {
    await page.screenshot({ path: "clear-screen.png" });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    const l2 = await page.evaluate(() => {
      const g = window.__game, gt = window.__gameTest;
      const a = { levelIdx: g.levelIdx, state: g.state, name: g.levelName, drones: g.lvl.drones.length, guards: g.lvl.guards.length };
      g.nextLevel();
      gt.step(90);
      a.l3 = { levelIdx: g.levelIdx, state: g.state, name: g.levelName };
      g.clearLevel();
      a.win = { state: g.state };
      return a;
    });
    extra = { l2 };
    await page.screenshot({ path: "win-screen.png" });
  }
  return { ...r, ...extra };
}
