import { NetError } from './errors.js';
import { createLimiter, parseRetryAfter } from './ratelimit.js';

export const RETRY_MAX_MS = 10000;
export const DEFAULT_PAUSE_MS = 60000;
export const CIRCUIT_FAILS = 3;
export const CIRCUIT_MS = 60000;

/**
 * The HTTP client every source adapter and AI provider calls. `transport.fetch(url, init)` does the
 * real request. Each registered source gets a rate limiter; every named source gets a circuit breaker.
 */
export function createHttp({ transport, clock }) {
  const limiters = new Map(); // sourceId -> limiter
  const circuits = new Map(); // sourceId -> {fails, openUntil}

  function circuitFor(source) {
    if (!circuits.has(source)) circuits.set(source, { fails: 0, openUntil: 0 });
    return circuits.get(source);
  }

  function aborted(source) {
    return new NetError('aborted', 'aborted', { source });
  }

  /** Resolves after ms on the clock; rejects with `aborted` if the caller's signal fires first. */
  function wait(ms, signal, source) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(aborted(source));
      const onAbort = () => { clock.clearTimeout(timer); reject(aborted(source)); };
      const timer = clock.setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  /** One fetch with a timeout and the caller's signal linked in. Returns the Response or throws a NetError. */
  async function fetchOnce(url, o) {
    const { method, headers, body, source, timeoutMs, privileged, signal } = o;
    if (signal?.aborted) throw aborted(source);
    const ac = new AbortController();
    let timedOut = false;
    const onAbort = () => ac.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = clock.setTimeout(() => { timedOut = true; ac.abort(); }, timeoutMs);
    try {
      return await transport.fetch(url, { method, headers, body, signal: ac.signal, privileged });
    } catch (err) {
      if (signal?.aborted) throw aborted(source);
      if (timedOut) throw new NetError('timeout', `timed out after ${timeoutMs} ms`, { source });
      throw new NetError('network', err?.message || 'network', { source });
    } finally {
      clock.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async function run(url, o) {
    const { source, signal } = o;
    const circuit = source === undefined ? null : circuitFor(source);
    if (circuit && clock.now() < circuit.openUntil) {
      throw new NetError('circuit', `circuit open for ${source}`, { source });
    }
    for (let attempt = 1; ; attempt++) {
      let res;
      try {
        res = await fetchOnce(url, o);
      } catch (err) {
        if (circuit && (err.kind === 'network' || err.kind === 'timeout')) {
          circuit.fails++;
          if (circuit.fails >= CIRCUIT_FAILS) circuit.openUntil = clock.now() + CIRCUIT_MS;
        }
        throw err;
      }
      if (circuit) circuit.fails = 0;
      if (res.status < 400) return res;
      if (res.status === 429 || res.status === 503) {
        const ra = parseRetryAfter(res.headers.get('Retry-After'), clock.now());
        if (attempt === 1 && ra !== null && ra <= RETRY_MAX_MS) {
          await wait(ra, signal, source);
          continue;
        }
        limiters.get(source)?.pauseFor(ra ?? DEFAULT_PAUSE_MS);
        throw new NetError('http', `HTTP ${res.status}`, { status: res.status, retryAfterMs: ra ?? undefined, source });
      }
      throw new NetError('http', `HTTP ${res.status}`, { status: res.status, source });
    }
  }

  function request(url, opts = {}) {
    const o = { method: 'GET', timeoutMs: 8000, privileged: false, ...opts };
    const limiter = o.source === undefined ? undefined : limiters.get(o.source);
    return limiter ? limiter.schedule(() => run(url, o)) : run(url, o);
  }

  return {
    register(sourceId, { perMinute, concurrent }) {
      limiters.set(sourceId, createLimiter({ perMinute, concurrent, clock }));
    },
    request,
    async getJson(url, opts) {
      const res = await request(url, opts);
      try {
        return await res.json();
      } catch (err) {
        throw new NetError('parse', err?.message || 'parse', { source: opts?.source });
      }
    },
    async getText(url, opts) {
      const res = await request(url, opts);
      try {
        return await res.text();
      } catch (err) {
        throw new NetError('network', err?.message || 'network', { source: opts?.source });
      }
    },
  };
}
