import { makeFind } from '../model/find.js';
import { cachedJson } from './cached.js';

const ID = 'smithsonian';
const TAGS = ['history'];
const API = 'https://api.si.edu/openaccess/api/v1.0/search';
const KEY_NAME = 'src:datagov';
const WORDS = ['quilt', 'fossil', 'meteorite', 'toy', 'clock', 'mask', 'telescope', 'shell', 'banjo', 'kite'];
const MAX_START = 200;

const text = value => (typeof value === 'string' ? value.trim() : '');

function object(row) {
  const info = row?.content?.descriptiveNonRepeating;
  if (!info || typeof info !== 'object') return null;
  // Only CC0 objects get their picture shown; the rest keep a link and the generated image.
  const open = info.metadata_usage?.access === 'CC0';
  return makeFind({
    source: ID,
    kind: 'image',
    title: row.title,
    url: info.record_link,
    imageUrl: open ? info.online_media?.media?.[0]?.thumbnail : undefined,
    attribution: text(info.data_source),
    licence: open ? 'CC0' : undefined,
    tags: TAGS,
    why: ['Smithsonian Open Access'],
    safety: smithsonian.safety,
  });
}

const finds = body => (Array.isArray(body?.response?.rows) ? body.response.rows : []).map(object).filter(Boolean);
/** The shape finds() relies on: a reply without it is not cached. */
const isReply = body => Array.isArray(body?.response?.rows);

function searchUrl(q, key, start) {
  const params = new URLSearchParams({ q, rows: '20', api_key: key });
  if (start !== undefined) params.set('start', String(start));
  return `${API}?${params}`;
}

/** The api.data.gov key, or '' when none is saved. The key is required, so a source without one stays silent. */
async function keyOf(ctx) {
  return text(await ctx.secrets.get(KEY_NAME));
}

const smithsonian = {
  id: ID,
  name: 'Smithsonian',
  tier: 'probe',
  key: 'required',
  keyName: KEY_NAME,
  safety: 'curated',
  rate: { perMinute: 30, concurrent: 1 },
  fate: true,
  kinds: ['image'],
  tags: TAGS,
  probeUrl: `${API}?q=quilt&rows=1&api_key=DEMO_KEY`,

  async random(ctx) {
    const key = await keyOf(ctx);
    if (!key) return [];
    const word = WORDS[Math.floor(ctx.rand() * WORDS.length)];
    const start = Math.floor(ctx.rand() * MAX_START);
    return finds(await ctx.http.getJson(searchUrl(word, key, start), { source: ID }));
  },

  async search(q, ctx) {
    const key = await keyOf(ctx);
    if (!key) return [];
    return finds(await cachedJson(ctx, ID, searchUrl(q, key), { accept: isReply }));
  },

  async more() {
    return [];
  },
};

export default smithsonian;
