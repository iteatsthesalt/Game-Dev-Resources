// renderer/input/gamepad.js: the pure stick helpers, then fake standard pads driving the real
// input hub, with fakes for the engine and the actions.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createGamepads, radialDeadzone, responseCurve, readPad, BUTTONS } from '../../src/renderer/input/gamepad.js';
import { createHub, PLAYER_COLORS } from '../../src/renderer/input/hub.js';

const W = 800, H = 500;
const screenToWorld = (px, py) => ({ x: ((px / W) * 2 - 1) * (W / H), y: 1 - (py / H) * 2 });
const close = (a, b, eps) => Math.abs(a - b) <= eps;

// A standard pad as Chrome reports it. Its vibrationActuator records every effect asked of it.
function fakePad(index = 0, { id = `Fake pad ${index} (STANDARD GAMEPAD)`, mapping = 'standard', rumble = true, axes = [0, 0, 0, 0] } = {}) {
  const pad = {
    index, id, mapping, connected: true, timestamp: 0, axes: [...axes],
    buttons: BUTTONS.map(() => ({ pressed: false, touched: false, value: 0 })),
    effects: [], resets: 0,
  };
  pad.vibrationActuator = rumble ? {
    type: 'dual-rumble',
    playEffect(type, params) { pad.effects.push({ type, ...params }); return Promise.resolve('complete'); },
    reset() { pad.resets++; return Promise.resolve('complete'); },
  } : null;
  return pad;
}
// state: { axes?: [lx, ly, rx, ry], buttons?: { a: true, rt: 0.8 } }
function setPad(pad, { axes, buttons } = {}) {
  if (axes) pad.axes = [...axes];
  for (const [name, v] of Object.entries(buttons || {})) {
    const value = typeof v === 'number' ? v : v ? 1 : 0;
    pad.buttons[BUTTONS.indexOf(name)] = { pressed: value > 0.12, touched: value > 0, value };
  }
}
// Chrome hands out a fresh snapshot of every pad on each getGamepads() call
const snapshot = (p) => ({ ...p, axes: [...p.axes], buttons: p.buttons.map((b) => ({ ...b })) });

function rig({ settings = { haptics: true }, lead = null, pads = [fakePad(0)], actions: extra = {} } = {}) {
  const hub = createHub();
  const calls = [];
  const record = (name) => (...args) => { calls.push([name, ...args]); };
  const actions = {
    pulse: record('pulse'), nextBehaviour: record('nextBehaviour'), nextPalette: record('nextPalette'),
    nextPreset: record('nextPreset'), surprise: record('surprise'), adjust: record('adjust'),
    toggleUI: record('toggleUI'), togglePhonePanel: record('togglePhonePanel'), toast: record('toast'),
    ...extra,
  };
  const engine = { released: [], screenToWorld, release(x, y, power, heldFor) { engine.released.push({ x, y, power, heldFor }); } };
  const list = pads;
  const gamepads = createGamepads({
    engine, hub, actions,
    getSettings: () => settings,
    getPads: () => list.map((p) => (p && p.connected ? snapshot(p) : null)),
    getLead: lead ? () => lead.value : null,
  });
  let time = 0;
  const step = (frames = 1, dt = 1 / 60) => {
    for (let i = 0; i < frames; i++) { time += dt; gamepads.update(dt, time); }
  };
  const named = (name) => calls.filter((c) => c[0] === name);
  // press and let go of a button over two frames
  const tap = (pad, name) => { setPad(pad, { buttons: { [name]: true } }); step(); setPad(pad, { buttons: { [name]: false } }); step(); };
  const join = (pad = list[0]) => tap(pad, 'a');
  return { gamepads, hub, calls, named, engine, list, step, tap, join, settings };
}

const cursorOf = (r, side, pad = 1) => r.gamepads.cursors().find((c) => c.pad === pad && c.side === side);

beforeEach(() => {
  globalThis.innerWidth = W;
  globalThis.innerHeight = H;
});

