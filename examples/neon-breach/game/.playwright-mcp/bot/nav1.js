window.__botnav =
() => {
  const B = window.__bot, { T, G, ev, MOVE, held, setKey, clearMove, crouch } = B;
  const maxSusp = () => [...G.guards, ...G.cameras, ...G.drones].reduce((m, w) => Math.max(m, w.susp || 0), 0);
  const clearArea = (thresh, maxFrames = 1200) => {
    const p = G.player;
    for (let i = 0; i < maxFrames; i++) {
      if (G.state !== "play") return { ok: false, why: "state=" + G.state };
      const s = maxSusp();
      if (s < thresh) return { ok: true };
      if (s > 70) {
        if (p.emp > 0) { T.act('tap', { code: 'KeyQ' }); ev(`EMP(susp=${s.toFixed(0)})`); }
        else if (p.smoke > 0) { T.act('tap', { code: 'KeyF' }); ev(`SMK(susp=${s.toFixed(0)})`); }
      } else { T.step(6); }
    }
    return { ok: false, why: `clearArea timeout s=${maxSusp().toFixed(0)}` };
  };
