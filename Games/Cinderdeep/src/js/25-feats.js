/* ============================================================
   Cinderdeep — feats: lasting achievements that pay embers,
   plus the run-level bookkeeping they need
   ============================================================ */
const liveKills = () => (CD.save.stats.kills || 0) + (G.run && !G.run.ended && !G.demo ? G.run.stats.kills : 0);
const FEAT_TEST = {
  firstblood: () => liveKills() >= 1,
  centurion: () => liveKills() >= 100,
  slayer: () => liveKills() >= 1000,
  legionbane: () => liveKills() >= 5000,
  bossfirst: (S) => Object.values(S.bossKills || {}).some((n) => n > 0),
  bossall: (S) => Object.keys(BOSSES).every((k) => (S.bossKills || {})[k] > 0),
  grotto: (S) => (S.bestFloor || 0) >= 4,
  core: (S) => (S.bestFloor || 0) >= 10,
  victory: (S) => (S.wins || 0) >= 1,
  heat5: (S, F) => (F.winHeat || 0) >= 5,
  heat10: (S, F) => (F.winHeat || 0) >= 10,
  endless: (S) => (S.bestFloor || 0) >= 16,
  combo25: (S, F) => (F.maxCombo || 0) >= 25,
  combo75: (S, F) => (F.maxCombo || 0) >= 75,
  combo100: (S, F) => (F.maxCombo || 0) >= 100,
  evolve: (S, F) => (F.evolutions || 0) >= 1,
  apex: (S, F) => (F.finals || 0) >= 1,
  beastwin: (S, F) => (F.beastWins || 0) >= 1,
  forged: (S, F) => (F.weaponEvos || 0) >= 1,
  devourer: (S, F) => (F.devoured || 0) >= 25,
  secret: (S, F) => (F.secrets || 0) >= 1,
  secrets10: (S, F) => (F.secrets || 0) >= 10,
  mimic: (S, F) => (F.mimics || 0) >= 1,
  kegs: (S, F) => (F.kegs || 0) >= 50,
  chaoswin: (S, F) => (F.chaosWins || 0) >= 1,
  omens: (S, F) => (F.omenFloors || 0) >= 20,
  hoarder: (S, F) => (F.maxGold || 0) >= 500,
  relics8: (S, F) => (F.maxRelics || 0) >= 8,
  untouched: (S, F) => (F.untouched || 0) >= 1,
  speedrun: (S, F) => !!F.fastWin,
  allheroes: () => CLASSES.every((c) => ((CD.save.fs && CD.save.fs.played) || []).includes(c.id)),
};
// feats about the new systems
FEATS.push(
  { id: 'dmt', name: 'Breakthrough', desc: 'Find a DMT zone.', embers: 25 },
  { id: 'banked', name: 'Soul Broker', desc: 'Bank 1,000 souls in total.', embers: 60 },
  { id: 'classlvl', name: 'Devoted', desc: 'Raise a character to Talent Level 20.', embers: 80 },
  { id: 'keystone', name: 'Keystone', desc: 'Allocate a keystone passive.', embers: 20 },
  { id: 'vengeance', name: 'Vengeance', desc: 'Slay a Chaos Beast and reclaim your souls.', embers: 50 },
  { id: 'awaken', name: 'Awakened', desc: 'Awaken a hero.', embers: 25 },
);
for (const f of FEATS.slice(-6)) FEAT[f.id] = f;
Object.assign(FEAT_TEST, {
  dmt: (S, F) => (F.dmtFound || 0) >= 1,
  banked: (S, F) => (F.soulsBanked || 0) >= 1000,
  classlvl: () => realmStore().chars.some((ch) => talentLevelOf(charTalentXp(ch)).lvl >= 20),
  keystone: () => treeAlloc().some((id) => TREE.nodes[id] && TREE.nodes[id].type === 'keystone'),
  vengeance: (S, F) => (F.nemesesSlain || 0) >= 1,
  awaken: (S, F) => (F.awakenings || 0) >= 1,
});
function checkFeats(quiet) {
  const save = CD.save;
  if (!save || G.demo) return;
  save.feats = save.feats || {};
  const S = save.stats || {}, F = save.fs || {};
  let got = 0;
  for (const f of FEATS) {
    if (save.feats[f.id] || !FEAT_TEST[f.id]) continue;
    let ok = false;
    try { ok = FEAT_TEST[f.id](S, F); } catch (e) { ok = false; }
    if (!ok) continue;
    save.feats[f.id] = Date.now(); save.embers = (save.embers || 0) + f.embers; got++;
    if (!quiet) setTimeout(() => { toast(`Feat: ${f.name} · +${f.embers} embers`, '#ffd35c'); Sound.play('feat'); }, got * 900);
  }
  if (got) persist();
  return got;
}
hook('update', (dt) => {
  const p = G.p, run = G.run;
  if (!p || !run || G.demo) return;
  const F = CD.save.fs;
  F.maxGold = Math.max(F.maxGold || 0, p.gold);
  F.maxRelics = Math.max(F.maxRelics || 0, p.relics.length);
  checkFeats.t = (checkFeats.t || 0) - dt;
  if (checkFeats.t <= 0) { checkFeats.t = 1.5; checkFeats(); }
});
hook('onHurt', (dmg) => { if (G.run) G.run.floorDmg = (G.run.floorDmg || 0) + dmg; });
hook('preFloor', (run, idx) => {
  const F = CD.save.fs;
  if (idx > 0 && run.lastFloor === idx - 1) {
    if (!run.floorDmg && run.stats.cleared > (run.clearedAtFloor || 0)) F.untouched = (F.untouched || 0) + 1;
    if (run.prevOmens && run.prevOmens.length) F.omenFloors = (F.omenFloors || 0) + 1;
  }
  run.floorDmg = 0; run.lastFloor = idx; run.clearedAtFloor = run.stats.cleared;
});
hook('onFloor', () => { G.run.prevOmens = [...(G.run.omens || [])]; });
hook('runEnd', (run, won) => {
  const F = CD.save.fs;
  if (won) {
    F.winHeat = Math.max(F.winHeat || 0, run.heat);
    if (CLASS[run.cls] && CLASS[run.cls].beast) F.beastWins = (F.beastWins || 0) + 1;
    if (run.chaos) F.chaosWins = (F.chaosWins || 0) + 1;
    if (run.t < 25 * 60) F.fastWin = true;
  }
  checkFeats();
});
const _doAwaken = doAwaken;
doAwaken = function (p) { _doAwaken(p); const F = CD.save.fs; F.awakenings = (F.awakenings || 0) + 1; };