describe('the stick helpers', () => {
  test('radialDeadzone: inside the deadzone is nothing, and the rest starts again from zero', () => {
    assert.deepEqual(radialDeadzone(0.1, 0.1, 0.15), { x: 0, y: 0 });
    assert.deepEqual(radialDeadzone(0.15, 0, 0.15), { x: 0, y: 0 });
    const just = radialDeadzone(0.2, 0, 0.15);
    assert.ok(just.x > 0 && just.x < 0.1, `just past the edge: ${just.x}`);
    assert.ok(close(radialDeadzone(1, 0, 0.15).x, 1, 1e-12));
  });

  test('radialDeadzone is round: a diagonal reaches the same length as an axis, in its own direction', () => {
    const d = radialDeadzone(Math.SQRT1_2 * 0.6, -Math.SQRT1_2 * 0.6, 0.15);
    const a = radialDeadzone(0.6, 0, 0.15);
    assert.ok(close(Math.hypot(d.x, d.y), a.x, 1e-12));
    assert.ok(close(d.x, -d.y, 1e-12) && d.x > 0);
    // a diagonal of 0.12 on each axis is past 0.15 in length, so it counts, unlike a square deadzone
    assert.ok(Math.hypot(radialDeadzone(0.12, 0.12, 0.15).x, radialDeadzone(0.12, 0.12, 0.15).y) > 0);
  });

  test('radialDeadzone saturates before the rim, so a worn stick still reaches full speed, and never passes 1', () => {
    assert.ok(close(Math.hypot(...Object.values(radialDeadzone(0.96, 0, 0.15))), 1, 1e-12));
    assert.ok(close(Math.hypot(...Object.values(radialDeadzone(1, 1, 0.15))), 1, 1e-12), 'a square gate\'s corner is still 1');
    assert.deepEqual(radialDeadzone(NaN, Infinity), { x: 0, y: 0 });
  });

  test('responseCurve: fine near the middle, full at the end, sign kept', () => {
    assert.equal(responseCurve(0.5, 2), 0.25);
    assert.equal(responseCurve(-0.5, 2), -0.25);
    assert.equal(responseCurve(0.5, 1), 0.5);
    assert.equal(responseCurve(1, 3), 1);
    assert.equal(responseCurve(2, 2), 1, 'past full is full');
    assert.equal(responseCurve(NaN), 0);
    let last = -1;
    for (let v = -1; v <= 1; v += 0.05) { const y = responseCurve(v, 2); assert.ok(y >= last); last = y; }
  });

  test('readPad names the standard buttons and makes every number safe', () => {
    const pad = fakePad(2, { axes: [0.5, NaN, 2, -0.25] });
    setPad(pad, { buttons: { a: true, rt: 0.6 } });
    pad.buttons[BUTTONS.indexOf('lt')] = { pressed: false, value: NaN };
    const r = readPad(pad);
    assert.equal(r.index, 2);
    assert.equal(r.standard, true);
    assert.equal(r.rumble, true);
    assert.deepEqual([r.lx, r.ly, r.rx, r.ry], [0.5, 0, 1, -0.25]);
    assert.deepEqual(r.buttons.a, { pressed: true, value: 1 });
    assert.deepEqual(r.buttons.rt, { pressed: true, value: 0.6 });
    assert.deepEqual(r.buttons.lt, { pressed: false, value: 0 });
    assert.deepEqual(Object.keys(r.buttons), [...BUTTONS]);
  });

  test('readPad copes with missing buttons, buttons as bare numbers, and pads that cannot rumble', () => {
    const r = readPad({ index: 0, id: 'old', axes: [0, 0], buttons: [1, 0.05], mapping: '' });
    assert.equal(r.standard, false);
    assert.equal(r.rumble, false);
    assert.deepEqual(r.buttons.a, { pressed: true, value: 1 });
    assert.deepEqual(r.buttons.b, { pressed: false, value: 0.05 });
    assert.deepEqual(r.buttons.home, { pressed: false, value: 0 });
    assert.equal(readPad({ vibrationActuator: { playEffect() {}, effects: ['trigger-rumble'] } }).rumble, false, 'no dual-rumble among its effects');
  });
});

