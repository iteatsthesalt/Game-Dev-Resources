/* ============================================================
   Cinderdeep — the Mycelium. One living thing runs under the
   whole world and ties it together: every tree, cap, stone,
   door and grave is a knot in it. Mostly it is unseen. In the
   fungal lands it shows; elsewhere it lights up under your feet
   and when something dies, and what dies is carried along it
   toward the nearest DMT zone and grows back where it fell as
   caps that ripen, spore and wither. It keeps the world's time.
   DMT zones are where you commune with it.
   ============================================================ */
const MYC = { fl: null, key: '', nodes: [], edges: new Map(), pulses: [], blooms: [], stepT: 0, lapse: 0, cache: new Map(), fx: { sight: 0, still: 0, rot: 0, bloom: 0 }, inSite: false, elves: null };
// how much of it shows of its own accord
const MYC_SEEN = { sporeveil: 0.24, feywild: 0.15, voidscar: 0.13, murkmire: 0.08, shadowfen: 0.08, elderwood: 0.07, jungle: 0.05 };
const MYC_THREAD = '#e4f6ff', MYC_PULSE = '#bff6ff';
const mycBond = () => (CD.save && CD.save.fs && CD.save.fs.mycBond) || 0;
const mycRealm = () => !!(W.on && !W.inInst && W.Z && G.fl && G.fl.realm);
function mycBase() {
  const zone = mycRealm() ? MYC_SEEN[W.Z.b.id] || 0 : G.fl && G.fl.info && G.fl.info.act && G.fl.info.act.id === 'grotto' ? 0.2 : 0;
  return Math.min(0.3, zone + Math.min(0.12, mycBond() * 0.015));
}

/* ---------- a thread between two knots: it wanders, and puts out twigs ---------- */
function mycThread(x0, y0, x1, y1, seed) {
  const d = Math.hypot(x1 - x0, y1 - y0) || 1, n = Math.max(3, Math.round(d / 7)), nx = -(y1 - y0) / d, ny = (x1 - x0) / d;
  const a1 = (hashU(seed, 1) - 0.5) * d * 0.3, a2 = (hashU(seed, 2) - 0.5) * d * 0.16, pts = [], cum = [0];
  for (let i = 0; i <= n; i++) {
    const k = i / n, w = Math.sin(k * Math.PI) * a1 + Math.sin(k * TAU) * a2 + (i && i < n ? (hashU(seed, i + 3) - 0.5) * 2.4 : 0);
    pts.push(x0 + (x1 - x0) * k + nx * w, y0 + (y1 - y0) * k + ny * w * 0.6);
    if (i) cum.push(cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]));
  }
  const twigs = [];
  for (let i = 1; i < n; i++) if (hashU(seed, 50 + i) < 0.35) {
    const a = Math.atan2(ny, nx) * (hashU(seed, 70 + i) < 0.5 ? 1 : -1) + (hashU(seed, 90 + i) - 0.5), l = 3 + hashU(seed, 110 + i) * 5;
    twigs.push(pts[i * 2], pts[i * 2 + 1], pts[i * 2] + Math.cos(a) * l, pts[i * 2 + 1] + Math.sin(a) * l * 0.6);
  }
  let x = Infinity, y = Infinity, X = -Infinity, Y = -Infinity;
  for (let i = 0; i < pts.length; i += 2) { x = Math.min(x, pts[i]); X = Math.max(X, pts[i]); y = Math.min(y, pts[i + 1]); Y = Math.max(Y, pts[i + 1]); }
  return { pts, cum, total: cum[n], twigs, box: [x - 8, y - 8, X + 8, Y + 8] };
}
function mycEdge(a, b, edges) {
  const ka = a.id < b.id ? a.id : b.id, kb = a.id < b.id ? b.id : a.id, key = ka + '|' + kb;
  if (edges.has(key)) return;
  let th = MYC.cache.get(key);
  if (!th) { if (MYC.cache.size > 4000) MYC.cache.clear(); th = mycThread(a.x, a.y, b.x, b.y, hash2(Math.round(a.x * 7 + b.x), Math.round(a.y * 13 + b.y))); MYC.cache.set(key, th); }
  const e = { key, a, b, ...th, lit: 0 };
  edges.set(key, e); a.edges.push(e); b.edges.push(e);
}
const mycNode = (x, y, id, o) => ({ x, y, id, o, edges: [] });

