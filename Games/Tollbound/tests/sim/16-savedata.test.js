// tests/sim/16-savedata.test.js: the save (src/js/16-savedata.js): a blank one, the text of an export and its import
// (the same save comes back), the check that names every fault and never throws, the migration from the first plan's
// shape, and 500 corrupted imports. The world is tests/sim/household.js: the kernel, 14-character.js and
// 16-savedata.js with content of the tests' own.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { plain } = require('./loader.js');
const { world, line, ended } = require('./household.js');

const W = world(), { Char, SaveData, Core } = W;
const fresh = () => SaveData.blank();

// a Household with something in every part of the save: two standing characters (one away in a vigil), the Register,
// bells hung and rung, a chest of finds, voices and knots, coin and Hum, a bequest under way, a class and a Bill opened
function rich() {
  const save = fresh();
  save.account.open.classes.push('test.locked');
  save.account.open.bills.push({ zone: 'debug', causes: ['test.drowned'] });
  save.account.bequests['test.opening'] = { n: 1, done: true };
  const a = Char.create(save, 'test.ringer', 'Agnes Toll');
  a.level = 12;
  a.xp = 431.5;
  a.planPoints = 2;
  Char.allocate(a, 'test.lane', 'knee');
  Char.allocate(a, 'test.corner');
  Char.allocate(a, 'test.square');
  Char.allocate(a, 'test.lane');
  a.worn.tool.lines[0] = line('stood', 'damage', 12);
  a.worn.tool.lines[4] = line('timed', 'warn', 0.1, { backward: true, struck: 'object', toll: 8 });
  a.worn.tool.gone.push(6);
  a.worn.tool.walk = 2;
  a.knots['test.slip'] = 2;
  Char.tie(a, a.voices[0].uid, 0, 'test.slip');
  Char.learn(a, 'test.stability');
  Char.hold(a, 'test.stability', save.account);
  a.mourning = { term: 2, left: 1 };
  a.tolls = 40;
  a.vigils = 5;
  a.bequests['test.opening'] = { n: 0, done: false };
  // a death, its bell hung in the tenor pit and rung by the second character
  const b = Char.create(save, 'test.ringer', 'Bram');
  b.tolls = 24;
  const cfg = Char.begin(save, b.uid, 'debug', 'seed');
  Char.end(save, ended(cfg, 'died', { tolls: 3, cause: { attack: 'dial.load', kind: 'swell', toll: 2 } }));
  save.account.frame.bells[0].pit = 'test.tenor';
  const c = Char.create(save, 'test.locked', 'Cass', [save.account.frame.bells[0].uid]);
  save.chest.finds.push({ uid: SaveData.uid(save), base: 'test.token', level: 9, fixed: { stat: 'heed-max', op: 'flat', value: 5, cond: ['dry', 'faint'], unless: 'braced' },
    lines: [line('pressed', 'added.blow', [2, 4], { op: 'flat', band: [1, 3] }), null, null, null, null, null, null, null], gone: [], walk: -1, cool: 3 });
  save.chest.voices.push(Char.voice(SaveData.uid(save), 'test.weight'));
  save.chest.knots['test.lead'] = 3;
  save.account.coin = 125;
  save.account.hum = 380.25;
  save.account.heard = 900;
  save.account.frame.pits.push('test.treble');
  save.account.frame.places = 2;
  save.rev = 17;
  Char.begin(save, c.uid, 'debug', 77);
  assert.deepEqual(plain(SaveData.validate(save)), [], 'the rich save is sound');
  return save;
}

// ---- a blank save, and uids ----

test('a blank save: nobody yet, an empty chest, the tenor pit open, one ringing place; and it is sound', () => {
  const save = fresh();
  assert.deepEqual(plain(save), {
    v: 3, rev: 0, uid: 0, chars: [], register: [], chest: { finds: [], voices: [], knots: {} },
    account: { coin: 0, hum: 0, heard: 0, frame: { pits: ['test.tenor'], places: 1, bells: [] }, open: { classes: [], bases: [], observances: [], bills: [] }, bequests: {} },
    active: null, away: null,
  });
  assert.deepEqual(plain(SaveData.validate(save)), []);
  assert.deepEqual([SaveData.uid(save), SaveData.uid(save), save.uid], [1, 2, 2], 'one counter for everything the save gives a uid');
  assert.deepEqual([SaveData.VERSION, SaveData.KEY], [3, 'save']);
  assert.notEqual(fresh(), fresh(), 'a new object each time');
});

// ---- export and import ----

