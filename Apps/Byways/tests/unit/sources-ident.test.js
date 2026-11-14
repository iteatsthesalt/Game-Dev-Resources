// This file imports an adapter before src/core/sources/index.js, on purpose. node:test runs each test file in its own
// process, so this import order is the first one here, and it would throw 'Cannot access … before initialization' if
// an adapter still read IDENT from index.js (index.js imports the adapters). Keep the adapter import first.
import aic from '../../src/core/sources/aic.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { adapterCtx } from './helpers/fixture-http.js';
import { IDENT } from '../../src/core/sources/ident.js';
import { IDENT as REEXPORTED } from '../../src/core/sources/index.js';

test('an adapter imported before the registry works and sends IDENT', async () => {
  const { ctx, calls } = await adapterCtx();
  assert.equal((await aic.search('seurat', ctx)).length, 1);
  assert.equal(calls[0].headers['aic-user-agent'], IDENT);
  assert.equal(REEXPORTED, IDENT);
});
