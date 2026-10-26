/* ============================================================
   Cinderdeep — renderer: a low-res pixel canvas, cached rooms,
   y-sorted sprites, darkness with light holes, glow on top
   ============================================================ */
const R = {
  screen: null, sg: null, low: null, g: null, light: null, lg: null, VW: 400, VH: 240, scale: 3, dpr: 1, cssW: 0, cssH: 0,
  roomCache: new Map(), camX: 0, camY: 0,
};
function initRender() {
  R.screen = $('screen'); R.sg = R.screen.getContext('2d');
  R.low = mkCanvas(400, 240); R.g = R.low.getContext('2d');
  R.light = mkCanvas(400, 240); R.lg = R.light.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}
function resize() {
  const cssW = Math.max(1, R.screen.clientWidth || window.innerWidth), cssH = Math.max(1, R.screen.clientHeight || window.innerHeight);
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const zoom = (CD.settings && CD.settings.zoom) || 1;
  const fit = Math.min(cssW / 300, cssH / 222) * zoom;
  let dev = fit * dpr;
  dev = dev >= 2 ? Math.floor(dev) : Math.max(0.5, dev);
  R.cssW = cssW; R.cssH = cssH; R.dpr = dpr; R.scale = dev;
  R.screen.width = Math.round(cssW * dpr); R.screen.height = Math.round(cssH * dpr);
  R.VW = Math.ceil(R.screen.width / dev); R.VH = Math.ceil(R.screen.height / dev);
  R.low.width = R.VW; R.low.height = R.VH; R.light.width = R.VW; R.light.height = R.VH;
  R.g.imageSmoothingEnabled = false; R.sg.imageSmoothingEnabled = false;
}
function screenToWorld(mx, my) {
  return { x: (mx * R.dpr) / R.scale + R.camX - R.VW / 2, y: (my * R.dpr) / R.scale + R.camY - R.VH / 2 };
}

/* ---------- camera ---------- */
function camTarget() {
  const p = G.p, r = G.room;
  let tx = p.x, ty = p.y - 10;
  if (Input.act.aimMode === 'mouse' && !p.dead) { const w = screenToWorld(Input.mouse.x, Input.mouse.y); tx += clamp((w.x - p.x) * 0.18, -26, 26); ty += clamp((w.y - p.y) * 0.18, -18, 18); }
  const b = G.boss;
  if (b && !b.dead && !b.hidden && b.spawnT <= 0.8) {
    // frame the fight: lean toward the boss but keep the hero well inside the view
    tx = lerp(p.x, b.x, 0.42); ty = lerp(p.y - 10, b.y - 16, 0.42);
    tx = clamp(tx, p.x - R.VW / 2 + 48, p.x + R.VW / 2 - 48); ty = clamp(ty, p.y - R.VH / 2 + 40, p.y + R.VH / 2 - 56);
  }
  if (r) {
    const x0 = r.x * TS, x1 = (r.x + r.w) * TS, y0 = r.y * TS - 6, y1 = (r.y + r.h) * TS + 4;
    const hudTop = 18; // keep a little room for the HUD
    if (x1 - x0 <= R.VW) tx = (x0 + x1) / 2; else tx = clamp(tx, x0 + R.VW / 2, x1 - R.VW / 2);
    // tall phone screens: lift the room above the thumbs
    const lift = Input.device === 'touch' && R.VH > R.VW * 1.3 ? R.VH * 0.08 : 0;
    if (y1 - y0 + hudTop <= R.VH) ty = (y0 + y1) / 2 - hudTop / 2 + lift; else ty = clamp(ty + lift, y0 + R.VH / 2 - hudTop, y1 - R.VH / 2 + lift);
  }
  return { x: tx, y: ty };
}
function snapCamera() { const t = camTarget(); G.cam.x = t.x; G.cam.y = t.y; }
function updateCamera(dt) {
  const t = camTarget(), k = 1 - Math.exp(-9 * dt);
  G.cam.x = lerp(G.cam.x, t.x, k); G.cam.y = lerp(G.cam.y, t.y, k);
  G.cam.shake = Math.max(0, G.cam.shake - dt * 30);
  const s = G.cam.shake;
  G.cam.sx = s ? rnd(-s, s) * 0.5 : 0; G.cam.sy = s ? rnd(-s, s) * 0.5 : 0;
}

/* ---------- bitmap font for numbers and short labels ---------- */
const GLYPH = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111',
  7: '111001010010010', 8: '111101111101111', 9: '111101111001111', A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101',
  L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '+': '000010111010000', '-': '000000111000000', '!': '010010010000010', '.': '000000000000010', '/': '001001010100100', ':': '000010000010000', ' ': '000000000000000',
};
const textCache = new Map();
function pixelText(str, color = '#ffffff', scale = 1) {
  const key = str + color + scale;
  let c = textCache.get(key);
  if (c) return c;
  str = String(str).toUpperCase();
  const w = str.length * 4 + 1, p = new PP(w + 2, 7);
  [...str].forEach((ch, i) => {
    const g = GLYPH[ch] || GLYPH[' '];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (g[y * 3 + x] === '1') p.px(1 + i * 4 + x, 1 + y, color);
  });
  p.outline('#0a0608', true);
  c = p.canvas();
  if (scale > 1) { const c2 = mkCanvas(c.width * scale, c.height * scale), g2 = c2.getContext('2d'); g2.imageSmoothingEnabled = false; g2.drawImage(c, 0, 0, c2.width, c2.height); c = c2; }
  if (textCache.size > 400) textCache.clear();
  textCache.set(key, c);
  return c;
}

/* ---------- cached room art ---------- */
function invalidateRoomCache() { R.roomCache.clear(); }
function roomCanvas(r) {
  let c = R.roomCache.get(r.id);
  if (c) return c;
  const fl = G.fl, T = getTileset(fl.actIdx), W = fl.W;
  c = mkCanvas(r.w * TS, r.h * TS);
  const g = c.getContext('2d');
  const tile = (x, y) => tileAt(fl, x, y);
  const isFloorish = (t) => t === TILE.FLOOR || t === TILE.ICE || t === TILE.TOXIC || t === TILE.LAVA || t === TILE.SPIKE || t === TILE.PIT || t === TILE.DOOR || t === TILE.ROCK;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    const t = tile(x, y), v = fl.vari[y * W + x], px = (x - r.x) * TS, py = (y - r.y) * TS;
    if (t === TILE.WALL) {
      g.drawImage(T.top, px, py);
      // a lit rim where the wall meets the room
      g.fillStyle = shade(T.pal.wall, 0.12);
      if (isFloorish(tile(x + 1, y)) || tile(x + 1, y) === TILE.FACE) g.fillRect(px + TS - 2, py, 2, TS);
      if (isFloorish(tile(x - 1, y)) || tile(x - 1, y) === TILE.FACE) g.fillRect(px, py, 2, TS);
      if (isFloorish(tile(x, y - 1))) g.fillRect(px, py, TS, 2);
      if (tile(x, y + 1) === TILE.FACE) { g.fillStyle = shade(T.pal.wall, 0.25); g.fillRect(px, py + TS - 2, TS, 2); }
    } else if (t === TILE.FACE) {
      g.drawImage(T.face[v % 7 === 0 ? 3 : v % 5 === 0 ? 2 : v % 3 === 0 ? 1 : 0], px, py);
    } else {
      const fv = v < 150 ? 0 : v < 200 ? 1 : v < 235 ? 2 : 3;
      g.drawImage(T.floor[fv], px, py);
      if (t === TILE.FLOOR && v % 17 === 3) g.drawImage(T.decals[(v >> 3) % T.decals.length], px, py);
      if (t === TILE.ICE) g.drawImage(T.ice, px, py);
      if (t === TILE.PIT) {
        g.drawImage(T.pit, px, py);
        if (tile(x, y - 1) !== TILE.PIT) { g.fillStyle = shade(T.pal.floor, -0.45); g.fillRect(px, py, TS, 5); g.fillStyle = shade(T.pal.floor, -0.6); g.fillRect(px, py + 5, TS, 2); }
      }
      if (t === TILE.ROCK) drawRockTile(g, px, py, fl.actIdx, v);
      if (t === TILE.SPIKE) { g.fillStyle = shade(T.pal.floor, -0.25); g.fillRect(px + 1, py + 1, TS - 2, TS - 2); }
      // ambient occlusion along walls
      g.fillStyle = 'rgba(0,0,0,0.28)';
      if (tile(x, y - 1) === TILE.FACE) { g.fillRect(px, py, TS, 3); g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(px, py + 3, TS, 3); g.fillStyle = 'rgba(0,0,0,0.28)'; }
      if (tile(x - 1, y) === TILE.WALL) g.fillRect(px, py, 2, TS);
      if (tile(x + 1, y) === TILE.WALL) g.fillRect(px + TS - 2, py, 2, TS);
      if (t !== TILE.PIT && tile(x, y + 1) === TILE.WALL) g.fillRect(px, py + TS - 1, TS, 1);
    }
  }
  R.roomCache.set(r.id, c);
  return c;
}
function drawRockTile(g, px, py, act, v) {
  const sp = propSprite('rock', act, v % 3);
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(px + 8, py + 13, 7, 2.5, 0, 0, TAU); g.fill();
  g.drawImage(sp.c, px + 8 - sp.ax, py + 14 - sp.ay);
}

