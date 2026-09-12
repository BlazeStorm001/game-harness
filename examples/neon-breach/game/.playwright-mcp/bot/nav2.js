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
      last = { x: p.x, y: p.y };
      stuck = moved < 1.5 ? stuck + 4 : 0;
      if (stuck > 60) { clearMove(); return { ok: false, why: "stuck at " + p.x.toFixed(0) + "," + p.y.toFixed(0) }; }
      if (stuck > 15) { const pk = adx >= ady ? "KeyW" : "KeyA"; setKey(pk, true); T.step(6); setKey(pk, false); stuck = 0; }
      if (i % 120 < 4) clearArea(55, 300);
    }
    clearMove();
    return { ok: false, why: "timeout" };
  };
