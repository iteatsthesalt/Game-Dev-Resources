// tests/sim/20-sim.test.js: the run state, the order of a step, commands, events and the debug scene (src/js/20-sim.js).
// Tests that put a stand-in system in place (a Player.step, a Director.step) load a simulation of their own:
// loadSim() gives a separate copy each time, and without {boot: true} its namespaces are still open.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');

const base = loadSim();                  // shared by the tests that add nothing to the simulation
const { Core, Sim, Stats, Defs } = base;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
const run = (S, steps, input) => { for (let i = 0; i < steps; i++) Sim.step(S, input); return S; };
const live = (pool) => Array.from(pool.items.slice(0, pool.n));      // the entities in use, as an array of this context
const events = (S) => Array.from({ length: S.eventCount }, (unused, i) => plain(S.events[(S.eventStart + i) % S.events.length]));
const idle = { mx: 0, my: 0, ax: 1, ay: 0, aim: false, dodge: false, draught: false };
const STATE = ['cfg', 'mode', 'zone', 'rules', 'curves', 'rng', 'step', 't', 'toll', 'tollAt', 'tollSteps', 'threat', 'phase', 'player', 'mods',
  'sheet', 'skills', 'enemies', 'shots', 'areas', 'pickups', 'minions', 'grid', 'region', 'props', 'gate', 'boss', 'offer', 'offerQueue', 'chimes',
  'buffs', 'events', 'eventCount', 'eventStart', 'eventsDropped', 'haul', 'gold', 'echoes', 'kills', 'counters', 'dirty', 'result', 'uid', 'debug'];

// ---- a new run ----

test('a new run has the state the header of 20-sim.js lists, and nothing else', () => {
  const cfg = { mode: 'watch', zone: 'debug', seed: 5, char: null, account: null };
  const S = Sim.create(cfg);
  assert.deepEqual(Object.keys(S).sort(), STATE.slice().sort());
  assert.equal(S.cfg, cfg);
  assert.equal(S.mode, Defs.get('mode', 'watch'));
  assert.equal(S.zone, Defs.get('zone', 'debug'));
  assert.equal(S.curves, Defs.get('curves', 'main'));
  assert.deepEqual([S.step, S.t, S.toll, S.threat, S.phase, S.uid], [0, 0, 0, 0, 'play', 0]);
  assert.deepEqual([S.gate, S.boss, S.offer, S.result, S.debug, S.dirty], [null, null, null, null, null, false]);
  assert.deepEqual([S.gold, S.echoes, S.kills, S.eventCount, S.eventStart, S.eventsDropped], [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(plain([S.offerQueue, S.chimes, S.buffs, S.haul, S.counters, S.skills, S.mods]), [[], {}, [], [], {}, [], []]);
  assert.deepEqual([S.enemies.cap, S.shots.cap, S.areas.cap, S.pickups.cap, S.minions.cap], [600, 500, 120, 400, 40], 'the hard caps');
  assert.deepEqual([S.enemies.n, S.shots.n, S.areas.n, S.pickups.n, S.minions.n], [0, 0, 0, 0, 0]);
  assert.equal(S.events.length, 2048);
  assert.equal(S.props, S.region.props);
  assert.equal(S.region.radius, 60);
  assert.equal(S.grid.cell, 2);
  assert.equal(Sim.create({ zone: 'debug', seed: 5 }).mode.id, 'watch', 'the mode defaults to the watch');
});

test('the rules of a run are the constants, overruled by the zone and by the cfg', () => {
  const S = Sim.create({ zone: 'debug', seed: 1 });
  const main = Defs.get('constants', 'main');
  assert.deepEqual([S.rules.spawnRadius, S.rules.despawnRadius, S.rules.tollSeconds, S.rules.keeperToll, S.rules.gateEvery, S.rules.gateOpenSeconds,
    S.rules.gateHoldSeconds], [26, 34, 75, 8, 3, 25, 3]);
  assert.equal(S.rules.id, undefined);
  assert.equal(S.rules.caps, main.caps);
  assert.deepEqual([S.tollSteps, S.tollAt], [4500, 4500]);
  const fast = Sim.create({ zone: 'debug', seed: 1, rules: { tollSeconds: 2, caps: { enemies: 8, shots: 4, areas: 2, pickups: 3, minions: 1, events: 16 } } });
  assert.deepEqual([fast.tollSteps, fast.enemies.cap, fast.shots.cap, fast.areas.cap, fast.pickups.cap, fast.minions.cap, fast.events.length],
    [120, 8, 4, 2, 3, 1, 16]);
  assert.equal(main.tollSeconds, 75, 'the definition itself is untouched');
  // a zone's own toll numbers and its rules come before the constants
  const sim = loadSim();
  sim.Defs.add('zone', Object.assign({}, plain(sim.Defs.get('zone', 'debug')), { id: 'quick', tollSeconds: 30, keeperToll: 5, rules: { spawnRadius: 12 } }));
  const quick = sim.Sim.create({ zone: 'quick', seed: 1 });
  assert.deepEqual([quick.rules.tollSeconds, quick.rules.keeperToll, quick.rules.gateEvery, quick.rules.spawnRadius, quick.tollSteps], [30, 5, 3, 12, 1800]);
  assert.equal(sim.Sim.create({ zone: 'quick', seed: 1, rules: { tollSeconds: 10 } }).rules.tollSeconds, 10, 'the cfg has the last word');
  assert.throws(() => Sim.create({ zone: 'debug', seed: 1, rules: { gridCell: 0 } }), /needs the constant gridCell/);
  assert.throws(() => Sim.create({ zone: 'debug', seed: 1, rules: { caps: { enemies: 5 } } }), /needs the constant caps\.shots/);
});

test('a run needs a seed and a zone that exists', () => {
  assert.throws(() => Sim.create({ zone: 'debug' }), /Sim\.create needs cfg\.seed/);
  assert.throws(() => Sim.create({ zone: 'debug', seed: null }), /cfg\.seed/);
  assert.throws(() => Sim.create(), /cfg\.seed/);
  assert.throws(() => Sim.create({ zone: 'nowhere', seed: 1 }), /there is no zone "nowhere"/);
  assert.throws(() => Sim.create({ seed: 1 }), /there is no zone/);
  assert.throws(() => Sim.create({ zone: 'debug', seed: 1, mode: 'easy' }), /there is no mode "easy"/);
  assert.equal(Sim.create({ zone: 'debug', seed: 'a word' }).phase, 'play', 'a string is a seed too');
});

test('the five random streams are forks of the seed', () => {
  const S = Sim.create({ zone: 'debug', seed: 99 }), root = new Core.RNG(99);
  assert.deepEqual(Object.keys(S.rng), ['spawn', 'loot', 'combat', 'offers', 'world']);
  for (const name of ['spawn', 'loot', 'combat', 'offers']) assert.deepEqual(plain(S.rng[name].getState()), plain(root.fork(name).getState()), name);
  const world = root.fork('world');
  world.u32();                                         // the region took one number for its own seed
  assert.deepEqual(plain(S.rng.world.getState()), plain(world.getState()));
  const states = new Set(Object.values(S.rng).map((r) => r.getState().join()));
  assert.equal(states.size, 5, 'no two streams are alike');
  const other = Sim.create({ zone: 'debug', seed: 100 });
  assert.notDeepEqual(plain(other.rng.loot.getState()), plain(S.rng.loot.getState()));
});

test('the player starts at the middle of the region with what the sheet gives', () => {
  const S = Sim.create({ zone: 'debug', seed: 5, mods: [{ stat: 'lifeMax', op: 'flat', value: 40 }, { stat: 'hushMax', op: 'flat', value: 25 }, { stat: 'draughtCharges', op: 'flat', value: 1 }] });
  const p = S.player;
  assert.deepEqual([p.alive, p.uid, p.x, p.y, p.r, p.aimX, p.aimY], [true, 0, S.region.x, S.region.y, 0.4, 1, 0]);
  assert.deepEqual([p.life, p.hush, p.draughts], [100, 25, 4]);
  assert.deepEqual([S.sheet.stats.lifeMax, S.sheet.level], [100, 1]);
  assert.deepEqual(Object.keys(p), plain(Sim.fields('player')));
  assert.ok(p.condT instanceof Float64Array === false && ArrayBuffer.isView(p.condT) && p.condT.length === Stats.COND_MAX);
  assert.ok(Object.isSealed(p));
});

// ---- determinism ----

test('the same seed gives the same checksum after 600 steps, another seed another', () => {
  const walk = (i) => ({ mx: Math.cos(i / 40), my: Math.sin(i / 55), ax: 1, ay: 0, aim: false, dodge: false, draught: false });
  const play = (seed) => {
    const S = Sim.debugScene(200, seed), seen = [];
    for (let i = 0; i < 600; i++) {
      Sim.step(S, walk(i));
      if (i % 150 === 149) seen.push(Sim.hash(S));
    }
    return seen;
  };
  const a = play(11), b = play(11), c = play(12);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, 4, 'the checksum moves as the run does');
  for (let i = 0; i < 4; i++) assert.notEqual(a[i], c[i]);
  for (const h of a) assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xffffffff);
  assert.equal(Sim.hash(Sim.create({ zone: 'debug', seed: 3 })), Sim.hash(Sim.create({ zone: 'debug', seed: 3 })));
  assert.notEqual(Sim.hash(Sim.create({ zone: 'debug', seed: 3 })), Sim.hash(Sim.create({ zone: 'debug', seed: 4 })));
  assert.equal(Sim.hash(Sim.debugScene(50, 'bells')), Sim.hash(Sim.debugScene(50, 'bells')));
});

