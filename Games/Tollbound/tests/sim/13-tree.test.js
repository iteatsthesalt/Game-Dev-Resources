// tests/sim/13-tree.test.js: the Plan (src/js/13-tree.js, Tree; src/js/32-plan.js, the plan 'main' and its nodes).
//   The rules of 04-progression.md, each on its own, in small worlds of their own whose street plans the tests draw:
//   one route, doubling, beaten bounds, toll rings (also counted at the toll of a real run), the banks, straight
//   miles, refunds and their price. Then the Plan the game ships: its size, every node reachable from every door,
//   every modifier in the tables of 10-stats.js, a door for each class, the river and its banks, the quarters, room
//   for a life's route; and Tree.mods against 14-character.js's plain reading where the rules say the two agree.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const modules = require('../../tools/modules.js');
const { loadSim, plain } = require('./loader.js');

const FILES = ['00-core.js', '01-defs.js', '02-pool-grid.js', '10-stats.js', '13-tree.js', '14-character.js', '16-savedata.js', '20-sim.js',
  '29-world.js', '30-modes-curves.js'];
const PLAN = { id: 'main', name: 'The Plan', rings: 8, streets: 12, ringGain: 15, bankGain: 60, mileGain: 25, mileFrom: 4, mileMost: 10,
  loopMost: 12, loopShare: 50, refund: 5 };

// A world with a class, its voice, a plan of these numbers and these nodes, finalized.
function world(nodes, plan) {
  const sim = loadSim({ only: FILES });
  const { Defs } = sim;
  Defs.add('voice', { id: 'test.toll', name: 'Toll', text: '', icon: null, attr: 'hand', tier: 1, tags: ['round'], weapon: null, archetype: 'ring',
    target: 'self', rate: 1, damage: { blow: [1, 2] }, weaponPct: 0, eff: 1, crit: 0, params: {}, mods: [], fx: {} });
  Defs.add('class', { id: 'test.ringer', name: 'Test Ringer', text: '', attrs: { hand: 10, knee: 5 }, perLevel: { hand: 2, knee: 1 }, base: [],
    voices: ['test.toll'], startGear: [], trade: { name: 'Set', text: '', icon: null, recharge: 8 }, callings: ['test.one', 'test.two'], unlock: null,
    puppet: 'test.ringer', palette: ['#A7312C'] });
  Defs.add('plan', Object.assign({}, PLAN, plan));
  for (const n of nodes) Defs.add('node', n);
  assert.deepEqual(plain(Defs.finalize()), [], 'the test world is valid');
  return sim;
}

// One node. Its mods default to one of its own, param.<id> +10, so that what each node gives can be told apart.
const node = (id, x, y, links, more) => Object.assign({ id, kind: 'corner', ring: 1, street: null, bank: null, x, y, name: id,
  mods: [{ stat: 'param.' + id, op: 'flat', value: 10 }], choice: null, links }, more);
const door = (id, x, y, links, more) => node(id, x, y, links, Object.assign({ kind: 'door', class: 'test.ringer', mods: [] }, more));

// A w x h grid of nodes 'g<x>-<y>' at (x, y), each linked to its four neighbours, the door at `from` ([0, 0] if not
// given); at(x, y) may give a node more fields.
function grid(w, h, at, from) {
  const out = [], d = from || [0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const id = 'g' + x + '-' + y, links = [];
      if (x > 0) links.push('g' + (x - 1) + '-' + y);
      if (x < w - 1) links.push('g' + (x + 1) + '-' + y);
      if (y > 0) links.push('g' + x + '-' + (y - 1));
      if (y < h - 1) links.push('g' + x + '-' + (y + 1));
      const more = at ? at(x, y) : null;
      out.push(x === d[0] && y === d[1] ? door(id, x, y, links, more) : node(id, x, y, links, more));
    }
  }
  return out;
}

// a character of the test class, with a point for every step a test asks of it
function ringer(sim, level) {
  const save = sim.SaveData.blank();
  const char = sim.Char.create(save, 'test.ringer', 'Ada');
  char.level = level || 70;
  return { save, char };
}

// walks the route on through these nodes, a point each; choices: {[nodeId]: attribute}
function walk(sim, char, ids, choices) {
  for (const id of ids) assert.equal(sim.Char.allocate(char, id, choices ? choices[id] : undefined), true, 'a step onto ' + id);
}

// what a list of modifiers holds of one stat: the sum of its values, and how many modifiers give it
function of(list, stat) {
  let sum = 0, n = 0;
  for (const m of list) if (m.stat === stat) { sum += m.value; n++; }
  return { sum: round(sum), n };
}
const round = (v) => Math.round(v * 1e6) / 1e6;
// a plain copy of modifiers with their values rounded, for comparing lists
const rounded = (list) => plain(list).map((m) => Object.assign(m, typeof m.value === 'number' ? { value: round(m.value) } : {}));

// round g2-2 of a grid whose door is at (0, 0), closing back at g1-1
const PERIMETER = ['g1-0', 'g1-1', 'g2-1', 'g3-1', 'g3-2', 'g3-3', 'g2-3', 'g1-3', 'g1-2', 'g1-1'];

// ---- one route ----

