/* ============================================================
   Cinderdeep — Evolutions. Every 5 levels (5 … 50) a hero or a
   beast evolves: ten stages, and at every stage a choice among
   twelve aspects. Talents (the passive tree) and upgrades (the
   skills you pick) decide which aspects you are attuned to.
   Each stage is bigger and more detailed than the last.
   ============================================================ */
const ASC_MAX = 10;
const ASPECTS = [
  { id: 'inferno', name: 'Inferno', c1: '#ff7a2a', c2: '#ffd08a', c3: '#a8301c', glow: '#ff9a3c', sym: 'flame', wing: 'flame', crown: 'flame', paul: 'flame', fx: 'ember',
    blurb: 'Fire answers to you.', titles: ['Kindled', 'Ember-Touched', 'Flamebearer', 'Pyreheart', 'Blazeborn', 'Infernal', 'Sunforged', 'Phoenix-Risen', 'Solar Tyrant', 'Avatar of Flame'],
    pick: (s, m) => { s.burnCh += 0.04 * m; s.burnMul += 0.08 * m; s.dmgMul += 0.02 * m; },
    perk: [[4, 'Fire cannot hurt you', (s) => { s.fireproof = true; }], [7, 'Burning foes explode', (s) => { s.combust = true; }], [10, 'Kills often erupt in flame', (s) => { s.boomOnKill += 0.3; }]],
    pickTxt: '+4% burn chance, +8% burn damage, +2% damage' },
  { id: 'glacier', name: 'Glacier', c1: '#9fe0ff', c2: '#e9f8ff', c3: '#3a6a9a', glow: '#bfe9ff', sym: 'snow', wing: 'crystal', crown: 'ice', paul: 'ice', fx: 'snow',
    blurb: 'Cold, patient and unbreakable.', titles: ['Rimed', 'Frostbitten', 'Icebound', 'Winterheart', 'Glacial', 'Frostlord', 'Avalanche', 'Everfrost', 'Glacier King', 'Avatar of Winter'],
    pick: (s, m) => { s.chillCh += 0.04 * m; s.hpMul += 0.04 * m; s.armor += 0.5 * m; },
    perk: [[4, 'Frozen foes take 20% more', (s) => { s.shatter = (s.shatter || 0) + 0.2; }], [7, 'An aura chills foes near you', (s) => { s.chillAura = Math.max(s.chillAura, 46); }], [10, 'Take 10% less damage', (s) => { s.dmgTaken *= 0.9; }]],
    pickTxt: '+4% chill chance, +4% max health, +0.5 armor' },
  { id: 'tempest', name: 'Tempest', c1: '#fff27a', c2: '#9ff6ff', c3: '#3a5e9a', glow: '#fff6b0', sym: 'bolt', wing: 'bolt', crown: 'bolt', paul: 'bolt', fx: 'spark',
    blurb: 'Fast as the storm, loud as thunder.', titles: ['Charged', 'Stormtouched', 'Sparkcaller', 'Thunderborn', 'Tempest', 'Stormlord', 'Skybreaker', 'Thunderking', "Heaven's Wrath", 'Avatar of Storms'],
    pick: (s, m) => { s.shockCh += 0.04 * m; s.atkSpd += 0.03 * m; s.spdMul += 0.02 * m; },
    perk: [[4, 'Shocks jump to 1 more foe', (s) => { s.shockChain += 1; }], [7, 'Lightning strikes a foe every 3s in a fight', (s) => { s.thunderlord = true; }], [10, 'A storm idol strikes for you', (s) => { s.idol = Math.max(s.idol, 26); }]],
    pickTxt: '+4% shock chance, +3% attack speed, +2% move speed' },
  { id: 'venom', name: 'Venom', c1: '#8fe05c', c2: '#d8ff9a', c3: '#2f5a2a', glow: '#a8ff6a', sym: 'drop', wing: 'insect', crown: 'thorn', paul: 'thorn', fx: 'spore',
    blurb: 'Every wound you leave keeps working.', titles: ['Tainted', 'Venomous', 'Blightbound', 'Plaguebearer', 'Rotheart', 'Pestilent', 'Miasma Lord', 'Hive Sovereign', 'Blight Colossus', 'Avatar of Decay'],
    pick: (s, m) => { s.poisonCh += 0.04 * m; s.dmgMul += 0.02 * m; s.regen += 0.1 * m; },
    perk: [[4, 'Poison spreads when foes die', (s) => { s.plague = true; }], [7, '+20% damage to poisoned foes', (s) => { s.withering = true; }], [10, 'Foes that hit you are poisoned', (s) => { s.venomBlood = true; s.poisonCh += 0.1; }]],
    pickTxt: '+4% poison chance, +2% damage, +0.1 health per second' },
  { id: 'arcane', name: 'Arcane', c1: '#b98cff', c2: '#e8d8ff', c3: '#4a2a8a', glow: '#d8b8ff', sym: 'rune', wing: 'rune', crown: 'rune', paul: 'orb', fx: 'rune',
    blurb: 'Spells that never stop coming.', titles: ['Attuned', 'Runescribed', 'Spellbound', 'Arcanist', 'Mystic', 'Archmage', 'Starweaver', 'Astral Sage', 'Arch-Sorcerer', 'Avatar of the Arcane'],
    pick: (s, m) => { s.abDmg += 0.08 * m; s.cdMul *= 1 - 0.03 * m; },
    perk: [[4, '10% chance an ability recharges at once', (s) => { s.echoCast = (s.echoCast || 0) + 0.1; }], [7, 'Abilities recharge 15% faster', (s) => { s.cdMul *= 0.85; }], [10, 'Abilities may cast twice', (s) => { s.twinSouls = (s.twinSouls || 0) + 0.25; }]],
    pickTxt: '+8% ability damage, abilities recharge 3% faster' },
  { id: 'bastion', name: 'Bastion', c1: '#e8edf4', c2: '#ffd35c', c3: '#6f7a8c', glow: '#fff0c0', sym: 'shield', wing: 'aegis', crown: 'plume', paul: 'plate', fx: 'dust',
    blurb: 'A wall that walks.', titles: ['Stalwart', 'Ironclad', 'Bulwark', 'Vanguard', 'Bastion', 'Juggernaut', 'Fortress', 'Unbreakable', 'Titanguard', 'Avatar of Iron'],
    pick: (s, m) => { s.armor += 1 * m; s.hpMul += 0.06 * m; },
    perk: [[4, 'Block one hit every 15 seconds', (s) => { s.bulwark = s.bulwark ? Math.min(s.bulwark, 12) : 15; }], [7, 'Ignore knockback and spikes, take 8% less', (s) => { s.sturdy = true; s.dmgTaken *= 0.92; }], [10, 'Reflect 15% of missiles', (s) => { s.reflect += 0.15; }]],
    pickTxt: '+1 armor, +6% max health' },
  { id: 'fury', name: 'Fury', c1: '#e2434f', c2: '#ff9a3c', c3: '#5a1418', glow: '#ff6a5a', sym: 'axe', wing: 'demon', crown: 'horns', paul: 'spike', fx: 'rage',
    blurb: 'Hit harder. Then hit faster.', titles: ['Wrathful', 'Ravager', 'Warborn', 'Reaver', 'Berserk', 'Warlord', 'Rampager', 'Doombringer', 'Godslayer', 'Avatar of War'],
    pick: (s, m) => { s.dmgMul += 0.05 * m; s.atkSpd += 0.03 * m; },
    perk: [[4, '+20% damage at a 10-kill combo', (s) => { s.rampage = true; }], [7, 'Kills stack frenzy', (s) => { s.frenzy = true; }], [10, 'Attacks may strike twice', (s) => { s.echoAtk += 0.15; }]],
    pickTxt: '+5% damage, +3% attack speed' },
  { id: 'zephyr', name: 'Zephyr', c1: '#8fe0b0', c2: '#f0fff6', c3: '#2a6a5a', glow: '#c8ffe0', sym: 'feather', wing: 'feather', crown: 'feather', paul: 'feather', fx: 'wind',
    blurb: 'Never where they aim.', titles: ['Fleet', 'Windborne', 'Swiftblade', 'Galeheart', 'Zephyr', 'Skyrunner', 'Stormfeather', 'Windlord', 'Sky Sovereign', 'Avatar of Wind'],
    pick: (s, m) => { s.spdMul += 0.04 * m; s.dodge += 0.02 * m; s.dashCd *= 1 - 0.05 * m; },
    perk: [[4, '+1 dash', (s) => { s.dashMax += 1; }], [7, 'Dashing grants +30% damage for 2s', (s) => { s.windDancer = true; }], [10, 'Dashing through foes cuts them', (s) => { s.bladeDash = Math.max(s.bladeDash, 0.6); }]],
    pickTxt: '+4% move speed, +2% dodge, dashes recharge 5% faster' },
  { id: 'blood', name: 'Sanguine', c1: '#c4202e', c2: '#ff8a8a', c3: '#4a0a12', glow: '#ff3a4a', sym: 'heart', wing: 'bat', crown: 'thorncrown', paul: 'spike', fx: 'blood',
    blurb: 'Their blood keeps you standing.', titles: ['Bloodthirsty', 'Crimson', 'Sanguine', 'Bloodbound', 'Hemomancer', 'Blood Baron', 'Crimson Count', 'Vampire Lord', 'Sanguine Prince', 'Avatar of Blood'],
    pick: (s, m) => { s.lifesteal += 0.006 * m; s.killHeal += 1 * m; },
    perk: [[4, 'Kills set off a healing blood nova', (s) => { s.bloodNova = true; }], [7, '+10% max health, +1% lifesteal', (s) => { s.hpMul += 0.1; s.lifesteal += 0.01; }], [10, 'Execute foes below 8% health', (s) => { s.cull = Math.max(s.cull, 0.08); }]],
    pickTxt: '+0.6% lifesteal, kills heal 1' },
  { id: 'shadow', name: 'Umbral', c1: '#3a3048', c2: '#cfd6e0', c3: '#14101c', glow: '#e8e0ff', sym: 'moon', wing: 'smoke', crown: 'smokehorns', paul: 'smoke', fx: 'smoke',
    blurb: 'Strike from the dark, gone before they turn.', titles: ['Veiled', 'Shadowed', 'Nightblade', 'Umbral', 'Duskwalker', 'Shadowlord', 'Eclipse', 'Voidstalker', 'Night Sovereign', 'Avatar of Night'],
    pick: (s, m) => { s.crit += 0.03 * m; s.critMul += 0.1 * m; s.dodge += 0.01 * m; },
    perk: [[4, 'Dashing leaves a slashing afterimage', (s) => { s.afterimage = true; }], [7, '+50% damage to unhurt foes', (s) => { s.firstStrike += 0.5; }], [10, 'Your first hit on each foe deals double', (s) => { s.markFirst = true; }]],
    pickTxt: '+3% crit chance, +10% crit damage, +1% dodge' },
  { id: 'radiant', name: 'Radiant', c1: '#ffe8a0', c2: '#ffffff', c3: '#b8862a', glow: '#fff6c8', sym: 'sun', wing: 'angel', crown: 'halo', paul: 'wingplate', fx: 'light',
    blurb: 'Light that heals and burns.', titles: ['Blessed', 'Hallowed', 'Lightbearer', 'Radiant', 'Dawnbringer', 'Exalted', 'Seraphic', 'Archon', 'Celestial', 'Avatar of Light'],
    pick: (s, m) => { s.regen += 0.3 * m; s.potHeal += 0.06 * m; s.hpAdd += 8 * m; },
    perk: [[4, 'A halo blocks a hit every 12s', (s) => { s.halo = s.halo ? Math.min(s.halo, 12) : 12; }], [7, 'Survive one killing blow per floor', (s) => { s.angel = true; }], [10, 'Halo every 8s, clearing heals 10%', (s) => { s.halo = 8; s.clearHeal += 0.1; }]],
    pickTxt: '+0.3 health per second, +6% potion healing, +8 max health' },
  { id: 'chaos', name: 'Chaos', c1: '#ff4ad0', c2: '#4affe0', c3: '#3a1a5a', glow: '#ff8ae8', sym: 'eye', wing: 'tentacle', crown: 'eye', paul: 'eye', fx: 'chaos',
    blurb: 'The deep looked back, and liked you.', titles: ['Touched', 'Warped', 'Eldritch', 'Fractured', 'Kaleidoscopic', 'Voidborn', 'Many-Eyed', 'Unraveller', 'Paradox', 'Avatar of Chaos'],
    pick: (s, m) => { s.dmgMul += 0.03 * m; s.crit += 0.02 * m; s.spdMul += 0.02 * m; },
    perk: [[4, 'Grow a random mutation', null], [7, 'Kills sometimes tear open a rift', (s) => { s.voidRift += 0.1; }], [10, 'Another mutation, +10% damage', (s) => { s.dmgMul += 0.1; }]],
    pickTxt: '+3% damage, +2% crit chance, +2% move speed' },
];
const ASPECT = Object.fromEntries(ASPECTS.map((a) => [a.id, a]));

