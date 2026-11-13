// tests/sim/12-items.test.js: finds as data (src/js/12-items.js): making one, writing a line by a posture, what a worn
// find gives (the share rule), cooling, the four changes and their refusals and prices; and the content of
// 33-bases.js and 34-postures.js. Most tests run in a small world of their own (the kernel, 12-items.js, 14-character.js
// and 16-savedata.js, with test bases and postures whose numbers are easy to read); the content tests load the whole
// simulation as the page does.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');
const { FILES, line } = require('./household.js');

// band t (toll t, from 1) is [t, t + 1]: a line written at toll 3 on a find of level 1 rolls between 3 and 4
const BANDS = [1, 2, 3, 4, 5, 6, 7, 8].map((t) => [t, t + 1]);

function world() {
  const sim = loadSim({ only: FILES.concat(['12-items.js']) });
  const { Defs } = sim;
  Defs.add('voice', {
    id: 'test.toll', name: 'Toll', text: '', icon: null, attr: 'hand', tier: 1, tags: ['round'], weapon: null, archetype: 'ring', target: 'self',
    rate: 1, damage: { blow: [1, 2] }, weaponPct: 0, eff: 1, crit: 0, params: {}, mods: [], fx: {},
  });
  Defs.add('class', {
    id: 'test.ringer', name: 'Test Ringer', text: '', attrs: { hand: 10, knee: 5 }, perLevel: { hand: 2, knee: 1 }, base: [], voices: ['test.toll'],
    startGear: ['test.rope', 'test.coat'], trade: { name: 'Set', text: '', icon: null, recharge: 8 }, callings: ['test.one', 'test.two'], unlock: null,
    puppet: 'test.ringer', palette: ['#A7312C'],
  });
  Defs.add('bequest', { id: 'test.open', name: 'Opening', text: '', hidden: false, scope: 'account', on: 'kill', count: 1, where: {}, reward: { base: 'test.locked' } });
  const base = (id, slot, family, fixed, more) => Defs.add('base', Object.assign({ id, name: id, slot, family, level: 1, fixed, tables: {}, icon: null, unlock: null, weight: 1 }, more));
  base('test.rope', 'tool', 'rope', { stat: 'pull-window', op: 'flat', min: 0.05, max: 0.05 });
  base('test.coat', 'coat', null, { stat: 'guard.blow', op: 'flat', min: 1, max: 3 }, { tables: { stood: { verbs: { guard: 0 } } } });
  base('test.token', 'token', null, { stat: 'heed-max', op: 'flat', min: 2, max: 6, tags: ['round'], cond: 'braced' }, { weight: 3 });
  base('test.locked', 'hat', null, { stat: 'warn', op: 'flat', min: 0.1, max: 0.1 }, { unlock: 'test.open' });
  base('test.high', 'hat', null, { stat: 'warn', op: 'flat', min: 0.1, max: 0.1 }, { level: 5 });
  base('test.never', 'hat', null, { stat: 'warn', op: 'flat', min: 0.1, max: 0.1 }, { weight: 0 });
  Defs.add('posture', {
    id: 'stood', name: 'Stood', verbs: [
      { key: 'harm', stat: 'damage', op: 'inc', band: BANDS, grow: 10, w: 1 },
      { key: 'guard', stat: 'guard.blow', op: 'flat', band: BANDS, grow: 0, w: 1 },
    ],
    objects: [{ key: 'round', tags: ['round'], w: 1 }, { key: 'all', tags: [], w: 1 }],
  });
  for (const id of ['strode', 'pressed', 'timed']) {
    Defs.add('posture', { id, name: id, verbs: [{ key: 'harm', stat: 'damage', op: 'inc', band: BANDS, grow: 0, w: 1 }], objects: [{ key: 'all', tags: [], w: 1 }] });
  }
  assert.deepEqual(plain(Defs.finalize()), [], 'the test world\'s content is valid');
  return sim;
}

const W = world();
const { Items, Char, SaveData, Core, Stats } = W;

