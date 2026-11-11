// "Surprise me": a random scene that still looks good. Rather than rolling every
// slider, it picks a character for the scene and then varies within tasteful ranges.

import { BEHAVIOUR_KEYS, DEFAULT_CHORDS } from './behaviours.js';
import { PALETTE_KEYS } from './palettes.js';
import { FORMS, COLOR_BY, sanitizeScene } from './scene.js';

const pick = (rnd, list) => list[Math.floor(rnd() * list.length) % list.length];
const range = (rnd, lo, hi) => lo + (hi - lo) * rnd();

const ADJECTIVES = ['Quiet', 'Molten', 'Drifting', 'Hollow', 'Silver', 'Restless', 'Velvet', 'Distant', 'Burning', 'Tidal', 'Paper', 'Glass'];
const NOUNS = ['Lanterns', 'Harbour', 'Orchard', 'Comet', 'Weather', 'Choir', 'Lace', 'Embers', 'Shoal', 'Meadow', 'Signal', 'Veil'];

// `rnd` returns numbers in 0..1 (Math.random, or a seeded generator in tests).
export function surpriseScene(rnd = Math.random) {
  const character = pick(rnd, ['calm', 'lively', 'wild', 'crystal']);
  const lockOne = rnd() < 0.55;
  const symmetry = rnd() < 0.35 ? pick(rnd, [2, 3, 4, 5, 6, 8]) : 1;
  const chords = rnd() < 0.5 ? [...DEFAULT_CHORDS] : DEFAULT_CHORDS.map(() => pick(rnd, BEHAVIOUR_KEYS));
  const base = {
    lock: lockOne ? pick(rnd, BEHAVIOUR_KEYS) : 'auto',
    chords,
    symmetry,
    mirror: symmetry > 1 && rnd() < 0.5,
    palette: pick(rnd, PALETTE_KEYS),
    colorBy: pick(rnd, COLOR_BY),
    form: pick(rnd, FORMS),
    hue: rnd() < 0.3 ? range(rnd, 0, 1) : 0,
    name: `${pick(rnd, ADJECTIVES)} ${pick(rnd, NOUNS)}`,
  };
  const byCharacter = {
    calm: { speed: range(rnd, 0.5, 0.8), drag: range(rnd, 0.35, 0.6), flow: range(rnd, 0.15, 0.4), trails: range(rnd, 0.55, 0.85), glow: range(rnd, 0.45, 0.65), orbit: range(rnd, 0.1, 0.35) },
    lively: { speed: range(rnd, 0.9, 1.2), drag: range(rnd, 0.2, 0.4), flow: range(rnd, 0.25, 0.5), trails: range(rnd, 0.35, 0.65), glow: range(rnd, 0.55, 0.75), orbit: range(rnd, 0.25, 0.55) },
    wild: { speed: range(rnd, 1.1, 1.5), drag: range(rnd, 0.05, 0.25), flow: range(rnd, 0.4, 0.8), strength: range(rnd, 1.1, 1.8), trails: range(rnd, 0.4, 0.8), glow: range(rnd, 0.65, 0.9) },
    crystal: { speed: range(rnd, 0.6, 1), drag: range(rnd, 0.4, 0.7), flow: range(rnd, 0, 0.15), trails: range(rnd, 0.1, 0.35), sparkle: range(rnd, 0.5, 0.9), size: range(rnd, 0.6, 0.9), depth: range(rnd, 0.1, 0.4) },
  }[character];
  return sanitizeScene({
    depth: range(rnd, 0.2, 0.9),
    focus: range(rnd, 0.15, 0.6),
    size: range(rnd, 0.7, 1.4),
    ...base,
    ...byCharacter,
  });
}
