// Gamepads through the Gamepad API. Each pad is a player with two cursors, one per stick,
// which it steers across the screen. A trigger presses its side's cursor down as a pole (a
// point of force, like a finger), and the buttons are actions. See CONTRACTS.md,
// "renderer/input/gamepad.js".
//
//   Left / right stick   move the left / right cursor (radial deadzone, then a response curve)
//   LT / RT              hold the left / right cursor down; how far it is pulled sets the strength
//   Click a stick        holds that cursor down until the next click: a toggle for players who
//                        cannot keep a trigger pulled
//   A pulse at the left cursor    B next behaviour    X next palette    Y surprise
//   LB / RB previous / next preset    D-pad up and down: trails; left and right: speck size
//   Start shows or hides the controls    Back opens the phone panel
//
// A pad joins at its first button press; that press only joins, so waking a pad changes
// nothing on screen. A pad that is unplugged keeps its player for a few seconds, so a
// Bluetooth hiccup does not cost anyone their colour, and a pad left untouched for a minute
// steps out until it is pressed again.
//
// Options beyond CONTRACTS.md, all optional: `getLead()` returns the behaviour in the lead,
// so letting go of a gathered nova rumbles; settings `padDeadzone` (0.05..0.4) and
// `padCurve` (1..3) tune the sticks for each player's hands, where the shell offers them.
//
// For the overlay, `cursors()` lists where every cursor is (see below), and `pads()` the pads
// that are plugged in, joined or not.
import { clamp, approach } from '../../../../Tactilume/src/js/core/util.js';

// The standard mapping's buttons, in the order the Gamepad API numbers them.
export const BUTTONS = Object.freeze(['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right', 'home']);

const DEADZONE = 0.15;          // of the stick's travel: rest wobble below this is nothing
const OUTER = 0.95;             // beyond this the stick counts as fully over, so worn sticks still reach full speed
const CURVE = 2;                // the response curve's exponent: small moves are fine, full tilt is fast
const MAX_SPEED = 1.5;          // screen heights a second at full tilt
const CURSOR_TAU = 0.05;        // s: how quickly a cursor's speed follows the stick
const MARGIN = 0.02;            // of the screen: cursors stay this far inside its edges
const HOLD_ON = 0.05;           // a trigger pulled past this holds its cursor down...
const HOLD_OFF = 0.035;         // ...until it falls below this, so a trigger resting near the line does not chatter
const MIN_POWER = 0.35, MAX_POWER = 1.8; // a trigger's strength from just pulled to fully pulled
const LATCH_POWER = 1;          // the strength of a cursor held down by a stick click
const POWER_TAU = 0.08;         // s: smoothing of strength
const VELOCITY_TAU = 0.06;      // s: smoothing of a pole's speed, as for touches
const FADE_SECONDS = 0.35;      // a let-go pole fades out over this long, as a lifted touch does
const COAST_TAU = 0.12;         // s: how quickly a let-go pole's glide slows
const PULSE_POWER = 1.5;
const ADJUST_STEP = 0.05;       // of a setting's range, per D-pad press
const REPEAT_DELAY = 0.45;      // s a D-pad direction is held before it repeats
const REPEAT_EVERY = 0.12;      // s between repeats
const GONE_GRACE = 5;           // s an unplugged pad keeps its player
const IDLE_LEAVE = 60;          // s without a touch before a pad steps out
const ACTIVE_STICK = 0.25;      // a stick moved past this counts as being played
const RUMBLE_GAP = 0.05;        // s: at most one effect per pad this often
// [ms, strong motor, weak motor]: short accents, kept to the player who caused them
const RUMBLE = Object.freeze({
  join: [40, 0.2, 0.4],
  press: [30, 0.1, 0.35],
  pulse: [70, 0.55, 0.35],
  nova: [140, 0.8, 0.5],
});
// where each pad's cursors start, by pad index, so pads do not start on top of each other
const ROWS = [0.5, 0.32, 0.68, 0.2, 0.8, 0.41, 0.59, 0.26];

const finite = (x) => typeof x === 'number' && Number.isFinite(x);
const within = (v, lo, hi, fallback) => (finite(v) ? clamp(v, lo, hi) : fallback);

