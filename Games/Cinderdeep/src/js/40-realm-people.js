/* ============================================================
   Cinderdeep — the Realm's people and screens: a song for every
   biome, merchants, smiths, inns, temples, banks, stables and
   tailors, the quest boards, waystone travel, the zone and realm
   maps, the minimap, character select and the fall screen.
   ============================================================ */

/* ---------- music ---------- */
function realmSong(o) {
  const mel = o.mel || [0, null, 2, null, 4, null, 2, 1, 0, null, 4, null, 5, 4, 2, null];
  return {
    bpm: o.bpm, root: o.root, scale: o.scale, prog: o.prog, verb: o.verb ?? 0.3, amb: o.amb || '',
    step(M, t, s, bar, I, S) {
      const ch = S.prog[bar % S.prog.length], d = S.d16;
      if (s === 0) { for (const k of [0, 2, 4]) M.inst(o.pad || 'pad', M.deg(S, ch + k) - (o.padLow ? 12 : 0), t, d * 16, o.padVol ?? 0.03); M.inst('bass', M.deg(S, ch) - 12, t, d * 8, o.bass ?? 0.09); }
      if (s === 8 && o.bass2) M.inst('bass', M.deg(S, ch + 4) - 12, t, d * 6, 0.07);
      if (o.arp && s % o.arp === 0) { const pat = o.pat || [0, 2, 4, 2]; M.inst(o.arpI || 'pluck', M.deg(S, ch + pat[(s / o.arp) % pat.length]) + (o.arpUp ?? 12), t, d * o.arp, o.arpVol ?? 0.03); }
      if (mel[s] != null && bar % (o.melEvery || 2) === (o.melBar ?? 1)) M.inst(o.lead || 'musicbox', M.deg(S, ch + mel[s]) + (o.leadUp ?? 12), t, o.leadLen ? d * o.leadLen : 0.9, o.leadVol ?? 0.035);
      if (o.bells && Math.random() < o.bells) M.inst('bell', M.deg(S, ch + ((Math.random() * 7) | 0)) + 24, t, 1, 0.018);
      const perc = o.perc || '';
      if (perc === 'shaker' && s % 2 === 1) M.drum('shaker', t, 0.025);
      if (perc === 'taiko' && (s === 0 || s === 6 || s === 10)) M.drum('taiko', t, s ? 0.18 : 0.26);
      if (perc === 'march' && s % 4 === 0) M.drum(s % 8 === 0 ? 'kick' : 'snare', t, s % 8 === 0 ? 0.2 : 0.06);
      if (perc === 'tom' && (s === 0 || s === 11)) M.drum('tom', t, 0.12, 90);
      if (I >= 1) { if (s % 4 === 0) M.drum('kick', t, 0.24); if (s % 8 === 4) M.drum('snare', t, 0.08); if (s % 2 === 1) M.drum('hat', t, 0.025); }
      if (o.sweep && s === 0) M.sweep(t, 900 + Math.sin(bar / 3) * 600);
    },
  };
}
Object.assign(SONGS, {
  w_meadow: realmSong({ bpm: 92, root: 60, scale: 'major', prog: [0, 3, 4, 0], arp: 2, pat: [0, 2, 4, 7, 4, 2], lead: 'lead', leadVol: 0.022, leadLen: 2, perc: 'shaker', mel: [4, null, 5, 4, 2, null, 0, null, 2, null, 4, null, 2, 1, 0, null] }),
  w_forest: realmSong({ bpm: 80, root: 57, scale: 'dorian', prog: [0, 6, 3, 4], arp: 3, arpI: 'marimba', pat: [0, 4, 7, 9, 7, 4], lead: 'musicbox', perc: 'tom', amb: 'grotto' }),
  w_sakura: realmSong({ bpm: 76, root: 62, scale: 'major', prog: [0, 5, 3, 4], arp: 2, arpI: 'pluck', pat: [0, 1, 4, 5, 4, 1], lead: 'bell', leadVol: 0.03, perc: '', mel: [0, null, null, 2, 4, null, 5, null, 4, null, 2, null, 0, null, null, null] }),
  w_autumn: realmSong({ bpm: 84, root: 55, scale: 'mixolydian', prog: [0, 6, 3, 0], arp: 2, arpI: 'harpsi', arpVol: 0.022, pat: [0, 2, 4, 2], lead: 'musicbox', perc: 'shaker' }),
  w_savanna: realmSong({ bpm: 96, root: 52, scale: 'mixolydian', prog: [0, 0, 6, 0], arp: 4, arpI: 'marimba', pat: [0, 4, 7, 4], lead: 'lead', leadVol: 0.02, leadLen: 3, perc: 'taiko' }),
  w_highland: realmSong({ bpm: 70, root: 50, scale: 'dorian', prog: [0, 3, 6, 4], pad: 'choir', padVol: 0.035, arp: 4, arpI: 'pluck', lead: 'lead', leadVol: 0.022, leadLen: 4, perc: 'tom', bass2: true }),
  w_bone: realmSong({ bpm: 64, root: 50, scale: 'minor', prog: [0, 5, 3, 4], pad: 'organ', padVol: 0.025, arp: 4, arpI: 'harpsi', arpVol: 0.02, lead: 'bell', leadVol: 0.025, perc: 'tom', amb: 'ossuary' }),
  w_swamp: realmSong({ bpm: 66, root: 48, scale: 'phrygian', prog: [0, 1, 0, 6], pad: 'pad', padLow: true, arp: 3, arpI: 'marimba', arpVol: 0.025, pat: [0, 1, 4, 1], lead: 'musicbox', leadVol: 0.02, perc: 'tom', amb: 'grotto' }),
  w_spore: realmSong({ bpm: 66, root: 52, scale: 'phrygian', prog: [0, 1, 5, 0], pad: 'pad', arp: 3, arpI: 'marimba', pat: [0, 2, 4, 7, 9], lead: 'bell', bells: 0.06, amb: 'grotto' }),
  w_coast: realmSong({ bpm: 82, root: 57, scale: 'major', prog: [0, 4, 5, 3], arp: 2, arpI: 'marimba', pat: [0, 4, 2, 4], lead: 'musicbox', perc: 'shaker' }),
  w_steppe: realmSong({ bpm: 100, root: 45, scale: 'dorian', prog: [0, 0, 6, 4], pad: 'brass', padVol: 0.02, arp: 2, arpI: 'pluck', pat: [0, 4, 7, 4], lead: 'lead', leadVol: 0.024, leadLen: 2, perc: 'march', bass2: true }),
  w_snow: realmSong({ bpm: 68, root: 62, scale: 'dorian', prog: [0, 3, 5, 4], pad: 'choir', padVol: 0.035, padLow: true, lead: 'musicbox', leadVol: 0.04, bells: 0.05, amb: 'frost' }),
  w_desert: realmSong({ bpm: 88, root: 50, scale: 'hijaz', prog: [0, 1, 0, 0], arp: 2, arpI: 'pluck', pat: [0, 1, 4, 3], lead: 'lead', leadVol: 0.022, leadLen: 2, perc: 'taiko', mel: [0, null, 1, null, 4, 3, 1, null, 0, null, 6, null, 5, 4, 1, null] }),
  w_ash: realmSong({ bpm: 72, root: 45, scale: 'phrygian', prog: [0, 1, 0, 5], pad: 'organ', padVol: 0.022, padLow: true, arp: 4, arpI: 'harpsi', arpVol: 0.018, lead: 'bell', leadVol: 0.022, perc: 'taiko', amb: 'core' }),
  w_jungle: realmSong({ bpm: 98, root: 55, scale: 'dorian', prog: [0, 6, 0, 4], arp: 2, arpI: 'marimba', pat: [0, 2, 4, 7, 9, 7], lead: 'lead', leadVol: 0.02, leadLen: 2, perc: 'taiko' }),
  w_fey: realmSong({ bpm: 84, root: 60, scale: 'lydian', prog: [0, 1, 0, 5], pad: 'choir', arp: 2, arpI: 'musicbox', arpVol: 0.025, pat: [0, 4, 6, 4], lead: 'bell', bells: 0.08, sweep: true }),
  w_crystal: realmSong({ bpm: 72, root: 64, scale: 'lydian', prog: [0, 5, 1, 4], pad: 'pad', arp: 3, arpI: 'bell', arpVol: 0.022, pat: [0, 4, 7, 11], lead: 'musicbox', bells: 0.07 }),
  w_dark: realmSong({ bpm: 60, root: 46, scale: 'minor', prog: [0, 5, 6, 4], pad: 'pad', padLow: true, padVol: 0.035, lead: 'bell', leadVol: 0.02, perc: 'tom', amb: 'ossuary' }),
  w_volcano: realmSong({ bpm: 92, root: 40, scale: 'hijaz', prog: [0, 0, 1, 0], pad: 'brass', padVol: 0.02, arp: 2, arpI: 'pluck', lead: 'lead', leadVol: 0.022, perc: 'taiko', amb: 'core' }),
  w_void: realmSong({ bpm: 90, root: 58, scale: 'lydian', prog: [0, 1, 0, 6], pad: 'choir', arp: 1, arpI: 'musicbox', arpVol: 0.018, pat: [0, 4, 6, 11, 6, 4], lead: 'bell', bells: 0.1, sweep: true, amb: 'dmt' }),
  w_town: realmSong({ bpm: 104, root: 60, scale: 'major', prog: [0, 3, 4, 0], arp: 2, arpI: 'pluck', pat: [0, 2, 4, 2], lead: 'musicbox', leadVol: 0.04, perc: 'shaker', melEvery: 1, melBar: 0, mel: [0, null, 2, 4, 5, null, 4, 2, 0, null, 2, null, 4, null, null, null] }),
  w_capital: realmSong({ bpm: 96, root: 55, scale: 'major', prog: [0, 4, 5, 3], pad: 'brass', padVol: 0.022, arp: 2, arpI: 'harpsi', arpVol: 0.022, lead: 'lead', leadVol: 0.022, leadLen: 2, perc: 'march', bells: 0.03, bass2: true, mel: [4, null, 4, 5, 7, null, 5, 4, 2, null, 0, null, 2, 4, null, null] }),
  w_night: realmSong({ bpm: 58, root: 57, scale: 'minor', prog: [0, 5, 3, 6], pad: 'pad', padVol: 0.03, lead: 'musicbox', leadVol: 0.03, bells: 0.03, verb: 0.5 }),
});

