// tests/sim/35-knots.test.js: the knots of src/js/35-knots.js and their rules (src/js/23-skills.js, 24-archetypes.js).
// Each rule is held to what it says inside a cast, and to nothing else: a voice of the tests' own with the knot tied
// against the same voice without it. Then which voices each knot fits (requires, excludes), the rope, the share rule at
// a knot's tier, and the same seed giving the same run with knots tied.
// The kernel, the combat package's files and the knots; 22-enemies.js only where the wake is needed (Back-splice). The
// dead stand where they are put (their speed is 0) unless a test moves them.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');

const BASE = ['00-core.js', '01-defs.js', '02-pool-grid.js', '10-stats.js', '11-damage.js', '14-character.js', '16-savedata.js', '20-sim.js',
  '21-player.js', '23-skills.js', '24-archetypes.js', '29-world.js', '30-modes-curves.js', '31-change-ringer.js', '35-knots.js'];
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
const frame = (mx = 0, my = 0) => ({ mx, my, ax: 1, ay: 0, aim: false, trade: false, heave: false });
const STILL = frame();

// a world of the tests' own: voices that want Ear and get 10 of it, so each deals exactly its numbers; the dead do not move
function world(files) {
  const sim = loadSim({ only: files || BASE });
  const { Defs } = sim;
  const voice = (id, more) => Defs.add('voice', Object.assign({
    id, name: id, text: '', icon: null, attr: 'ear', tier: 1, tags: ['blow'], weapon: null, archetype: 'ring', target: 'self', rate: 1,
    damage: { blow: [10, 10] }, weaponPct: 0, eff: 1, crit: 0, params: { radius: 3 }, mods: [], fx: {},
  }, more));
  voice('k.ring', { params: { radius: 3 } });
  voice('k.wide', { params: { radius: 50 } });
  voice('k.near', { target: 'nearest', params: { reach: 10, radius: 1 } });
  voice('k.rap', { archetype: 'rap', target: 'nearest', params: { reach: 8, count: 1 } });
  voice('k.spark', { archetype: 'spark', target: 'nearest', tags: ['blow', 'thrown'], params: { reach: 10, speed: 15, size: 0.2 } });
  voice('k.ahead', { archetype: 'spark', target: 'ahead', tags: ['blow', 'thrown'], params: { reach: 6, speed: 15, size: 0.2 } });
  voice('k.short', { archetype: 'spark', target: 'nearest', tags: ['blow', 'thrown'], params: { reach: 4, speed: 15, size: 0.2 } });
  voice('k.drag', { tags: ['drag'], damage: { drag: [40, 40] }, params: { radius: 3, duration: 1 } });
  voice('k.pierce', { archetype: 'spark', target: 'nearest', tags: ['blow', 'thrown'], params: { reach: 4, speed: 15, size: 0.2 },
    mods: [{ stat: 'pierce', op: 'flat', value: 1 }] });
  // the dead of the tests stand still and keep no guard, so a body that has stood long enough to Brace takes a Blow whole
  const enemy = (id, more) => Defs.add('enemy', Object.assign({
    id, name: id, puppet: id, radius: 0.4, life: 1000, damage: 5, speed: 0, xp: 1, cost: 1, loot: null, ai: 'chase', aiParams: {},
    attacks: [], guard: { blow: 0, drag: 0 }, size: 'small', press: 0, tags: [],
  }, more));
  enemy('k.small');
  enemy('k.large', { size: 'large', radius: 0.7 });
  Defs.add('prop', { id: 'k.post', puppet: 'k.post', radius: 0.5 });
  Defs.add('zone', Object.assign({}, plain(Defs.get('zone', 'debug')), { id: 'k.posts', place: [{ prop: 'k.post', x: 2, y: 0 }] }));
  return sim;
}

