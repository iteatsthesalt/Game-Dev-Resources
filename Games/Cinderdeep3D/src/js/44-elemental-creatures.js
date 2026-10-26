/* ============================================================
   Cinderdeep — the twenty-four elements. Eight are primal:
   fire, frost, storm, venom, shadow, earth, chaos and luck.
   Sixteen are fused, each of two primals that sit one or two
   steps apart on the skill wheel, and named as that wheel names
   them: Magma, Mycelial, Sanguine, Void, Shatter, Blizzard,
   Zephyr, Radiance, Brimstone, Obsidian, Mutagen, Wraith,
   Arcane, Prism, Plasma and Gilded. A fused element does all
   that both of its primals do, a little less of each, in its
   own colours. Any creature can be born of one: it wears the
   colours on its own rigged body, sheds its particles, lights
   the dark, lays its status on what it hits, resists its own
   element and dies the element's way. What it is born of comes
   up from the Mycelium under it (45-mycelium.js).
   ============================================================ */
// born: what it is made of; keep: what it shrugs off each frame; shed: one particle (P) of it; touch: what its hit
// leaves on the hero; death: how it dies. k is the share a primal has in a fused element.
const PRIMAL = {
  fire: {
    name: 'Ember', ramp: ['#2a0c08', '#8a1e10', '#e2501a', '#ffb347', '#fff1a8'], glow: '#ffb35e', eye: '#fff6c8', mix: 0.74,
    born: (e) => { e.fireproof = true; },
    keep: (e) => { e.burn = null; },
    shed: (P) => { P.vz = rnd(18, 34); P.grav = -20; P.color = rndPick(['#ffb347', '#ff7a2a', '#fff1a8']); },
    touch: (p) => { if (!p.stats.fireproof) p.burnT = Math.max(p.burnT || 0, 2); },
    death: (e, x, y) => { G.fx.push({ kind: 'firefield', x, y, r: 18, t: 0, life: 2.4, team: 'e', burn: true, tick: 0.3 }); burst(x, y - 6, 16, ['#ffb347', '#ff7a2a', '#fff1a8'], { smax: 110, glow: true }); Sound.play('fire', { v: 0.5 }); },
  },
  frost: {
    name: 'Rime', ramp: ['#0e1e3a', '#2a5a8a', '#6ab4e8', '#cfefff', '#ffffff'], glow: '#bfe9ff', eye: '#ffffff', mix: 0.72,
    born: () => {},
    keep: (e) => { e.chillT = 0; e.freezeT = 0; e.chillN = 0; },
    shed: (P) => { P.vz = rnd(-6, 2); P.grav = 14; P.color = rndPick(['#ffffff', '#cfefff']); P.life = P.max = 1.1; },
    touch: (p) => { p.chillT = Math.max(p.chillT || 0, 1.6); },
    death: (e, x, y) => { G.fx.push({ kind: 'pool', x, y, r: 22, t: 0, life: 3, team: 'e', slow: true, tick: 0.3, color: '#bfe9ff' }); burst(x, y - 6, 14, ['#ffffff', '#cfefff', '#6ab4e8'], { smax: 90 }); ring(x, y, 22, '#cfefff', 0.4, 2); Sound.play('ice', { v: 0.5 }); },
  },
  storm: {
    name: 'Storm', ramp: ['#161a3a', '#2e3a7a', '#5a7ad8', '#a8c8ff', '#fff27a'], glow: '#fff27a', eye: '#fff27a', mix: 0.7,
    born: (e, k) => { e.spd *= 1 + 0.18 * k; },
    keep: () => {},
    shed: (P) => { P.vx = rnd(-40, 40); P.vz = rnd(-20, 30); P.drag = 6; P.life = P.max = 0.25; P.color = rndPick(['#fff27a', '#ffffff', '#a8c8ff']); },
    touch: (p) => { p.slowT = Math.max(p.slowT || 0, 0.35); zapFx(p.x + rnd(-6, 6), p.y - 14, p.x + rnd(-6, 6), p.y, '#fff27a', 0.12); },
    death: (e, x, y, dmg) => {
      const p = G.p;
      for (let i = 0; i < 3; i++) { const a = rnd(TAU); zapFx(x, y - 6, x + Math.cos(a) * 34, y - 6 + Math.sin(a) * 20, '#fff27a', 0.18); }
      if (p && !p.dead && Math.hypot(p.x - x, p.y - y) < 60) { zapFx(x, y - 6, p.x, p.y - 8, '#fff27a', 0.2); hurtPlayer(dmg * 0.5, { ent: null }); }
      Sound.play('zap', { v: 0.6 });
    },
  },
  venom: {
    name: 'Blight', ramp: ['#0e1a0a', '#2a5a1a', '#5fa83a', '#a8e05c', '#e8ffb0'], glow: '#a8ff6a', eye: '#e8ff6a', mix: 0.72,
    born: () => {},
    keep: (e) => { e.poison = null; },
    shed: (P, hgt) => { P.z = rnd(hgt * 0.2, hgt * 0.7); P.grav = 120; P.vz = 0; P.color = rndPick(['#a8e05c', '#5fa83a']); P.floor = true; P.glow = false; },
    touch: (p) => { p.poisonT = Math.max(p.poisonT || 0, 3); },
    death: (e, x, y) => { G.fx.push({ kind: 'pool', x, y, r: 20, t: 0, life: 4, team: 'e', poison: true, tick: 0.3, color: '#8fe05c' }); burst(x, y - 4, 12, ['#a8e05c', '#5fa83a'], { smax: 70 }); Sound.play('splat', { v: 0.5 }); },
  },
  shadow: {
    name: 'Shade', ramp: ['#08060e', '#1e1430', '#3e2a5e', '#7a5aa8', '#e0b8ff'], glow: '#c873ff', eye: '#ff6fe0', mix: 0.8,
    born: (e) => { e.veilCd = rnd(2, 4); },
    keep: (e, dt) => {
      if (e.veilT > 0) e.veilT -= dt;
      else if ((e.veilCd -= dt) <= 0) { e.veilCd = rnd(3.5, 6); e.veilT = 1.3; burst(e.x, e.y - e.h / 2, 8, ['#3e2a5e', '#c873ff', '#08060e'], { smax: 40, grav: -20, floor: false }); }
    },
    shed: (P) => { P.vz = rnd(6, 14); P.grav = -6; P.color = rndPick(['#3e2a5e', '#1e1430', '#7a5aa8']); P.glow = false; P.life = P.max = 1.2; P.size = 2; },
    touch: (p, src, dmg, e) => { if (e && !e.dead) e.hp = Math.min(e.maxHp, e.hp + dmg); G.darkMul = 1.25; later(1.2, () => { G.darkMul = 1; }, true); },
    death: (e, x, y) => { burst(x, y - 8, 20, ['#3e2a5e', '#c873ff', '#08060e'], { smax: 80, grav: -30, floor: false }); G.darkMul = 1.35; later(0.8, () => { G.darkMul = 1; }, true); },
  },
  earth: {
    name: 'Stone', ramp: ['#1a1410', '#4a3a2a', '#7a6a52', '#b8a888', '#e8dcc0'], glow: '#ffd35c', eye: '#ffd35c', mix: 0.7,
    born: (e, k) => { e.maxHp *= 1 + 0.25 * k; e.spd *= 1 - 0.15 * k; e.armor = 1 - (1 - (e.armor || 0)) * (1 - 0.2 * k); },
    keep: () => {},
    shed: (P, hgt) => { P.z = rnd(hgt * 0.3, hgt); P.grav = 160; P.color = rndPick(['#7a6a52', '#b8a888', '#ffd35c']); P.glow = false; P.floor = true; },
    touch: (p, src) => { if (src.kx != null && !p.stats.sturdy) { p.vx += src.kx * 0.6; p.vy += src.ky * 0.6; } },
    death: (e, x, y) => { const sp = crigCorpse(e) || e.frames[0]; if (sp && typeof crigShatter === 'function') crigShatter(x, y, sp); burst(x, y - 4, 10, ['#7a6a52', '#b8a888', '#ffd35c'], { smax: 90 }); shake(2); Sound.play('slam', { v: 0.35 }); },
  },
  // chaos does what another primal does, a different one each time
  chaos: {
    name: 'Chaos', ramp: ['#12041a', '#4a0a3a', '#c8246a', '#ff6ad8', '#ffe8ff'], glow: '#ff3d9a', eye: '#ffffff', mix: 0.76,
    born: (e, k) => { e.spd *= 1 + rnd(-0.1, 0.25) * k; PRIMAL[chaosPick()].born(e, k * 0.6); },
    keep: () => {},
    shed: (P) => { P.vx = rnd(-20, 20); P.vz = rnd(-10, 24); P.grav = rnd(-20, 20); P.color = rndPick(['#ff3d9a', '#4affe0', '#fff27a', '#c873ff']); },
    touch: (p, src, dmg, e) => PRIMAL[chaosPick()].touch(p, src, dmg, e),
    death: (e, x, y, dmg) => { PRIMAL[chaosPick()].death(e, x, y, dmg); ring(x, y - 4, 26, '#ff3d9a', 0.45, 2); },
  },
  // luck is rich: it carries more gold, filches the hero's, and spills it all when it dies
  luck: {
    name: 'Fortune', ramp: ['#1a1206', '#5a4210', '#c8901c', '#ffd35c', '#fff8d0'], glow: '#ffd35c', eye: '#ffffff', mix: 0.74,
    born: (e, k) => { e.gold *= 1 + 1.5 * k; e.stolen = 0; },
    keep: () => {},
    shed: (P) => { P.vz = rnd(10, 22); P.grav = -4; P.size = 1; P.color = rndPick(['#ffd35c', '#fff8d0', '#ffe08a']); },
    touch: (p, src, dmg, e) => {
      const n = Math.min(p.gold || 0, 2 + Math.floor(Math.random() * 4));
      if (!n) return;
      p.gold -= n; if (e) e.stolen = (e.stolen || 0) + n;
      burst(p.x, p.y - 10, 5, ['#ffd35c', '#fff8d0'], { smax: 50 }); Sound.play('coin', { v: 0.4 });
    },
    death: (e, x, y) => {
      for (let i = 0; i < 3 + Math.ceil((e.stolen || 0) / 5); i++) dropPickup('gold', x, y, 5);
      if (Math.random() < 0.08) dropPickup('potion', x, y, 1);
      burst(x, y - 6, 14, ['#ffd35c', '#fff8d0', '#c8901c'], { smax: 90, glow: true });
    },
  },
};
const PRIMAL_IDS = Object.keys(PRIMAL);
const chaosPick = () => rndPick(PRIMAL_IDS.filter((q) => q !== 'chaos'));
// the fused sixteen: each primal joined to its neighbours one and two steps round the skill wheel
const FUSED = [
  ['magma', 'Magma', 'fire', 'earth', ['#1a0a06', '#5a1a0a', '#c84a14', '#ff8a2a', '#ffd08a'], '#ff8a2a', '#fff1a8'],
  ['mycelial', 'Mycelial', 'earth', 'venom', ['#120e14', '#3a2a3e', '#7a5a8a', '#c58cff', '#f0e0ff'], '#c58cff', '#f0e0ff'],
  ['sanguine', 'Sanguine', 'venom', 'shadow', ['#140406', '#4a0a14', '#9a1428', '#e2434f', '#ffc0c8'], '#ff4a5a', '#ffd8dc'],
  ['void', 'Void', 'shadow', 'chaos', ['#020208', '#0e0a2a', '#2a1a6a', '#4affe0', '#e0fffa'], '#4affe0', '#e0fffa'],
  ['shatter', 'Shatter', 'chaos', 'frost', ['#0a0e1e', '#3a2a6a', '#8a6ad8', '#d8c8ff', '#ffffff'], '#d8b8ff', '#ffffff'],
  ['blizzard', 'Blizzard', 'frost', 'storm', ['#0e1a2e', '#3a5a8a', '#9ac8f0', '#e8f6ff', '#ffffff'], '#e8f6ff', '#ffffff'],
  ['zephyr', 'Zephyr', 'storm', 'luck', ['#0a1a14', '#2a6a5a', '#6ad8b8', '#c8fff0', '#ffffff'], '#8affd8', '#ffffff'],
  ['radiance', 'Radiance', 'luck', 'fire', ['#2a1606', '#8a5a10', '#f0b030', '#fff27a', '#ffffff'], '#fff6b0', '#ffffff'],
  ['brimstone', 'Brimstone', 'fire', 'venom', ['#1a1406', '#5a4a0a', '#b8a01a', '#ffe04a', '#fff8c0'], '#ffd84a', '#fff8c0'],
  ['obsidian', 'Obsidian', 'earth', 'shadow', ['#050508', '#141420', '#2a2a40', '#5a5a7a', '#c8c8ff'], '#a8a8ff', '#e0e0ff'],
  ['mutagen', 'Mutagen', 'venom', 'chaos', ['#0a1406', '#2a5a0a', '#6ae02a', '#ff3dc8', '#ffe8ff'], '#b8ff3d', '#ffe8ff'],
  ['wraith', 'Wraith', 'shadow', 'frost', ['#06080e', '#1a2a3a', '#4a6a8a', '#a8d8e8', '#f0ffff'], '#a8f0ff', '#f0ffff'],
  ['arcane', 'Arcane', 'chaos', 'storm', ['#0a0620', '#2a1a6a', '#6a4ae0', '#b98cff', '#fff0ff'], '#b98cff', '#fff0ff'],
  ['prism', 'Prism', 'frost', 'luck', ['#101018', '#3a4a6a', '#8ad8ff', '#ffb8f0', '#ffffff'], '#ffffff', '#ffffff'],
  ['plasma', 'Plasma', 'storm', 'fire', ['#1a0620', '#6a1a6a', '#ff4ab8', '#ffb8ff', '#ffffff'], '#ff8af0', '#ffffff'],
  ['gilded', 'Gilded', 'luck', 'earth', ['#1a1408', '#4a3a1a', '#a8823a', '#e8c060', '#fff4c8'], '#ffe08a', '#fff4c8'],
];
// every element by id: its name and colours, and of: the primals it is made of
const ELEM = {};
for (const id of PRIMAL_IDS) { const P = PRIMAL[id]; ELEM[id] = { id, name: P.name, ramp: P.ramp, glow: P.glow, eye: P.eye, mix: P.mix, of: [id] }; }
for (const [id, name, a, b, ramp, glow, eye] of FUSED) ELEM[id] = { id, name, ramp, glow, eye, mix: 0.76, of: [a, b] };
const ELEM_IDS = Object.keys(ELEM);
const FUSE = {};
for (const [id, , a, b] of FUSED) FUSE[a + '+' + b] = FUSE[b + '+' + a] = id;
// the element two primals make together, if they fuse
const elemFuse = (a, b) => (a === b ? a : FUSE[a + '+' + b] || null);
// the share each primal has in an element: all of a primal, most of each of a fused pair
const elemShare = (el) => (ELEM[el].of.length > 1 ? 0.7 : 1);
// lands and depths that breed their own primal
const ELEM_LAND = {
  ashlands: 'fire', caldera: 'fire', desert: 'fire', frostpeak: 'frost', glacier: 'frost', storm: 'storm', saltflats: 'storm', coral: 'storm',
  murkmire: 'venom', sporeveil: 'venom', jungle: 'venom', mangrove: 'venom', shadowfen: 'shadow', voidscar: 'shadow', ossplains: 'shadow',
  canyon: 'earth', crystal: 'earth', savanna: 'earth', pine: 'earth', ossuary: 'shadow', grotto: 'venom', frost: 'frost', core: 'fire',
};
// whether a creature here is born of an element, and which: the Mycelium under it decides
function elemRoll(elite, x, y) {
  const realm = W.on && !W.inInst && W.Z;
  const ch = (realm ? 0.11 : Math.min(0.2, 0.05 + 0.015 * ((G.fl && G.fl.idx) || 0))) * (elite ? 1.6 : 1);
  if (Math.random() >= ch) return null;
  return mycElemAt(x, y);
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
  const k = e.hp / (e.maxHp || 1), E = ELEM[el], share = elemShare(el), fused = E.of.length > 1;
  e.elem = el; e.maxHp *= fused ? 1.45 : 1.35; e.xp *= fused ? 1.8 : 1.5; e.gold *= fused ? 1.8 : 1.5;
  for (const q of E.of) PRIMAL[q].born(e, share);
  e.hp = e.maxHp * k;
  e.blood = [E.glow, E.ramp[2]];
}
CD.makeElemental = makeElemental;
hook('update', (dt) => {
  if (!dt) return;
  const VW = R.VW, VH = R.VH, cam = { x: G.cam.x - VW / 2, y: G.cam.y - VH / 2 }, fx = !CD.settings.lowFx;
  for (const e of G.ents) {
    if (e._elemRoll) {
      e._elemRoll = false;
      if (e.type === 'enemy' && !e.summoned && !e.nem && !e.boss && !e.mini && !e.elem && e.def && !e.def.ally) { const el = elemRoll(!!e.eliteMods, e.x, e.y); if (el) makeElemental(e, el); }
    }
    if (!e.elem || e.dead || !ELEM[e.elem]) continue;
    const E = ELEM[e.elem];
    for (const q of E.of) PRIMAL[q].keep(e, dt);
    // what it sheds: a primal's particle, in a fused element's own colours
    if (!fx || e.spawnT > 0 || e.x < cam.x - 30 || e.x > cam.x + VW + 30 || e.y < cam.y - 20 || e.y > cam.y + VH + 40) continue;
    const hgt = (e.h || 12) * (e.scale || 1), x = e.x + rnd(-e.r, e.r), z = rnd(2, hgt);
    if (Math.random() > dt * 9) continue;
    const P = { x, y: e.y, z, vx: rnd(-6, 6), vy: rnd(-3, 3), vz: 0, grav: 0, drag: 1, life: 0.8, max: 0.8, color: E.glow, size: 1, glow: true, floor: false };
    PRIMAL[rndPick(E.of)].shed(P, hgt);
    if (E.of.length > 1) P.color = rndPick([E.glow, E.ramp[3], E.ramp[4]]);
    G.parts.push(P);
  }
});
// shades fade half out of the world now and then, and little reaches them there
HOOKS.dmgMul.push((e) => (e.veilT > 0 ? 0.4 : 1));

