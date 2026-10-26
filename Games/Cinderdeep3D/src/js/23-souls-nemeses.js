/* ============================================================
   Cinderdeep — souls, class levels, DMT zones and nemeses.
   Monsters drop souls. Carried souls are at risk; bank them in a
   DMT zone to raise your character's permanent class level. Die
   with souls on you and your killer eats them, becoming a Chaos
   Beast that hunts you in later runs and grows every time it wins.
   ============================================================ */

/* ---------- class levels ---------- */
const soulsFor = (l) => Math.round(10 + 5 * l + 0.6 * l * l);
const MAX_CLASS_LEVEL = 100;

/* ---------- souls in a run ---------- */
hook('runStart', (run) => { run.souls = 0; run.soulsBanked = 0; run.nemSeen = []; });
hook('saveRun', (c, run) => { c.ext = { ...(c.ext || {}), souls: run.souls || 0, soulsBanked: run.soulsBanked || 0, nemSeen: run.nemSeen || [] }; });
hook('loadRun', (c, run) => { const x = c.ext || {}; run.souls = x.souls || 0; run.soulsBanked = x.soulsBanked || 0; run.nemSeen = x.nemSeen || []; });
function soulMul() { const p = G.p; return (1 + 0.05 * (G.run ? G.run.heat : 0)) * (1 + ((p && p.stats.soulGain) || 0)); }
function dropSouls(x, y, n) {
  n = Math.round(n);
  while (n > 0) { const v = n >= 10 ? 10 : 1; n -= v; dropPickup(v >= 10 ? 'soulbig' : 'soul', x, y, v); if (G.picks.length > 320) break; }
}
hook('onKill', (e) => {
  if (e.type !== 'enemy' || e.summoned || e.nem) return;
  let n = e.boss ? 30 + 12 * G.fl.info.actIdx : e.eliteMods ? 5 : e.mini ? (Math.random() < 0.2 ? 1 : 0) : Math.random() < 0.55 ? 1 : 0;
  n *= soulMul();
  n = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
  if (n > 0) dropSouls(e.x, e.y, n);
});
const _takePickup = takePickup;
takePickup = function (k) {
  if (k.kind !== 'soul' && k.kind !== 'soulbig') return _takePickup(k);
  G.run.souls = (G.run.souls || 0) + k.value;
  Sound.play('soul', { p: 1 + Math.min(0.5, (G.p.soulCombo || 0) * 0.04) });
  G.p.soulCombo = (G.p.soulCombo || 0) + 1; G.p.soulComboT = 0.7;
  addText(k.x, k.y - 8, '+' + k.value, '#9ff6ff');
};
hook('update', (dt) => { const p = G.p; if (p && p.soulComboT > 0) { p.soulComboT -= dt; if (p.soulComboT <= 0) p.soulCombo = 0; } });
hook('renderTop', (g, cx, cy) => {
  if (CD.settings.lowFx) return;
  g.globalCompositeOperation = 'lighter';
  const tex = LightTex.get('#7fe8ff', 0.3);
  for (const k of G.picks) if (k.kind === 'soul' || k.kind === 'soulbig') { const r2 = k.kind === 'soulbig' ? 14 : 9; g.globalAlpha = 0.45 + Math.sin(G.t * 6 + k.x) * 0.15; g.drawImage(tex, Math.round(k.x - cx - r2), Math.round(k.y - cy - k.z - 6 - r2), r2 * 2, r2 * 2); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
});

/* ============================================================
   DMT zones
   ============================================================ */
const ELF_LINES = ['WELCOME BACK', 'YOU HAVE BEEN HERE BEFORE', 'LOOK. LOOK AT IT.', 'WE MADE THIS FOR YOU', 'GIVE US THE SOULS', 'EVERYTHING IS FINE', 'YOU ARE DOING GREAT', 'IT IS ALL ONE THING', 'HELLO AGAIN', 'THE TREE REMEMBERS YOU', 'WE KNEW YOU WOULD COME', 'DO NOT BE AFRAID', 'HAVE YOU TRIED BEING A BEAST'];
hook('furnish', (fl, r, rng) => {
  if (r.type !== 'dmt') return;
  fl.lights = fl.lights.filter((l) => l.room !== r.id);
  const cx = r.ix + Math.floor(r.iw / 2), cy = r.iy + Math.floor(r.ih / 2);
  addProp(fl, r, 'soulwell', cx, cy, { soulwell: true, solid: true, r: 10, light: { r: 90, c: '#ff8ad8' } });
  for (const [dx, dy] of [[-6, -3], [6, -3], [-6, 3], [6, 3]]) addProp(fl, r, 'shardtotem', cx + dx, cy + dy, { solid: true, r: 5, light: { r: 40, c: rng.pick(['#7fc8ff', '#7dff9a', '#ffd35c', '#ff6f9c', '#c873ff']) } });
  fl.lights.push({ kind: 'dmt', x: (cx + 0.5) * TS, y: (cy + 0.5) * TS, room: r.id, r: 220, c: '#ffd8ff', flick: 0 });
});
hook('onRoomEnter', (r, prev) => {
  if (r.type === 'dmt') {
    if (!r.elves) r.elves = Array.from({ length: 5 }, (_, i) => { const q = randomFloorPoint(r, null, null, 0); return { x: q.x, y: q.y, vx: 0, vy: 0, i, t: rnd(3), say: null, sayT: 0 }; });
    if (!r.greeted) { r.greeted = true; banner('DMT Zone', 'the walls are breathing', 2.8); Sound.play('breakthrough'); const fs = CD.save.fs; fs.dmtFound = (fs.dmtFound || 0) + 1; }
    Music.theme('dmt');
  } else if (prev && prev.type === 'dmt') Music.set(G.fl.actIdx, G.combat ? 1 : 0);
});
// walk close to a breathing wall and it opens
hook('update', (dt) => {
  const p = G.p, r = G.room;
  if (!p || !r || !G.fl.doors) return;
  for (const di of r.doors) {
    const d = G.fl.doors[di];
    if (!d.hidden || d.kind !== 'dmt') continue;
    const dd = Math.hypot(p.x - d.px, p.y - d.py);
    if (dd < 140 && Math.random() < 0.5) {
      const a = rnd(TAU);
      G.parts.push({ x: d.px + rnd(-8, 8), y: d.py + rnd(-8, 8), z: 2, vx: Math.cos(a) * 12, vy: Math.sin(a) * 8, vz: 0, grav: 0, drag: 0.5, life: 1.2, max: 1.2, color: `hsl(${(G.t * 120 + rnd(120)) % 360},90%,65%)`, size: 1, glow: true, floor: false });
      if (!d.hinted && dd < 110) { d.hinted = true; toast('The air shimmers here...', '#ff8ad8'); Sound.play('shimmer'); }
    }
    if (dd < 44) revealDoor(d);
  }
});
// the elves wander, bob and say strange things
hook('update', (dt) => {
  const r = G.room;
  if (!r || r.type !== 'dmt' || !r.elves) return;
  const p = G.p;
  for (const el of r.elves) {
    el.t += dt;
    if (Math.random() < dt * 0.8) { const a = rnd(TAU); el.vx = Math.cos(a) * 26; el.vy = Math.sin(a) * 18; }
    const nx = el.x + el.vx * dt, ny = el.y + el.vy * dt;
    if (insideInterior(r, nx, ny, 1)) { el.x = nx; el.y = ny; } else { el.vx *= -1; el.vy *= -1; }
    if (el.sayT > 0) el.sayT -= dt;
    else if (Math.hypot(p.x - el.x, p.y - el.y) < 60 && Math.random() < dt * 0.35) { el.say = rndPick(ELF_LINES); el.sayT = 2.4; Sound.play('elf', { p: 0.9 + el.i * 0.08 }); }
  }
});
hook('renderFloor', (g, cx, cy, vis) => {
  for (const r of vis) {
    if (r.type !== 'dmt') continue;
    const mx = (r.ix + r.iw / 2) * TS, my = (r.iy + r.ih / 2) * TS, t = G.t;
    for (let ty = r.iy; ty < r.iy + r.ih; ty++) for (let tx = r.ix; tx < r.ix + r.iw; tx++) {
      if (tileAt(G.fl, tx, ty) !== TILE.FLOOR) continue;
      const x = tx * TS, y = ty * TS, dx = x + 8 - mx, dy = y + 8 - my, d = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
      const k = Math.sin(d * 0.06 - t * 2.4) * 0.5 + 0.5, sym = Math.abs(Math.sin(ang * 3 + t * 0.5));
      const hue = (t * 60 + d * 1.6 + sym * 120) % 360;
      g.fillStyle = `hsla(${hue.toFixed(0)},85%,${(38 + k * 22).toFixed(0)}%,0.62)`;
      g.fillRect(Math.round(x - cx), Math.round(y - cy), TS, TS);
      g.fillStyle = `hsla(${((hue + 180) % 360).toFixed(0)},90%,70%,${(0.15 + sym * 0.25).toFixed(2)})`;
      const s = 2 + Math.round(k * 5);
      g.fillRect(Math.round(x - cx + 8 - s / 2), Math.round(y - cy + 8 - s / 2), s, s);
    }
    // a slow mandala over the floor
    g.save(); g.translate(Math.round(mx - cx), Math.round(my - cy)); g.lineWidth = 1;
    for (let ring = 1; ring <= 4; ring++) {
      const n = 6 + ring * 2, rr = ring * 22 + Math.sin(t * 1.3 + ring) * 4;
      g.strokeStyle = `hsla(${(t * 90 + ring * 60) % 360},95%,72%,0.5)`;
      g.beginPath();
      for (let i = 0; i <= n; i++) { const a = (i / n) * TAU + t * (ring % 2 ? 0.3 : -0.3); const rad = rr * (i % 2 ? 0.8 : 1); const px = Math.cos(a) * rad, py = Math.sin(a) * rad * 0.55; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
      g.stroke();
    }
    g.restore();
  }
});
hook('renderWorld', (g, cx, cy) => {
  const r = G.room;
  if (!r || r.type !== 'dmt') return;
  // the well swirls with souls
  const well = r.props.map((i) => G.fl.props[i]).find((q) => q.soulwell);
  if (well) for (let i = 0; i < 10; i++) { const a = G.t * 2.4 + i * 0.63, rr = 6 + ((G.t * 8 + i * 3) % 18), x = well.x + Math.cos(a) * rr * 0.5 - cx, y = well.y - 18 - ((G.t * 14 + i * 5) % 22) - cy; g.fillStyle = `hsl(${(G.t * 120 + i * 36) % 360},90%,70%)`; g.fillRect(Math.round(x), Math.round(y), 2, 2); }
  // the machine elves
  for (const el of r.elves || []) {
    const sp = elfSprite(el.i, Math.floor(el.t * 5) % 2), x = el.x - cx, y = el.y - cy - Math.abs(Math.sin(el.t * 5)) * 3;
    shadow(g, x, el.y - cy, 4);
    drawSprite(g, sp, x, y, el.vx < 0);
  }
});
hook('renderTop', (g, cx, cy) => {
  const r = G.room;
  if (!r) return;
  const VW = R.VW, VH = R.VH;
  if (r.type === 'dmt') {
    // the edges of the world breathe in colour
    const a = 0.12 + Math.sin(G.t * 1.7) * 0.05, hue = (G.t * 50) % 360;
    const grd = g.createRadialGradient(VW / 2, VH / 2, VH * 0.25, VW / 2, VH / 2, VH * 0.9);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, `hsla(${hue.toFixed(0)},90%,60%,${(a * 2).toFixed(3)})`);
    g.fillStyle = grd; g.fillRect(0, 0, VW, VH);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) { const rr = ((G.t * 40 + i * 70) % 220); g.strokeStyle = `hsla(${(hue + i * 120) % 360},90%,60%,${(0.18 * (1 - rr / 220)).toFixed(3)})`; g.lineWidth = 2; g.beginPath(); g.ellipse(VW / 2, VH / 2, rr * 1.4, rr * 0.8, 0, 0, TAU); g.stroke(); }
    g.globalCompositeOperation = 'source-over';
    for (const el of r.elves || []) if (el.sayT > 0 && el.say) { const t = pixelText(el.say, `hsl(${(G.t * 100 + el.i * 70) % 360},90%,75%)`); g.globalAlpha = Math.min(1, el.sayT * 2); g.drawImage(t, Math.round(el.x - cx - t.width / 2), Math.round(el.y - cy - 26)); g.globalAlpha = 1; }
  }
});
function soulWell(pr) {
  const p = G.p, run = G.run, cls = run.cls;
  const n = run.souls || 0;
  if (n <= 0) { UI.tree(cls, { inRun: true }); return; }
  run.souls = 0; run.soulsBanked = (run.soulsBanked || 0) + n;
  // souls stream from you into the well
  for (let i = 0; i < Math.min(60, 8 + n); i++) later(i * 0.02, () => { const a = rnd(TAU); G.parts.push({ x: p.x + Math.cos(a) * 6, y: p.y - 8, z: 6, vx: (pr.x - p.x) * 1.8 + rnd(-20, 20), vy: (pr.y - 14 - p.y) * 1.8 + rnd(-20, 20), vz: 0, grav: 0, drag: 0.4, life: 0.55, max: 0.55, color: `hsl(${(G.t * 200 + i * 20) % 360},90%,70%)`, size: 2, glow: true, floor: false }); });
  Sound.play('deposit');
  const res = bankSouls(cls, n);
  heal(p, Math.round(p.maxHp * 0.4)); p.poisonT = p.burnT = p.slowT = p.chillT = 0;
  later(0.8, () => {
    const info = classLevelInfo(cls);
    if (res.after > res.before) { banner(`Talent Level ${res.after}`, `${typeof talentLabel === 'function' ? talentLabel(cls) : playerClassName(cls)} · ${info.free} talent point${info.free === 1 ? '' : 's'} to spend`, 3); Sound.play('ascend'); ring(p.x, p.y - 10, 70, '#ff8ad8', 0.8, 3); burst(p.x, p.y - 10, 40, ['#ff6f9c', '#7fc8ff', '#fff27a', '#7dff9a', '#c873ff'], { smax: 150, glow: true, vz: 140 }); }
    else toast(`${n} souls banked · ${info.need - info.into} more to Talent Level ${info.lvl + 1}`, '#9ff6ff');
    later(0.6, () => { if (G.p === p && !p.dead && !UI.top()) UI.tree(cls, { inRun: true }); }, true);
  }, true);
}
const playerClassName = (cls) => (CLASS[cls] ? CLASS[cls].name : cls);

