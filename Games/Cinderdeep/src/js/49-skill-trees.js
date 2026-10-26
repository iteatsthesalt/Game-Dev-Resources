/* ============================================================
   Cinderdeep — skill trees. Every hero and beast has a tree of
   its own, built from its weapon, its ability and its nature:
   eight paths (six elements, chaos and luck) that change how
   the weapon hits, what the ability does and which accessory is
   worn, bridged where neighbouring paths meet. The paths you
   walk, here and in the talent tree, decide what you evolve
   into: one of eight pure forms, or a hybrid of your two
   strongest paths.
   ============================================================ */
const PATHS = [
  { id: 'fire', name: 'Fire', aspect: 'inferno', col: '#ff7a2a', noun: 'Embers', adj: 'Kindled',
    minor: (s, m) => { s.burnCh += 0.04 * m; s.burnMul += 0.06 * m; }, minorTxt: '+4% burn chance, +6% burn damage',
    weapon: (s) => { s.burnCh += 0.12; s.burnMul += 0.15; s.wDmg += 0.06; }, weaponTxt: '+12% burn chance, burns deal 15% more, +6% weapon damage',
    abilityTxt: 'Your abilities burst into flame around you, burning every foe nearby.',
    heart: (s) => { s.combust = true; s.burnMul += 0.3; }, heartTxt: 'Burning foes explode when they die, and burns deal 30% more.' },
  { id: 'frost', name: 'Frost', aspect: 'glacier', col: '#9fe0ff', noun: 'Rime', adj: 'Frostbound',
    minor: (s, m) => { s.chillCh += 0.04 * m; s.hpMul += 0.03 * m; }, minorTxt: '+4% chill chance, +3% max health',
    weapon: (s) => { s.chillCh += 0.12; s.shatter += 0.15; s.wDmg += 0.06; }, weaponTxt: '+12% chill chance, frozen foes take 15% more, +6% weapon damage',
    abilityTxt: 'Your abilities release a frost nova that chills everything near you.',
    heart: (s) => { s.chillAura = Math.max(s.chillAura, 50); s.shatter += 0.3; }, heartTxt: 'Foes near you are always chilled, and frozen foes take 30% more.' },
  { id: 'storm', name: 'Storm', aspect: 'tempest', col: '#fff27a', noun: 'Thunder', adj: 'Stormcalled',
    minor: (s, m) => { s.shockCh += 0.04 * m; s.atkSpd += 0.03 * m; }, minorTxt: '+4% shock chance, +3% attack speed',
    weapon: (s) => { s.shockCh += 0.1; s.shockChain += 1; s.wDmg += 0.06; }, weaponTxt: '+10% shock chance, shocks jump to 1 more foe, +6% weapon damage',
    abilityTxt: 'Your abilities call lightning down on the three nearest foes.',
    heart: (s) => { s.thunderlord = true; s.shockCh += 0.06; }, heartTxt: 'Lightning strikes a nearby foe every 3 seconds in a fight.' },
  { id: 'venom', name: 'Venom', aspect: 'venom', col: '#8fe05c', noun: 'Venom', adj: 'Festering',
    minor: (s, m) => { s.poisonCh += 0.04 * m; s.regen += 0.1 * m; }, minorTxt: '+4% poison chance, +0.1 health per second',
    weapon: (s) => { s.poisonCh += 0.12; s.wDmg += 0.06; s.regen += 0.2; }, weaponTxt: '+12% poison chance, +6% weapon damage, +0.2 health per second',
    abilityTxt: 'Your abilities leave a cloud of poison where you stand.',
    heart: (s) => { s.plague = true; s.withering = true; }, heartTxt: 'Poison spreads when foes die, and poisoned foes take 20% more.' },
  { id: 'shadow', name: 'Shadow', aspect: 'shadow', col: '#a88ad8', noun: 'Shadows', adj: 'Veiled',
    minor: (s, m) => { s.crit += 0.03 * m; s.dodge += 0.015 * m; }, minorTxt: '+3% crit chance, +1.5% dodge',
    weapon: (s) => { s.critMul += 0.25; s.crit += 0.04; }, weaponTxt: '+25% crit damage, +4% crit chance',
    abilityTxt: 'Your abilities wrap you in shadow: for a moment you cannot be seen, and your next hit is a critical.',
    heart: (s) => { s.markFirst = true; s.afterimage = true; }, heartTxt: 'Your first hit on each foe deals double, and dashing leaves a slashing afterimage.' },
  { id: 'earth', name: 'Earth', aspect: 'bastion', col: '#c8a070', noun: 'Stone', adj: 'Granite',
    minor: (s, m) => { s.armor += 1 * m; s.hpAdd += 8 * m; }, minorTxt: '+1 armor, +8 max health',
    weapon: (s) => { s.kbMul += 0.3; s.wDmg += 0.1; }, weaponTxt: '+30% knockback, +10% weapon damage, and hits may stun',
    abilityTxt: 'Your abilities shake the ground: foes near you are stunned and thrown back, and your skin turns to stone for 2 seconds.',
    heart: (s) => { s.sturdy = true; s.dmgTaken *= 0.85; }, heartTxt: 'Ignore knockback and spikes, and take 15% less damage.' },
  { id: 'chaos', name: 'Chaos', aspect: 'chaos', col: '#ff4ad0', noun: 'Chaos', adj: 'Warped',
    minor: (s, m) => { s.dmgMul += 0.04 * m; s.spdMul += 0.01 * m; }, minorTxt: '+4% damage, +1% move speed',
    weapon: (s) => { s.dmgMul += 0.06; }, weaponTxt: 'Hits may burn, chill, shock or poison at random. +6% damage',
    abilityTxt: 'Your abilities unleash a random element each time.',
    heart: (s) => { s.voidRift += 0.1; s.dmgMul += 0.08; }, heartTxt: 'Grow a chaos mutation; kills sometimes tear open a rift; +8% damage.' },
  { id: 'luck', name: 'Luck', aspect: 'fortune', col: '#ffd35c', noun: 'Fortune', adj: 'Blessed',
    minor: (s, m) => { s.luck += 1 * m; s.goldMul += 0.06 * m; s.crit += 0.01 * m; }, minorTxt: '+1 luck, +6% gold, +1% crit chance',
    weapon: (s) => { s.crit += 0.05; s.goldMul += 0.1; }, weaponTxt: '+5% crit chance, +10% gold, and hits sometimes shake loose a coin',
    abilityTxt: 'Your abilities have a 30% chance to recharge at once, and casting scatters coins.',
    heart: (s) => { s.echoAtk += 0.12; s.luck += 3; s.dodge += 0.05; }, heartTxt: 'Attacks may strike twice, +3 luck and +5% dodge.' },
];
const PATH = Object.fromEntries(PATHS.map((q) => [q.id, q]));
// the wheel: neighbours share a bridge, and their hybrid is a step away
const WHEEL = ['fire', 'earth', 'venom', 'shadow', 'chaos', 'frost', 'storm', 'luck'];
// every pair of paths makes a hybrid of its own
const H = (name, titles, txt, fn, look) => ({ name, titles, txt, fn, look });
const HYBRIDS = {
  'fire+frost': H('Steam', ['Steamtouched', 'Steamforged', 'Avatar of Steam'], 'Burns deal 25% more; +5% chill chance', (s) => { s.burnMul += 0.25; s.chillCh += 0.05; }),
  'fire+storm': H('Plasma', ['Plasma-Lit', 'Plasmaborn', 'Avatar of Plasma'], '+8% burn and shock chance', (s) => { s.burnCh += 0.08; s.shockCh += 0.08; }),
  'fire+venom': H('Brimstone', ['Sulphurous', 'Brimstone', 'Avatar of Brimstone'], '+6% burn and poison chance; burning foes explode', (s) => { s.burnCh += 0.06; s.poisonCh += 0.06; s.combust = true; }),
  'fire+shadow': H('Hellfire', ['Hellkindled', 'Hellfire', 'Avatar of Hellfire'], '+4% crit chance; burns deal 20% more', (s) => { s.crit += 0.04; s.burnMul += 0.2; }),
  'fire+earth': H('Magma', ['Molten', 'Magmaheart', 'Avatar of Magma'], '+2 armor, +8% burn chance; foes that touch you take 20', (s) => { s.armor += 2; s.burnCh += 0.08; s.thorns += 20; }, 'fury'),
  'fire+chaos': H('Wildfire', ['Wildfire', 'Untamed Flame', 'Avatar of Wildfire'], '+8% damage; kills sometimes explode', (s) => { s.dmgMul += 0.08; s.boomOnKill += 0.1; }),
  'fire+luck': H('Radiance', ['Sunblessed', 'Radiant', 'Avatar of Radiance'], '+0.4 health per second, +6% burn chance, +10% gold', (s) => { s.regen += 0.4; s.burnCh += 0.06; s.goldMul += 0.1; }, 'radiant'),
  'frost+storm': H('Blizzard', ['Squall', 'Blizzard', 'Avatar of the Blizzard'], '+6% chill and shock chance, +4% move speed', (s) => { s.chillCh += 0.06; s.shockCh += 0.06; s.spdMul += 0.04; }),
  'frost+venom': H('Frostrot', ['Frostrot', 'Rimeblight', 'Avatar of Frostrot'], '+6% chill and poison chance; frozen foes take 15% more', (s) => { s.chillCh += 0.06; s.poisonCh += 0.06; s.shatter += 0.15; }),
  'frost+shadow': H('Wraith', ['Pale', 'Wraithborn', 'Avatar of Wraiths'], '+5% dodge, +6% chill chance, +3% crit chance', (s) => { s.dodge += 0.05; s.chillCh += 0.06; s.crit += 0.03; }),
  'frost+earth': H('Permafrost', ['Icebound', 'Permafrost', 'Avatar of Permafrost'], '+2 armor, +8% max health; foes near you are chilled', (s) => { s.armor += 2; s.hpMul += 0.08; s.chillAura = Math.max(s.chillAura, 40); }),
  'frost+chaos': H('Shatter', ['Fractured', 'Shatterborn', 'Avatar of Shattering'], 'Frozen foes take 30% more; +5% damage', (s) => { s.shatter += 0.3; s.dmgMul += 0.05; }),
  'frost+luck': H('Prism', ['Glinting', 'Prismatic', 'Avatar of the Prism'], '+4% crit chance, +2 luck, +5% chill chance', (s) => { s.crit += 0.04; s.luck += 2; s.chillCh += 0.05; }),
  'storm+venom': H('Acid Rain', ['Corroded', 'Acidborn', 'Avatar of Acid Rain'], '+6% poison and shock chance; shocks jump to 1 more foe', (s) => { s.poisonCh += 0.06; s.shockCh += 0.06; s.shockChain += 1; }),
  'storm+shadow': H('Eclipse', ['Darkened', 'Eclipsed', 'Avatar of the Eclipse'], '+5% crit chance, +6% shock chance', (s) => { s.crit += 0.05; s.shockCh += 0.06; }),
  'storm+earth': H('Lodestone', ['Magnetic', 'Lodestone', 'Avatar of the Lodestone'], '+1 armor, shocks jump to 1 more foe, +20% knockback', (s) => { s.armor += 1; s.shockChain += 1; s.kbMul += 0.2; }),
  'storm+chaos': H('Arcane', ['Runecharged', 'Arcanist', 'Avatar of the Arcane'], '+15% ability damage; abilities recharge 8% faster', (s) => { s.abDmg += 0.15; s.cdMul *= 0.92; }, 'arcane'),
  'storm+luck': H('Zephyr', ['Windblessed', 'Galeborn', 'Avatar of the Zephyr'], '+8% move speed, +4% dodge, +1 dash', (s) => { s.spdMul += 0.08; s.dodge += 0.04; s.dashMax += 1; }, 'zephyr'),
  'venom+shadow': H('Sanguine', ['Bloodthirsty', 'Sanguine', 'Avatar of Blood'], '+1% lifesteal; kills heal 1', (s) => { s.lifesteal += 0.01; s.killHeal += 1; }, 'blood'),
  'venom+earth': H('Mycelial', ['Rooted', 'Mycelial', 'Avatar of the Mycelium'], '+0.5 health per second, +8% max health, +6% poison chance', (s) => { s.regen += 0.5; s.hpMul += 0.08; s.poisonCh += 0.06; }),
  'venom+chaos': H('Mutagen', ['Mutated', 'Mutagenic', 'Avatar of Mutation'], '+6% damage, +8% poison chance', (s) => { s.dmgMul += 0.06; s.poisonCh += 0.08; }),
  'venom+luck': H('Alchemy', ['Brewer', 'Alchemist', 'Avatar of Alchemy'], 'Potions heal 30% more, +1 potion, +5% poison chance', (s) => { s.potHeal += 0.3; s.potMax += 1; s.poisonCh += 0.05; }),
  'shadow+earth': H('Obsidian', ['Glassy', 'Obsidian', 'Avatar of Obsidian'], '+2 armor, +4% crit chance', (s) => { s.armor += 2; s.crit += 0.04; }),
  'shadow+chaos': H('Void', ['Hollow', 'Voidborn', 'Avatar of the Void'], 'Kills sometimes tear open a rift; +3% crit chance, +5% damage', (s) => { s.voidRift += 0.1; s.crit += 0.03; s.dmgMul += 0.05; }),
  'shadow+luck': H('Trickster', ['Sly', 'Trickster', 'Avatar of Tricks'], '+6% dodge, +4% crit chance, +10% gold', (s) => { s.dodge += 0.06; s.crit += 0.04; s.goldMul += 0.1; }),
  'earth+chaos': H('Faultline', ['Cracked', 'Faultborn', 'Avatar of the Fault'], '+30% knockback, +6% damage; kills sometimes explode', (s) => { s.kbMul += 0.3; s.dmgMul += 0.06; s.boomOnKill += 0.08; }),
  'earth+luck': H('Gilded', ['Gilt', 'Gilded', 'Avatar of Gold'], '+1 armor, +25% gold; gold you carry adds damage', (s) => { s.armor += 1; s.goldMul += 0.25; s.goldDmg = true; }),
  'chaos+luck': H('Wild Card', ['Dicey', 'Wild Card', 'Avatar of Chance'], '+5% crit chance, attacks may strike twice (8%), +5% damage', (s) => { s.crit += 0.05; s.echoAtk += 0.08; s.dmgMul += 0.05; }),
};
const hybKey = (a, b) => { const ia = PATHS.findIndex((q) => q.id === a), ib = PATHS.findIndex((q) => q.id === b); return ia < ib ? `${a}+${b}` : `${b}+${a}`; };

