// The engine's small pure helpers: the shape of a compute dispatch (which must stay within
// 65,535 workgroups a side), the limits asked of the adapter, BGRA readback, and the camera
// that casts touches onto the plane.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { workgroupGrid, wantedLimits, particleCapacity, limitAfterNoMemory } from '../../src/renderer/engine/gpu.js';
import { swapRedBlue } from '../../src/renderer/engine/capture.js';
import { createCamera, DIST } from '../../src/renderer/engine/camera.js';

describe('workgroupGrid', () => {
  test('nothing to do is no dispatch', () => {
    assert.deepEqual(workgroupGrid(0), [0, 0]);
    assert.deepEqual(workgroupGrid(-5), [0, 0]);
    assert.deepEqual(workgroupGrid(NaN), [0, 0]);
  });

  test('a count that fits in one row is one row', () => {
    assert.deepEqual(workgroupGrid(1), [1, 1]);
    assert.deepEqual(workgroupGrid(256), [1, 1]);
    assert.deepEqual(workgroupGrid(257), [2, 1]);
    assert.deepEqual(workgroupGrid(20000), [79, 1]);
  });

  test('past 65,535 workgroups it goes two-dimensional, covering every particle', () => {
    for (const count of [65535 * 256, 65535 * 256 + 1, 20e6, 67108863]) {
      const [x, y] = workgroupGrid(count);
      assert.ok(x <= 65535 && y <= 65535, `${count}: ${x} x ${y}`);
      assert.ok(x * y * 256 >= count, `${count} covered`);
      assert.ok((x * (y - 1)) * 256 < count, `${count}: no row wholly past the end`);
    }
  });

  // Rows filled to 65,535 left most of the last row idle: 20M particles dispatched 131,070
  // workgroups for 78,125, and 16.8M nearly twice what they needed. Spread evenly, the spare
  // workgroups are fewer than the rows.
  test('the workgroups are spread evenly over the rows, so almost none are idle', () => {
    for (const count of [16800256, 20e6, 33554432, 67108863, 65535 * 256 + 1]) {
      const [x, y] = workgroupGrid(count);
      const needed = Math.ceil(count / 256);
      assert.ok(x * y - needed < y, `${count}: ${x} x ${y} for ${needed}`);
    }
    assert.deepEqual(workgroupGrid(20e6), [39063, 2]);
  });

  test('a narrower row (as tests force) still covers every particle', () => {
    assert.deepEqual(workgroupGrid(20000, 256, 5), [5, 16]);
    assert.ok(5 * 16 * 256 >= 20000);
    assert.deepEqual(workgroupGrid(1000, 64, 1), [1, 16]);
    const [x, y] = workgroupGrid(20000, 256, 7);
    assert.ok(x <= 7 && x * y * 256 >= 20000 && x * y - Math.ceil(20000 / 256) < y, `${x} x ${y}`);
  });
});

describe('particleCapacity: how big the particle buffer is made', () => {
  const STEP = 65536;
  test('the first buffer is just big enough, in steps of 65,536', () => {
    assert.equal(particleCapacity(20000, 0, Infinity), STEP);
    assert.equal(particleCapacity(1e6, 0, Infinity), 1048576);
  });

  // Each 10% step up from the governor used to reallocate and copy the whole buffer, with
  // old and new both alive for a moment.
  test('growing during play leaves room, so the governor\'s next steps up need no new buffer', () => {
    const first = particleCapacity(20e6, 0, Infinity);
    const grown = particleCapacity(20e6 * 1.1, first, Infinity);
    assert.ok(grown >= first * 1.5 - STEP, `${grown}`);
    let n = 20e6 * 1.1;
    let reallocations = 0;
    let cap = grown;
    for (let i = 0; i < 4; i++) {
      n *= 1.1;
      const next = particleCapacity(n, cap, Infinity);
      if (next !== cap) reallocations++;
      cap = next;
    }
    assert.ok(reallocations <= 1, `${reallocations} reallocations for four more steps up`);
  });

  test('never past the limit, and a count that still fits changes nothing', () => {
    assert.equal(particleCapacity(30e6, 20.05e6, 25e6), 25e6);
    assert.equal(particleCapacity(15e6, 20e6, Infinity), 20e6);
  });

  test('a count that falls to half or less gives the memory back', () => {
    assert.equal(particleCapacity(4e6, 20e6, Infinity), Math.ceil(4e6 / STEP) * STEP);
    assert.equal(particleCapacity(1000, 4 * STEP, Infinity), 4 * STEP, 'small buffers are kept');
  });
});