/* ---------- frame ---------- */
function render() {
  const g = R.g, fl = G.fl, VW = R.VW, VH = R.VH;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#050305'; g.fillRect(0, 0, VW, VH);
  if (!fl || !fl.rooms || !G.p) { blit(); return; }
  const cx = Math.round(G.cam.x + G.cam.sx - VW / 2), cy = Math.round(G.cam.y + G.cam.sy - VH / 2);
  R.camX = G.cam.x; R.camY = G.cam.y;
  R.ox = cx; R.oy = cy;
  const T = getTileset(fl.actIdx);
  // rooms in view
  const vis = [];
  for (const r of fl.rooms) {
    const x0 = r.x * TS, y0 = r.y * TS, x1 = x0 + r.w * TS, y1 = y0 + r.h * TS;
    if (x1 < cx || y1 < cy || x0 > cx + VW || y0 > cy + VH) continue;
    if (!r.seen && r !== G.room) continue;
    vis.push(r);
    g.drawImage(roomCanvas(r), x0 - cx, y0 - cy);
    if (r !== G.room) { g.fillStyle = 'rgba(5,3,5,0.55)'; g.fillRect(x0 - cx, y0 - cy, r.w * TS, r.h * TS); }
  }
  // animated hazards
  const tx0 = Math.max(0, Math.floor(cx / TS)), ty0 = Math.max(0, Math.floor(cy / TS)), tx1 = Math.min(fl.W - 1, Math.ceil((cx + VW) / TS)), ty1 = Math.min(fl.H - 1, Math.ceil((cy + VH) / TS));
  const fr = Math.floor(G.t * 3) % 4;
  R.lavaLights = [];
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
    const t = fl.tiles[y * fl.W + x];
    if (t === TILE.LAVA) { g.drawImage(T.lava[(fr + x + y) % 4], x * TS - cx, y * TS - cy); if ((x + y) % 2 === 0) R.lavaLights.push([x * TS + 8, y * TS + 8]); }
    else if (t === TILE.TOXIC) g.drawImage(T.toxic[(fr + x * 3 + y) % 4], x * TS - cx, y * TS - cy);
  }
  drawDoors(g, cx, cy);
  // floor-level props and effects
  const room = G.room;
  const props = [];
  for (const r of vis) for (const pid of r.props) props.push(fl.props[pid]);
  for (const pr of props) if (pr.decal || pr.kind === 'stairs' || pr.kind === 'spikes') drawFlatProp(g, pr, cx, cy);
  runHooks('renderFloor', g, cx, cy, vis);
  for (const f of G.fx) if (GROUND_FX[f.kind]) GROUND_FX[f.kind](g, f, cx, cy);
  // y-sorted world
  const list = [];
  for (const pr of props) if (!pr.decal && pr.kind !== 'stairs' && pr.kind !== 'spikes' && !pr.broken) list.push({ y: pr.y, d: () => drawProp(g, pr, cx, cy) });
  for (const e of G.ents) if (e.room === (room ? room.id : -1) || e.boss) list.push({ y: e.y, d: () => drawEnt(g, e, cx, cy) });
  for (const it of G.items) list.push({ y: it.y + 4, d: () => drawItem(g, it, cx, cy) });
  for (const k of G.picks) list.push({ y: k.y, d: () => drawPick(g, k, cx, cy) });
  for (const f of G.fx) if (f.kind === 'corpse' && f.sp) list.push({ y: f.y - 1, d: () => drawCorpse(g, f, cx, cy) });
  list.push({ y: G.p.y, d: () => drawPlayer(g, G.p, cx, cy) });
  // shadows first
  for (const e of G.ents) if ((e.room === (room ? room.id : -1)) && !e.hidden) shadow(g, e.x - cx, e.y - cy, e.r * (e.scale || 1) * (e.boss ? 1.4 : 1.1), e.z || 0);
  shadow(g, G.p.x - cx, G.p.y - cy, 6, G.p.z || 0);
  list.sort((a, b) => a.y - b.y);
  for (const o of list) o.d();
  // missiles, particles, effects
  for (const pr of G.projs) if (pr.team === 'p') drawProj(g, pr, cx, cy);
  drawParticles(g, cx, cy, false);
  runHooks('renderWorld', g, cx, cy);
  // darkness
  drawLighting(g, cx, cy, vis);
  for (const f of G.fx) if (TOP_FX[f.kind]) TOP_FX[f.kind](g, f, cx, cy);
  // readable on top of the dark: enemy missiles, warnings, glows, numbers
  for (const f of G.fx) if (f.kind === 'tele') drawTele(g, f, cx, cy);
  for (const pr of G.projs) if (pr.team === 'e') drawProj(g, pr, cx, cy);
  drawGlow(g, cx, cy);
  drawParticles(g, cx, cy, true);
  for (const e of G.ents) if (e.room === (room ? room.id : -1) && !e.dead) drawEntOverlay(g, e, cx, cy);
  runHooks('renderTop', g, cx, cy);
  for (const t of G.texts) {
    const c = pixelText(t.str, t.color, t.big ? 2 : 1);
    g.globalAlpha = clamp(t.life / (t.max * 0.4), 0, 1);
    const age = t.max - t.life, pop = age < 0.12 ? 1 + (1 - age / 0.12) * (t.big ? 0.7 : 0.45) : 1;
    const w2 = Math.round(c.width * pop), h2 = Math.round(c.height * pop);
    g.drawImage(c, Math.round(t.x - cx - w2 / 2), Math.round(t.y - cy - h2 / 2), w2, h2);
  }
  g.globalAlpha = 1;
  // screen tints
  if (G.hurtFlash > 0) { const a = G.hurtFlash; const grd = g.createRadialGradient(VW / 2, VH / 2, VH * 0.2, VW / 2, VH / 2, VH * 0.8); grd.addColorStop(0, 'rgba(180,20,30,0)'); grd.addColorStop(1, `rgba(180,20,30,${(a * 0.9).toFixed(3)})`); g.fillStyle = grd; g.fillRect(0, 0, VW, VH); }
  if (G.p.hp > 0 && G.p.hp / G.p.maxHp < 0.25) { const a = 0.18 + Math.sin(G.t * 6) * 0.08; const grd = g.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.85); grd.addColorStop(0, 'rgba(120,0,10,0)'); grd.addColorStop(1, `rgba(120,0,10,${a.toFixed(3)})`); g.fillStyle = grd; g.fillRect(0, 0, VW, VH); }
  if (G.warp > 0) { g.fillStyle = 'rgba(255,220,120,0.08)'; g.fillRect(0, 0, VW, VH); }
  blit();
}
function blit() {
  const sg = R.sg;
  sg.setTransform(1, 0, 0, 1, 0, 0);
  sg.imageSmoothingEnabled = false;
  sg.drawImage(R.low, 0, 0, R.VW, R.VH, 0, 0, R.VW * R.scale, R.VH * R.scale);
}
function shadow(g, x, y, r, z = 0) {
  g.fillStyle = `rgba(0,0,0,${(0.35 - Math.min(0.2, z * 0.006)).toFixed(3)})`;
  g.beginPath(); g.ellipse(Math.round(x), Math.round(y), Math.max(2, r - z * 0.08), Math.max(1, r * 0.42 - z * 0.03), 0, 0, TAU); g.fill();
}
function drawSprite(g, sp, x, y, flip, o = {}) {
  if (!sp) return;
  // a sheet with its own left-facing row is never mirrored
  if (sp.noFlip) flip = false;
  const sc = o.scale || 1, w = sp.w * sc, hh = sp.h * sc;
  const dx = Math.round(x - sp.ax * sc), dy = Math.round(y - sp.ay * sc);
  g.save();
  if (o.alpha != null) g.globalAlpha = o.alpha;
  if (flip) { g.translate(Math.round(x) * 2, 0); g.scale(-1, 1); }
  if (o.outline) {
    const sil = tintOf(sp, o.outline, 'ol' + o.outline);
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(sil, dx + ox, dy + oy, w, hh);
  }
  g.drawImage(o.white ? whiteOf(sp) : sp.c, dx, dy, w, hh);
  if (o.tint) { g.globalAlpha = (o.alpha ?? 1) * (o.tintA ?? 0.45); g.drawImage(tintOf(sp, o.tint, 't' + o.tint), dx, dy, w, hh); }
  g.restore();
}

