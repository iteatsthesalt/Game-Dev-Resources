/* ============================================================
   Cinderdeep — evolved bodies. Heroes are repainted at every
   stage, bigger and with more parts: pauldrons, capes, crowns,
   wings, emblems, glowing seams. Beasts and drawn sheets are
   resampled larger and adorned the same way.
   ============================================================ */
const ev2 = (v) => 2 * Math.round(v / 2);
function ascGeo(s) {
  const shW = ev2(8 + s * 1.2);
  return {
    s, top: 4 + Math.round(s * 0.9), headH: Math.round(6 + s * 0.42), headW: ev2(6 + s * 0.45), neck: s >= 5 ? 1 : 0,
    torsoH: Math.round(6 + s * 0.95), legH: Math.round(5 + s * 1.2), bootH: Math.round(2 + s * 0.3), shW, waistW: Math.max(6, ev2(shW * 0.72)),
    legW: Math.max(2, Math.round(2 + s * 0.33)), legGap: s >= 4 ? 2 : 0, armW: Math.max(1, Math.round(1 + s * 0.3)), armL: Math.round(4 + s * 0.9),
    paul: s >= 2 ? Math.round(2 + s * 0.42) : 0, flare: Math.round(1 + s * 0.4),
  };
}
const HAS_WINGS = { flame: 5, crystal: 5, bolt: 5, insect: 5, rune: 5, bat: 5, smoke: 5, tentacle: 5, angel: 5, feather: 5, demon: 6, aegis: 6 };
const wingSpanOf = (A, s) => (HAS_WINGS[A.wing] && s >= HAS_WINGS[A.wing] ? Math.round(6 + (s - 4) * 2.6) : 0);
const CLASS_KIT = { knight: 'plate', paladin: 'plate', samurai: 'lacquer', berserker: 'fur', ranger: 'leather', rogue: 'leather', gunslinger: 'leather', monk: 'gi', pyro: 'robe', witch: 'robe', necro: 'robe', storm: 'robe', bard: 'tunic' };
const EMBLEM = {
  flame: ['00100', '01110', '01110', '11111', '01110'], snow: ['10101', '01110', '11011', '01110', '10101'], bolt: ['00110', '01100', '11111', '00110', '01100'],
  drop: ['00100', '01110', '11111', '11111', '01110'], rune: ['00100', '01010', '10101', '01010', '00100'], shield: ['11111', '11111', '11111', '01110', '00100'],
  axe: ['10001', '11011', '01110', '01110', '10101'], feather: ['00011', '00111', '01110', '11100', '10000'], heart: ['01010', '11111', '11111', '01110', '00100'],
  moon: ['01110', '11100', '11000', '11100', '01110'], sun: ['10101', '01110', '11111', '01110', '10101'], eye: ['01110', '11011', '10101', '11011', '01110'],
};
const EMBLEM3 = { flame: ['010', '111', '111'], snow: ['101', '010', '101'], bolt: ['011', '111', '110'], drop: ['010', '111', '111'], rune: ['010', '101', '010'], shield: ['111', '111', '010'], axe: ['101', '010', '101'], feather: ['001', '010', '100'], heart: ['101', '111', '010'], moon: ['011', '100', '011'], sun: ['010', '111', '010'], eye: ['111', '101', '111'] };

/* a painter with the helpers every body part needs */
function bodyPainter(W, H) {
  const P = new PP(W, H);
  const R = (x, y, w, h, c, a) => P.rect(Math.round(x), Math.round(y), Math.round(w), Math.round(h), c, a);
  // a rounded cylinder: lit on the left, shadowed on the right
  const cyl = (x, y, w, h, c, o = {}) => {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    for (let i = 0; i < w; i++) {
      const u = (i + 0.5) / w;
      const f = w <= 2 ? (i === 0 ? 0.12 : -0.15) : u < 0.17 ? 0.22 : u < 0.36 ? 0.08 : u < 0.7 ? 0 : u < 0.86 ? -0.14 : -0.28;
      P.rect(x + i, y, 1, h, f ? shade(c, f) : c, o.a);
    }
    if (o.top && h > 2) P.rect(x + 1, y, Math.max(1, w - 2), 1, shade(c, 0.28), o.a);
    if (o.bottom !== false && h > 3) P.rect(x, y + h - 1, w, 1, shade(c, -0.3), o.a);
  };
  const bits = (rows, x, y, c, c2) => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '1') P.px(x + i, y + j, c2 && j < rows.length / 2 ? c2 : c); });
  return { P, R, cyl, bits };
}

