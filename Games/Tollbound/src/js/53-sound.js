// 53-sound.js: the sound engine. One AudioContext, made on the first touch, click or key; buses for effects and
// music into a gentle limiter, with a shared stone-room reverb; effects defined as recipes that build the nodes of
// one playing, kept within limits so that a crowd of hundreds cannot drown the mix or choke the page; and the
// helpers recipes are built from: the bell, tones, noise, clicks, creaks, crackle, water and envelopes.
// Everything is synthesized: noise, the room's impulse and the crackle are generated, never recorded.
// Owns: Sound
// Public:
//   Sound.define(id, recipe, limits)   registers an effect, while files load or later; an id is defined once.
//                                      recipe(ctx, out, t, opts) builds and schedules the nodes of one playing
//                                      into out (a GainNode), from time t on ctx's clock, and returns the time
//                                      it falls silent (else t + limits.length counts). opts is what Sound.sfx
//                                      or Sound.render was given, {} if nothing; the recipe applies opts.pitch
//                                      (a frequency ratio, 1 if absent) itself. limits, all optional:
//                                        gap: 0.03      seconds between two playings of one key
//                                        cap: 4         playings of this effect sounding at once
//                                        priority: 1    a playing gives way only to one of this priority or higher
//                                        wet: 0.2       the share of it sent to the room
//                                        level: 1       its loudness against the other effects
//                                        length: 1      seconds it lasts, when the recipe does not say
//                                        crowd: false   true for an effect that may fire many times a second
//   Sound.has(id) -> boolean
//   Sound.list() -> [id]               the effects, in the order they were defined
//   Sound.info(id) -> {id, gap, cap, priority, wet, level, length, crowd} | null     a copy
//   Sound.sfx(id, opts) -> handle      plays an effect: a number above 0, or 0 when nothing starts. opts:
//                                        x, y    its place on the ground: panned by where Gfx.worldToScreen puts
//                                                it on the screen, and quieter the further off the screen it is
//                                        level   1 is as defined          pitch   1 is as defined
//                                        key     a number or a string naming its source: the gap and merging
//                                                hold between calls of one key; calls without a key share one
//                                        wet     the share sent to the room, instead of the effect's own
//                                      and whatever its recipe reads (note, ...). A call in the same instant as a
//                                      playing of the same effect and key is merged into it (the handle is that
//                                      playing's), and the playing grows a little louder; a call inside the gap
//                                      is dropped. When the effect's cap or the engine's limit is reached, a
//                                      playing gives way: the quietest of the lowest priority. One of a lower
//                                      priority always does; one of the same priority only when what is left of
//                                      it is under 0.8 of the new one's level, so that like sounds in a stream
//                                      never push one another out. Otherwise the new one is dropped. A dropped
//                                      call allocates nothing.
//                                      Before the first gesture, while suspended or hidden, and where there is
//                                      no WebAudio, it does nothing and returns 0.
//   Sound.stop(handle, fade = 0.08)    ends one playing early, fading out over fade seconds
//   Sound.stopAll(fade = 0.08)         ends every playing; with fade 0 at once
//   Sound.render(id | recipe, opts, seconds) -> Promise<Float32Array | null>
//                                      one playing in an OfflineAudioContext, and its samples: mono, 48 kHz (or
//                                      opts.rate), at the level and pitch opts give, panned nowhere, through no
//                                      limiter; opts.room adds the reverb. seconds defaults to the effect's
//                                      length + 0.5. The same arguments make the same random choices (opts.seed
//                                      picks others), so the same sound: only the browser's rounding, which may
//                                      sum the nodes in another order, differs, by about 1e-7. null where the
//                                      browser has no WebAudio. Rejects for an id that is not defined.
//   Sound.bake(id | recipe, opts, seconds) -> Promise<AudioBuffer | null>
//                                      the same rendering as an AudioBuffer at the context's sample rate (48 kHz
//                                      before there is one), to be played again and again with Sound.replay: a
//                                      sound made once by code and then played for the price of two nodes
//   Sound.suspend(), Sound.resume()    silences the engine, and lets it sound again. A hidden page also
//                                      suspends it, until the page is shown.
//   Sound.state                        'off' (no WebAudio), 'waiting' (no touch, click or key yet), else the
//                                      context's own: 'running', 'suspended', 'interrupted' or 'closed'. A value.
//   Sound.context                      the AudioContext, or null until the first gesture. A value.
//   Sound.live() -> boolean            can a sound start now: the context runs (or is being woken by a gesture),
//                                      and neither Sound.suspend nor a hidden page holds it
//   Sound.now() -> seconds             the engine's clock: the context's, or the stand-in's
//   Sound.clock(fn)                    a stand-in clock, for tests: fn() -> seconds; null gives back the context's.
//                                      The effects forget their last playings (gaps, merging) at each change.
//   Sound.bus(name) -> {dry, wet} | null   the two inputs of the bus 'effects' or 'music': what goes into dry is
//                                      heard as it is, what goes into wet only through the room. null until the
//                                      context exists.
//   Sound.stats(id) -> {...}           counts, as a fresh copy. For the engine: {state, voices (sounding now),
//                                      most (the most at once), limit, started, merged, dropped, stolen, quiet
//                                      (calls while nothing could sound)}; for one effect: {id, voices, started,
//                                      merged, dropped, stolen}, or null.
// The helpers. Each builds into out from time t and returns the time it falls silent. A field left out takes the
// default shown. spec.keep, when it is an array, receives every source node made, for a caller that has to stop
// them early (a drone); the same caller stops them with node.stop(time).
//   Sound.env(param, t, {level: 1, attack: 0.003, hold: 0, decay: 0.3}) -> end
//                                      from 0 up to level in attack, held for hold, then down by 60 dB in decay
//   Sound.tone(ctx, out, t, {type: 'sine', freq | note, to, glide, detune, ...envelope}) -> end
//                                      an oscillator; to: a frequency it glides to, over glide (default: all of it)
//   Sound.noise(ctx, out, t, {color: 'white' | 'pink' | 'brown', filter, freq: 1000, to, glide, q: 0.8,
//                ...envelope}) -> end  noise, through a filter ('lowpass', 'highpass', 'bandpass') if one is named
//   Sound.bell(ctx, out, t, {note | freq, weight: 0.5, muffled: 0, cracked: 0, level: 1, length, partials: 11,
//               beat}) -> end          one strike of a bell whose prime is the note: the hum an octave below it,
//                                      the prime, the tierce a minor third above, the quint a fifth above, the
//                                      nominal an octave above, then six weaker partials higher still. The high
//                                      partials are loud at once and die in a fraction of a second; the hum rings
//                                      on. weight 0 to 1, a handbell to a great bell: a stronger hum, and a longer
//                                      ring (length, when given, is how long the hum rings, in seconds). muffled
//                                      0 to 1 takes the attack off and dulls the strike; cracked 0 to 1 makes it
//                                      buzz and die quickly. The hum and the tierce are doublets, each two
//                                      partials a little apart, which beat slowly: the hum's beat hertz apart
//                                      (from 0.7 to 1.6, at random, when left out; 0 for no doublets), the
//                                      tierce's 1.6 times as far. partials: how many sound, from the hum up.
//   Sound.replay(ctx, out, t, buffer, {level: 1, rate: 1}) -> end   plays a buffer from Sound.bake (rate also
//                                      changes its pitch)
//   Sound.click(ctx, out, t, {freq: 2400, q: 6, level: 0.5, decay: 0.02}) -> end   rope and wood: one tick
//   Sound.creak(ctx, out, t, {rate: 60, to, body: 700, q: 8, ...envelope}) -> end  wood under strain
//   Sound.crackle(ctx, out, t, {freq: 1800, rate: 1, ...envelope}) -> end          wax and flame
//   Sound.water(ctx, out, t, {freq: 450, rate: 0.13, ...envelope}) -> end           water, moving slowly
//   Sound.note(n) -> Hz                a MIDI note number (69 is A4 at 440 Hz; fractions allowed) or a name such
//                                      as 'D3', 'F#2' or 'Bb4'; NaN for anything else
//   Sound.rand() -> [0, 1)             the engine's own random stream, for variety (the simulation's stays apart)
//   Sound.vary(x, spread) -> number    x moved up or down by at most spread times itself, at random
// Levels follow the settings 'sound.master', 'sound.effects' and 'sound.music' (0 to 1; defaults 0.8, 0.8 and
// 0.6), declared with Settings.define when the build has settings; a value v gives the bus a gain of v * v.
(function () {
  'use strict';

  const abs = Math.abs, max = Math.max, min = Math.min, floor = Math.floor, pow = Math.pow, exp = Math.exp;
  const clamp = Core.clamp;

  const LEAD = 0.006;                 // seconds from now to the start of a sound: its first ramp is not in the past
  const MERGE = 0.024;                // seconds: calls this close together are one instant
  const MERGE_MAX = 1.8;              // a merged playing grows at most this much louder
  const KEYS = 6;                     // keys one effect keeps track of for its gap; the oldest gives way
  const QUIET = 0.02;                 // a playing softer than this is not worth starting
  const YIELD = 0.8;                  // a playing gives way to one of its own priority under this share of its level
  const PAN_WIDTH = 0.8, PAN_MAX = 0.85;
  const OFF_SCREEN = 2.5;             // off the screen, a sound is 1 / (1 + OFF_SCREEN * screens away) as loud
  const LIMIT_WIDE = 32, LIMIT_TOUCH = 24, SPARE = 16;   // voices sounding at once; room for the ones fading out
  const FADE = 0.08, STEAL = 0.025, PAD = 0.05;          // seconds: a stop, a steal, and the wait before release
  const UNLOCK_MS = 1000;             // a gesture's resume may take this long before sounds are refused again
  const IR_SECONDS = 2.6, RT60 = 2.3, PREDELAY = 0.019, ROOM_RETURN = 0.55;
  const REFLECTIONS = [0.011, 0.55, 0.023, -0.42, 0.031, 0.36, 0.047, -0.3, 0.059, 0.24, 0.077, 0.19];   // time, gain
  // The limiter: a soft knee from -6 dB. The browser adds makeup gain (1.278 with these numbers, measured in
  // Chromium), and the gain after it takes that back, so that what is not loud passes at its own level.
  const LIMITER = { threshold: -6, knee: 6, ratio: 12, attack: 0.003, release: 0.25 }, MAKEUP = 1.2783;
  const SETTINGS = [['sound.master', 0.8, 'Master volume', 30], ['sound.effects', 0.8, 'Effects', 31], ['sound.music', 0.6, 'Music', 32]];
  const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'mousedown', 'keydown', 'click'];
  const NONE = Object.freeze({});
  const noop = function () {};

  // The partials of one strike, three numbers each: the ratio to the prime, the amplitude at the strike, and the
  // seconds it takes to fall 60 dB in the heaviest bell. The hum, prime, tierce, quint and nominal come first.
  const PARTIALS = [
    0.5, 0.6, 14,    1, 0.36, 8,    1.2, 0.34, 6,    1.5, 0.22, 3.6,    2, 0.5, 4.5,
    2.5, 0.17, 1.8,  2.67, 0.11, 1.2,  3, 0.18, 0.9,  4, 0.13, 0.5,  5.33, 0.09, 0.25,  6.85, 0.06, 0.13,
  ];
  const NOMINAL = 4;                  // the nominal and the partials above it carry the brightness of the strike
  const TWIN = 0.28;                  // the share of a doublet's partial in its twin: it beats at about half depth
  const LETTERS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

  const num = function (v, d) { return typeof v === 'number' && v === v && v !== Infinity && v !== -Infinity ? v : d; };
  const amount = function (v) { return v === true ? 1 : clamp(num(v, 0), 0, 1); };

  // ---- the engine's own random stream (xorshift) ----

  let rs = 0x2545f491;
  function rand() {
    rs ^= rs << 13;
    rs ^= rs >>> 17;
    rs ^= rs << 5;
    return (rs >>> 0) / 4294967296;
  }
  Sound.rand = rand;
  Sound.vary = function (x, spread) { return x * (1 + spread * (2 * rand() - 1)); };

  // ---- state ----

  let ctx = null, graph = null, failed = false, wanted = true, visible = true, wired = false, unlocking = 0;
  let stand = null;                    // the stand-in clock
  let limit = LIMIT_WIDE;
  const pool = [];                     // voice records, made with the context; busy ones are playings
  let used = 0, sounding = 0, most = 0, uid = 0;
  const totals = { started: 0, merged: 0, dropped: 0, stolen: 0, quiet: 0 };
  const defs = new Map(), order = [];
  const levels = {};                   // the settings' values, 0 to 1
  for (let i = 0; i < SETTINGS.length; i++) levels[SETTINGS[i][0]] = SETTINGS[i][1];

  function hasWebAudio() {
    return typeof window.AudioContext === 'function' || typeof window.webkitAudioContext === 'function';
  }

  function clockNow() {
    if (stand !== null) return num(+stand(), 0);
    return ctx !== null ? ctx.currentTime : 0;
  }

  function canPlay() {
    if (ctx === null || graph === null || !wanted || !visible) return false;
    const state = ctx.state;
    return state === 'running' || (state !== 'closed' && unlocking > 0 && Plat.now() - unlocking < UNLOCK_MS);
  }

  Object.defineProperty(Sound, 'state', {
    enumerable: true,
    get: function () {
      if (failed) return 'off';
      if (ctx === null) return hasWebAudio() ? 'waiting' : 'off';
      return ctx.state;
    },
  });
  Object.defineProperty(Sound, 'context', { enumerable: true, get: function () { return ctx; } });

  Sound.live = canPlay;
  Sound.now = clockNow;
  // Another clock: what the effects remember of their last playings is of the old one, and is forgotten.
  Sound.clock = function (fn) {
    stand = typeof fn === 'function' ? fn : null;
    defs.forEach(function (d) { d.keyN = 0; });
  };
  Sound.bus = function (name) {
    if (graph === null) return null;
    return name === 'music' ? graph.music : name === 'effects' ? graph.fx : null;
  };

  // ---- generated buffers: noise, crackle and the room ----
  // Kept by sample rate: a buffer serves every context of its rate. Each kind has its own fixed seed, so a buffer
  // is the same every time it is made, and so is an offline rendering that uses it.

  const made = new Map();             // sample rate -> {kind: AudioBuffer}

  function seeded(seed) {
    let s = seed | 0;
    return function () {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296 * 2 - 1;
    };
  }

  // Scales the samples to the root mean square asked for.
  function toRms(data, rms) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const k = sum > 0 ? rms / Math.sqrt(sum / data.length) : 0;
    for (let i = 0; i < data.length; i++) data[i] *= k;
  }

  function makeNoise(c, kind) {
    const rate = c.sampleRate, seconds = kind === 'white' ? 2 : kind === 'pink' ? 4 : 6;
    const buf = c.createBuffer(1, floor(rate * seconds), rate), d = buf.getChannelData(0);
    const w = seeded(kind === 'white' ? 0x51a7e : kind === 'pink' ? 0x9101c : 0xb2097);
    if (kind === 'white') {
      for (let i = 0; i < d.length; i++) d[i] = w();
    } else if (kind === 'pink') {
      // white noise through four one-pole lowpasses two octaves apart, summed: close to -3 dB an octave
      const k = [exp(-6.283 * 40 / rate), exp(-6.283 * 160 / rate), exp(-6.283 * 640 / rate), exp(-6.283 * 2560 / rate)];
      let a = 0, b = 0, cc = 0, e = 0;
      for (let i = 0; i < d.length; i++) {
        const x = w();
        a = k[0] * a + (1 - k[0]) * x * 8;
        b = k[1] * b + (1 - k[1]) * x * 4;
        cc = k[2] * cc + (1 - k[2]) * x * 2;
        e = k[3] * e + (1 - k[3]) * x;
        d[i] = a + b + cc + e + x * 0.25;
      }
    } else {
      let b = 0;   // brown: a leaky running sum
      for (let i = 0; i < d.length; i++) {
        b = b * 0.996 + w() * 0.06;
        d[i] = b;
      }
    }
    toRms(d, 0.3);
    return buf;
  }

  // Wax and flame: silence broken by small cracks, about twenty a second, of every size.
  function makeCrackle(c) {
    const rate = c.sampleRate, buf = c.createBuffer(1, floor(rate * 4), rate), d = buf.getChannelData(0);
    const w = seeded(0xc4ac1e);
    let at = 0;
    while (at < d.length) {
      at += floor(rate * (0.004 + 0.09 * (w() * 0.5 + 0.5) * (w() * 0.5 + 0.5)));
      const size = pow(w() * 0.5 + 0.5, 2.2), len = floor(rate * (0.0006 + 0.003 * (w() * 0.5 + 0.5)));
      for (let i = 0; i < len && at + i < d.length; i++) d[at + i] += w() * size * exp(-5 * i / len);
      at += len;
    }
    let peak = 0;
    for (let i = 0; i < d.length; i++) peak = max(peak, abs(d[i]));
    if (peak > 0) for (let i = 0; i < d.length; i++) d[i] *= 0.9 / peak;
    return buf;
  }

  // A stone room: two channels of noise that darkens as it dies away, 60 dB down after RT60 seconds, behind a few
  // early echoes from near walls; the two channels hear the walls at slightly different times. Each channel has
  // the energy of a single unit impulse, so the room is as loud as what is sent into it.
  function makeRoom(c) {
    const rate = c.sampleRate, n = floor(rate * IR_SECONDS), buf = c.createBuffer(2, n, rate), pre = floor(rate * PREDELAY);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch), w = seeded(ch === 0 ? 0x5701e : 0x5702f);
      let lp = 0;
      for (let i = pre; i < n; i++) {
        const t = (i - pre) / rate, bright = 0.08 + 0.8 * exp(-t / 0.7);   // the high end dies first
        lp += bright * (w() - lp);
        d[i] = lp * (1 - exp(-t / 0.03)) * exp(-6.9 * t / RT60);         // the echoes thicken into the tail
      }
      for (let r = 0; r < REFLECTIONS.length; r += 2) {
        const at = pre + floor(rate * REFLECTIONS[r] * (ch === 0 ? 1 : 1.13));
        if (at < n) d[at] += REFLECTIONS[r + 1] * 0.7;
      }
      let sum = 0;
      for (let i = 0; i < n; i++) sum += d[i] * d[i];
      const k = sum > 0 ? 1 / Math.sqrt(sum) : 0;
      for (let i = 0; i < n; i++) d[i] *= k;
    }
    return buf;
  }

  function buffer(c, kind) {
    let set = made.get(c.sampleRate);
    if (set === undefined) {
      set = {};
      made.set(c.sampleRate, set);
    }
    if (set[kind] === undefined) {
      set[kind] = kind === 'crackle' ? makeCrackle(c) : kind === 'room' ? makeRoom(c) : makeNoise(c, kind);
    }
    return set[kind];
  }

  // The sound a cracked bell's body adds: a curve that leaves quiet parts as they are (its slope at 0 is 1) and
  // bends loud ones flat, a little unevenly, which buzzes. Four strengths.
  const curves = [null, null, null, null, null];
  function crackCurve(c) {
    const at = clamp(Math.round(c * 4), 1, 4);
    if (curves[at] === null) {
      const k = at / 4, curve = new Float32Array(1025);
      for (let i = 0; i < curve.length; i++) {
        const x = i / 512 - 1;
        curve[i] = (1 - k) * x + k * Math.tanh(3.2 * x + 0.35 * x * x) / 3.2;
      }
      curves[at] = curve;
    }
    return curves[at];
  }

  // ---- the graph ----

  function makeGain(c, value, to) {
    const g = c.createGain();
    g.gain.value = value;
    if (to) g.connect(to);
    return g;
  }

  function build() {
    const c = ctx, master = c.createGain(), comp = c.createDynamicsCompressor(), post = makeGain(c, 1 / MAKEUP, c.destination);
    comp.threshold.value = LIMITER.threshold;
    comp.knee.value = LIMITER.knee;
    comp.ratio.value = LIMITER.ratio;
    comp.attack.value = LIMITER.attack;
    comp.release.value = LIMITER.release;
    master.connect(comp);
    comp.connect(post);
    const roomIn = c.createGain(), conv = c.createConvolver(), roomOut = makeGain(c, ROOM_RETURN, master);
    conv.normalize = false;
    conv.buffer = buffer(c, 'room');
    roomIn.connect(conv);
    conv.connect(roomOut);
    graph = {
      master, comp, post, roomIn, conv, roomOut,
      fx: { dry: makeGain(c, 1, master), wet: makeGain(c, 1, roomIn) },
      music: { dry: makeGain(c, 1, master), wet: makeGain(c, 1, roomIn) },
      stereo: typeof c.createStereoPanner === 'function',
    };
    readLevels();
    applyLevels(true);
    limit = Plat.isTouch ? LIMIT_TOUCH : LIMIT_WIDE;
    for (let i = pool.length; i < limit + SPARE; i++) {
      pool.push({ uid: 0, def: null, t: 0, end: 0, cur: 0, top: 0, n: 1, out: null, pan: null, send: null, busy: false, fading: false });
    }
  }

  // ---- levels ----

  function readLevels() {
    if (typeof Settings.get !== 'function') return;
    for (let i = 0; i < SETTINGS.length; i++) {
      const v = Settings.get(SETTINGS[i][0]);
      if (typeof v === 'number' && v === v) levels[SETTINGS[i][0]] = clamp(v, 0, 1);
    }
  }

  function setLevel(param, v, now) {
    if (now) param.value = v;
    else param.setTargetAtTime(v, ctx.currentTime, 0.04);
  }

  function applyLevels(now) {
    if (graph === null) return;
    const m = levels['sound.master'], fx = levels['sound.effects'], mu = levels['sound.music'];
    setLevel(graph.master.gain, m * m, now);
    setLevel(graph.fx.dry.gain, fx * fx, now);
    setLevel(graph.fx.wet.gain, fx * fx, now);
    setLevel(graph.music.dry.gain, mu * mu, now);
    setLevel(graph.music.wet.gain, mu * mu, now);
  }

  function heard(value, key) {
    if (typeof value !== 'number' || value !== value || !(key in levels)) return;
    levels[key] = clamp(value, 0, 1);
    applyLevels(false);
  }

  function percent(v) { return Math.round(v * 100) + '%'; }

  // Declared while the file loads, as every registry here is: the settings screen makes their sliders.
  function declareSettings() {
    for (let i = 0; i < SETTINGS.length; i++) {
      const s = SETTINGS[i];
      if (typeof Settings.define === 'function') {
        Settings.define(s[0], { value: s[1], min: 0, max: 1, step: 0.05, format: percent, label: s[2], group: 'Sound', order: s[3] });
      }
      if (typeof Settings.on === 'function') Settings.on(s[0], heard);
    }
  }
  declareSettings();

  // ---- waking up: the first gesture, and the page hidden and shown ----

  function wake() {
    if (ctx === null) return;
    try {
      const p = wanted && visible ? ctx.resume() : ctx.suspend();
      if (p && typeof p.catch === 'function') p.catch(noop);
    } catch (e) { /* a closed context does neither */ }
  }

  function wire() {
    if (wired) return;
    wired = true;
    for (let i = 0; i < GESTURES.length; i++) window.addEventListener(GESTURES[i], gesture, { capture: true, passive: true });
  }

  function unwire() {
    if (!wired) return;
    wired = false;
    for (let i = 0; i < GESTURES.length; i++) window.removeEventListener(GESTURES[i], gesture, { capture: true });
  }

  // Makes the context. false when the browser cannot: then the engine is 'off' for good.
  function open() {
    const C = window.AudioContext || window.webkitAudioContext;
    if (typeof C !== 'function') {
      failed = true;
      unwire();
      return false;
    }
    try {
      try { ctx = new C({ latencyHint: 'interactive' }); } catch (e) { ctx = new C(); }
      rs = (Math.random() * 4294967295) | 1;
      build();
      // older mobile browsers open their output only for a sound started inside the gesture: one silent sample
      const b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch (err) {
      console.warn('Sound: no audio context could be made; the game goes on in silence.', err);
      try { if (ctx !== null) ctx.close(); } catch (e) { /* it was never whole */ }
      ctx = null;
      graph = null;
      failed = true;
      unwire();
      return false;
    }
    return true;
  }

  // Every touch, click and key may (re)start the context: browsers allow sound only from one, and some stop it
  // again when something else takes the speaker. A trusted event only: one a script made opens nothing.
  function gesture(e) {
    if (e && e.isTrusted === false) return;
    if (ctx === null && !open()) return;
    if (ctx.state !== 'running' && ctx.state !== 'closed' && wanted && visible) {
      unlocking = Plat.now();
      wake();
    }
  }

  Sound.suspend = function () {
    wanted = false;
    wake();
  };
  Sound.resume = function () {
    wanted = true;
    wake();
  };

  // ---- effects ----

  Sound.define = function (id, recipe, limits) {
    Core.assert(typeof id === 'string' && id !== '' && typeof recipe === 'function', 'Sound.define needs an id and a recipe (ctx, out, t, opts)');
    Core.assert(!defs.has(id), 'Sound.define: the effect "' + id + '" is already defined');
    const l = limits || NONE;
    defs.set(id, {
      id, recipe,
      gap: max(0, num(l.gap, 0.03)), cap: max(1, floor(num(l.cap, 4))), priority: num(l.priority, 1),
      wet: clamp(num(l.wet, 0.2), 0, 1), level: max(0, num(l.level, 1)), length: max(0.01, num(l.length, 1)), crowd: l.crowd === true,
      keys: new Float64Array(KEYS), times: new Float64Array(KEYS), vi: new Int32Array(KEYS), vu: new Int32Array(KEYS), keyN: 0,
      voices: 0, started: 0, merged: 0, dropped: 0, stolen: 0, failed: false,
    });
    order.push(id);
  };

  Sound.has = function (id) { return defs.has(id); };
  Sound.list = function () { return order.slice(); };
  Sound.info = function (id) {
    const d = defs.get(id);
    return d === undefined ? null : { id: d.id, gap: d.gap, cap: d.cap, priority: d.priority, wet: d.wet, level: d.level, length: d.length, crowd: d.crowd };
  };

  const unknown = new Set();
  function warnUnknown(id) {
    if (unknown.has(id)) return;
    unknown.add(id);
    console.warn('Sound: no effect is defined as "' + id + '"');
  }

  // A key as a number: strings by their hash. Calls without one share key 0.
  function keyOf(k) {
    if (typeof k === 'number') return k === k ? k : 0;
    if (typeof k === 'string') return Core.hashStr(k) + 1;
    return 0;
  }

  // The slot that remembers a key of an effect, or -1.
  function findKey(d, key) {
    for (let i = 0; i < d.keyN; i++) if (d.keys[i] === key) return i;
    return -1;
  }

  // A slot for a key that has none: a free one, else the one used longest ago.
  function claimKey(d, key) {
    let at = d.keyN;
    if (at < KEYS) d.keyN++;
    else {
      at = 0;
      for (let i = 1; i < KEYS; i++) if (d.times[i] < d.times[at]) at = i;
    }
    d.keys[at] = key;
    return at;
  }

  // How much of a playing is left to hear: its loudness now times the share of its time still to come.
  function score(v, now) {
    const span = v.end - v.t, left = span > 0 ? (v.end - now) / span : 0;
    return v.cur * (left < 0 ? 0 : left > 1 ? 1 : left);
  }

  // Finds the playing (of one effect, or of all when d is null) that gives way to a new one of this priority and
  // level, and lets it go: the one of the lowest priority, and among those the quietest. One of a lower priority
  // always gives way; one of the same priority only when the new one is clearly louder than what is left of it,
  // so that a stream of like sounds never pushes one another out. false when none gives way.
  function giveWay(d, priority, level, now) {
    let victim = null, least = Infinity, lowest = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const v = pool[i];
      if (!v.busy || v.fading || (d !== null && v.def !== d) || v.def.priority > priority) continue;
      const s = score(v, now), p = v.def.priority;
      if (p < lowest || (p === lowest && s < least)) {
        lowest = p;
        least = s;
        victim = v;
      }
    }
    if (victim === null || (lowest === priority && !(least < level * YIELD))) return false;
    fadeOut(victim, now, STEAL);
    victim.def.stolen++;
    totals.stolen++;
    return true;
  }

  function fadeOut(v, now, fade) {
    if (!v.fading) {
      v.fading = true;
      v.def.voices--;
      sounding--;
    }
    const g = v.out.gain;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(0, now, fade / 4);
    v.end = now + fade;
  }

  function release(v) {
    try { v.out.disconnect(); } catch (e) { /* already apart */ }
    if (v.pan !== null) try { v.pan.disconnect(); } catch (e) { /* already apart */ }
    if (v.send !== null) try { v.send.disconnect(); } catch (e) { /* already apart */ }
    if (!v.fading) {
      v.def.voices--;
      sounding--;
    }
    v.busy = false;
    v.fading = false;
    v.def = null;
    v.out = v.pan = v.send = null;
    used--;
  }

  function freeVoice() {
    for (let i = 0; i < pool.length; i++) if (!pool[i].busy) return i;
    return -1;
  }

  function sweep() {
    const now = clockNow();
    for (let i = 0; i < pool.length && used > 0; i++) {
      const v = pool[i];
      if (v.busy && now > v.end + PAD) release(v);
    }
  }

  // Where a sound is on the screen: placed.pan, and placed.att, how much quieter it is for being off the screen.
  const shot = { x: 0, y: 0 }, placed = { on: false, pan: 0, att: 1 };
  let viewW = 0, viewH = 0;
  function place(o) {
    placed.on = false;
    placed.pan = 0;
    placed.att = 1;
    if (typeof o.x !== 'number' || !(viewW > 0 && viewH > 0) || typeof Gfx.worldToScreen !== 'function') return;
    const s = Gfx.worldToScreen(o.x, typeof o.y === 'number' ? o.y : 0, 0, shot);
    if (s === null || num(s.x, NaN) !== s.x || num(s.y, NaN) !== s.y) return;
    const u = s.x / viewW * 2 - 1, w = s.y / viewH * 2 - 1, away = max(abs(u), abs(w)) - 1;
    placed.on = true;
    placed.pan = clamp(u * PAN_WIDTH, -PAN_MAX, PAN_MAX);
    if (away > 0) placed.att = 1 / (1 + away * OFF_SCREEN);
  }

  function dropped(d) {
    d.dropped++;
    totals.dropped++;
    return 0;
  }

  function merge(v, level, now) {
    v.n++;
    if (level > v.top) v.top = level;
    const want = v.top * min(MERGE_MAX, Math.sqrt(1 + 0.5 * (v.n - 1)));
    if (want > v.cur * 1.01) {
      v.cur = want;
      v.out.gain.setTargetAtTime(want, now, 0.006);
    }
  }

  function failedRecipe(d, err) {
    if (d.failed) return;
    d.failed = true;
    console.error('Sound: the recipe of "' + d.id + '" threw:', err);
  }

  Sound.sfx = function (id, opts) {
    const o = opts || NONE;
    if (!canPlay()) {
      totals.quiet++;
      return 0;
    }
    const d = defs.get(id);
    if (d === undefined) {
      warnUnknown(id);
      return 0;
    }
    place(o);
    const now = clockNow(), level = d.level * num(o.level, 1) * placed.att;
    if (!(level >= QUIET)) return dropped(d);
    const key = keyOf(o.key);
    let slot = findKey(d, key);
    if (slot >= 0) {
      const since = now - d.times[slot];   // below 0 only if the clock was set back: then it tells nothing
      if (since >= 0 && since < MERGE) {
        const v = pool[d.vi[slot]];
        if (v.busy && !v.fading && v.uid === d.vu[slot]) {
          merge(v, level, now);
          d.merged++;
          totals.merged++;
          return v.uid;
        }
      }
      if (since >= 0 && since < d.gap) return dropped(d);
    }
    if (d.voices >= d.cap && !giveWay(d, d.priority, level, now)) return dropped(d);
    if (sounding >= limit && !giveWay(null, d.priority, level, now)) return dropped(d);
    const at = freeVoice();
    if (at < 0) return dropped(d);

    // From here on it plays, and making its nodes is what it costs.
    const c = ctx, t = now + LEAD, v = pool[at], out = makeGain(c, level, null);
    let tail = out, pan = null, send = null;
    if (placed.on && graph.stereo) {
      pan = c.createStereoPanner();
      pan.pan.value = placed.pan;
      out.connect(pan);
      tail = pan;
    }
    tail.connect(graph.fx.dry);
    const wet = clamp(num(o.wet, d.wet), 0, 1);
    if (wet > 0) {
      send = makeGain(c, wet, graph.fx.wet);
      tail.connect(send);
    }
    let end;
    try {
      end = d.recipe(c, out, t, o);
    } catch (err) {
      failedRecipe(d, err);
      out.disconnect();
      if (pan !== null) pan.disconnect();
      if (send !== null) send.disconnect();
      return 0;
    }
    v.busy = true;
    v.fading = false;
    v.uid = ++uid;
    v.def = d;
    v.t = t;
    v.end = num(end, 0) > t ? end : t + d.length;
    v.cur = v.top = level;
    v.n = 1;
    v.out = out;
    v.pan = pan;
    v.send = send;
    used++;
    sounding++;
    if (sounding > most) most = sounding;
    d.voices++;
    d.started++;
    totals.started++;
    if (slot < 0) slot = claimKey(d, key);
    d.times[slot] = now;
    d.vi[slot] = at;
    d.vu[slot] = v.uid;
    return v.uid;
  };

  Sound.stop = function (handle, fade) {
    if (!(handle > 0) || ctx === null) return;
    for (let i = 0; i < pool.length; i++) {
      const v = pool[i];
      if (!v.busy || v.uid !== handle) continue;
      const f = num(fade, FADE);
      if (f <= 0) release(v);
      else if (!v.fading || v.end > clockNow() + f) fadeOut(v, clockNow(), f);
      return;
    }
  };

  Sound.stopAll = function (fade) {
    if (ctx === null) return;
    const f = num(fade, FADE), now = clockNow();
    for (let i = 0; i < pool.length; i++) {
      const v = pool[i];
      if (!v.busy) continue;
      if (f <= 0) release(v);
      else fadeOut(v, now, f);
    }
  };

  Sound.stats = function (id) {
    if (id !== undefined) {
      const d = defs.get(id);
      return d === undefined ? null : { id: d.id, voices: d.voices, started: d.started, merged: d.merged, dropped: d.dropped, stolen: d.stolen };
    }
    return {
      state: Sound.state, voices: sounding, most, limit, started: totals.started, merged: totals.merged, dropped: totals.dropped,
      stolen: totals.stolen, quiet: totals.quiet,
    };
  };

  // ---- rendering offline: for tests and tools, and baking ----

  function offline(what, opts, seconds, rate) {
    const d = typeof what === 'function' ? null : defs.get(what);
    if (typeof what !== 'function' && d === undefined) return Promise.reject(new Error('Sound: no effect is defined as "' + what + '"'));
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (typeof Offline !== 'function') return Promise.resolve(null);
    const o = opts || NONE, secs = num(seconds, 0) > 0 ? seconds : (d ? d.length : 2) + 0.5;
    let c;
    try { c = new Offline(1, max(1, Math.ceil(secs * rate)), rate); } catch (e) { return Promise.resolve(null); }
    const out = makeGain(c, (d ? d.level : 1) * num(o.level, 1), c.destination);
    if (o.room) {
      const conv = c.createConvolver(), back = makeGain(c, ROOM_RETURN, c.destination);
      conv.normalize = false;
      conv.buffer = buffer(c, 'room');
      conv.connect(back);
      out.connect(makeGain(c, clamp(num(o.wet, d ? d.wet : 0.3), 0, 1), conv));
    }
    const kept = rs;
    rs = (num(o.seed, 0x7011) | 0) || 1;   // the same stream every time: the same samples
    try {
      (d ? d.recipe : what)(c, out, 0, o);
    } catch (err) {
      return Promise.reject(err);
    } finally {
      rs = kept;
    }
    return new Promise(function (resolve, reject) {
      c.oncomplete = function (e) { resolve(e.renderedBuffer); };
      const p = c.startRendering();
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    });
  }

  Sound.render = function (what, opts, seconds) {
    return offline(what, opts, seconds, num((opts || NONE).rate, 48000)).then(function (b) { return b === null ? null : b.getChannelData(0); });
  };

  Sound.bake = function (what, opts, seconds) {
    return offline(what, opts, seconds, ctx !== null ? ctx.sampleRate : num((opts || NONE).rate, 48000));
  };

  // ---- the helpers ----

  Sound.note = function (n) {
    if (typeof n === 'number') return 440 * pow(2, (n - 69) / 12);
    if (typeof n !== 'string') return NaN;
    const m = /^\s*([A-Ga-g])([#b]*)(-?\d)\s*$/.exec(n);
    if (m === null) return NaN;
    let semis = LETTERS[m[1].toLowerCase()];
    for (let i = 0; i < m[2].length; i++) semis += m[2][i] === '#' ? 1 : -1;
    return Sound.note((Number(m[3]) + 1) * 12 + semis);
  };

  function freqOf(s) {
    if (num(s.freq, 0) > 0) return s.freq;
    const f = s.note !== undefined ? Sound.note(s.note) : NaN;
    return f > 0 ? f : 440;
  }

  function keep(s, node) {
    if (Array.isArray(s.keep)) s.keep.push(node);
  }

  Sound.env = function (param, t, spec) {
    const s = spec || NONE, level = num(s.level, 1);
    const a = max(0.0005, num(s.attack, 0.003)), h = max(0, num(s.hold, 0)), d = max(0.004, num(s.decay, 0.3));
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(level, t + a);
    if (h > 0) param.setValueAtTime(level, t + a + h);
    param.setTargetAtTime(0, t + a + h, d / 6.9);
    return t + a + h + d;
  };

  Sound.tone = function (c, out, t, spec) {
    const s = spec || NONE, osc = c.createOscillator(), g = c.createGain();
    osc.type = s.type || 'sine';
    osc.frequency.setValueAtTime(freqOf(s), t);
    const end = Sound.env(g.gain, t, s);
    if (num(s.to, 0) > 0) osc.frequency.exponentialRampToValueAtTime(s.to, t + max(0.002, num(s.glide, end - t)));
    if (num(s.detune, 0) !== 0) osc.detune.setValueAtTime(s.detune, t);
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(end + 0.01);
    keep(s, osc);
    return end;
  };

  Sound.noise = function (c, out, t, spec) {
    const s = spec || NONE, src = c.createBufferSource(), g = c.createGain();
    const buf = buffer(c, s.color === 'pink' || s.color === 'brown' ? s.color : 'white');
    src.buffer = buf;
    src.loop = true;
    const end = Sound.env(g.gain, t, s);
    let head = src;
    if (s.filter) {
      const f = c.createBiquadFilter();
      f.type = s.filter;
      f.frequency.setValueAtTime(min(num(s.freq, 1000), c.sampleRate * 0.45), t);
      f.Q.setValueAtTime(num(s.q, 0.8), t);
      if (num(s.to, 0) > 0) f.frequency.exponentialRampToValueAtTime(min(s.to, c.sampleRate * 0.45), t + max(0.002, num(s.glide, end - t)));
      src.connect(f);
      head = f;
    }
    head.connect(g);
    g.connect(out);
    src.start(t, rand() * max(0, buf.duration - 0.05));
    src.stop(end + 0.01);
    keep(s, src);
    return end;
  };

  Sound.replay = function (c, out, t, buf, spec) {
    const s = spec || NONE, rate = num(s.rate, 1) > 0 ? num(s.rate, 1) : 1, src = c.createBufferSource();
    src.buffer = buf;
    if (rate !== 1) src.playbackRate.setValueAtTime(rate, t);
    src.connect(makeGain(c, num(s.level, 1), out));
    src.start(t);
    keep(s, src);
    return t + buf.duration / rate;
  };

  Sound.click = function (c, out, t, spec) {
    const s = spec || NONE;
    return Sound.noise(c, out, t, {
      filter: 'bandpass', freq: num(s.freq, 2400), q: num(s.q, 6), level: num(s.level, 0.5), attack: 0.0006, decay: num(s.decay, 0.02), keep: s.keep,
    });
  };

  // Wood under strain: the stick and slip of a beam is a train of ticks (a sawtooth at rate, wavering) that rings
  // the wood's body.
  Sound.creak = function (c, out, t, spec) {
    const s = spec || NONE, osc = c.createOscillator(), wob = c.createOscillator(), depth = c.createGain(), body = c.createBiquadFilter(), g = c.createGain();
    const rate = num(s.rate, 60), end = Sound.env(g.gain, t, s);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(rate, t);
    if (num(s.to, 0) > 0) osc.frequency.linearRampToValueAtTime(s.to, end);
    wob.frequency.setValueAtTime(4 + rand() * 6, t);
    depth.gain.setValueAtTime(rate * 0.3, t);
    wob.connect(depth);
    depth.connect(osc.frequency);
    body.type = 'bandpass';
    body.frequency.setValueAtTime(num(s.body, 700), t);
    body.Q.setValueAtTime(num(s.q, 8), t);
    osc.connect(body);
    body.connect(g);
    g.connect(out);
    osc.start(t);
    wob.start(t);
    osc.stop(end + 0.01);
    wob.stop(end + 0.01);
    keep(s, osc);
    keep(s, wob);
    return end;
  };

  Sound.crackle = function (c, out, t, spec) {
    const s = spec || NONE, buf = buffer(c, 'crackle'), src = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.setValueAtTime(num(s.rate, 1), t);
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(num(s.freq, 1800), t);
    hp.Q.setValueAtTime(0.7, t);
    src.connect(hp);
    hp.connect(g);
    g.connect(out);
    const end = Sound.env(g.gain, t, s);
    src.start(t, rand() * (buf.duration - 0.1));
    src.stop(end + 0.01);
    keep(s, src);
    return end;
  };

  // Water heard from a distance: deep brown noise under a lowpass that breathes slowly, and a band of lapping
  // whose loudness two slow, unrelated swells move.
  Sound.water = function (c, out, t, spec) {
    const s = spec || NONE, f = num(s.freq, 450), rate = num(s.rate, 0.13), g = c.createGain(), end = Sound.env(g.gain, t, s);
    const deep = c.createBufferSource(), lp = c.createBiquadFilter(), sway = c.createOscillator(), swayBy = c.createGain();
    deep.buffer = buffer(c, 'brown');
    deep.loop = true;
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f, t);
    lp.Q.setValueAtTime(0.6, t);
    sway.frequency.setValueAtTime(rate, t);
    swayBy.gain.setValueAtTime(f * 0.45, t);
    sway.connect(swayBy);
    swayBy.connect(lp.frequency);
    deep.connect(lp);
    lp.connect(g);
    const lap = c.createBufferSource(), bp = c.createBiquadFilter(), lapGain = makeGain(c, 0.5, g), a = c.createOscillator(), b = c.createOscillator(), by = c.createGain();
    lap.buffer = buffer(c, 'pink');
    lap.loop = true;
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(min(f * 2.4, c.sampleRate * 0.45), t);
    bp.Q.setValueAtTime(1.3, t);
    a.frequency.setValueAtTime(rate * 2.7, t);
    b.frequency.setValueAtTime(rate * 4.3, t);
    by.gain.setValueAtTime(0.25, t);
    a.connect(by);
    b.connect(by);
    by.connect(lapGain.gain);
    lap.connect(bp);
    bp.connect(lapGain);
    g.connect(out);
    const sources = [deep, sway, lap, a, b];
    for (let i = 0; i < sources.length; i++) {
      const n = sources[i];
      if (n.buffer) n.start(t, rand() * (n.buffer.duration - 0.1)); else n.start(t);
      n.stop(end + 0.01);
      keep(s, n);
    }
    return end;
  };

  Sound.bell = function (c, out, t, spec) {
    const s = spec || NONE, f0 = freqOf(s), w = amount(num(s.weight, 0.5)), m = amount(s.muffled), cr = amount(s.cracked);
    const level = num(s.level, 1), count = clamp(floor(num(s.partials, 11)), 1, 11), top = c.sampleRate * 0.45;
    // how long the hum rings: from 2 s for a handbell to 14 s for a great bell, unless asked; the rest in proportion
    const hum = num(s.length, 0) > 0 ? s.length : 2 + 12 * w * w;
    const scale = hum / PARTIALS[2] * (1 - 0.78 * cr), attack = 0.0008 + 0.045 * m;
    const beat = num(s.beat, 0.7 + rand() * 0.9);
    let sum = 0;
    for (let k = 0; k < count; k++) sum += PARTIALS[k * 3 + 1];
    const norm = level * 1.15 / sum;
    // A cracked bell rings through a body that bends and rattles: a curve, and a buzz that cuts in and out.
    let into = out;
    if (cr > 0) {
      const body = c.createGain(), bend = c.createWaveShaper(), rattle = c.createGain(), buzz = c.createOscillator(), depth = c.createGain();
      bend.curve = crackCurve(cr);
      rattle.gain.value = 1 - 0.45 * cr;
      buzz.type = 'square';
      buzz.frequency.setValueAtTime(38 + rand() * 30, t);
      depth.gain.setValueAtTime(0.45 * cr, t);
      buzz.connect(depth);
      depth.connect(rattle.gain);
      body.connect(bend);
      bend.connect(rattle);
      rattle.connect(out);
      into = body;
      buzz.start(t);
      buzz.stop(t + attack + hum * (1 - 0.78 * cr) + 0.05);
      keep(s, buzz);
      Sound.noise(c, out, t, { filter: 'bandpass', freq: min(1900, top), q: 2.2, attack: 0.001, decay: 0.09 + 0.1 * w, level: level * 0.1 * cr, keep: s.keep });
    }
    let end = t;
    for (let k = 0; k < count; k++) {
      let ratio = PARTIALS[k * 3], amp = PARTIALS[k * 3 + 1], ring = PARTIALS[k * 3 + 2] * scale;
      if (k === 0) amp *= 0.55 + 0.45 * w;                     // a small bell has little hum
      if (k >= NOMINAL) {
        amp *= (1 - 0.7 * m) * (1 + 0.35 * (1 - w));          // small bells are bright; a muffle dulls them
        ring *= 1 - 0.5 * m;
      }
      if (cr > 0) ratio *= 1 + (rand() - 0.5) * 0.05 * cr;     // a crack pulls the partials out of tune
      const f = f0 * ratio;
      if (f > top || f < 20 || ring <= 0) continue;
      const g = c.createGain(), a = amp * norm, stop = t + attack + ring + 0.02, twinned = (k === 0 || k === 2) && beat > 0;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(twinned ? a * (1 - TWIN) : a, t + attack);
      g.gain.setTargetAtTime(0, t + attack, ring / 6.9);
      const osc = c.createOscillator();
      osc.frequency.setValueAtTime(f, t);
      osc.connect(g);
      osc.start(t);
      osc.stop(stop);
      keep(s, osc);
      if (twinned) {                                          // the doublet: a twin a little sharp, and softer
        const twin = c.createOscillator(), soft = makeGain(c, TWIN / (1 - TWIN), g);
        twin.frequency.setValueAtTime(f + beat * (k === 0 ? 1 : 1.6), t);
        twin.connect(soft);
        twin.start(t);
        twin.stop(stop);
        keep(s, twin);
      }
      g.connect(into);
      if (stop > end) end = stop;
    }
    // the clapper: a bright clang from an open bell, a dull knock from a muffled one
    if (m < 1) {
      Sound.noise(c, out, t, {
        filter: 'bandpass', freq: min(f0 * 4.6, top), q: 1.1, attack: 0.0005, decay: 0.022 + 0.03 * w, level: level * 0.2 * (1 - m), keep: s.keep,
      });
    }
    if (m > 0) {
      Sound.noise(c, out, t, { color: 'pink', filter: 'lowpass', freq: 380, q: 0.7, attack: 0.003, decay: 0.08, level: level * 0.16 * m, keep: s.keep });
    }
    return end;
  };

  // ---- the page ----

  Plat.on('boot', function (view) {
    visible = document.visibilityState !== 'hidden';
    if (view && view.canvas) {
      viewW = view.canvas.clientWidth;
      viewH = view.canvas.clientHeight;
    }
    Plat.onVisibility(function (shown) {
      visible = shown;
      wake();
    });
    if (hasWebAudio()) wire();
  });

  Plat.on('resize', function (w, h) {
    viewW = w;
    viewH = h;
  });

  // Every frame lets go of the playings that have ended; nothing here allocates.
  Plat.on('frame', function () {
    if (used > 0) sweep();
    if (unlocking > 0 && ctx !== null && (ctx.state === 'running' || Plat.now() - unlocking > UNLOCK_MS)) unlocking = 0;
  });
})();
