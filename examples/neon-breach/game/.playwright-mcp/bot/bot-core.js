window.__botcore =
() => {
  const T = window.__gameTest, G = window.__game;
  const log = [];
  const ev = s => log.push(`[${G.time.toFixed(1)}] ${s}`);
  const W = (tx, ty) => ({ x: tx * 32 + 16, y: ty * 32 + 16 });
  const MOVE = new Set(["KeyW","KeyA","KeyS","KeyD"]);
  const held = new Set();
  const setKey = (c, d) => {
    if (d && !held.has(c)) { T.act('press', { code: c }); held.add(c); }
    if (!d && held.has(c)) { T.act('release', { code: c }); held.delete(c); }
  };
  const clearMove = () => { for (const c of [...held]) if (MOVE.has(c)) setKey(c, false); };
  const crouch = (d) => setKey("ControlLeft", d);
  window.__bot = { T, G, log, ev, W, MOVE, held, setKey, clearMove, crouch };
  return 'bot-core v2';
};
