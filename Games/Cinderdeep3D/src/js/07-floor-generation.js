/* ============================================================
   Cinderdeep — floor generation
   Rooms sit on a grid of cells (17 x 12 tiles each). Rooms can span
   1x1, 2x1, 1x2 or 2x2 cells; neighbours connect through doors cut
   in their shared walls.
   ============================================================ */
const CW = 17, CH = 12, GW = 9, GH = 9;

function floorInfo(idx) {
  const actIdx = Math.floor(idx / FLOORS_PER_ACT);
  return { actIdx, act: ACTS[actIdx % ACTS.length], sub: idx % FLOORS_PER_ACT, loop: Math.floor(actIdx / ACTS.length), isBoss: idx % FLOORS_PER_ACT === FLOORS_PER_ACT - 1 };
}
function floorLabel(idx) { const f = floorInfo(idx); return `${f.act.short} ${f.actIdx + 1}-${f.sub + 1}`; }

function generateFloor(run, idx) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const fl = tryGenerate(run, idx, attempt);
    if (fl) return fl;
  }
  return tryGenerate(run, idx, 99, true);
}

function tryGenerate(run, idx, attempt, force) {
  const info = floorInfo(idx), rng = new RNG(hash2(run.seed, idx * 7919 + attempt * 104729 + 17));
  const cell = new Int16Array(GW * GH).fill(-1);
  const rooms = [], links = [];
  const free = (cx, cy) => cx >= 0 && cy >= 0 && cx < GW && cy < GH && cell[cy * GW + cx] < 0;
  const nbrCount = (cx, cy, ignore) => {
    let n = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && y >= 0 && x < GW && y < GH && cell[y * GW + x] >= 0 && cell[y * GW + x] !== ignore) n++;
    }
    return n;
  };
  const addRoom = (cx, cy, cw, ch, type) => {
    const r = { id: rooms.length, cx, cy, cw, ch, type, cleared: false, visited: false, seen: false, doors: [], spawns: [], waves: [], props: [] };
    for (let y = cy; y < cy + ch; y++) for (let x = cx; x < cx + cw; x++) cell[y * GW + x] = r.id;
    rooms.push(r);
    return r;
  };
  const cellsOf = (r) => { const out = []; for (let y = r.cy; y < r.cy + r.ch; y++) for (let x = r.cx; x < r.cx + r.cw; x++) out.push([x, y]); return out; };

  const start = addRoom(4, 4, 1, 1, 'start');
  const target = Math.min(13, 5 + info.sub + Math.min(4, info.actIdx) + (rng.chance(0.4) ? 1 : 0));
  let guard = 0;
  while (rooms.length < target && guard++ < 600) {
    const from = rooms[rooms.length > 3 && rng.chance(0.55) ? rng.int(Math.max(1, rooms.length - 3), rooms.length - 1) : rng.int(0, rooms.length - 1)];
    const cand = [];
    for (const [x, y] of cellsOf(from)) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (free(x + dx, y + dy)) cand.push([x + dx, y + dy]);
    if (!cand.length) continue;
    const [nx, ny] = rng.pick(cand);
    if (nbrCount(nx, ny) > 1 && !rng.chance(0.12)) continue;
    // sometimes a bigger room
    let shape = [1, 1];
    if (rng.chance(0.28) && rooms.length > 1) {
      const opts = rng.shuffle([[2, 1, 0, 0], [2, 1, -1, 0], [1, 2, 0, 0], [1, 2, 0, -1], [2, 2, 0, 0], [2, 2, -1, -1], [2, 2, -1, 0], [2, 2, 0, -1]]);
      for (const [w, hh, ox, oy] of opts) {
        const x0 = nx + ox, y0 = ny + oy;
        let ok = true;
        for (let y = y0; y < y0 + hh && ok; y++) for (let x = x0; x < x0 + w && ok; x++) if (!free(x, y)) ok = false;
        if (ok && x0 >= 0 && y0 >= 0) { shape = [w, hh, x0, y0]; break; }
      }
    }
    const r = shape.length === 4 ? addRoom(shape[2], shape[3], shape[0], shape[1], 'combat') : addRoom(nx, ny, 1, 1, 'combat');
    links.push([from.id, r.id]);
  }
  if (rooms.length < 5 && !force) return null;

  // distances from the start
  const adj = () => { const A = rooms.map(() => new Set()); for (const [a, b] of links) { A[a].add(b); A[b].add(a); } return A; };
  const bfs = () => {
    const A = adj(), d = rooms.map(() => -1); d[0] = 0; const q = [0];
    while (q.length) { const u = q.shift(); for (const v of A[u]) if (d[v] < 0) { d[v] = d[u] + 1; q.push(v); } }
    return d;
  };
  // attach a dead-end room of a given size next to some room, preferring far ones
  const attach = (type, cw, ch, preferFar, avoidTypes = ['start']) => {
    const d = bfs(), opts = [];
    for (const r of rooms) {
      if (avoidTypes.includes(r.type) || ['treasure', 'shop', 'shrine', 'forge', 'challenge', 'exit', 'boss', 'secret', 'dmt'].includes(r.type)) continue;
      for (const [x, y] of cellsOf(r)) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        // candidate top-left positions so that the new room touches (x+dx, y+dy)
        for (let ox = 0; ox < cw; ox++) for (let oy = 0; oy < ch; oy++) {
          const x0 = x + dx - ox, y0 = y + dy - oy;
          let ok = x0 >= 0 && y0 >= 0 && x0 + cw <= GW && y0 + ch <= GH;
          const touching = new Set();
          for (let yy = y0; ok && yy < y0 + ch; yy++) for (let xx = x0; ok && xx < x0 + cw; xx++) {
            if (!free(xx, yy)) { ok = false; break; }
            for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const ax = xx + ex, ay = yy + ey;
              if (ax >= 0 && ay >= 0 && ax < GW && ay < GH && cell[ay * GW + ax] >= 0) touching.add(cell[ay * GW + ax]);
            }
          }
          if (ok && touching.size === 1) opts.push({ x0, y0, from: r.id, d: d[r.id] });
        }
      }
    }
    if (!opts.length) return null;
    opts.sort((a, b) => (preferFar ? b.d - a.d : a.d - b.d) + (rng.next() - 0.5) * 1.5);
    const o = preferFar ? opts[0] : rng.pick(opts.slice(0, Math.max(1, Math.ceil(opts.length * 0.7))));
    const r = addRoom(o.x0, o.y0, cw, ch, type);
    links.push([o.from, r.id]);
    return r;
  };

  const bossH = info.act.id === 'frost' ? 2 : 1;
  const exit = info.isBoss ? (attach('boss', 2, bossH, true) || attach('boss', 2, 2, true)) : attach('exit', 1, 1, true);
  if (!exit) { if (!force) return null; }
  const specials = ['treasure'];
  if (rng.chance(0.85) || info.sub === 1) specials.push('shop');
  specials.push(rng.chance(0.5) ? 'shrine' : 'forge');
  if (info.sub >= 1 && rng.chance(0.35)) specials.push('challenge');
  for (const t of specials) if (!attach(t, 1, 1, false) && !force) { if (t === 'treasure' || t === 'shop') return null; }
  if (rng.chance(0.45)) attach('secret', 1, 1, false);
  if (info.sub === 1 || rng.chance(0.3)) attach('dmt', 1, 1, false);

  // a few loops make the map less linear (never into special rooms)
  const isPlain = (r) => r.type === 'combat' || r.type === 'start';
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
    if (!isPlain(rooms[i]) || !isPlain(rooms[j])) continue;
    if (links.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) continue;
    if (touchPairs(rooms[i], rooms[j]).length && rng.chance(0.18)) links.push([i, j]);
  }

  // combat flavour
  const d = bfs();
  const combats = rooms.filter((r) => r.type === 'combat');
  if (idx >= 1 && combats.length > 2) { const far = combats.filter((r) => d[r.id] >= 2); (far.length ? rng.pick(far) : rng.pick(combats)).type = 'elite'; }
  if (combats.length > 5 && rng.chance(0.5)) { const c = rng.pick(combats.filter((r) => r.type === 'combat')); if (c) c.type = 'rest'; }

  // ---- tiles ----
  const W = GW * CW, H = GH * CH;
  const fl = {
    idx, info, act: info.act, actIdx: info.actIdx % ACTS.length, W, H, rng,
    tiles: new Uint8Array(W * H), roomOf: new Int16Array(W * H).fill(-1), doorAt: new Int16Array(W * H).fill(-1),
    vari: new Uint8Array(W * H), rooms, doors: [], props: [], lights: [], cell, dist: d,
  };
  for (const r of rooms) {
    r.x = r.cx * CW; r.y = r.cy * CH; r.w = r.cw * CW; r.h = r.ch * CH;
    r.ix = r.x + 1; r.iy = r.y + 2; r.iw = r.w - 2; r.ih = r.h - 3;
    r.dist = d[r.id];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const i = y * W + x;
      fl.roomOf[i] = r.id;
      const edgeX = x === r.x || x === r.x + r.w - 1, top = y === r.y, face = y === r.y + 1, bottom = y === r.y + r.h - 1;
      fl.tiles[i] = edgeX || top || bottom ? TILE.WALL : face ? TILE.FACE : TILE.FLOOR;
      fl.vari[i] = (hash2(x * 31 + idx, y * 17 + run.seed) >>> 0) % 256;
    }
  }
  // ---- doors ----
  for (const [a, b] of links) {
    const A = rooms[a], B = rooms[b];
    const pairs = touchPairs(A, B);
    if (!pairs.length) continue;
    const [ca, cb] = pairs[Math.floor(pairs.length / 2)];
    const door = { id: fl.doors.length, a, b, open: true, locked: false, tiles: [] };
    if (ca[1] === cb[1]) { // side by side
      const left = ca[0] < cb[0] ? ca : cb, ty = left[1] * CH + 6;
      door.dir = 'h'; door.tiles = [[(left[0] + 1) * CW - 1, ty], [(left[0] + 1) * CW, ty]];
      door.px = (left[0] + 1) * CW * TS; door.py = ty * TS + TS / 2;
    } else {
      const top = ca[1] < cb[1] ? ca : cb, tx = top[0] * CW + 8;
      door.dir = 'v'; door.tiles = [[tx, (top[1] + 1) * CH - 1], [tx, (top[1] + 1) * CH], [tx, (top[1] + 1) * CH + 1]];
      door.px = tx * TS + TS / 2; door.py = ((top[1] + 1) * CH + 0.5) * TS;
    }
    for (const [x, y] of door.tiles) { fl.tiles[y * W + x] = TILE.DOOR; fl.doorAt[y * W + x] = door.id; }
    A.doors.push(door.id); B.doors.push(door.id);
    const special = [A.type, B.type];
    if (special.includes('dmt')) { door.kind = 'dmt'; door.hidden = true; }
    else if (special.includes('secret')) { door.kind = 'secret'; door.hidden = true; }
    else if (special.includes('boss')) door.kind = 'boss';
    else if (special.includes('treasure')) { door.kind = 'treasure'; door.locked = idx >= 1; }
    else if (special.includes('shop')) door.kind = 'shop';
    else door.kind = 'normal';
    fl.doors.push(door);
  }
  // every room must be reachable through doors
  {
    const seen = new Set([0]), q = [0];
    while (q.length) { const u = q.shift(); for (const di of rooms[u].doors) { const dd = fl.doors[di], v = dd.a === u ? dd.b : dd.a; if (!seen.has(v)) { seen.add(v); q.push(v); } } }
    if (seen.size !== rooms.length && !force) return null;
  }
  // ---- furnish rooms ----
  for (const r of rooms) furnishRoom(fl, r, rng, run);
  fl.startRoom = 0;
  fl.exitRoom = rooms.findIndex((r) => r.type === 'exit' || r.type === 'boss');
  return fl;
}

