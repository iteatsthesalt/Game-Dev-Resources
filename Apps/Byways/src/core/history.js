import { realClock } from './util/clock.js';
import { domainOf } from './util/url.js';

const STORE = 'history';
const KEY = 'trail';

/** Merge two item lists by find id (the later t wins), oldest first, keeping the last `max`. */
function mergeItems(stored, own, max) {
  const byId = new Map();
  for (const item of [...stored, ...own]) {
    const existing = byId.get(item.find.id);
    if (existing === undefined || item.t >= existing.t) {
      byId.delete(item.find.id); // re-insert so ties keep the newer arrival last
      byId.set(item.find.id, item);
    }
  }
  return [...byId.values()].sort((a, b) => a.t - b.t).slice(-max);
}

/**
 * The Back/Forward trail of Finds shown. The trail is persisted under 'trail'; the cursor lives
 * in memory. Writes are chained so they land in order, and each one merges with whatever other
 * engines have stored since, so one history never overwrites another's finds.
 */
export function createHistory(store, { max = 50, clock = realClock } = {}) {
  let items = [];
  let cursor = -1;
  let writes = Promise.resolve();

  const isItem = x => x !== null && typeof x === 'object' && x.find !== null && typeof x.find === 'object'
    && typeof x.find.id === 'string' && typeof x.t === 'number';

  async function load() {
    await writes; // see merging writes that are still in flight
    const stored = await store.get(STORE, KEY);
    items = Array.isArray(stored?.items) ? stored.items.filter(isItem).slice(-max) : [];
    cursor = items.length - 1;
  }

  function persist(own) {
    writes = writes.then(async () => {
      const stored = await store.get(STORE, KEY);
      const storedItems = Array.isArray(stored?.items) ? stored.items.filter(isItem) : [];
      await store.put(STORE, KEY, { items: mergeItems(storedItems, own, max) });
    }).catch(() => {}); // a failed write must not break the chain or surface as an unhandled rejection
  }

  const findAt = i => (items[i] ? items[i].find : null);

  return {
    ready: load(),
    push(find) {
      items = [...items.slice(0, cursor + 1), { find, t: clock.now() }].slice(-max);
      cursor = items.length - 1;
      persist(items.slice());
    },
    back() {
      if (cursor <= 0) return null;
      cursor -= 1;
      return findAt(cursor);
    },
    forward() {
      if (cursor >= items.length - 1) return null;
      cursor += 1;
      return findAt(cursor);
    },
    current: () => findAt(cursor),
    list: () => items.map(item => item.find),
    recentDomains(n) {
      const domains = [];
      for (let i = cursor; i >= 0 && domains.length < n; i -= 1) {
        const domain = domainOf(items[i].find.url);
        if (domain !== '' && !domains.includes(domain)) domains.push(domain);
      }
      return domains;
    },
    reload: load,
  };
}
