// Sound that moves the light: the microphone, what the computer plays, or a music file.
// See CONTRACTS.md, "renderer/audio/".
//
//   const audio = createAudio({ bridge });
//   await audio.useMic(deviceId)   → { ok: true, label } | { ok: false, error }
//   await audio.useSystem()        → the same
//   await audio.useFile(fileOrUrl) → the same (a File from a picker or a drop, or a URL)
//   audio.stop()
//   audio.update(dt) every frame, then audio.features() → { level, bass, mid, high, onset, beat, bpm }
//
// Also, for the Sound panel: `source` ('off' | 'mic' | 'system' | 'file'), `label` (what is
// heard: a device or a file name), `error` (why the last try failed, or why the sound
// stopped by itself), `hint` (advice that is not a failure, such as "nothing is coming
// through"), `devices({ reveal })` → [{ deviceId, label, monitor }], and `on('change', fn)`
// → off, called whenever any of those change.
//
// A file plays out loud. The microphone and the computer's own sound are only listened to,
// never played back, so there is no echo. Each source fails with a reason a person can act
// on, and never with a console error: a missing microphone is not a fault in the app.
//
// The analyser's own smoothing is off; features.js smooths in seconds, so the light moves the
// same at any frame rate.
import { createEmitter } from '../../../../Tactilume/src/js/core/util.js';
import { createFeatureTracker, SILENT } from './features.js';

const FFT_SIZE = 2048;
const FILE_TIMEOUT_MS = 15000;   // a file that is not playable by then is not going to be
const QUIET_SECONDS = 3;         // computer sound that stays exactly silent this long earns a hint
// Inputs that carry what the computer plays rather than a microphone: PulseAudio and
// PipeWire monitors, Windows' Stereo Mix, and the usual virtual loopback devices.
const MONITOR = /\bmonitor\b|stereo mix|loopback|what u hear|blackhole|soundflower/i;
const FILE_KINDS = 'MP3, AAC, FLAC, Ogg, Opus and WAV';

const REASONS = {
  noWebAudio: 'This system cannot process sound, so the light cannot follow it.',
  noMicApi: 'This window cannot use a microphone.',
  micDenied: 'Tactilume is not allowed to use the microphone. Allow it in your system\'s privacy settings, then try again.',
  micMissing: 'No microphone was found. Plug one in, or choose another sound.',
  micGone: 'That microphone is not connected any more. Choose another one.',
  micBusy: 'The microphone could not start. Another app may be using it.',
  micSilent: 'The microphone gave no sound.',
  micStopped: 'The microphone stopped. It may have been unplugged.',
  systemNone: 'Tactilume cannot hear what this computer plays here. Play a music file instead, or use a microphone.',
  systemOldMac: 'Hearing what this computer plays needs macOS 14.2 or later. Play a music file instead, or use a microphone.',
  systemDenied: 'Tactilume was not allowed to hear what this computer plays.',
  systemDeniedMac: 'macOS did not let Tactilume hear what this computer plays. Allow it in System Settings, Privacy & Security, Screen & System Audio Recording, then try again.',
  systemGesture: 'Choose Computer audio again: it has to start from a click or a key press.',
  systemRefused: 'This computer did not share its sound with Tactilume.',
  systemNoSound: 'The computer shared no sound.',
  systemBusy: 'What this computer plays could not be captured. Another app may be using it.',
  systemStopped: 'Listening to the computer stopped.',
  systemLinux: 'This Linux system lists no input that carries what the computer plays. Choose Microphone, then, in your sound settings (for example pavucontrol, on its Recording tab), switch Tactilume\'s input to "Monitor of" your speakers.',
  systemQuiet: 'No sound is coming through yet. If something is playing, check that Tactilume may record this computer\'s sound.',
  fileNone: 'Choose a music file to play.',
  fileKind: `Tactilume cannot play this kind of file. ${FILE_KINDS} files work.`,
  fileDamaged: 'This file could not be decoded. It may be damaged.',
  fileUnreadable: 'The file could not be read.',
  fileSlow: 'The file took too long to load.',
  fileGesture: 'Sound can only start after a click or a key press. Click, then choose the file again.',
  fileStopped: 'The music file stopped playing.',
  replaced: 'Another sound was chosen meanwhile.',
};

