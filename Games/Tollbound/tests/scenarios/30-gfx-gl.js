// tests/scenarios/30-gfx-gl.js: the 3D view (66-gfx-gl.js) and its shapes and sums (60-mesh.js), on a desktop
// window and on a phone. The page asks for ?view=gl, and the checks draw their own frames into the game's view,
// each from begin() to end() and read back with b.readPixels in the same breath, so the game's own frames in
// between change nothing. Pixels are compared with room to spare: software drawing differs a little between
// machines. What is checked:
//   - the view starts and says what it can do; the records' strides; a canvas already in use is refused
//   - the shapes are closed and flat-faced and fit the unit space; the matrix sums agree with each other
//   - a red box is red where it stands and the ground beside it is not
//   - a box under the sun darkens the ground on its shadow side at 'high', and not at 'low'
//   - a point light brightens the ground near it; a glowing part is brighter than the same part without glow
//   - decals, billboards (covering and adding) and discs draw where they should
//   - b.stats counts what was drawn and stays within 24 draw calls with 2000 parts
//   - resize and a change of quality keep drawing; so does the next frame after a lost and restored context
//   - worldToScreen and screenToWorld are each other's inverse on the ground; 30 metres of ground fit the longer
//     side; visibleRadius stays under 24 here and on every screen shape from 390x844 to 2560x1080
//   - frames that come slowly for two seconds step the quality down by itself, with the notice 'quality'
// And one more scenario, for the record only: how long the processor takes over 10 000 parts. It asserts no time.
// Each function below runs inside the page (see tests/run.js), so it uses only T, TB and the page itself.

