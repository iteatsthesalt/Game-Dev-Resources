/* ============================================================
   Cinderdeep — new brains: eleven monsters, egg sacs, mimics,
   and four new bosses with region boss pools
   ============================================================ */
Object.assign(SHOT, {
  soul: { speed: 110, r: 4, kind: 'soul', color: '#9ff6ff', light: '#9ff6ff' },
  soulbig: { speed: 120, r: 6, kind: 'bigorb', color: '#9ff6ff', light: '#9ff6ff', big: true },
  spark: { speed: 150, r: 2, kind: 'spark', color: '#d8ff6a', light: '#d8ff6a' },
  frostorb: { speed: 72, r: 6, kind: 'bigorb', color: '#bfe9ff', light: '#9fe0ff', big: true, chill: true },
  dfire: { speed: 150, r: 6, kind: 'bigfire', color: '#ff9a3c', light: '#ff7a2a', big: true },
  coin: { speed: 150, r: 3, kind: 'coinshot', color: '#ffd35c' },
  chaos: { speed: 120, r: 4, kind: 'chaosbolt', color: '#ff4ad0', light: '#c873ff' },
  wail: { speed: 82, r: 4, kind: 'wail', color: '#cfe9f7', light: '#cfe9f7', slow: 1 },
});
Object.assign(ENEMIES, {
  eggsac: { name: 'Egg Sac', hp: 26, spd: 0, r: 6, dmg: 0, xp: 1, gold: 0, ai: 'eggsac', rooted: true, sprite: 'eggsac' },
  spiderling: { name: 'Spiderling', hp: 10, spd: 86, r: 4, dmg: 6, xp: 1, gold: 0.2, ai: 'lunger', sprite: 'spiderling' },
});
Object.assign(ENEMIES.firefly, { swarm: 2 });
hook('spawned', (e, o) => {
  if (e.def.swarm && !o.noSwarm && e.type === 'enemy') for (let k = 0; k < e.def.swarm; k++) spawnEnemy(e.kind, e.x + rnd(-12, 12), e.y + rnd(-12, 12), { room: e.room, noSwarm: true, noSpawnAnim: o.noSpawnAnim });
});
const _bloodFor = bloodFor;
bloodFor = function (kind) {
  return { boneknight: ['#e8e0cc', '#8a8a9a'], crawler: ['#c8c0a8', '#7a2a2a'], banshee: ['#cfe0f0', '#ffffff'], firefly: ['#d8ff6a', '#3a3a2a'], toad: ['#5a8a3a', '#c8d880'], shroombrute: ['#c43a3a', '#e8dcc6'], frostmage: ['#9fe0ff', '#5a8ab8'], mammoth: ['#7a5a3a', '#e8e0cc'], elemental: ['#ff9a3c', '#ffd08a'], hellhound: ['#3a1a1a', '#ff7a2a'], mimic: ['#8a5a32', '#ffd35c'], eggsac: ['#e8e8f0', '#8fe05c'], spiderling: ['#2e2638', '#8fe05c'] }[kind] || _bloodFor(kind);
};
TOP_FX.tongue = (g, f, cx, cy) => {
  const k = f.t / f.life, ext = Math.sin(Math.min(1, k * 1.6) * Math.PI), x0 = f.x - cx, y0 = f.y - cy, L = f.len * ext;
  pxLine(g, x0, y0, x0 + Math.cos(f.ang) * L, y0 + Math.sin(f.ang) * L, '#e2607a', 2);
  g.fillStyle = '#ff9ab0'; g.fillRect(Math.round(x0 + Math.cos(f.ang) * L) - 2, Math.round(y0 + Math.sin(f.ang) * L) - 2, 4, 4);
};