const W = world();
const { Sim, Defs, Stats, Skills, Char, Dmg } = W;
const all = (S) => Array.from({ length: S.eventCount }, (u, i) => plain(S.events[(S.eventStart + i) % S.events.length]));
function steps(S, n, f = STILL, sim = W) { const out = []; for (let i = 0; i < n; i++) { sim.Sim.step(S, f); out.push(...all(S)); } return out; }
const casts = (out, slot) => out.filter((e) => e.k === 'cast' && (slot === undefined || e.a === slot));
const harm = (e) => e.lifeMax - e.life;
// the attributes a run gives: Ear 10 for the voices, and Knee and Heel 12 so a knot of tier 2 of theirs works whole.
// Hand is given only where a knot wants it (its own gift, +1% harm a point to the dead within 3 m, is then counted).
const attrs = (o = {}) => ['ear', 'knee', 'heel', 'hand'].map((stat) => ({ stat, op: 'flat',
  value: o[stat] !== undefined ? o[stat] : stat === 'ear' ? 10 : stat === 'hand' ? 0 : 12 }));
const ATTRS = attrs();
const HAND6 = attrs({ hand: 6 }), HAND12 = attrs({ hand: 12 });
const inst = (id, i, knots) => ({ uid: i + 1, id, level: 1, rope: 5, knots: (knots || []).concat([null, null, null, null, null]).slice(0, 5) });
function run(voices, more = {}, sim = W) {
  const mods = more.attrs || ATTRS;
  return sim.Sim.create(Object.assign({ zone: 'debug', seed: 1 }, more, { mods: mods.concat(more.mods || []), voices: voices.map((v, i) => (v === null ? null : inst(v[0], i, v[1]))) }));
}
const spawn = (S, x, y, id = 'k.small', opts, sim = W) => sim.Sim.spawnEnemy(S, id, x, y, opts);
const ear = (n) => attrs({ ear: n });

// ---- the knots as content ----

test('sixteen knots, each with a rule its registry allows, plain numbers, and requires and excludes from the tags', () => {
  const knots = Defs.all('knot');
  assert.equal(knots.length, 16);
  assert.deepEqual(plain(Defs.finalize()), [], 'the knots, the voices and the tests\' own content are all sound');
  for (const k of knots) {
    assert.ok(typeof k.rule === 'string' && Defs.ENUMS.knotRule.includes(k.rule), `${k.id} names a rule`);
    assert.ok(k.tier >= 1 && k.tier <= 2, `${k.id} is of a tier the Dial or its keeper gives`);
    assert.ok(Object.keys(k.params).length > 0 && Object.values(k.params).every((v) => typeof v === 'number' && v > 0), `${k.id}: what it gives is numbers`);
    for (const tag of [...k.requires, ...k.excludes, ...k.addTags]) assert.ok(Stats.is('tag', tag), `${k.id}: ${tag} is a tag`);
    assert.equal(k.trigger, null);
  }
  assert.equal(new Set(knots.map((k) => k.name)).size, 16, 'sixteen names');
});

test('requires and excludes: which voices of the game each knot fits, and a knot that does not fit acts on nothing', () => {
  const fits = (k) => plain(Defs.all('voice').filter((v) => !v.id.startsWith('k.')).filter((v) => Stats.fits(v, Defs.get('knot', k))).map((v) => v.id));
  assert.deepEqual(fits('balance'), ['long-draw'], 'only a thrown voice');
  assert.deepEqual(fits('unlaid'), ['long-draw']);
  assert.ok(!fits('passes-free').includes('tellers') && !fits('resist').includes('tellers') && !fits('clash').includes('tellers') &&
    !fits('handstroke').includes('tellers'), 'the knots that act on each body struck exclude Drag, whose zones the Drag ticks bite');
  assert.ok(!fits('muffle').includes('tenor-stroke') && !fits('muffle').includes('hand-bell') && fits('muffle').includes('plumb'), 'Muffle excludes a ring round you');
  assert.ok(!fits('running-line').includes('plumb') && !fits('running-line').includes('held-breath'), 'Running Line excludes a voice of standing still');
  assert.ok(!fits('quartered').includes('beating-pair'), 'Quartered excludes a voice on its own clock');
  assert.ok(!fits('back-splice').includes('hitch'), 'Back-splice excludes the crossing');
  for (const k of Defs.all('knot')) assert.ok(fits(k.id).length > 0, `${k.id} fits some voice of the game`);
  // the skill sheet leaves out a knot that does not fit, so its rule does nothing
  const S = run([['k.drag', ['passes-free']], ['k.ring', ['passes-free']]]);
  assert.deepEqual(plain(S.skills.map((s) => s.sheet.knots.map((k) => k.id))), [[], ['passes-free']]);
  assert.equal(S.skills[0].sheet.params['free-more'], undefined);
  // and Char.tie refuses it
  const save = W.SaveData.blank(), c = Char.create(save, 'change-ringer', 'Tamsin');
  c.knots = { 'passes-free': 1, balance: 1 };
  const tellers = c.voices.find((v) => v.id === 'tellers'), tenor = c.voices.find((v) => v.id === 'tenor-stroke');
  assert.equal(Char.tie(c, tellers.uid, 0, 'passes-free'), false);
  assert.equal(Char.tie(c, tenor.uid, 0, 'balance'), false);
  assert.equal(Char.tie(c, tenor.uid, 0, 'passes-free'), true);
  assert.deepEqual(plain(tenor.knots), ['passes-free', null]);
  assert.deepEqual(plain(c.knots), { balance: 1 });
});

