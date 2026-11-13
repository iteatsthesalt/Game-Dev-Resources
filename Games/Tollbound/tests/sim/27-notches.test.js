// tests/sim/27-notches.test.js: finds in a vigil (src/js/27-notches.js): the postures of a toll period, the line each
// toll writes on every find carried and in the struck place of a worn find on a re-walk, the most the haul holds, the
// finds the dead drop, the heave and its bursts, ringing down with written finds, and the same run twice. The vigil's
// own files are loaded and booted as the page boots them (the other packages of the Household stay out, so that their
// work in the making cannot disturb these tests); tolls are made short with the run's rules where a test waits for one.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');

const FILES = ['00-core.js', '01-defs.js', '02-pool-grid.js', '10-stats.js', '11-damage.js', '12-items.js', '14-character.js', '16-savedata.js',
  '20-sim.js', '21-player.js', '22-enemies.js', '23-skills.js', '24-archetypes.js', '25-boss.js', '26-director.js', '27-favours.js', '27-notches.js',
  '28-bot.js', '29-world.js', '30-modes-curves.js', '31-change-ringer.js', '33-bases.js', '34-postures.js', '40-favours.js', '41-dial.js',
  '46-puppets-dial.js', '47-dial-ground.js', '48-puppets-test.js', '49-tilesets-test.js'];
const sim = loadSim({ only: FILES, boot: true });
const { Sim, Player, Items, Stats, Char, SaveData, Core, Defs } = sim;
const P = Stats.POSTURE;
const DT = 1 / 60;

// a run of the Change-ringer without a character; more: cfg fields (rules, mods, voices, zone)
function run(more) {
  const m = Object.assign({}, more), cls = Player.classRun('change-ringer');
  if (m.mods) cls.mods = cls.mods.concat(m.mods);
  delete m.mods;
  return Sim.create(Object.assign({ zone: 'debug', seed: 3 }, cls, m));
}
const still = () => ({ mx: 0, my: 0, ax: 1, ay: 0, aim: false, trade: false, heave: false });
// a find of the haul, made as the dead drop one, with k lines already written by a posture
function carried(S, base, k, posture) {
  const f = Items.make(base || 'base.oilskin', 1, -(++S.uid), 0.5), w = { rng: { loot: new Core.RNG(S.uid) }, toll: 1, sheet: S.sheet };
  for (let i = 0; i < (k || 0); i++) Items.write(w, f, posture || 'stood');
  return f;
}
function events(S, kind) {
  const out = [];
  for (let i = 0; i < S.eventCount; i++) {
    const e = S.events[(S.eventStart + i) % S.events.length];
    if (e.k === kind) out.push({ x: e.x, y: e.y, a: e.a, b: e.b, id: e.id });
  }
  return out;
}
// steps the run with an input made for each step until it has rung one toll more, and one step after (the system
// notices a toll in the step after it rang); returns the events of kind 'notch' of that step
function toNextToll(S, input) {
  const toll = S.toll;
  for (let i = 0; S.toll === toll && S.phase === 'play'; i++) Sim.step(S, input(i));
  Sim.step(S, input(-1));
  return events(S, 'notch');
}
// lays a find on the ground, dx metres east of the player, as the dead drop one
const lying = (S, find, dx) => Items.lay(S, find, S.player.x + (dx || 0), S.player.y);
// one of the dead that stands where it is put, and does not fall
function post(S, x, y) {
  const e = Sim.spawnEnemy(S, 'debug.husk', x, y, null);
  e.life = e.lifeMax = 1e6;
  e.speed = 0;
  return e;
}

// ---- the postures of a toll period ----

test('Items.period: the posture held most in the toll period, a tie to the earlier row, and timed at a landmark', () => {
  const S = run(), secs = S.notches.secs;
  assert.equal(Items.period(S), P.stood, 'a period spent in none of them is stood');
  secs[P.strode] = 10;
  secs[P.pressed] = 30;
  assert.equal(Items.period(S), P.pressed);
  secs[P.stood] = 30;
  assert.equal(Items.period(S), P.stood, 'stood and pressed held alike: the earlier row');
  secs[P.strode] = 31;
  assert.equal(Items.period(S), P.strode);
  // the Dial: the bell-post at its middle and five stones are its landmarks
  const D = run({ zone: 'dial' }), p = D.player;
  D.notches.secs[P.strode] = 50;
  p.x = 0; p.y = -21 + 3.9;
  assert.equal(Items.period(D), P.timed, 'within 4 m of the north stone');
  p.y = -21 + 4.2;
  assert.equal(Items.period(D), P.strode, 'not within 4 m');
  p.x = 3.5; p.y = 0;
  assert.equal(Items.period(D), P.timed, 'the bell-post is a landmark too');
  p.x = 21; p.y = 0;
  assert.equal(Items.period(D), P.strode, 'the stone of the east is no landmark');
  assert.equal(D.notches.n, 6, 'the Dial\'s six');
});

