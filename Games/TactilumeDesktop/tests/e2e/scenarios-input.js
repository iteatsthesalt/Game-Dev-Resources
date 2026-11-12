// Inputs and sound in the built renderer. See CONTRACTS.md, "renderer/input/" and
// "renderer/audio/".
//   1. A fake gamepad (helpers.fakeGamepads) joins at its first press; its trigger holds a
//      cursor down as a pole, its stick moves that pole across the screen, and the light
//      follows. It rumbles, its buttons act, and unplugged it leaves.
//   2. With haptics off in the desktop settings, the same pad plays but never rumbles.
//   3. A mouse drag makes Desk's pole under the pointer, the light follows it, a flick
//      glides on after letting go, a right click makes nothing, and a pen's pressure is its
//      strength.
//   4. A WAV made in the page, played through audio.useFile, drives the audio features:
//      level, bass and highs rise, onsets come with the kicks, and the tempo is found.
//   5. Without a microphone or a way to hear the computer, each source fails with a reason
//      a person can act on, nothing is logged as an error, and a file still plays after.
//
// The software GPU draws about ten frames a second, so light checks wait on frames the
// engine has drawn (engine.stats.frames) and poll the picture rather than sleep.

const VIEW = { width: 800, height: 500 };

// ---- helpers ------------------------------------------------------------------------------

const drawn = (page) => page.evaluate(() => window.TACTILUME_DESKTOP.engine.stats.frames);
async function drawFrames(h, page, n, timeout = 30000) {
  const start = await drawn(page);
  return h.until(page, ({ start, n }) => window.TACTILUME_DESKTOP.engine.stats.frames >= start + n, { start, n }, timeout);
}

const setScene = (page, partial) => page.evaluate((p) => window.TACTILUME_DESKTOP.store.setScene(p, { source: 'test' }), partial);
const players = (page) => page.evaluate(() => window.TACTILUME_DESKTOP.hub.players());

// The first held pole of a kind of player (or its first pole), where it is on the screen as
// fractions of the window, with its state. null when there is none.
function poleOf(page, kind) {
  return page.evaluate((kind) => {
    const d = window.TACTILUME_DESKTOP;
    const ids = new Set(d.hub.players().filter((p) => p.kind === kind).map((p) => p.id));
    const mine = d.hub.poles().filter((p) => ids.has(p.player));
    const p = mine.find((q) => q.held) || mine[0];
    if (!p) return null;
    const s = d.engine.worldToScreen(p.x, p.y);
    const r = (v) => Math.round(v * 1000) / 1000;
    return { fx: r(s.px / innerWidth), fy: r(s.py / innerHeight), x: r(p.x), y: r(p.y), vx: r(p.vx), power: r(p.power), held: p.held, fade: r(p.fade ?? 1), count: mine.length };
  }, kind);
}

// A square of the picture around a point given as window fractions, and its mirror image
// across the middle, as capture() takes regions.
function square(fx, fy, half = 0.09) {
  const hw = (half * VIEW.height) / VIEW.width;
  const clamp = (v) => Math.min(1, Math.max(0, v));
  return { x0: clamp(fx - hw), y0: clamp(fy - half), x1: clamp(fx + hw), y1: clamp(fy + half) };
}

// Repeats fn until ok(value) or the time is up. → the last value.
async function poll(fn, ok, { timeout = 12000, every = 200 } = {}) {
  const t0 = Date.now();
  let value = await fn();
  while (!ok(value) && Date.now() - t0 < timeout) {
    await new Promise((resolve) => setTimeout(resolve, every));
    value = await fn();
  }
  return value;
}

const round = (x, k = 3) => (x === null || x === undefined ? x : +Number(x).toFixed(k));

