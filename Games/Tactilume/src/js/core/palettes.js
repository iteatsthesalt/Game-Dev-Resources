// Colour palettes. Each is a gradient of sRGB stops from t = 0 to t = 1; the
// renderer bakes every palette into one row of a lookup texture and picks a
// position along the row from the particle's speed, heat, seed, direction or depth.
//
// Palettes carry colour, not brightness: no stop is near black, because how bright a
// speck is comes from its energy and heat. Low t is the deep, saturated end; high t
// runs toward white-hot.
//
// Keys are saved in scenes and share links: never rename one. New palettes go at the end.
// `safe` marks palettes that stay distinguishable for the common kinds of colour-vision deficiency.

export const PALETTES = [
  { key: 'ember', name: 'Ember', stops: ['#8a1405', '#d2380a', '#ff7a1a', '#ffb347', '#ffe0a0', '#fff8ec'] },
  { key: 'aurora', name: 'Aurora', stops: ['#0b4f6c', '#0a8f88', '#20d39a', '#8cf58c', '#e4ffa8', '#f6fff2'] },
  { key: 'abyss', name: 'Abyss', stops: ['#1a2a9e', '#1f5ee0', '#2aa4ff', '#5fdcff', '#bff4ff', '#f2fdff'] },
  { key: 'orchid', name: 'Orchid', stops: ['#5a138c', '#a41fc4', '#e83ad8', '#ff7ad0', '#ffc2ea', '#fff2fb'] },
  { key: 'solar', name: 'Solar', stops: ['#a03200', '#e86400', '#ffa012', '#ffd23a', '#fff28a', '#fffdea'] },
  { key: 'glacier', name: 'Glacier', stops: ['#1d5670', '#3b8eb0', '#6fc4e0', '#a8e8f6', '#e2fbff', '#ffffff'] },
  { key: 'koi', name: 'Koi', stops: ['#c2281a', '#f05a2a', '#ff9a3c', '#ffd9a0', '#f4f2ea', '#8fd8ff'] },
  { key: 'prism', name: 'Prism', stops: ['#ff2a4a', '#ff9a1a', '#f4ff2a', '#2aff7a', '#2ad4ff', '#6a3aff', '#ff2ad8', '#ff2a4a'] },
  { key: 'moss', name: 'Moss', safe: true, stops: ['#46337e', '#355f8d', '#26828e', '#1fa187', '#6ece58', '#e8f028'] },
  { key: 'lantern', name: 'Lantern', safe: true, stops: ['#1f3f8f', '#4a5f9a', '#7c7b8c', '#b09c6a', '#dcbc4c', '#fff0a0'] },
  { key: 'silver', name: 'Silver', safe: true, stops: ['#4a5160', '#6e7686', '#9aa2b4', '#c4cbd8', '#e6eaf2', '#ffffff'] },
  { key: 'infrared', name: 'Infrared', stops: ['#5a0a7a', '#a0105a', '#ff2a2a', '#ff7a00', '#ffc400', '#ffffd8'] },
  { key: 'peacock', name: 'Peacock', stops: ['#0a6a62', '#0e9a8c', '#2a72e0', '#6a4ae8', '#b45ae8', '#f0dcff'] },
  { key: 'twilight', name: 'Twilight', stops: ['#3c2478', '#7a2f8a', '#c84a78', '#ff7a6a', '#ffb488', '#ffeedc'] },
];

export const PALETTE_KEYS = PALETTES.map((p) => p.key);

export const paletteIndex = (key) => Math.max(0, PALETTE_KEYS.indexOf(key));

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Samples a palette at t in 0..1 (sRGB bytes, interpolated in sRGB space like the
// texture filter does). Used by the baker and by the UI's swatches.
export function samplePalette(palette, t) {
  const stops = palette.stops.map(hexToRgb);
  const x = Math.min(Math.max(t, 0), 1) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const f = x - i;
  return stops[i].map((c, k) => Math.round(c + (stops[i + 1][k] - c) * f));
}

// All palettes in one RGBA8 image: row r is PALETTES[r], `width` texels long.
export function bakeLUT(width = 256) {
  const height = PALETTES.length;
  const data = new Uint8Array(width * height * 4);
  PALETTES.forEach((p, row) => {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = samplePalette(p, x / (width - 1));
      const o = (row * width + x) * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
  });
  return { data, width, height };
}

// A CSS gradient for a palette, for swatches in the UI.
export const paletteCSS = (p) => `linear-gradient(90deg, ${p.stops.join(', ')})`;
