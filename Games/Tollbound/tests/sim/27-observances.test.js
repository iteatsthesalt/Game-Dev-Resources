// tests/sim/27-observances.test.js: observances in a vigil (src/js/27-observances.js) and their content
// (src/js/36-observances.js): Heed held and freed (Char.hold, Char.release, Char.heed), the warning free Heed gives
// (Dmg.warning in a vigil, Observances.warning at the Lantern), each of the six promises kept and broken by its own
// rule and mended at the next toll, a broken observance's modifiers stopping while its Heed stays held, the voices and
// knots the dead leave going to the run's character at once, and the same seed giving the same run.
// The kernel, the combat package's files, Char and SaveData, and this package's files; no director, so the dead stand
// where they are put (speed 0) and nothing spawns.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');

const FILES = ['00-core.js', '01-defs.js', '02-pool-grid.js', '10-stats.js', '11-damage.js', '14-character.js', '16-savedata.js', '20-sim.js',
  '21-player.js', '23-skills.js', '24-archetypes.js', '27-observances.js', '29-world.js', '30-modes-curves.js', '31-change-ringer.js',
  '35-knots.js', '36-observances.js'];
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
const frame = (mx = 0, my = 0) => ({ mx, my, ax: 1, ay: 0, aim: false, trade: false, heave: false });
const STILL = frame();

const sim = loadSim({ only: FILES });
const { Sim, Defs, Stats, Char, SaveData, Observances, Dmg, Items, Favours } = sim;
Defs.add('enemy', {
  id: 'o.body', name: 'Body', puppet: 'o.body', radius: 0.4, life: 100, damage: 5, speed: 0, xp: 1, cost: 1, loot: null, ai: 'chase', aiParams: {},
  attacks: [], guard: { blow: 0, drag: 0 }, size: 'small', press: 0, tags: [],
});
Defs.add('prop', { id: 'o.post', puppet: 'o.post', radius: 0.75, role: 'bell-post' });
Defs.add('zone', Object.assign({}, plain(Defs.get('zone', 'debug')), {
  id: 'o.ground', start: { x: 0, y: 8 }, place: [{ prop: 'o.post', x: 0, y: 0, role: 'bell-post' }],
}));

const all = (S) => Array.from({ length: S.eventCount }, (u, i) => plain(S.events[(S.eventStart + i) % S.events.length]));
function steps(S, n, f = STILL) { const out = []; for (let i = 0; i < n; i++) { Sim.step(S, f); out.push(...all(S)); } return out; }
const promises = (out) => out.filter((e) => e.k === 'promise').map((e) => [e.id, e.a]);
const damage = (S) => Stats.query(S.mods, 'damage', [], 0);
const spawn = (S, x, y, opts) => Sim.spawnEnemy(S, 'o.body', x, y, opts);

// a character of the Household that keeps these observances, gone down into a vigil; its voices are left out of the
// loadout so that nothing but the promises happens
function vigil(kept, more = {}) {
  const save = SaveData.blank(), c = Char.create(save, 'change-ringer', 'Ada Vowell');
  for (const id of kept) { assert.ok(Char.learn(c, id)); assert.ok(Char.hold(c, id, save.account), `it can keep ${id}`); }
  c.loadout = [null, null, null, null, null, null];
  const cfg = Char.begin(save, c.uid, more.zone || 'o.ground', more.seed || 1);
  if (more.toll) cfg.rules = { tollSeconds: more.toll };
  return { save, c, S: Sim.create(cfg) };
}
// a find lying at (x, y), as the finds' package drops one
function find(S, x, y) {
  const o = S.pickups.alloc();
  o.kind = 2; o.value = 1; o.x = o.px = x; o.y = o.py = y; o.r = 0.25; o.ttl = 300; o.state = 0;
  o.item = { uid: -(++S.uid), base: 'o.find', level: 1, fixed: null, lines: [null, null, null, null, null, null, null, null], gone: [], walk: -1, cool: 0 };
  return o;
}
function coin(S, x, y) {
  const o = S.pickups.alloc();
  o.kind = 1; o.value = 1; o.x = o.px = x; o.y = o.py = y; o.r = 0.25; o.ttl = 300; o.item = null;
  return o;
}
const at = (S, x, y) => { S.player.x = S.player.px = x; S.player.y = S.player.py = y; };
// something done inside the next step, as the dead's Blows land and the finds' package drops finds: through the heave,
// which Player.step asks for (in phase 1) when this world has an Items.heave
function during(S, fn, f = STILL) {
  Items.heave = function (T) { fn(T); return false; };
  const out = steps(S, 1, Object.assign({}, f, { heave: true }));
  delete Items.heave;
  return out;
}
// a find dropped as 27-notches.js drops one: after the player's pickups (phase 10) and before this package's system,
// through Favours.step (phase 11), which this world lacks
function dropped(S, x, y) {
  let o = null;
  Favours.step = function (T) { o = find(T, x, y); };
  steps(S, 1);
  delete Favours.step;
  return o;
}

