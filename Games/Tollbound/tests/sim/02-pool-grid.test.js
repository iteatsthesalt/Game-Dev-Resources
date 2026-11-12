// tests/sim/02-pool-grid.test.js: pools of reused objects and the grid that finds neighbours (src/js/02-pool-grid.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim } = require('./loader.js');

const { Core } = loadSim();
const make = () => ({ alive: false, x: 0, y: 0, r: 0.4, tag: 0 });
// The tags of the objects in use. Array.from, because an array that comes out of the simulation belongs to
// another context and deepEqual would call it different from one made here.
const names = (pool) => Array.from(pool.items.slice(0, pool.n), (o) => o.tag);

// ---- pool ----

test('a pool makes all its objects at once and hands them out one by one', () => {
  let made = 0;
  const pool = new Core.Pool(() => { made++; return make(); }, 4);
  assert.equal(made, 4, 'everything is made up front');
  assert.equal(pool.items.length, 4);
  assert.equal(pool.cap, 4);
  assert.equal(pool.n, 0);
  assert.ok(pool.items.every((o) => o.alive === false));
  const a = pool.alloc(), b = pool.alloc();
  assert.ok(a !== b && a.alive && b.alive);
  assert.equal(pool.n, 2);
  assert.equal(pool.items[0], a);
  assert.equal(pool.items[1], b, 'the newest is at items[n - 1]');
  pool.alloc();
  pool.alloc();
  assert.equal(pool.alloc(), null, 'a full pool gives null, never an error');
  assert.equal(pool.n, 4);
  assert.equal(made, 4, 'and nothing more was made');
});

test('kill marks, compact removes by swapping the last live object in', () => {
  const pool = new Core.Pool(make, 6);
  for (let i = 0; i < 5; i++) pool.alloc().tag = 'abcde'[i];
  const [a, b, c, d, e] = pool.items;
  pool.kill(b);
  pool.kill(d);
  assert.equal(pool.n, 5, 'the dead keep their place until the pool is compacted');
  assert.deepEqual(names(pool), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(b.alive, false);
  assert.equal(pool.compact(), 2, 'compact tells how many it removed');
  assert.equal(pool.n, 3);
  assert.deepEqual(names(pool), ['a', 'e', 'c']);
  assert.ok(pool.items.slice(0, 3).every((o) => o.alive) && pool.items.slice(3).every((o) => !o.alive));
  assert.deepEqual(new Set(pool.items), new Set([a, b, c, d, e, pool.items[5]]), 'no object is lost or doubled');
  assert.equal(pool.compact(), 0);
  const again = pool.alloc();
  assert.ok(again === b || again === d, 'a removed object is used again');
  assert.equal(again.alive, true);
});

test('compact copes with the dead at either end and with everything dead', () => {
  const pool = new Core.Pool(make, 5);
  for (let i = 0; i < 5; i++) pool.alloc().tag = i;
  pool.kill(pool.items[0]);
  pool.kill(pool.items[4]);
  pool.kill(pool.items[3]);
  pool.compact();
  assert.deepEqual(names(pool).sort(), [1, 2]);
  pool.items[0].alive = false;                       // marking by hand counts as well
  pool.items[1].alive = false;
  assert.equal(pool.compact(), 2);
  assert.equal(pool.n, 0);
  assert.equal(pool.alloc().alive, true);
  pool.alloc();
  pool.clear();
  assert.equal(pool.n, 0);
  assert.ok(pool.items.every((o) => !o.alive));
});

test('alloc runs the reset function and objects keep their shape', () => {
  const pool = new Core.Pool(make, 3, (o) => { o.x = 0; o.y = 0; o.tag = 'fresh'; });
  const keys = Object.keys(pool.items[0]).join();
  const a = pool.alloc();
  assert.equal(a.tag, 'fresh');
  a.x = 5;
  a.tag = 'used';
  pool.kill(a);
  pool.compact();
  const b = pool.alloc();
  assert.equal(b, a);
  assert.deepEqual([b.x, b.tag, b.alive], [0, 'fresh', true], 'a reused object starts clean');
  for (const o of pool.items) assert.equal(Object.keys(o).join(), keys);
  assert.equal(Core.Pool(make, 2).cap, 2, 'new may be left out');
  assert.throws(() => new Core.Pool(null, 2), /Core\.Pool needs/);
  assert.throws(() => new Core.Pool(make, 2.5), /Core\.Pool needs/);
});

test('a pool under random use always holds exactly the objects that are alive', () => {
  const rng = new Core.RNG(41), pool = new Core.Pool(make, 50), live = new Set();
  let next = 1;
  for (let round = 0; round < 400; round++) {
    for (let i = rng.int(0, 12); i > 0; i--) {
      const o = pool.alloc();
      if (o === null) { assert.equal(pool.n, 50); break; }
      assert.ok(!live.has(o.tag) || o.tag === 0);
      o.tag = next++;
      live.add(o.tag);
    }
    for (let i = 0; i < pool.n; i++) {
      const o = pool.items[i];
      if (o.alive && rng.chance(0.2)) { pool.kill(o); live.delete(o.tag); }
    }
    if (rng.chance(0.7)) {
      pool.compact();
      assert.equal(pool.n, live.size);
      assert.deepEqual(new Set(names(pool)), live);
    }
    assert.equal(new Set(pool.items).size, 50, 'the fifty objects are the same fifty');
  }
});

// ---- grid ----

// What the grid must return: every live item whose centre is within r + item.r, by where it is now.
const brute = (items, n, x, y, r) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const o = items[i];
    if (o.alive !== false && Math.hypot(o.x - x, o.y - y) <= r + o.r) out.push(o);
  }
  return out;
};
const sameSet = (found, count, expected, note) => {
  const got = found.slice(0, count);
  assert.equal(new Set(got).size, got.length, `no item twice (${note})`);
  assert.equal(got.length, expected.length, `how many (${note})`);
  const want = new Set(expected);
  assert.ok(got.every((o) => want.has(o)), `the same items (${note})`);
};
function crowd(rng, n, spread, radius) {
  const pool = new Core.Pool(make, n);
  for (let i = 0; i < n; i++) {
    const o = pool.alloc();
    o.x = rng.range(-spread, spread);
    o.y = rng.range(-spread, spread);
    o.r = radius(i);
    o.tag = i;
  }
  return pool;
}