// what Items.write reads of a run: the loot stream, the toll, and notch-size from the sheet
const runAt = (toll, seed, notchSize) => ({ rng: { loot: new Core.RNG(seed === undefined ? 1 : seed) }, toll, sheet: { stats: { 'notch-size': notchSize || 100 } } });
const blank = (base, level) => Items.make(base || 'test.coat', level || 1, 1, 0.5);
const written = (f) => f.lines.filter((l) => l !== null);

// ---- making a find ----

test('Items.make: a blank find of its base and level, its fixed line rolled within the base\'s range', () => {
  const f = Items.make('test.token', 3, 9, 0);
  assert.deepEqual(plain(f), {
    uid: 9, base: 'test.token', level: 3, fixed: { stat: 'heed-max', op: 'flat', value: 2, tags: ['round'], cond: 'braced' },
    lines: [null, null, null, null, null, null, null, null], gone: [], walk: -1, cool: 0,
  });
  assert.equal(Items.make('test.token', 1, 1, 1).fixed.value, 6, 'roll 1: the top of the range');
  assert.equal(Items.make('test.token', 1, 1, 0.5).fixed.value, 4, 'roll 0.5 (a class\'s starting gear): the middle');
  assert.equal(Items.make('test.token', 1, 1, NaN).fixed.value, 4, 'no roll: the middle');
  assert.deepEqual([Items.make('test.token', 0, 1, 0).level, Items.make('test.token', 99, 1, 0).level, Items.make('test.token', 3.7, 1, 0).level], [1, 70, 3],
    'a level is a whole number from 1 to 70');
  const base = W.Defs.get('base', 'test.token');
  assert.notEqual(f.fixed.tags, base.fixed.tags, 'the fixed line is the find\'s own, not the base\'s');
  assert.throws(() => Items.make('test.none', 1, 1, 0), /no base/);
});

test('Char.create wears a class\'s starting gear through Items.make, rolled at the middle of the range', () => {
  const save = SaveData.blank(), c = Char.create(save, 'test.ringer', 'Agnes');
  assert.deepEqual([c.worn.tool.base, c.worn.coat.base, c.worn.coat.fixed.value, c.worn.coat.cool], ['test.rope', 'test.coat', 2, 0]);
  assert.deepEqual(plain(SaveData.validate(save)), []);
});

// ---- writing a line ----

test('Items.write: verb and object from the posture\'s table; the amount in the band of the toll; the posture\'s condition', () => {
  const S = runAt(3), f = blank('test.coat');      // the coat's table gives the verb 'guard' no weight: only harm is drawn
  assert.equal(Items.write(S, f, 'stood'), 0, 'the first empty place');
  const l = f.lines[0];
  assert.deepEqual([l.stat, l.op, l.cond, l.posture, l.toll, l.struck], ['damage', 'inc', 'braced', 'stood', 3, null]);
  assert.ok(l.value >= 3 && l.value <= 4, `rolled in band[2], [3, 4]: ${l.value}`);
  assert.deepEqual(plain(l.band), [3, 4], 'the band it rolled in is kept with it');
  assert.ok(Array.isArray(l.tags) && (l.tags.length === 0 || l.tags[0] === 'round'));
  assert.equal(typeof l.backward, 'boolean');
  for (const [toll, band] of [[0, [1, 2]], [1, [1, 2]], [8, [8, 9]], [12, [8, 9]]]) {
    const g = blank('test.coat');
    Items.write(runAt(toll), g, 'stood');
    assert.deepEqual(plain(g.lines[0].band), band, `toll ${toll}: the first band before the first toll, the eighth from the eighth on`);
    assert.equal(g.lines[0].toll, toll >= 1 ? toll : 1);
  }
  const high = blank('test.coat', 11);              // grow 10: ten levels above the first double the band
  Items.write(runAt(3), high, 'stood');
  assert.deepEqual(plain(high.lines[0].band), [6, 8]);
  const big = blank('test.coat');                   // notch-size 150: half as large again
  Items.write(runAt(3, 1, 150), big, 'stood');
  assert.deepEqual(plain(big.lines[0].band), [4.5, 6]);
  const byRow = blank('test.coat');
  Items.write(runAt(3), byRow, Stats.POSTURE.pressed);
  assert.deepEqual([byRow.lines[0].posture, byRow.lines[0].cond], ['pressed', 'crowded'], 'a posture by its row of Stats.POSTURES');
  assert.equal(Items.write(runAt(3), blank(), 'loafed'), -1, 'no such posture: nothing written');
  for (const p of Stats.POSTURES) {
    const g = blank('test.rope');
    Items.write(runAt(2), g, p.id);
    assert.equal(g.lines[0].cond, p.cond, `${p.id} writes lines that work ${p.cond}`);
  }
});

