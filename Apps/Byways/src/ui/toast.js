import { h } from './dom.js';
import { announce } from './a11y.js';

// At most one sticky toast and one timed toast are open; each kind replaces only its own kind.
let sticky = null;
let timed = null;

export function showToast(message, { undo, ms = 5000, action } = {}) {
  const isSticky = ms === 0;
  (isSticky ? sticky : timed)?.close();
  let timer = null;
  const buttons = [];
  const toast = { close() {
    clearTimeout(timer);
    el.remove();
    if (sticky === toast) sticky = null;
    if (timed === toast) timed = null;
  } };
  if (undo) buttons.push(h('button', { type: 'button', text: 'Undo', onClick: async () => { await undo(); toast.close(); } }));
  if (action) buttons.push(h('button', { type: 'button', text: action.label, onClick: async () => { await action.run(); toast.close(); } }));
  const el = h('div', { class: 'toast' }, h('span', { text: message }), buttons);
  document.getElementById('toasts').append(el);
  if (isSticky) sticky = toast; else { timed = toast; timer = setTimeout(toast.close, ms); }
  announce(message);
  return toast;
}
