/* NEON BREACH - level definitions (declarative, parsed into grid + entities) */
(function () {
  'use strict';
  var W = typeof window !== 'undefined' ? window : {};
  var LEVELS = [
    {
      id: 1,
      name: 'INTAKE',
      w: 60, h: 36,
      par: 90,
      floors: [
        [2, 24, 13, 33],  /* A spawn room */
        [2, 10, 25, 22],  /* B main hall */
        [18, 2, 34, 8],   /* C top room */
        [30, 2, 56, 14],  /* D east wing */
        [42, 15, 46, 16], /* F laser corridor */
        [34, 17, 56, 32]  /* E vault */
      ],
      carves: [
        [20, 9, 21, 9],   /* B<->C gap (door at 20,9) */
        [8, 23, 8, 23],   /* A<->B gap (door at 8,23) */
        [26, 12, 29, 13]  /* B<->D corridor (full width of wall band) */
      ],
      spawn: [4, 29],
      terminals: [[6, 12], [30, 4], [48, 24]],
      exit: [54, 3],
      crates: [[10, 27], [16, 17], [17, 17], [40, 10], [41, 10], [46, 26], [44, 28]],
      guards: [
        { at: [16, 16], path: [[10, 14], [22, 14], [22, 20], [10, 20]] },
        { at: [45, 26], path: [[38, 21], [52, 22], [52, 30], [38, 30]] }
      ],
      drones: [
        { at: [41, 8], path: [[34, 4], [46, 4], [46, 12], [34, 12]] }
      ],
      lasers: [
        { a: [43, 14], b: [43, 17] },
        { a: [45, 14], b: [45, 17] }
      ],
      doors: [[20, 9], [8, 23]],
      reinforce: [[54, 12], [8, 22]]
    },
    {
      id: 2,
      name: 'SERVER VAULT',
      w: 60, h: 36,
      par: 130,
      floors: [
        [2, 2, 10, 8],     /* A entry */
        [2, 12, 27, 24],   /* B hall */
        [31, 2, 57, 17],   /* C tower */
        [31, 20, 57, 33],  /* E deep vault */
        [2, 28, 27, 33],   /* D lower */
        [28, 14, 30, 15],  /* B<->C corridor */
        [44, 18, 45, 19],  /* C<->E corridor */
        [14, 25, 15, 27]   /* B<->D corridor */
      ],
      carves: [
        [4, 9, 5, 11]      /* A<->B passage */
      ],
      spawn: [8, 3],
      terminals: [[9, 7], [14, 18], [54, 27]],
      exit: [2, 4],
      crates: [[10, 16], [11, 16], [22, 20], [40, 26], [42, 29], [46, 9], [47, 9]],
      guards: [
        { at: [16, 15], path: [[8, 15], [24, 15], [24, 22], [8, 22]] },
        { at: [44, 10], path: [[35, 5], [55, 5], [55, 15], [35, 15]] },
        { at: [40, 28], path: [[35, 23], [55, 23], [55, 31], [35, 31]] }
      ],
      drones: [
        { at: [10, 13], path: [[6, 14], [26, 13], [6, 22]] },
        { at: [50, 23], path: [[34, 30], [56, 30], [56, 24], [34, 24]] }
      ],
      lasers: [
        { a: [27, 14], b: [31, 14] },
        { a: [27, 15], b: [31, 15] },
        { a: [44, 17], b: [44, 20] },
        { a: [45, 17], b: [45, 20] }
      ],
      doors: [[14, 26], [15, 26]],
      reinforce: [[55, 15], [8, 22]]
    },
    {
      id: 3,
      name: 'CORE',
      w: 60, h: 36,
      par: 180,
      floors: [
        [20, 2, 39, 10],   /* N wing */
        [24, 14, 35, 21],  /* core */
        [20, 25, 39, 33],  /* S wing */
        [2, 12, 18, 23],   /* W wing */
        [42, 12, 57, 23],  /* E wing */
        [29, 11, 30, 13],  /* N->core corridor */
        [29, 22, 30, 24],  /* core->S corridor */
        [19, 17, 23, 18],  /* core<->W corridor */
        [36, 17, 41, 18]   /* core<->E corridor */
      ],
      carves: [],
      spawn: [21, 2],
      terminals: [[35, 3], [22, 30], [33, 15]],
      exit: [21, 4],
      crates: [[25, 7], [25, 30], [9, 18], [43, 22], [27, 18], [32, 18]],
      guards: [
        { at: [25, 5], path: [[24, 5], [37, 5], [37, 9], [24, 9]] },
        { at: [30, 30], path: [[23, 27], [37, 27], [37, 32], [23, 32]] },
        { at: [10, 17], path: [[5, 15], [16, 15], [16, 21], [5, 21]] },
        { at: [50, 18], path: [[45, 15], [56, 15], [56, 21], [45, 21]] },
        { at: [29, 16], path: [[26, 16], [33, 16], [33, 20], [26, 20]] }
      ],
      drones: [
        { at: [31, 5], path: [[28, 3], [34, 3], [34, 7], [28, 7]] },
        { at: [30, 31], path: [[23, 33], [38, 33], [38, 31], [23, 31]] }
      ],
      lasers: [
        { a: [29, 10], b: [29, 14] },
        { a: [30, 10], b: [30, 14] },
        { a: [29, 21], b: [29, 25] },
        { a: [30, 21], b: [30, 25] },
        { a: [18, 17], b: [24, 17] },
        { a: [18, 18], b: [24, 18] },
        { a: [35, 17], b: [42, 17] },
        { a: [35, 18], b: [42, 18] }
      ],
      doors: [],
      reinforce: [[5, 20], [55, 20]]
    }
  ];

  /* parse a level definition into runtime structures */
  function parseLevel(def) {
    var w = def.w, h = def.h;
    var grid = [], i, j, x, y;
    for (j = 0; j < h; j++) { grid.push(new Array(w).fill(1)); }
    function rect(g, x0, y0, x1, y1, v) {
      for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) {
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) grid[yy][xx] = v;
      }
    }
    def.floors.forEach(function (f) { rect(grid, f[0], f[1], f[2], f[3], 0); });
    def.carves.forEach(function (f) { rect(grid, f[0], f[1], f[2], f[3], 0); });

    /* occupied marker (for decor avoidance) */
    var occupies = [];
    for (j = 0; j < h; j++) { occupies.push(new Array(w).fill(0)); }

    var cx = function (t) { return t * 16 + 8; };

    var terminals = def.terminals.map(function (t) {
      var tx = t[0], ty = t[1];
      var face = 'down';
      if (ty > 0 && grid[ty - 1][tx] === 1) face = 'down';
      else if (ty < h - 1 && grid[ty + 1][tx] === 1) face = 'up';
      else if (tx > 0 && grid[ty][tx - 1] === 1) face = 'right';
      else if (tx < w - 1 && grid[ty][tx + 1] === 1) face = 'left';
      occupies[ty][tx] = 1;
      return { x: cx(tx), y: cx(ty), tx: tx, ty: ty, face: face, done: false, progress: 0, hackTimer: 0 };
    });

    var exitTile = def.exit;
    occupies[exitTile[1]][exitTile[0]] = 1;
    def.crates.forEach(function (c) {
      if (grid[c[1]][c[0]] === 0) grid[c[1]][c[0]] = 2;
      occupies[c[1]][c[0]] = 1;
    });

    var guards = def.guards.map(function (g) {
      occupies[g.at[1]][g.at[0]] = 1;
      return {
        x: cx(g.at[0]), y: cx(g.at[1]),
        path: g.path.map(function (p) { return { x: cx(p[0]), y: cx(p[1]) }; }),
        pi: 0
      };
    });
    var drones = def.drones.map(function (d) {
      occupies[d.at[1]][d.at[0]] = 1;
      return {
        x: cx(d.at[0]), y: cx(d.at[1]),
        path: d.path.map(function (p) { return { x: cx(p[0]), y: cx(p[1]) }; }),
        pi: 0
      };
    });
    var lasers = def.lasers.map(function (l, idx) {
      occupies[l.a[1]][l.a[0]] = 1;
      occupies[l.b[1]][l.b[0]] = 1;
      return {
        ax: cx(l.a[0]), ay: cx(l.a[1]),
        bx: cx(l.b[0]), by: cx(l.b[1]),
        phase: idx * 0.37,
        on: false, timer: idx * 0.5
      };
    });
    var doors = def.doors.map(function (d) {
      grid[d[1]][d[0]] = 3;
      occupies[d[1]][d[0]] = 1;
      return { x: d[0], y: d[1], open: 0, timer: 0 };
    });

    return {
      def: def, w: w, h: h, grid: grid, occupies: occupies,
      spawn: { x: cx(def.spawn[0]), y: cx(def.spawn[1]) },
      exit: { x: cx(exitTile[0]), y: cx(exitTile[1]), tx: exitTile[0], ty: exitTile[1] },
      terminals: terminals,
      guards: guards,
      drones: drones,
      lasers: lasers,
      doors: doors,
      reinforce: def.reinforce.map(function (p) { return { x: cx(p[0]), y: cx(p[1]) }; }),
      par: def.par,
      name: def.name,
      id: def.id
    };
  }

  var api = { LEVELS: LEVELS, parseLevel: parseLevel };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    W.NB = W.NB || {};
    W.NB.Levels = api;
  }
})();
