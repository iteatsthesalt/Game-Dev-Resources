// tests/sim/10-stats.test.js: the stat tables, what modifiers add up to, the player's sheet and a sigil's sheet
// (src/js/10-stats.js). The numbers in these tests are worked out by hand in the comments beside them.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const modules = require('../../tools/modules.js');
const { plain } = require('./loader.js');

// The stat rules need only the core, the registries and the tables. Running just those three files gives
// registries with nothing in them, so the sigils of these tests never meet the ids of the game's own content.
function kernel() {
  const context = vm.constants && vm.constants.DONT_CONTEXTIFY ? vm.createContext(vm.constants.DONT_CONTEXTIFY) : vm.createContext({});
  context.console = console;
  for (const file of ['00-core.js', '01-defs.js', '10-stats.js']) new vm.Script(modules.read(file), { filename: file }).runInContext(context);
  return new vm.Script('({ Core, Defs, Stats })').runInContext(context);
}

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

test('the tables hold the lists of docs/engine.md', () => {
  assert.deepEqual(ids(Stats.TYPES), ['physical', 'fire', 'cold', 'lightning', 'void']);
  assert.deepEqual(ids(Stats.TYPES).filter((id) => Stats.TYPES[Stats.TYPE[id]].elemental), ['fire', 'cold', 'lightning']);
  assert.deepEqual(plain(Stats.FAMILIES), ['sword', 'axe', 'mace', 'dagger', 'bow', 'staff', 'wand', 'shield', 'focus']);
  assert.deepEqual(ids(Stats.PRIMARIES), ['str', 'dex', 'int']);
  assert.deepEqual(plain(Stats.PER), ['str', 'dex', 'int', 'level', 'vows', 'chimes']);
  const tags = ['physical', 'fire', 'cold', 'lightning', 'void', 'sword', 'axe', 'mace', 'dagger', 'bow', 'staff', 'wand', 'shield', 'focus',
    'elemental', 'attack', 'spell', 'melee', 'projectile', 'area', 'minion', 'duration', 'chain', 'beam', 'orbit', 'deployable', 'hit', 'dot',
    'ignite', 'bleed', 'poison'];
  for (const tag of tags) assert.ok(Stats.TAGS.includes(tag), `tag ${tag}`);
  const conds = ['lowLife', 'fullLife', 'moving', 'still', 'recentKill', 'recentHurt', 'recentDodge', 'draughtActive', 'hushFull', 'tChilled',
    'tFrozen', 'tIgnited', 'tShocked', 'tBleeding', 'tPoisoned', 'tElite', 'tBoss', 'tNear', 'tFar'];
  assert.deepEqual(ids(Stats.CONDS).sort(), conds.slice().sort());
  for (const c of Stats.CONDS) assert.equal(c.target, c.id.startsWith('t') && c.id[1] === c.id[1].toUpperCase(), `${c.id} is ${c.target ? '' : 'not '}about the target`);
  assert.deepEqual(ids(Stats.AILMENTS), ['ignite', 'bleed', 'poison', 'shock', 'chill', 'freeze', 'stun']);
  assert.equal(Stats.COND_MAX, 16);
  assert.ok(Stats.AILMENTS.length <= Stats.COND_MAX);
  assert.equal(Stats.LEVEL_MAX, 20);
});

test('every stat of docs/engine.md has a row with a base, a least and a most', () => {
  const types = ids(Stats.TYPES), family = (prefix, list) => list.map((x) => prefix + x);
  const wanted = ['str', 'dex', 'int', 'lifeMax', 'lifeRegen', 'lifeOnKill', 'lifeOnHit', 'hushMax', 'hushDelay', 'hushRate', 'armour', 'evasion',
    ...family('res.', types), ...family('resMax.', types), 'res.elemental', 'res.all', ...family('pen.', types), 'taken', 'moveSpeed',
    'dodgeCooldown', 'draughtCharges', 'draughtHeal', 'draughtGain', 'pickupRadius', 'xpGain', 'goldFind', 'itemRarity', 'itemQuantity',
    'echoGain', 'candleMax', 'damage', ...family('added.', types), ...family('gainAsExtra.', types), 'critChance', 'critMulti', 'speed', 'area',
    'projectiles', 'pierce', 'chain', 'fork', 'projSpeed', 'duration', 'range', 'knockback',
    ...family('chance.', ['ignite', 'bleed', 'poison', 'shock']), 'build.freeze', 'build.stun', 'ailmentDuration', 'minionLife'];
  for (const id of wanted) {
    const row = Stats.stat(id);
    assert.ok(row, `the stat ${id}`);
    assert.equal(row.id, id);
    for (const key of ['base', 'min', 'max']) assert.equal(typeof row[key], 'number', `${id}.${key}`);
    assert.ok(row.min <= row.base && row.base <= row.max, `${id}: its base lies between its least and its most`);
  }
  assert.equal(new Set(ids(Stats.STATS)).size, Stats.STATS.length, 'no stat twice');
  assert.equal(Stats.stat('flag.unbroken').prefix, 'flag.', 'any flag.<id> is a stat');
  assert.equal(Stats.stat('param.count').prefix, 'param.');
  for (const bad of ['lifeMaxx', 'flag.', 'param.', 'flag', 'res.sonic', 'chance.freeze', 'constructor', 'toString', '', undefined, null, 5]) {
    assert.equal(Stats.stat(bad), null, `"${bad}" is not a stat`);
  }
  assert.deepEqual([Stats.stat('resMax.fire').base, Stats.stat('resMax.fire').max], [75, 90], 'resistance caps at 75, and never above 90');
  assert.deepEqual([Stats.stat('critMulti').base, Stats.stat('critChance').max], [150, 100]);
});

