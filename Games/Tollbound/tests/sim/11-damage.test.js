// tests/sim/11-damage.test.js: harm and protection (src/js/11-damage.js): each step of one hit on the dead (section
// 15.10 of docs/design/02-combat.md) and of one hit on the player (15.11) on its own, with the numbers worked by hand
// in the comments; the Drag ticks (15.12); the lee test; the postures and the turn rule of the dead; the conditions
// and their times; Sounded, Coiled and swing; Tolled-for; the warning of a Swell.
// The tests load the kernel and the combat package only, with content of their own (voices that deal exactly 10,
// dead of known guard and size, a post), so the numbers are the rules' alone. The dead are spawned with
// Sim.spawnEnemy and moved by hand: no behaviour of the dead runs here.
// The water band (Drag x 1, 1.25, 1.5 by the depth at a body's feet) is not tested: docs/engine.md gives no hook for
// depth until the Ropewalk, and every place is dry.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');

const FILES = ['00-core.js', '01-defs.js', '02-pool-grid.js', '10-stats.js', '11-damage.js', '20-sim.js', '21-player.js', '23-skills.js',
  '24-archetypes.js', '29-world.js', '30-modes-curves.js'];
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
const all = (S) => Array.from({ length: S.eventCount }, (u, i) => plain(S.events[(S.eventStart + i) % S.events.length]));
const events = (S, k) => all(S).filter((e) => e.k === k);
const still = { mx: 0, my: 0, ax: 1, ay: 0, aim: false, trade: false, heave: false };
const walk = (mx, my) => ({ mx, my, ax: 1, ay: 0, aim: false, trade: false, heave: false });

// A copy of the simulation with the tests' own content. Every voice wants Ear (attr 'ear', tier 1) and the runs give
// Ear 10, so each works at its full share and nothing about the body struck changes its harm (Ear raises only voices
// tagged 'timed'). Each deals exactly 10 of its kind unless it says otherwise.
function world() {
  const sim = loadSim({ only: FILES });
  const { Defs } = sim;
  const voice = (id, more) => Defs.add('voice', Object.assign({
    id, name: id, text: '', icon: null, attr: 'ear', tier: 1, tags: [], weapon: null, archetype: 'ring', target: 'self', rate: 1,
    damage: { blow: [10, 10] }, weaponPct: 0, eff: 1, crit: 0, params: { radius: 3 }, mods: [], fx: {},
  }, more));
  voice('t.blow');
  voice('t.roll', { damage: { blow: [10, 20] } });
  voice('t.drag', { damage: { drag: [40, 40] }, params: { radius: 3, duration: 1 } });
  voice('t.swell', { damage: { swell: [10, 10] }, params: { radius: 3, fill: 1 } });
  voice('t.shove', { mods: [{ stat: 'shove', op: 'flat', value: 2 }] });
  voice('t.seal', { mods: [{ stat: 'chance.sealed', op: 'flat', value: 100 }] });
  voice('t.idle', { rate: 0 });                              // in the loadout, and never speaks
  const enemy = (id, more) => Defs.add('enemy', Object.assign({
    id, name: id, puppet: id, radius: 0.4, life: 100, damage: 5, speed: 2, xp: 1, cost: 1, loot: null, ai: 'chase', aiParams: {},
    attacks: [], guard: {}, size: 'small', press: 0, tags: [],
  }, more));
  enemy('t.small');
  enemy('t.large', { size: 'large', radius: 0.7 });
  enemy('t.hard', { guard: { blow: 70, drag: 20 } });
  enemy('t.wall', { guard: { blow: 100 } });
  enemy('t.presser', { press: 1, damage: 4 });
  Defs.add('trait', { id: 't.thick', name: 'Thick', mods: [{ stat: 'taken', op: 'inc', value: -50, tags: ['blow'] }] });
  Defs.add('prop', { id: 't.post', puppet: 't.post', radius: 0.5 });
  Defs.add('zone', Object.assign({}, plain(Defs.get('zone', 'debug')), { id: 't.posts', place: [{ prop: 't.post', x: 2, y: 0 }] }));
  return sim;
}

const EAR = { stat: 'ear', op: 'flat', value: 10 };
function run(sim, voices, more = {}) {
  const extra = more.mods || [];
  return sim.Sim.create(Object.assign({ zone: 'debug', seed: 1 }, more, {
    mods: [EAR, ...extra], voices: voices.map((id, i) => ({ uid: i + 1, id, level: 1, rope: 2, knots: [] })),
  }));
}

const sim = world();
const { Core, Sim, Dmg, Stats } = sim;
const T = Stats.TYPE, BLOW = T.blow, DRAG = T.drag, SWELL = T.swell;
const R = Stats.AILMENT, FOOT = R['wrong-footed'], PROC = R['in-procession'], SOUNDED = R.sounded, COILED = R.coiled;
const SWING = R.swing, SEALED = R.sealed, TOLLED = R['tolled-for'], CLUNG = R.clung, MOORED = R.moored;
const POSE = Dmg.POSE;

// ---- 15.10: one hit on one of the dead ----

test('15.10 step 2, the roll: b = baseMin + r x (baseMax - baseMin), r from S.rng.combat; Sounded rolls the top', () => {
  const S = run(sim, ['t.roll']), e = Sim.spawnEnemy(S, 't.small', 5, 0);
  // 5 m off, alone, still and fresh: nothing but the roll changes the harm of 't.roll' (10 to 20)
  const r = new Core.RNG(0).setState(S.rng.combat.getState()).next();
  const H = Dmg.hitEnemy(S, 0, e, 1, 0, 0);
  near(H, 10 + r * 10);                                     // 10 + r x (20 - 10)
  near(e.life, 100 - H);
  e.condT[SOUNDED] = 3;                                     // Sounded: r = 1, and the stream is not drawn
  const before = plain(S.rng.combat.getState());
  assert.equal(Dmg.hitEnemy(S, 0, e, 1, 0, 0), 20);         // 10 + 1 x 10
  assert.deepEqual(plain(S.rng.combat.getState()), before);
});