test('the checksum takes in the step, the streams, the player and every live entity', () => {
  const fresh = () => Sim.debugScene(30, 7), h0 = Sim.hash(fresh());
  const changed = (change) => { const S = fresh(); change(S); return Sim.hash(S) !== h0; };
  assert.equal(changed(() => {}), false);
  assert.ok(changed((S) => { S.step++; }));
  assert.ok(changed((S) => { S.toll++; }));
  assert.ok(changed((S) => { S.threat++; }));
  assert.ok(changed((S) => { S.phase = 'offer'; }));
  assert.ok(changed((S) => { S.kills++; }));
  assert.ok(changed((S) => { S.gold += 1; }));
  for (const name of ['spawn', 'loot', 'combat', 'offers', 'world']) assert.ok(changed((S) => { S.rng[name].next(); }), `the ${name} stream`);
  assert.ok(changed((S) => { S.player.x += 0.01; }));
  assert.ok(changed((S) => { S.player.life -= 1; }));
  assert.ok(changed((S) => { S.player.runXp += 1; }));
  assert.ok(changed((S) => { S.enemies.items[29].y += 0.002; }), 'two millimetres count');
  assert.ok(changed((S) => { S.enemies.items[3].life -= 0.5; }));
  assert.ok(changed((S) => { S.enemies.items[3].rank = 1; }));
  assert.ok(changed((S) => { S.enemies.kill(S.enemies.items[3]); }));
  assert.ok(changed((S) => { Sim.spawnEnemy(S, 'debug.husk', 1, 1); }));
  assert.ok(changed((S) => { const shot = S.shots.alloc(); shot.ttl = 1; }));
  assert.ok(changed((S) => { const pickup = S.pickups.alloc(); pickup.ttl = 9; pickup.x = 2; }));
  assert.ok(changed((S) => { const minion = S.minions.alloc(); minion.life = 5; }));
  assert.ok(changed((S) => { const area = S.areas.alloc(); area.ttl = 2; }));
  // positions count to the millimetre: a tenth of one is noise
  const still = (dx) => { const S = fresh(); S.enemies.items[5].x = 5 + dx; return Sim.hash(S); };
  assert.equal(still(0.0001), still(0.0002));
  assert.notEqual(still(0.0001), still(0.0011));
});

// ---- entities ----

test('every pooled object of a kind has the same fields, sealed, before and after a soak', () => {
  const S = Sim.create({ zone: 'debug', seed: 21 }), rng = new Core.RNG(21);
  const pools = { enemy: S.enemies, shot: S.shots, area: S.areas, pickup: S.pickups, minion: S.minions };
  const shape = {};
  for (const [kind, pool] of Object.entries(pools)) {
    shape[kind] = Object.keys(pool.items[0]).join();
    assert.equal(shape[kind], Sim.fields(kind).join(), `${kind}: the fields Sim.fields lists, in that order`);
    assert.ok(pool.items.every((o) => Object.isSealed(o) && Object.keys(o).join() === shape[kind]), `${kind} before`);
  }
  for (let step = 0; step < 600; step++) {
    for (let i = rng.int(0, 6); i > 0; i--) Sim.spawnEnemy(S, 'debug.husk', rng.range(-20, 20), rng.range(-20, 20), { level: rng.int(1, 70), rank: rng.int(0, 3) });
    for (const pool of [S.shots, S.areas, S.pickups]) {
      const o = pool.alloc();
      if (o !== null) { o.ttl = rng.range(0, 0.5); o.x = rng.range(-5, 5); o.a0 = 1.5; }
    }
    const minion = S.minions.alloc();
    if (minion !== null) { minion.life = rng.chance(0.3) ? 0 : 5; minion.condV[2] = 0.25; }
    for (let i = 0; i < S.enemies.n; i++) if (rng.chance(0.05)) S.enemies.items[i].life = 0;
    for (let i = 0; i < S.minions.n; i++) if (rng.chance(0.3)) S.minions.items[i].life = 0;
    Sim.step(S, idle);
  }
  assert.ok(S.kills > 500 && S.uid > 3000, 'the soak spawned and killed a great deal');
  for (const [kind, pool] of Object.entries(pools)) {
    assert.ok(pool.items.every((o) => Object.isSealed(o) && Object.keys(o).join() === shape[kind]), `${kind} after`);
    assert.equal(new Set(pool.items).size, pool.cap);
    assert.ok(pool.items.slice(0, pool.n).every((o) => o.alive) && pool.items.slice(pool.n).every((o) => !o.alive), `${kind}: the live ones first`);
  }
  assert.equal(Object.keys(S.player).join(), Sim.fields('player').join());
  assert.equal(Object.keys(S).length, STATE.length, 'and the run state itself gained no field');
});

