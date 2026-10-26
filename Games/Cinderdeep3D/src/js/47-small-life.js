/* ============================================================
   Cinderdeep — the small life of the world. Butterflies by day
   and moths by night, birds that peck until you come close and
   then take off, rabbits and lizards that bolt, frogs, crabs,
   and rats and beetles below. Feet leave prints in snow, sand
   and mud, shallow water rings where you wade, and chimneys
   smoke.
   ============================================================ */
const CRIT_LAND = {
  meadows: ['butterfly', 'bird', 'rabbit'], whisper: ['bird', 'rabbit'], sakura: ['butterfly', 'bird'], autumn: ['bird', 'rabbit'], savanna: ['bird', 'lizard'],
  pine: ['bird', 'rabbit'], ossplains: ['crow'], murkmire: ['frog', 'frog', 'bird'], sporeveil: ['beetle'], elderwood: ['bird', 'rabbit', 'butterfly'],
  mangrove: ['frog', 'crab', 'bird'], storm: ['bird'], coral: ['crab', 'crab', 'bird'], frostpeak: ['snowhare'], desert: ['lizard'], ashlands: ['lizard'],
  canyon: ['lizard', 'bird'], jungle: ['butterfly', 'frog', 'bird'], feywild: ['butterfly', 'butterfly'], crystal: ['beetle'], shadowfen: ['frog'],
  caldera: ['lizard'], glacier: ['snowhare'], saltflats: ['crab'], voidscar: [],
  ossuary: ['rat'], grotto: ['beetle'], frost: [], core: ['lizard'],
};
const CRIT_FLY = { butterfly: 1, moth: 1 };
const CRIT = { list: [], spawnT: 0 };
const PRINT_LAND = { frostpeak: '#8aa4c0', glacier: '#8aa4c0', desert: '#a8865a', saltflats: '#b8b0a0', coral: '#b89a68', murkmire: '#3a3a26', mangrove: '#4a4630', ashlands: '#2a2424', savanna: '#9a7a4a' };
const PRINTS = [], RIPPLES = [];
function critLand() { return W.on && !W.inInst && W.Z ? W.Z.b.id : G.fl && G.fl.info && G.fl.info.act ? G.fl.info.act.id : ''; }
function critSpawn(kind, x, y) {
  const c = { kind, x, y, vx: 0, vy: 0, z: CRIT_FLY[kind] ? rnd(6, 14) : 0, st: 'idle', t: rnd(3), face: Math.random() < 0.5 ? -1 : 1, col: null, gone: false };
  if (kind === 'butterfly') c.col = rndPick(['#ffd35c', '#ff8ad8', '#7fc8ff', '#ffffff', '#ff9a3c']);
  if (kind === 'bird') c.col = rndPick(['#8a6a4a', '#6a6a72', '#a8784a']);
  CRIT.list.push(c);
}
const critGround = (x, y) => G.fl && !hitsWall(G.fl, x, y, 2, false) && tileAt(G.fl, Math.floor(x / TS), Math.floor(y / TS)) !== TILE.WATER;
hook('update', (dt) => {
  const p = G.p;
  if (!p || !G.fl || !dt) return;
  if (CRIT.fl !== G.fl) { CRIT.fl = G.fl; CRIT.list = []; PRINTS.length = 0; RIPPLES.length = 0; }
  const VW = R.VW, VH = R.VH, cx = G.cam.x, cy = G.cam.y, realm = W.on && !W.inInst && W.Z, night = realm ? daylight() < 0.3 : false;
  // who lives here, at this hour
  let kinds = (CRIT_LAND[critLand()] || []).slice();
  if (night) kinds = kinds.filter((k) => k !== 'butterfly' && k !== 'bird' && k !== 'crow').concat(kinds.length ? ['moth'] : []);
  const cap = CD.settings.lowFx ? 3 : realm ? 9 : 4;
  if (kinds.length && CRIT.list.length < cap && (CRIT.spawnT -= dt) <= 0 && !G.combat) {
    CRIT.spawnT = rnd(0.6, 1.6);
    const kind = rndPick(kinds), x = cx + rnd(-VW * 0.48, VW * 0.48), y = cy + rnd(-VH * 0.45, VH * 0.45);
    // never under your feet, never in a wall; below, only in rooms you can see
    if (Math.hypot(x - p.x, y - p.y) > 70 && (CRIT_FLY[kind] || critGround(x, y)) && (realm || (G.room && insideInterior(G.room, x, y, 4)))) {
      critSpawn(kind, x, y);
      if (kind === 'bird' || kind === 'crow') for (let i = 0; i < 2; i++) if (critGround(x + 10, y + 6)) critSpawn(kind, x + rnd(-12, 12), y + rnd(-8, 8));
    }
  }
  for (let i = CRIT.list.length - 1; i >= 0; i--) {
    const c = CRIT.list[i], d = Math.hypot(c.x - p.x, c.y - p.y), ax = (c.x - p.x) / (d || 1), ay = (c.y - p.y) / (d || 1);
    c.t += dt;
    const fear = c.kind === 'butterfly' || c.kind === 'moth' ? 20 : c.kind === 'frog' || c.kind === 'beetle' ? 34 : 58;
    if (c.st !== 'flee' && (d < fear || (p.swing && d < 80)) && !p.dead) {
      c.st = 'flee';
      if (c.kind === 'bird' || c.kind === 'crow') { c.vx = ax * rnd(70, 110); c.vy = ay * rnd(40, 70) - 20; Sound.play('swing', { p: 2.2, v: 0.12 }); }
      else if (CRIT_FLY[c.kind]) { c.vx = ax * 30; c.vy = ay * 20; }
      else { const sp = { rabbit: 110, snowhare: 110, lizard: 120, rat: 100, crab: 50, frog: 60, beetle: 30 }[c.kind] || 60; c.vx = ax * sp; c.vy = ay * sp; }
      c.face = c.vx < 0 ? -1 : 1;
    }
    if (c.st === 'flee') {
      if (c.kind === 'bird' || c.kind === 'crow') { c.z += dt * 40; c.vx *= 1 + dt * 0.4; }
      const nx = c.x + c.vx * dt, ny = c.y + c.vy * dt;
      if (CRIT_FLY[c.kind] || c.kind === 'bird' || c.kind === 'crow' || critGround(nx, ny)) { c.x = nx; c.y = ny; }
      else { c.vx = -c.vy; c.vy = c.vx * 0.5; }
      if (c.kind === 'frog' || c.kind === 'rabbit' || c.kind === 'snowhare') c.z = Math.abs(Math.sin(c.t * 9)) * (c.kind === 'frog' ? 4 : 3);
      if (d > 140 && !CRIT_FLY[c.kind] && c.kind !== 'bird' && c.kind !== 'crow') { c.st = 'idle'; c.vx = c.vy = 0; c.z = 0; }
    } else if (CRIT_FLY[c.kind]) {
      // a flutter: wandering on the air, drawn toward light at night
      if (Math.random() < dt * 1.5) { const a = rnd(TAU); c.vx = Math.cos(a) * 16; c.vy = Math.sin(a) * 10; }
      if (c.kind === 'moth' && d < 120) { c.vx += -ax * 30 * dt; c.vy += -ay * 30 * dt; }
      c.x += c.vx * dt; c.y += c.vy * dt; c.z = 9 + Math.sin(c.t * 3) * 4;
    } else if (Math.random() < dt * 0.5) {
      // pecking, nibbling, a little hop
      const a = rnd(TAU), nx = c.x + Math.cos(a) * 4, ny = c.y + Math.sin(a) * 3;
      if (critGround(nx, ny)) { c.x = nx; c.y = ny; c.face = Math.cos(a) < 0 ? -1 : 1; }
    }
    if (Math.abs(c.x - cx) > VW || Math.abs(c.y - cy) > VH) CRIT.list.splice(i, 1);
  }
  // prints and ripples where you walk
  if (p.moving && !p.dead && !p.fly && (p.z || 0) < 1) {
    CRIT.stepT = (CRIT.stepT || 0) - dt;
    if (CRIT.stepT <= 0) {
      CRIT.stepT = p.mounted ? 0.16 : 0.24; CRIT.foot = -(CRIT.foot || 1);
      const tile = tileAt(G.fl, Math.floor(p.x / TS), Math.floor(p.y / TS)), land = critLand(), side = Math.atan2(p.vy || 0, p.vx || 1) + Math.PI / 2;
      if (tile === TILE.SHALLOW) { if (RIPPLES.length < 24) RIPPLES.push({ x: p.x, y: p.y + 1, t: 0 }); }
      else if (PRINT_LAND[land] && realm) {
        if (PRINTS.length > 160) PRINTS.shift();
        PRINTS.push({ x: p.x + Math.cos(side) * CRIT.foot * 2, y: p.y + Math.sin(side) * CRIT.foot, t: 0, c: PRINT_LAND[land], hoof: !!p.mounted });
      }
    }
  }
  for (let i = PRINTS.length - 1; i >= 0; i--) if ((PRINTS[i].t += dt) > 20) PRINTS.splice(i, 1);
  for (let i = RIPPLES.length - 1; i >= 0; i--) if ((RIPPLES[i].t += dt) > 1.2) RIPPLES.splice(i, 1);
  // chimneys smoke
  if (realm && !CD.settings.lowFx && (CRIT.smokeT = (CRIT.smokeT || 0) - dt) <= 0) {
    CRIT.smokeT = 0.35;
    const Z = W.Z, c0x = Math.max(0, Math.floor((cx - VW) / TS / ZCH)), c1x = Math.min(ZCN - 1, Math.floor((cx + VW) / TS / ZCH)), c0y = Math.max(0, Math.floor((cy - VH) / TS / ZCH)), c1y = Math.min(ZCN - 1, Math.floor((cy + VH) / TS / ZCH));
    for (let yy = c0y; yy <= c1y; yy++) for (let xx = c0x; xx <= c1x; xx++) for (const o of Z.objs[yy * ZCN + xx]) {
      if (o.kind !== 'building' || !o.bld || Math.abs(o.x - cx) > VW * 0.6 || Math.abs(o.y - cy) > VH * 0.7) continue;
      const H2 = HOUSE[o.bld.style] || {}, roof = H2.roof;
      if (roof === 'tent' || roof === 'dome' || o.bld.type === 'tentshop' || hashU(o.x | 0, o.y | 0) < 0.35) continue;
      const sp = objSprite(o, Z.b);
      if (!sp) continue;
      const w = windAt(o.x, o.y, o) * 6;
      G.parts.push({ x: o.x - sp.ax + sp.w * 0.72, y: o.y, z: sp.ay - 3, vx: w + rnd(-2, 2), vy: rnd(-1, 1), vz: rnd(7, 12), grav: -2, drag: 0.4, life: 2.6, max: 2.6, color: rndPick(['#8a8a90', '#a8a8ae', '#6a6a72']), size: 2, glow: false, floor: false });
    }
  }
});
function drawCrit(g, c, cx, cy) {
  const x = Math.round(c.x - cx), y = Math.round(c.y - cy - c.z), f = Math.floor(c.t * (c.st === 'flee' ? 14 : 6)) % 2, s = c.face;
  const P = (dx, dy, col, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(s > 0 ? x + dx : x - dx - w + 1, y + dy, w, h); };
  if (c.z > 1) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(Math.round(c.x - cx) - 1, Math.round(c.y - cy), 3, 1); }
  switch (c.kind) {
    case 'butterfly': case 'moth': {
      const col = c.kind === 'moth' ? '#e8dcc0' : c.col, w = f ? 2 : 1;
      P(0, 0, '#2a2028', 1, 2); P(-w, -1, col, w, 2); P(1, -1, col, w, 2);
      break;
    }
    case 'bird': case 'crow': {
      const col = c.kind === 'crow' ? '#2a2430' : c.col;
      if (c.st === 'flee' && c.z > 2) { P(-1, 0, col, 3, 1); P(-3, f ? -2 : 1, col, 2, 1); P(2, f ? -2 : 1, col, 2, 1); P(2, 0, '#ffb35e'); }
      else { P(-1, -2, col, 3, 2); P(1, -3, col, 2, 1); P(3, -3, '#ffb35e'); P(0, 0, '#3a2a20', 1, 1); if (f && Math.random() < 0.3) P(2, -2, col); }
      break;
    }
    case 'rabbit': case 'snowhare': {
      const col = c.kind === 'snowhare' ? '#f0f4fa' : '#9a7a5a';
      P(-2, -2, col, 3, 2); P(0, -4, col, 2, 2); P(0, -6, col, 1, 2); P(1, -6, shade(col, -0.15), 1, 2); P(-3, -2, '#ffffff'); P(1, -3, '#1a1214');
      break;
    }
    case 'frog': P(-1, -2, '#5a8a3a', 3, 2); P(-1, -3, '#8ac85a'); P(1, -3, '#8ac85a'); P(0, -2, '#1a1214'); break;
    case 'crab': P(-1, -2, '#d8402a', 3, 2); P(-2, -3, '#ff6a4a'); P(2, -3, '#ff6a4a'); P(-2, 0, '#a8301a'); P(2, 0, '#a8301a'); break;
    case 'lizard': { const col = critLand() === 'ashlands' || critLand() === 'core' ? '#3a2a2a' : '#8a9a4a'; P(-2, -1, col, 4, 1); P(2, -2, col); P(-4, f ? -1 : 0, col, 2, 1); break; }
    case 'rat': P(-1, -2, '#6a6070', 3, 2); P(2, -2, '#8a8090'); P(-3, -1, '#c8a0a0', 2, 1); P(2, -3, '#1a1214'); break;
    case 'beetle': P(-1, -2, '#2a3a5a', 2, 2); P(-1, -2, '#5a7ad8'); P(-2, f ? 0 : -1, '#1a1214'); P(1, f ? -1 : 0, '#1a1214'); break;
  }
}
hook('renderFloor', (g, cx, cy) => {
  for (const q of PRINTS) {
    const a = q.t < 14 ? 0.5 : 0.5 * (1 - (q.t - 14) / 6);
    g.fillStyle = rgbaStr(q.c, a); g.fillRect(Math.round(q.x - cx), Math.round(q.y - cy), q.hoof ? 2 : 2, q.hoof ? 2 : 1);
  }
  g.lineWidth = 1;
  for (const r of RIPPLES) { const k = r.t / 1.2; g.strokeStyle = `rgba(230,246,255,${(0.55 * (1 - k)).toFixed(3)})`; g.beginPath(); g.ellipse(Math.round(r.x - cx), Math.round(r.y - cy), 2 + k * 9, 1 + k * 4, 0, 0, TAU); g.stroke(); }
  // what walks the ground walks under everything else
  for (const c of CRIT.list) if (!CRIT_FLY[c.kind] && c.z < 3) drawCrit(g, c, cx, cy);
});
hook('renderWorld', (g, cx, cy) => { for (const c of CRIT.list) if (CRIT_FLY[c.kind] || c.z >= 3) drawCrit(g, c, cx, cy); });
const _lightsCrit = lightSources;
lightSources = function (vis) {
  const L = _lightsCrit(vis);
  for (const c of CRIT.list) if (c.kind === 'moth') L.push({ x: c.x, y: c.y - c.z, r: 6, c: '#fff6d8', a: 0.15 });
  return L;
};
CD.critStatus = () => ({ crit: CRIT.list.map((c) => c.kind + ':' + c.st), prints: PRINTS.length, ripples: RIPPLES.length });