/* ---------- embers found in the realm go straight to the camp ---------- */
const _takePickupRealm = takePickup;
takePickup = function (k) {
  _takePickupRealm(k);
  if (W.on && k.kind === 'ember' && G.run.embers > 0) { CD.save.embers = (CD.save.embers || 0) + G.run.embers; CD.save.stats.embersEarned = (CD.save.stats.embersEarned || 0) + G.run.embers; G.run.embers = 0; }
};

/* ---------- what you can use nearby ---------- */
function realmInteractables(Z) {
  if (Z.inter) return Z.inter;
  Z.inter = [];
  for (const list of Z.objs) for (const o of list) if (o.kind === 'waystone' || o.kind === 'dungeon' || o.kind === 'chest' || o.kind === 'mark') Z.inter.push(o);
  return Z.inter;
}
const _nearestRealm = nearestInteract;
nearestInteract = function () {
  const base = _nearestRealm();
  if (!(W.on && !W.inInst && W.Z && G.fl && G.fl.realm)) return base;
  const p = G.p;
  let best = base, bd = base ? 14 : 30;
  for (const n of W.npcs) { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < 24 && d < bd) { bd = d; best = { kind: 'world', type: 'npc', n }; } }
  for (const o of realmInteractables(W.Z)) {
    if (Math.abs(o.x - p.x) > 60 || Math.abs(o.y - p.y) > 60) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y), lim = o.kind === 'dungeon' ? 36 : o.kind === 'mark' ? 30 : 24;
    if (d > lim || d > bd) continue;
    if (o.kind === 'chest' && chestOpened(o.chest)) continue;
    bd = d; best = { kind: 'world', type: o.kind, o };
  }
  return best;
};
const chestOpened = (c) => W.ch && W.ch.chests && W.ch.chests[c.id] && Date.now() - W.ch.chests[c.id] < 20 * 60 * 1000;
const _promptRealm = promptFor;
promptFor = function (t) {
  if (!t || t.kind !== 'world') return _promptRealm(t);
  if (t.type === 'npc') return t.n.role === 'folk' ? 'Talk' : t.n.role === 'guard' ? 'Talk to the guard' : `Talk to the ${NPC_TITLE[t.n.role] || 'merchant'}`;
  if (t.type === 'waystone') return 'Travel by waystone';
  if (t.type === 'dungeon') return `Enter ${W.Z.dungeon.name}`;
  if (t.type === 'chest') return 'Open chest';
  if (t.type === 'mark') return 'Look closer';
  return 'Use';
};
const _interactRealm = interact;
interact = function () {
  const t = nearestInteract();
  if (!t || t.kind !== 'world') return _interactRealm();
  const p = G.p;
  if (t.type === 'npc') return talkTo(t.n);
  if (t.type === 'waystone') { attuneWay(t.o.way); return UI.realmTravel(); }
  if (t.type === 'dungeon') {
    const Z = W.Z, b = Z.b, lvl = Math.round((b.lvl[0] + b.lvl[1]) / 2 + 2);
    return UI.confirm(Z.dungeon.name, `${ACTS[Z.dungeon.act].name}: two floors, then its master. Monsters are level ${lvl}. You keep everything you find. Falling inside costs some gold, not your hero.`, 'Enter', () => enterInstance(Z.dungeon));
  }
  if (t.type === 'chest') {
    const c = t.o.chest, R = new RNG((Math.random() * 1e9) | 0), L = Math.max(W.Z.b.lvl[0], Math.min(W.Z.b.lvl[1], p.level));
    W.ch.chests = W.ch.chests || {}; W.ch.chests[c.id] = Date.now();
    Sound.play('chest'); burst(t.o.x, t.o.y - 6, 18, ['#ffd35c', '#ffffff'], { smax: 90, glow: true });
    const n = c.tier === 'gold' ? 3 : c.tier === 'silver' ? 2 : 1;
    for (let i = 0; i < n; i++) spawnItem(i === 0 ? realmLoot(R, L, c.tier === 'gold' ? 'rare' : c.tier === 'silver' ? 'uncommon' : 'common') : { type: 'gold', n: 8 + L * 2 }, t.o.x + (i - 1) * 12, t.o.y + 10);
    for (let i = 0; i < 4 + n * 2; i++) dropPickup('gold', t.o.x, t.o.y, 1 + Math.floor(L / 8));
    if (c.tier !== 'wood') dropPickup('ember', t.o.x, t.o.y, n);
    return;
  }
  if (t.type === 'mark') { const m = W.Z.marks.find((q) => Math.abs((q.x + 0.5) * TS - t.o.x) < 2 && Math.abs((q.y + 0.5) * TS - t.o.y) < 2); toast(markLore(m), '#e8d8b0'); return; }
};
const MARK_LORE = {
  statue: 'A hero of the old realm. Someone keeps leaving flowers.', ruin: 'Stones from a city that forgot its own name.', windmill: 'It still turns, though nobody grinds grain here anymore.',
  oldoak: 'They say this tree was a seedling when the deep first opened.', shrine: 'A small shrine. The offering bowl is never empty.', torii: 'A spirit gate. The air is colder on the other side.',
  bones: 'Something enormous died here. Something else ate it.', obelisk: 'Runes that hum when no one is looking.', stones: 'A ring of stones older than any road.', mausoleum: 'The door is sealed from the inside.',
  giantshroom: 'Grandfather Cap. The spores smell like rain.', wreck: 'A ship, very far from any sea that exists now.', spire: 'Crystal that sings a single long note.', eye: 'It blinks when you do.',
};
function markLore(m) { return m ? `${m.name}: ${MARK_LORE[m.kind] || 'Old and quiet.'}` : 'Old and quiet.'; }
function talkTo(n) {
  const role = n.role;
  if (role === 'folk' || role === 'guard') { W.say = { npc: n, text: rndPick(role === 'guard' ? ['Keep your weapon sheathed in town.', 'Monsters thin out near the walls.', 'The roads are watched. Mostly.', 'Move along, hero.'] : FOLK_LINES), t: 3.2 }; Sound.play('ui', { p: 1.3 }); return; }
  Sound.play('ui');
  if (role === 'board' || role === 'guild') return UI.realmBoard(n);
  return UI.realmShop(role, n);
}

