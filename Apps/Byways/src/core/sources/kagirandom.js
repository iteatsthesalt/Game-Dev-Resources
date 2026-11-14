import { makeFind } from '../model/find.js';
import { isHttpUrl } from '../util/url.js';

const ID = 'kagirandom';
const TAGS = ['web', 'essays'];
const API = 'https://kagi.com/smallweb/api/random';

const text = value => (typeof value === 'string' && value ? value : undefined);

// The category names that are tag ids in the tag vocabulary, in the reply's order.
function knownTags(categories, vocabulary) {
  if (!Array.isArray(categories) || !Array.isArray(vocabulary?.groups)) return [];
  const ids = new Set(vocabulary.groups.flatMap(group => (Array.isArray(group?.tags) ? group.tags : [])).map(tag => tag?.id));
  return categories.filter(category => typeof category === 'string' && ids.has(category));
}

const kagirandom = {
  id: ID,
  name: 'Kagi Small Web random',
  tier: 'probe',
  key: 'none',
  safety: 'curated',
  rate: { perMinute: 20, concurrent: 1 },
  fate: true,
  kinds: ['site'],
  tags: TAGS,
  probeUrl: API,

  async random(ctx) {
    const body = await ctx.http.getJson(API, { source: ID });
    const url = text(body?.url);
    if (!url || !isHttpUrl(url)) return [];
    const known = knownTags(body.categories, ctx.data?.tags);
    const find = makeFind({
      id: `kagirandom:${url}`,
      source: ID,
      kind: 'site',
      title: text(body.title) ?? text(body.domain),
      url,
      author: text(body.author),
      tags: known.length ? known : TAGS,
      why: ['Kagi Small Web: random'],
      safety: kagirandom.safety,
    });
    return find ? [find] : [];
  },

  async search() {
    return [];
  },

  async more() {
    return [];
  },
};

export default kagirandom;
