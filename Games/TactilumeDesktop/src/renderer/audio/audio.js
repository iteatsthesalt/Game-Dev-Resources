// Sound that moves the light: the microphone, what the computer plays, or a music file.
// See CONTRACTS.md, "renderer/audio/".
//
// First version, written by the spine: it is always silent and every source says it is not
// available yet. The input-audio part owns this file and replaces it.

const SILENT = Object.freeze({ level: 0, bass: 0, mid: 0, high: 0, onset: 0, beat: 0, bpm: 0 });
const unavailable = async () => ({ ok: false, error: 'not available yet' });

export function createAudio({ bridge }) {
  return {
    source: 'off', // 'off' | 'mic' | 'system' | 'file'
    useMic: unavailable,
    useSystem: unavailable,
    useFile: unavailable,
    stop() {},
    devices: async () => [],
    update(dt) {},
    features: () => ({ ...SILENT }),
  };
}
