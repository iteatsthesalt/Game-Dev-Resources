// tests/sim/29-world.test.js: seeded regions, their props, and keeping things out of colliders (src/js/29-world.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');

// Only the kernel's own files are loaded, so content and systems added later cannot disturb these tests.
const KERNEL = ['00-core.js', '01-defs.js', '02-pool-grid.js', '10-stats.js', '20-sim.js', '29-world.js', '30-modes-curves.js'];
const kernel = () => loadSim({ only: KERNEL });

// A simulation with three props and two zones that scatter them: the yard thinly, the thicket far too thickly.
// Their ids begin with "test." so that they never meet an id of the game's own content.
function world() {
  const sim = kernel(), zone = plain(sim.Defs.get('zone', 'debug'));
  sim.Defs.add('prop', { id: 'test.pillar', puppet: 'debug.husk', radius: 0.9 });
  sim.Defs.add('prop', { id: 'test.brazier', puppet: 'debug.husk', radius: 0.4, light: { radius: 7, color: '#ffbb66' } });
  sim.Defs.add('prop', { id: 'test.candle', puppet: 'debug.husk', radius: 0, light: { radius: 3, color: '#ffe0a0' } });
  sim.Defs.add('zone', Object.assign({}, zone, {
    id: 'test.yard', region: { radius: 50 }, props: [{ prop: 'test.pillar', density: 0.5 }, { prop: 'test.brazier', density: 0.2 }, { prop: 'test.candle', density: 0.3 }],
  }));
  sim.Defs.add('zone', Object.assign({}, zone, { id: 'test.thicket', region: { radius: 30 }, props: [{ prop: 'test.pillar', density: 20 }] }));
  // a plaza like the Dial: a post at the middle, stones set where the zone says, the start off the post
  sim.Defs.add('prop', { id: 'test.post', puppet: 'debug.husk', radius: 0.6, role: 'bell-post' });
  sim.Defs.add('prop', { id: 'test.stone', puppet: 'debug.husk', radius: 0.5 });
  sim.Defs.add('zone', Object.assign({}, zone, {
    id: 'test.plaza', region: { radius: 35 }, start: { x: 0, y: 8 },
    place: [{ prop: 'test.post', x: 0, y: 0 }, { prop: 'test.stone', x: 14, y: 0, role: 'landmark' }, { prop: 'test.stone', x: -14, y: 0 }],
    props: [{ prop: 'test.stone', density: 0.2 }],
  }));
  assert.deepEqual(plain(sim.Defs.finalize()), [], 'what this file adds is valid');
  return sim;
}
const sim = world(), { World, Sim, Defs, Core } = sim;
const yard = Defs.get('zone', 'test.yard');
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);

test('a region is the zone\'s ground with its props scattered by density', () => {
  const region = World.region(7, yard);
  assert.deepEqual(Object.keys(region), ['x', 'y', 'radius', 'startX', 'startY', 'props', 'grid']);
  assert.deepEqual([region.x, region.y, region.radius, region.startX, region.startY], [0, 0, 50, 0, 0]);
  const count = (id) => region.props.filter((p) => p.id === id).length;
  // a disc of 50 m is 7854 m2: 0.5, 0.2 and 0.3 on every 100 m2 are 39, 16 and 24, and a thin scatter fits them all
  assert.deepEqual([count('test.pillar'), count('test.brazier'), count('test.candle')], [39, 16, 24]);
  for (const p of region.props) {
    assert.deepEqual(Object.keys(p), ['id', 'x', 'y', 'r', 'light', 'role']);
    const def = Defs.get('prop', p.id);
    assert.equal(p.r, def.radius);
    assert.equal(p.light, def.light === undefined ? null : def.light, 'the def\'s light, or null');
    assert.equal(p.role, null, 'a prop whose def has no role has none');
  }
  assert.equal(World.region(7, Defs.get('zone', 'debug')).props.length, 0, 'a zone without props has an empty ground');
  assert.deepEqual([World.CLEAR, World.GAP], [8, 2]);
});

