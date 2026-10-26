/* ============================================================
   Cinderdeep — realm props: houses in eleven styles, shop signs,
   fountains, wells, lamps, towers, stalls, camps, waystones,
   dungeon mouths, boss-lair stones, landmarks and townsfolk.
   ============================================================ */
const HOUSE = {
  timber: { wall: '#e8dcc0', beam: '#6a4a2a', roofs: ['#a83a2a', '#3a5a8a', '#6a4a8a', '#3a7a4a'], roof: 'gable' },
  stone: { wall: '#9a9aa2', beam: '#6a6a72', roofs: ['#4a4a5a', '#5a4a4a', '#3a4a5a'], roof: 'gable', blocks: true },
  pagoda: { wall: '#f0e0c0', beam: '#b8302a', roofs: ['#2a2a3a', '#3a2a2a'], roof: 'pagoda' },
  hut: { wall: '#a8805a', beam: '#6a4a2a', roofs: ['#d8b860', '#c8a050'], roof: 'thatch' },
  adobe: { wall: '#d8b080', beam: '#7a5a3a', roofs: ['#c89a6a', '#b8885a'], roof: 'flat' },
  stilt: { wall: '#8a6a4a', beam: '#5a3a22', roofs: ['#9a8a5a', '#8a7a4a'], roof: 'thatch', stilts: true },
  tent: { wall: '#c8b090', beam: '#8a6a4a', roofs: ['#a83a2a', '#3a5a8a'], roof: 'tent' },
  igloo: { wall: '#e8f0f8', beam: '#a8c0d4', roofs: ['#e8f0f8'], roof: 'dome' },
  mushroom: { wall: '#e8dcc8', beam: '#b8a890', roofs: ['#c43a5a', '#8a5ac4', '#d8902a'], roof: 'cap' },
  crystal: { wall: '#7a7ab8', beam: '#4a4a8a', roofs: ['#b8a8ff', '#9fe0ff'], roof: 'spire' },
  treehouse: { wall: '#8a6a42', beam: '#5a3e24', roofs: ['#3a7a32', '#4a8a3a'], roof: 'leaf' },
};
const SIGN_ICON = {
  smith: ['01110', '11111', '00100', '01110', '11111'], general: ['01110', '10001', '11111', '11111', '01110'], inn: ['00000', '10000', '11111', '11111', '10001'],
  temple: ['00100', '11111', '00100', '00100', '00100'], board: ['11111', '10001', '10111', '10001', '11111'], bank: ['01110', '11011', '10101', '11011', '01110'],
  mystic: ['00100', '01110', '11111', '01110', '00100'], stable: ['11011', '10001', '10001', '10001', '01110'], guild: ['10001', '01010', '00100', '01010', '10001'],
  tailor: ['00001', '00010', '00100', '01000', '10000'], tentshop: ['01110', '10001', '11111', '11111', '01110'],
};
const SIGN_COL = { smith: '#ff9a3c', general: '#7de08a', inn: '#ffd35c', temple: '#ffffff', board: '#e8d8b0', bank: '#ffd35c', mystic: '#c873ff', stable: '#c8a070', guild: '#e2434f', tailor: '#ff8ad8', tentshop: '#7de08a' };
function buildingSprite(bld, noSign) {
  return spr(`bld:${bld.style}:${bld.type}:${bld.w}:${bld.h}:${bld.v % 4}${noSign ? ':ns' : ''}`, () => {
    const S = HOUSE[bld.style] || HOUSE.timber, style = bld.type === 'tentshop' ? 'tent' : bld.style;
    const H2 = HOUSE[style] || S;
    const bw = bld.w * TS, fh = bld.h * TS, up = H2.roof === 'pagoda' ? 26 : H2.roof === 'spire' ? 30 : H2.roof === 'tent' ? 14 : 18;
    const W = bw + 6, H = fh + up, p = new PP(W, H), R = new RNG(bld.v * 131 + bld.w);
    const ox = 3, roofC = H2.roofs[bld.v % H2.roofs.length], wallH = Math.min(fh - 6, 26 + (bld.type === 'house' ? 0 : 2)), wy = H - wallH;
    const wallC = H2.wall, beam = H2.beam;
    // walls
    if (H2.roof !== 'tent' && H2.roof !== 'dome') {
      p.rect(ox, wy, bw, wallH, wallC);
      p.rect(ox, wy, 2, wallH, shade(wallC, 0.12)); p.rect(ox + bw - 2, wy, 2, wallH, shade(wallC, -0.2));
      if (S.blocks || style === 'stone') for (let y = wy + 2; y < H; y += 4) { p.rect(ox, y, bw, 1, shade(wallC, -0.18)); for (let x = ox + ((y >> 2) % 2) * 4; x < ox + bw; x += 8) p.rect(x, y, 1, 4, shade(wallC, -0.18)); }
      if (style === 'timber' || style === 'treehouse') { for (const x of [ox, ox + bw - 3, ox + Math.floor(bw / 2) - 1]) p.rect(x, wy, 3, wallH, beam); p.rect(ox, wy + Math.floor(wallH / 2), bw, 2, beam); }
      if (style === 'pagoda') { for (let x = ox; x < ox + bw; x += 12) p.rect(x, wy, 3, wallH, beam); p.rect(ox, wy, bw, 2, beam); }
      if (style === 'adobe') { p.rect(ox - 1, wy - 2, bw + 2, 3, shade(wallC, 0.06)); for (let x = ox + 3; x < ox + bw - 2; x += 7) p.rect(x, wy + 1, 2, 2, beam); }
      if (style === 'stilt') { p.rect(ox, H - 6, bw, 6, '#00000000'); for (let x = ox + 1; x < ox + bw; x += 6) p.rect(x, H - 6, 2, 6, beam); p.rect(ox, H - 7, bw, 1, shade(beam, -0.2)); }
      if (style === 'crystal') for (let k = 0; k < 4; k++) { const x = ox + R.int(3, bw - 4); p.line(x, wy + 2, x + R.int(-3, 3), H - 2, '#c8d8ff'); }
      p.rect(ox, H - 1, bw, 1, shade(wallC, -0.35));
    }
    // roof
    const ry0 = 1, ry1 = wy + 2;
    if (H2.roof === 'gable' || H2.roof === 'thatch' || H2.roof === 'leaf') {
      for (let y = ry0; y < ry1; y++) {
        const t = (y - ry0) / Math.max(1, ry1 - ry0), inset = Math.round((1 - t) * 4);
        for (let x = ox - 2 + inset; x < ox + bw + 2 - inset; x++) {
          let c = roofC;
          if (H2.roof === 'gable') { if ((y - ry0) % 4 === 3) c = shade(roofC, -0.22); else if (((x + ((y >> 2) % 2) * 3) % 6) === 0) c = shade(roofC, -0.12); if (x < ox + 2 + inset) c = shade(c, 0.12); }
          else if (H2.roof === 'thatch') { c = (x * 7 + y * 3) % 5 === 0 ? shade(roofC, -0.2) : (x + y) % 4 === 0 ? shade(roofC, 0.12) : roofC; }
          else c = (x * 5 + y * 3) % 7 < 2 ? shade(roofC, 0.15) : (x + y) % 5 === 0 ? shade(roofC, -0.2) : roofC;
          p.px(x, y, c);
        }
      }
      p.rect(ox - 2, ry1 - 1, bw + 4, 2, shade(roofC, -0.35));
      if (H2.roof === 'thatch') for (let x = ox - 2; x < ox + bw + 2; x += 2) p.px(x, ry1 + 1, shade(roofC, -0.15));
      p.rect(ox + 3, ry0, bw - 6, 1, shade(roofC, 0.25));
      if (H2.roof === 'gable' && style !== 'treehouse' && bld.v % 2 === 0) { const cx2 = ox + bw - 10; p.rect(cx2, ry0 - 0, 5, 8, shade(wallC, -0.3)); p.rect(cx2, ry0, 5, 1, '#3a3a3a'); }
    } else if (H2.roof === 'pagoda') {
      const tier = (y0, y1, inset, ext) => { for (let y = y0; y < y1; y++) { const t = (y - y0) / Math.max(1, y1 - y0), curl = y === y1 - 1 ? ext : 0; for (let x = ox - 4 + inset - curl; x < ox + bw + 4 - inset + curl; x++) p.px(x, y, (y - y0) % 3 === 2 ? shade(roofC, -0.2) : x < ox + inset ? shade(roofC, 0.15) : roofC); } p.px(ox - 5 + inset - ext, y1 - 2, roofC); p.px(ox + bw + 4 - inset + ext, y1 - 2, roofC); };
      tier(ry1 - 12, ry1 + 1, 0, 2); p.rect(ox + 6, ry1 - 18, bw - 12, 6, wallC); tier(ry0 + 1, ry1 - 16, 6, 2);
      p.rect(Math.floor(ox + bw / 2) - 1, ry0 - 1, 2, 3, '#ffd35c');
    } else if (H2.roof === 'flat') {
      p.rect(ox - 1, wy - 4, bw + 2, 4, roofC); p.rect(ox - 1, wy - 4, bw + 2, 1, shade(roofC, 0.15));
      p.rect(ox + 2, wy - 10, bw - 4, 6, shade(roofC, -0.08)); p.rect(ox + 2, wy - 10, bw - 4, 1, shade(roofC, 0.12));
    } else if (H2.roof === 'tent') {
      p.poly([[ox, H - 1], [ox + bw, H - 1], [ox + bw / 2 + 1, 1], [ox + bw / 2 - 1, 1]], wallC);
      for (let k = 0; k < 4; k++) p.line(ox + bw / 2, 2, ox + (bw * (k + 0.5)) / 4, H - 2, k % 2 ? roofC : shade(wallC, -0.15));
      p.poly([[ox + bw / 2 - 4, H - 1], [ox + bw / 2 + 4, H - 1], [ox + bw / 2, H - 14]], '#3a2a1a');
    } else if (H2.roof === 'dome') {
      p.ell(ox + bw / 2, H - 1, bw / 2, H - 4, wallC);
      for (let y = H - 5; y > 4; y -= 4) p.rect(ox + 3, y, bw - 6, 1, beam);
      p.ell(ox + bw / 2, H - 5, 5, 6, beam); p.ell(ox + bw / 2, H - 4, 3.5, 4.5, '#2a3a4a');
    } else if (H2.roof === 'cap') {
      p.ell(ox + bw / 2, wy + 1, bw / 2 + 3, wy - 1, roofC); p.ell(ox + bw / 2, wy - 3, bw / 2, wy - 6, shade(roofC, 0.1));
      for (let k = 0; k < 5; k++) p.disc(ox + R.int(4, bw - 4), R.int(4, wy - 2), R.range(1.2, 2.4), '#f4ead8');
      p.rect(ox - 2, wy + 1, bw + 4, 1, shade(roofC, -0.35));
    } else if (H2.roof === 'spire') {
      p.poly([[ox - 1, wy + 1], [ox + bw + 1, wy + 1], [ox + bw / 2 + 1, 0], [ox + bw / 2 - 1, 0]], roofC);
      p.line(ox + bw / 2, 1, ox + bw / 2 - 4, wy, '#ffffff'); p.line(ox + bw / 2, 1, ox + bw * 0.8, wy, shade(roofC, -0.2));
    }
    // door and windows
    if (H2.roof !== 'tent' && H2.roof !== 'dome') {
      const dx = ox + Math.floor(bw / 2) - 5, dh = Math.min(16, wallH - 4), dyy = H - dh - (style === 'stilt' ? 6 : 0);
      if (H2.roof === 'cap') { p.ell(dx + 5, dyy + dh * 0.6, 5, dh * 0.6, '#5a3a22'); p.ell(dx + 5, dyy + dh * 0.62, 4, dh * 0.55, '#7a5a3a'); }
      else { p.rect(dx - 1, dyy - 1, 12, dh + 1, shade(beam, -0.2)); p.rect(dx, dyy, 10, dh, '#6a4628'); p.rect(dx, dyy, 10, 1, '#8a6a42'); p.rect(dx + 4, dyy, 1, dh, '#4a2e18'); p.px(dx + 7, dyy + Math.floor(dh / 2), '#ffd35c'); }
      const nw = Math.max(1, Math.floor((bw - 20) / 14));
      for (let k = 0; k < nw; k++) for (const side of [-1, 1]) {
        const wx = side < 0 ? ox + 5 + k * 14 : ox + bw - 13 - k * 14, wyy = wy + 5;
        if (Math.abs(wx + 4 - (ox + bw / 2)) < 9) continue;
        p.rect(wx - 1, wyy - 1, 10, 9, shade(beam, -0.1)); p.rect(wx, wyy, 8, 7, '#ffe8a0'); p.rect(wx, wyy, 8, 2, '#fff6c8'); p.rect(wx + 3, wyy, 1, 7, shade(beam, -0.1)); p.rect(wx, wyy + 3, 8, 1, shade(beam, -0.1));
        if (style !== 'adobe' && style !== 'crystal') { p.rect(wx - 1, wyy + 8, 10, 2, '#5a8a3a'); p.px(wx + 1, wyy + 8, '#e2434f'); p.px(wx + 5, wyy + 8, '#ffd35c'); }
      }
    }
    // shop sign
    const ic = SIGN_ICON[bld.type];
    let sign = null;
    if (ic) {
      const sx = ox + Math.floor(bw / 2) + 7, sy = wy - 4 + (H2.roof === 'flat' ? 4 : 0);
      p.rect(sx, sy, 1, 4, '#3a2a1a');
      // the board can hang on its own, to swing in the wind
      sign = { x: sx + 4, y: sy + 3 };
      if (!noSign) { p.rect(sx - 1, sy + 3, 10, 9, '#5a3a22'); p.rect(sx, sy + 4, 8, 7, '#8a6a42'); ic.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '1') p.px(sx + 1 + i, sy + 5 + j, SIGN_COL[bld.type] || '#ffffff'); }); }
    }
    p.outline();
    const sp = p.sprite(Math.floor(W / 2), H - 1);
    sp.footH = fh; sp.sign = sign;
    return sp;
  });
}