test('export then import returns the same save, character for character: levels, the route, the finds and their lines', () => {
  const save = rich(), text = SaveData.encode(save), back = SaveData.decode(text);
  assert.match(text, /^TOLLBOUND SAVE 3 [0-9a-f]{8}\n\{"v":3,/);
  assert.deepEqual(plain(back.errors), []);
  assert.deepEqual(plain(back.save), plain(save));
  assert.equal(SaveData.encode(back.save), text, 'and its export is the same text again');
  const a = back.save.chars[0];
  assert.deepEqual([a.level, a.xp, plain(a.plan.walk), a.worn.tool.lines[0].value, a.worn.tool.walk], [12, 431.5, ['test.door', 'test.lane', 'test.corner', 'test.square', 'test.lane'], 12, 2]);
  // what Store does with it, a JSON round trip, gives a save that reads as sound too: that is a reload
  assert.deepEqual(plain(SaveData.read(JSON.parse(JSON.stringify(save))).save), plain(save));
  // the text may lose its first line (a player's own edit): plain JSON is read too
  assert.deepEqual(plain(SaveData.decode(JSON.stringify(save)).save), plain(save));
  assert.deepEqual(plain(SaveData.decode('﻿  ' + text + '\n\n').save), plain(save), 'with a byte-order mark and white space round it');
});

test('an import that is not a save says why, and gives no save', () => {
  const text = SaveData.encode(rich());
  const why = (t) => { const r = SaveData.decode(t); assert.equal(r.save, null, JSON.stringify(t).slice(0, 60)); return r.errors.join(' | '); };
  assert.match(why(text.replace('"Agnes Toll"', '"Agnes Tell"')), /changed or cut short/, 'a changed letter breaks the check');
  assert.match(why(text.slice(0, text.length - 40)), /changed or cut short/, 'and so does a cut');
  assert.match(why('hello'), /not a save/);
  assert.match(why(''), /not a save/);
  assert.match(why(5), /must be given as text/);
  assert.match(why(null), /must be given as text/);
  assert.match(why('x'.repeat(SaveData.LIMITS.text + 1)), /longer than any save/);
  assert.match(why('[1, 2]'), /must be an object/);
  assert.match(why('{"v": 4}'), /version 4, newer than this game reads \(3\)/);
  assert.match(why('{"rev": 3}'), /has no version/);
  assert.match(why('{"v": 2}'), /save\.rev is missing/);
  assert.match(why('{"v": 1.5}'), /has no version/);
});

// ---- the check ----

// each change breaks a sound save in one place; the check must name it
function faults(change) {
  const save = rich();
  change(save);
  return SaveData.validate(save);
}
const named = (change, pattern) => {
  const found = faults(change);
  assert.ok(found.some((e) => pattern.test(e)), `expected ${pattern}, got ${JSON.stringify(found)}`);
};

test('the check names a fault in the shape of a save, a character, a find, a voice, a bell or a death', () => {
  named((s) => { delete s.chest; }, /^save\.chest is missing$/);
  named((s) => { s.extra = 1; }, /^save\.extra is not a field of this shape$/);
  named((s) => { s.v = 1; }, /^save\.v must be 3, not 1$/);
  named((s) => { s.chars[0].class = 'sorcerer'; }, /^save\.chars\[0\]\.class names the class "sorcerer", and there is none$/);
  named((s) => { s.chars[0].level = 71; }, /^save\.chars\[0\]\.level must be a whole number from 1 to 70, not 71$/);
  named((s) => { s.chars[0].level = 2.5; }, /level must be a whole number/);
  named((s) => { s.chars[0].xp = -1; }, /xp must be a number of 0 or more/);
  named((s) => { s.chars[0].name = ''; }, /name must be a name of 1 to 24 letters/);
  named((s) => { s.chars[0].name = 'a\u0007b'; }, /name must be a name of 1 to 24 letters/);
  named((s) => { s.chars[0].name = ' Agnes'; }, /name must be a name/);
  named((s) => { s.chars[0].knots['test.nothing'] = 1; }, /knots\.test\.nothing \(the key\) names no knot/);
  named((s) => { s.chars[0].knots['test.lead'] = 0; }, /knots\.test\.lead must be a whole number from 1/);
  named((s) => { s.chars[0].mourning = { term: 2, left: 3 }; }, /mourning must be null or \{term, left\}/);
  named((s) => { s.chars[0].calling = 'stander'; }, /calling "stander" is not a calling of the test\.ringer/);
  named((s) => { s.chars[0].peals = ['loud']; }, /peals\[0\] names the peal "loud", and there is none/);
  named((s) => { s.chars[0].bequests.nothing = { n: 1, done: false }; }, /bequests\.nothing \(the key\) names no bequest/);
  named((s) => { s.account.coin = -5; }, /^save\.account\.coin must be a number from 0/);
  named((s) => { s.account.hum = '12'; }, /^save\.account\.hum must be a number/);
  named((s) => { s.account.open.classes.push('test.nobody'); }, /open\.classes\[1\] names the class "test\.nobody"/);
  named((s) => { s.account.open.bills[0].causes = []; }, /open\.bills\[0\]\.causes must hold one to four causes/);
  named((s) => { s.account.frame.places = 9; }, /frame\.places must be a whole number from 1 to 8/);
  named((s) => { s.register[0].how = 'vanished'; }, /register\[0\]\.how must be "died" or "retired"/);
  named((s) => { s.register[0].cause = { attack: 'dial.load', kind: 'fire' }; }, /register\[0\]\.cause must be null or \{attack/);
  named((s) => { s.register[0].bell = 999; }, /register\[0\]\.bell 999 is not a bell of the frame/);
  named((s) => { s.active = 999; }, /^save\.active 999 is no standing character$/);
  named((s) => { s.away.char = 999; }, /^save\.away\.char 999 is no standing character$/);
  named((s) => { s.away.zone = 'nowhere'; }, /^save\.away\.zone names the zone "nowhere"/);
});

test('the check holds uids unique and within the counter', () => {
  named((s) => { s.chars[1].uid = s.chars[0].uid; }, /save\.chars\[1\]\.uid is \d+, the uid of save\.chars\[0\]\.uid as well/);
  named((s) => { s.chest.finds[0].uid = s.chars[0].worn.tool.uid; }, /save\.chest\.finds\[0\]\.uid is \d+, the uid of save\.chars\[0\]\.worn\.tool\.uid as well/);
  named((s) => { s.chest.voices[0].uid = s.uid + 1; }, /save\.chest\.voices\[0\]\.uid must be a whole number from 1 to save\.uid/);
  named((s) => { s.chars[0].voices[0].uid = -3; }, /voices\[0\]\.uid must be a whole number from 1 to save\.uid/);
});

test('the check holds the route to the rules of the Plan', () => {
  named((s) => { s.chars[0].plan.walk[0] = 'test.lane'; }, /plan\.walk\[0\] "test\.lane" is not the door of the test\.ringer/);
  named((s) => { s.chars[0].plan.walk.push('test.mile'); }, /plan\.walk\[5\] "test\.mile" is not linked to "test\.lane"/);
  assert.deepEqual(plain(faults((s) => { s.chars[0].plan.walk.push('test.door'); })), [], 'back onto the door: linked, and doubled once');
  named((s) => { s.chars[0].plan.walk.push('test.square', 'test.lane'); s.chars[0].planPoints = 10; }, /holds "test\.lane" a third time/);
  named((s) => { s.chars[0].level = 1; s.chars[0].planPoints = 0; }, /plan\.walk spends 4 points, more than the 0 it has/);
  named((s) => { delete s.chars[0].plan.choice['test.lane']; }, /plan\.choice has no attribute chosen for the lane "test\.lane"/);
  named((s) => { s.chars[0].plan.choice['test.lane'] = 'ear'; }, /plan\.choice\.test\.lane "ear" is not an attribute that lane offers/);
  named((s) => { s.chars[0].plan.choice['test.mile'] = 'knee'; }, /plan\.choice\.test\.mile \(the key\) is not a node of the route/);
  named((s) => { s.chars[0].plan.walk.push('test.nowhere'); }, /plan\.walk\[5\] names the node "test\.nowhere", and there is none/);
});

test('the check holds finds, voices, the loadout, observances and the Bellframe to their rules', () => {
  named((s) => { s.chars[0].worn.hat = s.chest.finds.pop(); }, /worn\.hat\.base "test\.token" is worn in hat, but its slot is token/);
  assert.deepEqual(plain(faults((s) => { s.chars[0].worn['token-2'] = s.chest.finds.pop(); })), [], 'a token in a token place is sound');
  named((s) => { s.chars[0].worn.tool.lines.push(null); }, /worn\.tool\.lines must hold 8 places/);
  named((s) => { s.chars[0].worn.tool.lines[0].posture = 'kneeling'; }, /lines\[0\]\.posture "kneeling" is not a posture that writes lines/);
  named((s) => { s.chars[0].worn.tool.lines[0].op = 'more'; }, /lines\[0\]\.op a written line adds with flat or inc, not "more"/);
  named((s) => { s.chars[0].worn.tool.lines[0].struck = 'verb'; }, /lines\[0\]\.struck must be null, "object" or "condition"/);
  named((s) => { s.chars[0].worn.tool.lines[0].band = [5, 1]; }, /lines\[0\]\.band must be \[low, high\]/);
  named((s) => { s.chars[0].worn.tool.lines[6] = s.chars[0].worn.tool.lines[0]; }, /worn\.tool\.lines\[6\] holds a line, but the place is erased for good/);
  named((s) => { s.chars[0].worn.tool.walk = 6; }, /worn\.tool\.walk is a place erased for good/);
  named((s) => { s.chars[0].worn.tool.cool = 5; }, /worn\.tool\.cool must be a whole number from 0 to 4/);
  named((s) => { s.chars[0].worn.tool.fixed.value = [1, 2]; }, /worn\.tool\.fixed\.value must be a number \(or a pair on a range stat\)/);
  named((s) => { s.chest.finds[0].fixed.cond = ['dry', 'drenched']; }, /chest\.finds\[0\]\.fixed\.cond \["dry","drenched"\] is not a condition/);
  named((s) => { s.chars[0].voices[0].rope = 3; }, /voices\[0\]\.rope must be 2, the rope of a voice of level 1, not 3/);
  named((s) => { s.chars[0].voices[0].knots[1] = 'test.lead'; }, /voices\[0\]\.knots\[1\] "test\.lead" does not fit the voice "test\.toll"/);
  named((s) => { s.chars[0].loadout[1] = s.chest.voices[0].uid; }, /loadout\[1\] names \d+, which is none of its voices/);
  named((s) => { s.chars[0].loadout[5] = s.chars[0].voices[2].uid; }, /loadout\[5\] is a place its level has not opened/);
  named((s) => { s.chars[0].loadout[1] = s.chars[0].loadout[0]; }, /loadout\[1\] names \d+ a second time/);
  named((s) => { s.chars[0].known = []; }, /observances\[0\] "test\.stability" is kept but not known/);
  named((s) => { s.chars[1].bells.push(424242); }, /chars\[1\]\.bells\[1\] 424242 is not a bell of the frame/);
  named((s) => { s.account.frame.pits = ['test.treble']; }, /frame\.pits\[0\] "test\.treble" opens from "test\.tenor", which is not open/);
  named((s) => { s.account.frame.bells[0].pit = 'test.nowhere'; }, /frame\.bells\[0\]\.pit "test\.nowhere" is not an open pit/);
  named((s) => { const b = Object.assign({}, s.account.frame.bells[0], { uid: SaveData.uid(s) }); s.account.frame.bells.push(b); }, /frame\.bells\[1\]\.pit "test\.tenor" holds another bell already/);
});

test('the check trusts nothing: keys that would reach a prototype, numbers JSON cannot hold, odd objects', () => {
  // JSON.parse makes own keys of these: the check must refuse them, never act on them
  const text = JSON.stringify(rich());
  const evil = JSON.parse(text.replace('"knots":{"test.slip":1}', '"knots":{"__proto__":{"polluted":1},"test.slip":1}'));
  const errors = SaveData.validate(evil);
  assert.ok(errors.some((e) => /knots\.__proto__ \(the key\) names no knot/.test(e)), JSON.stringify(errors));
  assert.equal({}.polluted, undefined, 'nothing was polluted');
  assert.ok(SaveData.decode(text.replace('"rev":17', '"rev":1e400')).errors.some((e) => /save\.rev must be a whole number/.test(e)), '1e400 reads as Infinity');
  assert.ok(SaveData.decode(text.replace('"chars":[', '"constructor":1,"chars":[')).errors.some((e) => /save\.constructor is not a field/.test(e)));
  const odd = [undefined, null, 5, 'save', [], [rich()], () => 1, new Map(), Object.create(null)];
  odd.forEach((raw, i) => {
    const found = SaveData.validate(raw);
    assert.ok(Array.isArray(found) && found.length > 0, `odd value ${i}`);
  });
  const cyclic = rich();
  cyclic.chest.self = cyclic;
  assert.ok(SaveData.validate(cyclic).some((e) => /chest\.self is not a field/.test(e)), 'a save that holds itself is a fault, not a hang');
  assert.equal(SaveData.migrate(cyclic).save, null, 'and cannot be copied');
});

// ---- migrations ----

test('a save of the first plan\'s shape (version 1) is brought up to the version this file writes, and what had no successor is noted', () => {
  assert.deepEqual(plain(SaveData.MIGRATIONS.map((m) => [m.from, m.to])), [[1, 2], [2, 3]]);
  const old = {
    v: 1, rev: 9, updated: 123, settings: { volume: 1 }, binds: {}, active: 41,
    chars: [
      { uid: 41, name: 'Old Agnes', class: 'test.ringer', level: 7, xp: 120, calling: null, callingNodes: [], tree: [{ id: 'n1', choice: 'str' }], bonusPoints: 3,
        gear: { weapon: null }, bag: [], sigils: [{ uid: 5, id: 'test.weight', level: 9, sockets: 3, bindings: [null, null, null] }, { uid: 6, id: 'gone.sigil', level: 1 }],
        loadout: [5, null, null, null, null, null], bindings: { 'test.lead': 2, 'gone.binding': 1 }, vows: { 'test.alms': 1 }, activeVows: ['test.alms'],
        charts: [], cleared: [], rites: [], played: 3 },
      { uid: 42, name: 'Lost', class: 'warden', level: 3 },
    ],
    fallen: [{ name: 'First', class: 'test.ringer', level: 4, calling: null, zone: 'debug', cause: 'a stroke', tolls: 12, played: 2, date: 0 }],
    account: { gold: 77, currency: { wax: 3 }, stash: [{ uid: 1 }], deeds: { 'test.opening': { n: 1, done: true }, gone: { n: 1 } }, counters: {},
      legacy: { echoes: 450, ranks: {} }, unlocks: { classes: ['test.locked'], zones: [], uniques: [] }, records: [] },
    gauntlet: null,
  };
  const { save, errors, notes } = SaveData.migrate(old);
  assert.deepEqual(plain(errors), []);
  assert.equal(save.v, SaveData.VERSION);
  assert.deepEqual(plain(SaveData.validate(save)), [], 'what the migration makes is sound');
  assert.deepEqual([save.rev, save.account.coin, save.account.hum, save.account.heard, plain(save.account.open.classes)], [9, 77, 450, 450, ['test.locked']]);
  assert.deepEqual(plain(save.account.bequests), { 'test.opening': { n: 1, done: true } });
  assert.equal(save.chars.length, 1, 'a character of a class that is not there is left behind');
  const a = save.chars[0];
  assert.deepEqual([a.name, a.level, a.xp, a.planPoints, plain(a.plan.walk)], ['Old Agnes', 7, 120, 3, ['test.door']]);
  assert.deepEqual(plain(a.voices.map((v) => [v.id, v.level, v.rope, v.tolls])), [['test.weight', 9, 3, 64]], 'sigils that are voices now, at their level');
  assert.equal(a.loadout[0], a.voices[0].uid, 'and in their place');
  assert.deepEqual([plain(a.knots), plain(a.known), plain(a.observances)], [{ 'test.lead': 2 }, ['test.alms'], ['test.alms']]);
  assert.equal(save.active, a.uid);
  assert.deepEqual(plain(save.register.map((d) => [d.name, d.level, d.tolls, d.how, d.cause])), [['First', 4, 12, 'died', null]]);
  assert.equal(save.account.frame.bells[0].weight, 12, 'the fallen are recast as bells');
  assert.equal(notes.length, 3, JSON.stringify(notes));
  assert.match(notes.join(' | '), /warden.*left behind/);
  assert.match(notes.join(' | '), /items of the old stash/);
  assert.match(notes.join(' | '), /tree is not the Plan/);
  assert.equal(old.chars.length, 2, 'the save given is not changed');
  // a version 1 save read whole
  assert.deepEqual(plain(SaveData.read(old).save), plain(save));
  assert.deepEqual(plain(SaveData.migrate(save).save), plain(save), 'a save of the version this file writes passes as it is');
});

test('a save of version 2 whose character was made before the Plan existed: its empty route starts at its class\'s door', () => {
  const save = rich();
  save.v = 2;
  save.chars[0].plan.walk = [];                         // made before the Plan was laid out: no door, no points laid
  save.chars[0].plan.choice = {};
  const before = JSON.stringify(save);
  const { save: up, errors, notes } = SaveData.read(JSON.parse(before));
  assert.deepEqual(plain(errors), []);
  assert.equal(up.v, SaveData.VERSION);
  assert.deepEqual(plain(up.chars[0].plan.walk), ['test.door'], 'it starts at its door');
  assert.deepEqual(plain(up.chars[1].plan.walk), plain(save.chars[1].plan.walk), 'a route that had its door is left as it was');
  assert.match(notes.join(' | '), /Agnes Toll.*starts at its door/);
  assert.equal(JSON.stringify(save), before, 'the save given is not changed');
  // and it can walk now: a point goes to the door's neighbour
  assert.ok(Char.allocate(up.chars[0], 'test.lane', 'hand'));
  assert.deepEqual(plain(SaveData.validate(up)), []);
  // a version 2 text reads the same way
  const text = SaveData.encode(Object.assign(JSON.parse(before), { v: 2 }));
  assert.deepEqual(plain(SaveData.decode(text).save.chars[0].plan.walk), ['test.door']);
});

// ---- 500 corrupted imports ----

test('500 corrupted imports never throw: each is read as a sound save or refused with its reasons', () => {
  const save = rich(), text = SaveData.encode(save), json = JSON.stringify(save), rng = new Core.RNG(20261112);
  const pick = (list) => list[rng.int(0, list.length - 1)];
  const junk = ['', '{', '}', '[', ']', '"', ':', ',', 'null', 'true', '-1', '1e400', '"__proto__"', '\\u0000', 'NaN', '{"a":[[[[[[]]]]]]}', '0.5', '"x"'];
  // a structural change of the parsed save: a value replaced, a key deleted, a list emptied or doubled
  function mutate(raw) {
    const paths = [];
    (function walk(v, at) {
      if (v === null || typeof v !== 'object') return;
      for (const k of Object.keys(v)) { paths.push(at.concat(k)); walk(v[k], at.concat(k)); }
    })(raw, []);
    const path = pick(paths), key = path[path.length - 1];
    let parent = raw;
    for (let i = 0; i < path.length - 1; i++) parent = parent[path[i]];
    const values = [null, -1, 0, 1.5, 71, 1e300, 'x', '', 'test.lane', [], {}, [null], { v: 2 }, true, false, 'constructor'];
    switch (rng.int(0, 3)) {
      case 0: parent[key] = pick(values); break;
      case 1: if (Array.isArray(parent)) parent.splice(Number(key), 1); else delete parent[key]; break;
      case 2: if (Array.isArray(parent[key])) parent[key] = parent[key].concat(parent[key]); else parent[key] = [parent[key]]; break;
      default: parent[pick(['__proto__', 'constructor', 'extra', 'toString'])] = pick(values);
    }
    return raw;
  }
  let sound = 0, refused = 0;
  for (let i = 0; i < 500; i++) {
    let input;
    switch (i % 5) {
      case 0: input = text.slice(0, rng.int(0, text.length - 1)); break;                       // cut short
      case 1: { const at = rng.int(0, json.length - 1); input = json.slice(0, at) + pick(junk) + json.slice(at + 1); break; }   // a character spoiled
      case 2: input = JSON.stringify(mutate(JSON.parse(json))); break;                         // a value changed, without the check line
      case 3: { const m = JSON.stringify(mutate(mutate(JSON.parse(json)))); input = 'TOLLBOUND SAVE 2 ' + ('0000000' + (Core.hashStr(m) >>> 0).toString(16)).slice(-8) + '\n' + m; break; }   // with a check that fits
      default: { const at = rng.int(0, text.length - 1); input = text.slice(0, at) + text.slice(rng.int(at, text.length)); }   // a stretch cut out
    }
    let r;
    assert.doesNotThrow(() => { r = SaveData.decode(input); }, `import ${i}`);
    assert.ok(r && Array.isArray(r.errors) && Array.isArray(r.notes), `import ${i} answers`);
    if (r.save === null) {
      assert.ok(r.errors.length > 0 && r.errors.every((e) => typeof e === 'string' && e.length > 0), `import ${i} says why`);
      refused++;
    } else {
      assert.deepEqual(plain(r.errors), [], `import ${i}`);
      assert.deepEqual(plain(SaveData.validate(r.save)), [], `import ${i}: what is given is sound`);
      sound++;
    }
  }
  assert.equal(sound + refused, 500);
  assert.ok(refused > 400, `most corrupted imports are refused (${refused} of 500)`);
  // and the check itself, on the parsed objects, never throws either
  for (let i = 0; i < 200; i++) {
    const raw = mutate(mutate(JSON.parse(json)));
    assert.doesNotThrow(() => SaveData.validate(raw));
    assert.doesNotThrow(() => SaveData.read(raw));
  }
});
