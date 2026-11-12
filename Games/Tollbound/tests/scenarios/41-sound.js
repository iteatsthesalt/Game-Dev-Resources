// tests/scenarios/41-sound.js: the sound engine (53-sound.js), the music (54-music.js) and the first effects
// (55-sound-core.js). Nobody can listen here, so the sounds are checked by their numbers:
//   quiet     before the first gesture every call does nothing and throws nothing, and an event a script makes
//             opens no sound; with WebAudio taken away, a real gesture opens nothing either, and every call of
//             Sound and Music stays a quiet no-op, also when a run's events reach the engine
//   renders   every defined effect renders offline to samples that are not silent, are all numbers and do not
//             clip; renderings repeat exactly; the bell: its strongest low partial is the hum, the prime,
//             tierce, quint and nominal stand out above it (a small Fourier sum at each), a muffled bell has a
//             slower attack than an open one, and a cracked bell is shorter; the crowd effects are quieter and
//             shorter than the rare ones
//   limits    a real click opens the context; then with a stand-in clock: 200 calls in one instant start one
//             playing and merge the rest; 200 sources within one frame start no more than the effect's cap;
//             the engine never sounds more than its limit; a toll takes the place of a crowd sound and a crowd
//             sound does not take the place of a toll; finished playings are let go; the page hidden suspends
//             the context and the page shown wakes it; the volume settings reach the buses
//   music     change ringing: plain hunt on 6 and on 5 bells, rounds, place notation; the scheduler: with a
//             stand-in clock, each step is scheduled once, in order, inside the next quarter second; nothing
//             while suspended, and after waking it goes on without repeating a step; Music.stop ends it;
//             Music.toll rings the toll on the effects bus
//   wiring    menus moved by keys and pressed play their sounds; a live step's events play their effects,
//             merged; a step that is not live plays nothing; on a phone, a finger's tap opens the sound
// Each function below runs inside the page (see tests/run.js), so it uses only T, TB and the page itself.

const quiet = async function () {
  const { Sound, Music, Game, Sim, Plat } = TB;
  const ids = Sound.list();
  T.check('before any gesture the engine waits, with no context', Sound.state === 'waiting' && Sound.context === null && Sound.live() === false, Sound.state);
  // every call, as the game would make it
  const everything = function () {
    let handles = 0;
    for (const id of ids) handles += Sound.sfx(id, { x: 1, y: 2, level: 1, pitch: 1, key: 3 });
    handles += Sound.sfx('no.such.effect', null);
    Sound.stop(1);
    Sound.stopAll();
    Sound.suspend();
    Sound.resume();
    Music.play('vigil', { fade: 1 });
    Music.intensity(1, 0);
    Music.tick();
    handles += Music.toll();
    Music.stop({ fade: 1 });
    Music.tick();
    return handles;
  };
  let threw = null, handles = -1;
  const warn = console.warn;
  console.warn = function () {};   // the unknown effect is reported with a warning; it is no fault here
  try { handles = everything(); } catch (e) { threw = String(e && e.stack || e); } finally { console.warn = warn; }
  const st = Sound.stats();
  T.check('before a gesture every call of Sound and Music does nothing and throws nothing', threw === null && handles === 0 && st.started === 0 && st.voices === 0,
    threw || { handles, stats: st });
  T.check('the calls were heard as made while nothing could sound', st.quiet >= ids.length, st.quiet);
  T.check('and the music scheduled nothing', Music.stats().scheduled === 0 && Music.playing === null, Music.stats());

  // an event made by a script is not a player's gesture
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }));
  document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  T.check('an event a script makes opens no sound', Sound.context === null && Sound.state === 'waiting', Sound.state);

  // WebAudio taken away, then a player's own click and key
  for (const name of ['AudioContext', 'webkitAudioContext', 'OfflineAudioContext', 'webkitOfflineAudioContext']) delete window[name];
  T.check('without WebAudio the engine says it is off', Sound.state === 'off', Sound.state);
  await T.tap(40, 300);
  await T.key('F8');
  await T.sleep(100);
  T.check('and a real click and key open nothing', Sound.state === 'off' && Sound.context === null && Sound.live() === false, Sound.state);
  console.warn = function () {};
  try { threw = null; handles = everything(); } catch (e) { threw = String(e && e.stack || e); } finally { console.warn = warn; }
  T.check('without WebAudio every call of Sound and Music is a quiet no-op', threw === null && handles === 0 && Sound.stats().started === 0 && Music.stats().scheduled === 0,
    threw || { handles, stats: Sound.stats(), music: Music.stats() });
  const rendered = await Sound.render(ids[0], {}, 0.5).then((d) => d, (e) => 'rejected: ' + e);
  T.check('and a rendering gives null', rendered === null, String(rendered));

  // a run's events reach the engine as they would, and nothing sounds or breaks
  const S = Game.start();
  if (S) {
    for (const k of ['hit', 'kill', 'hurt', 'wound', 'mend', 'scar', 'pull', 'trade', 'heave', 'pickup', 'level', 'offer', 'favour', 'count', 'toll', 'gate', 'stroke', 'telegraph']) {
      Sim.emit(S, k, S.player.x + 1, S.player.y, 0, 1, null);
    }
    let fault = null;
    try {
      Plat.emit('step', S, true);
      Game.sim(1);
    } catch (e) { fault = String(e); }
    T.check('a run\'s events without WebAudio play nothing and break nothing', fault === null && Sound.stats().started === 0 && S.phase === 'play', fault);
    Game.title();
  }
  return T.done();
};

