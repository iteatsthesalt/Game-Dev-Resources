/* ============================================================
   Cinderdeep — sprites: heroes, held weapons, icons, pickups, props
   Everything is painted pixel by pixel at boot and cached.
   ============================================================ */
const SPR = {};
const spr = (key, make) => SPR[key] || (SPR[key] = make());
const C = {
  steel: '#dde3ec', steel2: '#9aa4b4', steel3: '#5f6878', wood: '#9a6436', wood2: '#5e3a1e', gold: '#ffd35c', gold2: '#c8901c',
  leather: '#6b4a2a', boot: '#2e211c', red: '#e2434f', fire: '#ff7a2a', fire2: '#ffd08a', ice: '#9fe0ff', ice2: '#e9f8ff',
  venom: '#8fe05c', venom2: '#3f9a2a', storm: '#fff27a', arcane: '#b98cff', arcane2: '#6a3cc8', bone: '#e8e0cc', bone2: '#b8ae96',
};

/* ---------- heroes ---------- */
function paintHero(look, view, frame) {
  const p = new PP(16, 21), L = look, oy = 1;
  const step = frame === 1 ? 1 : frame === 2 ? 2 : 0, bob = step ? 1 : 0;
  const skin = L.skin, main = L.main, dark = L.dark, cloth = L.cloth;
  // legs and boots
  rigPart(p, 'legs');
  const legL = step === 1 ? -1 : 0, legR = step === 2 ? -1 : 0;
  p.rect(5, 15 + oy + legL, 2, 3, shade(cloth, -0.35)); p.rect(9, 15 + oy + legR, 2, 3, shade(cloth, -0.35));
  p.rect(5, 18 + oy + legL, 2, 2, C.boot); p.rect(9, 18 + oy + legR, 2, 2, C.boot);
  const by = bob; // upper body bob
  // cape (back view, or a hint at the sides)
  rigPart(p, 'cape');
  if (view === 'back' && L.head !== 'horns') p.rect(4, 9 + oy + by, 8, 8, shade(cloth, -0.15));
  // torso
  rigPart(p, 'torso');
  p.rect(4, 9 + oy + by, 8, 6, main);
  p.rect(4, 9 + oy + by, 1, 6, shade(main, 0.18)); p.rect(11, 9 + oy + by, 1, 6, shade(main, -0.25));
  p.rect(4, 13 + oy + by, 8, 1, view === 'back' ? shade(main, -0.2) : L.trim);
  if (view === 'front') { p.rect(7, 10 + oy + by, 2, 3, shade(main, -0.12)); }
  if (L.head === 'wizard' || L.head === 'skullhood' || L.head === 'cowl') { p.rect(4, 14 + oy + by, 8, 2, main); p.rect(5, 16 + oy, 6, 1, shade(main, -0.2)); }
  // arms
  rigPart(p, 'arms');
  const armC = L.bare ? skin : shade(main, -0.08);
  const swing = step === 1 ? -1 : step === 2 ? 1 : 0;
  p.rect(3, 10 + oy + by + swing, 1, 4, armC); p.rect(12, 10 + oy + by - swing, 1, 4, armC);
  p.px(3, 14 + oy + by + swing, skin); p.px(12, 14 + oy + by - swing, skin);
  if (L.head === 'horns') { p.rect(3, 9 + oy + by, 2, 1, '#e8d8b0'); p.rect(11, 9 + oy + by, 2, 1, '#e8d8b0'); }
  // head
  rigPart(p, 'head');
  const hy = 3 + oy + by;
  p.rect(5, hy, 6, 6, skin);
  p.rect(5, hy + 5, 6, 1, shade(skin, -0.15));
  const eye = L.eye || '#1a1214';
  const face = view === 'front';
  if (face) { p.px(6, hy + 3, eye); p.px(9, hy + 3, eye); }
  switch (L.head) {
    case 'helm': {
      p.rect(4, hy - 1, 8, 6, C.steel2); p.rect(4, hy - 1, 8, 1, C.steel); p.rect(4, hy - 1, 1, 6, C.steel); p.rect(11, hy - 1, 1, 6, shade(C.steel2, -0.3));
      if (face) { p.rect(5, hy + 3, 6, 1, '#1a1214'); p.px(7, hy + 4, C.steel3); p.px(8, hy + 4, C.steel3); p.rect(5, hy + 5, 6, 1, C.steel3); }
      p.rect(7, hy - 3, 2, 2, L.trim); p.px(8, hy - 4, shade(L.trim, 0.3));
      break;
    }
    case 'hood': case 'mask': case 'cowl': case 'skullhood': {
      const hc = L.head === 'skullhood' ? '#2a2834' : L.head === 'mask' ? shade(main, -0.1) : main;
      p.rect(4, hy - 1, 8, 4, hc); p.rect(4, hy - 1, 1, 7, hc); p.rect(11, hy - 1, 1, 7, shade(hc, -0.25));
      p.rect(6, hy - 2, 4, 1, hc); p.px(7, hy - 3, hc);
      p.rect(4, hy - 1, 8, 1, shade(hc, 0.15));
      if (!face) p.rect(5, hy, 6, 6, hc);
      if (face && L.head === 'mask') { p.rect(5, hy + 4, 6, 2, '#1e1826'); p.px(6, hy + 3, eye); p.px(9, hy + 3, eye); }
      if (face && L.head === 'skullhood') { p.rect(6, hy + 2, 4, 3, '#e8e8dc'); p.px(6, hy + 3, eye); p.px(9, hy + 3, eye); p.px(7, hy + 5, '#2a2834'); p.px(8, hy + 5, '#2a2834'); }
      if (face && L.head === 'cowl') { p.px(6, hy + 3, eye); p.px(9, hy + 3, eye); p.rect(4, hy + 5, 1, 2, L.trim); p.rect(11, hy + 5, 1, 2, L.trim); }
      if (face && L.head === 'hood') p.rect(6, hy + 5, 4, 1, L.hair);
      break;
    }
    case 'wizard': {
      p.rect(3, hy, 10, 1, shade(main, -0.15)); // brim
      p.rect(5, hy - 2, 6, 2, main); p.rect(6, hy - 4, 4, 2, main); p.rect(7, hy - 5, 3, 1, main); p.px(9, hy - 6, main); p.px(10, hy - 6, shade(main, 0.2));
      p.rect(5, hy - 1, 6, 1, L.trim);
      if (face) { p.rect(5, hy + 4, 6, 3, L.hair); p.px(5, hy + 7, L.hair); p.px(10, hy + 7, L.hair); p.px(6, hy + 4, skin); p.px(9, hy + 4, skin); }
      else p.rect(5, hy + 1, 6, 4, L.hair);
      break;
    }
    case 'horns': {
      p.rect(5, hy - 1, 6, 2, C.steel2); p.rect(5, hy - 1, 6, 1, C.steel);
      p.px(4, hy, '#e8d8b0'); p.px(3, hy - 1, '#e8d8b0'); p.px(3, hy - 2, '#f4ead0'); p.px(11, hy, '#e8d8b0'); p.px(12, hy - 1, '#e8d8b0'); p.px(12, hy - 2, '#f4ead0');
      if (face) { p.rect(5, hy + 4, 6, 3, L.hair); p.px(6, hy + 4, skin); p.px(9, hy + 4, skin); p.px(7, hy + 4, skin); p.px(8, hy + 4, skin); }
      else p.rect(5, hy + 1, 6, 5, L.hair);
      break;
    }
    default: if (typeof HEADGEAR !== 'undefined' && HEADGEAR[L.head]) { HEADGEAR[L.head](p, L, hy, face, main); break; } {
      p.rect(5, hy - 1, 6, 2, L.hair); p.rect(5, hy, 1, 3, L.hair); p.rect(10, hy, 1, 3, L.hair);
      if (!face) p.rect(5, hy, 6, 5, L.hair);
    }
  }
  p.outline();
  return p.sprite(8, 20);
}
function heroSprites(look, key) {
  return spr('hero:' + key, () => rigSet({
    front: [0, 1, 2].map((f) => paintHero(look, 'front', f)),
    back: [0, 1, 2].map((f) => paintHero(look, 'back', f)),
  }, (view, f) => paintHero(look, view, f)));
}