/* ---------- the knots: rooms, doors and props below; trees, stones and waystones above ---------- */
function mycBuildFloor(fl) {
  const nodes = [], edges = new Map(), byRoom = new Map();
  for (const r of fl.rooms) { const n = mycNode((r.ix + r.iw / 2) * TS, (r.iy + r.ih / 2) * TS, 'r' + r.id, null); n.room = r; byRoom.set(r.id, n); nodes.push(n); }
  (fl.doors || []).forEach((d, i) => {
    const n = mycNode(d.px, d.py, 'd' + i, null); nodes.push(n);
    for (const rid of [d.a, d.b]) if (byRoom.has(rid)) mycEdge(n, byRoom.get(rid), edges);
  });
  for (const r of fl.rooms) {
    const c = byRoom.get(r.id);
    (r.props || []).slice(0, 6).forEach((pid) => { const pr = fl.props[pid]; if (!pr) return; const n = mycNode(pr.x, pr.y, 'p' + pid, null); nodes.push(n); mycEdge(n, c, edges); });
  }
  MYC.nodes = nodes; MYC.edges = edges;
}
function mycBuildRealm(cx, cy) {
  const Z = W.Z, x0 = cx - 320, y0 = cy - 320, x1 = cx + R.VW + 320, y1 = cy + R.VH + 320, nodes = [];
  for (let cyy = Math.max(0, Math.floor(y0 / TS / ZCH)); cyy <= Math.min(ZCN - 1, Math.floor(y1 / TS / ZCH)); cyy++) for (let cxx = Math.max(0, Math.floor(x0 / TS / ZCH)); cxx <= Math.min(ZCN - 1, Math.floor(x1 / TS / ZCH)); cxx++) {
    for (const o of Z.objs[cyy * ZCN + cxx]) {
      if (o.x < x0 || o.x > x1 || o.y < y0 || o.y > y1) continue;
      if (o.kind !== 'tree' && o.kind !== 'mark' && o.kind !== 'waystone' && o.kind !== 'boulder' && o.kind !== 'menhir') continue;
      nodes.push(mycNode(o.x, o.y - 1, Math.round(o.x) * 100003 + Math.round(o.y), o));
    }
  }
  const s = Z.dmtSite;
  if (s && s.px > x0 && s.px < x1 && s.py > y0 && s.py < y1) { const n = mycNode(s.px, s.py, 'dmt', null); n.site = true; nodes.push(n); }
  // each knot reaches for its two nearest neighbours; a bucket grid keeps the search short
  const B = 160, grid = new Map(), edges = new Map();
  for (const n of nodes) { const k = Math.floor(n.x / B) + ',' + Math.floor(n.y / B); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(n); }
  for (const n of nodes) {
    const gx = Math.floor(n.x / B), gy = Math.floor(n.y / B), near = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const m of grid.get(gx + dx + ',' + (gy + dy)) || []) {
      if (m === n) continue;
      const d = Math.hypot(m.x - n.x, m.y - n.y);
      if (d > 8 && d < (n.site || m.site ? 200 : 150)) near.push([d, m]);
    }
    near.sort((a, b) => a[0] - b[0]);
    for (const [, m] of near.slice(0, n.site ? 6 : 2)) mycEdge(n, m, edges);
  }
  // pulses already travelling keep their threads
  MYC.pulses = MYC.pulses.filter((q) => (q.e = edges.get(q.e.key)));
  MYC.nodes = nodes; MYC.edges = edges;
}
function mycTarget() {
  if (mycRealm()) { const s = W.Z.dmtSite; return s ? { x: s.px, y: s.py } : null; }
  const r = G.fl && G.fl.rooms && G.fl.rooms.find((q) => q.type === 'dmt');
  return r ? { x: (r.ix + r.iw / 2) * TS, y: (r.iy + r.ih / 2) * TS } : null;
}
function mycNearest(x, y, lim) {
  let best = null, bd = lim;
  for (const n of MYC.nodes) { const d = Math.hypot(n.x - x, n.y - y); if (d < bd && n.edges.length) { bd = d; best = n; } }
  return best;
}

/* ---------- pulses: what the network carries, drawn toward where it is communed with ---------- */
function mycSend(node, str, col, hops, skip) {
  if (!node || MYC.pulses.length > 70) return;
  for (const e of node.edges) {
    if (e === skip) continue;
    MYC.pulses.push({ e, s: e.a === node ? 0 : e.total, dir: e.a === node ? 1 : -1, v: 70 + str * 40, str, col, hops });
  }
}
function mycArrive(q, node) {
  if (node.o && node.o.kind === 'tree' && q.str > 0.45 && mycRealm()) { const sp = objSprite(node.o, W.Z.b); if (sp) shakeObj(node.o, sp, q.str * 0.35, null); }
  if (node.site || node.room && node.room.type === 'dmt') { ring(node.x, node.y, 10 + q.str * 14, q.col, 0.5, 1); return; }
  if (q.hops <= 0 || q.str < 0.12) return;
  const T = mycTarget(), next = node.edges.filter((e) => e !== q.e);
  if (!next.length) return;
  const far = (e) => { const m = e.a === node ? e.b : e.a; return T ? Math.hypot(m.x - T.x, m.y - T.y) : hashU(m.x | 0, m.y | 0); };
  next.sort((a, b) => far(a) - far(b));
  const go = (e, k) => MYC.pulses.length < 70 && MYC.pulses.push({ e, s: e.a === node ? 0 : e.total, dir: e.a === node ? 1 : -1, v: q.v, str: q.str * k, col: q.col, hops: q.hops - 1 });
  go(next[0], 0.9);
  if (next.length > 1 && q.str > 0.5) go(next[1 + Math.floor(Math.random() * (next.length - 1))], 0.5);
}
function mycAt(e, s) {
  const c = e.cum, n = c.length - 1;
  let i = 1; while (i < n && c[i] < s) i++;
  const k = clamp((s - c[i - 1]) / (c[i] - c[i - 1] || 1), 0, 1);
  return [lerp(e.pts[i * 2 - 2], e.pts[i * 2], k), lerp(e.pts[i * 2 - 1], e.pts[i * 2 + 1], k)];
}

