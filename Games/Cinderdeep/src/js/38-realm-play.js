/* ============================================================
   Cinderdeep — playing in the Realm: one zone loaded at a time,
   monsters that camp, wander, chase and give up, world bosses in
   their lairs, roads between towns, travel at the zone edges and
   by waystone, death and respawn, and the old dungeons entered
   as instances. Your realm character is saved as you go.
   ============================================================ */
const W = {
  on: false, Z: null, ch: null, t: 0, inInst: false, inst: null, camps: new Map(), npcs: [], say: null, spawnLvl: 0,
  saveT: 0, streamT: 0, discT: 0, aggroN: 0, lastZone: null, cache: new Map(), notice: null, travelling: false,
};
const DAY_LEN = 720;
const realmTime = () => (W.t % DAY_LEN) / DAY_LEN; // 0 = midnight, 0.5 = noon
function daylight() { const t = realmTime(); return clamp(0.5 - 0.5 * Math.cos(t * TAU), 0, 1); }

/* ---------- the realm save ---------- */
function realmStore() {
  const s = CD.save;
  if (!s.realm || typeof s.realm !== 'object') s.realm = { v: 1, chars: [], last: 0, t: 300 };
  if (!Array.isArray(s.realm.chars)) s.realm.chars = [];
  return s.realm;
}
function newRealmChar(cls, sheetId) {
  return { id: 'c' + Date.now().toString(36) + ((Math.random() * 1e4) | 0).toString(36), cls, sheetId: sheetId || null, created: Date.now(), play: 0, zone: 'meadows', x: null, y: null,
    home: null, snap: null, ways: [], disc: {}, quests: [], qdone: 0, chests: {}, bosses: {}, stash: [], kills: {}, marks: [], mount: false, dye: null, insts: 0, deaths: 0 };
}
function snapPlayer(p, run) {
  const c = {
    cls: p.cls, p: {
      level: p.level, xp: p.xp, gold: p.gold, keys: p.keys, potions: p.potions, hp: Math.max(1, Math.round(p.hp)), weapons: p.weapons.map((w) => w && { ...w, affixes: [...(w.affixes || [])] }), wi: p.wi,
      abilities: p.abilities.map((a) => a && { id: a.id, lvl: a.lvl }), skills: { ...p.skills }, relics: [...p.relics], rerolls: p.rerolls, reviveLeft: p.reviveLeft,
      phoenixUsed: !!p.phoenixUsed, maxHpPenalty: p.maxHpPenalty || 0, pendingLevels: p.pendingLevels || 0,
      bless: p.bless || null, blessT: Math.round(p.blessT || 0), restedT: Math.round(p.restedT || 0), weakT: Math.round(p.weakT || 0),
    },
  };
  runHooks('saveRun', c, run, p);
  return JSON.parse(JSON.stringify(c));
}
function restorePlayer(ch, run) {
  const sheetRec = ch.sheetId ? (CD.save.sheets || []).find((s) => s.id === ch.sheetId) : null;
  const prevP = G.p;
  const p = makePlayer(ch.cls, { sheet: sheetRec ? loadSheet(sheetRec) : null });
  const c = ch.snap;
  if (c && c.p) {
    const q = c.p;
    Object.assign(p, { level: q.level, xp: q.xp, gold: q.gold, keys: q.keys, potions: q.potions, wi: q.wi || 0, skills: { ...q.skills }, relics: [...(q.relics || [])], rerolls: q.rerolls || 0, reviveLeft: q.reviveLeft || 0, phoenixUsed: !!q.phoenixUsed, maxHpPenalty: q.maxHpPenalty || 0, pendingLevels: q.pendingLevels || 0,
      bless: q.bless || null, blessT: q.blessT || 0, restedT: q.restedT || 0, weakT: q.weakT || 0 });
    p.weapons = (q.weapons || []).map((w) => w && { ...w, affixes: [...(w.affixes || [])] });
    if (!p.weapons.length || !p.weapons[0]) p.weapons = [makeWeapon(CLASS[ch.cls].weapon, CLASS[ch.cls].beast ? 'natural' : 'common', null)];
    if (!p.weapons[p.wi]) p.wi = 0;
    p.weapon = p.weapons[p.wi];
    p.abilities = (q.abilities || [null, null]).map((a) => a && ABILITY[a.id] ? { id: a.id, lvl: a.lvl, cd: 0, max: 1 } : null);
    while (p.abilities.length < 2) p.abilities.push(null);
    G.p = p; // load hooks look at the hero being loaded
    runHooks('loadRun', c, run, p);
    G.p = prevP;
  }
  if (ch.dye) applyDye(p, ch.dye);
  recalcStats(p);
  p.hp = c && c.p ? Math.min(p.maxHp, c.p.hp) : p.maxHp;
  if (p.hp <= 0) p.hp = p.maxHp;
  p.potions = Math.max(p.potions, 0);
  return p;
}
function applyDye(p, dye) {
  if (!dye || p.beast) return;
  p.look = { ...CLASS[p.cls].look, ...dye };
  p.dyeKey = Object.values(dye).join('');
}
function saveRealm(now) {
  if (!W.on || !W.ch || !G.p) return;
  const ch = W.ch;
  ch.snap = snapPlayer(G.p, G.run);
  if (!W.inInst && W.Z) { ch.zone = W.Z.id; ch.x = Math.round(G.p.x); ch.y = Math.round(G.p.y); }
  ch.disc = ch.disc || {};
  if (W.Z && W.disc) ch.disc[W.Z.id] = discEncode(W.disc);
  ch.play = Math.round((ch.play || 0) + (W.playAcc || 0)); W.playAcc = 0;
  realmStore().t = Math.round(W.t);
  persist(now);
}
// fog of war: one cell per 16 tiles
const DISC_N = ZT / 16;
function discEncode(a) { let s = ''; for (let i = 0; i < a.length; i += 8) { let b = 0; for (let k = 0; k < 8; k++) if (a[i + k]) b |= 1 << k; s += String.fromCharCode(b); } return btoa(s); }
function discDecode(str) { const a = new Uint8Array(DISC_N * DISC_N); if (!str) return a; try { const s = atob(str); for (let i = 0; i < s.length; i++) { const b = s.charCodeAt(i); for (let k = 0; k < 8; k++) if (b & (1 << k)) a[i * 8 + k] = 1; } } catch (e) { /* fresh */ } return a; }

