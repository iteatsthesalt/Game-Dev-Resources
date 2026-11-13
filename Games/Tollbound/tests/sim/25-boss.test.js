// tests/sim/25-boss.test.js: the keepers' fights (src/js/25-boss.js), with a keeper of the test's own written like the
// Half-muffled Keeper: its phases by its life, and in each the order in which its strokes land on the same ground
// (the full stroke then its echo; the echo then the full stroke; three echoes, then their full strokes in reverse).
// The kernel, 22-enemies.js (whose Swells the keeper shows) and 25-boss.js are loaded, Dmg stood in for.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');

const KERNEL = ['00-core.js', '01-defs.js', '02-pool-grid.js', '10-stats.js', '20-sim.js', '29-world.js', '30-modes-curves.js'];
const DT = 1 / 60;

function world() {
  const sim = loadSim({ only: [...KERNEL, '22-enemies.js', '25-boss.js'] }), { Defs } = sim;
  const zone = plain(Defs.get('zone', 'debug'));
  Defs.add('zone', Object.assign({}, zone, { id: 'test.arena', region: { radius: 40 } }));
  const swell = (id, more) => Object.assign({
    id, kind: 'fall', type: 'swell', mult: 2, cooldown: 0, range: 40, windup: 1.5, shape: 'circle', radius: 3, angle: 0, count: 1,
    spread: 0, speed: 0, evadable: false, ailment: null, summon: null, fx: {},
  }, more);
  Defs.add('attack', swell('test.stroke'));
  Defs.add('attack', swell('test.sweep', { kind: 'spread', shape: 'wedge', radius: 10, angle: 1.6, windup: 1.7 }));
  Defs.add('boss', {
    id: 'test.keeper', name: 'Keeper', puppet: 'debug.husk', radius: 1.2, life: 1000, damage: 10, speed: 1.5, xp: 50, cost: 0, loot: null,
    ai: 'keeper', aiParams: { keep: 6, first: 1, order: ['after', 'before', 'reverse'] }, attacks: ['test.stroke', 'test.sweep'],
    guard: {}, size: 'large', press: 1, tags: [], arena: { radius: 20 },
    phases: [
      { until: 0.6, speed: 1, onEnter: [], loop: ['test.stroke', { wait: 12 }] },
      { until: 0.25, speed: 1.2, onEnter: ['test.sweep'], loop: ['test.stroke', { wait: 12 }] },
      { until: 0, speed: 1.4, onEnter: [], loop: ['test.stroke', { wait: 20 }] },
    ],
  });
  assert.deepEqual(plain(Defs.finalize()), []);
  sim.Dmg.warning = () => 0;
  sim.Dmg.hitPlayer = () => 0;
  return sim;
}

// a run with the keeper raised 8 m from the player; every Swell shown is noted with when it was shown and lands
function keeperRun(sim) {
  const S = sim.Sim.create({ zone: 'test.arena', seed: 3 });
  S.player.x = S.player.px = 0;
  S.player.y = S.player.py = 0;
  const e = sim.Sim.spawnEnemy(S, 'test.keeper', 0, -8);
  S.boss = e;
  const shown = [], phases = [], seen = new Set();
  const step = () => {
    sim.Sim.step(S);
    for (let i = 0; i < S.eventCount; i++) {
      const ev = S.events[(S.eventStart + i) % S.events.length];
      if (ev.k === 'phase') phases.push({ a: ev.a, id: ev.id, t: S.t });
    }
    for (let i = 0; i < S.areas.n; i++) {
      const a = S.areas.items[i];
      if (!a.alive || a.team !== 1 || seen.has(a.uid)) continue;
      seen.add(a.uid);
      shown.push({ id: a.def.id, x: a.x, y: a.y, angle: a.angle, damage: a.damage, at: S.t - DT, lands: S.t - DT + a.ttl + DT, fill: a.a0 });
    }
  };
  return { S, e, shown, phases, step, run: (seconds) => { for (let i = 0; i < Math.round(seconds * 60); i++) step(); } };
}
const near = (a, b, eps = 0.02) => Math.abs(a - b) <= eps;

