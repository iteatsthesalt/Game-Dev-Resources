/* ============================================================
   Cinderdeep — monster brains and the four bosses
   ============================================================ */
const SHOT = {
  arrow: { speed: 165, r: 3, kind: 'earrow', color: '#e8e0cc' },
  orb: { speed: 92, r: 4, kind: 'eorb', color: '#e85ad0', light: '#ff5ad0' },
  icebolt: { speed: 185, r: 3, kind: 'eice', color: '#bfe9ff', chill: true, light: '#9fe0ff' },
  web: { speed: 125, r: 4, kind: 'web', color: '#e8e8f0', slow: 1.6 },
  fireball: { speed: 150, r: 4, kind: 'efire', color: '#ff9a3c', light: '#ff7a2a', burnHit: true },
  thorn: { speed: 125, r: 3, kind: 'thorn', color: '#a8e070' },
  shard: { speed: 95, r: 3, kind: 'eshard', color: '#cfefff', light: '#9fe0ff' },
  bone: { speed: 130, r: 3, kind: 'bone', color: '#e8e0cc' },
  spore: { speed: 80, r: 4, kind: 'spore', color: '#c8ff6a', poison: true, light: '#a8ff6a' },
  ember: { speed: 120, r: 3, kind: 'ember', color: '#ffb35e', light: '#ff7a2a' },
  flame: { speed: 150, r: 4, kind: 'flame', color: '#ff9a3c', light: '#ff7a2a' },
  big: { speed: 70, r: 7, kind: 'bigorb', color: '#ff5ad0', light: '#ff5ad0', big: true },
};
function eShot(e, type, ang, o = {}) {
  const S = SHOT[type], heat = G.run.heat;
  const pr = spawnProj({
    team: 'e', x: o.x ?? e.x, y: o.y ?? e.y - (e.h || 10) * 0.5, ang, speed: S.speed * (o.speedMul || 1) * (heat >= 8 ? 1.15 : 1),
    dmg: o.dmg ?? e.dmg, life: o.life ?? 3.2, r: S.r, kind: S.kind, color: S.color, light: S.light, slow: S.slow, chill: S.chill, poison: S.poison,
  });
  if (S.big) pr.big = true;
  return pr;
}
const lob = (e, kind, tx, ty, onLand, o = {}) => spawnProj({ team: 'e', x: e.x, y: e.y - 10, ang: 0, speed: 0, dmg: e.dmg, lob: true, tx, ty, dur: o.dur ?? 0.85, arc: o.arc ?? 46, kind, onEnd: onLand, color: o.color });

function updateEnemies(dt) {
  const p = G.p, rid = G.room ? G.room.id : -1;
  for (const e of G.ents) {
    if (e.dead) continue;
    if (e.type === 'ally') { if (e.room !== rid) continue; }
    else if (e.room !== rid) continue;
    const warp = e.type === 'enemy' && G.warp > 0 ? 0.4 : 1;
    const edt = dt * warp;
    e.anim += edt;
    if (e.flash > 0) e.flash -= dt;
    if (e.spawnT > 0) { e.spawnT -= dt; continue; }
    // statuses
    if (e.burn) { e.burn.t -= edt; e.burn.tick -= edt; if (e.burn.tick <= 0) { e.burn.tick = 0.5; damageEnemy(e, e.burn.dps * 0.5, { dot: true, color: '#ffb35e' }); if (Math.random() < 0.6) burst(e.x, e.y - e.h / 2, 2, ['#ff9a3c', '#ffd08a'], { grav: -60, floor: false, smax: 20, glow: true }); } if (e.burn && e.burn.t <= 0) e.burn = null; }
    if (e.dead) continue;
    if (e.poison) { e.poison.t -= edt; e.poison.tick -= edt; if (e.poison.tick <= 0) { e.poison.tick = 0.5; damageEnemy(e, e.poison.per * e.poison.stacks * 0.5, { dot: true, color: '#a8e070' }); } if (e.poison && e.poison.t <= 0) e.poison = null; }
    if (e.dead) continue;
    if (e.chillT > 0) e.chillT -= edt; else e.chillN = 0;
    if (e.freezeT > 0) e.freezeT -= edt;
    if (e.stunT > 0) e.stunT -= edt;
    if (e.contactCd > 0) e.contactCd -= edt;
    if (e.type === 'ally' && e.life != null) { e.life -= dt; if (e.life <= 0 || e.hp <= 0) { e.dead = true; burst(e.x, e.y - 6, 8, ['#c8f5a8', '#ffffff'], { smax: 40 }); continue; } }
    // knockback
    if (Math.abs(e.kx) + Math.abs(e.ky) > 1) {
      const bumped = moveEnt(e, e.kx * dt, e.ky * dt);
      const k = Math.exp(-9 * dt); e.kx *= k; e.ky *= k;
      if (bumped && Math.hypot(e.kx, e.ky) > 140 && !e.boss) { damageEnemy(e, 4 + G.fl.idx, { dot: true, color: '#ffffff' }); e.kx = e.ky = 0; }
    }
    if (e.dead) continue;
    const frozen = e.freezeT > 0 || e.stunT > 0;
    e.slowMul = (e.chillT > 0 ? 0.6 : 1) * warp;
    if (!frozen) {
      G.actor = e.type === 'enemy' ? e : null;
      if (e.boss) e.think(e, edt);
      else if (e.fearT > 0 && e.type === 'enemy') { e.fearT -= edt; e.pose = 0; e.st = 'idle'; e.contactDmg = null; if (!e.rooted) { const a = Math.atan2(e.y - p.y, e.x - p.x) + Math.sin(e.anim * 5) * 0.5; walk(e, Math.cos(a), Math.sin(a), Math.max(36, e.spd || 40) * 1.1, edt); } }
      else (AI[e.def.ai] || AI.melee)(e, edt, p);
      G.actor = null;
    }
    // magma trail
    if (e.def.trail && !frozen) { e.trailT = (e.trailT || 0) - dt; if (e.trailT <= 0) { e.trailT = 0.6; G.fx.push({ kind: 'firefield', x: e.x, y: e.y, r: 9, t: 0, life: 1.8, team: 'e', burn: true, small: true, tick: 0.2 }); } }
    // contact damage
    if (e.type === 'enemy' && !p.dead && e.contactCd <= 0 && !e.noContact && !(e.fadeT > 0)) {
      const reach = (e.boss ? e.r : e.r * (e.scale || 1)) + p.r;
      if (Math.hypot(e.x - p.x, e.y - p.y) < reach) {
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        const res = hurtPlayer(e.contactDmg ?? e.dmg, { ent: e, kx: Math.cos(a) * 140, ky: Math.sin(a) * 140 });
        e.contactCd = 0.7;
        if (res === HIT.HIT && e.eliteMods && e.eliteMods.includes('vampiric')) { e.hp = Math.min(e.maxHp, e.hp + e.dmg * 2); addText(e.x, e.y - e.h, '+' + Math.round(e.dmg * 2), '#ff6a6a'); }
      }
    }
  }
  // gentle separation so packs do not stack
  const list = G.ents;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.dead || a.rooted || a.boss || a.spawnT > 0 || a.room !== rid) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.dead || b.boss || b.spawnT > 0 || b.room !== rid) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = (a.r + b.r) * 0.85;
      if (d < min && d > 0.01) {
        const push = (min - d) * 0.5, nx = dx / d, ny = dy / d;
        if (!b.rooted) moveEnt(b, nx * push, ny * push);
        moveEnt(a, -nx * push, -ny * push);
      }
    }
  }
  G.ents = G.ents.filter((e) => !e.dead);
}

