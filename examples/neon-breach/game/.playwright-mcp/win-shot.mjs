async (page) => {
  const r = await page.evaluate(() => {
    const gt = window.__gameTest, g = window.__game;
    const a = gt.act("start");
    gt.step(90);
    const l3 = { level: g.lvl.name, idx: g.levelIdx, state: g.state, drones: g.lvl.drones.length };
    g.clearLevel();
    gt.step(2); // render win state
    return { a, l3, win: { state: g.state, score: g.score, shards: g.shards } };
  });
  await page.screenshot({ path: "win-screen.png" });
  return r;
}
