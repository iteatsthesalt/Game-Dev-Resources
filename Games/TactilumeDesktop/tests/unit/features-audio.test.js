// renderer/audio/audio.js with fakes for Web Audio, the media devices and the <audio>
// element: each source starts, reports why it cannot, stops by itself or is replaced, and
// the features come from the analyser while something plays.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../../src/renderer/audio/audio.js';

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- fakes ----------------------------------------------------------------------------------

class FakeNode {
  constructor(ctx, kind) { this.ctx = ctx; this.kind = kind; this.outputs = new Set(); this.disconnected = false; }
  connect(node) { this.outputs.add(node); return node; }
  disconnect() { this.outputs.clear(); this.disconnected = true; }
}
class FakeAnalyser extends FakeNode {
  constructor(ctx) { super(ctx, 'analyser'); this.fftSize = 2048; this.smoothingTimeConstant = 0.8; }
  get frequencyBinCount() { return this.fftSize / 2; }
  getFloatFrequencyData(out) { out.set(this.ctx.spectrum); }
}
class FakeContext {
  static made = [];
  constructor(options) {
    this.options = options;
    this.state = 'running';
    this.sampleRate = 48000;
    this.destination = new FakeNode(this, 'destination');
    this.spectrum = new Float32Array(1024).fill(-Infinity);
    FakeContext.made.push(this);
  }
  createAnalyser() { this.analyser = new FakeAnalyser(this); return this.analyser; }
  createGain() { const g = new FakeNode(this, 'gain'); g.gain = { value: 1 }; return g; }
  createMediaStreamSource(stream) { const n = new FakeNode(this, 'stream'); n.stream = stream; this.sources = [...(this.sources || []), n]; return n; }
  createMediaElementSource(element) { const n = new FakeNode(this, 'element'); n.element = element; this.sources = [...(this.sources || []), n]; return n; }
  // as in a browser, the state changes a little after the call, in the order asked
  resume() { return Promise.resolve().then(() => { this.state = 'running'; }); }
  suspend() { return Promise.resolve().then(() => { this.state = 'suspended'; }); }
}

function fakeTrack(kind, label, { ended = false } = {}) {
  const t = new EventTarget();
  Object.assign(t, { kind, label, readyState: ended ? 'ended' : 'live', stopped: false });
  t.stop = () => { t.stopped = true; t.readyState = 'ended'; };
  return t;
}
function fakeStream(tracks) {
  const list = [...tracks];
  return {
    list,
    getTracks: () => [...list],
    getAudioTracks: () => list.filter((t) => t.kind === 'audio'),
    getVideoTracks: () => list.filter((t) => t.kind === 'video'),
    removeTrack: (t) => { const i = list.indexOf(t); if (i >= 0) list.splice(i, 1); },
  };
}
const denied = (name) => new DOMException('refused', name);

// navigator.mediaDevices, scripted: what each call answers, and every call it got
function fakeDevices() {
  const md = {
    calls: [], streams: [],
    micError: null, micLabel: 'Built-in Microphone', micDelay: 0,
    displayError: null, displayAudio: true, displayEnded: false,
    devices: [{ kind: 'audioinput', deviceId: 'default', label: 'Default' }, { kind: 'videoinput', deviceId: 'cam', label: 'Camera' }],
    hideLabelsUntilAllowed: false, allowed: false,
    async getUserMedia(c) {
      md.calls.push(['getUserMedia', c]);
      if (md.micDelay) await tick(md.micDelay);
      if (md.micError) throw denied(md.micError);
      md.allowed = true;
      const id = c.audio?.deviceId?.exact;
      const found = md.devices.find((d) => d.deviceId === id);
      const s = fakeStream([fakeTrack('audio', found ? found.label : md.micLabel)]);
      md.streams.push(s);
      return s;
    },
    async getDisplayMedia(c) {
      md.calls.push(['getDisplayMedia', c]);
      if (md.displayError) throw denied(md.displayError);
      const tracks = [fakeTrack('video', 'screen:0:0')];
      if (md.displayAudio) tracks.push(fakeTrack('audio', 'System Audio', { ended: md.displayEnded }));
      const s = fakeStream(tracks);
      md.streams.push(s);
      return s;
    },
    async enumerateDevices() {
      md.calls.push(['enumerateDevices']);
      return md.devices.map((d) => ({ ...d, label: md.hideLabelsUntilAllowed && !md.allowed ? '' : d.label }));
    },
  };
  return md;
}

