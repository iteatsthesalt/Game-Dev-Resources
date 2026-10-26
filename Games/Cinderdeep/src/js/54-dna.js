/* ============================================================
   Cinderdeep — DNA, the third circle. Every level earns a DNA
   point as well as a skill point. DNA is spent on what a
   character is made of: their skill, their weapons and their
   accessories, or on any of those they have held before, which
   their DNA remembers. Slaying bosses opens new strands, and with
   them the power to rearrange DNA into new weapons, skills and
   accessories. Between descents a character may keep their DNA,
   losing half their points or more, or sacrifice it all to raise
   the Chaos Level.
   ============================================================ */
const DNA_COL = { ab: '#b98cff', wp: '#ff8a5c', acc: '#ffd35c', core: '#7fe8ff' };
const DNA_STRAND = { ab: 'Skill', wp: 'Weapons', acc: 'Accessories' };
const DNA_MILES = [
  { id: 'wp', need: 1, name: 'Strand of Steel', txt: 'Rearrange weapons into new ones' },
  { id: 'ab', need: 2, name: 'Strand of Will', txt: 'Rearrange skills into new ones' },
  { id: 'acc', need: 3, name: 'Strand of Fortune', txt: 'Rearrange accessories into new ones' },
  { id: 'free', need: 4, name: 'Strand of Chaos', txt: 'Reset your DNA for free, and lose only half when you carry it on' },
];
const DNA_SPLICE_MAX = 3, DNA_RESET_COST = 15, DNA_AFFIX_CAP = 3;
const WP_WORD = { sword: 'Blade', greatsword: 'Titan', daggers: 'Twin', spear: 'Lance', axe: 'Cleaver', hammer: 'Quake', scythe: 'Reaper', gauntlets: 'Fist', bow: 'Arrow', crossbow: 'Bolt', knives: 'Knife', boomerang: 'Wheel', firestaff: 'Ember', frostwand: 'Rime', stormrod: 'Storm', venomtome: 'Venom', cannon: 'Blast', orb: 'Arcane' };
const WP_TRAIT = { sword: 'keen', greatsword: 'heavy', daggers: 'keen', spear: 'reach', axe: 'brutal', hammer: 'heavy', scythe: 'vamp', gauntlets: 'swift', bow: 'swift', crossbow: 'pierce', knives: 'twin', boomerang: 'pierce', firestaff: 'flaming', frostwand: 'frost', stormrod: 'storm', venomtome: 'venom', cannon: 'twin', orb: 'keen' };
const AB_WORD = { bash: 'Shield', rain: 'Arrow', meteor: 'Meteor', shadowstep: 'Shadow', whirlwind: 'Whirling', chain: 'Thunder', legion: 'Bone', fireball: 'Fire', nova: 'Frost', slam: 'Quake', fan: 'Blade', heal: 'Mending', warp: 'Time', turret: 'Arcane', wolf: 'Wolf', cloud: 'Plague', barrier: 'Warded' };
const firstWord = (s) => String(s).split(' ')[0], lastWord = (s) => String(s).split(' ').pop();

/* ---------- what a character's DNA remembers ---------- */
function chDna(ch) {
  if (!ch) return null;
  const D = ch.dna || (ch.dna = {});
  D.lib = D.lib || {};
  for (const k of ['ab', 'wp', 'af', 'acc']) D.lib[k] = Array.isArray(D.lib[k]) ? D.lib[k] : [];
  D.spl = Array.isArray(D.spl) ? D.spl : [];
  D.bosses = D.bosses || 0; D.carries = D.carries || 0;
  if (!D.uid) D.uid = ((Math.random() * 1e9) | 0).toString(36);
  dnaRegister(D);
  return D;
}
const dnaMile = (D, id) => !!D && D.bosses >= DNA_MILES.find((m) => m.id === id).need;
const runChar = () => (G.run && G.run.charId && !G.demo && !G.run.realm && typeof charById === 'function' ? charById(G.run.charId) : null);
// accessories made by rearranging are real accessories, known by id
const dnaSplRelic = (D, i) => `acc_spl_${D.uid}_${i}`;
function dnaRegister(D) {
  D.spl.forEach((S0, i) => {
    if (S0.kind !== 'acc') return;
    const id = dnaSplRelic(D, i), A = RELIC[S0.a], B = RELIC[S0.b];
    if (RELIC[id] || !A || !B) return;
    RELIC[id] = { id, acc: true, spliced: true, name: S0.name, desc: `${A.desc} ${B.desc} Rearranged: +5% damage.`, apply: (s) => { A.apply(s); B.apply(s); s.dmgMul += 0.05; } };
  });
}

