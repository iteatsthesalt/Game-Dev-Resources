/* ============================================================
   Cinderdeep — the world: state, collision, damage, statuses,
   drops, particles, rooms and waves
   ============================================================ */
const G = {
  mode: 'title', menu: null, t: 0, dt: 0, hitstop: 0, slowmo: 0, warp: 0,
  run: null, fl: null, p: null,
  ents: [], projs: [], fx: [], parts: [], texts: [], picks: [], items: [],
  room: null, combat: false, waveIdx: 0, waveDelay: 0, boss: null,
  cam: { x: 0, y: 0, shake: 0, sx: 0, sy: 0, zoomKick: 0 },
  flow: null, flowT: 0, flash: 0, hurtFlash: 0, banner: null, demo: false,
};

/* ---------- tiles and collision ---------- */
const tileAt = (fl, tx, ty) => (tx < 0 || ty < 0 || tx >= fl.W || ty >= fl.H ? TILE.VOID : fl.tiles[ty * fl.W + tx]);
function doorBlocks(fl, tx, ty) {
  const di = fl.doorAt[ty * fl.W + tx];
  if (di < 0) return false;
  const d = fl.doors[di];
  return !d.open || d.locked || d.hidden;
}
// solid for movement; fly = ignores pits/hazards
function solidAt(fl, tx, ty, fly) {
  const t = tileAt(fl, tx, ty);
  if (SOLID_TILE[t]) return true;
  if (t === TILE.DOOR) return doorBlocks(fl, tx, ty);
  if (t === TILE.PIT && !fly) return true;
  return false;
}
// solid for missiles and sight (pits and hazards never block)
function blocksShot(fl, tx, ty) {
  const t = tileAt(fl, tx, ty);
  if (t === TILE.WALL || t === TILE.VOID || t === TILE.ROCK) return true;
  if (t === TILE.FACE) return true;
  if (t === TILE.DOOR) return doorBlocks(fl, tx, ty);
  return false;
}
function hitsWall(fl, x, y, r, fly) {
  const x0 = Math.floor((x - r) / TS), x1 = Math.floor((x + r - 0.01) / TS), y0 = Math.floor((y - r) / TS), y1 = Math.floor((y + r - 0.01) / TS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidAt(fl, tx, ty, fly)) return true;
  return false;
}
function lineOfSight(fl, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 6);
  for (let i = 1; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
    if (blocksShot(fl, Math.floor(x / TS), Math.floor(y / TS))) return false;
  }
  return true;
}
// move with tile collision, axis by axis, in small steps
function moveEnt(e, dx, dy) {
  const fl = G.fl, fly = e.fly || e.phase;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3));
  const sx = dx / steps, sy = dy / steps, r = e.r * 0.9;
  let bumped = false;
  for (let i = 0; i < steps; i++) {
    if (sx) { const nx = e.x + sx; if (e.phase ? !outOfRoom(e, nx, e.y) : !hitsWall(fl, nx, e.y, r, fly)) e.x = nx; else { bumped = true; if (e.vx) e.vx *= -0.2; } }
    if (sy) { const ny = e.y + sy; if (e.phase ? !outOfRoom(e, e.x, ny) : !hitsWall(fl, e.x, ny, r, fly)) e.y = ny; else { bumped = true; if (e.vy) e.vy *= -0.2; } }
  }
  // solid props push out
  for (const pid of roomProps(e)) {
    const pr = fl.props[pid];
    if (!pr.solid || pr.broken || pr.tileBound) continue;
    const d = Math.hypot(e.x - pr.x, e.y - pr.y), min = e.r + (pr.r || 6);
    if (d < min && d > 0.01) {
      const nx = pr.x + ((e.x - pr.x) / d) * min, ny = pr.y + ((e.y - pr.y) / d) * min;
      if (!hitsWall(fl, nx, ny, r, fly)) { e.x = nx; e.y = ny; }
      else if (!hitsWall(fl, nx, e.y, r, fly)) e.x = nx;
      else if (!hitsWall(fl, e.x, ny, r, fly)) e.y = ny;
    }
  }
  return bumped;
}
function roomProps(e) {
  const r = G.fl.rooms[e.room ?? (G.room ? G.room.id : 0)];
  return r ? r.props : [];
}
function outOfRoom(e, x, y) {
  const r = G.fl.rooms[e.room];
  if (!r) return false;
  return x < (r.ix) * TS + e.r || x > (r.ix + r.iw) * TS - e.r || y < (r.iy) * TS + e.r || y > (r.iy + r.ih) * TS - e.r;
}
function roomAtPx(x, y) {
  const fl = G.fl, tx = Math.floor(x / TS), ty = Math.floor(y / TS);
  if (tx < 0 || ty < 0 || tx >= fl.W || ty >= fl.H) return -1;
  return fl.roomOf[ty * fl.W + tx];
}
function insideInterior(r, x, y, margin = 0) {
  return x >= (r.ix + margin) * TS && x <= (r.ix + r.iw - margin) * TS && y >= (r.iy + margin) * TS && y <= (r.iy + r.ih - margin) * TS;
}
function randomFloorPoint(r, avoidX, avoidY, minD = 60, rng = null, clearDoors = false) {
  const fl = G.fl, R = rng ? () => rng.next() : Math.random;
  const entries = clearDoors ? doorEntries(fl, r) : null;
  for (let k = 0; k < 80; k++) {
    const tx = r.ix + Math.floor(R() * r.iw), ty = r.iy + Math.floor(R() * r.ih);
    const t = tileAt(fl, tx, ty);
    if (t !== TILE.FLOOR && t !== TILE.ICE) continue;
    if (entries && entries.some(([ex, ey]) => Math.abs(ex - tx) + Math.abs(ey - ty) <= 2)) continue;
    const x = (tx + 0.5) * TS, y = (ty + 0.5) * TS;
    if (avoidX != null && Math.hypot(x - avoidX, y - avoidY) < minD) continue;
    if (fl.props.some((p) => p.room === r.id && p.solid && !p.broken && Math.hypot(p.x - x, p.y - y) < 14)) continue;
    return { x, y };
  }
  return { x: (r.ix + r.iw / 2) * TS, y: (r.iy + r.ih / 2) * TS };
}

// nearest open floor spot (no rocks, pits, hazards or solid props) to a point inside room r
function freeSpotNear(r, x, y) {
  const fl = G.fl, tx0 = Math.floor(x / TS), ty0 = Math.floor(y / TS);
  const entries = doorEntries(fl, r);
  for (let rad = 0; rad < 8; rad++) {
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
      const tx = tx0 + dx, ty = ty0 + dy;
      if (tx < r.ix || ty < r.iy || tx >= r.ix + r.iw || ty >= r.iy + r.ih) continue;
      const t = tileAt(fl, tx, ty);
      if (t !== TILE.FLOOR && t !== TILE.ICE) continue;
      if (entries.some(([ex, ey]) => Math.abs(ex - tx) + Math.abs(ey - ty) <= 1)) continue;
      const px = (tx + 0.5) * TS, py = (ty + 0.5) * TS;
      if (fl.props.some((q) => q.room === r.id && q.solid && !q.broken && Math.hypot(q.x - px, q.y - py) < 15)) continue;
      // the tiles around must let you walk up to it
      let open = 0;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const t2 = tileAt(fl, tx + ax, ty + ay); if (t2 === TILE.FLOOR || t2 === TILE.ICE || t2 === TILE.TOXIC) open++; }
      if (open < 2) continue;
      return { x: dx === 0 && dy === 0 ? x : px, y: dx === 0 && dy === 0 ? y : py };
    }
  }
  return { x, y };
}

