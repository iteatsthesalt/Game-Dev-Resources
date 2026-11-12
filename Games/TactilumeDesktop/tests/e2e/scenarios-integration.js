// The whole app at once: the checks that only make sense with every part together.
//   1. Two phones (through the bridge shim), a gamepad, the mouse and a music file play at
//      the same time. Every player's poles reach the hub where that input is, each phone's
//      light leans to its own player's colour, the picture is neither black nor blown out,
//      and the music is heard.
//   2. Letting go of a gathered Nova on a gamepad rumbles the pad. That needs main.js to tell
//      the gamepads which behaviour leads (getLead); without it the pad stayed still.

const W = 800, H = 500;
const ANA = [0.25, 0.3];        // phone 1's finger, as pad fractions
const BO = [0.75, 0.7];         // phone 2's finger
const MOUSE = [0.5, 0.5];

const setScene = (page, partial) => page.evaluate((p) => window.TACTILUME_DESKTOP.store.setScene(p, { source: 'test' }), partial);
const drawn = (page) => page.evaluate(() => window.TACTILUME_DESKTOP.engine.stats.frames);
async function drawFrames(h, page, n, timeout = 40000) {
  const start = await drawn(page);
  return h.until(page, ({ start, n }) => window.TACTILUME_DESKTOP.engine.stats.frames >= start + n, { start, n }, timeout);
}

// A 4 s loop at 120 bpm as a 16-bit mono WAV File in the page: a falling-sine kick on each
// beat and a quiet two-note chord.
function makeMusic(page) {
  return page.evaluate(() => {
    const rate = 44100, n = rate * 4, beat = 0.5;
    const pcm = new Int16Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / rate, since = t % beat;
      phase += (2 * Math.PI * (45 + 110 * Math.exp(-since / 0.03))) / rate;
      const s = Math.sin(phase) * Math.exp(-since / 0.12) * 0.75 + 0.03 * (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 330 * t));
      pcm[i] = Math.round(Math.max(-1, Math.min(1, s)) * 32767);
    }
    const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const text = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    text(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    text(36, 'data'); v.setUint32(40, n * 2, true);
    new Int16Array(buf, 44).set(pcm);
    return window.TACTILUME_DESKTOP.audio.useFile(new File([buf], 'beat.wav', { type: 'audio/wav' }));
  });
}

// The mean colour of the lit pixels in a box around a point (fractions of the picture), and
// the share of the whole picture that is burnt to white.
function colours(page, spots) {
  return page.evaluate(async (spots) => {
    const { width, height, data } = await window.TACTILUME_DESKTOP.engine.capture();
    const around = ([fx, fy]) => {
      const sum = [0, 0, 0];
      let n = 0;
      for (let y = Math.max(0, Math.floor((fy - 0.12) * height)); y < Math.min(height, (fy + 0.12) * height); y++) {
        for (let x = Math.max(0, Math.floor((fx - 0.08) * width)); x < Math.min(width, (fx + 0.08) * width); x++) {
          const o = (y * width + x) * 4;
          if (data[o] + data[o + 1] + data[o + 2] < 60) continue;
          n++;
          for (let k = 0; k < 3; k++) sum[k] += data[o + k];
        }
      }
      return { n, rgb: sum.map((s) => Math.round(s / Math.max(1, n))) };
    };
    let white = 0, total = 0, luma = 0;
    for (let o = 0; o < data.length; o += 16) {
      total++;
      luma += 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2];
      if (data[o] >= 250 && data[o + 1] >= 250 && data[o + 2] >= 250) white++;
    }
    return { spots: spots.map(around), white: white / total, mean: luma / total };
  }, spots);
}

