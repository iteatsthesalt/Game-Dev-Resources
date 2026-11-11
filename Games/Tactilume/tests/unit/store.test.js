// The store runs against an in-memory storage here; the browser scenarios cover the
// real localStorage.
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, safeStorage } from '../../src/js/core/store.js';
import { DEFAULT_SCENE, DEFAULT_SETTINGS, sanitizeScene, encodeScene } from '../../src/js/core/scene.js';

// The key and format saved on people's devices: changing either loses their scenes.
const KEY = 'tactilume.v1';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    writes: 0,
    get(k) { return data.has(k) ? data.get(k) : null; },
    set(k, v) { this.writes++; data.set(k, String(v)); return true; },
    saved() { return data.has(KEY) ? JSON.parse(data.get(KEY)) : null; },
  };
}

// A localStorage-like object that refuses everything, like a blocked or full one.
const refusingBacking = () => ({
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('QuotaExceededError'); },
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const listen = (store, name) => {
  const calls = [];
  store.on(name, (...args) => calls.push(args));
  return calls;
};

// stores made with the default debounce leave a timer behind; flush them so tests end promptly
const made = [];
const make = (opts) => { const s = createStore(opts); made.push(s); return s; };
afterEach(() => { while (made.length) made.pop().flush(); });

describe('a first visit', () => {
  test('starts from the defaults with nothing saved', () => {
    const storage = memoryStorage();
    const store = make({ storage });
    assert.deepEqual(store.scene, sanitizeScene({}));
    assert.deepEqual(store.settings, { ...DEFAULT_SETTINGS });
    assert.equal(store.hadSavedScene, false);
    assert.deepEqual(store.userScenes(), []);
    assert.equal(storage.writes, 0, 'reading does not write');
  });

  test('scene and settings are frozen and replaced on change', () => {
    const store = make({ storage: memoryStorage() });
    const before = store.scene;
    assert.ok(Object.isFrozen(store.scene));
    assert.ok(Object.isFrozen(store.settings));
    assert.throws(() => { store.scene.speed = 2; }, TypeError);
    store.setScene({ speed: 0.5 });
    assert.notEqual(store.scene, before);
    assert.equal(before.speed, DEFAULT_SCENE.speed, 'the old object is untouched');
  });

  test('an initial scene (from a link) wins over the defaults', () => {
    const store = make({ storage: memoryStorage(), initialScene: { palette: 'koi', bogus: 1 } });
    assert.equal(store.scene.palette, 'koi');
    assert.equal(store.scene.bogus, undefined);
  });
});

describe('setScene and setSettings', () => {
  test('setScene returns and emits the changed keys and the source', () => {
    const store = make({ storage: memoryStorage() });
    const calls = listen(store, 'scene');
    const changed = store.setScene({ speed: 0.5, glow: 0.9, bogus: 3 }, { source: 'keyboard' });
    assert.deepEqual(changed.sort(), ['glow', 'speed']);
    assert.equal(calls.length, 1);
    const [scene, keys, source] = calls[0];
    assert.equal(scene, store.scene);
    assert.deepEqual(keys.sort(), ['glow', 'speed']);
    assert.equal(source, 'keyboard');
  });

  test('the source defaults to ui', () => {
    const store = make({ storage: memoryStorage() });
    const calls = listen(store, 'scene');
    store.setScene({ speed: 0.5 });
    assert.equal(calls[0][2], 'ui');
  });

  test('no event and no save when nothing changes', () => {
    const storage = memoryStorage();
    const store = make({ storage });
    const calls = listen(store, 'scene');
    assert.deepEqual(store.setScene({ speed: DEFAULT_SCENE.speed }), []);
    assert.deepEqual(store.setScene({ speed: 'fast', palette: 'nope' }), [], 'junk is cleaned away to no change');
    assert.deepEqual(store.setScene({}), []);
    store.flush();
    assert.equal(calls.length, 0);
    assert.equal(storage.writes, 0);
  });

  test('replace resets every field not given', () => {
    const store = make({ storage: memoryStorage() });
    store.setScene({ speed: 0.5, glow: 0.9 });
    const changed = store.setScene({ palette: 'koi' }, { replace: true, source: 'preset' });
    assert.deepEqual(changed.sort(), ['glow', 'palette', 'speed']);
    assert.equal(store.scene.speed, DEFAULT_SCENE.speed);
    assert.equal(store.scene.palette, 'koi');
  });

  test('values are cleaned on the way in', () => {
    const store = make({ storage: memoryStorage() });
    store.setScene({ speed: 99, symmetry: 2.6, name: ' <b>Hi</b> ' });
    assert.equal(store.scene.speed, 2);
    assert.equal(store.scene.symmetry, 3);
    assert.equal(store.scene.name, 'bHi/b');
  });

  test('setSettings returns and emits the changed keys and the source', () => {
    const store = make({ storage: memoryStorage() });
    const calls = listen(store, 'settings');
    assert.deepEqual(store.setSettings({ volume: 0.2, sound: true, speed: 1 }, { source: 'test' }).sort(), ['sound', 'volume']);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], store.settings);
    assert.deepEqual(calls[0][1].sort(), ['sound', 'volume']);
    assert.equal(calls[0][2], 'test');
    assert.deepEqual(store.setSettings({ volume: 0.2 }), []);
    assert.equal(calls.length, 1);
  });

  test('resetSettings restores the defaults but remembers the intro was seen', () => {
    const store = make({ storage: memoryStorage() });
    store.setSettings({ volume: 0.2, calm: true, introSeen: true });
    store.resetSettings();
    assert.deepEqual(store.settings, { ...DEFAULT_SETTINGS, introSeen: true });
  });

  test('on() returns a function that stops the listener', () => {
    const store = make({ storage: memoryStorage() });
    let n = 0;
    const off = store.on('scene', () => n++);
    store.setScene({ speed: 0.5 });
    off();
    store.setScene({ speed: 0.6 });
    assert.equal(n, 1);
  });
});

