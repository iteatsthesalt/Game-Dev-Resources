/* ============================================================
   Cinderdeep — chaos: omens, Chaos Mode, combos, explosive kegs,
   traps, mimics, the chaos shrine, secret rooms and gore that stays
   ============================================================ */
const hasOmen = (id) => !!(G.run && G.run.omens && G.run.omens.includes(id));
function rollOmens(run, idx) {
  const rng = new RNG(hash2(run.seed, idx * 977 + 31)), meta = CD.save.meta || {};
  const n = run.chaos ? 2 : idx > 0 && rng.chance(0.35 + 0.1 * (meta.chaos || 0)) ? 1 : 0;
  const pool = OMENS.map((o) => o.id), out = [];
  while (out.length < n) { const id = rng.pick(pool); if (!out.includes(id)) out.push(id); }
  return out;
}
function applyOmenGlobals() {
  const o = (id) => hasOmen(id);
  G.darkMul = o('darkness') ? 1.35 : 1;
  G.lightMul = o('darkness') ? 0.6 : 1;
  G.darkTint = o('bloodmoon') ? 'rgb(46,4,10)' : null;
  G.omenXp = (o('darkness') ? 1.5 : 1) * (o('necropolis') ? 1.3 : 1) * (o('bloodmoon') ? 1.5 : 1);
  G.omenHearts = o('youth') ? 2.5 : 1;
  G.omenMimic = o('treasure') ? 0.25 : null;
}
function clearOmenGlobals() { G.darkMul = 1; G.lightMul = 1; G.darkTint = null; G.omenXp = 1; G.omenHearts = 1; G.omenMimic = null; }
hook('preFloor', (run, idx) => { run.omens = rollOmens(run, idx); applyOmenGlobals(); G.combo = { n: 0, t: 0, max: G.combo ? G.combo.max : 0 }; });
hook('runStart', (run, p) => {
  G.combo = { n: 0, t: 0, max: 0 };
  if (CD.save.meta.heirloom) { const id = randomRelic(run.rng); if (id) gainRelic(p, id); }
});
hook('onFloor', (idx) => {
  const run = G.run;
  if (run.omens && run.omens.length) later(2.9, () => {
    const list = run.omens.map((id) => OMEN[id]);
    banner(list.map((o) => o.name).join(' + '), list.length > 1 ? 'two omens hang over this floor' : list[0].desc, 3);
    Sound.play('omen');
    for (const o of list) toast(`${o.name}: ${o.desc}`, o.color);
  });
  if (G.p && G.p.stats.atlas) revealFloor();
});
const _startDemo = startDemo;
startDemo = function () { clearOmenGlobals(); return _startDemo(); };
hook('stats', (s, p) => {
  if (hasOmen('haste')) s.spdMul += 0.25;
  if (hasOmen('goldrush')) s.goldMul += 2;
  if (hasOmen('youth')) s.regen += 0.5;
  if (G.run && G.run.chaos) s.luck += 3;
});
hook('spawned', (e) => {
  if (e.type !== 'enemy' || !G.run || !G.run.omens) return;
  if (hasOmen('bloodmoon')) { e.dmg *= 1.25; e.spd *= 1.15; e.gold *= 1.5; }
  if (hasOmen('swarm')) e.maxHp *= 0.65;
  if (hasOmen('giants')) { e.maxHp *= 1.6; e.scale = (e.scale || 1) * 1.35; e.r *= 1.2; e.h *= 1.3; e.gold *= 1.5; e.giant = true; }
  if (hasOmen('haste')) e.spd *= 1.25;
  if (hasOmen('goldrush')) e.gold *= 3;
});
hook('dmgMul', () => (hasOmen('glass') ? 2 : 1));
hook('preHurt', (dmg) => (hasOmen('glass') ? dmg * 2 : dmg));
hook('onKill', (e) => {
  if (e.type !== 'enemy' || e.boss) return;
  if (hasOmen('volatile') && !e.summoned) {
    const x = e.x, y = e.y, d = 14 + G.fl.idx * 3, pd = e.dmg * 0.6;
    telegraph({ x, y, r: 26, life: 0.35, color: '#ff7a2a', fire: () => explode(x, y, 26, d, { hurtsPlayer: true, pdmg: pd, color: '#ff9a3c', vol: 0.4, shake: 2, src: 'keg' }) });
  }
  if (hasOmen('bullethell') && !e.summoned) { const n = e.eliteMods ? 10 : 6, off = rnd(TAU); for (let k = 0; k < n; k++) spawnProj({ team: 'e', x: e.x, y: e.y - 6, ang: off + (k * TAU) / n, speed: 85, dmg: e.dmg * 0.6, life: 2.6, kind: 'eorb', color: '#c873ff', light: '#c873ff', r: 3 }); }
});
hook('onRoomClear', (r) => {
  if (hasOmen('treasure') && r.type !== 'boss') { const c = randomFloorPoint(r, null, null, 0, null, true); spawnChest(c.x, c.y, Math.random() < 0.3 ? 'silver' : 'wood', r); }
});