/* ---------- held weapons (pointing right, pivot at the grip) ---------- */
function heldWeapon(id) {
  if (typeof HELD !== 'undefined' && HELD[id]) return spr('held:' + id, () => HELD[id](id));
  return spr('held:' + id, () => {
    let p, ax = 2, ay;
    const blade = (x0, x1, y, w, col = C.steel) => {
      for (let x = x0; x <= x1; x++) for (let j = 0; j < w; j++) p.px(x, y + j, j === 0 ? shade(col, 0.25) : j === w - 1 ? shade(col, -0.25) : col);
      p.px(x1 + 1, y + Math.floor(w / 2), col);
    };
    switch (id) {
      case 'sword': p = new PP(17, 7); p.rect(0, 3, 3, 1, C.wood2); p.rect(3, 1, 1, 5, C.gold2); blade(4, 14, 2, 3); ay = 3; break;
      case 'greatsword': p = new PP(24, 9); p.rect(0, 4, 4, 1, C.wood2); p.rect(4, 1, 2, 7, C.gold2); blade(6, 21, 3, 3, '#e8edf4'); ay = 4; break;
      case 'daggers': p = new PP(11, 5); p.rect(0, 2, 2, 1, C.wood2); p.rect(2, 1, 1, 3, C.gold2); blade(3, 8, 2, 1); p.px(3, 1, C.steel2); ay = 2; break;
      case 'spear': p = new PP(26, 7); p.rect(0, 3, 19, 1, C.wood); p.rect(19, 2, 1, 3, C.gold2); p.rect(20, 2, 3, 3, C.steel); p.rect(23, 3, 2, 1, C.steel); p.px(21, 2, '#ffffff'); ay = 3; break;
      case 'axe': p = new PP(17, 13); p.rect(0, 6, 13, 1, C.wood); p.rect(11, 2, 3, 9, C.steel2); p.rect(13, 1, 2, 11, C.steel); p.px(15, 2, C.steel); p.px(15, 10, C.steel); p.rect(14, 3, 1, 7, '#ffffff'); ay = 6; break;
      case 'hammer': p = new PP(18, 11); p.rect(0, 5, 12, 1, C.wood); p.rect(12, 1, 5, 9, C.steel2); p.rect(12, 1, 5, 1, C.steel); p.rect(16, 1, 1, 9, C.steel3); p.rect(13, 4, 3, 3, '#7a8494'); ay = 5; break;
      case 'scythe': p = new PP(20, 14); p.rect(0, 6, 17, 1, C.wood2); for (let i = 0; i < 9; i++) { p.px(16 - i, 7 + Math.round(Math.sin(i / 8 * 2.2) * 5), C.steel); p.px(16 - i, 6 + Math.round(Math.sin(i / 8 * 2.2) * 5), '#ffffff'); } ay = 6; break;
      case 'gauntlets': p = new PP(8, 7); p.rect(1, 1, 5, 5, C.steel2); p.rect(1, 1, 5, 1, C.steel); p.rect(5, 1, 1, 5, C.steel); p.rect(1, 3, 4, 1, C.steel3); ax = 0; ay = 3; break;
      case 'bow': p = new PP(8, 17); for (let y = 0; y < 17; y++) { const x = 3 + Math.round(Math.sin((y / 16) * Math.PI) * 3); p.px(x, y, C.wood); p.px(x - 1, y, y % 4 ? C.wood : C.wood2); } p.rect(2, 1, 1, 15, '#e8e0cc'); ax = 2; ay = 8; break;
      case 'crossbow': p = new PP(15, 13); p.rect(0, 6, 12, 2, C.wood); p.rect(10, 1, 2, 11, C.wood2); p.rect(4, 6, 8, 1, C.steel2); p.rect(12, 6, 2, 1, C.steel); ay = 6; break;
      case 'knives': p = new PP(9, 4); p.rect(0, 1, 2, 2, C.leather); blade(2, 6, 1, 2); ay = 2; break;
      case 'boomerang': p = new PP(11, 11); for (let i = 0; i < 6; i++) { p.rect(2 + i, 2 + i, 2, 2, C.wood); p.rect(8 - i, 6 + i > 10 ? 10 : 6 + i - 2, 2, 2, C.wood); } p.px(5, 5, C.red); ax = 5; ay = 5; break;
      case 'firestaff': p = new PP(19, 9); p.rect(0, 4, 14, 1, C.wood2); p.rect(13, 3, 1, 3, C.gold2); p.disc(16, 4, 2.4, C.fire); p.disc(16, 4, 1.2, C.fire2); ay = 4; break;
      case 'frostwand': p = new PP(15, 9); p.rect(0, 4, 9, 1, '#cfe9f7'); p.rect(9, 2, 1, 5, '#7fb0d0'); p.rect(10, 3, 3, 3, C.ice); p.px(13, 4, C.ice2); p.px(11, 2, C.ice2); p.px(11, 6, C.ice); ay = 4; break;
      case 'stormrod': p = new PP(18, 9); p.rect(0, 4, 13, 1, '#4a5a7a'); p.rect(12, 3, 1, 3, C.gold); p.disc(15, 4, 2.2, C.storm); p.px(15, 4, '#ffffff'); ay = 4; break;
      case 'venomtome': p = new PP(11, 11); p.rect(2, 1, 8, 9, '#2f5a2a'); p.rect(2, 1, 1, 9, '#1a3a18'); p.rect(3, 2, 6, 7, '#3f7a34'); p.disc(6, 5, 1.6, C.venom); p.px(6, 8, C.venom); ax = 1; ay = 5; break;
      case 'cannon': p = new PP(16, 9); p.rect(0, 4, 5, 2, C.wood); p.rect(4, 3, 9, 3, '#4a4a52'); p.rect(4, 3, 9, 1, '#7a7a86'); p.rect(12, 2, 3, 5, '#5a5a64'); ay = 4; break;
      case 'orb': p = new PP(10, 10); p.disc(5, 5, 3.2, C.arcane); p.disc(4, 4, 1.4, '#e8d8ff'); ax = 1; ay = 5; break;
      default: p = new PP(12, 5); blade(0, 9, 2, 1); ay = 2;
    }
    p.outline();
    return p.sprite(ax, ay);
  });
}