/* ---------- wings ---------- */
function paintWing(P, A, style, rx, ry, dir, span, hh, frame, s) {
  const flap = frame === 1 ? 1.25 : frame === 2 ? 0.7 : 1;
  const pt = (u, v) => [rx + dir * u * span, ry + v * hh * (v < 0 ? flap : 1)];
  const poly = (pts, c, a) => P.poly(pts.map(([u, v]) => pt(u, v)), c, a);
  const line = (u0, v0, u1, v1, c, a) => { const [x0, y0] = pt(u0, v0), [x1, y1] = pt(u1, v1); P.line(x0, y0, x1, y1, c, a); };
  switch (style) {
    case 'angel': case 'feather': {
      const base = style === 'angel' ? '#ffffff' : A.c2, mid = style === 'angel' ? '#efe6cc' : A.c1, deep = style === 'angel' ? '#c8b88a' : A.c3, edge = style === 'angel' ? A.c3 : shade(A.c1, -0.3);
      poly([[0, -0.1], [0.25, -0.62], [0.6, -0.86], [0.92, -0.72], [1, -0.45], [0.96, -0.1], [0.82, 0.12], [0.62, 0.32], [0.42, 0.42], [0.2, 0.36], [0.02, 0.18]], base);
      // feather rows
      for (let k = 0; k < 3; k++) { const v = -0.35 + k * 0.28; poly([[0.08, v], [0.5 + k * 0.08, v - 0.3], [0.95 - k * 0.05, v - 0.08 + k * 0.12], [0.6, v + 0.22], [0.1, v + 0.16]], k === 0 ? base : k === 1 ? mid : deep); }
      const n = 4 + Math.floor(s / 2);
      for (let k = 0; k < n; k++) { const u = 0.25 + (k / n) * 0.72, v = 0.42 - (k / n) * 0.5; line(u - 0.06, v - 0.22, u, v, edge); }
      line(0.02, -0.08, 0.6, -0.86, shade(base, 0.1)); line(0.6, -0.86, 0.92, -0.72, '#ffffff');
      break;
    }
    case 'flame': {
      poly([[0, -0.05], [0.3, -0.6], [0.55, -0.95], [0.62, -0.55], [0.85, -0.85], [0.9, -0.4], [1.02, -0.5], [0.92, 0.0], [0.7, 0.25], [0.4, 0.35], [0.1, 0.2]], A.c3);
      poly([[0.02, -0.02], [0.3, -0.48], [0.5, -0.72], [0.58, -0.4], [0.78, -0.6], [0.84, -0.25], [0.7, 0.12], [0.4, 0.24], [0.12, 0.14]], A.c1);
      poly([[0.05, 0], [0.28, -0.3], [0.45, -0.42], [0.5, -0.2], [0.62, -0.28], [0.6, 0.02], [0.35, 0.12], [0.12, 0.08]], A.c2);
      line(0.05, -0.02, 0.4, -0.2, '#fff3c0');
      break;
    }
    case 'crystal': {
      const shards = 3 + (s >= 8 ? 2 : s >= 6 ? 1 : 0);
      for (let k = 0; k < shards; k++) {
        const a = -0.95 + (k / Math.max(1, shards - 1)) * 1.15, L = 1 - Math.abs(k - (shards - 1) / 2) * 0.12;
        const tu = Math.cos(a) * L, tv = Math.sin(a) * L * 1.1;
        const nu = -Math.sin(a) * 0.09, nv = Math.cos(a) * 0.12;
        poly([[0.04 + nu, nv], [tu, tv], [0.04 - nu, -nv]], k % 2 ? A.c1 : shade(A.c1, -0.12), 235);
        line(0.06, 0, tu * 0.92, tv * 0.92, A.c2);
      }
      break;
    }
    case 'bolt': {
      poly([[0, -0.1], [0.35, -0.7], [0.3, -0.35], [0.7, -0.95], [0.6, -0.45], [1, -0.7], [0.75, -0.05], [0.85, 0.2], [0.45, 0.05], [0.4, 0.35], [0.1, 0.12]], A.c3);
      poly([[0.02, -0.08], [0.33, -0.56], [0.3, -0.28], [0.66, -0.78], [0.56, -0.36], [0.88, -0.56], [0.68, -0.04], [0.42, -0.02], [0.36, 0.2], [0.12, 0.06]], A.c1);
      line(0.05, -0.05, 0.33, -0.5, '#ffffff'); line(0.33, -0.3, 0.64, -0.72, '#ffffff'); line(0.56, -0.34, 0.84, -0.52, A.c2);
      break;
    }
    case 'insect': {
      P.ell(rx + dir * span * 0.5, ry - hh * 0.38 * flap, span * 0.52, hh * 0.32, A.c2, 140);
      P.ell(rx + dir * span * 0.38, ry + hh * 0.16, span * 0.38, hh * 0.22, A.c1, 130);
      line(0, -0.05, 0.95, -0.42, shade(A.c3, 0.2), 220); line(0.3, -0.25, 0.7, -0.64, shade(A.c3, 0.2), 200); line(0, 0.05, 0.72, 0.2, shade(A.c3, 0.2), 200);
      P.px(rx + dir * span * 0.85, ry - hh * 0.5 * flap, '#ffffff', 200);
      break;
    }
    case 'rune': {
      const n = 3 + (s >= 8 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const u = 0.25 + k * (0.72 / n), v = -0.15 - Math.sin((k / n) * Math.PI) * 0.6 + k * 0.08, w2 = 0.12 + (k === 1 ? 0.04 : 0);
        poly([[u, v - 0.32], [u + w2, v], [u, v + 0.32], [u - w2, v]], k % 2 ? A.c1 : A.c3);
        const [x, y] = pt(u, v); P.px(x, y, A.c2); P.px(x, y - 1, '#ffffff');
      }
      break;
    }
    case 'bat': case 'demon': {
      const mem = style === 'demon' ? '#5a1418' : A.c3, bone = style === 'demon' ? '#2a0a0e' : A.c1;
      poly([[0, -0.15], [0.35, -0.8], [0.7, -0.95], [1, -0.7], [0.92, -0.2], [0.82, 0.05], [0.68, -0.08], [0.55, 0.22], [0.42, 0.02], [0.25, 0.28], [0.05, 0.12]], mem);
      line(0, -0.12, 0.35, -0.8, bone); line(0.35, -0.8, 0.7, -0.95, bone); line(0.7, -0.95, 1, -0.7, bone);
      line(0.35, -0.8, 0.42, 0.02, bone); line(0.7, -0.95, 0.68, -0.08, bone); line(1, -0.7, 0.82, 0.05, bone);
      if (style === 'demon') { const [x, y] = pt(0.35, -0.8); P.px(x, y - 1, '#e8d8b0'); P.px(x, y - 2, '#e8d8b0'); const [x2, y2] = pt(0.7, -0.95); P.px(x2, y2 - 1, '#e8d8b0'); }
      break;
    }
    case 'smoke': {
      poly([[0, -0.1], [0.4, -0.75], [0.8, -0.9], [1, -0.55], [0.9, -0.3], [1, -0.05], [0.75, 0.0], [0.82, 0.3], [0.55, 0.18], [0.5, 0.42], [0.3, 0.2], [0.1, 0.3]], '#1a1420', 230);
      poly([[0.05, -0.08], [0.4, -0.6], [0.72, -0.72], [0.8, -0.45], [0.6, -0.2], [0.4, 0.05], [0.15, 0.1]], A.c1, 220);
      for (let k = 0; k < 5; k++) { const [x, y] = pt(0.3 + k * 0.15, -0.5 + ((k * 37) % 7) * 0.12); P.px(x, y, A.glow, 160); }
      break;
    }
    case 'tentacle': {
      const n = 3 + (s >= 8 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        let x = rx, y = ry;
        const ph = k * 1.7 + frame * 0.6, len = span * (0.75 + k * 0.1);
        for (let i = 0; i < len; i++) {
          const u = i / len, nx = rx + dir * i, ny = ry - (k - 1) * hh * 0.3 * u - Math.sin(u * 4 + ph) * hh * 0.18 - u * hh * 0.25;
          const th = Math.max(1, Math.round((1 - u) * (1 + s * 0.15)));
          for (let t = 0; t < th; t++) P.px(nx, ny + t, i % 3 === 0 ? A.c2 : A.c1);
          x = nx; y = ny;
        }
        P.px(x, y, '#ffffff'); P.px(x + dir, y, '#1a0a1a');
      }
      break;
    }
    case 'aegis': {
      const n = 4 + (s >= 9 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const v0 = -0.7 + k * 0.32, L = 1 - k * 0.12;
        poly([[0.02, v0 + 0.25], [L * 0.95, v0 - 0.12], [L, v0 + 0.02], [0.05, v0 + 0.42]], k % 2 ? '#c8d0dc' : '#e8edf4');
        line(0.05, v0 + 0.25, L * 0.95, v0 - 0.12, A.c2);
      }
      break;
    }
  }
}

/* ---------- crowns, halos, horns ---------- */
function paintCrown(P, A, style, cx, topY, hx, hy, hw, s, frame) {
  const k = 1 + (s - 4) * 0.18;
  switch (style) {
    case 'flame': {
      const n = 3 + (s >= 7 ? 2 : 0);
      for (let i = 0; i < n; i++) {
        const x = Math.round(cx - (n - 1) * 1.2 + i * 2.4), hgt = Math.round((i === (n - 1) / 2 ? 4 : 2.5 + (i % 2)) * k) + (frame === 1 && i % 2 ? 1 : 0);
        for (let j = 0; j < hgt; j++) { P.px(x, topY - j, j < hgt * 0.4 ? A.c2 : j < hgt * 0.75 ? A.c1 : A.c3); if (j < hgt * 0.5) P.px(x + 1, topY - j, A.c1); }
      }
      break;
    }
    case 'ice': {
      const n = 3 + (s >= 7 ? 2 : 0);
      P.rect(Math.round(cx - n * 1.3), topY, Math.round(n * 2.6), 1, A.c1);
      for (let i = 0; i < n; i++) { const x = Math.round(cx - (n - 1) * 1.3 + i * 2.6), hgt = Math.round((i === (n - 1) / 2 ? 4.5 : 2.5) * k); for (let j = 1; j <= hgt; j++) P.px(x, topY - j, j === hgt ? '#ffffff' : A.c1); if (hgt > 2) P.px(x + 1, topY - 1, A.c2); }
      break;
    }
    case 'bolt': {
      const n = 3;
      for (let i = 0; i < n; i++) { const x0 = Math.round(cx - 3 * k + i * 3 * k), hgt = Math.round((i === 1 ? 5 : 3) * k); let x = x0; for (let j = 0; j < hgt; j++) { P.px(x, topY - j, j % 3 === 2 ? '#ffffff' : A.c1); if (j % 2) x += i === 0 ? -1 : 1; } }
      P.rect(Math.round(cx - 3 * k), topY, Math.round(6 * k) + 1, 1, A.c3);
      break;
    }
    case 'thorn': case 'thorncrown': {
      const c = style === 'thorn' ? A.c3 : '#3a0a12', tip = style === 'thorn' ? A.c1 : A.c1;
      const w = Math.round(hw * 0.9 + 2);
      P.rect(Math.round(cx - w / 2), topY, w, 1, c);
      for (let i = 0; i < w; i += 2) { const hgt = 1 + ((i * 7) % 3 === 0 ? Math.round(1.6 * k) : 1); for (let j = 1; j <= hgt; j++) P.px(Math.round(cx - w / 2) + i, topY - j, j === hgt ? tip : c); }
      if (style === 'thorn') { P.px(Math.round(cx - w / 2) + 1, topY - 1, '#c873ff'); P.px(Math.round(cx + w / 2) - 2, topY - 1, '#c873ff'); }
      break;
    }
    case 'rune': {
      const r = hw * 0.55 + 1 + s * 0.2, cy2 = topY - 2 - Math.round(s * 0.2);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + frame * 0.2; const x = cx + Math.cos(a) * r, y = cy2 + Math.sin(a) * r * 0.32; P.px(x, y, i % 2 ? A.c1 : A.c2); if (i % 2 === 0 && s >= 7) P.px(x, y - 1, '#ffffff'); }
      break;
    }
    case 'plume': {
      const hgt = Math.round(3 + s * 0.5);
      for (let j = 0; j < hgt; j++) { const x = Math.round(cx + (j > hgt * 0.5 ? (j - hgt * 0.5) * 0.6 : 0)); P.px(x, topY - j, j % 2 ? A.c2 : shade(A.c2, -0.15)); P.px(x - 1, topY - j, j < 2 ? A.c2 : shade(A.c2, 0.15)); }
      P.rect(Math.round(cx - hw / 2), topY + 1, hw, 1, A.c2);
      break;
    }
    case 'horns': {
      const len = Math.round(3 + s * 0.9);
      for (const d of [-1, 1]) {
        let x = d < 0 ? hx - 1 : hx + hw, y = hy + Math.round(hw * 0.25);
        for (let i = 0; i < len; i++) {
          const th = Math.max(1, Math.round((1 - i / len) * (1 + s * 0.12)));
          for (let t = 0; t < th; t++) P.px(x, y + t, i > len * 0.7 ? '#f4ead0' : i > len * 0.35 ? '#c8b89a' : '#3a2a26');
          x += d * (i < len * 0.5 ? 1 : 0.5); y -= i < len * 0.3 ? 0.6 : 1;
        }
      }
      break;
    }
    case 'feather': {
      const len = Math.round(4 + s * 0.8);
      for (let i = 0; i < len; i++) { const x = Math.round(cx + 1 + i * 0.7), y = Math.round(topY - i * 0.75); P.px(x, y, A.c1); P.px(x, y + 1, A.c2); if (i % 2) P.px(x - 1, y - 1, A.c2); }
      break;
    }
    case 'smokehorns': {
      for (const d of [-1, 1]) for (let i = 0; i < Math.round(3 + s * 0.6); i++) { const x = Math.round(cx + d * (hw * 0.35 + i * 0.5)), y = topY + 1 - i; P.px(x, y, i % 3 ? '#1a1420' : A.c1, 220); }
      break;
    }
    case 'halo': {
      const r = hw * 0.5 + 1.5 + s * 0.25, cy2 = topY - 3 - Math.round(s * 0.25);
      for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU; P.px(cx + Math.cos(a) * r, cy2 + Math.sin(a) * r * 0.3, a > Math.PI ? A.c1 : '#ffffff'); }
      break;
    }
    case 'eye': {
      const cy2 = topY - 3 - Math.round(s * 0.2), r = 1.5 + s * 0.2;
      P.ell(cx, cy2, r * 1.5, r, '#f4eef4'); P.disc(cx, cy2, Math.max(1, r * 0.6), A.c1); P.px(cx, cy2, '#1a0a1a');
      if (s >= 7) for (const d of [-1, 1]) for (let i = 0; i < 3; i++) P.px(cx + d * (r * 1.5 + i), cy2 + i, i % 2 ? A.c2 : A.c1);
      break;
    }
  }
}

