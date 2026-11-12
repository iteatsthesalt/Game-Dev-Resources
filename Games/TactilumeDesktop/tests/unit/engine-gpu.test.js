// The engine's small pure helpers: the shape of a compute dispatch (which must stay within
// 65,535 workgroups a side), the limits asked of the adapter, BGRA readback, and the camera
// that casts touches onto the plane.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { workgroupGrid, wantedLimits } from '../../src/renderer/engine/gpu.js';
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
    assert.deepEqual(workgroupGrid(20e6), [65535, 2]);
  });

  test('a narrower row (as tests force) still covers every particle', () => {
    assert.deepEqual(workgroupGrid(20000, 256, 5), [5, 16]);
    assert.ok(5 * 16 * 256 >= 20000);
    assert.deepEqual(workgroupGrid(1000, 64, 1), [1, 16]);
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
