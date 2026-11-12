// tests/sim/27-favours.test.js: the row of six favours and the walk-in offers (src/js/27-favours.js), with the favours
// of the row (src/js/40-favours.js): the row filled from the favours that fit, the front places rising round the
// player at a run level, one taken by walking into it, the row closing up and swapping its pairs, the shapes sinking
// unwalked and the next offer raising four, the modifiers of what was taken, Nail in the Candle, and never a pause.
// The kernel, 27-favours.js and the favours alone are loaded; run levels are given by the test.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');

const KERNEL = ['00-core.js', '01-defs.js', '02-pool-grid.js', '10-stats.js', '20-sim.js', '29-world.js', '30-modes-curves.js'];
const DT = 1 / 60;

function world() {
  const sim = loadSim({ only: [...KERNEL, '27-favours.js', '40-favours.js'] });
  assert.deepEqual(plain(sim.Defs.finalize()), []);
  return sim;
}
function vigil(sim, extra) {
  const S = sim.Sim.create(Object.assign({ zone: 'debug', seed: 5, class: 'change-ringer' }, extra));
  S.player.x = S.player.px = 0;
  S.player.y = S.player.py = 0;
  return S;
}
function eventsOf(S, k) {
  const out = [];
  for (let i = 0; i < S.eventCount; i++) { const e = S.events[(S.eventStart + i) % S.events.length]; if (e.k === k) out.push(plain(e)); }
  return out;
}
function steps(sim, S, n, k, each) {
  const got = [];
  for (let i = 0; i < n; i++) { sim.Sim.step(S); got.push(...eventsOf(S, k)); if (each) each(S, i); }
  return got;
}
// the shapes standing, in an array of this side (the simulation's own arrays need plain() before deepEqual)
const shapes = (S) => { const out = []; for (let i = 0; i < S.pickups.n; i++) { const o = S.pickups.items[i]; if (o.alive && o.kind === 3) out.push(o); } return out; };

test('the row: six favours drawn from those that fit, no two alike; a class\'s own only for that class', () => {
  const sim = world();
  const S = vigil(sim);
  sim.Sim.step(S);
  const ids = S.row.ids;
  assert.equal(ids.length, 6);
  assert.ok(ids.every((id) => typeof id === 'string' && sim.Defs.has('favour', id)), JSON.stringify(ids));
  assert.equal(new Set(ids).size, 6, 'no favour twice in the row');
  assert.equal(S.phase, 'play');
  // without the class, its own favours never come; with it, they can (over many seeds)
  let ringerOnly = 0, mine = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const a = sim.Sim.create({ zone: 'debug', seed }), b = sim.Sim.create({ zone: 'debug', seed, class: 'change-ringer' });
    sim.Sim.step(a);
    sim.Sim.step(b);
    ringerOnly += a.row.ids.filter((id) => sim.Defs.get('favour', id).requires.class !== undefined).length;
    mine += b.row.ids.filter((id) => sim.Defs.get('favour', id).requires.class === 'change-ringer').length;
  }
  assert.equal(ringerOnly, 0, 'a run of no class draws none of a class\'s own');
  assert.ok(mine > 0, 'a Change-ringer\'s run draws them');
  // the same seed draws the same row
  const again = vigil(sim);
  sim.Sim.step(again);
  assert.deepEqual(plain(again.row.ids), plain(ids));
});

test('at a run level the first three rise round the player as shapes to walk into; nothing pauses', () => {
  const sim = world(), S = vigil(sim), p = S.player;
  sim.Sim.step(S);
  const front = plain(S.row.ids.slice(0, 3));
  p.face = 0;
  p.runLevel = 1;
  const offer = steps(sim, S, 1, 'offer');
  assert.deepEqual(offer.map((e) => [e.a, e.b]), [[3, 1]], "an 'offer': three shapes, for run level 1");
  assert.equal(S.phase, 'play', 'S.phase never becomes offer');
  assert.equal(S.offer, null);
  const up = shapes(S);
  assert.equal(up.length, 3);
  assert.deepEqual(up.map((o) => o.value).sort(), [1, 2, 3], 'value: its place');
  assert.deepEqual(up.map((o) => o.item.id).sort(), front.slice().sort(), 'item: the favour def of that place');
  for (const o of up) {
    assert.ok(Math.abs(Math.hypot(o.x, o.y) - 4) < 1e-9, '4 m from the player');
    assert.ok(o.ttl > 7.9 && o.ttl <= 8, 'for 8 s');
    const off = Math.abs(sim.Core.angleDiff(0, Math.atan2(o.y, o.x)));
    assert.ok(off > 0.9, 'none on the way the player faces');
  }
  const angles = up.map((o) => Math.atan2(o.y, o.x)).sort((a, b) => a - b);
  assert.ok(Math.abs(angles[1] - angles[0] - 2 * Math.PI / 3) < 1e-9 && Math.abs(angles[2] - angles[1] - 2 * Math.PI / 3) < 1e-9, '120 degrees apart');
  assert.deepEqual(plain(S.row.shapes).sort(), up.map((o) => o.uid).sort(), 'the row knows the shapes standing');
});