test('index maps and membership follow the tables', () => {
  Stats.TYPES.forEach((t, i) => assert.equal(Stats.TYPE[t.id], i));
  Stats.AILMENTS.forEach((a, i) => assert.equal(Stats.AILMENT[a.id], i));
  Stats.CONDS.forEach((c, i) => assert.equal(Stats.COND[c.id], i));
  assert.equal(Stats.TYPE.constructor, undefined, 'the maps have nothing but their rows');
  const yes = { stat: 'lifeMax', tag: 'fire', cond: 'lowLife', dtype: 'void', family: 'bow', primary: 'dex', counted: 'chimes', ailment: 'stun' };
  for (const [table, id] of Object.entries(yes)) {
    assert.equal(Stats.is(table, id), true, `${id} is a ${table}`);
    assert.equal(Stats.is(table, id + 'x'), false);
    assert.equal(Stats.is(table, 'constructor'), false);
  }
  assert.equal(Stats.is('stat', 'flag.anything'), true);
  assert.equal(Stats.is('counted', 'life'), false);
  assert.throws(() => Stats.is('colour', 'red'), /no table/);
  assert.equal(Stats.condMask(['lowLife', 'tBoss']), (1 << Stats.COND.lowLife) | (1 << Stats.COND.tBoss));
  assert.equal(Stats.condMask(['nonsense']), 0);
  assert.equal(Stats.condMask(), 0);
  assert.equal(Stats.condMask(5), 5, 'a mask passes through');
  assert.ok(Object.isFrozen(Stats.STATS) && Object.isFrozen(Stats.STATS[0]) && Object.isFrozen(Stats.AILMENTS[0].from), 'the tables are frozen');
});

// ---- scaled values ----

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

test('resolve works Scaled values out at a level and leaves plain modifiers alone', () => {
  const plainMod = mod('lifeMax', 'flat', 5), pair = mod('added.fire', 'flat', [1, 2]);
  const scaledMod = mod('damage', 'inc', { a: 10, b: 29, curve: 'lin' }, { tags: ['fire'] });
  const scaledPair = mod('added.cold', 'flat', [{ a: 1, b: 20, curve: 'lin' }, 30]);
  const out = Stats.resolve([plainMod, pair, scaledMod, scaledPair], 11);
  assert.equal(out.length, 4);
  assert.equal(out[0], plainMod, 'a modifier of plain numbers is passed on as it is');
  assert.equal(out[1], pair);
  assert.deepEqual(plain(out[2]), { stat: 'damage', op: 'inc', value: 20, tags: ['fire'] });
  assert.deepEqual(plain(out[3]), { stat: 'added.cold', op: 'flat', value: [11, 30] });
  assert.equal(scaledMod.value.a, 10, 'the original is not touched');
  const into = ['kept'];
  assert.equal(Stats.resolve([plainMod], 3, into), into);
  assert.deepEqual(into, ['kept', plainMod]);
  assert.equal(Stats.resolve(undefined, 3).length, 0);
});

// ---- one stat from a list of modifiers ----

test('flat adds to the base, inc adds up, more multiplies, set wins', () => {
  assert.equal(q([], 'lifeMax'), 60, 'no modifiers: the base');
  assert.equal(q([mod('lifeMax', 'flat', 40)], 'lifeMax'), 100);
  // (60 + 40) * (1 + (10 + 20) / 100) = 130
  near(q([mod('lifeMax', 'flat', 40), mod('lifeMax', 'inc', 10), mod('lifeMax', 'inc', 20)], 'lifeMax'), 130);
  // 100 * 1.3 * 1.1 * 1.2 = 171.6: each more multiplies on its own
  const list = [mod('lifeMax', 'flat', 40), mod('lifeMax', 'inc', 10), mod('lifeMax', 'inc', 20), mod('lifeMax', 'more', 10), mod('lifeMax', 'more', 20)];
  near(q(list, 'lifeMax'), 171.6);
  // two inc of 50 are +100%, not 1.5 * 1.5; two more of 50 are 2.25
  near(q([mod('lifeMax', 'inc', 50), mod('lifeMax', 'inc', 50)], 'lifeMax'), 120);
  near(q([mod('lifeMax', 'more', 50), mod('lifeMax', 'more', 50)], 'lifeMax'), 135);
  // less is a negative more
  near(q([mod('lifeMax', 'more', -25)], 'lifeMax'), 45);
  assert.equal(q([...list, mod('lifeMax', 'set', 7)], 'lifeMax'), 7, 'set replaces the whole sum');
  assert.equal(q([mod('lifeMax', 'set', 300), ...list, mod('lifeMax', 'set', 9), mod('lifeMax', 'set', 20)], 'lifeMax'), 9, 'of several, the lowest');
  assert.equal(q([mod('armour', 'flat', 10), mod('evasion', 'flat', 99)], 'armour'), 10, 'other stats do not count');
});

test('the order of the modifiers never matters', () => {
  const list = [mod('lifeMax', 'flat', 40), mod('lifeMax', 'inc', 25), mod('lifeMax', 'more', 50), mod('lifeMax', 'inc', -5),
    mod('lifeMax', 'more', -20), mod('lifeMax', 'flat', 4)];
  const all = orders(list);
  assert.equal(all.length, 720);
  // (60 + 44) * 1.2 * 1.5 * 0.8 = 149.76
  for (const order of all) near(q(order, 'lifeMax'), 149.76, 1e-9);
  const withSet = orders([mod('pierce', 'set', 4), mod('pierce', 'flat', 9), mod('pierce', 'set', 2), mod('pierce', 'more', 100)]);
  for (const order of withSet) assert.equal(q(order, 'pierce'), 2);
});

