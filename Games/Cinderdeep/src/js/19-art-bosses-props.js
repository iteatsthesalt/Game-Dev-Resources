/* ============================================================
   Cinderdeep — more art: the four new bosses, props, missiles,
   ability effects, hidden walls, souls and machine elves
   ============================================================ */
const DRAW_PROJ = {};   // missile kind -> draw(g, pr, ang) with the canvas at the missile
const BOSS_DRAW = {};   // boss kind -> draw(g, e, x, y, alpha, white, cx, cy)
function pxLine(g, x0, y0, x1, y1, col, w = 1) {
  g.fillStyle = col;
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) { const t = i / n; g.fillRect(Math.round(x0 + (x1 - x0) * t - w / 2), Math.round(y0 + (y1 - y0) * t - w / 2), w, w); }
}

/* ---------- boss parts ---------- */
Object.assign(BOSS_PARTS, {
  lich(f) {
    const p = new PP(36, 52), robe = '#1c2630', robe2 = '#2c3e4c', bone = '#e8e0cc', glow = '#9ff6ff', up = f === 1 ? -4 : 0;
    for (let i = 0; i < 12; i++) p.line(14 - i * 0.4, 9 + i, 5 - i * 0.25 + Math.sin(i * 0.9 + f) * 1.5, 18 + i * 1.7, i % 2 ? '#a8d8e8' : '#e9f8ff', 190);
    p.poly([[11, 17], [24, 17], [29, 48], [25, 45], [21, 50], [17, 46], [13, 50], [9, 45], [5, 48]], robe);
    p.poly([[13, 17], [22, 17], [23, 33], [12, 33]], robe2);
    p.line(17, 33, 17, 48, shade(robe, -0.3));
    for (let i = 0; i < 4; i++) p.line(14, 20 + i * 2.5, 21, 20 + i * 2.5, i % 2 ? shade(bone, -0.15) : bone);
    p.line(17, 19, 17, 29, shade(bone, -0.25));
    p.ball(18, 12, 5, 5, bone, 0.25, -0.25); p.rect(15, 15, 6, 2, shade(bone, -0.15));
    p.disc(16, 12, 1.4, '#06121a'); p.disc(20, 12, 1.4, '#06121a'); p.px(16, 12, glow); p.px(20, 12, glow);
    p.px(18, 14, '#06121a'); for (let i = 0; i < 3; i++) p.px(16 + i * 2, 16, '#06121a');
    p.rect(13, 7, 10, 2, C.gold); for (let i = 0; i < 4; i++) p.poly([[13 + i * 3, 7], [14.5 + i * 3, 3 + (i % 2)], [16 + i * 3, 7]], C.gold);
    p.px(18, 6, '#e2434f'); p.px(15, 7, glow); p.px(21, 7, glow);
    p.line(11, 19, 7, 26 + up, robe2); p.line(10, 19, 6, 26 + up, robe); p.rect(5, 26 + up, 3, 2, bone);
    p.line(24, 19, 28, 24 + up, robe2); p.rect(27, 24 + up, 3, 2, bone);
    p.line(29, 49, 29, 12 + up, '#3a3a4a'); p.line(30, 49, 30, 12 + up, '#5a5a6a');
    p.disc(29.5, 9 + up, 3, glow); p.disc(29.5, 9 + up, 1.4, '#ffffff');
    p.outline(); return p.sprite(17, 50);
  },
  lich_orb() { const p = new PP(9, 9); p.ell(4, 4, 3, 3, '#cfe9f0'); p.px(3, 4, '#06121a'); p.px(5, 4, '#06121a'); p.px(4, 6, '#06121a'); p.outline('#2a6a8a'); return p.sprite(4, 4); },
  brood_body(f) {
    const p = new PP(66, 40), c = '#2e2638', c2 = '#463a58';
    p.ball(21, 19, 19, 15, c, 0.3, -0.35);
    for (let i = 0; i < 5; i++) p.line(8 + i * 6, 8 + (i % 2) * 2, 10 + i * 6, 30 - (i % 2) * 2, shade(c, 0.12));
    p.poly([[17, 10], [25, 10], [21, 17]], '#c43a4a'); p.poly([[21, 17], [17, 24], [25, 24]], '#c43a4a');
    for (const [x, y] of [[9, 15], [33, 16], [12, 26], [30, 27], [21, 31]]) p.disc(x, y, 1.6, '#8fe05c');
    p.px(2, 22, '#e8e8f0'); p.px(3, 24, '#e8e8f0');
    p.ball(44, 24, 10, 8, c2, 0.3, -0.3);
    p.ball(55, 26, 7, 6, c, 0.3, -0.3);
    for (const [x, y] of [[54, 22], [57, 23], [51, 23], [56, 26], [53, 25], [59, 26], [52, 21], [58, 21]]) p.px(x, y, '#ff4a4a');
    const op = f === 1 ? 2 : 0;
    p.line(58, 30, 60 + op, 36, '#e8e0cc'); p.line(55, 31, 55, 37 + op, '#e8e0cc');
    p.outline(); return p.sprite(33, 36);
  },
  giant(f) {
    const p = new PP(52, 64), skin = '#7aa8c8', fur = '#e8eef6', dk = shade(skin, -0.3), l = f === 1 ? 1 : 0;
    p.rect(15, 44, 8, 14 - l, dk); p.rect(29, 44, 8, 13 + l, dk);
    p.ell(19, 59 - l, 6, 3.5, fur); p.ell(33, 58 + l, 6, 3.5, fur);
    p.poly([[12, 38], [40, 38], [42, 48], [10, 48]], '#8a6a4a'); for (let i = 0; i < 9; i++) p.px(11 + i * 3.6, 48, '#5a4030');
    p.poly([[11, 17], [41, 17], [39, 39], [13, 39]], skin);
    p.rect(11, 17, 4, 22, shade(skin, 0.15)); p.line(26, 21, 26, 36, dk); p.line(19, 27, 33, 27, dk);
    p.line(13, 18, 39, 36, '#5a4030'); p.line(13, 19, 38, 37, '#5a4030');
    p.ell(13, 18, 7, 4.5, fur); p.ell(39, 18, 7, 4.5, fur);
    p.ball(26, 11, 7.5, 7.5, skin, 0.25, -0.25);
    p.poly([[18, 13], [34, 13], [31, 26], [26, 30], [21, 26]], '#f4f8fc'); p.line(26, 16, 26, 28, '#cfdae6');
    p.rect(19, 5, 14, 3, '#9aa8b8'); p.rect(19, 5, 14, 1, '#c8d2de');
    p.poly([[19, 6], [12, 0], [17, 8]], '#e8e0cc'); p.poly([[33, 6], [40, 0], [35, 8]], '#e8e0cc');
    p.rect(21, 10, 3, 2, '#0a1a2a'); p.rect(28, 10, 3, 2, '#0a1a2a'); p.px(22, 10, '#9ff6ff'); p.px(29, 10, '#9ff6ff');
    p.rect(5, 19, 7, 17, skin); p.rect(4, 34, 9, 6, dk);
    p.outline(); return p.sprite(26, 62);
  },
  giant_club() {
    const p = new PP(44, 18);
    p.rect(0, 7, 15, 4, '#6a4a2a'); p.rect(0, 7, 15, 1, '#8a6a4a');
    p.poly([[14, 4], [40, 1], [43, 9], [40, 17], [14, 13]], '#9fd8f0');
    p.line(17, 6, 38, 3, '#e9f8ff'); p.line(17, 11, 38, 14, '#6aa8cc');
    for (let i = 0; i < 4; i++) p.poly([[20 + i * 6, 3], [22 + i * 6, 0], [24 + i * 6, 3]], '#cfefff');
    p.outline(); return p.sprite(3, 9);
  },
  dragon_body() {
    const p = new PP(80, 48), c = '#8a2a1e', c2 = '#b8402a', belly = '#e8a04a', dk = '#3a1210';
    for (let i = 0; i < 18; i++) { const t = i / 17; p.disc(28 - i * 1.45, 32 - Math.sin(t * 3.2) * 7 + i * 0.25, Math.max(1, 5.5 * (1 - t) + 0.8), i % 3 === 0 ? shade(c, -0.15) : c); }
    p.poly([[4, 27], [0, 22], [1, 29], [7, 30]], dk);
    p.ell(32, 38, 5, 7, shade(c, -0.3)); p.rect(29, 42, 7, 4, dk);
    p.ell(54, 38, 4, 7, shade(c, -0.3)); p.rect(52, 42, 7, 4, dk);
    p.ball(44, 29, 19, 11, c, 0.3, -0.3);
    p.ell(46, 34, 14, 5, belly); for (let i = 0; i < 6; i++) p.line(36 + i * 4, 31, 37 + i * 4, 38, shade(belly, -0.2));
    for (let i = 0; i < 8; i++) { const x = 30 + i * 4, y0 = 19 + Math.abs(i - 3.5) * 0.7; p.poly([[x - 1.5, y0 + 1], [x, y0 - 5 + (i % 2)], [x + 1.5, y0 + 1]], dk); }
    p.ell(36, 39, 5, 7, c); p.rect(32, 43, 8, 4, dk); p.px(32, 47, '#e8e0cc'); p.px(35, 47, '#e8e0cc');
    p.ell(58, 39, 4, 7, c); p.rect(55, 43, 8, 4, dk); p.px(62, 47, '#e8e0cc');
    for (let i = 0; i < 6; i++) p.disc(60 + i * 2.6, 26 - i * 3, 5.5 - i * 0.3, i % 2 ? c : c2);
    p.outline(); return p.sprite(44, 47);
  },
  dragon_head(f) {
    const p = new PP(36, 28), c = '#a8321e', dk = '#3a1210', open = f === 1 ? 5 : 0, oy = 2;
    p.poly([[6, 6], [0, 1], [9, 10]], '#e8e0cc'); p.poly([[10, 5], [6, 0], [12, 9]], '#d8d0c0');
    p.ball(12, 12 + oy, 9, 7.5, c, 0.3, -0.3);
    p.poly([[15, 7 + oy], [34, 10 + oy], [34, 13 + oy], [15, 14 + oy]], c); p.line(18, 8 + oy, 33, 10 + oy, shade(c, 0.2));
    p.poly([[15, 15 + oy], [32, 15 + oy + open], [32, 18 + oy + open], [15, 19 + oy]], shade(c, -0.2));
    if (open) { p.poly([[17, 14 + oy], [33, 13 + oy], [31, 15 + oy + open], [17, 16 + oy]], '#3a0808'); p.rect(20, 14 + oy, 10, 1, '#ffd08a'); }
    for (let i = 0; i < 5; i++) { p.px(19 + i * 3, 14 + oy, '#ffffff'); p.px(20 + i * 3, 15 + oy + open, '#ffffff'); }
    p.px(32, 10 + oy, dk);
    p.rect(13, 9 + oy, 3, 2, '#ffd35c'); p.px(14, 9 + oy, '#1a0808');
    p.outline(); return p.sprite(10, 13 + oy);
  },
  dragon_wing(f) {
    const p = new PP(64, 48), mem = '#5a1a14', mem2 = '#7a2a1a', bone = '#2a0c0a';
    if (f === 0) {
      p.poly([[34, 46], [6, 6], [16, 18], [26, 4], [36, 16], [50, 2], [46, 20], [62, 14], [48, 46]], mem);
      p.poly([[34, 46], [16, 18], [26, 4], [36, 16], [40, 46]], mem2);
      for (const [ex, ey] of [[6, 6], [26, 4], [50, 2], [62, 14]]) p.line(36, 46, ex, ey, bone);
      p.outline(); return p.sprite(36, 46);
    }
    p.poly([[34, 4], [2, 30], [14, 30], [16, 44], [30, 36], [38, 46], [46, 34], [60, 40], [50, 6]], mem);
    p.poly([[34, 4], [16, 44], [30, 36], [38, 46], [42, 8]], mem2);
    for (const [ex, ey] of [[2, 30], [16, 44], [38, 46], [60, 40]]) p.line(36, 4, ex, ey, bone);
    p.outline(); return p.sprite(36, 4);
  },
});
Object.assign(BOSS_DRAW, {
  lich(g, e, x, y, a, w) {
    if (e.hidden) { if (Math.random() < 0.5) { g.fillStyle = 'rgba(159,246,255,0.6)'; g.fillRect(Math.round(x + rnd(-8, 8)), Math.round(y - rnd(0, 30)), 1, 2); } return; }
    const bob = Math.sin(G.t * 2) * 3, fy = y - 6 + bob;
    drawSprite(g, bossPart('lich', e.pose === 2 ? 1 : 0), x, fy, e.face < 0, { alpha: a * (e.fadeA ?? 1), white: w, outline: e.phase >= 3 ? '#9ff6ff' : null });
    const n = e.orbN || 0;
    for (let i = 0; i < n; i++) { const ang = G.t * 2.2 + (i * TAU) / n; drawSprite(g, bossPart('lich_orb'), x + Math.cos(ang) * 24, fy - 26 + Math.sin(ang) * 10, false, { alpha: a }); }
  },
  brood(g, e, x, y, a, w) {
    const fl = e.face < 0 ? -1 : 1, t = e.anim * (e.st === 'charge' ? 14 : 6);
    const leg = (i, far) => {
      const sw = Math.sin(t + i * 1.7 + (far ? Math.PI : 0)) * 3;
      const rx = x + fl * (2 + i * 4), ry = y - 12;
      const kx = rx + fl * (i - 1.5) * 9 + sw, ky = y - 27 - Math.abs(i - 1.5) * 2 + (far ? 2 : 0);
      const fx = rx + fl * (i - 1.5) * 15 + sw * 1.4, fy = y + (far ? -3 : 3);
      const col = w ? '#ffffff' : far ? '#120c18' : '#2e2638';
      pxLine(g, rx, ry, kx, ky, col, 2); pxLine(g, kx, ky, fx, fy, col, 2);
    };
    for (let i = 0; i < 4; i++) leg(i, true);
    drawSprite(g, bossPart('brood_body', e.pose === 2 ? 1 : 0), x, y, e.face < 0, { alpha: a, white: w, outline: e.phase >= 3 ? '#c8ff6a' : null });
    for (let i = 0; i < 4; i++) leg(i, false);
  },
  giant(g, e, x, y, a, w) {
    const walk = Math.hypot(e.vx || 0, e.vy || 0) > 5 ? Math.floor(G.t * 4) % 2 : 0;
    const club = bossPart('giant_club'), fl = e.face < 0;
    const ang = e.clubA != null ? e.clubA : fl ? Math.PI + 0.7 : -0.7;
    const back = Math.sin(ang) < -0.2;
    const drawClub = () => { g.save(); g.translate(Math.round(x + (fl ? -18 : 18)), Math.round(y - 30)); g.rotate(ang); if (Math.cos(ang) < 0) g.scale(1, -1); g.globalAlpha = a; g.drawImage(w ? whiteOf(club) : club.c, -club.ax, -club.ay); g.restore(); };
    if (back) drawClub();
    drawSprite(g, bossPart('giant', walk), x, y, fl, { alpha: a, white: w, outline: e.phase >= 3 ? '#9ff6ff' : null });
    if (!back) drawClub();
  },
  dragon(g, e, x, y, a, w) {
    const fly = (e.landed ? 2 : 22) + Math.sin(G.t * 2.2) * (e.landed ? 0 : 4), by = y - fly;
    const flap = Math.floor(G.t * (e.st === 'swoop' ? 10 : 5)) % 2, fl = e.face < 0;
    drawSprite(g, bossPart('dragon_wing', flap), x + (fl ? 8 : -8), by - 20, fl, { alpha: a * 0.9, white: w, tint: '#000000', tintA: 0.4 });
    drawSprite(g, bossPart('dragon_body'), x, by, fl, { alpha: a, white: w, outline: e.phase >= 3 ? '#ffb35e' : null });
    drawSprite(g, bossPart('dragon_head', e.mouth > 0 ? 1 : 0), x + (fl ? -30 : 30), by - 34, fl, { alpha: a, white: w });
    drawSprite(g, bossPart('dragon_wing', flap), x + (fl ? -2 : 2), by - 18, fl, { alpha: a, white: w });
    if (e.mouth > 0 && Math.random() < 0.6) burst(e.x + (fl ? -46 : 46), e.y - fly - 34, 1, ['#ffd08a', '#ff7a2a'], { grav: -30, floor: false, smax: 20, glow: true });
  },
});