const view = async function () {
  const { Gfx, Mesh, Plat } = TB;
  const b = Gfx.active, canvas = b && b.canvas;
  const phone = innerWidth < 600;
  T.check('the view asked for is the 3D one', !!b && b.name === 'gl' && canvas === document.getElementById('view'), b && b.name);
  if (!b || b.name !== 'gl') return T.done();
  b.quality('high');
  T.check('it says what it can do', b.caps.puppets === true && b.caps.shadows === true && b.caps.lights === true && b.caps.bloom === true &&
    b.caps.maxInstances >= 10000, b.caps);
  T.check('the records it reads: shapes, part and light strides', JSON.stringify(Gfx.SHAPES) === '["box","taper","cyl","sphere","cone"]' &&
    Gfx.PART_STRIDE === 18 && Gfx.LIGHT_STRIDE === 8 && Gfx.DECAL_STRIDE === 8 && Gfx.BILLBOARD_STRIDE === 9, [Gfx.PART_STRIDE, Gfx.LIGHT_STRIDE]);
  T.check('the canvas has the pixels of the window', canvas.width === Math.round(innerWidth * devicePixelRatio) && canvas.height === Math.round(innerHeight * devicePixelRatio),
    [canvas.width, canvas.height]);
  let refusal = '';
  try { Gfx.backends.gl(canvas); } catch (e) { refusal = e.message; }
  T.check('a canvas that already serves the 3D view is refused', /already serves/.test(refusal), refusal);

  // ---- the shapes and the sums (once is enough: they do not depend on the screen) ----
  if (!phone) {
    const faults = [];
    for (let s = 0; s < Gfx.SHAPES.length; s++) {
      const m = Mesh.shape(s), d = m.data, F = Mesh.FLOATS;
      if (m.count % 3 || m.count < 12 || m !== Mesh.shape(Gfx.SHAPES[s])) faults.push(m.name + ': count ' + m.count);
      let lo = [9, 9, 9], hi = [-9, -9, -9];
      for (let v = 0; v < m.count; v += 3) {
        const a = v * F, c = [0, 1, 2].map((k) => (d[a + k] + d[a + F + k] + d[a + 2 * F + k]) / 3);
        const n = [d[a + 3], d[a + 4], d[a + 5]];
        const same = [1, 2].every((j) => n.every((x, k) => Math.abs(x - d[a + j * F + 3 + k]) < 1e-6));
        const unit = Math.abs(Math.hypot(n[0], n[1], n[2]) - 1) < 1e-5;
        const out = n[0] * c[0] + n[1] * (c[1] - 0.5) + n[2] * c[2] > 0;
        // counter-clockwise from outside: the corners' own cross product points along the normal
        const e1 = [0, 1, 2].map((k) => d[a + F + k] - d[a + k]), e2 = [0, 1, 2].map((k) => d[a + 2 * F + k] - d[a + k]);
        const cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const wound = cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2] > 0;
        if (!same || !unit || !out || !wound) faults.push(m.name + ' triangle ' + v / 3);
        for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], d[a + j * F + k]); hi[k] = Math.max(hi[k], d[a + j * F + k]); }
      }
      // every shape stands on the ground and reaches the top; all but the sphere touch the four sides as well, and
      // the sphere's corners lie on the sphere of diameter 1 round (0, 0.5, 0)
      const round = m.name === 'sphere';
      const fits = lo[1] > -1e-6 && Math.abs(lo[1]) < 1e-6 && Math.abs(hi[1] - 1) < 1e-6 &&
        [0, 2].every((k) => (round ? lo[k] >= -0.5 - 1e-6 && hi[k] <= 0.5 + 1e-6 : Math.abs(lo[k] + 0.5) < 1e-6 && Math.abs(hi[k] - 0.5) < 1e-6));
      let onSphere = true;
      for (let v = 0; round && v < m.count; v++) onSphere = onSphere && Math.abs(Math.hypot(d[v * F], d[v * F + 1] - 0.5, d[v * F + 2]) - 0.5) < 1e-6;
      if (!fits || !onSphere) faults.push(m.name + ' spans ' + lo.map((x) => x.toFixed(3)) + ' to ' + hi.map((x) => x.toFixed(3)));
    }
    T.check('each shape is flat-faced, wound outwards and fits the unit space', faults.length === 0, faults.slice(0, 6));
    const p = Mesh.perspective(Mesh.mat4(), 0.3, 0.2, 2, 90), inv = Mesh.invert(Mesh.mat4(), p), one = Mesh.multiply(Mesh.mat4(), p, inv);
    const ident = Array.from(one).every((x, i) => Math.abs(x - (i % 5 === 0 ? 1 : 0)) < 1e-9);
    const part = Mesh.part(new Float32Array(12), 0, 1, 2, 3, 2, 3, 4, Math.PI / 2, 0, 0), q = [part[0] + part[3], part[4] + part[7], part[8] + part[11]];
    const twice = Mesh.chain(new Float32Array(12), 0, part, 0, Mesh.part(new Float32Array(12), 0, 0, 1, 0, 1, 1, 1, 0, 0, 0), 0);
    T.check('the sums: an inverse undoes, a yaw of a quarter turn takes +x to -z, a chained part moves in its parent\'s frame',
      ident && Math.abs(q[0] - 1) < 1e-6 && Math.abs(q[1] - 2) < 1e-6 && Math.abs(q[2] - 1) < 1e-6 && Math.abs(twice[7] - 5) < 1e-6, { q: q, y: twice[7] });
  }

  // ---- helpers: frames of our own, and pixels at points of the world ----
  let cssW = innerWidth, cssH = innerHeight;
  const cam = { x: 0, y: 0, zoom: 1 }, at = { x: 0, y: 0 };
  const DAY = { ground: [0.4, 0.4, 0.4], ambient: [0.45, 0.45, 0.45], sun: { dir: [1, -1, 0], color: [0.75, 0.75, 0.75] }, fog: { near: 100, far: 200 } };
  const DUSK = { ground: [0.4, 0.4, 0.4], ambient: [0.25, 0.25, 0.25], sun: { dir: [1, -1, 0], color: [0.15, 0.15, 0.15] }, fog: { near: 100, far: 200 } };
  const PLAIN = { outline: 0, bloom: 0, dither: 0, vignette: 0, flash: 0 };
  const STRIDE = Gfx.PART_STRIDE, one = new Float32Array(STRIDE * 4);
  const box = (rec, o, x, y, w, h, colour, glow, alpha) => {
    Mesh.part(rec, o, x, 0, y, w, h, w, 0, 0, 0);
    rec.set([colour[0], colour[1], colour[2], 0, glow || 0, alpha === undefined ? 1 : alpha], o + 12);
    return rec;
  };
  // the canvas pixels of a square round a point of the world (r: pixels each way), and their mean colour
  const block = (x, y, z, r) => {
    b.worldToScreen(x, y, z || 0, at);
    const X = Math.round(at.x * canvas.width / cssW), Y = Math.round(at.y * canvas.height / cssH), k = r === undefined ? 1 : r;
    return b.readPixels(X - k, Y - k, 2 * k + 1, 2 * k + 1);
  };
  const read = (x, y, z, r) => {
    const px = block(x, y, z, r);
    if (!px) return null;
    const sum = [0, 0, 0];
    for (let i = 0; i < px.length; i += 4) { sum[0] += px[i]; sum[1] += px[i + 1]; sum[2] += px[i + 2]; }
    const n = px.length / 4;
    return sum.map((v) => Math.round(v / n));
  };
  const some = (px, test) => {
    for (let i = 0; px && i < px.length; i += 4) if (test(px[i], px[i + 1], px[i + 2])) return [px[i], px[i + 1], px[i + 2]];
    return null;
  };
  const lum = (c) => (c ? (c[0] + c[1] + c[2]) / 3 : NaN);
  const frame = (env, draw, post) => {
    b.begin(cam, env);
    if (draw) draw();
    b.end(post === undefined ? PLAIN : post);
  };
  const redBox = () => b.parts('box', box(one, 0, 0, 0, 1.6, 1.2, [0.9, 0.1, 0.1]), 1);
  const isRed = (c) => !!c && c[0] > 50 && c[0] > 2 * c[1] + 10 && c[0] > 2 * c[2] + 10;
  const isGrey = (c) => !!c && Math.abs(c[0] - c[1]) < 16 && Math.abs(c[1] - c[2]) < 16 && lum(c) > 30;

  // ---- a red box, red where it stands ----
  frame(DAY, redBox);
  const top = read(0, 0, 1.2), front = read(0, 0.8, 0.6), beside = read(-3.3, 0.5, 0);
  T.check('a red box is red where it stands', isRed(top) && isRed(front), { top: top, front: front });
  T.check('and the ground beside it is not', isGrey(beside), beside);

  // ---- a shadow at 'high', none at 'low' ----
  const tall = () => b.parts(0, box(one, 0, 0, 0, 1, 3, [0.6, 0.6, 0.6]), 1);
  frame(DAY, tall);
  const shade = read(2.3, 0.3, 0, 2), sunny = read(-2.3, 0.3, 0, 2);
  T.check('at high quality a box darkens the ground on its shadow side', lum(shade) < 0.75 * lum(sunny), { shadow: shade, lit: sunny });
  b.quality('low');
  T.check('at low quality the view says it has no shadows, and no bloom', b.caps.shadows === false && b.caps.bloom === false && b.quality() === 'low', b.caps);
  frame(DAY, tall);
  const shadeLow = read(2.3, 0.3, 0, 2), sunnyLow = read(-2.3, 0.3, 0, 2);
  T.check('at low quality it does not', Math.abs(lum(shadeLow) - lum(sunnyLow)) < 0.06 * lum(sunnyLow) + 2, { shadow: shadeLow, lit: sunnyLow });
  b.quality('medium');
  frame(DAY, tall);
  const shadeMid = read(2.3, 0.3, 0, 2), sunnyMid = read(-2.3, 0.3, 0, 2);
  T.check('at medium quality it does again', lum(shadeMid) < 0.75 * lum(sunnyMid) && b.caps.shadows === true && b.caps.bloom === false, { shadow: shadeMid, lit: sunnyMid });
  b.quality('high');

  // ---- shadows that sit still: the camera moves by whole pixels of the low-resolution picture, so the ground
  // under the middle row lands on the same pixel centres, one pixel over; a shadow there must not change ----
  const posts = new Float32Array(8 * STRIDE), ROW = Math.floor(canvas.height / 2);
  for (let i = 0; i < 8; i++) box(posts, i * STRIDE, -6 + i * 1.6, -1.2, 0.25, 2.5 + i * 0.3, [0.6, 0.6, 0.6]);
  const SLANT = { ground: [0.4, 0.4, 0.4], ambient: [0.45, 0.45, 0.45], sun: { dir: [0.7, -1, 0.35], color: [0.8, 0.8, 0.8] }, fog: { near: 100, far: 200 } };
  const scale = Math.min(canvas.width, canvas.height) <= 432 ? 1 : Math.round(Math.min(canvas.width, canvas.height) / 360);   // canvas pixels to one of the picture
  frame(SLANT, null);
  const metre = (b.screenToWorld(innerWidth, innerHeight / 2, {}).x - b.screenToWorld(0, innerHeight / 2, {}).x) / (canvas.width / scale);
  const moved = [];
  for (const step of [0, 1, 3]) {
    cam.x = step * metre;
    frame(SLANT, () => b.parts(0, posts, 8));
    moved.push(b.readPixels(0, ROW, canvas.width, 1));
  }
  cam.x = 0;
  const changed = [1, 2].map((k) => {
    const shift = [0, 1, 3][k] * scale;
    let n = 0;
    for (let x = 4 * scale; x + shift < canvas.width - 4 * scale; x += scale) if (Math.abs(moved[0][(x + shift) * 4] - moved[k][x * 4]) > 3) n++;
    return n;
  });
  T.check('the shadows sit still while the camera moves', changed.every((n) => n <= 2), { changed: changed, metresAPixel: metre });

  // ---- a point light ----
  const lamp = new Float32Array([3, 2, 1, 5, 1, 0.95, 0.85, 1.5]);
  frame(DUSK, null);
  const dark = read(3.3, 2.3, 0, 2);
  frame(DUSK, () => b.lights(lamp, 1));
  const lit = read(3.3, 2.3, 0, 2), far = read(-3.3, 2.3, 0, 2);
  T.check('a point light brightens the ground near it, and not far off', lum(lit) > 1.3 * lum(dark) + 8 && Math.abs(lum(far) - lum(dark)) < 6, { dark: dark, lit: lit, far: far });

  // ---- glow ----
  const blue = [0.25, 0.4, 0.75];
  frame(DUSK, () => b.parts('box', box(one, 0, 0, 0, 1.6, 1.2, blue, 0), 1));
  const plain = read(0, 0, 1.2);
  frame(DUSK, () => b.parts('box', box(one, 0, 0, 0, 1.6, 1.2, blue, 1), 1));
  const glowing = read(0, 0, 1.2);
  T.check('a glowing part is brighter than the same part without glow', lum(glowing) > lum(plain) + 20, { plain: plain, glowing: glowing });
  frame(DUSK, () => b.parts('box', box(one, 0, 0, 0, 1.6, 1.2, blue, 1), 1), { outline: 0, bloom: 1 });
  const halo = read(1.0, 0, 0.6, 1);
  frame(DUSK, () => b.parts('box', box(one, 0, 0, 0, 1.6, 1.2, blue, 1), 1), PLAIN);
  const noHalo = read(1.0, 0, 0.6, 1);
  T.check('and with bloom its light spills past its edge', lum(halo) > lum(noHalo) + 4, { bloom: halo, none: noHalo });

  // ---- decals, billboards and discs ----
  const decal = new Float32Array([-2.5, 3, 1.2, 0.1, 0.9, 0.2, 1, 0]);
  const boards = new Float32Array([4, 2, 1, 1.4, 0.95, 0.3, 0.2, 1, 1, 4, -2, 1, 1.4, 0.15, 0.25, 0.95, 1, 0]);
  const disc = new Float32Array([0, -3, 0.5, 0.95, 0.85, 0.1, 1]);
  frame(DAY, null);
  const green = (r, g, bl) => g > r + 40 && g > bl + 40;
  const bare = { ring: some(block(-3.68, 3, 0, 3), green), inside: read(-2.2, 3.3, 0, 1), add: read(4, 2, 1, 1), cover: read(4, -2, 1, 1) };
  frame(DAY, () => { b.decals(decal, 1); b.billboards(boards, 2); b.discs(disc, 1); });
  const ring = some(block(-3.68, 3, 0, 3), green), inside = read(-2.2, 3.3, 0, 1), add = read(4, 2, 1, 1), cover = read(4, -2, 1, 1), pillar = read(0, -3, 1, 1);
  T.check('a decal is a ring on the ground, its middle left as it was', !bare.ring && !!ring && Math.abs(lum(inside) - lum(bare.inside)) < 6,
    { ring: ring, inside: inside, before: bare.inside });
  T.check('a billboard that adds light brightens what is behind it, red more than the rest',
    !!add && add[0] > bare.add[0] + 40 && add[0] - bare.add[0] > add[2] - bare.add[2], { before: bare.add, after: add });
  T.check('a billboard that covers takes its own colour', !!cover && cover[2] > cover[0] + 60, { before: bare.cover, after: cover });
  T.check('a disc stands as a cylinder of its colour', !!pillar && pillar[0] > 90 && pillar[1] > 70 && pillar[2] < pillar[1] / 2, pillar);

  // ---- 2000 parts: what the view counts, and its draw calls ----
  const many = new Float32Array(400 * STRIDE);
  for (let i = 0; i < 400; i++) box(many, i * STRIDE, (i % 20) * 1.2 - 12, Math.floor(i / 20) * 1.2 - 12, 0.5, 1, [0.5, 0.5, 0.5]);
  frame(null, () => {
    for (let s = 0; s < 5; s++) b.parts(s, many, 400);
    b.decals(decal, 1);
    b.billboards(boards, 2);
    b.lights(lamp, 1);
  }, null);
  const counted = Object.assign({}, b.stats);
  T.check('b.stats counts what was drawn: 2000 parts, a decal and two billboards', counted.instances === 2003, counted);
  T.check('and the frame took no more than 24 draw calls', counted.drawCalls > 0 && counted.drawCalls <= 24, counted);

  // ---- resize and quality keep drawing ----
  const resized = [];
  for (const [w, h] of [[640, 480], [300, 500], [cssW, cssH]]) {
    b.resize(w, h, 1);
    cssW = w;
    cssH = h;
    for (const level of ['low', 'medium', 'high']) {
      b.quality(level);
      frame(DAY, redBox);
      resized.push(w + 'x' + h + ' ' + level + ': ' + (isRed(read(0, 0, 1.2)) ? 'red' : JSON.stringify(read(0, 0, 1.2))));
    }
  }
  b.resize(innerWidth, innerHeight, Plat.dpr());
  cssW = innerWidth;
  cssH = innerHeight;
  T.check('after a resize and at each quality the red box is still drawn where it stands', resized.every((r) => / red$/.test(r)), resized);

  // ---- the world and the screen ----
  let worst = 0;
  const back = { x: 0, y: 0 };
  frame(null, null, null);
  for (let x = -9; x <= 9; x += 3) {
    for (let y = -7; y <= 7; y += 3.5) {
      b.screenToWorld(b.worldToScreen(x, y, 0, at).x, at.y, back);
      worst = Math.max(worst, Math.abs(back.x - x), Math.abs(back.y - y));
    }
  }
  for (let i = 0; i <= 4; i++) {
    for (let j = 0; j <= 4; j++) {
      const sx = cssW * i / 4, sy = cssH * j / 4;
      b.worldToScreen(b.screenToWorld(sx, sy, back).x, back.y, 0, at);
      worst = Math.max(worst, Math.abs(at.x - sx) / 1000, Math.abs(at.y - sy) / 1000);   // pixels count a thousandth
    }
  }
  T.check('worldToScreen and screenToWorld are each other\'s inverse on the ground', worst < 1e-6, worst);
  const mid = Object.assign({}, Gfx.screenToWorld(innerWidth / 2, innerHeight / 2)), up = Object.assign({}, Gfx.worldToScreen(0, 0, 2));
  T.check('the middle of the screen is the point looked at, and height lifts a point up the screen',
    Math.abs(mid.x) < 1e-9 && Math.abs(mid.y) < 1e-9 && up.y < innerHeight / 2 - 10 && Math.abs(up.x - innerWidth / 2) < 1e-6, [mid, up]);
  const span = phone ? Math.abs(Gfx.screenToWorld(innerWidth / 2, 0, {}).y - Gfx.screenToWorld(innerWidth / 2, innerHeight, {}).y)
    : Math.abs(Gfx.screenToWorld(0, innerHeight / 2, {}).x - Gfx.screenToWorld(innerWidth, innerHeight / 2, {}).x);
  T.check('30 metres of ground through the point looked at fit the longer side of the screen', Math.abs(span - 30) < 0.01, span);
  T.check('visibleRadius stays under 24 metres at zoom 1', b.visibleRadius() < 24 && b.visibleRadius() > 10, b.visibleRadius());

  // ---- a context lost, and restored ----
  const gl = canvas.getContext('webgl2'), lose = gl && gl.getExtension('WEBGL_lose_context');
  if (T.check('the browser can lose a context on purpose (WEBGL_lose_context)', !!lose)) {
    const event = (name) => new Promise((resolve) => canvas.addEventListener(name, resolve, { once: true }));
    const gone = event('webglcontextlost');
    lose.loseContext();
    await gone;
    let threw = '';
    try { frame(DAY, redBox); } catch (e) { threw = String(e); }
    T.check('while the context is lost a frame does nothing, and throws nothing', threw === '' && b.readPixels(0, 0, 1, 1) === null, threw);
    await T.sleep(20);   // the browser allows a restore only once the lost event has been dealt with in full
    const back2 = event('webglcontextrestored');
    lose.restoreContext();
    await back2;
    await T.sleep(50);
    frame(DAY, redBox);
    T.check('after the context comes back the next frame draws again', isRed(read(0, 0, 1.2)), read(0, 0, 1.2));
  }

  // ---- other screen shapes, on a canvas of the test's own ----
  const spare = document.createElement('canvas'), other = Gfx.backends.gl(spare), radii = {};
  for (const [w, h] of [[390, 844], [360, 800], [844, 390], [800, 800], [1024, 768], [1366, 1024], [1280, 720], [1920, 1080], [2560, 1080]]) {
    other.resize(w, h, 1);
    other.begin({ x: 0, y: 0, zoom: 1 }, null);
    radii[w + 'x' + h] = Math.round(other.visibleRadius() * 100) / 100;
  }
  T.check('visibleRadius stays under 24 metres on every screen shape from 390x844 to 2560x1080', Object.values(radii).every((r) => r < 24 && r > 10), radii);
  other.resize(2560, 1440, 2);
  T.check('the canvas holds no more than 2.5 million pixels', spare.width * spare.height <= 2.5e6 && spare.width > 2000, [spare.width, spare.height]);

  // ---- slow frames step the quality down by themselves ----
  const heard = [];
  const off = Plat.on('quality', (level) => heard.push(level));
  other.resize(64, 64, 1);
  other.quality('high');
  const until = performance.now() + 2400;
  let last = performance.now();
  while (performance.now() < until) {
    other.begin(null, null);
    other.end(null);
    while (performance.now() - last < 30) { /* a slow frame */ }
    last = performance.now();
  }
  off();
  T.check('after two seconds of frames 30 ms apart the view steps down one level, and says so', other.quality() === 'medium' && heard.join() === 'medium',
    { quality: other.quality(), heard: heard });
  const extra = spare.getContext('webgl2').getExtension('WEBGL_lose_context');
  if (extra) extra.loseContext();
  return T.done();
};

