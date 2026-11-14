import { makeFind } from '../model/find.js';
import { cachedJson } from './cached.js';

const ID = 'loc';
const TAGS = ['history', 'photography'];
const API = 'https://www.loc.gov/photos/';
const WORDS = ['map', 'poster', 'bicycle', 'lighthouse', 'circus', 'garden', 'bridge', 'train', 'kite', 'harbor'];
const MAX_PAGE = 5;

/**
 * Results carry no open-rights flag, so a Find never gets an imageUrl: the card shows the generated image and
 * links to the item.
 */
function photo(item) {
  if (!item || typeof item !== 'object') return null;
  const note = Array.isArray(item.description) ? item.description[0] : item.description;
  return makeFind({
    source: ID,
    kind: 'image',
    title: item.title,
    description: note,
    url: item.url,
    tags: TAGS,
    why: ['Library of Congress'],
    safety: loc.safety,
  });
}

const finds = body => (Array.isArray(body?.results) ? body.results : []).map(photo).filter(Boolean);

function searchUrl(q, page) {
  return `${API}?${new URLSearchParams({ q, fo: 'json', c: '25', sp: String(page) })}`;
}

const loc = {
  id: ID,
  name: 'Library of Congress',
  tier: 'probe',
  key: 'none',
  safety: 'curated',
  rate: { perMinute: 10, concurrent: 1 },
  fate: false,
  kinds: ['image'],
  tags: TAGS,
  probeUrl: `${API}?q=map&fo=json&c=1`,

  async random(ctx) {
    const word = WORDS[Math.floor(ctx.rand() * WORDS.length)];
    const page = 1 + Math.floor(ctx.rand() * MAX_PAGE);
    // The CAPTCHA page is HTML, so getJson fails to parse it and the error reaches the engine.
    return finds(await ctx.http.getJson(searchUrl(word, page), { source: ID }));
  },

  async search(q, ctx) {
    return finds(await cachedJson(ctx, ID, searchUrl(q, 1)));
  },

  async more() {
    return [];
  },
};

export default loc;