test('a field that was not declared cannot be added to an entity', () => {
  const S = Sim.create({ zone: 'debug', seed: 1 }), e = Sim.spawnEnemy(S, 'debug.husk', 0, 0);
  assert.throws(() => { e.chargeTime = 1; }, TypeError);
  assert.throws(() => { S.player.mana = 10; }, TypeError);
  assert.throws(() => { S.shots.items[0].bounce = 2; }, TypeError);
  assert.throws(() => { delete e.life; }, TypeError);
  e.a0 = 3;                                            // the free slots are there for this
  assert.equal(e.a0, 3);
});

test('alloc gives a clean entity with a new uid, however it was left', () => {
  const S = Sim.create({ zone: 'debug', seed: 1, rules: { caps: { enemies: 2, shots: 2, areas: 1, pickups: 1, minions: 1, events: 8 } } });
  Defs.has('trait', 'x');
  const e = Sim.spawnEnemy(S, 'debug.husk', 3, 4, { level: 9, rank: 2 });
  const blank = plain(S.enemies.items[1]);             // one that was never used
  assert.equal(e.uid, 1);
  Object.assign(e, { vx: 2, vy: -1, state: 4, stateT: 0.5, cd0: 1, cd3: 2, kx: 9, ky: 9, tx: 1, ty: 1, target: 77, flash: 1, a0: 1, a1: 2, a2: 3, a3: 4, traitN: 2 });
  e.condT[0] = 4; e.condV[0] = 12; e.condN[5] = 80; e.condT[15] = 1;
  e.traits[0] = { id: 'made-up' };
  e.life = 0;
  Sim.step(S, idle);
  assert.equal(S.enemies.n, 0);
  const again = S.enemies.alloc();
  assert.equal(again, e, 'the same object comes back');
  assert.equal(again.uid, 2, 'with a new uid');
  assert.deepEqual(plain(again), Object.assign(blank, { alive: true, uid: 2 }), 'and every field at its default');
  assert.equal(again.condT[0] + again.condV[0] + again.condN[5] + again.condT[15], 0);
  const shot = S.shots.alloc();
  shot.hits[0] = 5; shot.hits[7] = 9; shot.hitN = 2; shot.ttl = 0.001; shot.pierce = 3;
  const shotUid = shot.uid;
  Sim.step(S, idle);
  const reshot = S.shots.alloc();
  assert.equal(reshot, shot);
  assert.deepEqual([Array.from(reshot.hits), reshot.hitN, reshot.pierce, reshot.skill, reshot.uid > shotUid], [[0, 0, 0, 0, 0, 0, 0, 0], 0, 0, -1, true]);
  assert.equal(S.enemies.n, 0, 'an enemy that was allocated and given no life is dead in the next step');
  S.enemies.alloc();
  S.enemies.alloc();
  assert.equal(S.enemies.alloc(), null, 'a full pool gives null');
});

test('Sim.field gives every entity of a kind one more field, declared before the first run', () => {
  const sim = loadSim();
  sim.Sim.field('enemy', 'chargeT', 0);
  sim.Sim.field('enemy', 'mood', 'calm');
  sim.Sim.field('shot', 'bounces', 2);
  sim.Sim.field('player', 'rooted', false);
  sim.Sim.field('skill', 'echo', null);
  assert.throws(() => sim.Sim.field('enemy', 'chargeT', 0), /enemy already has a field "chargeT"/);
  assert.throws(() => sim.Sim.field('enemy', 'life', 0), /already has a field "life"/);
  assert.throws(() => sim.Sim.field('ghost', 'x', 0), /"ghost" is not a kind of entity/);
  assert.throws(() => sim.Sim.field('enemy', 'path', []), /must be a number, a boolean, a string or null/);
  assert.throws(() => sim.Sim.field('enemy', 'brain', () => 0), /must be a number/);
  assert.ok(sim.Sim.fields('enemy').includes('chargeT') && !sim.Sim.fields('minion').includes('chargeT'));
  assert.throws(() => sim.Sim.fields('ghost'), /not a kind of entity/);

  const S = sim.Sim.create({ zone: 'debug', seed: 1, sigils: [] });
  assert.ok(S.enemies.items.every((e) => e.chargeT === 0 && e.mood === 'calm' && Object.isSealed(e)));
  assert.ok(S.shots.items.every((s) => s.bounces === 2));
  assert.equal(S.player.rooted, false);
  const e = sim.Sim.spawnEnemy(S, 'debug.husk', 0, 0);
  e.chargeT = 1.5; e.mood = 'angry'; e.life = 0;
  sim.Sim.step(S, idle);
  const again = S.enemies.alloc();
  assert.deepEqual([again === e, again.chargeT, again.mood], [true, 0, 'calm'], 'an added field is reset like the built-in ones');
  assert.throws(() => sim.Sim.field('enemy', 'late', 0), /fields are fixed once a run exists/);
  assert.throws(() => sim.Sim.state('late', () => 0), /slots are fixed once a run exists/);
  assert.deepEqual(plain(Sim.fields('enemy')).includes('chargeT'), false, 'another copy of the simulation knows nothing of it');
});

test('Sim.state gives every run a slot of its own, and Sim.source adds modifiers to every rebuild', () => {
  const sim = loadSim(), order = [];
  sim.Sim.state('director', (S) => { order.push('director'); return { budget: S.rules.spawnRadius, seen: S.player.alive && S.enemies.cap }; });
  sim.Sim.state('offers', () => { order.push('offers'); return { queue: [] }; });
  assert.throws(() => sim.Sim.state('offers', () => 0), /two slots named "offers"/);
  assert.throws(() => sim.Sim.state('x'), /needs a name and a function/);
  sim.Sim.source((S, out) => { out.push({ stat: 'lifeMax', op: 'flat', value: 10 * (S.chimes.sturdy || 0) }); });
  sim.Sim.source((S, out) => { for (const buff of S.buffs) out.push(...buff.mods); });
  assert.throws(() => sim.Sim.source('mods'), /needs a function/);

  const A = sim.Sim.create({ zone: 'debug', seed: 1, mods: [{ stat: 'lifeMax', op: 'flat', value: 5 }] }), B = sim.Sim.create({ zone: 'debug', seed: 2 });
  assert.deepEqual(order, ['director', 'offers', 'director', 'offers'], 'in the order they were declared, once for each run');
  assert.deepEqual(plain(A.director), { budget: 26, seen: 600 }, 'the pools and the player are there when a slot is made');
  assert.notEqual(A.offers, B.offers);
  assert.equal(A.sheet.stats.lifeMax, 65);
  A.chimes.sturdy = 3;
  A.buffs.push({ id: 'vigour', mods: [{ stat: 'lifeMax', op: 'inc', value: 100 }] });
  A.dirty = true;
  sim.Sim.step(A, idle);
  assert.equal(A.sheet.stats.lifeMax, 190, '(60 + 5 + 30) * 2');
  assert.equal(A.sheet.primaries.chimes, 3, 'the stacks of chimes are what a per modifier counts');
  assert.equal(A.mods.length, 3);
  assert.equal(B.sheet.stats.lifeMax, 60);
});

