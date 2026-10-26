/* ============================================================
   Cinderdeep — stats, loot, chests, shops, shrines, the forge,
   level-up picks and moving between floors
   ============================================================ */
function recalcStats(p) {
  const c = CLASS[p.cls], meta = (CD.save && CD.save.meta) || {};
  const s = {
    hpBase: c.hp, hpAdd: 0, hpMul: 1, armor: c.armor, spdBase: 80 * c.spd, spdMul: 1, dmgMul: 1, wDmg: 0, atkSpd: 1, crit: 0.05, critMul: 2,
    kbMul: 1, reachMul: 1, projBonus: 0, pierceBonus: 0, bounce: 0, burnCh: 0, poisonCh: 0, chillCh: 0, shockCh: 0, burnMul: 1, burnDur: 1,
    shockChain: 2, lifesteal: 0, killHeal: 0, dodge: 0, thorns: 0, regen: 0, dashMax: 1, dashCd: 1.15, pickR: 34, goldMul: 1, xpMul: 1, luck: 0,
    cdMul: 1, abDmg: 1, potMax: 2, potHeal: 0.4, clearHeal: 0, firstStrike: 0, cull: 0, wave: 0, frenzy: false, combust: false, plague: false,
    shatter: 0, angel: false, bulwark: 0, bladeDash: 0, echoCast: 0, surge: false, phoenix: false, fireproof: false, chillAura: 0, idol: 0,
    reflect: 0, petWolf: false, orbit: 0, sturdy: false, shopMul: 1, foeHp: 0, boomOnKill: 0, halo: 0, echoAtk: 0, markFirst: false,
    emberMul: 1, light: 0, goldDmg: false, dashThorns: false, dmgTaken: 1,
    giantSlayer: 0, vengeance: 0, spellweaver: 0, opportunist: 0, boomMul: 1, comboDmg: 0, adrenaline: 0, burnAura: 0, critHeal: 0, moons: 0, voidRift: 0, midasKill: 0, frostPulse: 0, curseBleed: 0, meteorCharm: 0,
  };
  // class passives
  if (p.cls === 'knight') s.dmgTaken = 0.85;
  if (p.cls === 'ranger') { s.crit += 0.1; s.pierceBonus += 1; }
  if (p.cls === 'pyro') { s.burnDur = 1.5; s.abDmg += 0.15; }
  if (p.cls === 'rogue') { s.critMul += 0.5; s.dashMax += 1; }
  if (p.cls === 'berserker') s.killHeal += 1;
  // camp upgrades
  for (const m of META) if (meta[m.id]) m.apply(s, meta[m.id]);
  // skills
  for (const id in p.skills) { const sk = SKILL[id]; if (sk) for (let i = 0; i < p.skills[id]; i++) sk.apply(s); }
  // relics
  for (const id of p.relics) if (RELIC[id]) RELIC[id].apply(s);
  // the weapon in hand
  const w = p.weapon || p.weapons[0];
  if (w) for (const a of w.affixes || []) if (AFFIX[a]) AFFIX[a].apply(s);
  runHooks('stats', s, p);
  if (G.run && G.run.heat >= 9) s.hpMul -= 0.2;
  if (p.maxHpPenalty) s.hpMul -= p.maxHpPenalty;
  s.crit = Math.min(0.9, s.crit);
  s.dodge = Math.min(0.5, s.dodge);
  s.spd = s.spdBase * s.spdMul;
  const oldMax = p.maxHp || 0;
  p.maxHp = Math.max(10, Math.round((s.hpBase + s.hpAdd) * Math.max(0.3, s.hpMul)));
  if (oldMax && p.maxHp > oldMax) p.hp += p.maxHp - oldMax;
  if (p.hp > p.maxHp) p.hp = p.maxHp;
  p.stats = s;
  if (p.dashCharges > s.dashMax) p.dashCharges = s.dashMax;
  if (p.potions > s.potMax) p.potions = s.potMax;
}

