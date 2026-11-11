// Sound for Tactilume: the generative instrument the light plays, listening to the
// microphone or a song so the light can move with it, and the track recordings carry.
//
// Nothing here makes a sound, opens the microphone or even creates an AudioContext
// until the settings ask for it and a touch, click or key has unlocked audio
// (browsers only let sound start inside a user gesture).
//
//   instrument -> gate (Sound on/off) --+--> limiter -> master (Volume) -> speakers
//   song -------> song level -----------+                             \-> recording track
//   song, microphone -> analyser (the microphone never reaches the speakers)

import { clamp } from '../core/util.js';
import { createSynth } from './synth.js';
import { createAnalyser, SILENT } from './analyser.js';

const FADE_OUT = 0.3; // s, when Sound is switched off
const SONG_LEVEL = 0.7; // a mastered song is loud; leave the instrument room on top
const RESUME_RETRY = 1; // s between attempts to wake a context the browser paused

const AudioContextClass = typeof window !== 'undefined' ? window.AudioContext : undefined;
// Activation-triggering events. A touch's pointerdown is not one on Android Chrome or
// iOS Safari, so unlocking only on pointerdown would miss the very first touch.
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'];

// Volume 0..1 to gain, on a curve that sounds even across the slider.
const volumeGain = (v) => Math.pow(clamp(Number.isFinite(v) ? v : 0.6, 0, 1), 1.2);

// The output chain, shared by the live app and offline renders (used to make audition files).
export function createSoundGraph(ctx) {
  const synth = createSynth(ctx);
  const gate = ctx.createGain();
  gate.gain.value = 0;
  // a gentle limiter: the instrument stays below it; it only catches rare pile-ups
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -5;
  limiter.knee.value = 5;
  limiter.ratio.value = 14;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  const master = ctx.createGain();
  master.gain.value = 0;
  const songLevel = ctx.createGain();
  songLevel.gain.value = SONG_LEVEL;
  synth.output.connect(gate);
  gate.connect(limiter);
  songLevel.connect(limiter);
  limiter.connect(master);
  master.connect(ctx.destination);
  const analyser = createAnalyser(ctx);
  return { synth, gate, limiter, master, songLevel, analyser };
}

function micError(e) {
  switch (e && e.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'The microphone is not allowed. You can turn it on in your browser or app settings.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'No microphone was found.';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'The microphone is busy. Close other apps that use it and try again.';
    case 'NotSupportedError':
      return 'This browser cannot listen to the microphone here.';
    default:
      return 'The microphone could not start.';
  }
}

function stopStream(stream) {
  try { for (const t of stream.getTracks()) t.stop(); } catch { /* already stopped */ }
}

// iOS mutes Web Audio when the ring switch is on silent unless the page says it is
// playing media. Older browsers have no audioSession at all.
function setSessionType(type) {
  try {
    const session = navigator.audioSession;
    if (session && session.type !== type) session.type = type;
  } catch { /* not supported here */ }
}

// Plays a media element; settles as 'playing', 'blocked' (needs a tap first) or 'failed'.
function playElement(el, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      el.removeEventListener('error', onError);
      resolve(result);
    };
    const onError = () => finish('failed');
    const timer = setTimeout(() => finish(el.paused ? 'failed' : 'playing'), timeoutMs);
    el.addEventListener('error', onError);
    let p;
    try { p = el.play(); } catch { finish('failed'); return; }
    if (p && typeof p.then === 'function') {
      p.then(() => finish('playing'), (e) => finish(e && e.name === 'NotAllowedError' ? 'blocked' : 'failed'));
    } else {
      finish('playing');
    }
  });
}

const cleanName = (name) => String(name || 'Song').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) || 'Song';

