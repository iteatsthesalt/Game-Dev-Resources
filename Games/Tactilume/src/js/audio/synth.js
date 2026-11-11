// The instrument the light plays. A touch strikes a soft bell, a held touch swells
// into a pad that follows it, and each behaviour has its own key, scale and tone
// colour, so changing the number of fingers changes the music as well as the motion.
//
// Everything is synthesised from sines, detuned pairs and filtered noise, so nothing
// is downloaded. Voices come from fixed pools: a busy hand steals the quietest old
// voice instead of piling up nodes. At most about 36 oscillators run at once
// (7 bells x 3 partials, 6 pads x 2, the drone's 3), which a mid-range phone carries easily.

import { clamp, mulberry32 } from '../core/util.js';
import { createReverb } from './reverb.js';

const MAX_BELLS = 7;
const MAX_PADS = 6;
const MAX_WHOOSH = 2;
const PAD_ATTACK = 0.4; // s
const PAD_RELEASE = 1.2; // s
const PAD_MIN_AGE = 0.12; // s: a quick tap is a bell, not a pad
const DRONE_AFTER = 1.8; // s without a held touch before the room starts to breathe
const REMEMBERED = 16; // recent touch ids that already rang a bell

// Peak levels before the master volume. Kept low so many voices still sum well below
// the limiter; the instrument should sit in the room, not shout.
const BELL = 0.24;
const PAD = 0.05;
const DRONE = 0.011;
const WIND = 0.05;
const WHOOSH = 0.075;
const SWELL = 0.07;

// Additive bells: [frequency ratio, level, share of the decay]. Inharmonic ratios
// make bells and bowls; whole-number ones make plucks and breathy flutes.
const TIMBRES = {
  warm: { partials: [[1, 1, 1], [2, 0.22, 0.5], [3.01, 0.07, 0.3]], attack: 0.008, decay: 3.2, gain: 1 },
  glass: { partials: [[1, 1, 1], [2.32, 0.26, 0.55], [4.25, 0.1, 0.3]], attack: 0.005, decay: 3.8, gain: 0.9 },
  pluck: { partials: [[1, 1, 1], [2, 0.36, 0.4], [3, 0.15, 0.22]], attack: 0.002, decay: 2.1, gain: 1 },
  chime: { partials: [[1, 1, 1], [2.76, 0.4, 0.45], [5.4, 0.2, 0.22]], attack: 0.002, decay: 4.6, gain: 0.82 },
  bowl: { partials: [[1, 1, 1], [2.71, 0.3, 0.7], [5.15, 0.1, 0.4]], attack: 0.022, decay: 5.2, gain: 0.85 },
  breath: { partials: [[1, 1, 1], [2, 0.12, 0.6], [3, 0.04, 0.4]], attack: 0.035, decay: 1.6, gain: 0.9 },
  crystal: { partials: [[1, 1, 1], [3.01, 0.2, 0.5], [4.97, 0.08, 0.3]], attack: 0.004, decay: 3.4, gain: 0.95 },
  swell: { partials: [[1, 1, 1], [2, 0.16, 0.8], [3, 0.05, 0.6]], attack: 0.32, decay: 2.8, gain: 1 },
};

// Saw pads are rich in harmonics, so they sit lower than triangles and sines.
const WAVE_GAIN = { sine: 1, triangle: 0.9, sawtooth: 0.5 };

