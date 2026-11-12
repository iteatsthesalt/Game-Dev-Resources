// Node-side helpers for the browser scenarios: opening the renderer, waiting on its frame
// counter, reading its picture, fake gamepads and fake phone events. Each scenario gets one
// helpers object `h`, made by createHelpers (run.js does that).
//
// The renderer runs with ?test=1&present=0&particles=20000 unless a scenario says otherwise:
// a fixed seed and no autoplay, offscreen drawing (headless Chromium cannot present a
// WebGPU canvas), and few particles (the software GPU is slow).

export const DEFAULT_PARAMS = Object.freeze({ test: '1', present: '0', particles: '20000' });

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One named check, as the runner reports it. `info` is shown only when the check fails.
export function check(name, ok, info) {
  const text = info === undefined ? '' : typeof info === 'string' ? info : JSON.stringify(info);
  return { name, ok: !!ok, info: ok ? '' : String(text).slice(0, 400) };
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

export const frames = (page) => page.evaluate(() => window.TACTILUME_DESKTOP?.frames ?? 0);

// Waits until the renderer has drawn `n` more frames. → true, or false on timeout.
export async function waitFrames(page, n = 3, timeout = 15000) {
  const start = await frames(page);
  return until(page, ({ start, n }) => (window.TACTILUME_DESKTOP?.frames ?? 0) >= start + n, { start, n }, timeout);
}

// How bright the engine's last frame is, read from its offscreen picture with
// engine.capture(). `region` is in fractions of the picture, {x0, y0, x1, y1}, with (0, 0)
// at the top left. Returns { mean, lit, max, cx, cy, width, height }: the mean luma
// (0..255), the share of pixels brighter than `threshold`, the brightest luma, and where
// the light is (its brightness-weighted centre, 0..1 across the whole picture; null when
// the region is black). Worked out in the page, so the pixels never cross to Node.
export function capture(page, { region = { x0: 0, y0: 0, x1: 1, y1: 1 }, threshold = 12, step = 2 } = {}) {
  return page.evaluate(async ({ region, threshold, step }) => {
    const { width, height, data } = await window.TACTILUME_DESKTOP.engine.capture();
    const xa = Math.floor(region.x0 * width), xb = Math.ceil(region.x1 * width);
    const ya = Math.floor(region.y0 * height), yb = Math.ceil(region.y1 * height);
    let sum = 0, lit = 0, n = 0, max = 0, wx = 0, wy = 0;
    for (let y = ya; y < yb; y += step) {
      for (let x = xa; x < xb; x += step) {
        const o = (y * width + x) * 4;
        const l = 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2];
        sum += l;
        n++;
        if (l > threshold) lit++;
        if (l > max) max = l;
        wx += l * x;
        wy += l * y;
      }
    }
    return {
      width, height,
      mean: n ? sum / n : 0,
      lit: n ? lit / n : 0,
      max: Math.round(max),
      cx: sum ? wx / sum / width : null,
      cy: sum ? wy / sum / height : null,
    };
  }, { region, threshold, step });
}

// ---- fake gamepads ------------------------------------------------------------------------

// The standard mapping's buttons, by the names gamepad.js uses.
export const PAD_BUTTONS = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right', 'home'];

