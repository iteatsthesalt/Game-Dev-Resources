/* ============================================================
   Cinderdeep — what talents do. The nodes' effects, keystones,
   evolution and apex nodes, attributes, and the talent screen;
   the talent web (51-talent-web.js) lays the nodes out.
   ============================================================ */
const TREE_VER = 4;
const SECTORS = [
  { id: 'might', name: 'Might', color: '#e2434f', tag: 'defense' },
  { id: 'fury', name: 'Fury', color: '#ff9a3c', tag: 'offense' },
  { id: 'finesse', name: 'Finesse', color: '#74d672', tag: 'utility' },
  { id: 'tempest', name: 'Tempest', color: '#7fc8ff', tag: 'storm' },
  { id: 'arcana', name: 'Arcana', color: '#8a7aff', tag: 'ability' },
  { id: 'blight', name: 'Blight', color: '#c873ff', tag: 'venom' },
];
const CLASS_SECTOR = { knight: 0, paladin: 0, pebblet: 0, berserker: 1, monk: 1, samurai: 1, emberpup: 1, ranger: 2, rogue: 2, gunslinger: 2, frostkit: 2, storm: 3, bard: 3, sparkmite: 3, pyro: 4, witch: 4, necro: 5, mossling: 5, gloomling: 5 };
const sectorOf = (cls) => CLASS_SECTOR[cls] ?? 0;

/* ---------- what nodes do ---------- */
const MULT_KEYS = new Set(['cdMul', 'dmgTaken']);
function applyStat(s, k, v) { if (MULT_KEYS.has(k)) s[k] = (s[k] ?? 1) * v; else s[k] = (s[k] || 0) + v; }
const N = (name, desc, apply, extra = {}) => ({ name, desc, apply, ...extra });
const KEYSTONES = {
  unbreakable: N('Unbreakable', '+4 armor. Take 20% less damage and ignore knockback and spikes. One dash fewer and 10% slower', (s) => { s.armor += 4; s.dmgTaken *= 0.8; s.sturdy = true; s.dashMax = Math.max(1, s.dashMax - 1); s.spdMul -= 0.1; }),
  bloodrage: N('Blood Rage', '+30% damage below half health. You take 15% more damage', (s) => { s.bloodRage = true; s.dmgTaken *= 1.15; }),
  acrobatics: N('Acrobatics', '+20% dodge. 20% less max health', (s) => { s.dodge += 0.2; s.hpMul -= 0.2; }),
  overload: N('Elemental Overload', 'Critical hits always burn, chill and shock', (s) => { s.overload = true; }),
  eldritch: N('Eldritch Battery', 'Abilities recharge 40% faster. Your weapon deals 20% less', (s) => { s.cdMul *= 0.6; s.wDmg -= 0.2; }),
  vaalpact: N('Vaal Pact', 'Lifesteal doubled and kills heal 2. Regeneration and potions are half as strong', (s) => { s.vaal = true; }),
  resolute: N('Resolute Technique', 'Your hits can never crit, but deal 40% more damage', (s) => { s.resolute = true; }),
  pointblank: N('Point Blank', 'Missiles deal up to 40% more up close and 20% less far away', (s) => { s.pointBlank = true; }),
  winddancer: N('Wind Dancer', '+1 dash. Dashing grants 30% more damage for 2s', (s) => { s.dashMax += 1; s.windDancer = true; }),
  avatar: N('Avatar of Fire', '+25% burn chance, burns deal 50% more, and fire cannot hurt you', (s) => { s.burnCh += 0.25; s.burnMul += 0.5; s.fireproof = true; }),
  necropact: N('Necromantic Pact', 'Slain foes rise as your skeletons 15% of the time. 15% less max health', (s) => { s.necroPact = true; s.hpMul -= 0.15; }),
  ironwill: N('Iron Will', '+30% max health and double regeneration. 15% slower attacks', (s) => { s.hpMul += 0.3; s.ironWill = true; s.atkSpd -= 0.15; }),
  chaosstrain: N('Chaos Strain', 'Every evolution or awakening grows a random chaos mutation on you. You take 10% more damage', (s) => { s.chaosStrain = true; s.dmgTaken *= 1.1; }),
};
// evolution nodes: they change what evolving (beasts) or awakening (heroes) does
const EVO_NODES = [
  N('Titanic Growth', 'Once you evolve or awaken: +25% max health and +2 armor', (s) => { s.hpMul += 0.25; s.armor += 2; }, { evo: true }),
  N('Predatory Evolution', 'Once you evolve or awaken: +15% attack speed and +10% crit chance', (s) => { s.atkSpd += 0.15; s.crit += 0.1; }, { evo: true }),
  N('Windborne Evolution', 'Once you evolve or awaken: +15% move speed and +1 dash', (s) => { s.spdMul += 0.15; s.dashMax += 1; }, { evo: true }),
  N('Stormborn Evolution', 'Once you evolve or awaken: +10% shock chance, abilities recharge 10% faster', (s) => { s.shockCh += 0.1; s.cdMul *= 0.9; }, { evo: true }),
  N('Arcane Evolution', 'Each evolution or awakening raises your abilities one level', () => {}, { evo: true, flag: 'arcaneEvo', always: true }),
  N('Primal Acceleration', 'Beasts evolve and heroes awaken 2 levels sooner. Weapons evolve at +2', () => {}, { evo: true, flag: 'primal', always: true }),
];
const APEX_NODES = [
  N('Apex: Colossus', 'Once you evolve or awaken: grow larger, +40% max health, and every third melee swing sends a shockwave', (s) => { s.hpMul += 0.4; s.colossus = true; }, { evo: true, flag: 'colossus' }),
  N('Apex: Bloodstorm', 'Once you evolve or awaken: kills set off a blood nova that hurts foes and heals you', (s) => { s.bloodNova = true; }, { evo: true }),
  N('Apex: Phantom', 'Once you evolve or awaken: +10% dodge, and dashing leaves a slashing afterimage', (s) => { s.dodge += 0.1; s.afterimage = true; }, { evo: true }),
  N('Apex: Thunderlord', 'Once you evolve or awaken: lightning strikes a nearby foe every 3s', (s) => { s.thunderlord = true; }, { evo: true }),
  N('Apex: Archon', 'Once you evolve or awaken: +40% ability damage and abilities may cast twice', (s) => { s.abDmg += 0.4; s.twinSouls = Math.max(s.twinSouls || 0, 0) + 0.2; }, { evo: true }),
  N('Apex: Chimera', 'Beasts that reach their final form also learn the other path’s ability. Heroes awaken twice as strongly', () => {}, { evo: true, flag: 'chimera', always: true }),
];

