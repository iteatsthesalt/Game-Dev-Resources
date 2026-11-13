// tests/sim/15-progress.test.js: bequests (src/js/15-progress.js, 28-bequests.js and the content 45-bequests.js), by the
// rules of docs/design/04-progression.md: each bequest counted by its rule in a vigil, in the Household or by one
// character, and what it leaves when it is met; the vigil's end for them (Progress.endVigil, which Char.end calls); a
// system that changes nothing a run plays; and the Register's head start after deaths.
// The events a vigil hears are set by the test: in these worlds Director.step (phase 2 of a step) is replaced by one
// that emits the events the test queues, so each bequest meets exactly what its rule asks and nothing rises or tolls by
// itself (a toll is rung by setting S.tollAt).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const modules = require('../../tools/modules.js');
const { loadSim, plain } = require('./loader.js');
const { FILES } = require('./household.js');

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
const ev = (k, a, b, id) => ({ k, a: a || 0, b: b || 0, id: id === undefined ? null : id });

// Plays a vigil of a character in world W: plan is a list of steps, each {events, toll}; the run ends with outcome.
// Returns the run, Char.end's report and the 'bequest' events heard.
function keep(W, save, uid, zone, plan, outcome, queue) {
  const S = W.Sim.create(W.Char.begin(save, uid, zone, 1)), heard = [];
  for (const step of plan) {
    queue.push(...(step.events || []));
    if (step.toll) S.tollAt = S.step + 1;
    W.Sim.step(S, W.Sim.NO_INPUT);
    for (let i = 0; i < S.eventCount; i++) {
      const e = S.events[(S.eventStart + i) % S.events.length];
      if (e.k === 'bequest') heard.push(e.id);
    }
  }
  if (outcome === 'died') S.cause = { attack: 'test.blow', kind: 'blow', toll: S.toll };
  if (outcome) W.Sim.end(S, outcome);
  return { S, report: W.Char.end(save, S), heard };
}

// events in steps of at most 500
function steps(events) {
  const out = [];
  for (let i = 0; i < events.length; i += 500) out.push({ events: events.slice(i, i + 500) });
  return out.length ? out : [{}];
}
const times = (n, e) => Array.from({ length: n }, () => e);
const tolls = (n) => Array.from({ length: n }, () => ({ toll: true }));

// a world whose Director only emits what the test queues
function injected(W) {
  const queue = [];
  W.Director.step = function (S) { for (const e of queue.splice(0)) W.Sim.emit(S, e.k, S.player.x, S.player.y, e.a, e.b, e.id); };
  return queue;
}

// ---- a small world of its own: what a bequest may leave, and how a where counts ----

const mod = (stat, op, value) => ({ stat, op, value });
function content(Defs) {
  Defs.add('voice', {
    id: 'test.toll', name: 'Toll', text: '', icon: null, attr: 'hand', tier: 1, tags: ['round'], weapon: null, archetype: 'ring', target: 'self', rate: 1,
    damage: { blow: [1, 2] }, weaponPct: 0, eff: 1, crit: 0, params: {}, mods: [], fx: {},
  });
  const cls = (id, unlock) => Defs.add('class', {
    id, name: id, text: '', attrs: { hand: 10, knee: 5 }, perLevel: { hand: 2, knee: 1 }, base: [], voices: ['test.toll'], startGear: [],
    trade: { name: 'Set', text: '', icon: null, recharge: 8 }, callings: ['test.one', 'test.two'], unlock, puppet: 'test.ringer', palette: ['#A7312C'],
  });
  cls('test.ringer', null);
  cls('test.locked', 'test.opens');
  Defs.add('base', { id: 'test.rope', name: 'Rope', slot: 'tool', family: 'rope', level: 1, fixed: { stat: 'pull-window', op: 'flat', min: 0.05, max: 0.05 },
    tables: {}, icon: null, unlock: 'test.opens', weight: 1 });
  Defs.add('observance', { id: 'test.stability', name: 'Stability', text: '', icon: null, attr: 'knee', tier: 1, heed: 30, mods: [mod('damage', 'inc', 25)], aura: null });
  Defs.add('cause', { id: 'test.drowned', name: 'Drowned' });
  const bequest = (id, more) => Defs.add('bequest', Object.assign({ id, name: id, text: '', hidden: false, scope: 'account', where: {}, reward: {} }, more));
  bequest('test.opens', { on: 'kill', count: 2, reward: { class: 'test.locked', base: 'test.rope', observance: 'test.stability',
    bill: { zone: 'debug', causes: ['test.drowned'] }, voice: 'test.toll', planPoints: 3, coin: 25, hum: 40 } });
  bequest('test.best-vigil', { scope: 'character', on: 'kill', count: 5, where: { vigil: true } });
  bequest('test.summed', { scope: 'character', on: 'stroke', count: 10, where: { sum: 'b' } });
  bequest('test.late', { scope: 'character', on: 'kill', count: 2, where: { toll: 2 } });
  bequest('test.tolls', { scope: 'character', on: 'toll', count: 3, where: {} });
}
function small() {
  const W = loadSim({ only: [...FILES, '15-progress.js', '28-bequests.js'] });
  content(W.Defs);
  assert.deepEqual(plain(W.Defs.finalize()), []);
  return W;
}

