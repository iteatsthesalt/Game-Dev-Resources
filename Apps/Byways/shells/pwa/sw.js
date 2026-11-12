const BUILD_ID = '__BUILD_ID__';
const CACHE = 'byways-' + BUILD_ID;
const PRECACHE = ["__PRECACHE__"];

const DATA_FILE = /\/data\/[^/]+\.json$/;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('byways-') && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'skip-waiting') self.skipWaiting();
});

// Answer from the cache when it has the file, and always fetch so the next read is fresh.
function staleWhileRevalidate(event) {
  const { request } = event;
  let stored = Promise.resolve();
  const network = fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      stored = caches.open(CACHE).then(cache => cache.put(request, copy));
    }
    return response;
  });
  event.waitUntil(network.then(() => stored).catch(() => {}));
  event.respondWith(caches.open(CACHE).then(cache => cache.match(request)).then(hit => hit || network));
}

// Only the app URL itself gets the shell: the Lab at lab/ is a separate page in the same scope.
function isAppNavigation(request) {
  if (request.mode !== 'navigate') return false;
  const scopePath = new URL(self.registration.scope).pathname;
  const path = new URL(request.url).pathname;
  return path === scopePath || path === scopePath + 'index.html';
}

function cacheFirst(request, key = request) {
  return caches.open(CACHE).then(cache => cache.match(key)).then(hit => hit || fetch(request));
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (DATA_FILE.test(url.pathname)) return staleWhileRevalidate(event);
  if (isAppNavigation(request)) {
    event.respondWith(cacheFirst(request, new URL('./index.html', self.registration.scope).href));
    return;
  }
  event.respondWith(cacheFirst(request));
});