/* ---------- pauldrons: a domed plate over layered lames ---------- */
function paintPauldron(P, A, style, x, y, r, dir, s, L) {
  const metal = L && (L.kit === 'plate' || L.kit === 'lacquer');
  const base = style === 'plate' ? '#dde3ec' : style === 'wingplate' ? '#fff6dc' : metal ? mixHex('#c8d0dc', A.c1, 0.18) : mixHex(L ? L.main : A.c3, A.c3, 0.45);
  const dome = (cx, cy, rx, ry, col) => {
    for (let yy = Math.floor(cy - ry); yy <= cy; yy++) {
      const t = (yy - (cy - ry)) / Math.max(1, ry), hw2 = rx * Math.sqrt(Math.max(0, 1 - ((yy - cy) / ry) ** 2));
      for (let xx = Math.round(cx - hw2); xx <= Math.round(cx + hw2); xx++) {
        const u = (xx - (cx - hw2)) / Math.max(1, hw2 * 2);
        P.px(xx, yy, t < 0.3 && u < 0.6 ? shade(col, 0.32) : u < 0.25 ? shade(col, 0.14) : u > 0.8 ? shade(col, -0.25) : col);
      }
    }
  };
  switch (style) {
    case 'orb': {
      P.ball(x + dir * 1, y - r - 2, r * 0.7, r * 0.7, A.c1, 0.5, -0.3); P.px(x + dir, y - r - 2, '#ffffff');
      dome(x, y + 1, r * 0.85, r * 0.6, shade(A.c3, 0.25)); P.rect(Math.round(x - r * 0.8), Math.round(y + 1), Math.round(r * 1.6), 1, A.c1);
      return;
    }
    case 'smoke': { for (let i = 0; i < r * 2; i++) P.px(x + dir * (i * 0.5) + (i % 2 ? 1 : -1), y - 1 - (i % 3), i % 2 ? '#1a1420' : A.c1, 200); dome(x, y + 1, r * 0.85, r * 0.6, '#2c2438'); return; }
    case 'feather': { dome(x, y + 1, r * 0.85, r * 0.6, A.c1); for (let i = 0; i < 3; i++) P.line(x + dir * (r - 1), y + i, x + dir * (r + 2 + i), y - 1 + i * 2, i % 2 ? A.c2 : A.c1); return; }
    case 'eye': { dome(x, y + 1, r * 0.9, r * 0.75, A.c3); P.ell(x, y, r * 0.45, r * 0.32, '#f4eef4'); P.px(x, y, A.c1); return; }
  }
  const ry = Math.max(2, r * 0.72);
  dome(x, y + 1, r, ry, base);
  // lames under the dome
  const lames = s >= 6 ? 2 : 1;
  for (let i = 0; i < lames; i++) { const w = Math.round(r * 2 - 1 - i * 1.5); P.rect(Math.round(x - w / 2), Math.round(y + 2 + i), w, 1, shade(base, -0.18 - i * 0.1)); }
  P.rect(Math.round(x - r + 1), Math.round(y + 1 + lames + 1), Math.round(r * 2 - 2 - lames), 1, A.c2 === '#ffffff' ? A.c1 : (L && L.trim) || A.c1);
  if (s >= 5) P.px(Math.round(x), Math.round(y + 1 - ry * 0.45), A.c1);
  if (style === 'spike') for (let i = 0; i < 1 + Math.floor(s / 4); i++) { const sx = Math.round(x + dir * (i * 2 - 1)), sy = Math.round(y + 1 - ry); for (let j = 0; j < 2 + Math.floor(s / 3); j++) P.px(sx + dir * Math.floor(j / 2), sy - j, j > 1 ? '#f4ead0' : '#8a7a6a'); }
  if (style === 'flame') for (let i = 0; i < 3; i++) { const sx = Math.round(x - r * 0.6 + i * r * 0.6); for (let j = 0; j < 2 + (i % 2) + Math.floor(s / 4); j++) P.px(sx, Math.round(y + 1 - ry) - j, j > 1 ? A.c3 : j ? A.c1 : A.c2); }
  if (style === 'ice') for (let i = 0; i < 2 + Math.floor(s / 5); i++) { const sx = Math.round(x + dir * (r * 0.2 + i * 1.5)); for (let j = 0; j < 2 + i + Math.floor(s / 4); j++) P.px(sx, Math.round(y + 1 - ry) - j, j > 1 ? '#ffffff' : A.c1); }
  if (style === 'bolt') { P.line(x - dir * r * 0.3, y - ry * 0.4, x + dir * r * 0.9, y - ry - 2, A.c1); P.px(x + dir * r * 0.9, y - ry - 2, '#ffffff'); }
  if (style === 'thorn') for (let i = 0; i < 3; i++) { const sx = Math.round(x - r * 0.6 + i * r * 0.6); P.px(sx, Math.round(y + 1 - ry) - 1, i === 1 ? '#c873ff' : A.c1); if (s >= 6) P.px(sx, Math.round(y + 1 - ry) - 2, A.c3); }
  if (style === 'wingplate') for (let i = 0; i < 3; i++) P.line(x + dir * (r - 1), y - i, x + dir * (r + 2 + i), y - 2 - i * 2, i === 0 ? '#ffffff' : A.c1);
}

