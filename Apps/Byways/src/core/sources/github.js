import { makeFind } from '../model/find.js';
import { isHttpUrl } from '../util/url.js';
import { cachedJson } from './cached.js';

const ID = 'github';
const TAGS = ['indie', 'programming'];
const API = 'https://api.github.com/search/repositories';
const KEY_NAME = 'src:github';
const HOUR_MS = 3600e3;
const TOPICS = ['game-jam', 'js13k', 'pico-8', 'html5-game', 'ludum-dare', 'godot-game'];
const JAM_TOPICS = new Set(['game-jam', 'ludum-dare', 'js13k']);

const list = value => (Array.isArray(value) ? value : []);

function repository(item, why) {
  if (!item || typeof item !== 'object') return null;
  if (typeof item.id !== 'string' && typeof item.id !== 'number') return null;
  const topics = list(item.topics).filter(topic => typeof topic === 'string');
  const homepage = typeof item.homepage === 'string' ? item.homepage.trim() : '';
  const hasHomepage = isHttpUrl(homepage);
  const stars = typeof item.stargazers_count === 'number' ? [`★ ${item.stargazers_count}`] : [];
  return makeFind({
    id: 'github:' + item.id,
    source: ID,
    kind: hasHomepage ? 'game' : 'project',
    title: item.name,
    description: item.description,
    url: hasHomepage ? homepage : item.html_url,
    author: item.owner?.login,
    tags: topics.some(topic => JAM_TOPICS.has(topic)) ? [...TAGS, 'jam'] : TAGS,
    why: [why, ...stars],
    safety: github.safety,
    meta: { topics, published: item.updated_at },
  });
}

async function repositories(ctx, params, why) {
  const headers = { Accept: 'application/vnd.github+json' };
  const token = await ctx.secrets.get(KEY_NAME);
  if (token) headers.Authorization = `Bearer ${token}`;
  // A reply without an items list is not cached (shared adapter rule 12).
  const body = await cachedJson(ctx, ID, `${API}?${params}`, { ttlMs: HOUR_MS, headers, accept: reply => Array.isArray(reply?.items) });
  return list(body?.items).map(item => repository(item, why)).filter(Boolean);
}

const github = {
  id: ID,
  name: 'GitHub',
  tier: 'open',
  key: 'optional',
  keyName: KEY_NAME,
  safety: 'mostly',
  rate: { perMinute: 10, concurrent: 1 },
  fate: false,
  kinds: ['project', 'game'],
  tags: TAGS,

  async random(ctx) {
    const topic = TOPICS[Math.floor(ctx.rand() * TOPICS.length)];
    const params = new URLSearchParams({
      q: `topic:${topic} stars:>20`,
      sort: 'updated',
      per_page: '100',
      page: String(1 + Math.floor(ctx.rand() * 10)),
    });
    return repositories(ctx, params, `GitHub: topic ${topic}`);
  },

  async search(q, ctx) {
    const params = new URLSearchParams({ q: `${q} in:name,description,topics stars:>5`, per_page: '30' });
    return repositories(ctx, params, 'GitHub search');
  },

  async more(find, ctx) {
    const topic = find?.meta?.topics?.[0];
    if (typeof topic !== 'string' || !topic) return [];
    const params = new URLSearchParams({ q: `topic:${topic} stars:>5`, per_page: '30' });
    return repositories(ctx, params, `GitHub: topic ${topic}`);
  },
};

export default github;