/* ---------- unlock pools ---------- */
function weaponPool() {
  const u = CD.save.unlocks.weapons || [];
  return WEAPONS.filter((w) => !w.natural && !w.evolved && (w.start || u.includes(w.id) || (G.p && CLASS[G.p.cls].weapon === w.id))).map((w) => w.id);
}
function abilityPool() {
  const u = CD.save.unlocks.abilities || [];
  return ABILITIES.filter((a) => a.start || u.includes(a.id) || (G.p && (CLASS[G.p.cls].ability === a.id || (G.p.form && FORMS[G.p.form] && FORMS[G.p.form].ability === a.id && G.p.abilities[0] && G.p.abilities[0].id !== a.id)))).map((a) => a.id);
}

/* ---------- weapons ---------- */
function rollRarity(rng, min = 'common', bonus = 0) {
  const luck = (G.p ? G.p.stats.luck : 0) + bonus + (G.fl ? G.fl.idx * 0.35 : 0);
  const mi = RARITY_ORDER.indexOf(min);
  const list = RARITY_ORDER.slice(mi).map((r, i) => ({ r, w: RARITY[r].w * (1 + luck * 0.18 * (i + mi)) }));
  return rng.weighted(list).r;
}
function makeWeapon(id, rar, rng) {
  const R = rng || new RNG((Math.random() * 1e9) | 0);
  const def = WEAPON[id];
  const w = { id, rar, affixes: [], legend: null, lvl: 0 };
  const pool = AFFIXES.filter((a) => !a.ranged || def.kind === 'ranged').map((a) => a.id);
  R.shuffle(pool);
  w.affixes = pool.slice(0, RARITY[rar].affixes);
  if (rar === 'legendary') w.legend = R.pick(LEGENDS).id;
  return w;
}
function randomWeapon(rng, minRar = 'common', bonus = 0) {
  const all = weaponPool();
  const fresh = all.filter((id) => !G.p || !G.p.weapons.some((w) => w && (w.id === id || WEAPON[w.id].from === id)));
  const id = rng.pick(fresh.length >= 2 ? fresh : all);
  return makeWeapon(id, rollRarity(rng, minRar, bonus), rng);
}
function weaponName(w) {
  const def = WEAPON[w.id];
  let n = def.name;
  if (w.legend) n = `${LEGEND[w.legend].name} ${n}`;
  else if (w.affixes && w.affixes.length) n = `${AFFIX[w.affixes[0]].name} ${n}`;
  if (w.lvl) n += ` +${w.lvl}`;
  return n;
}
function weaponDps(w, p = G.p) {
  const def = WEAPON[w.id], s = p.stats;
  let d = def.dmg * RARITY[w.rar].mul * (1 + 0.12 * (w.lvl || 0));
  let mult = (def.count || 1);
  if (def.style === 'chain') mult = 1 + (def.chains - 1) * 0.6;
  for (const a of w.affixes) { if (a === 'heavy') d *= 1.25; }
  let r = def.rate;
  for (const a of w.affixes) { if (a === 'swift') r *= 1.2; if (a === 'heavy') r *= 0.92; }
  return d * mult * r * (s ? s.dmgMul : 1);
}

