// tests/sim/23-skills.test.js: voices speaking (src/js/23-skills.js) and the archetypes (src/js/24-archetypes.js):
// casting by rate and by target rule, silenced places, no voice while Tolled-for, Skills.speak; ring, rap, bar,
// spark and cone each striking what its shape covers and nothing else, in each kind of harm (a Blow at once, a Drag
// zone that the ticks bite through, a Swell that fills and lands, bare, with lee for a spreading one); the
// Change-ringer's three voices (src/js/31-change-ringer.js); and the same seed giving the same run. Then what the
// third package added for the voices found blank: the ring's beat and byCount, the target rules 'crossing', 'step' and
// 'ahead' (the cone's held length, the spark's rear), and the numbers of those voices. The knots' rules have their own
// test (35-knots.test.js).
// The kernel and the combat package only. The dead stand where they are put unless a test moves them.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');

const FILES = ['00-core.js', '01-defs.js', '02-pool-grid.js', '10-stats.js', '11-damage.js', '20-sim.js', '21-player.js', '23-skills.js',
  '24-archetypes.js', '29-world.js', '30-modes-curves.js', '31-change-ringer.js'];
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
const all = (S) => Array.from({ length: S.eventCount }, (u, i) => plain(S.events[(S.eventStart + i) % S.events.length]));
const frame = (mx = 0, my = 0) => ({ mx, my, ax: 1, ay: 0, aim: false, trade: false, heave: false });
const STILL = frame();
function steps(S, n, f = STILL) { const out = []; for (let i = 0; i < n; i++) { Sim.step(S, f); out.push(...all(S)); } return out; }

const sim = loadSim({ only: FILES });
const { Sim, Skills, Dmg, Stats, Defs, Player } = sim;

// voices of the tests' own: each wants Ear and the runs give Ear 10, so each deals exactly its numbers
const voice = (id, more) => Defs.add('voice', Object.assign({
  id, name: id, text: '', icon: null, attr: 'ear', tier: 1, tags: [], weapon: null, archetype: 'ring', target: 'self', rate: 1,
  damage: { blow: [10, 10] }, weaponPct: 0, eff: 1, crit: 0, params: { radius: 3 }, mods: [], fx: {},
}, more));
voice('t.ring', { rate: 2 });
voice('t.ring-drag', { damage: { drag: [40, 40] }, params: { radius: 3, duration: 1 } });
voice('t.ring-swell', { damage: { swell: [10, 10] }, params: { radius: 4, fill: 1 } });
voice('t.fall', { damage: { swell: [10, 10] }, target: 'nearest', params: { reach: 10, radius: 2, fill: 0.5 } });
voice('t.plumb', { damage: { swell: [10, 10] }, target: 'mark', params: { radius: 2.5, fill: 1, still: 10, stillMost: 100 } });
voice('t.rap', { archetype: 'rap', target: 'nearest', params: { reach: 8, count: 2 } });
voice('t.rap-splash', { archetype: 'rap', target: 'nearest', params: { reach: 8, splash: 1.5 } });
voice('t.tell', { archetype: 'rap', target: 'nearest', damage: { drag: [40, 40] },
  params: { reach: 8, splash: 2, strokes: 3, strokesLarge: 6, strokesElite: 9, pass: 2 } });
