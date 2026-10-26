/* ============================================================
   Cinderdeep — the talent web, a circle of mycelium. Every hero
   and beast has a start on its rim, laid round by element so kin
   stand together, and four roads of its own that run inward: its
   weapon, its ability, its nature and its element. Three rings
   weave every road into its neighbours' roads, so from any start
   you may go along the rim or inward. Inside lies a ring of
   attributes, then the confluences where kin meet, with their
   element's keystones, and at the very middle the chaos wilds:
   a tangle of passives that are never the same two descents
   running, sealed in bands that the Chaos Level opens. The web
   is grown from the list of heroes and beasts, so anyone added
   to that list before this module has a start and roads too.
   ============================================================ */
// two notables for each one's nature, written for its signature passive; anyone new gets a pair made from its numbers
const TALENT_NATURE = {
  knight: [N('Shieldwall', 'Take 6% less damage and +2 armor', (s) => { s.dmgTaken *= 0.94; s.armor += 2; }), N('Unyielding Oath', '+25 max health. Ignore knockback and spikes', (s) => { s.hpAdd += 25; s.sturdy = true; })],
  ranger: [N('Hawk Sight', '+8% crit chance and +10% missile damage', (s) => { s.crit += 0.08; applyStat(s, 'rangedDmg', 0.1); }), N('Clean Through', 'Missiles pierce 2 more foes', (s) => { s.pierceBonus += 2; })],
  pyro: [N('Long Burn', 'Burns last 40% longer and deal 15% more', (s) => { s.burnDur += 0.4; s.burnMul += 0.15; }), N('Meteor Mind', '+25% ability damage', (s) => { s.abDmg += 0.25; })],
  rogue: [N('Throat Slitter', '+40% crit damage', (s) => { s.critMul += 0.4; }), N('Second Shadow', '+1 dash. Dashes recharge 15% faster', (s) => { s.dashMax += 1; s.dashCd *= 0.85; })],
  berserker: [N('Red Mist', '+12% damage and +1% lifesteal', (s) => { s.dmgMul += 0.12; s.lifesteal += 0.01; }), N('Unkillable', 'Kills heal 3', (s) => { s.killHeal += 3; })],
  storm: [N('Overcharge', '+15% shock chance', (s) => { s.shockCh += 0.15; }), N('Arc Mastery', 'Shocks jump to 2 more foes', (s) => { s.shockChain += 2; })],
  necro: [N('Bone Choir', '+40% ally damage', (s) => { applyStat(s, 'allyDmg', 0.4); }), N('Grave Tithe', '+15% souls. Kills heal 1', (s) => { applyStat(s, 'soulGain', 0.15); s.killHeal += 1; })],
  paladin: [N('Hallowed Ground', '+0.6 health per second and +15 max health', (s) => { s.regen += 0.6; s.hpAdd += 15; }), N('Second Aegis', 'Block one hit every 12 seconds', (s) => { s.bulwark = s.bulwark ? Math.min(s.bulwark, 12) : 12; })],
  monk: [N('Still Water', '+8% dodge', (s) => { s.dodge += 0.08; }), N('Hundred Fists', '+12% attack speed', (s) => { s.atkSpd += 0.12; })],
  gunslinger: [N('Fan the Hammer', '+10% attack speed and +8% missile damage', (s) => { s.atkSpd += 0.1; applyStat(s, 'rangedDmg', 0.08); }), N('Dead Eye', '+10% crit chance', (s) => { s.crit += 0.1; })],
  witch: [N('Brewmistress', '+1 potion. Potions heal 25% more', (s) => { s.potMax += 1; s.potHeal += 0.25; }), N('Hexweaver', '+15% ability damage and +8% poison chance', (s) => { s.abDmg += 0.15; s.poisonCh += 0.08; })],
  samurai: [N('Iaijutsu', '+30% crit damage and +4% crit chance', (s) => { s.critMul += 0.3; s.crit += 0.04; }), N('Way of the Blade', '+12% melee damage and +5% move speed', (s) => { applyStat(s, 'meleeDmg', 0.12); s.spdMul += 0.05; })],
  bard: [N('Crescendo', 'Abilities recharge 12% faster', (s) => { s.cdMul *= 0.88; }), N('Rousing Chorus', '+10% damage and +5% move speed', (s) => { s.dmgMul += 0.1; s.spdMul += 0.05; })],
  emberpup: [N('Cinder Coat', '+15% burn chance', (s) => { s.burnCh += 0.15; }), N('Hearth Hound', '+20 max health. Burns deal 20% more', (s) => { s.hpAdd += 20; s.burnMul += 0.2; })],
  mossling: [N('Deep Roots', '+0.8 health per second', (s) => { s.regen += 0.8; }), N('Thorned Bark', 'Foes that touch you take 25 damage. +1 armor', (s) => { s.thorns += 25; s.armor += 1; })],
  frostkit: [N('Winter Coat', '+12% chill chance and +10% max health', (s) => { s.chillCh += 0.12; s.hpMul += 0.1; }), N('Pack Hunter', '+10% move speed and +6% dodge', (s) => { s.spdMul += 0.1; s.dodge += 0.06; })],
  sparkmite: [N('Capacitor', '+15% shock chance', (s) => { s.shockCh += 0.15; }), N('Hard Shell', '+2 armor and +15 max health', (s) => { s.armor += 2; s.hpAdd += 15; })],
  pebblet: [N('Boulder Heart', '+3 armor', (s) => { s.armor += 3; }), N('Rolling Stone', '+30% knockback and +10% damage', (s) => { s.kbMul += 0.3; s.dmgMul += 0.1; })],
  gloomling: [N('Dusk Feast', 'Kills heal 2 and +6% crit chance', (s) => { s.killHeal += 2; s.crit += 0.06; }), N('Wisp of Night', '+8% dodge and +5% move speed', (s) => { s.dodge += 0.08; s.spdMul += 0.05; })],
};
// what an element road's first notable truly gives (the skill tree adds the rest)
const ROAD_TXT = { earth: '+30% knockback and +10% weapon damage', chaos: '+6% damage', luck: '+5% crit chance and +10% gold' };
const PATH_SECTOR = { earth: 0, fire: 1, luck: 2, storm: 3, frost: 3, chaos: 4, venom: 5, shadow: 5 };
const PATH_ATTR = { earth: 'str', fire: 'str', storm: 'dex', luck: 'dex', shadow: 'dex', frost: 'int', chaos: 'int', venom: 'int' };
// where each element's keystones live (Chaos Strain lives in the wilds now)
const PATH_KEYS = { earth: ['unbreakable', 'giantsblood', 'ironwill'], fire: ['avatar', 'bloodrage', 'pyreofruin'], venom: ['vaalpact', 'plaguelord'], shadow: ['acrobatics', 'necropact'], chaos: ['eldritch', 'bornofchaos'], frost: ['overload'], storm: ['stormherald', 'winddancer'], luck: ['fortunesfavour', 'pointblank', 'resolute'] };
const CONFLUENCE = {
  fire: N('Confluence of Fire', '+20% burn chance. Burns deal 20% more', (s) => { s.burnCh += 0.2; s.burnMul += 0.2; }),
  frost: N('Confluence of Frost', '+20% chill chance. Frozen foes take 20% more', (s) => { s.chillCh += 0.2; s.shatter += 0.2; }),
  storm: N('Confluence of Storms', '+20% shock chance. Shocks jump to 1 more foe', (s) => { s.shockCh += 0.2; s.shockChain += 1; }),
  venom: N('Confluence of Venom', '+20% poison chance and +0.5 health per second', (s) => { s.poisonCh += 0.2; s.regen += 0.5; }),
  shadow: N('Confluence of Shadow', '+10% crit chance and +40% crit damage', (s) => { s.crit += 0.1; s.critMul += 0.4; }),
  earth: N('Confluence of Stone', '+3 armor and +15% max health', (s) => { s.armor += 3; s.hpMul += 0.15; }),
  chaos: N('Confluence of Chaos', '+15% damage', (s) => { s.dmgMul += 0.15; }),
  luck: N('Confluence of Fortune', '+4 luck and +10% crit chance', (s) => { s.luck += 4; s.crit += 0.1; }),
};
// the rings of the web, from the rim inward
const WEB_R = { start: 2160, road0: 2050, roadStep: 100, attr: 1230, evo: 1135, conf: 1040, keyVia: 905, key: 810, apexVia: 735, apex: 680 };
// the chaos wilds: bands of the tangle, and the Chaos Level that opens each
const CHAOS_BANDS = [{ r0: 470, r1: 600, n: 40, seal: 0, every: 5 }, { r0: 300, r1: 430, n: 26, seal: 1, every: 4 }, { r0: 145, r1: 265, n: 14, seal: 2, every: 3 }];
const CHAOS_HEART_SEAL = 3;
function talentWeb() {
  const nodes = [], edges = [], startOf = {}, glows = [];
  const order = CLASSES.slice().sort((a, b) => WHEEL.indexOf(skNative(a.id)) - WHEEL.indexOf(skNative(b.id)) || CLASSES.indexOf(a) - CLASSES.indexOf(b));
  const Nn = order.length, step = 360 / Nn;
  const add = (r, deg, type, path, extra = {}) => { const a = (deg * Math.PI) / 180; const n = { id: nodes.length, x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r), type, sector: PATH_SECTOR[path] ?? 4, col: path ? PATH[path].col : '#ff4ad0', links: [], deg, rad: r, ...extra }; nodes.push(n); return n; };
  const link = (a, b) => { if (!a || !b || a === b || a.links.includes(b.id)) return; a.links.push(b.id); b.links.push(a.id); edges.push([a.id, b.id]); };
  const chain = (l) => { for (let i = 1; i < l.length; i++) link(l[i - 1], l[i]); };
  const stat = (r, deg, path, st) => add(r, deg, 'minor', path, { stat: st });
  const attr = (r, deg, path, a) => add(r, deg, 'minor', path, { attr: a });
  const pathMinor = (r, deg, p) => add(r, deg, 'minor', p, { path: p, def: N(`${PATH[p].name} passive`, PATH[p].minorTxt, (s) => PATH[p].minor(s, 1)) });
  const near = (list, deg) => { let best = list[0], bd = 1e9; for (const o of list) { const d = Math.abs(((o.deg - deg + 540) % 360) - 180); if (d < bd) { bd = d; best = o; } } return best; };
  // the rim: a start for everyone, and four roads running inward from each
  const ringRim = [], ringA = [], ringB = [], ends = [];
  order.forEach((c, i) => {
    const th = -90 + i * step, native = skNative(c.id), W0 = WEAPON[c.weapon] || { name: 'Weapon', kind: 'melee' }, A0 = ABILITY[c.ability] || { name: 'Ability' };
    const melee = W0.kind !== 'ranged', tank = c.hp >= 120 || c.armor >= 1, fast = c.spd >= 1.06, seed = hashStr(c.id) >>> 0;
    const st = add(WEB_R.start, th, 'start', native, { cls: c.id }); startOf[c.id] = st;
    glows.push({ deg: th, col: PATH[native].col });
    const natureDefs = TALENT_NATURE[c.id] || [N(`${c.passive.name} Unbound`, tank ? '+30 max health and +1 armor' : fast ? '+8% move speed and +4% dodge' : '+15% damage', tank ? (s) => { s.hpAdd += 30; s.armor += 1; } : fast ? (s) => { s.spdMul += 0.08; s.dodge += 0.04; } : (s) => { s.dmgMul += 0.15; }), N(`Heart of the ${c.name}`, '+10% damage and +10% max health', (s) => { s.dmgMul += 0.1; s.hpMul += 0.1; })];
    const roads = [
      { kind: 'weapon', path: native, attr: melee ? 'str' : 'dex',
        minors: melee ? [['meleeDmg', 0.04, '+4% melee damage'], ['atkSpd', 0.03, '+3% attack speed']] : [['rangedDmg', 0.04, '+4% missile damage'], ['atkSpd', 0.03, '+3% attack speed']],
        n1: melee ? N(`${W0.name} Discipline`, '+15% melee damage and +5% attack speed', (s) => { applyStat(s, 'meleeDmg', 0.15); s.atkSpd += 0.05; }) : N(`${W0.name} Discipline`, '+15% missile damage and +5% attack speed', (s) => { applyStat(s, 'rangedDmg', 0.15); s.atkSpd += 0.05; }),
        n2: [N(`${c.name}'s Edge`, '+8% crit chance and +25% crit damage', (s) => { s.crit += 0.08; s.critMul += 0.25; }), N(`${W0.name} Mastery`, '+20% weapon damage', (s) => { s.wDmg += 0.2; }), N(`Swift ${W0.name}`, '+12% attack speed', (s) => { s.atkSpd += 0.12; })][seed % 3] },
      { kind: 'ability', path: native, attr: 'int', minors: [['abDmg', 0.05, '+5% ability damage'], ['cdMul', 0.975, 'Abilities recharge 2.5% faster']],
        n1: N(`${A0.name} Adept`, '+20% ability damage', (s) => { s.abDmg += 0.2; }),
        n2: [N(`Echoing ${A0.name}`, 'Abilities recharge 10% faster and may recharge at once (8%)', (s) => { s.cdMul *= 0.9; s.echoCast = (s.echoCast || 0) + 0.08; }), N(`${A0.name} Unleashed`, '+30% ability damage', (s) => { s.abDmg += 0.3; }), N(`Quick ${A0.name}`, 'Abilities recharge 15% faster', (s) => { s.cdMul *= 0.85; })][(seed >>> 3) % 3] },
      { kind: 'nature', path: native, attr: tank ? 'str' : fast ? 'dex' : 'int',
        minors: tank ? [['hpAdd', 8, '+8 max health'], ['armor', 1, '+1 armor']] : fast ? [['spdMul', 0.03, '+3% move speed'], ['dodge', 0.02, '+2% dodge']] : [['regen', 0.15, '+0.15 health per second'], ['crit', 0.02, '+2% crit chance']],
        n1: natureDefs[0], n2: natureDefs[1] },
      { kind: 'element', path: native, attr: PATH_ATTR[native], element: true,
        n1: N(`${PATH[native].adj} ${c.name}`, ROAD_TXT[native] || PATH[native].weaponTxt, (s) => PATH[native].weapon(s)),
        n2: N(`${c.name} of ${PATH[native].noun}`, `Three times over: ${PATH[native].minorTxt}`, (s) => PATH[native].minor(s, 3)) },
    ];
    roads.forEach((R, k) => {
      const deg = th + (k - 1.5) * (step / 4.4), list = [];
      for (let j = 0; j < 8; j++) {
        const r = WEB_R.road0 - j * WEB_R.roadStep, own = { owner: c.id, road: R.kind };
        let n;
        if (j === 2) n = add(r, deg, 'notable', R.path, { def: R.n1, path: R.element ? R.path : undefined, ...own });
        else if (j === 6) n = add(r, deg, 'notable', R.path, { def: R.n2, path: R.element ? R.path : undefined, ...own });
        else if (j === 1 || j === 4 || j === 7) n = attr(r, deg, R.path, R.attr);
        else if (R.element) n = pathMinor(r, deg, R.path);
        else n = stat(r, deg, R.path, R.minors[j % 2]);
        Object.assign(n, own);
        list.push(n);
      }
      chain([st, ...list]);
      ringRim.push(list[0]); ringA.push(list[3]); ringB.push(list[5]); ends.push(list[7]);
    });
  });
  // the weave: along the rim and twice more on the way in, every road meets its neighbours
  for (const L of [ringRim, ringA, ringB]) for (let i = 0; i < L.length; i++) link(L[i], L[(i + 1) % L.length]);
  // the ring of attributes where the roads end
  const outer = ends.map((e) => attr(WEB_R.attr, e.deg, null, PATH_ATTR[skNative(e.owner)] || 'str'));
  outer.forEach((o, i) => { o.col = '#bfae94'; link(o, outer[(i + 1) % outer.length]); link(o, ends[i]); });
  // confluences: where kin of an element stand together, their element roads flow into one place
  const groups = [];
  order.forEach((c, i) => { const p = skNative(c.id), last = groups[groups.length - 1]; if (last && last.path === p) last.idx.push(i); else groups.push({ path: p, idx: [i] }); });
  const keyRing = [];
  groups.forEach((G0, gi) => {
    const p = G0.path, deg = -90 + (G0.idx.reduce((a, b) => a + b, 0) / G0.idx.length) * step;
    const center = add(WEB_R.conf, deg, 'notable', p, { def: CONFLUENCE[p], path: p }), wheel = [];
    const ca = (deg * Math.PI) / 180;
    // the wheel faces the rim, the way you come in
    for (let w = 0; w < 5; w++) { const wa = ca + (w - 2) * 0.62, m = pathMinor(0, 0, p); m.x = Math.round(center.x + Math.cos(wa) * 64); m.y = Math.round(center.y + Math.sin(wa) * 64); wheel.push(m); }
    chain(wheel); link(wheel[0], center); link(wheel[4], center);
    const nb = near(outer, deg);
    link(nb, wheel[2]);
    for (const i of G0.idx) { const el = ends[i * 4 + 3]; link(el, wheel[2]); }
    // its keystones further in
    const keys = (PATH_KEYS[p] || []).filter((key) => KEYSTONES[key]);
    keys.forEach((key, k) => { const kd = deg + (k - (keys.length - 1) / 2) * 9, via = pathMinor(WEB_R.keyVia, kd, p), ks = add(WEB_R.key, kd, 'keystone', p, { key, def: KEYSTONES[key] }); link(center, via); link(via, ks); keyRing.push(ks); });
    // and, while they last, the evolution passives
    if (EVO_NODES[gi]) { const ev = add(WEB_R.evo, deg + 5, 'evo', p, { def: EVO_NODES[gi] }); link(nb, ev); link(ev, center); }
    if (APEX_NODES[gi]) { const ks = keyRing.filter((n) => Math.abs(((n.deg - deg + 540) % 360) - 180) < 15), from = ks.length ? ks[Math.floor(ks.length / 2)] : center; const via = pathMinor(WEB_R.apexVia, deg, p), ap = add(WEB_R.apex, deg, 'evo', p, { def: APEX_NODES[gi], apex: true }); link(from, via); link(via, ap); }
  });
  // the chaos wilds: a tangle, rolled the same way every time so the save always fits it
  const bands = CHAOS_BANDS.map((B, b) => {
    const list = [];
    for (let i = 0; i < B.n; i++) {
      const deg = -90 + ((i + 0.5 + (hashU(i, b, 31) - 0.5) * 0.6) / B.n) * 360 + b * 7, r = B.r0 + hashU(i, b, 32) * (B.r1 - B.r0);
      const notable = i % B.every === 0;
      list.push(add(r, deg, notable ? 'notable' : 'minor', 'chaos', { chaos: notable ? 2 : 1, band: b, seal: B.seal }));
    }
    for (let i = 0; i < list.length; i++) link(list[i], list[(i + 1) % list.length]);
    // a few threads across, the way hyphae wander
    list.forEach((n, i) => { if (hashU(i, b, 33) < 0.35) { const m = list[(i + 2 + Math.floor(hashU(i, b, 34) * 3)) % list.length]; if (Math.hypot(m.x - n.x, m.y - n.y) < 260) link(n, m); } });
    return list;
  });
  // every knot of a band reaches the nearest knot of the band inside it
  for (let b = 0; b < bands.length - 1; b++) for (const n of bands[b]) { if (hashU(n.id, b, 35) > 0.55) continue; let best = null, bd = 1e9; for (const m of bands[b + 1]) { const d = Math.hypot(m.x - n.x, m.y - n.y); if (d < bd) { bd = d; best = m; } } link(n, best); }
  // the heart, and Chaos Strain beside it
  const heart = add(0, 0, 'keystone', 'chaos', { key: 'chaosheart', chaos: 3, band: 3, seal: CHAOS_HEART_SEAL });
  bands[2].forEach((n, i) => { if (i % 2 === 0) link(n, heart); });
  const strain = add(205, -90, 'keystone', 'chaos', { key: 'chaosstrain', def: KEYSTONES.chaosstrain, band: 2, seal: CHAOS_BANDS[2].seal });
  link(strain, near(bands[2], -90)); link(strain, heart);
  // spokes: clean roads from the ring of attributes down into the wilds, between the confluences
  groups.forEach((G0, gi) => {
    const last = G0.idx[G0.idx.length - 1], deg = -90 + (last + 0.5) * step, spoke = [];
    for (const r of [1120, 1000, 880, 760, 655]) spoke.push(stat(r, deg, 'chaos', ['dmgMul', 0.02, '+2% damage']));
    spoke.forEach((n) => { n.col = '#c88ab8'; });
    chain([near(outer, deg), ...spoke, near(bands[0], deg)]);
  });
  const starts = order.map((c) => startOf[c.id]);
  TREE.nodes = nodes; TREE.edges = edges; TREE.starts = starts; TREE.startOf = startOf; TREE.glows = glows; TREE.radius = 2300; TREE.heart = heart.id;
}
talentWeb();
treeStart = function (cls) { return TREE.startOf[cls] || TREE.starts[0]; };
CD.talentWeb = () => ({ nodes: TREE.nodes.length, starts: TREE.starts.length, notables: TREE.nodes.filter((n) => n.type === 'notable').length, keystones: TREE.nodes.filter((n) => n.type === 'keystone').length, attrs: TREE.nodes.filter((n) => n.attr).length, chaos: TREE.nodes.filter((n) => n.chaos).length });

