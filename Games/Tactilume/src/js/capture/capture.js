// Photos and video clips of the light. The engine hands over frames, the audio module
// what it plays, and the platform saves the file wherever this device keeps them.

import { createEmitter } from '../core/util.js';

const NOT_AVAILABLE = 'Recording is not available in this browser.';
// The most widely playable first: MP4 (H.264 + AAC) opens in every gallery and app,
// WebM is what Chrome and Firefox could always make.
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];
const TIMESLICE_MS = 1000;
const TICK_MS = 250;
const PHOTO_WAIT_MS = 4000; // the engine answers on its next frame; a paused page never draws one
const STOP_WAIT_MS = 4000; // a recorder that never says it stopped must not hang the app
const AUDIO_BPS = 160000;
const FULL_HD = 1920 * 1080;

const pad = (n) => String(n).padStart(2, '0');
// local time, with dots instead of colons so every file system accepts the name
function stamp(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
}

const withoutAudioCodec = (mime) => mime.replace(/,(?:mp4a\.[\d.]+|opus)$/, '');
const baseType = (mime) => (mime || '').split(';')[0].trim().toLowerCase();

// Formats this browser says it can record, best first. An empty string means "let the
// browser pick", for browsers that cannot answer the question.
function recordableMimes(withAudio) {
  if (typeof MediaRecorder.isTypeSupported !== 'function') return [''];
  const list = [];
  for (const m of MIME_CANDIDATES) {
    const mime = withAudio ? m : withoutAudioCodec(m);
    try {
      if (!list.includes(mime) && MediaRecorder.isTypeSupported(mime)) list.push(mime);
    } catch {
      // a browser that throws for a format cannot record it
    }
  }
  list.push(''); // last resort: the browser's own default
  return list;
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopTrack(track) {
  try {
    if (track && track.readyState !== 'ended') track.stop();
  } catch {
    // already gone
  }
}

export function createCapture({ engine, audio, platform }) {
  const ev = createEmitter();
  let rec = null; // the recording in progress, from start until its recorder has stopped
  let saving = 0;
  let lastElapsed = 0;
  let lastMime = '';

  function elapsedOf(r) {
    const ms = r.activeMs + (r.paused || r.ended ? 0 : performance.now() - r.resumedAt);
    return Math.min(ms / 1000, r.maxSeconds);
  }

  // a listener that throws must not stop a clip from being saved
  function emit(name, ...args) {
    try {
      ev.emit(name, ...args);
    } catch (e) {
      console.warn(`Tactilume: a capture '${name}' listener failed`, e);
    }
  }

  function emitState(r) {
    lastElapsed = elapsedOf(r);
    emit('state', { recording: rec === r && !r.stopping, elapsed: lastElapsed, paused: r.paused, limit: r.maxSeconds });
  }

  function release(r) {
    for (const t of r.canvasStream.getTracks()) stopTrack(t);
    stopTrack(r.videoTrack);
    // the audio module made this copy of its output for this recording; ending it lets
    // the audio module sleep again (its own output is untouched)
    stopTrack(r.audioTrack);
  }

  // Starts a MediaRecorder with the first format that works. Called again when a
  // recorder fails before it produced anything (an encoder that refuses this canvas).
  function startRecorder(r) {
    while (r.candidates.length) {
      const mime = r.candidates.shift();
      const options = { videoBitsPerSecond: r.videoBps };
      if (r.audioTrack) options.audioBitsPerSecond = AUDIO_BPS;
      if (mime) options.mimeType = mime;
      let recorder = null;
      try {
        recorder = new MediaRecorder(r.stream, options);
        const stopped = new Promise((resolve) => recorder.addEventListener('stop', resolve, { once: true }));
        recorder.addEventListener('dataavailable', (e) => {
          if (r.recorder !== recorder || !e.data || !e.data.size) return;
          r.chunks.push(e.data);
          r.gotData = true;
        });
        recorder.addEventListener('error', (e) => onRecorderError(r, recorder, e));
        recorder.start(TIMESLICE_MS);
        r.recorder = recorder;
        r.stopped = stopped;
        r.mime = recorder.mimeType || mime;
        lastMime = r.mime;
        return true;
      } catch {
        try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch { /* never started */ }
      }
    }
    return false;
  }

  function onRecorderError(r, recorder, e) {
    if (r.recorder !== recorder || r.stopping) return;
    console.warn('Tactilume: the recorder stopped', (e && e.error) || e);
    if (!r.gotData && startRecorder(r)) return;
    finish(r, 'error');
  }

  function onVisibility() {
    const r = rec;
    if (!r || r.stopping) return;
    // a hidden page draws nothing, so pause rather than fill the clip with a frozen frame
    try {
      if (document.hidden && !r.paused && r.recorder.state === 'recording') {
        r.recorder.pause();
        r.activeMs += performance.now() - r.resumedAt;
        r.paused = true;
      } else if (!document.hidden && r.paused) {
        r.recorder.resume();
        r.resumedAt = performance.now();
        r.paused = false;
      }
    } catch {
      // pause() is missing in a few old browsers; the clip then just keeps running
    }
    emitState(r);
  }
  document.addEventListener('visibilitychange', onVisibility);

  function tick(r) {
    if (rec !== r || r.stopping) return;
    emitState(r);
    if (elapsedOf(r) >= r.maxSeconds) finish(r, 'limit');
  }

  async function save(blob, name, mime) {
    saving++;
    try {
      return await platform.saveFile(blob, name, mime);
    } catch (e) {
      console.warn('Tactilume: saving failed', e);
      return { ok: false, error: 'Could not save the file.' };
    } finally {
      saving--;
    }
  }

  // Stops the recording, gathers the clip and saves it. Every way a recording can end
  // comes through here: the stop button, the time limit, the canvas going away, an error.
  function finish(r, reason) {
    if (r.stopping) return r.stopping;
    r.stopping = (async () => {
      clearInterval(r.timer);
      // the clip's length is fixed from here, however long the recorder takes to stop
      if (!r.paused) r.activeMs += performance.now() - r.resumedAt;
      r.paused = false;
      r.ended = true;
      try {
        if (r.recorder.state !== 'inactive') r.recorder.stop();
      } catch {
        // already stopped by an error
      }
      await Promise.race([r.stopped, timeout(STOP_WAIT_MS)]);
      release(r);
      rec = null; // a new recording may start while this one is being saved
      emitState(r);

      const type = baseType(r.mime) || baseType(r.chunks[0] && r.chunks[0].type) || 'video/webm';
      const blob = new Blob(r.chunks, { type });
      r.chunks = [];
      const result = blob.size > 0
        ? await save(blob, `Tactilume ${stamp(r.startedAt)}.${type.includes('mp4') ? 'mp4' : 'webm'}`, type)
        : { ok: false, error: 'The recording came out empty.' };
      emit('finished', result, reason);
      return result;
    })();
    return r.stopping;
  }

  return {
    async photo() {
      let blob = null;
      try {
        blob = await Promise.race([engine.capture('image/png'), timeout(PHOTO_WAIT_MS)]);
      } catch (e) {
        console.warn('Tactilume: the photo failed', e);
      }
      if (!blob || !blob.size) return { ok: false, error: 'Could not take a photo just now.' };
      return save(blob, `Tactilume ${stamp(new Date())}.png`, 'image/png');
    },

    startRecording({ maxSeconds = 60, withSound = true } = {}) {
      if (rec) return { ok: false, error: rec.stopping ? 'The last clip is still finishing. Try again in a moment.' : 'Already recording.' };
      if (typeof MediaRecorder === 'undefined' || typeof MediaStream === 'undefined') return { ok: false, error: NOT_AVAILABLE };

      let canvasStream = null;
      try {
        canvasStream = engine.captureStream(60);
      } catch (e) {
        console.warn('Tactilume: no video from the canvas', e);
      }
      const videoTrack = canvasStream && canvasStream.getVideoTracks()[0];
      if (!videoTrack) {
        if (canvasStream) for (const t of canvasStream.getTracks()) stopTrack(t);
        return { ok: false, error: NOT_AVAILABLE };
      }

      let audioTrack = null;
      if (withSound) {
        try {
          audioTrack = audio.recordTrack() || null;
        } catch (e) {
          console.warn('Tactilume: no sound for the recording', e);
        }
      }

      const limit = Number(maxSeconds);
      const { width = 0, height = 0 } = engine.stats || {};
      const now = performance.now();
      const r = {
        canvasStream, videoTrack, audioTrack,
        stream: null, recorder: null, stopped: null, mime: '',
        candidates: [], chunks: [], gotData: false,
        videoBps: width * height >= FULL_HD ? 12e6 : 8e6,
        maxSeconds: limit > 0 ? limit : 60,
        startedAt: new Date(), activeMs: 0, resumedAt: now, paused: false,
        timer: 0, stopping: null, ended: false,
      };
      try {
        r.stream = new MediaStream(audioTrack ? [videoTrack, audioTrack] : [videoTrack]);
        r.candidates = recordableMimes(!!audioTrack);
      } catch (e) {
        console.warn('Tactilume: could not prepare the recording', e);
      }
      if (!r.stream || !startRecorder(r)) {
        release(r);
        return { ok: false, error: NOT_AVAILABLE };
      }

      // the canvas stream ends if the canvas goes away; keep what was recorded
      videoTrack.addEventListener('ended', () => finish(r, 'ended'));
      rec = r;
      r.timer = setInterval(() => tick(r), TICK_MS);
      if (document.hidden) onVisibility();
      else emitState(r);
      return { ok: true };
    },

    async stopRecording() {
      if (!rec) return { ok: false, error: 'Nothing is being recorded.' };
      return finish(rec, 'stopped');
    },

    get recording() { return !!rec && !rec.stopping; },
    get elapsed() { return rec ? elapsedOf(rec) : lastElapsed; },
    get mime() { return rec ? rec.mime : lastMime; },
    // true while a photo or a clip is on its way to storage
    get saving() { return saving > 0; },
    // 'state' {recording, elapsed, paused, limit}; 'finished' (result, reason) after a
    // clip ends for any reason ('stopped' | 'limit' | 'ended' | 'error')
    on: ev.on,
  };
}
