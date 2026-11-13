// tests/sim/30-household-review.test.js: where the four packages of Stage 2 meet the foundation, with every module
// below 50: the Household's bequests heard in a vigil, the Lantern's sheet, a route laid before the Plan, Full
// Mourning's sight, Open Lead's beat, and a character's vigil played twice from one save.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');

const W = loadSim({ boot: true });
const { SaveData, Char, Sim, Bot, Defs, Stats, Tree, Skills, Dmg } = W;

function household(observances) {
  const save = SaveData.blank(), c = Char.create(save, 'change-ringer', 'Agnes');
  for (const id of observances || []) { Char.learn(c, id); assert.ok(Char.hold(c, id, save.account), id + ' is kept'); }
  return { save, c };
}

function eventsOf(S, kind) {
  const out = [];
  for (let i = 0; i < S.eventCount; i++) {
    const e = S.events[(S.eventStart + i) % S.events.length];
    if (e.k === kind) out.push({ x: e.x, y: e.y, a: e.a, b: e.b, id: e.id });
  }
  return out;
}

test('a Household\'s bequest under way is heard in the vigil that meets it: the run\'s account carries the Household\'s records', () => {
  const { save, c } = household();
  save.account.bequests['stand-your-ground'] = { n: 9, done: false };     // nine tolls heard; the tenth meets it
  const cfg = Char.begin(save, c.uid, 'dial', 21);
  assert.deepEqual(plain(cfg.account.bequests), plain(save.account.bequests));
  const S = Sim.create(cfg), heard = [];
  for (let i = 0; i < 80 * 60 && S.toll < 1; i++) { Sim.step(S, Bot.input(S, 'vigil')); for (const e of eventsOf(S, 'bequest')) heard.push(e.id); }
  for (let i = 0; i < 3; i++) { Sim.step(S, Bot.input(S, 'vigil')); for (const e of eventsOf(S, 'bequest')) heard.push(e.id); }
  assert.ok(heard.includes('stand-your-ground'), 'the tenth toll meets it, and the vigil says so: ' + JSON.stringify(heard));
  assert.equal(save.account.bequests['stand-your-ground'].n, 9, 'the save is changed only at the end of the vigil');
  Sim.command(S, { type: 'leave' });
  const report = Char.end(save, S);
  assert.ok(report.bequests.includes('stand-your-ground'));
  assert.equal(save.account.bequests['stand-your-ground'].done, true);
});

test('the Lantern\'s sheet is worked out as in a dry district: the Ebb bank counts, the Flood bank does not', () => {
  const nodes = Defs.all('node');
  // a bank node with one plain modifier of a stat the sheet shows, of each bank
  const pick = (bank) => nodes.find((n) => n.bank === bank && n.choice === null && n.mods.length === 1 && n.mods[0].cond === undefined &&
    n.mods[0].unless === undefined && n.mods[0].tags === undefined && (n.mods[0].op === 'flat' || n.mods[0].op === 'inc') && Stats.stat(n.mods[0].stat) !== null);
  const ebb = pick('ebb'), flood = pick('flood');
  assert.ok(ebb && flood, 'the Plan has bank nodes');
  const read = (node) => {
    const { save, c } = household();
    const plainSheet = Char.sheet(c, save.account).stats[node.mods[0].stat];
    c.plan.walk.push(node.id);                              // Char.sheet reads the route as it stands
    return [plainSheet, Char.sheet(c, save.account).stats[node.mods[0].stat]];
  };
  const [e0, e1] = read(ebb), [f0, f1] = read(flood);
  assert.notEqual(e1, e0, ebb.id + ' (Ebb bank) shows on the Lantern\'s sheet');
  assert.equal(f1, f0, flood.id + ' (Flood bank) waits for water');
  // the same as Stats.sheet under the condition dry
  const { save, c } = household();
  c.plan.walk.push(ebb.id);
  const dry = Stats.sheet(Char.mods(c, null, save.account), { level: c.level, observances: 0, conds: Stats.condMask(['dry']) });
  assert.equal(Char.sheet(c, save.account).stats[ebb.mods[0].stat], dry.stats[ebb.mods[0].stat]);
});

