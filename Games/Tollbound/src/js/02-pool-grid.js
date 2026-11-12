// 02-pool-grid.js: pools of reused objects, and a grid that finds the ones near a point.
// Owns: Core (adds Core.Pool and Core.Grid to it)
// Public:
//   new Core.Pool(make, cap, reset?)  cap objects made once with make() and used again and again, so that a step
//                                     allocates nothing. make() must give objects of one shape with an "alive" field.
//                                     ("new" may be left out, for the pool and for the grid.)
//     pool.items                      every object, the live ones first: items[0 .. pool.n) are in use
//     pool.n, pool.cap                how many are in use (those killed since the last compact still count), and
//                                     the most there can be
//     pool.alloc() -> object | null   the next free object with alive = true, after reset(object) if the pool was
//                                     given a reset function; null when the pool is full. It lands at items[n - 1].
//     pool.kill(object)               marks it dead (alive = false). It keeps its place in items until compact():
//                                     a loop over items[0 .. n) skips what is not alive.
//     pool.compact() -> removed       moves the dead out of items[0 .. n) by putting the last live object in
//                                     their place, so the order of the live ones changes. Never call it inside a
//                                     loop over the pool; the simulation compacts in one place only (Sim.step).
//     pool.clear()                    kills everything and empties the pool
//     pool.moves                      how often compact or clear has moved objects about; a grid uses it to
//                                     notice that its index is out of date
//   new Core.Grid(cell)               a uniform grid of square cells (side "cell", in metres) over one pool, or
//                                     over anything with items and n. It reads x, y and r (a radius; a missing
//                                     one counts as 0) from each item, and skips items whose alive is false.
//     grid.rebuild(pool)              indexes the items in use, with the place and radius each has now. Typed
//                                     arrays only: they are made on the first call and again only if the pool grew.
//     grid.query(x, y, r, out) -> n   writes into out[0 .. n) every indexed item whose centre is within
//                                     r + item.r of (x, y), and returns n. out is the caller's array; what it
//                                     held beyond n is left as it was, so use the returned count, not out.length.
//     grid.near(body, margin, out) -> n   the same for a body: every indexed item whose centre is within
//                                     body.r + margin + item.r of (body.x, body.y), by where the body is now.
//                                     The body itself is among them if it is indexed. Prefer this in a loop
//                                     over entities: it hands no numbers across a call (see the note at query).
//
// What a query returns is exact, not a list of candidates to test again: every item in reach is there, once,
// and nothing else is. "In reach" goes by the place and the radius an item had at the last rebuild: an item
// that has moved since is still found where it was, so within a step the answer is at most one step's
// movement behind. Items that were killed since the rebuild are left out; items allocated since are not
// known to the grid. A compact that removed something leaves the index pointing at the wrong places, so the
// first query after one rebuilds it (pool.moves tells). The order of the results depends only on the pool's
// order and the positions at the rebuild.
(function () {
  'use strict';

  const floor = Math.floor, imul = Math.imul;

  // ---- pool ----

  function Pool(make, cap, reset) {
    if (!(this instanceof Pool)) return new Pool(make, cap, reset);
    Core.assert(typeof make === 'function' && cap >= 0 && floor(cap) === cap, 'Core.Pool needs a function that makes an object, and a whole number as its cap');
    this.items = [];
    for (let i = 0; i < cap; i++) {
      const o = make();
      o.alive = false;
      this.items.push(o);
    }
    this.n = 0;
    this.cap = cap;
    this.moves = 0;
    this.reset = typeof reset === 'function' ? reset : null;
  }

  Pool.prototype.alloc = function () {
    if (this.n >= this.cap) return null;
    const o = this.items[this.n++];
    if (this.reset !== null) this.reset(o);
    o.alive = true;
    return o;
  };

  Pool.prototype.kill = function (o) { o.alive = false; };

  Pool.prototype.compact = function () {
    const items = this.items, before = this.n;
    let n = before;
    for (let i = 0; i < n; i++) {
      const o = items[i];
      if (o.alive) continue;
      n--;
      items[i] = items[n];
      items[n] = o;
      i--;                       // the object that took this place is looked at next
    }
    this.n = n;
    if (n !== before) this.moves++;
    return before - n;
  };

  Pool.prototype.clear = function () {
    for (let i = 0; i < this.n; i++) this.items[i].alive = false;
    this.n = 0;
    this.moves++;
  };

  Core.Pool = Pool;

  // ---- grid ----
  // Every small item sits in the one cell that holds its centre. Cells are found through a hash of their two
  // whole-number coordinates, so the world has no edges; two cells may share a bucket, which is why each item
  // remembers its cell. A query looks at every cell its circle can reach once it is widened by the largest
  // small radius. Items wider than a cell (bosses, at most a few) are kept in a list that every query checks.
  // Places and radii are copied into typed arrays at the rebuild, so a query reads no object until it has a hit.

  function Grid(cell) {
    if (!(this instanceof Grid)) return new Grid(cell);
    Core.assert(cell > 0, 'Core.Grid needs a cell size above 0');
    this.cell = cell;
    this.pool = null;            // what was indexed last, and its "moves" at that time
    this.stamp = 0;
    this.items = null;
    this.reach = 0;              // the largest radius among the small items
    this.mask = 0;               // number of buckets - 1; the number is a power of two
    this.first = null;           // bucket -> index of its first item, or -1
    this.next = null;            // item index -> index of the next item in the same bucket, or -1
    this.cx = null;              // item index -> the cell it is in
    this.cy = null;
    this.px = null;              // item index -> its place and radius at the rebuild
    this.py = null;
    this.pr = null;
    this.big = null;             // indices of the items wider than a cell
    this.bigN = 0;
    this.probe = { x: 0.5, y: 0.5, r: 0.5 };       // the point of a query, as a body (see query below)
  }

  function bucketOf(cx, cy, mask) { return (imul(cx, 73856093) ^ imul(cy, 19349663)) & mask; }

  Grid.prototype.rebuild = function (pool) {
    const items = pool.items, n = pool.n, inv = 1 / this.cell, half = this.cell / 2;
    if (this.next === null || this.next.length < items.length) {
      let buckets = 16;
      while (buckets < items.length * 2) buckets *= 2;
      this.mask = buckets - 1;
      this.first = new Int32Array(buckets);
      this.next = new Int32Array(items.length);
      this.cx = new Int32Array(items.length);
      this.cy = new Int32Array(items.length);
      this.big = new Int32Array(items.length);
      this.px = new Float64Array(items.length);
      this.py = new Float64Array(items.length);
      this.pr = new Float64Array(items.length);
    }
    const first = this.first, next = this.next, cellX = this.cx, cellY = this.cy, big = this.big, mask = this.mask;
    const px = this.px, py = this.py, pr = this.pr;
    first.fill(-1);
    let bigN = 0, reach = 0;
    for (let i = 0; i < n; i++) {
      const o = items[i];
      if (o.alive === false) continue;
      const x = o.x, y = o.y, r = o.r > 0 ? o.r : 0;
      px[i] = x;
      py[i] = y;
      pr[i] = r;
      if (r > half) { big[bigN++] = i; continue; }
      if (r > reach) reach = r;
      const gx = floor(x * inv), gy = floor(y * inv), b = bucketOf(gx, gy, mask);
      cellX[i] = gx;
      cellY[i] = gy;
      next[i] = first[b];
      first[b] = i;
    }
    this.pool = pool;
    this.stamp = pool.moves;
    this.items = items;
    this.bigN = bigN;
    this.reach = reach;
  };

  // query is kept this small on purpose. A number handed to a function that the engine does not inline is boxed,
  // which is garbage in a loop over hundreds of entities; a function this small is inlined, and the search
  // itself takes the point as an object. For the same reason near() takes the body, not its coordinates.
  Grid.prototype.query = function (x, y, r, out) {
    const probe = this.probe;
    probe.x = x;
    probe.y = y;
    probe.r = r;
    return this.near(probe, 0, out);
  };

  Grid.prototype.near = function (body, margin, out) {
    if (this.items === null) return 0;
    if (this.pool.moves !== this.stamp) this.rebuild(this.pool);   // a compact moved the items: the index is redone
    const items = this.items, first = this.first, next = this.next, cellX = this.cx, cellY = this.cy, mask = this.mask;
    const px = this.px, py = this.py, pr = this.pr;
    const x = body.x, y = body.y, r = (body.r > 0 ? body.r : 0) + margin;
    const inv = 1 / this.cell, far = r + this.reach;
    const x0 = floor((x - far) * inv), x1 = floor((x + far) * inv), y0 = floor((y - far) * inv), y1 = floor((y + far) * inv);
    let k = 0;
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > mask) {
      // the circle covers more cells than there are buckets: walking every bucket once is the shorter way
      for (let b = 0; b <= mask; b++) {
        for (let i = first[b]; i >= 0; i = next[i]) {
          const dx = px[i] - x, dy = py[i] - y, reach = r + pr[i];
          if (dx * dx + dy * dy <= reach * reach && items[i].alive !== false) out[k++] = items[i];
        }
      }
    } else {
      for (let gy = y0; gy <= y1; gy++) {
        for (let gx = x0; gx <= x1; gx++) {
          for (let i = first[bucketOf(gx, gy, mask)]; i >= 0; i = next[i]) {
            if (cellX[i] !== gx || cellY[i] !== gy) continue;      // an item of another cell in the same bucket
            const dx = px[i] - x, dy = py[i] - y, reach = r + pr[i];
            if (dx * dx + dy * dy <= reach * reach && items[i].alive !== false) out[k++] = items[i];
          }
        }
      }
    }
    const big = this.big;
    for (let j = 0; j < this.bigN; j++) {
      const i = big[j], dx = px[i] - x, dy = py[i] - y, reach = r + pr[i];
      if (dx * dx + dy * dy <= reach * reach && items[i].alive !== false) out[k++] = items[i];
    }
    return k;
  };

  Core.Grid = Grid;
})();