/* ---------- quests ---------- */
const realmDay = () => Math.floor(W.t / DAY_LEN);
function questOffers(town, guild) {
  const Z = W.Z, b = Z.b, R = new RNG(hash2(hashStr(town.id + (guild ? 'g' : '')), realmDay() + 7)), p = G.p, out = [];
  const lvlXp = (k) => Math.round(xpToNext(clamp(p.level, b.lvl[0], b.lvl[1] + 2)) * k);
  const gold = (k) => Math.round((20 + b.lvl[1] * 4) * k);
  if (!guild) {
    const kinds = R.shuffle([...b.mobs]).slice(0, 2);
    for (const k of kinds) { const need = R.int(8, 14); out.push({ id: `${town.id}:${realmDay()}:k:${k}`, kind: 'kill', zone: Z.id, target: k, need, have: 0, xp: lvlXp(0.35), gold: gold(1), name: `Cull the ${ENEMIES[k].name}s`, desc: `Slay ${need} ${ENEMIES[k].name}s in ${b.name}.` }); }
    const unseen = Z.marks.filter((m) => !(W.ch.marks || []).includes(m.id));
    if (unseen.length) { const m = R.pick(unseen); out.push({ id: `${town.id}:x:${m.id}`, kind: 'explore', zone: Z.id, target: m.id, need: 1, have: 0, xp: lvlXp(0.25), gold: gold(0.6), name: `Find the ${m.name}`, desc: `Someone saw the ${m.name} out in ${b.name}. Go and look.` }); }
    out.push({ id: `${town.id}:${realmDay()}:d`, kind: 'inst', zone: Z.id, target: Z.dungeon.id, need: 1, have: 0, xp: lvlXp(0.8), gold: gold(2.5), name: `Clear the ${Z.dungeon.name}`, desc: `Enter the ${Z.dungeon.name} and come back out the bottom.` });
  } else {
    if (b.elite) out.push({ id: `${town.id}:${realmDay()}:c`, kind: 'kill', zone: Z.id, target: b.elite, need: 2, have: 0, xp: lvlXp(0.7), gold: gold(2), name: `Bounty: ${ENEMIES[b.elite].name}`, desc: `Two ${ENEMIES[b.elite].name}s have been raiding the roads. End them.` });
    if (b.boss) out.push({ id: `${town.id}:${realmDay()}:b`, kind: 'boss', zone: Z.id, target: b.boss, need: 1, have: 0, xp: lvlXp(1.4), gold: gold(5), name: `Contract: ${W_BOSS_DEF[b.boss].name}`, desc: `${W_BOSS_DEF[b.boss].name} waits in its lair. The guild pays well.` });
    const nb = gatesOf(b).map((g) => BIOME[g.to]).filter((z) => !(W.ch.seenZones || []).includes(z.id));
    if (nb.length) { const z = R.pick(nb); out.push({ id: `${town.id}:z:${z.id}`, kind: 'zone', zone: z.id, target: z.id, need: 1, have: 0, xp: lvlXp(0.4), gold: gold(1), name: `Scout ${z.name}`, desc: `Cross into ${z.name} (level ${z.lvl[0]}–${z.lvl[1]}) and report back with your boots still on.` }); }
  }
  return out;
}
function questProgress(kind, target, zone) {
  if (!W.ch || !W.ch.quests) return;
  for (const q of [...W.ch.quests]) {
    if (q.kind !== kind || q.target !== target) continue;
    if (q.zone && zone && q.zone !== zone && kind !== 'zone') continue;
    q.have = Math.min(q.need, (q.have || 0) + 1);
    if (q.have >= q.need) completeQuest(q);
    else if (kind === 'kill' && (q.have % 3 === 0 || q.need - q.have <= 2)) toast(`${q.name}: ${q.have}/${q.need}`, '#ffd35c');
  }
}
function completeQuest(q) {
  const p = G.p;
  W.ch.quests = W.ch.quests.filter((x) => x !== q);
  W.ch.qdone = (W.ch.qdone || 0) + 1;
  W.ch.qdoneIds = [...(W.ch.qdoneIds || []).slice(-60), q.id];
  p.gold += q.gold;
  gainXP(q.xp);
  const msg = () => { banner('Quest complete', `${q.name} · +${q.xp} XP · +${q.gold} gold`, 2.8); Sound.play('levelup', { p: 1.2 }); };
  if (W.inInst || W.travelling) (W.afterLoad = W.afterLoad || []).push(msg); else later(0.3, msg);
  const F = CD.save.fs; F.quests = (F.quests || 0) + 1;
  saveRealm();
}
hook('realmKill', (e) => questProgress('kill', e.kind, W.Z && W.Z.id));
hook('realmBoss', (e) => questProgress('boss', e.kind, W.Z && W.Z.id));
hook('realmInstance', (inst) => { const Z = BIOME[inst.zone]; questProgress('inst', `${inst.zone}:dungeon`, inst.zone); });
hook('realmMark', (m) => questProgress('explore', m.id, W.Z && W.Z.id));
hook('realmZone', (Z) => questProgress('zone', Z.id, Z.id));