/* ---------- the genes a character can express ---------- */
function dnaGenes(cls, D) {
  const c = CLASS[cls] || CLASSES[0], A0 = ABILITY[c.ability] || { name: 'Skill' }, W0 = WEAPON[c.weapon] || { name: 'Weapon' }, beast = !!c.beast;
  const out = {}, add = (g) => { out[g.id] = g; return g; };
  const accN = (p) => (p ? p.relics.filter((r) => RELIC[r] && RELIC[r].acc).length : 0);
  // the skill strand
  add({ id: 'ab:1', strand: 'ab', step: 1, cost: 1, name: `${A0.name} · Rank II`, desc: `Your ${A0.name} rises to rank II: it hits 40% harder and recharges 12% faster.` });
  add({ id: 'ab:2', strand: 'ab', step: 2, cost: 1, name: `Quickened ${A0.name}`, desc: 'Abilities recharge 12% faster.', apply: (s) => { s.cdMul *= 0.88; } });
  add({ id: 'ab:3', strand: 'ab', step: 3, cost: 2, name: `${A0.name} · Rank III`, desc: `Your ${A0.name} rises to rank III: it hits 85% harder than at first and recharges 24% faster.` });
  add({ id: 'ab:4', strand: 'ab', step: 4, cost: 1, name: `Potent ${A0.name}`, desc: '+25% ability damage.', apply: (s) => { s.abDmg += 0.25; } });
  add({ id: 'ab:5', strand: 'ab', step: 5, cost: 2, name: `Echoing ${A0.name}`, desc: 'Abilities have a 15% chance to be ready again at once.', apply: (s) => { s.echoCast = (s.echoCast || 0) + 0.15; } });
  // the weapon strand
  const wn = beast ? 'Claws' : W0.name;
  add({ id: 'wp:1', strand: 'wp', step: 1, cost: 1, name: `Honed ${wn}`, desc: '+12% weapon damage.', apply: (s) => { s.wDmg += 0.12; } });
  add({ id: 'wp:2', strand: 'wp', step: 2, cost: 1, name: `Balanced ${wn}`, desc: '+10% attack speed.', apply: (s) => { s.atkSpd += 0.1; } });
  add({ id: 'wp:3', strand: 'wp', step: 3, cost: 1, name: `Keen ${wn}`, desc: '+5% crit chance and +20% crit damage.', apply: (s) => { s.crit += 0.05; s.critMul += 0.2; } });
  add({ id: 'wp:4', strand: 'wp', step: 4, cost: 1, name: `Long ${wn}`, desc: '+15% reach and range.', apply: (s) => { s.reachMul += 0.15; } });
  add({ id: 'wp:5', strand: 'wp', step: 5, cost: 2, name: `Masterwork ${wn}`, desc: '+20% weapon damage and +20% knockback.', apply: (s) => { s.wDmg += 0.2; s.kbMul += 0.2; } });
  // the accessory strand
  add({ id: 'acc:1', strand: 'acc', step: 1, cost: 1, name: beast ? 'Trinket Hoard' : 'Trinket Pouch', desc: '+2 luck and +5% gold.', apply: (s) => { s.luck += 2; s.goldMul += 0.05; } });
  add({ id: 'acc:2', strand: 'acc', step: 2, cost: 1, name: 'Resonance', desc: 'Every accessory you wear gives +3% damage.', apply: (s, p) => { s.dmgMul += 0.03 * accN(p); } });
  add({ id: 'acc:3', strand: 'acc', step: 3, cost: 1, name: 'Warded Clasp', desc: '+1 armor and +10 max health.', apply: (s) => { s.armor += 1; s.hpAdd += 10; } });
  add({ id: 'acc:4', strand: 'acc', step: 4, cost: 2, name: 'Twinned Charm', desc: 'The first accessory you wear works twice.', apply: (s, p) => { const id = p && p.relics.find((r) => RELIC[r] && RELIC[r].acc); if (id) RELIC[id].apply(s); } });
  add({ id: 'acc:5', strand: 'acc', step: 5, cost: 2, name: 'Heirloom', desc: 'Every accessory you wear gives +0.2 health per second and +1 luck.', apply: (s, p) => { const k = accN(p); s.regen += 0.2 * k; s.luck += k; } });
  if (!D) return out;
  // what they remember
  for (const id of D.lib.ab) if (ABILITY[id] && id !== c.ability) add({ id: `ab:lib:${id}`, strand: 'ab', lib: true, cost: 2, item: id, excl: 'ab2', name: `Second skill: ${ABILITY[id].name}`, desc: `Learn ${ABILITY[id].name} as your second skill. ${ABILITY[id].desc}` });
  if (!beast) for (const id of D.lib.wp) if (WEAPON[id] && id !== c.weapon) add({ id: `wp:lib:${id}`, strand: 'wp', lib: true, cost: 2, item: id, excl: 'wp2', name: `Carry the ${WEAPON[id].name}`, desc: `An uncommon ${WEAPON[id].name} in your other hand. ${WEAPON[id].desc}` });
  for (const id of D.lib.af) if (AFFIX[id]) add({ id: `wp:af:${id}`, strand: 'wp', lib: true, cost: 1, affix: id, cap: 'af', name: `${AFFIX[id].name} gene`, desc: `Everything you hit with is ${AFFIX[id].name.toLowerCase()}: ${AFFIX[id].desc}.`, apply: (s) => AFFIX[id].apply(s) });
  for (const id of D.lib.acc) if (RELIC[id]) add({ id: `acc:lib:${id}`, strand: 'acc', lib: true, cost: 1, relic: id, name: RELIC[id].name, desc: `Wear the ${RELIC[id].name}: ${RELIC[id].desc}` });
  // and what they have rearranged
  D.spl.forEach((S0, i) => {
    if (S0.kind === 'ab' && ABILITY[S0.a] && ABILITY[S0.b]) add({ id: `ab:spl:${i}`, strand: 'ab', spl: true, cost: 3, excl: 'abspl', splAb: S0.b, name: S0.name, desc: `Rearranged from ${ABILITY[S0.a].name} and ${ABILITY[S0.b].name}: casting your ${ABILITY[S0.a].name} also unleashes ${ABILITY[S0.b].name} at 60% power. Abilities recharge 10% slower.`, apply: (s) => { s.cdMul *= 1.1; } });
    else if (S0.kind === 'wp' && WEAPON[S0.a] && WEAPON[S0.b] && !beast) add({ id: `wp:spl:${i}`, strand: 'wp', spl: true, cost: 3, excl: 'wpspl', splW: S0, name: S0.name, desc: `Rearranged from the ${WEAPON[S0.a].name} and the ${WEAPON[S0.b].name}: a rare ${WEAPON[S0.a].name} in your main hand that is ${dnaSplAffixes(S0).map((a) => AFFIX[a].name.toLowerCase()).join(' and ')}.` });
    else if (S0.kind === 'acc' && RELIC[dnaSplRelic(D, i)]) { const rid = dnaSplRelic(D, i); add({ id: `acc:spl:${i}`, strand: 'acc', spl: true, cost: 1, relic: rid, name: S0.name, desc: `Rearranged from the ${RELIC[S0.a].name} and the ${RELIC[S0.b].name}. ${RELIC[rid].desc}` }); }
  });
  return out;
}
function dnaSplAffixes(S0) {
  const def = WEAPON[S0.a], ok = (id) => AFFIX[id] && (!AFFIX[id].ranged || def.kind === 'ranged');
  return [...new Set([WP_TRAIT[S0.b], WP_TRAIT[S0.a], 'brutal', 'keen'].filter(ok))].slice(0, 2);
}
function dnaSplWeapon(S0) {
  const w = makeWeapon(S0.a, 'rare');
  w.affixes = dnaSplAffixes(S0); w.splName = S0.name;
  return w;
}
const _weaponNameDna = weaponName;
weaponName = function (w) { if (w && w.splName) return w.lvl ? `${w.splName} +${w.lvl}` : w.splName; return _weaponNameDna(w); };

