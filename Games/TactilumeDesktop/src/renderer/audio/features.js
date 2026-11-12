// Turns an analyser's spectrum into what the light reacts to: level, bass, mid, high,
// onsets, beat and bpm. Pure, so it is unit-tested with synthetic spectra.
// See CONTRACTS.md, "renderer/audio/".
//
//   const tracker = createFeatureTracker({ sampleRate, fftSize });
//   tracker.update(dbBins, dt) → { level, bass, mid, high, onset, beat, bpm }
//
// dbBins is what AnalyserNode.getFloatFrequencyData gives: decibels per bin, -Infinity for
// silence. Read it with the analyser's own smoothing at 0; all the smoothing is here, in
// seconds, so the light moves the same at 60 Hz and at 240 Hz.
//
// - Loudness: each band's RMS is scaled by its own slowly falling peak, so a quiet room and
//   a loud song both use the whole 0..1 range. The peak never falls below a floor well above
//   silence, so hiss is never stretched to fill the range, and silence reads exactly 0.
// - Onsets: the rise in log magnitude from one spectrum to the next (spectral flux), compared
//   at a fixed rate, against the median plus k times the median absolute deviation of the
//   last second. Bass, mid and high count separately and then together, so a kick, which
//   only lights a handful of bins, counts as much as a cymbal that lights hundreds.
// - Tempo: the gaps between recent onsets vote for beat periods between 60 and 180 bpm. A gap
//   of m beats votes for gap/m too, so the true beat collects votes from every pair of
//   onsets, not just neighbours. A phase-locked counter then ticks `beat` on each predicted
//   beat, and keeps ticking through the odd missed onset.

export const SILENT = Object.freeze({ level: 0, bass: 0, mid: 0, high: 0, onset: 0, beat: 0, bpm: 0 });

const BANDS = [[20, 150], [150, 2000], [2000, 12000]]; // Hz: bass, mid, high
const SILENCE_DB = -100;        // an RMS bin below this is silence (16-bit hiss sits lower)
const HEADROOM_DB = 24;         // the adaptive peak stays at least this far above silence
const PEAK_TAU = 6;             // s: how fast the adaptive peaks forget a loud passage
const RELEASE_TAU = [0.12, 0.2, 0.14, 0.12]; // s: level, bass, mid and high fall this smoothly
const HOP = 1 / 90;             // s: spectra are compared at most this often
const FLUX_WINDOW = 1;          // s of flux behind the adaptive threshold
const FLUX_SLOTS = 128;         // room for FLUX_WINDOW at the fastest hop
const MAD_K = 3;                // how many median absolute deviations above the median an onset needs
const MIN_FLUX = 0.5;           // dB: an onset also needs this much more rise than usual
const FLUX_WEIGHTS = [0.5, 0.3, 0.2]; // bass, mid, high: kicks and snares carry the beat
const REFRACTORY = 0.1;         // s: at most ten onsets a second
const ONSET_TAU = 0.15;         // s: how fast an onset fades
const ONSET_GATE_DB = SILENCE_DB + HEADROOM_DB; // quieter than this, nothing counts as an onset
const MIN_BPM = 60, MAX_BPM = 180;
const TEMPO_WINDOW = 8;         // s of onsets that vote on the tempo
const ONSET_SLOTS = 96;         // room for TEMPO_WINDOW at ten onsets a second, and some
const MAX_GAP = 3;              // s: gaps longer than this do not vote
const MULTIPLES = 4;            // a gap may hold up to this many beats
const BPM_STEP = 0.5;           // the vote histogram's resolution
const VOTE_WIDTH = 0.012;       // a vote's spread, as a share of its bpm (timing jitter)
const RECENCY_TAU = 4;          // s: older votes count for less, so a new tempo takes over
const MIN_HISTORY = 5;          // flux values needed before the threshold means anything
const MIN_ONSETS = 4;           // fewer onsets than this in the window: no tempo
// How far the best tempo's votes must stand above the average vote. Onsets at random score
// about 1.5 to 3.5; kick-and-snare patterns, swing, eighths and triplets score 6 to 20.
const MIN_CONTRAST = 4;
const GRID_TOLERANCE = 0.1;     // of a beat: how far from a beat an onset may land and still be on it
const MAX_MISSES = 3;           // estimates in a row that find no steady beat before the tempo lapses
const SNAP = 0.08;              // estimates this far apart are different tempos
const LOCK_GAIN = 0.4;          // how much of its timing error the beat counter corrects per onset
const LOCK_REACH = 0.15;        // of a beat: onsets further from a beat (off-beats, fills) do not move the counter
const BEAT_TAU = 0.1;           // s: how fast a beat tick fades