voice('t.spark', { archetype: 'spark', target: 'nearest', params: { reach: 10, speed: 15, size: 0.2 } });
voice('t.pierce', { archetype: 'spark', target: 'nearest', params: { reach: 10, speed: 15, size: 0.2 }, mods: [{ stat: 'pierce', op: 'flat', value: 1 }] });
voice('t.cone', { archetype: 'cone', target: 'nearest', params: { length: 6, angle: 60 } });
voice('t.bar', { archetype: 'bar', target: 'self', params: { length: 7, width: 1 } });
voice('t.cone-swell', { archetype: 'cone', target: 'nearest', damage: { swell: [10, 10] }, params: { length: 6, angle: 60, fill: 0.5 } });
voice('t.cone-drag', { archetype: 'cone', target: 'nearest', damage: { drag: [40, 40] }, params: { length: 6, angle: 60, duration: 1 } });
voice('t.bar-drag', { archetype: 'bar', target: 'self', damage: { drag: [40, 40] }, params: { length: 7, width: 1, duration: 1 } });
voice('t.spark-swell', { archetype: 'spark', target: 'nearest', damage: { swell: [10, 10] }, params: { reach: 10, speed: 15, splash: 1.5, fill: 0.5 } });
voice('t.idle', { rate: 0 });
voice('t.beat', { params: { radius: 3, beat: 1.1, beatMost: 3 } });
voice('t.count', { params: { radius: 2.5, byCount: 3 } });
voice('t.hitch', { target: 'crossing', params: { radius: 2 } });
voice('t.breath', { archetype: 'cone', target: 'step', params: { length: 4, angle: 60, held: 2, heldMost: 3 } });
voice('t.draw', { archetype: 'spark', target: 'ahead', params: { reach: 6, speed: 15, size: 0.2, behind: 1, rearGrow: 10, rearWide: 0.5, rearMost: 10 } });
const enemy = (id, more) => Defs.add('enemy', Object.assign({
  id, name: id, puppet: id, radius: 0.4, life: 100, damage: 5, speed: 2, xp: 1, cost: 1, loot: null, ai: 'chase', aiParams: {},
  attacks: [], guard: {}, size: 'small', press: 0, tags: [],
}, more));
enemy('t.small');
enemy('t.large', { size: 'large', radius: 0.7 });
Defs.add('prop', { id: 't.post', puppet: 't.post', radius: 0.5 });
Defs.add('zone', Object.assign({}, plain(Defs.get('zone', 'debug')), { id: 't.posts', place: [{ prop: 't.post', x: 2, y: 0 }] }));

const EAR = { stat: 'ear', op: 'flat', value: 10 };
const inst = (id, i) => (id === null ? null : { uid: i + 1, id, level: 1, rope: 2, knots: [] });
const run = (voices, more = {}) => Sim.create(Object.assign({ zone: 'debug', seed: 1 }, more, {
  mods: [EAR, ...(more.mods || [])], voices: voices.map(inst),
}));
const spawn = (S, x, y, id = 't.small', opts) => Sim.spawnEnemy(S, id, x, y, opts);
const casts = (out, slot) => out.filter((e) => e.k === 'cast' && (slot === undefined || e.a === slot));
const harmOf = (e) => e.lifeMax - e.life;
const R = Stats.AILMENT, TOLLED = R['tolled-for'];

// ---- casting ----

test('a voice speaks by its rate when it finds something, and waits, ready, while it finds nothing', () => {
  const S = run(['t.ring']);
  assert.equal(casts(steps(S, 60)).length, 0, 'nobody within 3 m: no cast');
  assert.equal(S.skills[0].cd, 0, 'and it stays ready');
  spawn(S, 2, 0);
  const out = steps(S, 61);
  assert.deepEqual(casts(out).map((e) => [e.a, e.id, e.x, e.y]), [[0, 't.ring', 0, 0], [0, 't.ring', 0, 0], [0, 't.ring', 0, 0]],
    'at once, then every 0.5 s (rate 2): steps 0, 30 and 60');
  near(S.skills[0].cd, 0.5 - 0 / 60, 1e-9);
});

test('silenced: the last S.ringing.silent voices of the loadout are quiet, counted over voices, not empty places', () => {
  const S = run(['t.ring', null, 't.ring', 't.ring']);
  spawn(S, 2, 0);
  S.ringing = { silent: 1, back: 0 };
  assert.deepEqual([0, 1, 2, 3].map((i) => Skills.silenced(S, i)), [false, false, false, true]);
  assert.deepEqual([...new Set(casts(steps(S, 1)).map((e) => e.a))], [0, 2]);
  S.ringing.silent = 2;
  assert.deepEqual([0, 1, 2, 3].map((i) => Skills.silenced(S, i)), [false, false, true, true]);
  S.ringing.silent = 3;
  assert.deepEqual([0, 2, 3].map((i) => Skills.silenced(S, i)), [true, true, true], 'the empty place is passed over');
  assert.equal(casts(steps(S, 60)).length, 0);
  assert.equal(Skills.speak(S, 0, 1), false, 'a silenced voice cannot be made to speak');
});

test('no voice speaks while the player is Tolled-for', () => {
  const S = run(['t.ring', 't.rap']);
  spawn(S, 2, 0);
  S.player.condT[TOLLED] = 30;
  assert.equal(casts(steps(S, 120)).length, 0);
  assert.equal(Skills.speak(S, 0, 1), false);
  S.player.condT[TOLLED] = 0;
  assert.ok(casts(steps(S, 1)).length > 0);
});