// an <audio> element that becomes playable, or fails with a media error code
function fakeElementMaker({ outcome = 'canplay', code = 4, play = 'ok', canPlay = 'maybe' } = {}) {
  const made = [];
  const make = () => {
    const el = new EventTarget();
    Object.assign(el, { readyState: 0, paused: true, loop: false, preload: '', error: null, loaded: false, _src: '' });
    el.canPlayType = () => canPlay;
    Object.defineProperty(el, 'src', {
      get: () => el._src,
      set(v) {
        el._src = v;
        setTimeout(() => {
          if (outcome === 'canplay') { el.readyState = 4; el.dispatchEvent(new Event('canplay')); }
          if (outcome === 'error') { el.error = { code }; el.dispatchEvent(new Event('error')); }
        }, 1);
      },
    });
    el.play = () => {
      if (play === 'ok') { el.paused = false; return Promise.resolve(); }
      // the decoder gives up while play() is still pending: the error event comes first
      if (play === 'decode-error') {
        return new Promise((resolve, reject) => setTimeout(() => {
          el.error = { code: 3 };
          el.onerror?.();
          reject(denied('NotSupportedError'));
        }, 2));
      }
      return Promise.reject(denied(play));
    };
    el.pause = () => { el.paused = true; };
    el.removeAttribute = (name) => { if (name === 'src') el._src = ''; };
    el.load = () => { el.loaded = true; };
    made.push(el);
    return el;
  };
  return { make, made };
}

function rig({ how = 'none', platform = 'linux', element = {}, noAudio = false, bridgeThrows = false } = {}) {
  const md = fakeDevices();
  const els = fakeElementMaker(element);
  const support = { how, supported: how !== 'none' };
  const bridge = {
    platform,
    audio: { systemSupport: async () => { if (bridgeThrows) throw new Error('IPC gone'); return { ...support }; } },
  };
  const audio = createAudio({ bridge, mediaDevices: md, AudioContextClass: noAudio ? undefined : FakeContext, makeElement: els.make });
  const changes = [];
  audio.on('change', (c) => changes.push(c));
  const ctx = () => FakeContext.made.at(-1);
  return { audio, md, els, bridge, support, changes, ctx };
}

beforeEach(() => { FakeContext.made.length = 0; });

// ---- tests ----------------------------------------------------------------------------------