// ---- events ----

test('emit fills reused event objects, and each step starts with an empty queue', () => {
  const S = Sim.create({ zone: 'debug', seed: 1 }), first = S.events[0];
  Sim.emit(S, 'hit', 1.5, -2, 30, 1, 'ember');
  Sim.emit(S, 'cast');
  assert.equal(S.eventCount, 2);
  assert.equal(S.events[0], first, 'the objects of the ring are reused');
  assert.deepEqual(events(S), [{ k: 'hit', x: 1.5, y: -2, a: 30, b: 1, id: 'ember' }, { k: 'cast', x: 0, y: 0, a: 0, b: 0, id: null }]);
  assert.equal(Sim.step(S, idle), true);
  assert.equal(S.eventCount, 0, 'a step empties the queue before anything else');
  Sim.emit(S, 'drop', 0, 0, 0, 0, 7);
  S.phase = 'offer';
  assert.equal(Sim.step(S, idle), false);
  assert.equal(S.eventCount, 1, 'a step that does not run leaves the queue alone');
  Sim.command(S, { type: 'skip' });
  assert.equal(S.eventCount, 0, 'a command empties it too');
});

test('when more events are emitted than the ring holds, the oldest give way and are counted', () => {
  const S = Sim.create({ zone: 'debug', seed: 1, rules: { caps: Object.assign({}, plain(Defs.get('constants', 'main').caps), { events: 8 }) } });
  for (let i = 0; i < 8; i++) Sim.emit(S, 'hit', i, 0, i);
  assert.deepEqual([S.eventCount, S.eventStart, S.eventsDropped], [8, 0, 0], 'exactly full is not too full');
  assert.deepEqual(events(S).map((e) => e.a), [0, 1, 2, 3, 4, 5, 6, 7]);
  for (let i = 8; i < 21; i++) Sim.emit(S, 'hit', i, 0, i);
  assert.deepEqual([S.eventCount, S.eventsDropped], [8, 13]);
  assert.deepEqual(events(S).map((e) => e.a), [13, 14, 15, 16, 17, 18, 19, 20], 'read from eventStart, the newest eight are in order');
  assert.equal(S.events.length, 8, 'the ring did not grow');
  Sim.step(S, idle);
  assert.deepEqual([S.eventCount, S.eventStart, S.eventsDropped], [0, 0, 13], 'the next step starts afresh; the count of losses stays');
  assert.equal(Sim.result(S).eventsDropped, 13);
});

// ---- the clock ----

test('a toll rings every tollSeconds, with an event in the step it rings', () => {
  const S = Sim.create({ zone: 'debug', seed: 1 });
  run(S, 4499, idle);
  assert.deepEqual([S.step, S.toll, S.eventCount], [4499, 0, 0]);
  near(S.t, 4499 / 60);
  Sim.step(S, idle);
  assert.deepEqual([S.step, S.t, S.toll, S.tollAt], [4500, 75, 1, 9000], '75 seconds are 4500 steps');
  assert.deepEqual(events(S), [{ k: 'toll', x: 0, y: 0, a: 1, b: 0, id: null }]);
  Sim.step(S, idle);
  assert.deepEqual([S.toll, S.eventCount], [1, 0]);
  run(S, 4498, idle);
  assert.equal(S.toll, 1);
  Sim.step(S, idle);
  assert.deepEqual([S.step, S.toll], [9000, 2]);
  assert.equal(events(S)[0].a, 2);

  const quick = Sim.create({ zone: 'debug', seed: 1, rules: { tollSeconds: 0.5 } }), rung = [];
  for (let i = 0; i < 100; i++) { Sim.step(quick, idle); if (quick.eventCount > 0) rung.push(quick.step); }
  assert.deepEqual(rung, [30, 60, 90]);
  assert.equal(quick.threat, 0, 'the threat tier is the director\'s to raise');
});

test('a step does nothing while an offer is open or after the end', () => {
  for (const phase of ['offer', 'ended']) {
    const S = run(Sim.debugScene(40, 3), 50, idle);
    S.phase = phase;
    const before = Sim.hash(S), x = S.enemies.items[0].x;
    for (let i = 0; i < 30; i++) assert.equal(Sim.step(S, { mx: 1, my: 0, ax: 1, ay: 0, aim: false, dodge: true, draught: true }), false);
    assert.deepEqual([S.step, S.t, Sim.hash(S), S.enemies.items[0].x, S.player.x], [50, 50 / 60, before, x, 0], phase);
  }
  const S = run(Sim.debugScene(40, 3), 50, idle);
  assert.equal(Sim.step(S), true, 'in play it runs, also with no input at all');
  assert.equal(S.step, 51);
  assert.deepEqual(plain(Sim.NO_INPUT), idle);
  assert.ok(Object.isFrozen(Sim.NO_INPUT));
});

// ---- the order of a step ----

function withSystems() {
  const sim = loadSim(), calls = [];
  sim.Player.step = (S, input) => { calls.push('Player.step'); sim.seen.input = input; };
  sim.Director.step = () => { calls.push('Director.step'); };
  sim.Enemies.step = () => { calls.push('Enemies.step'); };
  sim.Skills.step = () => { calls.push('Skills.step'); };
  sim.Boss.step = () => { calls.push('Boss.step'); };
  sim.Dmg.tick = () => { calls.push('Dmg.tick'); };
  sim.Director.onKill = (S, e) => { calls.push('Director.onKill'); };
  sim.Player.pickups = () => { calls.push('Player.pickups'); };
  sim.Offers.step = () => { calls.push('Offers.step'); };
  sim.seen = {};
  sim.calls = calls;
  return sim;
}