/* ---------- small monsters for the new bosses ---------- */
Object.assign(MON, {
  eggsac(p, f) {
    rigOrient(p, 'front', 1);
    p.ell(8, 9, 6.5, 6, '#e8e8f0'); for (let i = 0; i < 6; i++) p.line(2 + i * 2.4, 4, 3 + i * 2, 14, '#c8c8d8');
    p.disc(6, 8, 1.4, '#8fe05c'); p.disc(10, 10, 1.2, '#8fe05c'); if (f >= 1) { p.px(8, 6, '#2e2638'); p.px(9, 7, '#2e2638'); }
  },
  spiderling(p, f) {
    const c = '#2e2638';
    rigOrient(p, 'top', { fwd: 'right' });
    for (let i = 0; i < 3; i++) { const d = (i % 2 === f % 2) ? -1 : 1; p.line(6, 5 + i, 2, 3 + i * 2 + d, c); p.line(8, 5 + i, 12, 3 + i * 2 - d, c); }
    p.ball(7, 6, 3, 2.4, c, 0.3, -0.3); p.px(8, 5, EYE_RED); p.px(9, 6, EYE_RED);
  },
});
Object.assign(MON_SIZE, { eggsac: [16, 16], spiderling: [14, 10] });

/* ---------- props ---------- */
const PROP_ART = {
  keg() { const p = new PP(14, 16); p.ell(7, 9, 5.5, 6, '#a8321e'); p.rect(1, 4, 13, 1, '#3a3a42'); p.rect(1, 12, 13, 1, '#3a3a42'); p.ell(7, 3.5, 5, 1.8, '#c44a2a'); p.ell(7, 8, 2, 1.8, '#f1e5cd'); p.px(6, 8, '#1a1214'); p.px(8, 8, '#1a1214'); p.rect(6, 10, 3, 1, '#f1e5cd'); p.line(7, 2, 9, 0, '#c8bfa8'); return [p, 7, 15]; },
  vent(pal, v) { const p = new PP(16, 16); p.ell(8, 8, 7, 5, '#1a1214'); for (let i = 0; i < 4; i++) p.rect(3, 5 + i * 2, 10, 1, '#4a4a52'); const c = v === 1 ? '#8fe05c' : '#ff7a2a'; p.px(8, 8, c); p.px(6, 6, c); p.px(10, 10, c); return [p, 8, 8]; },
  darttrap(pal) { const p = new PP(16, 8); p.rect(2, 1, 12, 6, shade(pal.wall, -0.18)); p.rect(2, 1, 12, 1, shade(pal.wall, 0.1)); for (let i = 0; i < 3; i++) p.disc(4.5 + i * 3.5, 4, 1.1, '#0a0608'); return [p, 8, 4]; },
  soulwell() {
    const p = new PP(30, 28);
    p.ell(15, 22, 13, 5, '#2a1e3a'); p.ell(15, 21, 11, 3.8, '#100818');
    p.rect(11, 9, 8, 12, '#3a2a4a'); p.rect(11, 9, 2, 12, '#5a4a6a'); p.rect(17, 9, 2, 12, '#24182e');
    for (let i = 0; i < 3; i++) p.px(14 + i, 13 + i * 2, '#c873ff');
    p.ell(15, 9, 8, 2.8, '#4a3a5a'); p.ell(15, 8.5, 6, 1.8, '#0a0410');
    return [p, 15, 26];
  },
  shardtotem() { const p = new PP(12, 20); p.poly([[6, 0], [10, 8], [8, 19], [4, 19], [2, 8]], '#3a2a5a'); p.line(6, 2, 6, 17, '#c873ff'); p.px(5, 6, '#ffffff'); return [p, 6, 19]; },
};
const _pickupSprite = pickupSprite;
pickupSprite = function (kind) {
  if (kind !== 'soul' && kind !== 'soulbig') return _pickupSprite(kind);
  return spr('pk:' + kind, () => {
    const big = kind === 'soulbig', p = new PP(12, 14);
    const c = big ? '#c873ff' : '#7fe8ff';
    p.poly([[6, 1], [9, 7], [9, 10], [6, 13], [3, 10], [3, 7]], c);
    p.poly([[6, 4], [8, 8], [6, 11], [4, 8]], big ? '#f0d8ff' : '#e9fbff');
    p.px(6, 7, '#ffffff'); if (big) { p.px(1, 4, c); p.px(10, 3, c); }
    p.outline(big ? '#3a1a5a' : '#0a2a3a');
    return p.sprite(6, 13);
  });
};