// `onSourceEnded(kind)`: the microphone ('mic') or the song ('file') stopped by itself
// (unplugged, permission taken back, a broken file), so the setting can say so too.
export function createAudio({ getSettings, onSourceEnded = () => {} }) {
  const ended = (kind) => { try { onSourceEnded(kind); } catch (e) { console.warn('Tactilume: onSourceEnded failed', e); } };
  let ctx = null;
  let graph = null;
  let mic = null; // { stream, source }
  let song = null; // { el, url, source, name, waiting }
  let recorder = null; // MediaStreamAudioDestinationNode, made on the first recordTrack()
  const handedTracks = []; // clones given to recordings; a live one keeps the context awake
  let applied = null; // the settings object last applied (store settings are replaced on change)
  let suspendTimer = 0;
  let pending = 0; // microphone or song requests in flight
  let feeds = 0; // test signals fed into the analyser
  let lastResumeTry = -Infinity;
  let resumedAt = -Infinity; // ms, the last resume() call
  let aspect = 1;
  let disposed = false;
  let running = false; // ctx.state === 'running', kept by statechange so frames need not ask
  let contextFailed = false;

  function liveTracks() {
    for (let i = handedTracks.length - 1; i >= 0; i--) {
      if (handedTracks[i].readyState === 'ended') handedTracks.splice(i, 1);
    }
    return handedTracks.length > 0;
  }

  // Notes are scheduled on a running context, or one waking up from this very touch
  // (the first touch both starts the context and rings). A context paused for longer
  // would play its backlog all at once when it wakes, so those notes are dropped.
  const canPlay = () => !!graph && (running || (ctx.state === 'suspended' && performance.now() - resumedAt < 800));

  const needsContext = () => !!(getSettings().sound || mic || song || pending || feeds || liveTracks());

  function updateSession() {
    if (mic) setSessionType('auto'); // let the browser pick a mode that can record
    else setSessionType(getSettings().sound || song ? 'playback' : 'auto');
  }

  function scheduleSuspend() {
    clearTimeout(suspendTimer);
    suspendTimer = setTimeout(() => {
      suspendTimer = 0;
      if (!ctx || disposed || needsContext()) return;
      graph.synth.silence();
      ctx.suspend().catch(() => { /* closed meanwhile */ });
    }, FADE_OUT * 1000 + 80);
  }

  function resume() {
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed' || document.hidden) return;
    clearTimeout(suspendTimer);
    suspendTimer = 0;
    resumedAt = performance.now();
    try {
      const p = ctx.resume();
      if (p && typeof p.catch === 'function') p.catch(() => { /* still locked: the next gesture retries */ });
    } catch { /* a closed context */ }
  }

  function applySettings(s) {
    if (!graph) return;
    const now = ctx.currentTime;
    const prev = applied;
    applied = s;
    if (!prev || s.volume !== prev.volume) {
      graph.master.gain.setTargetAtTime(volumeGain(s.volume), now, prev ? 0.06 : 0.005);
    }
    if (!prev || s.sound !== prev.sound) {
      const gate = graph.gate.gain;
      gate.cancelScheduledValues(now);
      // about -43 dB after FADE_OUT: silent to the ear
      gate.setTargetAtTime(s.sound ? 1 : 0, now, s.sound ? 0.04 : FADE_OUT / 5);
      graph.synth.setEnabled(s.sound);
      if (!s.sound) scheduleSuspend();
      updateSession();
    }
    if (!prev || s.calm !== prev.calm) graph.synth.setCalm(s.calm);
    if (prev && s.react !== prev.react) {
      // React switched off some other way (say, Reset settings): stop listening for real.
      // Not while a request is in flight: that is an earlier pick failing, not a choice.
      if (s.react === 'off' && !pending) { stopMic(); stopFile(); }
      graph.analyser.reset();
    }
  }

  function ensureContext() {
    if (ctx) return true;
    if (disposed || contextFailed || !AudioContextClass) return false;
    // Before any gesture a new context would only be stuck, with a console warning.
    const activation = navigator.userActivation;
    if (activation && !activation.hasBeenActive) return false;
    try {
      ctx = new AudioContextClass({ latencyHint: 'interactive' });
      graph = createSoundGraph(ctx);
    } catch (e) {
      console.warn('Tactilume: sound could not start', e);
      try { if (ctx) ctx.close(); } catch { /* never opened */ }
      ctx = null;
      graph = null;
      contextFailed = true; // once is enough: do not warn again on every tap
      return false;
    }
    const created = ctx;
    running = created.state === 'running';
    created.addEventListener('statechange', () => { if (ctx === created) running = created.state === 'running'; });
    graph.synth.setAspect(aspect);
    applied = null;
    applySettings(getSettings());
    // iOS lets a context make sound only after something has played inside a gesture
    try {
      const blip = ctx.createBufferSource();
      blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      blip.connect(ctx.destination);
      blip.start();
    } catch { /* not needed elsewhere */ }
    return true;
  }

  const noContextReason = () => (AudioContextClass && !disposed && !contextFailed
    ? 'Tap the screen once, then try again.' // no gesture yet, so the browser holds sound back
    : 'Sound is not available in this browser.');

  function startSong() {
    if (!song) return;
    const el = song.el;
    playElement(el).then((result) => {
      if (!song || song.el !== el) return;
      song.waiting = result !== 'playing';
    });
  }

  function stopMic() {
    if (!mic) return;
    try { mic.source.disconnect(); } catch { /* already disconnected */ }
    stopStream(mic.stream);
    mic = null;
    if (graph) graph.analyser.reset();
    updateSession();
  }

  function stopFile() {
    if (!song) return;
    const { el, url, source } = song;
    song = null;
    try { el.pause(); } catch { /* already paused */ }
    try { source.disconnect(); } catch { /* already disconnected */ }
    try { el.removeAttribute('src'); el.load(); } catch { /* nothing loaded */ }
    try { URL.revokeObjectURL(url); } catch { /* already revoked */ }
    if (graph) graph.analyser.reset();
    updateSession();
  }

  function unlock() {
    if (disposed) return;
    const s = getSettings();
    if (!s.sound && s.react === 'off' && !mic && !song) return;
    if (!ensureContext()) return;
    if (s !== applied) applySettings(s);
    if (needsContext()) resume();
    if (song && song.waiting) startSong();
  }

  function onVisibility() {
    if (!ctx) return;
    if (document.hidden) {
      // a hidden page should be silent and cost nothing
      if (song) { try { song.el.pause(); } catch { /* not playing */ } }
      if (ctx.state === 'running') ctx.suspend().catch(() => { /* closed */ });
    } else if (needsContext()) {
      resume();
      if (song) startSong();
    }
  }

  function measureAspect() {
    try { aspect = innerWidth / innerHeight || 1; } catch { aspect = 1; }
    if (graph) graph.synth.setAspect(aspect);
  }

  const onGesture = () => unlock();
  for (const name of GESTURES) addEventListener(name, onGesture, { capture: true, passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  addEventListener('resize', measureAspect);
  measureAspect();

  const audio = {
    unlock,

    update(dt, frame) {
      if (!graph) return;
      const s = getSettings();
      if (s !== applied) applySettings(s);
      if (!running) {
        // the browser paused us (another app took the audio, say): try again now and then
        const now = performance.now() / 1000;
        if (needsContext() && now - lastResumeTry > RESUME_RETRY) { lastResumeTry = now; resume(); }
        return;
      }
      if (frame) {
        if (Number.isFinite(frame.aspect) && frame.aspect !== aspect) { aspect = frame.aspect; graph.synth.setAspect(aspect); }
        graph.synth.update(dt, frame.poles, frame.behaviour);
      }
      if (!suspendTimer && !needsContext()) scheduleSuspend();
    },

    noteDown(e) {
      if (canPlay()) graph.synth.noteDown(e);
    },
    noteUp(e) {
      if (canPlay()) graph.synth.noteUp(e);
    },
    behaviourChanged(key) {
      if (graph) graph.synth.behaviourChanged(key);
    },

    analysis() {
      if (!graph || (!mic && !song && !feeds) || !running) return SILENT;
      const s = getSettings();
      if (s.react === 'off' && !feeds) return SILENT;
      return graph.analyser.read(s.sensitivity, performance.now());
    },

    async startMic() {
      if (mic) return { ok: true };
      const devices = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
      if (!devices || typeof devices.getUserMedia !== 'function') {
        return { ok: false, error: 'This browser cannot listen to the microphone here.' };
      }
      if (!ensureContext()) return { ok: false, error: noContextReason() };
      resume(); // inside the tap, before the permission prompt takes it away
      pending++;
      let stream;
      try {
        stream = await devices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      } catch (e) {
        return { ok: false, error: micError(e) };
      } finally {
        pending--;
      }
      if (disposed || !graph) { stopStream(stream); return { ok: false, error: 'Sound was switched off.' }; }
      if (mic) { stopStream(stream); return { ok: true }; } // a second request won the race
      let source;
      try {
        source = ctx.createMediaStreamSource(stream);
      } catch (e) {
        console.warn('Tactilume: microphone source failed', e);
        stopStream(stream);
        return { ok: false, error: 'The microphone could not start.' };
      }
      stopFile();
      source.connect(graph.analyser.input); // the analyser only: never to the speakers
      graph.analyser.reset();
      mic = { stream, source };
      // unplugged, or permission taken back while listening
      for (const t of stream.getAudioTracks()) t.addEventListener('ended', () => { if (mic && mic.stream === stream) { stopMic(); ended('mic'); } });
      updateSession();
      resume();
      return { ok: true };
    },

    stopMic,

    async playFile(file) {
      if (!file || typeof file !== 'object' || typeof file.size !== 'number') return { ok: false, error: 'No song was chosen.' };
      if (file.type && !/^(audio|video)\//.test(file.type)) {
        return { ok: false, error: 'That file is not a song. Try an MP3, M4A, OGG or WAV file.' };
      }
      if (!ensureContext()) return { ok: false, error: noContextReason() };
      resume();
      stopFile();
      stopMic();
      let url, el, source;
      try {
        url = URL.createObjectURL(file);
        el = document.createElement('audio');
        el.loop = true;
        el.preload = 'auto';
        el.src = url;
        // routed through the graph, so it is heard at the app's volume, recorded, and analysed
        source = ctx.createMediaElementSource(el);
      } catch (e) {
        console.warn('Tactilume: song could not open', e);
        try { if (url) URL.revokeObjectURL(url); } catch { /* never made */ }
        return { ok: false, error: 'That song could not be opened.' };
      }
      source.connect(graph.songLevel);
      source.connect(graph.analyser.input);
      song = { el, url, source, name: cleanName(file.name), waiting: false };
      pending++;
      const result = await playElement(el);
      pending--;
      if (!song || song.el !== el) return { ok: false, error: 'The song was stopped.' };
      if (result === 'failed') {
        stopFile();
        return { ok: false, error: 'That song could not be played. Try an MP3, M4A, OGG or WAV file.' };
      }
      // 'blocked': some browsers want a tap first; the next touch starts it
      song.waiting = result === 'blocked';
      el.addEventListener('error', () => { if (song && song.el === el) { stopFile(); ended('file'); } });
      graph.analyser.reset();
      updateSession();
      return { ok: true };
    },

    stopFile,

    get fileName() { return song ? song.name : ''; },

    // What the app plays (instrument and song, never the microphone), as a track a
    // recording can stop without affecting the app. Null when nothing would be heard.
    recordTrack() {
      if (!graph || ctx.state === 'closed') return null;
      if (!getSettings().sound && !song) return null;
      try {
        if (!recorder) {
          recorder = ctx.createMediaStreamDestination();
          graph.master.connect(recorder);
        }
        const track = recorder.stream.getAudioTracks()[0];
        if (!track) return null;
        const copy = track.clone();
        handedTracks.push(copy);
        return copy;
      } catch (e) {
        console.warn('Tactilume: no sound track for the recording', e);
        return null;
      }
    },

    // For the UI: is sound running, and what is it listening to?
    state() {
      const c = !ctx || ctx.state === 'closed' ? 'none' : ctx.state === 'running' ? 'running' : 'suspended';
      return { context: c, mic: !!mic, file: !!song };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(suspendTimer);
      for (const name of GESTURES) removeEventListener(name, onGesture, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility);
      removeEventListener('resize', measureAspect);
      stopMic();
      stopFile();
      for (const t of handedTracks) { try { t.stop(); } catch { /* already ended */ } }
      handedTracks.length = 0;
      if (graph) { graph.synth.dispose(); graph.analyser.dispose(); }
      if (ctx) ctx.close().catch(() => { /* already closed */ });
      running = false;
      ctx = null;
      graph = null;
      recorder = null;
    },

    // Test seams for the automated checks: the live context and master, a way to feed a
    // test signal into the analyser (returns a function that unplugs it), voice counts.
    _debug: {
      get context() { return ctx; },
      get master() { return graph ? graph.master : null; },
      feed(node) {
        if (!graph) return () => {};
        node.connect(graph.analyser.input);
        feeds++;
        graph.analyser.reset();
        let plugged = true;
        return () => {
          if (!plugged) return;
          plugged = false;
          feeds--;
          try { node.disconnect(graph.analyser.input); } catch { /* gone with the context */ }
        };
      },
      stats() { return graph ? graph.synth.stats() : null; },
    },
  };
  return audio;
}
