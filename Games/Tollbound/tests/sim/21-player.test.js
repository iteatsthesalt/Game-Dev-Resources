// tests/sim/21-player.test.js: the player (src/js/21-player.js): movement, posture and the turn rule, the Change-
// ringer's pull, set bell and trade, wounds (opening, joining, the cap, depth, mending, scars), the modifier
// conditions of the player and their 0.25 s hold, pickups and run levels, Player.classRun and Buffs.add.
// The kernel and the combat package only, with the class's own file and a little content of the tests' own.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');

const FILES = ['00-core.js', '01-defs.js', '02-pool-grid.js', '10-stats.js', '11-damage.js', '20-sim.js', '21-player.js', '23-skills.js',
  '24-archetypes.js', '29-world.js', '30-modes-curves.js', '31-change-ringer.js'];
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
const all = (S) => Array.from({ length: S.eventCount }, (u, i) => plain(S.events[(S.eventStart + i) % S.events.length]));
const events = (S, k) => all(S).filter((e) => e.k === k);
const frame = (mx = 0, my = 0, trade = false, heave = false) => ({ mx, my, ax: 1, ay: 0, aim: false, trade, heave });
const STILL = frame();

const sim = loadSim({ only: FILES });
const { Sim, Player, Buffs, Dmg, Stats, Defs } = sim;
Defs.add('enemy', {
  id: 't.small', name: 'Small', puppet: 't.small', radius: 0.4, life: 100, damage: 5, speed: 2, xp: 1, cost: 1, loot: null, ai: 'chase', aiParams: {},
  attacks: [], guard: {}, size: 'small', press: 0, tags: [],
});
Defs.add('prop', { id: 't.post', puppet: 't.post', radius: 0.5 });
Defs.add('zone', Object.assign({}, plain(Defs.get('zone', 'debug')), { id: 't.posts', place: [{ prop: 't.post', x: 2, y: 0 }] }));
const R = Stats.AILMENT, FOOT = R['wrong-footed'], TOLLED = R['tolled-for'], CLUNG = R.clung;
const POSE = Dmg.POSE, bit = (id) => 1 << Stats.COND[id];
const LUNGE = { id: 't.lunge', type: 'blow', mult: 1 };

// a run without a class (no rule: every sharp turn is only a turn), and a Change-ringer's
const plainRun = (more = {}) => Sim.create(Object.assign({ zone: 'debug', seed: 1, mods: [], voices: [] }, more));
const ringer = (more = {}) => Sim.create(Object.assign({ zone: 'debug', seed: 1 }, Player.classRun('change-ringer'), more));
function steps(S, n, f = STILL) { const out = []; for (let i = 0; i < n; i++) { Sim.step(S, f); out.push(...all(S)); } return out; }
const heading = (deg) => frame(Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180));

// ---- the cfg of a run without a character ----

test('Player.classRun: the class\'s attributes as flat modifiers, its base modifiers, its voices at level 1 with a rope of 2', () => {
  assert.deepEqual(plain(Player.classRun('change-ringer')), {
    class: 'change-ringer', level: 1,
    mods: [{ stat: 'knee', op: 'flat', value: 5 }, { stat: 'hand', op: 'flat', value: 10 }],     // Hand 10 then Knee 5
    voices: [
      { uid: 1, id: 'tenor-stroke', level: 1, rope: 2, knots: [null, null] },
      { uid: 2, id: 'tellers', level: 1, rope: 2, knots: [null, null] },
      { uid: 3, id: 'plumb', level: 1, rope: 2, knots: [null, null] },
    ],
  });
  const five = Player.classRun('change-ringer', 5);
  assert.deepEqual(plain(five.mods), [{ stat: 'knee', op: 'flat', value: 9 }, { stat: 'hand', op: 'flat', value: 18 }]);   // + 1 and + 2 a level
  assert.equal(five.level, 5);
  const S = ringer();
  assert.deepEqual([S.sheet.primaries.hand, S.sheet.primaries.knee], [10, 5]);
  assert.equal(S.sheet.stats['life-max'], 70, '60, and 2 for each point of Knee');
  assert.equal(S.player.life, 70);
  assert.equal(S.combat.cls, 'change-ringer');
});

// ---- movement ----