// ---- the content ----

test('the six observances the design names: the Heed each holds, a promise its registry allows, no "more"', () => {
  assert.deepEqual(plain(Defs.finalize()), []);
  const heed = Object.fromEntries(Defs.all('observance').map((o) => [o.id, o.heed]));
  assert.deepEqual(heed, { stability: 30, 'unbroken-round': 35, alms: 25, 'telling-the-bees': 30, 'full-mourning': 40, 'hand-on-the-bell': 40 });
  for (const o of Defs.all('observance')) {
    assert.ok(Defs.ENUMS.promise.includes(o.promise), `${o.id}: its promise is registered`);
    assert.ok(o.mods.every((m) => m.op !== 'more'), `${o.id} uses no "more"`);
    assert.equal(o.aura, null);
  }
  assert.ok(Defs.ENUMS.event.includes('promise') && Defs.ENUMS.event.includes('found'), 'its events may be counted by bequests');
});

// ---- Heed ----

test('Heed held and freed: an observance is kept only while free Heed allows it, and letting it go frees its Heed', () => {
  const save = SaveData.blank(), c = Char.create(save, 'change-ringer', 'Ada');
  for (const o of Defs.all('observance')) Char.learn(c, o.id);
  assert.deepEqual(plain(Char.heed(c, save.account)), { max: 100, held: 0, free: 100 });
  assert.ok(Char.hold(c, 'full-mourning', save.account) && Char.hold(c, 'hand-on-the-bell', save.account));
  assert.deepEqual(plain(Char.heed(c, save.account)), { max: 100, held: 80, free: 20 });
  assert.equal(Char.hold(c, 'stability', save.account), false, '30 Heed held of the 20 free: refused');
  assert.ok(Char.release(c, 'hand-on-the-bell'));
  assert.ok(Char.hold(c, 'stability', save.account));
  assert.deepEqual(plain(Char.heed(c, save.account)), { max: 100, held: 70, free: 30 });
  const fresh = Char.create(save, 'change-ringer', 'Bel');
  assert.equal(Char.hold(fresh, 'stability', save.account), false, 'only an observance it knows');
  assert.deepEqual(plain(SaveData.validate(save)), []);
});

test('warning time from free Heed: each free point shows a Swell 0.01 s sooner, never more than 1 s; at the Lantern the same', () => {
  const none = vigil([]), some = vigil(['full-mourning', 'stability']);
  near(Dmg.warning(none.S, null, 'o.attack'), 1, 1e-9, 'all 100 free: the most there is');
  near(Dmg.warning(some.S, null, 'o.attack'), 0.3, 1e-9, '70 held, 30 free');
  near(Observances.warning(some.c, some.save.account), 0.3, 1e-9);
  near(Observances.warning(none.c, none.save.account), 1, 1e-9);
  // a broken promise stops the observance's modifiers, not the Heed it holds
  const S = some.S;
  steps(S, 1);
  at(S, 30, 30);
  steps(S, 1);
  assert.equal(S.observances.broken.stability, true);
  near(Dmg.warning(S, null, 'o.attack'), 0.3, 1e-9);
});