/* ---------- missiles ---------- */
Object.assign(DRAW_PROJ, {
  bullet(g, pr, a) { g.rotate(a); g.fillStyle = OUTLINE; g.fillRect(-4, -1.5, 7, 3); g.fillStyle = pr.color || '#ffe08a'; g.fillRect(-3, -0.5, 6, 1); g.fillStyle = '#ffffff'; g.fillRect(1, -0.5, 2, 1); },
  note(g, pr) {
    const c = pr.color || '#7dff9a', b = Math.round(Math.sin(pr.t * 18) * 1.5);
    g.fillStyle = OUTLINE; g.fillRect(-3, -2 + b, 5, 4); g.fillRect(1, -7 + b, 3, 7); g.fillRect(1, -8 + b, 5, 3);
    g.fillStyle = c; g.fillRect(-2, -1 + b, 3, 2); g.fillRect(2, -7 + b, 1, 7); g.fillRect(2, -7 + b, 3, 1);
  },
  chakram(g, pr) {
    g.rotate(pr.t * 26);
    g.strokeStyle = OUTLINE; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.stroke();
    g.strokeStyle = pr.color || '#dde3ec'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.stroke();
    g.fillStyle = '#ffd35c'; g.fillRect(-1, -1, 2, 2); g.fillStyle = '#ffffff'; g.fillRect(3, -1, 2, 2);
  },
  harpoon(g, pr, a) {
    const p = G.p, dx = Math.round(p.x - pr.x), dy = Math.round(p.y - 8 - pr.y);
    g.strokeStyle = 'rgba(210,190,150,0.85)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(dx / 2, dy / 2 + 6, dx, dy); g.stroke();
    g.rotate(a); g.fillStyle = OUTLINE; g.fillRect(-7, -1.5, 13, 3); g.fillStyle = '#9aa4b4'; g.fillRect(-6, -0.5, 9, 1); g.fillStyle = '#dde3ec'; g.fillRect(3, -2, 3, 4); g.fillRect(6, -1, 1, 2);
  },
  crystal(g, pr, a) {
    g.rotate(a); g.fillStyle = OUTLINE; g.beginPath(); g.moveTo(5, 0); g.lineTo(0, -3); g.lineTo(-5, 0); g.lineTo(0, 3); g.fill();
    g.fillStyle = pr.color || '#c8a8ff'; g.beginPath(); g.moveTo(4, 0); g.lineTo(0, -2); g.lineTo(-4, 0); g.lineTo(0, 2); g.fill(); g.fillStyle = '#ffffff'; g.fillRect(0, -1, 2, 1);
  },
  gaze(g, pr, a) { g.rotate(a); g.fillStyle = OUTLINE; g.fillRect(-4, -2, 8, 4); g.fillStyle = '#ff6f9c'; g.fillRect(-3, -1, 6, 2); g.fillStyle = '#ffe08a'; g.fillRect(1, -1, 2, 1); },
  dart(g, pr, a) { g.rotate(a); g.fillStyle = OUTLINE; g.fillRect(-4, -1.5, 8, 3); g.fillStyle = '#8a8478'; g.fillRect(-3, -0.5, 5, 1); g.fillStyle = '#c43a4a'; g.fillRect(-4, -1, 2, 2); },
  pflame(g, pr) { const k = pr.t / pr.life, r2 = 2 + k * 6; g.fillStyle = k < 0.3 ? '#fff3c0' : k < 0.6 ? '#ffb35e' : 'rgba(232,82,28,0.7)'; g.fillRect(-r2 / 2, -r2 / 2, r2, r2); },
  boulderp(g, pr) { g.fillStyle = OUTLINE; g.fillRect(-4, -4, 8, 8); g.fillStyle = '#8a8478'; g.fillRect(-3, -3, 6, 6); g.fillStyle = '#b8b0a0'; g.fillRect(-3, -3, 3, 2); },
});