const renders = async function () {
  const { Sound } = TB;
  const ids = Sound.list(), rate = 48000;
  const FIRST = ['menu.move', 'menu.choose', 'pickup', 'pickup.big', 'hit', 'hit.heavy', 'kill', 'kill.great', 'hurt', 'mend', 'scar', 'level',
    'offer', 'count', 'gate.open', 'gate.hold', 'toll', 'warning'];
  T.check('the first set of effects is defined', FIRST.every((id) => ids.includes(id)), ids.join(' '));
  const measure = (d) => {
    let peak = 0, bad = 0;
    for (let i = 0; i < d.length; i++) {
      const v = d[i];
      if (!Number.isFinite(v)) bad++;
      else if (Math.abs(v) > peak) peak = Math.abs(v);
    }
    let last = 0;
    for (let i = d.length - 1; i >= 0; i--) if (Math.abs(d[i]) > peak * 0.01) { last = i + 1; break; }
    let sum = 0;
    for (let i = 0; i < last; i++) if (Number.isFinite(d[i])) sum += d[i] * d[i];
    return { peak: +peak.toFixed(4), rms: last ? +Math.sqrt(sum / last).toFixed(5) : 0, length: +(last / rate).toFixed(3), bad };
  };
  const fine = (m) => m.bad === 0 && m.peak > 0.01 && m.rms > 0.001 && m.peak < 0.98;
  const table = {};
  for (const id of ids) {
    const info = Sound.info(id);
    const d = await Sound.render(id, {}, info.length + 0.5);
    const m = d instanceof Float32Array && d.length > 0 ? measure(d) : { bad: -1, peak: 0, rms: 0, length: 0 };
    table[id] = Object.assign({ crowd: info.crowd }, m);
    T.check(id + ': renders to a sound that is not silent, holds only numbers, and does not clip', fine(m), m);
  }
  // other variations: with the room, higher, louder by the caller's own level, other random seeds
  const worst = [];
  for (const id of ids) {
    for (const opts of [{ room: true }, { pitch: 1.5 }, { pitch: 0.7, seed: 9 }, { seed: 2 }, { seed: 77 }]) {
      const m = measure(await Sound.render(id, opts, Sound.info(id).length + 0.5));
      if (!fine(m)) worst.push({ id, opts, m });
    }
  }
  T.check('every effect stays clean with the room, at other pitches and with other random variations', worst.length === 0, worst.slice(0, 4));
  // The same choices, so the same sound; the browser may sum a node's inputs in another order, which moves the
  // last bits of a sample (about 1e-7), and another seed is another sound.
  const apart = (x, y) => { let d = x.length === y.length ? 0 : Infinity; for (let i = 0; i < x.length && i < y.length; i++) d = Math.max(d, Math.abs(x[i] - y[i])); return d; };
  const a = await Sound.render('pickup', { seed: 5 }, 0.6), b = await Sound.render('pickup', { seed: 5 }, 0.6), other = await Sound.render('pickup', { seed: 6 }, 0.6);
  T.check('the same rendering twice gives the same sound, and another seed another', apart(a, b) < 1e-5 && apart(a, other) > 1e-3, [apart(a, b), apart(a, other)]);
  const rejected = await Sound.render('no.such.effect', {}, 0.2).then(() => false, () => true);
  T.check('rendering an effect that is not defined is refused', rejected);
  const baked = await Sound.bake((c, out, t) => Sound.bell(c, out, t, { note: 62, weight: 0.3, partials: 5, beat: 0, length: 1 }), null, 1.2);
  const replayed = measure(await Sound.render((c, out, t) => Sound.replay(c, out, t, baked, { level: 0.5 }), {}, 1.5));
  T.check('a baked sound replays: Sound.bake gives a buffer, Sound.replay plays it', !!baked && baked.sampleRate === rate && fine(replayed), replayed);

  // the crowd effects, which fire many times a second, are quieter and shorter than the rare ones
  const median = (list) => { const s = list.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
  const rare = Object.values(table).filter((m) => !m.crowd), crowd = Object.entries(table).filter((e) => e[1].crowd);
  const loud = median(rare.map((m) => m.rms)), long = median(rare.map((m) => m.length));
  const over = crowd.filter((e) => !(e[1].rms < loud && e[1].length < long)).map((e) => e[0]);
  T.check('the effects that fire in crowds are quieter and shorter than the rare ones', crowd.length >= 3 && over.length === 0,
    { rareRms: loud, rareLength: long, over, crowd: crowd.map((e) => e[0]) });

  // ---- the bell ----
  const bell = (spec) => (c, out, t) => Sound.bell(c, out, t, spec);
  const note = 48, prime = Sound.note(note);           // C3; its hum is C2
  const open = await Sound.render(bell({ note, level: 0.6 }), {}, 2.5);
  // a Hann-windowed Fourier sum at one frequency, from 0.02 s to 1.02 s after the strike
  const from = Math.round(0.02 * rate), n = rate;
  const hann = new Float32Array(n);
  for (let i = 0; i < n; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
  const at = (d, f) => {
    let re = 0, im = 0;
    const w = 2 * Math.PI * f / rate;
    for (let i = 0; i < n; i++) {
      const x = d[from + i] * hann[i];
      re += x * Math.cos(w * i);
      im -= x * Math.sin(w * i);
    }
    return Math.sqrt(re * re + im * im) * 4 / n;
  };
  let low = 0, lowAt = 0;
  for (let f = 30; f <= prime * 1.1; f += 0.5) {
    const m = at(open, f);
    if (m > low) { low = m; lowAt = f; }
  }
  T.check('the bell\'s strongest low partial is its hum, an octave below the prime', Math.abs(lowAt - prime / 2) <= 2, { strongest: lowAt, hum: prime / 2, prime });
  const parts = { prime: 1, tierce: 1.2, quint: 1.5, nominal: 2 }, gaps = [0.62, 0.75, 0.88, 1.1, 1.35, 1.75, 2.25];
  const between = Math.max(...gaps.map((r) => at(open, prime * r)));
  const strengths = {};
  for (const k in parts) strengths[k] = +at(open, prime * parts[k]).toFixed(5);
  const missing = Object.keys(parts).filter((k) => !(strengths[k] > 10 * between && strengths[k] > 0.05 * low));
  T.check('the prime, the tierce a minor third above it, the quint and the nominal stand out above the hum', missing.length === 0,
    { missing, strengths, hum: +low.toFixed(5), between: +between.toFixed(6) });
  const envelope = (d) => {   // the largest sample of each millisecond
    const per = rate / 1000, e = [];
    for (let i = 0; i + per <= d.length; i += per) {
      let p = 0;
      for (let k = 0; k < per; k++) p = Math.max(p, Math.abs(d[i + k]));
      e.push(p);
    }
    return e;
  };
  const rise = (d) => { const e = envelope(d), top = Math.max(...e); return e.findIndex((v) => v >= top * 0.9); };
  const muffled = await Sound.render(bell({ note, level: 0.6, muffled: 1 }), {}, 2.5);
  T.check('a muffled bell has a slower attack than an open one', rise(muffled) >= 20 && rise(open) <= 5, { openMs: rise(open), muffledMs: rise(muffled) });
  const cracked = await Sound.render(bell({ note, level: 0.6, cracked: 1 }), {}, 2.5);
  const om = measure(open), cm = measure(cracked);
  T.check('a cracked bell is shorter', cm.length < om.length * 0.5 && cm.peak > 0.01, { open: om.length, cracked: cm.length });
  const highs = [], lows = [];
  for (const k of [4, 6]) highs.push(at(open, prime * k));
  T.check('the high partials die within a fraction of a second while the hum rings on', Math.max(...highs) < 0.05 * low, { highs, hum: low });
  lows.push(measure(await Sound.render(bell({ note: 38, weight: 1 }), {}, 16)).length, measure(await Sound.render(bell({ note: 38, weight: 0 }), {}, 16)).length);
  T.check('a great bell rings on for many seconds, a handbell for a moment', lows[0] > 4 && lows[1] < lows[0] / 2, lows);
  return T.done();
};

// The context opens on a player's click; then a stand-in clock holds time still or moves it by hand.
const limits = async function () {
  const { Sound, Settings } = TB;
  await T.tap(40, 300);
  await T.until(() => Sound.state === 'running', 5000);
  T.check('a real click opens the context, and it runs', Sound.context !== null && Sound.state === 'running' && Sound.live(), Sound.state);
  T.check('the buses are there', !!Sound.bus('effects') && !!Sound.bus('music') && Sound.bus('nothing') === null);
  let now = Sound.context.currentTime + 2;
  Sound.clock(() => now);
  T.check('the stand-in clock is the engine\'s clock', Sound.now() === now);

  const cap = Sound.info('kill').cap, k0 = Sound.stats('kill');
  const handles = new Set();
  for (let i = 0; i < 200; i++) handles.add(Sound.sfx('kill', { x: i % 9, y: 0 }));
  const k1 = Sound.stats('kill');
  T.check('200 calls of one effect in one instant start one playing, and the rest merge into it', k1.started - k0.started === 1 && k1.merged - k0.merged === 199 && handles.size === 1,
    { started: k1.started - k0.started, merged: k1.merged - k0.merged, handles: handles.size });

  now += 1;
  const k2 = Sound.stats('kill');
  for (let i = 0; i < 200; i++) {
    now += 1 / 60 / 200;
    Sound.sfx('kill', { x: 0, y: 0, key: 'source ' + i });
  }
  const k3 = Sound.stats('kill');
  T.check('200 calls from 200 sources within one frame start no more playings than the effect\'s cap', k3.started - k2.started <= cap && k3.voices <= cap,
    { started: k3.started - k2.started, voices: k3.voices, cap });

  now += 1;
  const far0 = Sound.stats('kill').dropped, far = Sound.sfx('kill', { x: 5000, y: 5000, key: 'far' });
  T.check('a sound far off the screen is too faint to start', far === 0 && Sound.stats('kill').dropped === far0 + 1, far);

  now += 1;
  const g = Sound.stats('warning'), gap = Sound.info('warning').gap;
  for (let i = 0; i < 100; i++) {
    now += 0.01;
    Sound.sfx('warning', { x: 0, y: 0 });
  }
  const g2 = Sound.stats('warning');
  T.check('one source keeps its gap: 100 calls over a second start one playing a gap at most, and drop the rest',
    g2.started - g.started <= Math.ceil(1 / gap) + 1 && g2.started > g.started && g2.dropped - g.dropped >= 50,
    { started: g2.started - g.started, merged: g2.merged - g.merged, dropped: g2.dropped - g.dropped, gap });

  // the engine's own limit, with every effect and many sources at once
  const ids = Sound.list(), limit = Sound.stats().limit;
  let most = 0;
  for (let i = 0; i < 400; i++) {
    now += 0.002;
    Sound.sfx(ids[i % ids.length], { x: (i % 13) - 6, y: 0, key: i });
    most = Math.max(most, Sound.stats().voices);
  }
  T.check('the engine never sounds more than its limit at once', most <= limit && Sound.stats().most <= limit && most > 0, { most, limit, stats: Sound.stats() });
  // two effects of this test that may fill the engine by themselves: a common one and a great one
  Sound.stopAll(0);
  Sound.define('test.common', (c, out, t) => Sound.tone(c, out, t, { freq: 300, decay: 2, level: 0.3 }), { cap: 99, gap: 0, priority: 1, level: 0.5, length: 2 });
  Sound.define('test.great', (c, out, t) => Sound.tone(c, out, t, { freq: 100, decay: 4, level: 0.3 }), { cap: 99, gap: 0, priority: 3, level: 0.5, length: 4 });
  const c0 = Sound.stats('test.common');
  for (let i = 0; i < limit + 20; i++) {
    now += 0.001;
    Sound.sfx('test.common', { key: i });
  }
  const c1 = Sound.stats('test.common');
  T.check('a stream of like sounds fills the engine to its limit, and the rest are dropped, not swapped in', c1.started - c0.started === limit && c1.stolen === 0 &&
    Sound.stats().voices === limit, { started: c1.started - c0.started, stolen: c1.stolen, voices: Sound.stats().voices, limit });
  const t0 = Sound.stats('toll').started, handle = Sound.sfx('toll', {});
  T.check('when every voice is taken, a toll still sounds: a playing of lower priority gives way', handle > 0 && Sound.stats('toll').started === t0 + 1 &&
    Sound.stats('test.common').stolen === 1, Sound.stats());
  now += 0.5;
  Sound.stopAll(0);
  for (let i = 0; i < limit; i++) {
    now += 0.001;
    Sound.sfx('test.great', { key: i });
  }
  const p0 = Sound.stats('pickup');
  Sound.sfx('pickup', { key: 999 });
  T.check('and a crowd sound does not take the place of a greater one', Sound.stats('pickup').started === p0.started && Sound.stats().voices === limit,
    { voices: Sound.stats().voices, limit });

  // playings are let go when they end: the frame loop sweeps them
  now += 60;
  await T.until(() => Sound.stats().voices === 0, 3000);
  T.check('every playing is let go once it has ended', Sound.stats().voices === 0, Sound.stats());
  const h = Sound.sfx('gate.hold', { seconds: 3 });
  Sound.stop(h, 0);
  T.check('Sound.stop ends a playing at once', h > 0 && Sound.stats('gate.hold').voices === 0, Sound.stats('gate.hold'));

  // the page hidden and shown
  Sound.clock(null);
  const pretend = (state) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  pretend('hidden');
  const hiddenLive = Sound.live(), refused = Sound.sfx('menu.choose', null);
  await T.until(() => Sound.state === 'suspended', 3000);
  T.check('a hidden page suspends the context, and nothing sounds meanwhile', hiddenLive === false && refused === 0 && Sound.state === 'suspended', Sound.state);
  pretend('visible');
  delete document.visibilityState;
  await T.until(() => Sound.state === 'running', 3000);
  T.check('shown again, it runs again', Sound.state === 'running' && Sound.live(), Sound.state);
  Sound.suspend();
  await T.until(() => Sound.state === 'suspended', 3000);
  T.check('Sound.suspend silences it', Sound.state === 'suspended' && !Sound.live() && Sound.sfx('menu.choose', null) === 0, Sound.state);
  Sound.resume();
  await T.until(() => Sound.state === 'running', 3000);
  T.check('and Sound.resume wakes it', Sound.state === 'running' && Sound.live(), Sound.state);

  // the volume settings, when the build has them
  if (typeof Settings.get === 'function') {
    T.check('the three volumes are settings with their defaults', Settings.get('sound.master') === 0.8 && Settings.get('sound.effects') === 0.8 && Settings.get('sound.music') === 0.6,
      [Settings.get('sound.master'), Settings.get('sound.effects'), Settings.get('sound.music')]);
    Settings.set('sound.effects', 0.5);
    Settings.set('sound.music', 0.5);
    // a bus with nothing going in is not worked out, and shows an old value: something has to sound
    const ringing = Sound.sfx('toll', { level: 0.2 });
    const bus = Sound.bus('effects').dry.gain, music = Sound.bus('music').dry.gain;
    await T.until(() => Math.abs(bus.value - 0.25) < 0.01 && Math.abs(music.value - 0.25) < 0.01, 3000);
    T.check('a volume setting reaches its bus as the square of its value', ringing > 0 && Math.abs(bus.value - 0.25) < 0.01 && Math.abs(music.value - 0.25) < 0.01,
      [ringing, bus.value, music.value]);
    Sound.stop(ringing, 0);
    Settings.set('sound.effects', 0.8);
    Settings.set('sound.music', 0.6);
  }
  return T.done();
};

const music = async function () {
  const { Music, Sound } = TB;
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  const isRow = (r, n) => r.length === n && r.slice().sort((x, y) => x - y).every((v, i) => v === i + 1);
  const byNeighbours = (rows) => rows.every((r, k) => {
    if (k === 0) return true;
    const p = rows[k - 1];
    for (let i = 0; i < r.length; i++) {
      if (r[i] === p[i]) continue;
      if (i + 1 < r.length && r[i] === p[i + 1] && r[i + 1] === p[i]) { i++; continue; }
      return false;
    }
    return true;
  });
  const rounds6 = [1, 2, 3, 4, 5, 6], hunt = Music.changes(6, 'plain-hunt');
  T.check('plain hunt on 6 bells starts from rounds and comes back to rounds after 12 rows',
    hunt.length === 13 && same(hunt[0], rounds6) && same(hunt[12], rounds6) && hunt.slice(1, 12).every((r) => !same(r, rounds6)), hunt.map((r) => r.join('')));
  T.check('every row holds each of the 6 bells once', hunt.every((r) => isRow(r, 6)));
  T.check('from one row to the next each bell keeps its place or swaps with a neighbour', byNeighbours(hunt));
  T.check('the treble hunts out to the back and home again', hunt.map((r) => r.indexOf(1) + 1).join('') === '1234566543211', hunt.map((r) => r.indexOf(1) + 1).join(''));
  const five = Music.changes(5, 'plain-hunt');
  T.check('plain hunt on 5 bells comes round after 10 rows, by neighbours', five.length === 11 && same(five[10], [1, 2, 3, 4, 5]) && five.every((r) => isRow(r, 5)) && byNeighbours(five),
    five.map((r) => r.join('')));
  const rounds = Music.changes(6, 'rounds'), more = Music.changes(6, 'rounds', 5);
  T.check('rounds keeps every bell in its place', rounds.length === 2 && more.length === 5 && more.every((r) => same(r, rounds6)), rounds);
  T.check('place notation rings the same plain hunt', same(Music.changes(6, 'x16').map((r) => r.join('')), hunt.map((r) => r.join(''))));
  T.check('a long touch is given as asked', Music.changes(6, 'plain-hunt', 30).length === 30 && byNeighbours(Music.changes(6, 'plain-hunt', 30)));
  T.check('a place that does not exist is refused', (() => { try { Music.changes(4, 'x18'); return false; } catch (e) { return true; } })());

  // ---- the scheduler ----
  T.check('the vigil is defined, and asked for at boot', Music.has('vigil') && Music.list().includes('vigil'));
  await T.tap(40, 300);
  await T.until(() => Sound.state === 'running' && Music.playing === 'vigil', 5000);
  T.check('once sound can start, the vigil plays', Music.playing === 'vigil', Music.stats());
  let now = Sound.context.currentTime + 3;
  Sound.clock(() => now);
  const seen = [];
  Music.trace((i, t) => seen.push({ i, t, now }));
  Music.intensity(1, 0.01);
  const notes0 = Music.stats().notes;
  for (let f = 0; f < 600; f++) {          // ten seconds of frames, each ticking once or twice
    now += 1 / 60;
    Music.tick();
    if (f % 3 === 0) Music.tick();
  }
  const steps = seen.map((s) => s.i), dur = 60 / 56 / 4;
  const ordered = steps.every((v, k) => k === 0 || v === steps[k - 1] + 1);
  const inWindow = seen.every((s) => s.t >= s.now - 1e-9 && s.t < s.now + 0.25 + 1e-9);
  const spaced = seen.every((s, k) => k === 0 || Math.abs(s.t - seen[k - 1].t - dur) < 1e-6);
  T.check('each step is scheduled once, in order, and only inside the next quarter second', seen.length >= 35 && ordered && inWindow && spaced,
    { count: seen.length, first: seen.slice(0, 3), ordered, inWindow, spaced });
  T.check('at full intensity the layers start notes', Music.stats().notes > notes0 && Music.intensity() === 1, Music.stats());

  Sound.suspend();
  const held = seen.length, sched = Music.stats().scheduled;
  for (let f = 0; f < 120; f++) {
    now += 1 / 60;
    Music.tick();
  }
  T.check('while suspended it schedules nothing', seen.length === held && Music.stats().scheduled === sched, { before: held, after: seen.length });
  Sound.resume();
  await T.until(() => Sound.live(), 3000);
  for (let f = 0; f < 120; f++) {
    now += 1 / 60;
    Music.tick();
  }
  const after = seen.slice(held).map((s) => s.i);
  T.check('woken, it goes on, skipping what fell in the pause and repeating no step', after.length > 0 && after[0] > steps[steps.length - 1] &&
    new Set(seen.map((s) => s.i)).size === seen.length, { last: steps[steps.length - 1], next: after.slice(0, 3) });

  const pretend = (state) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  pretend('hidden');
  const hidden = seen.length;
  for (let f = 0; f < 60; f++) { now += 1 / 60; Music.tick(); }
  T.check('nor while the page is hidden', seen.length === hidden);
  pretend('visible');
  delete document.visibilityState;
  await T.until(() => Sound.live(), 3000);

  const t0 = Sound.stats('toll').started, h = Music.toll();
  T.check('Music.toll rings the toll on the effects bus', h > 0 && Sound.stats('toll').started === t0 + 1, Sound.stats('toll'));
  Music.stop({ fade: 0.2 });
  const stopped = seen.length;
  for (let f = 0; f < 120; f++) { now += 1 / 60; Music.tick(); }
  T.check('Music.stop ends the music: nothing more is scheduled', Music.playing === null && seen.length === stopped, Music.stats());
  Music.play('vigil', { fade: 0.1, intensity: 0 });
  for (let f = 0; f < 30; f++) { now += 1 / 60; Music.tick(); }
  T.check('and it plays again when asked, from its first step', Music.playing === 'vigil' && seen[seen.length - 1].i < 10, seen.slice(-2));
  Music.trace(null);
  Sound.clock(null);
  Sound.stopAll(0);
  return T.done();
};

const wiring = async function () {
  const { Sound, UI, Game, Sim, Plat } = TB;
  await T.tap(40, 300);
  await T.until(() => Sound.state === 'running', 5000);
  T.check('a real click opens the sound', Sound.state === 'running', Sound.state);

  // the menus: keys move the focus, Enter presses
  const m0 = Sound.stats('menu.move').started, c0 = Sound.stats('menu.choose').started;
  const answer = UI.confirm('Ring the bell?');
  await T.key('ArrowLeft');
  await T.until(() => Sound.stats('menu.move').started > m0, 2000);
  T.check('a focus moved by keys plays menu.move', Sound.stats('menu.move').started > m0, Sound.stats('menu.move'));
  await T.key('Enter');
  const said = await Promise.race([answer, T.sleep(2000).then(() => 'no answer')]);
  T.check('a control pressed plays menu.choose', said === true && Sound.stats('menu.choose').started > c0, { said, stats: Sound.stats('menu.choose') });

  // a live step's events
  const S = Game.start();
  T.check('a run starts', !!S);
  if (!S) return T.done();
  const p = S.player, k0 = Sound.stats('kill'), t0 = Sound.stats('toll').started, g0 = Sound.stats('kill.great').started;
  for (let i = 0; i < 300; i++) Sim.emit(S, 'kill', p.x + (i % 7) - 3, p.y + 1, Sim.COMMON, 1, 'debug.husk');
  Sim.emit(S, 'kill', p.x, p.y + 2, Sim.ELITE, 1, 'debug.husk');
  Sim.emit(S, 'toll', p.x, p.y, 1, 0, null);
  Sim.emit(S, 'hit', p.x + 1, p.y, 0, 0, null);
  Plat.emit('step', S, true);
  const k1 = Sound.stats('kill');
  T.check('300 deaths in one step sound as one playing, merged', k1.started - k0.started === 1 && k1.merged - k0.merged === 299, { started: k1.started - k0.started, merged: k1.merged - k0.merged });
  T.check('an elite\'s death and the toll play their own effects', Sound.stats('kill.great').started === g0 + 1 && Sound.stats('toll').started === t0 + 1,
    [Sound.stats('kill.great'), Sound.stats('toll')]);
  const before = Sound.stats().started;
  Sim.emit(S, 'kill', p.x, p.y, Sim.COMMON, 1, 'debug.husk');
  Plat.emit('step', S, false);
  Game.sim(1);
  T.check('a step that is not live (Game.sim) plays nothing', Sound.stats().started === before, Sound.stats().started - before);
  await T.sleep(300);
  T.check('the frame loop goes on with the sound running', S.phase === 'play' && Game.state === 'run' && S.step > 60, S.step);
  Game.title();
  Sound.stopAll(0);
  return T.done();
};

const phone = async function () {
  const { Sound, Music } = TB;
  T.check('a phone waits for a touch', Sound.state === 'waiting');
  await T.tap(40, 300);
  await T.until(() => Sound.state === 'running', 5000);
  T.check('a finger\'s tap opens the sound, and the vigil begins', Sound.state === 'running' && Sound.stats().limit > 0, Sound.stats());
  await T.until(() => Music.playing === 'vigil', 3000);
  T.check('the music starts at rest', Music.playing === 'vigil' && Music.intensity() === 0, Music.stats());
  return T.done();
};

module.exports = [
  { name: 'sound: quiet before a gesture, and without WebAudio', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d', run: quiet },
  { name: 'sound: every effect renders, and the bell is a bell', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d', run: renders, timeout: 180000 },
  { name: 'sound: limits, with a stand-in clock', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d', run: limits },
  { name: 'sound: music, change ringing and the scheduler', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d', run: music },
  { name: 'sound: the game\'s events and menus', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d&seed=3', run: wiring },
  { name: 'sound: a touch opens it, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d', run: phone },
];
