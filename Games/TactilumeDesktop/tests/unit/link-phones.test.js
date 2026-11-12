// renderer/input/phone.js with fakes for the bridge, hub, engine and actions: link events
// become players and poles, and the phones hear back what they should.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPhones, powerFromForce, toHex } from '../../src/renderer/input/phone.js';

const W = 800, H = 500;
// the stand-in engine maps canvas px to world units the way the real one does: y up, x across the aspect
const screenToWorld = (px, py) => ({ x: ((px / W) * 2 - 1) * (W / H), y: 1 - (py / H) * 2 });
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const settle = () => new Promise((resolve) => setImmediate(resolve));

function fakes({ withStore = true, settings = null, failSend = '', info = null } = {}) {
  const listeners = new Set();
  const sent = [];
  const bridge = {
    link: {
      // what main's link:info answers; a renderer that starts again rebuilds its phones from it
      ...(info ? { info: () => (typeof info === 'function' ? info() : Promise.resolve(info)) } : {}),
      onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      send(player, msg) {
        sent.push({ player, msg });
        if (failSend === 'throw') throw new Error('the IPC is gone');
        if (failSend === 'reject') return Promise.reject(new Error('the phone is gone'));
        return Promise.resolve(true);
      },
    },
  };
  const emit = (e) => { for (const fn of [...listeners]) fn(structuredClone(e)); };

  const players = new Map();
  const hubListeners = new Set();
  let nextId = 1;
  const colors = [[0.902, 0.624, 0], [0.337, 0.706, 0.914], [0, 0.62, 0.451]];
  const hub = {
    added: [], removed: [], poles: new Map(),
    addPlayer({ kind, name, key }) {
      for (const p of players.values()) if (p.key === key) return { ...p };
      const i = (nextId - 1) % colors.length;
      const p = { id: nextId++, kind, name, key, color: colors[i], colorName: ['orange', 'sky blue', 'bluish green'][i] };
      players.set(p.id, p);
      hub.added.push(p);
      for (const fn of hubListeners) fn([...players.values()]);
      return { ...p };
    },
    removePlayer(id) {
      if (!players.delete(id)) return;
      hub.removed.push(id);
      hub.poles.delete(id);
      for (const fn of hubListeners) fn([...players.values()]);
    },
    setPoles(id, poles) { hub.poles.set(id, poles); },
    players: () => [...players.values()],
    on(name, fn) { hubListeners.add(fn); return () => hubListeners.delete(fn); },
  };

  const engine = { released: [], screenToWorld, release(x, y, power, heldFor) { engine.released.push({ x, y, power, heldFor }); } };
  const calls = [];
  const toasts = []; // what the big screen was told
  const actions = {
    pulse: (x, y, power, color) => calls.push(['pulse', x, y, power, color]),
    nextBehaviour: (dir) => { calls.push(['nextBehaviour', dir]); return dir > 0 ? 'whirl' : 'well'; },
    nextPalette: (dir) => { calls.push(['nextPalette', dir]); return 'aurora'; },
    nextPreset: (dir) => calls.push(['nextPreset', dir]),
    surprise: () => calls.push(['surprise']),
    clear: () => calls.push(['clear']),
    toast: (text) => toasts.push(text),
  };

  const storeListeners = new Set();
  const store = withStore ? {
    scene: { lock: 'auto', palette: 'ember' },
    on(name, fn) { if (name === 'scene') storeListeners.add(fn); return () => storeListeners.delete(fn); },
    change(partial) {
      const changed = Object.keys(partial);
      store.scene = { ...store.scene, ...partial };
      for (const fn of storeListeners) fn(store.scene, changed, 'test');
    },
  } : null;

  const phones = createPhones({ bridge, hub, engine, actions, store, getSettings: settings ? () => settings : null });
  return { phones, emit, sent, hub, engine, calls, toasts, store, listeners, storeListeners, hubListeners };
}

