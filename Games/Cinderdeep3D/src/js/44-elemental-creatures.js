/* ============================================================
   Cinderdeep — elemental creatures. Any monster or Realm
   creature can be born of an element: fire, frost, storm,
   venom, shadow or earth. It wears the element's colours on
   its own rigged body, sheds its particles, lights the dark,
   lays its status on what it hits, resists its own element,
   and dies the element's way. Lands lean toward their own.
   ============================================================ */
const ELEM = {
  fire: { name: 'Ember', ramp: ['#2a0c08', '#8a1e10', '#e2501a', '#ffb347', '#fff1a8'], glow: '#ffb35e', eye: '#fff6c8', mix: 0.74 },
  frost: { name: 'Rime', ramp: ['#0e1e3a', '#2a5a8a', '#6ab4e8', '#cfefff', '#ffffff'], glow: '#bfe9ff', eye: '#ffffff', mix: 0.72 },
  storm: { name: 'Storm', ramp: ['#161a3a', '#2e3a7a', '#5a7ad8', '#a8c8ff', '#fff27a'], glow: '#fff27a', eye: '#fff27a', mix: 0.7 },
  venom: { name: 'Blight', ramp: ['#0e1a0a', '#2a5a1a', '#5fa83a', '#a8e05c', '#e8ffb0'], glow: '#a8ff6a', eye: '#e8ff6a', mix: 0.72 },
  shadow: { name: 'Shade', ramp: ['#08060e', '#1e1430', '#3e2a5e', '#7a5aa8', '#e0b8ff'], glow: '#c873ff', eye: '#ff6fe0', mix: 0.8 },
  earth: { name: 'Stone', ramp: ['#1a1410', '#4a3a2a', '#7a6a52', '#b8a888', '#e8dcc0'], glow: '#ffd35c', eye: '#ffd35c', mix: 0.7 },
};
const ELEM_IDS = Object.keys(ELEM);
// lands and depths that breed their own element
const ELEM_LAND = {
  ashlands: 'fire', caldera: 'fire', desert: 'fire', frostpeak: 'frost', glacier: 'frost', storm: 'storm', saltflats: 'storm', coral: 'storm',
  murkmire: 'venom', sporeveil: 'venom', jungle: 'venom', mangrove: 'venom', shadowfen: 'shadow', voidscar: 'shadow', ossplains: 'shadow',
  canyon: 'earth', crystal: 'earth', savanna: 'earth', pine: 'earth', ossuary: 'shadow', grotto: 'venom', frost: 'frost', core: 'fire',
};
function elemRoll(elite) {
  const realm = W.on && !W.inInst && W.Z, land = realm ? W.Z.b.id : G.fl && G.fl.info && G.fl.info.act ? G.fl.info.act.id : '';
  const ch = (realm ? 0.11 : Math.min(0.2, 0.05 + 0.015 * ((G.fl && G.fl.idx) || 0))) * (elite ? 1.6 : 1);
  if (Math.random() >= ch) return null;
  const home = ELEM_LAND[land];
  if (home && Math.random() < 0.6) return home;
  return rndPick(ELEM_IDS);
}