test('Items.write: the base leans the draw; an object fits its verb; one line in ten is cut backward', () => {
  let guard = 0, n = 600, round = 0, harm = 0, backward = 0;
  const S = runAt(2, 5);
  for (let i = 0; i < n; i++) {
    const coat = blank('test.coat'), rope = blank('test.rope');
    Items.write(S, coat, 'stood');
    Items.write(S, rope, 'stood');
    if (coat.lines[0].stat !== 'damage') guard++;
    const l = rope.lines[0];
    if (l.stat === 'guard.blow') assert.deepEqual(plain(l.tags), [], 'a stat of the player\'s own sheet is held to nothing: no tag would ever hold');
    else { harm++; if (l.tags.length) round++; }
    if (coat.lines[0].backward) backward++;
    if (l.backward) backward++;
  }
  assert.equal(guard, 0, 'a weight of 0 from the base: that verb is never drawn on it');
  assert.ok(harm > n * 0.4 && harm < n * 0.6, `no weight named: the two verbs by their own w, about half each: ${harm} of ${n}`);
  assert.ok(round > harm * 0.35 && round < harm * 0.65, `harm takes either object: ${round} of ${harm} for round voices`);
  assert.ok(backward > 2 * n * 0.07 && backward < 2 * n * 0.13, `one in ten backward: ${backward} of ${2 * n}`);
});

test('Items.write: into the place struck for a re-walk, else the first empty place not gone; -1 when there is none', () => {
  const S = runAt(4), f = blank('test.coat');
  f.walk = 5;
  assert.equal(Items.write(S, f, 'stood'), 5, 'the struck place first');
  assert.equal(Items.write(S, f, 'stood'), 0, 'then the first empty place');
  f.gone = [1, 2];
  assert.equal(Items.write(S, f, 'stood'), 3, 'a place gone for good takes no line');
  for (let i = 0; i < 4; i++) Items.write(S, f, 'stood');
  assert.deepEqual([Char.notches(f), Items.write(S, f, 'stood')], [6, -1], 'six written, two gone: full');
  assert.equal(Items.write(S, { base: 'test.coat' }, 'stood'), -1, 'not a find');
});

test('the same stream writes the same lines', () => {
  const a = blank('test.rope'), b = blank('test.rope'), Sa = runAt(5, 77), Sb = runAt(5, 77);
  for (let i = 0; i < 8; i++) { Items.write(Sa, a, Stats.POSTURES[i % 4].id); Items.write(Sb, b, Stats.POSTURES[i % 4].id); }
  assert.deepEqual(plain(a), plain(b));
  const c = blank('test.rope');
  for (let i = 0; i < 8; i++) Items.write(runAt(5, 78 + i), c, Stats.POSTURES[i % 4].id);
  assert.notDeepEqual(plain(c.lines), plain(a.lines));
});

// ---- what a worn find gives ----

