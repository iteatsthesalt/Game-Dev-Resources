// renderer/audio/features.js with synthetic spectra: the decibels per bin an AnalyserNode
// (fftSize 2048, smoothing 0) would report for silence, steady tones, a kick drum and hiss.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createFeatureTracker, SILENT } from '../../src/renderer/audio/features.js';
import { mulberry32 } from '../../../Tactilume/src/js/core/util.js';

const RATE = 48000;
const FFT = 2048;
const BINS = FFT / 2;
const HZ = RATE / FFT;
const binOf = (f) => Math.round(f / HZ);

// A song: a function of time (s) that fills a spectrum. Played frame by frame at `fps`, it
// gives back every frame's features, and the times of the frames where an onset or a beat
// was heard (onset and beat read exactly 1 on the frame they happen).
function play(song, { seconds = 10, fps = 60, rate = RATE, tracker = createFeatureTracker({ sampleRate: rate, fftSize: FFT }) } = {}) {
  const db = new Float32Array(BINS);
  const frames = [];
  const onsets = [];
  const beats = [];
  const dt = 1 / fps;
  for (let i = 1; i <= seconds * fps; i++) {
    const t = i * dt;
    song(db, t, rate / FFT);
    const f = tracker.update(db, dt);
    frames.push({ t, ...f });
    if (f.onset === 1) onsets.push(t);
    if (f.beat === 1) beats.push(t);
  }
  return { frames, onsets, beats, last: frames[frames.length - 1], tracker };
}

// a quiet room under everything: -90 dB with a few dB of seeded jitter
function room(seed = 1, level = -90, spread = 3) {
  const random = mulberry32(seed);
  return (db) => { for (let k = 0; k < db.length; k++) db[k] = level + (random() - 0.5) * 2 * spread; };
}

// A kick drum every 60/bpm s from t = start: the bins from 40 to 150 Hz jump to `peak` dB and
// fall by about 70 dB a second, with a short click from 2 to 5 kHz at each attack.
function kicks(bpm, { peak = -20, start = 0.25, until = Infinity, seed = 1, floor = -90 } = {}) {
  const under = room(seed, floor);
  const period = 60 / bpm;
  return (db, t, hz) => {
    under(db);
    if (t < start || t > until) return;
    const since = (t - start) % period;
    const kick = peak - since * 70;
    for (let k = Math.round(40 / hz); k <= Math.round(150 / hz); k++) db[k] = Math.max(db[k], kick);
    if (since < 0.03) for (let k = Math.round(2000 / hz); k <= Math.round(5000 / hz); k++) db[k] = Math.max(db[k], peak - 25);
  };
}

// a steady tone at `freq`, `peak` dB in its loudest bin, with a main lobe two bins wide each
// way; the rest of the spectrum is far below hearing
function tone(freq, { peak = -14, start = 0, wobble = 0.3, seed = 2 } = {}) {
  const random = mulberry32(seed);
  return (db, t, hz) => {
    db.fill(-140);
    if (t < start) { db.fill(-Infinity); return; }
    const c = Math.round(freq / hz);
    for (let d = -2; d <= 2; d++) db[c + d] = peak - Math.abs(d) * 12 + (random() - 0.5) * 2 * wobble;
  };
}

// Drum hits at given times: { t, lo, hi } lights the bins from lo to hi Hz at -20 dB, falling
// by 70 dB a second, over a quiet room.
function hits(list, seed = 6) {
  const under = room(seed);
  const sorted = [...list].sort((a, b) => a.t - b.t);
  return (db, t, hz) => {
    under(db);
    let hit = null;
    for (const h of sorted) { if (h.t > t) break; hit = h; }
    if (!hit) return;
    const level = -20 - (t - hit.t) * 70;
    for (let k = Math.round(hit.lo / hz); k <= Math.round(hit.hi / hz); k++) db[k] = Math.max(db[k], level);
  };
}
const kickAt = (t) => ({ t, lo: 40, hi: 150 });
const snareAt = (t) => ({ t, lo: 200, hi: 1800 });
const hatAt = (t) => ({ t, lo: 6000, hi: 10000 });

const near = (list, t, within) => list.some((x) => Math.abs(x - t) <= within);

