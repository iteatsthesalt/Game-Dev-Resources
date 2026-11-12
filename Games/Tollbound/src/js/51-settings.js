// 51-settings.js: the player's settings. Each module declares what the player may change; the values are kept
// through Store, and one screen shows them all.
// Owns: Settings
// Public:
//   Settings.define(key, spec)          declares a setting and its default, while files load or later. key is
//                                       dotted ('sound.master'). spec {value, label, group, order}, and by kind:
//                                         a number   min, max, step (default a twentieth of the span); format
//                                                    (value) -> text for its row (the plain number when left
//                                                    out); live: false makes a dragged slider take its value
//                                                    when the finger lets go, not while it moves
//                                         a choice   options [{value, label}]; value is one of them
//                                         a switch   a boolean value
//                                       label: what its row says (the key when left out). group: the heading it
//                                       is shown under (the key's first word when left out). order: its place
//                                       (smaller first; a group stands where its smallest order puts it).
//                                       A value stored earlier for the key is taken up at once. Throws when the
//                                       key is taken or the spec does not hold together.
//   Settings.get(key) -> value          the value now: the default until the stored values have been read.
//                                       undefined for a key that nobody defined.
//   Settings.set(key, value) -> value   stores a value and returns the value now held. A number is clamped to
//                                       min..max and put on a step (text that reads as a number is taken); a
//                                       choice must be the value of one of its options; a switch takes true or
//                                       false (also 1, 0, 'true', 'false'). Anything else changes nothing. When
//                                       the value changed it is saved and the listeners are told. Never throws
//                                       over storage: a save that fails leaves the value held in the page.
//   Settings.on(key, fn) -> off()       fn(value, key) after every change of that key. A key ending in '.*'
//                                       hears a whole group of keys ('input.*' hears 'input.aim' and the rest),
//                                       and '*' hears every key. The listeners of the key itself are told first,
//                                       then those of its groups, then those of '*'. A listener that throws is
//                                       reported once and stops none of the others.
//   Settings.row(id, order, build)      adds a hand-made row to the screen: build(back) -> element | null,
//                                       called each time the screen opens (null leaves the row out this time);
//                                       back() closes the screen. order places it among the groups. Throws when
//                                       the id is taken.
//   Settings.open() -> element | null   opens the screen 'settings' (registered with UI.screen at boot; it pauses
//                                       the game, and Escape or a pad's back button closes it). null before boot
//                                       and while it is open already.
//   Settings.keys() -> [key]            every defined key, in the order the screen shows them
//   Settings.reset()                    every defined setting back to its default
//   Settings.loaded                     true once the stored values have been read, or could not be. A value.
//
// The settings that belong to no other file are defined here:
//   input.stick     'floating' | 'fixed'   the touch stick: where the thumb lands, or fixed in the lower corner
//   input.hand      'right' | 'left'       the side the touch buttons sit on
//   input.deadzone  0.05..0.4, 0.15        the share of a stick's travel that does nothing (touch and pads)
//   input.aim       'auto' | 'pointer'     on a desktop: voices choose their targets, or aim with the mouse
//   input.haptics   true                   vibration, where the device allows it
//   ui.scale        0.85..1.4, 1           text and control size: set as the custom property --ui-scale on the
//                                          root element, for the stylesheets to multiply by
//   view.quality    'auto' | 'high' | 'medium' | 'low'   'high', 'medium' and 'low' are handed to the view's
//                                          quality() at boot and on every change; 'auto' leaves the level to the
//                                          view (and hands it 'high' again when the player goes back to auto)
//   fx.shake, fx.flash, fx.numbers   0..1, 1   how much the screen shakes, flashes and shows damage numbers.
//                                          shake and flash start at 0.3 where the system asks for reduced motion.
//   Orders: 10 to 14 'Controls', 20 to 24 'Display'.
// Storage: the Store key 'settings' holds {v: 1, values: {key: value}}: the values that differ from their
// defaults, and what was stored for keys that this build does not define, so that nothing is lost. The
// stored values are read at boot; a value the player sets before they arrive wins over the stored one.
// The screen: under each group a row for each setting, ordered by order: a slider for a number, a set of
// choices for a choice, a switch for a switch; every row and control at least 44px tall. The title and the
// footer (Defaults, Done) stay in sight while the rows scroll between them. By keys and pads (UI.nav): up and
// down go row by row in reading order (the footer last), left and right change the value; Enter or the pad's
// lower button presses the control in focus. A finger taps a choice or the switch and drags or taps a slider.
// css/20-touch.css styles it.
(function () {
  'use strict';

  const STORE_KEY = 'settings', VERSION = 1, SCREEN = 'settings';
  const specs = new Map();           // key -> spec, as made by define()
  const values = new Map();          // key -> the value now
  const kept = new Map();            // key -> what storage is to hold: values that differ from their defaults,
                                     //        and values stored for keys nobody has defined
  const early = new Set();           // keys the player set before the stored values arrived
  const listeners = new Map();       // key or pattern -> [fn]; a list is replaced when it changes
  const rows = [];                   // hand-made rows: {id, order, build}
  const blamed = new WeakSet();      // listeners already reported for throwing
  const warned = new Set();          // unknown keys already reported
  let booted = false, loaded = false, unsavedEarly = false, saving = false, again = false;
  let updaters = null;               // key -> update(value) of the rows of the open screen
  let stopWatching = null;

  Object.defineProperty(Settings, 'loaded', { enumerable: true, get: function () { return loaded; } });

  // ---- values ----

  function round6(v) { return Math.round(v * 1e6) / 1e6; }   // 1.1000000000000003 is shown and stored as 1.1

  // The value a spec accepts for raw, or undefined when it accepts none.
  function check(s, raw) {
    if (s.kind === 'number') {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
      if (!Number.isFinite(n)) return undefined;
      const steps = Math.round((Core.clamp(n, s.min, s.max) - s.min) / s.step);
      return round6(Math.min(s.max, s.min + steps * s.step));
    }
    if (s.kind === 'switch') {
      if (raw === true || raw === 1 || raw === 'true') return true;
      if (raw === false || raw === 0 || raw === 'false') return false;
      return undefined;
    }
    for (let i = 0; i < s.options.length; i++) if (s.options[i].value === raw) return raw;
    for (let i = 0; i < s.options.length; i++) {
      const v = s.options[i].value;
      if ((typeof raw === 'string' || typeof raw === 'number') && String(v) === String(raw)) return v;
    }
    return undefined;
  }

  function keep(s, v) {
    if (v === s.value) kept.delete(s.key); else kept.set(s.key, v);
  }

  function call(list, pattern, v, key) {
    for (let i = 0; list && i < list.length; i++) {
      try {
        list[i](v, key);
      } catch (err) {
        if (!blamed.has(list[i])) {
          blamed.add(list[i]);
          console.error('Settings: a listener of "' + pattern + '" threw:', err);
        }
      }
    }
  }

  // The listeners of the key itself first, then those of the groups it is in, then those of every key.
  function tell(key, v) {
    call(listeners.get(key), key, v, key);
    for (const [pattern, list] of listeners) {
      if (pattern.length > 2 && pattern.endsWith('.*') && key.startsWith(pattern.slice(0, -1))) call(list, pattern, v, key);
    }
    call(listeners.get('*'), '*', v, key);
  }

  function title(word) { return word.charAt(0).toUpperCase() + word.slice(1); }

  Settings.define = function (key, spec) {
    Core.assert(typeof key === 'string' && /^[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*$/.test(key), 'Settings.define: "' + key + '" is not a dotted key');
    Core.assert(!specs.has(key), 'Settings.define: "' + key + '" is already defined');
    Core.assert(spec !== null && typeof spec === 'object', 'Settings.define: "' + key + '" needs a spec');
    const s = {
      key: key, kind: '', value: spec.value, min: 0, max: 0, step: 0, options: null,
      label: typeof spec.label === 'string' && spec.label ? spec.label : key,
      group: typeof spec.group === 'string' && spec.group ? spec.group : title(key.split('.')[0]),
      order: Number.isFinite(spec.order) ? spec.order : 1000,
      format: typeof spec.format === 'function' ? spec.format : null,
      live: spec.live !== false,
    };
    if (Array.isArray(spec.options)) {
      s.kind = 'choice';
      Core.assert(spec.options.length >= 2, 'Settings.define: the choice "' + key + '" needs two options or more');
      s.options = spec.options.map(function (o) {
        Core.assert(o && (typeof o.value === 'string' || typeof o.value === 'number' || typeof o.value === 'boolean'),
          'Settings.define: every option of "' + key + '" needs a value that is a string, a number or a boolean');
        return { value: o.value, label: typeof o.label === 'string' && o.label ? o.label : String(o.value) };
      });
      Core.assert(s.options.some(function (o) { return o.value === spec.value; }), 'Settings.define: the default of "' + key + '" is not one of its options');
    } else if (typeof spec.value === 'boolean') {
      s.kind = 'switch';
    } else if (typeof spec.value === 'number') {
      s.kind = 'number';
      s.min = spec.min;
      s.max = spec.max;
      Core.assert(Number.isFinite(s.min) && Number.isFinite(s.max) && s.min < s.max, 'Settings.define: the number "' + key + '" needs min below max');
      s.step = Number.isFinite(spec.step) && spec.step > 0 ? spec.step : (s.max - s.min) / 20;
      Core.assert(Number.isFinite(spec.value), 'Settings.define: the default of "' + key + '" is not a number');
      s.value = check(s, spec.value);
    } else {
      throw new Error('Settings.define: "' + key + '" is a number, a choice (options) or a switch (a boolean value)');
    }
    specs.set(key, s);
    values.set(key, s.value);
    if (kept.has(key)) {   // stored before this key was defined
      const v = check(s, kept.get(key));
      if (v === undefined) kept.delete(key);
      else {
        keep(s, v);
        values.set(key, v);
      }
    }
  };

  Settings.get = function (key) { return values.get(key); };

  Settings.set = function (key, value) {
    const s = specs.get(key);
    if (!s) {
      if (!warned.has(key)) {
        warned.add(key);
        console.warn('Settings.set: no setting is defined as "' + key + '"');
      }
      return undefined;
    }
    const v = check(s, value);
    if (v === undefined) return values.get(key);
    if (!loaded) early.add(key);
    if (v === values.get(key)) return v;
    keep(s, v);
    values.set(key, v);
    save();
    tell(key, v);
    return v;
  };

  Settings.on = function (key, fn) {
    Core.assert(typeof key === 'string' && key !== '' && typeof fn === 'function', 'Settings.on needs a key and a function');
    listeners.set(key, (listeners.get(key) || []).concat(fn));
    return function off() {
      const list = listeners.get(key) || [], at = list.indexOf(fn);
      if (at >= 0) listeners.set(key, list.slice(0, at).concat(list.slice(at + 1)));
    };
  };

  Settings.reset = function () {
    for (const s of specs.values()) Settings.set(s.key, s.value);
  };

  // ---- storage ----

  function snapshot() {
    const out = {};
    for (const [key, v] of kept) out[key] = v;
    return { v: VERSION, values: out };
  }

  // One write at a time; changes made meanwhile go out together in the next one.
  function save() {
    if (!loaded) {   // the stored values are not in yet: a write now would put defaults over them
      unsavedEarly = true;
      return;
    }
    if (saving) {
      again = true;
      return;
    }
    saving = true;
    let writing = null;
    try {
      writing = typeof Store.write === 'function' ? Store.write(STORE_KEY, snapshot()) : null;
    } catch (err) {
      writing = null;
    }
    Promise.resolve(writing).then(saved, saved);
  }

  function saved() {
    saving = false;
    if (again) {
      again = false;
      save();
    }
  }

  function take(data) {
    const got = data && typeof data === 'object' && data.values && typeof data.values === 'object' ? data.values : null;
    if (got) {
      for (const key of Object.keys(got)) {
        const raw = got[key];
        if (early.has(key) || !(typeof raw === 'number' || typeof raw === 'string' || typeof raw === 'boolean')) continue;
        const s = specs.get(key);
        if (!s) {
          kept.set(key, raw);   // for a module this build does not have, or one that defines its keys later
          continue;
        }
        const v = check(s, raw);
        if (v === undefined) continue;
        keep(s, v);
        if (v !== values.get(key)) {
          values.set(key, v);
          tell(key, v);
        }
      }
    }
    loaded = true;
    if (unsavedEarly) {
      unsavedEarly = false;
      save();
    }
  }

  function load() {
    let reading = null;
    try {
      reading = typeof Store.read === 'function' ? Store.read(STORE_KEY) : null;
    } catch (err) {
      reading = null;
    }
    Promise.resolve(reading).then(take, function () { take(null); });
  }

  // ---- what this file applies itself ----

  function applyScale(v) {
    if (!booted) return;
    try {
      document.documentElement.style.setProperty('--ui-scale', String(v));
    } catch (err) { /* a page without a root style: the stylesheets keep their own default */ }
  }

  function applyQuality(v, atBoot) {
    const view = Gfx.active;
    if (!view || typeof view.quality !== 'function') return;
    if (v !== 'auto') view.quality(v);
    else if (!atBoot) view.quality('high');
  }

  // Reduced motion asked for by the system: shake and flash start low, unless the player has chosen otherwise.
  function reduceMotion() {
    let calm = false;
    try {
      calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (err) {
      calm = false;
    }
    if (!calm) return;
    const keys = ['fx.shake', 'fx.flash'];
    for (let i = 0; i < keys.length; i++) {
      const s = specs.get(keys[i]);
      if (!s) continue;
      const old = s.value;
      s.value = check(s, 0.3);
      if (values.get(s.key) === old && !kept.has(s.key)) {
        values.set(s.key, s.value);
        tell(s.key, s.value);
      }
      keep(s, values.get(s.key));
    }
  }

  // ---- the screen ----

  function textOf(s, v) {
    if (s.format) {
      try {
        return String(s.format(v));
      } catch (err) { /* shown plain */ }
    }
    return String(v);
  }

  function idOf(key) { return 'set-' + key.replace(/[^A-Za-z0-9]+/g, '-'); }

  function slider(s) {
    const id = idOf(s.key), v = values.get(s.key);
    const shown = UI.h('span', { class: 'set-value', 'aria-hidden': 'true' }, textOf(s, v));
    const input = UI.h('input', { type: 'range', id: id, class: 'set-range', min: s.min, max: s.max, step: s.step, value: v });
    const show = function (value) {
      const text = textOf(s, value);
      shown.textContent = text;
      input.setAttribute('aria-valuetext', text);
      input.style.setProperty('--set-fill', round6((value - s.min) / (s.max - s.min) * 100) + '%');
    };
    input.addEventListener('input', function () {
      if (s.live) Settings.set(s.key, input.value);
      else show(check(s, input.value));
    });
    input.addEventListener('change', function () { Settings.set(s.key, input.value); });
    show(v);
    const el = UI.h('div', { class: 'set-row set-number', dataset: { setting: s.key, kind: 'number' } },
      UI.h('label', { class: 'set-label', for: id }, s.label), shown, input);
    return {
      el: el,
      update: function (value) {
        if (Number(input.value) !== value) input.value = value;
        show(value);
      },
    };
  }

  function choices(s) {
    const labelId = idOf(s.key) + '-label';
    const buttons = s.options.map(function (o) {
      return UI.h('button', { type: 'button', class: 'set-choice', role: 'radio', onclick: function () { Settings.set(s.key, o.value); } }, o.label);
    });
    const group = UI.h('div', { class: 'set-choices', role: 'radiogroup', 'aria-labelledby': labelId }, buttons);
    // Left and right pick the next option, as on a select: the move does not leave the row.
    group.addEventListener('ui-nav', function (e) {
      if (!e.detail || !e.detail.dx) return;
      e.preventDefault();
      const at = buttons.indexOf(document.activeElement), next = at + e.detail.dx;
      if (at < 0 || next < 0 || next >= buttons.length) return;
      Settings.set(s.key, s.options[next].value);
      buttons[next].focus();
    });
    const update = function (value) {
      for (let i = 0; i < buttons.length; i++) {
        const on = s.options[i].value === value;
        buttons[i].setAttribute('aria-checked', on ? 'true' : 'false');
        buttons[i].classList.toggle('is-on', on);
        buttons[i].tabIndex = on ? 0 : -1;   // the row is one stop for Tab and for UI.nav: the chosen option
      }
    };
    update(values.get(s.key));
    const el = UI.h('div', { class: 'set-row set-choice-row', dataset: { setting: s.key, kind: 'choice' } },
      UI.h('span', { class: 'set-label', id: labelId }, s.label), group);
    return { el: el, update: update };
  }

  function toggle(s) {
    const labelId = idOf(s.key) + '-label', word = UI.h('span', { class: 'set-switch-word' });
    const button = UI.h('button', {
      type: 'button', class: 'set-switch', role: 'switch', 'aria-labelledby': labelId,
      onclick: function () { Settings.set(s.key, !values.get(s.key)); },
    }, UI.h('span', { class: 'set-switch-track', 'aria-hidden': 'true' }, UI.h('span', { class: 'set-switch-knob' })), word);
    button.addEventListener('ui-nav', function (e) {
      if (!e.detail || !e.detail.dx) return;
      e.preventDefault();
      Settings.set(s.key, e.detail.dx > 0);
    });
    const update = function (value) {
      button.setAttribute('aria-checked', value ? 'true' : 'false');
      button.classList.toggle('is-on', value);
      word.textContent = value ? 'On' : 'Off';
    };
    update(values.get(s.key));
    const el = UI.h('div', { class: 'set-row set-switch-row', dataset: { setting: s.key, kind: 'switch' } },
      UI.h('span', { class: 'set-label', id: labelId }, s.label), button);
    return { el: el, update: update };
  }

  function byOrder(a, b) { return a.order - b.order || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); }

  // The groups and the hand-made rows, in the order of the screen. A group: {name, order, specs}.
  function layout() {
    const groups = new Map(), items = [];
    for (const s of specs.values()) {
      let g = groups.get(s.group);
      if (!g) {
        g = { name: s.group, order: s.order, specs: [] };
        groups.set(s.group, g);
        items.push(g);
      }
      g.order = Math.min(g.order, s.order);
      g.specs.push({ name: s.key, order: s.order, spec: s });
    }
    for (const g of groups.values()) g.specs.sort(byOrder);
    for (let i = 0; i < rows.length; i++) items.push({ name: rows[i].id, order: rows[i].order, row: rows[i] });
    return items.sort(byOrder);
  }

  Settings.keys = function () {
    const out = [], items = layout();
    for (let i = 0; i < items.length; i++) {
      if (items[i].specs) for (let k = 0; k < items[i].specs.length; k++) out.push(items[i].specs[k].name);
    }
    return out;
  };

  Settings.row = function (id, order, build) {
    Core.assert(typeof id === 'string' && id !== '' && typeof build === 'function', 'Settings.row needs an id and a build function');
    Core.assert(!rows.some(function (r) { return r.id === id; }), 'Settings.row: "' + id + '" is already a row');
    rows.push({ id: id, order: Number.isFinite(order) ? order : 1000, build: build });
  };

  function back() {
    if (UI.isOpen(SCREEN)) UI.close(SCREEN);
  }

  function handMade(row) {
    let el = null;
    try {
      el = row.build(back);
    } catch (err) {
      console.error('Settings: the row "' + row.id + '" could not be built:', err);
      return null;
    }
    return el && el.nodeType === 1 ? UI.h('div', { class: 'set-row set-own', dataset: { row: row.id } }, el) : null;
  }

  function askReset() {
    UI.confirm('Put every setting back as it was at first?', { yes: 'Reset', no: 'Keep' }).then(function (yes) {
      if (yes) Settings.reset();
    });
  }

  // The control a move up or down lands on in a row: its one focusable control; in the footer, Done.
  function stopOf(group) {
    if (group.classList.contains('set-foot')) return group.querySelector('[data-act="done"]');
    const list = group.querySelectorAll('button, input, select, textarea, [href], [tabindex]');
    for (let i = 0; i < list.length; i++) {
      const el = list[i];
      if (el.tabIndex >= 0 && !el.disabled && el.getClientRects().length > 0) return el;
    }
    return null;
  }

  // Up and down go row by row in reading order. UI.nav would look for the nearest control on the screen, and
  // the footer stands below the rows that have scrolled out of sight.
  function rowByRow(e) {
    const dy = e.detail ? e.detail.dy : 0;
    if (!dy) return;
    e.preventDefault();
    const groups = Array.from(e.currentTarget.querySelectorAll('.set-row, .set-foot'));
    const from = e.target.closest ? e.target.closest('.set-row, .set-foot') : null;
    for (let k = groups.indexOf(from) + dy; k >= 0 && k < groups.length; k += dy) {
      const stop = stopOf(groups[k]);
      if (stop) {
        stop.focus();
        return;
      }
    }
  }

  function build() {
    if (stopWatching) stopWatching();
    updaters = new Map();
    const parts = [], items = layout();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.row) {
        const el = handMade(item.row);
        if (el) parts.push(el);
        continue;
      }
      const list = [];
      for (let k = 0; k < item.specs.length; k++) {
        const s = item.specs[k].spec;
        const made = s.kind === 'number' ? slider(s) : s.kind === 'choice' ? choices(s) : toggle(s);
        updaters.set(s.key, made.update);
        list.push(made.el);
      }
      parts.push(UI.h('section', { class: 'set-group', dataset: { group: item.name } }, UI.h('h3', { class: 'set-group-name' }, item.name), list));
    }
    const watch = updaters;
    stopWatching = Settings.on('*', function (v, key) {
      const update = watch.get(key);
      if (update) update(v);
    });
    return UI.h('div', { class: 'ui-panel set-panel', role: 'dialog', 'aria-labelledby': 'set-title', 'onui-nav': rowByRow },
      UI.h('h2', { class: 'ui-heading set-title', id: 'set-title' }, 'Settings'),
      UI.h('div', { class: 'set-body' }, parts),
      UI.h('div', { class: 'set-foot' },
        UI.button('Defaults', askReset, { class: 'second', dataset: { act: 'defaults' } }),
        UI.button('Done', back, { class: 'primary', dataset: { act: 'done' } })));
  }

  function closed() {
    if (stopWatching) stopWatching();
    stopWatching = null;
    updaters = null;
  }

  Settings.open = function () {
    if (!booted || typeof UI.open !== 'function' || !UI.has(SCREEN) || UI.isOpen(SCREEN)) return null;
    return UI.open(SCREEN);
  };

  // ---- boot ----

  Plat.on('boot', function () {
    booted = true;
    reduceMotion();
    applyScale(values.get('ui.scale'));
    applyQuality(values.get('view.quality'), true);
    if (typeof UI.screen === 'function' && !UI.has(SCREEN)) UI.screen(SCREEN, { open: build, close: closed });
    load();
  });

  Settings.on('ui.scale', applyScale);
  Settings.on('view.quality', function (v) { applyQuality(v, false); });

  // ---- the settings of no other file ----

  const percent = function (v) { return Math.round(v * 100) + '%'; };

  Settings.define('input.stick', {
    value: 'floating', label: 'Touch stick', group: 'Controls', order: 10,
    options: [{ value: 'floating', label: 'Under the thumb' }, { value: 'fixed', label: 'In the corner' }],
  });
  Settings.define('input.hand', {
    value: 'right', label: 'Touch buttons', group: 'Controls', order: 11,
    options: [{ value: 'right', label: 'On the right' }, { value: 'left', label: 'On the left' }],
  });
  Settings.define('input.deadzone', { value: 0.15, min: 0.05, max: 0.4, step: 0.05, format: percent, label: 'Stick dead zone', group: 'Controls', order: 12 });
  Settings.define('input.aim', {
    value: 'auto', label: 'Aim', group: 'Controls', order: 13,
    options: [{ value: 'auto', label: 'Voices choose' }, { value: 'pointer', label: 'With the mouse' }],
  });
  Settings.define('input.haptics', { value: true, label: 'Vibration', group: 'Controls', order: 14 });
  Settings.define('ui.scale', { value: 1, min: 0.85, max: 1.4, step: 0.05, format: percent, live: false, label: 'Text and controls', group: 'Display', order: 20 });
  Settings.define('view.quality', {
    value: 'auto', label: 'Picture', group: 'Display', order: 21,
    options: [{ value: 'auto', label: 'Auto' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }],
  });
  Settings.define('fx.shake', { value: 1, min: 0, max: 1, step: 0.1, format: percent, label: 'Screen shake', group: 'Display', order: 22 });
  Settings.define('fx.flash', { value: 1, min: 0, max: 1, step: 0.1, format: percent, label: 'Flashes', group: 'Display', order: 23 });
  Settings.define('fx.numbers', { value: 1, min: 0, max: 1, step: 0.1, format: percent, label: 'Damage numbers', group: 'Display', order: 24 });
})();
