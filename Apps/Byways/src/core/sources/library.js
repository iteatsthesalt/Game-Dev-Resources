import { makeFind } from '../model/find.js';
import { similarLocal } from '../rabbit.js';
import { tokenize } from '../util/text.js';
import { utcDate } from '../util/clock.js';

const ID = 'library';
const SEARCH_LIMIT = 20;
const MORE_LIMIT = 10;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = { game: 'game', article: 'article' };

// The converted library, per library object and entries array, so a large library is not converted on every call.
const converted = new WeakMap();

function convert(entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.added !== 'string' || !DATE.test(entry.added)) return null;
  if (typeof entry.id !== 'string' && typeof entry.id !== 'number') return null;
  const tags = Array.isArray(entry.tags) ? entry.tags : [];
  const find = makeFind({
    id: `lib:${entry.id}`,
    source: ID,
    kind: KINDS[entry.kind] ?? 'site',
    title: entry.title,
    description: entry.blurb,
    url: entry.url,
    tags,
    why: ['Starter library'],
    safety: library.safety,
    meta: { libraryKind: entry.kind, published: entry.added },
  });
  if (!find) return null;
  const words = new Set(tokenize([entry.title, entry.blurb, ...tags.filter(tag => typeof tag === 'string')].join(' ')));
  return { added: entry.added, find, words };
}

function load(ctx) {
  const lib = ctx.data?.library;
  const entries = lib?.entries;
  if (!lib || typeof lib !== 'object' || !Array.isArray(entries)) return [];
  const hit = converted.get(lib);
  if (hit?.entries === entries) return hit.items;
  const items = entries.map(convert).filter(Boolean);
  converted.set(lib, { entries, items });
  return items;
}

// Entries added today or earlier; the date moves, so this is never cached.
function counted(ctx) {
  const today = utcDate(ctx.clock.now());
  return load(ctx).filter(item => item.added <= today);
}

// A copy, so a caller that changes a find never changes the cached one.
const fresh = ({ find }) => ({ ...find, tags: [...find.tags], why: [...find.why], meta: { ...find.meta } });

function shuffle(list, rand) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const library = {
  id: ID,
  name: 'Starter library',
  tier: 'open',
  key: 'none',
  safety: 'curated',
  rate: { perMinute: 600, concurrent: 4 },
  fate: true,
  kinds: ['site', 'game', 'article'],
  tags: [],

  // Every counted entry, shuffled: it is local and costs no quota, and a sample could miss entries the user has not seen.
  async random(ctx) {
    return shuffle(counted(ctx).map(fresh), ctx.rand);
  },

  async search(q, ctx) {
    const wanted = tokenize(q);
    if (!wanted.length) return [];
    return counted(ctx).filter(item => wanted.every(word => item.words.has(word))).slice(0, SEARCH_LIMIT).map(fresh);
  },

  async more(find, ctx) {
    const pool = counted(ctx);
    const byId = new Map(pool.map(item => [item.find.id, item]));
    return similarLocal(find, pool.map(item => item.find), MORE_LIMIT).map(match => fresh(byId.get(match.id)));
  },
};

export default library;
