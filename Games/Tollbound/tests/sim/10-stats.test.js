// tests/sim/10-stats.test.js: the stat tables, what modifiers add up to, the player's sheet and a voice's sheet
// (src/js/10-stats.js). The rows are those of docs/design/02-combat.md, sections 15.1 to 15.8, and every number in
// these tests is worked out by hand from those rows in the comments beside it.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');

// The stat rules need only the core, the registries and the tables. Loading just those three files gives
// registries with nothing in them, so the voices of these tests never meet the ids of the game's own content.
const kernel = () => loadSim({ only: ['00-core.js', '01-defs.js', '10-stats.js'] });

const { Stats } = kernel();
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
const nearAll = (list, expected, eps) => { assert.equal(list.length, expected.length); expected.forEach((v, i) => near(list[i], v, eps)); };
const mod = (stat, op, value, more) => Object.assign({ stat, op, value }, more);
const q = (mods, stat, tags, conds, primaries) => Stats.query(mods, stat, tags, conds, primaries);
const ids = (rows) => Array.from(rows, (r) => r.id);

// every arrangement of a short list
function orders(list) {
  if (list.length < 2) return [list];
  return list.flatMap((item, i) => orders([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [item, ...rest]));
}

// ---- tables ----

test('the kinds of harm, the families and the attributes are the rows of sections 15.1 to 15.4', () => {
  assert.deepEqual(plain(Stats.TYPES), [
    { id: 'blow', guard: 'brace', shown: 'windup', ticks: false, bare: false, guardBase: 50, guardMax: 80 },
    { id: 'drag', guard: 'stride', shown: 'none', ticks: true, bare: false, guardBase: 60, guardMax: 85 },
    { id: 'swell', guard: 'lee', shown: 'fill', ticks: false, bare: true, guardBase: 0, guardMax: 0 },
  ]);
  assert.deepEqual(plain(Stats.FAMILIES), ['rope', 'verge', 'pike', 'pole', 'bellows', 'spade']);
  assert.deepEqual(plain(Stats.PRIMARIES), [
    { id: 'knee', gives: [
      { stat: 'life-max', op: 'flat', value: 2, div: 1 },
      { stat: 'damage', op: 'inc', value: 1, div: 1, tags: ['still'] },
      { stat: 'brace-time', op: 'flat', value: -0.03, div: 10 },
      { stat: 'guard.blow', op: 'flat', value: 2, div: 10 }] },
    { id: 'heel', gives: [
      { stat: 'move-speed', op: 'inc', value: 0.25, div: 1 },
      { stat: 'damage', op: 'inc', value: 1, div: 1, tags: ['moving'] },
      { stat: 'stride-share', op: 'flat', value: -1, div: 10 }] },
    { id: 'hand', gives: [
      { stat: 'damage', op: 'inc', value: 1, div: 1, cond: 't-near' },
      { stat: 'pickup-reach', op: 'inc', value: 1, div: 1 },
      { stat: 'mend-reach', op: 'flat', value: 0.1, div: 10 }] },
    { id: 'ear', gives: [
      { stat: 'damage', op: 'inc', value: 1, div: 1, tags: ['timed'] },
      { stat: 'heed-max', op: 'flat', value: 1, div: 1 },
      { stat: 'warn', op: 'flat', value: 0.05, div: 10 }] },
  ]);
  assert.deepEqual(plain(Stats.PER), ['knee', 'heel', 'hand', 'ear', 'level', 'observances', 'favours', 'finds', 'debts']);
  assert.deepEqual(plain(Stats.WANTS), { voice: 10, knot: 6, line: 4 }, 'section 14: what a voice, a knot and a written line want');
  assert.equal(Stats.LEVEL_MAX, 20);
  // what a toll period was spent doing writes the line (04-progression): its condition, and what a find of it wants (14)
  assert.deepEqual(plain(Stats.POSTURES), [
    { id: 'stood', cond: 'braced', attr: 'knee' }, { id: 'strode', cond: 'striding', attr: 'heel' },
    { id: 'pressed', cond: 'crowded', attr: 'hand' }, { id: 'timed', cond: 'after-quarter', attr: 'ear' },
  ]);
  assert.deepEqual(plain(Stats.POSTURE), { stood: 0, strode: 1, pressed: 2, timed: 3 });
  assert.equal(Stats.is('posture', 'pressed') && !Stats.is('posture', 'crowded'), true);
});

test('the conditions a body carries are the fifteen rows of section 15.5', () => {
  assert.deepEqual(plain(Stats.AILMENTS), [
    { id: 'wrong-footed', by: 'rule', rule: 'footing', on: 'both', seconds: 0.5, keeperSeconds: 0.25, cond: 't-wrong-footed', player: true },
    { id: 'in-procession', by: 'rule', rule: 'procession', on: 'dead', spares: ['elite', 'keeper'], cond: 't-in-procession', player: false },
    { id: 'moored', by: 'effect', on: 'dead', spares: ['keeper'], seconds: 4, stacks: 12, immune: 6, cond: 't-moored', player: false },
    { id: 'sounded', by: 'rule', rule: 'sounding', on: 'dead', spares: ['small'], seconds: 6, cond: 't-sounded', player: false },
    { id: 'coiled', by: 'rule', rule: 'coiling', on: 'dead', spares: ['small'], seconds: 10, stacks: 3, cond: 't-coiled', player: false },
    { id: 'mourning', by: 'rule', rule: 'mourning', on: 'dead', spares: ['elite', 'keeper'], seconds: 12, cond: 't-mourning', player: false },
    { id: 'clung', by: 'rule', rule: 'riders', on: 'both', spares: ['small'], stacks: 5, cond: null, player: true },
    { id: 'coined', by: 'effect', chance: true, on: 'dead', spares: ['keeper'], seconds: 5, cond: 't-coined', player: false },
    { id: 'swing', by: 'rule', rule: 'swing', on: 'both', stacks: 6, keeperStacks: 12, cond: null, player: true },
    { id: 'sealed', by: 'effect', chance: true, on: 'both', seconds: 15, amount: [8, 8], cond: 't-sealed', player: true },
    { id: 'brined', by: 'effect', chance: true, on: 'both', stacks: 20, playerStacks: 10, immune: 3, cond: 't-brined', player: true },
    { id: 'tolled-for', by: 'rule', rule: 'reprieve', on: 'player', cond: null, player: true },
    { id: 'filed', by: 'effect', on: 'dead', spares: ['elite', 'keeper'], seconds: 5, cond: null, player: false },
    { id: 'tolled', by: 'rule', rule: 'toll-bar', on: 'dead', seconds: 10, stacks: 8, cond: null, player: false },
    { id: 'burgess', by: 'effect', on: 'dead', spares: ['elite', 'keeper'], cond: null, player: false },
  ]);
  assert.equal(Stats.COND_MAX, 16, 'sixteen places for fifteen conditions: COND_MAX is kept');
  assert.ok(Stats.AILMENTS.length <= Stats.COND_MAX);
  // the behaviour of each condition laid by a rule finds its row by the rule's id
  assert.deepEqual(plain(Stats.RULE), { footing: 0, procession: 1, sounding: 3, coiling: 4, mourning: 5, riders: 6, swing: 8, reprieve: 11, 'toll-bar': 13 });
  for (const [i, a] of Stats.AILMENTS.entries()) {
    assert.equal(a.by === 'rule' ? Stats.RULE[a.rule] : undefined, a.by === 'rule' ? i : undefined, `${a.id}: its rule finds it`);
    assert.equal(a.player, a.on !== 'dead', `${a.id}: the player carries it exactly when it is not only for the dead`);
    for (const s of a.spares || []) assert.ok(['small', 'large', 'elite', 'keeper'].includes(s), `${a.id} spares ${s}`);
  }
  // a chance row makes a chance.<id> stat
  assert.deepEqual(plain(Stats.STATS.filter((r) => r.id.startsWith('chance.')).map((r) => r.id)), ['chance.coined', 'chance.sealed', 'chance.brined']);
});

test('the tags and the modifier conditions are those of sections 15.6 and 15.7', () => {
  const roles = ['attack', 'hit', 'dot', 'still', 'moving', 'timed', 'thrown', 'ground', 'line', 'round', 'planted', 'held', 'turn', 'crossing',
    'water', 'trade', 'heave'];
  assert.deepEqual(plain(Stats.TAGS), ['blow', 'drag', 'swell', ...plain(Stats.FAMILIES), ...roles, ...ids(Stats.AILMENTS)]);
  assert.equal(Stats.TAGS.length, 41);
  const player = ['braced', 'striding', 'crowded', 'after-quarter', 'wrong-footed', 'in-water', 'dry', 'on-wound', 'laden', 'scarred', 'faint',
    'at-post', 'in-light', 'tolled-for'];
  const target = ['t-braced', 't-striding', 't-large', 't-elite', 't-keeper', 't-near', 't-far', 't-in-water'];
  const followers = ['t-wrong-footed', 't-in-procession', 't-moored', 't-sounded', 't-coiled', 't-mourning', 't-coined', 't-sealed', 't-brined'];
  assert.deepEqual(ids(Stats.CONDS), [...player, ...target, ...followers]);
  assert.equal(Stats.CONDS.length, 31, '31 bits, the most one number holds');
  for (const c of Stats.CONDS) {
    assert.equal(c.target, !player.includes(c.id), `${c.id} is ${c.target ? '' : 'not '}about the body struck`);
    const row = Stats.AILMENTS.find((a) => a.cond === c.id);
    assert.equal(c.ailment, row ? row.id : null, `${c.id} follows ${row ? row.id : 'no condition'}`);
  }
  assert.equal(Stats.condMask(['t-brined']) >>> 0, 2 ** 30, 'the last bit is bit 30');
});

// [id, base, least, most, marks]: section 15.8 and the families made from the tables
const ROWS = [
  ['knee', 0, 0, 1e5, 'i'], ['heel', 0, 0, 1e5, 'i'], ['hand', 0, 0, 1e5, 'i'], ['ear', 0, 0, 1e5, 'i'],
  ['life-max', 60, 1, 1e7], ['wound-term', 60, 10, 300], ['wound-join', 2, 0, 5], ['wound-cap', 10, 3, 20, 'i'],
  ['mend-rate', 100, 10, 1000, '%'], ['mend-reach', 1, 0.5, 2.5], ['mend-on-lay', 0, 0, 100], ['scarring', 100, 0, 100, '%'],
  ['brace-time', 0.4, 0.1, 2], ['stride-share', 70, 40, 95], ['lee-reach', 3, 1, 6], ['turn-limit', 90, 45, 170],
  ['wrong-foot-taken', 50, 0, 200], ['guard.all', 0, -100, 100], ['taken', 100, 0, 1000, '%'],
  ['move-speed', 4.5, 0.5, 15], ['shove-taken', 100, 0, 300, '%'], ['find-weight', 1.5, 0, 5], ['find-steady', 4, 0, 10],
  ['pickup-reach', 2.5, 0, 40], ['wake-lag', 1.2, 0.6, 2.5], ['wake-length', 5, 2, 12], ['heed-max', 100, 0, 400], ['warn', 0, 0, 1],
  ['trade-recharge', 100, 25, 400, '%'], ['heave-recharge', 4, 1, 20], ['heave-harm', 100, 0, 1000, '%'],
  ['pull-window', 0.3, 0.1, 0.6], ['set-time', 1, 0.3, 3], ['wedge-length', 3, 1, 8], ['bar-length', 7, 3, 14],
  ['lamp-burn', 45, 10, 120], ['chest-size', 30, 10, 90, 'i'], ['dig-rate', 1, 0.25, 4],
  ['procession-cap', 40, 0, 80, 'i'], ['procession-bonus', 30, 0, 100], ['sound-time', 2, 0.5, 5],
  ['xp-gain', 100, 0, 1000, '%'], ['coin-find', 100, 0, 1000, '%'], ['find-chance', 100, 0, 1000, '%'], ['hum-gain', 100, 0, 1000, '%'],
  ['notch-size', 100, 0, 500, '%'], ['damage', 100, 0, 1e6, '%'], ['speed', 100, 10, 1000, '%'], ['area', 100, 10, 1000, 's%'],
  ['reach', 100, 10, 1000, 's%'], ['duration', 100, 10, 1000, 's%'], ['throws', 0, 0, 50, 'si'], ['pierce', 0, 0, 99, 'si'],
  ['throw-speed', 100, 10, 1000, 's%'], ['shove', 0, 0, 30, 's'], ['wrong-foot', 50, 0, 300, 's'], ['cond-duration', 100, 10, 1000, '%'],
  ['guard.blow', 50, 0, 100], ['guard.drag', 60, 0, 100], ['guard.swell', 0, 0, 0],
  ['guard-max.blow', 80, 0, 90], ['guard-max.drag', 85, 0, 90], ['guard-max.swell', 0, 0, 0],
  ['through.blow', 0, 0, 100], ['through.drag', 0, 0, 100], ['through.swell', 0, 0, 0],
  ['added.blow', 0, 0, 1e7, 'r'], ['added.drag', 0, 0, 1e7, 'r'], ['added.swell', 0, 0, 1e7, 'r'],
  ['chance.coined', 0, 0, 100], ['chance.sealed', 0, 0, 100], ['chance.brined', 0, 0, 100],
];

test('every stat of section 15.8 has its row, with its base, least, most and marks', () => {
  assert.deepEqual(ids(Stats.STATS), [...ROWS.map((r) => r[0]), 'flag.*', 'param.*'], 'the rows, in the order the tables make them');
  for (const [id, base, min, max, marks = ''] of ROWS) {
    const row = Stats.stat(id);
    assert.ok(row, `the stat ${id}`);
    assert.deepEqual([row.base, row.min, row.max], [base, min, max], id);
    assert.deepEqual([!!row.skill, !!row.pct, !!row.int, !!row.range], [marks.includes('s'), marks.includes('%'), marks.includes('i'), marks.includes('r')], `${id}: its marks`);
  }
  // 65 that a tree node, a line or a knot can change, beside the four attributes, the three fixed rows of the bare
  // Swell and the two prefix rows
  const fixed = plain(Stats.STATS.filter((r) => !r.prefix && r.min === r.max).map((r) => r.id));
  assert.deepEqual(fixed, ['guard.swell', 'guard-max.swell', 'through.swell']);
  assert.equal(Stats.STATS.length - 4 - fixed.length - 2, 65);
  assert.equal(new Set(ids(Stats.STATS)).size, Stats.STATS.length, 'no stat twice');
  assert.equal(Stats.stat('flag.unbroken').prefix, 'flag.', 'any flag.<id> is a stat');
  assert.equal(Stats.stat('param.count').prefix, 'param.');
  // the rows of the first plan are gone
  for (const gone of ['lifeMax', 'hushMax', 'armour', 'evasion', 'res.blow', 'resMax.blow', 'res.all', 'res.elemental', 'pen.blow', 'gainAsExtra.blow',
    'critChance', 'critMulti', 'moveSpeed', 'dodgeCooldown', 'draughtCharges', 'ailmentDuration', 'chance.ignite', 'build.freeze', 'str', 'dex', 'int']) {
    assert.equal(Stats.stat(gone), null, `${gone} is no stat`);
  }
  for (const bad of ['life-maxx', 'flag.', 'param.', 'flag', 'guard.fire', 'chance.wrong-footed', 'constructor', 'toString', '', undefined, null, 5]) {
    assert.equal(Stats.stat(bad), null, `"${bad}" is not a stat`);
  }
});

test('index maps and membership follow the tables', () => {
  Stats.TYPES.forEach((t, i) => assert.equal(Stats.TYPE[t.id], i));
  Stats.AILMENTS.forEach((a, i) => assert.equal(Stats.AILMENT[a.id], i));
  Stats.CONDS.forEach((c, i) => assert.equal(Stats.COND[c.id], i));
  assert.equal(Stats.TYPE.constructor, undefined, 'the maps have nothing but their rows');
  assert.equal(Stats.RULE.constructor, undefined);
  const yes = { stat: 'life-max', tag: 'round', cond: 'faint', harm: 'drag', family: 'pike', primary: 'ear', counted: 'debts', ailment: 'swing' };
  for (const [table, id] of Object.entries(yes)) {
    assert.equal(Stats.is(table, id), true, `${id} is a ${table}`);
    assert.equal(Stats.is(table, id + 'x'), false);
    assert.equal(Stats.is(table, 'constructor'), false);
  }
  assert.equal(Stats.is('stat', 'flag.anything'), true);
  assert.equal(Stats.is('counted', 'life'), false);
  assert.equal(Stats.is('tag', 'wrong-footed') && Stats.is('cond', 'wrong-footed') && Stats.is('ailment', 'wrong-footed'), true,
    'a condition id is a tag, a modifier condition of the player and a row, each in its own table');
  assert.throws(() => Stats.is('dtype', 'blow'), /no table/);
  assert.equal(Stats.condMask(['faint', 't-keeper']), (1 << Stats.COND.faint) | (1 << Stats.COND['t-keeper']));
  assert.equal(Stats.condMask(['nonsense']), 0);
  assert.equal(Stats.condMask(), 0);
  assert.equal(Stats.condMask(5), 5, 'a mask passes through');
  assert.ok(Object.isFrozen(Stats.STATS) && Object.isFrozen(Stats.STATS[0]) && Object.isFrozen(Stats.AILMENTS[0]) &&
    Object.isFrozen(Stats.AILMENTS[1].spares) && Object.isFrozen(Stats.PRIMARIES[0].gives[1].tags) && Object.isFrozen(Stats.RULE), 'the tables are frozen');
});

// ---- scaled values, and the share rule ----

test('a Scaled value runs from a at level 1 to b at level 20', () => {
  assert.equal(Stats.scaled(7, 1), 7);
  assert.equal(Stats.scaled(7, 20), 7);
  const lin = { a: 10, b: 48, curve: 'lin' };
  assert.equal(Stats.scaled(lin, 1), 10);
  assert.equal(Stats.scaled(lin, 20), 48);
  near(Stats.scaled(lin, 2), 12);                      // 19 equal steps of (48 - 10) / 19 = 2
  near(Stats.scaled(lin, 11), 30);
  const exp = { a: 2, b: 32, curve: 'exp' };
  near(Stats.scaled(exp, 1), 2);
  near(Stats.scaled(exp, 20), 32);
  near(Stats.scaled(exp, 10.5), 8);                    // half way in level is the geometric middle: sqrt(2 * 32)
  near(Stats.scaled(exp, 2) / Stats.scaled(exp, 1), Stats.scaled(exp, 14) / Stats.scaled(exp, 13));   // equal factors
  near(Stats.scaled({ a: 100, b: 25, curve: 'exp' }, 10.5), 50);
  assert.equal(Stats.scaled(lin, 0), 10, 'below level 1 counts as 1');
  assert.equal(Stats.scaled(lin, 99), 48, 'above level 20 counts as 20');
  assert.equal(Stats.scaled({ a: 3, b: 9 }, 20), 9, 'no curve named: linear');
});

test('the share rule: below what it wants, a thing works at your value divided by it, from 20% to 100%', () => {
  assert.equal(Stats.share(10, 10), 1);
  assert.equal(Stats.share(5, 10), 0.5);
  assert.equal(Stats.share(3, 10), 0.3);
  assert.equal(Stats.share(1, 10), 0.2, 'a tenth is held up to the least, a fifth');
  assert.equal(Stats.share(0, 10), 0.2, 'nothing is locked');
  assert.equal(Stats.share(-5, 10), 0.2);
  assert.equal(Stats.share(25, 10), 1, 'more than it wants gives no more');
  assert.equal(Stats.share(0, 0), 1, 'a thing that wants nothing works in full');
  near(Stats.share(5, 6), 5 / 6);
});

test('resolve works Scaled values out at a level and leaves plain modifiers alone', () => {
  const plainMod = mod('life-max', 'flat', 5), pair = mod('added.blow', 'flat', [1, 2]);
  const scaledMod = mod('damage', 'inc', { a: 10, b: 29, curve: 'lin' }, { tags: ['blow'] });
  const scaledPair = mod('added.drag', 'flat', [{ a: 1, b: 20, curve: 'lin' }, 30]);
  const out = Stats.resolve([plainMod, pair, scaledMod, scaledPair], 11);
  assert.equal(out.length, 4);
  assert.equal(out[0], plainMod, 'a modifier of plain numbers is passed on as it is');
  assert.equal(out[1], pair);
  assert.deepEqual(plain(out[2]), { stat: 'damage', op: 'inc', value: 20, tags: ['blow'] });   // 10 + 19 * 10 / 19
  assert.deepEqual(plain(out[3]), { stat: 'added.drag', op: 'flat', value: [11, 30] });       // 1 + 19 * 10 / 19
  assert.equal(scaledMod.value.a, 10, 'the original is not touched');
  const into = ['kept'];
  assert.equal(Stats.resolve([plainMod], 3, into), into);
  assert.deepEqual(into, ['kept', plainMod]);
  assert.equal(Stats.resolve(undefined, 3).length, 0);
});

// ---- one stat from a list of modifiers ----

test('flat adds to the base, inc adds up, more multiplies, set wins', () => {
  assert.equal(q([], 'life-max'), 60, 'no modifiers: the base');
  assert.equal(q([mod('life-max', 'flat', 40)], 'life-max'), 100);
  // (60 + 40) * (1 + (10 + 20) / 100) = 130
  near(q([mod('life-max', 'flat', 40), mod('life-max', 'inc', 10), mod('life-max', 'inc', 20)], 'life-max'), 130);
  // 100 * 1.3 * 1.1 * 1.2 = 171.6: each more multiplies on its own
  const list = [mod('life-max', 'flat', 40), mod('life-max', 'inc', 10), mod('life-max', 'inc', 20), mod('life-max', 'more', 10), mod('life-max', 'more', 20)];
  near(q(list, 'life-max'), 171.6);
  // two inc of 50 are +100%, not 1.5 * 1.5; two more of 50 are 2.25
  near(q([mod('life-max', 'inc', 50), mod('life-max', 'inc', 50)], 'life-max'), 120);
  near(q([mod('life-max', 'more', 50), mod('life-max', 'more', 50)], 'life-max'), 135);
  // less is a negative more
  near(q([mod('life-max', 'more', -25)], 'life-max'), 45);
  assert.equal(q([...list, mod('life-max', 'set', 7)], 'life-max'), 7, 'set replaces the whole sum');
  assert.equal(q([mod('life-max', 'set', 300), ...list, mod('life-max', 'set', 9), mod('life-max', 'set', 20)], 'life-max'), 9, 'of several, the lowest');
  assert.equal(q([mod('heed-max', 'flat', 10), mod('mend-on-lay', 'flat', 99)], 'heed-max'), 110, 'other stats do not count');
});

test('the order of the modifiers never matters', () => {
  const list = [mod('life-max', 'flat', 40), mod('life-max', 'inc', 25), mod('life-max', 'more', 50), mod('life-max', 'inc', -5),
    mod('life-max', 'more', -20), mod('life-max', 'flat', 4)];
  const all = orders(list);
  assert.equal(all.length, 720);
  // (60 + 44) * 1.2 * 1.5 * 0.8 = 149.76
  for (const order of all) near(q(order, 'life-max'), 149.76, 1e-9);
  const withSet = orders([mod('pierce', 'set', 4), mod('pierce', 'flat', 9), mod('pierce', 'set', 2), mod('pierce', 'more', 100)]);
  for (const order of withSet) assert.equal(q(order, 'pierce'), 2);
});

test('a modifier counts only when all its tags are among the tags asked for', () => {
  const list = [mod('damage', 'inc', 10), mod('damage', 'inc', 20, { tags: ['blow'] }), mod('damage', 'inc', 40, { tags: ['blow', 'still'] }),
    mod('damage', 'inc', 80, { tags: ['drag'] })];
  // damage is a percentage with a base of 100, so these read as "100 plus the inc that counted"
  near(q(list, 'damage'), 110);                        // no tags asked: only the untagged one
  near(q(list, 'damage', []), 110);
  near(q(list, 'damage', ['blow']), 130);
  near(q(list, 'damage', ['still']), 110);             // one of two tags is not enough
  near(q(list, 'damage', ['still', 'hit', 'blow', 'moving']), 170);
  near(q(list, 'damage', ['blow', 'drag', 'still']), 250);
  near(q([mod('damage', 'inc', 5, { tags: [] })], 'damage', ['blow']), 105);   // an empty tag list asks for nothing
});

test('a conditional modifier counts only while its condition holds', () => {
  const list = [mod('damage', 'inc', 10), mod('damage', 'inc', 30, { cond: 'faint' }), mod('damage', 'more', 100, { cond: 't-keeper', tags: ['blow'] })];
  near(q(list, 'damage', ['blow']), 110);
  near(q(list, 'damage', ['blow'], ['faint']), 140);
  near(q(list, 'damage', ['blow'], ['faint', 't-keeper']), 280);
  near(q(list, 'damage', [], ['faint', 't-keeper']), 140);                      // condition met, tag missing
  near(q(list, 'damage', ['blow'], Stats.condMask(['t-keeper'])), 220);         // conditions may come as a mask
  assert.equal(q([mod('damage', 'inc', 30, { cond: 'noSuchCondition' })], 'damage', [], 0xffffffff), 100, 'an unknown condition never holds');
});

test('a condition may be a list, all of which must hold; unless names what must not hold', () => {
  // a corner on the Flood bank (02-combat 15.7, 04-progression): Braced, and in water
  const bank = [mod('damage', 'inc', 50, { cond: ['braced', 'in-water'] })];
  near(q(bank, 'damage', [], ['braced']), 100);
  near(q(bank, 'damage', [], ['in-water']), 100);
  near(q(bank, 'damage', [], ['braced', 'in-water', 'faint']), 150);
  near(q(bank, 'damage', [], ['braced', 'in-water', 'faint']), q([mod('damage', 'inc', 50, { cond: 'braced' })], 'damage', [], ['braced']));   // a list of one or many
  // a line cut backward: it works while you are not Braced
  const backward = [mod('move-speed', 'inc', 20, { unless: 'braced' })];
  near(q(backward, 'move-speed', [], []), 5.4);
  near(q(backward, 'move-speed', [], ['striding']), 5.4);
  near(q(backward, 'move-speed', [], ['braced']), 4.5);
  // both at once, and unless as a list: none of them may hold
  const both = [mod('heed-max', 'flat', 10, { cond: 'dry', unless: ['faint', 'scarred'] })];
  assert.deepEqual([[], ['dry'], ['dry', 'faint'], ['dry', 'scarred'], ['faint']].map((c) => q(both, 'heed-max', [], c)), [100, 110, 100, 100, 100]);
  // an unknown id: in cond nothing ever holds; in unless it keeps nothing out
  assert.equal(q([mod('heed-max', 'flat', 5, { cond: ['dry', 'nowhere'] })], 'heed-max', [], 0xffffffff), 100);
  assert.equal(q([mod('heed-max', 'flat', 5, { unless: 'nowhere' })], 'heed-max', [], []), 105);
  assert.deepEqual([Stats.holds(both[0], ['dry']), Stats.holds(both[0], ['dry', 'faint']), Stats.holds(mod('life-max', 'flat', 1), 0)], [true, false, true]);
});

test('on a sheet, a modifier about the body struck never counts in the sheet\'s own numbers, whatever its unless', () => {
  const mods = [mod('move-speed', 'inc', 20, { unless: 't-braced' }), mod('heed-max', 'flat', 10, { cond: ['dry', 't-near'] }),
    mod('heed-max', 'flat', 1, { cond: 'dry' })];
  const sheet = Stats.sheet(mods, { conds: ['dry'] });
  assert.deepEqual([sheet.stats['move-speed'], sheet.stats['heed-max']], [4.5, 101], 'only the one about the player alone');
  // while Stats.query counts what holds for the conds it is given, as before
  near(q(mods, 'move-speed', [], []), 5.4);
});

test('a per modifier is multiplied by what it counts, up to its cap', () => {
  const per = (stat, div, cap) => (cap === undefined ? { per: { stat, div } } : { per: { stat, div, cap } });
  const prim = { knee: 47, heel: 9, hand: 0, ear: 0, level: 12, observances: 2, favours: 5, finds: 3, debts: 4 };
  // 5 for every 10 Knee: floor(47 / 10) = 4 times
  assert.equal(q([mod('mend-on-lay', 'flat', 5, per('knee', 10))], 'mend-on-lay', [], 0, prim), 20);
  assert.equal(q([mod('mend-on-lay', 'flat', 5, per('knee', 10, 3))], 'mend-on-lay', [], 0, prim), 15, 'capped at 3 times');
  assert.equal(q([mod('mend-on-lay', 'flat', 5, per('knee', 10, 9))], 'mend-on-lay', [], 0, prim), 20, 'a cap that is not reached changes nothing');
  assert.equal(q([mod('mend-on-lay', 'flat', 5, per('heel', 10))], 'mend-on-lay', [], 0, prim), 0, '9 Heel is not yet 10');
  assert.equal(q([mod('mend-on-lay', 'flat', 2, per('level', 1))], 'mend-on-lay', [], 0, prim), 24);
  assert.equal(q([mod('damage', 'inc', 4, per('observances', 1))], 'damage', [], 0, prim), 108);
  assert.equal(q([mod('damage', 'more', 10, per('favours', 2))], 'damage', [], 0, prim), 120, 'floor(5 / 2) = 2 times 10% more');
  near(q([mod('damage', 'inc', 5, per('finds', 1))], 'damage', [], 0, prim), 115);
  near(q([mod('damage', 'inc', 1, per('debts', 1))], 'damage', [], 0, prim), 104);
  assert.equal(q([mod('mend-on-lay', 'flat', 5, per('knee', 10))], 'mend-on-lay'), 0, 'nothing to count: 0 times');
  assert.equal(q([mod('mend-on-lay', 'flat', 5, per('knee', 10))], 'mend-on-lay', [], 0, { knee: -30 }), 0, 'never a negative number of times');
});

test('values are held between the least and the most of their row', () => {
  assert.equal(q([mod('life-max', 'more', -100)], 'life-max'), 1, 'life never falls below 1');
  assert.equal(q([mod('life-max', 'inc', -250)], 'life-max'), 1, 'inc below -100% is 0, not negative');
  assert.equal(q([mod('life-max', 'more', -400)], 'life-max'), 1, 'neither is a more below -100%');
  assert.equal(q([mod('warn', 'flat', 5)], 'warn'), 1, 'warning time is never more than a second');
  assert.equal(q([mod('move-speed', 'set', 0)], 'move-speed'), 0.5, 'set is clamped like anything else');
  assert.equal(q([mod('guard-max.blow', 'flat', 100)], 'guard-max.blow'), 90, 'the hard cap of the Brace guard\'s cap');
  assert.equal(q([mod('guard.swell', 'flat', 50)], 'guard.swell'), 0, 'a Swell is bare: no guard can be raised against it');
  assert.equal(q([mod('through.swell', 'flat', 30)], 'through.swell'), 0);
  assert.equal(q([mod('through.drag', 'flat', -5)], 'through.drag'), 0);
  assert.equal(q([mod('brace-time', 'flat', -1)], 'brace-time'), 0.1, 'Brace takes a tenth of a second at the least');
  assert.equal(q([mod('throws', 'flat', 3), mod('throws', 'inc', 50)], 'throws'), 4, 'whole-number stats round down: 4.5 is 4');
  assert.equal(q([mod('pierce', 'flat', 0.7), mod('pierce', 'flat', 0.3)], 'pierce'), 1, 'a sum that should be whole is whole');
  assert.equal(q([mod('wound-cap', 'flat', 0.6)], 'wound-cap'), 10);
  assert.equal(q([mod('knee', 'flat', 25), mod('knee', 'inc', 10)], 'knee'), 27);
});

test('local modifiers, unknown stats and unresolved Scaled values', () => {
  assert.equal(q([mod('mend-on-lay', 'flat', 50, { local: true }), mod('mend-on-lay', 'flat', 5)], 'mend-on-lay'), 5, 'a local modifier belongs to its find');
  assert.throws(() => q([], 'lifeMax'), /Stats\.query: "lifeMax" is not a stat/);
  assert.equal(q([mod('mend-on-lay', 'flat', { a: 8, b: 100, curve: 'lin' })], 'mend-on-lay'), 8, 'a Scaled nobody resolved counts at level 1');
  assert.equal(q([mod('flag.unbroken', 'set', 1)], 'flag.unbroken'), 1);
  assert.equal(q([], 'flag.unbroken'), 0);
  assert.equal(q(undefined, 'mend-on-lay'), 0);
});

test('a range stat adds its two ends apart', () => {
  const list = [mod('added.blow', 'flat', [3, 7]), mod('added.blow', 'flat', [1, 2]), mod('added.blow', 'flat', 2), mod('added.blow', 'inc', 50),
    mod('added.blow', 'flat', [100, 200], { tags: ['still'] })];
  // low (3 + 1 + 2) * 1.5 = 9, high (7 + 2 + 2) * 1.5 = 16.5
  assert.deepEqual(Stats.queryRange(list, 'added.blow', [], 0, null, [0, 0]), [9, 16.5]);
  assert.equal(q(list, 'added.blow'), 9, 'query gives the low end');
  assert.deepEqual(Stats.queryRange(list, 'added.blow', ['still'], 0, null, [0, 0]), [159, 316.5]);
  assert.deepEqual(Stats.queryRange([mod('life-max', 'flat', 5)], 'life-max', [], 0, null, [0, 0]), [65, 65], 'a single number has both ends alike');
  assert.equal(Stats.stat('added.swell').range, true);
});

// ---- the player's sheet ----

// What the attributes give, as the modifiers Stats.PRIMARIES describes: what a query needs to reach a sheet's numbers.
const inherent = () => Stats.PRIMARIES.flatMap((p) => p.gives.map((g) => Object.assign({ stat: g.stat, op: g.op, value: g.value },
  g.tags ? { tags: g.tags } : {}, g.cond ? { cond: g.cond } : {}, { per: { stat: p.id, div: g.div } })));

test('a sheet works out every stat, the attributes first, with what each point of them gives', () => {
  const mods = [mod('knee', 'flat', 20), mod('heel', 'flat', 10), mod('hand', 'flat', 5), mod('ear', 'flat', 30), mod('life-max', 'flat', 40),
    mod('life-max', 'inc', 50), mod('mend-on-lay', 'flat', 3, { per: { stat: 'knee', div: 5 } }), mod('heed-max', 'more', 100), mod('move-speed', 'inc', 10)];
  const sheet = Stats.sheet(mods, { level: 12 });
  assert.equal(sheet.level, 12);
  assert.equal(sheet.weapon, null);
  assert.deepEqual(plain(sheet.primaries), { knee: 20, heel: 10, hand: 5, ear: 30, level: 12, observances: 0, favours: 0, finds: 0, debts: 0 });
  assert.deepEqual([sheet.stats.knee, sheet.stats.heel, sheet.stats.hand, sheet.stats.ear], [20, 10, 5, 30]);
  // life: (60 base + 40 flat + 20 Knee * 2) * 1.5 = 210
  assert.equal(sheet.stats['life-max'], 210);
  // Brace: 0.4 - 0.03 for each 10 Knee (2) = 0.34; its guard 50 + 2 * 2 = 54, under the cap of 80
  near(sheet.stats['brace-time'], 0.34);
  assert.equal(sheet.stats['guard.blow'], 54);
  // top speed: 4.5 * (1 + (10% + 0.25% * 10 Heel) / 100) = 5.0625; Stride at 70 - 1 for each 10 Heel = 69
  near(sheet.stats['move-speed'], 5.0625);
  assert.equal(sheet.stats['stride-share'], 69);
  // Hand 5: pickup reach 2.5 * 1.05 = 2.625; mend reach gains 0.1 only at 10 Hand
  near(sheet.stats['pickup-reach'], 2.625);
  assert.equal(sheet.stats['mend-reach'], 1);
  // Ear 30: Heed (100 + 30) * 2 = 260; warning 0.05 * 3 = 0.15
  assert.equal(sheet.stats['heed-max'], 260);
  near(sheet.stats.warn, 0.15);
  assert.equal(sheet.stats['mend-on-lay'], 12, '3 * floor(20 / 5)');
  assert.equal(sheet.stats.damage, 100, 'the damage the attributes give is tagged or is about the body struck: none of it is untagged');
  nearAll(sheet.guard, [54, 60, 0]);
  nearAll(sheet.taken, [1, 1, 1]);
  for (const row of Stats.STATS) {
    if (row.prefix) continue;
    assert.equal(typeof sheet.stats[row.id], 'number', `the sheet has ${row.id}`);
    if (!Stats.is('primary', row.id)) assert.equal(sheet.stats[row.id], Stats.query([...mods, ...inherent()], row.id, [], 0, sheet.primaries), `${row.id} is what a query gives`);
  }
  assert.equal(Object.keys(sheet.stats).length, Stats.STATS.filter((r) => !r.prefix).length);
});

test('one attribute cannot feed another, but level and the counts can feed them all', () => {
  const per = (stat, div) => ({ per: { stat, div } });
  const mods = [mod('knee', 'flat', 30), mod('heel', 'flat', 1, per('knee', 10)), mod('hand', 'flat', 2, per('level', 1)), mod('knee', 'flat', 5, per('favours', 2)),
    mod('life-max', 'flat', 10, per('observances', 1)), mod('ear', 'flat', 1, per('finds', 1)), mod('heed-max', 'flat', 3, per('debts', 1))];
  const sheet = Stats.sheet(mods, { level: 7, observances: 2, favours: 4, finds: 3, debts: 2 });
  // Knee 30 + 5 * floor(4 / 2) = 40; Heel: the per-Knee modifier reads 0 while attributes are worked out; Hand 2 * 7 = 14; Ear 3
  assert.deepEqual(plain(sheet.primaries), { knee: 40, heel: 0, hand: 14, ear: 3, level: 7, observances: 2, favours: 4, finds: 3, debts: 2 });
  // life 60 + 2 * 10 (observances) + 40 Knee * 2 = 160;  Heed 100 + 3 * 2 (debts) + 3 Ear = 109;  mend reach 1 + 0.1 * floor(14 / 10)
  assert.equal(sheet.stats['life-max'], 160);
  assert.equal(sheet.stats['heed-max'], 109);
  near(sheet.stats['mend-reach'], 1.1);
  assert.equal(Stats.sheet([], {}).level, 1, 'the level starts at 1');
  assert.equal(Stats.sheet([]).stats['life-max'], 60);
});

test('a guard is guard.<kind> and guard.all, held within 0 and its cap; a Swell has none', () => {
  const guard = (mods) => Array.from(Stats.sheet(mods, { level: 1 }).guard);
  assert.deepEqual(guard([]), [50, 60, 0], 'Brace 50 and Stride 60 to start; nothing against a Swell');
  assert.deepEqual(guard([mod('guard.blow', 'flat', 20)]), [70, 60, 0]);
  assert.deepEqual(guard([mod('guard.blow', 'flat', 40)]), [80, 60, 0], 'capped at guard-max.blow, 80 unless raised');
  assert.deepEqual(guard([mod('guard.blow', 'flat', 40), mod('guard-max.blow', 'flat', 5)]), [85, 60, 0]);
  // guard.blow 150 is held to its row's 100; the cap 130 to its row's 90
  assert.deepEqual(guard([mod('guard.blow', 'flat', 100), mod('guard-max.blow', 'flat', 50)]), [90, 60, 0], 'the cap itself stops at 90');
  assert.deepEqual(guard([mod('guard.all', 'flat', 10)]), [60, 70, 0], 'guard.all reaches every guard, and a Swell still has none');
  assert.deepEqual(guard([mod('guard.all', 'flat', 30)]), [80, 85, 0], 'each guard has its own cap');
  assert.deepEqual(guard([mod('guard.all', 'flat', -70)]), [0, 0, 0], 'a guard is never below nothing');
  assert.deepEqual(guard([mod('guard.drag', 'flat', 20), mod('guard-max.drag', 'set', 70)]), [50, 70, 0]);
  assert.deepEqual(guard([mod('knee', 'flat', 40)]), [58, 60, 0], 'Knee raises Brace: 50 + 2 for each 10 points');
});

test('a sheet bakes in the player\'s conditions, the harm taken by kind, and flags', () => {
  const mods = [mod('heed-max', 'flat', 100, { cond: 'braced' }), mod('heed-max', 'flat', 7, { cond: 't-keeper' }), mod('taken', 'more', -10),
    mod('taken', 'inc', -20, { tags: ['blow'] }), mod('taken', 'more', 50, { tags: ['dot'] }), mod('taken', 'more', 30, { tags: ['swell'] }),
    mod('flag.unbroken', 'set', 1), mod('flag.lowborn', 'flat', 1, { cond: 'faint' }), mod('flag.off', 'flat', 0)];
  const striding = Stats.sheet(mods, { level: 1, conds: ['striding'] }), braced = Stats.sheet(mods, { level: 1, conds: ['braced', 't-keeper'] });
  assert.equal(striding.stats['heed-max'], 100);
  assert.equal(braced.stats['heed-max'], 200, 'the conditions about the body struck are never part of a sheet');
  assert.equal(braced.conds, Stats.condMask(['braced']));
  const T = Stats.TYPE;
  near(braced.taken[T.blow], 0.8 * 0.9);              // a Blow's tags are blow and hit: 20% reduced, 10% less
  near(braced.taken[T.drag], 0.9 * 1.5);              // Drag ticks, so its tags are drag and dot
  assert.equal(braced.taken[T.swell], 1, 'a Swell is bare: it ignores the harm-taken modifiers');
  assert.deepEqual(plain(braced.flags), { unbroken: true });
  assert.deepEqual(plain(Stats.sheet(mods, { conds: ['faint'] }).flags), { unbroken: true, lowborn: true });
  const weapon = { family: 'rope', damage: { blow: [3, 9] }, aps: 1.2 };
  assert.equal(Stats.sheet([], { level: 3, weapon }).weapon, weapon);
});

// ---- a voice's sheet ----

function withVoices() {
  const sim = kernel(), voice = (id, more) => sim.Defs.add('voice', Object.assign({
    id, name: id, text: '', icon: null, attr: 'hand', tier: 1, tags: [], weapon: null, archetype: 'ring', target: 'self', rate: 1,
    damage: { blow: [1, 2] }, weaponPct: 0, eff: 1, crit: 0, params: {}, mods: [], fx: {},
  }, more));
  const knot = (id, more) => sim.Defs.add('knot', Object.assign({
    id, name: id, text: '', icon: null, attr: 'hand', tier: 1, requires: [], excludes: [], addTags: [], mods: [], params: {}, trigger: null,
  }, more));
  voice('tenor', { tags: ['round'], rate: 0.5, damage: { blow: [10, 20] }, eff: 1.2, params: { radius: 2.5 }, mods: [mod('chance.coined', 'flat', 15)] });
  voice('pipe', {
    attr: 'knee', tier: 2, tags: ['ground', 'still'], archetype: 'cone', target: 'nearest', rate: { a: 1, b: 2.9, curve: 'lin' },
    damage: { drag: [{ a: 4, b: 64, curve: 'exp' }, { a: 8, b: 128, curve: 'exp' }] }, params: { length: 6, width: { a: 0.5, b: 1.5, curve: 'lin' } },
    mods: [mod('chance.sealed', 'flat', { a: 10, b: 29, curve: 'lin' })],
  });
  voice('carried', { tags: ['attack', 'round'], damage: { blow: [2, 4] } });
  knot('slip', { requires: ['round'], excludes: ['thrown'], mods: [mod('damage', 'more', 30), mod('speed', 'more', -10)], params: { radius: 0.5 } });
  knot('running', { attr: 'heel', tier: 2, requires: ['ground'], addTags: ['line'], mods: [mod('throws', 'flat', 2)], params: { count: 2, fan: 0.4 } });
  knot('lead', { attr: 'ear', requires: ['still'], mods: [mod('damage', 'more', 100)], params: { length: 5 } });
  assert.deepEqual(plain(sim.Defs.finalize()), [], 'the test\'s own voices and knots are valid definitions');
  return sim.Stats;
}

test('a voice\'s sheet, worked by hand: a Blow voice, a knot and a spread of modifiers', () => {
  const St = withVoices(), T = St.TYPE, A = St.AILMENT;
  const mods = [
    mod('hand', 'flat', 20),                                                // the tenor wants 10 Hand and the slip 6: both in full
    mod('added.blow', 'flat', [5, 10]),
    mod('added.drag', 'flat', [100, 100]),                                  // another kind than the voice's: adds nothing
    mod('damage', 'inc', 50, { tags: ['blow'] }),
    mod('damage', 'inc', 30, { tags: ['drag'] }),
    mod('damage', 'more', 20, { tags: ['round'] }),
    mod('damage', 'inc', 100, { tags: ['thrown'] }),                        // the tenor is not thrown: must not count
    mod('damage', 'inc', 10, { per: { stat: 'hand', div: 10 } }),           // floor(20 / 10) = 2 times: +20%
    mod('damage', 'inc', 25, { cond: 'faint' }),                            // only in the second sheet below
    mod('damage', 'more', 40, { cond: 't-wrong-footed' }),                  // about the body struck: set aside
    mod('speed', 'inc', 10),
    mod('area', 'inc', 20),
    mod('through.blow', 'flat', 10),
    mod('chance.coined', 'flat', 25),
    mod('cond-duration', 'inc', 50, { tags: ['coined'] }),
  ];
  const inst = { uid: 1, id: 'tenor', level: 1, rope: 3, knots: ['slip', null, 'lead'] };
  const sheet = St.sheet(mods, { level: 10 });
  const ss = St.skillSheet(mods, inst, sheet);

  assert.equal(ss.id, 'tenor');
  assert.equal(ss.def.id, 'tenor');
  assert.equal(ss.level, 1);
  assert.deepEqual([ss.usable, ss.attack, ss.share], [true, false, 1]);
  assert.deepEqual(plain(ss.tags), ['round']);
  assert.deepEqual(Array.from(ss.knots, (k) => k.id), ['slip'], 'the lead needs a voice tagged still and is left out');
  assert.equal(ss.kinds, 1 << T.blow, 'it deals Blows only');

  // Base harm: own [10, 20] + added Blow [5, 10] * eff 1.2 = [6, 12] -> [16, 32], at a share of 1. Drag and Swell: none.
  nearAll(ss.baseMin, [16, 0, 0]);
  nearAll(ss.baseMax, [32, 0, 0]);
  // inc: Blow 50 + 20 (per Hand) = 70, Drag 30 + 20 = 50, Swell 20. The Hand's own +20% is about bodies within 3 m.
  // more: 20% for round voices, 30% from the slip = 1.2 * 1.3 = 1.56 for every kind.
  nearAll(ss.inc, [70, 50, 20]);
  nearAll(ss.more, [1.56, 1.56, 1.56]);
  // a hit: base * (1 + inc / 100) * more:  Blow [16, 32] * 1.7 * 1.56 = [42.432, 84.864]
  nearAll(ss.min, [42.432, 0, 0]);
  nearAll(ss.max, [84.864, 0, 0]);
  nearAll(ss.through, [10, 0, 0]);

  // rate: 0.5 a second * speed (1 + 10%) * (1 - 10%) = 0.495
  near(ss.rate, 0.495);
  near(ss.area, 1.2);
  assert.deepEqual([ss.reach, ss.duration, ss['throw-speed']], [1, 1, 1]);
  assert.deepEqual([ss.throws, ss.pierce, ss.shove, ss['wrong-foot']], [0, 0, 0, 50], 'a voice deals 50% more to the Wrong-footed unless changed');

  // conditions: coined 25 from the list and 15 from the voice itself; it lasts 50% longer
  near(ss.ailChance[A.coined], 40);
  near(ss.ailChance[A.sealed], 0);
  near(ss.ailChance[A.brined], 0);
  near(ss.ailDuration[A.coined], 1.5);
  near(ss.ailDuration[A.sealed], 1);
  assert.equal(ss.ailChance[A['wrong-footed']], 0, 'a condition without a chance column has no chance');

  // params: the voice's, plus the knot's
  assert.deepEqual(plain(ss.params), { radius: 3 });

  // what is about the body struck is kept apart, and applies hit by hit: the list's Wrong-footed more, and the
  // Hand's +1% a point against bodies within 3 m (20 points)
  // (cond and unless are masks of the body's conditions: what must hold, and what must not)
  assert.deepEqual(plain(ss.targetMods), [
    { stat: 'damage', op: 'more', value: 40, hi: 40, cond: 1 << St.COND['t-wrong-footed'], unless: 0, kinds: 0b111, skill: true },
    { stat: 'damage', op: 'inc', value: 20, hi: 20, cond: 1 << St.COND['t-near'], unless: 0, kinds: 0b111, skill: true },
  ]);
  near(St.hitMult(ss, T.blow, 0), 1.7 * 1.56);
  near(St.hitMult(ss, T.blow, St.condMask(['t-wrong-footed'])), 1.7 * 1.56 * 1.4);
  near(St.hitMult(ss, T.blow, St.condMask(['t-near'])), 1.9 * 1.56);
  near(St.hitMult(ss, T.blow, St.condMask(['t-near', 't-wrong-footed', 't-keeper'])), 1.9 * 1.56 * 1.4);
  near(ss.min[T.blow], ss.baseMin[T.blow] * St.hitMult(ss, T.blow, 0), 1e-9);

  // the same voice while the player is faint: 25% more inc on every kind
  const low = St.skillSheet(mods, inst, St.sheet(mods, { level: 10, conds: ['faint'] }));
  nearAll(low.inc, [95, 75, 45]);
  near(low.max[T.blow], 32 * 1.95 * 1.56);
  // the list given, what the four attributes give (13 modifiers), the voice's one modifier and the knot's two
  assert.equal(ss.mods.length, mods.length + 13 + 1 + 2);
});

test('below what they want, a voice and a knot work at a share of themselves', () => {
  const St = withVoices(), T = St.TYPE, inst = { id: 'tenor', level: 1, knots: ['slip'] };
  const at = (hand) => { const mods = [mod('hand', 'flat', hand)]; return St.skillSheet(mods, inst, St.sheet(mods, {})); };
  // Hand 5: the tenor wants 10 (5 / 10 = 0.5), the slip 6 (5 / 6). Base [10, 20] * 0.5 = [5, 10]; more 1 + 30% * 5 / 6 = 1.25
  const half = at(5);
  assert.equal(half.share, 0.5);
  nearAll(half.baseMin, [5, 0, 0]);
  nearAll(half.baseMax, [10, 0, 0]);
  near(half.more[T.blow], 1.25);
  nearAll(half.min, [6.25, 0, 0]);
  nearAll(half.max, [12.5, 0, 0]);
  near(half.rate, 0.5 * (1 - 10 * 5 / 6 / 100));     // the slip's 10% less speed, at 5/6 of itself
  near(half.params.radius, 2.5 + 0.5 * 5 / 6);       // and its params too
  // Hand 0: both at the least, a fifth. Base [2, 4]; more 1 + 30% * 0.2 = 1.06
  const none = at(0);
  assert.equal(none.share, 0.2);
  nearAll(none.min, [2.12, 0, 0]);
  nearAll(none.max, [4.24, 0, 0]);
  // Hand 30: everything in full
  const full = at(30);
  assert.equal(full.share, 1);
  nearAll(full.min, [10 * 1.3, 0, 0]);
});

test('a Drag voice: its own numbers follow its level, what the attributes give reaches it, and knots change it', () => {
  const St = withVoices(), T = St.TYPE, A = St.AILMENT;
  // Knee 20 meets the pipe's want (10 x tier 2) and gives +1% a point to voices tagged still: +20%. Heel 12 meets
  // the running knot's want (6 x 2), Ear 6 the lead's (6 x 1).
  const mods = [mod('knee', 'flat', 20), mod('heel', 'flat', 12), mod('ear', 'flat', 6)];
  const at = (level, knots = []) => St.skillSheet(mods, { id: 'pipe', level, knots }, St.sheet(mods, {}));
  const top = at(20);
  assert.equal(top.kinds, 1 << T.drag);
  assert.deepEqual([top.share, top.inc[T.drag]], [1, 20]);
  nearAll(top.min, [0, 64 * 1.2, 0]);
  nearAll(top.max, [0, 128 * 1.2, 0]);
  near(top.rate, 2.9);
  near(top.ailChance[A.sealed], 29);
  assert.deepEqual(plain(top.params), { length: 6, width: 1.5 });
  const mid = at(10.5);
  near(mid.min[T.drag], 16 * 1.2);                     // the geometric middle of 4 and 64
  near(mid.max[T.drag], 32 * 1.2);
  near(mid.rate, 1.95);
  near(mid.params.width, 1);

  const tied = at(1, ['running', 'slip', 'lead']);
  assert.deepEqual(Array.from(tied.knots, (k) => k.id), ['running', 'lead'], 'the slip needs a round voice');
  assert.deepEqual(plain(tied.tags), ['ground', 'still', 'line'], 'running adds the line tag');
  // level 1: [4, 8] * 1.2 (Knee) * 2 (the lead's 100% more) = [9.6, 19.2]
  nearAll(tied.min, [0, 9.6, 0]);
  nearAll(tied.max, [0, 19.2, 0]);
  assert.equal(tied.throws, 2);
  assert.deepEqual(plain(tied.params), { length: 11, width: 0.5, count: 2, fan: 0.4 }, 'params add up; a new key starts from 0');
  // a line modifier now reaches the voice, because a knot made it a line voice
  const line = [...mods, mod('damage', 'inc', 50, { tags: ['line'] })];
  assert.equal(St.skillSheet(line, { id: 'pipe', level: 1, knots: [] }, St.sheet(line, {})).min[T.drag], 4 * 1.2);
  assert.equal(St.skillSheet(line, { id: 'pipe', level: 1, knots: ['running'] }, St.sheet(line, {})).min[T.drag], 4 * 1.7);
  // a Drag voice's own stats see its kind's tags: drag and dot, never hit
  const dot = [...mods, mod('area', 'inc', 50, { tags: ['dot'] }), mod('area', 'inc', 30, { tags: ['hit'] })];
  near(St.skillSheet(dot, { id: 'pipe', level: 1, knots: [] }, St.sheet(dot, {})).area, 1.5);
  assert.equal(St.fits(top.def, tied.knots[0]), true);
  assert.throws(() => St.skillSheet([], { id: 'nothing', level: 1, knots: [] }, St.sheet([], {})), /no voice "nothing"/);
});

test('param modifiers change a voice\'s params, and only the params it has', () => {
  const St = withVoices();
  const mods = [mod('knee', 'flat', 20), mod('heel', 'flat', 12), mod('hand', 'flat', 10), mod('param.count', 'flat', 1, { tags: ['line'] }),
    mod('param.count', 'flat', 5, { tags: ['round'] }), mod('param.length', 'inc', 50), mod('param.radius', 'flat', 3), mod('param.fan', 'more', 100)];
  const sheet = St.sheet(mods, {});
  assert.deepEqual(plain(St.skillSheet(mods, { id: 'pipe', level: 1, knots: [] }, sheet).params), { length: 9, width: 0.5 });
  assert.deepEqual(plain(St.skillSheet(mods, { id: 'pipe', level: 1, knots: ['running'] }, sheet).params), { length: 9, width: 0.5, count: 3, fan: 0.8 });
  assert.deepEqual(plain(St.skillSheet(mods, { id: 'tenor', level: 1, knots: [] }, sheet).params), { radius: 5.5 });
});

test('modifiers about the body struck are set aside with the kinds they reach', () => {
  const St = withVoices(), T = St.TYPE, bit = (id) => 1 << T[id];
  const mods = [
    mod('hand', 'flat', 10),                                                  // and so +10% against bodies within 3 m
    mod('damage', 'inc', 30, { cond: 't-keeper', tags: ['round'] }),          // the tenor is round: every kind's tags hold it
    mod('damage', 'more', 50, { cond: 't-braced', tags: ['drag'] }),          // only the Drag part (the tenor has none)
    mod('damage', 'inc', 10, { cond: 't-elite', tags: ['thrown'] }),          // the tenor is not thrown: dropped
    mod('shove', 'flat', 2, { cond: 't-large', per: { stat: 'level', div: 5 } }),
    mod('damage', 'inc', 15, { cond: 't-coined', tags: ['hit'] }),            // the kinds that land: Blow and Swell
    mod('heed-max', 'flat', 9, { cond: 't-keeper', local: true }),            // local: never
  ];
  const ss = St.skillSheet(mods, { id: 'tenor', level: 1, knots: [] }, St.sheet(mods, { level: 11 }));
  const all = 0b111, c = (id) => 1 << St.COND[id];
  assert.deepEqual(plain(ss.targetMods), [
    { stat: 'damage', op: 'inc', value: 30, hi: 30, cond: c('t-keeper'), unless: 0, kinds: all, skill: true },
    { stat: 'damage', op: 'more', value: 50, hi: 50, cond: c('t-braced'), unless: 0, kinds: bit('drag'), skill: false },
    { stat: 'shove', op: 'flat', value: 4, hi: 4, cond: c('t-large'), unless: 0, kinds: all, skill: true },
    { stat: 'damage', op: 'inc', value: 15, hi: 15, cond: c('t-coined'), unless: 0, kinds: bit('blow') | bit('swell'), skill: true },
    { stat: 'damage', op: 'inc', value: 10, hi: 10, cond: c('t-near'), unless: 0, kinds: all, skill: true },
  ]);
  assert.equal(ss.inc[T.blow], 0, 'none of them is in the sheet\'s own numbers');
  const keeper = St.condMask(['t-keeper']), many = St.condMask(['t-keeper', 't-coined', 't-braced']);
  near(St.hitMult(ss, T.blow, 0), 1);
  near(St.hitMult(ss, T.blow, keeper), 1.3);
  near(St.hitMult(ss, T.blow, many), 1.45);
  near(St.hitMult(ss, T.drag, many), 1.3 * 1.5);
  near(St.hitMult(ss, T.swell, many), 1.45);
  near(St.hitMult(ss, T.blow, many | St.condMask(['t-near'])), 1.55);
});

test('a condition about both the player and the body struck: the player\'s part is settled with the sheet, the body\'s hit by hit', () => {
  const St = withVoices(), T = St.TYPE, c = (id) => 1 << St.COND[id];
  const mods = [
    mod('hand', 'flat', 10),
    mod('damage', 'inc', 40, { cond: ['braced', 't-keeper'] }),             // while you are Braced, against a keeper
    mod('damage', 'more', 50, { unless: 't-braced' }),                      // against a body that is not Braced
    mod('damage', 'inc', 25, { cond: 'striding', unless: ['t-large'] }),    // while you Stride, against the small
  ];
  const at = (conds) => St.skillSheet(mods, { id: 'tenor', level: 1, knots: [] }, St.sheet(mods, { conds }));
  const braced = at(['braced']), striding = at(['striding']);
  assert.deepEqual(plain(braced.targetMods.filter((m) => m.cond !== c('t-near'))), [
    { stat: 'damage', op: 'inc', value: 40, hi: 40, cond: c('t-keeper'), unless: 0, kinds: 0b111, skill: true },
    { stat: 'damage', op: 'more', value: 50, hi: 50, cond: 0, unless: c('t-braced'), kinds: 0b111, skill: true },
  ], 'Braced: the Striding one is gone; the rest wait for the body');
  assert.deepEqual(plain(striding.targetMods.filter((m) => m.cond !== c('t-near')).map((m) => [m.value, m.cond, m.unless])),
    [[50, 0, c('t-braced')], [25, 0, c('t-large')]]);
  assert.equal(braced.inc[T.blow], 0, 'none of them is in the sheet\'s own numbers');
  near(St.hitMult(braced, T.blow, 0), 1.5);
  near(St.hitMult(braced, T.blow, c('t-braced')), 1);
  near(St.hitMult(braced, T.blow, c('t-keeper')), 1.4 * 1.5);
  near(St.hitMult(braced, T.blow, c('t-keeper') | c('t-braced')), 1.4);
  near(St.hitMult(striding, T.blow, 0), 1.25 * 1.5);
  near(St.hitMult(striding, T.blow, c('t-large') | c('t-keeper')), 1.5);
});

test('the tool\'s path is kept but never taken: an armed voice takes a tool\'s speed and family, and no harm of it', () => {
  const St = withVoices(), T = St.TYPE, inst = { id: 'carried', level: 1, knots: [] };
  const mods = [mod('hand', 'flat', 10)];
  const bare = St.skillSheet(mods, inst, St.sheet(mods, {}));
  assert.deepEqual([bare.usable, bare.attack, bare.rate, plain(bare.tags)], [true, true, 1, ['attack', 'round']]);
  const tool = { family: 'rope', damage: { blow: [100, 100] }, aps: 2 };   // no base of the game is one (design 15.2)
  const armed = St.skillSheet(mods, inst, St.sheet(mods, { weapon: tool }));
  assert.deepEqual([armed.rate, plain(armed.tags)], [2, ['attack', 'round', 'rope']]);
  assert.deepEqual([armed.min[T.blow], armed.max[T.blow]], [2, 4], 'weaponPct is 0 for every voice: the tool adds no harm');
  const tenor = St.skillSheet(mods, { id: 'tenor', level: 1, knots: [] }, St.sheet(mods, { weapon: tool }));
  assert.deepEqual([tenor.attack, tenor.rate, tenor.tags.includes('rope')], [false, 0.5, false], 'a voice that is not an attack takes nothing from a tool');
});

test('a knot fits when the voice has what it requires and nothing it excludes', () => {
  const voice = { tags: ['ground', 'still', 'line'] };
  const fits = (requires, excludes) => Stats.fits(voice, { requires, excludes });
  assert.equal(fits([], []), true);
  assert.equal(fits(['ground'], []), true);
  assert.equal(fits(['ground', 'line'], ['round']), true);
  assert.equal(fits(['ground', 'held'], []), false);
  assert.equal(fits([], ['line']), false);
  assert.equal(fits(['still'], ['thrown', 'still']), false);
});
