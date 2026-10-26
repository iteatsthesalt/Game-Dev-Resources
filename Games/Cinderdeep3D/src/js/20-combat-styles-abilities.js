/* ============================================================
   Cinderdeep — new combat: weapon styles, abilities, hero and
   beast passives, skill and relic engines, statuses, and the
   forge's weapon evolutions
   ============================================================ */
const foes = (room = G.room) => G.ents.filter((e) => !e.dead && e.type === 'enemy' && e.spawnT <= 0 && !e.hidden && (!room || e.room === room.id));
const scaleF = () => 1 + 0.18 * (G.fl ? G.fl.idx : 0);
function nearestFoe(x, y, maxD = 1e9, filter) {
  let best = null, bd = maxD;
  for (const e of G.ents) { if (e.dead || e.type !== 'enemy' || e.spawnT > 0 || e.hidden || (filter && !filter(e))) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } }
  return best;
}
// fire a fan of player missiles from the hand
function fireFan(p, def, dmg, ang, hp, base, extra = {}) {
  const s = p.stats, n0 = def.count || 1, count = n0 + s.projBonus, spread = def.spread != null ? def.spread : 0.14;
  const total = n0 > 1 ? (spread * (count - 1)) / (n0 - 1) : spread * (count - 1);
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (count > 1 ? ang - total / 2 + (total * i) / (count - 1) : ang) + (extra.jitter ? rnd(-extra.jitter, extra.jitter) : 0);
    out.push(spawnProj({
      ...base, team: 'p', x: hp.x, y: hp.y, ang: a, speed: def.speed * (extra.speedJit ? rnd(0.85, 1.1) : 1), dmg, life: (def.life || 0.8) * s.reachMul, kb: def.kb,
      pierce: (def.pierce || 0) + s.pierceBonus, bounce: s.bounce, burn: def.burn, chill: def.chill, shock: def.shock, poison: def.poison, homing: def.homing, r: 3, ...extra,
    }));
  }
  return out;
}
hook('projSpawn', (pr, o) => {
  for (const k of ['hex', 'fx', 'tag', 'split', 'trap']) if (o[k] != null) pr[k] = o[k];
  // evolved weapons that change their missiles
  const p = G.p;
  if (pr.team === 'p' && pr.src === 'weapon' && p && p.weapon && !pr.split) {
    const def = WEAPON[p.weapon.id];
    if (def.fx === 'boombolt' && !pr.onEnd) pr.onEnd = (q) => explode(q.x, q.y, 30, q.dmg * 0.9, { color: '#ffb35e', vol: 0.45, shake: 2, src: 'weapon' });
  }
});
// a fast dash that strikes everything it passes through
function dashStrike(p, ang, dur, dmg, o = {}) {
  p.dashDx = Math.cos(ang); p.dashDy = Math.sin(ang); p.dashT = dur; p.dashHit = new Set();
  p.strike = { dmg, hit: new Set(), o, t: 0 };
  p.iframes = Math.max(p.iframes, dur + 0.1);
}
hook('update', (dt) => {
  const p = G.p;
  if (!p || p.dead) return;
  if (p.strike) {
    if (p.dashT <= 0) { p.strike = null; return; }
    const S = p.strike, o = S.o;
    S.t -= dt;
    for (const e of G.ents) {
      if (e.dead || e.type !== 'enemy' || e.spawnT > 0 || e.hidden || S.hit.has(e) || closestPart(e, p.x, p.y - 6).d > e.r + 12) continue;
      S.hit.add(e);
      damageEnemy(e, S.dmg, { src: o.src || 'ability', ang: Math.atan2(p.dashDy, p.dashDx), kb: o.kb ?? 90, burn: o.burn, shock: o.shock, stun: o.stun, critAdd: o.critAdd });
      if (o.zap) zapFx(p.x, p.y - 8, e.x, e.y - e.h / 2, '#fff27a');
      hitstop(0.02);
    }
    if (S.t <= 0) {
      S.t = 0.035;
      if (o.fire) G.fx.push({ kind: 'firefield', x: p.x, y: p.y, r: 10, t: 0, life: 2, team: 'p', burn: true, base: S.dmg * 0.3, tick: 0, small: true });
      if (o.zap && Math.random() < 0.5) burst(p.x, p.y - 6, 3, ['#fff27a', '#9ff6ff'], { smax: 60, glow: true });
    }
  }
});

/* ============================================================
   Weapon styles
   ============================================================ */
