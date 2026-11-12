// A soft hall for the instrument: a convolution reverb whose impulse is made here
// (no sample files ship with the app), plus a faint feedback echo, the "bloom",
// that feeds the hall so long bells seem to hang in the air.

import { mulberry32 } from '../core/util.js';

// A stereo impulse: a cluster of early reflections, then decaying noise that
// darkens as it fades, the way high notes die first in a large stone room.
// Deterministic for a seed, so the room sounds the same on every visit.
export function makeImpulse(ctx, { seconds = 3.5, preDelay = 0.012, seed = 0x7ac7 } = {}) {
  const rate = ctx.sampleRate;
  const length = Math.max(2, Math.ceil(seconds * rate));
  const buffer = ctx.createBuffer(2, length, rate);
  const rand = mulberry32(seed);
  const pre = Math.min(length - 1, Math.round(preDelay * rate));
  const tailSamples = length - pre;
  const decay = Math.exp(-6.9 / tailSamples); // -60 dB by the last sample
  const growIn = Math.max(1, Math.round(0.045 * rate)); // the tail swells in under the reflections
  const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
  let peakEnergy = 0;

  for (const d of channels) {
    let lp = 0;
    let env = 1;
    let energy = 0;
    for (let i = pre; i < length; i++) {
      const k = i - pre;
      // a one-pole lowpass whose cutoff falls from ~9 kHz to ~1 kHz over the tail
      const coef = 0.78 - 0.66 * Math.sqrt(k / tailSamples);
      lp += coef * (rand() * 2 - 1 - lp);
      const v = lp * env * (k < growIn ? k / growIn : 1);
      d[i] = v;
      energy += v * v;
      env *= decay;
    }
    // Early reflections carry about a sixth of the tail's energy: enough to give the
    // room a shape, not so much that it rings like a metal tube.
    const taps = 16;
    const tapGains = new Float32Array(taps);
    const tapAt = new Int32Array(taps);
    let tapEnergy = 0;
    for (let r = 0; r < taps; r++) {
      const time = 0.005 + Math.pow(rand(), 1.5) * 0.085;
      tapAt[r] = Math.min(length - 3, pre + Math.round(time * rate));
      tapGains[r] = (0.4 + 0.6 * rand()) * Math.exp(-time * 18) * (rand() < 0.5 ? -1 : 1);
      tapEnergy += tapGains[r] * tapGains[r] * 0.46; // 0.6² + 0.3² + 0.1², the spread below
    }
    const tapScale = Math.sqrt((energy * 0.16) / Math.max(tapEnergy, 1e-9));
    for (let r = 0; r < taps; r++) {
      // spread each reflection over three samples: a softer, less clicky echo
      const g = tapGains[r] * tapScale;
      d[tapAt[r]] += g * 0.6;
      d[tapAt[r] + 1] += g * 0.3;
      d[tapAt[r] + 2] += g * 0.1;
    }
    let total = 0;
    for (let i = 0; i < length; i++) total += d[i] * d[i];
    peakEnergy = Math.max(peakEnergy, total);
  }

  // unit energy, so a sustained sound comes back from the hall at about its own level
  const scale = 1 / Math.sqrt(Math.max(peakEnergy, 1e-12));
  for (const d of channels) for (let i = 0; i < length; i++) d[i] *= scale;
  return buffer;
}

// input -> [highpass, lowpass] -> convolver -> output, with the bloom echo feeding
// the convolver too. `setMix` moves the send levels smoothly.
export function createReverb(ctx, { seconds = 3.5 } = {}) {
  const input = ctx.createGain();
  const output = ctx.createGain();

  const send = ctx.createGain();
  send.gain.value = 0.5;
  // low rumble muddies a long tail and fizz makes it hiss; keep the luminous middle
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 170;
  hp.Q.value = 0.6;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 8000;
  lp.Q.value = 0.5;
  const convolver = ctx.createConvolver();
  convolver.normalize = false; // the impulse is already normalised to unit energy
  convolver.buffer = makeImpulse(ctx, { seconds });

  input.connect(send);
  send.connect(hp);
  hp.connect(lp);
  lp.connect(convolver);
  convolver.connect(output);

  const bloomSend = ctx.createGain();
  bloomSend.gain.value = 0;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.293;
  const tone = ctx.createBiquadFilter();
  tone.type = 'bandpass';
  tone.frequency.value = 1700;
  tone.Q.value = 0.45;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.36;
  input.connect(bloomSend);
  bloomSend.connect(delay);
  delay.connect(tone);
  tone.connect(feedback);
  feedback.connect(delay);
  tone.connect(hp);

  const nodes = [input, output, send, hp, lp, convolver, bloomSend, delay, tone, feedback];

  return {
    input,
    output,
    setMix({ wet, bloom }, at = ctx.currentTime, glide = 0.5) {
      send.gain.setTargetAtTime(wet, at, glide);
      bloomSend.gain.setTargetAtTime(bloom, at, glide);
    },
    dispose() {
      for (const n of nodes) {
        try { n.disconnect(); } catch { /* already disconnected */ }
      }
    },
  };
}