test('a step calls the systems that exist, in the one fixed order', () => {
  const sim = withSystems(), S = sim.Sim.create({ zone: 'debug', seed: 1 }), input = { mx: 0.5, my: 0, ax: 1, ay: 0, aim: false, dodge: false, draught: false };
  sim.Sim.step(S, input);
  assert.deepEqual(sim.calls, ['Player.step', 'Director.step', 'Enemies.step', 'Skills.step', 'Boss.step', 'Player.pickups', 'Offers.step']);
  assert.equal(sim.seen.input, input, 'the input goes to the player');
  sim.calls.length = 0;
  sim.Sim.step(S);
  assert.equal(sim.seen.input, sim.Sim.NO_INPUT, 'no input is the input of a player who does nothing');
  // damage over time ticks on every 15th step: 4 times a second
  const ticks = [];
  for (let i = 2; i < 62; i++) {
    sim.calls.length = 0;
    sim.Sim.step(S, input);
    if (sim.calls.includes('Dmg.tick')) {
      ticks.push(S.step);
      assert.deepEqual(sim.calls.slice(4, 7), ['Boss.step', 'Dmg.tick', 'Player.pickups'], 'after the boss, before the deaths');
    }
  }
  assert.deepEqual(ticks, [15, 30, 45, 60]);
});

test('what this file does itself sits at fixed places between the systems', () => {
  const sim = withSystems(), S = sim.Sim.create({ zone: 'debug', seed: 1, mods: [] }), out = [], note = {};
  let victim = null;
  sim.Director.step = (run) => { victim = sim.Sim.spawnEnemy(run, 'debug.husk', 3, 0); note.inGridAtDirector = run.grid.query(3, 0, 1, out); };
  sim.Enemies.step = (run) => { note.inGridAtEnemies = run.grid.query(3, 0, 1, out); };
  sim.Skills.step = (run) => { victim.life = 0; run.cfg.mods.push({ stat: 'lifeMax', op: 'flat', value: 40 }); run.dirty = true; };
  sim.Dmg.tick = (run) => { note.aliveAtTick = victim.alive && run.enemies.n === 1; };
  sim.Director.onKill = (run, e) => { note.onKill = [e === victim, e.alive, e.life, run.kills, run.eventCount]; };
  sim.Player.pickups = (run) => { note.atPickups = [run.enemies.n, victim.alive, run.dirty, run.sheet.stats.lifeMax]; };
  sim.Offers.step = (run) => { note.atOffers = [run.dirty, run.sheet.stats.lifeMax, run.step]; };
  S.step = 14;                                         // so that this step is one on which damage over time ticks
  sim.Sim.step(S, idle);
  assert.equal(note.inGridAtDirector, 0, 'the grid is rebuilt after the director, so it does not know the newcomer yet');
  assert.equal(note.inGridAtEnemies, 1, 'and before the enemies move');
  assert.equal(note.aliveAtTick, true, 'the dead are removed only after damage over time');
  assert.deepEqual(note.onKill, [true, true, 0, 1, 1], 'Director.onKill gets the enemy while it is still there, the kill already counted and told');
  assert.deepEqual(note.atPickups, [0, false, true, 60], 'pickups come after the deaths and before the sheet is rebuilt');
  assert.deepEqual(note.atOffers, [false, 100, 14], 'offers see the new sheet, and the clock has not moved yet');
  assert.equal(S.step, 15);
});

test('in a debug scene the director, the enemies and the boss stand aside', () => {
  const sim = withSystems(), S = sim.Sim.debugScene(20, 4), x = S.enemies.items[0].x;
  sim.Sim.step(S, idle);
  assert.deepEqual(sim.calls, ['Player.step', 'Skills.step', 'Player.pickups', 'Offers.step']);
  assert.notEqual(S.enemies.items[0].x, x, 'the scene\'s own rule moves the husks');
});

// ---- deaths ----

test('an enemy at no life is counted, told and removed; one that was killed outright just goes', () => {
  const S = Sim.create({ zone: 'debug', seed: 1 });
  const a = Sim.spawnEnemy(S, 'debug.husk', 1, 2, { level: 7, rank: 1 }), b = Sim.spawnEnemy(S, 'debug.husk', 3, 4), c = Sim.spawnEnemy(S, 'debug.husk', 5, 6);
  const d = Sim.spawnEnemy(S, 'debug.husk', 7, 8);
  a.life = 0;
  c.life = -5;
  S.enemies.kill(d);                                   // a despawn: no kill, no event
  S.boss = a;
  Sim.step(S, idle);
  assert.equal(S.kills, 2);
  assert.deepEqual(events(S), [
    { k: 'kill', x: 1, y: 2, a: 1, b: 7, id: 'debug.husk' },
    { k: 'kill', x: 5, y: 6, a: 0, b: 1, id: 'debug.husk' },
  ]);
  assert.equal(S.enemies.n, 1);
  assert.equal(S.enemies.items[0], b);
  assert.deepEqual([a.alive, b.alive, c.alive, d.alive], [false, true, false, false]);
  assert.equal(S.boss, null, 'the boss slot does not keep an entity that is gone');
  b.life = 0.0001;
  Sim.step(S, idle);
  assert.equal(S.enemies.n, 1, 'any life above 0 is alive');
});

test('after the dead are removed the grid knows where the living are', () => {
  const S = Sim.create({ zone: 'debug', seed: 1 }), out = [];
  const list = [];
  for (let i = 0; i < 40; i++) list.push(Sim.spawnEnemy(S, 'debug.husk', i * 3, 0));
  for (let i = 0; i < 40; i += 2) list[i].life = 0;    // removing these moves the others about in the pool
  Sim.step(S, idle);
  assert.equal(S.enemies.n, 20);
  for (let i = 1; i < 40; i += 2) {
    assert.equal(S.grid.query(i * 3, 0, 0.1, out), 1, `the enemy at ${i * 3} is found`);
    assert.equal(out[0], list[i]);
  }
  assert.equal(S.grid.query(0, 0, 0.1, out), 0);
});

test('shots, areas and pickups run out of time; minions run out of life', () => {
  const S = Sim.create({ zone: 'debug', seed: 1 });
  const shot = S.shots.alloc(), area = S.areas.alloc(), pickup = S.pickups.alloc(), forgotten = S.shots.alloc(), gone = S.pickups.alloc();
  shot.ttl = 3 / 60 + 0.001;
  area.ttl = 0.5;
  pickup.ttl = 100;
  S.pickups.kill(gone);
  const strong = S.minions.alloc(), weak = S.minions.alloc();
  strong.life = 10;
  Sim.step(S, idle);
  assert.equal(forgotten.alive, false, 'a shot nobody gave a ttl is gone at once');
  assert.deepEqual([S.shots.n, S.areas.n, S.pickups.n, S.minions.n], [1, 1, 1, 1]);
  assert.equal(weak.alive, false);
  near(shot.ttl, 2 / 60 + 0.001, 1e-9);
  run(S, 2, idle);
  assert.equal(S.shots.n, 1, 'three steps on, a thousandth of a second is left');
  Sim.step(S, idle);
  assert.equal(S.shots.n, 0);
  run(S, 25, idle);
  assert.equal(S.areas.n, 1, 'alive through its 29th step');
  Sim.step(S, idle);
  assert.equal(S.areas.n, 0, 'half a second is 30 steps, not 31');
  near(pickup.ttl, 100 - 30 / 60, 1e-9);
  assert.equal(S.kills, 0);
  assert.equal(S.eventCount, 0, 'none of this is a kill');
});

