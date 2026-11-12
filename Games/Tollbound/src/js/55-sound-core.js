// 55-sound-core.js: the first set of effects, each a few lines built from the helpers of 53-sound.js, and the
// wiring that plays them: the events of every live simulation step, and the menus.
// Owns: (none)
// Public: no functions. It defines these effects with Sound.define (crowd: may fire many times a second):
//   menu.move      a dry wooden tick: focus moved by keys or a pad, a slider stepped
//   menu.choose    the clapper's knock and a small handbell: a control pressed
//   pickup         crowd. A drop of water and a tiny bell, on a note of the pentatonic chosen at random
//   pickup.big     a larger drop, and two handbells a fourth apart
//   hit            crowd. A damp blow: a falling thump and a burst of dull noise
//   hit.heavy      a heavier blow, with the clank of a small cracked bell
//   kill           crowd. The dead sink: a slosh of water falling in pitch, and a bubble
//   kill.great     a great one sinks: a wide splash, a rumble, and a low muffled bell
//   hurt           the player hurt: a close, dry knock, a scrape and a cracked bell
//   level          a level gained: four handbells climbing the mode, and candles flaring
//   offer          an offer opening: a shimmer of tiny half-muffled bells, a breath, a crackle of wax
//   gate.open      a gate opening: a rope and beam creak, two pulley clicks, water drawn back, a muffled bell
//   gate.hold      a gate held: a tone swelling for opts.seconds (3) under a creak, then an open bell
//   toll           the great bell: a strike on opts.note ('D2'), and a low stroke felt in the stones
//   warning        a coming attack: a rising hiss, then two quick strikes of a cracked bell
// The wiring:
//   the notice 'step', when live (not inside Game.sim), and 'command': every event of S.events plays its effect,
//   merged and limited by the engine; hits, deaths, pickups, gates and warnings where they happened (x, y), the
//   player's hurt, a level, an offer and the toll in the middle:
//     hit -> hit, crit -> hit.heavy, kill -> kill (kill.great when its rank a is Sim.ELITE or above),
//     hurt -> hurt, pickup -> pickup (pickup.big when its kind a is not 0 or its value b is 10 or more:
//     a guess until the pickups are written), level -> level, offer -> offer, toll -> Music.toll() (the
//     effect toll when there is no music), gate -> gate.open, telegraph -> warning
//   after each live step: while the gate's hold (S.gate.hold) is growing, gate.hold sounds; when it stops
//   growing for a tenth of a second, the sound is let go
//   the menus, through the events the menu framework (70-ui-core.js) sends on its own controls inside #ui:
//   focus that moves within 300 ms of a 'ui-nav' event or a Tab key plays menu.move; a click on a control
//   plays menu.choose; a slider's 'input' plays menu.move, more softly.
(function () {
  'use strict';

  const max = Math.max, floor = Math.floor;
  const DROPS = [86, 89, 91, 93, 96];          // D, F, G, A and C, around the sixth octave
  const RISE = [74, 77, 81, 86];               // D5 F5 A5 D6
  const SHIMMER = [93, 96, 98, 101, 98];       // A6 C7 D7 F7 D7

  function pitch(o) { return typeof o.pitch === 'number' && o.pitch > 0 ? o.pitch : 1; }

  // ---- the menus ----

  Sound.define('menu.move', function (c, out, t, o) {
    const p = pitch(o);
    Sound.click(c, out, t, { freq: Sound.vary(2900, 0.05) * p, q: 4, level: 2, decay: 0.03 });
    return Sound.tone(c, out, t, { freq: 1760 * p, attack: 0.001, decay: 0.05, level: 0.04 });
  }, { gap: 0.03, cap: 2, wet: 0.05, level: 0.6, length: 0.08 });

  Sound.define('menu.choose', function (c, out, t, o) {
    const p = pitch(o);
    Sound.click(c, out, t, { freq: 1700 * p, q: 5, level: 0.8, decay: 0.03 });
    return Sound.bell(c, out, t + 0.012, { freq: Sound.note(86) * p, weight: 0.05, level: 0.4, partials: 6, length: 0.9 });
  }, { gap: 0.06, cap: 2, wet: 0.15, level: 0.7, length: 1 });

  // ---- the run ----

  Sound.define('pickup', function (c, out, t, o) {
    const f = Sound.note(DROPS[floor(Sound.rand() * DROPS.length)]) * pitch(o);
    Sound.tone(c, out, t, { freq: f * 0.45, to: f * 1.1, glide: 0.03, attack: 0.001, decay: 0.07, level: 0.5 });
    return Sound.bell(c, out, t + 0.02, { freq: f, weight: 0, level: 0.35, partials: 5, beat: 0, length: 0.35 });
  }, { gap: 0.035, cap: 4, wet: 0.2, level: 0.45, length: 0.4, crowd: true });

  Sound.define('pickup.big', function (c, out, t, o) {
    const p = pitch(o);
    Sound.tone(c, out, t, { freq: 700 * p, to: 1500 * p, glide: 0.04, attack: 0.001, decay: 0.09, level: 0.45 });
    Sound.bell(c, out, t + 0.03, { freq: Sound.note(81) * p, weight: 0.2, level: 0.55, partials: 7, length: 1.1 });
    return Sound.bell(c, out, t + 0.14, { freq: Sound.note(86) * p, weight: 0.15, level: 0.5, partials: 7, length: 1.2 });
  }, { gap: 0.12, cap: 2, wet: 0.3, level: 0.7, length: 1.4 });

  Sound.define('hit', function (c, out, t, o) {
    const p = pitch(o) * Sound.vary(1, 0.08);
    Sound.tone(c, out, t, { freq: 150 * p, to: 62 * p, glide: 0.07, attack: 0.002, decay: 0.09, level: 0.6 });
    return Sound.noise(c, out, t, { color: 'pink', filter: 'lowpass', freq: 1500 * p, to: 500 * p, q: 0.9, attack: 0.001, decay: 0.07, level: 0.55 });
  }, { gap: 0.025, cap: 5, wet: 0.1, level: 0.2, length: 0.12, crowd: true });

  Sound.define('hit.heavy', function (c, out, t, o) {
    const p = pitch(o) * Sound.vary(1, 0.05);
    Sound.tone(c, out, t, { freq: 120 * p, to: 45 * p, glide: 0.12, attack: 0.002, decay: 0.16, level: 0.75 });
    Sound.noise(c, out, t, { filter: 'bandpass', freq: 900 * p, q: 0.8, attack: 0.001, decay: 0.06, level: 0.6 });
    return Sound.bell(c, out, t, { freq: Sound.note(69) * p, weight: 0.15, cracked: 1, level: 0.45, partials: 8, length: 0.9 });
  }, { gap: 0.05, cap: 3, wet: 0.18, level: 0.65, length: 0.4 });

  Sound.define('kill', function (c, out, t, o) {
    const p = pitch(o) * Sound.vary(1, 0.1);
    Sound.noise(c, out, t, { color: 'brown', filter: 'bandpass', freq: 900 * p, to: 260 * p, q: 1.4, attack: 0.008, decay: 0.24, level: 0.9 });
    return Sound.tone(c, out, t + 0.05, { freq: 260 * p, to: 140 * p, glide: 0.06, attack: 0.002, decay: 0.08, level: 0.22 });
  }, { gap: 0.03, cap: 6, wet: 0.2, level: 0.7, length: 0.3, crowd: true });

  Sound.define('kill.great', function (c, out, t, o) {
    const p = pitch(o);
    Sound.noise(c, out, t, { filter: 'bandpass', freq: 2200 * p, to: 380 * p, q: 0.7, attack: 0.01, decay: 0.7, level: 0.55 });
    Sound.noise(c, out, t, { color: 'brown', filter: 'lowpass', freq: 300, attack: 0.02, decay: 1.6, level: 0.6 });
    return Sound.bell(c, out, t + 0.04, { freq: Sound.note(38) * p, weight: 0.7, muffled: 0.8, level: 0.6, partials: 9, length: 3.5 });
  }, { gap: 0.3, cap: 2, priority: 2, wet: 0.45, level: 0.8, length: 3.6 });

  Sound.define('hurt', function (c, out, t, o) {
    const p = pitch(o);
    Sound.tone(c, out, t, { freq: 95 * p, to: 50 * p, glide: 0.1, attack: 0.002, decay: 0.15, level: 0.7 });
    Sound.noise(c, out, t, { filter: 'highpass', freq: 2600, q: 0.7, attack: 0.001, decay: 0.05, level: 0.35 });
    return Sound.bell(c, out, t, { freq: Sound.note(62) * p, weight: 0.25, cracked: 1, level: 0.55, partials: 8, length: 1.2 });
  }, { gap: 0.15, cap: 2, priority: 2, wet: 0.1, level: 0.75, length: 0.5 });

  Sound.define('level', function (c, out, t, o) {
    const p = pitch(o);
    let end = t;
    for (let i = 0; i < RISE.length; i++) {
      end = max(end, Sound.bell(c, out, t + i * 0.1, { freq: Sound.note(RISE[i]) * p, weight: 0.3, level: 0.42, partials: 7, length: 1.8 }));
    }
    Sound.crackle(c, out, t, { attack: 0.05, decay: 1.1, level: 0.35 });
    return end;
  }, { gap: 0.6, cap: 1, priority: 2, wet: 0.35, level: 0.8, length: 2.2 });

  Sound.define('offer', function (c, out, t, o) {
    const p = pitch(o);
    let end = t;
    for (let i = 0; i < SHIMMER.length; i++) {
      end = max(end, Sound.bell(c, out, t + i * 0.055, { freq: Sound.note(SHIMMER[i]) * p, weight: 0.05, muffled: 0.25, level: 0.3, partials: 5, beat: 0, length: 1.1 }));
    }
    Sound.noise(c, out, t, { filter: 'highpass', freq: 3500, attack: 0.25, decay: 0.6, level: 0.12 });
    Sound.crackle(c, out, t, { attack: 0.1, hold: 0.4, decay: 0.6, level: 0.3 });
    return end;
  }, { gap: 0.5, cap: 1, wet: 0.4, level: 0.7, length: 1.6 });

  Sound.define('gate.open', function (c, out, t, o) {
    const p = pitch(o);
    Sound.creak(c, out, t, { rate: 48, to: 30, body: 640 * p, q: 7, attack: 0.15, hold: 0.5, decay: 0.6, level: 0.5 });
    Sound.click(c, out, t + 0.05, { freq: 1300, level: 0.7 });
    Sound.click(c, out, t + 1.1, { freq: 1100, level: 0.6 });
    Sound.noise(c, out, t + 0.3, { color: 'pink', filter: 'bandpass', freq: 700, to: 1600, q: 0.6, attack: 0.6, decay: 1.2, level: 0.25 });
    return Sound.bell(c, out, t + 0.2, { freq: Sound.note(45) * p, weight: 0.8, muffled: 1, level: 0.7, partials: 9, length: 4 });
  }, { gap: 1, cap: 1, priority: 2, wet: 0.5, level: 1, length: 4.2 });

  Sound.define('gate.hold', function (c, out, t, o) {
    const f = Sound.note(57) * pitch(o), s = typeof o.seconds === 'number' && o.seconds > 0.5 ? o.seconds : 3;
    Sound.tone(c, out, t, { freq: f, attack: s * 0.87, hold: 0.2, decay: 0.8, level: 0.16 });
    Sound.tone(c, out, t, { freq: f * 2, attack: s * 0.93, decay: 0.8, level: 0.1 });
    Sound.creak(c, out, t + s * 0.73, { rate: 70, to: 40, body: 900, attack: 0.1, hold: 0.4, decay: 0.3, level: 0.3 });
    return Sound.bell(c, out, t + s, { freq: f, weight: 0.5, level: 0.6, partials: 10, length: 4 });
  }, { gap: 0.5, cap: 1, priority: 2, wet: 0.5, level: 0.7, length: 7 });

  Sound.define('toll', function (c, out, t, o) {
    const f = Sound.note(o.note !== undefined ? o.note : 'D2') * pitch(o);
    Sound.tone(c, out, t, { freq: 42, attack: 0.02, decay: 1.4, level: 0.4 });
    return Sound.bell(c, out, t, { freq: f > 0 ? f : 73.4, weight: 1, level: 0.85 });
  }, { gap: 2, cap: 2, priority: 3, wet: 0.6, level: 0.9, length: 14 });

  Sound.define('warning', function (c, out, t, o) {
    const f = Sound.note(81) * pitch(o);
    Sound.noise(c, out, t, { filter: 'highpass', freq: 1800, to: 5000, q: 0.7, attack: 0.12, decay: 0.08, level: 0.25 });
    Sound.bell(c, out, t + 0.1, { freq: f, weight: 0.1, cracked: 0.6, level: 0.4, partials: 6, length: 0.6 });
    return Sound.bell(c, out, t + 0.24, { freq: f, weight: 0.1, cracked: 0.6, level: 0.45, partials: 6, length: 0.6 });
  }, { gap: 0.25, cap: 2, priority: 2, wet: 0.2, level: 0.7, length: 0.6 });

  // ---- the events of the run ----

  const at = { x: 0, y: 0, level: 1, seconds: 0 };   // one object for every call: nothing is made per event
  const centre = {};

  function placed(id, e) {
    at.x = e.x;
    at.y = e.y;
    at.seconds = 0;
    Sound.sfx(id, at);
  }

  // Provisional: until the pickups are written, any kind but the first, or a large value, is a big one.
  function big(e) { return e.a !== 0 || e.b >= 10; }

  function toll() {
    if (typeof Music.toll === 'function') Music.toll();
    else Sound.sfx('toll', centre);
  }

  function heard(S, live) {
    if (!live || S.eventCount === 0 || !Sound.live()) return;
    const ring = S.events, n = S.eventCount, len = ring.length;
    for (let i = 0; i < n; i++) {
      const e = ring[(S.eventStart + i) % len], k = e.k;
      if (k === 'hit') placed('hit', e);
      else if (k === 'kill') placed(e.a >= Sim.ELITE ? 'kill.great' : 'kill', e);
      else if (k === 'pickup') placed(big(e) ? 'pickup.big' : 'pickup', e);
      else if (k === 'crit') placed('hit.heavy', e);
      else if (k === 'hurt') Sound.sfx('hurt', centre);
      else if (k === 'telegraph') placed('warning', e);
      else if (k === 'level') Sound.sfx('level', centre);
      else if (k === 'offer') Sound.sfx('offer', centre);
      else if (k === 'toll') toll();
      else if (k === 'gate') placed('gate.open', e);
    }
  }

  // The gate's hold, read from the run: it sounds while S.gate.hold grows.
  let holding = 0, holdWas = 0, still = 0, holdRun = null;
  function gateHold(S) {
    if (S !== holdRun) {
      holdRun = S;
      holdWas = 0;
      still = 0;
      holding = 0;
    }
    const g = S.gate, hold = g !== null && typeof g.hold === 'number' ? g.hold : 0;
    if (hold > holdWas) {
      still = 0;
      if (holding === 0 && Sound.live()) {
        at.x = g.x;
        at.y = g.y;
        at.seconds = max(0.5, (S.rules.gateHoldSeconds || 3) - hold);
        holding = Sound.sfx('gate.hold', at);
        at.seconds = 0;
      }
    } else if (holding !== 0 && ++still > 6) {
      Sound.stop(holding, 0.3);
      holding = 0;
    }
    holdWas = hold;
  }

  Plat.on('step', function (S, live) {
    heard(S, live);
    if (live) gateHold(S);
  });
  Plat.on('command', heard);

  // ---- the menus ----

  const softly = { key: 1, level: 0.6 };
  let navAt = -1e9;

  function control(el) {
    const c = el && typeof el.closest === 'function' ? el.closest('button, input, select, textarea, a[href], [role="button"], [role="switch"], [role="radio"], [role="option"]') : null;
    return c !== null && !c.disabled && c.getAttribute('aria-disabled') !== 'true';
  }

  Plat.on('boot', function () {
    const ui = document.getElementById('ui');
    if (!ui) return;
    ui.addEventListener('ui-nav', function () { navAt = Plat.now(); });
    window.addEventListener('keydown', function (e) { if (e.key === 'Tab') navAt = Plat.now(); }, true);
    ui.addEventListener('focusin', function (e) {
      if (Plat.now() - navAt < 300 && control(e.target)) Sound.sfx('menu.move', null);
    });
    ui.addEventListener('click', function (e) { if (control(e.target)) Sound.sfx('menu.choose', null); });
    ui.addEventListener('input', function (e) {
      if (e.target && e.target.type === 'range') Sound.sfx('menu.move', softly);
    });
  });
})();
