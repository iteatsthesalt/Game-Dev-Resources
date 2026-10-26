/* ============================================================
   Cinderdeep — realm art: ground tiles for 25 biomes, the small
   things scattered on the ground, trees and boulders.
   ============================================================ */
const GROUND_STYLE = { desert: 'sand', coral: 'sand', saltflats: 'salt', frostpeak: 'snow', glacier: 'snow', ashlands: 'ash', caldera: 'ash', canyon: 'rock', crystal: 'rock', voidscar: 'void', murkmire: 'moss', sporeveil: 'moss', shadowfen: 'moss', savanna: 'dry', storm: 'dry', ossplains: 'dry' };
function tileTex(b) {
  return spr('tt:' + b.id, () => {
    const style = GROUND_STYLE[b.id] || 'grass', T = {};
    const mk = (fn, n = 4) => Array.from({ length: n }, (_, v) => { const p = new PP(16, 16); const R = new RNG(hashStr(b.id + fn.name + v)); fn(p, R, v); return p.canvas(); });
    const speck = (p, R, base, cols, n) => { p.rect(0, 0, 16, 16, base); for (let i = 0; i < n; i++) p.px(R.int(0, 15), R.int(0, 15), R.pick(cols)); };
    const groundFn = (main, lo, hi) => function ground(p, R) {
      speck(p, R, main, [lo, hi, shade(main, -0.08), shade(main, 0.06)], 26);
      if (style === 'grass' || style === 'moss' || style === 'dry') for (let i = 0; i < (style === 'dry' ? 7 : 5); i++) { const x = R.int(1, 14), y = R.int(2, 15); p.px(x, y, hi); p.px(x, y - 1, hi); if (style === 'dry') p.px(x + 1, y - 2, shade(hi, 0.1)); }
      if (style === 'sand' || style === 'salt') for (let i = 0; i < 2; i++) { const y = R.int(2, 13), x0 = R.int(0, 6); for (let x = x0; x < x0 + R.int(4, 9); x++) p.px(x, y + (x % 3 === 0 ? 1 : 0), shade(main, style === 'salt' ? -0.06 : 0.08)); }
      if (style === 'snow') for (let i = 0; i < 3; i++) p.px(R.int(0, 15), R.int(0, 15), '#ffffff');
      if (style === 'ash') for (let i = 0; i < 3; i++) p.px(R.int(0, 15), R.int(0, 15), R.chance(0.3) ? '#ff7a2a' : shade(main, 0.15));
      if (style === 'rock' || style === 'void') for (let i = 0; i < 2; i++) { const x = R.int(0, 12), y = R.int(0, 14); p.line(x, y, x + R.int(2, 4), y + R.int(0, 1), shade(main, -0.15)); }
      if (style === 'void' && R.chance(0.5)) p.px(R.int(1, 14), R.int(1, 14), R.pick(['#ff4ad0', '#4affe0']));
    };
    const [g0, g1, g2, g3] = b.g;
    T[GR.BASE] = mk(groundFn(g0, g2, g3));
    T[GR.ALT] = mk(groundFn(g1, g0, g3));
    T[GR.DARK] = mk(groundFn(g2, shade(g2, -0.12), g0));
    T[GR.DIRT] = mk(function dirt(p, R) { speck(p, R, mixHex(b.road, g2, 0.35), [shade(b.road, -0.1), shade(b.road, 0.08)], 30); });
    T[GR.ROAD] = mk(function road(p, R) { speck(p, R, b.road, [shade(b.road, -0.12), shade(b.road, 0.1), shade(b.road, -0.2)], 34); for (let i = 0; i < 3; i++) { const x = R.int(1, 13), y = R.int(1, 13); p.rect(x, y, 2, 1, shade(b.road, 0.16)); p.px(x, y + 1, shade(b.road, -0.25)); } });
    T[GR.PLAZA] = mk(function plaza(p, R) {
      const st = mixHex(b.road, '#a8a098', 0.55), mortar = shade(st, -0.35);
      p.rect(0, 0, 16, 16, mortar);
      for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) { const x = col * 6 - (row % 2) * 3, y = row * 4; const c = shade(st, R.range(-0.1, 0.1)); p.rect(x + 1, y + 1, 5, 3, c); p.rect(x + 1, y + 1, 5, 1, shade(c, 0.15)); }
    });
    T[GR.SAND] = mk(function sand(p, R) { const c = style === 'snow' ? '#e8f0f8' : style === 'ash' ? '#5a504a' : mixHex(b.g[3], '#e8d4a0', 0.6); speck(p, R, c, [shade(c, -0.06), shade(c, 0.06), shade(c, -0.12)], 24); });
    const waterFn = (base, lite) => function water(p, R, v) { p.rect(0, 0, 16, 16, base); for (let i = 0; i < 3; i++) { const y = R.int(1, 14), x = R.int(0, 10); p.rect(x, y, R.int(3, 6), 1, lite); } if (v === 0) p.px(R.int(2, 13), R.int(2, 13), '#ffffff'); };
    T[GR.DEEP] = mk(waterFn(b.water[0], shade(b.water[0], 0.12)));
    T[GR.SHALLOW] = mk(waterFn(b.water[1], shade(b.water[1], 0.18)));
    T[GR.ICE] = mk(function ice(p, R) { p.rect(0, 0, 16, 16, '#bfe4f4'); for (let i = 0; i < 2; i++) { const x = R.int(0, 12), y = R.int(0, 12); p.line(x, y, x + R.int(2, 5), y + R.int(1, 4), '#e9f8ff'); } p.px(R.int(0, 15), R.int(0, 15), '#ffffff'); });
    T[GR.LAVA] = mk(function lava(p, R) { p.rect(0, 0, 16, 16, '#d8401a'); for (let i = 0; i < 8; i++) p.disc(R.int(0, 15), R.int(0, 15), R.range(0.8, 2.2), R.pick(['#ff7a2a', '#ffa03a', '#ffd08a'])); });
    T[GR.TOXIC] = mk(function toxic(p, R) { const base = mixHex(b.g[2], '#3e7a22', 0.55); p.rect(0, 0, 16, 16, base); for (let i = 0; i < 4; i++) p.rect(R.int(-2, 13), R.int(0, 15), R.int(3, 6), 1, shade(base, 0.12)); for (let i = 0; i < 2; i++) p.disc(R.int(2, 13), R.int(2, 13), R.range(0.7, 1.3), '#7fc24a'); });
    const [ct, cf] = b.cliff;
    T[GR.CLIFF] = mk(function cliff(p, R) { speck(p, R, ct, [shade(ct, 0.1), shade(ct, -0.1), shade(ct, -0.18)], 30); for (let i = 0; i < 2; i++) { const x = R.int(1, 12), y = R.int(1, 12); p.rect(x, y, R.int(2, 4), 2, shade(ct, 0.08)); p.rect(x, y + 2, R.int(2, 4), 1, shade(ct, -0.2)); } });
    T.face = mk(function face(p, R) { p.rect(0, 0, 16, 16, cf); for (let x = 0; x < 16; x += R.int(2, 4)) p.rect(x, R.int(0, 4), 1, R.int(8, 16), shade(cf, -0.18)); p.rect(0, 0, 16, 2, shade(ct, -0.05)); p.rect(0, 14, 16, 2, shade(cf, -0.3)); }, 3);
    T.wall = mk(function wall(p, R) { const st = b.house === 'timber' || b.house === 'treehouse' || b.house === 'stilt' || b.house === 'hut' || b.house === 'tent' ? '#7a5a3a' : '#8a8a92'; p.rect(0, 0, 16, 16, shade(st, -0.25)); for (let row = 0; row < 4; row++) for (let c = 0; c < 2; c++) { const x = c * 8 + (row % 2) * 4 - 2, y = row * 4; p.rect(x + 1, y + 1, 7, 3, shade(st, R.range(-0.08, 0.08))); p.rect(x + 1, y + 1, 7, 1, shade(st, 0.12)); } }, 2);
    T[GR.BRIDGE] = mk(function bridge(p, R) { p.rect(0, 0, 16, 16, '#5a3a22'); for (let y = 0; y < 16; y += 4) { p.rect(0, y, 16, 3, R.chance(0.5) ? '#8a6a42' : '#9a7a4a'); p.rect(0, y, 16, 1, '#b08a5a'); p.px(R.int(1, 14), y + 1, '#5a3a22'); } }, 2);
    T.bridgeH = mk(function bridgeH(p, R) { p.rect(0, 0, 16, 16, '#5a3a22'); for (let x = 0; x < 16; x += 4) { p.rect(x, 0, 3, 16, R.chance(0.5) ? '#8a6a42' : '#9a7a4a'); p.rect(x, 0, 1, 16, '#b08a5a'); p.px(x + 1, R.int(1, 14), '#5a3a22'); } }, 2);
    T[GR.FIELD] = mk(function field(p, R) { p.rect(0, 0, 16, 16, '#6a4a2e'); for (let y = 1; y < 16; y += 4) { p.rect(0, y, 16, 2, '#5a3a22'); p.rect(0, y, 16, 1, '#7a5a3a'); } }, 2);
    T[GR.FLOOR] = T[GR.PLAZA];
    return T;
  });
}