/* ---------- headgear at any size ---------- */
const HEAD2 = {
  helm(c) {
    const { P, R, hx, hy, hw, hh, s, L, A, face, glow } = c;
    const top = hy - 1 - Math.round(s * 0.15);
    for (let y = top; y < hy + hh; y++) { const t = (y - top) / (hh + 1), inset = y === top ? 2 : y === top + 1 && s >= 3 ? 1 : 0; for (let x = hx - 1 + inset; x < hx + hw + 1 - inset; x++) { const u = (x - hx + 1) / (hw + 2); P.px(x, y, u < 0.2 ? C.steel : u > 0.82 ? C.steel3 : t < 0.2 ? C.steel : C.steel2); } }
    R(hx - 1, hy + hh - 1, hw + 2, 1, C.steel3);
    if (face) { const ey = hy + Math.round(hh * 0.5); R(hx, ey, hw, 1, '#1a1214'); R(hx + hw / 2 - 1, ey, 2, Math.round(hh * 0.4), '#1a1214'); P.px(hx + 1, ey, glow); P.px(hx + hw - 2, ey, glow); if (s >= 6) { P.px(hx + 2, ey, glow); P.px(hx + hw - 3, ey, glow); } }
    else R(hx, hy + 1, hw, Math.round(hh * 0.5), shade(C.steel2, -0.08));
    const ph = s < 4 ? 2 + Math.round(s * 0.45) : 0;
    for (let j = 0; j < ph; j++) { const x = Math.round(hx + hw / 2 - 1); P.px(x, top - 1 - j, j % 2 ? L.trim : shade(L.trim, 0.25)); P.px(x + 1, top - 1 - j + (j > ph * 0.6 ? 1 : 0), shade(L.trim, -0.1)); }
    if (s >= 4) { R(hx + hw / 2 - 1, top, 2, Math.round(hh * 0.4), shade(L.trim, -0.05)); }
    return { crown: top, top: top - 1 - ph };
  },
  greathelm(c) {
    const { P, R, hx, hy, hw, hh, s, L, face } = c;
    const top = hy - 2;
    for (let y = top; y < hy + hh + 1; y++) for (let x = hx - 1; x < hx + hw + 1; x++) { const u = (x - hx + 1) / (hw + 2); P.px(x, y, u < 0.2 ? '#f4ead8' : u > 0.82 ? '#a89880' : '#e8e0d0'); }
    R(hx - 1, top, hw + 2, 1, L.trim);
    if (s >= 3) R(hx - 1, top + 1, hw + 2, 1, shade(L.trim, -0.2));
    if (face) { const ey = hy + Math.round(hh * 0.45); R(hx, ey, hw, 1, '#1a1214'); R(hx + hw / 2 - 1, ey, 2, Math.round(hh * 0.5), '#1a1214'); P.px(hx + 1, ey, '#ffe08a'); P.px(hx + hw - 2, ey, '#ffe08a'); }
    const ch = 1 + Math.round(s * 0.35);
    for (let j = 1; j <= ch; j++) P.px(hx + hw / 2 - 1, top - j, L.trim);
    R(hx + hw / 2 - 2, top - Math.ceil(ch / 2), 3, 1, L.trim);
    return { crown: top, top: top - ch };
  },
  kabuto(c) {
    const { P, R, hx, hy, hw, hh, s, L, face } = c;
    const top = hy - 2, fl = 2 + Math.round(s * 0.3);
    for (let y = top; y < hy + Math.round(hh * 0.45); y++) R(hx - 1, y, hw + 2, 1, y === top ? '#4a4a5a' : '#2a2a3a');
    for (let i = 0; i < 2 + Math.round(s * 0.2); i++) R(hx - 1 - Math.min(fl, i + 1), hy + Math.round(hh * 0.3) + i, hw + 2 + Math.min(fl, i + 1) * 2, 1, i % 2 ? '#3a3a4a' : '#2a2a3a');
    if (face) { if (s >= 4) { R(hx, hy + Math.round(hh * 0.62), hw, Math.round(hh * 0.38), L.main); R(hx + 1, hy + Math.round(hh * 0.75), hw - 2, 1, '#f4ead8'); } }
    const cw = Math.round(hw * 0.6 + s * 0.5), ch = Math.round(2 + s * 0.45);
    for (let i = 0; i <= cw; i++) { const u = i / cw - 0.5, y = Math.round(top - 1 - (1 - (u * 2) ** 2) * 0 - Math.abs(u) * ch * 2); P.px(Math.round(hx + hw / 2 - cw / 2 + i), y, L.trim); }
    P.rect(Math.round(hx + hw / 2 - 1), top - 1, 2, 1, L.trim);
    return { crown: top - 1, top: top - ch - 1 };
  },
  horns(c) {
    const { P, R, hx, hy, hw, hh, s, L, face } = c;
    const top = hy - 1;
    for (let y = top; y < hy + Math.round(hh * 0.4); y++) R(hx - 1 + (y === top ? 1 : 0), y, hw + 2 - (y === top ? 2 : 0), 1, y === top ? C.steel : C.steel2);
    if (face) { const by = hy + Math.round(hh * 0.62); R(hx, by, hw, hh - Math.round(hh * 0.62) + 1 + Math.round(s * 0.3), L.hair); R(hx + 1, by - 1, 2, 1, L.hair); R(hx + hw - 3, by - 1, 2, 1, L.hair); P.px(hx + hw / 2 - 1, by + 1, shade(L.hair, -0.25)); }
    else R(hx, hy + 1, hw, hh - 1, L.hair);
    const len = Math.round(2 + s * 0.6);
    for (const d of [-1, 1]) { let x = d < 0 ? hx - 1 : hx + hw, y = hy; for (let i = 0; i < len; i++) { P.px(x, y, i > len * 0.6 ? '#f4ead0' : '#e8d8b0'); if (i < len * 0.5) P.px(x, y + 1, '#c8b896'); x += d; if (i >= 1) y--; } }
    return { crown: top, top: top - len };
  },
  hood(c, opt = {}) {
    const { P, R, hx, hy, hw, hh, s, L, face } = c;
    const col = opt.col || L.main, top = hy - 1 - Math.round(s * 0.12), lo = hy + hh + (s >= 3 ? 1 : 0);
    for (let y = top; y <= lo; y++) {
      const t = (y - top) / Math.max(1, lo - top), inset = y === top ? 2 : y === top + 1 ? 1 : 0, spread = t > 0.75 ? Math.round((t - 0.75) * 4 * (1 + s * 0.15)) : 0;
      for (let x = hx - 1 + inset - spread; x < hx + hw + 1 - inset + spread; x++) { const u = (x - hx + 1 + spread) / (hw + 2 + spread * 2); P.px(x, y, u < 0.18 ? shade(col, 0.16) : u > 0.82 ? shade(col, -0.26) : (x + y) % 5 === 0 && s >= 6 ? shade(col, -0.08) : col); }
    }
    const pk = 1 + Math.round(s * 0.25);
    for (let j = 1; j <= pk; j++) { P.px(hx + hw / 2 + Math.floor(j / 2), top - j + 1, j === pk ? shade(col, -0.15) : col); P.px(hx + hw / 2 - 1 + Math.floor(j / 2), top - j + 1, shade(col, 0.12)); }
    if (face) {
      const fx = hx + 1, fy = hy + Math.round(hh * 0.3), fw = hw - 2, fh = hh - Math.round(hh * 0.3);
      for (let y = fy; y < fy + fh; y++) { const t = (y - fy) / Math.max(1, fh - 1), ins = t < 0.15 && fw > 4 ? 1 : 0; R(fx + ins, y, fw - ins * 2, 1, y === fy ? shade(L.skin, -0.45) : y === fy + 1 && s >= 4 ? shade(L.skin, -0.25) : L.skin); }
      R(fx + fw - 1, fy + 1, 1, fh - 1, shade(L.skin, -0.18));
      const ey = fy + Math.max(1, Math.round(fh * 0.4)), ec = opt.eye || L.eye || '#1a1214', ex = Math.max(1, Math.round(fw * 0.22));
      P.px(fx + ex, ey, ec); P.px(fx + fw - 1 - ex, ey, ec);
      if (s >= 6) { P.px(fx + ex + 1, ey, ec); P.px(fx + fw - 2 - ex, ey, ec); }
      if (opt.mask) R(fx, ey + 1, fw, fy + fh - ey - 1, opt.mask);
      if (opt.skull) { R(fx, fy + 1, fw, fh - 1, '#e8e8dc'); R(fx, fy + 1, fw, 1, '#bdbdb0'); const sx = Math.max(1, Math.round(fw * 0.3)); R(fx + 1, ey - 1, sx, 2, '#1a1214'); R(fx + fw - 1 - sx, ey - 1, sx, 2, '#1a1214'); P.px(fx + 1, ey, opt.eye); P.px(fx + fw - 2, ey, opt.eye); R(fx + 2, fy + fh - 2, fw - 4, 1, '#3a3a34'); for (let x = fx + 2; x < fx + fw - 2; x += 2) P.px(x, fy + fh - 2, '#e8e8dc'); }
    }
    if (opt.collar) { R(hx - 2, hy + hh - 2, 2, 3, L.trim); R(hx + hw, hy + hh - 2, 2, 3, L.trim); }
    return { crown: top, top: top - pk };
  },
  cowl(c) { return HEAD2.hood(c, { collar: true, eye: c.L.eye }); },
  skullhood(c) { return HEAD2.hood(c, { col: '#2a2834', skull: true, eye: c.L.eye || '#8fe05c' }); },
  mask(c) { return HEAD2.hood(c, { col: shade(c.L.main, -0.1), mask: '#1e1826', eye: c.L.eye || '#ffe08a' }); },
  wizard(c, crooked) {
    const { P, R, hx, hy, hw, hh, s, L, face, A } = c;
    const bw = hw + 4 + Math.round(s * 0.5), brimY = hy + (crooked ? 0 : 0);
    if (face) {
      // beard and hair first, the hat sits over them
      if (!crooked) { const by = hy + Math.round(hh * 0.55) + 2; const bl = hy + hh - by + 2 + Math.round(s * 0.6); R(hx, by, hw, bl, L.hair); R(hx + 1, by + bl, hw - 2, 1, L.hair); R(hx + 1, by - 1, 2, 1, L.hair); R(hx + hw - 3, by - 1, 2, 1, L.hair); P.px(hx + hw / 2 - 1, by + 1, shade(L.hair, -0.25)); for (let y = by + 2; y < by + bl; y += 2) P.px(hx + 1 + ((y * 3) % (hw - 2)), y, shade(L.hair, -0.12)); }
      else { R(hx - 1, hy + 1, 1, hh + Math.round(s * 0.4), L.hair); R(hx + hw, hy + 1, 1, hh + Math.round(s * 0.4), L.hair); }
    } else R(hx, hy + 1, hw, hh - 1, L.hair);
    R(Math.round(hx + hw / 2 - bw / 2), brimY, bw, s >= 5 ? 2 : 1, shade(L.main, -0.18));
    const coneH = 4 + Math.round(s * 0.95), cw0 = hw;
    let tipX = hx + hw / 2;
    for (let j = 0; j < coneH; j++) {
      const t = j / coneH, w = Math.max(1, Math.round(cw0 * (1 - t) + 1)), off = crooked ? Math.round(t * t * (3 + s * 0.4)) : Math.round(t * t * 2);
      const x0 = Math.round(hx + hw / 2 - w / 2 + off);
      for (let i = 0; i < w; i++) P.px(x0 + i, brimY - 1 - j, i === 0 ? shade(L.main, 0.15) : i === w - 1 && w > 2 ? shade(L.main, -0.22) : L.main);
      tipX = x0 + w / 2;
    }
    if (crooked) { P.px(tipX + 1, brimY - coneH, L.main); P.px(tipX + 2, brimY - coneH + 1, shade(L.main, -0.1)); }
    R(Math.round(hx + hw / 2 - cw0 / 2), brimY - 1, cw0, s >= 6 ? 2 : 1, L.trim);
    if (s >= 4) for (let k = 0; k < 2 + Math.floor(s / 4); k++) P.px(Math.round(hx + hw / 2 - 1 + ((k * 5) % 3) - 1), brimY - 3 - k * 2, A.c2);
    return { crown: brimY - 1, top: brimY - coneH - 1 };
  },
  witchhat(c) { return HEAD2.wizard(c, true); },
  stetson(c) {
    const { P, R, hx, hy, hw, hh, s, L, face } = c;
    if (face) { R(hx - 1, hy + 1, 1, Math.round(hh * 0.6), L.hair); R(hx + hw, hy + 1, 1, Math.round(hh * 0.6), L.hair); } else R(hx, hy + 1, hw, hh - 1, L.hair);
    const bw = hw + 6 + Math.round(s * 0.6);
    R(Math.round(hx + hw / 2 - bw / 2), hy, bw, 1 + (s >= 5 ? 1 : 0), shade(L.main, -0.25));
    const ch = 2 + Math.round(s * 0.32);
    R(hx, hy - ch, hw, ch, L.main); R(hx, hy - ch, 1, ch, shade(L.main, 0.18)); R(hx + hw - 1, hy - ch, 1, ch, shade(L.main, -0.22));
    P.px(hx + hw / 2 - 1, hy - ch, shade(L.main, -0.3)); P.px(hx + hw / 2, hy - ch, shade(L.main, -0.3));
    R(hx, hy - 1, hw, 1, L.trim);
    return { crown: hy - ch, top: hy - ch - 1 };
  },
  feathercap(c) {
    const { P, R, hx, hy, hw, hh, s, L, face } = c;
    if (face) { R(hx, hy, 1, Math.round(hh * 0.5), L.hair); R(hx + hw - 1, hy, 1, Math.round(hh * 0.5), L.hair); } else R(hx, hy, hw, hh - 1, L.hair);
    P.ell(hx + hw / 2 + 1, hy, hw / 2 + 1.5, 1.6 + s * 0.12, L.main); R(hx - 1, hy + 1, hw + 2, 1, shade(L.main, -0.2));
    const len = 4 + Math.round(s * 0.8);
    for (let i = 0; i < len; i++) { const x = Math.round(hx + hw - 1 + i * 0.75), y = Math.round(hy - 1 - i * 0.6 + (i > len * 0.7 ? (i - len * 0.7) * 0.6 : 0)); P.px(x, y, L.trim); P.px(x, y + 1, shade(L.trim, -0.25)); }
    return { crown: hy - 2, top: hy - 3 };
  },
  monk(c) {
    const { P, R, hx, hy, hw, hh, s, L, face } = c;
    R(hx + 1, hy - 1, hw - 2, 1, L.skin); P.px(hx + 2, hy - 1, shade(L.skin, 0.25));
    R(hx, hy + 1, hw, 1 + (s >= 6 ? 1 : 0), L.trim);
    if (!face || s >= 3) for (let i = 0; i < 2 + Math.round(s * 0.4); i++) P.px(hx + hw + i, hy + 2 + Math.round(i * 0.6), i % 2 ? L.trim : shade(L.trim, -0.2));
    if (s >= 5) { P.ell(hx + hw / 2, hy - 2, 1.5, 1.2, L.hair); }
    return { crown: hy - 1, top: hy - 3 };
  },
  hair(c) {
    const { P, R, hx, hy, hw, hh, s, L, face } = c;
    R(hx, hy - 1, hw, 2 + Math.round(s * 0.15), L.hair); R(hx, hy, 1, Math.round(hh * 0.5), L.hair); R(hx + hw - 1, hy, 1, Math.round(hh * 0.5), L.hair);
    if (!face) R(hx, hy, hw, hh - 1, L.hair);
    return { crown: hy - 2, top: hy - 2 };
  },
};