const isBlob = (x) => typeof Blob !== 'undefined' && x instanceof Blob;

function micError(e) {
  switch (e && e.name) {
    case 'NotAllowedError': case 'SecurityError': case 'PermissionDeniedError': return REASONS.micDenied;
    case 'NotFoundError': case 'DevicesNotFoundError': return REASONS.micMissing;
    case 'OverconstrainedError': case 'ConstraintNotSatisfiedError': return REASONS.micGone;
    case 'NotReadableError': case 'TrackStartError': case 'AbortError': return REASONS.micBusy;
    default: return `The microphone could not start (${(e && e.name) || 'an unknown problem'}).`;
  }
}

function systemError(e, platform) {
  switch (e && e.name) {
    case 'NotAllowedError': case 'SecurityError': return platform === 'darwin' ? REASONS.systemDeniedMac : REASONS.systemDenied;
    case 'InvalidStateError': return REASONS.systemGesture;
    // In the app nobody picks anything, so an abort means the main process shared nothing
    // (Electron 45 says "Invalid capture constraints"): no screen to share, or not allowed.
    case 'AbortError': return platform === 'darwin' ? REASONS.systemDeniedMac : REASONS.systemRefused;
    case 'NotSupportedError': case 'TypeError': return REASONS.systemNone;
    case 'NotFoundError': return REASONS.systemNoSound;
    case 'NotReadableError': return REASONS.systemBusy;
    default: return `Listening to the computer could not start (${(e && e.name) || 'an unknown problem'}).`;
  }
}

// A media element's error code → what to tell the person
function fileError(err) {
  switch (err && err.code) {
    case 3: return REASONS.fileDamaged;    // MEDIA_ERR_DECODE
    case 2: return REASONS.fileUnreadable; // MEDIA_ERR_NETWORK
    default: return REASONS.fileKind;      // MEDIA_ERR_SRC_NOT_SUPPORTED, and anything odd
  }
}

// a URL's last path part, decoded, as a name to show
function nameFromUrl(url) {
  try {
    const part = new URL(url, globalThis.location?.href || 'http://localhost/').pathname.split('/').filter(Boolean).pop() || '';
    return decodeURIComponent(part) || 'Music';
  } catch {
    return 'Music';
  }
}

function stopStream(stream) {
  for (const t of stream?.getTracks?.() || []) {
    try { t.stop(); } catch { /* already stopped */ }
  }
}

// Speech processing pumps the gain and gates quiet passages, which ruins music, so it is off.
function micConstraints(deviceId) {
  const c = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 }, sampleRate: { ideal: 48000 } };
  if (typeof deviceId === 'string' && deviceId) c.deviceId = { exact: deviceId };
  return c;
}

