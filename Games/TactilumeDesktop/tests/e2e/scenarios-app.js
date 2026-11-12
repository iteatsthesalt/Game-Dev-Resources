// The app as a whole: it boots on WebGPU and reads back what it draws, its overlay works from
// the keyboard and the mouse, its settings outlive a restart, and it hands over to the
// classic engine when WebGPU is missing.

const CENTRE = { x0: 0.4, y0: 0.4, x1: 0.6, y1: 0.6 };
const HOOK_PARTS = ['engine', 'hub', 'store', 'audio', 'ui', 'actions', 'bridge'];
const ACTIONS = ['nextBehaviour', 'setBehaviour', 'nextPalette', 'nextPreset', 'surprise', 'clear', 'pulse', 'adjust', 'toggleUI', 'togglePhonePanel', 'toggleFullscreen', 'toast'];
const DESKTOP_KEY = 'tactilume.desktop.v1';

// The classic engine is up: its own test hook says ready, on the classic page.
const classicReady = () => location.pathname.endsWith('/classic/index.html') && window.TACTILUME?.ready === true;
const desktopReady = () => window.TACTILUME_DESKTOP?.ready === true;

const chip = (name) => `.tl-chip[aria-controls="tl-panel-${name}"]`;

// A panel as the person and the keyboard meet it.
const panelState = (page, name) => page.evaluate((n) => {
  const p = document.getElementById(`tl-panel-${n}`);
  const c = document.querySelector(`.tl-chip[aria-controls="tl-panel-${n}"]`);
  return {
    open: p.classList.contains('is-open'),
    inert: p.inert,
    expanded: c.getAttribute('aria-expanded'),
    focusInside: p.contains(document.activeElement),
    panel: window.TACTILUME_DESKTOP.ui.panel,
  };
}, name);

const toasts = (page) => page.evaluate(() => [...document.querySelectorAll('.tl-toast')].map((t) => t.textContent));

async function reload(page, h) {
  await page.reload();
  if (!(await h.until(page, desktopReady, undefined, 30000))) throw new Error('the renderer was not ready after the reload');
}