test('15.10 step 3, the attacker: x Stats.hitMult (inc, more, and what is about the body struck) x the part-hit share', () => {
  const S = run(sim, ['t.blow'], { mods: [{ stat: 'damage', op: 'inc', value: 50 }, { stat: 'damage', op: 'more', value: 100, cond: 't-large' }] });
  const small = Sim.spawnEnemy(S, 't.small', 5, 0), large = Sim.spawnEnemy(S, 't.large', 0, 5);
  near(Dmg.hitEnemy(S, 0, small, 1, 0, 0), 15);             // 10 x (1 + 50/100)
  near(Dmg.hitEnemy(S, 0, large, 1, 0, 0), 30);             // 10 x 1.5 x (1 + 100/100): t-large holds for a large body
  near(Dmg.hitEnemy(S, 0, small, 0.5, 0, 0), 7.5);          // 10 x 1.5 x part 0.5
});

test('15.10 step 4, the train: In Procession takes procession-bonus more', () => {
  const S = run(sim, ['t.blow']), e = Sim.spawnEnemy(S, 't.small', 5, 0);
  e.condN[PROC] = 1;                                        // N 1 while in procession
  near(Dmg.hitEnemy(S, 0, e, 1, 0, 0), 13);                 // 10 x (1 + 30/100)
  const more = run(sim, ['t.blow'], { mods: [{ stat: 'procession-bonus', op: 'flat', value: 20 }] }), f = Sim.spawnEnemy(more, 't.small', 5, 0);
  f.condN[PROC] = 1;
  near(Dmg.hitEnemy(more, 0, f, 1, 0, 0), 15);              // 10 x (1 + 50/100)
});

test('15.10 step 5, footing: Wrong-footed takes the voice\'s wrong-foot more', () => {
  const S = run(sim, ['t.blow']), e = Sim.spawnEnemy(S, 't.small', 5, 0);
  e.condT[FOOT] = 0.5;
  near(Dmg.hitEnemy(S, 0, e, 1, 0, 0), 15);                 // 10 x (1 + 50/100), wrong-foot's base 50
  const more = run(sim, ['t.blow'], { mods: [{ stat: 'wrong-foot', op: 'flat', value: 50 }] }), f = Sim.spawnEnemy(more, 't.small', 5, 0);
  f.condT[FOOT] = 0.5;
  near(Dmg.hitEnemy(more, 0, f, 1, 0, 0), 20);              // 10 x (1 + 100/100)
  const swell = run(sim, ['t.swell']), g = Sim.spawnEnemy(swell, 't.small', 5, 0);
  g.condT[FOOT] = 0.5;
  near(Dmg.hitEnemy(swell, 0, g, 1, 0, 0), 15, 1e-9);       // a Swell too: only Wrong-footed adds to it
});

test('15.10 step 6, the guard: only the matching posture guards, the guard is capped, through pierces it, a Swell is bare', () => {
  const S = run(sim, ['t.blow', 't.drag', 't.swell']);
  const e = Sim.spawnEnemy(S, 't.small', 5, 0), hard = Sim.spawnEnemy(S, 't.hard', -5, 0), wall = Sim.spawnEnemy(S, 't.wall', 0, -5);
  e.pose = POSE.braced;
  near(Dmg.hitEnemy(S, 0, e, 1, 0, 0), 5);                  // Blow on the Braced: 10 x (1 - 50/100), the base guard
  near(Dmg.hitEnemy(S, 1, e, 0.25, 0, 0), 10);              // Drag on the Braced: no guard; 40 a second x a tick's 0.25
  near(Dmg.hitEnemy(S, 2, e, 1, 0, 0), 10);                 // Swell: bare
  e.pose = POSE.striding;
  near(Dmg.hitEnemy(S, 0, e, 1, 0, 0), 10);                 // Blow on the Striding: no guard
  near(Dmg.hitEnemy(S, 1, e, 0.25, 0, 0), 4);               // Drag on the Striding: 10 x (1 - 60/100)
  near(Dmg.hitEnemy(S, 2, e, 1, 0, 0), 10);                 // Swell: bare
  e.pose = POSE.moving;
  near(Dmg.hitEnemy(S, 0, e, 1, 0, 0), 10);                 // moving and still guard nothing
  hard.pose = POSE.braced;
  near(Dmg.hitEnemy(S, 0, hard, 1, 0, 0), 3);               // its kind's guard 70: 10 x (1 - 70/100)
  hard.pose = POSE.striding;
  near(Dmg.hitEnemy(S, 1, hard, 0.25, 0, 0), 8);            // its Stride guard 20: 10 x (1 - 20/100)
  wall.pose = POSE.braced;
  near(Dmg.hitEnemy(S, 0, wall, 1, 0, 0), 2);               // guard 100 is held to guard-max 80: 10 x (1 - 80/100)
  const pierce = run(sim, ['t.blow'], { mods: [{ stat: 'through.blow', op: 'flat', value: 50 }] }), h = Sim.spawnEnemy(pierce, 't.hard', 5, 0);
  h.pose = POSE.braced;
  near(Dmg.hitEnemy(pierce, 0, h, 1, 0, 0), 6.5);           // g = 70 x (1 - 50/100) = 35: 10 x (1 - 35/100)
});

test('15.10 step 7, harm taken: a body\'s traits change what it takes of a kind; a Swell ignores them', () => {
  const S = run(sim, ['t.blow', 't.swell']), e = Sim.spawnEnemy(S, 't.small', 5, 0, { traits: ['t.thick'] });
  near(Dmg.hitEnemy(S, 0, e, 1, 0, 0), 5);                  // taken 100 x (1 - 50/100) = 50%: 10 x 0.5
  near(Dmg.hitEnemy(S, 1, e, 1, 0, 0), 10);                 // the Swell is bare
});

