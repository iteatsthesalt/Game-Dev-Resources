// STUB: replaced by the real module. Matches CONTRACTS.md so the app builds.
const SILENT = Object.freeze({ level: 0, bass: 0, mid: 0, high: 0, onset: 0 });

export function createAudio({ getSettings }) {
  return {
    unlock() {},
    update() {},
    noteDown() {},
    noteUp() {},
    behaviourChanged() {},
    analysis: () => SILENT,
    async startMic() { return { ok: false, error: 'not built yet' }; },
    stopMic() {},
    async playFile() { return { ok: false, error: 'not built yet' }; },
    stopFile() {},
    fileName: '',
    recordTrack: () => null,
    dispose() {},
  };
}
