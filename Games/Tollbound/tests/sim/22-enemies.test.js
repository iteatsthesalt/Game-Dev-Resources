// tests/sim/22-enemies.test.js: how the dead move and strike (src/js/22-enemies.js): the wake and the train on the
// player's path, a cut back meeting the train side-on, a stop found in about 1.2 s, In Procession on and off,
// mourning, riders, the capped separation, Blows wound up with a locked aim, and Swells that fill and land.
// The kernel and 22-enemies.js alone are loaded, with the few calls into Dmg stood in for by the test, so that these
// rules are tested apart from the combat package. The test's own defs begin with "test.".
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');

const KERNEL = ['00-core.js', '01-defs.js', '02-pool-grid.js', '10-stats.js', '20-sim.js', '29-world.js', '30-modes-curves.js'];
const DT = 1 / 60;

function attack(id, more) {
  return Object.assign({
    id, kind: 'strike', type: 'blow', mult: 1, cooldown: 2, range: 0.6, windup: 0.6, shape: 'arc', radius: 0, angle: 1.6,
    count: 1, spread: 0, speed: 0, evadable: false, ailment: null, summon: null, fx: {},
  }, more);
}
function enemy(id, more) {
  return Object.assign({
    id, name: id, puppet: 'debug.husk', radius: 0.35, life: 20, damage: 4, speed: 2.4, xp: 1, cost: 1, loot: null, ai: 'wake',
    aiParams: {}, attacks: [], guard: {}, size: 'small', press: 0.5, tags: [],
  }, more);
}

// a simulation with a flat ground and the test's dead; calls into Dmg are recorded in sim.calls
function world() {
  const sim = loadSim({ only: [...KERNEL, '22-enemies.js'] }), { Defs } = sim;
  sim.Sim.field('player', 'pose', 0);              // 21-player.js declares it in the game; Dmg.POSE is set where a test needs it
  const zone = plain(Defs.get('zone', 'debug'));
  Defs.add('zone', Object.assign({}, zone, { id: 'test.flat', region: { radius: 60 } }));
  Defs.add('attack', attack('test.clutch'));
  Defs.add('attack', attack('test.leap', { kind: 'press', type: 'drag', mult: 1.5, range: 1.5, windup: 0.35, shape: 'line', radius: 0.4, ailment: 'clung' }));
  Defs.add('attack', attack('test.drop', { kind: 'fall', type: 'swell', mult: 2, cooldown: 30, range: 9, windup: 1.5, shape: 'circle', radius: 2 }));
  Defs.add('attack', attack('test.fan', { kind: 'spread', type: 'swell', mult: 2, cooldown: 30, range: 9, windup: 1.2, shape: 'wedge', radius: 8, angle: 1.2 }));
  Defs.add('enemy', enemy('test.walker'));
  Defs.add('enemy', enemy('test.striker', { attacks: ['test.clutch'] }));
  Defs.add('enemy', enemy('test.hanger', { attacks: ['test.leap'], radius: 0.3, damage: 2 }));
  Defs.add('enemy', enemy('test.thrower', { attacks: ['test.drop'], ai: 'chase', aiParams: { keep: 6 } }));
  Defs.add('enemy', enemy('test.fanner', { attacks: ['test.fan'], ai: 'chase', aiParams: { keep: 6 } }));
  Defs.add('enemy', enemy('test.heavy', { size: 'large', radius: 0.7, speed: 1.6 }));
  assert.deepEqual(plain(Defs.finalize()), []);
  sim.calls = [];
  sim.Dmg.hitPlayer = (S, A, source, scale, seen) => { sim.calls.push({ id: A.id, team: source.team, damage: source.damage, scale, seen, t: S.t }); return 1; };
  sim.Dmg.warning = () => 0;
  return sim;
}

function run(sim, seed = 1) {
  const S = sim.Sim.create({ zone: 'test.flat', seed });
  S.player.x = S.player.px = 0;
  S.player.y = S.player.py = 0;
  return S;
}

// steps with the player walking at (vx, vy) metres a second, as Player.step would move it
function walk(sim, S, vx, vy, seconds, each) {
  const p = S.player, steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    p.vx = vx; p.vy = vy;
    p.x += vx * DT; p.y += vy * DT;
    if (vx !== 0 || vy !== 0) p.face = Math.atan2(vy, vx);
    sim.Sim.step(S);
    if (each) each(S, i);
  }
}