test('one route: a point extends the head to a node linked to it, and Tree.steps lists where it may go', () => {
  const sim = world(grid(4, 2));
  const { Tree, Char } = sim, { char } = ringer(sim);
  assert.deepEqual(plain(char.plan.walk), ['g0-0'], 'the route starts at its class\'s door');
  assert.equal(Tree.door('test.ringer'), 'g0-0');
  assert.equal(Tree.door('nobody'), null);
  assert.deepEqual(plain(Tree.steps(char.plan.walk)), ['g1-0', 'g0-1'], 'the door\'s links');
  assert.equal(Char.allocate(char, 'g2-0'), false, 'a node not next to the head is refused');
  walk(sim, char, ['g1-0', 'g2-0']);
  assert.deepEqual(plain(Tree.steps(char.plan.walk)), ['g1-0', 'g3-0', 'g2-1'], 'from the new head');
  assert.equal(Char.allocate(char, 'g0-1'), false, 'the walk never branches: a node next to an older part of the route is refused');
  const out = Tree.mods(char, Infinity, []);
  assert.deepEqual([of(out, 'param.g1-0'), of(out, 'param.g2-0'), of(out, 'param.g0-1')], [{ sum: 10, n: 1 }, { sum: 10, n: 1 }, { sum: 0, n: 0 }],
    'every node of the route gives its printed value once; the door gives nothing');
  const own = Tree.mods(char, Infinity);
  assert.ok(Array.isArray(own) && own.length === 2, 'without a list to push onto it makes its own');
  assert.deepEqual(plain(Tree.steps([])), [], 'an empty route has no steps');
});

test('one route: no point is spent that the character does not have', () => {
  const sim = world(grid(4, 1));
  const { Char } = sim, { char } = ringer(sim, 3);
  walk(sim, char, ['g1-0', 'g2-0']);
  assert.deepEqual(plain(Char.points(char)), { have: 2, spent: 2, free: 0 });
  assert.equal(Char.allocate(char, 'g3-0'), false, 'a level gives a point from the second, and none is left');
});

// ---- doubling ----

test('doubling: stepping onto a node the route holds costs a point and doubles it, once per node', () => {
  const sim = world(grid(3, 2));
  const { Tree, Char } = sim, { char } = ringer(sim);
  walk(sim, char, ['g1-0', 'g1-1', 'g0-1', 'g0-0', 'g1-0']);
  assert.deepEqual(plain(Tree.held(char.plan.walk)), { 'g0-0': 2, 'g1-0': 2, 'g1-1': 1, 'g0-1': 1 });
  assert.equal(Char.points(char).spent, 5, 'each step is a point, a doubling one too');
  const out = Tree.mods(char, Infinity, []);
  assert.deepEqual(of(out, 'param.g1-0'), { sum: 20, n: 2 }, 'a doubled node gives its modifiers twice');
  assert.deepEqual(of(out, 'param.g1-1'), { sum: 10, n: 1 });
  assert.equal(Tree.steps(char.plan.walk).includes('g0-0'), false, 'a node held twice is no step');
  assert.equal(Char.allocate(char, 'g0-0'), false, 'and a third step onto it is refused');
});

// ---- beaten bounds ----

test('beaten bounds: a loop the route closes grants the nodes inside it at half strength, without a point', () => {
  const sim = world(grid(5, 5));
  const { Tree, Char } = sim, { char } = ringer(sim);
  walk(sim, char, PERIMETER);
  const loops = plain(Tree.loops(char.plan.walk));
  assert.deepEqual(loops, [{ from: 2, to: 10, inside: ['g2-2'], grants: true }], 'stepping back onto g1-1 closes one loop, round g2-2');
  assert.deepEqual(plain(Tree.granted(char.plan.walk)), ['g2-2']);
  assert.equal(Char.points(char).spent, 10, 'the granted node costs no point');
  const out = Tree.mods(char, Infinity, []);
  assert.deepEqual(of(out, 'param.g2-2'), { sum: 5, n: 1 }, 'it gives loopShare percent of its printed value');
  assert.deepEqual(of(out, 'param.g1-1'), { sum: 20, n: 2 }, 'the node the loop closed on is doubled');
  assert.deepEqual(of(out, 'param.g2-1'), { sum: 10, n: 1 }, 'the loop\'s own nodes are held, not granted');
  assert.equal(of(out, 'param.g4-4').n, 0, 'nothing outside the loop');
  const back = ringer(sim);
  walk(sim, back.char, ['g1-0', 'g2-0', 'g1-0']);
  assert.deepEqual(plain(Tree.loops(back.char.plan.walk)), [{ from: 1, to: 3, inside: [], grants: false }], 'stepping straight back fences nothing');
});

test('beaten bounds: a loop that fences more than loopMost nodes grants nothing', () => {
  const big = ['g1-0', 'g1-1', 'g2-1', 'g3-1', 'g4-1', 'g4-2', 'g4-3', 'g4-4', 'g3-4', 'g2-4', 'g1-4', 'g1-3', 'g1-2', 'g1-1'];
  const sim = world(grid(6, 6), { loopMost: 3 });
  const { Tree } = sim, { char } = ringer(sim);
  walk(sim, char, big);
  const loop = plain(Tree.loops(char.plan.walk))[0];
  assert.deepEqual(loop.inside, ['g2-2', 'g3-2', 'g2-3', 'g3-3'], 'it fences the four nodes inside');
  assert.equal(loop.grants, false, 'more than the plan\'s loopMost, 3');
  assert.deepEqual(plain(Tree.granted(char.plan.walk)), []);
  assert.equal(of(Tree.mods(char, Infinity, []), 'param.g2-2').n, 0, 'so nothing inside is granted');
  const design = world(grid(6, 6)), d = ringer(design);
  walk(design, d.char, big);
  assert.deepEqual(plain(design.Tree.granted(d.char.plan.walk)), ['g2-2', 'g3-2', 'g2-3', 'g3-3'], 'within the design\'s 12 all four are granted');
});