/* ---------- the whole body ---------- */
function paintAscended(look, cls, aspId, secId, s, view, frame) {
  const A = ASPECT[aspId], B = secId ? ASPECT[secId] : A, g = ascGeo(s);
  const L = { ...look, kit: CLASS_KIT[cls] || (look.bare ? 'fur' : 'leather') };
  const kit = L.kit, face = view === 'front', back = !face;
  const ws = wingSpanOf(A, s), side = Math.max(ws, g.flare + 2, g.paul ? g.paul - g.armW + 2 : 2);
  const bodyW = g.shW + g.armW * 2 + 2;
  const W = ev2(Math.max(bodyW + (g.flare + 3) * 2, g.shW + ws * 2 + 8)), H = g.top + g.headH + g.neck + g.torsoH + g.legH;
  const { P, R, cyl, bits } = bodyPainter(W, H);
  const cx = W / 2, step = frame === 1 ? 1 : frame === 2 ? 2 : 0, bob = step ? 1 : 0;
  const lift = Math.max(1, Math.round(s * 0.18)), sw = Math.max(1, Math.round(s * 0.18));
  const legTop = H - g.legH, torsoTop = legTop - g.torsoH + bob, headTop = torsoTop - g.neck - g.headH;
  const hx = cx - g.headW / 2, hy = headTop, hw = g.headW, hh = g.headH;
  const glowEye = s >= 3 ? A.glow : (L.eye || '#1a1214');
  const capeC = mixHex(L.cloth, A.c3, 0.35), capeIn = shade(capeC, -0.3);
  const metal = kit === 'plate' || kit === 'lacquer';
  const armC = L.bare ? L.skin : shade(L.main, -0.08);
  const wingY = torsoTop + 2, wingH = Math.round(g.torsoH * 1.15 + s * 0.6);
  const wing = () => { if (!ws) return; rigPart(P, 'wing'); paintWing(P, A, A.wing, cx - g.shW / 2 + 2, wingY, -1, ws + 1, wingH, frame, s); paintWing(P, A, A.wing, cx + g.shW / 2 - 2, wingY, 1, ws + 1, wingH, frame, s); };
  const capeLen = s >= 2 ? g.torsoH + Math.round(g.legH * (0.55 + s * 0.03)) : 0;
  const cape = (full) => {
    if (!capeLen) return;
    rigPart(P, 'cape');
    const y0 = torsoTop + 1, y1 = Math.min(H - 2, y0 + capeLen), sway = step === 1 ? 1 : step === 2 ? -1 : 0;
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0), half = g.shW / 2 + 1 + t * g.flare, x0 = Math.round(cx - half + sway * t), x1 = Math.round(cx + half + sway * t);
      for (let x = x0; x < x1; x++) { const u = (x - x0) / Math.max(1, x1 - x0), fold = s >= 4 && t > 0.2 && (x - x0) % 4 === 2; P.px(x, y, full ? (u < 0.15 ? shade(capeC, 0.15) : u > 0.85 ? capeIn : fold ? shade(capeC, -0.14) : capeC) : fold ? shade(capeIn, -0.12) : capeIn); }
      if (y === y1 || (s >= 4 && y === y1 - 1)) for (let x = x0; x < x1; x++) P.px(x, y, y === y1 ? (s >= 4 ? A.c1 : shade(capeC, -0.4)) : shade(A.c1, -0.25));
    }
    if (full && s >= 5) bits(EMBLEM[A.sym], Math.round(cx - 2), y0 + Math.round(capeLen * 0.3), A.c1, A.c2);
  };
  // 1. behind the body
  if (face) { wing(); cape(false); }
  // 2. legs
  rigPart(P, 'legs');
  const legC = shade(L.cloth, -0.35), bootC = metal && s >= 3 ? C.steel2 : C.boot;
  for (const d of [-1, 1]) {
    const up = (step === 1 && d < 0) || (step === 2 && d > 0) ? lift : 0;
    const lx = d < 0 ? cx - g.legGap / 2 - g.legW : cx + g.legGap / 2;
    cyl(lx, legTop - up, g.legW, g.legH - g.bootH, metal && s >= 4 ? shade(C.steel2, -0.1) : legC, { bottom: false });
    cyl(lx - (s >= 6 ? 1 : 0), H - g.bootH - up, g.legW + (s >= 6 ? 1 : 0), g.bootH, bootC, { top: s >= 3 });
    if (metal && s >= 4) R(lx, legTop - up + Math.round((g.legH - g.bootH) * 0.45), g.legW, Math.max(1, Math.round(s * 0.15)), C.steel);
    if (s >= 7) P.px(lx + Math.floor(g.legW / 2), H - g.bootH - up, A.c1);
  }
  // 3. robes and skirts
  rigPart(P, 'skirt');
  if (kit === 'robe' || kit === 'gi') {
    const y0 = legTop - 1 + bob, y1 = kit === 'robe' ? H - g.bootH + (s >= 4 ? 0 : 0) : legTop + Math.round(g.legH * 0.45);
    for (let y = y0; y < y1; y++) { const t = (y - y0) / Math.max(1, y1 - y0), half = g.waistW / 2 + t * (1 + s * 0.35); cyl(cx - half, y, half * 2, 1, kit === 'robe' ? L.main : L.cloth, { bottom: false }); }
    if (kit === 'robe') { R(cx - 1, y0, 2, y1 - y0, shade(L.main, -0.22)); R(Math.round(cx - g.waistW / 2 - (s * 0.35 + 1)), y1 - 1, Math.round(g.waistW + 2 * (s * 0.35 + 1)), 1, s >= 3 ? A.c1 : L.trim); }
  }
  // 4. torso
  rigPart(P, 'torso');
  const torsoC = L.bare && kit === 'fur' ? L.skin : L.main;
  for (let y = torsoTop; y < legTop + bob; y++) {
    const t = (y - torsoTop) / Math.max(1, g.torsoH - 1), w = ev2(lerp(g.shW, g.waistW, Math.pow(t, 0.9)));
    cyl(cx - w / 2, y, w, 1, torsoC, { bottom: false });
  }
  const chestY = torsoTop + Math.round(g.torsoH * 0.42);
  if (face) {
    if (kit === 'plate') { R(cx - g.shW / 2 + 2, chestY, g.shW - 4, 1, shade(L.main, -0.2)); if (s >= 2) R(cx, torsoTop + 1, 1, g.torsoH - 2, shade(L.main, -0.1)); if (s >= 4) for (let k = 1; k <= 2; k++) R(cx - g.waistW / 2 + 1, chestY + k * Math.max(2, Math.round(g.torsoH * 0.18)), g.waistW - 2, 1, shade(L.main, -0.15)); R(cx - g.shW / 2, torsoTop, g.shW, 1, L.trim); }
    else if (kit === 'lacquer') { for (let y = torsoTop + 2; y < legTop - 1; y += 2) R(cx - g.waistW / 2, y + bob, g.waistW, 1, shade(L.main, -0.25)); for (let x = cx - g.waistW / 2 + 1; x < cx + g.waistW / 2; x += 3) P.px(x, chestY, L.trim); }
    else if (kit === 'robe') { for (let j = 0; j < Math.round(g.torsoH * 0.45); j++) { P.px(cx - 1 - Math.floor(j / 2), torsoTop + j, L.trim); P.px(cx + Math.floor(j / 2), torsoTop + j, L.trim); } R(cx - 1, chestY, 2, legTop - chestY, shade(L.main, -0.18)); }
    else if (kit === 'leather') { for (let j = 0; j < g.torsoH - 1; j++) P.px(Math.round(cx - g.shW / 2 + 1 + j * (g.shW - 2) / g.torsoH), torsoTop + j, shade(L.trim, -0.1)); if (s >= 3) R(cx - g.shW / 2, torsoTop, g.shW, 1, shade(L.main, 0.15)); }
    else if (kit === 'fur') { R(cx - g.shW / 2, torsoTop, g.shW, Math.max(2, Math.round(g.torsoH * 0.25)), L.hair); R(cx - 2, chestY, 1, Math.round(g.torsoH * 0.3), shade(L.skin, -0.18)); R(cx + 1, chestY, 1, Math.round(g.torsoH * 0.3), shade(L.skin, -0.18)); }
    else if (kit === 'gi') { for (let j = 0; j < Math.round(g.torsoH * 0.5); j++) { P.px(cx - 1 - Math.floor(j / 2), torsoTop + j, L.skin); P.px(cx + Math.floor(j / 2), torsoTop + j, L.skin); } }
    else if (kit === 'tunic') { for (let y = torsoTop + 2; y < legTop - 1; y += 2) P.px(cx, y + bob, L.trim); R(cx - g.shW / 2, torsoTop, g.shW, 1, L.trim); }
    if (s >= 3) { const sz = s >= 7 ? 5 : 3, em = sz === 5 ? EMBLEM[A.sym] : EMBLEM3[A.sym]; R(cx - Math.ceil(sz / 2) - 1, chestY - Math.floor(sz / 2) - 1, sz + 2, sz + 2, shade(torsoC, -0.3)); bits(em, Math.round(cx - sz / 2), chestY - Math.floor(sz / 2), A.c1, A.c2); }
  } else {
    R(cx - 1, torsoTop + 1, 1, g.torsoH - 2, shade(torsoC, -0.15));
    if (kit === 'fur') R(cx - g.shW / 2, torsoTop, g.shW, Math.max(2, Math.round(g.torsoH * 0.3)), L.hair);
  }
  // 5. belt and tabard
  const beltH = s >= 5 ? 2 : 1, beltY = legTop - beltH + bob;
  R(cx - g.waistW / 2, beltY, g.waistW, beltH, kit === 'plate' ? shade(L.trim, -0.15) : '#5a3a22');
  if (face) { R(cx - 1, beltY, 2, beltH, s >= 1 ? A.c1 : C.gold); if (s >= 5) P.px(cx - 1, beltY, A.c2); if (s >= 4) { R(cx - g.waistW / 2 + 1, beltY + beltH, 2, 2, '#6b4a2a'); R(cx + g.waistW / 2 - 3, beltY + beltH, 2, 2, '#6b4a2a'); P.px(cx - g.waistW / 2 + 1, beltY + beltH, '#8a6a4a'); } }
  if (face && (metal || kit === 'fur' || kit === 'leather') && s >= 2) {
    const tw = Math.max(2, ev2(g.waistW * 0.5)), th = Math.round(g.legH * (0.35 + s * 0.03)), tc = mixHex(L.cloth, B.c1, s >= 6 ? 0.25 : 0.1);
    for (let y = 0; y < th; y++) { const sway = (step === 1 ? 1 : step === 2 ? -1 : 0) * (y > th / 2 ? 1 : 0); R(cx - tw / 2 + sway, beltY + beltH + y, tw, 1, y === th - 1 ? A.c1 : tc); }
    if (s >= 6) bits(EMBLEM3[A.sym], Math.round(cx - 1.5), beltY + beltH + Math.round(th * 0.3), A.c2);
  }
  // 6. arms
  rigPart(P, 'arms');
  for (const d of [-1, 1]) {
    const ax = d < 0 ? cx - g.shW / 2 - g.armW : cx + g.shW / 2, sy = (step === 1 ? -sw : step === 2 ? sw : 0) * d;
    cyl(ax, torsoTop + 1 + sy * 0.5, g.armW, g.armL, armC, { bottom: false });
    const handH = Math.max(1, Math.round(s * 0.22));
    cyl(ax - (s >= 5 ? (d < 0 ? 1 : 0) : 0), torsoTop + 1 + g.armL + sy * 0.5, g.armW + (s >= 5 ? 1 : 0), handH, metal && s >= 2 ? C.steel2 : L.skin, { bottom: false });
    if (s >= 3 && !L.bare) R(ax, torsoTop + 1 + g.armL - 1 + sy * 0.5, g.armW, 1, L.trim);
  }
  // 7. pauldrons
  rigPart(P, 'paul');
  if (g.paul) for (const d of [-1, 1]) paintPauldron(P, A, A.paul, cx + d * (g.shW / 2 + g.armW / 2 - 0.5), torsoTop + 1, g.paul, d, s, L);
  // 8. head
  rigPart(P, 'head');
  if (g.neck) R(cx - 2, torsoTop - g.neck, 4, g.neck, shade(L.skin, -0.2));
  cyl(hx, hy, hw, hh, L.skin, { bottom: true });
  if (s >= 2) { P.px(hx, hy, '#00000000'); P.px(hx + hw - 1, hy, '#00000000'); }
  if (face) {
    const ey = hy + Math.round(hh * 0.55), ed = Math.max(1, Math.round(hw * 0.22));
    P.px(cx - ed - 1, ey, L.eye || '#1a1214'); P.px(cx + ed, ey, L.eye || '#1a1214');
    if (s >= 6) { P.px(cx - ed - 1, ey - 1, '#ffffff'); P.px(cx + ed, ey - 1, '#ffffff'); }
    if (s >= 4) P.px(cx - 1, ey + 2, shade(L.skin, -0.25));
  }
  const ctx = { P, R, hx, hy, hw, hh, s, L, A, face, glow: glowEye, cx };
  const hr = (HEAD2[L.head] || HEAD2.hair)(ctx) || {};
  const crownY = hr.crown ?? hy - 2, topY = hr.top ?? hy - 2;
  // the true top of the head, for crowns
  let scan = hy - 1;
  for (let y = 0; y < hy; y++) { let found = false; for (let x = Math.floor(hx) - 2; x < hx + hw + 2; x++) if (P.on(x, y)) { found = true; break; } if (found) { scan = y; break; } }
  rigPart(P, 'crown');
  if (s >= 4) { const floaty = A.crown === 'halo' || A.crown === 'rune' || A.crown === 'eye'; paintCrown(P, A, A.crown, cx, Math.max(1, floaty ? Math.min(scan, topY) : crownY), Math.round(hx), hy, hw, s, frame); }
  // 9. in front when seen from behind
  if (back) { cape(true); wing(); }
  // 10. glowing seams on the strongest forms
  rigPart(P, 'auto');
  if (s >= 8) {
    const rng = new RNG(hashStr(cls + aspId + s));
    for (let k = 0; k < 2 + (s - 8) * 2; k++) {
      let x = Math.round(cx - g.shW / 2 + 2 + rng.next() * (g.shW - 4)), y = Math.round(torsoTop + 2 + rng.next() * (g.torsoH - 4));
      for (let j = 0; j < 3 + rng.int(0, 3); j++) { if (!P.on(x - 1, y) || !P.on(x + 1, y)) break; P.px(x, y, j % 2 ? A.glow : A.c2); y += 1; x += rng.int(-1, 1); }
    }
  }
  // 11. rim light toward the aspect glow on big forms
  if (s >= 5) {
    const lit = [];
    for (let y = 0; y < H; y++) for (let x = 1; x < W - 1; x++) {
      const c = P.get(x, y);
      if (!(c >>> 24)) continue;
      if (!P.on(x + 1, y) && x > cx) lit.push([x, y, 0.35]);
      else if (!P.on(x - 1, y) && x < cx) lit.push([x, y, -0.15]);
    }
    for (const [x, y, k] of lit) { const c = P.get(x, y), r = c & 255, gg = (c >> 8) & 255, b = (c >> 16) & 255; const hex = toHex(r, gg, b); P.px(x, y, k > 0 ? mixHex(hex, A.glow, k) : shade(hex, 0.18)); }
  }
  P.outline();
  const sp = P.sprite(Math.floor(cx), H - 1);
  sp.handY = g.legH + Math.round(g.torsoH * 0.45); sp.handR = g.shW / 2 + 2; sp.top = Math.max(0, scan - 2); sp.u = H / 24;
  return sp;
}

