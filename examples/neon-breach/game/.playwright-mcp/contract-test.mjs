// __gameTest contract verification (run via run_code_unsafe filename)
async (page) => {
  return await page.evaluate(async () => {
    const gt = window.__gameTest;
    const out = { ok: true, errors: [] };
    const j = (k, v) => { out[k] = v; };
    const fail = (m) => { out.ok = false; out.errors.push(m); };

    j("hasApi", !!(gt && gt.reset && gt.actions && gt.act && gt.step && gt.snapshot));
    if (!gt) return out;

    j("actions", gt.actions());

    // 1) reset -> menu
    const a = gt.reset(42);
    j("afterReset", { state: a.state, level: a.level, time: a.time, player: a.player });
    if (a.state !== "menu") fail("reset state != menu");

    // 2) start -> play
    const r1 = gt.act("start");
    const s1 = gt.step(60);
    if (s1) fail("step(60): " + s1.error);
    const b = gt.snapshot();
    j("afterStart", { state: b.state, t: b.time, p: b.player && [b.player.x, b.player.y], guards: b.guards.length, drones: b.drones.length });
    if (b.state !== "play") fail("start state != play");
    if (b.time !== 1) fail("time != 1 after 60 steps @1/60 (got " + b.time + ")");

    // 3) movement: hold D 90 steps
    gt.act("press", { code: "KeyD" });
    const m1 = gt.step(90); if (m1) fail("step move: " + m1.error);
    const m = gt.snapshot();
    gt.act("release", { code: "KeyD" });
    const m2 = gt.step(30); if (m2) fail("step release: " + m2.error);
    const m2s = gt.snapshot();
    j("moveD", { from: b.player.x, to: m.player.x, after30more: m2s.player.x });
    if (m.player.x <= b.player.x + 50) fail("player did not move east (d=" + (m.player.x - b.player.x) + ")");

    // 4) determinism: repeat the whole sequence, compare
    const runA = JSON.stringify(m2s);
    gt.reset(42);
    gt.act("start");
    const z1 = gt.step(60); if (z1) fail("det step: " + z1.error);
    gt.act("press", { code: "KeyD" });
    const z2 = gt.step(90); if (z2) fail("det step2: " + z2.error);
    gt.act("release", { code: "KeyD" });
    const z3 = gt.step(30); if (z3) fail("det step3: " + z3.error);
    const runB = JSON.stringify(gt.snapshot());
    j("determinism", runA === runB);
    if (runA !== runB) fail("runs diverged");

    // 5) pause
    const pz = gt.act("pause");
    const pp = gt.step(60); if (pp) fail("pause step: " + pp.error);
    const ps = gt.snapshot();
    j("pause", { state: ps.state, t: ps.time });
    if (ps.state !== "pause") fail("pause state");
    gt.act("pause");
    const pz2 = gt.step(1); if (pz2) fail("unpause step: " + pz2.error);
    if (gt.snapshot().state !== "play") fail("unpause state");

    // 6) death: damage player to 0, expect deadT countdown (0.7s = 42 frames) -> state dead
    const g = window.__game;
    g.player.hp = 1;
    g.damagePlayer(5);
    j("deadFlag", g.player.dead === true);
    const d1 = gt.step(20); if (d1) fail("death step: " + d1.error);
    const d1s = gt.snapshot();
    const d2 = gt.step(30); if (d2) fail("death step2: " + d2.error);
    const d2s = gt.snapshot();
    j("death", { t20: d1s.state, t50: d2s.state, hp: d2s.player && d2s.player.hp });
    if (d1s.state === "dead") fail("dead state too early");
    if (d2s.state !== "dead") fail("never reached dead state (got " + d2s.state + ")");

    // 7) retry from death screen
    gt.act("start");
    const rt = gt.step(1); if (rt) fail("retry step: " + rt.error);
    const rs = gt.snapshot();
    j("retry", { state: rs.state, level: rs.level, t: rs.time, hp: rs.player && rs.player.hp });
    if (rs.state !== "play") fail("retry state");

    return out;
  });
}