describe('silence and steady sound', () => {
  test('silence gives zeros, every frame', () => {
    const { frames } = play((db) => db.fill(-Infinity), { seconds: 5 });
    for (const f of frames) assert.deepEqual({ level: f.level, bass: f.bass, mid: f.mid, high: f.high, onset: f.onset, beat: f.beat, bpm: f.bpm }, { ...SILENT });
  });

  test('a 16-bit recording of nothing (bins far below hearing, and NaN) is silence too', () => {
    const { frames } = play((db) => { db.fill(-130); db[100] = NaN; }, { seconds: 3 });
    assert.ok(frames.every((f) => f.level === 0 && f.bass === 0 && f.mid === 0 && f.high === 0 && f.onset === 0));
  });

  test('a loud steady tone gives no onsets, a full level and no tempo', () => {
    const { onsets, last, frames } = play(tone(440), { seconds: 10 });
    assert.deepEqual(onsets, []);
    assert.ok(frames.every((f) => f.onset === 0));
    assert.ok(last.level > 0.9 && last.mid > 0.9, `level ${last.level}, mid ${last.mid}`);
    assert.equal(last.bass, 0, '440 Hz is not bass');
    assert.equal(last.high, 0, '440 Hz is not high');
    assert.equal(last.bpm, 0);
    assert.equal(last.beat, 0);
  });

  test('a tone that starts after silence is one onset, and holding it is no more', () => {
    const { onsets } = play(tone(1000, { start: 2 }), { seconds: 8 });
    assert.equal(onsets.length, 1, `onsets at ${onsets}`);
    assert.ok(onsets[0] >= 2 && onsets[0] < 2.05, `heard at ${onsets[0]} s`);
  });

  test('the bands are where they should be: 80 Hz is bass, 800 Hz mid and 6 kHz high', () => {
    for (const [freq, band] of [[80, 'bass'], [800, 'mid'], [6000, 'high']]) {
      const { last } = play(tone(freq), { seconds: 2 });
      for (const other of ['bass', 'mid', 'high']) {
        if (other === band) assert.ok(last[other] > 0.9, `${freq} Hz: ${other} ${last[other]}`);
        else assert.equal(last[other], 0, `${freq} Hz should not reach ${other}`);
      }
    }
  });
});