describe('joining', () => {
  test('a pad is no player until a button is pressed, and that press only joins', () => {
    const r = rig();
    setPad(r.list[0], { axes: [1, 0, 0, 0] });
    r.step(10);
    assert.equal(r.hub.players().length, 0);
    assert.deepEqual(r.gamepads.cursors(), []);
    setPad(r.list[0], { buttons: { y: true } });
    r.step(5);
    const [player] = r.hub.players();
    assert.equal(player?.kind, 'gamepad');
    assert.equal(player?.name, 'Gamepad 1');
    assert.equal(r.named('surprise').length, 0, 'the joining press does not also surprise');
    assert.match(r.named('toast')[0]?.[1] || '', /Gamepad 1 is playing, in orange/);
    assert.equal(r.list[0].effects.length, 1, 'a short buzz says which pad joined');
    setPad(r.list[0], { buttons: { y: false } });
    r.step();
    r.tap(r.list[0], 'y');
    assert.equal(r.named('surprise').length, 1);
  });

  test('two pads are two players with their own colours and cursors', () => {
    const r = rig({ pads: [fakePad(0), fakePad(1)] });
    r.join(r.list[0]);
    r.join(r.list[1]);
    const players = r.hub.players();
    assert.equal(players.length, 2);
    assert.notDeepEqual(players[0].color, players[1].color);
    const cursors = r.gamepads.cursors();
    assert.equal(cursors.length, 4);
    assert.notEqual(cursorOf(r, 'left', 1).y, cursorOf(r, 'left', 2).y, 'the second pad starts on another row');
    setPad(r.list[1], { axes: [1, 0, 0, 0] });
    const before = cursorOf(r, 'left', 1).x;
    r.step(20);
    assert.equal(cursorOf(r, 'left', 1).x, before, 'pad 1 stays put');
    assert.ok(cursorOf(r, 'left', 2).x > before + 0.1, 'pad 2 moves its own cursor');
  });
});

describe('buttons', () => {
  test('each button does its action once per press', () => {
    const r = rig();
    r.join();
    for (const name of ['b', 'x', 'y', 'lb', 'rb', 'start', 'back']) {
      setPad(r.list[0], { buttons: { [name]: true } });
      r.step(30); // held for half a second: still one press
      setPad(r.list[0], { buttons: { [name]: false } });
      r.step();
    }
    const acted = r.calls.filter((c) => c[0] !== 'toast' && c[0] !== 'pulse').map((c) => c.join(' '));
    assert.deepEqual(acted, ['nextBehaviour 1', 'nextPalette 1', 'surprise', 'nextPreset -1', 'nextPreset 1', 'toggleUI', 'togglePhonePanel']);
  });

  test('A pulses at the left cursor in the player\'s colour, and rumbles', () => {
    const r = rig();
    r.join();
    const effects = r.list[0].effects.length;
    r.step(10);
    r.calls.length = 0;
    r.tap(r.list[0], 'a');
    const [pulse] = r.named('pulse');
    const c = cursorOf(r, 'left');
    const at = screenToWorld(c.x * W, c.y * H);
    assert.ok(pulse && close(pulse[1], at.x, 1e-9) && close(pulse[2], at.y, 1e-9), JSON.stringify({ pulse, at }));
    assert.equal(pulse[3], 1.5);
    assert.deepEqual(pulse[4], [...PLAYER_COLORS[0]]);
    assert.equal(r.list[0].effects.length, effects + 1);
    assert.equal(r.list[0].effects.at(-1).type, 'dual-rumble');
  });

  test('the D-pad steps trails and size, and keeps stepping while held', () => {
    const r = rig();
    r.join();
    for (const name of ['up', 'down', 'left', 'right']) r.tap(r.list[0], name);
    assert.deepEqual(r.named('adjust').map((c) => c.slice(1)), [['trails', 0.05], ['trails', -0.05], ['size', -0.05], ['size', 0.05]]);
    r.calls.length = 0;
    setPad(r.list[0], { buttons: { up: true } });
    r.step(60);
    setPad(r.list[0], { buttons: { up: false } });
    r.step(60);
    // one at once, then one every 0.12 s after the first 0.45 s
    assert.equal(r.named('adjust').length, 6);
  });

  test('a throwing action is reported once and does not repeat while its button is held', () => {
    const errors = [];
    const original = console.error;
    console.error = (e) => errors.push(e);
    try {
      const r = rig({ actions: { nextBehaviour: () => { throw new Error('broken'); } } });
      r.join();
      setPad(r.list[0], { buttons: { b: true } });
      r.step(30);
      setPad(r.list[0], { buttons: { b: false, x: true } });
      r.step(3);
      assert.equal(errors.length, 1);
      assert.equal(r.named('nextPalette').length, 1, 'the other buttons still work');
    } finally {
      console.error = original;
    }
  });
});