test('the seconds of a toll period are counted from the player\'s conditions, step by step, and begin again at each toll', () => {
  const S = run({ voices: [], rules: { tollSeconds: 20 } }), secs = S.notches.secs;
  for (let i = 0; i < 120; i++) Sim.step(S, still());
  assert.ok(Math.abs(secs[P.stood] - (2 - 0.4 - 0.25)) < 3 * DT, `Braced after 0.4 s, in the mask 0.25 s later: ${secs[P.stood]}`);
  assert.deepEqual([secs[P.strode], secs[P.pressed], secs[P.timed]], [0, 0, 0]);
  // a slow circle at full speed: Striding
  for (let i = 0; i < 180; i++) Sim.step(S, { mx: Math.cos(i / 30), my: Math.sin(i / 30), ax: 1, ay: 0, aim: false, trade: false, heave: false });
  assert.ok(secs[P.strode] > 2.2 && secs[P.strode] < 3, `Striding for most of three seconds: ${secs[P.strode]}`);
  // husks pressing round a player who keeps still: crowded and Braced both count
  const p = S.player;
  for (let k = 0; k < 5; k++) Sim.spawnEnemy(S, 'debug.husk', p.x + Math.cos(k * 1.25) * 1.2, p.y + Math.sin(k * 1.25) * 1.2, null);
  const was = secs[P.pressed];
  for (let i = 0; i < 120; i++) Sim.step(S, still());
  assert.ok(secs[P.pressed] - was > 1.5, `crowded: ${secs[P.pressed] - was}`);
  toNextToll(S, still);
  assert.ok(secs[P.stood] < 2 * DT && secs[P.strode] === 0 && secs[P.pressed] < 2 * DT, 'a toll begins the count again');
});

// ---- what a toll writes ----

test('each toll writes one line on every find carried with room, by the posture held most in the period', () => {
  const S = run({ voices: [], rules: { tollSeconds: 5 } });
  const a = carried(S, 'base.oilskin'), b = carried(S, 'base.tow-mitts', 3, 'timed'), full = carried(S, 'base.pattens', 8);
  const gone = carried(S, 'base.sand-glass');
  gone.gone = [0, 1, 2, 3, 4, 5, 6, 7];
  S.haul.push(a, b, full, gone);
  const before = plain(full.lines);
  const notes = toNextToll(S, still);
  assert.equal(S.toll, 1);
  assert.deepEqual([Char.notches(a), Char.notches(b), Char.notches(full), Char.notches(gone)], [1, 4, 8, 0], 'one line on each find with room');
  assert.deepEqual(plain(full.lines), before, 'a full find takes none');
  for (const l of [a.lines[0], b.lines[3]]) assert.deepEqual([l.posture, l.cond, l.toll, l.struck], ['stood', 'braced', 1, null], 'stood: it kept still');
  assert.deepEqual(notes.map((e) => [e.a, e.b, e.id]), [[0, P.stood, 'base.oilskin'], [3, P.stood, 'base.tow-mitts']], 'a notch event for each line');
  // the next period spent Striding writes strode lines, at the second toll's band
  const circle = (i) => ({ mx: Math.cos(i / 40), my: Math.sin(i / 40), ax: 1, ay: 0, aim: false, trade: false, heave: false });
  toNextToll(S, circle);
  assert.deepEqual([a.lines[1].posture, a.lines[1].cond, a.lines[1].toll], ['strode', 'striding', 2]);
  const band = Defs.get('posture', 'strode').verbs.find((v) => v.stat === a.lines[1].stat).band[1];
  assert.ok(a.lines[1].band[0] >= band[0] - 1e-9 && a.lines[1].band[1] <= band[1] + 1e-9, 'the second toll\'s band, on a find of level 1');
});

