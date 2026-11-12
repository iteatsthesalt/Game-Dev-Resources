// The window's rules (src/main/window.js): which pages it may show, what those pages may use,
// where a remembered window reopens, the GPU switches, and the security settings it is made
// with. window.js does not import electron, so a stand-in BrowserWindow is enough.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { applyGpuSwitches, isAppPage, isOwnTopFrame, allowPermission, fitBounds, createMainWindow } from '../../src/main/window.js';

const DIST = path.resolve('/opt/tactilume/resources/app.asar/dist');
const PAGES = [path.join(DIST, 'renderer'), path.join(DIST, 'classic')];
const fileUrl = (...parts) => pathToFileURL(path.join(DIST, ...parts)).href;

describe('isOwnTopFrame: who may share the screen and the computer\'s sound', () => {
  const main = { processId: 4, routingId: 1, parent: null, url: fileUrl('renderer', 'index.html') };
  test('the window\'s own top frame on an app page may', () => {
    assert.equal(isOwnTopFrame({ ...main }, main, PAGES), true);
  });
  test('a frame inside it, another window\'s frame, or another page may not', () => {
    assert.equal(isOwnTopFrame({ ...main, parent: main }, main, PAGES), false);
    assert.equal(isOwnTopFrame({ ...main, routingId: 2 }, main, PAGES), false);
    assert.equal(isOwnTopFrame({ ...main, processId: 9 }, main, PAGES), false);
    assert.equal(isOwnTopFrame({ ...main, url: 'https://example.com/' }, { ...main, url: 'https://example.com/' }, PAGES), false);
    assert.equal(isOwnTopFrame(null, main, PAGES), false);
    assert.equal(isOwnTopFrame(main, null, PAGES), false);
  });
});

describe('isAppPage: the only pages the window shows and listens to', () => {
  test('the renderer and the classic engine, with any query or hash', () => {
    assert.equal(isAppPage(fileUrl('renderer', 'index.html'), PAGES), true);
    assert.equal(isAppPage(`${fileUrl('renderer', 'index.html')}?test=1#x`, PAGES), true);
    assert.equal(isAppPage(`${fileUrl('classic', 'index.html')}?desktop=1`, PAGES), true);
  });

  test('not the phone page, the folder itself, or anything outside dist', () => {
    assert.equal(isAppPage(fileUrl('phone', 'index.html'), PAGES), false);
    assert.equal(isAppPage(fileUrl('renderer'), PAGES), false);
    assert.equal(isAppPage(pathToFileURL('/etc/passwd').href, PAGES), false);
    assert.equal(isAppPage(pathToFileURL(path.join(DIST, '..', 'secrets.html')).href, PAGES), false);
  });

  test('a path that climbs out with .. is caught however it is spelled', () => {
    assert.equal(isAppPage(`${pathToFileURL(path.join(DIST, 'renderer')).href}/../../x.html`, PAGES), false);
    assert.equal(isAppPage(`${pathToFileURL(path.join(DIST, 'renderer')).href}/%2e%2e/%2e%2e/x.html`, PAGES), false);
    assert.equal(isAppPage(`${pathToFileURL(path.join(DIST, 'renderer-evil')).href}/index.html`, PAGES), false);
  });

  test('no other kind of address', () => {
    for (const url of ['http://127.0.0.1:47615/', 'https://example.com/', 'javascript:alert(1)', 'data:text/html,<p>hi',
      'about:blank', 'devtools://devtools/', `file://evil-server${path.join(DIST, 'renderer', 'index.html')}`, '', 'not a url', null]) {
      assert.equal(isAppPage(url, PAGES), false, String(url));
    }
  });
});

