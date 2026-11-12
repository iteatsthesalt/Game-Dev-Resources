// The main window: its security settings, the pages it may show, what the page may use, where
// it opens, and the GPU switches.
//
// This file does not import electron: main.js passes in BrowserWindow and app.commandLine, so
// the rules below are unit-tested in plain Node (tests/unit/settings-window.test.js).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIN_WINDOW } from './settings.js';

// Must run before the app is ready. Chromium's blocklist turns WebGPU off on some GPUs and
// drivers (Linux on AMD above all); forcing it on is the person's choice in Settings.
export function applyGpuSwitches(commandLine, { forceWebGPU }) {
  if (forceWebGPU !== true) return;
  commandLine.appendSwitch('ignore-gpu-blocklist');
  commandLine.appendSwitch('enable-unsafe-webgpu');
}

// True when `url` is a file inside one of `dirs`: the only pages the window may show, and the
// only pages whose messages main answers.
export function isAppPage(url, dirs) {
  let file;
  try {
    const u = new URL(url);
    if (u.protocol !== 'file:' || (u.host && u.host !== 'localhost')) return false;
    file = fileURLToPath(u);
  } catch {
    return false;
  }
  return dirs.some((dir) => {
    const rel = path.relative(dir, file);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  });
}

// What a page in the window may use. Electron grants every permission unless told otherwise,
// so this is a short list of yeses and a no to everything else (notifications, location,
// camera, MIDI, HID, serial, USB, the local network, ...).
//   media              the microphone or line-in, which the light can move with; never a camera
//   display-capture    what the computer is playing: Chromium captures system audio together
//                      with the screen (audio-capture.js answers the request itself)
//   fullscreen         the classic engine's own full-screen button
//   clipboard-sanitized-write   "Copy" beside the phone link's address
const ALLOWED = new Set(['display-capture', 'fullscreen', 'clipboard-sanitized-write']);

// `details` as Electron gives it to a permission request (mediaTypes) or check (mediaType).
export function allowPermission(permission, details = {}) {
  if (permission === 'media') {
    const types = Array.isArray(details.mediaTypes) ? details.mediaTypes : [details.mediaType];
    return types.length > 0 && types.every((t) => t === 'audio');
  }
  return ALLOWED.has(permission);
}

// A remembered window rectangle, moved and shrunk as little as possible so it fits the screens
// there are now (a monitor may have been unplugged, or a resolution changed, since it was
// saved). → bounds, or null when no screen shows enough of its top edge to grab it, so the
// window opens centred instead. `workAreas` are the screens' work areas ([{x, y, width, height}],
// Electron's screen.getAllDisplays()).
export function fitBounds(bounds, workAreas, { grip = 48 } = {}) {
  if (!bounds || !Array.isArray(workAreas) || !workAreas.length) return null;
  const { x, y, width, height } = bounds;
  const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  let best = null;
  let bestArea = 0;
  for (const a of workAreas) {
    // the strip along the top, where a title bar is, must be on this screen
    const stripW = overlap(x, x + width, a.x, a.x + a.width);
    const stripH = overlap(y, y + Math.min(grip, height), a.y, a.y + a.height);
    if (stripW < Math.min(2 * grip, width) || stripH < grip / 2) continue;
    const shown = stripW * overlap(y, y + height, a.y, a.y + a.height);
    if (shown > bestArea) {
      best = a;
      bestArea = shown;
    }
  }
  if (!best) return null;
  const w = Math.max(MIN_WINDOW.width, Math.min(width, best.width));
  const h = Math.max(MIN_WINDOW.height, Math.min(height, best.height));
  const clampTo = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
  const out = {
    x: clampTo(x, best.x, best.x + best.width - w),
    y: clampTo(y, best.y, best.y + best.height - h),
    width: w,
    height: h,
  };
  if (bounds.maximized) out.maximized = true;
  return out;
}

// `pages`: the folders whose files the window may navigate to (dist/renderer, dist/classic).
// `bounds`: where it opens (fitBounds first), or null for centred. `args` reach the preload
// through process.argv. `devTools`: whether the developer tools can open (not in a packaged
// build, unless asked for with --devtools).
export function createMainWindow(BrowserWindow, { preload, pages, bounds = null, fullscreen = false, args = [], devTools = false }) {
  const win = new BrowserWindow({
    title: 'Tactilume',
    width: bounds ? bounds.width : 1280,
    height: bounds ? bounds.height : 800,
    ...(bounds ? { x: bounds.x, y: bounds.y } : {}),
    minWidth: MIN_WINDOW.width,
    minHeight: MIN_WINDOW.height,
    fullscreen,
    backgroundColor: '#000000',
    show: false,
    // Windows and Linux: the menu bar appears while Alt is held, and its shortcuts always work
    autoHideMenuBar: true,
    webPreferences: {
      preload,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      // a dropped music file must reach the page, not replace it
      navigateOnDragDrop: false,
      // the light keeps playing on a second screen while another window has focus
      backgroundThrottling: false,
      spellcheck: false,
      devTools,
      additionalArguments: args,
    },
  });
  // Shown only once it has painted, so the first thing seen is black, not a white flash. A
  // maximised window is maximised then: maximize() would show it before its first paint.
  win.once('ready-to-show', () => {
    if (bounds?.maximized && !fullscreen) win.maximize();
    win.show();
  });

  const guard = (event, url) => { if (!isAppPage(url, pages)) event.preventDefault(); };
  win.webContents.on('will-navigate', guard);
  win.webContents.on('will-redirect', guard);
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  // Web Bluetooth would otherwise pick the first device it finds
  win.webContents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault();
    callback('');
  });
  return win;
}