/* ---------- the circle's shape ---------- */
const DNA_ANG = { ab: -Math.PI / 2, wp: Math.PI / 6, acc: (5 * Math.PI) / 6 };
function dnaLayout(genes) {
  const pos = { core: { x: 0, y: 0, links: [] } }, edges = [];
  const link = (a, b) => { pos[a].links.push(b); pos[b].links.push(a); edges.push([a, b]); };
  for (const s of ['ab', 'wp', 'acc']) {
    const A = DNA_ANG[s], ux = Math.cos(A), uy = Math.sin(A), vx = -uy, vy = ux;
    let prev = 'core';
    for (let k = 1; k <= 5; k++) {
      const id = `${s}:${k}`, r = 40 + k * 50, off = Math.sin(k * 1.7) * 18;
      pos[id] = { x: ux * r + vx * off, y: uy * r + vy * off, links: [] };
      link(prev, id); prev = id;
    }
    // memories on an arc beyond, rearranged genes further out
    const mem = Object.values(genes).filter((g) => g.strand === s && g.lib), spl = Object.values(genes).filter((g) => g.strand === s && g.spl);
    const arc = (list, r0, from, wide) => {
      const n = list.length, spread = Math.min(wide, 0.17 * (n - 1));
      list.forEach((g, i) => {
        const a = A + (n > 1 ? -spread / 2 + (spread * i) / (n - 1) : 0), r = r0 + (i % 2) * 40;
        pos[g.id] = { x: Math.cos(a) * r, y: Math.sin(a) * r, links: [] };
        link(from, g.id);
      });
    };
    arc(mem, 330, `${s}:1`, 1.9);
    arc(spl, 420, `${s}:3`, 1.2);
  }
  return { pos, edges };
}

/* ---------- spending ---------- */
function dnaWhyNot(p, genes, L, id) {
  const g = genes[id];
  if (!g) return 'Unknown gene';
  if (p.dna.includes(id)) return 'Expressed';
  if (!L.pos[id].links.some((l) => l === 'core' || p.dna.includes(l))) return 'Express a gene next to it first';
  if (g.excl && p.dna.some((x) => genes[x] && genes[x].excl === g.excl)) return g.excl === 'ab2' ? 'You already have a second skill from your DNA' : g.excl === 'wp2' ? 'You already carry a weapon from your DNA' : 'Only one rearranged gene of this kind at a time';
  if (g.cap === 'af' && p.dna.filter((x) => genes[x] && genes[x].cap === 'af').length >= DNA_AFFIX_CAP) return `At most ${DNA_AFFIX_CAP} weapon traits`;
  if ((p.dnaFree || 0) < g.cost) return `Needs ${g.cost} DNA point${g.cost === 1 ? '' : 's'}`;
  return '';
}
function dnaTake(p, id) {
  const D = chDna(runChar());
  if (!p || !D) return false;
  p.dna = p.dna || [];
  const genes = dnaGenes(p.cls, D), L = dnaLayout(genes);
  if (dnaWhyNot(p, genes, L, id)) return false;
  p.dna.push(id); p.dnaFree -= genes[id].cost;
  dnaSync(p);
  persist();
  return true;
}
function dnaReset(p) {
  if (!p) return;
  p.dna = []; p.dnaFree = p.dnaPts || 0;
  dnaSync(p);
  persist();
}
// what a weapon gene puts in your hands, and what it gives back when it goes
function dnaHand(p, tag, make, gid, main) {
  const i = p.weapons.findIndex((w) => w && w.dna === tag), cur = i >= 0 ? p.weapons[i] : null;
  if (cur && cur.dnaGene !== gid) {
    if (cur.prev) p.weapons[i] = cur.prev;
    else { p.weapons.splice(i, 1); if (p.wi >= p.weapons.length) p.wi = Math.max(0, p.weapons.length - 1); }
  }
  if (gid && !(cur && cur.dnaGene === gid)) {
    const w = make(); w.dna = tag; w.dnaGene = gid;
    if (main) { w.prev = p.weapons[p.wi] || null; p.weapons[p.wi] = w; }
    else if (p.weapons.length < 2) p.weapons.push(w);
    else { const j = 1 - p.wi; w.prev = p.weapons[j]; p.weapons[j] = w; }
  }
  p.weapon = p.weapons[p.wi] || p.weapons[0];
}
// make the body match the genes
function dnaSync(p) {
  const D = chDna(runChar());
  if (!p || !D) return;
  p.dna = p.dna || [];
  const genes = dnaGenes(p.cls, D), on = p.dna.map((id) => genes[id]).filter(Boolean), has = (id) => p.dna.includes(id);
  const a0 = p.abilities[0];
  if (a0) { const base = a0.lvl - (p.dnaAbB || 0), lvl = Math.min(3, base + (has('ab:1') ? 1 : 0) + (has('ab:3') ? 1 : 0)); p.dnaAbB = lvl - base; a0.lvl = lvl; }
  const ab2 = on.find((g) => g.excl === 'ab2'), s1 = p.abilities[1];
  if (ab2 && (!s1 || s1.id !== ab2.item)) p.abilities[1] = { id: ab2.item, lvl: 1, cd: 0, max: 1, dna: true };
  else if (!ab2 && s1 && s1.dna) p.abilities[1] = null;
  const sp = on.find((g) => g.splAb); p.dnaSplAb = sp ? sp.splAb : null;
  if (!p.beast) {
    const wl = on.find((g) => g.excl === 'wp2'), ws = on.find((g) => g.excl === 'wpspl');
    dnaHand(p, 'lib', () => makeWeapon(wl.item, 'uncommon'), wl ? wl.id : null, false);
    dnaHand(p, 'spl', () => dnaSplWeapon(ws.splW), ws ? ws.id : null, true);
  }
  const want = new Set(on.filter((g) => g.relic).map((g) => g.relic)), skKeeps = (id) => /^acc_/.test(id) && (p.sk || []).includes(`${id.slice(4)}:acc`);
  p.dnaRel = (p.dnaRel || []).filter((id) => { if (want.has(id)) return true; const i = p.relics.indexOf(id); if (i >= 0 && !skKeeps(id)) p.relics.splice(i, 1); return false; });
  for (const id of want) if (!p.relics.includes(id)) { p.relics.push(id); p.dnaRel.push(id); }
  recalcStats(p);
}
hook('stats', (s, p) => {
  if (!p || !p.dna || !p.dna.length || p !== G.p) return;
  const D = chDna(runChar());
  if (!D) return;
  const genes = dnaGenes(p.cls, D);
  for (const id of p.dna) { const g = genes[id]; if (g && g.apply) g.apply(s, p); }
});
// a rearranged skill: the other one comes too, at 60%
hook('onAbility', (p, a) => {
  if (!p || !p.dnaSplAb || p._splicing || a !== p.abilities[0] || !ABILITY[p.dnaSplAb]) return;
  const keep = HOOKS.onAbility, s = p.stats, k = s.abDmg, slot = p.abilities[0];
  p._splicing = true; HOOKS.onAbility = [];
  p.abilities[0] = { id: p.dnaSplAb, lvl: slot.lvl, cd: 0, max: 1 };
  s.abDmg = k * 0.6;
  try { castAbility(p, 0); if (G.run) G.run.stats.abilities--; } finally { s.abDmg = k; p.abilities[0] = slot; HOOKS.onAbility = keep; p._splicing = false; }
  ring(p.x, p.y - 8, 26, DNA_COL.ab, 0.35, 1);
});

