// The WebGPU light engine. CONTRACTS.md ("renderer/engine/") gives its interface.
//
// Every frame, in one command buffer:
//   1. Simulate (sim.wgsl): place any new particles in the resting shape, then move them all.
//   2. The team colour field (team.wgsl), when two or more players are playing.
//   3. The light (trails.wgsl, draw.wgsl): last frame's light fades by a blend constant and is
//      capped, then every particle adds itself as a soft quad, into an rgba16float texture.
//   4. Bloom (bloom.wgsl): a 13-tap downsample chain; eye adaptation and the flash guard
//      (adapt.wgsl) read its smallest level; then a tent upsample back up the chain.
//   5. The composite (composite.wgsl): exposure, AgX, fringe, vignette, grain and dither, into
//      an offscreen picture. capture() reads that picture; the canvas gets a copy of it.
//
// The simulation and the look are a port of the mobile edition's WebGL2 engine
// (../Tactilume/src/js/gfx/engine.js and its shaders), so a scene looks and moves the same in
// both. What is the desktop's own: compute shaders instead of transform feedback, particles
// up to the adapter's buffer limit, instanced quads instead of points, extended HDR output,
// team colours, offscreen-first drawing, and recovery from a lost device.
import { PALETTES, paletteIndex, bakeLUT } from '../../../../Tactilume/src/js/core/palettes.js';
import { behaviourByKey } from '../../../../Tactilume/src/js/core/behaviours.js';
import { FORMS, COLOR_BY, DEFAULT_SCENE } from '../../../../Tactilume/src/js/core/scene.js';
import { clamp, approach } from '../../../../Tactilume/src/js/core/util.js';
import { requestDevice, workgroupGrid } from './gpu.js';
import { readTexture, readBuffer } from './capture.js';
import { createCamera } from './camera.js';
import { createTouch, srgbToLinear } from './touch.js';
import { FRAME, LEVEL, EXPOSURE, LOOK, createUniforms } from './layout.js';
import COMMON from './shaders/common.wgsl';
import SCREEN from './shaders/screen.wgsl';
import SIM from './shaders/sim.wgsl';
import DRAW from './shaders/draw.wgsl';
import TEAM from './shaders/team.wgsl';
import TRAILS from './shaders/trails.wgsl';
import BLOOM from './shaders/bloom.wgsl';
import ADAPT from './shaders/adapt.wgsl';
import COMPOSITE from './shaders/composite.wgsl';

const BYTES_PER_PARTICLE = 32;
const GROUP_SIZE = 256;                // the simulation's workgroup size (sim.wgsl)
const BATCH = 64;                      // particles per instance of the speck draw (draw.wgsl)
const PARTICLE_STEP = 65536;           // the particle buffer grows and shrinks in steps of 2 MiB
const REF_COUNT = 262144;              // the count the mobile edition's energy is tuned around
const LIGHT_FORMAT = 'rgba16float';    // the light, the bloom chain and the team field
const TEAM_SIZE = [128, 72];           // texels of the team colour field
const TEAM_EXTENT = 1.2;               // it reaches this far, in world units (a little past the screen)
const HDR_PEAK = 3;                    // extended output peaks at 3x SDR white
const SATURATION = 1.22;
const MAX_LOGGED_ERRORS = 5;
// Frames the GPU may have queued. Drawing offscreen, nothing else holds the frame loop back,
// and a GPU slower than the display would fall further behind every frame.
const MAX_IN_FLIGHT = 2;
const MAX_STEP = 1 / 20;               // the longest simulation step, as main.js clamps dt
// What headless Chromium says when it cannot present a WebGPU canvas: after that the device
// is unusable, so the engine starts again on a new one and draws offscreen only.
const PRESENT_BROKEN = /external Instance reference no longer exists/i;

const finite = (x) => typeof x === 'number' && Number.isFinite(x);
const num = (x, fallback) => (finite(x) ? x : fallback);
const roundUp = (n, k) => Math.ceil(n / k) * k;