/* ---------- loot ---------- */
function rollLoot(rng, tier) {
  // tier: wood | silver | gold | shop
  const R = rng.next();
  if (tier === 'wood') {
    if (R < 0.45) return { type: 'gold', n: rng.int(6, 14) + G.fl.idx * 2 };
    if (R < 0.65) return { type: 'potion' };
    if (R < 0.8) return { type: 'key' };
    return { type: 'weapon', w: randomWeapon(rng, 'common') };
  }
  if (tier === 'silver') {
    if (R < 0.5) return { type: 'weapon', w: randomWeapon(rng, 'uncommon', 1) };
    if (R < 0.8) return { type: 'ability', id: rng.pick(abilityPool()) };
    if (R < 0.9) return { type: 'relic', id: randomRelic(rng) };
    return { type: 'gold', n: rng.int(20, 35) + G.fl.idx * 4 };
  }
  // gold
  if (R < 0.42) return { type: 'weapon', w: randomWeapon(rng, 'rare', 2) };
  if (R < 0.72) return { type: 'ability', id: rng.pick(abilityPool()) };
  return { type: 'relic', id: randomRelic(rng) };
}
function randomRelic(rng, exclude = []) {
  const owned = G.p ? G.p.relics : [];
  // accessories come from skill trees, not the floor
  const list = RELICS.filter((r) => !r.acc && !owned.includes(r.id) && !exclude.includes(r.id) && !G.items.some((it) => it.type === 'relic' && it.id === r.id));
  return list.length ? rng.pick(list).id : null;
}
function spawnItem(item, x, y, o = {}) {
  if (!item || (item.type === 'relic' && !item.id)) { dropPickup('gold', x, y, 15); return null; }
  if (item.type === 'gold') { for (let k = 0; k < Math.ceil(item.n / 5); k++) dropPickup('gold', x, y, Math.min(5, item.n - k * 5)); return null; }
  if (item.type === 'potion' || item.type === 'key' || item.type === 'heart') { dropPickup(item.type, x, y, 1); return null; }
  if (G.room && !o.shop) ({ x, y } = freeSpotNear(G.room, x, y));
  const it = { ...item, x, y, t: 0, room: G.room ? G.room.id : 0, ...o };
  G.items.push(it);
  return it;
}
function itemTitle(it) {
  if (it.type === 'weapon') return weaponName(it.w);
  if (it.type === 'ability') return ABILITY[it.id].name;
  if (it.type === 'relic') return RELIC[it.id].name;
  if (it.type === 'potion') return 'Health Potion';
  if (it.type === 'key') return 'Key';
  if (it.type === 'heart') return 'Hearty Meal';
  if (it.type === 'tome') return 'Tome of Learning';
  return '?';
}
function itemColor(it) {
  if (it.type === 'weapon') return RARITY[it.w.rar].color;
  if (it.type === 'relic') return '#ff6f9c';
  if (it.type === 'ability') return '#b98cff';
  return '#f1e5cd';
}
function itemPrice(it) {
  const base = { weapon: 38, ability: 55, relic: 95, potion: 22, key: 18, heart: 15, tome: 60 }[it.type] || 30;
  let pr = base * (1 + G.fl.idx * 0.16);
  if (it.type === 'weapon') pr *= RARITY[it.w.rar].price;
  pr *= G.p.stats.shopMul * (G.run.heat >= 5 ? 1.25 : 1);
  return Math.max(5, Math.round(pr));
}

/* ---------- chests ---------- */
function openChest(pr) {
  const p = G.p;
  if (pr.opened) return;
  if (pr.mimic && typeof mimicWake === 'function') return mimicWake(pr);
  if (pr.chest === 'silver' && !pr.unlocked) {
    if (p.keys <= 0) { toast('This chest needs a key'); Sound.play('deny'); return; }
    p.keys--; pr.unlocked = true; Sound.play('unlock');
  }
  pr.opened = true;
  Sound.play('chest');
  burst(pr.x, pr.y - 8, 18, ['#ffd35c', '#ffffff', '#ffb35e'], { smax: 100, glow: true, vz: 120 });
  flashLight(pr.x, pr.y - 6, 50, '#ffd35c', 0.5);
  const rng = G.run.rng;
  const tier = pr.chest === 'gold' ? 'gold' : pr.chest === 'silver' ? 'silver' : 'wood';
  const bonus = p.stats.luck >= 2 && tier === 'silver';
  const loot = rollLoot(rng, bonus ? 'gold' : tier);
  later(0.2, () => spawnItem(loot, pr.x, pr.y + 14));
  if (tier !== 'wood') dropPickup('gold', pr.x, pr.y, rng.int(3, 8) + G.fl.idx);
  if (CD.save.meta.sense) dropPickup('gold', pr.x, pr.y, rng.int(4, 9) + G.fl.idx);
  if (tier === 'gold' && rng.chance(0.4)) dropPickup('potion', pr.x, pr.y, 1);
}