// Sticks rest a little off centre, so anything inside `dz` of the middle counts as zero and
// the rest is stretched to start from zero again. Radial, so diagonals behave like the axes;
// beyond `outer` the stick counts as fully over.
export function radialDeadzone(x, y, dz = DEADZONE, outer = OUTER) {
  const fx = finite(x) ? x : 0;
  const fy = finite(y) ? y : 0;
  const d = within(dz, 0, 0.9, DEADZONE);
  const o = within(outer, d + 0.01, 1, Math.max(OUTER, d + 0.01));
  const m = Math.hypot(fx, fy);
  if (m <= d) return { x: 0, y: 0 };
  const scale = Math.min(1, (m - d) / (o - d)) / m;
  return { x: fx * scale, y: fy * scale };
}

// Small deflections give fine control and full deflection still reaches full speed: the
// magnitude is raised to the power k (1 is straight, 2 and 3 are gentler near the middle).
export function responseCurve(v, k = CURVE) {
  if (!finite(v)) return 0;
  const e = within(k, 1, 4, CURVE);
  return Math.sign(v) * Math.min(1, Math.abs(v)) ** e;
}

// Can this pad rumble through the Gamepad API?
function canRumble(pad) {
  const act = pad && pad.vibrationActuator;
  if (!act || typeof act.playEffect !== 'function') return false;
  return !Array.isArray(act.effects) || act.effects.includes('dual-rumble');
}

// A Gamepad → { index, id, standard, rumble, lx, ly, rx, ry, axes, buttons: { a: { pressed, value }, … } },
// with every number finite and in range. Old browsers gave buttons as bare numbers.
export function readPad(pad) {
  const axes = Array.isArray(pad?.axes) || ArrayBuffer.isView(pad?.axes) ? Array.from(pad.axes, (v) => within(v, -1, 1, 0)) : [];
  const buttons = {};
  BUTTONS.forEach((name, i) => {
    const b = pad?.buttons?.[i];
    if (typeof b === 'number') {
      const value = within(b, 0, 1, 0);
      buttons[name] = { pressed: value > 0.12, value };
      return;
    }
    const pressed = !!(b && b.pressed);
    buttons[name] = { pressed, value: within(b?.value, 0, 1, pressed ? 1 : 0) };
  });
  return {
    index: Number.isInteger(pad?.index) ? pad.index : 0,
    id: typeof pad?.id === 'string' ? pad.id : '',
    standard: pad?.mapping === 'standard',
    rumble: canRumble(pad),
    lx: axes[0] ?? 0, ly: axes[1] ?? 0, rx: axes[2] ?? 0, ry: axes[3] ?? 0,
    axes,
    buttons,
  };
}

// The pads plugged in now. getGamepads() throws when a permissions policy forbids gamepads,
// and lists empty slots as null.
function connectedPads(getPads) {
  let list;
  try { list = getPads(); } catch { return []; }
  if (!list || typeof list.length !== 'number') return [];
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p && p.connected !== false && Number.isInteger(p.index)) out.push(p);
  }
  return out;
}