describe('onsets and tempo', () => {
  test('a kick at 120 bpm: an onset on every kick, a tempo near 120, and a beat on the kicks', () => {
    const { onsets, beats, frames, last } = play(kicks(120), { seconds: 12 });
    const kickTimes = Array.from({ length: 24 }, (_, i) => 0.25 + i * 0.5).filter((t) => t < 12);
    assert.ok(onsets.length >= kickTimes.length - 1 && onsets.length <= kickTimes.length, `${onsets.length} onsets for ${kickTimes.length} kicks`);
    for (const t of onsets) assert.ok(near(kickTimes, t, 0.035), `an onset at ${t.toFixed(3)} s is not on a kick`);
    assert.ok(Math.abs(last.bpm - 120) <= 2, `bpm ${last.bpm}`);
    // the tempo is found within a few seconds and then holds
    const settled = frames.filter((f) => f.t > 4);
    assert.ok(settled.every((f) => Math.abs(f.bpm - 120) <= 3), `bpm wandered: ${settled.map((f) => f.bpm.toFixed(1)).filter((v, i, a) => a.indexOf(v) === i).join(' ')}`);
    // in the last four seconds every beat tick falls on a kick, and every kick has one
    const lateBeats = beats.filter((t) => t > 8);
    const lateKicks = kickTimes.filter((t) => t > 8 && t < 11.9);
    assert.ok(lateBeats.length >= lateKicks.length, `${lateBeats.length} beats for ${lateKicks.length} kicks`);
    for (const t of lateBeats) assert.ok(near(kickTimes, t, 0.06), `a beat at ${t.toFixed(3)} s is off the kicks`);
  });

  test('the bass hits with each kick and falls away between them', () => {
    const { frames } = play(kicks(120), { seconds: 6 });
    const at = (t) => frames.reduce((best, f) => (Math.abs(f.t - t) < Math.abs(best.t - t) ? f : best));
    for (const k of [4.25, 4.75, 5.25]) {
      assert.ok(at(k + 0.02).bass > 0.8, `bass at a kick ${at(k + 0.02).bass}`);
      assert.ok(at(k + 0.45).bass < 0.35, `bass just before the next kick ${at(k + 0.45).bass}`);
    }
  });

  for (const bpm of [90, 150]) {
    test(`a kick at ${bpm} bpm gives its own tempo, not 120 and not an octave off`, () => {
      const { last } = play(kicks(bpm), { seconds: 12 });
      assert.ok(Math.abs(last.bpm - bpm) <= 2, `bpm ${last.bpm} for ${bpm}`);
    });
  }

  test('a swung groove (kick and snare on the beats, hats two thirds of the way) gives its tempo', () => {
    const beat = 60 / 124;
    const list = [];
    for (let b = 0; b < 26; b++) list.push(b % 2 ? snareAt(0.3 + b * beat) : kickAt(0.3 + b * beat), hatAt(0.3 + (b + 2 / 3) * beat));
    const { last } = play(hits(list), { seconds: 12 });
    assert.ok(Math.abs(last.bpm - 124) <= 2, `bpm ${last.bpm}`);
  });

  test('in syncopated music the beat ticks fall on the beats, not on the off-beat kicks', () => {
    // A pickup kick on the "and" of every fourth beat. The tempo is first sure on the fifth
    // onset, which is that pickup: counting from it would put every beat between the beats.
    const beat = 60 / 124;
    const on = [];
    const list = [];
    for (let b = 0; b < 26; b++) {
      const t = 0.3 + b * beat;
      on.push(t);
      list.push(b % 2 ? snareAt(t) : kickAt(t));
      if (b % 4 === 3) list.push(kickAt(t + beat / 2));
    }
    const { beats, last } = play(hits(list), { seconds: 12.5 });
    assert.ok(Math.abs(last.bpm - 124) <= 2, `bpm ${last.bpm}`);
    const late = beats.filter((t) => t > 7);
    assert.ok(late.length >= 8, `${late.length} beats`);
    for (const t of late) assert.ok(near(on, t, 0.06), `a beat at ${t.toFixed(3)} s is between beats`);
  });

  test('four kicks in time are not yet a tempo; it takes a fifth that agrees', () => {
    // the kicks fall at 0.25, 0.75, 1.25, 1.75 (and 2.25) s
    const four = play(kicks(120, { until: 1.85 }), { seconds: 4 });
    assert.equal(four.onsets.length, 4);
    assert.ok(four.frames.every((f) => f.bpm === 0), 'four onsets that line up once are not trusted yet');
    const five = play(kicks(120, { until: 2.35 }), { seconds: 4 });
    assert.equal(five.onsets.length, 5);
    assert.ok(Math.abs(five.frames.find((f) => f.t >= 2.3).bpm - 120) <= 2, 'the fifth agrees: 120 bpm');
  });

  test('two hits closer than 100 ms are one onset; 150 ms apart they are two', () => {
    const flam = play(hits([kickAt(1), snareAt(1.04)]), { seconds: 2 });
    assert.equal(flam.onsets.length, 1, `onsets at ${flam.onsets}`);
    const apart = play(hits([kickAt(1), snareAt(1.15)]), { seconds: 2 });
    assert.equal(apart.onsets.length, 2, `onsets at ${apart.onsets}`);
  });

  test('the tempo is the same at 144 frames a second as at 60', () => {
    const slow = play(kicks(120), { seconds: 10, fps: 60 });
    const fast = play(kicks(120), { seconds: 10, fps: 144 });
    assert.ok(Math.abs(fast.last.bpm - 120) <= 2, `bpm at 144 Hz ${fast.last.bpm}`);
    assert.ok(Math.abs(fast.onsets.length - slow.onsets.length) <= 1, `${fast.onsets.length} onsets at 144 Hz, ${slow.onsets.length} at 60 Hz`);
  });

  test('when the music stops, the levels fall within a second and the tempo lapses after the window', () => {
    // the quiet room the kicks played in is still there afterwards
    const { frames } = play(kicks(120, { until: 8 }), { seconds: 20 });
    const after = (t) => frames.find((f) => f.t >= t);
    assert.ok(after(7.9).bpm > 0);
    assert.ok(after(9).bass < 0.02 && after(9).level < 0.02, `bass ${after(9).bass}, level ${after(9).level}`);
    assert.equal(after(17).bpm, 0);
    assert.equal(after(17).beat, 0);
    assert.ok(frames.filter((f) => f.t > 17).every((f) => f.beat === 0 && f.onset === 0));
  });

  test('onsets at random times give no tempo', () => {
    const random = mulberry32(9);
    const times = [];
    for (let t = 0.3; t < 14; t += 0.15 + random() * 0.6) times.push(t);
    const under = room(3);
    const song = (db, t, hz) => {
      under(db);
      const last = times.filter((x) => x <= t).pop();
      if (last === undefined) return;
      const level = -20 - (t - last) * 70;
      for (let k = Math.round(40 / hz); k <= Math.round(400 / hz); k++) db[k] = Math.max(db[k], level);
    };
    const { onsets, frames } = play(song, { seconds: 14 });
    assert.ok(onsets.length > 15, `${onsets.length} onsets`);
    const withTempo = frames.filter((f) => f.t > 4 && f.bpm > 0).length / frames.filter((f) => f.t > 4).length;
    assert.ok(withTempo < 0.2, `a tempo was claimed ${(withTempo * 100).toFixed(0)}% of the time`);
  });

  test('an onset reads 1 on its frame and fades within half a second', () => {
    const { frames, onsets } = play(kicks(60), { seconds: 4 });
    const i = frames.findIndex((f) => f.t === onsets[0]);
    assert.equal(frames[i].onset, 1);
    assert.ok(frames[i + 1].onset < 1 && frames[i + 1].onset > 0.8);
    const later = frames.find((f) => f.t >= onsets[0] + 0.5);
    assert.ok(later.onset < 0.05, `onset ${later.onset} after 0.5 s`);
  });
});