test('a modifier counts only when all its tags are among the tags asked for', () => {
  const list = [mod('damage', 'inc', 10), mod('damage', 'inc', 20, { tags: ['fire'] }), mod('damage', 'inc', 40, { tags: ['fire', 'spell'] }),
    mod('damage', 'inc', 80, { tags: ['cold'] })];
  // damage is a percentage with a base of 100, so these read as "100 plus the inc that counted"
  near(q(list, 'damage'), 110);                        // no tags asked: only the untagged one
  near(q(list, 'damage', []), 110);
  near(q(list, 'damage', ['fire']), 130);
  near(q(list, 'damage', ['spell']), 110);             // one of two tags is not enough
  near(q(list, 'damage', ['spell', 'hit', 'fire', 'elemental']), 170);
  near(q(list, 'damage', ['fire', 'cold', 'spell']), 250);
  near(q([mod('damage', 'inc', 5, { tags: [] })], 'damage', ['fire']), 105);   // an empty tag list asks for nothing
});

test('a conditional modifier counts only while its condition holds', () => {
  const list = [mod('damage', 'inc', 10), mod('damage', 'inc', 30, { cond: 'lowLife' }), mod('damage', 'more', 100, { cond: 'tBoss', tags: ['fire'] })];
  near(q(list, 'damage', ['fire']), 110);
  near(q(list, 'damage', ['fire'], ['lowLife']), 140);
  near(q(list, 'damage', ['fire'], ['lowLife', 'tBoss']), 280);
  near(q(list, 'damage', [], ['lowLife', 'tBoss']), 140);                       // condition met, tag missing
  near(q(list, 'damage', ['fire'], Stats.condMask(['tBoss'])), 220);            // conditions may come as a mask
  assert.equal(q([mod('damage', 'inc', 30, { cond: 'noSuchCondition' })], 'damage', [], 0xffffffff), 100, 'an unknown condition never holds');
});

test('a per modifier is multiplied by what it counts, up to its cap', () => {
  const per = (stat, div, cap) => (cap === undefined ? { per: { stat, div } } : { per: { stat, div, cap } });
  const prim = { str: 47, dex: 9, int: 0, level: 12, vows: 2, chimes: 5 };
  // 5 for every 10 strength: floor(47 / 10) = 4 times
  assert.equal(q([mod('armour', 'flat', 5, per('str', 10))], 'armour', [], 0, prim), 20);
  assert.equal(q([mod('armour', 'flat', 5, per('str', 10, 3))], 'armour', [], 0, prim), 15, 'capped at 3 times');
  assert.equal(q([mod('armour', 'flat', 5, per('str', 10, 9))], 'armour', [], 0, prim), 20, 'a cap that is not reached changes nothing');
  assert.equal(q([mod('armour', 'flat', 5, per('dex', 10))], 'armour', [], 0, prim), 0, '9 dexterity is not yet 10');
  assert.equal(q([mod('armour', 'flat', 2, per('level', 1))], 'armour', [], 0, prim), 24);
  assert.equal(q([mod('damage', 'inc', 4, per('vows', 1))], 'damage', [], 0, prim), 108);
  assert.equal(q([mod('damage', 'more', 10, per('chimes', 2))], 'damage', [], 0, prim), 120, 'floor(5 / 2) = 2 times 10% more');
  assert.equal(q([mod('armour', 'flat', 5, per('str', 10))], 'armour'), 0, 'nothing to count: 0 times');
  assert.equal(q([mod('armour', 'flat', 5, per('str', 10))], 'armour', [], 0, { str: -30 }), 0, 'never a negative number of times');
});

test('values are held between the least and the most of their row', () => {
  assert.equal(q([mod('lifeMax', 'more', -100)], 'lifeMax'), 1, 'life never falls below 1');
  assert.equal(q([mod('lifeMax', 'inc', -250)], 'lifeMax'), 1, 'inc below -100% is 0, not negative');
  assert.equal(q([mod('lifeMax', 'more', -400)], 'lifeMax'), 1, 'neither is a more below -100%');
  assert.equal(q([mod('critChance', 'flat', 250)], 'critChance'), 100, 'crit chance is capped at 100');
  assert.equal(q([mod('critMulti', 'flat', -500)], 'critMulti'), 100);
  assert.equal(q([mod('moveSpeed', 'set', 0)], 'moveSpeed'), 0.5, 'set is clamped like anything else');
  assert.equal(q([mod('resMax.fire', 'flat', 100)], 'resMax.fire'), 90, 'the hard cap of the resistance cap');
  assert.equal(q([mod('pen.cold', 'flat', -5)], 'pen.cold'), 0);
  assert.equal(q([mod('projectiles', 'flat', 3), mod('projectiles', 'inc', 50)], 'projectiles'), 4, 'whole-number stats round down: 4.5 is 4');
  assert.equal(q([mod('pierce', 'flat', 0.7), mod('pierce', 'flat', 0.3)], 'pierce'), 1, 'a sum that should be whole is whole');
  assert.equal(q([mod('str', 'flat', 25), mod('str', 'inc', 10)], 'str'), 27);
});