test('a toll at a landmark writes timed; a period in a crowd writes pressed', () => {
  const D = run({ zone: 'dial', voices: [], rules: { tollSeconds: 3 }, mods: [{ stat: 'life-max', op: 'flat', value: 1e6 }] });
  const f = carried(D);
  D.haul.push(f);
  D.player.x = 14.849242 - 1.5;                        // beside a stone between the quarters, a landmark
  D.player.y = -14.849242 + 1.5;
  D.player.px = D.player.x; D.player.py = D.player.y;
  toNextToll(D, still);
  assert.deepEqual([f.lines[0].posture, f.lines[0].cond], ['timed', 'after-quarter']);
  const S = run({ voices: [], rules: { tollSeconds: 4 } }), g = carried(S), p = S.player;
  S.haul.push(g);
  for (let k = 0; k < 6; k++) Sim.spawnEnemy(S, 'debug.husk', p.x + Math.cos(k) * 1.4, p.y + Math.sin(k) * 1.4, null);
  // a small slow circle: moving, so neither Braced nor Striding, with the husks pressing after
  toNextToll(S, (i) => ({ mx: 0.35 * Math.cos(i / 45), my: 0.35 * Math.sin(i / 45), ax: 1, ay: 0, aim: false, trade: false, heave: false }));
  assert.deepEqual([g.lines[0].posture, g.lines[0].cond], ['pressed', 'crowded']);
});

test('worn finds take a line only in the place struck for a re-walk, once; finds carried take theirs as ever', () => {
  const save = SaveData.blank(), c = Char.create(save, 'change-ringer', 'Agnes'), tool = c.worn.tool, coat = c.worn.coat;
  const w = { rng: { loot: new Core.RNG(5) }, toll: 1, sheet: { stats: { 'notch-size': 100 } } };
  for (let i = 0; i < 4; i++) { Items.write(w, tool, 'strode'); Items.write(w, coat, 'strode'); }
  assert.ok(Items.rewalk(tool, 2));
  const cfg = Char.begin(save, c.uid, 'debug', 9);
  cfg.rules = { tollSeconds: 5 };
  const S = Sim.create(cfg), runTool = S.cfg.char.worn.tool, runCoat = S.cfg.char.worn.coat, coatBefore = plain(runCoat.lines);
  const f = carried(S);
  S.haul.push(f);
  const notes = toNextToll(S, still);
  assert.deepEqual([runTool.lines[2] && runTool.lines[2].posture, runTool.walk, Char.notches(runTool)], ['stood', 2, 4], 'the struck place written anew');
  assert.deepEqual(plain(runCoat.lines), coatBefore, 'a worn find with no re-walk takes no line');
  assert.equal(Char.notches(f), 1);
  assert.deepEqual(notes.map((e) => e.id).sort(), ['base.bell-rope', 'base.oilskin']);
  assert.ok(S.mods.some((m) => m.stat === runTool.lines[2].stat && m.cond === 'braced'), 'the sheet was rebuilt with the new line');
  toNextToll(S, still);
  assert.deepEqual([Char.notches(runTool), Char.notches(f)], [4, 2], 'once: the next toll writes the haul only');
  assert.equal(plain(save.chars[0].worn.tool.lines)[2], null, 'the save keeps it from the next checkpoint, not before');
  S.result = Sim.end(S, 'left');
  Char.end(save, S);
  assert.deepEqual([Char.find(save, c.uid).worn.tool.walk, Char.find(save, c.uid).worn.tool.lines[2].posture], [-1, 'stood'], 'rung down: kept');
  assert.deepEqual(plain(SaveData.validate(save)), []);
});

// ---- the haul's limit ----

