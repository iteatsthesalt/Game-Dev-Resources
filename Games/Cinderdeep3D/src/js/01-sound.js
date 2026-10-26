/* ============================================================
   Cinderdeep — sound: synthesized effects and generative music
   ============================================================ */
const Sound = {
  ctx: null, master: null, sfxBus: null, musBus: null, noise: null, last: {}, vol: { sfx: 0.7, music: 0.4 },
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = (this.ctx = new AC());
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
      this.master = c.createGain(); this.master.gain.value = 0.9;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
      this.musBus = c.createGain(); this.musBus.connect(this.master);
      const len = c.sampleRate * 1;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.setVolumes();
      Music.attach(c, this.musBus);
    } catch (e) { this.ctx = null; }
  },
  setVolumes() {
    if (!this.ctx) return;
    this.sfxBus.gain.value = this.vol.sfx;
    this.musBus.gain.value = this.vol.music * 0.55;
  },
  tone(type, f0, f1, dur, vol, at = 0.004, delay = 0, dest) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + at);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  },
  hiss(dur, vol, ftype, f0, f1, q = 1, delay = 0, dest) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = c.createBiquadFilter(); f.type = ftype; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  play(name, o = {}) {
    if (!this.ctx || this.vol.sfx <= 0) return;
    const now = this.ctx.currentTime, gap = SFX_GAP[name] ?? 0.03;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    const f = SFX[name];
    if (f) try { f(this, o.p ?? 1, o.v ?? 1); } catch (e) { /* audio is best-effort */ }
  },
};
const SFX_GAP = { hit: 0.035, xp: 0.025, coin: 0.04, die: 0.05, step: 0.1, swing: 0.05, shard: 0.06, zap: 0.06, tick: 0.02 };
const SFX = {
  swing: (S, p, v) => S.hiss(0.11, 0.22 * v, 'bandpass', 900 * p, 3200 * p, 1.4),
  heavy: (S, p, v) => { S.hiss(0.2, 0.3 * v, 'bandpass', 400 * p, 1600 * p, 1.2); S.tone('sine', 140, 60, 0.15, 0.12 * v); },
  hit: (S, p, v) => { S.tone('square', 210 * p, 70, 0.07, 0.11 * v); S.hiss(0.06, 0.18 * v, 'lowpass', 2400, 600, 0.7); },
  crit: (S, p, v) => { S.tone('square', 520 * p, 160, 0.09, 0.12 * v); S.hiss(0.08, 0.22 * v, 'highpass', 2600, 1200, 0.7); S.tone('triangle', 1400, 900, 0.07, 0.06 * v, 0.002, 0.02); },
  arrow: (S, p, v) => { S.tone('triangle', 900 * p, 420, 0.07, 0.1 * v); S.hiss(0.05, 0.08 * v, 'highpass', 3000, 2000); },
  knife: (S, p, v) => S.hiss(0.06, 0.12 * v, 'bandpass', 2600 * p, 4200, 2),
  fire: (S, p, v) => { S.hiss(0.26, 0.2 * v, 'lowpass', 1400 * p, 260, 0.8); S.tone('sawtooth', 110 * p, 55, 0.18, 0.05 * v); },
  boom: (S, p, v) => { S.hiss(0.55, 0.42 * v, 'lowpass', 900 * p, 60, 0.9); S.tone('sine', 110 * p, 30, 0.45, 0.4 * v); },
  pop: (S, p, v) => { S.hiss(0.18, 0.25 * v, 'lowpass', 1200 * p, 160, 0.9); S.tone('sine', 160 * p, 50, 0.16, 0.18 * v); },
  shard: (S, p, v) => { S.tone('sine', 1900 * p, 2500, 0.05, 0.05 * v); S.hiss(0.04, 0.05 * v, 'highpass', 5000, 4000); },
  ice: (S, p, v) => { S.tone('sine', 1500 * p, 2800, 0.12, 0.09 * v); S.tone('triangle', 2400 * p, 1700, 0.18, 0.05 * v, 0.003, 0.03); S.hiss(0.2, 0.12 * v, 'highpass', 4000, 6000); },
  zap: (S, p, v) => { S.hiss(0.14, 0.2 * v, 'highpass', 2400 * p, 5200, 0.8); S.tone('square', 900 * p, 120, 0.1, 0.06 * v); },
  thunder: (S, p, v) => { S.hiss(0.6, 0.35 * v, 'lowpass', 3000 * p, 120, 0.7); S.tone('square', 1200, 80, 0.2, 0.08 * v); },
  venom: (S, p, v) => { S.tone('sine', 300 * p, 140, 0.18, 0.12 * v); S.hiss(0.2, 0.08 * v, 'bandpass', 800, 300, 3); },
  magic: (S, p, v) => { S.tone('triangle', 660 * p, 1320 * p, 0.12, 0.07 * v); S.tone('sine', 990 * p, 1980 * p, 0.1, 0.04 * v, 0.003, 0.03); },
  hurt: (S, p, v) => { S.tone('sawtooth', 320 * p, 110, 0.22, 0.14 * v); S.hiss(0.18, 0.2 * v, 'lowpass', 1800, 300); },
  die: (S, p, v) => { S.hiss(0.24, 0.2 * v, 'bandpass', 700 * p, 180, 1.2); S.tone('square', 190 * p, 50, 0.2, 0.07 * v); },
  bones: (S, p, v) => { for (let i = 0; i < 4; i++) S.hiss(0.03, 0.12 * v, 'highpass', 2500 + i * 400, 2000, 2, i * 0.035); },
  splat: (S, p, v) => { S.tone('sine', 220 * p, 60, 0.16, 0.16 * v); S.hiss(0.12, 0.12 * v, 'lowpass', 900, 200); },
  coin: (S, p, v) => { S.tone('square', 988 * p, 988 * p, 0.05, 0.05 * v); S.tone('square', 1318 * p, 1318 * p, 0.1, 0.05 * v, 0.003, 0.05); },
  xp: (S, p, v) => S.tone('sine', 900 * p, 1300 * p, 0.05, 0.05 * v),
  pickup: (S, p, v) => { S.tone('triangle', 520 * p, 780 * p, 0.08, 0.1 * v); S.tone('triangle', 780 * p, 1040 * p, 0.1, 0.08 * v, 0.003, 0.06); },
  heal: (S, p, v) => { [523, 659, 784].forEach((f, i) => S.tone('sine', f * p, f * p * 1.01, 0.22, 0.08 * v, 0.01, i * 0.06)); },
  levelup: (S, p, v) => { [392, 523, 659, 784, 1046].forEach((f, i) => S.tone('square', f, f, 0.16, 0.06 * v, 0.004, i * 0.07)); S.tone('triangle', 1568, 1568, 0.5, 0.05 * v, 0.01, 0.35); },
  door: (S, p, v) => { S.hiss(0.22, 0.25 * v, 'lowpass', 500 * p, 120, 1); S.tone('square', 90 * p, 50, 0.16, 0.08 * v); },
  unlock: (S, p, v) => { S.tone('square', 600, 600, 0.04, 0.06 * v); S.tone('square', 900, 900, 0.06, 0.06 * v, 0.003, 0.06); S.hiss(0.1, 0.12 * v, 'bandpass', 2000, 1200, 2, 0.04); },
  chest: (S, p, v) => { [523, 659, 784, 1046, 1318].forEach((f, i) => S.tone('triangle', f, f, 0.18, 0.07 * v, 0.004, i * 0.05)); },
  dash: (S, p, v) => S.hiss(0.14, 0.18 * v, 'bandpass', 500 * p, 2400 * p, 1.5),
  potion: (S, p, v) => { for (let i = 0; i < 5; i++) S.tone('sine', 300 + Math.random() * 500, 600 + Math.random() * 400, 0.06, 0.06 * v, 0.004, i * 0.05); },
  roar: (S, p, v) => { S.tone('sawtooth', 95 * p, 48, 1.1, 0.16 * v, 0.05); S.hiss(1, 0.2 * v, 'lowpass', 600, 120, 1); S.tone('sawtooth', 142 * p, 70, 0.9, 0.08 * v, 0.06, 0.05); },
  ui: (S, p, v) => S.tone('square', 660 * p, 660 * p, 0.04, 0.04 * v),
  back: (S, p, v) => S.tone('square', 440 * p, 330 * p, 0.06, 0.04 * v),
  buy: (S, p, v) => { SFX.coin(S, 1, v); SFX.pickup(S, 1.2, v * 0.8); },
  deny: (S, p, v) => { S.tone('square', 180, 140, 0.12, 0.06 * v); S.tone('square', 140, 110, 0.14, 0.06 * v, 0.003, 0.1); },
  block: (S, p, v) => { S.tone('triangle', 1100 * p, 600, 0.1, 0.1 * v); S.tone('square', 1600 * p, 1200, 0.05, 0.04 * v); },
  spawn: (S, p, v) => S.hiss(0.4, 0.1 * v, 'bandpass', 300 * p, 1800 * p, 3),
  clear: (S, p, v) => { [659, 784, 988].forEach((f, i) => S.tone('triangle', f, f, 0.25, 0.06 * v, 0.01, i * 0.09)); },
  stairs: (S, p, v) => { [784, 659, 523, 392].forEach((f, i) => S.tone('triangle', f, f * 0.98, 0.22, 0.07 * v, 0.01, i * 0.11)); },
  tick: (S, p, v) => S.tone('square', 1200 * p, 1200 * p, 0.02, 0.03 * v),
  slam: (S, p, v) => { S.hiss(0.4, 0.4 * v, 'lowpass', 600 * p, 80, 1); S.tone('sine', 80 * p, 35, 0.35, 0.35 * v); },
  shoot: (S, p, v) => { S.tone('square', 520 * p, 260 * p, 0.08, 0.05 * v); },
  web: (S, p, v) => S.hiss(0.16, 0.12 * v, 'bandpass', 1200 * p, 500, 4),
  telegraph: (S, p, v) => { S.tone('sine', 300 * p, 600 * p, 0.25, 0.05 * v, 0.05); },
  growl: (S, p, v) => { S.tone('sawtooth', 120 * p, 70, 0.3, 0.06 * v, 0.03); S.hiss(0.25, 0.08 * v, 'lowpass', 500, 200); },
};