test('15.10 step 8, life: H comes off life, and a hit event says how much and of which kinds', () => {
  const S = run(sim, ['t.blow']), e = Sim.spawnEnemy(S, 't.small', 5, 0);
  S.eventCount = 0;
  const H = Dmg.hitEnemy(S, 0, e, 1, 0, 0);
  assert.equal(H, 10);
  assert.equal(e.life, 90);
  assert.deepEqual(events(S, 'hit'), [{ k: 'hit', x: 5, y: 0, a: 10, b: 1 << BLOW, id: null }]);
  assert.equal(S.voices.lastHit[0], 10, 'the voice\'s last hit is kept, for coils');
  e.life = 0;
  assert.equal(Dmg.hitEnemy(S, 0, e, 1, 0, 0), 0, 'a body with no life left is not struck again');
});

test('15.10 step 9, the shove: the body is moved away from the voice, a keeper a quarter as far; it ends Brace and procession', () => {
  const S = run(sim, ['t.shove']), e = Sim.spawnEnemy(S, 't.small', 5, 0), k = Sim.spawnEnemy(S, 't.small', 0, 5, { rank: 3 });
  e.pose = POSE.braced; e.stillT = 3; e.condN[PROC] = 1; e.condV[PROC] = 5;
  Dmg.hitEnemy(S, 0, e, 1, 0, 0);
  near(e.x, 7); near(e.y, 0);                               // 2 m away from (0, 0)
  assert.equal(e.pose, POSE.still, 'its Brace has ended');
  assert.equal(e.stillT, 0);
  assert.equal(e.condN[PROC], 0, 'and its procession');
  Dmg.hitEnemy(S, 0, k, 1, 0, 0);
  near(k.y, 5.5);                                           // a keeper: 2 / 4
});

test('15.10 step 10, the conditions: a chance row is laid, a Blow counts swing, a heavy hit breaks a seal', () => {
  const S = run(sim, ['t.seal', 't.blow']), e = Sim.spawnEnemy(S, 't.small', 5, 0);
  Dmg.hitEnemy(S, 0, e, 1, 0, 0);
  near(e.condT[SEALED], 15);                                // chance.sealed 100: laid for 15 s x cond-duration 100%
  near(e.condV[SEALED], 0.08);                              // broken by one hit of 8% of greatest life
  // the seal holds against 5 (5 < 0.08 x 100) and breaks on 10
  const f = Sim.spawnEnemy(S, 't.small', -5, 0);
  Dmg.lay(S, f, SEALED, 15, 0.08, 0);
  Dmg.hitEnemy(S, 1, f, 0.5, 0, 0);
  assert.ok(f.condT[SEALED] > 0, 'a hit of 5 leaves it sealed');
  Dmg.hitEnemy(S, 1, f, 1, 0, 0);
  assert.equal(f.condT[SEALED], 0, 'a hit of 10 breaks it');
  // swing: the first Blow notes its direction; one more than 120 degrees off adds one; one within 60 takes one away
  const g = Sim.spawnEnemy(S, 't.small', 0, 10);
  Dmg.hitEnemy(S, 1, g, 1, -1, 10);                         // from the west
  assert.equal(g.condN[SWING], 0);
  near(g.condV[SWING], 1e-9, 1e-12);                        // a direction of 0 is kept as a hair above it
  Dmg.hitEnemy(S, 1, g, 1, 1, 10);                          // from the east: 180 degrees off
  assert.equal(g.condN[SWING], 1);
  Dmg.hitEnemy(S, 1, g, 1, -1, 10);
  assert.equal(g.condN[SWING], 2);
  Dmg.hitEnemy(S, 1, g, 1, -1, 10);                         // the same side again
  assert.equal(g.condN[SWING], 1);
  Dmg.hitEnemy(S, 1, g, 1, 0, 9);                           // from the south: 90 degrees off, neither
  assert.equal(g.condN[SWING], 1);
});

test('swing at 6 throws a body 4 m along the last Blow, striking each of the dead within 1 m of its path for 10% of its greatest life', () => {
  const S = run(sim, ['t.blow']), e = Sim.spawnEnemy(S, 't.small', 0, 10);
  const inPath = Sim.spawnEnemy(S, 't.small', 2.5, 10.8), aside = Sim.spawnEnemy(S, 't.small', 2.5, 12.5), keeper = Sim.spawnEnemy(S, 't.small', 0, -10, { rank: 3 });
  for (let i = 0; i < 7; i++) Dmg.hitEnemy(S, 0, e, 0.01, i % 2 ? 1 : -1, 10);   // west, east, ...: six changes of side
  assert.equal(e.condN[SWING], 6);
  near(e.condV[SWING], 0, 1e-6);                            // the last Blow came from the west, heading east
  Sim.step(S, still);                                       // it goes over in Dmg.step
  near(e.x, 4, 1e-9); near(e.y, 10, 1e-6);                  // along 0 radians (kept as a hair above it)
  assert.equal(e.condN[SWING], 0, 'its swing returns to 0');
  near(inPath.life, 100 - 10, 1e-9);                        // 10% of 100, a Blow on a body that is not Braced
  assert.equal(aside.life, 100, 'a body 2.5 m off the path is not struck');
  for (let i = 0; i < 13; i++) Dmg.hitEnemy(S, 0, keeper, 0.01, i % 2 ? 1 : -1, -10);
  assert.equal(keeper.condN[SWING], 12, 'a keeper needs 12');
  Sim.step(S, still);
  near(keeper.x, 1, 1e-9);                                  // and is thrown 1 m
});

test('Dmg.harmEnemy: harm from no voice takes the guard and the traits but no roll and no voice\'s numbers', () => {
  const S = run(sim, ['t.blow'], { mods: [{ stat: 'damage', op: 'inc', value: 300 }] }), e = Sim.spawnEnemy(S, 't.small', 5, 0, { traits: ['t.thick'] });
  near(Dmg.harmEnemy(S, e, 'blow', 10, 0, 0), 5);           // 10 x taken 0.5; the player's +300% has no part in it
  e.pose = POSE.braced;
  near(Dmg.harmEnemy(S, e, BLOW, 10, 0, 0), 2.5);           // and x (1 - 50/100) Braced
  near(Dmg.harmEnemy(S, e, 'swell', 10, 0, 0), 10);         // bare
});