/* ---------- where a character stands ---------- */
const ascStage = (p) => (p && p.asc ? p.asc.length : 0);
const ascAspect = (p) => (p && p.asc && p.asc.length ? p.asc[p.asc.length - 1] : null);
// the aspect you chose most before the current one tints the details
function ascSecond(p) {
  if (!p || !p.asc || p.asc.length < 2) return null;
  const cur = ascAspect(p), n = {};
  for (const a of p.asc.slice(0, -1)) if (a !== cur) n[a] = (n[a] || 0) + 1;
  let best = null, bn = 0;
  for (const a in n) if (n[a] > bn) { bn = n[a]; best = a; }
  return best;
}
const ascShift = (p) => (typeof treeHas === 'function' && p && p.cls && treeHas(p.cls, 'primal') ? 2 : 0);
const ascLevelFor = (p, stage) => stage * 5 - ascShift(p);
function ascDue(p) {
  if (!p) return 0;
  let n = 0;
  for (let st = ascStage(p) + 1; st <= ASC_MAX; st++) if (p.level >= ascLevelFor(p, st)) n++;
  return n;
}
let ascTitle = (p) => {
  const a = ascAspect(p);
  if (!a) return '';
  const base = p.beast && p.form ? FORMS[p.form].name : CLASS[p.cls] ? CLASS[p.cls].name : 'Hero';
  return `${ASPECT[a].titles[ascStage(p) - 1]} ${base}`;
};

