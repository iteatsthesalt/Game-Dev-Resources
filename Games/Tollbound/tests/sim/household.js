// tests/sim/household.js: a world of the Household's own for the tests of 14-character.js and 16-savedata.js.
//   const { world, line, ended } = require('./household.js');
//   const W = world();                 the kernel, 14-character.js and 16-savedata.js alone (FILES), with the content
//                                      below added and finalized: a class and its voices, a corner of the Plan, bases,
//                                      the Bellframe's numbers, two pits and a gift, observances and knots. Every id
//                                      begins with "test." but the plan and the bellframe, which are 'main'.
//   line(posture, stat, value, more)   a written line as 12-items.js writes one
//   ended(cfg, outcome, more)          a stand-in for a run that has ended: what Char.end and Char.checkpoint read
// Loading only these files keeps the tests on what Char and SaveData do themselves: the content and the systems of
// the packages of Stage 2 (Tree.mods, Items.mods, Bellframe.mods) are never in this world.
'use strict';
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');

const FILES = ['00-core.js', '01-defs.js', '02-pool-grid.js', '10-stats.js', '14-character.js', '16-savedata.js', '20-sim.js', '29-world.js', '30-modes-curves.js'];
const mod = (stat, op, value, more) => Object.assign({ stat, op, value }, more);

function content(Defs) {
  const voice = (id, tags, attr) => Defs.add('voice', {
    id, name: id, text: '', icon: null, attr: attr || 'hand', tier: 1, tags, weapon: null, archetype: 'ring', target: 'self', rate: 1,
    damage: { blow: [1, 2] }, weaponPct: 0, eff: 1, crit: 0, params: {}, mods: [], fx: {},
  });
  voice('test.toll', ['round']);
  voice('test.tell', ['held']);
  voice('test.weight', ['still', 'planted'], 'knee');
  const cls = (id, more) => Defs.add('class', Object.assign({
    id, name: 'Test Ringer', text: '', attrs: { hand: 10, knee: 5 }, perLevel: { hand: 2, knee: 1 }, base: [mod('life-max', 'flat', 10)],
    voices: ['test.toll', 'test.tell', 'test.weight'], startGear: ['test.rope', 'test.jerkin'], trade: { name: 'Set', text: '', icon: null, recharge: 8 },
    callings: ['test.one', 'test.two'], unlock: null, puppet: 'test.ringer', palette: ['#A7312C'],
  }, more));
  cls('test.ringer');
  cls('test.locked', { voices: ['test.toll'], startGear: [], unlock: 'test.opening' });
  Defs.add('bequest', { id: 'test.opening', name: 'Opening', text: '', hidden: false, scope: 'account', on: 'kill', count: 1, where: {}, reward: { class: 'test.locked' } });
  Defs.add('plan', { id: 'main', name: 'The Plan', rings: 8, streets: 12, ringGain: 15, bankGain: 60, mileGain: 25, mileFrom: 4, mileMost: 10, loopMost: 12, loopShare: 50, refund: 5 });
  // a door, a lane, a corner and a square round a block, and a milestone beyond: door - lane - corner - square - lane
  const node = (id, kind, ring, links, more) => Defs.add('node', Object.assign({ id, kind, ring, street: null, bank: null, x: ring, y: 0, name: id, mods: [], choice: null, links }, more));
  node('test.door', 'door', 1, ['test.lane'], { class: 'test.ringer', street: 0 });
  node('test.lane', 'lane', 1, ['test.door', 'test.corner', 'test.square'], { choice: ['hand', 'knee'] });
  node('test.corner', 'corner', 2, ['test.lane', 'test.square'], { mods: [mod('damage', 'inc', 10, { tags: ['round'] })] });
  node('test.square', 'square', 2, ['test.corner', 'test.lane', 'test.mile'], { mods: [mod('damage', 'more', 20), mod('taken', 'inc', 10)] });
  node('test.mile', 'milestone', 3, ['test.square'], { street: 1, mods: [mod('move-speed', 'inc', 4)] });
  const base = (id, slot, family, fixed) => Defs.add('base', { id, name: id, slot, family, level: 1, fixed, tables: {}, icon: null, unlock: null, weight: 1 });
  base('test.rope', 'tool', 'rope', { stat: 'pull-window', op: 'flat', min: 0.05, max: 0.05 });
  base('test.jerkin', 'coat', null, { stat: 'guard.blow', op: 'flat', min: 1, max: 3 });
  base('test.token', 'token', null, { stat: 'heed-max', op: 'flat', min: 4, max: 6 });
  Defs.add('bellframe', { id: 'main', pitFirst: 100, pitGrowth: 1.5, placeFirst: 100, placeGrowth: 1.5, placesMost: 8, trueLow: 10, trueHigh: 30, trueGain: 5,
    weighPer: 8, recast: 60, deathHum: 40 });
  Defs.add('pit', { id: 'test.tenor', name: 'Tenor', text: '', icon: null, from: null, grant: [mod('life-max', 'flat', 4)], x: 0, y: 0 });
  Defs.add('pit', { id: 'test.treble', name: 'Treble', text: '', icon: null, from: 'test.tenor', grant: [mod('move-speed', 'inc', 2)], x: 1, y: 0 });
  // a gift whose number is the bell's level: 1 at level 1, 20 at level 20
  Defs.add('gift', { id: 'test.gift', name: 'Gift', text: '', icon: null, class: 'test.ringer', calling: null, mods: [mod('heed-max', 'flat', { a: 1, b: 20, curve: 'lin' })] });
  const obs = (id, heed, mods) => Defs.add('observance', { id, name: id, text: '', icon: null, attr: 'knee', tier: 1, heed, mods, aura: null });
  obs('test.stability', 30, [mod('damage', 'inc', 25)]);
  obs('test.alms', 25, [mod('xp-gain', 'inc', 5)]);
  obs('test.mourning', 40, [mod('find-chance', 'inc', 10)]);
  const knot = (id, requires) => Defs.add('knot', { id, name: id, text: '', icon: null, attr: 'hand', tier: 1, requires, excludes: [], addTags: [], mods: [mod('damage', 'more', 10)], params: {}, trigger: null });
  knot('test.slip', ['round']);
  knot('test.lead', ['still']);
  Defs.add('cause', { id: 'test.drowned', name: 'Drowned' });
}

function world() {
  const sim = loadSim({ only: FILES });
  content(sim.Defs);
  assert.deepEqual(plain(sim.Defs.finalize()), [], 'the test world\'s content is valid');
  return sim;
}

const CONDS = { stood: 'braced', strode: 'striding', pressed: 'crowded', timed: 'after-quarter' };
const line = (posture, stat, value, more) => Object.assign({ stat, op: 'inc', value, tags: [], cond: CONDS[posture], posture, toll: 3,
  backward: false, struck: null, band: [value / 2, value] }, more);

function ended(cfg, outcome, more) {
  const m = more || {};
  return {
    cfg, toll: m.tolls || 0, hum: m.hum || 0, coin: m.coin || 0, haul: m.haul || [], bank: { coin: m.banked || 0, finds: m.finds || [] },
    cause: m.cause || null, sheet: { stats: { 'hum-gain': m.gain || 100 } },
    result: outcome === null ? null : { outcome, zone: cfg.zone, tolls: m.tolls || 0 },
  };
}

module.exports = { world, line, ended, mod, FILES };
