// tests/shots/gl-post.js: a picture script for tools/shot.js (--eval), for judging what b.end does after the
// scene: the outline, the dither, the bloom, the vignette and the flash. A close group of test figures (some dark
// against a dark patch of ground, where only the outline tells them apart), glowing lanterns and a burst of
// light-adding sparks under a warm light. It takes over the frame loop. The page address may add:
//   post=outline:1,bloom:0,dither:1,vignette:0,flash:0   the post record (default: none, the view's own defaults)
//   q=high|medium|low                                     the quality (default high)
//   node tools/shot.js --out .build/shots/gl-post.png --query "?view=gl&post=dither:1" --eval tests/shots/gl-post.js
(function () {
  const { Gfx, Mesh, Plat, UI } = TB;
  const b = Gfx.active;
  if (!b || b.name !== 'gl') throw new Error('gl-post.js needs the 3D view (?view=gl), not ' + (b && b.name));
  UI.clear();
  const level = Plat.query('q') || 'high', post = {};
  for (const item of (Plat.query('post') || '').split(',').filter(Boolean)) post[item.split(':')[0]] = Number(item.split(':')[1]);
  const STRIDE = Gfx.PART_STRIDE, BOARD = Gfx.BILLBOARD_STRIDE;

  // the same test figure as gl-field.js: [shape, sx, sy, sz, x, y, z, pitch, colour (0 body, 1 skin, 2 hat, 3 legs)]
  const PARTS = [
    ['cyl', 0.15, 0.5, 0.15, -0.1, 0, 0, 0, 3], ['cyl', 0.15, 0.5, 0.15, 0.1, 0, 0, 0, 3],
    ['box', 0.36, 0.14, 0.22, 0, 0.44, 0, 0, 3], ['taper', 0.46, 0.42, 0.28, 0, 0.98, 0, Math.PI, 0],
    ['sphere', 0.27, 0.27, 0.27, 0, 0.98, 0, 0, 1], ['cone', 0.3, 0.26, 0.3, 0, 1.2, 0, 0, 2],
    ['cyl', 0.1, 0.42, 0.1, -0.29, 0.95, 0, Math.PI, 0], ['cyl', 0.1, 0.42, 0.1, 0.29, 0.95, 0, Math.PI, 0],
    ['sphere', 0.13, 0.13, 0.13, -0.29, 0.45, 0, 0, 1], ['sphere', 0.13, 0.13, 0.13, 0.29, 0.45, 0, 0, 1],
  ];
  const buffers = Gfx.SHAPES.map(() => new Float32Array(200 * STRIDE)), counts = new Int32Array(5);
  const fig = new Float32Array(12), local = new Float32Array(12);
  const figure = (x, y, face, body, skin, hat, glowHat) => {
    Mesh.part(fig, 0, x, 0, y, 1, 1, 1, -face, 0, 0);
    const colours = [body, skin, hat, body.map((v) => v * 0.55)];
    for (const [shape, sx, sy, sz, px, py, pz, pitch, c] of PARTS) {
      const s = Gfx.SHAPES.indexOf(shape), o = counts[s]++ * STRIDE, buf = buffers[s];
      Mesh.part(local, 0, px, py, pz, sx, sy, sz, 0, pitch, 0);
      Mesh.chain(buf, o, fig, 0, local, 0);
      const col = colours[c], glow = glowHat && shape === 'cone' ? 1 : 0;
      buf.set([col[0], col[1], col[2], 0, glow, 1], o + 12);
    }
  };
  const DARK = [0.16, 0.16, 0.19], RUST = [0.62, 0.22, 0.14], SEA = [0.18, 0.4, 0.6], MOSS = [0.3, 0.45, 0.22];
  const SKIN = [0.8, 0.64, 0.5], HAT = [0.25, 0.22, 0.2], LAMP = [1, 0.8, 0.4];
  for (let i = 0; i < 18; i++) {
    const x = -4.5 + (i % 6) * 1.5 + (Math.floor(i / 6) % 2) * 0.6, y = -2 + Math.floor(i / 6) * 1.6;
    const body = i < 9 ? DARK : [RUST, SEA, MOSS][i % 3];
    figure(x, y, (i * 1.7) % 6.28, body, SKIN, i % 5 === 2 ? LAMP : HAT, i % 5 === 2);
  }

  // sparks over the right of the group, and a lantern light
  const boards = new Float32Array(60 * BOARD);
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 60; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 1.2;
    boards.set([4 + Math.cos(a) * r, 0.5 + Math.sin(a) * r * 0.6, 0.4 + rand() * 1.6, 0.12 + rand() * 0.2, 1, 0.5 + rand() * 0.4, 0.15, 0.9, 1], i * BOARD);
  }
  const lamp = new Float32Array([1.5, 0.2, 1.5, 6, 1, 0.7, 0.35, 1.3]);

  // the ground darker under the left half, where the dark figures stand
  const env = { ground: [0.2, 0.21, 0.23], ambient: [0.4, 0.42, 0.48], sun: { dir: [0.45, -1, -0.35], color: [0.85, 0.8, 0.72] } };
  const cam = { x: -0.5, y: 0, zoom: 2.2 };
  Plat.loop(() => {
    b.quality(level);   // asked for every frame: in software drawing the view would step its quality down
    b.begin(cam, env);
    for (let s = 0; s < 5; s++) b.parts(s, buffers[s], counts[s]);
    b.billboards(boards, 60);
    b.lights(lamp, 1);
    b.end(Object.keys(post).length ? post : null);
  });
  return counts.reduce((a, c) => a + c, 0);
})();