/* ---------- luck has a body of its own ---------- */
ASPECTS.push({ id: 'fortune', name: 'Fortune', c1: '#ffd35c', c2: '#7dff9a', c3: '#8a6a1a', glow: '#fff0a0', sym: 'sun', wing: 'feather', crown: 'halo', paul: 'feather', fx: 'light',
  blurb: 'The dice always land your way.', titles: ['Lucky', 'Charmed', 'Fortunate', 'Blessed', 'Goldtouched', 'Fatebender', 'Starlucky', 'Jackpot', 'Fortune Lord', 'Avatar of Fortune'],
  pick: (s, m) => { s.luck += 1 * m; s.crit += 0.02 * m; s.goldMul += 0.06 * m; },
  perk: [[4, 'Attacks may strike twice (10%)', (s) => { s.echoAtk += 0.1; }], [7, '+8% dodge', (s) => { s.dodge += 0.08; }], [10, '+5 luck and +30% gold', (s) => { s.luck += 5; s.goldMul += 0.3; }]],
  pickTxt: '+1 luck, +2% crit chance, +6% gold' });
ASPECT.fortune = ASPECTS[ASPECTS.length - 1];

/* ---------- accessories: one for each path ---------- */
addAll(RELICS, RELIC, [
  { id: 'acc_fire', acc: true, name: 'Cinder Ring', desc: '+10% burn chance, burns deal 15% more.', apply: (s) => { s.burnCh += 0.1; s.burnMul += 0.15; } },
  { id: 'acc_frost', acc: true, name: 'Rime Amulet', desc: '+10% chill chance, +5% max health.', apply: (s) => { s.chillCh += 0.1; s.hpMul += 0.05; } },
  { id: 'acc_storm', acc: true, name: 'Storm Band', desc: '+10% shock chance, +5% move speed.', apply: (s) => { s.shockCh += 0.1; s.spdMul += 0.05; } },
  { id: 'acc_venom', acc: true, name: 'Viper Charm', desc: '+10% poison chance, +0.3 health per second.', apply: (s) => { s.poisonCh += 0.1; s.regen += 0.3; } },
  { id: 'acc_shadow', acc: true, name: 'Shade Locket', desc: '+6% crit chance, +4% dodge.', apply: (s) => { s.crit += 0.06; s.dodge += 0.04; } },
  { id: 'acc_earth', acc: true, name: 'Stone Signet', desc: '+2 armor, +20 max health.', apply: (s) => { s.armor += 2; s.hpAdd += 20; } },
  { id: 'acc_chaos', acc: true, name: 'Chaos Prism', desc: '+10% damage. Hits now and then tear at random.', apply: (s) => { s.dmgMul += 0.1; } },
  { id: 'acc_luck', acc: true, name: 'Lucky Clover', desc: '+3 luck, +20% gold, +3% crit chance.', apply: (s) => { s.luck += 3; s.goldMul += 0.2; s.crit += 0.03; } },
]);
const ACC_WORD = { fire: 'Cinder', frost: 'Rime', storm: 'Storm', venom: 'Viper', shadow: 'Shade', earth: 'Stone', chaos: 'Chaos', luck: 'Lucky' };
const ACC_KIND = { hero: ['Ring', 'Amulet', 'Band', 'Charm', 'Locket', 'Signet', 'Prism', 'Clover'], beast: ['Collar', 'Fang', 'Torc', 'Bell', 'Tag', 'Stone', 'Shard', 'Clover'] };