/* ---------- pathing: a distance field toward the player, per room ---------- */
function updateFlow(force) {
  const p = G.p, fl = G.fl, r = G.room;
  if (!r || !p) return;
  const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
  if (!force && G.flow && G.flow.room === r.id && G.flow.tx === ptx && G.flow.ty === pty && G.t - G.flowT < 0.6) return;
  G.flowT = G.t;
  const W = fl.W, x0 = r.x, y0 = r.y, w = r.w, h = r.h;
  const dist = G.flow && G.flow.room === r.id ? G.flow.d : new Int16Array(w * h);
  dist.fill(-1);
  const blocked = (tx, ty) => {
    const t = tileAt(fl, tx, ty);
    return SOLID_TILE[t] || t === TILE.PIT || t === TILE.LAVA || (t === TILE.DOOR && doorBlocks(fl, tx, ty));
  };
  const q = new Int32Array(w * h); let qh = 0, qt = 0;
  const sx = clamp(ptx - x0, 0, w - 1), sy = clamp(pty - y0, 0, h - 1);
  dist[sy * w + sx] = 0; q[qt++] = sy * w + sx;
  while (qh < qt) {
    const i = q[qh++], cx = i % w, cy = (i / w) | 0, nd = dist[i] + 1;
    for (let k = 0; k < 4; k++) {
      const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (dist[j] >= 0 || blocked(x0 + nx, y0 + ny)) continue;
      dist[j] = nd; q[qt++] = j;
    }
  }
  G.flow = { room: r.id, d: dist, x0, y0, w, h, tx: ptx, ty: pty };
}
// direction to walk toward the player along the field
function flowDir(e) {
  const F = G.flow;
  if (!F) return null;
  const tx = Math.floor(e.x / TS) - F.x0, ty = Math.floor(e.y / TS) - F.y0;
  if (tx < 0 || ty < 0 || tx >= F.w || ty >= F.h) return null;
  const here = F.d[ty * F.w + tx];
  let best = here < 0 ? 1e9 : here, bx = 0, by = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = tx + dx, ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= F.w || ny >= F.h) continue;
    const v = F.d[ny * F.w + nx];
    if (v < 0) continue;
    if (dx && dy && (F.d[ty * F.w + nx] < 0 || F.d[ny * F.w + tx] < 0)) continue; // no corner cutting
    const score = v + (dx && dy ? 0.4 : 0);
    if (score < best) { best = score; bx = dx; by = dy; }
  }
  if (!bx && !by) return null;
  const tx2 = (F.x0 + tx + bx + 0.5) * TS, ty2 = (F.y0 + ty + by + 0.5) * TS;
  const a = Math.atan2(ty2 - e.y, tx2 - e.x);
  return { x: Math.cos(a), y: Math.sin(a) };
}
function steerTo(e, tx, ty) {
  const fl = G.fl;
  if (e.fly || e.phase || lineOfSight(fl, e.x, e.y, tx, ty)) {
    const a = Math.atan2(ty - e.y, tx - e.x);
    return { x: Math.cos(a), y: Math.sin(a) };
  }
  return flowDir(e) || { x: Math.cos(Math.atan2(ty - e.y, tx - e.x)), y: Math.sin(Math.atan2(ty - e.y, tx - e.x)) };
}

/* ---------- game-time timers (pause with the game) ---------- */
G.timers = [];
function later(t, fn, always) { G.timers.push({ t, fn, always, actor: G.actor || null }); }
function updateTimers(dt) {
  for (let i = G.timers.length - 1; i >= 0; i--) {
    const k = G.timers[i];
    k.t -= dt;
    if (k.t <= 0) { G.timers.splice(i, 1); const pa = G.actor; G.actor = k.actor; try { k.fn(); } catch (e) { console.error(e); } G.actor = pa; }
  }
}

/* ---------- juice ---------- */
function shake(a) { if (CD.settings.shake) G.cam.shake = Math.min(14, Math.max(G.cam.shake, a * CD.settings.shake)); }
function hitstop(t) { G.hitstop = Math.max(G.hitstop, t); }
function addText(x, y, str, color = '#ffffff', big = 0) {
  if (G.texts.length > 60) G.texts.shift();
  G.texts.push({ x: x + rnd(-3, 3), y, vy: -38 - big * 12, life: 0.75 + big * 0.2, max: 0.75 + big * 0.2, str: String(str), color, big });
}
function burst(x, y, n, color, o = {}) {
  if (CD.settings.lowFx) n = Math.ceil(n / 2);
  for (let i = 0; i < n; i++) {
    if (G.parts.length > 700) G.parts.shift();
    const a = o.ang != null ? o.ang + rnd(-(o.spread ?? 0.6), o.spread ?? 0.6) : rnd(TAU), s = rnd(o.smin ?? 20, o.smax ?? 90);
    G.parts.push({
      x, y, z: o.z ?? 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: o.vz != null ? rnd(o.vz * 0.5, o.vz) : rnd(20, 70),
      grav: o.grav ?? 160, drag: o.drag ?? 2.4, life: rnd(o.lmin ?? 0.25, o.lmax ?? 0.6), max: 0, color: Array.isArray(color) ? rndPick(color) : color,
      size: o.size ?? (Math.random() < 0.3 ? 2 : 1), glow: !!o.glow, floor: o.floor ?? true,
    });
    G.parts[G.parts.length - 1].max = G.parts[G.parts.length - 1].life;
  }
}
function ring(x, y, r, color, life = 0.35, width = 2) { G.fx.push({ kind: 'ring', x, y, r0: r * 0.3, r, t: 0, life, color, width }); }
function flashLight(x, y, r, color, life = 0.2) { G.fx.push({ kind: 'flash', x, y, r, t: 0, life, color }); }