function katanaDash(p, ang, dmg, def, base) {
  const sx = p.x, sy = p.y;
  dashStrike(p, ang, 0.16, dmg, { src: 'weapon', kb: 70, critAdd: (def.crit || 0) + 0.1 });
  G.fx.push({ kind: 'slashline', x0: sx + Math.cos(ang) * 6, y0: sy - 8 + Math.sin(ang) * 6, x1: sx + Math.cos(ang) * 60, y1: sy - 8 + Math.sin(ang) * 60, t: 0, life: 0.28, color: weaponTrail(p.weapon) });
  Sound.play('katana');
}
Object.assign(WEAPON_STYLE, {
  bullet(p, def, w, dmg, ang, echo, hp, base) {
    p.gunHand = (p.gunHand || 0) ^ 1;
    const off = p.gunHand ? 3 : -3, h2 = { x: hp.x - Math.sin(ang) * off, y: hp.y + Math.cos(ang) * off };
    fireFan(p, def, dmg, ang, h2, base, { kind: 'bullet', bounceWall: def.ricochet || 0, color: def.fx === 'midas' ? '#ffd35c' : '#ffe08a', jitter: 0.03, r: 2 });
    Sound.play('gunshot', { p: rnd(0.95, 1.08) });
    flashLight(h2.x + Math.cos(ang) * 6, h2.y + Math.sin(ang) * 6, 24, '#ffe08a', 0.06);
    p.recoil = 0.05;
  },
  hex(p, def, w, dmg, ang, echo, hp, base) {
    fireFan(p, def, dmg, ang, hp, base, { kind: 'hexbolt', color: '#8fe05c', light: '#8fe05c', hex: true, r: 3 });
    Sound.play('hex');
  },
  katana(p, def, w, dmg, ang, echo, hp, base) {
    const n = def.combo || 3, next = p.comboT > 0 ? (p.combo + 1) % n : 0;
    if (next === n - 1 && !echo) { p.combo = next; p.comboT = 0.7; katanaDash(p, ang, dmg * 1.8, def, base); return; }
    fireWeapon(p, { ...def, style: 'slash', combo: n }, w, dmg, ang, echo);
  },
  note(p, def, w, dmg, ang, echo, hp, base) {
    const cols = ['#7dff9a', '#ffd35c', '#7fc8ff', '#ff8ad8'];
    p.noteI = (p.noteI || 0) + 1;
    const chord = p.atkCount % 4 === 0;
    fireFan(p, chord ? { ...def, count: 3, spread: 0.35 } : def, dmg, ang, hp, base, { kind: 'note', color: cols[p.noteI % 4] });
    Sound.play('lute', { p: [1, 1.122, 1.26, 1.335, 1.5, 1.68][p.noteI % 6] });
    if (chord) {
      ring(p.x, p.y - 8, 34, '#7dff9a', 0.35, 2);
      for (const e of foes()) if (Math.hypot(e.x - p.x, e.y - p.y) < 34 + e.r) damageEnemy(e, dmg * 0.8, { ...base, ang: Math.atan2(e.y - p.y, e.x - p.x), kb: 80 });
      Sound.play('chord');
    }
  },
  whip(p, def, w, dmg, ang, echo, hp, base) {
    const s = p.stats, reach = def.reach * s.reachMul, ox = p.x, oy = p.y - 8, cx = Math.cos(ang), cy = Math.sin(ang);
    let tipHit = false;
    for (const e of G.ents) {
      if (e.dead || e.type !== 'enemy' || e.spawnT > 0 || e.hidden || (e.invuln && !e.boss)) continue;
      const cp = closestPart(e, ox, oy), rx = cp.x - ox, ry = cp.y - oy;
      const along = rx * cx + ry * cy, across = Math.abs(-rx * cy + ry * cx);
      if (along < -4 || along > reach + e.r || across > def.width + e.r) continue;
      const tip = along > reach * 0.72;
      damageEnemy(e, dmg * (tip ? 1.6 : 1), { ...base, ang, kb: def.kb * (tip ? 1.5 : 1), color: tip ? '#ffb35e' : null });
      if (tip) tipHit = true;
    }
    if (G.room) for (const pid of G.room.props) { const pr = G.fl.props[pid]; if (pr.breakable && !pr.broken) { const rx = pr.x - ox, ry = pr.y - 5 - oy, al = rx * cx + ry * cy; if (al > 0 && al < reach + 6 && Math.abs(-rx * cy + ry * cx) < def.width + 6) breakProp(pr); } }
    cutProjectiles(ox + cx * reach * 0.8, oy + cy * reach * 0.8, 12);
    G.fx.push({ kind: 'whip', ang, reach, t: 0, life: 0.2, color: def.fx === 'thorntrail' ? '#7ac85a' : '#c8a070' });
    if (def.fx === 'thorntrail') for (let k = 1; k <= 3; k++) G.fx.push({ kind: 'thorns', x: ox + cx * reach * k / 3.2, y: p.y + cy * reach * k / 3.2, r: 10, t: 0, life: 2.5, team: 'p', dmg: dmg * 0.25, tick: 0 });
    Sound.play('whip', { p: tipHit ? 1.15 : 1 });
  },
  chakram(p, def, w, dmg, ang, echo, hp, base) {
    fireFan(p, def, dmg, ang, hp, base, { kind: 'chakram', boomerang: true, pierce: 99, bounce: 3 + p.stats.bounce, color: '#dde3ec', r: 4 });
    Sound.play('chakram');
  },
  flask(p, def, w, dmg, ang, echo, hp, base) {
    const s = p.stats, n = 1 + s.projBonus;
    for (let i = 0; i < n; i++) {
      const el = rndPick(['fire', 'frost', 'venom', 'storm']), col = { fire: '#ff9a3c', frost: '#9fe0ff', venom: '#8fe05c', storm: '#fff27a' }[el];
      const d = clamp(Math.hypot(p.ax - p.x, p.ay - p.y + 8), 40, 130 * s.reachMul) + i * 14, a = ang + (i ? rnd(-0.3, 0.3) : 0);
      let tx = p.x + Math.cos(a) * d, ty = p.y + Math.sin(a) * d;
      if (G.room) { tx = clamp(tx, (G.room.ix + 0.5) * TS, (G.room.ix + G.room.iw - 0.5) * TS); ty = clamp(ty, (G.room.iy + 0.5) * TS, (G.room.iy + G.room.ih - 0.5) * TS); }
      spawnProj({ team: 'p', x: hp.x, y: hp.y, ang: 0, speed: 0, dmg, lob: true, tx, ty, dur: 0.5, arc: 28, kind: 'flask', color: col, src: 'weapon', onEnd: (pr) => flaskBurst(pr, el, dmg, def.aoe * s.reachMul) });
    }
    Sound.play('swing', { p: 1.4, v: 0.5 });
  },
  harpoon(p, def, w, dmg, ang, echo, hp, base) {
    fireFan(p, def, dmg, ang, hp, base, { kind: 'harpoon', r: 3 });
    Sound.play('harpoon'); p.recoil = 0.1;
  },
  bite(p, def, w, dmg, ang, echo, hp, base) {
    fireWeapon(p, { ...def, style: 'stab' }, w, dmg, ang, echo);
    const F = formOf(p), r = def.reach * p.stats.reachMul;
    G.fx.push({ kind: 'bite', x: p.x + Math.cos(ang) * r * 0.8, y: p.y - 8 + Math.sin(ang) * r * 0.8, t: 0, life: 0.16, color: F ? F.acc : '#ffffff' });
    Sound.play('bite', { p: rnd(0.9, 1.1) });
  },
  breath(p, def, w, dmg, ang, echo, hp, base) {
    const s = p.stats, heads = def.count || 1, n = 1 + s.projBonus;
    for (let hI = 0; hI < heads; hI++) {
      const a0 = ang + (heads > 1 ? (hI - (heads - 1) / 2) * 0.42 : 0);
      for (let k = 0; k < n; k++) spawnProj({ ...base, team: 'p', x: hp.x + Math.cos(a0) * 6, y: hp.y + Math.sin(a0) * 4, ang: a0 + rnd(-0.18, 0.18), speed: def.speed * rnd(0.85, 1.1), dmg, life: def.life * s.reachMul, kb: def.kb, pierce: 99, kind: 'pflame', burn: def.burn, r: 4, light: Math.random() < 0.3 ? '#ff7a2a' : null });
    }
    Sound.play('breath');
  },
  seed(p, def, w, dmg, ang, echo, hp, base) { fireFan(p, def, dmg, ang, hp, base, { kind: 'seed', color: '#c8a060', r: 3 }); Sound.play('spit'); },
  thornvolley(p, def, w, dmg, ang, echo, hp, base) { fireFan(p, def, dmg, ang, hp, base, { kind: 'thorn', color: '#a8e070' }); Sound.play('shoot', { p: 1.2, v: 0.6 }); },
  foxfire(p, def, w, dmg, ang, echo, hp, base) { fireFan(p, def, dmg, ang, hp, base, { kind: 'foxfire', color: '#7fc8ff', light: '#7fc8ff', r: 3 }); Sound.play('magic', { p: 1.4 }); },
  sting(p, def, w, dmg, ang, echo, hp, base) { fireFan(p, def, dmg, ang, hp, base, { kind: 'sting', color: '#fff27a', light: '#fff27a', r: 2 }); Sound.play('zap', { p: 1.6, v: 0.5 }); },
  shadebolt(p, def, w, dmg, ang, echo, hp, base) { fireFan(p, def, dmg, ang, hp, base, { kind: 'shadebolt', color: '#7a5aaa', light: '#b98cff', r: 3 }); Sound.play('magic', { p: 0.6 }); },
  gaze(p, def, w, dmg, ang, echo, hp, base) { fireFan(p, def, dmg, ang, hp, base, { kind: 'gaze', jitter: 0.06, fear: 0.06 }); Sound.play('shard', { p: 0.7 }); },
  crystals(p, def, w, dmg, ang, echo, hp, base) { fireFan(p, def, dmg, ang, hp, base, { kind: 'crystal', color: '#c8a8ff' }); Sound.play('shard', { p: 1.2 }); },
  boulder(p, def, w, dmg, ang, echo, hp, base) {
    const s = p.stats, d = clamp(Math.hypot(p.ax - p.x, p.ay - p.y + 8), 40, 140 * s.reachMul);
    let tx = p.x + Math.cos(ang) * d, ty = p.y + Math.sin(ang) * d;
    if (G.room) { tx = clamp(tx, (G.room.ix + 0.5) * TS, (G.room.ix + G.room.iw - 0.5) * TS); ty = clamp(ty, (G.room.iy + 0.5) * TS, (G.room.iy + G.room.ih - 0.5) * TS); }
    spawnProj({ team: 'p', x: hp.x, y: hp.y - 4, ang: 0, speed: 0, dmg, lob: true, tx, ty, dur: 0.6, arc: 46, kind: 'boulder', color: '#8a8478', src: 'weapon', onEnd: (pr) => {
      const R2 = def.aoe * s.reachMul;
      explode(pr.x, pr.y, R2, dmg, { color: '#c8bfa8', parts: ['#8a8478', '#b8b0a0', '#4a463e'], sound: 'slam', shake: 4, src: 'weapon', crit: true });
      G.fx.push({ kind: 'crack', x: pr.x, y: pr.y, r: R2, t: 0, life: 0.6 });
      for (const e of foes()) if (Math.hypot(e.x - pr.x, e.y - pr.y) < R2 + e.r && !e.boss) e.stunT = Math.max(e.stunT, 0.4);
    } });
    Sound.play('heavy', { p: 0.7 });
  },
});
function flaskBurst(pr, el, dmg, R) {
  const x = pr.x, y = pr.y;
  Sound.play('glass');
  if (el === 'fire') { explode(x, y, R, dmg, { burn: 0.8, color: '#ff9a3c', vol: 0.5, shake: 2, src: 'weapon' }); G.fx.push({ kind: 'firefield', x, y, r: R * 0.8, t: 0, life: 2.2, team: 'p', burn: true, base: dmg * 0.4, tick: 0 }); }
  else if (el === 'frost') { explode(x, y, R, dmg, { chill: 1, color: '#bfe9ff', parts: ['#ffffff', '#9fe0ff'], vol: 0.4, shake: 2, sound: 'ice', src: 'weapon' }); for (const e of foes()) if (Math.hypot(e.x - x, e.y - y) < R + e.r) applyChill(e, true); }
  else if (el === 'venom') { explode(x, y, R * 0.8, dmg * 0.8, { poison: 1, color: '#8fe05c', parts: ['#8fe05c', '#3f9a2a'], vol: 0.4, shake: 1, sound: 'venom', src: 'weapon' }); venomPool(x, y, R, dmg); }
  else { explode(x, y, R, dmg, { shock: 1, color: '#fff27a', parts: ['#fff27a', '#ffffff'], vol: 0.4, shake: 2, sound: 'zap', src: 'weapon' }); }
}
TOP_FX.bite = (g, f, cx, cy) => {
  const k = f.t / f.life, x = Math.round(f.x - cx), y = Math.round(f.y - cy), gap = Math.round(6 * (1 - k));
  g.fillStyle = rgbaStr('#ffffff', 1 - k * 0.6);
  for (let i = -2; i <= 2; i++) { g.fillRect(x + i * 2, y - gap - 2, 1, 3); g.fillRect(x + i * 2 + 1, y + gap, 1, 3); }
};