describe('the microphone', () => {
  test('useMic listens with speech processing off, silently, and says what it hears', async () => {
    const r = rig();
    assert.equal(FakeContext.made.length, 0, 'no audio context until a sound is chosen');
    const got = await r.audio.useMic('default');
    assert.deepEqual(got, { ok: true, label: 'Default' });
    assert.equal(r.audio.source, 'mic');
    assert.equal(r.audio.label, 'Default');
    const [, c] = r.md.calls.find((x) => x[0] === 'getUserMedia');
    assert.deepEqual(c.audio, { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 }, sampleRate: { ideal: 48000 }, deviceId: { exact: 'default' } });
    // the microphone reaches the analyser only: it is never played back, so there is no echo
    const [mic] = r.ctx().sources;
    assert.deepEqual([...mic.outputs], [r.ctx().analyser]);
    // the analyser feeds the speakers through a silent gain, which keeps the sound flowing
    const [gain] = [...r.ctx().analyser.outputs];
    assert.equal(gain.gain.value, 0);
    assert.deepEqual([...gain.outputs], [r.ctx().destination]);
    assert.equal(r.ctx().analyser.smoothingTimeConstant, 0, 'the analyser\'s own smoothing is off');
    assert.equal(r.ctx().analyser.fftSize, 2048);
    assert.equal(r.changes.at(-1).source, 'mic');
  });

  test('without a device id it asks for the default microphone', async () => {
    const r = rig();
    await r.audio.useMic();
    const [, c] = r.md.calls.find((x) => x[0] === 'getUserMedia');
    assert.equal(c.audio.deviceId, undefined);
    assert.equal(c.video, false);
  });

  const reasons = [
    ['NotAllowedError', /not allowed to use the microphone/],
    ['NotFoundError', /No microphone was found/],
    ['OverconstrainedError', /not connected any more/],
    ['NotReadableError', /Another app may be using it/],
    ['WeirdError', /WeirdError/],
  ];
  for (const [name, reason] of reasons) {
    test(`a ${name} is told as a reason, and the sound stays off`, async () => {
      const r = rig();
      r.md.micError = name;
      const got = await r.audio.useMic('x');
      assert.equal(got.ok, false);
      assert.match(got.error, reason);
      assert.equal(r.audio.source, 'off');
      assert.equal(r.audio.error, got.error);
      assert.equal(r.changes.at(-1).error, got.error);
    });
  }

  test('a window with no media devices says it cannot use a microphone', async () => {
    const audio = createAudio({ bridge: {}, mediaDevices: undefined, AudioContextClass: FakeContext });
    const got = await audio.useMic();
    assert.deepEqual(got, { ok: false, error: 'This window cannot use a microphone.' });
  });

  test('an unplugged microphone stops the sound and says why', async () => {
    const r = rig();
    await r.audio.useMic();
    r.md.streams[0].getAudioTracks()[0].dispatchEvent(new Event('ended'));
    assert.equal(r.audio.source, 'off');
    assert.match(r.audio.error, /microphone stopped/);
    assert.equal(r.changes.at(-1).source, 'off');
  });
});

describe('stopping and replacing', () => {
  test('stop() ends the tracks, disconnects, rests the sound hardware and zeroes the features', async () => {
    const r = rig();
    await r.audio.useMic();
    r.ctx().spectrum.fill(-30);
    r.audio.update(1 / 60);
    r.audio.update(1 / 60);
    assert.ok(r.audio.features().level > 0);
    r.audio.stop();
    assert.equal(r.audio.source, 'off');
    assert.equal(r.audio.label, '');
    assert.ok(r.md.streams[0].getTracks().every((t) => t.stopped));
    await tick(1);
    assert.equal(r.ctx().state, 'suspended');
    assert.ok(Object.values(r.audio.features()).every((v) => v === 0));
    r.audio.update(1 / 60);
    assert.ok(Object.values(r.audio.features()).every((v) => v === 0), 'nothing is read while off');
  });

  test('a later choice wins over an earlier one that answers late', async () => {
    const r = rig();
    r.md.micDelay = 30;
    const slowMic = r.audio.useMic();
    const file = await r.audio.useFile(new File([new Uint8Array(8)], 'song.mp3', { type: 'audio/mpeg' }));
    const mic = await slowMic;
    assert.equal(file.ok, true);
    assert.equal(mic.ok, false);
    assert.equal(mic.replaced, true);
    assert.equal(r.audio.source, 'file', 'the file keeps playing');
    assert.ok(r.md.streams[0].getTracks().every((t) => t.stopped), 'the late microphone was let go at once');
  });

  test('a new source straight after stop() wakes the sound hardware that stop() was putting to rest', async () => {
    const r = rig();
    await r.audio.useMic();
    r.audio.stop();
    assert.equal(r.ctx().state, 'running', 'the suspend has been asked for but has not happened yet');
    await r.audio.useFile(new File([new Uint8Array(8)], 'song.mp3', { type: 'audio/mpeg' }));
    await tick(5);
    assert.equal(r.ctx().state, 'running');
  });

  test('stop() also cancels a choice still being made', async () => {
    const r = rig();
    r.md.micDelay = 20;
    const pending = r.audio.useMic();
    r.audio.stop();
    assert.equal((await pending).ok, false);
    assert.equal(r.audio.source, 'off');
  });

  test('a new source replaces the old one and lets it go', async () => {
    const r = rig();
    await r.audio.useMic();
    await r.audio.useFile(new File([new Uint8Array(8)], 'song.ogg', { type: 'audio/ogg' }));
    assert.equal(r.audio.source, 'file');
    assert.ok(r.md.streams[0].getTracks().every((t) => t.stopped));
  });
});