/* ---------- shops ---------- */
function stockShop(r) {
  if (r.stocked) return;
  r.stocked = true;
  const rng = G.run.rng, fl = G.fl;
  const kinds = [
    { type: 'weapon', w: randomWeapon(rng, 'uncommon', 1) },
    rng.chance(0.55) ? { type: 'ability', id: rng.pick(abilityPool()) } : { type: 'relic', id: randomRelic(rng) },
    { type: 'potion' },
    rng.chance(0.5) ? { type: 'key' } : rng.chance(0.5) ? { type: 'tome' } : { type: 'heart' },
  ];
  runHooks('shopStock', kinds, r);
  r.shopSlots.forEach((pid, k) => {
    const ped = fl.props[pid];
    const it = kinds[k];
    if (!it || (it.type === 'relic' && !it.id)) return;
    const item = { ...it, x: ped.x, y: ped.y - 10, t: 0, room: r.id, shop: true, ped: pid };
    item.price = itemPrice(item);
    G.items.push(item);
  });
}

/* ---------- interacting ---------- */
// Other modules add what the hero can use with interactable({ near, prompt, use }):
// near(p, best) returns something closer than best, or best; prompt(t) names a target it owns, or
// returns null; use(t) acts on a target and returns true if it was theirs. The newest is asked first.
const INTERACT = [];
const interactable = (source) => INTERACT.unshift(source);
function nearestInteract() {
  let best = nearestCore();
  for (let i = INTERACT.length - 1; i >= 0; i--) if (INTERACT[i].near) best = INTERACT[i].near(G.p, best);
  return best;
}
function promptFor(t) {
  if (!t) return null;
  for (const s of INTERACT) { const r = s.prompt && s.prompt(t); if (r != null) return r; }
  return promptCore(t);
}
function interact() {
  const t = nearestInteract();
  if (!t) return;
  for (const s of INTERACT) if (s.use && s.use(t)) return;
  interactCore(t);
}
// the dungeon's own: items, chests, shrines, fountains, the forge, stairs and the rest
function nearestCore() {
  const p = G.p, fl = G.fl;
  let best = null, bd = 26;
  for (const it of G.items) {
    if (it.room !== (G.room && G.room.id)) continue;
    const d = Math.hypot(it.x - p.x, it.y - p.y);
    if (d < (it.shop ? 22 : 18) && d < bd) { bd = d; best = { kind: 'item', it }; }
  }
  if (G.room) for (const pid of G.room.props) {
    const pr = fl.props[pid];
    if (pr.broken) continue;
    const usable = (pr.chest && !pr.opened) || (pr.shrine && !pr.used) || (pr.fountain && !pr.used) || pr.forge || (pr.challenge && !pr.used) || (pr.relicChoice && !pr.used) || (pr.stairs && pr.active) || pr.npc || pr.soulwell;
    if (!usable) continue;
    const d = Math.hypot(pr.x - p.x, pr.y - p.y);
    const lim = pr.stairs ? 22 : 26;
    if (d < lim && d < bd) { bd = d; best = { kind: 'prop', pr }; }
  }
  return best;
}
function promptCore(t) {
  const p = G.p;
  if (t.kind === 'item') {
    const it = t.it;
    if (it.shop) return `Buy ${itemTitle(it)} · ${it.price}g`;
    if (it.type === 'weapon') return p.beast ? `Devour ${itemTitle(it)}` : p.weapons[1] ? `Swap for ${itemTitle(it)}` : `Take ${itemTitle(it)}`;
    if (it.type === 'ability') {
      const has = p.abilities.find((a) => a && a.id === it.id);
      return has ? (has.lvl >= 3 ? `${itemTitle(it)} is mastered (sell for gold)` : `Empower ${itemTitle(it)} to level ${has.lvl + 1}`) : `Learn ${itemTitle(it)}`;
    }
    return `Take ${itemTitle(it)}`;
  }
  const pr = t.pr;
  if (pr.chest) return pr.chest === 'silver' && !pr.unlocked ? 'Unlock chest (1 key)' : 'Open chest';
  if (pr.shrine) return { blood: 'Bleed at the Blood Shrine', gold: `Offer ${shrineCost()}g at the Gold Shrine`, arcane: 'Pray at the Arcane Shrine', chaos: 'Spin the Chaos Shrine' }[pr.shrine];
  if (pr.fountain) return 'Drink from the fountain';
  if (pr.forge) return 'Use the forge';
  if (pr.challenge) return 'Ring the challenge bell';
  if (pr.relicChoice) return 'Claim a relic';
  if (pr.stairs) return pr.final ? 'Climb out of the deep' : 'Descend';
  if (pr.soulwell) return G.run.souls > 0 ? `Offer ${G.run.souls} souls to the Molecule` : 'Commune with the Molecule';
  if (pr.npc === 'merchant') return 'Talk to the merchant';
  if (pr.npc === 'smith') return 'Use the forge';
  return 'Use';
}
const shrineCost = () => Math.round((40 + G.fl.idx * 12) * G.p.stats.shopMul);
function interactCore(t) {
  const p = G.p;
  if (t.kind === 'item') return takeItem(t.it);
  const pr = t.pr;
  if (pr.chest) return openChest(pr);
  if (pr.soulwell) return soulWell(pr);
  if (pr.fountain) { pr.used = true; heal(p, p.maxHp); p.poisonT = p.burnT = 0; Sound.play('heal'); ring(pr.x, pr.y - 6, 30, '#9ad8f8', 0.6); toast('Fully restored'); return; }
  if (pr.shrine === 'blood') {
    UI.confirm('Blood Shrine', 'Give up 15% of your max health for good to learn a rare or epic skill of your choice.', 'Bleed', () => {
      pr.used = true;
      p.maxHpPenalty = (p.maxHpPenalty || 0) + 0.15;
      recalcStats(p);
      Sound.play('hurt', { p: 0.7 }); burst(pr.x, pr.y - 10, 20, ['#e2434f', '#a8202a'], { smax: 90 });
      offerSkills(['rare', 'epic'], 'The shrine drinks. Choose a gift.');
    });
    return;
  }
  if (pr.shrine === 'gold') {
    const cost = shrineCost();
    if (p.gold < cost) { toast(`The shrine wants ${cost} gold`); Sound.play('deny'); return; }
    p.gold -= cost; pr.used = true; Sound.play('buy');
    p.pendingLevels++;
    toast('The shrine grants a lesson');
    return;
  }
  if (pr.shrine === 'chaos') return chaosShrine(pr);
  if (pr.shrine === 'arcane') {
    pr.used = true; Sound.play('magic');
    const owned = p.abilities.filter((a) => a && a.lvl < 3);
    if (owned.length && Math.random() < 0.6) { const a = rndPick(owned); a.lvl++; toast(`${ABILITY[a.id].name} grows stronger (level ${a.lvl})`, '#b98cff'); }
    else spawnItem({ type: 'ability', id: rndPick(abilityPool()) }, pr.x, pr.y + 16);
    return;
  }
  if (pr.forge || pr.npc === 'smith') return UI.forge();
  if (pr.npc === 'merchant') { toast(rndPick(['"Everything here came off the dead. Mostly."', '"Keys are cheap. Locks are not."', '"The King below never pays his tab."'])); return; }
  if (pr.challenge) {
    pr.used = true;
    const r = G.room;
    toast('The bell tolls. Survive.', '#ff6f9c'); Sound.play('roar', { p: 1.6, v: 0.5 });
    r.type = 'challenge'; r.cleared = false;
    if (!r.waves.length) planSpawns(G.fl, r, G.run.rng, G.run, doorEntries(G.fl, r));
    startCombat(r);
    return;
  }
  if (pr.relicChoice) { pr.used = true; return UI.relicChoice(); }
  if (pr.stairs) { if (pr.final && !G.run.endless) return UI.finalChoice(); return descend(); }
}
function takeItem(it) {
  const p = G.p;
  if (it.shop) {
    if (p.gold < it.price) { toast(`Not enough gold (${it.price}g)`); Sound.play('deny'); return; }
    p.gold -= it.price; Sound.play('buy');
    G.run.stats.spent += it.price;
  }
  const remove = () => { G.items = G.items.filter((x) => x !== it); };
  switch (it.type) {
    case 'weapon': {
      remove();
      if (p.beast) { devourWeapon(p, it.w); break; }
      if (!p.weapons[1]) { p.weapons[1] = it.w; p.wi = 1; }
      else { const old = p.weapon; p.weapons[p.wi] = it.w; spawnItem({ type: 'weapon', w: old }, p.x + (Math.random() < 0.5 ? -16 : 16), p.y + 6, { dropped: true }); }
      p.weapon = p.weapons[p.wi];
      recalcStats(p);
      Sound.play('pickup');
      toast(`${weaponName(it.w)} in hand`, RARITY[it.w.rar].color);
      CD.save.seen = CD.save.seen || {}; CD.save.seen[it.w.id] = 1;
      break;
    }
    case 'ability': {
      const has = p.abilities.find((a) => a && a.id === it.id);
      if (has) {
        remove();
        if (has.lvl >= 3) { p.gold += 30; toast('Mastered already. +30 gold', '#ffd35c'); }
        else { has.lvl++; toast(`${ABILITY[it.id].name} reaches level ${has.lvl}`, '#b98cff'); }
        Sound.play('magic');
      } else if (!p.abilities[1]) {
        remove(); p.abilities[1] = { id: it.id, lvl: 1, cd: 0, max: 1 }; Sound.play('magic'); toast(`Learned ${ABILITY[it.id].name}`, '#b98cff');
      } else {
        UI.replaceAbility(it, () => remove());
        if (it.shop) { p.gold += it.price; it.refund = true; }
      }
      break;
    }
    case 'relic': remove(); gainRelic(p, it.id); break;
    case 'potion': remove(); if (p.potions < p.stats.potMax) p.potions++; else heal(p, Math.round(p.maxHp * p.stats.potHeal)); Sound.play('pickup'); break;
    case 'key': remove(); p.keys++; Sound.play('pickup'); break;
    case 'heart': remove(); heal(p, Math.round(p.maxHp * 0.35)); Sound.play('heal'); break;
    case 'tome': remove(); p.pendingLevels++; Sound.play('levelup'); toast('A new skill to learn'); break;
  }
}
function gainRelic(p, id) {
  if (!id || p.relics.includes(id)) return;
  p.relics.push(id);
  const R = RELIC[id];
  if (R.now) R.now(p);
  recalcStats(p);
  Sound.play('levelup');
  banner(R.name, R.desc, 2.6);
  CD.save.seen = CD.save.seen || {}; CD.save.seen['r:' + id] = 1;
}
function burnRelic(id) {
  const p = G.p;
  p.relics = p.relics.filter((r) => r !== id);
  recalcStats(p);
}

