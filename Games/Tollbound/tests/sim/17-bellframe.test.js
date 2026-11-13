// tests/sim/17-bellframe.test.js: the Bellframe (src/js/17-bellframe.js, and its content src/js/44-bellframe.js), by
// the rules of docs/design/04-progression.md, "The Bellframe and Hum": what it gives a character (the same as Char's
// plain reading, which it replaces), its prices, opening pits and buying ringing places with Hum, hanging the bells of
// the dead and their true ring, recasting a gift; a pit opened with one character changing the next (the acceptance of
// Stage 2); and Hum paid by the tolls of a vigil and spent on the frame, with every module below 50 as the page boots.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim, plain } = require('./loader.js');
const { FILES } = require('./household.js');

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
const mod = (stat, op, value, more) => Object.assign({ stat, op, value }, more);

// A small world: a class, its voices, the Bellframe's numbers, a frame of three pits and two gifts of the class.
function content(Defs) {
  const voice = (id) => Defs.add('voice', {
    id, name: id, text: '', icon: null, attr: 'hand', tier: 1, tags: ['round'], weapon: null, archetype: 'ring', target: 'self', rate: 1,
    damage: { blow: [1, 2] }, weaponPct: 0, eff: 1, crit: 0, params: {}, mods: [], fx: {},
  });
  voice('test.toll');
  Defs.add('class', {
    id: 'test.ringer', name: 'Test Ringer', text: '', attrs: { hand: 10, knee: 5 }, perLevel: { hand: 2, knee: 1 }, base: [], voices: ['test.toll'],
    startGear: [], trade: { name: 'Set', text: '', icon: null, recharge: 8 }, callings: ['test.one', 'test.two'], unlock: null, puppet: 'test.ringer',
    palette: ['#A7312C'],
  });
  Defs.add('bellframe', { id: 'main', pitFirst: 100, pitGrowth: 1.5, placeFirst: 80, placeGrowth: 2, placesMost: 3, trueLow: 10, trueHigh: 30, trueGain: 5,
    weighPer: 8, recast: 60, deathHum: 40 });
  Defs.add('pit', { id: 'test.tenor', name: 'Tenor', text: '', icon: null, from: null, grant: [mod('life-max', 'flat', 4)], x: 0, y: 0 });
  Defs.add('pit', { id: 'test.treble', name: 'Treble', text: '', icon: null, from: 'test.tenor', grant: [mod('move-speed', 'inc', 2)], x: 1, y: 0 });
  Defs.add('pit', { id: 'test.second', name: 'Second', text: '', icon: null, from: 'test.treble', grant: [mod('heed-max', 'flat', 3), mod('warn', 'flat', 0.02)], x: 2, y: 0 });
  // a gift whose number is the bell's level (1 at level 1, 20 at level 20), and one of the first calling
  Defs.add('gift', { id: 'test.gift', name: 'Gift', text: '', icon: null, class: 'test.ringer', calling: null, mods: [mod('heed-max', 'flat', { a: 1, b: 20, curve: 'lin' })] });
  Defs.add('gift', { id: 'test.other', name: 'Other', text: '', icon: null, class: 'test.ringer', calling: 'test.one', mods: [mod('damage', 'inc', { a: 2, b: 40, curve: 'lin' }, { tags: ['round'] })] });
}

function world(withFrame) {
  const sim = loadSim({ only: withFrame ? [...FILES, '17-bellframe.js'] : FILES });
  content(sim.Defs);
  assert.deepEqual(plain(sim.Defs.finalize()), []);
  return sim;
}

const bell = (uid, weight, more) => Object.assign({ uid, of: uid + 1000, name: 'Bell ' + uid, class: 'test.ringer', calling: null, weight, gift: 'test.gift', pit: null,
  double: false, known: [] }, more);

// the same Household in a world: two pits open, three bells hung, a character ringing two of them
function household(W) {
  const save = W.SaveData.blank();
  save.account.frame.pits.push('test.treble', 'test.second');
  save.account.frame.places = 3;
  save.uid = 200;
  save.account.frame.bells.push(bell(150, 20, { pit: 'test.tenor' }), bell(151, 25, { pit: 'test.treble', gift: 'test.other' }), bell(152, 70, { pit: 'test.second', double: true }));
  const c = W.Char.create(save, 'test.ringer', 'Agnes', [150, 151]), d = W.Char.create(save, 'test.ringer', 'Bram', [152]);
  return { save, c, d };
}