test('the rope: two places at level 1, one more at 7, 13 and 19; a knot is tied only into a place the rope has', () => {
  assert.deepEqual([1, 6, 7, 12, 13, 18, 19, 20].map((l) => Char.rope(l)), [2, 2, 3, 3, 4, 4, 5, 5]);
  const save = W.SaveData.blank(), c = Char.create(save, 'change-ringer', 'Tamsin'), v = c.voices[0];
  c.knots = { 'open-lead': 3 };
  assert.equal(Char.tie(c, v.uid, 2, 'open-lead'), false, 'a voice of level 1 has two places');
  assert.ok(Char.tie(c, v.uid, 0, 'open-lead') && Char.tie(c, v.uid, 1, 'open-lead'));
  assert.equal(Char.tie(c, v.uid, 1, 'stones-answer'), false, 'only a knot the character holds');
  // a voice that speaks through 48 tolls in vigils its character lives through is of level 7: its rope has three places
  save.chars[0] = c;
  const cfg = Char.begin(save, c.uid, 'debug', 1), S = { cfg, toll: 48, hum: 0, coin: 0, haul: [], bank: { coin: 0, finds: [] }, cause: null,
    sheet: { stats: { 'hum-gain': 100 } }, result: { outcome: 'left', zone: 'debug', tolls: 48 } };
  Char.end(save, S);
  const after = save.chars[0].voices.find((x) => x.uid === v.uid);
  assert.deepEqual([after.level, after.rope, plain(after.knots)], [7, 3, ['open-lead', 'open-lead', null]]);
  assert.ok(Char.tie(save.chars[0], v.uid, 2, 'open-lead'));
  assert.deepEqual(plain(W.SaveData.validate(save)), []);
});

test('the share rule at a knot\'s tier: a knot wants 6 x its tier of its attribute, and its numbers work at the share', () => {
  // Resist is a knot of Ear, tier 2: it wants 12
  const at = (n) => run([['k.ring', ['resist']]], { attrs: ear(n) }).skills[0].sheet.params['resist-bite'];
  near(at(12), 200);
  near(at(6), 100);
  near(at(24), 200, 1e-9);
  near(at(1), 40, 1e-9);                                     // never under a fifth
  // and the rule bites with that number: x (1 + 100 / 100); the voice too wants Ear (10 at tier 1), so its base is 6
  const S = run([['k.ring', ['resist']]], { attrs: ear(6) }), e = spawn(S, 2, 0);
  steps(S, 1);
  near(harm(e), 10 * 0.6 * 2, 1e-9);
  // a knot of tier 1 (Open Lead, Ear) wants 6
  near(run([['k.ring', ['open-lead']]], { attrs: ear(3) }).skills[0].sheet.params['lead-damp'], 20);
});

// ---- the rules, one by one ----

