/* ============================================================
   Cinderdeep — the chaos at the heart of the tree. Its passives
   are never the same twice: every descent rolls them anew. The
   Chaos Level rises on the DNA that characters sacrifice; it
   opens the inner bands of the wilds, makes their passives
   stronger, and lets chaos seep into the deep.
   ============================================================ */
const chaosNeed = (l) => 5 + 3 * (l - 1);
function chaosInfo() {
  const C = (CD.save.chaos = CD.save.chaos || { xp: 0 });
  let x = C.xp || 0, lvl = 0;
  while (lvl < 50 && x >= chaosNeed(lvl + 1)) { x -= chaosNeed(lvl + 1); lvl++; }
  return { lvl, into: x, need: chaosNeed(lvl + 1), xp: C.xp || 0 };
}
const chaosLevel = () => (CD.save ? chaosInfo().lvl : 0);
// what a gift of n points would make of it
function chaosAfter(n) { const C = CD.save.chaos || { xp: 0 }, x0 = C.xp; C.xp = (x0 || 0) + n; const I = chaosInfo(); C.xp = x0; return I; }
function chaosAdd(n, from) {
  if (!(n > 0)) return chaosInfo();
  const l0 = chaosLevel();
  CD.save.chaos.xp = (CD.save.chaos.xp || 0) + n;
  const I = chaosInfo();
  CD.save.fs.chaosGiven = (CD.save.fs.chaosGiven || 0) + n;
  if (I.lvl > l0) later(0.8, () => { banner(`Chaos Level ${I.lvl}`, I.lvl >= CHAOS_HEART_SEAL ? 'The heart of the tree lies open' : CHAOS_BANDS.some((B) => B.seal === I.lvl) ? 'Another band of the wilds opens' : 'The wilds grow wilder, and so does the deep', 3); Sound.play('ascend'); }, true);
  persist();
  return I;
}
// the wilds roll anew at the start of every descent
function chaosSeed() { const T = talentShared(); if (!T.chaosSeed) T.chaosSeed = ((Math.random() * 1e9) | 0) + 1; return T.chaosSeed; }
hook('runStart', (run, p) => {
  if (G.demo || (run && run.realm)) return;
  talentShared().chaosSeed = ((Math.random() * 1e9) | 0) + 1; CHAOS_CACHE.clear();
  // the player was made before the roll: let them feel this descent's chaos from the start
  if (p) recalcStats(p);
});
const talentSealed = (n) => !!n && n.seal > 0 && chaosLevel() < n.seal;

