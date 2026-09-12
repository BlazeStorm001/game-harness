// NEON BREACH — zero-dependency release smoke test.
//
//   npm test                 -> static checks (always available)
//   E2E_BROWSER=1 npm test   -> additionally drives a real browser via
//                               playwright (resolved from the repo, or from
//                               the eval harness's .harness if present).
//                               The game itself has zero runtime deps.

import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (m) => console.log("ok  " + m);
const bad = (m) => { failures++; console.error("FAIL " + m); };
const section = (t) => console.log("\n== " + t + " ==");

// ---------------------------------------------------------------- 1. syntax
section("syntax (node --check)");
for (const f of readdirSync(path.join(root, "js")).filter((f) => f.endsWith(".js")).sort()) {
  try {
    execFileSync(process.execPath, ["--check", path.join(root, "js", f)], { stdio: "pipe" });
    ok(f);
  } catch (e) {
    bad(f + " -> " + String(e.message || e).split("\n")[0]);
  }
}

// ---------------------------------------------------------------- 2. levels
section("levels (structure + reachability)");
const { LEVELS, validateAll } = await import(path.join(root, "js/levels.js"));
for (let i = 0; i < LEVELS.length; i++) {
  const rep = validateAll().find((b) => b.level === i);
  if (rep && rep.errs.length) bad(`level ${i + 1}: ${rep.errs.join("; ")}`);
  else ok(`level ${i + 1} ${LEVELS[i].name}`);
}

// ---------------------------------------------------------------- 3. sprites
section("sprites (uniform pixel maps + buildAll)");
globalThis.document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({
      shadowColor: "", shadowBlur: 0, fillStyle: "",
      fillRect() {}, translate() {}, scale() {}, drawImage() {},
    }),
  }),
};
const spriteSrc = readFileSync(path.join(root, "js/sprites.js"), "utf8");
const re = /const (\w+) = \[([\s\S]*?)\n\];/g;
let m, spriteCount = 0;
while ((m = re.exec(spriteSrc))) {
  const rows = [...m[2].matchAll(/"([^"]*)"/g)].map((r) => r[1]);
  if (!rows.length) continue;
  spriteCount++;
  const len = rows[0].length;
  if (rows.some((r) => r.length !== len)) bad(`sprite ${m[1]} has ragged rows`);
}
spriteCount ? ok(`${spriteCount} pixel maps uniform`) : bad("no sprite maps found");
const sprites = await import(path.join(root, "js/sprites.js"));
try {
  ok("buildAll() -> " + Object.keys(sprites.buildAll()).length + " sprites");
} catch (e) {
  bad("buildAll() threw: " + e.message);
}

// ---------------------------------------------------------------- 4. html refs
section("index.html (referenced files exist)");
const html = readFileSync(path.join(root, "index.html"), "utf8");
const refs = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|png|svg|webmanifest))"/g)].map((x) => x[1]);
refs.length ? ok(`${refs.length} references`) : bad("no asset references found in index.html");
for (const r of refs) {
  if (r.startsWith("data:")) continue;
  existsSync(path.join(root, r.split("?")[0])) ? ok(r) : bad(`missing file: ${r}`);
}

// ---------------------------------------------------------------- 5. config
section("config (sanity)");
const cfg = await import(path.join(root, "js/config.js"));
const C = cfg.CFG || cfg.default;
const missing = ["player.walkSpeed", "guard.patrolSpeed", "downloadTime", "extractTime"]
  .map((k) => (k.includes(".")
    ? C[k.split(".")[0]][k.split(".")[1]]
    : C[k]))
  .filter((v) => !(v > 0));
missing.length ? bad("missing/invalid: " + missing.join(", ")) : ok("core config values present");

// ---------------------------------------------------------------- 6. browser
section("browser (opt-in)");
if (!process.env.E2E_BROWSER) {
  ok("skipped (set E2E_BROWSER=1 to run with playwright)");
} else {
  try {
    const { homedir } = await import("node:os");
    const cands = [];
  if (process.env.E2E_PLAYWRIGHT) cands.push(process.env.E2E_PLAYWRIGHT);
  const npxDir = homedir() + "/.npm/_npx";
  if (existsSync(npxDir)) {
    for (const d of readdirSync(npxDir)) {
      const p = path.join(npxDir, d, "node_modules/playwright");
      if (existsSync(p)) cands.push(p);
    }
  }
  cands.push(path.join(root, ".harness/node_modules/playwright"));
  let chromium, lastErr;
  for (const c of cands) {
    const entry = /\.(js|mjs|cjs)$/.test(c) ? c : null;
    const dirs = entry ? [c] : [path.join(c, "index.mjs"), path.join(c, "index.js")];
    for (const file of dirs) {
      if (entry || existsSync(file)) {
        try {
          const probe = (await import(pathToFileURL(entry || file).href)).chromium;
          const b = await probe.launch();   // must find a browser binary
          await b.close();
          if (!chromium) chromium = probe;
          lastErr = null;
          break;
        } catch (e) { lastErr = e; }
      }
    }
    if (chromium) break;
  }
  if (!chromium) throw lastErr || new Error("no playwright candidate usable");
    const myPort = process.env.E2E_PORT || 8123;
    const server = spawn(process.execPath, [path.join(root, "scripts/serve.mjs")], {
      env: { ...process.env, PORT: String(myPort) }, stdio: "ignore",
    });
    await new Promise((r) => setTimeout(r, 900));
    const browser = await chromium.launch();
    const page = await browser.newPage();
    let base = `http://localhost:${myPort}`;
    try {
      await page.goto(base + "/index.html", { waitUntil: "load", timeout: 4000 });
    } catch {
      base = "http://localhost:8017";
      await page.goto(base + "/index.html", { waitUntil: "load", timeout: 4000 });
    }
    await page.waitForTimeout(800);
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    const state = await page.evaluate(() => window.__game && window.__game.state);
    state === "menu" ? ok("loads to menu") : bad(`game state after load: ${state}`);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(900);
    const st2 = await page.evaluate(() => window.__game.state);
    st2 === "play" ? ok("menu -> play on Enter") : bad(`state after Enter: ${st2}`);
    const real = errors.filter((e) => !/favicon/i.test(e));
    real.length ? bad("console/page errors: " + real.join(" | ")) : ok("no console errors");
    await browser.close();
  } catch (e) {
    bad("browser mode: " + String(e.message || e).split("\n")[0]);
  }
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
