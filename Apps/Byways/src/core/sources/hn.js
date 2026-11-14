import { makeFind } from '../model/find.js';
import { toPlainText } from '../util/text.js';
import { utcDate } from '../util/clock.js';
import { cachedJson } from './cached.js';
import { list } from './parse.js';

const ID = 'hn';
const TAGS = ['tech', 'indie'];
const API = 'https://hn.algolia.com/api/v1';
const WINDOW_S = 30 * 86400;
const SPAN_S = 3 * 365 * 86400;
const SHOW_HN = /^\s*Show HN:\s*/i;

const count = value => (Number.isFinite(value) ? value : 0);

function story(hit) {
  if (!hit || typeof hit !== 'object') return null;
  const objectID = typeof hit.objectID === 'string' || typeof hit.objectID === 'number' ? String(hit.objectID) : '';
  if (!objectID || typeof hit.title !== 'string') return null;
  const title = hit.title.replace(SHOW_HN, '');
  const points = count(hit.points);
  const text = typeof hit.story_text === 'string' ? toPlainText(hit.story_text) : '';
  return makeFind({
    id: 'hn:' + objectID,
    source: ID,
    kind: /\bgame\b/i.test(title) ? 'game' : 'project',
    title,
    description: text || `${points} points · ${count(hit.num_comments)} comments on Hacker News`,
    url: hit.url || `https://news.ycombinator.com/item?id=${objectID}`,
    tags: TAGS,
    why: ['Show HN', `${points} points`],
    safety: hn.safety,
    meta: Number.isFinite(hit.created_at_i) ? { published: utcDate(hit.created_at_i * 1000) } : undefined,
  });
}

const stories = body => list(body?.hits).map(story).filter(Boolean);
/** The shape stories() relies on: a reply without it is not cached. */
const isReply = body => Array.isArray(body?.hits);

const hn = {
  id: ID,
  name: 'Show HN',
  tier: 'probe',
  key: 'none',
  safety: 'mostly',
  rate: { perMinute: 60, concurrent: 2 },
  fate: false,
  kinds: ['project', 'game'],
  tags: TAGS,
  probeUrl: `${API}/search?tags=show_hn&hitsPerPage=1`,

  async random(ctx) {
    const end = Math.floor(ctx.clock.now() / 1000 - ctx.rand() * SPAN_S);
    const params = new URLSearchParams({
      tags: 'show_hn',
      numericFilters: `points>20,created_at_i>${end - WINDOW_S},created_at_i<${end}`,
      hitsPerPage: '20',
    });
    return stories(await ctx.http.getJson(`${API}/search_by_date?${params}`, { source: ID }));
  },

  async search(q, ctx) {
    const params = new URLSearchParams({ tags: 'show_hn', query: q, hitsPerPage: '20' });
    return stories(await cachedJson(ctx, ID, `${API}/search?${params}`, { accept: isReply }));
  },

  async more() {
    return [];
  },
};

export default hn;