/* ---------- rearranging: new things from old ---------- */
function dnaSpliceOptions(ch, kind) {
  const c = CLASS[ch.cls], D = chDna(ch);
  if (kind === 'ab') return { a: [c.ability], b: D.lib.ab.filter((id) => ABILITY[id] && id !== c.ability) };
  if (kind === 'wp') { const all = [...new Set([c.weapon, ...D.lib.wp])].filter((id) => WEAPON[id]); return { a: all, b: all }; }
  const accs = D.lib.acc.filter((id) => RELIC[id] && !RELIC[id].spliced);
  return { a: accs, b: accs };
}
function dnaSpliceName(kind, a, b) {
  if (kind === 'ab') return `${AB_WORD[b] || firstWord(ABILITY[b].name)} ${ABILITY[a].name}`;
  if (kind === 'wp') return `${WP_WORD[b] || firstWord(WEAPON[b].name)} ${WEAPON[a].name}`;
  return `${firstWord(RELIC[a].name)} ${lastWord(RELIC[b].name)}`;
}
function dnaSplice(ch, kind, a, b) {
  const D = chDna(ch);
  if (!D || !dnaMile(D, kind)) return 'That strand is not open yet';
  if (!a || !b || a === b) return 'Choose two different things';
  if (D.spl.filter((S0) => S0.kind === kind).length >= DNA_SPLICE_MAX) return `At most ${DNA_SPLICE_MAX} of each kind`;
  if (D.spl.some((S0) => S0.kind === kind && S0.a === a && S0.b === b)) return 'You have made that one already';
  const S0 = { kind, a, b, name: dnaSpliceName(kind, a, b) };
  D.spl.push(S0); dnaRegister(D);
  persist();
  return S0;
}

/* ---------- learning: what passes through your hands, and what bosses leave ---------- */
let dnaScanT = 0;
hook('update', (dt) => {
  const p = G.p, ch = runChar();
  if (!p || !ch || p.dead || (dnaScanT -= dt || 0) > 0) return;
  dnaScanT = 1.5;
  const D = chDna(ch), c = CLASS[p.cls], got = [];
  const learn = (k, id, name, quiet) => { if (id && !D.lib[k].includes(id)) { D.lib[k].push(id); if (!quiet) got.push(name); } };
  if (!p.beast) for (const w of p.weapons) if (w && WEAPON[w.id] && !w.dna) { learn('wp', w.id, WEAPON[w.id].name, w.id === c.weapon); for (const a of w.affixes || []) if (AFFIX[a]) learn('af', a, `${AFFIX[a].name} trait`); }
  for (const a of p.abilities) if (a && ABILITY[a.id] && a.id !== c.ability && !a.dna) learn('ab', a.id, ABILITY[a.id].name);
  for (const r of p.relics) if (RELIC[r] && RELIC[r].acc && !RELIC[r].spliced) learn('acc', r, RELIC[r].name);
  if (got.length) { toast(`DNA remembers ${got.slice(0, 3).join(', ')}${got.length > 3 ? ` and ${got.length - 3} more` : ''}`, DNA_COL.core); persist(); }
});
hook('onKill', (e) => {
  const ch = runChar();
  if (!e || !e.boss || !ch) return;
  const D = chDna(ch);
  D.bosses++;
  const M = DNA_MILES.find((m) => m.need === D.bosses), pool = ABILITIES.filter((a) => !a.cls && a.id !== CLASS[ch.cls].ability && !D.lib.ab.includes(a.id));
  if (pool.length) { const a = rndPick(pool); D.lib.ab.push(a.id); later(2.4, () => toast(`DNA takes ${a.name} from the fallen boss`, DNA_COL.ab), true); }
  if (M) later(4.2, () => { banner(M.name, `${charLabel(ch)} may now: ${M.txt.toLowerCase()}`, 3.2); Sound.play('ascend'); }, true);
  persist();
});

