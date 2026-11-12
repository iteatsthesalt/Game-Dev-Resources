// The WebGPU engine, in the built renderer: the light renders, poles move it, every
// behaviour runs cleanly, symmetry and team colours work, the flash guard holds back a
// sudden brightening, the particle buffer grows and dispatches in two dimensions, HDR output
// is chosen as the settings and the screen say, a resize gives a new picture, and a lost
// device is recovered once. See CONTRACTS.md, "renderer/engine/".
//
// The software GPU draws about ten frames a second here, and the engine skips animation
// frames while the GPU is behind, so these scenarios wait on frames the engine has drawn
// (engine.stats.frames), not on the app's frame counter.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BEHAVIOUR_KEYS as BEHAVIOURS } from '../../../Tactilume/src/js/core/behaviours.js';

// The shader sources, for a scenario that runs one of them on its own. SHADERS may point
// elsewhere (TL_SHADERS) to try the scenario against another version.
const SHADERS = process.env.TL_SHADERS
  || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'renderer', 'engine', 'shaders');

// ---- helpers ------------------------------------------------------------------------------

const drawn = (page) => page.evaluate(() => window.TACTILUME_DESKTOP.engine.stats.frames);

// Waits until the engine has drawn `n` more frames. → true, or false on timeout.
async function drawFrames(h, page, n, timeout = 30000) {
  const start = await drawn(page);
  return h.until(page, ({ start, n }) => window.TACTILUME_DESKTOP.engine.stats.frames >= start + n, { start, n }, timeout);
}

const setScene = (page, partial) => page.evaluate((p) => window.TACTILUME_DESKTOP.store.setScene(p, { source: 'test' }), partial);
const setSettings = (page, partial) => page.evaluate((p) => window.TACTILUME_DESKTOP.store.setSettings(p, { source: 'test' }), partial);

// A player of our own in the input hub, holding still poles at world positions [[x, y], …].
// → the player ({ id, color, … }).
function addPlayer(page, key, places) {
  return page.evaluate(({ key, places }) => {
    const { hub } = window.TACTILUME_DESKTOP;
    const player = hub.addPlayer({ kind: 'phone', name: key, key });
    hub.setPoles(player.id, places.map(([x, y], i) => ({ x, y, vx: 0, vy: 0, power: 1, age: 1, held: true, id: `${key}${i}`, kind: 'touch' })));
    return player;
  }, { key, places });
}
const removePlayer = (page, id) => page.evaluate((id) => window.TACTILUME_DESKTOP.hub.removePlayer(id), id);

// A square region of the picture around a point on the touch plane, as capture() takes it.
function around(page, x, y, half = 0.07) {
  return page.evaluate(({ x, y, half }) => {
    const e = window.TACTILUME_DESKTOP.engine;
    const { px, py } = e.worldToScreen(x, y);
    const w = innerWidth, hgt = innerHeight;
    const r = half * hgt; // half the side, in px, from a share of the height
    const clamp = (v) => Math.min(1, Math.max(0, v));
    return { x0: clamp((px - r) / w), y0: clamp((py - r) / hgt), x1: clamp((px + r) / w), y1: clamp((py + r) / hgt) };
  }, { x, y, half });
}

// Mean red, green and blue (0..255) of each region of the last frame.
function colours(page, regions) {
  return page.evaluate(async (regions) => {
    const { width, height, data } = await window.TACTILUME_DESKTOP.engine.capture();
    return regions.map((r) => {
      let R = 0, G = 0, B = 0, n = 0;
      for (let y = Math.floor(r.y0 * height); y < Math.ceil(r.y1 * height); y++) {
        for (let x = Math.floor(r.x0 * width); x < Math.ceil(r.x1 * width); x++) {
          const o = (y * width + x) * 4;
          R += data[o]; G += data[o + 1]; B += data[o + 2]; n++;
        }
      }
      return { r: R / n, g: G / n, b: B / n };
    });
  }, regions);
}

// Reads back the first `n` particles. → { all: n, bad (any NaN or infinity), unplaced (all
// zero: never put in the resting shape), positions }
function particles(page, n) {
  return page.evaluate(async (n) => {
    const got = await window.TACTILUME_DESKTOP.engine.inspect(n);
    let bad = 0, unplaced = 0;
    const positions = [];
    for (const p of got.particles) {
      if (!p.every(Number.isFinite)) bad++;
      if (p.every((v) => v === 0)) unplaced++;
      positions.push(p[0], p[1], p[2]);
    }
    return { all: got.particles.length, bad, unplaced, positions, adapt: got.adapt };
  }, n);
}

