// Listens to the microphone or a song and boils it down to five numbers the light
// can dance to: overall level, bass, mid, high and onset (a beat or a clap).
//
// Each value is scaled by its own slowly falling peak, so a quiet room and a loud
// song both use the whole 0..1 range. read() runs every frame, so it allocates
// nothing: every buffer is made once, here.

export const SILENT = Object.freeze({ level: 0, bass: 0, mid: 0, high: 0, onset: 0 });

const FFT_SIZE = 2048;
const BANDS_HZ = [20, 160, 2000, 9000]; // bass | mid | high
const PEAK_TAU = 4; // s: how fast the adaptive peaks forget a loud passage
const ONSET_TAU = 0.15; // s: how fast an onset fades
const ONSET_GAP = 0.1; // s: at most ten onsets a second
const RELEASE_TAU = [0.12, 0.2, 0.14, 0.12]; // s: level, bass, mid, high fall this smoothly
const HISTORY = 31; // flux values for the median, about half a second
const MIN_STEP = 1 / 75; // s: spectra are compared at most this often, so flux means the same at 60 or 120 Hz
const WARMUP = 1; // spectra read only to refresh the analyser, after a reset or a pause in reading
const SMOOTHING = 0.5;
const DB_FLOOR = -100; // spectrum values below this count as silence
const DB_TO_LN = Math.LN10 / 20;
// Below these the room is silent: peaks never fall under them, so hiss is not
// stretched to fill the range. Units: RMS for level, mean bin magnitude for bands.
const LEVEL_FLOOR = 0.004;
const BAND_FLOOR = 6e-5;