/* ---------- player damage ---------- */
const HIT = { NONE: 0, HIT: 1, BLOCK: 2, REFLECT: 3 };
function hurtPlayer(amount, src = {}) {
  const p = G.p;
  if (!p || p.dead || G.mode !== 'play') return HIT.NONE;
  if (p.stoneT > 0 && src.proj) { src.proj.team = 'p'; src.proj.vx *= -1.1; src.proj.vy *= -1.1; src.proj.hit = new Set(); src.proj.src = 'ability'; ring(p.x, p.y - 8, 12, '#c8bfa8', 0.25); Sound.play('block', { p: 0.7 }); return HIT.REFLECT; }
  if (p.iframes > 0 || p.dashT > 0 || p.barrierT > 0 || p.leapT > 0 || p.veilT > 0 || CD.debug.god) {
    if (p.barrierT > 0 && src.proj) { src.proj.team = 'p'; src.proj.vx *= -1.2; src.proj.vy *= -1.2; src.proj.hit = new Set(); src.proj.src = 'ability'; return HIT.REFLECT; }
    return HIT.NONE;
  }
  const s = p.stats;
  if (Math.random() < s.dodge) { addText(p.x, p.y - 18, 'DODGE', '#8ad8ff'); p.iframes = 0.25; return HIT.NONE; }
  if (p.shieldHits > 0) {
    p.shieldHits--; p.iframes = 0.5; Sound.play('block'); ring(p.x, p.y - 8, 18, '#cfe9ff', 0.3);
    addText(p.x, p.y - 18, 'BLOCK', '#cfe9ff'); p.haloT = 0; return HIT.BLOCK;
  }
  if (p.bulwarkT <= 0 && s.bulwark) { p.bulwarkT = s.bulwark; p.iframes = 0.5; Sound.play('block'); ring(p.x, p.y - 8, 18, '#ffd35c', 0.3); addText(p.x, p.y - 18, 'BLOCK', '#ffd35c'); return HIT.BLOCK; }
  let dmg = amount * s.dmgTaken;
  for (let i = 0; i < HOOKS.preHurt.length; i++) dmg = HOOKS.preHurt[i](dmg, src, p);
  dmg = dmg * (1 - s.armor / (s.armor + 10));
  dmg = Math.max(1, Math.round(dmg));
  p.hp -= dmg; p.haloT = 0;
  G.run.stats.dmgTaken += dmg;
  p.iframes = 0.75; p.hurtT = 0.25;
  G.hurtFlash = 0.35;
  addText(p.x, p.y - 20, dmg, '#ff5a5a', 1);
  burst(p.x, p.y - 6, 8, ['#e2434f', '#a8202a'], { smax: 70 });
  Sound.play('hurt'); shake(5); hitstop(0.05);
  runHooks('onHurt', dmg, src, p);
  if (src.ent && s.thorns && !src.proj) damageEnemy(src.ent, s.thorns, { src: 'thorns', noCrit: true, color: '#a8e070' });
  if (src.kx != null && !s.sturdy) { p.vx += src.kx; p.vy += src.ky; }
  if (p.hp <= 0) playerAtZero(p);
  return HIT.HIT;
}
// a killing blow: guardian angels, feathers and phylacteries get a say first
function playerAtZero(p) {
  const s = p.stats;
  {
    if (s.angel && !p.angelUsed) { p.angelUsed = true; p.hp = 1; p.iframes = 1.5; banner('Guardian Angel', 'a killing blow, turned aside'); Sound.play('heal'); ring(p.x, p.y - 8, 40, '#ffe8a0', 0.6); return HIT.HIT; }
    if (s.phoenix && !p.phoenixUsed) { p.phoenixUsed = true; p.hp = Math.round(p.maxHp * 0.5); p.iframes = 2; burnRelic('phoenix'); rebirth('The feather burns away'); return HIT.HIT; }
    if (p.reviveLeft > 0) { p.reviveLeft--; p.hp = Math.round(p.maxHp * 0.4); p.iframes = 2; rebirth('Last Ember'); return HIT.HIT; }
    for (let i = 0; i < HOOKS.deathSave.length; i++) if (HOOKS.deathSave[i](p)) return HIT.HIT;
    p.hp = 0; playerDie();
  }
  return HIT.HIT;
}
function rebirth(label) {
  const p = G.p;
  banner('Reborn', label); Sound.play('levelup'); shake(8);
  ring(p.x, p.y - 8, 70, '#ffb35e', 0.7, 3); burst(p.x, p.y - 6, 40, ['#ff7a2a', '#ffd08a', '#ffffff'], { smax: 140, glow: true });
  for (const e of G.ents) if (!e.dead && e.type !== 'ally' && Math.hypot(e.x - p.x, e.y - p.y) < 80) damageEnemy(e, 50, { src: 'ability', noCrit: true });
}
function heal(p, amt, silent) {
  if (!p || p.dead) return 0;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + amt);
  const got = Math.round(p.hp - before);
  if (got > 0 && !silent && got >= 1) addText(p.x, p.y - 22, '+' + got, '#7dff9a');
  return got;
}