test('authored props stand where the zone says, with their roles, and the scatter keeps clear of the start', () => {
  const plaza = Defs.get('zone', 'test.plaza'), region = World.region(3, plaza);
  const placed = plain(region.props.slice(0, 3).map((p) => [p.id, p.x, p.y, p.r, p.role]));
  assert.deepEqual(placed, [['test.post', 0, 0, 0.6, 'bell-post'], ['test.stone', 14, 0, 0.5, 'landmark'], ['test.stone', -14, 0, 0.5, null]],
    'first, in order: a role from the place, else from the def, else none');
  assert.deepEqual([region.startX, region.startY], [0, 8]);
  const scattered = region.props.slice(3);
  // a disc of 35 m is 3848 m2: 0.2 on every 100 m2 is round(7.70) = 8 stones, and so thin a scatter fits them all
  assert.equal(scattered.length, 8, `${scattered.length} stones scattered`);
  for (const p of scattered) {
    assert.ok(Math.hypot(p.x - 0, p.y - 8) - p.r >= World.CLEAR - 1e-9, 'the clear circle is round the start, not the middle');
    for (const q of region.props.slice(0, 3)) assert.ok(gap(p, q) >= World.GAP - 1e-9, 'and clear of what was set down by hand');
  }
  // a region set elsewhere carries its authored props and its start along
  const away = World.region(3, plaza, 100, 50);
  assert.deepEqual([away.props[1].x, away.props[1].y, away.startX, away.startY], [114, 50, 100, 58]);
  // a run starts there, and finds props by their role
  const S = Sim.create({ zone: 'test.plaza', seed: 3 }), out = [];
  assert.deepEqual([S.player.x, S.player.y], [0, 8]);
  assert.equal(World.withRole(S, 'landmark', out), 1);
  assert.equal(out[0], S.props[1]);
  assert.equal(World.withRole(S, 'bell-post', out), 1);
  assert.equal(out[0].id, 'test.post');
  assert.equal(World.withRole(S, 'lamp-post', out), 0);
  assert.equal(World.withRole({ region: null }, 'landmark', out), 0);
  assert.equal(World.withRole(Sim.create({ zone: 'test.yard', seed: 3 }), 'landmark', out), 0, 'scattered props have the role of their def');
});

test('the same seed gives the same region, another seed another', () => {
  const where = (region) => region.props.map((p) => [p.id, p.x, p.y]);
  assert.deepEqual(where(World.region(7, yard)), where(World.region(7, yard)));
  assert.deepEqual(where(World.region('bell', yard)), where(World.region('bell', yard)));
  assert.notDeepEqual(where(World.region(7, yard)), where(World.region(8, yard)));
  const a = Sim.create({ zone: 'test.yard', seed: 3 }), b = Sim.create({ zone: 'test.yard', seed: 3 }), c = Sim.create({ zone: 'test.yard', seed: 4 });
  assert.ok(a.props.length > 60);
  assert.deepEqual(where(a.region), where(b.region), 'a run takes its region from its seed');
  assert.notDeepEqual(where(a.region), where(c.region));
  assert.equal(a.props, a.region.props);
});

test('props keep clear of the start, of the edge and of each other', () => {
  for (const [seed, zoneId] of [[1, 'test.yard'], [2, 'test.yard'], [3, 'test.thicket'], [4, 'test.thicket']]) {
    const region = World.region(seed, Defs.get('zone', zoneId)), props = region.props;
    for (const p of props) {
      const d = Math.hypot(p.x, p.y);
      assert.ok(d - p.r >= World.CLEAR - 1e-9, `${zoneId}: a ${p.id} at ${d} m keeps out of the clear circle`);
      assert.ok(d + p.r <= region.radius + 1e-9, `${zoneId}: a ${p.id} lies wholly inside the region`);
    }
    let closest = Infinity;
    for (let i = 0; i < props.length; i++) for (let j = i + 1; j < props.length; j++) closest = Math.min(closest, gap(props[i], props[j]));
    assert.ok(closest >= World.GAP - 1e-9, `${zoneId}: the two closest colliders are ${closest} m apart`);
  }
  // 20 pillars on every 100 m2 cannot fit with 2 m between them: the region takes what fits and no more
  const crowded = World.region(3, Defs.get('zone', 'test.thicket')).props.length;
  assert.ok(crowded > 100 && crowded < 400, `${crowded} of 5655 asked for`);
});