// ---- 15.11: one hit on the player ----

const LUNGE = { id: 't.lunge', type: 'blow', mult: 2 }, MIRE = { id: 't.mire', type: 'drag', mult: 2 }, WAVE = { id: 't.wave', type: 'swell', mult: 2 };
function source(S) { return Sim.spawnEnemy(S, 't.small', 1, 0); }   // damage 5 at level 1: d = 5 x mult 2 = 10

test('15.11 step 2, bare: a Swell is d whatever the guard and the harm-taken modifiers', () => {
  const S = run(sim, [], { mods: [{ stat: 'taken', op: 'inc', value: -50 }] }), s = source(S), p = S.player;
  p.pose = POSE.braced;
  near(Dmg.hitPlayer(S, WAVE, s, 1, 1), 10);                 // d = 5 x 2 x 1
  near(p.life, 60 - 10);
});

test('15.11 step 3, the guard: Blow and Braced, Drag and Striding, and nothing else', () => {
  const S = run(sim, []), s = source(S), p = S.player;
  p.pose = POSE.braced;
  near(Dmg.hitPlayer(S, LUNGE, s, 1, 0.5), 5);               // 10 x (1 - 50/100): guard.blow 50
  near(Dmg.hitPlayer(S, MIRE, s, 1, 0), 10);                 // Drag on the Braced: full
  p.pose = POSE.striding;
  near(Dmg.hitPlayer(S, MIRE, s, 1, 0), 4);                  // 10 x (1 - 60/100): guard.drag 60
  near(Dmg.hitPlayer(S, LUNGE, s, 1, 0.5), 10);              // Blow on the Striding: full
  const strong = run(sim, [], { mods: [{ stat: 'guard.blow', op: 'flat', value: 40 }] }), t = source(strong);
  strong.player.pose = POSE.braced;
  near(Dmg.hitPlayer(strong, LUNGE, t, 1, 0.5), 2);          // 90 held to guard-max 80: 10 x (1 - 80/100)
});

test('15.11 step 4, harm taken: x sheet.taken of the kind', () => {
  const S = run(sim, [], { mods: [{ stat: 'taken', op: 'inc', value: -20, tags: ['blow'] }] }), s = source(S);
  near(Dmg.hitPlayer(S, LUNGE, s, 1, 0.5), 8);               // 10 x 0.8
  near(Dmg.hitPlayer(S, MIRE, s, 1, 0), 10);                 // the modifier asks for the blow tag
});

test('15.11 step 5, footing: Wrong-footed takes wrong-foot-taken more, a Swell included', () => {
  const S = run(sim, []), s = source(S), p = S.player;
  p.condT[FOOT] = 0.5;
  near(Dmg.hitPlayer(S, LUNGE, s, 1, 0.5), 15);              // 10 x (1 + 50/100)
  near(Dmg.hitPlayer(S, WAVE, s, 1, 1), 15);
  p.pose = POSE.braced;
  near(Dmg.hitPlayer(S, LUNGE, s, 1, 0.5), 7.5);             // after the guard: 10 x 0.5 x 1.5
});

test('15.11 step 6, the reprieve: Tolled-for loses no life; a Blow or a Swell takes 1 s of its time, a Drag tick 0.25 s', () => {
  const S = run(sim, []), s = source(S), p = S.player;
  p.condT[TOLLED] = 5;
  S.eventCount = 0;
  assert.equal(Dmg.hitPlayer(S, LUNGE, s, 1, 0.5), 0);
  assert.equal(p.life, 60);
  near(p.condT[TOLLED], 4);
  Dmg.hitPlayer(S, WAVE, s, 1, 1);
  near(p.condT[TOLLED], 3);
  Dmg.hitPlayer(S, MIRE, s, 1, 0);
  near(p.condT[TOLLED], 2.75);
  assert.equal(S.wounds.n, 0, 'and no wound opens');
  assert.deepEqual(events(S, 'hurt').map((e) => [e.a, e.b, e.id]), [[0, BLOW, 't.lunge'], [0, SWELL, 't.wave'], [0, DRAG, 't.mire']]);
  p.condT[TOLLED] = 0.5;
  Dmg.hitPlayer(S, LUNGE, s, 1, 0.5);                        // time runs out under a Blow
  assert.equal(S.phase, 'ended');
  assert.equal(S.result.outcome, 'died');
});

test('15.11 steps 7 and 8, life and the wound: h comes off life and lies where the player stands, as deep as the warning', () => {
  const S = run(sim, []), s = source(S), p = S.player;
  S.eventCount = 0;
  const lost = Dmg.hitPlayer(S, LUNGE, s, 1, 0.6);
  assert.equal(lost, 10);
  assert.equal(p.life, 50);
  assert.equal(S.wounds.n, 1);
  assert.deepEqual([S.wounds.x[0], S.wounds.y[0], S.wounds.life[0], S.wounds.depth[0]], [0, 0, 10, 0.6]);
  assert.deepEqual(events(S, 'wound'), [{ k: 'wound', x: 0, y: 0, a: 10, b: 0.6, id: 'open' }]);
  assert.deepEqual(events(S, 'hurt'), [{ k: 'hurt', x: 0, y: 0, a: 10, b: BLOW, id: 't.lunge' }]);
  Dmg.hitPlayer(S, MIRE, s, 1, 0.9);                         // Drag is never shown: its depth is 0, and it joins
  assert.equal(S.wounds.n, 1);
  assert.equal(S.wounds.life[0], 20);
  assert.equal(S.wounds.depth[0], 0.6, 'a joined wound keeps the deepest');
});