/* ---------- enemy damage, statuses, deaths ---------- */
// multi-part monsters (the wyrm) can be hit anywhere along the body
function closestPart(e, x, y) {
  let bx = e.x, by = e.y - e.h * 0.45, d = Math.hypot(bx - x, by - y);
  if (e.segs) for (const s of e.segs) { const q = Math.hypot(s.x - x, s.y - 6 - y); if (q < d) { d = q; bx = s.x; by = s.y - 6; } }
  return { x: bx, y: by, d };
}
function damageEnemy(e, amount, o = {}) {
  if (!e || e.dead || e.spawnT > 0 || e.type === 'ally' || e.hidden) return 0;
  const p = G.p, s = p.stats;
  if (e.invuln) { if (!o.dot && e.boss && (!e.immT || G.t - e.immT > 0.8)) { e.immT = G.t; addText(e.x, e.y - e.h, 'IMMUNE', '#9aa0a8'); } return 0; }
  let dmg = amount, crit = false;
  if (!o.dot) {
    if (s.firstStrike && e.hp >= e.maxHp * 0.9) dmg *= 1 + s.firstStrike;
    if (s.shatter && e.freezeT > 0) dmg *= 1 + s.shatter;
    if (s.markFirst && !e.marked) { e.marked = true; dmg *= 2; }
    if (o.rend && e.hp < e.maxHp * 0.5) dmg *= 1.3;
    if (!o.noCrit) {
      const cc = s.crit + (o.critAdd || 0);
      if (p.critNext > 0 && o.src === 'weapon') { crit = true; p.critNext--; }
      else if (Math.random() < cc) crit = true;
      if (crit) dmg *= s.critMul;
    }
  }
  for (let i = 0; i < HOOKS.dmgMul.length; i++) dmg *= HOOKS.dmgMul[i](e, o, p, crit);
  if (e.armor) dmg *= 1 - e.armor;
  if (e.shieldHp > 0) {
    const ab = Math.min(e.shieldHp, dmg); e.shieldHp -= ab; dmg -= ab;
    if (e.shieldHp <= 0) { ring(e.x, e.y - e.h / 2, 16, '#cfe9ff', 0.3); Sound.play('block'); }
  }
  if (e.dmgTakenMul) dmg *= e.dmgTakenMul;
  dmg = Math.max(o.dot ? 0.5 : 1, dmg);
  e.hp -= dmg;
  G.run.stats.dmgDealt += dmg;
  if (!o.dot) {
    e.flash = 0.1;
    if (s.lifesteal || o.leech) heal(p, dmg * (s.lifesteal + (o.leech || 0)), true);
  }
  const shown = Math.round(dmg);
  if (shown >= 1 || !o.dot) addText(e.x, e.y - e.h - 2, shown, o.color || (crit ? '#ffd35c' : '#ffffff'), crit ? 1 : 0);
  if (!o.dot && !o.silent) {
    Sound.play(crit ? 'crit' : 'hit', { p: rnd(0.9, 1.1) });
    burst(e.x, e.y - e.h / 2, crit ? 7 : 4, e.blood || ['#e2434f', '#a8202a'], { smax: crit ? 110 : 70, ang: o.ang, spread: 0.9 });
    if (crit) { hitstop(0.045); shake(2.5); }
  }
  // knockback and stun
  if (o.kb && !e.rooted && !e.boss) {
    const mass = e.big ? 2.5 : 1;
    e.kx += (Math.cos(o.ang) * o.kb * s.kbMul) / mass; e.ky += (Math.sin(o.ang) * o.kb * s.kbMul) / mass;
  }
  if (o.stun && !e.boss) e.stunT = Math.max(e.stunT, o.stun);
  if (o.stunCh && !e.boss && Math.random() < o.stunCh) e.stunT = Math.max(e.stunT, 0.6);
  // elemental procs (weapons, abilities)
  if (!o.dot && !o.noProc) {
    const base = amount;
    if (Math.random() < (o.burn || 0) + (o.src === 'weapon' ? s.burnCh : 0)) applyBurn(e, base);
    if (Math.random() < (o.poison || 0) + (o.src === 'weapon' ? s.poisonCh : 0)) applyPoison(e, base);
    if (Math.random() < (o.chill || 0) + (o.src === 'weapon' ? s.chillCh : 0)) applyChill(e);
    if (Math.random() < (o.shock || 0) + (o.src === 'weapon' ? s.shockCh : 0)) applyShock(e, base);
    if (o.src === 'weapon') {
      p.hitCount = (p.hitCount || 0) + 1;
      if (p.cls === 'storm' && p.hitCount % 5 === 0) applyShock(e, Math.max(8, base));
      const lg = p.weapon && p.weapon.legend;
      if (lg === 'tempest' && crit) lightningStrike(e.x, e.y, base * 1.5);
      if (lg === 'midas' && Math.random() < 0.08) dropPickup('gold', e.x, e.y, 1);
    }
  }
  if (!o.dot) runHooks('onHit', e, dmg, o, crit);
  if (s.cull && e.hp > 0 && e.hp < e.maxHp * s.cull && !e.boss) { e.hp = 0; addText(e.x, e.y - e.h - 10, 'CULL', '#ff7a5c'); }
  if (e.hp <= 0 && !e.dead) killEnemy(e, { crit, src: o.src });
  else if (e.boss && e.onHurt) e.onHurt(e);
  return dmg;
}
function applyBurn(e, base) {
  if (e.fireproof) return;
  const s = G.p.stats, dps = Math.max(2, base * 0.28) * s.burnMul;
  e.burn = { t: 3 * s.burnDur, dps: Math.max(e.burn ? e.burn.dps : 0, dps), tick: e.burn ? e.burn.tick : 0.5 };
}
function applyPoison(e, base) {
  const st = e.poison ? Math.min(10, e.poison.stacks + 1) : 1;
  e.poison = { t: 4, stacks: st, per: Math.max(1, base * 0.12), tick: e.poison ? e.poison.tick : 0.5 };
}
function applyChill(e, strong) {
  if (e.boss) { e.chillT = 1.5; return; }
  e.chillT = 2.5; e.chillN = (e.chillN || 0) + (strong ? 3 : 1);
  if (e.chillN >= 3 && e.freezeT <= 0) { e.freezeT = 1.3; e.chillN = 0; Sound.play('ice', { v: 0.6 }); burst(e.x, e.y - 6, 6, ['#e9f8ff', '#9fe0ff'], { smax: 60 }); }
}
function applyShock(e, base) {
  const s = G.p.stats;
  e.stunT = Math.max(e.stunT, 0.15);
  let from = e, hit = new Set([e]);
  const n = s.shockChain;
  zapFx(e.x, e.y - e.h / 2, e.x, e.y - e.h / 2 - 1);
  for (let k = 0; k < n; k++) {
    let best = null, bd = 70;
    for (const o of G.ents) if (!o.dead && o.type !== 'ally' && !hit.has(o) && o.spawnT <= 0) { const d = Math.hypot(o.x - from.x, o.y - from.y); if (d < bd) { bd = d; best = o; } }
    if (!best) break;
    hit.add(best);
    zapFx(from.x, from.y - from.h / 2, best.x, best.y - best.h / 2);
    damageEnemy(best, Math.max(4, base * 0.5), { src: 'shock', noProc: true, noCrit: true, color: '#fff27a', silent: true });
    from = best;
  }
  Sound.play('zap', { v: 0.6 });
}
function zapFx(x0, y0, x1, y1, color = '#fff27a', life = 0.16) {
  G.fx.push({ kind: 'zap', x0, y0, x1, y1, t: 0, life, color, seed: Math.random() * 1000 });
}
function lightningStrike(x, y, dmg) {
  G.fx.push({ kind: 'bolt', x, y, t: 0, life: 0.3, seed: Math.random() * 1000 });
  flashLight(x, y, 70, '#fff6b0', 0.2);
  Sound.play('thunder', { v: 0.7 }); shake(3);
  for (const e of G.ents) if (!e.dead && e.type !== 'ally' && Math.hypot(e.x - x, e.y - y) < 22) damageEnemy(e, dmg, { src: 'ability', noCrit: true, color: '#fff27a', stun: 0.3 });
}
function explode(x, y, r, dmg, o = {}) {
  G.fx.push({ kind: 'boom', x, y, r, t: 0, life: 0.4, color: o.color || '#ffb35e' });
  flashLight(x, y, r * 2.2, o.color || '#ffb35e', 0.25);
  burst(x, y, 16, o.parts || ['#ffd08a', '#ff7a2a', '#c4401c', '#5a4a4a'], { smax: 150, glow: true, vz: 90 });
  Sound.play(o.sound || 'boom', { v: o.vol ?? 0.8 }); shake(o.shake ?? 5);
  if (o.team !== 'e') {
    for (const e of G.ents) if (!e.dead && e.type !== 'ally' && closestPart(e, x, y - 6).d < r + e.r) damageEnemy(e, dmg, { src: o.src || 'ability', noCrit: !o.crit, burn: o.burn, poison: o.poison, chill: o.chill, kb: 120, ang: Math.atan2(e.y - y, e.x - x), color: o.textColor });
    breakPropsIn(x, y, r);
  }
  if (typeof revealSecretAt === 'function') revealSecretAt(x, y, r + 10);
  if (o.scorch !== false && typeof scorch === 'function') scorch(x, y, r);
  if (o.team === 'e' || o.hurtsPlayer) {
    const p = G.p;
    if (Math.hypot(p.x - x, p.y - y) < r + p.r) hurtPlayer(o.pdmg ?? dmg, { kx: Math.cos(Math.atan2(p.y - y, p.x - x)) * 160, ky: Math.sin(Math.atan2(p.y - y, p.x - x)) * 160 });
  }
}
function breakPropsIn(x, y, r) {
  if (!G.room) return;
  for (const pid of G.room.props) { const pr = G.fl.props[pid]; if (pr.breakable && !pr.broken && Math.hypot(pr.x - x, pr.y - y) < r + 6) breakProp(pr); }
}
function breakProp(pr) {
  if (pr.broken) return;
  pr.broken = true; pr.solid = false;
  if (pr.explosive) { kegBlast(pr); return; }
  const col = pr.kind === 'pot' ? ['#a86a3a', '#7a4a2a', '#c88a5a'] : ['#8a5a32', '#5e3a1e', '#a8743e'];
  burst(pr.x, pr.y - 5, 10, col, { smax: 90 });
  Sound.play('pop', { p: 1.4, v: 0.5 });
  const R = Math.random();
  if (R < 0.4) dropPickup('gold', pr.x, pr.y, 1 + (Math.random() < 0.3 ? 1 : 0));
  else if (R < 0.47) dropPickup('heart', pr.x, pr.y, 1);
  else if (R < 0.5) dropPickup('key', pr.x, pr.y, 1);
}