/* ---------- each playable's own tree ---------- */
const SK_CACHE = {};
const SK_STEP = ['att', 'weapon', 'focus', 'ability', 'acc', 'mastery', 'heart'];
// which path a playable is born closest to
function skNative(cls) {
  const c = CLASS[cls];
  if (c && c.beast) return { fire: 'fire', nature: 'venom', frost: 'frost', storm: 'storm', earth: 'earth', shadow: 'shadow' }[c.element] || 'earth';
  return { knight: 'earth', paladin: 'luck', ranger: 'storm', pyro: 'fire', rogue: 'shadow', berserker: 'fire', storm: 'storm', necro: 'venom', monk: 'earth', gunslinger: 'luck', witch: 'chaos', samurai: 'shadow', bard: 'luck' }[cls] || 'fire';
}
function skTree(cls) {
  if (SK_CACHE[cls]) return SK_CACHE[cls];
  const c = CLASS[cls];
  if (!c) return null;
  const W0 = WEAPON[c.weapon] ? WEAPON[c.weapon].name : 'Weapon', A0 = ABILITY[c.ability] ? ABILITY[c.ability].name : 'Ability', beast = !!c.beast;
  const native = skNative(cls), rot = WHEEL.indexOf(native), nodes = {}, edges = [];
  const add = (n) => { n.links = []; nodes[n.id] = n; return n; };
  const link = (a, b) => { a.links.push(b.id); b.links.push(a.id); edges.push([a.id, b.id]); };
  const core = add({ id: 'core', kind: 'core', name: c.name, desc: `${c.passive.name}: ${c.passive.desc}`, x: 0, y: 0 });
  WHEEL.forEach((pid, k) => {
    const P = PATH[pid], ang = -Math.PI / 2 + ((k - rot) * TAU) / 8, accName = `${ACC_WORD[pid]} ${ACC_KIND[beast ? 'beast' : 'hero'][PATHS.indexOf(P)]}`;
    const text = {
      att: [`${P.name} Attunement`, `${P.minorTxt}. Walks the ${P.name.toLowerCase()} path.`],
      weapon: [`${W0} of ${P.noun}`, `Your ${W0.toLowerCase()}: ${P.weaponTxt}.`],
      focus: [`${P.adj} Focus`, `${P.minorTxt}.`],
      ability: [`${A0}: ${P.adj}`, P.abilityTxt],
      acc: [accName, `Wear the ${accName}: ${RELIC['acc_' + pid].desc}`],
      mastery: [`${P.adj} ${c.name}`, `Twice over: ${P.minorTxt}.`],
      heart: [`Heart of ${P.noun}`, P.heartTxt],
    };
    let prev = core;
    SK_STEP.forEach((kind, i) => {
      const r = 64 + i * 50, n = add({ id: `${pid}:${kind}`, kind, path: pid, name: text[kind][0], desc: text[kind][1], x: Math.round(Math.cos(ang) * r), y: Math.round(Math.sin(ang) * r) });
      link(prev, n); prev = n;
    });
  });
  // bridges where neighbours meet
  WHEEL.forEach((pid, k) => {
    const q = WHEEL[(k + 1) % 8], key = hybKey(pid, q), HY = HYBRIDS[key], ang = -Math.PI / 2 + ((k - rot + 0.5) * TAU) / 8, r = 64 + 2.6 * 50;
    const n = add({ id: `br:${key}`, kind: 'bridge', path: pid, path2: q, name: `Toward ${HY.name}`, desc: `Counts for both ${PATH[pid].name} and ${PATH[q].name}. Half of each: ${PATH[pid].minorTxt}; ${PATH[q].minorTxt}.`, x: Math.round(Math.cos(ang) * r), y: Math.round(Math.sin(ang) * r) });
    link(nodes[`${pid}:focus`], n); link(n, nodes[`${q}:focus`]);
  });
  return (SK_CACHE[cls] = { cls, nodes, edges, native, core: 'core', free: [`${native}:att`] });
}

