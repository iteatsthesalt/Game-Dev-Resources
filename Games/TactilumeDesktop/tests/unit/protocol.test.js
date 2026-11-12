// shared/protocol.js: what phones may send, what the desktop sends back, and every way a
// message is turned away. Phones are untrusted, so each rejection path has its own case.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROTOCOL, LIMITS, ACTIONS, REJECT_REASONS, MAX_SEQ, utf8Length, cleanText,
  parsePhoneMessage, parseDesktopMessage, encode,
  welcome, reject, haptic, pong, state, hello, touch, act, ping,
} from '../../src/shared/protocol.js';

const TOKEN = 'abcdefghijklmnopqrstuv';
const ID = 'ZYXWVUTSRQPONMLKJIHGFE';
const phone = (obj) => parsePhoneMessage(JSON.stringify(obj));
const desktop = (obj) => parseDesktopMessage(JSON.stringify(obj));
const okMsg = (r) => {
  assert.equal(r.ok, true, `expected ok, got ${JSON.stringify(r)}`);
  return r.msg;
};
const error = (r) => (r.ok ? 'ok' : r.error);

describe('constants', () => {
  test('match CONTRACTS.md', () => {
    assert.equal(PROTOCOL, 1);
    assert.deepEqual({ ...LIMITS }, { maxTouches: 10, maxMessageBytes: 4096, maxName: 24, maxRate: 240 });
    assert.deepEqual([...ACTIONS], ['behaviour', 'palette', 'preset', 'surprise', 'pulse', 'clear']);
    assert.deepEqual([...REJECT_REASONS], ['token', 'full', 'closed', 'version', 'bad']);
    assert.ok(Object.isFrozen(LIMITS) && Object.isFrozen(ACTIONS));
  });
});

describe('parsePhoneMessage: the envelope', () => {
  test('text that is not JSON is "json"', () => {
    for (const text of ['', 'nope', '{"t":"ping"', '{t:1}', "{'t':'ping'}"]) assert.equal(error(parsePhoneMessage(text)), 'json', text);
  });
  test('JSON that is not an object is "json"', () => {
    for (const text of ['null', '1', '"ping"', '[]', '[{"t":"ping","c":1}]', 'true']) assert.equal(error(parsePhoneMessage(text)), 'json', text);
  });
  test('no t, a t that is not a string, or an unknown t is "type"', () => {
    assert.equal(error(phone({})), 'type');
    assert.equal(error(phone({ t: 3 })), 'type');
    assert.equal(error(phone({ t: null })), 'type');
    assert.equal(error(phone({ t: 'motion', x: 1 })), 'type');
    assert.equal(error(phone({ t: 'welcome', player: 1 })), 'type'); // a desktop message from a phone
    assert.equal(error(phone({ t: 'HELLO', v: 1, token: TOKEN })), 'type');
  });
  test('anything but a string is "type"', () => {
    for (const v of [undefined, null, 42, {}, Buffer.from('{"t":"ping","c":1}')]) assert.equal(error(parsePhoneMessage(v)), 'type');
  });
  test('more than maxMessageBytes is "size", counted in UTF-8 bytes', () => {
    const pad = (n) => JSON.stringify({ t: 'ping', c: 1, x: 'a'.repeat(n) });
    const base = pad(0).length;
    assert.equal(error(parsePhoneMessage(pad(4096 - base))), 'ok'); // exactly at the limit
    assert.equal(error(parsePhoneMessage(pad(4097 - base))), 'size');
    // 1366 three-byte characters are only 1366 UTF-16 units but 4098 bytes
    const wide = JSON.stringify({ t: 'ping', c: 1, x: '€'.repeat(1366) });
    assert.ok(wide.length < 4096);
    assert.equal(error(parsePhoneMessage(wide)), 'size');
  });
  test('extra fields are dropped: the message is built afresh', () => {
    const msg = okMsg(phone({ t: 'ping', c: 5, __proto__: { evil: true }, extra: 'x' }));
    assert.deepEqual(msg, { t: 'ping', c: 5 });
    assert.equal(Object.getPrototypeOf(msg), Object.prototype);
  });
});