test('Items.mods is Char.findMods: the fixed line in full, every written line at the share of the attribute that wrote most', () => {
  const f = blank('test.rope');
  f.lines[0] = line('stood', 'damage', 12);
  f.lines[2] = line('stood', 'mend-rate', 24, { tags: ['round'] });
  f.lines[5] = line('strode', 'move-speed', 6, { backward: true });
  f.lines[6] = line('pressed', 'damage', 10, { struck: 'object', tags: ['round'] });
  const attrs = { knee: 8, heel: 0, hand: 30, ear: 0 };    // four notches want 16 Knee: 8 of it is half
  const mine = Items.mods(f, attrs, []), theirs = Char.findMods(f, attrs, []);
  assert.deepEqual(plain(mine), plain(theirs));
  assert.deepEqual(plain(mine[0]), { stat: 'pull-window', op: 'flat', value: 0.05 }, 'the fixed line in full');
  assert.deepEqual(plain(mine.slice(1)), [
    { stat: 'damage', op: 'inc', value: 6, cond: 'braced' },
    { stat: 'mend-rate', op: 'inc', value: 12, tags: ['round'], cond: 'braced' },
    { stat: 'move-speed', op: 'inc', value: 3, unless: 'striding' },
    { stat: 'damage', op: 'inc', value: 3, cond: 'crowded' },
  ], 'each at a share of one half; a backward line works unless; a struck object at 60% too');
  assert.deepEqual(plain(Items.wants(f)), { posture: 'stood', attr: 'knee', want: 16, notches: 4 });
  assert.equal(Items.mods(f, { knee: 2, heel: 0, hand: 0, ear: 0 }, [])[1].value, 12 * 0.2, 'never below a fifth');
  assert.equal(Items.mods(f, { knee: 40, heel: 0, hand: 0, ear: 0 }, [])[1].value, 12, 'and never above the whole');
  const tie = blank('test.rope');
  tie.lines[1] = line('timed', 'warn', 1);
  tie.lines[3] = line('pressed', 'damage', 4);
  assert.deepEqual(plain(Items.wants(tie)), { posture: 'timed', attr: 'ear', want: 8, notches: 2 }, 'a tie goes to the posture of the earliest place');
  assert.equal(Items.wants(blank()), null, 'a blank find wants nothing');
  assert.deepEqual(plain(Items.mods(blank(), attrs, [])), [{ stat: 'guard.blow', op: 'flat', value: 2 }]);
});

test('Items.attrs: the attributes a worn find\'s share is worked from are all that the character has but its finds', () => {
  const save = SaveData.blank(), c = Char.create(save, 'test.ringer', 'Agnes');
  c.level = 3;
  c.worn.coat.lines[0] = line('stood', 'knee', 7, { op: 'flat', cond: 'braced' });
  assert.deepEqual(plain(Items.attrs(c, save.account)), { knee: 7, heel: 0, hand: 14, ear: 0 }, 'the class at level 3: Hand 10 + 2 x 2, Knee 5 + 2');
  assert.equal(c.worn.coat.lines[0].stat, 'knee', 'the character is not changed');
});

// ---- cooling ----

test('Items.cool: each toll heard raises the weakest line a quarter of its band toward its strong end; four steps at most', () => {
  const f = blank('test.rope');
  f.lines[0] = line('stood', 'damage', 4, { band: [4, 8] });                // at the bottom of its band
  f.lines[1] = line('stood', 'damage', 7, { band: [4, 8] });                // three quarters up
  f.lines[3] = line('strode', 'stride-share', -1, { op: 'flat', band: [-2, -1] });   // a band below 0: its strong end is -2
  f.cool = 4;
  assert.deepEqual([Items.strength(f.lines[0]), Items.strength(f.lines[1]), Items.strength(f.lines[3])], [0, 0.75, 0]);
  Items.cool(f, 1);
  assert.deepEqual([f.lines[0].value, f.lines[3].value, f.cool], [5, -1, 3], 'the weakest, the earliest of two as weak, rose a step');
  Items.cool(f, 1);
  assert.deepEqual([f.lines[3].value, f.cool], [-1.25, 2], 'a step down for a band below 0');
  Items.cool(f, 5);
  assert.deepEqual([f.lines[0].value, f.lines[1].value, f.lines[3].value, f.cool], [6, 7, -1.5, 0], 'two more steps and no more: the four are spent');
  Items.cool(f, 3);
  assert.deepEqual([f.lines[0].value, f.cool], [6, 0], 'a find that has cooled does not rise');
  const top = blank('test.rope');
  top.lines[0] = line('stood', 'damage', 8, { band: [4, 8] });
  top.cool = 2;
  Items.cool(top, 1);
  assert.deepEqual([top.lines[0].value, top.cool], [8, 1], 'a line at the top stays there, and the toll still counts');
  const none = blank();
  none.cool = 4;
  Items.cool(none, 9);
  assert.equal(none.cool, 0, 'a blank recast find cools all the same');
});