// ---- enemies ----

test('spawnEnemy fills an enemy from its def, the level curves and the rank', () => {
  const S = Sim.create({ zone: 'debug', seed: 1 }), def = Defs.get('enemy', 'debug.husk'), curves = Defs.get('curves', 'main');
  S.player.x = 10;
  const e = Sim.spawnEnemy(S, 'debug.husk', 4, 0);
  assert.deepEqual([e.alive, e.uid, e.x, e.y, e.def, e.level, e.rank, e.r, e.speed], [true, 1, 4, 0, def, 1, 0, def.radius, def.speed]);
  assert.deepEqual([e.life, e.lifeMax, e.damage, e.xp], [def.life, def.life, def.damage, def.xp], 'level 1, common: the def\'s own numbers');
  assert.equal(e.defHash, Core.hashStr('debug.husk'));
  assert.equal(e.face, 0, 'it faces the player');
  assert.equal(Sim.spawnEnemy(S, 'debug.husk', 10, 5).face, -Math.PI / 2);
  const high = Sim.spawnEnemy(S, 'debug.husk', 0, 0, { level: 30, rank: Sim.ELITE });
  const rank = curves.rank[1];
  near(high.life, def.life * curves.enemyLife[29] * rank.life);
  near(high.damage, def.damage * curves.enemyDamage[29] * rank.damage);
  near(high.xp, def.xp * curves.enemyXp[29] * rank.xp);
  near(high.r, def.radius * rank.size);
  assert.deepEqual([high.level, high.rank, high.lifeMax], [30, 1, high.life]);
  assert.ok(high.life > 50 * e.life, 'thirty levels and a rank are a great deal of life');
  assert.equal(Sim.spawnEnemy(S, 'debug.husk', 0, 0, { level: 500 }).level, 70, 'the level stays inside the curves');
  assert.equal(Sim.spawnEnemy(S, 'debug.husk', 0, 0, { level: -3 }).level, 1);
  assert.deepEqual([Sim.COMMON, Sim.ELITE, Sim.MINIBOSS, Sim.BOSS], [0, 1, 2, 3]);
  assert.throws(() => Sim.spawnEnemy(S, 'nobody', 0, 0), /there is no enemy "nobody"/);
});

test('spawnEnemy takes the zone\'s level, traits, and bosses from their own registry', () => {
  const sim = loadSim(), husk = plain(sim.Defs.get('enemy', 'debug.husk'));
  sim.Defs.add('zone', Object.assign({}, plain(sim.Defs.get('zone', 'debug')), { id: 'deep', level: 12 }));
  sim.Defs.add('boss', Object.assign({}, husk, { id: 'debug.keeper', name: 'Keeper', life: 5000, radius: 1.5, arena: { radius: 15 }, phases: [] }));
  sim.Defs.add('trait', { id: 'swift', name: 'Swift' });
  sim.Defs.add('trait', { id: 'vast', name: 'Vast' });
  assert.deepEqual(plain(sim.Defs.finalize()), []);
  const S = sim.Sim.create({ zone: 'deep', seed: 1, rules: { caps: { enemies: 3, shots: 1, areas: 1, pickups: 1, minions: 1, events: 8 } } });
  const e = sim.Sim.spawnEnemy(S, 'debug.husk', 1, 1, { traits: ['swift', 'vast'] });
  assert.equal(e.level, 12, 'the zone\'s level unless told otherwise');
  assert.deepEqual([e.traitN, e.traits[0].id, e.traits[1].id, e.traits[2], e.traits.length], [2, 'swift', 'vast', null, 4]);
  const boss = sim.Sim.spawnEnemy(S, 'debug.keeper', 0, 5);
  assert.deepEqual([boss.def.id, boss.rank, boss.r], ['debug.keeper', 3, 1.5], 'a boss is rank 3 and keeps its own size');
  near(boss.life, 5000 * sim.Defs.get('curves', 'main').enemyLife[11]);
  assert.throws(() => sim.Sim.spawnEnemy(S, 'debug.husk', 0, 0, { traits: ['slow'] }), /there is no trait "slow"/);
  S.enemies.clear();
  for (let i = 0; i < 3; i++) assert.ok(sim.Sim.spawnEnemy(S, 'debug.husk', i, 0));
  assert.equal(sim.Sim.spawnEnemy(S, 'debug.husk', 9, 9), null, 'a full pool gives null, never an error');
  assert.equal(S.enemies.n, 3);
});

// ---- sheets ----

test('the sheets are rebuilt when the run is marked dirty', () => {
  const sim = loadSim();
  sim.Defs.add('sigil', {
    id: 'spark', name: 'Spark', text: '', icon: null, attr: 'int', tier: 1, tags: ['spell', 'projectile', 'fire'], weapon: null,
    archetype: 'projectile', target: 'nearest', rate: 2, damage: { fire: [10, 20] }, weaponPct: 0, eff: 1, crit: 5, params: { speed: 12 }, mods: [], fx: {},
  });
  const mods = [{ stat: 'damage', op: 'inc', value: 50, tags: ['fire'] }], inst = { uid: 1, id: 'spark', level: 1, sockets: 2, bindings: [null, null] };
  const S = sim.Sim.create({ zone: 'debug', seed: 1, mods, sigils: [inst], level: 9 });
  const fire = sim.Stats.TYPE.fire;
  assert.equal(S.skills.length, 1);
  assert.deepEqual(Object.keys(S.skills[0]), plain(sim.Sim.fields('skill')));
  assert.equal(S.skills[0].inst, inst);
  assert.deepEqual([S.skills[0].sheet.min[fire], S.skills[0].sheet.max[fire], S.skills[0].sheet.rate, S.skills[0].cd], [15, 30, 2, 0]);
  assert.equal(S.sheet.level, 9);
  const sheet = S.sheet, skillSheet = S.skills[0].sheet;
  sim.Sim.step(S, idle);
  assert.equal(S.sheet, sheet, 'nothing changed: the sheets are kept');
  mods.push({ stat: 'damage', op: 'more', value: 100 }, { stat: 'lifeMax', op: 'more', value: -50 });
  S.dirty = true;
  sim.Sim.step(S, idle);
  assert.equal(S.dirty, false);
  assert.ok(S.sheet !== sheet && S.skills[0].sheet !== skillSheet);
  assert.deepEqual([S.skills[0].sheet.min[fire], S.sheet.stats.lifeMax], [30, 30]);
  assert.equal(S.player.life, 30, 'life never stays above its new most');
  assert.equal(S.mods.length, 3);
  S.player.conds = sim.Stats.condMask(['lowLife']);
  mods.push({ stat: 'armour', op: 'flat', value: 9, cond: 'lowLife' });
  assert.equal(sim.Sim.rebuild(S), S.sheet);
  assert.equal(S.sheet.stats.armour, 9, 'the player\'s conditions go into the sheet');
});