test('what a bequest leaves: a class, a base and an observance opened, a Bill, a voice into the chest, Plan points, coin and Hum', () => {
  const W = small(), { SaveData, Char, Progress } = W, save = SaveData.blank();
  const c = Char.create(save, 'test.ringer', 'Agnes');
  assert.equal(Char.create(save, 'test.locked', 'Bram'), null, 'a class a bequest opens is closed until then');
  save.account.coin = 5;
  const hum = Progress.pay(save, 'test.opens', c, 1.5);
  assert.equal(hum, 60, '40 Hum times the hum-gain given');
  const open = save.account.open;
  assert.deepEqual(plain([open.classes, open.bases, open.observances, open.bills]), [['test.locked'], ['test.rope'], ['test.stability'],
    [{ zone: 'debug', causes: ['test.drowned'] }]]);
  assert.deepEqual(plain(c.known), ['test.stability'], 'and the character who met it learns the observance');
  assert.deepEqual([c.planPoints, save.account.coin, save.account.hum, save.account.heard], [3, 30, 60, 60]);
  assert.deepEqual(plain(save.chest.voices), [{ uid: save.uid, id: 'test.toll', level: 1, rope: 2, knots: [null, null], tolls: 0 }], 'a voice with a uid of the save');
  assert.ok(Char.create(save, 'test.locked', 'Bram') !== null, 'and the class is open now');
  assert.deepEqual(plain(SaveData.validate(save)), []);
  // paying twice opens nothing twice; with no character, no Plan points and nothing learnt
  Progress.pay(save, 'test.opens', null);
  assert.deepEqual([open.classes.length, open.bases.length, open.observances.length, c.planPoints, save.account.hum], [1, 1, 1, 3, 100]);
});

test('a bequest\'s where: from a toll on, the best of one vigil, a sum of the events\' b, and the tolls heard', () => {
  const W = small(), { SaveData, Char, Progress } = W, queue = injected(W), save = SaveData.blank(), c = Char.create(save, 'test.ringer', 'Agnes');
  const kill = ev('kill', 0, 1, 'debug.husk'), status = (id) => plain(Progress.status(save, Char.find(save, c.uid), id));
  // vigil one: 3 kills before the second toll and 3 after it; two tolls; a stroke banking 4.5 coin, one banking 3.9
  let r = keep(W, save, c.uid, 'debug', [...steps(times(3, kill)), ...tolls(2), ...steps([kill, kill, kill, ev('stroke', 1, 4.5), ev('stroke', 2, 3.9)])], 'left', queue);
  assert.deepEqual(status('test.late'), { n: 3, count: 2, done: true, scope: 'character' }, 'only the kills from the second toll on');
  assert.deepEqual(status('test.best-vigil'), { n: 6, count: 5, done: true, scope: 'character' });
  assert.deepEqual(status('test.summed'), { n: 8, count: 10, done: false, scope: 'character' }, '4.5 + 3.9, rounded down at the end');
  assert.deepEqual(status('test.tolls'), { n: 2, count: 3, done: false, scope: 'character' });
  assert.deepEqual(plain(r.report.bequests), ['test.opens', 'test.best-vigil', 'test.late'], 'the six kills met the Household\'s two as well');
  // vigil two: three kills, one toll, a stroke of 2: the best vigil stays 6, the sum adds up, the tolls add up
  r = keep(W, save, c.uid, 'debug', [...steps(times(3, kill)), ...tolls(1), ...steps([ev('stroke', 1, 2)])], 'left', queue);
  assert.deepEqual(status('test.best-vigil').n, 6, 'the most one vigil counted');
  assert.deepEqual(status('test.summed'), { n: 10, count: 10, done: true, scope: 'character' });
  assert.deepEqual(status('test.tolls'), { n: 3, count: 3, done: true, scope: 'character' });
  assert.deepEqual(plain(r.report.bequests), ['test.summed', 'test.tolls'], 'met once: those done before are not met again');
  assert.deepEqual(plain(SaveData.validate(save)), []);
});

