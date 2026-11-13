// tests/sim/14-character.test.js: a character of the Household (src/js/14-character.js), by the rules of
// docs/design/04-progression.md. Most tests load the kernel, 14-character.js and 16-savedata.js alone, with content of
// their own (a class, its voices, a corner of the Plan, bases, pits, a gift, observances, knots), so they test what
// Char itself does and never meet the content or the systems the packages of Stage 2 add (Tree.mods, Items.mods and
// Bellframe.mods take over from Char's plain readings when they arrive). The last tests play a whole life in the Dial
// with every module below 50, as the page boots them.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');

const { world, line, ended } = require('./household.js');
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);

const W = world(), { Char, SaveData, Stats, Defs, Sim } = W;
const fresh = () => SaveData.blank();
const sheet = (char, account) => Char.sheet(char, account).stats;

// ---- a new character ----

test('a new character: level 1, its door, its voices in the places level 1 opens, its starting gear worn blank', () => {
  const save = fresh(), c = Char.create(save, 'test.ringer', '  Agnes Toll ');
  assert.ok(c !== null && save.chars.length === 1 && save.chars[0] === c);
  assert.deepEqual([c.name, c.class, c.level, c.xp, c.planPoints, c.calling, c.tolls, c.vigils, c.mourning], ['Agnes Toll', 'test.ringer', 1, 0, 0, null, 0, 0, null]);
  assert.deepEqual(plain(c.plan), { walk: ['test.door'], choice: {} }, 'the route starts at its class\'s door, which costs nothing');
  assert.deepEqual(plain(c.voices.map((v) => v.id)), ['test.toll', 'test.tell', 'test.weight']);
  assert.deepEqual(plain(c.voices[0]), { uid: c.voices[0].uid, id: 'test.toll', level: 1, rope: 2, knots: [null, null], tolls: 0 });
  assert.deepEqual(plain(c.loadout), [c.voices[0].uid, null, null, null, null, null], 'level 1 opens one place (places open at 1, 3, 8, 15, 25, 35)');
  assert.deepEqual(plain(Object.keys(c.worn)), ['tool', 'hat', 'coat', 'hands', 'girdle', 'pattens', 'token-1', 'token-2']);
  assert.deepEqual(plain(c.worn.tool), { uid: c.worn.tool.uid, base: 'test.rope', level: 1, fixed: { stat: 'pull-window', op: 'flat', value: 0.05 },
    lines: [null, null, null, null, null, null, null, null], gone: [], walk: -1, cool: 0 }, 'found blank, with only its fixed line');
  assert.equal(c.worn.coat.fixed.value, 2, 'a range made without a roll stands in its middle');
  const uids = [c.uid, ...c.voices.map((v) => v.uid), c.worn.tool.uid, c.worn.coat.uid];
  assert.deepEqual(uids.slice().sort((a, b) => a - b), [1, 2, 3, 4, 5, 6], 'one counter of the save gives every uid');
  assert.equal(save.uid, 6);
  assert.deepEqual(plain(SaveData.validate(save)), [], 'and the save holding it is sound');
  assert.equal(Char.find(save, c.uid), c);
  assert.equal(Char.find(save, 99), null);
});

test('a character is made only of an open class, with a name of 1 to 24 letters, ringing hung bells it has places for', () => {
  const save = fresh();
  assert.equal(Char.create(save, 'test.locked', 'Bram'), null, 'a class opened by a bequest');
  assert.deepEqual(plain(Char.classes(save)), ['test.ringer']);
  save.account.open.classes.push('test.locked');
  assert.ok(Char.create(save, 'test.locked', 'Bram') !== null, 'once the bequest has opened it');
  assert.deepEqual(plain(Char.classes(save)), ['test.ringer', 'test.locked']);
  for (const bad of ['', '   ', 'x'.repeat(25), 'tab\there', 5, null]) assert.equal(Char.create(save, 'test.ringer', bad), null, JSON.stringify(bad));
  assert.equal(Char.create(save, 'no.such', 'Cass'), null);
  // bells: hung ones only, none twice, no more than the places bought
  save.account.frame.bells.push({ uid: 50, of: 40, name: 'Old', class: 'test.ringer', calling: null, weight: 8, gift: 'test.gift', pit: null, double: false, known: [] });
  save.uid = 60;
  assert.equal(Char.create(save, 'test.ringer', 'Cass', [50]), null, 'a bell not yet hung');
  save.account.frame.bells[0].pit = 'test.tenor';
  assert.equal(Char.create(save, 'test.ringer', 'Cass', [50, 50]), null);
  assert.equal(Char.create(save, 'test.ringer', 'Cass', [51]), null);
  save.away = { char: 1, zone: 'debug', seed: 1, hum: 0, heard: 0, level: 1, tolls: 0 };
  assert.equal(Char.create(save, 'test.ringer', 'Cass', [50]), null, 'not while a vigil is under way');
  save.away = null;
  const made = Char.create(save, 'test.ringer', 'Cass', [50]);
  assert.deepEqual(plain(made.bells), [50]);
  assert.equal(save.chars.length, 2);
});

// ---- the modifiers a character brings ----

