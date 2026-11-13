// tests/sim/26-director.test.js: the vigil's director (src/js/26-director.js): each toll's effects (the threat, the
// count, Hum, a lychgate at every third toll, the keeper at the eighth), the dead rising by the timeline and its events,
// drops on a kill, mourning round a fallen elite, lychgates and ringing down, the far lychgate of Tolled-for and the
// outcome 'spared', the Dial's shadow, the danger past the eighth toll, and the turned favours whose rules live here.
// The kernel and the vigil's systems are loaded without the combat package, in a test district of the test's own,
// laid out like the Dial; a toll is brought on at once by moving S.tollAt.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');

const KERNEL = ['00-core.js', '01-defs.js', '02-pool-grid.js', '10-stats.js', '20-sim.js', '29-world.js', '30-modes-curves.js'];
const VIGIL = ['22-enemies.js', '25-boss.js', '26-director.js', '27-favours.js', '40-favours.js'];
const DT = 1 / 60;

function world() {
  const sim = loadSim({ only: [...KERNEL, ...VIGIL] }), { Defs } = sim;
  // the player stands Braced, as a player standing still does in the game (21-player.js and 11-damage.js are not
  // loaded): the crowd does not move it
  sim.Sim.field('player', 'pose', 1);
  sim.Dmg.POSE = { still: 0, braced: 1, moving: 2, striding: 3 };
  const zone = plain(Defs.get('zone', 'debug'));
  const enemy = (id, more) => Object.assign({
    id, name: id, puppet: 'debug.husk', radius: 0.35, life: 20, damage: 3, speed: 2.4, xp: 2, cost: 1, loot: null, ai: 'wake',
    aiParams: {}, attacks: [], guard: {}, size: 'small', press: 0.5, tags: [],
  }, more);
  Defs.add('enemy', enemy('test.walker'));
  Defs.add('enemy', enemy('test.heavy', { size: 'large', radius: 0.7, cost: 5, life: 80 }));
  Defs.add('boss', Object.assign(enemy('test.keeper', { size: 'large', radius: 1.2, life: 1000, ai: 'keeper', cost: 0 }), {
    arena: { radius: 30 }, phases: [{ until: 0, speed: 1, onEnter: [], loop: [] }],
  }));
  Defs.add('trait', { id: 'test.square.sturdy', name: 'Sturdy', mods: [{ stat: 'life-max', op: 'inc', value: 50 }] });
  Defs.add('prop', { id: 'test.post', puppet: 'debug.husk', radius: 0.75 });
  Defs.add('prop', { id: 'test.stone', puppet: 'debug.husk', radius: 0.65 });
  Defs.add('voice', {
    id: 'test.voice', name: 'Voice', text: '', icon: null, attr: 'hand', tier: 1, tags: [], weapon: null, archetype: 'ring',
    target: 'self', rate: 0.3, damage: { blow: [1, 2] }, weaponPct: 0, eff: 1, crit: 0, params: {}, mods: [], fx: {},
  });
  const D = 14.849242, place = [{ prop: 'test.post', x: 0, y: 0, role: 'bell-post' }];
  [[0, -21, true], [D, -D, true], [21, 0], [D, D, true], [0, 21], [-D, D, true], [-21, 0], [-D, -D, true]].forEach(([x, y, mark]) => {
    place.push(mark ? { prop: 'test.stone', x, y, role: 'landmark' } : { prop: 'test.stone', x, y });
  });
  Defs.add('zone', Object.assign({}, zone, {
    id: 'test.square', kind: 'district', region: { radius: 35 }, start: { x: 0, y: 7 }, place, props: [],
    timeline: [
      { toll: 0, rate: 1, cap: 30, pool: [{ enemy: 'test.walker', w: 10 }] },
      { toll: 1, rate: 2, cap: 60, pool: [{ enemy: 'test.walker', w: 5 }, { enemy: 'test.heavy', w: 5 }] },
      { toll: 2, rate: 3, cap: 90, pool: [{ enemy: 'test.walker', w: 8 }, { enemy: 'test.heavy', w: 2 }] },
      { toll: 4, rate: 4, cap: 120, pool: [{ enemy: 'test.walker', w: 10 }] },
    ],
    overtoll: { rateMul: 1.3, levelPer: 2, rewardPer: 0.25 },
    events: [
      { toll: 1, kind: 'elite', enemy: 'test.walker' },
      { toll: 2, kind: 'elite', enemy: 'test.walker', count: 2, traits: ['test.square.sturdy'] },
      { toll: 3, kind: 'swarm', enemy: 'test.walker', shape: 'ring', count: 10 },
    ],
    boss: 'test.keeper', rules: { overElites: 2 }, districtRules: ['dial.shadow'], ordinal: 1,
  }));
  assert.deepEqual(plain(Defs.finalize()), []);
  return sim;
}

