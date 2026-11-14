import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebTts } from '../../src/platform/web-tts.js';

class FakeUtterance { constructor(t) { this.text = t; } }
const V1 = { voiceURI: 'v1', name: 'One', lang: 'en-US', localService: true };
const makeSynth = () => ({ spoken: [], list: [], fail: null, on: {}, cancel() {}, getVoices() { return this.list; },
  addEventListener(t, f) { this.on[t] = f; }, removeEventListener() {},
  speak(u) { this.spoken.push(u); queueMicrotask(() => (this.fail ? u.onerror({ error: this.fail }) : u.onend())); } });
test('speak sets voice, rate and volume and resolves at the end', async () => {
  const synth = makeSynth(); synth.list = [V1];
  await createWebTts(synth, FakeUtterance).speak('Hello', { voiceURI: 'v1', rate: 1.5, volume: 0.5 });
  const u = synth.spoken[0];
  assert.deepEqual([u.text, u.voice.voiceURI, u.rate, u.volume], ['Hello', 'v1', 1.5, 0.5]);
});
test('interrupted and canceled resolve; other errors reject', async () => {
  const synth = makeSynth(); const tts = createWebTts(synth, FakeUtterance);
  for (const e of ['interrupted', 'canceled']) { synth.fail = e; await tts.speak('x'); }
  synth.fail = 'synthesis-failed'; await assert.rejects(tts.speak('x'), /synthesis-failed/);
});
test('voices maps fields and waits for voiceschanged when empty', async () => {
  const synth = makeSynth(); const p = createWebTts(synth, FakeUtterance).voices();
  synth.list = [V1]; synth.on.voiceschanged();
  assert.deepEqual(await p, [{ uri: 'v1', name: 'One', lang: 'en-US', local: true }]);
});
test('with no speechSynthesis it is silent', async () => {
  const tts = createWebTts(undefined); await tts.speak('x'); tts.cancel(); assert.deepEqual(await tts.voices(), []);
});