test('walking into one takes it: the others go, the row closes up, a new favour enters at place 6, and the pairs swap', () => {
  const sim = world(), S = vigil(sim), p = S.player;
  sim.Sim.step(S);
  p.runLevel = 1;
  sim.Sim.step(S);
  const before = S.row.ids.slice(), second = shapes(S).find((o) => o.value === 2), id = before[1];
  p.x = second.x; p.y = second.y;                    // the player walks into the shape of place 2
  const got = steps(sim, S, 1, 'favour');
  assert.deepEqual(got.map((e) => [e.a, e.b, e.id]), [[2, 1, id]], "a 'favour': place 2, taken once, its id");
  assert.ok(Math.abs(got[0].x - second.x) < 1e-9 && Math.abs(got[0].y - second.y) < 1e-9, 'where it was taken');
  assert.equal(S.favours[id], 1);
  assert.equal(shapes(S).length, 0, 'the other shapes are taken away');
  // closed up: places 3 to 6 moved up one, a new one at 6; then the first swap (1-2, 3-4, 5-6)
  const closed = [before[0], before[2], before[3], before[4], before[5], S.row.ids.find((x) => !before.includes(x))];
  const swapped = [closed[1], closed[0], closed[3], closed[2], closed[5], closed[4]];
  assert.deepEqual(plain(S.row.ids), swapped);
  assert.ok(!S.row.ids.includes(id) || sim.Defs.get('favour', id).maxStacks > 1, 'the favour taken left the row');
  // the next level: the second swap (2-3, 4-5) follows the next offer
  p.runLevel = 2;
  sim.Sim.step(S);
  const next = shapes(S).find((o) => o.value === 1), row = S.row.ids.slice();
  p.x = next.x; p.y = next.y;
  sim.Sim.step(S);
  const closed2 = [row[1], row[2], row[3], row[4], row[5], S.row.ids.find((x) => !row.includes(x))];
  assert.deepEqual(plain(S.row.ids), [closed2[0], closed2[2], closed2[1], closed2[4], closed2[3], closed2[5]], 'then 2-3 and 4-5');
});

test('unwalked, the shapes sink in 8 s, and the next level\'s offer raises the first four', () => {
  const sim = world(), S = vigil(sim), p = S.player;
  sim.Sim.step(S);
  p.runLevel = 1;
  sim.Sim.step(S);
  const row = S.row.ids.slice();
  p.x = 30; p.y = 0;                                 // far from them
  steps(sim, S, 7.9 * 60);
  assert.equal(shapes(S).length, 3, 'still standing at 7.9 s');
  steps(sim, S, 0.2 * 60);
  assert.equal(shapes(S).length, 0, 'sunk');
  assert.equal(S.row.raised, 4);
  assert.deepEqual(plain(S.row.ids), [row[1], row[0], row[3], row[2], row[5], row[4]], 'nothing was taken, and the pairs swapped');
  assert.equal(Object.keys(S.favours).length, 0);
  p.runLevel = 2;
  const offer = steps(sim, S, 1, 'offer');
  assert.equal(offer[0].a, 4, 'four shapes');
  const up = shapes(S), angles = up.map((o) => Math.atan2(o.y - p.y, o.x - p.x)).sort((a, b) => a - b);
  assert.deepEqual(up.map((o) => o.value).sort(), [1, 2, 3, 4]);
  for (let i = 1; i < 4; i++) assert.ok(Math.abs(angles[i] - angles[i - 1] - Math.PI / 2) < 1e-9, '90 degrees apart');
  p.x = up[0].x; p.y = up[0].y;
  sim.Sim.step(S);
  assert.equal(S.row.raised, 3, 'one taken: back to three');
});

