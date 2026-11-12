import { makeFind } from '../model/find.js';
import { cachedJson } from './cached.js';

const ID = 'cleveland';
const TAGS = ['art'];
const API = 'https://openaccess-api.clevelandart.org/api/artworks/';
const TOTAL_KEY = 'cleveland:total';
const TOTAL_TTL_MS = 7 * 24 * 3600e3;

const text = value => (typeof value === 'string' ? value.trim() : '');

function artwork(item) {
  if (!item || typeof item !== 'object' || item.share_license_status !== 'CC0') return null;
  if (typeof item.id !== 'string' && typeof item.id !== 'number') return null;
  const creator = text(item.creators?.[0]?.description);
  return makeFind({
    id: 'cma:' + item.id,
    source: ID,
    kind: 'image',
    title: item.title,
    description: [creator, text(item.creation_date)].filter(Boolean).join(', '),
    url: item.url,
    imageUrl: item.images?.web?.url,
    author: creator,
    licence: 'CC0',
    tags: TAGS,
    why: ['Cleveland Museum of Art'],
    safety: cleveland.safety,
  });
}

const finds = body => (Array.isArray(body?.data) ? body.data : []).map(artwork).filter(Boolean);

function artworksUrl(params) {
  return `${API}?${new URLSearchParams({ cc: '1', has_image: '1', ...params })}`;
}

/** info.total of the CC0 collection with images, read once a week. */
async function total(ctx) {
  const known = await ctx.cache.get(TOTAL_KEY);
  if (known !== undefined) return known;
  const body = await ctx.http.getJson(artworksUrl({ limit: '1' }), { source: ID });
  const count = Number.isFinite(body?.info?.total) ? body.info.total : 0;
  await ctx.cache.set(TOTAL_KEY, count, TOTAL_TTL_MS);
  return count;
}

const cleveland = {
  id: ID,
  name: 'Cleveland Museum of Art',
  tier: 'probe',
  key: 'none',
  safety: 'curated',
  rate: { perMinute: 60, concurrent: 1 },
  fate: true,
  kinds: ['image'],
  tags: TAGS,
  probeUrl: `${API}?limit=1`,

  async random(ctx) {
    const count = await total(ctx);
    if (count < 1) return [];
    const skip = Math.floor(ctx.rand() * count);
    return finds(await ctx.http.getJson(artworksUrl({ limit: '10', skip: String(skip) }), { source: ID }));
  },

  async search(q, ctx) {
    return finds(await cachedJson(ctx, ID, artworksUrl({ q, limit: '20' })));
  },

  async more() {
    return [];
  },
};

export default cleveland;