/* ---------- shared bits for the screens ---------- */
const goldChip = () => h('span', { class: 'embers', title: 'Gold' }, h('img', { alt: '', src: iconURL(miscIcon('gold'), 2) }), String(G.p ? G.p.gold : 0));
const priceL = () => Math.max(1, G.p ? G.p.level : 1);
function svcModal(title, sub, build) {
  const el = h('div', { class: 'modal' });
  const draw = () => { el.innerHTML = ''; el.append(h('div', { class: 'panel svc' }, h('h2', {}, title), sub ? h('p', {}, sub) : null, h('div', { class: 'row' }, goldChip(), emberChip()), ...build(redraw, el), h('div', { class: 'row' }, btn('Leave', () => UI.close(el), '', {})))); };
  const redraw = () => { draw(); UI.focusFirst(el); };
  draw();
  UI.open(el, { modal: true, replace: false });
  return el;
}
function pay(cost, fn) { const p = G.p; if (p.gold < cost) { Sound.play('deny'); toast('Not enough gold'); return false; } p.gold -= cost; Sound.play('buy'); fn(); return true; }
const costBtn = (label, cost, fn, cls = '', attrs = {}) => btn(h('span', {}, `${label} · `, h('span', { class: 'cost' }, `${cost}g`)), fn, cls, attrs);
function realmStock(town, role) {
  const R = new RNG(hash2(hashStr(town.id + role), realmDay())), L = Math.max(W.Z.b.lvl[0], Math.min(W.Z.b.lvl[1] + 3, G.p.level));
  if (role === 'smith') return [0, 1, 2].map((i) => { const w = realmWeapon(R, L, i === 2 ? 'rare' : i === 1 ? 'uncommon' : 'common'); return { type: 'weapon', w, price: Math.round((40 + L * 9) * RARITY[w.rar].mul * (1 + i * 0.3) * G.p.stats.shopMul) }; });
  if (role === 'mystic') return [{ type: 'ability', id: R.pick(abilityPool()) }, { type: 'ability', id: R.pick(abilityPool()) }, { type: 'relic', id: randomRelic(R) }].filter((x) => x.id).map((x) => ({ ...x, price: Math.round((x.type === 'relic' ? 160 : 90) * (1 + L * 0.06) * G.p.stats.shopMul) }));
  return [];
}
UI.realmShop = function (role, n) {
  const p = G.p, town = n.town, L = priceL(), title = `${NPC_TITLE[role] || 'Merchant'} of ${town.name}`;
  const bought = new Set();
  svcModal(title, SHOP_BLURB[role] || '', (redraw, el) => {
    const out = [];
    const menu = h('div', { class: 'menu', style: { width: '100%' } });
    if (role === 'general' || role === 'tentshop') {
      const potP = Math.round((8 + L * 1.6) * p.stats.shopMul), missing = Math.max(0, p.stats.potMax - p.potions);
      if (missing) menu.append(costBtn(`Fill your flasks (${missing})`, potP * missing, () => pay(potP * missing, () => { p.potions = p.stats.potMax; redraw(); }), 'primary', { 'data-autofocus': true }));
      else menu.append(btn('Your flasks are full', () => {}, 'small', { disabled: true }));
      menu.append(costBtn('A key', 25, () => pay(25, () => { p.keys++; redraw(); })));
      menu.append(costBtn('Scroll of return (home, now)', 40 + L * 2, () => pay(40 + L * 2, () => { UI.close(el); realmGoHome(); })));
      menu.append(costBtn('Trail rations (+15% XP, 10 min)', 30 + L * 3, () => pay(30 + L * 3, () => { p.restedT = 600; recalcStats(p); toast('Well fed. +15% experience', '#7de08a'); redraw(); })));
      sellRows(menu, p, redraw);
    } else if (role === 'smith') {
      const w = p.weapon, cap = Math.max(5, Math.floor(p.level / 3) + 3), up = Math.round((45 + 30 * (w.lvl || 0) + 4 * L) * p.stats.shopMul), re = Math.round((30 + 6 * L) * p.stats.shopMul);
      out.push(h('div', { html: weaponCardHTML(w) }));
      menu.append(costBtn(`Temper to +${(w.lvl || 0) + 1} (+12% damage, max +${cap})`, up, () => { if ((w.lvl || 0) >= cap) { toast('It cannot take more yet'); return; } pay(up, () => { w.lvl = (w.lvl || 0) + 1; Sound.play('slam', { p: 1.6, v: 0.6 }); recalcStats(p); redraw(); }); }, 'primary', { 'data-autofocus': true, disabled: (w.lvl || 0) >= cap ? true : null }));
      if (w.rar !== 'common' && w.rar !== 'natural') menu.append(costBtn('Reforge its traits', re, () => pay(re, () => { const nw = makeWeapon(w.id, w.rar, G.run.rng); w.affixes = nw.affixes; if (w.rar !== 'evolved') w.legend = nw.legend; recalcStats(p); redraw(); })));
      if (typeof weaponEvoInfo === 'function') { const ev = weaponEvoInfo(p, w); if (ev && ev.ok) menu.append(btn(`Evolve into ${ev.def.name}`, () => { if (evolveWeapon(p, w)) redraw(); }, 'primary')); }
      if (p.weapons[1] && !p.beast) menu.append(btn('Work on your other weapon', () => { swapWeapon(p); redraw(); }));
      sellRows(menu, p, redraw);
      if (!p.beast) for (const it of realmStock(town, role)) { const key = JSON.stringify(it.w); if (bought.has(key)) continue; menu.append(costBtn(`Buy ${weaponName(it.w)} (${RARITY[it.w.rar].name})`, it.price, () => pay(it.price, () => { bought.add(key); if (p.weapons.length < 2) { p.weapons.push(it.w); recalcStats(p); toast(`${weaponName(it.w)} is in your other hand`, '#7de08a'); } else { spawnItem({ type: 'weapon', w: it.w }, p.x, p.y + 12); toast('Both hands are full: placed at your feet', '#7de08a'); } saveRealm(); redraw(); }))); }
    } else if (role === 'mystic') {
      for (const it of realmStock(town, role)) { const key = it.type + it.id; if (bought.has(key)) continue; menu.append(costBtn(`${it.type === 'relic' ? 'Relic' : 'Tome'}: ${it.type === 'relic' ? RELIC[it.id].name : ABILITY[it.id].name}`, it.price, () => pay(it.price, () => { bought.add(key); spawnItem({ type: it.type, id: it.id }, p.x, p.y + 12); toast('Placed at your feet', '#c873ff'); redraw(); }), '', { title: it.type === 'relic' ? RELIC[it.id].desc : ABILITY[it.id].desc })); }
      menu.append(btn('Study the passive tree', () => { UI.close(el); UI.tree(p.cls, { inRun: true }); }));
    } else if (role === 'inn') {
      const c = 10 + L * 2;
      menu.append(costBtn('Rest the night (heal, make this home, +15% XP 10 min)', c, () => pay(c, () => { heal(p, p.maxHp); p.potions = Math.max(p.potions, p.stats.potMax); p.restedT = 600; W.ch.home = { zone: W.Z.id, x: n.x, y: n.y + 20, name: town.name }; recalcStats(p); W.t = Math.ceil(W.t / DAY_LEN) * DAY_LEN + DAY_LEN * 0.3; toast(`Rested in ${town.name}. You will wake here if you fall.`, '#ffd35c'); saveRealm(); redraw(); }), 'primary', { 'data-autofocus': true }));
      menu.append(btn(`Home: ${W.ch.home ? W.ch.home.name || 'set' : 'Emberhold'}`, () => {}, 'small', { disabled: true }));
    } else if (role === 'temple') {
      for (const id in BLESSINGS) { const B = BLESSINGS[id], c = Math.round((40 + L * 6) * B.cost); menu.append(costBtn(`${B.name}: ${B.desc} (10 min)`, c, () => pay(c, () => { p.bless = id; p.blessT = 600; recalcStats(p); ring(p.x, p.y - 10, 40, '#fff6c8', 0.6); toast(`${B.name}`, '#fff6c8'); redraw(); }), p.bless === id && p.blessT > 0 ? 'primary' : '')); }
      menu.append(btn('Offer embers at the camp altar', () => { UI.close(el); W.campFromRealm = true; UI.camp('upgrades'); }));
    } else if (role === 'bank') {
      const st = W.ch.stash = W.ch.stash || [], bank = W.ch.bankGold || 0;
      out.push(h('p', {}, `Banked gold: ${bank}. Banked gold is never lost when you fall. Your stash holds ${st.length} of 12 weapons.`));
      const dep = Math.floor(p.gold / 2);
      menu.append(btn(`Deposit all ${p.gold} gold`, () => { W.ch.bankGold = bank + p.gold; p.gold = 0; Sound.play('coin'); saveRealm(); redraw(); }, 'primary', { disabled: p.gold ? null : true, 'data-autofocus': true }));
      menu.append(btn(`Deposit half (${dep})`, () => { p.gold -= dep; W.ch.bankGold = bank + dep; Sound.play('coin'); saveRealm(); redraw(); }, '', { disabled: dep ? null : true }));
      menu.append(btn(`Withdraw ${bank} gold`, () => { p.gold += bank; W.ch.bankGold = 0; Sound.play('coin'); saveRealm(); redraw(); }, '', { disabled: bank ? null : true }));
      const off = p.weapons[1 - p.wi];
      if (off && !p.beast) menu.append(btn(`Stash ${weaponName(off)}`, () => { if (st.length >= 12) { toast('Your stash is full'); return; } st.push(off); p.weapons[1 - p.wi] = null; p.weapons = p.weapons.filter(Boolean); p.wi = p.weapons.indexOf(p.weapon); recalcStats(p); saveRealm(); redraw(); }));
      st.forEach((w, i) => menu.append(btn(`Take ${weaponName(w)} (${RARITY[w.rar].name})`, () => { st.splice(i, 1); if (p.weapons.length < 2 && !p.beast) { p.weapons.push(w); recalcStats(p); toast(`${weaponName(w)} is in your other hand`, '#7de08a'); } else spawnItem({ type: 'weapon', w }, p.x, p.y + 12); saveRealm(); redraw(); }, 'small')));
    } else if (role === 'stable') {
      if (W.ch.mount) out.push(h('p', {}, 'Your horse waits for you. Out of a fight you ride it everywhere: much faster than walking.'));
      else menu.append(costBtn('Buy a riding horse (ride out of combat, much faster)', 400, () => pay(400, () => { W.ch.mount = true; toast('You bought a riding horse. Ride whenever no monster is chasing you.', '#ffd35c'); saveRealm(); redraw(); }), 'primary', { 'data-autofocus': true }));
    } else if (role === 'tailor') {
      if (p.beast) out.push(h('p', {}, 'The tailor looks at your fur and laughs kindly.'));
      else {
        const dyes = [['Ember', { main: '#b33a2a', cloth: '#6e1f1a', trim: '#f2b53c' }], ['Royal', { main: '#3a5e9a', cloth: '#22385e', trim: '#ffd35c' }], ['Forest', { main: '#4f7a3a', cloth: '#2f4d24', trim: '#c8a070' }], ['Night', { main: '#2c2a34', cloth: '#18161e', trim: '#c873ff' }], ['Bone', { main: '#e8e0d0', cloth: '#a89880', trim: '#c8902a' }], ['Rose', { main: '#c8508a', cloth: '#7a2a5a', trim: '#ffe0f0' }], ['Steel', { main: '#8fa3b8', cloth: '#55677c', trim: '#2f5fa8' }], ['Original', null]];
        for (const [name, dye] of dyes) menu.append(costBtn(`${name} colours`, dye ? 60 : 0, () => pay(dye ? 60 : 0, () => { W.ch.dye = dye; if (dye) applyDye(p, dye); else { p.look = CLASS[p.cls].look; p.dyeKey = ''; } saveRealm(); redraw(); }), W.ch.dye && dye && W.ch.dye.main === dye.main ? 'primary' : ''));
      }
    }
    return [...out, menu];
  });
};
const SHOP_BLURB = { general: 'Flasks, keys and supplies for the road.', tentshop: 'A trader at the edge of the wilds.', smith: 'Tempering, reforging, and steel for sale.', mystic: 'Tomes and relics, for a price.', inn: 'A warm bed. Wake here if the road kills you.', temple: 'Blessings for the brave, and the camp altar.', bank: 'Gold kept safe, weapons kept safer.', stable: 'Fast mounts for long roads.', tailor: 'A new look for a new legend.' };
function realmGoHome() {
  const h2 = W.ch.home || { zone: 'meadows', x: null, y: null };
  Sound.play('magic');
  if (h2.zone !== W.Z.id) travelTo(h2.zone, h2.x != null ? { x: h2.x, y: h2.y } : null);
  else realmFade(() => loadZone(h2.zone, h2.x, h2.y));
}
UI.realmBoard = function (n) {
  const town = n.town, guild = n.role === 'guild';
  svcModal(guild ? `Guild of ${town.name}` : `Quest board · ${town.name}`, guild ? 'Bounties and contracts for proven heroes.' : 'Work for anyone with a weapon and a free afternoon.', (redraw) => {
    const qs = W.ch.quests = W.ch.quests || [];
    const offers = questOffers(town, guild).filter((q) => !qs.some((x) => x.id === q.id) && !(W.ch.qdoneIds || []).includes(q.id));
    const box = h('div', { class: 'quests' });
    if (qs.length) box.append(h('h3', {}, `Your quests (${qs.length} of 6)`), ...qs.map((q) => h('div', { class: 'quest' }, h('b', {}, q.name), h('small', {}, `${q.desc} · ${q.have || 0}/${q.need} · ${BIOME[q.zone] ? BIOME[q.zone].name : ''}`), btn('Drop', () => { W.ch.quests = qs.filter((x) => x !== q); saveRealm(); redraw(); }, 'small'))));
    box.append(h('h3', {}, offers.length ? 'On offer' : 'Nothing new today. Come back tomorrow.'));
    offers.forEach((q, i) => box.append(h('div', { class: 'quest' }, h('b', {}, q.name), h('small', {}, `${q.desc} · reward ${q.xp} XP and ${q.gold} gold`), btn('Accept', () => { if (qs.length >= 6) { toast('You carry too many quests'); return; } if (qs.some((x) => x.kind === q.kind && x.target === q.target)) { toast('You already have that job from another board'); return; } qs.push(q); Sound.play('pickup'); saveRealm(); if (q.kind === 'zone' && (W.ch.seenZones || []).includes(q.target)) completeQuest(q); redraw(); }, i === 0 ? 'primary' : '', { 'data-autofocus': i === 0 ? true : null }))));
    return [box];
  });
};