test('local modifiers, unknown stats and unresolved Scaled values', () => {
  assert.equal(q([mod('armour', 'flat', 50, { local: true }), mod('armour', 'flat', 5)], 'armour'), 5, 'a local modifier belongs to its item');
  assert.throws(() => q([], 'lifeMaxx'), /Stats\.query: "lifeMaxx" is not a stat/);
  assert.equal(q([mod('armour', 'flat', { a: 8, b: 100, curve: 'lin' })], 'armour'), 8, 'a Scaled nobody resolved counts at level 1');
  assert.equal(q([mod('flag.unbroken', 'set', 1)], 'flag.unbroken'), 1);
  assert.equal(q([], 'flag.unbroken'), 0);
  assert.equal(q(undefined, 'armour'), 0);
});

test('a range stat adds its two ends apart', () => {
  const list = [mod('added.fire', 'flat', [3, 7]), mod('added.fire', 'flat', [1, 2]), mod('added.fire', 'flat', 2), mod('added.fire', 'inc', 50),
    mod('added.fire', 'flat', [100, 200], { tags: ['spell'] })];
  // low (3 + 1 + 2) * 1.5 = 9, high (7 + 2 + 2) * 1.5 = 16.5
  assert.deepEqual(Stats.queryRange(list, 'added.fire', [], 0, null, [0, 0]), [9, 16.5]);
  assert.equal(q(list, 'added.fire'), 9, 'query gives the low end');
  assert.deepEqual(Stats.queryRange(list, 'added.fire', ['spell'], 0, null, [0, 0]), [159, 316.5]);
  assert.deepEqual(Stats.queryRange([mod('lifeMax', 'flat', 5)], 'lifeMax', [], 0, null, [0, 0]), [65, 65], 'a single number has both ends alike');
  assert.equal(Stats.stat('added.fire').range, true);
});

// ---- the player's sheet ----

test('a sheet works out every stat, the attributes first', () => {
  const mods = [mod('str', 'flat', 20), mod('dex', 'flat', 10), mod('int', 'flat', 5), mod('lifeMax', 'flat', 40), mod('lifeMax', 'inc', 50),
    mod('armour', 'flat', 3, { per: { stat: 'str', div: 5 } }), mod('evasion', 'more', 100), mod('moveSpeed', 'inc', 10)];
  const sheet = Stats.sheet(mods, { level: 12 });
  assert.equal(sheet.level, 12);
  assert.equal(sheet.weapon, null);
  assert.deepEqual(plain(sheet.primaries), { str: 20, dex: 10, int: 5, level: 12, vows: 0, chimes: 0 });
  assert.deepEqual([sheet.stats.str, sheet.stats.dex, sheet.stats.int], [20, 10, 5]);
  // life: (60 base + 40 flat + 20 str * 2) * 1.5 = 210: a point of strength gives 2 life, as a flat amount
  assert.equal(sheet.stats.lifeMax, 210);
  // evasion: (0 + 10 dex * 3) * 2 = 60;  hush: 5 int * 2 = 10;  armour: 3 * floor(20 / 5) = 12
  assert.equal(sheet.stats.evasion, 60);
  assert.equal(sheet.stats.hushMax, 10);
  assert.equal(sheet.stats.armour, 12);
  near(sheet.stats.moveSpeed, 5.5);
  assert.equal(sheet.stats.critMulti, 150);
  for (const row of Stats.STATS) {
    if (row.prefix) continue;
    assert.equal(typeof sheet.stats[row.id], 'number', `the sheet has ${row.id}`);
    if (!Stats.is('primary', row.id)) assert.equal(sheet.stats[row.id], Stats.query([...mods, ...extraFor(sheet)], row.id, [], 0, sheet.primaries), `${row.id} is what a query gives`);
  }
  assert.equal(Object.keys(sheet.stats).length, Stats.STATS.filter((r) => !r.prefix).length);
});
// what a point of each attribute gives, as the flat modifiers a query would need to reach the sheet's numbers
const extraFor = (sheet) => Stats.PRIMARIES.map((p) => mod(p.gives.stat, 'flat', p.gives.value * sheet.primaries[p.id]));

test('one attribute cannot feed another, but level, vows and chimes can feed them all', () => {
  const mods = [mod('str', 'flat', 30), mod('dex', 'flat', 1, { per: { stat: 'str', div: 10 } }), mod('int', 'flat', 2, { per: { stat: 'level', div: 1 } }),
    mod('str', 'flat', 5, { per: { stat: 'chimes', div: 2 } }), mod('lifeMax', 'flat', 10, { per: { stat: 'vows', div: 1 } })];
  const sheet = Stats.sheet(mods, { level: 7, vows: 2, chimes: 4 });
  // str 30 + 5 * floor(4 / 2) = 40;  dex: the per-strength modifier reads 0 while attributes are worked out;  int 2 * 7 = 14
  assert.deepEqual(plain(sheet.primaries), { str: 40, dex: 0, int: 14, level: 7, vows: 2, chimes: 4 });
  // life 60 + 2 * 10 (vows) + 40 str * 2 = 160;  hush 14 int * 2 = 28
  assert.equal(sheet.stats.lifeMax, 160);
  assert.equal(sheet.stats.hushMax, 28);
  assert.equal(Stats.sheet([], {}).level, 1, 'the level starts at 1');
  assert.equal(Stats.sheet([]).stats.lifeMax, 60);
});