// ---- the promises ----

test('stability: kept within 12 m of where the last toll found you; broken outside it until the next toll draws the ring again', () => {
  const { S } = vigil(['stability'], { toll: 5 });
  steps(S, 1);
  near(damage(S), 125, 1e-9);
  const ring = S.observances.of.stability;
  assert.deepEqual([ring.x, ring.y], [0, 8], 'where the vigil began');
  at(S, 11.5, 8);
  assert.deepEqual(promises(steps(S, 1)), [], '11.5 m: kept');
  at(S, 12.5, 8);
  assert.deepEqual(promises(steps(S, 1)), [['stability', 0]]);
  near(damage(S), 100, 1e-9, 'its modifiers stop at once');
  assert.deepEqual(promises(steps(S, 60)), [], 'broken once, it stays broken quietly');
  const out = steps(S, 240);                                  // to the toll at 5 s
  assert.deepEqual(promises(out), [['stability', 1]]);
  assert.deepEqual([ring.x, ring.y], [12.5, 8], 'the ring is drawn again where the toll found you');
  near(damage(S), 125, 1e-9);
});

test('the unbroken round: each toll that finds the bell-post touched adds 5% harm and 2% speed, to eight; a miss empties it', () => {
  const { S } = vigil(['unbroken-round'], { toll: 4 });
  const speed = () => Stats.query(S.mods, 'speed', [], 0);
  steps(S, 1);
  at(S, 0, 1.6);                                              // the post is 0.75 m round, the player 0.4 m: edges 0.45 m apart
  steps(S, 1);
  at(S, 0, 8);
  steps(S, 240);                                              // the first toll
  near(damage(S), 105, 1e-9);
  near(speed(), 102, 1e-9);
  const out = steps(S, 240);                                  // a period without a touch
  assert.deepEqual(promises(out), [['unbroken-round', 0]]);
  near(damage(S), 100, 1e-9);
  at(S, 1.5, 0);
  steps(S, 1);
  at(S, 0, 8);
  const back = steps(S, 239);                                 // the third toll mends it, and counts the period touched
  assert.deepEqual(promises(back), [['unbroken-round', 1]]);
  near(damage(S), 105, 1e-9);
  S.observances.of['unbroken-round'].n = 8;
  at(S, 0, 1.6);
  steps(S, 241);
  near(damage(S), 140, 1e-9, 'eight at most');
  near(speed(), 116, 1e-9);
});

test('alms: the first find of each toll period is left lying as a cairn, 5% more experience each; walking back onto one breaks it', () => {
  const { S } = vigil(['alms'], { toll: 10 });
  const xp = () => Stats.query(S.mods, 'xp-gain', [], 0);
  steps(S, 1);
  const first = dropped(S, 1, 8);                             // it falls right beside the player
  assert.equal(first.state, Observances.CAIRN);
  assert.ok(first.ttl > 1e5, 'a cairn stands for the vigil');
  near(xp(), 105, 1e-9);
  const second = find(S, 0.5, 8);
  steps(S, 2);
  assert.ok(!second.alive && S.haul.length === 1, 'the second find of the period is picked up as any is');
  assert.equal(first.alive && first.state < 0, true, 'standing on the cairn takes nothing before you have left it');
  at(S, 6, 8);
  steps(S, 1);
  assert.equal(first.state, Observances.LEFT_CAIRN);
  at(S, 1.2, 8);
  const out = steps(S, 1);
  assert.deepEqual(promises(out), [['alms', 0]]);
  steps(S, 1);
  assert.ok(!first.alive && S.haul.length === 2, 'taken back');
  near(xp(), 100, 1e-9);
  const late = find(S, 20, 8);
  steps(S, 2);
  assert.equal(late.state, 0, 'while broken nothing is left as alms');
  steps(S, 600);
  const next = find(S, 20, 20);
  steps(S, 1);
  assert.equal(next.state, Observances.CAIRN, 'after the toll the first find of the new period is the alms');
  // a find the player heaves is not the alms of its period
  const heave = vigil(['alms']);
  let thrown = null;
  during(heave.S, (T) => {
    thrown = find(T, T.player.x + 5, T.player.y);
    Sim.emit(T, 'heave', thrown.x, thrown.y, 0, 0, null);
  });
  assert.ok(thrown.alive && thrown.state === 0);
  assert.equal(heave.S.observances.cairns, 0);
});

