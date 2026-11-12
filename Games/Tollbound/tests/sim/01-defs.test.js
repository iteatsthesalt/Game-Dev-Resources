// tests/sim/01-defs.test.js: the registries of definitions, their shapes and the check at boot (src/js/01-defs.js).
// sample() below is one valid definition of every kind, written the way docs/engine.md gives the shapes. The
// tests break it in one place at a time and expect finalize to name the kind, the id and the field.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');

const KINDS = ['voice', 'knot', 'observance', 'treeSkeleton', 'cluster', 'legacyNode', 'class', 'calling', 'attack', 'enemy', 'boss', 'zone',
  'puppet', 'prop', 'tileset', 'base', 'affix', 'unique', 'currency', 'favour', 'bequest', 'mode', 'curves', 'constants', 'trait', 'cause'];
const mod = (stat, op, value, more) => Object.assign({ stat, op, value }, more);

// Runs only the files named, in a context of their own: registries with nothing in them, whatever content the
// game ships. Most tests here use kernel(), so they keep passing as content arrives and never meet its ids.
const bare = (files) => loadSim({ only: files });
const kernel = () => bare(['00-core.js', '01-defs.js', '10-stats.js']);

function sample() {
  const attack = (id, more) => Object.assign({
    id, kind: 'strike', type: 'blow', mult: 1, cooldown: 1, range: 0.6, windup: 0.4, shape: 'arc', radius: 1.2, angle: 1.6, count: 1,
    spread: 0, speed: 0, evadable: false, ailment: null, summon: null, fx: null,
  }, more);
  const enemy = (id, more) => Object.assign({
    id, name: 'Wake-walker', puppet: 'debug.husk', radius: 0.4, life: 12, damage: 3, speed: 2.4, xp: 1, cost: 1, loot: 'common', ai: 'wake',
    aiParams: { lag: 1.2 }, attacks: ['shoulder', attack('pall', { kind: 'fall', type: 'swell', shape: 'circle', range: 9, radius: 2, windup: 1.5, ailment: 'coined' })],
    guard: { blow: 40, drag: 70 }, size: 'small', press: 0.5, tags: ['dead'],
  }, more);
  const calling = (id) => ({
    id, class: 'change-ringer', name: 'Stander', text: 'Leans on the stay.', points: 8,
    nodes: [
      { key: 'a', kind: 'minor', name: 'Stay', mods: [mod('set-time', 'flat', -0.1)], requires: [], row: 0, col: 0 },
      { key: 'b', kind: 'major', name: 'Weight', text: 'It leans.', icon: 'stay', mods: [mod('taken', 'more', -8, { cond: 'braced' })], requires: ['a'], row: 1, col: 0 },
    ],
  });
  return [
    ['puppet', {
      id: 'debug.husk', rig: 'biped', scale: 1,
      parts: [
        { key: 'torso', shape: 'taper', size: [0.5, 0.7, 0.3], at: [0, 0.9, 0], color: 'cloth' },
        { key: 'head', shape: 'sphere', size: [0.3, 0.3, 0.3], at: [0, 0.55, 0], parent: 'torso', joint: 'neck', color: 'bone', emissive: 0.2 },
      ],
      palette: { cloth: '#3a3f4b', bone: '#D9D2C0' }, anim: { stride: 0.6, swing: 0.5, bob: 0.04 },
    }],
    ['tileset', { id: 'slabs', name: 'Slabs', colours: ['#E4DFD1'] }],
    ['prop', { id: 'bell-post', puppet: 'debug.husk', radius: 0.8, light: { radius: 6, color: '#ffcc88' }, breakable: { loot: null }, role: 'bell-post' }],
    ['prop', { id: 'stone', puppet: 'debug.husk', radius: 0.6 }],
    ['voice', {
      id: 'tenor-stroke', name: 'Tenor Stroke', text: 'A Blow ring {0} m round you.', icon: 'bell', attr: 'hand', tier: 1, tags: ['round'], weapon: null,
      archetype: 'ring', target: 'self', rate: { a: 0.33, b: 0.5, curve: 'lin' },
      damage: { blow: [{ a: 4, b: 40, curve: 'exp' }, { a: 8, b: 80, curve: 'exp' }] }, weaponPct: 0, eff: 1, crit: 0,
      params: { radius: 2.5, count: { a: 1, b: 3, curve: 'lin' } }, mods: [mod('chance.coined', 'flat', 10)],
      fx: { puppet: null, cast: 'ring', hit: 'burst', sfxCast: 'stroke', sfxHit: 'knock', light: { radius: 3, color: '#ffcc88' } },
    }],
    ['knot', {
      id: 'slip-knot', name: 'Slip-knot', text: 'Two more.', icon: null, attr: 'heel', tier: 1, requires: ['round'], excludes: ['thrown'], addTags: ['line'],
      mods: [mod('throws', 'flat', 2), mod('damage', 'more', -25), mod('added.blow', 'flat', [{ a: 1, b: 9, curve: 'lin' }, 12])],
      params: { spread: 0.3 }, trigger: { on: 'pull', chance: 25, cooldown: 0.5 },
    }],
    ['observance', {
      id: 'stability', name: 'Stability', text: 'Stay within 12 m of where you stood at the last toll.', icon: 'ring', attr: 'knee', tier: 2, heed: 30,
      mods: [mod('damage', 'inc', 25), mod('mend-rate', 'inc', 1, { per: { stat: 'level', div: 5, cap: 10 } })], aura: null,
    }],
    ['treeSkeleton', { id: 'rose', spokes: 6, rings: [{ r: 4, slots: 6 }, { r: 8, slots: 12 }], pathMods: [mod('life-max', 'flat', 5)], starts: { 'change-ringer': { sector: 0 } } }],
    ['cluster', {
      id: 'stones', name: 'Stones', anchor: { sector: 1, ring: 1, slot: 3 }, shape: 'line3', theme: ['blow'], entry: 'a',
      nodes: [
        { key: 'a', kind: 'minor', name: 'Kerb', mods: [mod('damage', 'inc', 8, { tags: ['blow'] })] },
        { key: 'b', kind: 'major', name: 'Toll Road', text: 'Coins last longer.', icon: 'coin', mods: [mod('cond-duration', 'inc', 20, { tags: ['coined'] })] },
        { key: 'c', kind: 'capstone', name: 'Close', mods: [mod('flag.close', 'set', 1), mod('through.blow', 'flat', 15)] },
      ],
    }],
    ['legacyNode', {
      id: 'tenor-pit', name: 'The Tenor Pit', text: 'A little more life.', icon: 'bell', branch: 'frame', row: 0, col: 0, requires: [], ranks: 3,
      cost: [100, 150, 225], mods: [mod('life-max', 'flat', 4)], unlock: { class: 'change-ringer' },
    }],
    ['class', {
      id: 'change-ringer', name: 'Change-ringer', text: 'Rocks in the crowd.', attrs: { hand: 10, knee: 5 }, perLevel: { hand: 2, knee: 1 },
      base: [mod('life-max', 'flat', 10)], door: 0, voices: ['tenor-stroke'], startGear: ['bell-rope'],
      trade: { name: 'Set', text: 'Sets the bell at once, wherever you are.', icon: 'bell', recharge: 8 },
      callings: ['stander', 'backward-ringer'], unlock: null, puppet: 'debug.husk', palette: ['#334455', '#aabbcc'],
    }],
    ['calling', calling('stander')],
    ['calling', calling('backward-ringer')],
    ['attack', attack('shoulder')],
    ['enemy', enemy('wake-walker')],
    ['boss', enemy('half-muffled-keeper', {
      name: 'The Half-muffled Keeper', ai: 'chase', size: 'large', guard: { blow: 60 },
      attacks: [attack('stroke', { kind: 'spread', type: 'swell', shape: 'ring', radius: 5, windup: 1.2 }), 'shoulder'],
      arena: { radius: 18 },
      phases: [
        { until: 0.6, speed: 1, onEnter: ['stroke'], loop: ['shoulder', { wait: 1.5 }, 'stroke'] },
        { until: 0, speed: 1.3, onEnter: [], loop: ['stroke'] },
      ],
    })],
    ['trait', { id: 'swift', name: 'Swift', text: 'Moves faster.', mods: [mod('move-speed', 'inc', 30)], glow: '#88ccff' }],
    ['zone', {
      id: 'dial', name: 'The Dial', kind: 'district', level: 3, tollSeconds: 75, keeperToll: 8, gateEvery: 3, region: { radius: 35 },
      start: { x: 0, y: 6 }, tileset: 'slabs',
      place: [{ prop: 'bell-post', x: 0, y: 0 }, { prop: 'stone', x: 14, y: 0, role: 'landmark' }], props: [{ prop: 'stone', density: 0.1 }],
      ambient: { light: [0.4, 0.45, 0.6], fog: 0.02, sun: null, tint: '#223344' },
      music: 'dirge', timeline: [{ toll: 0, rate: 1.5, cap: 60, pool: [{ enemy: 'wake-walker', w: 3 }] }],
      overtoll: { rateMul: 1.2, levelPer: 1, rewardPer: 0.1 },
      events: [
        { toll: 2, kind: 'elite', enemy: 'wake-walker', traits: ['swift'] },
        { toll: 3, kind: 'swarm', enemy: 'wake-walker', shape: 'ring', count: 30 },
      ],
      boss: 'half-muffled-keeper', rules: { tollSeconds: 60 }, unlock: null, next: 'dial',
    }],
    ['base', {
      id: 'bell-rope', name: 'Bell-rope', slot: 'tool', family: 'rope', tags: ['tool', 'rope'], level: 1, req: { level: 1, hand: 8 },
      twoHanded: false, weapon: null, defence: null, implicit: [{ stat: 'pull-window', op: 'flat', min: 0.05, max: 0.05 }], icon: 'rope',
    }],
    ['base', {
      id: 'jerkin', name: 'Jerkin', slot: 'coat', family: null, tags: ['coat'], level: 4, req: { knee: 12 }, twoHanded: false, weapon: null,
      defence: { weight: 3 }, implicit: [{ stat: 'guard.blow', op: 'flat', min: 1, max: 2, local: true }], icon: null,
    }],
    ['affix', {
      id: 'of-the-rope', name: 'of the Rope', type: 'suffix', group: 'addedBlow', weights: { tool: 100, token: 20 },
      tiers: [
        { ilvl: 1, mods: [{ stat: 'added.blow', op: 'flat', min: [1, 2], max: [3, 5] }] },
        { ilvl: 20, mods: [{ stat: 'added.blow', op: 'flat', min: [4, 7], max: [9, 14], tags: ['round'] }] },
      ],
    }],
    ['unique', {
      id: 'great-hour', name: 'Great Hour', base: 'bell-rope', level: 10, mods: [{ stat: 'damage', op: 'more', min: 10, max: 20, cond: 'braced' }],
      flavour: 'It remembers every bell.', weight: 5, unlock: null,
    }],
    ['currency', { id: 'wax', name: 'Wax', text: 'Adds a line.', icon: 'drop', target: 'item', op: 'addMod', requires: { rarity: 'magic' }, args: {}, weight: 30, level: 1 }],
    ['favour', {
      id: 'funeral-biscuit', name: 'Funeral Biscuit', text: '+{0}% speed for voices that circle you', icon: 'biscuit', rarity: 'plain', weight: 10,
      maxStacks: 5, group: 'speed', scope: 'voices', requires: { tags: ['round'], class: 'change-ringer', runLevel: 2 },
      mods: [mod('speed', 'inc', 8, { tags: ['round'] })], params: { count: 1 },
    }],
    ['favour', {
      id: 'countermarch', name: 'Countermarch', text: 'Pass through the common dead after a sharp reversal.', icon: 'turn', rarity: 'turned',
      weight: 4, maxStacks: 1, scope: 'global', requires: {}, mods: [mod('flag.countermarch', 'flat', 1)],
    }],
    ['bequest', {
      id: 'first-toll', name: 'First Toll', text: 'Hear a bell.', hidden: false, scope: 'account', on: 'toll', count: 1, where: { zone: 'dial' },
      reward: { class: 'change-ringer', zone: 'dial', unique: 'great-hour', planPoints: 1, coin: 50, hum: 5, currency: { wax: 2 } },
    }],
    ['mode', {
      id: 'trial', name: 'Trial', persistent: false, route: 'night', zones: ['dial'], xpCurve: 'charXp', levelCap: 20, runLevels: 10,
      levelOffer: 'node', runLevelOffer: 'favour', eliteOffer: 'reward', bossOffer: 'reward', haul: 'none',
      calling: { afterKeeper: 1, pointsPerPeal: 2 }, respec: 'none', death: 'permanent', score: { kill: 1 },
    }],
    ['curves', { id: 'main', levels: 5, enemyLife: [1, 2, 3, 4, 5], charXp: [10, 20, 30, 40, 50] }],
    ['constants', { id: 'main', anything: 1, nested: { fine: true } }],
    ['cause', { id: 'drowned', name: 'Drowned', text: 'All water stands a band deeper.', mods: [mod('move-speed', 'more', -10)] }],
  ];
}