test('a character made before the Plan existed (an empty route, version 2) starts at the Change-ringer\'s door and can walk', () => {
  const { save, c } = household();
  c.level = 3;
  c.plan.walk = [];
  save.v = 2;
  const { save: up, errors, notes } = SaveData.decode(SaveData.encode(save));
  assert.deepEqual(plain(errors), []);
  assert.equal(notes.length, 1);
  const a = up.chars[0], door = Tree.door('change-ringer');
  assert.deepEqual(plain(a.plan.walk), [door]);
  const step = Tree.steps(a.plan.walk)[0], node = Defs.get('node', step);
  assert.ok(Char.allocate(a, step, node.choice ? node.choice[0] : undefined), 'a point is laid from the door');
  assert.deepEqual(plain(SaveData.validate(up)), []);
});

test('Full Mourning: beyond its sight the dead cannot make you out, walk to where they last saw you and begin nothing', () => {
  const { save, c } = household(['full-mourning']);
  const S = Sim.create(Char.begin(save, c.uid, 'dial', 5)), p = S.player;
  Sim.step(S, Sim.NO_INPUT);
  assert.equal(S.observances.sight, 7, 'black: seen at 7 m');
  const e = Sim.spawnEnemy(S, 'dial.wake-walker', p.x + 12, p.y);
  const x0 = p.x, y0 = p.y;
  for (let i = 0; i < 30; i++) Sim.step(S, Sim.NO_INPUT);
  assert.equal(e.lost, true, 'at 12 m it cannot make you out');
  assert.deepEqual([e.seenX, e.seenY], [x0, y0], 'it rose knowing where you stood');
  // you slip away: it keeps walking to where it last saw you, and stands there
  p.x = x0 - 20; p.y = y0 + 6;
  for (let i = 0; i < 6 * 60; i++) Sim.step(S, Sim.NO_INPUT);
  assert.ok(Core_dist(e.x, e.y, x0, y0) < 1.2, 'it stands where it last saw you: ' + [e.x - x0, e.y - y0]);
  assert.equal(e.lost, true);
  // come within sight and it knows you again
  p.x = e.x - 5; p.y = e.y;
  Sim.step(S, Sim.NO_INPUT);
  Sim.step(S, Sim.NO_INPUT);
  assert.equal(e.lost, false);
  assert.ok(Math.abs(e.seenX - p.x) < 0.2, 'and notes where you stand');
  // a heavy body 8.5 m off would drop its load at 9 m: while it cannot make you out it begins nothing
  const S2 = Sim.create(Char.begin(Object.assign(save, { away: null }), c.uid, 'dial', 6)), q = S2.player;
  Sim.step(S2, Sim.NO_INPUT);
  const heavy = Sim.spawnEnemy(S2, 'dial.heavy', q.x + 8.5, q.y);
  let shown = 0;
  for (let i = 0; i < 20 * 60 && S2.phase === 'play'; i++) {
    heavy.x = q.x + 8.5; heavy.y = q.y;                  // held where it stands, beyond sight and within its reach
    Sim.step(S2, Sim.NO_INPUT);
    for (const t of eventsOf(S2, 'telegraph')) if (t.id === 'dial.load') shown++;
  }
  assert.equal(shown, 0, 'no load is dropped on a player it cannot make out');
  // without the observance the same body drops it
  const plainHouse = household();
  const S3 = Sim.create(Char.begin(plainHouse.save, plainHouse.c.uid, 'dial', 6)), r = S3.player;
  Sim.step(S3, Sim.NO_INPUT);
  const heavy3 = Sim.spawnEnemy(S3, 'dial.heavy', r.x + 8.5, r.y);
  shown = 0;
  for (let i = 0; i < 20 * 60 && S3.phase === 'play'; i++) {
    heavy3.x = r.x + 8.5; heavy3.y = r.y;
    Sim.step(S3, Sim.NO_INPUT);
    for (const t of eventsOf(S3, 'telegraph')) if (t.id === 'dial.load') shown++;
  }
  assert.ok(shown > 0, 'in plain sight it drops its load');
});

