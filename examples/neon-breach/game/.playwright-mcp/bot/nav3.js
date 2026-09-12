const channel = (test, label, maxFrames = 1500) => {
    const p = G.player;
    T.act('press', { code: 'KeyE' });
    let started = false;
    for (let i = 0; i < maxFrames; i++) {
      if (G.state !== "play") { T.act('release', { code: 'KeyE' }); return { ok: false, why: "state=" + G.state }; }
      if (p.channel) {
        if (!started) { started = true; ev("ch-start " + label); }
        if (test()) { T.act('release', { code: 'KeyE' }); return { ok: true, frames: i }; }
      }
      T.step(1);
      if (i % 90 === 0) clearArea(75, 240);
    }
    T.act('release', { code: 'KeyE' });
    return { ok: false, why: "timeout" };
  };
  const go = (tx, ty, label, maxFrames) => {
    const r = moveTo(B.W(tx, ty), label, maxFrames);
    ev((r.ok ? "reach " : "FAIL ") + label + (r.why ? " " + r.why : ""));
    return r;
  };
  Object.assign(B, { moveTo, channel, go, clearArea });
  return "bot-nav v2";
};
