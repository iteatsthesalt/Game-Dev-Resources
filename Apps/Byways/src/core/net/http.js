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

  /**
   * One fetch with a timeout and the caller's signal linked in. Resolves with {res, finish, failure} or throws a
   * NetError. The deadline stays armed until finish() is called, so a body read can still time out, and the
   * caller's signal stays linked for good (aborting a finished controller does nothing). failure() names why the
   * request was cut short (aborted or timeout), or gives null.
   */
  async function fetchOnce(url, o) {
    const { method, headers, body, source, timeoutMs, privileged, signal } = o;
    if (signal?.aborted) throw aborted(source);
    const ac = new AbortController();
    let timedOut = false;
    signal?.addEventListener('abort', () => ac.abort(), { once: true });
    const timer = clock.setTimeout(() => { timedOut = true; ac.abort(); }, timeoutMs);
    const finish = () => clock.clearTimeout(timer);
    const failure = () => {
      if (signal?.aborted) return aborted(source);
      if (timedOut) return new NetError('timeout', `timed out after ${timeoutMs} ms`, { source });
      return null;
    };
    try {
      return { res: await transport.fetch(url, { method, headers, body, signal: ac.signal, privileged }), finish, failure };
    } catch (err) {
      finish();
      throw failure() ?? new NetError('network', err?.message || 'network', { source });
    }
  }

  async function run(url, o) {
    const { source, signal } = o;
    const circuit = source === undefined ? null : circuitFor(source);
    if (circuit && clock.now() < circuit.openUntil) {
      throw new NetError('circuit', `circuit open for ${source}`, { source });
    }
    for (let attempt = 1; ; attempt++) {
      let sent;
      try {
        sent = await fetchOnce(url, o);
      } catch (err) {
        if (circuit && (err.kind === 'network' || err.kind === 'timeout')) {
          circuit.fails++;
          if (circuit.fails >= CIRCUIT_FAILS) circuit.openUntil = clock.now() + CIRCUIT_MS;
        }
        throw err;
      }
      if (circuit) circuit.fails = 0;
      const { res } = sent;
      if (res.status < 400) return sent;
      sent.finish();
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

  /** Resolves with fetchOnce's {res, finish, failure}. An option given as undefined keeps its default. */
  function send(url, opts = {}) {
    const o = { method: 'GET', timeoutMs: 8000, privileged: false };
    for (const [key, value] of Object.entries(opts ?? {})) if (value !== undefined) o[key] = value;
    const limiter = o.source === undefined ? undefined : limiters.get(o.source);
    return limiter ? limiter.schedule(() => run(url, o)) : run(url, o);
  }

  /** The deadline covers the headers only; the caller's signal still reaches the body stream. */
  async function request(url, opts) {
    const { res, finish } = await send(url, opts);
    finish();
    return res;
  }

  /** The deadline and the caller's signal both cover the body read; `kind` names any other read failure. */
  async function readBody(url, opts, read, kind) {
    const { res, finish, failure } = await send(url, opts);
    try {
      return await read(res);
    } catch (err) {
      throw failure() ?? new NetError(kind, err?.message || kind, { source: opts?.source });
    } finally {
      finish();
    }
  }

  return {
    register(sourceId, { perMinute, concurrent }) {
      limiters.set(sourceId, createLimiter({ perMinute, concurrent, clock }));
    },
    request,
    getJson: (url, opts) => readBody(url, opts, res => res.json(), 'parse'),
    getText: (url, opts) => readBody(url, opts, res => res.text(), 'network'),
  };
}
