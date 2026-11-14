import { realClock } from './util/clock.js';
import { hash64 } from './util/hash.js';
import { normalizeUrl } from './util/url.js';

const STORE = 'seen';

/** The set of urls already shown, keyed by the hash of the normalized url. */
export function createSeen(store) {
  const keyOf = url => {
    const normalized = normalizeUrl(url);
    return normalized === null ? null : hash64(normalized);
  };
  return {
    async has(url) {
      const key = keyOf(url);
      return key !== null && (await store.get(STORE, key)) !== undefined;
    },
    async add(url) {
      const key = keyOf(url);
      if (key !== null) await store.put(STORE, key, { t: realClock.now() });
    },
    async count() {
      return (await store.keys(STORE)).length;
    },
    async reset() {
      await store.clear(STORE);
    },
  };
}