// the nodes, links and starts; the talent web (51-talent-web.js) grows them from the heroes and beasts
const TREE = { nodes: [], edges: [], starts: [] };

/* ---------- attributes, and the outer keystones ---------- */
const ATTR = { str: { name: 'Strength', short: 'Str', col: '#e2434f' }, dex: { name: 'Dexterity', short: 'Dex', col: '#74d672' }, int: { name: 'Intelligence', short: 'Int', col: '#7fc8ff' } };
const ATTR_IDS = ['str', 'dex', 'int'], ATTR_PER = 5;
Object.assign(KEYSTONES, {
  giantsblood: N("Giant's Blood", '+40% max health. 10% slower', (s) => { s.hpMul += 0.4; s.spdMul -= 0.1; }),
  pyreofruin: N('Pyre of Ruin', 'Burns deal double. Your weapon deals 20% less', (s) => { s.burnMul += 1; s.wDmg -= 0.2; }),
  fortunesfavour: N("Fortune's Favour", '+6 luck and +50% gold. 15% less max health', (s) => { s.luck += 6; s.goldMul += 0.5; s.hpMul -= 0.15; }),
  stormherald: N('Storm Herald', '+15% shock chance and shocks jump to 3 more foes. You take 8% more damage', (s) => { s.shockCh += 0.15; s.shockChain += 3; s.dmgTaken *= 1.08; }),
  bornofchaos: N('Born of Chaos', '+20% damage. You take 10% more damage', (s) => { s.dmgMul += 0.2; s.dmgTaken *= 1.1; }),
  plaguelord: N('Plague Lord', '+25% poison chance and poison spreads when foes die. 15% less max health', (s) => { s.poisonCh += 0.25; s.plague = true; s.hpMul -= 0.15; }),
});
function treeAttrs(cls) {
  const out = { str: 0, dex: 0, int: 0 };
  for (const id of treeAlloc(cls)) { const n = TREE.nodes[id]; if (n && n.attr) out[treeAttrOf(cls, n)] += ATTR_PER; }
  return out;
}
// what attributes are worth
hook('stats', (s, p) => {
  if (!p.cls) return;
  const A = treeAttrs(p.cls);
  s.str = A.str; s.dex = A.dex; s.int = A.int;
  s.hpAdd += A.str * 1; applyStat(s, 'meleeDmg', A.str * 0.003);
  s.atkSpd += A.dex * 0.003; applyStat(s, 'rangedDmg', A.dex * 0.003); s.dodge += A.dex * 0.0006;
  s.abDmg += A.int * 0.004; s.cdMul *= Math.max(0.7, 1 - A.int * 0.0015);
});

const nodeDesc0 = (n) => (n.attr ? `+${ATTR_PER} to an attribute: Strength (health, melee damage), Dexterity (attack speed, missile damage, dodge) or Intelligence (ability damage, faster recharge). Click it once taken to switch.` : n.stat ? n.stat[2] : n.def ? n.def.desc : n.type === 'start' ? `${SECTORS[n.sector].name} start` : '');
const nodeDesc = (n) => { const d = nodeDesc0(n); return typeof talentSealed === 'function' && talentSealed(n) ? `${d} Sealed until Chaos Level ${n.seal}: sacrifice DNA between descents to raise it.` : d; };
const nodeName = (n) => (n.attr ? `${ATTR[n.attr].name} road` : n.def ? n.def.name : n.type === 'start' ? `${SECTORS[n.sector].name}` : SECTORS[n.sector] ? `${SECTORS[n.sector].name} passive` : 'Passive');

/* ---------- allocation ---------- */
function treeHas(cls, nodeOrFlag) {
  const alloc = treeAlloc(cls);
  if (typeof nodeOrFlag === 'string') return alloc.some((id) => { const n = TREE.nodes[id]; return n && n.def && (n.key === nodeOrFlag || n.def.flag === nodeOrFlag); });
  return alloc.includes(nodeOrFlag);
}
function treeAllocate(cls, target) {
  const path = treePath(cls, target), info = classLevelInfo(cls);
  if (!path || !path.length || path.length > info.free) return false;
  treeOf(cls).alloc.push(...path);
  persist();
  treeChanged(cls);
  return true;
}
const REFUND_COST = 3;
function treeRefund(cls, id) {
  if (!treeCanRefund(cls, id)) return 'This passive holds others in place';
  if ((CD.save.embers || 0) < REFUND_COST) return `Refunds cost ${REFUND_COST} embers`;
  CD.save.embers -= REFUND_COST;
  const T = treeOf(cls); T.alloc = T.alloc.filter((x) => x !== id);
  persist(); treeChanged(cls);
  return null;
}
const resetCost = (cls) => (classLevelInfo(cls).lvl <= 5 ? 0 : 40);
function treeChanged(cls) { if (G.p && G.run && G.run.cls === cls && !G.demo) recalcStats(G.p); }