// One musical colour per behaviour. Scales are pentatonic (or whole-tone), so any
// two notes the light picks sit well together.
//   root   MIDI note at the bottom of the screen; bells rise `span` octaves to the top
//   scale  semitones in an octave, for bells
//   pad    six chord tones (semitones from root) that held touches glide between
//   drone  the quiet breathing interval when nobody is touching
//   wet / bloom   reverb send and echo bloom; wind: storm's noise layer
const MODES = {
  // D dorian colour (minor third, major sixth), low and warm
  well: { root: 50, scale: [0, 3, 5, 7, 9], span: 2, bell: 'warm', pad: [-5, 0, 3, 7, 12, 15], padWave: 'triangle', padCut: 650, drone: [0, 7], wet: 0.5, bloom: 0.08 },
  // G lydian: bright and turning
  whirl: { root: 55, scale: [0, 2, 4, 6, 9], span: 2, bell: 'glass', pad: [-5, 0, 4, 7, 14, 16], padWave: 'triangle', padCut: 900, drone: [0, 7], wet: 0.55, bloom: 0.18 },
  // A major, short and sparkling
  burst: { root: 57, scale: [0, 2, 4, 7, 9], span: 2, bell: 'pluck', pad: [-5, 0, 4, 7, 12, 16], padWave: 'sawtooth', padCut: 1100, drone: [0, 7], wet: 0.38, bloom: 0.12 },
  // E suspended, open and airy
  halo: { root: 52, scale: [0, 2, 5, 7, 10], span: 2, bell: 'glass', pad: [-5, 0, 7, 10, 14, 17], padWave: 'triangle', padCut: 1400, drone: [0, 7], wet: 0.7, bloom: 0.28 },
  // F, flowing folk pentatonic
  current: { root: 53, scale: [0, 2, 5, 7, 9], span: 2, bell: 'pluck', pad: [-5, 0, 7, 9, 14, 19], padWave: 'triangle', padCut: 800, drone: [0, 7], wet: 0.5, bloom: 0.15 },
  // B minor, long singing threads
  weave: { root: 59, scale: [0, 3, 5, 7, 10], span: 2, bell: 'bowl', pad: [-5, 0, 3, 7, 10, 15], padWave: 'sawtooth', padCut: 700, drone: [0, 7], wet: 0.55, bloom: 0.2 },
  // E major, high bright bells
  chime: { root: 64, scale: [0, 2, 4, 7, 9], span: 2, bell: 'chime', pad: [-12, -5, 0, 4, 7, 12], padWave: 'sine', padCut: 2000, drone: [-12, -5], wet: 0.62, bloom: 0.3 },
  // C dark minor (flat sixth) over a low dark pad, with wind
  storm: { root: 48, scale: [0, 3, 5, 8, 10], span: 2, bell: 'warm', pad: [-12, -2, 0, 3, 10, 15], padWave: 'sawtooth', padCut: 420, drone: [0, 10], wet: 0.5, bloom: 0.06, wind: 1 },
  // C# whole-tone, glassy and suspended like a crystal
  lattice: { root: 61, scale: [0, 2, 4, 6, 8, 10], span: 2, bell: 'crystal', pad: [-12, 0, 4, 10, 14, 18], padWave: 'sine', padCut: 1600, drone: [-12, -2], wet: 0.6, bloom: 0.22 },
  // C# major singing bowls; the pad brightens as you gather, and lets go upward
  nova: { root: 49, scale: [0, 2, 4, 7, 9], span: 2.5, bell: 'bowl', pad: [-5, 0, 7, 12, 16, 19], padWave: 'sawtooth', padCut: 600, drone: [0, 7], wet: 0.6, bloom: 0.25 },
  // B flat minor, soft breathy flutes like a far-off flock
  murmur: { root: 58, scale: [0, 3, 5, 7, 10], span: 2, bell: 'breath', pad: [-5, 0, 3, 7, 10, 15], padWave: 'triangle', padCut: 900, drone: [0, 7], wet: 0.55, bloom: 0.2 },
  // D major, cascading plucks
  fountain: { root: 62, scale: [0, 2, 4, 7, 9], span: 2, bell: 'pluck', pad: [-12, -5, 0, 4, 7, 14], padWave: 'triangle', padCut: 1200, drone: [-12, -5], wet: 0.5, bloom: 0.25 },
};

export const MODE_KEYS = Object.keys(MODES);

const SWELL_PICKS = [1, 3, 5]; // which pad tones make the behaviour-change chord
const IDLE = 0, ON = 1, RELEASING = 2;

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const finite = (v, d) => (Number.isFinite(v) ? v : d);
const velocity = (power) => clamp(0.3 + 0.45 * finite(power, 1), 0.25, 1);
const isCopy = (p) => p.kind === 'mirror' || p.kind === 'virtual';

// tanh, with unity gain for quiet signals: only peaks are rounded off
function softCurve(drive = 1.6, n = 2049) {
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) curve[i] = Math.tanh(drive * ((i / (n - 1)) * 2 - 1)) / drive;
  return curve;
}