/* ---------- doors ---------- */
function drawDoorShut(g, d, px, py) {
  if (d.kind === 'boss') { g.fillStyle = '#3a1a1a'; g.fillRect(px, py, TS, TS); g.fillStyle = '#6a2a24'; for (let k = 2; k < TS; k += 4) g.fillRect(px + (d.dir === 'v' ? k : 0), py + (d.dir === 'v' ? 0 : k), d.dir === 'v' ? 2 : TS, d.dir === 'v' ? TS : 2); return; }
  g.fillStyle = '#5a3a20'; g.fillRect(px, py, TS, TS); g.fillStyle = '#7a5230'; for (let k = 1; k < TS; k += 5) g.fillRect(px + (d.dir === 'v' ? 0 : k), py + (d.dir === 'v' ? k : 0), d.dir === 'v' ? TS : 3, d.dir === 'v' ? 3 : TS); g.fillStyle = '#3a3a42'; g.fillRect(px + (d.dir === 'v' ? 0 : 6), py + (d.dir === 'v' ? 6 : 0), d.dir === 'v' ? TS : 4, d.dir === 'v' ? 4 : TS);
}
function drawDoors(g, cx, cy) {
  const fl = G.fl, pal = getTileset(fl.actIdx).pal;
  for (const d of fl.doors) {
    const ra = fl.rooms[d.a], rb = fl.rooms[d.b];
    if (!ra.seen && !rb.seen) continue;
    if (d.hidden) { drawHiddenDoor(g, d, cx, cy); continue; }
    const open = d.open && !d.locked;
    // a door swings on the hinge at its first tile; while it swings, the part of it still across the gap is drawn shut
    if (d._open !== open) { if (d._open != null && crigOn()) d.swingAt = G.t; d._open = open; }
    const swing = d.swingAt != null ? clamp((G.t - d.swingAt) / 0.22, 0, 1) : 1;
    for (const [x, y] of d.tiles) {
      const px = x * TS - cx, py = y * TS - cy;
      if (px < -TS || py < -TS || px > R.VW || py > R.VH) continue;
      const t = getTileset(fl.actIdx);
      g.drawImage(t.floor[0], px, py);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px, py, TS, TS);
      if (!open && swing >= 1) drawDoorShut(g, d, px, py);
    }
    if (swing < 1) {
      const [fx, fy] = d.tiles[0], L = d.tiles.length * TS * (open ? 1 - swing : swing);
      g.save(); g.beginPath();
      if (d.dir === 'v') g.rect(fx * TS - cx, fy * TS - cy, TS, L); else g.rect(fx * TS - cx, fy * TS - cy, L, TS);
      g.clip();
      for (const [x, y] of d.tiles) drawDoorShut(g, d, x * TS - cx, y * TS - cy);
      g.restore();
    }
    // frame posts
    const [fx, fy] = d.tiles[0], [lx, ly] = d.tiles[d.tiles.length - 1];
    g.fillStyle = shade(pal.wall, 0.2);
    if (d.dir === 'v') { g.fillRect(fx * TS - cx - 2, fy * TS - cy, 2, (ly - fy + 1) * TS); g.fillRect(fx * TS - cx + TS, fy * TS - cy, 2, (ly - fy + 1) * TS); }
    else { g.fillRect(fx * TS - cx, fy * TS - cy - 2, (lx - fx + 1) * TS, 2); g.fillRect(fx * TS - cx, fy * TS - cy + TS, (lx - fx + 1) * TS, 2); }
    if (d.locked) {
      const mx = d.px - cx, my = d.py - cy;
      g.fillStyle = '#ffd35c'; g.fillRect(Math.round(mx) - 3, Math.round(my) - 2, 6, 5); g.fillStyle = '#c8901c'; g.fillRect(Math.round(mx) - 2, Math.round(my) - 5, 4, 3); g.fillStyle = '#1a1214'; g.fillRect(Math.round(mx), Math.round(my), 1, 2);
    }
    if (d.kind === 'boss' && open) { const sk = miscIcon('skull'); g.drawImage(sk.c, Math.round(d.px - cx - 8), Math.round(d.py - cy - 8)); }
  }
}

/* ---------- props ---------- */
function drawFlatProp(g, pr, cx, cy) {
  const x = pr.x - cx, y = pr.y - cy;
  if (pr.kind === 'spikes') {
    pr.up = ((G.t + pr.phase * 1.2) % 2.4) < 0.9;
    const sp = propSprite('spikes', G.fl.actIdx, pr.up ? 1 : 0);
    g.drawImage(sp.c, Math.round(x - 8), Math.round(y - 8));
    return;
  }
  if (pr.kind === 'stairs') {
    const sp = propSprite('stairs', G.fl.actIdx);
    if (pr.active) { g.drawImage(sp.c, Math.round(x - sp.ax), Math.round(y - sp.ay + 10)); if (Math.sin(G.t * 4) > 0) { g.fillStyle = 'rgba(255,180,90,0.14)'; g.fillRect(Math.round(x - 14), Math.round(y - 10), 28, 20); } }
    else { g.fillStyle = '#3a3036'; g.fillRect(Math.round(x - 14), Math.round(y - 10), 28, 20); g.fillStyle = '#5a5058'; for (let k = 0; k < 28; k += 5) g.fillRect(Math.round(x - 14 + k), Math.round(y - 10), 2, 20); }
    return;
  }
  const sp = propSprite(pr.kind, G.fl.actIdx, pr.v || 0);
  g.drawImage(sp.c, Math.round(x - sp.ax), Math.round(y - sp.ay));
}
function drawProp(g, pr, cx, cy) {
  const x = pr.x - cx, y = pr.y - cy;
  if (x < -40 || y < -50 || x > R.VW + 40 || y > R.VH + 50) return;
  let sp;
  if (pr.kind === 'chest') {
    sp = chestSprite(pr.chest, pr.opened);
    const st = chestSwing(pr, pr.opened);
    if (st && st < 3) sp = chestLidSprite(pr.chest, st);
    shadow(g, x, y, 8);
    const pop = pr.appear != null && pr.appear < 1 ? (pr.appear += 0.05, 1 - pr.appear) * -10 : 0;
    drawSprite(g, sp, x + (pr.mimic && Math.sin(G.t * 9 + pr.x) > 0.96 ? 1 : 0), y + pop, false);
    if (!pr.opened && Math.sin(G.t * 3 + pr.x) > 0.85) { g.fillStyle = '#ffffff'; g.fillRect(Math.round(x + rnd(-6, 6)), Math.round(y - rnd(4, 12)), 1, 1); }
    return;
  }
  if (pr.npc) {
    // the merchant and the forge-keeper turn to watch you, on the heroes' skeleton
    sp = npcSprite(pr.npc, 0);
    if (CD.settings.turn8 !== false) { pr.turn = pickTurn(pr.turn, G.p.x - pr.x, G.p.y - pr.y); pr.face = G.p.x < pr.x ? -1 : 1; pr.view = pr.turn >= 3 ? 'back' : 'front'; sp = rigHeroFrame(heroSprites(npcLookOf(pr.npc), 'dnpc:' + pr.npc), pr, 0, true); }
    shadow(g, x, y, 6); drawSprite(g, sp, x, y + (Math.sin(G.t * 2) > 0.9 ? -1 : 0), G.p.x < pr.x); return;
  }
  if (pr.kind === 'altar' && pr.relicChoice) { sp = propSprite('altar', G.fl.actIdx); drawSprite(g, sp, x, y, false); if (!pr.used) { const ic = relicIcon('phoenix'); g.globalAlpha = 0.6 + Math.sin(G.t * 3) * 0.3; g.drawImage(miscIcon('rune').c, Math.round(x - 8), Math.round(y - 30 + Math.sin(G.t * 2) * 2)); g.globalAlpha = 1; } return; }
  sp = propSprite(pr.kind, G.fl.actIdx, pr.v || 0);
  if (crigOn() && pr.kind === 'banner') sp = waveFrames(sp, `banner:${G.fl.actIdx}`)[Math.floor(G.t * 5 + pr.x * 0.1) % 4];
  else if (crigOn() && pr.kind === 'mushroom') sp = bendFrames(sp, `mush:${G.fl.actIdx}:${pr.v || 0}`)[clamp(Math.round(windAt(pr.x, pr.y) * 0.6), -SWAY_N, SWAY_N) + SWAY_N];
  if (pr.kind === 'pedestal' || pr.kind === 'altar' || pr.kind === 'anvil' || pr.kind === 'fountain' || pr.kind === 'shrine' || pr.kind === 'statue' || pr.kind === 'table' || pr.kind === 'brazier') shadow(g, x, y, (pr.r || 6) + 1);
  const dim = (pr.shrine || pr.fountain) && pr.used;
  drawSprite(g, sp, x, y, false, { alpha: dim ? 0.7 : 1 });
  if (pr.fountain && !pr.used) { g.fillStyle = 'rgba(200,240,255,0.7)'; const k = (G.t * 6) % 6; g.fillRect(Math.round(x - 1), Math.round(y - 17 + k), 2, 2); }
  if (pr.kind === 'brazier' || pr.kind === 'candles') drawFlame(g, x, y - (pr.kind === 'brazier' ? 9 : 7), pr.kind === 'brazier' ? 1.4 : 0.7, pr.x);
}
function drawFlame(g, x, y, s = 1, seed = 0) {
  const t = G.t * 10 + seed;
  const cols = ['#fff3c0', '#ffd08a', '#ff9a3c', '#e8521c'];
  for (let i = 0; i < 4; i++) {
    const w = Math.max(1, Math.round((4 - i) * s)), hh = Math.max(1, Math.round((5 - i) * s + Math.sin(t + i) * s));
    g.fillStyle = cols[3 - i];
    g.fillRect(Math.round(x - w / 2 + Math.sin(t * 0.7 + i) * 0.6), Math.round(y - hh + i * 0.5), w, hh);
  }
}

