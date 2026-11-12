// The phone link in the browser.
//   1. The renderer: link events (delivered through the bridge shim, as the main process
//      would) become a phone player whose touches are poles that move the light, and the
//      phone hears back its colour, buzzes and what is playing.
//   2. The controller page itself: served by a real link server running in this test
//      process, opened in a touch phone's browser, and played with two fingers through the
//      DevTools protocol (Input.dispatchTouchEvent). The server must hear the frames.
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLinkServer } from '../../src/main/link-server.js';
import { haptic, state } from '../../src/shared/protocol.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(process.env.DIST || path.join(here, '..', '..', 'dist'));
const LEFT = { x0: 0.05, y0: 0.25, x1: 0.35, y1: 0.75 };
const RIGHT = { x0: 0.65, y0: 0.25, x1: 0.95, y1: 0.75 };

// Repeats a check in Node until it holds or time runs out. → the last value seen.
async function poll(fn, ok, { timeout = 10000, every = 150 } = {}) {
  const t0 = Date.now();
  let value = await fn();
  while (!ok(value) && Date.now() - t0 < timeout) {
    await new Promise((resolve) => setTimeout(resolve, every));
    value = await fn();
  }
  return value;
}

// A port nobody is using now, so a stopped server can come back on the same one.
function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

// The brightness of the left and right thirds of the picture.
async function sides(page, h) {
  const [l, r] = [await h.capture(page, { region: LEFT }), await h.capture(page, { region: RIGHT })];
  return { left: l.mean, right: r.mean };
}