/* ---------- affinity: talents and upgrades pull toward aspects ---------- */

/* ---------- what an evolution gives ---------- */
hook('stats', (s, p) => {
  const asc = p.asc;
  if (!asc || !asc.length) return;
  const n = asc.length;
  s.hpMul += 0.05 * n; s.dmgMul += 0.04 * n; s.reachMul += 0.02 * n;
  asc.forEach((id, i) => {
    const A = ASPECT[id];
    if (!A) return;
    const m = p.ascAtt && p.ascAtt[i] === 0 ? 0.5 : 1;
    A.pick(s, m);
    for (const [st, , fn] of A.perk) if (i + 1 >= st && fn) { const first = asc.findIndex((x, j) => x === id && j + 1 >= st); if (first === i) fn(s); }
  });
});
function ascPerksOf(p) {
  const out = [];
  (p.asc || []).forEach((id, i) => { for (const [st, txt] of ASPECT[id].perk) if (i + 1 >= st && (p.asc || []).findIndex((x, j) => x === id && j + 1 >= st) === i) out.push({ a: id, txt }); });
  return out;
}
function setAscBody(p) {
  const st = ascStage(p);
  if (p.beast && typeof setFormBody === 'function') setFormBody(p);
  else { p.r = 5; p.h = 18; }
  if (!st) return;
  p.r = Math.min(p.beast ? 9 : 7, p.r + st * 0.22);
  const sp = typeof heroFrame === 'function' && p.look ? heroFrame(p) : null;
  if (sp) p.h = Math.max(p.h, sp.h - 4 - (sp.top || 0));
}

