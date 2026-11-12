// What the light feels from the players: poles faded in and out by id, their symmetric
// copies, team colours, the rings where touches land and a nova's release.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createTouch, MAX_POLES, MAX_PULSES, POLE_FLOATS, srgbToLinear } from '../../src/renderer/engine/touch.js';

const SCENE = { symmetry: 1, mirror: false };
const pole = (over = {}) => ({ x: 0.5, y: -0.25, vx: 0.1, vy: 0.2, power: 1, age: 0.5, held: true, id: 'p1', kind: 'touch', player: 1, ...over });
// the fields of pole i as the shader reads them
const read = (t, i) => {
  const a = Array.from(t.poles.subarray(i * POLE_FLOATS, (i + 1) * POLE_FLOATS));
  return { x: a[0], y: a[1], weight: a[2], age: a[3], vx: a[4], vy: a[5], power: a[6], spin: a[7], team: a.slice(8, 12) };
};
const close = (a, b, eps = 1e-5) => Math.abs(a - b) <= eps;

describe('poles', () => {
  test('a held pole fades in to its power, at its place', () => {
    const t = createTouch();
    assert.equal(t.update([pole()], 1 / 60, SCENE), 1);
    const first = read(t, 0);
    assert.ok(first.weight > 0 && first.weight < 0.5, `a soft start: ${first.weight}`);
    for (let i = 0; i < 60; i++) t.update([pole({ power: 1.5 })], 1 / 60, SCENE);
    const p = read(t, 0);
    assert.ok(close(p.weight, 1.5, 1e-3), `weight ${p.weight}`);
    assert.ok(close(p.x, 0.5) && close(p.y, -0.25) && close(p.vx, 0.1) && close(p.vy, 0.2));
    assert.ok(close(p.power, 1.5) && close(p.age, 0.5));
    assert.ok(p.spin === 1 || p.spin === -1);
  });

  test('a lifted pole fades out where it was, then is gone', () => {
    const t = createTouch();
    for (let i = 0; i < 30; i++) t.update([pole()], 1 / 60, SCENE);
    assert.equal(t.update([], 1 / 60, SCENE), 1, 'still there, fading');
    const fading = read(t, 0);
    assert.ok(fading.weight < 1 && fading.weight > 0.5);
    assert.ok(close(fading.x, 0.5), 'it stays where it was lifted');
    for (let i = 0; i < 60; i++) t.update([], 1 / 60, SCENE);
    assert.equal(t.count, 0);
    assert.equal(t.size, 0);
  });

  test('a pole sent with held = false fades out too', () => {
    const t = createTouch();
    for (let i = 0; i < 30; i++) t.update([pole()], 1 / 60, SCENE);
    for (let i = 0; i < 60; i++) t.update([pole({ held: false })], 1 / 60, SCENE);
    assert.ok(read(t, 0).weight < 0.01);
  });

  test('two players may use the same pole id', () => {
    const t = createTouch();
    assert.equal(t.update([pole({ player: 1 }), pole({ player: 2, x: -0.5 })], 1 / 60, SCENE), 2);
  });

  test('the spin of a pole stays the same, and a mirror copy turns the other way', () => {
    const t = createTouch();
    t.update([pole({ id: 'a' })], 1 / 60, SCENE);
    const spin = read(t, 0).spin;
    t.update([pole({ id: 'a', x: 0.1 })], 1 / 60, SCENE);
    assert.equal(read(t, 0).spin, spin);
    const m = createTouch();
    m.update([pole({ id: 'a' })], 1 / 60, { symmetry: 1, mirror: true });
    assert.equal(m.count, 2);
    assert.equal(read(m, 0).spin, -read(m, 1).spin);
  });

  test('symmetry copies a pole around the centre', () => {
    const t = createTouch();
    assert.equal(t.update([pole({ x: 0, y: 0.5 })], 1 / 60, { symmetry: 6, mirror: false }), 6);
    const angles = [0, 1, 2, 3, 4, 5].map((i) => Math.atan2(read(t, i).y, read(t, i).x)).sort((a, b) => a - b);
    for (let i = 1; i < 6; i++) assert.ok(close(angles[i] - angles[i - 1], Math.PI / 3, 1e-4), 'evenly spaced');
    for (let i = 0; i < 6; i++) assert.ok(close(Math.hypot(read(t, i).x, read(t, i).y), 0.5, 1e-5), 'at the same distance');
    const m = createTouch();
    assert.equal(m.update([pole()], 1 / 60, { symmetry: 6, mirror: true }), 12);
  });

  test('never more than 64 poles, and every touch keeps its place when copies do not fit', () => {
    const many = Array.from({ length: 40 }, (_, i) => pole({ id: `t${i}`, x: i / 40 }));
    const t = createTouch();
    assert.equal(t.update(many, 1 / 60, { symmetry: 6, mirror: true }), 40, 'no room for copies: just the touches');
    const t2 = createTouch();
    assert.equal(t2.update(Array.from({ length: 100 }, (_, i) => pole({ id: `t${i}` })), 1 / 60, SCENE), MAX_POLES);
  });

  test('a player colour shows only for that player\'s poles, in linear light', () => {
    const t = createTouch();
    const colors = new Map([[1, [1, 0.5, 0.25]]]);
    t.update([pole({ player: 1 }), pole({ player: 2, id: 'q' })], 1 / 60, SCENE, colors);
    const mine = read(t, 0).team;
    const theirs = read(t, 1).team;
    assert.deepEqual(mine.map((v) => +v.toFixed(5)), [1, 0.5, 0.25, 1]);
    assert.deepEqual(theirs, [0, 0, 0, 0]);
  });

  test('touch and engage follow how much is held; engage lets go slowly', () => {
    const t = createTouch();
    for (let i = 0; i < 120; i++) t.update([pole()], 1 / 60, SCENE);
    assert.ok(t.touch > 0.99 && t.engage > 0.99);
    for (let i = 0; i < 30; i++) t.update([], 1 / 60, SCENE);
    assert.ok(t.touch < 0.1, `touch ${t.touch}`);
    assert.ok(t.engage > 0.7, `engage ${t.engage}`);
  });

  test('poles with no place are left out', () => {
    const t = createTouch();
    assert.equal(t.update([pole({ x: NaN }), pole({ id: 'b', y: undefined }), null], 1 / 60, SCENE), 0);
    assert.equal(t.update('nonsense', 1 / 60, SCENE), 0);
  });
});

