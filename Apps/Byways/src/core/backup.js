import { loadSettings } from './settings.js';
import { DEFAULT_TASTE } from './taste.js';
import { createCollections } from './collections.js';
import { makeFind } from './model/find.js';
import { realClock, utcDate } from './util/clock.js';
import { isHttpUrl } from './util/url.js';
import { toPlainText } from './util/text.js';

const FORMAT = 'byways-backup';
const NOT_A_BACKUP = 'This is not a Byways backup file.';
const TRAIL_MAX = 50;
const ITEMS_MAX = 500;
const KEY_VALUE_MAX = 4096;
const WEIGHT_CAP = 3;
const LOCK_ID = '__lock';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const strings = (list) => (Array.isArray(list) ? [...new Set(list.filter((s) => typeof s === 'string'))] : []);

/**
 * Everything worth carrying to another device, as one JSON-ready object. Settings are included for reference only;
 * importBackup never applies them. Keys are left out unless asked for, and the keyring's lock record is never exported.
 */
export async function exportBackup(store, { includeKeys = false, app, clock = realClock, secrets } = {}) {
  const trail = await store.get('history', 'trail');
  const out = {
    format: FORMAT,
    v: 1,
    exportedAt: new Date(clock.now()).toISOString(),
    app,
    settings: await loadSettings(store),
    taste: (await store.get('taste', 'taste')) ?? structuredClone(DEFAULT_TASTE),
    collections: await createCollections(store, clock).list(),
    history: Array.isArray(trail?.items) ? trail.items : [],
    seen: (await store.getAll('seen')).map((row) => [row.key, row.value.t]),
  };
  if (includeKeys) {
    out.keys = {};
    for (const id of secrets ? await secrets.list() : []) {
      const value = id === LOCK_ID ? null : await secrets.get(id);
      if (value != null) out.keys[id] = value;
    }
  }
  return out;
}

/** The file name a backup is saved under. */
export function backupFileName(clock, includeKeys) {
  return `byways-backup-${utcDate(clock.now())}${includeKeys ? '-with-keys' : ''}.json`;
}

function cleanSeen(list) {
  const out = new Map();
  for (const pair of list) {
    if (Array.isArray(pair) && /^[0-9a-f]{16}$/.test(pair[0]) && isFiniteNumber(pair[1]) && !out.has(pair[0])) out.set(pair[0], pair[1]);
  }
  return out;
}

function cleanItems(list) {
  const items = [];
  const ids = new Set();
  for (const item of Array.isArray(list) ? list : []) {
    const find = isObject(item) ? makeFind(item.find) : null;
    if (find === null || ids.has(find.id)) continue;
    ids.add(find.id);
    items.push({ find, added: isFiniteNumber(item.added) ? item.added : 0 });
    if (items.length === ITEMS_MAX) break;
  }
  return items;
}

function cleanCollections(list) {
  const out = [];
  for (const c of list) {
    if (!isObject(c) || typeof c.id !== 'string' || c.id === '' || c.id.startsWith('@') || !Array.isArray(c.items)) continue;
    const name = c.id === 'saved' ? 'Saved' : typeof c.name === 'string' && c.name.trim() ? c.name.trim() : c.id;
    out.push({ id: c.id, name, created: isFiniteNumber(c.created) ? c.created : 0, items: cleanItems(c.items) });
  }
  return out;
}

function cleanHistory(list) {
  const items = [];
  for (const entry of list) {
    const find = isObject(entry) ? makeFind(entry.find) : null;
    if (find !== null && isFiniteNumber(entry.t)) items.push({ find, t: entry.t });
  }
  return items.slice(-TRAIL_MAX);
}

function cleanWeights(weights) {
  const out = {};
  for (const [key, value] of Object.entries(isObject(weights) ? weights : {})) {
    if (key !== '__proto__' && isFiniteNumber(value)) out[key] = clamp(value, -WEIGHT_CAP, WEIGHT_CAP);
  }
  return out;
}

/** Rebuild an untrusted taste over the defaults so that only known, in-range fields survive. */
function cleanTaste(taste) {
  return {
    ...structuredClone(DEFAULT_TASTE),
    tags: cleanWeights(taste.tags),
    sources: cleanWeights(taste.sources),
    hiddenTags: strings(taste.hiddenTags),
    blockedDomains: strings(taste.blockedDomains),
    interests: strings(taste.interests),
    strangeness: isFiniteNumber(taste.strangeness) ? clamp(taste.strangeness, 0, 1) : DEFAULT_TASTE.strangeness,
    reactions: Number.isInteger(taste.reactions) && taste.reactions >= 0 ? taste.reactions : 0,
  };
}

function cleanKeys(keys) {
  const out = [];
  for (const [id, value] of Object.entries(isObject(keys) ? keys : {})) {
    if (/^(src|ai):/.test(id) && typeof value === 'string' && value !== '' && value.length <= KEY_VALUE_MAX) out.push([id, value]);
  }
  return out;
}