/* ---------- entering and leaving the realm ---------- */
function enterRealm(idx) {
  const store = realmStore(), ch = store.chars[idx];
  if (!ch) return;
  store.last = idx;
  Sound.init();
  UI.clear();
  G.demo = false;
  W.on = true; W.ch = ch; W.inInst = false; W.inst = null; W.t = store.t || 300; W.playAcc = 0;
  const run = (G.run = newRunState({ cls: ch.cls, seed: 'realm', sheetId: ch.sheetId }));
  G.fl = { idx: 0, info: floorInfo(0), actIdx: 0 };
  run.realm = true; run.souls = 0; run.soulsBanked = 0; run.nemSeen = [];
  G.p = restorePlayer(ch, run);
  if (!ch.snap) { G.p.potions = G.p.stats.potMax; G.p.gold = Math.max(G.p.gold, 30); runHooks('runStart', run, G.p); }
  else { G.combo = { n: 0, t: 0, max: 0 }; run.t0 = Date.now(); run.nemSeen = run.nemSeen || []; }
  let zone = ch.zone || 'meadows', zx = ch.x, zy = ch.y;
  if (ch.dead) { const hm = ch.home || { zone: 'meadows', x: null, y: null }; zone = hm.zone; zx = hm.x; zy = hm.y; ch.dead = false; G.p.hp = G.p.maxHp; }
  realmFade(() => {
    loadZone(zone, zx, zy, true);
    if (!ch.snap) {
      later(1.4, () => { banner('Welcome to the Realm', 'Emberhold, capital of the Verdant Meadows', 3.2); });
      later(4.5, () => toast('Talk to people in town. The Quartermaster has work for you.', '#ffd35c'));
      later(8, () => toast('Waystones let you travel. Roads lead to every town.', '#7fe8ff'));
    }
    saveRealm(true);
  });
}
// a fade that waits its turn instead of being dropped when another is running
function realmFade(fn) { if (typeof fading !== 'undefined' && fading) { setTimeout(() => realmFade(fn), 120); return; } fadeTransition(fn); }
function leaveRealm(toTitle = true) {
  saveRealm(true);
  W.on = false; W.Z = null; W.inInst = false; W.inst = null; W.ch = null; W.cache.clear(); W.horde = null;
  W.blocks && W.blocks.clear();
  G.boss = null; $('bossbar').hidden = true;
  Music.set(-1, 0);
  if (typeof mmoLeave === 'function') mmoLeave();
  if (G.run) { G.run.omens = []; } clearOmenGlobals();
  if (toTitle) UI.title();
}
// the cloud brought a newer save: keep playing the same hero inside it
function realmRebind(oldSave) {
  if (!W.on || !W.ch) return;
  const id = W.ch.id, chars = realmStore().chars, i = chars.findIndex((c) => c.id === id);
  if (i >= 0) { W.ch = chars[i]; saveRealm(); } else { chars.push(W.ch); saveRealm(); }
}

/* ---------- a zone becomes the world ---------- */
function zoneObj(id) {
  if (W.cache.has(id)) { const Z = W.cache.get(id); W.cache.delete(id); W.cache.set(id, Z); return Z; }
  const Z = newZone(BIOME[id]);
  // chests and lair stones belong to the plan
  for (const c of Z.chests) addObj(Z, { kind: 'chest', chest: c, x: (c.x + 0.5) * TS, y: (c.y + 0.5) * TS });
  W.cache.set(id, Z);
  while (W.cache.size > 2) W.cache.delete(W.cache.keys().next().value);
  return Z;
}
function zoneRoom() { return { id: 0, type: 'world', x: 0, y: 0, w: 72, h: 56, ix: 0, iy: 0, iw: 28, ih: 18, cx: 0, cy: 0, cw: 1, ch: 1, props: [], doors: [], waves: [], cleared: true, visited: true, seen: true }; }
function loadZone(id, px, py, first) {
  const Z = zoneObj(id), b = Z.b;
  W.Z = Z; W.lastZone = id;
  const act = b.act || 0;
  const room = zoneRoom();
  G.fl = { W: ZT, H: ZT, tiles: Z.tiles, doors: [], rooms: [room], props: [], lights: [], idx: worldIdx(G.p ? G.p.level : 1), info: { actIdx: act, act: ACTS[act], sub: 0, loop: 0, isBoss: false, realm: true }, actIdx: act, realm: true, zone: Z, doorAt: new Int8Array(1).fill(-1) };
  G.room = room;
  G.ents = []; G.projs = []; G.fx = []; G.parts = []; G.texts = []; G.picks = []; G.items = []; G.timers = [];
  G.boss = null; G.combat = false; G.flow = null; G.warp = 0;
  $('bossbar').hidden = true;
  if (G.run && G.run.omens && G.run.omens.length) { G.run.omens = []; clearOmenGlobals(); if (G.p) recalcStats(G.p); }
  W.camps = new Map(); W.bossE = null; W.say = null; W.horde = null;
  W.npcs = Z.npcs.map((n) => ({ ...n, r: 4, face: 1, view: 'front', anim: 0, moving: false, t: Math.random() * 5, tx: n.x, ty: n.y }));
  W.disc = discDecode(W.ch && W.ch.disc ? W.ch.disc[id] : null);
  if (W.blocks) W.blocks.clear();
  const p = G.p;
  // where to stand
  let x = px, y = py;
  if (x == null || y == null) { const cap = Z.towns.find((s) => s.kind === 'capital') || Z.towns.find((s) => s.kind === 'town') || Z.towns[0]; x = (cap.x + 0.5) * TS; y = (cap.y + cap.plazaR + 2.5) * TS; }
  ensureChunks(Z, x, y, 1);
  const spot = realmFreeSpot(x, y);
  p.x = spot.x; p.y = spot.y; p.vx = p.vy = 0; p.dead = false; p.dashT = p.leapT = p.bashT = 0; p.whirlT = 0; p.swing = null;
  moveRoomWindow();
  snapCamera();
  invalidateRoomCache();
  if (G.mode !== 'play') setMode('play');
  realmMusic(true);
  if (!first || W.ch.snap) banner(b.name, `Level ${b.lvl[0]}–${b.lvl[1]}`, 2.6);
  // first visit
  W.ch.seenZones = W.ch.seenZones || [];
  if (!W.ch.seenZones.includes(id)) { W.ch.seenZones.push(id); if (W.ch.seenZones.length > 1) later(1.2, () => toast(`Discovered ${b.name}`, '#ffd35c')); const F = CD.save.fs; F.zones = Math.max(F.zones || 0, W.ch.seenZones.length); }
  streamZone(true);
  runHooks('realmZone', Z);
  // messages that waited for the new place to appear
  const after = W.afterLoad || []; W.afterLoad = [];
  if (W.notice) { const n = W.notice; W.notice = null; after.push(() => toast(n, '#ff8a8a')); }
  after.forEach((fn, i) => later(1 + i * 0.4, fn));
}
function realmFreeSpot(x, y) {
  const fl = G.fl;
  const ok = (px, py) => !hitsWall(fl, px, py, 6, false) && tileAt(fl, Math.floor(px / TS), Math.floor(py / TS)) !== TILE.SHALLOW;
  if (ok(x, y)) return { x, y };
  for (let r = 1; r < 30; r++) for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU, px = x + Math.cos(a) * r * TS, py = y + Math.sin(a) * r * TS; if (px > 40 && py > 40 && px < ZT * TS - 40 && py < ZT * TS - 40 && ok(px, py)) return { x: px, y: py }; }
  return { x, y };
}
HOOKS.realmZone = [];
// the pseudo-room follows you: path-finding and random spots stay local
function moveRoomWindow() {
  const r = G.room, p = G.p;
  if (!r || r.type !== 'world') return;
  const tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS);
  r.x = clamp(tx - 36, 0, ZT - r.w); r.y = clamp(ty - 28, 0, ZT - r.h);
  r.ix = clamp(tx - 14, 1, ZT - r.iw - 1); r.iy = clamp(ty - 9, 1, ZT - r.ih - 1);
}
function realmMusic(force) {
  if (!W.Z) return;
  const b = W.Z.b, inTown = W.Z.towns.some((s) => Math.hypot(G.p.x / TS - s.x, G.p.y / TS - s.y) < s.r + 4);
  const key = G.boss && G.boss.world ? 'boss' : inTown ? (W.Z.towns.find((s) => s.kind === 'capital' && Math.hypot(G.p.x / TS - s.x, G.p.y / TS - s.y) < s.r + 4) ? 'w_capital' : 'w_town') : b.song;
  const night = daylight() < 0.2 && !inTown && SONGS.w_night && !G.combat;
  const want = key === 'boss' ? 'boss' : night && b.id !== 'voidscar' ? 'w_night' : SONGS[key] ? key : 'w_meadow';
  if (want === 'boss') { if (Music.songKey !== 'boss' || force) Music.set(b.act || 0, 2); }
  else if (Music.songKey !== want || force) { Music.intensity = G.combat ? 1 : 0; Music.play(want); Music.setAmb((SONGS[want] && SONGS[want].amb) || ''); }
  Music.intensity = G.combat ? 1 : 0;
}