test('the keeper enters its first phase, and each stroke of it lands in full, then as an echo at 30% on the same ground 2 s later', () => {
  const sim = world(), k = keeperRun(sim);
  k.step();
  assert.deepEqual(k.phases.map((p) => [p.a, p.id]), [[1, 'test.keeper']], "a 'phase' as it comes: phase 1");
  k.run(6);
  assert.equal(k.shown.length, 2, 'one cast: two Swells');
  const [full, echo] = k.shown;
  assert.ok(near(full.at, 1), `it waited its first second: ${full.at}`);
  assert.equal(full.damage, 10 * 2, 'the full stroke: its damage x the attack\'s mult');
  assert.ok(near(full.fill, 1.5), 'filling its windup (no Heed here)');
  assert.ok(near(echo.damage, 10 * 2 * 0.3, 1e-9), 'the echo: 30% of it');
  assert.deepEqual([echo.x, echo.y], [full.x, full.y], 'on the same ground');
  assert.deepEqual([full.x, full.y], [0, 0], 'where the player stood');
  assert.ok(near(echo.at, full.lands), 'shown as the full stroke lands');
  assert.ok(near(echo.lands, full.lands + 2), 'and landing 2 s after it');
});

test('from 60% the echo comes first, and the full stroke lands on its ground 1.2 s after it; from 25%, three echoes then their full strokes in reverse', () => {
  const sim = world(), k = keeperRun(sim);
  k.run(0.5);
  k.e.life = k.e.lifeMax * 0.59;
  k.step();
  assert.deepEqual(k.phases.map((p) => p.a), [1, 2], 'phase 2 at 60%');
  assert.ok(near(k.e.speed, 1.5 * 1.2, 1e-9), 'at its phase\'s speed');
  // its onEnter: a sweep, the echo first
  k.run(4);
  const sweep = k.shown.filter((s) => s.id === 'test.sweep');
  assert.equal(sweep.length, 2, 'the sweep of its onEnter: echo and full');
  assert.ok(sweep[0].damage < sweep[1].damage && near(sweep[0].damage, sweep[1].damage * 0.3, 1e-9), 'the echo, at 30%, comes first');
  assert.deepEqual([sweep[1].x, sweep[1].y, sweep[1].angle], [sweep[0].x, sweep[0].y, sweep[0].angle], 'the full stroke on its ground, the same source and aim');
  assert.ok(near(sweep[1].at, sweep[0].lands) && near(sweep[1].lands, sweep[0].lands + 1.2), 'landing 1.2 s after the echo');
  // three echoes, each where the player stands as it is shown, then the full strokes, the last laid first
  k.e.life = k.e.lifeMax * 0.24;
  k.shown.length = 0;
  const p = k.S.player;
  k.step();
  assert.deepEqual(k.phases.map((q) => q.a), [1, 2, 3], 'phase 3 at 25%');
  for (let i = 0; i < 160; i++) { p.x += 1.5 * DT; k.step(); }     // the player walks on as the echoes are laid
  k.run(5);
  const strokes = k.shown.filter((s) => s.id === 'test.stroke');
  const echoes = strokes.filter((s) => near(s.damage, 6, 1e-9)), fulls = strokes.filter((s) => near(s.damage, 20, 1e-9));
  assert.equal(echoes.length, 3, 'three echoes');
  assert.equal(fulls.length, 3, 'three full strokes');
  assert.ok(near(echoes[1].at - echoes[0].at, 0.7) && near(echoes[2].at - echoes[1].at, 0.7), 'laid 0.7 s apart');
  assert.ok(echoes[0].x < echoes[1].x && echoes[1].x < echoes[2].x, 'each where the player stood as it was shown');
  const landing = fulls.slice().sort((a, b) => a.lands - b.lands);
  assert.deepEqual(landing.map((f) => f.x), [echoes[2].x, echoes[1].x, echoes[0].x], 'the full strokes land in reverse order, the last laid first');
  assert.ok(landing.every((f) => f.at >= echoes[2].lands - 0.02), 'after the last echo has landed');
  assert.ok(near(landing[1].lands - landing[0].lands, 0.8) && near(landing[2].lands - landing[1].lands, 0.8), '0.8 s apart');
});

test('the keeper holds its distance and its arena, and a laid keeper strikes no more', () => {
  const sim = world(), k = keeperRun(sim), p = k.S.player;
  k.run(5);
  const d = Math.hypot(k.e.x - p.x, k.e.y - p.y);
  assert.ok(d > 5.6 && d < 6.6, `it holds about 6 m off the player: ${d.toFixed(2)}`);
  p.x = p.px = 35;                                  // far out: it will not leave its arena of 20 m
  k.run(20);
  assert.ok(Math.hypot(k.e.x, k.e.y) <= 20.2, `it stays within 20 m of the middle: ${Math.hypot(k.e.x, k.e.y).toFixed(2)}`);
  k.e.life = 0;
  k.step();                                         // the deaths phase takes it out of the pool and S.boss
  assert.equal(k.S.boss, null);
  const before = k.shown.length;
  k.run(15);
  assert.equal(k.shown.length, before, 'nothing more is laid');
  assert.equal(k.S.keeper.n, 0, 'its queue was emptied');
});