describe('the computer\'s own sound', () => {
  test('with loopback, only the sound of the screen share is kept, and it is not played back', async () => {
    const r = rig({ how: 'loopback', platform: 'win32' });
    const got = await r.audio.useSystem();
    assert.deepEqual(got, { ok: true, label: 'This computer' });
    assert.equal(r.audio.source, 'system');
    const [, c] = r.md.calls.find((x) => x[0] === 'getDisplayMedia');
    assert.equal(c.audio, true);
    assert.equal(c.video, true);
    const stream = r.md.streams[0];
    assert.deepEqual(stream.getVideoTracks(), [], 'the picture is dropped');
    assert.ok(stream.list.every((t) => t.kind === 'audio'));
    const [node] = r.ctx().sources;
    assert.deepEqual([...node.outputs], [r.ctx().analyser], 'the computer\'s sound is not played back a second time');
  });

  const reasons = [
    ['NotAllowedError', 'win32', /was not allowed to hear/],
    ['NotAllowedError', 'darwin', /System Settings, Privacy & Security/],
    ['InvalidStateError', 'win32', /from a click or a key press/],
    // what Electron 45's page sees when the main process shares nothing (measured)
    ['AbortError', 'win32', /did not share its sound/],
    ['AbortError', 'darwin', /System Settings, Privacy & Security/],
    ['NotSupportedError', 'win32', /cannot hear what this computer plays/],
    ['NotReadableError', 'win32', /could not be captured/],
  ];
  for (const [name, platform, reason] of reasons) {
    test(`loopback refused with ${name} on ${platform} says so`, async () => {
      const r = rig({ how: 'loopback', platform });
      r.md.displayError = name;
      const got = await r.audio.useSystem();
      assert.equal(got.ok, false);
      assert.match(got.error, reason);
      assert.equal(r.audio.source, 'off');
    });
  }

  test('macOS without the permission hands over an ended track: that is a refusal', async () => {
    const r = rig({ how: 'loopback', platform: 'darwin' });
    r.md.displayEnded = true;
    const got = await r.audio.useSystem();
    assert.match(got.error, /macOS did not let Tactilume hear/);
    assert.ok(r.md.streams[0].getTracks().every((t) => t.stopped));
  });

  test('a share with no sound in it says so', async () => {
    const r = rig({ how: 'loopback', platform: 'win32' });
    r.md.displayAudio = false;
    assert.match((await r.audio.useSystem()).error, /shared no sound/);
  });

  test('where there is no way, it says so, and suggests a file or a microphone', async () => {
    assert.match((await rig({ how: 'none', platform: 'win32' }).audio.useSystem()).error, /cannot hear what this computer plays.*file/);
    assert.match((await rig({ how: 'none', platform: 'darwin' }).audio.useSystem()).error, /macOS 14\.2 or later/);
    assert.match((await rig({ how: 'loopback', bridgeThrows: true }).audio.useSystem()).error, /cannot hear/);
  });

  test('on Linux a monitor input is opened like a microphone', async () => {
    const r = rig({ how: 'monitor-device' });
    r.md.devices.push({ kind: 'audioinput', deviceId: 'mon1', label: 'Monitor of Built-in Audio Analog Stereo' });
    const got = await r.audio.useSystem();
    assert.deepEqual(got, { ok: true, label: 'Monitor of Built-in Audio Analog Stereo' });
    assert.equal(r.audio.source, 'system');
    const [, c] = r.md.calls.find((x) => x[0] === 'getUserMedia');
    assert.deepEqual(c.audio.deviceId, { exact: 'mon1' });
  });

  test('on Linux, names hidden until a microphone is allowed are revealed by one quick listen', async () => {
    const r = rig({ how: 'monitor-device' });
    r.md.hideLabelsUntilAllowed = true;
    r.md.devices.push({ kind: 'audioinput', deviceId: 'mon1', label: 'Monitor of HDMI' });
    const got = await r.audio.useSystem();
    assert.equal(got.ok, true);
    assert.ok(r.md.streams[0].getTracks().every((t) => t.stopped), 'the revealing listen is stopped at once');
  });

  test('on Linux with no monitor listed, it says how to route one', async () => {
    const r = rig({ how: 'monitor-device' });
    const got = await r.audio.useSystem();
    assert.match(got.error, /Monitor of/);
    assert.match(got.error, /pavucontrol/);
  });

  test('computer sound that stays silent earns a hint, which goes once sound arrives', async () => {
    const r = rig({ how: 'loopback', platform: 'win32' });
    await r.audio.useSystem();
    for (let i = 0; i < 60 * 3.5; i++) r.audio.update(1 / 60);
    assert.match(r.audio.hint, /No sound is coming through/);
    assert.equal(r.audio.source, 'system', 'a hint, not a failure');
    r.ctx().spectrum.fill(-30);
    r.audio.update(1 / 60);
    r.audio.update(1 / 60);
    assert.equal(r.audio.hint, '');
  });
});