export function createGamepads({ engine, hub, actions, getSettings = () => ({}), getPads = () => navigator.getGamepads(), getLead = null }) {
  const pads = new Map(); // `${index}|${id}` → pad (see track)
  let clock = 0;
  let reported = false;

  const settings = () => {
    try { return getSettings() || {}; } catch { return {}; }
  };
  const screen = () => ({ w: globalThis.innerWidth || 1, h: globalThis.innerHeight || 1 });
  const toWorld = (c) => {
    const { w, h } = screen();
    return engine.screenToWorld(c.nx * w, c.ny * h);
  };

  // An action belongs to main.js; if one throws, the first fault is reported and the pads
  // carry on, so a broken action cannot jam a button that is held down.
  function call(fn, ...args) {
    try {
      return typeof fn === 'function' ? fn(...args) : undefined;
    } catch (e) {
      if (!reported) { reported = true; console.error(e); }
      return undefined;
    }
  }
  const say = (text) => call(actions.toast, text);

  function rumble(pad, kind, scale = 1) {
    if (settings().haptics === false) return;
    const act = pad.raw && pad.raw.vibrationActuator;
    if (!canRumble(pad.raw) || clock - pad.lastRumble < RUMBLE_GAP) return;
    pad.lastRumble = clock;
    const [ms, strong, weak] = RUMBLE[kind];
    const k = within(scale, 0, 1, 1);
    try {
      const done = act.playEffect('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: strong * k, weakMagnitude: weak * k });
      // a pad that cannot, or was just unplugged, simply stays still
      if (done && typeof done.catch === 'function') done.catch(() => {});
    } catch { /* the same */ }
  }

  function stopRumble(pad) {
    try {
      const done = pad.raw?.vibrationActuator?.reset?.();
      if (done && typeof done.catch === 'function') done.catch(() => {});
    } catch { /* nothing is playing */ }
  }
  const stopAll = () => { for (const pad of pads.values()) stopRumble(pad); };

  function newCursor(side, index) {
    return { side, nx: side === 'left' ? 0.35 : 0.65, ny: ROWS[index % ROWS.length], vx: 0, vy: 0, pole: null, latched: false, trigger: false, targetPower: 0, wx: 0, wy: 0 };
  }

  function track(raw) {
    const r = readPad(raw);
    const key = `${r.index}|${r.id}`;
    let pad = pads.get(key);
    if (!pad) {
      pad = {
        key, index: r.index, id: r.id, standard: r.standard, raw,
        player: null, prev: null, held: {}, idle: 0, gone: 0, lastRumble: -Infinity, serial: 0,
        cursors: { left: newCursor('left', r.index), right: newCursor('right', r.index) },
        fading: [],
        // A pad without the standard mapping may report a trigger as an axis that rests at -1
        // or 1. An axis resting that far over when the pad joins is not a stick: it is ignored.
        ignoreAxis: [],
      };
      pads.set(key, pad);
    }
    pad.raw = raw;
    pad.gone = 0;
    return { pad, r };
  }

  function join(pad, r) {
    pad.player = hub.addPlayer({ kind: 'gamepad', name: `Gamepad ${pad.index + 1}`, key: `gamepad:${pad.key}` });
    pad.idle = 0;
    pad.ignoreAxis = r.standard ? [] : r.axes.map((v) => Math.abs(v) > 0.5);
    say(`Gamepad ${pad.index + 1} is playing, in ${pad.player.colorName || 'its colour'}`);
    rumble(pad, 'join');
  }

  // The pad steps out: its cursors let go and its player leaves the hub.
  function leave(pad) {
    for (const c of Object.values(pad.cursors)) {
      if (c.pole) letGo(pad, c);
      c.latched = false;
      c.trigger = false;
    }
    stopRumble(pad);
    if (pad.player) hub.removePlayer(pad.player.id);
    pad.player = null;
    pad.fading = [];
  }

  // ---- cursors and poles ------------------------------------------------------------------

  function steer(c, x, y, step, dz, k) {
    const d = radialDeadzone(x, y, dz);
    const m = Math.hypot(d.x, d.y);
    const speed = m > 0 ? responseCurve(m, k) * MAX_SPEED : 0;
    const tx = m > 0 ? (d.x / m) * speed : 0;
    const ty = m > 0 ? (d.y / m) * speed : 0;
    const a = approach(step, CURSOR_TAU);
    c.vx += (tx - c.vx) * a;
    c.vy += (ty - c.vy) * a;
    // speeds are in screen heights, so a cursor crosses the screen as fast as it climbs it
    const { w, h } = screen();
    const nx = c.nx + (c.vx * step * h) / w;
    const ny = c.ny + c.vy * step;
    c.nx = clamp(nx, MARGIN, 1 - MARGIN);
    c.ny = clamp(ny, MARGIN, 1 - MARGIN);
    // at an edge the cursor stops rather than pressing on, so turning back is immediate
    if (c.nx !== nx) c.vx = 0;
    if (c.ny !== ny) c.vy = 0;
  }

  function press(pad, c, power) {
    const w = toWorld(c);
    c.wx = w.x;
    c.wy = w.y;
    c.pole = { x: w.x, y: w.y, vx: 0, vy: 0, power, age: 0, held: true, id: `g${pad.index}${c.side[0]}${pad.serial++}`, kind: 'touch', fade: 1 };
    c.targetPower = power;
    // a ring where it lands, as a touch makes, and a tap in the hands
    call(actions.pulse, w.x, w.y, power, pad.player.color);
    rumble(pad, 'press');
  }

  function letGo(pad, c) {
    const p = c.pole;
    c.pole = null;
    p.held = false;
    p.power = c.targetPower || p.power;
    call(engine.release?.bind(engine), p.x, p.y, p.power, p.age);
    // letting go of a gathered nova releases its light: the hands feel it too
    let lead = '';
    try { lead = typeof getLead === 'function' ? getLead() : ''; } catch { lead = ''; }
    if (lead === 'nova') rumble(pad, 'nova', clamp(p.age / 1.5, 0.3, 1));
    pad.fading.push({ pole: p, gone: 0 });
  }

  // Strength from a trigger: just past the line is gentle, fully pulled is strong.
  const triggerPower = (t) => MIN_POWER + (MAX_POWER - MIN_POWER) * clamp((t - HOLD_OFF) / (1 - HOLD_OFF), 0, 1);

  function hold(pad, c, trigger, click) {
    if (click) {
      c.latched = !c.latched;
      say(c.latched
        ? `Gamepad ${pad.index + 1} holds its ${c.side} light. Click the stick again to let go.`
        : `Gamepad ${pad.index + 1} lets go of its ${c.side} light`);
    }
    c.trigger = c.trigger ? trigger > HOLD_OFF : trigger > HOLD_ON;
    const want = c.trigger || c.latched;
    const power = c.trigger ? Math.max(triggerPower(trigger), c.latched ? LATCH_POWER : 0) : LATCH_POWER;
    if (want && !c.pole) press(pad, c, power);
    else if (!want && c.pole) letGo(pad, c);
    if (c.pole) c.targetPower = power;
  }

  // A held pole sits under its cursor. It is cast through the camera again every frame, so it
  // stays under the cursor while the camera sways, and its speed is measured from its moves.
  function follow(c, step) {
    const p = c.pole;
    const w = toWorld(c);
    if (step > 0) {
      const k = approach(step, VELOCITY_TAU);
      p.vx += ((w.x - c.wx) / step - p.vx) * k;
      p.vy += ((w.y - c.wy) / step - p.vy) * k;
    }
    c.wx = w.x;
    c.wy = w.y;
    p.x = w.x;
    p.y = w.y;
    p.age += step;
    p.power += (c.targetPower - p.power) * approach(step, POWER_TAU);
  }

  // ---- buttons ------------------------------------------------------------------------------

  const ADJUST = { up: ['trails', 1], down: ['trails', -1], right: ['size', 1], left: ['size', -1] };

  function button(pad, name) {
    switch (name) {
      case 'a': {
        const w = toWorld(pad.cursors.left);
        call(actions.pulse, w.x, w.y, PULSE_POWER, pad.player.color);
        rumble(pad, 'pulse');
        break;
      }
      case 'b': call(actions.nextBehaviour, 1); break;
      case 'x': call(actions.nextPalette, 1); break;
      case 'y': call(actions.surprise); break;
      case 'lb': call(actions.nextPreset, -1); break;
      case 'rb': call(actions.nextPreset, 1); break;
      case 'start': call(actions.toggleUI); break;
      case 'back': call(actions.togglePhonePanel); break;
      default:
        if (ADJUST[name]) call(actions.adjust, ADJUST[name][0], ADJUST[name][1] * ADJUST_STEP);
    }
  }

  function play(pad, r, step, s) {
    const dz = within(s.padDeadzone, 0.05, 0.4, DEADZONE);
    const k = within(s.padCurve, 1, 3, CURVE);
    const axis = (i, v) => (pad.ignoreAxis[i] ? 0 : v);
    const b = r.buttons;
    const pressedNow = (name) => b[name].pressed && !pad.prev[name];

    steer(pad.cursors.left, axis(0, r.lx), axis(1, r.ly), step, dz, k);
    steer(pad.cursors.right, axis(2, r.rx), axis(3, r.ry), step, dz, k);
    hold(pad, pad.cursors.left, b.lt.value, pressedNow('ls'));
    hold(pad, pad.cursors.right, b.rt.value, pressedNow('rs'));
    for (const c of [pad.cursors.left, pad.cursors.right]) if (c.pole) follow(c, step);

    for (const name of ['a', 'b', 'x', 'y', 'lb', 'rb', 'start', 'back', 'up', 'down', 'left', 'right']) {
      if (!b[name].pressed) {
        pad.held[name] = 0;
        continue;
      }
      if (pressedNow(name)) {
        pad.held[name] = 0;
        button(pad, name);
      } else if (ADJUST[name]) {
        // holding a D-pad direction keeps stepping, so a long change needs no hammering
        const before = pad.held[name];
        pad.held[name] = before + step;
        const reps = (t) => (t < REPEAT_DELAY ? 0 : 1 + Math.floor((t - REPEAT_DELAY) / REPEAT_EVERY));
        for (let i = reps(before); i < reps(pad.held[name]); i++) button(pad, name);
      }
    }

    const busy = BUTTONS.some((n) => n !== 'home' && b[n].pressed) || b.lt.value > HOLD_ON || b.rt.value > HOLD_ON
      || Math.hypot(axis(0, r.lx), axis(1, r.ly)) > ACTIVE_STICK || Math.hypot(axis(2, r.rx), axis(3, r.ry)) > ACTIVE_STICK
      || pad.cursors.left.latched || pad.cursors.right.latched;
    pad.idle = busy ? 0 : pad.idle + step;
  }

  function publish(pad, step) {
    const k = Math.exp(-step / COAST_TAU);
    for (const f of pad.fading) {
      const p = f.pole;
      f.gone += step;
      p.age += step;
      // a let-go pole glides on along its last motion, slowing, while it fades
      p.x += p.vx * COAST_TAU * (1 - k);
      p.y += p.vy * COAST_TAU * (1 - k);
      p.vx *= k;
      p.vy *= k;
      p.fade = Math.max(0, 1 - f.gone / FADE_SECONDS);
    }
    pad.fading = pad.fading.filter((f) => f.gone < FADE_SECONDS);
    if (!pad.player) return;
    const poles = [];
    for (const c of [pad.cursors.left, pad.cursors.right]) if (c.pole) poles.push({ ...c.pole });
    for (const f of pad.fading) poles.push({ ...f.pole });
    hub.setPoles(pad.player.id, poles);
  }

  const onBlur = () => stopAll();
  const onHidden = () => { if (globalThis.document?.hidden) stopAll(); };
  globalThis.addEventListener?.('blur', onBlur);
  globalThis.document?.addEventListener?.('visibilitychange', onHidden);

  return {
    update(dt, time) {
      const step = finite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;
      clock = finite(time) ? time : clock + step;
      const s = settings();
      const seen = new Set();
      for (const raw of connectedPads(getPads)) {
        const { pad, r } = track(raw);
        seen.add(pad.key);
        if (!pad.player) {
          // the press that wakes a pad only joins it: nothing else happens on that frame
          if (BUTTONS.some((n) => n !== 'home' && r.buttons[n].pressed)) join(pad, r);
        } else {
          play(pad, r, step, s);
          if (pad.idle > IDLE_LEAVE) leave(pad);
        }
        pad.prev = Object.fromEntries(BUTTONS.map((n) => [n, r.buttons[n].pressed]));
      }
      for (const pad of [...pads.values()]) {
        if (seen.has(pad.key)) continue;
        // unplugged: the cursors let go at once; the player waits a little for it to come back
        if (pad.gone === 0) {
          for (const c of Object.values(pad.cursors)) if (c.pole) letGo(pad, c);
          if (pad.player) say(`Gamepad ${pad.index + 1} was unplugged`);
        }
        pad.gone += step || 1e-6;
        if (pad.gone > GONE_GRACE) {
          leave(pad);
          pads.delete(pad.key);
        }
      }
      for (const pad of pads.values()) publish(pad, step);
    },

    // Every joined pad's two cursors, for the overlay to draw as rings in the player's colour:
    // [{ id, player, pad, side, x, y, color, colorName, held, latched, power, idle }]
    //   id       a stable name for the cursor ('0|Xbox …|left')
    //   player   the hub player's id; pad is the pad's number for people (1 for the first)
    //   side     'left' | 'right' (the stick that moves it)
    //   x, y     where it is, as fractions of the window from its top left corner (0..1)
    //   held     pressed down as a pole now; latched: held by a stick click
    //   power    its strength while held, 0..2 (0 when not held)
    //   idle     seconds since the pad was last played, so the overlay can fade resting cursors
    cursors() {
      const out = [];
      for (const pad of pads.values()) {
        if (!pad.player || pad.gone > 0) continue;
        for (const c of [pad.cursors.left, pad.cursors.right]) {
          out.push({
            id: `${pad.key}|${c.side}`, player: pad.player.id, pad: pad.index + 1, side: c.side,
            x: c.nx, y: c.ny, color: [...pad.player.color], colorName: pad.player.colorName || '',
            held: !!c.pole, latched: c.latched, power: c.pole ? c.pole.power : 0, idle: pad.idle,
          });
        }
      }
      return out;
    },

    // The pads plugged in now: [{ pad, name, joined, player, rumble, standard }], so the overlay
    // can say "press any button to join" and which pads can rumble.
    pads() {
      return [...pads.values()].filter((p) => p.gone === 0).map((p) => ({
        pad: p.index + 1, name: p.id, joined: !!p.player, player: p.player ? p.player.id : null,
        rumble: canRumble(p.raw), standard: p.standard,
      }));
    },

    dispose() {
      globalThis.removeEventListener?.('blur', onBlur);
      globalThis.document?.removeEventListener?.('visibilitychange', onHidden);
      for (const pad of pads.values()) {
        stopRumble(pad);
        if (pad.player) hub.removePlayer(pad.player.id);
      }
      pads.clear();
    },
  };
}
