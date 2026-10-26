/* ============================================================
   Cinderdeep — pixel art toolkit and region tilesets
   ============================================================ */
const TS = 16; // tile size in world pixels

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
function hexRGB(hex) {
  if (Array.isArray(hex)) return hex;
  let s = hex.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
function shade(hex, f) {
  const [r, g, b] = hexRGB(hex);
  return f >= 0 ? toHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f) : toHex(r * (1 + f), g * (1 + f), b * (1 + f));
}
function mixHex(a, b, t) { const A = hexRGB(a), B = hexRGB(b); return toHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); }
const rgbaStr = (hex, a = 1) => { const [r, g, b] = hexRGB(hex); return `rgba(${r},${g},${b},${a})`; };
const OUTLINE = '#120a0e';

/* PixelPainter: draws into a packed RGBA buffer, then becomes a canvas. */
class PP {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); }
  static pack(hex, a = 255) { const [r, g, b] = hexRGB(hex); return ((a & 255) << 24) | (b << 16) | (g << 8) | r; }
  px(x, y, hex, a = 255) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !hex) return;
    this.d[y * this.w + x] = hex === '#00000000' ? 0 : PP.pack(hex, a);
  }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[y * this.w + x]; }
  on(x, y) { return (this.get(x, y) >>> 24) > 0; }
  rect(x, y, w, h, hex, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, hex, a); }
  disc(cx, cy, r, hex, a) {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++)
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r + r * 0.4) this.px(x, y, hex, a);
  }
  ell(cx, cy, rx, ry, hex, a) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const dx = (x - cx) / Math.max(0.5, rx), dy = (y - cy) / Math.max(0.5, ry);
      if (dx * dx + dy * dy <= 1.05) this.px(x, y, hex, a);
    }
  }
  // sphere-ish shading: lighter toward the top-left, darker bottom-right
  ball(cx, cy, rx, ry, hex, hl = 0.35, sh = -0.35) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const dx = (x - cx) / Math.max(0.5, rx), dy = (y - cy) / Math.max(0.5, ry), q = dx * dx + dy * dy;
      if (q > 1.05) continue;
      const lit = -dx * 0.55 - dy * 0.75;
      let c = hex;
      if (lit > 0.55) c = shade(hex, hl); else if (lit > 0.15) c = shade(hex, hl * 0.4); else if (lit < -0.5) c = shade(hex, sh); else if (lit < -0.15) c = shade(hex, sh * 0.5);
      this.px(x, y, c);
    }
  }
  line(x0, y0, x1, y1, hex, a) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 400; n++) {
      this.px(x0, y0, hex, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  poly(pts, hex, a) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const px = x + 0.5, py = y + 0.5; let ins = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ins = !ins;
      }
      if (ins) this.px(x, y, hex, a);
    }
  }
  // recolor every opaque pixel matching fn
  map(fn) { for (let i = 0; i < this.d.length; i++) if (this.d[i] >>> 24) { const r = fn(this.d[i], i % this.w, (i / this.w) | 0); if (r != null) this.d[i] = r; } }
  outline(hex = OUTLINE, diag = false) {
    const o = PP.pack(hex), add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.on(x, y)) continue;
      if (this.on(x - 1, y) || this.on(x + 1, y) || this.on(x, y - 1) || this.on(x, y + 1) || (diag && (this.on(x - 1, y - 1) || this.on(x + 1, y - 1) || this.on(x - 1, y + 1) || this.on(x + 1, y + 1)))) add.push(y * this.w + x);
    }
    for (const i of add) this.d[i] = o;
    return this;
  }
  canvas() {
    const c = mkCanvas(this.w, this.h), g = c.getContext('2d');
    const img = g.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.d);
    g.putImageData(img, 0, 0);
    return c;
  }
  sprite(ax, ay) { return makeSprite(this.canvas(), ax ?? this.w / 2, ay ?? this.h - 1); }
}