describe('music files', () => {
  const song = () => new File([new Uint8Array(64)], 'Night Drive.mp3', { type: 'audio/mpeg' });

  test('a file plays out loud, looped, through the analyser too', async () => {
    const r = rig();
    const got = await r.audio.useFile(song());
    assert.deepEqual(got, { ok: true, label: 'Night Drive.mp3' });
    assert.equal(r.audio.source, 'file');
    const el = r.els.made[0];
    assert.ok(el.loop, 'it loops');
    assert.match(el._src, /^blob:/);
    assert.equal(el.paused, false);
    const [node] = r.ctx().sources;
    assert.equal(node.element, el);
    assert.deepEqual(new Set(node.outputs), new Set([r.ctx().analyser, r.ctx().destination]), 'heard, and analysed');
  });

  test('stopping a file pauses it, frees its decoder and revokes its blob URL', async () => {
    const r = rig();
    const revoked = [];
    const original = URL.revokeObjectURL;
    URL.revokeObjectURL = (u) => { revoked.push(u); return original.call(URL, u); };
    try {
      await r.audio.useFile(song());
      const el = r.els.made[0];
      const url = el._src;
      r.audio.stop();
      assert.equal(el.paused, true);
      assert.equal(el._src, '');
      assert.ok(el.loaded);
      assert.deepEqual(revoked, [url]);
    } finally {
      URL.revokeObjectURL = original;
    }
  });

  test('a URL plays too, named after its last part', async () => {
    const r = rig();
    const got = await r.audio.useFile('http://127.0.0.1/music/My%20Song.wav');
    assert.deepEqual(got, { ok: true, label: 'My Song.wav' });
  });

  test('what is not a sound file is refused before anything loads', async () => {
    const r = rig();
    const text = await r.audio.useFile(new File(['hi'], 'notes.txt', { type: 'text/plain' }));
    assert.match(text.error, /cannot play this kind of file/);
    assert.equal(r.els.made.length, 0);
    assert.match((await r.audio.useFile(42)).error, /Choose a music file/);
    assert.match((await r.audio.useFile()).error, /Choose a music file/);
  });

  test('music with an odd label or none still gets a try: the <audio> element decides', async () => {
    for (const type of ['application/ogg', 'audio/x-flac', 'application/octet-stream', '']) {
      const r = rig();
      const got = await r.audio.useFile(new File([new Uint8Array(8)], 'track', { type }));
      assert.equal(got.ok, true, `${type || 'no type'}: ${got.error}`);
    }
    assert.equal((await rig().audio.useFile(new File(['x'], 'photo.png', { type: 'image/png' }))).ok, false);
  });

  test('a file that errors while starting to play keeps the reason it gave', async () => {
    const r = rig({ element: { play: 'decode-error' } });
    const got = await r.audio.useFile(song());
    assert.equal(got.ok, false);
    assert.match(got.error, /may be damaged/);
    assert.equal(r.audio.error, got.error);
    assert.equal(r.audio.source, 'off');
  });

  test('a file that fails to decode says it may be damaged; an unsupported one says which kinds work', async () => {
    assert.match((await rig({ element: { outcome: 'error', code: 3 } }).audio.useFile(song())).error, /may be damaged/);
    assert.match((await rig({ element: { outcome: 'error', code: 4 } }).audio.useFile(song())).error, /MP3, AAC, FLAC/);
  });

  test('when the browser wants a click first, it says so and the sound stays off', async () => {
    const r = rig({ element: { play: 'NotAllowedError' } });
    const got = await r.audio.useFile(song());
    assert.match(got.error, /after a click or a key press/);
    assert.equal(r.audio.source, 'off');
  });

  test('a file that breaks while playing stops the sound and says why', async () => {
    const r = rig();
    await r.audio.useFile(song());
    const el = r.els.made[0];
    el.error = { code: 3 };
    el.onerror();
    assert.equal(r.audio.source, 'off');
    assert.match(r.audio.error, /may be damaged/);
  });

  test('with no Web Audio at all, it says the light cannot follow sound', async () => {
    const r = rig({ noAudio: true });
    assert.match((await r.audio.useFile(song())).error, /cannot process sound/);
  });
});

