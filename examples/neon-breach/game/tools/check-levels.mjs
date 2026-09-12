// CLI: validate all level maps (length, bounds, census, reachability).
import { LEVELS, validateAll, parseLevel } from "../js/levels.js";

let fail = 0;
for (let i = 0; i < LEVELS.length; i++) {
  const def = LEVELS[i];
  const errs = validateAll().filter(b => b.level === i)[0];
  if (errs && errs.errs.length) {
    fail = 1;
    console.error(`LEVEL ${i + 1} (${def.name}): ${errs.errs.length} error(s)`);
    for (const e of errs.errs) console.error("  -", e);
  } else {
    const lvl = parseLevel(def);
    console.log(
      `LEVEL ${i + 1} OK  ${def.name}  ${lvl.w}x${lvl.h}  ` +
      `T:${lvl.terminals.length} doors:${lvl.doors.length} ` +
      `guards:${lvl.guards.length} cams:${lvl.cameras.length} drones:${lvl.drones.length} ` +
      `keycards:${lvl.keycards.length}`
    );
  }
}
process.exit(fail);