function Core_dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

test('Open Lead: while its beat holds no condition can be put on the player', () => {
  const { save, c } = household();
  const S = Sim.create(Char.begin(save, c.uid, 'dial', 3)), p = S.player;
  Sim.step(S, Sim.NO_INPUT);
  const SEALED = Stats.AILMENT.sealed, SWING = Stats.AILMENT.swing;
  assert.equal(Skills.beat(S), false);
  S.knots.leadEnd[0] = S.t + 1;                          // a beat of one second
  assert.equal(Skills.beat(S), true);
  assert.equal(Dmg.lay(S, p, SEALED, 5, 0, 0), false, 'a seal is refused during the beat');
  const blow = { id: 'test.blow', type: 'blow', mult: 1 };
  for (let k = 0; k < 4; k++) Dmg.hitPlayer(S, blow, { damage: 1, x: p.x + (k % 2 ? 1 : -1), y: p.y }, 1, 0.3);
  assert.equal(p.condN[SWING], 0, 'no swing is counted on you');
  for (let i = 0; i < 61; i++) Sim.step(S, Sim.NO_INPUT);
  assert.equal(Skills.beat(S), false, 'the beat is over');
  assert.equal(Dmg.lay(S, p, SEALED, 5, 0, 0), true, 'and a seal can be laid again');
  // the knot itself makes the beat: every fourth cast of its voice is left out
  const h = household(), v = h.c.voices[0];
  h.c.knots['open-lead'] = 1;
  assert.ok(Char.tie(h.c, v.uid, 0, 'open-lead'));
  const T = Sim.create(Char.begin(h.save, h.c.uid, 'dial', 4));
  let beat = false, refused = false;
  for (let i = 0; i < 30 * 60 && !beat; i++) {
    Sim.step(T, Bot.input(T, 'vigil'));
    if (Skills.beat(T)) { beat = true; refused = !Dmg.lay(T, T.player, SEALED, 5, 0, 0); }
  }
  assert.ok(beat && refused, 'a beat came within 30 s, and nothing could be laid on you in it');
});

test('a character\'s vigil plays the same twice from one save: knots, observances, finds and the Plan', () => {
  const play = () => {
    const { save, c } = household(['stability']);
    for (const k of Defs.all('knot')) c.knots[k.id] = 1;
    for (const v of c.voices) for (let at = 0; at < v.rope; at++) {
      const fit = Defs.all('knot').find((k) => c.knots[k.id] > 0 && Stats.fits(Defs.get('voice', v.id), k));
      if (fit) Char.tie(c, v.uid, at, fit.id);
    }
    c.planPoints = 6;
    for (let i = 0; i < 6; i++) { const s = Tree.steps(c.plan.walk)[0], n = Defs.get('node', s); Char.allocate(c, s, n.choice ? n.choice[0] : undefined); }
    const S = Sim.create(Char.begin(save, c.uid, 'dial', 'twice'));
    const marks = [];
    for (let i = 0; i < 200 * 60 && S.phase === 'play'; i++) {
      Sim.step(S, Bot.input(S, 'vigil'));
      if (i % 600 === 0) marks.push(Sim.hash(S));
      if (S.toll > 0 && i % 4500 === 0) Char.checkpoint(save, S);
    }
    Sim.command(S, { type: 'leave' });
    Char.end(save, S);
    save.rev = 0;
    return { marks, save: JSON.stringify(save) };
  };
  const a = play(), b = play();
  assert.deepEqual(a.marks, b.marks, 'the same checksums, step for step');
  assert.equal(a.save, b.save, 'and the same save after it');
});
