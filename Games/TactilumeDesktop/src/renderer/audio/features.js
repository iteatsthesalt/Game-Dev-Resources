// Turns an analyser's spectrum into what the light reacts to: level, bass, mid, high,
// onsets, beat and bpm. Pure, so it is unit-tested with synthetic spectra.
//
// First version, written by the spine: it hears nothing. The input-audio part owns this
// file and replaces it.

export function createFeatureTracker({ sampleRate, fftSize }) {
  return {
    // dbBins: Float32Array of decibels per bin (AnalyserNode.getFloatFrequencyData); dt in s
    update(dbBins, dt) {
      return { level: 0, bass: 0, mid: 0, high: 0, onset: 0, beat: 0, bpm: 0 };
    },
  };
}