test('beaten bounds: a node inside two loops is granted once', () => {
  const sim = world(grid(5, 5));
  const { Tree } = sim, { char } = ringer(sim);
  walk(sim, char, PERIMETER.concat(['g2-1', 'g3-1']));   // round the block again: each step onto a node held once closes a loop
  const loops = plain(Tree.loops(char.plan.walk));
  assert.equal(loops.length, 3, 'three loops: at g1-1, at g2-1 and at g3-1');
  assert.ok(loops.every((l) => l.grants && l.inside.length === 1 && l.inside[0] === 'g2-2'), 'each fences g2-2');
  assert.deepEqual(plain(Tree.granted(char.plan.walk)), ['g2-2']);
  assert.deepEqual(of(Tree.mods(char, Infinity, []), 'param.g2-2'), { sum: 5, n: 1 }, 'granted once');
});

test('beaten bounds: a node the route holds is never granted, even inside a loop', () => {
  // the door at the middle of a 7 x 7 grid; the route takes g3-2, then walks round both and closes at g3-1
  const sim = world(grid(7, 7, null, [3, 3]));
  const { Tree } = sim, { char } = ringer(sim);
  walk(sim, char, ['g3-2', 'g3-1', 'g4-1', 'g4-2', 'g4-3', 'g4-4', 'g3-4', 'g2-4', 'g2-3', 'g2-2', 'g2-1', 'g3-1']);
  const loop = plain(Tree.loops(char.plan.walk))[0];
  assert.deepEqual(loop.inside, ['g3-2', 'g3-3'], 'the loop fences the held g3-2 and the door');
  assert.equal(loop.grants, true);
  assert.deepEqual(plain(Tree.granted(char.plan.walk)), [], 'but both are held');
  assert.deepEqual(of(Tree.mods(char, Infinity, []), 'param.g3-2'), { sum: 10, n: 1 }, 'g3-2 gives its full value once');
});

test('beaten bounds: a granted lane gives half a point of the first attribute it offers; rings and banks still count', () => {
  const sim = world(grid(5, 5, (x, y) => (x === 2 && y === 2 ? { kind: 'lane', ring: 3, mods: [], choice: ['knee', 'hand'] } : null)));
  const { Tree } = sim, { char } = ringer(sim);
  walk(sim, char, PERIMETER);
  const out = Tree.mods(char, Infinity, []);
  assert.deepEqual(of(out, 'knee'), { sum: 0.65, n: 1 }, 'half of a ring-3 point of Knee: 0.5 x 1.3');
  assert.equal(of(out, 'hand').n, 0);
  assert.equal(of(Tree.mods(char, 1, []), 'knee').n, 0, 'a granted node of ring 3 also waits for the second toll');
  assert.equal(of(Tree.mods(char, 2, []), 'knee').n, 1);
  const banked = world(grid(5, 5, (x, y) => (x === 2 && y === 2 ? { bank: 'ebb' } : null))), b = ringer(banked);
  walk(banked, b.char, PERIMETER);
  assert.deepEqual(rounded(banked.Tree.mods(b.char, Infinity, []).filter((m) => m.stat === 'param.g2-2')),
    [{ stat: 'param.g2-2', op: 'flat', value: 8, cond: 'dry' }], 'a granted bank node keeps its bank: 10 x 0.5 x 1.6, on dry ground');
});

// ---- toll rings ----

test('toll rings: a node of ring N works from the (N - 1)th toll, its values x (1 + 0.15 x (N - 1))', () => {
  const nodes = [door('d', 0, 0, ['r1']), node('r1', 1, 0, ['d', 'r2']), node('r2', 2, 0, ['r1', 'r4'], { ring: 2 }),
    node('r4', 3, 0, ['r2', 'r8'], { ring: 4 }), node('r8', 4, 0, ['r4'], { ring: 8 })];
  const sim = world(nodes);
  const { Tree, Defs } = sim, { char } = ringer(sim);
  walk(sim, char, ['r1', 'r2', 'r4', 'r8']);
  const at = (toll) => ['r1', 'r2', 'r4', 'r8'].map((id) => of(Tree.mods(char, toll, []), 'param.' + id).sum);
  assert.deepEqual(at(0), [10, 0, 0, 0], 'at the start of a vigil, ring 1 alone');
  assert.deepEqual(at(1), [10, 11.5, 0, 0], 'from the first toll ring 2, at 115%');
  assert.deepEqual(at(3), [10, 11.5, 14.5, 0], 'ring 4 from the third, at 145%');
  assert.deepEqual(at(6), [10, 11.5, 14.5, 0], 'ring 8 not yet at the sixth');
  assert.deepEqual(at(7), [10, 11.5, 14.5, 20.5], 'ring 8 from the seventh, at 205%');
  assert.deepEqual(at(Infinity), at(7), 'outside a vigil every ring counts');
  assert.deepEqual(at(NaN), at(7), 'and a toll that is no number counts as outside');
  assert.equal(Tree.from(Defs.get('node', 'r8')), 7);
  assert.equal(round(Tree.factor(Defs.get('node', 'r4'), char.plan.walk)), 1.45);
});

