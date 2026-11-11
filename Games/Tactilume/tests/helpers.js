// Node-side helpers for the browser scenarios: opening the app, multi-touch over the
// Chrome DevTools Protocol, waiting on the app's own frame counter, and reading
// screenshots. Scenarios get one helpers object per run (see createHelpers below).
import zlib from 'node:zlib';

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// One named check, as the runner reports it.
export function check(name, ok, info) {
  const text = info === undefined ? '' : typeof info === 'string' ? info : JSON.stringify(info);
  return { name, ok: !!ok, info: ok ? '' : String(text).slice(0, 300) };
}

// Waits for `fn` (run in the page) to return something truthy. Returns false on timeout
// instead of throwing, so a slow machine fails one check rather than the whole scenario.
export async function until(page, fn, arg, timeout = 10000) {
  try {
    await page.waitForFunction(fn, arg, { timeout, polling: 50 });
    return true;
  } catch (e) {
    if (/timeout/i.test(String(e && e.message))) return false;
    throw e;
  }
}

export const frames = (page) => page.evaluate(() => window.TACTILUME.frames);

// Waits until the app has drawn `n` more frames.
export async function waitFrames(page, n = 3, timeout = 15000) {
  const start = await frames(page);
  return until(page, ({ start, n }) => window.TACTILUME.frames >= start + n, { start, n }, timeout);
}

// ---- touch ------------------------------------------------------------------------

// `n` touch points spread evenly on a circle, with ids 1..n.
export function ring(n, cx, cy, radius = 110) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: Math.round(cx + Math.cos(a) * radius), y: Math.round(cy + Math.sin(a) * radius), id: i + 1 };
  });
}

// Sets the fingers on the screen to `points` ([{x, y, id}], CSS px). New ids press, known
// ids move, and an empty list lifts every finger. Chrome turns each change into the
// matching Pointer Events and Touch Events. Chrome's touch emulation can only lift all
// fingers together, so leaving out some of the pressed ids is refused.
const activeIds = new WeakMap();
export async function touch(cdp, points) {
  const before = activeIds.get(cdp) || new Set();
  const ids = new Set(points.map((p) => p.id));
  if (points.length && [...before].some((id) => !ids.has(id))) {
    throw new Error('touch(): Chrome cannot lift some fingers and keep others; lift() them all first');
  }
  let type = 'touchMove';
  if (!points.length) type = 'touchEnd';
  else if ([...ids].some((id) => !before.has(id))) type = 'touchStart';
  if (type === 'touchEnd' && !before.size) return;
  const touchPoints = points.map(({ x, y, id }) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 0.5 }));
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  activeIds.set(cdp, ids);
}

export const lift = (cdp) => touch(cdp, []);

// Moves every finger by (dx, dy) in `steps` small steps, `ms` apart.
export async function drag(cdp, points, dx, dy, steps = 4, ms = 40) {
  let cur = points;
  for (let i = 1; i <= steps; i++) {
    cur = points.map((p) => ({ ...p, x: Math.round(p.x + (dx * i) / steps), y: Math.round(p.y + (dy * i) / steps) }));
    await touch(cdp, cur);
    await wait(ms);
  }
  return cur;
}

export async function tap(cdp, x, y, holdMs = 80) {
  await touch(cdp, [{ x, y, id: 1 }]);
  await wait(holdMs);
  await lift(cdp);
}

// ---- screenshots -----------------------------------------------------------------