export function createAnalyser(ctx) {
  const input = ctx.createGain();
  const node = ctx.createAnalyser();
  node.fftSize = FFT_SIZE;
  node.smoothingTimeConstant = SMOOTHING;
  input.connect(node);
  // A silent path to the speakers keeps every browser pulling audio through the analyser.
  const sink = ctx.createGain();
  sink.gain.value = 0;
  node.connect(sink);
  sink.connect(ctx.destination);

  const hz = ctx.sampleRate / FFT_SIZE;
  const bins = node.frequencyBinCount;
  const edge = BANDS_HZ.map((f) => Math.min(bins - 1, Math.max(1, Math.round(f / hz))));
  const [b0, b1, b2, b3] = edge;
  const spectrum = new Float32Array(bins);
  const previous = new Float32Array(b3 + 1);
  const wave = new Float32Array(FFT_SIZE);
  const history = new Float32Array(HISTORY);
  const sorted = new Float32Array(HISTORY);
  const raw = new Float64Array(4); // level, bass, mid, high, before normalising
  const peaks = new Float64Array(4);
  const shown = new Float64Array(4);
  const out = { level: 0, bass: 0, mid: 0, high: 0, onset: 0 };

  let historyCount = 0;
  let historyAt = 0;
  let lastTime = 0;
  let sinceSpectrum = 0;
  let lastOnset = -1;
  let clock = 0;
  let wasAbove = false;
  let warmup = 0;

  function reset() {
    warmup = WARMUP;
    previous.fill(DB_FLOOR);
    peaks[0] = LEVEL_FLOOR;
    peaks[1] = peaks[2] = peaks[3] = BAND_FLOOR;
    shown.fill(0);
    historyCount = historyAt = 0;
    sinceSpectrum = MIN_STEP;
    lastTime = 0;
    lastOnset = -1;
    wasAbove = false;
    out.level = out.bass = out.mid = out.high = out.onset = 0;
  }
  reset();

  // the median of the recent flux, by insertion sort into a scratch array (no allocation)
  function medianFlux() {
    const n = historyCount;
    for (let i = 0; i < n; i++) {
      const v = history[i];
      let j = i - 1;
      while (j >= 0 && sorted[j] > v) { sorted[j + 1] = sorted[j]; j--; }
      sorted[j + 1] = v;
    }
    return n ? sorted[n >> 1] : 0;
  }

  function measure(gain) {
    // The analyser blends each spectrum with the one read before it, however long ago
    // that was. After a pause or a new source, one unblended read clears the old sound.
    const flush = warmup > 0;
    if (flush) node.smoothingTimeConstant = 0;
    node.getFloatFrequencyData(spectrum);
    if (flush) node.smoothingTimeConstant = SMOOTHING;
    let bass = 0, mid = 0, high = 0, flux = 0;
    for (let k = b0; k <= b3; k++) {
      let db = spectrum[k];
      if (!(db > DB_FLOOR)) db = DB_FLOOR; // also catches -Infinity and NaN
      const mag = db > DB_FLOOR ? Math.exp(db * DB_TO_LN) : 0;
      if (k < b1) bass += mag;
      else if (k < b2) mid += mag;
      else high += mag;
      const rise = db - previous[k];
      if (rise > 0) flux += rise;
      previous[k] = db;
    }
    raw[1] = bass / (b1 - b0);
    raw[2] = mid / (b2 - b1);
    raw[3] = high / (b3 - b2 + 1);
    flux /= b3 - b0 + 1;

    node.getFloatTimeDomainData(wave);
    let sum = 0;
    for (let i = 0; i < FFT_SIZE; i++) sum += wave[i] * wave[i];
    raw[0] = Math.sqrt(sum / FFT_SIZE);

    if (flush) {
      // this read only refreshed the analyser: judge nothing from it
      warmup--;
      raw.fill(0);
      wasAbove = false;
      return;
    }

    // Spectral-flux onsets: a sudden broadband rise well above the recent median.
    // More sensitivity lowers the bar.
    history[historyAt] = flux;
    historyAt = (historyAt + 1) % HISTORY;
    if (historyCount < HISTORY) historyCount++;
    const threshold = medianFlux() * (1 + 0.6 / gain) + 1.4 / gain;
    const above = flux > threshold && historyCount > 4;
    const loudEnough = raw[0] > (LEVEL_FLOOR * 0.5) / gain;
    if (above && !wasAbove && loudEnough && clock - lastOnset > ONSET_GAP) {
      out.onset = 1;
      lastOnset = clock;
    }
    wasAbove = above;
  }

  // sensitivity 0..1 (0.5 neutral); now in ms (performance.now())
  function read(sensitivity, now) {
    if (!lastTime || now - lastTime > 250) warmup = Math.max(warmup, WARMUP);
    const dt = lastTime ? Math.min(Math.max((now - lastTime) / 1000, 0), 0.25) : 0;
    lastTime = now;
    clock += dt;
    // 0.5 is neutral; each end is about three times less or more
    const gain = Math.pow(2, (sensitivity - 0.5) * 3.2);
    out.onset *= Math.exp(-dt / ONSET_TAU);

    sinceSpectrum += dt;
    if (sinceSpectrum >= MIN_STEP) {
      sinceSpectrum = 0;
      measure(gain);
    }

    const forget = Math.exp(-dt / PEAK_TAU);
    for (let i = 0; i < 4; i++) {
      const floor = (i === 0 ? LEVEL_FLOOR : BAND_FLOOR) / gain;
      peaks[i] = Math.max(raw[i], peaks[i] * forget, floor);
      const target = Math.min(1, (raw[i] / peaks[i]) * 1.15 * gain);
      // rise at once, fall gently: the light should hit with the beat and then breathe
      shown[i] = target > shown[i] ? target : shown[i] + (target - shown[i]) * (1 - Math.exp(-dt / RELEASE_TAU[i]));
    }
    out.level = shown[0];
    out.bass = shown[1];
    out.mid = shown[2];
    out.high = shown[3];
    return out;
  }

  return {
    input,
    read,
    reset,
    dispose() {
      for (const n of [input, node, sink]) {
        try { n.disconnect(); } catch { /* already disconnected */ }
      }
    },
  };
}
