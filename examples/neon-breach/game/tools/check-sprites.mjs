// Validate that every pixel map in js/sprites.js has uniform row lengths.
// Stubs a minimal DOM so the module can be imported in node.
function makeFakeCanvas() {
  return {
    width: 0, height: 0,
    getContext: () => ({
      shadowColor: "", shadowBlur: 0, fillStyle: "",
      fillRect() {}, translate() {}, scale() {}, drawImage() {},
    }),
  };
}
globalThis.document = { createElement: () => makeFakeCanvas() };

const src = await import("../js/sprites.js");

// Re-read the raw file to inspect the literal arrays by name.
import { readFileSync } from "node:fs";
const file = readFileSync(new URL("../js/sprites.js", import.meta.url), "utf8");

// grab all named array literals:  const NAME = [ ... ];
const re = /const (\w+) = \[([\s\S]*?)\n\];/g;
let m, bad = 0;
while ((m = re.exec(file))) {
  const name = m[1];
  const body = m[2];
  const rows = [...body.matchAll(/"([^"]*)"/g)].map((r) => r[1]);
  if (!rows.length) continue;
  const len = rows[0].length;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].length !== len) {
      console.log(`BAD ${name} row ${i}: len ${rows[i].length} (expected ${len}) -> "${rows[i]}"`);
      bad++;
    }
  }
  if (bad < 5) {
    // unknown palette chars are fine (transparent), but log the size
  }
  if (process.env.VERBOSE) console.log(`ok ${name} ${rows.length}x${len}`);
}
if (bad === 0) console.log("All sprite maps have uniform row lengths.");
else process.exit(1);

// also make sure buildAll() runs without throwing
const all = src.buildAll();
console.log("buildAll ok:", Object.keys(all).join(", "));