/* ---------- props ---------- */
function propArt(kind, v = 0, extra) {
  return spr(`wp:${kind}:${v}:${extra || ''}`, () => {
    let p, ax, ay;
    const R = new RNG(hashStr(kind) + v * 31);
    switch (kind) {
      case 'fountain': {
        const big = extra === 'big', w = big ? 44 : 32, hh = big ? 30 : 22;
        p = new PP(w, hh);
        p.ell(w / 2, hh - 8, w / 2 - 1, (hh - 10) / 2 + 2, '#a8a098'); p.ell(w / 2, hh - 9, w / 2 - 4, (hh - 10) / 2 - 1, '#3a7ab0'); p.ell(w / 2, hh - 10, w / 2 - 7, (hh - 10) / 2 - 3, '#5a9ad0');
        p.rect(w / 2 - 2, 4, 4, hh - 14, '#c8c0b8'); p.rect(w / 2 - 2, 4, 1, hh - 14, '#e8e0d8'); p.ell(w / 2, 4, 5, 2, '#c8c0b8'); p.ell(w / 2, 3, 3, 1.2, '#9ad8f8');
        if (big) { p.ell(w / 2, 1.5, 2, 1.5, '#ffd35c'); }
        p.rect(2, hh - 6, w - 4, 2, '#8a8278');
        ax = w / 2; ay = hh - 4; break;
      }
      case 'well': p = new PP(18, 24); p.ell(9, 18, 8, 5, '#8a8a90'); p.ell(9, 17, 6, 3, '#1a2a3a'); p.rect(2, 4, 2, 14, '#6a4a2a'); p.rect(14, 4, 2, 14, '#6a4a2a'); p.poly([[0, 6], [18, 6], [9, 0]], '#a83a2a'); p.rect(8, 6, 2, 6, '#3a2a1a'); p.rect(7, 11, 4, 3, '#8a6a42'); ax = 9; ay = 21; break;
      case 'lamp': p = new PP(8, 22); p.rect(3, 6, 2, 16, '#3a3a42'); p.rect(3, 6, 1, 16, '#5a5a62'); p.rect(1, 1, 6, 6, '#3a3a42'); p.rect(2, 2, 4, 4, '#ffe8a0'); p.rect(2, 2, 4, 1, '#ffffff'); p.rect(2, 21, 4, 1, '#2a2a30'); ax = 4; ay = 21; break;
      case 'tower': p = new PP(26, 50); p.rect(3, 10, 20, 40, '#8a8a92'); p.rect(3, 10, 3, 40, '#a8a8b0'); p.rect(20, 10, 3, 40, '#6a6a72'); for (let y = 14; y < 50; y += 5) p.rect(3, y, 20, 1, '#6e6e76'); for (let x = 1; x < 25; x += 5) p.rect(x, 4, 3, 6, '#9a9aa2'); p.rect(1, 9, 24, 2, '#6a6a72'); p.rect(11, 18, 4, 7, '#1a1a22'); p.rect(11, 18, 4, 2, '#ffb766'); ax = 13; ay = 49; break;
      case 'stall': { p = new PP(24, 22); const c = ['#a83a2a', '#3a5a8a', '#3a7a4a', '#8a5a2a'][v % 4], ph = +extra || 0; p.rect(2, 8, 2, 14, '#6a4a2a'); p.rect(20, 8, 2, 14, '#6a4a2a'); for (let x = 0; x < 24; x++) p.rect(x, 2 + ((x + ph) % 6 < 3 ? 0 : 1), 1, 6, (x >> 2) % 2 ? c : '#f0e8d8'); p.rect(1, 14, 22, 4, '#8a6a42'); p.rect(1, 14, 22, 1, '#a8885a'); for (let k = 0; k < 4; k++) p.disc(5 + k * 4.5, 12.5, 1.6, ['#e2434f', '#ffd35c', '#7de08a', '#ff9a3c'][(k + v) % 4]); ax = 12; ay = 21; break; }
      case 'tent': p = new PP(20, 16); p.poly([[0, 15], [20, 15], [10, 0]], '#a89070'); p.poly([[0, 15], [10, 15], [10, 0]], '#c8b090'); p.poly([[7, 15], [13, 15], [10, 6]], '#2a2018'); ax = 10; ay = 15; break;
      case 'campfire': p = new PP(14, 8); p.rect(1, 5, 12, 2, '#6a4a2a'); p.line(2, 7, 11, 3, '#5a3a22'); p.line(2, 3, 11, 7, '#7a5a32'); for (let k = 0; k < 6; k++) p.px(1 + k * 2.4, 7, '#6a6a6a'); ax = 7; ay = 6; break;
      case 'waystone': p = new PP(14, 30); p.poly([[2, 29], [12, 29], [10, 4], [7, 0], [4, 4]], '#5a5a6a'); p.poly([[2, 29], [7, 29], [7, 0], [4, 4]], '#6e6e80'); for (const [x, y] of [[7, 8], [6, 12], [8, 15], [7, 19], [6, 23]]) p.px(x, y, '#7fe8ff'); p.rect(1, 28, 12, 2, '#3a3a46'); ax = 7; ay = 28; break;
      case 'menhir': { p = new PP(12, 24); const c = ['#7a7a80', '#8a8478', '#6a6a72'][v % 3]; p.poly([[2, 23], [10, 23], [9, 3], [6, 0], [3, 3]], c); p.poly([[2, 23], [6, 23], [6, 0], [3, 3]], shade(c, 0.12)); if (v % 2) for (let y = 6; y < 20; y += 4) p.px(6, y, '#ff6a4a'); ax = 6; ay = 23; break; }
      case 'dungeon': {
        p = new PP(48, 40);
        if (v === 0) { // crypt
          p.rect(4, 14, 40, 26, '#7a7680'); for (let y = 16; y < 40; y += 4) p.rect(4, y, 40, 1, '#5e5a64'); p.poly([[2, 16], [46, 16], [24, 2]], '#5a5662'); p.poly([[2, 16], [24, 16], [24, 2]], '#6a6672');
          p.rect(14, 20, 20, 20, '#120a0e'); p.ell(24, 20, 10, 6, '#120a0e'); for (let k = 0; k < 4; k++) p.rect(14 - k, 34 + k * 2, 20 + k * 2, 1, '#4a4650');
          p.ell(24, 10, 4, 3.5, '#e8e0cc'); p.px(22, 10, '#e2434f'); p.px(26, 10, '#e2434f');
        } else if (v === 1) { // grotto
          p.ell(24, 30, 24, 18, '#3e5a46'); p.ell(24, 26, 20, 14, '#4a6a52'); p.ell(24, 32, 11, 9, '#0e1412'); for (let k = 0; k < 6; k++) { const x = 4 + k * 8; p.rect(x, 24 - (k % 2) * 4, 2, 4, '#cfe8d8'); p.ell(x + 1, 23 - (k % 2) * 4, 3, 2, k % 2 ? '#c873ff' : '#7fe8ff'); }
        } else if (v === 2) { // ice cave
          p.ell(24, 30, 24, 18, '#a8c4dc'); p.ell(24, 26, 20, 12, '#cfe6f4'); p.ell(24, 32, 11, 9, '#142030'); for (let k = 0; k < 8; k++) p.poly([[14 + k * 2.6, 24], [16 + k * 2.6, 24], [15 + k * 2.6, 24 + R.int(3, 7)]], '#e9f8ff');
        } else { // ember maw
          p.ell(24, 30, 24, 18, '#3a2826'); p.ell(24, 26, 20, 12, '#4a302a'); p.ell(24, 32, 11, 9, '#ff6a1a'); p.ell(24, 33, 8, 6, '#ffd08a'); for (let k = 0; k < 5; k++) p.line(8 + k * 8, 14, 10 + k * 8, 22, '#ff7a2a');
        }
        ax = 24; ay = 39; break;
      }
      case 'mark': return landmarkArt(extra, v);
      default: p = new PP(8, 8); p.rect(0, 0, 8, 8, '#ff00ff'); ax = 4; ay = 7;
    }
    p.outline();
    return p.sprite(ax, ay);
  });
}
// the windmill; its sails can be painted alone round the middle of the picture, at any angle, so they can turn
function paintMill(p, a0, sailsOnly, bodyOnly) {
  if (!sailsOnly) { p.poly([[10, 51], [30, 51], [25, 16], [15, 16]], '#e8dcc0'); p.poly([[10, 51], [20, 51], [20, 16], [15, 16]], '#f4ecd8'); p.poly([[13, 18], [27, 18], [20, 8]], '#a83a2a'); p.rect(17, 40, 6, 11, '#6a4628'); }
  if (bodyOnly) { p.disc(20, 16, 1.5, '#6a4a2a'); return; }
  const hx = sailsOnly ? p.w / 2 : 20, hy = sailsOnly ? p.h / 2 : 16;
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + a0; p.line(hx, hy, hx + Math.cos(a) * 18, hy + Math.sin(a) * 18, '#6a4a2a'); p.line(hx + Math.cos(a) * 6, hy + Math.sin(a) * 6, hx + Math.cos(a) * 17 + Math.cos(a + 1.2) * 4, hy + Math.sin(a) * 17 + Math.sin(a + 1.2) * 4, '#e8e0d0'); }
}
function landmarkArt(kind, v) {
  let p, ax, ay;
  const R = new RNG(hashStr(kind) + v);
  switch (kind) {
    case 'statue': p = new PP(22, 40); p.rect(3, 30, 16, 10, '#8a8a90'); p.rect(3, 30, 16, 2, '#a8a8b0'); p.rect(8, 12, 6, 18, '#a8a8a0'); p.disc(11, 9, 3.5, '#a8a8a0'); p.rect(4, 14, 4, 2, '#a8a8a0'); p.rect(14, 8, 2, 12, '#a8a8a0'); p.rect(13, 4, 4, 3, '#c8c8c0'); p.ell(11, 30, 4, 1, '#5a8a3a'); ax = 11; ay = 39; break;
    case 'ruin': p = new PP(40, 30); for (const [x, hh] of [[3, 24], [13, 14], [25, 28], [34, 10]]) { p.rect(x, 30 - hh, 6, hh, '#a8a098'); p.rect(x, 30 - hh, 2, hh, '#c8c0b8'); p.rect(x - 1, 30 - hh, 8, 2, '#8a8278'); } p.rect(0, 27, 40, 3, '#7a7268'); p.rect(9, 20, 20, 3, '#8a8278'); ax = 20; ay = 29; break;
    case 'windmill': p = new PP(40, 52); paintMill(p, 0.4); ax = 20; ay = 51; break;
    case 'oldoak': { const t = treeSprite('bigoak', 1); p = new PP(t.w + 12, t.h + 10); const c = t.c.getContext('2d').getImageData(0, 0, t.w, t.h).data; for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) { const i = (y * t.w + x) * 4; if (c[i + 3] > 100) { p.px(x + 6, y + 10, toHex(c[i], c[i + 1], c[i + 2])); if (y > t.h - 18) p.px(x + 6 + (x > t.w / 2 ? 2 : -2), y + 10, toHex(c[i], c[i + 1], c[i + 2])); } } for (let i = 0; i < 8; i++) p.px(R.int(8, t.w + 4), R.int(10, 30), '#ffd35c'); ax = Math.floor((t.w + 12) / 2); ay = t.h + 9; return (() => { p.outline(); return p.sprite(ax, ay); })(); }
    case 'shrine': p = new PP(22, 24); p.rect(3, 12, 16, 12, '#8a8a90'); p.poly([[0, 13], [22, 13], [11, 3]], '#5a5a62'); p.rect(8, 16, 6, 8, '#2a2a30'); p.disc(11, 19, 1.5, '#ffd35c'); for (const x of [2, 18]) p.rect(x, 22, 2, 2, '#ffd35c'); ax = 11; ay = 23; break;
    case 'torii': p = new PP(38, 34); p.rect(7, 8, 3, 26, '#c8302a'); p.rect(28, 8, 3, 26, '#c8302a'); p.rect(1, 4, 36, 3, '#2a2a3a'); p.rect(3, 7, 32, 2, '#c8302a'); p.rect(4, 13, 30, 2, '#c8302a'); p.rect(17, 7, 4, 6, '#c8302a'); ax = 19; ay = 33; break;
    case 'bones': p = new PP(46, 30); for (let k = 0; k < 6; k++) { const x = 6 + k * 6.5; for (let y = 0; y < 22; y++) p.px(x + Math.sin(y / 7) * 4 * (k < 3 ? -1 : 1), 28 - y, '#e8e0cc'); } p.rect(2, 26, 42, 3, '#d8d0bc'); p.ell(40, 22, 6, 5, '#e8e0cc'); p.px(42, 21, '#2a2228'); ax = 23; ay = 29; break;
    case 'obelisk': p = new PP(14, 44); p.poly([[2, 43], [12, 43], [10, 6], [7, 0], [4, 6]], '#4a4a56'); p.poly([[2, 43], [7, 43], [7, 0], [4, 6]], '#5e5e6c'); for (let y = 10; y < 40; y += 5) p.px(7, y, '#c873ff'); ax = 7; ay = 43; break;
    case 'stones': p = new PP(44, 22); for (let k = 0; k < 5; k++) { const x = 3 + k * 9, hh = 12 + ((k * 7) % 3) * 3; p.rect(x, 22 - hh, 6, hh, '#7a7a80'); p.rect(x, 22 - hh, 2, hh, '#9a9aa0'); } p.rect(4, 6, 36, 3, '#6a6a70'); ax = 22; ay = 21; break;
    case 'mausoleum': p = new PP(34, 36); p.rect(3, 12, 28, 24, '#8a8690'); p.poly([[1, 13], [33, 13], [17, 2]], '#6a6672'); for (const x of [5, 25]) p.rect(x, 14, 4, 22, '#a8a4ae'); p.rect(12, 20, 10, 16, '#1a1218'); p.ell(17, 20, 5, 3, '#1a1218'); ax = 17; ay = 35; break;
    case 'giantshroom': p = new PP(46, 54); p.rect(18, 22, 10, 32, '#e8dcc8'); p.rect(18, 22, 3, 32, '#ffffff'); p.ell(23, 18, 22, 15, '#c43a5a'); p.ell(23, 15, 18, 10, '#d84a6a'); for (let k = 0; k < 8; k++) p.disc(R.int(6, 40), R.int(6, 22), R.range(1.5, 3), '#f4ead8'); ax = 23; ay = 53; break;
    case 'wreck': p = new PP(50, 30); p.poly([[2, 14], [48, 10], [44, 28], [8, 29]], '#6a4a2a'); for (let y = 15; y < 28; y += 3) p.line(4, y, 46, y - 3, '#4a3018'); p.rect(22, 0, 3, 16, '#5a3a22'); p.poly([[25, 2], [38, 6], [25, 12]], '#e8e0d0'); ax = 25; ay = 29; break;
    case 'spire': p = new PP(22, 56); p.poly([[3, 55], [19, 55], [12, 0], [10, 0]], '#b8a8ff'); p.poly([[3, 55], [11, 55], [11, 0]], '#d8ccff'); p.line(11, 4, 11, 52, '#ffffff'); p.poly([[0, 55], [6, 55], [3, 38]], '#9fe0ff'); p.poly([[16, 55], [22, 55], [19, 42]], '#9fe0ff'); ax = 11; ay = 55; break;
    case 'eye': p = new PP(26, 42); for (let y = 16; y < 42; y++) p.rect(11 + Math.round(Math.sin(y / 4) * 2), y, 4, 1, y % 4 ? '#5a2a7a' : '#ff4ad0'); p.ell(13, 10, 11, 8, '#f4eef4'); p.disc(13, 10, 5, '#ff4ad0'); p.disc(13, 10, 2.4, '#1a0a1a'); p.px(11, 8, '#ffffff'); ax = 13; ay = 41; break;
    default: p = new PP(20, 30); p.rect(5, 0, 10, 30, '#8a8a90'); ax = 10; ay = 29;
  }
  p.outline();
  return p.sprite(ax, ay);
}

