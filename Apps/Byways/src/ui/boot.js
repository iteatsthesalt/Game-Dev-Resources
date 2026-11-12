// Builds the App and routes between views. Importing this file touches no DOM: only the guarded
// last line runs bootFromShell, and only in a page whose <html> names a shell.
import { mulberry32 } from '../core/util/hash.js';
import { realClock } from '../core/util/clock.js';
import { createHttp } from '../core/net/http.js';
import { openStore, idbBackend, memoryBackend } from '../core/store/db.js';
import { loadSettings, saveSettings } from '../core/settings.js';
import { DATA_FILES, EMPTY_DATA, dataUrlFor, loadAppData } from '../core/data.js';
import { createPwaPlatform, registerServiceWorker } from '../platform/pwa.js';
import { h, clear } from './dom.js';
import { announce, focusMain } from './a11y.js';
import { applyAccessSettings } from './theme.js';
import { getView, startRouter } from './router.js';
import { runFirstRun } from './firstrun.js';
import { showToast } from './toast.js';
import './views/index.js';

export { DATA_FILES, EMPTY_DATA, dataUrlFor, loadAppData };

export const STORAGE_OFF_MESSAGE = 'Storage is blocked in this browser. Nothing you save will be kept.';
export const VIEW_FAILED_MESSAGE = 'This view failed to load.';
export const UPDATE_MESSAGE = 'Update available, reload';

// Set once the person chose to reload, so the controllerchange that a first install also fires
// (clients.claim()) does not reload the page.
let reloading = false;

function offerUpdate(reg) {
  showToast(UPDATE_MESSAGE, {
    ms: 0,
    action: {
      label: 'Reload',
      run() {
        // No waiting worker means another tab has already activated it, so no controllerchange will come.
        if (!reg.waiting) return location.reload();
        reloading = true;
        reg.waiting.postMessage({ type: 'skip-waiting' });
      },
    },
  });
}

/** Open IndexedDB, or a store in memory when the browser blocks it. */
async function openStoreOrMemory() {
  try {
    return { store: await openStore(idbBackend()), blocked: false };
  } catch {
    return { store: await openStore(memoryBackend()), blocked: true };
  }
}

function markCurrentLink(route) {
  for (const link of document.querySelectorAll('nav a')) {
    if (link.getAttribute('href') === `#/${route}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

// focusFirst: also move focus into main after the first render (first run has just cleared the page under it).
function makeShow(app, { focusFirst = false } = {}) {
  let leaveCurrent = null;
  let latest = 0;
  let rendered = focusFirst;
  return async function show(route, params) {
    const mine = ++latest;
    try {
      leaveCurrent?.();
    } catch (error) {
      console.warn('Byways: a view failed to leave', error);
    }
    leaveCurrent = null;
    const view = getView(route);
    const body = h('div', { class: 'view-body' });
    clear(document.getElementById('app')).append(h('div', { class: 'view' }, h('h1', null, view.title), body));
    document.title = `${view.title} · Byways`;
    markCurrentLink(route);
    leaveCurrent = view.leave ? () => view.leave() : null;
    try {
      await view.render(body, app, params);
    } catch (error) {
      console.warn('Byways: a view failed to render', error);
      if (mine === latest) {
        clear(body).append(h('p', null, VIEW_FAILED_MESSAGE));
        announce(VIEW_FAILED_MESSAGE, { assertive: true });
      }
    }
    if (rendered && mine === latest) focusMain();
    rendered = true;
  };
}

/** Build the App for a platform, then start the router. */
export async function boot(platform) {
  const { store, blocked } = await openStoreOrMemory();
  const settings = await loadSettings(store);
  applyAccessSettings(settings);
  const clock = realClock;
  const rand = mulberry32(crypto.getRandomValues(new Uint32Array(1))[0]);
  const http = createHttp({ transport: platform.transport, clock });
  const dataUrl = file => dataUrlFor(platform.name, file);
  const data = await loadAppData({ fetchFn: url => platform.transport.fetch(url), base: document.baseURI, dataUrl, http, store });
  const app = {
    store, settings, getSettings: () => settings, http, clock, rand, platform, data, dataUrl,
    async saveSettings(patch) {
      Object.assign(settings, await saveSettings(store, patch));
      applyAccessSettings(settings);
      return settings;
    },
  };
  document.querySelector('.skip-link')?.addEventListener('click', event => {
    event.preventDefault();
    focusMain();
  });
  const showedFirstRun = await runFirstRun(app);
  startRouter(makeShow(app, { focusFirst: showedFirstRun }));
  if (blocked) announce(STORAGE_OFF_MESSAGE, { assertive: true });
  await platform.attach?.(app);
  return app;
}

/** Boot the installable web app; the other shells call boot() themselves. */
export async function bootFromShell() {
  if (document.documentElement.dataset.shell !== 'pwa') return;
  try {
    const { store: secretsStore } = await openStoreOrMemory();
    await boot(createPwaPlatform({ secretsStore }));
  } catch (error) {
    console.error('Byways failed to start', error);
    return;
  }
  try {
    navigator.serviceWorker?.addEventListener('controllerchange', () => {
      if (reloading) location.reload();
    });
    await registerServiceWorker(window, offerUpdate);
  } catch (error) {
    console.warn('Byways: the service worker did not register', error);
  }
}

if (globalThis.document?.documentElement?.dataset?.shell) bootFromShell();