function vigil(sim, extra) {
  const S = sim.Sim.create(Object.assign({ zone: 'test.square', seed: 11 }, extra));
  return S;
}
const voices = (n) => Array.from({ length: n }, (_, i) => ({ uid: i + 1, id: 'test.voice', level: 1, rope: 2, knots: [null, null] }));

function eventsOf(S, k) {
  const out = [];
  for (let i = 0; i < S.eventCount; i++) { const e = S.events[(S.eventStart + i) % S.events.length]; if (k === undefined || e.k === k) out.push(plain(e)); }
  return out;
}
// steps, collecting the events of kind k
function steps(sim, S, n, k, each) {
  const got = [];
  for (let i = 0; i < n && S.phase === 'play'; i++) {
    sim.Sim.step(S);
    for (const e of eventsOf(S, k)) got.push(Object.assign(e, { t: S.t - DT }));
    if (each) each(S, i);
  }
  return got;
}
// brings the next toll on at once, and runs the step in which its effects come
function toll(sim, S, k) {
  S.tollAt = S.step + 1;
  sim.Sim.step(S);                                  // the clock rings it at the end of this step
  return steps(sim, S, 1, k);                       // and the director takes its effects in the next
}
const alive = (S) => S.enemies.items.slice(0, S.enemies.n).filter((e) => e.alive);

test('the start rings the count of the first interval; every toll raises the threat and rings the count of the next', () => {
  const sim = world(), S = vigil(sim);
  const first = steps(sim, S, 1, 'count');
  assert.deepEqual(first.map((e) => [e.a, e.b, e.id]), [[3, 0, null]], 'small dead only: three tellers, no elite, no lychgate');
  let c = toll(sim, S, 'count');
  assert.equal(S.toll, 1);
  assert.equal(S.threat, 1, 'the threat + 1');
  assert.deepEqual(c.map((e) => [e.a, e.b, e.id]), [[9, 1, null]], 'half large by weight: nine tellers, and one elite');
  c = toll(sim, S, 'count');
  assert.deepEqual(c.map((e) => [e.a, e.b, e.id]), [[6, 2, 'gate']], 'a mixed crowd, two elites, and a lychgate at the end of it');
  c = toll(sim, S, 'count');
  assert.equal(S.threat, 3);
  assert.deepEqual([c[0].x, c[0].y], [S.player.x, S.player.y], 'rung where the player stands');
});

