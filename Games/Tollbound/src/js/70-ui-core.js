// 70-ui-core.js: the menu framework: an element builder, the stack of open screens, the confirm dialog, toasts,
// and moving focus with keys or a gamepad. Screens live in #ui, toasts in #toast; css/10-ui.css styles them.
// Owns: UI
// Public:
//   UI.h(tag, attrs, ...children) -> element
//       attrs (or null): class (a string, or a list whose empty entries are dropped), text (the text content),
//       dataset {name: value}, style {property: value} ('--name' sets a custom property), on<event>: function
//       (onclick, onpointerdown, ...); any other name is set as an attribute (true sets it empty; false, null
//       and undefined leave it out). children: elements, text and numbers, and lists of those; null and false
//       are skipped. Text is added as text and never read as markup.
//   UI.button(label, onClick, attrs) -> button   a .ui-btn. attrs as for UI.h; give class 'primary' to the one
//                                                main action of a screen and 'second' to a quieter one.
//   UI.screen(id, def)             registers a screen. def = {
//                                    open(args) -> element   builds the screen; called on every UI.open
//                                    close()                 optional; called when the screen leaves the stack.
//                                                            If it throws, that is reported and the screen goes.
//                                    pause: true             the game stands still while the screen is open
//                                    back: true              Escape, UI.back() and the pad's back button close it;
//                                                            false: they do nothing; a function: it is called
//                                                            instead, and closes the screen itself if it wants
//                                    scrim: true             it dims what is behind it
//                                  }                         (the three values shown are the defaults)
//                                  Throws when the id is taken: a file that only fills a gap asks UI.has(id) first.
//   UI.has(id) -> boolean          is a screen registered under that id
//   UI.open(id, args) -> element   puts the screen on top of the stack and moves focus into it: to the control
//                                  marked data-focus, else to its first control. Screens under it stay visible
//                                  and take no input. A screen that is open already is opened once more.
//   UI.close(id) -> id | null      closes the top screen, or the topmost screen of that id; focus returns to
//                                  where it was before the screen opened
//   UI.replace(id, args) -> element   closes the top screen and opens another in its place
//   UI.clear()                     closes every screen
//   UI.top() -> id | null          the id of the top screen; 'confirm' for a confirm dialog
//   UI.isOpen(id) -> boolean
//   UI.pausing() -> boolean        is a screen open that pauses the game. Allocates nothing.
//   UI.confirm(text, opts) -> Promise<boolean>   an in-page dialog. opts {yes, no} are the button labels ('Yes'
//                                  and 'No'). Resolves true for yes; false for no, Escape and UI.back().
//                                  Focus starts on no.
//   UI.toast(text, ms) -> element  a short message at the top of the screen for ms (2600 when left out)
//   UI.nav(dx, dy) -> boolean      moves focus to the nearest control in that direction inside the top screen
//                                  (one of dx, dy is -1 or 1, the other 0; +y is down). True when focus moved or
//                                  the control used the move itself: a slider or a select takes left and right
//                                  as its own. Before focus moves, the focused control gets a 'ui-nav' event
//                                  with detail {dx, dy}; a listener that calls preventDefault() keeps the focus.
//   UI.activate() -> boolean       clicks the focused control of the top screen
//   UI.back() -> boolean           closes the top screen, or calls its back function; false if it allows neither
//   UI.setKeys(on)                 shows (true) or hides the focus ring: .ui-keys on #ui. UI.nav, UI.activate
//                                  and the Tab key show it, a pointer press hides it; an input module may call
//                                  it when the player changes device. It starts shown, except on touch screens.
//   Keys, while a screen is open: the arrow keys call UI.nav, Enter activates, Escape calls UI.back and Tab
//   stays inside the top screen. A text field keeps its own arrow keys. A gamepad is wired by the input module
//   to UI.nav, UI.activate and UI.back.
// Notices, for sound and anything else that follows the menus: Plat.emit('ui', what, id), where id is the id of
// the screen concerned and what is 'open' (a screen went on the stack), 'close' (one left it), 'back' (UI.back
// acted, before the screen closes), 'move' (UI.nav moved focus or changed a control) or 'press' (a control of a
// screen was clicked, by a pointer or by UI.activate).
(function () {
  'use strict';

  const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]';
  const ARROWS = new Map([['ArrowLeft', [-1, 0]], ['ArrowRight', [1, 0]], ['ArrowUp', [0, -1]], ['ArrowDown', [0, 1]]]);
  const defs = new Map();   // id -> def
  const stack = [];         // the open screens, bottom first: {id, def, el, wrap, restore}
  const scratch = [];       // the controls of a screen, for the search that is going on
  let layer = null, wired = false, keys = null, dialogs = 0;

  // ---- building elements ----

  function add(parent, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) {
      for (let i = 0; i < child.length; i++) add(parent, child[i]);
      return;
    }
    parent.appendChild(child.nodeType ? child : document.createTextNode(String(child)));
  }

  UI.h = function (tag, attrs) {
    const el = document.createElement(tag);
    for (const name in attrs) {
      const v = attrs[name];
      if (v === null || v === undefined || v === false) continue;
      if (name === 'class') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
      else if (name === 'text') el.textContent = v;
      else if (name === 'dataset') { for (const k in v) el.dataset[k] = v[k]; }
      else if (name === 'style' && typeof v === 'object') {
        for (const k in v) {
          if (k.startsWith('--')) el.style.setProperty(k, v[k]); else el.style[k] = v[k];
        }
      } else if (typeof v === 'function' && name.startsWith('on')) el.addEventListener(name.slice(2), v);
      else el.setAttribute(name, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  };

  UI.button = function (label, onClick, attrs) {
    const el = UI.h('button', attrs || null, label);
    el.type = 'button';
    el.classList.add('ui-btn');
    if (typeof onClick === 'function') el.addEventListener('click', onClick);
    return el;
  };

  // ---- focus ----

  function root() {
    if (!layer) {
      layer = document.getElementById('ui');
      Core.assert(layer, 'the page has no #ui layer for the screens');
    }
    return layer;
  }

  function topEntry() { return stack.length ? stack[stack.length - 1] : null; }

  function usable(el) {
    return el.tabIndex >= 0 && !el.disabled && el.getClientRects().length > 0 && !el.closest('[inert], [hidden]');
  }

  // The controls of a screen that can take focus now, in page order. The list is the shared scratch list.
  function controls(wrap) {
    scratch.length = 0;
    const all = wrap.querySelectorAll(FOCUSABLE);
    for (let i = 0; i < all.length; i++) if (usable(all[i])) scratch.push(all[i]);
    return scratch;
  }

  // Focus goes to the control marked data-focus, else to the first control, else to the screen itself.
  function focusInto(wrap) {
    const marked = wrap.querySelector('[data-focus]');
    const target = marked && usable(marked) ? marked : controls(wrap)[0] || wrap;
    target.focus({ preventScroll: true });
    return target !== wrap;
  }

  // The focused element if it is a control inside the screen, else null.
  function focused(wrap) {
    const at = document.activeElement;
    return at && at !== wrap && wrap.contains(at) ? at : null;
  }

  UI.setKeys = function (on) {
    on = !!on;
    if (on === keys) return;
    keys = on;
    root().classList.toggle('ui-keys', on);
  };

  // ---- the stack ----

  // A screen that is not on top stays visible but takes no input and is skipped by screen readers.
  function setUnder(wrap, under) {
    wrap.toggleAttribute('inert', under);
    if (under) wrap.setAttribute('aria-hidden', 'true'); else wrap.removeAttribute('aria-hidden');
  }

  // What has focus now and is worth returning to, or null.
  function focusNow() {
    const at = document.activeElement;
    return at && at !== document.body ? at : null;
  }

  // Builds a screen without showing it. If its open() throws, nothing has changed yet.
  function build(id, def, args) {
    const el = def.open(args);
    Core.assert(el && el.nodeType === 1, 'UI: open() of the screen "' + id + '" must return an element');
    const wrap = UI.h('div', { class: ['ui-screen', def.scrim === false ? '' : 'ui-scrim'], dataset: { screen: id }, tabindex: '-1' }, el);
    return { id: id, def: def, el: el, wrap: wrap, restore: null };
  }

  // Puts a built screen on top. restore: where focus goes when this screen closes.
  function mount(entry, restore) {
    wire();
    const under = topEntry();
    entry.restore = restore;
    if (under) setUnder(under.wrap, true);
    stack.push(entry);
    root().appendChild(entry.wrap);
    focusInto(entry.wrap);
    Plat.emit('ui', 'open', entry.id);
    return entry;
  }

  function closeAt(at, keepFocus) {
    const entry = stack[at], wasTop = at === stack.length - 1;
    stack.splice(at, 1);
    try {
      if (typeof entry.def.close === 'function') entry.def.close();
    } catch (err) {
      console.error('UI: close() of the screen "' + entry.id + '" threw:', err);   // the screen goes all the same
    }
    entry.wrap.remove();
    const top = topEntry();
    if (top) setUnder(top.wrap, false);
    if (wasTop && !keepFocus) {
      const back = entry.restore, now = document.activeElement;
      if (back && back.isConnected && !back.closest('[inert]')) back.focus({ preventScroll: true });
      else if (top) focusInto(top.wrap);
      else if (now && now !== document.body && typeof now.blur === 'function') now.blur();
    }
    Plat.emit('ui', 'close', entry.id);
    return entry.id;
  }

  function need(id) {
    const def = defs.get(id);
    Core.assert(def, 'UI: no screen is registered as "' + id + '"');
    return def;
  }

  UI.screen = function (id, def) {
    Core.assert(typeof id === 'string' && id && def && typeof def.open === 'function', 'UI.screen needs an id and a def with open()');
    Core.assert(!defs.has(id), 'UI.screen: "' + id + '" is already registered');
    defs.set(id, def);
  };

  UI.has = function (id) { return defs.has(id); };

  UI.open = function (id, args) {
    const before = focusNow();
    return mount(build(id, need(id), args), before).el;
  };

  UI.close = function (id) {
    let at = stack.length - 1;
    if (id !== undefined) while (at >= 0 && stack[at].id !== id) at--;
    return at >= 0 ? closeAt(at, false) : null;
  };

  UI.replace = function (id, args) {
    const old = topEntry(), restore = old ? old.restore : focusNow();
    const entry = build(id, need(id), args);   // first, so that a screen that cannot be built replaces nothing
    if (old) closeAt(stack.length - 1, true);
    return mount(entry, restore).el;
  };

  UI.clear = function () { while (stack.length) closeAt(stack.length - 1, false); };
  UI.top = function () { return stack.length ? stack[stack.length - 1].id : null; };

  UI.isOpen = function (id) {
    for (let i = 0; i < stack.length; i++) if (stack[i].id === id) return true;
    return false;
  };

  UI.pausing = function () {
    for (let i = 0; i < stack.length; i++) if (stack[i].def.pause !== false) return true;
    return false;
  };

  UI.back = function () {
    const top = topEntry();
    if (!top || top.def.back === false) return false;
    Plat.emit('ui', 'back', top.id);
    if (typeof top.def.back === 'function') top.def.back(); else closeAt(stack.length - 1, false);
    return true;
  };

  // ---- the confirm dialog and toasts ----

  UI.confirm = function (text, opts) {
    const labels = opts || {};
    return new Promise(function (resolve) {
      const textId = 'ui-confirm-' + (++dialogs);
      let answer = false, entry = null;
      const choose = function (value) {
        answer = value;
        const at = stack.indexOf(entry);
        if (at >= 0) closeAt(at, false);
      };
      const before = focusNow();
      entry = mount(build('confirm', {
        open: function () {
          return UI.h('div', { class: 'ui-panel ui-dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': textId },
            UI.h('p', { class: 'ui-dialog-text', id: textId }, text),
            UI.h('div', { class: 'ui-row' },
              UI.button(labels.yes || 'Yes', function () { choose(true); }, { class: 'primary', dataset: { answer: 'yes' } }),
              UI.button(labels.no || 'No', function () { choose(false); }, { dataset: { answer: 'no', focus: '' } })));
        },
        close: function () { resolve(answer); },   // also reached by Escape and UI.back(), with the answer still false
      }, null), before);
    });
  };

  UI.toast = function (text, ms) {
    const box = document.getElementById('toast');
    if (!box) return null;
    const old = box.querySelectorAll('.ui-toast');
    for (let i = 0; i + 3 < old.length; i++) old[i].remove();   // four at a time at most
    const note = UI.h('div', { class: 'ui-toast' }, text);
    box.appendChild(note);
    window.setTimeout(function () {
      note.classList.add('out');
      window.setTimeout(function () { note.remove(); }, 260);
    }, ms > 0 ? ms : 2600);
    return note;
  };

  // ---- moving focus ----

  // How far apart two stretches of one axis are; 0 when they overlap.
  function gap(a0, a1, b0, b1) { return Math.max(0, Math.max(a0, b0) - Math.min(a1, b1)); }

  // The control nearest to `from` in the direction (dx, dy), or null. Distance counts once along the direction,
  // between the facing edges, and three times across it (nothing while the two overlap that way), so a control
  // straight ahead wins over a closer one off to the side.
  function nearest(from, list, dx, dy) {
    const a = from.getBoundingClientRect();
    let best = null, least = Infinity;
    for (let i = 0; i < list.length; i++) {
      if (list[i] === from) continue;
      const b = list[i].getBoundingClientRect();
      const ahead = dx ? (b.left + b.right - a.left - a.right) * dx : (b.top + b.bottom - a.top - a.bottom) * dy;
      if (ahead <= 1) continue;   // its centre is not further along
      const along = dx > 0 ? b.left - a.right : dx < 0 ? a.left - b.right : dy > 0 ? b.top - a.bottom : a.top - b.bottom;
      const across = dx ? gap(a.top, a.bottom, b.top, b.bottom) : gap(a.left, a.right, b.left, b.right);
      const score = Math.max(0, along) + across * 3;
      if (score < least) {
        least = score;
        best = list[i];
      }
    }
    return best;
  }

  // A slider or a select takes a step left or right as a change of its value.
  function adjust(el, dx) {
    if (el.tagName === 'INPUT' && el.type === 'range') {
      try {
        if (dx > 0) el.stepUp(); else el.stepDown();
      } catch (e) {
        return false;   // a slider without steps (step="any") cannot be stepped: the move goes on as usual
      }
    } else if (el.tagName === 'SELECT') {
      const next = el.selectedIndex + dx;
      if (next < 0 || next >= el.options.length) return true;
      el.selectedIndex = next;
    } else {
      return false;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  UI.nav = function (dx, dy) {
    const top = topEntry();
    if (!top) return false;
    UI.setKeys(true);
    const at = focused(top.wrap);
    if (!at) return focusInto(top.wrap);
    const asked = new CustomEvent('ui-nav', { bubbles: true, cancelable: true, detail: { dx: dx, dy: dy } });
    if (!at.dispatchEvent(asked) || (dx && adjust(at, dx))) {
      Plat.emit('ui', 'move', top.id);
      return true;
    }
    const next = nearest(at, controls(top.wrap), dx, dy);
    if (!next) return false;
    next.focus();
    Plat.emit('ui', 'move', top.id);
    return true;
  };

  UI.activate = function () {
    const top = topEntry();
    if (!top) return false;
    UI.setKeys(true);
    const at = focused(top.wrap);
    if (!at) {
      focusInto(top.wrap);
      return false;
    }
    at.click();
    return true;
  };

  // ---- keys ----

  // Does the browser itself act on Enter here: click the control, or hand the key to a field?
  function entersItself(el) {
    const tag = el.tagName;
    if (tag === 'INPUT') return el.type !== 'checkbox' && el.type !== 'radio';
    return tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'SUMMARY' || (tag === 'A' && el.hasAttribute('href'));
  }

  // Does the control use this arrow key itself: a text field all four, a slider or a select left and right.
  function keepsArrow(el, d) {
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || el.isContentEditable) return true;
    if (tag === 'SELECT') return d[0] !== 0;
    if (tag !== 'INPUT') return false;
    if (el.type === 'range') return d[0] !== 0;
    return !/^(?:button|submit|reset|checkbox|radio|file|color|image)$/.test(el.type);
  }

  // Tab and Shift+Tab go round the controls of the top screen and never leave it.
  function tab(wrap, dir) {
    const list = controls(wrap);
    if (!list.length) {
      wrap.focus({ preventScroll: true });
      return;
    }
    const at = list.indexOf(document.activeElement);
    list[at < 0 ? (dir > 0 ? 0 : list.length - 1) : (at + dir + list.length) % list.length].focus();
  }

  function onKey(e) {
    const top = topEntry();
    if (!top || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const at = focused(top.wrap), arrow = ARROWS.get(e.key);
    if (e.key === 'Escape') {
      if (UI.back()) e.preventDefault();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      UI.setKeys(true);
      tab(top.wrap, e.shiftKey ? -1 : 1);
    } else if (e.key === 'Enter') {
      if (at && entersItself(at)) return;
      e.preventDefault();
      UI.activate();
    } else if (arrow) {
      if (at && keepsArrow(at, arrow)) return;
      e.preventDefault();
      UI.nav(arrow[0], arrow[1]);
    }
  }

  // Listening starts with the first screen: nothing runs when the file loads.
  function wire() {
    if (wired) return;
    wired = true;
    UI.setKeys(!Plat.isTouch);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', function () { UI.setKeys(false); }, { capture: true, passive: true });
    root().addEventListener('click', function (e) {
      const screen = e.target && e.target.closest ? e.target.closest('[data-screen]') : null;
      const control = screen && e.target.closest(FOCUSABLE);
      if (control && screen.contains(control) && control !== screen) Plat.emit('ui', 'press', screen.dataset.screen);
    });
  }
})();
