// The overlay's controls: switches, segmented choices, selects, buttons and sections. Each is
// a native control (a checkbox, radio buttons, a select, a button) under the styling, so the
// keyboard, screen readers and high-contrast modes work the way they do everywhere else. Every
// one has a visible label, and help text tied to it with aria-describedby.
import { h, icon, uid } from './dom.js';

export function button(label, { onClick, iconName, variant = '', className = '', ariaLabel, title } = {}) {
  return h('button', {
    type: 'button',
    class: ['tl-btn', variant && `tl-btn--${variant}`, className].filter(Boolean).join(' '),
    onclick: onClick,
    'aria-label': ariaLabel,
    title,
  }, iconName ? icon(iconName) : null, h('span', { text: label }));
}

const helpText = (text) => (text ? h('p', { class: 'tl-help', id: uid('help'), text }) : null);

// A labelled on/off switch: a checkbox that announces itself as a switch.
// → { el, input, set(on), setDisabled(on), setHelp(text) }
export function switchField({ label, help, checked = false, onChange }) {
  const id = uid('switch');
  const helpEl = helpText(help);
  const input = h('input', {
    type: 'checkbox', role: 'switch', class: 'tl-switch', id, checked: !!checked,
    'aria-describedby': helpEl?.id,
    onchange: () => onChange?.(input.checked),
  });
  const el = h('div', { class: 'tl-field tl-field--switch' },
    h('div', { class: 'tl-switch-row' }, h('label', { class: 'tl-label', for: id, text: label }), input),
    helpEl);
  return {
    el,
    input,
    set(on) { input.checked = !!on; },
    setDisabled(on) {
      input.disabled = !!on;
      el.classList.toggle('is-muted', !!on);
    },
    setHelp(text) { if (helpEl) helpEl.textContent = text; },
  };
}

// One choice out of a few, as radio buttons styled into a segmented row. The arrow keys move
// the choice, as with any radio group.
// options: [{ value, label }] → { el, set(value), value(), setDisabled(on) }
export function segmentedField({ label, help, options, value, onChange }) {
  const name = uid('choice');
  const titleId = uid('legend');
  const helpEl = helpText(help);
  const inputs = options.map((o) => h('input', {
    type: 'radio', name, value: String(o.value), class: 'tl-seg-input', checked: o.value === value,
    onchange: () => onChange?.(o.value),
  }));
  const group = h('div', { class: 'tl-seg', role: 'radiogroup', 'aria-labelledby': titleId, 'aria-describedby': helpEl?.id },
    options.map((o, i) => h('label', { class: 'tl-seg-opt' }, inputs[i], h('span', { class: 'tl-seg-text', text: o.label }))));
  group.style.setProperty('--n', String(options.length));
  const el = h('div', { class: 'tl-field tl-field--seg' }, h('div', { class: 'tl-label', id: titleId, text: label }), group, helpEl);
  return {
    el,
    set(v) { inputs.forEach((input, i) => { input.checked = options[i].value === v; }); },
    value: () => options[inputs.findIndex((input) => input.checked)]?.value,
    setDisabled(on) {
      for (const input of inputs) input.disabled = !!on;
      el.classList.toggle('is-muted', !!on);
    },
  };
}

// A labelled select. options: [{ value, label }] → { el, select, setOptions(options, value), set(value), setDisabled(on) }
export function selectField({ label, help, options = [], value, onChange }) {
  const id = uid('select');
  const helpEl = helpText(help);
  const select = h('select', { id, class: 'tl-select', 'aria-describedby': helpEl?.id, onchange: () => onChange?.(select.value) });
  const el = h('div', { class: 'tl-field tl-field--select' },
    h('div', { class: 'tl-select-row' },
      h('label', { class: 'tl-label', for: id, text: label }),
      h('div', { class: 'tl-select-wrap' }, select, icon('chevron', 'tl-icon tl-select-chevron'))),
    helpEl);
  const api = {
    el,
    select,
    setOptions(list, v = select.value) {
      select.replaceChildren(...list.map((o) => h('option', { value: String(o.value), text: o.label })));
      api.set(v);
    },
    set(v) {
      const s = String(v);
      if ([...select.options].some((o) => o.value === s)) select.value = s;
    },
    setDisabled(on) {
      select.disabled = !!on;
      el.classList.toggle('is-muted', !!on);
    },
  };
  api.setOptions(options, value);
  return api;
}

// A titled group of fields. → the section element
export function section(title, ...children) {
  const titleId = uid('section');
  return h('section', { class: 'tl-section', 'aria-labelledby': titleId },
    h('h3', { class: 'tl-section-title', id: titleId, text: title }),
    h('div', { class: 'tl-card' }, children));
}

// A short message in the panel. → { el, show(text, kind), hide() }. Kind 'error' tints it, but
// the words themselves say what went wrong, so colour is never the only sign.
export function notice() {
  const el = h('p', { class: 'tl-notice', role: 'status', hidden: true });
  return {
    el,
    show(text, kind = '') {
      el.textContent = text;
      el.classList.toggle('is-error', kind === 'error');
      el.hidden = !text;
    },
    hide() { el.hidden = true; },
  };
}

// A heading that opens and closes the part under it. → { el, body, setOpen(on) }
export function disclosure(title, ...children) {
  const bodyId = uid('more');
  const body = h('div', { class: 'tl-disclose-body', id: bodyId, hidden: true }, children);
  const toggle = h('button', {
    type: 'button', class: 'tl-disclose', 'aria-expanded': 'false', 'aria-controls': bodyId,
    onclick: () => setOpen(body.hidden),
  }, h('span', { class: 'tl-disclose-title', text: title }), icon('chevron', 'tl-icon tl-disclose-chevron'));
  function setOpen(on) {
    body.hidden = !on;
    toggle.setAttribute('aria-expanded', String(!!on));
  }
  return { el: h('div', { class: 'tl-disclosure' }, toggle, body), body, setOpen };
}