test('Bellframe.mods gives what Char\'s plain reading gives: every open pit\'s grant, and the gifts of the bells rung, at their level, rung true, twice for a double bell', () => {
  const plainWorld = world(false), framed = world(true);
  assert.equal(typeof plainWorld.Bellframe.mods, 'undefined');
  assert.equal(typeof framed.Bellframe.mods, 'function');
  const A = household(plainWorld), B = household(framed);
  for (const who of ['c', 'd']) {
    const a = plainWorld.Char.sheet(A[who], A.save.account).stats, b = framed.Char.sheet(B[who], B.save.account).stats;
    for (const k of Object.keys(a)) near(b[k], a[k], 1e-9);
  }
  // and by the numbers: Agnes rings bells of 20 and 25 tolls, levels 3 and 4, 20% apart: one pair true, +5%
  const W = framed, { c, d, save } = B, s = W.Char.sheet(c, save.account).stats;
  near(s['life-max'], 60 + 5 * 2 + 4, 1e-9);                                    // base 60, Knee 5 x 2, the tenor pit
  near(s['heed-max'], 100 + 3 + 3 * 1.05, 1e-9);                                // no Ear; the second pit 3; the gift at level 3, x1.05
  near(s.warn, 0.02, 1e-12);
  const out = W.Bellframe.mods(save.account, c, []);
  assert.deepEqual(plain(out.slice(0, 4)), [mod('life-max', 'flat', 4), mod('move-speed', 'inc', 2), mod('heed-max', 'flat', 3), mod('warn', 'flat', 0.02)],
    'the grants of the open pits, in the order they opened');
  near(out[4].value, 3 * 1.05);
  assert.deepEqual([out[5].stat, out[5].op, plain(out[5].tags)], ['damage', 'inc', ['round']]);
  near(out[5].value, (2 + 38 * 3 / 19) * 1.05, 1e-9);                           // the other gift at level 4: 2 + (40 - 2) x 3/19
  // Bram rings one bell of 70 tolls, level 9 (1 + floor(70 / 8)), that rings double; no pair to ring true
  const r = W.Bellframe.ring(save.account, d);
  assert.deepEqual([r.bells.length, r.pairs, r.gain], [1, 0, 1]);
  near(W.Char.sheet(d, save.account).stats['heed-max'], 100 + 3 + 9 * 2, 1e-9);
  assert.deepEqual([W.Bellframe.level({ weight: 0 }), W.Bellframe.level({ weight: 7 }), W.Bellframe.level({ weight: 8 }), W.Bellframe.level({ weight: 1e6 })], [1, 1, 2, 20]);
  // no account: nothing; a run's account copy (Char.begin) gives the same as the save's
  assert.deepEqual(plain(W.Bellframe.mods(null, c, [])), []);
  assert.deepEqual(plain(W.Bellframe.mods({ frame: JSON.parse(JSON.stringify(save.account.frame)), open: {}, warned: {} }, c, [])), plain(out));
  // a bell rung that is not in the frame, or has no gift, gives nothing
  const lost = Object.assign({}, c, { bells: [999] });
  assert.equal(W.Bellframe.mods(save.account, lost, []).length, 4);
  save.account.frame.bells[0].gift = null;
  assert.equal(W.Bellframe.mods(save.account, c, []).length, 5, 'only the second bell\'s gift');
});

test('prices: the first pit after the tenor costs pitFirst and each after it pitGrowth times the last; ringing places likewise; nothing past the last', () => {
  const W = world(true), save = W.SaveData.blank();
  assert.deepEqual(plain(save.account.frame.pits), ['test.tenor'], 'a blank save has the tenor pit open');
  assert.equal(W.Bellframe.price(save, 'pit'), 100);
  save.account.frame.pits.push('test.treble');
  assert.equal(W.Bellframe.price(save, 'pit'), 150);
  save.account.frame.pits.push('test.second');
  assert.equal(W.Bellframe.price(save, 'pit'), Infinity, 'every pit is open');
  assert.deepEqual([1, 2, 3].map((p) => { save.account.frame.places = p; return W.Bellframe.price(save, 'place'); }), [80, 160, Infinity], 'placesMost is 3 here');
  assert.equal(W.Bellframe.price(save, 'bell'), Infinity);
});

