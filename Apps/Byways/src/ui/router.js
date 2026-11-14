// Hash router: `#/<route>[/<id>]` for views and `#s=<payload>` for a shared import link.
// Nothing here touches a global at import time, so it loads under Node as well as in the browser.
export const ROUTES = ['stumble', 'feed', 'daily', 'vault', 'saved', 'settings', 'import'];

const HOME_HASHES = new Set(['', '#', '#/', '#/stumble']);
const SHARE_PREFIX = '#s=';
const views = new Map();
let current = null;

function assertRoute(route) {
  if (!ROUTES.includes(route)) throw new Error(`unknown route: ${route}`);
}

export function registerView(route, view) {
  assertRoute(route);
  views.set(route, view);
}

export const getView = route => views.get(route);

export function parseHash(hash) {
  const text = typeof hash === 'string' ? hash : '';
  if (text.startsWith(SHARE_PREFIX) && text.length > SHARE_PREFIX.length) {
    return { route: 'import', params: { payload: text.slice(SHARE_PREFIX.length) } };
  }
  if (!text.startsWith('#/')) return { route: 'stumble', params: {} };
  const [name, id] = text.slice(2).split('/');
  const route = name.toLowerCase();
  if (!ROUTES.includes(route)) return { route: 'stumble', params: {} };
  const params = {};
  if (id) {
    try { params.id = decodeURIComponent(id); } catch { /* a malformed id is dropped */ }
  }
  return { route, params };
}

export function buildHash(route, params = {}) {
  assertRoute(route);
  if (route === 'import' && params.payload) return SHARE_PREFIX + params.payload;
  return params.id ? `#/${route}/${encodeURIComponent(params.id)}` : `#/${route}`;
}

function renderCurrent({ render, win }) {
  const { route, params } = parseHash(win.location.hash);
  render(route, params);
}

function handleBack(win, event) {
  const open = Array.from(win.document.querySelectorAll('dialog[open]'));
  if (open.length) {
    open[open.length - 1].close();
    event.preventDefault();
    return;
  }
  queueMicrotask(() => {
    if (!event.defaultPrevented && !HOME_HASHES.has(win.location.hash)) win.history.back();
  });
}

export function startRouter(render, win = globalThis) {
  const router = { render, win };
  current = router;
  win.addEventListener('hashchange', () => renderCurrent(router));
  win.addEventListener('byways:back', event => handleBack(win, event));
  renderCurrent(router);
}

export function navigate(route, params = {}) {
  const hash = buildHash(route, params);
  if (current.win.location.hash === hash) renderCurrent(current);
  else current.win.location.hash = hash;
}