/* ---------- effects ---------- */
hook('stats', (s, p) => {
  if (!p.cls) return;
  const evolved = (p.evoCount || 0) > 0;
  for (const id of treeAlloc(p.cls)) {
    const n = TREE.nodes[id];
    if (!n) continue;
    if (n.stat) applyStat(s, n.stat[0], n.stat[1]);
    else if (n.def) { if (n.def.evo && !n.def.always && !evolved) continue; n.def.apply(s, p); if (n.def.flag) s[n.def.flag] = true; }
  }
  if (s.vaal) { s.lifesteal *= 2; s.killHeal += 2; s.regen *= 0.5; s.potHeal *= 0.5; }
  if (s.ironWill) s.regen *= 2;
  if (s.resolute) s.crit = 0;
  // awakening and chaos mutations
  if (p.awakened) { const k = treeHas(p.cls, 'chimera') ? 2 : 1; s.dmgMul += 0.1 * k; s.hpAdd += 15 * k; }
  for (const m of p.muts || []) if (PLAYER_MUTS[m]) PLAYER_MUTS[m].apply(s);
});
hook('dmgMul', (e, o, p) => {
  const s = p.stats;
  if (o.src === 'trap' || o.src === 'keg') return 1;
  let m = 1;
  const def = p.weapon && WEAPON[p.weapon.id];
  if (o.src === 'weapon' && def) { if (def.kind === 'melee' && s.meleeDmg) m *= 1 + s.meleeDmg; if (def.kind === 'ranged' && s.rangedDmg) m *= 1 + s.rangedDmg; }
  if (o.src === 'ally' && s.allyDmg) m *= 1 + s.allyDmg;
  if (s.resolute && !o.dot) m *= 1.4;
  if (s.rampage && G.combo && G.combo.n >= 10) m *= 1.2;
  if (s.bloodRage && p.hp < p.maxHp * 0.5) m *= 1.3;
  if (s.withering && e.poison) m *= 1.2;
  if (p.windT > 0) m *= 1.3;
  if (s.pointBlank && o.src === 'weapon' && def && def.kind === 'ranged') { const d = Math.hypot(e.x - p.x, e.y - p.y); m *= d < 50 ? 1.4 : d > 130 ? 0.8 : lerp(1.4, 0.8, (d - 50) / 80); }
  return m;
});
hook('onHit', (e, dmg, o, crit) => {
  const p = G.p, s = p.stats;
  if (crit && s.overload && !e.dead) { applyBurn(e, dmg); applyChill(e); if (Math.random() < 0.5) applyShock(e, dmg); }
});
hook('onKill', (e) => {
  const p = G.p, s = p.stats;
  if (e.type !== 'enemy' || e.summoned) return;
  if ((s.necroPact && Math.random() < 0.15) || (s.graveCall && Math.random() < 0.06)) spawnAlly('ally_skel', e.x, e.y, 12);
  if (s.bloodNova) { ring(e.x, e.y - 6, 40, '#e2434f', 0.35, 2); for (const q of G.ents) if (!q.dead && q.type === 'enemy' && q !== e && Math.hypot(q.x - e.x, q.y - e.y) < 40) damageEnemy(q, 10 * (1 + 0.18 * G.fl.idx), { src: 'ability', noCrit: true, silent: true, color: '#ff6a6a' }); heal(p, 2, true); }
});
hook('onDash', (p) => {
  const s = p.stats;
  if (s.windDancer) p.windT = 2;
  if (s.afterimage) { const x = p.x, y = p.y; later(0.3, () => { if (G.p !== p) return; G.fx.push({ kind: 'slash', x, y: y - 8, ang: rnd(TAU), arc: TAU, reach: 26, t: 0, life: 0.25, dir: 1, style: 'spin', color: '#cfe9ff' }); for (const e of G.ents) if (!e.dead && e.type === 'enemy' && Math.hypot(e.x - x, e.y - y) < 30 + e.r) damageEnemy(e, weaponDamage(p) * 0.6, { src: 'ability', ang: Math.atan2(e.y - y, e.x - x), kb: 50 }); Sound.play('swing', { p: 1.4, v: 0.4 }); }); }
});
hook('onAttack', (p, def) => {
  const s = p.stats;
  if (s.colossus && def.kind === 'melee') { p.colN = (p.colN || 0) + 1; if (p.colN % 3 === 0) { const x = p.x + Math.cos(p.aim) * 22, y = p.y - 4 + Math.sin(p.aim) * 18; later(0.08, () => { if (G.p !== p) return; G.fx.push({ kind: 'quakewave', x, y, r: 36, t: 0, life: 0.35 }); for (const e of G.ents) if (!e.dead && e.type === 'enemy' && Math.hypot(e.x - x, e.y - y) < 36 + e.r) damageEnemy(e, weaponDamage(p) * 0.5, { src: 'ability', ang: Math.atan2(e.y - y, e.x - x), kb: 90 }); }); } }
});
hook('update', (dt) => {
  const p = G.p;
  if (!p || p.dead) return;
  const s = p.stats;
  if (p.windT > 0) p.windT -= dt;
  if (s.redMist) p.atkBonus = (p.atkBonus || 0) + (p.hp < p.maxHp * 0.5 ? 0.15 : 0);
  if (s.thunderlord && G.combat) { p.tlT = (p.tlT || 3) - dt; if (p.tlT <= 0) { p.tlT = 3; const t = nearestFoe(p.x, p.y, 150); if (t) lightningStrike(t.x, t.y, 30 * (1 + 0.18 * G.fl.idx)); } }
  if (p.awakenPending && !G.combat && !UI.top() && G.mode === 'play') doAwaken(p);
});