// Takes empty registries, adds the sample (after change(pick, defs, sim) had its way with it), and returns what
// finalize says. pick(kind, id?) is the first sample definition of a kind, or the one with that id.
function problems(change) {
  const sim = kernel(), defs = sample();
  const pick = (kind, id) => defs.find(([k, d]) => k === kind && (id === undefined || d.id === id))[1];
  if (change) change(pick, defs, sim);
  for (const [kind, def] of defs) sim.Defs.add(kind, def);
  return Array.from(sim.Defs.finalize());
}
const expectOne = (change, pattern) => {
  const found = problems(change);
  assert.equal(found.length, 1, `exactly one problem expected, got ${JSON.stringify(found)}`);
  assert.match(found[0], pattern);
};

// ---- the registries ----

test('the kinds are the ones the engine notes list, in the design\'s words', () => {
  const { Defs } = kernel();
  assert.deepEqual(plain(Defs.KINDS), KINDS);
  assert.deepEqual(Object.keys(Defs.SCHEMA), KINDS);
  for (const kind of KINDS) assert.deepEqual(plain(Defs.all(kind)), [], `Defs.all('${kind}') works with no entries`);
  for (const gone of ['sigil', 'binding', 'vow', 'chime', 'deed', 'chartMod']) assert.throws(() => Defs.all(gone), /is not a kind of definition/, gone);
});

test('add, get, has and all', () => {
  const { Defs } = kernel();
  const a = { id: 'ash' }, b = { id: 'brine' };
  assert.equal(Defs.add('trait', a), a, 'add returns the definition');
  Defs.add('trait', b);
  Defs.add('cause', { id: 'ash' });
  assert.equal(Defs.get('trait', 'ash'), a);
  assert.equal(Defs.has('trait', 'brine'), true);
  assert.equal(Defs.has('trait', 'cinder'), false);
  assert.equal(Defs.has('cause', 'brine'), false, 'each kind has its own ids');
  assert.deepEqual(Array.from(Defs.all('trait')), [a, b], 'in the order they were added');
  assert.equal(Defs.all('trait'), Defs.all('trait'), 'all gives the registry itself, not a copy each time');
  assert.throws(() => Defs.get('trait', 'cinder'), /Defs\.get: there is no trait "cinder"/);
  assert.throws(() => Defs.get('voice', 'ash'), /there is no voice "ash"/);
});

