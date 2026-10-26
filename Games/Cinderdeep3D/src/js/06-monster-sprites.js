/* ============================================================
   Cinderdeep — monster and boss sprites
   Each painter returns frames: [step A, step B, attack pose].
   ============================================================ */
const EYE_RED = '#ff4a4a';
const MON = {
  skeleton(p, f, o) {
    const B = o.tint || C.bone, B2 = shade(B, -0.2), lf = f === 1 ? 1 : 0;
    rigOrient(p, 'front', 0.8);
    rigPart(p, 'leg'); p.line(7, 14, 6 - lf, 18, B2); p.line(9, 14, 10 + lf, 18, B2); p.px(6 - lf, 19, B2); p.px(10 + lf, 19, B2);
    rigPart(p, 'body'); p.line(8, 9, 8, 13, B2); p.line(6, 10, 10, 10, B); p.line(6, 12, 10, 12, B); p.rect(6, 13, 5, 1, B2);
    const up = f === 2 ? -3 : 0;
    rigPart(p, 'arm'); p.line(6, 10, 4, 14 + (f === 1 ? -1 : 0), B); p.line(10, 10, 12, 13 + up, B);
    rigPart(p, 'head'); p.ell(8, 5, 3.6, 3.2, B); p.rect(6, 8, 5, 1, B2); p.px(7, 9, B2); p.px(9, 9, B2);
    rigPart(p, 'face'); p.rect(6, 5, 2, 2, '#2a0a10'); p.rect(9, 5, 2, 2, '#2a0a10'); p.px(6, 5, o.eye || EYE_RED); p.px(10, 5, o.eye || EYE_RED);
    rigPart(p, 'gear');
    if (o.bow) { for (let y = 7; y < 18; y++) p.px(2 + Math.round(Math.sin(((y - 7) / 10) * Math.PI) * -2) + 1, y, C.wood); p.line(3, 7, 3, 17, '#e8e0cc'); }
    else { p.line(12, 13 + up, 14, 7 + up, '#a8a296'); p.line(13, 13 + up, 15, 7 + up, '#8a8478'); p.line(11, 12 + up, 13, 14 + up, C.wood2); }
  },
  bat(p, f, o) {
    const c = o.tint ? shade(o.tint, -0.45) : '#4a2a56', w = o.tint || '#6a3a78';
    rigOrient(p, 'front', 0.8); rigPart(p, 'wing'); 
    if (f === 0) { p.poly([[7, 6], [1, 1], [0, 5], [3, 8]], w); p.poly([[9, 6], [15, 1], [16, 5], [13, 8]], w); }
    else { p.poly([[7, 6], [1, 10], [2, 6], [4, 5]], w); p.poly([[9, 6], [15, 10], [14, 6], [12, 5]], w); }
    rigPart(p, 'body'); p.disc(8, 6, 2.6, c); p.px(7, 3, c); p.px(9, 3, c); rigPart(p, 'face'); p.px(7, 6, EYE_RED); p.px(9, 6, EYE_RED); p.px(8, 8, '#ffffff');
  },
  slime(p, f, o) {
    const c = o.tint || '#5fd36a', sm = o.small;
    const rx = sm ? (f ? 3.6 : 4.4) : f ? 5.2 : 6.4, ry = sm ? (f ? 3.6 : 2.8) : f ? 5.4 : 4.4, cy = sm ? 8 - ry + 3 : 12 - ry;
    rigOrient(p, 'front', 1.5);
    p.ball(8, cy + 1, rx, ry, c, 0.4, -0.3);
    p.rect(8 - Math.round(rx), Math.round(cy + ry), Math.round(rx * 2) + 1, 1, shade(c, -0.35));
    rigPart(p, 'face');
    const ey = Math.round(cy);
    if (sm) { p.px(6, ey, '#ffffff'); p.px(9, ey, '#ffffff'); p.px(6, ey + 1, '#1a1214'); p.px(9, ey + 1, '#1a1214'); }
    else { p.rect(5, ey, 2, 2, '#ffffff'); p.rect(10, ey, 2, 2, '#ffffff'); p.px(6, ey + 1, '#1a1214'); p.px(11, ey + 1, '#1a1214'); p.px(6, ey - 2, '#ffffff'); }
    if (o.magma) { p.px(7, ey + 3, '#ffe08a'); p.px(10, ey + 2, '#ffe08a'); p.px(4, ey + 2, '#ffd08a'); }
  },
  ghost(p, f, o) {
    const c = o.tint || '#dfe8f2', a = 215;
    rigOrient(p, 'front', { depth: 0.8, float: true });
    p.disc(7, 6, 5, c, a); p.rect(2, 6, 11, 8, c, a);
    for (let x = 2; x <= 12; x++) { const y = 14 + (((x + f) % 3) === 0 ? 1 : 0); p.rect(x, 14, 1, y - 13, c, a); }
    p.rect(2, 6, 2, 8, shade(c, 0.2), a); p.rect(11, 6, 2, 8, shade(c, -0.15), a);
    rigPart(p, 'face'); p.rect(4, 5, 2, 3, '#2a3040'); p.rect(9, 5, 2, 3, '#2a3040'); p.ell(7, 10, 1.2, 1.4, '#2a3040');
  },
  cultist(p, f, o) {
    const r = o.tint || '#5a2a6a';
    rigOrient(p, 'front', { depth: 0.8, float: true });
    p.poly([[5, 8], [11, 8], [13.5, 19], [2.5, 19]], r); p.rect(3, 18, 11, 1, shade(r, -0.3));
    p.line(8, 9, 8, 18, shade(r, -0.2)); p.rect(5, 12, 7, 1, '#c8901c');
    rigPart(p, 'head'); p.disc(8, 6, 4.2, shade(r, -0.15)); rigPart(p, 'face'); p.ell(8, 7, 2.6, 2.2, '#140a14'); p.px(7, 7, '#ff5ad0'); p.px(9, 7, '#ff5ad0');
    rigPart(p, 'body');
    const hy = f === 2 ? 8 : 13;
    p.px(3, hy, '#c8b8a8'); p.px(13, hy, '#c8b8a8');
    if (f === 2) { p.disc(8, 2, 2, '#ff5ad0'); p.px(8, 2, '#ffffff'); }
  },
  sporeling(p, f, o) {
    const cap = o.tint || '#c43a5a', sq = f === 1 ? 1 : 0;
    rigOrient(p, 'front', 1.1);
    p.px(6, 15, '#8a7a68'); p.px(10, 15, '#8a7a68');
    p.rect(5, 9 + sq, 7, 6 - sq, '#e8dcc8'); p.rect(5, 9 + sq, 1, 6 - sq, '#ffffff');
    rigPart(p, 'face'); p.px(6, 11 + sq, '#1a1214'); p.px(10, 11 + sq, '#1a1214'); p.rect(7, 13, 3, 1, '#8a6a5a');
    rigPart(p, 'head'); p.ell(8, 7 + sq, 7 + sq * 0.5, 4 - sq * 0.5, cap); p.ell(8, 6 + sq, 5, 2, shade(cap, 0.2));
    p.px(5, 6 + sq, '#ffffff'); p.px(10, 5 + sq, '#ffffff'); p.px(12, 8 + sq, '#ffffff'); p.px(8, 8 + sq, '#ffffff');
    if (f === 2) for (let i = 0; i < 5; i++) p.px(3 + i * 2.5, 1 + (i % 2), '#d8ff9a');
  },
  spider(p, f, o) {
    const c = o.tint || '#2e2638';
    rigOrient(p, 'top');
    for (let i = 0; i < 4; i++) {
      const y0 = 6 + i * 1.6, dy = (i % 2 === f % 2) ? -1 : 1;
      p.line(8, y0, 3, 3 + i * 3 + dy, c); p.line(3, 3 + i * 3 + dy, 1, 6 + i * 2.5 + dy, c);
      p.line(12, y0, 17, 3 + i * 3 - dy, c); p.line(17, 3 + i * 3 - dy, 19, 6 + i * 2.5 - dy, c);
    }
    p.ball(10, 9, 5, 4, c, 0.3, -0.3); p.disc(10, 4.5, 2.6, shade(c, 0.1));
    p.px(9, 4, EYE_RED); p.px(11, 4, EYE_RED); p.px(10, 3, EYE_RED); p.px(8, 5, '#ff8a8a'); p.px(12, 5, '#ff8a8a');
    p.px(10, 10, '#c43a4a'); p.px(10, 11, '#c43a4a');
  },
  bloat(p, f, o) {
    const c = o.tint || '#86b04a', r = f === 1 ? 6.8 : 6;
    rigOrient(p, 'front', 1.2);
    p.ball(8, 9, r, r - 0.5, c, 0.3, -0.3);
    p.line(4, 7, 6, 11, '#c45a3a'); p.line(11, 6, 12, 10, '#c45a3a');
    p.disc(5, 12, 1, shade(c, -0.3)); p.disc(11, 12, 1.2, shade(c, -0.3)); p.disc(9, 5, 0.8, shade(c, -0.3));
    rigPart(p, 'face'); p.px(6, 8, '#ffe08a'); p.px(10, 8, '#ffe08a'); p.rect(7, 11, 3, 1, '#3a2a1a');
  },
  thornvine(p, f, o) {
    const g = '#4a8a3a', sw = f === 1 ? 1 : 0;
    rigOrient(p, 'front', 0.9);
    p.line(8, 19, 8 + sw, 10, g); p.line(9, 19, 9 + sw, 10, shade(g, -0.2));
    p.poly([[8, 16], [2, 12], [4, 15]], '#5aa84a'); p.poly([[9, 14], [15, 10], [13, 14]], '#5aa84a');
    p.px(3, 12, '#e8e0cc'); p.px(15, 10, '#e8e0cc');
    rigPart(p, 'head'); p.ball(8 + sw, 6, 5, 4.5, o.tint || '#d0507a', 0.3, -0.3);
    rigPart(p, 'face'); p.ell(8 + sw, 7, 2.6, f === 2 ? 2.2 : 1.2, '#2a0a14'); p.px(7 + sw, 6, '#ffffff'); p.px(10 + sw, 6, '#ffffff');
    rigPart(p, 'head'); p.px(4 + sw, 3, '#5aa84a'); p.px(12 + sw, 3, '#5aa84a');
  },
  beetle(p, f, o) {
    const c = o.tint || '#3a4a8a', d = f === 1 ? 1 : 0;
    rigOrient(p, 'top');
    for (let i = 0; i < 3; i++) { p.line(5, 7 + i * 2, 1, 6 + i * 3 + (i % 2 ? d : -d), '#1a1a2a'); p.line(13, 7 + i * 2, 17, 6 + i * 3 - (i % 2 ? d : -d), '#1a1a2a'); }
    p.ball(9, 9, 6.5, 5, c, 0.4, -0.35); p.line(9, 5, 9, 14, shade(c, -0.35)); p.line(6, 6, 7, 11, shade(c, 0.45));
    p.ell(9, 3.5, 3, 2, '#1e1e30'); p.line(9, 2, 9, 0, '#d8d0b8'); p.line(8, 1, 10, 1, '#d8d0b8');
    p.px(7, 3, '#ffd35c'); p.px(11, 3, '#ffd35c');
  },
  wraith(p, f, o) {
    const c = o.tint || '#a8d8f0';
    rigOrient(p, 'front', { depth: 0.7, float: true });
    p.poly([[8, 1], [13, 6], [12, 14], [8 + (f ? 1 : -1), 19], [4, 14], [3, 6]], c, 220);
    p.poly([[8, 2], [11, 6], [5, 6]], shade(c, 0.3));
    rigPart(p, 'face'); p.ell(8, 7, 2.6, 2.4, '#0a1a2a'); p.px(7, 7, '#e9ffff'); p.px(9, 7, '#e9ffff');
    rigPart(p, 'arm'); const cy = f === 2 ? 8 : 11;
    p.line(3, 9, 1, cy, '#e9f8ff'); p.line(13, 9, 15, cy, '#e9f8ff'); p.px(1, cy + 1, '#ffffff'); p.px(15, cy + 1, '#ffffff');
  },
  wolf(p, f, o) {
    const c = o.tint || '#cfd8e2', d = shade(c, -0.25);
    const l = f === 1 ? 1 : 0;
    rigOrient(p, 'side');
    rigPart(p, 'leg:f'); p.line(5, 9, 4 - l, 13, d); p.line(13, 9, 12 - l, 13, d);
    rigPart(p, 'leg:n'); p.line(8, 9, 8 + l, 13, d); p.line(15, 9, 16 + l, 13, d);
    rigPart(p, 'tail'); p.line(4, 6, 0, 4 - l, c); p.line(4, 7, 1, 6, d);
    rigPart(p, 'body'); p.ball(10, 7, 6.5, 3.4, c, 0.3, -0.3);
    rigPart(p, 'head'); p.ell(16, 5, 3.4, 2.8, c); p.rect(18, 5, 3, 2, shade(c, -0.1)); p.px(21, 5, '#1a1214');
    p.poly([[14, 1], [16, 3], [14, 4]], c); p.px(17, 4, f === 2 ? '#ff4a4a' : '#1a3a5a'); p.rect(18, 7, 2, 1, '#ffffff');
    if (o.ghostly) p.map((v, x, y) => ((v & 0x00ffffff) | (170 << 24)) >>> 0);
  },
  yeti(p, f, o) {
    const c = o.tint || '#e8eef6', up = f === 2 ? -5 : 0;
    rigOrient(p, 'front', 1);
    rigPart(p, 'arm'); p.ell(4, 15 + up, 3.5, 6, shade(c, -0.08)); p.ell(22, 15 + up, 3.5, 6, shade(c, -0.08));
    rigPart(p, 'leg'); p.rect(8, 22, 4, 3, shade(c, -0.25)); p.rect(14, 22, 4, 3, shade(c, -0.25));
    rigPart(p, 'body'); p.ball(13, 14, 10, 9.5, c, 0.2, -0.25);
    rigPart(p, 'face'); p.ell(13, 10, 5.5, 4, '#5a7a9a'); p.px(11, 9, '#ffffff'); p.px(15, 9, '#ffffff'); p.px(11, 10, '#1a1214'); p.px(15, 10, '#1a1214');
    p.rect(11, 12, 5, 1, '#2a3a4a'); p.px(11, 13, '#ffffff'); p.px(15, 13, '#ffffff');
    rigPart(p, 'body'); p.line(7, 5, 5, 1, '#b8a888'); p.line(19, 5, 21, 1, '#b8a888');
  },
  crystal(p, f, o) {
    const c = o.tint || C.ice;
    rigOrient(p, 'front', 0.9);
    p.poly([[8, 1], [11, 8], [10, 20], [6, 20], [5, 8]], c); p.line(8, 2, 8, 19, C.ice2);
    p.poly([[3, 8], [6, 12], [6, 20], [2, 20], [1, 13]], shade(c, -0.15)); p.poly([[13, 6], [15, 12], [14, 20], [10, 20], [11, 11]], shade(c, -0.1));
    p.px(8, 6, '#ffffff'); p.px(13, 10, '#ffffff'); if (f) p.px(3, 12, '#ffffff');
  },
  snowimp(p, f, o) {
    const c = o.tint || '#cfe6f8';
    rigOrient(p, 'front', 1);
    p.px(5, 15, '#7a9ab8'); p.px(9, 15, '#7a9ab8');
    p.ball(7, 11, 4, 4, c, 0.3, -0.25); rigPart(p, 'head'); p.disc(7, 6, 3.6, c);
    p.px(4, 2, '#7a9ab8'); p.px(10, 2, '#7a9ab8'); p.px(4, 3, '#9ab8d0'); p.px(10, 3, '#9ab8d0');
    rigPart(p, 'face'); p.px(6, 6, '#1a2a4a'); p.px(8, 6, '#1a2a4a'); p.rect(6, 8, 3, 1, '#3a4a6a');
    rigPart(p, 'gear'); p.disc(f === 2 ? 12 : 11, f === 2 ? 4 : 10, 2, '#ffffff');
  },
  imp(p, f, o) {
    const c = o.tint || '#d8402a';
    rigOrient(p, 'front', 0.9); rigPart(p, 'wing'); 
    if (f === 0) { p.poly([[5, 7], [0, 2], [1, 8]], '#7a1a1a'); p.poly([[11, 7], [16, 2], [15, 8]], '#7a1a1a'); }
    else { p.poly([[5, 7], [0, 10], [2, 6]], '#7a1a1a'); p.poly([[11, 7], [16, 10], [14, 6]], '#7a1a1a'); }
    rigPart(p, 'tail'); p.line(8, 13, 12, 15, c); p.px(13, 14, c);
    rigPart(p, 'body'); p.ball(8, 10, 3.6, 4, c, 0.3, -0.3); rigPart(p, 'head'); p.disc(8, 5, 3.3, c);
    p.px(5, 2, '#3a1a1a'); p.px(11, 2, '#3a1a1a'); p.px(6, 2, '#5a2a2a'); p.px(10, 2, '#5a2a2a');
    rigPart(p, 'face'); p.px(7, 5, '#ffe08a'); p.px(9, 5, '#ffe08a'); p.rect(7, 7, 3, 1, '#3a0a0a');
    if (f === 2) { p.disc(8, 0.5, 1.6, '#ffd08a'); }
  },
  emberknight(p, f, o) {
    const a = o.tint || '#3a3038', l = f === 1 ? 1 : 0;
    rigOrient(p, 'front', 0.9); rigPart(p, 'leg'); 
    p.rect(6, 17, 2, 4 - l, '#1e1a1e'); p.rect(10, 17, 2, 3 + l, '#1e1a1e');
    rigPart(p, 'body'); p.rect(5, 9, 8, 8, a); p.rect(5, 9, 2, 8, shade(a, 0.2)); p.rect(5, 14, 8, 1, '#ff7a2a');
    rigPart(p, 'head'); p.rect(5, 2, 8, 7, shade(a, 0.05)); p.rect(5, 2, 8, 1, shade(a, 0.3)); rigPart(p, 'face'); p.rect(6, 5, 6, 1, '#ff9a3c'); p.px(8, 5, '#ffe08a');
    rigPart(p, 'head'); p.px(9, 0, '#ff7a2a'); p.px(9, 1, '#ffb35e');
    rigPart(p, 'body'); p.rect(1, 8, 5, 9, '#5a4a52'); p.rect(1, 8, 5, 1, '#8a7a82'); p.disc(3, 12, 1.5, '#ff7a2a');
    const up = f === 2 ? -6 : 0;
    rigPart(p, 'gear'); p.line(14, 14 + up, 16, 4 + up, '#c8c8d0'); p.line(13, 12 + up, 15, 14 + up, C.gold2);
  },
  bomber(p, f, o) {
    const c = o.tint || '#6aa84a', l = f === 1 ? 1 : 0;
    rigOrient(p, 'front', 0.9);
    p.px(5, 15 - l, '#3a2a1a'); p.px(9, 15 - (1 - l), '#3a2a1a');
    p.rect(4, 9, 7, 6, '#7a5a3a'); p.rect(4, 12, 7, 1, '#5a3a1e');
    rigPart(p, 'head'); p.disc(7, 6, 3.6, c); p.poly([[3, 5], [0, 3], [3, 7]], c); p.poly([[11, 5], [14, 3], [11, 7]], c);
    rigPart(p, 'face'); p.px(6, 6, '#ffe08a'); p.px(8, 6, '#ffe08a'); p.rect(6, 8, 3, 1, '#2a1a0a');
    rigPart(p, 'gear'); const bx = f === 2 ? 11 : 12, by = f === 2 ? 3 : 11;
    p.disc(bx, by, 2.4, '#1e1e26'); p.px(bx - 1, by - 1, '#5a5a6a'); p.px(bx + 1, by - 3, '#ffd08a');
  },
  salamander(p, f, o) {
    const c = o.tint || '#e8642a', l = f === 1 ? 1 : 0;
    rigOrient(p, 'side'); rigPart(p, 'leg:f'); p.line(4, 8, 2, 11 - l, shade(c, -0.3)); rigPart(p, 'leg:n'); p.line(8, 8, 9, 11 + l, shade(c, -0.3)); rigPart(p, 'leg:f'); p.line(12, 8, 11, 11 - l, shade(c, -0.3)); rigPart(p, 'leg:n'); p.line(15, 8, 16, 11 + l, shade(c, -0.3));
    rigPart(p, 'tail'); p.line(4, 6, 0, 8 + l, c); p.px(0, 9, c);
    rigPart(p, 'body'); p.ball(10, 6, 7, 3, c, 0.35, -0.3); rigPart(p, 'head'); p.ell(17, 5, 3, 2.4, c);
    p.px(18, 4, '#ffe08a'); p.px(19, 4, '#1a1214'); rigPart(p, 'body'); p.px(8, 5, '#ffd35c'); p.px(12, 4, '#ffd35c'); p.px(5, 6, '#ffd35c');
    rigPart(p, 'head'); if (f === 2) { p.px(20, 6, '#ffd08a'); p.px(21, 6, '#ff9a3c'); }
  },
  golem(p, f, o) {
    const c = o.tint || '#2e2630', up = f === 2 ? -5 : 0;
    rigOrient(p, 'front', 1.3);
    rigPart(p, 'arm'); p.rect(1, 10 + up, 6, 9, shade(c, 0.05)); p.rect(19, 10 + up, 6, 9, shade(c, 0.05));
    rigPart(p, 'leg'); p.rect(7, 21, 5, 4, shade(c, -0.2)); p.rect(14, 21, 5, 4, shade(c, -0.2));
    rigPart(p, 'body'); p.poly([[5, 6], [21, 6], [23, 21], [3, 21]], c);
    rigPart(p, 'head'); p.poly([[8, 1], [18, 1], [19, 7], [7, 7]], shade(c, 0.1));
    rigPart(p, 'face'); p.rect(10, 3, 2, 2, '#ff9a3c'); p.rect(15, 3, 2, 2, '#ff9a3c');
    rigPart(p, 'body'); p.line(9, 9, 13, 15, '#ff7a2a'); p.line(13, 15, 17, 12, '#c4401c'); p.line(13, 15, 12, 20, '#ff7a2a');
    rigPart(p, 'arm'); p.px(5, 14 + up, '#ff7a2a'); p.px(21, 13 + up, '#ff7a2a');
  },
  turret(p, f) {
    rigOrient(p, 'front', 1);
    p.rect(3, 10, 8, 6, '#4a4a6a'); p.rect(3, 10, 8, 1, '#6a6a8a'); p.rect(5, 7, 4, 3, '#3a3a5a');
    rigPart(p, 'head'); p.ell(7, 4, 3, 3.4, C.arcane); p.px(6, 3, '#ffffff'); if (f) p.px(8, 5, '#e8d8ff');
  },
};
const MON_SIZE = {
  skeleton: [16, 20], bat: [17, 12], slime: [16, 14], ghost: [15, 17], cultist: [17, 20], sporeling: [16, 16], spider: [21, 15],
  bloat: [16, 17], thornvine: [17, 20], beetle: [18, 15], wraith: [16, 20], wolf: [22, 14], yeti: [27, 26], crystal: [16, 21],
  snowimp: [15, 16], imp: [17, 16], emberknight: [18, 21], bomber: [15, 16], salamander: [22, 12], golem: [26, 26], turret: [14, 17],
};
function monsterFrames(sprite, o = {}) {
  const key = `mon:${sprite}:${o.tint || ''}:${o.bow ? 1 : 0}:${o.small ? 1 : 0}:${o.ghostly ? 1 : 0}`;
  return spr(key, () => {
    const id = sprite === 'archer' ? 'skeleton' : sprite;
    const opts = { ...o, bow: sprite === 'archer' || o.bow, magma: o.tint === '#ff7a2a' || o.tint === '#ffa04a' };
    const [w, h] = MON_SIZE[id] || [16, 16], paint = (p, f) => (MON[id] || MON.slime)(p, f, opts);
    // the painter stays with its frames, so the rig can paint the body again part by part
    return crigAttach([0, 1, 2].map((f) => {
      const p = new PP(w, h);
      paint(p, f);
      p.outline();
      return p.sprite(Math.floor(w / 2), h - 1);
    }), { w, h, ax: Math.floor(w / 2), ay: h - 1, atkF: 2, paint });
  });
}

