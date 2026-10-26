/* ============================================================
   Cinderdeep — handling weapons. A weapon has weight: it comes
   up to your aim on a spring, slower the heavier it is, and
   between fights it is carried, not pointed: blades low at the
   side, greatswords and hammers on the shoulder, spears and
   staffs upright, bows and guns down. Swings smear, blows
   spark, bows draw and nock as they reload, crossbows show
   their bolt, staffs gather light at the tip, thrown knives
   come back to the hand, a boomerang leaves it empty, tomes
   open, guns smoke, and twin blades and fists use both hands.
   ============================================================ */
const WPN_FEEL = {};
function wpnFeel(def) {
  if (!def) return { carry: 'low', k: 16, base: '' };
  if (WPN_FEEL[def.id]) return WPN_FEEL[def.id];
  const b = def.from && WEAPON[def.from] ? WEAPON[def.from] : def, id = b.id, st = b.style;
  let carry = 'low';
  if (b.heavy || st === 'slam' || st === 'spin' || id === 'axe' || id === 'mace') carry = 'shoulder';
  else if (/staff|rod|wand|spear|harpoon/.test(id)) carry = 'pole';
  else if (st === 'arrow') carry = 'bow';
  else if (st === 'bolt' || st === 'blast' || id === 'pistols' || id === 'crossbow' || id === 'cannon') carry = 'gun';
  // how fast it comes up to the aim: heavy and slow weapons lag, quick ones snap
  const k = b.heavy || (b.rate || 2) < 1.3 ? 8 : (b.rate || 2) > 3.5 ? 26 : 15;
  return (WPN_FEEL[def.id] = { carry, k, base: id, magic: { fireball: '#ff9a3c', shard: '#bfe9ff', chain: '#fff27a', venom: '#a8ff6a', missile: '#c8a8ff' }[st] || (id === 'hexstaff' ? '#8fe05c' : null), pair: id === 'daggers' || id === 'gauntlets' || id === 'pistols' });
}
function wpnRest(carry, f) {
  const r = { low: 1.15, shoulder: -2.3, bow: 0.9, gun: 0.75 }[carry];
  if (carry === 'pole') return -Math.PI / 2 + f * 0.14;
  return f > 0 ? r : Math.PI - r;
}
const wpnReady = (p) => p.wpnReadyT > 0 || G.combat || (p.swing && p.swing.t < p.swing.dur * 1.5);
hook('update', (dt) => {
  const p = G.p;
  if (!p || !p.weapon || !dt) return;
  const F = wpnFeel(WEAPON[p.weapon.id]);
  if (p.wpnReadyT > 0) p.wpnReadyT -= dt;
  const want = wpnReady(p) ? p.aim : wpnRest(F.carry, p.face < 0 ? -1 : 1);
  if (p.wpnAng == null || p.swing && p.swing.t < p.swing.dur) p.wpnAng = p.aim;
  else p.wpnAng += angDiff(p.wpnAng, want) * (1 - Math.exp(-F.k * dt));
});
hook('onAttack', (p, def) => {
  p.wpnReadyT = 1.6;
  const F = wpnFeel(def), hp = handPos(p, p.aim);
  // what leaves the hand: a flash in the colour of the shot, smoke from a gun
  if (def.kind === 'ranged') {
    const col = F.magic || (F.carry === 'gun' ? '#ffd08a' : '#f4f0ea');
    burst(hp.x + Math.cos(p.aim) * 8, hp.y + Math.sin(p.aim) * 6, F.magic ? 5 : 3, [col, '#ffffff'], { ang: p.aim, spread: 0.5, smin: 20, smax: 60, glow: !!F.magic, lmax: 0.25 });
    if (F.carry === 'gun') for (let i = 0; i < 4; i++) G.parts.push({ x: hp.x + Math.cos(p.aim) * 12, y: hp.y + 2 + Math.sin(p.aim) * 8, z: 6, vx: Math.cos(p.aim) * rnd(10, 30) + rnd(-6, 6), vy: Math.sin(p.aim) * rnd(6, 16), vz: rnd(6, 16), grav: -10, drag: 1.6, life: 0.9, max: 0.9, color: rndPick(['#8a8a8a', '#b8b8b8', '#6a6a6a']), size: 2, glow: false, floor: false });
  }
});
// blows land with weight: sparks where steel meets hide, and heavy ones stop the world a moment
hook('onHit', (e, dmg, o, crit) => {
  const p = G.p;
  if (!o || o.src !== 'weapon' || !p || !p.weapon || !e) return;
  const def = WEAPON[p.weapon.id];
  if (!def) return;
  const a = Math.atan2(e.y - p.y, e.x - p.x), x = e.x - Math.cos(a) * e.r * 0.7, y = e.y - (e.h || 10) * 0.45;
  if (def.kind === 'melee') {
    burst(x, y, crit ? 9 : 5, [weaponTrail(p.weapon), '#ffffff', '#ffe08a'], { ang: a, spread: 0.9, smin: 40, smax: 130, glow: true, lmin: 0.12, lmax: 0.3, z: 6 });
    if (def.heavy || wpnFeel(def).carry === 'shoulder') { hitstop(0.03); shake(1.5); }
  } else if (crit) burst(x, y, 4, ['#ffffff', '#ffe08a'], { smax: 70, glow: true, lmax: 0.2 });
});