/* ---------- waystones ---------- */
UI.realmTravel = function () {
  const ch = W.ch, info = ch.wayInfo = ch.wayInfo || {};
  // waystones attuned before positions were remembered
  for (const w of W.Z.ways) if (ch.ways.includes(w.id) && !info[w.id]) info[w.id] = { zone: W.Z.id, x: w.x, y: w.y, name: w.name };
  svcModal('Waystone', 'Step through to any stone you have attuned to.', () => {
    const wrap = h('div', { class: 'quests' });
    for (const b of BIOMES) {
      const ws = Object.entries(info).filter(([, q]) => q.zone === b.id);
      if (!ws.length) continue;
      wrap.append(h('h3', {}, `${b.name} · Lv ${b.lvl[0]}–${b.lvl[1]}`));
      for (const [, w] of ws) wrap.append(btn(w.name, () => {
        UI.clear(); Sound.play('magic');
        const pos = { x: (w.x + 0.5) * TS, y: (w.y + 1.8) * TS };
        if (b.id === W.Z.id) realmFade(() => { if (W.bossE && !W.bossE.dead) { W.bossE.dead = true; W.bossE.despawn = true; W.bossE = null; } G.boss = null; $('bossbar').hidden = true; realmMusic(true); ensureChunks(W.Z, pos.x, pos.y, 1); const s2 = realmFreeSpot(pos.x, pos.y); G.p.x = s2.x; G.p.y = s2.y; moveRoomWindow(); snapCamera(); streamZone(true); });
        else travelTo(b.id, pos);
      }, 'small'));
    }
    return [wrap];
  });
};

