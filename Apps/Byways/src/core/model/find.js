import { hash64 } from '../util/hash.js';
import { normalizeUrl, isHttpUrl } from '../util/url.js';
import { toPlainText, truncate } from '../util/text.js';

/** @typedef {import('../types.js').Find} Find */

export const FIND_KINDS = ['site', 'article', 'image', 'game', 'video', 'audio', 'book', 'project'];
export const SAFETY = ['curated', 'mostly', 'mixed'];

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 400;
const CREDIT_MAX = 200;
const EMBED_URL = /^https:\/\/archive\.org\/embed\/[A-Za-z0-9._-]+$/;

const plain = (value, max) => truncate(toPlainText(value), max);
const uniqueStrings = (list) => (Array.isArray(list) ? [...new Set(list.filter((s) => typeof s === 'string'))] : []);

/**
 * Validate and normalise a candidate Find from any source. Returns null when the url is not http(s), the title is
 * blank after stripping markup, or the kind is unknown; otherwise every field is clamped to its documented form.
 * @param {Partial<Find> & Record<string, any>} partial
 * @returns {Find|null}
 */
export function makeFind(partial) {
  const p = partial ?? {};
  const normalised = normalizeUrl(p.url);
  const title = plain(p.title, TITLE_MAX);
  if (!normalised || !title || !FIND_KINDS.includes(p.kind)) return null;

  /** @type {Find} */
  const find = {
    id: typeof p.id === 'string' && p.id ? p.id : 'url:' + hash64(normalised),
    source: String(p.source ?? ''),
    kind: p.kind,
    title,
    description: plain(p.description, DESCRIPTION_MAX),
    url: String(p.url).trim(),
    tags: uniqueStrings(p.tags),
    why: uniqueStrings(p.why),
    safety: SAFETY.includes(p.safety) ? p.safety : 'mixed',
  };
  if (typeof p.imageUrl === 'string' && isHttpUrl(p.imageUrl)) find.imageUrl = p.imageUrl.trim();
  if (typeof p.embedUrl === 'string' && EMBED_URL.test(p.embedUrl)) find.embedUrl = p.embedUrl;
  for (const key of ['author', 'licence', 'attribution']) {
    const text = p[key] == null ? '' : plain(p[key], CREDIT_MAX);
    if (text) find[key] = text;
  }
  for (const key of ['meta', 'foundBy', 'teamPick']) {
    if (p[key] !== undefined) find[key] = p[key];
  }
  return find;
}