test('opening a pit: only one whose from is open, paid from the Household\'s Hum; refused when short, open already, or a vigil is under way', () => {
  const W = world(true), save = W.SaveData.blank(), { Bellframe } = W;
  save.account.hum = 240;
  assert.equal(Bellframe.openable(save, 'test.second'), false, 'the second opens from the treble, which is closed');
  assert.equal(Bellframe.open(save, 'test.second'), false);
  assert.equal(Bellframe.open(save, 'test.tenor'), false, 'open already');
  assert.equal(Bellframe.open(save, 'no.such'), false);
  assert.equal(Bellframe.openable(save, 'test.treble'), true);
  save.away = { char: 1, zone: 'debug', seed: 1, hum: 0, heard: 0, level: 1, tolls: 0 };
  assert.equal(Bellframe.open(save, 'test.treble'), false, 'not while a vigil is under way');
  save.away = null;
  assert.equal(Bellframe.open(save, 'test.treble'), true);
  assert.deepEqual([plain(save.account.frame.pits), save.account.hum], [['test.tenor', 'test.treble'], 140]);
  assert.equal(Bellframe.open(save, 'test.second'), false, '150 Hum and only 140 held');
  assert.equal(save.account.hum, 140, 'and nothing was spent');
  save.account.hum = 150;
  assert.equal(Bellframe.open(save, 'test.second'), true);
  assert.equal(save.account.hum, 0);
  assert.deepEqual(plain(W.SaveData.validate(save)), []);
});

test('ringing places: bought with Hum, one more each time, up to placesMost', () => {
  const W = world(true), save = W.SaveData.blank();
  save.account.hum = 1000;
  assert.equal(save.account.frame.places, 1, 'one place to start');
  assert.deepEqual([W.Bellframe.place(save), W.Bellframe.place(save), W.Bellframe.place(save)], [true, true, false]);
  assert.deepEqual([save.account.frame.places, save.account.hum], [3, 1000 - 80 - 160]);
  save.account.frame.places = 1;
  save.account.hum = 79;
  assert.equal(W.Bellframe.place(save), false);
  assert.equal(save.account.frame.places, 1);
  assert.deepEqual(plain(W.SaveData.validate(save)), []);
});

test('the bells of the dead: one recast at its death, hung in an open empty pit, rung by the next character with its gift at the bell\'s level and its true ring', () => {
  const W = world(true), { Char, SaveData, Bellframe, Sim } = W, save = SaveData.blank();
  const old = Char.create(save, 'test.ringer', 'Agnes');
  old.tolls = 23;                                   // a life of 23 tolls before this vigil
  const cfg = Char.begin(save, old.uid, 'debug', 1), S = Sim.create(cfg);
  S.toll = 1;
  S.cause = { attack: 'test.blow', kind: 'blow', toll: 1 };
  Sim.end(S, 'died');
  const report = Char.end(save, S);
  const b = report.bell;
  assert.deepEqual([b.weight, b.gift, b.pit, save.chars.length], [24, 'test.gift', null, 0], 'the tolls of its whole life; its class\'s gift; waiting to be hung');
  assert.equal(Bellframe.hang(save, b.uid, 'test.treble'), false, 'the treble is not open');
  assert.equal(Bellframe.hang(save, 999, 'test.tenor'), false, 'no such bell');
  save.away = { char: 1, zone: 'debug', seed: 1, hum: 0, heard: 0, level: 1, tolls: 0 };
  assert.equal(Bellframe.hang(save, b.uid, 'test.tenor'), false, 'not while a vigil is under way');
  save.away = null;
  assert.equal(Bellframe.hang(save, b.uid, 'test.tenor'), true);
  assert.equal(Bellframe.hang(save, b.uid, 'test.tenor'), false, 'hung already');
  assert.equal(Bellframe.hung(save, 'test.tenor'), b);
  // a second bell of 20 tolls: one pit a bell, so it waits until another pit is open
  save.account.frame.bells.push(bell(SaveData.uid(save), 20));
  const second = save.account.frame.bells[1];
  assert.equal(Bellframe.hang(save, second.uid, 'test.tenor'), false, 'one bell to a pit');
  save.account.hum = 100;
  assert.ok(Bellframe.open(save, 'test.treble') && Bellframe.hang(save, second.uid, 'test.treble'));
  assert.deepEqual(plain(SaveData.validate(save)), []);
  // the next character rings both: 24 and 20 tolls, 17% apart, ring true; levels 4 and 3
  assert.equal(Char.create(save, 'test.ringer', 'Bram', [b.uid, second.uid]), null, 'one ringing place: one bell');
  save.account.frame.places = 2;
  const next = Char.create(save, 'test.ringer', 'Bram', [b.uid, second.uid]);
  const ring = Bellframe.ring(save.account, next);
  assert.deepEqual([ring.pairs, ring.gain], [1, 1.05]);
  near(Char.sheet(next, save.account).stats['heed-max'], 100 + (4 + 3) * 1.05, 1e-9);
  assert.equal(Char.trueRing([24, 20]), 1);
  assert.equal(Char.trueRing([24, 30]), 1, '20% of the heavier');
  assert.equal(Char.trueRing([24, 36]), 0, '33%: too far apart');
  assert.equal(Char.trueRing([24, 25]), 0, '4%: too near');
});