/* ---------- small things on the ground (baked into the ground layer) ---------- */
function drawDeco(g, kind, x, y, h, b) {
  const R = (dx, dy, w, hh, c) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, hh); };
  const v = h & 255;
  switch (kind) {
    case 'flower': case 'flower2': { const c = kind === 'flower' ? ['#ffd35c', '#ffffff', '#ff8ad8', '#8ad8ff'][v % 4] : ['#e2434f', '#c873ff', '#ff9a3c'][v % 3]; R(3, 6, 1, 3, shade(b.g[0], -0.25)); R(2, 5, 3, 1, c); R(3, 4, 1, 3, c); R(3, 5, 1, 1, '#fff6c0'); if (v & 1) { R(9, 9, 1, 3, shade(b.g[0], -0.25)); R(8, 8, 3, 1, c); R(9, 7, 1, 3, c); } break; }
    case 'tuft': { const c = shade(b.g[0], 0.18); R(4, 6, 1, 3, c); R(6, 5, 1, 4, c); R(8, 6, 1, 3, shade(b.g[0], -0.15)); break; }
    case 'tallgrass': { const c = shade(b.g[1], 0.15); for (let i = 0; i < 4; i++) R(2 + i * 3, 3 + (i % 2), 1, 7, i % 2 ? c : shade(c, -0.2)); R(3, 2, 1, 1, shade(c, 0.2)); break; }
    case 'fern': { const c = shade(b.g[0], -0.1); for (let i = 0; i < 4; i++) { R(6 - i, 4 + i, 1, 1, c); R(8 + i, 4 + i, 1, 1, c); } R(7, 3, 1, 7, shade(c, -0.15)); break; }
    case 'mushroom': R(6, 7, 2, 3, '#e8dcc8'); R(4, 5, 6, 2, v & 1 ? '#c43a5a' : '#c8902a'); R(5, 5, 1, 1, '#ffffff'); break;
    case 'glowcap': R(6, 7, 1, 3, '#cfe8d8'); R(4, 5, 5, 2, '#7fe8ff'); R(5, 5, 1, 1, '#ffffff'); R(10, 9, 1, 2, '#cfe8d8'); R(9, 8, 3, 1, '#c8ff6a'); break;
    case 'spore': R(4, 6, 1, 1, '#d8ff9a'); R(9, 4, 1, 1, '#c873ff'); R(7, 10, 1, 1, '#d8ff9a'); break;
    case 'stump': R(4, 7, 7, 4, '#6a4a2a'); R(4, 7, 7, 1, '#b8945a'); R(5, 8, 5, 1, '#9a7a4a'); R(4, 10, 7, 1, '#4a3420'); break;
    case 'petal': for (let i = 0; i < 4; i++) R((v * (i + 3)) % 14 + 1, (v * (i + 7)) % 13 + 1, 2, 1, i % 2 ? '#ffb8d8' : '#ff8ac0'); break;
    case 'leafpile': for (let i = 0; i < 6; i++) R(3 + ((v + i * 5) % 9), 6 + ((v + i * 3) % 5), 2, 1, ['#e8642a', '#c8401a', '#ffb35e'][i % 3]); break;
    case 'pumpkin': R(5, 7, 6, 4, '#ff8a2a'); R(5, 7, 6, 1, '#ffb35e'); R(7, 7, 1, 4, '#c8601a'); R(7, 5, 1, 2, '#5a8a2a'); break;
    case 'lantern': R(6, 4, 3, 6, '#7a7a80'); R(6, 5, 3, 2, '#ffd890'); R(5, 3, 5, 1, '#5a5a62'); break;
    case 'bones': R(3, 8, 6, 1, '#e8e0cc'); R(3, 7, 1, 3, '#e8e0cc'); R(8, 7, 1, 3, '#e8e0cc'); R(10, 10, 3, 1, '#d8d0bc'); break;
    case 'skull': R(5, 6, 5, 4, '#e8e0cc'); R(6, 7, 1, 1, '#2a2228'); R(8, 7, 1, 1, '#2a2228'); R(6, 10, 3, 1, '#c8c0aa'); break;
    case 'grave': R(5, 3, 5, 7, '#8a8a92'); R(5, 3, 5, 1, '#a8a8b0'); R(6, 5, 3, 1, '#5a5a62'); R(7, 4, 1, 3, '#5a5a62'); R(4, 10, 7, 1, '#4a4a52'); break;
    case 'reed': for (let i = 0; i < 3; i++) { R(4 + i * 3, 2 + i, 1, 8 - i, '#7a8a4a'); R(4 + i * 3, 1 + i, 1, 2, '#6a4a2a'); } break;
    case 'lily': R(4, 7, 6, 3, '#4a8a3a'); R(5, 8, 2, 1, '#6aa84a'); if (v & 1) R(8, 7, 2, 1, '#ff8ad8'); break;
    case 'snowdrift': R(3, 8, 9, 3, '#ffffff'); R(5, 7, 5, 1, '#ffffff'); R(3, 10, 9, 1, '#cfe0ec'); break;
    case 'icecrystal': R(7, 3, 2, 7, '#9fe0ff'); R(7, 3, 1, 7, '#e9f8ff'); R(4, 6, 2, 4, '#9fe0ff'); R(10, 7, 2, 3, '#bfe9ff'); break;
    case 'dune': R(2, 9, 12, 1, shade(b.g[0], 0.1)); R(4, 8, 8, 1, shade(b.g[0], 0.16)); R(2, 10, 12, 1, shade(b.g[0], -0.1)); break;
    case 'ember': R(5, 7, 1, 1, '#ff7a2a'); R(9, 5, 1, 1, '#ffd08a'); R(7, 10, 2, 1, '#ff9a3c'); break;
    case 'ashpile': R(4, 8, 8, 3, '#6a6260'); R(6, 7, 4, 1, '#7a7270'); R(5, 9, 1, 1, '#ff7a2a'); break;
    case 'rockling': R(5, 7, 5, 4, '#8a8a8a'); R(5, 7, 5, 1, '#a8a8a8'); R(5, 10, 5, 1, '#5a5a5a'); break;
    case 'shell': R(5, 7, 4, 3, '#ffe0d0'); R(5, 7, 4, 1, '#ffffff'); R(6, 8, 1, 2, '#e8a890'); break;
    case 'starfish': R(7, 5, 1, 5, '#ff8a6a'); R(5, 7, 5, 1, '#ff8a6a'); R(6, 9, 1, 1, '#ff8a6a'); R(8, 9, 1, 1, '#ff8a6a'); break;
    case 'coralbit': R(5, 6, 1, 4, '#ff6a8a'); R(7, 4, 1, 6, '#ff8aa8'); R(9, 6, 1, 4, '#ff6a8a'); R(6, 5, 1, 1, '#ff8aa8'); break;
    case 'crystalbit': R(6, 4, 2, 6, v & 1 ? '#b8a8ff' : '#9fe0ff'); R(6, 4, 1, 6, '#ffffff'); R(9, 7, 2, 3, '#8a7ae8'); break;
    case 'saltcrust': R(2, 6, 4, 1, '#ffffff'); R(8, 9, 5, 1, '#ffffff'); R(5, 12, 3, 1, '#e8e0d8'); break;
    case 'eyes': R(5, 7, 3, 2, '#f4eef4'); R(6, 7, 1, 2, '#ff4ad0'); R(10, 9, 2, 1, '#f4eef4'); R(10, 9, 1, 1, '#4affe0'); break;
    case 'voidbit': R(6, 6, 3, 3, '#4a1a6a'); R(7, 7, 1, 1, '#ff4ad0'); break;
    case 'wisplight': R(7, 6, 2, 2, '#7fe8ff'); R(7, 6, 1, 1, '#ffffff'); break;
    case 'fairyring': for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; R(Math.round(7 + Math.cos(a) * 5), Math.round(8 + Math.sin(a) * 3), 2, 2, i % 2 ? '#ff8ad8' : '#e8dcc8'); } break;
    case 'crop': R(3, 6, 1, 4, '#6aa83a'); R(7, 5, 1, 5, '#6aa83a'); R(11, 6, 1, 4, '#6aa83a'); R(2, 6, 3, 1, '#8ac85a'); R(6, 5, 3, 1, v & 1 ? '#ffd35c' : '#8ac85a'); R(10, 6, 3, 1, '#8ac85a'); break;
  }
}