const polesOf = (f, hubId = 1) => f.hub.poles.get(hubId) || [];
const touchEvent = (player, touches, extra = {}) => ({ type: 'touch', player, seq: 0, touches, at: 1000, ...extra });

beforeEach(() => {
  globalThis.innerWidth = W;
  globalThis.innerHeight = H;
});

describe('joining and leaving', () => {
  test('join adds a phone player and tells the phone its real colour and what is playing', async () => {
    const f = fakes();
    f.emit({ type: 'join', player: 3, name: 'Ana', caps: { touches: 10, haptics: true } });
    assert.deepEqual(f.hub.added.map(({ kind, name, key }) => ({ kind, name, key })), [{ kind: 'phone', name: 'Ana', key: 'phone3' }]);
    await settle();
    assert.deepEqual(f.sent.find((s) => s.player === 3), { player: 3, msg: { t: 'state', behaviour: 'auto', palette: 'ember', players: 1, color: '#e69f00' } });
  });

  test('a phone with no name is called by its number', () => {
    const f = fakes();
    f.emit({ type: 'join', player: 2, name: '' });
    assert.equal(f.hub.added[0].name, 'Phone 2');
  });

  test('a second join for the same player changes nothing', () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    f.emit({ type: 'join', player: 1 });
    assert.equal(f.hub.added.length, 1);
  });

  test('leave lets go of its fingers, and the player goes once their light has faded', () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    f.emit(touchEvent(1, [[0, 0.5, 0.5, 0.5]]));
    f.phones.update(1 / 60);
    f.emit({ type: 'leave', player: 1 });
    assert.equal(f.engine.released.length, 1, 'the touch was released');
    f.phones.update(0.2);
    assert.deepEqual(f.hub.removed, [], 'still fading');
    assert.equal(polesOf(f).length, 1);
    assert.equal(polesOf(f)[0].held, false);
    f.phones.update(0.2);
    assert.deepEqual(f.hub.removed, [1]);
  });

  // A join carries only the slot, and the link gives a new phone the lowest free one, so a
  // join while the last phone in that slot still fades out may be another phone altogether.
  // It gets a player of its own, named as it asked, and hears the colour it is drawn in; the
  // light the last one left keeps fading.
  test('a phone that takes a slot whose last phone is still fading out is a player of its own', async () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1, name: 'Alice' });
    f.emit(touchEvent(1, [[0, 0.5, 0.5]]));
    f.phones.update(1 / 60);
    f.emit({ type: 'leave', player: 1 });
    f.phones.update(0.05);
    await settle();
    f.sent.length = 0;
    f.emit({ type: 'join', player: 1, name: 'Bob' });
    await settle();
    assert.deepEqual(f.hub.players().map((p) => p.name), ['Bob'], 'Alice\'s player has gone');
    const told = f.sent.filter((s) => s.player === 1 && s.msg.t === 'state' && /^#[0-9a-f]{6}$/.test(s.msg.color || ''));
    assert.equal(told.length, 1, 'Bob hears his colour');
    f.phones.update(1 / 60);
    const hubId = f.hub.players()[0].id;
    assert.equal(polesOf(f, hubId).filter((p) => !p.held).length, 1, 'Alice\'s light still fades');
    f.emit(touchEvent(1, [[0, 0.2, 0.2]]));
    f.phones.update(1 / 60);
    assert.equal(polesOf(f, hubId).filter((p) => p.held).length, 1, 'Bob plays');
    f.phones.update(1);
    assert.equal(polesOf(f, hubId).length, 1, 'the faded light is gone, Bob\'s finger stays');
  });

  test('a join for a phone already playing only tells it its colour again', async () => {
    const f = fakes();
    f.emit({ type: 'join', player: 2, name: 'Ana' });
    await settle();
    f.sent.length = 0;
    f.emit({ type: 'join', player: 2, name: 'Ana' });
    await settle();
    assert.equal(f.hub.added.length, 1);
    assert.equal(f.sent.filter((s) => s.player === 2 && s.msg.t === 'state' && s.msg.color).length, 1);
  });

  test('events for a player that never joined, and malformed events, are ignored', () => {
    const f = fakes();
    for (const e of [null, 5, { type: 'touch' }, touchEvent(4, [[0, 0.5, 0.5]]), { type: 'act', player: 4, a: 'surprise' }, { type: 'leave', player: 4 }, { type: 'join', player: 'x' }]) f.emit(e);
    f.phones.update(1 / 60);
    assert.equal(f.hub.added.length, 0);
    assert.equal(f.calls.length, 0);
  });

  test('dispose stops listening and removes the phone players', () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    f.phones.dispose();
    assert.deepEqual(f.hub.removed, [1]);
    assert.equal(f.listeners.size, 0);
    assert.equal(f.storeListeners.size, 0);
    assert.equal(f.hubListeners.size, 0);
  });
});