/* ============================================================
   Abilities
   ============================================================ */
function wallStop(p, ang, d) {
  let fx = p.x, fy = p.y;
  for (let k = 1; k <= 24; k++) { const nx = p.x + (Math.cos(ang) * d * k) / 24, ny = p.y + (Math.sin(ang) * d * k) / 24; if (hitsWall(G.fl, nx, ny, p.r, p.fly)) break; fx = nx; fy = ny; }
  return { x: fx, y: fy };
}
Object.assign(ABILITY_CAST, {
  consecrate(p, a, def, dmg) {
    const R2 = 46 + a.lvl * 4;
    G.fx.push({ kind: 'consecrate', x: p.x, y: p.y, r: R2, t: 0, life: 5 + (a.lvl - 1), tick: 0, update(f, dt) {
      f.tick -= dt; if (f.tick > 0) return; f.tick = 0.5;
      for (const e of foes()) if (Math.hypot(e.x - f.x, e.y - f.y) < f.r + e.r * 0.5) damageEnemy(e, dmg, { src: 'ability', noCrit: true, silent: true, color: '#ffe8a0', burn: 0.25 });
      const q = G.p; if (Math.hypot(q.x - f.x, q.y - f.y) < f.r) heal(q, 1 + a.lvl * 0.6, true);
    } });
    Sound.play('holy'); ring(p.x, p.y, R2, '#ffe8a0', 0.5, 2);
  },
  flurry(p, a, def, dmg) {
    const n = 10 + a.lvl * 2;
    for (let i = 0; i < n; i++) later(i * 0.05, () => {
      if (G.p !== p || p.dead) return;
      const ang = p.aim + rnd(-0.4, 0.4), hx = p.x + Math.cos(ang) * 18, hy = p.y - 8 + Math.sin(ang) * 14;
      burst(hx, hy, 3, ['#ffffff', '#ffd08a'], { smax: 60, glow: true });
      for (const e of foes()) { const cp = closestPart(e, p.x, p.y - 8); if (cp.d < 34 + e.r && Math.abs(angDiff(p.aim, Math.atan2(cp.y - p.y + 8, cp.x - p.x))) < 0.9) damageEnemy(e, dmg, { src: 'ability', ang, kb: 25, silent: i % 3 !== 0 }); }
      Sound.play('hit', { p: 1.3 + (i % 3) * 0.1, v: 0.5 });
    });
  },
  fanhammer(p, a, def, dmg) {
    for (let v = 0; v < 2; v++) later(v * 0.25, () => {
      if (G.p !== p || p.dead) return;
      for (let k = 0; k < 6; k++) spawnProj({ team: 'p', src: 'ability', x: p.x, y: p.y - 8, ang: p.aim - 0.6 + (1.2 * k) / 5, speed: 430, dmg, life: 0.55, kind: 'bullet', pierce: 1, kb: 40, color: '#ffe08a', r: 2 });
      Sound.play('gunshot', { p: 0.9 }); Sound.play('gunshot', { p: 1.1 }); shake(2);
    });
  },
  blackhole(p, a, def, dmg, ang, tx, ty) {
    const life = 3 + (a.lvl - 1) * 0.5;
    G.fx.push({ kind: 'blackhole', x: tx, y: ty, r: 74, t: 0, life, tick: 0, update(f, dt) {
      for (const e of foes()) { if (e.boss || e.rooted) continue; const d = Math.hypot(e.x - f.x, e.y - f.y); if (d < f.r && d > 4) moveEnt(e, ((f.x - e.x) / d) * 70 * dt, ((f.y - e.y) / d) * 70 * dt); }
      f.tick -= dt; if (f.tick <= 0) { f.tick = 0.3; for (const e of foes()) if (Math.hypot(e.x - f.x, e.y - f.y) < 30) damageEnemy(e, dmg, { src: 'ability', noCrit: true, silent: true, color: '#c873ff' }); }
      if (!f.boomed && f.t > f.life - 0.06) { f.boomed = true; explode(f.x, f.y, 52, dmg * 7, { color: '#c873ff', parts: ['#c873ff', '#2a1440', '#ffffff'], sound: 'boom', shake: 6 }); }
    } });
    Sound.play('void');
  },
  iaido(p, a, def, dmg, ang) {
    p.iframes = Math.max(p.iframes, 0.5);
    Sound.play('swing', { p: 0.5, v: 0.4 });
    later(0.12, () => {
      if (G.p !== p || p.dead) return;
      const sx = p.x, sy = p.y, end = wallStop(p, p.aim, 120);
      dashStrike(p, p.aim, Math.max(0.08, Math.hypot(end.x - sx, end.y - sy) / 330), dmg, { kb: 60, critAdd: 0.5 });
      G.fx.push({ kind: 'slashline', x0: sx, y0: sy - 8, x1: end.x, y1: end.y - 8, t: 0, life: 0.4, color: '#ffffff' });
      Sound.play('katana', { p: 0.8 }); flashLight(end.x, end.y, 50, '#ffffff', 0.15);
    });
  },
  warsong(p, a) {
    p.warsongT = 6 + (a.lvl - 1);
    G.fx.push({ kind: 'notes', t: 0, life: p.warsongT });
    for (const e of G.ents) if (e.type === 'ally' && !e.dead) e.rateBuffT = p.warsongT;
    Sound.play('song'); ring(p.x, p.y - 8, 40, '#7dff9a', 0.6, 2);
  },
  blizzard(p, a, def, dmg, ang, tx, ty) {
    G.fx.push({ kind: 'blizzard', x: tx, y: ty, r: 54, t: 0, life: 4 + (a.lvl - 1) * 0.5, tick: 0, update(f, dt) {
      f.tick -= dt; if (f.tick > 0) return; f.tick = 0.35;
      for (const e of foes()) if (Math.hypot(e.x - f.x, e.y - f.y) < f.r + e.r) { damageEnemy(e, dmg, { src: 'ability', noCrit: true, silent: true, color: '#bfe9ff' }); applyChill(e); }
    } });
    Sound.play('wind');
  },
  quake(p, a, def, dmg) {
    for (let w = 0; w < 3; w++) later(w * 0.32, () => {
      if (G.p !== p) return;
      const R2 = 50 + w * 22;
      G.fx.push({ kind: 'quakewave', x: p.x, y: p.y, r: R2, t: 0, life: 0.45 });
      for (const e of foes()) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < R2 + e.r) { damageEnemy(e, dmg * (w === 0 ? 1 : 0.7), { src: 'ability', ang: Math.atan2(e.y - p.y, e.x - p.x), kb: 60 }); if (!e.boss) e.stunT = Math.max(e.stunT, 0.6); } }
      breakPropsIn(p.x, p.y, R2);
      Sound.play('slam', { p: 0.8 + w * 0.1 }); shake(5);
    });
  },
  clones(p, a, def, dmg) {
    for (let k = 0; k < 2 + (a.lvl >= 3 ? 1 : 0); k++) { const c = spawnAlly('ally_clone', p.x + rnd(-12, 12), p.y + rnd(-10, 10), 8); if (c) c.dmg = dmg; }
    Sound.play('magic', { p: 0.7 }); burst(p.x, p.y - 8, 16, ['#3a2c4a', '#7a5aa8', '#b98cff'], { smax: 80, grav: -30, floor: false });
  },
  thunderstorm(p, a, def, dmg) {
    const n = 7 + a.lvl;
    for (let k = 0; k < n; k++) later(k * 0.22, () => {
      if (G.p !== p) return;
      const list = foes();
      if (list.length) { const e = rndPick(list); lightningStrike(e.x, e.y, dmg); }
      else { const q = G.room ? randomFloorPoint(G.room, null, null, 0) : { x: p.x + rnd(-60, 60), y: p.y + rnd(-60, 60) }; lightningStrike(q.x, q.y, dmg); }
    });
    Sound.play('thunder', { p: 0.8 });
  },
  siphon(p, a, def, dmg) {
    G.fx.push({ kind: 'none', t: 0, life: 2 + (a.lvl - 1) * 0.3, tick: 0, update(f, dt) {
      f.tick -= dt; if (f.tick > 0) return; f.tick = 0.25;
      const q = G.p; if (q.dead) return;
      for (const e of foes()) if (Math.hypot(e.x - q.x, e.y - q.y) < 96) { const d = damageEnemy(e, dmg * 0.4, { src: 'ability', noCrit: true, silent: true, color: '#ff8a8a' }); heal(q, d * 0.25, true); G.fx.push({ kind: 'tether', a: e, b: q, t: 0, life: 0.24, color: '#e2434f' }); }
    } });
    Sound.play('siphon');
  },
  dragon(p, a, def, dmg) {
    G.fx.push({ kind: 'none', t: 0, life: 1.5 + (a.lvl - 1) * 0.25, acc: 0, update(f, dt) {
      const q = G.p; if (q.dead) return;
      f.acc += dt;
      while (f.acc > 0.035) { f.acc -= 0.035; spawnProj({ team: 'p', src: 'ability', x: q.x + Math.cos(q.aim) * 8, y: q.y - 9 + Math.sin(q.aim) * 6, ang: q.aim + rnd(-0.35, 0.35), speed: rnd(170, 230), dmg, life: 0.42, kind: 'pflame', pierce: 99, burn: 0.35, kb: 10, r: 4, light: Math.random() < 0.25 ? '#ff7a2a' : null }); }
    } });
    Sound.play('fire', { p: 0.6 }); Sound.play('roar', { p: 1.6, v: 0.4 });
  },
  pounce(p, a, def, dmg, ang, tx, ty) {
    let lx = tx, ly = ty;
    if (hitsWall(G.fl, lx, ly, p.r, p.fly)) { const w = wallStop(p, ang, Math.hypot(tx - p.x, ty - p.y)); lx = w.x; ly = w.y; }
    p.leapT = p.leapDur = 0.34; p.leapX0 = p.x; p.leapY0 = p.y; p.leapX1 = lx; p.leapY1 = ly; p.iframes = Math.max(p.iframes, 0.45);
    p.leapLand = () => {
      for (const e of foes()) if (closestPart(e, p.x, p.y - 4).d < 30 + e.r) damageEnemy(e, dmg, { src: 'ability', ang: Math.atan2(e.y - p.y, e.x - p.x), kb: 140, stun: 0.4 });
      burst(p.x, p.y - 4, 16, ['#ffb35e', '#e8642a', '#ffffff'], { smax: 110, glow: true }); Sound.play('bite'); Sound.play('slam', { p: 1.3, v: 0.5 }); shake(4);
    };
    Sound.play('growl', { p: 1.4 });
  },
  howl(p, a, def) {
    for (const e of foes()) if (Math.hypot(e.x - p.x, e.y - p.y) < 120 && !e.boss) e.fearT = Math.max(e.fearT || 0, 2 + (a.lvl - 1) * 0.5);
    p.howlT = 5;
    for (let k = 0; k < 3; k++) later(k * 0.12, () => ring(p.x, p.y - 8, 60 + k * 30, '#ffb35e', 0.5, 2));
    Sound.play('howl');
  },
  hellfire(p, a, def, dmg) {
    for (let w = 0; w < 3; w++) later(w * 0.18, () => {
      if (G.p !== p) return;
      for (let k = 0; k < 12; k++) spawnProj({ team: 'p', src: 'ability', x: p.x, y: p.y - 8, ang: (k * TAU) / 12 + w * 0.26, speed: 200, dmg, life: 0.7, kind: 'fireball', aoe: 18, burn: 1, r: 4, color: '#ff9a3c', light: k % 3 ? null : '#ff9a3c', kb: 60 });
      Sound.play('fire', { p: 0.8 + w * 0.15 });
    });
  },
  blazedash(p, a, def, dmg, ang) { dashStrike(p, ang, 0.3, dmg, { fire: true, burn: 1, kb: 120 }); Sound.play('fire', { p: 1.3 }); Sound.play('dash', { p: 0.7 }); },
  stampede(p, a, def, dmg, ang) { dashStrike(p, ang, 0.42, dmg, { zap: true, shock: 0.6, kb: 220, stun: 0.6 }); Sound.play('stampede'); shake(4); },
  overgrowth(p, a, def, dmg) {
    G.fx.push({ kind: 'thicket', x: p.x, y: p.y, r: 52, t: 0, life: 6 + (a.lvl - 1), tick: 0, update(f, dt) {
      const q = G.p; if (Math.hypot(q.x - f.x, q.y - f.y) < f.r) heal(q, (2 + a.lvl) * dt, true);
      f.tick -= dt; if (f.tick > 0) return; f.tick = 0.5;
      for (const e of foes()) if (Math.hypot(e.x - f.x, e.y - f.y) < f.r + e.r * 0.5) { if (!e.boss) { e.stunT = Math.max(e.stunT, 0.55); e.rootT = 0.6; } damageEnemy(e, dmg, { src: 'ability', noCrit: true, silent: true, color: '#a8e070' }); }
    } });
    Sound.play('grow');
  },
  briar(p, a, def, dmg) { for (let k = 0; k < 16; k++) spawnProj({ team: 'p', src: 'ability', x: p.x, y: p.y - 8, ang: (k * TAU) / 16 + p.aim, speed: 250, dmg, life: 0.6, kind: 'thorn', pierce: 1, poison: 0.3, kb: 40, color: '#a8e070' }); Sound.play('shoot', { p: 0.8 }); Sound.play('grow', { v: 0.5 }); },
  entangle(p, a, def, dmg) {
    for (const e of foes()) if (Math.hypot(e.x - p.x, e.y - p.y) < 86 && !e.boss) { e.stunT = Math.max(e.stunT, 2.5 + (a.lvl - 1) * 0.5); e.rootT = 2.5; damageEnemy(e, dmg, { src: 'ability', noCrit: true }); G.fx.push({ kind: 'roots', x: e.x, y: e.y, t: 0, life: 2.6 }); }
    Sound.play('grow'); ring(p.x, p.y, 86, '#5aa84a', 0.5, 2);
  },
  devour(p, a, def, dmg, ang) {
    const t = nearestFoe(p.x + Math.cos(ang) * 16, p.y + Math.sin(ang) * 16, 56);
    if (!t) { toast('Nothing in reach to devour'); return false; }
    if (!t.boss && (t.hp < t.maxHp * 0.35 || t.hp < dmg * 1.5)) {
      addText(t.x, t.y - t.h - 6, 'DEVOURED', '#7dff9a', 1); killEnemy(t, { src: 'ability' }); heal(p, Math.round(p.maxHp * 0.15));
    } else damageEnemy(t, dmg, { src: 'ability', ang, kb: 60 });
    burst(t.x, t.y - 6, 18, ['#3f9a2a', '#e2434f', '#ffffff'], { smax: 90 }); Sound.play('devour');
  },
  foxfire(p, a, def, dmg) { for (let k = 0; k < 7 + a.lvl * 2; k++) spawnProj({ team: 'p', src: 'ability', x: p.x + Math.cos((k * TAU) / 9) * 12, y: p.y - 8 + Math.sin((k * TAU) / 9) * 8, ang: (k * TAU) / 9, speed: 150, dmg, life: 2.2, kind: 'foxfire', homing: 7, chill: 0.4, r: 3, color: '#7fc8ff', light: k % 3 ? null : '#7fc8ff', kb: 20 }); Sound.play('magic', { p: 1.6 }); },
  whiteout(p, a, def, dmg) {
    p.veilT = 3 + (a.lvl - 1) * 0.5;
    G.fx.push({ kind: 'blizzard', x: p.x, y: p.y, r: 60, t: 0, life: p.veilT, tick: 0, follow: true, update(f, dt) { f.x = G.p.x; f.y = G.p.y; f.tick -= dt; if (f.tick > 0) return; f.tick = 0.3; for (const e of foes()) if (Math.hypot(e.x - f.x, e.y - f.y) < f.r) { applyChill(e); damageEnemy(e, dmg * 0.4, { src: 'ability', noCrit: true, silent: true, color: '#bfe9ff' }); } } });
    Sound.play('wind');
  },
  snowveil(p, a, def, dmg) {
    p.veilT = 1.2;
    for (const e of foes()) if (Math.hypot(e.x - p.x, e.y - p.y) < 58) { damageEnemy(e, dmg, { src: 'ability', ang: Math.atan2(e.y - p.y, e.x - p.x), kb: 70 }); applyChill(e, true); }
    burst(p.x, p.y - 8, 26, ['#ffffff', '#cfe9f7', '#9fe0ff'], { smax: 120, glow: true }); Sound.play('ice', { p: 1.2 });
  },
  staticfield(p, a, def, dmg) {
    G.fx.push({ kind: 'staticfield', r: 52, t: 0, life: 4 + (a.lvl - 1) * 0.5, tick: 0, update(f, dt) { f.tick -= dt; if (f.tick > 0) return; f.tick = 0.4; const q = G.p; for (const e of foes()) if (Math.hypot(e.x - q.x, e.y - q.y) < f.r + e.r) { damageEnemy(e, dmg, { src: 'ability', noCrit: true, silent: true, shock: 0.4, color: '#fff27a' }); zapFx(q.x, q.y - 8, e.x, e.y - e.h / 2, '#9ff6ff', 0.1); } } });
    Sound.play('zap', { p: 0.6 });
  },
  reap(p, a, def, dmg, ang) {
    let kills = 0;
    for (const e of foes()) { const cp = closestPart(e, p.x, p.y - 8); if (cp.d < 58 + e.r && Math.abs(angDiff(ang, Math.atan2(cp.y - p.y + 8, cp.x - p.x))) < 1.6) { damageEnemy(e, dmg, { src: 'ability', ang, kb: 120 }); if (e.dead) kills++; } }
    G.fx.push({ kind: 'slash', x: p.x, y: p.y - 8, ang, arc: 3.2, reach: 58, t: 0, life: 0.3, dir: 1, style: 'slash', heavy: true, color: '#c873ff' });
    Sound.play('heavy', { p: 0.6 }); Sound.play('void', { v: 0.5 });
    if (kills) later(0.02, () => { a.cd *= 0.5; addText(p.x, p.y - 28, 'REAPED', '#c873ff'); });
  },
  terror(p, a, def, dmg) {
    for (const e of foes()) if (Math.hypot(e.x - p.x, e.y - p.y) < 110) { if (!e.boss) e.fearT = Math.max(e.fearT || 0, 3 + (a.lvl - 1) * 0.5); damageEnemy(e, dmg, { src: 'ability', noCrit: true }); }
    ring(p.x, p.y - 8, 110, '#e2434f', 0.6, 2); ring(p.x, p.y - 8, 70, '#2a1430', 0.5, 3); Sound.play('scream');
  },
  stoneskin(p, a) { p.stoneT = 4 + (a.lvl - 1); Sound.play('slam', { p: 1.5, v: 0.5 }); burst(p.x, p.y - 8, 14, ['#8a8478', '#c8bfa8'], { smax: 60 }); },
  prism(p, a, def, dmg) {
    const fx = { kind: 'beam', follow: true, ang: p.aim, len: 140, width: 6, rainbow: true, t: 0, life: 1.2 + (a.lvl - 1) * 0.2, tick: 0, update(f, dt) {
      const q = G.p; f.ang = q.aim; f.tick -= dt; if (f.tick > 0) return; f.tick = 0.1;
      const cx = Math.cos(f.ang), cy = Math.sin(f.ang);
      for (const e of foes()) { const cp = closestPart(e, q.x, q.y - 8), rx = cp.x - q.x, ry = cp.y - q.y + 8, al = rx * cx + ry * cy; if (al > 0 && al < f.len + e.r && Math.abs(-rx * cy + ry * cx) < 8 + e.r) damageEnemy(e, dmg, { src: 'ability', noCrit: false, silent: true, color: rndPick(['#ff6f9c', '#fff27a', '#7fc8ff']) }); }
    } };
    G.fx.push(fx); Sound.play('beam');
  },
});