// Decodes an 8-bit, non-interlaced PNG (what Chromium's screenshots are) into raw bytes.
export function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8, width = 0, height = 0, depth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (depth !== 8 || !channels || interlace) throw new Error(`unsupported PNG: depth ${depth}, colour type ${colorType}, interlace ${interlace}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 255;
    }
    prev = cur;
  }
  return { width, height, channels, data: out };
}

// Brightness of an image, or of part of it. `region` is in fractions of the image:
// {x0, y0, x1, y1}. Returns the mean luma (0..255), the share of pixels brighter than
// `threshold` ("lit"), and the brightest luma.
export function light(img, { region = { x0: 0, y0: 0, x1: 1, y1: 1 }, threshold = 12, step = 2 } = {}) {
  const { width, height, channels, data } = img;
  const xa = Math.floor(region.x0 * width), xb = Math.ceil(region.x1 * width);
  const ya = Math.floor(region.y0 * height), yb = Math.ceil(region.y1 * height);
  let sum = 0, lit = 0, n = 0, max = 0;
  for (let y = ya; y < yb; y += step) {
    for (let x = xa; x < xb; x += step) {
      const o = (y * width + x) * channels;
      const l = channels >= 3 ? 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2] : data[o];
      sum += l; n++;
      if (l > threshold) lit++;
      if (l > max) max = l;
    }
  }
  return { mean: n ? sum / n : 0, lit: n ? lit / n : 0, max: Math.round(max) };
}

// Mean absolute difference (0..255) between two same-sized images: how much changed.
export function difference(a, b, step = 2) {
  if (a.width !== b.width || a.height !== b.height) return 255;
  let sum = 0, n = 0;
  for (let i = 0; i < a.data.length; i += a.channels * step) {
    sum += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
    n += 3;
  }
  return n ? sum / n : 0;
}

// A screenshot of what is drawn, decoded. The controls are hidden for it by default, so
// bright buttons cannot make a black canvas look lit.
export async function shot(page, { hideUI = true } = {}) {
  const style = hideUI ? await page.addStyleTag({ content: '#ui { visibility: hidden !important; }' }) : null;
  try {
    return decodePNG(await page.screenshot({ type: 'png' }));
  } finally {
    if (style) await style.evaluate((el) => el.remove());
  }
}

// ---- the app ------------------------------------------------------------------------

// Messages that are noise rather than faults: Chromium's software GL notes on readbacks.
const IGNORED = [/GPU stall due to ReadPixels/i, /GL Driver Message \(OpenGL, Performance/i];
// Warnings that are real faults: the engine made an invalid GL call.
const GL_FAULTS = [/GL_INVALID_/, /WebGL: INVALID_/];

// Everything a scenario can use, bound to one run: `appUrl` is the file under test,
// `query` the default URL query, `errors` collects page faults for the runner.
export function createHelpers({ browser, appUrl, query, errors, contextOptions }) {
  const extraContexts = [];
  // every check made, so a scenario that times out still reports how far it got
  const log = [];

  function watchPage(page) {
    const tag = () => (page.url().includes('#') ? ` [${page.url().split('#')[1].slice(0, 40)}]` : '');
    page.on('pageerror', (e) => errors.push(`page error${tag()}: ${String(e.stack || e.message).split('\n').slice(0, 4).join('\n')}`));
    page.on('crash', () => errors.push('the page crashed'));
    page.on('console', (m) => {
      const text = m.text();
      if (IGNORED.some((re) => re.test(text))) return;
      if (m.type() === 'error' || (m.type() === 'warning' && GL_FAULTS.some((re) => re.test(text)))) {
        errors.push(`console ${m.type()}${tag()}: ${text.split('\n').slice(0, 4).join('\n')}`);
      }
    });
  }

  // Every page in the context is watched, and the network is off: the app must work offline.
  async function watch(context) {
    context.on('page', watchPage);
    await context.route((url) => !/^(file|data|blob|about):$/.test(url.protocol), (route) => {
      errors.push(`network request (the app must work offline): ${route.request().url().slice(0, 120)}`);
      return route.abort();
    });
  }

  const url = ({ query: q = query, hash = '' } = {}) => appUrl + q + hash;

  // Waits for main.js to say it is up (two frames drawn). Returns how long it took (ms).
  async function ready(page, timeout = 20000) {
    const t0 = Date.now();
    const ok = await until(page, () => window.TACTILUME && window.TACTILUME.ready === true, undefined, timeout);
    if (!ok) {
      const fatal = await page.evaluate(() => document.getElementById('fatal')?.textContent || '').catch(() => '');
      throw new Error(`the app was not ready within ${timeout / 1000} s${fatal ? `: "${fatal}"` : ''}`);
    }
    return Date.now() - t0;
  }

  async function open(page, opts = {}) {
    const t0 = Date.now();
    await page.goto(url(opts));
    await ready(page, opts.timeout);
    return Date.now() - t0;
  }

  // A second, empty browser context (fresh storage) with the same device and the same watch.
  async function newContext() {
    const context = await browser.newContext(contextOptions);
    extraContexts.push(context);
    await watch(context);
    return context;
  }

  async function dispose() {
    await Promise.all(extraContexts.map((c) => c.close().catch(() => {})));
  }

  // A snapshot of what the app says about itself.
  const state = (page) => page.evaluate(() => {
    const t = window.TACTILUME;
    return { frames: t.frames, fingers: t.fingers, behaviour: t.behaviour, active: t.pointers.active(), stats: t.engine.stats };
  });

  return {
    bootMs: 0,
    log,
    check: (name, ok, info) => { const r = check(name, ok, info); log.push(r); return r; },
    wait, until, frames, waitFrames, ring, touch, lift, drag, tap,
    decodePNG, light, difference, shot,
    watch, url, ready, open, newContext, dispose, state,
  };
}
