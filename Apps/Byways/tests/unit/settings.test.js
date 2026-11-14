import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore, memoryBackend } from '../../src/core/store/db.js';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../../src/core/settings.js';

test('DEFAULT_SETTINGS holds the contract values', () => {
  const d = DEFAULT_SETTINGS;
  assert.deepEqual([d.v, d.mode, d.dwellSec, d.textScale, d.firstRunDone], [1, 'tuned', 20, 1, false]);
  assert.deepEqual(d.voice, { mode: 'auto', cloudOptIn: false, voiceURI: null, rate: 1, volume: 1, lang: 'en-US' });
  assert.deepEqual([d.ai.runCapUsd, d.ai.dailySearchCap, d.ai.dailySpendCapUsd], [0.5, 50, 2]);
  assert.deepEqual(d.ai.team, { enabled: false, captain: false, roles: { scout: null, digger: null, wildcard: null, captain: null } });
  assert.deepEqual([d.sources, d.ai.baseUrls], [{}, {}]);
});
test('loadSettings on an empty store returns a fresh copy of the defaults', async () => {
  const store = await openStore(memoryBackend()); const s = await loadSettings(store);
  assert.deepEqual(s, DEFAULT_SETTINGS); s.voice.rate = 2; assert.equal(DEFAULT_SETTINGS.voice.rate, 1);
});
test('saveSettings deep-merges a patch and persists it', async () => {
  const store = await openStore(memoryBackend());
  const s = await saveSettings(store, { voice: { rate: 1.5 }, ai: { team: { roles: { scout: { provider: 'groq', model: 'm' } } } } });
  assert.equal(s.voice.lang, 'en-US');
  const again = await loadSettings(store);
  assert.equal(again.voice.rate, 1.5); assert.deepEqual(again.ai.team.roles.scout, { provider: 'groq', model: 'm' });
  assert.equal(again.ai.team.roles.digger, null);
});
test('saveSettings refuses a patch that is not a plain object and keeps what is stored', async () => {
  const store = await openStore(memoryBackend()); await saveSettings(store, { dwellSec: 40 });
  for (const bad of [null, undefined, 'x', 3, [1], new Date()]) await assert.rejects(saveSettings(store, bad), TypeError);
  assert.equal((await loadSettings(store)).dwellSec, 40);
});
test('saveSettings skips undefined values instead of resetting them', async () => {
  const store = await openStore(memoryBackend()); await saveSettings(store, { dwellSec: 40, voice: { voiceURI: 'v1', rate: 1.5 } });
  const s = await saveSettings(store, { dwellSec: undefined, voice: { voiceURI: undefined, rate: 2 } });
  assert.deepEqual([s.dwellSec, s.voice.voiceURI, s.voice.rate], [40, 'v1', 2]);
});
test('loadSettings repairs bad stored values', async () => {
  const store = await openStore(memoryBackend());
  await store.put('settings', 'current', { dwellSec: 9999, textScale: 0.2, theme: 7, voice: null, ai: { team: 'x', baseUrls: { ollama: 'http://localhost:11434' } },
    sessionLengthMin: 30, sources: { wikipedia: { enabled: false, fateWeight: 9 } }, extra: 'kept' });
  const s = await loadSettings(store);
  assert.equal(s.dwellSec, 300); assert.equal(s.textScale, 1); assert.equal(s.theme, 'system');
  assert.deepEqual(s.voice, DEFAULT_SETTINGS.voice); assert.deepEqual(s.ai.team, DEFAULT_SETTINGS.ai.team);
  assert.deepEqual(s.ai.baseUrls, { ollama: 'http://localhost:11434' });
  assert.equal(s.sessionLengthMin, 30); assert.deepEqual(s.sources.wikipedia, { enabled: false, fateWeight: 3 });
  assert.equal(s.extra, 'kept');
  await store.put('settings', 'current', 'garbage'); assert.deepEqual(await loadSettings(store), DEFAULT_SETTINGS);
});