test('Skills.speak: now, cooldown or not, and the cooldown runs on as it was; twice is two strokes 0.2 s apart', () => {
  const S = run(['t.ring', 't.idle']);
  spawn(S, 2, 0);
  steps(S, 1);                                               // it spoke: cd 0.5
  const cd = S.skills[0].cd;
  S.eventCount = 0;
  assert.equal(Skills.speak(S, 0, 2), true);
  assert.equal(casts(all(S)).length, 1);
  assert.equal(S.skills[0].cd, cd);
  // called between steps, the first stroke belongs to the step that follows (S.step 1), the second to step 13
  assert.equal(casts(steps(S, 12)).length, 0);
  assert.equal(casts(steps(S, 1)).length, 1, 'the second stroke, 12 steps on');
  assert.equal(Skills.speak(S, 1, 1), false, 'a voice that never speaks (rate 0) is not made to');
  assert.equal(Skills.speak(S, 5, 1), false, 'nor a place that is not there');
});

test('target rules: nearest, farthest, densest, random (from S.rng.combat) and aim, within reach and alive', () => {
  const S = run([]);
  const a = spawn(S, 2, 0), b = spawn(S, 0, 4), c = spawn(S, -6, 0);
  spawn(S, 12, 0);                                           // out of reach
  const d1 = spawn(S, 0, -5);                                // and two close by it
  spawn(S, 0.8, -5); spawn(S, -0.8, -5.4);
  S.grid.rebuild(S.enemies);
  const out = [];
  const pick = (rule, count = 1) => { const n = Skills.pick(S, rule, 0, 0, 8, count, out); return out.slice(0, n); };
  assert.deepEqual(pick('nearest', 2), [a, b]);
  assert.deepEqual(pick('farthest'), [c], 'the far one at 12 m is out of reach');
  assert.deepEqual(pick('densest'), [d1], 'the middle of the three close together');
  const r1 = pick('random', 3).map((e) => e.uid);
  const T2 = run([]);
  [[2, 0], [0, 4], [-6, 0], [12, 0], [0, -5], [0.8, -5], [-0.8, -5.4]].forEach(([x, y]) => spawn(T2, x, y));
  T2.grid.rebuild(T2.enemies);
  const n2 = Skills.pick(T2, 'random', 0, 0, 8, 3, out);
  assert.deepEqual(out.slice(0, n2).map((e) => e.uid), r1, 'the same stream picks the same');
  S.player.aimX = 0; S.player.aimY = -1;
  assert.deepEqual(pick('aim'), [d1], 'the nearest within 30 degrees of the aim');
  a.life = 0;
  assert.deepEqual(pick('nearest'), [b], 'a body with no life left is passed over');
});

// ---- ring ----

test('ring, a Blow: every body whose edge is within the radius, at once, and a mark that lies 0.25 s', () => {
  const S = run(['t.ring']);
  const inside = spawn(S, 2.5, 0), edge = spawn(S, 0, 3.35), out = spawn(S, -3.45, 0);
  const ev = steps(S, 1);
  assert.deepEqual([harmOf(inside), harmOf(edge), harmOf(out)], [10, 10, 0]);   // edges at 2.1, 2.95 and 3.05 m
  assert.equal(ev.filter((e) => e.k === 'hit').length, 2);
  const marks = S.areas.items.slice(0, S.areas.n).filter((a) => a.alive && a.team === 0);
  assert.equal(marks.length, 1);
  assert.deepEqual([marks[0].state, marks[0].r, marks[0].skill, marks[0].tick], [Skills.MARK, 3, 0, 0]);
  steps(S, 15);
  assert.equal(S.areas.items.slice(0, S.areas.n).filter((a) => a.alive && a.team === 0).length, 0, 'gone after 0.25 s');
});

test('ring, a Drag zone: laid where it was cast, it bites every body inside four times a second for its duration', () => {
  const S = run(['t.ring-drag', 't.idle']);
  const inside = spawn(S, 2, 0), out = spawn(S, 4, 0);
  steps(S, 1);
  S.skills[0].cd = 99;                                       // one zone only
  steps(S, 89);
  near(harmOf(inside), 4 * 10);                              // 1 s: four ticks of 40 a second / 4, Braced so not guarded
  assert.equal(harmOf(out), 0);
  near(inside.life + 40, 100);
});