function killEnemy(e, info = {}) {
  if (e.dead) return;
  e.dead = true; e.hp = 0;
  const p = G.p, s = p.stats, run = G.run;
  if (e.type === 'ally') return;
  run.stats.kills++;
  run.kinds[e.kind] = (run.kinds[e.kind] || 0) + 1;
  if (CD.save) { CD.save.codex = CD.save.codex || {}; CD.save.codex[e.kind] = (CD.save.codex[e.kind] || 0) + 1; }
  runHooks('onKill', e, info);
  Sound.play(e.bone ? 'bones' : 'die', { p: rnd(0.85, 1.15) });
  burst(e.x, e.y - e.h / 2, e.big ? 22 : 12, e.blood || ['#e2434f', '#a8202a'], { smax: 130, vz: 90 });
  const fallSp = crigCorpse(e);
  G.fx.push({ kind: 'corpse', x: e.x, y: e.y, sp: fallSp || (e.frames ? e.frames[0] : null), face: e.face, t: 0, life: fallSp ? 0.6 : 0.45, fall: !!fallSp });
  if (e.boss) return bossDefeated(e);
  if (e.summoned) return;
  // rewards
  const xp = Math.round(e.xp * s.xpMul * (e.eliteMods ? 4 : 1) * (1 + Math.min(0.5, (G.combo ? G.combo.n : 0) * 0.01)) * (G.omenXp || 1));
  dropXP(e.x, e.y, xp);
  const gold = e.gold * s.goldMul * (e.eliteMods ? 4 : 1) * (1 + 0.15 * G.fl.info.actIdx);
  let g = Math.floor(gold) + (Math.random() < gold % 1 ? 1 : 0);
  if (g > 0) dropPickup('gold', e.x, e.y, g);
  const heartP = (run.heat >= 7 ? 0.025 : 0.045) * (G.omenHearts || 1);
  if (Math.random() < heartP) dropPickup('heart', e.x, e.y, 1);
  if (e.eliteMods) {
    dropPickup('ember', e.x, e.y, 2 + Math.floor(Math.random() * 3));
    if (Math.random() < 0.35) dropPickup('potion', e.x, e.y, 1);
    if (Math.random() < 0.3) dropPickup('key', e.x, e.y, 1);
  } else if (Math.random() < (s.keyHunter ? 0.03 : 0.01)) dropPickup('key', e.x, e.y, 1);
  // on-kill effects
  if (s.killHeal) heal(p, s.killHeal, true);
  if (p.weapon && p.weapon.legend === 'ravenous') heal(p, 3);
  if (s.frenzy) { p.frenzyN = Math.min(6, (p.frenzyN || 0) + 1); p.frenzyT = 4; }
  if (e.burn && (s.combust || (p.weapon && p.weapon.legend === 'inferno'))) explode(e.x, e.y, 28, 10 + G.fl.idx * 2.5, { color: '#ff9a3c', vol: 0.5, shake: 2 });
  else if (Math.random() < s.boomOnKill) explode(e.x, e.y, 26, 10 + G.fl.idx * 2.5, { color: '#ffd08a', vol: 0.5, shake: 2 });
  if (e.poison && s.plague) for (const o of G.ents) if (!o.dead && o.type !== 'ally' && Math.hypot(o.x - e.x, o.y - e.y) < 50) { applyPoison(o, e.poison.per / 0.12); o.poison.stacks = Math.max(o.poison.stacks, e.poison.stacks); }
  if (e.chillT > 0 && p.weapon && p.weapon.legend === 'glacial') for (let i = 0; i < 6; i++) spawnProj({ team: 'p', x: e.x, y: e.y - 6, ang: (i * TAU) / 6, speed: 220, dmg: weaponDamage() * 0.5, life: 0.4, kind: 'shard', chill: 0.5, r: 3 });
  if (p.cls === 'necro' && Math.random() < 0.12) spawnAlly('ally_skel', e.x, e.y, 12);
  if (e.split && !e.small) for (let i = 0; i < 2; i++) spawnEnemy(e.split, e.x + rnd(-6, 6), e.y + rnd(-6, 6), { noSpawnAnim: true, room: e.room });
  if (e.eliteMods) {
    if (e.eliteMods.includes('volatile')) explode(e.x, e.y, 34, 0, { team: 'e', pdmg: e.dmg * 1.2, color: '#ffb35e' });
    if (e.eliteMods.includes('splitter')) for (let i = 0; i < 2; i++) spawnEnemy(e.kind, e.x + rnd(-8, 8), e.y + rnd(-8, 8), { noSpawnAnim: true, room: e.room, mini: true });
  }
  if (e.onDeath) e.onDeath(e);
}

/* ---------- drops and pickups ---------- */
function dropPickup(kind, x, y, value = 1) {
  const a = rnd(TAU), s = rnd(30, 70);
  G.picks.push({ kind, x, y, z: 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(60, 110), value, t: 0, magnet: false });
}
function dropXP(x, y, amount) {
  while (amount > 0) {
    const v = amount >= 25 ? 25 : amount >= 5 ? 5 : 1;
    amount -= v;
    dropPickup(v >= 25 ? 'xpbig' : 'xp', x, y, v);
    if (G.picks.length > 300) break;
  }
}
function updatePickups(dt) {
  const p = G.p, fl = G.fl;
  for (let i = G.picks.length - 1; i >= 0; i--) {
    const k = G.picks[i];
    k.t += dt;
    if (k.z > 0 || k.vz > 0) { k.vz -= 320 * dt; k.z += k.vz * dt; if (k.z <= 0) { k.z = 0; k.vz = k.vz < -40 ? -k.vz * 0.35 : 0; } }
    const d = Math.hypot(p.x - k.x, p.y - k.y);
    const auto = k.kind === 'xp' || k.kind === 'xpbig' || k.kind === 'gold' || k.kind === 'ember' || k.kind === 'soul' || k.kind === 'soulbig';
    const pr = p.stats.pickR * (auto ? 1 : 0.55);
    if ((d < pr || k.magnet || (auto && !G.combat && k.t > 0.6 && d < 400)) && k.t > 0.25 && !p.dead) {
      if (canTake(k)) {
        k.magnet = true;
        const a = Math.atan2(p.y - k.y, p.x - k.x), sp = 140 + k.t * 120;
        k.vx = lerp(k.vx, Math.cos(a) * sp, 0.25); k.vy = lerp(k.vy, Math.sin(a) * sp, 0.25);
      }
    } else { k.vx *= Math.pow(0.02, dt); k.vy *= Math.pow(0.02, dt); }
    const nx = k.x + k.vx * dt, ny = k.y + k.vy * dt;
    if (!k.magnet && hitsWall(fl, nx, ny, 3, false)) { k.vx *= -0.5; k.vy *= -0.5; } else { k.x = nx; k.y = ny; }
    if (d < p.r + 6 && k.t > 0.25 && canTake(k)) { takePickup(k); G.picks.splice(i, 1); }
  }
}
function canTake(k) {
  const p = G.p;
  if (k.kind === 'heart') return p.hp < p.maxHp;
  if (k.kind === 'potion') return p.potions < p.stats.potMax || p.hp < p.maxHp;
  return true;
}
function takePickup(k) {
  const p = G.p;
  switch (k.kind) {
    case 'xp': case 'xpbig': gainXP(k.value); Sound.play('xp', { p: 1 + Math.min(0.6, (p.xpCombo || 0) * 0.03) }); p.xpCombo = (p.xpCombo || 0) + 1; p.xpComboT = 0.6; break;
    case 'gold': p.gold += k.value; G.run.stats.gold += k.value; Sound.play('coin'); addText(k.x, k.y - 8, '+' + k.value, '#ffd35c'); break;
    case 'heart': heal(p, Math.round(p.maxHp * 0.12)); Sound.play('heal'); break;
    case 'potion':
      if (p.potions < p.stats.potMax) { p.potions++; addText(k.x, k.y - 8, 'Potion', '#ff8a8a'); Sound.play('pickup'); }
      else { heal(p, Math.round(p.maxHp * p.stats.potHeal)); Sound.play('potion'); }
      break;
    case 'key': p.keys++; addText(k.x, k.y - 8, 'Key', '#ffd35c'); Sound.play('pickup', { p: 1.2 }); break;
    case 'ember': { const n = Math.max(1, Math.round(k.value * p.stats.emberMul)); G.run.embers += n; addText(k.x, k.y - 8, '+' + n + ' embers', '#ffb35e'); Sound.play('pickup', { p: 0.8 }); break; }
  }
}
function gainXP(v) {
  const p = G.p;
  p.xp += v;
  while (p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    p.pendingLevels = (p.pendingLevels || 0) + 1;
    Sound.play('levelup');
    ring(p.x, p.y - 8, 40, '#ffd35c', 0.6, 3);
    burst(p.x, p.y - 8, 24, ['#ffd35c', '#fff0a0', '#ffffff'], { smax: 120, glow: true, vz: 120 });
    addText(p.x, p.y - 28, 'LEVEL UP', '#ffd35c', 1);
    runHooks('onLevel', p);
  }
}