describe('touches become poles', () => {
  test('a pad point maps over the whole canvas and through screenToWorld', () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    f.emit(touchEvent(1, [[0, 0.25, 0.75, 0.5], [7, 1, 0, 0.5]]));
    f.phones.update(1 / 60);
    const poles = polesOf(f);
    assert.equal(poles.length, 2);
    const a = screenToWorld(0.25 * W, 0.75 * H);
    const b = screenToWorld(W, 0);
    assert.ok(near(poles[0].x, a.x) && near(poles[0].y, a.y), JSON.stringify(poles[0]));
    assert.ok(near(poles[1].x, b.x) && near(poles[1].y, b.y), JSON.stringify(poles[1]));
    for (const p of poles) {
      assert.equal(p.held, true);
      assert.equal(p.kind, 'touch');
      assert.equal(p.fade, 1);
    }
    assert.notEqual(poles[0].id, poles[1].id);
  });

  test('a new finger pulses where it lands, in the player\'s colour, and buzzes its phone', async () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    f.emit(touchEvent(1, [[0, 0.5, 0.5, 0.5]]));
    const [name, x, y, power, color] = f.calls[0];
    assert.equal(name, 'pulse');
    assert.ok(near(x, 0) && near(y, 0) && near(power, 1));
    assert.deepEqual(color, [0.902, 0.624, 0]);
    await settle();
    assert.deepEqual(f.sent.filter((s) => s.msg.t === 'haptic'), [{ player: 1, msg: { t: 'haptic', ms: 30, k: 0.6 } }]);
    // the same finger moving is not a new touch
    f.emit(touchEvent(1, [[0, 0.6, 0.5, 0.5]], { at: 1016 }));
    assert.equal(f.calls.length, 1);
  });

  test('buzzes are spaced out, and haptics: false stops them', async () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    f.emit(touchEvent(1, [[0, 0.1, 0.1], [1, 0.2, 0.2], [2, 0.3, 0.3]]));
    await settle();
    assert.equal(f.sent.filter((s) => s.msg.t === 'haptic').length, 1, 'three fingers landing at once buzz once');
    const quiet = fakes({ settings: { haptics: false } });
    quiet.emit({ type: 'join', player: 1 });
    quiet.emit(touchEvent(1, [[0, 0.5, 0.5]]));
    await settle();
    assert.equal(quiet.sent.filter((s) => s.msg.t === 'haptic').length, 0);
  });

  test('force sets power: 0.5 is a usual touch', () => {
    assert.equal(powerFromForce(0.5), 1);
    assert.ok(near(powerFromForce(0), 0.6));
    assert.ok(near(powerFromForce(1), 1.6));
    assert.equal(powerFromForce(NaN), 1);
    assert.ok(powerFromForce(0.25) < 1 && powerFromForce(0.75) > 1);
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    f.emit(touchEvent(1, [[0, 0.5, 0.5, 1]]));
    f.phones.update(1 / 60);
    assert.ok(near(polesOf(f)[0].power, 1.6));
    // a change of force is eased in, not jumped to
    f.emit(touchEvent(1, [[0, 0.5, 0.5, 0]], { at: 1016 }));
    f.phones.update(1 / 60);
    const p = polesOf(f)[0].power;
    assert.ok(p < 1.6 && p > 0.6, String(p));
  });

  test('speed is measured on the phone clock when frames carry it, whatever the arrival times', () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    // 0.02 of the pad every 10 ms on the phone, but the frames arrive bunched in two clumps:
    // by arrival time the finger would seem to stand still, then jump
    for (let i = 0; i <= 30; i++) f.emit(touchEvent(1, [[0, 0.1 + i * 0.02, 0.5]], { ms: 100 + i * 10, at: 5000 + (i < 15 ? 0 : 1) }));
    f.phones.update(1 / 60);
    const vx = polesOf(f)[0].vx;
    const expected = (0.02 * 2 * (W / H)) / 0.01; // world units per second: 0.02 pad is 0.064 world, per 10 ms
    assert.ok(vx > expected * 0.9 && vx < expected * 1.02, `vx ${vx}, expected about ${expected}`);
  });

  test('without the phone clock the arrival times are used, and the speed is capped', () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    for (let i = 0; i <= 10; i++) f.emit(touchEvent(1, [[0, 0.1 + i * 0.05, 0.5]], { at: 5000 + i * 20 }));
    f.phones.update(1 / 60);
    const slow = polesOf(f)[0].vx;
    assert.ok(slow > 0, String(slow));
    const g = fakes();
    g.emit({ type: 'join', player: 1 });
    // a jump across the pad in 3 ms is a glitch, not a 1000-unit-a-second flick
    g.emit(touchEvent(1, [[0, 0, 0.5]], { ms: 0 }));
    g.emit(touchEvent(1, [[0, 1, 0.5]], { ms: 3 }));
    g.phones.update(1 / 60);
    assert.ok(Math.hypot(polesOf(g)[0].vx, polesOf(g)[0].vy) <= 40 + 1e-9);
  });

  test('a finger that rests eases its speed to zero', () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    for (let i = 0; i <= 5; i++) f.emit(touchEvent(1, [[0, 0.1 + i * 0.05, 0.5]], { ms: i * 16 }));
    f.phones.update(1 / 60);
    assert.ok(polesOf(f)[0].vx > 1);
    for (let i = 0; i < 30; i++) f.phones.update(1 / 60);
    assert.ok(Math.abs(polesOf(f)[0].vx) < 0.05, String(polesOf(f)[0].vx));
  });

  test('a lifted finger is released with its flick, glides and fades out over 0.35 s', () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    for (let i = 0; i <= 6; i++) f.emit(touchEvent(1, [[0, 0.2 + i * 0.02, 0.5]], { ms: i * 10 }));
    f.phones.update(0.25);
    f.emit(touchEvent(1, [], { ms: 70 }));
    assert.equal(f.engine.released.length, 1);
    assert.ok(near(f.engine.released[0].heldFor, 0.25));
    f.phones.update(0.1);
    const [pole] = polesOf(f);
    assert.equal(pole.held, false);
    assert.ok(pole.vx > 0, 'it keeps the speed of the flick');
    assert.ok(pole.fade < 1 && pole.fade > 0, String(pole.fade));
    const x1 = pole.x;
    f.phones.update(0.1);
    assert.ok(polesOf(f)[0].x > x1, 'and glides on');
    f.phones.update(0.2);
    assert.equal(polesOf(f).length, 0, 'gone after 0.35 s');
  });

  test('a finger lifted after resting has no flick', () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    f.emit(touchEvent(1, [[0, 0.2, 0.5]], { ms: 0 }));
    f.emit(touchEvent(1, [[0, 0.3, 0.5]], { ms: 10 }));
    f.emit(touchEvent(1, [], { ms: 500 }));
    f.phones.update(1 / 60);
    assert.equal(polesOf(f)[0].vx, 0);
  });

  test('the link\'s own let-go frame (no phone clock) still releases the finger', () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    f.emit(touchEvent(1, [[0, 0.2, 0.5]], { ms: 50, at: 1000 }));
    f.emit(touchEvent(1, [], { at: 2500 }));
    assert.equal(f.engine.released.length, 1);
    f.phones.update(1 / 60);
    assert.equal(polesOf(f)[0].held, false);
  });

  test('positions follow the engine\'s mapping every frame, so a resting finger stays put on screen', () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    f.emit(touchEvent(1, [[0, 0.5, 0.5]]));
    globalThis.innerWidth = 1000; // the window was resized
    f.phones.update(1 / 60);
    const p = polesOf(f)[0];
    const expected = screenToWorld(500, 0.5 * H);
    assert.ok(near(p.x, expected.x), `${p.x} vs ${expected.x}`);
  });

  test('more than ten fingers in an event are cut to ten, and bad entries are skipped', () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    const many = Array.from({ length: 12 }, (_, i) => [i, i / 12, 0.5]);
    f.emit(touchEvent(1, [[0, 'x', 0.5], [1, NaN, 0.5], ...many]));
    f.phones.update(1 / 60);
    assert.equal(polesOf(f).length, 8, 'the first ten entries, less the two bad ones');
  });
});

