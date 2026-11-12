// Browser scenarios, run by tests/run.js. Each one is
//   { name, viewport?, dpr?, mobile?, touch?, query?, needsEngine?, open?, run(page, context, h) }
// and returns a list of checks ({name, ok, info}). The runner has already opened the app
// in `page` and waited for window.TACTILUME.ready (unless `open: false`); `context` is the
// Playwright browser context; `h` is the helpers object from tests/helpers.js.
//
// Only what CONTRACTS.md and main.js promise is asserted here, so a module can change
// how it works inside without breaking these.
import { isDeepStrictEqual } from 'node:util';
import { SCHEMA, sanitizeScene, encodeScene } from '../src/js/core/scene.js';
import { presetScene, DEFAULT_PRESET } from '../src/js/core/presets.js';
import { behaviourFor } from '../src/js/core/behaviours.js';

const STORAGE_KEY = 'tactilume.v1';
const b64url = (text) => Buffer.from(text, 'utf8').toString('base64url');

// The fields where two scenes differ, for check messages.
const sceneDiff = (a, b) => SCHEMA.filter((f) => !isDeepStrictEqual(a?.[f.key], b?.[f.key])).map((f) => `${f.key}: ${JSON.stringify(a?.[f.key])} vs ${JSON.stringify(b?.[f.key])}`);
const readScene = (page) => page.evaluate(() => ({ ...window.TACTILUME.store.scene, chords: [...window.TACTILUME.store.scene.chords] }));
const readSaved = (page) => page.evaluate((key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }, STORAGE_KEY);

// Size, scroll and canvas placement: what a full-screen toy must get right everywhere.
const layout = (page) => page.evaluate(() => {
  const r = document.getElementById('stage').getBoundingClientRect();
  const de = document.documentElement;
  return {
    w: innerWidth, h: innerHeight, dpr: devicePixelRatio,
    canvas: { left: r.left, top: r.top, width: r.width, height: r.height },
    scrollW: Math.max(de.scrollWidth, document.body.scrollWidth),
    scrollH: Math.max(de.scrollHeight, document.body.scrollHeight),
    aspect: window.TACTILUME.engine.aspect,
    stats: window.TACTILUME.engine.stats,
    touchAction: getComputedStyle(document.getElementById('stage')).touchAction,
  };
});

function layoutChecks(h, L) {
  const c = L.canvas;
  return [
    h.check('the canvas fills the window', Math.abs(c.left) < 1 && Math.abs(c.top) < 1 && Math.abs(c.width - L.w) < 1 && Math.abs(c.height - L.h) < 1, L),
    h.check('the page does not scroll', L.scrollW <= L.w && L.scrollH <= L.h, L),
    h.check('engine.aspect is width / height', Math.abs(L.aspect - L.w / L.h) < 0.01 * (L.w / L.h), L),
    h.check('the drawing buffer has the window\'s shape', L.stats.width > 0 && L.stats.height > 0 && Math.abs(L.stats.width / L.stats.height - L.w / L.h) < 0.03 * (L.w / L.h), L.stats),
    // main.js caps the device pixel ratio at 2
    h.check('the drawing buffer is at most twice the CSS size', L.stats.width <= Math.ceil(L.w * 2) && L.stats.height <= Math.ceil(L.h * 2), L.stats),
  ];
}