/* ---------- the combo meter ---------- */
const COMBO_TIERS = [[5, 'Killing Spree'], [10, 'Rampage'], [20, 'Massacre'], [35, 'Carnage'], [50, 'Annihilation'], [75, 'Apocalypse'], [100, 'GODLIKE']];
const comboWindow = () => 2.5 + 0.5 * ((CD.save.meta && CD.save.meta.combo) || 0);
hook('onKill', (e) => {
  if (e.type !== 'enemy' || !G.combo) return;
  const C = G.combo;
  C.n++; C.t = comboWindow(); C.max = Math.max(C.max || 0, C.n);
  const fs = CD.save.fs; fs.maxCombo = Math.max(fs.maxCombo || 0, C.n);
  const tier = COMBO_TIERS.findIndex(([n]) => n === C.n);
  if (tier >= 0) announce(COMBO_TIERS[tier][1], `${C.n} kill combo`, tier);
});
hook('update', (dt) => {
  const C = G.combo;
  if (!C || C.n <= 0) return;
  C.t -= dt;
  if (C.t <= 0) { if (C.n >= 5) toast(`Combo ended at ×${C.n}`, '#ffd35c'); C.n = 0; }
});
function announce(title, sub, tier = 0) {
  const el = $('announce');
  if (!el) return;
  el.querySelector('b').textContent = title;
  el.querySelector('small').textContent = sub || '';
  el.style.setProperty('--hue', String((tier * 47 + 10) % 360));
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(announce._t); announce._t = setTimeout(() => el.classList.remove('show'), 1600);
  Sound.play('stinger', { p: 1 + tier * 0.06 }); shake(2 + tier * 0.6);
}

