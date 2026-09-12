window.__botl1 =
() => {
  const B = window.__bot, { T, G, ev, log, go, channel } = B;
  T.reset(11); T.act('start'); T.step(10);
  ev(`start: ${G.state}`);
  const fail = [];
  // L1: (2,23) start; key (3,3); T(17,2) stand (17,3); T(16,23) stand (16,24); door (24,5); S(31,6) stand (31,7); H(38,24)
  if (!go(2, 22, "a-spine-col")) fail.push("a");
  if (!go(3, 3, "keycard")) fail.push("key-move");
  T.step(30);
  const k = G.lvl.keycards[0];
  ev(`keycard taken=${k.taken} doors=${G.lvl.doors.map(d=>d.open)}`);
  if (!k.taken) fail.push("keycard-not-taken");
  if (!go(17, 3, "t1-stand")) fail.push("t1-move");
  let r = channel(() => G.lvl.terminals[0].done, "t1");
  ev(`t1: ${r.ok ? 'done' : r.why}`); if (!r.ok) fail.push("t1");
  if (!go(16, 24, "t2-stand")) fail.push("t2-move");
  r = channel(() => G.lvl.terminals[1].done, "t2");
  ev(`t2: ${r.ok ? 'done' : r.why}`); if (!r.ok) fail.push("t2");
  if (!go(23, 24, "cross-e")) fail.push("cross");
  if (!go(23, 5, "to-door")) fail.push("door-move");
  if (!go(25, 5, "through-door")) fail.push("door-pass");
  ev(`door=${G.lvl.doors[0].open} anim=${G.lvl.doors[0].anim.toFixed(2)}`);
  if (!go(31, 7, "server-stand")) fail.push("s-move");
  r = channel(() => G.objectiveDone, "server");
  ev(`server: ${r.ok ? 'objectiveDone' : r.why}`); if (!r.ok) fail.push("server");
  if (!go(39, 5, "east-rim")) fail.push("east");
  if (!go(39, 23, "south-rim")) fail.push("south");
  if (!go(38, 24, "exit")) fail.push("exit-move");
  let t = 0;
  while (G.state === "play" && t < 600) { T.step(2); t += 2; }
  ev(`after-exit: state=${G.state} levelIdx=${G.levelIdx} shards=${G.shards} score=${G.score} t=${G.time.toFixed(1)}`);
  if (G.state !== "clear" && G.state !== "win" && G.state !== "play") fail.push("exit-state=" + G.state);
  window.__l1fail = fail;
  return { state: G.state, levelIdx: G.levelIdx, shards: G.shards, score: G.score, time: +G.time.toFixed(1), fail, log };
}
