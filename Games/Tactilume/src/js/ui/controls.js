// The panel's building blocks. Every control is built from a schema field and returns
// `{ el, set(value) }`: the panel calls `set` when the value changes somewhere else
// (a preset, a shortcut), so controls update in place and are never rebuilt.
//
// Values are only ever inserted as text. The one exception is icons.js, whose markup
// is a constant of this file's own family.

import { icon } from './icons.js';

let serial = 0;
export const uid = (prefix) => `tl-${prefix}-${++serial}`;

// h('button', { class: 'x', onclick: fn, 'aria-label': 'Close' }, child, 'text', [more])
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
}

// ---- how values read --------------------------------------------------------

// Friendly names for choices; anything missing falls back to the option, capitalised.
const OPTION_LABELS = {
  form: { none: 'None' },
  colorBy: { seed: 'Mixed' },
  quality: { max: 'Best' },
  fpsCap: { display: 'Screen', 60: '60', 30: '30' },
  react: { off: 'Off', mic: 'Microphone', file: 'A song' },
  autopilot: { idle: 'When idle', always: 'Always', off: 'Off' },
  lock: { auto: 'Auto' },
};

export function optionLabel(field, option) {
  const named = OPTION_LABELS[field.key] && OPTION_LABELS[field.key][option];
  if (named) return named;
  const s = String(option);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const MINUS = '−';
const signed = (v, digits) => (Math.abs(v) < 1e-9 ? '0' : (v > 0 ? '+' : MINUS) + Math.abs(v).toFixed(digits));
const decimalsOf = (step) => (!step || step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step) - 1e-9)));

// Values as people read them: shares as percentages, multipliers with a ×, and so on.
const FORMATS = {
  symmetry: (v) => (v <= 1 ? 'Off' : `${v}×`),
  strength: (v) => `${v.toFixed(2)}×`,
  speed: (v) => `${v.toFixed(2)}×`,
  size: (v) => `${v.toFixed(2)}×`,
  exposure: (v) => signed(v, 2),
  hue: (v) => `${Math.round(v * 360)}°`,
  idleSeconds: (v) => `${v} s`,
  virtualFingers: (v) => (v === 0 ? 'Off' : String(v)),
  uiScale: (v) => `${Math.round(v * 100)}%`,
};

export function formatValue(field, v) {
  const f = FORMATS[field.key];
  if (f) return f(v);
  if (field.type === 'num' && field.min >= 0 && field.max <= 1) return `${Math.round(v * 100)}%`;
  return field.type === 'int' ? String(v) : Number(v).toFixed(decimalsOf(field.step));
}

// ---- shared pieces ----------------------------------------------------------

function helpText(field) {
  if (!field.help) return { node: null, id: null };
  const id = uid('help');
  return { node: h('p', { class: 'tl-help', id }, field.help), id };
}

// Arrow-key movement inside a group of radios or tabs, with one tab stop for the
// whole group (the checked item). `cols` makes Up/Down jump a row in a grid.
export function roving(items, { cols = 1, selectOnMove = true, onPick }) {
  const move = (from, to) => {
    const next = items[(to + items.length) % items.length];
    if (!next) return;
    items[from].tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
    if (selectOnMove) onPick(next, items.indexOf(next));
  };
  items.forEach((item, i) => {
    item.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
      if (step) {
        e.preventDefault();
        const target = i + step;
        // in a grid, Up/Down stop at the edges instead of wrapping into another column
        if (cols > 1 && Math.abs(step) === cols && (target < 0 || target >= items.length)) return;
        move(i, target);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        move(i, e.key === 'Home' ? 0 : items.length - 1);
      }
    });
  });
  return {
    // keeps the tab stop on the chosen item
    focusOn(index) { items.forEach((item, i) => { item.tabIndex = i === index ? 0 : -1; }); },
  };
}

// The label row above most controls: name on the left, value or extra on the right.
function head(labelNode, extra) {
  return h('div', { class: 'tl-head' }, labelNode, extra);
}

// ---- sliders ----------------------------------------------------------------