/* ---------- what dies grows back: caps sprout where it fell, ripen, spore and wither ---------- */
const BLOOM_LIFE = 270;
function mycBloom(x, y, col) {
  if (MYC.blooms.length > 70) MYC.blooms.shift();
  MYC.blooms.push({ x, y, t: 0, seed: (Math.random() * 1e9) | 0, col: col || mycCapColor(), n: 2 + Math.floor(Math.random() * 3) });
}
function mycCapColor() {
  const id = mycRealm() ? W.Z.b.id : G.fl && G.fl.info && G.fl.info.act ? G.fl.info.act.id : '';
  return { sporeveil: '#c58cff', grotto: '#c58cff', feywild: '#ff8ad8', voidscar: '#4affe0', frost: '#9fd8ff', frostpeak: '#9fd8ff', glacier: '#9fd8ff', core: '#ff9a3c', ashlands: '#ff9a3c', caldera: '#ff9a3c', murkmire: '#a8e05c', shadowfen: '#8a6ab8' }[id] || '#d8b48a';
}
const mycAgeRate = () => (MYC.fx.bloom > 0 ? 8 : 1);
function drawBloom(g, b, cx, cy, night) {
  const t = b.t, x = Math.round(b.x - cx), y = Math.round(b.y - cy);
  if (x < -20 || y < -20 || x > R.VW + 20 || y > R.VH + 20) return;
  const fade = t < 220 ? 1 : Math.max(0, 1 - (t - 220) / 50);
  // hyphae spread out from where it fell
  const reach = Math.min(1, t / 8) * 9;
  g.strokeStyle = rgbaStr(MYC_THREAD, 0.35 * fade); g.lineWidth = 1; g.beginPath();
  for (let i = 0; i < 6; i++) { const a = hashU(b.seed, i) * TAU, l = reach * (0.5 + hashU(b.seed, i + 9) * 0.6); g.moveTo(x + 0.5, y + 0.5); g.lineTo(x + 0.5 + Math.cos(a) * l, y + 0.5 + Math.sin(a) * l * 0.55); }
  g.stroke();
  if (t < 6) return;
  // then caps: tiny, grown, glowing at night, sporing, withering
  const grow = Math.min(1, (t - 6) / 34), wither = t > 210 ? Math.min(1, (t - 210) / 40) : 0;
  for (let i = 0; i < b.n; i++) {
    const a = hashU(b.seed, 20 + i) * TAU, d = 2 + hashU(b.seed, 30 + i) * 6, px = Math.round(x + Math.cos(a) * d), py = Math.round(y + Math.sin(a) * d * 0.5);
    const s = Math.max(1, Math.round((0.6 + hashU(b.seed, 40 + i) * 0.8) * grow * 2.4 * (1 - wither * 0.5))), stem = Math.max(1, Math.round(s * 0.8));
    const col = wither ? shade(b.col, -0.45 * wither) : b.col;
    g.globalAlpha = fade;
    g.fillStyle = '#e8dcc8'; g.fillRect(px, py - stem, 1, stem);
    g.fillStyle = col; g.fillRect(px - s, py - stem - Math.max(1, s - 1), s * 2 + 1, Math.max(1, s - 1)); g.fillRect(px - s + 1, py - stem - s, s * 2 - 1, 1);
    if (night && t > 30 && !wither) { g.fillStyle = '#ffffff'; g.fillRect(px, py - stem - s, 1, 1); }
    g.globalAlpha = 1;
  }
}

