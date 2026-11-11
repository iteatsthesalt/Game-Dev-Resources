// The one place the current scene and the device settings live.
//
// Everything else reads `store.scene` / `store.settings` and listens for changes;
// nothing else writes to localStorage. Every value that comes in is cleaned by the
// schema, so a bad link, an old save or a confused caller cannot break the app.

import { createEmitter } from './util.js';
import {
  DEFAULT_SCENE, DEFAULT_SETTINGS, SETTINGS_SCHEMA,
  sanitizeScene, sanitizeSettings, diffKeys, encodeScene, decodeScene,
} from './scene.js';

const STORAGE_KEY = 'tactilume.v1';
const MAX_USER_SCENES = 60;

// localStorage can be missing, full, or throw on access (private windows, blocked
// storage, previews). This wrapper turns all of that into "nothing saved".
export function safeStorage(backing) {
  let s = backing;
  if (s === undefined) {
    try { s = globalThis.localStorage; } catch { s = null; }
  }
  return {
    get(key) {
      try { return s ? s.getItem(key) : null; } catch { return null; }
    },
    set(key, value) {
      try { if (s) s.setItem(key, value); return !!s; } catch { return false; }
    },
  };
}

// Saved scenes from whatever is in storage, cleaned. null when storage holds no list.
function cleanUserList(list) {
  if (!Array.isArray(list)) return null;
  return list
    .filter((e) => e && typeof e === 'object' && typeof e.id === 'string')
    .slice(0, MAX_USER_SCENES)
    .map((e) => ({ id: String(e.id).slice(0, 40), name: sanitizeScene({ name: e.name }).name || 'Untitled', created: Number(e.created) || 0, scene: sanitizeScene(e.scene) }));
}

export function createStore({ storage = safeStorage(), initialScene = null, persistDelayMs = 400 } = {}) {
  const ev = createEmitter();
  function readSaved() {
    try {
      const raw = storage.get(STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      return saved && typeof saved === 'object' ? saved : {};
    } catch { return {}; }
  }
  const saved = readSaved();

  let settings = Object.freeze(sanitizeSettings(saved.settings));
  let scene = Object.freeze(sanitizeScene(initialScene || saved.scene || DEFAULT_SCENE));
  let user = cleanUserList(saved.user) || [];
  // Saved scenes are shared by every tab of the app. A tab only writes its own copy of the
  // list right after it changed it; otherwise it keeps whatever another tab stored.
  let userDirty = false;

  let timer = null;
  function persistNow() {
    timer = null;
    if (!userDirty) user = cleanUserList(readSaved().user) || user;
    userDirty = false;
    // a custom storage adapter may throw; losing one save must not break the app
    try { storage.set(STORAGE_KEY, JSON.stringify({ v: 1, scene, settings, user })); } catch { /* not saved */ }
  }
  // read, change, write at once, so another tab's saved scenes are never written over
  function changeUser(fn) {
    if (timer) clearTimeout(timer);
    user = cleanUserList(readSaved().user) || user;
    const result = fn();
    userDirty = true;
    persistNow();
    ev.emit('user', user.map((e) => ({ ...e })));
    return result;
  }
  function persist() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(persistNow, persistDelayMs);
  }

  const hadSavedScene = !!(saved.scene && typeof saved.scene === 'object');

  const store = {
    // false on a first visit (nothing saved yet), so main can start on a preset
    hadSavedScene,
    get scene() { return scene; },
    get settings() { return settings; },
    on: ev.on,

    // Merges `partial` into the scene (or replaces it with `replace: true`).
    // `source` says who asked ('ui', 'preset', 'link', 'autopilot', 'keyboard', ...).
    setScene(partial, { replace = false, source = 'ui' } = {}) {
      const next = Object.freeze(sanitizeScene(partial, replace ? DEFAULT_SCENE : scene));
      const changed = diffKeys(scene, next);
      if (!changed.length) return [];
      scene = next;
      persist();
      ev.emit('scene', scene, changed, source);
      return changed;
    },

    // `persist: false` adopts values without writing them back (they came from storage)
    setSettings(partial, { source = 'ui', persist: write = true } = {}) {
      const next = Object.freeze(sanitizeSettings(partial, settings));
      const changed = diffKeys(settings, next, SETTINGS_SCHEMA);
      if (!changed.length) return [];
      settings = next;
      if (write) persist();
      ev.emit('settings', settings, changed, source);
      return changed;
    },

    resetSettings() { return store.setSettings({ ...DEFAULT_SETTINGS, introSeen: settings.introSeen }); },

    userScenes() { return user.map((e) => ({ ...e })); },

    // Returns the new entry, or null when the list is full: a save never deletes an
    // older scene behind the person's back.
    saveUserScene(name) {
      return changeUser(() => {
        if (user.length >= MAX_USER_SCENES) return null;
        const clean = sanitizeScene({ ...scene, name: name || scene.name || 'My scene' });
        const entry = { id: 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), name: clean.name, created: Date.now(), scene: clean };
        user = [entry, ...user];
        return { ...entry };
      });
    },

    deleteUserScene(id) {
      if (!user.some((e) => e.id === id)) return;
      changeUser(() => { user = user.filter((e) => e.id !== id); });
    },

    // Another tab changed what is stored: take its saved scenes, and its settings except
    // the ones that only describe what runs in this tab (the microphone or song, tilt).
    syncFromStorage() {
      const s = readSaved();
      const list = cleanUserList(s.user);
      if (list && JSON.stringify(list) !== JSON.stringify(user)) {
        user = list;
        ev.emit('user', store.userScenes());
      }
      if (s.settings && typeof s.settings === 'object') {
        const { react, tilt, ...shared } = s.settings;
        store.setSettings(shared, { source: 'other-tab', persist: false });
      }
    },

    shareCode() { return encodeScene(scene); },
    loadShareCode(code, source = 'link') {
      const s = decodeScene(code);
      if (!s) return false;
      store.setScene(s, { replace: true, source });
      return true;
    },

    flush() { if (timer) { clearTimeout(timer); persistNow(); } },
  };
  return store;
}
