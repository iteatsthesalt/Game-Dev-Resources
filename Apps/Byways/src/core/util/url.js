/** Parse `u` as an absolute http(s) URL, or return null. */
function parseHttp(u) {
  let url;
  try {
    url = new URL(String(u).trim());
  } catch {
    return null;
  }
  return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
}

const stripWww = (host) => (host.startsWith('www.') && host.length > 4 ? host.slice(4) : host);
const isTracking = (name) => name.startsWith('utm_') || name === 'fbclid' || name === 'gclid' || name === 'ref';

/**
 * Canonical form used to compare and de-duplicate links: lower-case host without a leading
 * `www.`, default port and fragment removed, tracking parameters dropped, remaining parameters
 * sorted, no trailing slash except on the root. Returns null for anything that is not http(s).
 */
export function normalizeUrl(u) {
  const url = parseHttp(u);
  if (!url) return null;
  url.hostname = stripWww(url.hostname);
  url.hash = '';
  for (const name of [...new Set(url.searchParams.keys())]) {
    if (isTracking(name)) url.searchParams.delete(name);
  }
  url.searchParams.sort();
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1);
  return url.href;
}

/** Host name without a leading `www.`, or '' when `u` is not an http(s) URL. */
export function domainOf(u) {
  const url = parseHttp(u);
  return url ? stripWww(url.hostname) : '';
}

export function isHttpUrl(u) {
  return parseHttp(u) !== null;
}

/** `scheme://host[:port]` of an http(s) URL, or '' otherwise. */
export function siteOrigin(u) {
  const url = parseHttp(u);
  return url ? url.origin : '';
}
