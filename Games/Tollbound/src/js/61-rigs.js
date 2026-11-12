// 61-rigs.js: the rigs that move a figure's joints, and the writer that turns a figure and the state of a moving
// thing into part records for the 3D view.
// Owns: Rigs
// Public:
//   Rigs.register(name, rig)       adds a rig (and allows its name for the field "rig" of a puppet, while files
//                                  load). rig = {joints, core, strike?, anim, prepare?, stride?, pose}:
//                                    joints   [{name, parent, at: [x, y, z], turn?: [rx, ry, rz]}], a parent before
//                                             its children; the first joint is the root and has parent null.
//                                             at is the joint's place in its parent (metres, for a figure of
//                                             scale 1); turn a rotation it has at rest (radians, see below)
//                                    core     the names of the joints whose largest part stays when a figure is
//                                             drawn at its least (a body and a head)
//                                    strike   the names of the joints whose parts strike a Blow: they turn white
//                                             over the last 40% of a wind-up, white at its top, and back in the
//                                             first 30% of the strike
//                                    anim     the defaults of the puppet's anim numbers this rig reads
//                                    prepare(fig)    optional: works out numbers of a compiled figure once
//                                    stride(fig, speed)   optional: metres of one walk cycle, at scale 1, for a
//                                             speed in the figure's own units a second (default anim.stride)
//                                    pose(fig, st, P)   writes the pose: for joint j, P[6j .. 6j+5] are its turn
//                                             about x, y and z (radians) and its move along x, y and z (metres,
//                                             in the figure's own units), added to its rest. P starts at 0.
//   Rigs.figure(puppetId) -> fig   the puppet compiled for drawing, made once and kept; null if there is none.
//                                  fig: {id, rigName, rig, scale, n, height, radius (metres, standing, with the
//                                  puppet's own scale and a state's scale of 1),
//                                  color3: [r, g, b] (of its largest part), counts: {all, plain, core}, anim} and
//                                  the typed arrays the writer reads
//   Rigs.state() -> st             a state record with every field at rest. Make one and fill it for each figure:
//                                    x, y, px, py, alpha   the place now and one step ago, and the frame's place
//                                                          between the two: the figure stands at px + (x - px) * alpha
//                                    face                  the direction it faces, radians (the simulation's own)
//                                    scale                 a factor on the puppet's scale (elites are larger)
//                                    speed                 metres a second over the ground
//                                    walk, cycle           metres walked along its facing, and walk cycles done:
//                                                          both are moved on by Rigs.advance, and the distance
//                                                          drives the legs, so feet do not slide
//                                    t                     seconds on any running clock, for breathing and idling
//                                    act, actT, actLen     what it is doing (Rigs.NONE, Rigs.WINDUP, Rigs.STRIKE,
//                                                          Rigs.CAST), seconds into it, and its whole length
//                                    hurt                  seconds since it was last hurt (large: not lately)
//                                    dying, die            whether it is dying, and how far along, 0 to 1: a fall,
//                                                          then a sinking into the ground with alpha going to 0
//                                    flash, opacity, glow  0..1 toward white; 0..1 screen-door alpha; a factor on
//                                                          the glow of its parts
//                                    tintR, tintG, tintB   factors on its palette colours
//                                    grey                  0..1: how much of their colour its parts lose (to their
//                                                          own lightness), before the tint
//                                    seed                  0..1, for small differences between figures
//                                    detail, lod           false leaves out the parts marked detail; lod 1 draws
//                                                          only the core parts (a body and a head)
//                                    shell                 metres: above 0, each part also gets a white shell that
//                                                          much bigger on every side, turned inside out, so only
//                                                          its far side is drawn: a white outline round the figure
//                                                          (the Wrong-footed). It doubles the parts written.
//                                    strike                the joints that strike, as a mask (bit j for joint j of
//                                                          the rig, see Rigs.mask); 0 for the rig's own strike list
//                                    lift                  metres the whole figure is raised off the ground
//   Rigs.advance(fig, st, metres)  moves its walk on: st.walk by metres (negative when it goes backward) and
//                                  st.cycle by the cycles that is at its stride for st.speed. Call it once a frame
//                                  with what it moved since the last frame, after setting st.speed.
//   Rigs.sink(cap) -> out          buffers for part records: out.buf[shape] (a Float32Array of cap records each),
//                                  out.n[shape], out.total, out.dropped (records that found no room), out.stride
//   Rigs.clear(out)                empties a sink for the next frame
//   Rigs.draw(fig, st, out) -> n   writes one record for each part straight into the buffer of its shape and
//                                  returns how many it wrote. Allocates nothing.
//   Rigs.joints(name) -> [name]    the joints of a rig; [] if there is no such rig
//   Rigs.mask(fig, names) -> mask  the joints of a figure's rig among names, as a mask for st.strike (0 if none)
//   Rigs.names() -> [name]         the rigs registered
//   Rigs.NONE = 0, Rigs.WINDUP = 1, Rigs.STRIKE = 2, Rigs.CAST = 3
//   Rigs.SHAPES                    ['box', 'taper', 'cyl', 'sphere', 'cone']: a shape's id is its index, as in
//                                  Gfx.SHAPES of the 3D view
//   Rigs.STRIDE                    18, the floats of a part record when the view gives no Gfx.PART_STRIDE
//
// A part record (Gfx.PART_STRIDE floats): a 3 by 4 matrix in row order that takes a point of the unit shape to
// the 3D world, then red, green, blue, flash, glow and alpha. The world's 3D axes: the ground point (x, y) of
// the simulation is (x, 0, y); y is up. A figure is written facing +z with its left side at +x; facing f turns
// it to face (cos f, sin f) on the ground. Turns: about x a positive turn tips +y toward +z (a torso leans
// forward, a hanging limb swings back), about y it turns +z toward +x, about z it turns +x toward +y. A joint
// turns by yaw, then pitch, then roll (R = Ry Rx Rz), after its rest turn.
//
// The rigs and their joints (names of the field "joint" of a part), and the joints that strike:
//   biped       root, torso, head, armL, armR, legL, legR, handR (a thing held, written standing up from the grip)
//               anim: stride (m, a whole cycle), swing (arm swing, rad), bob (m), lean (rad), lift (foot lift, m),
//               reach (arms held forward, rad), droop (the head bowed further, rad), sway (the body rolled from
//               foot to foot, rad), hop (m: above 0 both feet move together and the body leaves the ground by
//               this much in each cycle), plumb (1: the thing held stands upright whatever the arm does),
//               clasp (rad: the left arm turned in toward the right hand, two hands on one rope), pull (1: an
//               act CAST is a pull on a rope, both hands up and hard down, in place of a raised left arm).
//               strike: armR, handR
//   quadruped   root, torso, head, legFL, legFR, legBL, legBR, tail          anim: stride, swing, bob, lift
//                                                                            strike: head, legFL, legFR
//   floater     root, torso, head, armL, armR, handR, tail (a hem or wisp)   anim: hover (m), bob, swing
//                                                                            strike: armL, armR, handR
//   crawler     root, torso, head, leg1L, leg1R, leg2L, leg2R, leg3L, leg3R, tail     anim: stride, lift, leg (m)
//                                                                            strike: head
//   winged      root, torso, head, wingL, wingR, legL, legR, tail            anim: hover, flap (beats a second), swing
//                                                                            strike: head, legL, legR
//   serpent     root, s0 (the head), s1 .. s7                                anim: stride (wave length), swing (m)
//                                                                            strike: s0
//   static      root
// A puppet may move a joint's rest place with anim.joints = {name: [x, y, z]}.
(function () {
  'use strict';

  const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos, sqrt = Math.sqrt, asin = Math.asin, atan = Math.atan;
  const floor = Math.floor, abs = Math.abs;
  const SHAPES = ['box', 'taper', 'cyl', 'sphere', 'cone'];
  const STRIDE = 18;
  const NONE = 0, WINDUP = 1, STRIKE = 2, CAST = 3;
  const MAX_JOINTS = 32;
  const HURT_TIME = 0.26;          // seconds a flinch lasts
  const FALL = 0.34, SINK_FROM = 0.42, SINK = 0.45;   // of dying: the share spent falling, where sinking starts, metres sunk
  const WHITE_FROM = 0.6, WHITE_BACK = 0.3;          // of a wind-up, where its striking parts begin to whiten; of a
                                                     // strike, by when they are back to their colour
  const HOLD = 0.9;                // the biped's hand at rest points what it holds this far forward of up (radians)
  const DIE_FLASH = 0.35;          // how far toward white a figure goes as its death begins

  Rigs.NONE = NONE; Rigs.WINDUP = WINDUP; Rigs.STRIKE = STRIKE; Rigs.CAST = CAST;
  Rigs.SHAPES = SHAPES;
  Rigs.STRIDE = STRIDE;

  const rigs = Object.create(null), order = [];
  const figures = new Map();       // puppet id -> compiled figure, or null for an id that has none
  const warned = new Set();
  let viewShape = null;            // shape index here -> the view's shape id, once the view is known

  // ---- small maths, all on numbers ----

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (v) => { const u = clamp01(v); return u * u * (3 - 2 * u); };
  const easeOut3 = (v) => { const u = 1 - clamp01(v); return 1 - u * u * u; };
  const frac = (v) => v - floor(v);

  // How much a flinch shows, seconds after the hurt: up fast, back slower.
  function flinch(hurt) {
    if (!(hurt >= 0) || hurt >= HURT_TIME) return 0;
    const k = hurt / HURT_TIME;
    return k < 0.22 ? smooth(k / 0.22) : 1 - smooth((k - 0.22) / 0.78);
  }

  // ---- registration ----

  Rigs.register = function (name, rig) {
    Core.assert(typeof name === 'string' && name !== '', 'Rigs.register needs a name');
    Core.assert(rig && Array.isArray(rig.joints) && rig.joints.length > 0 && typeof rig.pose === 'function',
      'Rigs.register: the rig "' + name + '" needs joints and a pose function');
    Core.assert(rig.joints.length <= MAX_JOINTS, 'Rigs.register: the rig "' + name + '" has more than ' + MAX_JOINTS + ' joints');
    const J = rig.joints.length, index = Object.create(null), parent = new Int8Array(J);
    const rest = new Float32Array(J * 3), turn = new Float64Array(J * 9), turned = new Uint8Array(J);
    for (let j = 0; j < J; j++) {
      const spec = rig.joints[j];
      Core.assert(typeof spec.name === 'string' && index[spec.name] === undefined, 'Rigs.register: "' + name + '" names a joint twice or not at all');
      index[spec.name] = j;
      if (j === 0) {
        Core.assert(spec.parent === null || spec.parent === undefined, 'Rigs.register: the first joint of "' + name + '" is its root');
        parent[j] = -1;
      } else {
        Core.assert(index[spec.parent] !== undefined, 'Rigs.register: in "' + name + '" the parent of ' + spec.name + ' must come before it');
        parent[j] = index[spec.parent];
      }
      const at = spec.at || [0, 0, 0];
      rest[j * 3] = at[0]; rest[j * 3 + 1] = at[1]; rest[j * 3 + 2] = at[2];
      const r = spec.turn || null;
      rotation(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0, turn, j * 9);
      turned[j] = r && (r[0] !== 0 || r[1] !== 0 || r[2] !== 0) ? 1 : 0;
    }
    const core = [], strikes = new Uint8Array(J);
    for (const c of rig.core || []) if (index[c] !== undefined) core.push(index[c]);
    for (const c of rig.strike || []) if (index[c] !== undefined) strikes[index[c]] = 1;
    rigs[name] = {
      name, J, index, parent, rest, turn, turned, core, strikes, names: rig.joints.map((s) => s.name),
      anim: Object.assign({}, rig.anim || {}), prepare: typeof rig.prepare === 'function' ? rig.prepare : null,
      stride: typeof rig.stride === 'function' ? rig.stride : null, pose: rig.pose,
    };
    if (order.indexOf(name) < 0) order.push(name);
    try { Defs.allow('rig', name); } catch (e) { /* after boot the word lists are closed: a late rig is for drawing only */ }
  };

  Rigs.joints = function (name) { return rigs[name] ? rigs[name].names.slice() : []; };
  Rigs.names = function () { return order.slice(); };
  Rigs.mask = function (fig, names) {
    let m = 0;
    for (let i = 0; fig && i < names.length; i++) {
      const j = fig.rig.index[names[i]];
      if (j !== undefined) m |= 1 << j;
    }
    return m;
  };

  // R = Ry(b) Rx(a) Rz(c), written row by row into m at o. Most joints turn about one or two axes only.
  function rotation(a, b, c, m, o) {
    let ca = 1, sa = 0, cb = 1, sb = 0, cc = 1, sc = 0;
    if (a !== 0) { ca = cos(a); sa = sin(a); }
    if (b !== 0) { cb = cos(b); sb = sin(b); }
    if (c !== 0) { cc = cos(c); sc = sin(c); }
    m[o] = cb * cc + sb * sa * sc; m[o + 1] = -cb * sc + sb * sa * cc; m[o + 2] = sb * ca;
    m[o + 3] = ca * sc; m[o + 4] = ca * cc; m[o + 5] = -sa;
    m[o + 6] = -sb * cc + cb * sa * sc; m[o + 7] = sb * sc + cb * sa * cc; m[o + 8] = cb * ca;
  }

  // ---- compiling a puppet ----

  function rgbOf(v, out, o) {
    if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) {
      const n = parseInt(v.slice(1), 16);
      out[o] = ((n >> 16) & 255) / 255; out[o + 1] = ((n >> 8) & 255) / 255; out[o + 2] = (n & 255) / 255;
    } else if (Array.isArray(v) && v.length >= 3) {
      out[o] = +v[0] || 0; out[o + 1] = +v[1] || 0; out[o + 2] = +v[2] || 0;
    } else {
      out[o] = out[o + 1] = out[o + 2] = 0.6;
    }
  }

  function warnOnce(text) {
    if (warned.has(text)) return;
    warned.add(text);
    console.warn('Rigs: ' + text);
  }

  function compile(def) {
    let rig = rigs[def.rig];
    if (!rig) {
      warnOnce('the puppet "' + def.id + '" names the rig "' + def.rig + '", which is not registered: it is drawn as static');
      rig = rigs.static;
    }
    const parts = def.parts, n = parts.length, J = rig.J;
    const fig = {
      id: def.id, rig, rigName: rig.name, scale: def.scale > 0 ? def.scale : 1, n,
      shape: new Uint8Array(n), joint: new Uint8Array(n), detail: new Uint8Array(n), core: new Uint8Array(n),
      size: new Float32Array(n * 3), at: new Float32Array(n * 3), color: new Float32Array(n * 3), glow: new Float32Array(n),
      rest: new Float32Array(rig.rest), anim: {}, height: 1, radius: 0.4, color3: [0.6, 0.6, 0.6], counts: { all: n, plain: 0, core: 0 },
      hip: 0, hipB: 0, reach: 0,
    };
    const animDef = def.anim || {};
    for (const key of Object.keys(rig.anim)) fig.anim[key] = typeof animDef[key] === 'number' ? animDef[key] : rig.anim[key];
    for (const key of Object.keys(animDef)) if (typeof animDef[key] === 'number' && fig.anim[key] === undefined) fig.anim[key] = animDef[key];
    const moved = animDef.joints && typeof animDef.joints === 'object' ? animDef.joints : null;
    if (moved) {
      for (const name of Object.keys(moved)) {
        const j = rig.index[name], v = moved[name];
        if (j === undefined || !Array.isArray(v) || v.length < 3) { warnOnce('the puppet "' + def.id + '" moves "' + name + '", which is not a joint of ' + rig.name); continue; }
        fig.rest[j * 3] = v[0]; fig.rest[j * 3 + 1] = v[1]; fig.rest[j * 3 + 2] = v[2];
      }
    }
    const best = new Float64Array(J).fill(-1), bestPart = new Int32Array(J).fill(-1);
    let biggest = -1, biggestVolume = -1;
    for (let i = 0; i < n; i++) {
      const p = parts[i];
      let s = SHAPES.indexOf(p.shape);
      if (s < 0) { warnOnce('the puppet "' + def.id + '" has a part of the unknown shape "' + p.shape + '"'); s = 0; }
      let j = p.joint === undefined ? 0 : rig.index[p.joint];
      if (j === undefined) { warnOnce('the puppet "' + def.id + '" hangs its part "' + p.key + '" on "' + p.joint + '", which is not a joint of ' + rig.name); j = 0; }
      fig.shape[i] = s;
      fig.joint[i] = j;
      fig.detail[i] = p.detail === true ? 1 : 0;
      for (let k = 0; k < 3; k++) {
        fig.size[i * 3 + k] = p.size[k];
        fig.at[i * 3 + k] = p.at[k];
      }
      rgbOf(def.palette ? def.palette[p.color] : null, fig.color, i * 3);
      const g = typeof p.glow === 'number' ? p.glow : typeof p.emissive === 'number' ? p.emissive : 0;
      fig.glow[i] = g < 0 ? 0 : g > 1 ? 1 : g;
      const volume = abs(p.size[0] * p.size[1] * p.size[2]);
      if (!fig.detail[i] && volume > best[j]) { best[j] = volume; bestPart[j] = i; }
      if (volume > biggestVolume) { biggestVolume = volume; biggest = i; }
    }
    for (const j of rig.core) if (bestPart[j] >= 0) fig.core[bestPart[j]] = 1;
    for (let i = 0; i < n; i++) {
      if (!fig.detail[i]) fig.counts.plain++;
      if (fig.core[i]) fig.counts.core++;
    }
    if (fig.counts.core === 0 && n > 0) { fig.core[biggest] = 1; fig.counts.core = 1; }
    if (biggest >= 0) fig.color3 = [fig.color[biggest * 3], fig.color[biggest * 3 + 1], fig.color[biggest * 3 + 2]];
    if (rig.prepare) rig.prepare(fig);
    measure(fig);
    return fig;
  }

  Rigs.figure = function (id) {
    if (figures.has(id)) return figures.get(id);
    const fig = typeof id === 'string' && Defs.has('puppet', id) ? compile(Defs.get('puppet', id)) : null;
    figures.set(id, fig);
    return fig;
  };

  // ---- the state of a moving thing, and the sink ----

  Rigs.state = function () {
    return {
      x: 0, y: 0, px: 0, py: 0, alpha: 1, face: 0, scale: 1, speed: 0, walk: 0, cycle: 0, t: 0,
      act: NONE, actT: 0, actLen: 0, hurt: 99, dying: false, die: 0,
      flash: 0, opacity: 1, glow: 1, tintR: 1, tintG: 1, tintB: 1, grey: 0, seed: 0, detail: true, lod: 0, shell: 0,
      strike: 0, lift: 0,
    };
  };

  Rigs.advance = function (fig, st, metres) {
    const s = fig.scale * (st.scale > 0 ? st.scale : 1), rig = fig.rig;
    const stride = rig.stride !== null ? rig.stride(fig, st.speed / s) : fig.anim.stride > 0 ? fig.anim.stride : 1;
    st.walk += metres;
    st.cycle += metres / s / (stride > 0.05 ? stride : 0.05);
  };

  function partStride() { return typeof Gfx.PART_STRIDE === 'number' && Gfx.PART_STRIDE >= STRIDE ? Gfx.PART_STRIDE : STRIDE; }

  Rigs.sink = function (cap) {
    const stride = partStride(), buf = [];
    for (let s = 0; s < SHAPES.length; s++) buf.push(new Float32Array(cap * stride));
    return { buf, n: new Int32Array(SHAPES.length), cap, total: 0, dropped: 0, stride };
  };

  Rigs.clear = function (out) {
    out.n.fill(0);
    out.total = 0;
    out.dropped = 0;
  };

  // ---- the writer ----

  const P = new Float32Array(MAX_JOINTS * 6);    // the pose of the figure being drawn
  const W = new Float64Array(MAX_JOINTS * 12);   // its joints in the world, 3 by 4 each, row by row
  const R = new Float64Array(9), Q = new Float64Array(9);

  Rigs.draw = function (fig, st, out) {
    const rig = fig.rig, J = rig.J, parent = rig.parent, rest = fig.rest, turn = rig.turn, turned = rig.turned;
    P.fill(0, 0, J * 6);
    rig.pose(fig, st, P);

    // dying: every rig sinks and fades the same way after its own fall, lightening a little as it starts (white
    // is kept for the top of a wind-up and for the outline of the Wrong-footed)
    let alpha = st.opacity, flash = st.flash;
    if (st.dying) {
      const k = clamp01((st.die - SINK_FROM) / (1 - SINK_FROM));
      P[4] -= SINK * smooth(k);
      alpha *= 1 - k;
      const f = DIE_FLASH * (1 - st.die * 5);
      if (f > flash) flash = f;
    }
    if (!(alpha > 0.004)) return 0;

    // the base: the figure's place on the ground, its facing and its size
    const a = st.alpha, x = st.px + (st.x - st.px) * a, z = st.py + (st.y - st.py) * a, up = st.lift || 0;
    const s = fig.scale * (st.scale > 0 ? st.scale : 1), sf = sin(st.face), cf = cos(st.face);
    const b00 = s * sf, b02 = s * cf, b11 = s, b20 = -s * cf, b22 = s * sf;

    for (let j = 0; j < J; j++) {
      const p6 = j * 6, o = j * 12;
      // the joint's own rotation: its pose, after its rest turn
      const rx = P[p6], ry = P[p6 + 1], rz = P[p6 + 2];
      let r0, r1, r2, r3, r4, r5, r6, r7, r8;
      if (rx === 0 && ry === 0 && rz === 0) {
        if (turned[j]) {
          const t9 = j * 9;
          r0 = turn[t9]; r1 = turn[t9 + 1]; r2 = turn[t9 + 2]; r3 = turn[t9 + 3]; r4 = turn[t9 + 4]; r5 = turn[t9 + 5];
          r6 = turn[t9 + 6]; r7 = turn[t9 + 7]; r8 = turn[t9 + 8];
        } else {
          r0 = 1; r1 = 0; r2 = 0; r3 = 0; r4 = 1; r5 = 0; r6 = 0; r7 = 0; r8 = 1;
        }
      } else {
        rotation(rx, ry, rz, R, 0);
        if (turned[j]) {
          const t9 = j * 9;
          for (let row = 0; row < 3; row++) {
            const t0 = turn[t9 + row * 3], t1 = turn[t9 + row * 3 + 1], t2 = turn[t9 + row * 3 + 2];
            Q[row * 3] = t0 * R[0] + t1 * R[3] + t2 * R[6];
            Q[row * 3 + 1] = t0 * R[1] + t1 * R[4] + t2 * R[7];
            Q[row * 3 + 2] = t0 * R[2] + t1 * R[5] + t2 * R[8];
          }
          r0 = Q[0]; r1 = Q[1]; r2 = Q[2]; r3 = Q[3]; r4 = Q[4]; r5 = Q[5]; r6 = Q[6]; r7 = Q[7]; r8 = Q[8];
        } else {
          r0 = R[0]; r1 = R[1]; r2 = R[2]; r3 = R[3]; r4 = R[4]; r5 = R[5]; r6 = R[6]; r7 = R[7]; r8 = R[8];
        }
      }
      const tx = rest[j * 3] + P[p6 + 3], ty = rest[j * 3 + 1] + P[p6 + 4], tz = rest[j * 3 + 2] + P[p6 + 5];
      let p00, p01, p02, p03, p10, p11, p12, p13, p20, p21, p22, p23;
      const pj = parent[j];
      if (pj < 0) {
        p00 = b00; p01 = 0; p02 = b02; p03 = x; p10 = 0; p11 = b11; p12 = 0; p13 = up; p20 = b20; p21 = 0; p22 = b22; p23 = z;
      } else {
        const q = pj * 12;
        p00 = W[q]; p01 = W[q + 1]; p02 = W[q + 2]; p03 = W[q + 3];
        p10 = W[q + 4]; p11 = W[q + 5]; p12 = W[q + 6]; p13 = W[q + 7];
        p20 = W[q + 8]; p21 = W[q + 9]; p22 = W[q + 10]; p23 = W[q + 11];
      }
      W[o] = p00 * r0 + p01 * r3 + p02 * r6; W[o + 1] = p00 * r1 + p01 * r4 + p02 * r7; W[o + 2] = p00 * r2 + p01 * r5 + p02 * r8;
      W[o + 3] = p00 * tx + p01 * ty + p02 * tz + p03;
      W[o + 4] = p10 * r0 + p11 * r3 + p12 * r6; W[o + 5] = p10 * r1 + p11 * r4 + p12 * r7; W[o + 6] = p10 * r2 + p11 * r5 + p12 * r8;
      W[o + 7] = p10 * tx + p11 * ty + p12 * tz + p13;
      W[o + 8] = p20 * r0 + p21 * r3 + p22 * r6; W[o + 9] = p20 * r1 + p21 * r4 + p22 * r7; W[o + 10] = p20 * r2 + p21 * r5 + p22 * r8;
      W[o + 11] = p20 * tx + p21 * ty + p22 * tz + p23;
    }

    // the striking parts whiten toward the top of a wind-up, and come back early in the strike
    let white = 0;
    if (st.act === WINDUP) white = smooth((actK(st) - WHITE_FROM) / (1 - WHITE_FROM));
    else if (st.act === STRIKE) white = 1 - smooth(actK(st) / WHITE_BACK);
    const strikes = rig.strikes, mask = st.strike | 0, shell = st.shell > 0 && !st.dying ? st.shell : 0;

    // the parts
    const n = fig.n, shape = fig.shape, joint = fig.joint, size = fig.size, at = fig.at, color = fig.color, glowOf = fig.glow;
    const skipDetail = !st.detail, coreOnly = st.lod > 0, detail = fig.detail, core = fig.core;
    const cap = out.cap, stride = out.stride, counts = out.n, bufs = out.buf, map = viewShape;
    const tr = st.tintR, tg = st.tintG, tb = st.tintB, glowK = st.glow, grey = st.grey > 0 ? (st.grey < 1 ? st.grey : 1) : 0;
    let written = 0;
    for (let i = 0; i < n; i++) {
      if (coreOnly ? core[i] === 0 : skipDetail && detail[i] === 1) continue;
      const sh = map === null ? shape[i] : map[shape[i]];
      if (sh < 0) continue;
      const c = counts[sh];
      if (c >= cap) { out.dropped++; continue; }
      counts[sh] = c + 1;
      const buf = bufs[sh], o = c * stride, w = joint[i] * 12, i3 = i * 3;
      const sx = size[i3], sy = size[i3 + 1], sz = size[i3 + 2], ax = at[i3], ay = at[i3 + 1], az = at[i3 + 2];
      const w0 = W[w], w1 = W[w + 1], w2 = W[w + 2], w4 = W[w + 4], w5 = W[w + 5], w6 = W[w + 6], w8 = W[w + 8], w9 = W[w + 9], w10 = W[w + 10];
      buf[o] = w0 * sx; buf[o + 1] = w1 * sy; buf[o + 2] = w2 * sz; buf[o + 3] = w0 * ax + w1 * ay + w2 * az + W[w + 3];
      buf[o + 4] = w4 * sx; buf[o + 5] = w5 * sy; buf[o + 6] = w6 * sz; buf[o + 7] = w4 * ax + w5 * ay + w6 * az + W[w + 7];
      buf[o + 8] = w8 * sx; buf[o + 9] = w9 * sy; buf[o + 10] = w10 * sz; buf[o + 11] = w8 * ax + w9 * ay + w10 * az + W[w + 11];
      let cr = color[i3], cg = color[i3 + 1], cb = color[i3 + 2];
      if (grey > 0) {
        const l = 0.3 * cr + 0.55 * cg + 0.15 * cb;
        cr += (l - cr) * grey; cg += (l - cg) * grey; cb += (l - cb) * grey;
      }
      buf[o + 12] = cr * tr;
      buf[o + 13] = cg * tg;
      buf[o + 14] = cb * tb;
      buf[o + 15] = white > flash && (mask !== 0 ? (mask >>> joint[i]) & 1 : strikes[joint[i]]) === 1 ? white : flash;
      const g = glowOf[i] * glowK;
      buf[o + 16] = g > 1 ? 1 : g;
      buf[o + 17] = alpha;
      written++;
      if (shell > 0) written += shellOf(buf, o, out, sh, shell);
    }
    out.total += written;
    return written;
  };

  // A white copy of the part record at buf[o], grown by m metres on every side about its middle and mirrored
  // across its own x (every unit shape is the same either way round), so its faces turn inside out: the view
  // draws only its far side, which shows as a white rim round whatever stands in front of it. Returns 1 if it
  // found room.
  function shellOf(buf, o, out, sh, m) {
    const c = out.n[sh];
    if (c >= out.cap) { out.dropped++; return 0; }
    out.n[sh] = c + 1;
    const s = c * out.stride;
    const lx = sqrt(buf[o] * buf[o] + buf[o + 4] * buf[o + 4] + buf[o + 8] * buf[o + 8]) || 1;
    const ly = sqrt(buf[o + 1] * buf[o + 1] + buf[o + 5] * buf[o + 5] + buf[o + 9] * buf[o + 9]) || 1;
    const lz = sqrt(buf[o + 2] * buf[o + 2] + buf[o + 6] * buf[o + 6] + buf[o + 10] * buf[o + 10]) || 1;
    const kx = -(1 + 2 * m / lx), ky = 1 + 2 * m / ly, kz = 1 + 2 * m / lz, lift = 0.5 * (1 - ky);
    for (let r = 0; r < 12; r += 4) {
      buf[s + r] = buf[o + r] * kx;
      buf[s + r + 1] = buf[o + r + 1] * ky;
      buf[s + r + 2] = buf[o + r + 2] * kz;
      buf[s + r + 3] = buf[o + r + 3] + buf[o + r + 1] * lift;
    }
    buf[s + 12] = 1; buf[s + 13] = 1; buf[s + 14] = 1; buf[s + 15] = 1; buf[s + 16] = 0; buf[s + 17] = buf[o + 17];
    return 1;
  }

  // The height and the ground radius of a figure at rest, from where its parts stand, in metres: its puppet's own
  // scale counts, a state's scale (st.scale 1) does not.
  function measure(fig) {
    const out = Rigs.sink(Math.max(1, fig.n)), st = Rigs.state(), keep = viewShape;
    viewShape = null;
    st.face = PI / 2;
    st.detail = true;
    try {
      Rigs.draw(fig, st, out);
    } finally {
      viewShape = keep;
    }
    let top = 0.2, reach = 0.1;
    for (let sh = 0; sh < SHAPES.length; sh++) {
      const buf = out.buf[sh];
      for (let i = 0; i < out.n[sh]; i++) {
        const o = i * out.stride;
        for (let corner = 0; corner < 8; corner++) {
          const ux = (corner & 1) - 0.5, uy = (corner >> 1) & 1, uz = ((corner >> 2) & 1) - 0.5;
          const wx = buf[o] * ux + buf[o + 1] * uy + buf[o + 2] * uz + buf[o + 3];
          const wy = buf[o + 4] * ux + buf[o + 5] * uy + buf[o + 6] * uz + buf[o + 7];
          const wz = buf[o + 8] * ux + buf[o + 9] * uy + buf[o + 10] * uz + buf[o + 11];
          if (wy > top) top = wy;
          const d = sqrt(wx * wx + wz * wz);
          if (d > reach) reach = d;
        }
      }
    }
    fig.height = top;
    fig.radius = reach;
  }

  // Called once the view exists: its shape ids by name, and its stride.
  Plat.on('boot', function () {
    const names = Array.isArray(Gfx.SHAPES) ? Gfx.SHAPES : Array.isArray(Mesh.SHAPES) ? Mesh.SHAPES : null;
    if (names) {
      const map = new Int8Array(SHAPES.length);
      let same = names.length === SHAPES.length;
      for (let i = 0; i < SHAPES.length; i++) {
        map[i] = names.indexOf(SHAPES[i]);
        if (map[i] !== i) same = false;
        if (map[i] < 0) warnOnce('the view has no shape "' + SHAPES[i] + '": parts of that shape are left out');
      }
      viewShape = same ? null : map;
    }
    for (const def of Defs.all('puppet')) Rigs.figure(def.id);
  });

  // ---- gaits shared by the legged rigs ----
  // A leg of phase q (0..1) of a cycle of length 4 * quarter: on the ground for the first half, its foot going
  // from quarter in front of the hip to quarter behind as the body passes over it, then in the air for the
  // second half, swinging forward and lifted at most lift. gaitO is the foot's place ahead of the hip, gaitL
  // its lift above the ground.
  let gaitO = 0, gaitL = 0;
  function gait(q, quarter, lift) {
    if (q < 0.5) {
      gaitO = quarter * (1 - 4 * q);
      gaitL = 0;
    } else {
      const u = q * 2 - 1, e = u * u * (3 - 2 * u);
      gaitO = quarter * (2 * e - 1);
      gaitL = lift * sin(PI * u);
    }
  }

  // A rigid leg of length L whose foot stands o ahead of its hip at height h: legA is its swing (positive:
  // foot forward) and legS how far it must slide up into the body for its foot to stand lift above the ground.
  let legA = 0, legS = 0;
  function leg(o, L, h, lift) {
    const r = o / L;
    legA = asin(r < -0.98 ? -0.98 : r > 0.98 ? 0.98 : r);
    legS = lift + L * cos(legA) - h;
    if (legS < 0) legS = 0;
  }

  // How much a figure walks rather than stands, from its speed in its own units a second.
  const walking = (speed) => smooth((speed - 0.1) / 0.55);

  // The acts: how far into the wind-up (k of WINDUP), and the strike's two halves.
  // actK gives the share of the act done; strikeE how far the blow has gone (0..1, fast); recoverE how far it
  // has come back (0..1).
  function actK(st) { return st.actLen > 0 ? clamp01(st.actT / st.actLen) : 1; }

  // ---- biped ----
  const B = { root: 0, torso: 1, head: 2, armL: 3, armR: 4, legL: 5, legR: 6, handR: 7 };
  Rigs.register('biped', {
    joints: [
      { name: 'root', parent: null, at: [0, 0, 0] },
      { name: 'torso', parent: 'root', at: [0, 0.92, 0] },
      { name: 'head', parent: 'torso', at: [0, 0.56, 0] },
      { name: 'armL', parent: 'torso', at: [0.23, 0.5, 0] },
      { name: 'armR', parent: 'torso', at: [-0.23, 0.5, 0] },
      { name: 'legL', parent: 'root', at: [0.1, 0.92, 0] },
      { name: 'legR', parent: 'root', at: [-0.1, 0.92, 0] },
      { name: 'handR', parent: 'armR', at: [0, -0.62, 0.02], turn: [HOLD, 0, 0] },
    ],
    core: ['torso', 'head'],
    strike: ['armR', 'handR'],
    anim: { stride: 1.4, swing: 0.5, bob: 0, lean: 0, lift: 0.12, reach: 0, droop: 0, sway: 0, hop: 0, plumb: 0, clasp: 0, pull: 0 },
    prepare: function (fig) { fig.hip = Math.max(0.2, (fig.rest[B.legL * 3 + 1] + fig.rest[B.legR * 3 + 1]) / 2); },
    // longer steps when hurrying, never so long that a rigid leg swings past about 32 degrees
    stride: function (fig, speed) { return Math.min(fig.anim.stride * (0.8 + 0.45 * smooth((speed - 1) / 4)), fig.hip * 2.1); },
    pose: function (fig, st, P) {
      const A = fig.anim, s = fig.scale * (st.scale > 0 ? st.scale : 1), L = fig.hip, seed = st.seed;
      const speed = st.speed / s, w = walking(speed), t = st.t + seed * 17;
      const quarter = this.stride(fig, speed) / 4, p = frac(st.cycle), hop = A.hop > 0;
      // legs: the one on the ground carries the hips, the other swings and lifts. A hop moves both feet together:
      // on the ground for the first half of the cycle, then off it, the body thrown up by hop at the middle
      gait(p, quarter, A.lift);
      const oL = gaitO, lL = gaitL;
      gait(hop ? p : frac(p + 0.5), quarter, A.lift);
      const oR = gaitO, lR = gaitL;
      const oStand = p < 0.5 ? oL : oR, h = sqrt(L * L - oStand * oStand), up = hop && p >= 0.5 ? A.hop * sin(PI * (2 * p - 1)) : 0;
      leg(oL, L, h + up, lL);
      P[B.legL * 6] = -legA * w; P[B.legL * 6 + 4] = legS * w;
      leg(oR, L, h + up, lR);
      P[B.legR * 6] = -legA * w; P[B.legR * 6 + 4] = legS * w;
      const c = cos(TAU * p), breathe = sin(t * 1.9) * (1 - w);
      P[B.root * 6 + 4] = -(L - h) * w + up * w + A.bob * w * (0.5 - 0.5 * cos(2 * TAU * p));
      // torso: its lean, more when hurrying, a twist against the legs, a roll from foot to foot, breath when still
      const lean = A.lean + w * 0.07 * Math.min(speed, 3);
      P[B.torso * 6] = lean + breathe * 0.012;
      P[B.torso * 6 + 1] = hop ? 0 : w * 0.13 * c;
      P[B.torso * 6 + 2] = hop ? 0 : A.sway * w * sin(TAU * p);
      P[B.torso * 6 + 4] = breathe * 0.008;
      P[B.head * 6] = -lean * 0.7 + A.droop;
      P[B.head * 6 + 1] = -w * 0.1 * c + (1 - w) * 0.28 * sin(t * 0.45) * sin(t * 0.21 + 1);
      // arms against the legs, hanging plumb whatever the lean, held forward by reach (in a hop, together)
      const swing = A.swing * (0.85 + 0.3 * seed) * w;
      P[B.armL * 6] = (hop ? -swing * c : swing * c) - lean - A.reach + breathe * 0.02;
      P[B.armR * 6] = -swing * c - lean - A.reach * 0.8;
      P[B.armL * 6 + 2] = 0.07 - A.clasp;
      P[B.armR * 6 + 2] = A.plumb > 0 ? 0 : -0.07;

      // an act: a wind-up that shows before the blow lands, the blow, the way back
      const act = st.act;
      if (act === WINDUP || act === STRIKE) {
        // drawn: how far the weapon is drawn back (1 at the top of the wind-up); blow: how far the strike has come
        const k = actK(st);
        let drawn = 0, blow = 0;
        if (act === WINDUP) drawn = smooth(k);
        else if (k < 0.35) { const e = easeOut3(k / 0.35); drawn = 1 - e; blow = e; } else blow = 1 - smooth((k - 0.35) / 0.65);
        P[B.torso * 6 + 1] += -0.5 * drawn + 0.45 * blow;
        P[B.torso * 6] += -0.14 * drawn + 0.3 * blow;
        P[B.root * 6 + 4] += -0.05 * drawn;
        P[B.root * 6 + 5] += 0.14 * blow;
        P[B.armR * 6] += 2.4 * drawn - 1.25 * blow;
        P[B.armR * 6 + 2] += -0.3 * drawn;
        P[B.handR * 6] += 2.2 * drawn + 1.9 * blow;    // the blade follows the line of the arm over and down
        P[B.armL * 6] += -0.55 * drawn - 0.3 * blow;
        P[B.head * 6 + 1] += 0.3 * drawn - 0.25 * blow;
      } else if (act === CAST && A.pull > 0) {
        // a pull on the rope: both hands up, then hard down past where they were, then back
        const k = actK(st);
        const a = k < 0.3 ? -0.6 * smooth(k / 0.3) : k < 0.6 ? -0.6 + 0.95 * smooth((k - 0.3) / 0.3) : 0.35 * (1 - smooth((k - 0.6) / 0.4));
        P[B.armL * 6] += a;
        P[B.armR * 6] += a;
        P[B.torso * 6] += a > 0 ? 0.12 * a : 0.04 * a;
        P[B.root * 6 + 4] += a > 0 ? -0.04 * a : 0;
      } else if (act === CAST) {
        const k = actK(st), bump = sin(PI * k);
        P[B.armL * 6] += -1.5 * bump;
        P[B.armL * 6 + 2] += 0.2 * bump;
        P[B.torso * 6] += -0.08 * bump;
        P[B.armR * 6] += -0.35 * bump;
      }

      // a flinch
      const f = flinch(st.hurt);
      if (f > 0) {
        P[B.torso * 6] += -0.34 * f;
        P[B.head * 6] += -0.3 * f;
        P[B.root * 6 + 5] += -0.08 * f;
        P[B.armL * 6 + 2] += 0.4 * f;
        P[B.armR * 6 + 2] += -0.4 * f;
        P[B.armL * 6] += -0.3 * f;
      }

      // falling: back over the heels, arms thrown up
      if (st.dying) {
        const k = clamp01(st.die / FALL), e = k * k;
        P[B.root * 6] += -1.45 * e;
        P[B.root * 6 + 4] += 0.12 * e;
        P[B.armL * 6] += -2.0 * e;
        P[B.armR * 6] += -1.6 * e;
        P[B.legL * 6] += -0.25 * e;
        P[B.legR * 6] += 0.15 * e;
        P[B.head * 6] += 0.35 * e;
      } else if (A.plumb > 0) {
        // the thing held stands upright: the hand undoes the pitch of the torso and the arm above it
        P[B.handR * 6] = -(P[B.torso * 6] + P[B.armR * 6]) - HOLD;
      }
    },
  });

  // ---- quadruped ----
  const QJ = { root: 0, torso: 1, head: 2, legFL: 3, legFR: 4, legBL: 5, legBR: 6, tail: 7 };
  Rigs.register('quadruped', {
    joints: [
      { name: 'root', parent: null, at: [0, 0, 0] },
      { name: 'torso', parent: 'root', at: [0, 0.62, 0] },
      { name: 'head', parent: 'torso', at: [0, 0.12, 0.52] },
      { name: 'legFL', parent: 'root', at: [0.15, 0.62, 0.4] },
      { name: 'legFR', parent: 'root', at: [-0.15, 0.62, 0.4] },
      { name: 'legBL', parent: 'root', at: [0.15, 0.62, -0.4] },
      { name: 'legBR', parent: 'root', at: [-0.15, 0.62, -0.4] },
      { name: 'tail', parent: 'torso', at: [0, 0.06, -0.52] },
    ],
    core: ['torso', 'head'],
    strike: ['head', 'legFL', 'legFR'],
    anim: { stride: 1.3, swing: 0.15, bob: 0, lift: 0.1 },
    prepare: function (fig) {
      fig.hip = Math.max(0.15, fig.rest[QJ.legFL * 3 + 1]);
      fig.hipB = Math.max(0.15, fig.rest[QJ.legBL * 3 + 1]);
    },
    stride: function (fig, speed) { return Math.min(fig.anim.stride * (0.7 + 0.5 * smooth(speed / 4)), Math.min(fig.hip, fig.hipB) * 2.2); },
    pose: function (fig, st, P) {
      const A = fig.anim, s = fig.scale * (st.scale > 0 ? st.scale : 1), t = st.t + st.seed * 13;
      const speed = st.speed / s, w = walking(speed);
      const quarter = this.stride(fig, speed) / 4, p = frac(st.cycle);
      const Lf = fig.hip, Lb = fig.hipB;
      // a trot: the diagonal pairs move together
      gait(p, quarter, A.lift);
      const o1 = gaitO, l1 = gaitL;
      gait(frac(p + 0.5), quarter, A.lift);
      const o2 = gaitO, l2 = gaitL;
      const oStand = p < 0.5 ? o1 : o2, hF = sqrt(Lf * Lf - oStand * oStand), hB = sqrt(Lb * Lb - oStand * oStand);
      leg(o1, Lf, hF, l1); P[QJ.legFL * 6] = -legA * w; P[QJ.legFL * 6 + 4] = legS * w;
      leg(o2, Lf, hF, l2); P[QJ.legFR * 6] = -legA * w; P[QJ.legFR * 6 + 4] = legS * w;
      leg(o2, Lb, hB, l2); P[QJ.legBL * 6] = -legA * w; P[QJ.legBL * 6 + 4] = legS * w;
      leg(o1, Lb, hB, l1); P[QJ.legBR * 6] = -legA * w; P[QJ.legBR * 6 + 4] = legS * w;
      const drop = (Lf - hF + Lb - hB) / 2, c2 = cos(2 * TAU * p), breathe = sin(t * 2.3) * (1 - w);
      P[QJ.root * 6 + 4] = -drop * w + A.bob * w * (0.5 - 0.5 * c2);
      P[QJ.torso * 6] = 0.025 * w * c2 + breathe * 0.01;
      P[QJ.head * 6] = A.swing * w * sin(2 * TAU * p + 1) - 0.06 + (1 - w) * 0.1 * sin(t * 0.37);
      P[QJ.head * 6 + 1] = (1 - w) * 0.35 * sin(t * 0.31) * sin(t * 0.17 + 2);
      P[QJ.tail * 6] = -0.25 - 0.15 * w;
      P[QJ.tail * 6 + 1] = 0.35 * w * sin(TAU * p) + 0.2 * (1 - w) * sin(t * 1.3);

      const act = st.act;
      if (act === WINDUP || act === STRIKE) {
        const k = actK(st);
        let drawn = 0, blow = 0;
        if (act === WINDUP) drawn = smooth(k);
        else if (k < 0.3) { const e = easeOut3(k / 0.3); drawn = 1 - e; blow = e; } else blow = 1 - smooth((k - 0.3) / 0.7);
        // crouched low and back, head down on the target; then a leap with the forelegs reaching
        P[QJ.root * 6 + 5] += -0.25 * drawn + 0.6 * blow;
        P[QJ.root * 6 + 4] += -0.12 * drawn + 0.12 * blow;
        P[QJ.torso * 6] += 0.1 * drawn - 0.2 * blow;
        P[QJ.head * 6] += 0.18 * drawn - 0.3 * blow;
        P[QJ.legFL * 6] += 0.35 * drawn - 0.8 * blow;
        P[QJ.legFR * 6] += 0.35 * drawn - 0.8 * blow;
        P[QJ.legBL * 6] += -0.2 * drawn + 0.5 * blow;
        P[QJ.legBR * 6] += -0.2 * drawn + 0.5 * blow;
        P[QJ.tail * 6] += -0.3 * drawn + 0.2 * blow;
      }
      const f = flinch(st.hurt);
      if (f > 0) {
        P[QJ.root * 6 + 5] += -0.1 * f;
        P[QJ.torso * 6] += -0.14 * f;
        P[QJ.head * 6] += -0.35 * f;
      }
      if (st.dying) {
        const k = clamp01(st.die / FALL), e = k * k;
        P[QJ.root * 6 + 2] += 1.45 * e;
        P[QJ.root * 6 + 4] += 0.16 * e;
        P[QJ.legFL * 6 + 2] += -0.5 * e;
        P[QJ.legBL * 6 + 2] += -0.4 * e;
        P[QJ.head * 6] += -0.3 * e;
      }
    },
  });

  // ---- floater ----
  const FJ = { root: 0, torso: 1, head: 2, armL: 3, armR: 4, handR: 5, tail: 6 };
  Rigs.register('floater', {
    joints: [
      { name: 'root', parent: null, at: [0, 0, 0] },
      { name: 'torso', parent: 'root', at: [0, 0.9, 0] },
      { name: 'head', parent: 'torso', at: [0, 0.55, 0] },
      { name: 'armL', parent: 'torso', at: [0.2, 0.45, 0] },
      { name: 'armR', parent: 'torso', at: [-0.2, 0.45, 0] },
      { name: 'handR', parent: 'armR', at: [0, -0.5, 0.04] },
      { name: 'tail', parent: 'torso', at: [0, -0.3, 0] },
    ],
    core: ['torso', 'head'],
    strike: ['armL', 'armR', 'handR'],
    anim: { hover: 0.35, bob: 0.06, swing: 0.25 },
    pose: function (fig, st, P) {
      const A = fig.anim, s = fig.scale * (st.scale > 0 ? st.scale : 1), t = st.t + st.seed * 11;
      const speed = st.speed / s, go = smooth(speed / 2.2);
      P[FJ.root * 6 + 4] = A.hover + A.bob * sin(t * 2.1);
      const lean = 0.2 * go + 0.03 * sin(t * 1.3);
      P[FJ.torso * 6] = lean;
      P[FJ.torso * 6 + 2] = 0.04 * sin(t * 0.9);
      P[FJ.tail * 6] = -0.45 * go - lean * 0.5 + 0.08 * sin(t * 2.6);
      P[FJ.tail * 6 + 2] = 0.1 * sin(t * 1.7);
      P[FJ.head * 6] = -lean * 0.6;
      P[FJ.head * 6 + 1] = 0.3 * (1 - go) * sin(t * 0.4);
      const drift = A.swing * sin(t * 1.6);
      P[FJ.armL * 6] = -0.15 + drift - lean;
      P[FJ.armL * 6 + 2] = 0.15;
      P[FJ.armR * 6] = -0.55 - drift * 0.5 - lean;
      P[FJ.armR * 6 + 2] = -0.12;
      P[FJ.handR * 6] = 0.55 + drift * 0.5;          // the lantern hangs plumb
      const act = st.act;
      if (act === WINDUP || act === STRIKE) {
        const k = actK(st);
        let drawn = 0, blow = 0;
        if (act === WINDUP) drawn = smooth(k);
        else if (k < 0.35) { const e = easeOut3(k / 0.35); drawn = 1 - e; blow = e; } else blow = 1 - smooth((k - 0.35) / 0.65);
        P[FJ.armL * 6] += -2.1 * drawn - 1.2 * blow;
        P[FJ.armR * 6] += -1.6 * drawn - 0.8 * blow;
        P[FJ.handR * 6] += 1.6 * drawn + 0.8 * blow;
        P[FJ.torso * 6] += -0.22 * drawn + 0.32 * blow;
        P[FJ.root * 6 + 4] += 0.15 * drawn;
        P[FJ.root * 6 + 5] += 0.25 * blow;
      } else if (act === CAST) {
        const bump = sin(PI * actK(st));
        P[FJ.armL * 6] += -1.4 * bump;
        P[FJ.torso * 6] += -0.1 * bump;
      }
      const f = flinch(st.hurt);
      if (f > 0) {
        P[FJ.torso * 6] += -0.3 * f;
        P[FJ.head * 6] += -0.25 * f;
        P[FJ.root * 6 + 5] += -0.12 * f;
      }
      if (st.dying) {
        const k = clamp01(st.die / FALL), e = k * k;
        P[FJ.root * 6 + 4] -= (A.hover + A.bob) * e;
        P[FJ.root * 6] += 0.7 * e;
        P[FJ.armL * 6] += -1.2 * e;
        P[FJ.armR * 6] += -0.8 * e;
      }
    },
  });

  // ---- crawler ----
  // Each leg is pointed at the spot its foot should stand on and slid along its own line into the body until
  // its end is there, so a foot on the ground stays where it is while the body passes over it.
  const CJ = { root: 0, torso: 1, head: 2, tail: 9 };
  const CRAWL_SIDE = [1, -1, 1, -1, 1, -1], CRAWL_PAIR = [0, 1, 1, 0, 0, 1];   // per leg: its side, and its tripod
  const CRAWL_FAN = [0.07, 0.07, 0, 0, -0.07, -0.07];   // metres: the front feet stand ahead of their hips, the back ones behind
  Rigs.register('crawler', {
    joints: [
      { name: 'root', parent: null, at: [0, 0, 0] },
      { name: 'torso', parent: 'root', at: [0, 0.3, 0] },
      { name: 'head', parent: 'torso', at: [0, 0.02, 0.3] },
      { name: 'leg1L', parent: 'root', at: [0.14, 0.3, 0.2] },
      { name: 'leg1R', parent: 'root', at: [-0.14, 0.3, 0.2] },
      { name: 'leg2L', parent: 'root', at: [0.16, 0.3, 0] },
      { name: 'leg2R', parent: 'root', at: [-0.16, 0.3, 0] },
      { name: 'leg3L', parent: 'root', at: [0.14, 0.3, -0.2] },
      { name: 'leg3R', parent: 'root', at: [-0.14, 0.3, -0.2] },
      { name: 'tail', parent: 'torso', at: [0, 0, -0.25] },
    ],
    core: ['torso', 'head'],
    strike: ['head'],
    anim: { stride: 0.6, lift: 0.06, leg: 0.5 },
    // fig.reach: how far out from its hip a foot stands, so that even the farthest step needs no longer leg
    prepare: function (fig) {
      const L = fig.anim.leg, h = Math.max(0.05, fig.rest[3 * 3 + 1]), far = fig.anim.stride * 1.2 / 4 + 0.07;
      fig.hip = h;
      fig.reach = sqrt(Math.max(0.01, L * L * 0.97 - h * h - far * far));
    },
    stride: function (fig, speed) { return fig.anim.stride * (0.8 + 0.4 * smooth(speed / 2)); },
    pose: function (fig, st, P) {
      const A = fig.anim, s = fig.scale * (st.scale > 0 ? st.scale : 1), t = st.t + st.seed * 7;
      const speed = st.speed / s, w = walking(speed * 1.6), quarter = this.stride(fig, speed) / 4, p = frac(st.cycle);
      const reach = fig.reach, L = A.leg, breathe = sin(t * 2.7) * (1 - w);
      const bob = 0.012 * w * sin(2 * TAU * p) + 0.01 * breathe;
      P[CJ.root * 6 + 4] = bob;
      const hip = fig.hip + bob;
      for (let i = 0; i < 6; i++) {
        gait(CRAWL_PAIR[i] === 0 ? p : frac(p + 0.5), quarter, A.lift);
        const side = CRAWL_SIDE[i], o = (3 + i) * 6;
        const fx = side * reach, fy = gaitL * w - hip, fz = gaitO * w + CRAWL_FAN[i];
        const len = sqrt(fx * fx + fy * fy + fz * fz), dx = fx / len, dy = fy / len, dz = fz / len;
        const roll = side * Math.acos(-dy < -1 ? -1 : -dy > 1 ? 1 : -dy), sr = sin(roll);
        P[o + 1] = Math.atan2(-dz / sr, dx / sr);
        P[o + 2] = roll;
        const slide = len - L;
        P[o + 3] = dx * slide; P[o + 4] = dy * slide; P[o + 5] = dz * slide;
      }
      P[CJ.torso * 6 + 2] = 0.04 * w * sin(TAU * p);
      P[CJ.head * 6 + 1] = 0.12 * w * sin(TAU * p) + (1 - w) * 0.3 * sin(t * 0.5);
      P[CJ.tail * 6 + 1] = -0.16 * w * sin(TAU * p) + 0.08 * breathe;
      P[CJ.tail * 6] = -0.05 + 0.04 * breathe;
      const act = st.act;
      if (act === WINDUP || act === STRIKE) {
        const k = actK(st);
        let drawn = 0, blow = 0;
        if (act === WINDUP) drawn = smooth(k);
        else if (k < 0.3) { const e = easeOut3(k / 0.3); drawn = 1 - e; blow = e; } else blow = 1 - smooth((k - 0.3) / 0.7);
        P[CJ.torso * 6] += -0.4 * drawn + 0.2 * blow;
        P[CJ.root * 6 + 4] += 0.06 * drawn;
        P[CJ.root * 6 + 5] += -0.1 * drawn + 0.3 * blow;
        P[CJ.head * 6] += -0.3 * drawn + 0.35 * blow;
      }
      const f = flinch(st.hurt);
      if (f > 0) {
        P[CJ.root * 6 + 5] += -0.08 * f;
        P[CJ.torso * 6] += -0.2 * f;
        P[CJ.root * 6 + 4] += 0.04 * f;
      }
      if (st.dying) {
        const k = clamp01(st.die / FALL), e = smooth(k);
        P[CJ.root * 6 + 2] += 2.6 * e;                 // over on its back
        P[CJ.root * 6 + 4] += 0.32 * e;
        for (let i = 0; i < 6; i++) P[(3 + i) * 6 + 2] -= CRAWL_SIDE[i] * 0.8 * e;   // the legs curl in
      }
    },
  });

  // ---- winged ----
  const WJ = { root: 0, torso: 1, head: 2, wingL: 3, wingR: 4, legL: 5, legR: 6, tail: 7 };
  Rigs.register('winged', {
    joints: [
      { name: 'root', parent: null, at: [0, 0, 0] },
      { name: 'torso', parent: 'root', at: [0, 1.3, 0] },
      { name: 'head', parent: 'torso', at: [0, 0.1, 0.14] },
      { name: 'wingL', parent: 'torso', at: [0.08, 0.06, 0] },
      { name: 'wingR', parent: 'torso', at: [-0.08, 0.06, 0] },
      { name: 'legL', parent: 'torso', at: [0.06, -0.2, 0] },
      { name: 'legR', parent: 'torso', at: [-0.06, -0.2, 0] },
      { name: 'tail', parent: 'torso', at: [0, -0.08, -0.14] },
    ],
    core: ['torso', 'head'],
    strike: ['head', 'legL', 'legR'],
    anim: { hover: 1.3, flap: 3, swing: 0.7 },
    prepare: function (fig) { fig.hip = fig.rest[WJ.torso * 3 + 1]; },
    pose: function (fig, st, P) {
      const A = fig.anim, s = fig.scale * (st.scale > 0 ? st.scale : 1), t = st.t + st.seed * 5;
      const speed = st.speed / s, go = smooth(speed / 3);
      const beat = TAU * A.flap * (1 + 0.35 * go) * t, flap = sin(beat);
      P[WJ.root * 6 + 4] = A.hover - fig.hip + 0.07 * sin(beat + 1.4) + 0.05 * sin(t * 0.8);
      const lean = 0.3 * go;
      P[WJ.torso * 6] = lean;
      P[WJ.head * 6] = -lean * 0.8 + 0.08 * sin(beat + 0.5);
      P[WJ.wingL * 6 + 2] = A.swing * flap + 0.1;
      P[WJ.wingR * 6 + 2] = -A.swing * flap - 0.1;
      P[WJ.wingL * 6 + 1] = 0.12 * cos(beat);
      P[WJ.wingR * 6 + 1] = -0.12 * cos(beat);
      P[WJ.legL * 6] = -lean + 0.25 * go;
      P[WJ.legR * 6] = -lean + 0.25 * go;
      P[WJ.tail * 6] = -0.2 - 0.15 * go + 0.05 * sin(beat);
      const act = st.act;
      if (act === WINDUP || act === STRIKE) {
        const k = actK(st);
        let drawn = 0, blow = 0;
        if (act === WINDUP) drawn = smooth(k);
        else if (k < 0.35) { const e = easeOut3(k / 0.35); drawn = 1 - e; blow = e; } else blow = 1 - smooth((k - 0.35) / 0.65);
        P[WJ.root * 6 + 4] += 0.35 * drawn - 0.45 * blow;
        P[WJ.root * 6 + 5] += -0.15 * drawn + 0.45 * blow;
        P[WJ.torso * 6] += -0.3 * drawn + 0.55 * blow;
        P[WJ.wingL * 6 + 2] += 0.6 * drawn - 0.4 * blow;
        P[WJ.wingR * 6 + 2] += -0.6 * drawn + 0.4 * blow;
      }
      const f = flinch(st.hurt);
      if (f > 0) {
        P[WJ.torso * 6 + 2] += 0.5 * f;
        P[WJ.root * 6 + 4] += 0.1 * f;
        P[WJ.root * 6 + 5] += -0.12 * f;
      }
      if (st.dying) {
        const k = clamp01(st.die / FALL), e = k * k;
        P[WJ.root * 6 + 4] -= (A.hover - 0.15) * e;
        P[WJ.torso * 6 + 2] += 1.3 * e;
        P[WJ.wingL * 6 + 2] = P[WJ.wingL * 6 + 2] * (1 - e) - 0.2 * e;
        P[WJ.wingR * 6 + 2] = P[WJ.wingR * 6 + 2] * (1 - e) + 1.0 * e;
      }
    },
  });

  // ---- serpent ----
  // Each segment takes the place on the path that the head had a little earlier: the wave stands still on the
  // ground, so the body follows the head without sliding.
  const SEGMENTS = 8;
  Rigs.register('serpent', {
    joints: [
      { name: 'root', parent: null, at: [0, 0, 0] },
      { name: 's0', parent: 'root', at: [0, 0.14, 0.3] },
      { name: 's1', parent: 'root', at: [0, 0.12, 0] },
      { name: 's2', parent: 'root', at: [0, 0.11, -0.3] },
      { name: 's3', parent: 'root', at: [0, 0.1, -0.6] },
      { name: 's4', parent: 'root', at: [0, 0.09, -0.9] },
      { name: 's5', parent: 'root', at: [0, 0.08, -1.2] },
      { name: 's6', parent: 'root', at: [0, 0.07, -1.5] },
      { name: 's7', parent: 'root', at: [0, 0.06, -1.8] },
    ],
    core: ['s0', 's1'],
    strike: ['s0'],
    anim: { stride: 1.8, swing: 0.16 },
    pose: function (fig, st, P) {
      const A = fig.anim, s = fig.scale * (st.scale > 0 ? st.scale : 1), t = st.t + st.seed * 9;
      const lambda = A.stride, amp = A.swing, head = fig.rest[1 * 3 + 2];
      const along = st.walk / s + 0.12 * sin(t * 0.7);
      for (let i = 0; i < SEGMENTS; i++) {
        const j = 1 + i, behind = head - fig.rest[j * 3 + 2], env = 0.3 + 0.7 * smooth(behind / 0.7);
        const phase = TAU * (along - behind) / lambda;
        P[j * 6 + 3] = amp * env * sin(phase);
        P[j * 6 + 1] = atan(amp * env * TAU / lambda * cos(phase));
      }
      P[1 * 6 + 4] = 0.03 + 0.015 * sin(t * 1.4);
      const act = st.act;
      if (act === WINDUP || act === STRIKE) {
        const k = actK(st);
        let drawn = 0, blow = 0;
        if (act === WINDUP) drawn = smooth(k);
        else if (k < 0.3) { const e = easeOut3(k / 0.3); drawn = 1 - e; blow = e; } else blow = 1 - smooth((k - 0.3) / 0.7);
        P[1 * 6 + 4] += 0.38 * drawn + 0.06 * blow;
        P[1 * 6 + 5] += -0.22 * drawn + 0.5 * blow;
        P[1 * 6] += -0.45 * drawn + 0.25 * blow;
        P[2 * 6 + 4] += 0.2 * drawn;
        P[2 * 6 + 5] += -0.1 * drawn + 0.25 * blow;
        P[3 * 6 + 4] += 0.07 * drawn;
      }
      const f = flinch(st.hurt);
      if (f > 0) {
        P[1 * 6] += -0.35 * f;
        P[1 * 6 + 4] += 0.1 * f;
        for (let i = 2; i < 5; i++) P[i * 6 + 3] += 0.08 * f * (i % 2 === 0 ? 1 : -1);
      }
      if (st.dying) {
        const e = smooth(st.die / FALL);
        for (let i = 0; i < SEGMENTS; i++) P[(1 + i) * 6 + 2] += 0.9 * e * (i % 2 === 0 ? 1 : -1);
        P[1 * 6] += 0.3 * e;
      }
    },
  });

  // ---- static ----
  Rigs.register('static', {
    joints: [{ name: 'root', parent: null, at: [0, 0, 0] }],
    core: ['root'],
    anim: {},
    pose: function (fig, st, P) {
      const f = flinch(st.hurt);
      if (f > 0) P[2] = 0.03 * f * sin(st.t * 40);
      if (st.dying) P[2] += 0.25 * smooth(st.die / FALL);
    },
  });
})();
