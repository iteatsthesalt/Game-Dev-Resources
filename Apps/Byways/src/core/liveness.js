import { siteOrigin } from './util/url.js';

/**
 * Is a find's link still alive? Privileged platforms ask for the page itself and read the status
 * (below 400, or 405 for a server that refuses HEAD). The web can only learn whether the site root
 * answers at all (an opaque no-cors response); an http: URL is not fetched there, because the CSP
 * and mixed-content blocking would stop it, so it counts as live. A throw or the timeout is not live.
 */
export async function checkLive(url, { transport, privileged = false, timeoutMs = 8000 }) {
  const origin = siteOrigin(url);
  if (!origin) return false;
  if (!privileged && origin.startsWith('http:')) return true;

  const controller = new AbortController();
  const base = { method: 'HEAD', signal: controller.signal };
  let timer;
  const timedOut = new Promise((resolve) => {
    timer = setTimeout(() => { controller.abort(); resolve(false); }, timeoutMs);
  });
  const ask = async () => {
    try {
      if (privileged) {
        const res = await transport.fetch(url, { ...base, privileged: true });
        return res.status < 400 || res.status === 405;
      }
      await transport.fetch(`${origin}/`, { ...base, mode: 'no-cors', credentials: 'omit' });
      return true;
    } catch {
      return false;
    }
  };
  try {
    return await Promise.race([ask(), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}