/* ============================================================
   Nemeses: what kills you keeps your souls
   ============================================================ */
const NEM_NAMES = ['Grukk', 'Vexa', 'Morg', 'Skarn', 'Ylith', 'Zub', 'Krael', 'Nyx', 'Ozzra', 'Throm', 'Gorbash', 'Ishka', 'Vorl', 'Snag', 'Mirelle', 'Drogo', 'Ulka', 'Rask', 'Feyn', 'Qorr', 'Belka', 'Hask', 'Zyra', 'Murk'];
const NEM_EPITHETS = ['Twice-Fed', 'Soul-Glutton', 'the Unbound', 'Many-Mouthed', 'the Hungering', 'Devourer', 'the Inevitable', 'World-Eater'];
const NEM_MUTS = {
  giant: { name: 'Gigantic', desc: 'swollen to monstrous size' },
  swift: { name: 'Swift', desc: 'moves like a thrown knife' },
  storm: { name: 'Bullet Storm', desc: 'sprays rings of chaos bolts' },
  blink: { name: 'Blinking', desc: 'tears through space to reach you' },
  regen: { name: 'Regenerating', desc: 'knits its wounds closed' },
  spawner: { name: 'Brood', desc: 'sheds lesser copies of itself' },
  void: { name: 'Void-Touched', desc: 'drags you toward it' },
  trail: { name: 'Corrupting', desc: 'leaves pools of chaos behind' },
  armored: { name: 'Plated', desc: 'shrugs off a third of all damage' },
  frenzy: { name: 'Frenzied', desc: 'attacks far faster' },
  heads: { name: 'Many-Headed', desc: 'grew extra heads that spit at you' },
  phase: { name: 'Phasing', desc: 'flickers out of reality' },
  split: { name: 'Splitting', desc: 'splits apart when wounded' },
  mirror: { name: 'Mirrored', desc: 'answers your blows with bolts' },
  meteor: { name: 'Starfallen', desc: 'calls the sky down on you' },
};
const CHAOS_COLS = ['#ff4ad0', '#c873ff', '#7f6aff', '#58aaff', '#7dff9a', '#fff27a', '#ffb35e', '#ff6f6f'];
function chaosColor(e, off = 0) { return CHAOS_COLS[(Math.floor(G.t * 6 + (e.x || 0) * 0.05) + off) % CHAOS_COLS.length]; }
const nemTitle = (n) => {
  const base = n.boss ? BOSSES[n.kind].name.replace(/^The /, '') : ENEMIES[n.kind] ? ENEMIES[n.kind].name : 'Horror';
  return `${n.name}, the Chaos ${base}${n.chaos >= 2 ? `, ${NEM_EPITHETS[Math.min(NEM_EPITHETS.length - 1, Math.log2(n.chaos) - 1)]}` : ''}`;
};
const ROOTED_SWAP = { eggsac: 'spider', thornvine: 'spider', crystal: 'wraith', turret: 'skeleton' };
function whoKilled(p) {
  const a = p.lastAttacker && G.t - (p.lastAttackT || 0) < 8 ? p.lastAttacker : null;
  if (a) return { kind: a.boss ? a.kind : ROOTED_SWAP[a.kind] || a.kind, boss: !!a.boss, nemId: a.nem ? a.nem.id : null, deep: false };
  const act = G.fl.info.act;
  return { kind: rndPick(act.elites), boss: false, nemId: null, deep: true };
}
hook('preHurt', (dmg, src, p) => {
  const att = src.ent || (src.proj && src.proj.owner) || src.owner || G.actor;
  if (att && att.type === 'enemy') { p.lastAttacker = att; p.lastAttackT = G.t; }
  return dmg;
});
function consumeSouls(p) {
  const run = G.run;
  if (!run || run.soulsResolved) return;
  run.soulsResolved = true;
  const souls = run.souls || 0, k = whoKilled(p), list = (CD.save.nemeses = CD.save.nemeses || []);
  let nem = k.nemId ? list.find((n) => n.id === k.nemId) : null;
  const where = { act: G.fl.actIdx % ACTS.length, floor: G.fl.idx };
  if (nem) {
    nem.chaos *= 2; nem.souls += souls; nem.kills = (nem.kills || 1) + 1;
    const m = randomMutation(nem); if (m) nem.muts.push(m);
    Object.assign(nem, where, { cls: run.cls });
    run.nemEvent = { type: 'grew', id: nem.id, souls, mut: m };
  } else if (souls > 0) {
    if (list.length >= 6) {
      nem = list.reduce((a, b) => (b.chaos > a.chaos ? b : a)); nem.souls += souls;
      run.nemEvent = { type: 'fed', id: nem.id, souls };
    } else {
      nem = { id: 'n' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), kind: k.kind, boss: k.boss, name: rndPick(NEM_NAMES), chaos: 1, souls, muts: [], kills: 1, cls: run.cls, born: Date.now(), deep: k.deep, ...where };
      list.push(nem);
      run.nemEvent = { type: 'born', id: nem.id, souls };
    }
  }
  if (nem) run.nemEventSnap = { ...nem, muts: [...nem.muts], title: nemTitle(nem) };
  run.souls = 0;
  persist();
}
function randomMutation(nem) {
  const pool = Object.keys(NEM_MUTS).filter((m) => !nem.muts.includes(m) && !(nem.boss && (m === 'split' || m === 'spawner' || m === 'giant')));
  return pool.length ? rndPick(pool) : null;
}
hook('death', (p) => consumeSouls(p));
hook('runEnd', (run, won) => {
  if (won) {
    const n = run.souls || 0;
    if (n > 0) { bankSouls(run.cls, n); run.soulsBanked = (run.soulsBanked || 0) + n; run.wonSouls = n; run.souls = 0; }
    return;
  }
  if (!run.soulsResolved && G.p) consumeSouls(G.p);
});

