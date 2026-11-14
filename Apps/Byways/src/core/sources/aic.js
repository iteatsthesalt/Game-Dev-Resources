import { makeFind } from '../model/find.js';
import { IDENT } from './ident.js';
import { cachedJson } from './cached.js';
import { text } from './parse.js';

const ID = 'aic';
const TAGS = ['art'];
const API = 'https://api.artic.edu/api/v1/artworks/search';
const MAX_PAGE = 500;

function artwork(item, iiifUrl) {
  if (!item || typeof item !== 'object') return null;
  if (typeof item.id !== 'string' && typeof item.id !== 'number') return null;
  const imageId = text(item.image_id);
  if (!imageId) return null;
  const artist = text(item.artist_display);
  return makeFind({
    id: 'aic:' + item.id,
    source: ID,
    kind: 'image',
    title: item.title,
    description: text(item.thumbnail?.alt_text) || [artist, text(item.date_display)].filter(Boolean).join(', '),
    url: `https://www.artic.edu/artworks/${item.id}`,
    imageUrl: `${iiifUrl}/${imageId}/full/843,/0/default.jpg`,
    author: artist,
    licence: 'Public domain',
    tags: TAGS,
    why: ['Art Institute of Chicago'],
    safety: aic.safety,
  });
}

function finds(body) {
  const iiifUrl = text(body?.config?.iiif_url);
  if (!iiifUrl) return [];
  return (Array.isArray(body.data) ? body.data : []).map(item => artwork(item, iiifUrl)).filter(Boolean);
}

/** The shape finds() relies on: a reply without it is not cached. */
const isReply = body => Array.isArray(body?.data) && Boolean(text(body.config?.iiif_url));

function searchUrl(page, q) {
  const params = new URLSearchParams({
    'query[term][is_public_domain]': 'true',
    fields: 'id,title,image_id,artist_display,date_display,thumbnail',
    limit: '20',
    page: String(page),
  });
  if (q !== undefined) params.set('q', q);
  return `${API}?${params}`;
}

const aic = {
  id: ID,
  name: 'Art Institute of Chicago',
  tier: 'open',
  key: 'none',
  safety: 'curated',
  rate: { perMinute: 60, concurrent: 1 },
  fate: true,
  kinds: ['image'],
  tags: TAGS,

  async random(ctx) {
    const page = 1 + Math.floor(ctx.rand() * MAX_PAGE);
    return finds(await ctx.http.getJson(searchUrl(page), { source: ID, headers: { 'AIC-User-Agent': IDENT } }));
  },

  async search(q, ctx) {
    return finds(await cachedJson(ctx, ID, searchUrl(1, q), { headers: { 'AIC-User-Agent': IDENT }, accept: isReply }));
  },

  async more() {
    return [];
  },
};

export default aic;
