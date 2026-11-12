const WINDOW_MS = 60000;
const SECONDS_RE = /^\d+$/;
const HTTP_DATE_RE = /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/;

/**
 * Per-source limiter: at most `concurrent` tasks in flight and `perMinute` starts in any
 * sliding 60 s window, FIFO. pauseFor(ms) holds new starts (for Retry-After).
 */
export function createLimiter({ perMinute, concurrent, clock }) {
  const queue = [];
  let starts = []; // start times inside the current window, oldest first
  let running = 0;
  let pausedUntil = 0;
  let timer = null;

  function start(task) {
    running++;
    starts.push(clock.now());
    new Promise(resolve => resolve(task.fn())).then(task.resolve, task.reject).finally(() => {
      running--;
      pump();
    });
  }

  function pump() {
    if (timer !== null) { clock.clearTimeout(timer); timer = null; }
    const now = clock.now();
    starts = starts.filter(t => t > now - WINDOW_MS);
    while (queue.length && running < concurrent && now >= pausedUntil && starts.length < perMinute) {
      start(queue.shift());
    }
    if (!queue.length) return;
    // Still waiting: wake at the earliest moment a slot frees. A full concurrency
    // limit needs no timer, because a settling task pumps again.
    let wake = null;
    if (now < pausedUntil) wake = pausedUntil;
    else if (starts.length >= perMinute) wake = starts[0] + WINDOW_MS;
    if (wake !== null) {
      timer = clock.setTimeout(() => { timer = null; pump(); }, wake - now);
    }
  }

  return {
    schedule(fn) {
      return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        queueMicrotask(pump);
      });
    },
    pauseFor(ms) {
      pausedUntil = Math.max(pausedUntil, clock.now() + ms);
    },
  };
}

/** Retry-After as milliseconds: delta-seconds or an HTTP date; null for anything else. */
export function parseRetryAfter(value, nowMs) {
  if (typeof value !== 'string') return null;
  if (SECONDS_RE.test(value)) return Number(value) * 1000;
  if (HTTP_DATE_RE.test(value)) {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : Math.max(0, t - nowMs);
  }
  return null;
}