/* ============================================================
   Hero passives (new classes)
   ============================================================ */
hook('stats', (s, p) => {
  if (p.cls === 'monk') s.dodge += 0.12;
  if (p.cls === 'witch') s.potMax += 1;
  if (p.cls === 'samurai') s.critMul += 0.3;
});
const FIGHT_ROOMS = ['combat', 'elite', 'exit', 'boss', 'challenge'];
hook('onRoomEnter', (r) => {
  const p = G.p;
  if (!p || r.cleared || !FIGHT_ROOMS.includes(r.type)) return;
  const n = (p.cls === 'paladin' ? 1 : 0) + (p.stats.secondSkin ? 1 : 0);
  if (n) { p.shieldHits = Math.max(p.shieldHits, n); }
  if (p.stats.chaosEye && !r.eyeAdded && r.waves && r.waves[0] && G.fl.info) { r.eyeAdded = true; const q = randomFloorPoint(r, p.x, p.y, 80); r.waves[0].push({ kind: rndPick(G.fl.info.act.elites), x: q.x, y: q.y, elite: true }); }
});
hook('onDash', (p) => {
  const s = p.stats;
  if (p.cls === 'monk') heal(p, 2, true);
  if (p.cls === 'gunslinger') p.critNext = Math.max(p.critNext, 1);
  if (s.adrenaline) p.adrenT = 1.5;
  p.sdHit = new Set();
  if (s.stormDash) { p.sdN = (p.sdN || 0) + 1; if (p.sdN % 3 === 0) { const list = foes().filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 100).slice(0, 3); for (const e of list) lightningStrike(e.x, e.y, 30 * scaleF()); } }
});
hook('potion', (p) => {
  if (p.cls !== 'witch') return;
  for (const e of foes()) if (Math.hypot(e.x - p.x, e.y - p.y) < 110) e.hexT = 6;
  ring(p.x, p.y - 8, 110, '#8fe05c', 0.5, 2); Sound.play('hex', { p: 0.7 });
});
hook('onAbility', (p, a) => {
  const s = p.stats, slot = p.abilities.indexOf(a);
  if (p.cls === 'bard') { p.encoreN = (p.encoreN || 0) + 1; if (p.encoreN % 4 === 0) { a.cd = 0.3; addText(p.x, p.y - 28, 'ENCORE', '#7dff9a', 1); Sound.play('chord'); } }
  if (s.cascade) { const o = p.abilities[1 - slot]; if (o && o.cd > 0) o.cd = Math.max(0, o.cd - s.cascade); }
  if (s.twinSouls && !p.twinning && Math.random() < s.twinSouls) later(0.22, () => {
    if (G.p !== p || p.dead || !p.abilities[slot] || p.abilities[slot] !== a) return;
    const keep = a.cd; p.twinning = true; a.cd = 0;
    try { castAbility(p, slot); } finally { p.twinning = false; }
    a.cd = keep; addText(p.x, p.y - 30, 'TWIN', '#b98cff');
  });
});

