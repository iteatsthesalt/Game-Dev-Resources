/**
 * The voice engine for a platform with no speech recognition set up: it reports none, cannot install
 * anything, and answers every start with a `service-not-allowed` error.
 * @returns {import('../core/types.js').VoiceEngine}
 */
export function createNoVoice() {
  const listeners = { result: new Set(), state: new Set(), error: new Set() };
  const emit = (event, payload) => { for (const fn of [...listeners[event]]) fn(payload); };
  return {
    async probe() {
      return { kind: 'none', vendor: null, needsDownload: false, continuous: false, reason: 'not set up yet' };
    },
    async install() { return false; },
    async start() {
      emit('state', { listening: false });
      emit('error', { code: 'service-not-allowed' });
    },
    stop() {},
    on(event, fn) {
      listeners[event].add(fn);
      return () => listeners[event].delete(fn);
    },
  };
}