/* ---------- what a chaos passive turns out to be this time ---------- */
const CHAOS_MINOR = [
  ['+#% damage', 4, (s, v) => { s.dmgMul += v / 100; }], ['+#% attack speed', 4, (s, v) => { s.atkSpd += v / 100; }],
  ['+# max health', 12, (s, v) => { s.hpAdd += v; }], ['+#% crit chance', 3, (s, v) => { s.crit += v / 100; }],
  ['+#% move speed', 3, (s, v) => { s.spdMul += v / 100; }], ['+#% ability damage', 6, (s, v) => { s.abDmg += v / 100; }],
  ['+#% burn chance', 5, (s, v) => { s.burnCh += v / 100; }], ['+#% chill chance', 5, (s, v) => { s.chillCh += v / 100; }],
  ['+#% shock chance', 4, (s, v) => { s.shockCh += v / 100; }], ['+#% poison chance', 5, (s, v) => { s.poisonCh += v / 100; }],
  ['+# luck', 1, (s, v) => { s.luck += v; }], ['+#% gold', 8, (s, v) => { s.goldMul += v / 100; }],
  ['+# armor', 1, (s, v) => { s.armor += v; }], ['+#% dodge', 2, (s, v) => { s.dodge += v / 100; }],
  ['+# health per second', 0.2, (s, v) => { s.regen += v; }], ['+#% crit damage', 10, (s, v) => { s.critMul += v / 100; }],
];
const CHAOS_BOON = [
  ['+#% damage', 14, (s, v) => { s.dmgMul += v / 100; }], ['+#% attack speed', 12, (s, v) => { s.atkSpd += v / 100; }],
  ['+# max health', 40, (s, v) => { s.hpAdd += v; }], ['+#% crit chance', 8, (s, v) => { s.crit += v / 100; }],
  ['Abilities recharge #% faster', 12, (s, v) => { s.cdMul *= Math.max(0.5, 1 - v / 100); }], ['+#% lifesteal', 1.5, (s, v) => { s.lifesteal += v / 100; }],
  ['Kills heal #', 2, (s, v) => { s.killHeal += v; }], ['+# armor', 3, (s, v) => { s.armor += v; }],
  ['+#% dodge', 6, (s, v) => { s.dodge += v / 100; }], ['+#% ability damage', 20, (s, v) => { s.abDmg += v / 100; }],
  ['+# luck', 3, (s, v) => { s.luck += v; }], ['+#% weapon damage', 15, (s, v) => { s.wDmg += v / 100; }],
  ['+#% crit damage', 35, (s, v) => { s.critMul += v / 100; }], ['+#% move speed', 8, (s, v) => { s.spdMul += v / 100; }],
];
const CHAOS_BANE = [
  ['#% less max health', 8, (s, v) => { s.hpMul -= v / 100; }], ['Take #% more damage', 6, (s, v) => { s.dmgTaken *= 1 + v / 100; }],
  ['#% slower', 5, (s, v) => { s.spdMul -= v / 100; }], ['Abilities recharge #% slower', 8, (s, v) => { s.cdMul *= 1 + v / 100; }],
  ['#% less gold', 15, (s, v) => { s.goldMul -= v / 100; }], ['#% less attack speed', 5, (s, v) => { s.atkSpd -= v / 100; }],
];
const CHAOS_NAMES = ['Warp Bloom', 'Unstable Rift', 'Wild Spore', 'Fractured Mind', 'Riot of Hues', 'Twisting Root', 'Mad Bloom', 'Shatterseed', 'Flux Knot', 'Shifting Cap', 'Fever Gill', 'Mirror Mould', 'Howling Spore', 'Knot of Teeth', 'Drift Cap', 'Spiral Bloom'];
const CHAOS_CACHE = new Map();
const chaosMul = () => 1 + 0.08 * chaosLevel();
function chaosRoll(R, pool, mul) {
  const [txt, base, fn] = R.pick(pool), raw = base * mul * R.range(0.6, 1.6);
  const v = base < 1 ? Math.round(raw * 10) / 10 || 0.1 : Math.max(1, Math.round(raw));
  return { txt: txt.replace('#', String(v)), fn: (s) => fn(s, v) };
}
function chaosDef(n) {
  const seed = chaosSeed(), L = chaosLevel(), key = `${seed}:${L}:${n.id}`;
  let d = CHAOS_CACHE.get(key);
  if (d) return d;
  const R = new RNG((seed ^ Math.imul(n.id + 1, 2654435761)) >>> 0), mul = chaosMul(), parts = [];
  let name;
  if (n.chaos === 3) {
    // the heart: three boons, twice as strong
    name = 'Heart of Chaos';
    for (let i = 0; i < 3; i++) parts.push(chaosRoll(R, CHAOS_BOON, mul * 2));
  } else if (n.chaos === 2) {
    name = R.pick(CHAOS_NAMES);
    parts.push(chaosRoll(R, CHAOS_BOON, mul));
    if (R.chance(0.4)) { const b = chaosRoll(R, CHAOS_BANE, 1); b.bane = true; parts.push(b); }
  } else {
    name = 'Chaos spore';
    parts.push(chaosRoll(R, CHAOS_MINOR, mul));
  }
  d = { name, desc: `${parts.map((q) => q.txt).join('. ')}. Rolled anew every descent${L ? `, ${Math.round((mul - 1) * 100)}% stronger at Chaos Level ${L}` : ''}.`, apply: (s) => { for (const q of parts) q.fn(s); }, chaos: true };
  if (CHAOS_CACHE.size > 4000) CHAOS_CACHE.clear();
  CHAOS_CACHE.set(key, d);
  return d;
}
for (const n of TREE.nodes) if (n.chaos) Object.defineProperty(n, 'def', { get() { return chaosDef(n); }, configurable: true, enumerable: false });

/* ---------- chaos in the deep ---------- */
const CHAOS_HUES = ['#ff4ad0', '#7fe8ff', '#ffd35c', '#8fe05c', '#b98cff'];
const chaosTouchCh = () => Math.min(0.22, 0.025 * chaosLevel());
hook('spawned', (e) => { e._chaosRoll = true; });
hook('update', () => {
  if (!G.run || G.demo) return;
  const ch = chaosTouchCh();
  for (const e of G.ents) {
    if (!e._chaosRoll) continue;
    e._chaosRoll = false;
    if (!ch || e.type !== 'enemy' || e.summoned || e.boss || e.nem || e.chaosT || !e.def || e.def.ally || Math.random() >= ch) continue;
    const k = e.hp / (e.maxHp || 1);
    e.chaosT = true; e.maxHp *= 1.3; e.hp = e.maxHp * k; e.xp = (e.xp || 0) * 1.6; e.gold = (e.gold || 0) * 1.4;
    if (e.dmg) e.dmg *= 1.12;
  }
});
hook('onKill', (e) => {
  if (!e || !e.chaosT) return;
  burst(e.x, e.y - 6, 18, CHAOS_HUES, { smax: 110, glow: true });
  if (typeof dropPickup === 'function') dropPickup('soul', e.x, e.y, 1);
});
hook('entOverlay', (g, e, x, y) => {
  if (!e.chaosT || e.dead) return;
  const top = Math.round(y - e.h * (e.scale || 1) - 9);
  g.fillStyle = '#0a0608'; g.fillRect(Math.round(x) - 3, top - 1, 6, 5);
  g.fillStyle = CHAOS_HUES[Math.floor(G.t * 6 + e.x) % CHAOS_HUES.length]; g.fillRect(Math.round(x) - 2, top, 4, 3);
});
CD.chaos = { info: chaosInfo, add: chaosAdd, seed: chaosSeed, def: (id) => chaosDef(TREE.nodes[id]), sealed: (id) => talentSealed(TREE.nodes[id]) };