describe('pulses and releases', () => {
  test('a pulse is a ring that ages and is gone after 1.6 s; unused slots say so', () => {
    const t = createTouch();
    t.pulse(0.2, 0.3, 1.2);
    t.update([], 0.5, SCENE);
    assert.deepEqual(Array.from(t.pulseData.subarray(0, 4)).map((v) => +v.toFixed(5)), [0.2, 0.3, 1.2, 0.5]);
    assert.equal(t.pulseData[7], 99, 'an unused slot is marked by its age');
    t.update([], 1.2, SCENE);
    assert.equal(t.pulseData[3], 99);
  });

  test('a pulse is copied for symmetry, and only the 8 newest are kept', () => {
    const t = createTouch();
    t.update([], 0, { symmetry: 4, mirror: false });
    t.pulse(0.5, 0, 1);
    t.update([], 0.01, { symmetry: 4, mirror: false });
    const live = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => t.pulseData[i * 4 + 3] < 9);
    assert.equal(live.length, 4);
    for (let i = 0; i < 5; i++) t.pulse(0, 0, 1);
    t.update([], 0.01, SCENE);
    assert.equal([0, 1, 2, 3, 4, 5, 6, 7].filter((i) => t.pulseData[i * 4 + 3] < 9).length, MAX_PULSES);
  });

  test('a pulse carries its player\'s colour, linearised', () => {
    const t = createTouch();
    t.pulse(0, 0, 1, [1, 0.5, 0]);
    t.pulse(0, 0, 1);
    t.update([], 0.01, SCENE);
    assert.deepEqual(Array.from(t.pulseColors.subarray(0, 4)).map((v) => +v.toFixed(5)), [1, +srgbToLinear(0.5).toFixed(5), 0, 1]);
    assert.deepEqual(Array.from(t.pulseColors.subarray(4, 8)), [0, 0, 0, 0]);
  });

  test('only a nova lets go of its light, charged by how long it was held', () => {
    const t = createTouch();
    t.release(0.1, 0.1, 1, 3, 'well');
    t.update([], 0.01, SCENE);
    assert.equal(t.releaseData[2], 0, 'no release from a well');
    t.release(0.1, 0.1, 1, 3, 'nova');
    t.release(0.1, 0.1, 1, 0.3, 'nova');
    t.update([], 0.01, SCENE);
    assert.ok(close(t.releaseData[2], 1.6), `held 3 s: full charge, ${t.releaseData[2]}`);
    assert.ok(close(t.releaseData[6], 0.25), `held briefly: the least charge, ${t.releaseData[6]}`);
    t.update([], 1.3, SCENE);
    assert.equal(t.releaseData[2], 0, 'gone after 1.2 s');
  });

  test('reset forgets every pole, pulse and release', () => {
    const t = createTouch();
    t.update([pole()], 1 / 60, SCENE);
    t.pulse(0, 0, 1);
    t.reset();
    assert.equal(t.update([], 1 / 60, SCENE), 0);
    assert.equal(t.pulseData[3], 99);
  });
});