/* ---------- level-up offers ---------- */
function skillChoices(rarities, n = 3) {
  const p = G.p;
  const ranged = WEAPON[p.weapon.id].kind === 'ranged' || (p.weapons[1] && WEAPON[p.weapons[1].id].kind === 'ranged');
  const melee = WEAPON[p.weapon.id].kind === 'melee' || (p.weapons[1] && WEAPON[p.weapons[1].id].kind === 'melee');
  let pool = SKILLS.filter((s) => (p.skills[s.id] || 0) < s.max && (!s.need || (s.need === 'ranged' ? ranged : melee)));
  if (rarities) { const f = pool.filter((s) => rarities.includes(s.rar)); if (f.length >= n) pool = f; }
  const luck = p.stats.luck;
  const out = [];
  const R = G.run.rng;
  while (out.length < n && pool.length) {
    const pick = R.weighted(pool, (s) => SKILL_W[s.rar] * (s.rar !== 'common' ? 1 + luck * 0.2 : 1) * ((p.skills[s.id] || 0) > 0 ? 1.4 : 1));
    out.push(pick);
    pool = pool.filter((s) => s !== pick);
  }
  return out;
}
function learnSkill(id) {
  const p = G.p, sk = SKILL[id];
  p.skills[id] = (p.skills[id] || 0) + 1;
  recalcStats(p);
  if (sk.now) sk.now(p);
  Sound.play('pickup', { p: 1.3 });
}
function offerSkills(rarities, title) { UI.levelUp(rarities, title); }

