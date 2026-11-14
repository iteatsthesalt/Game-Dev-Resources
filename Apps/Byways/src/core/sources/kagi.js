import { makeFind } from '../model/find.js';
import { domainOf, isHttpUrl, siteOrigin } from '../util/url.js';

const ID = 'kagi';
const BASE = 'https://raw.githubusercontent.com/kagisearch/smallweb/main/';
const WEEK_MS = 7 * 864e5;
const HOUR_MS = 3600e3;
const LIST_TTL_MS = 30 * 864e5;
const DOWNLOAD_TIMEOUT_MS = 60000;
const PICKS = 5;
const CHANNEL_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** The three curated lists of the Kagi Small Web project (MIT). */
export const KAGI_LISTS = {
  smallweb: BASE + 'smallweb.txt',
  smallyt: BASE + 'smallyt.txt',
  smallcomic: BASE + 'smallcomic.txt',
};

const LISTS = {
  smallweb: { kind: 'site', tags: ['web', 'essays'], description: 'A small personal site from the Kagi Small Web list.' },
  smallyt: { kind: 'video', tags: ['film'], description: 'A small YouTube channel from the Kagi Small Web list.' },
  smallcomic: { kind: 'site', tags: ['comics'], description: 'An independent web comic from the Kagi Small Web list.' },
};

const listKey = name => `kagi:list:${name}`;
const isList = name => Object.hasOwn(KAGI_LISTS, name);
const firstToken = line => line.split(/\s/, 1)[0];

function siteEntry(line) {
  const token = firstToken(line);
  if (!isHttpUrl(token)) return null;
  return { url: siteOrigin(token) + '/', title: domainOf(token) };
}

function channelIdOf(feed) {
  const id = new URL(feed).searchParams.get('channel_id');
  return id && CHANNEL_ID.test(id) ? id : null;
}

// A comment reads '<name> <channel url>': the channel url is the last token and the name is everything before it.
function commentEntry(comment) {
  const gap = Math.max(comment.lastIndexOf(' '), comment.lastIndexOf('\t'));
  const url = comment.slice(gap + 1);
  const name = comment.slice(0, gap + 1).trim();
  if (!isHttpUrl(url)) return null;
  return { url, title: name || domainOf(url) };
}

function youtubeEntry(line) {
  const feed = firstToken(line);
  if (!isHttpUrl(feed)) return null;
  const mark = line.indexOf(' # ');
  const fromComment = mark === -1 ? null : commentEntry(line.slice(mark + 3).trim());
  if (fromComment) return fromComment;
  const id = channelIdOf(feed);
  return id ? { url: `https://www.youtube.com/channel/${id}`, title: id } : null;
}

/** Read one Small Web list: unique {url, title} entries in first-seen order. Junk lines are skipped. */
export function parseKagiList(text, name) {
  const read = name === 'smallyt' ? youtubeEntry : siteEntry;
  const seen = new Set();
  const entries = [];
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line || line[0] === '[' || line[0] === '#') continue;
    const entry = read(line);
    if (!entry || seen.has(entry.url)) continue;
    seen.add(entry.url);
    entries.push(entry);
  }
  return entries;
}

// Per app (keyed by its cache): the download in flight for each list, and when a background start last tried one.
const states = new WeakMap();

function stateOf(ctx) {
  let state = states.get(ctx.cache);
  if (!state) {
    state = { inflight: new Map(), lastTry: new Map() };
    states.set(ctx.cache, state);
  }
  return state;
}

// Every caller shares one download per list. Only a list that parses to at least one entry is stored.
function download(ctx, name) {
  const { inflight } = stateOf(ctx);
  const running = inflight.get(name);
  if (running) return running;
  const started = (async () => {
    const text = await ctx.http.getText(KAGI_LISTS[name], { source: ID, timeoutMs: DOWNLOAD_TIMEOUT_MS });
    const list = parseKagiList(text, name);
    if (list.length) await ctx.cache.set(listKey(name), { list, fetchedAt: ctx.clock.now() }, LIST_TTL_MS);
    return list;
  })().finally(() => {
    if (inflight.get(name) === started) inflight.delete(name);
  });
  inflight.set(name, started);
  return started;
}

// Start a download nobody waits for: at most one try per list per hour, and a failure only warns.
function downloadInBackground(ctx, name) {
  const { inflight, lastTry } = stateOf(ctx);
  const now = ctx.clock.now();
  const last = lastTry.get(name);
  if (inflight.has(name) || (last !== undefined && now - last < HOUR_MS)) return;
  lastTry.set(name, now);
  download(ctx, name).catch(err => console.warn(`Kagi Small Web: could not download ${name}: ${err?.message ?? err}`));
}

// The stored list, or null when none is usable. An old one is returned at once and a refresh starts behind it.
async function storedList(ctx, name) {
  const entry = await ctx.cache.get(listKey(name));
  if (!Array.isArray(entry?.list) || !entry.list.length || !Number.isFinite(entry.fetchedAt)) return null;
  if (ctx.clock.now() - entry.fetchedAt > WEEK_MS) downloadInBackground(ctx, name);
  return entry.list;
}

/** The entries of one Small Web list, kept in the cache for 30 days and refreshed in the background after a week. */
export async function loadKagiList(ctx, name) {
  if (!isList(name)) return [];
  return (await storedList(ctx, name)) ?? download(ctx, name);
}

const pickList = value => (value < 0.8 ? 'smallweb' : value < 0.9 ? 'smallyt' : 'smallcomic');

// Up to `count` distinct entries: a partial Fisher-Yates whose swaps are kept sparse, so a long list is never copied.
function sample(list, count, rand) {
  const moved = new Map();
  const picks = [];
  for (let i = 0; i < Math.min(count, list.length); i++) {
    const last = list.length - 1 - i;
    const at = Math.floor(rand() * (last + 1));
    picks.push(list[moved.get(at) ?? at]);
    moved.set(at, moved.get(last) ?? last);
  }
  return picks;
}

const kagi = {
  id: ID,
  name: 'Kagi Small Web',
  tier: 'open',
  key: 'none',
  safety: 'curated',
  rate: { perMinute: 6, concurrent: 1 },
  fate: true,
  kinds: ['site', 'video'],
  tags: ['web', 'essays'],

  async random(ctx) {
    const name = pickList(ctx.rand());
    const list = await storedList(ctx, name);
    if (!list) {
      downloadInBackground(ctx, name);
      return [];
    }
    const { kind, tags, description } = LISTS[name];
    return sample(list, PICKS, ctx.rand).map(entry => makeFind({
      id: `kagi:${entry.url}`,
      source: ID,
      kind,
      title: entry.title,
      description,
      url: entry.url,
      tags,
      why: ['Kagi Small Web'],
      safety: kagi.safety,
      attribution: 'Kagi Small Web list (MIT)',
    })).filter(Boolean);
  },

  async search() {
    return [];
  },

  async more() {
    return [];
  },
};

export default kagi;
