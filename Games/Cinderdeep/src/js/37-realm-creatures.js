/* ============================================================
   Cinderdeep — realm creatures. Sixteen body plans, each with
   variants, painted at any size so the same plan makes a wolf
   pup or a boss three times taller than you.
   ============================================================ */
const FAM_SIZE = {
  slime: [16, 14], quad: [22, 16], biped: [16, 21], insect: [18, 14], spider: [18, 14], bird: [18, 14], bat: [16, 12], serpent: [24, 14],
  plant: [16, 22], fungus: [16, 18], wisp: [14, 16], golem: [20, 22], ghost: [16, 17], crab: [20, 13], toad: [20, 16], horror: [18, 18],
};
const VAR_SIZE = { horse: [24, 20], bear: [24, 18], mammoth: [30, 24], lizard: [24, 12], croc: [28, 12], salamander: [24, 12], stag: [22, 22], elk: [24, 24], lion: [24, 17], tanuki: [18, 15], ram: [20, 17], scorpion: [22, 14], strider: [22, 18], moth: [18, 16], worm: [22, 22], hermit: [22, 18], frog: [16, 12], walker: [18, 24], tentacle: [14, 24], brute: [22, 24], elemental: [16, 20], jelly: [14, 18], pixie: [12, 12], spark: [12, 12], eye: [18, 20], blob: [18, 16], giant: [16, 21], hawk: [20, 14], harpy: [18, 18] };
function creatureSize(fam, v, k) { const [w, h] = VAR_SIZE[v] || FAM_SIZE[fam] || [16, 16]; return [Math.max(8, Math.round(w * k)), Math.max(8, Math.round(h * k))]; }