/* ---------- what you have spent, wherever you are ---------- */
// in a descent the player holds it; on the roster the character's saved self does
function skHolder(target) {
  if (target && target.stats) {
    const p = target; p.sk = p.sk || []; p.skFree = p.skFree || 0;
    return { cls: p.cls, alloc: p.sk, free: () => p.skFree, spend: () => { p.skFree--; }, refund: (n) => { p.skFree += n; }, relics: p.relics, p, level: p.level };
  }
  const ch = target;
  if (!ch || !ch.snap || !ch.snap.p) return { cls: ch ? ch.cls : 'knight', alloc: [], free: () => 0, spend: () => {}, refund: () => {}, relics: [], ro: true, level: 1 };
  const ext = (ch.snap.ext = ch.snap.ext || {});
  ext.sk = ext.sk || []; ext.skFree = ext.skFree || 0;
  return { cls: ch.cls, alloc: ext.sk, free: () => ext.skFree, spend: () => { ext.skFree--; }, refund: (n) => { ext.skFree += n; }, relics: ch.snap.p.relics || (ch.snap.p.relics = []), level: ch.snap.p.level };
}
function skCanTake(T, alloc, id) {
  const n = T.nodes[id];
  if (!n || alloc.includes(id) || T.free.includes(id)) return false;
  return n.links.some((l) => l === 'core' || alloc.includes(l) || T.free.includes(l));
}
function skTake(target, id) {
  const H0 = skHolder(target), T = skTree(H0.cls);
  if (H0.ro || !T || H0.free() <= 0 || !skCanTake(T, H0.alloc, id)) return false;
  H0.alloc.push(id); H0.spend();
  const n = T.nodes[id];
  // an accessory is put on; a chaos heart grows something
  if (n.kind === 'acc' && !H0.relics.includes('acc_' + n.path)) H0.relics.push('acc_' + n.path);
  if (n.kind === 'heart' && n.path === 'chaos' && H0.p && typeof PLAYER_MUTS !== 'undefined') {
    const pool = Object.keys(PLAYER_MUTS).filter((m) => !(H0.p.muts || []).includes(m));
    if (pool.length) { const m = rndPick(pool); H0.p.muts = [...(H0.p.muts || []), m]; toast(`Mutation: ${PLAYER_MUTS[m].name}`, '#ff4ad0'); }
  }
  if (H0.p) recalcStats(H0.p);
  persist();
  return true;
}
function skReset(target) {
  const H0 = skHolder(target), T = skTree(H0.cls);
  if (H0.ro || !T) return;
  for (const id of H0.alloc) { const n = T.nodes[id]; if (n && n.kind === 'acc') { const i = H0.relics.indexOf('acc_' + n.path); if (i >= 0) H0.relics.splice(i, 1); } }
  H0.refund(H0.alloc.length); H0.alloc.length = 0;
  if (H0.p) recalcStats(H0.p);
  persist();
}
const skAlloc = (p) => new Set([...(p.sk || []), ...((skTree(p.cls) || { free: [] }).free)]);