test('Char.mods: the class at its level, its base, and the plain Plan: each node of the route once for each time it holds it', () => {
  const save = fresh(), c = Char.create(save, 'test.ringer', 'Agnes');
  let st = sheet(c, save.account);
  assert.deepEqual([st.hand, st.knee, st['life-max']], [10, 5, 60 + 10 + 2 * 5 + 4], 'Hand 10, Knee 5; life 60, its base +10, Knee 2 a point, the tenor pit +4');
  c.level = 6;
  st = sheet(c, save.account);
  assert.deepEqual([st.hand, st.knee], [10 + 2 * 5, 5 + 5], 'each level gives 2 and 1');
  assert.equal(Char.weapon(c), null, 'no tool is a weapon');
  // the route: the lane gives the attribute chosen; the corner its stat; the square doubled, twice
  assert.ok(Char.allocate(c, 'test.lane', 'knee') && Char.allocate(c, 'test.corner') && Char.allocate(c, 'test.square') && Char.allocate(c, 'test.lane'));
  assert.ok(Char.allocate(c, 'test.square'), 'the square again: doubled');
  const mods = Char.mods(c, null, save.account);
  assert.equal(mods.filter((m) => m.stat === 'knee' && m.op === 'flat' && m.value === 1).length, 2, 'the lane, walked twice, gives its point twice');
  assert.equal(mods.filter((m) => m.stat === 'damage' && m.op === 'more').length, 2);
  st = sheet(c, save.account);
  assert.deepEqual([st.knee, st.taken], [12, 120], 'Knee 10 and the doubled lane\'s 2; taken +10% twice');
});

test('Char.mods: the finds worn, each line by its posture, at the share of the attribute that wrote most of it', () => {
  const save = fresh(), c = Char.create(save, 'test.ringer', 'Agnes'), rope = c.worn.tool;
  // two lines written stood (Knee) and one strode: a find of three notches wants 12 Knee; Knee 5 gives a share of 5/12
  rope.lines[0] = line('stood', 'damage', 12);
  rope.lines[2] = line('stood', 'mend-rate', 24, { tags: ['round'] });
  rope.lines[5] = line('strode', 'move-speed', 6, { backward: true });
  const out = Char.mods(c, null, save.account), k = 5 / 12;
  const mine = out.slice(-5);
  assert.deepEqual(plain(mine[0]), { stat: 'pull-window', op: 'flat', value: 0.05 }, 'the fixed line, in full');
  assert.deepEqual(plain(mine.slice(1, 4)), [
    { stat: 'damage', op: 'inc', value: 12 * k, cond: 'braced' },
    { stat: 'mend-rate', op: 'inc', value: 24 * k, tags: ['round'], cond: 'braced' },
    { stat: 'move-speed', op: 'inc', value: 6 * k, unless: 'striding' },
  ], 'each line works only while its posture holds; one cut backward while it does not');
  assert.deepEqual(plain(mine[4]), { stat: 'guard.blow', op: 'flat', value: 2 }, 'the jerkin, with no lines, wants nothing');
  // the chisel: a struck word, and the line works always (or for everything) at 60%
  rope.lines[0].struck = 'condition';
  rope.lines[2].struck = 'object';
  const struck = Char.mods(c, null, save.account).slice(-4, -1);
  assert.deepEqual(plain(struck[0]), { stat: 'damage', op: 'inc', value: 12 * k * 0.6 });
  assert.deepEqual(plain(struck[1]), { stat: 'mend-rate', op: 'inc', value: 24 * k * 0.6, cond: 'braced' });
  // enough Knee, and every line works in full
  c.level = 8;                                          // Knee 5 + 7 = 12
  near(Char.mods(c, null, save.account).slice(-4)[2].value, 6);
  assert.equal(Char.notches(rope), 3);
  // a tie between postures goes to the one written first
  const tie = { fixed: null, lines: [line('timed', 'warn', 1), line('pressed', 'damage', 4), null, null, null, null, null, null] };
  const outs = Char.findMods(tie, { knee: 0, heel: 0, hand: 8, ear: 2 }, []);
  near(outs[0].value, 1 * Stats.share(2, 8), 1e-12);
});

test('Char.mods: observances kept, but not while their promise is broken; mourning; the calling\'s nodes', () => {
  const save = fresh(), c = Char.create(save, 'test.ringer', 'Agnes');
  c.known.push('test.stability', 'test.alms');
  c.observances.push('test.stability', 'test.alms');
  const S = { toll: 2, player: { conds: 0 }, observances: { broken: { 'test.alms': true } } };
  const out = Char.mods(c, S, save.account);
  assert.equal(out.filter((m) => m.stat === 'damage' && m.value === 25).length, 1, 'Stability holds');
  assert.equal(out.filter((m) => m.stat === 'xp-gain').length, 0, 'Alms broke its promise until the next toll');
  assert.equal(Char.mods(c, null, save.account).filter((m) => m.stat === 'xp-gain').length, 1, 'between vigils every promise stands');
  // mourning: the first half of the term full (50% more Hum, no coin), the rest half (25% more)
  c.mourning = { term: 3, left: 3 };
  assert.equal(Char.mourning(c), 'full');
  let st = Char.sheet(c, save.account);
  assert.deepEqual([st.stats['hum-gain'], st.flags['full-mourning']], [150, true]);
  c.mourning.left = 2;
  assert.equal(Char.mourning(c), 'full', 'a term of 3: two vigils full');
  c.mourning.left = 1;
  st = Char.sheet(c, save.account);
  assert.deepEqual([Char.mourning(c), st.stats['hum-gain'], st.flags['full-mourning']], ['half', 125, undefined]);
  c.mourning = null;
  assert.equal(Char.sheet(c, save.account).stats['hum-gain'], 100);
});

