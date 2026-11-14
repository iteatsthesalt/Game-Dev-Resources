import { makeFind } from '../model/find.js';
import { domainOf } from '../util/url.js';
import { cachedJson } from './cached.js';

const ID = 'marginalia';
const TAGS = ['web'];
const API = 'https://api2.marginalia-search.com/api/v2';
const KEY_NAME = 'src:marginalia';
const PUBLIC_KEY = 'public';

const list = value => (Array.isArray(value) ? value : []);
const text = value => (typeof value === 'string' && value ? value : undefined);

function site(entry, why, { urlFromDomain = false } = {}) {
  if (!entry || typeof entry !== 'object') return null;
  const domain = text(entry.domain);
  const url = text(entry.url) ?? (urlFromDomain && domain ? `https://${domain}/` : undefined);
  if (!url) return null;
  return makeFind({
    id: 'marginalia:' + url,
    source: ID,
    kind: 'site',
    title: text(entry.title) ?? domain,
    description: entry.description,
    url,
    tags: TAGS,
    why: [why],
    safety: marginalia.safety,
  });
}

// The list a search or similar-sites reply holds; the similar-sites shape is unverified, so either field name counts.
const searchItems = body => body?.results;
const similarItems = body => body?.results ?? body?.similar;

// A reply whose list is missing is not cached (shared adapter rule 12).
async function get(url, ctx, items) {
  const key = (await ctx.secrets.get(KEY_NAME)) || PUBLIC_KEY;
  return items(await cachedJson(ctx, ID, url, { headers: { 'API-Key': key }, accept: body => Array.isArray(items(body)) }));
}

const marginalia = {
  id: ID,
  name: 'Marginalia',
  tier: 'open',
  key: 'optional',
  keyName: KEY_NAME,
  safety: 'mostly',
  rate: { perMinute: 20, concurrent: 1 },
  fate: false,
  kinds: ['site'],
  tags: TAGS,

  async random() {
    return [];
  },

  async search(q, ctx) {
    const params = new URLSearchParams({ query: q, count: '20' });
    const items = await get(`${API}/search?${params}`, ctx, searchItems);
    return list(items).map(entry => site(entry, 'Marginalia search')).filter(Boolean);
  },

  async more(find, ctx) {
    const domain = domainOf(find?.url);
    if (!domain) return [];
    const items = await get(`${API}/site/${encodeURIComponent(domain)}/similar`, ctx, similarItems);
    return list(items).map(entry => site(entry, `Marginalia: similar to ${domain}`, { urlFromDomain: true })).filter(Boolean);
  },
};

export default marginalia;