/* ---------- what the tree does ---------- */
hook('stats', (s, p) => {
  const T = skTree(p.cls);
  if (!T) return;
  for (const id of skAlloc(p)) {
    const n = T.nodes[id];
    if (!n || n.kind === 'core') continue;
    const P = PATH[n.path];
    if (n.kind === 'att' || n.kind === 'focus') P.minor(s, 1);
    else if (n.kind === 'mastery') P.minor(s, 2);
    else if (n.kind === 'weapon') P.weapon(s);
    else if (n.kind === 'heart') P.heart(s);
    else if (n.kind === 'bridge') { P.minor(s, 0.5); PATH[n.path2].minor(s, 0.5); }
  }
});
const skHas = (p, id) => !!p && skAlloc(p).has(id);
// the weapon's path shows in how it hits
hook('onHit', (e, dmg, o) => {
  const p = G.p;
  if (!p || !o || o.src !== 'weapon' || o.noProc || e.dead) return;
  if (skHas(p, 'earth:weapon') && Math.random() < 0.1) e.stunT = Math.max(e.stunT || 0, 0.5);
  if (skHas(p, 'luck:weapon') && Math.random() < 0.04) dropPickup('gold', e.x, e.y, 1);
  if ((skHas(p, 'chaos:weapon') || (p.relics || []).includes('acc_chaos')) && Math.random() < 0.15) {
    const base = dmg || 8, r = Math.floor(Math.random() * 4);
    if (r === 0) applyBurn(e, base); else if (r === 1) applyPoison(e, base); else if (r === 2) applyChill(e, false);
    else { zapFx(e.x, e.y - 14, e.x, e.y - 2, '#fff27a', 0.1); damageEnemy(e, base * 0.4, { src: 'ability', noCrit: true, noProc: true, silent: true, color: '#fff27a' }); }
  }
});
// the ability's path shows in what it unleashes
const SK_ABILITY = {
  fire: (p, base) => { ring(p.x, p.y - 4, 46, '#ff7a2a', 0.4, 2); burst(p.x, p.y - 6, 18, ['#ffb347', '#ff7a2a', '#fff1a8'], { smax: 120, glow: true }); for (const e of G.ents) if (!e.dead && e.type === 'enemy' && Math.hypot(e.x - p.x, e.y - p.y) < 46 + e.r) { damageEnemy(e, base * 0.6, { src: 'ability', noProc: true, color: '#ffb35e' }); applyBurn(e, base); } },
  frost: (p, base) => { ring(p.x, p.y - 4, 54, '#cfefff', 0.45, 2); burst(p.x, p.y - 6, 16, ['#ffffff', '#cfefff', '#6ab4e8'], { smax: 110 }); for (const e of G.ents) if (!e.dead && e.type === 'enemy' && Math.hypot(e.x - p.x, e.y - p.y) < 54 + e.r) { damageEnemy(e, base * 0.4, { src: 'ability', noProc: true, color: '#cfefff' }); applyChill(e, true); } },
  storm: (p, base) => { const L = G.ents.filter((e) => !e.dead && e.type === 'enemy' && e.spawnT <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < 130).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 3); for (const e of L) { zapFx(e.x, e.y - 60, e.x, e.y - 6, '#fff27a', 0.2); damageEnemy(e, base * 0.9, { src: 'ability', noProc: true, shock: 1, color: '#fff27a' }); } if (L.length) Sound.play('zap'); },
  venom: (p, base) => { G.fx.push({ kind: 'cloud', x: p.x, y: p.y, r: 40, t: 0, life: 4, team: 'p', poison: true, base, tick: 0 }); },
  shadow: (p) => { p.veilT = Math.max(p.veilT || 0, 1.2); p.critNext = (p.critNext || 0) + 1; burst(p.x, p.y - 8, 14, ['#3e2a5e', '#a88ad8', '#08060e'], { smax: 60, grav: -30, floor: false }); },
  earth: (p, base) => { shake(3); ring(p.x, p.y, 50, '#c8a070', 0.4, 3); p.stoneT = Math.max(p.stoneT || 0, 2); for (const e of G.ents) if (!e.dead && e.type === 'enemy' && !e.boss && Math.hypot(e.x - p.x, e.y - p.y) < 50 + e.r) { e.stunT = Math.max(e.stunT || 0, 0.8); e.kx += (e.x - p.x) * 6; e.ky += (e.y - p.y) * 6; damageEnemy(e, base * 0.3, { src: 'ability', noProc: true, color: '#c8a070' }); } },
  chaos: (p, base, a) => SK_ABILITY[rndPick(['fire', 'frost', 'storm', 'venom', 'shadow', 'earth'])](p, base * 1.15, a),
  luck: (p, base, a) => { if (Math.random() < 0.3 && a) { a.cd = 0.2; addText(p.x, p.y - 28, 'LUCKY', '#ffd35c'); Sound.play('pickup', { p: 1.6 }); } for (let i = 0; i < 2; i++) dropPickup('gold', p.x + rnd(-8, 8), p.y + rnd(-6, 6), 1); },
};
hook('onAbility', (p, a) => {
  if (!p || p.dead) return;
  const base = (typeof weaponDamage === 'function' ? weaponDamage(p) : 10) * (p.stats.abDmg || 1);
  for (const P of PATHS) if (skHas(p, `${P.id}:ability`)) SK_ABILITY[P.id](p, base, a);
});