/* ---------- each frame: build, carry, age, keep time ---------- */
hook('update', (dt) => {
  const p = G.p;
  if (!p || !G.fl || !dt) return;
  if (MYC.fl !== G.fl) {
    // a new place: its own threads, its own graves; what you were given here stays here
    MYC.fl = G.fl; MYC.key = ''; MYC.pulses = []; MYC.blooms = []; MYC.nodes = []; MYC.edges = new Map(); MYC.elves = null; MYC.inSite = false;
    for (const k in MYC.fx) MYC.fx[k] = 0;
    if (!G.fl.realm) mycBuildFloor(G.fl);
  }
  if (mycRealm()) {
    // rebuilt as you cross the land, and again while the land around you is still being grown
    const key = Math.floor(G.cam.x / 256) + ',' + Math.floor(G.cam.y / 256), grown = W.Z.gen;
    if (key !== MYC.key || grown !== MYC.grown) { MYC.key = key; MYC.grown = grown; mycBuildRealm(G.cam.x - R.VW / 2, G.cam.y - R.VH / 2); }
  }
  for (const k in MYC.fx) if (MYC.fx[k] > 0) MYC.fx[k] -= dt;
  // footsteps: the network notices you
  if (p.moving && !p.dead && (MYC.stepT -= dt) <= 0) { MYC.stepT = 0.85; mycSend(mycNearest(p.x, p.y, 60), 0.35, MYC_PULSE, 1); }
  for (let i = MYC.pulses.length - 1; i >= 0; i--) {
    const q = MYC.pulses[i];
    q.s += q.v * dt * q.dir; q.e.lit = Math.max(q.e.lit, q.str * 0.6);
    if (q.s < 0 || q.s > q.e.total) { MYC.pulses.splice(i, 1); mycArrive(q, q.dir > 0 ? q.e.b : q.e.a); }
  }
  for (const e of MYC.edges.values()) if (e.lit > 0) e.lit = Math.max(0, e.lit - dt * 0.5);
  // the dead age back into the ground
  const ar = mycAgeRate();
  for (let i = MYC.blooms.length - 1; i >= 0; i--) {
    const b = MYC.blooms[i];
    b.t += dt * ar;
    if (b.t > 150 && b.t < 210 && Math.random() < dt * 0.6 && !CD.settings.lowFx) G.parts.push({ x: b.x + rnd(-4, 4), y: b.y, z: 3, vx: rnd(-6, 6), vy: rnd(-4, 4), vz: rnd(8, 18), grav: -4, drag: 0.8, life: 1.6, max: 1.6, color: b.col, size: 1, glow: true, floor: false });
    if (b.t > BLOOM_LIFE) MYC.blooms.splice(i, 1);
  }
  // it keeps the world's time: held still, or hurried forward
  if (mycRealm()) {
    if (MYC.fx.still > 0) W.t -= dt;
    if (MYC.lapse > 0) { MYC.lapse -= dt; W.t += dt * DAY_LEN * 0.1; }
  }
  if (MYC.fx.bloom > 0 && p.hp < p.maxHp && !p.dead) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.01 * dt);
});
hook('onKill', (e) => {
  if (!e || e.type === 'ally' || !G.fl) return;
  const col = e.elem && ELEM[e.elem] ? ELEM[e.elem].glow : MYC_PULSE;
  mycSend(mycNearest(e.x, e.y, 110), 1, col, 6);
  if (!e.boss || Math.random() < 0.5) mycBloom(e.x, e.y, e.elem && ELEM[e.elem] ? ELEM[e.elem].glow : null);
  // Rot: everything returns at once, and takes its neighbours with it
  if (MYC.fx.rot > 0 && e.type === 'enemy') {
    const base = typeof weaponDamage === 'function' ? weaponDamage(G.p) : 10;
    G.fx.push({ kind: 'pool', x: e.x, y: e.y, r: 24, t: 0, life: 3, team: 'p', poison: true, base, tick: 0.2, color: '#b07ad8' });
    burst(e.x, e.y - 4, 10, ['#b07ad8', '#e0c8ff', '#8fe05c'], { smax: 60, glow: true });
  }
});
// Stillness thickens the time foes move through
const _walkMyc = walk;
walk = function (e, dx, dy, spd, dt) { return _walkMyc(e, dx, dy, MYC.fx.still > 0 && e.type === 'enemy' ? spd * 0.8 : spd, dt); };