/* ---------- trees ---------- */
const TREE_SIZE = { oak: [26, 34], bigoak: [40, 50], birch: [20, 34], pine: [22, 36], pine2: [18, 30], snowpine: [22, 36], stormpine: [20, 32], bush: [16, 14], cherry: [28, 32], autumn: [26, 34], autumn2: [22, 30], acacia: [36, 30], baobab: [30, 36], willow: [32, 34], deadtree: [22, 30], bonespike: [16, 30], reedbush: [16, 16], shroom: [22, 28], shroom2: [26, 34], glowshroom: [16, 20], palm: [26, 36], coral: [22, 24], cactus: [14, 24], charred: [20, 30], obsidian: [16, 26], jungle: [32, 40], fern: [22, 16], feytree: [28, 36], crystaltree: [20, 32], icespike: [14, 26], saltspire: [12, 26], voidtree: [24, 34], tentacle: [16, 26], mangrove: [30, 30] };
// trees are painted part by part (trunk, canopy, hanging strands, fronds, stone that never bends) so the wind can bend them
function paintTree(p, kind, v) {
  const w = p.w, h = p.h, R = new RNG(hashStr(kind) + (v % 3) * 977), cx = w / 2, by = h - 1;
  const hue = (c) => shade(c, (v % 3 - 1) * 0.06);
  const trunk = (c, tw, th) => { rigPart(p, 'trunk'); p.rect(Math.round(cx - tw / 2), by - th, tw, th + 1, c); p.rect(Math.round(cx - tw / 2), by - th, 1, th + 1, shade(c, 0.15)); p.rect(Math.round(cx + tw / 2) - 1, by - th, 1, th + 1, shade(c, -0.25)); p.rect(Math.round(cx - tw / 2) - 1, by, tw + 2, 1, shade(c, -0.2)); };
  const blob = (x, y, rx, ry, c) => p.ball(x, y, rx, ry, c, 0.3, -0.35);
  const canopy = (y, rx, ry, c, n = 6) => { rigPart(p, 'canopy'); blob(cx, y, rx, ry, c); for (let i = 0; i < n; i++) { const a = R.next() * TAU; blob(cx + Math.cos(a) * rx * 0.6, y + Math.sin(a) * ry * 0.5, rx * 0.45, ry * 0.45, R.chance(0.5) ? shade(c, 0.08) : c); } for (let i = 0; i < n * 2; i++) { const a = R.next() * TAU, r = R.next(); p.px(cx + Math.cos(a) * rx * r * 0.8, y + Math.sin(a) * ry * r * 0.8 - ry * 0.3, shade(c, 0.22)); } };
  switch (kind) {
    case 'oak': trunk('#6a4a2a', 4, 12); canopy(13, 12, 11, hue('#3e8a3a')); break;
    case 'bigoak': trunk('#5a3e24', 7, 18); p.rect(Math.round(cx - 7), by - 2, 3, 3, '#5a3e24'); p.rect(Math.round(cx + 4), by - 2, 3, 3, '#4a3018'); canopy(18, 19, 16, hue('#2e7a32'), 10); break;
    case 'birch': trunk('#e8e4dc', 3, 18); for (let y = by - 16; y < by; y += 3) p.px(cx - 1, y, '#3a3a3a'); canopy(11, 9, 10, hue('#7ab84a')); break;
    case 'pine': case 'pine2': case 'snowpine': case 'stormpine': {
      trunk('#5a3e24', 3, 6); rigPart(p, 'canopy');
      const c = kind === 'snowpine' ? '#2e5a4a' : kind === 'stormpine' ? '#3a5a4a' : hue(kind === 'pine2' ? '#2e6a3e' : '#2a5a32'), tiers = kind === 'pine2' ? 3 : 4;
      for (let t = 0; t < tiers; t++) { const ty = by - 6 - t * ((h - 10) / tiers), tw = (w / 2 - 1) * (1 - t / (tiers + 0.6)); p.poly([[cx - tw, ty], [cx + tw, ty], [cx, ty - (h - 8) / tiers - 4]], c); p.poly([[cx - tw, ty], [cx, ty], [cx, ty - (h - 8) / tiers - 4]], shade(c, 0.1)); if (kind === 'snowpine') { p.line(cx - tw * 0.7, ty - 2, cx, ty - (h - 8) / tiers - 2, '#ffffff'); p.rect(Math.round(cx - tw), Math.round(ty) - 1, Math.round(tw * 2), 1, '#e8f0f8'); } }
      break;
    }
    case 'bush': rigPart(p, 'canopy'); blob(cx, by - 5, 7, 5, hue(shade(BIOME_COL.bush, 0))); blob(cx - 3, by - 6, 4, 3, shade(BIOME_COL.bush, 0.1)); if (v % 3 === 0) { p.px(cx - 2, by - 7, '#e2434f'); p.px(cx + 3, by - 5, '#e2434f'); } break;
    case 'cherry': trunk('#5a3a3a', 4, 12); canopy(12, 13, 10, hue('#ff9ac8')); for (let i = 0; i < 10; i++) p.px(R.int(2, w - 3), R.int(4, 20), '#ffd8e8'); break;
    case 'autumn': trunk('#6a4a2a', 4, 12); canopy(13, 12, 11, ['#e8642a', '#c8401a', '#e8a02a'][v % 3]); break;
    case 'autumn2': trunk('#5a3e24', 3, 11); canopy(12, 10, 10, ['#e8a02a', '#d8702a', '#c8501a'][v % 3]); break;
    case 'acacia': { trunk('#6a4a2a', 3, 16); p.line(cx, by - 14, cx - 8, by - 20, '#6a4a2a'); p.line(cx, by - 14, cx + 9, by - 21, '#6a4a2a'); rigPart(p, 'canopy'); p.ell(cx, 8, 17, 4.5, hue('#6a8a3a')); p.ell(cx, 6, 14, 2.5, shade('#6a8a3a', 0.12)); break; }
    case 'baobab': { rigPart(p, 'trunk'); p.rect(Math.round(cx - 6), by - 22, 12, 23, '#9a7a5a'); p.rect(Math.round(cx - 6), by - 22, 2, 23, '#b89a7a'); p.rect(Math.round(cx + 4), by - 22, 2, 23, '#7a5a3a'); for (let i = -2; i <= 2; i++) p.line(cx + i * 2, by - 22, cx + i * 5, by - 30, '#8a6a4a'); rigPart(p, 'canopy'); for (let i = -2; i <= 2; i++) blob(cx + i * 5, by - 31, 3.5, 2.5, hue('#5a8a3a')); break; }
    case 'willow': { trunk('#4a3a2a', 5, 14); rigPart(p, 'canopy'); blob(cx, 12, 14, 9, hue('#5a7a3a')); rigPart(p, 'strands'); for (let x = 3; x < w - 3; x += 2) { const len = R.int(8, 16); for (let y = 12; y < 12 + len; y++) p.px(x, y, (x + y) % 3 ? '#6a8a42' : '#4a6a2e'); } break; }
    case 'deadtree': case 'charred': { const c = kind === 'charred' ? '#2a2220' : '#6a5a4a'; trunk(c, 3, 18); p.line(cx, by - 12, cx - 7, by - 20, c); p.line(cx, by - 16, cx + 6, by - 25, c); p.line(cx - 4, by - 16, cx - 9, by - 18, c); p.line(cx + 3, by - 20, cx + 8, by - 21, c); if (kind === 'charred') { p.px(cx, by - 8, '#ff7a2a'); p.px(cx - 1, by - 14, '#ffb35e'); } break; }
    case 'bonespike': { rigPart(p, 'stone'); p.poly([[cx - 4, by], [cx + 4, by], [cx + 1, 2], [cx - 1, 6]], '#e8e0cc'); p.line(cx + 1, by, cx + 1, 3, '#b8ae96'); p.line(cx - 3, by - 8, cx - 7, by - 14, '#e8e0cc'); break; }
    case 'reedbush': rigPart(p, 'fronds'); for (let i = 0; i < 6; i++) { const x = 2 + i * 2.4, top = R.int(2, 7); p.line(x, by, x + (i % 2), top, '#7a8a4a'); p.rect(Math.round(x), top, 1, 3, '#6a4a2a'); } break;
    case 'shroom': case 'shroom2': { const cap = kind === 'shroom' ? hue('#c43a5a') : hue('#8a5ac4'); rigPart(p, 'trunk'); p.rect(Math.round(cx - 3), by - 14, 6, 15, '#e8dcc8'); p.rect(Math.round(cx - 3), by - 14, 1, 15, '#ffffff'); rigPart(p, 'canopy'); p.ell(cx, 9, w / 2 - 1, 8, cap); p.ell(cx, 7, w / 2 - 3, 5, shade(cap, 0.12)); for (let i = 0; i < 5; i++) p.disc(R.int(3, w - 4), R.int(3, 11), 1.2, '#f4ead8'); p.rect(Math.round(cx - w / 2 + 2), 15, w - 4, 1, shade(cap, -0.3)); break; }
    case 'glowshroom': { rigPart(p, 'trunk'); p.rect(Math.round(cx - 1), by - 9, 3, 10, '#cfe8d8'); rigPart(p, 'canopy'); p.ell(cx, 7, 7, 5, hue('#4ad8c8')); p.ell(cx, 6, 5, 3, '#9ff6ff'); p.px(cx - 2, 5, '#ffffff'); break; }
    case 'palm': { rigPart(p, 'trunk'); for (let i = 0; i < 24; i++) { const t = i / 24; p.rect(Math.round(cx - 2 + Math.sin(t * 2.2) * 4), by - i, 3, 1, i % 3 ? '#9a7a4a' : '#7a5a3a'); } const tx = cx - 2 + Math.sin(2.2) * 4, ty = by - 24; rigPart(p, 'fronds'); for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.55; for (let j = 0; j < 11; j++) p.px(tx + Math.cos(a) * j, ty + Math.sin(a) * j * 0.6 + j * j * 0.06, j % 2 ? '#3a8a3a' : '#4aa84a'); } p.disc(tx, ty + 2, 1.6, '#6a4a2a'); break; }
    case 'coral': rigPart(p, 'fronds'); for (let k = 0; k < 5; k++) { const x = 3 + k * 4, top = R.int(4, 12); p.line(x, by, x + R.int(-2, 2), top, ['#ff6a8a', '#ff8aa8', '#ffa86a'][k % 3]); p.disc(x, top, 1.5, '#ffd0e0'); } break;
    case 'cactus': { rigPart(p, 'stone'); p.rect(Math.round(cx - 2), 3, 5, by - 2, hue('#4a8a3a')); p.rect(Math.round(cx - 2), 3, 1, by - 2, '#6aaa4a'); p.rect(Math.round(cx - 6), 9, 3, 7, '#4a8a3a'); p.rect(Math.round(cx - 6), 15, 5, 2, '#4a8a3a'); p.rect(Math.round(cx + 4), 6, 3, 6, '#3e7a32'); p.rect(Math.round(cx + 2), 11, 4, 2, '#3e7a32'); if (v % 3 === 0) p.disc(cx, 3, 1.5, '#ff8ad8'); break; }
    case 'obsidian': rigPart(p, 'stone'); p.poly([[cx - 6, by], [cx + 6, by], [cx + 2, 2], [cx - 2, 8]], '#2e2630'); p.line(cx - 1, 8, cx + 1, by - 2, '#ff7a2a'); p.line(cx + 2, 4, cx + 4, by - 6, '#5a4a58'); break;
    case 'jungle': { trunk('#5a4a2a', 5, 18); rigPart(p, 'fronds'); for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.48; for (let j = 0; j < 15; j++) p.px(cx + Math.cos(a) * j, 14 + Math.sin(a) * j * 0.7 + j * j * 0.05, j % 2 ? hue('#2e8a3a') : '#3aa84a'); } blob(cx, 14, 9, 6, hue('#2e7a32')); break; }
    case 'fern': rigPart(p, 'fronds'); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.6; for (let j = 0; j < 10; j++) { const x = cx + Math.cos(a) * j, y = by - 1 + Math.sin(a) * j * 0.9 + j * j * 0.05; p.px(x, y, hue('#3a8a3a')); if (j % 2) p.px(x + 1, y + 1, '#2e6a2e'); } } break;
    case 'feytree': { trunk('#7a6a9a', 4, 14); canopy(13, 12, 11, ['#8ad8c8', '#c8a8ff', '#ff9ae8'][v % 3]); for (let i = 0; i < 6; i++) p.px(R.int(4, w - 5), R.int(4, 20), '#ffffff'); break; }
    case 'crystaltree': case 'icespike': case 'saltspire': {
      const c = kind === 'crystaltree' ? ['#b8a8ff', '#9fe0ff', '#ff9ae8'][v % 3] : kind === 'icespike' ? '#bfe9ff' : '#f4f0ea';
      const n = kind === 'crystaltree' ? 4 : 2;
      rigPart(p, 'stone');
      for (let k = 0; k < n; k++) { const x = cx + (k - (n - 1) / 2) * 4, top = 2 + R.int(0, 8) + Math.abs(k - (n - 1) / 2) * 4; p.poly([[x - 3, by], [x + 3, by], [x, top]], k % 2 ? shade(c, -0.12) : c); p.line(x, top + 2, x - 1, by - 2, '#ffffff'); }
      break;
    }
    case 'voidtree': { trunk('#2a1a3a', 4, 14); canopy(12, 11, 10, '#5a2a7a'); for (let i = 0; i < 4; i++) { const x = R.int(4, w - 5), y = R.int(5, 16); p.px(x, y, '#f4eef4'); p.px(x + 1, y, '#ff4ad0'); } break; }
    case 'tentacle': { rigPart(p, 'fronds'); for (let i = 0; i < h - 2; i++) { const t = i / h, x = cx + Math.sin(t * 6 + v) * 3 * t; p.rect(Math.round(x - (1 - t) * 3), by - i, Math.max(1, Math.round((1 - t) * 6)), 1, i % 4 === 0 ? '#ff4ad0' : '#5a2a7a'); } break; }
    case 'mangrove': { rigPart(p, 'trunk'); for (let k = -3; k <= 3; k++) p.line(cx + k * 1.2, by - 10, cx + k * 4, by, '#6a5a3a'); trunk('#6a5a3a', 4, 14); canopy(10, 13, 8, hue('#4a7a3a')); break; }
    default: trunk('#6a4a2a', 4, 12); canopy(13, 11, 10, '#3e8a3a');
  }
}
function treeSprite(kind, v) {
  return spr(`tree:${kind}:${v % 3}`, () => {
    const [w, h] = TREE_SIZE[kind] || [24, 32], p = new PP(w, h);
    paintTree(p, kind, v);
    p.outline();
    return p.sprite(Math.floor(w / 2), h - 1);
  });
}
const BIOME_COL = { bush: '#4a8a3a' };