test('Char.end cools every recast find of the chest by the tolls heard; first worn, a find stops cooling', () => {
  const save = SaveData.blank(), c = Char.create(save, 'test.ringer', 'Agnes'), hot = blank('test.coat');
  hot.uid = SaveData.uid(save);
  hot.lines[0] = line('stood', 'damage', 4, { band: [4, 8] });
  hot.cool = 4;
  save.chest.finds.push(hot);
  const cfg = Char.begin(save, c.uid, 'debug', 1);
  Char.end(save, { cfg, toll: 2, hum: 0, coin: 0, haul: [], bank: { coin: 0, finds: [] }, cause: null, sheet: { stats: { 'hum-gain': 100 } }, result: { outcome: 'left', zone: 'debug', tolls: 2 } });
  const kept = save.chest.finds[0];
  assert.deepEqual([kept.cool, kept.lines[0].value], [2, 6], 'two tolls heard: two steps');
  assert.ok(Char.equip(Char.find(save, c.uid), kept.uid, 'coat', save.chest));
  assert.equal(kept.cool, 0);
  assert.deepEqual(plain(SaveData.validate(save)), []);
});

// ---- the four changes ----

test('Items.price: the change\'s own price, rising 10% a level above the first and 25% a notch; a recast costs both finds', () => {
  const f = blank('test.coat');
  assert.deepEqual(plain(Items.CHANGES.map((k) => Items.price(f, k))), [6, 4, 8, 10], 'a blank find of level 1');
  const old = blank('test.coat', 11);
  assert.deepEqual(plain(Items.CHANGES.map((k) => Items.price(old, k))), [12, 8, 16, 20], 'ten levels above the first: twice');
  for (let i = 0; i < 4; i++) old.lines[i] = line('stood', 'damage', 5);
  assert.deepEqual(plain(Items.CHANGES.map((k) => Items.price(old, k))), [24, 16, 32, 40], 'and four notches: twice again');
  assert.equal(Items.price(f, 'recast', old), 8 + 32);
  assert.equal(Items.price(f, 'paint'), Infinity, 'what is no change cannot be bought');
});

test('chisel: one word a line, struck for good; a struck line works at 60%, for all or always', () => {
  const f = blank('test.rope');
  f.lines[0] = line('stood', 'damage', 10, { tags: ['round'] });
  f.lines[1] = line('stood', 'damage', 10);
  assert.equal(Items.refusal(f, 'chisel', 0, 'object'), null);
  assert.ok(Items.chisel(f, 0, 'object'));
  assert.equal(f.lines[0].struck, 'object');
  assert.deepEqual(plain(Char.lineMod(f.lines[0], 1)), { stat: 'damage', op: 'inc', value: 6, cond: 'braced' }, 'for all, at 60%');
  assert.equal(Items.chisel(f, 0, 'condition'), false, 'one word a line');
  assert.equal(Items.refusal(f, 'chisel', 0, 'condition'), 'struck');
  assert.equal(Items.refusal(f, 'chisel', 1, 'object'), 'all', 'a line for all has no object to strike');
  assert.ok(Items.chisel(f, 1, 'condition'));
  assert.deepEqual(plain(Char.lineMod(f.lines[1], 1)), { stat: 'damage', op: 'inc', value: 6 }, 'always, at 60%');
  assert.deepEqual([Items.refusal(f, 'chisel', 2, 'object'), Items.refusal(f, 'chisel', 8, 'object'), Items.refusal(f, 'chisel', 0.5, 'object'),
    Items.refusal(f, 'chisel', 0, 'verb')], ['empty', 'place', 'place', 'word']);
  assert.equal(Items.chisel(f, 2, 'object'), false);
  assert.equal(Items.refusal(f, 'polish', 0), 'change');
});