describe('cursors', () => {
  test('a stick moves its cursor smoothly, as fast across the screen as up it', () => {
    const r = rig();
    r.join();
    const start = cursorOf(r, 'right');
    setPad(r.list[0], { axes: [0, 0, 1, 0] });
    r.step(1);
    const first = cursorOf(r, 'right').x - start.x;
    r.step(17);
    const moved = cursorOf(r, 'right').x - start.x;
    assert.ok(first > 0 && first < moved / 18, 'it eases into its speed');
    // 0.3 s at full tilt: 1.5 screen heights a second, less the easing in
    assert.ok(close(moved * W, 1.5 * H * (0.3 - 0.05), 0.04 * H), `moved ${(moved * W).toFixed(1)} px`);
    setPad(r.list[0], { axes: [0, -1, 0, 0] });
    const up0 = cursorOf(r, 'left').y;
    r.step(18);
    const climbed = up0 - cursorOf(r, 'left').y;
    assert.ok(close(climbed * H, moved * W, 2), `up ${(climbed * H).toFixed(1)} px, across ${(moved * W).toFixed(1)} px`);
  });

  test('inside the deadzone a cursor stays still; a small tilt is slow and a full one fast', () => {
    const r = rig();
    r.join();
    const x0 = cursorOf(r, 'left').x;
    setPad(r.list[0], { axes: [0.12, 0.08, 0, 0] });
    r.step(60);
    assert.equal(cursorOf(r, 'left').x, x0);
    const speed = (tilt) => {
      const q = rig();
      q.join();
      const a = cursorOf(q, 'left').x;
      setPad(q.list[0], { axes: [tilt, 0, 0, 0] });
      q.step(12);
      return cursorOf(q, 'left').x - a;
    };
    assert.ok(speed(0.4) < speed(1) * 0.15, `0.4 moves ${speed(0.4)}, 1 moves ${speed(1)}`);
    assert.ok(speed(0.4) > 0);
  });

  test('a diagonal moves as far as a straight push', () => {
    const go = (axes) => {
      const q = rig();
      q.join();
      const a = cursorOf(q, 'left');
      setPad(q.list[0], { axes });
      q.step(12);
      const b = cursorOf(q, 'left');
      return Math.hypot((b.x - a.x) * W, (b.y - a.y) * H);
    };
    assert.ok(close(go([Math.SQRT1_2, Math.SQRT1_2, 0, 0]), go([1, 0, 0, 0]), 0.5));
  });

  test('a cursor stops at the edge and comes straight back', () => {
    const r = rig();
    r.join();
    setPad(r.list[0], { axes: [1, 0, 0, 0] });
    r.step(120);
    assert.ok(close(cursorOf(r, 'left').x, 0.98, 1e-9));
    setPad(r.list[0], { axes: [-1, 0, 0, 0] });
    r.step(2);
    assert.ok(cursorOf(r, 'left').x < 0.98, 'no pushing against the edge to undo first');
  });

  test('a pad\'s own deadzone and curve settings are used when set', () => {
    const moved = (settings, tilt) => {
      const q = rig({ settings });
      q.join();
      const a = cursorOf(q, 'left').x;
      setPad(q.list[0], { axes: [tilt, 0, 0, 0] });
      q.step(12);
      return cursorOf(q, 'left').x - a;
    };
    assert.ok(moved({}, 0.25) > 0);
    assert.equal(moved({ padDeadzone: 0.3 }, 0.25), 0);
    assert.ok(moved({ padCurve: 1 }, 0.5) > moved({ padCurve: 3 }, 0.5) * 2);
  });

  test('cursors() says where every cursor is, in window fractions, with its colour and state', () => {
    const r = rig();
    r.join();
    const c = cursorOf(r, 'right');
    assert.deepEqual(Object.keys(c).sort(), ['color', 'colorName', 'held', 'id', 'idle', 'latched', 'pad', 'player', 'power', 'side', 'x', 'y']);
    assert.ok(c.x > 0 && c.x < 1 && c.y > 0 && c.y < 1);
    assert.equal(c.player, r.hub.players()[0].id);
    assert.equal(c.colorName, 'orange');
    assert.equal(c.held, false);
    assert.equal(c.power, 0);
    c.color[0] = 0;
    assert.deepEqual(cursorOf(r, 'right').color, [...PLAYER_COLORS[0]], 'a copy');
  });
});

