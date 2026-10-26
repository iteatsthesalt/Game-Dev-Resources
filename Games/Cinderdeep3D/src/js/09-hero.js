/* ============================================================
   Cinderdeep — the hero: movement, dashing, weapons, abilities
   ============================================================ */
function makePlayer(cls, o = {}) {
  const c = CLASS[cls], save = CD.save, meta = save.meta || {};
  const p = {
    x: 0, y: 0, vx: 0, vy: 0, r: 5, h: 18, cls, look: c.look, sheet: o.sheet || null, face: 1, view: 'front', aim: 0, ax: 0, ay: 0, anim: 0, moving: false,
    weapons: [makeWeapon(c.weapon, c.beast ? 'natural' : 'common', null)], wi: 0, beast: !!c.beast, form: c.beast ? c.id : null, abilities: [{ id: c.ability, lvl: 1, cd: 0, max: 1 }, null],
    skills: {}, relics: [], level: 1, xp: 0, gold: 20 * (meta.purse || 0), keys: 1 + (meta.keys || 0), potions: 0,
    pendingLevels: 0, rerolls: meta.reroll || 0, reviveLeft: meta.revive ? 1 : 0,
    dashCharges: 1, dashRecharge: 0, dashT: 0, dashDx: 0, dashDy: 0, iframes: 0, hurtT: 0, atkCd: 0, combo: 0, comboT: 0, swing: null,
    critNext: 0, surgeN: 0, bulwarkT: 0, haloT: 0, shieldHits: 0, frenzyN: 0, frenzyT: 0, idolT: 3, orbitA: 0, atkCount: 0, regenAcc: 0,
    barrierT: 0, whirlT: 0, whirlTick: 0, leapT: 0, bashT: 0, slowT: 0, chillT: 0, poisonT: 0, burnT: 0, dotT: 0.5, dead: false,
  };
  p.weapon = p.weapons[0];
  if (p.beast && typeof setFormBody === 'function') setFormBody(p);
  recalcStats(p);
  p.hp = p.maxHp; p.potions = p.stats.potMax; p.dashCharges = p.stats.dashMax;
  return p;
}

/* ---------- derived numbers ---------- */
function weaponDamage(p = G.p) {
  const w = p.weapon, def = WEAPON[w.id], s = p.stats;
  let d = def.dmg * RARITY[w.rar].mul * (1 + 0.12 * (w.lvl || 0)) * s.dmgMul * (1 + s.wDmg);
  if (p.cls === 'berserker') d *= 1 + 0.5 * (1 - p.hp / p.maxHp);
  if (s.goldDmg) d *= 1 + Math.min(0.4, p.gold / 1000);
  if (p.surgeN > 0) d *= 1.5;
  if (p.beast) d *= 1 + 0.02 * (p.level - 1);
  return d;
}
function abilityDamage(base, lvl, p = G.p) {
  const s = p.stats;
  let d = base * AB_LEVEL[lvl].dmg * (1 + 0.16 * G.fl.idx) * s.abDmg * (0.5 + 0.5 * s.dmgMul);
  if (p.cls === 'berserker') d *= 1 + 0.5 * (1 - p.hp / p.maxHp);
  return d;
}
function attackRate(p = G.p) {
  const def = WEAPON[p.weapon.id];
  return def.rate * Math.max(0.3, p.stats.atkSpd + (p.atkBonus || 0)) * (1 + 0.05 * (p.frenzyN || 0));
}

/* ---------- aiming ---------- */
function updateAim(p) {
  const A = Input.act;
  if (A.aimMode === 'mouse') {
    const w = screenToWorld(Input.mouse.x, Input.mouse.y);
    p.ax = w.x; p.ay = w.y; p.aim = Math.atan2(w.y - (p.y - 8), w.x - p.x);
    $('app').classList.add('aiming');
  } else {
    $('app').classList.remove('aiming');
    if (A.aimMode === 'stick') p.aim = Math.atan2(A.ay, A.ax);
    else {
      // auto-aim: nearest foe in sight, else the way you move
      let best = null, bd = 230;
      for (const e of G.ents) {
        if (e.dead || e.type === 'ally' || e.spawnT > 0) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < bd && lineOfSight(G.fl, p.x, p.y - 6, e.x, e.y - 6)) { bd = d; best = e; }
      }
      if (best) p.aim = Math.atan2(best.y - best.h * 0.45 - (p.y - 8), best.x - p.x);
      else if (Math.hypot(A.mx, A.my) > 0.2) p.aim = Math.atan2(A.my, A.mx);
    }
    // lobbed shots land on the foe you are aiming at, not at a fixed distance
    let reach = 90, bd = 220;
    for (const e of G.ents) {
      if (e.dead || e.type === 'ally' || e.spawnT > 0) continue;
      const dx = e.x - p.x, dy = e.y - e.h * 0.3 - (p.y - 8), d = Math.hypot(dx, dy);
      if (d >= bd || d < 8) continue;
      let da = Math.atan2(dy, dx) - p.aim; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < 0.4) { bd = d; reach = d; }
    }
    p.ax = p.x + Math.cos(p.aim) * reach; p.ay = p.y - 8 + Math.sin(p.aim) * reach;
  }
}