describe('parsePhoneMessage: hello', () => {
  const good = { t: 'hello', v: 1, token: TOKEN, name: 'Ana', caps: { touches: 5, haptics: true } };
  test('a good hello', () => {
    assert.deepEqual(okMsg(phone(good)), { t: 'hello', v: 1, token: TOKEN, name: 'Ana', caps: { touches: 5, haptics: true } });
  });
  test('defaults for a missing name and caps', () => {
    assert.deepEqual(okMsg(phone({ t: 'hello', v: 1, token: TOKEN })), { t: 'hello', v: 1, token: TOKEN, name: '', caps: { touches: 1, haptics: false } });
  });
  test('any whole version passes, so the server can answer "version"', () => {
    assert.equal(okMsg(phone({ ...good, v: 2 })).v, 2);
    assert.equal(okMsg(phone({ ...good, v: 0 })).v, 0);
  });
  test('a version that is not a whole number is "field"', () => {
    for (const v of [undefined, '1', 1.5, -1, null, MAX_SEQ + 1]) assert.equal(error(phone({ ...good, v })), 'field', String(v));
  });
  test('the token must be a string of 1..64 characters', () => {
    for (const token of [undefined, '', 'x'.repeat(65), 123, null, ['a']]) assert.equal(error(phone({ ...good, token })), 'field', String(token));
    assert.equal(okMsg(phone({ ...good, token: 'x'.repeat(64) })).token.length, 64);
  });
  test('a name that is not a string is "field"', () => {
    for (const name of [5, null, {}, ['a']]) assert.equal(error(phone({ ...good, name })), 'field');
  });
  test('caps: touches are rounded and clamped to 1..10, haptics must be true or false', () => {
    assert.equal(okMsg(phone({ ...good, caps: { touches: 50 } })).caps.touches, 10);
    assert.equal(okMsg(phone({ ...good, caps: { touches: 0 } })).caps.touches, 1);
    assert.equal(okMsg(phone({ ...good, caps: { touches: 3.6 } })).caps.touches, 4);
    assert.equal(okMsg(phone({ ...good, caps: { touches: -4 } })).caps.touches, 1);
    assert.equal(error(phone({ ...good, caps: { touches: '5' } })), 'field');
    assert.equal(error(parsePhoneMessage(`{"t":"hello","v":1,"token":"${TOKEN}","caps":{"touches":1e400}}`)), 'field');
    assert.equal(error(phone({ ...good, caps: { haptics: 'yes' } })), 'field');
    assert.equal(error(phone({ ...good, caps: null })), 'field');
    assert.equal(error(phone({ ...good, caps: [1] })), 'field');
  });
  test('the session id is optional, and 16..64 base64url characters when given', () => {
    assert.equal(okMsg(phone({ ...good, id: ID })).id, ID);
    assert.equal('id' in okMsg(phone(good)), false);
    for (const id of ['short', 'x'.repeat(65), 'has spaces in it 1234', 'bad/chars+=......', 5, null]) {
      assert.equal(error(phone({ ...good, id })), 'field', String(id));
    }
  });
  test('the name is cleaned: control characters, bidi overrides and lone surrogates go', () => {
    assert.equal(okMsg(phone({ ...good, name: '  An\u0000a‮​ ⁦x\ud800  ' })).name, 'Ana x');
    // tabs and line breaks are spaces; an invisible character between two spaces leaves one
    assert.equal(okMsg(phone({ ...good, name: 'a\n\tb c' })).name, 'a b c');
    assert.equal(okMsg(phone({ ...good, name: 'a ​ b﻿' })).name, 'a b');
  });
  test('the name is cut to 24 characters as a person counts them', () => {
    assert.equal(okMsg(phone({ ...good, name: 'x'.repeat(40) })).name, 'x'.repeat(24));
    const coder = '👩‍💻'; // one character, three code points
    assert.equal(okMsg(phone({ ...good, name: coder.repeat(30) })).name, coder.repeat(21)); // 21 × 3 = 63 code points
  });
});