// A range input styled to match; the filled part shows the scene's palette.
export function slider(field, { value, onInput, onCommit, format = (v) => formatValue(field, v) }) {
  const id = uid('range');
  const help = helpText(field);
  const out = h('span', { class: 'tl-value', 'aria-hidden': 'true' });
  const step = field.type === 'int' ? 1 : field.step || 0.01;
  const input = h('input', {
    class: 'tl-range', type: 'range', id,
    min: field.min, max: field.max, step,
    'aria-describedby': help.id,
  });
  const span = field.max - field.min || 1;
  const track = h('div', { class: 'tl-range-wrap' }, input);
  // style.css places the fill and the default notch from these 0..1 fractions
  track.style.setProperty('--def', String((field.def - field.min) / span));

  function show(v) {
    const text = format(v);
    out.textContent = text;
    input.setAttribute('aria-valuetext', text);
    input.style.setProperty('--fill', String((v - field.min) / span));
  }
  input.addEventListener('input', () => {
    const v = Number(input.value);
    show(v);
    if (onInput) onInput(v);
  });
  input.addEventListener('change', () => { if (onCommit) onCommit(Number(input.value)); });

  const set = (v) => {
    // skip when it already shows this value, so a drag in progress never jumps back
    if (Math.abs(Number(input.value) - v) > step / 2) input.value = String(v);
    show(v);
  };
  input.value = String(value);
  show(value);

  const el = h('div', { class: 'tl-field tl-field--range' },
    head(h('label', { class: 'tl-label', for: id }, field.label), out),
    track,
    help.node);
  return { el, set, input };
}

// ---- switches ---------------------------------------------------------------

export function toggle(field, { value, onChange }) {
  const id = uid('switch');
  const help = helpText(field);
  const input = h('input', {
    class: 'tl-switch', type: 'checkbox', role: 'switch', id,
    'aria-describedby': help.id,
  });
  input.checked = !!value;
  input.addEventListener('change', () => onChange(input.checked));
  const el = h('div', { class: 'tl-field tl-field--switch' },
    h('div', { class: 'tl-switch-row' },
      h('label', { class: 'tl-label tl-label--wide', for: id }, field.label),
      input),
    help.node);
  return { el, set: (v) => { input.checked = !!v; }, input };
}

// ---- radio groups: segmented control and chip grid ----------------------------

// Builds a radiogroup of buttons. `render(option)` gives each button's inside.
function radioGroup(field, { value, options, onSelect, selectOnMove = true, cols = 1, className, render }) {
  const labelId = uid('label');
  const help = helpText(field);
  const group = h('div', {
    class: className, role: 'radiogroup', 'aria-labelledby': labelId, 'aria-describedby': help.id,
  });
  const buttons = options.map((opt) => {
    const b = h('button', { type: 'button', class: 'tl-opt', role: 'radio', 'data-value': opt }, render(opt));
    b.addEventListener('click', () => onSelect(opt));
    return b;
  });
  group.append(...buttons);
  const rove = roving(buttons, { cols, selectOnMove, onPick: (b) => onSelect(b.dataset.value) });

  let current = null;
  const set = (v) => {
    current = v;
    let index = 0;
    buttons.forEach((b, i) => {
      const on = b.dataset.value === String(v);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      if (on) index = i;
    });
    rove.focusOn(index);
    group.style.setProperty('--i', String(index));
  };
  set(value);
  return { group, buttons, labelId, help, set, get value() { return current; } };
}

// Two to four choices side by side, with a sliding highlight.
export function segmented(field, { value, onSelect, selectOnMove = true, labels = (o) => optionLabel(field, o) }) {
  const g = radioGroup(field, {
    value, options: field.options, onSelect, selectOnMove, className: 'tl-seg',
    render: (o) => h('span', { class: 'tl-opt-text' }, labels(o)),
  });
  g.group.style.setProperty('--n', String(field.options.length));
  g.group.prepend(h('span', { class: 'tl-seg-thumb', 'aria-hidden': 'true' }));
  const el = h('div', { class: 'tl-field tl-field--seg' },
    head(h('span', { class: 'tl-label', id: g.labelId }, field.label)),
    g.group, g.help.node);
  return { el, set: g.set, group: g.group, buttons: g.buttons };
}

// More choices than fit in a row: a grid of chips. `render` can draw richer chips
// (palette swatches, behaviour names).
export function chips(field, { value, onSelect, cols = 3, render, className = 'tl-chips', labels = (o) => optionLabel(field, o) }) {
  const g = radioGroup(field, {
    value, options: field.options, onSelect, cols, className,
    render: render || ((o) => [h('span', { class: 'tl-opt-text' }, labels(o)), icon('check', 'tl-icon tl-opt-check')]),
  });
  g.group.style.setProperty('--cols', String(cols));
  const el = h('div', { class: 'tl-field tl-field--chips' },
    head(h('span', { class: 'tl-label', id: g.labelId }, field.label)),
    g.group, g.help.node);
  return { el, set: g.set, group: g.group, buttons: g.buttons };
}

// ---- stepper ------------------------------------------------------------------

