/* ============================================================
   Cinderdeep — audio overhaul: reverb, stereo position, new
   effects and monster voices, and a pattern-sequencer score with
   region themes, boss themes, title, shop and DMT themes,
   stingers and ambient beds
   ============================================================ */
const _soundInit = Sound.init.bind(Sound);
Sound.init = function () {
  const first = !this.ctx;
  _soundInit();
  if (first && this.ctx && !this.verb) {
    try {
      const c = this.ctx, len = Math.floor(c.sampleRate * 2.4), ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
      this.verb = c.createConvolver(); this.verb.buffer = ir;
      this.verbIn = c.createGain(); this.verbIn.gain.value = 0.24;
      this.verbIn.connect(this.verb); this.verb.connect(this.master);
      this.sfxBus.connect(this.verbIn);
      this.musVerb = c.createGain(); this.musVerb.gain.value = 0.35;
      this.musBus.connect(this.musVerb); this.musVerb.connect(this.verbIn);
    } catch (e) { this.verb = null; }
  }
};
Sound.tone = function (type, f0, f1, dur, vol, at = 0.004, delay = 0, dest) {
  const c = this.ctx, t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(Math.max(20, f0), t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + at); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || this.curDest || this.sfxBus);
  o.start(t); o.stop(t + dur + 0.02);
};
Sound.hiss = function (dur, vol, ftype, f0, f1, q = 1, delay = 0, dest) {
  const c = this.ctx, t = c.currentTime + delay;
  const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.7 + Math.random() * 0.6;
  const f = c.createBiquadFilter(); f.type = ftype; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || this.curDest || this.sfxBus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
};
// sounds can sit left or right of the hero
Sound.play = function (name, o = {}) {
  if (!this.ctx || this.vol.sfx <= 0) return;
  const now = this.ctx.currentTime, gap = SFX_GAP[name] ?? 0.03;
  if (this.last[name] && now - this.last[name] < gap) return;
  this.last[name] = now;
  const f = SFX[name];
  if (!f) return;
  let pan = null;
  const px = o.x ?? this.atX;
  try {
    if (px != null && G.p && this.ctx.createStereoPanner && G.mode === 'play') {
      pan = this.ctx.createStereoPanner(); pan.pan.value = clamp((px - R.camX) / Math.max(120, R.VW * 0.6), -0.8, 0.8); pan.connect(this.sfxBus);
      this.curDest = pan;
    }
    f(this, o.p ?? 1, o.v ?? 1);
  } catch (e) { /* audio is best-effort */ }
  this.curDest = null;
};
Object.assign(SFX_GAP, { squeak: 0.25, whoosh: 0.3, grind: 0.3, growlBig: 0.3, bowdraw: 0.2, gurgle: 0.25, clack: 0.2, trumpet: 0.5, breath: 0.09, soul: 0.03, gunshot: 0.04, lute: 0.05, bite: 0.05, dart: 0.08, stinger: 0.2, elf: 0.25, rattle: 0.25, hiss2: 0.3, croak: 0.3, moan: 0.4, snarl: 0.25, clank: 0.25, giggle: 0.3, chant: 0.4, chime: 0.3 });
const arp = (S, notes, type, step, vol, p = 1, len = 0.18) => notes.forEach((f, i) => S.tone(type, f * p, f * p, len, vol, 0.004, i * step));
Object.assign(SFX, {
  gunshot: (S, p, v) => { S.hiss(0.09, 0.32 * v, 'highpass', 1800 * p, 900, 0.7); S.tone('square', 180 * p, 60, 0.07, 0.12 * v); S.tone('sine', 90, 40, 0.12, 0.2 * v); },
  hex: (S, p, v) => { S.tone('sine', 520 * p, 180, 0.3, 0.08 * v); S.tone('triangle', 780 * p, 260, 0.25, 0.05 * v, 0.004, 0.04); S.hiss(0.2, 0.05 * v, 'bandpass', 1200, 400, 4); },
  katana: (S, p, v) => { S.tone('sine', 2400 * p, 4200 * p, 0.18, 0.06 * v); S.hiss(0.16, 0.22 * v, 'highpass', 3000 * p, 7000, 1); S.tone('triangle', 1320 * p, 1300 * p, 0.35, 0.04 * v, 0.003, 0.02); },
  lute: (S, p, v) => { const f = 330 * p; S.tone('triangle', f, f * 0.995, 0.4, 0.09 * v, 0.002); S.tone('sine', f * 2, f * 2, 0.22, 0.04 * v, 0.002); S.tone('sawtooth', f, f, 0.05, 0.02 * v, 0.001); },
  chord: (S, p, v) => { for (const k of [1, 1.26, 1.5, 2]) S.tone('triangle', 330 * k * p, 330 * k * p, 0.5, 0.05 * v, 0.003, k * 0.01); },
  whip: (S, p, v) => { S.hiss(0.12, 0.18 * v, 'bandpass', 900 * p, 3800, 1.2); S.hiss(0.03, 0.3 * v, 'highpass', 5000, 6000, 1, 0.09); S.tone('square', 2400 * p, 900, 0.03, 0.05 * v, 0.001, 0.09); },
  chakram: (S, p, v) => { for (let i = 0; i < 4; i++) S.hiss(0.06, 0.12 * v, 'bandpass', 2400 + i * 300, 1600, 3, i * 0.05); },
  glass: (S, p, v) => { for (let i = 0; i < 5; i++) S.tone('sine', (2400 + Math.random() * 2400) * p, 1800, 0.12, 0.04 * v, 0.002, i * 0.025); S.hiss(0.18, 0.18 * v, 'highpass', 4000, 2500, 1); },
  harpoon: (S, p, v) => { S.tone('triangle', 220 * p, 110, 0.25, 0.1 * v); S.hiss(0.15, 0.15 * v, 'bandpass', 800, 2400, 2); S.tone('square', 900, 400, 0.05, 0.04 * v, 0.002, 0.02); },
  bite: (S, p, v) => { S.hiss(0.08, 0.28 * v, 'lowpass', 1600 * p, 300, 1); S.tone('square', 140 * p, 60, 0.06, 0.1 * v); S.tone('square', 900 * p, 500, 0.02, 0.04 * v, 0.001, 0.05); },
  breath: (S, p, v) => S.hiss(0.18, 0.12 * v, 'lowpass', 1500 * p, 500, 0.8),
  spit: (S, p, v) => { S.tone('sine', 600 * p, 200, 0.08, 0.08 * v); S.hiss(0.06, 0.1 * v, 'bandpass', 1400, 700, 3); },
  devour: (S, p, v) => { S.tone('sine', 260 * p, 60, 0.35, 0.2 * v); S.hiss(0.3, 0.2 * v, 'lowpass', 1200, 150, 1); S.tone('square', 90, 50, 0.2, 0.06 * v, 0.01, 0.15); },
  evolveStart: (S, p, v) => { S.hiss(1.4, 0.16 * v, 'bandpass', 300, 5000, 2); for (let i = 0; i < 10; i++) S.tone('sine', 300 + i * 120, 320 + i * 130, 0.25, 0.03 * v, 0.02, i * 0.12); },
  evolve: (S, p, v) => { arp(S, [392, 494, 587, 784, 988, 1175, 1568], 'square', 0.07, 0.05 * v); arp(S, [196, 247, 294, 392], 'triangle', 0.1, 0.08 * v, 1, 0.6); S.hiss(0.8, 0.12 * v, 'highpass', 3000, 8000, 1, 0.3); S.tone('sine', 1568, 1568, 1.2, 0.05 * v, 0.05, 0.5); },
  holy: (S, p, v) => { for (const f of [523, 659, 784, 1046]) S.tone('sine', f * p, f * p, 1, 0.05 * v, 0.03); S.hiss(0.6, 0.06 * v, 'highpass', 5000, 7000, 1); },
  void: (S, p, v) => { S.tone('sawtooth', 160 * p, 40, 0.9, 0.08 * v, 0.1); S.hiss(0.9, 0.18 * v, 'lowpass', 1600, 100, 1); S.tone('sine', 55, 30, 1, 0.2 * v, 0.1); },
  wind: (S, p, v) => S.hiss(1.4, 0.18 * v, 'bandpass', 500 * p, 1600 * p, 2),
  song: (S, p, v) => arp(S, [523, 659, 784, 659, 1046], 'triangle', 0.12, 0.07 * v, p, 0.3),
  siphon: (S, p, v) => { S.tone('sine', 200 * p, 800 * p, 0.6, 0.07 * v, 0.3); S.hiss(0.6, 0.08 * v, 'bandpass', 400, 2000, 3); },
  grow: (S, p, v) => { for (let i = 0; i < 6; i++) S.hiss(0.08, 0.1 * v, 'bandpass', 900 + Math.random() * 1200, 600, 2, i * 0.05); },
  howl: (S, p, v) => { S.tone('sawtooth', 300 * p, 620 * p, 0.6, 0.07 * v, 0.1); S.tone('sine', 620 * p, 380 * p, 0.7, 0.08 * v, 0.02, 0.55); S.hiss(1.1, 0.06 * v, 'bandpass', 900, 1400, 4); },
  scream: (S, p, v) => { S.tone('sawtooth', 900 * p, 1700 * p, 0.5, 0.06 * v, 0.05); S.tone('sawtooth', 1200 * p, 700 * p, 0.6, 0.05 * v, 0.05, 0.1); S.hiss(0.6, 0.12 * v, 'highpass', 2500, 4000, 1); },
  stampede: (S, p, v) => { S.hiss(0.5, 0.3 * v, 'lowpass', 500, 80, 1); S.tone('sine', 70, 40, 0.5, 0.25 * v); SFX.zap(S, 1, v * 0.6); },
  beam: (S, p, v) => { S.tone('sine', 880 * p, 1760 * p, 1.1, 0.05 * v, 0.05); S.tone('triangle', 1320 * p, 990 * p, 1.1, 0.03 * v, 0.05); },
  omen: (S, p, v) => { for (const f of [73, 87, 110, 146]) S.tone('sawtooth', f * p, f * p * 0.98, 2.2, 0.05 * v, 0.4); S.hiss(2, 0.06 * v, 'lowpass', 400, 120, 1); },
  stinger: (S, p, v) => { const b = 392 * p; for (const k of [1, 1.26, 1.5]) S.tone('square', b * k, b * k, 0.22, 0.05 * v, 0.004); S.tone('sine', b * 2, b * 2, 0.4, 0.05 * v, 0.004, 0.08); S.hiss(0.15, 0.15 * v, 'highpass', 3000, 6000, 1); SFX.boom(S, 1.6, 0.3 * v); },
  mimic: (S, p, v) => { SFX.bite(S, 0.8, v); S.tone('sawtooth', 120, 70, 0.4, 0.1 * v, 0.03, 0.1); },
  chaos: (S, p, v) => { for (const f of [261, 277, 370, 415]) S.tone('sawtooth', f * p, f * p * (0.9 + Math.random() * 0.2), 0.7, 0.03 * v, 0.03); S.hiss(0.5, 0.1 * v, 'bandpass', 600, 3000, 3); },
  secret: (S, p, v) => arp(S, [784, 740, 622, 440, 415, 659, 831, 1046], 'square', 0.085, 0.045 * v),
  breakthrough: (S, p, v) => { for (let i = 0; i < 16; i++) S.tone('sine', 200 + Math.random() * 1800, 300 + Math.random() * 2400, 0.6, 0.025 * v, 0.1, i * 0.06); S.hiss(1.6, 0.1 * v, 'bandpass', 200, 6000, 4); S.tone('sine', 65, 130, 1.8, 0.12 * v, 0.6); },
  shimmer: (S, p, v) => { for (let i = 0; i < 6; i++) S.tone('sine', 1500 + Math.random() * 2000, 1500 + Math.random() * 2000, 0.3, 0.02 * v, 0.05, i * 0.07); },
  elf: (S, p, v) => { for (let i = 0; i < 5; i++) S.tone('square', (600 + Math.random() * 900) * p, (500 + Math.random() * 1200) * p, 0.05, 0.025 * v, 0.003, i * 0.055); },
  deposit: (S, p, v) => { for (let i = 0; i < 12; i++) S.tone('sine', 400 * Math.pow(1.122, i), 410 * Math.pow(1.122, i), 0.25, 0.04 * v, 0.01, i * 0.05); S.hiss(1, 0.08 * v, 'bandpass', 2000, 6000, 3, 0.2); },
  soul: (S, p, v) => { S.tone('sine', 1320 * p, 1760 * p, 0.12, 0.035 * v, 0.004); S.tone('sine', 2640 * p, 2640 * p, 0.08, 0.015 * v, 0.004, 0.03); },
  ascend: (S, p, v) => { for (const f of [261, 329, 392, 523, 659]) { S.tone('sine', f, f, 1.6, 0.045 * v, 0.25); S.tone('triangle', f * 2, f * 2, 1.2, 0.015 * v, 0.3); } S.hiss(1.2, 0.08 * v, 'highpass', 4000, 9000, 1, 0.2); },
  nemesis: (S, p, v) => { SFX.roar(S, 0.7, v); for (const f of [55, 58, 82]) S.tone('sawtooth', f, f, 2, 0.08 * v, 0.2); S.hiss(1.5, 0.15 * v, 'lowpass', 900, 100, 1); },
  nemesisNear: (S, p, v) => { S.tone('sine', 50, 45, 2.2, 0.15 * v, 0.6); S.hiss(2, 0.06 * v, 'bandpass', 300, 900, 6); for (let i = 0; i < 4; i++) S.tone('sawtooth', 220 + i * 13, 200 + i * 9, 1.4, 0.012 * v, 0.4, i * 0.2); },
  nemesisDie: (S, p, v) => { SFX.boom(S, 0.6, v); SFX.boom(S, 1, v * 0.7); for (const f of [261, 329, 392, 523, 784]) S.tone('sine', f, f * 1.01, 2.4, 0.05 * v, 0.3, 0.3); S.hiss(2, 0.1 * v, 'highpass', 3000, 9000, 1, 0.4); },
  feat: (S, p, v) => { arp(S, [659, 784, 988, 1318], 'triangle', 0.08, 0.06 * v); S.tone('sine', 1975, 1975, 0.5, 0.03 * v, 0.01, 0.32); },
  dart: (S, p, v) => { S.hiss(0.06, 0.12 * v, 'highpass', 3000, 2000, 2); S.tone('square', 1400 * p, 700, 0.03, 0.03 * v); },
  // monster voices, played when a foe starts an attack
  rattle: (S, p, v) => { for (let i = 0; i < 3; i++) S.hiss(0.025, 0.12 * v, 'highpass', 2600 + i * 500, 2200, 2, i * 0.03); },
  bowdraw: (S, p, v) => S.tone('triangle', 200 * p, 420 * p, 0.25, 0.04 * v, 0.1),
  chant: (S, p, v) => { S.tone('sawtooth', 147 * p, 147 * p, 0.5, 0.03 * v, 0.1); S.tone('sawtooth', 220 * p, 220 * p, 0.5, 0.02 * v, 0.1); },
  moan: (S, p, v) => S.tone('sine', 300 * p, 200 * p, 0.6, 0.05 * v, 0.15),
  hiss2: (S, p, v) => S.hiss(0.3, 0.1 * v, 'highpass', 3000 * p, 4500, 1),
  gurgle: (S, p, v) => { for (let i = 0; i < 4; i++) S.tone('sine', 120 + Math.random() * 120, 80, 0.06, 0.08 * v, 0.004, i * 0.05); },
  clack: (S, p, v) => { S.tone('square', 700 * p, 400, 0.03, 0.05 * v); S.tone('square', 900 * p, 500, 0.03, 0.05 * v, 0.002, 0.06); },
  snarl: (S, p, v) => { S.tone('sawtooth', 160 * p, 110, 0.25, 0.06 * v, 0.02); S.hiss(0.25, 0.08 * v, 'bandpass', 700, 400, 3); },
  growlBig: (S, p, v) => { S.tone('sawtooth', 70 * p, 50, 0.6, 0.12 * v, 0.06); S.hiss(0.5, 0.1 * v, 'lowpass', 400, 120, 1); },
  giggle: (S, p, v) => { for (let i = 0; i < 4; i++) S.tone('square', 900 * p + i * 60, 700 * p, 0.05, 0.03 * v, 0.003, i * 0.07); },
  clank: (S, p, v) => { S.tone('square', 520 * p, 480, 0.08, 0.05 * v); S.hiss(0.08, 0.1 * v, 'bandpass', 3000, 2000, 6); },
  grind: (S, p, v) => S.hiss(0.4, 0.14 * v, 'lowpass', 600 * p, 200, 2),
  croak: (S, p, v) => { S.tone('square', 110 * p, 90, 0.12, 0.06 * v); S.tone('square', 120 * p, 80, 0.14, 0.06 * v, 0.004, 0.16); },
  chime: (S, p, v) => { S.tone('sine', 1760 * p, 1760 * p, 0.4, 0.04 * v); S.tone('sine', 2637 * p, 2637 * p, 0.3, 0.02 * v, 0.004, 0.05); },
  trumpet: (S, p, v) => { S.tone('sawtooth', 220 * p, 330 * p, 0.6, 0.08 * v, 0.08); S.tone('sawtooth', 223 * p, 333 * p, 0.6, 0.06 * v, 0.08); },
  whoosh: (S, p, v) => S.hiss(0.35, 0.12 * v, 'bandpass', 400 * p, 1600 * p, 2),
  squeak: (S, p, v) => { S.tone('sine', 2600 * p, 3400 * p, 0.05, 0.03 * v); S.tone('sine', 3000 * p, 2400 * p, 0.05, 0.025 * v, 0.003, 0.06); },
  bossdown: (S, p, v) => { SFX.boom(S, 0.5, v); S.hiss(1.4, 0.12 * v, 'highpass', 2000, 8000, 1, 0.2); },
});
const ENEMY_VOX = { bat: 'squeak', icebat: 'squeak', crystal: 'chime', eggsac: 'gurgle', spiderling: 'hiss2', skeleton: 'rattle', archer: 'bowdraw', cultist: 'chant', ghost: 'moan', spider: 'hiss2', bloat: 'gurgle', beetle: 'clack', thornvine: 'hiss2', wraith: 'moan', wolf: 'snarl', yeti: 'growlBig', snowimp: 'giggle', imp: 'giggle', emberknight: 'clank', bomber: 'giggle', salamander: 'hiss2', golem: 'grind', boneknight: 'clank', crawler: 'rattle', toad: 'croak', shroombrute: 'growlBig', frostmage: 'chime', mammoth: 'trumpet', elemental: 'whoosh', hellhound: 'snarl', mimic: 'snarl', sporeling: 'gurgle', slime: 'gurgle', magma: 'gurgle', banshee: 'moan', firefly: 'chime' };
const VOX_STATES = new Set(['windup', 'aim', 'cast', 'crouch', 'raise', 'swell', 'breathe', 'breath', 'wail', 'bash', 'charge', 'lash', 'channel', 'slam', 'combo']);
for (const k of Object.keys(AI)) {
  const f = AI[k];
  AI[k] = function (e, dt, p) {
    const was = e.st, wasPose = e.pose;
    Sound.atX = e.x;
    try { f(e, dt, p); } finally { Sound.atX = null; }
    if (e.type !== 'enemy' || e.dead) return;
    if ((e.st !== was && VOX_STATES.has(e.st)) || (e.pose === 2 && wasPose !== 2)) {
      if (G.t - (e.voxT ?? -9) < 1.3) return;
      e.voxT = G.t;
      const vox = ENEMY_VOX[e.kind];
      if (vox) Sound.play(vox, { x: e.x, p: e.nem ? 0.7 : e.eliteMods ? 0.85 : rnd(0.94, 1.08), v: e.nem ? 1.1 : 0.75 });
    }
  };
}
// hits, deaths and blasts sound from where they happen
{
  const _de = damageEnemy, _ke = killEnemy, _ex = explode;
  damageEnemy = function (e, amount, o) { const k = Sound.atX; Sound.atX = e ? e.x : null; try { return _de(e, amount, o); } finally { Sound.atX = k; } };
  killEnemy = function (e, info) { const k = Sound.atX; Sound.atX = e ? e.x : null; try { return _ke(e, info); } finally { Sound.atX = k; } };
  explode = function (x, y, r, dmg, o) { const k = Sound.atX; Sound.atX = x; try { return _ex(x, y, r, dmg, o); } finally { Sound.atX = k; } };
}