test('re-walk: a line struck out and its place marked; one place at a time', () => {
  const f = blank('test.rope');
  f.lines[3] = line('stood', 'damage', 10);
  f.lines[4] = line('stood', 'damage', 10);
  assert.equal(Items.refusal(f, 'rewalk', 2), 'empty');
  assert.ok(Items.rewalk(f, 3));
  assert.deepEqual([f.lines[3], f.walk, Char.notches(f)], [null, 3, 1]);
  assert.equal(Items.rewalk(f, 4), false);
  assert.equal(Items.refusal(f, 'rewalk', 4), 'walking', 'a re-walk waits on this find already');
  assert.equal(Items.write(runAt(2), f, 'strode'), 3, 'the next line written goes into the struck place');
  assert.deepEqual(plain(SaveData.validate(Object.assign(SaveData.blank(), { uid: 5, chest: { finds: [Object.assign(f, { uid: 5 })], voices: [], knots: {} } }))), []);
});

test('re-walk at the end of a vigil: rung down it keeps the line the toll wrote; dead, the place and both its neighbours are erased', () => {
  for (const outcome of ['left', 'died']) {
    const save = SaveData.blank(), c = Char.create(save, 'test.ringer', 'Agnes'), coat = c.worn.coat;
    for (let i = 0; i < 6; i++) coat.lines[i] = line('stood', 'damage', i + 1);
    assert.ok(Items.rewalk(coat, 2));
    const cfg = Char.begin(save, c.uid, 'debug', 1);
    Items.write(runAt(1), cfg.char.worn.coat, 'pressed');     // the first toll survived wearing it
    Char.end(save, { cfg, toll: 1, hum: 0, coin: 0, haul: [], bank: { coin: 0, finds: [] }, cause: null, sheet: { stats: { 'hum-gain': 100 } },
      result: { outcome, zone: 'debug', tolls: 1 } });
    if (outcome === 'left') {
      const kept = Char.find(save, c.uid).worn.coat;
      assert.deepEqual([kept.walk, kept.lines[2].posture], [-1, 'pressed'], 'rung down: the new line is kept');
    } else {
      const left = save.chest.finds.find((f) => f.base === 'test.coat');
      assert.deepEqual([plain(left.lines.map((l) => (l ? l.value : null))), plain(left.gone), left.walk],
        [[1, null, null, null, 5, 6, null, null], [1, 2, 3], -1], 'dead: the place and both its neighbours erased for good');
    }
    assert.deepEqual(plain(SaveData.validate(save)), []);
  }
});

test('recast: the first poured gives its base, fixed line and lines 1 to 4, the last lines 5 to 8; blanks stay blank; the higher level; cool 4', () => {
  const a = Items.make('test.coat', 2, 11, 0), z = Items.make('test.coat', 5, 12, 1);
  for (let i = 0; i < 8; i++) { a.lines[i] = line('stood', 'damage', 10 + i); z.lines[i] = line('strode', 'damage', 20 + i); }
  a.lines[1] = null;
  z.lines[6] = null;
  z.lines[5] = null;
  z.gone = [5];
  const r = Items.recast(a, z, 13);
  assert.deepEqual([r.uid, r.base, r.level, r.cool, r.walk, plain(r.gone), plain(r.fixed)], [13, 'test.coat', 5, 4, -1, [5], plain(a.fixed)]);
  assert.deepEqual(plain(r.lines.map((l) => (l ? l.value : null))), [10, null, 12, 13, 24, null, null, 27]);
  assert.notEqual(r.lines[0], a.lines[0], 'the lines are the new find\'s own');
  assert.equal(Char.notches(a), 7, 'the poured finds are untouched: the caller takes them out of the chest');
  const back = Items.recast(z, a, 14);
  assert.deepEqual([back.level, back.fixed.value, plain(back.gone), back.lines[0].value, back.lines[7].value], [5, 3, [], 20, 17], 'the other order');
  assert.equal(Items.recast(a, a, 15), null);
  assert.equal(Items.refusal(a, 'recast', a), 'same');
  assert.equal(Items.recast(a, blank('test.rope'), 15), null);
  assert.equal(Items.refusal(a, 'recast', blank('test.rope')), 'slot', 'only finds of one slot pour together');
  const t1 = Items.make('test.token', 1, 21, 0), t2 = Items.make('test.token', 1, 22, 0);
  assert.equal(Items.refusal(t1, 'recast', t2), null, 'two tokens');
  const save = SaveData.blank();
  save.uid = 15;
  save.chest.finds.push(r, back);
  back.uid = 14;
  assert.deepEqual(plain(SaveData.validate(save)), []);
});

