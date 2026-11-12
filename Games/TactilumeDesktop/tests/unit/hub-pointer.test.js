// renderer/input/pointer.js feeding the real input hub: mouse, pen and touch events (fakes,
// with their own timestamps) become Desk's poles, with the mobile edition's feel.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPointer, powerOf, flickVelocity } from '../../src/renderer/input/pointer.js';
import { createHub, PLAYER_COLORS } from '../../src/renderer/input/hub.js';

const W = 800, H = 500;
const close = (a, b, eps) => Math.abs(a - b) <= eps;

// an element that keeps its listeners, so a test can fire events at it
function target() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    fire(name, e = {}) { for (const fn of [...(listeners.get(name) || [])]) fn({ type: name, ...e }); },
    count() { let n = 0; for (const set of listeners.values()) n += set.size; return n; },
  };
}

let win, doc, canvas, hub, engine, pulses, pointer, base, shift;
beforeEach(() => {
  win = target();
  doc = { ...target(), hidden: false, activeElement: null };
  globalThis.window = win;
  globalThis.document = doc;
  canvas = {
    ...target(),
    captured: [],
    style: {
      props: { 'touch-action': 'manipulation' },
      getPropertyValue(n) { return this.props[n] || ''; },
      setProperty(n, v) { this.props[n] = v; },
      removeProperty(n) { delete this.props[n]; },
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }),
    setPointerCapture(id) { canvas.captured.push(id); },
  };
  // the stand-in camera maps canvas px to world units as the real one does at rest: y up, x
  // across the aspect; `shift` sways it sideways
  shift = 0;
  engine = { released: [], screenToWorld: (px, py) => ({ x: ((px / W) * 2 - 1) * (W / H) + shift, y: 1 - (py / H) * 2 }), release(x, y, power, heldFor) { engine.released.push({ x, y, power, heldFor }); } };
  hub = createHub();
  pulses = [];
  pointer = createPointer(canvas, { engine, hub, actions: { pulse: (...a) => pulses.push(a) } });
  base = performance.now();
});
afterEach(() => {
  pointer.dispose();
  delete globalThis.window;
  delete globalThis.document;
});

// a pointer event at canvas px (x, y), `ms` after the test began
const ev = (x, y, ms, over = {}) => ({ pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: x, clientY: y, pressure: 0.5, width: 1, height: 1, timeStamp: base + ms, cancelable: true, preventDefault() { this.prevented = true; }, ...over });
const frame = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) pointer.update(dt); };
const poles = () => hub.poles();
const world = (x, y) => engine.screenToWorld(x, y);

describe('pressing', () => {
  test('a press makes Desk a player with a held pole under the pointer, and a ring in Desk\'s colour', () => {
    canvas.fire('pointerdown', ev(200, 250, 0));
    frame();
    const [desk] = hub.players();
    assert.equal(desk.kind, 'pointer');
    assert.equal(desk.name, 'Desk');
    const [p] = poles();
    assert.ok(p.held && close(p.x, world(200, 250).x, 1e-9) && close(p.y, world(200, 250).y, 1e-9));
    assert.equal(p.power, 1);
    assert.equal(p.player, desk.id);
    assert.equal(pulses.length, 1);
    assert.deepEqual(pulses[0].slice(0, 3), [world(200, 250).x, world(200, 250).y, 1]);
    assert.deepEqual(pulses[0][3], [...PLAYER_COLORS[0]]);
    assert.deepEqual(canvas.captured, [1], 'it keeps the pointer while dragging off the canvas');
  });

  test('the right and middle mouse buttons are not touches', () => {
    canvas.fire('pointerdown', ev(200, 250, 0, { button: 2 }));
    canvas.fire('pointerdown', ev(200, 250, 0, { button: 1, pointerId: 2 }));
    frame();
    assert.deepEqual(hub.players(), []);
    assert.deepEqual(poles(), []);
  });

  test('strength: a mouse is 1, a pen follows its pressure, a touch its pressure or its contact size', () => {
    assert.equal(powerOf({ pointerType: 'mouse', pressure: 0.9 }), 1);
    assert.ok(close(powerOf({ pointerType: 'pen', pressure: 0 }), 0.15, 1e-9));
    assert.ok(close(powerOf({ pointerType: 'pen', pressure: 1 }), 2, 1e-9));
    assert.ok(close(powerOf({ pointerType: 'touch', pressure: 0.25 }), 0.8, 1e-9));
    assert.equal(powerOf({ pointerType: 'touch', pressure: 0.5, width: 1, height: 1 }), 1, '0.5 means "cannot tell"');
    assert.equal(powerOf({ pointerType: 'touch', pressure: 0.5, width: 60, height: 60 }), 1.6, 'a broad contact is strong');
    assert.equal(powerOf({ pointerType: 'touch', pressure: 0, width: 20, height: 20 }), 0.6);
  });

  test('a pen\'s pressure changes smoothly as it is pressed harder', () => {
    canvas.fire('pointerdown', ev(100, 100, 0, { pointerType: 'pen', pressure: 0.2 }));
    frame();
    win.fire('pointermove', ev(101, 100, 16, { pointerType: 'pen', pressure: 1 }));
    frame();
    const soon = poles()[0].power;
    frame(30);
    const later = poles()[0].power;
    assert.ok(soon > 0.52 && soon < 1.5, `no jump: ${soon}`);
    assert.ok(close(later, 2, 0.02), `then all the way: ${later}`);
  });

  test('at most ten pointers are down at once', () => {
    for (let id = 1; id <= 12; id++) canvas.fire('pointerdown', ev(10 * id, 100, 0, { pointerId: id, pointerType: 'touch' }));
    frame();
    assert.equal(poles().length, 10);
    assert.equal(pointer.active(), 10);
  });

  test('pressing the light puts away a half-typed field', () => {
    let blurred = false;
    doc.activeElement = { tagName: 'INPUT', blur() { blurred = true; } };
    canvas.fire('pointerdown', ev(100, 100, 0));
    assert.ok(blurred);
  });

  test('the context menu, double-click selection and dragging are kept off the canvas', () => {
    for (const name of ['contextmenu', 'dblclick', 'selectstart', 'dragstart']) {
      const e = { cancelable: true, preventDefault() { this.prevented = true; } };
      for (const fn of canvas.listeners.get(name)) fn(e);
      assert.ok(e.prevented, name);
    }
    assert.equal(canvas.style.props['touch-action'], 'none');
  });
});

