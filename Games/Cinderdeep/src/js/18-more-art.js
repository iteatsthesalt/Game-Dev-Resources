/* ============================================================
   Cinderdeep — new art: headgear, held weapons, icons,
   monsters, bosses, props, missiles and effects
   ============================================================ */

/* ---------- headgear for the new heroes (paintHero's default case) ---------- */
const HEADGEAR = {
  greathelm(p, L, hy, face) {
    p.rect(4, hy - 2, 8, 8, C.steel2); p.rect(4, hy - 2, 8, 1, C.steel); p.rect(4, hy - 2, 1, 8, C.steel); p.rect(11, hy - 2, 1, 8, shade(C.steel2, -0.3));
    if (face) { p.rect(5, hy + 2, 6, 1, '#1a1214'); p.rect(7, hy + 1, 2, 4, '#1a1214'); p.px(6, hy + 2, '#ffe08a'); p.px(9, hy + 2, '#ffe08a'); }
    else p.rect(5, hy, 6, 4, shade(C.steel2, -0.12));
    p.rect(7, hy - 4, 2, 2, L.trim); p.px(9, hy - 4, L.trim); p.px(10, hy - 3, shade(L.trim, 0.3));
  },
  monk(p, L, hy, face) {
    p.rect(6, hy - 1, 4, 1, L.skin); p.px(7, hy - 1, shade(L.skin, 0.2));
    p.rect(4, hy + 1, 8, 1, L.trim);
    if (!face) { p.px(11, hy + 2, L.trim); p.px(12, hy + 3, L.trim); p.px(12, hy + 4, shade(L.trim, -0.2)); }
  },
  stetson(p, L, hy, face) {
    p.rect(2, hy, 12, 1, shade(L.main, -0.25));
    p.rect(4, hy - 2, 8, 2, L.main); p.rect(5, hy - 3, 6, 1, L.main); p.px(6, hy - 3, shade(L.main, 0.2));
    p.rect(4, hy - 1, 8, 1, L.trim);
    if (face) { p.rect(6, hy + 4, 4, 1, L.hair); p.px(6, hy + 5, L.hair); p.px(9, hy + 5, L.hair); }
    else p.rect(5, hy + 1, 6, 4, L.hair);
  },
  witchhat(p, L, hy, face) {
    p.rect(2, hy, 12, 1, shade(L.main, -0.2));
    p.rect(5, hy - 2, 6, 2, L.main); p.rect(6, hy - 3, 4, 1, L.main); p.rect(7, hy - 4, 3, 1, L.main); p.rect(8, hy - 5, 3, 1, L.main); p.px(11, hy - 5, shade(L.main, 0.15));
    p.rect(5, hy - 1, 6, 1, L.trim);
    if (face) { p.rect(5, hy + 1, 1, 5, L.hair); p.rect(10, hy + 1, 1, 5, L.hair); } else p.rect(5, hy + 1, 6, 5, L.hair);
  },
  kabuto(p, L, hy, face) {
    p.rect(4, hy - 2, 8, 3, '#2a2a3a'); p.rect(4, hy - 2, 8, 1, '#4a4a5a');
    p.rect(3, hy + 1, 2, 3, '#2a2a3a'); p.rect(11, hy + 1, 2, 3, '#2a2a3a');
    p.px(5, hy - 4, L.trim); p.px(6, hy - 3, L.trim); p.px(10, hy - 4, L.trim); p.px(9, hy - 3, L.trim); p.rect(7, hy - 3, 2, 1, L.main);
    if (face) p.rect(5, hy + 4, 6, 2, L.main); else p.rect(5, hy + 1, 6, 4, L.hair);
  },
  feathercap(p, L, hy, face) {
    p.rect(4, hy - 1, 8, 2, L.cloth); p.rect(5, hy - 2, 5, 1, L.cloth); p.rect(4, hy, 8, 1, shade(L.cloth, -0.25));
    p.line(9, hy - 2, 12, hy - 4, '#f4f0e4'); p.line(10, hy - 1, 13, hy - 3, '#d8d0c0');
    if (face) { p.rect(5, hy + 1, 1, 3, L.hair); p.rect(10, hy + 1, 1, 3, L.hair); } else p.rect(5, hy + 1, 6, 4, L.hair);
  },
};

