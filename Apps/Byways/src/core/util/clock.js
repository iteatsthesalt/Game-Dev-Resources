/** The real clock: Date.now and the global timers. */
export const realClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: id => clearTimeout(id),
};

/**
 * A manual clock for tests. Timers fire only inside advance(), earliest first
 * (ties in the order they were set), and `now` is each timer's due time while its callback runs.
 */
export function fakeClock(start = 0) {
  let now = start;
  let nextId = 1;
  const timers = new Map(); // id -> {due, fn}; Map order is insertion order, so ties keep set order

  return {
    now: () => now,
    setTimeout(fn, ms) {
      const id = nextId++;
      timers.set(id, { due: now + Math.max(0, ms), fn });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let nextTimer = null;
        let nextKey = null;
        for (const [id, t] of timers) {
          if (t.due <= target && (nextTimer === null || t.due < nextTimer.due)) { nextTimer = t; nextKey = id; }
        }
        if (nextTimer === null) break;
        timers.delete(nextKey);
        now = Math.max(now, nextTimer.due);
        nextTimer.fn();
      }
      now = target;
    },
  };
}

/** The UTC calendar date of a timestamp, as YYYY-MM-DD. */
export function utcDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The first UTC midnight strictly after a timestamp. */
export function nextUtcMidnight(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}