/* ---------- effects ---------- */
Object.assign(GROUND_FX, {
  consecrate(g, f, cx, cy) {
    const k = f.t / f.life, x = Math.round(f.x - cx), y = Math.round(f.y - cy), a = Math.min(1, (1 - k) * 4);
    g.fillStyle = `rgba(255,214,110,${(0.16 * a).toFixed(3)})`; g.beginPath(); g.ellipse(x, y, f.r, f.r * 0.55, 0, 0, TAU); g.fill();
    g.strokeStyle = `rgba(255,232,160,${(0.7 * a).toFixed(3)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, f.r, f.r * 0.55, 0, 0, TAU); g.stroke();
    g.fillStyle = `rgba(255,240,190,${(0.55 * a).toFixed(3)})`; g.fillRect(x - 1, y - 8, 2, 16); g.fillRect(x - 6, y - 3, 12, 2);
    for (let i = 0; i < 6; i++) { const an = G.t * 0.8 + (i * TAU) / 6; g.fillRect(Math.round(x + Math.cos(an) * f.r * 0.85), Math.round(y + Math.sin(an) * f.r * 0.47), 2, 2); }
  },
  thicket(g, f, cx, cy) {
    const k = f.t / f.life, x = f.x - cx, y = f.y - cy, a = Math.min(1, (1 - k) * 3);
    g.fillStyle = `rgba(60,120,40,${(0.35 * a).toFixed(3)})`; g.beginPath(); g.ellipse(Math.round(x), Math.round(y), f.r, f.r * 0.55, 0, 0, TAU); g.fill();
    for (let i = 0; i < 18; i++) { const an = i * 2.4 + f.x, rr = f.r * ((i * 37) % 10) / 10; const bx = Math.round(x + Math.cos(an) * rr), by = Math.round(y + Math.sin(an) * rr * 0.55); g.fillStyle = i % 3 ? '#5aa84a' : '#a8e070'; g.fillRect(bx, by - 3 - (i % 2), 1, 3 + (i % 2)); }
  },
  roots(g, f, cx, cy) {
    const k = f.t / f.life, x = f.x - cx, y = f.y - cy;
    g.strokeStyle = `rgba(106,74,42,${(0.9 * Math.min(1, (1 - k) * 3)).toFixed(3)})`; g.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const an = i * 1.3 + f.x; g.beginPath(); g.moveTo(Math.round(x + Math.cos(an) * 8), Math.round(y + Math.sin(an) * 4)); g.lineTo(Math.round(x + Math.cos(an + 0.4) * 3), Math.round(y - 10 - (i % 3) * 3)); g.stroke(); }
  },
  quakewave(g, f, cx, cy) {
    const k = f.t / f.life, r2 = f.r * easeOut(k);
    g.strokeStyle = `rgba(200,180,150,${(0.8 * (1 - k)).toFixed(3)})`; g.lineWidth = 2;
    g.beginPath(); g.ellipse(Math.round(f.x - cx), Math.round(f.y - cy), r2, r2 * 0.55, 0, 0, TAU); g.stroke();
    for (let i = 0; i < 10; i++) { const an = (i * TAU) / 10 + f.x; g.fillStyle = '#8a7a6a'; g.fillRect(Math.round(f.x - cx + Math.cos(an) * r2), Math.round(f.y - cy + Math.sin(an) * r2 * 0.55) - 2, 2, 2); }
  },
});
Object.assign(TOP_FX, {
  blackhole(g, f, cx, cy) {
    const k = f.t / f.life, x = Math.round(f.x - cx), y = Math.round(f.y - cy), grow = Math.min(1, f.t * 3) * (k > 0.9 ? (1 - k) * 10 : 1), r2 = f.r * 0.35 * grow;
    g.fillStyle = 'rgba(20,6,32,0.85)'; g.beginPath(); g.ellipse(x, y, r2, r2 * 0.8, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(200,115,255,0.85)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, r2 + 1, (r2 + 1) * 0.8, 0, 0, TAU); g.stroke();
    for (let i = 0; i < 14; i++) { const an = G.t * 5 + i * 0.9, rr = (f.r * (1 - ((G.t * 0.8 + i * 0.07) % 1))) * grow; g.fillStyle = i % 2 ? '#c873ff' : '#ffffff'; g.fillRect(Math.round(x + Math.cos(an) * rr), Math.round(y + Math.sin(an) * rr * 0.6), 1, 1); }
  },
  staticfield(g, f, cx, cy) {
    const p = G.p, x = p.x - cx, y = p.y - 8 - cy, k = f.t / f.life;
    g.strokeStyle = `rgba(159,246,255,${(0.5 * (1 - k * 0.5)).toFixed(3)})`; g.lineWidth = 1;
    g.beginPath(); g.ellipse(Math.round(x), Math.round(y + 6), f.r, f.r * 0.55, 0, 0, TAU); g.stroke();
    for (let i = 0; i < 3; i++) { const a0 = rnd(TAU); pxLine(g, x + Math.cos(a0) * f.r * 0.3, y + 6 + Math.sin(a0) * f.r * 0.15, x + Math.cos(a0 + 0.4) * f.r, y + 6 + Math.sin(a0 + 0.4) * f.r * 0.55, '#fff27a', 1); }
  },
  whip(g, f, cx, cy) {
    const p = G.p, k = f.t / f.life, x0 = p.x - cx, y0 = p.y - 8 - cy, L = f.reach * Math.sin(Math.min(1, k * 2) * Math.PI / 2);
    g.strokeStyle = rgbaStr(f.color || '#c8a070', 1 - k); g.lineWidth = 1; g.beginPath(); g.moveTo(Math.round(x0), Math.round(y0));
    for (let i = 1; i <= 10; i++) { const t = i / 10, wv = Math.sin(t * Math.PI * 2 + f.t * 30) * 4 * (1 - t) * (1 - k); g.lineTo(Math.round(x0 + Math.cos(f.ang) * L * t - Math.sin(f.ang) * wv), Math.round(y0 + Math.sin(f.ang) * L * t + Math.cos(f.ang) * wv)); }
    g.stroke();
    if (k < 0.5) { g.fillStyle = '#ffffff'; g.fillRect(Math.round(x0 + Math.cos(f.ang) * L) - 1, Math.round(y0 + Math.sin(f.ang) * L) - 1, 3, 3); }
  },
  beam(g, f, cx, cy) {
    const k = f.t / f.life, x = (f.follow ? G.p.x : f.x) - cx, y = (f.follow ? G.p.y - 8 : f.y) - cy, len = f.len;
    g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(f.ang);
    const cols = f.rainbow ? ['#ff6f9c', '#ffb35e', '#fff27a', '#7dff9a', '#7fc8ff', '#c873ff'] : [f.color];
    const w2 = f.width || 4;
    cols.forEach((c, i) => { g.fillStyle = rgbaStr(c, 0.85 * (1 - k * 0.6)); g.fillRect(4, -w2 / 2 + (i * w2) / cols.length, len, Math.max(1, w2 / cols.length)); });
    g.fillStyle = `rgba(255,255,255,${(0.9 * (1 - k)).toFixed(3)})`; g.fillRect(4, -0.5, len, 1);
    g.restore();
  },
  slashline(g, f, cx, cy) {
    const k = f.t / f.life;
    g.strokeStyle = rgbaStr(f.color || '#ffffff', 1 - k); g.lineWidth = 2 - k;
    g.beginPath(); g.moveTo(Math.round(f.x0 - cx), Math.round(f.y0 - cy)); g.lineTo(Math.round(f.x1 - cx), Math.round(f.y1 - cy)); g.stroke();
    g.strokeStyle = rgbaStr('#ffffff', (1 - k) * 0.6); g.lineWidth = 1; g.beginPath(); g.moveTo(Math.round(f.x0 - cx), Math.round(f.y0 - cy - 2)); g.lineTo(Math.round(f.x1 - cx), Math.round(f.y1 - cy - 2)); g.stroke();
  },
  tether(g, f, cx, cy) {
    if (!f.a || !f.b) return;
    const k = f.t / f.life, ax = f.a.x - cx, ay = f.a.y - (f.a.h || 16) / 2 - cy, bx = f.b.x - cx, by = f.b.y - 8 - cy;
    g.strokeStyle = rgbaStr(f.color || '#e2434f', 0.8 * (1 - k * 0.5)); g.lineWidth = 1; g.beginPath(); g.moveTo(Math.round(ax), Math.round(ay));
    for (let i = 1; i < 6; i++) { const t = i / 6; g.lineTo(Math.round(lerp(ax, bx, t) + Math.sin(G.t * 20 + i) * 2), Math.round(lerp(ay, by, t) + Math.cos(G.t * 17 + i) * 2)); }
    g.lineTo(Math.round(bx), Math.round(by)); g.stroke();
  },
  blizzard(g, f, cx, cy) {
    const k = f.t / f.life, a = Math.min(1, (1 - k) * 4) * 0.8, x = f.x - cx, y = f.y - cy;
    g.fillStyle = `rgba(200,236,255,${(0.12 * a).toFixed(3)})`; g.beginPath(); g.ellipse(Math.round(x), Math.round(y), f.r, f.r * 0.6, 0, 0, TAU); g.fill();
    for (let i = 0; i < 26; i++) { const an = G.t * 3 + i * 0.7, rr = f.r * (((i * 53) % 100) / 100); g.fillStyle = i % 3 ? '#ffffff' : '#9fe0ff'; g.globalAlpha = a; g.fillRect(Math.round(x + Math.cos(an) * rr), Math.round(y + Math.sin(an) * rr * 0.6 - 4), 1, 1); }
    g.globalAlpha = 1;
  },
  notes(g, f, cx, cy) {
    const p = G.p, k = f.t / f.life;
    for (let i = 0; i < 5; i++) { const t = (f.t * 0.7 + i * 0.2) % 1, an = i * 1.3 + f.t; const x = p.x - cx + Math.cos(an) * 14, y = p.y - cy - 8 - t * 24; g.globalAlpha = (1 - t) * (1 - k * 0.5); g.fillStyle = i % 2 ? '#ffd35c' : '#7dff9a'; g.fillRect(Math.round(x), Math.round(y), 2, 2); g.fillRect(Math.round(x) + 1, Math.round(y) - 4, 1, 4); }
    g.globalAlpha = 1;
  },
  portal(g, f, cx, cy) {
    const k = f.t / f.life, x = Math.round(f.x - cx), y = Math.round(f.y - cy), r2 = f.r * Math.sin(Math.min(1, k * 1.2) * Math.PI);
    for (let i = 0; i < 4; i++) { g.strokeStyle = `hsla(${(G.t * 200 + i * 70) % 360},90%,65%,${(0.8 * (1 - k * 0.5)).toFixed(3)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, Math.max(1, r2 - i * 3), Math.max(1, (r2 - i * 3) * 0.45), 0, 0, TAU); g.stroke(); }
  },
});