/* ---------- bosses: built from parts that animate separately ---------- */
const BOSS_PARTS = {
  colossus_skull() {
    const p = new PP(40, 32), B = '#e2d8c0';
    p.ball(20, 14, 17, 13, B, 0.25, -0.25);
    p.rect(9, 22, 22, 6, shade(B, -0.08));
    p.ell(13, 15, 4.5, 4, '#1a0a0e'); p.ell(27, 15, 4.5, 4, '#1a0a0e'); p.disc(13, 15, 1.6, '#ff5a3a'); p.disc(27, 15, 1.6, '#ff5a3a');
    p.poly([[20, 19], [18, 23], [22, 23]], '#1a0a0e');
    p.line(8, 6, 13, 9, shade(B, -0.3)); p.line(13, 9, 12, 12, shade(B, -0.3)); p.line(30, 4, 27, 8, shade(B, -0.3));
    for (let i = 0; i < 6; i++) p.rect(11 + i * 3.4, 26, 2, 3, '#f4ecd8');
    p.outline(); return p.sprite(20, 31);
  },
  colossus_jaw() {
    const p = new PP(28, 10), B = '#d4c8ae';
    p.poly([[1, 0], [27, 0], [24, 8], [4, 8]], B); for (let i = 0; i < 6; i++) p.rect(4 + i * 3.6, 0, 2, 2, '#f4ecd8');
    p.outline(); return p.sprite(14, 0);
  },
  colossus_body() {
    const p = new PP(46, 30), B = '#cfc4aa';
    p.rect(21, 0, 4, 30, shade(B, -0.15));
    for (let i = 0; i < 5; i++) { const y = 3 + i * 5, w = 19 - i * 1.5; for (let s of [-1, 1]) { p.line(23, y, 23 + s * w, y + 3, B); p.line(23 + s * w, y + 3, 23 + s * (w - 3), y + 6, shade(B, -0.15)); } }
    p.ell(23, 28, 10, 3, shade(B, -0.1));
    p.outline(); return p.sprite(23, 29);
  },
  colossus_hand() {
    const p = new PP(20, 18), B = '#e2d8c0';
    p.ell(10, 7, 7, 5, B); for (let i = 0; i < 4; i++) { p.line(4 + i * 4, 10, 3 + i * 4.3, 16, B); p.px(3 + i * 4.3, 17, shade(B, -0.2)); }
    p.line(4, 4, 8, 7, shade(B, -0.25)); p.line(12, 4, 15, 8, shade(B, -0.25));
    p.outline(); return p.sprite(10, 9);
  },
  sporecap_cap() {
    const p = new PP(66, 30), c = '#b03a5e';
    p.ball(33, 18, 31, 13, c, 0.25, -0.3); p.rect(3, 24, 60, 4, shade(c, -0.35));
    for (let i = 0; i < 9; i++) p.ell(8 + i * 6.3, 13 + (i % 3) * 3, 2.4 + (i % 2), 1.6 + (i % 2), '#f4e8d8');
    for (let i = 0; i < 30; i++) p.px(5 + i * 2, 28, '#e8d8c8');
    p.outline(); return p.sprite(33, 28);
  },
  sporecap_stem() {
    const p = new PP(30, 30), c = '#e8dcc6';
    p.poly([[6, 0], [24, 0], [27, 29], [3, 29]], c); p.rect(6, 0, 3, 29, '#ffffff');
    p.ell(10, 9, 3, 3.4, '#1a0a14'); p.ell(20, 9, 3, 3.4, '#1a0a14'); p.disc(10, 9, 1.2, '#c8ff6a'); p.disc(20, 9, 1.2, '#c8ff6a');
    p.ell(15, 19, 6, 4, '#2a0a14'); for (let i = 0; i < 5; i++) p.px(11 + i * 2, 16, '#f4ecd8');
    p.outline(); return p.sprite(15, 29);
  },
  wyrm_head() {
    const p = new PP(28, 24), c = '#8fc8e8';
    p.ball(14, 12, 11, 9, c, 0.3, -0.3); p.ell(14, 19, 8, 3, shade(c, -0.2));
    p.ell(8, 10, 2.6, 2, '#0a1a2a'); p.ell(20, 10, 2.6, 2, '#0a1a2a'); p.px(8, 10, '#e9ffff'); p.px(20, 10, '#e9ffff');
    p.line(4, 4, 1, 0, '#e9f8ff'); p.line(24, 4, 27, 0, '#e9f8ff'); p.line(5, 5, 3, 1, '#cfe9f7'); p.line(23, 5, 25, 1, '#cfe9f7');
    for (let i = 0; i < 5; i++) p.px(9 + i * 2.5, 20, '#ffffff');
    p.line(14, 3, 14, 7, C.ice2);
    p.outline(); return p.sprite(14, 12);
  },
  wyrm_seg() {
    const p = new PP(22, 20), c = '#7ab8dc';
    p.ball(11, 10, 9, 8, c, 0.3, -0.3); p.line(11, 2, 11, 6, '#e9f8ff'); p.poly([[8, 3], [11, -1], [14, 3]], '#cfe9f7');
    p.line(4, 10, 18, 10, shade(c, -0.15));
    p.outline(); return p.sprite(11, 10);
  },
  wyrm_tail() {
    const p = new PP(16, 14), c = '#6aa8cc';
    p.ball(8, 7, 6, 5, c, 0.3, -0.3); p.poly([[8, 1], [10, -2], [11, 3]], '#cfe9f7');
    p.outline(); return p.sprite(8, 7);
  },
  king(f) {
    const p = new PP(26, 36), a = '#2a2228', cape = '#8a1a1e';
    p.poly([[6, 12], [20, 12], [24, 34], [2, 34]], cape); p.line(3, 33, 23, 33, shade(cape, -0.3));
    const l = f === 1 ? 1 : 0;
    p.rect(9, 27, 3, 7 - l, '#1a1418'); p.rect(14, 27, 3, 6 + l, '#1a1418');
    p.rect(7, 13, 12, 14, a); p.rect(7, 13, 3, 14, shade(a, 0.2)); p.rect(7, 22, 12, 1, '#ff7a2a'); p.rect(12, 15, 2, 6, '#ff9a3c');
    p.rect(4, 12, 4, 4, '#3a3038'); p.rect(18, 12, 4, 4, '#3a3038');
    p.rect(8, 4, 10, 9, '#3a3038'); p.rect(8, 4, 10, 1, '#5a5058'); p.rect(9, 8, 8, 1, '#ff9a3c'); p.px(11, 8, '#ffe08a'); p.px(15, 8, '#ffe08a');
    for (let i = 0; i < 5; i++) { p.rect(8 + i * 2, 1 + (i % 2), 2, 3 - (i % 2), C.gold); }
    p.px(10, 0, '#ff9a3c'); p.px(14, 0, '#ffd08a'); p.px(12, 1, '#ff7a2a');
    p.outline(); return p.sprite(13, 35);
  },
  king_sword() {
    const p = new PP(40, 11);
    p.rect(0, 5, 6, 1, '#3a2a1a'); p.rect(6, 1, 2, 9, C.gold2);
    for (let x = 8; x < 36; x++) { p.px(x, 4, '#ffb35e'); p.px(x, 5, '#ff7a2a'); p.px(x, 6, '#c4401c'); if (x % 4 === 0) p.px(x, 3, '#ffd08a'); }
    p.px(36, 5, '#ff7a2a'); p.px(37, 5, '#ffb35e');
    p.outline(); return p.sprite(3, 5);
  },
};
const bossPart = (name, f = 0) => spr(`boss:${name}:${f}`, () => BOSS_PARTS[name](f));

