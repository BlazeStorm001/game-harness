// NEON BREACH — autonomous clear bot v2 (single-file assembly)
// Drives the production game through the window.__gameTest contract only.
// Start: window.botv2.start(seed);  poll: window.botv2.get()
(() => {
  let st = { running: false, done: false, result: null, log: [] };

  const PLANS = [
    // L1: keycard(3,3) T1(17,2) T2(16,23) S(31,6) exit(38,24)
    { steps: [
      { g: [3, 3], label: "keycard" },
      { g: [17, 3], label: "T1a" }, { c: "t", t: [17, 2], label: "T1" },
      { g: [18, 3], label: "T1b" },
      { g: [17, 23], label: "T2a" }, { c: "t", t: [16, 23], label: "T2" },
      { g: [18, 5], label: "T2b" },
      { g: [25, 5], label: "door" },
      { g: [30, 6], label: "S-a" }, { c: "s", label: "S" },
      { g: [25, 5], label: "S-b" },
      { g: [23, 5], label: "S-c" },
      { g: [23, 15], label: "B1" },
      { g: [25, 15], label: "B2" },
      { g: [25, 24], label: "B3" },
      { g: [37, 24], label: "exit-a" },
      { x: [38, 24], label: "exit" },
    ] },
    // L2: keycard(6,13) S(21,13) T3(39,2) T2(20,25) exit(40,26)
    { steps: [
      { g: [6, 13], label: "keycard" },
      { g: [20, 13], label: "S-a" }, { c: "s", label: "S" },
      { g: [6, 13], label: "S-b" },
      { g: [4, 4], label: "N1" },
      { g: [39, 4], label: "N2" },
      { g: [39, 3], label: "T3a" }, { c: "t", t: [39, 2], label: "T3" },
      { g: [39, 22], label: "T3b" },
      { g: [20, 22], label: "T2a" },
      { g: [20, 24], label: "T2b" }, { c: "t", t: [20, 25], label: "T2" },
      { g: [20, 21], label: "T2c" },
      { g: [40, 21], label: "E1" },
      { g: [40, 25], label: "E2" },
      { x: [40, 26], label: "exit" },
    ] },
    // L3: T1(2,2) keycard(9,3) T3(40,27) S(21,15) T2(15,26) exit(41,27)
    { steps: [
      { g: [2, 3], label: "T1a" }, { c: "t", t: [2, 2], label: "T1" },
      { g: [9, 3], label: "keycard" },
      { g: [27, 3], label: "N1" },
      { g: [27, 18], label: "N2" },
      { g: [29, 18], label: "door" },
      { g: [40, 18], label: "N3" },
      { g: [40, 26], label: "T3a" }, { c: "t", t: [40, 27], label: "T3" },
      { g: [29, 18], label: "W1" },
      { g: [27, 18], label: "W2" },
      { g: [25, 18], label: "W3" },
      { g: [25, 10], label: "W4" },
      { g: [21, 10], label: "S-a" },
      { g: [21, 14], label: "S-b" }, { c: "s", label: "S" },
      { g: [21, 10], label: "S-c" },
      { g: [15, 10], label: "T2a" },
      { g: [15, 25], label: "T2b" }, { c: "t", t: [15, 26], label: "T2" },
      { g: [15, 10], label: "T2c" },
      { g: [25, 10], label: "E1" },
      { g: [25, 18], label: "E2" },
      { g: [29, 18], label: "E3" },
      { g: [40, 18], label: "E4" },
      { g: [40, 26], label: "E5" },
      { g: [41, 26], label: "E6" },
      { x: [41, 27], label: "exit" },
    ] },
  ];

  function doRun(seed) {
    const T = window.__gameTest, G = window.__game;
    const ev = s => st.log.push(`[${G.time.toFixed(1)}] ${s}`);
    const results = { levels: [], ok: false, died: null, final: null, kills: [] };

    const MOVE = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);
    const held = new Set();
    const setKey = (c, d) => {
      if (d && !held.has(c)) { T.act("press", { code: c }); held.add(c); }
      else if (!d && held.has(c)) { T.act("release", { code: c }); held.delete(c); }
    };
    const clearMove = () => { for (const c of [...held]) if (MOVE.has(c)) setKey(c, false); };
    const crouch = d => setKey("ControlLeft", d);
    const W = (tx, ty) => ({ x: tx * 32 + 16, y: ty * 32 + 16 });

    const watchers = () => [
      ...G.guards.filter(g => !g.dead),
      ...G.cameras.filter(c => !c.dead),
      ...G.drones.filter(d => !d.dead),
    ];
    const maxSusp = () => watchers().reduce((m, w) => Math.max(m, w.susp || 0), 0);
    const topWatcher = () => watchers().reduce((m, w) => (w.susp || 0) > (m ? m.susp : -1) ? w : m, null);
    const distW = w => w ? Math.hypot(w.x - G.player.x, w.y - G.player.y) : 1e9;

    const tap = c => { T.act("tap", { code: c }); };

    // Wait until maxSusp < thresh (or give up). EMP when a threat is >60 and close.
    function clearArea(thresh, maxFrames = 900) {
      for (let i = 0; i < maxFrames; i++) {
        if (G.state !== "play") return { ok: G.state === "clear" || G.state === "win", state: G.state };
        const s = maxSusp();
        if (s < thresh) return { ok: true, s };
        const p = G.player;
        if (s > 60) {
          const w = topWatcher();
          if (distW(w) < 240) {
            if (p.emp > 0 && G.empCd <= 0) { tap("KeyQ"); ev(`clearArea EMP s=${s.toFixed(0)}`); T.step(75); continue; }
            if (p.emp <= 0 && p.smoke > 0) { tap("KeyF"); ev("clearArea SMOKE"); T.step(75); continue; }
          }
        }
        T.step(6);
      }
      return { ok: maxSusp() < thresh, s: maxSusp() };
    }

    // Move to a waypoint: dominant-axis L, always crouched.
    function moveTo(wp, label, maxFrames = 3000) {
      const p = G.player;
      clearMove(); crouch(true);
      let stuck = 0, lx = p.x, ly = p.y, lastClear = -999;
      for (let i = 0; i < maxFrames; i++) {
        if (G.state !== "play") return { ok: false, why: "state:" + G.state, frames: i };
        if (p.dead) return { ok: false, why: "dead", frames: i };
        if (i - lastClear > 120) { clearArea(55, 300); lastClear = i; lx = G.player.x; ly = G.player.y; stuck = 0; }
        const dx = wp.x - p.x, dy = wp.y - p.y, adx = Math.abs(dx), ady = Math.abs(dy);
        if (adx < 10 && ady < 10) { clearMove(); return { ok: true, frames: i }; }
        const hx = dx > 0 ? "KeyD" : "KeyA", hy = dy > 0 ? "KeyS" : "KeyW";
        let X = null, Y = null;
        if (adx >= ady) { X = adx > 4 ? hx : null; Y = ady > 24 ? hy : null; }
        else { Y = ady > 4 ? hy : null; X = adx > 24 ? hx : null; }
        setKey("KeyD", X === "KeyD"); setKey("KeyA", X === "KeyA");
        setKey("KeyS", Y === "KeyS"); setKey("KeyW", Y === "KeyW");
        T.step(4);
        const md = Math.hypot(G.player.x - lx, G.player.y - ly);
        if (md < 1.5) stuck++; else stuck = 0;
        lx = G.player.x; ly = G.player.y;
        if (stuck > 15) {
          const perp = adx >= ady ? (dy >= 0 ? "KeyS" : "KeyW") : (dx >= 0 ? "KeyD" : "KeyA");
          setKey(perp, true); T.step(6); setKey(perp, false); stuck = 0;
        }
      }
      return { ok: false, why: "timeout:" + label, frames: maxFrames };
    }

    const go = (tx, ty, label) => {
      const r = moveTo(W(tx, ty), label);
      ev(`go ${label}(${tx},${ty}) ${r.ok ? "ok" : r.why}`);
      return r;
    };

    // Closest watcher within maxD with suspicion >= minS.
    const nearThreat = (maxD, minS) => {
      let best = null, bd = 1e9;
      for (const w of watchers()) {
        const d = distW(w), s = w.susp || 0;
        if (d <= maxD && s >= minS && d < bd) { bd = d; best = w; }
      }
      return best;
    };

    // Crouched walk toward obj until within range px.
    function approachObj(obj, range, maxFrames = 90) {
      const p = G.player;
      clearMove(); crouch(true);
      for (let i = 0; i < maxFrames; i++) {
        if (G.state !== "play" || p.dead) { clearMove(); return false; }
        const dx = obj.x - p.x, dy = obj.y - p.y, d = Math.hypot(dx, dy);
        if (d < range) { clearMove(); return true; }
        const nx = dx / d, ny = dy / d;
        setKey("KeyD", nx > 0.6); setKey("KeyA", nx < -0.6);
        setKey("KeyS", ny > 0.6); setKey("KeyW", ny < -0.6);
        T.step(3);
      }
      clearMove();
      return Math.hypot(obj.x - p.x, obj.y - p.y) < range + 10;
    }

    // Back away from the top watcher.
    function retreat() {
      const p = G.player;
      const w = topWatcher();
      clearMove(); crouch(true);
      if (!w) return;
      for (let i = 0; i < 24; i++) {
        if (G.state !== "play" || p.dead) break;
        if (Math.hypot(w.x - p.x, w.y - p.y) > 150) break;
        const dx = p.x - w.x, dy = p.y - w.y, d = Math.hypot(dx, dy) || 1;
        setKey("KeyD", dx / d > 0.6); setKey("KeyA", dx / d < -0.6);
        setKey("KeyS", dy / d > 0.6); setKey("KeyW", dy / d < -0.6);
        T.step(4);
      }
      clearMove();
    }

    // ---- kill steps: EMP + takedown (guards) / 2x EMP (drones) near a zone ----
    const angD = (a, b) => { let d = Math.abs(a - b) % (Math.PI * 2); return d > Math.PI ? Math.PI * 2 - d; };
    const hostiles = () => [
      ...G.guards.filter(g => !g.dead).map(w => ({ w, kind: "guard" })),
      ...G.drones.filter(d => !d.dead).map(w => ({ w, kind: "drone" })),
    ];
    // Priority: chasing threats (anywhere) > zone members (by dist to zone center).
    function killTarget(cx, cy, r) { // cx, cy in TILES; r in px
      const p = G.player;
      const zx = cx * 32 + 16, zy = cy * 32 + 16;
      let best = null, bs = Infinity;
      for (const { w, kind } of hostiles()) {
        const chasing = w.state === "chase" || (w.susp || 0) >= 60;
        const dp = Math.hypot(w.x - p.x, w.y - p.y);
        const dh = Math.hypot(w.x - zx, w.y - zy);
        let s;
        if (chasing) s = dp;
        else if (dh <= r) s = 100000 + dh;
        else continue;
        if (s < bs) { bs = s; best = { w, kind, dp }; }
      }
      return best;
    }
    function walkToward(x, y, crouchDown) {
      const p = G.player;
      const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy) || 1;
      crouch(crouchDown);
      setKey("ShiftLeft", false);
      setKey("KeyD", dx / d > 0.5); setKey("KeyA", dx / d < -0.5);
      setKey("KeyS", dy / d > 0.5); setKey("KeyW", dy / d < -0.5);
    }
    function kill(cx, cy, r, label) {
      const pre = moveTo({ x: cx * 32 + 16, y: cy * 32 + 16 }, label + ".pre", 3000);
      if (!pre.ok) return { ok: false, why: pre.why };
      const p = G.player;
      const t0 = G.time;
      for (let i = 0; i < 3600; i++) {
        if (G.state !== "play") return { ok: G.state === "clear" || G.state === "win", state: G.state };
        if (p.dead) { clearMove(); return { ok: false, why: "dead" };
        }
        const t = killTarget(cx, cy, r);
        if (!t) { clearMove(); crouch(false); return { ok: true, t: (G.time - t0).toFixed(1) };
        }
        const { w, kind, dp } = t;
        const empReady = p.emp > 0 && G.empCd <= 0;
        if (kind === "guard") {
          if (w.stunned > 0) {
            if (dp < 28) { clearMove(); setKey("ShiftLeft", false); tap("Space"); T.step(8); }
            else { walkToward(w.x, w.y, false); setKey("ShiftLeft", true); T.step(4); } // sprint close: 2.6s stun window
          } else if (dp < 225) {
            if (empReady) { setKey("ShiftLeft", false); tap("KeyQ"); ev(`${label} EMP${kind} @${dp.toFixed(0)}`); T.step(35); }
            else if (dp < 34 && angD(w.angle, Math.atan2(p.y - w.y, p.x - w.x)) > 1.9) {
              clearMove(); tap("Space"); T.step(8); // sneak takedown while facing away
            } else { walkToward(w.x, w.y, true); T.step(3); }
          } else if (w.state === "chase" && !empReady) { retreat(); }
          else { walkToward(w.x, w.y, true); T.step(3); }
        } else { // drone: needs 2 EMP hits
          const stunned = w.stun > 0;
          if (dp < 230 && empReady) { setKey("ShiftLeft", false); tap("KeyQ"); ev(`${label} EMP${kind}${stunned ? "#2" : ""} @${dp.toFixed(0)}`); T.step(35); }
          else if (w.state === "chase" && !empReady) { retreat(); }
          else if (!(stunned && p.emp <= 0)) { walkToward(w.x, w.y, true); T.step(3); }
          else { /* last EMP spent, drone stunned: leave it */ clearMove(); crouch(false); return { ok: true, t: (G.time - t0).toFixed(1), note: "drone-stunned" }; }
        }
      }
      clearMove(); crouch(false);
      return { ok: false, why: "timeout", t: (G.time - t0).toFixed(1) };
    }

    // Channel obj (terminal/server, has x,y) standing near tile stand[x,y].
    function channel(label, test, obj, isServer, stand) {
      const p = G.player;
      clearMove(); crouch(true);
      const pre = clearArea(12, 900);
      ev(`${label} pre s=${(pre.s || 0).toFixed(0)}`);
      // Pre-EMP watchers that could spot this channel.
      for (let k = 0; k < 2; k++) {
        const w = nearThreat(300, 6) || (isServer ? nearThreat(210, 0) : null);
        if (!w || p.emp <= 0 || G.empCd > 0) break;
        tap("KeyQ"); ev(`${label} pre-EMP`); T.step(75);
      }
      approachObj(obj, isServer ? 38 : 34, 90);
      T.act("press", { code: "KeyE" }); held.add("KeyE");
      let had = false, drops = 0, noCh = 0;
      const maxF = isServer ? 1500 : 700;
      for (let i = 0; i < maxF; i++) {
        if (G.state !== "play") { setKey("KeyE", false); return { ok: false, why: "state:" + G.state }; }
        if (p.dead) { setKey("KeyE", false); return { ok: false, why: "dead" }; }
        if (test()) { setKey("KeyE", false); return { ok: true, frames: i }; }
        if (p.channel) {
          had = true; drops = 0; noCh = 0;
          if (i % 15 === 0) {
            const w = nearThreat(280, 40);
            if (w && p.emp > 0 && G.empCd <= 0) { tap("KeyQ"); ev(`${label} EMP mid`); }
            else if (w && p.emp <= 0 && p.smoke > 0 && (w.susp || 0) > 55) { tap("KeyF"); ev(`${label} SMOKE mid`); }
          }
          if (i % 120 === 60) {
            clearArea(70, 120);
            if (p.dead) { setKey("KeyE", false); return { ok: false, why: "dead" }; }
          }
        } else if (had) {
          // Channel was interrupted (damage) — back off, clear, re-engage.
          setKey("KeyE", false);
          if (++drops > 90) {
            ev(`${label} dropped, retreat`);
            retreat();
            if (p.dead) return { ok: false, why: "dead" };
            clearArea(30, 900);
            moveTo(W(stand[0], stand[1]), label + "-back");
            approachObj(obj, isServer ? 38 : 34, 90);
            T.act("press", { code: "KeyE" }); held.add("KeyE");
            had = false; drops = 0;
          }
        } else {
          noCh++;
          if (noCh === 45) { setKey("KeyE", false); tap("KeyE"); }
          else if (noCh > 120) { setKey("KeyE", false); return { ok: false, why: "no-channel" }; }
        }
        T.step(1);
      }
      setKey("KeyE", false);
      return { ok: false, why: "timeout-channel" };
    }

    function doExit(tx, ty, label) {
      const r = go(tx, ty, label);
      if (!r.ok) return r;
      for (let i = 0; i < 900; i++) {
        if (G.state !== "play") return { ok: true, state: G.state };
        if (G.player.dead) return { ok: false, why: "dead" };
        T.step(2);
      }
      return { ok: false, why: "timeout-exit" };
    }

    function runLevel(li) {
      const shards0 = G.shards, t0 = G.time;
      crouch(true);
      let fail = null, lastStand = null;
      for (const step of PLANS[li].steps) {
        if (fail) break;
        if (G.state !== "play") { fail = { why: "state:" + G.state }; break; }
        if (G.player.dead) { fail = { why: "dead" }; break; }
        if (step.k) {
          const kr = kill(step.k[0], step.k[1], step.r, step.label);
          ev(`kill ${step.label} ${kr.ok ? "ok " + kr.t + "s" + (kr.note ? " (" + kr.note + ")" : "") : kr.why}`);
          results.kills.push({ label: step.label, ok: !!kr.ok, why: kr.why || null });
          continue; // kill steps are best-effort; smoke/EMP layered defenses back them up
        }
        if (step.g) {
          const r = go(step.g[0], step.g[1], step.label);
          if (r.ok) lastStand = step.g;
          if (!r.ok) fail = r;
        } else if (step.c) {
          const isServer = step.c === "s";
          const sx = (step.t ? step.t[0] * 32 + 16 : 0), sy = (step.t ? step.t[1] * 32 + 16 : 0);
          const obj = isServer ? G.lvl.server : G.lvl.terminals.find(t => !t.done && Math.abs(t.x - sx) < 4 && Math.abs(t.y - sy) < 4);
          const test = () => isServer ? G.objectiveDone : (obj ? obj.done : false);
          const stand = lastStand || [0, 0];
          for (let a = 0; a < 3 && !fail; a++) {
            if (!obj) { fail = { why: "no-obj" }; break; }
            const r = channel(step.label, test, obj, isServer, stand);
            if (r.ok) { ev(`${step.label} OK`); break; }
            ev(`${step.label} ${r.why} (att ${a + 1})`);
            if (r.why === "timeout-channel" || r.why === "no-channel") go(stand[0], stand[1], step.label + "-re");
            else { fail = r; break; }
          }
          if (!fail && isServer && !G.objectiveDone) fail = { why: "server-not-done" };
          if (!fail && !isServer && obj && !obj.done) ev(`${step.label} skipped`);
        } else if (step.x) {
          const r = doExit(step.x[0], step.x[1], step.label);
          if (!r.ok) fail = r;
        }
      }
      const cleared = G.state === "clear" || G.state === "win";
      return {
        level: li + 1,
        ok: cleared,
        why: cleared ? undefined : (fail ? fail.why : G.player.dead ? "dead" : "unfinished"),
        shards: G.shards - shards0,
        time: +(G.time - t0).toFixed(1),
      };
    }

    // ---- top level driver ----
    T.reset(seed);
    ev("reset " + seed);
    tap("Enter"); T.step(10);
    ev("state=" + G.state);
    for (let li = 0; li < 3; li++) {
      if (G.state !== "play") { ev("expected play, got " + G.state); break; }
      ev(`=== L${li + 1} start ===`);
      const r = runLevel(li);
      results.levels.push(r);
      ev(`=== L${li + 1} ${r.ok ? "CLEAR" : "FAIL:" + r.why} shards+${r.shards} t=${r.time}s ===`);
      if (!r.ok) { results.died = G.player.dead ? li + 1 : null; break; }
      if (G.state === "win") break;
      tap("Enter"); T.step(15);
      ev("advanced, state=" + G.state);
    }
    const s = T.snapshot();
    results.ok = G.state === "win";
    results.final = { state: s.state, level: s.level, score: s.score, shards: s.shards, time: +s.time.toFixed(1) };
    return results;
  }

  window.botv2 = {
    start(seed = 20240131) {
      if (st.running) return false;
      st = { running: true, done: false, result: null, log: [] };
      setTimeout(() => {
        try { st.result = doRun(seed); st.phase = "finished"; }
        catch (e) { st.result = { ok: false, error: String(e && e.stack || e) }; st.phase = "error"; }
        st.running = false; st.done = true;
      }, 0);
      return true;
    },
    get: () => ({ running: st.running, done: st.done, phase: st.phase, ok: st.result && st.result.ok, logLen: st.log.length, last: st.log.slice(-6) }),
    stop() { st._abort = true; },
    report() { return { ...st, last: undefined, log: st.log.slice(-40) }; },
  };
  return "botv2 loaded";
})();