const sameContent = (existing, name, items) => {
  const have = Array.isArray(existing.items) ? existing.items.map((item) => item.find.id) : [];
  const want = new Set(items.map((item) => item.find.id));
  return existing.name === name && have.length === want.size && have.every((id) => want.has(id));
};

/** Add one collection unless the same one is already there; a different one under a taken id becomes `<id>-copy`. */
async function mergeCollection(store, c) {
  const existing = await store.get('collections', c.id);
  if (existing === undefined) {
    await store.put('collections', c.id, c);
    return true;
  }
  if (sameContent(existing, c.name, c.items)) return false;
  const name = `${c.name} (imported)`;
  for (let n = 1; ; n += 1) {
    const id = n === 1 ? `${c.id}-copy` : `${c.id}-copy-${n}`;
    const taken = await store.get('collections', id);
    if (taken === undefined) {
      await store.put('collections', id, { ...c, id, name });
      return true;
    }
    if (sameContent(taken, name, c.items)) return false;
  }
}

/**
 * Merge a backup file into the stores and return what was written. The file is untrusted: the envelope is checked
 * before anything is written, then every part is validated and bad entries are skipped. Settings in the file are
 * never applied. The caller re-reads history and taste afterwards, since engines hold them in memory.
 */
export async function importBackup(store, data, { secrets } = {}) {
  if (!isObject(data) || data.format !== FORMAT || data.v !== 1
    || !Array.isArray(data.collections) || !Array.isArray(data.history) || !Array.isArray(data.seen)) {
    throw new Error(NOT_A_BACKUP);
  }
  const counts = { collections: 0, seen: 0, history: 0, keys: 0 };

  const known = new Set(await store.keys('seen'));
  for (const [hash, t] of cleanSeen(data.seen)) {
    if (known.has(hash)) continue;
    await store.put('seen', hash, { t });
    counts.seen += 1;
  }

  for (const c of cleanCollections(data.collections)) {
    if (await mergeCollection(store, c)) counts.collections += 1;
  }

  const trail = await store.get('history', 'trail');
  if (!Array.isArray(trail?.items) || trail.items.length === 0) {
    const items = cleanHistory(data.history);
    if (items.length > 0) {
      await store.put('history', 'trail', { items });
      counts.history = items.length;
    }
  }

  const taste = await store.get('taste', 'taste');
  if (isObject(data.taste) && (taste === undefined || taste === null || taste.reactions === 0)) {
    await store.put('taste', 'taste', cleanTaste(data.taste));
  }

  if (secrets && 'keys' in data) {
    for (const [id, value] of cleanKeys(data.keys)) {
      await secrets.set(id, value);
      counts.keys += 1;
    }
  }
  return counts;
}

const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One collection as a Netscape bookmarks file, which every browser can import. */
export function toBookmarksHtml(collection) {
  const links = (collection.items ?? []).map(({ find }) => `        <DT><A HREF="${escapeHtml(find.url)}">${escapeHtml(find.title)}</A>`);
  return [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
    `    <DT><H3>${escapeHtml(collection.name)}</H3>`,
    '    <DL><p>',
    ...links,
    '    </DL><p>',
    '</DL><p>',
    '',
  ].join('\n');
}

// An opening tag is found in two steps so that a malformed one costs a single scan: the rest of the tag is quote-aware
// (a `>` inside an attribute value does not end it), and a tag or closing tag that is never finished ends the read.
const ANCHOR_START = /<a\s/gi;
const TAG_REST = /((?:"[^"]*"|'[^']*'|[^>"'])*)>/y;
const ANCHOR_CLOSE = /<\/a\s*>/gi;
const ATTRIBUTE = /([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function hrefOf(attributes) {
  for (const [, name, double, single, bare] of attributes.matchAll(ATTRIBUTE)) {
    if (name.toLowerCase() === 'href') return double ?? single ?? bare ?? '';
  }
  return null;
}

/** Every http(s) link in a bookmarks file (or any HTML) as `{url, title}`, in order; a link with no text is titled by its url. */
export function fromBookmarksHtml(html) {
  const text = String(html ?? '');
  const out = [];
  let at = 0;
  for (;;) {
    ANCHOR_START.lastIndex = at;
    if (ANCHOR_START.exec(text) === null) break;
    TAG_REST.lastIndex = ANCHOR_START.lastIndex;
    const tag = TAG_REST.exec(text);
    if (tag === null) break;
    ANCHOR_CLOSE.lastIndex = TAG_REST.lastIndex;
    const close = ANCHOR_CLOSE.exec(text);
    if (close === null) break;
    const href = hrefOf(tag[1]);
    const url = href === null ? '' : toPlainText(href).trim();
    if (isHttpUrl(url)) out.push({ url, title: toPlainText(text.slice(TAG_REST.lastIndex, close.index)) || url });
    at = close.index + close[0].length;
  }
  return out;
}