describe('holding a cursor down', () => {
  test('a trigger holds its cursor down as a pole where the cursor is, with a ring and a tap', () => {
    const r = rig();
    r.join();
    r.step(10); // past the join's buzz: effects are at least 50 ms apart
    const effects = r.list[0].effects.length;
    setPad(r.list[0], { buttons: { rt: 0.5 } });
    r.step(30);
    const c = cursorOf(r, 'right');
    const want = screenToWorld(c.x * W, c.y * H);
    const poles = r.hub.poles();
    assert.equal(poles.length, 1);
    assert.ok(poles[0].held && close(poles[0].x, want.x, 1e-9) && close(poles[0].y, want.y, 1e-9), JSON.stringify(poles[0]));
    assert.ok(close(poles[0].power, 0.35 + 1.45 * ((0.5 - 0.035) / 0.965), 0.02), `power ${poles[0].power}`);
    assert.equal(poles[0].player, r.hub.players()[0].id);
    assert.ok(c.held && c.power > 0);
    assert.equal(r.named('pulse').length, 1, 'pressing makes a ring, as a touch does');
    assert.equal(r.list[0].effects.length, effects + 1);
  });

  test('a fuller pull is stronger, and the strength follows the trigger smoothly', () => {
    const r = rig();
    r.join();
    setPad(r.list[0], { buttons: { lt: 0.2 } });
    r.step(30);
    const soft = r.hub.poles()[0].power;
    setPad(r.list[0], { buttons: { lt: 1 } });
    r.step(1);
    const next = r.hub.poles()[0].power;
    r.step(30);
    const hard = r.hub.poles()[0].power;
    assert.ok(soft < 0.7 && hard > 1.7, `soft ${soft}, hard ${hard}`);
    assert.ok(next > soft && next < hard, 'no jump');
  });

  test('a trigger resting near the line does not chatter: past 0.05 to hold, below 0.035 to let go', () => {
    const r = rig();
    r.join();
    setPad(r.list[0], { buttons: { rt: 0.04 } });
    r.step(5);
    assert.equal(r.hub.poles().length, 0, '0.04 from rest is not a press');
    setPad(r.list[0], { buttons: { rt: 0.06 } });
    r.step(2);
    setPad(r.list[0], { buttons: { rt: 0.04 } });
    r.step(5);
    assert.ok(r.hub.poles()[0]?.held, 'still held at 0.04 once pressed');
    setPad(r.list[0], { buttons: { rt: 0.02 } });
    r.step(1);
    assert.equal(r.hub.poles()[0]?.held, false);
  });

  test('letting go releases the pole at the engine, and it glides on and fades within 0.35 s', () => {
    const r = rig();
    r.join();
    // a quarter of a second at full tilt: well short of the right edge
    setPad(r.list[0], { buttons: { rt: 1 }, axes: [0, 0, 1, 0] });
    r.step(15);
    const moving = r.hub.poles()[0];
    assert.ok(moving.vx > 1.5 && Math.abs(moving.vy) < 1e-9, `a moving cursor gives its pole speed: ${moving.vx}`);
    setPad(r.list[0], { buttons: { rt: 0 }, axes: [0, 0, 0, 0] });
    r.step(1);
    const [released] = r.engine.released;
    assert.ok(released && close(released.heldFor, 0.25, 0.02), JSON.stringify(released));
    const lifted = r.hub.poles()[0];
    assert.equal(lifted.held, false);
    r.step(6);
    const later = r.hub.poles()[0];
    assert.ok(later.x > lifted.x, 'it glides on the way it was going');
    assert.ok(later.fade < lifted.fade);
    r.step(16);
    assert.deepEqual(r.hub.poles(), [], 'gone after 0.35 s');
  });

  test('clicking a stick holds its cursor without the trigger, until the next click', () => {
    const r = rig();
    r.join();
    r.tap(r.list[0], 'ls');
    r.step(30);
    let poles = r.hub.poles();
    assert.equal(poles.length, 1);
    assert.ok(poles[0].held && close(poles[0].power, 1, 0.01));
    assert.ok(cursorOf(r, 'left').latched);
    assert.match(r.named('toast').at(-1)[1], /holds its left light/);
    // pulling the trigger while latched adds strength; letting it go keeps the hold
    setPad(r.list[0], { buttons: { lt: 1 } });
    r.step(30);
    assert.ok(r.hub.poles()[0].power > 1.6);
    setPad(r.list[0], { buttons: { lt: 0 } });
    r.step(30);
    poles = r.hub.poles();
    assert.ok(poles[0].held && close(poles[0].power, 1, 0.02), 'still held after the trigger lets go');
    r.tap(r.list[0], 'ls');
    assert.equal(r.hub.poles()[0].held, false);
    assert.equal(cursorOf(r, 'left').latched, false);
  });

  test('both triggers hold both cursors: two fingers', () => {
    const r = rig();
    r.join();
    setPad(r.list[0], { buttons: { lt: 1, rt: 1 } });
    r.step(3);
    assert.equal(r.hub.poles().filter((p) => p.held).length, 2);
  });
});