test('a region can sit anywhere: nothing but its own middle is special', () => {
  const home = World.region(11, yard), away = World.region(11, yard, 5000, -3000.5);
  assert.deepEqual([away.x, away.y, away.radius], [5000, -3000.5, 50]);
  assert.equal(away.props.length, home.props.length);
  home.props.forEach((p, i) => {
    near(away.props[i].x - 5000, p.x, 1e-8);
    near(away.props[i].y + 3000.5, p.y, 1e-8);
  });
  const out = [];
  const S = { region: away };
  const first = away.props.find((p) => p.r > 0);
  assert.equal(World.propsNear(S, first.x, first.y, 0, out), 1);
  assert.equal(out[0], first);
  assert.equal(World.propsNear(S, 0, 0, 40, out), 0, 'the origin of the world holds nothing of this region');
  const ent = { x: first.x + 0.1, y: first.y, r: 0.4 };
  assert.equal(World.pushOut(S, ent), true);
  near(Math.hypot(ent.x - first.x, ent.y - first.y), first.r + 0.4);
  const far = { x: 5000 + 80, y: -3000.5, r: 0.5 };
  World.pushOut(S, far);
  near(far.x, 5000 + 49.5);
  near(far.y, -3000.5);
});

test('propsNear finds exactly the props whose collider is in reach', () => {
  const S = Sim.create({ zone: 'test.yard', seed: 5 }), rng = new Core.RNG(5), out = [];
  for (let q = 0; q < 600; q++) {
    const x = rng.range(-55, 55), y = rng.range(-55, 55), r = q % 4 === 0 ? 0 : rng.range(0, 12);
    const n = World.propsNear(S, x, y, r, out), expected = S.props.filter((p) => Math.hypot(p.x - x, p.y - y) <= r + p.r);
    assert.equal(n, expected.length, `query ${q}`);
    assert.deepEqual(new Set(out.slice(0, n)), new Set(expected));
  }
  assert.equal(World.propsNear(S, 0, 0, 500, out), S.props.length);
  assert.equal(World.propsNear(S, 0, 0, World.CLEAR - 0.01, out), 0, 'the start is clear');
  assert.equal(World.propsNear({ region: null }, 0, 0, 500, out), 0, 'a run without a region has no props');
});

test('pushOut moves a body out of colliders and leaves alone what touches nothing', () => {
  const S = Sim.create({ zone: 'test.yard', seed: 6 }), rng = new Core.RNG(6);
  const free = { x: 1, y: 2, r: 0.4 };
  assert.equal(World.pushOut(S, free), false);
  assert.deepEqual([free.x, free.y], [1, 2]);
  const pillar = S.props.find((p) => p.id === 'test.pillar'), candle = S.props.find((p) => p.id === 'test.candle');
  // from 0.3 m inside the pillar's rim, straight out along the line from its centre
  const ent = { x: pillar.x + 0.6, y: pillar.y + 0.8, r: 0.4 };
  assert.equal(World.pushOut(S, ent), true);
  near(ent.x, pillar.x + 0.6 * 1.3);
  near(ent.y, pillar.y + 0.8 * 1.3);
  assert.equal(World.pushOut(S, ent), false, 'once out, it rests');
  const centred = { x: pillar.x, y: pillar.y, r: 0.4 };
  World.pushOut(S, centred);
  near(Math.hypot(centred.x - pillar.x, centred.y - pillar.y), 1.3);    // dead centre has no way out of its own: it gets one
  const onCandle = { x: candle.x, y: candle.y, r: 0.4 };
  assert.equal(World.pushOut(S, onCandle), false, 'a prop without a collider is walked through');
  // a crowd dropped anywhere ends up outside every collider and inside the region
  for (let i = 0; i < 500; i++) {
    const body = { x: rng.range(-70, 70), y: rng.range(-70, 70), r: rng.range(0.2, 0.9) };
    World.pushOut(S, body);
    assert.ok(Math.hypot(body.x, body.y) <= S.region.radius - body.r + 1e-9, 'inside the region');
    for (const p of S.props) if (p.r > 0) assert.ok(gap(body, p) >= -1e-9, `clear of the ${p.id} at ${p.x}, ${p.y}`);
  }
  assert.equal(World.pushOut({ region: null }, free), false);
});

test('the edge of the region holds a body by its rim', () => {
  const S = Sim.create({ zone: 'debug', seed: 1 });
  const out = { x: 300, y: 400, r: 2 };
  assert.equal(World.pushOut(S, out), true);
  near(Math.hypot(out.x, out.y), 58);
  near(out.y / out.x, 4 / 3);                          // pulled straight back toward the middle
  const inside = { x: 34.8, y: 46.4, r: 2 };           // exactly at 58 m: allowed
  assert.equal(World.pushOut(S, inside), false);
  S.player.x = -100;
  World.pushOut(S, S.player);
  near(S.player.x, -(60 - S.player.r));
});
