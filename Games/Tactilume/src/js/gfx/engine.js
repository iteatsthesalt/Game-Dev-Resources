// The light engine: a GPU particle simulation (WebGL2 transform feedback) drawn as
// HDR points with soft focus, light trails, bloom, eye adaptation, a flash guard and
// AgX tone mapping. See CONTRACTS.md for the interface main.js uses.

import { createProgram, createTarget, destroyTarget, canRender, preprocess } from './gl.js';
import { createCamera } from './camera.js';
import { QUAD_VS, NOTHING_FS, FADE_FS, DOWN_FS, UP_FS, ADAPT_FS, COMPOSITE_FS } from './shaders/post.glsl.js';
import COMMON from './shaders/common.glsl';
import SIM_VS from './shaders/sim.vert.glsl';
import POINTS_VS from './shaders/points.vert.glsl';
import POINTS_FS from './shaders/points.frag.glsl';
import { behaviourByKey } from '../core/behaviours.js';
import { PALETTES, paletteIndex, bakeLUT } from '../core/palettes.js';
import { FORMS, COLOR_BY } from '../core/scene.js';
import { MAX_POLES, symmetryPlan } from '../core/poles.js';
import { guessTier, TIERS } from '../core/governor.js';
import { clamp, approach } from '../core/util.js';

const STRIDE = 32; // bytes per particle: vec4 position+heat, vec4 velocity+life
const MAX_PULSES = 8;
const MAX_RELEASES = 4;
const REF_COUNT = 262144;

function stringHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function detectTier(gl) {
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  let renderer = '';
  try { renderer = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || ''); } catch { renderer = ''; }
  const touch = (navigator.maxTouchPoints || 0) > 0;
  const tier = guessTier({
    renderer,
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    deviceMemory: navigator.deviceMemory || 4,
    cores: navigator.hardwareConcurrency || 4,
    touch,
    screenPixels: (screen.width || 1000) * (screen.height || 1000) * (devicePixelRatio || 1) ** 2,
  });
  return { tier, renderer };
}