test('15.11 step 9, the seal and swing: a seal breaks at 8% of greatest life; six changes of side shove the player 2 m', () => {
  const S = run(sim, []), s = source(S), p = S.player;
  Dmg.lay(S, p, SEALED, 15, 0.08, 0);
  Dmg.hitPlayer(S, LUNGE, s, 0.4, 0.5);                      // 4 < 0.08 x 60 = 4.8: it holds
  assert.ok(p.condT[SEALED] > 0);
  Dmg.hitPlayer(S, LUNGE, s, 0.5, 0.5);                      // 5 >= 4.8: it breaks
  assert.equal(p.condT[SEALED], 0);
  const west = Sim.spawnEnemy(S, 't.small', -1, 0), east = Sim.spawnEnemy(S, 't.small', 1, 0);
  for (let i = 0; i < 6; i++) Dmg.hitPlayer(S, LUNGE, i % 2 ? west : east, 0.05, 0.5);   // east, west, ...: five changes
  assert.equal(p.condN[SWING], 5);
  const x = p.x;
  Dmg.hitPlayer(S, LUNGE, east, 0.05, 0.5);                  // the sixth, from the east: shoved 2 m west
  assert.equal(p.condN[SWING], 0);
  near(p.x, x - 2);
});

test('15.11 step 10, no life: Tolled-for once a vigil, its time the seconds to the next toll; a second fall is death', () => {
  const S = run(sim, []), s = source(S), p = S.player;
  for (let i = 0; i < 30; i++) Sim.step(S, still);
  p.life = 3;
  S.eventCount = 0;
  assert.equal(Dmg.hitPlayer(S, LUNGE, s, 1, 0.5), 3, 'the life lost is what there was');
  assert.equal(p.life, 0);
  near(p.condT[TOLLED], (4500 - 30) / 60);                   // the first toll rings at step 4500
  assert.equal(S.combat.reprieved, true);
  assert.equal(S.phase, 'play');
  assert.equal(S.wounds.life[0], 3, 'the wound holds the life that was lost');
  // a second fall in the same vigil
  const T2 = run(sim, []), s2 = source(T2);
  T2.combat.reprieved = true;
  T2.player.life = 3;
  Dmg.hitPlayer(T2, LUNGE, s2, 1, 0.5);
  assert.equal(T2.phase, 'ended');
  assert.equal(T2.result.outcome, 'died');
  assert.equal(T2.player.alive, false);
});

test('what took the player to no life is noted for the Register: the attack, its kind and the toll', () => {
  const S = run(sim, [], { rules: { tollSeconds: 1 } }), s = source(S), p = S.player;
  for (let i = 0; i < 70; i++) Sim.step(S, still);           // past the first toll
  assert.equal(S.cause, null, 'nothing yet');
  Dmg.hitPlayer(S, MIRE, s, 0.1, 0);
  assert.equal(S.cause, null, 'harm that leaves life is not a cause');
  p.life = 2;
  Dmg.hitPlayer(S, WAVE, s, 1, 1);
  assert.deepEqual(plain(S.cause), { attack: 't.wave', kind: 'swell', toll: 1 }, 'the fall that made it Tolled-for');
  // and the fall that kills: a press of a body has no attack id
  const T2 = run(sim, []);
  T2.combat.reprieved = true;
  T2.player.life = 1;
  Dmg.hitPlayer(T2, { type: 'drag', mult: 1 }, source(T2), 1, 0);
  assert.deepEqual(plain(T2.cause), { attack: null, kind: 'drag', toll: 0 });
  assert.equal(T2.result.cause, T2.cause, 'the result carries it');
});

test('Dmg.hitPlayer: a shot or an area carries its whole harm in damage, which mult does not multiply again', () => {
  const S = run(sim, []), area = S.areas.alloc();
  area.team = 1; area.damage = 7; area.ttl = 1;
  near(Dmg.hitPlayer(S, WAVE, area, 1, 1), 7);
  near(Dmg.hitPlayer(S, WAVE, area, 0.3, 1), 2.1);           // the keeper's echo: 7 x 0.3
});

test('Tolled-for that runs out ends the run "died" as the toll rings', () => {
  const S = run(sim, [], { rules: { tollSeconds: 2 } }), s = source(S), p = S.player;
  for (let i = 0; i < 30; i++) Sim.step(S, still);
  p.life = 1;
  Dmg.hitPlayer(S, LUNGE, s, 1, 0.5);
  near(p.condT[TOLLED], 1.5);                                // (120 - 30) / 60
  let steps = 0;
  while (S.phase === 'play' && steps < 200) { Sim.step(S, still); steps++; }
  assert.equal(S.result.outcome, 'died');
  assert.equal(S.step, 120, 'in the step whose end rings the toll');
});

// ---- 15.12: the Drag ticks ----

test('15.12: the dead touching you press you four times a second, damage x press / 4 each; a body 0.1 m off does not', () => {
  const S = run(sim, []), p = S.player;
  const touching = Sim.spawnEnemy(S, 't.presser', 0.85, 0);  // edges 0.05 apart: 0.85 - 0.4 - 0.4
  Sim.spawnEnemy(S, 't.presser', -0.95, 0);                  // edges 0.15 apart
  let hurts = [];
  for (let i = 0; i < 60; i++) { Sim.step(S, still); hurts = hurts.concat(events(S, 'hurt')); }
  assert.equal(hurts.length, 4, 'one second: four ticks of one body');
  for (const h of hurts) { assert.equal(h.b, DRAG); assert.equal(h.id, null); near(h.a, 1); }   // 4 x 1 / 4
  assert.equal(S.wounds.n, 1, 'Drag wounds join where you stand');
  assert.equal(S.wounds.depth[0], 0);
  // the player stands Braced on that wound, so it mends as it fills: what was lost is what lies in it and what came back
  near(p.life, 60 - 4 + S.wounds.back[0], 1e-9);
  near(S.wounds.life[0] + S.wounds.back[0], 4, 1e-9);
  assert.ok(S.wounds.back[0] > 0);
  touching.life = 0;
});