test('a lychgate opens at every third toll, by a landmark; the keeper rises at the eighth', () => {
  const sim = world(), S = vigil(sim);
  steps(sim, S, 1);
  toll(sim, S);
  toll(sim, S);
  assert.equal(S.gate, null, 'none at the first two tolls');
  const opened = toll(sim, S, 'gate');
  assert.ok(S.gate !== null && opened.length === 1, 'one at the third');
  assert.equal(opened[0].a, 25, 'for 25 s');
  assert.equal(opened[0].b, 0, 'not the far one');
  const marks = S.props.filter((p) => p.role === 'landmark');
  const by = Math.min(...marks.map((m) => Math.hypot(m.x - S.gate.x, m.y - S.gate.y)));
  assert.ok(Math.abs(by - 2.4) < 0.05, `beside a landmark: ${by.toFixed(2)} m from it`);
  assert.ok(Math.abs(S.gate.until - (S.t - DT + 25)) < 1e-6);
  for (let k = 4; k < 8; k++) toll(sim, S);
  assert.equal(S.boss, null, 'no keeper before the eighth toll');
  toll(sim, S);
  assert.equal(S.toll, 8);
  assert.ok(S.boss !== null && S.boss.alive && S.boss.def.id === 'test.keeper' && S.boss.rank === sim.Sim.BOSS, 'the keeper rose');
  assert.equal(S.boss.level, 1 + 8, 'at the district\'s level and the eight tolls');
  assert.ok(Math.hypot(S.boss.x - S.player.x, S.boss.y - S.player.y) >= 11.9, 'not on top of the player');
  assert.equal(S.vigil.keeper, 1);
});

test('the dead rise by the timeline: its rate in cost a second, its cap, 26 m from the player and inside the district', () => {
  const sim = world(), S = vigil(sim);
  let far = 0, outside = 0, seen = 0;
  const known = new Set();
  steps(sim, S, 20 * 60, undefined, (S2) => {
    for (const e of alive(S2)) {
      if (known.has(e.uid)) continue;
      known.add(e.uid);
      seen++;
      if (Math.hypot(e.x, e.y) > 35) outside++;
      far = Math.max(far, Math.abs(Math.hypot(e.x - S2.player.x, e.y - S2.player.y) - 26));
    }
  });
  assert.ok(seen >= 18 && seen <= 21, `about 20 rose in 20 s at a rate of 1: ${seen}`);
  assert.equal(outside, 0, 'all inside the district');
  assert.ok(far < 1, `each 26 m from the player as it rose (or nearer, toward the middle): within ${far.toFixed(2)}`);
  steps(sim, S, 40 * 60);
  assert.ok(S.enemies.n <= 30, `never more than the cap: ${S.enemies.n}`);
  assert.equal(S.enemies.n, 30, 'and filled up to it');
});

test('elites rise evenly through their interval, with their traits; a swarm comes 4 s after its toll, in its shape', () => {
  const sim = world(), S = vigil(sim);
  steps(sim, S, 1);
  toll(sim, S);
  toll(sim, S);                                     // toll 2: two sturdy elites
  const start = S.t - DT;
  const risen = [];
  steps(sim, S, 74 * 60, undefined, (S2) => {
    for (const e of alive(S2)) if (e.rank === sim.Sim.ELITE && !risen.find((r) => r.uid === e.uid)) risen.push({ uid: e.uid, t: S2.t - DT, e });
  });
  assert.equal(risen.length, 2, 'two elites');
  assert.ok(Math.abs(risen[0].t - start - 25) < 0.05 && Math.abs(risen[1].t - start - 50) < 0.05, `at a third and two thirds: ${risen.map((r) => (r.t - start).toFixed(2))}`);
  const e = risen[0].e;
  assert.equal(e.traitN, 1);
  assert.equal(e.traits[0].id, 'test.square.sturdy');
  assert.ok(Math.abs(e.lifeMax - 20 * S.curves.enemyLife[e.level - 1] * 6 * 1.5) < 1e-6, 'its life: the def\'s, the level\'s, the elite\'s and its trait\'s');
  toll(sim, S);                                     // toll 3: a ring of ten, 4 s later
  const known = new Set(alive(S).map((o) => o.uid)), at = S.t - DT;
  let ring = null;
  steps(sim, S, 5 * 60, undefined, (S2) => {
    const fresh = alive(S2).filter((o) => !known.has(o.uid));
    fresh.forEach((o) => known.add(o.uid));
    if (ring === null && fresh.length >= 10) ring = { t: S2.t - DT, d: fresh.map((o) => Math.hypot(o.x - S2.player.x, o.y - S2.player.y)) };
  });
  assert.ok(ring !== null, 'ten rose in one step: the swarm');
  assert.ok(Math.abs(ring.t - at - 4) < 0.05, `4 s after the toll: ${(ring.t - at).toFixed(2)}`);
  assert.ok(ring.d.every((d) => Math.abs(d - 26) < 1), `in a ring 26 m round the player: ${ring.d.map((d) => d.toFixed(1))}`);
});