const live = (S) => S.enemies.items.slice(0, S.enemies.n).filter((e) => e.alive);
const events = (S, k) => { const out = []; for (let i = 0; i < S.eventCount; i++) { const e = S.events[(S.eventStart + i) % S.events.length]; if (e.k === k) out.push(plain(e)); } return out; };

// distance from (x, y) to the polyline of points
function toPath(points, x, y) {
  let best = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, ay] = points[i], [bx, by] = points[i + 1], lx = bx - ax, ly = by - ay, l2 = lx * lx + ly * ly;
    let s = l2 > 0 ? ((x - ax) * lx + (y - ay) * ly) / l2 : 0;
    s = Math.max(0, Math.min(1, s));
    best = Math.min(best, Math.hypot(ax + lx * s - x, ay + ly * s - y));
  }
  return best;
}

test('the wake: the player\'s place every 0.1 s, a ring of 120, and where the player stood seconds ago', () => {
  const sim = world(), S = run(sim), out = { x: 0, y: 0 };
  walk(sim, S, 3, 0, 2);
  const w = S.wake;
  assert.equal(w.count, 20, 'twenty places in two seconds');
  assert.equal(w.n, 20, 'all of them are the wake while it is shorter than wake-length');
  assert.ok(Math.abs(w.x[w.head] - S.player.x) < 3 * 0.1 + 1e-9, 'the newest is at most a tenth of a second old');
  sim.Enemies.wakeAt(S, 1.2, out);
  // between two steps the answer is one step more recent than asked (it is exact during a step, as the dead read it)
  assert.ok(Math.abs(out.x - (S.player.x - 3 * 1.2)) <= 3 * DT + 1e-9 && Math.abs(out.y) < 1e-9, `1.2 s ago the player stood 3.6 m back: ${out.x} against ${S.player.x}`);
  sim.Enemies.wakeAt(S, 0, out);
  assert.equal(out.x, S.player.x, 'no time ago is where the player stands');
  walk(sim, S, 3, 0, 14);
  assert.equal(w.count, 120, 'the ring holds 120');
  assert.equal(w.n, 50, 'and the wake is wake-length (5 s) of them');
  sim.Enemies.wakeAt(S, 30, out);
  assert.ok(out.x > S.player.x - 3 * 12.1 && out.x < S.player.x - 3 * 11.8, 'farther back than the ring holds is its oldest place');
  // the cells: stamped with the time round the player, never far from it
  const cell = (x, y) => w.cells[Math.floor((y - w.oy)) * w.side + Math.floor((x - w.ox))];
  assert.ok(Math.abs(cell(S.player.x, 0) - S.t) < 0.11, 'the cell under the player was stamped in the last tenth of a second');
  assert.ok(cell(S.player.x, 1) > 0 && cell(S.player.x, -1) > 0, 'and the cells beside it');
  assert.ok(cell(S.player.x, 3) < 0, 'but not 3 m off the path');
});

test('walking draws the common dead into a train on the player\'s exact path, turning where the player turned', () => {
  const sim = world(), S = run(sim);
  // five of the dead a few metres behind the player
  for (let k = 0; k < 5; k++) sim.Sim.spawnEnemy(S, 'test.walker', -3 - k * 0.8, (k % 2 ? 0.5 : -0.5));
  const path = [[0, 0]];
  walk(sim, S, 2.2, 0, 6);
  path.push([S.player.x, S.player.y]);
  walk(sim, S, 0, 2.2, 6);                         // a sharp left turn: up the y axis
  path.push([S.player.x, S.player.y]);
  let worst = 0, turned = 0;
  walk(sim, S, 0, 2.2, 3, (S2) => {
    for (const e of live(S2)) {
      worst = Math.max(worst, toPath(path.concat([[S2.player.x, S2.player.y]]), e.x, e.y));
      if (e.y > 6) turned++;
    }
  });
  assert.ok(worst < 1.2, `the train keeps to the player's path: the farthest off was ${worst.toFixed(2)} m`);
  assert.ok(turned > 0, 'and it went round the corner after the player');
  const lead = live(S).reduce((a, e) => (Math.hypot(e.x - S.player.x, e.y - S.player.y) < Math.hypot(a.x - S.player.x, a.y - S.player.y) ? e : a));
  const ago = sim.Enemies.wakeAt(S, 1.2, { x: 0, y: 0 });
  assert.ok(Math.hypot(lead.x - ago.x, lead.y - ago.y) < 1.2, 'the first of it walks where the player stood 1.2 s ago');
  assert.ok(Math.hypot(lead.x - S.player.x, lead.y - S.player.y) > 1.5, 'not at the player\'s heels');
});