test('what was taken joins every sheet, as many times as taken and no more than its maxStacks', () => {
  const sim = world(), S = vigil(sim);
  sim.Sim.step(S);
  const life = S.sheet.stats['life-max'], loaf = sim.Defs.get('favour', 'arval-bread').mods[0].value;
  S.favours['arval-bread'] = 2;
  S.favours['corpse-road'] = 1;
  S.dirty = true;
  sim.Sim.step(S);
  assert.equal(S.sheet.stats['life-max'], life + 2 * loaf, 'two loaves: twice its greatest life');
  assert.ok(Math.abs(S.sheet.stats['move-speed'] - 4.5 * 1.06) < 1e-9, '+6% top speed');
  S.favours['arval-bread'] = 9;
  S.dirty = true;
  sim.Sim.step(S);
  assert.equal(S.sheet.stats['life-max'], life + loaf * 3, 'never more than its maxStacks (3)');
  S.favours['muffle-the-toll'] = 1;
  S.dirty = true;
  sim.Sim.step(S);
  assert.equal(S.sheet.flags['muffle-the-toll'], true, 'a turned favour raises its flag for its rule to read');
  // and one taken up to its maxStacks is drawn no more
  for (let seed = 1; seed <= 30; seed++) {
    const R = sim.Sim.create({ zone: 'debug', seed, class: 'change-ringer' });
    R.favours['arval-bread'] = 3;
    sim.Sim.step(R);
    assert.ok(!R.row.ids.includes('arval-bread'), `seed ${seed}`);
  }
});

test('the favours of the row: about two dozen, plain ones adding numbers, turned ones raising a flag, each with an icon', () => {
  const sim = world(), all = sim.Defs.all('favour');
  assert.ok(all.length >= 22 && all.length <= 28, `${all.length} favours`);
  const plainOnes = all.filter((f) => f.rarity === 'plain'), turned = all.filter((f) => f.rarity === 'turned');
  assert.ok(plainOnes.length >= 18 && turned.length >= 4, `${plainOnes.length} plain, ${turned.length} turned`);
  for (const f of all) {
    assert.ok(typeof f.icon === 'string' && f.icon.length > 0, `${f.id} has an icon id`);
    assert.ok(f.mods.every((m) => m.op === 'flat' || m.op === 'inc'), `${f.id}: flat and inc only`);
    assert.ok(typeof f.text === 'string' && f.text.length > 10 && typeof f.name === 'string');
  }
  for (const f of turned) assert.ok(f.mods.some((m) => m.stat === 'flag.' + f.id), `${f.id} raises flag.${f.id}`);
  for (const f of plainOnes) assert.ok(f.mods.every((m) => !m.stat.startsWith('flag.')), `${f.id} switches no rule`);
  // those that raise harm stay within about 30% together, at their most
  const harm = all.filter((f) => f.mods.some((m) => m.stat === 'damage' || m.stat === 'speed' || m.stat === 'procession-bonus'));
  const most = harm.reduce((k, f) => k * (1 + f.mods.reduce((s, m) => s + m.value, 0) * f.maxStacks / 100), 1);
  assert.ok(most <= 1.4, `harm, speed and the train's bonus at their most: x${most.toFixed(2)}`);
});

test('Nail in the Candle gives nothing now, and at the second toll after it the favours at places 1 and 2', () => {
  const sim = world(), S = vigil(sim), p = S.player;
  sim.Sim.step(S);
  S.row.ids[0] = 'nail-in-the-candle';
  p.runLevel = 1;
  sim.Sim.step(S);
  const nail = shapes(S).find((o) => o.value === 1);
  p.x = nail.x; p.y = nail.y;
  sim.Sim.step(S);
  assert.equal(S.favours['nail-in-the-candle'], 1);
  assert.deepEqual(plain(S.row.nails), [2], 'a nail at the second toll');
  p.x = 20; p.y = 0;
  const ring = () => { S.tollAt = S.step + 1; sim.Sim.step(S); };
  ring();
  let got = steps(sim, S, 2, 'favour');
  assert.equal(got.length, 0, 'nothing at the first toll');
  const front = S.row.ids.slice(0, 2);
  ring();
  got = steps(sim, S, 1, 'favour');
  assert.deepEqual(got.map((e) => e.id), [front[0], front[1]], 'at the second, the favours of places 1 and 2');
  assert.equal(S.favours[front[0]], 1);
  assert.equal(S.favours[front[1]], 1);
  assert.deepEqual(plain(S.row.nails), []);
});

test('never a pause: a vigil of many run levels walks through every offer without S.phase leaving play', () => {
  const sim = world(), S = vigil(sim), p = S.player;
  let offers = 0, taken = 0;
  for (let level = 1; level <= 30; level++) {
    p.runLevel = level;
    offers += steps(sim, S, 1, 'offer').length;
    const up = shapes(S);
    if (level % 3 !== 0 && up.length > 0) { p.x = up[0].x; p.y = up[0].y; taken += steps(sim, S, 1, 'favour').length; }
    else steps(sim, S, 8.2 * 60);
    assert.equal(S.phase, 'play');
    p.x = 0; p.y = 0;
  }
  assert.equal(offers, 30, 'one offer a level');
  assert.equal(taken, 20);
  assert.equal(S.row.levels, 30);
  assert.equal(Object.values(S.favours).reduce((a, b) => a + b, 0), 20, 'twenty favours taken');
});