test('running-line: 60% faster once the heading has held within 15 degrees for a second; silent 0.7 s after a sharper turn', () => {
  const S = run([['k.wide', ['running-line']]]);
  spawn(S, 30, 30);
  steps(S, 30, frame(1, 0));
  near(S.knots.pace[0], 1, 1e-9);
  steps(S, 45, frame(1, 0));
  near(S.knots.pace[0], 1.6, 1e-9);
  // a cooldown of 1 s runs out in 1 / 1.6 s
  const out = casts(steps(S, 120, frame(1, 0)), 0);
  assert.ok(out.length === 3 || out.length === 4, `three or four casts in 2 s at 1.6 a second, not ${out.length}`);
  // a sharp turn: silent for 0.7 s from the sample that sees it, then speaking as it is until the heading holds again
  for (let k = 0; k < 6 && S.knots.pace[0] !== 0; k++) Sim.step(S, frame(0, 1));
  near(S.knots.pace[0], 0, 0);
  const silent = steps(S, 41, frame(0, 1));
  assert.equal(casts(silent, 0).length, 0, 'not a word for 0.7 s');
  steps(S, 2, frame(0, 1));
  near(S.knots.pace[0], 1, 1e-9);
  assert.equal(Skills.speak(S, 0, 1), true, 'once the silence is over the pull may make it speak');
  // the same voice without the knot never changes pace
  const T = run([['k.wide']]);
  spawn(T, 30, 30);
  assert.equal(casts(steps(T, 240, frame(1, 0)), 0).length, 4);
});

test('open-lead: every fourth stroke is left out, and in that beat the player takes 40% less from Blows and Drag', () => {
  const S = run([['k.wide', ['open-lead']]]);
  spawn(S, 5, 0);
  const B = Stats.TYPE.blow, D = Stats.TYPE.drag, SW = Stats.TYPE.swell;
  const out = steps(S, 181);                                 // strokes due at 0, 1, 2, 3 s: the fourth is the beat
  assert.equal(casts(out, 0).length, 3);
  near(S.sheet.taken[B], 0.6);
  near(S.sheet.taken[D], 0.6);
  near(S.sheet.taken[SW], 1, 0);
  steps(S, 60);
  near(S.sheet.taken[B], 1, 1e-9, 'the beat lasts one interval');
  assert.equal(casts(steps(S, 240), 0).length, 3, 'and the count goes on: of the strokes due at 5, 6, 7 and 8 s the eighth is left out');
  // two voices whose beats fall together damp half as much again
  const T = run([['k.wide', ['open-lead']], ['k.wide', ['open-lead']]]);
  spawn(T, 5, 0);
  steps(T, 181);
  near(T.sheet.taken[B], 0.4);
});

test('quartered: no stroke by itself; each one it would have made is saved and all go at each quarter, 0.1 s apart', () => {
  const S = run([['k.wide', ['quartered']]], { rules: { tollSeconds: 8 }, attrs: ear(12) });   // a quarter is 2 s
  spawn(S, 5, 0);
  const before = steps(S, 119);
  assert.equal(casts(before, 0).length, 0);
  assert.equal(S.knots.bank[0], 2, 'two strokes saved, at 0 s and 1 s');
  const at = steps(S, 12).filter((e) => e.k === 'cast');
  assert.equal(at.length, 2);
  const T = run([['k.wide']], { rules: { tollSeconds: 8 } });
  spawn(T, 5, 0);
  assert.equal(casts(steps(T, 120), 0).length, 2, 'the same voice without the knot speaks at 0 and 1 s');
  // the steps they came at: the quarter (step 120) and 6 steps on
  const S2 = run([['k.wide', ['quartered']]], { rules: { tollSeconds: 8 } });
  spawn(S2, 5, 0);
  const when = [];
  for (let i = 0; i < 131; i++) { Sim.step(S2, STILL); if (all(S2).some((e) => e.k === 'cast')) when.push(S2.step - 1); }
  assert.deepEqual(when, [120, 126]);
});

