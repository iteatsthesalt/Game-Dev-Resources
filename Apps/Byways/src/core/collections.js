const STORE = 'collections';
const CURRENT_KEY = '@current';
const SAVED = 'saved';

const isCollectionKey = key => !key.startsWith('@');
const SAVED_EMPTY = () => ({ id: SAVED, name: 'Saved', created: 0, items: [] });

function cleanName(name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('Give the collection a name.');
  return trimmed;
}

/**
 * The user's collections. Saved is always there and comes first; the rest follow in the order they
 * were made. Records live in the 'collections' store; keys starting with '@' hold settings, not collections.
 */
export function createCollections(store, clock) {
  const get = async id => {
    if (typeof id !== 'string' || !isCollectionKey(id)) return null;
    const record = await store.get(STORE, id);
    if (record !== undefined) return record;
    return id === SAVED ? SAVED_EMPTY() : null;
  };

  const list = async () => {
    const records = (await store.getAll(STORE)).filter(row => isCollectionKey(row.key)).map(row => row.value);
    const saved = records.find(r => r.id === SAVED) ?? SAVED_EMPTY();
    const others = records.filter(r => r.id !== SAVED).sort((a, b) => a.created - b.created);
    return [saved, ...others];
  };

  return {
    list,
    get,

    async create(name) {
      const clean = cleanName(name);
      const taken = new Set((await list()).map(r => r.id));
      const stamp = clock.now();
      let n = taken.size;
      while (taken.has('c-' + stamp.toString(36) + '-' + n)) n++;
      const record = { id: 'c-' + stamp.toString(36) + '-' + n, name: clean, created: stamp, items: [] };
      await store.put(STORE, record.id, record);
      return record;
    },

    async rename(id, name) {
      const clean = cleanName(name);
      if (id === SAVED) throw new Error('Saved cannot be renamed.');
      const record = await get(id);
      if (record === null) return;
      await store.put(STORE, id, { ...record, name: clean });
    },

    async remove(id) {
      if (id === SAVED) throw new Error('Saved cannot be deleted.');
      if (typeof id !== 'string' || !isCollectionKey(id)) return;
      await store.delete(STORE, id);
      if ((await store.get(STORE, CURRENT_KEY)) === id) await store.delete(STORE, CURRENT_KEY);
    },

    async add(id, find) {
      const record = await get(id);
      if (record === null || record.items.some(item => item.find.id === find.id)) return false;
      record.items.push({ find, added: clock.now() });
      await store.put(STORE, id, record);
      return true;
    },

    async removeItem(id, findId) {
      const record = await get(id);
      if (record === null) return;
      const items = record.items.filter(item => item.find.id !== findId);
      if (items.length !== record.items.length) await store.put(STORE, id, { ...record, items });
    },

    async has(findId) {
      return (await list()).filter(r => r.items.some(item => item.find.id === findId)).map(r => r.id);
    },

    async getCurrent() {
      const id = await store.get(STORE, CURRENT_KEY);
      return typeof id === 'string' && (await get(id)) !== null ? id : SAVED;
    },

    async setCurrent(id) {
      await store.put(STORE, CURRENT_KEY, id);
    },
  };
}