test('ring, a Swell: an area of team 0 fills for its fill and then lands, bare, on the body inside it then', () => {
  const S = run(['t.ring-swell']);
  const e = spawn(S, 3, 0), late = spawn(S, 6, 0);
  steps(S, 1);
  const a = S.areas.items.slice(0, S.areas.n).find((x) => x.alive && x.team === 0);
  assert.deepEqual([a.state, a.a0, a.r], [Skills.FILL, 1, 4], 'spreading from the player');
  steps(S, 29);
  near(a.t / (a.t + a.ttl), 0.5, 0.02, 'half full at 0.5 s');
  assert.equal(harmOf(e), 0, 'nothing before it lands');
  late.x = 3.5;                                              // walks in before it lands
  e.pose = Dmg.POSE.braced;
  steps(S, 30);
  assert.equal(a.state, Skills.FILL, 'shown at the step that began at 0 s, it has not landed at the one that began at 0.98 s');
  steps(S, 1);
  assert.equal(a.state, Skills.LANDED, 'it lands in the step that begins 1 s after it was shown');
  assert.deepEqual([harmOf(e), harmOf(late)], [10, 10], 'a Swell is bare: the Braced take it in full');
});

test('a spreading Swell spares the dead in lee within 3 m; a falling one has no lee', () => {
  const S = Sim.create({ zone: 't.posts', seed: 1, mods: [EAR], voices: [inst('t.ring-swell', 0)] });   // a post at (2, 0)
  const behind = spawn(S, 3.4, 0), open = spawn(S, 0, 3.4);
  steps(S, 61);
  assert.deepEqual([harmOf(behind), harmOf(open)], [0, 10], 'the post stands on the line within 3 m of it');
  const T2 = Sim.create({ zone: 't.posts', seed: 1, mods: [EAR], voices: [inst('t.fall', 0)] });
  const under = spawn(T2, 3.4, 0);
  steps(T2, 31);
  assert.equal(harmOf(under), 10, 'falling on it: no lee');
  // the dead shelter each other: a large body between
  const T3 = run(['t.ring-swell']);
  const small = spawn(T3, 3.6, 0);
  spawn(T3, 2.2, 0, 't.large');
  steps(T3, 61);
  assert.equal(harmOf(small), 0);
});

test('ring round the mark: Plumb\'s mark is where the player last stood still 0.5 s, and its harm grows 10% a second it stays', () => {
  const S = run(['t.plumb']);
  steps(S, 29);
  assert.equal(S.voices.marked, false);
  steps(S, 1);                                               // 0.5 s still
  assert.deepEqual([S.voices.marked, S.voices.markX, S.voices.markY], [true, 0, 0]);
  steps(S, 60, frame(1, 0));                                 // walk 4.5 m east: the mark stays where it was
  assert.equal(S.voices.markX, 0);
  const e = spawn(S, 0.5, 0);
  const t0 = S.t, markT = S.voices.markT;
  steps(S, 1);
  const a = S.areas.items.slice(0, S.areas.n).find((x) => x.alive && x.team === 0);
  assert.deepEqual([a.x, a.y, a.a0], [0, 0, 0], 'falling on the mark');
  const part = 1 + 10 * (t0 - markT + 1) / 100;              // the seconds held when it lands, 1 s on
  near(a.a1, part, 1e-9);
  steps(S, 60);
  near(harmOf(e), 10 * part, 1e-9);
  // standing again elsewhere moves it
  steps(S, 30);
  assert.ok(Math.abs(S.voices.markX - S.player.x) < 1e-9);
});

// ---- rap ----

test('rap, a Blow: the bodies the rule picks within reach, count of them, and with splash the dead round each', () => {
  const S = run(['t.rap']);
  const a = spawn(S, 2, 0), b = spawn(S, -3, 0), c = spawn(S, 0, 5), far = spawn(S, 9, 0);
  steps(S, 1);
  assert.deepEqual([a, b, c, far].map(harmOf), [10, 10, 0, 0], 'the two nearest within 8 m');
  const T2 = run(['t.rap-splash']);
  const t = spawn(T2, 3, 0), close = spawn(T2, 4.3, 0), apart = spawn(T2, 5, 0);
  steps(T2, 1);
  assert.deepEqual([t, close, apart].map(harmOf), [10, 10, 0], 'within 1.5 m of the struck one');
});

test('rap, Drag: the told body gets 3 strokes if small, 6 if large, 9 if elite, four a second, biting all within splash', () => {
  const told = (id, opts) => {
    const S = run(['t.tell', 't.idle']), e = spawn(S, 3, 0, id, opts), by = spawn(S, 3, 1.5);
    steps(S, 1);
    S.skills[0].cd = 99;
    steps(S, 179);
    return [harmOf(e), harmOf(by)];
  };
  assert.deepEqual(told('t.small'), [30, 30], '3 x 10 on it and on its neighbour 1.5 m off');
  assert.deepEqual(told('t.large'), [60, 60]);
  assert.deepEqual(told('t.small', { rank: 1 }).map((x) => Math.round(x)), [90, 90]);
});