test('slip-knot: casts tied to the sharp corners turned while it is ready, let go when the player stops, each on its corner', () => {
  const S = run([['k.ring', ['slip-knot']]]);
  for (let i = 0; i < 12; i++) spawn(S, -6 + i * 1.5, -6);
  const a = steps(S, 60, frame(1, 0));                       // east for a second: no stroke on its own time
  assert.equal(casts(a, 0).length, 0);
  steps(S, 90, frame(0, -1));                                 // a sharp corner north, then on for 1.5 s
  assert.equal(S.knots.bank[0], 1);
  const corner = [S.knots.slipX[0], S.knots.slipY[0]];
  near(S.skills[0].cd, 0, 0, 'its cooldown, 20% slower, has run out again');
  steps(S, 30, frame(-1, 0));                                 // west: a second corner
  assert.equal(S.knots.bank[0], 2);
  const second = [S.knots.slipX[1], S.knots.slipY[1]];
  const stop = casts(steps(S, 20), 0);                        // the stop lets both go, 0.1 s apart
  assert.equal(stop.length, 2);
  assert.deepEqual(stop.map((e) => [e.x, e.y]), [corner, second], 'each on its own corner, oldest first');
  assert.equal(S.knots.bank[0], 0);
});

test('back-splice: it speaks from a figure where the player stood 2 s ago, which stays while one of the dead is near it', () => {
  const sim = world(BASE.concat(['22-enemies.js'])), S = run([['k.ring', ['back-splice']]], { attrs: HAND6 }, sim);
  steps(S, 180, frame(1, 0), sim);                            // 3 s east: the figure is 2 s back, 9 m and more behind
  const p = S.player, fx = S.knots.figX[0];
  near(fx, p.x - 2 * S.sheet.stats['move-speed'], 0.2);
  const e = spawn(S, fx, S.knots.figY[0] + 1, 'k.small', undefined, sim);
  const out = steps(S, 60, frame(1, 0), sim);
  near(S.knots.figX[0], fx, 1e-9, 'one of the dead within 3 m of it: it stays to finish the clump');
  const spoke = casts(out, 0);
  assert.ok(spoke.length >= 1 && spoke.every((c) => Math.abs(c.x - fx) < 1e-9), 'it speaks where the figure stands');
  assert.ok(harm(e) > 0);
  e.life = 0;
  steps(S, 2, frame(1, 0), sim);
  assert.ok(S.knots.figX[0] > fx + 3, 'with nobody near, it jumps to where the player stood 2 s ago');
  near(S.knots.pace[0], 1 / 1.15, 1e-9, 'its cooldown runs 15% slower');
});

test('stones-answer: each stroke answered 0.3 s later from the nearest obstacle within 6 m at 60%; with none, 20% weaker', () => {
  const S = run([['k.ring', ['stones-answer']]], { zone: 'k.posts', attrs: HAND6 });   // a post at (2, 0)
  const beside = spawn(S, 4.7, 0), behind = spawn(S, -2, 0);   // only the post reaches the first; only the player the second
  const out = steps(S, 19);
  assert.equal(casts(out, 0).length, 2, 'the stroke, and its answer');
  const answer = casts(out, 0)[1];
  assert.deepEqual([answer.x, answer.y], [2, 0], 'answered from the post');
  near(harm(beside), 6, 1e-9);                                // 4.3 m off: Hand's gift to the near does not reach it
  near(harm(behind), 10 * 1.06, 1e-9);
  const T = run([['k.ring', ['stones-answer']]], { attrs: HAND6 }), close = spawn(T, 2, 0);
  assert.equal(casts(steps(T, 30), 0).length, 1, 'no obstacle: no answer');
  near(harm(close), 8 * 1.06, 1e-9, 'and the stroke itself 20% weaker');
});

test('muffle: twice as often, every second stroke an echo opposite the last landing, mirrored through the player, at 30%', () => {
  const S = run([['k.near', ['muffle']]]);
  const east = spawn(S, 3, 0), west = spawn(S, -3, 0.1);
  steps(S, 1);
  assert.deepEqual([harm(east), harm(west)], [10, 0], 'the first stroke on the nearest');
  near(S.knots.pace[0], 2, 1e-9);
  steps(S, 30);                                              // half a second on: the muffled stroke
  near(harm(west), 3, 1e-9);
  near(harm(east), 10, 1e-9);
  assert.equal(S.skills[0].sheet.params['muffle-pace'], 100);
  // the reach is 20% less: a body 9 m off is out of reach of the 10 m voice
  const T = run([['k.near', ['muffle']]]), far = spawn(T, 9, 0);
  steps(T, 30);
  assert.equal(harm(far), 0);
});