/* ---------- beasts and drawn sheets: resampled larger, then adorned ---------- */
function resamplePP(src, k) {
  const w = Math.max(1, Math.round(src.w * k)), h = Math.max(1, Math.round(src.h * k));
  const c = mkCanvas(w, h), g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(src.canvas ? src.canvas() : src.c, 0, 0, w, h);
  const img = g.getImageData(0, 0, w, h).data;
  // the palette of the original keeps the result crisp
  const pal = [];
  const seen = new Set();
  const d = src.d || null;
  if (d) for (let i = 0; i < d.length; i++) if (d[i] >>> 24) { const v = d[i] & 0xffffff; if (!seen.has(v)) { seen.add(v); pal.push([v & 255, (v >> 8) & 255, (v >> 16) & 255]); } }
  const P = new PP(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, a = img[i + 3];
    if (a < 110) continue;
    let r = img[i], gg = img[i + 1], b = img[i + 2];
    if (a < 255) { r = Math.min(255, (r * 255) / a); gg = Math.min(255, (gg * 255) / a); b = Math.min(255, (b * 255) / a); }
    if (pal.length) { let best = pal[0], bd = 1e9; for (const q of pal) { const dd = (q[0] - r) ** 2 + (q[1] - gg) ** 2 + (q[2] - b) ** 2; if (dd < bd) { bd = dd; best = q; } } r = best[0]; gg = best[1]; b = best[2]; }
    P.d[y * w + x] = (255 << 24) | (b << 16) | (gg << 8) | r;
  }
  return P;
}
function contourTop(P, x) { for (let y = 0; y < P.h; y++) if (P.on(x, y)) return y; return -1; }
function adornPP(P, A, s, frame, o = {}) {
  // grow a canvas with room for wings and a crown
  const ws = wingSpanOf(A, s) ? Math.round(wingSpanOf(A, s) * 0.6) : 0, top = s >= 4 ? 3 + Math.round(s * 0.6) : 1;
  const W = P.w + ws * 2 + 2, H = P.h + top;
  const Q = new PP(W, H), ox = ws + 1, oy = top;
  // when the rig paints, the body's layers come across whole and every adornment lands on a layer of its own
  const rc = P.rigCap, tagQ = (n) => { if (rc) rigPart(Q, n); };
  if (rc) Q.cap = { ...rc, part: 'wing', names: [], layers: Object.create(null), w: W, h: H, own: new Uint8Array(W * H), roots: rc.roots && Object.fromEntries(Object.entries(rc.roots).map(([n, L]) => [n, L.map(([x, y]) => [x + ox, y + oy])])) };
  // body bounds
  let x0 = P.w, x1 = 0, y0 = P.h;
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (P.on(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); }
  const bx = ox + (x0 + x1) / 2, by = oy + y0 + (P.h - y0) * 0.3;
  if (ws) { const sp2 = ws + (x1 - x0) * 0.12, hh2 = Math.min((P.h - y0) * 0.75, 10 + s * 2); tagQ('wing'); paintWing(Q, A, A.wing, bx - 2, by, -1, sp2, hh2, frame, s); paintWing(Q, A, A.wing, bx + 2, by, 1, sp2, hh2, frame, s); }
  if (rc) for (const n of rc.names) { tagQ(n); const L = rc.layers[n]; for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (L[y * P.w + x] >>> 24) crigPut(Q, x + ox, y + oy, L[y * P.w + x]); }
  else for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (P.d[y * P.w + x] >>> 24) Q.d[(y + oy) * W + x + ox] = P.d[y * P.w + x];
  tagQ('auto');
  // markings in the aspect colour along the back
  const rng = new RNG(hashStr(A.id + s + (o.key || '')));
  if (s >= 2) for (let x = x0 + 1; x < x1; x += 2) { const ty = contourTop(P, x); if (ty < 0) continue; if (rng.chance(0.55)) Q.px(x + ox, ty + oy + 1, A.c1); if (s >= 6 && rng.chance(0.4)) Q.px(x + ox, ty + oy + 2, A.c2); }
  if (s >= 3) for (let k = 0; k < s * 2; k++) { const x = Math.round(x0 + rng.next() * (x1 - x0)), ty = contourTop(P, x); if (ty < 0) continue; const y = ty + 2 + Math.floor(rng.next() * Math.max(1, (P.h - ty) * 0.5)); if (P.on(x, y) && P.on(x + 1, y)) Q.px(x + ox, y + oy, k % 3 ? shade(A.c1, -0.1) : A.glow); }
  // spikes or crystals along the top contour
  tagQ('spike');
  if (s >= 3) { const n = 2 + Math.floor(s / 3); for (let k = 0; k < n; k++) { const x = Math.round(x0 + (x1 - x0) * (0.25 + (k / Math.max(1, n - 1)) * 0.5)), ty = contourTop(P, x); if (ty < 0) continue; const hgt = 1 + Math.round(s * 0.25) + (k % 2); for (let j = 1; j <= hgt; j++) Q.px(x + ox, ty + oy - j, j === hgt ? A.c2 : A.c1); } }
  tagQ('headgear');
  if (s >= 4) { const cxp = Math.round(ox + x0 + (x1 - x0) * (o.headAt ?? 0.72)), ty = contourTop(P, cxp - ox); paintCrown(Q, A, A.crown, cxp, Math.max(1, ty + oy - 1), cxp - 3, ty + oy + 1, 6, s, frame); }
  tagQ('auto');
  if (s >= 5) {
    const lit = [];
    for (let y = 0; y < H; y++) for (let x = 1; x < W - 1; x++) if (Q.on(x, y) && !Q.on(x + 1, y) && x > bx) lit.push([x, y]);
    for (const [x, y] of lit) { const c = Q.get(x, y); Q.px(x, y, mixHex(toHex(c & 255, (c >> 8) & 255, (c >> 16) & 255), A.glow, 0.35)); }
  }
  Q.outline();
  const sp = Q.sprite(Math.round(ox + P.w / 2), H - 1);
  sp.handY = Math.round((P.h - y0) * 0.5); sp.handR = (x1 - x0) / 2; sp.top = Math.max(0, oy + y0 - top); sp.u = 1 + s * 0.07;
  if (rc) { sp.rigCap = Q.cap; Q.cap = null; }
  return sp;
}
function ascBeastFrames(formId, aspId, s) {
  return spr(`ascb:${formId}:${aspId}:${s}`, () => {
    const F = FORMS[formId], [w, hgt] = FORM_SIZE[formId], A = ASPECT[aspId], k = 1 + s * 0.075;
    const make = (f, rig) => {
      const p = new PP(w, hgt), rc = rig ? crigCapture({ w, h: hgt, paint: (q) => BEAST_ART[F.fam](q, F, f) }, f) : null;
      if (rc) { for (const n of rc.names) { const L = rc.layers[n]; for (let i = 0; i < L.length; i++) if (L[i] >>> 24) p.d[i] = L[i]; } } else BEAST_ART[F.fam](p, F, f);
      const big = k > 1.02 ? resamplePP(p, k) : p;
      if (rc) big.rigCap = crigResample(rc, k);
      return adornPP(big, A, s, f === 3 ? 0 : f, { key: formId, headAt: 0.78 });
    };
    const fr = [0, 1, 2, 3].map((f) => make(f));
    return crigAttach(fr, { w: fr[0].w, h: fr[0].h, ax: fr[0].ax, ay: fr[0].ay, atkF: 3, stepF: 1, capture: (f) => make(f, true).rigCap });
  });
}
function ascSheetFrame(base, aspId, s) {
  base._asc = base._asc || {};
  const key = aspId + s;
  if (base._asc[key]) return base._asc[key];
  const P = new PP(base.w, base.h), g = base.c.getContext('2d'), img = g.getImageData(0, 0, base.w, base.h).data;
  for (let i = 0; i < base.w * base.h; i++) if (img[i * 4 + 3] > 100) P.d[i] = (255 << 24) | (img[i * 4 + 2] << 16) | (img[i * 4 + 1] << 8) | img[i * 4];
  const big = resamplePP(P, 1 + s * 0.06);
  return (base._asc[key] = adornPP(big, ASPECT[aspId], s, 0, { key: 'sheet', headAt: 0.5 }));
}

