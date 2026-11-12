// The renderer's way to the main process. In the app that is window.tactilume, from the
// preload. In a plain browser (the tests, or working on the renderer without Electron)
// there is no preload, so getBridge() builds a shim with the same API.
//
// The shim exposes window.__tlShim for tests:
//   emit(event)  deliver a link event as main would ({ type: 'join' | 'leave' | 'touch' | 'act', ... })
//   sent         every link.send(player, msg), as { player, msg }
//   settings     what app.setSettings() stored
//   ready        true once app.ready() was called
//   systemAudio  what audio.systemSupport() answers (change it to try the other paths)
//
// First version, written by the spine. The shell-ui part owns this file and replaces it.

const DEFAULT_SETTINGS = { linkPort: 47615, allowNewPhones: true, forceWebGPU: false, fullscreen: false, bounds: null };
// a stand-in for the QR code: a light square with a dark border, enough to lay out the panel
const PLACEHOLDER_QR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><rect width="29" height="29" fill="#fff"/><path d="M4 4h21v21H4z" fill="none" stroke="#000"/></svg>';

let shim = null;

export function getBridge() {
  if (typeof window !== 'undefined' && window.tactilume) return window.tactilume;
  if (!shim) shim = createShim();
  return shim;
}

function createShim() {
  const listeners = new Set();
  const phones = new Map(); // player → { player, name, since }
  let allowNew = true;
  let token = 'shim0token0000000000aa';

  const state = {
    sent: [],
    settings: {},
    ready: false,
    systemAudio: { supported: false, how: 'none' },
    // Delivered at once, as a copy: like IPC, a listener can never change the caller's object.
    emit(event) {
      const e = structuredClone(event);
      if (e && e.type === 'join') phones.set(e.player, { player: e.player, name: e.name || '', since: Date.now() });
      if (e && e.type === 'leave') phones.delete(e.player);
      for (const fn of [...listeners]) fn(e);
    },
  };
  window.__tlShim = state;

  const info = () => ({
    running: true,
    port: 47615,
    addresses: [{ address: '192.168.0.2', family: 'IPv4', name: 'shim' }],
    url: `http://192.168.0.2:47615/#k=${token}`,
    token,
    allowNew,
    phones: [...phones.values()],
    qrSvg: PLACEHOLDER_QR,
  });
  const settings = () => ({ ...DEFAULT_SETTINGS, ...state.settings });

  return {
    version: 'browser',
    platform: 'browser',
    link: {
      info: async () => info(),
      setAllowNew: async (on) => { allowNew = on === true; return info(); },
      rotateToken: async () => { token = `shim${Date.now().toString(36)}`.padEnd(22, '0').slice(0, 22); return info(); },
      send: async (player, msg) => { state.sent.push({ player, msg: structuredClone(msg) }); return phones.has(player); },
      onEvent(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    },
    app: {
      getSettings: async () => settings(),
      setSettings: async (partial) => { Object.assign(state.settings, partial); return settings(); },
      // a browser only goes full screen from a click or key press; outside one it says no
      async setFullscreen(on) {
        try {
          if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen();
          if (!on && document.fullscreenElement) await document.exitFullscreen();
        } catch { /* not allowed here */ }
        return !!document.fullscreenElement;
      },
      isFullscreen: async () => !!document.fullscreenElement,
      gpuInfo: async () => ({ shim: true }),
      ready: async () => { state.ready = true; },
      quit: async () => { state.quit = true; },
    },
    audio: {
      systemSupport: async () => ({ ...state.systemAudio }),
    },
  };
}