export default [
  {
    name: 'boot',
    async run(page, context, h) {
      const c = [h.check('ready within 20 s', h.bootMs <= 20000, `${h.bootMs} ms`)];
      const info = await page.evaluate(() => {
        const t = window.TACTILUME;
        return {
          version: t.version, test: t.test, ready: t.ready, fingers: t.fingers, active: t.pointers.active(),
          behaviour: t.behaviour, stats: t.engine.stats, caps: t.engine.caps, settings: t.store.settings,
          fatalHidden: document.getElementById('fatal').hidden, fatal: document.getElementById('fatal').textContent,
        };
      });
      c.push(h.check('the test hook is up', info.ready === true && info.test === true && /^\d+\.\d+\.\d+$/.test(info.version), info));
      c.push(h.check('no fatal message', info.fatalHidden, info.fatal));
      c.push(h.check('frames advance', await h.waitFrames(page, 5), await h.state(page)));

      const scene = await readScene(page);
      const preset = presetScene(DEFAULT_PRESET);
      c.push(h.check('a first visit starts on the default preset', isDeepStrictEqual(scene, preset), sceneDiff(scene, preset)));
      c.push(h.check('test mode settings are applied', info.settings.autopilot === 'off' && info.settings.introSeen === true && info.settings.haptics === false, info.settings));
      c.push(h.check('nobody is touching', info.fingers === 0 && info.active === 0, info));
      c.push(h.check('the behaviour starts on the one-finger one', info.behaviour.b === behaviourFor(scene, 1).key && info.behaviour.mix === 1, info.behaviour));

      const { stats, caps } = info;
      c.push(h.check('engine.caps is sane', ['low', 'mid', 'high', 'ultra'].includes(caps.tier) && typeof caps.renderer === 'string' && typeof caps.halfFloat === 'boolean' && caps.maxParticles > 0, caps));
      c.push(h.check('engine.stats is sane', Number.isInteger(stats.particles) && stats.particles > 0 && stats.particles <= caps.maxParticles && stats.renderScale > 0 && stats.renderScale <= 1 && Number.isInteger(stats.width) && Number.isInteger(stats.height), stats));
      c.push(h.check('the particle count follows ?particles', Math.abs(stats.particles - 24000) <= 2400, stats));
      c.push(...layoutChecks(h, await layout(page)));

      // world units: y is 1 at the top and -1 at the bottom, x runs -aspect..aspect
      const map = await page.evaluate(() => {
        const e = window.TACTILUME.engine, W = innerWidth, H = innerHeight;
        const at = (px, py) => e.screenToWorld(px, py);
        const pts = [[W / 2, H / 2], [W * 0.2, H * 0.3], [W * 0.85, H * 0.75], [W * 0.5, H * 0.1]];
        const roundTrip = Math.max(...pts.map(([px, py]) => { const w = at(px, py); const s = e.worldToScreen(w.x, w.y); return Math.hypot(s.px - px, s.py - py); }));
        return { aspect: e.aspect, centre: at(W / 2, H / 2), top: at(W / 2, 0).y, bottom: at(W / 2, H).y, left: at(0, H / 2).x, right: at(W, H / 2).x, roundTrip };
      });
      c.push(h.check('screenToWorld and worldToScreen agree', map.roundTrip < 1.5, map));
      c.push(h.check('the centre of the screen is the world origin', Math.hypot(map.centre.x, map.centre.y) < 0.06, map));
      c.push(h.check('y runs from -1 at the bottom to 1 at the top', Math.abs(map.top - 1) < 0.1 && Math.abs(map.bottom + 1) < 0.1, map));
      c.push(h.check('x runs from -aspect to aspect', Math.abs(map.right - map.aspect) < 0.1 * map.aspect && Math.abs(map.left + map.aspect) < 0.1 * map.aspect, map));
      return c;
    },
  },

  {
    name: 'renders light',
    needsEngine: true,
    async run(page, context, h) {
      await h.wait(2000);
      const a = await h.shot(page);
      const la = h.light(a);
      await h.waitFrames(page, 4);
      const b = await h.shot(page);
      const change = h.difference(a, b);
      return [
        h.check('the screen is not black', la.mean > 3 && la.lit > 0.03, la),
        h.check('the screen is not blown out to white', la.mean < 200, la),
        h.check('the light moves', change > 0.2, { change }),
        h.check('there is light away from the centre too', h.light(a, { region: { x0: 0, y0: 0, x1: 0.33, y1: 1 } }).lit > 0.01, h.light(a, { region: { x0: 0, y0: 0, x1: 0.33, y1: 1 } })),
      ];
    },
  },

  {
    name: 'touch counts',
    touch: true,
    async run(page, context, h) {
      const c = [];
      const cdp = await context.newCDPSession(page);
      const { w, h: ht } = await layout(page);
      const cx = Math.round(w / 2), cy = Math.round(ht / 2);
      const settle = async () => {
        await h.wait(500);
        return h.until(page, () => window.TACTILUME.fingers === 0 && window.TACTILUME.pointers.active() === 0, undefined, 1500);
      };

      for (const n of [1, 2, 3, 5]) {
        const start = h.ring(n, cx, cy, n === 1 ? 0 : 120);
        await h.touch(cdp, start);
        // real fingers never hold perfectly still
        const pts = await h.drag(cdp, start, 14, 8, 3, 50);
        const counted = await h.until(page, (n) => window.TACTILUME.fingers === n, n, 8000);
        const st = await page.evaluate(({ n, pts }) => {
          const t = window.TACTILUME, s = t.store.scene;
          const held = t.pointers.poles().filter((p) => p.held);
          const want = pts.map((p) => t.engine.screenToWorld(p.x, p.y));
          // how far each finger's pole is from where the finger is, in world units
          const misses = want.map((q) => Math.min(...held.map((p) => Math.hypot(p.x - q.x, p.y - q.y))));
          return {
            fingers: t.fingers, active: t.pointers.active(), b: t.behaviour.b,
            expected: s.lock !== 'auto' ? s.lock : s.chords[n - 1],
            kinds: [...new Set(held.map((p) => p.kind))], powers: held.map((p) => p.power), worstMiss: Math.max(...misses),
          };
        }, { n, pts });
        c.push(h.check(`${n} touches count as ${n} fingers`, counted && st.fingers === n, st));
        c.push(h.check(`${n} touches are ${n} active pointers`, st.active === n, st));
        c.push(h.check(`${n} fingers play ${st.expected}`, st.b === st.expected, st));
        c.push(h.check(`${n} touches make poles where the fingers are`, st.kinds.join() === 'touch' && st.worstMiss < 0.06 && st.powers.every((p) => p > 0 && p <= 2), st));
        if (n === 2) {
          const blended = await h.until(page, () => window.TACTILUME.behaviour.mix === 1, undefined, 5000);
          c.push(h.check('a behaviour change crossfades to the end', blended, await h.state(page)));
        }
        await h.lift(cdp);
        c.push(h.check(`lifting ${n} fingers returns to 0 after half a second`, await settle(), await h.state(page)));
      }

      // the contract allows at most ten live touches
      const twelve = Array.from({ length: 12 }, (_, i) => ({ x: Math.round(cx - 330 + i * 60), y: cy, id: i + 1 }));
      await h.touch(cdp, twelve);
      await h.drag(cdp, twelve, 0, 10, 2, 50);
      await h.waitFrames(page, 3);
      const st12 = await page.evaluate(() => ({ fingers: window.TACTILUME.fingers, active: window.TACTILUME.pointers.active(), b: window.TACTILUME.behaviour.b, top: window.TACTILUME.store.scene.chords[9] }));
      c.push(h.check('twelve touches count as ten fingers', st12.fingers === 10 && st12.active === 10, st12));
      c.push(h.check('ten fingers play the tenth behaviour', st12.b === st12.top, st12));
      await h.lift(cdp);
      c.push(h.check('lifting twelve fingers returns to 0', await settle(), await h.state(page)));

      // a locked behaviour plays for any number of fingers; a custom finger table is read
      for (const [set, n, want] of [[{ lock: 'storm' }, 2, 'storm'], [{ lock: 'auto', chords: ['nova', 'fountain'] }, 2, 'fountain']]) {
        await page.evaluate((set) => window.TACTILUME.store.setScene(set, { source: 'test' }), set);
        const pts = h.ring(n, cx, cy, 100);
        await h.touch(cdp, pts);
        await h.drag(cdp, pts, 6, 6, 2, 50);
        const ok = await h.until(page, (want) => window.TACTILUME.behaviour.b === want, want, 5000);
        c.push(h.check(`${JSON.stringify(set)} with ${n} fingers plays ${want}`, ok, await h.state(page)));
        await h.lift(cdp);
        await settle();
      }
      return c;
    },
  },

  {
    name: 'share link round trip',
    async run(page, context, h) {
      const c = [];
      const want = { speed: 0.55, symmetry: 5, mirror: true, palette: 'aurora', lock: 'halo', hue: 0.25, trails: 0.8, form: 'ring', name: 'Round trip', chords: ['nova', 'burst', 'chime'] };
      const { code, scene } = await page.evaluate((want) => {
        const s = window.TACTILUME.store;
        s.setScene(want, { replace: true, source: 'test' });
        const out = { code: s.shareCode(), scene: { ...s.scene, chords: [...s.scene.chords] } };
        // put a different scene in storage, so the next page can only get this one from the link
        window.TACTILUME.actions.loadPreset('first-light');
        s.flush();
        return out;
      }, want);
      c.push(h.check('the scene took the values', isDeepStrictEqual(scene, sanitizeScene(want)), sceneDiff(scene, sanitizeScene(want))));
      c.push(h.check('the share code is short and URL-safe', /^1[A-Za-z0-9_-]+$/.test(code) && code.length < 300, code));

      const linked = await context.newPage();
      await h.open(linked, { hash: '#s=' + code });
      const got = await readScene(linked);
      c.push(h.check('a share link opens the same scene', isDeepStrictEqual(got, scene), sceneDiff(got, scene)));

      // changing the hash on an open page loads the new scene
      const other = sanitizeScene({ palette: 'koi', symmetry: 3, name: 'Koi again' });
      await linked.evaluate((code) => { location.hash = '#x=1&s=' + code; }, encodeScene(other));
      const switched = await h.until(linked, () => window.TACTILUME.store.scene.palette === 'koi', undefined, 5000);
      const got2 = await readScene(linked);
      c.push(h.check('a new link in the address bar loads its scene', switched && isDeepStrictEqual(got2, other), sceneDiff(got2, other)));
      c.push(h.check('the app keeps drawing after a link', await h.waitFrames(linked, 3)));

      // a pasted link or bare code (Scenes > Open a shared scene) opens the scene too
      const pasted = await linked.evaluate((code) => {
        const t = window.TACTILUME;
        const link = t.actions.openShared('Look at this: https://example.org/Tactilume.html#s=' + code + ' !');
        const linkPalette = t.store.scene.palette;
        t.actions.loadPreset('first-light');
        const bare = t.actions.openShared('  ' + code + '\n');
        const barePalette = t.store.scene.palette;
        const junk = [t.actions.openShared('hello'), t.actions.openShared(''), t.actions.openShared('#s=garbage')];
        return { link: link.ok, linkPalette, bare: bare.ok, barePalette, junk: junk.map((r) => r.ok), after: t.store.scene.palette };
      }, code);
      c.push(h.check('a pasted link inside text opens its scene', pasted.link && pasted.linkPalette === 'aurora', JSON.stringify(pasted)));
      c.push(h.check('a pasted bare code opens its scene', pasted.bare && pasted.barePalette === 'aurora', JSON.stringify(pasted)));
      c.push(h.check('pasted text that is not a scene is refused and changes nothing', pasted.junk.every((ok) => !ok) && pasted.after === 'aurora', JSON.stringify(pasted)));

      await linked.close();

      // Hostile links at start-up, each in a fresh context so nothing saved can mask the
      // result. A link that is not a share code at all leaves the default start.
      const atBoot = {
        garbage: { hash: '#s=garbage', expect: presetScene(DEFAULT_PRESET) },
        'infinite speed, markup palette': { hash: '#s=1' + b64url('{"sp":1e309,"pa":"<img>"}'), expect: sanitizeScene({}) },
      };
      // ...and arriving on an open page. A refused code leaves the scene as it was (null).
      const later = {
        'markup in the name': { hash: '#s=1' + b64url('{"na":"\\"><img src=x onerror=\\"window.__pwned=1\\">"}'), expect: sanitizeScene({ name: '"img src=x onerror="window.__pwned=1"' }) },
        'prototype keys': { hash: '#s=1' + b64url('{"__proto__":{"sp":0.1},"constructor":{"prototype":{"x":1}},"gl":0.2}'), expect: sanitizeScene({ glow: 0.2 }) },
        'a very long code': { hash: '#s=1' + 'A'.repeat(20000), expect: null },
        'not base64': { hash: '#s=1%%%%', expect: null },
        garbage: { hash: '#s=garbage', expect: null },
      };
      const isClean = (p) => p.evaluate(() => !window.__pwned && !document.querySelector('img[src="x"]') && ({}).x === undefined && ({}).sp === undefined);
      let fresh = null;
      for (const [what, { hash, expect }] of Object.entries(atBoot)) {
        if (fresh) await fresh.context().close(); // software rendering is slow: one extra app at a time
        fresh = await (await h.newContext()).newPage();
        let opened = true;
        // fewer particles: these pages only need to boot
        try { await h.open(fresh, { hash, query: '?test=1&particles=4096' }); } catch { opened = false; }
        c.push(h.check(`a hostile link at start (${what}) still boots`, opened));
        if (!opened) return c;
        const s = await readScene(fresh);
        c.push(h.check(`a hostile link at start (${what}) gives a clean scene`, isDeepStrictEqual(s, expect) && await isClean(fresh), sceneDiff(s, expect)));
      }
      for (const [what, { hash, expect }] of Object.entries(later)) {
        const before = await readScene(fresh);
        await fresh.evaluate((hash) => { location.hash = hash; }, hash);
        await h.waitFrames(fresh, 2);
        const s = await readScene(fresh);
        const want = expect || before;
        c.push(h.check(`a hostile link later (${what}) ${expect ? 'gives a clean scene' : 'is ignored'}`, isDeepStrictEqual(s, want) && await isClean(fresh), sceneDiff(s, want)));
      }
      c.push(h.check('the app keeps drawing after hostile links', await h.waitFrames(fresh, 3)));
      return c;
    },
  },

  {
    name: 'settings persist',
    async run(page, context, h) {
      const c = [];
      const settings = { volume: 0.25, calm: true, hints: false, sensitivity: 0.8, uiScale: 1.2 };
      const scene = { palette: 'abyss', speed: 0.7, symmetry: 4, name: 'Kept' };
      await page.evaluate(({ settings, scene }) => {
        window.TACTILUME.store.setSettings(settings, { source: 'test' });
        window.TACTILUME.store.setScene(scene, { source: 'test' });
      }, { settings, scene });

      // reload straight away: the save must happen on the way out, not only after the debounce
      await page.reload();
      await h.ready(page);
      const after = await page.evaluate(() => ({ settings: window.TACTILUME.store.settings, scene: window.TACTILUME.store.scene }));
      c.push(h.check('settings survive a reload', Object.entries(settings).every(([k, v]) => after.settings[k] === v), after.settings));
      c.push(h.check('the scene survives a reload', Object.entries(scene).every(([k, v]) => after.scene[k] === v), after.scene));
      const saved = await readSaved(page);
      c.push(h.check('the save is versioned', saved && saved.v === 1 && typeof saved.scene === 'object' && typeof saved.settings === 'object' && Array.isArray(saved.user), saved));

      // the debounced save lands on its own within a second
      await page.evaluate(() => window.TACTILUME.store.setSettings({ volume: 0.4 }, { source: 'test' }));
      await h.wait(1200);
      const later = await readSaved(page);
      c.push(h.check('changes are saved within a second', later && later.settings && later.settings.volume === 0.4, later && later.settings));

      // a saved scene list survives too
      await page.evaluate(() => { window.TACTILUME.store.saveUserScene('Mine'); window.TACTILUME.store.flush(); });
      await page.reload();
      await h.ready(page);
      const user = await page.evaluate(() => window.TACTILUME.store.userScenes().map((u) => u.name));
      c.push(h.check('saved scenes survive a reload', user.length === 1 && user[0] === 'Mine', user));

      // damaged storage: the app starts fresh instead of failing
      await page.evaluate((key) => localStorage.setItem(key, '{not json'), STORAGE_KEY);
      await page.reload();
      let booted = true;
      try { await h.ready(page); } catch { booted = false; }
      c.push(h.check('damaged storage still boots', booted));
      if (booted) {
        const fresh = await readScene(page);
        c.push(h.check('damaged storage starts on the default preset', isDeepStrictEqual(fresh, presetScene(DEFAULT_PRESET)), sceneDiff(fresh, presetScene(DEFAULT_PRESET))));
      }
      return c;
    },
  },

  {
    name: 'phone portrait',
    viewport: { width: 390, height: 844 },
    dpr: 3,
    mobile: true,
    async run(page, context, h) {
      const L = await layout(page);
      const c = layoutChecks(h, L);
      c.push(h.check('the canvas takes over touch gestures', L.touchAction === 'none', L.touchAction));
      c.push(h.check('the viewport is set for phones', await page.evaluate(() => /width=device-width/.test(document.querySelector('meta[name=viewport]')?.content || ''))));
      c.push(h.check('frames advance', await h.waitFrames(page, 3)));

      const cdp = await context.newCDPSession(page);
      const pts = [{ x: 195, y: 420, id: 1 }];
      await h.touch(cdp, pts);
      await h.drag(cdp, pts, 10, -20, 3, 50);
      c.push(h.check('a touch counts as one finger', await h.until(page, () => window.TACTILUME.fingers === 1, undefined, 8000), await h.state(page)));
      await h.lift(cdp);
      c.push(h.check('lifting it returns to 0', await h.until(page, () => window.TACTILUME.fingers === 0, undefined, 3000), await h.state(page)));

      // turning the phone: the drawing follows the new shape
      await page.setViewportSize({ width: 844, height: 390 });
      const turned = await h.until(page, () => Math.abs(window.TACTILUME.engine.aspect - innerWidth / innerHeight) < 0.02, undefined, 5000);
      await h.waitFrames(page, 2);
      c.push(h.check('turning to landscape resizes the drawing', turned, await layout(page)));
      c.push(...layoutChecks(h, await layout(page)).map((x) => ({ ...x, name: `landscape: ${x.name}` })));
      return c;
    },
  },

  {
    name: 'context loss',
    needsEngine: true,
    async run(page, context, h) {
      const c = [];
      const lost = await page.evaluate(() => {
        // with no options, getContext hands back the context the engine already made
        const gl = document.getElementById('stage').getContext('webgl2');
        const ext = gl && gl.getExtension('WEBGL_lose_context');
        if (!ext) return false;
        window.__loseContext = ext;
        ext.loseContext();
        return true;
      });
      c.push(h.check('the GPU context can be lost on purpose', lost));
      if (!lost) return c;
      await h.wait(800);
      const f1 = await h.frames(page);
      await h.wait(800);
      const f2 = await h.frames(page);
      c.push(h.check('drawing pauses while the context is lost', f2 - f1 <= 1, { f1, f2 }));

      await page.evaluate(() => window.__loseContext.restoreContext());
      c.push(h.check('drawing resumes after the context comes back', await h.until(page, (f) => window.TACTILUME.frames >= f + 5, f2, 20000), { f2, now: await h.frames(page) }));
      await h.wait(1500);
      const st = await h.state(page);
      c.push(h.check('engine.stats is sane after restore', st.stats.particles > 0 && st.stats.width > 0 && st.stats.height > 0, st.stats));
      const l = h.light(await h.shot(page));
      c.push(h.check('light is drawn again after restore', l.mean > 3 && l.lit > 0.03, l));
      return c;
    },
  },

  {
    name: 'hidden tab',
    async run(page, context, h) {
      const c = [];
      const setHidden = (hidden) => page.evaluate((hidden) => {
        if (hidden) {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        } else {
          delete document.hidden;
          delete document.visibilityState;
        }
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);

      // a change still waiting for the debounce is saved the moment the tab hides
      await page.evaluate(() => window.TACTILUME.store.setScene({ speed: 0.4 }, { source: 'test' }));
      await setHidden(true);
      const saved = await readSaved(page);
      c.push(h.check('hiding the tab saves at once', saved && saved.scene && saved.scene.speed === 0.4, saved && saved.scene));

      await h.wait(700); // let a frame already in flight finish
      const f1 = await h.frames(page);
      await h.wait(1200);
      const f2 = await h.frames(page);
      c.push(h.check('no frames are drawn while hidden', f2 === f1, { f1, f2 }));

      await setHidden(false);
      c.push(h.check('frames resume when the tab shows again', await h.until(page, (f) => window.TACTILUME.frames >= f + 3, f2, 10000), { f2, now: await h.frames(page) }));
      return c;
    },
  },

  // ---- beyond the first eight: the rest of what the contracts promise ----------------

  {
    name: 'keyboard',
    async run(page, context, h) {
      const c = [];
      const read = () => page.evaluate(() => { const t = window.TACTILUME, s = t.store.scene; return { fingers: t.fingers, b: t.behaviour.b, symmetry: s.symmetry, mirror: s.mirror, name: s.name, chords: s.chords, open: t.ui.isOpen() }; });
      // the mouse rests away from the canvas edge, as a person's would; keys go to the page
      await page.mouse.move(450, 300);

      await page.keyboard.press('Space');
      c.push(h.check('Space puts a touch down', await h.until(page, () => window.TACTILUME.fingers === 1, undefined, 5000), await read()));
      await page.keyboard.press('Space');
      c.push(h.check('Space again lifts it', await h.until(page, () => window.TACTILUME.fingers === 0, undefined, 5000), await read()));

      for (const [key, n] of [['3', 3], ['0', 10]]) {
        await page.keyboard.down(key);
        const held = await h.until(page, (n) => window.TACTILUME.fingers === n, n, 5000);
        const st = await read();
        c.push(h.check(`holding ${key} plays ${n} fingers`, held && st.b === st.chords[n - 1], st));
        await page.keyboard.up(key);
        c.push(h.check(`letting go of ${key} lifts them`, await h.until(page, () => window.TACTILUME.fingers === 0, undefined, 5000), await read()));
      }

      const before = await read();
      await page.keyboard.press('s');
      await page.keyboard.press('m');
      const after = await read();
      c.push(h.check('S adds a symmetry copy', after.symmetry === before.symmetry + 1, { before: before.symmetry, after: after.symmetry }));
      c.push(h.check('M switches mirror', after.mirror === !before.mirror, { before: before.mirror, after: after.mirror }));

      await page.keyboard.press(']');
      const next = await read();
      await page.keyboard.press('[');
      const back = await read();
      c.push(h.check('] goes to the next scene and [ comes back', next.name !== before.name && back.name === before.name, { before: before.name, next: next.name, back: back.name }));

      await page.keyboard.press('Escape');
      const opened = (await read()).open;
      await page.keyboard.press('Escape');
      const closed = !(await read()).open;
      c.push(h.check('Esc opens the controls and closes them again', opened && closed, { opened, closed }));
      c.push(h.check('the app keeps drawing', await h.waitFrames(page, 2)));
      return c;
    },
  },

  {
    name: 'keyboard play after the controls close',
    async run(page, context, h) {
      const c = [];
      // the keyboard's own touch (Space), where focus is, and whether the controls are open
      const read = () => page.evaluate(() => {
        const t = window.TACTILUME, el = document.activeElement;
        const dot = t.keyboard.poles().find((p) => p.held);
        const focus = el && el.id === 'stage' ? 'the light' : el && el.classList.contains('tl-open') ? 'the open button' : el && el.tagName;
        return { fingers: t.fingers, open: t.ui.isOpen(), focus, x: dot ? dot.x : null };
      });
      const hold = async (key) => {
        await page.keyboard.down(key);
        await h.waitFrames(page, 6);
        await page.keyboard.up(key);
      };
      // Space places the touch at the mouse: rest it mid-screen, away from the edges
      await page.mouse.move(450, 300);

      await page.keyboard.press('Escape');
      const opened = (await read()).open;
      await page.keyboard.press('Escape');
      const closed = await read();
      c.push(h.check('Esc opens the controls and Esc closes them', opened && !closed.open, { opened, closed }));
      c.push(h.check('closing them by key gives focus to the light', closed.focus === 'the light', closed));

      await page.keyboard.press('Space');
      const down = await h.until(page, () => window.TACTILUME.fingers === 1, undefined, 5000);
      const placed = await read();
      c.push(h.check('then Space puts a touch down instead of opening the controls again', down && !placed.open && placed.x !== null, placed));
      await hold('ArrowLeft');
      const left = await read();
      c.push(h.check('and ArrowLeft moves it left', placed.x !== null && left.x < placed.x - 0.02, { before: placed.x, after: left.x }));

      // a plain button keeps Space (Space presses it) but leaves the arrows to the light
      await page.evaluate(() => document.querySelector('.tl-open').focus());
      await hold('ArrowRight');
      const right = await read();
      c.push(h.check('with the open button focused, the arrows still move the touch', right.x > left.x + 0.02 && !right.open, { before: left.x, after: right.x, open: right.open }));
      await page.keyboard.press('Enter');
      const viaButton = (await read()).open;
      await page.keyboard.press('Escape');
      const back = await read();
      c.push(h.check('controls opened from the open button give focus back to it', viaButton && !back.open && back.focus === 'the open button', { viaButton, back }));
      return c;
    },
  },

  {
    name: 'large controls keep every name readable',
    viewport: { width: 360, height: 780 },
    dpr: 2,
    mobile: true,
    async run(page, context, h) {
      const c = [];
      // the longest names chosen, so their ticks take room too
      await page.evaluate(() => {
        const t = window.TACTILUME;
        t.store.setScene({ lock: 'fountain', form: 'lattice', colorBy: 'direction', palette: 'peacock' }, { source: 'test' });
        t.store.setSettings({ quality: 'balanced' }, { source: 'test' });
      });
      // In the device's own font, then in DejaVu Sans, a wide font many Linux systems fall
      // back to (and what GitHub's runners use): names must fit whatever the font.
      for (const font of ['', "'DejaVu Sans'"]) {
        const style = font ? await page.addStyleTag({ content: `#ui#ui { --font: ${font}, sans-serif !important; }` }) : null;
        for (const uiScale of [1, 1.3, 1.6]) {
          const clipped = await page.evaluate(async (uiScale) => {
            const t = window.TACTILUME;
            t.store.setSettings({ uiScale }, { source: 'test' });
            const out = [];
            for (const tab of ['scenes', 'play', 'look', 'motion', 'sound', 'capture', 'settings']) {
              t.ui.open(tab);
              await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
              for (const el of document.querySelectorAll(`#tl-tabpanel-${tab} :is(.tl-opt-text, .tl-swatch-name, .tl-chips .tl-opt)`)) {
                if (el.getClientRects().length && el.scrollWidth > el.clientWidth + 1) out.push(`${tab}: "${el.textContent.trim()}" ${el.scrollWidth} > ${el.clientWidth}`);
              }
            }
            return out;
          }, uiScale);
          c.push(h.check(`no option name is cut short at Control size ${Math.round(uiScale * 100)}%${font ? ` in ${font}` : ''}`, !clipped.length, clipped.join('; ')));
        }
        if (style) await style.evaluate((el) => el.remove());
      }

      // the chips now wrap to fewer columns: Down still moves one row
      await page.evaluate(() => window.TACTILUME.ui.open('play'));
      await page.focus('.tl-chips--behaviours .tl-opt[data-value="well"]');
      await page.keyboard.press('ArrowDown');
      const rove = await page.evaluate(() => {
        const group = document.querySelector('.tl-chips--behaviours');
        const chips = [...group.querySelectorAll('.tl-opt')];
        const cols = getComputedStyle(group).gridTemplateColumns.split(' ').length;
        return { cols, moved: chips.indexOf(document.activeElement) - chips.findIndex((b) => b.dataset.value === 'well') };
      });
      c.push(h.check('Down moves one row in the behaviour chips', rove.cols < 3 && rove.moved === rove.cols, rove));
      return c;
    },
  },

  {
    name: 'hidden controls come back with one tap',
    viewport: { width: 390, height: 844 },
    dpr: 2,
    mobile: true,
    async run(page, context, h) {
      const c = [];
      const openButton = () => page.evaluate(() => {
        const b = document.querySelector('.tl-open'), s = getComputedStyle(b), r = b.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        return { x, y, label: b.getAttribute('aria-label'), opacity: Number(s.opacity), shown: s.visibility === 'visible', tappable: !!hit && b.contains(hit), tabIndex: b.tabIndex, hidden: window.TACTILUME.ui.hidden };
      });
      await page.evaluate(() => window.TACTILUME.actions.toggleUI());
      await h.wait(900); // the button's fade
      const hiddenState = await openButton();
      c.push(h.check('the controls hide', hiddenState.hidden, hiddenState));
      c.push(h.check('the open button stays, faint, in the Tab order and under a finger', hiddenState.shown && hiddenState.opacity > 0.05 && hiddenState.opacity < 0.3 && hiddenState.tappable && hiddenState.tabIndex === 0, hiddenState));
      c.push(h.check('while hidden it is called Show controls', hiddenState.label === 'Show controls', hiddenState));
      await page.touchscreen.tap(hiddenState.x, hiddenState.y);
      const back = await h.until(page, () => !window.TACTILUME.ui.hidden, undefined, 3000);
      const shownState = await openButton();
      c.push(h.check('one tap on it brings the controls back', back, shownState));
      c.push(h.check('and it is called Open controls again', shownState.label === 'Open controls', shownState));
      return c;
    },
  },

  {
    name: 'photo',
    needsEngine: true,
    async run(page, context, h) {
      await h.wait(1000);
      const [download, result] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
        page.evaluate(() => window.TACTILUME.actions.photo()),
      ]);
      const c = [
        h.check('taking a photo reports success', result && result.ok === true, result),
        h.check('the photo is saved as a PNG file', download && /\.png$/i.test(download.suggestedFilename()), download && download.suggestedFilename()),
      ];
      if (!download) return c;
      const file = await download.path();
      const { readFile } = await import('node:fs/promises');
      let img = null;
      try { img = h.decodePNG(await readFile(file)); } catch (e) { c.push(h.check('the photo is a readable PNG', false, String(e.message))); return c; }
      const { w, h: ht } = await layout(page);
      c.push(h.check('the photo has the shape of the screen', img.width >= 200 && Math.abs(img.width / img.height - w / ht) < 0.03 * (w / ht), { photo: [img.width, img.height], screen: [w, ht] }));
      c.push(h.check('the photo is not black', h.light(img).mean > 3, h.light(img)));
      return c;
    },
  },

  {
    name: 'recording',
    needsEngine: true,
    async run(page, context, h) {
      const started = await page.evaluate(() => window.TACTILUME.capture.startRecording({ maxSeconds: 10, withSound: false }));
      const c = [h.check('recording starts', started && started.ok === true, started)];
      if (!started || !started.ok) return c;
      await h.wait(2000);
      const mid = await page.evaluate(() => ({ recording: window.TACTILUME.capture.recording, elapsed: window.TACTILUME.capture.elapsed, mime: window.TACTILUME.capture.mime }));
      c.push(h.check('it says it is recording, and time passes', mid.recording === true && mid.elapsed > 0.5, mid));
      const [download, stopped] = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
        page.evaluate(() => window.TACTILUME.capture.stopRecording()),
      ]);
      c.push(h.check('stopping saves the clip', stopped && stopped.ok === true, stopped));
      c.push(h.check('the clip is a video file', download && /\.(webm|mp4)$/i.test(download.suggestedFilename()), download && download.suggestedFilename()));
      if (download) {
        const { stat } = await import('node:fs/promises');
        const size = (await stat(await download.path())).size;
        c.push(h.check('the clip is not empty', size > 2000, `${size} bytes`));
      }
      c.push(h.check('it is no longer recording', await page.evaluate(() => window.TACTILUME.capture.recording === false)));
      return c;
    },
  },

  {
    name: 'no WebGL 2',
    open: false,
    async run(page, context, h) {
      // a browser or device without WebGL 2: getContext('webgl2') gives null
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function getContext(type, ...rest) {
          return type === 'webgl2' ? null : original.call(this, type, ...rest);
        };
      });
      await page.goto(h.url());
      const shown = await h.until(page, () => { const el = document.getElementById('fatal'); return el && !el.hidden && el.textContent.length > 20; }, undefined, 10000);
      const text = await page.evaluate(() => document.getElementById('fatal').textContent);
      const box = await page.evaluate(() => { const r = document.getElementById('fatal').getBoundingClientRect(); return { w: r.width, h: r.height, inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
      return [
        h.check('a plain message says why it cannot run', shown && /WebGL 2/.test(text), text),
        h.check('the message is on screen', box.w > 0 && box.h > 0 && box.inside, box),
      ];
    },
  },

  {
    // Devices whose WebGL2 cannot render half floats draw 8-bit light. The flash guard
    // used to round its own state away there and hold the screen almost black. Later the
    // light itself came out at a fifth to a seventh of the half-float picture: a cap meant
    // for half floats, and a fade that wiped out anything fainter than one step a frame.
    name: '8-bit light',
    needsEngine: true,
    open: false,
    async run(page, context, h) {
      const c = [];
      // the same scene in half floats, at the same moment, for comparison
      const other = await (await h.newContext()).newPage();
      await h.open(other);
      await h.waitFrames(other, 40, 30000);
      const halfFloat = h.light(await h.shot(other));
      await other.close();

      await page.addInitScript(() => {
        const P = WebGL2RenderingContext.prototype;
        const hidden = /^EXT_color_buffer_(half_)?float$/;
        const get = P.getExtension;
        P.getExtension = function (name) { return hidden.test(name) ? null : get.call(this, name); };
        const list = P.getSupportedExtensions;
        P.getSupportedExtensions = function () { return (list.call(this) || []).filter((n) => !hidden.test(n)); };
        // lets the test stop drawing the light (not the simulation), to watch trails fade
        const draw = P.drawArrays;
        P.drawArrays = function (mode, first, count) {
          if (window.__noLight && mode === this.POINTS && !this.isEnabled(this.RASTERIZER_DISCARD)) return undefined;
          return draw.call(this, mode, first, count);
        };
      });
      await h.open(page);
      const info = await page.evaluate(() => ({ hdr: window.TACTILUME.engine.caps.halfFloat, guard: window.TACTILUME.store.settings.flashGuard }));
      c.push(h.check('the engine took the 8-bit path', info.hdr === false, info));
      c.push(h.check('the flash guard is on', info.guard === true, info));
      await h.waitFrames(page, 40, 30000);
      const ins = await page.evaluate(() => window.TACTILUME.engine.inspect(1));
      const [adapted, shown, exposure] = ins.adapt;
      c.push(h.check('the guard state is real numbers, not rounded to zero', Number.isFinite(adapted) && Number.isFinite(shown) && shown > 0 && exposure > 0.5, ins.adapt));
      const L = h.light(await h.shot(page));
      c.push(h.check('the 8-bit light is clearly visible', L.mean > 8 && L.lit > 0.15, L));
      c.push(h.check('and close to the half-float picture', L.mean > 0.4 * halfFloat.mean && L.lit > 0.5 * halfFloat.lit, { eightBit: L, halfFloat }));

      // the longest trails, then no new light: every trail must still fade all the way to
      // black (in 8 bits a dim pixel times the fade rounds back to itself)
      await page.evaluate(() => window.TACTILUME.store.setScene({ trails: 1 }, { source: 'test' }));
      await h.waitFrames(page, 40, 30000);
      await page.evaluate(() => { window.__noLight = true; });
      await h.waitFrames(page, 150, 60000);
      const dark = h.light(await h.shot(page));
      c.push(h.check('with no new light, the trails fade to black', dark.max <= 8 && dark.mean < 1, dark));
      const after = await page.evaluate(() => window.TACTILUME.engine.inspect(1));
      c.push(h.check('no GL errors', ins.error === 0 && after.error === 0, [ins.error, after.error]));
      return c;
    },
  },
  {
    // A link's scene plays once; what the person does after it survives a reload.
    name: 'link used once',
    open: false,
    async run(page, context, h) {
      const c = [];
      const linked = sanitizeScene({ hue: 0.5, palette: 'abyss', name: 'Linked' });
      await h.open(page, { hash: '#s=' + encodeScene(linked) });
      const first = await page.evaluate(() => ({ hash: location.hash, name: window.TACTILUME.store.scene.name, hue: window.TACTILUME.store.scene.hue }));
      c.push(h.check('the link\'s scene plays', first.name === 'Linked' && first.hue === 0.5, first));
      c.push(h.check('the code leaves the address', first.hash === '', first.hash));
      await page.evaluate(() => {
        window.TACTILUME.store.setScene({ hue: 0.1, name: 'Mine now' }, { source: 'test' });
        window.TACTILUME.store.flush();
      });
      await page.reload();
      await h.ready(page);
      const after = await page.evaluate(() => ({ name: window.TACTILUME.store.scene.name, hue: window.TACTILUME.store.scene.hue }));
      c.push(h.check('a reload keeps the person\'s changes, not the link\'s scene', after.name === 'Mine now' && after.hue === 0.1, after));
      return c;
    },
  },
  {
    // A acts on the autoplay you can see, and says what it did.
    name: 'autoplay key',
    open: false,
    query: '?particles=16000',
    async run(page, context, h) {
      const c = [];
      // skip the first-run intro, so keys go straight to the light
      await page.addInitScript(() => {
        if (!localStorage.getItem('tactilume.v1')) localStorage.setItem('tactilume.v1', JSON.stringify({ v: 1, settings: { introSeen: true } }));
      });
      await h.open(page, { query: '?particles=16000' });
      const autoplay = () => page.evaluate(() => window.TACTILUME.autoplay);
      const toasts = () => page.evaluate(() => (document.querySelector('.tl-toasts') || {}).textContent || '');
      c.push(h.check('autoplay is playing at the start', await h.until(page, () => window.TACTILUME.autoplay === true, undefined, 10000)));
      await page.keyboard.press('a');
      c.push(h.check('A stops the autoplay on screen', await h.until(page, () => window.TACTILUME.autoplay === false, undefined, 5000), await autoplay()));
      c.push(h.check('and says so', /Autoplay off/.test(await toasts()), await toasts()));
      await page.waitForTimeout(1500);
      c.push(h.check('it stays stopped', (await autoplay()) === false));
      await page.keyboard.press('a');
      c.push(h.check('A again starts it', await h.until(page, () => window.TACTILUME.autoplay === true, undefined, 5000)));
      await page.keyboard.press(']');
      c.push(h.check('the next scene is named', /is playing/.test(await toasts()), await toasts()));
      return c;
    },
  },
  {
    // Strength scales how hard touches pull and push. (A strong Well flings light through
    // and out the far side, so how close it gathers is no measure; how fast it moves is.)
    name: 'strength',
    needsEngine: true,
    async run(page, context, h) {
      const c = [];
      const cdp = await context.newCDPSession(page);
      const spread = async (strength) => {
        await page.evaluate((strength) => {
          window.TACTILUME.store.setScene({ lock: 'well', strength, form: 'nebula', flow: 0, speed: 1 }, { source: 'test' });
          window.TACTILUME.engine.reset();
        }, strength);
        await h.waitFrames(page, 3);
        const vp = page.viewportSize();
        await h.touch(cdp, [{ x: vp.width / 2, y: vp.height / 2 }]);
        await h.waitFrames(page, 45, 30000);
        const r = await page.evaluate(() => {
          const ps = window.TACTILUME.engine.inspect(3000).particles;
          return ps.reduce((s, p) => s + Math.hypot(p[4], p[5], p[6]), 0) / ps.length;
        });
        await h.lift(cdp);
        await h.waitFrames(page, 3);
        return r;
      };
      const weak = await spread(0.2);
      const strong = await spread(3);
      c.push(h.check('a strong Well moves the light much faster than a weak one', strong > weak * 1.5, { weakSpeed: weak, strongSpeed: strong }));
      return c;
    },
  },
  {
    // A GPU whose maths differs from the software renderer (a phone) can make a NaN. It must
    // never black out the screen: the shaders drop bad values and the light comes back.
    name: 'recovers from NaN',
    needsEngine: true,
    async run(page, context, h) {
      const c = [];
      await h.waitFrames(page, 20, 30000);
      const before = h.light(await h.shot(page));
      await page.evaluate(() => window.TACTILUME.engine._poison());
      await h.waitFrames(page, 40, 30000);
      const after = h.light(await h.shot(page));
      c.push(h.check('the light is back after NaN reached particles and brightness', after.mean > Math.max(2, before.mean * 0.4) && after.lit > 0.03, { before, after }));
      const d = await page.evaluate(() => window.TACTILUME.engine.diagnose());
      c.push(h.check('no particle is left broken', d.particles.bad === 0, d.particles));
      c.push(h.check('the brightness state is numbers again', d.adapt.every(Number.isFinite) && d.adapt[2] > 0, d.adapt));
      const text = await page.evaluate(() => window.TACTILUME.actions.diagnose());
      c.push(h.check('the Device check report has its key lines', /GPU: /.test(text) && /Screen light: mean \d/.test(text) && /Particles: /.test(text), text.slice(0, 300)));
      return c;
    },
  },
];
