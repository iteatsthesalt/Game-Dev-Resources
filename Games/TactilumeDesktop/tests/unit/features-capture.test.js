// main/audio-capture.js: which systems can hear what the computer plays, and the display
// media handler that answers the renderer's getDisplayMedia with the screen and loopback
// audio. Electron's session and desktopCapturer are fakes here.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { systemAudioSupport, installDisplayMedia } from '../../src/main/audio-capture.js';

describe('systemAudioSupport', () => {
  const cases = [
    [{ platform: 'win32', release: '10.0.26100' }, { supported: true, how: 'loopback' }],
    [{ platform: 'darwin', release: '23.2.0' }, { supported: true, how: 'loopback' }],   // macOS 14.2
    [{ platform: 'darwin', release: '24.6.0' }, { supported: true, how: 'loopback' }],   // macOS 15
    [{ platform: 'darwin', release: '25.1.0' }, { supported: true, how: 'loopback' }],   // macOS 26
    [{ platform: 'darwin', release: '23.1.0' }, { supported: false, how: 'none' }],      // macOS 14.1
    [{ platform: 'darwin', release: '22.6.0' }, { supported: false, how: 'none' }],      // macOS 13
    [{ platform: 'darwin', release: 'nonsense' }, { supported: false, how: 'none' }],
    [{ platform: 'darwin' }, { supported: false, how: 'none' }],
    [{ platform: 'linux', release: '6.8.0' }, { supported: true, how: 'monitor-device' }],
    [{ platform: 'freebsd', release: '14.0' }, { supported: false, how: 'none' }],
    [{}, { supported: false, how: 'none' }],
  ];
  for (const [input, want] of cases) {
    test(`${input.platform || 'nothing'} ${input.release || ''} → ${want.how}`, () => {
      assert.deepEqual(systemAudioSupport(input), want);
    });
  }
  test('called with nothing at all, it says none', () => {
    assert.deepEqual(systemAudioSupport(), { supported: false, how: 'none' });
  });
});

describe('installDisplayMedia', () => {
  const SCREENS = [{ id: 'screen:1:0', name: 'Screen 2', display_id: '22' }, { id: 'screen:0:0', name: 'Screen 1', display_id: '11' }];
  const request = (over = {}) => ({ frame: { url: 'file:///app/dist/renderer/index.html' }, securityOrigin: 'file:///', videoRequested: true, audioRequested: true, userGesture: true, ...over });

  // installs the handler on a fake session; → ask(request) → a promise of what the callback got
  function setup({ platform = 'win32', release = '10.0', sources = SCREENS, failSources = false, ...options } = {}) {
    let handler = null;
    const asked = [];
    const session = { setDisplayMediaRequestHandler(fn) { handler = fn; } };
    const desktopCapturer = {
      getSources(opts) {
        asked.push(opts);
        return failSources ? Promise.reject(new Error('no screen recording permission')) : Promise.resolve(sources);
      },
    };
    const lines = [];
    installDisplayMedia(session, { platform, release, desktopCapturer, log: (line) => lines.push(line), ...options });
    const ask = (req = request()) => new Promise((resolve) => handler(req, resolve));
    return { ask, asked, lines, installed: () => typeof handler === 'function' };
  }

  test('on Windows a request with sound gets a screen and loopback audio, without thumbnails', async () => {
    const s = setup();
    const got = await s.ask();
    assert.deepEqual(got, { video: SCREENS[0], audio: 'loopback' });
    assert.deepEqual(s.asked, [{ types: ['screen'], thumbnailSize: { width: 0, height: 0 } }]);
  });

  test('on macOS 14.2 and later the same', async () => {
    const got = await setup({ platform: 'darwin', release: '23.4.0' }).ask();
    assert.equal(got.audio, 'loopback');
  });

  test('it never mutes the speakers (loopbackWithMute)', async () => {
    for (const platform of ['win32', 'darwin']) {
      const got = await setup({ platform, release: '24.0.0' }).ask();
      assert.notEqual(got?.audio, 'loopbackWithMute');
    }
  });

  test('the primary screen is shared when its id is known', async () => {
    const got = await setup({ primaryDisplayId: () => 11 }).ask();
    assert.equal(got.video.id, 'screen:0:0');
    const fallback = await setup({ primaryDisplayId: () => { throw new Error('no screen module'); } }).ask();
    assert.equal(fallback.video.id, 'screen:1:0', 'without it, the first screen listed');
  });

  test('where there is no loopback (Linux, older macOS), nothing is shared and no screen is listed', async () => {
    for (const [platform, release] of [['linux', '6.8.0'], ['darwin', '22.6.0'], ['freebsd', '14']]) {
      const s = setup({ platform, release });
      assert.equal(await s.ask(), null, platform);
      assert.deepEqual(s.asked, [], `${platform}: no getSources, so Wayland shows no screen picker`);
    }
  });

  test('a request without sound is refused: the app never shares only a picture of the screen', async () => {
    const s = setup();
    assert.equal(await s.ask(request({ audioRequested: false })), null);
    assert.equal(await s.ask(null), null);
    assert.deepEqual(s.asked, []);
  });

  test('allow() can refuse a request, for example from a page that is not the app\'s own', async () => {
    const own = (req) => /^file:\/\/\/app\/dist\/renderer\//.test(req.frame?.url || '');
    const s = setup({ allow: own });
    assert.equal((await s.ask()).audio, 'loopback');
    assert.equal(await s.ask(request({ frame: { url: 'https://example.com/' } })), null);
    assert.equal(await s.ask(request({ frame: null })), null, 'a frame that has gone away');
    const throwing = setup({ allow: () => { throw new Error('bad check'); } });
    assert.equal(await throwing.ask(), null, 'a check that throws refuses');
  });

  test('no screens, or no permission to list them, refuses the request and says why', async () => {
    assert.equal(await setup({ sources: [] }).ask(), null);
    const s = setup({ failSources: true });
    assert.equal(await s.ask(), null);
    assert.match(s.lines.join('\n'), /no screen recording permission/);
  });

  test('a callback that throws (its frame has gone) is caught and logged', async () => {
    const s = setup();
    let handler;
    installDisplayMedia({ setDisplayMediaRequestHandler: (fn) => { handler = fn; } }, {
      platform: 'win32', desktopCapturer: { getSources: async () => SCREENS }, log: (l) => s.lines.push(l),
    });
    await new Promise((resolve) => {
      handler(request(), () => { setImmediate(resolve); throw new Error('Render frame was disposed'); });
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.match(s.lines.join('\n'), /disposed/);
  });
});