test('movement: move-speed a second, the move vector held to length 1; 8% slower a rider, 20% faster Tolled-for; out of props', () => {
  const S = plainRun();
  steps(S, 60, frame(1, 0));
  near(S.player.x, 4.5);                                      // 4.5 m/s for 1 s
  const T2 = plainRun();
  steps(T2, 60, frame(3, 4));
  near(T2.player.x, 4.5 * 0.6); near(T2.player.y, 4.5 * 0.8);
  const T3 = plainRun();
  T3.player.condN[CLUNG] = 2;
  steps(T3, 60, frame(1, 0));
  near(T3.player.x, 4.5 * (1 - 2 * 0.08));                   // 3.78
  const T4 = plainRun();
  T4.player.condT[TOLLED] = 30;
  steps(T4, 60, frame(1, 0));
  near(T4.player.x, 4.5 * 1.2);                              // 5.4
  const T5 = Sim.create({ zone: 't.posts', seed: 1, mods: [], voices: [] });
  steps(T5, 60, frame(1, 0));
  near(T5.player.x, 2 - 0.5 - 0.4, 1e-9);                    // against the post's collider
});

// ---- posture ----

test('posture: still under 15% of top speed, Braced after brace-time, Striding at stride-share held 0.25 s; a 0.3 m shove ends Brace', () => {
  const S = plainRun(), p = S.player;
  steps(S, 23, frame(0.14, 0));                              // 0.63 m/s: 14% of 4.5
  assert.equal(p.pose, POSE.still);
  steps(S, 1, frame(0.14, 0));                               // the 24th still step: 0.4 s
  assert.equal(p.pose, POSE.braced);
  steps(S, 1, frame(0.16, 0));                               // 16%: moving
  assert.equal(p.pose, POSE.moving);
  steps(S, 60, frame(0.69, 0));
  assert.equal(p.pose, POSE.moving, '69% never Strides');
  steps(S, 14, frame(0.7, 0));
  assert.equal(p.pose, POSE.moving);
  steps(S, 1, frame(0.7, 0));                                // the 15th step at 70%: 0.25 s
  assert.equal(p.pose, POSE.striding);
  steps(S, 30);
  assert.equal(p.pose, POSE.braced);
  Dmg.shove(S, p, 0.2, 0);
  assert.equal(p.pose, POSE.braced, 'a shove of 0.2 m does not end it');
  Dmg.shove(S, p, 0.3, 0);
  assert.equal(p.pose, POSE.still);
  const quick = plainRun({ mods: [{ stat: 'knee', op: 'flat', value: 20 }] });   // Knee 20: brace-time 0.4 - 2 x 0.03
  steps(quick, 20);
  assert.equal(quick.player.pose, POSE.still);
  steps(quick, 1);                                           // 21 steps: 0.35 s >= 0.34
  assert.equal(quick.player.pose, POSE.braced);
});

test('posture under riders: each takes 8% off top speed, and the player is measured against what is left, so flat out it strides', () => {
  for (let riders = 1; riders <= 5; riders++) {
    const S = plainRun(), p = S.player;
    p.condN[CLUNG] = riders;
    steps(S, 30, frame(1, 0));
    assert.equal(p.pose, POSE.striding, `${riders} riders: running flat out (${(1 - riders * 0.08) * 100}% of 4.5 m/s) is Striding`);
    steps(S, 30, frame(0.69, 0));
    assert.equal(p.pose, POSE.moving, `${riders} riders: and 69% of what is left is not`);
  }
});

// ---- the turn rule ----

test('the turn rule: more than turn-limit within 0.5 s above 30% speed wrong-foots for 0.5 s, at once', () => {
  const S = plainRun(), p = S.player;
  steps(S, 30, heading(0));
  steps(S, 1, heading(90));
  assert.equal(p.condT[FOOT], 0, 'a turn of 90 degrees is not more than 90');
  steps(S, 30, heading(90));
  steps(S, 1, heading(195));                                  // 105 degrees
  near(p.condT[FOOT], 0.5);
  near(p.condV[FOOT], 105, 1e-6);
  let n = 0;
  while (p.condT[FOOT] > 0) { steps(S, 1, heading(195)); n++; }
  assert.equal(n, 30, 'gone at the 30th step after the one that laid it');
  // a reversal is a turn too for a class without the pull
  steps(S, 30, heading(195));
  steps(S, 1, heading(15));
  assert.ok(p.condT[FOOT] > 0);
  // too slow: 25% of top speed
  const slow = plainRun();
  steps(slow, 30, frame(0.25, 0));
  steps(slow, 30, frame(-0.25, 0));
  assert.equal(slow.player.condT[FOOT], 0);
  // the old headings age out: standing 0.6 s, then the other way
  const rest = plainRun();
  steps(rest, 30, heading(0)); steps(rest, 36); steps(rest, 10, heading(180));
  assert.equal(rest.player.condT[FOOT], 0);
  // turn-limit is the player's stat
  const loose = plainRun({ mods: [{ stat: 'turn-limit', op: 'set', value: 120 }] });
  steps(loose, 30, heading(0)); steps(loose, 1, heading(105));
  assert.equal(loose.player.condT[FOOT], 0);
});

