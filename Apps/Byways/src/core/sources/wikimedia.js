import { IDENT } from './index.js';
import { SEARCH_TTL_MS, cachedJson as cachedJsonWith } from './cached.js';

export { SEARCH_TTL_MS };

/** GET JSON from a Wikimedia host. IDENT is read here, inside a function, because index.js imports the adapters (an import cycle). */
export const getJson = (ctx, source, url) =>
  ctx.http.getJson(url, { source, headers: { 'Api-User-Agent': IDENT } });

/** Like getJson, but the parsed response is kept in ctx.cache for ttlMs, unless `accept(body)` refuses it. */
export const cachedJson = (ctx, source, url, { ttlMs = SEARCH_TTL_MS, accept } = {}) =>
  cachedJsonWith(ctx, source, url, { ttlMs, accept, headers: { 'Api-User-Agent': IDENT } });

/**
 * Whether a generator=search reply can be kept: an object without an `error` (MediaWiki answers maxlag and other
 * errors with a 200). A search with no hits has no `query` at all, and that is a real answer.
 */
export const isSearchReply = body =>
  body !== null && typeof body === 'object' && body.error === undefined
  && (body.query === undefined || typeof body.query?.pages === 'object');

/** The pages of a generator=search query response, those with a title, in result order (by index). */
export function searchPages(body) {
  const pages = body?.query?.pages;
  if (!pages || typeof pages !== 'object') return [];
  return Object.values(pages)
    .filter(page => page && typeof page.title === 'string')
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}