test('resistance is capped at 75, the cap can be raised, and never beyond 90', () => {
  const T = Stats.TYPE, res = (mods) => Array.from(Stats.sheet(mods, { level: 1 }).res);
  assert.deepEqual(res([]), [0, 0, 0, 0, 0]);
  assert.equal(res([mod('res.fire', 'flat', 40)])[T.fire], 40);
  assert.equal(res([mod('res.fire', 'flat', 100)])[T.fire], 75, 'capped at resMax, 75 unless raised');
  assert.equal(res([mod('res.fire', 'flat', 100), mod('resMax.fire', 'flat', 10)])[T.fire], 85);
  assert.equal(res([mod('res.fire', 'flat', 200), mod('resMax.fire', 'flat', 50)])[T.fire], 90, 'the cap itself stops at 90');
  assert.equal(res([mod('res.fire', 'flat', 100), mod('resMax.fire', 'flat', 10)])[T.cold], 0, 'each type has its own cap');
  // res.all reaches every type, res.elemental only fire, cold and lightning
  assert.deepEqual(res([mod('res.all', 'flat', 10), mod('res.elemental', 'flat', 20), mod('res.void', 'flat', 5), mod('res.cold', 'flat', 70)]),
    [10, 30, 75, 30, 15]);
  assert.equal(res([mod('res.lightning', 'flat', -30)])[T.lightning], -30, 'resistance can be negative');
  assert.equal(res([mod('res.cold', 'flat', 60), mod('res.all', 'flat', 60), mod('resMax.cold', 'set', 50)])[T.cold], 50);
});

test('a sheet bakes in the player\'s conditions, the damage taken per type, and flags', () => {
  const mods = [mod('armour', 'flat', 100, { cond: 'still' }), mod('armour', 'flat', 7, { cond: 'tBoss' }), mod('taken', 'more', -10),
    mod('taken', 'inc', -20, { tags: ['fire'] }), mod('taken', 'more', 50, { tags: ['elemental'] }), mod('flag.unbroken', 'set', 1),
    mod('flag.lowborn', 'flat', 1, { cond: 'lowLife' }), mod('flag.off', 'flat', 0)];
  const moving = Stats.sheet(mods, { level: 1, conds: ['moving'] }), still = Stats.sheet(mods, { level: 1, conds: ['still', 'tBoss'] });
  assert.equal(moving.stats.armour, 0);
  assert.equal(still.stats.armour, 100, 'the target conditions are never part of a sheet');
  assert.equal(still.conds, Stats.condMask(['still']));
  const T = Stats.TYPE;
  near(still.taken[T.physical], 0.9);
  near(still.taken[T.void], 0.9);
  near(still.taken[T.fire], 0.8 * 0.9 * 1.5);          // 20% reduced, 10% less, 50% more for an elemental type
  near(still.taken[T.cold], 0.9 * 1.5);
  assert.deepEqual(plain(still.flags), { unbroken: true });
  assert.deepEqual(plain(Stats.sheet(mods, { conds: ['lowLife'] }).flags), { unbroken: true, lowborn: true });
  const weapon = { family: 'bow', damage: { physical: [3, 9] }, aps: 1.2, crit: 6 };
  assert.equal(Stats.sheet([], { level: 3, weapon }).weapon, weapon);
});

// ---- a sigil's sheet ----

function withSigils() {
  const sim = kernel(), sigil = (id, more) => sim.Defs.add('sigil', Object.assign({
    id, name: id, text: '', icon: null, attr: 'str', tier: 1, tags: [], weapon: null, archetype: 'burst', target: 'nearest', rate: 1,
    damage: {}, weaponPct: 0, eff: 1, crit: 0, params: {}, mods: [], fx: {},
  }, more));
  const binding = (id, more) => sim.Defs.add('binding', Object.assign({
    id, name: id, text: '', icon: null, attr: 'str', tier: 1, requires: [], excludes: [], addTags: [], mods: [], params: {}, trigger: null,
  }, more));
  sigil('cleave', {
    tags: ['attack', 'melee', 'area'], weapon: ['sword', 'axe'], archetype: 'arc', rate: 1.2, damage: { physical: [10, 20] }, weaponPct: 80,
    eff: 1.2, crit: 2, params: { radius: 2, arc: 2.4 }, mods: [mod('chance.bleed', 'flat', 15)],
  });
  sigil('ember', {
    attr: 'int', tags: ['spell', 'projectile', 'fire'], archetype: 'projectile', rate: { a: 1, b: 2.9, curve: 'lin' },
    damage: { fire: [{ a: 4, b: 64, curve: 'exp' }, { a: 8, b: 128, curve: 'exp' }] }, crit: 6, params: { speed: 14, count: { a: 1, b: 3, curve: 'lin' } },
    mods: [mod('chance.ignite', 'flat', { a: 10, b: 29, curve: 'lin' })],
  });
  sigil('volley', { attr: 'dex', tags: ['attack', 'projectile'], weapon: ['bow'], archetype: 'projectile', weaponPct: 100, params: { count: 3 } });
  sigil('punch', { tags: ['attack', 'melee'], weaponPct: 100, damage: { physical: [2, 4] }, crit: 5 });
  binding('heavy', { requires: ['melee'], excludes: ['spell'], mods: [mod('damage', 'more', 30), mod('speed', 'more', -10)], params: { radius: 0.5 } });
  binding('kindle', { attr: 'int', requires: ['spell'], mods: [mod('damage', 'more', 100)], params: { speed: 5 } });
  binding('spread', { attr: 'dex', requires: ['projectile'], addTags: ['area'], mods: [mod('projectiles', 'flat', 2)], params: { count: 2, fan: 0.4 } });
  assert.deepEqual(plain(sim.Defs.finalize()), [], 'the test\'s own sigils and bindings are valid definitions');
  return sim.Stats;
}

