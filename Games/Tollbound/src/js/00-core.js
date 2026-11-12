// 00-core.js: the simulation namespaces, small maths, hashing and the seeded random stream.
// Owns: Core
// Public:
//   Core.HZ = 60, Core.DT = 1 / 60    simulation steps a second, and the length of one step in seconds
//   Core.TAU = 2 * PI
//   Core.clamp(v, lo, hi)             v held inside lo..hi
//   Core.lerp(a, b, t)                a at t = 0, b at t = 1
//   Core.sign(v) -> -1 | 0 | 1        0 for 0, -0 and NaN
//   Core.mod(a, n)                    remainder in 0..n (n > 0), also when a is negative
//   Core.approach(v, target, step)    v moved toward target by at most step (step >= 0), never past it
//   Core.dist2(ax, ay, bx, by)        squared distance; compare it with a squared radius
//   Core.dist(ax, ay, bx, by)
//   Core.angleWrap(a)                 the same direction, in -PI..PI
//   Core.angleDiff(from, to)          the shortest turn from one direction to the other, in -PI..PI
//   Core.angleToward(a, target, step) a turned toward target by at most step (step >= 0), in -PI..PI
//   Core.hashStr(text) -> uint32
//   Core.hashMix(h, number) -> uint32 one step of a running hash, for checksums: h = Core.hashMix(h, value).
//                                     Start from any number (0 will do). The order of the values matters.
//   new Core.RNG(seed)                a seeded random stream; seed is a number (its low 32 bits count) or a string
//     rng.next() -> [0, 1)            rng.u32() -> uint32
//     rng.range(a, b) -> [a, b)       rng.int(a, b) -> whole number in a..b, both ends included
//     rng.chance(p) -> boolean        true with probability p
//     rng.pick(array, n?)             one element of the first n (default: all); undefined if there is none
//     rng.weighted(items, key?, n?)   one item, in proportion to item[key] (default key 'w'); key may also be a
//                                     function (item) -> weight. Weights that are not above 0 never win.
//                                     undefined if nothing has weight.
//     rng.shuffle(array, n?) -> array shuffles the first n elements in place
//     rng.fork(label) -> RNG          an independent stream made from this stream's state and the label
//                                     (a string or a number). This stream does not advance.
//     rng.getState() -> [a, b, c, d]  four uint32, safe to store as JSON
//     rng.setState(state) -> rng      rng.hash(h) -> uint32, the state folded into a running hash
//     Every call above draws from the stream exactly once, except fork, getState, setState and hash (none)
//     and shuffle (one draw for each element but the first).
//   Core.assert(cond, message)        throws Error(message) when cond is falsy
//   Core.deepFreeze(obj) -> obj       freezes objects and arrays all the way down (typed arrays are left alone)
//   Core.seal(list)                   freezes each namespace object in the list. 99-boot.js seals every namespace:
//                                     after that a namespace cannot gain or change a property, so state that
//                                     changes lives in a closure or inside an object the namespace holds.
const Core = {}, Defs = {}, Stats = {}, Dmg = {}, Items = {}, Tree = {}, Char = {}, Progress = {}, Legacy = {},
  SaveData = {}, Sim = {}, Player = {}, Buffs = {}, AI = {}, Enemies = {}, Skills = {}, Boss = {}, Director = {},
  Offers = {}, Bot = {}, World = {};