test('rap, Drag: strokes left when the told body falls are told on its nearest neighbour, counting double', () => {
  const S = run(['t.tell', 't.idle']);
  const weak = spawn(S, 3, 0), next = spawn(S, 6, 0);       // 3 m apart: outside each other's splash
  weak.life = 15;
  steps(S, 1);
  S.skills[0].cd = 99;
  steps(S, 89);
  assert.ok(weak.alive === false || weak.life <= 0, 'it fell at the second stroke');
  near(harmOf(next), 2 * 10, 1e-9, 'the third stroke, on the neighbour, twice as hard');
});

// ---- spark ----

test('spark: a thrown thing flies at the nearest and strikes the first body it meets; pierce lets it pass through', () => {
  const S = run(['t.spark', 't.idle']);
  const first = spawn(S, 3, 0), second = spawn(S, 5, 0), off = spawn(S, 3, 1.2);
  steps(S, 1);
  S.skills[0].cd = 99;
  assert.equal(S.shots.n, 1);
  steps(S, 60);
  assert.deepEqual([first, second, off].map(harmOf), [10, 0, 0]);
  assert.equal(S.shots.n, 0, 'it is gone');
  const T2 = run(['t.pierce', 't.idle']);
  const p1 = spawn(T2, 3, 0), p2 = spawn(T2, 5, 0), p3 = spawn(T2, 7, 0);
  steps(T2, 1);
  T2.skills[0].cd = 99;
  steps(T2, 60);
  assert.deepEqual([p1, p2, p3].map(harmOf), [10, 10, 0], 'through one, stopped by the second');
});

// ---- cone ----

test('cone: a wedge of its length and angle toward the nearest strikes what is inside and nothing behind, beside or beyond', () => {
  const S = run(['t.cone']);
  const aim = spawn(S, 2, 0), inside = spawn(S, 5, 1), behind = spawn(S, -2.2, 0), beside = spawn(S, 2, 2.5), beyond = spawn(S, 7, 0);
  steps(S, 1);
  // 6 m long, 60 degrees wide: (5, 1) is 11 degrees off; (2, 2.5) is 51 degrees off, beyond 30 and its own 0.4 m
  assert.deepEqual([aim, inside, behind, beside, beyond].map(harmOf), [10, 10, 0, 0, 0]);
});

// ---- bar ----

test('bar: the line from the post (where the vigil began) to the player strikes what lies on it; past its length it drops', () => {
  const S = run(['t.bar', 't.idle']);
  S.player.x = 5;
  const on = spawn(S, 2.5, 0.3), off = spawn(S, 2.5, 1.5), past = spawn(S, 6.5, 0);
  steps(S, 1);
  assert.deepEqual([on, off, past].map(harmOf), [10, 0, 0], 'within 0.5 m (and its radius) of the line, between its ends');
  assert.deepEqual([S.skills[0].a0, S.skills[0].a1, S.skills[0].a2], [0, 0, 1], 'the post stands where the vigil began');
  const T2 = run(['t.bar']);
  T2.player.x = 7.5;
  spawn(T2, 3, 0);
  assert.equal(casts(steps(T2, 30)).length, 0, '7.5 m from the post: the bar has dropped');
});

test('cone and bar, Drag and Swell: the zone or the Swell takes their shape, and strikes inside it only', () => {
  // a wedge of Swell spreading from the player toward the nearest: (2, 0) is the aim, (4, 1.5) inside, (2, 2.5) beside
  const S = run(['t.cone-swell', 't.idle']);
  const aim = spawn(S, 2, 0), inside = spawn(S, 4, 1.5), beside = spawn(S, 2, 2.5);
  steps(S, 1);
  S.skills[0].cd = 99;
  const a = S.areas.items.slice(0, S.areas.n).find((x) => x.alive && x.team === 0);
  assert.deepEqual([a.state, a.a0, a.r], [Skills.FILL, 1, 6], 'spreading, 6 m long');
  near(a.a3, Math.PI / 3); near(a.angle, 0);
  steps(S, 30);
  assert.deepEqual([aim, inside, beside].map(harmOf), [10, 10, 0]);
  // a wedge of Drag: it ticks four times a second on what is inside
  const D = run(['t.cone-drag', 't.idle']);
  const d1 = spawn(D, 3, 0), d2 = spawn(D, -3.5, 0);
  steps(D, 1);
  D.skills[0].cd = 99;
  steps(D, 59);
  assert.deepEqual([d1, d2].map(harmOf), [40, 0], 'four ticks of 10 inside, nothing behind');
  // a lane of Drag from the post to the player
  const B = run(['t.bar-drag', 't.idle']);
  B.player.x = 5;
  const on = spawn(B, 2.5, 0.3), off = spawn(B, 2.5, 1.6);
  steps(B, 1);
  B.skills[0].cd = 99;
  const lane = B.areas.items.slice(0, B.areas.n).find((x) => x.alive && x.team === 0);
  assert.deepEqual([lane.state, lane.len, lane.r, lane.tick], [Skills.ZONE, 5, 0.5, 0.25]);
  steps(B, 59);
  assert.deepEqual([on, off].map(harmOf), [40, 0]);
});