test('a cut back meets the train side-on: the dead walk on along the old path past the player', () => {
  const sim = world(), S = run(sim);
  for (let k = 0; k < 6; k++) sim.Sim.spawnEnemy(S, 'test.walker', -2 - k * 0.7, 0);
  walk(sim, S, 2.2, 0, 7);                         // the train follows east
  walk(sim, S, 0, 4.4, 0.45);                      // a quick step 2 m north
  let met = null;
  walk(sim, S, -4.4, 0, 2.5, (S2) => {             // and straight back west, beside the old path
    if (met) return;
    for (const e of live(S2)) {
      if (Math.abs(e.x - S2.player.x) < 0.5) { met = { vx: e.vx, vy: e.vy, dy: S2.player.y - e.y }; break; }
    }
  });
  assert.ok(met, 'the player came level with the train');
  assert.ok(met.vx > 0.5, `the dead it met still walk east toward the old wake, against the player: vx ${met.vx.toFixed(2)}`);
  assert.ok(met.dy > 1, `and beside it, not on the player's line: ${met.dy.toFixed(2)} m off`);
});

test('a stop is found in about 1.2 s: the shared point reaches the player 1.2 s after it stops', () => {
  const sim = world(), S = run(sim), out = { x: 0, y: 0 };
  for (let k = 0; k < 4; k++) sim.Sim.spawnEnemy(S, 'test.walker', -2.5 - k, 0);
  walk(sim, S, 2.2, 0, 5);
  const stop = { x: S.player.x, y: S.player.y };
  let reached = null, touched = null;
  walk(sim, S, 0, 0, 3, (S2, i) => {
    sim.Enemies.wakeAt(S2, 1.2, out);
    if (reached === null && Math.hypot(out.x - stop.x, out.y - stop.y) < 1e-6) reached = (i + 1) / 60;
    if (touched === null && live(S2).some((e) => Math.hypot(e.x - stop.x, e.y - stop.y) <= e.r + S2.player.r + 0.11)) touched = (i + 1) / 60;
  });
  assert.ok(reached !== null && Math.abs(reached - 1.2) < 0.12, `the wake's point came to rest on the player after ${reached} s`);
  assert.ok(touched !== null && touched > 0.6 && touched < 2.2, `the first of the train touched the player ${touched} s after the stop`);
});

test('elites steer at the player, the common dead at the wake', () => {
  const sim = world(), S = run(sim);
  const common = sim.Sim.spawnEnemy(S, 'test.walker', -6, 4), elite = sim.Sim.spawnEnemy(S, 'test.walker', -6, -4, { rank: 1 });
  walk(sim, S, 2, 0, 3);
  sim.Sim.step(S);
  const p = S.player, ago = sim.Enemies.wakeAt(S, 1.2, { x: 0, y: 0 });
  const aim = (e, x, y) => Math.abs(Math.atan2(e.vy, e.vx) - Math.atan2(y - e.y, x - e.x));
  assert.ok(aim(elite, p.x, p.y) < 0.05, 'the elite heads for the player');
  assert.ok(aim(common, ago.x, ago.y) < 0.05, 'the common body heads for where the player stood 1.2 s ago');
});

test('In Procession: 5 s within the wake, 15% faster; it ends on touching the player or straying', () => {
  const sim = world(), S = run(sim), PROC = sim.Stats.RULE.procession;
  walk(sim, S, 2.2, 0, 2);                         // a wake to follow, and one of the dead on it 2.6 m behind
  const e = sim.Sim.spawnEnemy(S, 'test.walker', S.player.x - 2.6, 0), from = S.t;
  let on = null;
  walk(sim, S, 2.2, 0, 7, (S2) => { if (on === null && e.condN[PROC] === 1) on = S2.t - from; });
  assert.ok(on !== null && on > 4.9 && on < 5.25, `In Procession after ${on} s of following`);
  assert.equal(e.condV[PROC], 5, 'V holds the seconds followed, at most 5');
  assert.ok(Math.abs(e.pace - e.speed * 1.15) < 1e-9, '15% faster');
  // strays: carried 6 m off the wake
  e.y += 6;
  walk(sim, S, 2.2, 0, 0.2);
  assert.equal(e.condN[PROC], 0, 'it strayed more than 3 m from the wake: no longer in procession');
  assert.equal(e.condV[PROC], 0);
  // follows again, then touches the player when it stops
  e.x = S.player.x - 2.6; e.y = S.player.y;
  walk(sim, S, 2.2, 0, 6);
  assert.equal(e.condN[PROC], 1, 'in procession again');
  walk(sim, S, 0, 0, 3);
  assert.equal(e.condN[PROC], 0, 'it walked up to the player that stopped, and touching ends it');
  // an elite never
  const elite = sim.Sim.spawnEnemy(S, 'test.walker', S.player.x - 3, S.player.y, { rank: 1 });
  walk(sim, S, 2.2, 0, 7);
  assert.equal(elite.condV[PROC] + elite.condN[PROC], 0, 'the row spares elites');
});

