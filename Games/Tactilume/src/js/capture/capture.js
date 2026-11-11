// STUB: replaced by the real module. Matches CONTRACTS.md so the app builds.
import { createEmitter } from '../core/util.js';

export function createCapture({ engine, audio, platform }) {
  const ev = createEmitter();
  return {
    async photo() { return { ok: false, error: 'not built yet' }; },
    startRecording() { return { ok: false, error: 'not built yet' }; },
    async stopRecording() { return { ok: false, error: 'not built yet' }; },
    recording: false,
    elapsed: 0,
    mime: '',
    on: ev.on,
  };
}
