/* NEON BREACH - bootstrap + test contract */
(function () {
  'use strict';
  var NB = window.NB;

  function makeOverlay(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'));
    return c;
  }

  NB.makeOverlays = function (G) {
    G.vig = makeOverlay(G.W, G.H, function (x) {
      var g = x.createRadialGradient(G.W / 2, G.H / 2, G.H * 0.42, G.W / 2, G.H / 2, G.H * 0.85);
      g.addColorStop(0, 'rgba(0,0,8,0)');
      g.addColorStop(1, 'rgba(0,0,10,0.55)');
      x.fillStyle = g;
      x.fillRect(0, 0, G.W, G.H);
    });
    G.redEdge = makeOverlay(G.W, G.H, function (x) {
      function eg(x0, y0, x1, y1) {
        var g = x.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, 'rgba(255,20,60,0.55)');
        g.addColorStop(1, 'rgba(255,20,60,0)');
        return g;
      }
      x.fillStyle = eg(0, 0, 0, 46); x.fillRect(0, 0, G.W, 46);
      x.fillStyle = eg(0, G.H, 0, G.H - 46); x.fillRect(0, G.H - 46, G.W, 46);
      x.fillStyle = eg(0, 0, 46, 0); x.fillRect(0, 0, 46, G.H);
      x.fillStyle = eg(G.W, 0, G.W - 46, 0); x.fillRect(G.W - 46, 0, 46, G.H);
    });
  };

  var canvas = document.getElementById('game');
  NB.Game.init(canvas);
  NB.makeOverlays(NB.Game);
  NB.Audio.setMuted(!!NB.Store.loadSettings().muted); /* restore saved mute state */
  NB.Music.start('menu');

  var last = performance.now();
  function loop(ts) {
    requestAnimationFrame(loop);
    var dt = ts - last;
    last = ts;
    NB.Game.frame(dt);
  }
  requestAnimationFrame(loop);

  /* auto-pause when the window loses focus or the tab is hidden */
  function autoPause() {
    if (NB.Game.state === 'play' && !NB.Game.paused) NB.Game.paused = true;
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) autoPause(); });
  window.addEventListener('blur', autoPause);

  /* ---------------- game-test contract ---------------- */
  var G = NB.Game;
  window.__gameTest = {
    actions: function () {
      return ['start', 'pause', 'restart', 'quit', 'confirm', 'mute',
        'hold', 'release', 'tap', 'dash', 'emp', 'teleport', 'set_hp', 'damage',
        'next_level', 'hack_all', 'set_alert'];
    },
    reset: function (seed) {
      G.testMode = true;
      G.acc = 0;
      G.reset(seed === undefined ? 12345 : seed);
      G.state = 'play';
      G.stateT = 0;
      return this.snapshot();
    },
    act: function (name, p) {
      G.testAct(name, p);
      return this.snapshot();
    },
    step: function (frames) {
      for (var i = 0; i < (frames | 0); i++) G.simulate(1 / 60);
      return this.snapshot();
    },
    snapshot: function () {
      var s = {
        screen: G.state,
        paused: G.paused,
        seed: G.seed,
        level: G.level ? G.level.id : 0,
        name: G.level ? G.level.name : '',
        time: Math.round(G.time * 100) / 100,
        score: G.totalScore,
        data: G.dataCount,
        alert: Math.round(G.alert * 100) / 100,
        exitActive: G.dataCount >= (G.level ? G.level.terminals.length : 3),
        escapeT: Math.round(G.escapeT * 100) / 100,
        reinfWarn: Math.round((G.reinfWarnT || 0) * 100) / 100,
        wipe: Math.round((G.wipeT || 0) * 100) / 100,
        hpWarn: !!G.hpWarn,
        muted: !!NB.Audio.muted,
        interactBuf: Math.round((G.interactBuf || 0) * 100) / 100,
        ducked: !!NB.Music.ducked,
        newBest: !!G.newBest,
        best: NB.Store ? NB.Store.load() : null,
        hp: G.player ? G.player.hp : 0,
        dead: G.player ? G.player.dead : true,
        pos: G.player ? [Math.round(G.player.x * 10) / 10, Math.round(G.player.y * 10) / 10] : [0, 0],
        crouch: G.player ? G.player.crouch : false,
        empCd: G.player ? Math.round(G.player.empCd * 10) / 10 : 0,
        dashCd: G.player ? Math.round(G.player.dashCd * 10) / 10 : 0,
        hacking: G.player && G.player.hacking ? G.level.terminals.indexOf(G.player.hacking) : -1,
        terminals: G.level ? G.level.terminals.map(function (t) {
          return { done: t.done, prog: Math.round(t.hackTimer / 1.5 * 100) / 100 };
        }) : [],
        guards: (G.guards || []).map(function (g) {
          return {
            x: Math.round(g.x * 10) / 10, y: Math.round(g.y * 10) / 10,
            st: g.state, det: Math.round(g.det * 100) / 100,
            stun: Math.round(g.stunT * 10) / 10,
            face: Math.round(g.face * 100) / 100
          };
        }),
        drones: (G.drones || []).map(function (d) {
          return {
            x: Math.round(d.x * 10) / 10, y: Math.round(d.y * 10) / 10,
            st: d.state, det: Math.round(d.det * 100) / 100,
            stun: Math.round(d.stunT * 10) / 10
          };
        }),
        lasers: G.level ? G.level.lasers.map(function (l) { return l.on ? 1 : 0; }) : [],
        doors: G.level ? G.level.doors.map(function (d) { return Math.round(d.open * 10) / 10; }) : [],
        bullets: (G.bullets || []).length,
        runStats: (G.runStats || []).map(function (r) { return r.id + ':' + r.time.toFixed(1) + 's'; })
      };
      return s;
    }
  };
})();
