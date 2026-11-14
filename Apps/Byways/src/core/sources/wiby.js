import { makeFind } from '../model/find.js';
import { isHttpUrl } from '../util/url.js';
import { SEARCH_TTL_MS } from './cached.js';

const ID = 'wiby';
const TAGS = ['oldweb', 'web'];
const API = 'https://wiby.me/json/';

/** The Wiby surprise page, opened by navigation only for the Wiby leap button. */
export const WIBY_LEAP_URL = 'https://wiby.me/surprise/';

function page(entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.URL !== 'string' || !isHttpUrl(entry.URL)) return null;
  return makeFind({
    id: `wiby:${entry.URL}`,
    source: ID,
    kind: 'site',
    title: entry.Title,
    description: entry.Snippet,
    url: entry.URL,
    tags: TAGS,
    why: ['Wiby search'],
    safety: wiby.safety,
  });
}

// A reply is kept for a day only when it holds results, so a busy or odd reply is asked for again next time.
async function results(ctx, url) {
  const hit = await ctx.cache.get(url);
  if (hit !== undefined) return hit;
  const body = await ctx.http.getJson(url, { source: ID });
  if (!Array.isArray(body) || !body.length) return [];
  await ctx.cache.set(url, body, SEARCH_TTL_MS);
  return body;
}

const wiby = {
  id: ID,
  name: 'Wiby',
  tier: 'probe',
  key: 'none',
  safety: 'curated',
  rate: { perMinute: 10, concurrent: 1 },
  fate: false,
  kinds: ['site'],
  tags: TAGS,
  probeUrl: `${API}?q=games`,

  async random() {
    return [];
  },

  async search(q, ctx) {
    const entries = await results(ctx, `${API}?${new URLSearchParams({ q })}`);
    return entries.map(page).filter(Boolean);
  },

  async more() {
    return [];
  },
};

export default wiby;