test('toll rings: in a character\'s vigil the sheet counts a ring from its toll on, rebuilt when the toll rings', () => {
  const nodes = [door('d', 0, 0, ['inner']), node('inner', 1, 0, ['d', 'outer'], { mods: [{ stat: 'life-max', op: 'flat', value: 10 }] }),
    node('outer', 2, 0, ['inner'], { ring: 2, mods: [{ stat: 'life-max', op: 'flat', value: 20 }] })];
  const sim = world(nodes);
  const { Char, Sim } = sim, { save, char } = ringer(sim, 3);
  walk(sim, char, ['inner', 'outer']);
  const classOnly = round(Char.sheet(char, null).stats['life-max'] - 10 - 23);   // outside a vigil both count: 10, and 20 x 1.15
  const cfg = Char.begin(save, char.uid, 'debug', 7);
  cfg.rules = { tollSeconds: 1 };
  const S = Sim.create(cfg);
  assert.equal(round(S.sheet.stats['life-max']), classOnly + 10, 'before the first toll only the ring-1 node counts');
  let steps = 0;
  while (S.toll < 1 && steps < 200) { Sim.step(S); steps++; }
  assert.equal(S.toll, 1, 'the first toll rang');
  assert.equal(round(S.sheet.stats['life-max']), classOnly + 10, 'it rang at the end of a step');
  Sim.step(S);   // the toll marked the run dirty: the next step's rebuild counts the ring
  assert.equal(round(S.sheet.stats['life-max']), classOnly + 33, 'from the first toll the ring-2 node counts, at 115%');
});

// ---- the banks ----

test('the banks: a flood node works only in water and an ebb node only on dry ground, both at 160%', () => {
  const nodes = [door('d', 0, 0, ['f']), node('f', 1, 0, ['d', 'e'], { bank: 'flood', mods: [
    { stat: 'damage', op: 'inc', value: 10 }, { stat: 'guard.blow', op: 'flat', value: 5, cond: 'braced' },
    { stat: 'speed', op: 'inc', value: 5, cond: ['braced', 'crowded'] }, { stat: 'move-speed', op: 'inc', value: 4, cond: 'in-water' }] }),
  node('e', 2, 0, ['f', 'l'], { bank: 'ebb', mods: [{ stat: 'damage', op: 'inc', value: 10, unless: 't-in-water' }] }),
  node('l', 3, 0, ['e'], { kind: 'lane', bank: 'ebb', mods: [], choice: ['heel', 'ear'] })];
  const sim = world(nodes);
  const { Tree, Stats } = sim, { char } = ringer(sim);
  walk(sim, char, ['f', 'e', 'l'], { l: 'ear' });
  assert.deepEqual(rounded(Tree.mods(char, Infinity, [])), [
    { stat: 'damage', op: 'inc', value: 16, cond: 'in-water' },
    { stat: 'guard.blow', op: 'flat', value: 8, cond: ['braced', 'in-water'] },
    { stat: 'speed', op: 'inc', value: 8, cond: ['braced', 'crowded', 'in-water'] },
    { stat: 'move-speed', op: 'inc', value: 6.4, cond: 'in-water' },
    { stat: 'damage', op: 'inc', value: 16, unless: 't-in-water', cond: 'dry' },
    { stat: 'ear', op: 'flat', value: 1.6, cond: 'dry' },
  ], 'the bank\'s condition joins each modifier\'s own, and a chosen point\'s');
  const list = Tree.mods(char, Infinity, []);
  assert.equal(round(Stats.query(list, 'damage', [], ['in-water'])), 116, 'in water the flood node counts');
  assert.equal(round(Stats.query(list, 'damage', [], ['dry'])), 116, 'on dry ground the ebb node');
  assert.equal(round(Stats.query(list, 'damage', [], [])), 100, 'and neither where the ground is neither');
  assert.equal(round(Tree.factor(sim.Defs.get('node', 'f'), char.plan.walk)), 1.6);
});

// ---- straight miles ----

test('straight miles: a milestone gains 25% for each held node beyond the 4th in its unbroken straight run, 10 at most', () => {
  const nodes = [door('d', 0, -1, ['s0'])];
  for (let i = 0; i < 16; i++) {
    const links = [i > 0 ? 's' + (i - 1) : 'd'];
    if (i < 15) links.push('s' + (i + 1));
    if (i === 3) links.push('side');
    nodes.push(node('s' + i, i, 0, links, { street: 0, kind: i === 4 ? 'milestone' : 'corner' }));
  }
  nodes.push(node('side', 3, 1, ['s3', 'side2']), node('side2', 4, 1, ['side']));
  const sim = world(nodes);
  const { Tree, Defs } = sim;
  const run = (ids) => {
    const c = ringer(sim).char;
    walk(sim, c, ids);
    return { run: Tree.run(c.plan.walk, 's4'), value: of(Tree.mods(c, Infinity, []), 'param.s4').sum };
  };
  const first = (n) => Array.from({ length: n }, (_, i) => 's' + i);
  assert.deepEqual(run(first(5)), { run: 5, value: 12.5 }, 'five in a row: one beyond the fourth, +25%');
  assert.deepEqual(run(first(6)), { run: 6, value: 15 }, 'six: +50%');
  assert.deepEqual(run(first(13)), { run: 13, value: 32.5 }, 'thirteen: nine beyond, +225%');
  assert.deepEqual(run(first(14)), { run: 14, value: 35 }, 'fourteen: ten beyond, +250%');
  assert.deepEqual(run(first(16)), { run: 16, value: 35 }, 'sixteen: twelve beyond, counted to ten');
  assert.deepEqual(run(first(4).concat(['side', 'side2'])), { run: 0, value: 0 }, 'a milestone not held gives nothing and has no run');
  assert.deepEqual(run(first(7).concat(['s5', 's4', 's3', 'side', 'side2'])), { run: 7, value: 35 },
    'nodes off the street do not count, a doubled node in the run counts once, and a doubled milestone gives its grown value twice');
  const mile = Defs.get('node', 's4');
  assert.equal(Tree.factor(mile, ['d', 's0', 's1', 's2', 's3']), 1.25, 'Tree.factor counts a milestone as if the next step held it');
  assert.equal(Tree.run(['d', 's0'], 's0'), 1);
  assert.equal(Tree.run(['d', 's0'], 'd'), 0, 'a node in no street has no run');
});

