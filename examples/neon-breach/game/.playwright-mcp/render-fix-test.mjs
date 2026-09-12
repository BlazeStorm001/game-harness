async (page) => {
  const out = {};
  const withCam = (body) => `(() => {
    const g = window.__game;
    const cv = document.querySelector("canvas");
    const c = cv.getContext("2d");
    const W = cv.width, H = cv.height, T = 32;
    const p = g.player;
    let ox = W / 2 - p.x, oy = H / 2 - p.y;
    if (g.lvl.w * T < W) ox = (W - g.lvl.w * T) / 2;
    else ox = Math.max(W - g.lvl.w * T - 20, Math.min(20, ox));
    if (g.lvl.h * T < H) oy = (H - g.lvl.h * T) / 2;
    else oy = Math.max(H - g.lvl.h * T - 20, Math.min(20, oy));
    return (() => { ${body} })();
  })()`;

  out.loaded = await page.evaluate(() => ({ title: document.title, state: window.__game.state }));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);

  // 1) player visible at camera-adjusted spawn screen pos (~100,500)
  out.spawn = await page.evaluate(withCam(`
    const p = g.player;
    const sx = Math.round(p.x + ox), sy = Math.round(p.y + oy);
    const d = c.getImageData(0, 0, W, H).data;
    let lit = 0;
    for (let y = sy - 26; y < sy + 18; y++) for (let x = sx - 20; x < sx + 20; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 4;
      const b = (d[i] + d[i + 1] + d[i + 2]) / 3;
      if (b > 55 || (d[i + 1] > 120 && d[i + 2] > 120)) lit++;
    }
    return { player: [Math.round(p.x), Math.round(p.y)], screen: [sx, sy], litPx: lit };
  `));

  // 2) teleport player to (480,400) => camera (0,-100)
  await page.evaluate(() => { const g = window.__game; g.player.x = 480; g.player.y = 400; });
  await page.waitForTimeout(200);

  // 3) guards render at world+camera, NOT at raw world coords
  out.guards = await page.evaluate(withCam(`
    const d = c.getImageData(0, 0, W, H).data;
    const scan = (x, y, hw, hh) => {
      let n = 0;
      for (let yy = y - hh; yy < y + hh; yy++) for (let xx = x - hw; xx < x + hw; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const i = (yy * W + xx) * 4;
        if (d[i] > 170 && d[i + 1] < 100 && d[i + 2] < 130) n++;
      }
      return n;
    };
    const res = [];
    for (const gd of g.guards) {
      const sx = gd.x + ox, sy = gd.y + oy;
      if (sx < 10 || sy < 10 || sx > W - 10 || sy > H - 10) {
        res.push({ guard: [Math.round(gd.x), Math.round(gd.y)], offscreen: true }); continue;
      }
      res.push({
        guard: [Math.round(gd.x), Math.round(gd.y)],
        screen: [Math.round(sx), Math.round(sy)],
        redAtScreen: scan(Math.round(sx), Math.round(sy), 26, 30),
        redAtRawWorld: scan(Math.round(gd.x), Math.round(gd.y), 26, 30),
      });
    }
    return { guards: res };
  `));

  // 4) particles render at camera-adjusted position
  await page.evaluate(() => { window.__game.particles.burst(300, 550, "#ffffff", 60, 40, 1.4, 5); });
  await page.waitForTimeout(120);
  out.particles = await page.evaluate(withCam(`
    const sx = 300 + ox, sy = 550 + oy;
    const d = c.getImageData(0, 0, W, H).data;
    let white = 0;
    for (let y = Math.max(0, sy - 34); y < Math.min(H, sy + 34); y++)
      for (let x = Math.max(0, sx - 34); x < Math.min(W, sx + 34); x++) {
        const i = (y * W + x) * 4;
        if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) white++;
      }
    return { screen: [Math.round(sx), Math.round(sy)], whitePx: white };
  `));

  // 5) force a guard shot; bullets must render at camera-adjusted positions
  out.forced = await page.evaluate(() => {
    const g = window.__game;
    const p = g.player;
    const gd = g.guards[0];
    gd.state = "chase"; gd.alerted = true; gd.shootCd = 0;
    gd.x = p.x - 90; gd.y = p.y; gd.angle = 0;
    gd.lastSeen = { x: p.x, y: p.y };
    return { placed: [Math.round(gd.x), Math.round(gd.y)] };
  });
  await page.waitForTimeout(2200);
  out.bullets = await page.evaluate(withCam(`
    const d = c.getImageData(0, 0, W, H).data;
    const res = [];
    for (const b of g.bullets) {
      const sx = b.x + ox, sy = b.y + oy;
      if (sx < 5 || sy < 5 || sx > W - 5 || sy > H - 5) continue;
      let hit = 0;
      for (let yy = sy - 8; yy < sy + 8; yy++) for (let xx = sx - 8; xx < sx + 8; xx++) {
        const i = (yy * W + xx) * 4;
        const r = d[i], gg = d[i + 1], bb = d[i + 2];
        if ((r > 170 && gg < 110 && bb < 130) || (r > 200 && gg > 150 && bb < 130)) hit++;
      }
      res.push({ world: [Math.round(b.x), Math.round(b.y)], screen: [Math.round(sx), Math.round(sy)], litPx: hit, from: b.from });
    }
    return { count: g.bullets.length, list: res.slice(0, 4), playerHp: Math.round(g.player.hp) };
  `));

  return out;
}
