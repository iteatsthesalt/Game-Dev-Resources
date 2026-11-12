// Phones on the local network: link events from the main process become players and poles.
// See CONTRACTS.md, "renderer/input/phone.js".
//
// A phone's pad covers the whole canvas: pad x and y (0..1 from the top left) become canvas
// CSS pixels and go through engine.screenToWorld again every frame, so a resting finger stays
// over the same spot while the camera sways. A touch's speed is measured on the phone's own
// clock when its frames carry one (touch.ms), so the network's uneven delivery does not
// shake it. A lifted touch glides on along its flick and fades out over 0.35 s, as on mobile.
//
// Options beyond CONTRACTS.md, both optional: `store` (the mobile store) lets every change
// of behaviour or palette, from any input, reach the phones; `getSettings` (the merged
// settings) lets `haptics: false` stop the phones buzzing.
import { haptic, state } from '../../shared/protocol.js';

const FADE_SECONDS = 0.35;       // a lifted touch fades out over this long
const VELOCITY_TAU = 0.06;       // s, smoothing of a touch's speed
// s without movement before the speed eases to zero. Longer than mobile's 0.05 s, because
// frames cross Wi-Fi and some arrive late.
const STILL_AFTER = 0.1;
const FLICK_WINDOW_MS = 80;      // the last part of a drag that decides the speed of a flick
const MAX_FLICK = 40;            // world units / s; anything faster is a glitch
const POWER_TAU = 0.08;          // s, smoothing of force
const COAST_TAU = 0.12;          // s, how quickly a flicked, lifted touch slows down
const MIN_SAMPLE_GAP_MS = 2;     // samples closer together are counted with the next one
const HAPTIC_GAP_MS = 60;        // one buzz per phone at most this often
const PULSE_POWER = 1.5;
const TOUCH_BUZZ = [30, 0.6];    // ms, strength

const approach = (dt, tau) => 1 - Math.exp(-dt / tau);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const isNumber = Number.isFinite;

// f (0..1, 0.5 when the phone cannot tell) → pole power. A typical touch is 1, like a mouse;
// the range is the mobile edition's for touches, 0.6..1.6.
export function powerFromForce(f) {
  const k = isNumber(f) ? clamp(f, 0, 1) : 0.5;
  return k <= 0.5 ? 0.6 + 0.8 * k : 1 + 1.2 * (k - 0.5);
}

// [r, g, b] 0..1 → '#rrggbb'
export function toHex(color) {
  const c = Array.isArray(color) ? color : [1, 1, 1];
  return `#${[0, 1, 2].map((i) => Math.round(clamp(Number(c[i]) || 0, 0, 1) * 255).toString(16).padStart(2, '0')).join('')}`;
}

// Least-squares slope of the samples in the last FLICK_WINDOW_MS before `tEnd` (ms): how
// fast the finger was going when it let go. Fewer than two recent samples means it rested.
function flickVelocity(history, tEnd) {
  const from = tEnd - FLICK_WINDOW_MS;
  let n = 0, st = 0, sx = 0, sy = 0, stt = 0, stx = 0, sty = 0;
  for (const s of history) {
    if (s.t < from || s.t > tEnd) continue;
    const t = (s.t - tEnd) / 1000;
    n++; st += t; sx += s.x; sy += s.y; stt += t * t; stx += t * s.x; sty += t * s.y;
  }
  if (n < 2) return null;
  const den = n * stt - st * st;
  if (den < 1e-10) return null;
  return limitSpeed((n * stx - st * sx) / den, (n * sty - st * sy) / den);
}

function limitSpeed(vx, vy) {
  const speed = Math.hypot(vx, vy);
  const k = speed > MAX_FLICK ? MAX_FLICK / speed : 1;
  return { vx: vx * k, vy: vy * k };
}

// [[id, x, y, f], …] from an event, or null. Main has checked these already; this guards
// against anything else that emits link events (the test shim, say).
function readTouches(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  const seen = new Set();
  for (const t of list.slice(0, 10)) {
    if (!Array.isArray(t) || !Number.isInteger(t[0]) || seen.has(t[0]) || !isNumber(t[1]) || !isNumber(t[2])) continue;
    seen.add(t[0]);
    out.push([t[0], clamp(t[1], 0, 1), clamp(t[2], 0, 1), isNumber(t[3]) ? clamp(t[3], 0, 1) : 0.5]);
  }
  return out;
}