test('passes-free: the first body is let through untouched and the rest are struck 60% harder; one alone wastes the stroke', () => {
  const S = run([['k.ring', ['passes-free']]], { attrs: HAND6 }), first = spawn(S, 1, 0), second = spawn(S, 0, 2.5);
  steps(S, 1);
  assert.equal(harm(first), 0);
  near(harm(second), 16 * 1.06, 1e-9);
  const T = run([['k.ring', ['passes-free']]], { attrs: HAND6 }), alone = spawn(T, 1, 0);
  const out = steps(T, 1);
  assert.equal(harm(alone), 0);
  assert.equal(casts(out, 0).length, 1, 'the stroke was spoken, and wasted');
  near(T.skills[0].cd, 1, 1e-9);
  // a rap passes the nearest and strikes the next; a thrown thing passes through the first it meets
  const R = run([['k.rap', ['passes-free']]], { attrs: HAND6 }), r1 = spawn(R, 2, 0), r2 = spawn(R, 4, 0);
  steps(R, 1);
  assert.deepEqual([harm(r1), harm(r2)], [0, 16]);
  const P = run([['k.spark', ['passes-free']]], { attrs: HAND6 }), p1 = spawn(P, 3, 0), p2 = spawn(P, 5, 0);
  steps(P, 1);
  P.skills[0].cd = 99;
  steps(P, 60);
  assert.deepEqual([harm(p1), harm(p2)], [0, 16]);
});

test('resist: the first touch on a body bites three times as hard; then that voice never harms it until the next toll', () => {
  const S = run([['k.ring', ['resist']]], { rules: { tollSeconds: 4 }, attrs: ear(12) }), e = spawn(S, 2, 0);
  steps(S, 1);
  near(harm(e), 30);
  steps(S, 180);                                             // 3 s more: three strokes, none of them on it
  near(harm(e), 30);
  const late = spawn(S, -2, 0);
  steps(S, 61);                                              // the toll at 4 s: the wax is gone
  near(harm(late), 30, 1e-9, 'a fresh body is bitten as hard');
  near(harm(e), 60, 1e-9, 'and after the toll the first is bitten again');
});

test('handstroke: the dead on the right hand of the line walked are struck 70% harder, those on the left 70% less', () => {
  const S = run([['k.ring', ['handstroke']]], { attrs: HAND6 }), H = 1.06;   // Hand 6: its own +6% to the near
  steps(S, 30, frame(1, 0));                                  // walking east: the right hand is +y, down the screen
  S.skills[0].cd = 0;
  const p = S.player, right = spawn(S, p.x, p.y + 2), left = spawn(S, p.x, p.y - 2), ahead = spawn(S, p.x + 2, p.y);
  steps(S, 1, frame(1, 0));
  near(harm(right), 17 * H, 1e-9);
  near(harm(left), 3 * H, 1e-9);
  near(harm(ahead), 10 * H, 1e-6);
  // standing, the line holds
  steps(S, 60);
  const r2 = spawn(S, S.player.x, S.player.y + 1.5);
  S.skills[0].cd = 0;
  steps(S, 1);
  near(harm(r2), 17 * H, 1e-9);
});

test('clash: alone a voice strikes at half; two Clash voices striking one body within 0.25 s pay the first one\'s foil double', () => {
  const S = run([['k.ring', ['clash']], ['k.ring', ['clash']]], { attrs: ear(12) }), e = spawn(S, 2, 0);
  steps(S, 1);
  near(harm(e), 5 + 5 + 10, 1e-9, 'both halves, and the foil of the first paid at 200%');
  const T = run([['k.ring', ['clash']], ['k.ring']], { attrs: ear(12) }), f = spawn(T, 2, 0);
  steps(T, 1);
  near(harm(f), 5 + 10, 1e-9, 'a partner without the knot pays nothing');
  // one voice striking the same body again only renews its foil
  const U = run([['k.ring', ['clash']]], { attrs: ear(12) }), g = spawn(U, 2, 0);
  steps(U, 61);
  near(harm(g), 10, 1e-9);
});