function touchPairs(A, B) {
  const out = [];
  for (let y = A.cy; y < A.cy + A.ch; y++) for (let x = A.cx; x < A.cx + A.cw; x++)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const bx = x + dx, by = y + dy;
      if (bx >= B.cx && bx < B.cx + B.cw && by >= B.cy && by < B.cy + B.ch) out.push([[x, y], [bx, by]]);
    }
  return out;
}

/* door entry tiles inside a room (so obstacles never block them) */
function doorEntries(fl, r) {
  const out = [];
  for (const di of r.doors) {
    const d = fl.doors[di];
    for (const [x, y] of d.tiles) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= r.ix && nx < r.ix + r.iw && ny >= r.iy && ny < r.iy + r.ih) out.push([nx, ny]);
      }
    }
  }
  return out;
}
const WALKABLE = (t) => t === TILE.FLOOR || t === TILE.DOOR || t === TILE.ICE || t === TILE.TOXIC || t === TILE.SPIKE;

function addProp(fl, r, kind, tx, ty, extra = {}) {
  const p = { id: fl.props.length, kind, x: (tx + 0.5) * TS, y: (ty + 0.5) * TS, room: r.id, ...extra };
  fl.props.push(p); r.props.push(p.id);
  return p;
}

function furnishRoom(fl, r, rng, run) {
  const W = fl.W, info = fl.info, act = info.act.id;
  const set = (x, y, t) => { if (x >= r.ix && x < r.ix + r.iw && y >= r.iy && y < r.iy + r.ih) fl.tiles[y * W + x] = t; };
  const tile = (x, y) => fl.tiles[y * W + x];
  const entries = doorEntries(fl, r);
  const nearDoor = (x, y, d = 2) => entries.some(([ex, ey]) => Math.abs(ex - x) + Math.abs(ey - y) <= d);
  const cx = r.ix + Math.floor(r.iw / 2), cy = r.iy + Math.floor(r.ih / 2);

  // torches along the top wall face, away from doors
  const faceY = r.y + 1;
  const tStep = r.w > 20 ? 6 : 5;
  for (let x = r.ix + 2; x < r.ix + r.iw - 1; x += tStep) {
    if (fl.tiles[faceY * W + x] !== TILE.FACE) continue;
    if (fl.doorAt[faceY * W + x - 1] >= 0 || fl.doorAt[faceY * W + x + 1] >= 0) continue;
    if (rng.chance(0.75)) fl.lights.push({ kind: 'torch', x: (x + 0.5) * TS, y: faceY * TS + 9, room: r.id, r: 70, c: info.act.pal.light, flick: rng.next() * 10 });
  }

  // obstacles for fighting rooms
  const fighting = ['combat', 'elite', 'exit', 'challenge'].includes(r.type);
  if (fighting) {
    const pats = ['open', 'pillars', 'rocks', 'rocks', 'center', 'pits', 'hazard', 'hazard', 'crates'];
    const pat = rng.pick(pats);
    const backup = fl.tiles.slice();
    const propsBefore = fl.props.length, roomPropsBefore = r.props.length;
    const sx = r.iw > 15 ? 2 : 1, sy = r.ih > 9 ? 2 : 1;
    if (pat === 'pillars') {
      const pts = [[3, 2], [r.iw - 4, 2], [3, r.ih - 3], [r.iw - 4, r.ih - 3]];
      if (sx > 1) pts.push([Math.floor(r.iw / 2), 2], [Math.floor(r.iw / 2), r.ih - 3]);
      for (const [x, y] of pts) if (!nearDoor(r.ix + x, r.iy + y, 2)) { set(r.ix + x, r.iy + y, TILE.ROCK); addProp(fl, r, 'pillar', r.ix + x, r.iy + y, { solid: true, r: 7, tileBound: true }); }
    } else if (pat === 'rocks') {
      const n = rng.int(3, 6) * sx * sy;
      for (let k = 0; k < n; k++) { const x = rng.int(r.ix + 1, r.ix + r.iw - 2), y = rng.int(r.iy + 1, r.iy + r.ih - 2); if (!nearDoor(x, y, 3)) set(x, y, TILE.ROCK); }
    } else if (pat === 'center') {
      for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) set(x, y, TILE.PIT);
      if (sx > 1) for (let y = cy - 1; y <= cy + 1; y++) { set(cx - 7, y, TILE.ROCK); set(cx + 7, y, TILE.ROCK); }
    } else if (pat === 'pits') {
      const n = rng.int(2, 3) * sx * sy;
      for (let k = 0; k < n; k++) {
        const x0 = rng.int(r.ix + 2, r.ix + r.iw - 4), y0 = rng.int(r.iy + 1, r.iy + r.ih - 3), w = rng.int(1, 3), hh = rng.int(1, 2);
        for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + w; x++) if (!nearDoor(x, y, 3)) set(x, y, TILE.PIT);
      }
    } else if (pat === 'hazard') {
      const hz = info.act.hazard;
      if (hz === 'spikes') {
        const n = rng.int(4, 8) * sx;
        for (let k = 0; k < n; k++) { const x = rng.int(r.ix + 1, r.ix + r.iw - 2), y = rng.int(r.iy + 1, r.iy + r.ih - 2); if (!nearDoor(x, y, 2)) { set(x, y, TILE.SPIKE); addProp(fl, r, 'spikes', x, y, { phase: (x + y) % 2 }); } }
      } else {
        const t = hz === 'lava' ? TILE.LAVA : hz === 'toxic' ? TILE.TOXIC : TILE.ICE;
        const n = rng.int(2, 4) * sx * sy;
        for (let k = 0; k < n; k++) {
          const x0 = rng.int(r.ix + 1, r.ix + r.iw - 3), y0 = rng.int(r.iy + 1, r.iy + r.ih - 2), rad = rng.range(1.2, hz === 'ice' ? 3.2 : 2.2);
          for (let y = Math.floor(y0 - rad); y <= y0 + rad; y++) for (let x = Math.floor(x0 - rad); x <= x0 + rad; x++)
            if ((x - x0) ** 2 + (y - y0) ** 2 <= rad * rad && !(t === TILE.LAVA && nearDoor(x, y, 3)) && tile(x, y) === TILE.FLOOR) set(x, y, t);
        }
      }
    } else if (pat === 'crates') {
      for (const [ox, oy] of [[1, 1], [r.iw - 2, 1], [1, r.ih - 2], [r.iw - 2, r.ih - 2]]) {
        const x = r.ix + ox, y = r.iy + oy;
        if (!nearDoor(x, y, 2)) { addProp(fl, r, rng.chance(0.5) ? 'crate' : 'barrel', x, y, { breakable: true, hp: 1 }); if (rng.chance(0.6)) addProp(fl, r, 'pot', x + (ox < 3 ? 1 : -1), y, { breakable: true, hp: 1 }); }
      }
    }
    // connectivity: every door entry must reach every other, and most of the room must stay open
    if (!roomConnected(fl, r, entries)) {
      fl.tiles.set(backup);
      for (let k = fl.props.length - 1; k >= propsBefore; k--) fl.props.pop();
      r.props.length = roomPropsBefore;
    }
  }

  // scattered breakables and decoration
  if (r.type !== 'boss' && r.type !== 'shop') {
    const n = rng.int(0, r.type === 'rest' ? 1 : 3);
    for (let k = 0; k < n; k++) {
      const corner = rng.pick([[r.ix, r.iy], [r.ix + r.iw - 1, r.iy], [r.ix, r.iy + r.ih - 1], [r.ix + r.iw - 1, r.iy + r.ih - 1]]);
      const x = corner[0] + rng.int(0, 1) * (corner[0] === r.ix ? 1 : -1), y = corner[1];
      if (!nearDoor(x, y, 2) && tile(x, y) === TILE.FLOOR && !propAt(fl, x, y)) addProp(fl, r, rng.pick(['pot', 'pot', 'crate', 'barrel']), x, y, { breakable: true, hp: 1 });
    }
  }
  // region decor that glows
  const glow = { ossuary: 'candles', grotto: 'mushroom', frost: 'icecrystal', core: 'brazier' }[act];
  const gn = r.type === 'boss' ? 4 : rng.int(0, 2);
  for (let k = 0; k < gn; k++) {
    const x = rng.chance(0.5) ? r.ix + rng.int(0, 1) : r.ix + r.iw - 1 - rng.int(0, 1), y = rng.int(r.iy, r.iy + r.ih - 1);
    if (nearDoor(x, y, 2) || tile(x, y) !== TILE.FLOOR || propAt(fl, x, y)) continue;
    const solid = glow === 'brazier' || glow === 'icecrystal' || glow === 'mushroom';
    addProp(fl, r, glow, x, y, { v: rng.int(0, 3), solid, r: 5, light: { r: glow === 'candles' ? 46 : 56, c: glow === 'mushroom' ? (rng.chance(0.5) ? '#9cf0d8' : '#d8a8ff') : glow === 'icecrystal' ? '#bfe9ff' : '#ffb766' } });
  }
  if (act === 'grotto' && rng.chance(0.5)) { const x = rng.int(r.ix + 1, r.ix + r.iw - 2), y = rng.int(r.iy + 1, r.iy + r.ih - 2); if (tile(x, y) === TILE.FLOOR && !propAt(fl, x, y)) addProp(fl, r, 'web', x, y, { decal: true }); }
  if (act === 'ossuary' && rng.chance(0.4)) { const x = rng.int(r.ix + 1, r.ix + r.iw - 2), y = rng.int(r.iy + 1, r.iy + r.ih - 2); if (tile(x, y) === TILE.FLOOR && !propAt(fl, x, y)) addProp(fl, r, 'bones', x, y, { decal: true }); }

  // special rooms
  switch (r.type) {
    case 'start':
      addProp(fl, r, 'statue', cx + 4, r.iy, { solid: true, r: 7 });
      addProp(fl, r, 'statue', cx - 4, r.iy, { solid: true, r: 7 });
      break;
    case 'exit':
      // the way down always sits on open ground
      for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 2; x <= cx + 2; x++) if (fl.tiles[y * W + x] !== TILE.FLOOR) fl.tiles[y * W + x] = TILE.FLOOR;
      for (const pid of r.props.slice()) { const q = fl.props[pid]; if (Math.abs(q.x / TS - (cx + 0.5)) < 3 && Math.abs(q.y / TS - (cy + 0.5)) < 2) { q.broken = true; q.solid = false; q.decal = true; q.kind = 'bones'; } }
      addProp(fl, r, 'stairs', cx, cy, { stairs: true, active: false });
      break;
    case 'treasure': {
      addProp(fl, r, 'rug', cx, cy, { decal: true });
      addProp(fl, r, 'chest', cx, cy, { chest: 'gold', solid: true, r: 7 });
      break;
    }
    case 'shop': {
      addProp(fl, r, 'rug', cx, cy + 1, { decal: true });
      addProp(fl, r, 'merchant', cx - 4, r.iy + 1, { npc: 'merchant', solid: true, r: 6 });
      addProp(fl, r, 'table', cx - 4, r.iy + 2, { solid: true, r: 8 });
      r.shopSlots = [];
      const xs = [cx - 4, cx - 1.5, cx + 1.5, cx + 4].map((x) => Math.round(x));
      for (let k = 0; k < xs.length; k++) r.shopSlots.push(addProp(fl, r, 'pedestal', xs[k], cy + 1, { shopSlot: k, solid: true, r: 5 }).id);
      break;
    }
    case 'shrine': {
      const v = rng.int(0, 2);
      addProp(fl, r, 'shrine', cx, cy - 1, { shrine: ['blood', 'gold', 'arcane'][v], v, solid: true, r: 6, used: false, light: { r: 60, c: ['#ff5a5a', '#ffd35c', '#b98cff'][v] } });
      if (rng.chance(0.5)) addProp(fl, r, 'fountain', cx, cy + 2, { fountain: true, used: false, solid: true, r: 9, light: { r: 50, c: '#9ad8f8' } });
      break;
    }
    case 'forge':
      addProp(fl, r, 'anvil', cx, cy, { forge: true, solid: true, r: 8 });
      addProp(fl, r, 'smith', cx + 2, cy - 2, { npc: 'smith', solid: true, r: 6 });
      addProp(fl, r, 'brazier', cx - 3, cy - 2, { solid: true, r: 5, light: { r: 60, c: '#ffb766' } });
      break;
    case 'challenge':
      addProp(fl, r, 'altar', cx, cy, { challenge: true, used: false, solid: true, r: 9, light: { r: 56, c: '#ff6f9c' } });
      break;
    case 'rest':
      addProp(fl, r, 'fountain', cx, cy, { fountain: true, used: false, solid: true, r: 9, light: { r: 50, c: '#9ad8f8' } });
      break;
    case 'boss':
      for (const [x, y] of (r.ch === 1 ? [[r.ix + 6, r.iy + 2], [r.ix + r.iw - 7, r.iy + 2], [r.ix + 6, r.iy + r.ih - 3], [r.ix + r.iw - 7, r.iy + r.ih - 3]] : [[r.ix + 3, r.iy + 3], [r.ix + r.iw - 4, r.iy + 3], [r.ix + 3, r.iy + r.ih - 4], [r.ix + r.iw - 4, r.iy + r.ih - 4]])) {
        if (info.act.id === 'ossuary' || info.act.id === 'core') { set(x, y, TILE.ROCK); addProp(fl, r, 'pillar', x, y, { solid: true, r: 7, tileBound: true }); }
      }
      break;
  }
  // room spawns
  runHooks('furnish', fl, r, rng, run);
  if (fighting) planSpawns(fl, r, rng, run, entries);
}

