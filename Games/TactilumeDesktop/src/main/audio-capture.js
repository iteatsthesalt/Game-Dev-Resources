// What the computer plays ("system audio"), for the Sound panel. See CONTRACTS.md,
// "main/audio-capture.js".
//
// Chromium captures the system's output together with a screen share where the OS allows it:
// Windows 10 and 11, and macOS 14.2 and later (Core Audio taps; the app's Info.plist needs
// NSAudioCaptureUsageDescription, and macOS asks the person once). The renderer asks with
// getDisplayMedia({ audio: true, video: true }); the handler below answers with the primary
// screen plus loopback audio, so no picker appears, and the renderer drops the picture at
// once. Linux has no route Electron promises: PipeWire and PulseAudio "monitor" inputs, where
// the system lists them, are opened like microphones instead (renderer/audio/audio.js).
//
// This module does not import electron, so it is unit-tested in plain Node: main.js passes in
// Electron's desktopCapturer.

// `release` is os.release(): on macOS that is the Darwin kernel version (23.2 = macOS 14.2).
export function systemAudioSupport({ platform, release = '' } = {}) {
  if (platform === 'win32') return { supported: true, how: 'loopback' };
  if (platform === 'darwin') {
    const [major = 0, minor = 0] = String(release).split('.').map((n) => parseInt(n, 10) || 0);
    const ok = major > 23 || (major === 23 && minor >= 2);
    return ok ? { supported: true, how: 'loopback' } : { supported: false, how: 'none' };
  }
  if (platform === 'linux') return { supported: true, how: 'monitor-device' };
  return { supported: false, how: 'none' };
}

// Options beyond CONTRACTS.md, all optional:
//   allow(request)        → false to refuse a request, for example one from a page that is
//                           not the app's own (main.js can check request.frame.url)
//   primaryDisplayId()    → the primary display's id (Electron's screen.getPrimaryDisplay().id),
//                           to share that screen; without it, the first screen listed is used
//   log(line)             → where to say why a capture could not start
export function installDisplayMedia(session, { platform, release, desktopCapturer, allow = () => true, primaryDisplayId = null, log = () => {} } = {}) {
  const { how } = systemAudioSupport({ platform, release });
  session.setDisplayMediaRequestHandler((request, callback) => {
    const answer = (streams) => {
      // the frame may be gone by now, and then the callback throws
      try { callback(streams); } catch (e) { log(`display capture: ${e.message}`); }
    };
    // The app only shares a screen to reach its sound. Where the OS has no loopback, when the
    // page did not ask for sound, or when the page is not allowed, nothing is shared at all.
    let allowed = false;
    try { allowed = !!allow(request); } catch { allowed = false; }
    if (how !== 'loopback' || !request || !request.audioRequested || !allowed) return answer(null);
    // no thumbnails: nobody sees them, and drawing them costs time
    Promise.resolve()
      .then(() => desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } }))
      .then((sources) => {
        if (!Array.isArray(sources) || !sources.length) return answer(null);
        let id = null;
        try { id = typeof primaryDisplayId === 'function' ? String(primaryDisplayId()) : null; } catch { id = null; }
        const screen = sources.find((s) => id !== null && String(s.display_id) === id) || sources[0];
        // never 'loopbackWithMute': that would silence the person's speakers while listening
        answer({ video: screen, audio: 'loopback' });
      })
      .catch((e) => {
        log(`display capture: no screen to share (${e && e.message})`);
        answer(null);
      });
  });
}
