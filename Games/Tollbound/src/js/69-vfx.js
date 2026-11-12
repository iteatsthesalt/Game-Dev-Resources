// 69-vfx.js: what the simulation's events look like. Sparks and puffs as pooled particles, warnings and marks on
// the ground, numbers for harm done and small life bars on the #overlay canvas, a camera shake and a screen flash.
// Owns: Vfx
// Public:
//   Vfx.consume(S)             reads what the last step or command emitted (S.events). It listens itself to the
//                              notices 'step' and 'command' (live ones only: what Game.sim runs unseen is not
//                              shown), so nobody else needs to call it.
//   Vfx.update(dt, S)          moves everything on by dt seconds of the run; Scene.draw calls it once a frame
//   Vfx.harm(uid, x, y, z, amount, kind)   shows harm as a number over the thing uid at (x, y), z metres up. kind:
//                              0 harm to one of the dead, 1 harm to the player's life. Harm to one thing within a
//                              quarter of a second adds up into one number.
//   Vfx.burst(kind, x, y, z, count, r, g, b)   particles: kind 'spark' (fast, glowing, falls), 'puff' (slow dust
//                              that covers), 'mote' (rises and glows), 'ring' (a ring of motes spreading out)
//   Vfx.billboards(buffer, n, max) -> n    writes the particles as Gfx.BILLBOARD_STRIDE records from record n on
//   Vfx.decals(buffer, n, max) -> n        writes the marks kills leave, and where a Swell broke: a 'telegraph'
//                              event (x, y, a = radius, b = seconds until it lands) is timed, and when it lands a
//                              pale ring spreads there for a moment, with dust. The filling shape itself is the
//                              scene's, drawn from the area (68-scene.js).
//   Vfx.offset(out) -> out     {x, y}: where the shake moves the camera now, in metres
//   Vfx.post(post)             raises post.flash to the screen flash now
//   Vfx.overlay(bars, count)   draws the numbers, and the life bars Scene.draw collected (Scene.BAR_STRIDE floats
//                              each: x, y, z, life 0..1, rank, alpha), on #overlay with Gfx.worldToScreen
//   Vfx.clear()                drops every particle, number, mark, warning, shake and flash, and clears #overlay
//   Vfx.quality(level)         'low' keeps at most 400 particles, the others 1500
//   Vfx.shake, Vfx.flash, Vfx.numbers   settings, 0 to 1: Settings.get('fx.shake'), Settings.get('fx.flash') and
//                              Settings.get('fx.numbers') when there is a Settings.get, otherwise 1. Values.
//   Vfx.stats                  {particles, numbers, marks, warnings}, as they stand
// The events it reads (the field each uses, beyond x and y): hit (sparks), kill (a: rank; id: the enemy def, whose
// figure colours the dust), cast, hurt, wound, mend, scar, pull, trade, heave, pickup (a: its kind), favour, level,
// toll, telegraph (a: radius, b: seconds), drop, phase, gate, stroke. A number never comes from an event:
// Scene.draw sees life fall and calls Vfx.harm, so the numbers are right whatever the events carry. The wounds
// themselves, postures, the wake and the dead's Swells are the scene's to draw from the run's state.
// Only flames and hot metal glow (docs/design/01-world.md): sparks, embers, coin's glint and the lychgate's lamp
// light; the air a voice, a pull or a toll moves is pale dust that covers.
(function () {
  'use strict';

  const TAU = Core.TAU, sin = Math.sin, cos = Math.cos, sqrt = Math.sqrt, floor = Math.floor;
  const MOST = 1500, FEW = 400, NUMBERS = 96, WARNINGS = 64, MARKS = 64, LANDINGS = 32;
  const ADD_FOR = 0.25, NUMBER_LIFE = 0.9, RISE = 46;     // seconds, seconds, CSS px a second
  const SHAKE_MAX = 0.38, SHAKE_FALL = 1.6, FLASH_FALL = 4;               // metres; trauma lost a second; flash lost a second
  const MARK_LIFE = 3.2, LAND_LIFE = 0.35;
  // pickups by kind: an ember (warm, it glows), coin (a gold glint), a find, a favour's shape
  const PICKUP = [[1, 0.55, 0.2], [1, 0.8, 0.36], [0.95, 0.93, 0.86], [0.92, 0.88, 0.78]];
  const DUST = [0.9, 0.88, 0.82];                          // pale air: what a voice, a pull or a toll moves

  // ---- settings ----
  function setting(name) {
    if (typeof Settings.get !== 'function') return 1;
    let v;
    try { v = Settings.get(name); } catch (e) { return 1; }
    if (typeof v === 'boolean') return v ? 1 : 0;
    v = +v;
    return v >= 0 ? (v > 1 ? 1 : v) : v < 0 ? 0 : 1;
  }
  Object.defineProperty(Vfx, 'shake', { enumerable: true, get: function () { return setting('fx.shake'); } });
  Object.defineProperty(Vfx, 'flash', { enumerable: true, get: function () { return setting('fx.flash'); } });
  Object.defineProperty(Vfx, 'numbers', { enumerable: true, get: function () { return setting('fx.numbers'); } });

  // ---- presentation's own random stream (unseeded by the run: it never feeds back) ----
  let seed = 0x9e3779b9;
  function rand() {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  }

  // ---- particles ----
  let cap = MOST, pN = 0, over = 0;
  const pX = new Float32Array(MOST), pY = new Float32Array(MOST), pZ = new Float32Array(MOST);
  const pVX = new Float32Array(MOST), pVY = new Float32Array(MOST), pVZ = new Float32Array(MOST);
  const pSize = new Float32Array(MOST), pSize1 = new Float32Array(MOST), pLife = new Float32Array(MOST), pAge = new Float32Array(MOST);
  const pR = new Float32Array(MOST), pG = new Float32Array(MOST), pB = new Float32Array(MOST), pA = new Float32Array(MOST);
  const pGlow = new Float32Array(MOST), pGrav = new Float32Array(MOST), pDrag = new Float32Array(MOST);

  function spawn(x, y, z, vx, vy, vz, size, size1, life, r, g, b, a, glow, grav, drag) {
    let i;
    if (pN < cap) i = pN++;
    else { i = over; over = (over + 1) % cap; }
    pX[i] = x; pY[i] = y; pZ[i] = z; pVX[i] = vx; pVY[i] = vy; pVZ[i] = vz;
    pSize[i] = size; pSize1[i] = size1; pLife[i] = life; pAge[i] = 0;
    pR[i] = r; pG[i] = g; pB[i] = b; pA[i] = a; pGlow[i] = glow; pGrav[i] = grav; pDrag[i] = drag;
  }

  function remove(i) {
    const j = --pN;
    pX[i] = pX[j]; pY[i] = pY[j]; pZ[i] = pZ[j]; pVX[i] = pVX[j]; pVY[i] = pVY[j]; pVZ[i] = pVZ[j];
    pSize[i] = pSize[j]; pSize1[i] = pSize1[j]; pLife[i] = pLife[j]; pAge[i] = pAge[j];
    pR[i] = pR[j]; pG[i] = pG[j]; pB[i] = pB[j]; pA[i] = pA[j]; pGlow[i] = pGlow[j]; pGrav[i] = pGrav[j]; pDrag[i] = pDrag[j];
  }

  function sparks(x, y, z, n, r, g, b, speed) {
    for (let k = 0; k < n; k++) {
      const a = rand() * TAU, v = speed * (0.4 + 0.8 * rand()), up = speed * (0.4 + 0.9 * rand());
      spawn(x, y, z, cos(a) * v, sin(a) * v, up, 0.11 + 0.06 * rand(), 0.03, 0.22 + 0.2 * rand(), r, g, b, 1, 1, 9, 1.5);
    }
  }
  function puffs(x, y, z, n, r, g, b) {
    for (let k = 0; k < n; k++) {
      const a = rand() * TAU, v = 0.5 + 0.9 * rand();
      spawn(x + cos(a) * 0.2, y + sin(a) * 0.2, z * rand(), cos(a) * v, sin(a) * v, 0.35 + 0.5 * rand(), 0.3 + 0.2 * rand(), 0.75 + 0.35 * rand(),
        0.55 + 0.4 * rand(), r, g, b, 0.7, 0, -0.2, 2.2);
    }
  }
  function motes(x, y, z, n, r, g, b, spread, rise) {
    for (let k = 0; k < n; k++) {
      const a = rand() * TAU, d = spread * sqrt(rand());
      spawn(x + cos(a) * d, y + sin(a) * d, z + 0.4 * rand(), cos(a) * 0.15, sin(a) * 0.15, rise * (0.6 + 0.8 * rand()), 0.12 + 0.06 * rand(), 0.04,
        0.7 + 0.6 * rand(), r, g, b, 1, 1, 0, 0.6);
    }
  }
  // A ring of motes spreading out; glow 1 adds light (a flame's), 0 covers (dust).
  function ring(x, y, z, n, r, g, b, speed, glow) {
    const lit = glow === undefined ? 1 : glow;
    for (let k = 0; k < n; k++) {
      const a = (k + rand() * 0.5) / n * TAU;
      spawn(x + cos(a) * 0.3, y + sin(a) * 0.3, z, cos(a) * speed, sin(a) * speed, 0.6 + 0.4 * rand(), lit ? 0.14 : 0.2, lit ? 0.05 : 0.1,
        0.8 + 0.3 * rand(), r, g, b, lit ? 1 : 0.55, lit, 0, 1.2);
    }
  }

  Vfx.burst = function (kind, x, y, z, count, r, g, b) {
    const n = count > 0 ? count | 0 : 8, cr = r === undefined ? 1 : r, cg = g === undefined ? 0.85 : g, cb = b === undefined ? 0.55 : b, h = z || 0;
    if (kind === 'puff') puffs(x, y, h, n, cr, cg, cb);
    else if (kind === 'mote') motes(x, y, h, n, cr, cg, cb, 0.6, 1.2);
    else if (kind === 'ring') ring(x, y, h, n, cr, cg, cb, 3, 1);
    else sparks(x, y, h, n, cr, cg, cb, 4);
  };

  Vfx.quality = function (level) {
    cap = level === 'low' ? FEW : MOST;
    if (pN > cap) pN = cap;
    over = 0;
  };

  // ---- warnings of attacks, and marks kills leave ----
  const wX = new Float32Array(WARNINGS), wY = new Float32Array(WARNINGS), wR = new Float32Array(WARNINGS), wLen = new Float32Array(WARNINGS), wAge = new Float32Array(WARNINGS);
  let wN = 0;
  const mX = new Float32Array(MARKS), mY = new Float32Array(MARKS), mR = new Float32Array(MARKS), mAge = new Float32Array(MARKS);
  let mN = 0, mOver = 0;
  const lX = new Float32Array(LANDINGS), lY = new Float32Array(LANDINGS), lR = new Float32Array(LANDINGS), lAge = new Float32Array(LANDINGS);
  let lN = 0;

  // where a Swell broke: a pale ring that spreads for a moment
  function landed(x, y, radius) {
    if (lN >= LANDINGS) return;
    const i = lN++;
    lX[i] = x; lY[i] = y; lR[i] = radius; lAge[i] = 0;
  }

  function warn(x, y, radius, seconds) {
    if (wN >= WARNINGS) return;
    const i = wN++;
    wX[i] = x; wY[i] = y; wR[i] = radius > 0 ? radius : 1.5; wLen[i] = seconds > 0.05 ? seconds : 0.8; wAge[i] = 0;
  }
  function mark(x, y, radius) {
    let i;
    if (mN < MARKS) i = mN++;
    else { i = mOver; mOver = (mOver + 1) % MARKS; }
    mX[i] = x; mY[i] = y; mR[i] = radius; mAge[i] = 0;
  }

  // ---- numbers ----
  const nUid = new Int32Array(NUMBERS), nKind = new Uint8Array(NUMBERS);
  const nX = new Float32Array(NUMBERS), nY = new Float32Array(NUMBERS), nZ = new Float32Array(NUMBERS), nValue = new Float64Array(NUMBERS), nAge = new Float32Array(NUMBERS);
  let nN = 0;

  Vfx.harm = function (uid, x, y, z, amount, kind) {
    if (!(amount > 0) || setting('fx.numbers') <= 0) return;
    const k = kind === 1 ? 1 : 0;
    for (let i = 0; i < nN; i++) {
      if (nUid[i] === uid && nAge[i] < ADD_FOR && nKind[i] === k) {
        nValue[i] += amount;
        nX[i] = x; nY[i] = y;
        return;
      }
    }
    let i = nN;
    if (nN < NUMBERS) nN++;
    else {
      i = 0;
      for (let j = 1; j < NUMBERS; j++) if (nAge[j] > nAge[i]) i = j;
    }
    nUid[i] = uid; nKind[i] = k; nX[i] = x; nY[i] = y; nZ[i] = (z > 0 ? z : 1.6) + 0.15; nValue[i] = amount; nAge[i] = 0;
  };

  // ---- shake and flash ----
  let trauma = 0, flashNow = 0, clock = 0;
  function jolt(amount) { trauma = Math.min(1, trauma + amount); }
  function blink(amount) { flashNow = Math.min(1, flashNow + amount); }

  Vfx.offset = function (out) {
    const amp = trauma * trauma * SHAKE_MAX * setting('fx.shake');
    out.x = amp * (0.6 * sin(clock * 37) + 0.4 * sin(clock * 61 + 1.3));
    out.y = amp * (0.6 * sin(clock * 43 + 2.1) + 0.4 * sin(clock * 53 + 0.4));
    return out;
  };

  Vfx.post = function (post) {
    const f = flashNow * 0.55 * setting('fx.flash');
    if (!(post.flash >= f)) post.flash = f;
  };

  // ---- events ----
  const tints = new Map();   // enemy def id -> the colour of its figure, for its dust
  function tintOf(id) {
    let c = tints.get(id);
    if (c !== undefined) return c;
    c = null;
    const kind = typeof id === 'string' ? (Defs.has('enemy', id) ? 'enemy' : Defs.has('boss', id) ? 'boss' : null) : null;
    if (kind) {
      const fig = Rigs.figure(Defs.get(kind, id).puppet);
      if (fig) c = fig.color3;
    }
    tints.set(id, c);
    return c;
  }

  Vfx.consume = function (S) {
    if (!S || !S.events) return;
    const ring2 = S.events;
    for (let i = 0; i < S.eventCount; i++) {
      const e = ring2[(S.eventStart + i) % ring2.length], k = e.k, x = e.x, y = e.y;
      if (k === 'hit') sparks(x, y, 1, 4, 1, 0.88, 0.6, 3.5);
      else if (k === 'kill') {
        const c = tintOf(e.id), rank = e.a | 0;
        puffs(x, y, 1, 5 + rank * 4, c ? c[0] * 0.8 : 0.45, c ? c[1] * 0.8 : 0.42, c ? c[2] * 0.8 : 0.38);
        sparks(x, y, 0.9, 5 + rank * 6, 1, 0.8, 0.45, 3.5);
        motes(x, y, 0.5, 2 + rank * 3, 1, 0.7, 0.35, 0.3, 1.3);
        mark(x, y, 0.45 + 0.25 * rank);
        if (rank >= 1) jolt(0.12 + 0.15 * rank);
      } else if (k === 'cast') ring(x, y, 1, 8, DUST[0], DUST[1], DUST[2], 1.6, 0);
      else if (k === 'hurt') {
        sparks(x, y, 1.1, 6, 1, 0.3, 0.25, 3);
        jolt(0.32);
        blink(0.28);
      } else if (k === 'wound') puffs(x, y, 0.4, 3, 0.42, 0.06, 0.07);
      else if (k === 'mend') motes(x, y, 0.2, 2, 1, 0.55, 0.5, 0.5, 1.1);
      else if (k === 'scar') { puffs(x, y, 0.3, 5, 0.42, 0.4, 0.38); blink(0.1); }
      else if (k === 'pull') ring(x, y, 0.6, 12, DUST[0], DUST[1], DUST[2], 2.2, 0);
      else if (k === 'trade') ring(x, y, 1.8, 16, 0.98, 0.82, 0.5, 1.4, 0);
      else if (k === 'heave') puffs(x, y, 0.3, 6, 0.55, 0.5, 0.45);
      else if (k === 'pickup') {
        const kind = e.a | 0, c = PICKUP[kind < PICKUP.length ? kind : 0];
        if (kind <= 1) motes(x, y, 0.3, 6, c[0], c[1], c[2], 0.25, 1.8);
        else puffs(x, y, 0.4, 6, c[0], c[1], c[2]);
      } else if (k === 'favour') {
        puffs(x, y, 0.5, 10, PICKUP[3][0], PICKUP[3][1], PICKUP[3][2]);
        ring(x, y, 0.3, 14, PICKUP[3][0], PICKUP[3][1], PICKUP[3][2], 2.4, 0);
      } else if (k === 'level') {
        ring(x, y, 0.2, 24, 1, 0.85, 0.4, 2.5, 1);
        motes(x, y, 0.2, 12, 1, 0.9, 0.5, 0.8, 1.6);
        blink(0.2);
      } else if (k === 'toll') {
        ring(x, y, 0.3, 40, DUST[0], DUST[1], DUST[2], 6, 0);
        jolt(0.22);
        blink(0.14);
      } else if (k === 'telegraph') warn(x, y, e.a, e.b);
      else if (k === 'drop') motes(x, y, 0.1, 6, 1, 0.95, 0.75, 0.15, 0.9);
      else if (k === 'phase') { jolt(0.5); blink(0.25); }
      else if (k === 'gate') ring(x, y, 0.2, 20, 1, 0.76, 0.4, 2, 1);
      else if (k === 'stroke') ring(x, y, 1.2, 10 + 2 * (e.a | 0), 1, 0.8, 0.46, 1.6, 1);
    }
  };

  Plat.on('step', function (S, live) { if (live) Vfx.consume(S); });
  Plat.on('command', function (S, live) { if (live) Vfx.consume(S); });

  // ---- time ----
  Vfx.update = function (dt) {
    if (!(dt > 0)) return;
    clock += dt;
    trauma = Math.max(0, trauma - SHAKE_FALL * dt);
    flashNow = Math.max(0, flashNow - FLASH_FALL * dt * Math.max(0.35, flashNow));
    for (let i = 0; i < pN; i++) {
      const age = pAge[i] + dt;
      if (age >= pLife[i]) { remove(i); i--; continue; }
      pAge[i] = age;
      const drag = 1 - Math.min(1, pDrag[i] * dt);
      pVX[i] *= drag; pVY[i] *= drag;
      pVZ[i] = pVZ[i] * drag - pGrav[i] * dt;
      pX[i] += pVX[i] * dt; pY[i] += pVY[i] * dt; pZ[i] += pVZ[i] * dt;
      if (pZ[i] < 0.02) {               // a spark that falls to the ground skips and slows
        pZ[i] = 0.02;
        pVZ[i] = -pVZ[i] * 0.35;
        pVX[i] *= 0.5; pVY[i] *= 0.5;
      }
    }
    for (let i = 0; i < nN; i++) {
      nAge[i] += dt;
      if (nAge[i] >= NUMBER_LIFE) {
        nN--;
        nUid[i] = nUid[nN]; nKind[i] = nKind[nN]; nX[i] = nX[nN]; nY[i] = nY[nN]; nZ[i] = nZ[nN]; nValue[i] = nValue[nN]; nAge[i] = nAge[nN];
        i--;
      }
    }
    for (let i = 0; i < wN; i++) {
      wAge[i] += dt;
      if (wAge[i] >= wLen[i]) {
        puffs(wX[i], wY[i], 0.2, 3 + Math.min(9, floor(wR[i] * 2)), 0.62, 0.58, 0.52);
        landed(wX[i], wY[i], wR[i]);
        wN--;
        wX[i] = wX[wN]; wY[i] = wY[wN]; wR[i] = wR[wN]; wLen[i] = wLen[wN]; wAge[i] = wAge[wN];
        i--;
      }
    }
    for (let i = 0; i < mN; i++) mAge[i] += dt;
    for (let i = 0; i < mN; i++) {
      if (mAge[i] >= MARK_LIFE) {
        mN--;
        mX[i] = mX[mN]; mY[i] = mY[mN]; mR[i] = mR[mN]; mAge[i] = mAge[mN];
        i--;
      }
    }
    if (mOver >= mN) mOver = 0;
    for (let i = 0; i < lN; i++) {
      lAge[i] += dt;
      if (lAge[i] >= LAND_LIFE) {
        lN--;
        lX[i] = lX[lN]; lY[i] = lY[lN]; lR[i] = lR[lN]; lAge[i] = lAge[lN];
        i--;
      }
    }
  };

  // ---- into the scene's buffers ----
  Vfx.billboards = function (buf, n, max) {
    const stride = Gfx.BILLBOARD_STRIDE || 9;
    for (let i = 0; i < pN && n < max; i++) {
      const k = pAge[i] / pLife[i], o = n++ * stride;
      buf[o] = pX[i]; buf[o + 1] = pY[i]; buf[o + 2] = pZ[i];
      buf[o + 3] = pSize[i] + (pSize1[i] - pSize[i]) * k;
      buf[o + 4] = pR[i]; buf[o + 5] = pG[i]; buf[o + 6] = pB[i];
      buf[o + 7] = pA[i] * (1 - k * k);
      buf[o + 8] = pGlow[i];
    }
    return n;
  };

  Vfx.decals = function (buf, n, max) {
    for (let i = 0; i < mN && n < max; i++) {
      const k = mAge[i] / MARK_LIFE;
      n = Scene.decal(buf, n, mX[i], mY[i], mR[i] * (1 + 0.25 * Math.min(1, mAge[i] * 6)), 0.14, 0.12, 0.12, 0.4 * (1 - k * k), 1, Scene.DISC, 0, 0);
    }
    for (let i = 0; i < lN && n < max; i++) {
      const k = lAge[i] / LAND_LIFE;
      n = Scene.decal(buf, n, lX[i], lY[i], lR[i] * (0.85 + 0.3 * k), 0.95, 0.92, 0.84, 0.85 * (1 - k), -0.12, Scene.RING, 0, 0);
    }
    return n;
  };

  // ---- the overlay: numbers and bars ----
  // Digits are painted once into an atlas, in two looks, and copied from it: drawing a number builds no text.
  let overlay = null, ctx = null, cssW = 0, cssH = 0, ratio = 1, atlas = null, dirty = false;
  const STYLES = [
    { size: 15, fill: '#f2e6c8' },      // harm to one of the dead
    { size: 16, fill: '#ff6b5b' },      // harm to the player
  ];
  const cellW = new Float32Array(STYLES.length), cellH = new Float32Array(STYLES.length), cellY = new Float32Array(STYLES.length);
  const advance = new Float32Array(STYLES.length);
  const at = { x: 0, y: 0 };

  function paintAtlas() {
    atlas = document.createElement('canvas');
    let y = 0, widest = 0;
    const probe = atlas.getContext('2d');
    for (let s = 0; s < STYLES.length; s++) {
      const px = STYLES[s].size * ratio;
      probe.font = 'bold ' + px + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      let w = 0;
      for (let d = 0; d < 10; d++) w = Math.max(w, probe.measureText(String(d)).width);
      advance[s] = Math.ceil(w);
      cellW[s] = Math.ceil(w + 4 * ratio);
      cellH[s] = Math.ceil(px * 1.3 + 4 * ratio);
      cellY[s] = y;
      y += cellH[s];
      widest = Math.max(widest, cellW[s] * 10);
    }
    atlas.width = Math.max(1, widest);
    atlas.height = Math.max(1, y);
    const a = atlas.getContext('2d');
    a.textAlign = 'center';
    a.textBaseline = 'middle';
    a.lineJoin = 'round';
    for (let s = 0; s < STYLES.length; s++) {
      const px = STYLES[s].size * ratio;
      a.font = 'bold ' + px + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      a.lineWidth = Math.max(2, 3 * ratio);
      a.strokeStyle = 'rgba(8, 6, 4, 0.9)';
      a.fillStyle = STYLES[s].fill;
      for (let d = 0; d < 10; d++) {
        const cx = d * cellW[s] + cellW[s] / 2, cy = cellY[s] + cellH[s] / 2;
        a.strokeText(String(d), cx, cy);
        a.fillText(String(d), cx, cy);
      }
    }
  }

  function fitOverlay(w, h, dpr) {
    if (!overlay) {
      overlay = document.getElementById('overlay');
      if (!overlay) return;
      ctx = overlay.getContext('2d');
    }
    cssW = w > 0 ? w : overlay.clientWidth || 1;
    cssH = h > 0 ? h : overlay.clientHeight || 1;
    const r = dpr > 0 ? dpr : 1;
    overlay.width = Math.max(1, Math.round(cssW * r));
    overlay.height = Math.max(1, Math.round(cssH * r));
    if (r !== ratio || atlas === null) {
      ratio = r;
      paintAtlas();
    }
    dirty = true;
  }

  Plat.on('resize', function (w, h, dpr) { fitOverlay(w, h, dpr); });
  Plat.on('boot', function () { if (!overlay) fitOverlay(0, 0, Plat.dpr()); });

  function wipe() {
    if (!ctx || !dirty) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    dirty = false;
  }

  function drawNumber(value, style, x, y, scale, alpha) {
    let v = Math.round(value);
    if (v < 1) v = 1;
    let digits = 0;
    for (let t = v; t > 0; t = floor(t / 10)) digits++;
    const adv = advance[style] / ratio * scale, w = cellW[style] / ratio * scale, h = cellH[style] / ratio * scale;
    let cx = x + (digits - 1) * adv / 2;
    ctx.globalAlpha = alpha;
    for (let k = 0; k < digits; k++) {
      const d = v % 10;
      v = floor(v / 10);
      ctx.drawImage(atlas, d * cellW[style], cellY[style], cellW[style], cellH[style], cx - w / 2, y - h / 2, w, h);
      cx -= adv;
    }
  }

  const BAR_BACK = 'rgba(6, 5, 4, 0.72)', BAR_FILL = ['#d9573f', '#e8b04a', '#d8434f', '#c93a8a'];

  Vfx.overlay = function (bars, count) {
    if (!ctx) fitOverlay(0, 0, Plat.dpr());
    if (!ctx) return;
    wipe();
    if (!Gfx.active || typeof Gfx.active.worldToScreen !== 'function') return;
    const showNumbers = setting('fx.numbers'), stride = Scene.BAR_STRIDE || 6;
    if (count <= 0 && (nN === 0 || showNumbers <= 0)) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    dirty = true;
    for (let i = 0; i < count; i++) {
      const o = i * stride, rank = bars[o + 4] | 0, life = bars[o + 3], a = bars[o + 5];
      if (!(a > 0) || !Gfx.worldToScreen(bars[o], bars[o + 1], bars[o + 2], at)) continue;
      if (at.x < -60 || at.y < -20 || at.x > cssW + 60 || at.y > cssH + 20) continue;
      const w = rank >= 3 ? 84 : rank === 2 ? 58 : rank === 1 ? 40 : 28, h = rank >= 2 ? 5 : 4;
      const x = Math.round(at.x - w / 2), y = Math.round(at.y - h / 2);
      ctx.globalAlpha = a;
      ctx.fillStyle = BAR_BACK;
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = BAR_FILL[rank > 3 ? 3 : rank];
      ctx.fillRect(x, y, Math.max(0, Math.round(w * life)), h);
    }
    if (showNumbers > 0 && atlas) {
      for (let i = 0; i < nN; i++) {
        if (!Gfx.worldToScreen(nX[i], nY[i], nZ[i], at)) continue;
        const age = nAge[i], life = NUMBER_LIFE, pop = 1 + 0.45 * Math.max(0, 1 - age / 0.12);
        const fade = age > life - 0.3 ? Math.max(0, (life - age) / 0.3) : 1;
        drawNumber(nValue[i], nKind[i], at.x, at.y - RISE * age, pop, fade * showNumbers);
      }
    }
    ctx.globalAlpha = 1;
  };

  Vfx.clear = function () {
    pN = 0; over = 0; nN = 0; wN = 0; mN = 0; mOver = 0; lN = 0;
    trauma = 0; flashNow = 0;
    dirty = true;
    wipe();
  };

  Plat.on('state', function (state) { if (state === 'title') Vfx.clear(); });

  const stats = { particles: 0, numbers: 0, marks: 0, warnings: 0 };
  Object.defineProperty(Vfx, 'stats', {
    enumerable: true,
    get: function () {
      stats.particles = pN; stats.numbers = nN; stats.marks = mN; stats.warnings = wN;
      return stats;
    },
  });
})();