test('spark, Swell: it falls where the thrown thing meets a body, a circle of its splash', () => {
  const S = run(['t.spark-swell', 't.idle']);
  const hit = spawn(S, 3, 0), by = spawn(S, 3.5, 1), far = spawn(S, 3, 3);
  steps(S, 1);
  S.skills[0].cd = 99;
  let opened = null;
  for (let i = 0; i < 30 && !opened; i++) {
    steps(S, 1);
    opened = S.areas.items.slice(0, S.areas.n).find((x) => x.alive && x.team === 0) || null;
  }
  assert.ok(opened, 'the shot opened its area');
  assert.deepEqual([opened.state, opened.a0, opened.r], [Skills.FILL, 0, 1.5], 'a falling circle');
  assert.equal(S.shots.n, 0, 'and the shot is spent');
  steps(S, 40);
  assert.deepEqual([hit, by, far].map(harmOf), [10, 10, 0]);
});

// ---- the Change-ringer's voices ----

test('the Change-ringer\'s voices: each speaks, and each leaves what the scene draws, with the shape of its own attack', () => {
  const S = Sim.create(Object.assign({ zone: 'debug', seed: 4 }, Player.classRun('change-ringer')));
  for (const [x, y] of [[1.5, 0], [-1.5, 0.5], [0, 2], [5, 0], [2, -2]]) spawn(S, x, y);
  const out = [], seen = new Map();                          // each voice's areas, and the attack each carries
  for (let i = 0; i < 120; i++) {
    out.push(...steps(S, 1));
    for (const a of S.areas.items.slice(0, S.areas.n)) if (a.alive && a.team === 0) seen.set(S.skills[a.skill].inst.id, a.def && a.def.id);
  }
  assert.deepEqual([...new Set(casts(out).map((e) => e.id))].sort(), ['plumb', 'tellers', 'tenor-stroke']);
  assert.deepEqual([...seen.entries()].sort(), [['plumb', 'plumb'], ['tellers', 'tellers'], ['tenor-stroke', 'tenor-stroke']]);
  assert.equal(Defs.get('attack', 'plumb').kind, 'fall');
  assert.equal(Defs.get('attack', 'tellers').kind, 'zone');
  assert.ok(out.filter((e) => e.k === 'hit').length > 0);
});

test('the Change-ringer\'s voices have the design\'s numbers', () => {
  const tenor = Defs.get('voice', 'tenor-stroke'), tellers = Defs.get('voice', 'tellers'), plumb = Defs.get('voice', 'plumb');
  assert.deepEqual([tenor.archetype, tenor.target, tenor.params.radius, 1 / tenor.rate], ['ring', 'self', 2.5, 3], 'a Blow ring 2.5 m round you every 3 s');
  assert.deepEqual(Object.keys(tenor.damage), ['blow']);
  assert.deepEqual([tellers.params.strokes, tellers.params.strokesLarge, tellers.params.strokesElite, tellers.params.pass, tellers.params.reach, tellers.params.splash],
    [3, 6, 9, 2, 8, 2]);
  assert.deepEqual(Object.keys(tellers.damage), ['drag']);
  assert.deepEqual([plumb.target, plumb.params.radius, plumb.params.still, plumb.params.stillMost], ['mark', 2.5, 10, 100]);
  assert.deepEqual(Object.keys(plumb.damage), ['swell']);
  assert.deepEqual(plain(Defs.get('class', 'change-ringer').voices), ['tenor-stroke', 'tellers', 'plumb'], 'Tenor Stroke first: the pull rings it');
  // the shares at level 1: Hand 10 for the two Hand voices, Knee 5 of the 10 Plumb wants
  const S = Sim.create(Object.assign({ zone: 'debug', seed: 1 }, Player.classRun('change-ringer')));
  assert.deepEqual(plain(S.skills.map((s) => s.sheet.share)), [1, 1, 0.5]);
});