export async function createEngine(canvas, { particles = 20000, maxParticles = 0, hdr = 'auto', present = true, onLost } = {}) {
  let gpu = await requestDevice();      // throws Error('webgpu')
  let res = null;                        // everything made from the current device
  let presenting = false;
  let canPresent = present;
  let presentChecked = false;
  let rebuilding = null;                 // a promise while a new device is being set up
  let recreated = false;                 // the one recreation after a device loss is used up
  let disposed = false;
  let cssW = Math.max(1, canvas.clientWidth || canvas.width || 1);
  let cssH = Math.max(1, canvas.clientHeight || canvas.height || 1);
  let dpr = 1;
  let renderScale = 1;
  let frameMs = 0;
  let knownLimit = Infinity;             // lowered when the GPU runs out of memory
  let hdrMode = ['auto', 'on', 'off'].includes(hdr) ? hdr : 'auto';
  let hdrActive = false;                 // the canvas is in extended HDR now
  const hdrQuery = typeof matchMedia === 'function' ? matchMedia('(dynamic-range: high)') : null;
  let hdrScreen = !!hdrQuery?.matches;
  let dispatchWidth = Infinity;          // workgroups per dispatch row (a test seam lowers it)
  const errors = { count: 0, last: '' };

  // state on the CPU, kept across a device loss
  const cam = createCamera();
  const touch = createTouch();
  const frameU = createUniforms(FRAME);
  const exposureU = createUniforms(EXPOSURE);
  const lookU = createUniforms(LOOK);
  let simTime = 0;
  let camTime = 0;
  let frameNo = 0;
  let lastOrbit = 0;
  let lead = 'well';                     // the behaviour in the lead, for releases
  let palFrom = 0, palTo = 0, palMix = 1;
  let teamMix = 0;
  let drawn = 0;
  let drawnFrames = 0;                   // frames actually drawn (a skipped frame is not)
  let skipped = 0;
  let inFlight = 0;
  let owed = 0;                          // s of play from skipped frames, still to simulate
  let gpuMs = 0;                         // from submitting a frame until the GPU finished it

  const particleLimit = () => {
    const { limits } = gpu.device;
    const byBuffer = Math.floor(Math.min(limits.maxStorageBufferBindingSize, limits.maxBufferSize) / BYTES_PER_PARTICLE);
    const asked = maxParticles > 0 ? Math.floor(maxParticles) : Infinity;
    return Math.max(1, Math.min(byBuffer, asked, knownLimit));
  };
  let count = clamp(Math.round(num(particles, 20000)), 1, particleLimit());

  // ---- building on a device -------------------------------------------------------------

  async function makeModule(device, label, ...parts) {
    const module = device.createShaderModule({ label, code: parts.join('\n') });
    const info = await module.getCompilationInfo();
    const bad = info.messages.filter((m) => m.type === 'error');
    if (bad.length) throw new Error(`${label} shader: ${bad.map((m) => `line ${m.lineNum}: ${m.message}`).join('; ')}`);
    return module;
  }

  async function build() {
    const { device } = gpu;
    // validation errors would otherwise only be a console warning the tests could miss
    device.addEventListener('uncapturederror', (e) => {
      errors.count++;
      errors.last = e.error.message;
      if (errors.count <= MAX_LOGGED_ERRORS) console.error(`WebGPU error: ${e.error.message}`);
    });

    const [sim, draw, team, trails, bloom, adapt, composite] = await Promise.all([
      makeModule(device, 'simulation', COMMON, SIM),
      makeModule(device, 'specks', COMMON, DRAW),
      makeModule(device, 'team field', COMMON, SCREEN, TEAM),
      makeModule(device, 'trails', SCREEN, TRAILS),
      makeModule(device, 'bloom', COMMON, SCREEN, BLOOM),
      makeModule(device, 'eye adaptation', COMMON, ADAPT),
      makeModule(device, 'composite', COMMON, SCREEN, COMPOSITE),
    ]);

    let context = null;
    let pictureFormat = 'rgba8unorm';
    if (canPresent) {
      context = canvas.getContext('webgpu');
      // the canvas takes the picture by a plain copy, so the picture uses the canvas's
      // preferred format (rgba8unorm canvases fail on macOS)
      if (context) pictureFormat = navigator.gpu.getPreferredCanvasFormat();
    }

    const B = GPUBufferUsage;
    const T = GPUTextureUsage;
    const simLayout = device.createBindGroupLayout({
      label: 'simulation',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });
    const levelLayout = device.createBindGroupLayout({
      label: 'bloom level',
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    });
    const compositeLayout = device.createBindGroupLayout({
      label: 'composite',
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
      ],
    });
    const layoutOf = (...groups) => device.createPipelineLayout({ bindGroupLayouts: groups });
    const additive = { color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' } };
    const screenStage = (module) => ({ module, entryPoint: 'screen' });
    const light = (module, entryPoint, blend) => ({
      layout: 'auto',
      vertex: screenStage(module),
      fragment: { module, entryPoint, targets: [{ format: LIGHT_FORMAT, blend }] },
      primitive: { topology: 'triangle-list' },
    });

    const p = await Promise.all([
      device.createComputePipelineAsync({ label: 'place', layout: layoutOf(simLayout), compute: { module: sim, entryPoint: 'place' } }),
      device.createComputePipelineAsync({ label: 'simulate', layout: layoutOf(simLayout), compute: { module: sim, entryPoint: 'simulate' } }),
      device.createRenderPipelineAsync({
        label: 'specks',
        layout: 'auto',
        vertex: { module: draw, entryPoint: 'speck' },
        fragment: { module: draw, entryPoint: 'light', targets: [{ format: LIGHT_FORMAT, blend: additive }] },
        primitive: { topology: 'triangle-list' },
      }),
      device.createRenderPipelineAsync({ label: 'team field', ...light(team, 'field') }),
      // multiplies the light already there by the blend constant: the trails
      device.createRenderPipelineAsync({ label: 'fade', ...light(trails, 'fade', { color: { srcFactor: 'zero', dstFactor: 'constant', operation: 'add' }, alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' } }) }),
      // keeps every pixel at or below the ceiling, so no half float ever overflows
      device.createRenderPipelineAsync({ label: 'ceiling', ...light(trails, 'ceiling', { color: { srcFactor: 'one', dstFactor: 'one', operation: 'min' }, alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'min' } }) }),
      device.createRenderPipelineAsync({ label: 'downsample', ...light(bloom, 'down'), layout: layoutOf(levelLayout) }),
      device.createRenderPipelineAsync({ label: 'upsample', ...light(bloom, 'up', additive), layout: layoutOf(levelLayout) }),
      device.createComputePipelineAsync({ label: 'eye adaptation', layout: 'auto', compute: { module: adapt, entryPoint: 'adapt' } }),
      device.createRenderPipelineAsync({
        label: 'composite',
        layout: layoutOf(compositeLayout),
        vertex: screenStage(composite),
        fragment: { module: composite, entryPoint: 'sdr', targets: [{ format: pictureFormat }] },
        primitive: { topology: 'triangle-list' },
      }),
      // extended HDR is only for a canvas, so only made when there is one
      context ? device.createRenderPipelineAsync({
        label: 'composite (HDR)',
        layout: layoutOf(compositeLayout),
        vertex: screenStage(composite),
        fragment: { module: composite, entryPoint: 'hdr', targets: [{ format: LIGHT_FORMAT }, { format: pictureFormat }] },
        primitive: { topology: 'triangle-list' },
      }) : null,
    ]);
    const pipelines = {
      place: p[0], simulate: p[1], specks: p[2], team: p[3], fade: p[4], ceiling: p[5],
      down: p[6], up: p[7], adapt: p[8], composite: p[9], compositeHdr: p[10],
    };

    const sampler = device.createSampler({ label: 'linear', magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
    // the palettes, one per row, as plain sRGB bytes (the speck shader decodes them)
    const lut = bakeLUT(256);
    const palette = device.createTexture({ label: 'palettes', size: [lut.width, lut.height], format: 'rgba8unorm', usage: T.TEXTURE_BINDING | T.COPY_DST });
    device.queue.writeTexture({ texture: palette }, lut.data, { bytesPerRow: lut.width * 4 }, [lut.width, lut.height]);
    const teamField = device.createTexture({ label: 'team field', size: TEAM_SIZE, format: LIGHT_FORMAT, usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING });
    const frameBuffer = device.createBuffer({ label: 'frame', size: frameU.bytes.byteLength, usage: B.UNIFORM | B.COPY_DST });
    const exposureBuffer = device.createBuffer({ label: 'exposure', size: exposureU.bytes.byteLength, usage: B.UNIFORM | B.COPY_DST });
    const lookBuffer = device.createBuffer({ label: 'look', size: lookU.bytes.byteLength, usage: B.UNIFORM | B.COPY_DST });
    // eye adaptation and flash guard state; zero means "start afresh"
    const state = device.createBuffer({ label: 'exposure state', size: 16, usage: B.STORAGE | B.COPY_SRC | B.COPY_DST });
    // one batch of quads: corners 0..3 of quad q are vertices 4q..4q+3, two triangles each
    const quads = new Uint16Array(BATCH * 6);
    for (let q = 0; q < BATCH; q++) quads.set([0, 1, 2, 2, 1, 3].map((k) => q * 4 + k), q * 6);
    const quadIndex = device.createBuffer({ label: 'quad batch', size: quads.byteLength, usage: B.INDEX | B.COPY_DST });
    device.queue.writeBuffer(quadIndex, 0, quads);

    res = {
      device, context, pictureFormat, pipelines, simLayout, levelLayout, compositeLayout,
      sampler, palette, teamField, teamView: teamField.createView(), frameBuffer, exposureBuffer, lookBuffer, state, quadIndex,
      teamGroup: device.createBindGroup({ layout: pipelines.team.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: frameBuffer } }] }),
      particles: null, capacity: 0, simGroup: null, speckGroup: null,
      init: null,          // { first, end }: particles to place in the resting shape next frame
      clearLight: true,    // start the light from black next frame
      width: 0, height: 0, light: null, lightView: null, levels: [], picture: null, extended: null,
    };
    configureCanvas();
    presentChecked = false;
    inFlight = 0;
    sizeTargets();
    await resizeParticles(count);
    watchLoss(device);
  }

  // The canvas in extended HDR when that is wanted and the browser can, else in SDR.
  function configureCanvas() {
    const r = res;
    hdrActive = false;
    presenting = !!r?.context;
    if (!presenting) return;
    const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST;
    const wanted = hdrMode === 'on' || (hdrMode === 'auto' && hdrScreen);
    if (wanted && r.pipelines.compositeHdr) {
      try {
        r.context.configure({ device: r.device, format: LIGHT_FORMAT, usage, alphaMode: 'opaque', toneMapping: { mode: 'extended' } });
        // a browser without extended tone mapping leaves it out of the configuration
        hdrActive = r.context.getConfiguration?.()?.toneMapping?.mode === 'extended';
      } catch {
        hdrActive = false;
      }
    }
    if (!hdrActive) r.context.configure({ device: r.device, format: r.pictureFormat, usage, alphaMode: 'opaque' });
  }

  // The light, the bloom chain and the pictures follow the drawing size.
  function sizeTargets() {
    const r = res;
    const { device } = r;
    const max = device.limits.maxTextureDimension2D;
    const w = clamp(Math.round(cssW * dpr * renderScale), 1, max);
    const h = clamp(Math.round(cssH * dpr * renderScale), 1, max);
    const T = GPUTextureUsage;
    const extendedWanted = hdrActive;
    if (r.width === w && r.height === h && !!r.extended === extendedWanted && r.picture) return;
    canvas.width = w;
    canvas.height = h;
    r.picture?.destroy();
    r.extended?.destroy();
    r.picture = device.createTexture({ label: 'picture', size: [w, h], format: r.pictureFormat, usage: T.RENDER_ATTACHMENT | T.COPY_SRC });
    r.extended = extendedWanted ? device.createTexture({ label: 'picture (HDR)', size: [w, h], format: LIGHT_FORMAT, usage: T.RENDER_ATTACHMENT | T.COPY_SRC }) : null;
    if (r.width === w && r.height === h && r.light) return makeCompositeGroup();

    // a new size starts the light from black
    r.light?.destroy();
    for (const l of r.levels) l.texture.destroy();
    r.light = device.createTexture({ label: 'light', size: [w, h], format: LIGHT_FORMAT, usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING });
    r.lightView = r.light.createView();
    r.clearLight = true;
    const n = clamp(Math.floor(Math.log2(Math.min(w, h))) - 3, 3, 7);
    r.levels = [];
    let lw = w, lh = h;
    let source = r.light;
    for (let i = 0; i < n; i++) {
      lw = Math.max(1, Math.ceil(lw / 2));
      lh = Math.max(1, Math.ceil(lh / 2));
      const texture = device.createTexture({ label: `bloom ${i}`, size: [lw, lh], format: LIGHT_FORMAT, usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING });
      r.levels.push({ texture, view: texture.createView(), source, down: null, up: null });
      source = texture;
    }
    const levelGroup = (source, values) => {
      const u = createUniforms(LEVEL);
      for (const [k, v] of Object.entries(values)) u.set(k, v);
      const buffer = device.createBuffer({ label: 'bloom level', size: u.bytes.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(buffer, 0, u.bytes);
      return {
        buffer,
        group: device.createBindGroup({
          layout: r.levelLayout,
          entries: [{ binding: 0, resource: { buffer } }, { binding: 1, resource: source.createView() }, { binding: 2, resource: r.sampler }],
        }),
      };
    };
    r.levels.forEach((level, i) => {
      level.down = levelGroup(level.source, { texel: [1 / level.source.width, 1 / level.source.height], radius: 1, weight: 1, first: i === 0 ? 1 : 0 });
      const smaller = r.levels[i + 1];
      if (smaller) level.up = levelGroup(smaller.texture, { texel: [1 / smaller.texture.width, 1 / smaller.texture.height], radius: 1, weight: 1, first: 0 });
    });
    r.adaptGroup = device.createBindGroup({
      layout: r.pipelines.adapt.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: r.exposureBuffer } },
        { binding: 1, resource: r.levels[r.levels.length - 1].view },
        { binding: 2, resource: r.sampler },
        { binding: 3, resource: { buffer: r.state } },
      ],
    });
    r.width = w;
    r.height = h;
    makeCompositeGroup();
  }

  function makeCompositeGroup() {
    const r = res;
    r.compositeGroup = r.device.createBindGroup({
      layout: r.compositeLayout,
      entries: [
        { binding: 0, resource: { buffer: r.lookBuffer } },
        { binding: 1, resource: r.lightView },
        { binding: 2, resource: r.levels[0].view },
        { binding: 3, resource: r.sampler },
        { binding: 4, resource: { buffer: r.state } },
      ],
    });
  }

  function makeParticleGroups() {
    const r = res;
    r.simGroup = r.device.createBindGroup({
      layout: r.simLayout,
      entries: [{ binding: 0, resource: { buffer: r.frameBuffer } }, { binding: 1, resource: { buffer: r.particles } }],
    });
    r.speckGroup = r.device.createBindGroup({
      layout: r.pipelines.specks.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: r.frameBuffer } },
        { binding: 1, resource: { buffer: r.particles } },
        { binding: 2, resource: r.palette.createView() },
        { binding: 3, resource: r.sampler },
        { binding: 4, resource: r.teamView },
      ],
    });
  }

  function placeLater(first, end) {
    const r = res;
    if (!r || end <= first) return;
    r.init = r.init ? { first: Math.min(r.init.first, first), end: Math.max(r.init.end, end) } : { first, end };
  }

  // Makes the particle buffer fit `n` particles: bigger when the count grows (the particles
  // already there are kept, the new ones start in the resting shape), smaller when it has
  // fallen to half, so memory follows the count. A buffer the GPU has no memory for lowers
  // the limit instead. Only the buffer's own allocation is waited for.
  let resizing = Promise.resolve();
  function resizeLater() {
    resizing = resizing.then(() => resizeParticles(count)).catch((e) => console.error(e));
    return resizing;
  }

  async function resizeParticles(n) {
    const r = res;
    if (!r) return;
    const need = Math.min(roundUp(Math.max(n, 1), PARTICLE_STEP), particleLimit());
    const grow = need > r.capacity;
    const shrink = r.capacity > 4 * PARTICLE_STEP && need <= r.capacity / 2;
    if (!grow && !shrink) return;
    const { device } = r;
    device.pushErrorScope('out-of-memory');
    const buffer = device.createBuffer({
      label: 'particles',
      size: need * BYTES_PER_PARTICLE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    const noMemory = await device.popErrorScope();
    if (res !== r || disposed) { buffer.destroy(); return; }
    if (noMemory) {
      buffer.destroy();
      // what is there already fits; ask for no more than half of what failed
      knownLimit = Math.max(r.capacity, Math.floor(need / 2 / PARTICLE_STEP) * PARTICLE_STEP, PARTICLE_STEP);
      count = Math.min(count, particleLimit());
      console.warn(`Tactilume: not enough GPU memory for ${need} particles; using at most ${particleLimit()}`);
      if (r.capacity < Math.min(count, particleLimit())) await resizeParticles(count);
      return;
    }
    const kept = Math.min(r.capacity, need);
    if (kept > 0) {
      const encoder = device.createCommandEncoder({ label: 'keep particles' });
      encoder.copyBufferToBuffer(r.particles, 0, buffer, 0, kept * BYTES_PER_PARTICLE);
      device.queue.submit([encoder.finish()]);
    }
    if (r.init) r.init = { first: Math.min(r.init.first, need), end: Math.min(r.init.end, need) };
    placeLater(kept, need);
    r.particles?.destroy();
    r.particles = buffer;
    r.capacity = need;
    makeParticleGroups();
  }

  // ---- losing the device, and presenting ----------------------------------------------

  // Starts again on a new device. Without presenting when presenting is what broke.
  function rebuild(why) {
    if (rebuilding || disposed) return rebuilding;
    if (presenting && PRESENT_BROKEN.test(String(why && why.message))) canPresent = false;
    const old = gpu.device;
    // let go of the canvas, which is still configured with the old device
    try { res?.context?.unconfigure(); } catch { /* already gone with the device */ }
    res = null;
    presenting = false;
    hdrActive = false;
    rebuilding = (async () => {
      old.destroy();
      gpu = await requestDevice();
      await build();
    })()
      .catch((e) => { if (!disposed) onLost?.(e); })
      .finally(() => { rebuilding = null; });
    return rebuilding;
  }

  function lostDevice(device, info) {
    if (disposed || info.reason === 'destroyed' || device !== gpu.device) return;
    // a device broken by presenting is not a lost GPU: going offscreen fixes it for good, so
    // it does not use up the one recreation
    if (!PRESENT_BROKEN.test(info.message)) {
      if (recreated) { res = null; onLost?.(info); return; }
      recreated = true;
    }
    rebuild(info);
  }

  function watchLoss(device) {
    device.lost.then((info) => lostDevice(device, info));
  }

  // Presenting can fail only once the GPU runs the work, so the first presented frame is
  // checked; a failure there sends the engine offscreen.
  function checkPresent() {
    presentChecked = true;
    const device = gpu.device;
    device.queue.onSubmittedWorkDone().catch((e) => {
      if (device === gpu.device) rebuild(e);
    });
  }

  // ---- the frame ------------------------------------------------------------------------

  function frame(f = {}) {
    const r = res;
    if (!r || disposed || rebuilding || !r.particles) return;
    // the GPU is behind: skip this frame, and simulate its time with the next one
    if (inFlight >= MAX_IN_FLIGHT) {
      owed = Math.min(owed + clamp(num(f.dt, 0), 0, MAX_STEP), 0.25);
      skipped++;
      return;
    }
    const t0 = performance.now();
    const scene = f.scene || DEFAULT_SCENE;
    const settings = f.settings || {};
    const dt = Math.min(clamp(num(f.dt, 0), 0, MAX_STEP) + owed, MAX_STEP);
    owed = 0;
    const sdt = dt * num(scene.speed, 1);
    simTime += sdt;
    camTime += dt * (0.5 + num(scene.speed, 1) * 0.5);
    frameNo = (frameNo + 1) >>> 0;
    followHdr(settings.hdr);
    const W = r.width, H = r.height;
    const N = clamp(Math.round(count * num(scene.density, 1)), 1, r.capacity);
    drawn = N;

    // players' colours, when two or more are playing and team colours are on
    const players = Array.isArray(f.players) ? f.players : [];
    const team = settings.teamColors !== false && players.length >= 2;
    teamMix += ((team ? 1 : 0) - teamMix) * approach(dt, 0.4);
    if (!team && teamMix < 0.002) teamMix = 0;
    const colors = new Map();
    if (teamMix > 0) {
      for (const pl of players) if (Array.isArray(pl.color)) colors.set(pl.id, pl.color.slice(0, 3).map((c) => srgbToLinear(clamp(num(c, 0), 0, 1))));
    }
    const nPoles = touch.update(f.poles || [], dt, scene, colors);

    const beh = f.behaviour || { a: 'well', b: 'well', mix: 1 };
    const ia = (behaviourByKey(beh.a) || behaviourByKey('well')).id;
    const ib = (behaviourByKey(beh.b) || behaviourByKey('well')).id;
    const mix = clamp(num(beh.mix, 1), 0, 1);
    lead = mix < 0.5 ? beh.a : beh.b;

    const pi = paletteIndex(scene.palette);
    if (pi !== palTo) { palFrom = palMix >= 1 ? palTo : palFrom; palTo = pi; palMix = 0; }
    palMix = Math.min(1, palMix + dt / 0.8);

    lastOrbit = num(scene.orbit, 0);
    cam.update(W / H, lastOrbit, camTime);
    const audio = f.audio || {};
    const level = clamp(num(audio.level, 0), 0, 1);
    const bass = clamp(num(audio.bass, 0), 0, 1);
    const g = f.gravity || { x: 0, y: -1, z: 0 };
    const gs = num(scene.gravity, 0) * 2.2;

    // the light per particle (the mobile edition's energy normalisation): each speck carries
    // energy * size^2, spread over the pixels it covers, and energy = k * pixels / (count *
    // size^2) keeps the frame's mean near k whatever the count and resolution; more particles
    // still add a little richness, bigger specks a little light, and long trails are evened out
    const pxScale = H / 1000;
    const basePx = Math.max(0.6, 1.45 * pxScale);
    const size = num(scene.size, 1);
    const trails = num(scene.trails, 0.5);
    const tau = 0.04 + trails * trails * 1.35;
    const keep = trails > 0.005 ? Math.min(Math.exp(-dt / tau), 0.994) : 0;
    const trailNorm = Math.pow(1 - keep, 0.8);
    const energy = 0.055 * (W * H) / (N * basePx * basePx) * Math.pow(N / REF_COUNT, 0.3) / Math.max(size, 0.25)
      * trailNorm * (1 + level * 0.6);
    // Mobile capped each speck at 24000 / N so the whole frame could never overflow a half
    // float. At desktop counts and widths that cap falls below a resting speck's light and
    // would dim hot and cold light alike, so here a speck may reach twice a resting speck's
    // light (about what mobile allows on a phone), and the ceiling pass guards the overflow.
    const energyCap = Math.max(24000 / N, energy * 2);

    const U = frameU;
    U.set('viewProj', cam.viewProj);
    U.set('gravity', [num(g.x, 0) * gs, num(g.y, -1) * gs, num(g.z, 0) * gs, 0]);
    U.set('audio', [level, bass, clamp(num(audio.mid, 0), 0, 1), clamp(num(audio.high, 0), 0, 1)]);
    U.set('invRes', [1 / W, 1 / H]);
    U.set('teamScale', [0.5 / ((W / H) * TEAM_EXTENT), 0.5 / TEAM_EXTENT]);
    U.set('dt', sdt);
    U.set('time', simTime);
    U.set('strength', num(scene.strength, 1) * (1 + bass * 0.7));
    U.set('drag', num(scene.drag, 0.35));
    U.set('flow', num(scene.flow, 0.3));
    U.set('depth', num(scene.depth, 0.6));
    U.set('touch', touch.touch);
    U.set('engage', touch.engage);
    U.set('aspect', W / H);
    U.set('onset', clamp(num(audio.onset, 0), 0, 1));
    U.set('mix', mix * mix * (3 - 2 * mix));
    U.set('camDist', cam.dist);
    U.set('pointPx', Math.max(0.6, size * basePx));
    U.set('dofPx', num(scene.focus, 0.3) * 15 * pxScale);
    U.set('maxPx', clamp(32 * pxScale, 6, 48));
    U.set('energy', energy);
    U.set('energyCap', energyCap);
    U.set('sparkle', num(scene.sparkle, 0.3));
    U.set('high', clamp(num(audio.high, 0), 0, 1));
    U.set('palA', (palFrom + 0.5) / PALETTES.length);
    U.set('palB', (palTo + 0.5) / PALETTES.length);
    U.set('palMix', palMix * palMix * (3 - 2 * palMix));
    U.set('hue', num(scene.hue, 0) * Math.PI * 2);
    U.set('depthRange', 0.2 + num(scene.depth, 0.6) * 1.1);
    U.set('teamMix', teamMix);
    U.set('behA', ia);
    U.set('behB', ib);
    U.set('poleCount', nPoles);
    U.set('form', Math.max(0, FORMS.indexOf(scene.form)));
    U.set('colorBy', Math.max(0, COLOR_BY.indexOf(scene.colorBy)));
    U.set('frame', frameNo);
    U.set('count', N);
    const init = r.init;
    U.set('initFirst', init ? init.first : 0);
    U.set('initCount', init ? init.end - init.first : 0);
    U.f32.set(touch.pulseData, U.at('pulses'));
    U.f32.set(touch.pulseColors, U.at('pulseColors'));
    U.f32.set(touch.releaseData, U.at('releases'));
    U.f32.set(touch.poles, U.at('poles'));

    const glowGain = num(scene.glow, 0.6) ** 2 * 2.4;
    exposureU.set('dt', Math.max(dt, 1e-3));
    exposureU.set('base', Math.pow(2, num(scene.exposure, 0)) * 1.25);
    exposureU.set('amount', 0.5);
    exposureU.set('guard', settings.flashGuard === false ? 0 : 1);
    exposureU.set('rise', settings.calm ? 0.9 : 2.3);
    exposureU.set('glowGain', glowGain);

    lookU.set('res', [W, H]);
    lookU.set('glow', glowGain / r.levels.length);
    lookU.set('vignette', num(scene.vignette, 0.5));
    lookU.set('grain', num(scene.grain, 0.25));
    lookU.set('aberration', num(scene.aberration, 0.2));
    lookU.set('saturation', SATURATION);
    lookU.set('time', simTime);
    lookU.set('hdrPeak', HDR_PEAK);

    const { device } = r;
    device.queue.writeBuffer(r.frameBuffer, 0, U.bytes);
    device.queue.writeBuffer(r.exposureBuffer, 0, exposureU.bytes);
    device.queue.writeBuffer(r.lookBuffer, 0, lookU.bytes);
    const encoder = device.createCommandEncoder({ label: 'frame' });

    // 1. simulate
    const compute = encoder.beginComputePass({ label: 'simulate' });
    compute.setBindGroup(0, r.simGroup);
    if (init) {
      compute.setPipeline(r.pipelines.place);
      compute.dispatchWorkgroups(...workgroupGrid(init.end - init.first, GROUP_SIZE, Math.min(dispatchWidth, device.limits.maxComputeWorkgroupsPerDimension)));
      r.init = null;
    }
    compute.setPipeline(r.pipelines.simulate);
    compute.dispatchWorkgroups(...workgroupGrid(N, GROUP_SIZE, Math.min(dispatchWidth, device.limits.maxComputeWorkgroupsPerDimension)));
    compute.end();

    // 2. where each player's colour reaches
    if (teamMix > 0) {
      const pass = encoder.beginRenderPass({ label: 'team field', colorAttachments: [{ view: r.teamView, clearValue: [0, 0, 0, 0], loadOp: 'clear', storeOp: 'store' }] });
      pass.setPipeline(r.pipelines.team);
      pass.setBindGroup(0, r.teamGroup);
      pass.draw(3);
      pass.end();
    }

    // 3. the light: what is left of last frame, then every particle on top
    const fresh = keep <= 0 || r.clearLight;
    r.clearLight = false;
    const lightPass = encoder.beginRenderPass({
      label: 'light',
      colorAttachments: [{ view: r.lightView, clearValue: [0, 0, 0, 1], loadOp: fresh ? 'clear' : 'load', storeOp: 'store' }],
    });
    if (!fresh) {
      lightPass.setPipeline(r.pipelines.fade);
      lightPass.setBlendConstant([keep, keep, keep, 1]);
      lightPass.draw(3);
      lightPass.setPipeline(r.pipelines.ceiling);
      lightPass.draw(3);
    }
    lightPass.setPipeline(r.pipelines.specks);
    lightPass.setBindGroup(0, r.speckGroup);
    lightPass.setIndexBuffer(r.quadIndex, 'uint16');
    lightPass.drawIndexed(BATCH * 6, Math.ceil(N / BATCH));
    lightPass.end();

    // 4. bloom down, eye adaptation (on the smallest level), bloom up
    for (const level of r.levels) {
      const pass = encoder.beginRenderPass({ label: 'downsample', colorAttachments: [{ view: level.view, clearValue: [0, 0, 0, 1], loadOp: 'clear', storeOp: 'store' }] });
      pass.setPipeline(r.pipelines.down);
      pass.setBindGroup(0, level.down.group);
      pass.draw(3);
      pass.end();
    }
    const adapt = encoder.beginComputePass({ label: 'eye adaptation' });
    adapt.setPipeline(r.pipelines.adapt);
    adapt.setBindGroup(0, r.adaptGroup);
    adapt.dispatchWorkgroups(1);
    adapt.end();
    for (let i = r.levels.length - 2; i >= 0; i--) {
      const level = r.levels[i];
      const pass = encoder.beginRenderPass({ label: 'upsample', colorAttachments: [{ view: level.view, loadOp: 'load', storeOp: 'store' }] });
      pass.setPipeline(r.pipelines.up);
      pass.setBindGroup(0, level.up.group);
      pass.draw(3);
      pass.end();
    }

    // 5. the picture, then the canvas
    const targets = [{ view: r.picture.createView(), clearValue: [0, 0, 0, 1], loadOp: 'clear', storeOp: 'store' }];
    if (r.extended) targets.unshift({ view: r.extended.createView(), clearValue: [0, 0, 0, 1], loadOp: 'clear', storeOp: 'store' });
    const out = encoder.beginRenderPass({ label: 'composite', colorAttachments: targets });
    out.setPipeline(r.extended ? r.pipelines.compositeHdr : r.pipelines.composite);
    out.setBindGroup(0, r.compositeGroup);
    out.draw(3);
    out.end();
    if (presenting) {
      let shown = null;
      try {
        shown = r.context.getCurrentTexture();
      } catch (e) {
        // a canvas that cannot give a texture cannot present: go offscreen for good
        canPresent = false;
        rebuild(e);
        return;
      }
      const source = r.extended || r.picture;
      encoder.copyTextureToTexture({ texture: source }, { texture: shown }, [source.width, source.height]);
    }
    device.queue.submit([encoder.finish()]);
    drawnFrames++;
    inFlight++;
    const submitted = performance.now();
    device.queue.onSubmittedWorkDone().then(
      () => { if (res === r) { inFlight = Math.max(0, inFlight - 1); gpuMs = performance.now() - submitted; } },
      () => { /* the device was lost; the rebuild starts the count again */ },
    );
    if (presenting && !presentChecked) checkPresent();
    frameMs = submitted - t0;
  }

  // Follows the HDR setting (auto, on or off) and, for auto, whether the screen is HDR now.
  function followHdr(mode) {
    const nextMode = ['auto', 'on', 'off'].includes(mode) ? mode : hdrMode;
    const nextScreen = !!hdrQuery?.matches;
    if (nextMode === hdrMode && nextScreen === hdrScreen) return;
    hdrMode = nextMode;
    hdrScreen = nextScreen;
    if (!res?.context) return;
    configureCanvas();
    sizeTargets();
  }

  await build();

  return {
    get caps() {
      return {
        backend: 'webgpu',
        adapter: { ...gpu.adapterInfo },
        maxParticles: particleLimit(),
        hdr: hdrActive,
        features: [...gpu.features],
        presenting,
      };
    },
    get stats() {
      return {
        particles: count,
        drawn,
        capacity: res?.capacity || 0,
        renderScale,
        width: res?.width || 0,
        height: res?.height || 0,
        frameMs,
        gpuMs,
        frames: drawnFrames,
        skipped,
        presenting,
        hdr: hdrActive,
      };
    },
    get errors() { return { ...errors }; },
    get aspect() { return cssW / cssH; },

    resize(width, height, ratio = 1) {
      cssW = Math.max(1, num(width, 1));
      cssH = Math.max(1, num(height, 1));
      dpr = clamp(num(ratio, 1) || 1, 0.5, 4);
      // touches cast through the camera, so it must know the new shape at once
      cam.update(cssW / cssH, lastOrbit, camTime);
      if (res) sizeTargets();
    },

    // → a promise that settles once the particle buffer holds the new count
    setQuality({ particles: n, renderScale: s } = {}) {
      if (finite(n)) count = clamp(Math.round(n), 1, particleLimit());
      if (finite(s)) {
        renderScale = clamp(s, 0.25, 1);
        if (res) sizeTargets();
      }
      return resizeLater();
    },

    frame,

    // a ring of light where a touch lands (world units); color is the player's [r, g, b] 0..1
    pulse(x, y, power = 1, color) { touch.pulse(x, y, power, color); },
    // a touch was lifted after `heldFor` s; a nova lets go of its gathered light here
    release(x, y, power = 1, heldFor = 0) { touch.release(x, y, power, heldFor, lead); },

    // canvas CSS px → the point on the touch plane under it, through the camera (world units)
    screenToWorld(px, py) {
      return cam.ndcToPlane((px / cssW) * 2 - 1, 1 - (py / cssH) * 2);
    },
    worldToScreen(x, y) {
      const { nx, ny } = cam.planeToNdc(x, y);
      return { px: (nx + 1) * 0.5 * cssW, py: (1 - ny) * 0.5 * cssH };
    },

    // the last frame, SDR RGBA8, read back from the offscreen picture
    async capture() {
      if (rebuilding) await rebuilding;
      if (!res) throw new Error('the engine has stopped');
      return readTexture(res.device, res.picture);
    },

    // → a promise that settles when the GPU has finished everything submitted so far
    async finish() {
      if (rebuilding) await rebuilding;
      if (res) await res.device.queue.onSubmittedWorkDone();
    },

    // puts every particle back in the resting shape and clears the trails, next frame
    reset() {
      touch.reset();
      if (!res) return;
      placeLater(0, res.capacity);
      res.clearLight = true;
    },

    // For tests and debugging: the first `n` particles ([x, y, z, heat, vx, vy, vz, life]
    // each) and the exposure state [adapted, shown, exposure, valid]. Slow; never per frame.
    async inspect(n = 4) {
      if (rebuilding) await rebuilding;
      const r = res;
      if (!r) return null;
      const k = clamp(Math.floor(n), 1, r.capacity);
      const [parts, state] = await Promise.all([readBuffer(r.device, r.particles, k * BYTES_PER_PARTICLE), readBuffer(r.device, r.state, 16)]);
      const f = new Float32Array(parts);
      const list = [];
      for (let i = 0; i < k; i++) list.push(Array.from(f.subarray(i * 8, i * 8 + 8)));
      return { particles: list, adapt: Array.from(new Float32Array(state)), capacity: r.capacity, drawn };
    },

    // Test seams. _setDispatchWidth caps the workgroups per dispatch row, so a test can make
    // a small count dispatch in two dimensions. _simulateLoss loses the device as a GPU crash
    // would; the engine must recover once, then report.
    _setDispatchWidth(w) { dispatchWidth = finite(w) && w >= 1 ? Math.floor(w) : Infinity; },
    _simulateLoss() {
      const device = gpu.device;
      device.destroy();
      lostDevice(device, { reason: 'unknown', message: 'simulated device loss' });
      return rebuilding;
    },

    dispose() {
      disposed = true;
      res = null;
      gpu.device.destroy();
    },
  };
}
