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
//   new Core.Grid(cell, slack?)       a uniform grid of square cells (side "cell", in metres) over one pool, or
//                                     over anything with items and n. It reads x, y and r (a radius; a missing
//                                     one counts as 0) from each item, and skips items whose alive is false.
//     grid.rebuild(pool)              indexes the items in use, by where they are now. Typed arrays only: they are
//                                     made on the first call and made again only if the pool has grown.
//     grid.query(x, y, r, out) -> n   writes into out[0 .. n) every indexed item whose centre is within
//                                     r + item.r of (x, y), and returns n. out is the caller's array; what it
//                                     held beyond n is left as it was, so use the returned count, not out.length.
//
// What a query returns is exact, not a list of candidates: each item is tested by the place and radius it has now,
// and no item comes twice. It can miss an item in three cases only: the item was allocated after the last
// rebuild; it has moved more than "slack" (default: half a cell) since the last rebuild; or the pool was
// compacted after the last rebuild, which moves items to other places in pool.items. Rebuild after a compact.
// The order of the results depends only on the pool's order and the positions at the last rebuild.
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
    return before - n;
  };

  Pool.prototype.clear = function () {
    for (let i = 0; i < this.n; i++) this.items[i].alive = false;
    this.n = 0;
  };

  Core.Pool = Pool;

  // ---- grid ----
  // Every small item sits in the one cell that holds its centre. Cells are found through a hash of their two
  // whole-number coordinates, so the world has no edges; two cells may share a bucket, which is why each item
  // remembers its cell. A query looks at every cell its circle can reach, widened by the largest small radius
  // and by the slack. Items wider than a cell (bosses, at most a few) are kept in a list that every query checks.

  function Grid(cell, slack) {
    if (!(this instanceof Grid)) return new Grid(cell, slack);
    Core.assert(cell > 0, 'Core.Grid needs a cell size above 0');
    this.cell = cell;
    this.slack = slack >= 0 ? slack : cell / 2;
    this.items = null;           // the items array of the pool last indexed
    this.reach = 0;              // the largest radius among the small items
    this.mask = 0;               // number of buckets - 1; the number is a power of two
    this.first = null;           // bucket -> index of its first item, or -1
    this.next = null;            // item index -> index of the next item in the same bucket, or -1
    this.cx = null;              // item index -> the cell it was put in
    this.cy = null;
    this.big = null;             // indices of the items wider than a cell
    this.bigN = 0;
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
    }
    const first = this.first, next = this.next, cellX = this.cx, cellY = this.cy, big = this.big, mask = this.mask;
    first.fill(-1);
    let bigN = 0, reach = 0;
    for (let i = 0; i < n; i++) {
      const o = items[i];
      if (o.alive === false) continue;
      const r = o.r > 0 ? o.r : 0;
      if (r > half) { big[bigN++] = i; continue; }
      if (r > reach) reach = r;
      const x = floor(o.x * inv), y = floor(o.y * inv), b = bucketOf(x, y, mask);
      cellX[i] = x;
      cellY[i] = y;
      next[i] = first[b];
      first[b] = i;
    }
    this.items = items;
    this.bigN = bigN;
    this.reach = reach;
  };

  Grid.prototype.query = function (x, y, r, out) {
    const items = this.items;
    if (items === null) return 0;
    const first = this.first, next = this.next, cellX = this.cx, cellY = this.cy, mask = this.mask;
    const inv = 1 / this.cell, far = r + this.reach + this.slack;
    const x0 = floor((x - far) * inv), x1 = floor((x + far) * inv), y0 = floor((y - far) * inv), y1 = floor((y + far) * inv);
    let k = 0;
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > mask) {
      // the circle covers more cells than there are buckets: walking every bucket once is the shorter way
      for (let b = 0; b <= mask; b++) {
        for (let i = first[b]; i >= 0; i = next[i]) {
          const o = items[i], dx = o.x - x, dy = o.y - y, reach = r + (o.r > 0 ? o.r : 0);
          if (dx * dx + dy * dy <= reach * reach && o.alive !== false) out[k++] = o;
        }
      }
    } else {
      for (let gy = y0; gy <= y1; gy++) {
        for (let gx = x0; gx <= x1; gx++) {
          for (let i = first[bucketOf(gx, gy, mask)]; i >= 0; i = next[i]) {
            if (cellX[i] !== gx || cellY[i] !== gy) continue;      // an item of another cell in the same bucket
            const o = items[i], dx = o.x - x, dy = o.y - y, reach = r + (o.r > 0 ? o.r : 0);
            if (dx * dx + dy * dy <= reach * reach && o.alive !== false) out[k++] = o;
          }
        }
      }
    }
    const big = this.big;
    for (let j = 0; j < this.bigN; j++) {
      const o = items[big[j]], dx = o.x - x, dy = o.y - y, reach = r + o.r;
      if (dx * dx + dy * dy <= reach * reach && o.alive !== false) out[k++] = o;
    }
    return k;
  };

  Core.Grid = Grid;
})();