describe('adaptive gain', () => {
  test('a quiet song is lifted to the same range as a loud one', () => {
    const loud = play(kicks(120, { peak: -20 }), { seconds: 10 });
    const quiet = play(kicks(120, { peak: -50, floor: -95 }), { seconds: 10 });
    const peakBass = (r) => Math.max(...r.frames.filter((f) => f.t > 6).map((f) => f.bass));
    assert.ok(peakBass(loud) > 0.9 && peakBass(quiet) > 0.9, `loud ${peakBass(loud)}, quiet ${peakBass(quiet)}`);
    assert.ok(Math.abs(quiet.last.bpm - 120) <= 2, `quiet bpm ${quiet.last.bpm}`);
  });

  test('hiss just above silence is not stretched to fill the range, and makes no onsets', () => {
    const { frames, onsets } = play(room(4, -97, 3), { seconds: 10 });
    const loudest = Math.max(...frames.filter((f) => f.t > 1).map((f) => Math.max(f.level, f.bass, f.mid, f.high)));
    assert.ok(loudest < 0.2, `hiss reads ${loudest}`);
    assert.deepEqual(onsets, []);
  });

  test('after a loud passage, a quieter one is lifted again over the next seconds', () => {
    const song = (db, t, hz) => kicks(120, { peak: t < 6 ? -10 : -40 })(db, t, hz);
    const { frames } = play(song, { seconds: 26 });
    const peakIn = (a, b) => Math.max(...frames.filter((f) => f.t > a && f.t < b).map((f) => f.bass));
    assert.ok(peakIn(6.5, 8) < 0.3, `just after the drop ${peakIn(6.5, 8)}`);
    assert.ok(peakIn(22, 26) > 0.8, `twenty seconds on ${peakIn(22, 26)}`);
  });
});

describe('robustness', () => {
  test('dt of 0, a negative or NaN dt, and missing or short spectra do not break anything', () => {
    const t = createFeatureTracker({ sampleRate: RATE, fftSize: FFT });
    for (const dt of [0, -1, NaN, undefined, Infinity]) assert.deepEqual(t.update(new Float32Array(BINS).fill(-30), dt).bpm, 0);
    for (const db of [null, undefined, [], new Float32Array(3)]) {
      const f = t.update(db, 1 / 60);
      assert.ok(Object.values(f).every(Number.isFinite), JSON.stringify(f));
    }
  });

  test('a bad sample rate or fft size falls back to 48 kHz and 2048', () => {
    const t = createFeatureTracker({ sampleRate: -5, fftSize: 1000 });
    const { last } = play(tone(80), { seconds: 1, tracker: t });
    assert.ok(last.bass > 0.9);
  });

  test('at 44.1 kHz the band edges are still at 150 Hz and 2 kHz', () => {
    // one bin each, just inside and just outside an edge: at 44.1 kHz a bin is 21.5 Hz wide
    const only = (freq) => (db, t, hz) => { db.fill(-Infinity); db[Math.round(freq / hz)] = -20; };
    const cases = [[129, 'bass'], [151, 'mid'], [1981, 'mid'], [2024, 'high']];
    for (const [freq, band] of cases) {
      const { last } = play(only(freq), { seconds: 1, rate: 44100 });
      for (const other of ['bass', 'mid', 'high']) assert.equal(last[other] > 0.9, other === band, `${freq} Hz in ${other}: ${last[other]}`);
    }
  });

  test('reset forgets the tempo, the peaks and the last spectrum', () => {
    const { tracker } = play(kicks(120), { seconds: 8 });
    tracker.reset();
    const f = tracker.update(new Float32Array(BINS).fill(-Infinity), 1 / 60);
    assert.deepEqual({ ...f }, { ...SILENT });
    // and the first spectrum after a reset is a baseline, not an onset
    const g = tracker.update(new Float32Array(BINS).fill(-20), 1 / 60);
    assert.equal(g.onset, 0);
  });

  test('every value stays in 0..1, except bpm', () => {
    const { frames } = play(kicks(128, { peak: 6 }), { seconds: 8 });
    for (const f of frames) for (const k of ['level', 'bass', 'mid', 'high', 'onset', 'beat']) assert.ok(f[k] >= 0 && f[k] <= 1, `${k} ${f[k]}`);
  });
});
