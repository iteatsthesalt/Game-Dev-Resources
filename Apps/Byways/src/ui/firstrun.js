// First-run steps, shown once before the router starts. Later plans register their own steps.
// Importing this file touches no DOM: rendering only happens inside runFirstRun.
import { h, clear } from './dom.js';
import { announce } from './a11y.js';

export const FIRST_RUN_SAVE_FAILED = 'Byways could not save your choices, so these first steps will show again next time.';
export const PRIVACY_PROMISE = 'There is no Byways server. Your keys, collections and history are stored only on this device. Network calls go only to the sources and AI providers you turn on.';

const steps = [];

/** Add a step. Steps run in ascending `order`; render(container, app, done) may be async. */
export function registerFirstRunStep(step) {
  steps.push(step);
}

/** Show one step. Resolves at the first of done(), Skip, or a throw or rejection from render. */
function runStep(step, app) {
  return new Promise(resolve => {
    let ended = false;
    const end = () => { ended = true; resolve(); };
    const passOver = error => {
      if (ended) return;
      console.warn(`Byways: first-run step "${step.id}" failed and was passed over`, error);
      end();
    };
    const container = h('div');
    const skip = h('button', { type: 'button', text: 'Skip', onClick: end });
    const section = h('section', { 'data-firstrun': step.id }, container, skip);
    clear(document.getElementById('app')).append(section);
    try {
      // Not awaited: a step that is still loading can be skipped.
      Promise.resolve(step.render(container, app, end)).catch(passOver);
    } catch (error) {
      passOver(error);
    }
    if (!ended) focusStep(section);
  });
}

// Clearing #app drops the focused Continue or Skip to <body>, so each step takes focus unless its render already did.
function focusStep(section) {
  if (section.contains(document.activeElement)) return;
  const target = section.querySelector('h1, h2, h3, h4, h5, h6') ?? section;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus();
}

/**
 * Run every step once, then remember it. Resolves true when it showed steps (the page under focus was cleared),
 * false at once when first run is already done. A failed save is warned and announced; first run shows again next time.
 */
export async function runFirstRun(app) {
  if (app.getSettings().firstRunDone) return false;
  for (const step of [...steps].sort((a, b) => a.order - b.order)) await runStep(step, app);
  clear(document.getElementById('app'));
  try {
    await app.saveSettings({ firstRunDone: true });
  } catch (error) {
    console.warn('Byways: could not save that first run is done', error);
    announce(FIRST_RUN_SAVE_FAILED, { assertive: true });
  }
  return true;
}

registerFirstRunStep({
  id: 'welcome',
  order: 10,
  render(container, app, done) {
    const heading = h('h1', { tabindex: '-1', text: 'Welcome to Byways' });
    container.append(heading, h('p', { text: PRIVACY_PROMISE }), h('button', { type: 'button', text: 'Continue', onClick: done }));
    heading.focus();
  },
});