/* ---------- what its touch leaves on you ---------- */
hook('projSpawn', (pr) => {
  const o = pr.owner;
  if (pr.team !== 'e' || !o || !o.elem || !ELEM[o.elem]) return;
  pr.elem = o.elem; pr.color = ELEM[o.elem].glow; pr.light = ELEM[o.elem].glow;
});
hook('onHurt', (dmg, src, p) => {
  const el = (src.ent && src.ent.elem) || (src.proj && (src.proj.elem || (src.proj.owner && src.proj.owner.elem)));
  if (!el || !ELEM[el] || !p || p.dead) return;
  const e = src.ent || (src.proj && src.proj.owner);
  for (const q of ELEM[el].of) PRIMAL[q].touch(p, src, dmg, e);
});

/* ---------- dying its element's death: a fused element dies both its primals' deaths ---------- */
hook('onKill', (e) => {
  if (!e || !e.elem || !ELEM[e.elem]) return;
  const x = e.x, y = e.y, E = ELEM[e.elem], dmg = e.dmg || 8;
  for (const q of E.of) PRIMAL[q].death(e, x, y, dmg);
  ring(x, y - 4, 16, E.glow, 0.35, 1);
});

/* ---------- light, and a mark over its health ---------- */
const _lightsElem = lightSources;
lightSources = function (vis) {
  const L = _lightsElem(vis), cam = { x: G.cam.x - R.VW / 2, y: G.cam.y - R.VH / 2 };
  for (const e of G.ents) {
    if (!e.elem || e.dead || !ELEM[e.elem] || e.elem === 'shadow') continue;
    if (e.x < cam.x - 60 || e.x > cam.x + R.VW + 60 || e.y < cam.y - 60 || e.y > cam.y + R.VH + 60) continue;
    L.push({ x: e.x, y: e.y - 6, r: ELEM[e.elem].of.includes('earth') ? 16 : 28, c: ELEM[e.elem].glow, a: 0.25 });
  }
  return L;
};
// a cross over its health in its colour; a fused element's arms are its two primals'
hook('entOverlay', (g, e, x, y) => {
  if (!e.elem || e.dead || !ELEM[e.elem]) return;
  const E = ELEM[e.elem], top = Math.round(y - e.h * (e.scale || 1) - 6), w = e.eliteMods ? 20 : 14, px = Math.round(x - w / 2) - 5;
  g.fillStyle = '#0a0608'; g.fillRect(px - 1, top - 1, 5, 4);
  g.fillStyle = PRIMAL[E.of[0]].glow; g.fillRect(px, top, 3, 2);
  g.fillStyle = (E.of[1] ? PRIMAL[E.of[1]] : E).glow; g.fillRect(px + 1, top - 1, 1, 4);
});