describe('allowPermission: what the page may use', () => {
  test('the microphone, but never a camera', () => {
    assert.equal(allowPermission('media', { mediaTypes: ['audio'] }), true);
    assert.equal(allowPermission('media', { mediaType: 'audio' }), true);
    assert.equal(allowPermission('media', { mediaTypes: ['video'] }), false);
    assert.equal(allowPermission('media', { mediaTypes: ['audio', 'video'] }), false);
    assert.equal(allowPermission('media', { mediaType: 'video' }), false);
    assert.equal(allowPermission('media', { mediaType: 'unknown' }), false);
    assert.equal(allowPermission('media', { mediaTypes: [] }), false);
    assert.equal(allowPermission('media', {}), false);
    assert.equal(allowPermission('media'), false);
  });

  test('system audio (display capture), full screen and copying the address', () => {
    assert.equal(allowPermission('display-capture', { mediaTypes: ['video', 'audio'] }), true);
    assert.equal(allowPermission('fullscreen', {}), true);
    assert.equal(allowPermission('clipboard-sanitized-write', {}), true);
  });

  test('nothing else: HID is refused for now, and so is everything the light does not need', () => {
    for (const p of ['hid', 'serial', 'usb', 'notifications', 'geolocation', 'midi', 'midiSysex', 'clipboard-read', 'openExternal',
      'pointerLock', 'local-network-access', 'local-network', 'loopback-network', 'window-management', 'idle-detection', 'unknown', '', undefined]) {
      assert.equal(allowPermission(p, { mediaTypes: ['audio'] }), false, String(p));
    }
  });
});

describe('fitBounds: a remembered window reopens where it can be seen', () => {
  const main = { x: 0, y: 0, width: 1920, height: 1040 };
  const left = { x: -2560, y: -200, width: 2560, height: 1400 };

  test('a window that fits is left exactly where it was', () => {
    assert.deepEqual(fitBounds({ x: 100, y: 80, width: 1280, height: 800 }, [main]), { x: 100, y: 80, width: 1280, height: 800 });
    assert.deepEqual(fitBounds({ x: -2000, y: -100, width: 1280, height: 800 }, [main, left]), { x: -2000, y: -100, width: 1280, height: 800 });
  });

  test('a window on a screen that is gone opens centred instead (null)', () => {
    assert.equal(fitBounds({ x: -2000, y: -100, width: 1280, height: 800 }, [main]), null);
    assert.equal(fitBounds({ x: 5000, y: 100, width: 800, height: 600 }, [main]), null);
  });

  test('a title bar above the top of every screen cannot be grabbed, so it is not kept', () => {
    // half the window is on the screen, but not the strip along its top
    assert.equal(fitBounds({ x: 100, y: -300, width: 800, height: 600 }, [main]), null);
    assert.equal(fitBounds({ x: 100, y: -700, width: 800, height: 600 }, [main]), null);
  });

  test('a window whose top edge only just shows is kept if there is enough of it to grab', () => {
    assert.deepEqual(fitBounds({ x: 1800, y: 100, width: 800, height: 600 }, [main]), { x: 1120, y: 100, width: 800, height: 600 });
    assert.equal(fitBounds({ x: 1880, y: 100, width: 800, height: 600 }, [main]), null);
  });

  test('a window hanging off an edge is moved back on, keeping its size', () => {
    assert.deepEqual(fitBounds({ x: 1500, y: 600, width: 800, height: 600 }, [main]), { x: 1120, y: 440, width: 800, height: 600 });
  });

  test('a window bigger than its screen (after a resolution change) shrinks to fit', () => {
    assert.deepEqual(fitBounds({ x: 0, y: 0, width: 2560, height: 1400 }, [main]), { x: 0, y: 0, width: 1920, height: 1040 });
  });

  test('it never shrinks below the smallest window', () => {
    const tiny = { x: 0, y: 0, width: 400, height: 300 };
    assert.deepEqual(fitBounds({ x: 0, y: 0, width: 800, height: 600 }, [tiny]), { x: 0, y: 0, width: 480, height: 320 });
  });

  test('of two screens, the one showing more of the window wins', () => {
    const right = { x: 1920, y: 0, width: 1920, height: 1040 };
    assert.deepEqual(fitBounds({ x: 1700, y: 100, width: 1000, height: 700 }, [main, right]), { x: 1920, y: 100, width: 1000, height: 700 });
  });

  test('a maximised window stays maximised', () => {
    assert.deepEqual(fitBounds({ x: 10, y: 10, width: 800, height: 600, maximized: true }, [main]), { x: 10, y: 10, width: 800, height: 600, maximized: true });
  });

  test('no bounds or no screens: null', () => {
    assert.equal(fitBounds(null, [main]), null);
    assert.equal(fitBounds({ x: 0, y: 0, width: 800, height: 600 }, []), null);
    assert.equal(fitBounds({ x: 0, y: 0, width: 800, height: 600 }, undefined), null);
  });
});