test('a kill drops an ember of its experience (more In Procession) and sometimes coin; an elite\'s fall brings mourning and a lychgate', () => {
  const sim = world(), S = vigil(sim), PROC = sim.Stats.RULE.procession, M = sim.Stats.RULE.mourning;
  steps(sim, S, 1);
  const a = sim.Sim.spawnEnemy(S, 'test.walker', 5, 5), b = sim.Sim.spawnEnemy(S, 'test.walker', 8, 5);
  b.condN[PROC] = 1;
  a.life = 0; b.life = 0;
  const drops = steps(sim, S, 1, 'drop');
  const embers = drops.filter((d) => d.a === 0);
  assert.equal(embers.length, 2, 'an ember each');
  assert.deepEqual(embers.map((d) => d.b).sort(), [2, 2.5], 'its experience, and a quarter more from the one In Procession');
  const pickups = S.pickups.items.slice(0, S.pickups.n).filter((o) => o.alive && o.kind === 0);
  assert.equal(pickups.length, 2);
  assert.ok(pickups.every((o) => o.ttl > 39 && o.r > 0), 'lying 40 s');
  // coin: a small body drops one now and then, an elite always six or more
  let coin = 0;
  for (let i = 0; i < 200; i++) { const w = sim.Sim.spawnEnemy(S, 'test.walker', 3, -3); w.life = 0; coin += steps(sim, S, 1, 'drop').filter((d) => d.a === 1).length; }
  assert.ok(coin > 5 && coin < 35, `about one small body in twelve drops coin: ${coin} of 200`);
  // an elite falls among the dead
  const elite = sim.Sim.spawnEnemy(S, 'test.walker', 10, -6, { rank: 1 });
  const mourner = sim.Sim.spawnEnemy(S, 'test.walker', 13, -6), far = sim.Sim.spawnEnemy(S, 'test.walker', 20, -6);
  const other = sim.Sim.spawnEnemy(S, 'test.walker', 10, -3, { rank: 1 });
  sim.Sim.step(S);
  elite.life = 0;
  const fell = steps(sim, S, 1);
  assert.ok(fell.some((e) => e.k === 'drop' && e.a === 1 && e.b >= 6), 'an elite drops six coin and more');
  assert.equal(mourner.condT[M] > 11.9 && mourner.condV[M], 2, 'full mourning within 8 m');
  assert.deepEqual([mourner.tx, mourner.ty], [elite.x, elite.y], 'facing where it fell');
  assert.equal(far.condT[M], 0, 'none beyond 8 m');
  assert.equal(other.condT[M], 0, 'no elite mourns');
  assert.ok(S.gate !== null && Math.hypot(S.gate.x - elite.x, S.gate.y - elite.y) < 1.5, 'a lychgate opened where it fell');
  assert.ok(fell.some((e) => e.k === 'gate' && e.a === 25));
});

// opens a lychgate on the player by laying an elite at its feet, and returns it
function gateOnPlayer(sim, S) {
  const e = sim.Sim.spawnEnemy(S, 'test.walker', S.player.x + 3, S.player.y, { rank: 1 });
  sim.Sim.step(S);
  e.life = 0;
  sim.Sim.step(S);
  S.player.x = S.gate.x; S.player.y = S.gate.y;
  return S.gate;
}