// ---- the Change-ringer ----

test('the pull: a reversal of more than 120 degrees within 0.3 s makes the first voice speak at once, and never wrong-foots', () => {
  const S = ringer(), p = S.player;
  steps(S, 30, heading(0));
  assert.equal(p.setBell, false, 'it never stood still, so the bell is not set');
  const out = steps(S, 1, heading(180));
  assert.deepEqual(out.filter((e) => e.k === 'pull').map((e) => e.a), [1]);
  const cast = out.filter((e) => e.k === 'cast');
  assert.deepEqual(cast.map((e) => [e.a, e.id]), [[0, 'tenor-stroke']], 'the voice in the first place speaks');
  assert.equal(p.condT[FOOT], 0, 'and the reversal does not wrong-foot');
  // a sharp turn short of 120 degrees is no pull, and wrong-foots
  steps(S, 30, heading(180));
  const turn = steps(S, 1, heading(290));
  assert.equal(turn.filter((e) => e.k === 'pull').length, 0);
  assert.ok(p.condT[FOOT] > 0);
});

test('the pull: a reversal that takes longer than pull-window is no pull, and wrong-foots', () => {
  const S = ringer(), p = S.player;
  steps(S, 30, heading(0));
  let pulls = 0;
  for (let i = 1; i <= 30; i++) pulls += steps(S, 1, heading(i * 6)).filter((e) => e.k === 'pull').length;   // 180 degrees in 0.5 s
  assert.equal(pulls, 0);
  assert.ok(p.condT[FOOT] > 0, 'it turned more than 90 degrees within 0.5 s');
  const wide = ringer({ mods: [...Player.classRun('change-ringer').mods, { stat: 'pull-window', op: 'set', value: 0.6 }] });
  steps(wide, 30, heading(0));
  pulls = 0;
  for (let i = 1; i <= 30; i++) pulls += steps(wide, 1, heading(i * 6)).filter((e) => e.k === 'pull').length;
  assert.equal(pulls, 1, 'with a pull-window of 0.6 s the same reversal is a pull');
  assert.equal(wide.player.condT[FOOT], 0, 'and the footing it began to lay is lifted');
});

test('the pull speaks at most once every 0.4 s; rocking faster still never wrong-foots', () => {
  const S = ringer(), p = S.player;
  steps(S, 30, heading(0));
  let spoke = 0, footed = 0;
  for (let k = 0; k < 10; k++) {                             // a reversal every 0.2 s
    const out = steps(S, 12, heading(k % 2 === 0 ? 180 : 0));
    spoke += out.filter((e) => e.k === 'pull').length;
    if (p.condT[FOOT] > 0) footed++;
  }
  assert.equal(spoke, 5, 'ten reversals 0.2 s apart: every second one speaks');
  assert.equal(footed, 0);
});

test('the set bell: standing still for set-time sets it, and the next pull speaks twice', () => {
  const S = ringer(), p = S.player;
  steps(S, 59);
  assert.equal(p.setBell, false);
  steps(S, 1);                                               // 1 s still
  assert.equal(p.setBell, true);
  steps(S, 30, heading(0));
  const out = steps(S, 1, heading(180));
  assert.deepEqual(out.filter((e) => e.k === 'pull').map((e) => e.a), [2]);
  assert.equal(out.filter((e) => e.k === 'cast' && e.a === 0).length, 1, 'the first stroke at once');
  assert.equal(p.setBell, false, 'the pull spends it');
  assert.equal(steps(S, 11, heading(180)).filter((e) => e.k === 'cast' && e.a === 0).length, 0);
  assert.equal(steps(S, 1, heading(180)).filter((e) => e.k === 'cast' && e.a === 0).length, 1, 'the second 0.2 s after the first');
});