/* ---------- what you become: the paths you walk, here and in your talents ---------- */
const SECTOR_PATH = [[['earth', 1]], [['fire', 1]], [['luck', 0.6], ['shadow', 0.6]], [['storm', 0.7], ['frost', 0.7]], [['chaos', 0.6], ['fire', 0.4]], [['venom', 0.8], ['shadow', 0.4]]];
const KEY_PATH = { giantsblood: 'earth', pyreofruin: 'fire', fortunesfavour: 'luck', stormherald: 'storm', bornofchaos: 'chaos', plaguelord: 'venom', chaosstrain: 'chaos', avatar: 'fire', unbreakable: 'earth', overload: 'storm', vaalpact: 'venom', bloodrage: 'fire', acrobatics: 'shadow', eldritch: 'chaos', resolute: 'earth', pointblank: 'luck', winddancer: 'storm', necropact: 'shadow', ironwill: 'earth' };
function skScores(p) {
  const sc = Object.fromEntries(PATHS.map((q) => [q.id, 0])), T = skTree(p.cls);
  if (T) {
    sc[T.native] += 1;
    for (const id of skAlloc(p)) {
      const n = T.nodes[id];
      if (!n || n.kind === 'core') continue;
      const w = n.kind === 'heart' ? 3 : n.kind === 'weapon' || n.kind === 'ability' || n.kind === 'acc' ? 1.5 : 1;
      if (n.kind === 'bridge') { sc[n.path] += 1.25; sc[n.path2] += 1.25; } else sc[n.path] += w;
    }
  }
  // the talent tree leans you too, more gently
  if (typeof treeAlloc === 'function' && p.cls) for (const id of treeAlloc(p.cls)) {
    const n = TREE.nodes[id];
    if (!n) continue;
    if (n.key && KEY_PATH[n.key]) sc[KEY_PATH[n.key]] += 1;
    else if (n.sector >= 0 && SECTOR_PATH[n.sector]) for (const [q, w] of SECTOR_PATH[n.sector]) sc[q] += w * (n.type === 'notable' ? 0.4 : 0.12);
    if (n.path && sc[n.path] != null) sc[n.path] += n.type === 'notable' ? 0.5 : 0.15;
  }
  return sc;
}
function skForm(p) {
  const sc = skScores(p), order = PATHS.map((q) => q.id).sort((a, b) => sc[b] - sc[a]);
  const P = order[0], S = order[1];
  const hybrid = sc[S] >= Math.max(2, sc[P] * 0.5) ? S : null;
  if (!hybrid) { const A = ASPECT[PATH[P].aspect]; return { pure: true, path: P, aspect: A.id, sec: null, key: null, name: PATH[P].name, sc, order }; }
  const key = hybKey(P, hybrid), HY = HYBRIDS[key];
  return { pure: false, path: P, path2: hybrid, aspect: HY.look || PATH[P].aspect, sec: HY.look ? null : PATH[hybrid].aspect, key, name: HY.name, sc, order };
}
// hybrid stages: the second path's gift at half strength, and the hybrid's own once
hook('stats', (s, p) => {
  const keys = p.ascHybKey || [];
  if (!keys.length) return;
  const seen = new Set();
  keys.forEach((key, i) => {
    if (!key || !HYBRIDS[key]) return;
    // a named hybrid has a body of its own; any other wears its first path and borrows half of the second
    const [a, b] = key.split('+'), prim = (p.ascPath || [])[i], sec = prim === a ? b : a;
    if (!HYBRIDS[key].look && ASPECT[PATH[sec].aspect]) ASPECT[PATH[sec].aspect].pick(s, 0.5);
    if (!seen.has(key)) { seen.add(key); HYBRIDS[key].fn(s); }
  });
});
const _ascSecondSk = ascSecond;
ascSecond = function (p) {
  const h2 = p && p.ascHyb && p.ascHyb.length ? p.ascHyb[p.ascHyb.length - 1] : null;
  return h2 || _ascSecondSk(p);
};
const _ascTitleSk = ascTitle;
ascTitle = function (p) {
  const key = p && p.ascHybKey && p.ascHybKey.length ? p.ascHybKey[p.ascHybKey.length - 1] : null;
  if (!key || !HYBRIDS[key]) return _ascTitleSk(p);
  const st = ascStage(p), base = p.beast && p.form ? FORMS[p.form].name : CLASS[p.cls] ? CLASS[p.cls].name : 'Hero';
  return `${HYBRIDS[key].titles[st <= 3 ? 0 : st <= 6 ? 1 : 2]} ${base}`;
};
hook('saveRun', (c, run, p) => { c.ext = { ...(c.ext || {}), sk: [...(p.sk || [])], skFree: p.skFree || 0, ascHyb: [...(p.ascHyb || [])], ascHybKey: [...(p.ascHybKey || [])], ascPath: [...(p.ascPath || [])] }; });
hook('loadRun', (c, run, p) => {
  const x = (c && c.ext) || {};
  p.sk = Array.isArray(x.sk) ? x.sk.filter((id) => typeof id === 'string') : null;
  p.skFree = x.skFree || 0;
  // someone who levelled before skill trees existed gets the points they earned
  if (!p.sk) { p.sk = []; p.skFree = Math.max(0, (p.level || 1) - 1); }
  p.ascHyb = Array.isArray(x.ascHyb) ? x.ascHyb : []; p.ascHybKey = Array.isArray(x.ascHybKey) ? x.ascHybKey : []; p.ascPath = Array.isArray(x.ascPath) ? x.ascPath : [];
});
hook('runStart', (run, p) => { if (p && !p.sk) { p.sk = []; p.skFree = p.skFree || 0; } });

