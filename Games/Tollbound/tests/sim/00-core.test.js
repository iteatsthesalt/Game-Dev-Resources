// tests/sim/00-core.test.js: the small tools every simulation file stands on (src/js/00-core.js).
// The pinned numbers in "never change" tests are what the first version produced. They must stay: seeds,
// checksums and the reference runs for a port all depend on them. If one of these tests fails, the hash or
// the generator has changed, and every seeded run with it.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');

const { Core } = loadSim();
const PI = Math.PI;
const take = (rng, n) => Array.from({ length: n }, () => rng.u32());
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);

test('the step is a sixtieth of a second', () => {
  assert.equal(Core.HZ, 60);
  assert.equal(Core.DT, 1 / 60);
  assert.equal(Core.TAU, PI * 2);
});

test('clamp, lerp, sign, mod, approach and distance', () => {
  assert.equal(Core.clamp(5, 0, 3), 3);
  assert.equal(Core.clamp(-5, 0, 3), 0);
  assert.equal(Core.clamp(2, 0, 3), 2);
  assert.equal(Core.lerp(10, 20, 0), 10);
  assert.equal(Core.lerp(10, 20, 1), 20);
  assert.equal(Core.lerp(10, 20, 0.25), 12.5);
  assert.deepEqual([Core.sign(-2.5), Core.sign(0), Core.sign(7)], [-1, 0, 1]);
  assert.ok(Object.is(Core.sign(-0), 0), 'sign(-0) is plain 0');
  assert.ok(Object.is(Core.sign(NaN), 0), 'sign(NaN) is 0');
  assert.equal(Core.mod(7, 5), 2);
  assert.equal(Core.mod(-1, 5), 4);
  assert.equal(Core.mod(-5, 5), 0);
  near(Core.mod(-0.25, 1), 0.75);
  assert.equal(Core.approach(0, 10, 3), 3);
  assert.equal(Core.approach(9, 10, 3), 10);
  assert.equal(Core.approach(10, 0, 3), 7);
  assert.equal(Core.approach(1, 0, 3), 0);
  assert.equal(Core.approach(4, 4, 3), 4);
  assert.equal(Core.dist2(1, 2, 4, 6), 25);
  assert.equal(Core.dist(1, 2, 4, 6), 5);
});

test('angles wrap into -PI..PI and keep their direction', () => {
  assert.equal(Core.angleWrap(0), 0);
  assert.equal(Core.angleWrap(PI), PI);
  assert.equal(Core.angleWrap(-PI), PI);
  near(Core.angleWrap(2 * PI + 0.5), 0.5);
  near(Core.angleWrap(-2 * PI - 0.5), -0.5);
  for (let a = -40; a <= 40; a += 0.37) {
    const w = Core.angleWrap(a);
    assert.ok(w > -PI && w <= PI, `wrap(${a}) = ${w}`);
    near(Math.sin(w), Math.sin(a), 1e-9);
    near(Math.cos(w), Math.cos(a), 1e-9);
  }
});

test('angles differ and turn the short way round', () => {
  near(Core.angleDiff(0.1, 0.3), 0.2);
  near(Core.angleDiff(0.3, 0.1), -0.2);
  near(Core.angleDiff(3, -3), 2 * PI - 6);        // across the seam, the short way is forward
  near(Core.angleDiff(-3, 3), 6 - 2 * PI);
  near(Core.angleDiff(0, 7 * PI), PI);
  near(Core.angleToward(0, 1, 0.25), 0.25);
  near(Core.angleToward(0, -1, 0.25), -0.25);
  near(Core.angleToward(0, 0.1, 0.25), 0.1);      // never past the target
  near(Core.angleToward(3, -3, 0.1), 3.1);
  near(Core.angleToward(3.1, -3.1, 0.2), -3.1);   // reaches a target on the other side of the seam
  let a = 2.5;
  for (let i = 0; i < 200; i++) a = Core.angleToward(a, -2.5, 0.05);
  near(a, -2.5);
});

test('hashes never change', () => {
  assert.deepEqual(['', 'a', 'tollbound', 'spawn'].map((s) => Core.hashStr(s)), [4241522095, 3076282252, 615592908, 3558583203]);
  let h = 0;
  for (const v of [1, 2, 3, -1, 0.5, 1e21, -0, NaN, 4294967295]) h = Core.hashMix(h, v);
  assert.equal(h, 617178051);
});

