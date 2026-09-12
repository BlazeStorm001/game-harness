window.__botnav =
() => {
  const B = window.__bot, { T, G, ev, MOVE, held, setKey, clearMove, defend } = B;
  const moveTo = (wp, label, maxFrames = 2400) => {
    const p = G.player;
    let stuck = 0, last = { x: p.x, y: p.y };
    for (let i = 0; i < maxFrames; i++) {
      if (G.state !== "play") { clearMove(); return { ok: false, why: "state=" + G.state }; }
      const dx = wp.x - p.x, dy = wp.y - p.y;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) { clearMove(); return { ok: true, frames: i }; }
      const adx = Math.abs(dx), ady = Math.abs(dy), keys = [];
      if (adx >= ady) { if (adx > 4) keys.push(dx > 0 ? "KeyD" : "KeyA"); if (ady > 24) keys.push(dy > 0 ? "KeyS" : "KeyW"); }
      else { if (ady > 4) keys.push(dy > 0 ? "KeyS" : "KeyW"); if (adx > 24) keys.push(dx > 0 ? "KeyD" : "KeyA"); }
      for (const k of MOVE) setKey(k, keys.includes(k));
      T.step(4);
      const moved = Math.hypot(p.x - last.x, p.y - last.y);
      if (i % 20 === 0) last = { x: p.x, y: p.y };
      if (moved < 1.5 && adx + ady > 30) stuck++; else stuck = 0;
      if (stuck > 15) {
        const per = adx >= ady ? (dy > 0 ? "KeyS" : "KeyW") : (dx > 0 ? "KeyD" : "KeyA");
        setKey(per, true); T.step(6); setKey(per, false);
      }
      if (stuck > 60) { clearMove(); return { ok: false, why: `stuck at (${p.x.toFixed(0)},${p.y.toFixed(0)}) toward ${label}` }; }
      if (i % 120 < 4) defend();
    }
    clearMove();
    return { ok: false, why: `timeout at ${label}` };
  };
  const channel = (test, label, maxFrames = 1500) => {
    T.act('press', { code: 'KeyE' });
    for (let i = 0; i < maxFrames; i++) {
      if (test()) { T.act('release', { code: 'KeyE' }); return { ok: true, frames: i }; }
      if (G.state !== "play") { T.act('release', { code: 'KeyE' }); return { ok: false, why: "state=" + G.state }; }
      T.step(1);
      if (i % 90 === 0) defend();
    }
    T.act('release', { code: 'KeyE' });
    return { ok: false, why: `channel timeout ${label}` };
  };
  const go = (tx, ty, label, maxFrames) => {
    const r = moveTo(B.W(tx, ty), label, maxFrames);
    ev(`${r.ok ? 'reach' : 'FAIL ' + r.why} ${label} (${tx},${ty})`);
    return r.ok;
  };
  window.__bot.moveTo = moveTo;
  window.__bot.channel = channel;
  window.__bot.go = go;
  return 'bot-nav installed';
}