/* ---------- spawning ---------- */
function scaleFor(idx) {
  const heat = G.run ? G.run.heat : 0;
  const loop = Math.floor(idx / TOTAL_FLOORS);
  const hp = (1 + 0.24 * idx + 0.018 * idx * idx) * (1 + loop * 0.8) * (1 + (heat >= 1 ? 0.15 : 0)) * (1 + (G.p ? G.p.stats.foeHp : 0));
  const dmg = (1 + 0.1 * idx) * (1 + loop * 0.4) * (heat >= 3 ? 1.15 : 1);
  const spd = heat >= 4 ? 1.1 : 1;
  return { hp, dmg, spd };
}
function spawnEnemy(kind, x, y, o = {}) {
  const def = ENEMIES[kind];
  if (!def) return null;
  const sc = scaleFor(G.fl.idx);
  const tint = def.tint;
  const frames = monsterFrames(def.sprite, { tint, small: def.small, ghostly: def.ghostly });
  const e = {
    type: def.ally ? 'ally' : 'enemy', kind, def, x, y, vx: 0, vy: 0, kx: 0, ky: 0, r: def.r, h: frames[0].h - 4,
    maxHp: def.hp * sc.hp, hp: 0, spd: def.spd * sc.spd * rnd(0.92, 1.08), dmg: def.dmg * sc.dmg, xp: def.xp || 0, gold: def.gold || 0,
    fly: !!def.fly, phase: !!def.phase, rooted: !!def.rooted, big: !!def.big, small: !!def.small, split: def.split, armor: def.armor || 0,
    fireproof: !!def.fireproof, bone: !!def.bone, frames, face: 1, anim: rnd(1), flash: 0, stunT: 0, freezeT: 0, chillT: 0, chillN: 0,
    st: 'idle', stT: rnd(0.3, 1.2), atkCd: rnd(0.6, 1.6), contactCd: 0.3, room: o.room ?? (G.room ? G.room.id : 0), spawnT: o.noSpawnAnim ? 0 : 0.7,
    blood: bloodFor(kind), dead: false,
  };
  runHooks('spawned', e, o);
  if (o.mini) { e.maxHp *= 0.4; e.r *= 0.8; e.xp *= 0.3; e.gold *= 0.3; e.mini = true; }
  if (o.elite) makeElite(e, o.mods);
  e.hp = e.maxHp;
  G.ents.push(e);
  if (e.spawnT > 0) { G.fx.push({ kind: 'summon', x, y, t: 0, life: 0.7, r: e.r + 6, color: e.eliteMods ? '#ffd35c' : '#c873ff' }); }
  return e;
}
function bloodFor(kind) {
  const B = { skeleton: ['#e8e0cc', '#b8ae96'], archer: ['#e8e0cc', '#b8ae96'], slime: ['#5fd36a', '#3f9a2a'], slimelet: ['#7fe38a', '#3f9a2a'], ghost: ['#dfe8f2', '#a8c0d8'], bat: ['#6a3a78', '#e2434f'],
    sporeling: ['#c43a5a', '#e8dcc8'], bloat: ['#86b04a', '#c8ff6a'], thornvine: ['#5aa84a', '#d0507a'], beetle: ['#3a4a8a', '#1a1a2a'], spider: ['#2e2638', '#8fe05c'],
    wraith: ['#a8d8f0', '#e9f8ff'], wolf: ['#cfd8e2', '#e2434f'], yeti: ['#e8eef6', '#5a7a9a'], crystal: ['#9fe0ff', '#ffffff'], snowimp: ['#cfe6f8', '#ffffff'], icebat: ['#9fd8ff', '#ffffff'],
    imp: ['#d8402a', '#ffd08a'], magma: ['#ff7a2a', '#ffd08a'], magmalet: ['#ffa04a', '#ffd08a'], emberknight: ['#3a3038', '#ff7a2a'], bomber: ['#6aa84a', '#e2434f'], salamander: ['#e8642a', '#ffd35c'], golem: ['#2e2630', '#ff7a2a'] };
  return B[kind] || ['#e2434f', '#a8202a'];
}
function makeElite(e, mods) {
  const heat = G.run ? G.run.heat : 0;
  const n = mods ? mods.length : heat >= 10 ? 2 : 1;
  const pool = ELITE_MODS.map((m) => m.id).filter((m) => !(e.rooted && m === 'swift'));
  const list = mods || [];
  while (list.length < n) { const m = rndPick(pool); if (!list.includes(m)) list.push(m); }
  e.eliteMods = list; e.maxHp *= 2.6; e.dmg *= 1.25; e.r *= 1.2; e.scale = 1.25; e.h *= 1.25;
  if (list.includes('swift')) e.spd *= 1.45;
  if (list.includes('brute')) { e.maxHp *= 1.5; e.dmg *= 1.3; e.scale = 1.4; }
  if (list.includes('shielded')) e.shieldHp = e.maxHp * 0.35;
  if (list.includes('frenzied')) e.rateMul = 0.6;
  e.eliteColor = ELITE_MODS.find((m) => m.id === list[0]).color;
}
function spawnAlly(kind, x, y, life) {
  const e = spawnEnemy(kind, x, y, { noSpawnAnim: true });
  if (!e) return null;
  e.type = 'ally'; e.life = life; e.summoned = true;
  e.maxHp = ENEMIES[kind].hp * (1 + G.fl.idx * 0.25); e.hp = e.maxHp;
  e.dmg = ENEMIES[kind].dmg * (1 + G.fl.idx * 0.22) * G.p.stats.abDmg;
  burst(x, y - 6, 10, ['#8fe05c', '#c8f5a8', '#ffffff'], { smax: 60, glow: true });
  return e;
}