export function createPhones({ bridge, hub, engine, actions, store = null, getSettings = null }) {
  const phones = new Map(); // player number → phone (see join)
  let serial = 0;

  // the engine is sized to the window, so the pad maps onto the window
  const toWorld = (x, y) => engine.screenToWorld(x * (globalThis.innerWidth || 1), y * (globalThis.innerHeight || 1));
  const send = (player, msg) => {
    Promise.resolve().then(() => bridge.link.send(player, msg)).catch(() => {});
  };
  const broadcast = (msg) => { for (const phone of phones.values()) if (!phone.leaving) send(phone.player, msg); };

  function sceneState() {
    const scene = store?.scene;
    return scene ? { behaviour: scene.lock, palette: scene.palette } : {};
  }

  function buzz(phone) {
    if (getSettings && getSettings()?.haptics === false) return;
    const t = performance.now();
    if (t - phone.lastBuzz < HAPTIC_GAP_MS) return;
    phone.lastBuzz = t;
    send(phone.player, haptic(...TOUCH_BUZZ));
  }

  function join(e) {
    const existing = phones.get(e.player);
    if (existing) {
      // back before its light had faded: it carries on as the same player
      existing.leaving = false;
      return;
    }
    const p = hub.addPlayer({ kind: 'phone', name: e.name || `Phone ${e.player}`, key: `phone${e.player}` });
    const phone = { player: e.player, hubId: p.id, color: p.color, live: new Map(), fading: [], leaving: false, lastBuzz: -Infinity };
    phones.set(e.player, phone);
    // The phone learns the colour it is really drawn in, and what is playing.
    send(e.player, state({ ...sceneState(), players: hub.players().length, color: toHex(p.color) }));
  }

  function leave(e) {
    const phone = phones.get(e.player);
    if (!phone || phone.leaving) return;
    for (const [id, rec] of [...phone.live]) lift(phone, id, rec, null);
    // the player goes once its light has faded (see update)
    phone.leaving = true;
  }

  // A sample's time in ms, on the clock its touch started with: the phone's (touch.ms) when
  // that first frame had one, else the link's arrival times. A frame without the phone's
  // clock (the link's own "fingers let go" frame) is placed by how much later it arrived, so
  // one touch never mixes two clocks.
  function sampleTime(rec, e, at) {
    if (!rec) return isNumber(e.ms) ? e.ms : at;
    if (rec.phoneClock && isNumber(e.ms)) return e.ms;
    return rec.lastT + (at - rec.lastAt);
  }

  function sample(rec, x, y, t, at) {
    const moved = x !== rec.px || y !== rec.py;
    rec.px = x;
    rec.py = y;
    if (!moved) return;
    rec.still = 0;
    const w = toWorld(x, y);
    const gap = t - rec.lastT;
    if (gap >= MIN_SAMPLE_GAP_MS) {
      const dts = gap / 1000;
      const v = limitSpeed((w.x - rec.lx) / dts, (w.y - rec.ly) / dts);
      const k = approach(dts, VELOCITY_TAU);
      rec.pole.vx += (v.vx - rec.pole.vx) * k;
      rec.pole.vy += (v.vy - rec.pole.vy) * k;
      rec.lastT = t;
      rec.lastAt = at;
      rec.lx = w.x;
      rec.ly = w.y;
    }
    rec.history.push({ t, x: w.x, y: w.y });
    while (rec.history.length > 2 && rec.history[0].t < t - FLICK_WINDOW_MS * 1.5) rec.history.shift();
  }

  // `tEnd`: when the finger lifted, on the phone's clock; null when nobody knows (the phone
  // left), and then the touch just fades where it is.
  function lift(phone, id, rec, tEnd) {
    phone.live.delete(id);
    const p = rec.pole;
    const flick = tEnd === null ? null : flickVelocity(rec.history, tEnd);
    p.vx = flick ? flick.vx : 0;
    p.vy = flick ? flick.vy : 0;
    p.power = rec.targetPower;
    p.held = false;
    engine.release(p.x, p.y, p.power, p.age);
    phone.fading.push({ pole: p, gone: 0 });
  }

  function touch(e) {
    const phone = phones.get(e.player);
    const list = readTouches(e.touches);
    if (!phone || phone.leaving || !list) return;
    const at = isNumber(e.at) ? e.at : performance.now();
    const down = new Set();
    for (const [id, x, y, f] of list) {
      down.add(id);
      const rec = phone.live.get(id);
      if (rec) {
        sample(rec, x, y, sampleTime(rec, e, at), at);
        rec.targetPower = powerFromForce(f);
        continue;
      }
      const t = sampleTime(null, e, at);
      const w = toWorld(x, y);
      const power = powerFromForce(f);
      const pole = { x: w.x, y: w.y, vx: 0, vy: 0, power, age: 0, held: true, id: `ph${phone.player}.${serial++}`, kind: 'touch', fade: 1 };
      phone.live.set(id, {
        pole, px: x, py: y, targetPower: power, still: 0, phoneClock: isNumber(e.ms),
        lastT: t, lastAt: at, lx: w.x, ly: w.y, history: [{ t, x: w.x, y: w.y }],
      });
      actions.pulse(w.x, w.y, power, phone.color);
      buzz(phone);
    }
    for (const [id, rec] of [...phone.live]) {
      if (!down.has(id)) lift(phone, id, rec, sampleTime(rec, e, at));
    }
  }

  function act(e) {
    const phone = phones.get(e.player);
    if (!phone || phone.leaving) return;
    const dir = e.v === -1 ? -1 : 1;
    // With the store, its listener below tells the phones what changed. Without it, they
    // hear about changes made from a phone, at least: the actions return the new key.
    const tell = (key, value) => { if (!store && typeof value === 'string') broadcast(state({ [key]: value })); };
    switch (e.a) {
      case 'behaviour': tell('behaviour', actions.nextBehaviour(dir)); break;
      case 'palette': tell('palette', actions.nextPalette(dir)); break;
      case 'preset': actions.nextPreset(dir); break;
      case 'surprise': actions.surprise(); break;
      case 'clear': actions.clear(); break;
      case 'pulse': {
        // where this phone's fingers are, or the middle of the screen
        let x = 0, y = 0;
        for (const rec of phone.live.values()) { x += rec.pole.x; y += rec.pole.y; }
        const n = phone.live.size || 1;
        actions.pulse(x / n, y / n, PULSE_POWER, phone.color);
        buzz(phone);
        break;
      }
      default: break;
    }
  }

  const offLink = bridge.link.onEvent((e) => {
    if (!e || typeof e !== 'object' || !Number.isInteger(e.player)) return;
    if (e.type === 'join') join(e);
    else if (e.type === 'leave') leave(e);
    else if (e.type === 'touch') touch(e);
    else if (e.type === 'act') act(e);
  });
  const offScene = store?.on?.('scene', (scene, changed) => {
    if (Array.isArray(changed) && (changed.includes('lock') || changed.includes('palette'))) {
      broadcast(state({ behaviour: scene.lock, palette: scene.palette }));
    }
  });
  const offPlayers = hub.on?.('players', (list) => broadcast(state({ players: Array.isArray(list) ? list.length : 0 })));

  return {
    update(dt) {
      const step = isNumber(dt) && dt > 0 ? dt : 0;
      for (const phone of [...phones.values()]) {
        for (const rec of phone.live.values()) {
          const p = rec.pole;
          const w = toWorld(rec.px, rec.py);
          p.x = w.x;
          p.y = w.y;
          p.age += step;
          rec.still += step;
          if (rec.still > STILL_AFTER) {
            const k = Math.exp(-step / VELOCITY_TAU);
            p.vx *= k;
            p.vy *= k;
          }
          p.power += (rec.targetPower - p.power) * approach(step, POWER_TAU);
        }
        // a lifted touch glides on along its flick, slowing, while it fades
        const k = Math.exp(-step / COAST_TAU);
        for (const f of phone.fading) {
          const p = f.pole;
          f.gone += step;
          p.age += step;
          p.x += p.vx * COAST_TAU * (1 - k);
          p.y += p.vy * COAST_TAU * (1 - k);
          p.vx *= k;
          p.vy *= k;
          p.fade = Math.max(0, 1 - f.gone / FADE_SECONDS);
        }
        phone.fading = phone.fading.filter((f) => f.gone < FADE_SECONDS);
        if (phone.leaving && !phone.live.size && !phone.fading.length) {
          phones.delete(phone.player);
          hub.removePlayer(phone.hubId);
          continue;
        }
        const poles = [];
        for (const rec of phone.live.values()) poles.push({ ...rec.pole });
        for (const f of phone.fading) poles.push({ ...f.pole });
        hub.setPoles(phone.hubId, poles);
      }
    },
    dispose() {
      offLink?.();
      offScene?.();
      offPlayers?.();
      for (const phone of phones.values()) hub.removePlayer(phone.hubId);
      phones.clear();
    },
  };
}