const finite = (x) => typeof x === 'number' && Number.isFinite(x);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const fromDb = (db) => 10 ** (db / 20);

export function createFeatureTracker({ sampleRate = 48000, fftSize = 2048 } = {}) {
  const rate = finite(sampleRate) && sampleRate > 0 ? sampleRate : 48000;
  const size = Number.isInteger(fftSize) && fftSize >= 32 && fftSize <= 32768 ? fftSize : 2048;
  const bins = size / 2;
  const hz = rate / size;
  // each band's bins: [first, last) by their centre frequency
  const edges = BANDS.map(([lo, hi]) => [Math.max(1, Math.ceil(lo / hz)), Math.min(bins, Math.ceil(hi / hz))]);
  const first = edges[0][0], last = edges[2][1];

  const silence = fromDb(SILENCE_DB);
  const minPeak = fromDb(SILENCE_DB + HEADROOM_DB);
  const onsetGate = fromDb(ONSET_GATE_DB);
  const previous = new Float32Array(bins);
  const fluxTime = new Float64Array(FLUX_SLOTS);
  const fluxValue = new Float64Array(FLUX_SLOTS);
  const scratch = new Float64Array(FLUX_SLOTS);
  const onsetTimes = new Float64Array(ONSET_SLOTS);
  const votes = new Float64Array(Math.round((MAX_BPM - MIN_BPM) / BPM_STEP) + 1);
  const raw = new Float64Array(4);   // level, bass, mid, high: RMS per bin, before scaling
  const peaks = new Float64Array(4);
  const shown = new Float64Array(4);
  const bandFlux = new Float64Array(3);

  let clock, sinceHop, fluxAt, fluxCount, onsetAt, onsetCount, lastOnset, wasAbove;
  let onset, bpm, pendingBpm, misses, beatPhase, beatTick;

  function reset() {
    clock = 0;
    sinceHop = HOP;
    previous.fill(SILENCE_DB);
    fluxAt = fluxCount = 0;
    onsetAt = onsetCount = 0;
    lastOnset = -Infinity;
    wasAbove = false;
    onset = 0;
    bpm = 0;
    pendingBpm = 0;
    misses = 0;
    beatPhase = 0;
    beatTick = 0;
    peaks.fill(minPeak);
    shown.fill(0);
    raw.fill(0);
  }
  reset();

  // dB of bin k, with silence, NaN and anything below the floor held at the floor
  const binDb = (db, k) => {
    const v = db[k];
    return v > SILENCE_DB ? v : SILENCE_DB;
  };

  function measureBands(db, n) {
    let total = 0, count = 0;
    for (let b = 0; b < 3; b++) {
      const [k0, k1] = edges[b];
      let sum = 0, m = 0;
      for (let k = k0; k < k1 && k < n; k++) {
        const v = db[k];
        // v > -Infinity also turns NaN away
        if (v > SILENCE_DB - 60) sum += 10 ** (v / 10);
        m++;
      }
      raw[b + 1] = m ? Math.sqrt(sum / m) : 0;
      total += sum;
      count += m;
    }
    raw[0] = count ? Math.sqrt(total / count) : 0;
  }

  // the median and the median absolute deviation of the flux in the last FLUX_WINDOW s
  function fluxThreshold() {
    let n = 0;
    for (let i = 0; i < fluxCount; i++) {
      const j = (fluxAt - 1 - i + FLUX_SLOTS) % FLUX_SLOTS;
      if (clock - fluxTime[j] > FLUX_WINDOW) break;
      scratch[n++] = fluxValue[j];
    }
    if (n < MIN_HISTORY) return Infinity;
    const median = medianOf(scratch, n);
    for (let i = 0; i < n; i++) scratch[i] = Math.abs(scratch[i] - median);
    return median + MAD_K * medianOf(scratch, n) + MIN_FLUX;
  }

  function compare(db, n) {
    for (let b = 0; b < 3; b++) {
      const [k0, k1] = edges[b];
      let rise = 0, m = 0;
      for (let k = k0; k < k1 && k < n; k++) {
        const d = binDb(db, k) - previous[k];
        if (d > 0) rise += d;
        m++;
      }
      bandFlux[b] = m ? rise / m : 0;
    }
    for (let k = first; k < last && k < n; k++) previous[k] = binDb(db, k);
    const flux = FLUX_WEIGHTS[0] * bandFlux[0] + FLUX_WEIGHTS[1] * bandFlux[1] + FLUX_WEIGHTS[2] * bandFlux[2];
    const threshold = fluxThreshold();
    fluxTime[fluxAt] = clock;
    fluxValue[fluxAt] = flux;
    fluxAt = (fluxAt + 1) % FLUX_SLOTS;
    if (fluxCount < FLUX_SLOTS) fluxCount++;
    const above = flux > threshold;
    if (above && !wasAbove && raw[0] >= onsetGate && clock - lastOnset >= REFRACTORY) heard();
    wasAbove = above;
  }

  // an onset, now
  function heard() {
    lastOnset = clock;
    onset = 1;
    onsetTimes[onsetAt] = clock;
    onsetAt = (onsetAt + 1) % ONSET_SLOTS;
    if (onsetCount < ONSET_SLOTS) onsetCount++;
    const times = recentOnsets();
    const estimate = estimateTempo(times);
    if (!estimate) {
      // a fill or a break: the beat carries on for a while before it lapses
      if (++misses >= MAX_MISSES) bpm = pendingBpm = 0;
      return;
    }
    misses = 0;
    const agree = (a, b) => Math.abs(a - b) / b <= SNAP;
    if (bpm && agree(estimate, bpm)) {
      pendingBpm = 0;
      bpm += (estimate - bpm) * 0.35;
      // pull the beat counter toward this onset when it lands near a beat
      const error = beatPhase > 0.5 ? beatPhase - 1 : beatPhase;
      if (Math.abs(error) < LOCK_REACH) beatPhase -= error * LOCK_GAIN;
      if (beatPhase < 0) beatPhase += 1;
      return;
    }
    // A tempo appears, or a different one: it has to show twice running first, so onsets that
    // happen to line up once, or one odd fill, do not start or throw off the beat.
    if (!pendingBpm || !agree(estimate, pendingBpm)) {
      pendingBpm = estimate;
      return;
    }
    bpm = estimate;
    pendingBpm = 0;
    // the beat counter starts on the grid that catches the most onsets
    const period = 60 / bpm;
    const since = (clock - bestAnchor(times, period)) / period;
    beatPhase = since - Math.floor(since);
    if (beatPhase < GRID_TOLERANCE || beatPhase > 1 - GRID_TOLERANCE) {
      beatPhase = 0;
      beatTick = 1;
    }
  }

  // the onsets in the tempo window, oldest first
  function recentOnsets() {
    const times = [];
    for (let i = 0; i < onsetCount; i++) {
      const t = onsetTimes[(onsetAt - 1 - i + ONSET_SLOTS) % ONSET_SLOTS];
      if (clock - t > TEMPO_WINDOW) break;
      times.push(t);
    }
    return times.reverse();
  }

  // The onset whose beat grid catches the most other onsets, the newest on a tie. In
  // syncopated music the newest onset is often between beats, so it is a poor place to start
  // counting from.
  function bestAnchor(times, period) {
    let best = times[times.length - 1], bestHits = -1;
    for (let a = times.length - 1; a >= 0; a--) {
      let hits = 0;
      for (const t of times) {
        const beats = Math.abs(times[a] - t) / period;
        if (Math.abs(beats - Math.round(beats)) <= GRID_TOLERANCE) hits++;
      }
      if (hits > bestHits) { best = times[a]; bestHits = hits; }
    }
    return best;
  }

  // → bpm, or 0 when the onsets do not keep a steady beat
  function estimateTempo(times) {
    if (times.length < MIN_ONSETS) return 0;
    votes.fill(0);
    const minPeriod = 60 / MAX_BPM, maxPeriod = 60 / MIN_BPM;
    for (let i = 0; i < times.length; i++) {
      for (let j = i + 1; j < times.length; j++) {
        const gap = times[j] - times[i];
        if (gap > MAX_GAP) break;
        const recency = Math.exp(-(clock - times[j]) / RECENCY_TAU);
        for (let m = 1; m <= MULTIPLES; m++) {
          const period = gap / m;
          if (period < minPeriod || period > maxPeriod) continue;
          vote(60 / period, recency / m);
        }
      }
    }
    let best = 0, sum = 0;
    for (let i = 0; i < votes.length; i++) {
      sum += votes[i];
      if (votes[i] > votes[best]) best = i;
    }
    // a steady beat piles its votes on one tempo; onsets at random spread them thin
    if (!(votes[best] > 0) || votes[best] < (MIN_CONTRAST * sum) / votes.length) return 0;
    // the peak between bins, from the parabola through it and its neighbours
    let offset = 0;
    if (best > 0 && best < votes.length - 1) {
      const a = votes[best - 1], b = votes[best], c = votes[best + 1];
      const den = a - 2 * b + c;
      if (den < 0) offset = Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den));
    }
    return MIN_BPM + (best + offset) * BPM_STEP;
  }

  // a vote for `at` bpm, spread over the histogram, and leaning gently toward 120 bpm so that
  // a pattern that fits two tempos an octave apart picks the one people tap along to
  function vote(at, weight) {
    const prior = Math.exp(-0.5 * Math.log2(at / 120) ** 2);
    const width = at * VOTE_WIDTH;
    const lo = Math.max(0, Math.floor((at - 3 * width - MIN_BPM) / BPM_STEP));
    const hi = Math.min(votes.length - 1, Math.ceil((at + 3 * width - MIN_BPM) / BPM_STEP));
    for (let i = lo; i <= hi; i++) {
      const d = (MIN_BPM + i * BPM_STEP - at) / width;
      votes[i] += weight * prior * Math.exp(-0.5 * d * d);
    }
  }

  function update(dbBins, dt) {
    const step = finite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
    clock += step;

    // Time passes first: the last onset and beat fade, and the beat counter moves on. Then
    // this spectrum is heard, so an onset in it reads as a full 1.
    onset *= Math.exp(-step / ONSET_TAU);
    if (onset < 1e-3) onset = 0;
    beatTick *= Math.exp(-step / BEAT_TAU);
    if (beatTick < 1e-3) beatTick = 0;
    // the tempo lapses once its onsets have aged out of the window
    if (bpm && clock - lastOnset > TEMPO_WINDOW) bpm = pendingBpm = misses = 0;
    if (bpm) {
      beatPhase += (step * bpm) / 60;
      if (beatPhase >= 1) {
        beatPhase -= Math.floor(beatPhase);
        beatTick = 1;
      }
    }

    const db = dbBins && typeof dbBins.length === 'number' ? dbBins : null;
    const n = db ? Math.min(db.length, bins) : 0;
    if (n) measureBands(db, n);
    else raw.fill(0);

    // Spectra are compared at a steady rate whatever the frame rate, so flux means the same
    // at 60 and 240 Hz. The first few after a reset only build the threshold's history
    // (MIN_HISTORY), so a sound already playing when listening starts is not an onset.
    sinceHop += step;
    if (n && sinceHop >= HOP) {
      sinceHop = sinceHop >= 2 * HOP ? 0 : sinceHop - HOP;
      compare(db, n);
    }

    const forget = Math.exp(-step / PEAK_TAU);
    for (let i = 0; i < 4; i++) {
      peaks[i] = Math.max(raw[i], peaks[i] * forget, minPeak);
      const target = clamp01((raw[i] - silence) / (peaks[i] - silence));
      // rise at once, fall gently: the light hits with the sound and then breathes
      shown[i] = target >= shown[i] ? target : shown[i] + (target - shown[i]) * (1 - Math.exp(-step / RELEASE_TAU[i]));
      if (shown[i] < 1e-4) shown[i] = 0;
    }

    return { level: shown[0], bass: shown[1], mid: shown[2], high: shown[3], onset, beat: beatTick, bpm };
  }

  return { update, reset };
}

// The median of the first n values of `a`, by insertion sort in place (no allocation).
function medianOf(a, n) {
  for (let i = 1; i < n; i++) {
    const v = a[i];
    let j = i - 1;
    while (j >= 0 && a[j] > v) { a[j + 1] = a[j]; j--; }
    a[j + 1] = v;
  }
  return n % 2 ? a[n >> 1] : 0.5 * (a[(n >> 1) - 1] + a[n >> 1]);
}