test('telling the bees: a hive fetches within 10 m; a death of the great told by standing still drives the five nearest back', () => {
  const { S } = vigil(['telling-the-bees'], { toll: 30 });
  steps(S, 1);
  const hand = S.sheet.stats.hand;
  near(S.sheet.stats['pickup-reach'], (2.5 + 7.5) * (1 + hand / 100), 1e-9);
  const ring = [];
  for (let i = 0; i < 6; i++) ring.push(spawn(S, Math.cos(i) * (2 + i * 0.4), 8 + Math.sin(i) * (2 + i * 0.4)));
  const elite = spawn(S, 20, 8, { rank: Sim.ELITE });
  steps(S, 5, frame(1, 0));
  at(S, 0, 8);
  const before = ring.map((e) => Math.hypot(e.x, e.y - 8));
  elite.life = 0;
  steps(S, 1, frame(1, 0));
  assert.ok(S.observances.of['telling-the-bees'].t > 0, 'a death to tell');
  at(S, 0, 8);
  const told = steps(S, 61);                                  // a second still: told
  assert.deepEqual(promises(told), []);
  const after = ring.map((e) => Math.hypot(e.x, e.y - 8));
  for (let i = 0; i < 5; i++) near(after[i] - before[i], 3, 0.05);
  near(after[5], before[5], 1e-9, 'the sixth is not driven');
  // a death left untold: the bees leave with what they were fetching
  const elite2 = spawn(S, 25, 8, { rank: Sim.ELITE });
  elite2.life = 0;
  const fetching = coin(S, 40, 8), mine = coin(S, 60, 8);
  let out = [];
  for (let i = 0; i < 660; i++) { at(S, 40 + (i % 2) * 0.01 - 5, 8); out = out.concat(promises(steps(S, 1, frame(i % 2 ? 1 : -1, 0)))); }
  assert.deepEqual(out, [['telling-the-bees', 0]]);
  assert.ok(!fetching.alive, 'the coin within the hive\'s reach went with the bees');
  assert.ok(mine.alive, 'what lay beyond it stays');
  near(S.sheet.stats['pickup-reach'], 2.5 * (1 + hand / 100), 1e-9, 'until the toll, no hive');
});

test('full mourning: unseen beyond 7 m and no coin while black, finds held in every grade; grey at the third toll, lavender at the sixth', () => {
  const { S } = vigil(['full-mourning'], { toll: 2 });
  steps(S, 1);
  assert.equal(S.observances.sight, 7);
  assert.equal(S.sheet.flags['full-mourning'], true, 'the flag of full mourning: no coin is picked up');
  const c1 = coin(S, 0.5, 8), f1 = dropped(S, -0.6, 8);
  steps(S, 2);
  assert.ok(c1.alive && f1.alive && f1.state === Observances.MOURNED, 'neither is taken');
  at(S, 10, 8);
  steps(S, 1);
  assert.equal(f1.state, Observances.LEFT_MOURNED);
  at(S, -0.2, 8);
  const broke = steps(S, 1);
  assert.deepEqual(promises(broke), [['full-mourning', 0]]);
  steps(S, 2);
  assert.ok(!f1.alive && !c1.alive, 'broken: the find taken back, and the coin with it');
  assert.equal(S.observances.sight, 0);
  steps(S, 240);                                              // past the first and second tolls
  assert.equal(S.observances.sight, 7);
  steps(S, 120);                                              // the third toll
  assert.equal(S.observances.sight, 10, 'grey');
  assert.notEqual(S.sheet.flags['full-mourning'], true, 'coin is allowed again');
  const c2 = coin(S, S.player.x + 0.5, S.player.y);
  steps(S, 2);
  assert.ok(!c2.alive);
  steps(S, 360);
  assert.equal(S.observances.sight, 14, 'lavender');
  const f2 = dropped(S, S.player.x + 0.5, S.player.y);
  steps(S, 2);
  assert.ok(f2.alive && f2.state === Observances.MOURNED, 'finds are held in every grade');
});