/* ---------- held weapons (pointing right, pivot at the grip) ---------- */
const mkHeld = (w, h, ax, ay, fn) => { const p = new PP(w, h); fn(p); p.outline(); return p.sprite(ax, ay); };
const HELD = {
  mace: () => mkHeld(16, 9, 2, 4, (p) => { p.rect(0, 4, 10, 1, C.wood); p.rect(10, 2, 5, 5, C.steel2); p.rect(10, 2, 5, 1, C.steel); p.px(15, 4, C.steel); p.px(12, 1, C.steel); p.px(12, 7, C.steel2); }),
  pistols: () => mkHeld(11, 7, 1, 3, (p) => { p.rect(0, 3, 3, 3, C.wood); p.rect(2, 2, 8, 2, '#4a4a52'); p.rect(2, 2, 8, 1, '#7a7a86'); p.px(4, 4, '#3a3a42'); }),
  hexstaff: () => mkHeld(19, 11, 2, 5, (p) => { p.rect(0, 5, 13, 1, '#3a2a3a'); p.rect(13, 3, 1, 5, '#5a3a5a'); p.disc(16, 5, 2.4, '#8fe05c'); p.disc(16, 5, 1.1, '#e8ffd0'); p.px(14, 2, '#8fe05c'); p.px(14, 8, '#8fe05c'); }),
  katana: () => mkHeld(22, 5, 2, 2, (p) => { p.rect(0, 2, 5, 1, '#2a2a3a'); p.rect(5, 1, 1, 3, C.gold2); for (let x = 6; x < 21; x++) { const d = x > 17 ? 1 : 0; p.px(x, 1 - d + 1, '#ffffff'); p.px(x, 2 - d + 1, C.steel2); } }),
  lute: () => mkHeld(16, 11, 2, 6, (p) => { p.ell(5, 6, 4.5, 4, C.wood); p.disc(5, 6, 1.4, '#3a2410'); p.rect(9, 5, 5, 2, C.wood2); p.rect(13, 4, 2, 4, C.wood2); p.line(3, 6, 14, 6, '#f1e5cd'); }),
  whip: () => mkHeld(15, 9, 1, 4, (p) => { p.rect(0, 4, 4, 2, C.leather); for (let i = 0; i < 10; i++) p.px(4 + i, 4 + Math.round(Math.sin(i * 0.7) * 2), '#8a5a32'); }),
  chakram: () => mkHeld(12, 12, 2, 6, (p) => { for (let i = 0; i < 22; i++) { const a = (i * TAU) / 22; p.px(6 + Math.cos(a) * 4.4, 6 + Math.sin(a) * 4.4, C.steel); } p.disc(6, 6, 1.5, C.gold); for (let i = 0; i < 4; i++) { const a = (i * TAU) / 4 + 0.4; p.px(6 + Math.cos(a) * 5.6, 6 + Math.sin(a) * 5.6, '#ffffff'); } }),
  flasks: () => mkHeld(10, 11, 1, 6, (p) => { p.rect(3, 1, 3, 3, '#b8a080'); p.ell(4.5, 7, 3.5, 3, '#9ad8f8'); p.ell(4.5, 8, 2.5, 2, '#c873ff'); p.px(3, 6, '#ffffff'); }),
  rapier: () => mkHeld(21, 7, 1, 3, (p) => { p.rect(0, 3, 3, 1, C.wood2); p.ell(4, 3, 1.5, 2.5, C.gold); p.rect(5, 3, 14, 1, C.steel); p.px(19, 3, '#ffffff'); }),
  harpoon: () => mkHeld(20, 9, 2, 4, (p) => { p.rect(0, 4, 4, 3, C.wood); p.rect(3, 3, 9, 3, '#4a4a52'); p.rect(3, 3, 9, 1, '#7a7a86'); p.rect(12, 4, 4, 1, C.steel); p.poly([[16, 2], [19.5, 4.5], [16, 7]], C.steel); }),
};
const EVO_TINT = { bloodreaver: '#e2434f', dawnbreaker: '#ffd35c', twinfangs: '#c873ff', skypiercer: '#cfe9ff', butcher: '#a8202a', earthshaker: '#c8a070', soulharvester: '#9ff6ff', titanknuckles: '#ffb35e', hawkeye: '#58aaff', siegeballista: '#ff9a3c', thousandedges: '#dde3ec', thunderdisc: '#fff27a', sunfire: '#ffd08a', wintersgrasp: '#9fe0ff', prismrod: '#ff8ad8', plaguegrimoire: '#8fe05c', dragonsroar: '#ff7a2a', astraleye: '#b98cff', muramasa: '#e2434f', goldenguns: '#ffd35c', thornlash: '#5aa84a' };
function evolvedHeld(id) {
  const def = WEAPON[id], base = heldWeapon(def.from), col = EVO_TINT[id] || '#ff4a6e';
  const c = mkCanvas(base.w + 2, base.h + 2), g = c.getContext('2d');
  const sil = tintOf(base, col, 'evo' + col);
  for (const [ox, oy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) g.drawImage(sil, ox, oy);
  g.drawImage(base.c, 1, 1);
  g.globalAlpha = 0.32; g.globalCompositeOperation = 'source-atop'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  return makeSprite(c, base.ax + 1, base.ay + 1);
}
for (const w of WEAPONS) if (w.evolved) HELD[w.id] = evolvedHeld;

/* ---------- icons ---------- */
Object.assign(WICON, {
  mace: (p) => { p.line(3, 14, 9, 8, C.wood); p.disc(10, 6, 3.4, C.steel2); p.disc(9, 5, 1.4, C.steel); p.px(13, 3, C.steel); p.px(14, 7, C.steel); p.px(7, 2, C.steel); },
  pistols: (p) => { p.rect(2, 4, 8, 3, '#4a4a52'); p.rect(2, 4, 8, 1, '#7a7a86'); p.rect(2, 7, 3, 4, C.wood); p.rect(6, 9, 8, 3, '#4a4a52'); p.rect(6, 9, 8, 1, '#7a7a86'); p.rect(11, 12, 3, 3, C.wood); },
  hexstaff: (p) => { p.line(3, 14, 10, 7, '#3a2a3a'); p.disc(11, 5, 3, '#8fe05c'); p.disc(11, 5, 1.3, '#e8ffd0'); p.px(14, 2, '#c873ff'); p.px(8, 3, '#c873ff'); },
  katana: (p) => { p.line(3, 13, 6, 10, '#2a2a3a'); p.line(5, 12, 7, 10, C.gold2); for (let i = 0; i < 8; i++) { p.px(7 + i, 9 - i, '#ffffff'); p.px(7 + i, 10 - i, C.steel2); } },
  lute: (p) => { p.ell(6, 10, 4.5, 4, C.wood); p.disc(6, 10, 1.3, '#3a2410'); p.line(9, 7, 13, 2, C.wood2); p.line(5, 10, 13, 3, '#f1e5cd'); },
  whip: (p) => { p.rect(2, 11, 3, 4, C.leather); for (let i = 0; i < 12; i++) p.px(4 + i * 0.9, 10 - i * 0.7 + Math.sin(i) * 1.6, '#8a5a32'); },
  chakram: (p) => { for (let i = 0; i < 28; i++) { const a = (i * TAU) / 28; p.px(8 + Math.cos(a) * 5.5, 8 + Math.sin(a) * 5.5, C.steel); p.px(8 + Math.cos(a) * 4.5, 8 + Math.sin(a) * 4.5, C.steel2); } p.disc(8, 8, 1.5, C.gold); },
  flasks: (p) => { p.rect(6, 2, 4, 3, '#b8a080'); p.ell(8, 10, 5, 4.5, '#9ad8f8'); p.ell(8, 11, 4, 3, '#c873ff'); p.px(6, 9, '#ffffff'); p.px(10, 12, '#ff9a3c'); },
  rapier: (p) => { p.line(3, 13, 5, 11, C.wood2); p.ell(6, 10, 2, 2, C.gold); p.line(7, 9, 14, 2, C.steel); p.px(14, 2, '#ffffff'); },
  harpoon: (p) => { p.rect(2, 8, 8, 3, '#4a4a52'); p.rect(2, 11, 3, 3, C.wood); p.line(10, 9, 13, 9, C.steel); p.poly([[12, 6], [15, 9], [12, 12]], C.steel); },
});
// natural weapons
Object.assign(WICON, {
  n_emberpup: (p) => { p.ell(8, 6, 6, 3, '#e8642a'); for (let i = 0; i < 4; i++) p.line(4 + i * 2.6, 7, 5 + i * 2.6, 11, '#ffffff'); p.px(8, 13, '#ffd08a'); },
  n_cinderhound: (p) => { for (let i = 0; i < 4; i++) p.ell(4 + i * 3, 8, 1.5 + i * 0.8, 1.2 + i * 0.8, ['#fff3c0', '#ffd08a', '#ff9a3c', '#e8521c'][i]); },
  n_cerberus: (p) => { for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) p.ell(4 + i * 4, 4 + r * 4, 1.4 + i * 0.6, 1.2, ['#fff3c0', '#ff9a3c', '#e8521c'][i]); },
  n_ashfang: (p) => { p.line(4, 3, 7, 13, '#f4f0e4'); p.line(9, 3, 12, 13, '#f4f0e4'); p.px(7, 13, '#e2434f'); p.px(12, 13, '#e2434f'); p.line(3, 3, 13, 3, '#ffb35e'); },
  n_mossling: (p) => { p.ell(7, 9, 3, 2.5, '#c8a060'); p.ell(7, 8, 1.4, 1, '#e8d8a0'); p.px(11, 6, '#5aa84a'); p.px(13, 4, '#5aa84a'); },
  n_thornback: (p) => { for (let i = 0; i < 3; i++) { p.line(2, 12 - i * 4, 13, 9 - i * 3, '#5aa84a'); p.px(13, 9 - i * 3, '#e8e0cc'); } },
  n_treant: (p) => { p.rect(5, 3, 6, 9, '#6a4a2a'); p.rect(5, 3, 6, 1, '#8a6a4a'); p.line(2, 14, 14, 14, '#5aa84a'); p.px(4, 13, '#5aa84a'); p.px(12, 13, '#5aa84a'); },
  n_venusmaw: (p) => { p.ell(8, 10, 4, 4, '#8fe05c'); p.ell(8, 9, 2, 2, '#e8ffd0'); p.line(8, 2, 8, 6, '#8fe05c'); },
  n_frostkit: (p) => { p.ell(8, 6, 6, 3, '#cfe6f8'); for (let i = 0; i < 4; i++) p.line(4 + i * 2.6, 7, 5 + i * 2.6, 11, '#ffffff'); p.px(8, 13, '#9fe0ff'); },
  n_rimefox: (p) => { for (let i = 0; i < 3; i++) { p.line(3, 12 - i * 4, 12, 9 - i * 4, '#cfefff'); p.px(12, 9 - i * 4, '#ffffff'); } },
  n_kitsune: (p) => { p.disc(5, 10, 2.5, '#7fc8ff'); p.disc(11, 6, 2.5, '#7fc8ff'); p.px(5, 10, '#ffffff'); p.px(11, 6, '#ffffff'); p.line(2, 13, 4, 11, '#cfe9ff'); p.line(8, 9, 10, 7, '#cfe9ff'); },
  n_snowstalker: (p) => { for (let i = 0; i < 3; i++) p.line(4 + i * 3, 2, 7 + i * 3, 14, i === 1 ? '#ffffff' : '#9fe0ff'); },
  n_sparkmite: (p) => { p.line(9, 1, 5, 8, '#fff27a'); p.line(5, 8, 10, 8, '#fff27a'); p.line(10, 8, 6, 15, '#fff27a'); },
  n_voltbeetle: (p) => { p.line(2, 3, 7, 7, '#fff27a'); p.line(7, 7, 5, 9, '#fff27a'); p.line(5, 9, 13, 13, '#9ff6ff'); p.disc(13, 13, 1, '#ffffff'); },
  n_thunderhorn: (p) => { p.poly([[2, 13], [13, 2], [9, 9]], '#dde3ec'); p.px(13, 2, '#fff27a'); p.line(3, 11, 6, 8, '#fff27a'); },
  n_stormwing: (p) => { p.line(3, 12, 12, 4, '#2a3a5a'); p.poly([[11, 3], [15, 1], [13, 6]], '#fff27a'); p.px(15, 1, '#ffffff'); },
  n_gloomling: (p) => { for (let i = 0; i < 3; i++) p.line(4 + i * 3, 3, 6 + i * 3, 13, '#b98cff'); },
  n_shade: (p) => { p.disc(9, 7, 3.6, '#4a2a6a'); p.disc(9, 7, 1.8, '#b98cff'); p.line(2, 13, 6, 10, '#4a2a6a'); },
  n_reaper: (p) => { p.line(4, 15, 8, 2, '#dde3ec'); for (let i = 0; i < 8; i++) p.px(8 + i * 0.8, 2 + Math.sin(i / 7 * 2.4) * 4, '#c873ff'); },
  n_nightmare: (p) => { p.ell(8, 8, 6, 4, '#ffffff'); p.disc(8, 8, 2.4, '#e2434f'); p.disc(8, 8, 1, '#1a1214'); },
  n_pebblet: (p) => { p.ball(8, 8, 5.5, 5, '#8a8478'); p.line(5, 6, 7, 9, '#4a463e'); p.px(11, 6, '#5fc48a'); },
  n_boulderback: (p) => { p.ball(8, 9, 6, 5, '#7a7468'); p.line(2, 3, 5, 5, '#c8bfa8'); p.line(4, 2, 6, 4, '#c8bfa8'); },
  n_titan: (p) => { p.rect(3, 3, 10, 9, '#6a6458'); p.rect(3, 3, 10, 2, '#9a9284'); p.line(1, 14, 15, 14, '#ff9a3c'); p.px(4, 13, '#ff9a3c'); p.px(12, 13, '#ff9a3c'); },
  n_crystalgolem: (p) => { for (let i = 0; i < 3; i++) p.poly([[3 + i * 4, 14], [5 + i * 4, 3 + (i % 2) * 2], [7 + i * 4, 14]], i === 1 ? '#e8d8ff' : '#8a6ac8'); },
});
function blendPx(v, col, t) {
  const r = v & 255, g = (v >> 8) & 255, b = (v >> 16) & 255, a = (v >>> 24) & 255, [cr, cg, cb] = hexRGB(col);
  return ((a << 24) | (Math.round(b + (cb - b) * t) << 16) | (Math.round(g + (cg - g) * t) << 8) | Math.round(r + (cr - r) * t)) >>> 0;
}
function evolvedIcon(id) {
  const def = WEAPON[id], col = EVO_TINT[id] || '#ff4a6e';
  return icon('w:' + id, (p) => {
    (WICON[def.from] || WICON.sword)(p);
    p.map((v) => blendPx(v, col, 0.28));
    p.px(13, 1, '#ffffff'); p.px(12, 2, col); p.px(14, 2, col); p.px(13, 3, col); p.px(2, 13, col);
  });
}
Object.assign(AICON, {
  consecrate: (p) => { p.ell(8, 11, 6, 2.5, '#ffd35c'); p.rect(7, 2, 2, 9, '#fff3c0'); p.rect(4, 5, 8, 2, '#fff3c0'); },
  flurry: (p) => { for (let i = 0; i < 4; i++) { p.rect(2 + i * 3, 4 + (i % 2) * 4, 4, 4, '#e8b48c'); p.px(5 + i * 3, 4 + (i % 2) * 4, '#ffffff'); } p.line(1, 14, 14, 14, '#ffd35c'); },
  fanhammer: (p) => { p.rect(2, 9, 7, 3, '#4a4a52'); p.rect(2, 12, 3, 3, C.wood); for (let i = 0; i < 5; i++) { const a = -0.8 + i * 0.4; p.line(10, 9, 10 + Math.cos(a) * 5, 9 + Math.sin(a) * 5, '#ffd08a'); } },
  blackhole: (p) => { p.disc(8, 8, 5.5, '#4a2a6a'); p.disc(8, 8, 3.5, '#1a0a26'); p.disc(8, 8, 1.6, '#000000'); for (let i = 0; i < 8; i++) { const a = i * 0.9; p.px(8 + Math.cos(a) * (6 - i * 0.3), 8 + Math.sin(a) * (6 - i * 0.3), '#c873ff'); } },
  iaido: (p) => { p.line(2, 13, 14, 3, '#ffffff'); p.line(2, 12, 13, 3, C.steel2); p.line(1, 15, 4, 12, '#2a2a3a'); p.px(14, 2, '#e2434f'); },
  warsong: (p) => { p.rect(5, 3, 2, 8, '#ffd35c'); p.ell(4, 11, 2.4, 1.8, '#ffd35c'); p.rect(10, 5, 2, 7, '#ffd35c'); p.ell(9, 12, 2.4, 1.8, '#ffd35c'); p.line(6, 3, 11, 5, '#ffd35c'); },
  blizzard: (p) => { p.disc(8, 6, 4, '#cfe9f7'); p.disc(5, 7, 3, '#e9f8ff'); p.disc(11, 7, 3, '#e9f8ff'); for (let i = 0; i < 5; i++) p.px(3 + i * 2.5, 12 + (i % 2) * 2, '#ffffff'); },
  quake: (p) => { p.line(1, 12, 15, 12, '#8a7a6a'); p.line(4, 12, 6, 8, '#c8bfa8'); p.line(6, 8, 8, 12, '#c8bfa8'); p.line(9, 12, 11, 6, '#c8bfa8'); p.line(11, 6, 13, 12, '#c8bfa8'); },
  clones: (p) => { p.ell(5, 9, 3, 5, '#3a2c4a'); p.ell(11, 9, 3, 5, '#3a2c4a'); p.ell(8, 8, 3, 5, '#7a5aa8'); p.px(9, 6, '#ffe08a'); p.px(6, 7, '#b98cff'); p.px(12, 7, '#b98cff'); },
  thunderstorm: (p) => { p.ell(8, 4, 6, 3, '#5a6a8a'); p.line(6, 7, 4, 11, '#fff27a'); p.line(4, 11, 7, 11, '#fff27a'); p.line(7, 11, 5, 15, '#fff27a'); p.line(11, 7, 10, 10, '#fff27a'); },
  siphon: (p) => { p.disc(4, 12, 2.5, '#e2434f'); p.line(5, 11, 11, 5, '#ff8a8a'); p.line(6, 12, 12, 6, '#e2434f'); p.disc(12, 4, 2.5, '#7dff9a'); },
  dragon: (p) => { p.ell(4, 8, 3, 3, '#c43a2a'); p.px(3, 7, '#ffe08a'); for (let i = 0; i < 4; i++) p.ell(8 + i * 2, 8, 1 + i * 0.6, 1 + i * 0.8, ['#fff3c0', '#ffd08a', '#ff9a3c', '#e8521c'][i]); },
  pounce: (p) => { for (let i = 0; i < 3; i++) p.line(3 + i * 4, 3, 5 + i * 4, 13, '#ffb35e'); p.line(1, 15, 15, 15, '#e8642a'); },
  howl: (p) => { p.ell(5, 9, 3, 2.5, '#c8401c'); p.poly([[4, 7], [3, 4], [6, 7]], '#c8401c'); for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) { const a = -0.6 + k * 0.4; p.px(9 + i * 2 + Math.cos(a) * 2, 8 + Math.sin(a) * (2 + i), '#ffb35e'); } },
  hellfire: (p) => { for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; p.line(8, 8, 8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, i % 2 ? '#ff9a3c' : '#ffd08a'); } p.disc(8, 8, 2.4, '#3a1414'); },
  blazedash: (p) => { p.line(2, 8, 13, 8, '#ff9a3c'); p.line(9, 5, 13, 8, '#ffd08a'); p.line(9, 11, 13, 8, '#ffd08a'); p.line(2, 11, 6, 11, '#e8521c'); p.line(2, 5, 6, 5, '#e8521c'); },
  overgrowth: (p) => { for (let i = 0; i < 5; i++) { p.line(2 + i * 3, 14, 3 + i * 3, 6 + (i % 2) * 3, '#5aa84a'); p.px(3 + i * 3, 5 + (i % 2) * 3, '#a8e070'); } },
  briar: (p) => { for (let i = 0; i < 10; i++) { const a = (i * TAU) / 10; p.line(8 + Math.cos(a) * 2, 8 + Math.sin(a) * 2, 8 + Math.cos(a) * 6.5, 8 + Math.sin(a) * 6.5, '#5aa84a'); } p.disc(8, 8, 1.6, '#e8e0cc'); },
  entangle: (p) => { p.line(2, 14, 6, 4, '#6a4a2a'); p.line(6, 4, 10, 10, '#6a4a2a'); p.line(10, 10, 14, 3, '#6a4a2a'); p.px(6, 4, '#5aa84a'); p.px(14, 3, '#5aa84a'); },
  devour: (p) => { p.poly([[2, 8], [14, 2], [12, 8]], '#3f9a2a'); p.poly([[2, 9], [12, 9], [14, 15]], '#3f9a2a'); p.poly([[4, 8], [12, 4], [11, 8]], '#e2434f'); p.poly([[4, 9], [11, 9], [12, 13]], '#c4303a'); },
  foxfire: (p) => { for (let i = 0; i < 3; i++) { p.disc(4 + i * 4, 10 - i * 3, 2, '#7fc8ff'); p.px(4 + i * 4, 10 - i * 3, '#ffffff'); } },
  whiteout: (p) => { for (let i = 0; i < 14; i++) p.px(2 + ((i * 5) % 12), 2 + ((i * 7) % 12), '#ffffff'); p.ell(8, 8, 4, 3, '#cfe9f7', 150); },
  snowveil: (p) => { for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; p.px(8 + Math.cos(a) * 5, 8 + Math.sin(a) * 5, '#ffffff'); p.px(8 + Math.cos(a) * 3, 8 + Math.sin(a) * 3, '#9fe0ff'); } p.disc(8, 8, 1.5, '#cfe6f8'); },
  staticfield: (p) => { for (let i = 0; i < 16; i++) { const a = (i * TAU) / 16; p.px(8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, i % 2 ? '#fff27a' : '#9ff6ff'); } p.line(6, 5, 9, 8, '#fff27a'); p.line(9, 8, 7, 11, '#fff27a'); },
  stampede: (p) => { p.ball(7, 9, 5, 3.5, '#22306a'); p.poly([[10, 7], [15, 2], [13, 8]], '#dde3ec'); p.line(1, 13, 5, 13, '#fff27a'); p.line(1, 10, 3, 10, '#fff27a'); },
  reap: (p) => { for (let i = 0; i < 12; i++) { const a = -2.6 + i * 0.3; p.px(8 + Math.cos(a) * 6, 10 + Math.sin(a) * 6, '#c873ff'); p.px(8 + Math.cos(a) * 5, 10 + Math.sin(a) * 5, '#ffffff'); } p.line(8, 10, 8, 15, '#dde3ec'); },
  terror: (p) => { p.ell(8, 8, 6, 4, '#2a1430'); p.disc(6, 7, 1.4, '#ffe08a'); p.disc(10, 7, 1.4, '#ffe08a'); p.disc(8, 10, 1, '#ff6f9c'); p.line(3, 13, 13, 13, '#e2434f'); },
  stoneskin: (p) => { p.ell(8, 9, 5, 6, '#8a8478'); p.line(5, 6, 8, 10, '#4a463e'); p.line(8, 10, 11, 7, '#4a463e'); p.rect(6, 2, 4, 2, '#c8bfa8'); },
  prism: (p) => { p.poly([[3, 13], [8, 3], [13, 13]], '#e8d8ff'); p.line(8, 6, 15, 4, '#ff6f9c'); p.line(8, 7, 15, 7, '#fff27a'); p.line(8, 8, 15, 10, '#7fc8ff'); },
});
Object.assign(RICON, {
  dragonscale: (p) => { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) p.ell(4 + i * 4 + (j % 2) * 2, 4 + j * 4, 2.4, 2, j === 1 ? '#c43a2a' : '#e8642a'); },
  diamond: (p) => { p.poly([[3, 6], [6, 3], [10, 3], [13, 6], [8, 14]], '#e2434f'); p.line(3, 6, 13, 6, '#ff8a8a'); p.px(6, 4, '#ffffff'); },
  moons: (p) => { p.disc(5, 6, 3.5, '#e8e0cc'); p.disc(6, 5, 2.5, '#00000000'); p.disc(11, 11, 3, '#cfe9f7'); p.disc(12, 10, 2, '#00000000'); },
  crown: (p) => { p.rect(3, 8, 10, 5, C.gold); p.poly([[3, 8], [3, 3], [6, 7]], C.gold); p.poly([[8, 8], [8, 2], [10, 7]], C.gold); p.poly([[13, 8], [13, 3], [10, 7]], C.gold); p.px(8, 10, '#e2434f'); p.px(5, 10, '#58aaff'); p.px(11, 10, '#74d672'); },
  necronomicon: (p) => { p.rect(3, 2, 10, 12, '#4a3a2a'); p.rect(4, 3, 8, 10, '#6a5a44'); p.ell(8, 7, 2.6, 2.4, C.bone); p.px(7, 7, '#1a1214'); p.px(9, 7, '#1a1214'); p.line(6, 11, 10, 11, '#8fe05c'); },
  dice: (p) => { p.rect(2, 4, 8, 8, '#f1e5cd'); p.px(4, 6, '#1a1214'); p.px(7, 9, '#1a1214'); p.rect(8, 2, 6, 6, '#e2434f'); p.px(10, 4, '#ffffff'); p.px(12, 6, '#ffffff'); },
  hydra: (p) => { p.line(8, 14, 8, 6, '#3f9a2a'); p.line(8, 9, 4, 4, '#3f9a2a'); p.line(8, 9, 12, 4, '#3f9a2a'); for (const [x, y] of [[4, 4], [8, 6], [12, 4]]) { p.disc(x, y - 1, 1.6, '#5fc48a'); p.px(x, y - 2, '#e2434f'); } },
  voidshard: (p) => { p.poly([[8, 1], [12, 8], [8, 15], [4, 8]], '#2a1440'); p.line(8, 2, 8, 14, '#c873ff'); p.px(6, 6, '#c873ff'); },
  icarus: (p) => { p.line(8, 4, 2, 9, '#ffd08a'); p.line(8, 4, 14, 9, '#ffd08a'); for (let i = 0; i < 4; i++) { p.line(8 - i * 1.5, 5 + i, 3 - i * 0.5, 11, '#ffffff'); p.line(8 + i * 1.5, 5 + i, 13 + i * 0.5, 11, '#ffffff'); } p.px(8, 13, '#ff7a2a'); },
  phylactery: (p) => { p.rect(6, 1, 4, 3, C.gold2); p.ell(8, 9, 4.5, 5.5, '#1a3a2a'); p.ell(8, 9, 2.5, 3.5, '#7dff9a'); p.px(7, 7, '#ffffff'); },
  stormcrown: (p) => { p.rect(3, 9, 10, 4, '#3a5e9a'); for (let i = 0; i < 3; i++) p.poly([[3 + i * 4, 9], [5 + i * 4, 4], [7 + i * 4, 9]], '#5a7ec0'); p.line(9, 1, 7, 6, '#fff27a'); },
  ragemask: (p) => { p.ell(8, 8, 6, 6.5, '#c43a2a'); p.line(4, 6, 7, 7, '#1a0808'); p.line(12, 6, 9, 7, '#1a0808'); p.rect(5, 11, 6, 2, '#1a0808'); p.px(6, 11, '#ffffff'); p.px(9, 11, '#ffffff'); },
  midastouch: (p) => { p.rect(4, 5, 7, 9, C.gold); p.rect(4, 5, 7, 2, '#fff0a0'); for (let i = 0; i < 4; i++) p.rect(4 + i * 2, 2, 1, 4, C.gold); p.px(13, 3, '#ffffff'); p.px(14, 6, '#fff0a0'); },
  frozenheart: (p) => { p.disc(6, 6, 3, '#9fe0ff'); p.disc(10, 6, 3, '#9fe0ff'); p.line(3, 8, 8, 14, '#9fe0ff'); p.line(13, 8, 8, 14, '#9fe0ff'); p.ell(8, 9, 3, 3, '#9fe0ff'); p.px(6, 5, '#ffffff'); p.line(8, 4, 8, 11, '#e9f8ff'); },
  cursedblade: (p) => { p.line(3, 13, 12, 4, '#5a1a2a'); p.line(4, 13, 13, 4, '#8a2a3a'); p.line(3, 10, 6, 13, '#2a0a10'); p.px(13, 3, '#e2434f'); p.px(9, 9, '#e2434f'); },
  batfamiliar: (p) => { p.poly([[7, 7], [1, 3], [2, 9]], '#c43a5a'); p.poly([[9, 7], [15, 3], [14, 9]], '#c43a5a'); p.disc(8, 8, 2.5, '#6a1a2a'); p.px(7, 8, '#ffe08a'); p.px(9, 8, '#ffe08a'); },
  meteorcharm: (p) => { p.disc(10, 10, 3.5, '#ff7a2a'); p.disc(10, 10, 1.8, '#ffd08a'); p.line(2, 2, 7, 7, '#ffb35e'); p.disc(4, 12, 1.5, C.gold); },
  chaoseye: (p) => { p.ell(8, 8, 6.5, 4.5, '#ff4ad0'); p.disc(8, 8, 2.6, '#1a0a1a'); p.disc(8, 8, 1, '#fff27a'); for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; p.px(8 + Math.cos(a) * 7, 8 + Math.sin(a) * 6, '#c873ff'); } },
  clover: (p) => { p.disc(5, 5, 2.6, '#5fc48a'); p.disc(11, 5, 2.6, '#5fc48a'); p.disc(5, 10, 2.6, '#5fc48a'); p.disc(11, 10, 2.6, '#5fc48a'); p.line(8, 8, 10, 15, '#3f9a2a'); p.px(8, 8, '#a8e070'); },
  sands: (p) => { p.rect(4, 1, 8, 2, C.gold2); p.rect(4, 13, 8, 2, C.gold2); p.poly([[5, 3], [11, 3], [8, 8]], '#cfe9f7'); p.poly([[8, 8], [5, 13], [11, 13]], '#cfe9f7'); p.rect(6, 10, 4, 3, '#ffd35c'); p.px(8, 7, '#ffd35c'); },
  atlas: (p) => { p.rect(2, 3, 12, 10, '#c8a870'); p.line(2, 3, 2, 13, '#8a6a3a'); p.line(5, 6, 9, 9, '#8a3a2a'); p.line(9, 9, 12, 6, '#8a3a2a'); p.px(12, 6, '#e2434f'); p.rect(4, 11, 2, 1, '#5a4a32'); },
});
const _metaIcon = metaIcon;
metaIcon = function (id) {
  const extra = { bond: () => icon('m:bond', (p) => { p.disc(5, 6, 3, '#e8642a'); p.disc(11, 6, 3, '#5aa84a'); p.line(3, 8, 8, 14, '#ff6f9c'); p.line(13, 8, 8, 14, '#ff6f9c'); p.ell(8, 10, 3, 3, '#ff6f9c'); }), armory: () => weaponIcon('greatsword'), sense: () => relicIcon('atlas'), combo: () => icon('m:combo', (p) => { p.rect(2, 4, 3, 9, '#ffd35c'); p.rect(6, 6, 3, 7, '#ffb35e'); p.rect(10, 2, 3, 11, '#ff7a3c'); p.px(14, 2, '#ffffff'); }), chaos: () => relicIcon('chaoseye'), heirloom: () => relicIcon('crown') };
  return extra[id] ? extra[id]() : _metaIcon(id);
};

