// The main window, its security settings, and the GPU switches.
//
// This file does not import electron: main.js passes in BrowserWindow and app.commandLine,
// so the navigation rule and the switches can be unit-tested in plain Node.
//
// First version, written by the spine. The shell-ui part owns this file and replaces it.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Must run before the app is ready. Chromium's blocklist turns WebGPU off on some GPUs and
// drivers (Linux on AMD above all); forcing it on is the person's choice in Settings.
export function applyGpuSwitches(commandLine, { forceWebGPU }) {
  if (!forceWebGPU) return;
  commandLine.appendSwitch('ignore-gpu-blocklist');
  commandLine.appendSwitch('enable-unsafe-webgpu');
}

// True when `url` is a file inside one of `dirs`: the only pages the window may show.
export function isAppPage(url, dirs) {
  let file;
  try {
    const u = new URL(url);
    if (u.protocol !== 'file:') return false;
    file = fileURLToPath(u);
  } catch {
    return false;
  }
  return dirs.some((dir) => {
    const rel = path.relative(dir, file);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  });
}

// `pages`: the folders whose files the window may navigate to (dist/renderer, dist/classic).
// `args` reach the preload through process.argv.
export function createMainWindow(BrowserWindow, { preload, pages, bounds = null, fullscreen = false, args = [] }) {
  const win = new BrowserWindow({
    title: 'Tactilume',
    width: bounds ? bounds.width : 1280,
    height: bounds ? bounds.height : 800,
    ...(bounds ? { x: bounds.x, y: bounds.y } : {}),
    minWidth: 480,
    minHeight: 320,
    fullscreen,
    backgroundColor: '#000000',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // the light keeps playing on a second screen while another window has focus
      backgroundThrottling: false,
      spellcheck: false,
      additionalArguments: args,
    },
  });
  // shown only once it has painted, so the first thing seen is black, not a white flash
  win.once('ready-to-show', () => win.show());

  const guard = (event, url) => { if (!isAppPage(url, pages)) event.preventDefault(); };
  win.webContents.on('will-navigate', guard);
  win.webContents.on('will-redirect', guard);
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  return win;
}