/* ---------- 16px icons ---------- */
function icon(key, fn) {
  return spr('icon:' + key, () => { const p = new PP(16, 16); fn(p); p.outline(); return makeSprite(p.canvas(), 8, 8); });
}
const WICON = {
  sword: (p) => { p.line(4, 11, 12, 3, C.steel); p.line(5, 11, 13, 3, C.steel2); p.line(3, 9, 7, 13, C.gold2); p.line(2, 13, 4, 11, C.wood2); p.px(1, 14, C.gold); },
  greatsword: (p) => { for (let k = 0; k < 3; k++) p.line(4 + k, 12, 13 + k - 1, 2, k === 1 ? C.steel : C.steel2); p.line(2, 9, 7, 14, C.gold2); p.line(1, 14, 3, 12, C.wood2); },
  daggers: (p) => { p.line(3, 12, 9, 6, C.steel); p.line(2, 11, 4, 13, C.gold2); p.line(13, 12, 7, 6, C.steel2); p.line(14, 11, 12, 13, C.gold2); },
  spear: (p) => { p.line(2, 14, 11, 5, C.wood); p.line(11, 5, 14, 2, C.steel); p.line(10, 3, 13, 6, C.steel2); },
  axe: (p) => { p.line(3, 14, 11, 4, C.wood); p.ell(11, 5, 3, 4, C.steel); p.ell(12, 4, 1.4, 2.4, '#ffffff'); },
  hammer: (p) => { p.line(3, 14, 10, 6, C.wood); p.rect(8, 2, 6, 6, C.steel2); p.rect(8, 2, 6, 2, C.steel); },
  scythe: (p) => { p.line(4, 15, 9, 2, C.wood2); for (let i = 0; i < 8; i++) p.px(9 + i * 0.7, 2 + Math.sin(i / 7 * 2.4) * 4, C.steel); },
  gauntlets: (p) => { p.rect(3, 4, 10, 8, C.steel2); p.rect(3, 4, 10, 2, C.steel); p.rect(3, 9, 10, 1, C.steel3); p.rect(4, 12, 8, 2, C.leather); },
  bow: (p) => { for (let i = 0; i < 12; i++) { const a = -0.9 + (i / 11) * 1.8; p.px(6 + Math.cos(a) * 6, 8 + Math.sin(a) * 7, C.wood); } p.line(9, 2, 9, 14, '#e8e0cc'); p.line(3, 8, 13, 8, C.steel2); },
  crossbow: (p) => { p.line(3, 13, 11, 5, C.wood); p.line(6, 3, 14, 11, C.wood2); p.line(9, 8, 13, 4, C.steel); },
  knives: (p) => { p.line(8, 14, 8, 6, C.steel); p.line(8, 14, 3, 7, C.steel2); p.line(8, 14, 13, 7, C.steel2); p.rect(7, 13, 3, 2, C.leather); },
  boomerang: (p) => { p.line(3, 4, 8, 12, C.wood); p.line(4, 4, 9, 12, C.wood); p.line(8, 12, 13, 4, C.wood); p.line(9, 12, 14, 4, C.wood2); },
  firestaff: (p) => { p.line(3, 14, 10, 7, C.wood2); p.disc(11, 5, 3, C.fire); p.disc(11, 5, 1.5, C.fire2); },
  frostwand: (p) => { p.line(3, 14, 9, 8, '#cfe9f7'); p.rect(9, 3, 4, 5, C.ice); p.px(11, 2, C.ice2); p.px(10, 4, C.ice2); },
  stormrod: (p) => { p.line(3, 14, 10, 7, '#4a5a7a'); p.disc(11, 5, 3, C.storm); p.line(10, 3, 12, 6, '#ffffff'); },
  venomtome: (p) => { p.rect(3, 2, 10, 12, '#2f5a2a'); p.rect(4, 3, 8, 10, '#3f7a34'); p.disc(8, 7, 2, C.venom); p.px(8, 11, C.venom); },
  cannon: (p) => { p.line(2, 13, 6, 10, C.wood); p.line(3, 13, 7, 10, C.wood); p.rect(6, 5, 7, 4, '#4a4a52'); p.rect(12, 4, 3, 6, '#5a5a64'); },
  orb: (p) => { p.disc(8, 8, 5, C.arcane); p.disc(6, 6, 2, '#e8d8ff'); p.px(13, 2, '#ffffff'); p.px(2, 13, C.arcane); },
};
const AICON = {
  bash: (p) => { p.ell(8, 8, 5, 6, C.steel2); p.ell(8, 8, 3, 4, '#2f5fa8'); p.line(8, 3, 8, 13, C.gold2); },
  rain: (p) => { for (let i = 0; i < 4; i++) { p.line(3 + i * 3, 2 + (i % 2) * 2, 3 + i * 3, 10 + (i % 2) * 2, C.wood); p.px(3 + i * 3, 11 + (i % 2) * 2, C.steel); } p.rect(1, 14, 14, 1, C.steel2); },
  meteor: (p) => { p.disc(10, 10, 4, C.fire); p.disc(10, 10, 2, C.fire2); p.line(2, 2, 7, 7, '#ff9a3c'); p.line(4, 1, 8, 5, '#ffd08a'); },
  shadowstep: (p) => { p.ell(5, 9, 3, 5, '#3a2c4a'); p.ell(11, 8, 3, 5, '#7a5aa8'); p.px(11, 6, '#ffe08a'); },
  whirlwind: (p) => { for (let i = 0; i < 18; i++) { const a = i * 0.6, r = 1 + i * 0.35; p.px(8 + Math.cos(a) * r, 8 + Math.sin(a) * r, i % 2 ? C.steel : '#ffffff'); } },
  chain: (p) => { p.line(2, 3, 7, 7, C.storm); p.line(7, 7, 5, 9, C.storm); p.line(5, 9, 13, 13, C.storm); p.px(13, 13, '#ffffff'); },
  legion: (p) => { p.ell(8, 6, 4, 3.5, C.bone); p.rect(6, 9, 5, 3, C.bone2); p.px(6, 6, '#1a1214'); p.px(10, 6, '#1a1214'); p.px(6, 6, C.venom); p.px(10, 6, C.venom); },
  fireball: (p) => { p.disc(9, 7, 4, C.fire); p.disc(9, 7, 2, C.fire2); p.line(2, 12, 6, 9, '#c4401c'); p.line(3, 14, 6, 11, '#ff7a2a'); },
  nova: (p) => { for (let i = 0; i < 8; i++) { const a = i * TAU / 8; p.line(8, 8, 8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, i % 2 ? C.ice : C.ice2); } p.disc(8, 8, 1.5, '#ffffff'); },
  slam: (p) => { p.rect(5, 2, 6, 6, C.steel2); p.rect(7, 8, 2, 4, C.wood); p.line(1, 14, 15, 14, C.bone2); p.px(3, 12, C.bone2); p.px(13, 12, C.bone2); },
  fan: (p) => { for (let i = 0; i < 8; i++) { const a = i * TAU / 8; p.line(8 + Math.cos(a) * 2, 8 + Math.sin(a) * 2, 8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, C.steel); } },
  heal: (p) => { p.rect(6, 2, 4, 12, '#ffe8a0'); p.rect(2, 6, 12, 4, '#ffe8a0'); p.rect(7, 3, 2, 10, '#ffffff'); p.rect(3, 7, 10, 2, '#ffffff'); },
  warp: (p) => { p.rect(4, 2, 8, 2, C.gold2); p.rect(4, 12, 8, 2, C.gold2); p.line(5, 4, 11, 11, '#cfe9f7'); p.line(11, 4, 5, 11, '#cfe9f7'); p.px(8, 10, C.gold); },
  turret: (p) => { p.rect(5, 9, 6, 5, '#4a4a6a'); p.ell(8, 6, 3, 3, C.arcane); p.px(8, 5, '#ffffff'); },
  wolf: (p) => { p.ell(8, 9, 5, 4, '#9ff6ff'); p.ell(11, 6, 3, 2.5, '#9ff6ff'); p.px(12, 3, '#9ff6ff'); p.px(10, 3, '#9ff6ff'); p.px(12, 6, '#1a1214'); },
  cloud: (p) => { p.disc(5, 9, 3.5, C.venom); p.disc(10, 8, 4, C.venom2); p.disc(8, 6, 3, C.venom); p.px(9, 9, '#e8ffd0'); },
  barrier: (p) => { for (let i = 0; i < 20; i++) { const a = i * TAU / 20; p.px(8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, C.ice); } p.disc(8, 8, 2, C.ice2); },
};
const TAG_COL = { offense: '#ff8a5c', fire: '#ff7a2a', venom: '#8fe05c', frost: '#9fe0ff', storm: '#fff27a', defense: '#cfd6e0', utility: '#ffd35c', ability: '#b98cff' };
const SICON = {
  offense: (p, c) => { p.line(3, 13, 12, 4, c); p.line(4, 13, 13, 4, shade(c, -0.3)); p.line(3, 10, 6, 13, C.gold2); },
  fire: (p, c) => { p.ell(8, 10, 4, 4, c); p.ell(8, 7, 2.5, 4, c); p.px(8, 2, c); p.ell(8, 10, 2, 2.5, C.fire2); },
  venom: (p, c) => { p.ell(8, 10, 4, 4, c); p.line(8, 2, 5, 8, c); p.line(8, 2, 11, 8, c); p.px(7, 9, '#e8ffd0'); },
  frost: (p, c) => { p.line(8, 2, 8, 14, c); p.line(3, 5, 13, 11, c); p.line(3, 11, 13, 5, c); p.px(8, 8, '#ffffff'); },
  storm: (p, c) => { p.line(10, 1, 5, 8, c); p.line(5, 8, 11, 8, c); p.line(11, 8, 6, 15, c); },
  defense: (p, c) => { p.rect(3, 2, 10, 7, c); p.ell(8, 9, 5, 5, c); p.rect(7, 3, 2, 10, shade(c, -0.35)); },
  utility: (p, c) => { p.rect(4, 3, 5, 9, C.leather); p.rect(4, 11, 9, 3, C.leather); p.line(9, 4, 13, 4, c); p.line(10, 6, 14, 6, c); },
  ability: (p, c) => { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; p.line(8, 8, 8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, c); } p.disc(8, 8, 2, '#ffffff'); },
};
const RICON = {
  phoenix: (p) => { p.line(4, 14, 11, 3, '#ff7a2a'); for (let i = 0; i < 6; i++) p.line(5 + i, 13 - i * 1.5, 9 + i, 12 - i * 1.6, i % 2 ? '#ffd08a' : '#ff9a3c'); },
  fang: (p) => { p.ell(8, 5, 5, 3, '#e8e0cc'); p.line(6, 6, 7, 13, '#f4f0e4'); p.line(10, 6, 9, 13, '#f4f0e4'); p.px(7, 13, C.red); },
  chalice: (p) => { p.ell(8, 5, 5, 3, C.gold); p.ell(8, 5, 3.5, 1.5, C.red); p.rect(7, 8, 2, 4, C.gold2); p.rect(5, 12, 6, 2, C.gold); },
  emberheart: (p) => { p.disc(6, 6, 3, C.fire); p.disc(10, 6, 3, C.fire); p.line(3, 8, 8, 14, C.fire); p.line(13, 8, 8, 14, C.fire); p.ell(8, 9, 3, 3, C.fire); p.px(6, 5, C.fire2); },
  frostcrown: (p) => { p.rect(3, 8, 10, 4, C.ice); p.line(3, 8, 3, 4, C.ice); p.line(8, 8, 8, 2, C.ice2); p.line(13, 8, 13, 4, C.ice); p.px(8, 10, '#ffffff'); },
  idol: (p) => { p.rect(5, 3, 6, 10, '#7a6a4a'); p.rect(4, 13, 8, 2, '#5a4a32'); p.px(6, 6, C.storm); p.px(9, 6, C.storm); p.line(7, 9, 9, 9, '#3a2a1a'); },
  coin: (p) => { p.disc(8, 8, 5.5, C.gold); p.disc(8, 8, 3.5, C.gold2); p.rect(7, 5, 2, 6, C.gold); },
  hourglass: (p) => { p.rect(4, 2, 8, 1, C.wood); p.rect(4, 13, 8, 1, C.wood); p.line(5, 3, 8, 8, '#cfe9f7'); p.line(11, 3, 8, 8, '#cfe9f7'); p.line(5, 12, 8, 8, '#cfe9f7'); p.line(11, 12, 8, 8, '#cfe9f7'); p.rect(6, 10, 4, 2, C.gold); },
  mirror: (p) => { p.line(4, 3, 12, 6, '#cfe9f7'); p.line(12, 6, 9, 13, '#9fb8cc'); p.line(9, 13, 4, 3, '#ffffff'); p.px(8, 7, '#ffffff'); },
  totem: (p) => { p.rect(6, 2, 4, 12, C.wood); p.px(7, 4, C.ice); p.px(8, 4, C.ice); p.rect(4, 6, 8, 1, C.wood2); p.px(4, 5, C.wood); p.px(11, 5, C.wood); },
  blades: (p) => { p.line(3, 3, 7, 7, C.steel); p.line(13, 13, 9, 9, C.steel); p.disc(8, 8, 1.5, C.gold); for (let i = 0; i < 10; i++) { const a = i * TAU / 10; p.px(8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, '#5a6070'); } },
  thorncrown: (p) => { p.ell(8, 9, 6, 3, '#3a5a2a'); for (let i = 0; i < 5; i++) p.line(3 + i * 2.5, 8, 3 + i * 2.5, 4, '#6a8a3a'); },
  glasseye: (p) => { p.ell(8, 8, 6, 4, '#ffffff'); p.disc(8, 8, 2.5, '#58aaff'); p.disc(8, 8, 1, '#1a1214'); },
  boots: (p) => { p.rect(4, 2, 5, 10, C.steel2); p.rect(4, 10, 9, 4, C.steel2); p.rect(4, 2, 5, 1, C.steel); },
  wings: (p) => { p.rect(5, 6, 4, 7, C.leather); p.rect(5, 12, 7, 2, C.leather); p.line(9, 4, 14, 2, '#ffffff'); p.line(9, 6, 14, 5, '#e8e8f0'); },
  satchel: (p) => { p.rect(3, 6, 10, 8, C.leather); p.rect(3, 6, 10, 2, shade(C.leather, 0.2)); p.line(4, 6, 8, 2, C.wood2); p.line(12, 6, 8, 2, C.wood2); p.disc(8, 10, 1.5, C.red); },
  seal: (p) => { p.disc(8, 8, 5, '#c43a3a'); p.disc(8, 8, 3, '#e05050'); p.rect(7, 6, 2, 4, C.gold); },
  keyring: (p) => { p.disc(5, 5, 3, C.gold); p.disc(5, 5, 1.5, '#00000000'); p.line(7, 7, 13, 13, C.gold); p.line(11, 13, 13, 11, C.gold); p.line(10, 12, 11, 11, C.gold); },
  skull: (p) => { p.ell(8, 7, 5, 4.5, '#d8d0bc'); p.rect(5, 11, 6, 3, '#c8c0aa'); p.disc(6, 7, 1.3, '#4a1a2a'); p.disc(10, 7, 1.3, '#4a1a2a'); p.px(6, 7, C.venom); p.px(10, 7, C.venom); },
  powder: (p) => { p.rect(3, 5, 10, 9, '#6a4a2a'); p.rect(3, 7, 10, 1, '#3a2a1a'); p.rect(3, 11, 10, 1, '#3a2a1a'); p.line(8, 5, 10, 1, C.bone2); p.px(10, 1, C.fire); },
  halo: (p) => { for (let i = 0; i < 18; i++) { const a = i * TAU / 18; p.px(8 + Math.cos(a) * 6, 8 + Math.sin(a) * 2.5, C.gold); } p.px(8, 11, '#ffffff'); },
  echostone: (p) => { p.ell(8, 9, 5, 5, '#6a6a8a'); p.ell(7, 8, 2, 2, '#9a9ac8'); p.line(4, 4, 6, 6, C.arcane); p.line(12, 4, 10, 6, C.arcane); },
  mark: (p) => { for (let i = 0; i < 16; i++) { const a = i * TAU / 16; p.px(8 + Math.cos(a) * 5, 8 + Math.sin(a) * 5, C.red); } p.line(8, 1, 8, 5, C.red); p.line(8, 11, 8, 15, C.red); p.line(1, 8, 5, 8, C.red); p.line(11, 8, 15, 8, C.red); },
  lantern: (p) => { p.rect(5, 4, 6, 9, '#3a3a44'); p.rect(6, 5, 4, 7, '#9cf0d8'); p.line(6, 4, 8, 1, '#3a3a44'); p.line(10, 4, 8, 1, '#3a3a44'); },
  gauntlet: (p) => { p.rect(4, 3, 8, 9, C.gold); p.rect(4, 3, 8, 2, '#fff0a0'); p.rect(4, 10, 8, 1, C.gold2); p.rect(5, 12, 6, 2, C.wood2); },
  cloak: (p) => { p.line(8, 2, 3, 14, '#3a5a2a'); p.line(8, 2, 13, 14, '#3a5a2a'); p.rect(5, 8, 6, 6, '#4a7a34'); p.px(5, 11, '#8a5a32'); p.px(10, 9, '#8a5a32'); },
};
const weaponIcon = (id) => (typeof evolvedIcon === 'function' && WEAPON[id] && WEAPON[id].evolved && !WICON[id] ? evolvedIcon(id) : icon('w:' + id, WICON[id] || WICON.sword));
const abilityIcon = (id) => icon('a:' + id, AICON[id] || AICON.fan);
const skillIcon = (tag) => icon('s:' + tag, (p) => (SICON[tag] || SICON.offense)(p, TAG_COL[tag] || '#ffffff'));
const relicIcon = (id) => icon('r:' + id, RICON[id] || RICON.coin);
const MISC_ICON = {
  gold: (p) => { p.disc(8, 8, 5, C.gold); p.disc(8, 8, 3, C.gold2); p.rect(7, 6, 2, 4, C.gold); },
  key: (p) => { p.disc(5, 6, 3, C.gold); p.px(5, 6, '#1a1214'); p.line(7, 8, 13, 14, C.gold); p.line(11, 14, 13, 12, C.gold); },
  potion: (p) => { p.rect(6, 2, 4, 3, '#b8a080'); p.ell(8, 10, 5, 4.5, '#9ad8f8'); p.ell(8, 11, 4, 3, C.red); p.px(6, 9, '#ffffff'); },
  ember: (p) => { p.ell(8, 10, 4, 4, C.fire); p.ell(8, 7, 2.5, 4.5, C.fire); p.px(8, 2, C.fire2); p.ell(8, 10, 2, 2.5, C.fire2); },
  heart: (p) => { p.disc(5, 6, 3, C.red); p.disc(11, 6, 3, C.red); p.line(2, 7, 8, 13, C.red); p.line(14, 7, 8, 13, C.red); p.ell(8, 9, 4, 3, C.red); p.px(5, 5, '#ffb0b8'); },
  dash: (p) => { p.line(2, 8, 12, 8, C.ice); p.line(9, 5, 13, 8, C.ice); p.line(9, 11, 13, 8, C.ice); p.line(3, 5, 7, 5, C.ice2); p.line(3, 11, 7, 11, C.ice2); },
  swap: (p) => { p.line(3, 5, 13, 5, '#f1e5cd'); p.line(10, 2, 13, 5, '#f1e5cd'); p.line(3, 11, 13, 11, '#f1e5cd'); p.line(6, 14, 3, 11, '#f1e5cd'); },
  skull: (p) => { p.ell(8, 7, 5, 4.5, C.bone); p.rect(5, 11, 6, 3, C.bone2); p.disc(6, 7, 1.3, '#1a1214'); p.disc(10, 7, 1.3, '#1a1214'); },
  heat: (p) => { p.ell(8, 10, 4.5, 4, '#ff4a2a'); p.ell(8, 7, 3, 5, '#ff4a2a'); p.ell(8, 10, 2.5, 2.5, C.fire2); p.px(8, 1, '#ff4a2a'); },
  rune: (p) => { p.ell(8, 8, 5, 6, '#5a5a78'); p.ell(7, 7, 2, 2, '#8a8ab0'); p.line(6, 5, 10, 11, C.arcane); p.line(10, 5, 6, 11, C.arcane); },
};
const miscIcon = (id) => icon('m:' + id, MISC_ICON[id]);
const iconURL = (sp, scale = 1) => {
  if (sp._url && sp._urlScale === scale) return sp._url;
  const c = mkCanvas(sp.w * scale, sp.h * scale), g = c.getContext('2d');
  g.imageSmoothingEnabled = false; g.drawImage(sp.c, 0, 0, c.width, c.height);
  sp._urlScale = scale;
  return (sp._url = c.toDataURL());
};