test('a query returns exactly the items in reach, each once', () => {
  const rng = new Core.RNG(7), out = [];
  // mostly small bodies, some as wide as a cell, a few far wider: all three ways of storing them are in play
  const pool = crowd(rng, 600, 40, (i) => (i % 97 === 0 ? rng.range(2.5, 6) : i % 11 === 0 ? rng.range(0.9, 1.1) : rng.range(0.2, 0.7)));
  const grid = new Core.Grid(2);
  grid.rebuild(pool);
  for (let q = 0; q < 1500; q++) {
    const x = rng.range(-45, 45), y = rng.range(-45, 45), r = q % 5 === 0 ? 0 : rng.range(0, 6);
    sameSet(out, grid.query(x, y, r, out), brute(pool.items, pool.n, x, y, r), `query ${q} at ${x}, ${y}, r ${r}`);
  }
  for (const o of pool.items.slice(0, 40)) assert.ok(out.slice(0, grid.query(o.x, o.y, 0, out)).includes(o), 'right on top of an item');
});

test('the edge of reach counts as in reach', () => {
  const pool = new Core.Pool(make, 2), out = [];
  const o = pool.alloc();
  o.x = 10;
  o.y = -4;
  o.r = 0.5;
  const grid = new Core.Grid(2);
  grid.rebuild(pool);
  assert.equal(grid.query(13.5, -4, 3, out), 1, 'centre exactly r + item.r away');
  assert.equal(grid.query(13.5, -4, 2.999, out), 0);
  assert.equal(grid.query(10, -0.5, 3, out), 1);
  assert.equal(grid.query(10.5, -4, 0, out), 1, 'a point on the rim of the item, with no radius of its own');
  assert.equal(grid.query(10.501, -4, 0, out), 0);
});