describe('buttons on the phone', () => {
  test('each action calls the matching action, with its direction', () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    for (const [a, v] of [['behaviour', 1], ['behaviour', -1], ['palette', 0], ['preset', -1], ['surprise', 0], ['clear', 0], ['nonsense', 1]]) f.emit({ type: 'act', player: 1, a, v });
    assert.deepEqual(f.calls, [['nextBehaviour', 1], ['nextBehaviour', -1], ['nextPalette', 1], ['nextPreset', -1], ['surprise'], ['clear']]);
  });

  test('pulse goes off where the phone\'s fingers are, or in the middle, and buzzes', async () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    f.emit({ type: 'act', player: 1, a: 'pulse', v: 0 });
    assert.deepEqual(f.calls[0].slice(0, 4), ['pulse', 0, 0, 1.5]);
    f.emit(touchEvent(1, [[0, 0, 0.5], [1, 0.5, 0.5]]));
    f.calls.length = 0;
    f.emit({ type: 'act', player: 1, a: 'pulse', v: 0 });
    const left = screenToWorld(0, 0.5 * H).x / 2;
    assert.ok(near(f.calls[0][1], left), `${f.calls[0][1]} vs ${left}`);
    await settle();
    assert.ok(f.sent.some((s) => s.msg.t === 'haptic'));
  });

  test('a change of behaviour or palette, from anywhere, is broadcast to every phone', async () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    f.emit({ type: 'join', player: 2 });
    await settle();
    f.sent.length = 0;
    f.store.change({ lock: 'halo' });
    f.store.change({ speed: 2 }); // not something phones show
    await settle();
    assert.deepEqual(f.sent, [
      { player: 1, msg: { t: 'state', behaviour: 'halo', palette: 'ember' } },
      { player: 2, msg: { t: 'state', behaviour: 'halo', palette: 'ember' } },
    ]);
  });

  test('without the store, a phone\'s own change is still broadcast', async () => {
    const f = fakes({ withStore: false });
    f.emit({ type: 'join', player: 1 });
    await settle();
    f.sent.length = 0;
    f.emit({ type: 'act', player: 1, a: 'behaviour', v: 1 });
    f.emit({ type: 'act', player: 1, a: 'palette', v: 1 });
    await settle();
    assert.deepEqual(f.sent.map((s) => s.msg), [{ t: 'state', behaviour: 'whirl' }, { t: 'state', palette: 'aurora' }]);
  });

  test('the phones hear how many players there are when that changes', async () => {
    const f = fakes();
    f.emit({ type: 'join', player: 1 });
    await settle();
    f.sent.length = 0;
    f.emit({ type: 'join', player: 2 });
    await settle();
    assert.deepEqual(f.sent.find((s) => s.player === 1).msg, { t: 'state', players: 2 });
  });

  test('a send that throws or rejects is swallowed: the light keeps playing', async () => {
    // an unhandled rejection would fail this test file, so reaching the end is the check
    for (const failSend of ['throw', 'reject']) {
      const f = fakes({ failSend });
      f.emit({ type: 'join', player: 1 });
      f.emit(touchEvent(1, [[0, 0.5, 0.5]]));
      f.emit({ type: 'act', player: 1, a: 'pulse' });
      await settle();
      await settle();
      f.phones.update(1 / 60);
      assert.ok(f.sent.length >= 2, failSend);
      assert.equal(polesOf(f).length, 1, failSend);
    }
  });
});

