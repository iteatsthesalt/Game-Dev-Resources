// 50-platform.js: the presentation namespaces, the browser as the game sees it, and storage.
// Owns: Plat, Store
// Public:
//   Plat.query(name) -> string | null   a parameter of the page address (?view=2d&fps=1); null when it is absent
//   Plat.isTouch                        true when the device has a touch screen. A value, not a function.
//   Plat.dpr() -> number                device pixels for one CSS pixel, held inside 1..3
//   Plat.now() -> ms                    a steady clock for measuring; not the time of day
//   Plat.loop(fn)                       calls fn(now, dt) once a frame: now in ms on the clock of Plat.now, dt the
//                                       seconds since the frame before (0 on the first frame, and on the first
//                                       one after the page was hidden). There is one loop: a second call only
//                                       replaces fn. An error in fn is not swallowed, and the loop goes on; after
//                                       30 frames in a row that threw, it stops.
//   Plat.stop()                         ends the loop
//   Plat.onVisibility(fn) -> off()      fn(visible) when the page is hidden, and when it is shown again
//   Plat.onResize(fn) -> off()          fn(width, height), the window in CSS pixels, 120 ms after it last changed
//                                       size or the device was turned; after a turn once more a little later,
//                                       because some phones still report the old size at first
//   Plat.on(name, fn) -> off()          the notice board of the presentation layer: fn(a, b, c) for every
//   Plat.emit(name, a, b, c)            Plat.emit of that name. A file can so hear from one that loads after it:
//                                       it subscribes while loading, the later file posts. 90-game.js lists the
//                                       notices the game posts. Posting allocates nothing.
//   Every off() takes the listener out again. A listener that throws is reported to the console once and does
//   not stop the others.
//
//   Store.read(key) -> Promise<object | null>   the object last written under key; null when there is none or
//                                               it cannot be read. A fresh copy every time. Never rejects.
//   Store.write(key, obj) -> Promise<boolean>   true when the object is now held where Store.status says: in
//                                               storage, or in the page when there is no storage. false when
//                                               storage refused it or obj is not JSON data (an object or a
//                                               list, of plain values). Never rejects.
//   Store.remove(key) -> Promise<boolean>       forgets the key everywhere; false when a store refused
//   Store.status                        'saved'   storage holds the newest copy of everything written
//                                       'memory'  this page has no storage that lasts (a private window, a frame
//                                                 without storage): what is written is kept until the page closes
//                                       'error'   storage works but has refused something (most likely it is
//                                                 full), or the last write was not JSON data. The page holds the
//                                                 newest copy and Store.read returns it; every later write that
//                                                 succeeds offers storage what it refused, and clears this
//                                                 once nothing is left over.
//   Store.onStatus(fn) -> off()         fn(status) whenever Store.status changes
//   Keys are plain names ('save'); in the browser's storage they get the prefix 'tollbound.'.
const Plat = {}, Store = {}, Settings = {}, Input = {}, Sound = {}, Music = {}, Mesh = {}, Rigs = {}, Glyphs = {},
  Ground = {}, Gfx = {}, Scene = {}, Vfx = {}, UI = {}, Game = {};