/* ---------- the realm loop ---------- */
function updateRealm(dt) {
  const p = G.p;
  G.t += dt; G.run.t += dt; W.t += dt; W.playAcc = (W.playAcc || 0) + dt;
  if (G.warp > 0) G.warp -= dt;
  if (G.hurtFlash > 0) G.hurtFlash -= dt;
  G.fl.idx = worldIdx(p.level);
  updateTimers(dt);
  updatePlayer(dt);
  realmMove(dt);
  moveRoomWindow();
  updateFlow(false);
  streamZone(false, dt);
  const sleepers = mobsBeforeAI(dt);
  updateEnemies(dt);
  for (const e of sleepers) if (!e.dead) e.room = 0;
  for (const e of G.ents) if (!e.dead && e.dorm) e.room = -3;
  updateNpcs(dt);
  updateProjs(dt);
  updateFx(dt);
  updateParts(dt);
  updatePickups(dt);
  runHooks('update', dt);
  updateCamera(dt);
  const A = Input.act;
  if (A.use && !p.dead) interact();
  if (p.pendingLevels > 0 && !G.combat && !p.dead && !UI.top()) UI.levelUp();
  realmEdges();
  W.discT -= dt;
  if (W.discT <= 0) { W.discT = 0.4; discover(); realmMusic(false); }
  W.saveT -= dt;
  if (W.saveT <= 0) { W.saveT = 20; saveRealm(); }
}
// out of a fight you travel faster; mounts are faster still; shallow water slows
const _updatePlayerRealm = updatePlayer;
updatePlayer = function (dt) {
  _updatePlayerRealm(dt);
  const p = G.p;
  if (!W.on || W.inInst || !p || p.dead || !p.realmSpd || p.realmSpd === 1) return;
  if (p.dashT > 0 || p.leapT > 0 || p.bashT > 0) return;
  const A = Input.act, k = p.realmSpd;
  if (Math.hypot(A.mx, A.my) > 0.1) moveEnt(p, A.mx * p.stats.spd * (k - 1) * dt, A.my * p.stats.spd * (k - 1) * dt);
};
function realmMove(dt) {
  const p = G.p;
  const t = tileAt(G.fl, Math.floor(p.x / TS), Math.floor(p.y / TS));
  let k = 1;
  if (!G.combat && !p.dead) k = W.ch && W.ch.mount ? 1.65 : 1.3;
  if (t === TILE.SHALLOW) k *= 0.65;
  p.realmSpd = k;
  p.mounted = !!(W.ch && W.ch.mount && !G.combat && !p.dead);
};

