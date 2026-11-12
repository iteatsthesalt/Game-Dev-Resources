// The WebGPU light engine. See CONTRACTS.md, "renderer/engine/".
//
// First version, written by the spine. It really runs on WebGPU: it gets a device, draws
// every frame into an offscreen rgba8unorm picture, reads that picture back for capture(),
// presents it to the canvas when it can, and starts again on a new device when the old one
// is lost. What it draws is only a soft glow at each pole and pulse, not particles, so that
// input and app tests have light to look at from day one. The engine part replaces it.
import { PALETTES, paletteIndex, samplePalette } from '../../../../Tactilume/src/js/core/palettes.js';
import { requestDevice } from './gpu.js';
import { readTexture } from './capture.js';
import GLOW_WGSL from './shaders/glow.wgsl';

const FORMAT = 'rgba8unorm';
const BYTES_PER_PARTICLE = 32;
const MAX_POLES = 64;
const MAX_PULSES = 16;
const LIGHT_FLOATS = 8;                // pos.xy, power, weight, color.rgba (see glow.wgsl)
const PULSE_SECONDS = 0.6;
// What headless Chromium says when it cannot present a WebGPU canvas: after that the device
// is unusable, so the engine starts again on a new one and draws offscreen only.
const PRESENT_BROKEN = /external Instance reference no longer exists/i;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// `hdr` is accepted for the contract; this first version always draws SDR.
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
  const pulses = [];
  const lights = new Float32Array((MAX_POLES + MAX_PULSES) * LIGHT_FLOATS);
  const frameData = new ArrayBuffer(16);
  const frameF32 = new Float32Array(frameData);
  const frameU32 = new Uint32Array(frameData);
  const paletteCache = new Map();

  const particleLimit = () => {
    const byBuffer = Math.floor(gpu.device.limits.maxStorageBufferBindingSize / BYTES_PER_PARTICLE);
    return maxParticles > 0 ? Math.min(byBuffer, maxParticles) : byBuffer;
  };
  let count = clamp(Math.round(particles), 1, particleLimit());

  async function build() {
    const { device } = gpu;
    // validation errors would otherwise only be a console warning the tests could miss
    device.addEventListener('uncapturederror', (e) => console.error(`WebGPU error: ${e.error.message}`));
    const module = device.createShaderModule({ label: 'glow', code: GLOW_WGSL });
    const pipeline = await device.createRenderPipelineAsync({
      label: 'glow',
      layout: 'auto',
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: 'fs', targets: [{ format: FORMAT }] },
      primitive: { topology: 'triangle-list' },
    });
    const frameBuffer = device.createBuffer({ label: 'frame', size: frameData.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const lightBuffer = device.createBuffer({ label: 'lights', size: lights.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: frameBuffer } }, { binding: 1, resource: { buffer: lightBuffer } }],
    });
    let context = null;
    if (canPresent) {
      context = canvas.getContext('webgpu');
      // the canvas takes the offscreen picture by a plain copy, so it uses the same format
      context?.configure({ device, format: FORMAT, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST, alphaMode: 'opaque' });
    }
    res = { pipeline, frameBuffer, lightBuffer, bindGroup, context, target: null };
    presenting = !!context;
    presentChecked = false;
    makeTarget();
    watchLoss(device);
  }

  function makeTarget() {
    const max = gpu.device.limits.maxTextureDimension2D;
    const w = clamp(Math.round(cssW * dpr * renderScale), 1, max);
    const h = clamp(Math.round(cssH * dpr * renderScale), 1, max);
    if (res.target && res.target.width === w && res.target.height === h) return;
    res.target?.destroy();
    res.target = gpu.device.createTexture({
      label: 'picture',
      size: [w, h],
      format: FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING,
    });
    canvas.width = w;
    canvas.height = h;
  }

  // Starts again on a new device. Without presenting when presenting is what broke.
  function rebuild(why) {
    if (rebuilding || disposed) return rebuilding;
    if (presenting && PRESENT_BROKEN.test(String(why && why.message))) canPresent = false;
    const old = gpu.device;
    // let go of the canvas, which is still configured with the old device
    try { res?.context?.unconfigure(); } catch { /* already gone with the device */ }
    res = null;
    rebuilding = (async () => {
      old.destroy();
      gpu = await requestDevice();
      await build();
    })()
      .catch((e) => { if (!disposed) onLost?.(e); })
      .finally(() => { rebuilding = null; });
    return rebuilding;
  }

  function watchLoss(device) {
    device.lost.then((info) => {
      if (disposed || info.reason === 'destroyed' || device !== gpu.device) return;
      // a device broken by presenting is not a lost GPU: going offscreen fixes it for good,
      // so it does not use up the one recreation
      if (!PRESENT_BROKEN.test(info.message)) {
        if (recreated) { onLost?.(info); return; }
        recreated = true;
      }
      rebuild(info);
    });
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

  function paletteColor(key) {
    if (!paletteCache.has(key)) paletteCache.set(key, samplePalette(PALETTES[paletteIndex(key)], 0.65).map((c) => c / 255));
    return paletteCache.get(key);
  }

  function putLight(i, x, y, power, weight, [r, g, b]) {
    const o = i * LIGHT_FLOATS;
    lights[o] = x; lights[o + 1] = y; lights[o + 2] = power; lights[o + 3] = weight;
    lights[o + 4] = r; lights[o + 5] = g; lights[o + 6] = b; lights[o + 7] = 1;
  }

  function frame(f) {
    if (!res || disposed) return;
    const t0 = performance.now();
    const dt = Number.isFinite(f.dt) ? f.dt : 0;
    const base = paletteColor(f.scene?.palette);
    // with two or more players, light near a player's poles takes on that player's colour
    const players = f.players || [];
    const team = f.settings?.teamColors !== false && players.length >= 2;
    const colorOf = new Map(players.map((p) => [p.id, p.color]));

    let n = 0;
    for (const p of f.poles || []) {
      if (n >= MAX_POLES) break;
      const weight = Number.isFinite(p.fade) ? p.fade : p.held ? 1 : 0;
      putLight(n++, p.x, p.y, clamp(p.power ?? 1, 0, 2), weight, (team && colorOf.get(p.player)) || base);
    }
    for (let i = pulses.length - 1; i >= 0; i--) {
      pulses[i].age += dt;
      if (pulses[i].age >= PULSE_SECONDS) pulses.splice(i, 1);
    }
    for (const p of pulses) putLight(n++, p.x, p.y, p.power, 1 - p.age / PULSE_SECONDS, p.color || base);

    const { device } = gpu;
    frameF32[0] = cssW / cssH;
    frameU32[1] = n;
    device.queue.writeBuffer(res.frameBuffer, 0, frameData);
    if (n) device.queue.writeBuffer(res.lightBuffer, 0, lights, 0, n * LIGHT_FLOATS);

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: res.target.createView(), clearValue: [0, 0, 0, 1], loadOp: 'clear', storeOp: 'store' }],
    });
    pass.setPipeline(res.pipeline);
    pass.setBindGroup(0, res.bindGroup);
    pass.draw(3);
    pass.end();
    if (presenting) {
      let shown = null;
      try {
        shown = res.context.getCurrentTexture();
      } catch (e) {
        // a canvas that cannot give a texture cannot present: go offscreen for good
        canPresent = false;
        rebuild(e);
        return;
      }
      encoder.copyTextureToTexture({ texture: res.target }, { texture: shown }, [res.target.width, res.target.height]);
    }
    device.queue.submit([encoder.finish()]);
    if (presenting && !presentChecked) checkPresent();
    frameMs = performance.now() - t0;
  }

  await build();

  return {
    get caps() {
      return { backend: 'webgpu', adapter: { ...gpu.adapterInfo }, maxParticles: particleLimit(), hdr: false, features: [...gpu.features], presenting };
    },
    get stats() {
      return { particles: count, renderScale, width: res?.target?.width || 0, height: res?.target?.height || 0, frameMs, presenting };
    },
    get aspect() { return cssW / cssH; },
    resize(width, height, ratio = 1) {
      cssW = Math.max(1, width);
      cssH = Math.max(1, height);
      dpr = clamp(ratio || 1, 0.5, 4);
      if (res) makeTarget();
    },
    setQuality({ particles: p, renderScale: s } = {}) {
      if (Number.isFinite(p)) count = clamp(Math.round(p), 1, particleLimit());
      if (Number.isFinite(s)) {
        renderScale = clamp(s, 0.25, 1);
        if (res) makeTarget();
      }
    },
    frame,
    // a ring of light where a touch lands (world units); colour [r, g, b] 0..1, or the palette's
    pulse(x, y, power = 1, color) {
      if (pulses.length >= MAX_PULSES) pulses.shift();
      pulses.push({ x, y, power: clamp(power, 0, 2), color: color || null, age: 0 });
    },
    // a touch was lifted; the stand-in picture has nothing to let go of
    release(x, y, power, heldFor) {},
    // canvas CSS px → world units: y from -1 (bottom) to 1 (top), x from -aspect to aspect
    screenToWorld(px, py) {
      return { x: ((px / cssW) * 2 - 1) * (cssW / cssH), y: 1 - (py / cssH) * 2 };
    },
    worldToScreen(x, y) {
      return { px: ((x / (cssW / cssH) + 1) / 2) * cssW, py: ((1 - y) / 2) * cssH };
    },
    async capture() {
      if (rebuilding) await rebuilding;
      if (!res) throw new Error('the engine has stopped');
      return readTexture(gpu.device, res.target);
    },
    dispose() {
      disposed = true;
      res = null;
      gpu.device.destroy();
    },
  };
}
