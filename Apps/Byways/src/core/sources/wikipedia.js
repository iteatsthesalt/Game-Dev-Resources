import { makeFind } from '../model/find.js';
import { IDENT } from './index.js';

const ID = 'wikipedia';
const TAGS = ['education'];
const LICENCE = 'CC BY-SA 4.0';
const API = 'https://en.wikipedia.org/w/api.php';
const RANDOM_URL = 'https://en.wikipedia.org/api/rest_v1/page/random/summary';

// IDENT is read here, inside a function, because index.js imports this module (an import cycle).
const getJson = (ctx, url) => ctx.http.getJson(url, { source: ID, headers: { 'Api-User-Agent': IDENT } });

function article({ id, title, description, url, imageUrl, why }) {
  return makeFind({
    id,
    source: ID,
    kind: 'article',
    title,
    description,
    url,
    imageUrl,
    tags: TAGS,
    why: [why],
    safety: wikipedia.safety,
    licence: LICENCE,
    attribution: 'Wikipedia',
  });
}

/** The article ids use the canonical title: spaces become underscores. */
const idOf = title => 'wiki:en:' + String(title).replaceAll(' ', '_');

async function query(text, why, ctx) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: text,
    gsrlimit: '10',
    prop: 'pageimages|extracts|info',
    inprop: 'url',
    piprop: 'thumbnail',
    pithumbsize: '640',
    exintro: '1',
    explaintext: '1',
    exlimit: '10',
    format: 'json',
    origin: '*',
  });
  const body = await getJson(ctx, `${API}?${params}`);
  const pages = body?.query?.pages;
  if (!pages || typeof pages !== 'object') return [];
  return Object.values(pages)
    .filter(page => page && typeof page.title === 'string')
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map(page => article({
      id: idOf(page.title),
      title: page.title,
      description: page.extract,
      url: page.fullurl,
      imageUrl: page.thumbnail?.source,
      why,
    }))
    .filter(Boolean);
}

const wikipedia = {
  id: ID,
  name: 'Wikipedia',
  tier: 'open',
  key: 'none',
  safety: 'mostly',
  rate: { perMinute: 10, concurrent: 1 },
  fate: true,
  kinds: ['article'],
  tags: TAGS,

  async random(ctx) {
    const summary = await getJson(ctx, RANDOM_URL);
    if (!summary || typeof summary !== 'object' || summary.type === 'disambiguation') return [];
    const canonical = summary.titles?.canonical;
    if (typeof canonical !== 'string' || !canonical) return [];
    const find = article({
      id: idOf(canonical),
      title: summary.titles.normalized ?? summary.title,
      description: summary.extract,
      url: summary.content_urls?.desktop?.page,
      imageUrl: summary.thumbnail?.source,
      why: 'Wikipedia: random article',
    });
    return find ? [find] : [];
  },

  search: (q, ctx) => query(q, 'Wikipedia search', ctx),

  more: (find, ctx) => query(`morelike:${find.title}`, `Wikipedia: more like ${find.title}`, ctx),
};

export default wikipedia;