describe('parsePhoneMessage: touch', () => {
  test('a good frame, with f defaulting to 0.5', () => {
    assert.deepEqual(okMsg(phone({ t: 'touch', s: 7, p: [[0, 0.25, 0.5, 0.75], [3, 0.1, 0.9]] })), { t: 'touch', s: 7, p: [[0, 0.25, 0.5, 0.75], [3, 0.1, 0.9, 0.5]] });
  });
  test('an empty frame means no fingers', () => {
    assert.deepEqual(okMsg(phone({ t: 'touch', s: 0, p: [] })), { t: 'touch', s: 0, p: [] });
  });
  test('x, y and f are clamped into 0..1, and -0 prints as 0', () => {
    const msg = okMsg(phone({ t: 'touch', s: 1, p: [[1, -3, 7, 2], [2, -0, 0.5, -1]] }));
    assert.deepEqual(msg.p, [[1, 0, 1, 1], [2, 0, 0.5, 0]]);
    assert.equal(encode(msg), '{"t":"touch","s":1,"p":[[1,0,1,1],[2,0,0.5,0]]}');
  });
  test('a finger listed twice keeps its first entry', () => {
    assert.deepEqual(okMsg(phone({ t: 'touch', s: 1, p: [[4, 0.1, 0.1], [4, 0.9, 0.9]] })).p, [[4, 0.1, 0.1, 0.5]]);
  });
  test('the phone clock is kept when it is a sane number', () => {
    assert.equal(okMsg(phone({ t: 'touch', s: 1, p: [], ms: 1234.5 })).ms, 1234.5);
    for (const ms of [-1, 'now', null, 2e12]) assert.equal(error(phone({ t: 'touch', s: 1, p: [], ms })), 'field', String(ms));
  });
  test('a bad sequence number is "field"', () => {
    for (const s of [undefined, -1, 1.5, '1', MAX_SEQ + 1, null]) assert.equal(error(phone({ t: 'touch', s, p: [] })), 'field', String(s));
    assert.equal(okMsg(phone({ t: 'touch', s: MAX_SEQ, p: [] })).s, MAX_SEQ);
  });
  test('more than ten fingers is "field"', () => {
    const p = Array.from({ length: 11 }, (_, i) => [i, 0.5, 0.5]);
    assert.equal(error(phone({ t: 'touch', s: 1, p })), 'field');
    assert.equal(okMsg(phone({ t: 'touch', s: 1, p: p.slice(0, 10) })).p.length, 10);
  });
  test('a malformed finger spoils the frame', () => {
    const bad = [
      'nope', null, { 0: 1 }, [[0, 0.5]], [[0, 0.5, 0.5, 0.5, 9]], [[-1, 0.5, 0.5]], [[256, 0.5, 0.5]],
      [[1.5, 0.5, 0.5]], [['1', 0.5, 0.5]], [[0, '0.5', 0.5]], [[0, 0.5, null]], [[0, 0.5, 0.5, 'hard']], [0, 0.5, 0.5],
    ];
    for (const p of bad) assert.equal(error(phone({ t: 'touch', s: 1, p })), 'field', JSON.stringify(p));
  });
  test('numbers too large for a double (1e400 is Infinity) are "field"', () => {
    assert.equal(error(parsePhoneMessage('{"t":"touch","s":1,"p":[[0,1e400,0.5]]}')), 'field');
    assert.equal(error(parsePhoneMessage('{"t":"touch","s":1,"p":[[0,0.5,0.5,-1e400]]}')), 'field');
  });
});

describe('parsePhoneMessage: act and ping', () => {
  test('every action is accepted, with its direction clamped to -1..1', () => {
    for (const a of ACTIONS) assert.deepEqual(okMsg(phone({ t: 'act', a })), { t: 'act', a, v: 0 });
    assert.equal(okMsg(phone({ t: 'act', a: 'palette', v: -1 })).v, -1);
    assert.equal(okMsg(phone({ t: 'act', a: 'palette', v: 9 })).v, 1);
    assert.equal(okMsg(phone({ t: 'act', a: 'palette', v: -0.7 })).v, -1);
    assert.equal(Object.is(okMsg(phone({ t: 'act', a: 'palette', v: -0.2 })).v, 0), true);
  });
  test('an unknown action or a direction that is not a number is "field"', () => {
    for (const a of [undefined, 'explode', 'Behaviour', '', 3]) assert.equal(error(phone({ t: 'act', a })), 'field', String(a));
    for (const v of ['1', null, true]) assert.equal(error(phone({ t: 'act', a: 'pulse', v })), 'field', String(v));
  });
  test('ping carries a finite number', () => {
    assert.deepEqual(okMsg(phone({ t: 'ping', c: 12.5 })), { t: 'ping', c: 12.5 });
    for (const c of [undefined, '1', null]) assert.equal(error(phone({ t: 'ping', c })), 'field', String(c));
    assert.equal(error(parsePhoneMessage('{"t":"ping","c":1e400}')), 'field');
  });
});