/* ---------- items and pickups ---------- */
function itemIcon(it) {
  if (it.type === 'weapon') return weaponIcon(it.w.id);
  if (it.type === 'ability') return abilityIcon(it.id);
  if (it.type === 'relic') return relicIcon(it.id);
  if (it.type === 'tome') return miscIcon('rune');
  if (it.type === 'heart') return miscIcon('heart');
  return miscIcon(it.type === 'key' ? 'key' : 'potion');
}
function drawItem(g, it, cx, cy) {
  it.t += 1 / 60;
  const x = it.x - cx, y = it.y - cy - 6 + Math.sin(G.t * 2.4 + it.x) * 2;
  const col = itemColor(it);
  g.fillStyle = rgbaStr(col, 0.18); g.beginPath(); g.ellipse(Math.round(x), Math.round(it.y - cy + 4), 9, 3, 0, 0, TAU); g.fill();
  const ic = itemIcon(it);
  if (it.type === 'weapon' && it.w.rar !== 'common') { const sil = tintOf(ic, col, 'ol' + col); for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(sil, Math.round(x - 8 + ox), Math.round(y - 8 + oy)); }
  g.drawImage(ic.c, Math.round(x - 8), Math.round(y - 8));
  if (it.shop) { const tc = pixelText(it.price + 'G', G.p.gold >= it.price ? '#ffd35c' : '#a87a6a'); g.drawImage(tc, Math.round(x - tc.width / 2), Math.round(it.y - cy + 10)); }
}
function drawPick(g, k, cx, cy) {
  const sp = pickupSprite(k.kind === 'gold' && k.value >= 5 ? 'gold5' : k.kind);
  const x = k.x - cx, y = k.y - cy - k.z;
  shadow(g, x, k.y - cy, 3, k.z);
  const bob = k.z <= 0 ? Math.sin(G.t * 5 + k.x) * 1 : 0;
  g.drawImage(sp.c, Math.round(x - sp.ax), Math.round(y - sp.ay + bob));
}