test('the trade, Set: the bell at once, wherever you are; recharge 8 s x trade-recharge; not spent while the bell is set', () => {
  const S = ringer(), p = S.player;
  steps(S, 10, heading(0));
  const out = steps(S, 1, Object.assign(heading(0), { trade: true }));
  assert.equal(p.setBell, true);
  assert.deepEqual(out.filter((e) => e.k === 'trade').map((e) => [e.a, e.id]), [[8, 'change-ringer']]);
  near(p.tradeCd, 8);
  steps(S, 30, heading(0));
  steps(S, 1, heading(180));                                 // a pull spends the bell
  assert.equal(p.setBell, false);
  assert.equal(steps(S, 1, Object.assign(heading(180), { trade: true })).filter((e) => e.k === 'trade').length, 0, 'still recharging');
  assert.equal(p.setBell, false);
  const fast = ringer({ mods: [...Player.classRun('change-ringer').mods, { stat: 'trade-recharge', op: 'set', value: 50 }] });
  steps(fast, 1, Object.assign(heading(0), { trade: true }));
  near(fast.player.tradeCd, 4);
  const set = ringer();
  steps(set, 61);                                            // the bell is set by standing
  steps(set, 1, frame(0, 0, true));
  assert.equal(set.player.tradeCd, 0, 'nothing to set: the trade is not spent');
});

test('Tolled-for, no voice speaks: a pull is still a pull (no footing), the bell is kept', () => {
  const S = ringer(), p = S.player;
  steps(S, 61);
  p.condT[TOLLED] = 30;
  steps(S, 30, heading(0));
  const out = steps(S, 1, heading(180));
  assert.equal(out.filter((e) => e.k === 'pull' || e.k === 'cast').length, 0);
  assert.equal(p.condT[FOOT], 0);
  assert.equal(p.setBell, true);
});

test('the heave does nothing in Stage 1: no find is carried', () => {
  const S = ringer();
  const out = steps(S, 5, frame(0, 0, false, true));
  assert.equal(out.filter((e) => e.k === 'heave').length, 0);
  assert.equal(S.player.heaveCd, 0);
});

test('the heave is the finds\' to throw: Items.heave on button B when it is ready; a throw starts heave-recharge', () => {
  const own = loadSim({ only: FILES }), thrown = [];
  let answer = false;
  own.Items.heave = (run) => { thrown.push(run.step); return answer; };
  const S = own.Sim.create(Object.assign({ zone: 'debug', seed: 1 }, own.Player.classRun('change-ringer')));
  own.Sim.step(S, frame(0, 0, false, true));
  assert.deepEqual([thrown.length, S.player.heaveCd], [1, 0], 'nothing to throw: no recharge');
  answer = true;
  own.Sim.step(S, frame(0, 0, false, true));
  assert.deepEqual([thrown.length, S.player.heaveCd], [2, S.sheet.stats['heave-recharge']], 'thrown: 4 s until the next');
  for (let i = 0; i < 60; i++) own.Sim.step(S, frame(0, 0, false, true));
  assert.equal(thrown.length, 2, 'not asked again while it recharges');
  own.Sim.step(S, frame(0, 0, false, false));
  assert.equal(thrown.length, 2, 'nor without the button');
});

// ---- wounds ----

test('wounds: harm opens one where you stand, joins one within wound-join, and opens another beyond it', () => {
  const S = plainRun(), p = S.player, src = Sim.spawnEnemy(S, 't.small', 1, 0), w = S.wounds;
  Dmg.hitPlayer(S, LUNGE, src, 1, 0.5);                       // 5 at depth 0.5
  assert.deepEqual([w.n, w.x[0], w.y[0], w.life[0], w.depth[0], w.opened[0]], [1, 0, 0, 5, 0.5, 0]);
  p.x = 1.9;
  S.eventCount = 0;
  Dmg.hitPlayer(S, LUNGE, src, 0.4, 0.8);                     // 2 at depth 0.8, 1.9 m from it: joins
  assert.deepEqual([w.n, w.life[0], w.depth[0], w.x[0]], [1, 7, 0.8, 0]);
  assert.deepEqual(events(S, 'wound'), [{ k: 'wound', x: 0, y: 0, a: 2, b: 0.8, id: 'join' }]);
  Dmg.hitPlayer(S, LUNGE, src, 0.2, 0.3);                     // 1, now shallower: the depth stays the deeper
  assert.equal(w.depth[0], 0.8);
  p.x = 2.1;
  Dmg.hitPlayer(S, LUNGE, src, 0.2, 0);                       // 2.1 m off: a second wound
  assert.deepEqual([w.n, w.x[1], w.life[1]], [2, 2.1, 1]);
});