/* ---------- projectiles ---------- */
function spawnProj(o) {
  const pr = {
    team: o.team, x: o.x, y: o.y, vx: Math.cos(o.ang) * o.speed, vy: Math.sin(o.ang) * o.speed, r: o.r ?? 3,
    dmg: o.dmg, life: o.life ?? 1, t: 0, pierce: o.pierce ?? 0, hit: new Set(), kind: o.kind || 'orb', color: o.color,
    kb: o.kb ?? 40, burn: o.burn, poison: o.poison, chill: o.chill, shock: o.shock, homing: o.homing || 0, bounce: o.bounce || 0,
    aoe: o.aoe || 0, onEnd: o.onEnd, boomerang: o.boomerang, src: o.src || 'weapon', lob: o.lob, tx: o.tx, ty: o.ty, z: 0, ang: o.ang,
    speed: o.speed, slow: o.slow, owner: o.owner || (o.team === 'e' ? G.actor || null : null), crit: o.critAdd, rend: o.rend, leech: o.leech, light: o.light,
  };
  if (pr.lob) { pr.dur = o.dur || 0.8; pr.sx = o.x; pr.sy = o.y; pr.vx = pr.vy = 0; pr.arc = o.arc ?? 40; }
  if (o.bounceWall) pr.bounceWall = o.bounceWall;
  if (o.fear) pr.fear = o.fear;
  runHooks('projSpawn', pr, o);
  G.projs.push(pr);
  return pr;
}
function updateProjs(dt) {
  const fl = G.fl, p = G.p, list = G.projs;
  for (let i = list.length - 1; i >= 0; i--) {
    if (G.projs !== list) break;
    const pr = list[i];
    if (!pr) continue;
    const tdt = pr.team === 'e' && G.warp > 0 ? dt * 0.4 : dt;
    pr.t += tdt;
    if (pr.lob) {
      const k = clamp(pr.t / pr.dur, 0, 1);
      pr.x = lerp(pr.sx, pr.tx, k); pr.y = lerp(pr.sy, pr.ty, k); pr.z = Math.sin(k * Math.PI) * pr.arc;
      if (k >= 1) { const pa = G.actor; G.actor = pr.owner || pa; try { pr.onEnd && pr.onEnd(pr); } finally { G.actor = pa; } list.splice(i, 1); }
      continue;
    }
    if (pr.homing && pr.team === 'p') {
      let best = null, bd = 160;
      for (const e of G.ents) if (!e.dead && e.type !== 'ally' && e.spawnT <= 0 && !pr.hit.has(e)) { const d = Math.hypot(e.x - pr.x, e.y - pr.y); if (d < bd) { bd = d; best = e; } }
      if (best) {
        const want = Math.atan2(best.y - best.h / 2 - pr.y, best.x - pr.x), cur = Math.atan2(pr.vy, pr.vx);
        const na = cur + clamp(angDiff(cur, want), -pr.homing * tdt, pr.homing * tdt), sp = Math.hypot(pr.vx, pr.vy);
        pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
      }
    }
    if (pr.boomerang) {
      const half = pr.life * 0.5;
      if (pr.t > half * 0.8) {
        const a = Math.atan2(p.y - 8 - pr.y, p.x - pr.x), sp = pr.speed * 1.1;
        pr.vx = lerp(pr.vx, Math.cos(a) * sp, 0.12); pr.vy = lerp(pr.vy, Math.sin(a) * sp, 0.12);
        if (!pr.returning) { pr.returning = true; pr.hit.clear(); }
        if (Math.hypot(p.x - pr.x, p.y - 8 - pr.y) < 10) { list.splice(i, 1); continue; }
      }
    }
    const nx = pr.x + pr.vx * tdt, ny = pr.y + pr.vy * tdt;
    // walls
    if (blocksShot(fl, Math.floor(nx / TS), Math.floor(ny / TS)) && !pr.boomerang) {
      if (pr.bounceWall > 0) {
        pr.bounceWall--;
        if (blocksShot(fl, Math.floor(nx / TS), Math.floor(pr.y / TS))) pr.vx *= -1; else pr.vy *= -1;
      } else { if (pr.team === 'p' && typeof revealSecretAt === 'function') revealSecretAt(nx, ny, 10); endProj(pr, true); list.splice(i, 1); continue; }
    } else { pr.x = nx; pr.y = ny; }
    // pillars and props
    let dead = false;
    if (G.room && !pr.boomerang) for (const pid of G.room.props) {
      const pp = fl.props[pid];
      if (pp.broken) continue;
      if ((pp.solid || pp.breakable) && Math.hypot(pp.x - pr.x, pp.y - 4 - pr.y) < (pp.r || 6) + pr.r) {
        if (pp.breakable && pr.team === 'p') { breakProp(pp); }
        else if (pp.breakable && pr.team === 'e') { breakProp(pp); }
        if (pp.solid || pp.breakable) { dead = true; break; }
      }
    }
    if (dead) { endProj(pr, true); list.splice(i, 1); continue; }
    // hits
    if (pr.team === 'p') {
      for (const e of G.ents) {
        if (e.dead || e.type === 'ally' || e.spawnT > 0 || e.hidden || (e.invuln && !e.boss) || pr.hit.has(e)) continue;
        if (closestPart(e, pr.x, pr.y).d > e.r + pr.r + 2) continue;
        pr.hit.add(e);
        const ang = Math.atan2(pr.vy, pr.vx);
        damageEnemy(e, pr.dmg, { src: pr.src, kb: pr.kb, ang, burn: pr.burn, poison: pr.poison, chill: pr.chill, shock: pr.shock, critAdd: pr.crit, rend: pr.rend, leech: pr.leech, fear: pr.fear, hex: pr.hex });
        runHooks('projHit', pr, e);
        if (pr.aoe) { endProj(pr, false); dead = true; break; }
        if (pr.bounce > 0) {
          pr.bounce--;
          let best = null, bd = 120;
          for (const o of G.ents) if (!o.dead && o.type !== 'ally' && !pr.hit.has(o) && o.spawnT <= 0) { const d = Math.hypot(o.x - pr.x, o.y - pr.y); if (d < bd) { bd = d; best = o; } }
          if (best) { const a = Math.atan2(best.y - best.h / 2 - pr.y, best.x - pr.x), sp = Math.hypot(pr.vx, pr.vy); pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp; continue; }
        }
        if (pr.pierce-- <= 0) { dead = true; endProj(pr, false); break; }
      }
    } else if (!p.dead) {
      if (Math.hypot(p.x - pr.x, p.y - 7 - pr.y) < p.r + pr.r) {
        if (p.stats.reflect && Math.random() < p.stats.reflect && !pr.reflected) {
          pr.team = 'p'; pr.reflected = true; pr.vx *= -1.3; pr.vy *= -1.3; pr.hit = new Set(); pr.dmg = Math.max(pr.dmg, weaponDamage()); pr.src = 'ability';
          ring(pr.x, pr.y, 10, '#cfe9ff', 0.2); Sound.play('block');
        } else {
          const res = hurtPlayer(pr.dmg, { proj: pr, kx: pr.vx * 0.4, ky: pr.vy * 0.4 });
          if (res === HIT.HIT) {
            if (pr.slow) p.slowT = Math.max(p.slowT || 0, pr.slow);
            if (pr.chill) p.chillT = Math.max(p.chillT || 0, 1.5);
            if (pr.poison) p.poisonT = Math.max(p.poisonT || 0, 3);
          }
          if (res === HIT.HIT || res === HIT.BLOCK) { endProj(pr, false); dead = true; }
        }
      }
      // allies soak enemy shots
      if (!dead) for (const a of G.ents) if (!a.dead && a.type === 'ally' && !a.rooted && Math.hypot(a.x - pr.x, a.y - a.h / 2 - pr.y) < a.r + pr.r) { a.hp -= pr.dmg; a.flash = 0.1; endProj(pr, false); dead = true; break; }
    }
    if (!dead && pr.t >= pr.life) { endProj(pr, true); dead = true; }
    if (dead) list.splice(i, 1);
  }
}
function endProj(pr, expired) {
  if (pr.ended) return;
  pr.ended = true;
  if (pr.onEnd) { pr.onEnd(pr, expired); return; }
  if (pr.aoe) explode(pr.x, pr.y, pr.aoe, pr.dmg * 0.8, { burn: pr.burn, poison: pr.poison, chill: pr.chill, team: pr.team, pdmg: pr.dmg, vol: 0.5, shake: 2, color: pr.color, src: pr.src });
  else burst(pr.x, pr.y, 3, pr.color || '#ffffff', { smax: 40, lmax: 0.25 });
}

/* ---------- area effects (pools, clouds, telegraphs) ---------- */
function updateFx(dt) {
  const p = G.p, list = G.fx;
  for (let i = list.length - 1; i >= 0; i--) {
    if (G.fx !== list) break;
    const f = list[i];
    if (!f) continue;
    f.t += dt;
    if (f.update) f.update(f, dt);
    if (f.kind === 'pool' || f.kind === 'cloud' || f.kind === 'firefield' || f.kind === 'thorns') {
      f.tick = (f.tick ?? 0) - dt;
      if (f.tick <= 0) {
        f.tick = 0.4;
        if (f.team === 'p') {
          for (const e of G.ents) if (!e.dead && e.type !== 'ally' && e.spawnT <= 0 && Math.hypot(e.x - f.x, e.y - f.y) < f.r + e.r * 0.5) {
            if (f.poison) applyPoison(e, f.base);
            if (f.burn) applyBurn(e, f.base);
            if (f.dmg) damageEnemy(e, f.dmg, { src: 'ability', noCrit: true, silent: true, noProc: true, color: f.textColor || '#a8e070' });
          }
        } else if (!p.dead && Math.hypot(p.x - f.x, p.y - f.y) < f.r + p.r * 0.5) {
          if (f.dmg) hurtPlayer(f.dmg, {});
          if (f.poison) p.poisonT = Math.max(p.poisonT || 0, 2.5);
          if (f.slow) p.slowT = Math.max(p.slowT || 0, 0.5);
          if (f.burn && !p.stats.fireproof) p.burnT = Math.max(p.burnT || 0, 2);
        }
      }
    }
    if (f.kind === 'tele' && f.t >= f.life && !f.fired) { f.fired = true; const pa = G.actor; G.actor = f.actor; try { f.fire && f.fire(f); } finally { G.actor = pa; } }
    if (f.t >= f.life) list.splice(i, 1);
  }
}
// enemy attack warning: draws a marker, then calls fire()
function telegraph(o) { const f = { kind: 'tele', t: 0, actor: G.actor || null, ...o }; G.fx.push(f); return f; }