// For the record only: the processor's share of a frame of 10 000 parts, from b.begin to b.end, with and without
// filling the records first. It asserts no time; the numbers are in the info (run with --verbose).
const timing = async function () {
  const { Gfx, Mesh } = TB;
  const b = Gfx.active, STRIDE = Gfx.PART_STRIDE, PER = 2000;
  if (!T.check('the view is the 3D one', !!b && b.name === 'gl', b && b.name)) return T.done();
  b.quality('high');
  const bufs = Gfx.SHAPES.map(() => new Float32Array(PER * STRIDE));
  const fill = () => {
    for (let s = 0; s < 5; s++) {
      const buf = bufs[s];
      for (let i = 0, o = 0; i < PER; i++, o += STRIDE) {
        const k = s * PER + i;
        Mesh.part(buf, o, (k % 100) * 0.4 - 20, 0.1 * s, Math.floor(k / 100) * 0.4 - 20, 0.3, 0.6, 0.3, k * 0.1, 0, 0);
        buf[o + 12] = 0.6; buf[o + 13] = 0.5; buf[o + 14] = 0.4; buf[o + 15] = 0; buf[o + 16] = k % 50 === 0 ? 1 : 0; buf[o + 17] = 1;
      }
    }
  };
  fill();
  const cam = { x: 0, y: 0, zoom: 1 }, issue = [], filled = [];
  const settle = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 30)));
  for (let run = 0; run < 15; run++) {
    b.readPixels(0, 0, 1, 1);   // waits for the drawing before: each run starts with the device idle
    await settle();
    let t0 = performance.now();
    b.begin(cam, null);
    for (let s = 0; s < 5; s++) b.parts(s, bufs[s], PER);
    b.end(null);
    issue.push(performance.now() - t0);
    b.readPixels(0, 0, 1, 1);
    await settle();
    t0 = performance.now();
    fill();
    b.begin(cam, null);
    for (let s = 0; s < 5; s++) b.parts(s, bufs[s], PER);
    b.end(null);
    filled.push(performance.now() - t0);
  }
  const median = (list) => list.slice().sort((x, y) => x - y)[list.length >> 1];
  const info = {
    parts: b.stats.instances, drawCalls: b.stats.drawCalls,
    issueMs: { median: +median(issue).toFixed(2), min: +Math.min(...issue).toFixed(2), max: +Math.max(...issue).toFixed(2) },
    fillAndIssueMs: { median: +median(filled).toFixed(2), min: +Math.min(...filled).toFixed(2), max: +Math.max(...filled).toFixed(2) },
  };
  T.check('10 000 parts: the processor\'s share of a frame, for the record (no time is asserted)', b.stats.instances === 10000 && b.stats.drawCalls <= 24, info);
  return T.done();
};

module.exports = [
  { name: 'gl: the 3D view, desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=gl', run: view },
  { name: 'gl: the 3D view, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=gl', run: view },
  { name: 'gl: the time of 10 000 parts, for the record', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=gl', run: timing },
];