test('a sigil\'s sheet, worked by hand: an attack with a weapon, a binding and a spread of modifiers', () => {
  const St = withSigils(), T = St.TYPE, A = St.AILMENT, n = St.TYPES.length;
  const weapon = { family: 'sword', damage: { physical: [20, 40], fire: [5, 5] }, aps: 1.5, crit: 5 };
  const mods = [
    mod('str', 'flat', 25),
    mod('added.physical', 'flat', [5, 10]),
    mod('added.fire', 'flat', [2, 4], { tags: ['attack'] }),
    mod('added.fire', 'flat', [100, 100], { tags: ['spell'] }),            // not an attack modifier: must not count
    mod('gainAsExtra.fire', 'flat', 20, { from: 'physical' }),
    mod('damage', 'inc', 50, { tags: ['physical'] }),
    mod('damage', 'inc', 30, { tags: ['fire'] }),
    mod('damage', 'more', 20, { tags: ['attack'] }),
    mod('damage', 'inc', 100, { tags: ['spell'] }),                         // must not count
    mod('damage', 'inc', 10, { per: { stat: 'str', div: 10 } }),            // floor(25 / 10) = 2 times: +20%
    mod('damage', 'inc', 25, { cond: 'lowLife' }),                          // only in the second sheet below
    mod('damage', 'more', 40, { cond: 'tChilled' }),                        // about the target: set aside
    mod('critChance', 'inc', 100),
    mod('critMulti', 'flat', 30),
    mod('speed', 'inc', 10),
    mod('area', 'inc', 20),
    mod('pen.fire', 'flat', 10),
    mod('chance.ignite', 'flat', 25),
  ];
  const inst = { uid: 1, id: 'cleave', level: 1, sockets: 3, bindings: ['heavy', null, 'kindle'] };
  const sheet = St.sheet(mods, { level: 10, weapon });
  const ss = St.skillSheet(mods, inst, sheet);

  assert.equal(ss.id, 'cleave');
  assert.equal(ss.def.id, 'cleave');
  assert.equal(ss.level, 1);
  assert.deepEqual([ss.usable, ss.attack], [true, true]);
  assert.deepEqual(plain(ss.tags), ['attack', 'melee', 'area', 'sword'], 'the weapon family joins the tags of an attack');
  assert.deepEqual(Array.from(ss.bindings, (b) => b.id), ['heavy'], 'kindle needs a spell and is left out');

  // First bases.
  //   physical: own [10, 20] + weapon [20, 40] * 80% = [16, 32] + added [5, 10] * eff 1.2 = [6, 12]   -> [32, 64]
  //   fire:     own nothing  + weapon [5, 5] * 80%   = [4, 4]   + added [2, 4] * eff 1.2 = [2.4, 4.8] -> [6.4, 8.8]
  // Gained as extra, from the first bases only: fire += 20% of physical [32, 64] = [6.4, 12.8]       -> [12.8, 21.6]
  nearAll(ss.baseMin, [32, 12.8, 0, 0, 0]);
  nearAll(ss.baseMax, [64, 21.6, 0, 0, 0]);
  // inc: physical 50 + 20 (per strength) = 70, fire 30 + 20 = 50, the others only the 20 per strength.
  // more: 20% for attacks, 30% from the binding = 1.2 * 1.3 = 1.56 for every type.
  nearAll(ss.inc, [70, 50, 20, 20, 20]);
  nearAll(ss.more, [1.56, 1.56, 1.56, 1.56, 1.56]);
  // hit = base * (1 + inc / 100) * more:  physical [32, 64] * 1.7 * 1.56 = [84.864, 169.728]
  //                                       fire [12.8, 21.6] * 1.5 * 1.56 = [29.952, 50.544]
  nearAll(ss.min, [84.864, 29.952, 0, 0, 0]);
  nearAll(ss.max, [169.728, 50.544, 0, 0, 0]);
  nearAll(ss.pen, [0, 10, 0, 0, 0]);

  // crit: (2 of the sigil + 5 of the weapon) * (1 + 100%) = 14;  multiplier 150 + 30 = 180
  near(ss.critChance, 14);
  near(ss.critMulti, 180);
  // rate: 1.2 a second * 1.5 attacks a second of the weapon * speed (1 + 10%) * (1 - 10%) = 1.782
  near(ss.rate, 1.782);
  near(ss.area, 1.2);
  assert.deepEqual([ss.projectiles, ss.pierce, ss.chain, ss.fork, ss.knockback], [0, 0, 0, 0, 0]);
  assert.deepEqual([ss.projSpeed, ss.duration, ss.range, ss.minionLife], [1, 1, 1, 1]);

  // ailments: ignite 25 from the list, bleed 15 from the sigil itself
  near(ss.ailChance[A.ignite], 25);
  near(ss.ailChance[A.bleed], 15);
  near(ss.ailChance[A.poison], 0);
  near(ss.ailBuild[A.freeze], 1);
  near(ss.ailBuild[A.stun], 1);
  near(ss.ailDuration[A.ignite], 1);
  // damage over time takes the type, elemental, dot and the ailment as its tags: "attack" modifiers stay out.
  //   ignite, fire:     30% * (1 + (30 + 20) / 100) * 1.3 (the binding's untagged more) = 0.585
  //   bleed, physical:  25% * (1 + (50 + 20) / 100) * 1.3 = 0.5525
  //   poison, physical: 20% * 1.7 * 1.3 = 0.442;   poison, void: 20% * 1.2 * 1.3 = 0.312
  near(ss.dot[A.ignite * n + T.fire], 0.585);
  near(ss.dot[A.bleed * n + T.physical], 0.5525);
  near(ss.dot[A.poison * n + T.physical], 0.442);
  near(ss.dot[A.poison * n + T.void], 0.312);
  assert.equal(ss.dot[A.ignite * n + T.physical], 0, 'ignite comes from fire only');
  assert.equal(ss.dot[A.shock * n + T.lightning], 0, 'shock deals no damage of its own');

  // params: the sigil's, plus the binding's
  assert.deepEqual(plain(ss.params), { radius: 2.5, arc: 2.4 });

  // the one modifier about the target is kept apart, and applies hit by hit
  assert.deepEqual(plain(ss.targetMods), [{ stat: 'damage', op: 'more', value: 40, hi: 40, cond: St.COND.tChilled, types: 0b11111, skill: true }]);
  near(St.hitMult(ss, T.physical, 0), 1.7 * 1.56);
  near(St.hitMult(ss, T.physical, St.condMask(['tChilled'])), 1.7 * 1.56 * 1.4);
  near(St.hitMult(ss, T.fire, St.condMask(['tChilled', 'tBoss'])), 1.5 * 1.56 * 1.4);
  near(St.hitMult(ss, T.fire, St.condMask(['tBoss'])), 1.5 * 1.56);
  near(ss.min[T.physical], ss.baseMin[T.physical] * St.hitMult(ss, T.physical, 0), 1e-9);

  // the same sigil while the player is at low life: 25% more inc on every type
  const low = St.skillSheet(mods, inst, St.sheet(mods, { level: 10, weapon, conds: ['lowLife'] }));
  nearAll(low.inc, [95, 75, 45, 45, 45]);
  near(low.max[T.physical], 64 * 1.95 * 1.56);
  assert.equal(ss.mods.length, mods.length + 1 + 2, 'the list given, the sigil\'s one modifier and the binding\'s two');
});