test('louvres: the stroke becomes four lanes 2 m wide, one toward the bell-post (north without one), 50% harder', () => {
  const S = run([['k.ring', ['louvres']]]);
  const north = spawn(S, 0, -2.5), east = spawn(S, 2.5, 0), between = spawn(S, 2, -2);
  steps(S, 1);
  assert.deepEqual([harm(north), harm(east), harm(between)], [15, 15, 0]);
  const lanes = S.areas.items.slice(0, S.areas.n).filter((a) => a.alive && a.team === 0);
  assert.equal(lanes.length, 4);
  assert.ok(lanes.every((a) => Math.abs(a.len - 3) < 1e-9 && a.r === 1));
  // a bell-post turns the cross: one arm points at it
  const T = run([['k.ring', ['louvres']]], { zone: 'k.posts' });
  T.combat.post = true; T.combat.postX = 3; T.combat.postY = 3;
  const diag = spawn(T, 1.6, 1.6);
  steps(T, 1);
  near(harm(diag), 15, 1e-9);
});

test('balance: thrown things stand at the end of their flight; light bodies rock one, a large one tips it over for double', () => {
  const S = run([['k.pierce', ['balance']]]);                 // it passes through one body, and so flies its whole 4 m
  const target = spawn(S, 2, 0);                              // in reach, so the voice aims east
  steps(S, 1);
  S.skills[0].cd = 99;
  steps(S, 8);
  near(harm(target), 5, 1e-9, 'on the way out it strikes at half');
  target.x = -20;
  steps(S, 12);
  const stood = S.shots.items.slice(0, S.shots.n).find((o) => o.alive && o.state === 1);
  assert.ok(stood, 'at the end of its flight it stands');
  const light = spawn(S, stood.x, stood.y + 0.3);
  steps(S, 2);
  assert.equal(stood.a1, 1, 'a small body passing rocks it');
  light.x = 50;
  const heavy = spawn(S, stood.x + 0.5, stood.y, 'k.large');
  steps(S, 1);
  near(harm(heavy), 10 * 2 * 1.2, 1e-9, 'a large one tips it over onto itself: twice, and 20% for the rock');
  assert.ok(!(stood.ttl > 0));
});

test('unlaid: two strands 40 degrees apart at half each; where both strike bodies within 1.5 m of each other, 300% there', () => {
  const S = run([['k.ahead', ['unlaid']]], { attrs: HAND12 });   // Hand 12: its own +12% to the near
  S.player.face = 0;
  const up = spawn(S, 2, -0.73), down = spawn(S, 2, 0.73);    // each on a strand, 1.46 m apart
  steps(S, 1);
  S.skills[0].cd = 99;
  steps(S, 30);
  near(harm(up), (5 + 30) * 1.12, 1e-9);
  near(harm(down), (5 + 30) * 1.12, 1e-9);
  const T = run([['k.ahead', ['unlaid']]], { attrs: HAND12 });   // 3.9 m off: beyond Hand's reach
  T.player.face = 0;
  const u2 = spawn(T, 4, -1.46), d2 = spawn(T, 4, 1.46);      // 2.9 m apart: they do not fit
  steps(T, 1);
  T.skills[0].cd = 99;
  steps(T, 30);
  assert.deepEqual([harm(u2), harm(d2)], [5, 5]);
});

test('ringers-fine: with coin carried each stroke flings a coin out where it landed and strikes 50% harder; without, at half', () => {
  const S = run([['k.ring', ['ringers-fine']]], { attrs: HAND6 }), e = spawn(S, 2, 0);
  S.coin = 3;
  const out = steps(S, 1);
  near(harm(e), 15 * 1.06, 1e-9);
  assert.equal(S.coin, 2);
  const coin = S.pickups.items.slice(0, S.pickups.n).find((o) => o.alive && o.kind === 1);
  assert.ok(coin && coin.value === 1 && Math.hypot(coin.x - S.player.x, coin.y - S.player.y) >= 3 - 1e-9, 'out beyond reach');
  near(coin.ttl, (S.tollAt - S.step) / 60 + 0, 1 / 60 + 1e-9, 'it lies until the next toll');
  assert.ok(out.some((x) => x.k === 'drop' && x.a === 1));
  S.coin = 0;
  e.life = e.lifeMax;
  steps(S, 60);
  near(harm(e), 5 * 1.06, 1e-9);
});