describe('helpers', () => {
  test('toHex', () => {
    assert.equal(toHex([1, 0.5, 0]), '#ff8000');
    assert.equal(toHex([2, -1, 0.0039]), '#ff0001');
    assert.equal(toHex(null), '#ffffff');
  });
});

describe('telling the big screen', () => {
  const toasts = (f) => f.toasts;

  test('a phone that joins is announced with its number, name and colour', () => {
    const f = fakes();
    f.emit({ type: 'join', player: 2, name: 'Ana' });
    f.emit({ type: 'join', player: 3, name: '' });
    const [ana, third] = f.hub.players();
    assert.deepEqual(toasts(f), [
      `Phone 2 (Ana) is playing, in ${ana.colorName}`,
      `Phone 3 is playing, in ${third.colorName}`,
    ]);
  });

  test('and so is a phone that leaves, once', () => {
    const f = fakes();
    f.emit({ type: 'join', player: 2, name: 'Ana' });
    f.emit({ type: 'leave', player: 2 });
    f.phones.update(1 / 60);
    assert.deepEqual(toasts(f).slice(1), ['Phone 2 (Ana) left']);
    f.phones.update(1);
    assert.equal(toasts(f).length, 2, 'said once');
  });
});

describe('a renderer that starts again', () => {
  // After a renderer crash (main reloads the page) or View > Reload, the link still holds
  // every phone but sends no join again: the phones must come back from link.info().
  test('picks up the phones the link still holds, and their touches play', async () => {
    const f = fakes({ info: { running: true, phones: [{ player: 1, name: 'Ana', since: 1 }, { player: 4, name: '', since: 2 }] } });
    await settle();
    await settle();
    assert.deepEqual(f.hub.players().map((p) => [p.name, p.key]), [['Ana', 'phone1'], ['Phone 4', 'phone4']]);
    assert.ok(f.sent.some((s) => s.player === 4 && s.msg.t === 'state' && s.msg.color), 'each phone hears its colour again');
    assert.deepEqual(f.toasts, [], 'no news: they were playing all along');
    f.emit(touchEvent(1, [[0, 0.5, 0.5]]));
    f.phones.update(1 / 60);
    assert.equal(polesOf(f, f.hub.players()[0].id).length, 1);
    assert.equal(f.calls.filter((c) => c[0] === 'pulse').length, 1);
  });

  test('a phone that left, or joined, before the answer came is not undone by it', async () => {
    let answer;
    const f = fakes({ info: () => new Promise((resolve) => { answer = resolve; }) });
    f.emit({ type: 'join', player: 1, name: 'Ana' });
    f.emit({ type: 'leave', player: 2 });
    f.phones.update(1);
    answer({ running: true, phones: [{ player: 1, name: 'Ana', since: 1 }, { player: 2, name: 'Old', since: 1 }] });
    await settle();
    await settle();
    assert.deepEqual(f.hub.players().map((p) => p.name), ['Ana']);
    assert.equal(f.hub.added.length, 1);
  });

  test('a link that cannot answer leaves the phones to their join events', async () => {
    const f = fakes({ info: () => Promise.reject(new Error('no link')) });
    await settle();
    assert.equal(f.hub.players().length, 0);
    f.emit({ type: 'join', player: 1 });
    assert.equal(f.hub.players().length, 1);
  });
});