/* ---------- camps: monsters appear near you and fade far away ---------- */
function streamZone(force, dt = 0) {
  const Z = W.Z, p = G.p;
  // terrain ahead of you
  ensureChunks(Z, p.x + p.vx * 1.5, p.y + p.vy * 1.5, 1, force ? 99 : 1);
  W.streamT -= dt;
  if (!force && W.streamT > 0) return;
  W.streamT = 0.5;
  const ptx = p.x / TS, pty = p.y / TS, now = W.t;
  for (const c of Z.camps) {
    const d = Math.hypot(c.x - ptx, c.y - pty);
    let st = W.camps.get(c.id);
    if (d < 54) {
      if (!st) { st = { ents: [], until: 0 }; W.camps.set(c.id, st); }
      if (!st.ents.length && now >= st.until) spawnCamp(c, st);
    } else if (st && d > 80) {
      if (st.ents.some((e) => !e.dead && e.aggro)) continue;
      for (const e of st.ents) if (!e.dead) { e.dead = true; e.despawn = true; }
      st.ents = [];
    }
  }
  updateHordes(now);
  G.ents = G.ents.filter((e) => !e.dead || !e.despawn);
  // the lair boss
  const L = Z.lair;
  if (L && L.boss && !W.bossE) {
    const d = Math.hypot(L.x - ptx, L.y - pty), killed = W.ch.bosses && W.ch.bosses[Z.id];
    if (d < 40 && (!killed || Date.now() - killed > 10 * 60 * 1000)) spawnWorldBoss(Z);
  } else if (W.bossE && (W.bossE.dead || Math.hypot(W.bossE.x / TS - ptx, W.bossE.y / TS - pty) > 90)) { if (!W.bossE.dead) W.bossE.dead = true, W.bossE.despawn = true; if (G.boss === W.bossE) { G.boss = null; $('bossbar').hidden = true; realmMusic(true); } W.bossE = null; }
  // loose loot far behind you rots away
  G.items = G.items.filter((it) => Math.hypot(it.x - p.x, it.y - p.y) < 1400);
  G.picks = G.picks.filter((k) => Math.hypot(k.x - p.x, k.y - p.y) < 1000);
}
/* ---------- hordes: out on the roads and in the wilds, packs come for you, with quiet breaks between ---------- */
function inSettlement(tx, ty) { return W.Z.towns.some((s) => Math.hypot(s.x - tx, s.y - ty) < s.r + 18); }
function updateHordes(now) {
  const p = G.p, Z = W.Z, H = W.horde || (W.horde = { next: now + 14, ents: [], n: 0, packs: {} });
  H.ents = H.ents.filter((e) => !e.dead);
  // stragglers that gave up or fell far behind go home
  for (const e of H.ents) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d > 95 * TS || (!e.aggro && d > 32 * TS)) { e.dead = true; e.despawn = true; } }
  H.ents = H.ents.filter((e) => !e.dead);
  // a broken horde pays out
  for (const id in H.packs) {
    const pk = H.packs[id];
    if (H.ents.some((e) => e.hordeId === +id)) continue;
    delete H.packs[id];
    if (pk.kills >= Math.max(3, Math.ceil(pk.size * 0.7)) && !p.dead) hordeReward(pk);
  }
  const ptx = p.x / TS, pty = p.y / TS;
  if (p.dead || W.inInst || inSettlement(ptx, pty) || (G.boss && G.boss.awake && !G.boss.dead)) { H.next = Math.max(H.next, now + 10); return; }
  // a pack is still on you: the break starts once it is gone
  if (H.ents.filter((e) => e.aggro).length >= 3) { H.next = now + 22 + Math.random() * 26; return; }
  if (now < H.next) return;
  // ahead of you if you are travelling, anywhere around you if not
  const mv = Math.hypot(p.vx, p.vy), dir = mv > 20 ? Math.atan2(p.vy, p.vx) + rnd(-0.6, 0.6) : rnd(TAU);
  const dist = rnd(20, 27);
  let cx = ptx + Math.cos(dir) * dist, cy = pty + Math.sin(dir) * dist;
  cx = clamp(cx, 8, ZT - 8); cy = clamp(cy, 8, ZT - 8);
  ensureChunks(Z, cx * TS, cy * TS, 1);
  const unsafe = inSettlement(cx, cy) || (Z.mask[Math.floor(cy) * ZT + Math.floor(cx)] & MK.NOSPAWN) || Math.hypot(Z.lair.x - cx, Z.lair.y - cy) < 45 || Math.hypot(Z.dungeon.x - cx, Z.dungeon.y - cy) < 16;
  if (unsafe) { H.next = now + 6; return; }
  // what lives here, at the strength of the nearest camp
  let near = null, nd = 1e9;
  for (const c of Z.camps) { const d = Math.hypot(c.x - cx, c.y - cy); if (d < nd) { nd = d; near = c; } }
  const b = Z.b, base = near ? near.lvl : b.lvl[0], lvl = clamp(Math.round(lerp(base, p.level, 0.35)), b.lvl[0], b.lvl[1] + 2);
  H.n++;
  const size = Math.min(16, 6 + Math.floor(Math.random() * 5) + Math.floor(H.n / 4));
  const kinds = b.mobs.slice().sort(() => Math.random() - 0.5).slice(0, 2 + (Math.random() < 0.4 ? 1 : 0));
  let made = 0;
  for (let i = 0; i < size; i++) {
    const a = rnd(TAU), r = rnd(0, 5) * TS, kind = kinds[i % kinds.length];
    const q = realmFreeSpotNear(cx * TS + Math.cos(a) * r, cy * TS + Math.sin(a) * r);
    const e = spawnWorldMob(kind, q.x, q.y, Math.max(1, lvl + (Math.random() < 0.2 ? 1 : 0)), { elite: i === 0 && Math.random() < 0.45 });
    if (!e) continue;
    e.horde = true; e.hordeId = H.n; e.home = null; e.leash = 1e9; e.lostT = 0;
    e.aggro = true; e.dorm = false; e.evade = 0;
    H.ents.push(e); made++;
  }
  if (made) {
    H.packs[H.n] = { size: made, kills: 0, lvl, x: cx * TS, y: cy * TS };
    toast(made >= 10 ? 'A horde is coming!' : 'A pack has caught your scent', '#ff8a5a');
    Sound.play('roar', { v: 0.5 });
    if (typeof shake === 'function') shake(3, 0.3);
  }
  H.next = now + 30;
}
function hordeReward(pk) {
  const p = G.p, xp = Math.round(xpToNext(Math.min(p.level, pk.lvl + 2)) * (0.08 + pk.size * 0.012)), gold = Math.round((12 + pk.lvl * 3) * (0.6 + pk.size * 0.1));
  gainXP(xp);
  dropPickup('gold', pk.x, pk.y, gold);
  if (pk.size >= 8 || Math.random() < 0.45) spawnItem(realmLoot(new RNG((Math.random() * 1e9) | 0), pk.lvl, pk.size >= 12 ? 'rare' : 'uncommon'), pk.x, pk.y);
  if (Math.random() < 0.35) dropPickup('potion', pk.x + 10, pk.y, 1);
  banner(pk.size >= 10 ? 'Horde broken' : 'Pack scattered', `+${xp} XP · spoils on the ground`, 2.2);
  Sound.play('levelup', { p: 1.4, v: 0.6 });
  W.ch.hordes = (W.ch.hordes || 0) + 1;
}
function spawnCamp(c, st) {
  const R = new RNG(hash2(W.Z.seed, c.id * 131 + Math.floor(W.t)));
  for (let i = 0; i < c.n; i++) {
    const a = R.next() * TAU, d = R.range(6, 26);
    const q = realmFreeSpotNear((c.x + 0.5) * TS + Math.cos(a) * d, (c.y + 0.5) * TS + Math.sin(a) * d);
    const lvl = Math.max(1, c.lvl + R.int(-1, 1));
    const e = spawnWorldMob(c.kind, q.x, q.y, lvl, { elite: c.elite && i === 0 });
    if (!e) continue;
    e.camp = c.id; e.home = { x: (c.x + 0.5) * TS, y: (c.y + 0.5) * TS };
    st.ents.push(e);
  }
}
function realmFreeSpotNear(x, y) {
  const fl = G.fl;
  if (!hitsWall(fl, x, y, 6, false)) return { x, y };
  for (let r = 1; r < 8; r++) for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU, px = x + Math.cos(a) * r * 10, py = y + Math.sin(a) * r * 10; if (!hitsWall(fl, px, py, 6, false)) return { x: px, y: py }; }
  return { x, y };
}
function spawnWorldMob(kind, x, y, lvl, o = {}) {
  const def = ENEMIES[kind];
  if (!def) return null;
  W.spawnLvl = lvl;
  let e = null;
  try { e = spawnEnemy(kind, x, y, { noSpawnAnim: !!o.quiet, room: 0, elite: o.elite || def.champion, mods: def.champion ? [rndPick(ELITE_MODS).id] : undefined }); } finally { W.spawnLvl = 0; }
  if (!e) return null;
  e.world = true; e.lvl = lvl; e.aggro = false; e.aggroR = def.range ? 150 : def.fly ? 120 : 105; e.leash = 520;
  e.xp = def.xp * worldXpMul(lvl); e.gold = def.gold * (1 + 0.15 * lvl);
  if (def.champion) { e.champion = true; e.aggroR = 130; e.maxHp *= 1.2; e.hp = e.maxHp; }
  e.wanderT = rnd(1, 4);
  return e;
}
const _scaleForRealm = scaleFor;
scaleFor = function (idx) {
  if (W.spawnLvl) return { hp: worldHpMul(W.spawnLvl), dmg: worldDmgMul(W.spawnLvl), spd: 1 };
  if (W.on && W.inInst && W.inst) return { hp: worldHpMul(W.inst.lvl) * 1.15, dmg: worldDmgMul(W.inst.lvl), spd: 1 };
  return _scaleForRealm(idx);
};
// before the brains run: far mobs sleep, near ones notice you
function mobsBeforeAI(dt) {
  const p = G.p, sleepers = [];
  let aggro = 0;
  for (const e of G.ents) {
    if (e.dead || e.type !== 'enemy' || !e.world || e.boss) continue;
    e.room = 0;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    e.dorm = d > 340 && !e.aggro;
    if (e.aggro && e.horde) {
      if (d > 300) { e.lostT = (e.lostT || 0) + dt; if (e.lostT > 8 && !lineOfSight(G.fl, e.x, e.y - 6, p.x, p.y - 6)) { e.aggro = false; e.evade = 0; } } else e.lostT = 0;
    }
    if (e.aggro) {
      const hd = e.home ? Math.hypot(e.x - e.home.x, e.y - e.home.y) : 0;
      if (p.dead || hd > e.leash || d > (e.horde ? 900 : 460)) { e.aggro = false; e.evade = 3; e.burn = null; e.poison = null; e.bleed = null; }
      else { aggro++; continue; }
    } else if (!p.dead && !e.evade && d < e.aggroR && e.spawnT <= 0 && (d < 60 || lineOfSight(G.fl, e.x, e.y - 6, p.x, p.y - 6))) {
      wakeMob(e);
      aggro++;
      continue;
    }
    // asleep, wandering or walking home
    e.room = -2; sleepers.push(e);
    e.anim += dt; if (e.flash > 0) e.flash -= dt; if (e.spawnT > 0) { e.spawnT -= dt; continue; }
    if (e.evade > 0) {
      e.evade -= dt;
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * dt * 0.5);
      if (e.home) { const a = Math.atan2(e.home.y - e.y, e.home.x - e.x); if (Math.hypot(e.home.x - e.x, e.home.y - e.y) > 10) walk(e, Math.cos(a), Math.sin(a), Math.max(50, e.spd * 1.6), dt); }
      if (e.evade <= 0) e.hp = e.maxHp;
      continue;
    }
    if (e.dorm || e.rooted) continue;
    e.wanderT -= dt;
    if (e.wanderT <= 0) { e.wanderT = rnd(2, 6); const a = rnd(TAU), r = rnd(0, 40); e.wx = (e.home ? e.home.x : e.x) + Math.cos(a) * r; e.wy = (e.home ? e.home.y : e.y) + Math.sin(a) * r; }
    if (e.wx != null && Math.hypot(e.wx - e.x, e.wy - e.y) > 4) { const a = Math.atan2(e.wy - e.y, e.wx - e.x); walk(e, Math.cos(a), Math.sin(a), Math.max(14, e.spd * 0.35), dt); e.pose = 0; }
    else { e.vx = e.vy = 0; }
  }
  W.aggroN = aggro + (G.boss && G.boss.awake && !G.boss.dead ? 1 : 0);
  G.combat = W.aggroN > 0;
  return sleepers;
}
function wakeMob(e) {
  if (e.aggro) return;
  e.aggro = true; e.evade = 0; e.dorm = false;
  addText(e.x, e.y - e.h * (e.scale || 1) - 8, '!', '#ff5a5a', 1);
  // the camp comes with it
  for (const o of G.ents) if (!o.dead && o.world && !o.aggro && o.camp === e.camp && o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 140) { o.aggro = true; o.evade = 0; o.dorm = false; }
}
hook('onHit', (e) => { if (W.on && e.world && !e.aggro) wakeMob(e); if (W.on && e.boss && e.world && !e.awake) wakeBoss(e); });
hook('onKill', (e) => {
  if (!W.on || W.inInst || !e.world || e.summoned) return;
  const p = G.p;
  // grey monsters give little
  const diff = p.level - (e.lvl || 1);
  if (diff > 6) e.xp *= 0.15; else if (diff > 3) e.xp *= 0.5; else if (diff < -3) e.xp *= 1.25;
  if (e.camp != null) { const st = W.camps.get(e.camp); if (st) { st.ents = st.ents.filter((x) => x !== e && !x.dead); if (!st.ents.length) st.until = W.t + 150 + Math.random() * 120; } }
  if (W.ch) { W.ch.kills = W.ch.kills || {}; W.ch.kills[e.kind] = (W.ch.kills[e.kind] || 0) + 1; }
  if (e.horde && W.horde && W.horde.packs && W.horde.packs[e.hordeId]) { const pk = W.horde.packs[e.hordeId]; pk.kills++; pk.x = e.x; pk.y = e.y; }
  // loot
  const L = e.lvl || 1, R = new RNG((Math.random() * 1e9) | 0);
  const chance = e.champion ? 1 : e.eliteMods ? 0.4 : 0.035;
  if (Math.random() < chance) spawnItem(realmLoot(R, L, e.champion ? 'rare' : e.eliteMods ? 'uncommon' : 'common'), e.x, e.y);
  if (Math.random() < 0.025) dropPickup('potion', e.x, e.y, 1);
  if (e.champion) { dropPickup('ember', e.x, e.y, 3 + Math.floor(L / 6)); if (Math.random() < 0.5) spawnItem({ type: 'ability', id: R.pick(abilityPool()) }, e.x + 8, e.y); }
  runHooks('realmKill', e);
});
HOOKS.realmKill = [];
function realmWeapon(R, L, minRar = 'common') {
  const w = randomWeapon(R, minRar, Math.min(6, L / 8));
  w.lvl = Math.max(w.lvl || 0, Math.floor(L / 4));
  return w;
}
function realmLoot(R, L, minRar) {
  const r = R.next();
  if (r < 0.62) return { type: 'weapon', w: realmWeapon(R, L, minRar) };
  if (r < 0.85) return { type: 'ability', id: R.pick(abilityPool()) };
  if (r < 0.93) { const id = randomRelic(R); return id ? { type: 'relic', id } : { type: 'gold', n: 10 + L * 3 }; }
  return { type: 'gold', n: 10 + L * 3 };
}

