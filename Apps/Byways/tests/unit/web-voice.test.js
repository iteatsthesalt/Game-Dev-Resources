import test from 'node:test';
import assert from 'node:assert/strict';
import { createNoVoice } from '../../src/platform/web-voice.js';

test('createNoVoice reports none and emits an error on start', async () => {
  const v = createNoVoice();
  assert.deepEqual(await v.probe({ allowCloud: false }), { kind: 'none', vendor: null, needsDownload: false, continuous: false, reason: 'not set up yet' });
  assert.equal(await v.install(), false);
  const errs = []; const off = v.on('error', e => errs.push(e));
  await v.start({ lang: 'en-US', phrases: [], allowCloud: false });
  assert.deepEqual(errs, [{ code: 'service-not-allowed' }]);
  off(); await v.start({ lang: 'en-US', phrases: [], allowCloud: false }); assert.equal(errs.length, 1); v.stop();
});
