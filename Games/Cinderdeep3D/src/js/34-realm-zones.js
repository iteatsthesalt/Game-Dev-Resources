/* ============================================================
   Cinderdeep — zone generation. A zone is planned when you enter
   it (coarse terrain, towns, roads, gates, dungeon, boss lair,
   camps) and its tiles are filled in chunk by chunk around you.
   Everything comes from the realm seed, so every player walks
   the same world.
   ============================================================ */
const ZF = 8, ZFN = ZT / ZF + 1; // coarse field: one sample every 8 tiles
// ground ids (visual layer)
const GR = { BASE: 0, ALT: 1, DARK: 2, ROAD: 3, PLAZA: 4, SAND: 5, SHALLOW: 6, DEEP: 7, LAVA: 8, ICE: 9, TOXIC: 10, CLIFF: 11, BRIDGE: 12, FIELD: 13, FLOOR: 14, DIRT: 15 };
// mask bits (planning layer)
const MK = { ROAD: 1, CLEAR: 2, BUILD: 4, WALL: 8, TOWN: 16, BRIDGE: 32, NOSPAWN: 64, FIELD: 128 };

function fbm(x, y, seed, oct) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += vnoise(x * f, y * f, seed + i * 977) * a; n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
const tileHash = (zs, x, y) => hash2(hash2(zs, x), y);

function newZone(b) {
  const seed = hash2(REALM_SEED, b.idx * 7919 + 13);
  const Z = {
    b, id: b.id, seed, rng: new RNG(seed ^ 0x2545f491), W: ZT, H: ZT,
    tiles: new Uint8Array(ZT * ZT), ground: new Uint8Array(ZT * ZT), deco: new Uint8Array(ZT * ZT), mask: new Uint8Array(ZT * ZT),
    done: new Uint8Array(ZCN * ZCN), objs: Array.from({ length: ZCN * ZCN }, () => []), gen: 0,
    E: new Float32Array(ZFN * ZFN), M: new Float32Array(ZFN * ZFN), F: new Float32Array(ZFN * ZFN), RV: new Float32Array(ZFN * ZFN),
    towns: [], roads: [], gates: [], ways: [], marks: [], camps: [], chests: [], npcs: [], lights: [], dungeon: null, lair: null,
  };
  planFields(Z);
  planFeatures(Z);
  return Z;
}

/* ---------- coarse terrain: elevation, moisture, forest, rivers ---------- */
function planFields(Z) {
  const s = Z.seed, b = Z.b;
  for (let j = 0; j < ZFN; j++) for (let i = 0; i < ZFN; i++) {
    const x = i * ZF, y = j * ZF, k = j * ZFN + i;
    let e = fbm(x / 260, y / 260, s + 11, 5);
    e = (e - 0.5) * 1.6 + 0.5;
    // a broad bowl: zone middles are lower and easier to walk
    const dx = x / ZT - 0.5, dy = y / ZT - 0.5, rr = Math.sqrt(dx * dx + dy * dy);
    e += (rr - 0.3) * 0.22;
    // the zone edge rises into cliffs (gates are cut later)
    const edge = Math.min(x, y, ZT - x, ZT - y);
    if (edge < 48) e += (1 - edge / 48) ** 2 * 0.6;
    Z.E[k] = e;
    Z.M[k] = fbm(x / 200, y / 200, s + 29, 3);
    Z.F[k] = fbm(x / 110, y / 110, s + 43, 3);
    const rv = fbm(x / 340, y / 340, s + 71, 3);
    Z.RV[k] = 1 - Math.abs(rv * 2 - 1);
  }
}
function fieldAt(A, tx, ty) {
  const fx = clamp(tx / ZF, 0, ZFN - 1.001), fy = clamp(ty / ZF, 0, ZFN - 1.001);
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, k = j * ZFN + i;
  return (A[k] * (1 - u) + A[k + 1] * u) * (1 - v) + (A[k + ZFN] * (1 - u) + A[k + ZFN + 1] * u) * v;
}
// what the land is at a tile before towns and roads: 'water' | 'deep' | 'shallow' | 'rock' | 'river' | 'land'
function landAt(Z, tx, ty, hf) {
  const b = Z.b;
  const e = fieldAt(Z.E, tx, ty) + (hf - 0.5) * 0.05;
  if (e < b.wl - 0.06) return 'deep';
  if (e < b.wl) return 'water';
  if (e < b.wl + 0.018) return 'shallow';
  if (e > b.ml) return 'rock';
  const rv = fieldAt(Z.RV, tx, ty);
  if (rv > 0.976 && e < b.ml - 0.08 && e > b.wl + 0.03) return rv > 0.988 && vnoise(tx / 90, ty / 90, Z.seed + 517) > 0.55 ? 'river' : 'rivershore';
  return 'land';
}
const hfAt = (Z, tx, ty) => vnoise(tx / 5, ty / 5, Z.seed + 101);
function walkableSite(Z, tx, ty, r = 6) {
  for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
    const l = landAt(Z, tx + dx, ty + dy, 0.5);
    if (l !== 'land') return false;
  }
  return true;
}