/* ---------- furnishing: kegs, traps, chaos shrines, secret rooms ---------- */
function freeTiles(fl, r, rng, margin = 1, doorGap = 3) {
  const out = [], entries = doorEntries(fl, r), W = fl.W;
  for (let y = r.iy + margin; y < r.iy + r.ih - margin; y++) for (let x = r.ix + margin; x < r.ix + r.iw - margin; x++) {
    if (fl.tiles[y * W + x] !== TILE.FLOOR) continue;
    if (entries.some(([ex, ey]) => Math.abs(ex - x) + Math.abs(ey - y) <= doorGap)) continue;
    if (propAt(fl, x, y)) continue;
    out.push([x, y]);
  }
  return rng.shuffle(out);
}
hook('furnish', (fl, r, rng, run) => {
  const fighting = ['combat', 'elite', 'exit', 'challenge'].includes(r.type), act = fl.info.act.id, chaos = run && run.chaos;
  if (fighting) {
    // explosive kegs
    if (rng.chance(chaos ? 1 : 0.3)) { const spots = freeTiles(fl, r, rng); const n = chaos ? rng.int(2, 4) : rng.int(1, 3); for (let k = 0; k < n && k < spots.length; k++) addProp(fl, r, 'keg', spots[k][0], spots[k][1], { breakable: true, explosive: true, solid: true, r: 6 }); }
    // traps
    if (rng.chance(Math.min(0.6, 0.3 + fl.idx * 0.03)) && r.type !== 'exit') {
      if (act === 'ossuary') {
        const fy = r.y + 1, xs = [];
        for (let x = r.ix + 2; x < r.ix + r.iw - 2; x++) if (fl.tiles[fy * fl.W + x] === TILE.FACE && fl.doorAt[fy * fl.W + x] < 0 && fl.doorAt[fy * fl.W + x - 1] < 0 && fl.doorAt[fy * fl.W + x + 1] < 0 && !fl.lights.some((l) => l.room === r.id && Math.abs(l.x - (x + 0.5) * TS) < 12)) xs.push(x);
        rng.shuffle(xs);
        for (let k = 0; k < Math.min(3, xs.length); k++) addProp(fl, r, 'darttrap', xs[k], fy, { decal: true, trap: 'dart', phase: k * 0.7 });
      } else if (act === 'core' || act === 'grotto') {
        const spots = freeTiles(fl, r, rng, 1, 2);
        for (let k = 0; k < Math.min(rng.int(2, 4), spots.length); k++) addProp(fl, r, 'vent', spots[k][0], spots[k][1], { decal: true, trap: act === 'core' ? 'flame' : 'spore', v: act === 'core' ? 0 : 1, phase: k * 0.9 });
      } else r.icicles = true;
    }
    if (hasOmenFor(run, 'goldrush')) { const spots = freeTiles(fl, r, rng, 0, 2); for (let k = 0; k < Math.min(3, spots.length); k++) addProp(fl, r, 'pot', spots[k][0], spots[k][1], { breakable: true, hp: 1, gold: true }); }
  }
  if (r.type === 'shrine' && rng.chance(0.35)) { const sh = r.props.map((i) => fl.props[i]).find((q) => q.shrine); if (sh) { sh.shrine = 'chaos'; sh.v = 3; sh.light = { r: 60, c: '#ff4ad0' }; } }
  if (r.type === 'secret') furnishSecret(fl, r, rng);
});
const hasOmenFor = (run, id) => !!(run && run.omens && run.omens.includes(id));
function furnishSecret(fl, r, rng) {
  const cx = r.ix + Math.floor(r.iw / 2), cy = r.iy + Math.floor(r.ih / 2);
  r.secretKind = rng.pick(['vault', 'vault', 'altar', 'cache']);
  addProp(fl, r, 'rug', cx, cy, { decal: true });
  addProp(fl, r, 'banner', cx - 3, r.y + 1, { decal: true });
  addProp(fl, r, 'banner', cx + 3, r.y + 1, { decal: true });
  for (const dx of [-5, 5]) addProp(fl, r, 'candles', cx + dx, cy - 2, { light: { r: 44, c: '#ffd35c' } });
  if (r.secretKind === 'vault') { addProp(fl, r, 'chest', cx - 2, cy, { chest: 'gold', solid: true, r: 7 }); addProp(fl, r, 'chest', cx + 2, cy, { chest: 'silver', solid: true, r: 7, unlocked: true }); }
  else if (r.secretKind === 'altar') addProp(fl, r, 'altar', cx, cy, { relicChoice: true, used: false, solid: true, r: 9, light: { r: 60, c: '#ff6f9c' } });
  else { addProp(fl, r, 'shrine', cx - 2, cy - 1, { shrine: 'chaos', v: 3, solid: true, r: 6, used: false, light: { r: 60, c: '#ff4ad0' } }); addProp(fl, r, 'fountain', cx + 3, cy + 1, { fountain: true, used: false, solid: true, r: 9, light: { r: 50, c: '#9ad8f8' } }); }
}