test('a run with a character asks Char.mods, and commands reach the character', () => {
  const sim = loadSim(), asked = [];
  sim.Defs.add('sigil', {
    id: 'spark', name: 'Spark', text: '', icon: null, attr: 'int', tier: 1, tags: ['spell'], weapon: null, archetype: 'burst', target: 'nearest',
    rate: 1, damage: {}, weaponPct: 0, eff: 0, crit: 0, params: {}, mods: [], fx: {},
  });
  const char = {
    level: 14, tree: [], activeVows: ['a', 'b'], sigils: [{ uid: 7, id: 'spark', level: 2, bindings: [] }, { uid: 8, id: 'spark', level: 5, bindings: [] }],
    loadout: [8, null, 7, null, 99, null],
  };
  const account = { gold: 3 };
  sim.Char.mods = (c, S, a) => { asked.push([c === char, typeof S.step, a === account]); return [{ stat: 'lifeMax', op: 'flat', value: 10 * c.tree.length }]; };
  sim.Char.weapon = (c) => ({ family: 'staff', damage: {}, aps: 1, crit: 5 });
  sim.Char.allocate = (c, id, choice) => { c.tree.push({ id, choice }); return true; };
  sim.Char.equip = (c, uid, slot) => uid !== 0;
  const S = sim.Sim.create({ zone: 'debug', seed: 1, char, account, mods: [{ stat: 'lifeMax', op: 'flat', value: 999 }] });
  assert.deepEqual(asked, [[true, 'number', true]]);
  assert.deepEqual([S.sheet.stats.lifeMax, S.sheet.level, S.sheet.primaries.vows, S.sheet.weapon.family], [60, 14, 2, 'staff'], 'cfg.mods is for runs without a character');
  assert.deepEqual(Array.from(S.skills, (k) => k.inst.uid), [8, 7], 'the loadout, in its order, without the empty and the unknown slots');
  assert.equal(sim.Sim.command(S, { type: 'allocate', id: 'n1', choice: 'str' }), true);
  assert.deepEqual(plain(char.tree), [{ id: 'n1', choice: 'str' }]);
  assert.deepEqual([S.sheet.stats.lifeMax, S.dirty], [70, false], 'a command that changed the character rebuilds the sheets at once');
  assert.equal(sim.Sim.command(S, { type: 'equip', uid: 0, slot: 'weapon' }), false);
  assert.equal(sim.Sim.command(S, { type: 'equip', uid: 4, slot: 'weapon' }), true);
  // without a character, or without the Char functions, those commands do nothing
  assert.equal(sim.Sim.command(sim.Sim.create({ zone: 'debug', seed: 1 }), { type: 'allocate', id: 'n1' }), false);
  const plainSim = Sim.create({ zone: 'debug', seed: 1, char: { level: 3 } });
  assert.equal(Sim.command(plainSim, { type: 'equip', uid: 1, slot: 'helm' }), false);
  assert.equal(plainSim.sheet.level, 3);
});

// ---- commands, and the end ----

test('offer commands go to Offers.resolve; without it, pick and skip close the offer', () => {
  const S = Sim.create({ zone: 'debug', seed: 1 }), first = { kind: 'chime', options: [] }, second = { kind: 'node', options: [] };
  assert.equal(Sim.command(S, { type: 'pick', index: 0 }), false, 'no offer is open');
  S.offer = first;
  S.offerQueue.push(second);
  S.phase = 'offer';
  assert.equal(Sim.command(S, { type: 'reroll' }), false, 'nothing here can reroll');
  assert.equal(Sim.command(S, { type: 'banish', index: 1 }), false);
  assert.equal(S.offer, first);
  assert.equal(Sim.command(S, { type: 'pick', index: 0 }), true);
  assert.deepEqual([S.offer, S.offerQueue.length, S.phase], [second, 0, 'offer'], 'the next offer in the queue opens');
  assert.equal(Sim.command(S, { type: 'skip' }), true);
  assert.deepEqual([S.offer, S.phase], [null, 'play']);
  assert.equal(Sim.step(S, idle), true);

  const sim = loadSim(), got = [];
  sim.Offers.resolve = (run, cmd) => { got.push(cmd.type); run.phase = 'play'; run.dirty = cmd.type === 'pick'; return cmd.type !== 'banish'; };
  const T = sim.Sim.create({ zone: 'debug', seed: 1, mods: [] });
  T.phase = 'offer';
  T.cfg.mods.push({ stat: 'lifeMax', op: 'flat', value: 5 });
  assert.equal(sim.Sim.command(T, { type: 'banish', index: 0 }), false, 'what the resolver refuses is not done');
  assert.equal(T.sheet.stats.lifeMax, 60);
  assert.equal(sim.Sim.command(T, { type: 'pick', index: 2 }), true);
  assert.equal(sim.Sim.command(T, { type: 'reroll' }), true);
  assert.equal(sim.Sim.command(T, { type: 'skip' }), true);
  assert.deepEqual(got, ['banish', 'pick', 'reroll', 'skip']);
  assert.deepEqual([T.sheet.stats.lifeMax, T.dirty], [65, false], 'a pick that marked the run dirty has the sheets rebuilt before it returns');
});

test('leave ends the run; an unknown command is warned about and ignored', () => {
  const S = run(Sim.debugScene(10, 2), 90, idle);
  S.kills = 4; S.gold = 12; S.echoes = 3; S.haul.push({}, {}); S.player.runLevel = 2;
  const warned = [], warn = console.warn;
  console.warn = (text) => { warned.push(String(text)); };
  try {
    assert.equal(Sim.command(S, { type: 'dance' }), false);
    assert.equal(Sim.command(S, {}), false);
    assert.equal(Sim.command(S), false);
  } finally { console.warn = warn; }
  assert.equal(warned.length, 3);
  assert.match(warned[0], /Sim\.command: unknown command \{"type":"dance"\}/);
  assert.equal(S.phase, 'play');
  assert.equal(Sim.result(S).outcome, null, 'a run that goes on has totals and no outcome');
  assert.equal(Sim.command(S, { type: 'leave' }), true);
  assert.equal(S.phase, 'ended');
  assert.deepEqual(plain(S.result), {
    outcome: 'left', mode: 'watch', zone: 'debug', seed: 2, steps: 90, time: 1.5, tolls: 0, threat: 0, kills: 4, gold: 12, echoes: 3, runLevel: 2,
    haul: 2, eventsDropped: 0,
  });
  assert.equal(Sim.result(S), S.result);
  assert.deepEqual(events(S), [{ k: 'end', x: 0, y: 0, a: 0, b: 4, id: 'left' }]);
  assert.equal(S.player.alive, true);
  assert.equal(Sim.command(S, { type: 'leave' }), false, 'nothing is done to a run that has ended');
  assert.equal(Sim.command(S, { type: 'pick', index: 0 }), false);
  assert.equal(Sim.step(S, idle), false);
});