describe('saving', () => {
  test('saves after the debounce, once for a burst of changes', async () => {
    const storage = memoryStorage();
    const store = make({ storage, persistDelayMs: 30 });
    store.setScene({ speed: 0.5 });
    store.setScene({ speed: 0.6 });
    store.setSettings({ volume: 0.3 });
    assert.equal(storage.writes, 0, 'not straight away');
    await wait(80);
    assert.equal(storage.writes, 1);
    const saved = storage.saved();
    assert.equal(saved.v, 1);
    assert.equal(saved.scene.speed, 0.6);
    assert.equal(saved.settings.volume, 0.3);
    assert.deepEqual(saved.user, []);
  });

  test('flush saves at once, and only when something is waiting', () => {
    const storage = memoryStorage();
    const store = make({ storage, persistDelayMs: 10000 });
    store.flush();
    assert.equal(storage.writes, 0);
    store.setScene({ glow: 0.1 });
    store.flush();
    assert.equal(storage.writes, 1);
    assert.equal(storage.saved().scene.glow, 0.1);
    store.flush();
    assert.equal(storage.writes, 1);
  });

  test('a new store restores the scene, settings and saved scenes', () => {
    const storage = memoryStorage();
    const a = make({ storage });
    a.setScene({ palette: 'abyss', speed: 0.7, chords: ['nova', 'burst'] });
    a.setSettings({ volume: 0.25, calm: true });
    const saved = a.saveUserScene('Evening');
    a.flush();
    const b = make({ storage });
    assert.deepEqual(b.scene, a.scene);
    assert.deepEqual(b.settings, a.settings);
    assert.deepEqual(b.userScenes(), a.userScenes());
    assert.equal(b.userScenes()[0].id, saved.id);
    assert.equal(b.hadSavedScene, true);
  });

  test('a link still wins over the saved scene', () => {
    const storage = memoryStorage();
    const a = make({ storage });
    a.setScene({ palette: 'abyss' });
    a.flush();
    const b = make({ storage, initialScene: sanitizeScene({ palette: 'koi' }) });
    assert.equal(b.scene.palette, 'koi');
  });
});