test('add refuses what it can see at a glance', () => {
  const { Defs } = kernel();
  Defs.add('trait', { id: 'ash' });
  assert.throws(() => Defs.add('trait', { id: 'ash' }), /two trait definitions with the id "ash"/);
  assert.throws(() => Defs.add('spell', { id: 'x' }), /"spell" is not a kind of definition/);
  assert.throws(() => Defs.add('constructor', { id: 'x' }), /not a kind of definition/);
  assert.throws(() => Defs.add('trait', { name: 'nameless' }), /a trait needs a string id/);
  assert.throws(() => Defs.add('trait', { id: 7 }), /needs a string id/);
  assert.throws(() => Defs.add('trait', { id: '' }), /needs a string id/);
  assert.throws(() => Defs.add('trait', null), /needs a string id/);
  for (const fn of ['get', 'has', 'all']) assert.throws(() => Defs[fn]('spell', 'x'), /"spell" is not a kind of definition/);
  assert.equal(Defs.all('trait').length, 1, 'a refused definition is not registered');
});

// ---- what ships, and the sample ----

test('every definition the game ships is valid', () => {
  // all content of src/js, whoever wrote it: a fault in any file of 30 to 49 shows here, by kind, id and field
  const { Defs } = loadSim();
  assert.deepEqual(plain(Defs.finalize()), []);
  assert.ok(Defs.has('mode', 'household') && Defs.has('mode', 'watch-night') && Defs.has('zone', 'debug') && Defs.has('enemy', 'debug.husk'));
  assert.equal(Defs.get('enemy', 'debug.husk').puppet, 'debug.husk');
});

test('the curves, the constants, the modes and the debug zone that ship', () => {
  const { Defs } = loadSim({ boot: true });
  const curves = Defs.get('curves', 'main');
  assert.equal(curves.levels, 70);
  for (const name of ['enemyLife', 'enemyDamage', 'enemyXp', 'charXp', 'nightXp', 'runXp']) {
    assert.equal(curves[name].length, 70, `${name} has a number for each level`);
    assert.ok(curves[name].every((v) => Number.isFinite(v) && v > 0), name);
    for (let i = 1; i < 70; i++) assert.ok(curves[name][i] > curves[name][i - 1], `${name} rises from level ${i} to ${i + 1}`);
  }
  assert.equal(curves.accuracy, undefined, 'nothing is evaded, so nothing needs an accuracy');
  assert.deepEqual([curves.enemyLife[0], curves.enemyDamage[0], curves.enemyXp[0]], [1, 1, 1], 'at level 1 an enemy has its def\'s own numbers');
  assert.deepEqual(plain(curves.rank[0]), { life: 1, damage: 1, xp: 1, size: 1 });
  assert.deepEqual(plain(curves.rank[3]), { life: 1, damage: 1, xp: 1, size: 1 }, 'a keeper\'s def carries its own numbers');
  assert.equal(curves.rank.length, 4);
  assert.ok(curves.rank[1].life > 1 && curves.rank[2].life > curves.rank[1].life);
  // a lychgate opens for 25 s, every third toll; ringing down is six strokes a second apart; a silenced voice comes
  // back every 2 s (docs/design/01-world.md)
  assert.deepEqual(plain(Defs.get('constants', 'main')), {
    id: 'main', spawnRadius: 26, despawnRadius: 34, tollSeconds: 75, keeperToll: 8, gateEvery: 3, gateOpenSeconds: 25, gateRadius: 1.7, ringStrokes: 6, strokeSeconds: 1,
    backSeconds: 2, caps: { enemies: 600, shots: 500, areas: 120, pickups: 400, minions: 40, events: 2048 }, gridCell: 2, playerRadius: 0.4,
  });
  const household = Defs.get('mode', 'household'), night = Defs.get('mode', 'watch-night');
  assert.deepEqual([household.name, household.persistent, household.route, household.runLevelOffer, household.levelOffer, household.haul, household.respec, household.death],
    ['The Household', true, 'zone', 'favour', 'none', 'gate', 'coin', 'permanent']);
  assert.deepEqual(plain(household.calling), { afterKeeper: 2, pointsPerPeal: 2 }, 'the calling comes once the Ropewalk\'s keeper is laid');
  assert.deepEqual([night.name, night.persistent, night.route, night.runLevelOffer, night.levelOffer, night.haul, night.respec, night.death],
    ['The Watch-night', false, 'night', 'favour', 'node', 'gate', 'none', 'permanent']);
  assert.deepEqual(plain(night.calling), { afterKeeper: 1, pointsPerPeal: 2 }, 'courted in the second district');
  for (const mode of [household, night]) {
    assert.equal(mode.levelCap, 70, `${mode.id}: character levels run from 1 to 70`);
    assert.ok(Array.isArray(curves[mode.xpCurve]) && mode.levelCap <= curves[mode.xpCurve].length, `${mode.id}: its xp curve reaches its level cap`);
  }
  const zone = Defs.get('zone', 'debug'), husk = Defs.get('enemy', 'debug.husk');
  assert.deepEqual([zone.kind, zone.boss, zone.props.length, zone.timeline.length, zone.events.length], ['debug', null, 0, 0, 0]);
  assert.ok(zone.region.radius > Defs.get('constants', 'main').despawnRadius, 'the ground is wider than the ring enemies despawn at');
  assert.deepEqual([husk.puppet, husk.attacks.length, husk.radius > 0, husk.life > 0, husk.size, husk.press], ['debug.husk', 0, true, true, 'small', 0]);
  assert.deepEqual(plain(husk.guard), {}, 'its guards are those of the kinds of harm');
});

test('registries with no definitions at all finalize, and so do definitions without the stat tables', () => {
  const empty = kernel();
  for (const kind of KINDS) assert.equal(empty.Defs.all(kind).length, 0);
  assert.deepEqual(plain(empty.Defs.finalize()), []);
  assert.deepEqual(plain(empty.Defs.finalize()), [], 'and a second finalize says the same');
  const alone = bare(['00-core.js', '01-defs.js']);
  alone.Defs.add('trait', { id: 'swift', name: 'Swift', mods: [{ stat: 'anything', op: 'inc', value: 5, tags: ['unknown'] }] });
  alone.Defs.add('trait', { id: 'slow', name: 'Slow', mods: [{ stat: 'anything', op: 'times', value: 5 }] });
  assert.deepEqual(plain(alone.Defs.finalize()), ['trait slow: mods[0].op "times" is not one of flat, inc, more, set'],
    'without the tables, stats and tags go unchecked; the rest is checked as ever');
});

test('one valid definition of every kind passes', () => {
  const defs = sample();
  assert.deepEqual(KINDS.filter((kind) => !defs.some(([k]) => k === kind)), [], 'the sample covers every kind');
  assert.deepEqual(problems(), []);
});

test('finalize freezes every definition all the way down, and closes the registries', () => {
  const sim = kernel(), defs = sample();
  for (const [kind, def] of defs) sim.Defs.add(kind, def);
  const tenor = sim.Defs.get('voice', 'tenor-stroke');
  tenor.tier = 2;                                      // still open before finalize
  assert.deepEqual(plain(sim.Defs.finalize()), []);
  assert.ok(Object.isFrozen(tenor) && Object.isFrozen(tenor.tags) && Object.isFrozen(tenor.damage.blow[0]) && Object.isFrozen(tenor.mods[0]));
  assert.throws(() => { tenor.tier = 3; }, TypeError);
  assert.throws(() => { tenor.mods.push({}); }, TypeError);
  assert.throws(() => { tenor.fx.light.radius = 9; }, TypeError);
  assert.ok(Object.isFrozen(sim.Defs.all('voice')));
  assert.ok(Object.isFrozen(sim.Defs.SCHEMA.voice.fields.tier) && Object.isFrozen(sim.Defs.ENUMS.ai) && Object.isFrozen(sim.Defs.SHAPES.Mod.fields));
  assert.throws(() => sim.Defs.add('trait', { id: 'late' }), /the definitions were finalized/);
  assert.throws(() => sim.Defs.allow('ai', 'late'), /finalized/);
  assert.throws(() => sim.Defs.extend('trait', { late: { type: 'number' } }), /finalized/);
  assert.equal(sim.Defs.get('voice', 'tenor-stroke'), tenor, 'reading goes on as before');
});

