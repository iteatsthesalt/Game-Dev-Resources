// 54-music.js: music made as it plays, never a recording on a loop. A piece is data and small functions: a
// tonic, a mode and a tempo, and layers that come in as the intensity rises. The scheduler is driven by the frame
// loop and keeps time by the audio clock: each call places what falls in the next quarter second, and it keeps
// no timer of its own. Change ringing gives the patterns: a set of bells rings in rows, and from one row to the
// next each bell keeps its place or swaps with a neighbour. One piece is written here: 'vigil'.
// Owns: Music
// Public:
//   Music.define(id, piece)            registers a piece (see "A piece" below), while files load or later
//   Music.has(id) -> boolean
//   Music.list() -> [id]
//   Music.play(id, {fade: 3, intensity}) -> boolean
//                                      plays the piece, fading in over fade seconds, while the piece that was
//                                      playing fades out. The piece playing already goes on as it is. Asked
//                                      before sound can start (no gesture yet), it starts once sound can.
//                                      intensity, if given, is where the piece starts. false for an id that is
//                                      not defined.
//   Music.stop({fade: 3})              fades the music out, and nothing more is scheduled
//   Music.intensity(v, glide = 6) -> number   how much is going on, from 0 (at rest) to 1, reached over glide
//                                      seconds. Without v, the intensity now. The game raises it with the
//                                      danger; each call holds it for 5 seconds against the stand-in below.
//   Music.tick()                       schedules every step that falls in the next quarter second; the frame
//                                      loop calls it (the notice 'frame'). Unless the context runs and
//                                      Sound.live() is true, it does nothing at all. Steps are numbered from the
//                                      start of the piece, and each is scheduled once, ever; a step whose time
//                                      passed while nothing ran is skipped, not played late. Allocates nothing
//                                      unless a note starts.
//   Music.toll(opts) -> handle         one great bell stroke, for the toll of the vigil: the effect 'toll' on the
//                                      effects bus, tuned to the piece (opts.note, else the piece's toll), with
//                                      the music ducked beneath it. 0 when it could not sound.
//   Music.changes(n, method, rows) -> [[bell]]   rows of n bells, numbered 1 (the treble, the highest) to n (the
//                                      tenor), starting from rounds (1 2 ... n). method: 'rounds', 'plain-hunt', or
//                                      place notation: 'x' (or '-') swaps every pair, a run of places (1 to 9, 0
//                                      for 10, E, T, A, B, C, D for 11 to 16) names the bells that stay while the
//                                      others swap in pairs, '.' parts two changes; the changes repeat. rows: how
//                                      many to give; by default until rounds comes back, that row included (13
//                                      for plain hunt on 6, 2 for rounds). Fresh arrays every call.
//   Music.mode(name) -> [semitones] | null   the scales a piece may name: ionian, dorian, phrygian, lydian,
//                                      mixolydian, aeolian, locrian
//   Music.playing                      the id of the piece playing, or null. A value.
//   Music.stats() -> {playing, step, scheduled, notes, intensity, target}    a fresh copy: the next step, steps
//                                      scheduled and notes started since the page opened
//   Music.trace(fn)                    fn(step, time) for every step as it is scheduled, for tests; null stops it
// A piece:
//   { tonic: 50 (a MIDI note or a name), mode: 'dorian' (a name, or semitones above the tonic), tempo: 60 (beats
//     a minute), div: 4 (steps a beat), beats: 4 (beats a bar), bells: 6, method: 'plain-hunt',
//     ring: {octave: 1, weight: 0.3, muffled: 0, partials: 5, length: 1.6}: the ring's bells, the tenor the tonic
//     octave octaves up and the others up the mode from it, as Sound.bell takes them; toll: the note of
//     Music.toll's bell (two octaves below the tonic),
//     layers: [{ id, from: 0 (the intensity it comes in at; a layer from 0 sounds at rest too), span: 0.15 (how
//                much more it takes to come in fully), level: 1, wet: 0.4 (its share sent to the room), and one of:
//                hold(ctx, out, t, m) -> [node]   a layer that sounds all along (a drone, the water): builds into
//                                                 out and returns its sources, stopped when the layer goes
//                step(ctx, out, t, m, i) -> n     a layer of notes: may start notes at time t for step i, and
//                                                 says how many }] }
//   m is the piece as it plays: m.freq(degree, octave) -> Hz (degree in the mode, 0 the tonic; octaves up from
//   the tonic's), m.bell(k) -> Hz of bell k of the ring, m.ring(ctx, out, t, k, level) -> end strikes bell k (each
//   bell is baked with Sound.bake when the piece begins, and struck live until it is ready), m.row(r) -> row r
//   of the method's rows (they repeat), m.bells, m.beat (steps a beat), m.bar (steps a bar), m.stepTime (seconds
//   a step), m.intensity, and m.rand(i, salt) -> [0, 1), the same for the same numbers within one playing.
// The game: the title plays 'vigil' at rest, a run plays its zone's music (zone.music) when that is a piece,
// else 'vigil', and the results let it sink back to rest. Until the game drives Music.intensity itself, a
// stand-in follows the run twice a second: the tolls rung, the dead close to the player, the life the player
// has lost, a boss.
(function () {
  'use strict';

  const floor = Math.floor, max = Math.max, min = Math.min, abs = Math.abs;
  const LOOK = 0.25;                  // seconds scheduled ahead
  const START = 0.08;                 // seconds from the tick that starts a piece to its first step
  const NUDGE = 0.012;                // a layer's gain is changed when it would move by more than this
  const LAYER_TIME = 0.5;             // seconds: the time constant of a layer coming in or going
  const HELD = 5;                     // seconds a call of Music.intensity holds off the stand-in
  const MODES = {
    ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], locrian: [0, 1, 3, 5, 6, 8, 10],
  };
  const PLACES = '1234567890ETABCD';
  const NONE = Object.freeze({});

  const num = function (v, d) { return typeof v === 'number' && v === v && v !== Infinity && v !== -Infinity ? v : d; };

  // ---- change ringing ----

  // The changes of a method on n bells: each a list of the places (1-based) whose bells stay.
  function notation(n, method) {
    if (method === 'rounds') {
      const all = [];
      for (let p = 1; p <= n; p++) all.push(p);
      return [all];
    }
    if (method === 'plain-hunt') return n % 2 === 0 ? [[], [1, n]] : [[n], [1]];
    Core.assert(typeof method === 'string' && method.trim() !== '', 'Music.changes: a method is rounds, plain-hunt or place notation');
    const out = [];
    let run = null;
    for (let i = 0; i < method.length; i++) {
      const ch = method[i].toUpperCase();
      if (ch === 'X' || ch === '-') {
        if (run !== null) out.push(run);
        run = null;
        out.push([]);
      } else if (ch === '.' || ch === ' ') {
        if (run !== null) out.push(run);
        run = null;
      } else {
        const p = PLACES.indexOf(ch) + 1;
        Core.assert(p > 0 && p <= n, 'Music.changes: "' + method[i] + '" is not a place among ' + n + ' bells');
        if (run === null) run = [];
        run.push(p);
      }
    }
    if (run !== null) out.push(run);
    Core.assert(out.length > 0, 'Music.changes: "' + method + '" holds no change');
    return out;
  }

  // One change: the bells in the places named stay, the others swap with their neighbour in pairs from the front.
  function change(row, places) {
    const next = row.slice(), n = row.length;
    for (let i = 0; i < n;) {
      if (places.indexOf(i + 1) >= 0 || i + 1 >= n || places.indexOf(i + 2) >= 0) {
        i++;
        continue;
      }
      next[i] = row[i + 1];
      next[i + 1] = row[i];
      i += 2;
    }
    return next;
  }

  function isRounds(row) {
    for (let i = 0; i < row.length; i++) if (row[i] !== i + 1) return false;
    return true;
  }

  Music.changes = function (n, method, rows) {
    n = floor(num(n, 0));
    Core.assert(n >= 2 && n <= PLACES.length, 'Music.changes: from 2 to ' + PLACES.length + ' bells');
    const steps = notation(n, method), want = floor(num(rows, 0)), first = [];
    for (let b = 1; b <= n; b++) first.push(b);
    const list = [first];
    let row = first;
    for (let k = 0; want > 0 ? list.length < want : list.length < 10000; k++) {
      row = change(row, steps[k % steps.length]);
      list.push(row);
      if (want <= 0 && isRounds(row)) break;
    }
    return list;
  };

  Music.mode = function (name) { return Object.prototype.hasOwnProperty.call(MODES, name) ? MODES[name].slice() : null; };

  // ---- pieces ----

  const pieces = new Map(), order = [];

  function midiOf(note, fallback) {
    if (typeof note === 'number') return note;
    const f = typeof note === 'string' ? Sound.note(note) : NaN;
    return f > 0 ? 69 + 12 * Math.log2(f / 440) : fallback;
  }

  Music.define = function (id, piece) {
    Core.assert(typeof id === 'string' && id !== '' && piece && Array.isArray(piece.layers), 'Music.define needs an id and a piece with layers');
    Core.assert(!pieces.has(id), 'Music.define: the piece "' + id + '" is already defined');
    const mode = Array.isArray(piece.mode) ? piece.mode.slice() : Music.mode(piece.mode || 'dorian');
    Core.assert(mode !== null && mode.length > 0, 'Music.define: "' + id + '" names no mode this file knows');
    const tonic = midiOf(piece.tonic, 50), bells = floor(num(piece.bells, 6)), r = piece.ring || NONE;
    const p = {
      id, tonic, mode, tempo: max(1, num(piece.tempo, 60)), div: max(1, floor(num(piece.div, 4))), beats: max(1, floor(num(piece.beats, 4))),
      bells, toll: piece.toll !== undefined ? piece.toll : tonic - 24, rows: Music.changes(bells, piece.method || 'plain-hunt'), layers: [],
      ring: {
        octave: floor(num(r.octave, 1)), weight: num(r.weight, 0.3), muffled: num(r.muffled, 0), partials: floor(num(r.partials, 5)),
        length: max(0.2, num(r.length, 1.6)), beat: 0, level: 1,
      },
    };
    p.rows.pop();                      // the last row is rounds again: the course repeats from the first
    for (let i = 0; i < piece.layers.length; i++) {
      const l = piece.layers[i];
      Core.assert(l && (typeof l.hold === 'function' || typeof l.step === 'function'), 'Music.define: layer ' + i + ' of "' + id + '" needs hold or step');
      p.layers.push({
        id: l.id || String(i), from: num(l.from, 0), span: max(0.001, num(l.span, 0.15)), level: max(0, num(l.level, 1)),
        wet: Core.clamp(num(l.wet, 0.4), 0, 1), hold: typeof l.hold === 'function' ? l.hold : null, step: typeof l.step === 'function' ? l.step : null,
      });
    }
    pieces.set(id, p);
    order.push(id);
  };

  Music.has = function (id) { return pieces.has(id); };
  Music.list = function () { return order.slice(); };

  // ---- playing ----

  let want = null;                     // {id, fade, intensity} asked for and not yet begun, or null
  let playing = null;                  // the piece playing: see begin()
  const fading = [];                   // pieces fading out
  let current = 0, target = 0, glide = 6, heldAt = -Infinity, lastTick = -1;
  let duckDry = null, duckWet = null, duckCtx = null;
  let traceFn = null;
  const counts = { scheduled: 0, notes: 0 };
  const broken = new Set();            // layers whose functions threw: reported once, then left silent

  Object.defineProperty(Music, 'playing', { enumerable: true, get: function () { return playing !== null ? playing.id : null; } });

  function gainNode(c, value, to) {
    const g = c.createGain();
    g.gain.value = value;
    if (to) g.connect(to);
    return g;
  }

  // The duck: two gains in front of the music bus, which Music.toll lowers for a moment.
  function ducks(c) {
    if (duckCtx !== c) {
      const bus = Sound.bus('music');
      duckDry = gainNode(c, 1, bus.dry);
      duckWet = gainNode(c, 1, bus.wet);
      duckCtx = c;
    }
  }

  function hash01(seed, i, salt) { return Core.hashMix(Core.hashMix(seed, i), salt) / 4294967296; }

  // m: what a piece's functions see of the piece as it plays
  function voice(p, seed) {
    const len = p.mode.length, baked = new Array(p.bells + 1).fill(null);
    const m = {
      piece: p, bells: p.bells, beat: p.div, bar: p.div * p.beats, stepTime: 60 / p.tempo / p.div, intensity: 0,
      freq: function (degree, octave) {
        const d = ((degree % len) + len) % len, up = floor(degree / len) + num(octave, 0);
        return Sound.note(p.tonic + p.mode[d] + 12 * up);
      },
      bell: function (k) { return m.freq(p.bells - k, p.ring.octave); },
      ring: function (c, out, t, k, level) {
        const b = baked[k];
        if (b) return Sound.replay(c, out, t, b, { level });
        return Sound.bell(c, out, t, Object.assign({}, p.ring, { freq: m.bell(k), level }));
      },
      row: function (r) { return p.rows[((r % p.rows.length) + p.rows.length) % p.rows.length]; },
      rand: function (i, salt) { return hash01(seed, i, num(salt, 0)); },
    };
    // The ring's bells are baked once, each a strike at full level: from then on a strike costs two nodes.
    for (let k = 1; k <= p.bells; k++) {
      const spec = Object.assign({}, p.ring, { freq: m.bell(k) });
      Sound.bake(function (c, out, t) { return Sound.bell(c, out, t, spec); }, null, p.ring.length + 0.4)
        .then(function (b) { baked[k] = b; }, function () { /* the live bell stands in */ });
    }
    return m;
  }

  function begin(id, fade, now) {
    const p = pieces.get(id), c = Sound.context;
    ducks(c);
    const inst = {
      id, p, t0: now + START, step: 0, ending: 0, layers: [],
      dry: gainNode(c, 0, duckDry), wet: gainNode(c, 0, duckWet), m: voice(p, (Sound.rand() * 4294967296) >>> 0),
    };
    const f = max(0.05, fade);
    for (const g of [inst.dry.gain, inst.wet.gain]) {
      g.setValueAtTime(0, now);
      g.linearRampToValueAtTime(1, now + f);
    }
    for (let i = 0; i < p.layers.length; i++) {
      const l = p.layers[i], out = gainNode(c, 0, inst.dry);
      out.connect(gainNode(c, l.wet, inst.wet));
      inst.layers.push({ def: l, out, level: 0, on: false, sources: null, broken: broken.has(id + '.' + l.id) });
    }
    return inst;
  }

  function stopSources(L, at) {
    if (L.sources === null) return;
    for (let i = 0; i < L.sources.length; i++) {
      try { L.sources[i].stop(at); } catch (e) { /* stopped already */ }
    }
    L.sources = null;
  }

  function fadeOut(inst, fade, now) {
    const f = max(0.05, fade);
    for (const g of [inst.dry.gain, inst.wet.gain]) {
      g.cancelScheduledValues(now);
      g.setTargetAtTime(0, now, f / 4);
    }
    inst.ending = now + f + 0.1;
    for (let i = 0; i < inst.layers.length; i++) stopSources(inst.layers[i], inst.ending);
    fading.push(inst);
  }

  function finish(inst) {
    try {
      inst.dry.disconnect();
      inst.wet.disconnect();
    } catch (e) { /* apart already */ }
  }

  Music.play = function (id, opts) {
    if (!pieces.has(id)) {
      console.warn('Music.play: no piece is defined as "' + id + '"');
      return false;
    }
    const o = opts || NONE;
    if (typeof o.intensity === 'number') current = target = Core.clamp(o.intensity, 0, 1);
    if (playing !== null && playing.id === id) {
      want = null;
      return true;
    }
    want = { id, fade: max(0, num(o.fade, 3)) };
    return true;
  };

  Music.stop = function (opts) {
    want = null;
    if (playing === null) return;
    fadeOut(playing, num((opts || NONE).fade, 3), Sound.now());
    playing = null;
  };

  function setTarget(v, time) {
    target = Core.clamp(num(v, 0), 0, 1);
    glide = max(0.01, num(time, 6));
  }

  Music.intensity = function (v, time) {
    if (v === undefined) return current;
    setTarget(v, time);
    heldAt = Sound.now();
    return target;
  };

  Music.trace = function (fn) { traceFn = typeof fn === 'function' ? fn : null; };

  Music.stats = function () {
    return {
      playing: Music.playing, step: playing !== null ? playing.step : 0, scheduled: counts.scheduled, notes: counts.notes,
      intensity: current, target,
    };
  };

  // How loud a layer is at the intensity now: nothing below from, all of its level from + span on. A layer from
  // 0 sounds even at rest.
  function layerLevel(l) {
    if (l.from <= 0) return l.level;
    const k = (current - l.from) / l.span;
    return l.level * (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
  }

  // A layer whose function threw is reported once and stays silent: in this playing and in later ones.
  function blame(inst, L, err) {
    const name = inst.id + '.' + L.def.id;
    L.broken = true;
    if (!broken.has(name)) {
      broken.add(name);
      console.error('Music: the layer "' + name + '" threw:', err);
    }
  }

  function layers(inst, c, now) {
    inst.m.intensity = current;
    for (let i = 0; i < inst.layers.length; i++) {
      const L = inst.layers[i], level = L.broken ? 0 : layerLevel(L.def);
      if (abs(level - L.level) > NUDGE || (level === 0 && L.level !== 0)) {
        L.out.gain.setTargetAtTime(level, now, LAYER_TIME);
        L.level = level;
      }
      if (level > 0 && !L.on) {
        L.on = true;
        if (L.def.hold !== null) {
          try {
            const got = L.def.hold(c, L.out, max(now, inst.t0), inst.m);
            L.sources = Array.isArray(got) ? got : null;
          } catch (err) {
            blame(inst, L, err);
          }
        }
      } else if (level === 0 && L.on) {
        L.on = false;
        stopSources(L, now + LAYER_TIME * 6);   // once its gain has gone
      }
    }
  }

  function schedule(inst, c, i, at) {
    for (let k = 0; k < inst.layers.length; k++) {
      const L = inst.layers[k];
      if (!L.on || L.broken || L.def.step === null || L.level <= 0) continue;
      try {
        const n = L.def.step(c, L.out, at, inst.m, i);
        if (n > 0) counts.notes += n;
      } catch (err) {
        blame(inst, L, err);
      }
    }
    counts.scheduled++;
    if (traceFn !== null) traceFn(i, at);
  }

  Music.tick = function () {
    if (!Sound.live() || Sound.state !== 'running') return;   // not even while a gesture is still waking it
    const c = Sound.context, now = Sound.now();
    const dt = lastTick < 0 || now < lastTick ? 0 : now - lastTick;
    lastTick = now;
    if (current !== target) current = Core.approach(current, target, dt / glide);
    for (let i = fading.length - 1; i >= 0; i--) {
      if (now > fading[i].ending) {
        finish(fading[i]);
        fading[i] = fading[fading.length - 1];
        fading.length--;
      }
    }
    if (want !== null) {
      if (playing !== null) fadeOut(playing, want.fade, now);
      playing = begin(want.id, want.fade, now);
      want = null;
    }
    if (playing === null) return;
    const inst = playing, dur = inst.m.stepTime;
    layers(inst, c, now);
    let at = inst.t0 + inst.step * dur;
    if (at < now - LOOK) {             // the clock ran on without us: what was missed is skipped
      inst.step = Math.ceil((now - inst.t0) / dur);
      at = inst.t0 + inst.step * dur;
    }
    while (at < now + LOOK) {
      schedule(inst, c, inst.step++, at);
      at = inst.t0 + inst.step * dur;
    }
  };

  const tollAt = { note: 0, level: 1, x: undefined, y: undefined };
  Music.toll = function (opts) {
    const o = opts || NONE, p = playing !== null ? playing.p : want !== null ? pieces.get(want.id) : pieces.get('vigil');
    tollAt.note = o.note !== undefined ? o.note : p ? p.toll : 26;
    tollAt.level = num(o.level, 1);
    tollAt.x = o.x;
    tollAt.y = o.y;
    const handle = Sound.sfx('toll', tollAt);
    if (handle > 0 && duckCtx !== null && duckCtx === Sound.context) {
      const now = Sound.now();
      for (const g of [duckDry.gain, duckWet.gain]) {
        g.cancelScheduledValues(now);
        g.setTargetAtTime(0.45, now, 0.06);
        g.setTargetAtTime(1, now + 2.4, 1.1);
      }
    }
    return handle;
  };

  // ---- the vigil ----
  // D dorian, slow. At rest: the hum of a great bell that never stops, and water far off. Then a tolling figure, a
  // bell a bar, open and muffled by turns. Then six bells hunting through their rows, with the gap ringers leave
  // before each handstroke. Then a line that moves through the mode, and last a pulse.

  const LINE = [0, 2, 3, 2, 4, 3, 1, 0, 4, 5, 4, 3, 2, 3, 1, 0];   // degrees of the moving line, two beats each
  const FIGURE = [0, 0, -3, 0];                                      // degrees of the tolling figure, a bar each

  Music.define('vigil', {
    tonic: 'D3', mode: 'dorian', tempo: 56, div: 4, beats: 4, bells: 6, method: 'plain-hunt', toll: 'D2',
    ring: { octave: 1, weight: 0.3, partials: 5, length: 1.6 },
    layers: [
      {
        id: 'hum', from: 0, level: 0.55, wet: 0.5,
        hold: function (c, out, t, m) {
          const keep = [], f = m.freq(0, -1), swell = c.createGain(), breath = c.createOscillator(), by = c.createGain();
          swell.gain.value = 0.75;
          breath.frequency.setValueAtTime(0.045, t);
          by.gain.setValueAtTime(0.25, t);
          breath.connect(by);
          by.connect(swell.gain);
          swell.connect(out);
          const forever = { attack: 4, hold: 1e5, decay: 2, keep };
          Sound.tone(c, swell, t, Object.assign({ freq: f, level: 0.3 }, forever));
          Sound.tone(c, swell, t, Object.assign({ freq: f * 1.004, level: 0.26 }, forever));
          Sound.tone(c, swell, t, Object.assign({ freq: f * 2, level: 0.12 }, forever));
          Sound.tone(c, swell, t, Object.assign({ freq: f * 3, level: 0.05 }, forever));
          breath.start(t);
          keep.push(breath);
          return keep;
        },
      },
      {
        id: 'water', from: 0, level: 0.5, wet: 0.7,
        hold: function (c, out, t) {
          const keep = [];
          Sound.water(c, out, t, { freq: 380, rate: 0.09, attack: 5, hold: 1e5, decay: 2, level: 0.5, keep });
          return keep;
        },
      },
      {
        id: 'toll', from: 0.25, level: 0.6, wet: 0.6,
        step: function (c, out, t, m, i) {
          if (i % m.bar !== 0) return 0;
          const b = (i / m.bar) % FIGURE.length;
          Sound.bell(c, out, t, { freq: m.freq(FIGURE[b], 0), weight: 0.75, muffled: b % 2 ? 0.7 : 0, level: 0.5, partials: 8 });
          return 1;
        },
      },
      {
        id: 'hunt', from: 0.5, level: 0.45, wet: 0.55,
        step: function (c, out, t, m, i) {
          const n = m.bells, span = 2 * n + 1, at = i % span;
          if (at === 2 * n) return 0;                                     // the handstroke gap
          const bell = m.row(2 * floor(i / span) + (at >= n ? 1 : 0))[at % n];
          m.ring(c, out, t + (m.rand(i, 1) - 0.5) * 0.02, bell, 0.16 + 0.025 * bell);   // ringers are not machines
          return 1;
        },
      },
      {
        id: 'line', from: 0.65, level: 0.4, wet: 0.45,
        step: function (c, out, t, m, i) {
          const every = 2 * m.beat;
          if (i % every !== 0) return 0;
          const f = m.freq(LINE[(i / every) % LINE.length], 0), d = every * m.stepTime;
          Sound.tone(c, out, t, { type: 'triangle', freq: f, attack: 0.35, hold: d * 0.55, decay: d * 0.9, level: 0.16 });
          Sound.tone(c, out, t, { type: 'triangle', freq: f * 1.003, attack: 0.5, hold: d * 0.5, decay: d * 0.9, level: 0.1 });
          return 2;
        },
      },
      {
        id: 'pulse', from: 0.82, span: 0.12, level: 0.5, wet: 0.25,
        step: function (c, out, t, m, i) {
          const at = i % m.beat;
          if (at > 1) return 0;
          const soft = at === 1 ? 0.6 : 1;
          Sound.tone(c, out, t, { freq: 64, to: 44, attack: 0.004, decay: 0.24, level: 0.5 * soft });
          Sound.noise(c, out, t, { color: 'brown', filter: 'lowpass', freq: 220, attack: 0.002, decay: 0.12, level: 0.3 * soft });
          return 2;
        },
      },
    ],
  });

  // ---- the game ----

  let lifeTop = 0, lastRun = null;
  const near2 = 7 * 7;

  // A stand-in for the danger the game will report: 0 to 1.
  function danger(S) {
    const p = S.player, items = S.enemies.items;
    if (S !== lastRun) {
      lastRun = S;
      lifeTop = 0;
    }
    if (p.life > lifeTop) lifeTop = p.life;
    let near = 0;
    for (let i = 0; i < S.enemies.n; i++) {
      const e = items[i];
      if (e.alive && (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y) < near2) near++;
    }
    let d = min(1, S.toll / 8) * 0.5 + min(1, near / 30) * 0.35;
    if (lifeTop > 0) d += (1 - Core.clamp(p.life / lifeTop, 0, 1)) * 0.3;
    if (S.boss !== null) d += 0.2;
    return Core.clamp(d, 0, 1);
  }

  function runPiece() {
    const S = Game.S, id = S && S.zone ? S.zone.music : null;
    return typeof id === 'string' && pieces.has(id) ? id : 'vigil';
  }

  Plat.on('boot', function () { Music.play('vigil', { fade: 4, intensity: 0 }); });
  Plat.on('state', function (state) {
    if (state === 'title') {
      Music.play('vigil', { fade: 4 });
      setTarget(0, 4);
    } else if (state === 'run') {
      Music.play(runPiece(), { fade: 4 });
    } else if (state === 'results') {
      setTarget(0, 8);
    }
  });
  Plat.on('step', function (S, live) {
    if (live && S.step % 30 === 0 && Sound.live() && Sound.now() - heldAt > HELD) setTarget(danger(S), 4);
  });
  Plat.on('frame', function () { Music.tick(); });
})();
