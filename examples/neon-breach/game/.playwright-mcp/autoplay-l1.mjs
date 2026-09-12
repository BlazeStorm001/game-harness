// NEON BREACH — Level 1 autoplay driver (playwright page handle passed in)
async (page) => {
  const out = [];
  const s = () => page.evaluate('__s()');
  const threat = st => {
    if (st.G.some(g => { const m = g.match(/^(\D)(\d+)@(\d+)$/); return m && (m[1] === 'c' || (m[1] === 's' && +m[2] >= 40 && +m[3] < 300)); })) return true;
    if (st.D.some(d => { const m = d.match(/^(\D)@(\d+)$/); return m && m[1] === 'c'; })) return true;
    if (st.C.some(c => { const m = c.match(/^(\d+)@(\d+)$/); return m && +m[1] >= 40; })) return true;
    return false;
  };
  const deemp = async st => { if (st.e > 0) await page.keyboard.press('KeyQ'); await page.waitForTimeout(1000); };
  const hold = async (key, done, maxMs, label) => {
    await page.keyboard.down(key);
    const t0 = Date.now(); let last = null, stuck = 0;
    while (Date.now() - t0 < maxMs) {
      await page.waitForTimeout(500);
      const st = JSON.parse(await s());
      if (st.st !== 'play') { await page.keyboard.up(key); return label + ':END ' + JSON.stringify(st); }
      if (threat(st)) { await page.keyboard.up(key); await deemp(st); return label + ':EMP ' + JSON.stringify(st); }
      if (done(st)) { await page.keyboard.up(key); return label + ':DONE ' + JSON.stringify(st); }
      if (last) { stuck = (last.p[0] === st.p[0] && last.p[1] === st.p[1]) ? stuck + 1 : 0; if (stuck >= 2) { await page.keyboard.up(key); return label + ':STUCK ' + JSON.stringify(st); } }
      last = st;
    }
    await page.keyboard.up(key);
    return label + ':TIMEOUT ' + JSON.parse(await s());
  };
  out.push(await hold('KeyW', st => st.key, 15000, 'N-key'));
  if (out[out.length - 1].includes(':EMP')) out.push(await hold('KeyW', st => st.key, 15000, 'N-key2'));
  out.push(await hold('KeyD', st => st.p[0] >= 980 && st.p[1] <= 252, 18000, 'E-core'));
  if (out[out.length - 1].includes(':STUCK')) out.push(await hold('KeyS', st => st.p[1] > 300, 6000, 'S-adj') + ' || ' + await hold('KeyD', st => st.p[0] >= 980 && st.p[1] <= 252, 16000, 'E-core2'));
  let tail = out[out.length - 1];
  if (tail.includes(':DONE')) {
    await page.keyboard.down('KeyE');
    const t0 = Date.now();
    while (Date.now() - t0 < 16000) {
      await page.waitForTimeout(500);
      const st = JSON.parse(await s());
      if (st.st !== 'play') break;
      if (st.obj) break;
      if (threat(st)) { await page.keyboard.up('KeyE'); await deemp(st); await page.keyboard.down('KeyE'); }
    }
    await page.keyboard.up('KeyE');
    out.push('HOLD-E ' + JSON.stringify(JSON.parse(await s())));
  }
  out.push(await hold('KeyW', st => st.p[1] <= 150, 8000, 'N-door'));
  out.push(await hold('KeyA', st => st.p[0] <= 740, 18000, 'W-mid'));
  if (/STUCK|TIMEOUT/.test(out[out.length - 1])) out.push(await hold('KeyS', st => st.p[1] > 300, 6000, 'S-adj2') + ' || ' + await hold('KeyA', st => st.p[0] <= 740, 14000, 'W-mid2'));
  out.push(await hold('KeyS', st => st.p[1] >= 456, 16000, 'S-gap'));
  out.push(await hold('KeyD', st => st.p[0] >= 1180, 18000, 'E-se'));
  out.push(await hold('KeyS', st => st.p[1] >= 744, 14000, 'S-se'));
  out.push(await hold('KeyD', st => st.p[0] >= 1204 && st.p[1] >= 758, 10000, 'E-exit'));
  return out.join('\n');
}