export default [
  {
    name: 'phone shim: touches from a phone become poles that move the light',
    async run(page, h) {
      await h.open(page);
      const checks = [];
      await h.emit(page, { type: 'join', player: 1, name: 'Test phone', caps: { touches: 10, haptics: true } });
      const joined = await h.until(page, () => window.TACTILUME_DESKTOP.hub.players().some((p) => p.kind === 'phone'));
      const player = await page.evaluate(() => window.TACTILUME_DESKTOP.hub.players().find((p) => p.kind === 'phone') || null);
      checks.push(h.check('a join makes a phone player with its name', joined && player?.name === 'Test phone', player));
      const told = (await h.sent(page)).find((s) => s.player === 1 && s.msg.t === 'state');
      checks.push(h.check('the phone is told the colour it is drawn in and how many play', !!told && /^#[0-9a-f]{6}$/.test(told.msg.color) && told.msg.players >= 1, told));

      const before = await sides(page, h);
      // A phone sends its fingers about thirty times a second; this one rests on the left
      // third, then glides to the right third at 0.6 of the pad a second.
      await page.evaluate(() => {
        const d = { x: 0.2, y: 0.5, tx: 0.2, ty: 0.5, seq: 0, on: true };
        window.__phoneDriver = d;
        const step = () => {
          if (!d.on) return;
          d.x += Math.max(-0.02, Math.min(0.02, d.tx - d.x));
          d.y += Math.max(-0.02, Math.min(0.02, d.ty - d.y));
          window.__tlShim.emit({ type: 'touch', player: 1, seq: d.seq++, touches: [[0, d.x, d.y, 0.5]], at: Date.now(), ms: performance.now() });
          setTimeout(step, 33);
        };
        step();
      });
      await h.waitFrames(page, 3);
      const pole = await page.evaluate((id) => {
        const d = window.TACTILUME_DESKTOP;
        const p = d.hub.poles().find((q) => q.player === id);
        const want = d.engine.screenToWorld(0.2 * innerWidth, 0.5 * innerHeight);
        return p ? { x: p.x, y: p.y, held: p.held, power: p.power, want } : null;
      }, player?.id);
      checks.push(h.check('the touch is a held pole where the finger is, at usual power', !!pole && pole.held && Math.abs(pole.x - pole.want.x) < 0.05 && Math.abs(pole.y - pole.want.y) < 0.05 && Math.abs(pole.power - 1) < 0.05, pole));
      const buzzed = (await h.sent(page)).filter((s) => s.player === 1 && s.msg.t === 'haptic');
      checks.push(h.check('the new touch buzzes its phone', buzzed.length >= 1 && buzzed[0].msg.ms === 30 && buzzed[0].msg.k === 0.6, buzzed));

      // the burst a new touch sets off fades within a second; what is left is the held finger's
      await h.wait(1200);
      const left = await poll(() => sides(page, h), (s) => s.left > s.right * 1.5 + 1);
      checks.push(h.check('the light gathers on the side the phone touches', left.left > left.right * 1.5 + 1, { before, left }));

      // Particles take a while to cross the screen after a finger (seconds, in the real
      // engine), so this watches the centre of the light move rather than waiting for the
      // right side to outshine the left.
      const from = await h.capture(page);
      await page.evaluate(() => { window.__phoneDriver.tx = 0.8; });
      await h.wait(400);
      const moving = await page.evaluate((id) => window.TACTILUME_DESKTOP.hub.poles().find((q) => q.player === id)?.vx ?? null, player?.id);
      checks.push(h.check('a moving finger gives its pole a speed in the direction it moves', moving > 0.3, moving));
      const to = await poll(() => h.capture(page), (c) => c.cx !== null && c.cx >= from.cx + 0.1, { timeout: 12000 });
      checks.push(h.check('the light follows the finger across the screen', from.cx !== null && to.cx >= from.cx + 0.1, { from: from.cx, to: to.cx }));

      // the finger lifts: an empty frame
      await page.evaluate(() => {
        const d = window.__phoneDriver;
        d.on = false;
        window.__tlShim.emit({ type: 'touch', player: 1, seq: d.seq++, touches: [], at: Date.now(), ms: performance.now() });
      });
      const released = await h.until(page, (id) => !window.TACTILUME_DESKTOP.hub.poles().some((q) => q.player === id), player?.id, 5000);
      checks.push(h.check('lifting the finger lets the pole fade away', released));

      // the phone's buttons
      const lock0 = await page.evaluate(() => window.TACTILUME_DESKTOP.store.scene.lock);
      await h.emit(page, { type: 'act', player: 1, a: 'behaviour', v: 1 });
      const lock1 = await page.evaluate(() => window.TACTILUME_DESKTOP.store.scene.lock);
      const heard = (await h.sent(page)).some((s) => s.player === 1 && s.msg.t === 'state' && s.msg.behaviour === lock1);
      checks.push(h.check('the phone\'s behaviour button changes the behaviour, and the phone hears the new one', lock1 !== lock0 && heard, { lock0, lock1 }));
      const buzzes = (await h.sent(page)).filter((s) => s.msg.t === 'haptic').length;
      await h.emit(page, { type: 'act', player: 1, a: 'pulse', v: 0 });
      await h.wait(80);
      checks.push(h.check('the pulse button buzzes the phone', (await h.sent(page)).filter((s) => s.msg.t === 'haptic').length === buzzes + 1));

      await h.emit(page, { type: 'leave', player: 1 });
      const gone = await h.until(page, () => !window.TACTILUME_DESKTOP.hub.players().some((p) => p.kind === 'phone'), undefined, 5000);
      checks.push(h.check('leaving removes the phone player', gone));
      return checks;
    },
  },

  {
    name: 'phone page: a touch phone joins a running link server and plays with two fingers',
    timeout: 60000,
    async run(_page, h) {
      const checks = [];
      const events = [];
      const port = await freePort();
      const server = createLinkServer({ port, host: '127.0.0.1', staticDir: path.join(DIST, 'phone'), onEvent: (e) => events.push(e) });
      const info = await server.start();
      const origin = `http://127.0.0.1:${info.port}`;
      const touchFrames = () => events.filter((e) => e.type === 'touch');
      const errors = [];
      const offsite = [];
      // A phone: small screen, touch, mobile viewport. Its own browser context, because the
      // runner's context only lets requests reach the test's static server.
      const phone = await h.context.browser().newContext({
        viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36',
      });
      phone.on('page', (p) => {
        p.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
        p.on('console', (m) => {
          // Chromium logs every connection attempt that finds no server; this scenario stops
          // the server on purpose, so those are expected
          if (m.type() === 'error' && !/WebSocket connection to .* failed/.test(m.text())) errors.push(`console error: ${m.text()}`);
        });
      });
      await phone.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(`${origin}/`)) return route.continue();
        offsite.push(url);
        return route.abort();
      });
      // navigator.vibrate exists on Android; a stand-in records what the page asks for
      await phone.addInitScript(() => {
        window.__buzzes = [];
        Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: (ms) => { window.__buzzes.push(ms); return true; } });
      });
      try {
        const p = await phone.newPage();
        await p.goto(`${origin}/#k=${info.token}`);
        const joined = await h.until(p, () => window.TACTILUME_PHONE?.joined === true, undefined, 10000);
        const status = await p.textContent('#status-text');
        checks.push(h.check('the page joins with the code from its address and says which player it is', joined && events.some((e) => e.type === 'join' && e.player === 1) && /Player 1/.test(status), { status, events: events.slice(0, 3) }));

        const layout = await p.evaluate(() => {
          const pad = document.getElementById('pad');
          const r = pad.getBoundingClientRect();
          const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
          // a button's accessible name: its aria-label, or the text a screen reader would read
          const nameOf = (b) => {
            if (b.getAttribute('aria-label')) return b.getAttribute('aria-label').trim();
            const copy = b.cloneNode(true);
            for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
            return copy.textContent.trim();
          };
          const buttons = [...document.querySelectorAll('button')].filter(visible).map((b) => {
            const br = b.getBoundingClientRect();
            return { name: nameOf(b), w: br.width, h: br.height };
          });
          let smallest = 99;
          for (const el of document.querySelectorAll('body *')) {
            const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
            if (hasText && visible(el)) smallest = Math.min(smallest, parseFloat(getComputedStyle(el).fontSize));
          }
          const doc = document.scrollingElement;
          return {
            pad: { left: r.left, top: r.top, width: r.width, height: r.height },
            share: (r.width * r.height) / (innerWidth * innerHeight),
            touchAction: getComputedStyle(pad).touchAction,
            scrolls: doc.scrollHeight > innerHeight + 1 || doc.scrollWidth > innerWidth + 1,
            buttons, smallest,
            note: document.getElementById('sleep-note').textContent,
          };
        });
        checks.push(h.check('the pad fills most of the screen, takes every gesture, and nothing scrolls', layout.share > 0.45 && layout.touchAction === 'none' && !layout.scrolls, layout));
        checks.push(h.check('every button is large and has a name', layout.buttons.length >= 5 && layout.buttons.every((b) => b.name && b.w >= 44 && b.h >= 44), layout.buttons));
        checks.push(h.check('no text is smaller than 14 px', layout.smallest >= 14, layout.smallest));
        checks.push(h.check('the page says the screen may go to sleep', /screen/i.test(layout.note) && /awake|sleep|turns off/i.test(layout.note), layout.note));

        // two fingers down, both moving, through the DevTools protocol
        const cdp = await phone.newCDPSession(p);
        const at = (fx, fy, id) => ({ x: layout.pad.left + fx * layout.pad.width, y: layout.pad.top + fy * layout.pad.height, id });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0.25, 0.5, 1), at(0.75, 0.25, 2)] });
        for (let i = 1; i <= 10; i++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(0.25 + i * 0.02, 0.5, 1), at(0.75, 0.25 + i * 0.02, 2)] });
          await h.wait(20);
        }
        const twoFinger = await poll(() => touchFrames().filter((e) => e.touches.length === 2), (l) => l.length >= 3 && l.at(-1).touches.some((t) => Math.abs(t[1] - 0.45) < 0.01));
        const last = twoFinger.at(-1);
        const a = last?.touches.find((t) => t[1] < 0.6);
        const b = last?.touches.find((t) => t[1] >= 0.6);
        checks.push(h.check('the server hears frames with both fingers where they are on the pad', twoFinger.length >= 3 && a && b && Math.abs(a[1] - 0.45) < 0.01 && Math.abs(a[2] - 0.5) < 0.01 && Math.abs(b[1] - 0.75) < 0.01 && Math.abs(b[2] - 0.45) < 0.01 && a[0] !== b[0], { frames: twoFinger.length, last }));
        // Each of the ten moves moved both fingers: two pointer events, one animation frame. A
        // page that sent a frame per pointer event would send about twenty.
        checks.push(h.check('two fingers moving together make one frame per animation frame, not one per finger', twoFinger.length <= 14, twoFinger.length));
        const seqs = touchFrames().map((e) => e.seq);
        const stamps = touchFrames().map((e) => e.ms);
        checks.push(h.check('frames are numbered in order and carry the phone\'s clock', seqs.every((s, i) => i === 0 || s === seqs[i - 1] + 1) && stamps.every((ms, i) => Number.isFinite(ms) && (i === 0 || ms > stamps[i - 1])), { seqs, stamps }));
        checks.push(h.check('a light shows under each finger on the phone', await p.evaluate(() => document.querySelectorAll('#pad .dot').length) === 2));

        // resting fingers: the frame keeps coming, about four times a second
        const resting0 = touchFrames().length;
        await h.wait(800);
        const repeats = touchFrames().length - resting0;
        checks.push(h.check('while the fingers rest, their frame is repeated a few times a second', repeats >= 2 && repeats <= 8, repeats));

        // The page's own empty frame: it carries the phone's clock and comes at once. (The
        // server would let go of the fingers by itself 1.5 s later, without a clock.)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        const lifted = await poll(() => touchFrames().at(-1), (e) => e && e.touches.length === 0, { timeout: 1000, every: 50 });
        checks.push(h.check('lifting the fingers sends an empty frame', lifted?.touches.length === 0 && Number.isFinite(lifted.ms), lifted));

        await p.tap('button[aria-label="Next behaviour"]');
        const acted = await poll(() => events.find((e) => e.type === 'act'), Boolean, { timeout: 3000 });
        checks.push(h.check('the next-behaviour button sends that action', acted?.a === 'behaviour' && acted?.v === 1, acted));

        server.send(1, state({ behaviour: 'whirl', color: '#56b4e9', players: 2 }));
        server.send(1, haptic(40, 0.5));
        const shown = await poll(() => p.evaluate(() => ({
          behaviour: document.getElementById('behaviour-name').textContent,
          status: document.getElementById('status-text').textContent,
          color: getComputedStyle(document.documentElement).getPropertyValue('--player').trim(),
          buzzes: window.__buzzes.slice(),
        })), (s) => s.behaviour === 'Whirl' && s.buzzes.includes(40), { timeout: 3000 });
        checks.push(h.check('the page shows what the computer says is playing, in the player\'s colour', shown.behaviour === 'Whirl' && /2 playing/.test(shown.status) && shown.color === '#56b4e9', shown));
        checks.push(h.check('a haptic from the computer vibrates the phone', shown.buzzes.includes(40), shown.buzzes));

        // the computer goes away and comes back on the same port: the page finds it again
        await server.stop();
        const lostText = await poll(() => p.textContent('#status-text'), (t) => /Cannot reach/i.test(t), { timeout: 5000 });
        checks.push(h.check('when the computer goes away, the page says so', /Cannot reach/i.test(lostText), lostText));
        const joinsBefore = events.filter((e) => e.type === 'join').length;
        await server.start();
        const rejoined = await h.until(p, () => window.TACTILUME_PHONE.joined === true, undefined, 12000);
        checks.push(h.check('and joins again by itself when it is back', rejoined && events.filter((e) => e.type === 'join').length === joinsBefore + 1 && await p.evaluate(() => window.TACTILUME_PHONE.player) === 1));

        // a phone with an old code is turned away and told what to do
        const stale = await phone.newPage();
        await stale.goto(`${origin}/#k=${'A'.repeat(22)}`);
        const staleText = await poll(() => stale.textContent('#status-text'), (t) => /out of date/i.test(t), { timeout: 5000 });
        const retryHidden = await stale.evaluate(() => document.getElementById('retry-box').hidden);
        checks.push(h.check('a page with an old code is told to scan the new one, and does not keep knocking', /out of date/i.test(staleText) && retryHidden && server.info().phones.length === 1, staleText));
        await stale.close();

        await p.close();
        const left = await poll(() => events.at(-1), (e) => e?.type === 'leave', { timeout: 5000 });
        checks.push(h.check('closing the page is a leave', left?.type === 'leave' && left.player === 1, left));
        checks.push(h.check('the controller page reports no errors', errors.length === 0, errors));
        checks.push(h.check('the controller page loads nothing from anywhere else', offsite.length === 0, offsite));
      } finally {
        await phone.close().catch(() => {});
        await server.stop().catch(() => {});
      }
      return checks;
    },
  },

  {
    // The Phone panel says to type the address into the phone's browser. Typed into the tab
    // that was turned away for an old code, only the #k= part changes: the page does not
    // load again, so it must notice the new code by itself.
    name: 'phone page: a new code typed into the same tab joins, and a phone removed from the panel is told so',
    timeout: 60000,
    async run(_page, h) {
      const checks = [];
      const events = [];
      const server = createLinkServer({ port: await freePort(), host: '127.0.0.1', staticDir: path.join(DIST, 'phone'), onEvent: (e) => events.push(e) });
      const info = await server.start();
      const origin = `http://127.0.0.1:${info.port}`;
      const phone = await h.context.browser().newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
      await phone.route('**/*', (route) => (route.request().url().startsWith(`${origin}/`) ? route.continue() : route.abort()));
      const errors = [];
      phone.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
      try {
        const p = await phone.newPage();
        await p.goto(`${origin}/#k=${'B'.repeat(22)}`);
        const stale = await poll(() => p.textContent('#status-text'), (t) => /out of date/i.test(t), { timeout: 5000 });
        checks.push(h.check('an old code is turned away', /out of date/i.test(stale), stale));

        await p.evaluate((token) => { window.__samePage = true; location.hash = `k=${token}`; }, info.token);
        const joined = await h.until(p, () => window.TACTILUME_PHONE?.joined === true, undefined, 8000);
        const after = await p.evaluate(() => ({ same: window.__samePage === true, status: document.getElementById('status-text').textContent, player: window.TACTILUME_PHONE.player }));
        checks.push(h.check('the new code in the same tab joins, with no reload', joined && after.same && /Player 1/.test(after.status) && events.some((e) => e.type === 'join'), after));

        // removed from the Phone panel: the page says so, and stays out
        const kicked = server.kick(after.player);
        const said = await poll(() => p.evaluate(() => ({
          status: document.getElementById('status-text').textContent,
          state: document.body.dataset.state,
          retry: !document.getElementById('retry-box').hidden,
        })), (s) => /removed/i.test(s.status), { timeout: 5000 });
        checks.push(h.check('a phone removed from the Phone panel is told so in words', kicked && /removed/i.test(said.status) && said.state === 'stopped' && !said.retry, said));
        const joins = events.filter((e) => e.type === 'join').length;
        await h.wait(1500);
        checks.push(h.check('and does not knock again by itself', events.filter((e) => e.type === 'join').length === joins && server.info().phones.length === 0, server.info().phones));
        checks.push(h.check('the controller page reports no errors', errors.length === 0, errors));
      } finally {
        await phone.close().catch(() => {});
        await server.stop().catch(() => {});
      }
      return checks;
    },
  },

  {
    // The help text is what a first-time player reads before joining, so it must not be faded
    // with the sleeping pad; and on the smallest phones every button label must fit whole.
    name: 'phone page: small phones show every label whole, and the help reads clearly before joining',
    async run(page, h) {
      const checks = [];
      const server = createLinkServer({ port: await freePort(), host: '127.0.0.1', staticDir: path.join(DIST, 'phone') });
      const info = await server.start();
      const origin = `http://127.0.0.1:${info.port}`;
      try {
        for (const [width, height] of [[320, 568], [568, 320], [667, 375]]) {
          const phone = await h.context.browser().newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
          await phone.route('**/*', (route) => (route.request().url().startsWith(`${origin}/`) ? route.continue() : route.abort()));
          const p = await phone.newPage();
          // a wrong code: the page stays outside, as a phone does until it joins
          await p.goto(`${origin}/#k=notthecodeAAAAAAAAAAAA`);
          await h.until(p, () => document.body.dataset.state !== 'connecting' && document.body.dataset.state !== 'playing', undefined, 10000);
          const outside = await p.evaluate(() => {
            const help = document.getElementById('pad-help');
            let opacity = 1;
            for (let el = help; el; el = el.parentElement) opacity *= Number(getComputedStyle(el).opacity);
            return { state: document.body.dataset.state, opacity, color: getComputedStyle(help).color };
          });
          checks.push(h.check(`${width}x${height}: before joining, the help text is not faded`, outside.opacity === 1 && outside.color === 'rgb(184, 184, 192)', outside));

          // joined, with the names of what is playing in the labels (a new page: only the
          // address's #code changes, which is not a new load)
          await p.close();
          const q = await phone.newPage();
          await q.goto(`${origin}/#k=${info.token}`);
          checks.push(h.check(`${width}x${height}: the phone joins`, await h.until(q, () => window.TACTILUME_PHONE?.joined === true, undefined, 10000)));
          const cut = await q.evaluate(() => [...document.querySelectorAll('.controls button')]
            .filter((b) => b.getClientRects().length && b.scrollWidth > b.clientWidth)
            .map((b) => `${b.textContent.trim()} (${b.scrollWidth} > ${b.clientWidth})`));
          checks.push(h.check(`${width}x${height}: every button label fits whole`, cut.length === 0, cut));

          // The behaviour's name between its arrows, for every behaviour: whole, inside its box.
          // (On a phone on its side the box was narrower than "Behaviour", and the words were
          // cut off on both sides with no sign of it.)
          const player = await q.evaluate(() => window.TACTILUME_PHONE.player);
          const names = [];
          for (const key of ['auto', 'well', 'whirl', 'burst', 'halo', 'current', 'weave', 'chime', 'storm', 'lattice', 'nova', 'murmur', 'fountain']) {
            server.send(player, state({ behaviour: key }));
            await h.until(q, (k) => document.getElementById('behaviour-name').textContent.toLowerCase() === k, key, 3000);
            names.push(await q.evaluate(() => {
              const box = document.querySelector('.behaviour .value');
              const b = box.getBoundingClientRect();
              const steps = [...document.querySelectorAll('.behaviour .step')].map((s) => s.getBoundingClientRect().width);
              const words = [...box.querySelectorAll('span')].map((s) => {
                const r = s.getBoundingClientRect();
                return { text: s.textContent, whole: s.scrollWidth <= s.clientWidth + 0.5, inside: r.left >= b.left - 0.5 && r.right <= b.right + 0.5, w: r.width };
              });
              return { box: b.width, steps, words };
            }));
          }
          const clipped = names.flatMap((n) => n.words.filter((w) => !w.whole || !w.inside).map((w) => `${w.text} (${Math.round(w.w)} in ${Math.round(n.box)})`));
          checks.push(h.check(`${width}x${height}: the behaviour and its label show whole between the arrows`, clipped.length === 0, clipped));
          checks.push(h.check(`${width}x${height}: the arrows are still easy to press`, names.every((n) => n.steps.every((w) => w >= 44)), names[0]?.steps));
          await phone.close();
        }
      } finally {
        await server.stop().catch(() => {});
      }
      return checks;
    },
  },
];
