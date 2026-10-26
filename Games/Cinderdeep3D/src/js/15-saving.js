/* ============================================================
   Cinderdeep — saving: this browser first, the artifact's own
   per-person store when it is there, plus run checkpoints
   ============================================================ */
const SAVE_KEY = 'cinderdeep.save.v1';
// the release shown on the title screen; saves keep their own key above
const VERSION = '10.4';
const DEFAULT_SETTINGS = { music: 0.45, sfx: 0.75, shake: 1, zoom: 1, bright: false, lowFx: false, padAutoFire: true, turn8: true, rigWorld: true };
function defaultSave() {
  return {
    // every hero and beast is yours from the start
    v: 1, embers: 0, meta: {}, unlocks: { classes: CLASSES.map((c) => c.id), weapons: [], abilities: [] }, feats: {}, fs: {},
    stats: { runs: 0, wins: 0, deaths: 0, kills: 0, bestFloor: 0, embersEarned: 0, bossKills: {} },
    heatUnlocked: 0, settings: { ...DEFAULT_SETTINGS }, sheets: [], run: null, codex: {}, seen: {}, history: [], updated: 0,
  };
}
function mergeSave(raw) {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const s = { ...d, ...raw };
  s.meta = { ...(raw.meta || {}) };
  s.unlocks = { classes: [...new Set([...(d.unlocks.classes), ...((raw.unlocks && raw.unlocks.classes) || [])])], weapons: (raw.unlocks && raw.unlocks.weapons) || [], abilities: (raw.unlocks && raw.unlocks.abilities) || [] };
  s.stats = { ...d.stats, ...(raw.stats || {}) };
  s.settings = { ...DEFAULT_SETTINGS, ...(raw.settings || {}) };
  s.sheets = Array.isArray(raw.sheets) ? raw.sheets : [];
  s.history = Array.isArray(raw.history) ? raw.history : [];
  s.codex = raw.codex || {}; s.seen = raw.seen || {};
  s.feats = raw.feats || {}; s.fs = raw.fs || {};
  return s;
}
CD.cloud = null; CD.cloudState = 'local';
function loadLocal() { return mergeSave(LS.get(SAVE_KEY)); }
let cloudTimer = 0, cloudBusy = false, cloudDirty = false;
function persist(now) {
  const s = CD.save;
  s.updated = Date.now();
  s.localEdits = (s.localEdits || 0) + 1;
  if (!LS.set(SAVE_KEY, s) && !CD.lsWarned) { CD.lsWarned = true; setTimeout(() => { try { toast('This browser would not store your save. Progress may not last.', '#ff8a8a'); } catch (e) { /* early */ } }, 500); }
  if (!CD.cloud) return;
  cloudDirty = true;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(flushCloud, now ? 50 : 1500);
}
async function flushCloud() {
  if (!CD.cloud || cloudBusy || !cloudDirty) return;
  cloudBusy = true; cloudDirty = false;
  try {
    const { sheets, ...rest } = CD.save;
    const body = JSON.parse(JSON.stringify(rest)), edits = CD.save.localEdits || 0;
    body.syncId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    delete body.lastSyncId; delete body.localEdits;
    const FAIL = {};
    const r = await withTimeout(CD.cloud.saveRef.set(body).then(() => true), 8000, FAIL);
    if (r !== true) throw { code: 'retry' };
    // this device now matches the cloud
    CD.cloudFails = 0; CD.save.lastSyncId = body.syncId; CD.save.localEdits = Math.max(0, (CD.save.localEdits || 0) - edits); LS.set(SAVE_KEY, CD.save);
    const sheetStr = JSON.stringify(sheets || []);
    if (CD.cloud.sheetsLoaded && sheetStr !== CD.cloud.lastSheets && sheetStr.length < 240000) { const r2 = await withTimeout(CD.cloud.sheetRef.set({ list: sheets || [] }).then(() => true), 8000, FAIL); if (r2 === true) CD.cloud.lastSheets = sheetStr; }
  } catch (e) {
    if (e && (e.code === 'invalid_argument' || e.code === 'revoked' || e.code === 'not_granted')) { CD.cloud = null; CD.cloudState = 'local'; }
    else { cloudDirty = true; CD.cloudFails = (CD.cloudFails || 0) + 1; } // try again shortly
  }
  cloudBusy = false;
  if (cloudDirty) cloudTimer = setTimeout(flushCloud, Math.min(60000, 1500 * 2 ** Math.min(6, CD.cloudFails || 0)));
}
async function connectCloud() {
  await connectCloudInner();
  CD.cloudTried = true;
  const n = $('save-note'); if (n) n.textContent = saveNote();
}
async function connectCloudInner() {
  try {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    const [db, user] = await Promise.all([withTimeout(window.claude.use('db'), 10000), withTimeout(window.claude.use('user'), 10000)]);
    if (!db || !user) return;
    const uid = await withTimeout(user.id(), 6000);
    if (!uid) return;
    const saveRef = db.doc(`data/users/${uid}/save`), sheetRef = db.doc(`data/users/${uid}/sheets`);
    // a read that fails or times out must never be mistaken for an empty cloud
    const FAIL = {};
    const [snap, sheetSnap] = await Promise.all([withTimeout(saveRef.get(), 8000, FAIL), withTimeout(sheetRef.get(), 8000, FAIL)]);
    if (snap === FAIL || !snap) { CD.cloudRetry = (CD.cloudRetry || 0) + 1; if (CD.cloudRetry < 6) setTimeout(() => connectCloud(), 15000 * CD.cloudRetry); return; }
    CD.cloud = { db, saveRef, sheetRef, lastSheets: '', sheetsLoaded: sheetSnap !== FAIL && !!sheetSnap };
    CD.cloudState = 'cloud';
    const remote = snap && snap.exists ? snap.data() : null;
    if (remote && cloudWins(remote, CD.save)) {
      const keepSettings = CD.save.settings;
      const sheets = sheetSnap && sheetSnap.exists && Array.isArray(sheetSnap.data().list) ? sheetSnap.data().list : CD.save.sheets;
      const oldSave = CD.save;
      CD.save = mergeSave({ ...JSON.parse(JSON.stringify(remote)), sheets });
      CD.save.settings = { ...CD.save.settings, ...keepSettings };
      CD.save.lastSyncId = remote.syncId || null; CD.save.localEdits = 0;
      LS.set(SAVE_KEY, CD.save);
      if (typeof realmRebind === 'function') realmRebind(oldSave);
      applySettings();
      if (G.mode === 'title' && UI.top()) UI.title();
    } else {
      if (sheetSnap && sheetSnap !== FAIL && sheetSnap.exists) CD.cloud.lastSheets = JSON.stringify(sheetSnap.data().list || []);
      if (!remote || remote.syncId !== CD.save.lastSyncId || CD.save.localEdits) persist(true);
    }
  } catch (e) { CD.cloud = null; CD.cloudState = 'local'; }
}
// which copy to keep when this device connects: the cloud unless this device has changes the cloud has not seen
function progressScore(s) {
  const st = s.stats || {}, realm = (s.realm && Array.isArray(s.realm.chars)) ? s.realm.chars : [];
  return (st.embersEarned || 0) + (st.kills || 0) * 0.05 + (st.runs || 0) * 20 + realm.reduce((a, c) => a + (c.play || 0) * 0.02 + ((c.snap && c.snap.level) || 0) * 30, 0);
}
function cloudWins(remote, local) {
  if (!remote.syncId && !local.lastSyncId) return (remote.updated || 0) > (local.updated || 0); // older saves: newest wins
  if (remote.syncId && remote.syncId === local.lastSyncId) return false; // nothing new in the cloud
  if (!local.localEdits) return true; // nothing new here
  // both changed since they last met: keep the one with more progress
  return progressScore(remote) >= progressScore(local);
}
function applySettings() {
  CD.settings = CD.save.settings = { ...DEFAULT_SETTINGS, ...(CD.save.settings || {}) };
  Sound.vol.sfx = CD.settings.sfx; Sound.vol.music = CD.settings.music; Sound.setVolumes();
  if (R.screen) resize();
}

