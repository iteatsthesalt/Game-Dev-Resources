// Browser scenarios, run by tests/run.js. Each one is
//   { name, viewport?, dpr?, mobile?, touch?, query?, needsEngine?, open?, run(page, context, h) }
// and returns a list of checks ({name, ok, info}). The runner has already opened the app
// in `page` and waited for window.TACTILUME.ready (unless `open: false`); `context` is the
// Playwright browser context; `h` is the helpers object from tests/helpers.js.
//
// Only what CONTRACTS.md and main.js promise is asserted here, so a module can change
// how it works inside without breaking these.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { SCHEMA, sanitizeScene, encodeScene } from '../src/js/core/scene.js';
import { presetScene, DEFAULT_PRESET } from '../src/js/core/presets.js';
import { behaviourFor, behaviourByKey } from '../src/js/core/behaviours.js';

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
      // all that play is healthy: the background check must have found nothing to repair
      // (software rendering is slow, so it may have had time for only one or two checks)
      const d = await page.evaluate(() => window.TACTILUME.engine.diagnose());
      c.push(h.check('the health check found nothing to repair', d.health.heals === 0 && d.simulation !== 'stopped', { health: d.health, simulation: d.simulation }));
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
      const lostAt = Date.now();
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
      // the "light stopped" notice is only for a context that does not come back
      await h.wait(Math.max(0, 4600 - (Date.now() - lostAt)));
      c.push(h.check('no notice when the context comes back', await page.evaluate(() => document.getElementById('fatal').hidden)));

      // a phone may take the context of an app in the background and give it back on return:
      // no notice for that either
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
      await setHidden(true);
      await page.evaluate(() => window.__loseContext.loseContext());
      await h.wait(4600);
      const quiet = await page.evaluate(() => document.getElementById('fatal').hidden);
      await page.evaluate(() => window.__loseContext.restoreContext());
      await h.wait(300);
      const f3 = await h.frames(page);
      await setHidden(false);
      c.push(h.check('a context lost in the background brings no notice', quiet));
      c.push(h.check('and the light resumes when the app is back', await h.until(page, (f) => window.TACTILUME.frames >= f + 5, f3, 20000) && await page.evaluate(() => document.getElementById('fatal').hidden), { f3, now: await h.frames(page) }));
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
      // the Device check reads 8-bit light too (as bytes), so these devices can report it
      c.push(h.check('the scene light can be read back on the 8-bit path', !!ins.scene && ins.scene.mean > 0.001 && ins.scene.lit > 0, ins.scene || 'not read'));
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
      // more than 230 frames: at least two background checks, which compare the particles
      const d = await page.evaluate(() => window.TACTILUME.engine.diagnose());
      c.push(h.check('the health check finds nothing to repair, and sees the particles moving', d.health.checks >= 2 && d.health.heals === 0 && d.simulation === 'moving', { health: d.health, simulation: d.simulation }));
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

  // ---- what a phone GPU, a lost context or a failing frame must not do ------------------

  {
    // A fragment shader's uints default to mediump, which a phone may keep in 16 bits. The
    // brightness state is the bits of 32-bit floats, so it would read back as about 1e-41:
    // a dark screen, with Brightness and the flash guard off. The shaders now ask for
    // highp (tests/unit/shaders.test.js); a device that narrows it anyway must be reported.
    // Emulated here by keeping only the low 16 bits of what the shader writes.
    name: 'a brightness state that loses bits is reported',
    needsEngine: true,
    open: false,
    async run(page, context, h) {
      const c = [];
      await page.addInitScript(() => {
        const P = WebGL2RenderingContext.prototype;
        const source = P.shaderSource;
        P.shaderSource = function (sh, s) {
          const narrowed = s.replace('o = floatBitsToUint(next);', 'o = floatBitsToUint(next) & uvec4(0xffffu);');
          if (narrowed !== s) window.__narrowed = true;
          return source.call(this, sh, narrowed);
        };
      });
      await h.open(page);
      c.push(h.check('(the brightness state is kept in 16 bits here)', await page.evaluate(() => window.__narrowed === true)));
      const flagged = await h.until(page, () => /lost bits/.test(window.TACTILUME.engine.health.lastIssue), undefined, 60000);
      c.push(h.check('the health check reports the lost bits', flagged, await page.evaluate(() => window.TACTILUME.engine.health)));
      const text = await page.evaluate(() => window.TACTILUME.actions.diagnose());
      const lines = text.split('\n').filter((l) => /^(Brightness|Health)/.test(l));
      c.push(h.check('the Device check names it', /last: the brightness state lost bits/.test(text) && !/Brightness state: .*\(OK\)/.test(text), lines.join(' | ')));
      const L = h.light(await h.shot(page));
      c.push(h.check('the light still shows', L.mean > 3 && L.lit > 0.03, L));
      return c;
    },
  },

  {
    // A driver whose transform feedback captures nothing leaves every particle where it was
    // made (here nowhere: all zeros), so the light is a dot or nothing. Say why.
    name: 'a simulation that does not run is reported',
    needsEngine: true,
    open: false,
    async run(page, context, h) {
      await page.addInitScript(() => {
        const P = WebGL2RenderingContext.prototype;
        P.beginTransformFeedback = function () {};
        P.endTransformFeedback = function () {};
      });
      await h.open(page);
      const flagged = await h.until(page, () => /not moving/.test(window.TACTILUME.engine.health.lastIssue), undefined, 60000);
      const text = await page.evaluate(() => window.TACTILUME.actions.diagnose());
      return [
        h.check('the health check reports that the particles do not move', flagged, await page.evaluate(() => window.TACTILUME.engine.health)),
        h.check('the Device check says the simulation is not running', /Simulation: NOT MOVING/.test(text), text.split('\n').filter((l) => /^(Simulation|Particles|Health)/.test(l)).join(' | ')),
      ];
    },
  },

  {
    // A context that never comes back (Chrome stops a page's 3D after GPU crashes) used to
    // leave the controls over a black screen for good, without a word.
    name: 'context lost for good',
    needsEngine: true,
    async run(page, context, h) {
      const c = [];
      const notice = () => page.evaluate(() => {
        const el = document.getElementById('fatal');
        return { shown: !el.hidden, text: el.textContent, button: !!el.querySelector('button'), focus: document.activeElement && document.activeElement.className };
      });
      await page.evaluate(() => {
        window.TACTILUME.store.setScene({ hue: 0.42 }, { source: 'test' });
        document.getElementById('stage').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();
      });
      const shown = await h.until(page, () => !document.getElementById('fatal').hidden, undefined, 6000);
      const n = await notice();
      c.push(h.check('within a few seconds a notice says the light stopped', shown && /stopped/i.test(n.text) && n.button, n));
      c.push(h.check('its button has the focus', n.focus === 'fatal-btn', n));
      await Promise.all([page.waitForEvent('load', { timeout: 20000 }), page.click('#fatal button')]);
      await h.ready(page);
      c.push(h.check('the button starts the light again', await h.waitFrames(page, 5), await h.state(page)));
      c.push(h.check('with the scene kept', await page.evaluate(() => window.TACTILUME.store.scene.hue === 0.42)));
      const l = h.light(await h.shot(page));
      c.push(h.check('and light is drawn', l.mean > 3 && l.lit > 0.03, l));

      // a context that comes back but cannot be rebuilt (no memory left, say) is still lost
      await page.evaluate(() => {
        const P = WebGL2RenderingContext.prototype;
        const make = P.createTransformFeedback;
        P.createTransformFeedback = function () {
          if (window.__noMemory) throw new Error('out of memory (test)');
          return make.call(this);
        };
        window.__lose = document.getElementById('stage').getContext('webgl2').getExtension('WEBGL_lose_context');
        window.__lose.loseContext();
      });
      await h.wait(300);
      await page.evaluate(() => { window.__noMemory = true; window.__lose.restoreContext(); });
      const failed = await h.until(page, () => !document.getElementById('fatal').hidden, undefined, 3000);
      const st = await page.evaluate(() => ({ lost: window.TACTILUME.engine.diagnose().lost, fatal: document.getElementById('fatal').textContent }));
      c.push(h.check('a rebuild that fails says so at once', failed && /stopped/i.test(st.fatal), st));
      c.push(h.check('and the engine still says the context is lost', st.lost === true, st));
      return c;
    },
  },

  {
    // One exception inside a frame used to stop the loop for good: the controls kept
    // working over a frozen light, and nobody was told.
    name: 'a failing frame does not stop the light',
    async run(page, context, h) {
      const c = [];
      await h.waitFrames(page, 3);
      const f0 = await page.evaluate(() => {
        const e = window.TACTILUME.engine, frame = e.frame;
        let once = true;
        e.frame = function (f) {
          if (once) { once = false; throw new Error('a one-off device quirk (test)'); }
          return frame.call(this, f);
        };
        return window.TACTILUME.frames;
      });
      c.push(h.check('after one failed frame the light keeps drawing', await h.until(page, (f) => window.TACTILUME.frames >= f + 10, f0, 30000), { f0, now: await h.frames(page) }));

      // the sound failing on every frame: the light still draws, and the person is told
      const r = await page.evaluate(async () => {
        const t = window.TACTILUME, a = t.audio, e = t.engine;
        const update = a.update, frame = e.frame;
        let draws = 0;
        e.frame = function (f) { draws++; return frame.call(this, f); };
        a.update = () => { throw new Error('a broken sound driver (test)'); };
        const start = t.frames;
        // eight frames, however slow the machine (or 20 s, if the loop has stopped)
        const t0 = performance.now();
        while (t.frames < start + 8 && performance.now() - t0 < 20000) await new Promise((res) => setTimeout(res, 50));
        a.update = update;
        e.frame = frame;
        return { frames: t.frames - start, draws, toasts: (document.querySelector('.tl-toasts') || {}).textContent || '' };
      });
      c.push(h.check('with the sound failing every frame, the light still draws every frame', r.frames >= 5 && r.draws >= r.frames, r));
      c.push(h.check('and the person is told where to look', /hit a problem/.test(r.toasts), r));
      return c;
    },
  },

  {
    // An MP4 clip (H.264 in its avc1 form) cannot change size halfway: from the change on,
    // players show a smeared copy of the old picture. So the clip ends first.
    name: 'turning the screen ends a recording first',
    needsEngine: true,
    viewport: { width: 900, height: 420 },
    async run(page, context, h) {
      const c = [];
      const canvasSize = () => page.evaluate(() => { const s = document.getElementById('stage'); return [s.width, s.height]; });
      await page.evaluate(() => {
        // where the drawing is when the recorder is told to stop
        const stop = MediaRecorder.prototype.stop;
        window.__stops = [];
        MediaRecorder.prototype.stop = function () {
          const s = document.getElementById('stage');
          window.__stops.push({ w: s.width, h: s.height, state: this.state });
          return stop.call(this);
        };
      });
      const started = await page.evaluate(() => window.TACTILUME.capture.startRecording({ maxSeconds: 20, withSound: false }));
      c.push(h.check('recording starts', started && started.ok === true, started));
      const before = await canvasSize();
      await h.wait(1000);
      // a resize that changes nothing keeps the clip going
      await page.evaluate(() => dispatchEvent(new Event('resize')));
      await h.waitFrames(page, 3);
      c.push(h.check('a resize that keeps the size keeps recording', await page.evaluate(() => window.TACTILUME.capture.recording === true)));
      const download = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
      await page.setViewportSize({ width: 420, height: 900 });
      const ended = await h.until(page, () => window.TACTILUME.capture.recording === false, undefined, 5000);
      const st = await page.evaluate(() => ({ stops: window.__stops, toasts: (document.querySelector('.tl-toasts') || {}).textContent || '' }));
      const after = await canvasSize();
      c.push(h.check('turning the screen ends the recording', ended, st));
      c.push(h.check('the recorder stopped before the drawing changed size', st.stops.length === 1 && st.stops[0].state === 'recording' && st.stops[0].w === before[0] && st.stops[0].h === before[1] && after[0] !== before[0], { before, after, stops: st.stops }));
      c.push(h.check('and the person is told why', /changed shape/.test(st.toasts), st.toasts));
      const file = await download;
      c.push(h.check('the clip up to the turn is saved', file && /\.(webm|mp4)$/i.test(file.suggestedFilename()), file && file.suggestedFilename()));
      return c;
    },
  },

  {
    // Quality changes the drawing's resolution, so during a clip the change waits for its
    // end. (A normal start: ?test and a fixed particle count both keep Quality still.)
    name: 'a Quality change waits for the recording to end',
    needsEngine: true,
    open: false,
    viewport: { width: 640, height: 400 },
    async run(page, context, h) {
      const c = [];
      await page.addInitScript(() => {
        if (!localStorage.getItem('tactilume.v1')) localStorage.setItem('tactilume.v1', JSON.stringify({ v: 1, settings: { introSeen: true, autopilot: 'off', haptics: false, quality: 'battery' } }));
      });
      await h.open(page, { query: '' });
      const size = () => page.evaluate(() => { const s = window.TACTILUME.engine.stats; return { w: s.width, h: s.height, scale: s.renderScale }; });
      const started = await page.evaluate(() => window.TACTILUME.capture.startRecording({ maxSeconds: 20, withSound: false }));
      c.push(h.check('recording starts', started && started.ok === true, started));
      // read once recording, when the governor holds still too
      const before = await size();
      c.push(h.check('(Battery draws below full resolution)', before.scale < 1 && before.w < 640, before));
      await page.evaluate(() => window.TACTILUME.store.setSettings({ quality: 'max' }, { source: 'test' }));
      await h.waitFrames(page, 4, 30000);
      const during = await size();
      c.push(h.check('during the recording the drawing keeps its size', during.w === before.w && during.h === before.h, { before, during }));
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }).catch(() => null),
        page.evaluate(() => window.TACTILUME.capture.stopRecording()),
      ]);
      c.push(h.check('the clip is saved', !!download));
      const grew = await h.until(page, () => window.TACTILUME.engine.stats.width === 640, undefined, 10000);
      c.push(h.check('once it ends, Best draws at full resolution', grew, await size()));
      return c;
    },
  },

  {
    // Pins are points in the world, whose x runs -aspect..aspect: turning the phone used to
    // leave a pin far off the narrower screen, still pulling light, still counted, and out
    // of reach. The keyboard's Space touch had the same trouble with a narrower window.
    name: 'pins and the keyboard touch stay on screen when it turns',
    touch: true,
    viewport: { width: 900, height: 420 },
    async run(page, context, h) {
      const c = [];
      const cdp = await context.newCDPSession(page);
      const read = () => page.evaluate(() => {
        const t = window.TACTILUME;
        const pins = t.pointers.poles().filter((p) => p.kind === 'pin' && p.held);
        return {
          w: innerWidth, h: innerHeight, aspect: t.engine.aspect,
          pins: pins.map((p) => { const s = t.engine.worldToScreen(p.x, p.y); return { x: p.x, y: p.y, px: s.px, py: s.py }; }),
        };
      });
      await page.evaluate(() => window.TACTILUME.store.setSettings({ pin: true }, { source: 'test' }));
      await h.tap(cdp, 860, 210, 120);
      await h.until(page, () => window.TACTILUME.pointers.pinCount() === 1, undefined, 3000);
      const before = await read();
      c.push(h.check('a tap near the right edge leaves a pin there', before.pins.length === 1 && Math.abs(before.pins[0].px - 860) < 20, before));
      await page.setViewportSize({ width: 420, height: 900 });
      await h.until(page, () => Math.abs(window.TACTILUME.engine.aspect - innerWidth / innerHeight) < 0.01, undefined, 5000);
      await h.waitFrames(page, 4);
      const after = await read();
      const p = after.pins[0];
      c.push(h.check('after a turn the pin is still on screen, as far across it', !!p && p.px > 0 && p.px < after.w && Math.abs(p.px / after.w - 860 / 900) < 0.05, after));
      if (p) {
        await h.tap(cdp, Math.round(p.px), Math.round(p.py), 120);
        await h.waitFrames(page, 4);
      }
      const tapped = await read();
      c.push(h.check('and a tap where it is now takes it away', tapped.pins.length === 0, tapped));

      // the Space touch, put down at the right of a wide window, then the window narrows
      await page.evaluate(() => window.TACTILUME.store.setSettings({ pin: false }, { source: 'test' }));
      await page.setViewportSize({ width: 1200, height: 500 });
      await h.waitFrames(page, 3);
      await page.mouse.move(1180, 250);
      await page.keyboard.press('Space');
      await h.until(page, () => window.TACTILUME.keyboard.poles().some((q) => q.held), undefined, 3000);
      await page.setViewportSize({ width: 500, height: 900 });
      await h.waitFrames(page, 4);
      const key = await page.evaluate(() => {
        const t = window.TACTILUME, q = t.keyboard.poles().find((x) => x.held);
        return q ? { x: q.x, y: q.y, aspect: t.engine.aspect } : null;
      });
      c.push(h.check('the keyboard touch comes back on screen when the window narrows', !!key && Math.abs(key.x) <= key.aspect && Math.abs(key.y) <= 1, key));
      return c;
    },
  },

  {
    // Moving with sound: a switch that fails must leave what was already playing alone,
    // and an app that is hidden stops listening to the microphone.
    name: 'sound sources: a failed switch keeps the old one, a hidden app stops listening',
    async run(page, context, h) {
      const c = [];
      await page.mouse.click(450, 300); // a gesture, so sound may start
      await page.evaluate(() => {
        // the test decides what the microphone does: refuse, or a made-up live input
        window.__gum = 'deny';
        navigator.mediaDevices.getUserMedia = async () => {
          if (window.__gum === 'deny') throw new DOMException('Permission denied (test)', 'NotAllowedError');
          const ac = new AudioContext();
          const osc = ac.createOscillator();
          const dst = ac.createMediaStreamDestination();
          osc.connect(dst);
          osc.start();
          window.__mic = dst.stream;
          return dst.stream;
        };
      });
      const state = () => page.evaluate(() => ({ ...window.TACTILUME.audio.state(), react: window.TACTILUME.store.settings.react }));
      const song = await page.evaluate(async () => {
        // a 2 s 440 Hz WAV, made here
        const rate = 22050, n = rate * 2;
        const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
        const w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
        w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
        v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
        w(36, 'data'); v.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i * 2 * Math.PI * 440 / rate) * 8000, true);
        return window.TACTILUME.actions.setReact('file', new File([buf], 'tone.wav', { type: 'audio/wav' }));
      });
      const playing = await state();
      c.push(h.check('(a song plays)', song.ok && playing.file && playing.react === 'file', { song, playing }));
      const refused = await page.evaluate(() => window.TACTILUME.actions.setReact('mic'));
      await h.wait(150);
      const afterRefusal = await state();
      c.push(h.check('a refused microphone leaves the song playing, and named', !refused.ok && afterRefusal.file && afterRefusal.react === 'file', { refused, afterRefusal }));

      await page.evaluate(() => { window.__gum = 'allow'; });
      const mic = await page.evaluate(() => window.TACTILUME.actions.setReact('mic'));
      const listening = await state();
      c.push(h.check('(the microphone takes over when it starts)', mic.ok && listening.mic && !listening.file && listening.react === 'mic', { mic, listening }));
      const bad = await page.evaluate(() => window.TACTILUME.actions.setReact('file', new File([new Uint8Array(512)], 'broken.wav', { type: 'audio/wav' })));
      await h.wait(150);
      const afterBad = await state();
      c.push(h.check('a song that cannot play leaves the microphone on, and named', !bad.ok && afterBad.mic && afterBad.react === 'mic', { bad, afterBad }));

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
      const tracks = () => page.evaluate(() => window.__mic.getAudioTracks().map((t) => ({ enabled: t.enabled, state: t.readyState })));
      // a microphone that is live and listened to, then the app is hidden
      if (!(await state()).mic) await page.evaluate(() => window.TACTILUME.actions.setReact('mic'));
      const live = await tracks();
      c.push(h.check('(the microphone is live before the app hides)', live.length > 0 && live.every((t) => t.enabled && t.state === 'live'), live));
      await setHidden(true);
      const hidden = await tracks();
      c.push(h.check('a hidden app stops listening to the microphone', hidden.length > 0 && hidden.every((t) => !t.enabled || t.state === 'ended'), hidden));
      await setHidden(false);
      const shown = await tracks();
      const back = await state();
      c.push(h.check('and listens again when it shows', shown.every((t) => t.enabled && t.state === 'live') && back.mic && back.react === 'mic', { shown, back }));
      return c;
    },
  },

  {
    // Tilt waits for the sensors' first reading. Switched off in that moment, it used to
    // switch itself back on when the reading came. (Timed inside the page: Playwright's
    // own clicks can take longer than the wait.)
    name: 'tilt switched off while it starts stays off',
    async run(page, context, h) {
      await page.evaluate(() => window.TACTILUME.ui.open('sound'));
      await h.wait(300);
      const r = await page.evaluate(async () => {
        const el = [...document.querySelectorAll('input[role=switch]')].find((i) => i.labels[0].textContent === 'Tilt');
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
        const reading = () => window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: 0, y: 9.8, z: 0.4 }, interval: 16 }));
        const notice = () => { const n = el.closest('.tl-field').querySelector('.tl-notice'); return !!n && !n.hidden; };
        const read = () => ({ checked: el.checked, store: window.TACTILUME.store.settings.tilt, notice: notice() });
        el.click(); // on: waiting for a first reading
        await sleep(60);
        el.click(); // off again before it came
        await sleep(60);
        reading();
        await sleep(400);
        const off = read();
        // on, off and on again: the last choice wins, and nothing says tilt is missing
        el.click(); await sleep(40);
        el.click(); await sleep(40);
        el.click(); await sleep(40);
        reading();
        await sleep(400);
        const on = read();
        el.click();
        return { off, on };
      });
      return [
        h.check('switched off before the sensors answered, tilt stays off', !r.off.checked && r.off.store === false && !r.off.notice, r),
        h.check('on, off and on again ends on, without a "not available" notice', r.on.checked && r.on.store === true && !r.on.notice, r),
      ];
    },
  },

  {
    // Pins and the Space touch come before autoplay. A with one down used to say "Autoplay
    // on" with nothing to see, and autoplay later popped in at full strength.
    name: 'autoplay waits for pins, then fades in',
    open: false,
    touch: true,
    query: '?particles=16000',
    async run(page, context, h) {
      const c = [];
      await page.addInitScript(() => {
        if (!localStorage.getItem('tactilume.v1')) localStorage.setItem('tactilume.v1', JSON.stringify({ v: 1, settings: { introSeen: true, haptics: false } }));
      });
      await h.open(page, { query: '?particles=16000' });
      const toasts = () => page.evaluate(() => (document.querySelector('.tl-toasts') || {}).textContent || '');
      await page.evaluate(() => {
        // the strongest autoplay pole each time autoplay is asked, and whether it showed
        const t = window.TACTILUME, ap = t.autopilot, update = ap.update;
        window.__auto = [];
        ap.update = (...a) => {
          const poles = update(...a);
          window.__auto.push({ shown: t.autoplay, power: Math.max(0, ...poles.map((p) => p.power)) });
          return poles;
        };
        t.store.setSettings({ pin: true }, { source: 'test' });
      });
      const cdp = await context.newCDPSession(page);
      await h.tap(cdp, 300, 300, 100);
      await h.until(page, () => window.TACTILUME.pointers.pinCount() === 1, undefined, 3000);
      await h.waitFrames(page, 3);
      await page.keyboard.press('a');
      await h.wait(300);
      const first = { toasts: await toasts(), autoplay: await page.evaluate(() => window.TACTILUME.autoplay) };
      c.push(h.check('A with a pin down says autoplay waits for it', !first.autoplay && /starts when nothing is pinned or held/.test(first.toasts), first));
      await page.keyboard.press('a');
      await h.wait(300);
      c.push(h.check('A again turns that waiting autoplay off', /Autoplay off/.test(await toasts()), await toasts()));
      await page.keyboard.press('a');
      // longer than autoplay's own fade-in (1.5 s of the app's clock, which a slow machine's
      // frames advance by at most 1/20 s each), so a clock that ran on behind the pin would
      // bring it in at full strength
      await h.wait(2500);
      await h.waitFrames(page, 40, 60000);
      // the pins go: autoplay comes in, fading up from nothing
      await page.evaluate(() => { window.__auto.length = 0; window.TACTILUME.actions.clearPins(); });
      const shows = await h.until(page, () => window.TACTILUME.autoplay === true, undefined, 5000);
      await h.waitFrames(page, 2);
      const seen = await page.evaluate(() => window.__auto.find((x) => x.shown));
      c.push(h.check('when the pins go, autoplay shows and fades in (first seen below half strength)', shows && !!seen && seen.power < 0.5, { shows, seen }));
      return c;
    },
  },

  {
    // The Android app lets in WebViews from Chromium 100, but dvh only arrived in 108. An
    // engine without it must still get a bottom sheet that fits the screen and scrolls.
    name: 'the bottom sheet fits in an engine without dvh',
    viewport: { width: 412, height: 860 },
    dpr: 2,
    mobile: true,
    async run(page, context, h) {
      const c = [];
      const measure = () => page.evaluate(async () => {
        window.TACTILUME.ui.open('settings');
        await new Promise((r) => setTimeout(r, 900));
        const p = document.getElementById('tl-panel');
        const r = p.getBoundingClientRect();
        const body = p.querySelector('.tl-panel-body');
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), h: innerHeight, scrolls: body.scrollHeight > body.clientHeight + 1 };
      });
      const fits = (m) => m.top >= 0 && m.bottom <= m.h && m.height > 0.5 * m.h && m.scrolls;
      const now = await measure();
      c.push(h.check('the sheet fits and scrolls here', fits(now), now));
      // what a pre-108 engine sees: dvh is an unknown unit, also inside any @supports test
      await page.evaluate(() => {
        window.TACTILUME.ui.close();
        for (const s of document.querySelectorAll('style')) s.textContent = s.textContent.replace(/(\d)dvh\b/g, '$1dvq');
      });
      await h.wait(900);
      const old = await measure();
      c.push(h.check('without dvh the sheet still fits on screen and scrolls', fits(old), old));
      return c;
    },
  },

  {
    // Phones with WebGL 2 whose GPU compiler rejects a shader must not be told they lack
    // WebGL 2: they get the real error and the GPU, to copy into a message. In the Android
    // app, where no other browser can be picked, the advice is to update the WebView.
    name: 'a graphics failure is named, not blamed on WebGL 2',
    open: false,
    viewport: { width: 360, height: 780 },
    mobile: true,
    async run(page, context, h) {
      const c = [];
      const fatal = (p) => p.evaluate(() => {
        const el = document.getElementById('fatal');
        const r = el.getBoundingClientRect();
        const btn = el.querySelector('button');
        return {
          shown: !el.hidden, text: el.innerText, button: btn ? btn.textContent : '',
          inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5,
          scrollable: el.scrollHeight <= el.clientHeight + 1 || getComputedStyle(el).overflowY !== 'visible',
        };
      });
      // the first shader the engine compiles is refused, as some phone compilers do
      await page.addInitScript(() => {
        const original = WebGL2RenderingContext.prototype.getShaderParameter;
        let refused = false;
        WebGL2RenderingContext.prototype.getShaderParameter = function getShaderParameter(shader, pname) {
          if (pname === this.COMPILE_STATUS && !refused) { refused = true; return false; }
          return original.call(this, shader, pname);
        };
      });
      await page.goto(h.url());
      await h.until(page, () => { const el = document.getElementById('fatal'); return el && !el.hidden; }, undefined, 10000);
      const f = await fatal(page);
      c.push(h.check('a refused shader is not called missing WebGL 2', f.shown && !/needs WebGL 2/.test(f.text), f.text));
      c.push(h.check('it says the graphics could not start, with the error', /could not start/.test(f.text) && /failed to compile/.test(f.text), f.text));
      c.push(h.check('it names the GPU', /GPU: \S/.test(f.text), f.text));
      c.push(h.check('it offers to copy the details', /Copy/.test(f.button), f.button));
      c.push(h.check('the message is on screen (scrolling if long)', f.inside && f.scrollable, f));

      // in the Android app (its private origin and its bridge), without WebGL 2
      const html = fs.readFileSync(fileURLToPath(h.url({ query: '' })), 'utf8');
      const app = await h.newContext();
      await app.route('https://appassets.androidplatform.net/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
      const ap = await app.newPage();
      await ap.addInitScript(() => {
        window.TactilumeNative = { postMessage() {}, addEventListener() {}, onmessage: null };
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function getContext(type, ...rest) {
          return type === 'webgl2' ? null : original.call(this, type, ...rest);
        };
      });
      await ap.goto('https://appassets.androidplatform.net/assets/Tactilume.html?test=1');
      await h.until(ap, () => { const el = document.getElementById('fatal'); return el && !el.hidden; }, undefined, 10000);
      const a = await fatal(ap);
      c.push(h.check('in the app the advice is to update the WebView, not to change browsers', /Android System WebView/.test(a.text) && !/Firefox|Safari/.test(a.text), a.text));
      return c;
    },
  },

  {
    // Seven tabs on a narrow phone (or a large Display size, or a large Control size): every
    // tab stays inside the strip, Settings included, and no two names run into each other.
    name: 'every tab fits on narrow screens and with large controls',
    viewport: { width: 320, height: 700 },
    dpr: 2,
    mobile: true,
    async run(page, context, h) {
      const c = [];
      // in the device's own font, then in the wide DejaVu Sans (see 'large controls')
      for (const font of ['', "'DejaVu Sans'"]) {
        const style = font ? await page.addStyleTag({ content: `#ui#ui { --font: ${font}, sans-serif !important; }` }) : null;
        for (const width of [412, 360, 320, 280]) {
          await page.setViewportSize({ width, height: 700 });
          for (const uiScale of [1, 1.3, 1.6]) {
            const r = await tabStrip(page, { uiScale });
            c.push(h.check(`${width} px, Control size ${Math.round(uiScale * 100)}%${font ? ` in ${font}` : ''}: every tab inside the strip, no names overlapping or cut`, !r.problems.length, r));
          }
        }
        if (style) await style.evaluate((el) => el.remove());
      }
      return c;
    },
  },

  {
    // Android's Font size: the app turns the WebView's own text zoom off (it grew the text
    // but not the boxes around it) and tells the page the font scale instead, which then
    // grows the controls as a whole, as Control size does, up to twice their size.
    name: 'the system font size grows the controls in the app',
    open: false,
    viewport: { width: 360, height: 780 },
    dpr: 2,
    mobile: true,
    async run(page, context, h) {
      const c = [];
      const html = fs.readFileSync(fileURLToPath(h.url({ query: '' })), 'utf8');
      await context.route('https://appassets.androidplatform.net/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
      // a stand-in for the app's bridge: it answers hello with a font scale of 1.5
      await page.addInitScript(() => {
        let listener = null;
        window.__appSend = (msg) => listener && listener({ data: JSON.stringify(msg) });
        window.TactilumeNative = {
          addEventListener(type, fn) { if (type === 'message') listener = fn; },
          postMessage(text) {
            const m = JSON.parse(text);
            if (m.t === 'hello') setTimeout(() => window.__appSend({ t: 'hello', version: 'test', sdk: 35, device: 'Test', fontScale: 1.5 }), 0);
          },
        };
      });
      await page.goto('https://appassets.androidplatform.net/assets/Tactilume.html?test=1&particles=24000');
      await h.ready(page);
      const scale = () => page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('ui')).getPropertyValue('--ui-scale')));
      c.push(h.check('a font scale of 1.5 makes the controls 1.5 times their size', await h.until(page, () => Math.abs(parseFloat(getComputedStyle(document.getElementById('ui')).getPropertyValue('--ui-scale')) - 1.5) < 0.01, undefined, 5000), await scale()));
      await page.evaluate(() => window.TACTILUME.store.setSettings({ uiScale: 1.6 }, { source: 'test' }));
      c.push(h.check('with Control size 160% too, they stop at twice their size', Math.abs(await scale() - 2) < 0.01, await scale()));
      const strip = await tabStrip(page, { uiScale: 1.6 });
      c.push(h.check('every tab still fits at twice the size', !strip.problems.length, strip));
      const clipped = await page.evaluate(async () => {
        const t = window.TACTILUME;
        const out = [];
        for (const tab of ['scenes', 'play', 'look', 'motion', 'sound', 'capture', 'settings']) {
          t.ui.open(tab);
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          for (const el of document.querySelectorAll(`#tl-tabpanel-${tab} :is(.tl-opt-text, .tl-swatch-name, .tl-chips .tl-opt)`)) {
            if (el.getClientRects().length && el.scrollWidth > el.clientWidth + 1) out.push(`${tab}: "${el.textContent.trim()}" ${el.scrollWidth} > ${el.clientWidth}`);
          }
        }
        t.ui.close();
        return out;
      });
      c.push(h.check('no option name is cut short at twice the size', !clipped.length, clipped.join('; ')));
      // the person changes Font size while the app is open
      await page.evaluate(() => { window.TACTILUME.store.setSettings({ uiScale: 1 }, { source: 'test' }); window.__appSend({ t: 'font', scale: 1 }); });
      c.push(h.check('a new font scale from the app applies at once', Math.abs(await scale() - 1) < 0.01, await scale()));
      await page.evaluate(() => window.__appSend({ t: 'font', scale: 'huge' }));
      c.push(h.check('a font scale that is not a number changes nothing', Math.abs(await scale() - 1) < 0.01, await scale()));
      return c;
    },
  },

  {
    // The behaviour name card is how players learn what each number of fingers does: it
    // must stay readable for its whole hold, not start fading halfway through.
    name: 'the behaviour name card stays readable for its hold',
    viewport: { width: 360, height: 780 },
    mobile: true,
    async run(page, context, h) {
      const c = [];
      // steps the paused card animation and reads its opacity and blur at each time (ms)
      const sample = (withBlurb) => page.evaluate(async (withBlurb) => {
        const ui = window.TACTILUME.ui;
        ui.showBehaviour({ key: withBlurb ? 'weave' : 'storm', name: withBlurb ? 'Weave' : 'Storm', blurb: 'Light streams from one touch to the next.' }, { autopilot: !withBlurb });
        await new Promise((r) => requestAnimationFrame(r));
        const cards = document.querySelectorAll('.tl-namecard');
        const el = cards[cards.length - 1];
        const anim = el.getAnimations().find((a) => a.playState !== 'finished');
        anim.pause();
        const total = anim.effect.getTiming().duration;
        const at = (ms) => {
          anim.currentTime = ms;
          const s = getComputedStyle(el);
          const blur = /blur\(([\d.]+)px\)/.exec(s.filter);
          return { ms, opacity: +(+s.opacity).toFixed(3), blur: blur ? +blur[1] : 0 };
        };
        const shown = !!el.querySelector('.tl-namecard-blurb');
        // full strength from 0.5 s after it appears until 0.55 s before its end
        const held = [];
        for (let ms = 500; ms <= total - 550; ms += 100) held.push(at(ms));
        anim.finish();
        return { total, shown, held: held.filter((x) => x.opacity < 0.97 || x.blur > 0.3) };
      }, withBlurb);
      const explained = await sample(true);
      c.push(h.check('the card with an explanation shows it', explained.shown, explained));
      c.push(h.check('a card with an explanation stays at full strength through its hold', !explained.held.length, explained));
      c.push(h.check('an explanation is held long enough to read (at least 2.3 s)', explained.total - 900 >= 2300, explained.total));
      const named = await sample(false);
      c.push(h.check('a name-only card stays at full strength through its hold', !named.held.length, named));
      return c;
    },
  },

  {
    // Typing a scene name or pasting a code brings up the on-screen keyboard, which shrinks
    // the window (the Android app) or the visual viewport (some browsers). That must not
    // re-frame the light and wipe its trails, neither when it opens nor when it closes.
    name: 'the on-screen keyboard leaves the light alone',
    viewport: { width: 420, height: 900 },
    mobile: true,
    async run(page, context, h) {
      const c = [];
      const read = () => page.evaluate(() => ({ aspect: +window.TACTILUME.engine.aspect.toFixed(4), ...window.TACTILUME.engine.stats }));
      await page.evaluate(() => window.TACTILUME.ui.open('scenes'));
      await h.wait(500);
      await page.focus('#ui input.tl-text');
      const before = await read();
      await page.setViewportSize({ width: 420, height: 520 }); // the keyboard comes up
      await h.wait(300);
      await h.waitFrames(page, 3);
      const open = await read();
      c.push(h.check('the drawing keeps its shape while the keyboard is up', open.aspect === before.aspect && open.height === before.height, { before, open }));
      await page.setViewportSize({ width: 420, height: 900 }); // and goes away
      await h.wait(300);
      await h.waitFrames(page, 3);
      const closed = await read();
      c.push(h.check('and after it goes away', closed.aspect === before.aspect && closed.height === before.height, { before, closed }));
      // not typing: the window really changed shape (split screen), so the drawing follows
      await page.evaluate(() => document.activeElement.blur());
      await page.setViewportSize({ width: 420, height: 520 });
      const follows = await h.until(page, () => Math.abs(window.TACTILUME.engine.aspect - 420 / 520) < 0.01, undefined, 5000);
      c.push(h.check('a window that changes shape while nobody types is followed', follows, await read()));
      // typing in a window that then grows taller: also followed
      await page.focus('#ui input.tl-text');
      await page.setViewportSize({ width: 420, height: 900 });
      const grows = await h.until(page, () => Math.abs(window.TACTILUME.engine.aspect - 420 / 900) < 0.01, undefined, 5000);
      c.push(h.check('a window that grows while typing is followed', grows, await read()));
      // the keyboard up, then the field let go: the drawing catches up with the window
      await page.setViewportSize({ width: 420, height: 520 });
      await h.wait(300);
      await page.evaluate(() => document.activeElement.blur());
      const caught = await h.until(page, () => Math.abs(window.TACTILUME.engine.aspect - 420 / 520) < 0.01, undefined, 5000);
      c.push(h.check('when typing ends, a window still short is followed', caught, await read()));
      return c;
    },
  },

  {
    // A share link a messaging app cut short must say so, rather than quietly play the
    // person's last scene, which they would take for the shared one.
    name: 'a broken share link says so',
    open: false,
    async run(page, context, h) {
      const c = [];
      const toasts = () => page.evaluate(() => (document.querySelector('.tl-toasts') || {}).textContent || '');
      // base64 of '{"pa":"ab': the start of a real code, cut off
      await page.goto(h.url({ hash: '#s=1eyJwYSI6ImFi' }));
      await h.ready(page);
      c.push(h.check('opening a cut-short link says its scene could not be read', await h.until(page, () => /could not be read/.test((document.querySelector('.tl-toasts') || {}).textContent || ''), undefined, 5000), await toasts()));
      c.push(h.check('the broken code leaves the address', !(await page.evaluate(() => location.hash)), await page.evaluate(() => location.hash)));
      // the same link arriving while the app is open
      await page.evaluate(() => {
        const ui = window.TACTILUME.ui, toast = ui.toast;
        window.__toasts = [];
        ui.toast = (text, ms) => { window.__toasts.push(text); return toast.call(ui, text, ms); };
        location.hash = '#s=1eyJwYSI6ImFi';
      });
      c.push(h.check('a cut-short link arriving later says so too', await h.until(page, () => window.__toasts.some((t) => /could not be read/.test(t)), undefined, 5000), await page.evaluate(() => window.__toasts)));
      // a good link still plays, with its own message
      const good = encodeScene(sanitizeScene({ palette: 'koi', name: 'Good link' }));
      await page.evaluate((code) => { location.hash = '#s=' + code; }, good);
      c.push(h.check('a good link still loads', await h.until(page, () => window.TACTILUME.store.scene.name === 'Good link', undefined, 5000), await toasts()));
      return c;
    },
  },

  {
    // S and M change what plays like ] and N do, so they say what they did too (seen, and
    // heard: the toasts are a polite live region); a running value replaces its last toast.
    name: 'S and M say what they did',
    async run(page, context, h) {
      const c = [];
      const shown = () => page.evaluate(() => [...document.querySelectorAll('.tl-toasts .tl-toast:not(.is-out)')].map((el) => el.textContent));
      const live = await page.evaluate(() => { const el = document.querySelector('.tl-toasts'); return { role: el.getAttribute('role'), live: el.getAttribute('aria-live') }; });
      await page.mouse.move(450, 300);
      const sym = await page.evaluate(() => window.TACTILUME.store.scene.symmetry);
      await page.keyboard.press('s');
      const first = await h.until(page, (want) => [...document.querySelectorAll('.tl-toasts .tl-toast')].some((el) => el.textContent === want), `Symmetry ${sym + 1}×`, 3000);
      c.push(h.check('S says the new symmetry', first, await shown()));
      await page.keyboard.press('s');
      await h.wait(400);
      const two = await shown();
      c.push(h.check('S again replaces that toast instead of stacking another', two.filter((t) => /^Symmetry/.test(t)).length === 1 && two.includes(`Symmetry ${sym + 2}×`), two));
      const mirror = await page.evaluate(() => window.TACTILUME.store.scene.mirror);
      await page.keyboard.press('m');
      const said = await h.until(page, (want) => [...document.querySelectorAll('.tl-toasts .tl-toast')].some((el) => el.textContent === want), mirror ? 'Mirror off' : 'Mirror on', 3000);
      c.push(h.check('M says whether mirror is on', said, await shown()));
      c.push(h.check('the toasts are read out (a polite status region)', live.role === 'status' && live.live === 'polite', live));
      // a change from the panel or a preset is not a key: it says nothing here
      const before = (await shown()).length;
      await page.evaluate(() => window.TACTILUME.store.setScene({ symmetry: 1 }, { source: 'panel' }));
      await h.wait(300);
      c.push(h.check('a symmetry change from the panel adds no toast', !(await shown()).some((t) => t === 'Symmetry off') && (await shown()).length <= before, await shown()));
      return c;
    },
  },

  {
    // ui.toast(text, ms) keeps a toast up as long as it was asked: the GPU-repair warning
    // (8 s) is the only pointer to Settings > Device check.
    name: 'a toast stays as long as it was asked',
    async run(page, context, h) {
      const text = 'The light keeps hitting a graphics problem on this device. Settings > Device check shows the details.';
      await page.evaluate((t) => window.TACTILUME.ui.toast(t, 8000), text);
      await h.wait(6500);
      const still = await page.evaluate((t) => [...document.querySelectorAll('.tl-toasts .tl-toast:not(.is-out)')].some((el) => el.textContent === t), text);
      return [h.check('an 8 s toast is still up after 6.5 s', still)];
    },
  },

  {
    // The one way into the controls stays findable: dimmed, it keeps 3:1 against the dark
    // (WCAG 1.4.11; 0.25 measured 2.2:1).
    name: 'the dimmed open button stays visible',
    viewport: { width: 360, height: 780 },
    async run(page, context, h) {
      await h.until(page, () => document.querySelector('.tl-open').classList.contains('is-dim'), undefined, 6000);
      await h.wait(800); // its fade
      const opacity = await page.evaluate(() => Number(getComputedStyle(document.querySelector('.tl-open')).opacity));
      return [h.check('dimmed, the open button keeps at least 0.4 opacity', opacity >= 0.4 - 1e-6, opacity)];
    },
  },

  {
    // With reduced motion there is no beckoning ring after the intro; a still cue takes its
    // place: the open button stays bright for a while instead of dimming at once.
    name: 'with reduced motion the open button stays bright after the intro',
    open: false,
    viewport: { width: 360, height: 780 },
    async run(page, context, h) {
      const c = [];
      await page.emulateMedia({ reducedMotion: 'reduce' });
      // not test mode, so the first-run welcome shows
      await page.goto(h.url({ query: '?particles=24000' }));
      await h.ready(page);
      const intro = await h.until(page, () => !!document.querySelector('.tl-intro-begin'), undefined, 5000);
      c.push(h.check('the welcome shows', intro));
      await page.click('.tl-intro-begin');
      await h.wait(5000); // past the beckon (0.9 s) and the usual 3 s dim
      const dim = await page.evaluate(() => document.querySelector('.tl-open').classList.contains('is-dim'));
      c.push(h.check('5 s after Begin the open button is still bright', !dim));
      return c;
    },
  },

  {
    // Hidden controls come back with a gesture play never makes. Holding three fingers still
    // is how Nova gathers a star, so that must not bring them back; a three-finger double tap does.
    name: 'hidden controls: a three-finger hold keeps playing, a double tap brings them back',
    viewport: { width: 390, height: 844 },
    dpr: 2,
    mobile: true,
    async run(page, context, h) {
      const c = [];
      const cdp = await context.newCDPSession(page);
      const hidden = () => page.evaluate(() => window.TACTILUME.ui.hidden);
      await page.evaluate(() => window.TACTILUME.actions.toggleUI());
      c.push(h.check('the controls hide', await hidden()));
      // the touches carry their own times: the software renderer can hold an event back for
      // longer than a tap lasts, and the gesture is timed by when the fingers moved
      const three = h.ring(3, 195, 500, 90).map(({ x, y, id }) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 0.5 }));
      const t0 = Date.now() / 1000;
      const send = (type, touchPoints, ms) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints, timestamp: t0 + ms / 1000 });
      await send('touchStart', three, 0);
      for (let i = 1; i <= 8; i++) await send('touchMove', three.map((p) => ({ ...p, x: p.x + (i % 2 ? 2 : -2) })), i * 200);
      const fingers = await page.evaluate(() => window.TACTILUME.fingers);
      await send('touchEnd', [], 1700);
      c.push(h.check('three fingers held still for 1.7 s play on, the controls stay hidden', await hidden() && fingers === 3, { fingers }));
      // and the same twice in quick succession (a hold, lift, hold) is not a double tap either
      await send('touchStart', three, 2000);
      await send('touchEnd', [], 3200);
      await send('touchStart', three, 3400);
      await send('touchEnd', [], 4600);
      c.push(h.check('two long holds in a row do not bring them back', await hidden()));
      // a three-finger double tap: down and up within 80 ms, twice, 170 ms apart
      await send('touchStart', three, 5000);
      await send('touchEnd', [], 5080);
      await send('touchStart', three, 5250);
      await send('touchEnd', [], 5330);
      c.push(h.check('a three-finger double tap brings them back', await h.until(page, () => !window.TACTILUME.ui.hidden, undefined, 3000)));
      return c;
    },
  },

  {
    // In the app the screen's refresh rate follows Frame rate: the page tells the app the cap.
    name: 'the app hears the frame-rate cap',
    open: false,
    viewport: { width: 360, height: 780 },
    mobile: true,
    async run(page, context, h) {
      const c = [];
      const html = fs.readFileSync(fileURLToPath(h.url({ query: '' })), 'utf8');
      await context.route('https://appassets.androidplatform.net/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
      await page.addInitScript(() => {
        window.__sent = [];
        window.TactilumeNative = { addEventListener() {}, postMessage(text) { window.__sent.push(JSON.parse(text)); } };
      });
      await page.goto('https://appassets.androidplatform.net/assets/Tactilume.html?test=1&particles=24000');
      await h.ready(page);
      const caps = () => page.evaluate(() => window.__sent.filter((m) => m.t === 'fps').map((m) => m.cap));
      c.push(h.check('at start the app is told there is no cap', (await caps())[0] === 0, await caps()));
      await page.evaluate(() => window.TACTILUME.store.setSettings({ fpsCap: '60' }, { source: 'test' }));
      c.push(h.check('choosing 60 tells the app 60', (await caps()).at(-1) === 60, await caps()));
      await page.evaluate(() => window.TACTILUME.store.setSettings({ fpsCap: '30' }, { source: 'test' }));
      c.push(h.check('choosing 30 tells the app 30', (await caps()).at(-1) === 30, await caps()));
      return c;
    },
  },

  {
    // A touch screen cannot show the rest of a cut-short card, so every scene card shows its
    // whole description (Lantern Walk's is the one that says it suits every kind of colour vision).
    name: 'every scene card shows its whole description',
    viewport: { width: 360, height: 780 },
    dpr: 2,
    mobile: true,
    async run(page, context, h) {
      const c = [];
      for (const width of [412, 393, 360, 320]) {
        await page.setViewportSize({ width, height: 780 });
        for (const uiScale of [1, 1.3]) {
          const cut = await page.evaluate(async (uiScale) => {
            const t = window.TACTILUME;
            t.store.setSettings({ uiScale }, { source: 'test' });
            t.ui.open('scenes');
            await new Promise((r) => setTimeout(r, 400));
            const out = [];
            for (const el of document.querySelectorAll('.tl-preset-blurb')) {
              const card = el.closest('.tl-preset').getBoundingClientRect();
              if (el.scrollHeight > el.clientHeight + 1 || el.getBoundingClientRect().bottom > card.bottom + 0.5) out.push(el.closest('.tl-preset').dataset.name);
            }
            t.ui.close();
            return out;
          }, uiScale);
          c.push(h.check(`${width} px, Control size ${Math.round(uiScale * 100)}%: no scene description is cut short`, !cut.length, cut.join(', ')));
        }
      }
      return c;
    },
  },

  {
    // A pill button's name stays on one line, inside its row, at every phone width: a row
    // whose second button is hidden (Device check's Copy, before the check) gives the first
    // the whole row, and two that do not fit side by side go one under the other.
    name: 'action buttons keep their names on one line',
    viewport: { width: 360, height: 780 },
    dpr: 2,
    mobile: true,
    async run(page, context, h) {
      const c = [];
      const measure = (tab, showCopy) => page.evaluate(async ({ tab, showCopy }) => {
        const t = window.TACTILUME;
        t.ui.open(tab);
        await new Promise((r) => setTimeout(r, 400));
        for (const b of document.querySelectorAll('.tl-actions-row .tl-btn')) {
          if (b.textContent.trim() === 'Copy') b.hidden = !showCopy;
        }
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const out = [];
        for (const row of document.querySelectorAll(`#tl-tabpanel-${tab} .tl-actions-row`)) {
          const rr = row.getBoundingClientRect();
          for (const b of row.querySelectorAll('.tl-btn')) {
            if (!b.getClientRects().length) continue;
            const name = b.textContent.trim();
            const r = b.getBoundingClientRect();
            const text = b.querySelector('.tl-btn-text');
            const range = document.createRange();
            range.selectNodeContents(text);
            const tops = new Set([...range.getClientRects()].map((x) => Math.round(x.top)));
            if (tops.size > 1) out.push(`"${name}" runs to ${tops.size} lines`);
            if (r.left < rr.left - 0.5 || r.right > rr.right + 0.5) out.push(`"${name}" sticks out of its row`);
          }
        }
        for (const b of document.querySelectorAll('.tl-actions-row .tl-btn')) {
          if (b.textContent.trim() === 'Copy') b.hidden = true;
        }
        t.ui.close();
        return out;
      }, { tab, showCopy });
      for (const width of [412, 393, 360, 320, 300, 280]) {
        await page.setViewportSize({ width, height: 780 });
        const scenes = await measure('scenes', false);
        c.push(h.check(`${width} px: Surprise me and Share link stay on one line each`, !scenes.length, scenes.join('; ')));
        const before = await measure('settings', false);
        c.push(h.check(`${width} px: Check this device stays on one line`, !before.length, before.join('; ')));
        const after = await measure('settings', true);
        c.push(h.check(`${width} px: with Copy shown, both stay on one line`, !after.length, after.join('; ')));
      }
      return c;
    },
  },

  {
    // Opposite actions do not share a glyph: Open (bring a scene in) is not Share link (send
    // one out), Copy is not Share, and Check this device is not Surprise me.
    name: 'each action has its own glyph',
    async run(page, context, h) {
      const glyphs = await page.evaluate(async () => {
        const t = window.TACTILUME;
        const svgOf = (pred) => {
          const b = [...document.querySelectorAll('#ui button')].find((x) => pred(x.textContent.trim()));
          const s = b && b.querySelector('svg');
          return s ? s.innerHTML : null;
        };
        t.ui.open('scenes');
        await new Promise((r) => setTimeout(r, 300));
        const out = { share: svgOf((x) => x === 'Share link' || x === 'Share scene code'), open: svgOf((x) => x === 'Open'), surprise: svgOf((x) => x === 'Surprise me') };
        t.ui.open('settings');
        await new Promise((r) => setTimeout(r, 300));
        Object.assign(out, { copy: svgOf((x) => x === 'Copy'), check: svgOf((x) => x === 'Check this device') });
        t.ui.close();
        return out;
      });
      const all = Object.values(glyphs).every(Boolean);
      return [
        h.check('every one of these buttons shows a glyph', all, Object.keys(glyphs).filter((k) => !glyphs[k])),
        h.check('Open does not show the share glyph', all && glyphs.open !== glyphs.share),
        h.check('Copy does not show the share glyph', all && glyphs.copy !== glyphs.share),
        h.check('Check this device does not show the Surprise me glyph', all && glyphs.check !== glyphs.surprise),
      ];
    },
  },

  {
    // The name card is hidden from screen readers; what it says reaches them through the
    // live region, explanation included, for as long as the card explains it.
    name: 'a screen reader hears what a new behaviour does',
    async run(page, context, h) {
      const c = [];
      const nova = behaviourByKey('nova');
      const said = () => page.evaluate(() => document.querySelector('#ui .tl-sr-only[aria-live]').textContent.trim());
      const reads = (w) => h.until(page, (want) => document.querySelector('#ui .tl-sr-only[aria-live]').textContent.trim() === want, w, 4000);
      const show = () => page.evaluate((b) => window.TACTILUME.ui.showBehaviour(b, { autopilot: false }), { key: nova.key, name: nova.name, blurb: nova.blurb });
      await show();
      c.push(h.check('the first time, its name and what it does are read out', await reads(`${nova.name}. ${nova.blurb}`), await said()));
      await h.wait(1700);
      await show();
      await h.wait(1700);
      await show();
      c.push(h.check('once the card stops explaining it, only its name is read', await reads(nova.name), await said()));
      return c;
    },
  },

  {
    // How hidden controls come back is said in the device's own terms: a phone has no H key,
    // and in the app Back is the easiest way. The microphone's refusal in the app names the
    // place to allow it again (Android asks only once), not a browser the app does not have.
    name: 'hints name the ways this device has',
    open: false,
    viewport: { width: 360, height: 780 },
    dpr: 2,
    mobile: true,
    async run(page, context, h) {
      const c = [];
      const html = fs.readFileSync(fileURLToPath(h.url({ query: '' })), 'utf8');
      await context.route('https://appassets.androidplatform.net/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
      await page.addInitScript(() => {
        window.TactilumeNative = { addEventListener() {}, postMessage() {} };
        if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('refused', 'NotAllowedError'));
      });
      const toasts = () => page.evaluate(() => document.querySelector('.tl-toasts').textContent);
      const hiddenToast = async () => {
        await page.evaluate(() => window.TACTILUME.actions.toggleUI());
        await h.until(page, () => /Controls hidden/.test(document.querySelector('.tl-toasts').textContent), undefined, 3000);
        return toasts();
      };
      const captureHelp = () => page.evaluate(async () => {
        window.TACTILUME.ui.open('capture');
        await new Promise((r) => setTimeout(r, 300));
        const p = [...document.querySelectorAll('#tl-tabpanel-capture .tl-help')].find((x) => /bring them back/.test(x.textContent));
        window.TACTILUME.ui.close();
        return p ? p.textContent : '';
      });
      const micError = () => page.evaluate(async () => (await window.TACTILUME.audio.startMic()).error || '');

      await page.goto(h.url());
      await h.ready(page);
      const phone = await hiddenToast();
      c.push(h.check('on a phone the toast says to tap the faint button, not to press H', /tap the faint button/.test(phone) && !/press H/.test(phone), phone));
      c.push(h.check('in a browser it does not offer Back', !/Back/.test(phone), phone));
      const phoneHelp = await captureHelp();
      c.push(h.check('Capture > Clean screen says the same', /tap the faint button/.test(phoneHelp) && !/press H/.test(phoneHelp), phoneHelp));
      const browserMic = await micError();
      c.push(h.check('in a browser a refused microphone points to the browser', /browser/.test(browserMic) && !/Android/.test(browserMic), browserMic));

      await page.goto('https://appassets.androidplatform.net/assets/Tactilume.html?test=1&particles=24000');
      await h.ready(page);
      const app = await hiddenToast();
      c.push(h.check('in the app the toast offers Back too', /press Back/.test(app) && /tap the faint button/.test(app) && !/press H/.test(app), app));
      const appMic = await micError();
      c.push(h.check('in the app a refused microphone names Android Settings, not a browser', /Android Settings/.test(appMic) && !/browser/.test(appMic), appMic));
      return c;
    },
  },

  {
    // With a keyboard and a mouse, H is the quick way back.
    name: 'on a computer the way back names H',
    async run(page, context, h) {
      await page.evaluate(() => window.TACTILUME.actions.toggleUI());
      await h.until(page, () => /Controls hidden/.test(document.querySelector('.tl-toasts').textContent), undefined, 3000);
      const text = await page.evaluate(() => document.querySelector('.tl-toasts').textContent);
      return [h.check('the toast says press H, and not Back', /press H/.test(text) && !/Back/.test(text), text)];
    },
  },

  {
    // Someone opening a shared link is told the scene is the one shared with them: at once
    // for a returning visitor, and after Begin for a first one.
    name: 'a shared link says whose scene is playing',
    open: false,
    async run(page, context, h) {
      const c = [];
      const name = 'Sam’s aurora';
      const hash = '#s=' + encodeScene(sanitizeScene({ palette: 'aurora', name }));
      const want = `Playing “${name}”, shared with you`;
      const toastsOf = (p) => p.evaluate(() => (document.querySelector('.tl-toasts') || {}).textContent || '');
      const told = (p) => h.until(p, (w) => ((document.querySelector('.tl-toasts') || {}).textContent || '').includes(w), want, 4000);
      await page.goto(h.url({ hash }));
      await h.ready(page);
      c.push(h.check('a returning visitor is told at once', await told(page), await toastsOf(page)));

      const fresh = await (await h.newContext()).newPage();
      await fresh.goto(h.url({ query: '?particles=24000', hash }));
      await h.ready(fresh);
      await h.until(fresh, () => !!document.querySelector('.tl-intro-begin'), undefined, 5000);
      await h.wait(1200);
      const early = await toastsOf(fresh);
      c.push(h.check('a first visitor is not told behind the welcome', !early.includes(want), early));
      await fresh.click('.tl-intro-begin');
      c.push(h.check('and is told once Begin is tapped', await told(fresh), await toastsOf(fresh)));
      return c;
    },
  },
];