test('definitions with faults are frozen too, and every fault is told', () => {
  const sim = kernel();
  const bad = sim.Defs.add('trait', { id: 'Bad Id', mods: 'none' });
  const errors = Array.from(sim.Defs.finalize());
  assert.equal(errors.length, 3);
  assert.ok(errors.every((e) => e.startsWith('trait Bad Id: ')), 'each names the kind and the id');
  assert.ok(Object.isFrozen(bad));
});

// ---- the schema as data ----

test('the schema is plain data that names only kinds, shapes and word lists that exist', () => {
  const { Defs } = kernel();
  assert.deepEqual(JSON.parse(JSON.stringify(Defs.SCHEMA)), plain(Defs.SCHEMA), 'it survives JSON');
  const types = new Set(['string', 'number', 'int', 'bool', 'any', 'id', 'hex', 'scaled', 'array', 'map', 'object', 'shape', 'union', 'stat', 'tag',
    'cond', 'harm', 'family', 'primary', 'counted', 'ailment']);
  let seen = 0, pinnedSeen = 0;
  const walk = (spec, where) => {
    seen++;
    assert.ok(types.has(spec.type), `${where}: type ${spec.type}`);
    assert.equal(typeof spec.required, 'boolean', `${where}: says whether it is required`);
    if (spec.ref !== undefined) assert.ok(KINDS.includes(spec.ref), `${where}: ref ${spec.ref}`);
    if (spec.enum !== undefined) assert.ok(Array.isArray(spec.enum) && spec.enum.length > 0 && spec.enum.every((w) => typeof w === 'string'), `${where}: enum`);
    if ('only' in spec) { pinnedSeen++; assert.ok(spec.only === null || ['number', 'boolean', 'string'].includes(typeof spec.only), `${where}: only`); }
    if (spec.type === 'shape') assert.ok(Defs.SHAPES[spec.shape], `${where}: shape ${spec.shape}`);
    if (spec.type === 'array' || spec.type === 'map') walk(spec.of, where + '[]');
    if (spec.type === 'map' && spec.keys) walk(spec.keys, where + '{key}');
    if (spec.type === 'union') spec.of.forEach((s, i) => walk(s, `${where}|${i}`));
    if (spec.type === 'object') for (const [name, s] of Object.entries(spec.fields)) walk(s, `${where}.${name}`);
  };
  for (const kind of KINDS) {
    const schema = Defs.SCHEMA[kind];
    assert.equal(typeof schema.open, 'boolean');
    assert.deepEqual(plain(schema.fields.id), { type: 'id', required: true }, `${kind} has an id`);
    for (const [name, spec] of Object.entries(schema.fields)) walk(spec, `${kind}.${name}`);
  }
  for (const [name, shape] of Object.entries(Defs.SHAPES)) for (const [field, spec] of Object.entries(shape.fields)) walk(spec, `${name}.${field}`);
  assert.ok(seen > 400, 'the walk saw the whole schema');
  assert.ok(pinnedSeen >= 6, 'the fields the design keeps at one value are pinned');
  assert.deepEqual(Object.keys(Defs.SHAPES), ['Mod', 'ModRange', 'Trigger', 'Attack']);
  assert.deepEqual(Object.keys(Defs.SHAPES.Mod.fields), ['stat', 'op', 'value', 'tags', 'cond', 'per', 'local'], 'no "from": nothing is gained as another kind');
  assert.deepEqual(plain(Defs.SCHEMA.enemy.fields.puppet), { type: 'string', required: true, ref: 'puppet' });
  assert.deepEqual(plain(Defs.SCHEMA.voice.fields.tier), { type: 'int', required: true, min: 1, max: 5 });
  // design 15.9: a voice's crit is 0, its weapon null and its weaponPct 0; an attack is never evadable; an observance has no aura
  assert.deepEqual(plain([Defs.SCHEMA.voice.fields.crit, Defs.SCHEMA.voice.fields.weapon, Defs.SCHEMA.voice.fields.weaponPct]),
    [{ type: 'any', required: true, only: 0 }, { type: 'any', required: true, only: null }, { type: 'any', required: true, only: 0 }]);
  assert.deepEqual(plain(Defs.SCHEMA.attack.fields.evadable), { type: 'any', required: true, only: false });
  assert.equal(Defs.SHAPES.Attack.fields.evadable, Defs.SCHEMA.attack.fields.evadable, 'an attack inside an enemy is an attack');
  assert.deepEqual(plain(Defs.SCHEMA.observance.fields.aura), { type: 'any', required: true, only: null });
  assert.deepEqual(plain(Defs.SCHEMA.base.fields.weapon), { type: 'any', required: true, only: null }, 'no base is a weapon (design 15.2)');
  assert.deepEqual(plain(Defs.SCHEMA.observance.fields.heed), { type: 'number', required: true, min: 20, max: 40 });
  assert.deepEqual(plain(Defs.SCHEMA.enemy.fields.ai.enum), ['wake', 'chase']);
  assert.equal(Defs.SCHEMA.enemy.fields.ai.enum, Defs.ENUMS.ai, 'a word list is one array, wherever it is used');
  assert.deepEqual(plain(Defs.ENUMS.archetype), ['ring', 'rap', 'bar', 'spark', 'cone'], 'what the first version needs');
  assert.deepEqual(plain(Defs.ENUMS.attackKind), ['strike', 'throw', 'press', 'spread', 'fall', 'zone']);
  assert.deepEqual(plain(Defs.ENUMS.attackShape), ['arc', 'line', 'circle', 'ring', 'wedge']);
  assert.deepEqual(plain(Defs.ENUMS.size), ['small', 'large']);
  assert.deepEqual(plain(Defs.ENUMS.zoneKind), ['district', 'peal', 'bill', 'debug']);
  assert.deepEqual(plain(Defs.ENUMS.favourRarity), ['plain', 'turned']);
  assert.deepEqual(plain(Defs.ENUMS.slot), ['tool', 'hat', 'coat', 'hands', 'girdle', 'pattens', 'token']);
  assert.ok(['wound', 'mend', 'scar', 'pull', 'heave', 'count'].every((k) => Defs.ENUMS.event.includes(k)) && !Defs.ENUMS.event.includes('crit'),
    'the events of design 15.9 arrive, and crit goes');
  assert.deepEqual(plain(Defs.SCHEMA.enemy.fields.guard), { type: 'map', required: true, of: { type: 'number', required: true, min: 0, max: 100 }, keys: { type: 'harm', required: true } });
  assert.deepEqual(Object.keys(Defs.SCHEMA.boss.fields).filter((f) => !(f in Defs.SCHEMA.enemy.fields)), ['arena', 'phases'], 'a boss is an enemy and more');
  assert.equal(Defs.SHAPES.Mod.fields.tags.required, false);
});

// ---- faults, one at a time ----