test('Char.mods: the Bellframe: every open pit for every character, and the gifts of the bells it rang, weighed and rung true', () => {
  const save = fresh();
  assert.deepEqual(plain(save.account.frame.pits), ['test.tenor'], 'a blank save opens the tenor pit');
  const a = Char.create(save, 'test.ringer', 'Agnes');
  assert.equal(sheet(a, save.account)['life-max'], 84, 'the tenor pit\'s +4 life');
  // a pit opened with one character changes the next one (and every one standing)
  save.account.frame.pits.push('test.treble');
  const b = Char.create(save, 'test.ringer', 'Bram');
  near(sheet(b, save.account)['move-speed'], 4.5 * 1.02);
  near(sheet(a, save.account)['move-speed'], 4.5 * 1.02);
  // two bells, of 20 and 25 tolls: their weights differ by 20% of the heavier, so they ring true (+5% to each gift)
  save.uid = 100;
  for (const [uid, weight] of [[101, 20], [102, 25]]) {
    save.account.frame.bells.push({ uid, of: uid - 50, name: 'Bell', class: 'test.ringer', calling: null, weight, gift: 'test.gift', pit: null, double: false, known: [] });
  }
  save.account.frame.bells[0].pit = 'test.tenor';
  save.account.frame.bells[1].pit = 'test.treble';
  save.account.frame.places = 2;
  const c = Char.create(save, 'test.ringer', 'Cass', [101, 102]);
  // a gift is worked at its bell's level, one for every 8 tolls past the first: 20 tolls level 3, 25 level 4
  near(sheet(c, save.account)['heed-max'], 100 + (3 + 4) * 1.05);
  assert.equal(sheet(b, save.account)['heed-max'], 100, 'a bell gives its gift only to whoever rang it at its making');
  save.account.frame.bells[0].double = true;                 // on the bede-roll, a bell rings double
  near(sheet(c, save.account)['heed-max'], 100 + (3 * 2 + 4) * 1.05);
  assert.deepEqual([Char.trueRing([20, 25]), Char.trueRing([25, 20, 21]), Char.trueRing([10, 20]), Char.trueRing([0, 0]), Char.trueRing([30])], [1, 1, 0, 0, 0]);
  assert.equal(Char.trueRing([9, 10, 12, 15]), 3, '9 and 10 differ by 10% (enough), 10 and 12 by 17%, 12 and 15 by 20%');
  assert.equal(Char.trueRing([10, 15, 40]), 0, '33% and 63%: too far apart');
});

// ---- the Plan ----

test('the Plan: one route from the door, a point a step next to the head, a node doubled once, a lane\'s attribute chosen', () => {
  const save = fresh(), c = Char.create(save, 'test.ringer', 'Agnes');
  assert.deepEqual(plain(Char.points(c)), { have: 0, spent: 0, free: 0 }, 'level 1 has no point');
  assert.equal(Char.allocate(c, 'test.lane', 'hand'), false);
  c.level = 4;
  c.planPoints = 3;                                    // bequests give points beyond the levels
  assert.deepEqual(plain(Char.points(c)), { have: 6, spent: 0, free: 6 });
  assert.equal(Char.allocate(c, 'test.corner'), false, 'only next to the head');
  assert.equal(Char.allocate(c, 'test.lane'), false, 'a lane of your choice needs the choice');
  assert.equal(Char.allocate(c, 'test.lane', 'ear'), false, 'among what it offers');
  assert.ok(Char.allocate(c, 'test.lane', 'hand'));
  assert.ok(Char.allocate(c, 'test.square'));
  assert.ok(Char.allocate(c, 'test.corner'));
  assert.ok(Char.allocate(c, 'test.lane', 'knee'), 'back onto the route: the lane doubled (its first choice stands)');
  assert.ok(Char.allocate(c, 'test.square'));
  assert.equal(Char.allocate(c, 'test.lane', 'hand'), false, 'a third time is too many');
  assert.deepEqual(plain(c.plan), { walk: ['test.door', 'test.lane', 'test.square', 'test.corner', 'test.lane', 'test.square'], choice: { 'test.lane': 'hand' } });
  assert.deepEqual(plain(Char.points(c)), { have: 6, spent: 5, free: 1 });
  assert.equal(Char.allocate(c, 'nowhere'), false);
  assert.deepEqual(plain(SaveData.validate(save)), []);
});

