// What floats over the light while playing: the open button, the recording badge,
// the behaviour name card, toasts and the screen-reader live region.
//
// Everything here is cheap to update: text changes at most a few times a second,
// and nothing reads layout.

import { h } from './controls.js';
import { icon } from './icons.js';

const FADE_AFTER_MS = 3000;  // the open button dims this long after the last interaction
const NEAR_PX = 180;         // a pointer this close to the top-right corner wakes it
const ANNOUNCE_GAP_MS = 1500;
const TOAST_MS = 2800;
const MAX_TOASTS = 3;

// How hidden controls come back, in the same words wherever it is said.
export const RESTORE_HINT = 'To bring them back, tap the faint button at the top right, press H, or hold three fingers still for a second.';

export const formatClock = (s) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

export function createHUD(root, { onOpen, onStopRecording, reducedMotion }) {
  // ---- open button ------------------------------------------------------------
  const openBtn = h('button', {
    type: 'button', class: 'tl-open', 'aria-label': 'Open controls', 'aria-expanded': 'false',
  }, h('span', { class: 'tl-open-glass', 'aria-hidden': 'true' }), icon('lume', 'tl-icon tl-open-icon'));
  openBtn.addEventListener('click', () => onOpen());

  let fadeTimer = 0;
  let awake = true;
  function wake() {
    if (!awake) {
      awake = true;
      openBtn.classList.remove('is-dim');
    }
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => {
      // stays bright while it has keyboard focus (focus left there by a tap does not count)
      if (document.activeElement === openBtn && openBtn.matches(':focus-visible')) return;
      awake = false;
      openBtn.classList.add('is-dim');
    }, FADE_AFTER_MS);
  }
  openBtn.addEventListener('focus', wake);
  openBtn.addEventListener('blur', wake);
  openBtn.addEventListener('pointerenter', wake);

  // the viewport width is cached so a pointer move never reads layout
  let viewW = innerWidth;
  const onResize = () => { viewW = innerWidth; };
  addEventListener('resize', onResize, { passive: true });
  const onMove = (e) => {
    if (e.clientY < NEAR_PX && e.clientX > viewW - NEAR_PX) wake();
  };
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onMove, { passive: true });

  // a soft ring that draws the eye to the button once, after the intro
  function beckon() {
    if (reducedMotion()) return;
    wake();
    openBtn.classList.remove('is-beckon');
    // restart the animation even if it ran before
    void openBtn.offsetWidth;
    openBtn.classList.add('is-beckon');
    setTimeout(() => openBtn.classList.remove('is-beckon'), 2600);
  }

  // ---- recording badge --------------------------------------------------------
  const recTime = h('span', { class: 'tl-rec-time' }, '0:00');
  const recBtn = h('button', { type: 'button', class: 'tl-rec', hidden: true, 'aria-label': 'Stop recording' },
    h('span', { class: 'tl-rec-dot', 'aria-hidden': 'true' }), recTime);
  recBtn.addEventListener('click', () => onStopRecording());
  let recShown = false;
  let recText = '';
  function setRecording(on, elapsed) {
    if (on !== recShown) {
      recShown = on;
      recBtn.hidden = !on;
      root.classList.toggle('is-recording', on);
    }
    if (on) {
      const text = formatClock(elapsed);
      if (text !== recText) {
        recText = text;
        recTime.textContent = text;
        recBtn.setAttribute('aria-label', `Stop recording, ${text} so far`);
      }
    }
  }

  // ---- behaviour name card ----------------------------------------------------
  const cardLayer = h('div', { class: 'tl-namecard-layer', 'aria-hidden': 'true' });
  let card = null;
  function showBehaviour(name, blurb) {
    const old = card;
    if (old) {
      // a quick change replaces the card: the old one slips away from where it is
      const from = getComputedStyle(old).opacity;
      if (typeof old.getAnimations === 'function') old.getAnimations().forEach((a) => a.cancel());
      fadeAway(old, from);
    }
    const el = h('div', { class: 'tl-namecard' },
      h('div', { class: 'tl-namecard-name' }, name),
      blurb ? h('div', { class: 'tl-namecard-blurb' }, blurb) : null);
    cardLayer.append(el);
    card = el;
    const total = blurb ? 3200 : 1600;
    const still = reducedMotion();
    const from = still ? { opacity: 0 } : { opacity: 0, transform: 'translateY(10px) scale(0.985)', filter: 'blur(6px)' };
    const rest = still ? { opacity: 1 } : { opacity: 1, transform: 'none', filter: 'blur(0px)' };
    const to = still ? { opacity: 0 } : { opacity: 0, transform: 'translateY(-6px)', filter: 'blur(4px)' };
    if (typeof el.animate !== 'function') {
      setTimeout(() => el.remove(), total);
      return;
    }
    const anim = el.animate([
      { ...from, offset: 0 },
      { ...rest, offset: 380 / total },
      { ...rest, offset: 1 - 520 / total },
      { ...to, offset: 1 },
    ], { duration: total, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' });
    anim.onfinish = () => { el.remove(); if (card === el) card = null; };
  }

  function fadeAway(el, from) {
    if (typeof el.animate !== 'function') { el.remove(); return; }
    const a = el.animate([{ opacity: from }, { opacity: 0 }], { duration: 220, easing: 'ease-out', fill: 'forwards' });
    a.onfinish = () => el.remove();
  }

  // ---- toasts -----------------------------------------------------------------
  const toasts = h('div', { class: 'tl-toasts', role: 'status', 'aria-live': 'polite' });
  const live = new Map(); // text -> { el, timer }
  function toast(text, ms = TOAST_MS) {
    const msg = String(text || '').trim();
    if (!msg) return;
    const existing = live.get(msg);
    if (existing) {
      // the same message again: keep the one on screen a little longer
      clearTimeout(existing.timer);
      existing.timer = setTimeout(() => dismiss(msg), ms);
      return;
    }
    while (live.size >= MAX_TOASTS) dismiss(live.keys().next().value);
    const el = h('div', { class: 'tl-toast' }, msg);
    toasts.append(el);
    // next frame, so the entrance transition runs
    requestAnimationFrame(() => el.classList.add('is-in'));
    live.set(msg, { el, timer: setTimeout(() => dismiss(msg), ms + Math.min(2000, msg.length * 25)) });
  }
  function dismiss(msg) {
    const t = live.get(msg);
    if (!t) return;
    live.delete(msg);
    clearTimeout(t.timer);
    t.el.classList.remove('is-in');
    t.el.classList.add('is-out');
    setTimeout(() => t.el.remove(), 320);
  }

  // ---- live region ------------------------------------------------------------
  const sr = h('div', { class: 'tl-sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });
  let lastSaid = -Infinity;
  let queued = '';
  let sayTimer = 0;
  function announce(text) {
    queued = String(text || '');
    if (!queued || sayTimer) return;
    const wait = Math.max(0, lastSaid + ANNOUNCE_GAP_MS - performance.now());
    // the latest message wins when several arrive inside the gap
    sayTimer = setTimeout(() => {
      sayTimer = 0;
      lastSaid = performance.now();
      // the same words twice would not change the region, and so not be read again
      sr.textContent = sr.textContent === queued ? `${queued} ` : queued;
      queued = '';
    }, wait);
  }

  root.append(cardLayer, openBtn, recBtn, toasts, sr);
  wake();

  return {
    openBtn, recBtn,
    wake, beckon, setRecording, showBehaviour, toast, announce,
    setOpen(isOpen) { openBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false'); },
    // while the controls are hidden the button stays, faint, as the one-tap way back
    setHidden(on) { openBtn.setAttribute('aria-label', on ? 'Show controls' : 'Open controls'); },
  };
}