test('wounds: at most wound-cap lie open, and when another would open the oldest scars first', () => {
  const S = plainRun(), p = S.player, src = Sim.spawnEnemy(S, 't.small', 0, 3), w = S.wounds;
  for (let i = 0; i < 10; i++) { p.x = i * 3; Dmg.hitPlayer(S, LUNGE, src, 0.2 * (i + 1), 0); }   // 1, 2, ..., 10
  assert.equal(w.n, 10);
  p.x = 40;
  S.eventCount = 0;
  Dmg.hitPlayer(S, LUNGE, src, 0.2, 0);
  assert.equal(w.n, 10);
  assert.equal(w.x[0], 3, 'the first one is gone');
  assert.equal(w.scarred, 1, 'and its life came off greatest life');
  assert.deepEqual(events(S, 'scar'), [{ k: 'scar', x: 0, y: 0, a: 1, b: 0, id: null }]);
  Sim.step(S, frame(1, 0));
  assert.equal(S.sheet.stats['life-max'], 59);
});

test('mending: standing Braced within mend-reach gives a wound back evenly over (1 s + 2 x depth) / mend-rate', () => {
  const mended = (depth, more = {}) => {
    const S = plainRun(more), p = S.player;
    steps(S, 30);                                            // Braced
    p.life = 40;
    Player.wound(S, 6, depth);
    let n = 0;
    while (S.wounds.n > 0 && n < 1000) { steps(S, 1); n++; }
    near(p.life, 46, 1e-9);                                  // 40 and the wound's 6
    return n;
  };
  assert.equal(mended(0), 60, 'a Drag wound: (1 + 2 x 0) / 1 = 1 s');
  assert.equal(mended(0.5), 120, 'a Blow shown 0.5 s: (1 + 2 x 0.5) / 1 = 2 s');
  assert.equal(mended(2), 300, 'a Swell filled over 2 s: (1 + 2 x 2) / 1 = 5 s');
  assert.equal(mended(0, { mods: [{ stat: 'mend-rate', op: 'set', value: 200 }] }), 30, 'mend-rate 200: 1 / 2 = 0.5 s');
});

test('mending: not unless Braced, not beyond mend-reach, not Tolled-for; what came back stays; mend events four a second', () => {
  const S = plainRun(), p = S.player, w = S.wounds;
  steps(S, 30);
  p.life = 40;
  Player.wound(S, 6, 0);
  const out = steps(S, 30);                                  // half of it back
  near(w.life[0], 3, 1e-9); near(p.life, 43, 1e-9);
  const told = out.filter((e) => e.k === 'mend');
  assert.ok(told.length >= 1 && told.length <= 2, 'half a second: two at most');
  near(told.reduce((s, e) => s + e.a, 0) + (w.back[0] - w.told[0]), 3, 1e-9);
  steps(S, 30, frame(0.5, 0));                               // walking: nothing more comes back
  near(w.life[0], 3, 1e-9); near(p.life, 43, 1e-9);
  p.x = 0; p.y = 1.2;                                        // standing 1.2 m off its centre: beyond reach
  steps(S, 60);
  near(w.life[0], 3, 1e-9);
  p.y = 0.9;
  p.condT[TOLLED] = 30;
  steps(S, 60);
  near(w.life[0], 3, 1e-9);
  p.condT[TOLLED] = 0;
  const end = steps(S, 60);
  assert.equal(w.n, 0);
  near(p.life, 46, 1e-9);
  assert.equal(end.filter((e) => e.k === 'mend' && e.id === 'whole').length, 1);
  const total = steps(plainRun(), 1);                        // a fresh run tells nothing
  assert.equal(total.filter((e) => e.k === 'mend').length, 0);
});