test('mourning: full, it stands facing the fallen and does not strike; half, half speed; harmed in full, roused', () => {
  const sim = world(), S = run(sim), M = sim.Stats.RULE.mourning;
  const a = sim.Sim.spawnEnemy(S, 'test.striker', 1, 0), b = sim.Sim.spawnEnemy(S, 'test.striker', 0, 1.2);
  for (const e of [a, b]) { e.condT[M] = 12; e.condV[M] = 2; e.tx = 5; e.ty = 5; }
  sim.Sim.step(S);
  for (const e of [a, b]) {
    assert.equal(e.vx, 0); assert.equal(e.vy, 0);
    assert.equal(e.pace, 0, 'full mourning: it stands');
  }
  for (let i = 0; i < 120; i++) sim.Sim.step(S);
  assert.ok(Math.abs(Core(sim).angleDiff(a.face, Math.atan2(5 - a.y, 5 - a.x))) < 0.05, 'and faces the body');
  assert.equal(sim.calls.length, 0, 'the player beside it is not struck');
  b.life -= 3;                                     // harmed in full mourning
  sim.Sim.step(S);
  assert.equal(b.condV[M], 3, 'roused');
  assert.equal(b.condT[M], 6, 'for 6 s');
  // the times run down in Dmg.step, which this test stands in for
  for (const e of [a, b]) e.condT[M] = 5.9;
  sim.Sim.step(S);
  assert.equal(a.condV[M], 1, 'after 6 s: half mourning');
  assert.ok(Math.abs(a.pace - a.speed * 0.5) < 1e-9, 'at half speed');
  // half mourning strikes half as often as roused, which strikes 30% faster than at rest: compare their cooldowns
  a.cd0 = 1; b.cd0 = 1; a.state = 0; b.state = 0;
  sim.Sim.step(S);
  assert.ok(Math.abs((1 - a.cd0) / (1 - b.cd0) - 0.5 / 1.3) < 1e-6, 'its cooldown runs at half speed, the roused one\'s at 1.3');
});
function Core(sim) { return sim.Core; }

test('riders: a hanger-on leaps on from 1.5 m; standing still lets another climb every 2 s; striding past a large body moves them all onto it', () => {
  const sim = world(), S = run(sim), C = sim.Stats.RULE.riders, p = S.player;
  const h = sim.Sim.spawnEnemy(S, 'test.hanger', 1.6, 0);
  let leapt = null;
  walk(sim, S, 0, 0, 2, (S2) => { if (leapt === null && !h.alive) leapt = S2.t; });
  assert.ok(leapt !== null, 'it leapt on');
  assert.equal(p.condN[C], 1, 'one rider');
  assert.ok(Math.abs(p.condV[C] - 2 * 1.5) < 1e-9, 'V: the Drag a second of a rider, the hanger-on\'s damage x its leap\'s mult');
  assert.equal(S.kills, 0, 'climbing on is no kill');
  assert.equal(S.crowd.rider, 'test.hanger');
  // two more stand 2.5 m off: while the player stands still, one climbs on every 2 s
  const a = sim.Sim.spawnEnemy(S, 'test.hanger', -2.5, 0), b = sim.Sim.spawnEnemy(S, 'test.hanger', 0, -2.5);
  a.cd0 = b.cd0 = 99;                               // they do not leap: only the climbing counts here
  a.t = b.t = 1;
  const at = [];
  walk(sim, S, 0, 0, 4.5, (S2) => { if (at.length < p.condN[C] - 1) at.push(S2.t); });
  assert.equal(p.condN[C], 3, 'two more climbed on');
  assert.ok(at.length === 2 && at[1] - at[0] > 1.9 && at[1] - at[0] < 2.1, `two seconds apart: ${at}`);
  // striding past a large body: every rider moves onto it
  const big = sim.Sim.spawnEnemy(S, 'test.heavy', p.x + 3, p.y + 1.6);
  big.speed = 0;
  sim.Dmg.POSE = { still: 0, braced: 1, moving: 2, striding: 3 };
  walk(sim, S, 4, 0, 1.2, (S2) => { S2.player.pose = 3; });
  assert.equal(p.condN[C], 0, 'the riders left the player');
  assert.equal(big.condN[C], 3, 'and ride the large body');
  assert.ok(Math.abs(big.condV[C] - 3) < 1e-9);
  assert.ok(big.pace < big.speed + 1e-9, 'a body with riders is slower');
});