/* ---------- levels, saves and descents ---------- */
const _levelUpDna = UI.levelUp;
UI.levelUp = function (rarities, title) {
  const p = G.p;
  if (!rarities && p && p.pendingLevels > 0 && runChar() && skTree(p.cls) && !(UI.top() && UI.top()._skill)) { p.dnaFree = (p.dnaFree || 0) + p.pendingLevels; p.dnaPts = (p.dnaPts || 0) + p.pendingLevels; }
  return _levelUpDna(rarities, title);
};
hook('saveRun', (c, run, p) => { if (p) c.ext = { ...(c.ext || {}), dna: [...(p.dna || [])], dnaFree: p.dnaFree || 0, dnaPts: p.dnaPts || 0, dnaRel: [...(p.dnaRel || [])], dnaAbB: p.dnaAbB || 0, dnaSplAb: p.dnaSplAb || null }; });
hook('loadRun', (c, run, p) => {
  const x = (c && c.ext) || {}, ch = c && c.charId ? charById(c.charId) : null;
  if (ch) chDna(ch);
  if (!p) return;
  p.dna = Array.isArray(x.dna) ? x.dna.filter((id) => typeof id === 'string') : [];
  p.dnaFree = x.dnaFree || 0; p.dnaPts = x.dnaPts || 0; p.dnaRel = Array.isArray(x.dnaRel) ? x.dnaRel : []; p.dnaAbB = x.dnaAbB || 0; p.dnaSplAb = x.dnaSplAb || null;
});
hook('runStart', (run, p) => {
  if (!p || (run && run.realm)) return;
  p.dna = []; p.dnaFree = 0; p.dnaPts = 0; p.dnaRel = []; p.dnaAbB = 0; p.dnaSplAb = null;
  // the run learns whose it is a moment later
  later(1.2, () => { const ch = runChar(), D = ch && chDna(ch); if (G.p === p && D && D.last && D.last.pts > 0) UI.dnaRite(); }, true);
});
// a character who lives through a descent carries their DNA to the rite before the next
const _endRunDna = endRun;
endRun = function (won) {
  const p = G.p, ch = runChar();
  if (ch && p && !p.dead && G.run && !G.run.ended) { const D = chDna(ch); D.last = (p.dnaPts || 0) > 0 ? { pts: p.dnaPts, alloc: [...(p.dna || [])] } : null; }
  return _endRunDna(won);
};
// which genes fit in what is kept, in the order they were first expressed
function dnaKeepPlan(p, D, alloc, pts) {
  const genes = dnaGenes(p.cls, D), L = dnaLayout(genes), sim = { ...p, dna: [], dnaFree: pts, relics: p.relics };
  for (const id of alloc) if (genes[id] && L.pos[id] && !dnaWhyNot(sim, genes, L, id)) { sim.dna.push(id); sim.dnaFree -= genes[id].cost; }
  return sim;
}
UI.dnaRite = function () {
  const p = G.p, ch = runChar(), D = ch && chDna(ch);
  if (!p || !D || !D.last || !(D.last.pts > 0)) return;
  if (UI.top() || G.combat) { later(0.8, () => UI.dnaRite(), true); return; }
  const last = D.last, free = dnaMile(D, 'free'), lose = free ? 0.5 : Math.min(0.9, 0.5 + 0.1 * D.carries), kept = Math.floor(last.pts * (1 - lose));
  const plan = dnaKeepPlan(p, D, last.alloc, kept), genes = dnaGenes(p.cls, D), now = chaosInfo(), after = chaosAfter(last.pts);
  let done = false;
  const keep = () => {
    if (done) return; done = true; UI.close(el);
    p.dna = plan.dna; p.dnaFree = plan.dnaFree; p.dnaPts = kept;
    D.carries++; D.last = null;
    dnaSync(p); persist();
    toast(`${charLabel(ch)} keeps ${kept} DNA point${kept === 1 ? '' : 's'}`, DNA_COL.core);
  };
  const give = () => {
    if (done) return; done = true; UI.close(el);
    D.carries = 0; D.last = null;
    chaosAdd(last.pts);
    toast(`${last.pts} DNA given to the heart of the tree`, '#ff4ad0');
  };
  const names = plan.dna.map((id) => genes[id].name);
  const el = h('div', { class: 'modal' }, h('div', { class: 'panel', style: { maxWidth: '720px' } },
    h('h2', {}, 'The DNA rite'),
    h('p', {}, `${charLabel(ch)} lived through the last descent with ${last.pts} DNA point${last.pts === 1 ? '' : 's'}${last.alloc.length ? ` in ${last.alloc.length} gene${last.alloc.length === 1 ? '' : 's'}` : ''}. What becomes of it?`),
    h('div', { class: 'choices' },
      h('button', { class: 'card', type: 'button', style: { '--rc': DNA_COL.core }, onclick: keep, 'data-autofocus': true },
        h('b', {}, 'Keep your DNA'),
        h('p', { class: 'desc' }, `Carry it into this descent, losing ${Math.round(lose * 100)}% of the points: ${kept} of ${last.pts} stay.${free ? ' The Strand of Chaos holds the loss to half.' : D.carries ? ' Each time DNA is carried on, it frays a little more.' : ''}`),
        h('small', {}, names.length ? `Kept: ${names.join(', ')}${plan.dnaFree ? ` · ${plan.dnaFree} to spend` : ''}` : `${kept} point${kept === 1 ? '' : 's'} to spend`),
        h('span', { class: 'pick' }, 'Keep')),
      h('button', { class: 'card', type: 'button', style: { '--rc': '#ff4ad0' }, onclick: give },
        h('b', {}, 'Sacrifice to Chaos'),
        h('p', { class: 'desc' }, `Give all ${last.pts} points to the heart of the talent tree. Chaos Level ${now.lvl}${after.lvl > now.lvl ? ` becomes ${after.lvl}` : ` (${after.into} of ${after.need} to the next)`}. Chaos opens the inner wilds of the tree, makes their passives stronger, and stirs chaos in the deep.`),
        h('small', {}, 'Your DNA starts again from nothing, but it still remembers everything you have held.'),
        h('span', { class: 'pick' }, 'Sacrifice'))),
    h('p', { class: 'asc-why' }, 'Everything you have held and rearranged is remembered either way.')));
  UI.open(el, { modal: true, replace: false, onBack: () => {} });
};