/* ---------- the fall ---------- */

/* ---------- maps ---------- */
const GR_COL = (b) => ({ [GR.BASE]: b.g[0], [GR.ALT]: b.g[1], [GR.DARK]: b.g[2], [GR.ROAD]: b.road, [GR.PLAZA]: '#c8bca8', [GR.SAND]: mixHex(b.g[3], '#e8d4a0', 0.6), [GR.SHALLOW]: b.water[1], [GR.DEEP]: b.water[0], [GR.LAVA]: '#ff6a1a', [GR.ICE]: '#cfeaf6', [GR.TOXIC]: '#6aa83a', [GR.CLIFF]: b.cliff[1], [GR.BRIDGE]: '#8a6a42', [GR.FIELD]: '#6a4a2e', [GR.FLOOR]: '#c8bca8', [GR.DIRT]: b.road });
function zoneOverview(Z) {
  if (Z.overview) return Z.overview;
  const N = 320, k = ZT / N, c = mkCanvas(N, N), g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data, b = Z.b;
  const col = (hex) => hexRGB(hex);
  const land = col(b.g[0]), alt = col(b.g[1]), water = col(b.water[0]), shallow = col(b.water[1]), rock = col(b.cliff[1]), road = col(b.road), town = col('#c8bca8'), bld = col('#5a3a2a'), lava = col('#ff6a1a'), ice = col('#cfeaf6'), sand = col(mixHex(b.g[3], '#e8d4a0', 0.6)), forest = col(shade(b.g[2], -0.25));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const tx = Math.floor(x * k + k / 2), ty = Math.floor(y * k + k / 2), m = Z.mask[ty * ZT + tx];
    let c3;
    if (m & MK.BUILD) c3 = bld;
    else if (m & MK.WALL) c3 = rock;
    else if (m & MK.ROAD) c3 = m & MK.TOWN ? town : road;
    else {
      const l = landAt(Z, tx, ty, 0.5);
      if (l === 'deep' || l === 'water' || l === 'river') c3 = b.lavaWater ? lava : b.iceWater ? ice : water;
      else if (l === 'shallow' || l === 'rivershore') c3 = b.lavaWater ? col(b.g[2]) : shallow;
      else if (l === 'rock') c3 = rock;
      else if (fieldAt(Z.E, tx, ty) < b.wl + 0.035) c3 = sand;
      else c3 = fieldAt(Z.F, tx, ty) * b.tdens > 0.22 ? forest : fieldAt(Z.M, tx, ty) > 0.6 ? alt : land;
    }
    const i = (y * N + x) * 4; d[i] = c3[0]; d[i + 1] = c3[1]; d[i + 2] = c3[2]; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  Z.overview = c;
  return c;
}
UI.realmMap = function (tab = 'zone') {
  if (UI.top() && UI.top()._isMap) return;
  const Z = W.Z, b = Z.b, N = 320;
  const cv = h('canvas', { width: N, height: N, class: 'zmap' });
  const el = h('div', { class: 'modal' }, h('div', { class: 'panel wide' },
    h('div', { class: 'tabs' }, btn('This zone', () => { UI.close(el); UI.realmMap('zone'); }, tab === 'zone' ? 'primary small' : 'small'), btn('The realm', () => { UI.close(el); UI.realmMap('realm'); }, tab === 'realm' ? 'primary small' : 'small'), btn('Quests', () => { UI.close(el); UI.realmMap('quests'); }, tab === 'quests' ? 'primary small' : 'small')),
    tab === 'zone' ? h('h2', {}, `${b.name} · Lv ${b.lvl[0]}–${b.lvl[1]}`) : tab === 'realm' ? h('h2', {}, 'The Realm') : h('h2', {}, 'Quests'),
    tab === 'zone' ? h('div', { class: 'mapwrap zwrap' }, cv, h('div', { class: 'legend' }, ...[['You', '#ff7a3c'], ['Town', '#ffd35c'], ['Waystone', '#7fe8ff'], ['Dungeon', '#c873ff'], ['World boss', '#e2434f'], ['Landmark', '#e8d8b0'], ['Exit', '#ffffff'], ['Quest', '#7de08a'], ['Other heroes', '#5aa8ff']].map(([l, c]) => h('span', {}, h('i', { style: { background: c } }), l)))) : null,
    tab === 'realm' ? realmGrid() : null,
    tab === 'quests' ? questList() : null,
    h('div', { class: 'row' }, btn('Close', () => UI.close(el), 'primary', { 'data-autofocus': true }))));
  el._isMap = true;
  UI.open(el, { modal: true, replace: false });
  if (tab !== 'zone') return;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(zoneOverview(Z), 0, 0);
  // fog
  const cell = N / DISC_N;
  g.fillStyle = 'rgba(8,6,10,0.88)';
  for (let y = 0; y < DISC_N; y++) for (let x = 0; x < DISC_N; x++) if (!W.disc[y * DISC_N + x]) g.fillRect(Math.floor(x * cell), Math.floor(y * cell), Math.ceil(cell), Math.ceil(cell));
  const seen = (tx, ty) => W.disc[Math.floor(ty / 16) * DISC_N + Math.floor(tx / 16)];
  const k = N / ZT, dot = (tx, ty, c, r = 3) => { g.fillStyle = '#120a0e'; g.fillRect(Math.round(tx * k) - r - 1, Math.round(ty * k) - r - 1, r * 2 + 2, r * 2 + 2); g.fillStyle = c; g.fillRect(Math.round(tx * k) - r, Math.round(ty * k) - r, r * 2, r * 2); };
  g.font = '9px monospace'; g.textAlign = 'center';
  for (const s of Z.towns) if (seen(s.x, s.y)) { dot(s.x, s.y, '#ffd35c', s.kind === 'capital' ? 4 : s.kind === 'town' ? 3 : 2); g.fillStyle = '#fff'; const hw = Math.ceil(g.measureText(s.name).width / 2) + 2; g.fillText(s.name, clamp(Math.round(s.x * k), hw, N - hw), Math.max(10, Math.round(s.y * k) - 6)); }
  for (const w of Z.ways) if (W.ch.ways.includes(w.id)) dot(w.x, w.y, '#7fe8ff', 2);
  if (seen(Z.dungeon.x, Z.dungeon.y)) dot(Z.dungeon.x, Z.dungeon.y, '#c873ff', 3);
  if (seen(Z.lair.x, Z.lair.y)) dot(Z.lair.x, Z.lair.y, '#e2434f', 3);
  for (const m of Z.marks) if ((W.ch.marks || []).includes(m.id)) dot(m.x, m.y, '#e8d8b0', 2);
  for (const gt of Z.gates) { dot(gt.inX, gt.inY, '#ffffff', 2); g.fillStyle = '#fff'; g.fillText(BIOME[gt.to].name, clamp(Math.round(gt.inX * k), Math.ceil(g.measureText(BIOME[gt.to].name).width / 2) + 3, N - Math.ceil(g.measureText(BIOME[gt.to].name).width / 2) - 3), clamp(Math.round(gt.inY * k) + (gt.dir === 'n' ? 12 : -5), 10, N - 4)); }
  for (const q of W.ch.quests || []) { let t = null; if (q.kind === 'explore') { const m = Z.marks.find((mm) => mm.id === q.target); if (m) t = m; } else if (q.kind === 'boss' && q.zone === Z.id) t = Z.lair; else if (q.kind === 'inst' && q.zone === Z.id) t = Z.dungeon; if (t) dot(t.x, t.y, '#7de08a', 2); }
  if (typeof mmoGhosts === 'function') for (const q of mmoGhosts()) dot(q.x / TS, q.y / TS, '#5aa8ff', 2);
  const p = G.p; dot(p.x / TS, p.y / TS, '#ff7a3c', 3);
};
function realmGrid() {
  const wrap = h('div', { class: 'zone-grid' });
  const seen = W.ch.seenZones || [];
  for (let r = 0; r < WGRID; r++) for (let c = 0; c < WGRID; c++) {
    const b = zoneAt(c, r), known = seen.includes(b.id), here = W.Z && W.Z.id === b.id;
    wrap.append(h('div', { class: `zcell${known ? '' : ' unk'}${here ? ' here' : ''}`, style: { '--zc': b.g[0], '--zc2': b.g[2] }, title: known ? b.blurb : 'Unexplored' }, h('b', {}, known ? b.name : '???'), h('small', {}, `Lv ${b.lvl[0]}–${b.lvl[1]}`), here ? h('em', {}, 'you are here') : null));
  }
  return wrap;
}