/* ---------- generative music: a pad, a pulse and an arpeggio in each region's mode ---------- */
const Music = {
  c: null, bus: null, filt: null, on: true, act: -1, intensity: 0, timer: 0, step: 0, nextT: 0, chord: 0, playing: false,
  attach(c, bus) {
    this.c = c; this.bus = bus;
    this.filt = c.createBiquadFilter(); this.filt.type = 'lowpass'; this.filt.frequency.value = 2200; this.filt.Q.value = 0.5;
    this.filt.connect(bus);
    if (!this.timer) this.timer = setInterval(() => this.tick(), 60);
  },
  set(act, intensity) {
    this.act = act; this.intensity = intensity;
    if (this.filt && this.c) this.filt.frequency.setTargetAtTime(intensity >= 2 ? 3200 : intensity === 1 ? 2400 : 1500, this.c.currentTime, 0.4);
  },
  stop() { this.act = -1; },
  note(midi) { return 440 * Math.pow(2, (midi - 69) / 12); },
  voice(type, f, t, dur, vol, att = 0.02) {
    const c = this.c, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.filt); o.start(t); o.stop(t + dur + 0.05);
  },
  drum(kind, t, vol) {
    const c = this.c;
    if (kind === 'kick') {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.25);
    } else {
      const s = c.createBufferSource(); s.buffer = Sound.noise;
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
      const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'hat' ? 0.04 : 0.14));
      s.connect(f); f.connect(g); g.connect(this.bus); s.start(t, Math.random() * 0.5); s.stop(t + 0.16);
    }
  },
  tick() {
    const c = this.c;
    if (!c || c.state !== 'running' || this.act < 0 || Sound.vol.music <= 0) { this.nextT = 0; return; }
    const A = ACTS[this.act % ACTS.length].music, I = this.intensity;
    const tempo = A.tempo * (I >= 2 ? 1.5 : I === 1 ? 1.2 : 1), eighth = 30 / tempo;
    if (!this.nextT || this.nextT < c.currentTime) this.nextT = c.currentTime + 0.05;
    const prog = [0, 5, 3, 4], mode = A.mode;
    const deg = (d) => A.root + mode[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    while (this.nextT < c.currentTime + 0.25) {
      const t = this.nextT, s = this.step % 32, bar = Math.floor(this.step / 8) % 4, root = prog[bar];
      if (s % 8 === 0) {
        // pad: a soft triad that swells over the bar
        for (const k of [0, 2, 4]) {
          const f = this.note(deg(root + k) - 12);
          this.voice('triangle', f, t, eighth * 8.4, 0.05, eighth * 2);
          this.voice('sine', f * 1.005, t, eighth * 8.4, 0.03, eighth * 3);
        }
        this.voice('sine', this.note(deg(root) - 24), t, eighth * 7, 0.11, 0.05);
      }
      if (I >= 1 && s % 2 === 0) this.voice('sine', this.note(deg(root) - 24), t, eighth * 0.9, 0.08, 0.005);
      const arpP = I >= 1 ? 0.75 : 0.32;
      if (Math.random() < arpP && s % (I >= 1 ? 1 : 2) === 0) {
        const k = [0, 2, 4, 7, 4, 2][Math.floor(Math.random() * 6)] + (Math.random() < 0.3 ? 7 : 0);
        this.voice(I >= 2 ? 'square' : 'triangle', this.note(deg(root + k) + 12), t, eighth * 1.4, I >= 2 ? 0.025 : 0.03, 0.004);
      }
      if (I >= 1) {
        if (s % 2 === 1) this.drum('hat', t, 0.05);
        if (I >= 2 && s % 4 === 0) this.drum('kick', t, 0.35);
        if (I >= 2 && s % 8 === 4) this.drum('snare', t, 0.1);
        if (I === 1 && s % 8 === 0) this.drum('kick', t, 0.18);
      }
      this.step++; this.nextT += eighth;
    }
  },
};