test('gained damage comes from the first bases only, and each pair of types is its own', () => {
  const St = withSigils(), T = St.TYPE;
  const weapon = { family: 'sword', damage: { physical: [100, 100], fire: [10, 10] }, aps: 1, crit: 0 };
  const mods = [
    mod('gainAsExtra.fire', 'flat', 50, { from: 'physical' }),       // fire gains 50% of physical
    mod('gainAsExtra.cold', 'flat', 100, { from: 'fire' }),          // cold gains 100% of the FIRST fire base
    mod('gainAsExtra.void', 'flat', 10, { from: 'physical' }),
    mod('gainAsExtra.void', 'flat', 15, { from: 'physical' }),       // two gains of one pair add up: 25%
    mod('gainAsExtra.physical', 'flat', 100, { from: 'fire' }),      // and back: physical gains 100% of the first fire base
    mod('gainAsExtra.lightning', 'flat', 100, { from: 'cold' }),     // nothing: there is no cold to begin with
  ];
  const ss = St.skillSheet(mods, { id: 'punch', level: 1, bindings: [] }, St.sheet(mods, { weapon }));
  // First bases: physical own [2, 4] + weapon [100, 100] = [102, 104]; fire [10, 10] from the weapon.
  //   physical: + 100% of fire [10, 10]       -> [112, 114]
  //   fire:     + 50% of physical [51, 52]    -> [61, 62]
  //   cold:     100% of the first fire base   -> [10, 10], not the [61, 62] that fire has grown to
  //   void:     25% of physical               -> [25.5, 26]
  nearAll(ss.baseMin, [112, 61, 10, 0, 25.5]);
  nearAll(ss.baseMax, [114, 62, 10, 0, 26]);
  assert.equal(ss.baseMin[T.lightning], 0, 'gained cold is not gained again as lightning');
});

test('an attack without its weapon, a sigil that needs no weapon, and bare hands', () => {
  const St = withSigils(), T = St.TYPE;
  const sword = { family: 'sword', damage: { physical: [10, 20] }, aps: 2, crit: 5 };
  const volley = { id: 'volley', level: 1, bindings: [] }, punch = { id: 'punch', level: 1, bindings: [] }, ember = { id: 'ember', level: 1, bindings: [] };
  const wrong = St.skillSheet([], volley, St.sheet([], { weapon: sword }));
  assert.equal(wrong.usable, false, 'a bow sigil with a sword in hand');
  assert.equal(wrong.rate, 0);
  const none = St.skillSheet([], volley, St.sheet([], {}));
  assert.equal(none.usable, false, 'and with no weapon at all');
  const bare = St.skillSheet([], punch, St.sheet([], {}));
  assert.deepEqual([bare.usable, bare.attack, bare.rate], [true, true, 1], 'no weapon needed: one cast a second, the sigil\'s own rate');
  assert.deepEqual([bare.min[T.physical], bare.max[T.physical], bare.critChance], [2, 4, 5]);
  assert.deepEqual(plain(bare.tags), ['attack', 'melee']);
  const armed = St.skillSheet([], punch, St.sheet([], { weapon: sword }));
  assert.deepEqual([armed.min[T.physical], armed.max[T.physical], armed.critChance, armed.rate], [12, 24, 10, 2]);
  const spell = St.skillSheet([], ember, St.sheet([], { weapon: sword }));
  assert.deepEqual([spell.attack, spell.rate, spell.critChance], [false, 1, 6], 'a spell takes nothing from the weapon');
  assert.deepEqual([spell.min[T.fire], spell.max[T.fire], spell.min[T.physical]], [4, 8, 0]);
  assert.ok(!spell.tags.includes('sword'));
});