test('the vigil\'s counts are kept in the run until its end; a vigil left unfinished counts nothing; a run without a character counts nothing', () => {
  const W = small(), { SaveData, Char, Sim, Progress } = W, queue = injected(W), save = SaveData.blank(), c = Char.create(save, 'test.ringer', 'Agnes');
  const S = Sim.create(Char.begin(save, c.uid, 'debug', 2));
  assert.equal(S.bequests.on, true);
  queue.push(ev('kill', 0, 1, 'debug.husk'), ev('kill', 1, 1, 'debug.husk'));
  Sim.step(S, Sim.NO_INPUT);
  const at = Progress.compiled().byId['test.opens'];
  assert.equal(S.bequests.n[at], 2, 'counted in the run');
  Char.checkpoint(save, S);
  assert.deepEqual(plain(save.account.bequests), {}, 'nothing in the save before the end');
  assert.deepEqual(plain(Char.find(save, c.uid).bequests), {}, 'a checkpoint keeps the character\'s own record as it was');
  Char.abandoned(save);
  assert.deepEqual([plain(save.account.bequests), save.account.open.classes.length], [{}, 0], 'the page left the vigil unfinished: nothing counted');
  const loose = Sim.create({ zone: 'debug', seed: 3, mods: [], voices: [] });
  assert.equal(loose.bequests.on, false);
  queue.push(ev('kill', 0, 1, 'debug.husk'));
  Sim.step(loose, Sim.NO_INPUT);
  assert.equal(loose.bequests.n[at], 0);
  const debug = Sim.debugScene(20, 4);
  assert.equal(debug.bequests.on, false, 'nor a debug scene');
});

test('the bequest event: when a character\'s own bequest is met in the vigil, and a Household\'s one when the run knows its record', () => {
  const W = small(), { SaveData, Char, Sim } = W, queue = injected(W), save = SaveData.blank(), c = Char.create(save, 'test.ringer', 'Agnes');
  const kill = ev('kill', 0, 1, 'debug.husk');
  let r = keep(W, save, c.uid, 'debug', [{ events: [kill, kill] }, { events: [kill, kill] }, { events: [kill] }, { events: [kill] }], 'left', queue);
  assert.deepEqual(plain(r.heard), ['test.best-vigil'], 'the fifth kill meets it; the Household\'s record is not in the run\'s account');
  // a run whose account carries the Household's records hears the Household's bequests too
  const save2 = SaveData.blank(), d = Char.create(save2, 'test.ringer', 'Bram');
  save2.account.bequests['test.opens'] = { n: 1, done: false };
  const cfg = Char.begin(save2, d.uid, 'debug', 5);
  cfg.account.bequests = JSON.parse(JSON.stringify(save2.account.bequests));
  const S = Sim.create(cfg);
  queue.push(kill);
  Sim.step(S, Sim.NO_INPUT);
  const ids = [];
  for (let i = 0; i < S.eventCount; i++) ids.push(S.events[(S.eventStart + i) % S.events.length].id);
  assert.ok(ids.includes('test.opens'), 'one kill more than the one counted before');
  // a bequest met already is never heard again
  r = keep(W, save, c.uid, 'debug', [{ events: times(6, kill) }], 'left', queue);
  assert.deepEqual(plain(r.heard), []);
});

// ---- the bequests that ship, with every module below 50 ----

const B = loadSim();
assert.deepEqual(plain(B.Defs.finalize()), []);
const QUEUE = injected(B);
const KEEPER = 'dial.half-muffled-keeper';