/* ---------- boulders ---------- */
const ROCK_COL = { grey: ['#8a8a8a', '#5e5e62'], mossy: ['#7a8070', '#4e5448'], sand: ['#c8a870', '#8a6e48'], bone: ['#e8e0cc', '#a89e86'], snow: ['#a8b8c8', '#6a7a8c'], coral: ['#ff9ab0', '#c86a80'], red: ['#b8603a', '#7a3a24'], ash: ['#5a524e', '#383230'], obsidian: ['#3a3040', '#1e1824'], crystal: ['#9fa8e8', '#5a62a8'], salt: ['#f0ece4', '#b8b0a4'], void: ['#4a2a6a', '#24123a'] };
function boulderSprite(style, v) {
  return spr(`rock:${style}:${v % 4}`, () => {
    const [c, d] = ROCK_COL[style] || ROCK_COL.grey, w = 16 + (v % 4 === 0 ? 4 : 0), hh = 13 + (v % 4 === 0 ? 3 : 0);
    const p = new PP(w, hh), R = new RNG(hashStr(style) + v);
    p.ball(w / 2, hh - 6, w / 2 - 1, hh / 2 - 1, c, 0.3, -0.4);
    p.ball(w / 2 - 3, hh - 5, w / 3, hh / 3, shade(c, -0.05), 0.25, -0.35);
    for (let i = 0; i < 3; i++) p.px(R.int(3, w - 4), R.int(3, hh - 4), shade(c, -0.25));
    if (style === 'mossy') { p.ell(w / 2 - 2, 3, 4, 1.5, '#5a8a3a'); p.px(w / 2 + 2, 3, '#6aa84a'); }
    if (style === 'snow') { p.ell(w / 2, 3, w / 2 - 3, 2, '#ffffff'); }
    if (style === 'crystal' || style === 'void') { p.poly([[w / 2 + 1, 5], [w / 2 + 4, 5], [w / 2 + 3, -1]], style === 'void' ? '#ff4ad0' : '#e8f0ff'); }
    p.rect(1, hh - 1, w - 2, 1, d);
    p.outline();
    return p.sprite(Math.floor(w / 2), hh - 2);
  });
}

