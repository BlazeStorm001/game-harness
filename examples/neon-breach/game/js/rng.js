// Deterministic PRNG (mulberry32) for gameplay-affecting randomness.
// The game loop is otherwise fully deterministic for a fixed dt, so routing
// these draws through one seeded stream makes reset(seed) + step(n) reproducible.
// Purely visual randomness (particles, screen shake) intentionally keeps
// using Math.random so production look is unaffected.
let s = 0x9e3779b9;

export function seed(n) {
  s = (n >>> 0) || 1;
}

export function rng() {
  s = (s + 0x6d2b79f5) | 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