// Gently filtered white noise for wind and the nova whoosh; it loops, so two seconds do.
function makeNoise(ctx, seconds = 2) {
  const length = Math.ceil(seconds * ctx.sampleRate);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const d = buffer.getChannelData(0);
  const rand = mulberry32(0x5eed);
  let lp = 0;
  for (let i = 0; i < length; i++) {
    lp += 0.6 * (rand() * 2 - 1 - lp);
    d[i] = lp * 1.5;
  }
  return buffer;
}

// glides toward `value`, or jumps there when `glide` is 0 (a new voice has nothing to glide from)
function setParam(param, value, at, glide) {
  if (glide > 0) param.setTargetAtTime(value, at, glide);
  else param.setValueAtTime(value, at);
}

function stopSafely(node, at) {
  try { node.stop(at); } catch { /* already stopped */ }
}

function disconnectAll(...nodes) {
  for (const n of nodes) {
    if (!n) continue;
    try { n.disconnect(); } catch { /* already disconnected */ }
  }
}

// MIDI note for scale degree `deg` of a mode (degree 0 is the root)
function degreeMidi(mode, deg) {
  const n = mode.scale.length;
  const d = Math.max(0, deg | 0);
  const midi = mode.root + Math.floor(d / n) * 12 + mode.scale[d % n];
  return midi > 93 ? midi - 12 : midi; // nothing shrill: about A6 at most
}

const bellSteps = (mode) => Math.round(mode.span * mode.scale.length);
const unitY = (y) => (Number.isFinite(y) ? clamp((y + 1) / 2, 0, 1) : 0.5);