/* ---------- characters ---------- */
function heroFrame(p) {
  if (p.beast) return beastFrame(p);
  const fi = p.moving && p.dashT <= 0 ? 1 + (Math.floor(p.anim) % 2) : 0;
  if (p.sheet) return sheetFrame(p.sheet, p, fi);
  const set = heroSprites(p.look, p.cls + (p.dyeKey ? ":" + p.dyeKey : ""));
  return rigHeroFrame(set, p, fi);
}
function drawPlayer(g, p, cx, cy) {
  if (p.dead) {
    const sp = heroFrame(p);
    g.save(); g.globalAlpha = 0.7; g.translate(Math.round(p.x - cx), Math.round(p.y - cy)); g.rotate(Math.PI / 2 * p.face); g.drawImage(sp.c, -sp.ax, -sp.ay); g.restore();
    return;
  }
  const blink = p.iframes > 0 && p.dashT <= 0 && p.barrierT <= 0 && Math.floor(G.t * 16) % 2 === 0;
  const sp = heroFrame(p);
  const x = p.x - cx, y = p.y - cy - (p.z || 0) - (p.fly ? 4 + Math.sin(G.t * 3) * 1.5 : 0);
  const flip = p.face < 0;
  const back = p.view === 'back';
  if (back && !p.beast) drawHeld(g, p, x, y);
  if (p.whirlT > 0) { g.globalAlpha = 0.5; g.strokeStyle = '#e8f0ff'; g.lineWidth = 1; g.beginPath(); g.arc(Math.round(x), Math.round(y - 8), 30, G.t * 20, G.t * 20 + 4); g.stroke(); g.globalAlpha = 1; }
  drawSprite(g, sp, x, y, flip, { scale: p.sizeMul || 1, alpha: (blink ? 0.35 : 1) * (p.veilT > 0 ? 0.45 : 1), white: p.hurtT > 0.15, outline: p.shieldHits > 0 ? '#cfe9ff' : p.stoneT > 0 ? '#c8bfa8' : null, tint: p.stoneT > 0 ? '#8a8478' : null, tintA: 0.55 });
  if (!back && !p.beast) drawHeld(g, p, x, y);
  if (p.barrierT > 0) { g.strokeStyle = `rgba(159,224,255,${(0.5 + Math.sin(G.t * 12) * 0.2).toFixed(2)})`; g.lineWidth = 1; g.beginPath(); g.arc(Math.round(x), Math.round(y - 9), 13, 0, TAU); g.stroke(); }
  if (p.stats.orbit) for (let k = 0; k < p.stats.orbit; k++) {
    const a = p.orbitA + (k * TAU) / p.stats.orbit, bx = x + Math.cos(a) * 26, by = y - 6 + Math.sin(a) * 18;
    g.save(); g.translate(Math.round(bx), Math.round(by)); g.rotate(G.t * 14); g.fillStyle = '#dde3ec'; g.fillRect(-4, -1, 8, 2); g.fillStyle = '#ffffff'; g.fillRect(-4, -1, 3, 1); g.restore();
  }
}
function drawEnt(g, e, cx, cy) {
  if (e.dead) return;
  if (e.boss) return drawBoss(g, e, cx, cy);
  const x = e.x - cx, y = e.y - cy - (e.z || 0) - (e.fly ? 6 + Math.sin(G.t * 4 + e.x) * 2 : 0);
  if (x < -40 || y < -40 || x > R.VW + 40 || y > R.VH + 40) return;
  const fi = e.pose === 2 ? 2 : e.pose === 1 ? 1 : Math.floor(e.anim * (e.fly ? 8 : 4)) % 2;
  const sp = crigEntFrame(e) || e.frames[fi] || e.frames[0];
  if (e.spawnT > 0) {
    const k = 1 - e.spawnT / 0.7;
    drawSprite(g, sp, x, y + (1 - k) * 6, e.face < 0, { alpha: k * 0.8, white: true });
    return;
  }
  let alpha = 1;
  if (e.fadeT > 0) alpha = 0.25;
  if (e.def && e.def.ghostly) alpha *= 0.85;
  if (e.type === 'ally' && e.life != null && e.life < 2 && Math.floor(G.t * 10) % 2) alpha *= 0.5;
  const o = { alpha, scale: e.scale || 1, white: e.flash > 0, outline: e.eliteMods ? e.eliteColor : e.type === 'ally' ? '#7dff9a' : null };
  if (e.nem) { o.tint = chaosColor(e); o.tintA = 0.4; o.outline = chaosColor(e, 3); }
  if (e.freezeT > 0) { o.tint = '#bfe9ff'; o.tintA = 0.7; }
  else if (e.chillT > 0) { o.tint = '#8ad8ff'; o.tintA = 0.35; }
  else if (e.poison) { o.tint = '#8fe05c'; o.tintA = 0.25; }
  let face = e.face < 0;
  if (e.def.sprite === 'wolf' || e.def.sprite === 'salamander') face = e.face < 0;
  drawSprite(g, sp, x, y, face, o);
  if (e.freezeT > 0) { g.strokeStyle = 'rgba(230,248,255,0.8)'; g.strokeRect(Math.round(x - sp.w * 0.45), Math.round(y - sp.h * (e.scale || 1)), Math.round(sp.w * 0.9), Math.round(sp.h * (e.scale || 1))); }
  if (e.shieldHp > 0) { g.strokeStyle = 'rgba(207,233,255,0.6)'; g.beginPath(); g.arc(Math.round(x), Math.round(y - e.h / 2), e.r + 6, 0, TAU); g.stroke(); }
  if (e.burn && Math.random() < 0.5) drawFlame(g, x + rnd(-4, 4), y - rnd(2, e.h), 0.5, e.x);
}
function drawEntOverlay(g, e, cx, cy) {
  if (e.spawnT > 0 || e.boss || e.type === 'ally') return;
  const x = e.x - cx, y = e.y - cy - (e.fly ? 8 : 0);
  if (e.hp < e.maxHp && !e.nem) {
    const w = e.eliteMods ? 20 : 14, k = clamp(e.hp / e.maxHp, 0, 1), top = y - e.h * (e.scale || 1) - 6;
    g.fillStyle = 'rgba(10,6,8,0.8)'; g.fillRect(Math.round(x - w / 2) - 1, Math.round(top) - 1, w + 2, 4);
    g.fillStyle = e.eliteMods ? e.eliteColor : '#e2434f'; g.fillRect(Math.round(x - w / 2), Math.round(top), Math.round(w * k), 2);
  }
  if (e.eliteMods) { const t = pixelText(e.eliteMods.map((m) => ELITE_MODS.find((q) => q.id === m).name).join(' '), e.eliteColor); g.drawImage(t, Math.round(x - t.width / 2), Math.round(y - e.h * (e.scale || 1) - 14)); }
  runHooks('entOverlay', g, e, x, y);
  if (e.stunT > 0 && e.freezeT <= 0) for (let k = 0; k < 3; k++) { const a = G.t * 6 + (k * TAU) / 3; g.fillStyle = '#ffe08a'; g.fillRect(Math.round(x + Math.cos(a) * 6), Math.round(y - e.h - 4 + Math.sin(a) * 2), 1, 1); }
  if ((e.st === 'windup' || e.st === 'aim' || e.st === 'crouch' || e.st === 'raise' || e.st === 'swell') && Math.floor(G.t * 12) % 2 === 0) { const t = pixelText('!', '#ff5a5a'); g.drawImage(t, Math.round(x - t.width / 2), Math.round(y - e.h * (e.scale || 1) - 12)); }
}
function drawCorpse(g, f, cx, cy) {
  const k = f.t / f.life;
  if (f.fall) {
    // a rigged body topples over backwards, away from where it was looking, and fades
    const sp = f.sp, a = Math.min(1, k * 2.4), fx = f.face < 0 ? -1 : 1;
    g.save(); g.translate(Math.round(f.x - cx), Math.round(f.y - cy + k * 2)); g.rotate(-fx * a * a * 1.35); g.scale(fx, 1);
    g.globalAlpha = Math.min(1, (1 - k) * 1.6) * 0.85;
    g.drawImage(k < 0.12 ? whiteOf(sp) : sp.c, -sp.ax, -sp.ay);
    g.restore();
    return;
  }
  drawSprite(g, f.sp, f.x - cx, f.y - cy + k * 2, f.face < 0, { alpha: (1 - k) * 0.7, white: k < 0.15, scale: 1 });
}

/* ---------- bosses ---------- */
function drawBoss(g, e, cx, cy) {
  const x = e.x - cx, y = e.y - cy, w = e.flash > 0;
  const intro = e.spawnT > 0 ? 1 - e.spawnT / 1.6 : 1;
  const a = intro;
  if (e.kind === 'colossus') {
    for (const hd of e.hands) { shadow(g, hd.x - cx, hd.y - cy, 11, hd.z || 0); }
    drawSprite(g, bossPart('colossus_body'), x, y + 40, false, { alpha: a, white: w });
    drawSprite(g, bossPart('colossus_skull'), x, y + 6, false, { alpha: a, white: w });
    drawSprite(g, bossPart('colossus_jaw'), x, y + 4 + e.jaw * 6, false, { alpha: a, white: w });
    for (const [i, hd] of e.hands.entries()) drawSprite(g, bossPart('colossus_hand'), hd.x - cx, hd.y - cy - (hd.z || 0), i === 1, { alpha: a });
    if (e.phase >= 2) { g.fillStyle = `rgba(255,90,58,${(0.4 + Math.sin(G.t * 8) * 0.3).toFixed(2)})`; g.fillRect(Math.round(x - 9), Math.round(y - 11), 3, 3); g.fillRect(Math.round(x + 6), Math.round(y - 11), 3, 3); }
  } else if (e.kind === 'sporecap') {
    if (e.hidden) {
      g.fillStyle = '#3a2a1e'; g.beginPath(); g.ellipse(Math.round(x), Math.round(y), 14, 5, 0, 0, TAU); g.fill();
      if (e.mark) { g.fillStyle = '#5a4030'; g.beginPath(); g.ellipse(Math.round(e.mark.x - cx), Math.round(e.mark.y - cy), 10 + Math.sin(G.t * 20) * 2, 4, 0, 0, TAU); g.fill(); }
      return;
    }
    const breathe = Math.sin(G.t * 2.5) * 1.5;
    drawSprite(g, bossPart('sporecap_stem'), x, y, false, { alpha: a, white: w });
    drawSprite(g, bossPart('sporecap_cap'), x, y - 24 + breathe, false, { alpha: a, white: w, scale: 1 });
    if (Math.random() < 0.3) burst(e.x + rnd(-24, 24), e.y - 40, 1, ['#d8ff9a', '#c58cff'], { grav: -30, floor: false, smax: 10, lmax: 1, glow: true });
  } else if (e.kind === 'wyrm') {
    if (e.hidden) { g.fillStyle = 'rgba(200,236,255,0.5)'; for (let k = 0; k < 5; k++) g.fillRect(Math.round(x + rnd(-10, 10)), Math.round(y + rnd(-4, 4)), 2, 1); return; }
    for (let k = e.segs.length - 1; k >= 0; k--) { const s = e.segs[k]; shadow(g, s.x - cx, s.y - cy + 4, 8); drawSprite(g, bossPart(s.tail ? 'wyrm_tail' : 'wyrm_seg'), s.x - cx, s.y - cy - 4, false, { alpha: a, white: w }); }
    shadow(g, x, y + 4, 11);
    drawSprite(g, bossPart('wyrm_head'), x, y - 4, e.face < 0, { alpha: a, white: w });
  } else if (BOSS_DRAW[e.kind]) { BOSS_DRAW[e.kind](g, e, x, y, a, w, cx, cy);
  } else if (e.kind === 'king') {
    const sp = bossPart('king', Math.floor(G.t * 3) % 2 && Math.hypot(e.vx || 0, e.vy || 0) > 5 ? 1 : 0);
    const sa = e.swing > 0 ? e.swordA : Math.atan2(G.p.y - e.y, G.p.x - e.x) * 0.3 + (e.face > 0 ? 0.6 : Math.PI - 0.6);
    if (e.swing > 0) e.swing -= 1 / 60;
    drawSprite(g, sp, x, y, e.face < 0, { alpha: a, white: w, outline: e.phase >= 3 ? '#ff7a2a' : null });
    const sw = bossPart('king_sword');
    g.save(); g.translate(Math.round(x + e.face * 8), Math.round(y - 16)); g.rotate(sa); if (Math.cos(sa) < 0) g.scale(1, -1); g.globalAlpha = a; g.drawImage(sw.c, -sw.ax, -sw.ay); g.restore();
    if (Math.random() < 0.5) burst(e.x + rnd(-5, 5), e.y - 33, 1, ['#ffd08a', '#ff7a2a'], { grav: -40, floor: false, smax: 10, lmax: 0.6, glow: true });
  }
}