/* ---------- kegs go up, and take their neighbours with them ---------- */
function kegBlast(pr) {
  burst(pr.x, pr.y - 6, 10, ['#a8321e', '#3a3a42', '#ffd08a'], { smax: 100 });
  const fs = CD.save.fs; fs.kegs = (fs.kegs || 0) + 1;
  later(0.07 + Math.random() * 0.08, () => {
    explode(pr.x, pr.y - 4, 36, 30 * (1 + 0.2 * G.fl.idx), { hurtsPlayer: true, pdmg: 9 + G.fl.idx * 2, color: '#ff7a2a', shake: 6, vol: 0.9, src: 'keg', burn: 0.6 });
    G.fx.push({ kind: 'firefield', x: pr.x, y: pr.y, r: 20, t: 0, life: 2.4, team: 'p', burn: true, base: 10 * (1 + 0.2 * G.fl.idx), tick: 0 });
    flashLight(pr.x, pr.y - 6, 90, '#ffb35e', 0.3);
  }, true);
}
const _breakProp = breakProp;
breakProp = function (pr) {
  const was = pr.broken;
  _breakProp(pr);
  if (!was && pr.gold) dropPickup('gold', pr.x, pr.y, 3 + G.fl.idx);
};

/* ---------- traps hurt anyone who stands in the wrong place ---------- */
hook('update', (dt) => {
  const r = G.room, p = G.p;
  if (!r || !G.combat || r.type === 'boss' || !p) return;
  const sc = 1 + 0.15 * G.fl.idx;
  for (const pid of r.props) {
    const pr = G.fl.props[pid];
    if (!pr.trap) continue;
    pr.trapT = (pr.trapT ?? 1.2 + (pr.phase || 0)) - dt;
    if (pr.trap === 'dart') {
      if (pr.trapT <= 0) { pr.trapT = 2.2; spawnProj({ team: 'e', trap: true, x: pr.x + rnd(-3, 3), y: pr.y + 8, ang: Math.PI / 2 + rnd(-0.05, 0.05), speed: 175, dmg: 7 * sc, life: 1.6, kind: 'dart', r: 2 }); Sound.play('dart', { x: pr.x }); }
    } else {
      pr.armed = pr.trapT < 0.7;
      if (pr.trapT <= 0) {
        pr.trapT = 3 + rnd(-0.3, 0.3);
        const fire = pr.trap === 'flame';
        burst(pr.x, pr.y - 6, 18, fire ? ['#fff3c0', '#ffb35e', '#ff7a2a'] : ['#d8ff9a', '#8fe05c'], { smax: 60, vz: 200, grav: 60, glow: fire });
        flashLight(pr.x, pr.y - 10, 40, fire ? '#ff9a3c' : '#8fe05c', 0.4);
        Sound.play(fire ? 'fire' : 'venom', { p: 0.7, v: 0.5, x: pr.x });
        if (!p.dead && Math.hypot(p.x - pr.x, p.y - pr.y) < 15) { const res = hurtPlayer(9 * sc, {}); if (res === HIT.HIT) { if (fire) { if (!p.stats.fireproof) p.burnT = Math.max(p.burnT, 2); } else p.poisonT = Math.max(p.poisonT, 3); } }
        for (const e of G.ents) if (!e.dead && e.type === 'enemy' && e.spawnT <= 0 && Math.hypot(e.x - pr.x, e.y - pr.y) < 15 + e.r) { damageEnemy(e, 14 * sc, { src: 'trap', noCrit: true, noProc: true, color: '#ffb35e' }); if (fire) applyBurn(e, 14 * sc); else applyPoison(e, 14 * sc); }
        if (!fire) G.fx.push({ kind: 'cloud', x: pr.x, y: pr.y - 4, r: 20, t: 0, life: 1.6, team: 'e', poison: true, color: '#c8ff6a', tick: 0.3 });
      }
    }
  }
  if (r.icicles) {
    r.iceT = (r.iceT ?? 2) - dt;
    if (r.iceT <= 0) {
      r.iceT = 2.6;
      const q = Math.random() < 0.5 ? { x: p.x + rnd(-24, 24), y: p.y + rnd(-16, 16) } : randomFloorPoint(r, null, null, 0);
      const x = q.x, y = q.y;
      telegraph({ x, y, r: 12, life: 0.85, color: '#cfefff', fire: () => {
        G.fx.push({ kind: 'icicle', x, y, t: 0, life: 0.8 }); Sound.play('shard', { v: 0.4, x });
        if (Math.hypot(G.p.x - x, G.p.y - y) < 12 + G.p.r && hurtPlayer(8 * sc, {}) === HIT.HIT) G.p.chillT = 1.5;
        for (const e of G.ents) if (!e.dead && e.type === 'enemy' && Math.hypot(e.x - x, e.y - y) < 12 + e.r) { damageEnemy(e, 16 * sc, { src: 'trap', noCrit: true, noProc: true, color: '#cfefff' }); applyChill(e); }
      } });
    }
  }
  // darts from the walls strike monsters too
  for (const pr of G.projs) {
    if (!pr.trap || pr.ended) continue;
    for (const e of G.ents) if (!e.dead && e.type === 'enemy' && e.spawnT <= 0 && Math.hypot(e.x - pr.x, e.y - e.h / 2 - pr.y) < e.r + 3) { damageEnemy(e, pr.dmg * 1.5, { src: 'trap', noCrit: true, noProc: true, ang: Math.PI / 2, kb: 40 }); pr.t = pr.life; break; }
  }
});
hook('renderWorld', (g, cx, cy) => {
  const r = G.room;
  if (!r || !G.combat) return;
  for (const pid of r.props) {
    const pr = G.fl.props[pid];
    if (pr.trap !== 'flame' && pr.trap !== 'spore') continue;
    if (pr.armed && Math.floor(G.t * 10) % 2) { g.fillStyle = pr.trap === 'flame' ? 'rgba(255,140,60,0.55)' : 'rgba(180,255,110,0.5)'; g.beginPath(); g.ellipse(Math.round(pr.x - cx), Math.round(pr.y - cy), 7, 4, 0, 0, TAU); g.fill(); }
  }
});

