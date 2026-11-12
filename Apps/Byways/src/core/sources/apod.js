import { makeFind } from '../model/find.js';
import { utcDate } from '../util/clock.js';
import { NetError } from '../net/errors.js';

const ID = 'apod';
const TAGS = ['space', 'science'];
const API = 'https://api.nasa.gov/planetary/apod';
const KEY_NAME = 'src:datagov';
const DEMO_KEY = 'DEMO_KEY';
const DAY_MS = 24 * 3600e3;
/** DEMO_KEY allows about 50 requests an hour; the app stops a few short of that for the day. */
const DEMO_LIMIT = 45;
const DEMO_EXHAUSTED = 50;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const clean = text => (typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '');

function item(entry) {
  if (!entry || typeof entry !== 'object' || !DATE.test(entry.date ?? '')) return null;
  const kind = entry.media_type;
  if (kind !== 'image' && kind !== 'video') return null;
  if (kind === 'video' && !entry.thumbnail_url) return null;
  const copyright = clean(entry.copyright);
  // Only a public-domain item gets its picture shown (spec §7.4); a copyrighted one keeps its credit and the generated image.
  const imageUrl = copyright ? undefined : (kind === 'image' ? entry.url : entry.thumbnail_url);
  return makeFind({
    id: 'apod:' + entry.date,
    source: ID,
    kind,
    title: entry.title,
    description: entry.explanation,
    url: `https://apod.nasa.gov/apod/ap${entry.date.slice(2).replaceAll('-', '')}.html`,
    imageUrl,
    author: copyright,
    licence: copyright ? `© ${copyright}` : 'Public domain (NASA)',
    tags: TAGS,
    why: ['NASA APOD'],
    safety: apod.safety,
    meta: { published: entry.date },
  });
}

/** Count one request against today's DEMO_KEY budget. Returns false when the budget is spent. */
async function spendDemoRequest(ctx, countKey) {
  const used = (await ctx.cache.get(countKey)) ?? 0;
  if (used >= DEMO_LIMIT) return false;
  await ctx.cache.set(countKey, used + 1, DAY_MS);
  return true;
}

const apod = {
  id: ID,
  name: 'NASA APOD',
  tier: 'open',
  key: 'demo',
  keyName: KEY_NAME,
  safety: 'curated',
  rate: { perMinute: 2, concurrent: 1 },
  fate: true,
  kinds: ['image', 'video'],
  tags: TAGS,

  async random(ctx) {
    const key = (await ctx.secrets.get(KEY_NAME)) || DEMO_KEY;
    const countKey = `apod:count:${utcDate(ctx.clock.now())}`;
    const demo = key === DEMO_KEY;
    if (demo && !(await spendDemoRequest(ctx, countKey))) return [];
    const params = new URLSearchParams({ api_key: key, count: '10', thumbs: 'true' });
    let body;
    try {
      body = await ctx.http.getJson(`${API}?${params}`, { source: ID });
    } catch (err) {
      if (demo && err instanceof NetError && err.kind === 'http' && err.status === 429) {
        await ctx.cache.set(countKey, DEMO_EXHAUSTED, DAY_MS);
      }
      throw err;
    }
    return (Array.isArray(body) ? body : []).map(item).filter(Boolean);
  },

  async search() {
    return [];
  },

  async more() {
    return [];
  },
};

export default apod;