test('hashes are whole numbers of 32 bits and tell their inputs apart', () => {
  const seen = new Set();
  let h = 0;
  for (let i = 0; i < 20000; i++) {
    h = Core.hashMix(h, i * 0.61 - 300);
    assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xffffffff);
    seen.add(h);
  }
  assert.ok(seen.size > 19990, 'a running hash should hardly ever repeat');
  assert.notEqual(Core.hashMix(0, 1), Core.hashMix(1, 0));
  assert.notEqual(Core.hashMix(Core.hashMix(0, 1), 2), Core.hashMix(Core.hashMix(0, 2), 1), 'order matters');
  assert.notEqual(Core.hashMix(0, 1), Core.hashMix(0, 1.0000000000000002), 'the smallest difference counts');
  assert.equal(Core.hashMix(7, 0), Core.hashMix(7, -0), '-0 counts as 0');
  assert.equal(Core.hashMix(7, NaN), Core.hashMix(7, 0 / 0));
  assert.equal(Core.hashMix(7, true), Core.hashMix(7, 1), 'a flag counts as 1 or 0');
  const names = new Set(Array.from({ length: 5000 }, (unused, i) => Core.hashStr('enemy.' + i)));
  assert.equal(names.size, 5000, 'near names get different hashes');
  assert.equal(Core.hashStr(42), Core.hashStr('42'));
});

test('the stream for a seed never changes', () => {
  assert.deepEqual(take(new Core.RNG(0), 4), [1385660558, 960772575, 3694756195, 3886061389]);
  assert.deepEqual(take(new Core.RNG(1), 4), [720283492, 1275430242, 3853878868, 1446131613]);
  assert.deepEqual(take(new Core.RNG('tollbound'), 4), [3846664309, 1870649443, 4126792816, 990317852]);
  const root = new Core.RNG(20261112);
  assert.deepEqual(plain(root.getState()), [2611405292, 3798131486, 2105772608, 16]);
  assert.deepEqual(take(root.fork('loot'), 3), [3393796284, 3237454989, 1955948526]);
  assert.deepEqual(take(root.fork('spawn'), 3), [1293864132, 3728435860, 267063887]);
  assert.deepEqual(take(root.fork(7), 3), [1463989146, 3657104718, 1757482032]);
});

test('the same seed gives the same stream, another seed another', () => {
  assert.deepEqual(take(new Core.RNG(123456), 200), take(new Core.RNG(123456), 200));
  assert.deepEqual(take(new Core.RNG('vigil'), 200), take(new Core.RNG('vigil'), 200));
  assert.notDeepEqual(take(new Core.RNG(1), 8), take(new Core.RNG(2), 8));
  assert.notDeepEqual(take(new Core.RNG('a'), 8), take(new Core.RNG('b'), 8));
  assert.deepEqual(take(new Core.RNG(5), 8), take(new Core.RNG(5 + 2 ** 32), 8), 'only the low 32 bits of a number count');
  const firsts = new Set(Array.from({ length: 2000 }, (unused, seed) => new Core.RNG(seed).u32()));
  assert.ok(firsts.size >= 1999, 'near seeds start far apart');
  assert.throws(() => new Core.RNG(), /seed/);
  assert.throws(() => new Core.RNG(NaN), /seed/);
});

test('next stays in [0, 1) and is spread evenly', () => {
  const rng = new Core.RNG(99), N = 200000, buckets = new Array(10).fill(0);
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const v = rng.next();
    assert.ok(v >= 0 && v < 1, `next() gave ${v}`);
    sum += v;
    buckets[Math.floor(v * 10)]++;
  }
  near(sum / N, 0.5, 0.005);
  for (const count of buckets) near(count / N, 0.1, 0.004);
});

test('range and int keep their bounds', () => {
  const rng = new Core.RNG(7);
  for (const [a, b] of [[0, 1], [-5, 5], [10, 10.001], [1e6, 1e6 + 1], [-1, -0.5], [0, 1e-9]]) {
    for (let i = 0; i < 5000; i++) {
      const v = rng.range(a, b);
      assert.ok(v >= a && v < b, `range(${a}, ${b}) gave ${v}`);
    }
  }
  assert.equal(rng.range(3, 3), 3);
  for (const [a, b] of [[0, 0], [1, 6], [-3, 3], [0, 255], [1000, 1001]]) {
    const seen = new Set();
    for (let i = 0; i < 20000; i++) {
      const v = rng.int(a, b);
      assert.ok(Number.isInteger(v) && v >= a && v <= b, `int(${a}, ${b}) gave ${v}`);
      seen.add(v);
    }
    assert.equal(seen.size, b - a + 1, `int(${a}, ${b}) reaches both ends and everything between`);
  }
});

test('chance follows its probability', () => {
  const rng = new Core.RNG(11);
  let hits = 0;
  for (let i = 0; i < 100000; i++) {
    assert.equal(rng.chance(0), false);
    assert.equal(rng.chance(1), true);
    if (rng.chance(0.3)) hits++;
  }
  near(hits / 100000, 0.3, 0.005);
});

