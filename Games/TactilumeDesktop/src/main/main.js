// Electron's main process: settings, the phone link server, the window, the menu, what the
// page may use, and the IPC that the preload exposes to the renderer as window.tactilume.
// See CONTRACTS.md, "main/window.js and main/main.js".
//
//   electron .              play
//   electron . --smoke      start everything, check it, print one line and exit (0 = it works)
//   electron . --devtools   allow the developer tools in a packaged build
//
// The renderer is treated as untrusted: it is sandboxed with no Node, and main checks who sent
// every message and every argument it carries before acting on it.
import { app, BrowserWindow, Menu, dialog, ipcMain, powerSaveBlocker, screen, session, desktopCapturer } from 'electron';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createSettings } from './settings.js';
import { createLinkServer } from './link-server.js';
import { qrSvg } from './qr.js';
import { installDisplayMedia, systemAudioSupport } from './audio-capture.js';
import { allowPermission, applyGpuSwitches, createMainWindow, fitBounds, isAppPage, isOwnTopFrame } from './window.js';
import { haptic, state } from '../shared/protocol.js';

const SMOKE = process.argv.includes('--smoke');
const SMOKE_LIMIT_MS = 30000;
const DEVTOOLS = !app.isPackaged || process.argv.includes('--devtools');
const IS_MAC = process.platform === 'darwin';
const BOUNDS_SAVE_MS = 600;         // a moved or resized window is saved once it has been still this long
const MAX_RELOADS = 3;              // renderer crashes answered by reloading, before giving up
// The settings the renderer may change, and their types. The window's place and full-screen
// state belong to main, which saves them as they change.
const RENDERER_SETTINGS = new Map([['allowNewPhones', 'boolean'], ['forceWebGPU', 'boolean']]);

const dist = path.join(app.getAppPath(), 'dist');
const pages = [path.join(dist, 'renderer'), path.join(dist, 'classic')];

// The smoke test gets its own empty profile: it must not read or change the person's
// settings, and the single-instance lock (held per profile) must not stop it while the app
// is open.
let smokeProfile = null;
if (SMOKE) {
  smokeProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'tactilume-smoke-'));
  app.setPath('userData', smokeProfile);
}

const settings = createSettings(path.join(app.getPath('userData'), 'settings.json'), { log: (line) => console.warn(line) });
applyGpuSwitches(app.commandLine, settings.get());