function walk(e, dx, dy, spd, dt) {
  const s = spd * (e.slowMul ?? 1);
  e.vx = dx * s; e.vy = dy * s;
  moveEnt(e, e.vx * dt, e.vy * dt);
  if (Math.abs(dx) > 0.1) e.face = dx > 0 ? 1 : -1;
}
function faceTo(e, x) { e.face = x >= e.x ? 1 : -1; }
const distP = (e) => Math.hypot(G.p.x - e.x, G.p.y - e.y);
const angP = (e, lead = 0) => {
  const p = G.p;
  return Math.atan2(p.y - 7 + p.vy * lead - (e.y - e.h * 0.5), p.x + p.vx * lead - e.x);
};
const rate = (e) => (e.def.rate || 2) * (e.rateMul || 1) * rnd(0.85, 1.15);

const AI = {
  melee(e, dt, p) {
    const d = distP(e);
    if (e.st === 'windup') {
      e.stT -= dt; faceTo(e, p.x); e.pose = 2;
      if (e.stT <= 0) { e.st = 'lunge'; e.stT = 0.16; e.la = angP(e); Sound.play('swing', { p: 0.8, v: 0.5 }); e.contactDmg = e.dmg * 1.2; }
      return;
    }
    if (e.st === 'lunge') {
      e.stT -= dt; e.pose = 2;
      walk(e, Math.cos(e.la), Math.sin(e.la), e.def.lunge || 150, dt);
      if (e.stT <= 0) { e.st = 'recover'; e.stT = 0.45; e.contactDmg = null; }
      return;
    }
    e.pose = 0;
    if (e.st === 'recover') { e.stT -= dt; if (e.stT <= 0) e.st = 'chase'; return; }
    e.atkCd -= dt;
    if (d < (e.def.reach || 20) + 14 && e.atkCd <= 0 && lineOfSight(G.fl, e.x, e.y, p.x, p.y)) { e.st = 'windup'; e.stT = e.def.windup || 0.45; e.atkCd = 1.4 * (e.rateMul || 1); return; }
    const dir = steerTo(e, p.x, p.y);
    walk(e, dir.x, dir.y, e.spd, dt);
  },
  archer(e, dt, p) {
    const d = distP(e);
    e.atkCd -= dt;
    if (e.st === 'aim') {
      e.stT -= dt; e.pose = 2; faceTo(e, p.x);
      if (e.stT <= 0) { e.st = 'move'; eShot(e, e.def.shot, angP(e, 0.15)); Sound.play('arrow', { p: 0.8, v: 0.6 }); if (e.eliteMods) { eShot(e, e.def.shot, angP(e) - 0.2); eShot(e, e.def.shot, angP(e) + 0.2); } }
      return;
    }
    e.pose = 0;
    const los = lineOfSight(G.fl, e.x, e.y - 8, p.x, p.y - 8);
    if (e.atkCd <= 0 && los && d < e.def.range + 30) { e.st = 'aim'; e.stT = 0.45; e.atkCd = rate(e); telegraph({ x: e.x, y: e.y - 8, ang: angP(e), len: 60, life: 0.45, line: true, color: '#ff6a6a' }); return; }
    let dx, dy;
    if (d < 70) { const a = Math.atan2(e.y - p.y, e.x - p.x) + (e.strafe || 0.4); dx = Math.cos(a); dy = Math.sin(a); }
    else if (d > e.def.range * 0.85 || !los) { const s2 = steerTo(e, p.x, p.y); dx = s2.x; dy = s2.y; }
    else { e.strafeT = (e.strafeT || 0) - dt; if (e.strafeT <= 0) { e.strafeT = rnd(0.8, 1.6); e.strafe = rndPick([-1, 1]) * rnd(1.2, 1.8); } const a = Math.atan2(p.y - e.y, p.x - e.x) + e.strafe; dx = Math.cos(a) * 0.6; dy = Math.sin(a) * 0.6; }
    walk(e, dx, dy, e.spd, dt);
    faceTo(e, p.x);
  },
  flutter(e, dt, p) {
    e.wob = (e.wob || rnd(TAU)) + dt * 5;
    e.stT -= dt;
    if (e.stT <= 0) { e.stT = rnd(1.2, 2.2); e.dartT = 0.35; e.dartA = angP(e); }
    let a = Math.atan2(p.y - e.y, p.x - e.x) + Math.sin(e.wob) * 1.1, sp = e.spd;
    if (e.dartT > 0) { e.dartT -= dt; a = e.dartA; sp *= 1.9; }
    walk(e, Math.cos(a), Math.sin(a), sp, dt);
  },
  hop(e, dt, p) {
    if (e.st === 'air') {
      e.stT -= dt; e.z = Math.sin((1 - e.stT / e.hopT) * Math.PI) * 10;
      walk(e, Math.cos(e.ha), Math.sin(e.ha), e.spd * 1.3, dt);
      if (e.stT <= 0) { e.st = 'land'; e.stT = rnd(0.35, 0.8); e.z = 0; e.pose = 0; if (e.def.trail) G.fx.push({ kind: 'firefield', x: e.x, y: e.y, r: 12, t: 0, life: 2.2, team: 'e', burn: true, small: true, tick: 0.2 }); Sound.play('splat', { v: 0.25, p: e.small ? 1.5 : 1 }); }
      return;
    }
    e.stT -= dt; e.pose = 1;
    if (e.stT <= 0) { e.st = 'air'; e.hopT = e.stT = 0.4; e.ha = Math.atan2(p.y - e.y, p.x - e.x) + rnd(-0.3, 0.3); const dir = steerTo(e, p.x, p.y); e.ha = Math.atan2(dir.y, dir.x); }
  },
  ghost(e, dt, p) {
    e.stT -= dt;
    if (e.fadeT > 0) { e.fadeT -= dt; e.invuln = true; if (e.fadeT <= 0) e.invuln = false; }
    else if (e.stT <= 0) { e.stT = rnd(3, 5); e.fadeT = 1.1; }
    const a = Math.atan2(p.y - e.y, p.x - e.x), w = Math.sin(e.anim * 2) * 0.4;
    walk(e, Math.cos(a + w), Math.sin(a + w), e.spd * (e.fadeT > 0 ? 1.4 : 1), dt);
  },
  caster(e, dt, p) {
    const d = distP(e);
    e.atkCd -= dt;
    if (e.st === 'cast') {
      e.stT -= dt; e.pose = 2;
      if (e.stT <= 0) {
        e.st = 'move';
        const a = angP(e, 0.1);
        if (e.def.shot === 'orb3') { for (const o of [-0.3, 0, 0.3]) eShot(e, 'orb', a + o); Sound.play('magic', { p: 0.6, v: 0.6 }); }
        else { eShot(e, e.def.shot, a); if (e.eliteMods) { eShot(e, e.def.shot, a + 0.25); eShot(e, e.def.shot, a - 0.25); } Sound.play('shard', { p: 0.8 }); }
      }
      return;
    }
    e.pose = 0;
    if (e.def.summon) {
      e.sumT = (e.sumT ?? 6) - dt;
      if (e.sumT <= 0 && G.ents.filter((o) => !o.dead && o.type === 'enemy' && o.room === e.room).length < 8) {
        e.sumT = rnd(8, 11);
        const q = randomFloorPoint(G.fl.rooms[e.room], p.x, p.y, 50);
        const s = spawnEnemy(e.def.summon, q.x, q.y, { room: e.room }); if (s) { s.xp = 1; s.gold = 0; }
        Sound.play('spawn');
      }
    }
    const los = lineOfSight(G.fl, e.x, e.y - 8, p.x, p.y - 8);
    if (e.atkCd <= 0 && los && d < e.def.range + 20) { e.st = 'cast'; e.stT = 0.5; e.atkCd = rate(e); flashLight(e.x, e.y - 10, 26, e.def.shot === 'icebolt' ? '#9fe0ff' : '#ff5ad0', 0.5); return; }
    let a;
    if (d < 80) a = Math.atan2(e.y - p.y, e.x - p.x);
    else if (d > 130 || !los) { const s2 = steerTo(e, p.x, p.y); a = Math.atan2(s2.y, s2.x); }
    else a = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2 * (e.side || (e.side = rndPick([-1, 1])));
    walk(e, Math.cos(a), Math.sin(a), e.spd, dt);
    faceTo(e, p.x);
  },
  spore(e, dt, p) {
    e.atkCd -= dt;
    const d = distP(e);
    if (d < 44 && e.atkCd <= 0) {
      e.atkCd = 3.4; e.pose = 2; e.poseT = 0.4;
      G.fx.push({ kind: 'cloud', x: e.x, y: e.y - 4, r: 28, t: 0, life: 2.6, team: 'e', poison: true, color: '#c8ff6a', tick: 0.3 });
      burst(e.x, e.y - 6, 12, ['#d8ff9a', '#a8e070'], { smax: 60, grav: -20, floor: false });
      Sound.play('venom', { p: 1.3, v: 0.5 });
    }
    if (e.poseT > 0) { e.poseT -= dt; return; }
    e.pose = 0;
    const dir = steerTo(e, p.x, p.y);
    walk(e, dir.x, dir.y, e.spd, dt);
  },
  spider(e, dt, p) {
    e.atkCd -= dt; e.stT -= dt;
    if (e.dashT > 0) { e.dashT -= dt; walk(e, Math.cos(e.da), Math.sin(e.da), e.spd * 2.6, dt); return; }
    const d = distP(e);
    if (e.atkCd <= 0 && d < e.def.range && lineOfSight(G.fl, e.x, e.y, p.x, p.y)) { e.atkCd = rate(e); eShot(e, 'web', angP(e, 0.2)); Sound.play('web'); }
    if (e.stT <= 0) { e.stT = rnd(0.9, 1.6); e.dashT = 0.28; const dir = steerTo(e, p.x, p.y); e.da = Math.atan2(dir.y, dir.x) + rnd(-0.6, 0.6); }
    else { const a = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2; walk(e, Math.cos(a) * 0.3, Math.sin(a) * 0.3, e.spd, dt); }
  },
  bloat(e, dt, p) {
    if (e.st === 'swell') {
      e.stT -= dt; e.pose = 1; e.scale = 1 + (0.6 - e.stT) * 0.8;
      if (e.stT <= 0) {
        e.noReward = false;
        explode(e.x, e.y, 34, 0, { team: 'e', pdmg: e.dmg, color: '#a8e070', parts: ['#a8e070', '#86b04a', '#e8ffd0'], sound: 'pop' });
        G.fx.push({ kind: 'pool', x: e.x, y: e.y, r: 26, t: 0, life: 3, team: 'e', poison: true, tick: 0.3, color: '#8fe05c' });
        killEnemy(e, {});
      }
      return;
    }
    if (distP(e) < 26) { e.st = 'swell'; e.stT = 0.6; telegraph({ x: e.x, y: e.y, r: 34, life: 0.6, color: '#a8e070' }); Sound.play('telegraph', { p: 1.4 }); return; }
    const dir = steerTo(e, p.x, p.y);
    walk(e, dir.x, dir.y, e.spd, dt);
  },
  turret(e, dt, p) {
    e.atkCd -= dt;
    faceTo(e, p.x);
    if (e.atkCd > 0) { e.pose = e.atkCd < 0.4 ? 2 : 0; return; }
    e.atkCd = rate(e);
    if (e.def.shot === 'spread5') {
      if (!lineOfSight(G.fl, e.x, e.y - 8, p.x, p.y - 8)) { e.atkCd = 0.6; return; }
      const a = angP(e);
      for (let k = -2; k <= 2; k++) eShot(e, 'thorn', a + k * 0.22);
      Sound.play('shoot', { p: 0.7 });
    } else {
      e.ringOff = (e.ringOff || 0) + Math.PI / 8;
      for (let k = 0; k < 8; k++) eShot(e, 'shard', e.ringOff + (k * TAU) / 8);
      Sound.play('shard', { p: 0.6 });
    }
  },
  charger(e, dt, p) {
    if (e.st === 'aim') { e.stT -= dt; e.pose = 2; if (e.stT <= 0) { e.st = 'charge'; e.stT = 1.1; Sound.play('growl', { p: 1.2 }); e.contactDmg = e.dmg * 1.4; } return; }
    if (e.st === 'charge') {
      e.stT -= dt;
      const bumped = moveEnt(e, Math.cos(e.ca) * 250 * e.slowMul * dt, Math.sin(e.ca) * 250 * e.slowMul * dt);
      e.face = Math.cos(e.ca) > 0 ? 1 : -1;
      if (Math.random() < 0.5) burst(e.x, e.y, 1, ['#8a7a6a'], { smax: 20, lmax: 0.3 });
      if (bumped || e.stT <= 0) {
        e.st = 'dazed'; e.stT = bumped ? 1.3 : 0.5; e.contactDmg = null;
        if (bumped) { shake(3); Sound.play('slam', { v: 0.4, p: 1.4 }); burst(e.x, e.y - 4, 8, ['#c8bfa8', '#8a7a6a'], { smax: 70 }); e.dmgTakenMul = 1.5; }
      }
      return;
    }
    if (e.st === 'dazed') { e.stT -= dt; e.pose = 1; if (e.stT <= 0) { e.st = 'walk'; e.dmgTakenMul = 1; } return; }
    e.pose = 0; e.atkCd -= dt;
    const d = distP(e);
    if (e.atkCd <= 0 && d < 170 && lineOfSight(G.fl, e.x, e.y, p.x, p.y)) {
      e.st = 'aim'; e.stT = 0.6; e.atkCd = rnd(2.4, 3.4) * (e.rateMul || 1); e.ca = Math.atan2(p.y - e.y, p.x - e.x);
      telegraph({ x: e.x, y: e.y - 4, ang: e.ca, len: 120, life: 0.6, line: true, width: e.r * 2, color: '#ff6a4a' });
      return;
    }
    const dir = steerTo(e, p.x, p.y);
    walk(e, dir.x, dir.y, e.spd, dt);
  },
  lunger(e, dt, p) {
    if (e.st === 'crouch') { e.stT -= dt; e.pose = 2; if (e.stT <= 0) { e.st = 'leap'; e.stT = 0.28; e.contactDmg = e.dmg * 1.2; Sound.play('growl', { v: 0.5, p: 1.3 }); } return; }
    if (e.st === 'leap') { e.stT -= dt; e.z = Math.sin((1 - e.stT / 0.28) * Math.PI) * 8; walk(e, Math.cos(e.la), Math.sin(e.la), 270, dt); if (e.stT <= 0) { e.st = 'rest'; e.stT = 0.6; e.z = 0; e.contactDmg = null; } return; }
    if (e.st === 'rest') { e.stT -= dt; if (e.stT <= 0) e.st = 'run'; return; }
    e.pose = 0; e.atkCd -= dt;
    const d = distP(e);
    if (d < 70 && e.atkCd <= 0 && lineOfSight(G.fl, e.x, e.y, p.x, p.y)) { e.st = 'crouch'; e.stT = 0.32; e.la = angP(e, 0.15); e.atkCd = rnd(1.6, 2.2) * (e.rateMul || 1); return; }
    const dir = steerTo(e, p.x, p.y);
    const side = Math.sin(e.anim * 1.7 + e.x) * 0.5;
    const a = Math.atan2(dir.y, dir.x) + (d < 100 ? side : 0);
    walk(e, Math.cos(a), Math.sin(a), e.spd, dt);
  },
  slammer(e, dt, p) {
    if (e.st === 'raise') {
      e.stT -= dt; e.pose = 2;
      if (e.stT <= 0) {
        e.st = 'recover'; e.stT = 0.7;
        explode(e.x, e.y, 46, 0, { team: 'e', pdmg: e.dmg, color: e.def.sprite === 'golem' ? '#ff9a3c' : '#e9f8ff', parts: e.def.sprite === 'golem' ? ['#ff7a2a', '#3a2a26'] : ['#ffffff', '#cfe9f7'], sound: 'slam', shake: 4 });
        if (e.def.sprite === 'yeti') for (let k = 0; k < 10; k++) eShot(e, 'shard', (k * TAU) / 10, { y: e.y - 4 });
        if (e.def.sprite === 'golem') for (let k = 0; k < 8; k++) eShot(e, 'ember', (k * TAU) / 8 + 0.2, { y: e.y - 4 });
      }
      return;
    }
    if (e.st === 'recover') { e.stT -= dt; e.pose = 0; if (e.stT <= 0) e.st = 'walk'; return; }
    e.atkCd -= dt;
    const d = distP(e);
    if (d < 46 && e.atkCd <= 0) { e.st = 'raise'; e.stT = 0.7; e.atkCd = 2.4 * (e.rateMul || 1); telegraph({ x: e.x, y: e.y, r: 46, life: 0.7, color: '#ff8a6a' }); Sound.play('growl', { p: 0.6 }); return; }
    if (e.def.throws && d > 90 && e.atkCd <= 0 && lineOfSight(G.fl, e.x, e.y, p.x, p.y)) {
      e.atkCd = 3.4; e.pose = 2;
      const tx = p.x + p.vx * 0.5, ty = p.y + p.vy * 0.5;
      telegraph({ x: tx, y: ty, r: 22, life: 0.9, color: '#ff8a6a' });
      lob(e, 'rock', tx, ty, (pr) => explode(pr.x, pr.y, 22, 0, { team: 'e', pdmg: e.dmg, color: '#ff9a3c', vol: 0.5, shake: 2 }), { dur: 0.9, arc: 60 });
      return;
    }
    e.pose = 0;
    const dir = steerTo(e, p.x, p.y);
    walk(e, dir.x, dir.y, e.spd, dt);
  },
  lobber(e, dt, p) {
    e.atkCd -= dt;
    const d = distP(e);
    if (e.atkCd <= 0 && d < e.def.range && d > 40) {
      e.atkCd = rate(e); e.pose = 2; e.poseT = 0.4;
      const tx = p.x + p.vx * 0.6 + rnd(-10, 10), ty = p.y + p.vy * 0.6 + rnd(-10, 10);
      if (e.def.shot === 'bomb') {
        lob(e, 'bomb', tx, ty, (pr) => {
          G.fx.push({ kind: 'bombfuse', x: pr.x, y: pr.y, t: 0, life: 0.6 });
          telegraph({ x: pr.x, y: pr.y, r: 30, life: 0.6, color: '#ff6a4a', fire: () => explode(pr.x, pr.y, 30, 0, { team: 'e', pdmg: e.dmg, vol: 0.6, shake: 3 }) });
        }, { dur: 0.9, arc: 52 });
      } else {
        telegraph({ x: tx, y: ty, r: 18, life: 0.8, color: '#9fe0ff' });
        lob(e, 'snowball', tx, ty, (pr) => {
          burst(pr.x, pr.y, 10, ['#ffffff', '#cfe9f7'], { smax: 70 });
          Sound.play('ice', { v: 0.4, p: 0.8 });
          if (Math.hypot(p.x - pr.x, p.y - pr.y) < 18 + p.r && hurtPlayer(e.dmg, {}) === HIT.HIT) p.chillT = Math.max(p.chillT, 1.8);
        }, { dur: 0.8, arc: 42 });
      }
      Sound.play('swing', { p: 0.6, v: 0.4 });
      return;
    }
    if (e.poseT > 0) { e.poseT -= dt; return; }
    e.pose = 0;
    let a;
    if (d < 90) a = Math.atan2(e.y - p.y, e.x - p.x) + 0.5;
    else if (d > e.def.range * 0.9) { const s2 = steerTo(e, p.x, p.y); a = Math.atan2(s2.y, s2.x); }
    else a = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2 * (e.side || (e.side = rndPick([-1, 1])));
    walk(e, Math.cos(a), Math.sin(a), e.spd, dt);
    faceTo(e, p.x);
  },
  blinker(e, dt, p) {
    e.atkCd -= dt; e.stT -= dt;
    if (e.fadeT > 0) {
      e.fadeT -= dt; e.invuln = true;
      if (e.fadeT <= 0.3 && !e.moved) { const q = randomFloorPoint(G.fl.rooms[e.room], p.x, p.y, 60); e.x = q.x; e.y = q.y; e.moved = true; burst(e.x, e.y - 6, 8, ['#ff7a2a', '#3a1a1a'], { smax: 50, grav: -30, floor: false }); }
      if (e.fadeT <= 0) e.invuln = false;
      return;
    }
    if (e.stT <= 0) { e.stT = rnd(3, 4.5); e.fadeT = 0.6; e.moved = false; burst(e.x, e.y - 6, 8, ['#ff7a2a', '#3a1a1a'], { smax: 50, grav: -30, floor: false }); Sound.play('magic', { p: 0.5, v: 0.4 }); return; }
    if (e.atkCd <= 0 && lineOfSight(G.fl, e.x, e.y - 8, p.x, p.y - 8)) {
      e.atkCd = rate(e); e.pose = 2; e.poseT = 0.35;
      const pr = eShot(e, 'fireball', angP(e, 0.1));
      pr.aoe = 16; pr.onEnd = (q) => { burst(q.x, q.y, 6, ['#ff9a3c', '#ffd08a'], { smax: 50, glow: true }); G.fx.push({ kind: 'firefield', x: q.x, y: q.y, r: 10, t: 0, life: 1.5, team: 'e', burn: true, small: true, tick: 0.2 }); };
      Sound.play('fire', { p: 1.3, v: 0.5 });
    }
    if (e.poseT > 0) { e.poseT -= dt; return; }
    e.pose = 0;
    const a = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2 + Math.sin(e.anim) * 0.8;
    walk(e, Math.cos(a), Math.sin(a), e.spd, dt);
    faceTo(e, p.x);
  },
  breather(e, dt, p) {
    if (e.st === 'breathe') {
      e.stT -= dt; e.pose = 2;
      e.ba = e.ba + clamp(angDiff(e.ba, angP(e)), -dt * 1.2, dt * 1.2);
      e.face = Math.cos(e.ba) > 0 ? 1 : -1;
      e.tick = (e.tick || 0) - dt;
      if (e.tick <= 0) { e.tick = 0.07; const pr = eShot(e, 'flame', e.ba + rnd(-0.22, 0.22), { dmg: e.dmg, life: 0.42, x: e.x + e.face * 8, y: e.y - 5 }); pr.flame = true; }
      if (e.stT <= 0) { e.st = 'walk'; e.atkCd = rnd(2.2, 3); }
      return;
    }
    e.pose = 0; e.atkCd -= dt;
    const d = distP(e);
    if (d < 70 && e.atkCd <= 0 && lineOfSight(G.fl, e.x, e.y, p.x, p.y)) { e.st = 'breathe'; e.stT = 1.2; e.ba = angP(e); Sound.play('fire', { p: 0.7 }); return; }
    const dir = steerTo(e, p.x, p.y);
    walk(e, dir.x, dir.y, e.spd, dt);
  },
  ally(e, dt, p) {
    let best = null, bd = 1e9;
    for (const o of G.ents) if (!o.dead && o.type === 'enemy' && o.spawnT <= 0 && o.room === e.room && !o.invuln) { const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < bd) { bd = d; best = o; } }
    e.atkCd -= dt;
    if (best) {
      if (bd < best.r + e.r + 6) {
        if (e.atkCd <= 0) { e.atkCd = 0.75; e.pose = 2; e.poseT = 0.2; damageEnemy(best, e.dmg, { src: 'ally', noCrit: true, ang: Math.atan2(best.y - e.y, best.x - e.x), kb: 60, noProc: true }); Sound.play('hit', { v: 0.4, p: 1.2 }); }
      } else { const a = Math.atan2(best.y - e.y, best.x - e.x); walk(e, Math.cos(a), Math.sin(a), e.spd, dt); }
    } else if (Math.hypot(p.x - e.x, p.y - e.y) > 30) { const dir = steerTo(e, p.x, p.y); walk(e, dir.x, dir.y, e.spd, dt); }
    if (e.poseT > 0) e.poseT -= dt; else e.pose = 0;
  },
  allyturret(e, dt) {
    e.atkCd -= dt;
    if (e.atkCd > 0) return;
    let best = null, bd = 170;
    for (const o of G.ents) if (!o.dead && o.type === 'enemy' && o.spawnT <= 0 && o.room === e.room) { const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < bd && lineOfSight(G.fl, e.x, e.y - 10, o.x, o.y - 6)) { bd = d; best = o; } }
    if (!best) { e.atkCd = 0.2; return; }
    e.atkCd = 0.33;
    spawnProj({ team: 'p', src: 'ability', x: e.x, y: e.y - 12, ang: Math.atan2(best.y - best.h / 2 - (e.y - 12), best.x - e.x), speed: 260, dmg: e.dmg, life: 0.8, kind: 'missile', r: 3, color: '#c8a8ff', light: '#b98cff', kb: 20 });
    Sound.play('magic', { p: 1.6, v: 0.3 });
  },
};

