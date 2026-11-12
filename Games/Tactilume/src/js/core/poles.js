// Turns touches into the "poles" the simulation feels.
//
// A pole is one point of force on the plane z = 0, in world units: y runs -1..1 up
// the screen, x runs -aspect..aspect. Touches, pinned touches and autoplay all make
// poles; this module adds the copies that symmetry and one-finger chords ask for.

export const MAX_POLES = 32;

// Pole fields: { x, y, vx, vy, power, age, held, id, kind }
//   power  0..2   how strong (pressure or contact size, 1 for a mouse)
//   age    s      since it went down (drives rings and bursts)
//   held   bool   still pressed (false while a released pole fades out)
//   kind   'touch' | 'pin' | 'auto' | 'virtual' | 'mirror'

// One touch played as `n` fingers: a small constellation that turns slowly around it.
// The touch itself keeps its id (sound and the engine's smoothing follow it by id).
export function constellation(pole, n, time, radius = 0.16) {
  if (n <= 1) return [pole];
  const out = [];
  const spin = time * 0.35;
  for (let i = 0; i < n; i++) {
    const a = spin + (i / n) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    out.push({
      ...pole,
      x: pole.x + ca * radius,
      y: pole.y + sa * radius,
      // the constellation turns, so its points also move
      vx: pole.vx - sa * radius * 0.35,
      vy: pole.vy + ca * radius * 0.35,
      id: i === 0 ? pole.id : `${pole.id}:v${i}`,
      kind: i === 0 ? pole.kind : 'virtual',
    });
  }
  return out;
}

// How to copy `count` points for an n-fold symmetry (and mirror) within `max` points.
// Uses the largest divisor m of n that fits, so the copies stay evenly spaced (6-fold
// drops to 3-fold, never to a lopsided 5 of 6). If not even one rotation each fits
// with the mirror, the mirror goes first.
export function symmetryPlan(count, symmetry, mirror, max) {
  const n = Math.max(1, symmetry | 0);
  for (const mir of mirror ? [true, false] : [false]) {
    const per = mir ? 2 : 1;
    for (let m = n; m >= 1; m--) {
      if (n % m === 0 && count * m * per <= max) return { n, step: n / m, mirror: mir };
    }
  }
  return { n, step: n, mirror: false };
}

// Rotational copies around the centre (every `step`-th of n), and their reflections
// when `mirror` is on.
export function symmetrise(poles, symmetry, mirror, step = 1) {
  const n = Math.max(1, symmetry | 0);
  if (n === 1 && !mirror) return poles;
  const out = [];
  for (const p of poles) {
    for (let k = 0; k < n; k += Math.max(1, step)) {
      const a = (k / n) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const rot = (x, y) => [x * ca - y * sa, x * sa + y * ca];
      const [x, y] = rot(p.x, p.y);
      const [vx, vy] = rot(p.vx, p.vy);
      out.push(k === 0 ? p : { ...p, x, y, vx, vy, id: `${p.id}:s${k}`, kind: 'mirror' });
      if (mirror) {
        // reflect across the copy's own axis: (x, -y) rotated
        const [mx, my] = rot(p.x, -p.y);
        const [mvx, mvy] = rot(p.vx, -p.vy);
        out.push({ ...p, x: mx, y: my, vx: mvx, vy: mvy, id: `${p.id}:m${k}`, kind: 'mirror' });
      }
    }
  }
  return out;
}

// Everything the engine gets this frame, never more than MAX_POLES. Every touch keeps
// its place; when the copies would not all fit, each touch gets the same evenly spaced
// subset of its pattern, so the kaleidoscope never comes out lopsided.
export function expandPoles(poles, { symmetry = 1, mirror = false, virtualFingers = 0, time = 0 } = {}) {
  let list = poles;
  if (virtualFingers > 1) {
    // the chord forms around the one touch being held (an earlier one may still be fading)
    const held = poles.filter((p) => p.held && p.kind !== 'mirror' && p.kind !== 'virtual');
    const lead = held.length === 1 ? held[0] : held.length === 0 && poles.length === 1 ? poles[0] : null;
    if (lead) list = constellation(lead, virtualFingers, time).concat(poles.filter((p) => p !== lead));
  }
  if (list.length > MAX_POLES) list = list.slice(0, MAX_POLES);
  const plan = symmetryPlan(list.length, symmetry, mirror, MAX_POLES);
  return symmetrise(list, plan.n, plan.mirror, plan.step);
}

// How many fingers the behaviour table should see.
export function fingerCount(poles, virtualFingers = 0) {
  const held = poles.filter((p) => p.held && p.kind !== 'mirror' && p.kind !== 'virtual').length;
  if (virtualFingers > 1 && held === 1) return virtualFingers;
  return held;
}