/* ---------- its own body in the element's colours: light maps to the ramp, the outline stays, eyes burn ---------- */
const ELEM_RGB = {};
function elemRamp(el) {
  if (ELEM_RGB[el]) return ELEM_RGB[el];
  const E = ELEM[el];
  return (ELEM_RGB[el] = { ramp: E.ramp.map(hexRGB), eye: hexRGB(E.eye) });
}
function elemSprite(sp, el, veil) {
  if (!sp || !ELEM[el]) return sp;
  const key = el + (veil ? ':v' : '');
  sp._elem = sp._elem || {};
  if (sp._elem[key]) return sp._elem[key];
  if (veil) {
    const base = elemSprite(sp, el), c = mkCanvas(sp.w, sp.h), g = c.getContext('2d');
    g.globalAlpha = 0.38; g.drawImage(base.c, 0, 0);
    return (sp._elem[key] = makeSprite(c, sp.ax, sp.ay));
  }
  const c = mkCanvas(sp.w, sp.h), g = c.getContext('2d');
  g.drawImage(sp.c, 0, 0);
  try {
    const img = g.getImageData(0, 0, sp.w, sp.h), d = img.data, { ramp, eye } = elemRamp(el), mix = ELEM[el].mix, n = ramp.length - 1;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 10) continue;
      const r = d[i], gg = d[i + 1], b = d[i + 2], L = (r * 0.3 + gg * 0.59 + b * 0.11) / 255;
      if (L < 0.09) continue;
      let t;
      if (L > 0.86 && Math.max(r, gg, b) - Math.min(r, gg, b) < 90) t = eye;
      else { const f = Math.min(n - 0.001, L * n * 1.08), k = Math.floor(f), u = f - k; t = [lerp(ramp[k][0], ramp[k + 1][0], u), lerp(ramp[k][1], ramp[k + 1][1], u), lerp(ramp[k][2], ramp[k + 1][2], u)]; }
      d[i] = Math.round(lerp(r, t[0], mix)); d[i + 1] = Math.round(lerp(gg, t[1], mix)); d[i + 2] = Math.round(lerp(b, t[2], mix));
    }
    g.putImageData(img, 0, 0);
  } catch (err) { /* a canvas we may not read: keep its colours */ }
  return (sp._elem[key] = makeSprite(c, sp.ax, sp.ay));
}
const _crigEntFrameElem = crigEntFrame;
crigEntFrame = function (e) {
  const sp = _crigEntFrameElem(e);
  if (!e.elem) return sp;
  // without the rig, the painted frame the game would have picked, recoloured all the same
  const base = sp || e.frames[e.pose === 2 ? 2 : e.pose === 1 ? 1 : Math.floor(e.anim * (e.fly ? 8 : 4)) % 2] || e.frames[0];
  return elemSprite(base, e.elem, e.veilT > 0);
};
const _crigCorpseElem = crigCorpse;
crigCorpse = function (e) {
  const sp = _crigCorpseElem(e);
  return e.elem ? elemSprite(sp || e.frames[0], e.elem) : sp;
};