/* ---------- the moment of change ---------- */
function applyAscension(p, id, attuned) {
  const before = ascStage(p);
  p.asc = [...(p.asc || []), id];
  p.ascAtt = [...(p.ascAtt || []), attuned ? 1 : 0];
  p.ascPending = ascDue(p) > 0;
  const A = ASPECT[id], st = before + 1;
  // chaos milestones grow mutations
  if (id === 'chaos') {
    const firstAt = (lv) => p.asc.findIndex((x, j) => x === 'chaos' && j + 1 >= lv);
    const grants = (firstAt(4) === st - 1 ? 1 : 0) + (firstAt(10) === st - 1 ? 1 : 0);
    for (let k = 0; k < grants; k++) {
      const pool = Object.keys(PLAYER_MUTS).filter((m) => !(p.muts || []).includes(m));
      if (!pool.length) break;
      const m = rndPick(pool); p.muts = [...(p.muts || []), m];
      later(1.4 + k * 0.6, () => toast(`Mutation: ${PLAYER_MUTS[m].name} · ${PLAYER_MUTS[m].desc}`, '#ff4ad0'));
    }
  }
  // every evolution counts for the tree; heroes awaken on their second
  if (typeof onEvolution === 'function') onEvolution(p, 'ascend');
  if (!p.beast && !p.awakened && st >= 2) { p.awakened = true; const F = CD.save.fs; F.awakenings = (F.awakenings || 0) + 1; }
  recalcStats(p);
  setAscBody(p);
  heal(p, Math.round(p.maxHp * 0.35), true);
  const fs = CD.save.fs; fs.ascensions = (fs.ascensions || 0) + 1; fs.ascMax = Math.max(fs.ascMax || 0, st);
  CD.save.seen = CD.save.seen || {}; CD.save.seen['asc:' + id + ':' + st] = 1;
  if (G.p === p && G.mode === 'play') {
    G.slowmo = Math.max(G.slowmo, 0.6); shake(9); hitstop(0.08);
    ring(p.x, p.y - 12, 80 + st * 6, A.c1, 0.9, 3); ring(p.x, p.y - 12, 44, '#ffffff', 0.5, 2);
    burst(p.x, p.y - 14, 60 + st * 4, [A.c1, A.c2, A.glow, '#ffffff'], { smax: 180 + st * 8, glow: true, vz: 150 });
    flashLight(p.x, p.y - 12, 160 + st * 10, A.glow, 0.8);
    for (const e of G.ents) if (!e.dead && e.type === 'enemy' && !e.boss && Math.hypot(e.x - p.x, e.y - p.y) < 90) { e.kx += (e.x - p.x) * 7; e.ky += (e.y - p.y) * 7; e.stunT = Math.max(e.stunT, 0.8); }
    banner(ascTitle(p), `Evolution ${st} of ${ASC_MAX} · ${A.name}${attuned ? '' : ' (unattuned)'}`, 3);
    Sound.play('evolve');
    later(0.4, () => Sound.play('levelup', { p: 0.8 }));
  }
  persist();
}