/* ---------- per-frame hero update ---------- */
function updatePlayer(dt) {
  const p = G.p, s = p.stats, A = Input.act, fl = G.fl;
  if (p.dead) { p.vx *= 0.9; p.vy *= 0.9; return; }
  // timers
  for (const k of ['iframes', 'hurtT', 'slowT', 'chillT', 'barrierT', 'frenzyT', 'comboT']) if (p[k] > 0) p[k] = Math.max(0, p[k] - dt);
  if (p.frenzyT <= 0) p.frenzyN = 0;
  p.atkCd -= dt;
  if (p.bulwarkT > 0) p.bulwarkT -= dt;
  for (const a of p.abilities) if (a && a.cd > 0) a.cd = Math.max(0, a.cd - dt);
  // dash charges
  if (p.dashCharges < s.dashMax) { p.dashRecharge += dt; if (p.dashRecharge >= s.dashCd) { p.dashRecharge = 0; p.dashCharges++; } }
  else p.dashRecharge = 0;
  // halo shield
  if (s.halo) { p.haloT += dt; if (p.haloT >= s.halo && p.shieldHits < 1) { p.shieldHits = 1; Sound.play('block', { p: 1.3, v: 0.4 }); } }
  if (s.regen) heal(p, s.regen * dt, true);
  if (p.xpComboT > 0) { p.xpComboT -= dt; if (p.xpComboT <= 0) p.xpCombo = 0; }
  // damage over time on the hero
  p.dotT -= dt;
  if (p.dotT <= 0) {
    p.dotT = 0.5;
    if (p.poisonT > 0) { p.poisonT -= 0.5; hurtDot(p, 2 + G.fl.idx * 0.6, '#8fe05c'); }
    if (p.burnT > 0) { p.burnT -= 0.5; if (!s.fireproof) hurtDot(p, 3 + G.fl.idx * 0.8, '#ff9a3c'); }
  }

  updateAim(p);
  // facing and view
  const ca = Math.cos(p.aim), sa = Math.sin(p.aim);
  if (Math.abs(ca) > 0.15) p.face = ca >= 0 ? 1 : -1;
  p.turn = pickTurn(p.turn, ca, sa);
  p.view = p.turn >= 3 ? 'back' : 'front';

  // dash
  if (A.dash && p.dashCharges > 0 && p.dashT <= 0 && p.leapT <= 0 && p.bashT <= 0) {
    let dx = A.mx, dy = A.my;
    if (Math.hypot(dx, dy) < 0.2) { dx = ca; dy = sa; }
    const l = Math.hypot(dx, dy); dx /= l; dy /= l;
    p.dashDx = dx; p.dashDy = dy; p.dashT = 0.17; p.dashCharges--; p.dashHit = new Set();
    Sound.play('dash');
    burst(p.x, p.y - 2, 8, ['#cfe9ff', '#ffffff'], { ang: Math.atan2(-dy, -dx), spread: 0.5, smax: 80 });
    G.run.stats.dashes++;
    runHooks('onDash', p);
  }
  const tile = tileAt(fl, Math.floor(p.x / TS), Math.floor(p.y / TS));
  const onIce = tile === TILE.ICE;
  if (p.dashT > 0) {
    p.dashT -= dt;
    const sp = 330;
    p.vx = p.dashDx * sp; p.vy = p.dashDy * sp;
    if (s.bladeDash) for (const e of G.ents) if (!e.dead && e.type !== 'ally' && e.spawnT <= 0 && !p.dashHit.has(e) && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 10) { p.dashHit.add(e); damageEnemy(e, weaponDamage() * s.bladeDash, { src: 'weapon', ang: Math.atan2(p.dashDy, p.dashDx), kb: 60 }); }
    if (s.dashThorns && Math.random() < 0.5) G.fx.push({ kind: 'thorns', x: p.x, y: p.y, r: 10, t: 0, life: 2.5, team: 'p', dmg: weaponDamage() * 0.3, tick: 0 });
    if (p.dashT <= 0) { p.vx *= 0.35; p.vy *= 0.35; }
  } else if (p.bashT > 0) {
    p.bashT -= dt;
    p.vx = Math.cos(p.bashA) * 300; p.vy = Math.sin(p.bashA) * 300;
    for (const e of G.ents) if (!e.dead && e.type !== 'ally' && e.spawnT <= 0 && !p.bashHit.has(e) && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 12) {
      p.bashHit.add(e);
      damageEnemy(e, p.bashDmg, { src: 'ability', ang: p.bashA, kb: 280, stun: 1 });
      shake(4); hitstop(0.05);
    }
  } else if (p.leapT > 0) {
    p.leapT -= dt;
    const k = 1 - p.leapT / p.leapDur;
    p.x = lerp(p.leapX0, p.leapX1, k); p.y = lerp(p.leapY0, p.leapY1, k); p.z = Math.sin(k * Math.PI) * 30;
    if (p.leapT <= 0) { p.z = 0; p.leapLand(); }
  } else {
    let spd = s.spd;
    if (p.slowT > 0) spd *= 0.55;
    if (p.chillT > 0) spd *= 0.75;
    if (p.whirlT > 0) spd *= 0.75;
    if (tile === TILE.TOXIC) spd *= 0.75;
    const tx = A.mx * spd, ty = A.my * spd;
    const k = onIce ? 2.6 : 16;
    p.vx = lerp(p.vx, tx, 1 - Math.exp(-k * dt)); p.vy = lerp(p.vy, ty, 1 - Math.exp(-k * dt));
  }
  if (p.leapT <= 0) moveEnt(p, p.vx * dt, p.vy * dt);
  p.moving = Math.hypot(p.vx, p.vy) > 12;
  if (p.moving) p.anim += dt * (p.dashT > 0 ? 0 : Math.hypot(p.vx, p.vy) / 9);

  // hazards underfoot
  if (p.dashT <= 0 && p.leapT <= 0 && !p.fly) {
    if (tile === TILE.LAVA && !s.fireproof) { p.burnT = Math.max(p.burnT, 1.5); p.lavaT = (p.lavaT || 0) - dt; if (p.lavaT <= 0) { p.lavaT = 0.5; hurtPlayer(5 + G.fl.idx * 1.5, {}); } }
    if (tile === TILE.TOXIC) p.poisonT = Math.max(p.poisonT, 1.2);
    if (tile === TILE.SPIKE && !s.sturdy) {
      const sp = G.room && G.room.props.map((i) => fl.props[i]).find((q) => q.kind === 'spikes' && Math.floor(q.x / TS) === Math.floor(p.x / TS) && Math.floor(q.y / TS) === Math.floor(p.y / TS));
      if (sp && sp.up) hurtPlayer(8 + G.fl.idx * 2, {});
    }
  }

  // whirlwind
  if (p.whirlT > 0) {
    p.whirlT -= dt; p.whirlTick -= dt;
    if (p.whirlTick <= 0) {
      p.whirlTick = 0.18;
      Sound.play('swing', { p: 0.8 + Math.random() * 0.3, v: 0.5 });
      for (const e of G.ents) if (!e.dead && e.type !== 'ally' && e.spawnT <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < 36 + e.r) damageEnemy(e, p.whirlDmg, { src: 'ability', ang: Math.atan2(e.y - p.y, e.x - p.x), kb: 50 });
      breakPropsIn(p.x, p.y, 34);
      for (const pr of G.projs) if (pr.team === 'e' && !pr.lob && Math.hypot(pr.x - p.x, pr.y - p.y + 8) < 36) pr.life = 0;
    }
  }

  // attacking
  if (p.swing) updateSwing(p, dt);
  if (A.attack && p.atkCd <= 0 && p.leapT <= 0 && p.bashT <= 0 && G.mode === 'play') attack(p);
  if (A.ab1) castAbility(p, 0);
  if (A.ab2) castAbility(p, 1);
  if (A.potion) drinkPotion(p);
  if (A.swap) swapWeapon(p);

  // relic engines
  if (s.orbit) {
    p.orbitA += dt * 3.4;
    for (let k = 0; k < s.orbit; k++) {
      const a = p.orbitA + (k * TAU) / s.orbit, bx = p.x + Math.cos(a) * 26, by = p.y - 6 + Math.sin(a) * 18;
      for (const e of G.ents) if (!e.dead && e.type !== 'ally' && e.spawnT <= 0 && (e.orbitT || 0) <= G.t && Math.hypot(e.x - bx, e.y - e.h / 2 - by) < e.r + 5) { e.orbitT = G.t + 0.35; damageEnemy(e, 8 * (1 + 0.2 * G.fl.idx), { src: 'ability', noCrit: true, ang: a, kb: 40 }); }
    }
  }
  if (s.chillAura) for (const e of G.ents) if (!e.dead && e.type !== 'ally' && Math.hypot(e.x - p.x, e.y - p.y) < s.chillAura) e.chillT = Math.max(e.chillT, 0.3);
  if (s.idol) {
    p.idolT -= dt;
    if (p.idolT <= 0) {
      p.idolT = 6;
      const foes = G.ents.filter((e) => !e.dead && e.type !== 'ally' && e.spawnT <= 0 && e.room === (G.room && G.room.id));
      if (foes.length) { const e = rndPick(foes); lightningStrike(e.x, e.y, s.idol * (1 + 0.18 * G.fl.idx)); }
    }
  }
  if (s.petWolf && !G.ents.some((e) => e.pet && !e.dead)) { const w = spawnAlly('ally_wolf', p.x - 10, p.y, 1e9); if (w) w.pet = true; }
}
function hurtDot(p, amt, color) {
  if (p.dead || CD.debug.god) return;
  const d = Math.max(1, Math.round(amt * (1 - p.stats.armor / (p.stats.armor + 10))));
  p.hp -= d; G.run.stats.dmgTaken += d;
  addText(p.x, p.y - 20, d, color);
  if (p.hp <= 0) { p.hp = 0; playerAtZero(p); }
}