/* ---------- drawing the threads ---------- */
hook('renderFloor', (g, cx, cy) => {
  if (!G.p || MYC.fl !== G.fl) return;
  const p = G.p, VW = R.VW, VH = R.VH, base = mycBase(), sight = MYC.fx.sight > 0 ? 0.42 : 0;
  const night = mycRealm() ? 1 + (1 - daylight()) * 0.5 : 1;
  const buckets = [[], [], [], [], [], []];
  for (const e of MYC.edges.values()) {
    const bx = e.box;
    if (bx[2] < cx || bx[0] > cx + VW || bx[3] < cy || bx[1] > cy + VH) continue;
    const pts = e.pts;
    for (let i = 2; i < pts.length; i += 2) {
      const mx = (pts[i] + pts[i - 2]) / 2, my = (pts[i + 1] + pts[i - 1]) / 2, d = Math.hypot(mx - p.x, my - p.y);
      const a = (Math.max(base, sight, d < 72 ? (1 - d / 72) * 0.22 : 0) + e.lit) * night;
      const q = Math.min(5, Math.round(a * 10));
      if (q > 0) buckets[q].push(pts[i - 2] - cx, pts[i - 1] - cy, pts[i] - cx, pts[i + 1] - cy);
    }
    if (base + sight + e.lit > 0.1) for (let i = 0; i < e.twigs.length; i += 4) buckets[1].push(e.twigs[i] - cx, e.twigs[i + 1] - cy, e.twigs[i + 2] - cx, e.twigs[i + 3] - cy);
  }
  g.lineWidth = 1;
  for (let q = 1; q < 6; q++) {
    const L = buckets[q];
    if (!L.length) continue;
    g.strokeStyle = rgbaStr(MYC_THREAD, Math.min(0.8, q / 10 + 0.04)); g.beginPath();
    for (let i = 0; i < L.length; i += 4) { g.moveTo(Math.round(L[i]) + 0.5, Math.round(L[i + 1]) + 0.5); g.lineTo(Math.round(L[i + 2]) + 0.5, Math.round(L[i + 3]) + 0.5); }
    g.stroke();
  }
  // the pulses: a bright head with a short tail
  for (const q of MYC.pulses) {
    for (let k = 0; k < 4; k++) {
      const [x, y] = mycAt(q.e, q.s - q.dir * k * 2.5);
      g.fillStyle = rgbaStr(k ? q.col : '#ffffff', Math.min(1, q.str * (1 - k * 0.22)));
      g.fillRect(Math.round(x - cx), Math.round(y - cy), 1, 1);
    }
  }
  const dark = mycRealm() ? daylight() < 0.35 : true;
  for (const b of MYC.blooms) drawBloom(g, b, cx, cy, dark);
});
const _lightsMyc = lightSources;
lightSources = function (vis) {
  const L = _lightsMyc(vis);
  if (MYC.fl !== G.fl) return L;
  for (const q of MYC.pulses) if (q.str > 0.3) { const [x, y] = mycAt(q.e, q.s); L.push({ x, y, r: 10 + q.str * 10, c: q.col, a: 0.3 * q.str }); }
  for (const b of MYC.blooms) if (b.t > 30 && b.t < 220) L.push({ x: b.x, y: b.y - 3, r: 14, c: b.col, a: 0.18 });
  const s = mycRealm() && W.Z.dmtSite;
  if (s && mycSiteFound(W.Z)) L.push({ x: s.px, y: s.py, r: 120, c: `#ffd8ff`, a: 0.35 });
  return L;
};

/* ============================================================
   DMT zones in the Realm: one in every land, a clearing where
   the ground breathes. It cannot be seen from far off; follow
   the pulses, and the air shimmers when you are close.
   ============================================================ */