/* ---------- pickups and props ---------- */
function pickupSprite(kind) {
  return spr('pk:' + kind, () => {
    const p = new PP(10, 10);
    switch (kind) {
      case 'gold': p.disc(5, 5, 3, C.gold); p.disc(5, 5, 1.6, C.gold2); p.px(4, 4, '#fff8c0'); break;
      case 'gold5': p.disc(4, 6, 3, C.gold2); p.disc(6, 4, 3, C.gold); p.px(5, 3, '#fff8c0'); break;
      case 'xp': p.px(5, 2, '#d8f6ff'); p.rect(4, 3, 3, 4, '#5ac8f0'); p.px(5, 7, '#2a88c8'); p.px(3, 5, '#5ac8f0'); p.px(7, 5, '#3aa8e0'); p.px(4, 3, '#ffffff'); break;
      case 'xpbig': p.ell(5, 5, 3, 4, '#c873ff'); p.px(4, 3, '#ffffff'); p.px(5, 4, '#e8c8ff'); break;
      case 'heart': p.disc(3, 4, 2, C.red); p.disc(7, 4, 2, C.red); p.ell(5, 6, 3, 2, C.red); p.px(5, 8, C.red); p.px(3, 3, '#ffb0b8'); break;
      case 'potion': p.rect(4, 1, 2, 2, '#b8a080'); p.ell(5, 6, 3.5, 3, '#9ad8f8'); p.ell(5, 7, 2.5, 2, C.red); p.px(4, 5, '#ffffff'); break;
      case 'key': p.disc(3, 3, 2, C.gold); p.px(3, 3, '#00000000'); p.line(4, 4, 8, 8, C.gold); p.px(7, 9, C.gold); p.px(8, 7, C.gold); break;
      case 'ember': p.ell(5, 6, 3, 3, C.fire); p.ell(5, 4, 2, 3, C.fire); p.px(5, 1, C.fire2); p.ell(5, 6, 1.5, 1.5, C.fire2); break;
    }
    p.outline();
    return p.sprite(5, 9);
  });
}
function chestSprite(kind, open) {
  return spr(`chest:${kind}:${open ? 1 : 0}`, () => {
    const p = new PP(18, 15);
    const body = kind === 'gold' ? '#c8901c' : kind === 'silver' ? '#8a94a8' : '#8a5a32', band = kind === 'gold' ? '#ffd35c' : kind === 'silver' ? '#dde3ec' : '#5a3a1e';
    p.rect(2, 7, 14, 7, body); p.rect(2, 13, 14, 1, shade(body, -0.35));
    if (!open) { p.rect(2, 3, 14, 5, shade(body, 0.12)); p.rect(2, 3, 14, 1, shade(body, 0.3)); p.rect(2, 7, 14, 1, shade(body, -0.3)); }
    else { p.rect(2, 1, 14, 3, shade(body, -0.1)); p.rect(3, 6, 12, 2, '#1a0e0c'); p.rect(4, 6, 10, 1, '#ffd35c'); }
    p.rect(4, open ? 1 : 3, 2, open ? 3 : 11, band); p.rect(12, open ? 1 : 3, 2, open ? 3 : 11, band);
    if (open) { p.rect(4, 7, 2, 7, band); p.rect(12, 7, 2, 7, band); }
    if (!open) { p.rect(8, 6, 2, 3, band); p.px(8, 7, '#1a1214'); }
    p.outline();
    return p.sprite(9, 14);
  });
}
// a lid partway up its hinge: less of its top shows, and a sliver of the dark inside
function chestLidSprite(kind, step) {
  return spr(`chestlid:${kind}:${step}`, () => {
    const p = new PP(18, 15);
    const body = kind === 'gold' ? '#c8901c' : kind === 'silver' ? '#8a94a8' : '#8a5a32', band = kind === 'gold' ? '#ffd35c' : kind === 'silver' ? '#dde3ec' : '#5a3a1e';
    p.rect(2, 7, 14, 7, body); p.rect(2, 13, 14, 1, shade(body, -0.35));
    const lh = step === 1 ? 4 : 2, ly = step === 1 ? 2 : 1;
    p.rect(3, ly + lh, 12, 7 - ly - lh + 1, '#1a0e0c'); if (step === 2) p.rect(4, 6, 10, 1, '#ffd35c');
    p.rect(2, ly, 14, lh, shade(body, step === 1 ? 0.12 : -0.05)); p.rect(2, ly, 14, 1, shade(body, step === 1 ? 0.3 : 0.1));
    p.rect(4, ly, 2, lh, band); p.rect(12, ly, 2, lh, band); p.rect(4, 7, 2, 7, band); p.rect(12, 7, 2, 7, band);
    p.outline();
    return p.sprite(9, 14);
  });
}
function propSprite(kind, act = 0, v = 0) {
  return spr(`prop:${kind}:${act}:${v}`, () => {
    const A = ACTS[act % ACTS.length], pal = A.pal;
    let p, ax, ay;
    switch (kind) {
      case 'crate': p = new PP(14, 15); p.rect(1, 3, 12, 11, '#8a5a32'); p.rect(1, 3, 12, 2, '#a8743e'); p.rect(1, 3, 1, 11, '#a8743e'); p.line(2, 5, 11, 13, '#5e3a1e'); p.rect(1, 13, 12, 1, '#5e3a1e'); break;
      case 'barrel': p = new PP(13, 15); p.ell(6, 8, 5, 6, '#8a5a32'); p.rect(1, 4, 11, 1, '#4a4a52'); p.rect(1, 11, 11, 1, '#4a4a52'); p.ell(6, 3, 4.5, 1.6, '#a8743e'); p.px(3, 7, '#a8743e'); break;
      case 'pot': { p = new PP(12, 13); const c = act === 1 ? '#7a5a8a' : act === 2 ? '#7a9ab8' : act === 3 ? '#8a3a2a' : '#a86a3a'; p.ell(6, 8, 4.5, 4, c); p.rect(4, 2, 4, 3, c); p.rect(3, 2, 6, 1, shade(c, 0.2)); p.px(4, 7, shade(c, 0.3)); p.rect(3, 9, 6, 1, shade(c, -0.3)); break; }
      case 'pillar': {
        p = new PP(16, 34);
        const s = pal.wall;
        p.rect(3, 6, 10, 24, s); p.rect(3, 6, 2, 24, shade(s, 0.15)); p.rect(11, 6, 2, 24, shade(s, -0.25));
        p.rect(2, 3, 12, 4, shade(s, 0.1)); p.rect(2, 3, 12, 1, shade(s, 0.25)); p.rect(2, 29, 12, 4, shade(s, -0.1));
        if (act === 1) for (let y = 8; y < 28; y += 3) p.px(4 + (y % 2), y, pal.moss);
        if (act === 2) { p.rect(2, 3, 12, 2, '#eef9ff'); p.px(5, 5, '#ffffff'); }
        if (act === 3) for (let y = 10; y < 28; y++) if (y % 5 < 3) p.px(8 + ((y / 5) | 0) % 2, y, '#ff7a2a');
        ax = 8; ay = 32; break;
      }
      case 'rock': p = new PP(16, 14); p.ball(8, 8, 7, 5.5, act === 2 ? '#b8d0e4' : act === 3 ? '#3a2a26' : act === 1 ? '#5a6a5e' : '#6a6672'); if (act === 3) { p.px(6, 9, '#ff7a2a'); p.px(10, 7, '#ff9a3c'); } ax = 8; ay = 13; break;
      case 'torch': p = new PP(8, 12); p.rect(3, 5, 2, 7, '#5e3a1e'); p.rect(2, 4, 4, 2, '#4a4a52'); ax = 4; ay = 11; break;
      case 'candles': p = new PP(14, 10); [[3, 4], [7, 2], [10, 5]].forEach(([x, h], i) => { p.rect(x, 9 - h, 2, h, '#efe3c0'); p.px(x, 9 - h, '#ffffff'); }); p.rect(1, 9, 12, 1, '#c8bfa8'); ax = 7; ay = 9; break;
      case 'brazier': p = new PP(14, 14); p.ell(7, 6, 6, 2.5, '#4a4a52'); p.rect(3, 7, 8, 3, '#3a3a42'); p.line(4, 10, 2, 13, '#3a3a42'); p.line(10, 10, 12, 13, '#3a3a42'); p.rect(4, 5, 6, 1, '#ff9a3c'); ax = 7; ay = 13; break;
      case 'mushroom': { p = new PP(16, 18); const cap = v % 2 ? '#c58cff' : '#5fe0c0'; p.rect(7, 9, 3, 8, '#e8dcc8'); p.rect(7, 9, 1, 8, '#ffffff'); p.ell(8, 7, 7, 4, cap); p.ell(8, 6, 5, 2.5, shade(cap, 0.25)); p.px(5, 6, '#ffffff'); p.px(11, 7, '#ffffff'); p.px(8, 4, '#ffffff'); ax = 8; ay = 17; break; }
      case 'icecrystal': p = new PP(14, 20); p.line(7, 2, 4, 18, C.ice); p.line(7, 2, 10, 18, C.ice); for (let y = 4; y < 18; y++) p.line(7 - (y - 2) * 0.2, y, 7 + (y - 2) * 0.2, y, y % 3 ? C.ice : C.ice2); p.line(7, 3, 7, 17, '#ffffff'); p.line(2, 10, 4, 18, '#7fc0e8'); p.line(12, 9, 10, 18, '#7fc0e8'); ax = 7; ay = 19; break;
      case 'bones': p = new PP(16, 10); p.line(2, 7, 10, 5, C.bone); p.line(5, 8, 13, 8, C.bone2); p.ell(12, 5, 2.5, 2, C.bone); p.px(11, 5, '#1a1214'); ax = 8; ay = 9; break;
      case 'statue': p = new PP(16, 30); p.rect(2, 24, 12, 6, shade(pal.wall, -0.1)); p.rect(2, 24, 12, 1, shade(pal.wall, 0.2)); p.ell(8, 8, 3.5, 3.5, pal.wall); p.rect(5, 11, 6, 13, pal.wall); p.rect(5, 11, 2, 13, shade(pal.wall, 0.15)); p.rect(3, 13, 2, 7, pal.wall); p.rect(11, 13, 2, 7, shade(pal.wall, -0.2)); p.line(13, 6, 13, 22, C.steel2); ax = 8; ay = 29; break;
      case 'altar': p = new PP(22, 18); p.rect(2, 8, 18, 9, '#4a3a4a'); p.rect(2, 8, 18, 2, '#6a5a6a'); p.rect(4, 10, 14, 1, '#2a1e2a'); p.rect(8, 3, 6, 5, '#3a2a3a'); ax = 11; ay = 17; break;
      case 'anvil': p = new PP(20, 14); p.rect(3, 3, 14, 4, '#4a4a52'); p.rect(3, 3, 14, 1, '#7a7a86'); p.rect(15, 4, 4, 2, '#4a4a52'); p.rect(7, 7, 6, 4, '#3a3a42'); p.rect(4, 11, 12, 3, '#3a3a42'); ax = 10; ay = 13; break;
      case 'fountain': p = new PP(26, 20); p.ell(13, 13, 12, 6, '#7a7686'); p.ell(13, 12, 10, 4.5, '#5ab8e8'); p.ell(13, 11, 6, 2, '#9ad8f8'); p.rect(11, 3, 4, 9, '#8a8696'); p.ell(13, 3, 4, 2, '#9a96a6'); ax = 13; ay = 19; break;
      case 'shrine': { p = new PP(18, 26); const c = v === 0 ? '#e2434f' : v === 1 ? '#ffd35c' : v === 3 ? '#ff4ad0' : '#b98cff'; p.rect(3, 18, 12, 7, '#4a4050'); p.rect(3, 18, 12, 1, '#6a6070'); p.rect(6, 6, 6, 12, '#5a5062'); p.rect(6, 6, 2, 12, '#6a6074'); p.disc(9, 4, 3.2, c); p.px(8, 3, '#ffffff'); ax = 9; ay = 25; break; }
      case 'stairs': p = new PP(30, 22); p.rect(1, 1, 28, 20, '#050305'); for (let i = 0; i < 5; i++) p.rect(3 + i * 2, 3 + i * 3, 24 - i * 4, 2, shade(pal.floor, -0.2 - i * 0.12)); p.rect(1, 1, 28, 1, shade(pal.floor, 0.1)); ax = 15; ay = 21; break;
      case 'rug': p = new PP(48, 30); p.rect(0, 0, 48, 30, '#6a2a2a'); p.rect(2, 2, 44, 26, '#8a3a32'); p.rect(4, 4, 40, 22, '#6a2a2a'); for (let i = 0; i < 8; i++) p.px(8 + i * 4.5, 15, '#ffd35c'); ax = 24; ay = 15; break;
      case 'table': p = new PP(22, 14); p.rect(1, 3, 20, 6, '#8a5a32'); p.rect(1, 3, 20, 1, '#a8743e'); p.rect(2, 9, 2, 5, '#5e3a1e'); p.rect(18, 9, 2, 5, '#5e3a1e'); ax = 11; ay = 13; break;
      case 'pedestal': p = new PP(14, 12); p.rect(2, 4, 10, 8, '#5a5062'); p.rect(1, 3, 12, 2, '#7a7084'); p.rect(2, 11, 10, 1, '#3a3042'); ax = 7; ay = 11; break;
      case 'web': p = new PP(20, 20); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; p.line(10, 10, 10 + Math.cos(a) * 9, 10 + Math.sin(a) * 9, '#e8e8f0', 140); } for (let r = 3; r < 10; r += 3) for (let i = 0; i < 24; i++) { const a = i * TAU / 24; p.px(10 + Math.cos(a) * r, 10 + Math.sin(a) * r, '#e8e8f0', 120); } ax = 10; ay = 10; break;
      case 'lavarock': p = new PP(14, 10); p.ball(7, 6, 6, 4, '#2a1a16'); p.px(5, 6, '#ff7a2a'); p.px(9, 5, '#ffb35e'); ax = 7; ay = 9; break;
      case 'banner': p = new PP(10, 16); p.rect(1, 0, 8, 1, '#5e3a1e'); p.rect(2, 1, 6, 12, pal.accent === '#c8b48a' ? '#7a2a32' : shade(pal.accent, -0.4)); p.px(3, 13, shade(pal.accent, -0.4)); p.px(6, 13, shade(pal.accent, -0.4)); p.px(4, 14, shade(pal.accent, -0.4)); p.disc(5, 6, 1.5, C.gold); ax = 5; ay = 0; break;
      case 'spikes': { p = new PP(16, 16); p.rect(1, 1, 14, 14, shade(pal.floor, -0.25)); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) p.px(3 + i * 3.4, 3 + j * 3.4, '#0a0608'); if (v) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const x = 3 + i * 3.4, y = 3 + j * 3.4; p.px(x, y - 2, C.steel); p.px(x, y - 1, C.steel2); p.px(x, y, C.steel3); } ax = 8; ay = 8; break; }
      default: if (typeof PROP_ART !== 'undefined' && PROP_ART[kind]) { [p, ax, ay] = PROP_ART[kind](pal, v, act); break; } p = new PP(8, 8); p.rect(0, 0, 8, 8, '#ff00ff');
    }
    if (!['rug', 'stairs', 'web', 'spikes'].includes(kind)) p.outline();
    return p.sprite(ax ?? p.w / 2, ay ?? p.h - 1);
  });
}
// the merchant and the forge-keeper share one painter
const npcLookOf = (kind) => kind === 'smith'
  ? { skin: '#d79c74', hair: '#3a2a20', main: '#5a4a3a', dark: '#3a2a20', trim: '#c8901c', cloth: '#4a3a2a', head: 'none', eye: '#1a1214', bare: true }
  : { skin: '#9ad08a', hair: '#e8d8b0', main: '#6a3a8a', dark: '#4a2a6a', trim: '#ffd35c', cloth: '#6a3a8a', head: 'wizard', eye: '#ffe08a' };
function npcSprite(kind, frame = 0) {
  return spr(`npc:${kind}:${frame}`, () => paintHero(npcLookOf(kind), 'front', frame));
}

