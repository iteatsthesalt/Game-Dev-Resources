// tests/sim/01-defs.test.js: the registries of definitions, their shapes and the check at boot (src/js/01-defs.js).
// sample() below is one valid definition of every kind, written the way docs/engine.md gives the shapes. The
// tests break it in one place at a time and expect finalize to name the kind, the id and the field.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const modules = require('../../tools/modules.js');
const { loadSim, plain } = require('./loader.js');

const KINDS = ['sigil', 'binding', 'vow', 'treeSkeleton', 'cluster', 'legacyNode', 'class', 'calling', 'attack', 'enemy', 'boss', 'zone',
  'puppet', 'prop', 'tileset', 'base', 'affix', 'unique', 'currency', 'chime', 'deed', 'mode', 'curves', 'constants', 'trait', 'chartMod'];
const mod = (stat, op, value, more) => Object.assign({ stat, op, value }, more);

// Runs only the files named, in a context of their own: registries with nothing in them, whatever content the
// game ships. Most tests here use kernel(), so they keep passing as content arrives and never meet its ids.
function bare(files) {
  const context = vm.constants && vm.constants.DONT_CONTEXTIFY ? vm.createContext(vm.constants.DONT_CONTEXTIFY) : vm.createContext({});
  context.console = console;
  for (const file of files) new vm.Script(modules.read(file), { filename: file }).runInContext(context);
  return new vm.Script('({ Core, Defs, Stats })').runInContext(context);
}
const kernel = () => bare(['00-core.js', '01-defs.js', '10-stats.js']);