/* ============================================================
   Statuses and per-frame engines
   ============================================================ */
hook('dmgMul', (e, o, p, crit) => {
  if (o.src === 'trap' || o.src === 'keg') return 1;
  const s = p.stats;
  let m = 1;
  if (s.giantSlayer && (e.boss || e.eliteMods || e.chaos)) m *= 1 + s.giantSlayer;
  if (s.lastStand && p.hp < p.maxHp * 0.35) m *= 1.4;
  if (s.opportunist && (e.stunT > 0 || e.freezeT > 0 || e.chillT > 0)) m *= 1 + s.opportunist;
  if (p.bloodN) m *= 1 + 0.03 * p.bloodN;
  if (p.rageT > 0) m *= 1.35;
  if (p.howlT > 0) m *= 1.3;
  if (s.comboDmg && G.combo) m *= 1 + Math.min(0.3, s.comboDmg * G.combo.n);
  if (s.dice && !o.dot) m *= 0.5 + Math.random() * 1.5;
  if (e.hexT > 0) m *= 1.25;
  // shields block from the front
  if (e.def && e.def.shield && !o.dot && o.ang != null && o.src !== 'shock') {
    const front = e.face > 0 ? 0 : Math.PI;
    if (Math.abs(angDiff(front, o.ang + Math.PI)) < 1.1) { m *= 0.3; if (!e.blockT || G.t - e.blockT > 0.4) { e.blockT = G.t; addText(e.x, e.y - e.h - 8, 'BLOCK', '#cfe9ff'); Sound.play('block', { v: 0.4 }); } }
  }
  return m;
});
hook('preHurt', (dmg, src, p) => {
  const s = p.stats;
  if (s.lastStand && p.hp < p.maxHp * 0.35) dmg *= 0.75;
  if (p.stoneT > 0) dmg *= 0.3;
  return dmg;
});
hook('onHurt', (dmg, src, p) => {
  const s = p.stats, ent = src.ent;
  if (s.vengeance) explode(p.x, p.y, 40, s.vengeance * scaleF(), { color: '#ffd08a', vol: 0.4, shake: 2, scorch: false });
  if (s.rageMask) p.rageT = 4;
  if (ent && !ent.dead && ent.type === 'enemy') {
    if (s.frostArmor) { applyChill(ent, true); applyChill(ent, true); }
    if (s.venomBlood) for (let k = 0; k < 3; k++) applyPoison(ent, 20 * scaleF());
    if (s.burnTouch) applyBurn(ent, 20 * scaleF());
  }
});
hook('onHit', (e, dmg, o, crit) => {
  const p = G.p, s = p.stats;
  if (o.hex) e.hexT = 4;
  if (o.fear && !e.boss && Math.random() < o.fear) e.fearT = Math.max(e.fearT || 0, 1.5);
  if (crit && s.critHeal) heal(p, s.critHeal, true);
  if (o.src !== 'weapon') return;
  const def = p.weapon && WEAPON[p.weapon.id];
  if (s.spellweaver) for (const a of p.abilities) if (a && a.cd > 0) a.cd = Math.max(0, a.cd - s.spellweaver);
  if (s.overcharge) { p.ocN = (p.ocN || 0) + 1; if (p.ocN % 12 === 0) { const list = foes().filter((q) => Math.hypot(q.x - e.x, q.y - e.y) < 90).slice(0, 4); for (const q of list) lightningStrike(q.x, q.y, Math.max(12, dmg * 0.8)); } }
  if (def && def.fx === 'bleed' && crit) e.bleed = { t: 3, dps: Math.max(2, dmg * 0.3), tick: 0.5 };
  if (def && def.fx === 'midas' && Math.random() < 0.08) dropPickup('gold', e.x, e.y, 1);
});
hook('projHit', (pr, e) => {
  const p = G.p;
  if (pr.team !== 'p' || pr.src !== 'weapon' || pr.split || !p.stats.hydra) return;
  for (const s of [-0.6, 0.6]) spawnProj({ team: 'p', src: 'weapon', x: pr.x, y: pr.y, ang: Math.atan2(pr.vy, pr.vx) + s, speed: Math.hypot(pr.vx, pr.vy) * 0.85, dmg: pr.dmg * 0.5, life: 0.35, kind: pr.kind === 'pflame' ? 'pflame' : pr.kind, color: pr.color, r: 2, kb: 20, split: true });
});
hook('onKill', (e) => {
  const p = G.p, s = p.stats;
  if (e.type !== 'enemy' || e.summoned) return;
  const def = p.weapon && WEAPON[p.weapon.id];
  if (s.bloodlust) { p.bloodN = Math.min(15, (p.bloodN || 0) + 1); p.bloodT = 6; }
  if (p.cls === 'samurai' && p.dashCharges < s.dashMax) p.dashCharges++;
  if (s.necroBook) { p.bookN = (p.bookN || 0) + 1; if (p.bookN % 6 === 0) spawnAlly('ally_skel', e.x, e.y, 20); }
  if (s.voidRift && Math.random() < s.voidRift) G.fx.push({ kind: 'blackhole', x: e.x, y: e.y, r: 54, t: 0, life: 1.4, tick: 0, update(f, dt) { for (const q of foes()) { if (q.boss || q.rooted) continue; const d = Math.hypot(q.x - f.x, q.y - f.y); if (d < f.r && d > 4) moveEnt(q, ((f.x - q.x) / d) * 90 * dt, ((f.y - q.y) / d) * 90 * dt); } } });
  if (s.midasKill && Math.random() < s.midasKill) { dropPickup('gold', e.x, e.y, 8 + G.fl.idx * 2); addText(e.x, e.y - e.h - 8, 'GOLD!', '#ffd35c', 1); burst(e.x, e.y - 6, 14, ['#ffd35c', '#fff0a0', '#c8901c'], { smax: 90, glow: true }); Sound.play('coin', { p: 0.8 }); }
  if ((e.eliteMods || e.boss || e.chaos) && s.sands) { for (const a of p.abilities) if (a) a.cd = 0; addText(p.x, p.y - 30, 'RESET', '#cfe9f7'); }
  if (e.eliteMods && s.chaosEye && Math.random() < 0.12) { const id = randomRelic(G.run.rng); if (id) spawnItem({ type: 'relic', id }, e.x, e.y); }
  if (def && def.fx === 'feast') heal(p, 3, true);
  if (def && def.fx === 'souls') spawnProj({ team: 'p', src: 'weapon', x: e.x, y: e.y - 8, ang: rnd(TAU), speed: 120, dmg: weaponDamage(p) * 0.6, life: 2, kind: 'soulbolt', homing: 8, r: 3, color: '#9ff6ff', light: '#9ff6ff', kb: 20, split: true });
  if (e.hexT > 0) { explode(e.x, e.y, 30, 12 * scaleF() + e.maxHp * 0.15, { color: '#8fe05c', parts: ['#8fe05c', '#c873ff', '#2a1440'], vol: 0.4, shake: 2, sound: 'hex' }); }
});
hook('onAttack', (p, def, w, dmg) => {
  const reach = (def.reach || 24) * p.stats.reachMul;
  if (def.kind === 'melee' && typeof revealSecretAt === 'function') revealSecretAt(p.x + Math.cos(p.aim) * reach, p.y - 8 + Math.sin(p.aim) * reach, 14);
  if (def.fx === 'holywave' || (def.fx === 'bloodwave' && p.combo === (def.combo || 3) - 1)) spawnProj({ team: 'p', x: p.x, y: p.y - 7, ang: p.aim, speed: 240, dmg: dmg * 0.9, life: 0.5, kind: 'wave', pierce: 99, r: 7, kb: 70, color: def.fx === 'holywave' ? '#ffe8a0' : '#e2434f', light: def.fx === 'holywave' ? '#ffd35c' : '#e2434f' });
  if (def.fx === 'windlance') spawnProj({ team: 'p', x: p.x, y: p.y - 8, ang: p.aim, speed: 320, dmg: dmg * 0.7, life: 0.42, kind: 'wave', pierce: 99, r: 5, kb: 90, color: '#e9f8ff' });
  if (def.fx === 'quakering') later(0.12, () => { if (G.p !== p) return; const tx = p.x + Math.cos(p.aim) * reach * 0.9, ty = p.y - 4 + Math.sin(p.aim) * reach * 0.9; for (let k = 0; k < 8; k++) spawnProj({ team: 'p', x: tx, y: ty - 4, ang: (k * TAU) / 8, speed: 200, dmg: dmg * 0.45, life: 0.45, kind: 'shard', color: '#c8a070', r: 3, kb: 40 }); });
  if (def.fx === 'knuckleboom' && p.combo === 3) later(0.06, () => { if (G.p !== p) return; explode(p.x + Math.cos(p.aim) * 18, p.y - 8 + Math.sin(p.aim) * 14, 24, dmg * 1.6, { color: '#ffb35e', vol: 0.4, shake: 3, src: 'weapon' }); });
});
// explosions grow with Demolition
const _explode = explode;
explode = function (x, y, r, dmg, o = {}) {
  const s = G.p && G.p.stats;
  if (s && s.boomMul > 1 && o.team !== 'e' && o.team !== 'none') { r *= s.boomMul; dmg *= s.boomMul; }
  return _explode(x, y, r, dmg, o);
};
hook('update', (dt) => {
  const p = G.p;
  if (!p || p.dead) return;
  const s = p.stats;
  for (const k of ['adrenT', 'rageT', 'howlT', 'warsongT', 'veilT', 'stoneT', 'bloodT']) if (p[k] > 0) p[k] = Math.max(0, p[k] - dt);
  if (p.bloodT <= 0) p.bloodN = 0;
  p.atkBonus = (p.adrenT > 0 ? s.adrenaline : 0) + (s.berserk && p.hp < p.maxHp * 0.5 ? 0.6 : 0) + (p.warsongT > 0 ? 0.4 : 0);
  if (p.warsongT > 0) heal(p, dt, true);
  // statuses on foes
  for (const e of G.ents) {
    if (e.dead) continue;
    if (e.hexT > 0) e.hexT -= dt;
    if (e.rootT > 0) e.rootT -= dt;
    if (e.bleed) { e.bleed.t -= dt; e.bleed.tick -= dt; if (e.bleed.tick <= 0) { e.bleed.tick = 0.5; damageEnemy(e, e.bleed.dps * 0.5, { dot: true, color: '#e2434f' }); if (Math.random() < 0.5) burst(e.x, e.y - e.h / 2, 2, ['#e2434f', '#a8202a'], { smax: 20 }); } if (e.bleed && e.bleed.t <= 0) e.bleed = null; }
    if (e.type === 'ally' && e.rateBuffT > 0) e.rateBuffT -= dt;
  }
  // relic and skill engines
  if (s.wildfire) { p.wfT = (p.wfT || 0) - dt; if (p.wfT <= 0) { p.wfT = 1; for (const e of foes()) if (e.burn) { const n = nearestFoe(e.x, e.y, 64, (q) => q !== e && !q.burn); if (n) { applyBurn(n, e.burn.dps / 0.28); burst(n.x, n.y - 6, 4, ['#ff9a3c', '#ffd08a'], { smax: 40, glow: true }); } } } }
  if (s.burnAura) { p.baT = (p.baT || 0) - dt; if (p.baT <= 0) { p.baT = 2; const R3 = 34 + 12 * s.burnAura; let any = false; for (const e of foes()) if (Math.hypot(e.x - p.x, e.y - p.y) < R3) { applyBurn(e, 10 * scaleF()); any = true; } if (any) ring(p.x, p.y - 4, R3, '#ff9a3c', 0.4, 1); } }
  if (s.frostPulse && G.combat) { p.fpT = (p.fpT || s.frostPulse) - dt; if (p.fpT <= 0) { p.fpT = s.frostPulse; ring(p.x, p.y - 4, 60, '#cfefff', 0.4, 2); Sound.play('ice', { v: 0.5 }); for (const e of foes()) if (Math.hypot(e.x - p.x, e.y - p.y) < 60 + e.r) { applyChill(e, true); damageEnemy(e, 10 * scaleF(), { src: 'ability', noCrit: true, silent: true, color: '#bfe9ff' }); } } }
  if (s.curseBleed && G.combat && p.hp > 1) p.hp = Math.max(1, p.hp - s.curseBleed * dt);
  if (s.meteorCharm && G.combat) {
    p.mcT = (p.mcT || 4) - dt;
    if (p.mcT <= 0) { p.mcT = s.meteorCharm; const list = foes(); if (list.length) { const t = list.reduce((a, b) => (b.hp > a.hp ? b : a)); const x = t.x, y = t.y; telegraph({ x, y, r: 30, life: 0.8, team: 'p', color: '#ff7a2a', fire: () => explode(x, y, 32, 50 * scaleF(), { burn: 1, color: '#ff9a3c', shake: 4, crit: true }) }); G.fx.push({ kind: 'meteor', x, y, t: 0, life: 0.8 }); } }
  }
  if (s.moons) {
    p.moonA = (p.moonA || 0) + dt * 1.6; p.moonT = (p.moonT || 0) - dt;
    if (p.moonT <= 0 && G.combat) {
      p.moonT = 0.9;
      for (let k = 0; k < s.moons; k++) { const a = p.moonA + (k * TAU) / s.moons, mx = p.x + Math.cos(a) * 20, my = p.y - 14 + Math.sin(a) * 10, t = nearestFoe(mx, my, 160); if (t) spawnProj({ team: 'p', src: 'ability', x: mx, y: my, ang: Math.atan2(t.y - t.h / 2 - my, t.x - mx), speed: 230, dmg: 6 * scaleF() * s.abDmg, life: 0.8, kind: 'missile', color: '#e8e0cc', light: '#cfe9f7', r: 2, kb: 15 }); }
    }
  }
  if (s.bat) {
    p.batA = (p.batA || 0) + dt * 2.6; p.batT = (p.batT || 0) - dt;
    const bx = p.x + Math.cos(p.batA) * 24, by = p.y - 14 + Math.sin(p.batA) * 12;
    if (p.batT <= 0) { const t = nearestFoe(bx, by, 50); if (t) { p.batT = 0.7; damageEnemy(t, 8 * scaleF(), { src: 'ability', noCrit: true, color: '#ff6a8a' }); heal(p, 1, true); Sound.play('bite', { p: 1.6, v: 0.3 }); } else p.batT = 0.2; }
  }
  // dash engines
  if (p.dashT > 0) {
    if (s.dashFire && Math.random() < 0.5) G.fx.push({ kind: 'firefield', x: p.x, y: p.y, r: 10, t: 0, life: 2, team: 'p', burn: true, base: 10 * scaleF(), tick: 0, small: true });
    if (s.staticDash && p.sdHit) for (const e of foes()) if (!p.sdHit.has(e) && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 12) { p.sdHit.add(e); applyShock(e, 12 * scaleF()); damageEnemy(e, 10 * scaleF(), { src: 'shock', noCrit: true, color: '#fff27a' }); }
  }
});
// moons and the bat familiar circle the hero at chest height, standing up like everything else
hook('renderCards', (card) => {
  const p = G.p;
  if (!p || p.dead) return;
  const s = p.stats;
  if (s.moons) for (let k = 0; k < s.moons; k++) {
    const a = (p.moonA || 0) + (k * TAU) / s.moons, mx = p.x + Math.cos(a) * 20, my = p.y + Math.sin(a) * 10;
    card(`moon${k}`, mx, my, 16, 32, 4, (g, cx, cy) => { const x = Math.round(mx - cx), y = Math.round(my - 14 - cy); g.fillStyle = OUTLINE; g.fillRect(x - 3, y - 3, 6, 6); g.fillStyle = k ? '#cfe9f7' : '#e8e0cc'; g.fillRect(x - 2, y - 2, 4, 4); g.fillStyle = '#ffffff'; g.fillRect(x - 2, y - 2, 1, 1); });
  }
  if (s.bat) {
    const bx = p.x + Math.cos(p.batA || 0) * 24, by = p.y + Math.sin(p.batA || 0) * 12;
    card('bat', bx, by, 48, 48, 4, (g, cx, cy) => { const x = bx - cx, y = by - 14 - cy, sp = monsterFrames('bat', { tint: '#c43a5a' })[Math.floor(G.t * 8) % 2]; g.drawImage(sp.c, Math.round(x - sp.ax * 0.6), Math.round(y - sp.ay * 0.6), Math.round(sp.w * 0.6), Math.round(sp.h * 0.6)); });
  }
});
hook('entOverlay', (g, e, x, y) => {
  const top = Math.round(y - e.h * (e.scale || 1) - 10);
  if (e.hexT > 0) { g.fillStyle = Math.floor(G.t * 6) % 2 ? '#8fe05c' : '#c873ff'; g.fillRect(Math.round(x) - 1, top - 3, 3, 3); g.fillRect(Math.round(x) - 3, top - 1, 7, 1); }
  if (e.fearT > 0) { const t = pixelText('!?', '#c873ff'); g.drawImage(t, Math.round(x - t.width / 2), top - 8); }
  if (e.bleed) { g.fillStyle = '#e2434f'; g.fillRect(Math.round(x + Math.sin(G.t * 9) * 4), Math.round(y - e.h / 2 + ((G.t * 30) % 8)), 1, 2); }
});