/* ---------- which picture to draw ---------- */
function ascFramesFor(p) {
  const id = ascAspect(p), st = ascStage(p);
  if (p.beast && p.form) { const fr = ascBeastFrames(p.form, id, st); return { front: [fr[0], fr[1], fr[2]], back: [fr[0], fr[1], fr[2]], atk: fr[3] }; }
  const sec = ascSecond(p) || '';
  const look = p.look || CLASS[p.cls].look;
  return spr(`asch:${p.cls}:${id}:${sec}:${st}:${p.dyeKey || ""}`, () => rigSet({
    front: [0, 1, 2].map((f) => paintAscended(look, p.cls, id, sec || null, st, 'front', f)),
    back: [0, 1, 2].map((f) => paintAscended(look, p.cls, id, sec || null, st, 'back', f)),
  }, (view, f) => paintAscended(look, p.cls, id, sec || null, st, view, f)));
}
const _heroFrameAsc = heroFrame;
heroFrame = function (p) {
  if (!p || !p.asc || !p.asc.length || !ASPECT[ascAspect(p)]) return _heroFrameAsc(p);
  if (p.beast) {
    const fr = ascBeastFrames(p.form, ascAspect(p), ascStage(p)), rs = crigBeastFrame(p, fr);
    if (rs) return rs;
    if (p.atkPose > 0 || p.leapT > 0 || p.bashT > 0) return fr[3];
    if (p.moving && p.dashT <= 0) return fr[1 + (Math.floor(p.anim) % 2)];
    return fr[0];
  }
  if (p.sheet) return ascSheetFrame(_heroFrameAsc(p), ascAspect(p), ascStage(p));
  const fi = p.moving && p.dashT <= 0 ? 1 + (Math.floor(p.anim) % 2) : 0;
  return rigHeroFrame(ascFramesFor(p), p, fi);
};
// held weapons and hands follow the bigger body
function drawHeld(g, p, x, y) {
  const w = p.weapon, sp = heldWeapon(w.id), body = heroFrame(p);
  const u = body && body.u ? Math.min(2.2, body.u) : 1, handY = body && body.handY ? body.handY : 8, reachB = body && body.handR ? Math.max(4, body.handR * 0.7) : 4;
  let ang = p.aim, ox = 0;
  const sw = p.swing;
  if (sw && (sw.style === 'slash' || sw.style === 'stab' || sw.style === 'punch' || sw.style === 'slam')) {
    const k = clamp(sw.t / sw.dur, 0, 1), e = easeOut(k);
    if (sw.style === 'slash' || sw.style === 'slam') ang = sw.ang + (sw.arc / 2) * sw.dir * (e * 2 - 1);
    else ox = Math.sin(k * Math.PI) * 6;
  } else if (sw && sw.style === 'spin') ang = sw.ang + (sw.t / sw.dur) * TAU;
  else if (sw && sw.style === 'thrust') ox = Math.sin(clamp(sw.t / sw.dur, 0, 1) * Math.PI) * 10;
  if (p.recoil > 0) { ox -= p.recoil * 30; p.recoil -= 1 / 60; }
  const hx = x + Math.cos(ang) * (reachB + ox), hy = y - handY * (p.sizeMul || 1) + Math.sin(ang) * (3 * u + ox * 0.6);
  const ws = u > 1.15 ? Math.min(1.8, 1 + (u - 1) * 0.55) : 1;
  g.save();
  g.translate(Math.round(hx), Math.round(hy));
  g.rotate(ang);
  if (Math.cos(ang) < 0) g.scale(1, -1);
  if (ws !== 1) g.scale(ws, ws);
  g.drawImage(sp.c, -sp.ax, -sp.ay);
  if (w.rar === 'legendary' || w.rar === 'epic') { g.globalAlpha = 0.25 + Math.sin(G.t * 5) * 0.15; g.drawImage(tintOf(sp, RARITY[w.rar].color, 'gl'), -sp.ax, -sp.ay); }
  g.restore();
};
const _handPosAsc = handPos;
handPos = function (p, ang = p.aim) {
  if (!p || !p.asc || !p.asc.length) return _handPosAsc(p, ang);
  const body = heroFrame(p), handY = body && body.handY ? body.handY : 8, r = body && body.handR ? Math.max(6, body.handR * 0.8) : 6;
  return { x: p.x + Math.cos(ang) * r, y: p.y - handY * (p.sizeMul || 1) + Math.sin(ang) * 4 };
};
hook('loadRun', (c, run, p) => { setAscBody(p); });