test('15.12: each rider on you deals its Drag / 4 a tick; riders on a large dead do the same to it', () => {
  const S = run(sim, []), p = S.player, big = Sim.spawnEnemy(S, 't.large', 6, 0);
  p.condN[CLUNG] = 2; p.condV[CLUNG] = 8;                    // two riders of 8 a second
  big.condN[CLUNG] = 3; big.condV[CLUNG] = 4;
  big.vx = 1;                                                // it walks, so neither guard holds
  let hurts = [];
  for (let i = 0; i < 15; i++) { big.vx = 1; Sim.step(S, still); hurts = hurts.concat(events(S, 'hurt')); }
  assert.equal(hurts.length, 2, 'one tick: one hit for each rider');
  for (const h of hurts) near(h.a, 2);                       // 8 / 4
  near(big.life, 100 - 3);                                    // 3 riders x 4 / 4
});

test('15.12: a Drag zone of the dead deals its harm a second / 4 to you while you stand in it', () => {
  const S = run(sim, []), a = S.areas.alloc();
  a.team = 1; a.def = { id: 't.bog', kind: 'zone', type: 'drag', shape: 'circle', angle: 0 }; a.x = 1; a.y = 0; a.r = 1.5; a.damage = 12; a.ttl = 10;
  let hurts = [];
  for (let i = 0; i < 15; i++) { Sim.step(S, still); hurts = hurts.concat(events(S, 'hurt')); }
  assert.deepEqual(hurts.map((h) => [h.a, h.b, h.id]), [[3, DRAG, 't.bog']]);   // 12 / 4
  a.x = 3;                                                   // now 3 m off: outside
  for (let i = 0; i < 15; i++) { Sim.step(S, still); assert.equal(events(S, 'hurt').length, 0); }
});

// ---- lee ----

test('Dmg.inLee: a prop or a large body on the line from the source, within reach of the body, gives lee', () => {
  const S = sim.Sim.create({ zone: 't.posts', seed: 1 });     // a post of radius 0.5 at (2, 0)
  const body = (x, y) => ({ x, y, r: 0.4 });
  assert.equal(Dmg.inLee(S, 0, 0, body(3.5, 0), 3), true, 'the post 1.5 m before it, on the line');
  assert.equal(Dmg.inLee(S, 0, 0, body(1, 0), 3), false, 'the post behind the body');
  assert.equal(Dmg.inLee(S, 0, 0, body(6, 0), 3), false, 'the post 4 m before it: beyond reach');
  assert.equal(Dmg.inLee(S, 0, 0, body(6, 0), 4.5), true, 'with a reach of 4.5 it holds');
  assert.equal(Dmg.inLee(S, 0, 0, body(3.5, 1.5), 3), false, 'the post 0.79 m off the line, wider than its 0.5');
  assert.equal(Dmg.inLee(S, 0, 0.4, body(3.5, 0.4), 3), true, 'a line 0.4 m off its centre still crosses it');
  // the dead: a large body gives lee, a small one does not, nor the body itself, nor a large one over the source
  const T2 = run(sim, []);
  const small = Sim.spawnEnemy(T2, 't.small', 6, 0), large = Sim.spawnEnemy(T2, 't.large', 4, 0), behind = Sim.spawnEnemy(T2, 't.small', 6, 3);
  Sim.spawnEnemy(T2, 't.small', 5, 3);
  T2.grid.rebuild(T2.enemies);
  assert.equal(Dmg.inLee(T2, 0, 0, small, 3), true, 'behind the large body');
  assert.equal(Dmg.inLee(T2, 0, 3, behind, 3), false, 'behind a small body');
  assert.equal(Dmg.inLee(T2, 0, 0, large, 3), false, 'a body is not its own lee');
  assert.equal(Dmg.inLee(T2, 4, 0, small, 3), false, 'the large body stands over the source: it is the caster');
});

// ---- posture and the turn rule of the dead ----

function steer(S, e, vx, vy, steps) {
  for (let i = 0; i < steps; i++) { e.vx = vx; e.vy = vy; Sim.step(S, still); }
}

test('posture of the dead: still under 15% of top speed, Braced after 0.4 s, Striding at 70% held 0.25 s', () => {
  const S = run(sim, []), e = Sim.spawnEnemy(S, 't.small', 5, 0);   // top speed 2
  steer(S, e, 0.29, 0, 23);                                  // 14.5%: still
  assert.equal(e.pose, POSE.still);
  steer(S, e, 0.29, 0, 1);                                   // the 24th step still: 0.4 s
  assert.equal(e.pose, POSE.braced);
  steer(S, e, 0.31, 0, 1);                                   // 15.5%: moving, and the Brace is gone
  assert.equal(e.pose, POSE.moving);
  assert.equal(e.stillT, 0);
  steer(S, e, 1.38, 0, 60);                                  // 69%: never Striding
  assert.equal(e.pose, POSE.moving);
  steer(S, e, 1.4, 0, 14);                                   // 70% for 14 steps
  assert.equal(e.pose, POSE.moving);
  steer(S, e, 1.4, 0, 1);                                    // the 15th: 0.25 s
  assert.equal(e.pose, POSE.striding);
  steer(S, e, 1.3, 0, 1);                                    // below the share again
  assert.equal(e.pose, POSE.moving);
});

test('posture: a shove of 0.3 m ends Brace, a shorter one does not', () => {
  const S = run(sim, []), e = Sim.spawnEnemy(S, 't.small', 5, 0);
  steer(S, e, 0, 0, 30);
  assert.equal(e.pose, POSE.braced);
  assert.ok(Math.abs(Dmg.shove(S, e, 0.29, 0) - 0.29) < 1e-9);
  assert.equal(e.pose, POSE.braced);
  Dmg.shove(S, e, 0.3, 0);
  assert.equal(e.pose, POSE.still);
  steer(S, e, 0, 0, 23);
  assert.equal(e.pose, POSE.still, 'it must stand another 0.4 s');
  steer(S, e, 0, 0, 1);
  assert.equal(e.pose, POSE.braced);
});

