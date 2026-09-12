// NEON BREACH — fully procedural WebAudio: ambient synth loop + SFX.
// No audio files. Everything is oscillators, noise buffers and filters.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.noiseBuf = null;
    this.music = null; // running sequencer state
    this.klaxon = null; // running alarm
    this.channelOsc = null; // download hum
    this.footStepT = 0;
    this.footStepAlt = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.42;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);

    // 1s of white noise, reused by every noisy SFX
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.8;
    return this.muted;
  }

  // ---------- low level helpers ----------
  env(gainNode, t0, a, d, peak, sustain = 0) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.linearRampToValueAtTime(peak, t0 + a);
    g.setTargetAtTime(sustain, t0 + a, d);
  }

  osc(type, freq, t0, dur, peak, dest, freqEnd) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    const g = this.ctx.createGain();
    this.env(g, t0, 0.008, dur * 0.6, peak);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.3);
    return { o, g };
  }

  noise(t0, dur, peak, filterType, freq, dest, q = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t0, 0.005, dur * 0.5, peak);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t0);
    s.stop(t0 + dur + 0.2);
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  // ---------- SFX ----------
  ui() { if (this.ctx) this.osc("square", 660, this.now(), 0.07, 0.12, this.sfxGain, 880); }

  footstep(running, crouching) {
    if (!this.ctx) return;
    this.footStepT -= 1 / 60;
    if (this.footStepT > 0) return;
    this.footStepAlt = !this.footStepAlt;
    const speed = crouching ? 0.34 : running ? 0.27 : 0.42;
    this.footStepT = speed;
    const peak = crouching ? 0.05 : running ? 0.16 : 0.09;
    this.noise(this.now(), 0.07, peak, "bandpass", this.footStepAlt ? 420 : 360, this.sfxGain, 2);
  }

  pickup() {
    if (!this.ctx) return;
    const t = this.now();
    this.osc("sine", 880, t, 0.09, 0.2, this.sfxGain, 1320);
    this.osc("sine", 1320, t + 0.07, 0.12, 0.18, this.sfxGain, 1760);
  }

  shardGet() {
    if (!this.ctx) return;
    const t = this.now();
    [660, 880, 1100, 1320].forEach((f, i) => this.osc("square", f, t + i * 0.05, 0.1, 0.12, this.sfxGain));
  }

  keycardGet() {
    if (!this.ctx) return;
    const t = this.now();
    this.osc("triangle", 520, t, 0.1, 0.2, this.sfxGain, 780);
    this.osc("triangle", 780, t + 0.08, 0.14, 0.18, this.sfxGain, 1040);
  }

  channelStart() {
    if (!this.ctx || this.channelOsc) return;
    const t = this.now();
    const o = this.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = 52;
    const o2 = this.ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = 104;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 300;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.1);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfxGain);
    o.start(t); o2.start(t);
    this.channelOsc = { o, o2, g };
  }

  channelTick(frac) {
    if (!this.ctx) return;
    this.osc("square", 900 + frac * 700, this.now(), 0.05, 0.1, this.sfxGain);
  }

  channelStop(success) {
    if (this.channelOsc) {
      const { o, o2, g } = this.channelOsc;
      const t = this.now();
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.08);
      o.stop(t + 0.1); o2.stop(t + 0.1);
      this.channelOsc = null;
    }
    if (success) {
      const t = this.now();
      [523, 659, 784, 1046].forEach((f, i) => this.osc("square", f, t + i * 0.06, 0.12, 0.14, this.sfxGain));
    }
  }

  alert() {
    if (!this.ctx) return;
    const t = this.now();
    for (let i = 0; i < 3; i++) {
      this.osc("square", 660, t + i * 0.18, 0.09, 0.16, this.sfxGain);
      this.osc("square", 880, t + i * 0.18 + 0.09, 0.09, 0.16, this.sfxGain);
    }
  }

  suspicious() {
    if (!this.ctx) return;
    const t = this.now();
    this.osc("triangle", 440, t, 0.12, 0.14, this.sfxGain, 560);
  }

  startKlaxon() {
    if (!this.ctx || this.klaxon) return;
    const ctx = this.ctx;
    const t = this.now();
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 700;
    o.connect(f); f.connect(g); g.connect(this.sfxGain);
    o.start(t);
    // two-tone siren via LFO on frequency
    const lfo = ctx.createOscillator();
    lfo.type = "square";
    lfo.frequency.value = 1.6;
    const lg = ctx.createGain();
    lg.gain.value = 55;
    lfo.connect(lg); lg.connect(o.frequency);
    o.frequency.value = 330;
    lfo.start(t);
    this.klaxon = { o, lfo, g };
  }

  stopKlaxon() {
    if (!this.klaxon) return;
    const { o, lfo, g } = this.klaxon;
    const t = this.now();
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.25);
    o.stop(t + 0.3); lfo.stop(t + 0.3);
    this.klaxon = null;
  }

  emp() {
    if (!this.ctx) return;
    const t = this.now();
    this.osc("sawtooth", 900, t, 0.5, 0.22, this.sfxGain, 50);
    this.noise(t, 0.4, 0.2, "highpass", 1200, this.sfxGain);
  }

  smoke() {
    if (!this.ctx) return;
    this.noise(this.now(), 0.5, 0.18, "bandpass", 900, this.sfxGain, 0.7);
  }

  laser() {
    if (!this.ctx) return;
    this.osc("square", 1400, this.now(), 0.11, 0.1, this.sfxGain, 260);
  }

  droneShot() {
    if (!this.ctx) return;
    this.osc("sawtooth", 700, this.now(), 0.16, 0.1, this.sfxGain, 180);
  }

  hitPlayer() {
    if (!this.ctx) return;
    const t = this.now();
    this.osc("sine", 150, t, 0.18, 0.3, this.sfxGain, 40);
    this.noise(t, 0.14, 0.2, "lowpass", 500, this.sfxGain);
  }

  takedown() {
    if (!this.ctx) return;
    const t = this.now();
    this.osc("sine", 130, t, 0.14, 0.32, this.sfxGain, 35);
    this.noise(t + 0.02, 0.12, 0.16, "bandpass", 300, this.sfxGain, 2);
  }

  guardDown() {
    if (!this.ctx) return;
    const t = this.now();
    this.noise(t, 0.3, 0.2, "lowpass", 700, this.sfxGain);
    this.osc("triangle", 240, t, 0.25, 0.16, this.sfxGain, 60);
  }

  death() {
    if (!this.ctx) return;
    const t = this.now();
    this.osc("sawtooth", 400, t, 0.9, 0.3, this.sfxGain, 30);
    this.noise(t, 0.8, 0.25, "lowpass", 900, this.sfxGain);
  }

  doorOpen() {
    if (!this.ctx) return;
    const t = this.now();
    this.osc("square", 180, t, 0.4, 0.14, this.sfxGain, 140);
    this.noise(t + 0.15, 0.3, 0.12, "lowpass", 400, this.sfxGain);
  }

  doorDenied() {
    if (!this.ctx) return;
    this.osc("square", 160, this.now(), 0.22, 0.16, this.sfxGain, 90);
  }

  exitOpen() {
    if (!this.ctx) return;
    const t = this.now();
    [392, 523, 659, 784, 1046].forEach((f, i) => this.osc("triangle", f, t + i * 0.07, 0.16, 0.16, this.sfxGain));
  }

  levelClear() {
    if (!this.ctx) return;
    const t = this.now();
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.osc("square", f, t + i * 0.09, 0.2, 0.13, this.sfxGain));
    this.noise(t, 0.6, 0.08, "highpass", 3000, this.sfxGain);
  }

  // ---------- music ----------
  startMusic(intense) {
    if (!this.ctx) return;
    this.stopMusic();
    const ctx = this.ctx;
    const state = {
      step: 0,
      nextTime: ctx.currentTime + 0.1,
      intense: !!intense,
      timer: null,
    };
    const bass = [0, 0, 12, 0, 3, 3, 15, 3, 0, 0, 10, 0, 7, 7, 15, 7];
    const arp = [0, 3, 7, 10];
    const schedule = () => {
      const spb = 60 / (state.intense ? 138 : 96) / 4; // 16th notes
      while (state.nextTime < ctx.currentTime + 0.25) {
        const s = state.step % 16;
        const t = state.nextTime;
        if (s % 4 === 0) {
          // kick
          const o = ctx.createOscillator();
          o.type = "sine";
          o.frequency.setValueAtTime(150, t);
          o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.5, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
          o.connect(g); g.connect(this.musicGain);
          o.start(t); o.stop(t + 0.2);
        }
        if (state.intense && s % 4 === 2) {
          this._hat(t);
        }
        const b = 45 * Math.pow(2, bass[s] / 12);
        if (s % 2 === 0) {
          const o = ctx.createOscillator();
          o.type = state.intense ? "sawtooth" : "square";
          o.frequency.value = b;
          const f = ctx.createBiquadFilter();
          f.type = "lowpass";
          f.frequency.value = state.intense ? 500 : 320;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.22, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + spb * 1.8);
          o.connect(f); f.connect(g); g.connect(this.musicGain);
          o.start(t); o.stop(t + spb * 2);
        }
        if (state.intense) {
          const a = arp[(state.step + s) % 4];
          const o = ctx.createOscillator();
          o.type = "square";
          o.frequency.value = 330 * Math.pow(2, (a + 12) / 12);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.05, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + spb * 0.9);
          o.connect(g); g.connect(this.musicGain);
          o.start(t); o.stop(t + spb);
        }
        state.nextTime += spb;
        state.step++;
      }
    };
    state.timer = setInterval(schedule, 90);
    schedule();
    this.music = state;
  }

  _hat(t) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(this.musicGain);
    s.start(t); s.stop(t + 0.07);
  }

  setMusicIntense(intense) {
    if (this.music && this.music.intense !== intense) this.startMusic(intense);
  }

  stopMusic() {
    if (this.music) {
      clearInterval(this.music.timer);
      this.music = null;
    }
  }

  setMusicOn(on) {
    if (this.musicGain) this.musicGain.gain.value = on ? 0.42 : 0;
  }

  // Called each frame; keeps music in sync with alarm state.
  tick(alarm) {
    if (this.music) this.setMusicIntense(alarm === "alert");
  }
}

export const audio = new AudioEngine();