test('recasting a gift: to another gift of the bell\'s class, for the bellframe\'s recast Hum', () => {
  const W = world(true), { Bellframe, SaveData } = W, save = SaveData.blank();
  save.uid = 10;
  save.account.frame.bells.push(bell(5, 16, { pit: 'test.tenor' }), bell(6, 16, { class: 'test.stranger', gift: null }));
  assert.deepEqual(plain(Bellframe.gifts('test.ringer')), ['test.gift', 'test.other']);
  assert.deepEqual(plain(Bellframe.gifts('test.stranger')), []);
  save.account.hum = 59;
  assert.equal(Bellframe.recast(save, 5, 'test.other'), false, '60 Hum, 59 held');
  save.account.hum = 130;
  assert.equal(Bellframe.recast(save, 5, 'test.gift'), false, 'it has that gift already');
  assert.equal(Bellframe.recast(save, 6, 'test.gift'), false, 'a gift of another class');
  assert.equal(Bellframe.recast(save, 5, 'no.such'), false);
  assert.equal(Bellframe.recast(save, 5, 'test.other'), true);
  assert.deepEqual([save.account.frame.bells[0].gift, save.account.hum], ['test.other', 70]);
  assert.equal(Bellframe.recast(save, 5, 'test.gift'), true, 'and back again');
  assert.deepEqual([save.account.frame.bells[0].gift, save.account.hum], ['test.gift', 10]);
  assert.deepEqual(plain(SaveData.validate(save)), []);
});

// ---- the Bellframe that ships, with every module below 50 ----

// every module below 50, finalized and sealed as the page boots them. What this package defines must be sound
// (01-defs.test.js holds the whole build to that)
function whole() {
  const W = loadSim();
  assert.deepEqual(plain(W.Defs.finalize()).filter((e) => /^(bequest|pit|gift|bellframe) /.test(e)), [], 'the frame and the bequests are sound');
  W.Core.seal(Object.values(W));
  return W;
}
const sim = whole();

test('the frame that ships: one tree of pits from the tenor pit, three tiers drawn as a frame, flat and inc grants; one gift for each class and calling there is', () => {
  const { Defs } = sim, pits = Defs.all('pit'), n = Defs.get('bellframe', 'main');
  assert.deepEqual([n.pitFirst, n.pitGrowth, n.placeFirst, n.placeGrowth, n.placesMost, n.trueLow, n.trueHigh, n.trueGain, n.weighPer, n.recast, n.deathHum],
    [100, 1.5, 100, 1.5, 8, 10, 30, 5, 8, 60, 40], 'the design\'s numbers: 100 Hum, 50% more each; one place to eight; 10% to 30%, +5%');
  assert.equal(pits.length, 12);
  const tenor = pits.filter((p) => p.from === null);
  assert.deepEqual(plain(tenor.map((p) => p.id)), ['tenor'], 'one tenor pit');
  // every pit reaches the tenor through its from, and stands next to the pit it opens from on the frame
  for (const p of pits) {
    const seen = new Set();
    for (let q = p; q.from !== null; q = Defs.get('pit', q.from)) { assert.ok(!seen.has(q.id), 'no circle'); seen.add(q.id); }
    if (p.from !== null) {
      const f = Defs.get('pit', p.from);
      assert.ok(Math.abs(f.y - p.y) <= 1 && Math.abs(f.x - p.x) <= 1 && (f.x !== p.x || f.y !== p.y), `${p.id} stands next to ${f.id}`);
    }
    for (const g of p.grant) assert.ok(g.op === 'flat' || g.op === 'inc', `${p.id}: ${g.op}`);
    assert.ok(p.name.length > 0 && p.text.length > 20, p.id);
  }
  const places = pits.map((p) => p.x + ',' + p.y);
  assert.equal(new Set(places).size, places.length, 'each pit has its own bay');
  assert.deepEqual([0, 1, 2].map((y) => pits.filter((p) => p.y === y).length), [5, 4, 3], 'five bays at the foot, four above, three under the Lantern');
  const gifts = Defs.all('gift');
  assert.deepEqual(plain(gifts.map((g) => [g.id, g.class, g.calling])), [['change-ringer', 'change-ringer', null], ['stander', 'change-ringer', 'stander'],
    ['backward-ringer', 'change-ringer', 'backward-ringer']]);
  for (const cls of Defs.all('class')) {
    assert.equal(gifts.filter((g) => g.class === cls.id && g.calling === null).length, 1, `a gift for the ${cls.id} without a calling`);
    for (const calling of cls.callings) assert.equal(gifts.filter((g) => g.calling === calling).length, 1, `a gift for the calling ${calling}`);
  }
});