// For each bequest: what counts (an event, a toll, or the vigil's end) and what does not, as [event, ctx] pairs.
const RULES = {
  'great-hour': { yes: ev('kill', 3, 1, KEEPER), no: [[ev('kill', 1, 1, 'dial.heavy')], [ev('kill', 3, 1, 'other.keeper')]] },
  'a-quiet-dial': { yes: ev('kill', 0, 1, 'dial.wake-walker'), no: [[ev('kill', 0, 1, 'debug.husk'), { zone: 'debug' }]] },
  'the-heavy-ones': { yes: ev('kill', 0, 2, 'dial.heavy'), no: [[ev('kill', 0, 1, 'dial.wake-walker')]] },
  'shake-them-off': { yes: ev('kill', 0, 1, 'dial.hanger-on'), no: [[ev('kill', 0, 1, 'dial.heavy')]] },
  'the-great-dead': { yes: ev('kill', 1, 3, 'dial.wake-walker'), no: [[ev('kill', 0, 3, 'dial.wake-walker')]], also: [ev('kill', 2, 1, 'x'), ev('kill', 3, 1, KEEPER)] },
  'put-by': { yes: ev('stroke', 3, 50), no: [[ev('stroke', 3, 0)], [ev('pickup', 1, 50)]], sum: 50 },
  'three-times-over': { yes: ev('kill', 3, 1, KEEPER), no: [[ev('kill', 1, 1, 'dial.heavy')]] },
  'twenty-homecomings': { end: 'left', no: [[ev('end', 3, 9, 'spared')], [ev('end', 3, 9, 'died')]] },
  'first-toll': { toll: true, no: [[ev('kill', 0, 1, 'dial.heavy')]] },
  'wait-for-the-keeper': { toll: true, least: 8, no: [[ev('toll', 7)]] },
  'ring-on': { toll: true, least: 12, no: [[ev('toll', 11)]] },
  'come-home': { end: 'left', no: [[ev('end', 2, 1, 'spared')]] },
  'five-times-home': { end: 'left', no: [[ev('end', 2, 1, 'died')]] },
  'spared-at-the-gate': { end: 'spared', no: [[ev('end', 2, 1, 'left')]] },
  'close-your-wounds': { yes: ev('mend', 2, 0, 'whole'), no: [[ev('mend', 2, 0, null)]] },
  'take-what-is-given': { yes: ev('favour', 1, 1, 'arval-bread'), no: [[ev('offer', 3, 1)]] },
  'lay-the-keeper': { yes: ev('kill', 3, 1, KEEPER), no: [[ev('kill', 2, 1, 'dial.wake-walker')]] },
  'rock-the-crowd': { yes: ev('pull', 2), no: [[ev('pull', 1)], [ev('pull', 2), { cls: 'verger' }]] },
  'a-long-life': { toll: true, no: [[ev('kill', 0, 1, 'dial.heavy')]] },
  'grow-into-the-rope': { yes: ev('grow', 9), no: [[ev('grow', 8)]], also: [ev('grow', 12)] },
};

test('the bequests that ship: about twenty, each counted on an event the game knows, with a where the counting reads and a reward', () => {
  const { Defs, Progress } = B, all = Defs.all('bequest');
  assert.deepEqual(plain(all.map((b) => b.id).sort()), Object.keys(RULES).sort(), 'every bequest has its rule tested below');
  assert.ok(all.length >= 18 && all.length <= 24);
  for (const b of all) {
    assert.ok(Defs.ENUMS.event.includes(b.on), `${b.id}: on ${b.on}`);
    for (const k of Object.keys(b.where)) assert.ok(Progress.WHERE.includes(k), `${b.id}: where.${k}`);
    assert.ok(b.name.length > 0 && b.text.length > 30, `${b.id} has a name and a wish`);
    assert.ok(Object.keys(b.reward).length > 0, `${b.id} leaves something`);
  }
  assert.ok(all.some((b) => b.scope === 'account') && all.some((b) => b.scope === 'character') && all.some((b) => b.hidden));
  const points = all.filter((b) => b.scope === 'character').reduce((n, b) => n + (b.reward.planPoints || 0), 0);
  assert.ok(points >= 8 && points <= 15, `the Dial's bequests give a character ${points} points of the Plan (about 15 in the whole game)`);
  assert.ok(Defs.ENUMS.event.includes('bequest'), 'the bequest event is a kind the game knows');
});

