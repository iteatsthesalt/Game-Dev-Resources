/** Time to live for cached search-style responses (spec §7.3). Item-detail responses pass 7 * 24 * 3600e3. */
export const SEARCH_TTL_MS = 24 * 3600e3;

/** The request URL with any api_key parameter removed: the cache key, so a key never reaches the store. */
function cacheKey(url) {
  const parsed = new URL(url);
  parsed.searchParams.delete('api_key');
  return parsed.href;
}

// A reply that `accept` refuses is returned but not kept, so the source asks again next time (shared adapter rule 12).
async function cached(ctx, url, ttlMs, accept, fetchBody) {
  const key = cacheKey(url);
  const hit = await ctx.cache.get(key);
  if (hit !== undefined) return hit;
  const body = await fetchBody();
  if (accept && !accept(body)) return body;
  await ctx.cache.set(key, body, ttlMs);
  return body;
}

/** The request options: `headers` (an object, or an async function called now) are sent only when given. */
async function requestOptions(source, headers) {
  const resolved = typeof headers === 'function' ? await headers() : headers;
  return resolved ? { source, headers: resolved } : { source };
}

/**
 * GET JSON through ctx.cache: the parsed response is kept for ttlMs. `headers` are sent only when given; an async
 * function is called on a cache miss only, so a credential is never fetched for a cache hit. `accept(body)`, when
 * given, says whether the reply has the shape its parser relies on: a reply it refuses is returned but not kept.
 */
export function cachedJson(ctx, source, url, { ttlMs = SEARCH_TTL_MS, headers, accept } = {}) {
  return cached(ctx, url, ttlMs, accept, async () => ctx.http.getJson(url, await requestOptions(source, headers)));
}

/** GET text through ctx.cache: the response text is kept for ttlMs. `headers` and `accept` work as for cachedJson. */
export function cachedText(ctx, source, url, { ttlMs = SEARCH_TTL_MS, headers, accept } = {}) {
  return cached(ctx, url, ttlMs, accept, () => ctx.http.getText(url, headers ? { source, headers } : { source }));
}