/* ---------- evolving and awakening ---------- */
const PLAYER_MUTS = {
  thirdeye: { name: 'Third Eye', desc: '+10% crit chance', apply: (s) => { s.crit += 0.1; } },
  thickhide: { name: 'Thick Hide', desc: '+3 armor', apply: (s) => { s.armor += 3; } },
  adrenal: { name: 'Adrenal Gland', desc: '+15% attack speed', apply: (s) => { s.atkSpd += 0.15; } },
  gigantism: { name: 'Gigantism', desc: '+20% max health', apply: (s) => { s.hpMul += 0.2; } },
  quickling: { name: 'Quickling', desc: '+12% move speed', apply: (s) => { s.spdMul += 0.12; } },
  extralimb: { name: 'Extra Limb', desc: 'Attacks have a 20% chance to strike twice', apply: (s) => { s.echoAtk += 0.2; } },
  acidblood: { name: 'Acid Blood', desc: 'Foes that hit you are poisoned', apply: (s) => { s.venomBlood = true; } },
  voidheart: { name: 'Void Heart', desc: 'Kills sometimes tear open a rift', apply: (s) => { s.voidRift += 0.1; } },
  stormsoul: { name: 'Storm Soul', desc: '+15% shock chance', apply: (s) => { s.shockCh += 0.15; } },
  emberskin: { name: 'Ember Skin', desc: 'Fire cannot hurt you; foes that touch you burn', apply: (s) => { s.fireproof = true; s.burnTouch = true; } },
  hydraspawn: { name: 'Hydra Spawn', desc: '+1 projectile', apply: (s) => { s.projBonus += 1; } },
  regrowth: { name: 'Regrowth', desc: '+1 health per second', apply: (s) => { s.regen += 1; } },
};
function evoShift(p) { return treeHas(p.cls, 'primal') ? 2 : 0; }
function evoNeed(p) { return treeHas(p.cls, 'primal') ? 2 : 3; }
const awakenLevel = (p) => 10 - evoShift(p);
hook('onLevel', (p) => { if (!p.beast && !p.awakened && p.level >= awakenLevel(p)) p.awakenPending = true; });
function doAwaken(p) {
  p.awakenPending = false; p.awakened = true;
  const S = SECTORS[sectorOf(p.cls)];
  onEvolution(p, 'awaken');
  G.slowmo = Math.max(G.slowmo, 0.5); shake(8);
  ring(p.x, p.y - 10, 70, S.color, 0.8, 3); ring(p.x, p.y - 10, 40, '#ffffff', 0.5, 2);
  burst(p.x, p.y - 10, 50, [S.color, '#ffffff', '#ffd35c'], { smax: 170, glow: true, vz: 140 });
  banner(`Awakened ${CLASS[p.cls].name}`, `the deep has changed you · ${S.name}`, 2.8);
  Sound.play('evolve');
}
function onEvolution(p, kind, formId) {
  p.evoCount = (p.evoCount || 0) + 1;
  const cls = p.cls;
  if (treeHas(cls, 'arcaneEvo')) for (const a of p.abilities) if (a && a.lvl < 3) a.lvl++;
  if (kind === 'evolve' && formId && FORMS[formId].stage === 3 && treeHas(cls, 'chimera')) {
    const other = nextFormsFrom(FORMS[formId]).find((id) => id !== formId);
    if (other) { const ab = FORMS[other].ability; if (!p.abilities.some((a) => a && a.id === ab)) { p.abilities[1] = { id: ab, lvl: p.abilities[1] ? p.abilities[1].lvl : 1, cd: 0, max: 1 }; later(1, () => toast(`Chimera: you also learned ${ABILITY[ab].name}`, '#c873ff')); } }
  }
  if (treeHas(cls, 'chaosstrain')) {
    const pool = Object.keys(PLAYER_MUTS).filter((m) => !(p.muts || []).includes(m));
    if (pool.length) { const m = rndPick(pool); p.muts = [...(p.muts || []), m]; later(1.2, () => { toast(`Mutation: ${PLAYER_MUTS[m].name} · ${PLAYER_MUTS[m].desc}`, '#ff4ad0'); Sound.play('chaos', { p: 1.3 }); }); }
  }
  if (treeHas(cls, 'colossus') || p.stats.colossus) p.sizeMul = 1.25;
  recalcStats(p);
}
function nextFormsFrom(F) { const st = BEAST[F.line].stages[F.stage - 1]; return Array.isArray(st) ? st : [st]; }
hook('saveRun', (c, run, p) => { c.ext = { ...(c.ext || {}), awakened: !!p.awakened, evoCount: p.evoCount || 0, muts: p.muts || [], sizeMul: p.sizeMul || 1 }; });
hook('loadRun', (c, run, p) => { const x = c.ext || {}; p.awakened = !!x.awakened; p.evoCount = x.evoCount || 0; p.muts = x.muts || []; p.sizeMul = x.sizeMul || 1; });
hook('renderWorld', (g, cx, cy) => {
  const p = G.p;
  if (!p || p.dead || !p.awakened || p.beast) return;
  const S = SECTORS[sectorOf(p.cls)];
  if (Math.random() < 0.35) burst(p.x + rnd(-6, 6), p.y - rnd(0, 18), 1, [S.color, '#ffffff'], { grav: -50, floor: false, smax: 10, glow: true, lmax: 0.6 });
});

/* ============================================================
   The tree screen
   ============================================================ */
