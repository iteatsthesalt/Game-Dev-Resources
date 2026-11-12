/** Resolves on setImmediate, after every pending microtask has run. */
export const flush = () => new Promise(resolve => setImmediate(resolve));

/** A promise with its resolve and reject handles exposed. */
export function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
