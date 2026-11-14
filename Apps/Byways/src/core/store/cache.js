const STORE = 'cache';

/**
 * A TTL cache over the `cache` store. Entries are {value, expires}; one with
 * expires <= clock.now() is expired. Time is read only through clock.now().
 */
export function createCache(store, clock) {
  const isExpired = entry => entry.expires <= clock.now();
  return {
    async get(key) {
      const entry = await store.get(STORE, key);
      if (entry === undefined) return undefined;
      if (isExpired(entry)) {
        await store.delete(STORE, key);
        return undefined;
      }
      return entry.value;
    },
    async set(key, value, ttlMs) {
      await store.put(STORE, key, { value, expires: clock.now() + ttlMs });
    },
    /** Delete every expired entry and return how many were removed. */
    async purgeExpired() {
      let removed = 0;
      for (const { key, value } of await store.getAll(STORE)) {
        if (isExpired(value)) { await store.delete(STORE, key); removed++; }
      }
      return removed;
    },
  };
}