/* ============================================================
   Weapon evolution at the forge
   ============================================================ */
function weaponEvoInfo(p, w) {
  const id = EVOLVE_FROM[w.id];
  if (!id || p.beast) return null;
  const E = WEAPON[id], need = typeof evoNeed === 'function' ? evoNeed(p) : 3;
  return { id, def: E, need, relic: E.relic, hasRelic: p.relics.includes(E.relic), hasLvl: (w.lvl || 0) >= need, ok: p.relics.includes(E.relic) && (w.lvl || 0) >= need };
}
function evolveWeapon(p, w) {
  const info = weaponEvoInfo(p, w);
  if (!info || !info.ok) return false;
  const from = WEAPON[w.id].name;
  w.id = info.id; w.rar = 'evolved';
  const pool = AFFIXES.filter((a) => (!a.ranged || info.def.kind === 'ranged') && !w.affixes.includes(a.id)).map((a) => a.id);
  while (w.affixes.length < 3 && pool.length) w.affixes.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  recalcStats(p);
  G.slowmo = Math.max(G.slowmo, 0.5); shake(8);
  ring(p.x, p.y - 10, 60, EVO_TINT[info.id] || '#ff4a6e', 0.8, 3);
  burst(p.x, p.y - 10, 40, [EVO_TINT[info.id] || '#ff4a6e', '#ffffff', '#ffd35c'], { smax: 150, glow: true, vz: 120 });
  banner(info.def.name, `${from} evolved`, 2.8);
  Sound.play('evolve');
  const fs = CD.save.fs; fs.weaponEvos = (fs.weaponEvos || 0) + 1;
  CD.save.seen = CD.save.seen || {}; CD.save.seen[info.id] = 1;
  persist();
  return true;
}