export function createAudio({
  bridge,
  mediaDevices = globalThis.navigator?.mediaDevices,
  AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
  makeElement = () => new Audio(),
} = {}) {
  const ev = createEmitter();
  let ctx = null, analyser = null, sink = null, tracker = null, bins = null, quiet = null;
  // A suspend is asked for at once but the context's state only changes later, so whether the
  // sound hardware should be resting is kept here: a new source straight after stop() must
  // still wake it.
  let resting = false;
  let current = null;   // { kind, node, stream?, track?, element?, url? }
  let source = 'off';
  let label = '';
  let error = '';
  let hint = '';
  let latest = { ...SILENT };
  let ticket = 0;       // every request takes a ticket; a later request outranks an earlier one
  let heardAt = null;   // the audio clock (ctx.currentTime) at the last update

  const changed = () => ev.emit('change', { source, label, error, hint });
  const platform = () => (bridge && typeof bridge.platform === 'string' ? bridge.platform : '');

  function fail(mine, why) {
    if (mine !== ticket) return { ok: false, error: REASONS.replaced, replaced: true };
    error = why;
    hint = '';
    changed();
    return { ok: false, error: why };
  }

  // the one AudioContext, its analyser, and a silent path to the speakers that keeps every
  // browser pulling sound through the analyser
  function context() {
    if (!ctx) {
      if (!AudioContextClass) throw new Error(REASONS.noWebAudio);
      ctx = new AudioContextClass({ latencyHint: 'interactive' });
      analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0;
      sink = ctx.createGain();
      sink.gain.value = 0;
      analyser.connect(sink);
      sink.connect(ctx.destination);
      tracker = createFeatureTracker({ sampleRate: ctx.sampleRate, fftSize: FFT_SIZE });
      bins = new Float32Array(analyser.frequencyBinCount);
      quiet = new Float32Array(analyser.frequencyBinCount).fill(-Infinity);
    }
    if (resting || ctx.state === 'suspended') {
      resting = false;
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function release(c) {
    if (!c) return;
    try { c.node?.disconnect(); } catch { /* already disconnected */ }
    if (c.stream) stopStream(c.stream);
    if (c.element) {
      const el = c.element;
      c.element = null;
      el.onerror = null;
      try { el.pause(); } catch { /* not playing */ }
      // dropping the source lets the browser free its decoder
      try { el.removeAttribute('src'); el.load(); } catch { /* a stand-in element */ }
    }
    if (c.url) {
      try { URL.revokeObjectURL(c.url); } catch { /* not ours */ }
    }
  }

  // listening starts: the new source replaces the old one
  function attach(kind, c, name) {
    release(current);
    current = { kind, ...c, quietFor: 0, heard: false };
    c.node.connect(analyser);
    // only a file is heard: the microphone and the computer's sound are analysed silently
    if (kind === 'file') c.node.connect(ctx.destination);
    source = kind;
    label = name;
    error = '';
    hint = '';
    tracker.reset();
    latest = { ...SILENT };
    heardAt = null;
    changed();
    return { ok: true, label };
  }

  // the source stops by itself (unplugged, ended, revoked): say why
  function stoppedBy(why, c) {
    if (current !== c) return;
    stopNow();
    error = why;
    changed();
  }

  function stopNow() {
    release(current);
    current = null;
    source = 'off';
    label = '';
    hint = '';
    latest = { ...SILENT };
    tracker?.reset();
    // nothing to listen to: let the sound hardware rest
    if (ctx && !resting) {
      resting = true;
      ctx.suspend().catch(() => {});
    }
  }

  function watchEnded(track, why) {
    const c = current;
    track.addEventListener?.('ended', () => stoppedBy(why, c), { once: true });
  }

  // Opens an input device as a stream source. Used for microphones, and on Linux for the
  // monitor input that carries what the computer plays.
  async function openInput(mine, deviceId, kind, fallbackLabel) {
    if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') return fail(mine, REASONS.noMicApi);
    let stream;
    try {
      stream = await mediaDevices.getUserMedia({ audio: micConstraints(deviceId), video: false });
    } catch (e) {
      return fail(mine, micError(e));
    }
    if (mine !== ticket) { stopStream(stream); return fail(mine, ''); }
    const track = stream.getAudioTracks?.()[0];
    if (!track || track.readyState === 'ended') { stopStream(stream); return fail(mine, REASONS.micSilent); }
    try { context(); } catch (e) { stopStream(stream); return fail(mine, e.message); }
    const result = attach(kind, { node: ctx.createMediaStreamSource(stream), stream, track }, track.label || fallbackLabel);
    watchEnded(track, kind === 'mic' ? REASONS.micStopped : REASONS.systemStopped);
    return result;
  }

  async function listInputs() {
    if (!mediaDevices || typeof mediaDevices.enumerateDevices !== 'function') return [];
    try {
      return (await mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    } catch {
      return [];
    }
  }

  // The inputs, named. Browsers hide the names until a microphone has been allowed once; then
  // a moment's listen (stopped at once) reveals them, so a monitor input can be recognised.
  async function inputsWithNames() {
    let inputs = await listInputs();
    if (inputs.length && inputs.every((d) => !d.label) && typeof mediaDevices?.getUserMedia === 'function') {
      try {
        stopStream(await mediaDevices.getUserMedia({ audio: true, video: false }));
        inputs = await listInputs();
      } catch { /* not allowed: the names stay hidden */ }
    }
    return inputs;
  }

  // What the computer plays, through the screen-share route: Electron's main process answers
  // with the screen and loopback audio (src/main/audio-capture.js). Only the sound is wanted,
  // so the picture is dropped at once.
  async function loopback(mine) {
    if (!mediaDevices || typeof mediaDevices.getDisplayMedia !== 'function') return fail(mine, REASONS.systemNone);
    let stream;
    try {
      // systemAudio is a hint for a browser's own picker; in the app the main process decides
      stream = await mediaDevices.getDisplayMedia({ audio: true, video: true, systemAudio: 'include' });
    } catch (e) {
      return fail(mine, systemError(e, platform()));
    }
    for (const t of stream.getVideoTracks?.() || []) {
      try { t.stop(); stream.removeTrack(t); } catch { /* gone already */ }
    }
    if (mine !== ticket) { stopStream(stream); return fail(mine, ''); }
    const track = stream.getAudioTracks?.()[0];
    if (!track) { stopStream(stream); return fail(mine, REASONS.systemNoSound); }
    // macOS hands over an ended track, and no error, when the permission is missing
    if (track.readyState === 'ended') { stopStream(stream); return fail(mine, platform() === 'darwin' ? REASONS.systemDeniedMac : REASONS.systemNoSound); }
    try { context(); } catch (e) { stopStream(stream); return fail(mine, e.message); }
    const result = attach('system', { node: ctx.createMediaStreamSource(stream), stream, track, watchQuiet: true }, 'This computer');
    watchEnded(track, REASONS.systemStopped);
    return result;
  }

  // Linux: PipeWire and PulseAudio can offer a "monitor" input that carries the speakers'
  // sound; when one is listed it is opened like a microphone.
  async function monitor(mine) {
    const found = (await inputsWithNames()).find((d) => MONITOR.test(d.label || ''));
    if (mine !== ticket) return fail(mine, '');
    if (!found) return fail(mine, REASONS.systemLinux);
    return openInput(mine, found.deviceId, 'system', found.label);
  }

  // Waits until the element can play, or fails. → '' or the reason.
  function playable(el) {
    return new Promise((resolve) => {
      let timer = 0;
      const done = (why) => {
        clearTimeout(timer);
        el.removeEventListener?.('canplay', onReady);
        el.removeEventListener?.('error', onError);
        resolve(why);
      };
      const onReady = () => done('');
      const onError = () => done(fileError(el.error));
      el.addEventListener?.('canplay', onReady);
      el.addEventListener?.('error', onError);
      timer = setTimeout(() => done(REASONS.fileSlow), FILE_TIMEOUT_MS);
      if (el.readyState >= 3) done('');
    });
  }

  return {
    get source() { return source; },
    get label() { return label; },
    get error() { return error; },
    get hint() { return hint; },
    on: ev.on,

    useMic(deviceId) {
      const mine = ++ticket;
      return openInput(mine, deviceId, 'mic', 'Microphone');
    },

    async useSystem() {
      const mine = ++ticket;
      let support = { supported: false, how: 'none' };
      try {
        support = (await bridge?.audio?.systemSupport?.()) || support;
      } catch { /* no answer: treat as unsupported */ }
      if (mine !== ticket) return fail(mine, '');
      if (support.how === 'loopback') return loopback(mine);
      if (support.how === 'monitor-device') return monitor(mine);
      return fail(mine, platform() === 'darwin' ? REASONS.systemOldMac : REASONS.systemNone);
    },

    async useFile(fileOrUrl) {
      const mine = ++ticket;
      let url = '', name = '', ours = false, type = '';
      if (isBlob(fileOrUrl)) {
        type = fileOrUrl.type || '';
        // Only what is plainly not sound is turned away here. Systems label music files in odd
        // ways (application/ogg, audio/x-flac, none at all), so everything else gets a try and
        // the <audio> element decides.
        if (/^(text|image|font)\//.test(type)) return fail(mine, REASONS.fileKind);
        url = URL.createObjectURL(fileOrUrl);
        ours = true;
        name = fileOrUrl.name || 'Music file';
      } else if (typeof fileOrUrl === 'string' && fileOrUrl) {
        url = fileOrUrl;
        name = nameFromUrl(url);
      } else {
        return fail(mine, REASONS.fileNone);
      }
      try { context(); } catch (e) {
        if (ours) URL.revokeObjectURL(url);
        return fail(mine, e.message);
      }
      const el = makeElement();
      const dropIt = () => release({ element: el, url: ours ? url : '' });
      el.loop = true;
      el.preload = 'auto';
      el.src = url;
      const why = await playable(el);
      if (mine !== ticket) { dropIt(); return fail(mine, ''); }
      if (why) { dropIt(); return fail(mine, why); }
      const result = attach('file', { node: ctx.createMediaElementSource(el), element: el, url: ours ? url : '' }, name);
      const c = current;
      el.onerror = () => stoppedBy(fileError(el.error), c);
      try {
        await el.play();
      } catch (e) {
        // replaced meanwhile, or already stopped by a media error that said why
        if (current !== c) return { ok: false, error: mine === ticket ? error : REASONS.replaced };
        stopNow();
        return fail(mine, e && e.name === 'NotAllowedError' ? REASONS.fileGesture : REASONS.fileKind);
      }
      return result;
    },

    stop() {
      ticket++;
      const was = source;
      stopNow();
      error = '';
      if (was !== 'off') changed();
    },

    // [{ deviceId, label, monitor }]: the inputs to choose from; monitor marks one that carries
    // what the computer plays rather than a microphone. Until a microphone has been allowed the
    // names are hidden; { reveal: true } asks for that permission to show them (call it when
    // the person opens the chooser, not before).
    async devices({ reveal = false } = {}) {
      const inputs = reveal ? await inputsWithNames() : await listInputs();
      return inputs.map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}`, monitor: MONITOR.test(d.label || '') }));
    },

    update(dt) {
      if (!current || !analyser) return;
      const running = ctx.state === 'running';
      // The features follow the sound's own clock, not the frame's: main.js caps a frame's dt
      // for the simulation, and on a slow frame that would slow the tracker's clock and make
      // every tempo read too fast. The frame's dt stands in until the clock has a reading.
      const now = ctx.currentTime;
      const audioStep = running && Number.isFinite(now) && heardAt !== null ? Math.max(0, Math.min(now - heardAt, 0.25)) : null;
      heardAt = running && Number.isFinite(now) ? now : null;
      const step = audioStep ?? (Number.isFinite(dt) && dt > 0 ? dt : 0);
      // a suspended context delivers no new sound; it counts as silence
      if (running) analyser.getFloatFrequencyData(bins);
      latest = tracker.update(running ? bins : quiet, step);
      if (current.watchQuiet && !current.heard) {
        if (latest.level > 0) current.heard = true;
        else if ((current.quietFor += step) > QUIET_SECONDS && !hint) {
          hint = REASONS.systemQuiet;
          changed();
        }
      }
      if (hint === REASONS.systemQuiet && latest.level > 0) {
        hint = '';
        changed();
      }
    },

    features: () => ({ ...latest }),
  };
}
