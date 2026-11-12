/** The named stores that make up Byways' one database. */
export const STORE_NAMES = ['settings', 'taste', 'collections', 'history', 'seen', 'cache', 'aiCache', 'usage', 'health', 'keys'];

/**
 * Open a backend and return the store API. A backend is
 * {open(names) → Promise<{get, put, delete, getAll, keys, clear}>}; every method here
 * rejects for a store name outside STORE_NAMES before reaching the backend.
 */
export async function openStore(backend) {
  const raw = await backend.open(STORE_NAMES);
  const guarded = method => async (store, ...args) => {
    if (!STORE_NAMES.includes(store)) throw new Error(`unknown store: ${store}`);
    return raw[method](store, ...args);
  };
  return {
    get: guarded('get'),
    put: guarded('put'),
    delete: guarded('delete'),
    getAll: guarded('getAll'),
    keys: guarded('keys'),
    clear: guarded('clear'),
  };
}

const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** A backend that keeps everything in memory, cloning values on the way in and out. */
export function memoryBackend() {
  return {
    async open(names) {
      const stores = new Map(names.map(n => [n, new Map()]));
      return {
        async get(store, key) {
          const v = stores.get(store).get(key);
          return v === undefined ? undefined : structuredClone(v);
        },
        async put(store, key, value) { stores.get(store).set(key, structuredClone(value)); },
        async delete(store, key) { stores.get(store).delete(key); },
        async getAll(store) {
          return [...stores.get(store)]
            .sort(([a], [b]) => byKey(a, b))
            .map(([key, value]) => ({ key, value: structuredClone(value) }));
        },
        async keys(store) { return [...stores.get(store).keys()].sort(byKey); },
        async clear(store) { stores.get(store).clear(); },
      };
    },
  };
}

const unavailable = () => new Error('IndexedDB is not available');

/** A backend on IndexedDB: one database, version 1, one out-of-line-key object store per name. */
export function idbBackend(dbName = 'byways') {
  return {
    open(names) {
      return new Promise((resolve, reject) => {
        let request;
        try {
          // Read the global here: some browsers throw from the getter itself.
          const idb = globalThis.indexedDB;
          if (!idb) throw unavailable();
          request = idb.open(dbName, 1);
        } catch {
          reject(unavailable());
          return;
        }
        request.onupgradeneeded = () => {
          const db = request.result;
          for (const n of names) if (!db.objectStoreNames.contains(n)) db.createObjectStore(n);
        };
        request.onerror = () => reject(unavailable());
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => db.close();
          resolve(idbStores(db));
        };
      });
    },
  };
}

/** Run one request in its own transaction and resolve with its result. */
function run(db, store, mode, action) {
  return new Promise((resolve, reject) => {
    const req = action(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbStores(db) {
  return {
    get: (store, key) => run(db, store, 'readonly', s => s.get(key)),
    put: async (store, key, value) => { await run(db, store, 'readwrite', s => s.put(value, key)); },
    delete: async (store, key) => { await run(db, store, 'readwrite', s => s.delete(key)); },
    keys: (store) => run(db, store, 'readonly', s => s.getAllKeys()),
    clear: async (store) => { await run(db, store, 'readwrite', s => s.clear()); },
    getAll(store) {
      return new Promise((resolve, reject) => {
        const s = db.transaction(store, 'readonly').objectStore(store);
        const keysReq = s.getAllKeys();
        const valuesReq = s.getAll();
        valuesReq.onsuccess = () => resolve(keysReq.result.map((key, i) => ({ key, value: valuesReq.result[i] })));
        keysReq.onerror = valuesReq.onerror = () => reject(keysReq.error || valuesReq.error);
      });
    },
  };
}