test('refunds come only from the head, newest first, for coin: the plan\'s refund times the node\'s ring', () => {
  const save = fresh(), c = Char.create(save, 'test.ringer', 'Agnes');
  c.level = 5;
  Char.allocate(c, 'test.lane', 'knee');
  Char.allocate(c, 'test.corner');
  assert.equal(Char.refundPrice(c), 5 * 2, 'the corner stands on ring 2');
  assert.equal(Char.refund(c, save.account), null, 'no coin, no refund');
  save.account.coin = 25;
  assert.equal(Char.refund(c, save.account), 'test.corner');
  assert.equal(save.account.coin, 15);
  assert.equal(Char.refund(c, save.account), 'test.lane');
  assert.deepEqual(plain(c.plan), { walk: ['test.door'], choice: {} }, 'the lane\'s choice goes with it');
  assert.equal(save.account.coin, 10);
  assert.equal(Char.refund(c, save.account), null, 'never the door');
  assert.equal(Char.refund(c), null, 'never without an account to pay from');
});

// ---- finds, voices, knots, observances ----

test('finds: worn from the chest in a place their base fits; the one worn there goes back; a run cannot change them', () => {
  const save = fresh(), c = Char.create(save, 'test.ringer', 'Agnes'), chest = save.chest;
  const token = { uid: SaveData.uid(save), base: 'test.token', level: 3, fixed: { stat: 'heed-max', op: 'flat', value: 5 }, lines: Array(8).fill(null), gone: [], walk: -1, cool: 3 };
  const rope = { uid: SaveData.uid(save), base: 'test.rope', level: 1, fixed: { stat: 'pull-window', op: 'flat', value: 0.05 }, lines: Array(8).fill(null), gone: [], walk: -1, cool: 0 };
  chest.finds.push(token, rope);
  assert.equal(Char.equip(c, token.uid, 'hat', chest), false, 'a token is not a hat');
  assert.equal(Char.equip(c, token.uid, 'token-2', chest), true);
  assert.deepEqual([c.worn['token-2'], token.cool, chest.finds.length], [token, 0, 1], 'first worn, a recast find stops cooling');
  const old = c.worn.tool;
  assert.equal(Char.equip(c, rope.uid, 'tool', chest), true);
  assert.deepEqual([c.worn.tool, chest.finds[0]], [rope, old], 'the old rope goes to the chest');
  assert.equal(Char.unequip(c, 'tool', chest), true);
  assert.deepEqual([c.worn.tool, chest.finds.length], [null, 2]);
  assert.equal(Char.equip(c, 999, 'tool', chest), false);
  assert.equal(Char.equip(c, old.uid, 'tool'), false, 'without a chest (the command equip in a vigil) nothing is worn');
  assert.equal(Char.equip(c, old.uid, 'belt', chest), false);
  assert.deepEqual(plain(SaveData.validate(save)), []);
});

test('voices: places open with levels and take held voices; a place swaps; a rope grows with the voice\'s level', () => {
  const save = fresh(), c = Char.create(save, 'test.ringer', 'Agnes'), [a, b, d] = c.voices.map((v) => v.uid);
  assert.equal(Char.places(c), 1);
  assert.equal(Char.place(c, b, 1), false, 'the second place opens at level 3');
  assert.ok(Char.place(c, b, 0));
  assert.deepEqual(plain(c.loadout).slice(0, 2), [b, null]);
  c.level = 3;
  assert.equal(Char.places(c), 2);
  assert.ok(Char.place(c, a, 1));
  assert.ok(Char.place(c, a, 0), 'a voice placed elsewhere swaps with what stood there');
  assert.deepEqual(plain(c.loadout).slice(0, 2), [a, b]);
  assert.ok(Char.place(c, null, 1));
  assert.equal(Char.place(c, 999, 1), false);
  assert.equal(Char.place(c, d, 1.5), false);
  assert.deepEqual([1, 6, 7, 12, 13, 18, 19, 20].map(Char.rope), [2, 2, 3, 3, 4, 4, 5, 5], 'two knots, and one more at 7, 13 and 19');
  assert.deepEqual(plain(Char.voice(7, 'test.toll')), { uid: 7, id: 'test.toll', level: 1, rope: 2, knots: [null, null], tolls: 0 });
});

test('knots: tied into a voice they fit, one voice at a time; untied, and given to and taken from the chest', () => {
  const save = fresh(), c = Char.create(save, 'test.ringer', 'Agnes'), [toll, , weight] = c.voices.map((v) => v.uid);
  assert.equal(Char.tie(c, toll, 0, 'test.slip'), false, 'it holds no knot yet');
  c.knots['test.slip'] = 1;
  c.knots['test.lead'] = 2;
  assert.equal(Char.tie(c, toll, 0, 'test.lead'), false, 'the lead needs a still voice');
  assert.equal(Char.tie(c, toll, 2, 'test.slip'), false, 'a rope of two places');
  assert.ok(Char.tie(c, toll, 0, 'test.slip'));
  assert.ok(Char.tie(c, weight, 1, 'test.lead'));
  assert.deepEqual([plain(c.voices[0].knots), plain(c.voices[2].knots), plain(c.knots)], [['test.slip', null], [null, 'test.lead'], { 'test.lead': 1 }]);
  assert.ok(Char.tie(c, weight, 1, 'test.lead'), 'tying over a knot unties it first');
  assert.deepEqual(plain(c.knots), { 'test.lead': 1 });
  assert.ok(Char.untie(c, toll, 0));
  assert.equal(Char.untie(c, toll, 0), false, 'nothing is tied there');
  assert.deepEqual(plain(c.knots), { 'test.lead': 1, 'test.slip': 1 });
  assert.ok(Char.give(c, save.chest, { knot: 'test.slip' }));
  assert.deepEqual([plain(c.knots), plain(save.chest.knots)], [{ 'test.lead': 1 }, { 'test.slip': 1 }]);
  assert.equal(Char.give(c, save.chest, { voice: toll }), false, 'a placed voice stays');
  assert.ok(Char.give(c, save.chest, { voice: weight }));
  assert.deepEqual([c.voices.length, save.chest.voices.length], [2, 1]);
  assert.ok(Char.take(c, save.chest, { voice: weight }) && Char.take(c, save.chest, { knot: 'test.slip' }));
  assert.equal(Char.take(c, save.chest, { knot: 'test.slip' }), false);
  assert.deepEqual(plain(SaveData.validate(save)), []);
});