/* ---------- evolving: the trees decide, you choose when ---------- */
UI.ascend = function (manual = true, busy = false) {
  const p = G.p, opened = performance.now();
  if (!p || ascDue(p) <= 0) { if (p) p.ascPending = false; return; }
  if (UI.top() && UI.top()._ascend) return;
  const st = ascStage(p) + 1, F = skForm(p), A = ASPECT[F.aspect];
  Sound.play('evolveStart');
  let chosen = false;
  const preview = { ...p, ascHyb: [...(p.ascHyb || []), F.sec], ascHybKey: [...(p.ascHybKey || []), F.key] };
  const title = F.pure ? A.titles[st - 1] : HYBRIDS[F.key].titles[st <= 3 ? 0 : st <= 6 ? 1 : 2];
  const perks = F.pure ? A.perk.filter(([lv]) => st >= lv && !(p.asc || []).some((x, j) => x === A.id && j + 1 >= lv)).map(([, t]) => t) : [`${HYBRIDS[F.key].name}: ${HYBRIDS[F.key].txt}`];
  const top = F.order.slice(0, 3).map((q) => `${PATH[q].name} ${F.sc[q].toFixed(1)}`).join(' · ');
  const go = () => {
    if (chosen || performance.now() - opened < (CD.debug && CD.debug.fastUI ? 0 : 700)) return;
    chosen = true; UI.close(el);
    p.ascHyb = preview.ascHyb; p.ascHybKey = preview.ascHybKey; p.ascPath = [...(p.ascPath || []), F.path];
    ascCinematic(p, F.aspect, () => applyAscension(p, F.aspect, true));
  };
  const card = h('button', { class: 'card asc-card att', type: 'button', style: { '--asc': A.c1, '--asc2': A.glow }, 'data-autofocus': busy ? null : true, onclick: go },
    h('div', { class: 'asc-top' }, ascPreviewCanvas(preview, F.aspect, 120),
      h('div', { class: 'asc-nm' }, h('b', {}, title), h('small', {}, F.pure ? `${PATH[F.path].name} · pure form` : `${PATH[F.path].name} + ${PATH[F.path2].name} · hybrid`), h('span', { class: 'asc-tag' }, F.pure ? A.name : HYBRIDS[F.key].name))),
    h('p', { class: 'desc' }, F.pure ? A.blurb : `A hybrid of ${PATH[F.path].name.toLowerCase()} and ${PATH[F.path2].name.toLowerCase()}.`),
    h('ul', {}, h('li', {}, A.pickTxt), ...perks.map((t) => h('li', { class: 'perk' }, t))),
    h('span', { class: 'pick' }, 'Evolve'));
  const wait = btn('Decide later', () => { if (chosen) return; UI.close(el); p.ascLater = true; p.ascCalmT = 0; toast('Evolution waiting · walk your paths, then evolve from the pause menu', '#ffd35c'); }, 'small', busy ? { 'data-autofocus': true } : {});
  const trees = btn('Skill tree', () => { if (chosen) return; UI.close(el); p.ascLater = true; UI.skillTree(null, {}); }, 'small');
  const el = h('div', { class: 'modal asc' }, h('div', { class: 'asc-wrap' },
    h('div', { class: 'lv-head' }, h('b', {}, `Evolution ${st} of ${ASC_MAX}`), h('small', {}, `Level ${ascLevelFor(p, st)} · your trees have decided`)),
    h('div', { class: 'choices asc-choices' }, card),
    h('p', { class: 'asc-why' }, `Your form follows the paths you walk in your skill tree and talents. Strongest: ${top}. Two strong paths make a hybrid.`),
    h('div', { class: 'row' }, trees, wait)));
  el._ascend = true;
  UI.open(el, { modal: true, replace: false, onBack: () => wait.click() });
};

/* ---------- levelling: every level is a skill point ---------- */
const _levelUpSk = UI.levelUp;
UI.levelUp = function (rarities, title) {
  const p = G.p;
  if (rarities || !p || !skTree(p.cls)) return _levelUpSk(rarities, title);
  if (UI.top() && UI.top()._skill) return;
  p.skFree = (p.skFree || 0) + (p.pendingLevels || 0); p.pendingLevels = 0;
  UI.skillTree(null, { levelUp: true });
};
pauseItem('skills', 50, (el, p) => (p && skTree(p.cls) ? btn(`Skill tree${p.skFree ? ` · ${p.skFree} to spend` : ''}`, () => { UI.close(el); UI.skillTree(null, {}); }, p.skFree ? 'primary' : '') : null));

