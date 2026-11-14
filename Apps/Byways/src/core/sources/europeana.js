import { makeFind } from '../model/find.js';
import { cachedJson } from './cached.js';
import { text } from './parse.js';

const ID = 'europeana';
const TAGS = ['culture', 'history'];
const API = 'https://api.europeana.eu/record/v2/search.json';
const KEY_NAME = 'src:europeana';
const WORDS = ['map', 'clock', 'poster', 'bird', 'ship', 'mask', 'garden', 'tile', 'toy', 'letter'];
const MAX_START = 100;

/** Europeana fields are arrays: the first string, or undefined for a missing or oddly shaped field. */
const first = list => (Array.isArray(list) && typeof list[0] === 'string' && list[0].trim() ? list[0] : undefined);

function record(item) {
  if (!item || typeof item !== 'object' || (typeof item.id !== 'string' && typeof item.id !== 'number')) return null;
  const provider = first(item.dataProvider);
  return makeFind({
    id: 'eu:' + item.id,
    source: ID,
    kind: 'image',
    title: first(item.title),
    description: first(item.dcDescription),
    url: first(item.edmIsShownAt) || item.guid,
    imageUrl: first(item.edmPreview),
    licence: first(item.rights),
    attribution: provider ? `${provider} via Europeana` : undefined,
    tags: TAGS,
    why: ['Europeana'],
    safety: europeana.safety,
  });
}

const finds = body => (Array.isArray(body?.items) ? body.items : []).map(record).filter(Boolean);
/** The shape finds() relies on: a reply without it is not cached. */
const isReply = body => Array.isArray(body?.items);

function searchUrl(q, start) {
  const params = new URLSearchParams({ query: q, reusability: 'open', media: 'true', rows: '20' });
  if (start !== undefined) params.set('start', String(start));
  return `${API}?${params}`;
}

/** The key, or '' when none is saved. The key is required, so a source without one stays silent. */
async function keyOf(ctx) {
  return text(await ctx.secrets.get(KEY_NAME));
}

const europeana = {
  id: ID,
  name: 'Europeana',
  tier: 'open',
  key: 'required',
  keyName: KEY_NAME,
  safety: 'mostly',
  rate: { perMinute: 30, concurrent: 1 },
  fate: false,
  kinds: ['image'],
  tags: TAGS,

  async random(ctx) {
    const key = await keyOf(ctx);
    if (!key) return [];
    const word = WORDS[Math.floor(ctx.rand() * WORDS.length)];
    const start = 1 + Math.floor(ctx.rand() * MAX_START);
    return finds(await ctx.http.getJson(searchUrl(word, start), { source: ID, headers: { 'X-Api-Key': key } }));
  },

  async search(q, ctx) {
    const key = await keyOf(ctx);
    if (!key) return [];
    return finds(await cachedJson(ctx, ID, searchUrl(q), { headers: { 'X-Api-Key': key }, accept: isReply }));
  },

  async more() {
    return [];
  },
};

export default europeana;