/* ---------- the plan: gates, towns, roads, dungeon, lair, camps ---------- */
const DIRS4 = [['n', 0, -1], ['s', 0, 1], ['w', -1, 0], ['e', 1, 0]];
function gateOffset(a, b) {
  const key = a.idx < b.idx ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
  return 320 + (hashStr(key + REALM_SEED) % 640);
}
function gatesOf(b) {
  const out = [];
  for (const [d, dx, dy] of DIRS4) {
    const nb = zoneAt(b.at[0] + dx, b.at[1] + dy);
    if (!nb) continue;
    const off = gateOffset(b, nb);
    const x = d === 'w' ? 0 : d === 'e' ? ZT - 1 : off, y = d === 'n' ? 0 : d === 's' ? ZT - 1 : off;
    out.push({ dir: d, to: nb.id, x, y, inX: d === 'w' ? 10 : d === 'e' ? ZT - 11 : off, inY: d === 'n' ? 10 : d === 's' ? ZT - 11 : off });
  }
  return out;
}
const SERVICE_SETS = {
  capital: ['inn', 'smith', 'general', 'mystic', 'temple', 'board', 'bank', 'stable', 'guild', 'tailor'],
  town: ['inn', 'smith', 'general', 'temple', 'board', 'bank', 'mystic'],
  village: ['general', 'board', 'inn'],
  outpost: ['general'],
};
function planFeatures(Z) {
  const b = Z.b, R = Z.rng, M = Z.mask;
  Z.gates = gatesOf(b);
  // settlements
  const sites = [];
  const tryPlace = (kind, rad, minD, area) => {
    for (let k = 0; k < 400; k++) {
      let tx, ty;
      if (kind === 'capital') { tx = ZT / 2 + R.int(-30, 30); ty = ZT / 2 + R.int(-30, 30); }
      else { tx = R.int(area[0], area[2]); ty = R.int(area[1], area[3]); }
      if (!walkableSite(Z, tx, ty, Math.min(rad, 14)) && k < 360) continue;
      if (sites.some((s) => Math.hypot(s.x - tx, s.y - ty) < minD + s.r) && k < 380) continue;
      const s = { kind, x: tx, y: ty, r: rad, name: kind === 'capital' ? 'Emberhold' : townName(hash2(Z.seed, sites.length * 31 + 7)), id: `${Z.id}:${kind}:${sites.length}` };
      sites.push(s);
      return s;
    }
    return null;
  };
  const inner = [120, 120, ZT - 120, ZT - 120];
  if (b.id === 'meadows') tryPlace('capital', 46, 200, inner);
  tryPlace('town', 30, 260, inner);
  for (let i = 0; i < 3; i++) tryPlace('village', 15, 200, inner);
  for (let i = 0; i < 2; i++) tryPlace('outpost', 7, 170, [90, 90, ZT - 90, ZT - 90]);
  Z.towns = sites;
  // dungeon: a road's walk from the main town
  const main = sites.find((s) => s.kind === 'capital') || sites.find((s) => s.kind === 'town') || sites[0];
  const farFrom = (cx, cy, dmin, dmax, avoid = 120, strict = false, away = null) => {
    for (let k = 0; k < 500; k++) {
      const a = R.next() * TAU, d = R.range(dmin, dmax), tx = Math.round(cx + Math.cos(a) * d), ty = Math.round(cy + Math.sin(a) * d);
      if (tx < 80 || ty < 80 || tx > ZT - 80 || ty > ZT - 80) continue;
      if (!walkableSite(Z, tx, ty, 10) && (strict || k < 450)) continue;
      if (sites.some((s) => Math.hypot(s.x - tx, s.y - ty) < s.r + avoid) && (strict || k < 480)) continue;
      if (away && Math.hypot(away.x - tx, away.y - ty) < away.d && k < 490) continue;
      return { x: tx, y: ty };
    }
    if (strict) return null;
    return { x: clamp(Math.round(cx + dmin), 100, ZT - 100), y: clamp(Math.round(cy), 100, ZT - 100) };
  };
  const dg = farFrom(main.x, main.y, 230, 420);
  Z.dungeon = { x: dg.x, y: dg.y, act: ACT_FOR_ZONE(b), name: `${['Crypt', 'Hollow', 'Rime Cave', 'Ember Maw'][ACT_FOR_ZONE(b)]} of ${b.name.split(' ').pop()}`, id: `${Z.id}:dungeon` };
  const lr = farFrom(ZT / 2, ZT / 2, 300, 520, 160, false, { x: dg.x, y: dg.y, d: 110 });
  Z.lair = { x: lr.x, y: lr.y, boss: b.boss, id: `${Z.id}:lair`, r: 20 };
  // roads: connect everything to its nearest neighbour, the main town to every gate
  const nodes = [...sites.map((s) => ({ x: s.x, y: s.y, s })), { x: Z.dungeon.x, y: Z.dungeon.y }, { x: Z.lair.x, y: Z.lair.y + Z.lair.r + 6 }];
  const links = [];
  const inTree = [nodes[0]];
  const rest = nodes.slice(1);
  while (rest.length) {
    let bi = 0, bj = 0, bd = 1e9;
    rest.forEach((n, i) => inTree.forEach((m, j) => { const d = Math.hypot(n.x - m.x, n.y - m.y); if (d < bd) { bd = d; bi = i; bj = j; } }));
    links.push([rest[bi], inTree[bj]]);
    inTree.push(rest.splice(bi, 1)[0]);
  }
  for (const g of Z.gates) {
    let best = null, bd = 1e9;
    for (const n of nodes.slice(0, sites.length)) { const d = Math.hypot(n.x - g.inX, n.y - g.inY); if (d < bd) { bd = d; best = n; } }
    links.push([{ x: g.inX, y: g.inY, gate: g }, best || nodes[0]]);
  }
  for (const [a, c] of links) Z.roads.push(roadPath(Z, a, c));
  // carve gates through the edge cliffs
  for (const g of Z.gates) {
    const len = 64, hw = 5;
    for (let t = 0; t < len; t++) for (let o = -hw; o <= hw; o++) {
      const tx = g.dir === 'w' ? t : g.dir === 'e' ? ZT - 1 - t : g.inX + o, ty = g.dir === 'n' ? t : g.dir === 's' ? ZT - 1 - t : g.inY + o;
      if (tx >= 0 && ty >= 0 && tx < ZT && ty < ZT) M[ty * ZT + tx] |= MK.CLEAR | MK.NOSPAWN;
    }
  }
  // rasterize roads into the mask; river crossings become straight bridges
  const WET = b.lavaWater ? ['deep', 'water', 'river'] : ['deep', 'water', 'river', 'shallow', 'rivershore'];
  const wetAt = (x, y) => WET.includes(landAt(Z, x, y, hfAt(Z, x, y)));
  const dab = (x, y, deck) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const tx = x + dx, ty = y + dy;
      if (tx < 1 || ty < 1 || tx >= ZT - 1 || ty >= ZT - 1) continue;
      const d2 = dx * dx + dy * dy;
      if (deck) { if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) M[ty * ZT + tx] |= MK.ROAD | MK.CLEAR | MK.BRIDGE; }
      else if (d2 <= 2) M[ty * ZT + tx] |= MK.ROAD | MK.CLEAR;
      else if (d2 <= 8) M[ty * ZT + tx] |= MK.CLEAR;
    }
  };
  for (const path of Z.roads) {
    let lock = null, last = null, dry = 0;
    for (let i = 1; i < path.length; i++) {
      const [x0, y0] = path[i - 1], [x1, y1] = path[i], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
      for (let k = 0; k <= n; k++) {
        let x = Math.round(lerp(x0, x1, k / n)), y = Math.round(lerp(y0, y1, k / n));
        if (!lock && wetAt(x, y)) { lock = { ax: Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? 'h' : 'v', x: last ? last[0] : x, y: last ? last[1] : y }; dry = 0; }
        if (lock) {
          // hold the deck straight across, stepping along the travel axis only
          const lx = lock.ax === 'h' ? x : lock.x, ly = lock.ax === 'h' ? lock.y : y;
          if (last) { const m = Math.max(Math.abs(lx - last[0]), Math.abs(ly - last[1])); for (let j = 1; j <= m; j++) dab(Math.round(lerp(last[0], lx, j / m)), Math.round(lerp(last[1], ly, j / m)), true); }
          dab(lx, ly, true); last = [lx, ly];
          dry = wetAt(lx, ly) || wetAt(x, y) ? 0 : dry + 1;
          if (dry >= 3) {
            // back on land: walk from the bridge end to the path again
            const m = Math.max(Math.abs(x - lx), Math.abs(y - ly));
            for (let j = 0; j <= m; j++) dab(Math.round(lerp(lx, x, m ? j / m : 1)), Math.round(lerp(ly, y, m ? j / m : 1)));
            lock = null; last = [x, y];
          }
          continue;
        }
        dab(x, y); last = [x, y];
      }
    }
  }
  // towns: plazas, buildings, walls, lamps, people
  for (const s of sites) planSettlement(Z, s);
  // the dungeon mouth and the lair
  stampDisc(Z, Z.dungeon.x, Z.dungeon.y, 9, MK.CLEAR | MK.NOSPAWN);
  addObj(Z, { kind: 'dungeon', x: (Z.dungeon.x + 0.5) * TS, y: (Z.dungeon.y + 0.5) * TS, act: Z.dungeon.act, solidR: 2 });
  stampDisc(Z, Z.lair.x, Z.lair.y, Z.lair.r, MK.CLEAR | MK.NOSPAWN | MK.TOWN); // a trampled arena of solid ground
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2, tx = Math.round(Z.lair.x + Math.cos(a) * (Z.lair.r - 2)), ty = Math.round(Z.lair.y + Math.sin(a) * (Z.lair.r - 2)); addObj(Z, { kind: 'menhir', x: (tx + 0.5) * TS, y: (ty + 0.5) * TS, v: i, solidR: 0 }); setSolid(Z, tx, ty); }
  // waystones: every settlement, the dungeon, the lair
  // a stone needs open ground: never inside a house or a wall, never in water
  const openSpot = (x, y) => {
    for (let r = 0; r < 14; r++) for (let k = 0; k < Math.max(1, r * 8); k++) {
      const a = (k / Math.max(1, r * 8)) * TAU, tx = Math.round(x + Math.cos(a) * r), ty = Math.round(y + Math.sin(a) * r);
      let ok = true;
      for (let dy = -1; dy <= 2 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) { const m = Z.mask[(ty + dy) * ZT + tx + dx]; if (m & (MK.BUILD | MK.WALL)) ok = false; }
      if (ok && (Z.mask[ty * ZT + tx] & (MK.TOWN | MK.ROAD | MK.CLEAR) || walkableSite(Z, tx, ty, 1))) return { x: tx, y: ty };
    }
    return { x, y };
  };
  for (const s of sites) { const q = openSpot(s.x + 3, s.y + (s.kind === 'outpost' ? 3 : Math.round(s.r * 0.25) + 3)); Z.ways.push({ id: s.id + ':way', x: q.x, y: q.y, name: s.name }); }
  Z.ways.push({ id: Z.dungeon.id + ':way', x: Z.dungeon.x + 6, y: Z.dungeon.y + 5, name: Z.dungeon.name });
  { const q = openSpot(Z.lair.x, Z.lair.y + Z.lair.r - 4); Z.ways.push({ id: Z.lair.id + ':way', x: q.x, y: q.y, name: `${b.name} lair` }); }
  for (const w of Z.ways) { stampDisc(Z, w.x, w.y, 2, MK.CLEAR); addObj(Z, { kind: 'waystone', x: (w.x + 0.5) * TS, y: (w.y + 0.5) * TS, way: w, solidR: 0 }); setSolid(Z, w.x, w.y); }
  // landmarks
  const nMarks = 4 + R.int(0, 3);
  for (let i = 0; i < nMarks; i++) {
    const q = farFrom(R.int(150, ZT - 150), R.int(150, ZT - 150), 0, 40, 60, true);
    if (!q) continue; // nowhere dry and open here: no landmark rather than one in a lake
    if (Math.hypot(q.x - Z.lair.x, q.y - Z.lair.y) < 60 || Math.hypot(q.x - Z.dungeon.x, q.y - Z.dungeon.y) < 40) continue;
    const kind = R.pick(LANDMARKS_OF[b.id] || ['ruin', 'obelisk', 'statue']);
    const m = { id: `${Z.id}:mark:${i}`, kind, x: q.x, y: q.y, name: LANDMARK_NAME[kind] || 'Ruins' };
    Z.marks.push(m);
    stampDisc(Z, q.x, q.y, 6, MK.CLEAR);
    addObj(Z, { kind: 'mark', mk: kind, x: (q.x + 0.5) * TS, y: (q.y + 0.5) * TS, solidR: 1 });
    setSolid(Z, q.x, q.y);
    Z.chests.push({ id: `${m.id}:chest`, x: q.x + 3, y: q.y + 3, tier: R.chance(0.3) ? 'gold' : 'silver' });
  }
  // camps across the zone, denser and tougher far from the main town
  const spacing = 42;
  for (let gy = spacing / 2; gy < ZT; gy += spacing) for (let gx = spacing / 2; gx < ZT; gx += spacing) {
    const tx = Math.round(gx + R.range(-15, 15)), ty = Math.round(gy + R.range(-15, 15));
    if (tx < 60 || ty < 60 || tx > ZT - 60 || ty > ZT - 60) continue;
    if (M[ty * ZT + tx] & (MK.NOSPAWN | MK.TOWN)) continue;
    if (!walkableSite(Z, tx, ty, 4)) continue;
    if (sites.some((s) => Math.hypot(s.x - tx, s.y - ty) < s.r + 26)) continue;
    if (Math.hypot(Z.lair.x - tx, Z.lair.y - ty) < 50) continue;
    if (R.chance(0.12)) continue; // a few quiet stretches
    const far = clamp(Math.hypot(tx - main.x, ty - main.y) / (ZT * 0.7), 0, 1);
    const lvl = Math.round(lerp(b.lvl[0], b.lvl[1], far * 0.85 + R.next() * 0.15));
    const kind = R.chance(0.07) && b.elite ? b.elite : b.mobs[Math.floor(fieldAt(Z.M, tx, ty) * 2.2 * b.mobs.length + R.int(0, 1)) % b.mobs.length];
    const champ = kind === b.elite;
    Z.camps.push({ id: Z.camps.length, x: tx, y: ty, kind, n: champ ? 1 : R.int(3, ENEMIES[kind].big ? 4 : 7), lvl: champ ? lvl + 2 : lvl, elite: !champ && R.chance(0.12), fire: !ENEMIES[kind].fly && ['biped'].includes(ENEMIES[kind].fam) && R.chance(0.5) });
  }
  // loose treasure
  for (let i = 0; i < 26; i++) {
    const tx = R.int(80, ZT - 80), ty = R.int(80, ZT - 80);
    if (!walkableSite(Z, tx, ty, 2) || (M[ty * ZT + tx] & MK.TOWN)) continue;
    Z.chests.push({ id: `${Z.id}:chest:${i}`, x: tx, y: ty, tier: R.chance(0.1) ? 'gold' : R.chance(0.35) ? 'silver' : 'wood' });
  }
  for (const c of Z.chests) stampDisc(Z, c.x, c.y, 1, MK.CLEAR);
  // camp fires and tents are part of the world
  for (const c of Z.camps) if (c.fire) { stampDisc(Z, c.x, c.y, 3, MK.CLEAR); stampDisc(Z, c.x + 3, c.y - 2, 2, MK.CLEAR); addObj(Z, { kind: 'campfire', x: (c.x + 0.5) * TS, y: (c.y + 0.5) * TS, solidR: 0 }); Z.lights.push({ x: (c.x + 0.5) * TS, y: (c.y + 0.5) * TS, r: 70, c: '#ff9a3c', fire: true }); addObj(Z, { kind: 'tent', x: (c.x + 3.5) * TS, y: (c.y - 1.5) * TS, v: c.id, solidR: 1 }); setSolid(Z, c.x + 3, c.y - 2); }
}
function roadPath(Z, a, c) {
  const pts = [[a.x, a.y], [c.x, c.y]];
  // midpoint displacement for a natural wander
  for (let pass = 0; pass < 5; pass++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], len = Math.hypot(x1 - x0, y1 - y0);
      if (len < 24) { next.push(pts[i]); continue; }
      const nx = -(y1 - y0) / len, ny = (x1 - x0) / len, off = (Z.rng.next() - 0.5) * len * 0.28;
      let mx = (x0 + x1) / 2 + nx * off, my = (y0 + y1) / 2 + ny * off;
      // steer away from deep water and cliffs
      for (let k = 0; k < 6 && ['deep', 'rock'].includes(landAt(Z, Math.round(mx), Math.round(my), 0.5)); k++) { mx = lerp(mx, (x0 + x1) / 2, 0.5); my = lerp(my, (y0 + y1) / 2, 0.5); }
      next.push([clamp(mx, 4, ZT - 5), clamp(my, 4, ZT - 5)], pts[i]);
    }
    pts.length = 0; pts.push(...next);
  }
  return pts;
}
function stampDisc(Z, cx, cy, r, bits) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    if (x < 0 || y < 0 || x >= ZT || y >= ZT) continue;
    if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) Z.mask[y * ZT + x] |= bits;
  }
}
function stampRect(Z, x0, y0, w, h, bits) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < ZT && y < ZT) Z.mask[y * ZT + x] |= bits; }
const chunkOf = (tx, ty) => clamp(Math.floor(ty / ZCH), 0, ZCN - 1) * ZCN + clamp(Math.floor(tx / ZCH), 0, ZCN - 1);
function addObj(Z, o) { Z.objs[chunkOf(Math.floor(o.x / TS), Math.floor(o.y / TS))].push(o); return o; }
// solid spots that are not in the terrain (statues, stones): kept until the chunk is built
function setSolid(Z, tx, ty) { Z.solids = Z.solids || []; Z.solids.push(ty * ZT + tx); }