export default [
  {
    name: 'integration together: two phones, a gamepad, the mouse and music play at once',
    timeout: 150000,
    viewport: { width: W, height: H },
    async run(page, h) {
      await h.fakeGamepads(page, 1);
      await h.open(page);
      await setScene(page, { lock: 'well', orbit: 0 });
      const checks = [];

      // two phones join; each keeps its finger down (frames about thirty times a second)
      await h.emit(page, { type: 'join', player: 1, name: 'Ana', caps: { touches: 10, haptics: true } });
      await h.emit(page, { type: 'join', player: 2, name: 'Bo', caps: { touches: 10, haptics: true } });
      await page.evaluate(({ ANA, BO }) => {
        const d = { on: true, seq: 0 };
        window.__phones = d;
        const step = () => {
          if (!d.on) return;
          window.__tlShim.emit({ type: 'touch', player: 1, seq: d.seq, touches: [[0, ANA[0], ANA[1], 0.5]], at: Date.now() });
          window.__tlShim.emit({ type: 'touch', player: 2, seq: d.seq++, touches: [[0, BO[0], BO[1], 0.5]], at: Date.now() });
          setTimeout(step, 33);
        };
        step();
      }, { ANA, BO });

      // the gamepad joins with A, then holds its right cursor down where it starts
      await h.setPad(page, 0, { buttons: { a: true } });
      await h.until(page, () => window.TACTILUME_DESKTOP.hub.players().some((p) => p.kind === 'gamepad'), undefined, 5000);
      await h.setPad(page, 0, { buttons: { a: false } });
      await h.waitFrames(page, 2);
      await h.setPad(page, 0, { buttons: { rt: 0.8 } });

      // the mouse holds a point in the middle; the music plays
      await page.mouse.move(MOUSE[0] * W, MOUSE[1] * H);
      await page.mouse.down();
      await makeMusic(page);

      const together = await h.until(page, () => {
        const d = window.TACTILUME_DESKTOP;
        const held = new Set(d.hub.poles().filter((p) => p.held).map((p) => p.player));
        return d.hub.players().length === 4 && d.hub.players().every((p) => held.has(p.id));
      }, undefined, 10000);
      const seen = await page.evaluate(() => {
        const d = window.TACTILUME_DESKTOP;
        const r = (v) => Math.round(v * 1000) / 1000;
        const cursor = d.gamepads.cursors().find((c) => c.side === 'right');
        return {
          players: d.hub.players().map((p) => ({ id: p.id, kind: p.kind, name: p.name, color: p.color.join() })),
          poles: d.hub.poles().filter((p) => p.held).map((p) => {
            const s = d.engine.worldToScreen(p.x, p.y);
            return { player: p.player, fx: r(s.px / innerWidth), fy: r(s.py / innerHeight) };
          }),
          cursor: cursor && { x: r(cursor.x), y: r(cursor.y) },
        };
      });
      checks.push(h.check('four players, each in a colour of its own', together && new Set(seen.players.map((p) => p.color)).size === 4, seen.players));
      const at = (kind, name) => {
        const p = seen.players.find((q) => q.kind === kind && (!name || q.name === name));
        return p ? seen.poles.find((q) => q.player === p.id) : null;
      };
      const near = (pole, [fx, fy]) => !!pole && Math.abs(pole.fx - fx) < 0.02 && Math.abs(pole.fy - fy) < 0.02;
      const ana = at('phone', 'Ana'), bo = at('phone', 'Bo'), pad = at('gamepad'), desk = at('pointer');
      checks.push(h.check('each phone\'s pole is under its finger', near(ana, ANA) && near(bo, BO), { ana, bo }));
      checks.push(h.check('the gamepad\'s pole is at its cursor', !!seen.cursor && near(pad, [seen.cursor.x, seen.cursor.y]), { pad, cursor: seen.cursor }));
      checks.push(h.check('the mouse\'s pole is under the pointer', near(desk, MOUSE), desk));

      await drawFrames(h, page, 40);
      const look = await colours(page, [ANA, BO]);
      const [a, b] = look.spots;
      // Ana is orange and Bo sky blue: the blue share of the light is higher round Bo's finger
      const blueShare = (s) => s.rgb[2] / Math.max(1, s.rgb[0] + s.rgb[1] + s.rgb[2]);
      checks.push(h.check('the light round each phone\'s finger leans to that player\'s colour', a.n > 50 && b.n > 50 && blueShare(b) > blueShare(a) + 0.08, { ana: a, bo: b }));
      checks.push(h.check('the picture is lit but not blown out', look.mean > 8 && look.mean < 200 && look.white < 0.05, { mean: look.mean, white: look.white }));

      const heard = await h.until(page, () => {
        const a = window.TACTILUME_DESKTOP.audio;
        return a.source === 'file' && a.features().level > 0.05;
      }, undefined, 10000);
      checks.push(h.check('the music is heard while everyone plays', heard, await page.evaluate(() => window.TACTILUME_DESKTOP.audio.features())));

      // everyone lets go: the poles fade, and the light is still there afterwards
      await page.evaluate(() => {
        window.__phones.on = false;
        for (const player of [1, 2]) window.__tlShim.emit({ type: 'touch', player, seq: 1e6, touches: [], at: Date.now() });
      });
      await h.setPad(page, 0, { buttons: { rt: 0 } });
      await page.mouse.up();
      await page.evaluate(() => window.TACTILUME_DESKTOP.audio.stop());
      const gone = await h.until(page, () => window.TACTILUME_DESKTOP.hub.poles().length === 0, undefined, 8000);
      await drawFrames(h, page, 10);
      const after = await colours(page, []);
      checks.push(h.check('when everyone lets go the poles fade and the light stays', gone && after.mean > 3 && after.white < 0.05, { gone, mean: after.mean, white: after.white }));
      return checks;
    },
  },

  {
    name: 'integration nova: letting go of a gathered Nova rumbles the gamepad',
    timeout: 90000,
    async run(page, h) {
      await h.fakeGamepads(page, 1);
      await h.open(page);
      await setScene(page, { lock: 'nova' });
      await h.setPad(page, 0, { buttons: { a: true } });
      const joined = await h.until(page, () => window.TACTILUME_DESKTOP.hub.players().some((p) => p.kind === 'gamepad'), undefined, 5000);
      await h.setPad(page, 0, { buttons: { a: false } });
      await h.waitFrames(page, 2);
      // hold the right trigger long enough (in the frames' time) to gather light
      await h.setPad(page, 0, { buttons: { rt: 1 } });
      const held = await h.until(page, () => window.TACTILUME_DESKTOP.hub.poles().some((p) => p.held && p.age > 1), undefined, 40000);
      const before = await page.evaluate(() => window.__tlRumble.length);
      await h.setPad(page, 0, { buttons: { rt: 0 } });
      await h.waitFrames(page, 4);
      const after = await page.evaluate((n) => window.__tlRumble.slice(n), before);
      return [
        h.check('the pad joins and gathers a Nova', joined && held),
        h.check('letting go rumbles the pad, longer and stronger than a press', after.some((r) => r.duration >= 100 && r.strongMagnitude >= 0.3), after),
      ];
    },
  },
];