test('cut: a line away for good; every other line, its value and its band, rises 10%', () => {
  const f = blank('test.coat');
  f.lines[0] = line('stood', 'damage', 10, { band: [8, 12] });
  f.lines[2] = line('strode', 'stride-share', -1, { op: 'flat', band: [-2, -0.5] });
  f.lines[4] = line('stood', 'damage', 7);
  assert.equal(Items.refusal(f, 'cut', 1), 'empty');
  assert.ok(Items.cut(f, 4));
  assert.deepEqual([f.lines[4], plain(f.gone), Char.notches(f)], [null, [4], 2]);
  assert.ok(Math.abs(f.lines[0].value - 11) < 1e-9 && Math.abs(f.lines[0].band[1] - 13.2) < 1e-9);
  assert.ok(Math.abs(f.lines[2].value + 1.1) < 1e-9, 'a line below 0 grows larger below it');
  assert.ok(Math.abs(Items.strength(f.lines[0]) - 0.5) < 1e-9, 'and keeps its place within its band');
  assert.ok(Items.cut(f, 0));
  assert.deepEqual(plain(f.gone), [0, 4], 'gone is kept in order');
  assert.equal(Items.write(runAt(1), f, 'stood'), 1, 'a place gone for good is passed by');
  assert.equal(Items.cut(f, 0), false, 'nothing is left there to cut');
  const save = SaveData.blank();
  save.uid = 1;
  save.chest.finds.push(f);
  assert.deepEqual(plain(SaveData.validate(save)), []);
});

// ---- the bases a district drops, and which objects fit which verbs ----

test('Items.draw: the bases of a district\'s level and below, by weight; one with an unlock only once a bequest opened it', () => {
  const rng = new Core.RNG(3), seen = {};
  for (let i = 0; i < 2000; i++) { const id = Items.draw(rng, [], 1); seen[id] = (seen[id] || 0) + 1; }
  assert.deepEqual(Object.keys(seen).sort(), ['test.coat', 'test.rope', 'test.token'], 'none of a higher level, none locked, none of weight 0');
  assert.ok(seen['test.token'] > 1100 && seen['test.token'] < 1300, `by weight, 3 to 1 to 1: ${seen['test.token']} of 2000`);
  const opened = new Set();
  for (let i = 0; i < 400; i++) opened.add(Items.draw(rng, ['test.locked'], 5));
  assert.ok(opened.has('test.locked') && opened.has('test.high') && !opened.has('test.never'));
  assert.equal(Items.draw(rng, [], 0), null, 'nothing drops below the first level');
});

test('Items.fits: a line on a stat of the player\'s own sheet is held to nothing; a voice\'s stat to the tags of voices and kinds', () => {
  assert.ok(Items.fits('guard.blow', []) && !Items.fits('guard.blow', ['round']) && !Items.fits('move-speed', ['moving']));
  assert.ok(Items.fits('damage', ['round']) && Items.fits('damage', ['drag']) && Items.fits('speed', ['still', 'hit']) && Items.fits('area', ['planted']));
  assert.ok(Items.fits('added.drag', ['held']) && Items.fits('added.drag', ['drag']) && Items.fits('added.drag', ['dot']));
  assert.ok(!Items.fits('added.drag', ['blow']) && !Items.fits('through.blow', ['dot']), 'a stat of one kind of harm, held to another kind: it would never hold');
  assert.ok(Items.fits('taken', ['blow']) && !Items.fits('taken', ['round']), 'harm taken is held only by kind');
  assert.ok(Items.fits('chance.coined', ['coined']) && Items.fits('cond-duration', ['coined']) && !Items.fits('damage', ['coined']));
  assert.ok(!Items.fits('damage', ['rope']), 'a family: no tool is held as a weapon, so it never holds');
  assert.ok(!Items.fits('damage', ['no-such-tag']) && !Items.fits('no-such-stat', ['round']));
});

// ---- the content: 33-bases.js and 34-postures.js ----
// Loaded with what they stand on and the class that names its gear, booted as the page boots: their definitions are
// checked by Defs.finalize, and other packages' content in the making cannot disturb these tests.