// Builds, in the page, a 4 s loop at 120 bpm as a 16-bit mono WAV File: a kick on every beat
// (a falling sine), a hi-hat on every off-beat (a burst of noise) and a quiet chord, so every
// band has something. It loops seamlessly: 4 s is eight beats.
async function makeBeat(page) {
  await page.evaluate(() => {
    const rate = 44100, n = rate * 4, beat = 0.5;
    const pcm = new Int16Array(n);
    let phase = 0, seed = 12345;
    const noise = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 2 ** 31 - 1; };
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const sinceKick = t % beat;
      phase += (2 * Math.PI * (45 + 110 * Math.exp(-sinceKick / 0.03))) / rate;
      let s = Math.sin(phase) * Math.exp(-sinceKick / 0.12) * 0.75;
      const sinceHat = (t + beat / 2) % beat;
      if (sinceHat < 0.04) s += noise() * 0.2 * Math.exp(-sinceHat / 0.012);
      s += 0.025 * (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 277.2 * t) + Math.sin(2 * Math.PI * 329.6 * t));
      pcm[i] = Math.max(-32767, Math.min(32767, Math.round(s * 32767)));
    }
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const text = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    text(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    text(36, 'data'); v.setUint32(40, n * 2, true);
    new Int16Array(buf, 44).set(pcm);
    window.__beatFile = new File([buf], 'beat.wav', { type: 'audio/wav' });
  });
}

