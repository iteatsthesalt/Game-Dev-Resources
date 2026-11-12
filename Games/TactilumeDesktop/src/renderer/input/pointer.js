// Mouse, pen and touch on the desktop window become the poles of one player, "Desk".
// See CONTRACTS.md, "renderer/input/pointer.js".
//
// The feel is the mobile edition's (../Tactilume/src/js/input/pointers.js):
// - Poles are in world units, cast through the camera again every frame, so a resting pointer
//   stays over the same spot while the camera sways.
// - Speed is smoothed for the engine's forces, and eases to zero when the pointer rests.
// - A short history of samples is kept, so a flick reports how fast the pointer moved in its
//   last 80 ms, not an average over the whole drag. A lifted pole glides on along that flick,
//   slowing, while it fades out over 0.35 s.
// - Strength comes from a pen's pressure, or a touch's pressure or contact size; a mouse is 1.
//
// Desk joins the players at its first press and steps out after 20 s without a pole, so a
// mouse that played once does not count as a player for team colours ever after.
import { clamp, approach } from '../../../../Tactilume/src/js/core/util.js';

const MAX_LIVE = 10;            // pointers down at once; more are ignored
const FADE_SECONDS = 0.35;      // a lifted pole keeps fading out for this long
const VELOCITY_TAU = 0.06;      // s, smoothing of the live speed
const STILL_AFTER = 0.05;       // s without movement before the speed eases to zero
const FLICK_WINDOW_MS = 80;     // history that decides the speed of a flick
const MAX_FLICK = 40;           // world units / s; anything faster is a glitch
const POWER_TAU = 0.08;         // s, smoothing of pressure and contact size
const COAST_TAU = 0.12;         // s, how quickly a flicked, lifted pole slows down
const FINGERTIP_AREA = 40 * 40; // CSS px², a typical fingertip contact
const IDLE_LEAVE = 20;          // s without a pole before Desk steps out

// Style that keeps the browser's own gestures off the canvas. The stylesheet sets some of it
// too; doing it here as well means the module works on any element.
const GUARD_STYLE = { 'touch-action': 'none', 'user-select': 'none', '-webkit-user-select': 'none' };
const BLOCKED_EVENTS = ['contextmenu', 'dblclick', 'selectstart', 'dragstart'];

// Many devices report 0 or exactly 0.5 when they cannot measure pressure.
const realPressure = (p) => p > 0 && p !== 0.5;

// 0..2, as on mobile: a mouse is 1, a pen 0.15..2 by pressure, a touch 0.6..1.6
export function powerOf(e) {
  const type = e.pointerType;
  if (type === 'mouse') return 1;
  if (type === 'pen') return 0.15 + clamp(e.pressure || 0, 0, 1) * 1.85;
  if (realPressure(e.pressure)) return clamp(0.6 + e.pressure * 0.8, 0.6, 1.6);
  if (e.width > 1 && e.height > 1) return clamp((e.width * e.height) / FINGERTIP_AREA, 0.6, 1.6);
  return 1;
}

// Mouse: the main button only. Pen: the tip, or the eraser end.
function isPress(e) {
  if (e.pointerType === 'mouse') return e.button === 0;
  if (e.pointerType === 'pen') return e.button === 0 || e.button === 5;
  return true;
}

// Event times in ms on the performance.now() clock. A few old browsers stamp events with the
// wall clock instead; those fall back to "now".
function stampOf(e) {
  const now = performance.now();
  const t = e.timeStamp;
  return Number.isFinite(t) && t > 0 && Math.abs(now - t) < 60000 ? t : now;
}