/* ---------- runs and floors ---------- */
function newRunState(o) {
  const seed = o.seed != null ? hashStr(String(o.seed)) : (Math.random() * 4294967295) >>> 0;
  return {
    seed, seedText: o.seed != null ? String(o.seed) : seed.toString(36).toUpperCase(), heat: o.heat || 0, cls: o.cls, sheetId: o.sheetId || null,
    floorIdx: 0, endless: false, t: 0, embers: 0, won: false, daily: !!o.daily, chaos: !!o.chaos,
    rng: new RNG(seed ^ 0x5bd1e995), kinds: {},
    stats: { kills: 0, dmgDealt: 0, dmgTaken: 0, gold: 0, spent: 0, rooms: 0, cleared: 0, bosses: 0, dashes: 0, abilities: 0 },
  };
}
function startRun(o) {
  Sound.init();
  UI.clear();
  G.demo = false;
  const run = (G.run = newRunState(o));
  G.items = [];
  const sheet = o.sheetId ? (CD.save.sheets || []).find((s) => s.id === o.sheetId) : null;
  G.fl = { idx: 0, info: floorInfo(0), actIdx: 0 }; // so the hero's numbers can read the floor
  G.p = makePlayer(o.cls, { sheet: sheet ? loadSheet(sheet) : null });
  if (run.heat >= 9) recalcStats(G.p);
  G.p.hp = G.p.maxHp;
  CD.save.stats.runs = (CD.save.stats.runs || 0) + 1;
  persist();
  goFloor(0, true);
  runHooks('runStart', run, G.p);
  if (CD.save.stats.runs <= 2) {
    const L = (a) => keyLabel(a) || '?';
    const tips = Input.device === 'touch'
      ? [CD.save.controls && CD.save.controls.floatL ? 'Touch anywhere on the left to move. Hold the right stick to attack.' : 'Left stick moves. Hold the big right stick to attack.', 'DASH makes you untouchable for a moment.', 'Rooms seal until every monster falls. Move your buttons in Controls.']
      : Input.device === 'pad'
        ? [`Left stick moves, right stick aims, ${L('attack')} attacks.`, `${L('dash')} dashes through danger. ${L('ab1')} and ${L('ab2')} cast abilities.`, `Rooms seal until every monster falls. ${L('use')} picks things up.`]
        : [`${L('up')}${L('left')}${L('down')}${L('right')} to move, mouse to aim, click to attack.`, `${L('dash')} dashes through danger. ${L('ab1')} and ${L('ab2')} cast abilities.`, `Rooms seal until every monster falls. ${L('use')} picks things up.`];
    tips.forEach((t, i) => later(2.8 + i * 3, () => toast(t)));
  }
}
function goFloor(idx, first) {
  const run = G.run, p = G.p;
  run.floorIdx = idx;
  runHooks('preFloor', run, idx);
  G.fl = generateFloor(run, idx);
  G.ents = []; G.projs = []; G.fx = []; G.parts = []; G.texts = []; G.picks = []; G.items = []; G.timers = [];
  G.room = null; G.combat = false; G.boss = null; G.flow = null; G.warp = 0;
  $('bossbar').hidden = true;
  const s = G.fl.rooms[0];
  p.x = (s.ix + s.iw / 2) * TS; p.y = (s.iy + s.ih / 2 + 2) * TS; p.vx = p.vy = 0;
  p.angelUsed = false; p.dead = false; p.dashT = p.leapT = p.bashT = 0; p.whirlT = 0; p.swing = null;
  p.dashCharges = p.stats.dashMax;
  if (CD.save.meta.map) for (const r of G.fl.rooms) if (r.type !== 'combat' && r.type !== 'elite' && ((r.type !== 'secret' && r.type !== 'dmt') || CD.save.meta.sense)) r.seen = true;
  invalidateRoomCache();
  snapCamera();
  onRoomChange(s);
  const info = G.fl.info;
  banner(info.sub === 0 ? info.act.name : floorLabel(idx), info.sub === 0 ? `Floor ${idx + 1}` : info.isBoss ? 'something stirs below' : `Floor ${idx + 1}`, 2.6);
  Music.set(G.fl.actIdx, 0);
  if (G.mode !== 'play') setMode('play');
  saveCheckpoint();
  if (!(typeof W !== 'undefined' && W.on)) CD.save.stats.bestFloor = Math.max(CD.save.stats.bestFloor || 0, idx + 1);
  runHooks('onFloor', idx);
}
function descend() {
  const run = G.run;
  Sound.play('stairs');
  if (run.won && !run.endless) { endRun(true); return; }
  fadeTransition(() => goFloor(run.floorIdx + 1));
}
function endRun(won) {
  const run = G.run, p = G.p, save = CD.save;
  if (!run || run.ended) return;
  run.ended = true;
  const floors = run.floorIdx + (won ? 1 : 0);
  const bonus = floors * 3 + run.stats.bosses * 8 + (won ? 40 : 0);
  const heatMul = 1 + run.heat * 0.1;
  const chaosMul = run.chaos ? 0.75 * (1 + 0.1 * (CD.save.meta.chaos || 0)) : 1;
  const total = Math.round((run.embers + bonus) * heatMul * chaosMul * (p ? p.stats.emberMul : 1));
  run.emberTotal = total;
  save.embers = (save.embers || 0) + total;
  save.stats.embersEarned = (save.stats.embersEarned || 0) + total;
  save.stats.kills = (save.stats.kills || 0) + run.stats.kills;
  save.stats.deaths = (save.stats.deaths || 0) + (won ? 0 : 1);
  if (won) {
    save.stats.wins = (save.stats.wins || 0) + 1;
    save.heatUnlocked = Math.max(save.heatUnlocked || 0, Math.min(MAX_HEAT, run.heat + 1));
    save.wonWith = save.wonWith || {}; save.wonWith[run.cls] = Math.max(save.wonWith[run.cls] || 0, run.heat + 1);
  }
  save.stats.bestFloor = Math.max(save.stats.bestFloor || 0, run.floorIdx + 1);
  runHooks('runEnd', run, won);
  save.history = [{ cls: run.cls, form: p && p.form ? p.form : null, chaos: !!run.chaos, floor: run.floorIdx + 1, won, heat: run.heat, kills: run.stats.kills, time: Math.round(run.t), embers: total, level: p ? p.level : 1, date: Date.now() }, ...(save.history || [])].slice(0, 12);
  save.run = null;
  persist();
  Music.set(-1, 0);
  UI.runSummary(won);
}