/* ---------- weapons ---------- */
function attack(p) {
  const w = p.weapon, def = WEAPON[w.id], s = p.stats;
  p.atkCd = 1 / attackRate(p);
  p.atkCount++;
  const dmg = weaponDamage(p);
  if (p.surgeN > 0) p.surgeN--;
  fireWeapon(p, def, w, dmg, p.aim);
  p.atkPose = 0.16;
  runHooks('onAttack', p, def, w, dmg);
  const echo = (w.legend === 'echo' && p.atkCount % 4 === 0) || (s.echoAtk && Math.random() < s.echoAtk);
  if (echo) later(0.12, () => { if (G.p === p && !p.dead) fireWeapon(p, def, w, dmg * 0.8, p.aim, true); });
  if (s.wave && def.kind === 'melee' && p.atkCount % Math.max(2, 5 - s.wave) === 0) {
    spawnProj({ team: 'p', x: p.x, y: p.y - 7, ang: p.aim, speed: 230, dmg: dmg * 0.8, life: 0.45, kind: 'wave', pierce: 99, r: 6, kb: 60, color: '#e8f0ff' });
  }
}
function handPos(p, ang = p.aim) { return { x: p.x + Math.cos(ang) * 6, y: p.y - 8 + Math.sin(ang) * 4 }; }