test('a query that covers the whole ground, or more, still returns each item once', () => {
  const rng = new Core.RNG(8), out = [];
  const pool = crowd(rng, 300, 30, () => rng.range(0.2, 1.4));
  const grid = new Core.Grid(2);
  grid.rebuild(pool);
  for (const r of [25, 60, 500, 1e7, Infinity]) {
    sameSet(out, grid.query(3, -4, r, out), brute(pool.items, pool.n, 3, -4, r), `r ${r}`);
  }
  assert.equal(grid.query(3, -4, 1e7, out), 300);
  assert.equal(grid.query(NaN, 0, 5, out), 0, 'a point that is not a number finds nothing');
});

test('far from the origin and across it the grid works the same', () => {
  const rng = new Core.RNG(9), out = [];
  for (const [cx, cy] of [[0, 0], [-3, 2], [1e6 + 0.5, -2e6 - 0.25], [-123456.75, 98765.5]]) {
    const pool = crowd(rng, 200, 12, () => rng.range(0.2, 0.8));
    for (let i = 0; i < pool.n; i++) { pool.items[i].x += cx; pool.items[i].y += cy; }
    const grid = new Core.Grid(2);
    grid.rebuild(pool);
    for (let q = 0; q < 300; q++) {
      const x = cx + rng.range(-14, 14), y = cy + rng.range(-14, 14), r = rng.range(0, 4);
      sameSet(out, grid.query(x, y, r, out), brute(pool.items, pool.n, x, y, r), `around ${cx}, ${cy}`);
    }
  }
});

test('items are judged by where they stood at the last rebuild', () => {
  const rng = new Core.RNG(10), out = [];
  const pool = crowd(rng, 400, 25, () => rng.range(0.2, 0.9));
  const grid = new Core.Grid(2);
  grid.rebuild(pool);
  const then = pool.items.map((o) => ({ x: o.x, y: o.y, r: o.r, alive: o.alive, now: o }));
  for (let i = 0; i < pool.n; i++) {                   // everyone moves, some of them far, and some swell
    pool.items[i].x += rng.range(-9, 9);
    pool.items[i].y += rng.range(-9, 9);
    pool.items[i].r *= rng.range(0.5, 3);
  }
  for (let q = 0; q < 500; q++) {
    const x = rng.range(-28, 28), y = rng.range(-28, 28), r = rng.range(0, 3);
    sameSet(out, grid.query(x, y, r, out), brute(then, pool.n, x, y, r).map((o) => o.now), `before the next rebuild, query ${q}`);
  }
  grid.rebuild(pool);
  for (let q = 0; q < 500; q++) {
    const x = rng.range(-36, 36), y = rng.range(-36, 36), r = rng.range(0, 3);
    sameSet(out, grid.query(x, y, r, out), brute(pool.items, pool.n, x, y, r), `after it, query ${q}`);
  }
});

test('the dead are left out: those dead at the rebuild and those killed after it', () => {
  const rng = new Core.RNG(11), out = [];
  const pool = crowd(rng, 120, 10, () => 0.5);
  for (let i = 0; i < 120; i += 3) pool.kill(pool.items[i]);
  const grid = new Core.Grid(2);
  grid.rebuild(pool);
  for (let i = 1; i < 120; i += 6) pool.kill(pool.items[i]);
  const n = grid.query(0, 0, 100, out), expected = brute(pool.items, pool.n, 0, 0, 100);
  sameSet(out, n, expected, 'everything alive');
  assert.equal(n, 60);
  assert.ok(out.slice(0, n).every((o) => o.alive));
});