function paintCreature(P, def, f) {
  const [bw, bh] = VAR_SIZE[def.v] || FAM_SIZE[def.fam] || [16, 16];
  const sx = P.w / bw, sy = P.h / bh, s = (sx + sy) / 2;
  const [c1, c2, c3] = def.c;
  const X = (x) => x * sx, Y = (y) => y * sy;
  const E = (x, y, rx, ry, c, a) => P.ell(X(x), Y(y), Math.max(0.6, rx * sx), Math.max(0.6, ry * sy), c, a);
  const B = (x, y, rx, ry, c, hl = 0.32, sh = -0.32) => P.ball(X(x), Y(y), Math.max(0.6, rx * sx), Math.max(0.6, ry * sy), c, hl, sh);
  const D = (x, y, r, c, a) => P.disc(X(x), Y(y), Math.max(0.5, r * s), c, a);
  const Rr = (x, y, w, h, c, a) => P.rect(Math.round(X(x)), Math.round(Y(y)), Math.max(1, Math.round(w * sx)), Math.max(1, Math.round(h * sy)), c, a);
  const L = (x0, y0, x1, y1, c, t = 1) => { const th = Math.max(1, t * s); if (th <= 1.3) { P.line(X(x0), Y(y0), X(x1), Y(y1), c); return; } const n = Math.ceil(Math.hypot(X(x1) - X(x0), Y(y1) - Y(y0))); for (let i = 0; i <= n; i++) P.disc(lerp(X(x0), X(x1), i / n), lerp(Y(y0), Y(y1), i / n), th / 2, c); };
  const Poly = (pts, c, a) => P.poly(pts.map(([x, y]) => [X(x), Y(y)]), c, a);
  const eye = (x, y, c = c3, white) => { if (white && s >= 1.6) D(x, y, 0.9, '#ffffff'); D(x, y, s >= 2 ? 0.55 : 0.45, c); if (s >= 2.2) P.px(X(x) - 1, Y(y) - 1, '#ffffff'); };
  const step = f === 1 ? 1 : 0, atk = f === 2;
  const v = def.v;
  // rig tags: which part is being painted, and where a limb that splays out joins the body
  const T = (n) => rigPart(P, n), RT = (x, y) => rigRoot(P, X(x), Y(y));
  switch (def.fam) {
    case 'slime': {
      rigOrient(P, 'front', 1.4);
      const sq = f === 1 ? 0.8 : 0;
      B(8, 8.5 + sq, 6.6 + sq * 0.5, 5 - sq, c1, 0.42, -0.3);
      Rr(2, 13, 12, 1, shade(c1, -0.35));
      if (v === 'pumpkin') { for (const x of [5, 8, 11]) L(x, 4.5 + sq, x, 12, shade(c1, -0.22)); Rr(7.5, 2 + sq, 1, 2.5, c3); E(9.5, 3 + sq, 1.6, 0.8, c3); }
      if (v === 'crystal') { for (const [x, h] of [[5, 4], [8, 6], [11, 4]]) Poly([[x - 1.2, 5 + sq], [x + 1.2, 5 + sq], [x, 5 + sq - h]], c3); }
      if (v === 'magma') for (let i = 0; i < 4; i++) D(4 + i * 2.5, 9 + (i % 2), 0.7, c3);
      if (v === 'bog') { D(5, 5 + sq, 1, shade(c1, 0.25)); D(11, 7 + sq, 0.8, shade(c1, 0.25)); }
      T('face'); eye(6, 8 + sq, '#1a1214', true); eye(10, 8 + sq, '#1a1214', true);
      if (atk) Rr(6.5, 11, 3, 1, '#1a1214');
      break;
    }
    case 'quad': {
      rigOrient(P, 'side');
      const isLow = v === 'lizard' || v === 'croc' || v === 'salamander', heavy = v === 'bear' || v === 'mammoth' || v === 'boar';
      const bwid = VAR_SIZE[v] ? VAR_SIZE[v][0] : 22, bhei = VAR_SIZE[v] ? VAR_SIZE[v][1] : 16;
      const tall = v === 'stag' || v === 'elk' || v === 'horse';
      const foot = bhei - 1, bodyRx = isLow ? bwid * 0.32 : bwid * (heavy ? 0.36 : 0.3), bodyRy = isLow ? 2.6 : heavy ? bhei * 0.25 : bhei * 0.24;
      const bodyY = isLow ? bhei - 5 : heavy ? foot - bodyRy - (v === 'mammoth' ? 5 : 3.4) : bhei - 7 - (tall ? 3 : 0);
      const cx = bwid * 0.46, legTop = bodyY + bodyRy * (heavy ? 0.3 : 0.6);
      // tail
      T('tail'); if (isLow) Poly([[cx - bodyRx + 1, bodyY - 1], [cx - bodyRx + 1, bodyY + 1.5], [1, bodyY + 1.5 + step * 0.5]], shade(c1, -0.1));
      else if (v === 'fox' || v === 'wolf' || v === 'hound' || v === 'hyena' || v === 'tanuki') { L(cx - bodyRx + 1, bodyY - 1, cx - bodyRx - 3, bodyY - 3 + step, c1, 2.2); if (v === 'fox') D(cx - bodyRx - 3, bodyY - 3 + step, 1.2, '#ffffff'); if (v === 'tanuki') for (let i = 0; i < 2; i++) D(cx - bodyRx - 1 - i * 1.4, bodyY - 1.8 - i * 0.8, 0.7, c2); }
      else if (v === 'lion' || v === 'cat') { L(cx - bodyRx + 1, bodyY, cx - bodyRx - 4, bodyY - 4 + step * 2, c1, 1); if (v === 'lion') D(cx - bodyRx - 4, bodyY - 4, 1, c2); }
      else if (v === 'bonehound') L(cx - bodyRx + 1, bodyY - 1, cx - bodyRx - 3, bodyY - 2, c1, 1);
      else if (v === 'horse') { L(cx - bodyRx + 1, bodyY - 1, cx - bodyRx - 2.4, bodyY + 4 + step * 0.6, c2, 1.6); }
      // legs: back pair darker
      const legs = isLow ? [[cx - bodyRx * 0.6, 0], [cx + bodyRx * 0.55, 1]] : [[cx - bodyRx * 0.6, 0], [cx - bodyRx * 0.35, 1], [cx + bodyRx * 0.4, 0], [cx + bodyRx * 0.65, 1]];
      const lw = v === 'mammoth' ? 3.4 : heavy ? 2.6 : v === 'stag' || v === 'elk' || v === 'cat' ? 1.2 : v === 'horse' ? 1.5 : 1.6;
      legs.forEach(([lx, ph], i) => { const off = (ph === step ? -1 : 0.5) * (atk ? 0 : 1); T(i % 2 ? 'leg:n' : 'leg:f'); L(lx, legTop, lx + off * 0.6, foot - (ph === step ? 0.6 : 0), i % 2 ? c1 : shade(c1, -0.25), lw); Rr(lx + off * 0.6 - lw / 2, foot, lw + 0.4, 1, shade(c2, -0.2)); });
      // body
      T('body'); B(cx, bodyY, bodyRx, bodyRy, c1);
      if (heavy) {
        // a shoulder hump, a darker belly and a coat of fur
        if (v !== 'boar') B(cx + bodyRx * 0.32, bodyY - bodyRy * 0.5, bodyRx * 0.5, bodyRy * 0.7, c1, 0.38, -0.2);
        E(cx, bodyY + bodyRy * 0.62, bodyRx * 0.72, bodyRy * 0.28, shade(c1, -0.22));
        for (let i = 0; i < 9; i++) { const fx = cx - bodyRx * 0.7 + (i % 5) * bodyRx * 0.34 + (i > 4 ? bodyRx * 0.17 : 0), fy = bodyY - bodyRy * 0.35 + (i > 4 ? bodyRy * 0.45 : 0); L(fx, fy, fx - 0.7, fy + 1.1, shade(c1, -0.2), 0.6); }
      }
      if (v === 'bonehound') { for (let i = 0; i < 4; i++) Rr(cx - 3 + i * 2, bodyY - 1.5, 1, 3, '#2a2228'); }
      if (v === 'hyena' || v === 'cat' && false) for (let i = 0; i < 4; i++) D(cx - 3 + i * 2.2, bodyY - 0.5 + (i % 2), 0.6, c2);
      if (v === 'tanuki') E(cx, bodyY + 1.5, bodyRx * 0.6, 1.4, c3);
      if (v === 'mammoth' || v === 'ram') for (let i = 0; i < 7; i++) D(cx - bodyRx + 2 + i * (bodyRx / 3.4), bodyY + bodyRy * 0.5, 1.1, shade(c1, -0.12));
      if (v === 'boar') for (let i = 0; i < 5; i++) L(cx - 3 + i * 1.6, bodyY - bodyRy, cx - 3.6 + i * 1.6, bodyY - bodyRy - 1.4, c2, 0.8);
      if (v === 'salamander') for (let i = 0; i < 4; i++) D(cx - 4 + i * 2.6, bodyY - 0.8, 0.6, c3);
      // head
      T('head'); const hx = cx + bodyRx * 0.9 + (v === 'bear' ? 1.4 : 0) + (atk ? 1.2 : 0), hy = isLow ? bodyY - 0.4 : (v === 'bear' ? bodyY - bodyRy * 0.3 : v === 'boar' ? bodyY + bodyRy * 0.05 : bodyY - bodyRy * 0.9) + (atk ? 1.2 : 0);
      if (v === 'lion') B(hx - 0.5, hy, 4.2, 4, c2);
      if (v === 'mammoth') { B(hx, hy, 4.4, 4, c1); L(hx + 3, hy + 1, hx + 4.5, foot - 3, shade(c1, -0.15), 2); L(hx + 2, hy + 2, hx + 6, hy + 4 - (atk ? 2 : 0), c3, 1.2); }
      else if (isLow) { B(hx, hy, 3.4, 2.2, c1); Poly([[hx + 1, hy - 1.2], [hx + (v === 'croc' ? 7.5 : 4.5), hy - 0.2], [hx + (v === 'croc' ? 7.5 : 4.5), hy + (atk ? 2.4 : 1)], [hx + 1, hy + 1.6]], c1); if (v === 'croc') for (let i = 0; i < 3; i++) P.px(X(hx + 2.4 + i * 1.6), Y(hy + 0.6), '#f4ead0'); }
      else {
        if (heavy && v !== 'mammoth') E(hx - 2.4, hy + 0.8, 1.2, 2.6, shade(c1, -0.32));
        B(hx, hy, heavy ? 3.6 : 3, heavy ? 3.2 : 2.6, heavy ? shade(c1, 0.06) : c1);
        const sn = v === 'bear' || v === 'tanuki' ? 1.6 : v === 'cat' || v === 'lion' ? 1.8 : v === 'ram' || v === 'stag' || v === 'elk' ? 2.4 : 3;
        Poly([[hx + 1, hy - 0.8], [hx + 1 + sn + 1.2, hy + 0.3], [hx + 1 + sn + 1, hy + (atk ? 2.4 : 1.6)], [hx + 0.5, hy + 1.8]], shade(c1, 0.05));
        D(hx + 1 + sn + 1, hy + 0.4, 0.6, '#1a1214');
        if (atk) Rr(hx + 1.2, hy + 1.4, sn, 0.8, '#5a1018');
        if (v === 'boar') { D(hx + 1 + sn + 1.1, hy + 0.7, 1.1, shade(c1, 0.22)); P.px(X(hx + 1 + sn + 1.4), Y(hy + 0.7), '#2a1a14'); L(hx + sn, hy + 1.4, hx + sn + 1.6, hy - 0.8, c3, 1); }
        if (v === 'bear') { D(hx + 1 + sn + 0.8, hy + 0.7, 1.2, shade(c1, 0.25)); D(hx + 1 + sn + 1.4, hy + 0.3, 0.6, '#1a1214'); }
      }
      // ears, horns, antlers
      if (v === 'wolf' || v === 'fox' || v === 'hound' || v === 'bonehound' || v === 'hyena' || v === 'cat') { T('head:n'); Poly([[hx - 1.6, hy - 1.8], [hx - 0.2, hy - 1.8], [hx - 1, hy - 4.2]], c1); T('head:f'); Poly([[hx + 0.2, hy - 2], [hx + 1.4, hy - 1.8], [hx + 0.8, hy - 4]], shade(c1, -0.15)); }
      if (v === 'bear' || v === 'tanuki' || v === 'lion') { T('head:n'); D(hx - 1.6, hy - 2.4, 1, c1); T('head:f'); D(hx + 1, hy - 2.6, 1, shade(c1, -0.1)); }
      if (v === 'stag' || v === 'elk') { const A = v === 'elk' ? 1.3 : 1; T('head:f'); L(hx - 0.5, hy - 2, hx - 2.5 * A, hy - 7 * A, c3, 0.9); L(hx - 1.6 * A, hy - 4.4 * A, hx - 4 * A, hy - 5.4 * A, c3, 0.8); T('head:n'); L(hx + 0.6, hy - 2, hx + 2.6 * A, hy - 7.4 * A, c3, 0.9); L(hx + 1.8 * A, hy - 5 * A, hx + 4.2 * A, hy - 5.6 * A, c3, 0.8); }
      T('head'); if (v === 'ram') { L(hx - 1, hy - 1.6, hx - 3, hy - 2.6, c3, 1.4); L(hx - 3, hy - 2.6, hx - 3.4, hy - 0.4, c3, 1.4); L(hx - 3.4, hy - 0.4, hx - 2, hy + 0.6, c3, 1.2); }
      if (v === 'tanuki') E(hx + 0.4, hy, 1.8, 0.9, c2);
      if (v === 'horse') { for (let i = 0; i < 5; i++) D(hx - 1.6 - i * 0.9, hy - 1.6 + i * 1.1, 1.1, c2); Poly([[hx - 1.4, hy - 1.8], [hx - 0.2, hy - 1.8], [hx - 0.8, hy - 3.6]], c1); }
      if (v === 'bonehound') { Rr(hx - 1, hy - 0.5, 1, 1, '#2a2228'); }
      if (v === 'hound' && def.c[1] === '#ff7a2a') for (let i = 0; i < 3; i++) D(hx - 1 + i, hy - 3 - (i % 2), 0.6, '#ffd08a');
      eye(hx + 0.2, hy - 0.6, def.v === 'bonehound' ? c3 : def.ghostly ? c2 : '#1a1214');
      if (def.c[2] && (v === 'hound' || v === 'cat' || v === 'bonehound')) P.px(X(hx + 0.2), Y(hy - 0.6), c3);
      break;
    }
    case 'biped': {
      rigOrient(P, 'front', 0.85);
      const big = v === 'troll' || v === 'yeti' || v === 'giant' || v === 'ape' || v === 'oni';
      const lean = v === 'troll' || v === 'ghoul' || v === 'hag' || v === 'ape' ? 1 : 0;
      const skin = c1, cloth = c2;
      const legC = v === 'skeleton' ? c1 : v === 'satyr' ? '#6a4a3a' : v === 'scarecrow' ? '#6a4a2a' : shade(cloth, -0.25);
      // legs
      T('leg'); for (const d of [-1, 1]) { const up = step && d < 0 ? 1 : 0, lx = 8 + d * 2 - (d < 0 ? 1.6 : 0); if (v === 'skeleton') L(lx + 0.8, 14, lx + 0.8, 19 - up, legC, 0.9); else Rr(lx, 14 - up, big ? 2.6 : 2, 5, legC); Rr(lx - 0.2, 19 - up, big ? 3 : 2.4, 2, v === 'skeleton' ? c1 : v === 'satyr' ? '#2a1a14' : '#2e211c'); }
      T('tail'); if (v === 'lizard' || v === 'fish') L(5, 15, 1.4, 19 - step, shade(skin, -0.1), 1.6);
      // body
      T('body'); const bodyC = v === 'skeleton' ? 'none' : v === 'mummy' ? c1 : v === 'scarecrow' ? '#8a6a3a' : v === 'yeti' || v === 'ape' ? c1 : cloth;
      if (bodyC !== 'none') { B(8, 11.5 + lean * 0.5, big ? 5.4 : 4.2, 3.8, bodyC); Rr(4.4, 13.4, 7.2, 1, shade(bodyC, -0.3)); }
      else { L(8, 9, 8, 14, c1, 0.9); for (let i = 0; i < 3; i++) L(5.6, 10 + i * 1.4, 10.4, 10 + i * 1.4, c1, 0.8); }
      if (v === 'mummy') for (let i = 0; i < 4; i++) L(4.5, 9.5 + i * 1.5, 11.5, 10.2 + i * 1.5, shade(c1, -0.2), 0.6);
      if (v === 'scarecrow') { for (let i = 0; i < 4; i++) L(4 + i * 2.6, 14, 3.4 + i * 2.6, 16.4, '#e8c860', 0.6); Rr(5.6, 10.4, 4.8, 1, '#a83a2a'); }
      if (v === 'yeti' || v === 'ape') E(8, 12, 2.6, 2.4, shade(c1, v === 'ape' ? 0.35 : -0.08));
      if (v === 'thistle' || v === 'knight') { B(8, 11.5, 4.4, 3.8, '#9aa4b4'); Rr(7.6, 9, 0.9, 5, c2); }
      if (v === 'human' || v === 'gnoll' || v === 'goblin') Rr(4.4, 12.8, 7.2, 0.9, '#5a3a22');
      // arms
      const armC = v === 'skeleton' ? c1 : v === 'mummy' || v === 'yeti' || v === 'ape' ? c1 : v === 'thistle' || v === 'knight' ? '#9aa4b4' : skin;
      T('arm'); const raise = atk ? -4 : 0;
      for (const d of [-1, 1]) { const sw2 = step ? d : 0; L(8 + d * 4.4, 9.6, 8 + d * (big ? 6.4 : 5.4), 14 + sw2 + (d > 0 ? raise : 0), armC, big ? 1.8 : 1.2); D(8 + d * (big ? 6.4 : 5.4), 14.4 + sw2 + (d > 0 ? raise : 0), big ? 1.2 : 0.8, v === 'skeleton' || v === 'mummy' ? c1 : skin); }
      // head
      T('head'); const hx = 8 + lean * 0.8, hy = 5.4 + lean * 1.4;
      const headC = v === 'skeleton' ? c1 : v === 'mummy' ? c1 : v === 'scarecrow' ? '#d8c088' : v === 'thistle' || v === 'knight' ? '#9aa4b4' : skin;
      B(hx, hy, big ? 3.6 : 3.2, 3.2, headC);
      if (v === 'goblin' || v === 'imp') { Poly([[hx - 2.6, hy - 0.6], [hx - 5.6, hy - 2.4], [hx - 2.2, hy + 1]], skin); Poly([[hx + 2.6, hy - 0.6], [hx + 5.6, hy - 2.4], [hx + 2.2, hy + 1]], skin); }
      if (v === 'oni' || v === 'satyr' || v === 'imp') { const hc = v === 'oni' ? c3 : '#e8d8b0'; Poly([[hx - 2, hy - 2], [hx - 1, hy - 2.6], [hx - 2.6, hy - 5.4]], hc); Poly([[hx + 2, hy - 2], [hx + 1, hy - 2.6], [hx + 2.6, hy - 5.4]], hc); }
      if (v === 'oni' || v === 'troll') { P.px(X(hx - 1.2), Y(hy + 2), '#f4ead0'); P.px(X(hx + 1.2), Y(hy + 2), '#f4ead0'); }
      if (v === 'gnoll') { Poly([[hx + 1, hy - 0.4], [hx + 4.6, hy + 0.6], [hx + 4.2, hy + 2], [hx + 0.6, hy + 2]], skin); Poly([[hx - 2, hy - 2], [hx - 0.6, hy - 2.4], [hx - 1.6, hy - 5]], skin); D(hx + 4.2, hy + 0.8, 0.6, '#1a1214'); }
      if (v === 'troll') E(hx + 0.4, hy + 0.8, 1.4, 1.1, shade(skin, 0.1));
      if (v === 'human') { Rr(hx - 3.2, hy - 3.2, 6.4, 2, cloth); if (def.gear === 'gun') { Rr(hx - 4.4, hy - 2.4, 8.8, 1, '#5a3a22'); Rr(hx - 2.6, hy - 4.4, 5.2, 2, '#5a3a22'); } Rr(hx - 2.6, hy + 1.2, 5.2, 1.2, c3); }
      if (v === 'lizard') { Poly([[hx + 1, hy - 1], [hx + 4.4, hy + 0.4], [hx + 3.6, hy + 2], [hx + 0.4, hy + 1.8]], skin); for (let i = 0; i < 3; i++) P.px(X(hx - 1 + i * 1.2), Y(hy - 3.2), c3); }
      if (v === 'fish') { Poly([[hx - 1, hy - 3], [hx + 1, hy - 3], [hx, hy - 5.4]], c3); E(hx + 0.8, hy + 1.4, 2, 0.9, shade(skin, -0.25)); }
      if (v === 'hag') { Rr(hx - 3.4, hy - 3, 1.2, 7, c2); Rr(hx + 2.2, hy - 3, 1.2, 7, c2); Poly([[hx + 1, hy], [hx + 3.6, hy + 1.6], [hx + 1, hy + 1.6]], shade(skin, -0.1)); Poly([[hx - 3.6, hy - 2.4], [hx + 3.6, hy - 2.4], [hx + 0.4, hy - 7]], '#2a2228'); }
      if (v === 'dryad') { for (let i = 0; i < 6; i++) D(hx - 3 + i * 1.2, hy - 2.8 - (i % 2), 1.3, i % 2 ? c2 : shade(c2, 0.15)); D(hx + 2.4, hy - 3.4, 0.8, c3); }
      if (v === 'yeti' || v === 'ape') { E(hx, hy + 0.8, 2, 1.6, shade(c1, v === 'ape' ? 0.35 : -0.12)); }
      if (v === 'giant') { Rr(hx - 3, hy + 1, 6, 4, c3); Rr(hx - 3.4, hy - 3.6, 6.8, 1.6, '#5a6a8a'); }
      if (v === 'scarecrow') { Poly([[hx - 4.4, hy - 1.6], [hx + 4.4, hy - 1.6], [hx + 1.4, hy - 4.6], [hx - 1.4, hy - 4.6]], '#6a4a2a'); Rr(hx - 4.6, hy - 1.8, 9.2, 1, '#5a3a22'); }
      if (v === 'thistle' || v === 'knight') { Rr(hx - 2.6, hy - 0.2, 5.2, 0.8, '#1a1214'); for (let i = 0; i < 3; i++) D(hx - 1.6 + i * 1.6, hy - 3.6 - (i === 1 ? 1 : 0), 1, i === 1 ? c2 : '#5a8a6a'); }
      if (v === 'mummy') { L(hx - 3, hy - 1, hx + 3, hy + 0.4, shade(c1, -0.2), 0.6); L(hx - 3, hy + 1.4, hx + 3, hy + 1, shade(c1, -0.2), 0.6); }
      if (v === 'ghoul') { Rr(hx - 1.4, hy + 1.6, 2.8, 0.8, '#2a1a1a'); }
      T('face'); const ey = hy - 0.2, ec = v === 'skeleton' || v === 'mummy' || v === 'ghoul' || v === 'thistle' || v === 'knight' ? c3 : '#1a1214';
      if (v === 'skeleton') { Rr(hx - 2, ey - 0.8, 1.6, 1.6, '#2a0a10'); Rr(hx + 0.6, ey - 0.8, 1.6, 1.6, '#2a0a10'); }
      if (v !== 'thistle' && v !== 'knight' && v !== 'scarecrow') { eye(hx - 1.2, ey, ec); eye(hx + 1.2, ey, ec); }
      else if (v === 'scarecrow') { Rr(hx - 1.8, ey - 0.4, 1.2, 1.2, '#1a1214'); Rr(hx + 0.8, ey - 0.4, 1.2, 1.2, '#1a1214'); L(hx - 1.6, hy + 1.6, hx + 1.6, hy + 1.6, '#1a1214', 0.6); }
      else { P.px(X(hx - 1.2), Y(ey), ec); P.px(X(hx + 1.2), Y(ey), ec); }
      // gear in the right hand
      T('gear'); const gx = 8 + (big ? 6.4 : 5.4), gy = 14.4 + raise + (step ? 1 : 0), gear = def.gear;
      if (gear === 'spear') { L(gx, gy + 2, gx + 1.2, gy - 9, '#8a6a42', 0.7); Poly([[gx + 0.6, gy - 9], [gx + 2, gy - 9], [gx + 1.4, gy - 12]], '#dde3ec'); }
      else if (gear === 'sword' || gear === 'katana') { L(gx, gy, gx + 0.6, gy - (gear === 'katana' ? 9 : 7), '#dde3ec', 0.9); Rr(gx - 1, gy - 0.4, 2.4, 0.8, '#c8901c'); }
      else if (gear === 'axe') { L(gx, gy + 1, gx + 0.4, gy - 7, '#8a6a42', 0.8); Poly([[gx + 0.4, gy - 7], [gx + 3.6, gy - 8], [gx + 3.6, gy - 3.8], [gx + 0.4, gy - 4.6]], '#9aa4b4'); }
      else if (gear === 'club') { L(gx, gy + 1, gx + 1, gy - 6, '#8a6a42', 1.2); D(gx + 1.2, gy - 6.4, 1.6, '#6a4a2a'); }
      else if (gear === 'staff') { L(gx, gy + 3, gx + 0.4, gy - 9, '#6a4a2a', 0.8); D(gx + 0.4, gy - 9.6, 1.3, c3); }
      else if (gear === 'scythe') { L(gx, gy + 2, gx + 0.6, gy - 9, '#6a4a2a', 0.8); Poly([[gx + 0.6, gy - 9], [gx - 5, gy - 7], [gx + 0.6, gy - 8]], '#cfd6e0'); }
      else if (gear === 'bow') { for (let i = 0; i <= 8; i++) P.px(X(gx + 1 + Math.sin((i / 8) * Math.PI) * 1.6), Y(gy - 4 + i), '#9a6436'); L(gx + 1, gy - 4, gx + 1, gy + 4, '#e8e0cc', 0.5); }
      else if (gear === 'sling') { L(gx, gy, gx + 2, gy + 2, '#8a6a42', 0.6); D(gx + 2, gy + 2, 0.8, '#8a8a8a'); }
      else if (gear === 'gun') { Rr(gx - 0.4, gy - 1.2, 3.6, 1.2, '#4a4a52'); Rr(gx - 0.4, gy - 0.2, 1.2, 1.6, '#6a4a2a'); }
      T('wing'); if (v === 'imp') { Poly([[5, 10], [1, 7], [2, 11]], shade(c1, -0.2)); Poly([[11, 10], [15, 7], [14, 11]], shade(c1, -0.2)); }
      break;
    }
    case 'insect': {
      rigOrient(P, 'side');
      if (v === 'bee' || v === 'fly' || v === 'moth') {
        const wing = f === 1 ? -1.6 : 0;
        const wc = v === 'moth' ? c1 : '#e8f4ff', wa = v === 'moth' ? 255 : 170;
        T('wing:f'); E(6, 4 + wing, v === 'moth' ? 5 : 3.4, v === 'moth' ? 4 : 2.4, wc, wa); T('wing:n'); E(12, 4 + wing, v === 'moth' ? 5 : 3.4, v === 'moth' ? 4 : 2.4, shade(wc, -0.08), wa);
        if (v === 'moth') { D(5, 4 + wing, 1.2, c2); D(13, 4 + wing, 1.2, c2); }
        T('body'); B(9, 8, v === 'fly' ? 4 : 3.6, 3, v === 'bee' ? c1 : c2);
        if (v === 'bee') for (let i = 0; i < 3; i++) Rr(7 + i * 1.8, 5.4, 0.8, 5.2, c2);
        if (v === 'fly') E(9, 9, 3, 2, c1, 220);
        T('head'); B(13.6, 7.2, 2, 1.8, v === 'bee' ? c2 : shade(c2, -0.2)); eye(14.4, 6.8, c3);
        T('tail'); if (v === 'bee') Poly([[4.6, 8.4], [5.4, 9.2], [2.4, 9.6]], '#2a2228');
        T('head'); if (v === 'moth') { L(14, 6, 15.6, 3, c2, 0.5); L(14.6, 6, 16.6, 4, c2, 0.5); }
      } else {
        const legC = shade(c2, -0.1);
        if (v === 'scorpion') {
          for (let i = 0; i < 3; i++) for (const d of [-1, 1]) { T('leg' + i + (d < 0 ? ':f' : ':n')); L(8 + i * 2.4, 9, 7 + i * 2.4 + d * 1.6, 13 - (step && i % 2 ? 1 : 0), legC, 0.7); }
          T('body'); B(10, 8.6, 5.2, 2.8, c1);
          const tl = atk ? 1 : 0;
          T('tail'); L(5, 8, 2.4, 4, c1, 1.6); L(2.4, 4, 4.6, 1 + tl * 2, c1, 1.4); Poly([[4.6, 1 + tl * 2], [7.4, 2 + tl * 3], [5, 3.4 + tl * 2]], c3);
          T('head'); L(15, 8, 18.6, 6.6 - tl, c1, 1.2); L(15, 9, 18.6, 10.4 + tl, c1, 1.2); E(19.6, 6.4 - tl, 1.4, 1, c1); E(19.6, 10.6 + tl, 1.4, 1, c1);
          eye(14.2, 7.6, c3);
        } else if (v === 'strider') {
          for (let i = 0; i < 3; i++) for (const d of [-1, 1]) { T('leg' + i + (d < 0 ? ':f' : ':n')); RT(11, 9); const ph = (i + (d > 0 ? 1 : 0) + step) % 2; L(11, 9, 11 + (i - 1) * 4 + d * 1.2, 3 + ph * 1.4, legC, 0.7); L(11 + (i - 1) * 4 + d * 1.2, 3 + ph * 1.4, 11 + (i - 1) * 6 + d * 2, 17, legC, 0.7); }
          T('body'); B(11, 9, 4.2, 2.2, c1); B(15.6, 8.4, 1.8, 1.6, c1); eye(16.2, 8, c3);
        } else {
          for (let i = 0; i < 3; i++) for (const d of [-1, 1]) { T('leg' + i + (d < 0 ? ':f' : ':n')); L(6 + i * 3, 8, 5 + i * 3 + d * 1.4, 12 - (step && i % 2 ? 1 : 0), legC, 0.7); }
          T('body'); B(9, 7.4, 6.4, 4, c1); L(9, 3.6, 9, 11, shade(c1, -0.25), 0.6); T('head'); B(15.6, 7.4, 2.4, 2.2, c2); Poly([[16.6, 6], [19, 3], [18, 6.4]], c3); eye(16.4, 6.8, '#ffffff');
        }
      }
      break;
    }
    case 'spider': {
      rigOrient(P, 'side');
      const legC = shade(c1, -0.2);
      for (let i = 0; i < 4; i++) for (const d of [-1, 1]) { T('leg' + i + (d < 0 ? ':f' : ':n')); const ph = (i + step) % 2, bx = 9 + (i - 1.5) * 1.6; RT(bx, 7.6); L(bx, 7.6, bx + d * (4 + i * 0.6), 4 + ph, legC, 0.8); L(bx + d * (4 + i * 0.6), 4 + ph, bx + d * (5.4 + i * 0.9), 12.6, legC, 0.8); }
      T('body'); B(7.4, 8, 5, 4, c1); B(12.4, 8.4, 2.8, 2.4, shade(c1, 0.08));
      if (v === 'glow' || v === 'crystal') { D(6, 6.6, 1.2, c2); D(8.6, 7.4, 1, c2); if (v === 'crystal') Poly([[6, 5], [7.4, 5], [6.6, 1.6]], c2); }
      else if (v === 'big') for (let i = 0; i < 3; i++) Rr(5 + i * 1.8, 6, 0.9, 3.6, c2);
      else D(7, 7, 1, c2);
      for (const [x, y] of [[13.4, 7.4], [14.4, 8], [13.6, 8.8], [12.6, 8]]) P.px(X(x), Y(y), c3);
      if (atk) { L(14.2, 9.4, 15.6, 10.6, '#e8e0cc', 0.6); }
      break;
    }
    case 'bird': {
      rigOrient(P, 'front', 0.9);
      const up = f === 1, harpy = v === 'harpy';
      const wingC = shade(c1, -0.1);
      T('wing'); if (up) { Poly([[8, 7], [1, 1], [3, 7.4]], wingC); Poly([[10, 7], [17, 1], [15, 7.4]], shade(wingC, -0.1)); }
      else { Poly([[8, 7], [1, 11], [3, 6.4]], wingC); Poly([[10, 7], [17, 11], [15, 6.4]], shade(wingC, -0.1)); }
      T('body'); B(9, 8, 3.6, 3, c1); E(9, 9.4, 2, 1.6, c2);
      T('head'); if (harpy) { B(9, 4.6, 2.4, 2.6, '#e8c8a8'); Rr(7, 2.4, 4.4, 3.6, c2); eye(8.4, 4.6, '#1a1214'); eye(9.8, 4.6, '#1a1214'); }
      else { B(11.6, 5, 2.4, 2.2, v === 'vulture' ? '#e8c0b0' : c1); Poly([[13.6, 4.6], [16.6, 5.4 + (atk ? 1 : 0)], [13.6, 6]], c3); eye(12.2, 4.6, v === 'owl' ? '#ffd35c' : '#1a1214'); if (v === 'owl') eye(10.8, 4.6, '#ffd35c'); }
      T('body'); if (v === 'vulture') E(10.6, 6.8, 2.2, 0.9, '#f4ead8');
      if (v === 'hawk' && def.c[1] === '#fff27a') L(9, 7, 6, 10, c2, 0.6);
      T('leg'); L(7, 11, 6.4, 13, c3, 0.6); L(10, 11, 10.6, 13, c3, 0.6);
      break;
    }
    case 'bat': {
      rigOrient(P, 'front', 0.8);
      const up = f === 1;
      T('wing'); if (!up) { Poly([[7, 6], [1, 1], [0, 5], [3, 8]], c1); Poly([[9, 6], [15, 1], [16, 5], [13, 8]], c1); }
      else { Poly([[7, 6], [1, 10], [2, 6], [4, 5]], c1); Poly([[9, 6], [15, 10], [14, 6], [12, 5]], c1); }
      T('body'); B(8, 6.4, 2.8, 2.6, c2); Poly([[6.4, 4.4], [7.2, 4.4], [6.8, 2.6]], c2); Poly([[8.8, 4.4], [9.6, 4.4], [9.2, 2.6]], c2);
      T('face'); eye(7.2, 6.2, c3); eye(8.8, 6.2, c3); P.px(X(8), Y(8.4), '#ffffff');
      break;
    }
    case 'serpent': {
      rigOrient(P, 'side', { slither: true });
      if (v === 'worm') {
        for (let i = 0; i < 6; i++) B(4 + i * 2.6, 18 - i * 2.6 + Math.sin(i + step) * 0.6, 3.4 - i * 0.12, 3.2, i % 2 ? c1 : shade(c1, -0.08));
        T('head'); const hx = 18, hy = 5;
        B(hx, hy, 4, 3.6, c1);
        E(hx + 1.6, hy + 0.6, 2.6, atk ? 3 : 2, '#2a0a0a'); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; P.px(X(hx + 1.6 + Math.cos(a) * 2.2), Y(hy + 0.6 + Math.sin(a) * (atk ? 2.6 : 1.8)), '#f4ead0'); }
        D(hx - 1.6, hy - 2, 0.6, c3);
      } else {
        T('body'); const n = 7;
        for (let i = 0; i < n; i++) { const x = 2.6 + i * 2.8, y = 9 + Math.sin(i * 1.1 + step * 1.6) * 1.8; B(x, y, 2.4 - (i === 0 ? 0.8 : 0), 2.2 - (i === 0 ? 0.6 : 0), i % 2 ? c1 : shade(c1, -0.1)); if (i % 2 && i < n - 1) D(x, y - 0.8, 0.6, c2); }
        T('head'); const hx = 22, hy = 7 + (atk ? -1.4 : 0);
        B(hx, hy, 3, 2.4, c1); eye(hx + 0.6, hy - 0.8, c3);
        if (atk) { Rr(hx + 1.4, hy + 0.8, 1.6, 0.8, '#5a1018'); P.px(X(hx + 2.6), Y(hy + 1.6), '#f4ead0'); }
        if (v === 'eel') { Poly([[hx - 2, hy - 2], [hx, hy - 2.4], [hx - 3.6, hy - 4.6]], c2); for (let i = 1; i < n - 1; i += 2) Poly([[2.6 + i * 2.8 - 1, 7], [2.6 + i * 2.8 + 1, 7], [2.6 + i * 2.8, 4.6]], c2); }
      }
      break;
    }
    case 'plant': {
      rigOrient(P, 'front', 0.9);
      if (v === 'vine') {
        for (let i = 0; i < 3; i++) L(8 + (i - 1) * 3, 21, 8 + (i - 1) * 2 + Math.sin(i + step) * 1.4, 10, i % 2 ? c1 : c2, 1.6);
        T('head'); B(8, 8, 5, 4.6 + (atk ? 0.6 : 0), c1);
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; Poly([[8 + Math.cos(a) * 4, 8 + Math.sin(a) * 4], [8 + Math.cos(a + 0.3) * 4, 8 + Math.sin(a + 0.3) * 4], [8 + Math.cos(a + 0.15) * 6.8, 8 + Math.sin(a + 0.15) * 6.8]], c3); }
        T('face'); D(8, 8, 2.2, atk ? '#5a1018' : shade(c3, -0.3)); eye(7, 7, '#ffd35c'); eye(9, 7, '#ffd35c');
      } else if (v === 'tentacle') {
        T('body'); for (let i = 0; i < 22; i++) { const t = i / 22, x = 7 + Math.sin(t * 5 + step + (atk ? 1 : 0)) * 3 * t; Rr(x - (1 - t) * 3, 23 - i, Math.max(0.8, (1 - t) * 6), 1, i % 4 === 0 ? c2 : c1); }
        T('head'); D(7 + Math.sin(5 + step) * 3, 2, 1.4, '#f4eef4'); D(7 + Math.sin(5 + step) * 3, 2, 0.7, c3);
      } else {
        // walking tree
        T('leg'); for (const d of [-1, 1]) { const up = step && d < 0 ? 1.4 : 0; L(9 + d * 2.4, 17, 9 + d * 3.6, 23 - up, shade(c2, -0.1), 1.8); }
        T('body'); Rr(5.6, 9, 6.8, 9, c2); L(7, 10, 7, 17, shade(c2, -0.25), 0.6); L(10.4, 11, 10.6, 16, shade(c2, 0.15), 0.6);
        T('arm'); RT(6, 11); RT(12, 11); L(6, 11, 1.4, 8 + (atk ? -3 : 0), c2, 1.4); L(12, 11, 16.6, 8 + (atk ? -3 : 0), c2, 1.4);
        T('head'); B(9, 6, 7.4, 5.6, c1); for (let i = 0; i < 5; i++) B(4 + i * 2.6, 4 + (i % 2) * 2, 2.6, 2.4, shade(c1, i % 2 ? 0.1 : -0.06));
        T('face'); eye(7.6, 12, c3); eye(10.4, 12, c3); Rr(7.8, 14.4, 2.6, 0.8, '#1a1214');
      }
      break;
    }
    case 'fungus': {
      rigOrient(P, 'front', 1);
      const brute = v === 'brute';
      const sq = step ? 0.8 : 0;
      T('leg'); for (const d of [-1, 1]) Rr(8 + d * (brute ? 3.6 : 2) - 1, (brute ? 20 : 14.6) - (step && d < 0 ? 1 : 0), brute ? 2.6 : 1.8, brute ? 4 : 3, shade(c2, -0.2));
      T('body'); B(brute ? 11 : 8, brute ? 15 : 11 + sq * 0.4, brute ? 6.4 : 3.8, brute ? 5.4 : 3.6, c2);
      T('arm'); if (brute) { L(4.6, 13, 1, 19 + (atk ? -6 : 0), c2, 2); L(17.4, 13, 21, 19 + (atk ? -6 : 0), c2, 2); }
      T('head'); B(brute ? 11 : 8, brute ? 7.4 : 6.6 + sq, brute ? 10 : 7, brute ? 6 : 4.6 - sq * 0.5, c1);
      for (let i = 0; i < (brute ? 6 : 4); i++) D((brute ? 3 : 3.4) + i * (brute ? 3.2 : 3), (brute ? 5 : 5.4) + (i % 2) * 1.6 + sq, brute ? 1.3 : 0.9, '#f4ead8');
      T('face'); eye(brute ? 9.4 : 6.8, brute ? 15 : 11.4, '#1a1214'); eye(brute ? 12.6 : 9.2, brute ? 15 : 11.4, '#1a1214');
      T('head'); if (atk) for (let i = 0; i < 5; i++) D(3 + i * 3, 1 + (i % 2), 0.7, c3);
      break;
    }
    case 'wisp': {
      rigOrient(P, 'front', { depth: 0.9, float: true });
      const bob = step ? -0.8 : 0;
      if (v === 'jelly') {
        for (let i = 0; i < 5; i++) L(4 + i * 1.6, 9 + bob, 3.6 + i * 1.6 + Math.sin(i + step * 2) * 0.8, 17, i % 2 ? c1 : c3, 0.6);
        T('body'); E(7, 7 + bob, 6, 5, c1, 200); E(7, 5.6 + bob, 4.4, 3, c2, 200); T('face'); eye(5.4, 7 + bob, '#1a1214'); eye(8.6, 7 + bob, '#1a1214');
      } else if (v === 'pixie') {
        T('wing'); E(3, 4 + bob - step, 2.6, 2, '#ffffff', 180); E(9, 4 + bob - step, 2.6, 2, '#ffffff', 180);
        T('body'); B(6, 6.6 + bob, 2.4, 2.8, c1); T('head'); D(6, 3.8 + bob, 1.8, '#f0d0c0'); T('face'); eye(5.4, 3.8 + bob, '#1a1214'); eye(6.6, 3.8 + bob, '#1a1214'); T('head'); D(6, 2.4 + bob, 1.6, c3);
      } else if (v === 'elemental' || v === 'sand' || v === 'fire') {
        const bodyC = c1;
        for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + f * 0.7; Poly([[8 + Math.cos(a) * 2, 12 + Math.sin(a) * 2 + bob], [8 + Math.cos(a + 0.4) * 2, 12 + Math.sin(a + 0.4) * 2 + bob], [8 + Math.cos(a + 0.2) * 7, 12 + Math.sin(a + 0.2) * 4 - 3 + bob]], i % 2 ? c2 : c3); }
        T('body'); B(8, 10 + bob, 5, 6, bodyC, 0.45, -0.25); Poly([[4, 6 + bob], [12, 6 + bob], [8, -1 + bob - (atk ? 1 : 0)]], bodyC);
        T('face'); D(8, 9 + bob, 2.2, c2); eye(6.6, 9 + bob, '#1a1214'); eye(9.4, 9 + bob, '#1a1214');
        T('body'); if (v === 'sand') for (let i = 0; i < 4; i++) L(3 + i * 3, 16, 5 + i * 3, 19, shade(c1, -0.2), 0.6);
      } else if (v === 'prism') {
        Poly([[7, 1 + bob], [12.6, 7 + bob], [7, 14 + bob], [1.4, 7 + bob]], c1); Poly([[7, 1 + bob], [12.6, 7 + bob], [7, 7 + bob]], c2); Poly([[7, 7 + bob], [7, 14 + bob], [1.4, 7 + bob]], c3);
        T('face'); eye(7, 7 + bob, '#1a1214', true);
      } else {
        T('body'); B(7, 8 + bob, 4.6, 4.6, c1, 0.5, -0.2); D(7, 7 + bob, 2.4, c2);
        for (let i = 0; i < 4; i++) D(3 + i * 2.6, 13.6 + ((i + f) % 2) + bob, 0.8, c3);
        if (v === 'spark') for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + f; L(7 + Math.cos(a) * 4, 8 + Math.sin(a) * 4 + bob, 7 + Math.cos(a) * 6.4, 8 + Math.sin(a) * 6.4 + bob, c2, 0.5); }
        T('face'); eye(5.8, 8 + bob, '#1a1214'); eye(8.2, 8 + bob, '#1a1214');
      }
      break;
    }
    case 'golem': {
      rigOrient(P, 'front', 1.1);
      const [b1, b2] = [c1, c2];
      const crystal = v === 'crystal' || v === 'ice' || v === 'salt', bone = v === 'bone';
      T('leg'); for (const d of [-1, 1]) { const up = step && d < 0 ? 1 : 0; Rr(10 + d * 3.4 - 2, 15 - up, 4, 7, shade(b1, -0.15)); }
      T('body'); B(10, 11.6, 7.4, 5.6, b1, 0.25, -0.35);
      if (v === 'leaf') for (let i = 0; i < 8; i++) D(4 + (i % 4) * 4, 8 + Math.floor(i / 4) * 5, 2, i % 2 ? b2 : shade(b1, 0.12));
      if (v === 'pumpkin') { for (const x of [6, 10, 14]) L(x, 7, x, 16, shade(b1, -0.22), 0.8); Rr(9, 4.6, 2, 2, '#5a8a2a'); }
      if (v === 'coral') for (let i = 0; i < 4; i++) { L(4 + i * 4, 8, 3.6 + i * 4, 3.6, i % 2 ? b2 : c3, 1); }
      if (crystal) for (let i = 0; i < 3; i++) Poly([[6 + i * 4, 8], [8 + i * 4, 8], [7 + i * 4, 2.4 - (i === 1 ? 1.4 : 0)]], i % 2 ? c3 : b2);
      if (v === 'obsidian' || v === 'stone') for (let i = 0; i < 3; i++) L(5 + i * 5, 9 + (i % 2), 7 + i * 5, 14, c3, 0.6);
      if (bone) { for (let i = 0; i < 4; i++) L(5, 9 + i * 2, 15, 9 + i * 2, shade(b1, -0.3), 0.6); }
      T('arm'); const raise = atk ? -4 : 0;
      for (const d of [-1, 1]) { L(10 + d * 6.6, 9, 10 + d * 8.4, 15 + raise, b1, 2.6); B(10 + d * 8.4, 15.6 + raise, 2.2, 2, shade(b1, -0.1)); }
      T('head'); B(10, 5.6, 3.6, 3, shade(b1, 0.06));
      T('face'); eye(8.8, 5.6, c3); eye(11.2, 5.6, c3);
      break;
    }
    case 'ghost': {
      rigOrient(P, 'front', { depth: 0.8, float: true });
      const a = 205, base = c1, bob = step ? -0.6 : 0;
      P.disc(X(8), Y(6 + bob), 5 * s, base, a); P.rect(Math.round(X(3)), Math.round(Y(6 + bob)), Math.round(10 * sx), Math.round(8 * sy), base, a);
      for (let x = 3; x <= 12; x++) { const yy = 14 + ((x + f) % 3 === 0 ? 1.4 : 0); P.rect(Math.round(X(x)), Math.round(Y(13 + bob)), Math.max(1, Math.round(sx)), Math.max(1, Math.round((yy - 13) * sy)), base, a); }
      if (v === 'wraith') { for (let i = 0; i < 3; i++) Poly([[4 + i * 3, 2 + bob], [5.4 + i * 3, 2 + bob], [4.8 + i * 3, -0.6 + bob]], c2); }
      if (v === 'shade') { E(8, 6 + bob, 5, 5, shade(c1, -0.3), 180); }
      T('face'); Rr(5, 5 + bob, 2, 3, '#1a1420'); Rr(9, 5 + bob, 2, 3, '#1a1420'); P.px(X(6), Y(6 + bob), c3); P.px(X(10), Y(6 + bob), c3);
      if (atk) E(8, 10 + bob, 1.6, 1.8, '#1a1420');
      break;
    }
    case 'crab': {
      rigOrient(P, 'front', 0.9);
      if (v === 'hermit') { T('shell:f'); B(9, 7, 7, 6, c2, 0.4, -0.3); for (let i = 0; i < 3; i++) L(4 + i * 3, 4 + i, 9 + i * 2, 12, shade(c2, -0.2), 0.6); }
      const by = v === 'hermit' ? 13 : 8;
      T('leg'); for (let i = 0; i < 3; i++) for (const d of [-1, 1]) L(10 + d * (2 + i * 1.6), by, 10 + d * (4 + i * 2), by + 4 - ((step + i) % 2), shade(c1, -0.2), 0.7);
      T('body'); B(10, by - 1, 6.4, 3.4, c1);
      const op = atk ? 1 : 0;
      T('arm'); RT(10 - 5, by - 2); RT(10 + 5, by - 2); for (const d of [-1, 1]) { L(10 + d * 5, by - 2, 10 + d * 8, by - 5 - op, c1, 1.2); B(10 + d * 8.6, by - 6 - op, 2.2, 1.6, c1); Rr(10 + d * 8.6 - 0.4, by - 6 - op, 0.8, 1.6 + op, '#1a1214'); }
      T('head'); L(8, by - 4, 8, by - 6.4, c1, 0.5); L(12, by - 4, 12, by - 6.4, c1, 0.5); D(8, by - 6.6, 0.8, '#1a1214'); D(12, by - 6.6, 0.8, '#1a1214');
      break;
    }
    case 'toad': {
      rigOrient(P, 'front', 1.1);
      const frog = v === 'frog', sq = step ? 0.8 : 0;
      for (const d of [-1, 1]) { E(10 + d * 6, 13.6, 3, 1.6, shade(c1, -0.15)); }
      B(10, 9.4 + sq, frog ? 6 : 8, frog ? 4.2 : 5.6 - sq, c1, 0.35, -0.3);
      T('face'); E(10, 11.4 + sq, frog ? 4 : 6, 2.6, c2); T('body');
      if (frog) for (let i = 0; i < 4; i++) D(6 + i * 2.6, 7.6 + (i % 2) + sq, 0.9, '#1a1a2a');
      else for (let i = 0; i < 5; i++) D(5 + i * 2.6, 6.6 + (i % 2) + sq, 0.8, shade(c1, -0.2));
      T('head'); B(6.6, 5 + sq, 1.8, 1.8, c1); B(13.4, 5 + sq, 1.8, 1.8, c1); T('face'); eye(6.6, 4.8 + sq, '#1a1214', true); eye(13.4, 4.8 + sq, '#1a1214', true);
      T('face'); Rr(6, 9.4 + sq, 8, 0.8, shade(c1, -0.35));
      if (atk) L(13, 9.4, 19, 9, '#ff6a8a', 0.8);
      break;
    }
    case 'horror': {
      rigOrient(P, 'front', { depth: 1, float: v === 'eye' });
      if (v === 'eye') {
        const bob = step ? -0.8 : 0;
        for (let i = 0; i < 5; i++) { const x0 = 5 + i * 2; for (let j = 0; j < 8; j++) P.px(X(x0 + Math.sin(j * 0.8 + i + f) * 1.2), Y(12 + j + bob), j % 3 ? c1 : c2); }
        T('body'); B(9, 7.6 + bob, 7, 6.4, c1, 0.3, -0.35);
        T('face'); E(9, 7.6 + bob, 5, 4.4, '#f4eef4'); D(9 + (atk ? 0 : 0.8), 7.6 + bob, 2.6, c2); D(9 + (atk ? 0 : 0.8), 7.6 + bob, 1.3, '#1a0a1a'); P.px(X(8), Y(6.4 + bob), '#ffffff');
        T('body'); for (let i = 0; i < 3; i++) { const a = -2.4 + i * 0.6; D(9 + Math.cos(a) * 7.6, 7.6 + Math.sin(a) * 6.6 + bob, 1, c3); }
      } else {
        const sq = step ? 0.8 : 0;
        T('leg'); for (let i = 0; i < 4; i++) L(4 + i * 3.4, 12, 3 + i * 3.6 + Math.sin(i + f) * 1.4, 16, c1, 1.2);
        T('body'); B(9, 9 + sq, 7.4, 6 - sq, c1, 0.35, -0.3);
        T('face'); for (const [x, y, r] of [[6, 7, 1.4], [11, 6.4, 1.8], [8.6, 10.6, 1.1], [13, 10, 1]]) { D(x, y + sq, r, '#f4eef4'); D(x + 0.3, y + sq, r * 0.5, (x * 7) % 2 ? c2 : c3); }
        if (atk) E(9, 13 + sq, 3, 1.4, '#1a0a1a');
      }
      break;
    }
  }
}
// register every realm creature as a monster painter
const _creatureW = {};
for (const id in WORLD_KINDS) {
  const d = WORLD_KINDS[id];
  const [w, h] = creatureSize(d.fam, d.v, d.size);
  MON_SIZE[d.sprite] = [w, h];
  MON[d.sprite] = (p, f) => paintCreature(p, d, f);
}
// every lord of a land carries its mark: markings, spikes and a crown in the land's colours
const BOSS_ASPECT = { meadows: 'radiant', whisper: 'venom', sakura: 'blood', autumn: 'inferno', savanna: 'fury', pine: 'bastion', ossplains: 'shadow', murkmire: 'venom', sporeveil: 'venom', elderwood: 'zephyr', mangrove: 'tempest', storm: 'tempest', coral: 'arcane', frostpeak: 'glacier', desert: 'radiant', ashlands: 'inferno', canyon: 'fury', jungle: 'venom', feywild: 'arcane', crystal: 'arcane', shadowfen: 'shadow', caldera: 'inferno', glacier: 'glacier', saltflats: 'bastion', voidscar: 'chaos' };
function bossFrames(id) {
  return spr('wboss:' + id, () => {
    const B = W_BOSS_DEF[id], [w, h] = creatureSize(B.fam, B.v, B.size), d = { ...B, c: B.c };
    const A0 = typeof ASPECT !== 'undefined' && ASPECT[BOSS_ASPECT[B.zone]];
    const A = A0 ? { ...A0, wing: B.fly ? A0.wing : null } : null;
    const headAt = B.fam === 'quad' || B.fam === 'serpent' || B.fam === 'toad' ? 0.78 : 0.5;
    const make = (f, rig) => {
      const p = new PP(w, h), rc = rig ? crigCapture({ w, h, paint: (q) => paintCreature(q, d, f) }, f) : null;
      if (rc) { for (const n of rc.names) { const L = rc.layers[n]; for (let i = 0; i < L.length; i++) if (L[i] >>> 24) p.d[i] = L[i]; } p.rigCap = rc; } else paintCreature(p, d, f);
      if (A && typeof adornPP === 'function') { try { return adornPP(p, A, 6, f, { key: id, headAt }); } catch (e) { /* fall back to the plain beast */ } }
      p.outline(); const sp = p.sprite(Math.floor(w / 2), h - 1); if (rc) sp.rigCap = rc; return sp;
    };
    const fr = [0, 1, 2].map((f) => make(f));
    return crigAttach(fr, { w: fr[0].w, h: fr[0].h, ax: fr[0].ax, ay: fr[0].ay, atkF: 2, capture: (f) => make(f, true).rigCap });
  });
}

