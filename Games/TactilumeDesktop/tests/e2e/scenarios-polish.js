// The second polish pass, in the browser: what the overlay says about each input (the
// first-run hint, the hide toast, key names), gamepads that are plugged in but have not
// joined, the requirement tier in Settings, and the Phone panel telling the host who joined,
// letting them remove a phone, and bringing its help into view when nobody can join.

const DESKTOP_KEY = 'tactilume.desktop.v1';
const chip = (name) => `.tl-chip[aria-controls="tl-panel-${name}"]`;
const toasts = (page) => page.evaluate(() => [...document.querySelectorAll('.tl-toast')].map((t) => t.textContent));
const padPrompts = (page) => page.evaluate(() => [...document.querySelectorAll('.tl-pads li')].filter((li) => li.getClientRects().length).map((li) => li.textContent));
// a row of the GPU facts in Settings, by its name
const fact = (page, name) => page.evaluate((n) => {
  const dt = [...document.querySelectorAll('#tl-panel-settings .tl-facts dt')].find((d) => d.textContent === n);
  return dt ? dt.nextElementSibling.textContent : null;
}, name);

export default [
  {
    name: 'app words: the first-run hint, the hide toast and the key names say what each input does',
    async run(page, h) {
      // without test=1: the hint is part of a real first start
      await h.open(page, { test: null });
      const checks = [];
      await h.until(page, () => !document.querySelector('.tl-intro').hidden, undefined, 5000);
      const intro = await page.evaluate(() => [...document.querySelectorAll('.tl-intro li')].map((li) => ({
        text: li.textContent, keys: [...li.querySelectorAll('kbd')].map((k) => k.textContent), icon: !!li.querySelector('svg'),
      })));
      const pad = intro.find((l) => /gamepad/i.test(l.text));
      // "A" drawn as a keycap read as a keyboard key, which does nothing; and any button joins
      checks.push(h.check('the hint shows the gamepad as a gamepad, and says any button joins', pad && pad.icon && pad.keys.length === 0 && /any button/i.test(pad.text) && !intro.some((l) => l.keys.includes('A')), intro));

      const shortcuts = await page.evaluate(() => [...document.querySelectorAll('[aria-keyshortcuts]')].map((el) => ({ label: el.textContent.trim(), keys: el.getAttribute('aria-keyshortcuts') })));
      const settingsKeys = await page.evaluate((sel) => document.querySelector(sel).hasAttribute('aria-keyshortcuts'), chip('settings'));
      checks.push(h.check('no control claims an empty keyboard shortcut', shortcuts.every((s) => s.keys.trim() !== '') && !settingsKeys, shortcuts));

      await page.click(chip('settings'));
      const keys = await page.evaluate(() => [...document.querySelectorAll('#tl-panel-settings .tl-keys kbd')].map((k) => k.textContent));
      checks.push(h.check('the Keys list in Settings names F11 as well as F', keys.includes('F') && keys.includes('F11'), keys));
      await page.keyboard.press('Escape');

      // hidden from a gamepad (Start): the way back is named for both
      await page.evaluate(() => window.TACTILUME_DESKTOP.actions.toggleUI());
      const said = await toasts(page);
      checks.push(h.check('hiding the controls says how to bring them back from the keyboard and from a gamepad', said.some((t) => /\bH\b/.test(t) && /Start/.test(t) && /gamepad/i.test(t)), said));
      return checks;
    },
  },

  {
    name: 'app gamepads: a pad that is plugged in but has not joined is asked to press a button',
    async run(page, h) {
      await h.fakeGamepads(page, 2);
      await h.open(page);
      const checks = [];
      await h.setPad(page, 1, { mapping: '' });
      await h.until(page, () => document.querySelectorAll('.tl-pads li').length === 2 && /other places/.test(document.querySelector('.tl-pads').textContent), undefined, 5000);
      const before = await padPrompts(page);
      checks.push(h.check('each pad waiting to join is asked to press any button', before.some((t) => /^Gamepad 1: press any button to join/.test(t)) && before.some((t) => /^Gamepad 2: press any button to join/.test(t)), before));
      const note = before.find((t) => t.startsWith('Gamepad 2')) || '';
      const plain = before.find((t) => t.startsWith('Gamepad 1')) || '';
      checks.push(h.check('a pad without the standard layout is told its buttons may be elsewhere', /buttons may be in other places/i.test(note) && !/other places/i.test(plain), { note, plain }));
      const region = await page.evaluate(() => {
        const el = document.querySelector('.tl-pads');
        return { live: el.getAttribute('aria-live'), size: parseFloat(getComputedStyle(el.querySelector('li')).fontSize) };
      });
      checks.push(h.check('the prompt is read out, and is large enough to read', region.live === 'polite' && region.size >= 14, region));

      await h.setPad(page, 0, { buttons: { a: true } });
      await h.waitFrames(page, 2);
      await h.setPad(page, 0, { buttons: { a: false } });
      await h.until(page, () => window.TACTILUME_DESKTOP.hub.players().some((p) => p.kind === 'gamepad'), undefined, 5000);
      await h.until(page, () => document.querySelectorAll('.tl-pads li').length === 1, undefined, 5000);
      const after = await padPrompts(page);
      checks.push(h.check('a pad that joins is no longer asked', after.length === 1 && after[0].startsWith('Gamepad 2'), after));
      return checks;
    },
  },

  {
    name: 'app tier: Settings names the requirement tier this computer meets',
    async run(page, h) {
      await page.addInitScript((key) => {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem(key, JSON.stringify({ particles: 20000000, particleMode: 'auto', calibratedFor: 'the reference laptop' }));
      }, DESKTOP_KEY);
      await h.open(page);
      const checks = [];
      await page.click(chip('settings'));
      await h.until(page, () => [...document.querySelectorAll('#tl-panel-settings .tl-facts dt')].some((d) => d.textContent === 'Tier'), undefined, 5000);
      const tier = await fact(page, 'Tier');
      const order = await page.evaluate(() => [...document.querySelectorAll('#tl-panel-settings .tl-facts dt')].map((d) => d.textContent));
      checks.push(h.check('a measured 20 million at 60 Hz is the Reference tier', /^Reference\b/.test(tier || '') && /15/.test(tier), tier));
      checks.push(h.check('it sits with the graphics and the particle count', order.indexOf('Tier') > order.indexOf('Graphics') && Math.abs(order.indexOf('Tier') - order.indexOf('Particles')) === 1, order));
      await page.evaluate(() => window.TACTILUME_DESKTOP.desktop.set({ particles: 0 }));
      const none = await h.until(page, () => {
        const dt = [...document.querySelectorAll('#tl-panel-settings .tl-facts dt')].find((d) => d.textContent === 'Tier');
        return dt && /not measured/i.test(dt.nextElementSibling.textContent);
      }, undefined, 5000);
      checks.push(h.check('with nothing measured it says so', none, await fact(page, 'Tier')));
      return checks;
    },
  },

  {
    name: 'app phone panel: joins are announced, a phone can be removed, and the help comes into view',
    viewport: { width: 1280, height: 720 },
    timeout: 60000,
    async run(page, h) {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await h.open(page);
      const checks = [];
      await h.emit(page, { type: 'join', player: 1, name: 'Ana', caps: { touches: 10, haptics: true } });
      await h.until(page, () => [...document.querySelectorAll('.tl-toast')].some((t) => /Phone 1/.test(t.textContent)), undefined, 3000);
      const colour = await page.evaluate(() => window.TACTILUME_DESKTOP.hub.players().find((p) => p.kind === 'phone').colorName);
      const joined = await toasts(page);
      checks.push(h.check('a phone that joins is announced on the big screen, with its name and colour', joined.some((t) => t === `Phone 1 (Ana) is playing, in ${colour}`), joined));

      // removing it, with a step to think again
      await page.keyboard.press('p');
      await h.until(page, () => [...document.querySelectorAll('.tl-player')].some((li) => li.textContent.includes('Ana')), undefined, 5000);
      const remove = page.getByRole('button', { name: 'Remove Phone 1 (Ana)' });
      await remove.click();
      const asked = await page.evaluate(() => ({
        text: document.querySelector('.tl-player-confirm')?.textContent || '',
        focus: document.activeElement?.textContent || '',
        kicks: window.__tlShim.kicks.slice(),
      }));
      checks.push(h.check('Remove asks first, and nothing happens yet', /Remove Ana/.test(asked.text) && /new code/i.test(asked.text) && asked.kicks.length === 0, asked));
      checks.push(h.check('the safe answer has the focus', /Keep/.test(asked.focus), asked.focus));
      await page.getByRole('button', { name: 'Keep Ana playing' }).click();
      const kept = await page.evaluate(() => ({ kicks: window.__tlShim.kicks.slice(), listed: [...document.querySelectorAll('.tl-player')].some((li) => li.textContent.includes('Ana')), confirm: !!document.querySelector('.tl-player-confirm') }));
      checks.push(h.check('Keep leaves the phone playing', kept.kicks.length === 0 && kept.listed && !kept.confirm, kept));

      const before = await page.evaluate(() => document.querySelector('.tl-url').textContent);
      await page.getByRole('button', { name: 'Remove Phone 1 (Ana)' }).click();
      await page.getByRole('button', { name: 'Remove Phone 1 (Ana) for good' }).click();
      const gone = await h.until(page, () => !document.querySelector('.tl-player') && window.__tlShim.kicks.length === 1, undefined, 5000);
      const after = await page.evaluate(() => ({ kicks: window.__tlShim.kicks.slice(), url: document.querySelector('.tl-url').textContent, players: window.TACTILUME_DESKTOP.hub.players().length }));
      const said = await toasts(page);
      checks.push(h.check('Remove for good asks the link to remove that phone, and it goes', gone && after.kicks[0] === 1 && after.players === 0, after));
      checks.push(h.check('the panel shows the new code at once, and says what happened', after.url !== before && said.some((t) => /removed/i.test(t) && /new code/i.test(t)), { before, after, said }));

      // Nobody has joined for 45 s: the help opens by itself. At 1280 x 720 it is far below
      // the QR code, so it must come into view, or it opens where nobody sees it.
      await page.keyboard.press('Escape');
      await page.clock.install();
      await page.keyboard.press('p');
      await page.clock.runFor(46000);
      const view = await h.until(page, () => {
        const toggle = [...document.querySelectorAll('#tl-panel-phone button')].find((b) => b.textContent.includes('Phone cannot connect?'));
        if (!toggle || toggle.getAttribute('aria-expanded') !== 'true') return false;
        const scroller = toggle.closest('.tl-panel-body') || toggle.parentElement;
        const box = scroller.getBoundingClientRect();
        const r = toggle.getBoundingClientRect();
        return r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
      }, undefined, 5000);
      const where = await page.evaluate(() => {
        const toggle = [...document.querySelectorAll('#tl-panel-phone button')].find((b) => b.textContent.includes('Phone cannot connect?'));
        return { expanded: toggle?.getAttribute('aria-expanded'), top: toggle?.getBoundingClientRect().top, bottom: innerHeight };
      });
      checks.push(h.check('the connection help, opened by itself, is scrolled into view', view, where));
      return checks;
    },
  },
];