/* ---------- world bosses ---------- */
const WB_PATTERNS = {
  charge: ['charge', 'slam', 'summon', 'charge'], slam: ['slam', 'rain', 'nova', 'slam'], nova: ['nova', 'rain', 'summon', 'nova'], summon: ['summon', 'nova', 'rain', 'slam'],
  frost: ['rain', 'nova', 'slam', 'charge'], fire: ['rain', 'nova', 'slam', 'summon'], storm: ['rain', 'charge', 'nova', 'rain'], chaos: ['nova', 'rain', 'summon', 'blink', 'charge'],
};
const WB_ELEM = { frost: 'ice', fire: 'fire', storm: 'storm', chaos: 'chaos', summon: 'venom', nova: 'arcane', slam: 'rock', charge: 'rock' };
function spawnWorldBoss(Z) {
  const B = W_BOSS_DEF[Z.lair.boss];
  if (!B) return;
  const L = Z.b.lvl[1] + 2, frames = bossFrames(B.id), sp = frames[0];
  const e = {
    type: 'enemy', boss: true, world: true, kind: B.id, def: { name: B.name, title: B.title, sprite: 'wboss', light: B.c[2] }, x: (Z.lair.x + 0.5) * TS, y: (Z.lair.y + 0.5) * TS, vx: 0, vy: 0, kx: 0, ky: 0,
    r: Math.round(7 + B.size * 2.4), h: sp.h - 4, maxHp: Math.round(1300 * worldHpMul(L)), hp: 0, dmg: 15 * worldDmgMul(L), xp: 70 * worldXpMul(L), gold: 0, lvl: L, room: 0, spawnT: 0, face: -1, anim: 0, flash: 0,
    stunT: 0, freezeT: 0, chillT: 0, chillN: 0, contactCd: 0, bphase: 1, st: 'idle', stT: 0, atkT: 2, frames, pattern: B.pattern, elem: WB_ELEM[B.pattern] || 'rock', spd: B.fly ? 54 : 40, fly: !!B.fly, blood: [B.c[0], B.c[2]],
    home: { x: (Z.lair.x + 0.5) * TS, y: (Z.lair.y + 0.5) * TS }, awake: false, bdef: B,
  };
  e.hp = e.maxHp;
  e.think = worldBossThink;
  e.onHurt = (b) => { const f = b.hp / b.maxHp; if (b.bphase === 1 && f < 0.66) { b.bphase = 2; banner(B.name, 'grows furious', 1.6); Sound.play('roar'); shake(6); } else if (b.bphase === 2 && f < 0.33) { b.bphase = 3; banner(B.name, 'is desperate', 1.6); Sound.play('roar'); shake(8); } };
  G.ents.push(e);
  W.bossE = e;
}
function wakeBoss(e) {
  if (e.awake) return;
  e.awake = true; G.boss = e;
  $('bossbar').hidden = false; $('boss-name').textContent = `${e.bdef.name} · Lv ${e.lvl}`;
  later(0.3, () => { banner(e.bdef.name, e.bdef.title, 2.6); Sound.play('roar'); shake(6); });
  runHooks('bossStart', e);
  realmMusic(true);
}
function worldBossThink(e, dt) {
  const p = G.p, d = Math.hypot(p.x - e.x, p.y - e.y);
  if (!e.awake) { if (d < 200 && !p.dead) wakeBoss(e); else return; }
  // too far from home or you ran: it resets
  if (p.dead || d > 560 || Math.hypot(e.x - e.home.x, e.y - e.home.y) > 600) {
    e.awake = false; e.hp = e.maxHp; e.bphase = 1; e.st = 'idle'; G.boss = null; $('bossbar').hidden = true; e.x = e.home.x; e.y = e.home.y; realmMusic(true); return;
  }
  const fury = e.bphase >= 3 ? 1.45 : e.bphase >= 2 ? 1.2 : 1;
  if (e.st === 'act') { e.stT -= dt; if (e.actFn) e.actFn(e, dt, fury); if (e.stT <= 0) { e.st = 'chase'; e.actFn = null; e.pose = 0; e.contactDmg = null; } return; }
  e.atkT -= dt * fury;
  if (e.atkT <= 0) {
    const list = WB_PATTERNS[e.pattern] || WB_PATTERNS.slam;
    const move = list[(e.moveN = (e.moveN || 0) + 1) % list.length];
    e.atkT = rnd(2.2, 3.2);
    WB_MOVES[move](e, fury);
    return;
  }
  const dir = steerTo(e, p.x, p.y);
  if (d > e.r + 16) walk(e, dir.x, dir.y, e.spd * (e.bphase >= 3 ? 1.25 : 1), dt);
  faceTo(e, p.x);
}
const WB_SHOT = { ice: 'icebolt', fire: 'fireball', storm: 'icebolt', chaos: 'big', venom: 'spore', arcane: 'orb', rock: 'shard' };
const WB_MOVES = {
  slam(e, fury) {
    const R = 46 + e.r * 1.6;
    e.st = 'act'; e.stT = 1.2; e.pose = 2;
    telegraph({ x: e.x, y: e.y, r: R, life: 0.85, color: '#ff8a6a', fire: () => {
      explode(e.x, e.y, R, 0, { team: 'e', pdmg: e.dmg * 1.3, color: '#ffd08a', sound: 'slam', shake: 7 });
      const n = Math.round(10 * fury);
      for (let k = 0; k < n; k++) eShot(e, WB_SHOT[e.elem] || 'shard', (k * TAU) / n, { y: e.y - 6, dmg: e.dmg * 0.7 });
    } });
    Sound.play('growl', { p: 0.5 });
  },
  charge(e, fury) {
    const p = G.p, a = Math.atan2(p.y - e.y, p.x - e.x);
    e.st = 'act'; e.stT = 1.6; e.ca = a; e.cT = 0;
    telegraph({ x: e.x, y: e.y - 4, ang: a, len: 220, life: 0.65, line: true, width: e.r * 2, color: '#ff6a4a' });
    e.actFn = (b, dt) => { b.cT += dt; if (b.cT < 0.65) { b.pose = 2; return; } b.contactDmg = b.dmg * 1.5; const bumped = moveEnt(b, Math.cos(b.ca) * 300 * dt, Math.sin(b.ca) * 300 * dt); b.face = Math.cos(b.ca) > 0 ? 1 : -1; if (Math.random() < 0.6) burst(b.x, b.y, 2, ['#8a7a6a', b.blood[0]], { smax: 30, lmax: 0.3 }); if (bumped) { b.stT = Math.min(b.stT, 0.5); shake(5); Sound.play('slam', { v: 0.5 }); b.ca += Math.PI; } };
    Sound.play('roar', { p: 1.2, v: 0.6 });
  },
  nova(e, fury) {
    e.st = 'act'; e.stT = 1.4; e.pose = 2;
    const waves = e.bphase >= 2 ? 3 : 2, n = Math.round(14 * fury);
    for (let w = 0; w < waves; w++) later(0.25 + w * 0.35, () => { if (e.dead) return; for (let k = 0; k < n; k++) eShot(e, WB_SHOT[e.elem] || 'orb', (k * TAU) / n + w * 0.2, { dmg: e.dmg * 0.6, speedMul: 0.9 }); Sound.play('shard', { p: 0.6 }); });
    flashLight(e.x, e.y - 20, 120, e.blood[1] || '#ffffff', 0.4);
  },
  rain(e, fury) {
    const p = G.p, n = Math.round(6 * fury);
    e.st = 'act'; e.stT = 1.1; e.pose = 2;
    for (let k = 0; k < n; k++) {
      const q = k < 2 ? { x: p.x + rnd(-12, 12), y: p.y + rnd(-12, 12) } : { x: p.x + rnd(-110, 110), y: p.y + rnd(-80, 80) };
      later(k * 0.12, () => {
        if (e.dead) return;
        const el = e.elem;
        telegraph({ x: q.x, y: q.y, r: 22, life: 0.9, color: el === 'ice' ? '#9fe0ff' : el === 'fire' ? '#ff5a2a' : el === 'storm' ? '#fff27a' : el === 'venom' ? '#8fe05c' : el === 'chaos' ? '#ff4ad0' : '#c8b8a0', fire: () => {
          if (el === 'storm') { G.fx.push({ kind: 'bolt', x: q.x, y: q.y, t: 0, life: 0.3, seed: Math.random() * 1000 }); Sound.play('thunder', { v: 0.5 }); }
          else if (el === 'ice') G.fx.push({ kind: 'icicle', x: q.x, y: q.y, t: 0, life: 0.8 });
          else if (el === 'fire') { G.fx.push({ kind: 'firefield', x: q.x, y: q.y, r: 16, t: 0, life: 2.4, team: 'e', burn: true, tick: 0.2 }); }
          else if (el === 'venom') G.fx.push({ kind: 'pool', x: q.x, y: q.y, r: 20, t: 0, life: 3, team: 'e', poison: true, tick: 0.3, color: '#8fe05c' });
          explode(q.x, q.y, 22, 0, { team: 'e', pdmg: e.dmg * 0.9, color: el === 'chaos' ? '#ff4ad0' : '#ffb35e', vol: 0.4, shake: 2 });
        } });
        if (el === 'fire' || el === 'rock') G.fx.push({ kind: 'meteor', x: q.x, y: q.y, t: 0, life: 0.9 });
      });
    }
  },
  summon(e) {
    const b = W.Z ? W.Z.b : null;
    e.st = 'act'; e.stT = 1; e.pose = 2;
    if (!b || G.ents.filter((o) => !o.dead && o.summonedBy === e).length >= 6) return;
    for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU + rnd(0, 1), q = realmFreeSpotNear(e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 30); const m = spawnWorldMob(rndPick(b.mobs), q.x, q.y, Math.max(1, e.lvl - 3)); if (m) { m.summonedBy = e; m.summoned = true; m.aggro = true; m.home = { ...e.home }; m.xp = 1; m.gold = 0; } }
    Sound.play('spawn'); ring(e.x, e.y - 10, 50, e.blood[1] || '#c873ff', 0.5, 2);
  },
  blink(e) {
    const p = G.p, a = rnd(TAU), q = realmFreeSpotNear(p.x + Math.cos(a) * 90, p.y + Math.sin(a) * 70);
    burst(e.x, e.y - 20, 24, CHAOS_COLS, { smax: 120, glow: true });
    e.x = q.x; e.y = q.y; e.st = 'act'; e.stT = 0.5;
    burst(e.x, e.y - 20, 24, CHAOS_COLS, { smax: 120, glow: true }); Sound.play('chaos');
  },
};
const _bossDefeatedRealm = bossDefeated;
bossDefeated = function (e) {
  if (!e.world) return _bossDefeatedRealm(e);
  const p = G.p, B = e.bdef, L = e.lvl;
  G.slowmo = 1.2; hitstop(0.2); shake(12);
  Sound.play('roar', { p: 0.7 }); Sound.play('boom');
  for (let k = 0; k < 6; k++) later(0.15 * k, () => explode(e.x + rnd(-30, 30), e.y - rnd(0, 40), 28, 0, { team: 'none', color: '#ffd08a', vol: 0.5, shake: 3 }));
  burst(e.x, e.y - 20, 70, [B.c[0], B.c[2], '#ffffff', '#ffd08a'], { smax: 220, glow: true, vz: 150 });
  for (const o of G.ents) if (o.summonedBy === e && !o.dead) killEnemy(o);
  G.boss = null; $('bossbar').hidden = true; W.bossE = null;
  dropXP(e.x, e.y, Math.round(e.xp * p.stats.xpMul));
  for (let k = 0; k < 8; k++) dropPickup('gold', e.x, e.y, 10 + L);
  dropPickup('ember', e.x, e.y, 12 + Math.floor(L / 3));
  dropPickup('potion', e.x, e.y, 1);
  const R = new RNG((Math.random() * 1e9) | 0);
  spawnItem({ type: 'weapon', w: realmWeapon(R, L, Math.random() < 0.25 ? 'legendary' : 'epic') }, e.x - 14, e.y + 6);
  spawnItem(Math.random() < 0.5 ? { type: 'relic', id: randomRelic(R) } : { type: 'ability', id: R.pick(abilityPool()) }, e.x + 14, e.y + 6);
  if (W.ch) { W.ch.bosses = W.ch.bosses || {}; W.ch.bosses[W.Z.id] = Date.now(); W.ch.trophies = [...new Set([...(W.ch.trophies || []), B.id])]; }
  CD.save.stats.bossKills = CD.save.stats.bossKills || {}; CD.save.stats.bossKills[B.id] = (CD.save.stats.bossKills[B.id] || 0) + 1;
  const F = CD.save.fs; F.worldBosses = (F.worldBosses || 0) + 1;
  later(0.6, () => { banner(`${B.name} falls`, 'the realm remembers', 3); Sound.play('levelup', { p: 0.7 }); if (typeof Music.stinger === 'function') Music.stinger('bossdown'); });
  later(4, () => realmMusic(true));
  runHooks('realmBoss', e);
  saveRealm();
};
HOOKS.realmBoss = [];
for (const id in W_BOSS_DEF) BOSS_DRAW[id] = (g, e, x, y, a, white) => {
  const fr = e.frames, moving = Math.hypot(e.vx || 0, e.vy || 0) > 5;
  const sp = crigEntFrame(e) || (e.pose === 2 ? fr[2] : fr[moving ? Math.floor(e.anim * 5) % 2 : Math.floor(e.anim * 1.5) % 2]);
  const bob = e.fly ? Math.sin(G.t * 3) * 3 - 8 : 0;
  drawSprite(g, sp, x, y + bob, e.face < 0, { alpha: a, white, outline: e.bphase >= 3 ? '#ff4a3a' : e.bphase >= 2 ? '#ffb35e' : null });
};