test('a compact moves items about in the pool, and the next query redoes the index by itself', () => {
  const rng = new Core.RNG(12), out = [];
  const pool = crowd(rng, 200, 15, () => rng.range(0.2, 0.8));
  const grid = new Core.Grid(2);
  grid.rebuild(pool);
  assert.equal(pool.moves, 0);
  assert.equal(pool.compact(), 0);
  assert.equal(pool.moves, 0, 'a compact that removes nothing moves nothing');
  for (let i = 0; i < 200; i += 4) pool.kill(pool.items[i]);
  pool.compact();
  assert.equal(pool.moves, 1);
  for (let q = 0; q < 300; q++) {
    const x = rng.range(-16, 16), y = rng.range(-16, 16), r = rng.range(0, 4);
    sameSet(out, grid.query(x, y, r, out), brute(pool.items, pool.n, x, y, r), `after compact, query ${q}`);
  }
  // an object that died and was handed out again is a new item somewhere else, not a ghost at its old place
  const old = pool.items[7], at = [old.x, old.y];
  pool.kill(old);
  pool.compact();
  const reborn = pool.alloc();
  assert.equal(reborn, old);
  reborn.x = 100;
  reborn.y = 100;
  assert.ok(!out.slice(0, grid.query(at[0], at[1], 0.1, out)).includes(old));
  pool.clear();
  assert.equal(pool.moves, 3);
  assert.equal(grid.query(0, 0, 1000, out), 0, 'and an emptied pool has nothing in reach');
});

test('the caller\'s array is written from the start and left alone beyond the count', () => {
  const pool = new Core.Pool(make, 4);
  for (const [x, y] of [[0, 0], [1, 0], [50, 50]]) { const o = pool.alloc(); o.x = x; o.y = y; }
  const grid = new Core.Grid(2), out = ['old', 'old', 'old', 'old', 'old'];
  assert.equal(grid.query(0, 0, 5, out), 0, 'a grid that was never built finds nothing');
  grid.rebuild(pool);
  assert.equal(grid.query(0, 0, 2, out), 2);
  assert.ok(out[0] !== 'old' && out[1] !== 'old');
  assert.deepEqual(out.slice(2), ['old', 'old', 'old']);
  const empty = [];
  assert.equal(grid.query(50, 50, 1, empty), 1);
  assert.equal(empty[0], pool.items[2], 'an empty array is filled as needed');
});

test('rebuilding reuses the same typed arrays, and results come in a fixed order', () => {
  const rng = new Core.RNG(13);
  const pool = crowd(rng, 300, 20, () => 0.4);
  const grid = new Core.Grid(2);
  grid.rebuild(pool);
  const names = ['first', 'next', 'cx', 'cy', 'big', 'px', 'py', 'pr'], arrays = names.map((name) => grid[name]);
  assert.ok(arrays.every((a) => ArrayBuffer.isView(a)), 'typed arrays, no maps');
  const a = [], b = [];
  const na = grid.query(1, 2, 9, a);
  for (let round = 0; round < 20; round++) grid.rebuild(pool);
  assert.ok(names.every((name, i) => grid[name] === arrays[i]), 'rebuilding makes no new arrays');
  const nb = grid.query(1, 2, 9, b);
  assert.equal(na, nb);
  assert.ok(a.slice(0, na).every((o, i) => o === b[i]), 'the same question gets the same answer in the same order');
});

test('a grid indexes any list of things with x, y and r', () => {
  const props = [{ x: 3, y: 3, r: 1 }, { x: -8, y: 0, r: 0 }, { x: 0, y: 9, r: 5 }, { x: 40, y: 40 }], out = [];
  const grid = Core.Grid(4);
  grid.rebuild({ items: props, n: props.length });
  assert.equal(grid.query(3, 5, 1, out), 2);
  assert.deepEqual(new Set(out.slice(0, 2)), new Set([props[0], props[2]]));
  assert.equal(grid.query(-8, 0.5, 0.5, out), 1, 'an item without a collider is found by its centre');
  assert.equal(out[0], props[1]);
  assert.equal(grid.query(40, 40.5, 0.5, out), 1, 'a missing radius counts as 0');
  assert.equal(grid.query(-8, 0.5, 0.4, out), 0);
  props.push({ x: 41, y: 41, r: 1 });                  // a longer list: the grid makes room on the next rebuild
  grid.rebuild({ items: props, n: props.length });
  assert.equal(grid.query(40.5, 40.5, 0.8, out), 2);
  assert.throws(() => new Core.Grid(0), /cell size/);
});