describe('damaged or missing storage', () => {
  for (const [what, raw] of Object.entries({
    'corrupt JSON': '{"scene": {"speed": 0.5',
    'JSON null': 'null',
    'a number': '42',
    'a string': '"scene"',
    'an array': '[1,2,3]',
    'empty text': '',
  })) {
    test(`${what} falls back to the defaults`, () => {
      const store = make({ storage: memoryStorage({ [KEY]: raw }) });
      assert.deepEqual(store.scene, sanitizeScene({}));
      assert.deepEqual(store.settings, { ...DEFAULT_SETTINGS });
      assert.deepEqual(store.userScenes(), []);
      assert.equal(store.hadSavedScene, false);
    });
  }

  test('bad values inside good JSON are cleaned', () => {
    const raw = JSON.stringify({
      v: 1,
      scene: { speed: 999, palette: 'nope', name: '<script>', bogus: true },
      settings: { quality: 'turbo', volume: -4, sound: 'loud' },
      user: [null, 5, 'x', { id: 7 }, { id: 'ok', name: '<b>Mine</b>', created: 'yesterday', scene: 'junk' }, { id: 'x'.repeat(100), scene: { speed: 0.5 } }],
    });
    const store = make({ storage: memoryStorage({ [KEY]: raw }) });
    assert.equal(store.scene.speed, 2);
    assert.equal(store.scene.palette, DEFAULT_SCENE.palette);
    assert.equal(store.scene.name, 'script');
    assert.equal(store.scene.bogus, undefined);
    assert.equal(store.settings.quality, DEFAULT_SETTINGS.quality);
    assert.equal(store.settings.volume, 0);
    assert.equal(store.settings.sound, false);
    const user = store.userScenes();
    assert.equal(user.length, 2, 'entries without a string id are dropped');
    assert.deepEqual(user[0], { id: 'ok', name: 'bMine/b', created: 0, scene: sanitizeScene({}) });
    assert.equal(user[1].id.length, 40);
    assert.equal(user[1].name, 'Untitled');
    assert.equal(user[1].scene.speed, 0.5);
  });

  test('storage that throws on every call never throws out of the store', () => {
    const store = make({ storage: safeStorage(refusingBacking()) });
    assert.deepEqual(store.scene, sanitizeScene({}));
    assert.doesNotThrow(() => {
      store.setScene({ speed: 0.5 });
      store.setSettings({ volume: 0.1 });
      store.saveUserScene('Kept in memory');
      store.flush();
    });
    assert.equal(store.scene.speed, 0.5, 'still works in memory');
    assert.equal(store.userScenes().length, 1);
  });

  test('missing storage behaves like empty storage', () => {
    const store = make({ storage: safeStorage(null) });
    store.setScene({ speed: 0.5 });
    assert.doesNotThrow(() => store.flush());
    assert.equal(store.hadSavedScene, false);
  });

  test('safeStorage survives a localStorage getter that throws', () => {
    const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
    try {
      const s = safeStorage();
      assert.equal(s.get(KEY), null);
      assert.equal(s.set(KEY, 'x'), false);
    } finally {
      if (had) Object.defineProperty(globalThis, 'localStorage', had);
      else delete globalThis.localStorage;
    }
  });

  test('safeStorage reports whether a write landed', () => {
    const backing = new Map();
    const ok = safeStorage({ getItem: (k) => backing.get(k) ?? null, setItem: (k, v) => backing.set(k, v) });
    assert.equal(ok.set('a', '1'), true);
    assert.equal(ok.get('a'), '1');
    assert.equal(safeStorage(refusingBacking()).set('a', '1'), false);
  });

  test('a storage adapter whose set throws does not break flush', () => {
    const store = make({ storage: { get() { throw new Error('nope'); }, set() { throw new Error('nope'); } } });
    store.setScene({ speed: 0.5 });
    try {
      assert.doesNotThrow(() => store.flush());
    } finally {
      made.pop(); // already flushed, possibly with a throw; do not flush it again
    }
  });
});