function makeSprite(c, ax, ay) { return { c, w: c.width, h: c.height, ax, ay, _white: null, _flip: null }; }
function whiteOf(sp) {
  if (sp._white) return sp._white;
  const c = mkCanvas(sp.w, sp.h), g = c.getContext('2d');
  g.drawImage(sp.c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, sp.w, sp.h);
  return (sp._white = c);
}
function tintOf(sp, color, key) {
  sp._tints = sp._tints || {};
  if (sp._tints[key]) return sp._tints[key];
  const c = mkCanvas(sp.w, sp.h), g = c.getContext('2d');
  g.drawImage(sp.c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, sp.w, sp.h);
  return (sp._tints[key] = c);
}
function silhouette(sp, color = '#000') { return tintOf(sp, color, 'sil' + color); }

/* value noise for textures */
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hashU(xi, yi, seed), b = hashU(xi + 1, yi, seed), c = hashU(xi, yi + 1, seed), d = hashU(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, s(xf)), lerp(c, d, s(xf)), s(yf));
}

/* ---------- light textures (soft radial blobs, drawn scaled) ---------- */
const LightTex = {
  cache: {},
  get(color = '#ffffff', soft = 0.5) {
    const key = color + soft;
    if (this.cache[key]) return this.cache[key];
    const c = mkCanvas(64, 64), g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    const [r, gg, b] = hexRGB(color);
    gr.addColorStop(0, `rgba(${r},${gg},${b},1)`);
    gr.addColorStop(soft, `rgba(${r},${gg},${b},0.55)`);
    gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (this.cache[key] = c);
  },
};

/* ---------- region tilesets ----------
   Each region gets 16x16 tiles painted from its palette: floors, wall faces, wall tops,
   pits, hazards and a handful of floor decals. */
const TILE = { VOID: 0, FLOOR: 1, WALL: 2, FACE: 3, DOOR: 4, PIT: 5, LAVA: 6, ICE: 7, TOXIC: 8, ROCK: 9, SPIKE: 10 };
const SOLID_TILE = new Uint8Array(16); SOLID_TILE[TILE.VOID] = 1; SOLID_TILE[TILE.WALL] = 1; SOLID_TILE[TILE.FACE] = 1; SOLID_TILE[TILE.ROCK] = 1;