/* ---------- mimics ---------- */
function mimicWake(pr) {
  const r = G.fl.rooms[pr.room];
  pr.opened = true; pr.broken = true; pr.solid = false;
  const e = spawnEnemy('mimic', pr.x, pr.y, { room: r.id, noSpawnAnim: true });
  if (e) { e.mimicTier = pr.chest; e.st = 'rest'; e.stT = 0.5; }
  banner('Mimic!', 'that chest has teeth', 1.6); Sound.play('mimic'); shake(5);
  burst(pr.x, pr.y - 6, 16, ['#8a5a32', '#ffffff', '#c43a5a'], { smax: 100 });
  if (!G.combat) { r.cleared = false; G.combat = true; G.waveIdx = Math.max(0, (r.waves || []).length - 1); setDoors(r, false); Music.set(G.fl.actIdx, 1); }
}
hook('onKill', (e) => {
  if (e.kind !== 'mimic') return;
  spawnItem(rollLoot(G.run.rng, e.mimicTier === 'silver' ? 'gold' : 'silver'), e.x, e.y);
  dropPickup('gold', e.x, e.y, 10 + G.fl.idx * 3);
  const fs = CD.save.fs; fs.mimics = (fs.mimics || 0) + 1;
});

/* ---------- the chaos shrine: spin it and see ---------- */
const CHAOS_OUTCOMES = [
  { id: 'fortune', w: 14, name: 'Fortune', run(pr) { const n = 30 + G.fl.idx * 8; for (let k = 0; k < Math.ceil(n / 5); k++) dropPickup('gold', pr.x, pr.y + 8, 5); return 'Gold pours out of the stone'; } },
  { id: 'arsenal', w: 12, name: 'Arsenal', run(pr) { spawnItem({ type: 'weapon', w: randomWeapon(G.run.rng, 'rare', 2) }, pr.x, pr.y + 16); return 'A weapon falls from nowhere'; } },
  { id: 'relic', w: 8, name: 'Relic', run(pr) { const id = randomRelic(G.run.rng); if (id) spawnItem({ type: 'relic', id }, pr.x, pr.y + 16); return 'Something old and powerful appears'; } },
  { id: 'wisdom', w: 12, name: 'Wisdom', run() { G.p.pendingLevels += 2; return 'Two lessons, free of charge'; } },
  { id: 'ambush', w: 12, name: 'Ambush', run(pr) { const r = G.room; for (let k = 0; k < 2; k++) { const q = randomFloorPoint(r, G.p.x, G.p.y, 60); spawnEnemy(rndPick(G.fl.info.act.elites), q.x, q.y, { room: r.id, elite: true }); } r.cleared = false; G.combat = true; G.waveIdx = Math.max(0, (r.waves || []).length - 1); setDoors(r, false); Music.set(G.fl.actIdx, 1); return 'It was a trap. Of course it was a trap'; } },
  { id: 'blood', w: 9, name: 'Blood Price', run() { const p = G.p; p.hp = Math.max(1, p.hp - p.maxHp * 0.25); later(0.4, () => offerSkills(['rare', 'epic'], 'The shrine took blood. Choose a gift.')); return 'It drinks, then it gives'; } },
  { id: 'transmute', w: 9, name: 'Transmute', run() { const p = G.p; if (p.beast) { p.essence = (p.essence || 0) + 0.15; recalcStats(p); return 'Your essence surges (+15% damage)'; } const w = p.weapon; if (w.rar === 'evolved' || WEAPON[w.id].evolved) { w.lvl = Math.min(5, (w.lvl || 0) + 1); return 'Your weapon tempers itself'; } const ri = Math.min(RARITY_ORDER.length - 1, RARITY_ORDER.indexOf(w.rar) + 1); const nw = randomWeapon(G.run.rng, RARITY_ORDER[ri]); nw.rar = RARITY_ORDER[ri]; p.weapons[p.wi] = nw; p.weapon = nw; recalcStats(p); return `Your weapon becomes a ${weaponName(nw)}`; } },
  { id: 'souls', w: 10, name: 'Soul Spring', run(pr) { for (let k = 0; k < 4; k++) dropPickup('soul', pr.x, pr.y + 8, 5); return 'Souls spill out, still warm'; } },
  { id: 'meteors', w: 8, name: 'Starfall', run(pr) { const r = G.room; for (let k = 0; k < 10; k++) { const q = randomFloorPoint(r, null, null, 0); later(k * 0.12, () => { telegraph({ x: q.x, y: q.y, r: 22, life: 0.9, color: '#ff4ad0', fire: () => explode(q.x, q.y, 22, 40 * (1 + 0.2 * G.fl.idx), { hurtsPlayer: true, pdmg: 8, color: '#ff8ad8', vol: 0.4 }) }); G.fx.push({ kind: 'meteor', x: q.x, y: q.y, t: 0, life: 0.9 }); }); } later(1.8, () => spawnChest(pr.x, pr.y + 22, 'silver', r)); return 'The sky falls in. Something falls with it'; } },
  { id: 'youth', w: 7, name: 'Renewal', run() { const p = G.p; heal(p, p.maxHp); p.potions = p.stats.potMax; return 'Fully restored, potions refilled'; } },
];
function chaosShrine(pr) {
  pr.used = true;
  const o = G.run.rng.weighted(CHAOS_OUTCOMES);
  Sound.play('chaos');
  ring(pr.x, pr.y - 10, 50, '#ff4ad0', 0.6, 3);
  burst(pr.x, pr.y - 14, 30, ['#ff4ad0', '#7fc8ff', '#fff27a', '#7dff9a'], { smax: 130, glow: true });
  const msg = o.run(pr);
  banner(o.name, msg, 2.4);
}

