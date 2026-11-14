import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../../src/core/version.js';

test('APP_VERSION matches package.json', () => {
  assert.equal(APP_VERSION, JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version);
});