hook('onLevel', (p) => {
  if (ascDue(p) > 0) p.ascPending = true;
  // the old level-10 awakening is part of evolving now
  if (!p.beast) p.awakenPending = false;
});
hook('update', (dt) => {
  const p = G.p;
  if (!p || p.dead || G.mode !== 'play' || G.demo) return;
  if (p.ascPending && ascDue(p) <= 0) p.ascPending = false;
  if (!p.ascPending || UI.top() || p.evolvePending || p.pendingLevels > 0) { p.ascWait = 0; return; }
  const calm = !G.combat && !(G.boss && !G.boss.dead);
  // put off by the player: wait for a quiet moment
  if (p.ascLater) { p.ascCalmT = calm ? (p.ascCalmT || 0) + dt : 0; if (p.ascCalmT < 3) return; p.ascLater = false; }
  p.ascWait = (p.ascWait || 0) + dt;
  if ((calm && p.ascWait > 0.6) || p.ascWait > 9) { p.ascWait = 0; UI.ascend(false, !calm); }
});
hook('saveRun', (c, run, p) => { c.ext = { ...(c.ext || {}), asc: [...(p.asc || [])], ascAtt: [...(p.ascAtt || [])] }; });
hook('loadRun', (c, run, p) => { const x = c.ext || {}; const raw = Array.isArray(x.asc) ? x.asc : [], att = Array.isArray(x.ascAtt) ? x.ascAtt : []; const keep = raw.map((a, i) => [a, att[i] ?? 1]).filter(([a]) => ASPECT[a]).slice(0, ASC_MAX); p.asc = keep.map((k) => k[0]); p.ascAtt = keep.map((k) => k[1]); p.ascPending = ascDue(p) > 0; });