const engineErrors = (page) => page.evaluate(() => window.TACTILUME_DESKTOP.engine.errors);
const round = (x, k = 2) => (x === null || x === undefined ? x : +x.toFixed(k));

// ---- scenarios ----------------------------------------------------------------------------

export default [
  {
    name: 'engine light: the particles glow at rest, with no one playing',
    async run(page, h) {
      await h.open(page);
      const checks = [h.check('the engine draws frames', await drawFrames(h, page, 8))];
      const t = await page.evaluate(() => ({ stats: window.TACTILUME_DESKTOP.engine.stats, caps: window.TACTILUME_DESKTOP.engine.caps }));
      checks.push(h.check('it draws the 20,000 particles asked for', t.stats.particles === 20000 && t.stats.drawn === 20000 && t.stats.capacity >= 20000, t.stats));
      checks.push(h.check('the largest count is the adapter\'s buffer limit over 32 bytes', t.caps.maxParticles >= 1e6 && t.caps.maxParticles <= 2 ** 31 / 32, t.caps));
      // nothing touches the light: what shows is the resting nebula of particles
      const all = await h.capture(page);
      checks.push(h.check('the resting light fills much of the picture', all.mean > 8 && all.lit > 0.25 && all.max > 60, all));
      checks.push(h.check('the resting nebula sits in the middle', all.cx > 0.38 && all.cx < 0.62 && all.cy > 0.38 && all.cy < 0.62, all));
      const edge = await h.capture(page, { region: { x0: 0, y0: 0, x1: 0.08, y1: 0.12 } });
      const middle = await h.capture(page, { region: { x0: 0.42, y0: 0.4, x1: 0.58, y1: 0.6 } });
      checks.push(h.check('it is brighter in the middle than in the corner', middle.mean > edge.mean * 2 + 5, { middle: middle.mean, edge: edge.mean }));
      const p = await particles(page, 4096);
      checks.push(h.check('every particle read back is a real number', p.bad === 0, { bad: p.bad }));
      // the resting nebula is a soft cloud, 0.34 world units across a standard deviation (x
      // scaled by the aspect): particles that were never placed would sit at the centre
      const spread = (k) => {
        const v = p.positions.filter((_, i) => i % 3 === k);
        const m = v.reduce((s, x) => s + x, 0) / v.length;
        return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length);
      };
      const aspect = await page.evaluate(() => window.TACTILUME_DESKTOP.engine.aspect);
      const sx = spread(0), sy = spread(1);
      checks.push(h.check('the particles are spread like the resting nebula', Math.abs(sx / (0.34 * aspect) - 1) < 0.35 && Math.abs(sy / 0.34 - 1) < 0.35, { sx: round(sx, 3), sy: round(sy, 3), aspect }));
      checks.push(h.check('the eye adaptation state is set', p.adapt[3] === 1 && p.adapt[2] > 0.02, p.adapt));
      const e = await engineErrors(page);
      checks.push(h.check('no WebGPU errors', e.count === 0, e));
      return checks;
    },
  },

  {
    name: 'engine pole: a held pole draws the light toward it',
    async run(page, h) {
      await h.open(page);
      // still camera, so a place on the plane stays at one place in the picture
      await setScene(page, { lock: 'well', orbit: 0 });
      await drawFrames(h, page, 6);
      const aspect = await page.evaluate(() => window.TACTILUME_DESKTOP.engine.aspect);
      const x = aspect * 0.6, y = 0.1;
      // the pole's place, and its mirror image across the middle as a control
      const spot = await around(page, x, y, 0.09);
      const mirror = await around(page, -x, y, 0.09);
      const before = await h.capture(page);
      const spotBefore = await h.capture(page, { region: spot });
      const player = await addPlayer(page, 'pull', [[x, y]]);
      const checks = [h.check('the engine keeps drawing', await drawFrames(h, page, 40))];
      const after = await h.capture(page);
      const spotAfter = await h.capture(page, { region: spot });
      const mirrorAfter = await h.capture(page, { region: mirror });
      checks.push(h.check('the light moves toward the pole', after.cx > before.cx + 0.05, { before: round(before.cx, 3), after: round(after.cx, 3), pole: round((x / aspect + 1) / 2, 3) }));
      const info = { before: round(spotBefore.mean), after: round(spotAfter.mean), mirror: round(mirrorAfter.mean) };
      checks.push(h.check('the light gathers at the pole, and not at its mirror image', spotAfter.mean > spotBefore.mean * 1.5 + 10 && spotAfter.mean > mirrorAfter.mean * 2 + 10, info));
      await removePlayer(page, player.id);
      return checks;
    },
  },

  {
    name: 'engine behaviours: all twelve run without WebGPU errors',
    timeout: 150000,
    async run(page, h) {
      await h.open(page);
      const checks = [];
      // three poles from two players first (rivers, threads and team colours all run), then
      // a single pole (the one-touch forms of current and weave)
      const a = await addPlayer(page, 'left', [[-0.6, 0.2], [0.1, -0.4]]);
      const b = await addPlayer(page, 'right', [[0.7, 0.3]]);
      for (const [label, remove] of [['three poles', null], ['one pole', [a.id]]]) {
        if (remove) for (const id of remove) await removePlayer(page, id);
        for (const key of BEHAVIOURS) {
          await setScene(page, { lock: key });
          const ran = await drawFrames(h, page, 5);
          const p = await particles(page, 2048);
          const e = await engineErrors(page);
          const pic = await h.capture(page);
          const ok = ran && p.bad === 0 && e.count === 0 && pic.mean > 2;
          checks.push(h.check(`${key} with ${label}: it runs, its particles stay real numbers, it shows light`, ok, { ran, bad: p.bad, errors: e, mean: round(pic.mean) }));
        }
      }
      await removePlayer(page, b.id);
      return checks;
    },
  },

  {
    name: 'engine flash guard: a sudden whole-screen brightening is held back',
    timeout: 150000,
    async run(page, h) {
      await h.open(page);
      // From a dim scene to a bright one at once: exposure -2.5 to +2.5 makes every pixel
      // 32 times brighter before tone mapping. Measured with the guard on (the default)
      // and then off.
      async function jump() {
        await setScene(page, { exposure: -2.5 });
        await drawFrames(h, page, 30);
        const dim = (await h.capture(page)).mean;
        await setScene(page, { exposure: 2.5 });
        await drawFrames(h, page, 3);
        const soon = (await h.capture(page)).mean;
        await drawFrames(h, page, 45);
        const later = (await h.capture(page)).mean;
        return { dim: round(dim), soon: round(soon), later: round(later) };
      }
      const guarded = await jump();
      await setSettings(page, { flashGuard: false });
      const bare = await jump();
      const info = { guarded, bare };
      return [
        h.check('without the guard the jump is a flash', bare.soon > bare.dim * 2 + 10, info),
        h.check('with the guard the screen brightens by less than a third as much at first', guarded.soon - guarded.dim < (bare.soon - bare.dim) / 3, info),
        h.check('with the guard the light still arrives, a little later', guarded.later > guarded.dim + (bare.soon - bare.dim) / 2, info),
      ];
    },
  },

  {
    // The guard and the exposure must see light wherever it is. With 16 fixed sample points
    // the middle of the screen counted for nothing at 4K and at this test's own size, so a
    // flash where light gathers went unmeasured. The held light of the real engine spreads
    // too widely to make a fair spot, so this runs adapt.wgsl itself on a known thumbnail:
    // the smallest bloom level at 4K (30x17) and at 800x500 (25x16), with one bright patch
    // at the centre, off centre and in a corner. Every place must give the same brightness.
    name: 'engine flash guard: the same light counts the same at the centre, off centre and in a corner',
    async run(page, h) {
      await h.open(page);
      const code = ['common.wgsl', 'adapt.wgsl'].map((f) => fs.readFileSync(path.join(SHADERS, f), 'utf8')).join('\n');
      const seen = await page.evaluate(async (code) => {
        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter.requestDevice();
        const module = device.createShaderModule({ code });
        const errors = (await module.getCompilationInfo()).messages.filter((m) => m.type === 'error').map((m) => m.message);
        if (errors.length) return { errors };
        const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'adapt' } });
        // dt, base, amount, guard, rise, glowGain: a fresh state takes the brightness as it is
        const exposure = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(exposure, 0, new Float32Array([1 / 60, 1, 1, 1, 1, 0, 0, 0]));
        const ONE = 0x3c00; // 1.0 as a half float
        async function measure(w, hgt, px, py) {
          const texture = device.createTexture({ size: [w, hgt], format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
          const texels = new Uint16Array(w * hgt * 4);
          // a 2x2 patch of white light
          for (const [x, y] of [[px, py], [px + 1, py], [px, py + 1], [px + 1, py + 1]]) texels.fill(ONE, (y * w + x) * 4, (y * w + x) * 4 + 3);
          device.queue.writeTexture({ texture }, texels, { bytesPerRow: w * 8 }, [w, hgt]);
          const state = device.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
          const read = device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
          const entries = [{ binding: 0, resource: { buffer: exposure } }, { binding: 1, resource: texture.createView() }, { binding: 3, resource: { buffer: state } }];
          // a version that samples the thumbnail (TL_SHADERS) also takes a linear sampler
          if (/@binding\(2\)\s*var\s+\w+\s*:\s*sampler/.test(code)) entries.push({ binding: 2, resource: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }) });
          const encoder = device.createCommandEncoder();
          const pass = encoder.beginComputePass();
          pass.setPipeline(pipeline);
          pass.setBindGroup(0, device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries }));
          pass.dispatchWorkgroups(1);
          pass.end();
          encoder.copyBufferToBuffer(state, 0, read, 0, 16);
          device.queue.submit([encoder.finish()]);
          await read.mapAsync(GPUMapMode.READ);
          const L = new Float32Array(read.getMappedRange())[0];
          read.unmap();
          // as a share of the same light spread evenly: 1 is fair
          return L / (4 / (w * hgt));
        }
        const out = {};
        for (const [w, hgt] of [[30, 17], [25, 16]]) {
          const cx = Math.floor(w / 2) - 1, cy = Math.floor(hgt / 2) - 1;
          out[`${w}x${hgt}`] = {
            centre: await measure(w, hgt, cx, cy),
            'off centre': await measure(w, hgt, Math.floor(w * 0.375) - 1, Math.floor(hgt * 0.625) - 1),
            corner: await measure(w, hgt, 0, 0),
          };
        }
        device.destroy();
        return out;
      }, code);
      if (seen.errors) return [h.check('adapt.wgsl compiles on its own', false, seen.errors)];
      return Object.entries(seen).map(([size, places]) => {
        const values = Object.values(places);
        const info = Object.fromEntries(Object.entries(places).map(([k, v]) => [k, +v.toFixed(3)]));
        return h.check(`${size}: a patch of light counts the same (within 20% of fair) wherever it is`, values.every((v) => v > 0.8 && v < 1.2), info);
      });
    },
  },

  {
    name: 'engine symmetry: one touch in a six-fold scene pulls light to six places',
    async run(page, h) {
      await h.open(page);
      await setScene(page, { lock: 'well', orbit: 0, symmetry: 6, mirror: false });
      await drawFrames(h, page, 4);
      const player = await addPlayer(page, 'six', [[0, 0.62]]);
      const checks = [h.check('the engine keeps drawing', await drawFrames(h, page, 40))];
      const at = (deg) => [0.62 * Math.cos((deg * Math.PI) / 180), 0.62 * Math.sin((deg * Math.PI) / 180)];
      const copies = [];
      const between = [];
      for (let k = 0; k < 6; k++) {
        copies.push((await h.capture(page, { region: await around(page, ...at(90 + k * 60), 0.06) })).mean);
        between.push((await h.capture(page, { region: await around(page, ...at(120 + k * 60), 0.06) })).mean);
      }
      const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
      const info = { copies: copies.map((m) => round(m)), between: between.map((m) => round(m)) };
      checks.push(h.check('light gathers at each of the six places', Math.min(...copies) > mean(between) * 1.3 + 5, info));
      await removePlayer(page, player.id);
      return checks;
    },
  },

  {
    name: 'engine team colours: light near each player\'s touch takes that player\'s colour',
    async run(page, h) {
      await h.open(page);
      // a grey palette, so any colour comes from the players
      await setScene(page, { lock: 'well', orbit: 0, palette: 'silver', hue: 0 });
      const left = await addPlayer(page, 'amber', [[-0.75, 0]]);
      const right = await addPlayer(page, 'sky', [[0.75, 0]]);
      const checks = [h.check('the engine keeps drawing', await drawFrames(h, page, 40))];
      const regions = [await around(page, -0.75, 0, 0.08), await around(page, 0.75, 0, 0.08)];
      const [l, r] = await colours(page, regions);
      // how much redder than blue each player's colour is, and each place's light
      const warmth = (c) => (Array.isArray(c) ? c[0] - c[2] : (c.r - c.b) / Math.max(1, c.r + c.g + c.b));
      const info = { left: { player: left.color, light: l }, right: { player: right.color, light: r } };
      checks.push(h.check('the two players have different colours', Math.sign(warmth(left.color)) !== Math.sign(warmth(right.color)), info));
      checks.push(h.check('light near the first player leans to its colour', Math.sign(warmth(l)) === Math.sign(warmth(left.color)) && Math.abs(warmth(l)) > 0.08, info));
      checks.push(h.check('light near the second player leans to its colour', Math.sign(warmth(r)) === Math.sign(warmth(right.color)) && Math.abs(warmth(r)) > 0.08, info));
      // one player alone plays in the palette's colours
      await removePlayer(page, right.id);
      await drawFrames(h, page, 30);
      const [alone] = await colours(page, [regions[0]]);
      checks.push(h.check('with one player the palette\'s grey comes back', Math.abs(warmth(alone)) < Math.abs(warmth(l)) / 2, { alone, before: l }));
      await removePlayer(page, left.id);
      return checks;
    },
  },

  {
    name: 'engine particle buffer: it grows, and a two-dimensional dispatch reaches every particle',
    timeout: 150000,
    async run(page, h) {
      await h.open(page);
      // rows of 5 workgroups (1,280 particles), so this small count dispatches in two dimensions
      await page.evaluate(() => window.TACTILUME_DESKTOP.engine._setDispatchWidth(5));
      const capacity = await page.evaluate(async () => {
        const e = window.TACTILUME_DESKTOP.engine;
        const before = e.stats.capacity;
        await e.setQuality({ particles: 70000 });
        return { before, after: e.stats.capacity, particles: e.stats.particles };
      });
      const checks = [
        h.check('the buffer grows to hold 70,000 particles', capacity.after >= 70000 && capacity.after > capacity.before && capacity.particles === 70000, capacity),
        h.check('the engine keeps drawing', await drawFrames(h, page, 3)),
      ];
      const first = await particles(page, 70000);
      checks.push(h.check('the new particles were placed, in rows', first.unplaced === 0 && first.bad === 0, { unplaced: first.unplaced, bad: first.bad }));
      await drawFrames(h, page, 3);
      const second = await particles(page, 70000);
      let still = 0;
      for (let i = 0; i < 70000; i++) {
        const o = i * 3;
        if (first.positions[o] === second.positions[o] && first.positions[o + 1] === second.positions[o + 1] && first.positions[o + 2] === second.positions[o + 2]) still++;
      }
      checks.push(h.check('every particle moves: each row of workgroups is simulated', still === 0, { still }));
      const stats = await page.evaluate(() => window.TACTILUME_DESKTOP.engine.stats);
      checks.push(h.check('all of them are drawn', stats.drawn === 70000, stats));
      const pic = await h.capture(page);
      checks.push(h.check('the light still shows', pic.mean > 8, pic));
      return checks;
    },
  },

  {
    // Headless Chromium cannot present, so each page here configures the canvas, draws its
    // first frame for the canvas, then goes offscreen; what is checked is that first choice.
    name: 'engine HDR: the canvas goes extended-range only when HDR is wanted and the screen can show it',
    timeout: 150000,
    async run(page, h) {
      const checks = [];
      const cases = [
        { hdr: 'auto', screen: true, extended: true },
        { hdr: 'auto', screen: false, extended: false },
        { hdr: 'on', screen: false, extended: true },
        { hdr: 'off', screen: true, extended: false },
      ];
      for (const c of cases) {
        const p = await h.context.newPage();
        await p.addInitScript(({ hdr, screen }) => {
          localStorage.setItem('tactilume.desktop.v1', JSON.stringify({ hdr }));
          // the screen's dynamic range, as the engine asks for it
          const real = window.matchMedia.bind(window);
          window.matchMedia = (q) => (/dynamic-range/.test(q) ? { matches: screen, media: q, addEventListener() {}, removeEventListener() {} } : real(q));
          // what the canvas is configured with, and which composite each frame uses
          window.__configs = [];
          const configure = GPUCanvasContext.prototype.configure;
          GPUCanvasContext.prototype.configure = function (conf) {
            configure.call(this, conf);
            window.__configs.push({ format: conf.format, mode: conf.toneMapping?.mode || 'standard', reported: this.getConfiguration?.()?.toneMapping?.mode });
          };
          window.__composites = [];
          const setPipeline = GPURenderPassEncoder.prototype.setPipeline;
          GPURenderPassEncoder.prototype.setPipeline = function (pipeline) {
            if (/composite/.test(pipeline.label)) window.__composites.push(pipeline.label);
            return setPipeline.call(this, pipeline);
          };
        }, c);
        await p.goto(h.url({ present: null }));
        const ready = await h.until(p, () => window.TACTILUME_DESKTOP?.ready === true && window.TACTILUME_DESKTOP.engine.stats.frames >= 3, undefined, 30000);
        const seen = await p.evaluate(() => ({ configs: window.__configs, composites: [...new Set(window.__composites)], first: window.__composites[0], caps: window.TACTILUME_DESKTOP?.engine?.caps, errors: window.TACTILUME_DESKTOP?.engine?.errors }));
        const first = seen.configs[0] || {};
        const label = `hdr ${c.hdr} on an ${c.screen ? 'HDR' : 'SDR'} screen`;
        const info = { ...seen, caps: undefined, presenting: seen.caps?.presenting };
        checks.push(h.check(`${label}: it starts`, ready, info));
        if (c.extended) {
          checks.push(h.check(`${label}: the canvas is rgba16float with extended tone mapping`, first.format === 'rgba16float' && first.mode === 'extended' && first.reported === 'extended', info));
          checks.push(h.check(`${label}: the first frame is composed for HDR`, seen.first === 'composite (HDR)', info));
        } else {
          checks.push(h.check(`${label}: the canvas is in standard range`, first.format && first.format !== 'rgba16float' && first.mode === 'standard', info));
          checks.push(h.check(`${label}: every frame is composed for SDR`, seen.composites.length === 1 && seen.composites[0] === 'composite', info));
        }
        checks.push(h.check(`${label}: no WebGPU errors, and it carries on offscreen`, seen.errors?.count === 0 && seen.caps?.presenting === false && seen.caps?.hdr === false, info));
        await p.close();
      }
      return checks;
    },
  },

  {
    name: 'engine resize: a new window size gives a picture of that size, and touches land right',
    async run(page, h) {
      await h.open(page);
      await setScene(page, { orbit: 0 });
      await drawFrames(h, page, 3);
      await page.setViewportSize({ width: 640, height: 360 });
      const resized = await h.until(page, () => window.TACTILUME_DESKTOP.engine.stats.width === 640 && window.TACTILUME_DESKTOP.engine.stats.height === 360);
      const checks = [h.check('the drawing follows the window to 640 x 360', resized, await page.evaluate(() => window.TACTILUME_DESKTOP.engine.stats))];
      checks.push(h.check('the engine keeps drawing', await drawFrames(h, page, 6)));
      const pic = await h.capture(page);
      checks.push(h.check('the picture read back is 640 x 360, with light in it', pic.width === 640 && pic.height === 360 && pic.mean > 8, pic));
      // the right edge of the window is x = aspect on the touch plane, the top is y = 1
      const edges = await page.evaluate(() => {
        const e = window.TACTILUME_DESKTOP.engine;
        return { aspect: e.aspect, right: e.screenToWorld(640, 180), top: e.screenToWorld(320, 0) };
      });
      const near = (a, b) => Math.abs(a - b) < 0.01;
      checks.push(h.check('touches map onto the new shape', near(edges.aspect, 640 / 360) && near(edges.right.x, 640 / 360) && near(edges.right.y, 0) && near(edges.top.x, 0) && near(edges.top.y, 1), edges));
      const e = await engineErrors(page);
      checks.push(h.check('no WebGPU errors', e.count === 0, e));
      return checks;
    },
  },

  {
    name: 'engine device loss: it recovers once on a new device, then reports',
    async run(page, h) {
      await h.open(page);
      await drawFrames(h, page, 4);
      const checks = [];
      await page.evaluate(() => window.TACTILUME_DESKTOP.engine._simulateLoss());
      checks.push(h.check('after a lost device it draws again', await drawFrames(h, page, 6)));
      const pic = await h.capture(page);
      checks.push(h.check('the light is back', pic.mean > 8 && pic.lit > 0.2, pic));
      const fatal = () => document.getElementById('fatal')?.hidden === false;
      checks.push(h.check('one loss is not reported', !(await page.evaluate(fatal))));
      await page.evaluate(() => window.TACTILUME_DESKTOP.engine._simulateLoss());
      checks.push(h.check('a second loss is reported to the app', await h.until(page, fatal, undefined, 10000)));
      return checks;
    },
  },
];
