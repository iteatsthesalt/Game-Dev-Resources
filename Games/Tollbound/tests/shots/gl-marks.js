// tests/shots/gl-marks.js: a picture script for tools/shot.js (--eval). Decals and billboards over the ground,
// round a few test figures: rings that fill in (as a telegraph does when its attack comes), covering billboards
// (a drifting smoke) and light-adding ones (a burst of sparks and a line of bolts), and discs as the stand-in
// draws them. It takes over the frame loop. The page address may add q=high|medium|low and post=outline:0,...
// as for gl-field.js.
//   node tools/shot.js --out .build/shots/gl-marks.png --query "?view=gl" --eval tests/shots/gl-marks.js --wait 1500
(function () {
  const { Gfx, Mesh, Plat, UI } = TB;
  const b = Gfx.active;
  if (!b || b.name !== 'gl') throw new Error('gl-marks.js needs the 3D view (?view=gl), not ' + (b && b.name));
  UI.clear();
  const level = Plat.query('q') || 'high', post = {};
  for (const item of (Plat.query('post') || '').split(',').filter(Boolean)) post[item.split(':')[0]] = Number(item.split(':')[1]);
  const STRIDE = Gfx.PART_STRIDE, DECAL = Gfx.DECAL_STRIDE, BOARD = Gfx.BILLBOARD_STRIDE;

  // ---- decals: x, y, radius, r, g, b, alpha, fill ----
  const decals = new Float32Array([
    -6, -2, 2.5, 0.95, 0.25, 0.15, 0.9, 0.0,
    -6, -2, 1.2, 0.95, 0.25, 0.15, 0.9, 1.0,
    -1, -3, 3.0, 1.0, 0.75, 0.2, 0.85, 0.35,
    4.5, -2.5, 2.0, 0.3, 0.6, 1.0, 0.9, 0.7,
    -4, 4, 1.6, 0.5, 1.0, 0.45, 0.85, 1.0,
    2, 3.5, 4.0, 0.85, 0.3, 0.95, 0.7, 0.15,
    7, 3, 1.0, 1.0, 1.0, 1.0, 0.8, 0.5,
    -8, 1, 0.6, 0.15, 0.1, 0.1, 0.8, 1.0,
  ]);

  // ---- a few figures: a body and a head each ----
  const parts = [new Float32Array(16 * STRIDE), new Float32Array(16 * STRIDE)], counts = [0, 0];
  const add = (shape, x, y, z, sx, sy, sz, c) => {
    const k = shape === 'sphere' ? 1 : 0, o = counts[k]++ * STRIDE, buf = parts[k];
    Mesh.part(buf, o, x, y, z, sx, sy, sz, 0.4, 0, 0);
    buf.set([c[0], c[1], c[2], 0, 0, 1], o + 12);
  };
  for (const [x, y, c] of [[-6, -2, [0.75, 0.7, 0.6]], [-1, -3, [0.3, 0.45, 0.7]], [4.5, -2.5, [0.7, 0.3, 0.25]], [2, 3.5, [0.35, 0.6, 0.3]], [-4, 4, [0.6, 0.5, 0.75]]]) {
    add('taper', x, 0, y, 0.55, 1.1, 0.4, c);
    add('sphere', x, 1.08, y, 0.36, 0.36, 0.36, [0.85, 0.72, 0.6]);
  }
  const SPHERE = Gfx.SHAPES.indexOf('sphere'), TAPER = Gfx.SHAPES.indexOf('taper');

  // ---- billboards: x, y, z, size, r, g, b, alpha, glow ----
  const boards = new Float32Array(400 * BOARD);
  let n = 0, seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const board = (x, y, z, size, r, g, bl, a, glow) => { boards.set([x, y, z, size, r, g, bl, a, glow], n++ * BOARD); };
  for (let i = 0; i < 26; i++) {         // smoke, rising and spreading from (-7, 4)
    const t = i / 26;
    board(-7 + (rand() - 0.5) * (0.6 + 2 * t), 4 + (rand() - 0.5) * 1.5, 0.3 + t * 3.5, 0.8 + t * 1.6, 0.42, 0.4, 0.38, 0.75 - 0.5 * t, 0);
  }
  for (let i = 0; i < 70; i++) {         // a burst of sparks over (4.5, -2.5)
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 2.2, h = 0.2 + rand() * 2.4;
    board(4.5 + Math.cos(a) * r, -2.5 + Math.sin(a) * r * 0.7, h, 0.2 + rand() * 0.35, 1, 0.55 + rand() * 0.35, 0.15, 0.9, 1);
  }
  for (let i = 0; i <= 20; i++) {        // a bolt of light from (-1, -3) to (2, 3.5), a metre up
    const t = i / 20;
    board(-1 + 3 * t, -3 + 6.5 * t, 1 + Math.sin(t * Math.PI) * 0.8, 0.55, 0.45, 0.75, 1, 0.95, 1);
  }
  board(0, 0, 0.8, 2.6, 0.3, 0.9, 0.5, 0.5, 1);   // one large soft glow on the open ground

  // ---- discs, as the stand-in picture draws enemies: x, y, radius, r, g, b, alpha ----
  const discs = new Float32Array([7, -5, 0.4, 0.66, 0.26, 0.22, 1, 8, -4, 0.4, 0.66, 0.26, 0.22, 1, -8.5, -5, 0.45, 0.93, 0.9, 0.86, 1]);
  const lamp = new Float32Array([4.5, -2.5, 1.2, 5, 1, 0.6, 0.2, 1.4]);

  const cam = { x: 0, y: 0, zoom: 1 };
  Plat.loop(() => {
    b.quality(level);   // asked for every frame: in software drawing the view would step its quality down
    b.begin(cam, null);
    b.decals(decals, decals.length / DECAL);
    b.parts(TAPER, parts[0], counts[0]);
    b.parts(SPHERE, parts[1], counts[1]);
    b.billboards(boards, n);
    b.discs(discs, 3);
    b.lights(lamp, 1);
    b.end(Object.keys(post).length ? post : null);
  });
  return n;
})();