describe('features and devices', () => {
  test('features() are zeros while off, and follow the analyser while a source plays', async () => {
    const r = rig();
    assert.deepEqual(r.audio.features(), { level: 0, bass: 0, mid: 0, high: 0, onset: 0, beat: 0, bpm: 0 });
    await r.audio.useMic();
    const spectrum = r.ctx().spectrum;
    spectrum.fill(-120);
    for (let k = 2; k <= 5; k++) spectrum[k] = -20; // bass
    r.audio.update(1 / 60);
    r.audio.update(1 / 60);
    const f = r.audio.features();
    assert.ok(f.bass > 0.9 && f.level > 0.5 && f.high === 0, JSON.stringify(f));
    f.bass = 0;
    assert.ok(r.audio.features().bass > 0.9, 'features() hands out a copy');
  });

  test('a suspended context counts as silence', async () => {
    const r = rig();
    await r.audio.useMic();
    r.ctx().spectrum.fill(-20);
    r.ctx().state = 'suspended';
    for (let i = 0; i < 5; i++) r.audio.update(1 / 60);
    assert.equal(r.audio.features().level, 0);
  });

  test('devices() lists the inputs, names unnamed ones, and marks monitors', async () => {
    const r = rig();
    r.md.devices.push({ kind: 'audioinput', deviceId: 'm', label: 'Monitor of Speakers' }, { kind: 'audioinput', deviceId: 'u', label: '' });
    assert.deepEqual(await r.audio.devices(), [
      { deviceId: 'default', label: 'Default', monitor: false },
      { deviceId: 'm', label: 'Monitor of Speakers', monitor: true },
      { deviceId: 'u', label: 'Microphone 3', monitor: false },
    ]);
  });

  test('devices() only asks to reveal hidden names when told to', async () => {
    const r = rig();
    r.md.hideLabelsUntilAllowed = true;
    assert.equal((await r.audio.devices())[0].label, 'Microphone 1');
    assert.equal(r.md.calls.filter((c) => c[0] === 'getUserMedia').length, 0);
    assert.equal((await r.audio.devices({ reveal: true }))[0].label, 'Default');
    assert.equal(r.md.calls.filter((c) => c[0] === 'getUserMedia').length, 1);
  });
});
