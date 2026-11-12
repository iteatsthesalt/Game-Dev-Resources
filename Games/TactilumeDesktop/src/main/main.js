// Electron's main process: settings, the phone link server, the window, and the IPC that the
// preload exposes to the renderer as window.tactilume. See CONTRACTS.md.
//
//   electron .           play
//   electron . --smoke   start everything, check it, print one line and exit (0 = it works)
//
// First version, written by the spine. The shell-ui part owns this file and replaces it.
import { app, BrowserWindow, ipcMain, session, desktopCapturer } from 'electron';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createSettings } from './settings.js';
import { createLinkServer } from './link-server.js';
import { qrSvg } from './qr.js';
import { installDisplayMedia, systemAudioSupport } from './audio-capture.js';
import { applyGpuSwitches, createMainWindow, isAppPage } from './window.js';
import { haptic, state } from '../shared/protocol.js';

const SMOKE = process.argv.includes('--smoke');
const SMOKE_LIMIT_MS = 30000;
// What the renderer may ask for. Electron grants every permission unless told otherwise.
const PERMISSIONS = new Set(['media', 'display-capture', 'fullscreen', 'clipboard-sanitized-write']);

const dist = path.join(app.getAppPath(), 'dist');
const pages = [path.join(dist, 'renderer'), path.join(dist, 'classic')];

// The smoke test gets its own empty profile: it must not read or change the person's
// settings, and the single-instance lock (held per profile) must not stop it while the
// app is open.
let smokeProfile = null;
if (SMOKE) {
  smokeProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'tactilume-smoke-'));
  app.setPath('userData', smokeProfile);
}

const settings = createSettings(path.join(app.getPath('userData'), 'settings.json'));
applyGpuSwitches(app.commandLine, settings.get());

if (!app.requestSingleInstanceLock()) {
  // the first instance hears 'second-instance' and comes to the front
  app.quit();
} else {
  start();
}