function isEditable(el) {
  if (!el || !el.tagName) return false;
  return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

// Least-squares slope of the samples in the last FLICK_WINDOW_MS before `tEnd`. Fewer than
// two recent samples means the pointer was resting when it was lifted.
export function flickVelocity(history, tEnd) {
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
  const vx = (n * stx - st * sx) / den;
  const vy = (n * sty - st * sy) / den;
  const speed = Math.hypot(vx, vy);
  const k = speed > MAX_FLICK ? MAX_FLICK / speed : 1;
  return { vx: vx * k, vy: vy * k };
}

export function createPointer(canvas, { engine, hub, actions }) {
  const live = new Map();  // pointerId → { pole, cx, cy, targetPower, still, lastT, lx, ly, history, type }
  const fading = [];       // { pole, gone }: lifted poles fading out
  let player = null;
  let idle = 0;
  let serial = 0;

  const toWorld = (clientX, clientY, r = canvas.getBoundingClientRect()) => engine.screenToWorld(clientX - r.left, clientY - r.top);

  function capture(id) {
    try { canvas.setPointerCapture(id); } catch { /* the pointer is already gone */ }
  }

  // `lifting`: the event that ends a touch reports no pressure, so it keeps the last.
  function sample(rec, e, r, lifting = false) {
    const p = rec.pole;
    const t = stampOf(e);
    const moved = e.clientX !== rec.cx || e.clientY !== rec.cy;
    rec.cx = e.clientX;
    rec.cy = e.clientY;
    const w = toWorld(e.clientX, e.clientY, r);
    p.x = w.x;
    p.y = w.y;
    if (!lifting) rec.targetPower = powerOf(e);
    if (!moved) return;
    rec.still = 0;
    // Samples can share a timestamp; their movement is counted with the next one.
    const dts = (t - rec.lastT) / 1000;
    if (dts > 0) {
      const k = approach(dts, VELOCITY_TAU);
      p.vx += ((w.x - rec.lx) / dts - p.vx) * k;
      p.vy += ((w.y - rec.ly) / dts - p.vy) * k;
      rec.lastT = t;
      rec.lx = w.x;
      rec.ly = w.y;
    }
    rec.history.push({ t, x: w.x, y: w.y });
    while (rec.history.length > 2 && rec.history[0].t < t - FLICK_WINDOW_MS * 1.5) rec.history.shift();
  }

  function onDown(e) {
    if (!isPress(e)) return;
    // pressing the light puts away a half-typed field
    if (isEditable(document.activeElement)) document.activeElement.blur();
    const old = live.get(e.pointerId);
    if (old) lift(e.pointerId, old, null); // its 'up' never arrived
    if (live.size >= MAX_LIVE) return;
    if (!player) player = hub.addPlayer({ kind: 'pointer', name: 'Desk', key: 'pointer' });
    idle = 0;
    const w = toWorld(e.clientX, e.clientY);
    const t = stampOf(e);
    const power = powerOf(e);
    const pole = { x: w.x, y: w.y, vx: 0, vy: 0, power, age: 0, held: true, id: `t${serial++}`, kind: 'touch', fade: 1 };
    live.set(e.pointerId, {
      type: e.pointerType, pole, cx: e.clientX, cy: e.clientY,
      targetPower: power, still: 0, lastT: t, lx: w.x, ly: w.y, history: [{ t, x: w.x, y: w.y }],
    });
    capture(e.pointerId);
    // a ring of light where it lands, in Desk's colour
    actions.pulse(w.x, w.y, power, player.color);
  }

  function onMove(e) {
    const rec = live.get(e.pointerId);
    if (!rec) return;
    // the main button came up somewhere we could not see
    if (rec.type === 'mouse' && !(e.buttons & 1)) { lift(e.pointerId, rec, e); return; }
    const r = canvas.getBoundingClientRect();
    const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
    if (list && list.length) for (const c of list) sample(rec, c, r);
    else sample(rec, e, r);
  }

  // A pointer ends: lifted, cancelled, or lost. `e` is the event that ended it, if any.
  function lift(id, rec, e) {
    live.delete(id);
    const p = rec.pole;
    let tEnd = performance.now();
    if (e) {
      tEnd = stampOf(e);
      sample(rec, e, canvas.getBoundingClientRect(), true);
    }
    const flick = flickVelocity(rec.history, tEnd) || { vx: 0, vy: 0 };
    p.vx = flick.vx;
    p.vy = flick.vy;
    p.power = rec.targetPower;
    p.held = false;
    engine.release(p.x, p.y, p.power, p.age);
    fading.push({ pole: p, gone: 0 });
  }

  function onEnd(e) {
    const rec = live.get(e.pointerId);
    // a pointercancel can carry 0,0 for its position, so only an up moves the pole
    if (rec) lift(e.pointerId, rec, e.type === 'pointerup' ? e : null);
  }
  function onLostCapture(e) {
    const rec = live.get(e.pointerId);
    if (rec) lift(e.pointerId, rec, null);
  }
  // Switching windows or hiding the app can swallow the 'up'.
  function liftAll() {
    for (const [id, rec] of [...live]) lift(id, rec, null);
  }
  const onVisibility = () => { if (document.hidden) liftAll(); };
  const block = (e) => { if (e.cancelable) e.preventDefault(); };

  const savedStyle = {};
  for (const [name, value] of Object.entries(GUARD_STYLE)) {
    savedStyle[name] = canvas.style.getPropertyValue(name);
    canvas.style.setProperty(name, value);
  }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('lostpointercapture', onLostCapture);
  for (const name of BLOCKED_EVENTS) canvas.addEventListener(name, block);
  // with capture these arrive from the canvas; without it (capture refused) they still bubble here
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
  window.addEventListener('blur', liftAll);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    update(dt) {
      if (!player) return;
      const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
      const r = live.size ? canvas.getBoundingClientRect() : null;
      for (const rec of live.values()) {
        const p = rec.pole;
        const w = toWorld(rec.cx, rec.cy, r);
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
      // a lifted pole glides on along its flick, slowing, while it fades
      const k = Math.exp(-step / COAST_TAU);
      for (let i = fading.length - 1; i >= 0; i--) {
        const f = fading[i];
        const p = f.pole;
        f.gone += step;
        p.age += step;
        p.x += p.vx * COAST_TAU * (1 - k);
        p.y += p.vy * COAST_TAU * (1 - k);
        p.vx *= k;
        p.vy *= k;
        p.fade = Math.max(0, 1 - f.gone / FADE_SECONDS);
        if (f.gone >= FADE_SECONDS) fading.splice(i, 1);
      }
      const poles = [];
      for (const rec of live.values()) poles.push({ ...rec.pole });
      for (const f of fading) poles.push({ ...f.pole });
      hub.setPoles(player.id, poles);
      idle = poles.length ? 0 : idle + step;
      if (idle > IDLE_LEAVE) {
        hub.removePlayer(player.id);
        player = null;
      }
    },

    // how many pointers are down now
    active: () => live.size,

    dispose() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('lostpointercapture', onLostCapture);
      for (const name of BLOCKED_EVENTS) canvas.removeEventListener(name, block);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('blur', liftAll);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const [name, value] of Object.entries(savedStyle)) {
        if (value) canvas.style.setProperty(name, value);
        else canvas.style.removeProperty(name);
      }
      live.clear();
      fading.length = 0;
      if (player) hub.removePlayer(player.id);
      player = null;
    },
  };
}
