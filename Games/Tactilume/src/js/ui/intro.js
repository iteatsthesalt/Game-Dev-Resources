// The first-run welcome: a soft veil over the light, already moving behind it,
// with the name, one line, and a way in. Any tap begins.

import { h } from './controls.js';

const TITLE = 'Tactilume';
const LINE = 'Touch the dark. Each extra finger changes the light.';

export function createIntro(root, { onBegin, reducedMotion }) {
  const titleId = 'tl-intro-title';
  const lineId = 'tl-intro-line';
  // the letters arrive one by one; screen readers get the word whole
  const letters = [...TITLE].map((ch, i) => {
    const s = h('span', { class: 'tl-intro-letter', 'aria-hidden': 'true' }, ch);
    s.style.setProperty('--d', `${120 + i * 55}ms`);
    return s;
  });
  const begin = h('button', { type: 'button', class: 'tl-intro-begin' }, 'Begin');
  const el = h('div', {
    class: `tl-intro${reducedMotion() ? ' is-still' : ''}`,
    role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, 'aria-describedby': lineId,
  },
  h('div', { class: 'tl-intro-veil', 'aria-hidden': 'true' }),
  h('div', { class: 'tl-intro-body' },
    h('h1', { class: 'tl-intro-title', id: titleId },
      h('span', { class: 'tl-sr-only' }, TITLE), letters),
    h('p', { class: 'tl-intro-line', id: lineId }, LINE),
    begin));

  let open = true;
  function close() {
    if (!open) return false;
    open = false;
    // the next touch must reach the light at once, even while the veil fades
    el.classList.add('is-leaving');
    el.setAttribute('aria-hidden', 'true');
    const done = () => el.remove();
    if (reducedMotion()) setTimeout(done, 200);
    else setTimeout(done, 900);
    onBegin();
    return true;
  }
  // any tap begins, the button included (a click is a completed tap, never a scroll)
  el.addEventListener('click', close);
  el.addEventListener('keydown', (e) => {
    // nothing else to reach inside: keep focus on the button
    if (e.key === 'Tab') { e.preventDefault(); begin.focus(); }
  });

  // Focus goes into the welcome for screen readers and keys. On touch screens it lands on
  // the welcome itself, so the browser does not draw a keyboard ring round Begin.
  el.tabIndex = -1;
  const touchFirst = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  root.append(el);
  requestAnimationFrame(() => {
    el.classList.add('is-in');
    (touchFirst ? el : begin).focus({ preventScroll: true });
  });

  return {
    el,
    isOpen: () => open,
    close,
  };
}
