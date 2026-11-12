import { makeFind } from '../model/find.js';
import { cachedJson } from './cached.js';

const ID = 'openlibrary';
const TAGS = ['books'];
const SITE = 'https://openlibrary.org';
const SUBJECTS = ['science_fiction', 'poetry', 'cooking', 'history', 'art', 'travel', 'puzzles', 'games', 'folklore', 'nature'];

const coverUrl = cover => (cover ? `https://covers.openlibrary.org/b/id/${cover}-M.jpg` : undefined);

function book({ key, title, author, cover, year, subject }) {
  if (typeof key !== 'string' || !key.startsWith('/')) return null;
  return makeFind({
    id: 'ol:' + key,
    source: ID,
    kind: 'book',
    title,
    description: [author, year].filter(Boolean).join(', '),
    url: SITE + key,
    imageUrl: coverUrl(cover),
    author,
    tags: TAGS,
    why: ['Open Library'],
    safety: openlibrary.safety,
    ...(subject ? { meta: { subject } } : {}),
  });
}

const list = value => (Array.isArray(value) ? value : []);

function fromSearch(body) {
  return list(body?.docs)
    .map(doc => doc && book({
      key: doc.key,
      title: doc.title,
      author: list(doc.author_name)[0],
      cover: doc.cover_i,
      year: doc.first_publish_year,
    }))
    .filter(Boolean);
}

async function subjectPage(subject, ctx) {
  const offset = Math.floor(ctx.rand() * 200);
  const url = `${SITE}/subjects/${encodeURIComponent(subject)}.json?limit=12&offset=${offset}`;
  const body = await ctx.http.getJson(url, { source: ID });
  return list(body?.works)
    .map(work => work && book({
      key: work.key,
      title: work.title,
      author: list(work.authors)[0]?.name,
      cover: work.cover_id,
      year: work.first_publish_year,
      subject,
    }))
    .filter(Boolean);
}

const openlibrary = {
  id: ID,
  name: 'Open Library',
  tier: 'open',
  key: 'none',
  safety: 'mostly',
  rate: { perMinute: 60, concurrent: 1 },
  fate: false,
  kinds: ['book'],
  tags: TAGS,

  async random(ctx) {
    return subjectPage(SUBJECTS[Math.floor(ctx.rand() * SUBJECTS.length)], ctx);
  },

  async search(q, ctx) {
    const params = new URLSearchParams({
      q,
      fields: 'key,title,author_name,cover_i,first_publish_year',
      limit: '10',
    });
    return fromSearch(await cachedJson(ctx, ID, `${SITE}/search.json?${params}`));
  },

  async more(find, ctx) {
    const subject = find?.meta?.subject;
    return typeof subject === 'string' && subject ? subjectPage(subject, ctx) : [];
  },
};

export default openlibrary;
