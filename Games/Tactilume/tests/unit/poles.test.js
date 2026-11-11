import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_POLES, expandPoles, fingerCount, constellation, symmetrise } from '../../src/js/core/poles.js';

const pole = (over = {}) => ({ x: 0.5, y: 0.2, vx: 0.3, vy: -0.1, power: 1, age: 0.4, held: true, id: 't1', kind: 'touch', ...over });
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
const rotate = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

describe('symmetry', () => {
  for (const n of [2, 3, 5, 6, 12]) {
    test(`symmetry ${n} gives ${n} copies, rotated about the centre`, () => {
      const p = pole();
      const out = expandPoles([p], { symmetry: n });
      assert.equal(out.length, n);
      assert.equal(out[0], p, 'the real touch comes first, unchanged');
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const [x, y] = rotate(p.x, p.y, a);
        const [vx, vy] = rotate(p.vx, p.vy, a);
        near(out[k].x, x, `copy ${k} x`);
        near(out[k].y, y, `copy ${k} y`);
        near(out[k].vx, vx, `copy ${k} vx`);
        near(out[k].vy, vy, `copy ${k} vy`);
        assert.equal(out[k].power, p.power);
        assert.equal(out[k].held, p.held);
        if (k > 0) assert.equal(out[k].kind, 'mirror');
      }
      assert.equal(new Set(out.map((q) => q.id)).size, n, 'ids are unique');
    });
  }

  test('symmetry 1 without mirror leaves the list alone', () => {
    const list = [pole()];
    assert.equal(expandPoles(list, { symmetry: 1 }), list);
    assert.equal(symmetrise(list, 1, false), list);
  });

  test('odd symmetry values are treated as whole numbers of at least one', () => {
    assert.equal(symmetrise([pole()], 0, false).length, 1);
    assert.equal(symmetrise([pole()], -4, false).length, 1);
    assert.equal(symmetrise([pole()], 3.9, false).length, 3);
  });

  test('mirror doubles the copies, reflecting each across its own axis', () => {
    const p = pole();
    const one = expandPoles([p], { symmetry: 1, mirror: true });
    assert.equal(one.length, 2);
    near(one[1].x, p.x, 'mirror x');
    near(one[1].y, -p.y, 'mirror y');
    near(one[1].vy, -p.vy, 'mirror vy');
    assert.equal(one[1].kind, 'mirror');

    const n = 4;
    const out = expandPoles([p], { symmetry: n, mirror: true });
    assert.equal(out.length, 2 * n);
    const mirrors = out.filter((q) => q.id.includes(':m'));
    assert.equal(mirrors.length, n);
    mirrors.forEach((m, k) => {
      const [x, y] = rotate(p.x, -p.y, (k / n) * Math.PI * 2);
      near(m.x, x, `mirror ${k} x`);
      near(m.y, y, `mirror ${k} y`);
    });
    assert.equal(new Set(out.map((q) => q.id)).size, out.length, 'ids are unique');
  });

  test('copies keep the distance from the centre', () => {
    const p = pole({ x: -0.7, y: 0.45 });
    const r = Math.hypot(p.x, p.y);
    for (const q of expandPoles([p], { symmetry: 7, mirror: true })) near(Math.hypot(q.x, q.y), r, q.id);
  });

  test('the input list is not changed', () => {
    const p = pole();
    const snapshot = JSON.stringify(p);
    expandPoles([p], { symmetry: 6, mirror: true, virtualFingers: 4, time: 3 });
    assert.equal(JSON.stringify(p), snapshot);
  });
});

describe('the pole cap', () => {
  test(`never more than MAX_POLES (${MAX_POLES}), and real touches survive first`, () => {
    const touches = Array.from({ length: 10 }, (_, i) => pole({ id: `t${i}`, x: i / 10, y: 0.3 }));
    const out = expandPoles(touches, { symmetry: 6, mirror: true });
    assert.equal(out.length, MAX_POLES);
    assert.deepEqual(out.slice(0, 10).map((q) => q.id), touches.map((t) => t.id), 'all real touches, in order, at the front');
    for (const q of out.slice(10)) assert.equal(q.kind, 'mirror');
  });

  test('virtual fingers count as real for the cap', () => {
    const out = expandPoles([pole()], { symmetry: 12, mirror: true, virtualFingers: 10 });
    assert.equal(out.length, MAX_POLES);
    assert.deepEqual(out.slice(0, 10).map((q) => q.kind), ['touch', ...Array(9).fill('virtual')]);
  });

  test('ten touches with no copies are all kept', () => {
    const touches = Array.from({ length: 10 }, (_, i) => pole({ id: `t${i}` }));
    assert.equal(expandPoles(touches).length, 10);
  });
});