test('pick takes one element, of the first n if asked', () => {
  const rng = new Core.RNG(3), list = ['a', 'b', 'c', 'd'], seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(rng.pick(list));
  assert.deepEqual([...seen].sort(), list);
  for (let i = 0; i < 400; i++) assert.ok(['a', 'b'].includes(rng.pick(list, 2)));
  assert.equal(rng.pick([]), undefined);
  assert.equal(rng.pick(list, 0), undefined, 'nothing is picked from a stale array');
});

test('weighted follows the weights', () => {
  const rng = new Core.RNG(21);
  const pool = [{ id: 'often', w: 6 }, { id: 'never', w: 0 }, { id: 'seldom', w: 2 }, { id: 'bad', w: -4 }, { id: 'odd' }];
  const count = { often: 0, never: 0, seldom: 0, bad: 0, odd: 0 };
  for (let i = 0; i < 40000; i++) count[rng.weighted(pool).id]++;
  near(count.often / 40000, 0.75, 0.01);
  near(count.seldom / 40000, 0.25, 0.01);
  assert.equal(count.never + count.bad + count.odd, 0, 'no weight, no win');
  const byName = [{ id: 'x', weight: 1 }, { id: 'y', weight: 3 }];
  let y = 0;
  for (let i = 0; i < 20000; i++) if (rng.weighted(byName, 'weight').id === 'y') y++;
  near(y / 20000, 0.75, 0.015);
  y = 0;
  for (let i = 0; i < 20000; i++) if (rng.weighted(byName, (item) => (item.id === 'y' ? 1 : 0)).id === 'y') y++;
  assert.equal(y, 20000, 'the key may be a function');
  for (let i = 0; i < 200; i++) assert.equal(rng.weighted(pool, 'w', 1).id, 'often', 'only the first n count');
  assert.equal(rng.weighted([]), undefined);
  assert.equal(rng.weighted([{ w: 0 }, { w: -1 }]), undefined);
});

test('shuffle keeps every element and depends only on the seed', () => {
  const sorted = Array.from({ length: 50 }, (unused, i) => i);
  const a = new Core.RNG(8).shuffle(sorted.slice()), b = new Core.RNG(8).shuffle(sorted.slice());
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, sorted);
  assert.deepEqual(a.slice().sort((x, y) => x - y), sorted);
  const part = new Core.RNG(8).shuffle(sorted.slice(), 10);
  assert.deepEqual(part.slice(10), sorted.slice(10), 'past the first n nothing moves');
  assert.deepEqual(part.slice(0, 10).sort((x, y) => x - y), sorted.slice(0, 10));
  const firstPlace = new Array(4).fill(0), rng = new Core.RNG(9);
  for (let i = 0; i < 20000; i++) firstPlace[rng.shuffle([0, 1, 2, 3])[0]]++;
  for (const n of firstPlace) near(n / 20000, 0.25, 0.012);
});

test('every draw takes exactly one number from the stream', () => {
  const draws = [
    (r) => r.next(), (r) => r.u32(), (r) => r.range(2, 9), (r) => r.int(1, 6), (r) => r.chance(0.5),
    (r) => r.pick([1, 2, 3]), (r) => r.pick([]), (r) => r.weighted([{ w: 1 }, { w: 2 }]), (r) => r.weighted([]),
  ];
  for (const draw of draws) {
    const used = new Core.RNG(77), twin = new Core.RNG(77);
    draw(used);
    twin.next();
    assert.deepEqual(plain(used.getState()), plain(twin.getState()), String(draw));
  }
});

test('a fork is a stream of its own and leaves its parent alone', () => {
  const parent = new Core.RNG(2026), twin = new Core.RNG(2026);
  const before = plain(parent.getState());
  const loot = parent.fork('loot'), spawn = parent.fork('spawn');
  assert.deepEqual(plain(parent.getState()), before, 'forking does not advance the parent');
  const lootStart = plain(loot.getState());
  take(spawn, 100);
  assert.deepEqual(plain(parent.getState()), before, 'drawing from a fork does not advance the parent');
  assert.deepEqual(take(parent, 50), take(twin, 50), 'the parent goes on as if it had never forked');
  assert.deepEqual(plain(loot.getState()), lootStart, 'draws from the parent and from a sibling do not move a fork');

  const again = new Core.RNG(2026);
  assert.deepEqual(take(again.fork('loot'), 50), take(loot, 50), 'the same state and label give the same fork');
  const a = take(again.fork('a'), 16), b = take(again.fork('b'), 16), self = take(new Core.RNG(2026), 16);
  assert.notDeepEqual(a, b, 'another label, another stream');
  assert.notDeepEqual(a, self, 'a fork is not a copy of its parent');
  assert.notDeepEqual(take(again.fork('a').fork('a'), 16), a, 'a fork of a fork is another stream again');
  again.next();
  assert.notDeepEqual(take(again.fork('a'), 16), a, 'a fork comes from the state its parent is in');
});

