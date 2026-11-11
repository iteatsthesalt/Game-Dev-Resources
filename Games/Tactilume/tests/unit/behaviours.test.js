import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BEHAVIOURS, BEHAVIOUR_KEYS, behaviourByKey, behaviourById, MAX_FINGERS, DEFAULT_CHORDS, behaviourFor,
} from '../../src/js/core/behaviours.js';

const autoScene = (chords = DEFAULT_CHORDS) => ({ lock: 'auto', chords });

test('ids are unique, contiguous from 0, and in list order', () => {
  // ids are saved in share links and switched on in the shader, so they never move
  BEHAVIOURS.forEach((b, i) => assert.equal(b.id, i, b.key));
  assert.equal(new Set(BEHAVIOURS.map((b) => b.id)).size, BEHAVIOURS.length);
});

test('every id fits in one base-36 digit (share links store one per finger count)', () => {
  for (const b of BEHAVIOURS) assert.ok(b.id >= 0 && b.id < 36, b.key);
});

test('keys are unique, lower case, and match BEHAVIOUR_KEYS', () => {
  assert.equal(new Set(BEHAVIOUR_KEYS).size, BEHAVIOURS.length);
  assert.deepEqual(BEHAVIOUR_KEYS, BEHAVIOURS.map((b) => b.key));
  for (const k of BEHAVIOUR_KEYS) assert.match(k, /^[a-z]+$/);
  assert.ok(!BEHAVIOUR_KEYS.includes('auto'), '"auto" is reserved for the lock picker');
});

test('names and blurbs are short plain sentences', () => {
  const names = BEHAVIOURS.map((b) => b.name);
  assert.equal(new Set(names).size, names.length);
  for (const b of BEHAVIOURS) {
    assert.match(b.name, /^[A-Z][a-z]+$/, b.key);
    assert.match(b.blurb, /^[A-Z].*\.$/, b.key);
    assert.ok(b.blurb.length <= 90, `${b.key} blurb is long`);
  }
});

test('lookups by key and id, and null for unknown ones', () => {
  for (const b of BEHAVIOURS) {
    assert.equal(behaviourByKey(b.key), b);
    assert.equal(behaviourById(b.id), b);
  }
  for (const k of ['nope', '', undefined, null, 'toString', '__proto__']) assert.equal(behaviourByKey(k), null, String(k));
  for (const id of [-1, BEHAVIOURS.length, 1.5, NaN, '0', undefined]) assert.equal(behaviourById(id), null, String(id));
});

test('DEFAULT_CHORDS has one valid behaviour for each finger count up to ten', () => {
  assert.equal(MAX_FINGERS, 10);
  assert.equal(DEFAULT_CHORDS.length, MAX_FINGERS);
  for (const k of DEFAULT_CHORDS) assert.ok(BEHAVIOUR_KEYS.includes(k), k);
});

test('behaviourFor reads the finger table when lock is auto', () => {
  for (let n = 1; n <= MAX_FINGERS; n++) assert.equal(behaviourFor(autoScene(), n).key, DEFAULT_CHORDS[n - 1], `${n} fingers`);
  const custom = [...BEHAVIOUR_KEYS].reverse().slice(0, MAX_FINGERS);
  for (let n = 1; n <= MAX_FINGERS; n++) assert.equal(behaviourFor(autoScene(custom), n).key, custom[n - 1]);
});

test('behaviourFor uses the lock for every finger count', () => {
  for (const key of BEHAVIOUR_KEYS) {
    for (const n of [0, 1, 4, 10, 99]) assert.equal(behaviourFor({ lock: key, chords: DEFAULT_CHORDS }, n).key, key);
  }
});

test('an unknown lock falls back to the finger table', () => {
  assert.equal(behaviourFor({ lock: 'bogus', chords: DEFAULT_CHORDS }, 2).key, DEFAULT_CHORDS[1]);
  assert.equal(behaviourFor({ chords: DEFAULT_CHORDS }, 3).key, DEFAULT_CHORDS[2]);
});

test('behaviourFor clamps finger counts', () => {
  const s = autoScene();
  assert.equal(behaviourFor(s, 0).key, DEFAULT_CHORDS[0]);
  assert.equal(behaviourFor(s, -3).key, DEFAULT_CHORDS[0]);
  assert.equal(behaviourFor(s, 99).key, DEFAULT_CHORDS[MAX_FINGERS - 1]);
  assert.equal(behaviourFor(s, Infinity).key, DEFAULT_CHORDS[0], 'Infinity | 0 is 0');
  assert.equal(behaviourFor(s, NaN).key, DEFAULT_CHORDS[0]);
  assert.equal(behaviourFor(s, 3.7).key, DEFAULT_CHORDS[2]);
});

test('a bad entry in the finger table gives the first behaviour, never undefined', () => {
  const chords = [...DEFAULT_CHORDS];
  chords[4] = 'bogus';
  assert.equal(behaviourFor(autoScene(chords), 5), BEHAVIOURS[0]);
});