export function createSynth(ctx) {
  const output = ctx.createGain();
  // voices stay quiet going into the saturator, so it only warms the peaks;
  // this brings the level back up after it
  output.gain.value = 2.6;
  const bus = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  shaper.curve = softCurve();
  shaper.oversample = '2x';
  const dry = ctx.createGain();
  dry.gain.value = 0.82;
  const reverb = createReverb(ctx, { seconds: 3.5 });
  // Rides the level down as playing gets busier, the way a player softens a fast
  // flurry, so ten restless fingers stay about as calm as one.
  const rider = ctx.createGain();
  bus.connect(rider);
  rider.connect(shaper);
  shaper.connect(dry);
  dry.connect(output);
  shaper.connect(reverb.input);
  reverb.output.connect(output);
  const noise = makeNoise(ctx);

  let enabled = false;
  let calm = false;
  let aspect = 1;
  let modeKey = 'well';
  let mode = MODES.well;

  const bells = [];
  const whooshes = [];
  const pads = Array.from({ length: MAX_PADS }, () => ({
    state: IDLE, id: '', seen: 0, o1: null, o2: null, filter: null, env: null, panner: null,
    chord: 0, deg: 0, lastStrum: -9, endAt: 0, freq: 0, cut: 0, pan: 0, level: 0, waveGain: 1,
  }));
  // the strongest held poles this frame, best first (fixed arrays: no garbage per frame)
  const chosen = new Array(MAX_PADS).fill(null);
  const chosenScore = new Float64Array(MAX_PADS);
  let chosenN = 0;
  const rung = new Array(REMEMBERED).fill('');
  let rungAt = 0;
  let frame = 0;
  let lastHeld = -Infinity;
  let strumTokens = 4;
  let gust = 0;
  let busy = 0; // recent notes, decaying over about a second
  let riderLevel = 1;
  let drone = null;
  let wind = null;
  let pendingKey = '';
  let pendingAt = 0;
  let lastSwell = -Infinity;
  applyMix(ctx.currentTime, 0.01);

  const panFor = (x) => clamp(finite(x, 0) / aspect, -1, 1) * 0.75;
  const bellDegree = (y) => Math.round(unitY(y) * bellSteps(mode));

  // About -2 dB for gentle play (a note or two a second, a pad or two), about -11 dB
  // for a ten-finger flurry. Slow, so it never pumps.
  function rideLevel(now, dt) {
    busy *= Math.exp(-dt / 1.2);
    let held = 0;
    for (const s of pads) if (s.state === ON) held++;
    const level = 1 / (1 + (busy + held * 0.6) / 12);
    if (Math.abs(level - riderLevel) > riderLevel * 0.03) {
      rider.gain.setTargetAtTime(level, now, 0.6);
      riderLevel = level;
    }
  }

  // ---- bells ------------------------------------------------------------------

  function pruneBells(now) {
    let w = 0;
    for (let i = 0; i < bells.length; i++) if (bells[i].end > now) bells[w++] = bells[i];
    bells.length = w;
  }

  // fade the quietest bell that has finished its attack, to make room
  function stealBell(now) {
    let best = -1, bestLevel = Infinity;
    for (let i = 0; i < bells.length; i++) {
      const v = bells[i];
      if (v.attackEnd > now) continue;
      const est = v.level * Math.exp(-(now - v.attackEnd) / v.tau);
      if (est < bestLevel) { bestLevel = est; best = i; }
    }
    if (best < 0) best = 0;
    const v = bells[best];
    // the voice's own gain has no envelope on it, so this fade cannot fight one
    v.out.gain.setTargetAtTime(0, now, 0.012);
    for (const o of v.oscs) stopSafely(o, now + 0.09);
    bells.splice(best, 1);
  }

  function strike(midi, level, pan, timbreKey, at, bright = 1) {
    const t = TIMBRES[timbreKey] || TIMBRES.warm;
    pruneBells(at);
    if (bells.length >= MAX_BELLS) stealBell(at);
    // many bells at once each ring a little softer, so a flurry stays calm
    const gain = (level * t.gain * (calm ? 0.8 : 1)) / Math.sqrt(1 + 0.3 * bells.length);
    if (!(gain > 1e-4)) return;
    const f0 = mtof(midi) * Math.pow(2, ((Math.random() - 0.5) * 7) / 1200);
    const out = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = clamp(pan, -1, 1);
    out.connect(panner);
    panner.connect(bus);
    const voice = { out, oscs: [], level: gain, tau: 1, attackEnd: at + t.attack, end: at, alive: 0 };
    const shine = (calm ? 0.6 : 1) * bright;
    for (const [ratio, amp, share] of t.partials) {
      const f = f0 * ratio;
      if (f > 11000) continue;
      // upper partials are what make a bell harsh: soften everything above ~3.5 kHz
      const a = (gain * amp * (ratio === 1 ? 1 : shine)) / (1 + (f / 3500) ** 2);
      const dur = t.decay * share;
      const osc = ctx.createOscillator();
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(a, at + t.attack);
      g.gain.setTargetAtTime(0, at + t.attack, dur / 6.9); // -60 dB at `dur`
      osc.connect(g);
      g.connect(out);
      const stopAt = at + t.attack + dur;
      osc.start(at);
      osc.stop(stopAt);
      if (share === 1) voice.tau = dur / 6.9;
      voice.end = Math.max(voice.end, stopAt);
      voice.oscs.push(osc);
      voice.alive++;
      osc.onended = () => {
        disconnectAll(osc, g);
        if (--voice.alive === 0) disconnectAll(out, panner);
      };
    }
    if (!voice.alive) { disconnectAll(out, panner); return; }
    bells.push(voice);
    busy += 1;
  }

  function remember(id) {
    rung[rungAt] = String(id);
    rungAt = (rungAt + 1) % REMEMBERED;
  }
  const wasRung = (id) => rung.includes(String(id));

  // ---- pads ---------------------------------------------------------------------

  function padStart(slot, now) {
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = o2.type = mode.padWave;
    // a slow beat between the pair is what makes a pad shimmer
    o1.detune.value = 5 + Math.random() * 3;
    o2.detune.value = -5 - Math.random() * 3;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.9;
    const env = ctx.createGain();
    env.gain.value = 0;
    const panner = ctx.createStereoPanner();
    o1.connect(filter);
    o2.connect(filter);
    filter.connect(env);
    env.connect(panner);
    panner.connect(bus);
    o1.start(now);
    o2.start(now);
    Object.assign(slot, { o1, o2, filter, env, panner, freq: 0, cut: 0, pan: 0, level: 0, waveGain: WAVE_GAIN[mode.padWave] || 1 });
  }

  function padRelease(slot, now) {
    slot.state = RELEASING;
    slot.env.gain.setTargetAtTime(0, now, PAD_RELEASE / 4);
    slot.level = 0;
    slot.endAt = now + PAD_RELEASE * 1.6;
  }

  function padFree(slot, now) {
    stopSafely(slot.o1, now);
    stopSafely(slot.o2, now);
    disconnectAll(slot.o1, slot.o2, slot.filter, slot.env, slot.panner);
    slot.o1 = slot.o2 = slot.filter = slot.env = slot.panner = null;
    slot.state = IDLE;
    slot.id = '';
  }

  // picks up to MAX_PADS held poles: real touches before symmetry copies, then the strongest
  function choosePoles(poles) {
    chosenN = 0;
    for (let i = 0; i < poles.length; i++) {
      const p = poles[i];
      if (!p || !p.held || !(finite(p.age, 1) >= PAD_MIN_AGE)) continue;
      const score = (isCopy(p) ? 0 : 10) + clamp(finite(p.power, 1), 0, 2) - i * 1e-3;
      let j;
      if (chosenN < MAX_PADS) j = chosenN++;
      else if (score > chosenScore[MAX_PADS - 1]) j = MAX_PADS - 1;
      else continue;
      while (j > 0 && chosenScore[j - 1] < score) {
        chosen[j] = chosen[j - 1];
        chosenScore[j] = chosenScore[j - 1];
        j--;
      }
      chosen[j] = p;
      chosenScore[j] = score;
    }
    for (let j = chosenN; j < MAX_PADS; j++) chosen[j] = null;
  }

  function slotFor(id) {
    for (const s of pads) if (s.state !== IDLE && s.id === id) return s;
    let best = null;
    for (const s of pads) {
      if (s.state === IDLE) return s;
      if (s.state === RELEASING && (!best || s.endAt < best.endAt)) best = s;
    }
    return best;
  }

  function padFollow(slot, p, now, fresh) {
    const n = mode.pad.length;
    const pos = unitY(p.y) * (n - 1);
    // hysteresis: a finger resting on a boundary does not flutter between two notes
    if (fresh || Math.abs(pos - slot.chord) > 0.62) slot.chord = clamp(Math.round(pos), 0, n - 1);
    const freq = mtof(mode.root + mode.pad[slot.chord]);
    if (Math.abs(freq - slot.freq) > slot.freq * 0.002) {
      setParam(slot.o1.frequency, freq, now, slot.freq ? 0.07 : 0);
      setParam(slot.o2.frequency, freq, now, slot.freq ? 0.07 : 0);
      slot.freq = freq;
    }
    const speed = Math.hypot(finite(p.vx, 0), finite(p.vy, 0));
    let cut = mode.padCut * (1 + 1.4 * Math.min(speed, 4)) * (0.8 + 0.4 * (pos / (n - 1)));
    if (modeKey === 'nova') cut *= 1 + Math.min(finite(p.age, 0), 4) * 0.45; // gathering brightens
    if (calm) cut *= 0.7;
    cut = clamp(cut, 180, 7000);
    if (Math.abs(cut - slot.cut) > slot.cut * 0.03) {
      setParam(slot.filter.frequency, cut, now, slot.cut ? 0.1 : 0);
      slot.cut = cut;
    }
    const pan = panFor(p.x) * 0.9;
    if (Math.abs(pan - slot.pan) > 0.02) {
      slot.panner.pan.setTargetAtTime(pan, now, 0.1);
      slot.pan = pan;
    }
    const level = (PAD * slot.waveGain * (0.75 + 0.25 * Math.min(finite(p.power, 1), 1.5)) * (calm ? 0.8 : 1)) / Math.sqrt(Math.max(1, chosenN));
    if (Math.abs(level - slot.level) > slot.level * 0.05) {
      slot.env.gain.setTargetAtTime(level, now, PAD_ATTACK / 3);
      slot.level = level;
    }

    if (isCopy(p) || p.kind === 'pin') return;
    // Moving a held touch across the scale strums soft bells, like fingers over a harp.
    // Autoplay strums rarely, like wind chimes.
    const steps = bellSteps(mode);
    const bpos = unitY(p.y) * steps;
    if (fresh) { slot.deg = Math.round(bpos); return; }
    if (Math.abs(bpos - slot.deg) <= 0.65) return;
    slot.deg = Math.round(bpos);
    const auto = p.kind === 'auto';
    if (now - slot.lastStrum < (auto ? 1.3 : 0.11) || strumTokens < 1 || (!auto && speed < 0.25)) return;
    strumTokens -= 1;
    slot.lastStrum = now;
    const vel = velocity(p.power);
    strike(degreeMidi(mode, slot.deg), BELL * (auto ? 0.4 : 0.5) * vel, panFor(p.x), mode.bell, now, 0.5 + 0.5 * vel);
  }

  function updatePads(now, poles) {
    frame++;
    if (enabled) choosePoles(poles);
    else chosenN = 0;
    for (let i = 0; i < chosenN; i++) {
      const p = chosen[i];
      const id = String(p.id);
      const slot = slotFor(id);
      if (!slot) continue;
      const fresh = slot.id !== id;
      if (slot.state === IDLE) padStart(slot, now);
      slot.state = ON;
      slot.seen = frame;
      if (fresh) {
        slot.id = id;
        slot.lastStrum = now;
        // touches that did not ring on the way down (autoplay, keys) ring as they bloom
        if (!isCopy(p) && !wasRung(id)) {
          remember(id);
          strike(degreeMidi(mode, bellDegree(p.y)), BELL * (p.kind === 'auto' ? 0.45 : 0.6) * velocity(p.power), panFor(p.x), mode.bell, now);
        }
      }
      padFollow(slot, p, now, fresh);
    }
    for (const s of pads) {
      if (s.state === ON && s.seen !== frame) padRelease(s, now);
      else if (s.state === RELEASING && now >= s.endAt) padFree(s, now);
    }
  }

  // ---- the breathing drone when nobody touches -----------------------------------

  function droneFreqs() {
    return [mtof(mode.root + mode.drone[0]), mtof(mode.root + mode.drone[1])];
  }

  function droneStart(now) {
    const [fa, fb] = droneFreqs();
    const a = ctx.createOscillator();
    a.frequency.value = fa;
    const b = ctx.createOscillator();
    b.type = 'triangle';
    b.frequency.value = fb;
    b.detune.value = 4;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    const breath = ctx.createGain();
    breath.gain.value = DRONE;
    // a slow swell of about eleven seconds: the room breathing
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const depth = ctx.createGain();
    depth.gain.value = DRONE * 0.7;
    const fade = ctx.createGain();
    fade.gain.value = 0;
    fade.gain.setTargetAtTime(calm ? 0.7 : 1, now, 1.4);
    a.connect(filter);
    b.connect(filter);
    filter.connect(breath);
    breath.connect(fade);
    fade.connect(bus);
    lfo.connect(depth);
    depth.connect(breath.gain);
    a.start(now);
    b.start(now);
    lfo.start(now);
    drone = { a, b, lfo, depth, filter, breath, fade, endAt: 0 };
  }

  function droneUpdate(now) {
    const want = enabled && now - lastHeld > DRONE_AFTER;
    if (want && !drone) droneStart(now);
    if (!drone) return;
    if (want && drone.endAt) {
      drone.endAt = 0;
      drone.fade.gain.setTargetAtTime(calm ? 0.7 : 1, now, 1.4);
    } else if (!want && !drone.endAt) {
      drone.fade.gain.setTargetAtTime(0, now, 0.3);
      drone.endAt = now + 1.8;
    } else if (drone.endAt && now >= drone.endAt) {
      droneFree(now);
    }
  }

  function droneFree(now) {
    if (!drone) return;
    for (const o of [drone.a, drone.b, drone.lfo]) stopSafely(o, now);
    disconnectAll(drone.a, drone.b, drone.lfo, drone.depth, drone.filter, drone.breath, drone.fade);
    drone = null;
  }

  // ---- storm wind ---------------------------------------------------------------

  function windStart(now) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const panner = ctx.createStereoPanner();
    src.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(bus);
    src.start(now, Math.random() * 1.5);
    wind = { src, filter, gain, panner, level: 0, freq: 400, pan: 0, quietSince: 0 };
  }

  function windFree(now) {
    if (!wind) return;
    stopSafely(wind.src, now);
    disconnectAll(wind.src, wind.filter, wind.gain, wind.panner);
    wind = null;
  }

  function windUpdate(now, dt, poles) {
    gust *= Math.exp(-dt / 0.7);
    let act = 0, sx = 0, n = 0;
    for (let i = 0; i < poles.length; i++) {
      const p = poles[i];
      if (!p || !p.held || isCopy(p)) continue;
      act += 0.25 + Math.min(Math.hypot(finite(p.vx, 0), finite(p.vy, 0)), 4) * 0.3;
      sx += finite(p.x, 0);
      n++;
    }
    act = Math.min(act, 2) + gust;
    const want = enabled && !!mode.wind && act > 0.02;
    if (want && !wind) windStart(now);
    if (!wind) return;
    const level = want ? WIND * mode.wind * Math.min(act, 2.5) * (calm ? 0.7 : 1) : 0;
    if (Math.abs(level - wind.level) > Math.max(wind.level * 0.05, 1e-4)) {
      wind.gain.gain.setTargetAtTime(level, now, level > wind.level ? 0.12 : 0.6);
      wind.level = level;
    }
    const freq = 320 + 700 * Math.min(act, 2.5);
    if (Math.abs(freq - wind.freq) > wind.freq * 0.03) {
      wind.filter.frequency.setTargetAtTime(freq, now, 0.2);
      wind.freq = freq;
    }
    const pan = n ? panFor(sx / n) * 0.7 : 0;
    if (Math.abs(pan - wind.pan) > 0.03) {
      wind.panner.pan.setTargetAtTime(pan, now, 0.3);
      wind.pan = pan;
    }
    if (want) wind.quietSince = 0;
    else if (!wind.quietSince) wind.quietSince = now;
    else if (now - wind.quietSince > 2.5) windFree(now);
  }

  // ---- nova's release ---------------------------------------------------------------

  function whoosh(pan, h, at) {
    let w = 0;
    for (let i = 0; i < whooshes.length; i++) if (whooshes[i].end > at) whooshes[w++] = whooshes[i];
    whooshes.length = w;
    if (whooshes.length >= MAX_WHOOSH) {
      const old = whooshes.shift();
      old.out.gain.setTargetAtTime(0, at, 0.03);
      stopSafely(old.src, at + 0.2);
    }
    const dur = 0.7 + 1.5 * h;
    const peakAt = at + dur * 0.55;
    const tau = dur * 0.22;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(220, at);
    filter.frequency.exponentialRampToValueAtTime(1600 + 3400 * h, at + dur);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(WHOOSH * (0.45 + 0.55 * h) * (calm ? 0.7 : 1), peakAt);
    gain.gain.setTargetAtTime(0, peakAt, tau);
    const out = ctx.createGain(); // no envelope here, so a steal can fade it cleanly
    const panner = ctx.createStereoPanner();
    panner.pan.value = clamp(pan, -1, 1);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    out.connect(panner);
    panner.connect(bus);
    const end = peakAt + tau * 7;
    src.start(at, Math.random() * 1.5);
    src.stop(end);
    src.onended = () => disconnectAll(src, filter, gain, out, panner);
    whooshes.push({ src, out, end });
  }

  // ---- behaviours -----------------------------------------------------------------

  // calm play sits a little further back in the room
  function applyMix(now, glide = 0.5) {
    reverb.setMix({ wet: mode.wet * (calm ? 1.15 : 1), bloom: mode.bloom }, now, glide);
  }

  function setMode(key, now) {
    if (key === modeKey || !MODES[key]) return;
    modeKey = key;
    mode = MODES[key];
    applyMix(now);
    if (drone) {
      const [fa, fb] = droneFreqs();
      drone.a.frequency.setTargetAtTime(fa, now, 0.8);
      drone.b.frequency.setTargetAtTime(fb, now, 0.8);
    }
  }

  function swellChord(at) {
    for (let i = 0; i < SWELL_PICKS.length; i++) {
      strike(mode.root + 12 + mode.pad[SWELL_PICKS[i]], SWELL, (i - 1) * 0.35, 'swell', at + i * 0.05, 0.7);
    }
    lastSwell = at;
  }

  function silence(now = ctx.currentTime) {
    for (const v of bells) for (const o of v.oscs) stopSafely(o, now);
    bells.length = 0;
    for (const w of whooshes) stopSafely(w.src, now);
    whooshes.length = 0;
    for (const s of pads) if (s.state !== IDLE) padFree(s, now);
    droneFree(now);
    windFree(now);
    gust = 0;
    busy = 0;
    pendingKey = '';
  }

  return {
    output,

    setEnabled(on) {
      enabled = !!on;
      if (enabled) lastHeld = -Infinity; // a fresh start breathes at once
    },
    setCalm(on) {
      if (calm === !!on) return;
      calm = !!on;
      applyMix(ctx.currentTime);
    },
    setAspect(a) { if (Number.isFinite(a) && a > 0) aspect = a; },

    noteDown(note, at = ctx.currentTime) {
      if (!enabled || !note) return;
      remember(note.id);
      const vel = velocity(note.power);
      strike(degreeMidi(mode, bellDegree(note.y)), BELL * vel, panFor(note.x), mode.bell, at, 0.55 + 0.6 * vel);
    },

    noteUp(note, at = ctx.currentTime) {
      if (!enabled || !note) return;
      const held = Math.max(0, finite(note.heldFor, 0));
      const speed = Math.hypot(finite(note.vx, 0), finite(note.vy, 0));
      const pan = panFor(note.x);
      if (mode.wind) gust = Math.min(1.6, gust + speed / 2.5); // a flick throws a gust
      if (modeKey === 'nova') {
        // let go of the gathered light: an airy rush and a few bells climbing after it
        const h = clamp(held / 2.5, 0, 1);
        whoosh(pan, h, at);
        if (held > 0.25) {
          const deg = bellDegree(note.y);
          const count = h > 0.55 ? 4 : 3;
          for (let i = 0; i < count; i++) {
            strike(degreeMidi(mode, deg + 2 + i * 2), BELL * (0.3 + 0.25 * h) * (1 - i * 0.12), pan * (1 - i * 0.25), 'chime', at + 0.1 + i * (0.07 + 0.05 * h), 0.8);
          }
        }
        return;
      }
      // a long hold answers softly when it lifts
      if (held > 0.6) strike(degreeMidi(mode, bellDegree(note.y) + 2), BELL * 0.28, pan, 'breath', at + 0.02, 0.6);
    },

    behaviourChanged(key, at = ctx.currentTime) {
      setMode(key, at);
      if (!enabled) return;
      // wait a moment, so lifting fingers one by one plays one chord, not four
      pendingKey = key;
      pendingAt = at + 0.12;
    },

    update(dt, poles, behaviourKey, now = ctx.currentTime) {
      const list = Array.isArray(poles) ? poles : [];
      if (behaviourKey) setMode(behaviourKey, now);
      strumTokens = Math.min(4, strumTokens + finite(dt, 0) * 9);
      for (let i = 0; i < list.length; i++) {
        if (list[i] && list[i].held) { lastHeld = now; break; }
      }
      if (pendingKey && now >= pendingAt) {
        if (enabled && pendingKey === modeKey && now - lastSwell > 0.6) swellChord(now);
        pendingKey = '';
      }
      updatePads(now, list);
      droneUpdate(now);
      windUpdate(now, finite(dt, 0), list);
      rideLevel(now, finite(dt, 0));
    },

    // stops every voice at once (after the output has faded)
    silence,

    stats(now = ctx.currentTime) {
      let oscillators = 0;
      for (const v of bells) if (v.end > now) oscillators += v.oscs.length;
      let padsOn = 0;
      for (const s of pads) if (s.state !== IDLE) padsOn++;
      oscillators += padsOn * 2 + (drone ? 3 : 0);
      return { mode: modeKey, bells: bells.length, pads: padsOn, drone: !!drone, wind: !!wind, whooshes: whooshes.length, oscillators };
    },

    dispose() {
      silence();
      reverb.dispose();
      disconnectAll(output, bus, rider, shaper, dry);
    },
  };
}