test('the turn rule of the dead: more than 90 degrees within 0.5 s above 30% of top speed wrong-foots for 0.5 s (keepers 0.25 s)', () => {
  // steers e at (vx, vy) for up to `steps` steps and returns the step at which it became Wrong-footed, or -1
  const FOOTED = (S, e, vx, vy, steps) => {
    for (let i = 0; i < steps; i++) { steer(S, e, vx, vy, 1); if (e.condT[FOOT] > 0) return i; }
    return -1;
  };
  const S = run(sim, []), e = Sim.spawnEnemy(S, 't.small', 5, 0);
  steer(S, e, 1, 0, 40);                                     // east at 50%
  assert.equal(FOOTED(S, e, 0, 1, 40), -1, 'a turn of 90 degrees is not more than 90');
  steer(S, e, 1, 0, 40);
  const c = Math.cos(100 * Math.PI / 180), s = Math.sin(100 * Math.PI / 180);
  const at = FOOTED(S, e, c, s, 6);                          // 100 degrees: found on the next heading record
  assert.ok(at >= 0 && at < 6, 'a turn of 100 degrees wrong-foots within 0.1 s');
  near(e.condV[FOOT], 100, 1e-6);
  let left = 0;
  while (e.condT[FOOT] > 0) { steer(S, e, c, s, 1); left++; }
  assert.equal(left, 30, 'it lasts 0.5 s: carried at the end of 30 steps, the one that laid it among them');
  // too slow to record a heading: 25% of top speed
  const slow = Sim.spawnEnemy(S, 't.small', 0, 8);
  steer(S, slow, 0.5, 0, 40);
  assert.equal(FOOTED(S, slow, -0.5, 0, 40), -1);
  // the old headings age out: after standing 0.6 s, a reversal is no turn
  const rest = Sim.spawnEnemy(S, 't.small', 0, -8);
  steer(S, rest, 1, 0, 40); steer(S, rest, 0, 0, 36);
  assert.equal(FOOTED(S, rest, -1, 0, 30), -1);
  // a keeper is wrong-footed for 0.25 s
  const k = Sim.spawnEnemy(S, 't.small', -8, 0, { rank: 3 });
  steer(S, k, 1, 0, 40);
  assert.ok(FOOTED(S, k, -1, 0, 6) >= 0);
  assert.ok(k.condT[FOOT] <= 0.25 + 1e-9 && k.condT[FOOT] > 0.15);
});

// ---- conditions and their times ----

test('Dmg.lay is refused where the row spares the body, where the body cannot carry it, on a sealed body and while immune', () => {
  const S = run(sim, []), small = Sim.spawnEnemy(S, 't.small', 5, 0), large = Sim.spawnEnemy(S, 't.large', -5, 0), p = S.player;
  assert.equal(Dmg.lay(S, small, SOUNDED, 6, 0, 0), false, 'sounded spares the small');
  assert.equal(Dmg.lay(S, large, SOUNDED, 6, 0, 0), true);
  assert.equal(Dmg.lay(S, small, TOLLED, 6, 0, 0), false, 'only the player is Tolled-for');
  assert.equal(Dmg.lay(S, p, PROC, 0, 0, 1), false, 'only the dead walk in procession');
  assert.equal(Dmg.lay(S, small, MOORED, 4, 1, 3), true);
  Dmg.lay(S, small, SEALED, 15, 0.08, 0);
  assert.equal(Dmg.lay(S, small, FOOT, 0.5, 100, 0), false, 'a sealed body takes no new condition');
  assert.equal(Dmg.lift(S, small, MOORED), false, 'nor loses one');
  assert.equal(Dmg.lift(S, small, SEALED), true, 'but the seal itself can be lifted');
  assert.equal(Dmg.lift(S, small, MOORED), true);
  assert.equal(small.condT[MOORED], -6, 'moored leaves 6 s in which it cannot be laid again');
  assert.equal(Dmg.lay(S, small, MOORED, 4, 1, 3), false);
  for (let i = 0; i < 360; i++) Sim.step(S, still);
  assert.equal(small.condT[MOORED], 0);
  assert.equal(Dmg.lay(S, small, MOORED, 4, 1, 3), true, 'after 6 s it can');
  assert.equal(Dmg.lay(S, small, MOORED, 4, 1, 99), true);
  assert.equal(small.condN[MOORED], 12, 'stacks are held to the row\'s most');
});

test('condition times run down in Dmg.step; a seal holds every other one still; what lasted by time is cleared when it ends', () => {
  const S = run(sim, []), e = Sim.spawnEnemy(S, 't.large', 5, 0), f = Sim.spawnEnemy(S, 't.small', -5, 0);
  Dmg.lay(S, e, COILED, 0.5, 1, 2);
  Dmg.lay(S, f, FOOT, 0.5, 100, 0);
  Dmg.lay(S, f, SEALED, 1, 0.08, 0);
  for (let i = 0; i < 29; i++) Sim.step(S, still);
  assert.ok(e.condT[COILED] > 0 && e.condN[COILED] === 2);
  Sim.step(S, still);                                        // the 30th step: 0.5 s
  assert.deepEqual([e.condT[COILED], e.condV[COILED], e.condN[COILED]], [0, 0, 0], 'its coils go with it');
  assert.equal(f.condT[FOOT], 0.5, 'held still by the seal');
  near(f.condT[SEALED], 0.5, 1e-9);
  for (let i = 0; i < 30; i++) Sim.step(S, still);
  assert.equal(f.condT[SEALED], 0, 'the seal ran out after 1 s');
  for (let i = 0; i < 30; i++) Sim.step(S, still);
  assert.equal(f.condT[FOOT], 0, 'and then the rest ran on');
});