describe('applyGpuSwitches', () => {
  const recorder = () => {
    const switches = [];
    return { switches, appendSwitch: (name, value) => switches.push(value === undefined ? name : `${name}=${value}`) };
  };

  test('nothing changes unless WebGPU is forced on', () => {
    for (const forceWebGPU of [false, undefined, 'true', 1]) {
      const cl = recorder();
      applyGpuSwitches(cl, { forceWebGPU });
      assert.deepEqual(cl.switches, [], String(forceWebGPU));
    }
  });

  test('forced on: past the blocklist, with WebGPU on', () => {
    const cl = recorder();
    applyGpuSwitches(cl, { forceWebGPU: true });
    assert.deepEqual(cl.switches.sort(), ['enable-unsafe-webgpu', 'ignore-gpu-blocklist']);
  });
});

describe('createMainWindow', () => {
  // records what the window was made with and what was hooked up to it
  class FakeWindow {
    constructor(options) {
      this.options = options;
      this.handlers = {};
      this.shown = false;
      this.maximized = false;
      const handlers = {};
      this.webContents = {
        handlers,
        on(name, fn) { (handlers[name] ||= []).push(fn); },
        setWindowOpenHandler(fn) { this.openHandler = fn; },
      };
    }
    once(name, fn) { (this.handlers[name] ||= []).push(fn); }
    emit(name, ...args) { for (const fn of this.handlers[name] || []) fn(...args); }
    show() { this.shown = true; }
    maximize() { this.maximized = true; }
  }
  const make = (opts = {}) => createMainWindow(FakeWindow, { preload: '/app/dist/preload.cjs', pages: PAGES, ...opts });
  const navigate = (win, event, url) => {
    let prevented = false;
    for (const fn of win.webContents.handlers[event]) fn({ preventDefault: () => { prevented = true; } }, url);
    return prevented;
  };

  test('the page is sandboxed and isolated, with no Node, and keeps playing in the background', () => {
    const p = make().options.webPreferences;
    assert.equal(p.contextIsolation, true);
    assert.equal(p.sandbox, true);
    assert.equal(p.nodeIntegration, false);
    assert.equal(p.nodeIntegrationInSubFrames, false);
    assert.equal(p.webSecurity, true);
    assert.equal(p.allowRunningInsecureContent, false);
    assert.equal(p.navigateOnDragDrop, false);
    assert.equal(p.backgroundThrottling, false);
    assert.equal(p.preload, '/app/dist/preload.cjs');
    assert.equal(p.devTools, false, 'no developer tools unless asked for');
    assert.equal(make({ devTools: true }).options.webPreferences.devTools, true);
  });

  test('black, hidden until it has painted, then shown', () => {
    const win = make();
    assert.equal(win.options.backgroundColor, '#000000');
    assert.equal(win.options.show, false);
    assert.equal(win.shown, false);
    win.emit('ready-to-show');
    assert.equal(win.shown, true);
    assert.equal(win.maximized, false);
  });

  test('remembered bounds, full screen and maximised are used', () => {
    const win = make({ bounds: { x: 30, y: 40, width: 900, height: 700, maximized: true } });
    assert.deepEqual([win.options.x, win.options.y, win.options.width, win.options.height], [30, 40, 900, 700]);
    win.emit('ready-to-show');
    assert.equal(win.maximized, true);
    assert.equal(make({ fullscreen: true }).options.fullscreen, true);
    const fresh = make();
    assert.equal('x' in fresh.options, false, 'no bounds: Electron centres it');
  });

  test('it only navigates to its own pages', () => {
    const win = make();
    assert.equal(navigate(win, 'will-navigate', `${fileUrl('classic', 'index.html')}?desktop=1`), false);
    assert.equal(navigate(win, 'will-navigate', 'https://example.com/'), true);
    assert.equal(navigate(win, 'will-navigate', pathToFileURL('/home/someone/music.mp3').href), true);
    assert.equal(navigate(win, 'will-redirect', 'http://192.168.1.2/'), true);
  });

  test('no new windows, no webviews, no Bluetooth device picked behind the person\'s back', () => {
    const win = make();
    assert.deepEqual(win.webContents.openHandler({ url: 'https://example.com/' }), { action: 'deny' });
    let prevented = false;
    for (const fn of win.webContents.handlers['will-attach-webview']) fn({ preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    let chosen = null;
    for (const fn of win.webContents.handlers['select-bluetooth-device']) fn({ preventDefault() {} }, [{ deviceId: 'a' }], (id) => { chosen = id; });
    assert.equal(chosen, '');
  });
});