/* ---------- missiles ---------- */
function drawProj(g, pr, cx, cy) {
  const x = Math.round(pr.x - cx), y = Math.round(pr.y - cy - (pr.z || 0));
  if (x < -20 || y < -20 || x > R.VW + 20 || y > R.VH + 20) return;
  const a = Math.atan2(pr.vy, pr.vx);
  if (pr.lob) {
    shadow(g, pr.x - cx, pr.y - cy, 3, pr.z);
    const col = pr.color || (pr.kind === 'bomb' ? '#1e1e26' : pr.kind === 'rock' ? '#3a2a26' : pr.kind === 'glob' ? '#8fe05c' : '#ffffff');
    g.fillStyle = OUTLINE; g.fillRect(x - 3, y - 3, 6, 6);
    g.fillStyle = col; g.fillRect(x - 2, y - 2, 4, 4);
    if (pr.kind === 'bomb') { g.fillStyle = Math.floor(G.t * 20) % 2 ? '#ffd08a' : '#ff7a2a'; g.fillRect(x + 1, y - 4, 1, 2); }
    return;
  }
  g.save(); g.translate(x, y);
  if (DRAW_PROJ[pr.kind]) DRAW_PROJ[pr.kind](g, pr, a);
  else switch (pr.kind) {
    case 'arrow': case 'earrow': case 'bolt':
      g.rotate(a);
      g.fillStyle = OUTLINE; g.fillRect(-6, -1.5, 11, 3);
      g.fillStyle = pr.kind === 'bolt' ? '#5e3a1e' : '#c8a070'; g.fillRect(-5, -0.5, 8, 1);
      g.fillStyle = pr.kind === 'earrow' ? '#ff8a8a' : '#e8edf4'; g.fillRect(3, -1, 2, 2);
      g.fillStyle = '#f1e5cd'; g.fillRect(-6, -1, 2, 2);
      break;
    case 'knives': g.rotate(pr.t * 30); g.fillStyle = OUTLINE; g.fillRect(-4, -1.5, 8, 3); g.fillStyle = '#dde3ec'; g.fillRect(-3, -0.5, 6, 1); break;
    case 'boomerang': g.rotate(pr.t * 22); g.fillStyle = OUTLINE; g.fillRect(-5, -2, 10, 4); g.fillRect(-2, -5, 4, 10); g.fillStyle = '#9a6436'; g.fillRect(-4, -1, 8, 2); g.fillRect(-1, -4, 2, 8); break;
    case 'wave': g.rotate(a); g.strokeStyle = 'rgba(232,240,255,0.85)'; g.lineWidth = 2; g.beginPath(); g.arc(-6, 0, 8, -1, 1); g.stroke(); break;
    case 'bone': g.rotate(pr.t * 12); g.fillStyle = OUTLINE; g.fillRect(-4, -2, 8, 4); g.fillStyle = '#e8e0cc'; g.fillRect(-3, -1, 6, 2); g.fillRect(-4, -2, 2, 1); g.fillRect(2, 1, 2, 1); break;
    case 'thorn': g.rotate(a); g.fillStyle = OUTLINE; g.fillRect(-4, -2, 8, 4); g.fillStyle = '#a8e070'; g.fillRect(-3, -1, 5, 2); g.fillStyle = '#e8ffd0'; g.fillRect(2, -0.5, 2, 1); break;
    case 'web': g.fillStyle = 'rgba(232,232,240,0.9)'; g.fillRect(-3, -3, 6, 6); g.fillStyle = '#9a9aa8'; g.fillRect(-1, -3, 1, 6); g.fillRect(-3, -1, 6, 1); break;
    case 'shard': case 'eshard': case 'eice':
      g.rotate(a); g.fillStyle = OUTLINE; g.fillRect(-4, -2, 8, 4); g.fillStyle = pr.kind === 'eice' ? '#9fe0ff' : '#cfefff'; g.fillRect(-3, -1, 6, 2); g.fillStyle = '#ffffff'; g.fillRect(1, -1, 2, 1); break;
    case 'flame': {
      const k = pr.t / pr.life, r2 = 2 + k * 5;
      g.fillStyle = k < 0.3 ? '#fff3c0' : k < 0.6 ? '#ffb35e' : 'rgba(232,82,28,0.7)';
      g.fillRect(-r2 / 2, -r2 / 2, r2, r2);
      break;
    }
    default: {
      // orbs, fireballs, missiles, venom
      const col = pr.color || '#ffffff', big = pr.kind === 'bigfire' || pr.kind === 'bigorb' ? 2 : 0;
      const r2 = (pr.r || 3) + big * 0.5;
      g.fillStyle = OUTLINE; g.beginPath(); g.arc(0, 0, r2 + 1, 0, TAU); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(0, 0, r2, 0, TAU); g.fill();
      g.fillStyle = pr.kind === 'eorb' || pr.kind === 'bigorb' ? '#2a0a20' : '#ffffff';
      g.fillRect(-1, -1, 2, 2);
      if (Math.random() < 0.5 && !CD.settings.lowFx) G.parts.push({ x: pr.x, y: pr.y, z: pr.z || 0, vx: rnd(-10, 10), vy: rnd(-10, 10), vz: 0, grav: 0, drag: 3, life: 0.25, max: 0.25, color: col, size: 1, glow: true, floor: false });
    }
  }
  g.restore();
}