(function () {
  'use strict';

  // ---- listeners ----

  const own = Object.create(null);     // this file's own lists: 'visibility', 'resize', 'status'
  const board = Object.create(null);   // the lists of Plat.on, by the name of the notice
  const blamed = new WeakSet();        // the listeners that have already been reported for throwing

  // A list is replaced when it changes, never edited in place, so a listener may leave while its list is told.
  function listen(lists, name, fn) {
    Core.assert(typeof fn === 'function', 'a listener must be a function (' + name + ')');
    lists[name] = (lists[name] || []).concat(fn);
    return function off() {
      const list = lists[name], at = list.indexOf(fn);
      if (at >= 0) lists[name] = list.slice(0, at).concat(list.slice(at + 1));
    };
  }

  function tell(lists, name, a, b, c) {
    const list = lists[name];
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      try {
        list[i](a, b, c);
      } catch (err) {
        if (!blamed.has(list[i])) {
          blamed.add(list[i]);
          console.error('a listener of "' + name + '" threw:', err);
        }
      }
    }
  }

  Plat.on = function (name, fn) { return listen(board, name, fn); };
  Plat.emit = function (name, a, b, c) { tell(board, name, a, b, c); };

  // ---- the page ----

  let params = null, touch = null;

  Plat.query = function (name) {
    if (!params) {
      try { params = new URLSearchParams(window.location.search); } catch (e) { params = new URLSearchParams(''); }
    }
    return params.get(name);
  };

  Object.defineProperty(Plat, 'isTouch', {
    enumerable: true,
    get: function () {
      if (touch === null) {
        try { touch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window; } catch (e) { touch = false; }
      }
      return touch;
    },
  });

  Plat.dpr = function () { return Core.clamp(window.devicePixelRatio || 1, 1, 3); };
  Plat.now = function () { return performance.now(); };

  // ---- hidden and shown ----

  let shown = true, visibilityWired = false;
  let loopFn = null, frameId = 0, lastFrame = 0, failures = 0;   // the frame loop, further down

  function setShown(next) {
    if (next === shown) return;
    shown = next;
    if (!next) lastFrame = 0;   // the time spent hidden is not a frame
    tell(own, 'visibility', next);
  }

  function wireVisibility() {
    if (visibilityWired) return;
    visibilityWired = true;
    const visible = function () { return document.visibilityState !== 'hidden'; };
    shown = visible();
    document.addEventListener('visibilitychange', function () { setShown(visible()); });
    window.addEventListener('pagehide', function () { setShown(false); });
    window.addEventListener('pageshow', function () { setShown(visible()); });
  }

  Plat.onVisibility = function (fn) {
    wireVisibility();
    return listen(own, 'visibility', fn);
  };

  // ---- the frame loop ----

  function frame(now) {
    if (!loopFn) {
      frameId = 0;
      return;
    }
    frameId = window.requestAnimationFrame(frame);   // asked for first, so that one bad frame does not end the loop
    const dt = lastFrame > 0 && now > lastFrame ? (now - lastFrame) / 1000 : 0;
    lastFrame = now;
    let fine = false;
    try {
      loopFn(now, dt);
      fine = true;
    } finally {
      failures = fine ? 0 : failures + 1;
      if (failures >= 30) Plat.stop();   // every frame fails: stop, so the page stays usable and the console readable
    }
  }

  Plat.loop = function (fn) {
    Core.assert(typeof fn === 'function', 'Plat.loop needs the function to call each frame');
    wireVisibility();
    loopFn = fn;
    lastFrame = 0;
    failures = 0;
    if (!frameId) frameId = window.requestAnimationFrame(frame);
  };

  Plat.stop = function () {
    loopFn = null;
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
  };

  // ---- the window changing size ----

  const RESIZE_WAIT = 120, TURN_WAIT = 450;
  let resizeWired = false, resizeTimer = 0, turnTimer = 0;

  function resized() { tell(own, 'resize', window.innerWidth, window.innerHeight); }

  function resizeSoon() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resized, RESIZE_WAIT);
  }

  Plat.onResize = function (fn) {
    if (!resizeWired) {
      resizeWired = true;
      window.addEventListener('resize', resizeSoon);
      window.addEventListener('orientationchange', function () {
        resizeSoon();
        window.clearTimeout(turnTimer);
        turnTimer = window.setTimeout(resized, TURN_WAIT);
      });
    }
    return listen(own, 'resize', fn);
  };

  // ---- storage ----

  const PREFIX = 'tollbound.', PROBE = '~probe';
  const held = new Map();      // key -> JSON text: the newest copy of everything written since the page opened
  const unsaved = new Set();   // the keys whose newest copy no lasting store has taken
  let status = null;           // null until someone asks or writes

  // The browser's own storage. Any use of it may throw (a private window, a frame without storage, a full
  // disk), and so may reading window.localStorage itself: every call of these is made inside try/catch.
  const local = {
    name: 'local',
    get: function (key) { return window.localStorage.getItem(PREFIX + key); },
    set: function (key, text) { window.localStorage.setItem(PREFIX + key, text); },
    remove: function (key) { window.localStorage.removeItem(PREFIX + key); },
  };

  // The stores that last, best first. A store is {name, get(key) -> text | null, set(key, text), remove(key)};
  // each call may return a promise, and throws or rejects when the store cannot be used.
  //
  // ======== A DURABLE REMOTE STORE GOES HERE, AS THE FIRST ENTRY OF THIS LIST. ========
  // A read takes the first store that holds the key, a write goes to the first store that accepts it and a
  // removal goes to all of them, so the rest of this file can stay as it is. A remote store has to do two
  // things itself: answer or fail within a few seconds (never hang), and keep the writes of one key in order.
  // Store.status starts from the browser's storage alone; a remote store should set it once it has connected.
  const stores = [local];

  function setStatus(next) {
    if (next === status) return;
    status = next;
    tell(own, 'status', next);
  }

  // The status after a write or a removal. works: did a lasting store answer just now.
  function judge(works) { setStatus(!works ? 'memory' : unsaved.size ? 'error' : 'saved'); }

  function localWorks() {
    try {
      local.set(PROBE, '1');
      local.remove(PROBE);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function someStoreWorks() {
    for (let i = 0; i < stores.length; i++) {
      try {
        await stores[i].set(PROBE, '1');
        await stores[i].remove(PROBE);
        return true;
      } catch (e) { /* try the next */ }
    }
    return false;
  }

  // Offers a text to each lasting store in turn. True when one took it.
  async function put(key, text) {
    for (let i = 0; i < stores.length; i++) {
      try {
        await stores[i].set(key, text);
        return true;
      } catch (e) { /* try the next */ }
    }
    return false;
  }

  // Storage has just taken a write: offer it what it refused earlier, or what was written while it was away.
  async function retry() {
    const waiting = Array.from(unsaved);
    for (let i = 0; i < waiting.length; i++) {
      const key = waiting[i], text = held.get(key);
      if (text !== undefined && await put(key, text) && held.get(key) === text) unsaved.delete(key);
    }
  }

  function parse(text) {
    try {
      const value = JSON.parse(text);
      return value !== null && typeof value === 'object' ? value : null;
    } catch (e) {
      return null;
    }
  }

  Object.defineProperty(Store, 'status', {
    enumerable: true,
    get: function () {
      if (status === null) status = localWorks() ? 'saved' : 'memory';
      return status;
    },
  });

  Store.onStatus = function (fn) { return listen(own, 'status', fn); };

  Store.read = async function (key) {
    key = String(key);
    if (unsaved.has(key)) return parse(held.get(key));   // the newest copy never left this page
    let answered = false;
    for (let i = 0; i < stores.length; i++) {
      try {
        const text = await stores[i].get(key);
        answered = true;
        if (typeof text === 'string') return parse(text);
      } catch (e) { /* try the next */ }
    }
    return !answered && held.has(key) ? parse(held.get(key)) : null;
  };

  Store.write = async function (key, obj) {
    key = String(key);
    let text;
    if (obj !== null && typeof obj === 'object') {
      try { text = JSON.stringify(obj); } catch (e) { /* not JSON data (it holds itself, say): text stays undefined */ }
    }
    if (typeof text !== 'string') {
      setStatus('error');
      return false;
    }
    held.set(key, text);
    unsaved.add(key);
    const took = await put(key, text);
    if (took) {
      if (held.get(key) === text) unsaved.delete(key);   // unless a newer write of this key has come in meanwhile
      await retry();
    }
    // Not taken: if storage works at all it refused this write (most likely it is full), which is an error.
    // If nothing works the page has no storage, and holding the copy here is the best there is.
    const works = took || await someStoreWorks();
    judge(works);
    return took || !works;
  };

  Store.remove = async function (key) {
    key = String(key);
    held.delete(key);
    unsaved.delete(key);
    let clean = true, reached = false;
    for (let i = 0; i < stores.length; i++) {
      try {
        await stores[i].remove(key);
        reached = true;
      } catch (e) {
        clean = false;
      }
    }
    judge(reached);
    return clean || !reached;   // with no storage at all there was nothing to remove but the copy held here
  };
})();