// ---- the whole package, twice ----

// a stand-in for the dead's behaviour: every body walks at the player at its speed
function chase(S) {
  const p = S.player;
  for (const e of S.enemies.items.slice(0, S.enemies.n)) {
    if (!e.alive) continue;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    if (d < 0.9) { e.vx = 0; e.vy = 0; continue; }
    e.vx = dx / d * e.speed; e.vy = dy / d * e.speed;
    e.x += e.vx / 60; e.y += e.vy / 60;
  }
}
function play(seed) {
  const S = Sim.create(Object.assign({ zone: 'debug', seed }, Player.classRun('change-ringer')));
  for (let i = 0; i < 40; i++) spawn(S, Math.cos(i * 0.9) * (6 + i % 5), Math.sin(i * 0.9) * (6 + i % 5), i % 7 === 0 ? 't.large' : 't.small');
  for (let i = 0; i < 900; i++) {
    chase(S);
    const f = frame(Math.sign(Math.sin(i / 11)) * 0.9, Math.cos(i / 70) * 0.3);
    f.trade = i % 400 === 50;
    Sim.step(S, f);
  }
  return S;
}

test('the same seed twice gives the same run, and another seed another', () => {
  const a = play(11), b = play(11), c = play(12);
  assert.equal(Sim.hash(a), Sim.hash(b));
  assert.ok(a.kills > 0, 'the voices laid some of the dead');
  assert.notEqual(Sim.hash(a), Sim.hash(c));
  assert.deepEqual([a.kills, a.player.life, a.wounds.n], [b.kills, b.player.life, b.wounds.n]);
});

// ---- what the voices found blank need (the third package) ----

test('ring, beat: two forks a beat apart; each ring is beatMost x cos^2 of their phase, swelling and fading once a beat', () => {
  const S = run(['t.beat']), e = spawn(S, 2, 0);             // rate 1 and beat 1.1: the forks beat once every 11 s
  steps(S, 1);
  near(harmOf(e), 30, 1e-9, 'at the start the forks sound together: three times');
  const T = run(['t.beat']);
  steps(T, 330);                                             // 5.5 s: half a beat, the forks half a beat apart
  const f = spawn(T, 2, 0);
  steps(T, 1);
  near(harmOf(f), 0, 1e-9, 'all but silent');
  const U = run(['t.beat']);
  steps(U, 165);                                             // a quarter of a beat: cos^2 of 45 degrees
  const g = spawn(U, 2, 0);
  steps(U, 1);
  near(harmOf(g), 15, 1e-9);
});

test('ring, byCount: its harm is multiplied by the dead it catches, byCount at most', () => {
  const S = run(['t.count']), a = spawn(S, 1, 0), b = spawn(S, -1, 0);
  steps(S, 1);
  assert.deepEqual([harmOf(a), harmOf(b)], [20, 20]);
  const T = run(['t.count']), many = [[1, 0], [-1, 0], [0, 1], [0, -1], [1.2, 1.2]].map(([x, y]) => spawn(T, x, y));
  steps(T, 1);
  assert.ok(many.every((e) => Math.abs(harmOf(e) - 30) < 1e-9), 'five caught, three at most');
});

test('target crossing: the voice speaks where the player\'s step crosses its own wake, and on no other step', () => {
  const S = run(['t.hitch']), W = 120;
  // a wake laid from (1, -2) south to (1, 1.8), as 22-enemies.js keeps one (S.wake is its slot: here laid by hand)
  const wake = { n: 0, head: W - 1, x: new Float64Array(W), y: new Float64Array(W) };
  for (let i = 0; i < 20; i++) { wake.head = (wake.head + 1) % W; wake.x[wake.head] = 1; wake.y[wake.head] = -2 + i * 0.2; wake.n++; }
  S.wake = wake;
  const e = spawn(S, 1, 1);
  const out = casts(steps(S, 30, frame(1, 0)), 0);
  assert.equal(out.length, 1, 'once, as the step crosses the line');
  near(out[0].x, 1, 1e-9);
  near(out[0].y, 0, 1e-9);
  assert.equal(harmOf(e), 10);
  assert.equal(casts(steps(S, 60, frame(1, 0)), 0).length, 0, 'walking on, it crosses nothing');
});

