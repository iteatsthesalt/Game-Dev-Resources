// What the light feels from the players, worked out on the CPU each frame: the poles (with
// their symmetric copies, faded in and out by id), the rings where touches land, and the
// release of a gathered nova. Pure, so it is unit-tested (tests/unit/engine-touch.test.js);
// engine.js copies the result into the frame uniforms.
//
// A port of updatePoles, updateEvents, symmetric, pulse and release in the mobile edition's
// gfx/engine.js. Two things are the desktop's own:
//   - Symmetry is applied here. On mobile, main.js copied the touches before the engine saw
//     them; on the desktop the engine receives the input hub's poles as they are.
//   - Poles belong to players, and carry their player's colour for team colours.

import { symmetryPlan, symmetrise } from '../../../../Tactilume/src/js/core/poles.js';
import { clamp, approach } from '../../../../Tactilume/src/js/core/util.js';

export const MAX_POLES = 64;
export const MAX_PULSES = 8;
export const MAX_RELEASES = 4;
export const POLE_FLOATS = 12;          // place, motion, team: three vec4f (see common.wgsl)
const PULSE_SECONDS = 1.6;
const RELEASE_SECONDS = 1.2;

const finite = (x) => typeof x === 'number' && Number.isFinite(x);

export function stringHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// sRGB 0..1 (as players' colours are given) → linear light, which the shaders add up
export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function createTouch() {
  const poleState = new Map();   // key → { pole, w }
  const pulses = [];             // { x, y, power, age, color: [r, g, b] linear | null }
  const releases = [];           // { x, y, charge, age }
  let touch = 0;                 // how much anyone is touching (0..1), smoothed
  let engage = 0;                // the same, but it lets go slowly
  let symmetry = 1;
  let mirror = false;

  const poles = new Float32Array(MAX_POLES * POLE_FLOATS);
  const pulseData = new Float32Array(MAX_PULSES * 4);
  const pulseColors = new Float32Array(MAX_PULSES * 4);
  const releaseData = new Float32Array(MAX_RELEASES * 4);
  let count = 0;

  // copies of a point for the scene's symmetry, at most `max`, evenly spaced (as the poles)
  function symmetric(x, y, max) {
    const plan = symmetryPlan(1, symmetry, mirror, max);
    const out = [];
    for (let k = 0; k < plan.n; k += plan.step) {
      const a = (k / plan.n) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      out.push([x * c - y * sn, x * sn + y * c]);
      if (plan.mirror) out.push([x * c + y * sn, x * sn - y * c]);
    }
    return out;
  }

  // The poles of this frame, with their symmetric copies: at most MAX_POLES. Every pole
  // keeps its place in the list; when the copies would not all fit, each pole gets the same
  // evenly spaced subset of its pattern, as on mobile (core/poles.js).
  function expand(input) {
    // two players may use the same pole ids, so the smoothing goes by player and id
    let list = input.slice(0, MAX_POLES).map((p) => ({ ...p, id: `${p.player ?? 0}/${p.id ?? ''}` }));
    const plan = symmetryPlan(list.length, symmetry, mirror, MAX_POLES);
    list = symmetrise(list, plan.n, plan.mirror, plan.step);
    return list.slice(0, MAX_POLES);
  }

  return {
    poles, pulseData, pulseColors, releaseData,
    get count() { return count; },
    get touch() { return touch; },
    get engage() { return engage; },
    get size() { return poleState.size; },

    // input: the hub's poles ({ x, y, vx, vy, power, age, held, id, player }).
    // colors: Map of player id → linear [r, g, b], for the players whose colours show (empty
    // when team colours are off). Smooths touch weights so forces come in and go out
    // softly, and keeps lifted poles fading at their last place.
    update(input, dt, scene, colors = new Map()) {
      symmetry = Math.max(1, (scene && scene.symmetry) | 0);
      mirror = !!(scene && scene.mirror);
      const now = expand(Array.isArray(input) ? input.filter((p) => p && finite(p.x) && finite(p.y)) : []);
      const order = new Map(now.map((p, i) => [p.id, i]));
      for (const p of now) {
        let st = poleState.get(p.id);
        if (!st) { st = { pole: p, w: 0 }; poleState.set(p.id, st); }
        st.pole = p;
      }
      for (const [id, st] of poleState) {
        const present = order.has(id);
        const power = finite(st.pole.power) ? st.pole.power : 1;
        const target = present && st.pole.held ? clamp(power, 0.15, 2) : 0;
        st.w += (target - st.w) * approach(dt, target > st.w ? 0.045 : 0.14);
        if (!present) st.pole = { ...st.pole, held: false, age: (finite(st.pole.age) ? st.pole.age : 0) + dt };
        if (!present && st.w < 0.01) poleState.delete(id);
      }
      // the strongest poles, in their input order (it shapes rivers and threads); poles that
      // have just been lifted come first, as on mobile
      const list = [...poleState.entries()].sort((a, b) => b[1].w - a[1].w).slice(0, MAX_POLES);
      list.sort((a, b) => (order.get(a[0]) ?? -1) - (order.get(b[0]) ?? -1));
      poles.fill(0);
      let total = 0;
      list.forEach(([id, st], i) => {
        const p = st.pole;
        const root = id.split(':')[0];
        let spin = (stringHash(root) & 1) ? 1 : -1;
        if (/:m\d/.test(id)) spin = -spin;
        const color = colors.get(p.player);
        const o = i * POLE_FLOATS;
        poles.set([p.x, p.y, st.w, finite(p.age) ? p.age : 0], o);
        poles.set([finite(p.vx) ? p.vx : 0, finite(p.vy) ? p.vy : 0, clamp(finite(p.power) ? p.power : 1, 0, 2), spin], o + 4);
        if (color) poles.set([color[0], color[1], color[2], 1], o + 8);
        if (p.held) total += st.w;
      });
      count = list.length;
      const held = Math.min(1, total);
      touch += (held - touch) * approach(dt, 0.15);
      engage += (held - engage) * approach(dt, held > engage ? 0.1 : 2.5);

      for (const e of pulses) e.age += dt;
      for (const e of releases) e.age += dt;
      while (pulses.length && pulses[0].age > PULSE_SECONDS) pulses.shift();
      while (releases.length && releases[0].age > RELEASE_SECONDS) releases.shift();
      pulseColors.fill(0);
      for (let i = 0; i < MAX_PULSES; i++) {
        const e = pulses[i];
        pulseData.set(e ? [e.x, e.y, e.power, e.age] : [0, 0, 0, 99], i * 4);
        if (e && e.color) pulseColors.set([...e.color, 1], i * 4);
      }
      releaseData.fill(0);
      releases.forEach((e, i) => releaseData.set([e.x, e.y, e.charge, e.age], i * 4));
      return count;
    },

    // A ring of light where a touch lands (world units), with the scene's symmetric copies.
    // `color` is the player's colour (sRGB 0..1), shown along the ring with team colours.
    pulse(x, y, power = 1, color = null) {
      if (!finite(x) || !finite(y)) return;
      const tint = Array.isArray(color) && color.length >= 3 && color.every(finite) ? color.slice(0, 3).map((c) => srgbToLinear(clamp(c, 0, 1))) : null;
      for (const [px, py] of symmetric(x, y, MAX_PULSES)) {
        pulses.push({ x: px, y: py, power: clamp(finite(power) ? power : 1, 0.2, 2), age: 0, color: tint });
        if (pulses.length > MAX_PULSES) pulses.shift();
      }
    },

    // A touch was lifted. Only a nova (the behaviour in the lead) lets go of its light.
    release(x, y, power = 1, heldFor = 0, lead = '') {
      if (lead !== 'nova' || !finite(x) || !finite(y)) return;
      const charge = clamp((finite(heldFor) ? heldFor : 0) / 1.5, 0.25, 1.6) * clamp(finite(power) ? power : 1, 0.4, 1.5);
      for (const [px, py] of symmetric(x, y, MAX_RELEASES)) {
        releases.push({ x: px, y: py, charge, age: 0 });
        if (releases.length > MAX_RELEASES) releases.shift();
      }
    },

    reset() {
      poleState.clear();
      pulses.length = 0;
      releases.length = 0;
      touch = 0;
      engage = 0;
    },
  };
}