test('hand on the bell: no Drag reaches you and nothing shoves you; a Blow over a fifth of your life breaks it and scars', () => {
  const { S } = vigil(['hand-on-the-bell'], { toll: 5 });
  steps(S, 1, frame(1, 0));
  const D = Stats.TYPE.drag, most = S.sheet.stats['life-max'], p = S.player;
  assert.equal(S.sheet.taken[D], 0);
  const x = p.x;
  assert.equal(Dmg.shove(S, p, 2, 0), 0);
  assert.equal(p.x, x);
  const blow = { id: 'o.blow', type: 'blow', mult: 1 }, hit = (d) => (T) => Dmg.hitPlayer(T, blow, { damage: d, x: T.player.x + 1, y: T.player.y }, 1, 0.5);
  assert.deepEqual(promises(during(S, hit(10), frame(1, 0))), [], 'a fifth of 70 is 14: kept');
  const out = during(S, hit(40), frame(1, 0));
  assert.deepEqual(promises(out), [['hand-on-the-bell', 0]]);
  near(S.observances.scarred, (40 - 0.2 * most) / 2, 1e-9);
  assert.ok(out.some((e) => e.k === 'scar' && e.id === 'hand-on-the-bell'));
  near(S.sheet.stats['life-max'], most - (40 - 0.2 * most) / 2, 1e-9, 'the scar comes off greatest life');
  assert.equal(S.sheet.taken[D], 1, 'broken: Drag reaches you again');
  const back = steps(S, 300, frame(1, 0));
  assert.deepEqual(promises(back), [['hand-on-the-bell', 1]]);
  assert.equal(S.sheet.taken[D], 0);
  near(S.sheet.stats['life-max'], most - (40 - 0.2 * most) / 2, 1e-9, 'the scar lasts the vigil');
});

test('a broken observance\'s modifiers leave the sheet (Char.mods reads S.observances.broken), the others stay', () => {
  const { S } = vigil(['stability', 'telling-the-bees'], { toll: 30 });
  steps(S, 1);
  const reach = S.sheet.stats['pickup-reach'];
  at(S, 40, 8);
  steps(S, 1);
  assert.deepEqual(plain(S.observances.broken), { stability: true });
  near(damage(S), 100, 1e-9);
  near(S.sheet.stats['pickup-reach'], reach, 1e-9);
  const mods = Char.mods(S.cfg.char, S, S.cfg.account);
  assert.ok(!mods.some((m) => m.stat === 'damage' && m.value === 25) && mods.some((m) => m.stat === 'pickup-reach' && m.value === 7.5));
});

// ---- what the dead leave ----