describe('moving', () => {
  test('the pole follows the pointer and gets a speed in the direction it moves', () => {
    canvas.fire('pointerdown', ev(100, 250, 0));
    for (let i = 1; i <= 10; i++) {
      win.fire('pointermove', ev(100 + i * 10, 250, i * 10));
      frame();
    }
    const [p] = poles();
    assert.ok(close(p.x, world(200, 250).x, 1e-9));
    // 10 px per 10 ms is 1000 px/s: 4 world units a second at this size, smoothed
    assert.ok(p.vx > 2.5 && p.vx <= 4.01 && Math.abs(p.vy) < 1e-9, `vx ${p.vx}`);
  });

  test('a pointer that rests eases its speed to zero', () => {
    canvas.fire('pointerdown', ev(100, 250, 0));
    for (let i = 1; i <= 5; i++) win.fire('pointermove', ev(100 + i * 10, 250, i * 10));
    frame();
    assert.ok(poles()[0].vx > 1);
    frame(30);
    assert.ok(Math.abs(poles()[0].vx) < 0.01, `vx ${poles()[0].vx}`);
  });

  test('every coalesced sample counts: a quick move just before letting go is a flick', () => {
    // Held still for a while, then moved 100 px in the last 10 ms. The move arrives as one
    // event carrying both samples; the event alone would leave a single sample in the flick
    // window, which reads as a rest.
    canvas.fire('pointerdown', ev(100, 250, 0));
    const samples = [ev(150, 250, 290), ev(200, 250, 300)];
    win.fire('pointermove', { ...samples[1], getCoalescedEvents: () => samples });
    win.fire('pointerup', ev(200, 250, 300));
    frame();
    // 50 px per 10 ms: 5000 px/s, 20 world units a second, less a frame of slowing down
    assert.ok(close(poles()[0].vx, 20 * Math.exp(-1 / 60 / 0.12), 0.1), `flick ${poles()[0].vx}`);
  });

  test('a mouse whose button came up out of sight is let go', () => {
    canvas.fire('pointerdown', ev(100, 250, 0));
    win.fire('pointermove', ev(150, 250, 20, { buttons: 0 }));
    frame();
    assert.equal(poles()[0].held, false);
  });

  test('a resting pointer stays over the same spot while the camera sways', () => {
    canvas.fire('pointerdown', ev(400, 250, 0));
    frame();
    const before = poles()[0].x;
    shift = 0.2;
    frame();
    assert.ok(close(poles()[0].x, before + 0.2, 1e-9));
  });
});

