/** Time to live for cached search-style responses (spec §7.3). Item-detail responses pass 7 * 24 * 3600e3. */
export const SEARCH_TTL_MS = 24 * 3600e3;

/** The request URL with any api_key parameter removed: the cache key, so a key never reaches the store. */
function cacheKey(url) {
  const parsed = new URL(url);
  parsed.searchParams.delete('api_key');
  return parsed.href;
}

async function cached(ctx, url, ttlMs, fetchBody) {
  const key = cacheKey(url);
  const hit = await ctx.cache.get(key);
  if (hit !== undefined) return hit;
  const body = await fetchBody();
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
 * function is called on a cache miss only, so a credential is never fetched for a cache hit.
 */
export function cachedJson(ctx, source, url, { ttlMs = SEARCH_TTL_MS, headers } = {}) {
  return cached(ctx, url, ttlMs, async () => ctx.http.getJson(url, await requestOptions(source, headers)));
}

/** GET text through ctx.cache: the response text is kept for ttlMs. `headers` are sent only when given. */
export function cachedText(ctx, source, url, { ttlMs = SEARCH_TTL_MS, headers } = {}) {
  return cached(ctx, url, ttlMs, () => ctx.http.getText(url, headers ? { source, headers } : { source }));
}