(function () {
  'use strict';

  const PI = Math.PI, TAU = PI * 2;
  const imul = Math.imul, floor = Math.floor, sqrt = Math.sqrt;   // as locals: no global lookup in hot code

  Core.HZ = 60;
  Core.DT = 1 / 60;
  Core.TAU = TAU;

  // ---- maths ----

  Core.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  Core.lerp = function (a, b, t) { return a + (b - a) * t; };
  Core.sign = function (v) { return v > 0 ? 1 : v < 0 ? -1 : 0; };
  Core.mod = function (a, n) { return ((a % n) + n) % n; };
  Core.approach = function (v, target, step) {
    if (v < target) return v + step > target ? target : v + step;
    return v - step < target ? target : v - step;
  };
  Core.dist2 = function (ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
  Core.dist = function (ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return sqrt(dx * dx + dy * dy); };

  function angleWrap(a) {
    a %= TAU;
    return a > PI ? a - TAU : a <= -PI ? a + TAU : a;
  }
  Core.angleWrap = angleWrap;
  Core.angleDiff = function (from, to) { return angleWrap(to - from); };
  Core.angleToward = function (a, target, step) {
    const d = angleWrap(target - a);
    return angleWrap(d > step ? a + step : d < -step ? a - step : target);
  };

  // ---- hashing ----

  // Folds the 32 bits of k into h. For a fixed k every h gives a different result, and the other way round,
  // so two lists of whole numbers that differ in exactly one place always give different hashes.
  function fold(h, k) {
    h = imul(((h ^ imul(k, 0xcc9e2d51)) + 0x9e3779b9) | 0, 0x85ebca6b);
    h ^= h >>> 13;
    h = imul(h, 0xc2b2ae35);
    return h ^ (h >>> 16);
  }

  Core.hashStr = function (text) {
    text = String(text);
    let h = 0x811c9dc5 | 0;
    for (let i = 0; i < text.length; i++) h = imul(h ^ text.charCodeAt(i), 0x01000193);
    return fold(h, text.length) >>> 0;
  };

  // A number that is not a whole 32-bit value is hashed by the 64 bits that store it, low half first on any machine.
  const F64 = new Float64Array(1), U32 = new Uint32Array(F64.buffer);
  const LOW = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1 ? 0 : 1;

  function hashMix(h, n) {
    n = +n;
    if ((n | 0) === n) return fold(h, n) >>> 0;          // whole numbers; -0 counts as 0
    if (n !== n) return fold(h, 0x7ff80000) >>> 0;       // every NaN counts the same
    F64[0] = n;
    return fold(fold(h, U32[LOW]), U32[1 - LOW]) >>> 0;
  }
  Core.hashMix = hashMix;

  // ---- seeded random stream ----
  // The generator is sfc32: three words of state and a counter, fast, and good enough for any game purpose.

  // Sets the state from three words and runs the generator until they are well mixed.
  function fill(rng, a, b, c) {
    rng.a = a | 0; rng.b = b | 0; rng.c = c | 0; rng.d = 1;
    for (let i = 0; i < 15; i++) rng.u32();
    return rng;
  }

  function weightOf(item, key, byFn) {
    const w = byFn ? key(item) : item[key];
    return w > 0 ? w : 0;
  }

  function RNG(seed) {
    Core.assert(typeof seed === 'string' || (typeof seed === 'number' && seed === seed),
      'Core.RNG needs a number or a string as its seed');
    const s = typeof seed === 'string' ? Core.hashStr(seed) : seed >>> 0;
    fill(this, 0, s, hashMix(0x5eed, s));
  }

  RNG.prototype.u32 = function () {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (((this.c << 21) | (this.c >>> 11)) + t) | 0;
    return t >>> 0;
  };
  RNG.prototype.next = function () { return this.u32() / 4294967296; };
  RNG.prototype.range = function (a, b) { return a + (b - a) * this.next(); };
  RNG.prototype.int = function (a, b) { return a + floor(this.next() * (b - a + 1)); };
  RNG.prototype.chance = function (p) { return this.next() < p; };

  RNG.prototype.pick = function (array, n) {
    const len = n === undefined ? array.length : n, r = this.next();
    return len > 0 ? array[floor(r * len)] : undefined;
  };

  RNG.prototype.weighted = function (items, key, n) {
    const len = n === undefined ? items.length : n, byFn = typeof key === 'function';
    if (key === undefined) key = 'w';
    let total = 0, last;
    for (let i = 0; i < len; i++) total += weightOf(items[i], key, byFn);
    let r = this.next() * total;
    for (let i = 0; i < len; i++) {
      const w = weightOf(items[i], key, byFn);
      if (w <= 0) continue;
      last = items[i];
      r -= w;
      if (r < 0) return last;
    }
    return last;   // rounding left a sliver after the last weighted item, or nothing had weight
  };

  RNG.prototype.shuffle = function (array, n) {
    for (let i = (n === undefined ? array.length : n) - 1; i > 0; i--) {
      const j = floor(this.next() * (i + 1)), t = array[i];
      array[i] = array[j];
      array[j] = t;
    }
    return array;
  };

  RNG.prototype.hash = function (h) {
    return hashMix(hashMix(hashMix(hashMix(h, this.a), this.b), this.c), this.d);
  };

  RNG.prototype.fork = function (label) {
    const k = typeof label === 'number' ? hashMix(0x1abe1, label) : Core.hashStr(label);
    const a = this.hash(k), b = this.hash(a ^ 0x243f6a88), c = this.hash(b ^ 0x85a308d3);
    return fill(new RNG(0), a, b, c);
  };

  RNG.prototype.getState = function () { return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0]; };
  RNG.prototype.setState = function (state) {
    Core.assert(state && state.length === 4, 'rng.setState needs the four numbers getState gave');
    this.a = state[0] | 0; this.b = state[1] | 0; this.c = state[2] | 0; this.d = state[3] | 0;
    return this;
  };

  Core.RNG = RNG;

  // ---- checks and freezing ----

  Core.assert = function (cond, message) {
    if (!cond) throw new Error(message || 'assertion failed');
  };

  function freezeDown(obj, seen) {
    if (obj === null || typeof obj !== 'object' || ArrayBuffer.isView(obj) || seen.has(obj)) return;
    seen.add(obj);
    Object.freeze(obj);
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) freezeDown(obj[keys[i]], seen);
  }
  Core.deepFreeze = function (obj) {
    freezeDown(obj, new Set());
    return obj;
  };

  Core.seal = function (list) {
    Core.assert(Array.isArray(list), 'Core.seal needs the list of namespaces to freeze');
    for (let i = 0; i < list.length; i++) Object.freeze(list[i]);
  };
})();