// Opens the panel with `uiScale` and reports what is wrong with the tab strip: a tab outside
// it, a shown name cut short or running into the next, a tab without its name for screen
// readers, an icon shrunk to nothing.
async function tabStrip(page, { uiScale = 1, tab = 'settings' } = {}) {
  return page.evaluate(async ({ uiScale, tab }) => {
    const t = window.TACTILUME;
    t.store.setSettings({ uiScale }, { source: 'test' });
    t.ui.open(tab);
    await new Promise((r) => setTimeout(r, 500));
    const strip = document.querySelector('.tl-tabs').getBoundingClientRect();
    const problems = [];
    const shown = [];
    for (const b of document.querySelectorAll('.tl-tab')) {
      const r = b.getBoundingClientRect();
      const name = b.dataset.tab;
      if (r.left < strip.left - 0.5 || r.right > strip.right + 0.5) problems.push(`${name} outside the strip (${Math.round(r.left)}-${Math.round(r.right)} of ${Math.round(strip.left)}-${Math.round(strip.right)})`);
      const label = b.querySelector('.tl-tab-label');
      if (!label || !label.textContent.trim()) problems.push(`${name} has no name`);
      const icon = b.querySelector('.tl-icon').getBoundingClientRect();
      if (icon.width < 16) problems.push(`${name} icon ${Math.round(icon.width)} px`);
      const lr = label.getBoundingClientRect();
      // a name is shown when it has a real box; shown names must fit their tab whole
      if (lr.width > 2 && getComputedStyle(label).clip === 'auto') {
        if (label.scrollWidth > label.clientWidth + 1) problems.push(`${name} name cut (${label.scrollWidth} > ${label.clientWidth})`);
        if (lr.left < r.left - 0.5 || lr.right > r.right + 0.5) problems.push(`${name} name spills out of its tab`);
        shown.push({ name, left: lr.left, right: lr.right });
      }
    }
    for (let i = 1; i < shown.length; i++) {
      if (shown[i].left < shown[i - 1].right - 0.5) problems.push(`${shown[i - 1].name} and ${shown[i].name} names overlap`);
    }
    if (!shown.some((s) => s.name === tab)) problems.push(`the chosen tab (${tab}) shows no name`);
    t.ui.close();
    return { problems, strip: Math.round(strip.width), shown: shown.map((s) => s.name).join(' ') };
  }, { uiScale, tab });
}
