// NEON BREACH — global tuning constants
export const CFG = {
  TILE: 32,
  SCALE: 3, // pixel sprite scale

  // player
  player: {
    radius: 9,
    walkSpeed: 148,
    runSpeed: 242,
    crouchSpeed: 74,
    maxHp: 100,
    regenDelay: 4.0,
    regenRate: 7,
    takedownRange: 38,
    takedownCooldown: 0.85,
    takedownStun: 5.0,
    noiseWalk: 130,
    noiseRun: 300,
    noiseCrouch: 55,
    startEmp: 3,
    startSmoke: 2,
  },

  // detection
  detect: {
    guardRange: 300,
    guardFov: 74 * Math.PI / 180,
    baseRate: 72,        // suspicion/sec at point blank, walking
    cameraRange: 270,
    cameraFov: 66 * Math.PI / 180,
    cameraRate: 95,
    droneRange: 260,
    droneFov: 80 * Math.PI / 180,
    droneRate: 85,
    crouchFactor: 0.42,
    runFactor: 1.65,
    suspiciousAt: 45,    // guard turns toward you ("?")
  },

  // guards
  guard: {
    radius: 9,
    patrolSpeed: 72,
    searchSpeed: 118,
    chaseSpeed: 172,
    shootRange: 330,
    shootInterval: 0.85,
    bulletDamage: 14,
    bulletSpeed: 430,
    hearNoise: 320,
    hp: 1, // one takedown
  },

  drone: {
    radius: 8,
    patrolSpeed: 52,
    chaseSpeed: 128,
    shootRange: 300,
    shootInterval: 1.5,
    bulletDamage: 9,
    bulletSpeed: 320,
    hp: 2,
  },

  // gadgets
  emp: {
    radius: 235,
    camStun: 4.5,
    guardStun: 2.6,
    cooldown: 1.2,
  },
  smoke: {
    radius: 66,
    life: 8.0,
  },

  // world
  downloadTime: 5.0,   // server exfiltration channel
  extractTime: 1.3,    // terminal shard extract channel
  alarmTime: 180,      // survival timer pressure after alert (cosmetic scoring)
};

export const COLORS = {
  bg: "#04060f",
  floor: "#0a0f1e",
  floorLine: "#0e1526",
  wall: "#111a2e",
  wallHi: "#1c2a45",
  wallLo: "#0a1120",
  neonCyan: "#21e6ff",
  neonCyanDim: "#0e7d95",
  neonMagenta: "#ff2e63",
  neonYellow: "#ffc233",
  neonGreen: "#3dff9a",
  guard: "#ff3355",
  player: "#2ff3ff",
  cone: "rgba(255,45,95,",
  hud: "#9fd8ff",
};

export const RANKS = [
  { min: 2700, name: "S", color: "#3dff9a", title: "GHOST PROTOCOL" },
  { min: 2000, name: "A", color: "#21e6ff", title: "CLEAN BREACH" },
  { min: 1300, name: "B", color: "#ffc233", title: "SLOPPY RUN" },
  { min: 0, name: "C", color: "#ff2e63", title: "ROUGH NIGHT" },
];

export function rankFor(score) {
  for (const r of RANKS) if (score >= r.min) return r;
  return RANKS[RANKS.length - 1];
}