Object.assign(AI, {
  none() {},
  knight(e, dt, p) {
    if (e.st === 'bash') {
      e.stT -= dt; e.pose = 2;
      walk(e, Math.cos(e.ba), Math.sin(e.ba), 190, dt);
      if (e.stT <= 0) { e.st = 'recover'; e.stT = 0.6; e.contactDmg = null; }
      return;
    }
    e.bashCd = (e.bashCd ?? rnd(2, 4)) - dt;
    const d = distP(e);
    if (e.bashCd <= 0 && d < 100 && d > 30 && e.st !== 'windup' && e.st !== 'lunge' && lineOfSight(G.fl, e.x, e.y, p.x, p.y)) {
      e.bashCd = rnd(3.5, 5); e.st = 'bash'; e.stT = 0.4; e.ba = angP(e); e.contactDmg = e.dmg * 1.3;
      telegraph({ x: e.x, y: e.y - 4, ang: e.ba, len: 76, life: 0.3, line: true, width: 12, color: '#cfe9ff' }); Sound.play('growl', { p: 1.5, v: 0.4 });
      return;
    }
    AI.melee(e, dt, p);
  },
  banshee(e, dt, p) {
    e.atkCd -= dt;
    if (e.st === 'wail') {
      e.stT -= dt; e.pose = 2;
      if (e.stT <= 0) {
        e.st = 'drift';
        const n = e.eliteMods ? 16 : 12, off = rnd(TAU);
        for (let k = 0; k < n; k++) eShot(e, 'wail', off + (k * TAU) / n, { life: 3 });
        if (distP(e) < 64 + p.r && hurtPlayer(e.dmg * 0.7, {}) === HIT.HIT) p.slowT = Math.max(p.slowT || 0, 1.4);
        ring(e.x, e.y - 8, 64, '#cfe9f7', 0.4, 2); Sound.play('scream', { p: 1.4, v: 0.6 });
      }
      return;
    }
    e.pose = 0;
    if (e.atkCd <= 0 && distP(e) < e.def.range) { e.atkCd = rate(e); e.st = 'wail'; e.stT = 0.6; telegraph({ x: e.x, y: e.y, r: 64, life: 0.6, color: '#cfe9f7' }); return; }
    e.wob = (e.wob || rnd(TAU)) + dt * 1.6;
    const a = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2 * Math.sin(e.wob), d = distP(e);
    walk(e, Math.cos(a) * (d > 70 ? 1 : -0.6), Math.sin(a) * (d > 70 ? 1 : -0.6), e.spd, dt);
    faceTo(e, p.x);
  },
  firefly(e, dt, p) {
    AI.flutter(e, dt, p);
    e.atkCd -= dt;
    if (e.atkCd <= 0 && distP(e) < 130) { e.atkCd = rate(e) * rnd(1, 1.6); eShot(e, 'spark', angP(e, 0.15)); Sound.play('zap', { p: 2, v: 0.25 }); }
  },
  toad(e, dt, p) {
    if (e.st === 'aim') {
      e.stT -= dt; e.pose = 2;
      if (e.stT <= 0) {
        e.st = 'lash'; e.stT = 0.3;
        G.fx.push({ kind: 'tongue', x: e.x + e.face * 6, y: e.y - 6, ang: e.la, len: e.def.range, t: 0, life: 0.3, enemy: true });
        Sound.play('whip', { p: 0.6, v: 0.5 });
        const rx = p.x - e.x, ry = p.y - 7 - (e.y - 6), al = rx * Math.cos(e.la) + ry * Math.sin(e.la), ac = Math.abs(-rx * Math.sin(e.la) + ry * Math.cos(e.la));
        if (al > 0 && al < e.def.range + 4 && ac < 9 && hurtPlayer(e.dmg, { ent: e }) === HIT.HIT) { p.vx -= Math.cos(e.la) * 260; p.vy -= Math.sin(e.la) * 260; }
      }
      return;
    }
    if (e.st === 'lash') { e.stT -= dt; if (e.stT <= 0) { e.st = 'land'; e.stT = 0.5; } return; }
    e.atkCd -= dt;
    const d = distP(e);
    if (e.atkCd <= 0 && d < e.def.range && e.st !== 'air' && lineOfSight(G.fl, e.x, e.y, p.x, p.y)) {
      e.atkCd = rnd(2, 3) * (e.rateMul || 1); e.st = 'aim'; e.stT = 0.4; e.la = angP(e); faceTo(e, p.x);
      telegraph({ x: e.x, y: e.y - 6, ang: e.la, len: e.def.range, life: 0.4, line: true, width: 6, color: '#e2607a' });
      return;
    }
    AI.hop(e, dt, p);
    if (e.st === 'air') faceTo(e, e.x + Math.cos(e.ha));
  },
  brute(e, dt, p) {
    const was = e.st;
    AI.slammer(e, dt, p);
    if (was === 'raise' && e.st === 'recover') {
      G.fx.push({ kind: 'cloud', x: e.x, y: e.y - 4, r: 34, t: 0, life: 3, team: 'e', poison: true, color: '#c8ff6a', tick: 0.3 });
      for (let k = 0; k < 8; k++) eShot(e, 'spore', (k * TAU) / 8 + 0.2, { y: e.y - 6 });
    }
  },
  frostmage(e, dt, p) {
    e.atkCd -= dt;
    if (e.st === 'cast') {
      e.stT -= dt; e.pose = 2;
      if (e.stT <= 0) {
        e.st = 'move';
        if (e.spell === 'orb') { const pr = eShot(e, 'frostorb', angP(e), { y: e.y - 12, life: 3 }); pr.onEnd = (q) => { for (let k = 0; k < 8; k++) spawnProj({ team: 'e', x: q.x, y: q.y, ang: (k * TAU) / 8, speed: 120, dmg: e.dmg * 0.6, life: 1.2, kind: 'eshard', color: '#cfefff', chill: true, r: 3 }); burst(q.x, q.y, 8, ['#ffffff', '#9fe0ff'], { smax: 60 }); }; Sound.play('ice', { p: 0.6 }); }
        else {
          const tx = p.x, ty = p.y;
          for (let k = 0; k < (e.eliteMods ? 5 : 3); k++) { const a = rnd(TAU), rr = k ? rnd(14, 34) : 0, x = tx + Math.cos(a) * rr, y = ty + Math.sin(a) * rr; later(k * 0.12, () => telegraph({ x, y, r: 12, life: 0.75, color: '#cfefff', fire: () => { G.fx.push({ kind: 'icicle', x, y, t: 0, life: 0.8 }); Sound.play('shard', { v: 0.4 }); if (Math.hypot(G.p.x - x, G.p.y - y) < 12 + G.p.r && hurtPlayer(e.dmg, { ent: e }) === HIT.HIT) G.p.chillT = 1.5; } })); }
        }
      }
      return;
    }
    e.pose = 0;
    const d = distP(e), los = lineOfSight(G.fl, e.x, e.y - 8, p.x, p.y - 8);
    if (e.atkCd <= 0 && d < e.def.range) { e.atkCd = rate(e); e.st = 'cast'; e.stT = 0.6; e.spell = Math.random() < 0.5 && los ? 'orb' : 'icicles'; flashLight(e.x, e.y - 12, 26, '#9fe0ff', 0.6); return; }
    let a;
    if (d < 90) a = Math.atan2(e.y - p.y, e.x - p.x); else if (d > 150 || !los) { const s2 = steerTo(e, p.x, p.y); a = Math.atan2(s2.y, s2.x); } else a = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2 * (e.side || (e.side = rndPick([-1, 1])));
    walk(e, Math.cos(a), Math.sin(a), e.spd, dt); faceTo(e, p.x);
  },
  elemental(e, dt, p) {
    e.orbA = (e.orbA || 0) + dt * 3;
    // two fire motes circle it and burn on touch
    for (let k = 0; k < 2; k++) { const a = e.orbA + k * Math.PI, ox = e.x + Math.cos(a) * 16, oy = e.y - 10 + Math.sin(a) * 9; if (Math.random() < 0.3) burst(ox, oy, 1, ['#ffd08a', '#ff7a2a'], { grav: -20, floor: false, smax: 8, glow: true, lmax: 0.3 }); if (!p.dead && Math.hypot(p.x - ox, p.y - 7 - oy) < 6 + p.r && (e.orbHitT || 0) <= G.t) { e.orbHitT = G.t + 0.6; if (hurtPlayer(e.dmg * 0.6, { ent: e }) === HIT.HIT && !p.stats.fireproof) p.burnT = Math.max(p.burnT, 1.5); } }
    if (e.st === 'swell') {
      e.stT -= dt; e.scale = 1 + (1 - e.stT) * 0.6; e.pose = 2;
      if (e.stT <= 0) { explode(e.x, e.y, 46, 0, { team: 'e', pdmg: e.dmg * 1.5, color: '#ff9a3c', shake: 5 }); G.fx.push({ kind: 'firefield', x: e.x, y: e.y, r: 26, t: 0, life: 3, team: 'e', burn: true, tick: 0.2 }); killEnemy(e, {}); }
      return;
    }
    if (e.hp < e.maxHp * 0.3 && !e.swelled) { e.swelled = true; e.st = 'swell'; e.stT = 1; telegraph({ x: e.x, y: e.y, r: 46, life: 1, color: '#ff7a2a' }); Sound.play('fire', { p: 0.5 }); return; }
    e.atkCd -= dt;
    if (e.atkCd <= 0 && distP(e) < 150 && lineOfSight(G.fl, e.x, e.y - 10, p.x, p.y - 8)) { e.atkCd = rate(e); const a = angP(e); for (const o of [-0.25, 0, 0.25]) eShot(e, 'fireball', a + o, { y: e.y - 12 }); Sound.play('fire', { p: 1.2, v: 0.5 }); e.pose = 2; e.poseT = 0.3; }
    if (e.poseT > 0) { e.poseT -= dt; } else e.pose = 0;
    const d = distP(e), a = Math.atan2(p.y - e.y, p.x - e.x) + (d < 80 ? Math.PI * 0.7 : Math.sin(e.anim) * 0.6);
    walk(e, Math.cos(a), Math.sin(a), e.spd, dt); faceTo(e, p.x);
  },
  hellhound(e, dt, p) {
    if (e.st === 'breathe') {
      e.stT -= dt; e.pose = 2; e.ba += clamp(angDiff(e.ba, angP(e)), -dt * 2, dt * 2); e.face = Math.cos(e.ba) > 0 ? 1 : -1;
      e.tick = (e.tick || 0) - dt;
      if (e.tick <= 0) { e.tick = 0.07; const pr = eShot(e, 'flame', e.ba + rnd(-0.2, 0.2), { dmg: e.dmg * 0.7, life: 0.36, x: e.x + e.face * 9, y: e.y - 6 }); pr.flame = true; }
      if (e.stT <= 0) { e.st = 'run'; e.brCd = rnd(2.5, 3.5); }
      return;
    }
    e.brCd = (e.brCd ?? 1.5) - dt;
    if (e.brCd <= 0 && distP(e) < 56 && e.st !== 'leap' && e.st !== 'crouch' && lineOfSight(G.fl, e.x, e.y, p.x, p.y)) { e.st = 'breathe'; e.stT = 0.7; e.ba = angP(e); Sound.play('fire', { p: 0.8, v: 0.5 }); return; }
    AI.lunger(e, dt, p);
  },
  mimic(e, dt, p) {
    e.atkCd -= dt;
    if (e.atkCd <= 0 && distP(e) < 150 && e.st !== 'leap' && e.st !== 'crouch' && Math.random() < 0.4) { e.atkCd = rnd(2.5, 3.5); const a = angP(e); for (const o of [-0.3, 0, 0.3]) eShot(e, 'coin', a + o, { y: e.y - 6 }); Sound.play('coin', { p: 0.6 }); e.pose = 2; }
    AI.lunger(e, dt * 1.15, p);
  },
  eggsac(e, dt) {
    e.noContact = true; e.pose = (e.hatchT || 0) < 1.2 && Math.floor(G.t * 8) % 2 ? 1 : 0;
    e.hatchT = (e.hatchT ?? rnd(3.8, 5.2)) - dt;
    if (e.hatchT <= 0) {
      for (let k = 0; k < 3; k++) { const s = spawnEnemy('spiderling', e.x + rnd(-6, 6), e.y + rnd(-6, 6), { room: e.room, noSpawnAnim: true }); if (s) { s.xp = 1; s.gold = 0; } }
      burst(e.x, e.y - 6, 12, ['#e8e8f0', '#8fe05c'], { smax: 70 }); Sound.play('splat', { p: 1.4 });
      e.summoned = true; killEnemy(e, {});
    }
  },
});
ENEMIES.shroombrute.ai = 'brute';