/* ---------- townsfolk ---------- */
const NPC_LOOK = {
  general: { main: '#6a8a5a', cloth: '#5a4a3a', trim: '#e8d8b0', head: 'hair' }, tentshop: { main: '#7a6a4a', cloth: '#4a3a2a', trim: '#c8a070', head: 'hood' },
  smith: { main: '#5a4a3a', cloth: '#3a2e24', trim: '#8a8a8a', head: 'monk', bare: true }, inn: { main: '#8a5a3a', cloth: '#5a3a2a', trim: '#e8d8b0', head: 'hair' },
  temple: { main: '#e8e0d0', cloth: '#c8c0b0', trim: '#ffd35c', head: 'hood' }, board: { main: '#3a6a8a', cloth: '#2a4a5a', trim: '#ffd35c', head: 'feathercap' },
  bank: { main: '#2a2a3a', cloth: '#1a1a24', trim: '#ffd35c', head: 'stetson' }, mystic: { main: '#5a3a8a', cloth: '#3a2a5a', trim: '#c873ff', head: 'wizard' },
  stable: { main: '#7a5a3a', cloth: '#4a3a2a', trim: '#c8a070', head: 'stetson' }, guild: { main: '#8a3a3a', cloth: '#5a2a2a', trim: '#ffd35c', head: 'helm' },
  tailor: { main: '#c8508a', cloth: '#8a3a6a', trim: '#ffffff', head: 'hair' }, guard: { main: '#8fa3b8', cloth: '#a83a2a', trim: '#ffd35c', head: 'helm' },
};
const FOLK_HAIR = ['#2a1a14', '#6b4428', '#c4501f', '#e8d8a0', '#8a8a8a', '#1a1a24', '#a8743e'], FOLK_SKIN = ['#e8b48c', '#d9a07a', '#c99272', '#f0c09a', '#8a5a3a', '#b8805a'], FOLK_CLOTH = ['#6a8a5a', '#8a5a3a', '#3a5a8a', '#8a3a3a', '#6a4a8a', '#a8885a', '#4a6a6a', '#c8a050'];
function npcLook(npc) {
  const R = new RNG(npc.seed || 1), base = NPC_LOOK[npc.role];
  const skin = R.pick(FOLK_SKIN), hair = R.pick(FOLK_HAIR), cloth = R.pick(FOLK_CLOTH);
  if (base) return { skin, hair, main: base.main, dark: shade(base.main, -0.3), trim: base.trim, cloth: base.cloth, head: base.head, eye: '#1a1214', bare: base.bare };
  const head = R.chance(0.7) ? 'hair' : R.pick(['hood', 'stetson', 'feathercap']);
  return { skin, hair, main: cloth, dark: shade(cloth, -0.3), trim: R.pick(['#e8d8b0', '#ffd35c', '#c8a070']), cloth: R.pick(FOLK_CLOTH), head, eye: '#1a1214' };
}
function npcSprites(npc) { return heroSprites(npcLook(npc), `npc:${npc.role}:${(npc.seed || 0) % 9}`); }
const NPC_TITLE = { general: 'Merchant', tentshop: 'Trader', smith: 'Blacksmith', inn: 'Innkeeper', temple: 'Priestess', board: 'Quartermaster', bank: 'Banker', mystic: 'Mystic', stable: 'Stablemaster', guild: 'Guildmaster', tailor: 'Tailor', guard: 'Guard', folk: '' };
const FOLK_LINES = [
  'Stay on the roads after dark.', 'The waystones remember everyone who touches them.', 'My cousin went into the old dungeon. Came back taller.', 'Have you seen the great beast out past the stones?',
  'Every five summers a hero changes shape. That is just how it is.', 'The capital has the best forge in the realm.', 'Bandits took the north road again.', 'If you smell sulphur, walk the other way.',
  'Some say the Realm goes on forever.', 'The quartermaster pays well for monster work.', 'I heard the frost giants talk. They mostly complain.', 'Lovely weather for a hunt.',
];

