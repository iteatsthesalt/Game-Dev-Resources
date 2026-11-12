// tests/shots/gl-field.js: a picture script for tools/shot.js (--eval). 400 test figures of ten parts each (legs,
// hips, a body, a head, a hat, arms and hands) stand on the plain ground under the sun, with four coloured point
// lights among them and a few glowing lanterns. It takes over the frame loop and draws the field every frame.
// The page address may add:
//   q=high|medium|low          the quality (default high)
//   post=outline:0,bloom:1     the post record of b.end (default: none given, so the view's own defaults)
//   cam=x,y,zoom               the point looked at and the zoom (default 0,0,1)
//   drift=1                    the camera moves slowly to the right, to watch shadows while it moves
//   ground=test.flags          a tileset id for the ground (its picture from Ground.texture), not the plain ground
// For example:
//   node tools/shot.js --out .build/shots/gl-field.png --query "?view=gl" --eval tests/shots/gl-field.js --wait 1500
(function () {
  const { Gfx, Mesh, Plat, UI } = TB;
  const b = Gfx.active;
  if (!b || b.name !== 'gl') throw new Error('gl-field.js needs the 3D view (?view=gl), not ' + (b && b.name));
  UI.clear();
  const param = (name, fallback) => Plat.query(name) || fallback;
  b.quality(param('q', 'high'));
  const post = {};
  for (const item of param('post', '').split(',').filter(Boolean)) {
    const [k, v] = item.split(':');
    post[k] = Number(v);
  }
  const [cx, cy, zoom] = param('cam', '0,0,1').split(',').map(Number);
  const drift = param('drift', '') === '1';

  // ---- the figures ----
  const STRIDE = Gfx.PART_STRIDE, SHAPE = (name) => Gfx.SHAPES.indexOf(name);
  const BODY = [[0.62, 0.2, 0.16], [0.2, 0.38, 0.62], [0.24, 0.52, 0.28], [0.72, 0.62, 0.3], [0.5, 0.32, 0.6], [0.78, 0.76, 0.7], [0.3, 0.3, 0.34]];
  const SKIN = [[0.86, 0.7, 0.56], [0.62, 0.45, 0.33], [0.45, 0.32, 0.24]];
  const HAT = [[0.2, 0.18, 0.16], [0.7, 0.24, 0.2], [0.85, 0.8, 0.55], [0.28, 0.3, 0.5]];
  // [shape, sx, sy, sz, x, y, z, pitch, colour] in the figure's frame; colour 0 body, 1 skin, 2 hat, 3 legs
  const PARTS = [
    ['cyl', 0.15, 0.5, 0.15, -0.1, 0, 0, 0, 3],          // legs
    ['cyl', 0.15, 0.5, 0.15, 0.1, 0, 0, 0, 3],
    ['box', 0.36, 0.14, 0.22, 0, 0.44, 0, 0, 3],         // hips
    ['taper', 0.46, 0.42, 0.28, 0, 0.98, 0, Math.PI, 0], // body, wide at the shoulders
    ['sphere', 0.27, 0.27, 0.27, 0, 0.98, 0, 0, 1],      // head
    ['cone', 0.3, 0.26, 0.3, 0, 1.2, 0, 0, 2],           // hat
    ['cyl', 0.1, 0.42, 0.1, -0.29, 0.95, 0, Math.PI, 0], // arms, hanging
    ['cyl', 0.1, 0.42, 0.1, 0.29, 0.95, 0, Math.PI, 0],
    ['sphere', 0.13, 0.13, 0.13, -0.29, 0.45, 0, 0, 1],  // hands
    ['sphere', 0.13, 0.13, 0.13, 0.29, 0.45, 0, 0, 1],
  ];
  const N = 400, buffers = Gfx.SHAPES.map(() => new Float32Array(N * 4 * STRIDE)), counts = new Int32Array(5);
  const fig = new Float32Array(12), local = new Float32Array(12);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) {
    const gx = i % 20, gy = Math.floor(i / 20);
    const x = (gx - 9.5) * 1.7 + (rand() - 0.5) * 0.8, y = (gy - 9.5) * 1.7 + (rand() - 0.5) * 0.8;
    const face = rand() * Math.PI * 2, size = 0.9 + rand() * 0.25;
    const body = BODY[i % BODY.length], skin = SKIN[(i * 7) % SKIN.length], hat = HAT[(i * 3) % HAT.length];
    const legs = [body[0] * 0.55, body[1] * 0.55, body[2] * 0.55];
    const colours = [body, skin, hat, legs];
    Mesh.part(fig, 0, x, 0, y, size, size, size, -face, 0, 0);
    const lantern = i % 23 === 5;
    for (const [shape, sx, sy, sz, px, py, pz, pitch, c] of PARTS) {
      const s = SHAPE(shape), o = counts[s]++ * STRIDE, buf = buffers[s];
      Mesh.part(local, 0, px, py, pz, sx, sy, sz, 0, pitch, 0);
      Mesh.chain(buf, o, fig, 0, local, 0);
      const col = colours[c];
      buf[o + 12] = col[0]; buf[o + 13] = col[1]; buf[o + 14] = col[2];
      buf[o + 15] = 0;                                        // flash
      buf[o + 16] = lantern && shape === 'cone' ? 1 : 0;      // glow
      buf[o + 17] = 1;                                        // alpha
      if (lantern && shape === 'cone') { buf[o + 12] = 1; buf[o + 13] = 0.78; buf[o + 14] = 0.35; }
    }
  }
  let parts = 0;
  for (let s = 0; s < 5; s++) parts += counts[s];

  // ---- four coloured lights, at shoulder height ----
  const lights = new Float32Array([
    -6, -5, 1.6, 7, 1, 0.25, 0.2, 1.6,
    6, -5, 1.6, 7, 0.25, 1, 0.35, 1.6,
    -6, 5, 1.6, 7, 0.3, 0.45, 1, 1.8,
    6, 5, 1.6, 7, 1, 0.75, 0.25, 1.6,
  ]);

  const cam = { x: cx || 0, y: cy || 0, zoom: zoom > 0 ? zoom : 1 }, level = param('q', 'high');
  const env = param('ground', '') ? { ground: param('ground', '') } : null;
  const start = performance.now();
  Plat.loop(() => {
    if (drift) cam.x = (cx || 0) + (performance.now() - start) / 1000 * 0.37;
    // Asked for every frame: drawing in software is slow, and the view would otherwise step its quality down.
    b.quality(level);
    b.begin(cam, env);
    for (let s = 0; s < 5; s++) b.parts(s, buffers[s], counts[s]);
    b.lights(lights, 4);
    b.end(Object.keys(post).length ? post : null);
  });
  window.glField = { parts: parts, quality: b.quality(), stats: b.stats };
  return parts;
})();