function paintFloor(act, pal, v, seed) {
  const p = new PP(TS, TS);
  const base = v % 2 ? pal.floor2 : pal.floor;
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const n = vnoise(x / 4 + v * 7, y / 4, seed) * 0.6 + vnoise(x / 1.5, y / 1.5 + v * 3, seed + 9) * 0.4;
    let c = base;
    if (n > 0.68) c = shade(base, 0.08); else if (n < 0.3) c = shade(base, -0.1);
    p.px(x, y, c);
  }
  if (act === 'ossuary' || act === 'frost') {
    // flagstones: grout lines with a lit upper edge
    const off = v % 2 ? 4 : 0;
    for (let x = 0; x < TS; x++) { p.px(x, 0, pal.grout); p.px(x, 8, pal.grout); p.px(x, 1, shade(base, 0.12)); p.px(x, 9, shade(base, 0.12)); }
    for (let y = 0; y < 8; y++) { p.px((off) % TS, y, pal.grout); p.px((off + 1) % TS, y, shade(base, 0.08)); }
    for (let y = 8; y < 16; y++) { p.px((off + 8) % TS, y, pal.grout); p.px((off + 9) % TS, y, shade(base, 0.08)); }
    if (act === 'frost' && v === 3) for (let i = 0; i < 4; i++) p.px(3 + i * 3, 4 + (i % 2) * 6, '#ffffff');
  } else if (act === 'grotto') {
    // soft earth with mossy blotches
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) if (vnoise(x / 6 + v * 11, y / 6, seed + 4) > 0.8) p.px(x, y, mixHex(base, pal.moss, 0.22));
    if (v === 2) { p.px(4, 5, pal.accent); p.px(11, 10, pal.moss); }
  } else if (act === 'core') {
    // basalt plates with ember seams
    for (let x = 0; x < TS; x++) { p.px(x, 0, pal.grout); }
    for (let y = 0; y < TS; y++) p.px(0, y, pal.grout);
    if (v === 3) { let x = 4, y = 3; for (let i = 0; i < 9; i++) { p.px(x, y, i % 3 ? '#8a2e18' : '#e8642a'); x += hashU(i, v, seed) > 0.5 ? 1 : 0; y += 1; if (y >= TS) break; } }
  }
  return p.canvas();
}
function paintFace(act, pal, v, seed) {
  const p = new PP(TS, TS);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const n = vnoise(x / 3 + v * 5, y / 3, seed + 20);
    let c = pal.wall;
    if (n > 0.66) c = shade(c, 0.07); else if (n < 0.32) c = shade(c, -0.08);
    // vertical light falloff: brighter near the top, darker toward the floor
    const fall = y / TS;
    if (fall > 0.75) c = shade(c, -0.22); else if (fall > 0.55) c = shade(c, -0.1);
    p.px(x, y, c);
  }
  if (act === 'grotto') {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) if (vnoise(x / 2.5, y / 2.5 + v, seed + 33) > 0.72) p.px(x, y, shade(pal.wall, -0.18));
    if (v === 1) { for (let y = 3; y < 13; y++) p.px(4 + (y % 3 === 0 ? 1 : 0), y, pal.moss); }
  } else {
    // brick courses
    const rows = [0, 5, 10];
    rows.forEach((ry, i) => {
      for (let x = 0; x < TS; x++) p.px(x, ry, shade(pal.wall, -0.32));
      for (let x = 0; x < TS; x++) p.px(x, ry + 1, shade(pal.wall, 0.1));
      const off = (i + v) % 2 ? 4 : 11;
      for (let y = ry; y < Math.min(TS, ry + 5); y++) p.px(off, y, shade(pal.wall, -0.32));
    });
    if (act === 'frost') for (let x = 0; x < TS; x++) if (hashU(x, v, seed) > 0.55) p.px(x, 15, '#e8f6ff');
    if (act === 'core' && v === 2) for (let y = 6; y < 16; y++) p.px(9 + (y % 4 === 0 ? 1 : 0), y, y % 2 ? '#ff7a2a' : '#c4401c');
    if (act === 'ossuary' && v === 3) { p.ell(8, 8, 3, 2.5, '#d8cfb8'); p.px(7, 8, '#2a2730'); p.px(9, 8, '#2a2730'); p.px(8, 10, '#2a2730'); }
  }
  for (let x = 0; x < TS; x++) p.px(x, TS - 1, shade(pal.wall, -0.45));
  return p.canvas();
}
function paintTop(act, pal, seed) {
  const p = new PP(TS, TS);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const n = vnoise(x / 3, y / 3, seed + 50);
    p.px(x, y, n > 0.6 ? shade(pal.wallTop, 0.08) : n < 0.35 ? shade(pal.wallTop, -0.15) : pal.wallTop);
  }
  return p.canvas();
}
function paintHazard(kind, pal, frame, seed) {
  const p = new PP(TS, TS);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    if (kind === 'lava') {
      const n = vnoise(x / 4 + frame * 1.3, y / 4 + frame * 0.7, seed + 70) * 0.7 + vnoise(x / 2, y / 2 - frame, seed + 71) * 0.3;
      p.px(x, y, n > 0.68 ? '#ffe08a' : n > 0.52 ? '#ff9a2e' : n > 0.36 ? '#e8521c' : '#a82a14');
    } else if (kind === 'toxic') {
      const n = vnoise(x / 4 + frame * 0.6, y / 4, seed + 80);
      p.px(x, y, n > 0.7 ? '#b8ff7a' : n > 0.45 ? '#6fd33a' : '#3f9a2a');
      if (hashU(x, y, frame + seed) > 0.985) p.px(x, y, '#e8ffd0');
    } else if (kind === 'ice') {
      const n = vnoise(x / 6, y / 6, seed + 90);
      p.px(x, y, n > 0.62 ? '#e9f8ff' : n > 0.4 ? '#c4e8fa' : '#a8d6f0');
      if ((x + y) % 11 === 0 && y < 12) p.px(x, y, '#ffffff');
    } else if (kind === 'pit') {
      const t = y / TS;
      p.px(x, y, t < 0.3 ? '#151015' : '#050305');
    }
  }
  return p.canvas();
}
// a small library of floor decals per region
function paintDecals(act, pal, seed) {
  const out = [];
  const mk = (fn) => { const p = new PP(TS, TS); fn(p); out.push(p.canvas()); };
  if (act === 'ossuary') {
    mk((p) => { p.line(3, 9, 12, 7, '#d8cfb8'); p.disc(3, 9, 1, '#e8e0cc'); p.disc(12, 7, 1, '#e8e0cc'); });
    mk((p) => { p.ell(8, 9, 3.5, 3, '#d8cfb8'); p.rect(6, 11, 5, 2, '#c8bfa8'); p.px(7, 9, '#2a2730'); p.px(9, 9, '#2a2730'); p.px(8, 10, '#2a2730'); });
    mk((p) => { p.line(2, 4, 7, 9, pal.grout); p.line(7, 9, 6, 14, pal.grout); p.line(7, 9, 12, 11, pal.grout); });
    mk((p) => { for (let i = 0; i < 9; i++) p.px(3 + ((i * 5) % 10), 4 + ((i * 3) % 8), pal.moss); });
  } else if (act === 'grotto') {
    mk((p) => { p.ell(8, 10, 5, 2, '#2a3f38'); p.px(5, 9, '#9cf0d8'); p.px(10, 11, '#9cf0d8'); });
    mk((p) => { for (let i = 0; i < 3; i++) { const x = 4 + i * 4; p.rect(x, 9, 1, 3, '#d8c8b0'); p.ell(x, 8, 1.6, 1, i === 1 ? '#c58cff' : '#9cf0d8'); } });
    mk((p) => { p.line(2, 12, 6, 8, '#5a4030'); p.line(6, 8, 13, 9, '#5a4030'); p.line(6, 8, 7, 3, '#5a4030'); });
    mk((p) => { for (let i = 0; i < 10; i++) p.px(2 + ((i * 7) % 12), 3 + ((i * 5) % 11), pal.moss); });
  } else if (act === 'frost') {
    mk((p) => { p.ell(8, 9, 5, 3, '#eef9ff'); p.ell(7, 8, 3, 1.5, '#ffffff'); });
    mk((p) => { p.line(3, 3, 12, 12, '#cfe9f7'); p.line(12, 3, 3, 12, '#cfe9f7'); p.px(8, 8, '#ffffff'); });
    mk((p) => { p.line(2, 6, 9, 10, pal.grout); p.line(9, 10, 14, 8, pal.grout); });
    mk((p) => { for (let i = 0; i < 6; i++) p.px(3 + ((i * 5) % 10), 3 + ((i * 7) % 10), '#ffffff'); });
  } else {
    mk((p) => { p.line(2, 8, 7, 6, '#ff7a2a'); p.line(7, 6, 13, 9, '#c4401c'); p.px(7, 6, '#ffd08a'); });
    mk((p) => { p.ell(8, 9, 4, 2.5, '#1a0e0c'); p.px(7, 9, '#ff7a2a'); });
    mk((p) => { p.ell(8, 10, 3.5, 3, '#2a1a16'); p.ell(8, 9, 2, 1.5, '#4a2a20'); });
    mk((p) => { for (let i = 0; i < 6; i++) p.px(3 + ((i * 5) % 10), 3 + ((i * 7) % 10), '#ff9a3c'); });
  }
  return out;
}

const Tilesets = {};
function getTileset(actIdx) {
  const A = ACTS[actIdx % ACTS.length];
  if (Tilesets[A.id]) return Tilesets[A.id];
  const seed = hashStr(A.id), pal = A.pal;
  const T = {
    floor: [0, 1, 2, 3].map((v) => paintFloor(A.id, pal, v, seed)),
    face: [0, 1, 2, 3].map((v) => paintFace(A.id, pal, v, seed)),
    top: paintTop(A.id, pal, seed),
    lava: [0, 1, 2, 3].map((f) => paintHazard('lava', pal, f, seed)),
    toxic: [0, 1, 2, 3].map((f) => paintHazard('toxic', pal, f, seed)),
    ice: paintHazard('ice', pal, 0, seed),
    pit: paintHazard('pit', pal, 0, seed),
    decals: paintDecals(A.id, pal, seed),
    pal,
  };
  return (Tilesets[A.id] = T);
}