describe('rumble', () => {
  test('with haptics off nothing rumbles', () => {
    const r = rig({ settings: { haptics: false } });
    r.join();
    r.tap(r.list[0], 'a');
    setPad(r.list[0], { buttons: { rt: 1 } });
    r.step(5);
    assert.deepEqual(r.list[0].effects, []);
  });

  test('turning haptics off takes effect at once', () => {
    const settings = { haptics: true };
    const r = rig({ settings });
    r.join();
    const n = r.list[0].effects.length;
    settings.haptics = false;
    r.tap(r.list[0], 'a');
    assert.equal(r.list[0].effects.length, n);
  });

  test('effects are short dual-rumble accents within the API\'s limits, and never more than one per 50 ms', () => {
    const r = rig();
    r.join();
    r.step(10);
    setPad(r.list[0], { buttons: { a: true, rt: 1 } }); // a pulse and a press on the same frame
    r.step(1);
    const effects = r.list[0].effects;
    assert.equal(effects.length, 2, 'the join, then one of the two');
    for (const e of effects) {
      assert.equal(e.type, 'dual-rumble');
      assert.ok(e.duration > 0 && e.duration <= 200 && e.startDelay === 0);
      assert.ok(e.strongMagnitude >= 0 && e.strongMagnitude <= 1 && e.weakMagnitude >= 0 && e.weakMagnitude <= 1);
    }
  });

  test('letting go of a nova rumbles, more after a longer hold; other behaviours do not', () => {
    const lead = { value: 'well' };
    const r = rig({ lead });
    r.join();
    r.step(10);
    const hold = (seconds) => {
      setPad(r.list[0], { buttons: { rt: 1 } });
      r.step(Math.round(seconds * 60));
      const n = r.list[0].effects.length;
      setPad(r.list[0], { buttons: { rt: 0 } });
      r.step(1);
      r.step(10);
      return r.list[0].effects.slice(n);
    };
    assert.deepEqual(hold(1), [], 'no nova: no rumble on letting go');
    lead.value = 'nova';
    const short = hold(0.3);
    const long = hold(2);
    assert.equal(short.length, 1);
    assert.equal(long.length, 1);
    assert.ok(long[0].strongMagnitude > short[0].strongMagnitude);
  });

  test('a pad without rumble plays as well as any other', () => {
    const r = rig({ pads: [fakePad(0, { rumble: false })] });
    r.join();
    r.tap(r.list[0], 'a');
    assert.equal(r.named('pulse').length, 1);
    assert.equal(r.gamepads.pads()[0].rumble, false);
  });
});