test('straight miles: an unheld node breaks the run however it is walked, and a held node beyond the toll still counts in it', () => {
  const street = (extra) => [door('d', 0, -1, ['s0']), node('s0', 0, 0, ['d', 's1'].concat(extra.s0 || []), { street: 0 }),
    node('s1', 1, 0, ['s0', 's2'].concat(extra.s1 || []), { street: 0 }), node('s2', 2, 0, ['s1', 's3'].concat(extra.s2 || []), { street: 0 }),
    node('s3', 3, 0, ['s2', 's4'], { street: 0, kind: 'milestone' }), node('s4', 4, 0, ['s3', 's5'], { street: 0 }),
    node('s5', 5, 0, ['s4', 's6'], { street: 0, ring: 3 }), node('s6', 6, 0, ['s5'], { street: 0, ring: 3 })];
  const round1 = world(street({ s1: ['x'], s2: ['y'] }).concat([node('x', 1, 1, ['s1', 'y']), node('y', 2, 1, ['x', 's2'])]));
  const a = ringer(round1).char;
  walk(round1, a, ['s0', 's1', 'x', 'y', 's2', 's3', 's4', 's5', 's6']);
  assert.equal(round1.Tree.run(a.plan.walk, 's3'), 7, 'held from s0 to s6: the run is unbroken, though the route left the street');
  assert.equal(of(round1.Tree.mods(a, 0, []), 'param.s3').sum, 10 * 1.75,
    'at the start of a vigil s5 and s6 (ring 3) do not work, but they are held and count in the run');
  const skip = world(street({ s0: ['x'], s2: ['y'] }).concat([node('x', 0, 1, ['s0', 'y']), node('y', 2, 1, ['x', 's2'])]));
  const b = ringer(skip).char;
  walk(skip, b, ['s0', 'x', 'y', 's2', 's3', 's4', 's5', 's6']);
  assert.equal(skip.Tree.run(b.plan.walk, 's3'), 5, 's1 is not held: the run is s2 to s6');
  assert.equal(of(skip.Tree.mods(b, Infinity, []), 'param.s3').sum, 12.5);
});

// ---- refunds ----

test('refunds: points come back only from the head, newest first, for the plan\'s refund x the head\'s ring in coin', () => {
  const nodes = [door('d', 0, 0, ['a']), node('a', 1, 0, ['d', 'b'], { kind: 'lane', mods: [], choice: ['hand', 'knee'] }),
    node('b', 2, 0, ['a', 'c'], { ring: 3 }), node('c', 3, 0, ['b'], { ring: 4 })];
  const sim = world(nodes);
  const { Char, Tree } = sim, { char } = ringer(sim);
  walk(sim, char, ['a', 'b', 'c', 'b', 'a'], { a: 'knee' });
  const account = { coin: 100 };
  assert.equal(Char.refundPrice(char), 5, 'the head is a, of ring 1: 5 coin');
  assert.equal(Char.refund(char, account), 'a');
  assert.equal(account.coin, 95);
  assert.deepEqual(plain(char.plan.choice), { a: 'knee' }, 'a lane the route still holds keeps its attribute');
  assert.equal(Char.refundPrice(char), 15, 'now b, of ring 3: 15 coin');
  assert.equal(Char.refund(char, { coin: 14 }), null, 'refused without the coin');
  assert.deepEqual(plain(char.plan.walk), ['d', 'a', 'b', 'c', 'b'], 'and nothing changed');
  assert.equal(Char.refund(char, account), 'b');
  assert.equal(Char.refund(char, account), 'c');
  assert.equal(account.coin, 95 - 15 - 20, 'c, of ring 4: 20 coin');
  assert.deepEqual(rounded(Tree.mods(char, Infinity, [])), [{ stat: 'knee', op: 'flat', value: 1 }, { stat: 'param.b', op: 'flat', value: 13 }],
    'what is left gives what the shorter route gives');
  Char.refund(char, account);
  Char.refund(char, account);
  assert.deepEqual(plain(char.plan), { walk: ['d'], choice: {} }, 'a lane taken back off the route forgets its attribute');
  assert.equal(Char.refund(char, account), null, 'the door is never taken back');
  assert.equal(Char.refundPrice(char), 0);
});

// ---- the modifiers themselves ----

