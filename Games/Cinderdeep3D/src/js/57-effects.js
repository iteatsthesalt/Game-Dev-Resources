/* ============================================================
   Cinderdeep — effects: sparks, rings, runes, dash trails, slash
   crescents and lightning. Short-lived and drawn on the 3D floor
   with the rest of the effects; nothing here touches the game.
   ============================================================ */
const FX = { particles: [], hitAt: -99, dashAt: -99, motion: window.matchMedia('(prefers-reduced-motion: reduce)') };
let fxSeed = 0x6d2b79f5;
// effects draw their own randomness, so they never disturb the game's
function fxRand() { fxSeed ^= fxSeed << 13; fxSeed ^= fxSeed >>> 17; fxSeed ^= fxSeed << 5; return (fxSeed >>> 0) / 4294967296; }
const fxReduced = () => FX.motion.matches;
const fxColor = (c) => (typeof c === 'string' && /^#[\da-f]{6}$/i.test(c) ? c : '#ffd39a');
// a point in the world on the canvas being painted, lifted by z
function fxPoint(x, y, z = 0) { return { x: x - (R.ox || 0), y: y - (R.oy || 0) - z }; }
function fxAdd(type, x, y, o = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const cap = CD.settings.lowFx ? 100 : R.cssW < 600 ? 180 : 380;
  if (FX.particles.length >= cap) FX.particles.splice(0, Math.max(1, Math.floor(cap * 0.08)));
  FX.particles.push({ type, x, y, z: 0, born: G.t, life: 0.6, color: '#ffd39a', seed: fxRand() * 1000, ...o });
}
function fxSparks(x, y, color, n = 12, power = 1) {
  if (fxReduced()) n = Math.min(4, n);
  if (CD.settings.lowFx) n = Math.ceil(n * 0.4);
  for (let i = 0; i < n; i++) {
    const a = fxRand() * TAU, s = (20 + fxRand() * 90) * power;
    fxAdd('spark', x, y, { z: 5, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.45, vz: 18 + fxRand() * 55, grav: 190, life: 0.25 + fxRand() * 0.45, color: fxColor(color), size: 0.5 + fxRand() * 0.8 });
  }
}
const fxRing = (x, y, r = 75) => fxAdd('ring', x, y, { r, life: 0.65, color: '#b4f6ed' });
for (const name of ['realmZone', 'preFloor', 'runStart']) hook(name, () => { FX.particles = []; FX.hitAt = -99; });
function fxImpact(x, y, color, crit = false) {
  if (G.t - FX.hitAt < (crit ? 0.025 : 0.065)) return;
  FX.hitAt = G.t;
  fxAdd('impact', x, y, { z: 8, life: crit ? 0.3 : 0.18, color: fxColor(color), r: crit ? 19 : 10 });
  fxSparks(x, y, color, crit ? 18 : 7, crit ? 1.1 : 0.6);
  if (crit) fxRing(x, y, 45);
}

/* ---------- what makes them ---------- */
hook('onHit', (e, dmg, o, crit) => { if (!o.dot && !e.sgDummy && o.src !== 'guard') fxImpact(e.x, e.y - e.h * 0.35, o.color || (crit ? '#ffe4a1' : '#c2f1ed'), crit); });
hook('onAttack', (p, def) => {
  if (def.kind !== 'melee') return;
  const color = def.burn ? '#ffad68' : def.chill ? '#9de9ff' : def.poison ? '#b4ee8e' : def.shock ? '#fff3a2' : '#d9f7ed';
  fxAdd('crescent', p.x, p.y, { z: 8, life: 0.22, a: p.aim, r: Math.min(42, (def.reach || 22) * 1.1), color });
});
hook('onDash', (p) => { fxAdd('dash', p.x, p.y, { life: 0.35, z: 5, a: Math.atan2(p.dashDy || 0, p.dashDx || 1), color: '#a6e9ff' }); fxSparks(p.x, p.y, '#a6e9ff', 6, 0.5); });
// a dash leaves after-images of the hero
hook('update', () => {
  const p = G.p;
  if (!p || p.dead || fxReduced() || CD.settings.lowFx || p.dashT <= 0 || G.t - FX.dashAt <= 0.025) return;
  FX.dashAt = G.t;
  const own = Object.hasOwn(p, 'rigLazy'), old = p.rigLazy;
  let sp;
  p.rigLazy = true;
  try { sp = heroFrame(p); } finally { if (own) p.rigLazy = old; else delete p.rigLazy; }
  if (sp) fxAdd('ghost', p.x, p.y, { z: p.z || 0, life: 0.2, sp, flip: p.face < 0, scale: p.sizeMul || 1, color: '#b3e5ff' });
  fxAdd('glow', p.x, p.y, { z: 8, r: 11, life: 0.22, color: '#8dd5ee' });
});
hook('onAbility', (p, a) => {
  const id = (a && a.id) || '';
  const col = /frost|ice|snow|blizz/.test(id) ? '#8edcff' : /fire|flame|meteor|ember/.test(id) ? '#ffb278' : /venom|poison|cloud|thorn/.test(id) ? '#b4ec9b' : /storm|bolt|lightning/.test(id) ? '#fff3b5' : '#c0a4ff';
  fxAdd('rune', p.x, p.y, { r: 30, life: 0.85, color: col }); fxAdd('pillar', p.x, p.y, { life: 0.45, r: 20, height: 58, color: col });
  fxSparks(p.x, p.y, col, 15, 0.8); fxRing(p.x, p.y, 65);
});
hook('onKill', (e) => {
  if (e.type === 'ally' || e.sgDummy) return;
  fxSparks(e.x, e.y, (e.blood && e.blood[0]) || '#efb37b', e.big ? 22 : 12, 0.8);
  for (let i = 0; i < (CD.settings.lowFx ? 1 : 3); i++) fxAdd('smoke', e.x, e.y, { z: 5, vx: (fxRand() - 0.5) * 12, vy: (fxRand() - 0.5) * 8, vz: 14 + fxRand() * 12, life: 0.8 + fxRand() * 0.4, r: 7 + fxRand() * 5, color: '#9a9f9e' });
});
hook('onLevel', (p) => { fxAdd('rune', p.x, p.y, { life: 1.3, r: 42, color: '#ffe6a8' }); fxAdd('pillar', p.x, p.y, { life: 1.1, r: 25, height: 120, color: '#ffe4a0' }); fxSparks(p.x, p.y, '#fff2ca', 26, 1.2); fxRing(p.x, p.y, 100); });
hook('realmBoss', (e) => { fxAdd('rune', e.x, e.y, { life: 1.8, r: 70, color: '#ffcf8b' }); fxAdd('pillar', e.x, e.y, { life: 1.6, r: 40, height: 180, color: '#ffe4ac' }); fxSparks(e.x, e.y, '#ffd895', 42, 1.7); fxRing(e.x, e.y, 160); });
const _explodeFx = explode;
explode = function (x, y, r, dmg, o = {}) {
  const result = _explodeFx(x, y, r, dmg, o);
  fxRing(x, y, Math.min(180, r * 2)); fxAdd('impact', x, y, { z: 6, r: r * 0.7, life: 0.4, color: fxColor(o.color || '#ffc18b') }); fxSparks(x, y, o.color || '#ffbb75', 20, 1.3);
  for (let i = 0; i < 4; i++) fxAdd('smoke', x, y, { life: 1.2, r: 14 + fxRand() * 14, vx: (fxRand() - 0.5) * 35, vy: (fxRand() - 0.5) * 18, vz: 20 + fxRand() * 20, color: '#8a8990' });
  return result;
};
const _lightningFx = lightningStrike;
lightningStrike = function (x, y, dmg) {
  const result = _lightningFx(x, y, dmg);
  fxAdd('bolt', x, y, { life: 0.32, height: 150, color: '#d4eeff' }); fxAdd('glow', x, y, { life: 0.4, r: 40, color: '#b4daff' }); fxRing(x, y, 70);
  return result;
};

/* ---------- painting them ---------- */
// onto a canvas laid over the floor; R.ox and R.oy are that canvas's corner in the world
function fxPaint(g) {
  const t = G.t;
  FX.particles = FX.particles.filter((q) => t - q.born < q.life && t >= q.born);
  for (const q of FX.particles) {
    const age = t - q.born, k = clamp(age / q.life, 0, 1), fade = Math.pow(1 - k, 1.4), drag = q.type === 'spark' ? 4 : 0, d = drag ? (1 - Math.exp(-age * drag)) / drag : age;
    const z = Math.max(0, (q.z || 0) + (q.vz || 0) * age - (q.grav || 0) * age * age * 0.5), pt = fxPoint(q.x + (q.vx || 0) * d, q.y + (q.vy || 0) * d, z), x = pt.x, y = pt.y;
    g.save();
    g.globalAlpha = fade; g.globalCompositeOperation = q.type === 'smoke' ? 'source-over' : 'lighter'; g.strokeStyle = q.color; g.fillStyle = q.color;
    if (q.type === 'spark') {
      const a = Math.atan2((q.vy || 0) * 0.6 - (q.vz || 0) + (q.grav || 0) * age, q.vx || 1), len = 2 + Math.hypot(q.vx || 0, q.vy || 0) * 0.025 * (1 - k);
      g.lineWidth = q.size || 0.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(a) * len, y - Math.sin(a) * len); g.stroke();
      g.globalAlpha = fade * 0.35; g.drawImage(LightTex.get(q.color, 0.35), x - 4, y - 4, 8, 8);
    } else if (q.type === 'glow' || q.type === 'smoke') {
      const r = q.r * (q.type === 'smoke' ? 0.6 + k : 1);
      g.globalAlpha = fade * (q.type === 'smoke' ? 0.13 : 0.38); g.drawImage(LightTex.get(q.color, 0.25), x - r, y - r, r * 2, r * 2);
    } else if (q.type === 'impact') {
      const r = q.r * (0.4 + k);
      g.globalAlpha = fade * 0.65; g.drawImage(LightTex.get(q.color, 0.3), x - r * 2, y - r * 2, r * 4, r * 4);
      g.globalAlpha = fade; g.lineWidth = 1.1;
      for (let i = 0; i < 7; i++) { const a = (i * TAU) / 7 + q.seed; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); }
    } else if (q.type === 'ring' || q.type === 'rune') {
      const r = q.r * (q.type === 'ring' ? 0.15 + 0.85 * (1 - Math.pow(1 - k, 3)) : 1);
      g.globalAlpha = fade * 0.7; g.lineWidth = q.type === 'rune' ? 0.8 : 1; g.beginPath(); g.ellipse(x, y, r, r * 0.5, 0, 0, TAU); g.stroke();
      if (q.type === 'rune') for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8 + (fxReduced() ? 0 : age * 0.45);
        g.save(); g.translate(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5); g.rotate(a); g.strokeRect(-2, -2, 4, 4); g.beginPath(); g.moveTo(-1, 0); g.lineTo(4, 0); g.stroke(); g.restore();
      }
    } else if (q.type === 'pillar') {
      const r = q.r * (1 - k * 0.5), hh = q.height * (0.5 + 0.5 * (1 - k)), grad = g.createLinearGradient(x, y, x, y - hh);
      grad.addColorStop(0, rgbaStr(q.color, 0.45 * fade)); grad.addColorStop(1, rgbaStr(q.color, 0));
      g.fillStyle = grad; g.globalAlpha = 1; g.beginPath(); g.moveTo(x - r, y); g.lineTo(x - r * 0.2, y - hh); g.lineTo(x + r * 0.2, y - hh); g.lineTo(x + r, y); g.fill();
    } else if (q.type === 'crescent') {
      g.lineWidth = 1.8 * (1 - k) + 0.4; g.lineCap = 'round'; g.beginPath(); g.ellipse(x, y, q.r, q.r * 0.7, 0, q.a - 0.8 + k * 0.8, q.a + 0.5 + k * 0.8); g.stroke();
      g.lineWidth = 0.5; g.globalAlpha = fade * 0.5; g.beginPath(); g.ellipse(x, y, q.r + 3, q.r * 0.7 + 2, 0, q.a - 0.7 + k * 0.8, q.a + 0.4 + k * 0.8); g.stroke();
    } else if (q.type === 'dash') {
      g.lineWidth = 2 * (1 - k);
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x + Math.cos(q.a + Math.PI / 2) * i * 4, y + Math.sin(q.a + Math.PI / 2) * i * 4); g.lineTo(x - Math.cos(q.a) * (12 + k * 24) + i * 4, y - Math.sin(q.a) * (12 + k * 24)); g.stroke(); }
    } else if (q.type === 'ghost') {
      g.globalCompositeOperation = 'screen'; g.globalAlpha = fade * 0.28; drawSprite(g, q.sp, x, y, q.flip, { alpha: fade * 0.28, scale: q.scale, tint: q.color, tintA: 0.8 });
    } else if (q.type === 'bolt') {
      g.lineJoin = 'round'; g.lineCap = 'round';
      const points = []; for (let i = 0; i < 10; i++) points.push([x + (i === 9 ? 0 : Math.sin(q.seed + i * 17.1) * 8), y - q.height * (1 - i / 9)]);
      for (const [width, alpha] of [[7, 0.08], [3, 0.28], [0.8, 1]]) { g.lineWidth = width; g.globalAlpha = fade * alpha; g.beginPath(); points.forEach(([xx, yy], i) => (i ? g.lineTo(xx, yy) : g.moveTo(xx, yy))); g.stroke(); }
    }
    g.restore();
  }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
}
