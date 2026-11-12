// System audio ("what the computer is playing") for the sound panel.
//
// Chromium can capture the system's output together with a screen share where the OS allows
// it (Windows; macOS 14.2 and later). The renderer asks with getDisplayMedia, and the handler
// below answers with the primary screen plus loopback audio, so no picker appears. On Linux,
// PipeWire and PulseAudio list "monitor" sources as ordinary microphones instead.
//
// First version, written by the spine. The input-audio part owns this file and replaces it.
// It does not import electron, so it can be unit-tested in plain Node: main.js passes in
// Electron's desktopCapturer.

// `release` is os.release(): on macOS that is the Darwin kernel version (23.2 = macOS 14.2).
export function systemAudioSupport({ platform, release = '' }) {
  if (platform === 'win32') return { supported: true, how: 'loopback' };
  if (platform === 'darwin') {
    const [major = 0, minor = 0] = String(release).split('.').map((n) => parseInt(n, 10) || 0);
    const ok = major > 23 || (major === 23 && minor >= 2);
    return ok ? { supported: true, how: 'loopback' } : { supported: false, how: 'none' };
  }
  if (platform === 'linux') return { supported: true, how: 'monitor-device' };
  return { supported: false, how: 'none' };
}

export function installDisplayMedia(session, { platform, release, desktopCapturer }) {
  const { how } = systemAudioSupport({ platform, release });
  session.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] })
      .then((sources) => {
        // no screen to share means no stream: an empty answer refuses the request
        if (!sources.length) return callback({});
        callback(how === 'loopback' ? { video: sources[0], audio: 'loopback' } : { video: sources[0] });
      })
      .catch(() => callback({}));
  });
}
