/* NEON BREACH - core utilities: math, RNG, input, audio */
(function () {
  'use strict';
  var NB = (window.NB = window.NB || {});

  /* ---------- math ---------- */
  NB.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  NB.lerp = function (a, b, t) { return a + (b - a) * t; };
  NB.dist = function (x1, y1, x2, y2) { var dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); };
  NB.angleDiff = function (a, b) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  NB.fmtTime = function (t) {
    var s = Math.max(0, Math.floor(t));
    var m = Math.floor(s / 60);
    return (m < 10 ? '0' + m : '' + m) + ':' + (s % 60 < 10 ? '0' + (s % 60) : s % 60);
  };

  /* ---------- deterministic RNG (mulberry32) ---------- */
  NB.mulberry32 = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  NB.makeRng = function (seed) {
    var f = NB.mulberry32(seed);
    return {
      next: f,
      range: function (a, b) { return a + f() * (b - a); },
      int: function (a, b) { return Math.floor(a + f() * (b - a + 1)); },
      pick: function (arr) { return arr[Math.floor(f() * arr.length)]; },
      chance: function (p) { return f() < p; },
      sign: function () { return f() < 0.5 ? -1 : 1; }
    };
  };

  /* ---------- input ---------- */
  var KEYMAP = {
    'arrowup': 'up', 'w': 'up',
    'arrowdown': 'down', 's': 'down',
    'arrowleft': 'left', 'a': 'left',
    'arrowright': 'right', 'd': 'right',
    ' ': 'emp',
    'shift': 'dash',
    'e': 'interact', 'f': 'interact',
    'c': 'crouch', 'v': 'crouch',
    'enter': 'confirm', 'return': 'confirm',
    'p': 'pause', 'escape': 'pause',
    'm': 'mute',
    'r': 'restart',
    'q': 'quit',
    'x': 'emp', 'z': 'dash'
  };
  NB.Input = {
    down: {},
    prev: {},
    init: function () {
      window.addEventListener('keydown', function (e) {
        var k = (e.key || '').toLowerCase();
        var name = KEYMAP[k] || KEYMAP[e.key];
        if (name) {
          e.preventDefault();
          if (!NB.Input.down[name]) NB.Input.pressed[name] = true;
          NB.Input.down[name] = true;
          NB.Audio && NB.Audio.unlock();
        }
      });
      window.addEventListener('keyup', function (e) {
        var k = (e.key || '').toLowerCase();
        var name = KEYMAP[k] || KEYMAP[e.key];
        if (name) { NB.Input.down[name] = false; }
      });
      window.addEventListener('blur', function () {
        NB.Input.down = {}; NB.Input.pressed = {};
      });
      window.addEventListener('pointerdown', function () { NB.Audio && NB.Audio.unlock(); });
      NB.Input.pressed = {};
    },
    down: function (name) { return !!NB.Input.down[name]; },
    wasPressed: function (name) { return !!NB.Input.pressed[name]; },
    /* poll virtual keys (used by __gameTest) */
    press: function (name) { if (!NB.Input.down[name]) NB.Input.pressed[name] = true; NB.Input.down[name] = true; },
    release: function (name) { NB.Input.down[name] = false; },
    clearPressed: function () { NB.Input.pressed = {}; }
  };

  /* ---------- audio: procedural SFX + tiny sequenced music ---------- */
  NB.Audio = {
    ctx: null,
    master: null,
    sfxBus: null,
    musicBus: null,
    muted: false,
    music: { track: null, step: 0, nextT: 0, playing: false },

    unlock: function () {
      if (!this.ctx) {
        try {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.9;
          this.master.connect(this.ctx.destination);
          this.sfxBus = this.ctx.createGain();
          this.sfxBus.gain.value = 0.55;
          this.sfxBus.connect(this.master);
          this.musicBus = this.ctx.createGain();
          this.musicBus.gain.value = 0.32;
          this.musicBus.connect(this.master);
        } catch (e) { this.ctx = null; }
      }
      if (this.ctx && this.ctx.state === 'suspended') { this.ctx.resume().catch(function () {}); }
      /* resume music that was requested before the audio context existed */
      if (this.ctx && NB.Music && NB.Music.pending && !NB.Music.playing) NB.Music.start(NB.Music.pending);
    },
    setMuted: function (m) {
      this.muted = !!m;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.9;
      NB.Store.saveSettings({ muted: this.muted });
    },
    /* low-level helpers */
    tone: function (o) {
      if (!this.ctx) return;
      var t0 = o.at || this.ctx.currentTime;
      var osc = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(Math.max(20, o.f0), t0);
      if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + o.dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(o.vol || 0.2, t0 + (o.attack || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      osc.connect(g); g.connect(o.bus || this.sfxBus);
      osc.start(t0); osc.stop(t0 + o.dur + 0.02);
    },
    noise: function (o) {
      if (!this.ctx) return;
      var t0 = o.at || this.ctx.currentTime;
      var len = Math.max(1, Math.floor(this.ctx.sampleRate * o.dur));
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = this.ctx.createBufferSource();
      src.buffer = buf;
      var f = this.ctx.createBiquadFilter();
      f.type = o.filterType || 'bandpass';
      f.frequency.value = o.freq || 1200;
      f.Q.value = o.q || 0.8;
      var g = this.ctx.createGain();
      g.gain.setValueAtTime(o.vol || 0.2, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      src.connect(f); f.connect(g); g.connect(o.bus || this.sfxBus);
      src.start(t0);
    }
  };

  var S = NB.Audio;
  NB.Sfx = {
    step: function (alt) { S.noise({ dur: 0.04, vol: 0.05, freq: alt ? 800 : 600, q: 1.2 }); },
    dash: function () { S.tone({ type: 'sawtooth', f0: 240, f1: 900, dur: 0.14, vol: 0.16 }); S.noise({ dur: 0.1, vol: 0.06, freq: 2200 }); },
    emp: function () {
      S.tone({ type: 'sine', f0: 180, f1: 1600, dur: 0.4, vol: 0.22 });
      S.noise({ dur: 0.35, vol: 0.12, freq: 3000, filterType: 'highpass' });
    },
    hackTick: function (p) { S.tone({ type: 'square', f0: 500 + p * 500, dur: 0.03, vol: 0.05 }); },
    shard: function () {
      var t = S.ctx ? S.ctx.currentTime : 0;
      [1046, 1568, 2093].forEach(function (f, i) { S.tone({ type: 'triangle', f0: f, dur: 0.16, vol: 0.1, at: t + i * 0.05 }); });
    },
    alert: function () {
      var t = S.ctx ? S.ctx.currentTime : 0;
      for (var i = 0; i < 2; i++) {
        S.tone({ type: 'square', f0: 880, dur: 0.12, vol: 0.14, at: t + i * 0.22 });
        S.tone({ type: 'square', f0: 620, dur: 0.12, vol: 0.14, at: t + i * 0.22 + 0.13 });
      }
    },
    gun: function () { S.tone({ type: 'sawtooth', f0: 900, f1: 220, dur: 0.1, vol: 0.1 }); S.noise({ dur: 0.05, vol: 0.08, freq: 2500, filterType: 'highpass' }); },
    hit: function () { S.tone({ type: 'square', f0: 160, f1: 60, dur: 0.25, vol: 0.24 }); S.noise({ dur: 0.2, vol: 0.18, freq: 500 }); },
    heartbeat: function () {
      var t = S.ctx ? S.ctx.currentTime : 0;
      S.tone({ type: 'sine', f0: 58, f1: 40, dur: 0.14, vol: 0.3, at: t });
      S.tone({ type: 'sine', f0: 52, f1: 36, dur: 0.12, vol: 0.22, at: t + 0.16 });
    },
    laser: function () { S.tone({ type: 'sawtooth', f0: 1400, f1: 100, dur: 0.3, vol: 0.18 }); },
    door: function () { S.tone({ type: 'triangle', f0: 120, f1: 60, dur: 0.25, vol: 0.12 }); S.noise({ dur: 0.3, vol: 0.05, freq: 300 }); },
    stun: function () { S.tone({ type: 'sine', f0: 1200, f1: 200, dur: 0.5, vol: 0.14 }); },
    die: function () { S.tone({ type: 'sawtooth', f0: 300, f1: 40, dur: 0.8, vol: 0.2 }); S.noise({ dur: 0.7, vol: 0.14, freq: 400 }); },
    escape: function () {
      var t = S.ctx ? S.ctx.currentTime : 0;
      [440, 554, 659, 880].forEach(function (f, i) { S.tone({ type: 'triangle', f0: f, dur: 0.22, vol: 0.12, at: t + i * 0.09 }); });
    },
    victory: function () {
      var t = S.ctx ? S.ctx.currentTime : 0;
      [523, 659, 784, 1046, 1318].forEach(function (f, i) { S.tone({ type: 'square', f0: f, dur: 0.3, vol: 0.09, at: t + i * 0.11 }); });
    },
    ui: function () { S.tone({ type: 'square', f0: 700, dur: 0.05, vol: 0.07 }); }
  };

  /* ---------- persistent best-run storage (localStorage, safe in sandboxes) ---------- */
  NB.Store = {
    key: 'neonBreach.best.v1',
    load: function () {
      try {
        var raw = window.localStorage ? window.localStorage.getItem(this.key) : null;
        if (raw) {
          var b = JSON.parse(raw);
          if (b && typeof b.score === 'number' && b.rank) return b;
        }
      } catch (e) { /* private mode / disabled storage */ }
      return null;
    },
    save: function (b) {
      try { if (window.localStorage) window.localStorage.setItem(this.key, JSON.stringify(b)); } catch (e) { /* ignore */ }
    },
    /* record a finished run; returns true when it beats the stored best */
    submit: function (score, rank) {
      var b = NB.Store.load();
      var isNew = !b || score > b.score;
      if (isNew) NB.Store.save({ score: score, rank: rank, date: Date.now() });
      return isNew;
    },

    skey: 'neonBreach.settings.v1',
    loadSettings: function () {
      try {
        var raw = window.localStorage ? window.localStorage.getItem(this.skey) : null;
        if (raw) {
          var s = JSON.parse(raw);
          if (s && typeof s === 'object') return s;
        }
      } catch (e) { /* private mode / disabled storage */ }
      return {};
    },
    saveSettings: function (patch) {
      try {
        if (!window.localStorage) return;
        var s = NB.Store.loadSettings();
        for (var k in (patch || {})) s[k] = patch[k];
        window.localStorage.setItem(this.skey, JSON.stringify(s));
      } catch (e) { /* ignore */ }
    }
  };

  /* music: 16-step loop, bass + hats; intensity = alert 0..1 */
  NB.Music = {
    pending: null,
    ducked: false,
    start: function (track) {
      this.pending = track; /* remember for unlock() when ctx is not ready yet */
      this.track = track;
      if (!S.ctx) return;
      this.playing = true;
      this.step = 0;
      this.nextT = S.ctx.currentTime + 0.1;
    },
    stop: function () {
      this.playing = false;
      this.ducked = false;
      if (S.ctx) S.musicBus.gain.setTargetAtTime(0.32, S.ctx.currentTime, 0.08);
    },
    /* lower the music bed under pause / quiet screens */
    duck: function (on) {
      this.ducked = !!on;
      if (S.ctx) S.musicBus.gain.setTargetAtTime(this.ducked ? 0.10 : 0.32, S.ctx.currentTime, 0.08);
    },
    tick: function (intensity) {
      if (!S.ctx || !this.playing || !this.track) return;
      var BPM = this.track === 'menu' ? 84 : (this.track === 'down' ? 66 : 104);
      var stepDur = 60 / BPM / 4; /* 16th notes */
      var now = S.ctx.currentTime;
      while (this.nextT < now + 0.15) {
        this.scheduleStep(this.step, this.nextT, this.track, intensity || 0);
        this.nextT += stepDur;
        this.step = (this.step + 1) % 64;
      }
    },
    scheduleStep: function (step, t, track, intensity) {
      var s16 = step % 16;
      var bar = Math.floor(step / 16);
      if (track === 'menu') {
        if (s16 === 0 || s16 === 8) S.tone({ type: 'triangle', f0: 55, dur: 0.5, vol: 0.12, at: t, bus: S.musicBus });
        if (s16 === 4) S.tone({ type: 'triangle', f0: 82.4, dur: 0.3, vol: 0.07, at: t, bus: S.musicBus });
        if (s16 % 8 === 6) S.noise({ dur: 0.03, vol: 0.02, freq: 6000, filterType: 'highpass', at: t, bus: S.musicBus });
        if (bar % 4 === 3 && s16 === 12) S.tone({ type: 'sine', f0: 220, f1: 221, dur: 1.2, vol: 0.03, at: t, bus: S.musicBus });
      } else if (track === 'play') {
        var bass = [55, 0, 55, 0, 65.4, 0, 55, 0, 55, 0, 55, 0, 98, 0, 82.4, 0];
        var b = bass[s16];
        if (b) S.tone({ type: 'sawtooth', f0: b, dur: 0.14, vol: 0.085 + intensity * 0.03, at: t, bus: S.musicBus });
        if (s16 % 2 === 0) S.noise({ dur: 0.02, vol: 0.018 + intensity * 0.02, freq: 7000, filterType: 'highpass', at: t, bus: S.musicBus });
        if (s16 === 4 || s16 === 12) S.noise({ dur: 0.06, vol: 0.03, freq: 3000, filterType: 'bandpass', at: t, bus: S.musicBus });
        if (intensity > 0.4 && s16 % 4 === 2) S.tone({ type: 'square', f0: 2200, f1: 1800, dur: 0.04, vol: 0.02 * intensity, at: t, bus: S.musicBus });
      } else if (track === 'down') {
        /* game-over dirge: slow, sparse, minor */
        if (s16 === 0) {
          S.tone({ type: 'sine', f0: 55, f1: 41.2, dur: 1.6, vol: 0.30, at: t, bus: S.musicBus });
          S.tone({ type: 'triangle', f0: 220, f1: 110, dur: 1.6, vol: 0.05, at: t, bus: S.musicBus });
        }
        if (s16 === 8) S.tone({ type: 'sine', f0: 49, f1: 41.2, dur: 1.1, vol: 0.26, at: t, bus: S.musicBus });
      }
    }
  };
})();