test('observances: learned, then kept while free Heed allows: each holds its share of heed-max', () => {
  const save = fresh(), c = Char.create(save, 'test.ringer', 'Agnes');
  assert.deepEqual(plain(Char.heed(c, save.account)), { max: 100, held: 0, free: 100 });
  assert.equal(Char.hold(c, 'test.stability', save.account), false, 'only what it knows');
  for (const id of ['test.stability', 'test.alms', 'test.mourning']) assert.ok(Char.learn(c, id));
  assert.equal(Char.learn(c, 'test.alms'), false);
  assert.equal(Char.learn(c, 'no.such'), false);
  assert.ok(Char.hold(c, 'test.stability', save.account) && Char.hold(c, 'test.mourning', save.account));
  assert.deepEqual(plain(Char.heed(c, save.account)), { max: 100, held: 70, free: 30 });
  assert.equal(Char.hold(c, 'test.alms', save.account), true, '25 of the 30 left');
  assert.equal(Char.hold(c, 'test.alms', save.account), false, 'kept already');
  assert.ok(Char.release(c, 'test.mourning'));
  assert.equal(Char.release(c, 'test.mourning'), false);
  assert.deepEqual(plain(c.observances), ['test.stability', 'test.alms']);
});

// ---- experience ----

test('experience: kept as it is earned; levels by the curve of the mode; a place that opens takes a held voice', () => {
  const save = fresh(), c = Char.create(save, 'test.ringer', 'Agnes'), curve = Defs.get('curves', 'main').charXp;
  assert.equal(Char.need(c), curve[0]);
  assert.equal(Char.gain(c, curve[0] - 1), 0);
  assert.equal(Char.gain(c, 1 + curve[1] + 5), 2, 'two levels at once');
  assert.deepEqual([c.level, c.xp], [3, 5]);
  assert.deepEqual(plain(c.loadout).slice(0, 2), [c.voices[0].uid, c.voices[1].uid], 'level 3 opened the second place, and the held voice took it');
  assert.equal(Char.need(c, Defs.get('mode', 'watch-night')), Defs.get('curves', 'main').nightXp[2], 'the Watch-night\'s own curve');
  c.level = 70;
  assert.deepEqual([Char.need(c), Char.gain(c, 1e9), c.level], [Infinity, 0, 70], 'at the cap no more levels come');
  assert.equal(Char.gain(c, -5), 0);
});

// ---- the end of a vigil ----

test('a vigil begins from a character: the save notes it away, the run gets a copy and what it reads of the account', () => {
  const save = fresh(), c = Char.create(save, 'test.ringer', 'Agnes');
  save.register.push({ uid: 90, name: 'Old', class: 'test.ringer', calling: null, level: 3, tolls: 9, vigils: 2, zone: 'debug', toll: 2,
    cause: { attack: 'dial.load', kind: 'swell' }, how: 'died', bell: 91 });
  for (let i = 0; i < 4; i++) save.register.push(Object.assign({}, save.register[0], { uid: 92 + i }));
  save.register.push(Object.assign({}, save.register[0], { uid: 97, cause: { attack: null, kind: 'drag' } }));
  assert.equal(Char.begin(save, 999, 'debug', 1), null);
  assert.equal(Char.begin(save, c.uid, 'nowhere', 1), null);
  const cfg = Char.begin(save, c.uid, 'debug', 'seed');
  assert.deepEqual([cfg.mode, cfg.zone, cfg.seed], ['household', 'debug', 'seed']);
  assert.ok(cfg.char !== c && JSON.stringify(cfg.char) === JSON.stringify(c), 'a copy: the run changes it, the game writes it back');
  assert.deepEqual(plain(cfg.account.frame), plain(save.account.frame));
  near(cfg.account.warned['dial.load'], 0.45);
  assert.deepEqual(Object.keys(cfg.account.warned), ['dial.load'], '0.15 s a death to that attack, three at most; a press has no attack to show');
  assert.deepEqual(plain(save.away), { char: c.uid, zone: 'debug', seed: 'seed', hum: 0, heard: 0, level: 1, tolls: 0 });
  assert.equal(Char.begin(save, c.uid, 'debug', 2), null, 'one vigil at a time');
  // a real run takes the cfg as it is
  const S = Sim.create(cfg);
  assert.equal(S.cfg.char, cfg.char);
  assert.equal(S.sheet.stats['life-max'], 84);
});