test('the haul holds at most 30 finds: one lying while it is full waits, held back, and the nearest is let go first', () => {
  const S = run({ voices: [] });
  assert.equal(Items.HAUL_MOST, 30);
  for (let i = 0; i < 30; i++) S.haul.push(carried(S));
  Sim.step(S, still());
  const near = lying(S, carried(S), 0.3), far = lying(S, carried(S), 1.6), farther = lying(S, carried(S), 2.2);
  for (let i = 0; i < 30; i++) Sim.step(S, still());
  assert.equal(S.haul.length, 30, 'full: nothing more is taken');
  assert.deepEqual([near.state, far.state, farther.state], [Items.FULL, Items.FULL, Items.FULL], 'all held back, and left lying');
  assert.ok(near.alive && far.alive && farther.alive);
  S.haul.length = 29;
  for (let i = 0; i < 30; i++) Sim.step(S, still());
  assert.deepEqual([S.haul.length, near.alive, far.state, farther.state], [30, false, Items.FULL, Items.FULL], 'room for one: the nearest');
  S.haul.length = 27;
  for (let i = 0; i < 60; i++) Sim.step(S, still());
  assert.deepEqual([S.haul.length, far.alive, farther.alive], [29, false, false], 'room for all: all taken');
  // a hold of another system (an observance's promise) is left as it is
  const kept = lying(S, carried(S), 0.2);
  kept.state = -1;
  for (let i = 0; i < 10; i++) Sim.step(S, still());
  assert.deepEqual([kept.state, kept.alive, S.haul.length], [-1, true, 29]);
});

// ---- the finds the dead drop ----

test('the dead drop finds where they fall: a keeper always, an elite by its odds, and find-chance scales them', () => {
  const kill = (S, rank, n) => {
    const out = [];
    for (let k = 0; k < n; k++) {
      const e = Sim.spawnEnemy(S, 'debug.husk', S.player.x + 9, S.player.y + k * 0.01, { rank });
      Sim.step(S, still());
      e.life = 0;
      Sim.step(S, still());
      out.push(...events(S, 'drop').filter((d) => d.a === 2));
    }
    return out;
  };
  const S = run({ voices: [] });
  const keeper = kill(S, Sim.BOSS, 1);
  assert.equal(keeper.length, 1, 'a keeper drops a find');
  const o = S.pickups.items.slice(0, S.pickups.n).find((q) => q.alive && q.kind === 2);
  const f = o.item, base = Defs.get('base', f.base);
  assert.ok(f.uid < 0 && f.level === 1 && base.level <= 1 && Char.notches(f) === 0 && o.ttl > 200, 'a blank find of the district\'s level, with a run\'s uid');
  assert.ok(Math.abs(o.x - (S.player.x + 9)) < 1 && keeper[0].b === 1, 'where the body fell');
  const many = run({ voices: [], mods: [{ stat: 'find-chance', op: 'flat', value: 900 }] });
  assert.equal(kill(many, Sim.ELITE, 2).length, 6, 'find-chance 1000%: an elite drops three');
  const none = run({ voices: [], mods: [{ stat: 'find-chance', op: 'flat', value: -100 }] });
  assert.equal(kill(none, Sim.BOSS, 2).length, 0, 'find-chance 0: nothing');
  const common = run({ voices: [], seed: 8 });
  const small = kill(common, Sim.COMMON, 400).length;
  assert.ok(small <= 8, `the small dead drop rarely: ${small} of 400`);
});

// ---- the heave ----

test('the heave throws the find with the most notches 5 m ahead; it bursts once a notch, 0.2 s apart, and lies blank', () => {
  const S = run({ voices: [] }), p = S.player;
  Sim.step(S, still());
  const zero = carried(S, 'base.oilskin', 0), five = carried(S, 'base.tow-mitts', 5), three = carried(S, 'base.pattens', 3, 'strode');
  S.haul.push(zero, five, three);
  const fixed = plain(five.fixed);
  post(S, p.x + 5, p.y);
  const hits = [], heave = Object.assign(still(), { heave: true });
  Sim.step(S, heave);
  const thrown = events(S, 'heave');
  assert.equal(thrown.length, 1);
  assert.ok(Math.abs(thrown[0].x - (p.x + 5)) < 0.2 && Math.abs(thrown[0].y - p.y) < 0.2 && thrown[0].a === 5, 'where it lands, and its notches');
  assert.deepEqual([S.haul.length, S.haul.indexOf(five), Math.abs(p.heaveCd - S.sheet.stats['heave-recharge']) < 2 * DT], [2, -1, true], 'out of the haul; heaveCd set');
  const o = S.pickups.items.slice(0, S.pickups.n).find((q) => q.alive && q.item === five);
  assert.ok(o && o.kind === 2, 'it lies where it fell');
  assert.deepEqual([Char.notches(five), five.walk, plain(five.fixed), five.base], [0, -1, fixed, 'base.tow-mitts'], 'blank: its base and fixed line remain');
  hits.push(...events(S, 'hit').map((h) => S.step));
  for (let i = 0; i < 90; i++) {
    Sim.step(S, still());
    for (const h of events(S, 'hit')) { hits.push(S.step); assert.ok(Math.abs(h.a - 9) < 1e-6 || Math.abs(h.a - 4.5) < 1e-6, `a burst: 9, or 4.5 on a Braced body: ${h.a}`); }
  }
  assert.equal(hits.length, 5, 'a burst for each notch');
  for (let k = 1; k < hits.length; k++) assert.equal(hits[k] - hits[k - 1], 12, '0.2 s apart');
  Sim.step(S, heave);
  assert.equal(events(S, 'heave').length, 0, 'not again until heave-recharge has run out');
  assert.equal(S.haul.length, 2);
});