UI.tree = function (cls, opts = {}) {
  cls = cls || (G.run ? G.run.cls : 'knight');
  const C0 = CLASS[cls], st = treeStart(cls);
  const cv = h('canvas', { class: 'tree-cv', 'aria-label': 'Passive tree' });
  const tip = h('div', { class: 'tree-tip', hidden: true });
  const lvlEl = h('div', { class: 'tree-lvl' }), ptsEl = h('b', { class: 'tree-pts' });
  const search = h('input', { type: 'search', class: 'tree-search', placeholder: 'Search passives', autocomplete: 'off', spellcheck: 'false', oninput: () => { query = search.value.trim().toLowerCase(); } });
  const sumBox = h('div', { class: 'tree-sum', hidden: true });
  let query = '', hover = null, sel = null, view = { x: st.x * 0.8, y: st.y * 0.8, z: 0.5 }, dragging = null, pinch = null;
  const allocSet = () => new Set(treeAlloc(cls));
  const refresh = () => {
    const info = classLevelInfo(cls);
    lvlEl.innerHTML = `<span>${esc(typeof talentLabel === 'function' ? talentLabel(cls) : C0.name)} · Talent Level <b>${info.lvl}</b></span><i><em style="width:${Math.round((info.into / info.need) * 100)}%"></em></i><small>${info.lvl >= MAX_CLASS_LEVEL ? 'Mastered' : `${info.into} / ${info.need} souls to level ${info.lvl + 1}`} · bank souls at DMT zones</small>`;
    ptsEl.textContent = `${info.free} point${info.free === 1 ? '' : 's'} to spend`;
    resetBtn.textContent = resetCost(cls) ? `Reset · ${resetCost(cls)} embers` : 'Reset (free)';
    if (!sumBox.hidden) sumBox.innerHTML = treeSummaryHTML(cls);
  };
  const toWorld = (sx, sy) => { const r = cv.getBoundingClientRect(); return { x: (sx - r.left - r.width / 2) / view.z + view.x, y: (sy - r.top - r.height / 2) / view.z + view.y }; };
  const pick = (sx, sy) => { const w = toWorld(sx, sy); let best = null, bd = 1e9; for (const n of TREE.nodes) { const d = Math.hypot(n.x - w.x, n.y - w.y), rr = nodeR(n) + 6 / view.z; if (d < rr && d < bd) { bd = d; best = n; } } return best; };
  const showTip = (n, sx, sy) => {
    if (!n) { tip.hidden = true; return; }
    const alloc = allocSet(), path = treePath(cls, n.id), info = classLevelInfo(cls);
    const S = SECTORS[n.sector], kind = (n.chaos ? 'Chaos · ' : '') + (n.type === 'keystone' ? 'Keystone' : n.type === 'evo' ? (n.def && n.def.flag ? 'Evolution' : 'Evolution · after you evolve or awaken') : n.type === 'notable' ? 'Notable' : n.type === 'start' ? 'Start' : 'Passive');
    let state = '';
    if (n.id === st.id) state = 'Your starting point';
    else if (n.type === 'start') state = n.cls && CLASS[n.cls] ? `The ${CLASS[n.cls].name} starts here` : 'Another archetype starts here';
    else if (alloc.has(n.id)) state = `${treeCanRefund(cls, n.id) ? `Allocated · click again to refund (${REFUND_COST} embers)` : 'Allocated'}${typeof talentWhose === 'function' ? ` · ${talentWhose(n.id)}` : ''}`;
    else if (!path) state = typeof talentSealed === 'function' && talentSealed(n) ? `Sealed until Chaos Level ${n.seal}` : 'Out of reach';
    else state = `${path.length} point${path.length === 1 ? '' : 's'} to reach${path.length > info.free ? ' · not enough points' : ' · click to allocate'}`;
    tip.innerHTML = `<b style="color:${n.type === 'minor' ? 'var(--bone)' : n.col || (S ? S.color : '#ff4ad0')}">${esc(nodeName(n))}</b><small>${esc(kind)}</small><p>${esc(nodeDesc(n))}</p><em>${esc(state)}</em>`;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    tip.style.left = clamp(sx - r.left + 16, 8, r.width - 260) + 'px'; tip.style.top = clamp(sy - r.top + 16, 60, r.height - 140) + 'px';
  };
  const act = (n) => {
    if (!n || n.type === 'start') return;
    const alloc = allocSet();
    if (alloc.has(n.id) && typeof talentLayer === 'function' && !treeOf(cls).alloc.includes(n.id)) { toast(typeof talentWhose === 'function' ? `${talentWhose(n.id)}: only those points can change it` : 'Not yours to change'); Sound.play('deny'); return; }
    if (alloc.has(n.id) && n.attr && treeAttrOf(cls, n) !== ATTR_IDS[(ATTR_IDS.indexOf(n.attr) + 2) % 3]) { const a = treeCycleAttr(cls, n.id); toast(`+${ATTR_PER} ${ATTR[a].name}`, ATTR[a].col); Sound.play('ui'); }
    else if (alloc.has(n.id)) { if (n.attr) { const T = treeOf(cls); if (T.attr) delete T.attr[n.id]; } const err = treeRefund(cls, n.id); if (err) { toast(err); Sound.play('deny'); } else Sound.play('back'); }
    else if (treeAllocate(cls, n.id)) { Sound.play(n.type === 'keystone' || n.type === 'evo' ? 'ascend' : 'pickup', { p: 1.2 }); flashT = 0.4; flashN = n.id; }
    else { const path = treePath(cls, n.id); toast(!path ? 'Out of reach' : 'Not enough points'); Sound.play('deny'); }
    refresh();
  };
  let flashT = 0, flashN = -1, last = performance.now(), moved = 0, downAt = null;
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    if (dragging && dragging.id !== e.pointerId) { pinch = { d: Math.hypot(e.clientX - dragging.x, e.clientY - dragging.y), z: view.z, other: { id: e.pointerId, x: e.clientX, y: e.clientY } }; return; }
    dragging = { id: e.pointerId, x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; moved = 0; downAt = { x: e.clientX, y: e.clientY };
  });
  cv.addEventListener('pointermove', (e) => {
    if (pinch && dragging) {
      if (e.pointerId === pinch.other.id) { pinch.other.x = e.clientX; pinch.other.y = e.clientY; } else if (e.pointerId === dragging.id) { dragging.x2 = e.clientX; dragging.y2 = e.clientY; }
      const ax = dragging.x2 ?? dragging.x, ay = dragging.y2 ?? dragging.y, d = Math.hypot(pinch.other.x - ax, pinch.other.y - ay);
      view.z = clamp(pinch.z * (d / Math.max(10, pinch.d)), 0.12, 2.2); return;
    }
    if (dragging && e.pointerId === dragging.id) {
      const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y; moved = Math.max(moved, Math.hypot(dx, dy));
      if (moved > 6) { view.x = dragging.vx - dx / view.z; view.y = dragging.vy - dy / view.z; tip.hidden = true; }
      return;
    }
    hover = pick(e.clientX, e.clientY); showTip(hover, e.clientX, e.clientY);
  });
  const up = (e) => {
    if (pinch && (e.pointerId === pinch.other.id || (dragging && e.pointerId === dragging.id))) { pinch = null; dragging = null; return; }
    if (dragging && e.pointerId === dragging.id) {
      if (moved <= 6) {
        const n = pick(e.clientX, e.clientY);
        if (e.pointerType === 'touch' && (!sel || sel !== n)) { sel = n; hover = n; showTip(n, e.clientX, e.clientY); }
        else act(n);
      }
      dragging = null;
    }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const w0 = toWorld(e.clientX, e.clientY); view.z = clamp(view.z * (e.deltaY > 0 ? 0.88 : 1.14), 0.12, 2.2); const w1 = toWorld(e.clientX, e.clientY); view.x += w0.x - w1.x; view.y += w0.y - w1.y; }, { passive: false });
  const zoomBy = (k) => { view.z = clamp(view.z * k, 0.12, 2.2); };
  const resetBtn = btn('Reset', () => UI.confirm('Reset this tree?', `Every passive returns to the pool${resetCost(cls) ? ` for ${resetCost(cls)} embers` : ''}.`, 'Reset', () => { const err = treeReset(cls); if (err) toast(err); refresh(); }), 'small');
  const close = () => { UI.close(el); if (opts.onClose) opts.onClose(); };
  const el = h('div', { class: 'modal treemodal' },
    cv,
    h('div', { class: 'tree-head' },
      h('div', { class: 'tree-title' }, h('h2', {}, 'Talent Tree'), lvlEl),
      h('div', { class: 'tree-ctl' }, ptsEl, search,
        btn('−', () => zoomBy(0.8), 'small', { 'aria-label': 'Zoom out' }), btn('+', () => zoomBy(1.25), 'small', { 'aria-label': 'Zoom in' }),
        btn('Home', () => { view.x = st.x * 0.8; view.y = st.y * 0.8; view.z = 0.5; }, 'small'), btn('Heart', () => { view.x = 0; view.y = 0; view.z = 0.6; }, 'small'),
        btn('Totals', () => { sumBox.hidden = !sumBox.hidden; refresh(); }, 'small'),
        resetBtn, btn('Done', close, 'primary', { 'data-autofocus': true }))),
    sumBox, tip,
    h('div', { class: 'tree-hint' }, Input.device === 'touch' ? 'Tap a node to inspect, tap again to allocate. Drag to pan, pinch to zoom.' : Input.device === 'pad' ? 'Stick moves the cursor · A allocates · X refunds · bumpers zoom · B closes' : 'Click a node to allocate the path to it. Drag to pan, scroll to zoom. Click an allocated node to refund it.'));
  // gamepad and keyboard: a cursor that hops between nodes
  let cursor = treeAlloc(cls).length ? TREE.nodes[treeAlloc(cls)[treeAlloc(cls).length - 1]] : st;
  el._customNav = (A) => {
    if (document.activeElement === search) return false;
    const P = Input.pad;
    let dx = 0, dy = 0;
    if (A.navLeft) dx = -1; if (A.navRight) dx = 1; if (A.navUp) dy = -1; if (A.navDown) dy = 1;
    if (dx || dy) {
      let best = null, bs = 1e9;
      for (const n of TREE.nodes) { if (n === cursor) continue; const vx = n.x - cursor.x, vy = n.y - cursor.y, d = Math.hypot(vx, vy); if (d < 1 || d > 260) continue; const dot = (vx * dx + vy * dy) / d; if (dot < 0.55) continue; const sc = d * (2 - dot); if (sc < bs) { bs = sc; best = n; } }
      if (best) { cursor = best; hover = best; Sound.play('ui', { v: 0.4 }); const r = cv.getBoundingClientRect(); showTip(best, r.left + r.width / 2 + (best.x - view.x) * view.z, r.top + r.height / 2 + (best.y - view.y) * view.z); }
      return true;
    }
    if (A.confirm && document.activeElement && document.activeElement.tagName === 'BUTTON' && !el._padMode) return false;
    if ((A.confirm && Input.device !== 'kbm') || (Input.edge && Input.edge.has('Enter') && hover)) { act(cursor); return true; }
    if (P.edge.has(2) && cursor) { act(cursor); return true; }
    if (P.edge.has(4)) zoomBy(0.8); if (P.edge.has(5)) zoomBy(1.25);
    return false;
  };
  const draw = () => {
    if (!el.isConnected) return;
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (flashT > 0) flashT -= dt;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    // stick pans, and the cursor stays in view
    const A = Input.act;
    if (Input.device === 'pad') { const P = Input.pad; view.x += P.rx * 600 * dt / view.z; view.y += P.ry * 600 * dt / view.z; if (cursor) { view.x = lerp(view.x, cursor.x, 0.06); view.y = lerp(view.y, cursor.y, 0.06); } }
    else if (Input.device === 'kbm' && document.activeElement !== search && (A.mx || A.my) && !A.navLeft && !A.navRight && !A.navUp && !A.navDown) { view.x += A.mx * 500 * dt / view.z; view.y += A.my * 500 * dt / view.z; }
    renderTree(cv.getContext('2d'), cv.width, cv.height, dpr, view, cls, { hover: hover ? hover.id : -1, cursor: Input.device !== 'kbm' && Input.device !== 'touch' ? cursor.id : -1, query, flashN: flashT > 0 ? flashN : -1, flashT });
    requestAnimationFrame(draw);
  };
  UI.open(el, { modal: G.mode === 'play', replace: G.mode !== 'play', onBack: close });
  refresh();
  requestAnimationFrame(draw);
  return el;
};
const nodeR = (n) => (n.type === 'start' ? 24 : n.type === 'keystone' ? 18 : n.type === 'evo' ? 15 : n.type === 'notable' ? 12 : 7);
const TREE_STARS = Array.from({ length: 700 }, (_, i) => [hashU(i, 1, 7) * 4600 - 2300, hashU(i, 2, 7) * 4600 - 2300, hashU(i, 3, 7)]);
function renderTree(g, W, H, dpr, view, cls, o) {
  const alloc = new Set(treeAlloc(cls)), st = treeStart(cls), t = performance.now() / 1000;
  const z = view.z * dpr, ox = W / 2 - view.x * z, oy = H / 2 - view.y * z;
  const X = (x) => ox + x * z, Y = (y) => oy + y * z;
  const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
  gr.addColorStop(0, '#1c1418'); gr.addColorStop(1, '#060406');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // sector glows and stars
  g.globalCompositeOperation = 'lighter';
  (TREE.glows || SECTORS.map((S, s) => ({ deg: -90 + s * 60, col: S.color }))).forEach((G0) => { const a = (G0.deg * Math.PI) / 180, x = X(Math.cos(a) * 1100), y = Y(Math.sin(a) * 1100), r = 520 * z; const sg = g.createRadialGradient(x, y, 0, x, y, r); sg.addColorStop(0, rgbaStr(G0.col, 0.08)); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(x - r, y - r, r * 2, r * 2); });
  for (const [sx, sy, b] of TREE_STARS) { g.fillStyle = `rgba(255,240,220,${(0.15 + b * 0.35 + Math.sin(t * 2 + b * 9) * 0.1).toFixed(3)})`; g.fillRect(X(sx), Y(sy), Math.max(1, dpr), Math.max(1, dpr)); }
  g.globalCompositeOperation = 'source-over';
  // the chaos at the heart: a slow swirl, and the seals the Chaos Level opens
  if (typeof chaosLevel === 'function') {
    const cx = X(0), cy = Y(0), R0 = 660 * z, CL = chaosLevel();
    g.globalCompositeOperation = 'lighter';
    const hg = g.createRadialGradient(cx, cy, 0, cx, cy, R0); hg.addColorStop(0, `rgba(255,74,208,${0.16 + 0.02 * Math.min(CL, 6)})`); hg.addColorStop(0.55, 'rgba(127,232,255,0.05)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = hg; g.fillRect(cx - R0, cy - R0, R0 * 2, R0 * 2);
    g.lineWidth = 1.5 * dpr;
    for (let k = 0; k < 5; k++) { g.strokeStyle = rgbaStr(CHAOS_HUES[k], 0.14); g.beginPath(); for (let i = 0; i <= 48; i++) { const u = i / 48, a = t * 0.12 + (k * TAU) / 5 + u * 4.4, r = u * 630 * z; if (i) g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); else g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.stroke(); }
    g.globalCompositeOperation = 'source-over';
    for (const B of [...CHAOS_BANDS.filter((b) => b.seal > 0), { r1: 70, seal: CHAOS_HEART_SEAL }]) {
      if (CL >= B.seal) continue;
      g.setLineDash([6 * dpr, 6 * dpr]); g.strokeStyle = 'rgba(255,74,208,0.55)'; g.lineWidth = 2 * dpr;
      g.beginPath(); g.arc(cx, cy, (B.r1 + 22) * z, 0, TAU); g.stroke(); g.setLineDash([]);
      if (view.z > 0.25) { g.fillStyle = 'rgba(255,190,235,0.85)'; g.font = `${Math.round(11 * dpr * Math.max(0.8, view.z))}px "Jersey 15", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(`SEALED · CHAOS LEVEL ${B.seal}`, cx, cy - (B.r1 + 26) * z); }
    }
  }
  // reachable preview path
  const path = o.hover >= 0 ? treePath(cls, o.hover) || [] : [];
  const pathSet = new Set(path);
  const have = new Set([st.id, ...alloc, ...(typeof talentLayer === 'function' && talentLayer(cls) === 'shared' ? TREE.starts.map((n) => n.id) : [])]);
  // who placed each passive: everyone's points ring gold, yours white, the living blue, the fallen violet
  const owners = typeof talentOwners === 'function' ? talentOwners() : new Map(), trails = typeof talentShared === 'function' ? talentShared().trails || {} : {};
  const me = typeof talentLayer === 'function' && talentLayer(cls) === 'own' && curChar() ? curChar().id : null;
  const ringOf = (id) => { if (!owners.has(id)) return null; const k = owners.get(id); return k == null ? '#ffc65a' : k === me ? '#ffffff' : trails[k] && trails[k].fell ? '#9a86c8' : '#7fe8ff'; };
  const lit = (id) => alloc.has(id) || TREE.nodes[id].type === 'start';
  // edges: hyphae of the network, with light running along what has grown
  TREE.edges.forEach(([a, b], ei) => {
    const A = TREE.nodes[a], B = TREE.nodes[b], x1 = X(A.x), y1 = Y(A.y), x2 = X(B.x), y2 = Y(B.y);
    if ((x1 < -60 && x2 < -60) || (y1 < -60 && y2 < -60) || (x1 > W + 60 && x2 > W + 60) || (y1 > H + 60 && y2 > H + 60)) return;
    const on = lit(a) && lit(b) && (alloc.has(a) || alloc.has(b)), prev = (pathSet.has(a) || have.has(a)) && (pathSet.has(b) || have.has(b)) && (pathSet.has(a) || pathSet.has(b));
    const ch = A.chaos || B.chaos, col = on ? (ch ? CHAOS_HUES[(ei + Math.floor(t * 3)) % CHAOS_HUES.length] : '#ffc65a') : prev ? '#7fe8ff' : (have.has(a) || have.has(b)) ? '#6a5a4e' : ch ? '#3e2440' : '#33292c';
    mycHypha(g, x1, y1, x2, y2, ei * 2654435761, { lit: on || prev, col, dimCol: col, t, width: (on ? 4 : prev ? 3 : 2) * dpr * Math.max(0.6, view.z) });
  });
  // nodes
  const q = o.query;
  for (const n of TREE.nodes) {
    const x = X(n.x), y = Y(n.y), r = nodeR(n) * z;
    if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue;
    const S = SECTORS[n.sector], col = n.chaos ? CHAOS_HUES[(n.id + Math.floor(t * 2)) % CHAOS_HUES.length] : n.col || (S ? S.color : '#ff4ad0'), ringCol = ringOf(n.id);
    g.globalAlpha = typeof talentSealed === 'function' && talentSealed(n) ? 0.35 : 1;
    const isAlloc = alloc.has(n.id) || n.id === st.id, avail = !isAlloc && n.links.some((l) => have.has(l)) && n.type !== 'start';
    const match = q && (nodeName(n) + ' ' + nodeDesc(n)).toLowerCase().includes(q);
    if (isAlloc && n.type !== 'minor') { g.globalCompositeOperation = 'lighter'; const lg = g.createRadialGradient(x, y, 0, x, y, r * 2.6); lg.addColorStop(0, rgbaStr(col, 0.5)); lg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = lg; g.fillRect(x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2); g.globalCompositeOperation = 'source-over'; }
    g.beginPath();
    if (n.type === 'evo') { g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); }
    else if (n.type === 'keystone') { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + Math.PI / 8; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.closePath(); }
    else g.arc(x, y, r, 0, TAU);
    g.fillStyle = isAlloc ? (n.type === 'minor' ? (n.attr ? ATTR[treeAttrOf(cls, n)].col : '#ffd35c') : col) : n.type === 'start' ? '#2a2024' : n.attr ? rgbaStr(ATTR[n.attr].col, 0.25) : '#1e171a';
    g.fill();
    g.lineWidth = (n.type === 'minor' ? 1.5 : 3) * dpr * Math.max(0.6, view.z);
    g.strokeStyle = isAlloc ? ringCol || '#fff3c0' : avail ? '#ffd35c' : n.type === 'minor' ? '#5a4a4e' : rgbaStr(col, 0.75);
    g.stroke();
    if (ringCol) { g.strokeStyle = rgbaStr(ringCol, 0.75); g.lineWidth = 1.5 * dpr * Math.max(0.6, view.z); g.beginPath(); g.arc(x, y, r + 3 * dpr * Math.max(0.6, view.z), 0, TAU); g.stroke(); }
    if (n.type !== 'minor' && n.type !== 'start') { g.fillStyle = isAlloc ? '#1a1214' : rgbaStr(col, 0.9); g.beginPath(); g.arc(x, y, r * 0.32, 0, TAU); g.fill(); }
    if (n.type === 'start') {
      g.fillStyle = rgbaStr(col, 0.9); g.font = `${Math.round(12 * dpr * Math.max(0.7, view.z))}px "Jersey 15", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText((n.cls && CLASS[n.cls] ? CLASS[n.cls].name : S ? S.name : '').toUpperCase(), x, y + r + 12 * dpr * Math.max(0.7, view.z));
      if (n.cls && CLASS[n.cls]) { const C1 = CLASS[n.cls], sp = C1.beast ? beastFrames(n.cls)[0] : heroSprites(C1.look, n.cls).front[0]; const k = (r * 1.4) / Math.max(sp.w, sp.h); g.imageSmoothingEnabled = false; g.drawImage(sp.c, Math.round(x - (sp.w * k) / 2), Math.round(y - (sp.h * k) / 2), Math.round(sp.w * k), Math.round(sp.h * k)); }
    }
    if (match) { g.strokeStyle = `rgba(255,255,255,${(0.5 + Math.sin(t * 8) * 0.4).toFixed(2)})`; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(x, y, r + 6 * dpr, 0, TAU); g.stroke(); }
    if (n.id === o.hover || n.id === o.cursor) { g.strokeStyle = '#ffffff'; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(x, y, r + 4 * dpr, 0, TAU); g.stroke(); }
    if (n.id === o.flashN) { g.strokeStyle = rgbaStr('#ffffff', o.flashT * 2); g.lineWidth = 3 * dpr; g.beginPath(); g.arc(x, y, r + (0.4 - o.flashT) * 60 * dpr, 0, TAU); g.stroke(); }
    if ((n.type === 'keystone' || n.type === 'evo' || (n.type === 'notable' && view.z > 0.9)) && view.z > 0.45) {
      g.fillStyle = isAlloc ? '#fff3c0' : n.type === 'notable' ? '#bfae94' : col; g.font = `${Math.round((n.type === 'notable' ? 11 : 13) * dpr * Math.max(0.8, view.z))}px "Jersey 15", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillText(nodeName(n), x, y + r + 4 * dpr);
    }
  }
  g.globalAlpha = 1;
}
function treeSummaryHTML(cls) {
  const tot = {}, names = [];
  for (const id of treeAlloc(cls)) { const n = TREE.nodes[id]; if (!n) continue; if (n.stat) { const [k, v, d] = n.stat; const key = d.replace(/[+\-]?[\d.]+%?/, '#'); tot[key] = tot[key] || { v: 0, d, mult: MULT_KEYS.has(k), k }; tot[key].v += MULT_KEYS.has(k) ? 0 : v; tot[key].n = (tot[key].n || 0) + 1; } else if (n.def) names.push(n.def.name); }
  const lines = Object.values(tot).map((x) => { const num = x.d.match(/[\d.]+/); const per = num ? parseFloat(num[0]) : 0; return x.d.replace(/[\d.]+/, String(Math.round(per * x.n * 10) / 10)); });
  const A = treeAttrs(cls);
  return `<h3>Attributes</h3><p>Strength ${A.str} · Dexterity ${A.dex} · Intelligence ${A.int}</p><h3>From small passives</h3><p>${lines.length ? lines.map(esc).join(' · ') : 'Nothing yet.'}</p><h3>Notables, keystones and evolutions</h3><p>${names.length ? names.map(esc).join(' · ') : 'None yet.'}</p>`;
}