/* ---------- run checkpoints: saved at the start of every floor ---------- */
function saveCheckpoint() {
  const run = G.run, p = G.p;
  if (!run || !p || run.ended) return;
  CD.save.run = {
    cls: run.cls, sheetId: run.sheetId, seed: run.seed, seedText: run.seedText, heat: run.heat, floorIdx: run.floorIdx, endless: run.endless, t: run.t,
    embers: run.embers, stats: { ...run.stats }, kinds: { ...run.kinds }, rngS: run.rng.s, daily: run.daily, chaos: !!run.chaos,
    p: {
      level: p.level, xp: p.xp, gold: p.gold, keys: p.keys, potions: p.potions, hp: Math.max(1, Math.round(p.hp)), weapons: p.weapons.map((w) => w && { ...w, affixes: [...w.affixes] }), wi: p.wi,
      abilities: p.abilities.map((a) => a && { id: a.id, lvl: a.lvl }), skills: { ...p.skills }, relics: [...p.relics], rerolls: p.rerolls,
      reviveLeft: p.reviveLeft, phoenixUsed: !!p.phoenixUsed, maxHpPenalty: p.maxHpPenalty || 0, pendingLevels: p.pendingLevels || 0,
    },
  };
  runHooks('saveRun', CD.save.run, run, p);
  persist();
}
function continueRun() {
  const c = CD.save.run;
  if (!c) return;
  if (c.charId && typeof charById === 'function' && !charById(c.charId)) { CD.save.run = null; persist(); UI.title(); return; }
  UI.clear();
  fadeTransition(() => {
    Sound.init();
    G.demo = false;
    const run = (G.run = newRunState({ cls: c.cls, heat: c.heat, sheetId: c.sheetId, chaos: c.chaos }));
    run.seed = c.seed; run.seedText = c.seedText; run.endless = c.endless; run.t = c.t; run.embers = c.embers; run.stats = { ...run.stats, ...c.stats }; run.kinds = c.kinds || {}; run.rng = new RNG(c.rngS || c.seed); run.daily = c.daily;
    G.fl = { idx: c.floorIdx, info: floorInfo(c.floorIdx), actIdx: floorInfo(c.floorIdx).actIdx % ACTS.length };
    const sheet = c.sheetId ? (CD.save.sheets || []).find((s) => s.id === c.sheetId) : null;
    const p = (G.p = makePlayer(c.cls, { sheet: sheet ? loadSheet(sheet) : null }));
    const q = c.p;
    Object.assign(p, { level: q.level, xp: q.xp, gold: q.gold, keys: q.keys, potions: q.potions, wi: q.wi || 0, skills: { ...q.skills }, relics: [...q.relics], rerolls: q.rerolls, reviveLeft: q.reviveLeft, phoenixUsed: q.phoenixUsed, maxHpPenalty: q.maxHpPenalty || 0, pendingLevels: q.pendingLevels || 0 });
    p.weapons = q.weapons.map((w) => w && { ...w, affixes: [...(w.affixes || [])] });
    if (!p.weapons[p.wi]) p.wi = 0;
    p.weapon = p.weapons[p.wi];
    p.abilities = q.abilities.map((a) => a && { id: a.id, lvl: a.lvl, cd: 0, max: 1 });
    runHooks('loadRun', c, run, p);
    recalcStats(p);
    p.hp = Math.min(p.maxHp, q.hp);
    goFloor(c.floorIdx);
  });
}