test('rung down: the haul banked joins the Household, the character lives, its voices count the tolls, and the Hum is kept', () => {
  const save = fresh(), c = Char.create(save, 'test.ringer', 'Agnes');
  save.account.hum = 10;
  const cfg = Char.begin(save, c.uid, 'debug', 1), run = cfg.char;
  run.level = 4;                                        // what the run's embers did, kept as earned
  run.loadout[1] = run.voices[1].uid;
  run.worn.tool.walk = 3;                               // a place struck for a re-walk took a line at the first toll
  run.worn.tool.lines[3] = line('stood', 'damage', 5, { toll: 1 });
  const banked = { uid: 7, base: 'test.jerkin', level: 2, fixed: { stat: 'guard.blow', op: 'flat', value: 2 }, lines: Array(8).fill(null), gone: [], walk: -1, cool: 0 };
  const report = Char.end(save, ended(cfg, 'left', { tolls: 9, hum: 30, banked: 14, coin: 3, finds: [banked], haul: [{}, {}] }));
  assert.deepEqual(plain(report), {
    char: c.uid, name: 'Agnes', class: 'test.ringer', outcome: 'left', zone: 'debug', tolls: 9, level: 4, rose: 3, coin: 14, finds: 1,
    lost: { coin: 3, finds: 2 }, hum: 30, death: null, bell: null, first: false,
  });
  const now = save.chars[0];
  assert.notEqual(now, c, 'the run\'s copy is the character now');
  assert.deepEqual([now.level, now.tolls, now.vigils, save.account.coin, save.account.hum, save.account.heard, save.away], [4, 9, 1, 14, 40, 30, null]);
  assert.deepEqual([save.chest.finds.length, save.chest.finds[0].uid > 6, save.chest.finds[0].base], [1, true, 'test.jerkin'], 'with a uid of the save');
  assert.deepEqual(plain(now.voices.map((v) => [v.level, v.tolls])), [[2, 9], [2, 9], [1, 0]], '8 tolls a level, for the voices in the loadout');
  assert.equal(now.worn.tool.walk, -1, 'the re-walk kept its line');
  assert.deepEqual(plain(SaveData.validate(save)), []);
  // a voice through 152 tolls: level 20, a rope of five
  const v = now.voices[0];
  const again = Char.begin(save, now.uid, 'debug', 2);
  Char.end(save, ended(again, 'spared', { tolls: 143 }));
  assert.deepEqual([save.chars[0].voices[0].level, save.chars[0].voices[0].rope, plain(save.chars[0].voices[0].knots)], [20, 5, [null, null, null, null, null]]);
  assert.equal(v.level, 2, 'the save holds copies, never the run\'s objects');
});

test('death: on the Register with what killed it, recast as a bell, its worn finds and knots to the chest, and it cannot be played', () => {
  const save = fresh(), a = Char.create(save, 'test.ringer', 'Agnes'), b = Char.create(save, 'test.ringer', 'Bram');
  a.level = 23; a.tolls = 40; a.known.push('test.alms');
  a.knots['test.lead'] = 1;
  const cfg = Char.begin(save, a.uid, 'debug', 1), run = cfg.char;
  run.voices[0].knots[0] = 'test.slip';                 // tied in a voice: untied into the chest
  run.worn.tool.lines[2] = line('stood', 'damage', 5);
  run.worn.tool.lines[3] = line('stood', 'damage', 6);
  run.worn.tool.walk = 3;                               // struck for a re-walk, and the character died
  run.worn.tool.lines[3] = null;
  const report = Char.end(save, ended(cfg, 'died', { tolls: 6, hum: 12, gain: 150, cause: { attack: 'dial.load', kind: 'swell', toll: 5 }, haul: [{}], coin: 4 }));
  assert.deepEqual([report.outcome, report.first, report.hum], ['died', true, 12 + 40 * 6 * 1.5], 'a cause new to the Register pays 40 Hum a toll, times hum-gain');
  assert.equal(Char.find(save, a.uid), null, 'it stands no more');
  assert.equal(Char.begin(save, a.uid, 'debug', 2), null, 'and cannot keep a vigil');
  assert.deepEqual(plain(save.register), [{
    uid: a.uid, name: 'Agnes', class: 'test.ringer', calling: null, level: 23, tolls: 46, vigils: 1, zone: 'debug', toll: 6,
    cause: { attack: 'dial.load', kind: 'swell' }, how: 'died', bell: report.bell.uid,
  }]);
  assert.deepEqual(plain(report.bell), { uid: report.bell.uid, of: a.uid, name: 'Agnes', class: 'test.ringer', calling: null, weight: 46,
    gift: 'test.gift', pit: null, double: false, known: ['test.alms'] }, 'weighing the tolls of its whole life, waiting to be hung');
  const tool = save.chest.finds.find((f) => f.base === 'test.rope');
  assert.deepEqual([plain(tool.lines).slice(1, 5), plain(tool.gone), tool.walk], [[null, null, null, null], [2, 3, 4], -1],
    'the struck place and both its neighbours are erased for good');
  assert.equal(save.chest.finds.length, 2, 'every worn find');
  assert.deepEqual(plain(save.chest.knots), { 'test.slip': 1, 'test.lead': 1 });
  assert.equal(save.chest.voices.length, 0, 'its voices fell silent with it');
  assert.deepEqual([save.account.hum, save.account.coin], [12 + 360, 0], 'Hum is kept; the coin carried was lost');
  // the others mourn it: one vigil for every 10 levels it had
  assert.deepEqual(plain(save.chars[0].mourning), { term: 2, left: 2 });
  assert.equal(save.chars[0], b);
  assert.deepEqual(plain(SaveData.validate(save)), []);
  // a second death by the same cause pays nothing more; a longer term lengthens the mourning, a shorter adds nothing
  const c = Char.create(save, 'test.ringer', 'Cass');
  c.level = 9;
  const cfg2 = Char.begin(save, c.uid, 'debug', 3);
  const second = Char.end(save, ended(cfg2, 'died', { tolls: 2, cause: { attack: 'dial.load', kind: 'swell', toll: 1 } }));
  assert.deepEqual([second.first, second.hum, save.register.length], [false, 0, 2]);
  assert.deepEqual(plain(b.mourning), { term: 2, left: 2 }, 'a death of level 9 asks one vigil, less than the two left');
  const cfg3 = Char.begin(save, b.uid, 'debug', 4);
  Char.end(save, ended(cfg3, 'left', { tolls: 1 }));
  assert.deepEqual(plain(save.chars[0].mourning), { term: 2, left: 1 }, 'a vigil kept counts the term down');
});