/* ---------- being born of it ---------- */
hook('spawned', (e) => { e._elemRoll = true; });
function makeElemental(e, el) {
  const k = e.hp / (e.maxHp || 1);
  e.elem = el; e.maxHp *= 1.35; e.xp *= 1.5; e.gold *= 1.5;
  if (el === 'fire') e.fireproof = true;
  if (el === 'storm') e.spd *= 1.18;
  if (el === 'earth') { e.maxHp *= 1.25; e.spd *= 0.85; e.armor = 1 - (1 - (e.armor || 0)) * 0.8; }
  if (el === 'shadow') e.veilCd = rnd(2, 4);
  e.hp = e.maxHp * k;
  e.blood = [ELEM[el].glow, ELEM[el].ramp[2]];
}
CD.makeElemental = makeElemental;
hook('update', (dt) => {
  if (!dt) return;
  const VW = R.VW, VH = R.VH, cam = { x: G.cam.x - VW / 2, y: G.cam.y - VH / 2 }, fx = !CD.settings.lowFx;
  for (const e of G.ents) {
    if (e._elemRoll) {
      e._elemRoll = false;
      if (e.type === 'enemy' && !e.summoned && !e.nem && !e.boss && !e.mini && !e.elem && e.def && !e.def.ally) { const el = elemRoll(!!e.eliteMods); if (el) makeElemental(e, el); }
    }
    if (!e.elem || e.dead) continue;
    if (e.elem === 'frost') { e.chillT = 0; e.freezeT = 0; e.chillN = 0; }
    if (e.elem === 'fire') e.burn = null;
    if (e.elem === 'venom') e.poison = null;
    if (e.elem === 'shadow') {
      if (e.veilT > 0) e.veilT -= dt;
      else if ((e.veilCd -= dt) <= 0) { e.veilCd = rnd(3.5, 6); e.veilT = 1.3; burst(e.x, e.y - e.h / 2, 8, ['#3e2a5e', '#c873ff', '#08060e'], { smax: 40, grav: -20, floor: false }); }
    }
    // what it sheds
    if (!fx || e.spawnT > 0 || e.x < cam.x - 30 || e.x > cam.x + VW + 30 || e.y < cam.y - 20 || e.y > cam.y + VH + 40) continue;
    const E = ELEM[e.elem], hgt = (e.h || 12) * (e.scale || 1), x = e.x + rnd(-e.r, e.r), z = rnd(2, hgt);
    if (Math.random() > dt * 9) continue;
    const P = { x, y: e.y, z, vx: rnd(-6, 6), vy: rnd(-3, 3), vz: 0, grav: 0, drag: 1, life: 0.8, max: 0.8, color: E.glow, size: 1, glow: true, floor: false };
    if (e.elem === 'fire') { P.vz = rnd(18, 34); P.grav = -20; P.color = rndPick(['#ffb347', '#ff7a2a', '#fff1a8']); }
    else if (e.elem === 'frost') { P.vz = rnd(-6, 2); P.grav = 14; P.color = rndPick(['#ffffff', '#cfefff']); P.life = P.max = 1.1; }
    else if (e.elem === 'storm') { P.vx = rnd(-40, 40); P.vz = rnd(-20, 30); P.drag = 6; P.life = P.max = 0.25; P.color = rndPick(['#fff27a', '#ffffff', '#a8c8ff']); }
    else if (e.elem === 'venom') { P.z = rnd(hgt * 0.2, hgt * 0.7); P.grav = 120; P.vz = 0; P.color = rndPick(['#a8e05c', '#5fa83a']); P.floor = true; P.glow = false; }
    else if (e.elem === 'shadow') { P.vz = rnd(6, 14); P.grav = -6; P.color = rndPick(['#3e2a5e', '#1e1430', '#7a5aa8']); P.glow = false; P.life = P.max = 1.2; P.size = 2; }
    else { P.z = rnd(hgt * 0.3, hgt); P.grav = 160; P.color = rndPick(['#7a6a52', '#b8a888', '#ffd35c']); P.glow = false; P.floor = true; }
    G.parts.push(P);
  }
});
// shades fade half out of the world now and then, and little reaches them there
HOOKS.dmgMul.push((e) => (e.veilT > 0 ? 0.4 : 1));

/* ---------- what its touch leaves on you ---------- */
hook('projSpawn', (pr) => {
  const o = pr.owner;
  if (pr.team !== 'e' || !o || !o.elem) return;
  pr.elem = o.elem; pr.color = ELEM[o.elem].glow; pr.light = ELEM[o.elem].glow;
});
hook('onHurt', (dmg, src, p) => {
  const el = (src.ent && src.ent.elem) || (src.proj && (src.proj.elem || (src.proj.owner && src.proj.owner.elem)));
  if (!el || !p || p.dead) return;
  if (el === 'fire' && !p.stats.fireproof) p.burnT = Math.max(p.burnT || 0, 2);
  else if (el === 'frost') p.chillT = Math.max(p.chillT || 0, 1.6);
  else if (el === 'storm') { p.slowT = Math.max(p.slowT || 0, 0.35); zapFx(p.x + rnd(-6, 6), p.y - 14, p.x + rnd(-6, 6), p.y, '#fff27a', 0.12); }
  else if (el === 'venom') p.poisonT = Math.max(p.poisonT || 0, 3);
  else if (el === 'shadow') { const e = src.ent || (src.proj && src.proj.owner); if (e && !e.dead) e.hp = Math.min(e.maxHp, e.hp + dmg); G.darkMul = 1.25; later(1.2, () => { G.darkMul = 1; }, true); }
  else if (el === 'earth' && src.kx != null && !p.stats.sturdy) { p.vx += src.kx * 0.6; p.vy += src.ky * 0.6; }
});