test('every bequest is counted by its rule: what it asks counts, and what it does not ask does not', () => {
  const { Progress } = B, ctx = { zone: 'dial', toll: 1, cls: 'change-ringer' };
  for (const id of Object.keys(RULES)) {
    const rule = RULES[id], def = B.Defs.get('bequest', id);
    const yes = rule.toll ? ev('toll', rule.least || 1) : rule.end ? ev('end', 3, 9, rule.end) : rule.yes;
    assert.equal(Progress.admits(id, yes, ctx), rule.sum || 1, `${id} counts ${JSON.stringify(yes)}`);
    for (const e of rule.also || []) assert.equal(Progress.admits(id, e, ctx), 1, `${id} counts ${JSON.stringify(e)}`);
    for (const [e, more] of rule.no) assert.equal(Progress.admits(id, e, Object.assign({}, ctx, more)), 0, `${id} does not count ${JSON.stringify(e)} ${JSON.stringify(more || {})}`);
    assert.equal(Progress.admits(id, Object.assign({}, yes, { k: def.on === 'kill' ? 'hit' : 'kill' }), ctx), 0, `${id} counts only ${def.on}`);
  }
});

// Plays the vigils a bequest asks for, from a new Household, and returns the save, the character and every report.
function meet(id) {
  const { SaveData, Char } = B, def = B.Defs.get('bequest', id), rule = RULES[id], save = SaveData.blank();
  const c = Char.create(save, 'change-ringer', 'Agnes Toll'), reports = [], heard = [];
  const vigil = (plan, outcome) => { const r = keep(B, save, c.uid, 'dial', plan, outcome, QUEUE); reports.push(r.report); heard.push(...r.heard); return r; };
  if (rule.toll) {                                    // vigils of ten tolls, or one of the toll a bequest waits for
    const per = rule.least || 10, vigils = rule.least ? 1 : Math.ceil(def.count / per);
    for (let v = 0; v < vigils; v++) vigil(tolls(per), 'left');
  } else if (rule.end) {
    for (let v = 0; v < def.count; v++) vigil([{}], rule.end);
  } else {
    vigil(steps(times(Math.ceil(def.count / (rule.sum || 1)), rule.yes)), 'left');
  }
  return { save, c: Char.find(save, c.uid), reports, heard, def };
}

test('every bequest that ships is met by doing what it asks, once, and leaves what it says: Plan points to the character, coin and Hum to the Household, a voice to the chest', () => {
  const { SaveData, Progress } = B;
  for (const id of Object.keys(RULES)) {
    const { save, c, reports, heard, def } = meet(id);
    const st = Progress.status(save, c, id), met = reports.flatMap((r) => plain(r.bequests));
    assert.ok(st.done && st.n >= def.count, `${id}: ${JSON.stringify(st)}`);
    assert.equal(met.filter((x) => x === id).length, 1, `${id} is met once`);
    assert.ok(plain(reports[reports.length - 1].bequests).includes(id), `${id} is met at the end of the vigil that brought it to its count`);
    if (def.scope === 'character' && !['end', 'toll'].includes(def.on)) assert.ok(heard.includes(id), `${id}: the bequest event in the vigil it was met`);
    // what every bequest met in these vigils left, added up, is what the Household and the character gained
    let points = 0, coin = 0, hum = 0, voices = 0;
    for (const m of met) {
      const r = B.Defs.get('bequest', m).reward;
      points += r.planPoints || 0;
      coin += r.coin || 0;
      hum += r.hum || 0;
      voices += r.voice ? 1 : 0;
    }
    assert.equal(c.planPoints, points, `${id}: Plan points`);
    assert.equal(save.account.coin, coin, `${id}: coin (nothing was rung down in these vigils)`);
    near(save.account.hum, hum, 1e-9);                                  // the Change-ringer's hum-gain is 100%: no mourning
    assert.equal(save.chest.voices.length, voices, `${id}: voices into the chest`);
    if (def.reward.voice) assert.ok(save.chest.voices.some((v) => v.id === def.reward.voice));
    near(reports.reduce((n, r) => n + r.hum, 0), save.account.hum, 1e-9);   // a report's Hum counts what its bequests paid
    assert.deepEqual(plain(SaveData.validate(save)), [], id);
  }
});

