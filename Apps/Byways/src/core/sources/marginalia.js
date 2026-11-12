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

async function get(url, ctx) {
  const key = (await ctx.secrets.get(KEY_NAME)) || PUBLIC_KEY;
  return cachedJson(ctx, ID, url, { headers: { 'API-Key': key } });
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
    const body = await get(`${API}/search?${params}`, ctx);
    return list(body?.results).map(entry => site(entry, 'Marginalia search')).filter(Boolean);
  },

  async more(find, ctx) {
    const domain = domainOf(find?.url);
    if (!domain) return [];
    // The reply shape of the similar-sites endpoint is unverified, so accept either field name.
    const body = await get(`${API}/site/${encodeURIComponent(domain)}/similar`, ctx);
    const items = list(body?.results ?? body?.similar);
    return items.map(entry => site(entry, `Marginalia: similar to ${domain}`, { urlFromDomain: true })).filter(Boolean);
  },
};

export default marginalia;
