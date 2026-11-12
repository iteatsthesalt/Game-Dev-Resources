// A panel: a side sheet of dark glass with a heading, a close button and a body that scrolls.
// It is not modal: the light keeps playing, and the mouse still plays it, while a panel is
// open. A closed panel is inert, so neither the keyboard nor a screen reader lands in it.
import { h, icon, uid } from './dom.js';

// `name`: 'phone', 'sound' or 'settings'. → { name, el, body, closeButton, setOpen(on) }
export function createPanel({ name, eyebrow, title, onClose }) {
  const titleId = uid('panel-title');
  const closeButton = h('button', { type: 'button', class: 'tl-icon-btn', 'aria-label': `Close the ${name} panel`, title: 'Close (Esc)', onclick: onClose }, icon('close'));
  const body = h('div', { class: 'tl-panel-body' });
  const el = h('section', { id: `tl-panel-${name}`, class: 'tl-panel', role: 'dialog', 'aria-labelledby': titleId, inert: true },
    h('div', { class: 'tl-panel-glass', 'aria-hidden': 'true' }),
    h('header', { class: 'tl-panel-head' },
      h('div', { class: 'tl-panel-titles' },
        h('span', { class: 'tl-eyebrow', text: eyebrow }),
        h('h2', { class: 'tl-panel-title', id: titleId, text: title })),
      closeButton),
    body);
  return {
    name,
    el,
    body,
    closeButton,
    setOpen(on) {
      el.classList.toggle('is-open', !!on);
      el.inert = !on;
    },
  };
}
