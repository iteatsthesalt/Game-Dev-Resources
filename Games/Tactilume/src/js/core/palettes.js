// Colour palettes. Each is a gradient of sRGB stops from t = 0 to t = 1; the
// renderer bakes every palette into one row of a lookup texture and picks a
// position along the row from the particle's speed, heat, seed, direction or depth.
//
// Keys are saved in scenes and share links: never rename one. New palettes go at the end.
// `safe` marks palettes that stay distinguishable for the common kinds of colour-vision deficiency.

export const PALETTES = [
  { key: 'ember', name: 'Ember', stops: ['#140202', '#5c0a04', '#d23a05', '#ff8a1e', '#ffd27a', '#fff6e0'] },
  { key: 'aurora', name: 'Aurora', stops: ['#020b14', '#05405a', '#09a38a', '#6cf0a0', '#d8ff9a', '#f4fff0'] },
  { key: 'abyss', name: 'Abyss', stops: ['#01030d', '#071a5e', '#1155d6', '#2fb5ff', '#a8f0ff', '#f0fcff'] },
  { key: 'orchid', name: 'Orchid', stops: ['#0c0214', '#3d0a5c', '#9b1fc0', '#ff4fd8', '#ffb0e8', '#fff0fb'] },
  { key: 'solar', name: 'Solar', stops: ['#100600', '#6a2300', '#e86a00', '#ffc21a', '#fff38a', '#fffde8'] },
  { key: 'glacier', name: 'Glacier', stops: ['#020608', '#0f3442', '#3d8fa8', '#9fe0f0', '#e4fbff', '#ffffff'] },
  { key: 'koi', name: 'Koi', stops: ['#050208', '#2b0d40', '#e0402a', '#ff9a3c', '#f4f0e0', '#7fd6ff'] },
  { key: 'prism', name: 'Prism', stops: ['#ff2a4a', '#ff9a1a', '#f4ff2a', '#2aff7a', '#2ad4ff', '#6a3aff', '#ff2ad8', '#ff2a4a'] },
  { key: 'moss', name: 'Moss', safe: true, stops: ['#0a0418', '#30235c', '#255f86', '#1f9a8a', '#5fca5a', '#e8f028'] },
  { key: 'lantern', name: 'Lantern', safe: true, stops: ['#00102e', '#1b2f6b', '#56588a', '#8f8576', '#d0b45a', '#fff0a0'] },
  { key: 'silver', name: 'Silver', safe: true, stops: ['#020203', '#1a1c22', '#565c6a', '#a6adbc', '#e2e6ee', '#ffffff'] },
  { key: 'infrared', name: 'Infrared', stops: ['#000000', '#2a0030', '#8a0050', '#ff2a2a', '#ffb000', '#ffffd8'] },
  { key: 'peacock', name: 'Peacock', stops: ['#020a08', '#06363a', '#0a7f7a', '#2a5fd8', '#a03ae0', '#f0d8ff'] },
  { key: 'twilight', name: 'Twilight', stops: ['#05030f', '#241448', '#6a2a7a', '#d0506a', '#ffa070', '#ffe8c8'] },
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