describe('limitAfterNoMemory: what a failed growth teaches', () => {
  const STEP = 65536;
  // The old buffer and the new one are both alive while the particles are copied, so a
  // growth can fail where the larger buffer alone would fit. The limit used to stay at the
  // old capacity for good.
  test('the next try is between what is there and what failed, not pinned to what is there', () => {
    const cap = 20 * 1048576;
    const failed = 30 * 1048576;
    const limit = limitAfterNoMemory(cap, failed);
    assert.ok(limit > cap && limit < failed && limit % STEP === 0, String(limit));
  });

  test('it gives up on growing once the gap is a single step', () => {
    assert.equal(limitAfterNoMemory(10 * STEP, 11 * STEP), 10 * STEP);
    assert.equal(limitAfterNoMemory(0, STEP), STEP, 'the smallest buffer is the floor');
  });
});

describe('wantedLimits', () => {
  test('asks for the adapter\'s biggest buffers, up to 2 GiB', () => {
    assert.deepEqual(wantedLimits({ maxStorageBufferBindingSize: 2147483644, maxBufferSize: 4294967296 }), { maxStorageBufferBindingSize: 2147483644, maxBufferSize: 2 ** 31 });
    assert.deepEqual(wantedLimits({ maxStorageBufferBindingSize: 2 ** 30, maxBufferSize: 2 ** 30 }), { maxStorageBufferBindingSize: 2 ** 30, maxBufferSize: 2 ** 30 });
  });
});

describe('swapRedBlue', () => {
  test('turns BGRA bytes into RGBA, in place', () => {
    const data = new Uint8ClampedArray([1, 2, 3, 4, 10, 20, 30, 40]);
    swapRedBlue(data);
    assert.deepEqual(Array.from(data), [3, 2, 1, 4, 30, 20, 10, 40]);
  });
});

describe('camera', () => {
  const clip = (cam, [x, y, z]) => {
    const m = cam.viewProj;
    const v = [0, 1, 2, 3].map((r) => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r]);
    return { x: v[0] / v[3], y: v[1] / v[3], z: v[2] / v[3], w: v[3] };
  };

  test('frames the touch plane from y -1 to 1, and x to the aspect', () => {
    const cam = createCamera();
    cam.update(1.6, 0, 0);
    const near = (a, b) => Math.abs(a - b) < 1e-6;
    const top = cam.ndcToPlane(0, 1);
    const right = cam.ndcToPlane(1, 0);
    assert.ok(near(top.x, 0) && near(top.y, 1), JSON.stringify(top));
    assert.ok(near(right.x, 1.6) && near(right.y, 0), JSON.stringify(right));
    const c = clip(cam, [1.6, -1, 0]);
    assert.ok(near(c.x, 1) && near(c.y, -1));
  });

  test('a point cast onto the plane maps back to the same place, while the camera drifts', () => {
    const cam = createCamera();
    for (const t of [0, 10, 100]) {
      cam.update(1.78, 1, t);
      for (const [nx, ny] of [[0, 0], [0.5, -0.3], [-0.9, 0.8]]) {
        const p = cam.ndcToPlane(nx, ny);
        const back = cam.planeToNdc(p.x, p.y);
        assert.ok(Math.abs(back.nx - nx) < 1e-6 && Math.abs(back.ny - ny) < 1e-6, `${t}: ${nx},${ny}`);
      }
    }
  });

  test('depth lands in WebGPU\'s 0..1, near to far', () => {
    const cam = createCamera();
    cam.update(1, 0, 0);
    const plane = clip(cam, [0, 0, 0]);
    assert.ok(plane.z > 0 && plane.z < 1, `the plane at depth ${plane.z}`);
    assert.ok(Math.abs(plane.w - DIST) < 1e-6);
    const nearer = clip(cam, [0, 0, 1]);
    assert.ok(nearer.z < plane.z, 'nearer light has less depth');
    assert.ok(Math.abs(clip(cam, [0, 0, DIST - 0.08]).z) < 1e-5, 'the near plane is at 0');
    assert.ok(Math.abs(clip(cam, [0, 0, DIST - 24]).z - 1) < 1e-5, 'the far plane is at 1');
  });
});
