// The app as a whole: it boots on WebGPU and reads back what it draws, and it hands over to
// the classic engine when WebGPU is missing.
//
// First version, written by the spine. The shell-ui part owns this file and adds to it.

const CENTRE = { x0: 0.4, y0: 0.4, x1: 0.6, y1: 0.6 };
const HOOK_PARTS = ['engine', 'hub', 'store', 'audio', 'ui', 'actions', 'bridge'];
const ACTIONS = ['nextBehaviour', 'setBehaviour', 'nextPalette', 'nextPreset', 'surprise', 'clear', 'pulse', 'adjust', 'toggleUI', 'togglePhonePanel', 'toggleFullscreen', 'toast'];

// The classic engine is up: its own test hook says ready, on the classic page.
const classicReady = () => location.pathname.endsWith('/classic/index.html') && window.TACTILUME?.ready === true;

export default [
  {
    name: 'app boot: it runs on WebGPU and reads back its picture',
    async run(page, h) {
      await h.open(page);
      const t = await page.evaluate(({ parts, actions }) => {
        const d = window.TACTILUME_DESKTOP;
        return {
          fallback: d.fallback,
          version: d.version,
          caps: d.engine.caps,
          stats: d.engine.stats,
          missingParts: parts.filter((k) => !d[k]),
          missingActions: actions.filter((k) => typeof d.actions[k] !== 'function'),
          told: window.__tlShim?.ready === true,
        };
      }, { parts: HOOK_PARTS, actions: ACTIONS });

      const checks = [
        h.check('it runs on WebGPU, not the fallback', !t.fallback && t.caps.backend === 'webgpu', t.caps),
        h.check('present=0 keeps it offscreen', t.caps.presenting === false && t.stats.presenting === false, t.caps),
        h.check('particles=20000 sets the particle count', t.stats.particles === 20000, t.stats),
        h.check('the test hook has every part', !t.missingParts.length, `missing: ${t.missingParts.join(', ')}`),
        h.check('every action is there', !t.missingActions.length, `missing: ${t.missingActions.join(', ')}`),
        h.check('the bridge was told the renderer is ready', t.told),
        h.check('the frame loop keeps running', await h.waitFrames(page, 5)),
      ];

      const before = await h.capture(page, { region: CENTRE });
      checks.push(h.check('the picture read back is the size of the drawing', before.width === t.stats.width && before.height === t.stats.height && before.width > 0, { before, stats: t.stats }));
      await page.evaluate(() => window.TACTILUME_DESKTOP.actions.pulse(0, 0, 1.5));
      await h.waitFrames(page, 2);
      const after = await h.capture(page, { region: CENTRE });
      checks.push(h.check('a pulse at the centre lights up the centre', after.mean > before.mean + 2, { before: before.mean, after: after.mean }));

      // Headless Chromium breaks the device of anything that presents, and the engine then
      // recovers offscreen within milliseconds, so caps.presenting alone can miss a renderer
      // that ignored present=0. A canvas never given a WebGPU context still offers a 2D one.
      // (Last, because taking the 2D context uses the canvas up.)
      const untouched = await page.evaluate(() => document.getElementById('stage').getContext('2d') !== null);
      checks.push(h.check('present=0 never gives the canvas a WebGPU context', untouched));
      return checks;
    },
  },
  {
    name: 'app fallback: without WebGPU the classic engine runs',
    async run(page, h) {
      // webgpu=0 forces the hand-over
      await page.goto(h.url({ webgpu: '0' }));
      const forced = await h.until(page, classicReady, undefined, 30000);
      const address = new URL(page.url()).searchParams;
      const checks = [
        h.check('webgpu=0 hands over to the classic engine, which starts', forced, page.url()),
        h.check('the hand-over marks it as the desktop and keeps the test settings', address.get('desktop') === '1' && address.get('test') === '1' && address.get('particles') === '20000', page.url()),
      ];
      const f0 = forced ? await page.evaluate(() => window.TACTILUME.frames) : 0;
      checks.push(h.check('the classic engine keeps drawing', forced && await h.until(page, (f) => window.TACTILUME.frames >= f + 3, f0)));

      // a browser that has no WebGPU at all finds that out by itself
      const bare = await h.context.newPage();
      await bare.addInitScript(() => Object.defineProperty(Navigator.prototype, 'gpu', { configurable: true, get: () => undefined }));
      await bare.goto(h.url());
      checks.push(h.check('with no navigator.gpu it hands over as well', await h.until(bare, classicReady, undefined, 30000), bare.url()));
      return checks;
    },
  },
];