test('target step: the cone speaks on the first step after standing still, toward that step, longer for each second stood', () => {
  const S = run(['t.breath']), ahead = spawn(S, 0, -7.5), side = spawn(S, 5, 0);   // ahead: beyond 4 m, within 8 m
  assert.equal(casts(steps(S, 120)).length, 0, 'standing, it waits');
  const out = steps(S, 1, frame(0, -1));                    // the first step, north
  assert.equal(casts(out).length, 1);
  const a = S.areas.items.slice(0, S.areas.n).find((x) => x.alive && x.team === 0);
  near(a.r, 4 + 2 * 2, 1e-9, '4 m, and 2 m for each of the two seconds stood');
  near(a.angle, -Math.PI / 2, 1e-9);
  assert.ok(harmOf(ahead) > 0 && harmOf(side) === 0);
  assert.equal(casts(steps(S, 90, frame(0, -1))).length, 0, 'walking on, it does not speak again');
  assert.equal(Skills.speak(S, 0, 1), true, 'the pull still makes it speak, the way the player faces');
});

test('target ahead: thrown straight the way the player faces and straight back; the one behind stronger and wider as the heading holds', () => {
  const S = run(['t.draw']);
  steps(S, 1, frame(1, 0));
  const shots = S.shots.items.slice(0, S.shots.n).filter((o) => o.alive);
  assert.deepEqual(plain(shots.map((o) => Math.sign(o.vx)).sort()), [-1, 1], 'one ahead, one behind, with nothing in reach');
  const T = run(['t.draw']);
  T.skills[0].cd = 99;
  steps(T, 126, frame(1, 0));
  T.skills[0].cd = 0;
  steps(T, 1, frame(1, 0));
  const held = T.knots.straight, back = T.shots.items.slice(0, T.shots.n).filter((o) => o.alive && o.vx < 0).pop();
  assert.ok(held >= 2 - 1e-9);
  near(back.part, 1 + 0.1 * held, 1e-9);
  near(back.r, 0.2 + 0.5 * held, 1e-9);
});

test('the voices found blank: the design\'s Hand-bell and the pool\'s others, each with its kind among its tags and its shape', () => {
  const v = (id) => Defs.get('voice', id);
  assert.deepEqual([v('hand-bell').archetype, v('hand-bell').target, v('hand-bell').params.radius], ['ring', 'self', 2]);
  near(1 / v('hand-bell').rate, 1.5, 1e-9);
  assert.deepEqual([v('beating-pair').params.radius, v('beating-pair').params.beat, v('beating-pair').rate], [4, 1.1, 1]);
  assert.deepEqual([v('held-breath').target, v('held-breath').params.length, v('held-breath').params.held, v('held-breath').params.heldMost,
    v('held-breath').params.angle], ['step', 4, 2, 3, 60]);
  assert.deepEqual([v('hitch').target, v('hitch').params.radius, v('hitch').params.byCount], ['crossing', 2.5, 12]);
  assert.deepEqual([v('long-draw').target, v('long-draw').params.rearGrow, v('long-draw').params.rearWide, v('long-draw').params.rearMost],
    ['ahead', 10, 0.5, 10]);
  for (const def of Defs.all('voice').filter((d) => !d.id.startsWith('t.'))) {
    assert.ok(def.tags.includes(Object.keys(def.damage)[0]), `${def.id} carries the tag of its kind of harm`);
    assert.ok(Defs.has('attack', def.id), `${def.id} has the shape the scene draws`);
    const want = def.tags.includes('still') ? 'knee' : def.tags.includes('moving') ? 'heel' : def.tags.includes('timed') ? 'ear' : null;
    if (want) assert.equal(def.attr, want, `${def.id}: a voice tagged still, moving or timed wants Knee, Heel or Ear`);
  }
  // each speaks in a run: standing, then walking east or west, by turns
  const S = run(['hand-bell', 'beating-pair', 'held-breath', 'long-draw']);
  for (const [x, y] of [[1.5, 0], [-1.5, 0.5], [0, 2], [3, 0], [0, -3]]) spawn(S, x, y);
  const out = [];
  for (let i = 0; i < 240; i++) out.push(...steps(S, 1, i % 80 < 40 ? STILL : frame(i % 160 < 80 ? 1 : -1, 0)));
  assert.deepEqual([...new Set(casts(out).map((e) => e.id))].sort(), ['beating-pair', 'hand-bell', 'held-breath', 'long-draw']);
});