test('scars: a wound open wound-term seconds scars: scarring of its life comes off greatest life for the vigil', () => {
  const S = plainRun({ mods: [{ stat: 'wound-term', op: 'set', value: 10 }] }), p = S.player;
  Player.wound(S, 8, 0);                                     // opened at S.t = 0
  const out = steps(S, 600, frame(0.5, 0));                  // walking, so it never mends; the last step began at 9.98 s
  assert.equal(S.wounds.n, 1);
  assert.equal(out.filter((e) => e.k === 'scar').length, 0);
  const at = steps(S, 1, frame(0.5, 0));                     // the step that begins at S.t = 10
  assert.equal(S.wounds.n, 0);
  assert.deepEqual(at.filter((e) => e.k === 'scar').map((e) => [e.x, e.y, e.a]), [[0, 0, 8]]);
  assert.equal(S.wounds.scarred, 8);
  assert.equal(S.sheet.stats['life-max'], 52, '60 - 8, rebuilt in the same step');
  assert.ok((p.conds & bit('scarred')) !== 0);
  const half = plainRun({ mods: [{ stat: 'wound-term', op: 'set', value: 10 }, { stat: 'scarring', op: 'set', value: 50 }] });
  Player.wound(half, 8, 0);
  steps(half, 601, frame(0.5, 0));
  assert.equal(half.wounds.scarred, 4);
});

// ---- the modifier conditions of the player ----

test('conditions: braced, striding and crowded change the mask only after holding 0.25 s; the rest at once; S.dirty rebuilds', () => {
  const S = plainRun(), p = S.player;
  steps(S, 37);
  assert.equal(p.conds & bit('braced'), 0, 'Braced from the 24th step, not yet held 0.25 s');
  steps(S, 1);
  assert.notEqual(p.conds & bit('braced'), 0);
  assert.equal(S.sheet.conds, p.conds, 'and the sheet was rebuilt for it');
  assert.notEqual(p.conds & bit('dry'), 0, 'every place is dry');
  steps(S, 10, frame(1, 0));                                 // moving for 10 steps: the braced bit holds
  assert.notEqual(p.conds & bit('braced'), 0);
  steps(S, 5, frame(1, 0));
  assert.equal(p.conds & bit('braced'), 0, 'after 15 steps it goes');
  steps(S, 15, frame(1, 0));
  assert.notEqual(p.conds & bit('striding'), 0);
  // three of the dead within 3 m: the grid knows them from the next phase 3, so Player.step sees them from the
  // second step, and they must be there 0.25 s (15 steps) before the mask changes
  for (let i = 0; i < 3; i++) Sim.spawnEnemy(S, 't.small', p.x + 1 + i * 0.5, p.y + 1);
  steps(S, 15);
  assert.equal(p.conds & bit('crowded'), 0);
  steps(S, 1);
  assert.notEqual(p.conds & bit('crowded'), 0, 'three of the dead within 3 m for 0.25 s');
  p.condT[FOOT] = 0.5;
  steps(S, 1);
  assert.notEqual(p.conds & bit('wrong-footed'), 0, 'at once');
  p.life = 0.3 * S.sheet.stats['life-max'];
  steps(S, 1);
  assert.notEqual(p.conds & bit('faint'), 0, 'under 35% of greatest life');
  p.condT[TOLLED] = 9;
  steps(S, 1);
  assert.notEqual(p.conds & bit('tolled-for'), 0);
  Player.wound(S, 1, 0);
  steps(S, 1);
  assert.notEqual(p.conds & bit('on-wound'), 0);
});

test('conditions: after-quarter holds the first 8 s after each quarter of the toll interval, not at the start of the vigil', () => {
  // quarters of 10 s (600 steps). A step sees the time it begins at: the one that begins at 10 s is the 601st.
  const S = plainRun({ rules: { tollSeconds: 40 } }), p = S.player;
  steps(S, 60);
  assert.equal(p.conds & bit('after-quarter'), 0, 'the start of the vigil is no quarter');
  steps(S, 540);
  assert.equal(p.conds & bit('after-quarter'), 0, 'the step that began at 9.98 s');
  steps(S, 1);
  assert.notEqual(p.conds & bit('after-quarter'), 0, 'the step that began at 10 s');
  steps(S, 479);
  assert.notEqual(p.conds & bit('after-quarter'), 0, 'the step that began at 17.98 s');
  steps(S, 1);
  assert.equal(p.conds & bit('after-quarter'), 0, 'the step that began at 18 s: 8 s after the quarter');
  steps(S, 1320);
  assert.equal(S.toll, 1, 'the toll has rung at 40 s');
  assert.notEqual(p.conds & bit('after-quarter'), 0, 'and the toll is a quarter too');
});

// ---- pickups and run levels ----