test('the whole build: however many riders, a player running flat out strides past a large body and sheds them all', () => {
  // each rider takes 8% off top speed, and posture is measured against what is left (02-combat.md, sections 1 and
  // 7): measured against the unladen speed, four riders would take Stride away and with it the one way to shed them
  const sim = loadSim({ boot: true }), C = sim.Stats.RULE.riders;
  for (let riders = 1; riders <= 5; riders++) {
    const cfg = Object.assign({ zone: 'dial', seed: 2 }, sim.Player.classRun('change-ringer'), { voices: [] });
    const S = sim.Sim.create(cfg), p = S.player;
    p.condN[C] = riders;
    p.condV[C] = 0.3;
    const big = sim.Sim.spawnEnemy(S, 'dial.heavy', p.x + 6, p.y + 0.9, {});
    big.speed = 0;
    const flat = { mx: 1, my: 0, ax: 1, ay: 0, aim: false, trade: false, heave: false };
    for (let i = 0; i < 150; i++) sim.Sim.step(S, flat);
    assert.equal(p.condN[C], 0, `${riders} riders: all left the player`);
    assert.equal(big.condN[C], riders, `${riders} riders: and ride the large body`);
  }
});

test('the capped separation spreads a crowd out, and the dead give way to a Braced player', () => {
  const sim = world(), S = run(sim);
  for (let k = 0; k < 40; k++) sim.Sim.spawnEnemy(S, 'test.walker', 8 + (k % 5) * 0.05, (k % 7) * 0.05);
  let most = 0;
  const before = live(S).map((e) => [e.x, e.y]);
  sim.Sim.step(S);
  live(S).forEach((e, i) => { most = Math.max(most, Math.hypot(e.x - before[i][0], e.y - before[i][1])); });
  assert.ok(most <= 2.4 * 1.15 / 60 + 0.04 + 1e-9, `no body moves more than its pace and the cap in one step: ${most}`);
  for (let i = 0; i < 240; i++) sim.Sim.step(S);
  const list = live(S);
  let overlap = 0;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    overlap = Math.max(overlap, list[i].r + list[j].r - Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y));
  }
  assert.ok(overlap < 0.35, `the crowd pressed on the player has spread: the deepest overlap is ${overlap.toFixed(3)} m`);
  // the player stood still all along: it was pushed, but not through the crowd
  const p = S.player;
  sim.Dmg.POSE = { still: 0, braced: 1, moving: 2, striding: 3 };
  p.pose = 1;
  const x = p.x, y = p.y;
  for (let i = 0; i < 60; i++) { p.pose = 1; sim.Sim.step(S); }
  assert.ok(Math.hypot(p.x - x, p.y - y) < 1e-9, 'a Braced player is planted: the crowd does not move it');
  for (const e of live(S)) assert.ok(Math.hypot(e.x - p.x, e.y - p.y) >= e.r + p.r - 0.05, 'and no body stands inside it');
});

test('a Blow winds up with its aim locked: it lands on a player still in its arc, and misses one who left', () => {
  const sim = world(), S = run(sim), p = S.player;
  const e = sim.Sim.spawnEnemy(S, 'test.striker', 0.9, 0);
  e.speed = 0;
  e.cd0 = 0; e.t = 1;
  sim.Sim.step(S);
  assert.equal(e.state, 1, 'it winds up');
  assert.equal(e.attack, 0);
  assert.ok(Math.abs(e.a0 - Math.PI) < 1e-9, 'aimed at the player, locked');
  walk(sim, S, 0, 0, 0.7);
  assert.equal(sim.calls.length, 1, 'it landed');
  assert.deepEqual([sim.calls[0].id, sim.calls[0].scale, sim.calls[0].seen], ['test.clutch', 1, 0.6], 'with the wind-up as the warning seen');
  assert.equal(e.state, 2, 'striking');
  walk(sim, S, 0, 0, 0.4);
  assert.equal(e.state, 0, 'and done');
  // again, but the player steps behind it during the wind-up: the locked aim misses
  e.cd0 = 0;
  sim.Sim.step(S);
  assert.equal(e.state, 1);
  p.x = 2; p.y = 0;
  walk(sim, S, 0, 0, 0.7);
  assert.equal(sim.calls.length, 1, 'no second hit: the player left the arc it was locked into');
});