/* ---------- townsfolk ---------- */
function updateNpcs(dt) {
  const p = G.p;
  for (const n of W.npcs) {
    n.t += dt;
    const d = Math.hypot(n.x - p.x, n.y - p.y);
    if (d > 700) continue;
    // people who stand still turn to watch you go by
    if (n.still || n.role !== 'folk') { n.moving = false; n.face = p.x < n.x ? -1 : 1; n.turn = d < 150 ? pickTurn(n.turn, p.x - n.x, p.y - n.y) : 0; n.view = n.turn >= 3 ? 'back' : 'front'; continue; }
    if (d < 26) { n.moving = false; n.face = p.x < n.x ? -1 : 1; n.turn = pickTurn(n.turn, p.x - n.x, p.y - n.y); continue; }
    if (Math.hypot(n.tx - n.x, n.ty - n.y) < 4 || n.t > 9) {
      n.t = 0;
      if (Math.random() < 0.4) { n.tx = n.x; n.ty = n.y; }
      else { const a = rnd(TAU), r = rnd(0, n.roam || 60); n.tx = n.hx + Math.cos(a) * r; n.ty = n.hy + Math.sin(a) * r; }
    }
    const dx = n.tx - n.x, dy = n.ty - n.y, l = Math.hypot(dx, dy);
    if (l > 3) {
      const sp = 26, ox = n.x, oy = n.y;
      moveEnt(n, (dx / l) * sp * dt, (dy / l) * sp * dt);
      n.moving = Math.hypot(n.x - ox, n.y - oy) > 0.05;
      if (!n.moving) n.t = 99;
      n.anim += dt * 3; n.face = dx < 0 ? -1 : 1; n.turn = pickTurn(n.turn, dx, dy); n.view = n.turn >= 3 ? 'back' : 'front';
    } else n.moving = false;
  }
  if (W.say && (W.say.t -= dt) <= 0) W.say = null;
}

