import { h } from './dom.js';
import { announce, focusMain } from './a11y.js';

// At most one sticky toast and one timed toast are open; each kind replaces only its own kind.
let sticky = null;
let timed = null;

export function showToast(message, { undo, ms = 5000, action } = {}) {
  const isSticky = ms === 0;
  (isSticky ? sticky : timed)?.close();
  const opener = document.activeElement;
  let timer = null;
  const buttons = [];
  let busy = false;
  let focused = false;
  let hovered = false;
  let closed = false;
  // A timed toast waits while focus or the pointer is on it, or while its action runs.
  const stopTimer = () => { clearTimeout(timer); timer = null; };
  const startTimer = () => {
    stopTimer();
    if (!isSticky && !closed && !busy && !focused && !hovered) timer = setTimeout(() => toast.close(), ms);
  };
  // Focus that was inside the toast goes back where it came from, or to main when that is gone.
  const returnFocus = () => {
    if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) opener.focus();
    if (document.activeElement === document.body || !document.activeElement) focusMain();
  };
  const close = (hadFocus) => {
    if (closed) return;
    closed = true;
    stopTimer();
    el.remove();
    if (sticky === toast) sticky = null;
    if (timed === toast) timed = null;
    if (hadFocus) returnFocus();
  };
  const toast = { close: () => close(el.contains(document.activeElement)) };
  // One run at a time: the buttons are disabled while it is in flight. Success closes the toast;
  // failure warns, announces the error and re-enables the buttons so the person can try again.
  // Focus is read before the buttons are disabled, since disabling can drop it to <body>.
  const guarded = (run) => async (event) => {
    if (busy) return;
    const pressed = event?.currentTarget;
    const hadFocus = el.contains(document.activeElement);
    busy = true;
    stopTimer();
    buttons.forEach((b) => { b.disabled = true; });
    try {
      await run();
      close(hadFocus || el.contains(document.activeElement));
    } catch (err) {
      console.warn('toast: action failed', err);
      announce('That did not work. Please try again.', { assertive: true });
      busy = false;
      buttons.forEach((b) => { b.disabled = false; });
      if (hadFocus && !el.contains(document.activeElement)) pressed?.focus();
      startTimer();
    }
  };
  if (undo) buttons.push(h('button', { type: 'button', text: 'Undo', onClick: guarded(undo) }));
  if (action) buttons.push(h('button', { type: 'button', text: action.label, onClick: guarded(() => action.run()) }));
  const el = h('div', {
    class: 'toast',
    onFocusin: () => { focused = true; stopTimer(); },
    onFocusout: (event) => { if (!el.contains(event.relatedTarget)) { focused = false; startTimer(); } },
    onPointerenter: () => { hovered = true; stopTimer(); },
    onPointerleave: () => { hovered = false; startTimer(); },
  }, h('span', { text: message }), buttons);
  document.getElementById('toasts').append(el);
  if (isSticky) sticky = toast; else { timed = toast; startTimer(); }
  announce(message);
  return toast;
}