function start() {
  let win = null;
  let link = null;
  let smokeDone = false;
  const log = (line) => { if (!SMOKE) console.log(line); };
  const toRenderer = (channel, payload) => {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };

  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { link?.stop(); });

  // ---- IPC: every argument from the renderer is checked here -------------------------
  // Only the main window's own pages may call in.
  function handle(channel, fn) {
    ipcMain.handle(channel, (event, ...args) => {
      if (!win || event.sender !== win.webContents || !isAppPage(event.senderFrame?.url || '', pages)) {
        throw new Error(`${channel}: not allowed from this page`);
      }
      return fn(...args);
    });
  }
  const withQr = (info) => ({ ...info, qrSvg: info.url ? qrSvg(info.url) : '' });
  const bool = (v, what) => {
    if (typeof v !== 'boolean') throw new TypeError(`${what} takes true or false`);
    return v;
  };

  handle('link:info', () => withQr(link.info()));
  handle('link:allowNew', (on) => {
    settings.set({ allowNewPhones: bool(on, 'link:allowNew') });
    return withQr(link.setAllowNew(on));
  });
  handle('link:rotate', () => withQr(link.rotateToken()));
  handle('link:send', (player, msg) => {
    if (!Number.isInteger(player) || player < 1 || player > 8 || !msg || typeof msg !== 'object') return false;
    // rebuilt with the protocol's own builders, so nothing else rides along to a phone
    if (msg.t === 'haptic') return link.send(player, haptic(msg.ms, msg.k));
    if (msg.t === 'state') return link.send(player, state(msg));
    return false;
  });
  handle('app:settings:get', () => settings.get());
  handle('app:settings:set', (partial) => {
    if (!partial || typeof partial !== 'object' || Array.isArray(partial)) throw new TypeError('app:settings:set takes an object');
    const next = settings.set(partial);
    link.setAllowNew(next.allowNewPhones);
    return next;
  });
  // with no argument it only answers whether the window is full screen
  handle('app:fullscreen', (on) => {
    if (on === undefined) return win.isFullScreen();
    win.setFullScreen(bool(on, 'app:fullscreen'));
    settings.set({ fullscreen: on });
    return on;
  });
  handle('app:gpu', () => app.getGPUInfo('basic'));
  handle('app:ready', () => (SMOKE ? smokeCheck() : undefined));
  handle('app:quit', () => { app.quit(); });
  handle('audio:support', () => systemAudioSupport({ platform: process.platform, release: os.release() }));

  // ---- the smoke test --------------------------------------------------------------
  const smokeTimer = SMOKE ? setTimeout(() => finishSmoke(false, `the renderer did not report ready within ${SMOKE_LIMIT_MS / 1000} s`), SMOKE_LIMIT_MS) : null;

  async function smokeCheck() {
    if (smokeDone) return;
    // asked while the renderer waits for this reply, so a page that is about to hand over
    // to the classic engine still answers
    const engine = await win.webContents.executeJavaScript(`(() => {
      const d = window.TACTILUME_DESKTOP;
      if (!d) return 'no test hook';
      return d.fallback ? 'the classic engine (no WebGPU)' : 'WebGPU on ' + (d.engine.caps.adapter.description || d.engine.caps.adapter.vendor || 'an unnamed adapter');
    })()`).catch((e) => `unknown (${e.message})`);
    const { port, running } = link.info();
    const status = running ? await httpStatus(port).catch((e) => e.message) : 'not running';
    const ok = status === 200;
    finishSmoke(ok, `renderer ready with ${engine}; GET / on the phone link (port ${port}) gave ${status}`);
  }

  async function finishSmoke(ok, detail) {
    if (smokeDone) return;
    smokeDone = true;
    clearTimeout(smokeTimer);
    const webgpu = app.getGPUFeatureStatus().webgpu;
    console.log(`smoke ${ok ? 'ok' : 'FAILED'}: ${detail} (Chromium reports WebGPU ${webgpu})`);
    await link?.stop().catch(() => {});
    if (win && !win.isDestroyed()) win.destroy();
    try { fs.rmSync(smokeProfile, { recursive: true, force: true }); } catch { /* the OS cleans its temp folder */ }
    app.exit(ok ? 0 : 1);
  }

  // ---- start up ----------------------------------------------------------------------
  app.whenReady().then(async () => {
    const ses = session.defaultSession;
    ses.setPermissionRequestHandler((contents, permission, callback) => callback(contents === win?.webContents && PERMISSIONS.has(permission)));
    ses.setPermissionCheckHandler((contents, permission) => PERMISSIONS.has(permission));
    installDisplayMedia(ses, { platform: process.platform, release: os.release(), desktopCapturer });

    const s = settings.get();
    link = createLinkServer({
      port: s.linkPort,
      staticDir: path.join(dist, 'phone'),
      allowNew: s.allowNewPhones,
      onEvent: (e) => toRenderer('link:event', e),
      log,
    });
    try {
      await link.start();
    } catch (e) {
      // the light still plays without phones; the phone panel shows the link as off
      console.error(`The phone link could not start: ${e.message}`);
    }

    win = createMainWindow(BrowserWindow, {
      preload: path.join(dist, 'preload.cjs'),
      pages,
      bounds: s.bounds,
      fullscreen: s.fullscreen,
      args: [`--tactilume-version=${app.getVersion()}`],
    });
    win.on('close', () => { if (!SMOKE && !win.isFullScreen()) settings.set({ bounds: win.getNormalBounds() }); });
    win.on('closed', () => { win = null; });
    win.webContents.on('did-fail-load', (e, code, text, url, isMainFrame) => {
      // -3 is a load cut short by the next one, such as the hand-over to the classic engine
      if (!isMainFrame || code === -3) return;
      console.error(`Could not load ${url}: ${text}`);
      if (SMOKE) finishSmoke(false, `could not load ${url} (${text})`);
    });
    win.webContents.on('render-process-gone', (e, d) => {
      console.error(`The renderer stopped: ${d.reason}`);
      if (SMOKE) finishSmoke(false, `the renderer stopped (${d.reason})`);
    });
    // a failed load is reported by did-fail-load above
    win.loadFile(path.join(dist, 'renderer', 'index.html')).catch(() => {});
  }).catch((e) => {
    console.error(e);
    if (SMOKE) finishSmoke(false, `start-up failed: ${e.message}`);
  });
}

function httpStatus(port) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 5000 }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('timeout', () => req.destroy(new Error('timed out')));
    req.on('error', reject);
  });
}
