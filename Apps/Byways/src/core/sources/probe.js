import { NetError } from '../net/errors.js';

const DAY_MS = 24 * 3600e3;

/**
 * Whether a source answers this browser with CORS. A JSON reply is 'ok'; so is a 4xx answer, because the host
 * replied with CORS (a refused DEMO_KEY is not a reachability problem). Anything else is 'fail'.
 * @returns {Promise<'ok'|'fail'>}
 */
export async function probeSource(adapter, http) {
  if (!adapter.probeUrl) return 'ok';
  try {
    await http.getJson(adapter.probeUrl, { source: adapter.id, timeoutMs: 8000 });
    return 'ok';
  } catch (err) {
    const answered = err instanceof NetError && err.kind === 'http' && err.status >= 400 && err.status <= 499;
    return answered ? 'ok' : 'fail';
  }
}

/**
 * Probe every adapter in parallel and keep the results in health['probe:<platformName>'].
 * A stored result under 24 h old that covers every adapter id is reused.
 * @returns {Promise<Object<string,'ok'|'fail'>>}
 */
export async function runProbes(adapters, http, store, clock, platformName = 'pwa') {
  const key = `probe:${platformName}`;
  const stored = await store.get('health', key);
  if (stored && clock.now() - stored.at < DAY_MS && adapters.every(a => stored.results[a.id] !== undefined)) {
    return Object.fromEntries(adapters.map(a => [a.id, stored.results[a.id]]));
  }
  const states = await Promise.all(adapters.map(adapter => probeSource(adapter, http)));
  const results = Object.fromEntries(adapters.map((adapter, i) => [adapter.id, states[i]]));
  await store.put('health', key, { at: clock.now(), results });
  return results;
}
