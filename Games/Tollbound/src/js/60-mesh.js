// 60-mesh.js: the five unit shapes of the 3D view as flat-shaded triangle meshes, and the small matrix sums the
// view needs. Every unit shape stands on the ground plane and fits the space from (-0.5, 0, -0.5) to
// (0.5, 1, 0.5). Its faces are flat: each face has vertices of its own, and they all carry that face's normal.
// Axes as in the 3D view: x runs right, y up, z towards the viewer.
// Owns: Mesh
// Public:
//   Mesh.SHAPES                  ['box', 'taper', 'cyl', 'sphere', 'cone'], frozen: a shape's id is its index
//                                  box     fills the space
//                                  taper   a box whose top face is 0.6 of its base in both directions
//                                  cyl     an upright prism of 8 sides; its flat sides face +x, +z, -x and -z and
//                                          touch the sides of the space
//                                  sphere  diameter 1, centred at (0, 0.5, 0): 8 facets round, 6 bands high
//                                  cone    8 sides like the cyl, its point at (0, 1, 0)
//   Mesh.FLOATS = 6              floats to a vertex: x, y, z, nx, ny, nz
//   Mesh.shape(id) -> {name, data, count}   the triangles of a shape, by id or name (null for neither): data is
//                                a Float32Array of count vertices, three to a triangle, counter-clockwise seen
//                                from outside. Made on the first call for that shape; the same object after it.
//   Mesh.mat4() -> Float64Array(16)         a new identity matrix. It allocates: for setting up, not for frames.
//   4 by 4 matrices are arrays of 16 numbers in column order, as WebGL takes them. out may be one of the inputs.
//   Mesh.identity(out) -> out
//   Mesh.multiply(out, a, b) -> out         out = a b
//   Mesh.invert(out, m) -> out | null       null when m has no inverse; out is then left as it was
//   Mesh.perspective(out, tx, ty, near, far) -> out    tx, ty: the tangents of half the lens angle across and up
//   Mesh.ortho(out, left, right, bottom, top, near, far) -> out
//   Mesh.view(out, ex, ey, ez, fx, fy, fz, ux, uy, uz) -> out    a camera at e looking along f, with u roughly up
//   Mesh.apply(out, m, x, y, z, w) -> out   out[0..3] = m (x, y, z, w)
//   Part matrices are 3 by 4, in rows, as the records of b.parts hold them (Gfx.PART_STRIDE in 66-gfx-gl.js):
//   twelve numbers from an offset o, m00 m01 m02 m03, m10 m11 m12 m13, m20 m21 m22 m23, and a point p of the unit
//   shape goes to M (p, 1).
//   Mesh.part(out, o, x, y, z, sx, sy, sz, yaw, pitch, roll) -> out    the shape scaled by sx, sy, sz, turned by
//                                roll about z, then pitch about x, then yaw about y (radians, right-handed: a yaw
//                                of a quarter turn takes +x to -z), then moved to (x, y, z). A thing whose front is
//                                +x and which faces the angle a of the simulation (0 is +x, a quarter turn is +y,
//                                towards the viewer) takes yaw = -a. Keep the scales above 0: a mirrored part
//                                turns its faces inside out.
//   Mesh.chain(out, o, a, ao, b, bo) -> out    the part matrix A B from the ones at a[ao] and b[bo]: B placed in the
//                                frame of A, as a child in its parent. out may be a or b.
//   None of the matrix functions allocates.
(function () {
  'use strict';

  const SHAPES = Object.freeze(['box', 'taper', 'cyl', 'sphere', 'cone']);
  const FLOATS = 6;
  const SIDES = 8, BANDS = 6;         // the round shapes: facets round, and the sphere's bands from pole to pole
  const TAPER_TOP = 0.3;              // half the side of the taper's top face (its base: 0.5)
  const meshes = [null, null, null, null, null];

  Mesh.SHAPES = SHAPES;
  Mesh.FLOATS = FLOATS;

  // ---- building the shapes (once each, on the first call) ----

  // Adds one triangle with its face normal to the list. Every shape is convex around (0, 0.5, 0), so a triangle
  // whose normal points inwards is turned round: whatever order the corners come in, it ends up facing out.
  function tri(list, ax, ay, az, bx, by, bz, cx, cy, cz) {
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (!(len > 1e-12)) return;   // a triangle with no area adds nothing
    nx /= len; ny /= len; nz /= len;
    const mx = (ax + bx + cx) / 3, my = (ay + by + cy) / 3 - 0.5, mz = (az + bz + cz) / 3;
    if (nx * mx + ny * my + nz * mz < 0) {
      nx = -nx; ny = -ny; nz = -nz;
      list.push(ax, ay, az, nx, ny, nz, cx, cy, cz, nx, ny, nz, bx, by, bz, nx, ny, nz);
    } else {
      list.push(ax, ay, az, nx, ny, nz, bx, by, bz, nx, ny, nz, cx, cy, cz, nx, ny, nz);
    }
  }

  // A flat four-cornered face: two triangles that share its normal.
  function quad(list, a, b, c, d) {
    tri(list, a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    tri(list, a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
  }

  // A box with a base of half-side 0.5 at y = 0 and a top of half-side top at y = 1.
  function frustum(list, top) {
    const b = [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5]];
    const t = [[-top, 1, -top], [top, 1, -top], [top, 1, top], [-top, 1, top]];
    quad(list, b[0], b[1], b[2], b[3]);
    quad(list, t[0], t[1], t[2], t[3]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      quad(list, b[i], b[j], t[j], t[i]);
    }
  }

  // The corners of the octagon at height y: flat sides facing +x, +z, -x and -z, touching the sides of the space.
  function ring(y) {
    const radius = 0.5 / Math.cos(Math.PI / SIDES), out = [];
    for (let k = 0; k < SIDES; k++) {
      const a = (k + 0.5) * 2 * Math.PI / SIDES;
      out.push([radius * Math.cos(a), y, radius * Math.sin(a)]);
    }
    return out;
  }

  function prism(list) {
    const lo = ring(0), hi = ring(1);
    for (let k = 0; k < SIDES; k++) {
      const j = (k + 1) % SIDES;
      quad(list, lo[k], lo[j], hi[j], hi[k]);
    }
    for (let k = 1; k + 1 < SIDES; k++) {
      tri(list, lo[0][0], 0, lo[0][2], lo[k][0], 0, lo[k][2], lo[k + 1][0], 0, lo[k + 1][2]);
      tri(list, hi[0][0], 1, hi[0][2], hi[k][0], 1, hi[k][2], hi[k + 1][0], 1, hi[k + 1][2]);
    }
  }

  function cone(list) {
    const lo = ring(0);
    for (let k = 0; k < SIDES; k++) {
      const j = (k + 1) % SIDES;
      tri(list, lo[k][0], 0, lo[k][2], lo[j][0], 0, lo[j][2], 0, 1, 0);
    }
    for (let k = 1; k + 1 < SIDES; k++) tri(list, lo[0][0], 0, lo[0][2], lo[k][0], 0, lo[k][2], lo[k + 1][0], 0, lo[k + 1][2]);
  }

  // Bands of latitude between the poles; each band is SIDES flat facets (a facet between two latitudes and two
  // longitudes is a flat trapezoid, so its two triangles share one normal).
  function sphere(list) {
    const at = (band, k) => {
      const lat = Math.PI * band / BANDS, lon = (k + 0.5) * 2 * Math.PI / SIDES;
      return [0.5 * Math.sin(lat) * Math.cos(lon), 0.5 + 0.5 * Math.cos(lat), 0.5 * Math.sin(lat) * Math.sin(lon)];
    };
    for (let band = 0; band < BANDS; band++) {
      for (let k = 0; k < SIDES; k++) {
        const a = at(band, k), b = at(band, k + 1), c = at(band + 1, k + 1), d = at(band + 1, k);
        if (band === 0) tri(list, a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
        else if (band === BANDS - 1) tri(list, a[0], a[1], a[2], b[0], b[1], b[2], d[0], d[1], d[2]);
        else quad(list, a, b, c, d);
      }
    }
  }

  const BUILDERS = [
    (list) => frustum(list, 0.5),
    (list) => frustum(list, TAPER_TOP),
    prism,
    sphere,
    cone,
  ];

  Mesh.shape = function (id) {
    const k = typeof id === 'number' ? id : SHAPES.indexOf(id);
    if (!(k >= 0 && k < SHAPES.length) || k !== Math.floor(k)) return null;
    if (!meshes[k]) {
      const list = [];
      BUILDERS[k](list);
      meshes[k] = Object.freeze({ name: SHAPES[k], data: new Float32Array(list), count: list.length / FLOATS });
    }
    return meshes[k];
  };

  // ---- 4 by 4 matrices, in column order ----

  Mesh.mat4 = function () { return Mesh.identity(new Float64Array(16)); };

  Mesh.identity = function (out) {
    for (let i = 0; i < 16; i++) out[i] = i % 5 === 0 ? 1 : 0;
    return out;
  };

  Mesh.multiply = function (out, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let j = 0; j < 16; j += 4) {
      const b0 = b[j], b1 = b[j + 1], b2 = b[j + 2], b3 = b[j + 3];
      out[j] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
      out[j + 1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
      out[j + 2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
      out[j + 3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
    }
    return out;
  };

  Mesh.invert = function (out, m) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det || !Number.isFinite(det)) return null;
    const k = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * k;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * k;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * k;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * k;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * k;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * k;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * k;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * k;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * k;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * k;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * k;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * k;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * k;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * k;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * k;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * k;
    return out;
  };

  Mesh.perspective = function (out, tx, ty, near, far) {
    const depth = 1 / (near - far);
    for (let i = 0; i < 16; i++) out[i] = 0;
    out[0] = 1 / tx;
    out[5] = 1 / ty;
    out[10] = (far + near) * depth;
    out[11] = -1;
    out[14] = 2 * far * near * depth;
    return out;
  };

  Mesh.ortho = function (out, left, right, bottom, top, near, far) {
    const w = 1 / (right - left), h = 1 / (top - bottom), d = 1 / (far - near);
    for (let i = 0; i < 16; i++) out[i] = 0;
    out[0] = 2 * w;
    out[5] = 2 * h;
    out[10] = -2 * d;
    out[12] = -(right + left) * w;
    out[13] = -(top + bottom) * h;
    out[14] = -(far + near) * d;
    out[15] = 1;
    return out;
  };

  Mesh.view = function (out, ex, ey, ez, fx, fy, fz, ux, uy, uz) {
    let len = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
    fx /= len; fy /= len; fz /= len;
    let sx = fy * uz - fz * uy, sy = fz * ux - fx * uz, sz = fx * uy - fy * ux;   // right: f x u
    len = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
    sx /= len; sy /= len; sz /= len;
    const vx = sy * fz - sz * fy, vy = sz * fx - sx * fz, vz = sx * fy - sy * fx;   // up: s x f
    out[0] = sx; out[4] = sy; out[8] = sz; out[12] = -(sx * ex + sy * ey + sz * ez);
    out[1] = vx; out[5] = vy; out[9] = vz; out[13] = -(vx * ex + vy * ey + vz * ez);
    out[2] = -fx; out[6] = -fy; out[10] = -fz; out[14] = fx * ex + fy * ey + fz * ez;
    out[3] = 0; out[7] = 0; out[11] = 0; out[15] = 1;
    return out;
  };

  Mesh.apply = function (out, m, x, y, z, w) {
    const a = m[0] * x + m[4] * y + m[8] * z + m[12] * w, b = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
    const c = m[2] * x + m[6] * y + m[10] * z + m[14] * w, d = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
    out[0] = a; out[1] = b; out[2] = c; out[3] = d;
    return out;
  };

  // ---- 3 by 4 part matrices, in rows ----

  Mesh.part = function (out, o, x, y, z, sx, sy, sz, yaw, pitch, roll) {
    const ca = Math.cos(yaw || 0), sa = Math.sin(yaw || 0), cb = Math.cos(pitch || 0), sb = Math.sin(pitch || 0);
    const cc = Math.cos(roll || 0), sc = Math.sin(roll || 0);
    // R = Ry(yaw) Rx(pitch) Rz(roll); the columns of R are scaled by sx, sy and sz
    out[o] = (ca * cc + sa * sb * sc) * sx;
    out[o + 1] = (sa * sb * cc - ca * sc) * sy;
    out[o + 2] = sa * cb * sz;
    out[o + 3] = x;
    out[o + 4] = cb * sc * sx;
    out[o + 5] = cb * cc * sy;
    out[o + 6] = -sb * sz;
    out[o + 7] = y;
    out[o + 8] = (ca * sb * sc - sa * cc) * sx;
    out[o + 9] = (sa * sc + ca * sb * cc) * sy;
    out[o + 10] = ca * cb * sz;
    out[o + 11] = z;
    return out;
  };

  Mesh.chain = function (out, o, a, ao, b, bo) {
    const a00 = a[ao], a01 = a[ao + 1], a02 = a[ao + 2], a03 = a[ao + 3];
    const a10 = a[ao + 4], a11 = a[ao + 5], a12 = a[ao + 6], a13 = a[ao + 7];
    const a20 = a[ao + 8], a21 = a[ao + 9], a22 = a[ao + 10], a23 = a[ao + 11];
    const b00 = b[bo], b01 = b[bo + 1], b02 = b[bo + 2], b03 = b[bo + 3];
    const b10 = b[bo + 4], b11 = b[bo + 5], b12 = b[bo + 6], b13 = b[bo + 7];
    const b20 = b[bo + 8], b21 = b[bo + 9], b22 = b[bo + 10], b23 = b[bo + 11];
    out[o] = a00 * b00 + a01 * b10 + a02 * b20;
    out[o + 1] = a00 * b01 + a01 * b11 + a02 * b21;
    out[o + 2] = a00 * b02 + a01 * b12 + a02 * b22;
    out[o + 3] = a00 * b03 + a01 * b13 + a02 * b23 + a03;
    out[o + 4] = a10 * b00 + a11 * b10 + a12 * b20;
    out[o + 5] = a10 * b01 + a11 * b11 + a12 * b21;
    out[o + 6] = a10 * b02 + a11 * b12 + a12 * b22;
    out[o + 7] = a10 * b03 + a11 * b13 + a12 * b23 + a13;
    out[o + 8] = a20 * b00 + a21 * b10 + a22 * b20;
    out[o + 9] = a20 * b01 + a21 * b11 + a22 * b21;
    out[o + 10] = a20 * b02 + a21 * b12 + a22 * b22;
    out[o + 11] = a20 * b03 + a21 * b13 + a22 * b23 + a23;
    return out;
  };
})();