test('Tree.give: values are multiplied, a set\'s excepted; a Scaled value keeps its curve, a pair both ends', () => {
  const sim = world([door('d', 0, 0, ['a']), node('a', 1, 0, ['d'])]);
  const { Tree } = sim;
  const n = { bank: null, choice: null, mods: [
    { stat: 'damage', op: 'more', value: 20 }, { stat: 'turn-limit', op: 'set', value: 120 },
    { stat: 'life-max', op: 'flat', value: { a: 2, b: 20, curve: 'lin' } }, { stat: 'added.blow', op: 'flat', value: [1, 3] }] };
  assert.deepEqual(plain(Tree.give(n, null, 2, [])), [
    { stat: 'damage', op: 'more', value: 40 }, { stat: 'turn-limit', op: 'set', value: 120 },
    { stat: 'life-max', op: 'flat', value: { a: 4, b: 40, curve: 'lin' } }, { stat: 'added.blow', op: 'flat', value: [2, 6] }]);
  assert.equal(Tree.give(n, null, 1, [])[0], n.mods[0], 'at its printed value with no bank a node\'s own modifier is passed on');
  assert.deepEqual(plain(Tree.give({ bank: null, choice: ['hand'], mods: [] }, 'knee', 1, [])), [], 'a lane gives nothing for an attribute it does not offer');
  assert.deepEqual(plain(Tree.mods({ plan: { walk: [], choice: {} } }, 0, [])), [], 'an empty route gives nothing');
  assert.deepEqual(plain(Tree.mods(null, 0, [])), [], 'nor does no character');
  assert.deepEqual(plain(Tree.mods({ plan: { walk: ['d', 'a', 'gone'], choice: {} } }, 0, [])), [{ stat: 'param.a', op: 'flat', value: 10 }],
    'a node the definitions do not have is passed over');
  assert.equal(Tree.plan().loopMost, 12, 'Tree.plan is the plan main');
  assert.equal(loadSim({ only: ['00-core.js', '01-defs.js', '10-stats.js', '13-tree.js'] }).Tree.plan().ringGain, 15, 'or the design\'s numbers without one');
});

test('a door may name any of the design\'s six classes before the class is built, and nothing else', () => {
  const sim = loadSim({ only: FILES });
  const { Defs } = sim;
  Defs.add('class', { id: 'test.ringer', name: 'Test Ringer', text: '', attrs: {}, perLevel: {}, base: [], voices: ['test.toll'], startGear: [],
    trade: { name: 'Set', text: '', icon: null, recharge: 8 }, callings: ['a', 'b'], unlock: null, puppet: 'p', palette: ['#A7312C'] });
  Defs.add('node', door('one', 0, 0, ['two'], { class: 'test.ringer' }));
  Defs.add('node', door('two', 1, 0, ['one', 'three'], { class: 'sexton' }));
  Defs.add('node', door('three', 2, 0, ['two'], { class: 'gravedigger' }));
  const errors = plain(Defs.finalize()).filter((e) => e.startsWith('node'));
  assert.equal(errors.length, 1, errors.join('; '));
  assert.match(errors[0], /^node three: class /, 'a class that is neither built nor one of the six is refused');
});

// ---- the Plan the game ships ----

const game = loadSim({ boot: true });
const NODES = game.Defs.all('node');
const BY_ID = new Map(NODES.map((n) => [n.id, n]));
const CLASSES = ['change-ringer', 'verger', 'toll-gatherer', 'lamp-trimmer', 'organ-blower', 'sexton'];   // 03-classes.md
const isBridge = (n) => n.id.startsWith('plan.bridge.');

function reach(from, keep) {
  const seen = new Set([from]), todo = [from];
  while (todo.length) {
    const n = BY_ID.get(todo.pop());
    for (const l of n.links) if (!seen.has(l) && (!keep || keep(BY_ID.get(l)))) { seen.add(l); todo.push(l); }
  }
  return seen;
}
const angle = (n) => ((Math.atan2(n.y, n.x) * 180 / Math.PI) + 360) % 360;