/* ---------- edges, discovery ---------- */
const OPP = { n: 's', s: 'n', w: 'e', e: 'w' };
function realmEdges() {
  if (W.travelling || !W.Z || G.p.dead) return;
  const p = G.p, tx = p.x / TS, ty = p.y / TS;
  for (const g of W.Z.gates) {
    const at = g.dir === 'w' ? tx < 3 && Math.abs(ty - g.inY) < 8 : g.dir === 'e' ? tx > ZT - 3 && Math.abs(ty - g.inY) < 8 : g.dir === 'n' ? ty < 3 && Math.abs(tx - g.inX) < 8 : ty > ZT - 3 && Math.abs(tx - g.inX) < 8;
    if (!at) continue;
    travelTo(g.to, null, OPP[g.dir]);
    return;
  }
}
function travelTo(zoneId, pos, fromDir) {
  if (W.travelling) return;
  W.travelling = true;
  saveRealm();
  Sound.play('stairs');
  realmFade(() => {
    let x = pos ? pos.x : null, y = pos ? pos.y : null;
    if (!pos && fromDir) { const nb = BIOME[zoneId], g = gatesOf(nb).find((q) => q.dir === fromDir); if (g) { x = (g.inX + 0.5) * TS; y = (g.inY + 0.5) * TS; } }
    loadZone(zoneId, x, y);
    W.travelling = false;
    saveRealm();
  });
}
function discover() {
  const p = G.p, cx = Math.floor(p.x / TS / 16), cy = Math.floor(p.y / TS / 16);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < DISC_N && y < DISC_N && dx * dx + dy * dy <= 5) W.disc[y * DISC_N + x] = 1; }
  // waystones attune when you pass them; landmarks reward the curious
  const ch = W.ch;
  for (const w of W.Z.ways) if (!ch.ways.includes(w.id) && Math.hypot((w.x + 0.5) * TS - p.x, (w.y + 0.5) * TS - p.y) < 60) { attuneWay(w); toast(`Waystone attuned: ${w.name}`, '#7fe8ff'); Sound.play('magic', { p: 1.4 }); ring((w.x + 0.5) * TS, (w.y + 0.5) * TS - 10, 40, '#7fe8ff', 0.6); }
  ch.marks = ch.marks || [];
  for (const m of W.Z.marks) if (!ch.marks.includes(m.id) && Math.hypot((m.x + 0.5) * TS - p.x, (m.y + 0.5) * TS - p.y) < 70) { ch.marks.push(m.id); const xp = Math.round(xpToNext(p.level) * 0.12); gainXP(xp); toast(`Discovered ${m.name} · +${xp} XP`, '#ffd35c'); Sound.play('chest', { v: 0.5 }); runHooks('realmMark', m); }
  for (const s of W.Z.towns) { const key = 'town:' + s.id; if (!ch.marks.includes(key) && Math.hypot((s.x + 0.5) * TS - p.x, (s.y + 0.5) * TS - p.y) < (s.r + 2) * TS) { ch.marks.push(key); banner(s.name, s.kind === 'capital' ? 'capital of the realm' : s.kind, 2.2); runHooks('realmMark', { id: key, town: s }); } }
}
HOOKS.realmMark = [];
function attuneWay(w) {
  const ch = W.ch;
  if (!ch.ways.includes(w.id)) ch.ways.push(w.id);
  ch.wayInfo = ch.wayInfo || {};
  ch.wayInfo[w.id] = { zone: W.Z.id, x: w.x, y: w.y, name: w.name };
}