// one second of a 440 Hz tone: a 16-bit mono WAV file
function toneWav(seconds = 1, rate = 22050) {
  const n = Math.floor(seconds * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 20000), 44 + i * 2);
  return b;
}

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
          corner: [...document.querySelectorAll('.tl-corner button')].map((b) => b.textContent.trim()),
          intro: document.querySelector('.tl-intro')?.hidden,
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
        h.check('the corner has Phone, Sound, Settings and Full screen', t.corner.join('|') === 'Phone|Sound|Settings|Full screen', t.corner),
        h.check('test=1 shows no first-run hint', t.intro === true),
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
    name: 'app keys: the overlay opens and closes from the keyboard',
    async run(page, h) {
      await h.open(page);
      const checks = [];
      const scene = () => page.evaluate(() => {
        const s = window.TACTILUME_DESKTOP.store.scene;
        return { lock: s.lock, palette: s.palette, name: s.name };
      });
      checks.push(h.check('no panel is open at the start', (await page.evaluate(() => window.TACTILUME_DESKTOP.ui.panel)) === null));

      // P and Esc
      await page.keyboard.press('p');
      let s = await panelState(page, 'phone');
      checks.push(h.check('P opens the phone panel, with the keyboard inside it', s.open && !s.inert && s.expanded === 'true' && s.focusInside && s.panel === 'phone', s));
      await page.keyboard.press('Escape');
      s = await panelState(page, 'phone');
      checks.push(h.check('Esc closes it, and nothing hidden keeps the focus', !s.open && s.inert && s.expanded === 'false' && !s.focusInside && s.panel === null, s));

      // Tab to the Settings button, Enter, then Esc returns the focus to it
      let onSettings = false;
      for (let i = 0; i < 8 && !onSettings; i++) {
        await page.keyboard.press('Tab');
        onSettings = await page.evaluate((sel) => document.activeElement === document.querySelector(sel), chip('settings'));
      }
      checks.push(h.check('Tab reaches the Settings button', onSettings));
      await page.keyboard.press('Enter');
      s = await panelState(page, 'settings');
      checks.push(h.check('Enter on it opens the settings panel', s.open && s.focusInside, s));
      await page.keyboard.press('Escape');
      const back = await page.evaluate((sel) => {
        const el = document.activeElement;
        const style = getComputedStyle(el);
        return { onIt: el === document.querySelector(sel), ring: el.matches(':focus-visible'), outline: style.outlineStyle, width: parseFloat(style.outlineWidth) };
      }, chip('settings'));
      checks.push(h.check('Esc gives the focus back to the button that opened it, with a visible ring', back.onIt && back.ring && back.outline === 'solid' && back.width >= 2, back));

      // one panel at a time
      await page.keyboard.press('s');
      const sound = await panelState(page, 'sound');
      await page.keyboard.press('p');
      const swapped = { sound: await panelState(page, 'sound'), phone: await panelState(page, 'phone') };
      checks.push(h.check('S opens the sound panel, and P then swaps it for the phone panel', sound.open && !swapped.sound.open && swapped.sound.inert && swapped.phone.open, { sound, swapped }));
      await page.keyboard.press('Escape');

      // a held key does not repeat its shortcut
      await page.keyboard.down('p');
      await page.keyboard.down('p');
      await page.keyboard.up('p');
      s = await panelState(page, 'phone');
      checks.push(h.check('holding P opens the panel once instead of flickering it', s.open, s));
      await page.keyboard.press('Escape');

      // H hides, and comes back
      await page.keyboard.press('h');
      const hidden = await page.evaluate(() => ({
        hidden: window.TACTILUME_DESKTOP.ui.hidden,
        corner: getComputedStyle(document.querySelector('.tl-corner')).visibility,
        inert: document.querySelector('.tl-corner').inert,
        show: !document.querySelector('.tl-show').hidden,
      }));
      checks.push(h.check('H hides the controls, leaving a faint way back', hidden.hidden && hidden.corner === 'hidden' && hidden.inert && hidden.show, hidden));
      // while the mouse or keys are in use, that way back is clear to see (3:1 or better),
      // not 14% of itself; it fades only once nobody moves
      await page.mouse.move(200, 200);
      const clear = await h.until(page, () => Number(getComputedStyle(document.querySelector('.tl-show')).opacity) >= 0.8, undefined, 2000);
      checks.push(h.check('with the mouse moving, "Show controls" is clearly visible', clear, await page.evaluate(() => getComputedStyle(document.querySelector('.tl-show')).opacity)));
      await page.keyboard.press('p');
      s = await panelState(page, 'phone');
      const unhidden = await page.evaluate(() => window.TACTILUME_DESKTOP.ui.hidden);
      checks.push(h.check('P while hidden still opens the phone panel, and shows the controls', s.open && !unhidden, { s, unhidden }));
      await page.keyboard.press('Escape');
      await page.keyboard.press('h');
      await page.keyboard.press('h');
      checks.push(h.check('H again shows them', !(await page.evaluate(() => window.TACTILUME_DESKTOP.ui.hidden))));
      // hiding while a corner button has the keyboard must not leave the focus on it, or Space
      // would press that unseen button
      await page.focus(chip('settings'));
      await page.keyboard.press('h');
      const stranded = await page.evaluate(() => document.querySelector('.tl-corner').contains(document.activeElement));
      await page.keyboard.press('h');
      checks.push(h.check('hiding the controls takes the keyboard focus out of them', !stranded));

      // the light's keys
      const s0 = await scene();
      await page.keyboard.press('3');
      const s3 = await scene();
      const said = await toasts(page);
      checks.push(h.check('a toast names the behaviour', said.some((t) => /Burst/.test(t)), said));
      await page.keyboard.press('0');
      const s10 = await scene();
      await page.keyboard.press('b');
      const sb = await scene();
      await page.keyboard.press('Shift+B');
      const sB = await scene();
      checks.push(h.check('3 plays the third behaviour, 0 the tenth, and B and Shift+B step on and back', s3.lock === 'burst' && s10.lock === 'nova' && sb.lock === 'murmur' && sB.lock === 'nova', { s0, s3, s10, sb, sB }));
      await page.keyboard.press(']');
      const p1 = await scene();
      await page.keyboard.press('[');
      const p0 = await scene();
      checks.push(h.check('] and [ step through the palettes', p1.palette !== s0.palette && p0.palette === s0.palette, { s0, p1, p0 }));
      await page.keyboard.press('.');
      const n1 = await scene();
      await page.keyboard.press(',');
      const n0 = await scene();
      checks.push(h.check('. and , step through the scenes', n1.name !== s0.name && n0.name === s0.name, { s0, n1, n0 }));

      // F, and Esc leaving full screen
      await page.keyboard.press('f');
      await h.until(page, () => document.querySelector('.tl-chip[aria-pressed]').getAttribute('aria-pressed') === 'true', undefined, 3000);
      const full = await page.evaluate(() => ({ asked: window.__tlShim.fullscreen, pressed: document.querySelector('.tl-chip[aria-pressed]').getAttribute('aria-pressed') }));
      await page.keyboard.press('Escape');
      await h.until(page, () => window.__tlShim.fullscreen === false && document.querySelector('.tl-chip[aria-pressed]').getAttribute('aria-pressed') === 'false', undefined, 3000);
      const left = await page.evaluate(() => ({ asked: window.__tlShim.fullscreen, pressed: document.querySelector('.tl-chip[aria-pressed]').getAttribute('aria-pressed') }));
      checks.push(h.check('F asks for full screen and the button says so; Esc leaves it', full.asked === true && full.pressed === 'true' && left.asked === false && left.pressed === 'false', { full, left }));

      // Space pulses at the middle of the window. A spy counts the pulses: the light also
      // brightens by itself now and then, so brightness alone could pass by luck.
      await page.evaluate(() => {
        const actions = window.TACTILUME_DESKTOP.actions;
        const pulse = actions.pulse;
        window.__pulses = [];
        actions.pulse = (x, y, ...rest) => { window.__pulses.push([x, y]); return pulse(x, y, ...rest); };
      });
      const before = await h.capture(page, { region: CENTRE });
      await page.keyboard.press('Space');
      await h.waitFrames(page, 2);
      const after = await h.capture(page, { region: CENTRE });
      const pulses = await page.evaluate(() => ({ list: window.__pulses, centre: window.TACTILUME_DESKTOP.engine.screenToWorld(innerWidth / 2, innerHeight / 2), panel: window.TACTILUME_DESKTOP.ui.panel }));
      const atCentre = pulses.list.length === 1 && Math.abs(pulses.list[0][0] - pulses.centre.x) < 0.05 && Math.abs(pulses.list[0][1] - pulses.centre.y) < 0.05;
      checks.push(h.check('Space sends one pulse of light into the middle, and presses no button', atCentre && pulses.panel === null && after.mean > before.mean + 2, { pulses, before: before.mean, after: after.mean }));

      // typing in a text field is not a shortcut
      const lockBefore = (await scene()).lock;
      await page.evaluate(() => {
        const input = document.createElement('input');
        input.id = 'typing-here';
        document.body.append(input);
        input.focus();
      });
      await page.keyboard.type('hp3');
      const typed = await page.evaluate(() => ({ hidden: window.TACTILUME_DESKTOP.ui.hidden, panel: window.TACTILUME_DESKTOP.ui.panel, value: document.getElementById('typing-here').value, lock: window.TACTILUME_DESKTOP.store.scene.lock }));
      checks.push(h.check('letters typed into a text field stay there', typed.value === 'hp3' && !typed.hidden && typed.panel === null && typed.lock === lockBefore, typed));
      return checks;
    },
  },

  {
    name: 'app phone panel: it shows the QR code and address from the bridge',
    async run(page, h) {
      await h.open(page);
      const checks = [];
      await page.click(chip('phone'));
      await h.until(page, () => (document.querySelector('.tl-url')?.textContent || '').startsWith('http'));
      const shown = await page.evaluate(async () => {
        const info = await window.TACTILUME_DESKTOP.bridge.link.info();
        const img = document.querySelector('.tl-qr');
        const src = img.getAttribute('src') || '';
        const prefix = 'data:image/svg+xml;charset=utf-8,';
        const r = img.getBoundingClientRect();
        return {
          info,
          isData: src.startsWith(prefix),
          svg: decodeURIComponent(src.slice(prefix.length)),
          alt: img.alt,
          url: document.querySelector('.tl-url').textContent,
          size: Math.min(r.width, r.height),
          empty: !document.querySelector('.tl-empty').hidden,
        };
      });
      checks.push(h.check('the QR code is the one the bridge made, shown as an image', shown.isData && shown.svg === shown.info.qrSvg && shown.svg.length > 0, { svg: shown.svg.slice(0, 80) }));
      checks.push(h.check('the same address is there as text', shown.url === shown.info.url && /^http:\/\/192\.168\.0\.2:47615\/#k=/.test(shown.url), shown.url));
      checks.push(h.check('the code says what it is to a screen reader', /QR code/.test(shown.alt), shown.alt));
      checks.push(h.check('the code is large enough to scan across a room', shown.size >= 180, shown.size));
      checks.push(h.check('with nobody playing, the panel says so', shown.empty));

      // a phone joins and leaves
      await h.emit(page, { type: 'join', player: 1, name: 'Test phone', caps: { touches: 10, haptics: true } });
      const listed = await h.until(page, () => [...document.querySelectorAll('.tl-player')].some((li) => li.textContent.includes('Test phone')), undefined, 5000);
      const row = await page.evaluate(() => {
        const li = [...document.querySelectorAll('.tl-player')].find((x) => x.textContent.includes('Test phone'));
        const p = window.TACTILUME_DESKTOP.hub.players().find((q) => q.kind === 'phone');
        return li && { text: li.textContent, colour: li.querySelector('.tl-player-dot').style.getPropertyValue('--player'), colorName: p?.colorName || '', empty: !document.querySelector('.tl-empty').hidden };
      });
      checks.push(h.check('a phone that joins is listed by name and number, with its colour shown and named', listed && /Phone 1/.test(row.text) && /^rgb\(/.test(row.colour) && (!row.colorName || row.text.includes(row.colorName)) && !row.empty, row));
      await h.emit(page, { type: 'leave', player: 1 });
      checks.push(h.check('and leaves the list when it goes', await h.until(page, () => !document.querySelector('.tl-player') && !document.querySelector('.tl-empty').hidden, undefined, 5000)));

      // copy the address
      await h.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: h.baseUrl });
      await page.getByRole('button', { name: 'Copy the address' }).click();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      checks.push(h.check('Copy puts the address on the clipboard', copied === shown.url, copied));

      // A new code. The panel also asks the link again every 2 s, so link.info() is held to
      // the old answer meanwhile: only New code's own answer can change what is shown.
      await page.evaluate(async () => {
        const link = window.TACTILUME_DESKTOP.bridge.link;
        const before = await link.info();
        window.__realInfo = link.info;
        link.info = async () => before;
      });
      await page.getByRole('button', { name: 'New code' }).click();
      await h.until(page, (old) => document.querySelector('.tl-url').textContent !== old, shown.url, 5000);
      await page.evaluate(() => { window.TACTILUME_DESKTOP.bridge.link.info = window.__realInfo; });
      const rotated = await page.evaluate(async () => ({ url: document.querySelector('.tl-url').textContent, info: await window.TACTILUME_DESKTOP.bridge.link.info(), n: window.__tlShim.rotations }));
      const said = await toasts(page);
      checks.push(h.check('New code asks the bridge for one and shows it', rotated.n === 1 && rotated.url === rotated.info.url && rotated.url !== shown.url && said.some((t) => /new code/i.test(t)), { rotated, said }));

      // letting new phones join, kept after a restart
      const allow = page.getByRole('switch', { name: 'Let new phones join' });
      const wasOn = await allow.isChecked();
      await allow.click();
      await h.until(page, () => window.__tlShim.settings.allowNewPhones === false, undefined, 3000);
      const off = await page.evaluate(async () => (await window.TACTILUME_DESKTOP.bridge.link.info()).allowNew);
      checks.push(h.check('the switch stops new phones joining', wasOn && off === false, { wasOn, off }));
      await reload(page, h);
      await page.click(chip('phone'));
      await h.until(page, () => (document.querySelector('.tl-url')?.textContent || '').startsWith('http'));
      checks.push(h.check('and stays off after a restart', !(await page.getByRole('switch', { name: 'Let new phones join' }).isChecked())));

      // help for a phone that cannot connect
      await page.getByRole('button', { name: 'Phone cannot connect?' }).click();
      const tips = await page.evaluate(() => [...document.querySelectorAll('.tl-tips li')].filter((li) => li.getClientRects().length).length);
      checks.push(h.check('the connection help opens with tips', tips >= 2, tips));

      // a link that could not start
      await page.evaluate(() => { window.__tlShim.linkRunning = false; });
      await page.keyboard.press('Escape');
      await page.keyboard.press('p');
      await h.until(page, () => !document.querySelector('#tl-panel-phone .tl-notice').hidden, undefined, 5000);
      const broken = await page.evaluate(() => ({ note: document.querySelector('#tl-panel-phone .tl-notice').textContent, joinHidden: document.querySelector('.tl-join').hidden }));
      checks.push(h.check('a link that could not start is explained, with no code to scan', /could not start/.test(broken.note) && broken.joinHidden, broken));
      return checks;
    },
  },

  {
    name: 'app settings: toggles persist after a restart',
    async run(page, h) {
      await h.open(page);
      const checks = [];
      await page.click(chip('settings'));
      const sw = (name) => page.getByRole('switch', { name, exact: true });
      const radio = (group, name) => page.getByRole('radiogroup', { name: group, exact: true }).getByRole('radio', { name, exact: true });

      const start = {
        flashGuard: await sw('Flash guard').isChecked(),
        calm: await sw('Calm mode').isChecked(),
        team: await sw('Team colours').isChecked(),
        buzz: await sw('Buzz and rumble').isChecked(),
        force: await sw('Force WebGPU').isChecked(),
        hdrAuto: await radio('HDR', 'Auto').isChecked(),
      };
      checks.push(h.check('the defaults: flash guard on, calm off, team colours on, buzz on, WebGPU not forced, HDR auto',
        start.flashGuard && !start.calm && start.team && start.buzz && !start.force && start.hdrAuto, start));

      // The Graphics facts refresh every second; the list itself must stay, so a screen reader
      // moving through it is not thrown back to its start. Only a changed value is rewritten.
      await page.evaluate(() => {
        window.__factNodes = [...document.querySelectorAll('.tl-facts dt, .tl-facts dd')];
      });
      await h.wait(2300);
      const facts = await page.evaluate(() => ({
        before: window.__factNodes.length,
        kept: window.__factNodes.filter((n) => n.isConnected).length,
      }));
      checks.push(h.check('the Graphics facts are updated in place, not rebuilt each second', facts.before >= 8 && facts.kept === facts.before, facts));

      await sw('Flash guard').click();
      await sw('Calm mode').click();
      await sw('Team colours').click();
      await sw('Buzz and rumble').click();
      await radio('HDR', 'Off').check();
      await radio('Control size', 'Large').check();
      await sw('Force WebGPU').click();
      await h.until(page, () => window.__tlShim.settings.forceWebGPU === true, undefined, 3000);

      const applied = await page.evaluate(() => {
        const s = window.TACTILUME_DESKTOP.settings();
        return {
          flashGuard: s.flashGuard, calm: s.calm, teamColors: s.teamColors, haptics: s.haptics, hdr: s.hdr, uiScale: s.uiScale,
          scale: document.getElementById('ui').style.getPropertyValue('--ui-scale'),
          force: window.__tlShim.settings.forceWebGPU,
        };
      });
      checks.push(h.check('each one reaches what the engine and the inputs read',
        applied.flashGuard === false && applied.calm === true && applied.teamColors === false && applied.haptics === false && applied.hdr === 'off' && applied.uiScale === 1.25, applied));
      checks.push(h.check('Control size makes the controls larger at once', applied.scale === '1.250', applied.scale));
      checks.push(h.check('Force WebGPU goes to the main process', applied.force === true, applied));

      await reload(page, h);
      await page.click(chip('settings'));
      const kept = {
        flashGuard: await sw('Flash guard').isChecked(),
        calm: await sw('Calm mode').isChecked(),
        team: await sw('Team colours').isChecked(),
        buzz: await sw('Buzz and rumble').isChecked(),
        force: await sw('Force WebGPU').isChecked(),
        hdrOff: await radio('HDR', 'Off').isChecked(),
        large: await radio('Control size', 'Large').isChecked(),
      };
      checks.push(h.check('after a restart every switch and choice is as it was left',
        !kept.flashGuard && kept.calm && !kept.team && !kept.buzz && kept.force && kept.hdrOff && kept.large, kept));
      const engineSees = await page.evaluate(() => {
        const s = window.TACTILUME_DESKTOP.settings();
        return { flashGuard: s.flashGuard, teamColors: s.teamColors, hdr: s.hdr };
      });
      checks.push(h.check('and the engine starts with them', engineSees.flashGuard === false && engineSees.teamColors === false && engineSees.hdr === 'off', engineSees));
      return checks;
    },
  },

  {
    name: 'app particles: Measure again, and a count chosen by hand',
    timeout: 120000,
    async run(page, h) {
      // A count measured on another graphics card, set once (not again on reload).
      await page.addInitScript((key) => {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem(key, JSON.stringify({ particles: 20000, particleMode: 'auto', calibratedFor: 'another graphics card' }));
      }, DESKTOP_KEY);
      await h.open(page, { particles: null });
      const checks = [];
      const facts = () => page.evaluate(() => {
        const d = window.TACTILUME_DESKTOP;
        const a = d.engine.caps.adapter;
        return { now: d.engine.stats.particles, max: d.engine.caps.maxParticles, desktop: d.desktop.get(), key: [a.vendor, a.architecture, a.description].join('|') };
      });
      const f0 = await facts();
      checks.push(h.check('it starts at the stored count', f0.now === 20000, f0));

      await page.click(chip('settings'));
      await page.getByRole('button', { name: 'Measure again' }).click();
      const card = await h.until(page, () => !document.querySelector('.tl-measure').hidden, undefined, 3000);
      const measured = await h.until(page, (key) => window.TACTILUME_DESKTOP.desktop.get().calibratedFor === key && document.querySelector('.tl-measure').hidden, f0.key, 60000);
      const f1 = await facts();
      const said = await toasts(page);
      checks.push(h.check('Measure again shows that it is measuring', card));
      checks.push(h.check('it measures this graphics card, and plays at the count it picked',
        measured && f1.desktop.particles === f1.now && f1.now >= 1024 && f1.now <= f1.max && f1.desktop.particleMode === 'auto', f1));
      checks.push(h.check('a toast says what it found', said.some((t) => /Measured/.test(t)), said));
      checks.push(h.check('the light plays on afterwards', await h.waitFrames(page, 3)));

      await page.getByRole('radiogroup', { name: 'Amount of light' }).getByRole('radio', { name: 'Choose' }).check();
      await page.getByLabel('Particles').selectOption('25000');
      await h.until(page, () => window.TACTILUME_DESKTOP.engine.stats.particles === 25000, undefined, 10000);
      const f2 = await facts();
      checks.push(h.check('a count chosen by hand is used, and the measured one is kept',
        f2.now === 25000 && f2.desktop.particleMode === 'manual' && f2.desktop.manualParticles === 25000 && f2.desktop.particles === f1.desktop.particles, f2));

      await reload(page, h);
      const f3 = await facts();
      await page.click(chip('settings'));
      const shownCount = await page.getByLabel('Particles').inputValue();
      checks.push(h.check('after a restart the chosen count is back, and shown', f3.now === 25000 && shownCount === '25000', { f3, shownCount }));

      // a measurement would show its card: watch for one
      await page.evaluate(() => {
        window.__measuredAgain = false;
        const card = document.querySelector('.tl-measure');
        new MutationObserver(() => { if (!card.hidden) window.__measuredAgain = true; }).observe(card, { attributes: true });
      });
      await page.getByRole('radiogroup', { name: 'Amount of light' }).getByRole('radio', { name: 'Auto' }).check();
      await h.until(page, (n) => window.TACTILUME_DESKTOP.engine.stats.particles === n, f1.desktop.particles, 10000);
      await h.waitFrames(page, 3);
      const f4 = { ...(await facts()), again: await page.evaluate(() => window.__measuredAgain) };
      checks.push(h.check('Auto goes back to the measured count without measuring again', f4.now === f1.desktop.particles && f4.desktop.particleMode === 'auto' && f4.desktop.calibratedFor === f0.key && f4.again === false, f4));
      return checks;
    },
  },

  {
    name: 'app sound panel: sources, a chosen or dropped music file, and errors in words',
    async run(page, h) {
      await h.open(page);
      const checks = [];
      const state = () => page.evaluate(() => {
        const notice = document.querySelector('#tl-panel-sound .tl-notice');
        return {
          source: window.TACTILUME_DESKTOP.audio.source,
          pressed: [...document.querySelectorAll('.tl-source')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.source),
          system: !document.querySelector('.tl-source[data-source="system"]').hidden,
          notice: notice.hidden ? '' : notice.textContent,
          error: notice.classList.contains('is-error'),
          song: document.querySelector('.tl-song').hidden ? '' : document.querySelector('.tl-song-name').textContent,
          bars: [...document.querySelectorAll('.tl-meter-fill')].map((b) => Number(b.style.getPropertyValue('--v')) || 0),
        };
      });
      await page.keyboard.press('s');
      const s0 = await state();
      checks.push(h.check('it starts off, and offers no computer audio where the system cannot capture it', s0.source === 'off' && s0.pressed.join() === 'off' && !s0.system, s0));
      await page.evaluate(() => { window.__tlShim.systemAudio = { supported: true, how: 'loopback' }; });
      await page.keyboard.press('Escape');
      await page.keyboard.press('s');
      checks.push(h.check('where it can, Computer audio is offered', await h.until(page, () => !document.querySelector('.tl-source[data-source="system"]').hidden, undefined, 3000)));

      // this browser has no microphone: the panel says so in words, and stays off
      await page.click('.tl-source[data-source="mic"]');
      await h.until(page, () => !document.querySelector('#tl-panel-sound .tl-notice').hidden, undefined, 5000);
      const s1 = await state();
      checks.push(h.check('a microphone that cannot start is explained in a sentence, and the sound stays off', s1.error && /\w.*\.$/.test(s1.notice) && s1.source === 'off' && s1.pressed.join() === 'off', s1));

      // a music file chosen with the picker plays, is named, and moves the meter
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.tl-source[data-source="file"]')]);
      await chooser.setFiles({ name: 'tone.wav', mimeType: 'audio/wav', buffer: toneWav(2) });
      await h.until(page, () => window.TACTILUME_DESKTOP.audio.source === 'file', undefined, 10000);
      const heard = await h.until(page, () => [...document.querySelectorAll('.tl-meter-fill')].some((b) => Number(b.style.getPropertyValue('--v')) > 0.05), undefined, 5000);
      const s2 = await state();
      const said = await toasts(page);
      checks.push(h.check('a chosen music file plays and is named', s2.source === 'file' && s2.pressed.join() === 'file' && s2.song === 'tone.wav' && !s2.notice, s2));
      checks.push(h.check('the meter shows what the light hears', heard, s2.bars));
      checks.push(h.check('a toast says what is playing', said.some((t) => /Playing tone\.wav/.test(t)), said));

      await page.click('.tl-source[data-source="off"]');
      const s3 = await state();
      checks.push(h.check('Off stops it', s3.source === 'off' && s3.pressed.join() === 'off' && !s3.song, s3));

      // files dropped on the window
      const drop = (name, type, bytes) => page.evaluate(({ name, type, bytes }) => {
        const dt = new DataTransfer();
        dt.items.add(new File([new Uint8Array(bytes)], name, { type }));
        const e = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true });
        document.getElementById('stage').dispatchEvent(e);
        return e.defaultPrevented;
      }, { name, type, bytes });
      const where = page.url();
      const notMusic = await drop('notes.txt', 'text/plain', [104, 105]);
      await h.until(page, () => [...document.querySelectorAll('.tl-toast')].some((t) => /not a music file/.test(t.textContent)), undefined, 3000);
      checks.push(h.check('a dropped file that is not music is refused in words, and the page stays', notMusic && page.url() === where && (await toasts(page)).some((t) => /not a music file/.test(t))));
      const music = await drop('drop.wav', 'audio/wav', [...toneWav(1)]);
      const played = await h.until(page, () => window.TACTILUME_DESKTOP.audio.source === 'file' && window.TACTILUME_DESKTOP.audio.label === 'drop.wav', undefined, 10000);
      checks.push(h.check('a dropped music file plays', music && played, await state()));
      return checks;
    },
  },

  {
    name: 'app cursors: each gamepad cursor gets a ring in its player\'s colour',
    async run(page, h) {
      await h.fakeGamepads(page, 1);
      await h.open(page);
      const checks = [];
      // the first press only joins the pad
      await h.setPad(page, 0, { buttons: { a: true } });
      await h.waitFrames(page, 2);
      await h.setPad(page, 0, { buttons: { a: false } });
      const joined = await h.until(page, () => window.TACTILUME_DESKTOP.ui.cursors.length === 2, undefined, 5000);
      const rings = await page.evaluate(() => window.TACTILUME_DESKTOP.ui.cursors);
      const pad = await page.evaluate(() => window.TACTILUME_DESKTOP.hub.players().find((p) => p.kind === 'gamepad') || null);
      checks.push(h.check('a pad that joins gets two rings, named for the pad and the stick', joined && rings.map((r) => r.label).sort().join('|') === 'Pad 1 L|Pad 1 R', rings));
      checks.push(h.check('in the pad player\'s colour', !!pad && rings.every((r) => r.color.join() === pad.color.join()), { rings, pad }));
      // where the gamepad module says each cursor is (fractions of the window)
      const placed = await page.evaluate(() => {
        const said = window.TACTILUME_DESKTOP.gamepads.cursors();
        return window.TACTILUME_DESKTOP.ui.cursors.map((r, i) => ({ dx: r.px - said[i].x * innerWidth, dy: r.py - said[i].y * innerHeight }));
      });
      checks.push(h.check('each ring is where its cursor is', placed.length === 2 && placed.every((p) => Math.abs(p.dx) < 1 && Math.abs(p.dy) < 1), placed));

      // What the overlay canvas shows: the colour on the ring, and nothing past it. A ring at
      // power 0 has a radius of 15 CSS px (the scale is 1 in this window).
      const look = (i, radius) => page.evaluate(({ i, radius }) => {
        const c = window.TACTILUME_DESKTOP.ui.cursors[i];
        const canvas = document.getElementById('cursors');
        const k = canvas.width / innerWidth;
        const ctx = canvas.getContext('2d');
        const at = (dx, dy) => {
          const d = ctx.getImageData(Math.round((c.px + dx) * k), Math.round((c.py + dy) * k), 1, 1).data;
          return [d[0], d[1], d[2], d[3]];
        };
        const ring = [];
        for (let a = 0; a < 16; a++) ring.push(at(Math.cos((a / 16) * Math.PI * 2) * radius, Math.sin((a / 16) * Math.PI * 2) * radius));
        const mean = [0, 1, 2, 3].map((j) => ring.reduce((s, p) => s + p[j], 0) / ring.length);
        return { mean, centre: at(0, 0), outside: at(radius + 9, 0), held: c.held };
      }, { i, radius });
      const near = (rgb, color) => color.every((v, j) => Math.abs(rgb[j] - v * 255) < 60);
      const left = await look(0, 15);
      checks.push(h.check('the ring is drawn in the player\'s colour, with a dot at its centre, and nothing beyond it',
        left.mean[3] > 200 && near(left.mean, pad.color) && left.centre[3] > 200 && left.outside[3] === 0, { left, color: pad.color }));

      // pulling the right trigger holds the right cursor down: its ring grows and fills
      await h.setPad(page, 0, { buttons: { rt: 1 } });
      const held = await h.until(page, () => window.TACTILUME_DESKTOP.ui.cursors.some((c) => c.label === 'Pad 1 R' && c.held && c.power > 0.5), undefined, 5000);
      const i = await page.evaluate(() => window.TACTILUME_DESKTOP.ui.cursors.findIndex((c) => c.label === 'Pad 1 R'));
      const right = await look(i, 24);
      const inside = await look(i, 10);
      checks.push(h.check('a held cursor\'s ring grows and fills in', held && right.mean[3] > 200 && inside.mean[3] > 20 && inside.mean[3] < 200, { right, inside }));
      await h.setPad(page, 0, { buttons: { rt: 0 } });

      // a gamepad player the gamepad module does not report is drawn from its poles
      const spare = await page.evaluate(() => {
        const d = window.TACTILUME_DESKTOP;
        const p = d.hub.addPlayer({ kind: 'gamepad', name: 'Spare pad', key: 'spare' });
        d.hub.setPoles(p.id, [{ x: 0.2, y: -0.1, vx: 0, vy: 0, power: 1, age: 0, held: true, id: 'spare0', kind: 'touch', fade: 1 }]);
        return d.engine.worldToScreen(0.2, -0.1);
      });
      await h.waitFrames(page, 2);
      const fromPoles = await page.evaluate(() => window.TACTILUME_DESKTOP.ui.cursors.find((c) => c.label === 'Spare pad') || null);
      checks.push(h.check('a gamepad player known only by its poles still gets a ring where its pole is',
        !!fromPoles && Math.abs(fromPoles.px - spare.px) < 1 && Math.abs(fromPoles.py - spare.py) < 1, { fromPoles, spare }));

      // the rings are only over the light, never in its picture
      const separate = await page.evaluate(() => {
        const overlay = document.getElementById('cursors');
        return overlay !== document.getElementById('stage') && getComputedStyle(overlay).pointerEvents === 'none' && overlay.getAttribute('aria-hidden') === 'true';
      });
      checks.push(h.check('the rings live on their own canvas, which takes no clicks and is hidden from screen readers', separate));
      return checks;
    },
  },

  {
    name: 'app first run: a hint shows once and goes at the first touch',
    async run(page, h) {
      // without test=1: the hint is part of a real first start
      await h.open(page, { test: null });
      const checks = [];
      const shown = await h.until(page, () => {
        const el = document.querySelector('.tl-intro');
        return el && !el.hidden && el.textContent.includes('Drag across the light');
      }, undefined, 5000);
      const text = await page.evaluate(() => document.querySelector('.tl-intro').textContent);
      checks.push(h.check('a first start shows how to play: drag, phones, gamepads, sound, hiding and full screen', shown && ['Drag', 'phones', 'gamepad', 'sound', 'Hide', 'Full screen'].every((w) => text.includes(w)), text));
      // on the light, left of the hint's card
      await page.mouse.click(40, 250);
      const gone = await h.until(page, () => document.querySelector('.tl-intro').hidden, undefined, 3000);
      const remembered = await page.evaluate(() => window.TACTILUME_DESKTOP.desktop.get().intro);
      checks.push(h.check('touching the light puts it away, for good', gone && remembered === false, { gone, remembered }));
      await reload(page, h);
      await h.waitFrames(page, 3);
      checks.push(h.check('the next start shows no hint', await page.evaluate(() => document.querySelector('.tl-intro').hidden)));
      return checks;
    },
  },

  {
    name: 'app idle: the corner fades after 4 s and any input brings it back',
    async run(page, h) {
      await h.open(page);
      const checks = [];
      const look = () => page.evaluate(() => ({
        idle: window.TACTILUME_DESKTOP.ui.idle,
        opacity: Number(getComputedStyle(document.querySelector('.tl-corner')).opacity),
        pointer: getComputedStyle(document.getElementById('stage')).cursor,
      }));
      // an open panel keeps the controls there
      await page.keyboard.press('p');
      await h.wait(4600);
      const withPanel = await look();
      checks.push(h.check('with a panel open, nothing fades', !withPanel.idle, withPanel));
      await page.keyboard.press('Escape');
      await page.mouse.move(300, 300);
      await h.wait(4600);
      const faded = await h.until(page, () => window.TACTILUME_DESKTOP.ui.idle && Number(getComputedStyle(document.querySelector('.tl-corner')).opacity) < 0.05, undefined, 2000);
      const idle = await look();
      checks.push(h.check('after 4 s with no input, the corner fades out and the mouse pointer hides over the light', faded && idle.pointer === 'none', idle));
      await page.mouse.move(320, 310);
      const awake = await h.until(page, () => !window.TACTILUME_DESKTOP.ui.idle && Number(getComputedStyle(document.querySelector('.tl-corner')).opacity) > 0.95, undefined, 2000);
      const back = await look();
      checks.push(h.check('a mouse move brings them back', awake && back.pointer !== 'none', back));
      await h.wait(4600);
      await page.keyboard.press('Shift');
      checks.push(h.check('so does a key', await h.until(page, () => !window.TACTILUME_DESKTOP.ui.idle, undefined, 2000)));
      // dragging across the light is playing: the controls fade during a long drag all the same
      await page.mouse.move(200, 250);
      await page.mouse.down();
      for (let i = 0; i < 26; i++) {
        await page.mouse.move(200 + (i % 2 ? 40 : -40), 250 + i * 2);
        await h.wait(200);
      }
      const duringDrag = await page.evaluate(() => window.TACTILUME_DESKTOP.ui.idle);
      await page.mouse.up();
      checks.push(h.check('a long drag across the light lets the controls fade', duringDrag));
      return checks;
    },
  },

  {
    name: 'app access: names, focus rings and readable text from 1080p to 4K',
    viewport: { width: 1920, height: 1080 },
    async run(page, h) {
      await h.open(page);
      const checks = [];
      // every control a person can reach in the open panel (and the corner) has a name, and
      // every piece of text on screen is at least 14 px
      const audit = () => page.evaluate(() => {
        const visible = (el) => {
          if (el.closest('[inert], [hidden]')) return false;
          const s = getComputedStyle(el);
          return s.visibility !== 'hidden' && s.display !== 'none' && el.getClientRects().length > 0;
        };
        const nameOf = (el) => {
          const label = el.getAttribute('aria-label');
          if (label) return label.trim();
          const by = el.getAttribute('aria-labelledby');
          if (by) return by.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ').trim();
          if (el.labels?.length) return [...el.labels].map((l) => l.textContent).join(' ').trim();
          if (el.tagName === 'IMG') return el.alt;
          return (el.textContent || el.title || '').trim();
        };
        const controls = [...document.querySelectorAll('#ui button, #ui input:not([type="file"]), #ui select, #ui img, #ui [role="radiogroup"], #ui [role="dialog"]')].filter(visible);
        const unnamed = controls.filter((el) => !nameOf(el)).map((el) => el.outerHTML.slice(0, 100));
        const small = [];
        const walker = document.createTreeWalker(document.getElementById('ui'), NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!n.textContent.trim() || !visible(n.parentElement)) continue;
          const px = parseFloat(getComputedStyle(n.parentElement).fontSize);
          if (px < 14) small.push(`${n.textContent.trim().slice(0, 30)} (${px}px)`);
        }
        return { controls: controls.length, unnamed, small };
      });
      const results = {};
      for (const name of ['phone', 'sound', 'settings']) {
        await page.click(chip(name));
        await h.until(page, (n) => window.TACTILUME_DESKTOP.ui.panel === n, name, 3000);
        results[name] = await audit();
      }
      for (const [name, r] of Object.entries(results)) {
        checks.push(h.check(`${name} panel: every control has a name`, r.controls > 5 && !r.unnamed.length, r.unnamed));
        checks.push(h.check(`${name} panel: no text below 14 px`, !r.small.length, r.small));
      }
      await page.keyboard.press('Escape');

      // the focus ring on a corner button
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('Tab');
      const ring = await page.evaluate(() => {
        const s = getComputedStyle(document.activeElement);
        return { tag: document.activeElement.className, style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor, halo: s.boxShadow };
      });
      checks.push(h.check('a key-focused button shows a ring of light with a dark halo', ring.style === 'solid' && ring.width >= 2 && /255, 255, 255/.test(ring.color) && ring.halo !== 'none', ring));

      // the controls grow with the screen
      // The window's size changes at once, but its resize event (which rescales the controls)
      // comes with the next frame, and frames are slow at 4K on a software GPU: wait for it.
      const sizeAt = async (width, height, scale) => {
        await page.setViewportSize({ width, height });
        await h.until(page, (want) => Math.abs(Number(document.getElementById('ui').style.getPropertyValue('--ui-scale')) - want) < 0.01, scale, 5000);
        return page.evaluate(() => ({
          scale: Number(document.getElementById('ui').style.getPropertyValue('--ui-scale')),
          chip: parseFloat(getComputedStyle(document.querySelector('.tl-chip')).fontSize),
          tall: document.querySelector('.tl-chip').getBoundingClientRect().height,
        }));
      };
      const hd = await sizeAt(1920, 1080, 1.08);
      const uhd = await sizeAt(3840, 2160, 2.16);
      await page.setViewportSize({ width: 1920, height: 1080 });
      checks.push(h.check('at 1080p the controls are at their normal size', Math.abs(hd.scale - 1.08) < 0.01 && hd.chip >= 15, hd));
      checks.push(h.check('at 4K they are twice that, so they read the same from the same place', Math.abs(uhd.scale - 2.16) < 0.01 && uhd.chip >= 30 && uhd.tall >= 2 * hd.tall - 2, uhd));

      // less motion when the system asks for it
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.evaluate(() => window.TACTILUME_DESKTOP.actions.toast('A still toast'));
      const motion = await page.evaluate(() => getComputedStyle(document.querySelector('.tl-toast')).transitionDuration);
      checks.push(h.check('with reduced motion asked for, the overlay does not animate', motion.split(',').every((d) => parseFloat(d) <= 0.001), motion));
      return checks;
    },
  },

  {
    name: 'app fallback: without WebGPU the classic engine runs',
    async run(page, h) {
      // Records every Content-Security-Policy violation, and stands in for the preload bridge
      // on the classic page (the renderer's own shim does not travel with the hand-over).
      await page.addInitScript(() => {
        window.__cspViolations = [];
        addEventListener('securitypolicyviolation', (e) => window.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`));
        if (location.pathname.endsWith('/classic/index.html')) {
          window.__setSettings = [];
          window.tactilume = {
            platform: 'linux',
            app: {
              getSettings: async () => ({ forceWebGPU: false }),
              setSettings: async (p) => { window.__setSettings.push(p); return p; },
            },
          };
        }
      });
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

      // It runs under a policy of its own, as strict as the renderer's, and nothing it does
      // breaks that policy.
      const policy = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '');
      checks.push(h.check('the classic page has a strict Content-Security-Policy', /script-src 'self' 'sha256-[A-Za-z0-9+/=]{44}'/.test(policy) && /connect-src 'none'/.test(policy) && /object-src 'none'/.test(policy), policy));
      checks.push(h.check('the classic engine boots without breaking it', forced && (await page.evaluate(() => window.__cspViolations)).length === 0, await page.evaluate(() => window.__cspViolations)));

      // The strip says what is missing and how to get it, and its button does what the menu does.
      const strip = page.locator('.tl-desk-strip');
      const shown = await strip.isVisible().catch(() => false);
      const words = shown ? await strip.innerText() : '';
      checks.push(h.check('a strip says phones and gamepads are off, and where to turn WebGPU on',
        shown && /phones and gamepads cannot join/i.test(words) && /Graphics > Force WebGPU on This Computer/.test(words) && /press Alt/.test(words), words));
      await page.keyboard.press('Tab');
      const firstTab = await page.evaluate(() => document.activeElement?.textContent || '');
      checks.push(h.check('the first Tab reaches its button', firstTab === 'Turn on WebGPU', firstTab));
      await page.keyboard.press('Enter');
      const asked = await h.until(page, () => window.__setSettings.length > 0, undefined, 5000);
      checks.push(h.check('the button asks for WebGPU through the bridge', asked && JSON.stringify(await page.evaluate(() => window.__setSettings)) === '[{"forceWebGPU":true}]'));
      checks.push(h.check('and says it applies from the next start', /next start/.test(await strip.locator('[role="status"]').innerText().catch(() => ''))));
      if (shown) await page.getByRole('button', { name: 'Dismiss this message' }).click();
      checks.push(h.check('Dismiss takes the strip away', shown && await strip.count() === 0));

      // a browser that has no WebGPU at all finds that out by itself
      const bare = await h.context.newPage();
      await bare.addInitScript(() => Object.defineProperty(Navigator.prototype, 'gpu', { configurable: true, get: () => undefined }));
      await bare.goto(h.url());
      checks.push(h.check('with no navigator.gpu it hands over as well', await h.until(bare, classicReady, undefined, 30000), bare.url()));
      return checks;
    },
  },
];