test('a find with no notches lands once at half harm; an empty haul throws nothing; a heaved find is carried again', () => {
  const S = run({ voices: [] }), p = S.player;
  Sim.step(S, still());
  const zero = carried(S, 'base.oilskin', 0);
  S.haul.push(zero);
  const e = post(S, p.x + 5, p.y);
  assert.equal(Items.heave(S), true);
  let hits = [];
  for (let i = 0; i < 60; i++) { Sim.step(S, still()); hits = hits.concat(events(S, 'hit')); }
  assert.equal(hits.length, 1, 'once');
  assert.ok(Math.abs(hits[0].a - 4.5) < 1e-6 || Math.abs(hits[0].a - 2.25) < 1e-6, `at half harm: ${hits[0].a}`);
  assert.deepEqual([Items.heave(S), S.haul.length], [false, 0], 'nothing to throw');
  e.life = 0;
  for (let i = 0; i < 120 && S.haul.length === 0; i++) Sim.step(S, { mx: 1, my: 0, ax: 1, ay: 0, aim: false, trade: false, heave: false });
  assert.deepEqual([S.haul.length, S.haul[0], Char.notches(zero)], [1, zero, 0], 'walked over, it is carried again');
});

// ---- ringing down, and the same run twice ----

test('ringing down banks the finds with the lines the tolls wrote; Char.end gives them the save\'s uids in the chest', () => {
  const save = SaveData.blank(), c = Char.create(save, 'change-ringer', 'Agnes');
  const cfg = Char.begin(save, c.uid, 'debug', 4);
  cfg.rules = { tollSeconds: 4 };
  const S = Sim.create(cfg), p = S.player;
  S.haul.push(carried(S, 'base.oilskin'), carried(S, 'base.sand-glass', 2, 'timed'));
  toNextToll(S, still);
  toNextToll(S, still);
  const written = plain(S.haul.map((f) => f.lines));
  S.gate = { x: p.x, y: p.y, until: S.t + 25, far: false, ring: 0, strokes: 0 };
  for (let i = 0; i < 8 * 60 && S.phase === 'play'; i++) Sim.step(S, still());
  assert.deepEqual([S.result.outcome, S.haul.length, S.bank.finds.length], ['left', 0, 2], 'rung down, every find banked');
  const report = Char.end(save, S);
  assert.equal(report.finds, 2);
  const chest = save.chest.finds;
  assert.deepEqual(plain(chest.map((f) => f.lines)), written, 'with the lines the tolls wrote');
  assert.ok(chest.every((f) => f.uid > 0 && f.uid <= save.uid), 'and uids of the save');
  assert.deepEqual(plain(SaveData.validate(save)), []);
});

test('the same seed and the same inputs write the same lines, drop the same finds and give the same checksum', () => {
  const play = (seed) => {
    const S = run({ zone: 'dial', seed, rules: { tollSeconds: 20 }, mods: [{ stat: 'find-chance', op: 'flat', value: 400 }] });
    S.haul.push(carried(S, 'base.oilskin'), carried(S, 'base.bell-rope'));
    for (let i = 0; i < 60 * 70 && S.phase === 'play'; i++) {
      Sim.step(S, sim.Bot.input(S, 'vigil'));
      if (i === 60 * 50 && S.haul.length > 0) Items.heave(S);
    }
    return { hash: Sim.hash(S), finds: JSON.stringify(plain(S.haul)) + JSON.stringify(plain(S.bank.finds)), toll: S.toll };
  };
  const a = play(21), b = play(21), c = play(22);
  assert.ok(a.toll >= 3, `three tolls and more: ${a.toll}`);
  assert.equal(a.hash, b.hash);
  assert.equal(a.finds, b.finds);
  assert.notEqual(a.finds, c.finds);
});