// Records what the sound module reports each animation frame, in the page.
function listen(page) {
  return page.evaluate(() => {
    const audio = window.TACTILUME_DESKTOP.audio;
    const heard = { frames: 0, level: 0, bass: 0, mid: 0, high: 0, onsets: 0, beats: 0, bpm: 0, nonzeroBefore: 0, on: true };
    window.__heard = heard;
    const tick = () => {
      if (!heard.on) return;
      const f = audio.features();
      heard.frames++;
      for (const k of ['level', 'bass', 'mid', 'high']) heard[k] = Math.max(heard[k], f[k]);
      if (f.onset === 1) heard.onsets++;
      if (f.beat === 1) heard.beats++;
      heard.bpm = f.bpm;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const heard = (page) => page.evaluate(() => ({ ...window.__heard }));
const silentNow = (page) => page.evaluate(() => Object.values(window.TACTILUME_DESKTOP.audio.features()).every((v) => v === 0));

// ---- scenarios ----------------------------------------------------------------------------

export default [
  {
    name: 'input gamepad: a pad joins at its first press, its trigger holds a cursor pole, its stick moves it, and the light follows',
    timeout: 120000,
    async run(page, h) {
      await h.fakeGamepads(page, 1);
      await h.open(page);
      await setScene(page, { lock: 'well', orbit: 0 });
      await drawFrames(h, page, 4);
      const checks = [];
      checks.push(h.check('a plugged-in pad is no player before it is pressed', !(await players(page)).some((p) => p.kind === 'gamepad')));

      const lock0 = await page.evaluate(() => window.TACTILUME_DESKTOP.store.scene.lock);
      await h.setPad(page, 0, { buttons: { b: true } });
      const joined = await h.until(page, () => window.TACTILUME_DESKTOP.hub.players().some((p) => p.kind === 'gamepad'), undefined, 5000);
      await h.setPad(page, 0, { buttons: { b: false } });
      await h.waitFrames(page, 3);
      const pad = (await players(page)).find((p) => p.kind === 'gamepad');
      checks.push(h.check('its first press makes it a player with its own name and colour', joined && pad?.name === 'Gamepad 1' && pad.color?.length === 3, pad));
      checks.push(h.check('that press only joins: the behaviour is unchanged', (await page.evaluate(() => window.TACTILUME_DESKTOP.store.scene.lock)) === lock0));

      // the right trigger holds the right cursor down, where it starts: right of the middle
      await h.setPad(page, 0, { buttons: { rt: 0.9 } });
      await h.until(page, () => window.TACTILUME_DESKTOP.hub.poles().some((p) => p.held), undefined, 5000);
      const start = await poleOf(page, 'gamepad');
      checks.push(h.check('the right trigger holds a strong pole at the right cursor', !!start && start.held && Math.abs(start.fx - 0.65) < 0.02 && Math.abs(start.fy - 0.5) < 0.02 && start.power > 1.4, start));
      const spot = square(start?.fx ?? 0.65, start?.fy ?? 0.5);
      const mirror = square(1 - (start?.fx ?? 0.65), start?.fy ?? 0.5);
      await drawFrames(h, page, 40);
      const lit = { spot: (await h.capture(page, { region: spot })).mean, mirror: (await h.capture(page, { region: mirror })).mean };
      checks.push(h.check('the light gathers at the held pole, not at its mirror image', lit.spot > lit.mirror * 1.3 + 3, lit));

      // the stick pushes the cursor, still held, over to the left third
      const from = await h.capture(page);
      await h.setPad(page, 0, { axes: [0, 0, -1, 0], buttons: { rt: 0.9 } });
      const travelled = await h.until(page, () => {
        const d = window.TACTILUME_DESKTOP;
        const p = d.hub.poles().find((q) => q.held);
        return p && d.engine.worldToScreen(p.x, p.y).px / innerWidth < 0.3;
      }, undefined, 5000);
      const moving = await poleOf(page, 'gamepad');
      await h.setPad(page, 0, { axes: [0, 0, 0, 0], buttons: { rt: 0.9 } });
      checks.push(h.check('the stick moves the held pole across the screen, and gives it speed', travelled && moving.held && moving.vx < -0.5 && Math.abs(moving.fy - 0.5) < 0.02, moving));
      const to = await poll(() => h.capture(page), (c) => c.cx !== null && c.cx <= from.cx - 0.08, { timeout: 15000 });
      checks.push(h.check('the light follows the pole across the screen', from.cx !== null && to.cx <= from.cx - 0.08, { from: round(from.cx), to: round(to.cx) }));

      await h.setPad(page, 0, { buttons: { rt: 0 } });
      const letGo = await h.until(page, () => !window.TACTILUME_DESKTOP.hub.poles().some((p) => p.held), undefined, 3000);
      const faded = await h.until(page, () => window.TACTILUME_DESKTOP.hub.poles().length === 0, undefined, 3000);
      checks.push(h.check('letting go of the trigger lets the pole fade away', letGo && faded));

      // its buttons
      await h.setPad(page, 0, { buttons: { b: true } });
      const lock1 = await poll(() => page.evaluate(() => window.TACTILUME_DESKTOP.store.scene.lock), (l) => l !== lock0, { timeout: 3000, every: 50 });
      await h.setPad(page, 0, { buttons: { b: false } });
      checks.push(h.check('B moves on to the next behaviour', lock1 !== lock0, { lock0, lock1 }));
      const palette0 = await page.evaluate(() => window.TACTILUME_DESKTOP.store.scene.palette);
      await h.setPad(page, 0, { buttons: { x: true } });
      const palette1 = await poll(() => page.evaluate(() => window.TACTILUME_DESKTOP.store.scene.palette), (p) => p !== palette0, { timeout: 3000, every: 50 });
      await h.setPad(page, 0, { buttons: { x: false } });
      checks.push(h.check('X moves on to the next palette', palette1 !== palette0, { palette0, palette1 }));

      const rumble = await page.evaluate(() => window.__tlRumble.slice());
      checks.push(h.check('the pad buzzes when it joins and when its cursor goes down, briefly', rumble.length >= 2 && rumble.every((r) => r.index === 0 && r.type === 'dual-rumble' && r.duration > 0 && r.duration <= 200 && r.strongMagnitude <= 1 && r.weakMagnitude <= 1), rumble));

      // unplugged, it keeps its player a moment (for a hiccup), then leaves
      await page.evaluate(() => window.__tlPads.disconnect(0));
      await h.waitFrames(page, 5);
      const kept = (await players(page)).some((p) => p.kind === 'gamepad');
      const left = await h.until(page, () => !window.TACTILUME_DESKTOP.hub.players().some((p) => p.kind === 'gamepad'), undefined, 12000);
      checks.push(h.check('an unplugged pad keeps its player for a moment, then leaves', kept && left, { kept, left }));
      return checks;
    },
  },

  {
    name: 'input gamepad haptics off: the pad plays but never rumbles',
    async run(page, h) {
      await page.addInitScript(() => localStorage.setItem('tactilume.desktop.v1', JSON.stringify({ haptics: false })));
      await h.fakeGamepads(page, 1);
      await h.open(page);
      await h.setPad(page, 0, { buttons: { a: true } });
      const joined = await h.until(page, () => window.TACTILUME_DESKTOP.hub.players().some((p) => p.kind === 'gamepad'), undefined, 5000);
      await h.setPad(page, 0, { buttons: { a: false } });
      await h.waitFrames(page, 3);
      await h.setPad(page, 0, { buttons: { a: true, rt: 1 } });
      const held = await h.until(page, () => window.TACTILUME_DESKTOP.hub.poles().some((p) => p.held), undefined, 5000);
      await h.setPad(page, 0, { buttons: { a: false, rt: 0 } });
      await h.waitFrames(page, 5);
      const rumble = await page.evaluate(() => window.__tlRumble.length);
      return [
        h.check('the pad joins and holds a pole', joined && held),
        h.check('with haptics off nothing rumbles: not the join, the pulse or the press', rumble === 0, rumble),
      ];
    },
  },

  {
    name: 'input mouse: a drag makes a pole under the pointer, the light follows it, and a flick glides on',
    timeout: 120000,
    async run(page, h) {
      await h.open(page);
      await setScene(page, { lock: 'well', orbit: 0 });
      await drawFrames(h, page, 4);
      const checks = [];
      const W = VIEW.width, H = VIEW.height;

      await page.mouse.move(0.3 * W, 0.5 * H);
      await page.mouse.down();
      // the pole reaches the hub on the next frame
      const made = await h.until(page, () => {
        const d = window.TACTILUME_DESKTOP;
        const desk = d.hub.players().find((p) => p.kind === 'pointer');
        return !!desk && d.hub.poles().some((p) => p.player === desk.id);
      }, undefined, 5000);
      const desk = (await players(page)).find((p) => p.kind === 'pointer');
      const p0 = await poleOf(page, 'pointer');
      checks.push(h.check('pressing the mouse makes Desk a player, with a held pole under the pointer', made && desk?.name === 'Desk' && p0?.held && Math.abs(p0.fx - 0.3) < 0.01 && Math.abs(p0.fy - 0.5) < 0.01 && p0.power === 1, { desk, p0 }));
      await drawFrames(h, page, 40);
      const lit = { spot: (await h.capture(page, { region: square(0.3, 0.5) })).mean, mirror: (await h.capture(page, { region: square(0.7, 0.5) })).mean };
      checks.push(h.check('the light gathers under the pointer, not at its mirror image', lit.spot > lit.mirror * 1.3 + 3, lit));

      // a steady drag to the right third
      const from = await h.capture(page);
      let mid = null;
      for (let i = 1; i <= 20; i++) {
        await page.mouse.move((0.3 + i * 0.02) * W, 0.5 * H);
        if (i === 12) mid = await poleOf(page, 'pointer');
        await h.wait(25);
      }
      const p1 = await poleOf(page, 'pointer');
      checks.push(h.check('the pole follows the drag, and has speed while it moves', p1?.held && Math.abs(p1.fx - 0.7) < 0.01 && mid?.vx > 0.3, { mid, p1 }));
      const to = await poll(() => h.capture(page), (c) => c.cx !== null && c.cx >= from.cx + 0.08, { timeout: 15000 });
      checks.push(h.check('the light follows the pole across the screen', from.cx !== null && to.cx >= from.cx + 0.08, { from: round(from.cx), to: round(to.cx) }));
      const resting = await poll(() => poleOf(page, 'pointer'), (p) => p && Math.abs(p.vx) < 0.05, { timeout: 3000, every: 100 });
      checks.push(h.check('a pointer that rests has no speed', resting && Math.abs(resting.vx) < 0.05, resting));

      // a quick flick to the left, let go at once: the pole glides on, slows and fades
      await page.mouse.move(0.6 * W, 0.5 * H, { steps: 4 });
      await page.mouse.up();
      await h.until(page, () => !window.TACTILUME_DESKTOP.hub.poles().some((p) => p.held), undefined, 2000);
      const lifted = await poleOf(page, 'pointer');
      await h.wait(120);
      const gliding = await poleOf(page, 'pointer');
      checks.push(h.check('a flick lets go of the pole with its speed, and it glides on the way it went', lifted && !lifted.held && lifted.vx < -1 && gliding && gliding.x < lifted.x, { lifted, gliding }));
      const gone = await h.until(page, () => window.TACTILUME_DESKTOP.hub.poles().length === 0, undefined, 2000);
      checks.push(h.check('the let-go pole fades out within half a second or so', gone));

      // the other mouse buttons are not touches
      await page.mouse.down({ button: 'right' });
      await h.waitFrames(page, 3);
      const right = await page.evaluate(() => window.TACTILUME_DESKTOP.hub.poles().length);
      await page.mouse.up({ button: 'right' });
      checks.push(h.check('a right click makes no pole', right === 0, right));

      // a pen's pressure is its strength (the DevTools protocol can play a pen)
      const cdp = await page.context().newCDPSession(page);
      const pen = (type, force, x = 0.5) => cdp.send('Input.dispatchMouseEvent', { type, x: x * W, y: 0.4 * H, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'pen', force });
      await pen('mousePressed', 0.25);
      await h.waitFrames(page, 2);
      const light = await poleOf(page, 'pointer');
      await pen('mouseMoved', 0.95, 0.51);
      await h.waitFrames(page, 20);
      const firm = await poleOf(page, 'pointer');
      await pen('mouseReleased', 0, 0.51);
      checks.push(h.check('a pen pressed lightly is gentle, and pressed hard is strong', light?.held && light.power < 0.8 && firm?.held && firm.power > 1.6, { light, firm }));
      return checks;
    },
  },

  {
    name: 'input audio file: a WAV played through useFile drives the level, bands, onsets and tempo',
    timeout: 120000,
    async run(page, h) {
      await h.open(page);
      const checks = [];
      const before = await page.evaluate(() => ({ source: window.TACTILUME_DESKTOP.audio.source, features: window.TACTILUME_DESKTOP.audio.features() }));
      checks.push(h.check('with no sound chosen the source is off and every feature is 0', before.source === 'off' && Object.values(before.features).every((v) => v === 0) && Object.keys(before.features).sort().join() === 'bass,beat,bpm,high,level,mid,onset', before));

      await makeBeat(page);
      await listen(page);
      const result = await page.evaluate(() => {
        const audio = window.TACTILUME_DESKTOP.audio;
        window.__audioChanges = [];
        // (called with ?. so that a build without on() fails this check, not the whole scenario)
        audio.on?.('change', (c) => window.__audioChanges.push(c));
        return audio.useFile(window.__beatFile);
      });
      const state = await page.evaluate(() => ({ source: window.TACTILUME_DESKTOP.audio.source, label: window.TACTILUME_DESKTOP.audio.label, changes: window.__audioChanges }));
      checks.push(h.check('useFile plays the file and says so', result.ok === true && result.label === 'beat.wav' && state.source === 'file' && state.label === 'beat.wav' && state.changes.some((c) => c.source === 'file'), { result, state }));

      await h.wait(7000);
      const got = await heard(page);
      const info = { ...got, level: round(got.level), bass: round(got.bass), mid: round(got.mid), high: round(got.high), bpm: round(got.bpm, 1) };
      checks.push(h.check('the level, the bass, the mids and the highs all rise with the music', got.level > 0.5 && got.bass > 0.5 && got.mid > 0.3 && got.high > 0.3, info));
      checks.push(h.check('the kicks come through as onsets', got.onsets >= 8, info));
      checks.push(h.check('the tempo is found: 120 bpm, with beats ticking', Math.abs(got.bpm - 120) <= 4 && got.beats >= 4, info));

      await page.evaluate(() => window.TACTILUME_DESKTOP.audio.stop());
      const off = await page.evaluate(() => window.TACTILUME_DESKTOP.audio.source);
      const quiet = await h.until(page, () => Object.values(window.TACTILUME_DESKTOP.audio.features()).every((v) => v === 0), undefined, 3000);
      checks.push(h.check('stopping turns the source off and the features back to 0', off === 'off' && quiet, { off, quiet }));

      // files that are not music fail with a reason, and leave the sound off
      const text = await page.evaluate(() => window.TACTILUME_DESKTOP.audio.useFile(new File(['not music'], 'notes.txt', { type: 'text/plain' })));
      const junk = await page.evaluate(() => window.TACTILUME_DESKTOP.audio.useFile(new File([new Uint8Array(4096).fill(7)], 'broken.wav', { type: 'audio/wav' })));
      const after = await page.evaluate(() => ({ source: window.TACTILUME_DESKTOP.audio.source, error: window.TACTILUME_DESKTOP.audio.error }));
      checks.push(h.check('a text file is refused with a reason', text.ok === false && /cannot play this kind of file/.test(text.error), text));
      checks.push(h.check('a damaged sound file fails with a reason, and the sound stays off', junk.ok === false && junk.error.length > 10 && after.source === 'off' && after.error === junk.error, { junk, after }));
      await page.evaluate(() => { window.__heard.on = false; });
      return checks;
    },
  },

  {
    name: 'input audio sources: without a microphone or a way to hear the computer, each fails with a clear reason',
    async run(page, h) {
      await h.open(page);
      const checks = [];
      const inputs = await page.evaluate(async () => (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput').length);
      const mic = await page.evaluate(() => window.TACTILUME_DESKTOP.audio.useMic());
      const micState = await page.evaluate(() => ({ source: window.TACTILUME_DESKTOP.audio.source, error: window.TACTILUME_DESKTOP.audio.error }));
      // this check is about a computer with no microphone, as test machines are
      checks.push(h.check('with no microphone, useMic says so, and the sound stays off', inputs === 0 && mic.ok === false && /No microphone was found/.test(mic.error) && micState.source === 'off' && micState.error === mic.error, { inputs, mic, micState }));

      // the shim answers what the main process would: first a system with no loopback at all
      const none = await page.evaluate(() => window.TACTILUME_DESKTOP.audio.useSystem());
      checks.push(h.check('where the computer\'s sound cannot be heard, useSystem says so and suggests a file or a microphone', none.ok === false && /cannot hear what this computer plays/.test(none.error) && /file/.test(none.error), none));
      // Windows and macOS: the screen-share route, which this headless browser refuses
      const loop = await page.evaluate(() => { window.__tlShim.systemAudio = { supported: true, how: 'loopback' }; return window.TACTILUME_DESKTOP.audio.useSystem(); });
      checks.push(h.check('when the screen-share route is refused, useSystem fails with a reason', loop.ok === false && loop.error.length > 20, loop));
      // Linux: a monitor input, which this machine does not list
      const linux = await page.evaluate(() => { window.__tlShim.systemAudio = { supported: true, how: 'monitor-device' }; return window.TACTILUME_DESKTOP.audio.useSystem(); });
      checks.push(h.check('on Linux with no monitor input, useSystem says how to route one', linux.ok === false && /Monitor of/.test(linux.error) && /pavucontrol/.test(linux.error), linux));
      const devices = await page.evaluate(() => window.TACTILUME_DESKTOP.audio.devices());
      checks.push(h.check('devices() lists the inputs (none here)', Array.isArray(devices) && devices.length === inputs, devices));

      // after all that, a file still plays
      await makeBeat(page);
      const file = await page.evaluate(() => window.TACTILUME_DESKTOP.audio.useFile(window.__beatFile));
      const level = await poll(() => page.evaluate(() => window.TACTILUME_DESKTOP.audio.features().level), (l) => l > 0.3, { timeout: 5000, every: 100 });
      checks.push(h.check('a file still plays after the failures', file.ok && level > 0.3, { file, level }));
      await page.evaluate(() => window.TACTILUME_DESKTOP.audio.stop());
      checks.push(h.check('and stops cleanly', await h.until(page, () => window.TACTILUME_DESKTOP.audio.source === 'off', undefined, 2000) && await silentNow(page)));
      return checks;
    },
  },
];