export function createEngine(canvas, opts = {}) {
  const attrs = { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
  const gl = canvas.getContext('webgl2', attrs);
  if (!gl) throw new Error('webgl2');

  const { tier, renderer } = detectTier(gl);
  const capacity = opts.maxParticles > 0 ? Math.floor(opts.maxParticles) : TIERS[tier].max;

  // ---- GPU resources (rebuilt after a context loss) ---------------------------------
  let R = null;          // everything that lives on the GPU
  let lost = false;
  let hdr = true;

  function build() {
    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('EXT_color_buffer_half_float');
    const HALF = { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT };
    const BYTE = { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };
    hdr = canRender(gl, HALF);
    const fmt = hdr ? HALF : BYTE;

    const chunks = { common: COMMON };
    const sim = createProgram(gl, preprocess(SIM_VS, chunks), NOTHING_FS, { name: 'simulation', varyings: ['vPos', 'vVel'] });
    const points = createProgram(gl, preprocess(POINTS_VS, chunks), POINTS_FS, { name: 'points' });
    const fade = createProgram(gl, QUAD_VS, FADE_FS, { name: 'fade' });
    const down = createProgram(gl, QUAD_VS, DOWN_FS, { name: 'downsample' });
    const up = createProgram(gl, QUAD_VS, UP_FS, { name: 'upsample' });
    const adapt = createProgram(gl, QUAD_VS, ADAPT_FS, { name: 'adapt' });
    const composite = createProgram(gl, QUAD_VS, COMPOSITE_FS, { name: 'composite' });

    // two particle buffers, read one and write the other each frame
    const bufs = [gl.createBuffer(), gl.createBuffer()];
    const vaos = bufs.map((b) => {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, capacity * STRIDE, gl.DYNAMIC_COPY);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, STRIDE, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, STRIDE, 16);
      return vao;
    });
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    const tf = gl.createTransformFeedback();
    const empty = gl.createVertexArray();

    // the palettes, one per row, decoded from sRGB by the texture unit
    const lut = bakeLUT(256);
    const lutTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, lutTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, lut.width, lut.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // sampler units never change, so set them once
    gl.useProgram(points.prog); gl.uniform1i(points.u.uLUT, 0);
    gl.useProgram(down.prog); gl.uniform1i(down.u.uSrc, 0);
    gl.useProgram(up.prog); gl.uniform1i(up.u.uSrc, 0);
    gl.useProgram(adapt.prog); gl.uniform1i(adapt.u.uLum, 0); gl.uniform1i(adapt.u.uPrev, 1);
    gl.useProgram(composite.prog); gl.uniform1i(composite.u.uScene, 0); gl.uniform1i(composite.u.uBloom, 1); gl.uniform1i(composite.u.uAdapt, 2);
    gl.useProgram(null);

    // eye adaptation and flash guard state: float bits in an integer target, exact on every device
    const UINT = { internal: gl.RGBA32UI, format: gl.RGBA_INTEGER, type: gl.UNSIGNED_INT };
    const adaptT = [createTarget(gl, 1, 1, UINT, gl.NEAREST), createTarget(gl, 1, 1, UINT, gl.NEAREST)];
    for (const t of adaptT) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array(4)); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    R = { sim, points, fade, down, up, adapt, composite, bufs, vaos, tf, empty, lutTex, lutRows: lut.height, fmt, adaptT, adaptCur: 0, cur: 0, scene: null, levels: [], w: 0, h: 0, needsInit: true };
  }

  function destroy() {
    if (!R) return;
    for (const k of ['sim', 'points', 'fade', 'down', 'up', 'adapt', 'composite']) gl.deleteProgram(R[k].prog);
    R.bufs.forEach((b) => gl.deleteBuffer(b));
    R.vaos.forEach((v) => gl.deleteVertexArray(v));
    gl.deleteVertexArray(R.empty);
    gl.deleteTransformFeedback(R.tf);
    gl.deleteTexture(R.lutTex);
    R.adaptT.forEach((t) => destroyTarget(gl, t));
    destroyTarget(gl, R.scene);
    R.levels.forEach((t) => destroyTarget(gl, t));
    R = null;
  }

  // the HDR scene and the bloom chain follow the drawing-buffer size
  function sizeTargets(w, h) {
    if (!R || (R.w === w && R.h === h)) return;
    const old = R.scene;
    R.levels.forEach((t) => destroyTarget(gl, t));
    R.scene = createTarget(gl, w, h, R.fmt);
    // A quality step only changes the resolution: carry the trails over, so the picture
    // does not blink dark. A new shape (rotation) or a first build starts black.
    const sameShape = old && old.ok && Math.abs(old.w / old.h - w / h) < 0.02;
    if (sameShape) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, old.fbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, R.scene.fbo);
      gl.blitFramebuffer(0, 0, old.w, old.h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.LINEAR);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, R.scene.fbo);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    destroyTarget(gl, old);
    const n = clamp(Math.floor(Math.log2(Math.min(w, h))) - 3, 3, 7);
    R.levels = [];
    let lw = w, lh = h;
    for (let i = 0; i < n; i++) {
      lw = Math.max(1, Math.ceil(lw / 2));
      lh = Math.max(1, Math.ceil(lh / 2));
      R.levels.push(createTarget(gl, lw, lh, R.fmt));
    }
    R.w = w; R.h = h;
  }

  build();

  // ---- state that lives on the CPU ---------------------------------------------------
  const cam = createCamera();
  let cssW = 1, cssH = 1, dpr = 1;
  let renderScale = 1;
  let drawN = Math.min(capacity, TIERS[tier].start);
  let frameNo = 0;
  let simTime = 0;
  let camTime = 0;
  let lastScene = null;
  let lead = 'well';
  const poleState = new Map();       // id -> { pole, w }
  const pulses = [];
  const releases = [];
  let touchAmt = 0;
  let engage = 0;
  let palFrom = 0, palTo = 0, palMix = 1;
  let pendingCaptures = [];

  const poleU = new Float32Array(MAX_POLES * 4);
  const poleVU = new Float32Array(MAX_POLES * 4);
  const pulseU = new Float32Array(MAX_PULSES * 4);
  const releaseU = new Float32Array(MAX_RELEASES * 4);

  function drawingSize() {
    return [Math.max(1, Math.round(cssW * dpr * renderScale)), Math.max(1, Math.round(cssH * dpr * renderScale))];
  }

  function applySize() {
    const [w, h] = drawingSize();
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    sizeTargets(w, h);
  }

  // copies of a point for the scene's symmetry, at most `max`, evenly spaced (as the poles)
  function symmetric(x, y, max) {
    const s = lastScene;
    const plan = symmetryPlan(1, s ? s.symmetry : 1, !!(s && s.mirror), max);
    const out = [];
    for (let k = 0; k < plan.n; k += plan.step) {
      const a = (k / plan.n) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      out.push([x * c - y * sn, x * sn + y * c]);
      if (plan.mirror) out.push([x * c + y * sn, x * sn - y * c]);
    }
    return out;
  }

  // Smooths touch weights so forces come in and go out softly, and keeps lifted
  // touches fading at their last place. Fills the pole uniform arrays.
  function updatePoles(poles, dt) {
    const seen = new Set();
    for (const p of poles) {
      seen.add(p.id);
      let st = poleState.get(p.id);
      if (!st) { st = { pole: p, w: 0 }; poleState.set(p.id, st); }
      st.pole = p;
    }
    for (const [id, st] of poleState) {
      const present = seen.has(id);
      const target = present && st.pole.held ? clamp(st.pole.power, 0.15, 2) : 0;
      st.w += (target - st.w) * approach(dt, target > st.w ? 0.045 : 0.14);
      if (!present) st.pole = { ...st.pole, held: false, age: st.pole.age + dt };
      if (!present && st.w < 0.01) poleState.delete(id);
    }
    const list = [...poleState.entries()].sort((a, b) => b[1].w - a[1].w).slice(0, MAX_POLES);
    // keep touch order (it shapes rivers and threads) among the strongest poles
    list.sort((a, b) => poles.findIndex((p) => p.id === a[0]) - poles.findIndex((p) => p.id === b[0]));
    let total = 0;
    list.forEach(([id, st], i) => {
      const p = st.pole;
      const root = String(id).split(':')[0];
      let sign = (stringHash(root) & 1) ? 1 : -1;
      if (/:m\d/.test(id)) sign = -sign;
      poleU.set([p.x, p.y, st.w, p.age], i * 4);
      poleVU.set([p.vx || 0, p.vy || 0, clamp(p.power, 0, 2), sign], i * 4);
      if (p.held) total += st.w;
    });
    const held = Math.min(1, total);
    touchAmt += (held - touchAmt) * approach(dt, 0.15);
    engage += (held - engage) * approach(dt, held > engage ? 0.1 : 2.5);
    return list.length;
  }

  function updateEvents(dt) {
    for (const e of pulses) e.age += dt;
    for (const e of releases) e.age += dt;
    while (pulses.length && pulses[0].age > 1.6) pulses.shift();
    while (releases.length && releases[0].age > 1.2) releases.shift();
    pulseU.fill(0);
    for (let i = 0; i < MAX_PULSES; i++) {
      const e = pulses[i];
      pulseU.set(e ? [e.x, e.y, e.power, e.age] : [0, 0, 0, 99], i * 4);
    }
    releaseU.fill(0);
    releases.forEach((e, i) => releaseU.set([e.x, e.y, e.charge, e.age], i * 4));
  }

  // ---- the frame -------------------------------------------------------------------
  function frame(f) {
    if (lost || !R) return;
    const scene = f.scene;
    lastScene = scene;
    const dt = f.dt;
    const sdt = dt * scene.speed;
    simTime += sdt;
    camTime += dt * (0.5 + scene.speed * 0.5);
    frameNo = (frameNo + 1) >>> 0;
    applySize();
    const W = R.w, H = R.h;
    const N = Math.max(1, Math.min(capacity, Math.round(drawN * scene.density)));

    const nPoles = updatePoles(f.poles || [], dt);
    updateEvents(dt);
    const beh = f.behaviour || { a: 'well', b: 'well', mix: 1 };
    const ia = (behaviourByKey(beh.a) || behaviourByKey('well')).id;
    const ib = (behaviourByKey(beh.b) || behaviourByKey('well')).id;
    const mix = clamp(beh.mix, 0, 1);
    lead = mix < 0.5 ? beh.a : beh.b;

    const pi = paletteIndex(scene.palette);
    if (pi !== palTo) { palFrom = palMix >= 1 ? palTo : palFrom; palTo = pi; palMix = 0; }
    palMix = Math.min(1, palMix + dt / 0.8);

    cam.update(W / H, scene.orbit, camTime);
    const audio = f.audio || { level: 0, bass: 0, mid: 0, high: 0, onset: 0 };
    const g = f.gravity || { x: 0, y: -1, z: 0 };
    const gs = scene.gravity * 2.2;

    // --- 1. simulate -------------------------------------------------------------------
    const s = R.sim;
    gl.useProgram(s.prog);
    gl.uniform4fv(s.u.uPole, poleU);
    gl.uniform4fv(s.u.uPoleV, poleVU);
    gl.uniform1i(s.u.uPoleCount, nPoles);
    gl.uniform4fv(s.u.uPulse, pulseU);
    gl.uniform4fv(s.u.uRelease, releaseU);
    gl.uniform1i(s.u.uBehA, ia);
    gl.uniform1i(s.u.uBehB, ib);
    gl.uniform1f(s.u.uMix, mix * mix * (3 - 2 * mix));
    gl.uniform1f(s.u.uDt, sdt);
    gl.uniform1f(s.u.uTime, simTime);
    gl.uniform1ui(s.u.uFrame, frameNo);
    gl.uniform1f(s.u.uStrength, scene.strength * (1 + audio.bass * 0.7));
    gl.uniform1f(s.u.uDrag, scene.drag);
    gl.uniform1f(s.u.uFlow, scene.flow);
    gl.uniform1f(s.u.uDepth, scene.depth);
    gl.uniform1f(s.u.uTouch, touchAmt);
    gl.uniform1f(s.u.uEngage, engage);
    gl.uniform1i(s.u.uForm, Math.max(0, FORMS.indexOf(scene.form)));
    gl.uniform3f(s.u.uGravity, g.x * gs, g.y * gs, g.z * gs);
    gl.uniform1f(s.u.uAspect, W / H);
    gl.uniform4f(s.u.uAudio, audio.level, audio.bass, audio.mid, audio.high);
    gl.uniform1f(s.u.uOnset, audio.onset);

    const runSim = (count, init) => {
      gl.uniform1i(s.u.uInit, init ? 1 : 0);
      gl.enable(gl.RASTERIZER_DISCARD);
      gl.bindVertexArray(R.vaos[R.cur]);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, R.tf);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, R.bufs[1 - R.cur]);
      gl.beginTransformFeedback(gl.POINTS);
      gl.drawArrays(gl.POINTS, 0, count);
      gl.endTransformFeedback();
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
      gl.bindVertexArray(null);
      gl.disable(gl.RASTERIZER_DISCARD);
      R.cur = 1 - R.cur;
    };
    if (R.needsInit) {
      // place every particle in the resting shape, in both buffers
      runSim(capacity, true);
      runSim(capacity, true);
      R.needsInit = false;
    }
    runSim(N, false);

    // --- 2. draw the light into the HDR scene, over what is left of last frame ---------
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.scene.fbo);
    gl.viewport(0, 0, W, H);
    const tau = 0.04 + scene.trails * scene.trails * 1.35;
    const keep = scene.trails > 0.005 ? Math.min(Math.exp(-dt / tau), 0.994) : 0;
    gl.enable(gl.BLEND);
    if (keep > 0) {
      gl.useProgram(R.fade.prog);
      gl.uniform1f(R.fade.u.uKeep, keep);
      gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
      gl.bindVertexArray(R.empty);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!hdr) {
        // In 8 bits a dim pixel times `keep` rounds back to itself and would glow forever;
        // taking one step off as well lets every trail fade all the way to black.
        gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.uniform1f(R.fade.u.uKeep, 1 / 255);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.blendEquation(gl.FUNC_ADD);
      }
    } else {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    const p = R.points;
    gl.useProgram(p.prog);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, R.lutTex);
    gl.uniformMatrix4fv(p.u.uViewProj, false, cam.viewProj);
    gl.uniform1f(p.u.uCamDist, cam.dist);
    const pxScale = H / 1000;
    const basePx = Math.max(0.6, 1.45 * pxScale);
    gl.uniform1f(p.u.uPointPx, Math.max(0.6, scene.size * basePx));
    gl.uniform1f(p.u.uDofPx, scene.focus * 15 * pxScale);
    gl.uniform1f(p.u.uMaxPx, clamp(32 * pxScale, 6, 48));
    // Each speck carries energy * size^2 of light, spread over the pixels it covers.
    // Choosing energy = k * pixels / (count * size^2) keeps the frame's mean near k
    // whatever the count and resolution; more particles still add a little richness,
    // bigger specks a little light, and long trails are evened out.
    const trailNorm = Math.pow(1 - keep, 0.8);
    const energy = 0.055 * (W * H) / (N * basePx * basePx) * Math.pow(N / REF_COUNT, 0.3) / Math.max(scene.size, 0.25)
      * trailNorm * (hdr ? 1 : 0.35) * (1 + audio.level * 0.6);
    gl.uniform1f(p.u.uEnergy, energy);
    gl.uniform1f(p.u.uEnergyCap, hdr ? 24000 / N : 4 / Math.sqrt(N));
    gl.uniform1f(p.u.uSparkle, scene.sparkle);
    gl.uniform1f(p.u.uHigh, audio.high);
    gl.uniform1f(p.u.uTime, simTime);
    gl.uniform1i(p.u.uColorBy, Math.max(0, COLOR_BY.indexOf(scene.colorBy)));
    gl.uniform1f(p.u.uPalA, (palFrom + 0.5) / R.lutRows);
    gl.uniform1f(p.u.uPalB, (palTo + 0.5) / R.lutRows);
    gl.uniform1f(p.u.uPalMix, palMix * palMix * (3 - 2 * palMix));
    gl.uniform1f(p.u.uHue, scene.hue * Math.PI * 2);
    gl.uniform1f(p.u.uDepthRange, 0.2 + scene.depth * 1.1);
    gl.bindVertexArray(R.vaos[R.cur]);
    gl.drawArrays(gl.POINTS, 0, N);
    gl.bindVertexArray(R.empty);

    // --- 3. bloom: downsample to a small blurred copy, then add it back up ------------
    gl.disable(gl.BLEND);
    const d = R.down;
    gl.useProgram(d.prog);
    let src = R.scene;
    R.levels.forEach((lvl, i) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, lvl.fbo);
      gl.viewport(0, 0, lvl.w, lvl.h);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform2f(d.u.uTexel, 1 / src.w, 1 / src.h);
      gl.uniform1i(d.u.uFirst, i === 0 ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = lvl;
    });
    // eye adaptation reads the smallest level before the upsample adds to the others
    const a = R.adapt;
    gl.useProgram(a.prog);
    const next = R.adaptT[1 - R.adaptCur];
    gl.bindFramebuffer(gl.FRAMEBUFFER, next.fbo);
    gl.viewport(0, 0, 1, 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, R.adaptT[R.adaptCur].tex);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, R.levels[R.levels.length - 1].tex);
    gl.uniform1f(a.u.uDt, Math.max(dt, 1e-3));
    gl.uniform1f(a.u.uBase, Math.pow(2, scene.exposure) * 1.25);
    gl.uniform1f(a.u.uAuto, 0.5);
    const settings = f.settings || {};
    gl.uniform1f(a.u.uGuard, settings.flashGuard === false ? 0 : 1);
    gl.uniform1f(a.u.uRise, settings.calm ? 0.9 : 2.3);
    const glowGain = scene.glow * scene.glow * 2.4;
    gl.uniform1f(a.u.uGlowGain, glowGain);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    R.adaptCur = 1 - R.adaptCur;

    const u = R.up;
    gl.useProgram(u.prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform1f(u.u.uRadius, 1.0);
    gl.uniform1f(u.u.uWeight, 1.0);
    for (let i = R.levels.length - 2; i >= 0; i--) {
      const dst = R.levels[i], from = R.levels[i + 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.bindTexture(gl.TEXTURE_2D, from.tex);
      gl.uniform2f(u.u.uTexel, 1 / from.w, 1 / from.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);

    // --- 4. compose onto the screen --------------------------------------------------
    const c = R.composite;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(c.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, R.scene.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, R.levels[0].tex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, R.adaptT[R.adaptCur].tex);
    gl.uniform1f(c.u.uGlow, glowGain / R.levels.length);
    gl.uniform1f(c.u.uVignette, scene.vignette);
    gl.uniform1f(c.u.uGrain, scene.grain);
    gl.uniform1f(c.u.uAberr, scene.aberration);
    gl.uniform1f(c.u.uSat, 1.22);
    gl.uniform1f(c.u.uTime, simTime);
    gl.uniform2f(c.u.uRes, W, H);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindVertexArray(null);

    // a photo is taken in the same task as the draw, while the picture is still there
    if (pendingCaptures.length) {
      const list = pendingCaptures;
      pendingCaptures = [];
      for (const { mime, resolve } of list) {
        try { canvas.toBlob((b) => resolve(b), mime, 0.95); } catch { resolve(null); }
      }
    }
  }

  // ---- context loss ------------------------------------------------------------------
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    R = null;
    poleState.clear();
    opts.onLost?.();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    try {
      build();
      applySize();
      opts.onRestored?.();
    } catch (err) {
      console.warn('Tactilume could not rebuild after the graphics context was restored', err);
    }
  });

  // ---- the interface -----------------------------------------------------------------
  const engine = {
    caps: { maxParticles: capacity, tier, renderer, halfFloat: hdr },
    get aspect() { return cssW / cssH; },

    resize(w, h, ratio) {
      cssW = Math.max(1, w); cssH = Math.max(1, h); dpr = ratio || 1;
      if (R) applySize();
    },

    setQuality({ particles, renderScale: rs }) {
      if (particles) drawN = clamp(Math.round(particles), 1024, capacity);
      if (rs) renderScale = clamp(rs, 0.4, 1);
      if (R) applySize();
    },

    frame,

    pulse(x, y, power = 1) {
      for (const [px, py] of symmetric(x, y, MAX_PULSES)) {
        pulses.push({ x: px, y: py, power: clamp(power, 0.2, 2), age: 0 });
        if (pulses.length > MAX_PULSES) pulses.shift();
      }
    },

    release(x, y, power = 1, heldFor = 0) {
      if (lead !== 'nova') return;
      const charge = clamp(heldFor / 1.5, 0.25, 1.6) * clamp(power, 0.4, 1.5);
      for (const [px, py] of symmetric(x, y, MAX_RELEASES)) {
        releases.push({ x: px, y: py, charge, age: 0 });
        if (releases.length > MAX_RELEASES) releases.shift();
      }
    },

    screenToWorld(px, py) {
      return cam.ndcToPlane((px / cssW) * 2 - 1, 1 - (py / cssH) * 2);
    },

    worldToScreen(x, y) {
      const { nx, ny } = cam.planeToNdc(x, y);
      return { px: (nx + 1) * 0.5 * cssW, py: (1 - ny) * 0.5 * cssH };
    },

    capture(mime = 'image/png') {
      return new Promise((resolve) => pendingCaptures.push({ mime, resolve }));
    },

    captureStream(fps = 60) {
      return canvas.captureStream ? canvas.captureStream(fps) : null;
    },

    get stats() {
      return { particles: Math.min(capacity, Math.round(drawN * (lastScene ? lastScene.density : 1))), renderScale, width: canvas.width, height: canvas.height };
    },

    get debug() {
      return { capacity, drawN, hdr, levels: R ? R.levels.length : 0, poles: poleState.size, lost, palettes: PALETTES.length, touch: touchAmt, engage };
    },

    // Puts every particle back in the resting shape (and clears the trails) next frame.
    reset() {
      if (!R) return;
      R.needsInit = true;
      gl.bindFramebuffer(gl.FRAMEBUFFER, R.scene.fbo);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      poleState.clear();
      pulses.length = 0;
      releases.length = 0;
    },

    // For tests and debugging: reads back a few particles, the HDR scene's mean
    // brightness and the eye-adaptation values. Slow (stalls the GPU); never per frame.
    inspect(sample = 4) {
      if (!R || lost) return null;
      const out = {};
      const n = Math.min(sample, capacity);
      const buf = new Float32Array(n * 8);
      gl.bindBuffer(gl.ARRAY_BUFFER, R.bufs[R.cur]);
      gl.getBufferSubData(gl.ARRAY_BUFFER, 0, buf);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      out.particles = [];
      for (let i = 0; i < n; i++) out.particles.push(Array.from(buf.slice(i * 8, i * 8 + 8), (v) => +v.toFixed(4)));
      const readMean = (t) => {
        const px = new Float32Array(t.w * t.h * 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
        gl.readPixels(0, 0, t.w, t.h, gl.RGBA, gl.FLOAT, px);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        let sum = 0, max = 0, lit = 0;
        for (let i = 0; i < px.length; i += 4) {
          const l = px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722;
          sum += l; if (l > max) max = l; if (l > 1e-3) lit++;
        }
        return { mean: sum / (t.w * t.h), max, lit, w: t.w, h: t.h };
      };
      if (hdr) {
        out.scene = readMean(R.scene);
        out.bloom = readMean(R.levels[0]);
      }
      // the adaptation state is float bits in an integer target (see ADAPT_FS)
      const bits = new Uint32Array(4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, R.adaptT[R.adaptCur].fbo);
      gl.readPixels(0, 0, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_INT, bits);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      out.adapt = Array.from(new Float32Array(bits.buffer));
      out.error = gl.getError();
      return out;
    },

    dispose() { destroy(); },
  };
  return engine;
}