test('a run ends once, as left or as died', () => {
  const S = run(Sim.debugScene(10, 2), 30, idle);
  const result = Sim.end(S, 'died');
  assert.deepEqual([result.outcome, S.phase, S.player.alive, result.steps], ['died', 'ended', false, 30]);
  assert.equal(events(S).pop().id, 'died');
  S.kills = 99;
  assert.equal(Sim.end(S, 'left'), result, 'the first ending stands');
  assert.equal(S.result.kills, 0);
  assert.throws(() => Sim.end(Sim.debugScene(1, 1), 'won'), /the outcome is "left" or "died"/);

  // an ending in the middle of a step: the step still runs to its end
  const sim = withSystems(), T = sim.Sim.create({ zone: 'debug', seed: 1 });
  sim.Skills.step = (r) => { sim.calls.push('Skills.step'); sim.Sim.end(r, 'died'); };
  assert.equal(sim.Sim.step(T, idle), true);
  assert.deepEqual(sim.calls.slice(-4), ['Skills.step', 'Boss.step', 'Player.pickups', 'Offers.step']);
  assert.deepEqual([T.step, T.phase, T.result.steps], [1, 'ended', 0]);
  assert.equal(sim.Sim.step(T, idle), false);
});

// ---- the debug scene ----

test('the debug scene puts n husks in rings round the player', () => {
  const S = Sim.debugScene(600, 1);
  assert.deepEqual([S.zone.id, S.mode.id, S.cfg.seed, S.enemies.n, S.phase], ['debug', 'watch', 1, 600, 'play']);
  assert.deepEqual(plain(S.debug), { x: 0, y: 0 });
  const rings = new Map();
  for (const e of S.enemies.items) {
    assert.deepEqual([e.alive, e.def.id, e.level, e.rank, e.life], [true, 'debug.husk', 1, 0, 20]);
    assert.ok(Math.abs(Math.hypot(e.x, e.y) - e.a0) <= 0.35 + 1e-9, 'a husk starts within its drift of its ring');
    rings.set(e.a0, (rings.get(e.a0) || 0) + 1);
  }
  const radii = [...rings.keys()].sort((a, b) => a - b);
  assert.equal(radii[0], 4, 'the first ring leaves the player room');
  assert.ok(radii[radii.length - 1] < S.rules.spawnRadius, 'and the last is inside the spawn radius');
  radii.forEach((r, i) => { near(r, 4 + 2.2 * i); if (i < radii.length - 1) assert.equal(rings.get(r), Math.floor(2 * Math.PI * r / 1.4), `ring ${i} is full`); });
  // nobody stands on anybody: neighbours on a ring are about 1.4 m apart, rings 2.2 m, and a husk is 0.9 m wide
  let closest = Infinity;
  for (let i = 0; i < 600; i++) for (let j = i + 1; j < 600; j++) closest = Math.min(closest, Math.hypot(S.enemies.items[i].x - S.enemies.items[j].x, S.enemies.items[i].y - S.enemies.items[j].y));
  assert.ok(closest > 1.3, `the closest two are ${closest} m apart`);

  assert.equal(Sim.debugScene(0).enemies.n, 0);
  assert.equal(Sim.debugScene(1).enemies.n, 1);
  assert.equal(Sim.debugScene(17).enemies.n, 17);
  assert.equal(Sim.debugScene(5000).enemies.n, 600, 'more than the pool holds: as many as fit');
  assert.equal(Sim.debugScene(30).cfg.seed, 1, 'the seed defaults to 1');
});

test('the husks walk their rings, slowly and for ever, the same way every time', () => {
  const S = Sim.debugScene(300, 9), start = live(S.enemies).map((e) => [e.x, e.y]);
  Sim.step(S, idle);
  let turnsLeft = 0, turnsRight = 0;
  for (const e of live(S.enemies)) {
    const speed = Math.hypot(e.vx, e.vy);
    assert.ok(speed > 0.2 && speed < 1.2, `a husk moves at ${speed} m/s`);
    near(Core.angleDiff(e.face, Math.atan2(e.vy, e.vx)), 0, 0.6);    // it faces the way it walks, give or take its drift
    if (e.a2 > 0) turnsLeft++; else turnsRight++;
  }
  assert.ok(turnsLeft > 50 && turnsRight > 50, 'neighbouring rings turn opposite ways');
  run(S, 3599, idle);                                  // a minute in all
  let moved = 0;
  for (let i = 0; i < S.enemies.n; i++) {
    const e = S.enemies.items[i], d = Math.hypot(e.x, e.y);
    assert.ok(Math.abs(d - e.a0) <= 0.35 + 1e-9, 'a husk stays within its drift of its ring');
    assert.ok(d < S.region.radius);
    if (Math.hypot(e.x - start[i][0], e.y - start[i][1]) > 5) moved++;
  }
  assert.ok(moved > 250, 'after a minute nearly every husk is somewhere else');
  assert.equal(S.enemies.n, 300, 'nothing dies in a debug scene');
  assert.equal(S.player.life, S.sheet.stats.lifeMax);
  const again = run(Sim.debugScene(300, 9), 3600, idle);
  assert.equal(Sim.hash(again), Sim.hash(S));
  assert.deepEqual(live(again.enemies).map((e) => [e.x, e.y]), live(S.enemies).map((e) => [e.x, e.y]));
});

test('in a debug scene the input walks the player, and enemies spawned later stand still', () => {
  const S = Sim.debugScene(20, 3);
  const late = Sim.spawnEnemy(S, 'debug.husk', 12, -7, { rank: Sim.BOSS });
  run(S, 60, { mx: 0.6, my: -0.8, ax: 1, ay: 0, aim: false, dodge: false, draught: false });
  near(S.player.x, 3, 1e-9);                           // one second at 5 m/s along (0.6, -0.8)
  near(S.player.y, -4, 1e-9);
  near(S.player.vx, 3);
  near(S.player.face, Math.atan2(-0.8, 0.6));
  assert.deepEqual([late.x, late.y], [12, -7]);
  run(S, 5, idle);
  assert.deepEqual([S.player.vx, S.player.vy], [0, 0]);
  near(S.player.face, Math.atan2(-0.8, 0.6), 1e-9);    // and keeps facing where it last went
  run(S, 60 * 30, { mx: 1, my: 0, ax: 1, ay: 0, aim: false, dodge: false, draught: false });
  near(Math.hypot(S.player.x, S.player.y), S.region.radius - S.player.r, 1e-6);   // the edge of the region stops it
  assert.ok(S.player.x > 59);
  near(Math.hypot(S.debug.x, S.debug.y), 0);           // the husks keep circling where the player began
});