/* ---------- the minimap and the HUD label ---------- */
const _drawMinimapRealm = drawMinimap;
drawMinimap = function (cv, big) {
  if (!(W.on && !W.inInst && W.Z && G.fl && G.fl.realm)) return _drawMinimapRealm(cv, big);
  const g = cv.getContext('2d'), Wd = cv.width, Hd = cv.height, Z = W.Z, p = G.p;
  const img = g.createImageData(Wd, Hd), d = img.data;
  const cols = HUD.mmCols && HUD.mmZone === Z.id ? HUD.mmCols : (HUD.mmZone = Z.id, HUD.mmCols = Object.fromEntries(Object.entries(GR_COL(Z.b)).map(([k2, v]) => [k2, hexRGB(v)])));
  const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS), x0 = ptx - (Wd >> 1), y0 = pty - (Hd >> 1);
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) {
    const tx = x0 + x, ty = y0 + y, i = (y * Wd + x) * 4;
    if (tx < 0 || ty < 0 || tx >= ZT || ty >= ZT) { d[i + 3] = 0; continue; }
    const k = ty * ZT + tx;
    let c = cols[Z.ground[k]] || cols[GR.BASE];
    if (Z.tiles[k] === TILE.TREE) c = [Math.max(0, c[0] - 40), Math.max(0, c[1] - 30), Math.max(0, c[2] - 40)];
    if (Z.mask[k] & MK.BUILD) c = [90, 58, 42];
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 235;
  }
  g.putImageData(img, 0, 0);
  const dot = (wx, wy, c, s = 2) => { const x = Math.round(wx / TS - x0), y = Math.round(wy / TS - y0); if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; g.fillStyle = c; g.fillRect(x - (s >> 1), y - (s >> 1), s, s); };
  for (const e of G.ents) if (!e.dead && e.type === 'enemy') dot(e.x, e.y, e.boss ? '#ff2a2a' : e.champion ? '#ffd35c' : e.aggro ? '#ff5a5a' : '#c84a4a', e.boss ? 4 : 2);
  for (const n of W.npcs) dot(n.x, n.y, n.role === 'board' ? '#ffd35c' : '#7de08a', 2);
  for (const o of realmInteractables(Z)) if (o.kind === 'waystone') dot(o.x, o.y, '#7fe8ff', 3); else if (o.kind === 'dungeon') dot(o.x, o.y, '#c873ff', 4);
  if (typeof mmoGhosts === 'function') for (const q of mmoGhosts()) dot(q.x, q.y, '#5aa8ff', 3);
  g.fillStyle = '#120a0e'; g.fillRect((Wd >> 1) - 2, (Hd >> 1) - 2, 5, 5); g.fillStyle = '#ff7a3c'; g.fillRect((Wd >> 1) - 1, (Hd >> 1) - 1, 3, 3);
};
const _updateHUDRealm = updateHUD;
updateHUD = function (dt) {
  _updateHUDRealm(dt);
  if (!(W.on && G.p)) return;
  if (!W.inInst && W.Z) {
    const b = W.Z.b, day = daylight(), tod = day > 0.65 ? 'Day' : day > 0.3 ? (realmTime() < 0.5 ? 'Dawn' : 'Dusk') : 'Night';
    setHTML($('floor-lbl'), 'flbl', `<b>${esc(b.name)}</b> Lv ${b.lvl[0]}–${b.lvl[1]} · ${tod}`);
    const qs = [...(W.ch.quests || [])].sort((a, c) => (c.id === W.ch.track) - (a.id === W.ch.track));
    setHTML($('omens'), 'omens', buffChips() + qs.slice(0, 3).map((q) => `<span style="color:#ffd35c" title="${esc(q.desc)}">${q.id === W.ch.track ? '▸ ' : ''}${esc(q.name)} ${q.have || 0}/${q.need}</span>`).join('') + (typeof mmoCount === 'function' && mmoCount() ? `<span style="color:#5aa8ff">${mmoCount()} other hero${mmoCount() > 1 ? 'es' : ''} here</span>` : ''));
  } else if (W.inInst && W.inst) setHTML($('floor-lbl'), 'flbl', `<b>${esc(W.inst.name)}</b> ${G.run.floorIdx - W.inst.first + 1}/${FLOORS_PER_ACT} · Lv ${W.inst.lvl}`);
};