test('second-voice: standing still its strokes take the next voice\'s shape with its own harm; both voices at 75%', () => {
  const S = run([['k.ring', ['second-voice']], ['k.rap']]), far = spawn(S, 6, 0);
  steps(S, 1);
  near(harm(far), 7.5 * 1 + 7.5, 1e-9, 'the rap\'s shape lent to the ring (7.5), and the rap\'s own stroke at 75%');
  assert.deepEqual([S.knots.lends[0], S.knots.lentBy[1]], [1, 0]);
  near(S.knots.pace[1], 1 / 1.25, 1e-9, 'the lent one\'s cooldown runs 25% slower');
  // moving, the ring speaks as itself: 2 m round, the body 6 m off untouched
  const T = run([['k.ring', ['second-voice']], ['k.rap']]);
  T.skills[1].cd = 99;
  steps(T, 20, frame(1, 0));
  const off = spawn(T, T.player.x + 6, T.player.y), by = spawn(T, T.player.x + 1.5, T.player.y);
  T.skills[0].cd = 0;
  steps(T, 1, frame(1, 0));
  assert.deepEqual([harm(off), harm(by)], [0, 7.5]);
});

// ---- the same seed, the same run ----

function chase(S) {
  const p = S.player;
  for (const e of S.enemies.items.slice(0, S.enemies.n)) {
    if (!e.alive) continue;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    if (d < 0.9) { e.vx = 0; e.vy = 0; continue; }
    e.vx = dx / d * 2; e.vy = dy / d * 2;
    e.x += e.vx / 60; e.y += e.vy / 60;
  }
}
function play(seed) {
  const S = run([['k.ring', ['running-line', 'stones-answer']], ['k.spark', ['unlaid', 'passes-free']], ['k.near', ['muffle', 'resist']],
    ['k.ring', ['clash', 'open-lead']], ['k.ring', ['clash', 'handstroke']], ['k.short', ['balance', 'ringers-fine']]], { seed, zone: 'k.posts' });
  S.coin = 50;
  for (let i = 0; i < 40; i++) spawn(S, Math.cos(i * 0.9) * (6 + i % 5), Math.sin(i * 0.9) * (6 + i % 5), i % 7 === 0 ? 'k.large' : 'k.small');
  for (let i = 0; i < 900; i++) {
    chase(S);
    Sim.step(S, frame(Math.sign(Math.sin(i / 11)) * 0.9, Math.cos(i / 70) * 0.3));
  }
  return S;
}

test('the same seed twice gives the same run with knots tied, and another seed another', () => {
  const a = play(11), b = play(11), c = play(12);
  assert.equal(Sim.hash(a), Sim.hash(b));
  assert.notEqual(Sim.hash(a), Sim.hash(c));
  assert.deepEqual([a.kills, a.coin, plain(a.knots.bank)], [b.kills, b.coin, plain(b.knots.bank)]);
  // two runs stepped in turn do not disturb each other: the cast in hand is set afresh for every cast
  const A = run([['k.near', ['muffle']], ['k.ring', ['slip-knot']]]), B1 = run([['k.near', ['muffle', 'stones-answer']]]);
  const B2 = run([['k.near', ['muffle', 'stones-answer']]]);
  for (const S of [A, B1, B2]) { spawn(S, 2, 0); spawn(S, -3, 1); }
  for (let i = 0; i < 240; i++) Sim.step(B1, frame(Math.sin(i / 9), 0));
  for (let i = 0; i < 240; i++) { Sim.step(A, frame(0, Math.cos(i / 7))); Sim.step(B2, frame(Math.sin(i / 9), 0)); }
  assert.equal(Sim.hash(B1), Sim.hash(B2));
  assert.deepEqual(plain(B1.knots.muffN), plain(B2.knots.muffN));
});