/* ---------- the circle on screen ---------- */
UI.dnaTree = function (ch, opts = {}) {
  const inRun = !ch || (G.p && runChar() === ch && G.mode === 'play');
  ch = ch || runChar();
  const D = chDna(ch);
  if (!D) return;
  const p = inRun ? G.p : null, cls = ch.cls;
  const view = p || { cls, dna: (D.last && D.last.alloc) || [], dnaFree: 0, relics: [] };
  const W = Math.min(window.innerWidth - 32, 860), Hh = Math.max(260, Math.min(window.innerHeight - 330, 600)), S = Math.min(W, Hh) / 1000;
  const cv = h('canvas', { width: W, height: Hh, class: 'sk-cv', style: { width: W + 'px', height: Hh + 'px', touchAction: 'none', cursor: 'pointer', background: 'rgba(6,8,12,0.7)' } });
  const tip = h('div', { class: 'sk-tip', style: { position: 'absolute', pointerEvents: 'none', display: 'none', maxWidth: '280px', padding: '8px 10px', background: 'rgba(12,14,20,0.96)', boxShadow: 'inset 0 0 0 2px var(--soot-4)', font: '400 16px/1.25 var(--f-ui)', color: 'var(--bone-2)', zIndex: 5 } });
  const head = h('div', { class: 'lv-head' }), miles = h('div', { class: 'row', style: { flexWrap: 'wrap', justifyContent: 'center', gap: '6px' } }), memo = h('p', { class: 'asc-why', style: { margin: 0 } });
  const splBox = h('div', { class: 'panel', hidden: true, style: { width: 'min(100%, 720px)', display: 'grid', gap: '8px' } });
  const g = cv.getContext('2d'), X = (q) => W / 2 + q.x * S, Y = (q) => Hh / 2 + q.y * S;
  let genes, L, hover = null;
  const build = () => { genes = dnaGenes(cls, D); L = dnaLayout(genes); };
  const colOf = (id) => (id === 'core' ? DNA_COL.core : DNA_COL[genes[id].strand]);
  const nodeR = (id) => (id === 'core' ? 20 : genes[id].spl ? 12 : genes[id].lib ? 9 : 10) * Math.max(0.75, S * 1.6);
  const draw = () => {
    const t = performance.now() / 1000, on = new Set(['core', ...view.dna]);
    g.clearRect(0, 0, W, Hh);
    // a faint double helix down each strand
    g.globalCompositeOperation = 'lighter';
    for (const s of ['ab', 'wp', 'acc']) {
      const A = DNA_ANG[s], ux = Math.cos(A), uy = Math.sin(A), vx = -uy, vy = ux;
      for (const ph of [0, Math.PI]) {
        g.strokeStyle = rgbaStr(DNA_COL[s], 0.22); g.lineWidth = 1.5; g.beginPath();
        for (let r = 20; r <= 300; r += 6) { const off = Math.sin(r / 22 + ph + t * 1.4) * 14, x = W / 2 + (ux * r + vx * off) * S, y = Hh / 2 + (uy * r + vy * off) * S; if (r === 20) g.moveTo(x, y); else g.lineTo(x, y); }
        g.stroke();
      }
    }
    g.globalCompositeOperation = 'source-over';
    [[350, 'REMEMBERED'], [440, 'REARRANGED']].forEach(([r, label], k) => {
      g.setLineDash([3, 7]); g.strokeStyle = 'rgba(127,232,255,0.16)'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(W / 2, Hh / 2, r * S, 0, TAU); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(127,232,255,0.4)'; g.font = `400 ${Math.round(11 * Math.max(0.8, S * 1.6))}px var(--f-ui), sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(label, W / 2, Hh / 2 + r * S + 10 + k * 2);
    });
    L.edges.forEach(([a, b], i) => {
      const A0 = L.pos[a], B0 = L.pos[b], lit = on.has(a) && on.has(b), col = colOf(b === 'core' ? a : b);
      mycHypha(g, X(A0), Y(A0), X(B0), Y(B0), i * 7919 + 13, { lit, col, t, width: lit ? 2.6 : 1.4 });
    });
    for (const id in L.pos) {
      const q = L.pos[id], x = X(q), y = Y(q), r = nodeR(id), c = colOf(id), isOn = on.has(id), gi = genes[id];
      const can = !isOn && p && gi && !dnaWhyNot(p, genes, L, id);
      if (isOn) { g.globalCompositeOperation = 'lighter'; const lg = g.createRadialGradient(x, y, 0, x, y, r * 2.4); lg.addColorStop(0, rgbaStr(c, 0.45)); lg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = lg; g.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8); g.globalCompositeOperation = 'source-over'; }
      g.fillStyle = isOn ? c : '#0e1016'; g.strokeStyle = isOn || can ? c : rgbaStr(c, 0.45); g.lineWidth = can ? 2.5 : 1.5;
      g.beginPath();
      if (gi && gi.spl) { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + t * 0.4; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); }
      else if (gi && gi.lib) { g.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7); }
      else g.arc(x, y, r, 0, TAU);
      g.fill(); g.stroke();
      if (gi && gi.spl) { g.strokeStyle = rgbaStr(c, 0.6); g.lineWidth = 1; g.beginPath(); g.arc(x, y, r + 4, 0, TAU); g.stroke(); }
      if (id === 'core') { g.strokeStyle = '#0e1016'; g.lineWidth = 2; for (const ph of [0, Math.PI]) { g.beginPath(); for (let k = -10; k <= 10; k++) { const yy = y + k * 1.4, xx = x + Math.sin(k * 0.6 + ph + t * 2) * 6; if (k === -10) g.moveTo(xx, yy); else g.lineTo(xx, yy); } g.stroke(); } }
      if (can) { g.globalAlpha = 0.35 + Math.sin(t * 4) * 0.2; g.strokeStyle = c; g.beginPath(); g.arc(x, y, r + 5, 0, TAU); g.stroke(); g.globalAlpha = 1; }
      if (id === hover) { g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r + 3, 0, TAU); g.stroke(); }
    }
    g.font = `400 ${Math.round(15 * Math.max(0.8, S * 1.6))}px var(--f-ui), sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const s of ['ab', 'wp', 'acc']) { const A = DNA_ANG[s]; g.fillStyle = DNA_COL[s]; g.fillText(DNA_STRAND[s].toUpperCase(), clamp(W / 2 + Math.cos(A) * 480 * S, 60, W - 60), clamp(Hh / 2 + Math.sin(A) * 480 * S, 12, Hh - 12)); }
  };
  const refresh = () => {
    build();
    head.replaceChildren(h('b', {}, `${charLabel(ch)} · DNA`), h('small', {}, p ? `${p.dnaFree || 0} DNA point${p.dnaFree === 1 ? '' : 's'} to spend · one per level` : D.last && D.last.pts ? `${D.last.pts} DNA points waiting for the rite at the start of the next descent` : 'Gain a level in a descent to earn DNA points'));
    miles.replaceChildren(...DNA_MILES.map((M) => h('span', { class: 'chip', title: M.txt, style: { '--rc': dnaMile(D, M.id) ? DNA_COL.core : 'var(--soot-4)', opacity: dnaMile(D, M.id) ? 1 : 0.6 } }, `${dnaMile(D, M.id) ? '✓ ' : ''}${M.name} · ${dnaMile(D, M.id) ? M.txt : `slay ${M.need} boss${M.need === 1 ? '' : 'es'}`}`)));
    const n = (k) => D.lib[k].length;
    memo.textContent = `Bosses slain: ${D.bosses} · remembered: ${n('wp')} weapon${n('wp') === 1 ? '' : 's'}, ${n('af')} weapon trait${n('af') === 1 ? '' : 's'}, ${n('ab')} skill${n('ab') === 1 ? '' : 's'}, ${n('acc')} accessor${n('acc') === 1 ? 'y' : 'ies'} · ${D.spl.length} rearranged`;
    resetBtn.textContent = dnaMile(D, 'free') ? 'Reset (free)' : `Reset · ${DNA_RESET_COST} embers`;
    resetBtn.disabled = !p || !p.dna.length;
    splBtn.disabled = !DNA_MILES.slice(0, 3).some((M) => dnaMile(D, M.id));
    draw();
  };
  const pick = (ev) => {
    const r = cv.getBoundingClientRect(), mx = (ev.clientX - r.left) * (W / r.width), my = (ev.clientY - r.top) * (Hh / r.height);
    let best = null, bd = 20;
    for (const id in L.pos) { const d = Math.hypot(X(L.pos[id]) - mx, Y(L.pos[id]) - my); if (d < bd) { bd = d; best = id; } }
    return best;
  };
  cv.addEventListener('pointermove', (ev) => {
    hover = pick(ev);
    if (!hover) { tip.style.display = 'none'; draw(); return; }
    const gi = genes[hover], why = gi && p ? dnaWhyNot(p, genes, L, hover) : '';
    tip.replaceChildren(
      h('b', { style: { display: 'block', color: colOf(hover), fontWeight: 400 } }, hover === 'core' ? `${charLabel(ch)}'s DNA` : gi.name),
      hover === 'core' ? `Three strands: ${DNA_STRAND.ab.toLowerCase()}, ${DNA_STRAND.wp.toLowerCase()} and ${DNA_STRAND.acc.toLowerCase()}. Squares are things you have held before; hexagons are things you have rearranged.` : gi.desc,
      hover === 'core' ? null : h('small', { style: { display: 'block', marginTop: '4px', color: 'var(--bone-3)' } }, `${gi.cost} DNA · ${!p ? 'express it during a descent' : why === 'Expressed' ? 'expressed' : why || 'click to express'}`));
    const r = cv.getBoundingClientRect();
    tip.style.display = 'block'; tip.style.left = `${Math.min(r.width - 290, ev.clientX - r.left + 14)}px`; tip.style.top = `${ev.clientY - r.top + 14}px`;
    draw();
  });
  cv.addEventListener('pointerleave', () => { hover = null; tip.style.display = 'none'; draw(); });
  cv.addEventListener('click', (ev) => { const id = pick(ev); if (!id || id === 'core' || !p) return; if (dnaTake(p, id)) { Sound.play('pickup', { p: 1.3 }); refresh(); } else { const why = dnaWhyNot(p, genes, L, id); if (why && why !== 'Expressed') toast(why); Sound.play('deny', { v: 0.5 }); } });
  // rearranging
  const splPanel = () => {
    const kinds = DNA_MILES.slice(0, 3).filter((M) => dnaMile(D, M.id));
    let kind = splBox._kind && kinds.some((M) => M.id === splBox._kind) ? splBox._kind : kinds[0] ? kinds[0].id : null;
    if (!kind) { splBox.hidden = true; return; }
    splBox._kind = kind;
    const opt = dnaSpliceOptions(ch, kind), nm = (id) => (kind === 'ab' ? ABILITY[id].name : kind === 'wp' ? WEAPON[id].name : RELIC[id].name);
    const selA = h('select', {}, ...opt.a.map((id) => h('option', { value: id }, nm(id)))), selB = h('select', {}, ...opt.b.map((id) => h('option', { value: id }, nm(id))));
    if (opt.b.length > 1 && selB.value === selA.value) selB.selectedIndex = 1;
    const out = h('p', { class: 'asc-why', style: { margin: 0 } });
    const upd = () => { const a = selA.value, b = selB.value; out.textContent = a && b && a !== b ? `Makes: ${dnaSpliceName(kind, a, b)}` : 'Choose two different things'; };
    selA.onchange = upd; selB.onchange = upd; upd();
    splBox.replaceChildren(
      h('h3', { style: { margin: 0 } }, 'Rearrange DNA'),
      h('div', { class: 'row', style: { flexWrap: 'wrap' } }, ...kinds.map((M) => btn(DNA_STRAND[M.id], () => { splBox._kind = M.id; splPanel(); }, M.id === kind ? 'small primary' : 'small'))),
      opt.a.length && opt.b.length ? h('div', { class: 'row', style: { flexWrap: 'wrap' } }, selA, h('span', {}, '+'), selB) : h('p', {}, kind === 'acc' ? 'Wear at least two accessories in your descents for your DNA to remember them.' : kind === 'ab' ? 'Your DNA remembers no other skill yet. Slay a boss or learn a second skill.' : 'Your DNA remembers no other weapon yet.'),
      out,
      h('div', { class: 'row' }, btn('Rearrange', () => { const r = dnaSplice(ch, kind, selA.value, selB.value); if (typeof r === 'string') { toast(r); Sound.play('deny'); return; } Sound.play('evolveStart'); toast(`New gene: ${r.name}`, DNA_COL[kind]); refresh(); splPanel(); }, 'primary', { disabled: opt.a.length && opt.b.length ? null : true }), btn('Close', () => { splBox.hidden = true; }, 'small')),
      h('small', {}, `Rearranged genes appear as hexagons on their strand. At most ${DNA_SPLICE_MAX} of each kind.`));
    splBox.hidden = false;
    splBox.scrollIntoView({ block: 'nearest' });
  };
  const splBtn = btn('Rearrange DNA', () => (splBox.hidden ? splPanel() : (splBox.hidden = true)), 'small');
  const resetBtn = btn('Reset', () => UI.confirm('Reset your DNA?', 'Every DNA point comes back to spend again. What it put in your hands is taken back.', 'Reset', () => {
    const cost = dnaMile(D, 'free') ? 0 : DNA_RESET_COST;
    if ((CD.save.embers || 0) < cost) { toast('Not enough embers'); return; }
    CD.save.embers -= cost; dnaReset(p); refresh();
  }), 'small');
  const close = () => { alive = false; UI.close(el); if (opts.back) opts.back(); };
  const el = h('div', { class: opts.back ? 'screen dim' : 'modal' }, h('div', { style: { display: 'grid', gap: '10px', justifyItems: 'center', width: 'min(100%, 900px)', maxHeight: '100%', overflowY: 'auto', overscrollBehavior: 'contain' } },
    head, h('div', { style: { position: 'relative' } }, cv, tip), miles, memo, splBox,
    h('div', { class: 'row', style: { flexWrap: 'wrap' } }, splBtn, p ? resetBtn : null,
      p && typeof UI.skillTree === 'function' ? btn('Skill tree', () => { alive = false; UI.close(el); UI.skillTree(null, opts); }, 'small') : null,
      btn('Done', close, 'primary', { 'data-autofocus': true }))));
  el._skill = true;
  let alive = true;
  const tick = () => { if (!alive || !el.isConnected) return; draw(); requestAnimationFrame(tick); };
  refresh(); requestAnimationFrame(tick);
  UI.open(el, opts.back ? { onBack: close } : { modal: true, replace: false, onBack: close });
};
// the way in: from the skill tree, the pause menu and the roster
const _skillTreeDna = UI.skillTree;
UI.skillTree = function (ch, opts = {}) {
  _skillTreeDna(ch, opts);
  const el = UI.top(), rows = el ? el.querySelectorAll('.row') : [], row = rows[rows.length - 1];
  const who = ch || runChar();
  if (!row || !who) return;
  const p = !ch ? G.p : null;
  row.insertBefore(btn(`DNA${p && p.dnaFree ? ` · ${p.dnaFree} to spend` : ''}`, () => { UI.close(el); UI.dnaTree(ch, opts); }, p && p.dnaFree ? 'small primary' : 'small'), row.lastChild);
};
pauseItem('dna', 55, (el, p) => (p && runChar() ? btn(`DNA${p.dnaFree ? ` · ${p.dnaFree} to spend` : ''}`, () => { UI.close(el); UI.dnaTree(null, {}); }, p.dnaFree ? 'primary' : '') : null));
const _realmDna = UI.realm;
UI.realm = function () {
  _realmDna();
  const el = UI.top(), rows = el ? el.querySelectorAll('.rchar') : [];
  realmStore().chars.forEach((ch, i) => { const r = rows[i] && rows[i].querySelector('.row'); if (r) r.append(btn('DNA', () => { CD.focusChar = ch.id; UI.dnaTree(ch, { back: () => UI.realm() }); }, 'small')); });
};
// feats for the new circles
FEATS.push(
  { id: 'chaosgift', name: 'Offering', desc: 'Sacrifice DNA to raise the Chaos Level.', embers: 30 },
  { id: 'splicer', name: 'Gene Splicer', desc: 'Rearrange DNA into something new.', embers: 40 },
  { id: 'chaosheart', name: 'Heart of Chaos', desc: 'Place the Heart of Chaos on the talent tree.', embers: 80 },
);
for (const f of FEATS.slice(-3)) FEAT[f.id] = f;
Object.assign(FEAT_TEST, {
  chaosgift: () => chaosLevel() >= 1,
  splicer: () => realmStore().chars.some((ch) => ch.dna && ch.dna.spl && ch.dna.spl.length),
  chaosheart: () => talentOwners().has(TREE.heart),
});
CD.dna = {
  of: (id) => chDna(id ? charById(id) : runChar()), genes: () => dnaGenes(G.p.cls, chDna(runChar())), take: (id) => dnaTake(G.p, id), reset: () => dnaReset(G.p),
  splice: (kind, a, b) => dnaSplice(runChar(), kind, a, b), state: () => ({ dna: [...(G.p.dna || [])], free: G.p.dnaFree, pts: G.p.dnaPts, ab: G.p.abilities.map((a) => a && a.id + ':' + a.lvl), weapons: G.p.weapons.map((w) => weaponName(w)), relics: [...G.p.relics] }),
};

