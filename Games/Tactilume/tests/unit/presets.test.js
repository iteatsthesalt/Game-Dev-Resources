// Built-in scenes and "Surprise me": both must always produce valid, distinct scenes.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, PRESET_KEYS, DEFAULT_PRESET, presetByKey, presetScene } from '../../src/js/core/presets.js';
import { surpriseScene } from '../../src/js/core/surprise.js';
import { SCHEMA, SCENE_FIELDS, DEFAULT_SCENE, sanitizeScene, diffKeys, encodeScene, decodeScene } from '../../src/js/core/scene.js';
import { mulberry32 } from '../../src/js/core/util.js';

describe('presets', () => {
  test('keys and names are unique; PRESET_KEYS matches; the default exists', () => {
    assert.equal(new Set(PRESET_KEYS).size, PRESETS.length);
    assert.equal(new Set(PRESETS.map((p) => p.name)).size, PRESETS.length);
    assert.deepEqual(PRESET_KEYS, PRESETS.map((p) => p.key));
    assert.ok(PRESET_KEYS.includes(DEFAULT_PRESET));
    for (const p of PRESETS) assert.match(p.key, /^[a-z]+(-[a-z]+)*$/, p.key);
  });

  test('names and blurbs are short and fit the schema', () => {
    const maxLen = SCENE_FIELDS.get('name').maxLen;
    for (const p of PRESETS) {
      assert.ok(p.name.length > 0 && p.name.length <= maxLen, p.key);
      assert.match(p.blurb, /^[A-Z].*\.$/, `${p.key} blurb is a sentence`);
      assert.ok(p.blurb.length <= 90, `${p.key} blurb is long`);
    }
  });

  for (const p of PRESETS) {
    describe(`preset "${p.key}"`, () => {
      test('lists only real fields, each already valid', () => {
        // sanitizeScene would silently drop a misspelt key or fix a bad value; catch both here
        for (const [k, v] of Object.entries(p.scene)) {
          assert.ok(SCENE_FIELDS.has(k), `unknown field ${k}`);
          assert.deepEqual(sanitizeScene({ [k]: v })[k], v, `${k}: ${JSON.stringify(v)} is not a clean value`);
        }
      });

      test('differs from the defaults only in the fields it lists', () => {
        const s = presetScene(p.key);
        const allowed = new Set([...Object.keys(p.scene), 'name']);
        for (const k of diffKeys(DEFAULT_SCENE, s)) assert.ok(allowed.has(k), `${k} changed but is not listed`);
        assert.deepEqual(sanitizeScene(s), s, 'the full scene is clean');
        assert.equal(s.name, p.name);
      });

      test('is reachable by key', () => {
        assert.equal(presetByKey(p.key), p);
      });
    });
  }

  test('the presets look different from each other', () => {
    const codes = PRESETS.map((p) => encodeScene({ ...presetScene(p.key), name: '' }));
    assert.equal(new Set(codes).size, PRESETS.length);
  });

  test('presetScene falls back to the default preset for an unknown key', () => {
    for (const k of ['nope', '', undefined, null, '__proto__']) assert.deepEqual(presetScene(k), presetScene(DEFAULT_PRESET), String(k));
    assert.equal(presetByKey('nope'), null);
  });

  test('presetScene returns a fresh scene each time', () => {
    const a = presetScene(DEFAULT_PRESET);
    a.chords[0] = 'nova';
    a.speed = 2;
    assert.deepEqual(presetScene(DEFAULT_PRESET), sanitizeScene({ ...presetByKey(DEFAULT_PRESET).scene, name: presetByKey(DEFAULT_PRESET).name }));
  });
});

describe('surpriseScene', () => {
  const scenes = [];
  const rnd = mulberry32(99);
  for (let i = 0; i < 100; i++) scenes.push(surpriseScene(rnd));

  test('100 seeded surprise scenes are all complete and valid', () => {
    for (const [i, s] of scenes.entries()) {
      assert.deepEqual(Object.keys(s).sort(), SCHEMA.map((f) => f.key).sort(), `scene ${i}`);
      assert.deepEqual(sanitizeScene(s), s, `scene ${i} is not clean`);
      assert.ok(s.name.length > 0, `scene ${i} has a name`);
      assert.deepEqual(decodeScene(encodeScene(s)), s, `scene ${i} round-trips`);
    }
  });

  test('they are not all the same, and vary in the fields that matter', () => {
    const codes = new Set(scenes.map((s) => encodeScene(s)));
    assert.ok(codes.size > 90, `only ${codes.size} different scenes out of 100`);
    for (const k of ['palette', 'colorBy', 'form', 'lock', 'speed', 'symmetry']) {
      assert.ok(new Set(scenes.map((s) => String(s[k]))).size > 1, `${k} never changes`);
    }
  });

  test('the same seed gives the same scene', () => {
    assert.deepEqual(surpriseScene(mulberry32(5)), surpriseScene(mulberry32(5)));
  });

  test('copes with a generator that returns its extremes', () => {
    for (const edge of [0, 0.999999999, 1 - Number.EPSILON]) {
      const s = surpriseScene(() => edge);
      assert.deepEqual(sanitizeScene(s), s, `rnd always ${edge}`);
    }
  });
});