test('a sigil\'s own numbers follow its level, and bindings change tags, numbers and params', () => {
  const St = withSigils(), T = St.TYPE, A = St.AILMENT;
  const at = (level, bindings = []) => St.skillSheet([], { id: 'ember', level, bindings }, St.sheet([], {}));
  const top = at(20);
  assert.deepEqual([top.min[T.fire], top.max[T.fire], top.ailChance[A.ignite], top.params.count], [64, 128, 29, 3]);
  near(top.rate, 2.9);
  const mid = at(10.5);
  near(mid.min[T.fire], 16);                           // the geometric middle of 4 and 64
  near(mid.max[T.fire], 32);
  near(mid.rate, 1.95);
  near(mid.params.count, 2);

  const bound = at(1, ['kindle', 'spread', 'heavy']);
  assert.deepEqual(Array.from(bound.bindings, (b) => b.id), ['kindle', 'spread'], 'heavy needs melee and refuses spells');
  assert.deepEqual(plain(bound.tags), ['spell', 'projectile', 'fire', 'area'], 'spread adds the area tag');
  assert.deepEqual([bound.min[T.fire], bound.max[T.fire]], [8, 16], 'kindle: 100% more');
  assert.equal(bound.projectiles, 2);
  assert.deepEqual(plain(bound.params), { speed: 19, count: 3, fan: 0.4 }, 'params add up; a new key starts from 0');
  // an area modifier now reaches the sigil, because the binding made it an area sigil
  const area = [mod('damage', 'inc', 50, { tags: ['area'] })];
  assert.equal(St.skillSheet(area, { id: 'ember', level: 1, bindings: [] }, St.sheet(area, {})).min[T.fire], 4);
  assert.equal(St.skillSheet(area, { id: 'ember', level: 1, bindings: ['spread'] }, St.sheet(area, {})).min[T.fire], 6);
  assert.equal(St.fits(top.def, bound.bindings[0]), true);
  assert.throws(() => St.skillSheet([], { id: 'nothing', level: 1, bindings: [] }, St.sheet([], {})), /no sigil "nothing"/);
});

test('param modifiers change a sigil\'s params, and only the params it has', () => {
  const St = withSigils();
  const mods = [mod('param.count', 'flat', 1, { tags: ['projectile'] }), mod('param.count', 'flat', 5, { tags: ['melee'] }),
    mod('param.speed', 'inc', 50), mod('param.radius', 'flat', 3), mod('param.fan', 'more', 100)];
  const sheet = St.sheet(mods, {});
  assert.deepEqual(plain(St.skillSheet(mods, { id: 'ember', level: 1, bindings: [] }, sheet).params), { speed: 21, count: 2 });
  assert.deepEqual(plain(St.skillSheet(mods, { id: 'ember', level: 1, bindings: ['spread'] }, sheet).params), { speed: 21, count: 4, fan: 0.8 });
  assert.deepEqual(plain(St.skillSheet(mods, { id: 'cleave', level: 1, bindings: [] }, sheet).params), { radius: 5, arc: 2.4 });
});

test('modifiers about the target are set aside with the types they reach', () => {
  const St = withSigils(), T = St.TYPE, bit = (id) => 1 << T[id];
  const mods = [
    mod('damage', 'inc', 30, { cond: 'tBoss', tags: ['fire'] }),             // ember is a fire sigil: every type's hit tags hold "fire"
    mod('damage', 'more', 50, { cond: 'tFrozen', tags: ['cold'] }),          // only the cold part
    mod('damage', 'inc', 10, { cond: 'tElite', tags: ['melee'] }),           // ember is not melee: dropped
    mod('critChance', 'flat', 20, { cond: 'tNear', per: { stat: 'level', div: 5 } }),
    mod('damage', 'inc', 15, { cond: 'tIgnited', tags: ['elemental'] }),     // fire, cold and lightning
    mod('armour', 'flat', 9, { cond: 'tBoss', local: true }),                // local: never
  ];
  const ss = St.skillSheet(mods, { id: 'ember', level: 1, bindings: [] }, St.sheet(mods, { level: 11 }));
  const all = 0b11111, elemental = bit('fire') | bit('cold') | bit('lightning');
  assert.deepEqual(plain(ss.targetMods), [
    { stat: 'damage', op: 'inc', value: 30, hi: 30, cond: St.COND.tBoss, types: all, skill: true },
    { stat: 'damage', op: 'more', value: 50, hi: 50, cond: St.COND.tFrozen, types: bit('cold'), skill: false },
    { stat: 'critChance', op: 'flat', value: 40, hi: 40, cond: St.COND.tNear, types: all, skill: true },
    { stat: 'damage', op: 'inc', value: 15, hi: 15, cond: St.COND.tIgnited, types: elemental, skill: false },
  ]);
  assert.equal(ss.inc[T.fire], 0, 'none of them is in the sheet\'s own numbers');
  const boss = St.condMask(['tBoss']), burning = St.condMask(['tBoss', 'tIgnited', 'tFrozen']);
  near(St.hitMult(ss, T.fire, 0), 1);
  near(St.hitMult(ss, T.fire, boss), 1.3);
  near(St.hitMult(ss, T.fire, burning), 1.45);
  near(St.hitMult(ss, T.cold, burning), 1.45 * 1.5);
  near(St.hitMult(ss, T.physical, burning), 1.3);
});

test('a binding fits when the sigil has what it requires and nothing it excludes', () => {
  const sigil = { tags: ['spell', 'projectile', 'fire'] };
  const fits = (requires, excludes) => Stats.fits(sigil, { requires, excludes });
  assert.equal(fits([], []), true);
  assert.equal(fits(['spell'], []), true);
  assert.equal(fits(['spell', 'fire'], ['melee']), true);
  assert.equal(fits(['spell', 'cold'], []), false);
  assert.equal(fits([], ['fire']), false);
  assert.equal(fits(['projectile'], ['beam', 'projectile']), false);
});