const CONTENT = FILES.concat(['11-damage.js', '12-items.js', '21-player.js', '23-skills.js', '24-archetypes.js', '31-change-ringer.js', '33-bases.js', '34-postures.js']);

test('the content: four posture tables of stats and conditions of 10-stats.js, their bands rising toll by toll', () => {
  const sim = loadSim({ only: CONTENT, boot: true });
  const { Defs: D, Stats: St, Items: I } = sim;
  assert.deepEqual(plain(D.all('posture').map((p) => p.id).sort()), plain(St.POSTURES.map((p) => p.id).sort()), 'one table for each posture');
  for (const p of D.all('posture')) {
    assert.ok(p.verbs.length >= 10 && p.objects.length >= 5, `${p.id} has room to vary`);
    assert.ok(p.objects.some((o) => o.tags.length === 0), `${p.id} has an object for all`);
    for (const v of p.verbs) {
      assert.ok(St.stat(v.stat) !== null && (v.op === 'flat' || v.op === 'inc'), `${p.id}.${v.key}`);
      const below = v.band[0][1] <= 0;
      for (let t = 0; t < 8; t++) {
        const b = v.band[t];
        assert.ok(b[0] <= b[1] && (below ? b[1] <= 0 : b[0] >= 0), `${p.id}.${v.key} band ${t + 1} lies on one side of nothing`);
        if (t > 0) assert.ok(Math.abs(b[0]) > Math.abs(v.band[t - 1][0]) && Math.abs(b[1]) > Math.abs(v.band[t - 1][1]), `${p.id}.${v.key} rises with the toll`);
      }
      assert.ok(p.objects.some((o) => o.w > 0 && I.fits(v.stat, o.tags)), `${p.id}.${v.key} has an object that fits it`);
    }
  }
});

test('the content: bases for the seven slots, a family for each tool, named finds alone using more, the Change-ringer\'s gear', () => {
  const sim = loadSim({ only: CONTENT, boot: true });
  const { Defs: D, Items: I, SaveData: SD, Char: C, Core: Co } = sim;
  const bases = D.all('base'), slots = new Set(bases.map((b) => b.slot));
  assert.deepEqual([...slots].sort(), ['coat', 'girdle', 'hands', 'hat', 'pattens', 'token', 'tool']);
  assert.deepEqual(plain(bases.filter((b) => b.slot === 'tool').map((b) => b.family).sort()), ['bellows', 'pike', 'pole', 'rope', 'spade', 'verge']);
  for (const b of bases) {
    assert.equal(b.fixed.op === 'more', b.named === true && b.fixed.op === 'more', `${b.id}: more only on a named find`);
    assert.equal(b.unlock, null);
    assert.ok(b.weight > 0 && b.level === 1, `${b.id} drops in the Dial`);
  }
  assert.ok(bases.filter((b) => b.named).every((b) => b.weight < 1), 'the named are rare');
  assert.deepEqual(plain(D.get('class', 'change-ringer').startGear), ['base.bell-rope', 'base.ringers-jerkin']);
  assert.deepEqual(plain(D.get('base', 'base.bell-rope').fixed), { stat: 'pull-window', op: 'flat', min: 0.05, max: 0.05 }, 'the design\'s bell-rope');
  const save = SD.blank(), c = C.create(save, 'change-ringer', 'Agnes');
  assert.deepEqual([c.worn.tool.base, c.worn.tool.fixed.value, c.worn.coat.base], ['base.bell-rope', 0.05, 'base.ringers-jerkin']);
  // every base, written by every posture at the eighth toll and rolled at both ends, makes a find the save takes
  const rng = new Co.RNG(9), S = { rng: { loot: rng }, toll: 8, sheet: { stats: { 'notch-size': 100 } } };
  for (const b of bases) {
    for (const roll of [0, 1]) {
      const f = I.make(b.id, 1, SD.uid(save), roll);
      for (let i = 0; i < 8; i++) assert.ok(I.write(S, f, sim.Stats.POSTURES[i % 4].id) >= 0);
      save.chest.finds.push(f);
    }
  }
  assert.deepEqual(plain(SD.validate(save)), []);
});
