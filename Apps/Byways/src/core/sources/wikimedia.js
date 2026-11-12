import { IDENT } from './index.js';

/** Time to live for cached search-style responses (spec §7.3). */
export const SEARCH_TTL_MS = 24 * 3600e3;

/** The request URL with any api_key parameter removed: the cache key. */
function cacheKey(url) {
  const parsed = new URL(url);
  parsed.searchParams.delete('api_key');
  return parsed.href;
}

/** GET JSON from a Wikimedia host. IDENT is read here, inside a function, because index.js imports the adapters (an import cycle). */
export const getJson = (ctx, source, url) =>
  ctx.http.getJson(url, { source, headers: { 'Api-User-Agent': IDENT } });

/** Like getJson, but the parsed response is kept in ctx.cache for ttlMs. */
export async function cachedJson(ctx, source, url, ttlMs = SEARCH_TTL_MS) {
  const key = cacheKey(url);
  const hit = await ctx.cache.get(key);
  if (hit !== undefined) return hit;
  const body = await getJson(ctx, source, url);
  await ctx.cache.set(key, body, ttlMs);
  return body;
}

/** The pages of a generator=search query response, those with a title, in result order (by index). */
export function searchPages(body) {
  const pages = body?.query?.pages;
  if (!pages || typeof pages !== 'object') return [];
  return Object.values(pages)
    .filter(page => page && typeof page.title === 'string')
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}