function fireWeapon(p, def, w, dmg, ang, echo) {
  const s = p.stats, reach = (def.reach || 0) * s.reachMul, hp = handPos(p, ang);
  const crit = def.crit || 0;
  const el = def.kind === 'melee' || def.natural || def.evolved ? { burn: def.burn, chill: def.chill, poison: def.poison, shock: def.shock } : {};
  const base = { src: 'weapon', critAdd: crit, rend: def.rend, leech: def.leech, stunCh: def.stunCh, ...el };
  switch (def.style) {
    case 'slash': case 'stab': case 'punch': {
      const n = def.combo || 1;
      p.combo = p.comboT > 0 ? (p.combo + 1) % n : 0;
      p.comboT = 0.7;
      const last = n > 1 && p.combo === n - 1;
      let arc = def.arc, rch = reach, d = dmg, kb = def.kb;
      if (last && def.style === 'slash') { arc *= 1.25; rch *= 1.15; d *= 1.5; kb *= 1.6; }
      if (last && def.style === 'punch') { d *= 2; kb *= 6; }
      const dur = Math.min(def.style === 'slash' ? 0.2 : 0.11, (1 / attackRate(p)) * 0.85);
      p.swing = { t: 0, dur, ang, arc, reach: rch, dmg: d, kb, hits: new Set(), dir: p.combo % 2 ? -1 : 1, style: def.style, heavy: def.heavy || last, o: base };
      Sound.play(def.heavy || last ? 'heavy' : 'swing', { p: def.style === 'stab' ? 1.4 : def.style === 'punch' ? 0.8 : 1 });
      G.fx.push({ kind: 'slash', x: p.x, y: p.y - 8, ang, arc, reach: rch, t: 0, life: dur * 1.6, dir: p.swing.dir, style: def.style, heavy: def.heavy || last, follow: true, color: weaponTrail(w) });
      if (!echo) p.lunge = 0.08;
      break;
    }
    case 'thrust': {
      p.swing = { t: 0, dur: 0.14, ang, line: true, reach, width: def.width, dmg, kb: def.kb, hits: new Set(), style: 'thrust', o: base };
      Sound.play('swing', { p: 0.8 });
      G.fx.push({ kind: 'thrust', x: p.x, y: p.y - 8, ang, reach, t: 0, life: 0.18, follow: true, color: weaponTrail(w) });
      break;
    }
    case 'slam': {
      const tx = p.x + Math.cos(ang) * reach * 0.9, ty = p.y - 4 + Math.sin(ang) * reach * 0.9;
      p.swing = { t: 0, dur: 0.16, ang, arc: 1.6, reach, dmg: 0, kb: 0, hits: new Set(), style: 'slam', o: base };
      Sound.play('heavy');
      later(0.11, () => {
        if (G.p !== p) return;
        const R = def.aoe * s.reachMul;
        G.fx.push({ kind: 'crack', x: tx, y: ty, r: R, t: 0, life: 0.5 });
        ring(tx, ty, R, '#e8dcc8', 0.3, 3);
        burst(tx, ty, 10, ['#8a7a6a', '#c8bfa8'], { smax: 90 });
        Sound.play('slam', { v: 0.7 }); shake(4); hitstop(0.04);
        for (const e of G.ents) if (!e.dead && e.type !== 'ally' && e.spawnT <= 0 && Math.hypot(e.x - tx, e.y - ty) < R + e.r) damageEnemy(e, dmg, { ...base, ang: Math.atan2(e.y - ty, e.x - tx), kb: def.kb, stun: def.stun });
        breakPropsIn(tx, ty, R);
        cutProjectiles(tx, ty, R);
      });
      break;
    }
    case 'spin': {
      p.swing = { t: 0, dur: 0.24, ang, arc: TAU, reach, dmg, kb: def.kb, hits: new Set(), style: 'spin', o: base };
      Sound.play('heavy', { p: 1.2 });
      G.fx.push({ kind: 'spin', x: p.x, y: p.y - 7, reach, t: 0, life: 0.28, follow: true, ang, color: weaponTrail(w) });
      break;
    }
    case 'arrow': case 'bolt': case 'knives': case 'shard': case 'blast': case 'missile': case 'fireball': case 'venom': case 'boomerang': {
      const count = (def.count || 1) + s.projBonus;
      const spread = def.spread != null ? def.spread : 0.14;
      const total = def.style === 'knives' || def.style === 'blast' ? spread * (count - 1) / Math.max(1, (def.count || 1) - 1) : spread * (count - 1);
      for (let i = 0; i < count; i++) {
        let a = count > 1 ? ang - total / 2 + (total * i) / (count - 1) : ang;
        if (def.style === 'shard' || def.style === 'blast') a += rnd(-0.06, 0.06);
        const o = {
          ...base, team: 'p', x: hp.x, y: hp.y, ang: a, speed: def.speed * (def.style === 'blast' ? rnd(0.85, 1.1) : 1), dmg,
          life: (def.life || 0.8) * s.reachMul, kb: def.kb, pierce: (def.pierce || 0) + s.pierceBonus, bounce: s.bounce,
          kind: def.style, burn: def.burn, chill: def.chill, shock: def.shock, homing: def.homing, r: def.style === 'fireball' ? 4 : 3,
        };
        if (def.style === 'fireball') { o.aoe = def.aoe; o.color = '#ff9a3c'; o.light = '#ff9a3c'; o.pierce = 0; }
        if (def.style === 'venom') { o.pierce = 0; o.color = '#8fe05c'; o.light = '#8fe05c'; o.onEnd = (pr) => venomPool(pr.x, pr.y, def.aoe * s.reachMul, dmg); }
        if (def.style === 'boomerang') { o.boomerang = true; o.pierce = 99; if (i > 0) o.ang = ang + (i % 2 ? 0.35 : -0.35) * Math.ceil(i / 2); }
        if (def.style === 'missile') { o.color = '#c8a8ff'; o.light = '#b98cff'; }
        if (def.style === 'shard') { o.color = '#cfefff'; o.light = '#9fe0ff'; }
        spawnProj(o);
      }
      Sound.play({ arrow: 'arrow', bolt: 'arrow', knives: 'knife', shard: 'shard', blast: 'boom', missile: 'magic', fireball: 'fire', venom: 'venom', boomerang: 'swing' }[def.style], { p: def.style === 'bolt' ? 0.7 : 1, v: def.style === 'blast' ? 0.45 : 1 });
      if (def.style === 'blast') { shake(2.5); p.vx -= Math.cos(ang) * 60; p.vy -= Math.sin(ang) * 60; burst(hp.x, hp.y, 8, ['#ffd08a', '#8a8a8a'], { ang, spread: 0.5, smax: 120 }); }
      p.recoil = 0.08;
      break;
    }
    default:
      if (WEAPON_STYLE[def.style]) WEAPON_STYLE[def.style](p, def, w, dmg, ang, echo, hp, base);
      break;
    case 'chain': {
      const range = def.range * s.reachMul;
      let best = null, bd = 1e9;
      for (const e of G.ents) {
        if (e.dead || e.type === 'ally' || e.spawnT > 0) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        const off = Math.abs(angDiff(ang, Math.atan2(e.y - e.h / 2 - hp.y, e.x - hp.x)));
        if (d < range && off < 0.7 && lineOfSight(G.fl, hp.x, hp.y, e.x, e.y - 6)) { const sc = d + off * 80; if (sc < bd) { bd = sc; best = e; } }
      }
      Sound.play('zap');
      if (!best) { const ex = hp.x + Math.cos(ang) * range * 0.6, ey = hp.y + Math.sin(ang) * range * 0.6; zapFx(hp.x, hp.y, ex, ey, '#fff27a', 0.1); break; }
      const hit = new Set();
      let from = { x: hp.x, y: hp.y }, cur = best;
      const n = def.chains + s.projBonus;
      for (let k = 0; k < n && cur; k++) {
        hit.add(cur);
        zapFx(from.x, from.y, cur.x, cur.y - cur.h / 2);
        damageEnemy(cur, dmg * (k === 0 ? 1 : 0.8), { ...base, shock: def.shock, ang: Math.atan2(cur.y - from.y, cur.x - from.x), kb: def.kb });
        from = { x: cur.x, y: cur.y - cur.h / 2 };
        let nb = null, nd = 80;
        for (const e of G.ents) if (!e.dead && e.type !== 'ally' && e.spawnT <= 0 && !hit.has(e)) { const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < nd) { nd = d; nb = e; } }
        cur = nb;
      }
      break;
    }
  }
}
function weaponTrail(w) {
  const a = w.affixes || [];
  if (w.legend === 'inferno' || a.includes('flaming')) return '#ffb35e';
  if (w.legend === 'glacial' || a.includes('frost')) return '#bfe9ff';
  if (a.includes('venom')) return '#b8ff7a';
  if (w.legend === 'tempest' || a.includes('storm')) return '#fff27a';
  if (w.rar === 'legendary') return '#ffc070';
  return '#f4f0ea';
}
function updateSwing(p, dt) {
  const sw = p.swing;
  sw.t += dt;
  const active = sw.t <= sw.dur;
  if (active && sw.dmg > 0) {
    const ox = p.x, oy = p.y - 8;
    for (const e of G.ents) {
      if (e.dead || e.type === 'ally' || e.spawnT > 0 || e.hidden || (e.invuln && !e.boss) || sw.hits.has(e)) continue;
      const cp = closestPart(e, ox, oy), ex = cp.x, ey = cp.y;
      let inside = false;
      if (sw.line) {
        const cx = Math.cos(sw.ang), cy = Math.sin(sw.ang), rx = ex - ox, ry = ey - oy;
        const along = rx * cx + ry * cy, across = Math.abs(-rx * cy + ry * cx);
        inside = along > -4 && along < sw.reach + e.r && across < sw.width + e.r;
      } else {
        const d = Math.hypot(ex - ox, ey - oy);
        inside = d < sw.reach + e.r && (sw.arc >= TAU - 0.01 || Math.abs(angDiff(sw.ang, Math.atan2(ey - oy, ex - ox))) < sw.arc / 2 + (d < 10 ? 1 : 0));
      }
      if (!inside) continue;
      sw.hits.add(e);
      damageEnemy(e, sw.dmg, { ...sw.o, ang: Math.atan2(e.y - p.y, e.x - p.x), kb: sw.kb });
      if (sw.heavy) { hitstop(0.035); shake(2); }
    }
    // melee also splits props and cuts down small missiles
    if (G.room) for (const pid of G.room.props) {
      const pr = G.fl.props[pid];
      if (!pr.breakable || pr.broken) continue;
      const d = Math.hypot(pr.x - ox, pr.y - 5 - oy);
      if (d < sw.reach + 6 && (sw.line ? Math.abs(angDiff(sw.ang, Math.atan2(pr.y - 5 - oy, pr.x - ox))) < 0.4 : sw.arc >= TAU - 0.01 || Math.abs(angDiff(sw.ang, Math.atan2(pr.y - 5 - oy, pr.x - ox))) < sw.arc / 2)) breakProp(pr);
    }
    if (!sw.line && sw.style !== 'slam') cutProjectiles(ox, oy, sw.reach, sw.ang, sw.arc);
  }
  if (sw.t > sw.dur * 1.3) p.swing = null;
}
function cutProjectiles(x, y, r, ang, arc) {
  for (const pr of G.projs) {
    if (pr.team !== 'e' || pr.lob || pr.big) continue;
    const d = Math.hypot(pr.x - x, pr.y - y);
    if (d > r + 4) continue;
    if (arc != null && arc < TAU - 0.01 && Math.abs(angDiff(ang, Math.atan2(pr.y - y, pr.x - x))) > arc / 2) continue;
    pr.life = 0; pr.ended = true;
    burst(pr.x, pr.y, 4, ['#ffffff', '#ffd08a'], { smax: 60, glow: true });
    Sound.play('block', { p: 1.5, v: 0.4 });
  }
}
function venomPool(x, y, r, base) {
  G.fx.push({ kind: 'pool', x, y, r, t: 0, life: 3, team: 'p', poison: true, base, tick: 0, color: '#8fe05c' });
  burst(x, y, 8, ['#8fe05c', '#3f9a2a'], { smax: 60 });
  Sound.play('venom', { v: 0.5 });
}

