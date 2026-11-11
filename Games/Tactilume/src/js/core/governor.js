// Keeps the motion smooth: watches how long frames take and trades detail
// (particle count first, then render resolution) for frame rate, and back again
// when there is room. Pure logic, no DOM: main.js feeds it frame intervals.

import { clamp } from './util.js';

const RATES = [30, 60, 72, 90, 120, 144, 165, 240];

// The display's refresh rate from a list of frame intervals in ms.
export function estimateRefresh(intervals) {
  const sorted = intervals.filter((x) => x > 2 && x < 100).sort((a, b) => a - b);
  if (sorted.length < 8) return 60;
  const median = sorted[sorted.length >> 1];
  const hz = 1000 / median;
  let best = 60, err = Infinity;
  for (const r of RATES) {
    const e = Math.abs(r - hz) / r;
    if (e < err) { err = e; best = r; }
  }
  return best;
}

export const MODES = {
  // frame budget as a share of the display interval, and the ceilings for each mode
  battery: { targetHz: 30, maxScale: 0.75, maxShare: 0.45 },
  balanced: { targetHz: 60, maxScale: 1, maxShare: 0.75 },
  max: { targetHz: 0, maxScale: 1, maxShare: 1 },
  auto: { targetHz: 0, maxScale: 1, maxShare: 1 },
};

// maxParticles: what the engine allocated. startParticles: where to begin.
export function createGovernor({ maxParticles, startParticles, minParticles = 8192, mode = 'auto', startScale = 1 }) {
  let cfg = MODES[mode] || MODES.auto;
  let particles = clamp(startParticles, minParticles, maxParticles * cfg.maxShare);
  let scale = clamp(startScale, 0.5, cfg.maxScale);
  const intervals = [];
  let refreshHz = 60;
  let slowFor = 0, fastFor = 0, settleFor = 1.0; // seconds
  let frozen = false;

  function budgetMs() {
    const hz = cfg.targetHz || refreshHz;
    return 1000 / hz;
  }

  return {
    get particles() { return Math.round(particles); },
    get renderScale() { return scale; },
    get refreshHz() { return refreshHz; },
    get mode() { return mode; },

    setMode(m) {
      mode = MODES[m] ? m : 'auto';
      cfg = MODES[mode];
      particles = Math.min(particles, maxParticles * cfg.maxShare);
      scale = Math.min(scale, cfg.maxScale);
      if (mode === 'max') { particles = maxParticles; scale = 1; }
      settleFor = 1.0;
    },

    // Stops adjusting (tests, or while recording video so the clip stays steady).
    freeze(on) { frozen = !!on; },

    // Call once per displayed frame with the time since the previous one (ms).
    // Returns true when the targets changed.
    sample(intervalMs, dtSeconds = intervalMs / 1000) {
      intervals.push(intervalMs);
      if (intervals.length > 120) intervals.shift();
      if (intervals.length % 30 === 0) refreshHz = estimateRefresh(intervals);
      if (frozen || mode === 'max') return false;
      if (settleFor > 0) { settleFor -= dtSeconds; return false; }

      const budget = budgetMs();
      // the median of the last 20 frames ignores one-off hitches
      const recent = intervals.slice(-20).sort((a, b) => a - b);
      const typical = recent[recent.length >> 1];
      if (typical > budget * 1.25) { slowFor += dtSeconds; fastFor = 0; }
      else if (typical < budget * 1.08) { fastFor += dtSeconds; slowFor = 0; }
      else { slowFor = 0; fastFor = 0; }

      let changed = false;
      if (slowFor > 0.6) {
        // particles are cheapest to give up and the least visible; resolution after
        if (particles > maxParticles * 0.25 || scale <= 0.6) particles = Math.max(minParticles, particles * 0.8);
        else scale = Math.max(0.5, scale - 0.1);
        slowFor = 0; settleFor = 0.8; changed = true;
      } else if (fastFor > 3) {
        if (scale < cfg.maxScale) scale = Math.min(cfg.maxScale, scale + 0.1);
        else particles = Math.min(maxParticles * cfg.maxShare, particles * 1.15);
        fastFor = 0; settleFor = 1.5; changed = true;
      }
      return changed;
    },
  };
}

// A starting point for this device, from what can be learned without benchmarks.
// The governor corrects it within a few seconds either way.
export function guessTier({ renderer = '', maxTextureSize = 4096, deviceMemory = 4, cores = 4, touch = false, screenPixels = 2e6 }) {
  const r = renderer.toLowerCase();
  const discrete = /nvidia|geforce|rtx|radeon rx|radeon pro|arc a|apple m\d (pro|max|ultra)/.test(r);
  const software = /swiftshader|llvmpipe|software|basic render/.test(r);
  if (software) return 'low';
  if (!touch && (discrete || (deviceMemory >= 8 && cores >= 8))) return 'ultra';
  if (/adreno \(tm\) (7[3-9]\d|8\d\d)|adreno.*8\d\d|mali-g7[1-9]\d|mali-g9\d\d|immortalis|xclipse|apple gpu|apple m/.test(r)) return 'high';
  if (maxTextureSize >= 16384 && deviceMemory >= 6) return 'high';
  if (deviceMemory <= 2 || cores <= 4 || /adreno \(tm\) [1-5]\d\d|mali-[4t]|powervr/.test(r)) return 'low';
  return screenPixels > 3.5e6 && touch ? 'mid' : 'mid';
}

// Particle buffers to allocate, and where to start, for each tier.
export const TIERS = {
  low: { max: 1 << 17, start: 1 << 16 },      // 131k / 65k
  mid: { max: 1 << 19, start: 1 << 18 },      // 524k / 262k
  high: { max: 1 << 20, start: 1 << 19 },     // 1M / 524k
  ultra: { max: 1 << 21, start: 1 << 20 },    // 2M / 1M
};