function sample() {
  const attack = (id, more) => Object.assign({
    id, kind: 'contact', type: 'physical', mult: 1, cooldown: 1, range: 0.6, windup: 0.2, shape: 'circle', radius: 0, angle: 0, count: 1,
    spread: 0, speed: 0, evadable: true, ailment: null, summon: null, fx: null,
  }, more);
  const enemy = (id, more) => Object.assign({
    id, name: 'Rotter', puppet: 'debug.husk', radius: 0.4, life: 12, damage: 3, speed: 2.4, xp: 1, cost: 1, loot: 'common', ai: 'chase',
    aiParams: { lunge: 2 }, attacks: ['bite', attack('spit', { kind: 'projectile', type: 'void', range: 9, speed: 8, ailment: 'poison' })],
    res: { fire: -20, void: 30 }, armour: 4, threshold: 1, tags: ['dead'],
  }, more);
  const calling = (id) => ({
    id, class: 'warden', name: 'Bulwark', text: 'Stands fast.', points: 8,
    nodes: [
      { key: 'a', kind: 'minor', name: 'Stance', mods: [mod('armour', 'inc', 10)], requires: [], row: 0, col: 0 },
      { key: 'b', kind: 'major', name: 'Wall', text: 'Nothing passes.', icon: 'wall', mods: [mod('taken', 'more', -8, { cond: 'still' })], requires: ['a'], row: 1, col: 0 },
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
    ['tileset', { id: 'cobbles', name: 'Cobbles', colours: ['#222833'] }],
    ['prop', { id: 'pillar', puppet: 'debug.husk', radius: 0.8, light: { radius: 6, color: '#ffcc88' }, breakable: { loot: null } }],
    ['sigil', {
      id: 'ember', name: 'Ember', text: 'Throws {0} sparks.', icon: 'flame', attr: 'int', tier: 1, tags: ['spell', 'projectile', 'fire'], weapon: null,
      archetype: 'projectile', target: 'nearest', rate: { a: 1, b: 2, curve: 'lin' },
      damage: { fire: [{ a: 4, b: 40, curve: 'exp' }, { a: 8, b: 80, curve: 'exp' }] }, weaponPct: 0, eff: 1, crit: 5,
      params: { speed: 14, count: { a: 1, b: 3, curve: 'lin' } }, mods: [mod('chance.ignite', 'flat', 10)],
      fx: { puppet: null, cast: 'spark', hit: 'burst', sfxCast: 'whoosh', sfxHit: 'pop', light: { radius: 3, color: '#ff8844' } },
    }],
    ['binding', {
      id: 'split', name: 'Split', text: 'Two more.', icon: null, attr: 'dex', tier: 1, requires: ['projectile'], excludes: ['beam'], addTags: ['area'],
      mods: [mod('projectiles', 'flat', 2), mod('damage', 'more', -25), mod('added.fire', 'flat', [{ a: 1, b: 9, curve: 'lin' }, 12])],
      params: { spread: 0.3 }, trigger: { on: 'crit', chance: 25, cooldown: 0.5 },
    }],
    ['vow', {
      id: 'vigilance', name: 'Vigilance', text: 'Stand watch.', icon: 'eye', attr: 'str', tier: 2, candles: 1,
      mods: [mod('armour', 'inc', 20), mod('lifeRegen', 'flat', 1, { per: { stat: 'level', div: 5, cap: 10 } })],
      aura: { radius: 6, enemyMods: [mod('taken', 'more', 10)] },
    }],
    ['treeSkeleton', { id: 'rose', spokes: 6, rings: [{ r: 4, slots: 6 }, { r: 8, slots: 12 }], pathMods: [mod('lifeMax', 'flat', 5)], starts: { warden: { sector: 0 } } }],
    ['cluster', {
      id: 'embers', name: 'Embers', anchor: { sector: 1, ring: 1, slot: 3 }, shape: 'line3', theme: ['fire'], entry: 'a',
      nodes: [
        { key: 'a', kind: 'minor', name: 'Kindling', mods: [mod('damage', 'inc', 8, { tags: ['fire'] })] },
        { key: 'b', kind: 'major', name: 'Hearth', text: 'It burns longer.', icon: 'flame', mods: [mod('ailmentDuration', 'inc', 20, { tags: ['ignite'] })] },
        { key: 'c', kind: 'capstone', name: 'Pyre', mods: [mod('flag.pyre', 'set', 1), mod('gainAsExtra.fire', 'flat', 15, { from: 'physical' })] },
      ],
    }],
    ['legacyNode', {
      id: 'first-light', name: 'First Light', text: 'A little more life.', icon: 'sun', branch: 'vigil', row: 0, col: 0, requires: [], ranks: 3,
      cost: [10, 20, 40], mods: [mod('lifeMax', 'flat', 4)], unlock: { class: 'warden' },
    }],
    ['class', {
      id: 'warden', name: 'Warden', text: 'Holds the line.', attrs: { str: 14, dex: 8, int: 6 }, perLevel: { str: 2, dex: 1, int: 1, life: 8 },
      base: [mod('lifeMax', 'flat', 40)], sector: 0, startSigil: 'ember', startGear: ['old-blade'], callings: ['bulwark', 'reaver'], unlock: null,
      puppet: 'debug.husk', palette: ['#334455', '#aabbcc'],
    }],
    ['calling', calling('bulwark')],
    ['calling', calling('reaver')],
    ['attack', attack('bite')],
    ['enemy', enemy('rotter')],
    ['boss', enemy('keeper', {
      name: 'The Keeper', attacks: [attack('slam', { kind: 'area', shape: 'ring', radius: 5, windup: 1.2, ailment: 'stun' }), 'bite'],
      arena: { radius: 18 },
      phases: [
        { until: 0.5, speed: 1, onEnter: ['slam'], loop: ['bite', { wait: 1.5 }, 'slam'] },
        { until: 0, speed: 1.3, onEnter: [], loop: ['slam'] },
      ],
    })],
    ['trait', { id: 'swift', name: 'Swift', text: 'Moves faster.', mods: [mod('moveSpeed', 'inc', 30)], glow: '#88ccff' }],
    ['zone', {
      id: 'ossuary', name: 'The Ossuary', kind: 'campaign', level: 3, tollSeconds: 75, keeperToll: 8, gateEvery: 3, region: { radius: 70 },
      tileset: 'cobbles', props: [{ prop: 'pillar', density: 0.4 }], ambient: { light: [0.4, 0.45, 0.6], fog: 0.02, sun: null, tint: '#223344' },
      music: 'dirge', timeline: [{ toll: 0, rate: 1.5, cap: 60, pool: [{ enemy: 'rotter', w: 3 }] }],
      overtoll: { rateMul: 1.2, levelPer: 1, rewardPer: 0.1 },
      events: [
        { toll: 2, kind: 'elite', enemy: 'rotter', traits: ['swift'] },
        { toll: 3, kind: 'swarm', enemy: 'rotter', shape: 'ring', count: 30 },
        { toll: 4, kind: 'miniboss', boss: 'keeper' },
        { toll: 5, kind: 'shrine' },
      ],
      boss: 'keeper', rules: { tollSeconds: 60 }, unlock: null, next: 'ossuary',
    }],
    ['base', {
      id: 'old-blade', name: 'Old Blade', slot: 'weapon', family: 'sword', tags: ['weapon', 'sword'], level: 1, req: { level: 1, str: 8 },
      twoHanded: false, weapon: { damage: { physical: [3, 7] }, aps: 1.3, crit: 5 }, defence: null,
      implicit: [{ stat: 'critChance', op: 'flat', min: 1, max: 3 }], icon: 'blade',
    }],
    ['base', {
      id: 'mail', name: 'Mail', slot: 'body', family: null, tags: ['armour'], level: 4, req: { str: 12 }, twoHanded: false, weapon: null,
      defence: { armour: 30, evasion: 0, hush: 0 }, implicit: [{ stat: 'armour', op: 'inc', min: 10, max: 20, local: true }], icon: null,
    }],
    ['affix', {
      id: 'of-embers', name: 'of Embers', type: 'suffix', group: 'addedFire', weights: { weapon: 100, ring: 20 },
      tiers: [
        { ilvl: 1, mods: [{ stat: 'added.fire', op: 'flat', min: [1, 2], max: [3, 5] }] },
        { ilvl: 20, mods: [{ stat: 'added.fire', op: 'flat', min: [4, 7], max: [9, 14], tags: ['attack'] }] },
      ],
    }],
    ['unique', {
      id: 'tollkeeper', name: 'Tollkeeper', base: 'old-blade', level: 10, mods: [{ stat: 'damage', op: 'more', min: 10, max: 20, cond: 'recentKill' }],
      flavour: 'It remembers every bell.', weight: 5, unlock: null,
    }],
    ['currency', { id: 'wax', name: 'Wax', text: 'Adds a modifier.', icon: 'drop', target: 'item', op: 'addMod', requires: { rarity: 'magic' }, args: {}, weight: 30, level: 1 }],
    ['chime', {
      id: 'quickening', name: 'Quickening', text: '+{0}% speed for spells', icon: 'bell', rarity: 'common', weight: 10, maxStacks: 5, group: 'speed',
      scope: 'sigils', requires: { tags: ['spell'], class: 'warden', runLevel: 2 }, mods: [mod('speed', 'inc', 8, { tags: ['spell'] })], params: { count: 1 },
    }],
    ['deed', {
      id: 'first-toll', name: 'First Toll', text: 'Hear a bell.', hidden: false, scope: 'account', on: 'toll', count: 1, where: { zone: 'ossuary' },
      reward: { class: 'warden', zone: 'ossuary', unique: 'tollkeeper', treePoints: 1, gold: 50, echoes: 5, currency: { wax: 2 } },
    }],
    ['mode', {
      id: 'trial', name: 'Trial', persistent: false, route: 'gauntlet', zones: ['ossuary'], xpCurve: 'charXp', levelCap: 20, runLevels: 10,
      levelOffer: 'node', runLevelOffer: 'chime', eliteOffer: 'reward', bossOffer: 'reward', shrineOffer: 'chime', haul: 'none',
      calling: { afterBoss: 1, pointsPerBoss: 2 }, respec: 'last3', death: 'permanent', score: { kill: 1 },
    }],
    ['curves', { id: 'main', levels: 5, enemyLife: [1, 2, 3, 4, 5], charXp: [10, 20, 30, 40, 50] }],
    ['constants', { id: 'main', anything: 1, nested: { fine: true } }],
    ['chartMod', { id: 'flooded', name: 'Flooded', text: 'Everything is slower.', mods: [mod('moveSpeed', 'more', -10)] }],
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

test('the kinds are the ones the engine notes list', () => {
  const { Defs } = kernel();
  assert.deepEqual(plain(Defs.KINDS), KINDS);
  assert.deepEqual(Object.keys(Defs.SCHEMA), KINDS);
  for (const kind of KINDS) assert.deepEqual(plain(Defs.all(kind)), [], `Defs.all('${kind}') works with no entries`);
});

test('add, get, has and all', () => {
  const { Defs } = kernel();
  const a = { id: 'ash' }, b = { id: 'brine' };
  assert.equal(Defs.add('trait', a), a, 'add returns the definition');
  Defs.add('trait', b);
  Defs.add('chartMod', { id: 'ash' });
  assert.equal(Defs.get('trait', 'ash'), a);
  assert.equal(Defs.has('trait', 'brine'), true);
  assert.equal(Defs.has('trait', 'cinder'), false);
  assert.equal(Defs.has('chartMod', 'brine'), false, 'each kind has its own ids');
  assert.deepEqual(Array.from(Defs.all('trait')), [a, b], 'in the order they were added');
  assert.equal(Defs.all('trait'), Defs.all('trait'), 'all gives the registry itself, not a copy each time');
  assert.throws(() => Defs.get('trait', 'cinder'), /Defs\.get: there is no trait "cinder"/);
  assert.throws(() => Defs.get('sigil', 'ash'), /there is no sigil "ash"/);
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
  assert.ok(Defs.has('mode', 'watch') && Defs.has('mode', 'gauntlet') && Defs.has('zone', 'debug') && Defs.has('enemy', 'debug.husk'));
  assert.equal(Defs.get('enemy', 'debug.husk').puppet, 'debug.husk');
});

test('the curves, the constants, the modes and the debug zone that ship', () => {
  const { Defs } = loadSim({ boot: true });
  const curves = Defs.get('curves', 'main');
  assert.equal(curves.levels, 70);
  for (const name of ['enemyLife', 'enemyDamage', 'enemyXp', 'accuracy', 'charXp', 'gauntletXp', 'runXp']) {
    assert.equal(curves[name].length, 70, `${name} has a number for each level`);
    assert.ok(curves[name].every((v) => Number.isFinite(v) && v > 0), name);
    for (let i = 1; i < 70; i++) assert.ok(curves[name][i] > curves[name][i - 1], `${name} rises from level ${i} to ${i + 1}`);
  }
  assert.deepEqual([curves.enemyLife[0], curves.enemyDamage[0], curves.enemyXp[0]], [1, 1, 1], 'at level 1 an enemy has its def\'s own numbers');
  assert.deepEqual(plain(curves.rank[0]), { life: 1, damage: 1, xp: 1, size: 1 });
  assert.deepEqual(plain(curves.rank[3]), { life: 1, damage: 1, xp: 1, size: 1 }, 'a boss def carries its own numbers');
  assert.equal(curves.rank.length, 4);
  assert.ok(curves.rank[1].life > 1 && curves.rank[2].life > curves.rank[1].life);
  assert.deepEqual(plain(Defs.get('constants', 'main')), {
    id: 'main', spawnRadius: 26, despawnRadius: 34, tollSeconds: 75, keeperToll: 8, gateEvery: 3, gateOpenSeconds: 25, gateHoldSeconds: 3,
    caps: { enemies: 600, shots: 500, areas: 120, pickups: 400, minions: 40, events: 2048 }, gridCell: 2, playerRadius: 0.4,
  });
  const watch = Defs.get('mode', 'watch'), gauntlet = Defs.get('mode', 'gauntlet');
  assert.deepEqual([watch.persistent, watch.route, watch.runLevelOffer, watch.levelOffer, watch.haul, watch.death], [true, 'zone', 'chime', 'none', 'gate', 'permanent']);
  assert.deepEqual(plain(watch.calling), { levels: [15, 30, 45, 55] });
  assert.deepEqual([gauntlet.persistent, gauntlet.route, gauntlet.runLevelOffer, gauntlet.levelOffer, gauntlet.haul, gauntlet.death],
    [false, 'gauntlet', 'none', 'node', 'none', 'permanent']);
  assert.deepEqual(plain(gauntlet.calling), { afterBoss: 1, pointsPerBoss: 2 });
  for (const mode of [watch, gauntlet]) assert.ok(Array.isArray(curves[mode.xpCurve]) && mode.levelCap <= curves[mode.xpCurve].length, `${mode.id}: its xp curve reaches its level cap`);
  const zone = Defs.get('zone', 'debug'), husk = Defs.get('enemy', 'debug.husk');
  assert.deepEqual([zone.kind, zone.boss, zone.props.length, zone.timeline.length, zone.events.length], ['debug', null, 0, 0, 0]);
  assert.ok(zone.region.radius > Defs.get('constants', 'main').despawnRadius, 'the ground is wider than the ring enemies despawn at');
  assert.deepEqual([husk.puppet, husk.attacks.length, husk.radius > 0, husk.life > 0], ['debug.husk', 0, true, true]);
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
  const ember = sim.Defs.get('sigil', 'ember');
  ember.tier = 2;                                      // still open before finalize
  assert.deepEqual(plain(sim.Defs.finalize()), []);
  assert.ok(Object.isFrozen(ember) && Object.isFrozen(ember.tags) && Object.isFrozen(ember.damage.fire[0]) && Object.isFrozen(ember.mods[0]));
  assert.throws(() => { ember.tier = 3; }, TypeError);
  assert.throws(() => { ember.mods.push({}); }, TypeError);
  assert.throws(() => { ember.fx.light.radius = 9; }, TypeError);
  assert.ok(Object.isFrozen(sim.Defs.all('sigil')));
  assert.ok(Object.isFrozen(sim.Defs.SCHEMA.sigil.fields.tier) && Object.isFrozen(sim.Defs.ENUMS.ai) && Object.isFrozen(sim.Defs.SHAPES.Mod.fields));
  assert.throws(() => sim.Defs.add('trait', { id: 'late' }), /the definitions were finalized/);
  assert.throws(() => sim.Defs.allow('ai', 'late'), /finalized/);
  assert.throws(() => sim.Defs.extend('trait', { late: { type: 'number' } }), /finalized/);
  assert.equal(sim.Defs.get('sigil', 'ember'), ember, 'reading goes on as before');
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
    'cond', 'dtype', 'family', 'primary', 'counted', 'ailment']);
  let seen = 0;
  const walk = (spec, where) => {
    seen++;
    assert.ok(types.has(spec.type), `${where}: type ${spec.type}`);
    assert.equal(typeof spec.required, 'boolean', `${where}: says whether it is required`);
    if (spec.ref !== undefined) assert.ok(KINDS.includes(spec.ref), `${where}: ref ${spec.ref}`);
    if (spec.enum !== undefined) assert.ok(Array.isArray(spec.enum) && spec.enum.length > 0 && spec.enum.every((w) => typeof w === 'string'), `${where}: enum`);
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
  assert.deepEqual(Object.keys(Defs.SHAPES), ['Mod', 'ModRange', 'Trigger', 'Attack']);
  assert.deepEqual(plain(Defs.SCHEMA.enemy.fields.puppet), { type: 'string', required: true, ref: 'puppet' });
  assert.deepEqual(plain(Defs.SCHEMA.sigil.fields.tier), { type: 'int', required: true, min: 1, max: 5 });
  assert.deepEqual(plain(Defs.SCHEMA.enemy.fields.ai.enum), ['chase', 'ranged', 'charger', 'swarm', 'caster', 'exploder', 'summoner', 'lurker']);
  assert.equal(Defs.SCHEMA.enemy.fields.ai.enum, Defs.ENUMS.ai, 'a word list is one array, wherever it is used');
  assert.equal(Defs.SCHEMA.sigil.fields.weapon.nullable, true);
  assert.equal(Defs.SHAPES.Mod.fields.tags.required, false);
  assert.deepEqual(Object.keys(Defs.SCHEMA.boss.fields).filter((f) => !(f in Defs.SCHEMA.enemy.fields)), ['arena', 'phases'], 'a boss is an enemy and more');
});

// ---- faults, one at a time ----

test('a missing field, a wrong type, a word off the list, a field that is not in the shape', () => {
  expectOne((pick) => { delete pick('sigil').rate; }, /^sigil ember: rate is missing$/);
  expectOne((pick) => { pick('sigil').tier = 'one'; }, /^sigil ember: tier must be a number, not "one"$/);
  expectOne((pick) => { pick('sigil').tier = 1.5; }, /^sigil ember: tier must be a whole number, not 1\.5$/);
  expectOne((pick) => { pick('sigil').tier = 6; }, /^sigil ember: tier must be at most 5, not 6$/);
  expectOne((pick) => { pick('sigil').eff = -1; }, /^sigil ember: eff must be at least 0, not -1$/);
  expectOne((pick) => { pick('sigil').name = 5; }, /^sigil ember: name must be text, not 5$/);
  expectOne((pick) => { pick('sigil').target = 'weakest'; }, /^sigil ember: target "weakest" is not one of nearest, densest, random, farthest, aim, self$/);
  expectOne((pick) => { pick('sigil').cooldown = 2; }, /^sigil ember: cooldown is not a field of this shape$/);
  expectOne((pick) => { pick('sigil').constructor = 2; }, /^sigil ember: constructor is not a field of this shape$/);
  expectOne((pick) => { pick('puppet').parts[0].color = 'toString'; }, /^puppet debug\.husk: parts\[0\]\.color "toString" is not in its palette$/);
  expectOne((pick) => { pick('sigil').weapon = 'bow'; }, /^sigil ember: weapon must be a list, not "bow"$/);
  expectOne((pick) => { pick('sigil').tags = null; }, /^sigil ember: tags is null$/);
  expectOne((pick) => { pick('enemy').aiParams = [1]; }, /^enemy rotter: aiParams must be an object, not \[1\]$/);
  expectOne((pick) => { pick('base').twoHanded = 0; }, /^base old-blade: twoHanded must be true or false, not 0$/);
  expectOne((pick) => { pick('puppet').parts[0].size = [1, 2]; }, /^puppet debug\.husk: parts\[0\]\.size must hold 3 entries, not 2$/);
  expectOne((pick) => { pick('class').palette[1] = 'blue'; }, /^class warden: palette\[1\] "blue" must be a colour written as #rrggbb$/);
  expectOne((pick) => { pick('zone').region.radius = 3; }, /^zone ossuary: region\.radius must be at least 10, not 3$/);
  expectOne((pick) => { pick('zone').ambient.light = [1, 1]; }, /^zone ossuary: ambient\.light must hold 3 entries, not 2$/);
  expectOne((pick) => { pick('trait').name = undefined; delete pick('trait').name; }, /^trait swift: name is missing$/);
});

test('fields that may be left out or null, and shapes that are open', () => {
  assert.deepEqual(problems((pick) => {
    delete pick('sigil').fx.puppet;                    // an optional field
    delete pick('cluster').nodes[1].text;
    delete pick('mode').zones;
    delete pick('chime').group;
    delete pick('legacyNode').unlock;
    pick('zone').ambient.anything = { goes: 'here' };  // an open object
    pick('tileset').tiles = [1, 2, 3];                 // an open kind
    pick('sigil').icon = { glyph: 'flame', tint: 2 };  // 'any'
    pick('enemy').loot = null;
    pick('base', 'mail').defence = { armour: 12 };
  }), []);
});

test('ids are lower-case words joined by dots or dashes', () => {
  for (const id of ['Ember', 'ember bolt', 'ember_bolt', '.ember', 'ember.', 'ember..bolt', 'émber']) {
    expectOne((pick) => { pick('trait').id = id; pick('zone').events[0].traits = [id]; }, new RegExp(`^trait ${id.replace(/\./g, '\\.')}: id "`));
  }
  assert.deepEqual(problems((pick) => { pick('trait').id = 'swift-2.b'; pick('zone').events[0].traits = ['swift-2.b']; }), []);
});

test('links between definitions must lead somewhere', () => {
  expectOne((pick) => { pick('class').startSigil = 'frost'; }, /^class warden: startSigil names the sigil "frost", and there is none$/);
  expectOne((pick) => { pick('class').startGear = ['old-blade', 'new-blade']; }, /^class warden: startGear\[1\] names the base "new-blade"/);
  expectOne((pick) => { pick('zone').timeline[0].pool[0].enemy = 'ghoul'; }, /^zone ossuary: timeline\[0\]\.pool\[0\]\.enemy names the enemy "ghoul"/);
  expectOne((pick) => { pick('zone').events[2].boss = 'rotter'; }, /^zone ossuary: events\[2\]\.boss names the boss "rotter"/);
  expectOne((pick) => { pick('zone').next = 'nowhere'; }, /^zone ossuary: next names the zone "nowhere"/);
  expectOne((pick) => { pick('zone').tileset = 'sand'; }, /^zone ossuary: tileset names the tileset "sand"/);
  expectOne((pick) => { pick('prop').puppet = 'statue'; }, /^prop pillar: puppet names the puppet "statue"/);
  expectOne((pick) => { pick('unique').base = 'mace'; }, /^unique tollkeeper: base names the base "mace"/);
  expectOne((pick) => { pick('deed').reward.currency = { gold: 1 }; }, /^deed first-toll: reward\.currency\.gold \(the key\) names the currency "gold"/);
  expectOne((pick) => { pick('treeSkeleton').starts = { rogue: { sector: 1 } }; }, /^treeSkeleton rose: starts\.rogue \(the key\) names the class "rogue"/);
  expectOne((pick) => { pick('legacyNode').requires = ['second-light']; }, /^legacyNode first-light: requires\[0\] names the legacyNode "second-light"/);
  expectOne((pick) => { pick('mode').zones = ['ossuary', 'crypt']; }, /^mode trial: zones\[1\] names the zone "crypt"/);
  expectOne((pick) => { pick('enemy').attacks[0] = 'gnaw'; }, /^enemy rotter: attacks\[0\] names the attack "gnaw"/);
});

test('a link into a kind that has no definitions yet is not checked', () => {
  // without the sample's puppets, tilesets and deeds, the same links pass: that part of the game is not there
  const found = problems((pick, defs) => {
    for (let i = defs.length - 1; i >= 0; i--) if (['puppet', 'tileset', 'deed'].includes(defs[i][0])) defs.splice(i, 1);
    pick('class').puppet = 'not-made-yet';
    pick('zone').tileset = 'not-made-yet';
    pick('class').unlock = 'not-made-yet';
  });
  assert.deepEqual(found, []);
});

test('every stat, tag and condition inside a modifier is checked against the tables', () => {
  expectOne((pick) => { pick('sigil').mods[0].stat = 'chance.ignit'; }, /^sigil ember: mods\[0\]\.stat "chance\.ignit" is not a stat$/);
  expectOne((pick) => { pick('sigil').mods.push(mod('damage', 'inc', 5, { tags: ['fire', 'fiery'] })); }, /^sigil ember: mods\[1\]\.tags\[1\] "fiery" is not a tag$/);
  expectOne((pick) => { pick('sigil').mods.push(mod('damage', 'inc', 5, { cond: 'onFire' })); }, /^sigil ember: mods\[1\]\.cond "onFire" is not a condition$/);
  expectOne((pick) => { pick('sigil').mods.push(mod('damage', 'plus', 5)); }, /^sigil ember: mods\[1\]\.op "plus" is not one of flat, inc, more, set$/);
  expectOne((pick) => { pick('sigil').mods.push(mod('damage', 'inc', 5, { tag: ['fire'] })); }, /^sigil ember: mods\[1\]\.tag is not a field of this shape$/);
  expectOne((pick) => { pick('sigil').mods.push(mod('damage', 'inc', 5, { per: { stat: 'life', div: 10 } })); }, /^sigil ember: mods\[1\]\.per\.stat "life" is not something a per modifier can count$/);
  expectOne((pick) => { pick('sigil').mods.push(mod('damage', 'inc', 5, { per: { stat: 'str', div: 0 } })); }, /^sigil ember: mods\[1\]\.per\.div must be above 0$/);
  expectOne((pick) => { pick('sigil').mods.push(mod('damage', 'inc', '5')); }, /^sigil ember: mods\[1\]\.value must be a number or \{a, b, curve\}, not "5"$/);
  expectOne((pick) => { pick('sigil').mods.push(mod('damage', 'inc', 5, { local: 1 })); }, /^sigil ember: mods\[1\]\.local must be true or false, not 1$/);
  // deeper places: an aura's enemy modifiers, a cluster node, a calling node, a class's base, an affix tier, a unique
  expectOne((pick) => { pick('vow').aura.enemyMods[0].stat = 'takn'; }, /^vow vigilance: aura\.enemyMods\[0\]\.stat "takn" is not a stat$/);
  expectOne((pick) => { pick('cluster').nodes[2].mods[0].tags = ['burning']; }, /^cluster embers: nodes\[2\]\.mods\[0\]\.tags\[0\] "burning" is not a tag$/);
  expectOne((pick) => { pick('calling').nodes[1].mods[0].cond = 'standing'; }, /^calling bulwark: nodes\[1\]\.mods\[0\]\.cond "standing" is not a condition$/);
  expectOne((pick) => { pick('class').base[0].stat = 'life'; }, /^class warden: base\[0\]\.stat "life" is not a stat$/);
  expectOne((pick) => { pick('treeSkeleton').pathMods[0].stat = 'hp'; }, /^treeSkeleton rose: pathMods\[0\]\.stat "hp" is not a stat$/);
  expectOne((pick) => { pick('affix').tiers[1].mods[0].tags = ['atack']; }, /^affix of-embers: tiers\[1\]\.mods\[0\]\.tags\[0\] "atack" is not a tag$/);
  expectOne((pick) => { pick('unique').mods[0].cond = 'recentkill'; }, /^unique tollkeeper: mods\[0\]\.cond "recentkill" is not a condition$/);
  expectOne((pick) => { pick('base').implicit[0].stat = 'crit'; }, /^base old-blade: implicit\[0\]\.stat "crit" is not a stat$/);
  expectOne((pick) => { pick('chime').mods[0].tags = ['spells']; }, /^chime quickening: mods\[0\]\.tags\[0\] "spells" is not a tag$/);
  expectOne((pick) => { pick('trait').mods[0].stat = 'movespeed'; }, /^trait swift: mods\[0\]\.stat "movespeed" is not a stat$/);
  expectOne((pick) => { pick('legacyNode').mods[0].op = 'add'; }, /^legacyNode first-light: mods\[0\]\.op "add" is not one of/);
  // other fields that name table rows
  expectOne((pick) => { pick('sigil').tags.push('magic'); }, /^sigil ember: tags\[3\] "magic" is not a tag$/);
  expectOne((pick) => { pick('sigil').attr = 'wis'; }, /^sigil ember: attr "wis" is not an attribute$/);
  expectOne((pick) => { pick('sigil').damage = { frost: [1, 2] }; }, /^sigil ember: damage\.frost \(the key\) "frost" is not a damage type$/);
  expectOne((pick) => { pick('sigil').weapon = ['club']; }, /^sigil ember: weapon\[0\] "club" is not a weapon family$/);
  expectOne((pick) => { pick('binding').requires = ['projectiles']; }, /^binding split: requires\[0\] "projectiles" is not a tag$/);
  expectOne((pick) => { pick('enemy').res = { holy: 10 }; }, /^enemy rotter: res\.holy \(the key\) "holy" is not a damage type$/);
  expectOne((pick) => { pick('enemy').attacks[1].ailment = 'rot'; }, /^enemy rotter: attacks\[1\]\.ailment "rot" is not an ailment$/);
  expectOne((pick) => { pick('base').req = { level: 2, wis: 4 }; }, /^base old-blade: req\.wis \(the key\) "wis" is not an attribute$/);
  expectOne((pick) => { pick('class').perLevel.mana = 3; }, /^class warden: perLevel\.mana \(the key\) "mana" is not an attribute$/);
  expectOne((pick) => { pick('chime').requires.tags = ['spell', 'sorcery']; }, /^chime quickening: requires\.tags\[1\] "sorcery" is not a tag$/);
});

test('what a spec cannot say about a modifier: pairs, gains and ranges', () => {
  expectOne((pick) => { pick('sigil').mods.push(mod('lifeMax', 'flat', [1, 2])); }, /^sigil ember: mods\[1\]\.value is a pair, but lifeMax is a single number$/);
  expectOne((pick) => { pick('sigil').mods.push(mod('gainAsExtra.cold', 'flat', 10)); }, /^sigil ember: mods\[1\]\.from is missing: gainAsExtra\.cold is gained from another damage type$/);
  expectOne((pick) => { pick('sigil').mods.push(mod('gainAsExtra.cold', 'flat', 10, { from: 'cold' })); }, /^sigil ember: mods\[1\]\.from is the type the damage is gained as$/);
  expectOne((pick) => { pick('sigil').mods.push(mod('gainAsExtra.cold', 'flat', 10, { from: 'frost' })); }, /^sigil ember: mods\[1\]\.from "frost" is not a damage type$/);
  expectOne((pick) => { pick('sigil').mods.push(mod('damage', 'inc', 10, { from: 'fire' })); }, /^sigil ember: mods\[1\]\.from belongs only on a stat gained from another damage type, not on damage$/);
  expectOne((pick) => { pick('sigil').mods.push(mod('added.fire', 'flat', [1, 2, 3])); }, /^sigil ember: mods\[1\]\.value must hold 2 entries, not 3$/);
  expectOne((pick) => { pick('unique').mods[0].min = 30; }, /^unique tollkeeper: mods\[0\]\.min is above max$/);
  expectOne((pick) => { pick('unique').mods[0].max = [1, 2]; }, /^unique tollkeeper: mods\[0\]\.max must be a pair exactly when min is one$/);
  expectOne((pick) => { pick('base').implicit[0].min = [1, 2]; pick('base').implicit[0].max = [2, 3]; }, /^base old-blade: implicit\[0\]\.min is a pair, but critChance is a single number$/);
  expectOne((pick) => { pick('unique').mods.push({ stat: 'gainAsExtra.fire', op: 'flat', min: 5, max: 10 }); }, /^unique tollkeeper: mods\[1\]\.from is missing: gainAsExtra\.fire/);
  assert.deepEqual(problems((pick) => { pick('unique').mods.push({ stat: 'gainAsExtra.fire', op: 'flat', min: 5, max: 10, from: 'physical' }); }), [],
    'a rolled modifier may be a gain as well');
  expectOne((pick) => { delete pick('unique').mods[0].max; }, /^unique tollkeeper: mods\[0\]\.max is missing$/);
  expectOne((pick) => { pick('unique').mods[0].value = 5; }, /^unique tollkeeper: mods\[0\]\.value is not a field of this shape$/);
});

test('scaled values are a number or {a, b, curve}', () => {
  expectOne((pick) => { pick('sigil').rate = { a: 1, b: 2, curve: 'cubic' }; }, /^sigil ember: rate\.curve "cubic" is not one of lin, exp$/);
  expectOne((pick) => { pick('sigil').rate = { a: 1, curve: 'lin' }; }, /^sigil ember: rate\.b is missing$/);
  expectOne((pick) => { pick('sigil').rate = { a: 0, b: 5, curve: 'exp' }; }, /^sigil ember: rate has an exp curve, which needs a and b on the same side of 0$/);
  expectOne((pick) => { pick('sigil').rate = { a: -2, b: 5, curve: 'exp' }; }, /needs a and b on the same side of 0$/);
  expectOne((pick) => { pick('sigil').rate = [1, 2]; }, /^sigil ember: rate must be a number or \{a, b, curve\}, not \[1,2\]$/);
  expectOne((pick) => { pick('sigil').damage.fire[1] = '80'; }, /^sigil ember: damage\.fire\[1\] must be a number or \{a, b, curve\}, not "80"$/);
  expectOne((pick) => { pick('sigil').params.count = { a: 1, b: 3, curve: 'lin', step: 1 }; }, /^sigil ember: params\.count\.step is not a field of this shape$/);
  assert.deepEqual(problems((pick) => { pick('sigil').rate = { a: -1, b: -5, curve: 'exp' }; pick('sigil').weaponPct = { a: 50, b: 150, curve: 'lin' }; }), []);
});

test('a definition must be what JSON can carry', () => {
  expectOne((pick) => { pick('sigil').cast = function () {}; }, /^sigil ember: cast is a function, which JSON cannot carry$/);
  expectOne((pick) => { pick('sigil').params.count = undefined; }, /^sigil ember: params\.count is undefined, which JSON cannot carry$/);
  expectOne((pick) => { pick('sigil').eff = NaN; }, /^sigil ember: eff is NaN, which JSON cannot carry$/);
  expectOne((pick) => { pick('enemy').life = Infinity; }, /^enemy rotter: life is Infinity, which JSON cannot carry$/);
  expectOne((pick) => { pick('sigil').fx.made = new Date(0); }, /^sigil ember: fx\.made is not a plain object, so JSON would change it$/);
  expectOne((pick) => { pick('sigil').fx.seen = new Map(); }, /^sigil ember: fx\.seen is not a plain object/);
  expectOne((pick) => { pick('zone').rules.big = 10n; }, /^zone ossuary: rules\.big is bigint, which JSON cannot carry$/);
  expectOne((pick) => { pick('enemy').aiParams.self = pick('enemy'); }, /^enemy rotter: aiParams\.self holds itself, which JSON cannot carry$/);
  expectOne((pick) => { pick('cluster').nodes[1].mods[0].value = () => 5; }, /^cluster embers: nodes\[1\]\.mods\[0\]\.value is a function/);
  // the same object used in two places is fine: it is frozen anyway
  assert.deepEqual(problems((pick) => { const shared = ['fire']; pick('cluster').theme = shared; pick('cluster').nodes[0].mods[0].tags = shared; }), []);
});

test('keys and links inside one definition', () => {
  expectOne((pick) => { pick('cluster').entry = 'z'; }, /^cluster embers: entry "z" is not the key of one of its nodes$/);
  expectOne((pick) => { pick('cluster').nodes[2].key = 'a'; }, /^cluster embers: nodes has two nodes with the key "a"$/);
  expectOne((pick) => { pick('calling').nodes[1].requires = ['a', 'q']; }, /^calling bulwark: nodes\[1\]\.requires "q" is not the key of another of its nodes$/);
  expectOne((pick) => { pick('calling').nodes[1].requires = ['b']; }, /^calling bulwark: nodes\[1\]\.requires "b" is not the key of another of its nodes$/);
  expectOne((pick) => { pick('legacyNode').cost = [10, 20]; }, /^legacyNode first-light: cost must hold one cost for each of its 3 ranks, not 2$/);
  expectOne((pick) => { pick('boss').phases[0].loop[0] = 'stomp'; }, /^boss keeper: phases\[0\]\.loop\[0\] "stomp" is not one of its attacks$/);
  expectOne((pick) => { pick('boss').phases[1].onEnter = ['roar']; }, /^boss keeper: phases\[1\]\.onEnter\[0\] "roar" is not one of its attacks$/);
  expectOne((pick) => { pick('enemy').attacks[1].id = 'bite'; }, /^enemy rotter: attacks has two attacks with the id "bite"$/);
  expectOne((pick) => { pick('puppet').parts[1].parent = 'spine'; }, /^puppet debug\.husk: parts\[1\]\.parent "spine" is not the key of another of its parts$/);
  expectOne((pick) => { pick('puppet').parts[1].color = 'gold'; }, /^puppet debug\.husk: parts\[1\]\.color "gold" is not in its palette$/);
  expectOne((pick) => { pick('puppet').parts.push(Object.assign({}, pick('puppet').parts[0])); }, /^puppet debug\.husk: parts has two parts with the key "torso"$/);
  expectOne((pick) => { pick('mode').xpCurve = 'heroXp'; }, /^mode trial: xpCurve "heroXp" is not a list in the curves "main"$/);
});

test('a class and its callings name each other, and an enemy and a boss never share an id', () => {
  const both = problems((pick) => { pick('calling', 'reaver').class = 'reaper'; });
  assert.equal(both.length, 2);
  assert.match(both.join('\n'), /^class warden: callings\[1\] "reaver" belongs to the class "reaper"$/m);
  assert.match(both.join('\n'), /^calling reaver: class names the class "reaper", and there is none$/m);
  // a class that drops a calling which still names it
  const dropped = problems((pick) => { pick('class').callings = ['bulwark']; });
  assert.deepEqual(dropped, ['class warden: callings must hold 2 entries, not 1', 'calling reaver: class "warden" does not list this calling']);
  expectOne((pick) => { pick('boss').id = 'rotter'; pick('zone').boss = 'rotter'; pick('zone').events[2].boss = 'rotter'; },
    /^boss rotter: id is also the id of an enemy; the two share one pool and need different ids$/);
});

test('a union reports the form the value came closest to', () => {
  expectOne((pick) => { pick('mode').calling = { levels: [15, 'thirty'] }; }, /^mode trial: calling\.levels\[1\] must be a number, not "thirty"$/);
  expectOne((pick) => { pick('mode').calling = { afterBoss: 1 }; }, /^mode trial: calling\.pointsPerBoss is missing$/);
  expectOne((pick) => { pick('boss').phases[0].loop[1] = { wait: -1 }; }, /^boss keeper: phases\[0\]\.loop\[1\]\.wait must be at least 0, not -1$/);
  expectOne((pick) => { pick('enemy').attacks[1].mult = 'double'; }, /^enemy rotter: attacks\[1\]\.mult must be a number, not "double"$/);
});

// ---- growing the schema ----

test('allow adds a word to a list, for content to name what a registry holds', () => {
  expectOne((pick) => { pick('enemy').ai = 'flanker'; }, /^enemy rotter: ai "flanker" is not one of chase, /);
  assert.deepEqual(problems((pick, defs, sim) => {
    sim.Defs.allow('ai', 'flanker', 'chase', 'burrower');
    pick('enemy').ai = 'flanker';
    assert.deepEqual(plain(sim.Defs.ENUMS.ai).slice(-2), ['flanker', 'burrower'], 'a word that is there already is not added twice');
    assert.throws(() => sim.Defs.allow('moods', 'grim'), /no word list "moods"/);
    assert.throws(() => sim.Defs.allow('ai', 7), /a word is a string/);
  }), []);
});

test('extend adds a field to a kind, or replaces its spec', () => {
  expectOne((pick) => { pick('sigil').charges = 3; }, /^sigil ember: charges is not a field of this shape$/);
  assert.deepEqual(problems((pick, defs, sim) => {
    sim.Defs.extend('sigil', { charges: { type: 'int', min: 1 }, tier: { type: 'int', min: 1, max: 9 }, note: { type: 'string', required: false } });
    pick('sigil').charges = 3;
    pick('sigil').tier = 7;
  }), []);
  expectOne((pick, defs, sim) => { sim.Defs.extend('sigil', { charges: { type: 'int', min: 1 } }); }, /^sigil ember: charges is missing$/);
  expectOne((pick, defs, sim) => { sim.Defs.extend('sigil', { charges: { type: 'int', min: 1 } }); pick('sigil').charges = 0; },
    /^sigil ember: charges must be at least 1, not 0$/);
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
    /^boss keeper: weight must be a number, not "heavy"$/);
  const { Defs } = kernel();
  assert.throws(() => Defs.extend('spell', {}), /not a kind of definition/);
  assert.throws(() => Defs.extend('sigil', { charges: 'int' }), /needs a type/);
});