/* ============================================================
   Music: a small pattern sequencer with instruments
   ============================================================ */
const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], hijaz: [0, 1, 4, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11], harmonic: [0, 2, 3, 5, 7, 8, 11],
};
const MEL = {
  ossuary: [4, null, 2, null, 0, null, 2, 4, 5, null, 4, null, 2, null, null, null],
  frost: [7, null, 9, 7, 4, null, 2, null, 4, null, 7, null, 9, null, 11, null],
  grotto: [0, null, null, 3, null, 1, null, null, 4, null, 3, null, 1, null, 0, null],
  core: [0, null, 1, null, 0, null, -1, null, 0, 1, 3, null, 1, null, 0, null],
  boss: [0, 0, 2, 0, 3, null, 2, 0, 4, null, 3, 2, 1, null, 0, null],
  boss2: [7, null, 6, 4, 6, null, 4, 3, 4, null, 3, 1, 0, null, null, null],
  title: [4, null, null, null, 3, null, 2, null, 4, null, null, null, 7, null, null, null],
  shop: [4, null, 5, 4, null, 2, 4, null, 7, null, 5, null],
  dmt: [0, 4, 7, 11, 14, 11, 7, 4, 2, 6, 9, 13, 16, 13, 9, 6],
};
const SONGS = {
  title: { bpm: 60, root: 45, scale: 'minor', prog: [0, 5, 3, 4], verb: 0.45, amb: 'title',
    step(M, t, s, bar, I, S) {
      const ch = S.prog[bar % 4];
      if (s === 0) { for (const k of [0, 2, 4]) M.inst('choir', M.deg(S, ch + k), t, S.d16 * 16, 0.05); M.inst('bass', M.deg(S, ch) - 12, t, S.d16 * 14, 0.1); }
      if (MEL.title[s] != null && bar % 2 === 0) M.inst('bell', M.deg(S, ch + MEL.title[s]) + 24, t, 1.6, 0.04);
      if (s === 10 && Math.random() < 0.5) M.inst('musicbox', M.deg(S, ch + 4) + 24, t, 1.2, 0.025);
    } },
  ossuary: { bpm: 72, root: 50, scale: 'minor', prog: [0, 5, 3, 4], verb: 0.32, amb: 'ossuary',
    step(M, t, s, bar, I, S) {
      const ch = S.prog[bar % 4], d = S.d16;
      if (s === 0) { for (const k of [0, 2, 4]) M.inst('organ', M.deg(S, ch + k), t, d * 16, 0.028); M.inst('bass', M.deg(S, ch) - 12, t, d * 6, 0.11); }
      if (s === 8) M.inst('bass', M.deg(S, ch) - 12, t, d * 6, 0.08);
      const div = I >= 1 ? 1 : 2;
      if (s % div === 0) { const pat = [0, 2, 4, 7, 4, 2]; M.inst('harpsi', M.deg(S, ch + pat[(s / div) % 6]) + 12, t, d * 2, I >= 1 ? 0.038 : 0.026); }
      if (bar % 2 === 1 && MEL.ossuary[s] != null) M.inst('lead', M.deg(S, ch + MEL.ossuary[s]) + 12, t, d * 2.6, I >= 1 ? 0.03 : 0.022);
      if (I >= 1) { if (s % 8 === 0) M.drum('kick', t, 0.3); if (s % 8 === 4) M.drum('snare', t, 0.1); if (s % 2 === 1) M.drum('hat', t, 0.035); }
      else if (s === 0) M.drum('tom', t, 0.08, 75);
    } },
  grotto: { bpm: 66, root: 52, scale: 'phrygian', prog: [0, 1, 5, 0], verb: 0.22, amb: 'grotto',
    step(M, t, s, bar, I, S) {
      const ch = S.prog[bar % 4], d = S.d16;
      if (s === 0) { M.inst('pad', M.deg(S, ch) - 12, t, d * 16, 0.04); M.inst('pad', M.deg(S, ch + 4) - 12, t, d * 16, 0.03); M.inst('bass', M.deg(S, ch) - 12, t, d * 8, 0.1); }
      if ([0, 3, 6, 8, 11, 14].includes(s) || (I >= 1 && s % 2 === 1)) { const k = [0, 2, 4, 7, 9][(s * 3 + bar) % 5]; M.inst('marimba', M.deg(S, ch + k) + 12, t, d * 3, 0.06); }
      if (MEL.grotto[s] != null && bar % 4 >= 2) M.inst('marimba', M.deg(S, ch + MEL.grotto[s]) + 24, t, d * 2, 0.04);
      if (Math.random() < 0.08) M.inst('bell', M.deg(S, rnd(0, 14) | 0) + 24, t, 0.6, 0.02);
      if (I >= 1) { if (s % 2 === 1) M.drum('shaker', t, 0.04); if (s === 0 || s === 10) M.drum('tom', t, 0.18, 95); if (s === 6) M.drum('tom', t, 0.12, 130); }
    } },
  frost: { bpm: 70, root: 62, scale: 'dorian', prog: [0, 3, 5, 4], verb: 0.42, amb: 'frost',
    step(M, t, s, bar, I, S) {
      const ch = S.prog[bar % 4], d = S.d16;
      if (s === 0) { for (const k of [0, 2, 4]) M.inst('choir', M.deg(S, ch + k) - 12, t, d * 16, 0.04); M.inst('bass', M.deg(S, ch) - 24, t, d * 12, 0.09); }
      if (MEL.frost[s] != null) M.inst('musicbox', M.deg(S, ch + MEL.frost[s]) + 12, t, 1.2, bar % 2 ? 0.035 : 0.045);
      if (Math.random() < 0.06) M.inst('bell', M.deg(S, ch + 7) + 24, t, 1, 0.02);
      if (I >= 1) { if (s % 8 === 0) M.drum('kick', t, 0.22); if (s % 2 === 0) M.drum('hat', t, 0.03); if (s % 4 === 2) M.inst('bass', M.deg(S, ch) - 12, t, d * 2, 0.08); }
    } },
  core: { bpm: 90, root: 40, scale: 'hijaz', prog: [0, 0, 1, 0], verb: 0.16, amb: 'core',
    step(M, t, s, bar, I, S) {
      const ch = S.prog[bar % 4], d = S.d16;
      const taiko = { 0: 0.4, 3: 0.2, 6: 0.28, 8: 0.36, 10: 0.2, 12: 0.3, 14: 0.15 };
      if (taiko[s] != null && (I >= 1 || s % 4 === 0)) M.drum('taiko', t, taiko[s] * (I >= 1 ? 1 : 0.6));
      if (s % 2 === 0) M.inst('bass', M.deg(S, ch + (s % 8 === 6 ? 1 : 0)) + (s % 4 === 2 ? 12 : 0), t, d * 1.6, 0.1);
      if ((s === 0 || s === 10) && bar % 2 === 0) for (const k of [0, 2, 4]) M.inst('brass', M.deg(S, ch + k) + 12, t, d * 3, 0.03);
      if (I >= 1 && MEL.core[s] != null && bar % 2 === 1) M.inst('lead', M.deg(S, ch + MEL.core[s]) + 24, t, d * 2, 0.026);
      if (I >= 1 && s % 4 === 2) M.drum('snare', t, 0.06);
    } },
  boss: { bpm: 140, root: 45, scale: 'harmonic', prog: [0, 0, 5, 4], verb: 0.2,
    step(M, t, s, bar, I, S) {
      const ch = S.prog[bar % 4], d = S.d16, A = M.flavor;
      if (s % 2 === 0) M.inst('bass', M.deg(S, ch) - 12 + (s % 4 === 2 ? 12 : 0), t, d * 1.8, 0.12);
      if (s % 4 === 0) M.drum('kick', t, 0.38); if (s % 8 === 4) M.drum('snare', t, 0.14); M.drum('hat', t, s % 2 ? 0.02 : 0.035);
      const mel = bar % 4 < 2 ? MEL.boss : MEL.boss2;
      if (mel[s] != null) M.inst('lead', M.deg(S, ch + mel[s]) + 12, t, d * 1.8, 0.03);
      if (s % 2 === 1) M.inst('pluck', M.deg(S, ch + [0, 2, 4, 7][(s >> 1) % 4]) + 24, t, d, 0.022);
      if (s === 0) for (const k of [0, 2, 4]) M.inst(A === 0 ? 'organ' : A === 1 ? 'pad' : A === 2 ? 'choir' : 'brass', M.deg(S, ch + k), t, d * 16, 0.025);
      if (A === 3 && (s === 0 || s === 6 || s === 10)) M.drum('taiko', t, 0.3);
    } },
  shop: { bpm: 108, root: 53, scale: 'major', prog: [0, 3, 4, 0], steps: 12, verb: 0.25,
    step(M, t, s, bar, I, S) {
      const ch = S.prog[bar % 4], d = S.d16;
      if (s === 0) M.inst('bass', M.deg(S, ch) - 12, t, d * 3, 0.12);
      if (s === 4 || s === 8) for (const k of [2, 4]) M.inst('pluck', M.deg(S, ch + k), t, d * 2, 0.035);
      if (MEL.shop[s] != null) M.inst('musicbox', M.deg(S, ch + MEL.shop[s]) + 12, t, 0.9, 0.04);
    } },
  dmt: { bpm: 96, root: 60, scale: 'lydian', prog: [0, 1, 0, 6], verb: 0.55, amb: 'dmt',
    step(M, t, s, bar, I, S) {
      const ch = S.prog[bar % 4], d = S.d16;
      M.sweep(t, 1400 + Math.sin((bar * 16 + s) / 10) * 1100);
      if (s === 0) { for (const k of [0, 2, 4, 6]) M.inst('choir', M.deg(S, ch + k), t, d * 16, 0.035); M.inst('pad', M.deg(S, ch) - 12, t, d * 16, 0.05); }
      M.inst(s % 2 ? 'bell' : 'musicbox', M.deg(S, ch + MEL.dmt[(s + bar * 3) % 16]) + (Math.random() < 0.2 ? 12 : 0), t, 0.7, 0.025);
      if (Math.random() < 0.15) M.inst('lead', M.deg(S, ch + ((Math.random() * 14) | 0)) + 12, t, d * 3, 0.018);
      if (s % 4 === 0) M.drum('shaker', t, 0.03);
    } },
};
SONGS.nemesis = { bpm: 152, root: 41, scale: 'phrygian', prog: [0, 1, 0, 6], verb: 0.3,
  step(M, t, s, bar, I, S) {
    const ch = S.prog[bar % 4], d = S.d16;
    if (s % 2 === 0) M.inst('bass', M.deg(S, ch) - 12 + (s % 8 === 6 ? 1 : 0), t, d * 1.6, 0.13);
    if (s % 4 === 0 || s === 14) M.drum('kick', t, 0.4); if (s % 8 === 4) M.drum('snare', t, 0.16);
    M.drum(s % 2 ? 'hat' : 'shaker', t, 0.035);
    if (s === 0 || s === 3 || s === 6 || s === 10) for (const k of [0, 1, 4]) M.inst('brass', M.deg(S, ch + k) + 12, t, d * 1.5, 0.028);
    if (s % 2 === 1) M.inst('lead', M.deg(S, ch + ((s * 5 + bar * 3) % 9)) + 24 + (Math.random() < 0.15 ? 1 : 0), t, d * 0.9, 0.022);
    if (s === 8 && bar % 2 === 1) M.sweep(t, 600 + Math.random() * 3200);
    if (Math.random() < 0.05) M.drum('taiko', t, 0.25);
  } };