describe('one-finger chords', () => {
  for (const n of [2, 3, 5, 10]) {
    test(`one touch played as ${n} fingers makes an even ring around it`, () => {
      const p = pole();
      const out = expandPoles([p], { virtualFingers: n, time: 0 });
      assert.equal(out.length, n);
      assert.equal(out[0].kind, 'touch');
      for (const q of out.slice(1)) assert.equal(q.kind, 'virtual');
      const radius = Math.hypot(out[0].x - p.x, out[0].y - p.y);
      assert.ok(radius > 0.05 && radius < 0.4, `radius ${radius}`);
      for (const q of out) near(Math.hypot(q.x - p.x, q.y - p.y), radius, `${q.id} distance`);
      // neighbours are evenly spaced: chord length 2r sin(pi / n)
      const gap = 2 * radius * Math.sin(Math.PI / n);
      for (let i = 0; i < n; i++) {
        const a = out[i], b = out[(i + 1) % n];
        near(Math.hypot(a.x - b.x, a.y - b.y), gap, `gap ${i}`);
      }
      assert.equal(new Set(out.map((q) => q.id)).size, n);
    });
  }

  test('the ring turns slowly with time', () => {
    const p = pole();
    const a = constellation(p, 3, 0)[0];
    const b = constellation(p, 3, 1)[0];
    const turned = Math.atan2(b.y - p.y, b.x - p.x) - Math.atan2(a.y - p.y, a.x - p.x);
    assert.ok(Math.abs(turned) > 0.1 && Math.abs(turned) < 1, `turned ${turned} rad in one second`);
  });

  test('only applies to a single touch, and only for two or more fingers', () => {
    assert.equal(expandPoles([pole(), pole({ id: 't2' })], { virtualFingers: 5 }).length, 2);
    assert.equal(expandPoles([pole()], { virtualFingers: 1 }).length, 1);
    assert.equal(expandPoles([pole()], { virtualFingers: 0 }).length, 1);
    assert.deepEqual(constellation(pole(), 1, 0), [pole()]);
  });

  test('symmetry applies to the whole ring', () => {
    assert.equal(expandPoles([pole()], { virtualFingers: 3, symmetry: 2 }).length, 6);
  });
});

describe('fingerCount', () => {
  test('counts held touches, pins and autoplay poles', () => {
    assert.equal(fingerCount([]), 0);
    assert.equal(fingerCount([pole(), pole({ kind: 'pin' }), pole({ kind: 'auto' })]), 3);
  });

  test('ignores released poles and copies', () => {
    const list = [pole(), pole({ held: false }), pole({ kind: 'mirror' }), pole({ kind: 'virtual' })];
    assert.equal(fingerCount(list), 1);
  });

  test('is not changed by symmetry', () => {
    const touches = [pole(), pole({ id: 't2' })];
    assert.equal(fingerCount(expandPoles(touches, { symmetry: 6, mirror: true })), 2);
  });

  test('one held touch counts as the virtual finger count', () => {
    assert.equal(fingerCount([pole()], 4), 4);
    assert.equal(fingerCount([pole(), pole({ held: false })], 4), 4, 'a fading touch does not stop the chord');
    assert.equal(fingerCount([pole(), pole({ id: 't2' })], 4), 2, 'two real touches are two');
    assert.equal(fingerCount([], 4), 0, 'nobody touching is zero');
    assert.equal(fingerCount([pole()], 1), 1);
    assert.equal(fingerCount(expandPoles([pole()], { virtualFingers: 4 }), 4), 4, 'the ring itself is not counted twice');
  });
});