// Replaces navigator.getGamepads with `count` fake standard pads, before the page loads.
// Call it before open(). Drive the pads with setPad(); every rumble effect a pad is asked
// to play is kept in window.__tlRumble as { index, type, ...params }.
export function fakeGamepads(page, count = 1) {
  return page.addInitScript(({ count, names }) => {
    window.__tlRumble = [];
    const pads = Array.from({ length: count }, (_, index) => ({
      index,
      id: `Fake pad ${index} (STANDARD GAMEPAD)`,
      connected: true,
      mapping: 'standard',
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons: names.map(() => ({ pressed: false, touched: false, value: 0 })),
      vibrationActuator: {
        type: 'dual-rumble',
        playEffect(type, params = {}) {
          window.__tlRumble.push({ index, type, ...params });
          return Promise.resolve('complete');
        },
        reset: () => Promise.resolve('complete'),
      },
    }));
    // Chrome hands out a fresh snapshot on every call, so code must call again each frame
    const snapshot = (p) => ({ ...p, axes: [...p.axes], buttons: p.buttons.map((b) => ({ ...b })) });
    Object.defineProperty(Navigator.prototype, 'getGamepads', {
      configurable: true,
      value: () => pads.map((p) => (p.connected ? snapshot(p) : null)),
    });
    const announce = (type, p) => {
      const e = new Event(type);
      Object.defineProperty(e, 'gamepad', { value: snapshot(p) });
      window.dispatchEvent(e);
    };
    window.__tlPads = {
      // state: { axes?: [lx, ly, rx, ry], buttons?: { a: true, rt: 0.8, ... } }
      set(index, { axes, buttons } = {}) {
        const p = pads[index];
        if (axes) p.axes = axes.map(Number);
        for (const [name, v] of Object.entries(buttons || {})) {
          const value = typeof v === 'number' ? v : v ? 1 : 0;
          p.buttons[names.indexOf(name)] = { pressed: value > 0.1, touched: value > 0, value };
        }
        p.timestamp = performance.now();
      },
      connect(index) { pads[index].connected = true; announce('gamepadconnected', pads[index]); },
      disconnect(index) { pads[index].connected = false; announce('gamepaddisconnected', pads[index]); },
    };
  }, { count, names: PAD_BUTTONS });
}

export const setPad = (page, index, state) => page.evaluate(({ index, state }) => window.__tlPads.set(index, state), { index, state });

// ---- fake phones (the bridge shim) ---------------------------------------------------------

// Delivers a link event to the renderer as the main process would:
// { type: 'join', player, name, caps } | { type: 'leave', player }
// | { type: 'touch', player, seq, touches: [[id, x, y, f], …], at } | { type: 'act', player, a, v }
export const emit = (page, event) => page.evaluate((e) => window.__tlShim.emit(e), event);

// Everything the renderer sent to phones through bridge.link.send: [{ player, msg }].
export const sent = (page) => page.evaluate(() => window.__tlShim.sent);

// ---- the helpers object ---------------------------------------------------------------------

// `baseUrl`: where dist/ is served. `context`: the scenario's browser context.
export function createHelpers({ baseUrl, context }) {
  // every check made, so a scenario that throws or times out still reports how far it got
  const log = [];

  // The renderer's address. A parameter set to null is left out.
  function url(params = {}, page = 'renderer/index.html') {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...DEFAULT_PARAMS, ...params })) if (v !== null && v !== undefined) q.set(k, String(v));
    return `${baseUrl}/${page}?${q}`;
  }

  // Opens the renderer and waits until it is ready (its first frame is drawn), or until
  // `ready` (a page function) is true. → how long that took, in ms.
  async function open(page, params = {}, { ready = () => window.TACTILUME_DESKTOP?.ready === true, timeout = 30000 } = {}) {
    const t0 = Date.now();
    await page.goto(url(params));
    if (!(await until(page, ready, undefined, timeout))) {
      if (page.url().includes('/classic/')) {
        throw new Error(`the renderer handed over to the classic engine: this browser offered no WebGPU adapter (${page.url()})`);
      }
      const why = await page.evaluate(() => document.getElementById('fatal')?.textContent || '').catch(() => '');
      throw new Error(`the renderer was not ready within ${timeout / 1000} s at ${page.url()}${why ? `: "${why}"` : ''}`);
    }
    return Date.now() - t0;
  }

  return {
    log,
    context,
    baseUrl,
    check(name, ok, info) {
      const r = check(name, ok, info);
      log.push(r);
      return r;
    },
    url, open, wait, until, frames, waitFrames, capture,
    fakeGamepads, setPad, emit, sent,
  };
}