test('the Plan: the size and numbers the design gives, every node reachable from every door', () => {
  const plan = game.Defs.get('plan', 'main');
  assert.deepEqual([plan.rings, plan.streets, plan.ringGain, plan.bankGain, plan.mileGain, plan.mileFrom, plan.mileMost, plan.loopMost, plan.loopShare],
    [8, 12, 15, 60, 25, 4, 10, 12, 50], 'the numbers of 04-progression.md');
  assert.ok(NODES.length >= 600 && NODES.length <= 680, 'about 640 nodes: ' + NODES.length);
  assert.deepEqual([...new Set(NODES.map((n) => n.ring))].sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(NODES.every((n) => n.id.startsWith('plan.')), 'node ids begin plan.');
  for (const d of NODES.filter((n) => n.kind === 'door')) assert.equal(reach(d.id).size, NODES.length, 'every node is reachable from ' + d.id);
  for (const n of NODES) {
    assert.ok(n.links.length >= 1 && n.links.length <= 8 && n.links.every((l) => BY_ID.get(l).links.includes(n.id)), n.id + ' links both ways');
    assert.ok(typeof n.name === 'string' && n.name.length > 0, n.id + ' has a name');
  }
});

test('the Plan: a door for each of the six classes on ring 1, two streets apart; a new Change-ringer starts at its own', () => {
  const doors = plain(NODES.filter((n) => n.kind === 'door'));
  assert.deepEqual(doors.map((d) => d.class).sort(), CLASSES.slice().sort());
  assert.ok(doors.every((d) => d.ring === 1 && d.mods.length === 0 && d.id === 'plan.door.' + d.class));
  assert.deepEqual(doors.map((d) => d.street).sort((a, b) => a - b), [1, 3, 5, 7, 9, 11], 'two streets apart');
  const save = game.SaveData.blank(), c = game.Char.create(save, 'change-ringer', 'Hester Pell');
  assert.deepEqual(plain(c.plan.walk), ['plan.door.change-ringer']);
  assert.equal(game.Tree.door('change-ringer'), 'plan.door.change-ringer');
});

test('the Plan: every modifier names a stat, tags and conditions of 10-stats.js; each kind gives what the design says', () => {
  const { Stats } = game;
  // stats of which less is better: a square's price on one of these is a rise
  const LESS = ['taken', 'brace-time', 'set-time', 'find-weight', 'wrong-foot-taken', 'scarring', 'shove-taken', 'trade-recharge', 'heave-recharge',
    'stride-share', 'sound-time'];
  const cost = (m) => (LESS.includes(m.stat) ? m.value > 0 : m.value < 0);
  for (const n of NODES) {
    for (const m of n.mods) {
      assert.ok(Stats.stat(m.stat) !== null, n.id + ': the stat ' + m.stat);
      assert.ok(['flat', 'inc', 'more'].includes(m.op), n.id + ': the op ' + m.op);
      assert.ok(m.op !== 'more' || n.kind === 'square', n.id + ': more only on a square');
      assert.ok(typeof m.value === 'number' && m.value !== 0, n.id + ': a plain number');
      for (const t of m.tags || []) assert.ok(Stats.is('tag', t), n.id + ': the tag ' + t);
      for (const c of [].concat(m.cond || [], m.unless || [])) assert.ok(Stats.is('cond', c), n.id + ': the condition ' + c);
    }
    if (n.kind === 'lane' && n.choice !== null) assert.equal(n.mods.length, 0, n.id + ' offers a choice and nothing else');
    if (n.kind === 'lane' && n.choice === null) assert.equal(n.mods.length, 1, n.id + ': a lane without a choice gives a small stat');
    if (n.kind === 'corner') assert.equal(n.mods.length, 1, n.id + ': one stat');
    if (n.kind === 'milestone') assert.ok(n.mods.length === 1 && n.street !== null, n.id + ': one stat, in a street');
    if (n.kind === 'square') assert.ok(n.mods.length === 2 && n.mods.filter(cost).length === 1, n.id + ': a rule and its price');
  }
  const kinds = {};
  for (const n of NODES) kinds[n.kind] = (kinds[n.kind] || 0) + 1;
  assert.ok(kinds.lane > 200 && kinds.corner > 200 && kinds.square >= 36 && kinds.milestone === 24 && kinds.door === 6, JSON.stringify(kinds));
  const lanes = NODES.filter((n) => n.kind === 'lane' && n.choice !== null);
  assert.ok(lanes.length > 100 && lanes.every((n) => n.choice.length >= 2), 'lanes give a point of an attribute you choose');
});

test('the Plan: the river crosses it west to east south of the close; four bridges join the Flood bank to the Ebb bank', () => {
  const r = game.Defs.get('plan', 'main').look.river;
  const riverY = (x) => {
    for (let i = 0; i + 1 < r.length; i++) if (x >= r[i][0] && x <= r[i + 1][0]) return r[i][1] + (r[i + 1][1] - r[i][1]) * (x - r[i][0]) / (r[i + 1][0] - r[i][0]);
    return Infinity;
  };
  const toRiver = (n) => {
    let best = Infinity;
    for (let k = 0; k + 1 < r.length; k++) {
      const ax = r[k][0], ay = r[k][1], dx = r[k + 1][0] - ax, dy = r[k + 1][1] - ay;
      const t = Math.max(0, Math.min(1, ((n.x - ax) * dx + (n.y - ay) * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(ax + t * dx - n.x, ay + t * dy - n.y));
    }
    return best;
  };
  const south = (n) => n.y > riverY(n.x);
  assert.ok(r[0][0] < -78 && r[r.length - 1][0] > 78, 'from beyond the west of the plan to beyond its east');
  const bridges = NODES.filter(isBridge);
  assert.equal(bridges.length, 4);
  for (const b of bridges) {
    assert.ok(b.bank === null && b.street !== null && b.links.length === 2, b.id + ': on a street, of no bank, linking two nodes');
    assert.notEqual(south(BY_ID.get(b.links[0])), south(BY_ID.get(b.links[1])), b.id + ' joins the two sides');
  }
  for (const n of NODES) {
    if (n.bank === 'flood') assert.ok(south(n), n.id + ': the Flood bank is south of the river');
    if (n.bank === 'ebb') assert.ok(!south(n), n.id + ': the Ebb bank is north of it');
    if (isBridge(n)) continue;
    for (const l of n.links) if (!isBridge(BY_ID.get(l))) assert.equal(south(BY_ID.get(l)), south(n), n.id + ' - ' + l + ' does not cross the water');
    if (n.bank !== null) assert.ok(toRiver(n) < 20, n.id + ' lies within two steps of the water');
    if (toRiver(n) < 6.5) assert.ok(n.bank !== null, n.id + ' stands at the water and is on a bank');
    assert.ok(toRiver(n) >= 1.6, n.id + ' does not stand in the water');
  }
  const banks = NODES.filter((n) => n.bank !== null);
  assert.ok(banks.length > 60 && banks.some((n) => n.bank === 'flood') && banks.some((n) => n.bank === 'ebb'), banks.length + ' bank nodes');
  assert.ok(NODES.filter((n) => n.kind === 'door').every((n) => !south(n)), 'the doors stand north of it, by the close');
  const r2 = game.Defs.get('plan', 'main').look.radii[1];
  assert.ok(NODES.filter((n) => Math.hypot(n.x, n.y) <= r2 + 0.01).every((n) => !south(n)), 'the river passes outside the second ring road');
});

test('the Plan: each door leads into its own quarter, which holds together, and the quarters connect', () => {
  const look = game.Defs.get('plan', 'main').look;
  for (const d of NODES.filter((n) => n.kind === 'door')) {
    const mid = look.first + look.step * d.street;
    const inQuarter = (n) => Math.abs(((angle(n) - mid + 540) % 360) - 180) <= look.step + 0.01;
    const own = NODES.filter(inQuarter), held = reach(d.id, inQuarter);
    assert.ok(held.size === own.length, d.class + ': its quarter is one piece from its door (' + held.size + ' of ' + own.length + ')');
    assert.ok(d.links.every((l) => inQuarter(BY_ID.get(l))), d.class + ': its first steps are its own quarter\'s');
    assert.ok(d.links.some((l) => BY_ID.get(l).street === d.street), d.class + ': its high street runs out from it');
    assert.ok(look.colours[d.class], d.class + ': its quarter has a colour for the screen');
  }
  assert.equal(look.streets.length, 12);
  assert.equal(look.walls.length, 8);
  // the quarters connect: every seam (an even street) links into both quarters it lies between, at more than one ring
  for (let s = 0; s < 12; s += 2) {
    const mid = look.first + look.step * s, side = (n) => Math.sign(((angle(n) - mid + 540) % 360) - 180);
    const before = new Set(), after = new Set();
    for (const n of NODES.filter((x) => x.street === s)) {
      for (const l of n.links) {
        const m = BY_ID.get(l);
        if (m.street === s) continue;
        if (side(m) < 0) before.add(n.ring); else if (side(m) > 0) after.add(n.ring);
      }
    }
    assert.ok(before.size >= 3 && after.size >= 3, look.streets[s] + ' joins the quarters on both its sides (rings ' + [...before] + ' / ' + [...after] + ')');
  }
});

test('the Plan: room for sixty levels of real choices from every door', () => {
  for (const d of NODES.filter((n) => n.kind === 'door')) {
    const depth = new Map([[d.id, 0]]), todo = [d.id];
    while (todo.length) {
      const id = todo.shift();
      for (const l of BY_ID.get(id).links) if (!depth.has(l)) { depth.set(l, depth.get(id) + 1); todo.push(l); }
    }
    const within = (k) => [...depth.values()].filter((v) => v <= k).length;
    assert.ok(within(60) > 400, d.class + ': ' + within(60) + ' nodes within 60 steps');
    assert.ok(within(10) >= 25, d.class + ': ' + within(10) + ' nodes within 10 steps');
  }
  // a whole life's route walked out by Char.allocate is a save SaveData accepts, and Char.sheet reads
  const { SaveData, Char, Tree } = game, save = SaveData.blank(), c = Char.create(save, 'change-ringer', 'Hester Pell');
  c.level = 60;
  let k = 0;
  while (Char.points(c).free > 0) {
    const fresh = Tree.steps(c.plan.walk).filter((id) => !c.plan.walk.includes(id));
    const next = fresh.length ? fresh[k++ % fresh.length] : Tree.steps(c.plan.walk)[0], n = BY_ID.get(next);
    assert.equal(Char.allocate(c, next, n.choice ? n.choice[k % n.choice.length] : undefined), true, 'a step onto ' + next);
  }
  assert.equal(c.plan.walk.length, 60, 'the door and 59 points');
  assert.deepEqual(plain(SaveData.validate(save)), [], 'the route is sound to SaveData');
  assert.ok(Char.sheet(c, save.account).stats['life-max'] > 0 && Tree.mods(c, Infinity, []).length >= 50);
});

// ---- Tree.mods and the plain reading of 14-character.js ----

test('Tree.mods gives what Char\'s plain reading gives where the rules agree: ring 1, no bank, no loop, no straight mile', () => {
  const withTree = loadSim();
  const plainOnly = loadSim({ only: modules.sim().filter((f) => f !== '13-tree.js') });
  assert.equal(typeof plainOnly.Tree.mods, 'undefined', 'the second world has no Tree.mods');
  const life = (sim, ids) => {
    const save = sim.SaveData.blank(), c = sim.Char.create(save, 'change-ringer', 'Hester Pell');
    c.level = 20;
    for (const id of ids) {
      const n = BY_ID.get(id);
      assert.equal(sim.Char.allocate(c, id, n.choice ? n.choice[0] : undefined), true, 'a step onto ' + id);
    }
    return plain(sim.Char.mods(c, null, save.account));
  };
  // out of the door along ring 1 and back once: a lane, a corner, a lane, the corner doubled, a street's lane
  const ring1 = ['plan.1.7.a1', 'plan.1.8', 'plan.1.8.a1', 'plan.1.8', 'plan.1.8.s'];
  for (const id of ring1) assert.ok(BY_ID.get(id).ring === 1 && BY_ID.get(id).bank === null && BY_ID.get(id).kind !== 'milestone', id);
  assert.deepEqual(life(withTree, ring1), life(plainOnly, ring1), 'the same modifiers, the doubled corner twice in both');
  // where the rules part: a corner of ring 2 is worth 115% to the Plan, its printed value to the plain reading
  const out = ['plan.1.7.s', 'plan.2.7'];
  assert.equal(BY_ID.get('plan.2.7').ring, 2);
  const a = life(withTree, out), b = life(plainOnly, out), m = BY_ID.get('plan.2.7').mods[0];
  const find = (list) => list.filter((x) => x.stat === m.stat && JSON.stringify(x.tags) === JSON.stringify(m.tags));
  assert.equal(round(find(a).pop().value), round(m.value * 1.15), 'ring 2: x 1.15');
  assert.equal(find(b).pop().value, m.value, 'plain: as printed');
});