test('a missing field, a wrong type, a word off the list, a field that is not in the shape', () => {
  expectOne((pick) => { delete pick('voice').rate; }, /^voice tenor-stroke: rate is missing$/);
  expectOne((pick) => { pick('voice').tier = 'one'; }, /^voice tenor-stroke: tier must be a number, not "one"$/);
  expectOne((pick) => { pick('voice').tier = 1.5; }, /^voice tenor-stroke: tier must be a whole number, not 1\.5$/);
  expectOne((pick) => { pick('voice').tier = 6; }, /^voice tenor-stroke: tier must be at most 5, not 6$/);
  expectOne((pick) => { pick('voice').eff = -1; }, /^voice tenor-stroke: eff must be at least 0, not -1$/);
  expectOne((pick) => { pick('voice').name = 5; }, /^voice tenor-stroke: name must be text, not 5$/);
  expectOne((pick) => { pick('voice').target = 'weakest'; }, /^voice tenor-stroke: target "weakest" is not one of nearest, densest, random, farthest, aim, self$/);
  expectOne((pick) => { pick('voice').archetype = 'projectile'; }, /^voice tenor-stroke: archetype "projectile" is not one of ring, rap, bar, spark, cone$/);
  expectOne((pick) => { pick('voice').cooldown = 2; }, /^voice tenor-stroke: cooldown is not a field of this shape$/);
  expectOne((pick) => { pick('voice').constructor = 2; }, /^voice tenor-stroke: constructor is not a field of this shape$/);
  expectOne((pick) => { pick('puppet').parts[0].color = 'toString'; }, /^puppet debug\.husk: parts\[0\]\.color "toString" is not in its palette$/);
  expectOne((pick) => { pick('voice').tags = null; }, /^voice tenor-stroke: tags is null$/);
  expectOne((pick) => { pick('enemy').aiParams = [1]; }, /^enemy wake-walker: aiParams must be an object, not \[1\]$/);
  expectOne((pick) => { pick('enemy').size = 'huge'; }, /^enemy wake-walker: size "huge" is not one of small, large$/);
  expectOne((pick) => { pick('enemy').press = -1; }, /^enemy wake-walker: press must be at least 0, not -1$/);
  expectOne((pick) => { pick('enemy').guard.blow = 120; }, /^enemy wake-walker: guard\.blow must be at most 100, not 120$/);
  expectOne((pick) => { pick('enemy').armour = 4; }, /^enemy wake-walker: armour is not a field of this shape$/);
  expectOne((pick) => { pick('attack').kind = 'contact'; }, /^attack shoulder: kind "contact" is not one of strike, throw, press, spread, fall, zone$/);
  expectOne((pick) => { pick('attack').shape = 'cone'; }, /^attack shoulder: shape "cone" is not one of arc, line, circle, ring, wedge$/);
  expectOne((pick) => { pick('base').twoHanded = 0; }, /^base bell-rope: twoHanded must be true or false, not 0$/);
  expectOne((pick) => { pick('base').slot = 'weapon'; }, /^base bell-rope: slot "weapon" is not one of tool, hat, coat, hands, girdle, pattens, token$/);
  expectOne((pick) => { pick('puppet').parts[0].size = [1, 2]; }, /^puppet debug\.husk: parts\[0\]\.size must hold 3 entries, not 2$/);
  expectOne((pick) => { pick('class').palette[1] = 'blue'; }, /^class change-ringer: palette\[1\] "blue" must be a colour written as #rrggbb$/);
  expectOne((pick) => { pick('class').trade.recharge = -8; }, /^class change-ringer: trade\.recharge must be at least 0, not -8$/);
  expectOne((pick) => { delete pick('class').trade; }, /^class change-ringer: trade is missing$/);
  expectOne((pick) => { pick('class').door = 6; }, /^class change-ringer: door must be at most 5, not 6$/);
  expectOne((pick) => { pick('zone').region.radius = 3; }, /^zone dial: region\.radius must be at least 10, not 3$/);
  expectOne((pick) => { pick('zone').ambient.light = [1, 1]; }, /^zone dial: ambient\.light must hold 3 entries, not 2$/);
  expectOne((pick) => { pick('zone').kind = 'campaign'; }, /^zone dial: kind "campaign" is not one of district, peal, bill, debug$/);
  expectOne((pick) => { pick('zone').events[0].kind = 'shrine'; }, /^zone dial: events\[0\]\.kind "shrine" is not one of elite, swarm$/);
  expectOne((pick) => { pick('zone').place[1].role = 'shrine'; }, /^zone dial: place\[1\]\.role "shrine" is not one of bell-post, landmark, /);
  expectOne((pick) => { pick('zone').start = { x: 1 }; }, /^zone dial: start\.y is missing$/);
  expectOne((pick) => { pick('favour').rarity = 'epic'; }, /^favour funeral-biscuit: rarity "epic" is not one of plain, turned$/);
  expectOne((pick) => { pick('favour').scope = 'sigils'; }, /^favour funeral-biscuit: scope "sigils" is not one of global, voices$/);
  expectOne((pick) => { pick('observance').candles = 1; }, /^observance stability: candles is not a field of this shape$/);
  expectOne((pick) => { pick('trait').name = undefined; delete pick('trait').name; }, /^trait swift: name is missing$/);
});

test('the fields the design keeps at one value hold only that value', () => {
  expectOne((pick) => { pick('voice').crit = 5; }, /^voice tenor-stroke: crit must be 0, not 5$/);
  expectOne((pick) => { delete pick('voice').crit; }, /^voice tenor-stroke: crit is missing$/);
  expectOne((pick) => { pick('voice').weaponPct = 50; }, /^voice tenor-stroke: weaponPct must be 0, not 50$/);
  expectOne((pick) => { pick('voice').weapon = ['rope']; }, /^voice tenor-stroke: weapon must be null, not \["rope"\]$/);
  expectOne((pick) => { pick('attack').evadable = true; }, /^attack shoulder: evadable must be false, not true$/);
  expectOne((pick) => { pick('enemy').attacks[1].evadable = true; }, /^enemy wake-walker: attacks\[1\]\.evadable must be false, not true$/);
  expectOne((pick) => { pick('observance').aura = { radius: 6, enemyMods: [] }; }, /^observance stability: aura must be null, not \{"radius":6,"enemyMods":\[\]\}$/);
  expectOne((pick) => { pick('base').weapon = { damage: { blow: [3, 7] }, aps: 1.3 }; }, /^base bell-rope: weapon must be null, not /);
});

test('fields that may be left out or null, and shapes that are open', () => {
  assert.deepEqual(problems((pick) => {
    delete pick('voice').fx.puppet;                    // an optional field
    delete pick('cluster').nodes[1].text;
    delete pick('mode').zones;
    delete pick('favour').group;
    delete pick('legacyNode').unlock;
    delete pick('zone').place;
    delete pick('zone').start;
    delete pick('class').door;
    delete pick('prop').role;
    pick('zone').ambient.anything = { goes: 'here' };  // an open object
    pick('tileset').tiles = [1, 2, 3];                 // an open kind
    pick('voice').icon = { glyph: 'bell', tint: 2 };   // 'any'
    pick('enemy').loot = null;
    pick('enemy').guard = {};                          // the kinds' own guards, then
    pick('base', 'jerkin').defence = { weight: 12 };
  }), []);
});

test('ids are lower-case words joined by dots or dashes', () => {
  for (const id of ['Swift', 'swift step', 'swift_step', '.swift', 'swift.', 'swift..step', 'swïft']) {
    expectOne((pick) => { pick('trait').id = id; pick('zone').events[0].traits = [id]; }, new RegExp(`^trait ${id.replace(/\./g, '\\.')}: id "`));
  }
  assert.deepEqual(problems((pick) => { pick('trait').id = 'swift-2.b'; pick('zone').events[0].traits = ['swift-2.b']; }), []);
});

test('links between definitions must lead somewhere', () => {
  expectOne((pick) => { pick('class').voices = ['frost']; }, /^class change-ringer: voices\[0\] names the voice "frost", and there is none$/);
  expectOne((pick) => { pick('class').voices = []; }, /^class change-ringer: voices must hold 1 to 6 entries, not 0$/);
  expectOne((pick) => { pick('class').startGear = ['bell-rope', 'new-rope']; }, /^class change-ringer: startGear\[1\] names the base "new-rope"/);
  expectOne((pick) => { pick('class').unlock = 'nothing'; }, /^class change-ringer: unlock names the bequest "nothing", and there is none$/);
  expectOne((pick) => { pick('zone').timeline[0].pool[0].enemy = 'stranger'; }, /^zone dial: timeline\[0\]\.pool\[0\]\.enemy names the enemy "stranger"/);
  expectOne((pick) => { pick('zone').boss = 'wake-walker'; }, /^zone dial: boss names the boss "wake-walker"/);
  expectOne((pick) => { pick('zone').next = 'nowhere'; }, /^zone dial: next names the zone "nowhere"/);
  expectOne((pick) => { pick('zone').tileset = 'sand'; }, /^zone dial: tileset names the tileset "sand"/);
  expectOne((pick) => { pick('zone').place[0].prop = 'statue'; }, /^zone dial: place\[0\]\.prop names the prop "statue"/);
  expectOne((pick) => { pick('prop').puppet = 'statue'; }, /^prop bell-post: puppet names the puppet "statue"/);
  expectOne((pick) => { pick('unique').base = 'lantern'; }, /^unique great-hour: base names the base "lantern"/);
  expectOne((pick) => { pick('bequest').reward.currency = { coin: 1 }; }, /^bequest first-toll: reward\.currency\.coin \(the key\) names the currency "coin"/);
  expectOne((pick) => { pick('treeSkeleton').starts = { sexton: { sector: 1 } }; }, /^treeSkeleton rose: starts\.sexton \(the key\) names the class "sexton"/);
  expectOne((pick) => { pick('legacyNode').requires = ['second-pit']; }, /^legacyNode tenor-pit: requires\[0\] names the legacyNode "second-pit"/);
  expectOne((pick) => { pick('mode').zones = ['dial', 'ropewalk']; }, /^mode trial: zones\[1\] names the zone "ropewalk"/);
  expectOne((pick) => { pick('enemy').attacks[0] = 'lunge'; }, /^enemy wake-walker: attacks\[0\] names the attack "lunge"/);
  expectOne((pick) => { pick('favour').requires.class = 'verger'; }, /^favour funeral-biscuit: requires\.class names the class "verger"/);
});

test('a link into a kind that has no definitions yet is not checked', () => {
  // without the sample's puppets, tilesets and bequests, the same links pass: that part of the game is not there
  const found = problems((pick, defs) => {
    for (let i = defs.length - 1; i >= 0; i--) if (['puppet', 'tileset', 'bequest'].includes(defs[i][0])) defs.splice(i, 1);
    pick('class').puppet = 'not-made-yet';
    pick('zone').tileset = 'not-made-yet';
    pick('class').unlock = 'not-made-yet';
  });
  assert.deepEqual(found, []);
});

test('every stat, tag and condition inside a modifier is checked against the tables', () => {
  expectOne((pick) => { pick('voice').mods[0].stat = 'chance.coind'; }, /^voice tenor-stroke: mods\[0\]\.stat "chance\.coind" is not a stat$/);
  expectOne((pick) => { pick('voice').mods.push(mod('damage', 'inc', 5, { tags: ['round', 'roundish'] })); }, /^voice tenor-stroke: mods\[1\]\.tags\[1\] "roundish" is not a tag$/);
  expectOne((pick) => { pick('voice').mods.push(mod('damage', 'inc', 5, { cond: 'onFire' })); }, /^voice tenor-stroke: mods\[1\]\.cond "onFire" is not a modifier condition$/);
  expectOne((pick) => { pick('voice').mods.push(mod('damage', 'plus', 5)); }, /^voice tenor-stroke: mods\[1\]\.op "plus" is not one of flat, inc, more, set$/);
  expectOne((pick) => { pick('voice').mods.push(mod('damage', 'inc', 5, { tag: ['round'] })); }, /^voice tenor-stroke: mods\[1\]\.tag is not a field of this shape$/);
  expectOne((pick) => { pick('voice').mods.push(mod('damage', 'inc', 5, { per: { stat: 'life', div: 10 } })); }, /^voice tenor-stroke: mods\[1\]\.per\.stat "life" is not something a per modifier can count$/);
  expectOne((pick) => { pick('voice').mods.push(mod('damage', 'inc', 5, { per: { stat: 'knee', div: 0 } })); }, /^voice tenor-stroke: mods\[1\]\.per\.div must be above 0$/);
  expectOne((pick) => { pick('voice').mods.push(mod('damage', 'inc', '5')); }, /^voice tenor-stroke: mods\[1\]\.value must be a number or \{a, b, curve\}, not "5"$/);
  expectOne((pick) => { pick('voice').mods.push(mod('damage', 'inc', 5, { local: 1 })); }, /^voice tenor-stroke: mods\[1\]\.local must be true or false, not 1$/);
  // deeper places: a cluster node, a calling node, a class's base, an affix tier, a unique, an observance
  expectOne((pick) => { pick('observance').mods[0].stat = 'takn'; }, /^observance stability: mods\[0\]\.stat "takn" is not a stat$/);
  expectOne((pick) => { pick('cluster').nodes[2].mods[0].tags = ['burning']; }, /^cluster stones: nodes\[2\]\.mods\[0\]\.tags\[0\] "burning" is not a tag$/);
  expectOne((pick) => { pick('calling').nodes[1].mods[0].cond = 'standing'; }, /^calling stander: nodes\[1\]\.mods\[0\]\.cond "standing" is not a modifier condition$/);
  expectOne((pick) => { pick('class').base[0].stat = 'life'; }, /^class change-ringer: base\[0\]\.stat "life" is not a stat$/);
  expectOne((pick) => { pick('treeSkeleton').pathMods[0].stat = 'hp'; }, /^treeSkeleton rose: pathMods\[0\]\.stat "hp" is not a stat$/);
  expectOne((pick) => { pick('affix').tiers[1].mods[0].tags = ['rond']; }, /^affix of-the-rope: tiers\[1\]\.mods\[0\]\.tags\[0\] "rond" is not a tag$/);
  expectOne((pick) => { pick('unique').mods[0].cond = 'brace'; }, /^unique great-hour: mods\[0\]\.cond "brace" is not a modifier condition$/);
  expectOne((pick) => { pick('base').implicit[0].stat = 'critChance'; }, /^base bell-rope: implicit\[0\]\.stat "critChance" is not a stat$/);
  expectOne((pick) => { pick('favour').mods[0].tags = ['rounds']; }, /^favour funeral-biscuit: mods\[0\]\.tags\[0\] "rounds" is not a tag$/);
  expectOne((pick) => { pick('trait').mods[0].stat = 'moveSpeed'; }, /^trait swift: mods\[0\]\.stat "moveSpeed" is not a stat$/);
  expectOne((pick) => { pick('legacyNode').mods[0].op = 'add'; }, /^legacyNode tenor-pit: mods\[0\]\.op "add" is not one of/);
  // other fields that name table rows
  expectOne((pick) => { pick('voice').tags.push('magic'); }, /^voice tenor-stroke: tags\[1\] "magic" is not a tag$/);
  expectOne((pick) => { pick('voice').attr = 'str'; }, /^voice tenor-stroke: attr "str" is not an attribute$/);
  expectOne((pick) => { pick('voice').damage = { physical: [1, 2] }; }, /^voice tenor-stroke: damage\.physical \(the key\) "physical" is not a kind of harm$/);
  expectOne((pick) => { pick('base').family = 'sword'; }, /^base bell-rope: family "sword" is not a family of finds$/);
  expectOne((pick) => { pick('knot').requires = ['rounds']; }, /^knot slip-knot: requires\[0\] "rounds" is not a tag$/);
  expectOne((pick) => { pick('enemy').guard = { holy: 10 }; }, /^enemy wake-walker: guard\.holy \(the key\) "holy" is not a kind of harm$/);
  expectOne((pick) => { pick('enemy').attacks[1].ailment = 'rot'; }, /^enemy wake-walker: attacks\[1\]\.ailment "rot" is not a condition a body carries$/);
  expectOne((pick) => { pick('attack').type = 'fire'; }, /^attack shoulder: type "fire" is not a kind of harm$/);
  expectOne((pick) => { pick('base').req = { level: 2, dexterity: 4 }; }, /^base bell-rope: req\.dexterity \(the key\) "dexterity" is not an attribute$/);
  expectOne((pick) => { pick('class').perLevel.luck = 3; }, /^class change-ringer: perLevel\.luck \(the key\) "luck" is not an attribute$/);
  expectOne((pick) => { pick('favour').requires.tags = ['round', 'sorcery']; }, /^favour funeral-biscuit: requires\.tags\[1\] "sorcery" is not a tag$/);
});

test('what a spec cannot say about a modifier: pairs and ranges', () => {
  expectOne((pick) => { pick('voice').mods.push(mod('life-max', 'flat', [1, 2])); }, /^voice tenor-stroke: mods\[1\]\.value is a pair, but life-max is a single number$/);
  expectOne((pick) => { pick('voice').mods.push(mod('added.blow', 'flat', [1, 2, 3])); }, /^voice tenor-stroke: mods\[1\]\.value must hold 2 entries, not 3$/);
  expectOne((pick) => { pick('voice').mods.push(mod('damage', 'inc', 10, { from: 'blow' })); }, /^voice tenor-stroke: mods\[1\]\.from is not a field of this shape$/);
  expectOne((pick) => { pick('unique').mods[0].min = 30; }, /^unique great-hour: mods\[0\]\.min is above max$/);
  expectOne((pick) => { pick('unique').mods[0].max = [1, 2]; }, /^unique great-hour: mods\[0\]\.max must be a pair exactly when min is one$/);
  expectOne((pick) => { pick('base').implicit[0].min = [1, 2]; pick('base').implicit[0].max = [2, 3]; }, /^base bell-rope: implicit\[0\]\.min is a pair, but pull-window is a single number$/);
  assert.deepEqual(problems((pick) => { pick('unique').mods.push({ stat: 'added.drag', op: 'flat', min: [1, 2], max: [3, 4] }); }), [], 'a rolled range on a range stat');
  expectOne((pick) => { delete pick('unique').mods[0].max; }, /^unique great-hour: mods\[0\]\.max is missing$/);
  expectOne((pick) => { pick('unique').mods[0].value = 5; }, /^unique great-hour: mods\[0\]\.value is not a field of this shape$/);
});

test('the rules of the design that a spec cannot say', () => {
  // every voice deals one kind of harm (section 2)
  expectOne((pick) => { pick('voice').damage = {}; }, /^voice tenor-stroke: damage must name one kind of harm, not 0: every voice deals one kind$/);
  expectOne((pick) => { pick('voice').damage = { blow: [1, 2], drag: [1, 2] }; }, /^voice tenor-stroke: damage must name one kind of harm, not 2/);
  // no body guards against a Swell, which is bare (section 3)
  expectOne((pick) => { pick('enemy').guard = { swell: 10 }; }, /^enemy wake-walker: guard\.swell is a bare kind of harm, against which no body has a guard$/);
  expectOne((pick) => { pick('boss').guard = { blow: 60, swell: 5 }; }, /^boss half-muffled-keeper: guard\.swell is a bare kind of harm/);
  // favours add numbers with flat and inc only, and only a turned favour switches a rule (04-progression)
  expectOne((pick) => { pick('favour').mods[0].op = 'more'; }, /^favour funeral-biscuit: mods\[0\]\.op "more": a favour adds numbers with flat and inc only$/);
  expectOne((pick) => { pick('favour').mods.push(mod('flag.countermarch', 'flat', 1)); }, /^favour funeral-biscuit: mods\[1\]\.stat "flag\.countermarch" switches a rule, which only a turned favour does$/);
  expectOne((pick) => { pick('favour', 'countermarch').mods[0].op = 'set'; }, /^favour countermarch: mods\[0\]\.op "set": a favour adds numbers with flat and inc only$/);
  // an observance holds 20 to 40 Heed
  expectOne((pick) => { pick('observance').heed = 50; }, /^observance stability: heed must be at most 40, not 50$/);
  expectOne((pick) => { pick('observance').heed = 10; }, /^observance stability: heed must be at least 20, not 10$/);
});

test('scaled values are a number or {a, b, curve}', () => {
  expectOne((pick) => { pick('voice').rate = { a: 1, b: 2, curve: 'cubic' }; }, /^voice tenor-stroke: rate\.curve "cubic" is not one of lin, exp$/);
  expectOne((pick) => { pick('voice').rate = { a: 1, curve: 'lin' }; }, /^voice tenor-stroke: rate\.b is missing$/);
  expectOne((pick) => { pick('voice').rate = { a: 0, b: 5, curve: 'exp' }; }, /^voice tenor-stroke: rate has an exp curve, which needs a and b on the same side of 0$/);
  expectOne((pick) => { pick('voice').rate = { a: -2, b: 5, curve: 'exp' }; }, /needs a and b on the same side of 0$/);
  expectOne((pick) => { pick('voice').rate = [1, 2]; }, /^voice tenor-stroke: rate must be a number or \{a, b, curve\}, not \[1,2\]$/);
  expectOne((pick) => { pick('voice').damage.blow[1] = '80'; }, /^voice tenor-stroke: damage\.blow\[1\] must be a number or \{a, b, curve\}, not "80"$/);
  expectOne((pick) => { pick('voice').params.count = { a: 1, b: 3, curve: 'lin', step: 1 }; }, /^voice tenor-stroke: params\.count\.step is not a field of this shape$/);
  assert.deepEqual(problems((pick) => { pick('voice').rate = { a: -1, b: -5, curve: 'exp' }; }), []);
});

test('a definition must be what JSON can carry', () => {
  expectOne((pick) => { pick('voice').cast = function () {}; }, /^voice tenor-stroke: cast is a function, which JSON cannot carry$/);
  expectOne((pick) => { pick('voice').params.count = undefined; }, /^voice tenor-stroke: params\.count is undefined, which JSON cannot carry$/);
  expectOne((pick) => { pick('voice').eff = NaN; }, /^voice tenor-stroke: eff is NaN, which JSON cannot carry$/);
  expectOne((pick) => { pick('enemy').life = Infinity; }, /^enemy wake-walker: life is Infinity, which JSON cannot carry$/);
  expectOne((pick) => { pick('voice').fx.made = new Date(0); }, /^voice tenor-stroke: fx\.made is not a plain object, so JSON would change it$/);
  expectOne((pick) => { pick('voice').fx.seen = new Map(); }, /^voice tenor-stroke: fx\.seen is not a plain object/);
  expectOne((pick) => { pick('zone').rules.big = 10n; }, /^zone dial: rules\.big is bigint, which JSON cannot carry$/);
  expectOne((pick) => { pick('enemy').aiParams.self = pick('enemy'); }, /^enemy wake-walker: aiParams\.self holds itself, which JSON cannot carry$/);
  expectOne((pick) => { pick('cluster').nodes[1].mods[0].value = () => 5; }, /^cluster stones: nodes\[1\]\.mods\[0\]\.value is a function/);
  // the same object used in two places is fine: it is frozen anyway
  assert.deepEqual(problems((pick) => { const shared = ['blow']; pick('cluster').theme = shared; pick('cluster').nodes[0].mods[0].tags = shared; }), []);
});

test('keys and links inside one definition', () => {
  expectOne((pick) => { pick('cluster').entry = 'z'; }, /^cluster stones: entry "z" is not the key of one of its nodes$/);
  expectOne((pick) => { pick('cluster').nodes[2].key = 'a'; }, /^cluster stones: nodes has two nodes with the key "a"$/);
  expectOne((pick) => { pick('calling').nodes[1].requires = ['a', 'q']; }, /^calling stander: nodes\[1\]\.requires "q" is not the key of another of its nodes$/);
  expectOne((pick) => { pick('calling').nodes[1].requires = ['b']; }, /^calling stander: nodes\[1\]\.requires "b" is not the key of another of its nodes$/);
  expectOne((pick) => { pick('legacyNode').cost = [100, 150]; }, /^legacyNode tenor-pit: cost must hold one cost for each of its 3 ranks, not 2$/);
  expectOne((pick) => { pick('boss').phases[0].loop[0] = 'stomp'; }, /^boss half-muffled-keeper: phases\[0\]\.loop\[0\] "stomp" is not one of its attacks$/);
  expectOne((pick) => { pick('boss').phases[1].onEnter = ['echo']; }, /^boss half-muffled-keeper: phases\[1\]\.onEnter\[0\] "echo" is not one of its attacks$/);
  expectOne((pick) => { pick('enemy').attacks[1].id = 'shoulder'; }, /^enemy wake-walker: attacks has two attacks with the id "shoulder"$/);
  expectOne((pick) => { pick('puppet').parts[1].parent = 'spine'; }, /^puppet debug\.husk: parts\[1\]\.parent "spine" is not the key of another of its parts$/);
  expectOne((pick) => { pick('puppet').parts[1].color = 'gold'; }, /^puppet debug\.husk: parts\[1\]\.color "gold" is not in its palette$/);
  expectOne((pick) => { pick('puppet').parts.push(Object.assign({}, pick('puppet').parts[0])); }, /^puppet debug\.husk: parts has two parts with the key "torso"$/);
  expectOne((pick) => { pick('mode').xpCurve = 'heroXp'; }, /^mode trial: xpCurve "heroXp" is not a list in the curves "main"$/);
});

test('a class and its callings name each other, and an enemy and a boss never share an id', () => {
  const both = problems((pick) => { pick('calling', 'backward-ringer').class = 'verger'; });
  assert.equal(both.length, 2);
  assert.match(both.join('\n'), /^class change-ringer: callings\[1\] "backward-ringer" belongs to the class "verger"$/m);
  assert.match(both.join('\n'), /^calling backward-ringer: class names the class "verger", and there is none$/m);
  // a class that drops a calling which still names it
  const dropped = problems((pick) => { pick('class').callings = ['stander']; });
  assert.deepEqual(dropped, ['class change-ringer: callings must hold 2 entries, not 1', 'calling backward-ringer: class "change-ringer" does not list this calling']);
  expectOne((pick) => { pick('boss').id = 'wake-walker'; pick('zone').boss = 'wake-walker'; },
    /^boss wake-walker: id is also the id of an enemy; the two share one pool and need different ids$/);
});

test('a union reports the form the value came closest to; an object names the field', () => {
  expectOne((pick) => { pick('voice').mods[0].value = [1, 'x']; }, /^voice tenor-stroke: mods\[0\]\.value\[1\] must be a number or \{a, b, curve\}, not "x"$/);
  expectOne((pick) => { pick('boss').phases[0].loop[1] = { wait: -1 }; }, /^boss half-muffled-keeper: phases\[0\]\.loop\[1\]\.wait must be at least 0, not -1$/);
  expectOne((pick) => { pick('enemy').attacks[1].mult = 'double'; }, /^enemy wake-walker: attacks\[1\]\.mult must be a number, not "double"$/);
  expectOne((pick) => { pick('mode').calling = { afterKeeper: 'two', pointsPerPeal: 2 }; }, /^mode trial: calling\.afterKeeper must be a number, not "two"$/);
  expectOne((pick) => { pick('mode').calling = { afterKeeper: 1 }; }, /^mode trial: calling\.pointsPerPeal is missing$/);
});

// ---- growing the schema ----

test('allow adds a word to a list, for content to name what a registry holds', () => {
  expectOne((pick) => { pick('enemy').ai = 'flanker'; }, /^enemy wake-walker: ai "flanker" is not one of wake, chase$/);
  assert.deepEqual(problems((pick, defs, sim) => {
    sim.Defs.allow('ai', 'flanker', 'chase', 'burrower');
    pick('enemy').ai = 'flanker';
    assert.deepEqual(plain(sim.Defs.ENUMS.ai).slice(-2), ['flanker', 'burrower'], 'a word that is there already is not added twice');
    assert.throws(() => sim.Defs.allow('moods', 'grim'), /no word list "moods"/);
    assert.throws(() => sim.Defs.allow('ai', 7), /a word is a string/);
  }), []);
  assert.deepEqual(problems((pick, defs, sim) => { sim.Defs.allow('archetype', 'toll'); pick('voice').archetype = 'toll'; }), [], 'an archetype a registry adds');
});

test('extend adds a field to a kind, or replaces its spec', () => {
  expectOne((pick) => { pick('voice').charges = 3; }, /^voice tenor-stroke: charges is not a field of this shape$/);
  assert.deepEqual(problems((pick, defs, sim) => {
    sim.Defs.extend('voice', { charges: { type: 'int', min: 1 }, tier: { type: 'int', min: 1, max: 9 }, note: { type: 'string', required: false } });
    pick('voice').charges = 3;
    pick('voice').tier = 7;
  }), []);
  expectOne((pick, defs, sim) => { sim.Defs.extend('voice', { charges: { type: 'int', min: 1 } }); }, /^voice tenor-stroke: charges is missing$/);
  expectOne((pick, defs, sim) => { sim.Defs.extend('voice', { charges: { type: 'int', min: 1 } }); pick('voice').charges = 0; },
    /^voice tenor-stroke: charges must be at least 1, not 0$/);
  // an attack written inside an enemy follows the kind attack, and a boss follows the kind enemy
  assert.deepEqual(problems((pick, defs, sim) => {
    sim.Defs.extend('attack', { windup: { type: 'number', min: 0, required: false }, lunge: { type: 'number' } });
    sim.Defs.extend('enemy', { loot: { type: 'any', required: false }, weight: { type: 'number', required: false } });
    delete pick('attack').windup;
    pick('attack').lunge = 1;
    delete pick('enemy').attacks[1].windup;
    pick('enemy').attacks[1].lunge = 3;
    pick('boss').attacks[0].lunge = 0;
    delete pick('boss').loot;
    pick('boss').weight = 9;
  }), []);
  expectOne((pick, defs, sim) => { sim.Defs.extend('enemy', { weight: { type: 'number', required: false } }); pick('boss').weight = 'heavy'; },
    /^boss half-muffled-keeper: weight must be a number, not "heavy"$/);
  // a pinned field can be given another spec by a later system, and the district rules of the vigil add fields
  assert.deepEqual(problems((pick, defs, sim) => {
    sim.Defs.extend('zone', { shadow: { type: 'number', min: 0, required: false } });
    pick('zone').shadow = 0.25;
  }), []);
  const { Defs } = kernel();
  assert.throws(() => Defs.extend('spell', {}), /not a kind of definition/);
  assert.throws(() => Defs.extend('voice', { charges: 'int' }), /needs a type/);
});
