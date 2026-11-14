import { makeFind } from '../model/find.js';
import { cachedJson } from './cached.js';

const ID = 'met';
const TAGS = ['art', 'history'];
const API = 'https://collectionapi.metmuseum.org/public/collection';
const SEARCH = `${API}/v1.1/search`;
const TOTAL_KEY = 'met:total';
const MAX_OFFSET_RANGE = 10000;
const DAY_MS = 24 * 3600e3;
const OBJECT_TTL_MS = 7 * DAY_MS;

const text = value => (typeof value === 'string' ? value.trim() : '');

const isId = value => typeof value === 'number' || typeof value === 'string';
/** A search reply worth keeping: a list of object ids, or a total of 0 (the Met answers no hits with objectIDs null). */
const isSearchReply = body => Array.isArray(body?.objectIDs) || body?.total === 0;
/** An object lookup worth keeping: one with an object id, which objectFind() relies on. */
const isObjectReply = body => isId(body?.objectID);

function searchUrl(params) {
  return `${SEARCH}?${new URLSearchParams({ hasImages: 'true', isPublicDomain: 'true', ...params })}`;
}

function objectFind(item) {
  if (!item || typeof item !== 'object' || item.isPublicDomain !== true) return null;
  if (!isId(item.objectID)) return null;
  const imageUrl = text(item.primaryImageSmall);
  if (!imageUrl) return null;
  const artist = text(item.artistDisplayName);
  return makeFind({
    id: 'met:' + item.objectID,
    source: ID,
    kind: 'image',
    title: item.title,
    description: [artist, text(item.objectDate)].filter(Boolean).join(', '),
    url: item.objectURL,
    imageUrl,
    author: artist,
    licence: 'Public domain',
    tags: TAGS,
    why: ['The Met'],
    safety: met.safety,
  });
}

async function objects(ctx, ids) {
  const list = (Array.isArray(ids) ? ids : []).filter(isId);
  // One stale id (a 404) must not sink the others, so each lookup settles on its own and failures are dropped.
  const lookup = id => cachedJson(ctx, ID, `${API}/v1/objects/${encodeURIComponent(id)}`, { ttlMs: OBJECT_TTL_MS, accept: isObjectReply });
  const settled = await Promise.allSettled(list.map(lookup));
  return settled.filter(result => result.status === 'fulfilled').map(result => objectFind(result.value)).filter(Boolean);
}

/** The size of the public-domain collection with images, read once a day. */
async function total(ctx) {
  const known = await ctx.cache.get(TOTAL_KEY);
  if (known !== undefined) return known;
  const body = await ctx.http.getJson(searchUrl({ limit: '1', offset: '0' }), { source: ID });
  const count = body?.total;
  // A reply without a usable total is not remembered, so the next call asks again.
  if (!Number.isFinite(count) || count <= 0) return 0;
  await ctx.cache.set(TOTAL_KEY, count, DAY_MS);
  return count;
}

const met = {
  id: ID,
  name: 'The Met',
  tier: 'probe',
  key: 'none',
  safety: 'curated',
  rate: { perMinute: 60, concurrent: 2 },
  fate: true,
  kinds: ['image'],
  tags: TAGS,
  probeUrl: `${API}/v1/objects/436535`,

  async random(ctx) {
    const count = Math.min(await total(ctx), MAX_OFFSET_RANGE);
    if (count < 1) return [];
    const offset = Math.floor(ctx.rand() * count);
    const body = await ctx.http.getJson(searchUrl({ limit: '1', offset: String(offset) }), { source: ID });
    return objects(ctx, body?.objectIDs);
  },

  async search(q, ctx) {
    const body = await cachedJson(ctx, ID, searchUrl({ q, limit: '5' }), { accept: isSearchReply });
    return objects(ctx, body?.objectIDs);
  },

  async more() {
    return [];
  },
};

export default met;