test('ringing down: six strokes a second apart, each banking a sixth of the coin and silencing a sixth of the voices; the sixth ends the vigil', () => {
  const sim = world(), S = vigil(sim, { voices: voices(6) });
  steps(sim, S, 1);
  S.coin = 60;
  const g = gateOnPlayer(sim, S);
  const struck = steps(sim, S, 7 * 60, 'stroke', (S2) => { S2.player.x = g.x; S2.player.y = g.y; });
  assert.deepEqual(struck.map((s) => s.a), [1, 2, 3, 4, 5, 6], 'six strokes');
  assert.ok(struck.every((s) => s.b === 10), 'each banking a sixth of the 60 coin');
  for (let k = 1; k < 6; k++) assert.ok(Math.abs(struck[k].t - struck[k - 1].t - 1) < 1e-6, 'a second apart');
  assert.equal(S.bank.coin, 60);
  assert.equal(S.coin, 0);
  assert.equal(S.ringing.silent, 6, 'every voice silenced');
  assert.equal(S.phase, 'ended');
  assert.equal(S.result.outcome, 'left');
  assert.equal(S.result.banked, 60);
});

test('driven out sooner, what was banked is kept, and the silenced voices come back one every 2 s', () => {
  const sim = world(), S = vigil(sim, { voices: voices(3) });
  steps(sim, S, 1);
  S.coin = 30;
  const g = gateOnPlayer(sim, S);
  steps(sim, S, Math.round(3.5 * 60), undefined, (S2) => { S2.player.x = g.x; S2.player.y = g.y; });
  assert.equal(g.strokes, 3);
  assert.equal(S.bank.coin, 15, 'three strokes banked half');
  assert.equal(S.ringing.silent, 2, 'three strokes of six silence half the voices, rounded up: two of three');
  S.player.x = g.x + 5;
  const back = [];
  steps(sim, S, 5 * 60, undefined, (S2) => { if (S2.ringing.silent < 2 - back.length) back.push(S2.t); });
  assert.equal(g.ring, 0, 'its ring starts over');
  assert.equal(S.bank.coin, 15, 'what was banked stays');
  assert.equal(S.coin, 15);
  assert.equal(back.length, 2, 'both voices came back');
  assert.ok(Math.abs(back[1] - back[0] - 2) < 0.05, 'one every 2 s');
  assert.equal(S.phase, 'play', 'and the vigil goes on');
});

test('Tolled-for: the far lychgate opens at the farthest edge; reached, the vigil ends spared with the haul lost', () => {
  const sim = world(), S = vigil(sim), T = sim.Stats.AILMENT['tolled-for'];
  steps(sim, S, 1);
  S.player.x = 10; S.player.y = 10;
  S.coin = 25;
  S.player.condT[T] = 30;
  const opened = steps(sim, S, 1, 'gate');
  assert.ok(S.gate && S.gate.far, 'the far lychgate');
  assert.equal(opened[0].b, 1);
  const d = Math.hypot(S.gate.x, S.gate.y), off = Math.hypot(S.gate.x - 10, S.gate.y - 10);
  assert.ok(d > 31 && off > 40, `at the edge, beyond the middle from the player: ${d.toFixed(1)} m out, ${off.toFixed(1)} m off`);
  assert.ok(Math.abs(S.gate.until - S.tollAt / 60 - 0.5) < 1e-6, 'open until the next toll');
  // a lychgate opening now cannot cover it
  const e = sim.Sim.spawnEnemy(S, 'test.walker', 0, 0, { rank: 1 });
  sim.Sim.step(S);
  e.life = 0;
  sim.Sim.step(S);
  assert.ok(S.gate.far, 'still the far one');
  S.player.x = S.gate.x; S.player.y = S.gate.y;
  sim.Sim.step(S);
  assert.equal(S.phase, 'ended');
  assert.equal(S.result.outcome, 'spared');
  assert.equal(S.coin, 0, 'the haul is lost');
});