test('a pit opened with one character changes the next one, and every one standing, in the Lantern and in every vigil after', () => {
  const { SaveData, Char, Bellframe, Sim } = sim, save = SaveData.blank();
  const first = Char.create(save, 'change-ringer', 'Agnes Toll');
  const before = Char.sheet(first, save.account).stats;
  assert.equal(before['life-max'], 60 + 5 * 2 + 6, 'the tenor pit, open from the first: +6 greatest life');
  save.account.hum = 100;
  assert.ok(Bellframe.open(save, 'curfew'));
  const next = Char.create(save, 'change-ringer', 'Bram');
  const after = Char.sheet(next, save.account).stats;
  assert.equal(after['guard.blow'], before['guard.blow'] + 3, 'Curfew: Brace takes 3 more from every Blow');
  assert.equal(Char.sheet(first, save.account).stats['guard.blow'], after['guard.blow'], 'and the one made before it');
  const S = Sim.create(Char.begin(save, next.uid, 'dial', 3));
  assert.equal(S.sheet.stats['guard.blow'], after['guard.blow'], 'in its vigil too: the run carries the frame');
  assert.equal(S.sheet.guard[0], Math.min(after['guard.blow'], S.sheet.stats['guard-max.blow']));
});

test('Hum paid and spent: the tolls of a vigil pay Hum by the landmarks stood beside, the Household keeps it at the end, and the frame spends it', () => {
  const { SaveData, Char, Bellframe, Sim, Bot } = sim, save = SaveData.blank();
  const c = Char.create(save, 'change-ringer', 'Agnes');
  const S = Sim.create(Char.begin(save, c.uid, 'dial', 7));
  // the scripted player keeps the vigil, set beside the bell-post (a landmark) as each toll comes
  for (let i = 0; i < 3 * 75 * 60 + 30 && S.phase === 'play'; i++) {
    if (S.tollAt - S.step === 2) { S.player.x = S.vigil.postX + 2.5; S.player.y = S.vigil.postY; }
    Sim.step(S, Bot.input(S, 'vigil'));
  }
  assert.equal(S.phase, 'play', 'it kept three tolls');
  const gain = S.sheet.stats['hum-gain'] / 100;
  near(S.hum, (1 + 2 + 3) * 1 * gain, 1e-6);         // the Nth toll pays N Hum times the one landmark stood beside
  Sim.command(S, { type: 'leave' });
  const report = Char.end(save, S);
  near(save.account.hum, report.hum, 1e-9);
  near(save.account.heard, save.account.hum, 1e-9);
  assert.ok(save.account.hum >= 6, `the Household holds ${save.account.hum} Hum`);
  const held = save.account.hum, heard = save.account.heard;
  assert.equal(Bellframe.open(save, 'tide-bell'), held >= 100, 'a pit costs 100');
  save.account.hum = held + 100;                    // as if more vigils had been kept
  assert.ok(Bellframe.open(save, 'market-bell'));
  near(save.account.hum, held + 100 - (held >= 100 ? 150 : 100), 1e-9);
  assert.equal(save.account.heard, heard, 'spending Hum does not unhear it');
  assert.deepEqual(plain(SaveData.validate(save)), []);
});