test('pickups: embers raise the run level by S.curves.runXp, coin goes to S.coin, a find to the haul; kind 3 is left alone', () => {
  const S = plainRun(), p = S.player;
  const drop = (kind, value, x = 0, y = 0, item = null) => { const o = S.pickups.alloc(); o.kind = kind; o.value = value; o.x = x; o.y = y; o.ttl = 30; o.item = item; return o; };
  drop(0, 20);
  const out = steps(S, 1);
  assert.equal(p.runLevel, 1);
  assert.equal(p.runXp, 20 - S.curves.runXp[0]);              // the first run level needs 14
  assert.deepEqual(out.filter((e) => e.k === 'level').map((e) => e.a), [1]);
  assert.deepEqual(out.filter((e) => e.k === 'pickup').map((e) => [e.a, e.b]), [[0, 20]]);
  drop(0, S.curves.runXp[1] + S.curves.runXp[2]);
  steps(S, 1);
  assert.equal(p.runLevel, 3, 'two levels at once');
  drop(1, 3);
  steps(S, 1);
  assert.equal(S.coin, 3);
  drop(2, 0, 0, 0, { uid: 9 });
  steps(S, 1);
  assert.deepEqual(plain(S.haul), [{ uid: 9 }]);
  const favour = drop(3, 1, 0.2, 0);
  steps(S, 5);
  assert.equal(favour.alive, true, 'a favour\'s shape is the favours\' to take');
});

test('pickups: drawn in from within pickup-reach, taken on touching; beyond reach they lie', () => {
  const S = plainRun();
  const o = S.pickups.alloc(); o.kind = 1; o.value = 1; o.x = 2.2; o.y = 0; o.ttl = 30;
  const far = S.pickups.alloc(); far.kind = 1; far.value = 1; far.x = 0; far.y = 2.6; far.ttl = 30;
  steps(S, 1);
  near(o.x, 2.2 - 12 / 60);                                   // drawn in at 12 m/s
  let n = 1;
  while (o.alive && n < 60) { steps(S, 1); n++; }
  assert.equal(o.alive, false);
  assert.ok(n <= 10, `taken within ${n} steps`);
  assert.equal(far.alive, true);
  near(far.y, 2.6, 1e-12);                                    // beyond the 2.5 m of pickup-reach it does not move
  assert.equal(S.coin, 1);
});

test('pickups: one a system holds back (state below 0) is left lying; in full mourning no coin is picked up', () => {
  const S = plainRun();
  const drop = (kind, value) => { const o = S.pickups.alloc(); o.kind = kind; o.value = value; o.x = 0.1; o.y = 0; o.ttl = 30; return o; };
  const held = drop(2, 0);
  held.state = -1;                                            // an observance's promise keeps it where it fell
  steps(S, 5);
  assert.deepEqual([held.alive, held.x, S.haul.length], [true, 0.1, 0]);
  held.state = 0;
  steps(S, 1);
  assert.deepEqual([held.alive, S.haul.length], [false, 1], 'let go, it is taken');
  Buffs.add(S, 't.mourning', [{ stat: 'flag.full-mourning', op: 'flat', value: 1 }], 10);   // what Char.mods gives a character in full mourning
  steps(S, 1);
  const coin = drop(1, 4), ember = drop(0, 1);
  steps(S, 5);
  assert.deepEqual([coin.alive, S.coin, ember.alive], [true, 0, false], 'the coin lies; embers are still taken');
  S.buffs.length = 0;
  S.dirty = true;
  steps(S, 2);
  assert.deepEqual([coin.alive, S.coin], [false, 4], 'half mourning allows coin again');
});

// ---- timed modifiers ----

test('Buffs.add: modifiers that hold for their seconds through a Sim.source, then go; adding again renews', () => {
  const S = plainRun();
  Buffs.add(S, 't.haste', [{ stat: 'move-speed', op: 'flat', value: 1 }], 1);
  steps(S, 1);
  assert.equal(S.sheet.stats['move-speed'], 5.5);
  steps(S, 58);
  assert.equal(S.sheet.stats['move-speed'], 5.5);
  Buffs.add(S, 't.haste', [{ stat: 'move-speed', op: 'flat', value: 2 }], 1);
  steps(S, 1);
  assert.equal(S.sheet.stats['move-speed'], 6.5);
  assert.equal(S.buffs.length, 1);
  steps(S, 60);
  assert.equal(S.sheet.stats['move-speed'], 4.5);
  assert.equal(S.buffs.length, 0);
});