describe('builders, desktop → phone', () => {
  test('welcome carries the player, colour and lists, and nothing else of the lists', () => {
    const msg = welcome({ player: 2, color: '#56b4e9', name: 'A', behaviour: 'well', palette: 'ember', behaviours: [{ key: 'well', name: 'Well', blurb: 'x' }], palettes: [{ key: 'ember', name: 'Ember', stops: [] }] });
    assert.deepEqual(msg, { t: 'welcome', v: 1, player: 2, color: '#56b4e9', name: 'A', behaviour: 'well', palette: 'ember', behaviours: [{ key: 'well', name: 'Well' }], palettes: [{ key: 'ember', name: 'Ember' }] });
  });
  test('reject keeps the five reasons and turns anything else into "bad"', () => {
    for (const why of REJECT_REASONS) assert.deepEqual(reject(why), { t: 'reject', why });
    assert.deepEqual(reject('because'), { t: 'reject', why: 'bad' });
    assert.deepEqual(reject(), { t: 'reject', why: 'bad' });
  });
  test('haptic clamps ms to 1..500 and strength to 0..1', () => {
    assert.deepEqual(haptic(30, 0.6), { t: 'haptic', ms: 30, k: 0.6 });
    assert.deepEqual(haptic(9999, 7), { t: 'haptic', ms: 500, k: 1 });
    assert.deepEqual(haptic(0, -1), { t: 'haptic', ms: 1, k: 0 });
    assert.deepEqual(haptic('x', NaN), { t: 'haptic', ms: 1, k: 0 });
    assert.deepEqual(haptic(12.6, 0.5), { t: 'haptic', ms: 13, k: 0.5 });
  });
  test('pong echoes the phone clock beside the desktop one', () => {
    assert.deepEqual(pong(1.5, 99), { t: 'pong', c: 1.5, s: 99 });
  });
  test('state keeps only the valid parts given', () => {
    assert.deepEqual(state({ behaviour: 'auto', palette: 'ember', players: 3, color: '#ABCDEF' }), { t: 'state', behaviour: 'auto', palette: 'ember', players: 3, color: '#abcdef' });
    assert.deepEqual(state({ behaviour: '<b>', palette: '', players: 65, color: 'red', extra: 1 }), { t: 'state' });
    assert.deepEqual(state(), { t: 'state' });
    assert.deepEqual(state(null), { t: 'state' });
    assert.deepEqual(state({ players: 0 }), { t: 'state', players: 0 });
  });
});