/* ---------- abilities ---------- */
function castAbility(p, slot) {
  const a = p.abilities[slot];
  if (!a || p.dead) return;
  if (a.cd > 0) { if (!a.warned || G.t - a.warned > 0.6) { a.warned = G.t; Sound.play('deny', { v: 0.4 }); } return; }
  const def = ABILITY[a.id], s = p.stats, L = AB_LEVEL[a.lvl];
  const dmg = abilityDamage(def.dmg, a.lvl, p);
  const ang = p.aim, aimD = Math.min(Math.hypot(p.ax - p.x, p.ay - p.y + 8), 150);
  let tx = p.x + Math.cos(ang) * Math.max(40, aimD), ty = p.y + Math.sin(ang) * Math.max(40, aimD);
  // keep targets inside the room
  if (G.room) { tx = clamp(tx, (G.room.ix + 0.5) * TS, (G.room.ix + G.room.iw - 0.5) * TS); ty = clamp(ty, (G.room.iy + 0.5) * TS, (G.room.iy + G.room.ih - 0.5) * TS); }
  switch (a.id) {
    case 'bash': p.bashT = 0.24; p.bashA = ang; p.bashHit = new Set(); p.bashDmg = dmg; p.iframes = Math.max(p.iframes, 0.3); Sound.play('dash', { p: 0.7 }); Sound.play('heavy'); break;
    case 'rain': {
      Sound.play('arrow', { p: 0.6 });
      const R = 44, f = { kind: 'rain', x: tx, y: ty, r: R, t: 0, life: 1.6, acc: 0, update(f, dt) {
        f.acc += dt;
        while (f.acc > 0.06) {
          f.acc -= 0.06;
          const a2 = rnd(TAU), rr = Math.sqrt(Math.random()) * R, x = f.x + Math.cos(a2) * rr, y = f.y + Math.sin(a2) * rr;
          G.fx.push({ kind: 'arrowfall', x, y, t: 0, life: 0.18 });
          for (const e of G.ents) if (!e.dead && e.type !== 'ally' && e.spawnT <= 0 && Math.hypot(e.x - x, e.y - y) < e.r + 7) damageEnemy(e, dmg, { src: 'ability', noCrit: false, silent: true, kb: 10, ang: rnd(TAU) });
        }
      } };
      G.fx.push(f); break;
    }
    case 'meteor': {
      telegraph({ x: tx, y: ty, r: 44, life: 0.85, team: 'p', color: '#ff7a2a', fire: () => {
        explode(tx, ty, 46, dmg, { burn: 1, color: '#ff9a3c', shake: 7, vol: 1, crit: true });
        G.fx.push({ kind: 'firefield', x: tx, y: ty, r: 36, t: 0, life: 2.6, team: 'p', burn: true, base: dmg * 0.35, tick: 0 });
        hitstop(0.06);
      } });
      G.fx.push({ kind: 'meteor', x: tx, y: ty, t: 0, life: 0.85 });
      Sound.play('fire', { p: 0.6 });
      break;
    }
    case 'shadowstep': {
      const sx = p.x, sy = p.y;
      const d = Math.min(110, Math.max(60, aimD));
      let fx = p.x, fy = p.y;
      for (let k = 1; k <= 24; k++) {
        const nx = p.x + Math.cos(ang) * (d * k) / 24, ny = p.y + Math.sin(ang) * (d * k) / 24;
        if (hitsWall(G.fl, nx, ny, p.r, false)) break;
        fx = nx; fy = ny;
      }
      p.x = fx; p.y = fy; p.iframes = Math.max(p.iframes, 0.35); p.critNext = 2;
      burst(sx, sy - 6, 14, ['#3a2c4a', '#7a5aa8', '#1a1420'], { smax: 70, grav: -40, floor: false });
      burst(fx, fy - 6, 14, ['#3a2c4a', '#7a5aa8', '#ffe08a'], { smax: 70, grav: -40, floor: false });
      Sound.play('dash', { p: 1.5 });
      break;
    }
    case 'whirlwind': p.whirlT = 2.5 + (a.lvl - 1) * 0.5; p.whirlDmg = dmg; p.whirlTick = 0; break;
    case 'chain': {
      let cur = null, bd = 160;
      for (const e of G.ents) if (!e.dead && e.type !== 'ally' && e.spawnT <= 0) { const d = Math.hypot(e.x - p.x, e.y - p.y) + Math.abs(angDiff(ang, Math.atan2(e.y - p.y, e.x - p.x))) * 40; if (d < bd) { bd = d; cur = e; } }
      if (!cur) { Sound.play('deny'); return; }
      const hit = new Set(); let from = { x: p.x, y: p.y - 10 };
      for (let k = 0; k < 6 + a.lvl && cur; k++) {
        hit.add(cur);
        zapFx(from.x, from.y, cur.x, cur.y - cur.h / 2, '#fff8b0', 0.25);
        damageEnemy(cur, dmg, { src: 'ability', shock: 0.5, ang: Math.atan2(cur.y - from.y, cur.x - from.x), kb: 40, stun: 0.3 });
        from = { x: cur.x, y: cur.y - cur.h / 2 };
        let nb = null, nd = 90;
        for (const e of G.ents) if (!e.dead && e.type !== 'ally' && e.spawnT <= 0 && !hit.has(e)) { const d2 = Math.hypot(e.x - cur.x, e.y - cur.y); if (d2 < nd) { nd = d2; nb = e; } }
        cur = nb;
      }
      Sound.play('thunder', { v: 0.6 });
      break;
    }
    case 'legion': for (let k = 0; k < 2 + a.lvl; k++) spawnAlly('ally_skel', p.x + rnd(-14, 14), p.y + rnd(-14, 14), 15); Sound.play('bones'); break;
    case 'fireball': spawnProj({ team: 'p', src: 'ability', x: p.x, y: p.y - 8, ang, speed: 240, dmg, life: 1.2, kind: 'bigfire', aoe: 38, burn: 1, r: 6, color: '#ff9a3c', light: '#ff9a3c', kb: 120 }); Sound.play('fire', { p: 0.8 }); break;
    case 'nova': {
      ring(p.x, p.y - 4, 66, '#cfefff', 0.4, 3);
      burst(p.x, p.y - 4, 26, ['#e9f8ff', '#9fe0ff', '#ffffff'], { smax: 170, glow: true });
      Sound.play('ice');
      for (const e of G.ents) if (!e.dead && e.type !== 'ally' && e.spawnT <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < 66 + e.r) { damageEnemy(e, dmg, { src: 'ability', ang: Math.atan2(e.y - p.y, e.x - p.x), kb: 90 }); applyChill(e, true); }
      cutProjectiles(p.x, p.y - 6, 66);
      break;
    }
    case 'slam': {
      p.leapT = p.leapDur = 0.42; p.leapX0 = p.x; p.leapY0 = p.y;
      let lx = tx, ly = ty;
      if (hitsWall(G.fl, lx, ly, p.r, false)) { lx = p.x; ly = p.y; for (let k = 1; k <= 20; k++) { const nx = lerp(p.x, tx, k / 20), ny = lerp(p.y, ty, k / 20); if (hitsWall(G.fl, nx, ny, p.r, false)) break; lx = nx; ly = ny; } }
      p.leapX1 = lx; p.leapY1 = ly; p.iframes = Math.max(p.iframes, 0.5);
      p.leapLand = () => {
        explode(p.x, p.y, 48, dmg, { color: '#e8dcc8', parts: ['#8a7a6a', '#c8bfa8', '#5a4a3a'], sound: 'slam', shake: 7 });
        G.fx.push({ kind: 'crack', x: p.x, y: p.y, r: 46, t: 0, life: 0.7 });
        for (const e of G.ents) if (!e.dead && e.type !== 'ally' && Math.hypot(e.x - p.x, e.y - p.y) < 52) e.stunT = Math.max(e.stunT, 0.8);
        hitstop(0.06);
      };
      Sound.play('dash', { p: 0.6 });
      break;
    }
    case 'fan': for (let k = 0; k < 14; k++) spawnProj({ team: 'p', src: 'ability', x: p.x, y: p.y - 8, ang: (k * TAU) / 14 + p.aim, speed: 260, dmg, life: 0.55, kind: 'knives', pierce: 1, kb: 40 }); Sound.play('knife'); Sound.play('swing'); break;
    case 'heal': {
      const amt = Math.round(p.maxHp * [0, 0.25, 0.33, 0.42][a.lvl]);
      heal(p, amt); p.poisonT = p.burnT = p.slowT = p.chillT = 0;
      ring(p.x, p.y - 8, 30, '#ffe8a0', 0.5); burst(p.x, p.y - 8, 20, ['#ffe8a0', '#ffffff', '#7dff9a'], { smax: 60, grav: -60, floor: false, glow: true });
      Sound.play('heal');
      break;
    }
    case 'warp': G.warp = 4 + (a.lvl - 1); Sound.play('magic', { p: 0.5 }); ring(p.x, p.y - 8, 120, '#ffd35c', 0.6, 2); break;
    case 'turret': { const t = spawnAlly('turret', p.x + Math.cos(ang) * 14, p.y + Math.sin(ang) * 10, 10 + (a.lvl - 1) * 2); if (t) { t.dmg = dmg; t.rooted = true; } Sound.play('magic'); break; }
    case 'wolf': { const w = spawnAlly('ally_wolf', p.x + rnd(-10, 10), p.y + rnd(-10, 10), 18); if (w) w.dmg = dmg; Sound.play('growl'); break; }
    case 'cloud': G.fx.push({ kind: 'cloud', x: tx, y: ty, r: 42, t: 0, life: 5 + (a.lvl - 1), team: 'p', poison: true, base: 10 * (1 + 0.2 * G.fl.idx) * s.abDmg * (1 + 0.3 * (a.lvl - 1)), tick: 0 }); Sound.play('venom'); break;
    case 'barrier': p.barrierT = 2.5 + (a.lvl - 1) * 0.5; Sound.play('block', { p: 0.6 }); ring(p.x, p.y - 8, 20, '#9fe0ff', 0.4); break;
    default:
      if (ABILITY_CAST[a.id] && ABILITY_CAST[a.id](p, a, def, dmg, ang, tx, ty, aimD) === false) return;
  }
  a.cd = a.max = def.cd * L.cd * s.cdMul;
  if (s.echoCast && Math.random() < s.echoCast) { a.cd = 0.25; addText(p.x, p.y - 28, 'ECHO', '#b98cff'); }
  if (s.surge) p.surgeN = 3;
  G.run.stats.abilities++;
  runHooks('onAbility', p, a);
}