test('a checkpoint keeps what is kept the moment it is earned; a vigil left unfinished ends as if spared', () => {
  const save = fresh(), c = Char.create(save, 'test.ringer', 'Agnes');
  save.account.hum = 5;
  const cfg = Char.begin(save, c.uid, 'debug', 1), run = cfg.char;
  const S = ended(cfg, null, { tolls: 3, hum: 18 });
  run.level = 2;
  run.xp = 7;
  run.knots['test.lead'] = 1;                           // found in the vigil
  run.voices.push(Char.voice(-4, 'test.tell'));        // a voice found in the vigil has a uid of the run's own
  run.loadout[0] = -4;
  assert.ok(Char.checkpoint(save, S));
  const kept = save.chars[0];
  assert.deepEqual([kept.level, kept.xp, plain(kept.knots), save.account.hum, save.away.tolls], [2, 7, { 'test.lead': 1 }, 23, 3]);
  assert.ok(kept.voices[3].uid > 0 && kept.loadout[0] === kept.voices[3].uid, 'it takes a uid of the save, and keeps its place');
  assert.deepEqual(plain(SaveData.validate(save)), [], 'a save written mid-vigil is sound');
  // the page closed: on the next start the vigil is ended as spared from the last checkpoint
  const report = Char.abandoned(save);
  assert.deepEqual([report.outcome, report.tolls, report.hum, save.away, save.chars[0].vigils, save.chars[0].tolls], ['unfinished', 3, 18, null, 1, 3]);
  assert.equal(Char.abandoned(save), null, 'once');
  assert.equal(Char.checkpoint(save, S), false, 'not once the vigil is over');
});

test('retiring: a standing character leaves alive, recast as a bell, on the Register as retired, its things given to the chest', () => {
  const save = fresh(), c = Char.create(save, 'test.ringer', 'Agnes');
  c.tolls = 30;
  c.knots['test.slip'] = 2;
  const bell = Char.retire(save, c.uid);
  assert.deepEqual([bell.weight, bell.pit, save.chars.length, save.register[0].how, save.register[0].cause], [30, null, 0, 'retired', null]);
  assert.deepEqual([save.chest.finds.length, save.chest.voices.length, plain(save.chest.knots)], [2, 3, { 'test.slip': 2 }]);
  assert.equal(Char.retire(save, c.uid), null);
  assert.deepEqual(plain(SaveData.validate(save)), []);
});

// ---- a whole life, in the Dial ----

