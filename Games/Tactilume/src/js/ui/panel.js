// The controls panel: a bottom sheet on narrow screens, a side sheet on wide ones.
// The light keeps playing behind it.
//
// Controls are built from the schema in core/scene.js, so a new field shows up on
// its own: scene fields in their group's tab, settings in the Settings tab. LAYOUT
// only decides order and sections. Each tab is built the first time it is shown,
// and afterwards only updated in place when the store reports a change.

import { BEHAVIOURS, MAX_FINGERS, behaviourByKey } from '../core/behaviours.js';
import { PALETTES, paletteCSS } from '../core/palettes.js';
import { PRESETS } from '../core/presets.js';
import { SCHEMA, SETTINGS_SCHEMA, SCENE_FIELDS, SETTINGS_FIELDS } from '../core/scene.js';
import {
  h, uid, roving, slider, toggle, segmented, chips, stepper, select, button, confirmButton, section, fitLabels,
} from './controls.js';
import { icon } from './icons.js';
import { formatClock, RESTORE_HINT } from './hud.js';

export const TABS = [
  { id: 'scenes', label: 'Scenes', icon: 'scenes' },
  { id: 'play', label: 'Play', icon: 'play' },
  { id: 'look', label: 'Look', icon: 'look' },
  { id: 'motion', label: 'Motion', icon: 'motion' },
  { id: 'sound', label: 'Sound', icon: 'sound' },
  { id: 'capture', label: 'Capture', icon: 'capture' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

// Wide or landscape screens get a side sheet. style.css uses the same query.
export const SIDE_QUERY = '(orientation: landscape) and (min-width: 560px), (min-width: 1000px)';

// Order and sections for the schema-driven tabs. 'scene.x' is a scene field,
// 'settings.x' a device setting.
const LAYOUT = {
  play: [
    { title: 'Behaviour', fields: ['scene.lock'] },
    { title: 'Shape', fields: ['scene.symmetry', 'scene.mirror', 'scene.strength', 'scene.form'] },
    { title: 'Touch', fields: ['settings.virtualFingers', 'settings.pin'] },
    { title: 'Autoplay', fields: ['settings.autopilot', 'settings.idleSeconds'] },
    { title: 'Fingers', fields: ['scene.chords'], collapsible: true },
  ],
  look: [
    { title: 'Colour', fields: ['scene.palette', 'scene.colorBy', 'scene.hue'] },
    { title: 'Light', fields: ['scene.density', 'scene.size', 'scene.glow', 'scene.trails', 'scene.exposure'] },
    { title: 'Lens', fields: ['scene.focus', 'scene.sparkle', 'scene.grain', 'scene.aberration', 'scene.vignette'] },
  ],
  motion: [
    { title: 'Motion', fields: ['scene.speed', 'scene.drag', 'scene.flow', 'scene.gravity'] },
    { title: 'Space', fields: ['scene.depth', 'scene.orbit'] },
  ],
  sound: [
    { title: 'Music', fields: ['settings.sound', 'settings.volume'] },
    { title: 'Move with sound', fields: ['settings.react', 'settings.sensitivity'] },
    { title: 'Tilt', fields: ['settings.tilt'] },
  ],
  settings: [
    { title: 'Display', fields: ['settings.quality', 'settings.fpsCap', 'settings.uiScale'] },
    { title: 'Comfort', fields: ['settings.calm', 'settings.flashGuard', 'settings.hints', 'settings.haptics'] },
  ],
};

const PLACED = new Set(Object.values(LAYOUT).flat().flatMap((s) => s.fields));
const GROUP_TAB = { play: 'play', motion: 'motion', look: 'look' };

// Schema fields LAYOUT does not mention yet: they still get a control, at the end.
function unplaced(tab) {
  const out = [];
  for (const f of SCHEMA) {
    if (f.hidden || f.group === 'meta' || f.type === 'str' || PLACED.has(`scene.${f.key}`)) continue;
    if ((GROUP_TAB[f.group] || 'look') === tab) out.push(`scene.${f.key}`);
  }
  if (tab === 'settings') {
    for (const f of SETTINGS_SCHEMA) if (!f.hidden && !PLACED.has(`settings.${f.key}`)) out.push(`settings.${f.key}`);
  }
  return out;
}

const KEYS = [
  ['H', 'Hide or show the controls'], ['Space', 'Place a touch'], ['1 to 0', 'Play that many fingers'],
  ['Arrows', 'Move the touch'], ['S', 'More symmetry'], ['M', 'Mirror'], ['[ and ]', 'Previous or next scene'],
  ['N', 'Surprise me'], ['A', 'Autoplay'], ['P', 'Photo'], ['R', 'Record'], ['F', 'Full screen'], ['Esc', 'Open or close the controls'],
];

const listNames = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

// A small picture of a scene for its card: the palette's colours arranged like the
// scene's resting shape. Built from our own palette constants only.
function thumbBackground(scene) {
  const p = PALETTES.find((x) => x.key === scene.palette) || PALETTES[0];
  const s = p.stops;
  const c = (t) => s[Math.min(s.length - 1, Math.round(t * (s.length - 1)))];
  const ink = '#05050a';
  switch (scene.form) {
    case 'ring':
      return `radial-gradient(circle at 50% 54%, transparent 24%, ${c(0.9)} 30%, ${c(0.45)} 36%, transparent 48%),`
        + `radial-gradient(circle at 50% 54%, ${c(0.2)}55 0, transparent 62%), ${ink}`;
    case 'disc':
      return `radial-gradient(ellipse 58% 16% at 50% 55%, ${c(1)} 0, ${c(0.6)} 30%, transparent 72%),`
        + `radial-gradient(ellipse 80% 34% at 50% 55%, ${c(0.25)}88 0, transparent 70%), ${ink}`;
    case 'shell':
      return `radial-gradient(circle at 42% 42%, ${c(0.95)} 0, ${c(0.6)} 14%, ${c(0.25)} 34%, transparent 52%),`
        + `radial-gradient(circle at 50% 50%, transparent 40%, ${c(0.4)}66 46%, transparent 56%), ${ink}`;
    case 'lattice':
      return `radial-gradient(circle, ${c(0.85)} 0.9px, transparent 1.6px) 0 0 / 9px 9px,`
        + `radial-gradient(ellipse at 50% 55%, ${c(0.35)}aa 0, transparent 70%), ${ink}`;
    case 'none':
      return `radial-gradient(circle at 24% 30%, ${c(0.9)} 0, transparent 9%), radial-gradient(circle at 68% 62%, ${c(0.7)} 0, transparent 12%),`
        + `radial-gradient(circle at 82% 22%, ${c(0.4)} 0, transparent 8%), radial-gradient(ellipse at 50% 60%, ${c(0.15)}66 0, transparent 70%), ${ink}`;
    default:
      return `radial-gradient(ellipse 46% 40% at 40% 46%, ${c(0.95)} 0, ${c(0.6)} 22%, transparent 64%),`
        + `radial-gradient(ellipse 50% 44% at 64% 60%, ${c(0.35)} 0, transparent 70%),`
        + `radial-gradient(ellipse 70% 60% at 50% 50%, ${c(0.1)}88 0, transparent 80%), ${ink}`;
  }
}

function dateLabel(ms) {
  try {
    return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export function createPanel(root, { store, actions, platform, audio, run, toast, announce, onClosed }) {
  const sideQuery = typeof matchMedia === 'function' ? matchMedia(SIDE_QUERY) : null;
  const isSheet = () => !(sideQuery && sideQuery.matches);

  // Names are fitted to the device's own font once the tab is laid out (see fitLabels):
  // after a tab is shown, the window changes size, or the Control size changes.
  let fitQueued = 0;
  function queueFit() {
    if (fitQueued) return;
    fitQueued = requestAnimationFrame(() => {
      fitQueued = 0;
      const t = tabs.get(current);
      if (t && t.built && !t.panel.hidden) fitLabels(t.panel);
    });
  }
  addEventListener('resize', queueFit, { passive: true });
  store.on('settings', (s, keys) => { if (keys.includes('uiScale')) queueFit(); });

  // ---- writing to the store ---------------------------------------------------
  // Sliders write at most once a frame; discrete controls write at once (after any
  // slider value still waiting, so changes land in the order they were made).
  const pending = { scene: null, settings: null };
  let raf = 0;
  function flush() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    const scene = pending.scene;
    const settings = pending.settings;
    pending.scene = null;
    pending.settings = null;
    if (scene) store.setScene(scene, { source: 'ui' });
    if (settings) store.setSettings(settings, { source: 'ui' });
  }
  function write(kind, key, value, now) {
    (pending[kind] || (pending[kind] = {}))[key] = value;
    if (now) flush();
    else if (!raf) raf = requestAnimationFrame(flush);
  }

  // ---- reflecting outside changes -----------------------------------------------
  const binds = { scene: new Map(), settings: new Map() };
  function bind(kind, key, fn) {
    let set = binds[kind].get(key);
    if (!set) binds[kind].set(key, (set = new Set()));
    set.add(fn);
  }
  const notify = (kind, obj, keys) => {
    for (const k of keys) {
      const fns = binds[kind].get(k);
      if (fns) for (const fn of fns) fn(obj[k]);
    }
  };
  store.on('scene', (scene, keys) => notify('scene', scene, keys));
  store.on('settings', (settings, keys) => notify('settings', settings, keys));
  store.on('user', (list) => renderUser(list));

  // ---- the shell ---------------------------------------------------------------
  const sceneName = h('span', { class: 'tl-scene-name' });
  const showName = (n) => { sceneName.textContent = n || 'Untitled scene'; };
  showName(store.scene.name);
  bind('scene', 'name', showName);

  const closeBtn = h('button', { type: 'button', class: 'tl-icon-btn tl-close', 'aria-label': 'Close controls' }, icon('close'));
  closeBtn.addEventListener('click', () => close());

  const grab = h('div', { class: 'tl-grab' },
    h('div', { class: 'tl-handle', 'aria-hidden': 'true' }),
    h('div', { class: 'tl-panel-head' },
      h('div', { class: 'tl-panel-titles' },
        h('span', { class: 'tl-eyebrow' }, 'Now playing'),
        sceneName),
      closeBtn));

  const tablist = h('div', { class: 'tl-tabs', role: 'tablist', 'aria-label': 'Control sections' });
  const body = h('div', { class: 'tl-panel-body' });
  const tabs = new Map(); // id -> { btn, panel, built }
  for (const t of TABS) {
    const btn = h('button', {
      type: 'button', class: 'tl-tab', role: 'tab', id: `tl-tab-${t.id}`,
      'aria-controls': `tl-tabpanel-${t.id}`, 'aria-selected': 'false', 'data-tab': t.id,
    }, icon(t.icon), h('span', { class: 'tl-tab-label' }, t.label));
    const panel = h('div', {
      class: 'tl-tabpanel', role: 'tabpanel', id: `tl-tabpanel-${t.id}`,
      'aria-labelledby': `tl-tab-${t.id}`, hidden: true,
    });
    btn.addEventListener('click', () => selectTab(t.id));
    tablist.append(btn);
    body.append(panel);
    tabs.set(t.id, { btn, panel, built: false });
  }
  const tabButtons = [...tabs.values()].map((t) => t.btn);
  const tabRove = roving(tabButtons, { onPick: (b) => selectTab(b.dataset.tab) });

  const el = h('div', {
    class: 'tl-panel', id: 'tl-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Controls', inert: true,
  }, h('div', { class: 'tl-panel-glass', 'aria-hidden': 'true' }), grab, tablist, body);
  root.append(el);

  let current = 'scenes';
  function selectTab(id, { focus = false } = {}) {
    if (!tabs.has(id)) id = 'scenes';
    current = id;
    for (const [tid, t] of tabs) {
      const on = tid === id;
      t.btn.setAttribute('aria-selected', on ? 'true' : 'false');
      t.panel.hidden = !on;
    }
    tabRove.focusOn(TABS.findIndex((t) => t.id === id));
    const t = tabs.get(id);
    if (!t.built) {
      t.built = true;
      BUILDERS[id](t.panel);
    }
    body.scrollTop = 0;
    // with large controls the tabs scroll sideways: keep the chosen one in view
    if (tablist.scrollWidth > tablist.clientWidth) t.btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (focus) t.btn.focus({ preventScroll: true });
    queueFit();
  }

  // ---- opening and closing --------------------------------------------------------
  let isOpen = false;
  function open(tab) {
    selectTab(tab || current);
    if (isOpen) return;
    isOpen = true;
    el.removeAttribute('inert');
    el.style.transform = '';
    el.classList.add('is-open');
    root.classList.add('is-panel-open');
    // into the panel, without a ring for touch (focus-visible decides) or a scroll jump
    tabs.get(current).btn.focus({ preventScroll: true });
  }
  // returnFocus: true or false, or 'auto' to give focus back only if it was inside
  function close({ returnFocus = 'auto' } = {}) {
    if (!isOpen) return false;
    flush();
    isOpen = false;
    const hadFocus = el.contains(document.activeElement);
    el.classList.remove('is-open');
    el.setAttribute('inert', '');
    root.classList.remove('is-panel-open');
    onClosed({ returnFocus: returnFocus === 'auto' ? hadFocus : !!returnFocus });
    return true;
  }

  // Tab stays inside while open; focus that wandered out (a tap on the light) comes back.
  function focusables() {
    return [...el.querySelectorAll('button, input, select, textarea, [tabindex]')]
      .filter((n) => n.tabIndex >= 0 && !n.disabled && n.getClientRects().length > 0);
  }
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const inside = el.contains(document.activeElement);
    if (e.shiftKey && (!inside || document.activeElement === first)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (!inside || document.activeElement === last)) { e.preventDefault(); first.focus(); }
  });
  const onDocKey = (e) => {
    if (!isOpen || e.key !== 'Tab' || el.contains(document.activeElement)) return;
    e.preventDefault();
    tabs.get(current).btn.focus();
  };
  document.addEventListener('keydown', onDocKey);

  // ---- swipe down to close (bottom sheet) ---------------------------------------------
  let drag = null;
  grab.addEventListener('pointerdown', (e) => {
    if (!isSheet() || !isOpen || e.button > 0 || e.target.closest('button')) return;
    drag = { id: e.pointerId, y0: e.clientY, t0: performance.now(), dy: 0, moved: false, h: el.offsetHeight || 1 };
    try { grab.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
  });
  grab.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) < 6) return;
    drag.moved = true;
    // pulling up resists; pulling down follows the finger
    drag.dy = dy > 0 ? dy : dy * 0.2;
    el.classList.add('is-dragging');
    el.style.transform = `translate3d(0, ${Math.max(drag.dy, -16)}px, 0)`;
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    el.classList.remove('is-dragging');
    if (!d.moved) return;
    const speed = d.dy / Math.max(1, performance.now() - d.t0); // px per ms
    // clear the inline offset in the same frame as the class change, so the sheet
    // glides from where the finger left it
    el.style.transform = '';
    if (d.dy > d.h * 0.25 || (speed > 0.55 && d.dy > 24)) close();
  };
  grab.addEventListener('pointerup', endDrag);
  grab.addEventListener('pointercancel', endDrag);

  // ---- making controls from the schema ------------------------------------------------
  const fieldOf = (ref) => {
    const [kind, key] = ref.split('.');
    return { kind, key, field: (kind === 'scene' ? SCENE_FIELDS : SETTINGS_FIELDS).get(key) };
  };
  const valueOf = (kind, key) => (kind === 'scene' ? store.scene : store.settings)[key];

  function generic(kind, field) {
    const value = valueOf(kind, field.key);
    const now = (v) => write(kind, field.key, v, true);
    const later = (v) => write(kind, field.key, v, false);
    switch (field.type) {
      case 'num': return slider(field, { value, onInput: later });
      case 'int': return field.max - field.min <= 10
        ? stepper(field, { value, onChange: now })
        : slider(field, { value, onInput: later });
      case 'bool': return toggle(field, { value, onChange: now });
      case 'enum': return field.options.length <= 4
        ? segmented(field, { value, onSelect: now })
        : chips(field, { value, onSelect: now });
      default: return null;
    }
  }

  // controls that need more than the generic ones
  const SPECIAL = {
    'scene.lock': behaviourPicker,
    'scene.palette': palettePicker,
    'scene.chords': chordsTable,
    'settings.react': reactPicker,
    'settings.tilt': tiltSwitch,
    'settings.uiScale': (field) => slider(field, {
      value: store.settings.uiScale,
      // the panel resizes with this value, so it lands when the slider is let go
      onCommit: (v) => write('settings', 'uiScale', v, true),
    }),
    'settings.pin': pinSwitch,
    'settings.idleSeconds': (field) => {
      const c = slider(field, { value: store.settings.idleSeconds, onInput: (v) => write('settings', 'idleSeconds', v, false) });
      const show = (mode) => { c.el.hidden = mode !== 'idle'; };
      show(store.settings.autopilot);
      bind('settings', 'autopilot', show);
      return c;
    },
  };

  function control(ref) {
    const { kind, key, field } = fieldOf(ref);
    if (!field) return null;
    const make = SPECIAL[ref];
    const c = make ? make(field) : generic(kind, field);
    if (!c) return null;
    bind(kind, key, c.set);
    return c.el;
  }

  function schemaTab(tabId, panel) {
    const sections = LAYOUT[tabId] || [];
    for (const s of sections) {
      const fields = s.fields.map((ref) => ({ ref, ...fieldOf(ref) })).filter((f) => f.field);
      if (!fields.length) continue;
      const only = fields.length === 1 ? fields[0].field : null;
      // a section whose first control is already named like it needs no second heading
      const title = !s.collapsible && fields[0].field.label === s.title ? null : s.title;
      const sec = section(title, { collapsible: !!s.collapsible, open: false, note: s.collapsible && only ? only.help : null });
      for (const f of fields) {
        const node = control(f.ref);
        if (node) sec.body.append(node);
      }
      panel.append(sec.el);
    }
    const extra = unplaced(tabId);
    if (extra.length) {
      const sec = section('More');
      for (const ref of extra) {
        const node = control(ref);
        if (node) sec.body.append(node);
      }
      panel.append(sec.el);
    }
  }

  // ---- special controls -----------------------------------------------------------------

  function behaviourPicker(field) {
    const describe = (key) => (key === 'auto'
      ? { name: 'Auto', text: 'The number of fingers picks the behaviour (see Fingers, below). Choose one here to play it with any number of fingers.' }
      : { name: behaviourByKey(key).name, text: behaviourByKey(key).blurb });
    const capName = h('span', { class: 'tl-caption-name' });
    const capText = h('span', { class: 'tl-caption-text' });
    const caption = h('p', { class: 'tl-caption', 'aria-hidden': 'true' }, capName, capText);
    let selected = store.scene.lock;
    const showCaption = (key) => {
      const d = describe(key);
      capName.textContent = d.name;
      capText.textContent = d.text;
    };
    const blurbs = h('div', { hidden: true });
    let pressed = null;
    // the caption below the chips explains Auto and every behaviour, so the field's help would repeat it
    const c = chips({ ...field, help: null }, {
      value: selected,
      className: 'tl-chips tl-chips--behaviours',
      onSelect: (v) => {
        if (pressed && pressed.long && pressed.key === v) { pressed = null; return; }
        write('scene', 'lock', v, true);
      },
      render: (o) => [h('span', { class: 'tl-opt-text' }, describe(o).name), icon('check', 'tl-icon tl-opt-check')],
    });
    c.buttons.forEach((b) => {
      const key = b.dataset.value;
      const id = uid('blurb');
      blurbs.append(h('span', { id }, describe(key).text));
      b.setAttribute('aria-describedby', id);
      const peek = () => showCaption(key);
      const back = () => showCaption(selected);
      // with a mouse, hovering peeks; a touch keeps its peek until the next choice
      b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') peek(); });
      b.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') back(); });
      b.addEventListener('focus', peek);
      b.addEventListener('blur', back);
      // a long press shows what a behaviour does without choosing it
      b.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        const p = { key, long: false, timer: 0 };
        p.timer = setTimeout(() => { p.long = true; peek(); }, 450);
        pressed = p;
      });
      const release = () => { if (pressed && !pressed.long) { clearTimeout(pressed.timer); pressed = null; } };
      b.addEventListener('pointerup', release);
      b.addEventListener('pointercancel', () => { if (pressed) { clearTimeout(pressed.timer); pressed = null; } back(); });
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
    showCaption(selected);
    c.el.append(caption, blurbs);
    return {
      el: c.el,
      set: (v) => { selected = v; c.set(v); showCaption(v); },
    };
  }

  function palettePicker(field) {
    const safe = PALETTES.filter((p) => p.safe).map((p) => p.name);
    const help = safe.length ? `${listNames(safe)} stay clear for every kind of colour vision.` : null;
    const c = chips({ ...field, help }, {
      value: store.scene.palette,
      className: 'tl-chips tl-swatches',
      onSelect: (v) => write('scene', 'palette', v, true),
      render: (key) => {
        const p = PALETTES.find((x) => x.key === key);
        const bar = h('span', { class: 'tl-swatch-bar', 'aria-hidden': 'true' });
        bar.style.backgroundImage = paletteCSS(p);
        return [bar, h('span', { class: 'tl-swatch-name' }, p.name), icon('check', 'tl-icon tl-opt-check')];
      },
    });
    return c;
  }

  function chordsTable(field) {
    const options = BEHAVIOURS.map((b) => ({ value: b.key, label: b.name }));
    const note = h('p', { class: 'tl-notice', hidden: true });
    const rows = [];
    const table = h('div', { class: 'tl-chords' });
    for (let i = 0; i < MAX_FINGERS; i++) {
      const row = select({
        label: `${i + 1} ${i === 0 ? 'finger' : 'fingers'}`,
        value: store.scene.chords[i],
        options,
        onChange: (v) => {
          const next = [...store.scene.chords];
          next[i] = v;
          write('scene', 'chords', next, true);
        },
      });
      rows.push(row);
      table.append(row.el);
    }
    const reset = button('Back to the usual', {
      iconName: 'reset', variant: 'quiet',
      onClick: () => { write('scene', 'chords', [...field.def], true); announce('Fingers set back to the usual'); },
    });
    const showLock = (lock) => {
      const locked = lock && lock !== 'auto';
      note.hidden = !locked;
      table.classList.toggle('is-muted', !!locked);
      if (locked) note.textContent = `Behaviour is set to ${behaviourByKey(lock).name}, so every number of fingers plays it. Choose Auto under Behaviour to use this table.`;
    };
    showLock(store.scene.lock);
    bind('scene', 'lock', showLock);
    return {
      el: h('div', { class: 'tl-field' }, note, table, h('div', { class: 'tl-row-end' }, reset)),
      set: (chords) => rows.forEach((r, i) => r.set(chords[i])),
    };
  }

  function pinSwitch(field) {
    const c = toggle(field, { value: store.settings.pin, onChange: (v) => write('settings', 'pin', v, true) });
    const clear = button('Clear pins', {
      iconName: 'unpin', variant: 'quiet',
      onClick: () => { actions.clearPins(); toast('Pins cleared'); },
    });
    c.el.append(h('div', { class: 'tl-row-end' }, clear));
    return c;
  }

  function reactPicker(field) {
    const status = h('p', { class: 'tl-notice', role: 'status', hidden: true });
    const say = (text, isError) => {
      status.textContent = text || '';
      status.hidden = !text;
      status.classList.toggle('is-error', !!isError);
    };
    const songName = h('span', { class: 'tl-song-name' });
    const stopSong = button('Stop', { iconName: 'stop', variant: 'quiet', label: 'Stop the song' });
    const songRow = h('div', { class: 'tl-song', hidden: true },
      icon('song', 'tl-icon tl-song-icon'), h('span', { class: 'tl-song-text' }, h('span', { class: 'tl-song-eyebrow' }, 'Playing'), songName), stopSong);
    const file = h('input', { type: 'file', accept: 'audio/*', class: 'tl-file', tabindex: '-1', 'aria-label': 'Choose a song', hidden: true });
    let busy = false;

    async function choose(mode, picked) {
      busy = true;
      if (mode === 'mic') say('Asking to use the microphone…');
      else if (mode === 'file') say('Opening the song…');
      let r;
      try {
        r = await actions.setReact(mode, picked);
      } catch (err) {
        r = { ok: false, error: err && err.message };
      }
      busy = false;
      seg.set(store.settings.react);
      showSong(store.settings.react);
      if (r && r.ok) say('');
      else say((r && r.error) || 'That did not work. You can try again.', true);
    }
    const seg = segmented(field, {
      value: store.settings.react,
      // moving along with the arrow keys must not ask for the microphone
      selectOnMove: false,
      onSelect: (mode) => {
        if (busy) return;
        if (mode === 'file') {
          file.value = '';
          file.click();
          return;
        }
        // choosing the current source again does nothing, unless it stopped by itself
        // (a microphone unplugged): then the setting still names it, but it needs starting
        const live = mode === 'off' || !(audio && typeof audio.state === 'function')
          || (mode === 'mic' ? audio.state().mic : audio.state().file);
        if (mode === store.settings.react && live) return;
        choose(mode);
      },
    });
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (f) choose('file', f);
    });
    stopSong.addEventListener('click', () => choose('off'));
    function showSong(mode) {
      const name = mode === 'file' && audio && audio.fileName;
      songRow.hidden = !name;
      if (name) songName.textContent = name;
    }
    showSong(store.settings.react);
    seg.el.append(file, songRow, status);
    return {
      el: seg.el,
      set: (v) => { seg.set(v); showSong(v); },
    };
  }

  function tiltSwitch(field) {
    const msg = h('p', { class: 'tl-notice is-error', role: 'status', hidden: true });
    let turn = 0; // the latest flip of the switch; an earlier one that answers late says nothing
    const c = toggle(field, {
      value: store.settings.tilt,
      onChange: async (on) => {
        const mine = ++turn;
        msg.hidden = true;
        // switching off stops a start that is still waiting for the sensors, too
        if (!on) { actions.disableTilt(); return; }
        // called straight from the tap: some browsers only ask for motion access then
        let ok = false;
        try { ok = await actions.enableTilt(); } catch { ok = false; }
        if (!ok && mine === turn && c.input.checked) {
          c.set(false);
          msg.textContent = 'Tilt is not available here. It needs motion sensors, and permission to use them.';
          msg.hidden = false;
        }
      },
    });
    c.el.append(msg);
    return c;
  }

  // ---- Scenes tab -------------------------------------------------------------------------

  let userList = null;
  let saveInput = null;

  function buildScenes(panel) {
    const presetSec = section('Scenes');
    const grid = h('div', { class: 'tl-presets' });
    const cards = PRESETS.map((p) => {
      const thumb = h('span', { class: 'tl-preset-thumb', 'aria-hidden': 'true' });
      thumb.style.background = thumbBackground({ ...p.scene, form: p.scene.form || 'nebula', palette: p.scene.palette || 'ember' });
      const strip = h('span', { class: 'tl-preset-strip', 'aria-hidden': 'true' });
      strip.style.backgroundImage = paletteCSS(PALETTES.find((x) => x.key === (p.scene.palette || 'ember')) || PALETTES[0]);
      const card = h('button', { type: 'button', class: 'tl-preset', 'data-name': p.name },
        thumb, strip,
        h('span', { class: 'tl-preset-text' },
          h('span', { class: 'tl-preset-name' }, p.name),
          h('span', { class: 'tl-preset-blurb' }, p.blurb)),
        h('span', { class: 'tl-preset-badge', 'aria-hidden': 'true' }, 'Playing'));
      card.addEventListener('click', () => { actions.loadPreset(p.key); announce(`${p.name} is playing`); });
      grid.append(card);
      return card;
    });
    const markCurrent = (name) => cards.forEach((c) => {
      if (c.dataset.name === name) c.setAttribute('aria-current', 'true');
      else c.removeAttribute('aria-current');
    });
    markCurrent(store.scene.name);
    bind('scene', 'name', markCurrent);
    presetSec.body.classList.add('tl-card--bare');
    presetSec.body.append(grid);

    const row = h('div', { class: 'tl-actions-row' },
      button('Surprise me', { iconName: 'surprise', variant: 'primary', onClick: () => { actions.surprise(); announce(`${store.scene.name || 'A new scene'} is playing`); } }),
      button(platform.native ? 'Share scene code' : 'Share link', { iconName: 'share', onClick: () => run.shareLink() }));

    // someone sent a link or a code: paste it here to play their scene
    const openId = uid('open');
    const openInput = h('input', {
      class: 'tl-text', id: openId, type: 'text', autocomplete: 'off', enterkeyhint: 'go',
      spellcheck: 'false', placeholder: 'Paste a link or code',
    });
    const openForm = h('form', { class: 'tl-save' },
      h('label', { class: 'tl-label', for: openId }, 'Open a shared scene'),
      h('div', { class: 'tl-save-row' }, openInput,
        h('button', { type: 'submit', class: 'tl-btn' }, icon('share'), h('span', { class: 'tl-btn-text' }, 'Open'))));
    openForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const r = actions.openShared(openInput.value);
      if (r && r.ok) {
        openInput.value = '';
        openInput.blur();
        toast(`Playing ${store.scene.name ? `“${store.scene.name}”` : 'the shared scene'}`);
      } else {
        toast('That is not a Tactilume link or scene code.');
      }
    });

    const yours = section('Your scenes');
    const inputId = uid('name');
    saveInput = h('input', {
      class: 'tl-text', id: inputId, type: 'text', maxlength: String(SCENE_FIELDS.get('name').maxLen || 40),
      autocomplete: 'off', enterkeyhint: 'done', spellcheck: 'false', placeholder: store.scene.name || 'My scene',
    });
    bind('scene', 'name', (n) => { saveInput.placeholder = n || 'My scene'; });
    const form = h('form', { class: 'tl-save' },
      h('label', { class: 'tl-label', for: inputId }, 'Save this scene'),
      h('div', { class: 'tl-save-row' }, saveInput,
        h('button', { type: 'submit', class: 'tl-btn tl-btn--primary' }, icon('save'), h('span', { class: 'tl-btn-text' }, 'Save'))));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const entry = store.saveUserScene(saveInput.value.trim());
      // the list is full: say so, and keep the typed name for after a delete
      if (!entry) {
        toast(`You have ${store.userScenes().length} saved scenes. Delete one to save another.`);
        return;
      }
      saveInput.value = '';
      saveInput.blur();
      toast(`Saved “${entry.name}”`);
    });
    userList = h('ul', { class: 'tl-user-list', 'aria-label': 'Saved scenes' });
    yours.body.append(form, userList);
    renderUser(store.userScenes());

    panel.append(presetSec.el, row, openForm, yours.el);
  }

  function renderUser(list) {
    if (!userList) return;
    userList.replaceChildren();
    if (!list.length) {
      userList.append(h('li', { class: 'tl-empty' }, 'Scenes you save appear here. They stay on this device.'));
      return;
    }
    list.forEach((entry, index) => {
      const p = PALETTES.find((x) => x.key === entry.scene.palette) || PALETTES[0];
      const dot = h('span', { class: 'tl-user-swatch', 'aria-hidden': 'true' });
      dot.style.backgroundImage = paletteCSS(p);
      const load = h('button', { type: 'button', class: 'tl-user-load' },
        dot,
        h('span', { class: 'tl-user-name' }, entry.name),
        h('span', { class: 'tl-user-date' }, dateLabel(entry.created)));
      load.addEventListener('click', () => {
        store.setScene(entry.scene, { replace: true, source: 'user' });
        announce(`${entry.name} is playing`);
      });
      const del = h('button', { type: 'button', class: 'tl-icon-btn tl-icon-btn--small', 'aria-label': `Delete ${entry.name}` }, icon('trash'));
      const keep = button('Keep', { variant: 'quiet' });
      const yes = button('Delete', { variant: 'danger' });
      const ask = h('div', { class: 'tl-user-ask', hidden: true },
        h('span', { class: 'tl-confirm-q' }, `Delete “${entry.name}”?`), h('div', { class: 'tl-confirm-actions' }, keep, yes));
      const item = h('li', { class: 'tl-user' }, h('div', { class: 'tl-user-main' }, load, del), ask);
      del.addEventListener('click', () => { item.classList.add('is-asking'); ask.hidden = false; keep.focus(); });
      keep.addEventListener('click', () => { item.classList.remove('is-asking'); ask.hidden = true; del.focus(); });
      yes.addEventListener('click', () => {
        store.deleteUserScene(entry.id);
        toast(`Deleted “${entry.name}”`);
        // focus moves to a neighbour, or back to the name field when the list is empty
        const next = userList.querySelectorAll('.tl-user-load')[Math.min(index, userList.children.length - 1)];
        (next || saveInput).focus();
      });
      userList.append(item);
    });
  }

  // ---- Capture tab ------------------------------------------------------------------------

  let recTile = null;
  let recLabel = null;
  let recSub = null;

  function tile(iconName, title, sub, onClick) {
    const subEl = h('span', { class: 'tl-tile-sub' }, sub);
    const titleEl = h('span', { class: 'tl-tile-title' }, title);
    const b = h('button', { type: 'button', class: 'tl-tile' },
      h('span', { class: 'tl-tile-icon' }, icon(iconName)), titleEl, subEl);
    b.addEventListener('click', onClick);
    return { b, titleEl, subEl };
  }

  function buildCapture(panel) {
    const sec = section('Keep this moment');
    const photo = tile('photo', 'Photo', 'A still of the light as it is now', async () => {
      photo.b.disabled = true;
      try { await run.photo(); } finally { photo.b.disabled = false; }
    });
    const rec = tile('record', 'Record', 'Up to one minute', () => run.record());
    // the stop glyph takes the record glyph's place while recording (style.css swaps them)
    rec.b.querySelector('.tl-tile-icon').append(icon('stop', 'tl-icon tl-icon--stop'));
    recTile = rec.b;
    recLabel = rec.titleEl;
    recSub = rec.subEl;
    sec.body.classList.add('tl-card--bare');
    sec.body.append(h('div', { class: 'tl-tiles' }, photo.b, rec.b));

    const clean = section('Clean screen');
    clean.body.append(
      h('div', { class: 'tl-field' },
        button('Hide controls', { iconName: 'hide', onClick: () => actions.toggleUI() }),
        h('p', { class: 'tl-help' }, RESTORE_HINT)));
    panel.append(sec.el, clean.el);
    setRecording(recording.on, recording.elapsed);
  }

  const recording = { on: false, elapsed: 0, text: '' };
  function setRecording(on, elapsed) {
    recording.on = on;
    recording.elapsed = elapsed;
    if (!recTile) return;
    const text = on ? formatClock(elapsed) : '';
    if (recTile.classList.contains('is-recording') === on && text === recording.text) return;
    recording.text = text;
    recTile.classList.toggle('is-recording', on);
    recLabel.textContent = on ? 'Stop' : 'Record';
    recSub.textContent = on ? `Recording, ${text}` : 'Up to one minute';
  }

  // ---- Settings tab -------------------------------------------------------------------------

  let statsEl = null;
  function buildSettings(panel) {
    schemaTab('settings', panel);

    if (platform && typeof platform.canFullscreen === 'function' && platform.canFullscreen()) {
      const screen = section('Screen');
      const fs = button('Full screen', { iconName: 'fullscreen', onClick: () => actions.toggleFullscreen() });
      const label = fs.querySelector('.tl-btn-text');
      const sync = () => { label.textContent = platform.isFullscreen() ? 'Leave full screen' : 'Full screen'; };
      sync();
      document.addEventListener('fullscreenchange', sync);
      document.addEventListener('webkitfullscreenchange', sync);
      screen.body.append(h('div', { class: 'tl-field' }, fs));
      panel.append(screen.el);
    }

    const keys = section('Keys');
    keys.el.classList.add('tl-only-keys');
    keys.body.append(h('dl', { class: 'tl-keys' }, KEYS.map(([k, what]) => [h('dt', null, h('kbd', null, k)), h('dd', null, what)])));
    panel.append(keys.el);

    const reset = section('Start again');
    const r = confirmButton('Reset settings', {
      iconName: 'reset', question: 'Put every setting back as it was at the start?', yes: 'Reset',
      onConfirm: () => {
        // a running microphone or song has to be stopped by its action, not just by the setting
        if (store.settings.react !== 'off') actions.setReact('off');
        store.resetSettings();
        toast('Settings reset');
      },
    });
    reset.body.append(h('div', { class: 'tl-field' }, r.el));
    panel.append(reset.el);

    // For when the light does not show or move: what this device's graphics are doing,
    // as text to copy into a message.
    const check = section('Device check');
    const report = h('pre', { class: 'tl-diag', hidden: true, tabindex: '0', 'aria-label': 'Device check results' });
    const copy = button('Copy', {
      iconName: 'share',
      onClick: async () => {
        let ok = false;
        try { await navigator.clipboard.writeText(report.textContent); ok = true; } catch { /* below */ }
        if (!ok) {
          // no clipboard access here: select the text so it can be copied by hand
          const range = document.createRange();
          range.selectNodeContents(report);
          const sel = getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
        toast(ok ? 'Copied' : 'Selected: copy it from here');
      },
    });
    copy.hidden = true;
    const run = button('Check this device', {
      iconName: 'surprise',
      onClick: async () => {
        report.hidden = false;
        report.textContent = 'Checking…';
        try {
          report.textContent = await actions.diagnose();
        } catch (e) {
          report.textContent = `The check itself failed: ${e && e.message}`;
        }
        copy.hidden = false;
        announce('Device check finished');
      },
    });
    check.body.append(h('div', { class: 'tl-field' },
      h('p', { class: 'tl-help' }, 'If the light does not show or move, this shows what your device\'s graphics are doing. Copy it into a message to get help. If it finds screen light while your screen stays black, the light is drawn but the system is not showing it.'),
      h('div', { class: 'tl-actions-row' }, run, copy), report));
    panel.append(check.el);

    const about = section('About');
    statsEl = h('p', { class: 'tl-stats', 'aria-live': 'off' }, ' ');
    about.body.append(h('div', { class: 'tl-field tl-about' },
      h('p', { class: 'tl-about-title' }, 'Tactilume 1.0. Made of light, maths and your fingertips.'),
      h('p', { class: 'tl-help' }, 'A small number of people can have seizures triggered by flashing light. Flash guard is on by default; Calm mode makes everything gentler.'),
      statsEl));
    panel.append(about.el);
  }

  let statsText = '';
  function setStats(fps, particles) {
    if (!statsEl || !isOpen || current !== 'settings') return;
    const k = particles >= 1e6 ? `${(particles / 1e6).toFixed(2)} million` : `${Math.round(particles / 1000)}k`;
    const text = `${Math.round(fps)} frames a second · ${k} specks of light`;
    if (text !== statsText) { statsText = text; statsEl.textContent = text; }
  }

  const BUILDERS = {
    scenes: buildScenes,
    play: (p) => schemaTab('play', p),
    look: (p) => schemaTab('look', p),
    motion: (p) => schemaTab('motion', p),
    sound: (p) => schemaTab('sound', p),
    capture: buildCapture,
    settings: buildSettings,
  };

  return {
    el,
    open,
    close,
    isOpen: () => isOpen,
    get tab() { return current; },
    selectTab: (id) => selectTab(id, { focus: true }),
    setRecording,
    setStats,
  };
}
