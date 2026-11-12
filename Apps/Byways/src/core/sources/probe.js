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
 * Probe adapters in parallel and keep the results in health['probe:<platformName>'].
 * A stored record under 24 h old is reused: only the adapters it lacks are probed, and their results are merged
 * into it (keeping its `at`). An older record is replaced by probing every adapter. Gives results for `adapters` only.
 * @returns {Promise<Object<string,'ok'|'fail'>>}
 */
export async function runProbes(adapters, http, store, clock, platformName = 'pwa') {
  const key = `probe:${platformName}`;
  const stored = await store.get('health', key);
  const fresh = Boolean(stored) && clock.now() - stored.at < DAY_MS;
  const known = fresh ? stored.results : {};
  const missing = adapters.filter(a => known[a.id] === undefined);
  let all = known;
  if (missing.length) {
    const states = await Promise.all(missing.map(adapter => probeSource(adapter, http)));
    all = { ...known, ...Object.fromEntries(missing.map((adapter, i) => [adapter.id, states[i]])) };
    await store.put('health', key, { at: fresh ? stored.at : clock.now(), results: all });
  }
  return Object.fromEntries(adapters.map(a => [a.id, all[a.id]]));
}