/* ---------- secret rooms behind cracked walls ---------- */
function revealSecretAt(x, y, rad) {
  if (!G.fl || !G.fl.doors) return;
  const r = G.room;
  if (!r) return;
  for (const di of r.doors) { const d = G.fl.doors[di]; if (d.hidden && Math.hypot(d.px - x, d.py - y) < rad + 14) revealDoor(d); }
}
function revealDoor(d) {
  d.hidden = false; d.open = true;
  const fl = G.fl;
  fl.rooms[d.a].seen = true; fl.rooms[d.b].seen = true;
  burst(d.px, d.py, 24, d.kind === 'dmt' ? ['#ff6f9c', '#7fc8ff', '#fff27a', '#7dff9a', '#c873ff'] : ['#8a7a6a', '#5a4a3a', '#c8bfa8'], { smax: 110, glow: d.kind === 'dmt' });
  shake(3);
  if (d.kind === 'dmt') { Sound.play('breakthrough'); toast('The wall dissolves into color', '#ff8ad8'); }
  else { Sound.play('secret'); toast('A secret passage!', '#ffd35c'); const fs = CD.save.fs; fs.secrets = (fs.secrets || 0) + 1; }
}
function revealFloor() {
  if (!G.fl || !G.fl.rooms) return;
  for (const r of G.fl.rooms) r.seen = true;
}

