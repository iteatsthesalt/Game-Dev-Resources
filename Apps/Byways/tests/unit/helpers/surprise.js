import assert from 'node:assert/strict';
import { adapterCtx } from './fixture-http.js';

/**
 * Shared adapter rule 12: a 200 reply with a surprise shape (`bad`) is answered but never cached, so the source
 * recovers on the next call; a well-formed reply with zero results (`empty`, when given) is a real answer and is
 * cached. `match` picks the requests under test; `call(ctx)` makes one adapter call; `options` go to adapterCtx.
 */
export async function assertSurpriseNotCached({ match, bad, empty, call, options = {} }) {
  const route = { match, json: bad };
  const { ctx, calls, store } = await adapterCtx({ ...options, extraRoutes: [route] });
  const asked = () => calls.filter(c => match.test(c.url)).length;
  assert.deepEqual(await call(ctx), []); await call(ctx);
  assert.equal(asked(), 2, 'a surprise-shaped reply is asked for again');
  assert.deepEqual((await store.keys('cache')).filter(key => match.test(key)), [], 'nothing of it is stored');
  if (empty === undefined) return;
  route.json = empty;
  assert.deepEqual(await call(ctx), []); await call(ctx);
  assert.equal(asked(), 3, 'a well-formed empty reply is cached');
}