/* ============================================================
   Bosses
   ============================================================ */
function startBoss(r) {
  const id = bossFor(G.fl), def = BOSSES[id], sc = scaleFor(G.fl.idx);
  const cx = (r.ix + r.iw / 2) * TS, cy = (r.iy + r.ih / 2) * TS;
  G.combat = true;
  setDoors(r, false);
  const heatMul = G.run.heat >= 6 ? 1.3 : 1;
  const e = {
    type: 'enemy', boss: true, kind: id, def, x: cx, y: cy - 30, vx: 0, vy: 0, kx: 0, ky: 0, r: def.r, h: 30,
    maxHp: def.hp * sc.hp * heatMul * (1 + G.p.stats.foeHp), hp: 0, dmg: def.dmg * sc.dmg, xp: def.xp, room: r.id, spawnT: 1.6, face: 1, anim: 0, flash: 0,
    stunT: 0, freezeT: 0, chillT: 0, chillN: 0, contactCd: 0, phase: 1, st: 'intro', stT: 1.2, atkT: 1.5, rooted: !!def.rooted, blood: ['#e8e0cc', '#ffffff'],
  };
  e.hp = e.maxHp;
  BOSS_AI[id].init(e, r);
  e.think = BOSS_AI[id].think;
  e.onHurt = (b) => {
    const f = b.hp / b.maxHp;
    if (b.phase === 1 && f < 0.66) { b.phase = 2; BOSS_AI[b.kind].phase && BOSS_AI[b.kind].phase(b, 2); banner(b.def.name, 'grows furious', 1.6); Sound.play('roar'); shake(6); }
    else if (b.phase === 2 && f < 0.33) { b.phase = 3; BOSS_AI[b.kind].phase && BOSS_AI[b.kind].phase(b, 3); banner(b.def.name, 'is desperate', 1.6); Sound.play('roar'); shake(8); }
  };
  G.ents.push(e);
  G.boss = e;
  G.fx.push({ kind: 'summon', x: e.x, y: e.y, t: 0, life: 1.6, r: 30, color: '#ff5a3a' });
  later(0.5, () => { banner(def.name, def.title, 2.6); Sound.play('roar'); shake(6); });
  Music.set(G.fl.actIdx, 2);
  $('bossbar').hidden = false; $('boss-name').textContent = def.name;
  runHooks('bossStart', e);
}
function bossDefeated(e) {
  const p = G.p, r = G.fl.rooms[e.room];
  G.slowmo = 1.2; hitstop(0.2);
  Sound.play('roar', { p: 0.7 }); Sound.play('boom');
  shake(12);
  for (let k = 0; k < 6; k++) later(0.15 * k, () => explode(e.x + rnd(-24, 24), e.y - rnd(0, 30), 26, 0, { team: 'none', color: '#ffd08a', vol: 0.5, shake: 3 }));
  burst(e.x, e.y - 16, 60, ['#ffd08a', '#ff7a2a', '#ffffff', '#e8e0cc'], { smax: 200, glow: true, vz: 140 });
  G.ents.forEach((o) => { if (o.type === 'enemy' && !o.dead && !o.boss) killEnemy(o); });
  G.projs = G.projs.filter((q) => q.team === 'p');
  G.fx = G.fx.filter((f) => f.team !== 'e' && f.kind !== 'tele');
  dropXP(e.x, e.y, Math.round(e.xp * p.stats.xpMul));
  dropPickup('gold', e.x, e.y, 25 + G.fl.actIdx * 15);
  dropPickup('ember', e.x, e.y, 10 + G.fl.actIdx * 6);
  dropPickup('potion', e.x, e.y, 1);
  G.run.stats.bosses++;
  CD.save.stats.bossKills = CD.save.stats.bossKills || {};
  CD.save.stats.bossKills[e.kind] = (CD.save.stats.bossKills[e.kind] || 0) + 1;
  G.boss = null; G.combat = false; r.cleared = true;
  $('bossbar').hidden = true;
  later(1.4, () => {
    setDoors(r, true);
    heal(p, Math.round(p.maxHp * 0.3));
    const cx = (r.ix + r.iw / 2) * TS, cy = (r.iy + r.ih / 2) * TS;
    const fl = G.fl;
    const spot = freeSpotNear(r, cx, cy + 10);
    const relic = { id: fl.props.length, kind: 'altar', relicChoice: true, used: false, x: spot.x, y: spot.y, room: r.id, solid: true, r: 9, light: { r: 60, c: '#ff6f9c' } };
    fl.props.push(relic); r.props.push(relic.id);
    const last = G.fl.idx === TOTAL_FLOORS - 1 && !G.run.endless;
    if (!last || true) {
      const st = { id: fl.props.length, kind: 'stairs', stairs: true, active: true, x: cx, y: cy - 34, room: r.id, final: last };
      fl.props.push(st); r.props.push(st.id);
    }
    banner(last ? `${e.def.name} falls` : 'Boss defeated', last ? 'the deep goes quiet' : 'choose a relic at the altar', 3);
    Music.set(G.fl.actIdx, 0);
    if (last) G.run.won = true;
  }, true);
}