function propAt(fl, tx, ty) { return fl.props.some((p) => Math.floor(p.x / TS) === tx && Math.floor(p.y / TS) === ty && !p.decal); }

function roomConnected(fl, r, entries) {
  const W = fl.W, seen = new Uint8Array(fl.W * fl.H);
  let open = 0;
  for (let y = r.iy; y < r.iy + r.ih; y++) for (let x = r.ix; x < r.ix + r.iw; x++) if (WALKABLE(fl.tiles[y * W + x])) open++;
  if (!entries.length) return true;
  const q = [entries[0]]; seen[entries[0][1] * W + entries[0][0]] = 1;
  let n = 0;
  while (q.length) {
    const [x, y] = q.pop(); n++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < r.ix || ny < r.iy || nx >= r.ix + r.iw || ny >= r.iy + r.ih) continue;
      const i = ny * W + nx;
      if (seen[i] || !WALKABLE(fl.tiles[i])) continue;
      seen[i] = 1; q.push([nx, ny]);
    }
  }
  if (!entries.every(([x, y]) => seen[y * W + x])) return false;
  return n >= open * 0.92;
}

function planSpawns(fl, r, rng, run, entries) {
  const info = fl.info, W = fl.W;
  const size = r.cw * r.ch;
  const base = 3 + info.sub + Math.min(3, info.actIdx) + (run.heat >= 2 ? 1 : 0);
  let count = Math.round((base + rng.int(0, 2)) * (size === 1 ? 1 : size === 2 ? 1.7 : 2.4));
  count = Math.round(count * crowdMul(run));
  const waves = r.type === 'challenge' ? 3 : size >= 2 && rng.chance(0.5) ? 2 : info.actIdx >= 1 && rng.chance(0.3) ? 2 : 1;
  const free = [];
  for (let y = r.iy; y < r.iy + r.ih; y++) for (let x = r.ix; x < r.ix + r.iw; x++) {
    if (fl.tiles[y * W + x] !== TILE.FLOOR && fl.tiles[y * W + x] !== TILE.ICE) continue;
    if (entries.some(([ex, ey]) => Math.abs(ex - x) + Math.abs(ey - y) <= 4)) continue;
    if (propAt(fl, x, y)) continue;
    free.push([x, y]);
  }
  if (!free.length) return;
  const table = info.act.enemies;
  for (let w = 0; w < waves; w++) {
    const list = [];
    const n = Math.max(2, Math.round(count / (waves === 1 ? 1 : waves * 0.75)));
    for (let k = 0; k < n; k++) {
      const [kind] = rng.weighted(table, (e) => e[1]);
      const [x, y] = rng.pick(free);
      list.push({ kind, x: (x + 0.5) * TS, y: (y + 0.5) * TS });
    }
    if (r.type === 'elite' && w === 0) {
      const [x, y] = rng.pick(free);
      list.push({ kind: rng.pick(info.act.elites), x: (x + 0.5) * TS, y: (y + 0.5) * TS, elite: true });
    }
    const extraElites = w > 0 ? 0 : (hasOmenFor(run, 'parade') ? 2 : 0) + (run.chaos && rng.chance(0.4) ? 1 : 0);
    for (let k = 0; k < extraElites; k++) { const [x, y] = rng.pick(free); list.push({ kind: rng.pick(info.act.elites), x: (x + 0.5) * TS, y: (y + 0.5) * TS, elite: true }); }
    if (info.actIdx >= 1 && r.type === 'combat' && rng.chance(0.08 + run.heat * 0.03)) {
      const [x, y] = rng.pick(free);
      list.push({ kind: rng.pick(info.act.elites), x: (x + 0.5) * TS, y: (y + 0.5) * TS, elite: true });
    }
    r.waves.push(list);
  }
}