test('the whole build: a character\'s life through several vigils of the Dial, played by the scripted player, until it dies', () => {
  const sim = loadSim({ boot: true });
  const save = sim.SaveData.blank(), c = sim.Char.create(save, 'change-ringer', 'Agnes Toll');
  assert.ok(c !== null, 'the Change-ringer is open from the start');
  // the scripted player keeps the vigil; as the first toll is heard the player is put beside the bell-post, a landmark,
  // so that each toll pays Hum (the toll's number times the landmarks stood beside at a toll); a checkpoint at each toll
  const play = (seconds, seed) => {
    const cfg = sim.Char.begin(save, save.chars[0].uid, 'dial', seed), S = sim.Sim.create(cfg);
    let heard = 0;
    for (let i = 0; i < seconds * 60 && S.phase === 'play'; i++) {
      if (S.toll === 1 && heard === 0) { S.player.x = S.vigil.postX + 2.5; S.player.y = S.vigil.postY; heard = 1; }
      sim.Sim.step(S, sim.Bot.input(S, 'vigil'));
      if (S.step % 4500 === 0) sim.Char.checkpoint(save, S);
    }
    return S;
  };
  // the first vigil: three tolls, then the command to leave (it banks nothing it had not rung down)
  let S = play(230, 7);
  assert.equal(S.phase, 'play', 'the scripted player keeps three tolls');
  const xpBefore = S.cfg.char.xp + S.cfg.char.level * 1e6;
  sim.Sim.command(S, { type: 'leave' });
  const first = sim.Char.end(save, S);
  assert.equal(first.outcome, 'left');
  assert.ok(first.rose >= 1 && save.chars[0].level === first.level && save.chars[0].level > 1, `it rose ${first.rose} levels by the embers it took`);
  assert.ok(xpBefore > 1e6 && save.account.hum > 0 && save.account.hum === first.hum, 'and kept the Hum the tolls paid');
  assert.deepEqual(plain(sim.SaveData.validate(save)), []);
  // the second vigil: on through to the next toll, then ringing down as the command does
  S = play(80, 8);
  sim.Sim.command(S, { type: 'leave' });
  sim.Char.end(save, S);
  assert.deepEqual([save.chars[0].vigils, save.chars[0].tolls], [2, 3 + 1]);
  assert.equal(save.chars[0].voices[0].tolls, 4, 'its first voice spoke through every toll');
  // the third: after the first toll a great Swell takes it to no life; Tolled-for, its time runs out (the dead's hits
  // take it down), and it joins the dead
  const cfg = sim.Char.begin(save, save.chars[0].uid, 'dial', 9);
  S = sim.Sim.create(cfg);
  for (let i = 0; i < 75 * 60 + 30 && S.phase === 'play'; i++) sim.Sim.step(S, sim.Bot.input(S, 'vigil'));
  assert.deepEqual([S.phase, S.toll], ['play', 1]);
  const swell = sim.Defs.get('attack', 'dial.load'), REPRIEVE = sim.Stats.AILMENT['tolled-for'];
  sim.Dmg.hitPlayer(S, swell, { damage: 1e6, x: S.player.x, y: S.player.y }, 1, 1.5);
  assert.deepEqual(plain(S.cause), { attack: 'dial.load', kind: 'swell', toll: 1 });
  S.player.condT[REPRIEVE] = 0.05;                     // a few steps of Tolled-for left, far from the far lychgate
  for (let i = 0; i < 60 && S.phase === 'play'; i++) sim.Sim.step(S, sim.Sim.NO_INPUT);
  assert.deepEqual([S.result.outcome, S.result.tolls], ['died', 1]);
  const end = sim.Char.end(save, S);
  assert.deepEqual([end.outcome, end.first, end.tolls, save.chars.length, save.register.length, save.register[0].cause.attack, save.register[0].toll],
    ['died', true, 1, 0, 1, 'dial.load', 1]);
  near(end.hum, S.hum + 40 * 1 * S.sheet.stats['hum-gain'] / 100, 1e-9);   // a cause new to the Register: 40 Hum times the toll it came at
  assert.equal(save.account.frame.bells.length, 1);
  assert.equal(sim.Char.begin(save, c.uid, 'dial', 10), null, 'the dead cannot be played');
  assert.deepEqual(plain(sim.SaveData.validate(save)), []);
  // the next character sees that attack sooner
  const next = sim.Char.create(save, 'change-ringer', 'Bram');
  const cfg2 = sim.Char.begin(save, next.uid, 'dial', 11);
  near(cfg2.account.warned['dial.load'], 0.15);
  const T = sim.Sim.create(cfg2);
  sim.Buffs.add(T, 'test.heed', [{ stat: 'heed-max', op: 'set', value: 20 }], 10);   // under the 1 s that all warning is held to
  sim.Sim.rebuild(T);
  near(sim.Dmg.warning(T, null, 'dial.load'), 0.2 + 0.15);
  near(sim.Dmg.warning(T, null, 'dial.keeper.stroke'), 0.2);
});

test('the whole build: an ember a character takes in a vigil is kept as experience, and a level it gives rebuilds the sheet', () => {
  const sim = loadSim({ boot: true }), save = sim.SaveData.blank(), c = sim.Char.create(save, 'change-ringer', 'Agnes');
  const S = sim.Sim.create(sim.Char.begin(save, c.uid, 'dial', 3)), p = S.player, need = sim.Char.need(S.cfg.char);
  const ember = sim.Director.drop(S, 0, need + 1, p.x, p.y);
  sim.Sim.step(S, sim.Sim.NO_INPUT);
  assert.equal(ember.alive, false, 'taken');
  assert.deepEqual([S.cfg.char.level, S.cfg.char.xp], [2, 1]);
  assert.equal(S.sheet.stats.hand, 12, 'the new level\'s attributes are on the sheet at once');
  // full mourning: no coin is picked up
  S.cfg.char.mourning = { term: 2, left: 2 };
  S.dirty = true;
  sim.Sim.step(S, sim.Sim.NO_INPUT);
  const coin = sim.Director.drop(S, 1, 5, p.x, p.y);
  for (let i = 0; i < 30; i++) sim.Sim.step(S, sim.Sim.NO_INPUT);
  assert.deepEqual([coin.alive, S.coin], [true, 0], 'it lies where it fell');
});
