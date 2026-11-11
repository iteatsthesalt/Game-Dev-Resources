// The built-in scenes. Each lists only what differs from the defaults.
// Keys are permanent (saved as "last played"); names and blurbs can change freely.

import { sanitizeScene } from './scene.js';

export const PRESETS = [
  {
    key: 'first-light', name: 'First Light', blurb: 'Warm embers that orbit your touch.',
    scene: { palette: 'ember', colorBy: 'speed', form: 'nebula', glow: 0.65, trails: 0.55, focus: 0.35, flow: 0.3 },
  },
  {
    key: 'aurora-loom', name: 'Aurora Loom', blurb: 'Green and gold threads stretched between fingers.',
    scene: { palette: 'aurora', colorBy: 'heat', form: 'ring', lock: 'weave', trails: 0.75, glow: 0.7, depth: 0.45, size: 0.8 },
  },
  {
    key: 'deep-current', name: 'Deep Current', blurb: 'A cold river of light runs from touch to touch.',
    scene: { palette: 'abyss', colorBy: 'direction', form: 'disc', lock: 'current', drag: 0.2, trails: 0.7, focus: 0.5, orbit: 0.45 },
  },
  {
    key: 'glass-bells', name: 'Glass Bells', blurb: 'Every touch rings. The light rests where the waves cancel.',
    scene: { palette: 'glacier', colorBy: 'heat', form: 'lattice', lock: 'chime', depth: 0.15, trails: 0.3, glow: 0.55, sparkle: 0.6, size: 0.9 },
  },
  {
    key: 'orchid-bloom', name: 'Orchid Bloom', blurb: 'Six-fold petals unfold from a single finger.',
    scene: { palette: 'orchid', colorBy: 'seed', form: 'shell', symmetry: 6, mirror: true, lock: 'halo', trails: 0.65, depth: 0.35, orbit: 0.15 },
  },
  {
    key: 'solar-wind', name: 'Solar Wind', blurb: 'Hold to gather a star. Let go to set it off.',
    scene: { palette: 'solar', colorBy: 'heat', form: 'nebula', lock: 'nova', glow: 0.85, trails: 0.45, exposure: 0.2, focus: 0.45 },
  },
  {
    key: 'starling-hour', name: 'Starling Hour', blurb: 'Dusk flocks that wheel around your hands.',
    scene: { palette: 'twilight', colorBy: 'direction', form: 'nebula', lock: 'murmur', drag: 0.15, trails: 0.4, depth: 0.85, orbit: 0.5, size: 1.2 },
  },
  {
    key: 'koi-pond', name: 'Koi Pond', blurb: 'Whirlpools that turn against each other.',
    scene: { palette: 'koi', colorBy: 'seed', form: 'disc', lock: 'whirl', depth: 0.2, trails: 0.7, glow: 0.5, flow: 0.45 },
  },
  {
    key: 'prism-rain', name: 'Prism Rain', blurb: 'Fountains of every colour fall under their own weight.',
    scene: { palette: 'prism', colorBy: 'seed', form: 'none', lock: 'fountain', gravity: 0.55, trails: 0.5, glow: 0.7, sparkle: 0.7, depth: 0.5 },
  },
  {
    key: 'night-garden', name: 'Night Garden', blurb: 'A soft field that bends around each finger like water round a stone.',
    scene: { palette: 'moss', colorBy: 'depth', form: 'lattice', lock: 'lattice', depth: 0.7, focus: 0.6, orbit: 0.6, trails: 0.25 },
  },
  {
    key: 'thunderhead', name: 'Thunderhead', blurb: 'Stir the air. Flick to throw a gust.',
    scene: { palette: 'silver', colorBy: 'speed', form: 'nebula', lock: 'storm', drag: 0.25, flow: 0.7, trails: 0.6, glow: 0.75, exposure: 0.15 },
  },
  {
    key: 'peacock-eye', name: 'Peacock Eye', blurb: 'Rings within rings, mirrored eight ways.',
    scene: { palette: 'peacock', colorBy: 'heat', form: 'ring', symmetry: 8, mirror: false, lock: 'burst', trails: 0.8, depth: 0.25, glow: 0.65 },
  },
  {
    key: 'infrared', name: 'Heat Map', blurb: 'Light that runs hotter the faster it moves.',
    scene: { palette: 'infrared', colorBy: 'speed', form: 'shell', trails: 0.6, glow: 0.7, depth: 0.65, focus: 0.4 },
  },
  {
    key: 'lantern-walk', name: 'Lantern Walk', blurb: 'Blue and gold, clear for every kind of colour vision.',
    scene: { palette: 'lantern', colorBy: 'heat', form: 'disc', trails: 0.5, glow: 0.6, depth: 0.5 },
  },
];

export const PRESET_KEYS = PRESETS.map((p) => p.key);
export const DEFAULT_PRESET = 'first-light';

export function presetByKey(key) {
  return PRESETS.find((p) => p.key === key) || null;
}

// The full scene for a preset, named after it.
export function presetScene(key) {
  const p = presetByKey(key) || presetByKey(DEFAULT_PRESET);
  return sanitizeScene({ ...p.scene, name: p.name });
}