// For small whole numbers: minus, the value, plus.
export function stepper(field, { value, onChange }) {
  const labelId = uid('label');
  const help = helpText(field);
  let current = value;
  const out = h('output', { class: 'tl-step-value', 'aria-live': 'polite' });
  const less = h('button', { type: 'button', class: 'tl-step-btn', 'aria-label': `${field.label}: fewer` }, icon('minus'));
  const more = h('button', { type: 'button', class: 'tl-step-btn', 'aria-label': `${field.label}: more` }, icon('plus'));
  const set = (v) => {
    current = v;
    out.textContent = formatValue(field, v);
    less.disabled = v <= field.min;
    more.disabled = v >= field.max;
  };
  less.addEventListener('click', () => onChange(Math.max(field.min, current - 1)));
  more.addEventListener('click', () => onChange(Math.min(field.max, current + 1)));
  set(value);
  const el = h('div', { class: 'tl-field tl-field--step', role: 'group', 'aria-labelledby': labelId, 'aria-describedby': help.id },
    h('div', { class: 'tl-switch-row' },
      h('span', { class: 'tl-label tl-label--wide', id: labelId }, field.label),
      h('div', { class: 'tl-stepper' }, less, out, more)),
    help.node);
  return { el, set };
}

// ---- native select ---------------------------------------------------------------

// A styled <select>: on phones it opens the system picker, which suits long lists.
export function select({ label, value, options, onChange, className = '' }) {
  const id = uid('select');
  const input = h('select', { class: 'tl-select', id });
  for (const o of options) input.append(h('option', { value: o.value }, o.label));
  input.value = value;
  input.addEventListener('change', () => onChange(input.value));
  const el = h('div', { class: `tl-select-row ${className}` },
    h('label', { class: 'tl-label', for: id }, label),
    h('div', { class: 'tl-select-wrap' }, input, icon('chevron', 'tl-icon tl-select-chevron')));
  return { el, set: (v) => { input.value = v; }, input };
}

// ---- buttons ------------------------------------------------------------------------

export function button(text, { onClick, iconName, variant = '', label, className = '' } = {}) {
  const b = h('button', { type: 'button', class: `tl-btn ${variant ? `tl-btn--${variant}` : ''} ${className}`.trim(), 'aria-label': label },
    iconName ? icon(iconName) : null,
    text ? h('span', { class: 'tl-btn-text' }, text) : null);
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

// A button that asks once before it acts: the first tap turns it into
// "Are you sure? [Cancel] [Yes]". Used for anything that cannot be undone.
export function confirmButton(text, { question, yes, onConfirm, iconName, variant = '' }) {
  const wrap = h('div', { class: 'tl-confirm' });
  const start = button(text, { iconName, variant });
  const ask = h('div', { class: 'tl-confirm-ask', hidden: true },
    h('span', { class: 'tl-confirm-q' }, question));
  const cancel = button('Cancel', { variant: 'quiet' });
  const ok = button(yes, { variant: 'danger' });
  ask.append(h('div', { class: 'tl-confirm-actions' }, cancel, ok));
  const reset = (focus) => {
    ask.hidden = true;
    start.hidden = false;
    if (focus) start.focus();
  };
  start.addEventListener('click', () => {
    start.hidden = true;
    ask.hidden = false;
    cancel.focus();
  });
  cancel.addEventListener('click', () => reset(true));
  ok.addEventListener('click', () => { reset(true); onConfirm(); });
  wrap.append(start, ask);
  return { el: wrap, reset };
}

// A titled group of controls on a soft card.
export function section(title, { collapsible = false, open = true, note } = {}) {
  const body = h('div', { class: 'tl-card' });
  if (!collapsible) {
    const el = h('section', { class: 'tl-section' },
      title ? h('h3', { class: 'tl-section-title' }, title) : null,
      note ? h('p', { class: 'tl-section-note' }, note) : null,
      body);
    return { el, body };
  }
  const id = uid('region');
  const toggleBtn = h('button', { type: 'button', class: 'tl-disclose', 'aria-expanded': open ? 'true' : 'false', 'aria-controls': id },
    h('span', { class: 'tl-section-title' }, title),
    note ? h('span', { class: 'tl-disclose-note' }, note) : null,
    icon('chevron', 'tl-icon tl-disclose-chevron'));
  body.id = id;
  body.hidden = !open;
  toggleBtn.addEventListener('click', () => {
    const show = body.hidden;
    body.hidden = !show;
    toggleBtn.setAttribute('aria-expanded', show ? 'true' : 'false');
  });
  const el = h('section', { class: 'tl-section tl-section--collapsible' }, toggleBtn, body);
  return { el, body };
}