/* ---------- dying its element's death ---------- */
hook('onKill', (e) => {
  if (!e || !e.elem) return;
  const x = e.x, y = e.y, E = ELEM[e.elem], dmg = e.dmg || 8, p = G.p;
  if (e.elem === 'fire') {
    G.fx.push({ kind: 'firefield', x, y, r: 18, t: 0, life: 2.4, team: 'e', burn: true, tick: 0.3 });
    burst(x, y - 6, 16, ['#ffb347', '#ff7a2a', '#fff1a8'], { smax: 110, glow: true }); Sound.play('fire', { v: 0.5 });
  } else if (e.elem === 'frost') {
    G.fx.push({ kind: 'pool', x, y, r: 22, t: 0, life: 3, team: 'e', slow: true, tick: 0.3, color: '#bfe9ff' });
    burst(x, y - 6, 14, ['#ffffff', '#cfefff', '#6ab4e8'], { smax: 90 }); ring(x, y, 22, '#cfefff', 0.4, 2); Sound.play('ice', { v: 0.5 });
  } else if (e.elem === 'storm') {
    for (let i = 0; i < 3; i++) { const a = rnd(TAU); zapFx(x, y - 6, x + Math.cos(a) * 34, y - 6 + Math.sin(a) * 20, '#fff27a', 0.18); }
    if (p && !p.dead && Math.hypot(p.x - x, p.y - y) < 60) { zapFx(x, y - 6, p.x, p.y - 8, '#fff27a', 0.2); hurtPlayer(dmg * 0.5, { ent: null }); }
    Sound.play('zap', { v: 0.6 });
  } else if (e.elem === 'venom') {
    G.fx.push({ kind: 'pool', x, y, r: 20, t: 0, life: 4, team: 'e', poison: true, tick: 0.3, color: '#8fe05c' });
    burst(x, y - 4, 12, ['#a8e05c', '#5fa83a'], { smax: 70 }); Sound.play('splat', { v: 0.5 });
  } else if (e.elem === 'shadow') {
    burst(x, y - 8, 20, ['#3e2a5e', '#c873ff', '#08060e'], { smax: 80, grav: -30, floor: false });
    G.darkMul = 1.35; later(0.8, () => { G.darkMul = 1; }, true);
  } else if (e.elem === 'earth') {
    const sp = crigCorpse(e) || e.frames[0];
    if (sp && typeof crigShatter === 'function') crigShatter(x, y, sp);
    burst(x, y - 4, 10, ['#7a6a52', '#b8a888', '#ffd35c'], { smax: 90 }); shake(2); Sound.play('slam', { v: 0.35 });
  }
  ring(x, y - 4, 16, E.glow, 0.35, 1);
});

/* ---------- light, and a mark over its health ---------- */
const _lightsElem = lightSources;
lightSources = function (vis) {
  const L = _lightsElem(vis), cam = { x: G.cam.x - R.VW / 2, y: G.cam.y - R.VH / 2 };
  for (const e of G.ents) {
    if (!e.elem || e.dead || e.elem === 'shadow') continue;
    if (e.x < cam.x - 60 || e.x > cam.x + R.VW + 60 || e.y < cam.y - 60 || e.y > cam.y + R.VH + 60) continue;
    L.push({ x: e.x, y: e.y - 6, r: e.elem === 'earth' ? 16 : 28, c: ELEM[e.elem].glow, a: 0.25 });
  }
  return L;
};
hook('entOverlay', (g, e, x, y) => {
  if (!e.elem || e.dead) return;
  const top = Math.round(y - e.h * (e.scale || 1) - 6), w = e.eliteMods ? 20 : 14, px = Math.round(x - w / 2) - 5;
  g.fillStyle = '#0a0608'; g.fillRect(px - 1, top - 1, 5, 4);
  g.fillStyle = ELEM[e.elem].glow; g.fillRect(px, top, 3, 2); g.fillRect(px + 1, top - 1, 1, 4);
});