/* ---------- a town: plaza, streets, buildings, walls, lamps, people ---------- */
function planSettlement(Z, s) {
  const R = new RNG(hash2(Z.seed, hashStr(s.id))), b = Z.b;
  const r = s.r;
  stampDisc(Z, s.x, s.y, r + 4, MK.CLEAR | MK.TOWN | MK.NOSPAWN);
  const plazaR = s.kind === 'outpost' ? 4 : Math.max(5, Math.round(r * 0.28));
  stampDisc(Z, s.x, s.y, plazaR, MK.ROAD);
  s.plazaR = plazaR;
  const services = [...(SERVICE_SETS[s.kind] || [])];
  s.buildings = []; s.spots = [];
  // the centrepiece
  if (s.kind === 'capital' || s.kind === 'town') { addObj(Z, { kind: 'fountain', x: (s.x + 0.5) * TS, y: (s.y + 0.5) * TS, solidR: 1, big: s.kind === 'capital' }); for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) setSolid(Z, s.x + dx, s.y + dy); Z.lights.push({ x: (s.x + 0.5) * TS, y: s.y * TS, r: 90, c: '#ffe8a0' }); }
  else if (s.kind === 'village') { addObj(Z, { kind: 'well', x: (s.x + 0.5) * TS, y: (s.y + 0.5) * TS, solidR: 1 }); setSolid(Z, s.x, s.y); }
  else { addObj(Z, { kind: 'campfire', x: (s.x + 0.5) * TS, y: (s.y + 2.5) * TS, solidR: 0 }); Z.lights.push({ x: (s.x + 0.5) * TS, y: (s.y + 2.5) * TS, r: 80, c: '#ff9a3c', fire: true }); }
  // streets out to the edge
  const streets = s.kind === 'outpost' ? [] : s.kind === 'village' ? [[1, 0], [-1, 0], [0, 1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of streets) for (let t = plazaR; t <= r + 4; t++) for (let o = -1; o <= 1; o++) { const tx = s.x + dx * t + (dy ? o : 0), ty = s.y + dy * t + (dx ? o : 0); if (tx >= 0 && ty >= 0 && tx < ZT && ty < ZT) Z.mask[ty * ZT + tx] |= MK.ROAD | MK.CLEAR; }
  // lots along the streets
  const lot = (bx, by, w, h, type, face) => {
    if (bx < 2 || by < 2 || bx + w > ZT - 2 || by + h > ZT - 2) return false;
    for (let y = by - 1; y < by + h + 1; y++) for (let x = bx - 1; x < bx + w + 1; x++) if (Z.mask[y * ZT + x] & (MK.BUILD | MK.ROAD)) return false;
    if (Math.hypot(bx + w / 2 - s.x, by + h / 2 - s.y) > r + 2) return false;
    if ((s.kind === 'capital' || s.kind === 'town') && [[bx - 1, by - 1], [bx + w + 1, by - 1], [bx - 1, by + h + 2], [bx + w + 1, by + h + 2]].some(([x, y]) => Math.hypot(x - s.x, y - s.y) > r + 0.5)) return false;
    stampRect(Z, bx, by, w, h, MK.BUILD);
    const doorX = bx + Math.floor(w / 2), doorY = by + h;
    const bld = { type, x: bx, y: by, w, h, face, doorX, doorY, style: b.house, v: R.int(0, 99), town: s };
    s.buildings.push(bld);
    addObj(Z, { kind: 'building', bld, x: (bx + w / 2) * TS, y: (by + h) * TS - 1, solidR: 0 });
    // the keeper stands at the door
    if (type !== 'house') s.spots.push({ type, x: doorX, y: doorY + 1, bld });
    return true;
  };
  const types = [...services];
  if (s.kind !== 'outpost') {
    const rings = s.kind === 'capital' ? 4 : s.kind === 'town' ? 3 : 2;
    for (const [dx, dy] of streets) {
      for (let k = 0; k < rings * 2; k++) {
        const along = plazaR + 3 + Math.floor(k / 2) * (s.kind === 'capital' ? 10 : 9), side = k % 2 ? 1 : -1;
        const w = R.int(5, 8), h = R.int(4, 5), type = types.length ? types.shift() : 'house';
        let bx, by;
        if (dx) { bx = s.x + dx * along - (dx < 0 ? w : 0); by = side < 0 ? s.y - 3 - h : s.y + 3; }
        else { by = s.y + dy * along - (dy < 0 ? h : 0); bx = side < 0 ? s.x - 3 - w : s.x + 3; }
        if (!lot(bx, by, w, h, type, side)) { if (type !== 'house') types.unshift(type); }
      }
    }
    // ring of houses around the plaza corners
    for (const [qx, qy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const w = R.int(5, 7), h = 4, type = types.length ? types.shift() : 'house';
      if (!lot(s.x + qx * (plazaR + 2) - (qx < 0 ? w : 0), s.y + qy * (plazaR + 2) - (qy < 0 ? h : 0), w, h, type, qy)) if (type !== 'house') types.unshift(type);
    }
  } else {
    // an outpost: the trader's big tent north of the fire, smaller tents around it
    const spots = [[-3, -plazaR - 5], [-plazaR - 7, -2], [plazaR + 1, -2], [-3, plazaR + 1], [-plazaR - 7, -7], [plazaR + 1, -7], [-plazaR - 7, 3], [plazaR + 1, 3]];
    if (spots.some(([ox, oy]) => lot(s.x + ox, s.y + oy, 6, 4, 'tentshop', 1))) { const gi = types.indexOf('general'); if (gi >= 0) types.splice(gi, 1); }
    for (const [ox, oy] of [[-6, 2], [6, 1], [-4, 6], [5, 6]]) { const tx = s.x + ox, ty = s.y + oy; if (Z.mask[ty * ZT + tx] & (MK.BUILD | MK.ROAD)) continue; addObj(Z, { kind: 'tent', x: (tx + 0.5) * TS, y: (ty + 0.5) * TS, solidR: 0 }); setSolid(Z, tx, ty); }
  }
  // leftover services get market stalls on the plaza
  types.forEach((type, i) => { const a = (i / Math.max(1, types.length)) * TAU + 0.4, tx = Math.round(s.x + Math.cos(a) * (plazaR - 2)), ty = Math.round(s.y + Math.sin(a) * (plazaR - 2)); addObj(Z, { kind: 'stall', x: (tx + 0.5) * TS, y: (ty + 0.5) * TS, v: i, solidR: 0 }); setSolid(Z, tx, ty); s.spots.push({ type, x: tx, y: ty + 1 }); });
  // walls around the capital and towns
  if (s.kind === 'capital' || s.kind === 'town') {
    const wr = r + 2;
    for (let i = 0; i < 360; i++) {
      const a = (i / 360) * TAU, tx = Math.round(s.x + Math.cos(a) * wr), ty = Math.round(s.y + Math.sin(a) * wr);
      if (tx < 0 || ty < 0 || tx >= ZT || ty >= ZT) continue;
      const k = ty * ZT + tx;
      if (Z.mask[k] & MK.ROAD) continue;
      Z.mask[k] |= MK.WALL;
    }
    for (const [dx, dy] of streets) for (const o of [-3, 3]) { const tx = s.x + dx * wr + (dy ? o : 0), ty = s.y + dy * wr + (dx ? o : 0); addObj(Z, { kind: 'tower', x: (tx + 0.5) * TS, y: (ty + 0.5) * TS, solidR: 0 }); Z.lights.push({ x: (tx + 0.5) * TS, y: (ty - 1) * TS, r: 60, c: '#ffb766', fire: true }); }
  }
  // lamps along streets
  for (const [dx, dy] of streets) for (let t = plazaR + 2; t < r; t += 6) { const tx = s.x + dx * t + (dy ? 2 : 0), ty = s.y + dy * t + (dx ? 2 : 0); if (Z.mask[ty * ZT + tx] & (MK.BUILD | MK.ROAD)) continue; addObj(Z, { kind: 'lamp', x: (tx + 0.5) * TS, y: (ty + 0.5) * TS, solidR: 0 }); Z.lights.push({ x: (tx + 0.5) * TS, y: (ty - 1) * TS, r: 54, c: '#ffd890', lamp: true }); }
  // fields outside villages
  if (s.kind === 'village') for (let i = 0; i < 3; i++) { const a = R.next() * TAU, d = r + 8, fx = Math.round(s.x + Math.cos(a) * d - 5), fy = Math.round(s.y + Math.sin(a) * d - 3); if (walkableSite(Z, fx + 5, fy + 3, 4)) stampRect(Z, fx, fy, 10, 6, MK.FIELD | MK.CLEAR); }
  // the people
  for (const sp of s.spots) Z.npcs.push({ role: sp.type, x: (sp.x + 0.5) * TS, y: (sp.y + 0.5) * TS, hx: (sp.x + 0.5) * TS, hy: (sp.y + 0.5) * TS, town: s, seed: R.int(0, 1e6), still: true });
  const folk = s.kind === 'capital' ? 16 : s.kind === 'town' ? 9 : s.kind === 'village' ? 5 : 1;
  for (let i = 0; i < folk; i++) { let a = R.next() * TAU, d = R.range(2, Math.max(3, r * 0.7)); for (let k = 0; k < 12 && (Z.mask[Math.round(s.y + Math.sin(a) * d) * ZT + Math.round(s.x + Math.cos(a) * d)] & (MK.BUILD | MK.WALL)); k++) { a += 0.9; d = Math.max(2, d * 0.8); } Z.npcs.push({ role: 'folk', x: (s.x + Math.cos(a) * d + 0.5) * TS, y: (s.y + Math.sin(a) * d + 0.5) * TS, hx: (s.x + 0.5) * TS, hy: (s.y + 0.5) * TS, roam: Math.max(4, r * 0.75) * TS, town: s, seed: R.int(0, 1e6) }); }
  if (s.kind === 'capital' || s.kind === 'town') for (const [dx, dy] of streets) for (const o of [-2, 2]) { const tx = s.x + dx * (r + 2) - dx * 2 + (dy ? o : 0), ty = s.y + dy * (r + 2) - dy * 2 + (dx ? o : 0); Z.npcs.push({ role: 'guard', x: (tx + 0.5) * TS, y: (ty + 0.5) * TS, hx: (tx + 0.5) * TS, hy: (ty + 0.5) * TS, town: s, seed: R.int(0, 1e6), still: true }); }
}
const LANDMARKS_OF = {
  meadows: ['statue', 'ruin', 'windmill', 'oldoak'], whisper: ['ruin', 'oldoak', 'shrine'], sakura: ['torii', 'shrine', 'statue'], autumn: ['windmill', 'ruin', 'oldoak'],
  savanna: ['bones', 'obelisk', 'ruin'], pine: ['ruin', 'stones', 'statue'], ossplains: ['bones', 'mausoleum', 'obelisk'], murkmire: ['ruin', 'shrine', 'bones'],
  sporeveil: ['giantshroom', 'stones', 'ruin'], elderwood: ['oldoak', 'stones', 'shrine'], mangrove: ['wreck', 'ruin', 'shrine'], storm: ['stones', 'obelisk', 'ruin'],
  coral: ['wreck', 'statue', 'ruin'], frostpeak: ['statue', 'stones', 'ruin'], desert: ['obelisk', 'bones', 'ruin', 'statue'], ashlands: ['ruin', 'bones', 'obelisk'],
  canyon: ['bones', 'stones', 'ruin'], jungle: ['ruin', 'statue', 'shrine'], feywild: ['stones', 'shrine', 'giantshroom'], crystal: ['spire', 'obelisk', 'stones'],
  shadowfen: ['mausoleum', 'ruin', 'shrine'], caldera: ['obelisk', 'ruin', 'bones'], glacier: ['spire', 'bones', 'statue'], saltflats: ['spire', 'bones', 'obelisk'], voidscar: ['spire', 'obelisk', 'eye'],
};
const LANDMARK_NAME = { statue: 'Forgotten Statue', ruin: 'Old Ruins', windmill: 'Lonely Windmill', oldoak: 'The Old Oak', shrine: 'Wayside Shrine', torii: 'Spirit Gate', bones: 'Giant Bones', obelisk: 'Rune Obelisk', stones: 'Standing Stones', mausoleum: 'Mausoleum', giantshroom: 'Grandfather Cap', wreck: 'Shipwreck', spire: 'Crystal Spire', eye: 'The Watching Eye' };

/* ---------- filling in a chunk ---------- */
const TREE_IDS = {};
function treeId(kind) { if (!(kind in TREE_IDS)) TREE_IDS[kind] = Object.keys(TREE_IDS).length + 1; return TREE_IDS[kind]; }
const DECO_IDS = {};
function decoId(kind) { if (!(kind in DECO_IDS)) DECO_IDS[kind] = Object.keys(DECO_IDS).length + 1; return DECO_IDS[kind]; }
function genChunk(Z, ci) {
  if (Z.done[ci]) return;
  Z.done[ci] = 1; Z.gen++;
  const b = Z.b, cx0 = (ci % ZCN) * ZCH, cy0 = Math.floor(ci / ZCN) * ZCH, M = Z.mask;
  const trees = b.trees, treeW = trees.reduce((a, t) => a + t[1], 0);
  const pickTree = (h) => { let r = (h % 1000) / 1000 * treeW; for (const [k, w] of trees) { r -= w; if (r <= 0) return k; } return trees[0][0]; };
  const decos = b.deco || [];
  for (let ty = cy0; ty < cy0 + ZCH; ty++) for (let tx = cx0; tx < cx0 + ZCH; tx++) {
    const k = ty * ZT + tx, m = M[k], hf = hfAt(Z, tx, ty), h = tileHash(Z.seed, tx, ty);
    let land = landAt(Z, tx, ty, hf);
    let t = TILE.FLOOR, gr = GR.BASE, dc = 0;
    const mo = fieldAt(Z.M, tx, ty);
    gr = mo + (hf - 0.5) * 0.3 > 0.62 ? GR.ALT : mo + (hf - 0.5) * 0.3 < 0.34 ? GR.DARK : GR.BASE;
    if (m & MK.ROAD) { if (land === 'rock') land = 'land'; else if (m & MK.BRIDGE && !(m & MK.TOWN)) land = 'bridge'; else if (b.lavaWater && (land === 'shallow' || land === 'rivershore')) land = 'land'; else if (land !== 'land') land = 'bridge'; }
    else if (m & MK.CLEAR) { if (land === 'rock') land = 'land'; }
    if (m & MK.TOWN && land !== 'bridge') land = 'land';
    switch (land) {
      case 'deep': t = b.lavaWater ? TILE.LAVA : b.iceWater ? TILE.ICE : TILE.WATER; gr = b.lavaWater ? GR.LAVA : b.iceWater ? GR.ICE : GR.DEEP; break;
      case 'water': case 'river': t = b.lavaWater ? TILE.LAVA : b.iceWater ? TILE.ICE : b.haz === 'toxic' && (h & 7) === 0 ? TILE.TOXIC : TILE.WATER; gr = t === TILE.LAVA ? GR.LAVA : t === TILE.ICE ? GR.ICE : t === TILE.TOXIC ? GR.TOXIC : GR.DEEP; if (land === 'river' && t === TILE.WATER) gr = GR.SHALLOW; break;
      case 'shallow': case 'rivershore': t = b.lavaWater ? TILE.FLOOR : TILE.SHALLOW; gr = b.lavaWater ? GR.DARK : b.iceWater ? GR.ICE : GR.SAND; if (b.iceWater) t = TILE.ICE; else if (!b.lavaWater) { gr = GR.SHALLOW; } break;
      case 'rock': t = TILE.ROCK; gr = GR.CLIFF; break;
      case 'bridge': t = TILE.FLOOR; gr = GR.BRIDGE; break;
      default: {
        // near water: a beach
        if (land === 'land' && fieldAt(Z.E, tx, ty) < b.wl + 0.035 && !(m & MK.TOWN) && !b.lavaWater) gr = GR.SAND;
        if (m & MK.ROAD) gr = m & MK.TOWN ? GR.PLAZA : GR.ROAD;
        else if (m & MK.FIELD) gr = GR.FIELD;
        else if (m & MK.TOWN) gr = vnoise(tx / 3.5, ty / 3.5, Z.seed + 77) > 0.66 ? GR.DIRT : gr;
        // hazards on open ground
        if (!(m & (MK.CLEAR | MK.TOWN)) && b.haz && gr !== GR.SAND) {
          const hz = vnoise(tx / 9, ty / 9, Z.seed + 333);
          if (hz > (b.haz === 'ice' ? 0.74 : 0.8)) { t = b.haz === 'lava' ? TILE.LAVA : b.haz === 'ice' ? TILE.ICE : TILE.TOXIC; gr = b.haz === 'lava' ? GR.LAVA : b.haz === 'ice' ? GR.ICE : GR.TOXIC; }
        }
        if (t === TILE.FLOOR && !(m & (MK.CLEAR | MK.TOWN | MK.FIELD))) {
          // trees by forest density, with breathing room
          const fd = fieldAt(Z.F, tx, ty), dens = b.tdens * clamp((fd - 0.3) * 2.6, 0, 1.6);
          if ((h % 10007) / 10007 < dens * 0.15) {
            const left = tx > cx0 ? Z.tiles[k - 1] : 0, up = ty > cy0 ? Z.tiles[k - ZT] : 0, ul = tx > cx0 && ty > cy0 ? Z.tiles[k - ZT - 1] : 0;
            if (left !== TILE.TREE && up !== TILE.TREE && ul !== TILE.TREE) { t = TILE.TREE; dc = treeId(pickTree(h >>> 3)); }
          } else if ((h % 977) < 4 && b.rocks) { t = TILE.ROCK; dc = 250; }
          else if (decos.length && (h % 61) < 3 + (gr === GR.ALT ? 3 : 0)) dc = decoId(decos[(h >>> 11) % decos.length]);
        } else if (t === TILE.FLOOR && (m & MK.FIELD)) dc = (tx + ty) % 3 === 0 ? decoId('crop') : 0;
      }
    }
    if (m & MK.BUILD) t = TILE.WALL;
    if (m & MK.WALL) { t = TILE.WALL; gr = GR.CLIFF; dc = 251; }
    Z.tiles[k] = t; Z.ground[k] = gr; Z.deco[k] = dc;
    if (t === TILE.TREE) addObj(Z, { kind: 'tree', tree: Object.keys(TREE_IDS)[dc - 1], x: (tx + 0.5) * TS, y: (ty + 0.5) * TS + 4, v: h & 255 });
    else if (dc === 250) addObj(Z, { kind: 'boulder', x: (tx + 0.5) * TS, y: (ty + 0.5) * TS + 3, v: h & 255 });
  }
  if (Z.solids) for (const k of Z.solids) { const tx = k % ZT, ty = Math.floor(k / ZT); if (tx >= cx0 && tx < cx0 + ZCH && ty >= cy0 && ty < cy0 + ZCH) Z.tiles[k] = TILE.ROCK; }
  // a little more life: puddles of light around lava
  if (b.haz === 'lava' || b.lavaWater) for (let i = 0; i < 40; i++) { const tx = cx0 + ((tileHash(Z.seed, ci, i) >>> 3) % ZCH), ty = cy0 + ((tileHash(Z.seed, i, ci) >>> 5) % ZCH); if (Z.tiles[ty * ZT + tx] === TILE.LAVA) Z.lights.push({ x: (tx + 0.5) * TS, y: (ty + 0.5) * TS, r: 60, c: '#ff6a1a', chunk: ci }); }
}
// make sure the chunks around a point exist; `budget` caps work per call
function ensureChunks(Z, px, py, rad = 1, budget = 99) {
  const ctx = Math.floor(px / TS / ZCH), cty = Math.floor(py / TS / ZCH);
  let n = 0;
  for (let r = 0; r <= rad; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = ctx + dx, y = cty + dy;
    if (x < 0 || y < 0 || x >= ZCN || y >= ZCN) continue;
    const ci = y * ZCN + x;
    if (!Z.done[ci]) { genChunk(Z, ci); if (++n >= budget) return n; }
  }
  return n;
}