const BOSS_AI = {
  /* ---- The Bone Colossus: a skull with two great hands ---- */
  colossus: {
    init(e, r) {
      e.y = (r.iy + (r.ih > 12 ? 3.2 : 1.9)) * TS; e.homeY = e.y; e.r = 18; e.h = 34; e.noContact = false; e.contactDmg = e.dmg;
      e.hands = [{ x: e.x - 50, y: e.y + 10, tx: 0, ty: 0, st: 'rest', t: 0 }, { x: e.x + 50, y: e.y + 10, tx: 0, ty: 0, st: 'rest', t: 0 }];
      e.rx0 = (r.ix + 3) * TS; e.rx1 = (r.ix + r.iw - 3) * TS; e.jaw = 0; e.order = 0;
    },
    think(e, dt) {
      const p = G.p, r = G.fl.rooms[e.room];
      e.x += clamp(p.x - e.x, -1, 1) * 22 * dt * (e.phase >= 2 ? 1.6 : 1);
      e.x = clamp(e.x, e.rx0, e.rx1);
      e.y = e.homeY + Math.sin(G.t * 1.3) * 3;
      e.jaw = Math.max(0, e.jaw - dt * 3);
      // hands
      for (const [i, hd] of e.hands.entries()) {
        const side = i === 0 ? -1 : 1;
        if (hd.st === 'rest') { hd.x = lerp(hd.x, e.x + side * 46, dt * 4); hd.y = lerp(hd.y, e.y + 8 + Math.sin(G.t * 2 + i) * 3, dt * 4); hd.z = 6; }
        else if (hd.st === 'hover') {
          hd.t -= dt; hd.x = lerp(hd.x, p.x, dt * 6); hd.y = lerp(hd.y, p.y, dt * 6); hd.z = 40;
          if (hd.t <= 0) { hd.st = 'drop'; hd.t = 0.55; hd.tx = hd.x; hd.ty = hd.y; telegraph({ x: hd.x, y: hd.y, r: 28, life: 0.55, color: '#ff6a4a' }); }
        } else if (hd.st === 'drop') {
          hd.t -= dt; hd.z = Math.max(0, hd.z - dt * 60);
          if (hd.t <= 0) {
            hd.st = 'down'; hd.t = 0.7; hd.z = 0;
            explode(hd.x, hd.y, 28, 0, { team: 'e', pdmg: e.dmg * 1.3, color: '#e8dcc8', parts: ['#e8e0cc', '#8a7a6a'], sound: 'slam', shake: 6 });
            G.fx.push({ kind: 'crack', x: hd.x, y: hd.y, r: 30, t: 0, life: 0.8 });
            const n = e.phase >= 2 ? 10 : 6;
            for (let k = 0; k < n; k++) eShot(e, 'bone', (k * TAU) / n + rnd(0.3), { x: hd.x, y: hd.y - 4, dmg: e.dmg * 0.8 });
          }
        } else if (hd.st === 'down') { hd.t -= dt; if (hd.t <= 0) hd.st = 'rest'; }
        // a hand resting on you hurts
        if ((hd.st === 'down' || hd.st === 'rest') && Math.hypot(p.x - hd.x, p.y - hd.y) < 12 + p.r) hurtPlayer(e.dmg * 0.7, { kx: (p.x - hd.x) * 6, ky: (p.y - hd.y) * 6 });
      }
      e.atkT -= dt;
      if (e.atkT > 0) return;
      const moves = e.phase >= 2 ? ['slam', 'rain', 'barrage', 'slam', 'summon', 'double'] : ['slam', 'barrage', 'rain', 'slam'];
      const m = moves[e.order++ % moves.length];
      if (m === 'slam' || m === 'double') {
        const free = e.hands.filter((hd) => hd.st === 'rest');
        for (const hd of (m === 'double' ? free : free.slice(0, 1))) { hd.st = 'hover'; hd.t = m === 'double' ? 1 + e.hands.indexOf(hd) * 0.5 : 0.9; }
        e.atkT = m === 'double' ? 3.2 : 2.2;
      } else if (m === 'rain') {
        e.jaw = 1; Sound.play('roar', { p: 1.3, v: 0.6 });
        const n = e.phase >= 3 ? 18 : 12;
        for (let k = 0; k < n; k++) {
          const q = k < 3 ? { x: p.x + rnd(-14, 14), y: p.y + rnd(-14, 14) } : randomFloorPoint(r, null, null, 0);
          later(k * 0.06, () => telegraph({ x: q.x, y: q.y, r: 13, life: 0.9, color: '#e8dcc8', fire: () => { burst(q.x, q.y, 6, ['#e8e0cc', '#b8ae96'], { smax: 60 }); Sound.play('bones', { v: 0.4 }); if (Math.hypot(G.p.x - q.x, G.p.y - q.y) < 13 + G.p.r) hurtPlayer(e.dmg, {}); } }));
        }
        e.atkT = 2.6;
      } else if (m === 'barrage') {
        const vol = e.phase >= 3 ? 5 : 3;
        for (let v = 0; v < vol; v++) later(v * 0.35, () => {
          if (G.boss !== e) return;
          e.jaw = 1;
          const a = angP(e), n = e.phase >= 2 ? 7 : 5;
          for (let k = 0; k < n; k++) eShot(e, 'bone', a + (k - (n - 1) / 2) * 0.18, { y: e.y + 2, speedMul: 1.1 });
          Sound.play('bones', { p: 0.8 });
        });
        e.atkT = 2.4;
      } else if (m === 'summon') {
        e.jaw = 1; Sound.play('roar', { p: 1.5, v: 0.5 });
        for (let k = 0; k < 3; k++) { const q = randomFloorPoint(r, G.p.x, G.p.y, 60); const s = spawnEnemy(rndPick(['skeleton', 'archer']), q.x, q.y, { room: e.room }); if (s) { s.xp = 1; s.gold = 0; } }
        e.atkT = 2.5;
      }
      if (e.phase >= 3) e.atkT *= 0.75;
    },
    phase(e, ph) { if (ph === 3) e.atkT = 0.5; },
  },

  /* ---- Mother Sporecap: a rooted giant who burrows when hurt ---- */
  sporecap: {
    init(e, r) { e.y = (r.iy + (r.ih > 12 ? 4 : 3.4)) * TS; e.r = 20; e.h = 50; e.rooted = true; e.order = 0; e.spin = 0; e.contactDmg = e.dmg; },
    think(e, dt) {
      const p = G.p, r = G.fl.rooms[e.room];
      if (e.st === 'burrow') {
        e.stT -= dt; e.invuln = true; e.hidden = true; e.noContact = true;
        if (e.stT <= 0.9 && !e.mark) { e.mark = randomFloorPoint(r, null, null, 0); e.mark = { x: lerp(e.mark.x, p.x, 0.6), y: lerp(e.mark.y, p.y, 0.6) }; telegraph({ x: e.mark.x, y: e.mark.y, r: 40, life: 0.9, color: '#c58cff' }); }
        if (e.stT <= 0) {
          e.st = 'idle'; e.invuln = false; e.hidden = false; e.noContact = false; e.x = e.mark.x; e.y = e.mark.y; e.mark = null;
          explode(e.x, e.y, 40, 0, { team: 'e', pdmg: e.dmg * 1.4, color: '#c58cff', parts: ['#5a4030', '#c58cff', '#e8dcc6'], sound: 'slam', shake: 7 });
          for (let k = 0; k < 12; k++) eShot(e, 'spore', (k * TAU) / 12, { y: e.y - 10 });
          e.atkT = 1.4;
        }
        return;
      }
      e.atkT -= dt;
      if (e.spinT > 0) {
        e.spinT -= dt; e.spin += dt * (e.phase >= 3 ? 2.6 : 2);
        e.spT = (e.spT || 0) - dt;
        if (e.spT <= 0) { e.spT = e.phase >= 2 ? 0.11 : 0.15; const arms = e.phase >= 3 ? 4 : 3; for (let k = 0; k < arms; k++) eShot(e, 'spore', e.spin + (k * TAU) / arms, { y: e.y - 14, life: 4 }); }
        return;
      }
      if (e.atkT > 0) return;
      const moves = e.phase >= 2 ? ['spiral', 'rain', 'ring', 'brood', 'burrow'] : ['spiral', 'ring', 'rain', 'brood'];
      const m = moves[e.order++ % moves.length];
      if (m === 'spiral') { e.spinT = 3; e.atkT = 4.2; Sound.play('venom', { p: 0.6 }); }
      else if (m === 'ring') {
        for (let w = 0; w < (e.phase >= 3 ? 3 : 2); w++) later(w * 0.55, () => { if (G.boss !== e) return; const off = rnd(TAU); for (let k = 0; k < 22; k++) if (k % 11 !== 0 && k % 11 !== 1) eShot(e, 'thorn', off + (k * TAU) / 22, { y: e.y - 6, speedMul: 0.9 }); Sound.play('shoot', { p: 0.5 }); shake(2); });
        e.atkT = 2.6;
      } else if (m === 'rain') {
        for (let k = 0; k < 7; k++) {
          const q = k < 2 ? { x: p.x + rnd(-10, 10), y: p.y + rnd(-10, 10) } : randomFloorPoint(r, null, null, 0);
          telegraph({ x: q.x, y: q.y, r: 22, life: 1.1, color: '#8fe05c' });
          lob(e, 'glob', q.x, q.y, () => { G.fx.push({ kind: 'pool', x: q.x, y: q.y, r: 24, t: 0, life: 4, team: 'e', poison: true, tick: 0.3, color: '#8fe05c' }); if (Math.hypot(G.p.x - q.x, G.p.y - q.y) < 22) hurtPlayer(e.dmg * 0.6, {}); Sound.play('splat', { v: 0.4 }); }, { dur: 1.1, arc: 80, color: '#8fe05c' });
        }
        e.atkT = 2.4;
      } else if (m === 'brood') {
        for (let k = 0; k < (e.phase >= 2 ? 4 : 3); k++) { const q = randomFloorPoint(r, G.p.x, G.p.y, 60); const s = spawnEnemy(rndPick(['sporeling', 'bloat', 'spider']), q.x, q.y, { room: e.room }); if (s) { s.xp = 1; s.gold = 0; } }
        Sound.play('spawn'); e.atkT = 2.6;
      } else if (m === 'burrow') {
        e.st = 'burrow'; e.stT = 2.2; e.atkT = 3;
        burst(e.x, e.y, 30, ['#5a4030', '#8a6a4a', '#c58cff'], { smax: 120 }); Sound.play('slam'); shake(5);
      }
      if (e.phase >= 3) e.atkT *= 0.75;
    },
    phase(e) { e.atkT = 0.3; },
  },

  /* ---- The Rime Wyrm: a serpent of ice segments ---- */
  wyrm: {
    init(e, r) {
      e.r = 11; e.h = 18; e.segN = 11; e.trail = []; e.heading = 0; e.spd = 70; e.order = 0; e.fly = true; e.contactDmg = e.dmg;
      for (let k = 0; k < 400; k++) e.trail.push({ x: e.x, y: e.y });
      e.segs = [];
      e.target = { x: e.x, y: e.y };
    },
    think(e, dt) {
      const p = G.p, r = G.fl.rooms[e.room];
      e.retT = (e.retT || 0) - dt;
      if (e.retT <= 0 || Math.hypot(e.target.x - e.x, e.target.y - e.y) < 20) {
        e.retT = rnd(1.4, 2.4);
        e.target = Math.random() < 0.55 ? { x: p.x, y: p.y } : randomFloorPoint(r, null, null, 0);
      }
      let spd = e.spd * (e.phase >= 2 ? 1.25 : 1) * (e.chillT > 0 ? 0.8 : 1);
      if (e.st === 'breath') { spd *= 0.15; }
      if (e.st === 'dive') {
        e.stT -= dt; e.hidden = true; e.invuln = true; e.noContact = true;
        if (e.stT <= 0) {
          e.st = 'swim'; e.hidden = false; e.invuln = false; e.noContact = false;
          e.x = e.dive.x; e.y = e.dive.y; e.trail.forEach((t) => { t.x = e.x; t.y = e.y; });
          explode(e.x, e.y, 38, 0, { team: 'e', pdmg: e.dmg * 1.3, color: '#cfefff', parts: ['#ffffff', '#9fe0ff'], sound: 'ice', shake: 6 });
          for (let k = 0; k < 14; k++) eShot(e, 'shard', (k * TAU) / 14, { y: e.y - 6 });
          e.atkT = 1.2;
        }
        return;
      }
      const want = Math.atan2(e.target.y - e.y, e.target.x - e.x);
      e.heading += clamp(angDiff(e.heading, want), -2.4 * dt, 2.4 * dt) + Math.sin(G.t * 3) * 0.6 * dt;
      const nx = e.x + Math.cos(e.heading) * spd * dt, ny = e.y + Math.sin(e.heading) * spd * dt;
      if (insideInterior(r, nx, ny, 1)) { e.x = nx; e.y = ny; } else e.heading += Math.PI * 0.6;
      e.face = Math.cos(e.heading) >= 0 ? 1 : -1;
      // body follows the head's path
      e.trail.unshift({ x: e.x, y: e.y }); e.trail.length = 400;
      e.segs.length = 0;
      let acc = 0, idx = 0;
      for (let s = 1; s <= e.segN; s++) {
        const want2 = s * 13;
        while (idx < e.trail.length - 1 && acc < want2) { acc += Math.hypot(e.trail[idx + 1].x - e.trail[idx].x, e.trail[idx + 1].y - e.trail[idx].y); idx++; }
        e.segs.push({ x: e.trail[idx].x, y: e.trail[idx].y, tail: s === e.segN });
      }
      // body contact
      if (!p.dead) for (const s of e.segs) if (Math.hypot(p.x - s.x, p.y - s.y) < 9 + p.r) { hurtPlayer(e.dmg * 0.8, { kx: (p.x - s.x) * 8, ky: (p.y - s.y) * 8 }); break; }
      if (e.st === 'breath') {
        e.stT -= dt; e.tick = (e.tick || 0) - dt;
        e.ba += clamp(angDiff(e.ba, angP(e)), -dt * 0.9, dt * 0.9);
        if (e.tick <= 0) { e.tick = 0.06; eShot(e, 'icebolt', e.ba + rnd(-0.25, 0.25), { y: e.y - 6, speedMul: rnd(0.9, 1.2), life: 1.2, dmg: e.dmg * 0.7 }); }
        if (e.stT <= 0) { e.st = 'swim'; }
        return;
      }
      e.atkT -= dt;
      if (e.atkT > 0) return;
      const moves = e.phase >= 2 ? ['breath', 'icicles', 'scales', 'dive', 'breath', 'scales'] : ['breath', 'scales', 'icicles'];
      const m = moves[e.order++ % moves.length];
      if (m === 'breath') { e.st = 'breath'; e.stT = 1.5; e.ba = angP(e); telegraph({ x: e.x, y: e.y - 6, ang: e.ba, len: 90, life: 0.4, line: true, width: 18, color: '#9fe0ff' }); Sound.play('ice', { p: 0.6 }); e.atkT = 3; }
      else if (m === 'scales') {
        for (const s of e.segs) { const a = rnd(TAU); for (let k = 0; k < 2; k++) eShot(e, 'shard', a + k * Math.PI, { x: s.x, y: s.y - 6, speedMul: 0.9 }); }
        Sound.play('shard', { p: 0.5 }); e.atkT = e.phase >= 3 ? 1.6 : 2.2;
      } else if (m === 'icicles') {
        const n = e.phase >= 3 ? 4 : 3;
        for (let l = 0; l < n; l++) {
          const a = rnd(TAU), ox = p.x - Math.cos(a) * 60, oy = p.y - Math.sin(a) * 60;
          for (let k = 0; k < 8; k++) {
            const x = ox + Math.cos(a) * k * 18, y = oy + Math.sin(a) * k * 18;
            if (!insideInterior(r, x, y, 0.5)) continue;
            later(l * 0.35 + k * 0.05, () => telegraph({ x, y, r: 10, life: 0.7, color: '#cfefff', fire: () => { G.fx.push({ kind: 'icicle', x, y, t: 0, life: 0.8 }); Sound.play('shard', { v: 0.4 }); if (Math.hypot(G.p.x - x, G.p.y - y) < 10 + G.p.r && hurtPlayer(e.dmg, {}) === HIT.HIT) G.p.chillT = 1.5; } }));
          }
        }
        e.atkT = 2.6;
      } else if (m === 'dive') {
        e.st = 'dive'; e.stT = 1.6; e.dive = { x: p.x, y: p.y };
        later(0.5, () => { if (G.boss === e) { e.dive = { x: G.p.x, y: G.p.y }; telegraph({ x: e.dive.x, y: e.dive.y, r: 38, life: 1.05, color: '#9fe0ff' }); } });
        burst(e.x, e.y, 24, ['#ffffff', '#9fe0ff'], { smax: 120 }); Sound.play('ice', { p: 0.5 }); e.atkT = 3;
      }
      if (e.phase >= 3) e.atkT *= 0.8;
    },
    phase(e, ph) { e.segN = ph === 3 ? 9 : 11; e.atkT = 0.4; },
  },

  /* ---- The Cinder King: a duelist with a burning blade ---- */
  king: {
    init(e, r) { e.r = 10; e.h = 32; e.order = 0; e.spd = 60; e.swordA = 0; e.contactDmg = e.dmg * 0.6; },
    think(e, dt) {
      const p = G.p, r = G.fl.rooms[e.room];
      const fury = e.phase >= 3 ? 1.35 : e.phase >= 2 ? 1.15 : 1;
      faceTo(e, p.x);
      if (e.st === 'dash') {
        e.stT -= dt;
        const sp = 300 * fury;
        moveEnt(e, Math.cos(e.da) * sp * dt, Math.sin(e.da) * sp * dt);
        if (Math.random() < 0.8) G.fx.push({ kind: 'firefield', x: e.x, y: e.y, r: 8, t: 0, life: 1.2, team: 'e', burn: true, small: true, tick: 0.2 });
        if (e.stT <= 0) { e.st = 'combo'; e.combo = 0; e.stT = 0.05; }
        return;
      }
      if (e.st === 'combo') {
        e.stT -= dt;
        if (e.stT <= 0) {
          if (e.combo >= (e.phase >= 2 ? 4 : 3)) { e.st = 'idle'; e.atkT = 0.8 / fury; return; }
          const a = angP(e);
          e.swordA = a; e.swing = 0.25;
          telegraph({ x: e.x, y: e.y - 12, ang: a, arc: 2.2, r: 44, life: 0.32 / fury, color: '#ff7a2a', cone: true, fire: () => {
            if (G.boss !== e) return;
            Sound.play('heavy', { p: 0.8 });
            G.fx.push({ kind: 'slash', x: e.x, y: e.y - 12, ang: a, arc: 2.2, reach: 44, t: 0, life: 0.22, dir: e.combo % 2 ? -1 : 1, style: 'slash', heavy: true, color: '#ffb35e', enemy: true });
            const d = Math.hypot(p.x - e.x, p.y - 8 - (e.y - 12));
            if (d < 46 && Math.abs(angDiff(a, Math.atan2(p.y - 8 - (e.y - 12), p.x - e.x))) < 1.15) hurtPlayer(e.dmg * 1.2, { kx: Math.cos(a) * 200, ky: Math.sin(a) * 200 });
            if (e.phase >= 2) for (let k = -1; k <= 1; k++) eShot(e, 'flame', a + k * 0.3, { y: e.y - 12 });
            moveEnt(e, Math.cos(a) * 10, Math.sin(a) * 10);
          } });
          e.combo++; e.stT = 0.45 / fury;
        }
        return;
      }
      if (e.st === 'channel') {
        e.stT -= dt; e.spin = (e.spin || 0) + dt * 2.2;
        e.spT = (e.spT || 0) - dt;
        if (e.spT <= 0) { e.spT = 0.09; for (let k = 0; k < 3; k++) eShot(e, 'ember', e.spin + (k * TAU) / 3, { y: e.y - 14, life: 4 }); }
        if (e.stT <= 0) { e.st = 'idle'; e.atkT = 1; }
        return;
      }
      if (e.st === 'windup') return;
      // reposition between attacks
      const d = distP(e);
      if (d > 80) { const dir = steerTo(e, p.x, p.y); walk(e, dir.x, dir.y, e.spd * fury, dt); }
      else if (d < 40) { const a = Math.atan2(e.y - p.y, e.x - p.x); walk(e, Math.cos(a), Math.sin(a), e.spd * fury, dt); }
      e.atkT -= dt;
      if (e.atkT > 0) return;
      const moves = e.phase >= 3 ? ['dash', 'meteors', 'channel', 'dash', 'wave', 'imps'] : e.phase >= 2 ? ['dash', 'wave', 'meteors', 'dash', 'channel'] : ['dash', 'wave', 'dash', 'meteors'];
      const m = moves[e.order++ % moves.length];
      if (m === 'dash') {
        e.da = angP(e); e.st = 'windup';
        telegraph({ x: e.x, y: e.y - 6, ang: e.da, len: Math.min(220, d + 20), life: 0.5 / fury, line: true, width: 16, color: '#ff7a2a', fire: () => { if (G.boss === e) { e.st = 'dash'; e.stT = Math.min(0.6, (d + 10) / (300 * fury)); Sound.play('dash', { p: 0.6 }); } } });
        e.atkT = 9;
      } else if (m === 'wave') {
        Sound.play('slam'); shake(5);
        const a = angP(e);
        for (let w = 0; w < 3; w++) later(w * 0.3, () => { if (G.boss !== e) return; const n = 9; for (let k = 0; k < n; k++) eShot(e, 'flame', a + (k - (n - 1) / 2) * 0.16 + (w % 2 ? 0.08 : 0), { y: e.y - 8, life: 2.5 }); });
        G.fx.push({ kind: 'crack', x: e.x, y: e.y, r: 30, t: 0, life: 0.7 });
        e.atkT = 2.2 / fury;
      } else if (m === 'meteors') {
        Sound.play('roar', { p: 1.2, v: 0.6 });
        const n = e.phase >= 3 ? 12 : 8;
        for (let k = 0; k < n; k++) {
          const q = k < 2 ? { x: p.x + rnd(-8, 8), y: p.y + rnd(-8, 8) } : randomFloorPoint(r, null, null, 0);
          later(k * 0.12, () => { telegraph({ x: q.x, y: q.y, r: 24, life: 1, color: '#ff5a2a', fire: () => { explode(q.x, q.y, 24, 0, { team: 'e', pdmg: e.dmg, color: '#ff9a3c', vol: 0.5, shake: 3 }); G.fx.push({ kind: 'firefield', x: q.x, y: q.y, r: 16, t: 0, life: 2, team: 'e', burn: true, tick: 0.2 }); } }); G.fx.push({ kind: 'meteor', x: q.x, y: q.y, t: 0, life: 1 }); });
        }
        e.atkT = 3 / fury;
      } else if (m === 'channel') { e.st = 'channel'; e.stT = 3.2; Sound.play('fire', { p: 0.5 }); e.atkT = 9; }
      else if (m === 'imps') { for (let k = 0; k < 3; k++) { const q = randomFloorPoint(r, G.p.x, G.p.y, 60); const s = spawnEnemy('imp', q.x, q.y, { room: e.room }); if (s) { s.xp = 1; s.gold = 0; } } Sound.play('spawn'); e.atkT = 1.5; }
    },
    phase(e, ph) { e.atkT = 0.4; if (ph === 3) { e.spd = 80; banner('The Cinder King', 'the blade burns white', 1.6); } },
  },
};

