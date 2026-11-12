// Small pure helpers shared by every module. No DOM, no GL.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// How far to move toward a target this frame so that the motion looks the same
// at any frame rate: `tau` is the time, in seconds, to cover about 63% of the gap.
export const approach = (dt, tau) => (tau <= 0 ? 1 : 1 - Math.exp(-dt / tau));

// Maps t in 0..1 onto lo..hi so that equal steps of t multiply the value equally.
export const lerpLog = (lo, hi, t) => lo * Math.pow(hi / lo, clamp(t, 0, 1));

// Deterministic random numbers in 0..1 from a seed; the same seed gives the same sequence.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A tiny event hub: on(name, fn) returns a function that removes the listener.
export function createEmitter() {
  const map = new Map();
  return {
    on(name, fn) {
      if (!map.has(name)) map.set(name, new Set());
      map.get(name).add(fn);
      return () => map.get(name).delete(fn);
    },
    emit(name, ...args) {
      const set = map.get(name);
      if (!set) return;
      for (const fn of [...set]) fn(...args);
    },
  };
}