test('a character that dies takes its own counts with it; the Household keeps its counts from that vigil', () => {
  const { SaveData, Char } = B, save = SaveData.blank(), c = Char.create(save, 'change-ringer', 'Agnes');
  const r = keep(B, save, c.uid, 'dial', [...steps(times(3, ev('kill', 3, 1, KEEPER))), ...tolls(2)], 'died', QUEUE);
  assert.deepEqual(plain(r.report.bequests), ['great-hour', 'three-times-over'], 'the Household\'s; lay-the-keeper went with the character');
  assert.deepEqual(plain(save.account.bequests), { 'great-hour': { n: 3, done: true }, 'a-quiet-dial': { n: 3, done: false }, 'the-great-dead': { n: 3, done: false },
    'three-times-over': { n: 3, done: true } }, 'three keepers laid in the Dial count for the Dial\'s dead and the great dead as well');
  assert.equal(save.chars.length, 0);
  // a cause new to the Register pays 40 Hum times the toll (2); the two bequests 120 and 150 Hum, 30 and 50 coin
  assert.deepEqual([r.report.hum, save.account.hum, save.account.coin], [40 * 2 + 120 + 150, 40 * 2 + 120 + 150, 30 + 50]);
  assert.deepEqual(plain(SaveData.validate(save)), []);
});

test('the system changes nothing a run plays: a character\'s vigil plays the same with it as without it', () => {
  const without = loadSim({ only: modules.sim().filter((f) => f !== '28-bequests.js'), boot: true }), withIt = loadSim({ boot: true });
  const play = (W) => {
    const save = W.SaveData.blank(), c = W.Char.create(save, 'change-ringer', 'Agnes'), S = W.Sim.create(W.Char.begin(save, c.uid, 'dial', 11));
    for (let i = 0; i < 1500; i++) W.Sim.step(S, W.Bot.input(S, 'vigil'));
    return [W.Sim.hash(S), S.kills, S.toll];
  };
  const a = play(without), b = play(withIt);
  assert.deepEqual(a, b);
  assert.ok(b[1] > 0, 'the dead were laid');
});

test('the Register: each death, what killed it, and the head start it gives every later character, three deaths at most', () => {
  const { SaveData, Char, Sim, Progress, Defs } = B, save = SaveData.blank();
  const die = (name, attack, kind, toll) => {
    const c = Char.create(save, 'change-ringer', name), S = Sim.create(Char.begin(save, c.uid, 'dial', 1));
    S.toll = toll;
    S.cause = { attack, kind, toll };
    Sim.end(S, 'died');
    return Char.end(save, S);
  };
  const first = die('Agnes', 'dial.load', 'swell', 2);
  assert.deepEqual(plain(save.register[0]), { uid: first.char, name: 'Agnes', class: 'change-ringer', calling: null, level: 1, tolls: 2, vigils: 1, zone: 'dial', toll: 2,
    cause: { attack: 'dial.load', kind: 'swell' }, how: 'died', bell: first.bell.uid });
  assert.ok(Defs.get('enemy', 'dial.heavy').attacks.includes('dial.load'), 'the Lumper\'s load: what the Register names it by');
  for (const name of ['Bram', 'Cass', 'Dora']) die(name, 'dial.load', 'swell', 1);
  die('Eli', 'dial.clutch', 'blow', 3);
  die('Fen', null, 'drag', 1);                                        // the press of the dead: no attack, no head start
  const head = plain(Progress.headStart(save));
  assert.deepEqual(head, [{ attack: 'dial.load', kind: 'swell', deaths: 3, seconds: 0.15 * 3 }, { attack: 'dial.clutch', kind: 'blow', deaths: 1, seconds: 0.15 }]);
  const next = Char.create(save, 'change-ringer', 'Gil'), cfg = Char.begin(save, next.uid, 'dial', 2);
  near(cfg.account.warned['dial.load'], head[0].seconds);
  near(cfg.account.warned['dial.clutch'], head[1].seconds);
  assert.equal(Char.begin(save, first.char, 'dial', 3), null, 'the dead cannot be played');
  assert.deepEqual(plain(SaveData.validate(save)), []);
});