/* ---------- where nemeses lurk ---------- */
hook('preFloor', (run, idx) => {
  run.pendingNem = null;
  const list = CD.save.nemeses || [];
  if (!list.length || G.demo) return;
  const info = floorInfo(idx), act = info.actIdx % ACTS.length, rng = new RNG(hash2(run.seed ^ 0x9e37, idx * 131 + 7));
  run.nemSeen = run.nemSeen || [];
  const here = list.filter((n) => n.act === act && !run.nemSeen.includes(n.id));
  const boss = info.isBoss ? here.filter((n) => n.boss).sort((a, b) => b.chaos - a.chaos)[0] : null;
  const regs = here.filter((n) => !n.boss && (n.floor % TOTAL_FLOORS === idx % TOTAL_FLOORS || rng.chance(0.4))).sort((a, b) => b.chaos - a.chaos);
  run.pendingNem = { boss: boss || null, reg: regs[0] || null };
});
hook('onFloor', () => {
  const run = G.run, fl = G.fl, pn = run.pendingNem;
  fl.nemesis = null; fl.nemesisBoss = null;
  if (!pn) return;
  if (pn.boss) fl.nemesisBoss = pn.boss;
  if (pn.reg) {
    const rooms = fl.rooms.filter((r) => r.type === 'combat' && r.dist >= 1);
    if (rooms.length) { fl.nemesis = pn.reg; fl.nemRoom = rooms[hash2(run.seed, fl.idx) % rooms.length].id; }
  }
  if (fl.nemesis || fl.nemesisBoss) later(4.2, () => { const n = fl.nemesis || fl.nemesisBoss; toast(`You feel ${n.name} nearby. It still has your souls.`, '#ff4ad0'); Sound.play('nemesisNear'); });
});
hook('update', () => {
  const fl = G.fl, r = G.room;
  if (!fl || !fl.nemesis || fl.nemSpawned || !r || !G.combat || r.id !== fl.nemRoom) return;
  fl.nemSpawned = true;
  const nem = fl.nemesis, q = randomFloorPoint(r, G.p.x, G.p.y, 80);
  G.fx.push({ kind: 'portal', x: q.x, y: q.y, r: 30, t: 0, life: 1.4 });
  Sound.play('nemesisNear');
  later(1.1, () => { if (G.fl !== fl) return; spawnNemesis(nem, q.x, q.y, r); });
});
function spawnNemesis(nem, x, y, r) {
  const e = spawnEnemy(nem.kind, x, y, { room: r.id, noSpawnAnim: true });
  if (!e) return null;
  makeChaos(e, nem);
  if (G.run.nemSeen && !G.run.nemSeen.includes(nem.id)) G.run.nemSeen.push(nem.id);
  nemesisIntro(e, nem);
  return e;
}
function makeChaos(e, nem) {
  const lv = Math.max(0, Math.log2(nem.chaos));
  e.nem = nem; e.chaos = nem.chaos;
  if (!e.boss) {
    e.maxHp = Math.max(e.maxHp * 5, 110 + 35 * G.fl.idx) * Math.pow(1.7, lv); e.dmg *= 1.3 * Math.pow(1.2, lv); e.spd *= 1.12;
    e.scale = Math.min(2.4, 1.55 + 0.15 * lv); e.r = Math.min(16, e.r * 1.3); e.h *= e.scale;
    e.rateMul = (e.rateMul || 1) * 0.8; e.xp *= 8; e.gold *= 6;
  } else { e.maxHp *= 1.4 * Math.pow(1.35, lv); e.dmg *= 1.15 * Math.pow(1.15, lv); }
  const M = nem.muts;
  if (M.includes('giant')) { e.maxHp *= 1.3; e.scale = Math.min(2.8, (e.scale || 1) + 0.35); e.r = Math.min(18, e.r * 1.2); }
  if (M.includes('swift')) e.spd *= 1.4;
  if (M.includes('armored')) e.armor = 1 - (1 - (e.armor || 0)) * 0.65;
  if (M.includes('frenzy')) { e.rateMul = (e.rateMul || 1) * 0.55; e.spd *= 1.15; }
  e.hp = e.maxHp;
  e.nemT = { storm: 2, blink: 3, spawner: 5, void: 4, heads: 1.5, phase: 5, meteor: 4, trail: 0 };
}
function nemesisIntro(e, nem) {
  banner(nem.name, `Chaos ×${nem.chaos} · holding ${nem.souls} of your souls`, 3);
  if (typeof letterbox === 'function') letterbox(2.2);
  Sound.play('nemesis'); shake(8);
  G.slowmo = Math.max(G.slowmo, 0.35);
  burst(e.x, e.y - 10, 40, CHAOS_COLS, { smax: 160, glow: true, vz: 120 });
}
hook('bossStart', (e) => {
  const nem = G.fl.nemesisBoss;
  if (!nem || e.kind !== nem.kind) return;
  makeChaos(e, nem);
  if (G.run.nemSeen && !G.run.nemSeen.includes(nem.id)) G.run.nemSeen.push(nem.id);
  later(2.6, () => { if (G.boss === e) { banner(nem.name, `Chaos ×${nem.chaos} · it kept your ${nem.souls} souls`, 2.6); Sound.play('nemesis'); } });
  $('boss-name').textContent = nemTitle(nem);
});
// mutations at work
hook('update', (dt) => {
  const p = G.p;
  if (!p || p.dead) return;
  for (const e of G.ents) {
    if (!e.nem || e.dead || e.spawnT > 0) continue;
    const M = e.nem.muts, T = e.nemT;
    if (Math.random() < 0.5) burst(e.x + rnd(-e.r, e.r), e.y - rnd(0, e.h), 1, CHAOS_COLS, { grav: -40, floor: false, smax: 14, glow: true, lmax: 0.7 });
    for (const k in T) T[k] -= dt;
    const shots = (n, spread) => { const a0 = angP(e); for (let k = 0; k < n; k++) eShot(e, 'chaos', a0 + (k - (n - 1) / 2) * spread, { y: e.y - e.h * 0.5 }); };
    if (M.includes('storm') && T.storm <= 0) { T.storm = 3; const off = rnd(TAU); for (let k = 0; k < 10; k++) eShot(e, 'chaos', off + (k * TAU) / 10, { y: e.y - e.h * 0.5 }); Sound.play('chaos', { p: 1.4, v: 0.4 }); }
    if (M.includes('heads') && T.heads <= 0) { T.heads = 2.2; shots(5, 0.22); }
    if (M.includes('blink') && T.blink <= 0) { T.blink = 4.5; const a = rnd(TAU), x = clamp(p.x + Math.cos(a) * 60, (G.room.ix + 1) * TS, (G.room.ix + G.room.iw - 1) * TS), y = clamp(p.y + Math.sin(a) * 40, (G.room.iy + 1) * TS, (G.room.iy + G.room.ih - 1) * TS); G.fx.push({ kind: 'portal', x, y, r: 20, t: 0, life: 0.8 }); later(0.6, () => { if (!e.dead && !e.boss) { e.x = x; e.y = y; burst(x, y - 8, 16, CHAOS_COLS, { smax: 80, glow: true }); Sound.play('magic', { p: 0.4, v: 0.5 }); } }); }
    if (M.includes('regen') && G.t - (e.lastHitT || 0) > 2) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.015 * dt);
    if (M.includes('spawner') && T.spawner <= 0 && !e.boss) { T.spawner = 8; if (G.ents.filter((q) => q.nemChild === e && !q.dead).length < 4) for (let k = 0; k < 2; k++) { const s = spawnEnemy(e.kind, e.x + rnd(-14, 14), e.y + rnd(-10, 10), { room: e.room, mini: true }); if (s) { s.nemChild = e; s.xp = 1; s.gold = 0; } } }
    if (M.includes('void') && T.void <= 0) { T.void = 6; e.pullT = 0.9; ring(e.x, e.y - 8, 90, '#c873ff', 0.6, 3); Sound.play('void', { v: 0.5 }); }
    if (e.pullT > 0) { e.pullT -= dt; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d > 12 && d < 220) { p.vx += ((e.x - p.x) / d) * 900 * dt; p.vy += ((e.y - p.y) / d) * 900 * dt; } }
    if (M.includes('trail') && T.trail <= 0 && Math.hypot(e.vx || 0, e.vy || 0) > 5) { T.trail = 0.45; G.fx.push({ kind: 'pool', x: e.x, y: e.y, r: 14, t: 0, life: 3, team: 'e', dmg: e.dmg * 0.4, tick: 0.3, color: '#c873ff' }); }
    if (M.includes('phase') && T.phase <= 0 && !e.boss) { T.phase = 7; e.phaseT = 1.2; e.invuln = true; }
    if (e.phaseT > 0) { e.phaseT -= dt; if (e.phaseT <= 0) e.invuln = false; }
    if (M.includes('meteor') && T.meteor <= 0) { T.meteor = 9; for (let k = 0; k < 3; k++) { const x = p.x + rnd(-26, 26), y = p.y + rnd(-18, 18); later(k * 0.2, () => { telegraph({ x, y, r: 22, life: 0.9, color: '#ff4ad0', fire: () => explode(x, y, 22, 0, { team: 'e', pdmg: e.dmg, color: '#ff8ad8', vol: 0.5, shake: 3 }) }); G.fx.push({ kind: 'meteor', x, y, t: 0, life: 0.9 }); }); } }
    if (M.includes('split') && !e.didSplit && e.hp < e.maxHp * 0.5 && !e.boss) { e.didSplit = true; for (let k = 0; k < 2; k++) { const s = spawnEnemy(e.kind, e.x + rnd(-14, 14), e.y + rnd(-10, 10), { room: e.room, elite: true }); if (s) { s.nemChild = e; s.xp = 2; } } burst(e.x, e.y - 10, 30, CHAOS_COLS, { smax: 140, glow: true }); Sound.play('splat', { p: 0.6 }); }
  }
});
hook('onHit', (e, dmg, o) => {
  if (!e.nem) return;
  e.lastHitT = G.t;
  if (e.nem.muts.includes('mirror') && o.src === 'weapon' && Math.random() < 0.25) eShot(e, 'chaos', angP(e), { y: e.y - e.h * 0.5 });
});
hook('onKill', (e) => {
  if (!e.nem) return;
  const nem = e.nem, list = CD.save.nemeses || [];
  CD.save.nemeses = list.filter((n) => n.id !== nem.id);
  const bonus = 10 * nem.chaos;
  dropSouls(e.x, e.y, nem.souls + bonus);
  for (const q of G.picks) if (q.kind === 'soul' || q.kind === 'soulbig') q.magnet = true;
  dropPickup('gold', e.x, e.y, 20 + 10 * nem.chaos);
  if (!e.boss) { const id = randomRelic(G.run.rng); if (id) later(0.6, () => spawnItem({ type: 'relic', id }, e.x, e.y)); }
  banner('Souls Reclaimed', `${nem.name} is destroyed · ${nem.souls + bonus} souls`, 3.2);
  Sound.play('nemesisDie'); shake(12); hitstop(0.12); G.slowmo = Math.max(G.slowmo, 0.8);
  burst(e.x, e.y - 12, 80, CHAOS_COLS, { smax: 220, glow: true, vz: 160 });
  flashLight(e.x, e.y - 10, 160, '#ff4ad0', 0.6);
  for (const q of G.ents) if (q.nemChild === e && !q.dead) killEnemy(q, {});
  const fs = CD.save.fs; fs.nemesesSlain = (fs.nemesesSlain || 0) + 1; fs.soulsReclaimed = (fs.soulsReclaimed || 0) + nem.souls;
  G.run.nemKilled = (G.run.nemKilled || 0) + 1;
  persist();
});
// chaos beasts wear their names and their mutations
hook('entOverlay', (g, e, x, y) => {
  if (!e.nem) return;
  const top = Math.round(y - e.h * (e.scale || 1) - 6), w = 40, k = clamp(e.hp / e.maxHp, 0, 1);
  g.fillStyle = 'rgba(10,6,8,0.85)'; g.fillRect(Math.round(x - w / 2) - 1, top - 1, w + 2, 5);
  g.fillStyle = chaosColor(e); g.fillRect(Math.round(x - w / 2), top, Math.round(w * k), 3);
  const nm = pixelText(e.nem.name, chaosColor(e, 2)), lv = pixelText(`CHAOS X${e.nem.chaos}`, '#ffffff');
  g.drawImage(nm, Math.round(x - nm.width / 2), top - 16); g.drawImage(lv, Math.round(x - lv.width / 2), top - 9);
  const M = e.nem.muts;
  if (M.includes('heads') && e.frames) {
    const sp = e.frames[0], s = (e.scale || 1) * 0.55;
    for (const side of [-1, 1]) drawSprite(g, sp, x + side * sp.w * 0.45 * (e.scale || 1), y - e.h * (e.scale || 1) * 0.45, e.face < 0, { scale: s, alpha: 0.9, tint: chaosColor(e, side + 4), tintA: 0.5 });
  }
  if (M.includes('storm')) for (let i = 0; i < 3; i++) { const a = G.t * 3 + (i * TAU) / 3; g.fillStyle = chaosColor(e, i); g.fillRect(Math.round(x + Math.cos(a) * e.r * 1.8), Math.round(y - e.h * 0.5 + Math.sin(a) * e.r), 2, 2); }
  if (M.includes('void')) { g.strokeStyle = 'rgba(200,115,255,0.6)'; g.beginPath(); g.ellipse(Math.round(x), Math.round(y), e.r * 1.6 + Math.sin(G.t * 6) * 2, e.r * 0.7, 0, 0, TAU); g.stroke(); }
});
hook('renderTop', (g, cx, cy) => {
  const b = G.boss;
  if (!b || !b.nem || b.dead) return;
  g.globalCompositeOperation = 'lighter';
  const tex = LightTex.get(chaosColor(b), 0.4), r2 = 60 + Math.sin(G.t * 4) * 6;
  g.globalAlpha = 0.35; g.drawImage(tex, Math.round(b.x - cx - r2), Math.round(b.y - cy - b.h * 0.6 - r2), r2 * 2, r2 * 2);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
});