/* ---------- hidden walls: secret rooms and DMT zones ---------- */
function drawHiddenDoor(g, d, cx, cy) {
  const T = getTileset(G.fl.actIdx);
  d.tiles.forEach(([x, y], i) => {
    const px = x * TS - cx, py = y * TS - cy;
    if (px < -TS || py < -TS || px > R.VW || py > R.VH) return;
    const face = d.dir === 'v' && i === d.tiles.length - 1;
    g.drawImage(face ? T.face[0] : T.top, px, py);
    g.fillStyle = 'rgba(10,6,8,0.5)';
    g.fillRect(px + 5, py + 3, 1, 4); g.fillRect(px + 6, py + 6, 1, 3); g.fillRect(px + 7, py + 8, 2, 1); g.fillRect(px + 9, py + 9, 1, 3);
    if (d.kind === 'dmt') {
      // the wall breathes in colors that are not quite there
      const hue = (G.t * 90 + x * 30) % 360, a = 0.12 + Math.sin(G.t * 2.4 + y) * 0.08;
      g.fillStyle = `hsla(${hue},90%,60%,${a.toFixed(3)})`; g.fillRect(px + 4, py + 2, 7, 11);
    }
  });
}

/* ---------- machine elves (DMT zone dwellers) ---------- */
const ELF_COLS = [['#ff6f9c', '#ffd35c'], ['#7fc8ff', '#7dff9a'], ['#c873ff', '#ffb35e'], ['#7dff9a', '#ff4ad0'], ['#ffd35c', '#58aaff']];
function elfSprite(i, f) {
  return spr(`elf:${i}:${f}`, () => {
    const [a, b] = ELF_COLS[i % ELF_COLS.length], p = new PP(12, 16), up = f ? 1 : 0;
    p.poly([[2, 5 - up], [0, 0], [5, 4 - up]], a); p.poly([[10, 5 - up], [12, 0], [7, 4 - up]], b);
    p.disc(0, 0, 0.8, b); p.disc(11, 0, 0.8, a);
    p.ball(6, 7 - up, 4, 3.4, '#f4e8ff', 0.3, -0.2);
    p.rect(3, 6 - up, 2, 2, '#1a0a2a'); p.rect(7, 6 - up, 2, 2, '#1a0a2a'); p.px(3, 6 - up, '#ffffff'); p.px(7, 6 - up, '#ffffff');
    p.rect(5, 9 - up, 2, 1, '#ff6f9c');
    p.poly([[3, 10], [9, 10], [10, 14], [2, 14]], b); p.rect(5, 10, 2, 4, a);
    p.px(3, 15, a); p.px(8, 15, b);
    p.outline('#140820');
    return p.sprite(6, 15);
  });
}

