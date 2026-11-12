// The renderer's way to the main process. In the app that is window.tactilume, from the
// preload. In a plain browser (the tests, or working on the renderer without Electron)
// there is no preload, so getBridge() builds a shim with the same API.
//
// The shim behaves like main where a test can tell: it refuses the arguments main refuses
// (so a UI bug fails a browser test instead of only failing in the app), "Allow new phones"
// is saved like the real setting, and its settings outlive a reload, as settings.json does.
//
// The shim exposes window.__tlShim for tests:
//   emit(event)  deliver a link event as main would ({ type: 'join' | 'leave' | 'touch' | 'act', ... })
//   sent         every link.send(player, msg), as { player, msg }
//   settings     what app.setSettings() and link.setAllowNew() stored
//   ready        true once app.ready() was called
//   systemAudio  what audio.systemSupport() answers (change it to try the other paths)
//   fullscreen   what app.setFullscreen() was last asked for (headless browsers may refuse it)
//   rotations    how many times the code was changed
//   linkRunning  false makes link.info() report a link that could not start

const DEFAULT_SETTINGS = Object.freeze({ linkPort: 47615, allowNewPhones: true, forceWebGPU: false, fullscreen: false, bounds: null });
// what main lets the page change (src/main/main.js, RENDERER_SETTINGS)
const PAGE_SETTINGS = new Map([['allowNewPhones', 'boolean'], ['forceWebGPU', 'boolean']]);
const STORE_KEY = 'tactilume.shim.settings.v1';
// a stand-in for the QR code: a light square with a dark border, enough to lay out the panel
const PLACEHOLDER_QR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><rect width="29" height="29" fill="#fff"/><path d="M4 4h21v21H4z" fill="none" stroke="#000"/></svg>';

let shim = null;

export function getBridge() {
  if (typeof window !== 'undefined' && window.tactilume) return window.tactilume;
  if (!shim) shim = createShim();
  return shim;
}

function loadStored() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    const out = {};
    for (const [k, type] of PAGE_SETTINGS) if (v && typeof v[k] === type) out[k] = v[k];
    return out;
  } catch {
    return {};
  }
}

function createShim() {
  const listeners = new Set();
  const phones = new Map(); // player → { player, name, since }
  let tokenCount = 0;
  const makeToken = () => `shim${String(tokenCount++).padStart(2, '0')}token0000000000aa`.slice(0, 22);
  let token = makeToken();

  const state = {
    sent: [],
    settings: loadStored(),
    ready: false,
    systemAudio: { supported: false, how: 'none' },
    fullscreen: false,
    rotations: 0,
    linkRunning: true,
    // Delivered at once, as a copy: like IPC, a listener can never change the caller's object.
    emit(event) {
      const e = structuredClone(event);
      if (e && e.type === 'join') phones.set(e.player, { player: e.player, name: e.name || '', since: Date.now() });
      if (e && e.type === 'leave') phones.delete(e.player);
      for (const fn of [...listeners]) fn(e);
    },
  };
  window.__tlShim = state;

  const settings = () => ({ ...DEFAULT_SETTINGS, ...state.settings });
  const save = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.settings)); } catch { /* storage blocked */ }
  };
  const info = () => {
    const url = state.linkRunning ? `http://192.168.0.2:47615/#k=${token}` : null;
    return {
      running: state.linkRunning,
      port: 47615,
      addresses: state.linkRunning ? [{ address: '192.168.0.2', family: 'IPv4', name: 'shim' }] : [],
      url,
      token,
      allowNew: settings().allowNewPhones,
      phones: [...phones.values()],
      qrSvg: url ? PLACEHOLDER_QR : '',
    };
  };
  // the same refusals as main.js, as rejected promises
  const refuse = (message) => Promise.reject(new TypeError(message));

  return {
    version: 'browser',
    platform: 'browser',
    link: {
      info: async () => info(),
      setAllowNew(on) {
        if (typeof on !== 'boolean') return refuse('link:allowNew takes true or false');
        state.settings.allowNewPhones = on;
        save();
        return Promise.resolve(info());
      },
      rotateToken: async () => {
        token = makeToken();
        state.rotations++;
        return info();
      },
      send(player, msg) {
        if (!Number.isInteger(player) || player < 1 || player > 8) return refuse('link:send takes a player number, 1 to 8');
        if (!msg || typeof msg !== 'object' || (msg.t !== 'haptic' && msg.t !== 'state')) return refuse('link:send only sends haptic and state messages');
        state.sent.push({ player, msg: structuredClone(msg) });
        return Promise.resolve(phones.has(player));
      },
      onEvent(fn) {
        if (typeof fn !== 'function') throw new TypeError('link.onEvent takes a function');
        listeners.add(fn);
        return () => { listeners.delete(fn); };
      },
    },
    app: {
      getSettings: async () => settings(),
      setSettings(partial) {
        if (!partial || typeof partial !== 'object' || Array.isArray(partial)) return refuse('app:settings:set takes an object');
        for (const [k, v] of Object.entries(partial)) {
          if (!PAGE_SETTINGS.has(k)) return refuse(`app:settings:set: ${k} is not a setting the page may change`);
          if (typeof v !== PAGE_SETTINGS.get(k)) return refuse(`app:settings:set: ${k} takes a ${PAGE_SETTINGS.get(k)}`);
        }
        Object.assign(state.settings, partial);
        save();
        return Promise.resolve(settings());
      },
      // A browser only goes full screen from a click or key press; outside one it says no.
      async setFullscreen(on) {
        if (typeof on !== 'boolean') throw new TypeError('app:fullscreen takes true or false');
        state.fullscreen = on;
        try {
          if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen();
          if (!on && document.fullscreenElement) await document.exitFullscreen();
        } catch { /* not allowed here */ }
        return on;
      },
      isFullscreen: async () => !!document.fullscreenElement || state.fullscreen,
      gpuInfo: async () => ({ shim: true, gpuDevice: [], featureStatus: { webgpu: 'enabled' } }),
      ready: async () => { state.ready = true; },
      quit: async () => { state.quit = true; },
    },
    audio: {
      systemSupport: async () => ({ ...state.systemAudio }),
    },
  };
}