/* ---------- the states a weapon can be in, as their own pictures ---------- */
function wpnCopy(sp, padL, padT, padR, padB, paint) {
  const c = mkCanvas(sp.w + padL + padR, sp.h + padT + padB), g = c.getContext('2d');
  g.drawImage(sp.c, padL, padT);
  paint(g, padL, padT);
  return makeSprite(c, sp.ax + padL, sp.ay + padT);
}
const px1 = (g, x, y, col, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
// a bow drawn back: the string bends to the nock, an arrow lies along it
for (let s = 0; s <= 3; s++) HELD['bow~' + s] = () => {
  const base = heldWeapon('bow');
  return wpnCopy(base, 4, 0, 12, 0, (g, ox) => {
    g.clearRect(ox + 2, 1, 1, 15);
    const nx = ox + 2 - s;
    for (let y = 1; y <= 15; y++) { const k = 1 - Math.abs(y - 8) / 7; px1(g, Math.round(ox + 2 - s * k), y, '#e8e0cc'); }
    if (s > 0) { px1(g, nx, 8, '#c8b48a', 15 + s, 1); px1(g, nx + 15 + s, 7, C.steel, 1, 3); px1(g, nx + 16 + s, 8, C.steel); px1(g, nx - 1, 7, '#e2434f', 1, 3); }
  });
};
HELD['crossbow~L'] = () => wpnCopy(heldWeapon('crossbow'), 0, 0, 2, 0, (g) => { px1(g, 3, 5, '#c8b48a', 10, 1); px1(g, 13, 4, C.steel, 1, 3); px1(g, 14, 5, C.steel); });
HELD['knives~3'] = () => {
  const base = heldWeapon('knives'), c = mkCanvas(base.w + 6, base.h + 10), g = c.getContext('2d');
  for (const a of [-0.45, 0.45, 0]) { g.save(); g.translate(base.ax + 3, base.ay + 5); g.rotate(a); g.drawImage(base.c, -base.ax, -base.ay); g.restore(); }
  return makeSprite(c, base.ax + 3, base.ay + 5);
};
HELD['venomtome~open'] = () => {
  const c = mkCanvas(14, 11), g = c.getContext('2d');
  px1(g, 0, 3, '#1a3a18', 14, 6); px1(g, 1, 2, '#e8dcc0', 5, 6); px1(g, 8, 2, '#e8dcc0', 5, 6); px1(g, 6, 2, '#2f5a2a', 2, 7);
  for (const y of [3, 5, 7]) { px1(g, 2, y, '#8a7a5a', 3, 1); px1(g, 9, y, '#8a7a5a', 3, 1); }
  px1(g, 3, 0, '#a8ff6a'); px1(g, 10, 1, '#a8ff6a'); px1(g, 6, 0, '#e8ffd0');
  return makeSprite(c, 1, 5);
};
// which picture the hand holds right now
function wpnState(p) {
  const id = p.weapon.id, k = clamp(1 - p.atkCd * attackRate(p), 0, 1);
  if (id === 'bow') return 'bow~' + (wpnReady(p) ? Math.min(3, Math.floor(k * 4)) : 0);
  if (id === 'crossbow') return k > 0.85 ? 'crossbow~L' : id;
  if (id === 'knives') return k > 0.7 ? 'knives~3' : id;
  if (id === 'venomtome') return p.atkPose > 0 ? 'venomtome~open' : id;
  return id;
}

/* ---------- drawing it in the hand ---------- */
const _drawHeldWpn = drawHeld;
drawHeld = function (g, p, x, y) {
  if (!p.weapon || p.wpnAng == null || p.beast) return _drawHeldWpn(g, p, x, y);
  const w = p.weapon, id0 = w.id, a0 = p.aim, F = wpnFeel(WEAPON[id0]), sw = p.swing, swinging = sw && sw.t < sw.dur, k = clamp(1 - p.atkCd * attackRate(p), 0, 1);
  // a boomerang in the air leaves the hand empty until it comes back
  if (id0 === 'boomerang' && G.projs.some((q) => q.team === 'p' && q.boomerang)) { drawRigArm(g, p, x, y); return; }
  try {
    if (!swinging) p.aim = p.wpnAng;
    w.id = wpnState(p);
    // the swing smears behind itself
    if (swinging && (sw.style === 'slash' || sw.style === 'spin' || sw.style === 'slam') && !CD.settings.lowFx) {
      const t0 = sw.t;
      for (const [dt, a] of [[0.05, 0.14], [0.025, 0.26]]) { if (t0 - dt <= 0) continue; sw.t = t0 - dt; g.globalAlpha = a; _drawHeldRig(g, p, x, y); }
      sw.t = t0; g.globalAlpha = 1;
    }
    // twin blades and fists: the other hand carries the second
    if (F.pair && !swinging) { const a1 = p.aim; p.aim = a1 + (p.face < 0 ? -0.55 : 0.55); g.globalAlpha = 0.92; _drawHeldRig(g, p, x - (p.face < 0 ? -5 : 5), y + 1); g.globalAlpha = 1; p.aim = a1; }
    _drawHeldWpn(g, p, x, y);
    if (F.pair && swinging && sw.t > sw.dur * 0.45) { const a1 = p.aim; p.aim = sw.ang + (p.face < 0 ? -0.3 : 0.3); _drawHeldRig(g, p, x - (p.face < 0 ? -5 : 5), y + 1); p.aim = a1; }
    // a staff gathers light at its tip as it readies the next cast
    if (F.magic && !CD.settings.lowFx) {
      const sp = heldWeapon(w.id), ang = swinging ? a0 : p.aim, hp = handPos(p, ang), len = sp.w - sp.ax - 2;
      const tx = x + hp.x - p.x + Math.cos(ang) * len, ty = y + (p.z || 0) + hp.y - p.y + Math.sin(ang) * len * 0.8 - (p.z || 0), r = 4 + k * 6 + Math.sin(G.t * 9) * 0.8;
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.2 + k * 0.45;
      g.drawImage(LightTex.get(F.magic, 0.3), Math.round(tx - r), Math.round(ty - r), Math.round(r * 2), Math.round(r * 2));
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      if (k >= 1 && Math.random() < 0.25) G.parts.push({ x: tx + p.x - x + rnd(-2, 2), y: ty + p.y - y + 6, z: 6, vx: rnd(-6, 6), vy: rnd(-3, 3), vz: rnd(6, 16), grav: -10, drag: 1, life: 0.5, max: 0.5, color: F.magic, size: 1, glow: true, floor: false });
    }
  } finally { w.id = id0; p.aim = a0; g.globalAlpha = 1; }
};
CD.wpnStatus = () => { const p = G.p; return p ? { id: p.weapon.id, ang: p.wpnAng, aim: p.aim, ready: wpnReady(p), carry: wpnFeel(WEAPON[p.weapon.id]).carry, state: wpnState(p) } : null; };

