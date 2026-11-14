import { makeFind } from '../model/find.js';
import { cachedJson } from './cached.js';

const ID = 'nasaimages';
const TAGS = ['space'];
const API = 'https://images-api.nasa.gov/search';
const WORDS = ['nebula', 'aurora', 'rover', 'launch', 'galaxy', 'eclipse', 'saturn', 'apollo', 'comet', 'earth'];
const MAX_PAGE = 5;

const text = value => (typeof value === 'string' ? value.trim() : '');

function image(item) {
  const data = item?.data?.[0];
  if (!data || typeof data !== 'object') return null;
  const nasaId = text(data.nasa_id);
  if (!nasaId) return null;
  const center = text(data.center);
  const created = text(data.date_created);
  return makeFind({
    id: 'nasa:' + nasaId,
    source: ID,
    kind: 'image',
    title: data.title,
    description: data.description,
    url: `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}`,
    imageUrl: item.links?.[0]?.href,
    attribution: center ? `NASA ${center}` : 'NASA',
    licence: 'Public domain (NASA)',
    tags: TAGS,
    why: ['NASA Images'],
    safety: nasaimages.safety,
    meta: created ? { published: created.slice(0, 10) } : undefined,
  });
}

const finds = body => (Array.isArray(body?.collection?.items) ? body.collection.items : []).map(image).filter(Boolean);

function searchUrl(q, page) {
  const params = new URLSearchParams({ q, media_type: 'image', page_size: '20' });
  if (page !== undefined) params.set('page', String(page));
  return `${API}?${params}`;
}

const nasaimages = {
  id: ID,
  name: 'NASA Images',
  tier: 'probe',
  key: 'none',
  safety: 'curated',
  rate: { perMinute: 30, concurrent: 1 },
  fate: false,
  kinds: ['image'],
  tags: TAGS,
  probeUrl: `${API}?q=moon&media_type=image&page_size=1`,

  async random(ctx) {
    const word = WORDS[Math.floor(ctx.rand() * WORDS.length)];
    const page = 1 + Math.floor(ctx.rand() * MAX_PAGE);
    return finds(await ctx.http.getJson(searchUrl(word, page), { source: ID }));
  },

  async search(q, ctx) {
    return finds(await cachedJson(ctx, ID, searchUrl(q)));
  },

  async more() {
    return [];
  },
};

export default nasaimages;