describe('saved scenes', () => {
  test('save, list and delete, with events', () => {
    const store = make({ storage: memoryStorage() });
    const events = listen(store, 'user');
    store.setScene({ palette: 'koi', name: 'Pond' });
    const a = store.saveUserScene('First');
    const b = store.saveUserScene('');
    assert.equal(a.name, 'First');
    assert.equal(b.name, 'Pond', 'an empty name falls back to the scene name');
    assert.equal(a.scene.palette, 'koi');
    assert.equal(typeof a.id, 'string');
    assert.notEqual(a.id, b.id);
    assert.deepEqual(store.userScenes().map((e) => e.id), [b.id, a.id], 'newest first');
    assert.equal(events.length, 2);
    assert.deepEqual(events[1][0].map((e) => e.id), [b.id, a.id]);

    store.deleteUserScene(a.id);
    assert.deepEqual(store.userScenes().map((e) => e.id), [b.id]);
    assert.equal(events.length, 3);
    store.deleteUserScene('no-such-id');
    assert.equal(events.length, 3, 'deleting nothing emits nothing');
  });

  test('a name is cleaned, and a nameless scene gets a friendly one', () => {
    const store = make({ storage: memoryStorage() });
    assert.equal(store.saveUserScene('  <i>Night</i>  ').name, 'iNight/i');
    assert.equal(store.saveUserScene().name, 'My scene');
  });

  test('the list hands out copies', () => {
    const store = make({ storage: memoryStorage() });
    store.saveUserScene('One');
    const list = store.userScenes();
    list[0].name = 'Changed';
    list.pop();
    assert.equal(store.userScenes()[0].name, 'One');
  });

  test('keeps at most 60 and refuses more, never dropping an older scene', () => {
    const storage = memoryStorage();
    const store = make({ storage });
    const results = [];
    for (let i = 0; i < 65; i++) results.push(store.saveUserScene(`Scene ${i}`));
    assert.ok(results.slice(0, 60).every((e) => e && e.id), 'the first 60 saves succeed');
    assert.ok(results.slice(60).every((e) => e === null), 'saves past 60 are refused');
    const list = store.userScenes();
    assert.equal(list.length, 60);
    assert.equal(list[0].name, 'Scene 59');
    assert.equal(list[59].name, 'Scene 0');
    store.flush();
    assert.equal(storage.saved().user.length, 60);
  });

  test('two tabs never write over each other\'s saved scenes', () => {
    const storage = memoryStorage();
    const a = make({ storage });
    const b = make({ storage });
    a.saveUserScene('Kept in tab A');
    // tab B still holds the empty list it read at start; any change it saves must keep A's scene
    b.setScene({ hue: 0.3 });
    b.flush();
    assert.deepEqual(storage.saved().user.map((e) => e.name), ['Kept in tab A']);
    b.saveUserScene('From tab B');
    assert.deepEqual(storage.saved().user.map((e) => e.name), ['From tab B', 'Kept in tab A']);
    a.deleteUserScene(a.userScenes()[0].id);
    assert.deepEqual(storage.saved().user.map((e) => e.name), ['From tab B']);
  });

  test('syncFromStorage takes another tab\'s scenes and settings, but not its microphone or tilt', () => {
    const storage = memoryStorage();
    const a = make({ storage });
    const b = make({ storage });
    const userEvents = [];
    a.on('user', (list) => userEvents.push(list.length));
    b.saveUserScene('From B');
    b.setSettings({ volume: 0.2, react: 'mic', tilt: true });
    b.flush();
    a.syncFromStorage();
    assert.deepEqual(a.userScenes().map((e) => e.name), ['From B']);
    assert.deepEqual(userEvents, [1]);
    assert.equal(a.settings.volume, 0.2);
    assert.equal(a.settings.react, 'off');
    assert.equal(a.settings.tilt, false);
  });

  test('an over-full save from elsewhere is cut to 60', () => {
    const user = Array.from({ length: 80 }, (_, i) => ({ id: `u${i}`, name: `S${i}`, created: i, scene: {} }));
    const store = make({ storage: memoryStorage({ [KEY]: JSON.stringify({ v: 1, user }) }) });
    assert.equal(store.userScenes().length, 60);
  });
});

describe('share codes', () => {
  test('shareCode encodes the current scene', () => {
    const store = make({ storage: memoryStorage() });
    store.setScene({ palette: 'aurora', symmetry: 4 });
    assert.equal(store.shareCode(), encodeScene(store.scene));
  });

  test('loadShareCode replaces the scene and reports the link as the source', () => {
    const from = make({ storage: memoryStorage() });
    from.setScene({ palette: 'aurora', symmetry: 4, mirror: true, name: 'Shared' });
    const to = make({ storage: memoryStorage() });
    to.setScene({ glow: 0.1 });
    const calls = listen(to, 'scene');
    assert.equal(to.loadShareCode(from.shareCode()), true);
    assert.deepEqual(to.scene, from.scene);
    assert.equal(calls[0][2], 'link');
  });

  test('loadShareCode refuses garbage and leaves the scene alone', () => {
    const store = make({ storage: memoryStorage() });
    store.setScene({ glow: 0.1 });
    const before = store.scene;
    for (const bad of ['garbage', '', null, '2e30', '1!!!']) assert.equal(store.loadShareCode(bad), false, String(bad));
    assert.equal(store.scene, before);
  });
});