/* ---------- death and coming back ---------- */
const _playerDieRealm = playerDie;
playerDie = function () {
  if (!W.on) return _playerDieRealm();
  const p = G.p;
  if (p.dead) return;
  p.dead = true;
  Sound.play('hurt', { p: 0.6 }); Sound.play('boom', { p: 0.5, v: 0.5 });
  burst(p.x, p.y - 8, 40, ['#e2434f', '#a8202a', '#ffffff'], { smax: 140, vz: 120 });
  G.slowmo = 1.4; letterbox(1.6);
  if (Music.stinger) Music.stinger('death');
  W.ch.deaths = (W.ch.deaths || 0) + 1;
  // the price is paid now, so quitting or reloading cannot dodge it
  W.deathLost = Math.floor(p.gold * 0.1); p.gold -= W.deathLost;
  if (!W.inInst) W.ch.dead = true;
  saveRealm(true);
  later(1.8, () => { if (G.p === p) UI.realmDeath(); }, true);
};
hook('stats', (s, p) => { if (p.weakT > 0) { s.dmgMul *= 0.8; s.dmgTaken *= 1.15; } if (p.blessT > 0 && p.bless && BLESSINGS[p.bless]) BLESSINGS[p.bless].apply(s); if (p.restedT > 0) s.xpMul += 0.15; });
hook('update', (dt) => { const p = G.p; if (!p || !W.on) return; let changed = false; for (const k of ['blessT', 'restedT', 'weakT']) if (p[k] > 0) { p[k] -= dt; if (p[k] <= 0) { p[k] = 0; changed = true; } } if (changed) recalcStats(p); });
const BLESSINGS = {
  might: { name: 'Blessing of Might', desc: '+15% damage', cost: 1.0, apply: (s) => { s.dmgMul += 0.15; } },
  ward: { name: 'Blessing of Warding', desc: '+3 armor, 10% less damage', cost: 1.0, apply: (s) => { s.armor += 3; s.dmgTaken *= 0.9; } },
  haste: { name: 'Blessing of Haste', desc: '+12% move and attack speed', cost: 1.2, apply: (s) => { s.spdMul += 0.12; s.atkSpd += 0.12; } },
  fortune: { name: 'Blessing of Fortune', desc: '+30% gold and +2 luck', cost: 0.8, apply: (s) => { s.goldMul += 0.3; s.luck += 2; } },
  wisdom: { name: 'Blessing of Wisdom', desc: '+25% experience', cost: 1.4, apply: (s) => { s.xpMul += 0.25; } },
};

/* ---------- instances: the old dungeons, entered from the world ---------- */
function enterInstance(dg) {
  const p = G.p, Z = W.Z, b = Z.b;
  const lvl = Math.max(b.lvl[0], Math.min(b.lvl[1] + 2, Math.round((b.lvl[0] + b.lvl[1]) / 2 + 2)));
  W.inst = { zone: Z.id, x: (dg.x + 0.5) * TS, y: (dg.y + 3.5) * TS, act: dg.act, lvl, name: dg.name, first: dg.act * FLOORS_PER_ACT, last: dg.act * FLOORS_PER_ACT + FLOORS_PER_ACT - 1, t0: W.t, kills0: G.run.stats.kills };
  W.ch.x = W.inst.x; W.ch.y = W.inst.y; W.ch.zone = Z.id;
  saveRealm(true);
  const run = G.run;
  run.seed = hash2(hashStr(dg.id), Date.now() & 0xffffff); run.rng = new RNG(run.seed ^ 0x5bd1e995);
  run.inst = W.inst; run.won = false; run.endless = false;
  Sound.play('stairs');
  realmFade(() => { W.inInst = true; goFloor(W.inst.first, true); toast(`${dg.name} · monsters are level ${lvl}`, '#ffd35c'); });
}
hook('onFloor', () => { if (W.on && W.inInst && W.inst && G.fl && !G.fl.realm) { G.fl.idx = worldIdx(Math.max(W.inst.lvl, G.p ? G.p.level : 1)); } });
const _descendRealm = descend;
descend = function () {
  if (W.on && W.inInst && W.descending) return; // one step at a time
  if (W.on && W.inInst && W.inst && G.run.floorIdx >= W.inst.last) { exitInstance(true); return; }
  if (W.on && W.inInst) { const to = G.run.floorIdx + 1; W.descending = true; Sound.play('stairs'); realmFade(() => { W.descending = false; if (W.inInst && G.run.floorIdx === to - 1) goFloor(to); }); return; }
  return _descendRealm();
};
const _finalChoiceRealm = UI.finalChoice;
UI.finalChoice = function () { if (W.on) return descend(); return _finalChoiceRealm(); };
const _saveCheckpointRealm = saveCheckpoint;
saveCheckpoint = function () { if (W.on) { saveRealm(); return; } return _saveCheckpointRealm(); };
const _endRunRealm = endRun;
endRun = function (won) { if (W.on) { if (W.inInst) exitInstance(!!won); return; } return _endRunRealm(won); };
function exitInstance(won, lost = 0) {
  const inst = W.inst, p = G.p;
  if (!inst) return;
  W.inst = null; G.run.inst = null;
  W.afterLoad = W.afterLoad || [];
  if (won) {
    W.ch.insts = (W.ch.insts || 0) + 1;
    // pays by the dungeon's level, so old dungeons are not an endless well
    const xp = Math.round(xpToNext(Math.min(p.level, inst.lvl)) * 0.6);
    gainXP(xp);
    p.gold += 40 + inst.lvl * 6;
    const F = CD.save.fs; F.instances = (F.instances || 0) + 1;
    runHooks('realmInstance', inst);
    W.afterLoad.push(() => { banner(`${inst.name} cleared`, `+${xp} XP · +${40 + inst.lvl * 6} gold`, 3); Sound.play('levelup'); });
  } else W.afterLoad.push(() => toast(`Dragged out of ${inst.name}${lost ? `. You lost ${lost} gold` : ''}.`, '#ff8a8a'));
  p.dead = false; p.hp = Math.max(p.hp, Math.round(p.maxHp * (won ? 1 : 0.6)));
  realmFade(() => { W.inInst = false; W.descending = false; loadZone(inst.zone, inst.x, inst.y); saveRealm(true); });
}
HOOKS.realmInstance = [];

/* ---------- the main loop and the camera know about the realm ---------- */
const _updateMain = update;
update = function (dt) {
  if (W.on && W.campFromRealm) return; // the camp altar is open
  if (W.on && G.fl && G.fl.realm) { if (W.inInst) return; return updateRealm(dt); }
  if (W.on && W.inInst && !W.inst) return; // between a dungeon and the world
  if (!G.fl || !G.fl.tiles) return; // a fade is still building the next place
  return _updateMain(dt);
};
const _camTargetRealm = camTarget;
camTarget = function () {
  if (!(W.on && !W.inInst && G.fl && G.fl.realm)) return _camTargetRealm();
  const p = G.p;
  let tx = p.x, ty = p.y - 12;
  if (Input.act.aimMode === 'mouse' && !p.dead) { const w = screenToWorld(Input.mouse.x, Input.mouse.y); tx += clamp((w.x - p.x) * 0.16, -30, 30); ty += clamp((w.y - p.y) * 0.16, -22, 22); }
  else { tx += p.vx * 0.18; ty += p.vy * 0.14; }
  const b = G.boss;
  if (b && !b.dead && b.awake) { tx = lerp(tx, b.x, 0.3); ty = lerp(ty, b.y - 20, 0.3); }
  if (Input.device === 'touch' && R.VH > R.VW * 1.3) ty += R.VH * 0.08;
  return { x: clamp(tx, R.VW / 2, ZT * TS - R.VW / 2), y: clamp(ty, R.VH / 2, ZT * TS - R.VH / 2) };
};
window.addEventListener('pagehide', () => { if (W.on) saveRealm(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && W.on) saveRealm(true); });