if (!app.requestSingleInstanceLock()) {
  // the first instance hears 'second-instance' and comes to the front
  app.quit();
} else {
  start();
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const bool = (v, what) => {
  if (typeof v !== 'boolean') throw new TypeError(`${what} takes true or false`);
  return v;
};

function start() {
  let win = null;
  let link = null;
  let quitting = false;
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
  app.on('before-quit', () => {
    quitting = true;
    link?.stop();
  });
  // Every web page Electron makes, not only the main window: no pop-ups, no webviews.
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });

  // ---- IPC: who may call, and what they may send ----------------------------------------
  // Only the main window's own pages, in its top frame (not a frame inside them), may call in.
  function fromAppPage(event) {
    const frame = event.senderFrame;
    return !!win && !win.isDestroyed() && event.sender === win.webContents
      && !!frame && !frame.parent && isAppPage(frame.url, pages);
  }
  // `arity`: how many arguments the channel takes; more is a mistake or a probe.
  function handle(channel, arity, fn) {
    ipcMain.handle(channel, (event, ...args) => {
      if (!fromAppPage(event)) throw new Error(`${channel}: not allowed from this page`);
      if (args.length > arity) throw new TypeError(`${channel} takes ${arity ? `at most ${arity} argument${arity > 1 ? 's' : ''}` : 'no arguments'}`);
      return fn(...args);
    });
  }
  const withQr = (info) => ({ ...info, qrSvg: info.url ? qrSvg(info.url) : '' });

  handle('link:info', 0, () => withQr(link.info()));
  handle('link:allowNew', 1, (on) => {
    settings.set({ allowNewPhones: bool(on, 'link:allowNew') });
    return withQr(link.setAllowNew(on));
  });
  handle('link:rotate', 0, () => withQr(link.rotateToken()));
  // Removes one phone for good (the Phone panel asks first). It changes the code too, so the
  // answer carries the new QR code. Only the app's own page may ask (handle checks).
  handle('link:kick', 1, (player) => {
    if (!Number.isInteger(player) || player < 1 || player > 8) throw new TypeError('link:kick takes a player number, 1 to 8');
    const kicked = link.kick(player);
    return { ...withQr(link.info()), kicked };
  });
  handle('link:send', 2, (player, msg) => {
    if (!Number.isInteger(player) || player < 1 || player > 8) throw new TypeError('link:send takes a player number, 1 to 8');
    if (!isPlainObject(msg)) throw new TypeError('link:send takes a message object');
    // rebuilt with the protocol's own builders, so nothing else rides along to a phone
    if (msg.t === 'haptic') {
      if (!Number.isFinite(msg.ms) || !Number.isFinite(msg.k)) throw new TypeError('link:send: a haptic needs ms and k as numbers');
      return link.send(player, haptic(msg.ms, msg.k));
    }
    if (msg.t === 'state') return link.send(player, state(msg));
    throw new TypeError('link:send only sends haptic and state messages');
  });
  handle('app:settings:get', 0, () => settings.get());
  handle('app:settings:set', 1, (partial) => setFromRenderer(partial));
  // with no argument it only answers whether the window is full screen
  handle('app:fullscreen', 1, (on) => {
    if (on === undefined) return win.isFullScreen();
    win.setFullScreen(bool(on, 'app:fullscreen'));
    return on;
  });
  handle('app:gpu', 0, async () => {
    const basic = await app.getGPUInfo('basic').catch(() => ({}));
    return { ...basic, featureStatus: app.getGPUFeatureStatus() };
  });
  handle('app:ready', 0, () => (SMOKE ? smokeCheck() : undefined));
  handle('app:quit', 0, () => { app.quit(); });
  handle('audio:support', 0, () => systemAudioSupport({ platform: process.platform, release: os.release() }));

  function setFromRenderer(partial) {
    if (!isPlainObject(partial)) throw new TypeError('app:settings:set takes an object');
    for (const [key, value] of Object.entries(partial)) {
      const type = RENDERER_SETTINGS.get(key);
      if (!type) throw new TypeError(`app:settings:set: ${key} is not a setting the page may change`);
      if (typeof value !== type) throw new TypeError(`app:settings:set: ${key} takes a ${type}`);
    }
    const before = settings.get();
    const next = settings.set(partial);
    if (next.allowNewPhones !== before.allowNewPhones) link.setAllowNew(next.allowNewPhones);
    if (next.forceWebGPU !== before.forceWebGPU) forceWebGPUChanged();
    return next;
  }

  // ---- forcing WebGPU: it takes a restart ------------------------------------------------
  let askingToRestart = false;
  function forceWebGPUChanged() {
    buildMenu();
    if (SMOKE || !win || askingToRestart) return;
    askingToRestart = true;
    dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      message: 'Restart Tactilume to change its graphics engine?',
      detail: 'Tactilume chooses between WebGPU and its classic engine as it starts. The change applies from the next start.',
    }).then(({ response }) => {
      if (response === 0) {
        app.relaunch();
        app.quit();
      }
    }).catch(() => {}).finally(() => { askingToRestart = false; });
  }

  // ---- the menu --------------------------------------------------------------------------
  // Small on purpose: the light fills the window. On Windows and Linux the bar shows while
  // Alt is held, and its shortcuts work either way. Forcing WebGPU is here as well as in the
  // Settings panel, because the classic engine, which runs when WebGPU is off, has no such
  // setting of its own.
  function buildMenu() {
    const template = [];
    if (IS_MAC) template.push({ role: 'appMenu' });
    else template.push({ label: 'File', submenu: [{ role: 'quit' }] });
    template.push({
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        ...(DEVTOOLS ? [{ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }] : []),
      ],
    });
    template.push({
      label: 'Graphics',
      submenu: [{
        label: 'Force WebGPU on This Computer',
        type: 'checkbox',
        checked: settings.get().forceWebGPU,
        click: (item) => {
          settings.set({ forceWebGPU: item.checked });
          forceWebGPUChanged();
        },
      }],
    });
    if (IS_MAC) template.push({ role: 'windowMenu' });
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  // ---- what the page may use --------------------------------------------------------------
  // Only the main window's own pages, in its top frame, get anything; window.js lists what.
  function installPermissions(ses) {
    const own = (contents, details) => !!win && contents === win.webContents
      && details?.isMainFrame !== false && isAppPage(details?.requestingUrl || '', pages);
    ses.setPermissionRequestHandler((contents, permission, callback, details) => {
      callback(own(contents, details) && allowPermission(permission, details));
    });
    ses.setPermissionCheckHandler((contents, permission, _origin, details) => own(contents, details) && allowPermission(permission, details));
    // HID, serial and USB devices are not used yet (gamepads come through the Gamepad API), so
    // no device is ever granted, and a page that asks to pick one is answered with none.
    ses.setDevicePermissionHandler(() => false);
    ses.on('select-hid-device', (event, _details, callback) => {
      event.preventDefault();
      callback();
    });
    ses.on('select-serial-port', (event, _ports, _contents, callback) => {
      event.preventDefault();
      callback('');
    });
    ses.on('select-usb-device', (event, _details, callback) => {
      event.preventDefault();
      callback();
    });
    // Sharing the screen and the computer's sound skips the picker, so only the app's own
    // top-level page may ask, and the screen shared is the primary one.
    installDisplayMedia(ses, {
      platform: process.platform,
      release: os.release(),
      desktopCapturer,
      allow: (request) => !!win && !win.isDestroyed() && isOwnTopFrame(request?.frame, win.webContents.mainFrame, pages),
      primaryDisplayId: () => screen.getPrimaryDisplay().id,
      log,
    });
  }

  // ---- the window's place and state ----------------------------------------------------
  let boundsTimer = null;
  function saveBounds() {
    clearTimeout(boundsTimer);
    boundsTimer = null;
    // full screen and minimised are not places to come back to
    if (SMOKE || !win || win.isDestroyed() || win.isFullScreen() || win.isMinimized()) return;
    const b = win.getNormalBounds();
    settings.set({ bounds: win.isMaximized() ? { ...b, maximized: true } : b });
  }
  const saveBoundsSoon = () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(saveBounds, BOUNDS_SAVE_MS);
  };
  // Full screen is for watching, so the display is kept from sleeping then; in a window the
  // computer's own power settings apply.
  let awake = null;
  function keepAwake(on) {
    if (on && awake === null) awake = powerSaveBlocker.start('prevent-display-sleep');
    if (!on && awake !== null) {
      powerSaveBlocker.stop(awake);
      awake = null;
    }
  }
  function rememberPlace(w) {
    for (const event of ['resize', 'move', 'maximize', 'unmaximize']) w.on(event, saveBoundsSoon);
    w.on('close', saveBounds);
    w.on('enter-full-screen', () => {
      if (!SMOKE) settings.set({ fullscreen: true });
      keepAwake(true);
    });
    w.on('leave-full-screen', () => {
      if (!SMOKE) settings.set({ fullscreen: false });
      keepAwake(false);
      saveBoundsSoon();
    });
    w.on('closed', () => keepAwake(false));
    // a window that opens full screen may not report entering it
    if (w.isFullScreen()) keepAwake(true);
  }

  // ---- the smoke test --------------------------------------------------------------------
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
    installPermissions(session.defaultSession);
    buildMenu();

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
      // the light still plays without phones; the phone panel says the link is off
      console.error(`The phone link could not start: ${e.message}`);
    }

    win = createMainWindow(BrowserWindow, {
      preload: path.join(dist, 'preload.cjs'),
      pages,
      bounds: fitBounds(s.bounds, screen.getAllDisplays().map((d) => d.workArea)),
      fullscreen: s.fullscreen,
      args: [`--tactilume-version=${app.getVersion()}`],
      devTools: DEVTOOLS,
    });
    rememberPlace(win);
    win.on('closed', () => { win = null; });
    win.webContents.on('did-fail-load', (e, code, text, url, isMainFrame) => {
      // -3 is a load cut short by the next one, such as the hand-over to the classic engine
      if (!isMainFrame || code === -3) return;
      console.error(`Could not load ${url}: ${text}`);
      if (SMOKE) finishSmoke(false, `could not load ${url} (${text})`);
    });
    let reloads = 0;
    win.webContents.on('render-process-gone', (e, d) => {
      console.error(`The renderer stopped: ${d.reason}`);
      if (SMOKE) return finishSmoke(false, `the renderer stopped (${d.reason})`);
      // a crash leaves a black window: start the page again, but not forever
      if (!quitting && d.reason !== 'clean-exit' && reloads++ < MAX_RELOADS) win.webContents.reload();
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