const _planMyc = planFeatures;
planFeatures = function (Z) {
  const out = _planMyc(Z);
  try { placeDmtSite(Z); } catch (err) { /* a land without one */ }
  return out;
};
function placeDmtSite(Z) {
  const Rn = new RNG(hash2(Z.seed || 1, 0x6d7c)), prefer = ['giantshroom', 'stones', 'oldoak', 'shrine', 'obelisk', 'spire', 'eye', 'torii'];
  const marks = (Z.marks || []).slice().sort((a, b) => prefer.indexOf(b.kind) - prefer.indexOf(a.kind));
  let at = null;
  for (const m of marks) {
    for (let k = 0; k < 10 && !at; k++) { const a = Rn.next() * TAU, d = Rn.range(14, 24), tx = Math.round(m.x + Math.cos(a) * d), ty = Math.round(m.y + Math.sin(a) * d); if (walkableSite(Z, tx, ty, 6)) at = { x: tx, y: ty }; }
    if (at) break;
  }
  for (let k = 0; k < 60 && !at; k++) { const tx = Rn.int(160, ZT - 160), ty = Rn.int(160, ZT - 160); if (walkableSite(Z, tx, ty, 6)) at = { x: tx, y: ty }; }
  if (!at) return;
  stampDisc(Z, at.x, at.y, 6, MK.CLEAR | MK.NOSPAWN);
  Z.dmtSite = { x: at.x, y: at.y, px: (at.x + 0.5) * TS, py: (at.y + 0.5) * TS, r: 54 };
}
const mycSiteFound = (Z) => !!(W.ch && W.ch.dmtSites && W.ch.dmtSites.includes(Z.id));
hook('update', (dt) => {
  if (!mycRealm() || !G.p || !W.Z.dmtSite) return;
  const s = W.Z.dmtSite, p = G.p, d = Math.hypot(p.x - s.px, p.y - s.py), found = mycSiteFound(W.Z);
  if (!found) {
    // the air gives it away
    if (d < 220 && Math.random() < 0.6) { const a = rnd(TAU), r = rnd(0, s.r); G.parts.push({ x: s.px + Math.cos(a) * r, y: s.py + Math.sin(a) * r * 0.55, z: 2, vx: rnd(-8, 8), vy: rnd(-5, 5), vz: rnd(4, 14), grav: 0, drag: 0.5, life: 1.2, max: 1.2, color: `hsl(${(G.t * 120 + rnd(120)) % 360},90%,65%)`, size: 1, glow: true, floor: false }); }
    if (d < 170 && !s.hinted) { s.hinted = true; toast('The air shimmers here...', '#ff8ad8'); Sound.play('shimmer'); }
    if (d < 90) {
      W.ch.dmtSites = W.ch.dmtSites || []; W.ch.dmtSites.push(W.Z.id);
      banner('DMT Zone', 'the ground is breathing', 2.8); Sound.play('breakthrough');
      const fs = CD.save.fs; fs.dmtFound = (fs.dmtFound || 0) + 1; persist();
      burst(s.px, s.py, 30, ['#ff6f9c', '#7fc8ff', '#fff27a', '#7dff9a', '#c873ff'], { smax: 120, glow: true });
      if (typeof saveRealm === 'function') saveRealm();
    }
    return;
  }
  if (!MYC.elves) MYC.elves = Array.from({ length: 4 }, (_, i) => ({ x: s.px + rnd(-30, 30), y: s.py + rnd(-16, 16), vx: 0, vy: 0, i, t: rnd(3), say: null, sayT: 0 }));
  for (const el of MYC.elves) {
    el.t += dt;
    if (Math.random() < dt * 0.8) { const a = rnd(TAU); el.vx = Math.cos(a) * 24; el.vy = Math.sin(a) * 14; }
    const nx = el.x + el.vx * dt, ny = el.y + el.vy * dt;
    if (Math.hypot((nx - s.px) / s.r, (ny - s.py) / (s.r * 0.55)) < 0.9) { el.x = nx; el.y = ny; } else { el.vx *= -1; el.vy *= -1; }
    if (el.sayT > 0) el.sayT -= dt;
    else if (Math.hypot(p.x - el.x, p.y - el.y) < 60 && Math.random() < dt * 0.3) { el.say = rndPick(MYC_LINES); el.sayT = 2.6; Sound.play('elf', { p: 0.9 + el.i * 0.08 }); }
  }
  const inside = d < s.r;
  if (inside !== MYC.inSite) { MYC.inSite = inside; if (inside) Music.theme('dmt'); else realmMusic(true); }
});
const MYC_LINES = ['IT IS ALL ONE THING', 'EVERYTHING IS CONNECTED', 'THE ROOTS REMEMBER YOU', 'TIME IS A RING', 'YOU WERE A TREE ONCE', 'NOTHING ENDS HERE', 'LISTEN TO THE GROUND', 'WELCOME BACK', 'IT KNOWS YOUR NAME', 'THE CAPS ARE WATCHING'];
hook('renderFloor', (g, cx, cy) => {
  if (!mycRealm() || !W.Z.dmtSite || !mycSiteFound(W.Z)) return;
  const s = W.Z.dmtSite, t = G.t, mx = s.px - cx, my = s.py - cy;
  if (mx < -s.r || my < -s.r || mx > R.VW + s.r || my > R.VH + s.r) return;
  // the floor breathes in colour
  for (let ty = -4; ty <= 4; ty++) for (let tx = -6; tx <= 6; tx++) {
    const x = tx * 8, y = ty * 8 * 0.55, e = Math.hypot(x / s.r, y / (s.r * 0.55));
    if (e > 1) continue;
    const d = Math.hypot(x, y), k = Math.sin(d * 0.08 - t * 2.4) * 0.5 + 0.5, sym = Math.abs(Math.sin(Math.atan2(y, x) * 3 + t * 0.5));
    g.fillStyle = `hsla(${((t * 60 + d * 1.6 + sym * 120) % 360).toFixed(0)},85%,${(40 + k * 20).toFixed(0)}%,${(0.5 * (1 - e * 0.6)).toFixed(2)})`;
    g.fillRect(Math.round(mx + x - 4), Math.round(my + y - 2), 8, 5);
  }
  g.lineWidth = 1;
  for (let ring2 = 1; ring2 <= 3; ring2++) {
    const n = 6 + ring2 * 2, rr = ring2 * 15 + Math.sin(t * 1.3 + ring2) * 3;
    g.strokeStyle = `hsla(${(t * 90 + ring2 * 60) % 360},95%,72%,0.55)`; g.beginPath();
    for (let i = 0; i <= n; i++) { const a = (i / n) * TAU + t * (ring2 % 2 ? 0.3 : -0.3), rad = rr * (i % 2 ? 0.8 : 1); const px = mx + Math.cos(a) * rad, py = my + Math.sin(a) * rad * 0.55; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
    g.stroke();
  }
  // a ring of glowing caps around it
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU, x = Math.round(mx + Math.cos(a) * s.r), y = Math.round(my + Math.sin(a) * s.r * 0.55), hue = (t * 40 + i * 26) % 360;
    g.fillStyle = '#e8dcc8'; g.fillRect(x, y - 3, 1, 3);
    g.fillStyle = `hsl(${hue.toFixed(0)},80%,62%)`; g.fillRect(x - 2, y - 5, 5, 2); g.fillRect(x - 1, y - 6, 3, 1);
  }
});
hook('renderWorld', (g, cx, cy) => {
  if (!mycRealm() || !MYC.elves) return;
  for (const el of MYC.elves) {
    const sp = elfSprite(el.i, Math.floor(el.t * 5) % 2), x = el.x - cx, y = el.y - cy - Math.abs(Math.sin(el.t * 5)) * 3;
    shadow(g, x, el.y - cy, 4);
    drawSprite(g, sp, x, y, el.vx < 0);
  }
});
hook('renderTop', (g, cx, cy) => {
  if (!mycRealm()) return;
  const VW = R.VW, VH = R.VH;
  if (MYC.inSite) {
    const a = 0.1 + Math.sin(G.t * 1.7) * 0.04, hue = (G.t * 50) % 360;
    const grd = g.createRadialGradient(VW / 2, VH / 2, VH * 0.25, VW / 2, VH / 2, VH * 0.9);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, `hsla(${hue.toFixed(0)},90%,60%,${(a * 2).toFixed(3)})`);
    g.fillStyle = grd; g.fillRect(0, 0, VW, VH);
  }
  for (const el of MYC.elves || []) if (el.sayT > 0 && el.say) { const t = pixelText(el.say, `hsl(${(G.t * 100 + el.i * 70) % 360},90%,75%)`); g.globalAlpha = Math.min(1, el.sayT * 2); g.drawImage(t, Math.round(el.x - cx - t.width / 2), Math.round(el.y - cy - 24)); g.globalAlpha = 1; }
});