/* ---------- the choice screen ---------- */
function ascPreviewCanvas(p, id, size = 112) {
  const cv = h('canvas', { width: size, height: size, class: 'asc-cv' });
  const fake = { ...p, asc: [...(p.asc || []), id], ascAtt: [...(p.ascAtt || []), 1] };
  const frames = ascFramesFor(fake);
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  let t0 = performance.now();
  const A = ASPECT[id];
  const draw = () => {
    if (!cv.isConnected && performance.now() - t0 > 400) return;
    const t = (performance.now() - t0) / 1000;
    g.clearRect(0, 0, size, size);
    const gr = g.createRadialGradient(size / 2, size * 0.62, 2, size / 2, size * 0.6, size * 0.55);
    gr.addColorStop(0, rgbaStr(A.glow, 0.5)); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    const sp = frames.front[Math.floor(t * 4) % 2 ? 1 : 2] || frames.front[0];
    const k = Math.max(1, Math.floor(Math.min((size - 8) / sp.w, (size - 6) / sp.h) * 2) / 2);
    g.drawImage(sp.c, Math.round(size / 2 - sp.ax * k), Math.round(size - 4 - (sp.ay + 1) * k), Math.round(sp.w * k), Math.round(sp.h * k));
    for (let i = 0; i < 5; i++) { const a = t * 1.6 + i * 1.3, r = size * 0.36; g.fillStyle = i % 2 ? A.c1 : A.c2; g.globalAlpha = 0.7; g.fillRect(Math.round(size / 2 + Math.cos(a) * r), Math.round(size * 0.55 + Math.sin(a) * r * 0.45), 2, 2); g.globalAlpha = 1; }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  return cv;
}
// flashing silhouettes, then the new body bursts out
function ascCinematic(p, id, done) {
  const A = ASPECT[id];
  const oldSp = heroFrame(p);
  const fake = { ...p, asc: [...(p.asc || []), id], ascAtt: [...(p.ascAtt || []), 1] };
  const newSp = ascFramesFor(fake).front[0];
  const cv = h('canvas', { width: 220, height: 150, class: 'evo-cv asc-big' });
  const el = h('div', { class: 'modal evo' }, h('div', { class: 'evo-wrap' }, h('div', { class: 'lv-head' }, h('b', {}, 'Evolving'), h('small', {}, `${A.titles[ascStage(p)]} · ${A.name}`)), cv));
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  const t0 = performance.now();
  let finished = false;
  const finish = () => { if (finished) return; finished = true; UI.close(el); done(); };
  const draw = () => {
    if (finished) return;
    const t = (performance.now() - t0) / 1000;
    g.clearRect(0, 0, 220, 150);
    const gr = g.createRadialGradient(110, 96, 4, 110, 90, 110); gr.addColorStop(0, rgbaStr(A.glow, 0.55)); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 220, 150);
    const period = Math.max(0.06, 0.4 - t * 0.13), phase = Math.floor(t / period) % 2, reveal = t > 2.2;
    const sp = reveal || phase ? newSp : oldSp;
    const k = Math.max(1, Math.floor(Math.min(200 / sp.w, 136 / sp.h)));
    g.drawImage(reveal ? sp.c : silhouette(sp, phase ? '#ffffff' : A.c2), Math.round(110 - sp.ax * k), Math.round(146 - (sp.ay + 1) * k), Math.round(sp.w * k), Math.round(sp.h * k));
    for (let i = 0; i < 10; i++) { const a = t * 2.4 + i * 0.63, r = 50 + Math.sin(t * 3 + i) * 14 - (reveal ? 0 : t * 6); g.fillStyle = i % 3 ? A.c1 : '#ffffff'; g.fillRect(Math.round(110 + Math.cos(a) * r), Math.round(84 + Math.sin(a) * r * 0.5), 2, 2); }
    if (reveal) { g.globalAlpha = Math.max(0, 1 - (t - 2.2) * 2.5); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 220, 150); g.globalAlpha = 1; }
    if (t > 3.1) { finish(); return; }
    requestAnimationFrame(draw);
  };
  UI.open(el, { modal: true, replace: false, onBack: finish });
  el.addEventListener('click', () => { if ((performance.now() - t0) > 900) finish(); });
  requestAnimationFrame(draw);
}