/* ---------- effects ---------- */
const GROUND_FX = {
  summon(g, f, cx, cy) {
    const k = f.t / f.life, x = Math.round(f.x - cx), y = Math.round(f.y - cy);
    g.strokeStyle = rgbaStr(f.color, 0.8 * (1 - k * 0.5)); g.lineWidth = 1;
    g.beginPath(); g.ellipse(x, y, f.r * (0.5 + k * 0.5), f.r * 0.4 * (0.5 + k * 0.5), 0, 0, TAU); g.stroke();
    for (let i = 0; i < 6; i++) { const a = G.t * 3 + (i * TAU) / 6; g.fillStyle = f.color; g.fillRect(Math.round(x + Math.cos(a) * f.r * 0.8), Math.round(y + Math.sin(a) * f.r * 0.32), 1, 1); }
  },
  crack(g, f, cx, cy) {
    const k = f.t / f.life, x = f.x - cx, y = f.y - cy;
    g.strokeStyle = `rgba(10,6,8,${(0.7 * (1 - k)).toFixed(3)})`; g.lineWidth = 1;
    for (let i = 0; i < 7; i++) { const a = (i * TAU) / 7 + f.x; g.beginPath(); g.moveTo(Math.round(x), Math.round(y)); g.lineTo(Math.round(x + Math.cos(a) * f.r * 0.6), Math.round(y + Math.sin(a) * f.r * 0.3)); g.lineTo(Math.round(x + Math.cos(a + 0.3) * f.r), Math.round(y + Math.sin(a + 0.3) * f.r * 0.45)); g.stroke(); }
  },
  pool(g, f, cx, cy) {
    const k = f.t / f.life, a = Math.min(1, (1 - k) * 3) * 0.55, x = f.x - cx, y = f.y - cy;
    g.fillStyle = rgbaStr(f.color || '#8fe05c', a); g.beginPath(); g.ellipse(Math.round(x), Math.round(y), f.r, f.r * 0.5, 0, 0, TAU); g.fill();
    if (Math.random() < 0.3) { g.fillStyle = '#e8ffd0'; g.fillRect(Math.round(x + rnd(-f.r * 0.7, f.r * 0.7)), Math.round(y + rnd(-f.r * 0.3, f.r * 0.3)), 1, 1); }
  },
  firefield(g, f, cx, cy) {
    const k = f.t / f.life, x = f.x - cx, y = f.y - cy;
    g.fillStyle = `rgba(255,110,40,${(0.25 * (1 - k)).toFixed(3)})`; g.beginPath(); g.ellipse(Math.round(x), Math.round(y), f.r, f.r * 0.5, 0, 0, TAU); g.fill();
    const n = f.small ? 1 : 3;
    for (let i = 0; i < n; i++) if (Math.random() < 0.7 * (1 - k)) drawFlame(g, x + rnd(-f.r * 0.7, f.r * 0.7), y + rnd(-f.r * 0.3, f.r * 0.3), 0.6, i + f.x);
  },
  thorns(g, f, cx, cy) {
    const k = f.t / f.life, x = f.x - cx, y = f.y - cy;
    g.fillStyle = `rgba(90,150,60,${(0.8 * (1 - k)).toFixed(3)})`;
    for (let i = 0; i < 5; i++) g.fillRect(Math.round(x + Math.cos(i * 2.4 + f.x) * 6), Math.round(y + Math.sin(i * 1.7 + f.y) * 3), 2, 1);
  },
};
const TOP_FX = {
  slash(g, f, cx, cy) {
    const p = G.p, k = f.t / f.life;
    const x = (f.follow && !f.enemy ? p.x : f.x) - cx, y = (f.follow && !f.enemy ? p.y - 8 : f.y) - cy;
    const sweep = Math.min(1, k * 1.8), a0 = f.ang - (f.arc / 2) * f.dir, a1 = a0 + f.arc * f.dir * sweep;
    const rr = f.reach;
    g.save(); g.translate(Math.round(x), Math.round(y));
    const alpha = (1 - k) * (f.heavy ? 0.95 : 0.8);
    g.strokeStyle = rgbaStr(f.color || '#ffffff', alpha);
    for (let w = 0; w < (f.heavy ? 4 : 3); w++) {
      g.lineWidth = 1;
      g.beginPath();
      const r2 = rr - w * 1.5;
      if (f.dir > 0) g.arc(0, 0, r2, a0 + (a1 - a0) * (w * 0.12), a1); else g.arc(0, 0, r2, a1, a0 + (a1 - a0) * (w * 0.12));
      g.stroke();
    }
    g.fillStyle = rgbaStr('#ffffff', alpha);
    g.fillRect(Math.round(Math.cos(a1) * rr) - 1, Math.round(Math.sin(a1) * rr) - 1, 2, 2);
    g.restore();
  },
  thrust(g, f, cx, cy) {
    const p = G.p, k = f.t / f.life, x = p.x - cx, y = p.y - 8 - cy, rr = f.reach * Math.sin(Math.min(1, k * 1.6) * Math.PI / 2);
    g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(f.ang);
    g.fillStyle = rgbaStr(f.color, (1 - k) * 0.7); g.fillRect(6, -1, Math.max(1, rr - 6), 2); g.fillStyle = rgbaStr('#ffffff', 1 - k); g.fillRect(Math.round(rr) - 2, -1, 3, 2);
    g.restore();
  },
  spin(g, f, cx, cy) {
    const p = G.p, k = f.t / f.life, x = p.x - cx, y = p.y - 7 - cy;
    g.strokeStyle = rgbaStr(f.color, (1 - k) * 0.85); g.lineWidth = 2;
    g.beginPath(); g.arc(Math.round(x), Math.round(y), f.reach, f.ang, f.ang + TAU * Math.min(1, k * 1.4)); g.stroke();
  },
  ring(g, f, cx, cy) {
    const k = f.t / f.life, r2 = lerp(f.r0, f.r, easeOut(k));
    g.strokeStyle = rgbaStr(f.color, 1 - k); g.lineWidth = f.width || 1;
    g.beginPath(); g.ellipse(Math.round(f.x - cx), Math.round(f.y - cy), r2, r2 * 0.6, 0, 0, TAU); g.stroke();
  },
  boom(g, f, cx, cy) {
    const k = f.t / f.life, r2 = f.r * easeOut(Math.min(1, k * 2));
    g.fillStyle = rgbaStr(k < 0.25 ? '#fff3c0' : f.color, (1 - k) * 0.6);
    g.beginPath(); g.ellipse(Math.round(f.x - cx), Math.round(f.y - cy), r2, r2 * 0.7, 0, 0, TAU); g.fill();
  },
  zap(g, f, cx, cy) {
    const k = f.t / f.life;
    g.strokeStyle = rgbaStr(f.color, 1 - k * 0.6); g.lineWidth = 1;
    const n = Math.max(3, Math.round(Math.hypot(f.x1 - f.x0, f.y1 - f.y0) / 8));
    g.beginPath(); g.moveTo(Math.round(f.x0 - cx), Math.round(f.y0 - cy));
    for (let i = 1; i < n; i++) { const t = i / n; g.lineTo(Math.round(lerp(f.x0, f.x1, t) - cx + rnd(-4, 4)), Math.round(lerp(f.y0, f.y1, t) - cy + rnd(-4, 4))); }
    g.lineTo(Math.round(f.x1 - cx), Math.round(f.y1 - cy)); g.stroke();
  },
  bolt(g, f, cx, cy) {
    const k = f.t / f.life, x = f.x - cx, y = f.y - cy;
    g.strokeStyle = rgbaStr('#fffbe0', 1 - k); g.lineWidth = 2;
    g.beginPath(); g.moveTo(Math.round(x + rnd(-6, 6)), -4);
    for (let yy = 0; yy < y; yy += 14) g.lineTo(Math.round(x + rnd(-6, 6)), Math.round(yy));
    g.lineTo(Math.round(x), Math.round(y)); g.stroke();
  },
  cloud(g, f, cx, cy) {
    const k = f.t / f.life, a = Math.min(1, (1 - k) * 3) * 0.35;
    for (let i = 0; i < 7; i++) {
      const ang = i * 0.9 + f.t * 0.6, rr = f.r * (0.35 + (i % 3) * 0.2);
      g.fillStyle = rgbaStr(f.color || '#8fe05c', a);
      g.beginPath(); g.ellipse(Math.round(f.x - cx + Math.cos(ang) * rr), Math.round(f.y - cy - 6 + Math.sin(ang) * rr * 0.5), f.r * 0.45, f.r * 0.3, 0, 0, TAU); g.fill();
    }
  },
  rain(g, f, cx, cy) {
    const k = f.t / f.life;
    g.strokeStyle = `rgba(241,229,205,${(0.4 * (1 - k)).toFixed(3)})`; g.lineWidth = 1;
    g.beginPath(); g.ellipse(Math.round(f.x - cx), Math.round(f.y - cy), f.r, f.r * 0.55, 0, 0, TAU); g.stroke();
  },
  arrowfall(g, f, cx, cy) {
    const k = f.t / f.life, x = Math.round(f.x - cx), y = Math.round(f.y - cy);
    g.fillStyle = '#c8a070'; g.fillRect(x, y - 30 * (1 - k) - 8, 1, 8);
    if (k > 0.8) { g.fillStyle = '#ffffff'; g.fillRect(x - 1, y, 3, 1); }
  },
  meteor(g, f, cx, cy) {
    const k = f.t / f.life, x = f.x - cx + (1 - k) * 60, y = f.y - cy - (1 - k) * 140;
    for (let i = 0; i < 5; i++) { g.fillStyle = ['#fff3c0', '#ffd08a', '#ff9a3c', '#e8521c', '#5a2a1a'][i]; g.fillRect(Math.round(x + i * 4), Math.round(y - i * 9), 5 - i * 0.6, 5 - i * 0.6); }
    g.fillStyle = '#3a2a26'; g.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6); g.fillStyle = '#ff7a2a'; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
  },
  icicle(g, f, cx, cy) {
    const k = f.t / f.life, x = Math.round(f.x - cx), y = Math.round(f.y - cy), hh = Math.round(14 * Math.min(1, k * 5)) * (1 - Math.max(0, k - 0.7) * 3);
    g.fillStyle = '#cfefff'; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x, y - hh); g.lineTo(x + 4, y); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(x - 1, y - hh + 2, 1, Math.max(0, hh - 3));
  },
  bombfuse(g, f, cx, cy) {
    const x = Math.round(f.x - cx), y = Math.round(f.y - cy);
    g.fillStyle = OUTLINE; g.fillRect(x - 3, y - 5, 7, 6); g.fillStyle = '#1e1e26'; g.fillRect(x - 2, y - 4, 5, 4);
    g.fillStyle = Math.floor(G.t * 24) % 2 ? '#ffd08a' : '#ff5a2a'; g.fillRect(x + 1, y - 7, 1, 2);
  },
};
function drawTele(g, f, cx, cy) {
  const k = clamp(f.t / f.life, 0, 1), col = f.color || '#ff5a5a';
  const blinkA = 0.18 + k * 0.32 + (Math.floor(G.t * 14) % 2 ? 0.08 : 0);
  if (f.team === 'p') {
    g.strokeStyle = rgbaStr(col, 0.7); g.lineWidth = 1;
    g.beginPath(); g.ellipse(Math.round(f.x - cx), Math.round(f.y - cy), f.r, f.r * 0.55, 0, 0, TAU); g.stroke();
    g.fillStyle = rgbaStr(col, 0.12 + k * 0.15); g.fill();
    return;
  }
  if (f.line) {
    g.save(); g.translate(Math.round(f.x - cx), Math.round(f.y - cy)); g.rotate(f.ang);
    const w2 = f.width || 3;
    g.fillStyle = rgbaStr(col, blinkA * 0.8); g.fillRect(0, -w2 / 2, f.len, w2);
    g.fillStyle = rgbaStr(col, 0.9); g.fillRect(0, -w2 / 2, f.len * k, 1); g.fillRect(0, w2 / 2 - 1, f.len * k, 1);
    g.restore();
  } else if (f.cone) {
    g.fillStyle = rgbaStr(col, blinkA);
    g.beginPath(); g.moveTo(Math.round(f.x - cx), Math.round(f.y - cy)); g.arc(Math.round(f.x - cx), Math.round(f.y - cy), f.r, f.ang - f.arc / 2, f.ang + f.arc / 2); g.closePath(); g.fill();
  } else {
    const x = Math.round(f.x - cx), y = Math.round(f.y - cy);
    g.fillStyle = rgbaStr(col, blinkA * 0.7);
    g.beginPath(); g.ellipse(x, y, f.r, f.r * 0.6, 0, 0, TAU); g.fill();
    g.strokeStyle = rgbaStr(col, 0.9); g.lineWidth = 1;
    g.beginPath(); g.ellipse(x, y, f.r * k, f.r * 0.6 * k, 0, 0, TAU); g.stroke();
    g.beginPath(); g.ellipse(x, y, f.r, f.r * 0.6, 0, 0, TAU); g.stroke();
  }
}
function drawParticles(g, cx, cy, glowPass) {
  const p = G.p;
  for (const q of G.parts) {
    if (!!q.glow !== glowPass) continue;
    const x = Math.round(q.x - cx), y = Math.round(q.y - cy - (q.z || 0));
    if (x < -4 || y < -4 || x > R.VW + 4 || y > R.VH + 4) continue;
    const a = clamp(q.life / q.max, 0, 1);
    if (q.ghost) {
      const sp = heroFrame(p);
      drawSprite(g, sp, q.x - cx, q.y - cy, q.face < 0, { alpha: a * 0.45, white: true });
      continue;
    }
    g.globalAlpha = glowPass ? a : Math.min(1, a * 1.6);
    g.fillStyle = q.color;
    g.fillRect(x, y, q.size, q.size);
  }
  g.globalAlpha = 1;
}