/* ---------- particles and floating text ---------- */
function updateParts(dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const q = G.parts[i];
    q.life -= dt;
    if (q.life <= 0) { G.parts.splice(i, 1); continue; }
    const dr = Math.exp(-q.drag * dt);
    q.vx *= dr; q.vy *= dr;
    q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.floor) { q.vz -= q.grav * dt; q.z += q.vz * dt; if (q.z < 0) { q.z = 0; q.vz *= -0.3; q.vx *= 0.6; q.vy *= 0.6; } }
    else q.vy -= q.grav * dt * 0.1;
  }
  for (let i = G.texts.length - 1; i >= 0; i--) {
    const t = G.texts[i];
    t.life -= dt; t.y += t.vy * dt; t.vy *= Math.exp(-3 * dt);
    if (t.life <= 0) G.texts.splice(i, 1);
  }
}

/* ---------- banners ---------- */
function banner(title, sub = '', dur = 2.2) {
  const el = $('banner');
  el.querySelector('b').textContent = title;
  el.querySelector('small').textContent = sub;
  el.classList.add('show');
  clearTimeout(banner._t);
  banner._t = setTimeout(() => el.classList.remove('show'), dur * 1000);
}
function toast(msg, color) {
  const box = $('toast');
  const d = h('div', { text: msg });
  if (color) d.style.color = color;
  box.append(d);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => d.remove(), 2700);
}

/* ---------- rooms: entering, waves, clearing ---------- */
function setDoors(r, open) {
  for (const di of r.doors) {
    const d = G.fl.doors[di];
    if (d.open === open) continue;
    d.open = open;
    burst(d.px, d.py, 6, ['#8a7a6a', '#5a4a3a'], { smax: 40 });
  }
  Sound.play('door');
}
function onRoomChange(r) {
  const prev = G.room;
  G.room = r;
  G.flow = null;
  r.seen = true;
  for (const di of r.doors) { const d = G.fl.doors[di]; if (d.hidden) continue; G.fl.rooms[d.a].seen = true; G.fl.rooms[d.b].seen = true; }
  if (!r.visited) { r.visited = true; G.run.stats.rooms++; }
  // allies follow you through doors
  for (const e of G.ents) if (e.type === 'ally' && !e.dead) { e.room = r.id; if (!e.rooted) { e.x = G.p.x + rnd(-8, 8); e.y = G.p.y + rnd(-8, 8); } }
  if (prev && prev !== r) for (const e of G.ents) if (e.type === 'ally' && e.rooted) e.dead = true;
  runHooks('onRoomEnter', r, prev);
  if (r.type === 'shop') { stockShop(r); if (!r.greeted) { r.greeted = true; toast('Merchant: "Coin for goods. No refunds in the deep."'); } }
  if (r.type === 'treasure' && !r.greeted) { r.greeted = true; }
}
function checkLockedDoors() {
  const p = G.p, fl = G.fl, r = G.room;
  if (!r) return;
  for (const di of r.doors) {
    const d = fl.doors[di];
    if (!d.locked) continue;
    if (Math.hypot(p.x - d.px, p.y - d.py) > (d.dir === 'v' ? 34 : 24)) continue;
    if (p.keys > 0) {
      p.keys--; d.locked = false; Sound.play('unlock');
      burst(d.px, d.py, 12, ['#ffd35c', '#ffffff'], { smax: 80, glow: true });
      toast('Unlocked with a key', '#ffd35c');
    } else if (!d.warnT || G.t - d.warnT > 3) { d.warnT = G.t; toast('Locked. You need a key.'); Sound.play('deny', { v: 0.5 }); }
  }
}
function checkRoomEntry() {
  const p = G.p, fl = G.fl;
  checkLockedDoors();
  const rid = roomAtPx(p.x, p.y);
  if (rid >= 0 && (!G.room || rid !== G.room.id)) onRoomChange(fl.rooms[rid]);
  const r = G.room;
  if (!r || r.cleared || G.combat) return;
  if (!['combat', 'elite', 'exit', 'boss'].includes(r.type)) return;
  if (!insideInterior(r, p.x, p.y, 0.6)) return;
  if (r.type === 'boss') { if (!G.boss) startBoss(r); return; }
  startCombat(r);
}
function startCombat(r) {
  G.combat = true; G.waveIdx = 0; G.waveDelay = 0;
  setDoors(r, false);
  spawnWave(r, 0);
  Music.set(G.fl.actIdx, 1);
}
function spawnWave(r, w) {
  const list = r.waves[w] || [];
  const p = G.p;
  for (const s of list) {
    let { x, y } = s;
    if (Math.hypot(x - p.x, y - p.y) < 56) { const q = randomFloorPoint(r, p.x, p.y, 70); x = q.x; y = q.y; }
    spawnEnemy(s.kind, x, y, { elite: s.elite, room: r.id });
  }
  Sound.play('spawn');
  if (w > 0) toast(`Wave ${w + 1} of ${r.waves.length}`);
}
function updateCombat(dt) {
  if (!G.combat || !G.room) return;
  const r = G.room;
  if (r.type === 'boss') return;
  const alive = G.ents.some((e) => !e.dead && e.type === 'enemy' && e.room === r.id);
  if (alive) return;
  if (G.waveIdx < r.waves.length - 1) {
    G.waveDelay += dt;
    if (G.waveDelay > 0.8) { G.waveIdx++; G.waveDelay = 0; spawnWave(r, G.waveIdx); }
    return;
  }
  clearRoom(r);
}
function clearRoom(r) {
  G.combat = false; r.cleared = true;
  setDoors(r, true);
  Sound.play('clear');
  Music.set(G.fl.actIdx, 0);
  const p = G.p;
  if (p.stats.clearHeal) heal(p, Math.round(p.maxHp * p.stats.clearHeal));
  G.run.stats.cleared++;
  runHooks('onRoomClear', r);
  // reward
  const R = Math.random();
  const c = randomFloorPoint(r, null, null, 0, null, true);
  const center = { x: (r.ix + r.iw / 2) * TS, y: (r.iy + r.ih / 2) * TS };
  if (r.type === 'elite') spawnChest(center.x, center.y, 'silver', r);
  else if (r.type === 'challenge') spawnChest(center.x, center.y + 20, 'gold', r);
  else if (R < 0.12) spawnChest(c.x, c.y, 'wood', r);
  else if (R < 0.3) dropPickup(rndPick(['heart', 'gold', 'potion', 'key', 'gold']), center.x, center.y, rndPick([1, 2, 3]));
  if (r.type === 'exit') {
    const st = G.fl.props.find((q) => q.room === r.id && q.stairs);
    if (st) { st.active = true; toast('The way down is open'); flashLight(st.x, st.y, 60, '#ffb35e', 0.6); }
  }
  // magnet everything that is lying around
  for (const k of G.picks) if (['xp', 'xpbig', 'gold', 'ember', 'soul', 'soulbig'].includes(k.kind)) k.magnet = true;
}
function spawnChest(x, y, kind, r) {
  const fl = G.fl;
  ({ x, y } = freeSpotNear(r, x, y));
  const pr = { id: fl.props.length, kind: 'chest', chest: kind, x, y, room: r.id, solid: true, r: 7, appear: 0 };
  if (kind !== 'gold' && Math.random() < (G.omenMimic || 0.06)) pr.mimic = true;
  fl.props.push(pr); r.props.push(pr.id);
  burst(x, y - 4, 14, ['#ffd35c', '#ffffff'], { smax: 80, glow: true });
  Sound.play('chest', { v: 0.6 });
  return pr;
}

