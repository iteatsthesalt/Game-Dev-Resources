// First-run steps, shown once before the router starts. Later plans register their own steps.
// Importing this file touches no DOM: rendering only happens inside runFirstRun.
import { h, clear } from './dom.js';

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
    clear(document.getElementById('app')).append(h('section', { 'data-firstrun': step.id }, container, skip));
    try {
      // Not awaited: a step that is still loading can be skipped.
      Promise.resolve(step.render(container, app, end)).catch(passOver);
    } catch (error) {
      passOver(error);
    }
  });
}

/** Run every step once, then remember it. Returns at once when first run is already done. */
export async function runFirstRun(app) {
  if (app.getSettings().firstRunDone) return;
  for (const step of [...steps].sort((a, b) => a.order - b.order)) await runStep(step, app);
  clear(document.getElementById('app'));
  await app.saveSettings({ firstRunDone: true });
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