/* ---------- pause, map key and the title ---------- */
// in the Realm the pause menu says where you are and leaves the descent's own exits out
const pauseWhereDeep = pauseWhere;
pauseWhere = (p, run) => (W.on ? `${ascTitle(p) || playerName(p)} · level ${p.level} · ${W.inInst && W.inst ? W.inst.name : W.Z ? W.Z.b.name : ''} · ${fmtTime(W.ch.play || 0)} played` : pauseWhereDeep(p, run));
for (const id of ['map', 'savequit', 'abandon']) {
  const deep = PAUSE_ITEMS.find((it) => it.id === id).make;
  pauseItem(id, PAUSE_ITEMS.find((it) => it.id === id).order, (el, p, run) => (!W.on ? deep(el, p, run) : id === 'map' ? (W.inInst ? deep(el, p, run) : btn('Map and quests', () => { UI.close(el); UI.realmMap(); })) : null));
}
pauseItem('leaveinst', 130, () => (W.on && W.inInst ? btn('Leave the dungeon', () => UI.confirm('Leave the dungeon?', 'You walk back out to the world. Anything you found is yours to keep.', 'Leave', () => { UI.clear(); exitInstance(false); })) : null));
pauseItem('leaverealm', 135, () => (W.on ? btn('Save and return to title', () => { UI.clear(); leaveRealm(); toast('Your hero is saved in the Realm'); }) : null));
const _mapRealm = UI.map;
UI.map = function () { if (W.on && !W.inInst && W.Z) return UI.realmMap(); return _mapRealm(); };
const _titleRealm = UI.title;
UI.title = function () {
  // the camp altar opened from a temple goes back to the game
  if (W.on && W.campFromRealm && G.p && G.mode === 'play') { W.campFromRealm = false; UI.clear(); Input.gameFocus = true; return; }
  W.campFromRealm = false;
  // anything else that reaches the title while in the Realm leaves it properly first
  if (W.on) leaveRealm(false);
  _titleRealm();
  const el = UI.top(), menu = el && el.querySelector('.menu');
  if (!menu) return;
  const n = realmStore().chars.length, hasRun = !!CD.save.run;
  const b = btn(n ? 'Enter the Realm' : 'Enter the Realm · new', () => UI.realm(), hasRun ? '' : 'primary', hasRun ? {} : { 'data-autofocus': true });
  menu.insertBefore(b, menu.firstChild);
  if (!hasRun) for (const x of [...menu.children]) if (x !== b && x.classList.contains('primary')) { x.classList.remove('primary'); x.removeAttribute('data-autofocus'); }
  const sub = el.querySelector('.ttl-sub'); if (sub) sub.textContent = 'A realm of 25 lands above, the old deep below';
};
function realmCharPortrait(ch) {
  const cv = mkCanvas(56, 56), g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  try {
    const run = { souls: 0 }, p = restorePlayer(ch, run);
    const sp = heroFrame(p), k = Math.max(1, Math.floor(Math.min(52 / sp.w, 52 / sp.h)));
    g.drawImage(sp.c, Math.round(28 - sp.ax * k), Math.round(54 - (sp.ay + 1) * k), sp.w * k, sp.h * k);
  } catch (e) { /* no picture */ }
  cv.className = 'rportrait';
  return cv;
}

