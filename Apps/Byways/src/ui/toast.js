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
  let busy = false;
  const toast = { close() {
    clearTimeout(timer);
    el.remove();
    if (sticky === toast) sticky = null;
    if (timed === toast) timed = null;
  } };
  // One run at a time: the buttons are disabled while it is in flight. Success closes the toast;
  // failure warns, announces the error and re-enables the buttons so the person can try again.
  const guarded = (run) => async () => {
    if (busy) return;
    busy = true;
    buttons.forEach((b) => { b.disabled = true; });
    try {
      await run();
      toast.close();
    } catch (err) {
      console.warn('toast: action failed', err);
      announce('That did not work. Please try again.', { assertive: true });
      busy = false;
      buttons.forEach((b) => { b.disabled = false; });
    }
  };
  if (undo) buttons.push(h('button', { type: 'button', text: 'Undo', onClick: guarded(undo) }));
  if (action) buttons.push(h('button', { type: 'button', text: action.label, onClick: guarded(() => action.run()) }));
  const el = h('div', { class: 'toast' }, h('span', { text: message }), buttons);
  document.getElementById('toasts').append(el);
  if (isSticky) sticky = toast; else { timed = toast; timer = setTimeout(toast.close, ms); }
  announce(message);
  return toast;
}