/* ---------- potions and swapping ---------- */
function drinkPotion(p) {
  if (p.potions <= 0) { Sound.play('deny', { v: 0.5 }); toast('No potions left'); return; }
  if (p.hp >= p.maxHp) { toast('Already at full health'); return; }
  p.potions--;
  heal(p, Math.round(p.maxHp * p.stats.potHeal));
  p.poisonT = p.burnT = 0;
  Sound.play('potion');
  runHooks('potion', p);
  burst(p.x, p.y - 10, 14, ['#ff8a8a', '#ffd0d0', '#ffffff'], { smax: 50, grav: -50, floor: false });
}
function swapWeapon(p) {
  if (p.beast) { if (!p.toldSwap) { p.toldSwap = true; toast('Beasts fight with tooth and claw. Walk over weapons to devour them.'); } return; }
  if (!p.weapons[1]) { toast('Only one weapon in hand'); return; }
  p.wi = 1 - p.wi; p.weapon = p.weapons[p.wi];
  p.swing = null; p.atkCd = Math.min(p.atkCd, 0.15);
  recalcStats(p);
  Sound.play('ui', { p: 0.8 });
  toast(weaponName(p.weapon), RARITY[p.weapon.rar].color);
}

function playerDie() {
  const p = G.p;
  if (p.dead) return;
  p.dead = true;
  runHooks('death', p);
  Sound.play('hurt', { p: 0.6 }); Sound.play('boom', { p: 0.5, v: 0.5 });
  burst(p.x, p.y - 8, 40, ['#e2434f', '#a8202a', '#ffffff'], { smax: 140, vz: 120 });
  G.slowmo = 1.4;
  Music.set(-1, 0);
  later(1.7, () => { if (G.p === p) endRun(false); }, true);
}