const STINGERS = {
  bossdown: (M, t) => { [55, 59, 62, 67, 71, 74, 79].forEach((m, i) => M.inst('brass', m, t + 0.3 + i * 0.07, 0.6, 0.03)); M.inst('choir', 67, t + 0.8, 2.4, 0.05); M.inst('choir', 71, t + 0.8, 2.4, 0.04); M.inst('bell', 91, t + 0.8, 2.4, 0.04); M.drum('taiko', t + 0.3, 0.4); },
  victory: (M, t) => { const n = [60, 64, 67, 72, 76, 79, 84]; n.forEach((m, i) => M.inst('lead', m, t + i * 0.09, 0.3, 0.04)); for (const m of [60, 64, 67, 72]) M.inst('brass', m, t + 0.65, 1.8, 0.035); M.inst('bell', 96, t + 0.65, 2, 0.04); M.drum('taiko', t + 0.65, 0.35); },
  death: (M, t) => { [64, 63, 60, 57, 55].forEach((m, i) => M.inst('choir', m - 12, t + i * 0.32, 0.9, 0.05)); M.inst('bass', 33, t + 1.4, 3, 0.12); M.drum('tom', t + 1.4, 0.2, 60); },
};
Object.assign(Music, {
  songKey: '', song: null, flavor: 0, ambKey: '', ambNodes: null,
  attach(c, bus) {
    this.c = c; this.bus = bus;
    this.filt = c.createBiquadFilter(); this.filt.type = 'lowpass'; this.filt.frequency.value = 2200; this.filt.Q.value = 0.5;
    this.filt.connect(bus);
    this.out = this.filt;
    this.bright = c.createBiquadFilter(); this.bright.type = 'highpass'; this.bright.frequency.value = 300; this.bright.connect(this.filt);
    this.dark = c.createBiquadFilter(); this.dark.type = 'lowpass'; this.dark.frequency.value = 1400; this.dark.connect(this.filt);
    this.delayIn = c.createGain(); this.delayIn.gain.value = 1; this.delayIn.connect(this.filt);
    const dl = c.createDelay(1.5), fb = c.createGain(), wet = c.createGain();
    dl.delayTime.value = 0.375; fb.gain.value = 0.32; wet.gain.value = 0.28;
    this.delayIn.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(this.filt);
    if (!this.timer) this.timer = setInterval(() => this.tick(), 50);
  },
  set(act, intensity) {
    this.act = act; this.intensity = intensity;
    if (act < 0) { this.play(''); this.setAmb(''); return; }
    let key = ACTS[act % ACTS.length].id;
    if (G.demo) key = 'title';
    else if (intensity >= 2) { this.flavor = act % ACTS.length; SONGS.boss.root = [45, 40, 50, 40][this.flavor]; key = 'boss'; }
    this.play(key);
    if (this.filt && this.c) this.filt.frequency.setTargetAtTime(intensity >= 2 ? 3600 : intensity === 1 ? 2800 : 1900, this.c.currentTime, 0.4);
    this.setAmb((SONGS[key] && SONGS[key].amb) || '');
  },
  theme(name) {
    if (SONGS[name] && name !== 'boss') { this.play(name); this.setAmb((SONGS[name] && SONGS[name].amb) || ''); if (this.filt && this.c) this.filt.frequency.setTargetAtTime(2600, this.c.currentTime, 0.3); }
  },
  stinger(name) {
    if (!this.c || !STINGERS[name]) return;
    this.play(''); this.setAmb('');
    try { STINGERS[name](this, this.c.currentTime + 0.05); } catch (e) { /* best effort */ }
  },
  play(key) {
    if (key === this.songKey) return;
    this.songKey = key; this.song = key ? SONGS[key] : null; this.step = 0; this.nextT = 0;
    if (this.filt && this.c) { const fq = this.filt.frequency, now = this.c.currentTime; fq.cancelScheduledValues(now); fq.setValueAtTime(fq.value, now); }
    if (this.song && Sound.verbIn && this.c) Sound.verbIn.gain.setTargetAtTime(this.song.verb || 0.24, this.c.currentTime, 0.5);
  },
  stop() { this.play(''); },
  note(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  deg(S, d) { const sc = SCALES[S.scale], o = Math.floor(d / 7); return S.root + sc[((d % 7) + 7) % 7] + 12 * o; },
  v(type, f, t, dur, vol, att = 0.01, rel = 0.1, dest = null, det = 0, vib = 0) {
    const c = this.c, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (det) o.detune.value = det;
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = vib; lg.gain.value = f * 0.01; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.1); }
    const a = Math.max(0.002, Math.min(att, dur * 0.8)), hold = Math.max(a, dur - rel);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a); g.gain.setValueAtTime(Math.max(0.0002, vol), t + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
    o.connect(g); g.connect(dest || this.out); o.start(t); o.stop(t + dur + 0.08);
  },
  inst(name, midi, t, dur, vol) {
    const f = this.note(midi);
    switch (name) {
      case 'pad': this.v('triangle', f, t, dur, vol, dur * 0.3, dur * 0.4, null, -7); this.v('triangle', f, t, dur, vol, dur * 0.3, dur * 0.4, null, 7); this.v('sine', f, t, dur, vol * 0.8, dur * 0.25, dur * 0.4); break;
      case 'organ': this.v('square', f, t, dur, vol * 0.35, 0.05, 0.2, this.dark); this.v('sine', f * 2, t, dur, vol * 0.5, 0.05, 0.2); this.v('sine', f / 2, t, dur, vol * 0.6, 0.08, 0.25); break;
      case 'harpsi': this.v('sawtooth', f, t, Math.min(dur, 0.45), vol, 0.002, 0.4, this.bright); this.v('square', f * 2, t, 0.1, vol * 0.25, 0.002, 0.08, this.bright); break;
      case 'bass': this.v('sine', f, t, dur, vol, 0.01, dur * 0.6); this.v('triangle', f, t, dur * 0.7, vol * 0.35, 0.01, dur * 0.4); break;
      case 'pluck': this.v('triangle', f, t, Math.min(dur, 0.35), vol, 0.003, 0.3); break;
      case 'lead': this.v('square', f, t, dur, vol * 0.55, 0.015, dur * 0.35, this.delayIn, 0, 5.5); this.v('sawtooth', f, t, dur, vol * 0.3, 0.02, dur * 0.35, this.delayIn, 6); break;
      case 'bell': this.v('sine', f, t, dur, vol, 0.002, dur * 0.95); this.v('sine', f * 2.76, t, dur * 0.4, vol * 0.35, 0.002, dur * 0.38); this.v('sine', f * 5.4, t, dur * 0.15, vol * 0.15, 0.002, dur * 0.14); break;
      case 'marimba': this.v('sine', f, t, 0.45, vol, 0.002, 0.43); this.v('sine', f * 4, t, 0.08, vol * 0.4, 0.001, 0.07); break;
      case 'musicbox': this.v('sine', f, t, 1.3, vol, 0.002, 1.25); this.v('sine', f * 3, t, 0.3, vol * 0.25, 0.002, 0.28); break;
      case 'brass': this.v('sawtooth', f, t, dur, vol * 0.5, 0.05, dur * 0.4, this.dark); this.v('sawtooth', f, t, dur, vol * 0.4, 0.06, dur * 0.4, this.dark, 9); break;
      case 'choir': for (const det of [-10, 0, 10]) this.v('sine', f, t, dur, vol * 0.4, dur * 0.35, dur * 0.4, null, det, 4.5); this.v('triangle', f * 2, t, dur, vol * 0.1, dur * 0.4, dur * 0.4); break;
    }
  },
  drum(kind, t, vol, f0 = 110) {
    const c = this.c;
    const noise = (dur, type, freq, v, q = 1) => { const s = c.createBufferSource(); s.buffer = Sound.noise; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = freq; fl.Q.value = q; const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(this.bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02); };
    const thump = (fa, fb, dur, v) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(fa, t); o.frequency.exponentialRampToValueAtTime(fb, t + dur * 0.8); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + 0.02); };
    if (kind === 'kick') thump(130, 40, 0.24, vol);
    else if (kind === 'snare') { noise(0.16, 'highpass', 1500, vol); thump(200, 150, 0.08, vol * 0.4); }
    else if (kind === 'hat') noise(0.04, 'highpass', 7500, vol);
    else if (kind === 'shaker') noise(0.06, 'bandpass', 5500, vol, 2);
    else if (kind === 'tom') thump(f0, f0 * 0.55, 0.32, vol);
    else if (kind === 'taiko') { thump(95, 48, 0.5, vol); noise(0.18, 'lowpass', 500, vol * 0.5); }
  },
  sweep(t, f) { if (this.filt) this.filt.frequency.setTargetAtTime(Math.max(300, f), t, 0.1); },
  setAmb(key) {
    if (key === this.ambKey || !this.c) return;
    this.ambKey = key;
    if (this.ambNodes) { const n = this.ambNodes; try { n.g.gain.setTargetAtTime(0.0001, this.c.currentTime, 0.4); setTimeout(() => { try { n.src.stop(); n.lfo && n.lfo.stop(); } catch (e) { /* done */ } }, 1500); } catch (e) { /* done */ } this.ambNodes = null; }
    const cfg = { ossuary: ['bandpass', 380, 0.035, 0.07], grotto: ['lowpass', 500, 0.03, 0.05], frost: ['bandpass', 700, 0.06, 0.12], core: ['lowpass', 180, 0.08, 0.04], title: ['bandpass', 300, 0.025, 0.05], dmt: ['bandpass', 1200, 0.025, 0.3] }[key];
    if (!cfg) return;
    try {
      const c = this.c, src = c.createBufferSource(); src.buffer = Sound.noise; src.loop = true;
      const fl = c.createBiquadFilter(); fl.type = cfg[0]; fl.frequency.value = cfg[1]; fl.Q.value = 1.5;
      const g = c.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(cfg[2], c.currentTime, 1);
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = cfg[3]; lg.gain.value = cfg[1] * 0.6; lfo.connect(lg); lg.connect(fl.frequency);
      src.connect(fl); fl.connect(g); g.connect(this.bus); src.start(); lfo.start();
      this.ambNodes = { src, g, lfo };
    } catch (e) { this.ambNodes = null; }
  },
  ambEvents(t) {
    const k = this.ambKey;
    if (k === 'grotto' && Math.random() < 0.05) this.v('sine', 900 + Math.random() * 900, t, 0.12, 0.03, 0.002, 0.1);
    if (k === 'ossuary' && Math.random() < 0.015) { this.v('sine', 1300 + Math.random() * 500, t, 0.1, 0.02, 0.002, 0.08); }
    if (k === 'core' && Math.random() < 0.06) { const s = this.c.createBufferSource(); s.buffer = Sound.noise; const g = this.c.createGain(); g.gain.setValueAtTime(0.02, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03); s.connect(g); g.connect(this.bus); s.start(t, Math.random()); s.stop(t + 0.05); }
    if (k === 'dmt' && Math.random() < 0.04) this.v('sine', 300 + Math.random() * 2400, t, 0.5, 0.015, 0.2, 0.3);
  },
  tick() {
    const c = this.c;
    if (!c || c.state !== 'running' || Sound.vol.music <= 0) { this.nextT = 0; return; }
    if (!this.nextT || this.nextT < c.currentTime) this.nextT = c.currentTime + 0.05;
    const S = this.song;
    while (this.nextT < c.currentTime + 0.22) {
      const t = this.nextT;
      if (S) {
        const steps = S.steps || 16;
        S.d16 = 15 / S.bpm;
        const s = this.step % steps, bar = Math.floor(this.step / steps);
        try { S.step(this, t, s, bar, this.intensity || 0, S); } catch (e) { /* keep playing */ }
        this.step++;
        this.nextT += S.d16;
      } else this.nextT += 0.1;
      this.ambEvents(t);
    }
  },
});
hook('onRoomEnter', (r, prev) => {
  if (r.type === 'shop') Music.theme('shop');
  else if (prev && prev.type === 'shop' && r.type !== 'dmt') Music.set(G.fl.actIdx, G.combat ? 1 : 0);
});
// stingers and the chaos theme
hook('death', () => Music.stinger('death'));
hook('runEnd', (run, won) => { if (won) Music.stinger('victory'); });
{
  const _bd = bossDefeated;
  bossDefeated = function (e) { const r = _bd(e); Music.stinger('bossdown'); Sound.play('bossdown'); return r; };
  const _sn = spawnNemesis;
  spawnNemesis = function (nem, x, y, r) { const e = _sn(nem, x, y, r); if (e) Music.theme('nemesis'); return e; };
}
hook('bossStart', (e) => { const nem = G.fl && G.fl.nemesisBoss; if (nem && e.kind === nem.kind) Music.theme('nemesis'); });
hook('onKill', (e) => { if (e.nem && !e.boss && Music.songKey === 'nemesis') Music.set(G.fl.actIdx, G.combat ? 1 : 0); });