/* ---------- the tree on screen ---------- */
UI.skillTree = function (ch, opts = {}) {
  const target = ch || G.p, H0 = skHolder(target), T = skTree(H0.cls);
  if (!T) return;
  const name = ch ? charLabel(ch) : G.run && G.run.charId && charById(G.run.charId) ? charLabel(charById(G.run.charId)) : CLASS[H0.cls].name;
  const W = Math.min(window.innerWidth - 32, 860), Hh = Math.min(window.innerHeight - 230, 640), S = Math.min(W, Hh) / 840;
  const cv = h('canvas', { width: W, height: Hh, class: 'sk-cv', style: { width: W + 'px', height: Hh + 'px', touchAction: 'none', cursor: 'pointer', background: 'rgba(8,6,10,0.6)' } });
  const tip = h('div', { class: 'sk-tip', style: { position: 'absolute', pointerEvents: 'none', display: 'none', maxWidth: '280px', padding: '8px 10px', background: 'rgba(16,12,16,0.96)', boxShadow: 'inset 0 0 0 2px var(--soot-4)', font: '400 16px/1.25 var(--f-ui)', color: 'var(--bone-2)', zIndex: 5 } });
  const head = h('div', { class: 'lv-head' }), formLine = h('p', { class: 'asc-why', style: { margin: 0 } });
  const g = cv.getContext('2d'), X = (n) => W / 2 + n.x * S, Y = (n) => Hh / 2 + n.y * S;
  let hover = null;
  const allocSet = () => new Set([...H0.alloc, ...T.free, 'core']);
  const nodeR = (n) => (n.kind === 'core' ? 16 : n.kind === 'heart' ? 12 : n.kind === 'att' || n.kind === 'focus' || n.kind === 'mastery' || n.kind === 'bridge' ? 7 : 10) * Math.max(0.8, S);
  const colOf = (n) => (n.kind === 'core' ? '#ffd35c' : PATH[n.path].col);
  const draw = () => {
    const A = allocSet();
    g.clearRect(0, 0, W, Hh);
    T.edges.forEach(([a, b], i) => {
      const na = T.nodes[a], nb = T.nodes[b], on = A.has(a) && A.has(b);
      mycHypha(g, X(na), Y(na), X(nb), Y(nb), i * 7907 + 3, { lit: on, col: colOf(nb.kind === 'core' ? na : nb), t: performance.now() / 1000, width: on ? 3 : 2 });
    });
    for (const id in T.nodes) {
      const n = T.nodes[id], on = A.has(id), can = !on && skCanTake(T, H0.alloc, id) && H0.free() > 0 && !H0.ro, r = nodeR(n), c = colOf(n);
      g.fillStyle = on ? c : '#120e14'; g.strokeStyle = on || can ? c : 'rgba(200,190,170,0.35)'; g.lineWidth = can ? 2.5 : 1.5;
      g.beginPath();
      if (n.kind === 'heart' || n.kind === 'acc') { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.lineTo(X(n) + Math.cos(a) * r, Y(n) + Math.sin(a) * r); } g.closePath(); }
      else if (n.kind === 'bridge') { g.moveTo(X(n), Y(n) - r); g.lineTo(X(n) + r, Y(n)); g.lineTo(X(n), Y(n) + r); g.lineTo(X(n) - r, Y(n)); g.closePath(); }
      else g.arc(X(n), Y(n), r, 0, TAU);
      g.fill(); g.stroke();
      if (can) { g.globalAlpha = 0.35 + Math.sin(performance.now() / 260) * 0.2; g.beginPath(); g.arc(X(n), Y(n), r + 4, 0, TAU); g.stroke(); g.globalAlpha = 1; }
      if (n === hover) { g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.arc(X(n), Y(n), r + 3, 0, TAU); g.stroke(); }
    }
    // path names at the rim
    g.font = `400 ${Math.round(15 * Math.max(0.8, S))}px var(--f-ui), sans-serif`; g.textAlign = 'center';
    for (const P of PATHS) { const n = T.nodes[`${P.id}:heart`], d = Math.hypot(n.x, n.y) || 1, k = (d + 30) / d; g.fillStyle = P.col; g.fillText(P.name.toUpperCase(), W / 2 + n.x * k * S, Hh / 2 + n.y * k * S + 5); }
  };
  const refresh = () => {
    const p = H0.p || (ch ? restorePlayer(ch, { souls: 0 }) : null), F = p ? skForm(p) : null;
    head.replaceChildren(h('b', {}, `${name} · skill tree`), h('small', {}, H0.ro ? 'Gain a level in a descent to earn skill points' : `${H0.free()} point${H0.free() === 1 ? '' : 's'} to spend · one per level`));
    formLine.textContent = F ? `You are becoming: ${F.pure ? `${F.name} (pure ${PATH[F.path].name.toLowerCase()})` : `${F.name} (hybrid of ${PATH[F.path].name} and ${PATH[F.path2].name})`} · ${F.order.slice(0, 3).map((q) => `${PATH[q].name} ${F.sc[q].toFixed(1)}`).join(' · ')}` : '';
    draw();
  };
  const pick = (ev) => {
    const r = cv.getBoundingClientRect(), mx = (ev.clientX - r.left) * (W / r.width), my = (ev.clientY - r.top) * (Hh / r.height);
    let best = null, bd = 18;
    for (const id in T.nodes) { const n = T.nodes[id], d = Math.hypot(X(n) - mx, Y(n) - my); if (d < bd) { bd = d; best = n; } }
    return best;
  };
  cv.addEventListener('pointermove', (ev) => {
    hover = pick(ev);
    if (!hover) { tip.style.display = 'none'; draw(); return; }
    const A = allocSet(), on = A.has(hover.id);
    tip.replaceChildren(h('b', { style: { display: 'block', color: colOf(hover), fontWeight: 400 } }, hover.name), hover.desc, h('small', { style: { display: 'block', marginTop: '4px', color: 'var(--bone-3)' } }, on ? 'Taken' : skCanTake(T, H0.alloc, hover.id) ? (H0.free() > 0 ? 'Click to take' : 'No points to spend') : 'Take a node next to it first'));
    const r = cv.getBoundingClientRect();
    tip.style.display = 'block'; tip.style.left = `${Math.min(r.width - 290, ev.clientX - r.left + 14)}px`; tip.style.top = `${ev.clientY - r.top + 14}px`;
    draw();
  });
  cv.addEventListener('pointerleave', () => { hover = null; tip.style.display = 'none'; draw(); });
  cv.addEventListener('click', (ev) => { const n = pick(ev); if (n && skTake(target, n.id)) { Sound.play('pickup', { p: 1.2 }); refresh(); } });
  const close = () => { alive = false; UI.close(el); if (opts.back) opts.back(); };
  const reset = btn('Reset · 25 embers', () => UI.confirm('Reset this skill tree?', 'Every point comes back to spend again. Accessories from the tree come off.', 'Reset', () => { if ((CD.save.embers || 0) < 25) { toast('Not enough embers'); return; } CD.save.embers -= 25; skReset(target); refresh(); }), 'small');
  const el = h('div', { class: opts.back ? 'screen dim' : 'modal' }, h('div', { style: { display: 'grid', gap: '10px', justifyItems: 'center', width: 'min(100%, 900px)' } },
    head, h('div', { style: { position: 'relative' } }, cv, tip), formLine,
    h('div', { class: 'row' }, H0.ro ? null : reset, btn('Done', close, 'primary', { 'data-autofocus': true }))));
  el._skill = true;
  let alive = true;
  const tick = () => { if (!alive || !el.isConnected) return; draw(); requestAnimationFrame(tick); };
  refresh(); requestAnimationFrame(tick);
  UI.open(el, opts.back ? { onBack: close } : { modal: true, replace: false, onBack: close });
};
CD.skills = { tree: skTree, take: (id) => skTake(G.p, id), form: () => skForm(G.p), scores: () => skScores(G.p) };