/* ---------- communing: what you are shown, and what you ask of it ---------- */
const MYC_CURRENTS = [
  { id: 'bloom', name: 'Bloom', sub: 'age the world forward', col: '#7dff9a',
    desc: (realm) => `${realm ? 'A quarter of a day passes in moments. ' : ''}Every grave in the network ripens, you are made whole, and you regrow 1% of your health each second ${realm ? 'for three minutes' : 'on this floor'}. Growth here runs eight times faster.` },
  { id: 'still', name: 'Stillness', sub: 'hold time', col: '#9fd8ff',
    desc: (realm) => `${realm ? 'The sun stops where it is. ' : ''}Foes move through thickened time, 20% slower, ${realm ? 'for three minutes' : 'for the rest of this floor'}.` },
  { id: 'rot', name: 'Rot', sub: 'everything returns', col: '#c58cff',
    desc: (realm) => `What you kill goes back into the ground at once and bursts into spores that poison everything near it, ${realm ? 'for three minutes' : 'for the rest of this floor'}.` },
];
function mycIcon(id) {
  const c = mkCanvas(16, 16), g = c.getContext('2d');
  if (id === 'bloom') { g.fillStyle = '#e8dcc8'; g.fillRect(7, 8, 2, 6); g.fillStyle = '#7dff9a'; g.fillRect(3, 5, 10, 3); g.fillRect(5, 3, 6, 2); g.fillStyle = '#ffffff'; g.fillRect(6, 4, 1, 1); g.fillRect(10, 6, 1, 1); g.fillStyle = '#3a8a4a'; g.fillRect(2, 14, 12, 1); }
  else if (id === 'still') { g.fillStyle = '#9fd8ff'; g.fillRect(4, 2, 8, 1); g.fillRect(4, 13, 8, 1); g.fillStyle = '#cfefff'; for (let i = 0; i < 5; i++) { g.fillRect(5 + i, 3 + i, 6 - i * 2 > 0 ? 6 - i * 2 : 1, 1); g.fillRect(5 + i, 12 - i, 6 - i * 2 > 0 ? 6 - i * 2 : 1, 1); } g.fillStyle = '#ffd35c'; g.fillRect(7, 10, 2, 2); }
  else { g.fillStyle = '#c58cff'; for (const [x, y, r] of [[5, 8, 3], [10, 7, 3.5], [8, 5, 2.5]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } g.fillStyle = '#8fe05c'; g.fillRect(4, 12, 1, 1); g.fillRect(11, 12, 1, 1); g.fillRect(7, 13, 1, 1); }
  c.style.width = '40px'; c.style.height = '40px';
  return c;
}
function mycCommune(where) {
  const realm = mycRealm(), p = G.p;
  const wrap = h('div', { class: 'choices' });
  const pick = (cur) => { UI.close(el); mycApply(cur, realm, where); };
  MYC_CURRENTS.forEach((cur, i) => {
    wrap.append(h('button', { class: 'card', type: 'button', style: { '--rc': cur.col }, 'data-autofocus': i === 0 ? true : null, onclick: () => pick(cur) },
      h('div', { class: 'head' }, mycIcon(cur.id), h('div', {}, h('div', { class: 'nm' }, cur.name), h('div', { class: 'sub' }, cur.sub))),
      h('p', { class: 'desc' }, cur.desc(realm))));
  });
  const el = h('div', { class: 'modal' }, h('div', { style: { display: 'grid', gap: '16px', justifyItems: 'center', width: 'min(100%, 980px)' } },
    h('div', { class: 'lv-head' }, h('b', {}, 'The Mycelium'), h('small', {}, `It shows you everything ${realm ? 'in this land' : 'on this floor'}, and asks what you want of it. Bond ${mycBond() + 1}.`)),
    wrap));
  el.addEventListener('keydown', (e) => { const n = +e.key; if (n >= 1 && n <= 3 && wrap.children[n - 1]) wrap.children[n - 1].click(); });
  UI.open(el, { modal: true, replace: false, onBack: () => {} });
  Sound.play('breakthrough');
  if (p) ring(p.x, p.y - 8, 40, '#ff8ad8', 0.8, 2);
}
function mycApply(cur, realm, where) {
  const p = G.p, dur = realm ? 180 : Infinity, fs = CD.save.fs;
  fs.mycBond = (fs.mycBond || 0) + 1; persist();
  if (where && where.room) where.room.communed = true;
  if (realm) { W.ch.mycAt = W.ch.mycAt || {}; W.ch.mycAt[W.Z.id] = W.t; }
  // sight: the whole of it shows, and so does everything it touches
  MYC.fx.sight = dur;
  if (!realm) for (const r of G.fl.rooms) r.seen = true;
  else if (W.disc) for (const m of W.Z.marks) { const x = Math.floor(m.x / 16), y = Math.floor(m.y / 16); if (x >= 0 && y >= 0 && x < DISC_N && y < DISC_N) W.disc[y * DISC_N + x] = 1; }
  MYC.fx[cur.id] = dur;
  if (cur.id === 'bloom') {
    heal(p, p.maxHp); p.poisonT = p.burnT = p.slowT = p.chillT = 0;
    for (const b of MYC.blooms) b.t = Math.max(b.t, 60);
    if (realm) MYC.lapse = 2.5;
  }
  if (cur.id === 'still' && realm) toast('The sun holds still', '#9fd8ff');
  // the network answers all at once
  for (const n of MYC.nodes) if (Math.hypot(n.x - p.x, n.y - p.y) < 260) mycSend(n, 0.7, cur.col, 2);
  banner(cur.name, 'the Mycelium answers', 2.4);
  Sound.play('ascend'); ring(p.x, p.y - 8, 90, cur.col, 1, 3);
  burst(p.x, p.y - 8, 30, [cur.col, '#ffffff', '#ff8ad8'], { smax: 140, glow: true });
}
// below: the well that takes souls also lets you commune, once a zone
const _soulWellMyc = soulWell;
soulWell = function (pr) {
  const r = G.room;
  if (!(G.run.souls > 0) && r && r.type === 'dmt' && !r.communed) return mycCommune({ room: r });
  return _soulWellMyc(pr);
};
// above: the clearing itself, once a day
const _interMyc = realmInteractables;
realmInteractables = function (Z) {
  const L = _interMyc(Z);
  if (Z.dmtSite && !L.includes(Z.dmtSite.obj)) { Z.dmtSite.obj = { kind: 'dmtsite', x: Z.dmtSite.px, y: Z.dmtSite.py }; L.push(Z.dmtSite.obj); }
  return L;
};
const _promptMyc = promptFor;
promptFor = function (t) {
  if (t && t.kind === 'prop' && t.pr.soulwell && !(G.run.souls > 0) && G.room && G.room.type === 'dmt' && !G.room.communed) return 'Commune with the Mycelium';
  if (t && t.kind === 'world' && t.type === 'dmtsite') return mycSiteFound(W.Z) ? 'Commune with the Mycelium' : 'The ground breathes here';
  return _promptMyc(t);
};
const _interactMyc = interact;
interact = function () {
  const t = nearestInteract();
  if (t && t.kind === 'world' && t.type === 'dmtsite') {
    if (!mycSiteFound(W.Z)) return;
    const last = W.ch.mycAt && W.ch.mycAt[W.Z.id];
    if (last != null && W.t - last < DAY_LEN && W.t >= last) { toast('It has answered you today. Come back tomorrow.', '#ff8ad8'); return; }
    return mycCommune(null);
  }
  return _interactMyc();
};
// the Records remember how close you have grown
CD.mycStatus = () => ({ bond: mycBond(), edges: MYC.edges.size, pulses: MYC.pulses.length, blooms: MYC.blooms.length, fx: { ...MYC.fx }, site: mycRealm() ? W.Z.dmtSite || null : null });