test('Sounded: a large body kept 4 to 6 m off for sound-time is Sounded (6 s, renewed); it ends 0.5 s after it leaves the band', () => {
  const S = run(sim, []), e = Sim.spawnEnemy(S, 't.large', 5, 0), small = Sim.spawnEnemy(S, 't.small', 0, 5);
  for (let i = 0; i < 119; i++) Sim.step(S, still);
  assert.equal(e.condT[SOUNDED], 0, 'not yet at 119 steps');
  Sim.step(S, still);
  near(e.condT[SOUNDED], 6);                                 // the 120th step: 2 s
  assert.equal(small.condT[SOUNDED] + small.condV[SOUNDED], 0, 'never the small');
  for (let i = 0; i < 60; i++) Sim.step(S, still);
  near(e.condT[SOUNDED], 6, 1e-9);                           // renewed while held
  e.x = 7;                                                   // out of the band
  let steps = 0;
  while (Dmg.carries(e, SOUNDED) && steps < 100) { Sim.step(S, still); steps++; }
  assert.equal(steps, 31, 'carried at the end of the 30 steps from the first one outside, gone at the next');
  assert.deepEqual([e.condT[SOUNDED], e.condV[SOUNDED]], [0, 0]);
});

test('Coiled: a full sunwise circuit within 6 m ties a coil (to 3); a widdershins one spends them as Blows of 150% of the last hit', () => {
  const S = run(sim, ['t.idle']), e = Sim.spawnEnemy(S, 't.large', 3, 0), p = S.player;
  // walk round it at 3 m (the tangent, sunwise from +x toward +y or widdershins, with a pull back onto the circle),
  // until the angle walked round it, counted here from the places, has gone `turns` times round
  let walked = 0;
  const circuit = (dir, turns) => {
    const goal = walked + dir * turns * 2 * Math.PI;
    for (let i = 0; i < 2000 && (dir > 0 ? walked < goal : walked > goal); i++) {
      e.vx = 1;                                              // it means to walk, so it is not Braced
      const a = Math.atan2(p.y - e.y, p.x - e.x), r = Math.hypot(p.x - e.x, p.y - e.y), back = (r - 3) * 2;
      const mx = -Math.sin(a) * dir - Math.cos(a) * back, my = Math.cos(a) * dir - Math.sin(a) * back, l = Math.hypot(mx, my);
      Sim.step(S, walk(mx / l, my / l));
      walked += Core.angleDiff(a, Math.atan2(p.y - e.y, p.x - e.x));
    }
  };
  circuit(1, 0.97);
  assert.equal(e.condN[COILED], 0, 'not before the circuit is whole');
  circuit(1, 0.05);
  assert.equal(e.condN[COILED], 1, 'one coil after one sunwise circuit');
  near(e.condT[COILED], 10, 0.2);
  circuit(1, 2);
  assert.equal(e.condN[COILED], 3);
  circuit(1, 1);
  assert.equal(e.condN[COILED], 3, 'three at most');
  S.voices.lastHit[0] = 10;                                  // the strongest voice last struck for 10
  const life = e.life;
  circuit(-1, 0.6);                                          // the sunwise surplus is walked back first, then a whole circuit
  circuit(-1, 1.5);
  assert.equal(e.condN[COILED], 0, 'one widdershins circuit spends every coil');
  near(life - e.life, 3 * 15, 1e-6);                         // three Blows of 1.5 x 10
});

// ---- the warning of a Swell ----

test('Dmg.warning: free Heed x 0.01 + warn, +0.3 from a Sounded source, never more than 1 s', () => {
  const S = run(sim, []);
  assert.equal(Dmg.warning(S, null), 1, 'Heed 110 (100 and Ear 10): 1.1 + 0.05 is held to 1');
  const T2 = run(sim, [], { mods: [{ stat: 'heed-max', op: 'set', value: 40 }] }), e = Sim.spawnEnemy(T2, 't.large', 5, 0);
  near(Dmg.warning(T2, e), 0.45);                            // 40 x 0.01 + Ear's warn 0.05
  e.condT[SOUNDED] = 3;
  near(Dmg.warning(T2, e), 0.75);                            // + 0.3
  const T3 = run(sim, [], { mods: [{ stat: 'heed-max', op: 'set', value: 0 }] });
  near(Dmg.warning(T3, null), 0.05);
});

test('Dmg.warning: the Register shows an attack that killed a character sooner, by what the run\'s account says of it', () => {
  // the run's account carries warned: seconds by attack id, which Char.begin works out (0.15 s a death, three at most)
  const account = { warned: { 't.wave': 0.3, 't.lunge': 0.45 } };
  const S = run(sim, [], { mods: [{ stat: 'heed-max', op: 'set', value: 20 }], account });
  near(Dmg.warning(S, null, 't.wave'), 0.2 + 0.05 + 0.3);
  near(Dmg.warning(S, null, 't.lunge'), 0.2 + 0.05 + 0.45);
  near(Dmg.warning(S, null, 't.mire'), 0.25);                // an attack that killed no one
  near(Dmg.warning(S, null, null), 0.25);
  near(Dmg.warning(S, null, 'constructor'), 0.25);           // only the account's own entries count
  const T2 = run(sim, [], { mods: [{ stat: 'heed-max', op: 'set', value: 90 }], account });
  assert.equal(Dmg.warning(T2, null, 't.lunge'), 1, 'all of it together is never more than 1 s');
  near(Dmg.warning(run(sim, [], { mods: [{ stat: 'heed-max', op: 'set', value: 20 }] }), null, 't.wave'), 0.25);   // no account
});

test('Dmg.large: large by its def\'s size or by an elite rank or above', () => {
  const S = run(sim, []);
  assert.equal(Dmg.large(Sim.spawnEnemy(S, 't.small', 1, 0)), false);
  assert.equal(Dmg.large(Sim.spawnEnemy(S, 't.large', 2, 0)), true);
  assert.equal(Dmg.large(Sim.spawnEnemy(S, 't.small', 3, 0, { rank: 1 })), true);
  assert.equal(Dmg.large(Sim.spawnEnemy(S, 't.small', 4, 0, { rank: 3 })), true);
  assert.deepEqual(plain(Dmg.POSE), { still: 0, braced: 1, moving: 2, striding: 3 });
});