describe('parseDesktopMessage (the phone page reading the desktop)', () => {
  const w = welcome({ player: 3, color: '#009E73', behaviours: [{ key: 'well', name: 'Well' }], palettes: [{ key: 'ember', name: 'Ember' }] });
  test('every builder\'s message reads back as itself', () => {
    assert.deepEqual(okMsg(desktop(w)), { ...w, color: '#009e73' });
    for (const msg of [reject('full'), haptic(30, 0.6), pong(1, 2), state({ behaviour: 'whirl', players: 2, color: '#ffffff' })]) {
      assert.deepEqual(okMsg(parseDesktopMessage(encode(msg))), msg);
    }
  });
  test('a welcome with a bad player, colour or list is "field"', () => {
    for (const bad of [{ player: 0 }, { player: 9 }, { color: 'blue' }, { behaviours: 'x' }, { palettes: [{ key: '', name: 'x' }] }, { behaviours: [{ key: 'a' }] }]) {
      assert.equal(error(desktop({ ...w, ...bad })), 'field', JSON.stringify(bad));
    }
  });
  test('list names are cleaned and never empty', () => {
    const msg = okMsg(desktop({ ...w, behaviours: [{ key: 'well', name: '‮Well\u0007' }, { key: 'halo', name: '' }] }));
    assert.deepEqual(msg.behaviours, [{ key: 'well', name: 'Well' }, { key: 'halo', name: 'halo' }]);
  });
  test('a reject with an unknown reason reads as "bad"', () => {
    assert.deepEqual(okMsg(desktop({ t: 'reject', why: 'weird' })), { t: 'reject', why: 'bad' });
  });
  test('a state with a malformed part is "field"', () => {
    for (const bad of [{ behaviour: 5 }, { palette: '<x>' }, { players: -1 }, { players: 1.5 }, { color: '#fff' }]) {
      assert.equal(error(desktop({ t: 'state', ...bad })), 'field', JSON.stringify(bad));
    }
  });
  test('haptic and pong need numbers; unknown types are "type"', () => {
    assert.equal(error(desktop({ t: 'haptic', ms: '30', k: 1 })), 'field');
    assert.equal(error(desktop({ t: 'pong', c: 1 })), 'field');
    assert.equal(error(desktop({ t: 'touch', s: 1, p: [] })), 'type');
  });
  test('the desktop may send up to 16 KB', () => {
    const many = Array.from({ length: 64 }, (_, i) => ({ key: `k${i}`, name: 'Some longer name here' }));
    assert.equal(error(desktop({ ...w, behaviours: many, palettes: many })), 'ok');
    assert.equal(error(parseDesktopMessage(JSON.stringify({ t: 'state', x: 'a'.repeat(17000) }))), 'size');
  });
});

describe('builders, phone → desktop: what the page sends always parses', () => {
  test('hello', () => {
    const msg = okMsg(parsePhoneMessage(encode(hello({ token: TOKEN, id: ID, touches: 10, haptics: true }))));
    assert.deepEqual(msg, { t: 'hello', v: 1, token: TOKEN, name: '', caps: { touches: 10, haptics: true }, id: ID });
    assert.equal('id' in hello({ token: TOKEN }), false);
  });
  test('touch rounds to four places (and the force to two), and keeps the clock to 0.1 ms', () => {
    const points = Array.from({ length: 10 }, (_, i) => [i, 1 / 3, 2 / 3, 0.123456]);
    const text = encode(touch(MAX_SEQ, points, 123456789.12345));
    assert.ok(utf8Length(text) < 400, `a ten-finger frame is ${utf8Length(text)} bytes`);
    const msg = okMsg(parsePhoneMessage(text));
    assert.deepEqual(msg.p[0], [0, 0.3333, 0.6667, 0.12]);
    assert.equal(msg.ms, 123456789.1);
    assert.equal('ms' in touch(0, []), false);
  });
  test('act and ping', () => {
    assert.deepEqual(okMsg(parsePhoneMessage(encode(act('behaviour', -1)))), { t: 'act', a: 'behaviour', v: -1 });
    assert.deepEqual(okMsg(parsePhoneMessage(encode(act('surprise')))), { t: 'act', a: 'surprise', v: 0 });
    assert.deepEqual(okMsg(parsePhoneMessage(encode(ping(55.5)))), { t: 'ping', c: 55.5 });
  });
});

describe('utf8Length and cleanText', () => {
  test('utf8Length matches what TextEncoder writes', () => {
    for (const s of ['', 'abc', 'é', '€', '😀', 'a\ud800b', '\udc00', 'x😀y€é', '\ud83d']) {
      assert.equal(utf8Length(s), new TextEncoder().encode(s).length, JSON.stringify(s));
    }
  });
  test('cleanText keeps letters, emoji sequences and joiners', () => {
    assert.equal(cleanText('Zoë 👩‍💻 1️⃣ 🇸🇪'), 'Zoë 👩‍💻 1️⃣ 🇸🇪');
  });
  test('cleanText cuts piled-up combining marks down to two', () => {
    assert.equal(cleanText(`a${'́'.repeat(40)}b`), 'á́b');
  });
  test('cleanText turns anything but a string into ""', () => {
    for (const v of [undefined, null, 5, {}, []]) assert.equal(cleanText(v), '');
  });
});