test('the Dial\'s shadow: north as each toll rings, sunwise once round each interval; the dead walk faster in it', () => {
  const sim = world(), S = vigil(sim);
  steps(sim, S, 1);
  const lead = () => sim.Core.angleWrap(S.vigil.shade.from + S.vigil.shade.span);
  assert.ok(S.vigil.shade.on && Math.abs(S.vigil.shade.span - Math.PI / 2) < 1e-9, 'a wedge of 90 degrees');
  assert.ok(Math.abs(lead() + Math.PI / 2) < 0.01, `its leading edge points north at the start: ${lead()}`);
  steps(sim, S, Math.round(75 / 4 * 60) - 1);
  assert.ok(Math.abs(lead()) < 0.01, `a quarter of the interval on, east (sunwise from north): ${lead()}`);
  steps(sim, S, Math.round(75 / 4 * 60));
  assert.ok(Math.abs(lead() - Math.PI / 2) < 0.01, 'half way, south');
  assert.ok(sim.Enemies.shaded(S, 2, 10) && !sim.Enemies.shaded(S, 0, -10) && sim.Enemies.shaded(S, 7, 7), 'south and south-east of the post are in it; north is not');
  const w = sim.Sim.spawnEnemy(S, 'test.walker', 3, 12);
  sim.Sim.step(S);
  assert.ok(Math.abs(w.pace - w.speed * 1.3) < 1e-9, 'in it, 30% faster');
});

test('past the eighth toll the danger rises without end: the rate x1.3, the level +2 and the elites at every toll', () => {
  const sim = world(), S = vigil(sim);
  steps(sim, S, 1);
  for (let k = 1; k <= 8; k++) toll(sim, S);
  assert.equal(sim.Director.level(S), 9);
  // the budget one step adds, with the next to rise a heavy body that one step's budget cannot pay for
  const rateNow = () => {
    S.vigil.budget = 0;
    S.vigil.next = 'test.heavy';
    sim.Sim.step(S);
    return S.vigil.budget / DT;
  };
  const at8 = rateNow();
  assert.ok(Math.abs(at8 - 4) < 1e-6, `the last entry's rate at the eighth toll: ${at8}`);
  let elites = 0;
  for (let k = 9; k <= 16; k++) {
    toll(sim, S);
    elites += S.vigil.eliteN;
  }
  assert.equal(sim.Director.level(S), 9 + 2 * 8, 'two levels a toll');
  const at16 = rateNow();
  assert.ok(Math.abs(at16 / at8 - Math.pow(1.3, 8)) < 1e-6, `the rate x1.3 a toll: ${(at16 / at8).toFixed(2)}`);
  assert.equal(elites, 16, 'two elites in every interval past the keeper');
  const life = 20 * S.curves.enemyLife[sim.Director.level(S) - 1], damage = 3 * S.curves.enemyDamage[sim.Director.level(S) - 1];
  assert.ok(life > 20 * 10 && damage > 3 * 4, `by the sixteenth toll the dead have ${(life / 20).toFixed(1)} times the life and ${(damage / 3).toFixed(1)} times the damage`);
});

test('Hum: at each toll, the toll\'s number times the landmarks stood beside at a toll this vigil', () => {
  const sim = world(), S = vigil(sim);
  steps(sim, S, 1);
  S.player.x = 0; S.player.y = -18;                 // 3 m from the north stone
  toll(sim, S);
  assert.equal(S.hum, 1, 'toll 1, one landmark');
  S.player.x = 0; S.player.y = 3;                   // by the bell-post
  toll(sim, S);
  assert.equal(S.hum, 1 + 2 * 2, 'toll 2, two landmarks heard');
  S.player.x = 30; S.player.y = 0;
  toll(sim, S);
  assert.equal(S.hum, 5 + 3 * 2, 'toll 3: still the two');
});

