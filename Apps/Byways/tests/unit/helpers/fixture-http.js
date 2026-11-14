import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from '../../fixtures/routes.js';
import { createHttp } from '../../../src/core/net/http.js';
import { createCache } from '../../../src/core/store/cache.js';
import { openStore, memoryBackend } from '../../../src/core/store/db.js';
import { DEFAULT_SETTINGS } from '../../../src/core/settings.js';
import { fakeClock } from '../../../src/core/util/clock.js';
import { mulberry32 } from '../../../src/core/util/hash.js';
import { SOURCES, SELF_PACED } from '../../../src/core/sources/index.js';

const HTTP_DIR = fileURLToPath(new URL('../../fixtures/http/', import.meta.url));
const TAGS_FILE = fileURLToPath(new URL('../../../src/data/tags.json', import.meta.url));
const TYPES = { '.json': 'application/json', '.xml': 'application/xml', '.html': 'text/html', '.txt': 'text/plain' };
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

// The PWA caps of src/platform/pwa.js, copied so node tests need not import the platform.
const PWA_CAPS = { privilegedFetch: false, localNetworkHttp: false, inAppSiteView: false, labHref: 'lab/', framesArchive: true };

function abortError() {
  return new DOMException('This operation was aborted', 'AbortError');
}

function responseFor(entry) {
  const headers = {};
  let body = entry.body ?? '';
  if (entry.file !== undefined) {
    body = readFileSync(HTTP_DIR + entry.file);
    headers['content-type'] = TYPES[extname(entry.file)] ?? 'application/octet-stream';
  } else if (entry.json !== undefined) {
    body = JSON.stringify(entry.json);
    headers['content-type'] = 'application/json';
  } else {
    headers['content-type'] = 'text/plain';
  }
  for (const [name, value] of Object.entries(entry.headers ?? {})) headers[name.toLowerCase()] = value;
  const status = entry.status ?? 200;
  return new Response(NULL_BODY_STATUSES.has(status) ? null : body, { status, headers });
}

function headersOf(init) {
  return Object.fromEntries(new Headers(init.headers ?? {}).entries());
}

/**
 * An in-memory SecretStore. `seed` is {id: value}; get gives null for a missing id.
 * @returns {import('../../../src/core/types.js').SecretStore}
 */
export function memorySecrets(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    async get(id) { return map.has(id) ? map.get(id) : null; },
    async set(id, value) { map.set(id, value); },
    async delete(id) { map.delete(id); },
    async list() { return [...map.keys()]; },
  };
}

/**
 * The context every adapter and the engine test against: a real Http client over a transport that answers from
 * tests/fixtures/routes.js, recording every request in `calls`. `extraRoutes` is read on every request, so a test
 * may push to it later. A route may also set `error: true` (the fetch throws a TypeError) or `hang: true` (the
 * fetch never settles until its signal aborts).
 * `transport` is returned too, so tests of the kit itself can call it directly.
 * @returns {Promise<{ctx: object, calls: object[], store: object, transport: object}>}
 */
export async function adapterCtx({ settings, secrets, data, seed = 42, now = Date.UTC(2026, 10, 11, 12), extraRoutes = [] } = {}) {
  const clock = fakeClock(now);
  const store = await openStore(memoryBackend());
  const calls = [];
  const transport = {
    async fetch(url, init = {}) {
      calls.push({ url, method: init.method ?? 'GET', headers: headersOf(init), body: init.body });
      const entry = [...extraRoutes, ...routes].find(route => route.match.test(url));
      if (!entry) throw new TypeError(`unmatched ${url}`);
      if (entry.error) throw new TypeError('Failed to fetch');
      if (entry.hang) {
        await new Promise((resolve, reject) => {
          if (init.signal?.aborted) return reject(abortError());
          init.signal?.addEventListener('abort', () => reject(abortError()), { once: true });
        });
      }
      return responseFor(entry);
    },
  };
  const http = createHttp({ transport, clock });
  for (const [id, adapter] of Object.entries(SOURCES)) {
    if (!SELF_PACED.has(id)) http.register(id, adapter.rate);
  }
  const ctx = {
    http,
    rand: mulberry32(seed),
    clock,
    cache: createCache(store, clock),
    settings: settings ?? structuredClone(DEFAULT_SETTINGS),
    secrets: memorySecrets(secrets),
    data: { tags: JSON.parse(readFileSync(TAGS_FILE, 'utf8')), ...data },
    platformName: 'pwa',
    caps: { ...PWA_CAPS },
    dataUrl: file => 'data/' + file,
  };
  return { ctx, calls, store, transport };
}