test('sibling forks do not follow each other', () => {
  const root = new Core.RNG('independence');
  const names = ['spawn', 'loot', 'combat', 'offers', 'world'];
  const N = 40000, runs = names.map((name) => { const r = root.fork(name); return Array.from({ length: N }, () => r.next()); });
  runs.push(Array.from({ length: N }, () => root.next()));   // the parent itself is one more stream
  // how far x, read lag draws later, moves together with y: 0 for unrelated streams, 1 for the same stream
  const correlation = (x, y, lag) => {
    const n = N - lag;
    let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      const a = x[i + lag], b = y[i];
      sx += a; sy += b; sxy += a * b; sxx += a * a; syy += b * b;
    }
    return (sxy / n - (sx / n) * (sy / n)) / Math.sqrt((sxx / n - (sx / n) ** 2) * (syy / n - (sy / n) ** 2));
  };
  for (let i = 0; i < runs.length; i++) {
    for (let j = 0; j < runs.length; j++) {
      for (const lag of i < j ? [0, 1, 2, 3] : i > j ? [1, 2, 3] : []) {
        const r = correlation(runs[i], runs[j], lag);
        assert.ok(Math.abs(r) < 0.02, `stream ${i}, ${lag} draws later, moves with stream ${j} (r = ${r})`);
      }
    }
  }
  const seen = new Set(runs[0]);
  assert.ok(runs[1].filter((v) => seen.has(v)).length <= 2, 'two forks share next to no values');
});

test('the state can be saved and put back', () => {
  const rng = new Core.RNG(31337);
  take(rng, 10);
  const state = rng.getState();
  assert.equal(state.length, 4);
  for (const word of state) assert.ok(Number.isInteger(word) && word >= 0 && word <= 0xffffffff);
  const expected = take(rng, 20);
  const restored = new Core.RNG(1).setState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(take(restored, 20), expected);
  assert.equal(rng.setState(state), rng, 'setState returns the stream');
  assert.throws(() => rng.setState([1, 2]), /getState/);

  const a = new Core.RNG(5), b = new Core.RNG(5);
  assert.equal(a.hash(0), b.hash(0), 'equal states give equal checksums');
  b.next();
  assert.notEqual(a.hash(0), b.hash(0), 'one draw changes the checksum');
  assert.notEqual(a.hash(0), a.hash(1), 'the checksum continues the running hash it is given');
});

test('assert throws its message only when the condition fails', () => {
  assert.doesNotThrow(() => Core.assert(1 === 1, 'never shown'));
  assert.doesNotThrow(() => Core.assert('text'));
  assert.throws(() => Core.assert(false, 'the gate is shut'), /the gate is shut/);
  assert.throws(() => Core.assert(0), /assertion failed/);
});

test('deepFreeze freezes all the way down', () => {
  const view = new Float32Array(2);
  const def = { id: 'x', tags: ['a', 'b'], nested: { list: [{ deep: 1 }] }, view, none: null };
  def.self = def;   // a loop must not hang it
  assert.equal(Core.deepFreeze(def), def);
  assert.ok(Object.isFrozen(def) && Object.isFrozen(def.tags) && Object.isFrozen(def.nested) && Object.isFrozen(def.nested.list[0]));
  assert.throws(() => { def.id = 'y'; }, TypeError);
  assert.throws(() => { def.nested.list[0].deep = 2; }, TypeError);
  assert.throws(() => { def.tags.push('c'); }, TypeError);
  view[0] = 3;
  assert.equal(view[0], 3, 'typed arrays stay writable');
  const shallow = Object.freeze({ inner: { n: 1 } });
  Core.deepFreeze(shallow);
  assert.ok(Object.isFrozen(shallow.inner), 'an object frozen only on the surface is finished');
  for (const v of [null, undefined, 5, 'text']) assert.equal(Core.deepFreeze(v), v);
});

test('seal freezes the namespaces it is given', () => {
  const a = { f() {} }, b = { n: 1 };
  Core.seal([a, b]);
  assert.ok(Object.isFrozen(a) && Object.isFrozen(b));
  assert.throws(() => { a.f = null; }, TypeError);
  assert.throws(() => { b.extra = 1; }, TypeError);
  assert.throws(() => Core.seal(), /list/);
});

test('a booted simulation is sealed', () => {
  const sim = loadSim({ boot: true });
  for (const name of Object.keys(sim)) assert.ok(Object.isFrozen(sim[name]), `${name} is frozen`);
  assert.throws(() => { sim.Core.clamp = null; }, TypeError);
  assert.notEqual(sim.Core, Core, 'each load is a separate copy');
  assert.ok(!Object.isFrozen(Core), 'and leaves the others as they were');
});