test('turned favours: Muffle the Toll, Pass the Gate, Coins on Your Own Eyes, Ring Your Own Passing Bell', () => {
  const sim = world();
  // Muffle the Toll: the next toll does not raise the threat; the one after raises it two steps
  let S = vigil(sim);
  steps(sim, S, 1);
  S.favours['muffle-the-toll'] = 1; S.dirty = true;
  toll(sim, S);
  assert.equal(S.threat, 0, 'muffled');
  toll(sim, S);
  assert.equal(S.threat, 2, 'then two at once');
  toll(sim, S);
  assert.equal(S.threat, 3, 'and on as before');
  // Pass the Gate: a lychgate that closes unrung counts
  S = vigil(sim);
  steps(sim, S, 1);
  S.favours['pass-the-gate'] = 1; S.dirty = true;
  const e = sim.Sim.spawnEnemy(S, 'test.walker', 20, 0, { rank: 1 });
  sim.Sim.step(S);
  e.life = 0;
  steps(sim, S, 26 * 60);
  assert.equal(S.gate, null);
  assert.equal(S.vigil.passed, 1, 'one passed');
  const w = sim.Sim.spawnEnemy(S, 'test.walker', -30, 0);   // west of the post: out of the shadow just now
  sim.Sim.step(S);
  assert.ok(!sim.Enemies.shaded(S, w.x, w.y));
  assert.ok(Math.abs(w.pace - w.speed * 1.04) < 1e-9, 'the dead 4% faster');
  w.life = 0;
  const drop = steps(sim, S, 1, 'drop').find((d) => d.a === 0);
  assert.ok(Math.abs(drop.b - 2 * 1.08) < 1e-9, 'embers 8% more');
  // stood in for half a second and left before its first stroke, a lychgate still closes unrung; one with a stroke rung
  // at it does not
  const passOne = (seconds) => {
    const elite = sim.Sim.spawnEnemy(S, 'test.walker', S.player.x + 6, S.player.y, { rank: 1 });
    sim.Sim.step(S);
    elite.life = 0;
    sim.Sim.step(S);
    const back = [S.player.x, S.player.y];
    S.player.x = S.gate.x; S.player.y = S.gate.y;
    const strokes = steps(sim, S, Math.round(seconds * 60), 'stroke').length;
    [S.player.x, S.player.y] = back;
    steps(sim, S, 26 * 60);
    assert.equal(S.gate, null);
    return strokes;
  };
  assert.equal(passOne(0.5), 0);
  assert.equal(S.vigil.passed, 2, 'left before its first stroke: passed');
  assert.equal(passOne(1.2), 1);
  assert.equal(S.vigil.passed, 2, 'a stroke rung at it: not passed');
  // Coins on Your Own Eyes: a lychgate at every toll, 20 m off, for a rising fare; the first fare unpaid ends it
  S = vigil(sim);
  steps(sim, S, 1);
  S.favours['coins-on-your-own-eyes'] = 1; S.dirty = true;
  S.coin = 5;
  let g = toll(sim, S, 'gate');
  assert.equal(g.length, 1, 'a lychgate at the first toll');
  assert.equal(g[0].a, 15, 'for 15 s');
  assert.ok(Math.abs(Math.hypot(g[0].x - S.player.x, g[0].y - S.player.y) - 20) < 0.5, '20 m off');
  assert.equal(S.coin, 3, 'the fare of 2');
  steps(sim, S, 16 * 60);
  g = toll(sim, S, 'gate');
  assert.equal(S.coin, 0, 'then 3');
  g = toll(sim, S, 'gate');
  assert.equal(g.length, 0, 'no coin for the fare of 4: no lychgate, not even the third toll\'s');
  assert.equal(S.favours['coins-on-your-own-eyes'], 0, 'and the favour is lost');
  // Ring Your Own Passing Bell: the far lychgate opens near
  S = vigil(sim);
  steps(sim, S, 1);
  S.favours['ring-your-own-passing-bell'] = 1; S.dirty = true;
  sim.Sim.step(S);
  S.player.x = 10; S.player.y = 10;
  S.player.condT[sim.Stats.AILMENT['tolled-for']] = 30;
  sim.Sim.step(S);
  assert.ok(S.gate.far && Math.abs(Math.hypot(S.gate.x - 10, S.gate.y - 10) - 12) < 0.3, 'Tolled-for, the lychgate opens 12 m off');
});