/* ============================================================
   Bosses: pools per region; the Ember Dragon waits in the loops
   ============================================================ */
function bossFor(fl) {
  if (CD.forceBoss && BOSSES[CD.forceBoss]) return CD.forceBoss;
  if (fl.nemesisBoss && BOSSES[fl.nemesisBoss.kind]) return fl.nemesisBoss.kind;
  const info = fl.info, act = info.act.id;
  if (act === 'core') return info.loop >= 1 ? 'dragon' : 'king';
  const pool = BOSS_POOL[act] || [ACTS[fl.actIdx].boss];
  return pool[hash2(G.run ? G.run.seed : 1, fl.idx * 13 + 7) % pool.length];
}
const minion = (kind, r, e) => { const q = randomFloorPoint(r, G.p.x, G.p.y, 60); const s = spawnEnemy(kind, q.x, q.y, { room: e.room }); if (s) { s.xp = 1; s.gold = 0; } return s; };
Object.assign(BOSS_AI, {
  /* ---- The Lich Queen: floats, blinks, raises the dead ---- */
  lich: {
    init(e, r) { e.r = 10; e.h = 52; e.y = (r.iy + r.ih * 0.4) * TS; e.order = 0; e.fly = true; e.orbN = 0; e.orbT = 0; e.contactDmg = e.dmg * 0.6; e.spd = 42; e.tpT = 5; e.fadeA = 1; e.spin = 0; e.spT = 0; },
    think(e, dt) {
      const p = G.p, r = G.fl.rooms[e.room];
      faceTo(e, p.x);
      if (e.st === 'fade') { e.stT -= dt; e.fadeA = Math.max(0, e.stT / 0.4); e.invuln = true; e.noContact = true; if (e.stT <= 0) { const q = randomFloorPoint(r, p.x, p.y, 80); e.x = q.x; e.y = q.y; e.st = 'appear'; e.stT = 0.4; burst(e.x, e.y - 20, 16, ['#9ff6ff', '#1c2630', '#ffffff'], { smax: 70, grav: -30, floor: false, glow: true }); } return; }
      if (e.st === 'appear') { e.stT -= dt; e.fadeA = 1 - Math.max(0, e.stT / 0.4); if (e.stT <= 0) { e.st = 'idle'; e.invuln = false; e.noContact = false; e.fadeA = 1; } return; }
      if (e.spinT > 0) {
        e.spinT -= dt; e.pose = 2; e.spin += dt * (e.phase >= 3 ? 2.6 : 2); e.spT -= dt;
        if (e.spT <= 0) { e.spT = e.phase >= 2 ? 0.11 : 0.15; const arms = e.phase >= 3 ? 4 : 3; for (let k = 0; k < arms; k++) eShot(e, 'soul', e.spin + (k * TAU) / arms, { y: e.y - 26, life: 4 }); }
        return;
      }
      if (e.orbN > 0 && e.orbLaunch) { e.orbT -= dt; if (e.orbT <= 0) { e.orbT = 0.4; e.orbN--; eShot(e, 'soulbig', angP(e, 0.2), { y: e.y - 26, speedMul: 1.15 }); Sound.play('magic', { p: 0.5, v: 0.5 }); if (!e.orbN) e.orbLaunch = false; } }
      const d = distP(e);
      const a = d < 90 ? Math.atan2(e.y - p.y, e.x - p.x) : d > 150 ? Math.atan2(p.y - e.y, p.x - e.x) : Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2;
      const nx = e.x + Math.cos(a) * e.spd * dt, ny = e.y + Math.sin(a) * e.spd * dt;
      if (insideInterior(r, nx, ny, 1.5)) { e.x = nx; e.y = ny; }
      e.pose = 0;
      e.tpT -= dt;
      if (e.tpT <= 0) { e.tpT = e.phase >= 2 ? 4 : 6; e.st = 'fade'; e.stT = 0.4; Sound.play('magic', { p: 0.4 }); return; }
      e.atkT -= dt;
      if (e.atkT > 0) return;
      const moves = e.phase >= 3 ? ['spiral', 'prison', 'raise', 'orbs', 'nova', 'prison'] : e.phase >= 2 ? ['spiral', 'orbs', 'raise', 'nova'] : ['spiral', 'raise', 'orbs', 'nova'];
      const m = moves[e.order++ % moves.length];
      if (m === 'spiral') { e.spinT = 2.6; e.atkT = 3.6; Sound.play('void', { v: 0.5 }); }
      else if (m === 'raise') {
        e.pose = 2; Sound.play('bones'); Sound.play('roar', { p: 1.8, v: 0.4 });
        for (let k = 0; k < (e.phase >= 2 ? 4 : 3); k++) { const q = randomFloorPoint(r, p.x, p.y, 50); G.fx.push({ kind: 'summon', x: q.x, y: q.y, t: 0, life: 0.9, r: 10, color: '#9ff6ff' }); later(0.6, () => { if (G.boss !== e) return; const s = spawnEnemy(rndPick(['skeleton', 'skeleton', 'archer', 'crawler']), q.x, q.y, { room: e.room }); if (s) { s.xp = 1; s.gold = 0; } }); }
        e.atkT = 2.4;
      } else if (m === 'orbs') { e.orbN = e.phase >= 2 ? 6 : 4; e.orbLaunch = false; later(1.2, () => { if (G.boss === e) { e.orbLaunch = true; e.orbT = 0; } }); e.atkT = 3.6; Sound.play('magic', { p: 0.6 }); }
      else if (m === 'nova') { e.pose = 2; const off = rnd(TAU); for (let k = 0; k < 18; k++) eShot(e, 'soul', off + (k * TAU) / 18, { y: e.y - 26, speedMul: 1.1 }); ring(e.x, e.y - 26, 30, '#9ff6ff', 0.4, 2); Sound.play('scream', { p: 0.8, v: 0.5 }); e.atkT = 1.8; }
      else if (m === 'prison') {
        const gap = rnd(TAU), cxp = p.x, cyp = p.y;
        for (let k = 0; k < 14; k++) { const ang = (k * TAU) / 14; if (Math.abs(angDiff(ang, gap)) < 0.5) continue; const x = cxp + Math.cos(ang) * 42, y = cyp + Math.sin(ang) * 26; if (!insideInterior(r, x, y, 0.5)) continue; telegraph({ x, y, r: 11, life: 0.9, color: '#9ff6ff', fire: () => { G.fx.push({ kind: 'icicle', x, y, t: 0, life: 0.8 }); if (Math.hypot(G.p.x - x, G.p.y - y) < 11 + G.p.r) hurtPlayer(e.dmg, { ent: e }); } }); }
        later(1.1, () => { if (G.boss !== e) return; for (let k = 0; k < 10; k++) { const x = cxp + rnd(-20, 20), y = cyp + rnd(-14, 14); telegraph({ x, y, r: 10, life: 0.7, color: '#9ff6ff', fire: () => { burst(x, y, 5, ['#e8e0cc', '#9ff6ff'], { smax: 50 }); if (Math.hypot(G.p.x - x, G.p.y - y) < 10 + G.p.r) hurtPlayer(e.dmg, { ent: e }); } }); } });
        Sound.play('telegraph', { p: 0.6 }); e.atkT = 2.6;
      }
      if (e.phase >= 3) e.atkT *= 0.8;
    },
    phase(e) { e.atkT = 0.4; e.tpT = 0.3; },
  },

  /* ---- The Broodmother: charges, webs, eggs that hatch ---- */
  brood: {
    init(e, r) { e.r = 17; e.h = 30; e.y = (r.iy + r.ih * 0.45) * TS; e.order = 0; e.spd = 46; e.contactDmg = e.dmg; },
    think(e, dt) {
      const p = G.p, r = G.fl.rooms[e.room], fury = e.phase >= 3 ? 1.35 : e.phase >= 2 ? 1.15 : 1;
      if (e.st === 'aim') { e.stT -= dt; e.pose = 2; if (e.stT <= 0) { e.st = 'charge'; e.stT = 1.1; e.contactDmg = e.dmg * 1.5; Sound.play('growl', { p: 0.8 }); } return; }
      if (e.st === 'charge') {
        e.stT -= dt;
        const bumped = moveEnt(e, Math.cos(e.ca) * 290 * fury * dt, Math.sin(e.ca) * 290 * fury * dt);
        e.face = Math.cos(e.ca) > 0 ? 1 : -1;
        if (Math.random() < 0.6) burst(e.x, e.y, 1, ['#5a4030'], { smax: 30, lmax: 0.3 });
        if (bumped || e.stT <= 0) { e.st = 'idle'; e.contactDmg = e.dmg; e.atkT = Math.max(e.atkT, 0.8); if (bumped) { shake(5); Sound.play('slam', { v: 0.5 }); e.stunT = 0.7 / fury; for (let k = 0; k < 6; k++) eShot(e, 'web', rnd(TAU), { y: e.y - 10 }); } }
        return;
      }
      faceTo(e, p.x);
      const d = distP(e);
      if (d > 70) { const dir = steerTo(e, p.x, p.y); walk(e, dir.x, dir.y, e.spd * fury, dt); }
      e.pose = 0;
      e.atkT -= dt;
      if (e.atkT > 0) return;
      const moves = e.phase >= 3 ? ['charge', 'eggs', 'webs', 'charge', 'venom', 'brood'] : e.phase >= 2 ? ['charge', 'webs', 'eggs', 'venom', 'brood'] : ['charge', 'webs', 'eggs', 'venom'];
      const m = moves[e.order++ % moves.length];
      if (m === 'charge') { e.st = 'aim'; e.stT = 0.55 / fury; e.ca = angP(e); telegraph({ x: e.x, y: e.y - 6, ang: e.ca, len: 200, life: 0.55 / fury, line: true, width: 28, color: '#ff6a4a' }); e.atkT = 2.4 / fury; }
      else if (m === 'webs') { const a = angP(e), n = e.phase >= 2 ? 9 : 7; for (let k = 0; k < n; k++) eShot(e, 'web', a + (k - (n - 1) / 2) * 0.16, { y: e.y - 12, x: e.x + e.face * 20 }); Sound.play('web'); e.pose = 2; e.atkT = 1.8 / fury; }
      else if (m === 'eggs') {
        for (let k = 0; k < (e.phase >= 3 ? 4 : 3); k++) { const q = randomFloorPoint(r, p.x, p.y, 40); telegraph({ x: q.x, y: q.y, r: 10, life: 1, color: '#e8e8f0' }); lob(e, 'glob', q.x, q.y, () => { const s = spawnEnemy('eggsac', q.x, q.y, { room: e.room, noSpawnAnim: true }); if (s) { s.xp = 1; s.gold = 0; } Sound.play('splat'); }, { dur: 1, arc: 70, color: '#e8e8f0' }); }
        e.atkT = 2.2 / fury;
      } else if (m === 'venom') {
        for (let k = 0; k < 5; k++) { const q = k < 2 ? { x: p.x + rnd(-10, 10), y: p.y + rnd(-10, 10) } : randomFloorPoint(r, null, null, 0); telegraph({ x: q.x, y: q.y, r: 22, life: 1, color: '#8fe05c' }); lob(e, 'glob', q.x, q.y, () => { G.fx.push({ kind: 'pool', x: q.x, y: q.y, r: 22, t: 0, life: 4, team: 'e', poison: true, tick: 0.3, color: '#8fe05c' }); if (Math.hypot(G.p.x - q.x, G.p.y - q.y) < 22) hurtPlayer(e.dmg * 0.6, { ent: e }); }, { dur: 1, arc: 70, color: '#8fe05c' }); }
        e.atkT = 2 / fury;
      } else if (m === 'brood') { for (let k = 0; k < 4; k++) minion('spiderling', r, e); minion('spider', r, e); Sound.play('spawn'); e.atkT = 1.6; }
    },
    phase(e) { e.atkT = 0.3; },
  },

  /* ---- Hrimgar the Frost Giant: a club the size of a door ---- */
  giant: {
    init(e, r) { e.r = 14; e.h = 56; e.y = (r.iy + r.ih * 0.42) * TS; e.order = 0; e.spd = 30; e.contactDmg = e.dmg * 0.8; e.clubA = null; },
    think(e, dt) {
      const p = G.p, r = G.fl.rooms[e.room], fury = e.phase >= 3 ? 1.3 : e.phase >= 2 ? 1.12 : 1, fl = e.face < 0;
      const restA = fl ? Math.PI + 0.7 : -0.7, upA = fl ? Math.PI + 2.3 : -2.3, downA = fl ? Math.PI - 0.9 : 0.9;
      if (e.st === 'raise') { e.stT -= dt; e.clubA = lerp(e.clubA ?? restA, upA, 0.2); if (e.stT <= 0) { e.st = 'slam'; e.stT = 0.12; } return; }
      if (e.st === 'slam') {
        e.stT -= dt; e.clubA = lerp(e.clubA, downA, 0.5);
        if (e.stT <= 0) {
          e.st = 'recover'; e.stT = 0.6 / fury;
          const tx = e.sx, ty = e.sy;
          explode(tx, ty, 34, 0, { team: 'e', pdmg: e.dmg * 1.3, color: '#cfefff', parts: ['#ffffff', '#9fe0ff', '#7aa8c8'], sound: 'slam', shake: 8 });
          G.fx.push({ kind: 'crack', x: tx, y: ty, r: 40, t: 0, life: 0.9 });
          for (let k = 0; k < (e.phase >= 2 ? 12 : 8); k++) eShot(e, 'shard', (k * TAU) / (e.phase >= 2 ? 12 : 8), { x: tx, y: ty - 4, dmg: e.dmg * 0.7 });
          hitstop(0.05);
        }
        return;
      }
      if (e.st === 'sweepwind') { e.stT -= dt; e.clubA = lerp(e.clubA ?? restA, (fl ? Math.PI : 0) + (fl ? 1 : -1) * 1.6, 0.15); if (e.stT <= 0) { e.st = 'sweep'; e.stT = 0.3; e.swept = false; } return; }
      if (e.st === 'sweep') {
        e.stT -= dt; const k = clamp(1 - e.stT / 0.3, 0, 1); e.clubA = (fl ? Math.PI : 0) + (fl ? -1 : 1) * lerp(-1.4, 1.4, k);
        if (!e.swept && k > 0.4) { e.swept = true; const d = Math.hypot(p.x - e.x, p.y - 8 - (e.y - 26)); if (d < 64 && Math.abs(angDiff(e.sa, Math.atan2(p.y - 8 - (e.y - 26), p.x - e.x))) < 1.2) hurtPlayer(e.dmg * 1.2, { ent: e, kx: Math.cos(e.sa) * 280, ky: Math.sin(e.sa) * 280 }); G.fx.push({ kind: 'slash', x: e.x, y: e.y - 26, ang: e.sa, arc: 2.4, reach: 62, t: 0, life: 0.25, dir: fl ? -1 : 1, style: 'slash', heavy: true, color: '#cfefff', enemy: true }); Sound.play('heavy', { p: 0.6 }); }
        if (e.stT <= 0) { e.st = 'recover'; e.stT = 0.5 / fury; }
        return;
      }
      if (e.st === 'recover') { e.stT -= dt; e.clubA = lerp(e.clubA ?? restA, restA, 0.1); if (e.stT <= 0) e.st = 'walk'; return; }
      e.clubA = lerp(e.clubA ?? restA, restA, 0.1);
      faceTo(e, p.x);
      const d = distP(e);
      if (d > 50) { const dir = steerTo(e, p.x, p.y); walk(e, dir.x, dir.y, e.spd * fury, dt); }
      if (Math.hypot(e.vx || 0, e.vy || 0) > 5 && Math.floor(G.t * 4) !== e.stepF) { e.stepF = Math.floor(G.t * 4); if (e.stepF % 2) { shake(1.5); Sound.play('slam', { p: 1.6, v: 0.25 }); } }
      e.atkT -= dt;
      if (e.atkT > 0) return;
      const moves = e.phase >= 3 ? ['smash', 'sweep', 'throw', 'stomp', 'smash', 'roar'] : e.phase >= 2 ? ['smash', 'throw', 'sweep', 'stomp', 'roar'] : ['smash', 'sweep', 'throw', 'stomp'];
      const m = moves[e.order++ % moves.length];
      if (m === 'smash') {
        const a = angP(e), reach = Math.min(70, d); e.sx = e.x + Math.cos(a) * reach; e.sy = e.y + Math.sin(a) * reach * 0.8;
        e.st = 'raise'; e.stT = 0.75 / fury; telegraph({ x: e.sx, y: e.sy, r: 34, life: 0.85 / fury, color: '#9fe0ff' }); Sound.play('growl', { p: 0.5 }); e.atkT = 2.2 / fury;
      } else if (m === 'sweep') {
        e.sa = angP(e); e.st = 'sweepwind'; e.stT = 0.55 / fury;
        telegraph({ x: e.x, y: e.y - 26, ang: e.sa, arc: 2.4, r: 64, life: 0.55 / fury, color: '#9fe0ff', cone: true });
        e.atkT = 2 / fury;
      } else if (m === 'throw') {
        const tx = p.x + p.vx * 0.5, ty = p.y + p.vy * 0.5;
        telegraph({ x: tx, y: ty, r: 28, life: 1, color: '#9fe0ff' });
        lob(e, 'rock', tx, ty, (pr) => { explode(pr.x, pr.y, 28, 0, { team: 'e', pdmg: e.dmg, color: '#cfefff', parts: ['#ffffff', '#9fe0ff'], sound: 'ice', shake: 4 }); for (let k = 0; k < 6; k++) eShot(e, 'shard', (k * TAU) / 6, { x: pr.x, y: pr.y - 4, dmg: e.dmg * 0.6 }); }, { dur: 1, arc: 80, color: '#9fe0ff' });
        e.clubA = upA; Sound.play('heavy', { p: 0.5 }); e.atkT = 1.8 / fury;
      } else if (m === 'stomp') {
        shake(6); Sound.play('slam', { p: 0.6 });
        for (let w = 0; w < 3; w++) { const R2 = 40 + w * 30, n = 8 + w * 4; for (let k = 0; k < n; k++) { const ang = (k * TAU) / n + w * 0.3, x = e.x + Math.cos(ang) * R2, y = e.y + Math.sin(ang) * R2 * 0.6; if (!insideInterior(r, x, y, 0.5)) continue; later(w * 0.35, () => telegraph({ x, y, r: 10, life: 0.65, color: '#cfefff', fire: () => { G.fx.push({ kind: 'icicle', x, y, t: 0, life: 0.8 }); if (Math.hypot(G.p.x - x, G.p.y - y) < 10 + G.p.r && hurtPlayer(e.dmg, { ent: e }) === HIT.HIT) G.p.chillT = 1.5; } })); } }
        e.atkT = 2.6 / fury;
      } else if (m === 'roar') { Sound.play('roar', { p: 0.8 }); shake(6); for (let k = 0; k < 2; k++) minion('wolf', r, e); e.atkT = 1.4; }
    },
    phase(e, ph) { e.atkT = 0.3; if (ph === 3) e.spd = 40; },
  },

  /* ---- The Ember Dragon: fire from above ---- */
  dragon: {
    init(e, r) { e.r = 16; e.h = 56; e.y = (r.iy + r.ih * 0.5) * TS; e.order = 0; e.spd = 72; e.fly = true; e.contactDmg = e.dmg * 0.8; e.mouth = 0; e.target = { x: e.x, y: e.y }; },
    think(e, dt) {
      const p = G.p, r = G.fl.rooms[e.room], fury = e.phase >= 3 ? 1.35 : e.phase >= 2 ? 1.15 : 1;
      if (e.mouth > 0) e.mouth -= dt;
      const mouth = () => ({ x: e.x + e.face * 48, y: e.y - 52 });
      if (e.st === 'breath') {
        e.stT -= dt; e.mouth = 0.2;
        e.ba = e.ba + clamp(angDiff(e.ba, Math.atan2(p.y - 7 - mouth().y, p.x - mouth().x)), -dt * 1.1, dt * 1.1);
        e.tick = (e.tick || 0) - dt;
        if (e.tick <= 0) { e.tick = 0.045; const m = mouth(); const pr = eShot(e, 'flame', e.ba + rnd(-0.18, 0.18), { x: m.x, y: m.y, dmg: e.dmg * 0.6, life: 0.9, speedMul: rnd(1.1, 1.4) }); pr.flame = true; if (Math.random() < 0.15) G.fx.push({ kind: 'firefield', x: p.x + rnd(-20, 20), y: p.y + rnd(-14, 14), r: 12, t: 0, life: 1.6, team: 'e', burn: true, small: true, tick: 0.2 }); }
        if (e.stT <= 0) e.st = 'fly';
        return;
      }
      if (e.st === 'swoop') {
        e.stT -= dt;
        const nx = e.x + Math.cos(e.sa) * 330 * fury * dt, ny = e.y + Math.sin(e.sa) * 330 * fury * dt;
        if (insideInterior(r, nx, ny, 1)) { e.x = nx; e.y = ny; } else e.stT = 0;
        e.face = Math.cos(e.sa) > 0 ? 1 : -1; e.contactDmg = e.dmg * 1.3;
        if (Math.random() < 0.7) G.fx.push({ kind: 'firefield', x: e.x, y: e.y, r: 12, t: 0, life: 2.4, team: 'e', burn: true, small: true, tick: 0.2 });
        if (e.stT <= 0) { e.st = 'fly'; e.contactDmg = e.dmg * 0.8; }
        return;
      }
      if (e.st === 'aim') { e.stT -= dt; if (e.stT <= 0) { e.st = 'swoop'; e.stT = 0.9; Sound.play('roar', { p: 1.2, v: 0.6 }); } return; }
      // glide toward a perch above the player
      e.retT = (e.retT || 0) - dt;
      if (e.retT <= 0 || Math.hypot(e.target.x - e.x, e.target.y - e.y) < 16) { e.retT = rnd(1.5, 2.5); const side = rndPick([-1, 1]); e.target = { x: clamp(p.x + side * rnd(60, 110), (r.ix + 2) * TS, (r.ix + r.iw - 2) * TS), y: clamp(p.y - rnd(10, 40), (r.iy + 1.5) * TS, (r.iy + r.ih - 1.5) * TS) }; }
      const a = Math.atan2(e.target.y - e.y, e.target.x - e.x);
      e.x += Math.cos(a) * e.spd * fury * dt; e.y += Math.sin(a) * e.spd * fury * dt;
      faceTo(e, p.x);
      e.atkT -= dt;
      if (e.atkT > 0) return;
      const moves = e.phase >= 3 ? ['breath', 'swoop', 'meteors', 'fireballs', 'breath', 'roar'] : e.phase >= 2 ? ['breath', 'fireballs', 'swoop', 'meteors', 'roar'] : ['breath', 'fireballs', 'swoop', 'meteors'];
      const m = moves[e.order++ % moves.length];
      if (m === 'breath') { e.st = 'breath'; e.stT = 1.8; const mo = mouth(); e.ba = Math.atan2(p.y - 7 - mo.y, p.x - mo.x); telegraph({ x: mo.x, y: mo.y, ang: e.ba, len: 130, life: 0.4, line: true, width: 20, color: '#ff7a2a' }); Sound.play('fire', { p: 0.4 }); Sound.play('roar', { p: 1.4, v: 0.4 }); e.atkT = 3.2 / fury; }
      else if (m === 'fireballs') {
        e.mouth = 0.6;
        for (let k = 0; k < (e.phase >= 2 ? 5 : 3); k++) later(k * 0.22, () => { if (G.boss !== e) return; const mo = mouth(); const pr = eShot(e, 'dfire', Math.atan2(G.p.y - 7 - mo.y, G.p.x - mo.x) + rnd(-0.15, 0.15), { x: mo.x, y: mo.y, life: 3 }); pr.onEnd = (q) => { explode(q.x, q.y, 24, 0, { team: 'e', pdmg: e.dmg, color: '#ff9a3c', vol: 0.4, shake: 2 }); G.fx.push({ kind: 'firefield', x: q.x, y: q.y, r: 18, t: 0, life: 2.4, team: 'e', burn: true, tick: 0.2 }); }; Sound.play('fire', { p: 0.7 }); });
        e.atkT = 2.2 / fury;
      } else if (m === 'swoop') { e.sa = angP(e); e.st = 'aim'; e.stT = 0.6; telegraph({ x: e.x, y: e.y, ang: e.sa, len: 260, life: 0.6, line: true, width: 30, color: '#ff5a2a' }); e.atkT = 2.2 / fury; }
      else if (m === 'meteors') {
        Sound.play('roar', { p: 0.9, v: 0.6 });
        const n = e.phase >= 3 ? 14 : 10;
        for (let k = 0; k < n; k++) { const q = k < 3 ? { x: p.x + rnd(-10, 10), y: p.y + rnd(-10, 10) } : randomFloorPoint(r, null, null, 0); later(k * 0.1, () => { telegraph({ x: q.x, y: q.y, r: 24, life: 1, color: '#ff5a2a', fire: () => { explode(q.x, q.y, 24, 0, { team: 'e', pdmg: e.dmg, color: '#ff9a3c', vol: 0.5, shake: 3 }); G.fx.push({ kind: 'firefield', x: q.x, y: q.y, r: 16, t: 0, life: 2, team: 'e', burn: true, tick: 0.2 }); } }); G.fx.push({ kind: 'meteor', x: q.x, y: q.y, t: 0, life: 1 }); }); }
        e.atkT = 3 / fury;
      } else if (m === 'roar') { Sound.play('roar'); shake(7); for (let k = 0; k < 2; k++) minion(rndPick(['imp', 'hellhound']), r, e); e.atkT = 1.4; }
    },
    phase(e, ph) { e.atkT = 0.3; if (ph === 3) { e.spd = 90; banner(e.def.name, 'the deep remembers fire', 1.6); } },
  },
});