/* ---------- new monsters (facing right; frames: step A, step B, attack) ---------- */
Object.assign(MON, {
  boneknight(p, f) {
    const B = C.bone, B2 = shade(B, -0.2), lf = f === 1 ? 1 : 0;
    rigOrient(p, 'front', 0.9); rigPart(p, 'leg'); p.line(7, 15, 6 - lf, 19, B2); p.line(10, 15, 11 + lf, 19, B2); p.rect(5 - lf, 19, 3, 1, '#3a3a42'); p.rect(10 + lf, 19, 3, 1, '#3a3a42');
    rigPart(p, 'body'); p.rect(5, 9, 8, 7, '#5a5a6a'); p.rect(5, 9, 8, 1, '#8a8a9a'); p.rect(5, 13, 8, 1, '#3a3a46'); p.px(8, 11, '#7a2a32');
    rigPart(p, 'head'); p.ell(9, 5, 3.8, 3.4, '#7a7a8a'); p.rect(5, 2, 8, 2, '#9a9aaa'); rigPart(p, 'face'); p.rect(6, 5, 7, 1, '#1a0a10'); p.px(10, 5, EYE_RED); p.px(12, 5, EYE_RED); rigPart(p, 'head'); p.rect(8, 0, 2, 2, '#7a2a32');
    const up = f === 2 ? -5 : 0;
    rigPart(p, 'gear'); p.line(4, 11, 2, 7 + up, '#c8c8d0'); p.line(3, 11, 1, 7 + up, '#9a9aa8'); p.px(4, 12, C.gold2);
    rigPart(p, 'body'); p.rect(12, 8, 5, 9, '#4a4a5a'); p.rect(12, 8, 5, 1, '#8a8a9a'); p.rect(13, 10, 3, 4, '#7a2a32'); p.px(14, 11, B);
  },
  crawler(p, f) {
    const B = '#c8c0a8', B2 = shade(B, -0.25), a = f === 1 ? 1 : f === 2 ? -1 : 0;
    rigOrient(p, 'side'); rigPart(p, 'leg:n'); p.line(12, 7, 15, 11 + a, B2); rigPart(p, 'leg:f'); p.line(12, 8, 13, 11 - a, B2);
    rigPart(p, 'body'); p.ell(7, 8, 5, 2.6, '#7a6a5a'); for (let i = 0; i < 4; i++) p.line(4 + i * 2, 6, 4 + i * 2, 10, B);
    rigPart(p, 'tail'); p.line(2, 8, 0, 10, B2);
    rigPart(p, 'head'); p.ell(13, 6, 2.8, 2.6, B); p.px(14, 5, EYE_RED); p.px(15, 7, '#3a1a1a');
    if (f === 2) { p.line(14, 8, 15, 9, '#e8e0cc'); }
  },
  banshee(p, f) {
    const c = '#cfe0f0', a = 200;
    rigOrient(p, 'front', { depth: 0.7, float: true });
    for (let i = 0; i < 5; i++) p.line(3 + i * 2, 12, 2 + i * 2 + (f + i) % 2, 19, shade(c, -0.15), 170);
    p.poly([[4, 7], [12, 7], [14, 15], [2, 15]], c, a);
    rigPart(p, 'head'); p.ell(8, 5, 3.4, 3.6, '#e8f0f8', 230);
    p.line(4, 3, 1, 10, '#e9f8ff'); p.line(5, 2, 2, 12, '#ffffff', 200); p.line(11, 3, 14, 9, '#e9f8ff');
    rigPart(p, 'face'); p.px(7, 5, '#1a2a3a'); p.px(10, 5, '#1a2a3a');
    p.rect(8, 7, 2, f === 2 ? 3 : 1, '#1a2a3a');
    rigPart(p, 'arm'); const arm = f === 2 ? -3 : 0;
    p.line(12, 9, 15, 7 + arm, '#e9f8ff'); p.line(4, 9, 1, 11, '#e9f8ff');
  },
  firefly(p, f) {
    const up = f % 2 === 0;
    rigOrient(p, 'side'); rigPart(p, 'wing:f'); p.ell(4, up ? 3 : 5, 3, up ? 2.2 : 1.4, '#e9f8ff', 160); rigPart(p, 'wing:n'); p.ell(8, up ? 2 : 4, 3, up ? 2.2 : 1.4, '#e9f8ff', 140);
    rigPart(p, 'body'); p.ball(4, 6, 2.6, 2.2, '#d8ff6a', 0.5, -0.2); p.px(3, 6, '#ffffff');
    rigPart(p, 'head'); p.disc(8, 6, 2, '#3a3a2a'); p.px(9, 5, '#ff4a4a'); p.line(9, 4, 11, 2, '#3a3a2a');
  },
  toad(p, f) {
    const c = '#5a8a3a', d = shade(c, -0.3), sq = f === 1 ? 1 : 0;
    rigOrient(p, 'side', 1.1);
    p.ell(4, 13, 3, 1.4, d); p.ell(13, 13, 2.4, 1.2, d);
    p.ball(9, 9 + sq, 7.5, 5 - sq * 0.5, c, 0.25, -0.3);
    p.ell(9, 11 + sq, 5, 2.4, '#c8d880');
    for (let i = 0; i < 4; i++) p.px(5 + i * 2.6, 7 + (i % 2) + sq, d);
    rigPart(p, 'head'); p.disc(12, 4 + sq, 2.2, c); p.disc(15, 5 + sq, 2, c); p.px(12, 4 + sq, '#ffe08a'); p.px(15, 5 + sq, '#ffe08a'); p.px(12, 3 + sq, '#1a1214'); p.px(15, 4 + sq, '#1a1214');
    p.line(10, 9 + sq, 17, 8 + sq, '#2a3a1a');
    if (f === 2) { p.rect(16, 8, 3, 2, '#e2607a'); }
  },
  shroombrute(p, f) {
    const cap = '#c43a3a', st = '#e8dcc6', up = f === 2 ? -5 : 0, l = f === 1 ? 1 : 0;
    rigOrient(p, 'front', 1); rigPart(p, 'leg'); p.rect(8, 21 - l, 4, 4 + l, shade(st, -0.25)); p.rect(15, 21 - (1 - l), 4, 4 + (1 - l), shade(st, -0.25));
    rigPart(p, 'body'); p.ball(13, 16, 8, 6, st, 0.2, -0.25);
    rigPart(p, 'arm'); p.rect(3, 12 + up, 5, 9, shade(st, -0.1)); p.rect(19, 12 + up, 5, 9, shade(st, -0.1)); p.rect(2, 19 + up, 6, 4, '#8a7a68'); p.rect(19, 19 + up, 6, 4, '#8a7a68');
    rigPart(p, 'head'); p.ball(13, 8, 12, 6.5, cap, 0.3, -0.3); p.rect(2, 11, 22, 2, shade(cap, -0.35));
    for (const [x, y] of [[7, 6], [13, 4], [19, 7], [10, 9], [17, 10]]) p.ell(x, y, 1.6, 1.1, '#f4e8d8');
    rigPart(p, 'face'); p.rect(15, 15, 2, 2, '#1a0a14'); p.rect(19, 15, 2, 2, '#1a0a14'); p.px(16, 15, '#c8ff6a'); p.px(20, 15, '#c8ff6a');
  },
  frostmage(p, f) {
    const r = '#5a8ab8', l = f === 1 ? 1 : 0;
    rigOrient(p, 'front', { depth: 0.8, float: true });
    p.poly([[5, 8], [11, 8], [13.5, 20], [2.5, 20]], r); p.rect(3, 19, 11, 1, shade(r, -0.3)); p.line(8, 9, 8, 19, '#cfe9f7');
    rigPart(p, 'head'); p.poly([[8, 0], [12, 7], [4, 7]], shade(r, 0.15)); p.disc(8, 6, 3.6, shade(r, -0.1)); rigPart(p, 'face'); p.ell(9, 7, 2.2, 1.8, '#0a1422'); p.px(9, 7, '#9ff6ff'); p.px(11, 7, '#9ff6ff');
    const sy = f === 2 ? -4 : 0;
    rigPart(p, 'gear'); p.line(13, 20, 13, 6 + sy, '#cfe9f7'); p.poly([[13, 2 + sy], [15, 5 + sy], [13, 8 + sy], [11, 5 + sy]], C.ice); p.px(13, 4 + sy, '#ffffff');
    rigPart(p, 'body'); p.px(3, 13 + l, '#cfe9f7');
  },
  mammoth(p, f) {
    const c = '#7a5a3a', d = shade(c, -0.3), l = f === 1 ? 1 : 0;
    rigOrient(p, 'side');
    for (const [x, o] of [[5, l], [10, -l], [17, l], [22, -l]]) { rigPart(p, x === 5 || x === 17 ? 'leg:f' : 'leg:n'); p.rect(x, 17 + o, 4, 7 - o, d); }
    rigPart(p, 'body');
    p.ball(14, 12, 12, 8, c, 0.25, -0.3);
    for (let i = 0; i < 10; i++) p.px(4 + i * 2.2, 6 + (i % 3), shade(c, 0.2));
    rigPart(p, 'head'); p.ball(24, 11, 5, 5, c, 0.25, -0.3);
    p.line(27, 13, 28, 20 + (f === 2 ? -6 : 0), shade(c, -0.1)); p.line(28, 13, 29, 20 + (f === 2 ? -6 : 0), d);
    p.line(23, 15, 27, 18, '#f4f0e4'); p.line(27, 18, 29, 16, '#f4f0e4'); p.line(22, 15, 26, 19, '#d8d0c0');
    p.px(25, 9, '#1a1214'); p.ell(21, 9, 2, 3, d);
    rigPart(p, 'tail'); p.line(2, 10, 0, 14, d);
  },
  elemental(p, f) {
    const fl = f % 2;
    rigOrient(p, 'front', { depth: 0.9, float: true });
    p.poly([[8, 19], [3, 12], [4, 6], [6, 9], [8, 2 + fl], [10, 8], [12, 5], [13, 12]], '#e8521c');
    p.poly([[8, 17], [5, 12], [6, 8], [8, 6 + fl], [10, 9], [11, 12]], '#ff9a3c');
    p.ell(8, 12, 2.4, 3, '#ffd08a'); p.px(7, 9, '#fff3c0');
    rigPart(p, 'face'); p.px(7, 10, '#1a0808'); p.px(10, 10, '#1a0808');
    rigPart(p, 'body'); if (f === 2) { p.disc(14, 6, 1.6, '#ffd08a'); p.disc(2, 6, 1.6, '#ffd08a'); }
  },
  hellhound(p, f) {
    const c = '#3a1a1a', d = shade(c, -0.3), l = f === 1 ? 1 : 0;
    rigOrient(p, 'side'); rigPart(p, 'leg:f'); p.line(5, 9, 4 - l, 13, d); rigPart(p, 'leg:n'); p.line(8, 9, 8 + l, 13, d); rigPart(p, 'leg:f'); p.line(13, 9, 12 - l, 13, d); rigPart(p, 'leg:n'); p.line(15, 9, 16 + l, 13, d);
    rigPart(p, 'tail'); p.line(4, 7, 0, 4 - l, '#ff7a2a'); p.px(0, 3, '#ffd08a');
    rigPart(p, 'body'); p.ball(10, 7, 6.5, 3.2, c, 0.3, -0.3);
    for (let i = 0; i < 5; i++) p.px(6 + i * 2, 3 + (i % 2), i % 2 ? '#ffd08a' : '#ff7a2a');
    rigPart(p, 'head'); p.ell(16, 5, 3.4, 2.8, c); p.rect(18, 5, 3, 2, shade(c, 0.1)); p.px(21, 5, '#1a0808');
    p.poly([[14, 1], [16, 3], [14, 4]], c); p.px(17, 4, '#ffd35c');
    if (f === 2) { p.rect(19, 7, 3, 1, '#ffd08a'); p.px(21, 8, '#ff7a2a'); }
  },
  mimic(p, f) {
    const body = '#8a5a32', band = '#5a3a1e', open = f === 2 ? 5 : f === 1 ? 2 : 1;
    rigOrient(p, 'front', 0.8);
    p.rect(1, 9, 16, 6, body); p.rect(1, 14, 16, 1, shade(body, -0.35));
    rigPart(p, 'head'); p.rect(1, 9 - open - 3, 16, 4, shade(body, 0.12)); p.rect(1, 9 - open - 3, 16, 1, shade(body, 0.3));
    rigPart(p, 'face'); p.rect(2, 9 - open + 1, 14, open, '#2a0808'); p.rect(4, 9 - open + 1, 10, Math.max(1, open - 2), '#c43a5a');
    for (let i = 0; i < 6; i++) { p.px(2 + i * 2.6, 9 - open + 1, '#ffffff'); p.px(3 + i * 2.6, 8, '#ffffff'); }
    rigPart(p, 'body'); p.rect(3, 9 - open - 3, 2, 4 + open + 6, band); p.rect(13, 9 - open - 3, 2, 4 + open + 6, band);
    rigPart(p, 'head'); p.px(6, 9 - open - 2, '#ffe08a'); p.px(11, 9 - open - 2, '#ffe08a');
    rigPart(p, 'face'); if (f === 2) p.line(9, 9, 13, 12, '#e2607a');
  },
  clone(p, f) {
    const c = '#2a2036', l = f === 1 ? 1 : 0;
    rigOrient(p, 'front', 0.8); rigPart(p, 'leg'); p.rect(5, 15 - l, 2, 5, c); p.rect(9, 15 - (1 - l), 2, 5, c);
    rigPart(p, 'body'); p.rect(4, 9, 8, 7, '#3a2c4a'); rigPart(p, 'head'); p.ell(8, 5, 3.5, 3.6, '#3a2c4a'); rigPart(p, 'face'); p.px(9, 5, '#b98cff'); p.px(11, 5, '#b98cff');
    rigPart(p, 'arm'); const up = f === 2 ? -4 : 0; p.line(12, 11, 15, 8 + up, '#9a8ab8'); p.line(3, 11, 2, 15, c);
  },
});
Object.assign(MON_SIZE, { boneknight: [18, 21], crawler: [17, 13], banshee: [16, 21], firefly: [12, 10], toad: [20, 16], shroombrute: [27, 26], frostmage: [16, 21], mammoth: [31, 25], elemental: [16, 20], hellhound: [23, 14], mimic: [18, 17], clone: [16, 21] });
Object.assign(ENEMIES.elemental, { glow: ['#ff8a3c', 34] });
Object.assign(ENEMIES.firefly, { glow: ['#d8ff6a', 22] });
Object.assign(ENEMIES.banshee, { glow: ['#cfe9f7', 26] });
Object.assign(ENEMIES.hellhound, { glow: ['#ff7a2a', 24] });
Object.assign(ENEMIES.frostmage, { glow: ['#9fe0ff', 22] });