describe('plugging and unplugging', () => {
  test('an unplugged pad lets go at once, keeps its player a few seconds, and carries on if it comes back', () => {
    const r = rig();
    r.join();
    setPad(r.list[0], { buttons: { rt: 1 } });
    r.step(10);
    const id = r.hub.players()[0].id;
    r.list[0].connected = false;
    r.step(1);
    assert.match(r.named('toast').at(-1)[1], /Gamepad 1 was unplugged/);
    assert.equal(r.engine.released.length, 1);
    assert.equal(r.hub.poles()[0]?.held, false, 'its pole fades');
    assert.deepEqual(r.gamepads.cursors(), [], 'its cursors are hidden');
    r.step(120);
    assert.equal(r.hub.players()[0]?.id, id, 'still a player two seconds later');
    r.list[0].connected = true;
    setPad(r.list[0], { buttons: { rt: 0 } });
    r.step(1);
    assert.equal(r.gamepads.cursors().length, 2);
    assert.equal(r.hub.players().length, 1);
    r.tap(r.list[0], 'b');
    assert.equal(r.named('nextBehaviour').length, 1, 'no second join needed');
  });

  test('a pad gone for longer leaves; plugged in again it joins with a press and gets its colour back', () => {
    const r = rig({ pads: [fakePad(0), fakePad(1)] });
    r.join(r.list[0]);
    r.join(r.list[1]);
    const color = r.hub.players()[1].colorName;
    r.list[1].connected = false;
    r.step(6 * 60);
    assert.equal(r.hub.players().length, 1);
    assert.equal(r.gamepads.pads().length, 1);
    r.list[1].connected = true;
    r.step(2);
    assert.equal(r.hub.players().length, 1, 'back, but not playing until pressed');
    assert.equal(r.gamepads.pads().find((p) => p.pad === 2).joined, false);
    r.join(r.list[1]);
    assert.equal(r.hub.players()[1].colorName, color);
  });

  test('a pad left alone for a minute steps out, and a press brings it back', () => {
    const r = rig();
    r.join();
    r.step(61 * 60, 1 / 60);
    assert.equal(r.hub.players().length, 0);
    assert.deepEqual(r.gamepads.cursors(), []);
    r.join();
    assert.equal(r.hub.players().length, 1);
  });

  test('a latched cursor counts as playing, so it is never stepped out from under the player', () => {
    const r = rig();
    r.join();
    r.tap(r.list[0], 'rs');
    r.step(61 * 60);
    assert.equal(r.hub.players().length, 1);
    assert.ok(r.hub.poles()[0].held);
  });

  test('when getGamepads throws (gamepads forbidden), there are simply no pads', () => {
    const hub = createHub();
    const g = createGamepads({ engine: { screenToWorld }, hub, actions: {}, getSettings: () => ({}), getPads: () => { throw new DOMException('no', 'SecurityError'); } });
    assert.doesNotThrow(() => g.update(1 / 60, 0));
    assert.deepEqual(g.pads(), []);
  });

  test('pads() lists pads waiting to join as well as playing ones', () => {
    const r = rig({ pads: [fakePad(0), fakePad(3, { id: 'Second' })] });
    r.join(r.list[0]);
    assert.deepEqual(r.gamepads.pads(), [
      { pad: 1, name: 'Fake pad 0 (STANDARD GAMEPAD)', joined: true, player: r.hub.players()[0].id, rumble: true, standard: true },
      { pad: 4, name: 'Second', joined: false, player: null, rumble: true, standard: true },
    ]);
  });

  test('a pad without the standard mapping ignores an axis that rests far over, like a trigger', () => {
    const pad = fakePad(0, { mapping: '', axes: [0, 0, -1, 0, 0, -1] });
    const r = rig({ pads: [pad] });
    r.join(pad);
    const x0 = cursorOf(r, 'right').x;
    r.step(60);
    assert.equal(cursorOf(r, 'right').x, x0, 'axis 2 rests at -1: not a stick');
    setPad(pad, { axes: [1, 0, -1, 0, 0, -1] });
    const l0 = cursorOf(r, 'left').x;
    r.step(10);
    assert.ok(cursorOf(r, 'left').x > l0, 'axis 0 is still the left stick');
  });

  // Some triggers read 0 until first used, then rest at -1. Seen only at the join press, such
  // an axis looks like a centred stick, and would drag the cursor into the edge for good.
  test('an axis that comes to rest far over after the pad joined is learned to be a trigger', () => {
    const pad = fakePad(0, { mapping: '', axes: [0, 0, 0, 0, 0, 0] });
    const r = rig({ pads: [pad] });
    r.join(pad);
    setPad(pad, { axes: [0, 0, -1, 0, 0, 0] }); // the trigger is touched once, and rests at -1
    r.step(60 * 5);
    // Learned, the resting trigger is not someone playing: the pad goes idle (so its rings
    // fade, and it steps out after a minute) instead of looking busy for ever.
    r.step(60 * 2);
    assert.ok(cursorOf(r, 'right').idle >= 1.5, `the pad is resting: idle ${cursorOf(r, 'right').idle}`);
    r.step(60 * 60);
    assert.equal(r.hub.players().length, 0, 'and steps out after a minute untouched');
    r.join(pad);
    // the left stick still works
    setPad(pad, { axes: [1, 0, -1, 0, 0, 0] });
    const l0 = cursorOf(r, 'left').x;
    r.step(10);
    assert.ok(cursorOf(r, 'left').x > l0);
  });

  test('a stick tilted during the join press is a stick again once it is let go', () => {
    const pad = fakePad(0, { mapping: '', axes: [0, 0, 0.9, 0, 0, -1] });
    const r = rig({ pads: [pad] });
    r.join(pad);
    setPad(pad, { axes: [0, 0, 0, 0, 0, -1] }); // let go: it rests in the middle
    r.step(60);
    setPad(pad, { axes: [0, 0, 1, 0, 0, -1] });
    const x0 = cursorOf(r, 'right').x;
    r.step(20);
    assert.ok(cursorOf(r, 'right').x > x0 + 0.05, 'axis 2 steers the right cursor');
  });

  test('a stick pushed hard against the edge for a while is still a stick', () => {
    const pad = fakePad(0, { mapping: '', axes: [0, 0, 0, 0, 0, -1] });
    const r = rig({ pads: [pad] });
    r.join(pad);
    setPad(pad, { axes: [0, 0, -1, 0, 0, -1] });
    r.step(60 * 2); // two seconds into the left edge
    setPad(pad, { axes: [0, 0, 1, 0, 0, -1] }); // and straight back the other way
    const x0 = cursorOf(r, 'right').x;
    r.step(20);
    assert.ok(cursorOf(r, 'right').x > x0 + 0.05, `it turns back at once: ${x0} → ${cursorOf(r, 'right').x}`);
  });

  test('dispose removes the players and stops any rumble', () => {
    const r = rig();
    r.join();
    r.gamepads.dispose();
    assert.equal(r.hub.players().length, 0);
    assert.ok(r.list[0].resets >= 1);
  });
});