test('what the dead leave: an elite now and then, a keeper always, a voice or a knot of the district\'s tier, at once', () => {
  const { S, save, c } = vigil([], { toll: 30 });
  const char = S.cfg.char, voices = char.voices.length, loot = plain(S.rng.loot.getState());
  steps(S, 1);
  assert.equal(Observances.leave(S, Sim.COMMON, 1, 1), null, 'the common dead leave nothing');
  const got = [];
  let elites = 0;
  for (let i = 0; i < 300; i++) if (Observances.leave(S, Sim.ELITE, 2, 3) !== null) elites++;
  assert.ok(elites > 60 && elites < 120, `about 3 in 10 elites leave something (${elites} of 300)`);
  for (let i = 0; i < 60; i++) got.push(Observances.leave(S, Sim.BOSS, 2, 3));
  assert.ok(got.every((d) => d !== null), 'a keeper always does');
  const kinds = new Set(got.map((d) => (Defs.has('voice', d.id) && Defs.get('voice', d.id) === d ? 'voice' : 'knot')));
  assert.deepEqual([...kinds].sort(), ['knot', 'voice']);
  assert.ok(got.every((d) => d.tier <= 2), 'the debug ground is the first place: tier 1, and 2 from a keeper');
  assert.ok(char.voices.length > voices && char.voices.slice(voices).every((v) => v.uid < 1 && v.level === 1 && v.rope === 2));
  assert.deepEqual(plain(char.loadout), [null, null, null, null, null, null], 'a voice found is held, not placed');
  assert.ok(Object.keys(char.knots).length > 0);
  assert.deepEqual(plain(S.rng.loot.getState()), loot, 'the finds\' own stream is not moved');
  // the save keeps them from the next checkpoint, each found voice with a uid of the save
  Char.checkpoint(save, S);
  const kept = save.chars.find((x) => x.uid === c.uid);
  assert.ok(kept.voices.every((v) => v.uid >= 1) && kept.voices.length === char.voices.length);
  assert.deepEqual(plain(SaveData.validate(save)), []);
  // a character holding the most voices a save allows finds knots only
  while (char.voices.length < Observances.VOICES_MOST) char.voices.push(Char.voice(-(++S.uid), 'hand-bell'));
  for (let i = 0; i < 30; i++) Observances.leave(S, Sim.BOSS, 0, 0);
  assert.equal(char.voices.length, Observances.VOICES_MOST);
});

test('in a vigil: a keeper or an elite laid leaves its voice or knot where it fell, with an event \'found\'', () => {
  const { S } = vigil([], { toll: 30 });
  steps(S, 1);
  const keeper = spawn(S, 5, 8, { rank: Sim.BOSS });
  keeper.life = 0;
  const out = steps(S, 1).filter((e) => e.k === 'found');
  assert.equal(out.length, 1);
  assert.deepEqual([out[0].x, out[0].y], [5, 8]);
  const def = out[0].a === 0 ? Defs.get('voice', out[0].id) : Defs.get('knot', out[0].id);
  assert.ok(def.tier <= 2);
  const char = S.cfg.char;
  if (out[0].a === 0) assert.ok(char.voices.some((v) => v.id === def.id && v.uid < 1));
  else assert.ok(char.knots[def.id] >= 1);
});

// ---- the same seed, the same run ----

function play(seed) {
  const { S } = vigil(['stability', 'alms', 'hand-on-the-bell'], { toll: 6, seed });
  S.cfg.char.loadout[0] = S.cfg.char.voices[0].uid;
  S.dirty = true;
  for (let i = 0; i < 40; i++) spawn(S, Math.cos(i) * (3 + i % 9), 8 + Math.sin(i) * (3 + i % 9), i % 10 === 0 ? { rank: Sim.ELITE } : undefined);
  const out = [];
  for (let i = 0; i < 1200; i++) {
    if (i % 97 === 0) find(S, S.player.x + 2, S.player.y);
    if (i % 300 === 150) for (const e of S.enemies.items.slice(0, S.enemies.n)) if (e.alive && e.rank > 0) { e.life = 0; break; }
    Sim.step(S, frame(Math.sin(i / 50), Math.cos(i / 80)));
    out.push(...all(S).filter((e) => e.k === 'promise' || e.k === 'found'));
  }
  return { S, out };
}

test('the same seed twice gives the same vigil of a character with observances, and the same leavings', () => {
  const a = play(5), b = play(5);
  assert.equal(Sim.hash(a.S), Sim.hash(b.S));
  assert.deepEqual(a.out, b.out);
  assert.ok(a.out.some((e) => e.k === 'promise'));
  assert.deepEqual(plain(a.S.cfg.char.knots), plain(b.S.cfg.char.knots));
  assert.deepEqual(plain(a.S.cfg.char.voices.map((v) => v.id)), plain(b.S.cfg.char.voices.map((v) => v.id)));
});