/* ---------- lighting ---------- */
function lightSources(vis) {
  const p = G.p, fl = G.fl, L = [];
  const s = p.stats;
  L.push({ x: p.x, y: p.y - 10, r: (96 + (s.light || 0)) * (G.lightMul || 1), c: '#ffe8c8', a: 0.18 });
  for (const l of fl.lights) {
    if (!vis.some((r) => r.id === l.room)) continue;
    const f = 1 + Math.sin(G.t * 9 + l.flick) * 0.05 + Math.sin(G.t * 23 + l.flick * 2) * 0.03;
    L.push({ x: l.x, y: l.y + 6, r: l.r * f, c: l.c, a: 0.3 });
  }
  for (const r of vis) for (const pid of r.props) { const pr = fl.props[pid]; if (pr.light && !pr.broken && !(pr.used && (pr.shrine || pr.fountain))) L.push({ x: pr.x, y: pr.y - 8, r: pr.light.r * (1 + Math.sin(G.t * 7 + pr.x) * 0.04), c: pr.light.c, a: 0.35 }); if (pr.stairs && pr.active) L.push({ x: pr.x, y: pr.y, r: 46, c: '#ffb35e', a: 0.3 }); if (pr.chest && !pr.opened) L.push({ x: pr.x, y: pr.y - 6, r: 26, c: '#ffd35c', a: 0.2 }); }
  for (const pr of G.projs) if (pr.light) L.push({ x: pr.x, y: pr.y - (pr.z || 0), r: pr.kind === 'bigfire' ? 50 : 26, c: pr.light, a: 0.45 });
  for (const f of G.fx) {
    if (f.kind === 'flash') L.push({ x: f.x, y: f.y, r: f.r * (1 - f.t / f.life), c: f.color, a: 0.6 * (1 - f.t / f.life) });
    else if (f.kind === 'firefield') L.push({ x: f.x, y: f.y, r: f.r * 2, c: '#ff8a3c', a: 0.25 * (1 - f.t / f.life) });
    else if (f.kind === 'zap' || f.kind === 'bolt') L.push({ x: f.x0 ?? f.x, y: f.y0 ?? f.y, r: 40, c: '#fff6b0', a: 0.5 });
    else if (f.kind === 'tele' && f.team !== 'p' && !f.line) L.push({ x: f.x, y: f.y, r: f.r * 1.4, c: '#ff4a3a', a: 0.12 });
  }
  for (const it of G.items) L.push({ x: it.x, y: it.y - 6, r: 28, c: itemColor(it), a: 0.25 });
  for (const e of G.ents) if (!e.dead && e.room === (G.room && G.room.id)) {
    if (e.boss && e.kind === 'king') L.push({ x: e.x, y: e.y - 30, r: 70, c: '#ff7a2a', a: 0.35 });
    else if (e.boss && e.kind === 'sporecap') L.push({ x: e.x, y: e.y - 30, r: 80, c: '#c58cff', a: 0.25 });
    else if (e.boss && e.def.light) L.push({ x: e.x, y: e.y - 24, r: 80, c: e.def.light, a: 0.3 });
    else if (e.def && e.def.glow) L.push({ x: e.x, y: e.y - 6, r: e.def.glow[1], c: e.def.glow[0], a: 0.3 });
    else if (e.def && (e.def.sprite === 'imp' || e.kind === 'magma' || e.kind === 'magmalet')) L.push({ x: e.x, y: e.y - 6, r: 30, c: '#ff8a3c', a: 0.3 });
    else if (e.def && (e.def.sprite === 'wraith' || e.def.sprite === 'crystal' || e.def.sprite === 'ghost')) L.push({ x: e.x, y: e.y - 8, r: 26, c: '#bfe9ff', a: 0.2 });
    else if (e.burn) L.push({ x: e.x, y: e.y - 6, r: 20, c: '#ff8a3c', a: 0.25 });
  }
  if (R.lavaLights) for (const [x, y] of R.lavaLights) L.push({ x, y, r: 30, c: '#ff7a2a', a: 0.12 });
  return L;
}
function drawLighting(g, cx, cy, vis) {
  const A = ACTS[G.fl.actIdx], d = A.dark, lg = R.lg, VW = R.VW, VH = R.VH;
  const dark = clamp(d[3] * (CD.settings.bright ? 0.75 : 1) * (G.darkMul || 1), 0, 0.96);
  const L = lightSources(vis);
  R.lights = L;
  lg.globalCompositeOperation = 'source-over';
  lg.fillStyle = G.darkTint || `rgb(${d[0]},${d[1]},${d[2]})`; lg.fillRect(0, 0, VW, VH);
  lg.globalCompositeOperation = 'destination-out';
  const white = LightTex.get('#ffffff', 0.45);
  for (const l of L) {
    const r2 = l.r;
    lg.globalAlpha = Math.min(1, 0.65 + l.a);
    lg.drawImage(white, Math.round(l.x - cx - r2), Math.round(l.y - cy - r2), r2 * 2, r2 * 2);
  }
  lg.globalAlpha = 1; lg.globalCompositeOperation = 'source-over';
  g.globalAlpha = dark;
  g.drawImage(R.light, 0, 0);
  g.globalAlpha = 1;
}
function drawGlow(g, cx, cy) {
  if (CD.settings.lowFx || !R.lights) return;
  g.globalCompositeOperation = 'lighter';
  for (const l of R.lights) {
    const tex = LightTex.get(l.c, 0.3), r2 = l.r * 0.8;
    g.globalAlpha = l.a * 0.55;
    g.drawImage(tex, Math.round(l.x - cx - r2), Math.round(l.y - cy - r2), r2 * 2, r2 * 2);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