/* ---------- aura in the world: motes by aspect, bigger as you grow ---------- */
const ASC_FX = {
  ember: (p, A) => burst(p.x + rnd(-8, 8), p.y - rnd(4, 26), 1, [A.c1, A.c2, '#ff5a2a'], { grav: -60, floor: false, smax: 12, glow: true, lmax: 0.7 }),
  snow: (p, A) => burst(p.x + rnd(-12, 12), p.y - rnd(10, 34), 1, ['#ffffff', A.c1], { grav: 30, floor: false, smax: 8, lmax: 1, glow: true }),
  spark: (p, A) => { if (Math.random() < 0.3) zapFx(p.x + rnd(-10, 10), p.y - rnd(6, 30), p.x + rnd(-10, 10), p.y - rnd(6, 30), A.c1, 0.08); else burst(p.x + rnd(-8, 8), p.y - rnd(6, 26), 1, [A.c1, A.c2], { grav: 0, floor: false, smax: 30, glow: true, lmax: 0.25 }); },
  spore: (p, A) => burst(p.x + rnd(-10, 10), p.y - rnd(2, 20), 1, [A.c1, A.c2, '#c873ff'], { grav: -18, floor: false, smax: 8, glow: true, lmax: 1.2 }),
  rune: (p, A) => { const a = G.t * 2 + rnd(TAU), r = 14 + ascStage(p); burst(p.x + Math.cos(a) * r, p.y - 14 + Math.sin(a) * r * 0.4, 1, [A.c1, A.c2], { grav: 0, floor: false, smax: 4, glow: true, lmax: 0.6, size: 2 }); },
  dust: (p, A) => { if (p.moving) burst(p.x + rnd(-6, 6), p.y, 1, ['#cfd6e0', A.c2], { grav: -10, floor: false, smax: 10, lmax: 0.5 }); else burst(p.x + rnd(-8, 8), p.y - rnd(8, 28), 1, [A.c2], { grav: -14, floor: false, smax: 4, glow: true, lmax: 0.6 }); },
  rage: (p, A) => burst(p.x + rnd(-9, 9), p.y - rnd(2, 24), 1, [A.c1, A.c2, '#3a0a0a'], { grav: -70, floor: false, smax: 10, glow: Math.random() < 0.6, lmax: 0.5 }),
  wind: (p, A) => { const y = p.y - rnd(2, 26); G.parts.push({ x: p.x - 16, y, z: 0, vx: 70 + rnd(30), vy: rnd(-6, 6), vz: 0, grav: 0, drag: 0.5, life: 0.4, max: 0.4, color: Math.random() < 0.5 ? A.c2 : A.c1, size: 1, glow: true, floor: false }); },
  blood: (p, A) => burst(p.x + rnd(-8, 8), p.y - rnd(6, 26), 1, [A.c1, '#7a0a14', A.c2], { grav: 60, floor: false, smax: 6, lmax: 0.8, glow: Math.random() < 0.3 }),
  smoke: (p, A) => G.parts.push({ x: p.x + rnd(-10, 10), y: p.y - rnd(0, 20), z: 0, vx: rnd(-8, 8), vy: -rnd(4, 14), vz: 0, grav: 0, drag: 1, life: 1, max: 1, color: Math.random() < 0.8 ? '#1a1420' : A.glow, size: Math.random() < 0.5 ? 2 : 3, glow: false, floor: false }),
  light: (p, A) => burst(p.x + rnd(-12, 12), p.y - rnd(8, 34), 1, ['#ffffff', A.c1, A.c2], { grav: -24, floor: false, smax: 6, glow: true, lmax: 0.9 }),
  chaos: (p) => burst(p.x + rnd(-12, 12), p.y - rnd(4, 30), 1, CHAOS_COLS, { grav: rnd(-40, 40), floor: false, smax: 18, glow: true, lmax: 0.7 }),
};
hook('renderWorld', () => {
  const p = G.p;
  if (!p || p.dead || G.demo) return;
  const id = ascAspect(p);
  if (!id || CD.settings.lowFx) return;
  const A = ASPECT[id], st = ascStage(p);
  if (Math.random() < 0.12 + st * 0.05) (ASC_FX[A.fx] || ASC_FX.light)(p, A);
});
// an evolution put off for later can be taken from the pause menu
pauseItem('evolve', 58, (el, p) => (p && p.ascPending && ascDue(p) > 0 ? btn(`Evolve now · evolution ${ascStage(p) + 1} of ${ASC_MAX}`, () => { UI.close(el); p.ascLater = false; UI.ascend(true); }, 'primary') : null));