/* ---------- gore and scorch marks that stay for the floor ---------- */
function roomDecal(x, y, fn) {
  if (!G.fl || !G.fl.roomOf) return;
  const rid = roomAtPx(x, y);
  if (rid < 0) return;
  const r = G.fl.rooms[rid], c = R.roomCache.get(r.id);
  if (!c || (r.decals || 0) > 700) return;
  r.decals = (r.decals || 0) + 1;
  const g = c.getContext('2d');
  g.save(); g.beginPath(); g.rect((r.ix - r.x) * TS, (r.iy - r.y) * TS, r.iw * TS, r.ih * TS); g.clip();
  fn(g, x - r.x * TS, y - r.y * TS);
  g.restore();
}
function scorch(x, y, rad) {
  if (CD.settings.lowFx || rad < 10) return;
  roomDecal(x, y, (g, lx, ly) => {
    const gr = g.createRadialGradient(lx, ly, 0, lx, ly, rad * 0.85);
    gr.addColorStop(0, 'rgba(12,6,6,0.42)'); gr.addColorStop(0.6, 'rgba(12,6,6,0.2)'); gr.addColorStop(1, 'rgba(12,6,6,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(lx, ly, rad * 0.85, rad * 0.5, 0, 0, TAU); g.fill();
  });
}
function splat(x, y, cols, n, spread = 10) {
  roomDecal(x, y, (g, lx, ly) => {
    for (let i = 0; i < n; i++) { const a = rnd(TAU), d = rnd(0, spread), s = rndPick([1, 1, 2, 2, 3]); g.fillStyle = rgbaStr(rndPick(cols), rnd(0.35, 0.75)); g.fillRect(Math.round(lx + Math.cos(a) * d), Math.round(ly + Math.sin(a) * d * 0.6), s, s); }
  });
}
hook('onKill', (e) => {
  if (e.type !== 'enemy' || CD.settings.lowFx) return;
  const cols = e.blood || ['#e2434f', '#a8202a'];
  splat(e.x, e.y, cols, e.big || e.boss ? 26 : 12, e.big || e.boss ? 18 : 10);
  for (let i = 0; i < (e.big ? 6 : 3); i++) {
    const a = rnd(TAU), sp = rnd(50, 130);
    G.parts.push({ x: e.x, y: e.y, z: 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(60, 140), grav: 300, drag: 1.4, life: rnd(1.2, 2), max: 2, color: rndPick(cols), size: rndPick([2, 3]), floor: true, gib: true });
  }
});
hook('update', () => {
  for (const q of G.parts) if (q.gib && !q.stamped && q.life < 0.12) { q.stamped = true; splat(q.x, q.y, [q.color], 3, 2); }
});

/* ---------- planSpawns: omens and Chaos Mode change the crowd ---------- */
function crowdMul(run) { return (hasOmenFor(run, 'swarm') ? 1.6 : 1) * (run && run.chaos ? 1.3 : 1); }