describe('letting go', () => {
  test('a flick lets go with the speed of its last moments, glides on, slows and fades out in 0.35 s', () => {
    canvas.fire('pointerdown', ev(100, 250, 0));
    frame();
    for (let i = 1; i <= 8; i++) win.fire('pointermove', ev(100 + i * 10, 250, 200 + i * 10)); // a pause, then quick
    win.fire('pointerup', ev(180, 250, 280));
    frame();
    const lifted = poles()[0];
    assert.equal(lifted.held, false);
    // the flick's speed, 1000 px/s (4 world units a second), after one frame of slowing down
    assert.ok(close(lifted.vx, 4 * Math.exp(-1 / 60 / 0.12), 0.02), `the flick's speed: ${lifted.vx}`);
    const [r] = engine.released;
    assert.ok(r && close(r.x, world(180, 250).x, 0.1) && r.power === 1);
    frame(6);
    const gliding = poles()[0];
    assert.ok(gliding.x > lifted.x && gliding.vx < lifted.vx, 'on the way it went, slowing');
    assert.ok(gliding.fade < 1);
    frame(16);
    assert.deepEqual(poles(), [], 'gone 0.35 s after letting go');
  });

  test('letting go of a resting pointer does not throw it anywhere', () => {
    canvas.fire('pointerdown', ev(100, 250, 0));
    win.fire('pointermove', ev(120, 250, 10));
    frame(30);
    win.fire('pointerup', ev(120, 250, 500));
    frame();
    const p = poles()[0];
    assert.equal(p.held, false);
    assert.equal(p.vx, 0);
  });

  test('the engine hears how long the pole was held, for a nova', () => {
    canvas.fire('pointerdown', ev(100, 250, 0));
    frame(90);
    win.fire('pointerup', ev(100, 250, 1500));
    assert.ok(close(engine.released[0].heldFor, 1.5, 0.02), `${engine.released[0].heldFor}`);
  });

  test('a cancelled pointer is let go where it was, not at the 0,0 a cancel can carry', () => {
    canvas.fire('pointerdown', ev(300, 250, 0));
    frame();
    win.fire('pointercancel', ev(0, 0, 50));
    frame();
    const p = poles()[0];
    assert.equal(p.held, false);
    assert.ok(close(p.x, world(300, 250).x, 1e-9));
  });

  test('losing the pointer, or the window losing focus, lets go', () => {
    canvas.fire('pointerdown', ev(100, 250, 0));
    canvas.fire('lostpointercapture', { pointerId: 1 });
    canvas.fire('pointerdown', ev(200, 250, 0, { pointerId: 2, pointerType: 'touch' }));
    canvas.fire('pointerdown', ev(300, 250, 0, { pointerId: 3, pointerType: 'touch' }));
    win.fire('blur');
    frame();
    assert.ok(poles().every((p) => !p.held));
    assert.equal(pointer.active(), 0);
  });
});

describe('Desk as a player', () => {
  test('Desk steps out after 20 s with no pole, and comes back with the next press', () => {
    canvas.fire('pointerdown', ev(100, 250, 0));
    win.fire('pointerup', ev(100, 250, 10));
    frame(60);
    assert.equal(hub.players().length, 1, 'a second later Desk is still playing');
    frame(20 * 60);
    assert.deepEqual(hub.players(), []);
    canvas.fire('pointerdown', ev(100, 250, 30000));
    frame();
    assert.equal(hub.players()[0]?.name, 'Desk');
  });

  test('a held pointer keeps Desk in, however long', () => {
    canvas.fire('pointerdown', ev(100, 250, 0));
    frame(25 * 60);
    assert.equal(hub.players().length, 1);
  });

  test('dispose stops listening, removes Desk and gives the canvas its style back', () => {
    canvas.fire('pointerdown', ev(100, 250, 0));
    frame();
    pointer.dispose();
    assert.deepEqual(hub.players(), []);
    assert.equal(canvas.count() + win.count() + doc.count(), 0, 'no listeners left');
    assert.equal(canvas.style.props['touch-action'], 'manipulation');
    pointer = createPointer(canvas, { engine, hub, actions: { pulse() {} } }); // for afterEach
  });
});

describe('flickVelocity', () => {
  test('the least-squares speed of the last 80 ms, capped at 40 world units a second', () => {
    const h = [{ t: 0, x: 0, y: 0 }, { t: 100, x: 0.2, y: 0 }, { t: 110, x: 0.3, y: 0.1 }, { t: 120, x: 0.4, y: 0.2 }];
    const v = flickVelocity(h, 120);
    assert.ok(close(v.vx, 10, 1e-6) && close(v.vy, 10, 1e-6), JSON.stringify(v));
    assert.equal(flickVelocity([{ t: 0, x: 0, y: 0 }], 10), null, 'one sample is a rest');
    assert.equal(flickVelocity([{ t: 0, x: 0, y: 0 }, { t: 10, x: 0, y: 0 }], 200), null, 'old samples are a rest');
    const fast = flickVelocity([{ t: 0, x: 0, y: 0 }, { t: 1, x: 10, y: 0 }], 1);
    assert.ok(close(Math.hypot(fast.vx, fast.vy), 40, 1e-9));
  });
});