test('Swells: a falling one is shown at once where the player stood, fills, and lands only on a player inside', () => {
  const sim = world(), S = run(sim), p = S.player;
  const e = sim.Sim.spawnEnemy(S, 'test.thrower', 6, 0);
  e.t = 1; e.cd0 = 0;
  sim.Sim.step(S);
  const shown = events(S, 'telegraph');
  assert.equal(shown.length, 1, "a 'telegraph' as it is shown");
  assert.deepEqual([shown[0].x, shown[0].y, shown[0].a, shown[0].b, shown[0].id], [0, 0, 2, 1.5, 'test.drop'], 'at the player, its radius, its fill');
  const a = S.areas.items.slice(0, S.areas.n).find((o) => o.alive && o.team === 1);
  assert.ok(a, 'an area of team 1');
  assert.deepEqual([a.r, a.len, a.def.id, a.owner], [2, 0, 'test.drop', e.uid]);
  assert.equal(a.damage, e.damage * 2, 'its harm: the thrower\'s damage x the attack\'s mult');
  walk(sim, S, 0, 0, 0.75);
  assert.ok(Math.abs(a.t / (a.t + a.ttl) - 0.5) < 0.02, 'half full halfway');
  walk(sim, S, 0, 0, 0.8);
  assert.equal(sim.calls.length, 1, 'it landed on the player standing in it');
  assert.equal(sim.calls[0].seen, 1.5, 'the fill seen is the wound\'s depth');
  assert.equal(sim.calls[0].team, 1);
  // the next one: the player walks out before it lands
  e.cd0 = 0;
  sim.Sim.step(S);
  walk(sim, S, 0, -3, 1.5);
  assert.equal(sim.calls.length, 1, 'outside it when it lands: nothing');
});

test('Swells: a spreading wedge spares the player in lee, and the shadow of the district fills it 0.3 s faster', () => {
  const sim = world(), S = run(sim), p = S.player;
  let inLee = false;
  sim.Dmg.inLee = () => inLee;
  const e = sim.Sim.spawnEnemy(S, 'test.fanner', 5, 0);
  e.t = 1; e.cd0 = 0;
  sim.Sim.step(S);
  const a = S.areas.items.slice(0, S.areas.n).find((o) => o.alive && o.team === 1);
  assert.ok(a && Math.abs(a.angle - Math.PI) < 1e-9 && a.x === e.x, 'drawn from the body toward the player');
  inLee = true;
  walk(sim, S, 0, 0, 1.3);
  assert.equal(sim.calls.length, 0, 'in lee: nothing');
  // the shade of the district: S.vigil is the director's, laid by hand here
  S.vigil = { shade: { on: true, x: 0, y: 0, from: -0.5, span: 1, reach: 40, speed: 1.3, warn: 0.3 } };
  inLee = false;
  e.cd0 = 0;
  sim.Sim.step(S);
  const shown = events(S, 'telegraph');
  assert.ok(Math.abs(shown[0].b - 0.9) < 1e-9, `a Swell drawn from inside the shade fills 0.3 s faster: ${shown[0].b}`);
  assert.ok(sim.Enemies.shaded(S, 5, 0) && !sim.Enemies.shaded(S, -5, 0), 'the wedge holds east of its apex, not west');
  const w = sim.Sim.spawnEnemy(S, 'test.walker', 10, 2), out = sim.Sim.spawnEnemy(S, 'test.walker', -10, 2);
  sim.Sim.step(S);
  assert.ok(Math.abs(w.pace - w.speed * 1.3) < 1e-9 && Math.abs(out.pace - out.speed) < 1e-9, 'the dead in the shade walk 30% faster');
  walk(sim, S, 0, 0, 1);
  assert.equal(sim.calls.length, 1, 'out of lee it lands');
});
