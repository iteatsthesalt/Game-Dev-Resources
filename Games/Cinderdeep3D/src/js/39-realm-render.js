/* ============================================================
   Cinderdeep — drawing the Realm: ground baked into 512px blocks
   with shorelines and soft patch edges, trees and houses sorted
   with everyone walking among them, day and night with lamps and
   campfires, and weather for every biome.
   ============================================================ */
const BLK = 32;
W.blocks = new Map();
const DECO_NAME = () => { const a = []; for (const k in DECO_IDS) a[DECO_IDS[k]] = k; return a; };
const isWaterG = (g) => g === GR.DEEP || g === GR.SHALLOW || g === GR.LAVA || g === GR.TOXIC;
const isBaseG = (g) => g === GR.BASE || g === GR.ALT || g === GR.DARK;
const ANIM_G = (g) => g === GR.LAVA || g === GR.TOXIC;
const foamOf = (g) => (g === GR.LAVA ? '#ffd08a' : g === GR.TOXIC ? '#b8f070' : '#e8f6ff');
const isGroundG = (g) => g === GR.BASE || g === GR.ALT || g === GR.DARK || g === GR.ROAD || g === GR.PLAZA || g === GR.SAND || g === GR.DIRT || g === GR.FIELD;
const CR = 8;
const cornerPath = (g) => { g.beginPath(); g.moveTo(0, 0); g.lineTo(CR, 0); g.arc(CR, CR, CR, -Math.PI / 2, Math.PI, true); g.closePath(); };
const cornerable = (g) => isGroundG(g) || isWaterG(g) || g === GR.ICE;
function blockCanvas(Z, bx, by) {
  const key = bx + by * 64;
  let B = W.blocks.get(key);
  if (B) { B.used = G.t; return B; }
  genChunk(Z, chunkOf(bx * BLK, by * BLK));
  W.blocksRig = crigOn();
  const c = mkCanvas(BLK * TS, BLK * TS), g = c.getContext('2d'), T = tileTex(Z.b), b = Z.b, names = DECO_NAME();
  let O = null;
  const anim = [];
  const og = () => { if (!O) { O = mkCanvas(BLK * TS, BLK * TS); O.g2 = O.getContext('2d'); } return O.g2; };
  const gAt = (x, y) => (x < 0 || y < 0 || x >= ZT || y >= ZT ? GR.CLIFF : Z.ground[y * ZT + x]);
  const baseCol = { [GR.BASE]: b.g[0], [GR.ALT]: b.g[1], [GR.DARK]: b.g[2] };
  for (let y = 0; y < BLK; y++) for (let x = 0; x < BLK; x++) {
    const tx = bx * BLK + x, ty = by * BLK + y, k = ty * ZT + tx, gr = Z.ground[k], t = Z.tiles[k], h = tileHash(Z.seed, tx, ty), px = x * TS, py = y * TS;
    if (gr === GR.CLIFF) {
      if (Z.deco[k] === 251) g.drawImage(T.wall[h & 1], px, py);
      else if (gAt(tx, ty + 1) !== GR.CLIFF) g.drawImage(T.face[h % 3], px, py);
      else g.drawImage(T[GR.CLIFF][h & 3], px, py);
      // a lit rim along the top of a cliff
      if (gAt(tx, ty - 1) !== GR.CLIFF) { g.fillStyle = shade(b.cliff[0], 0.18); g.fillRect(px, py, TS, 2); }
      continue;
    }
    { const arr = T[gr] || T[GR.BASE]; g.drawImage(arr[(h >>> 0) % arr.length], px, py); }
    // soft edges between grass patches
    if (isBaseG(gr)) for (const [dx, dy, ex, ey, ew, eh] of [[1, 0, 12, 0, 4, 16], [-1, 0, 0, 0, 4, 16], [0, 1, 0, 12, 16, 4], [0, -1, 0, 0, 16, 4]]) {
      const ng = gAt(tx + dx, ty + dy);
      if (ng !== gr && isBaseG(ng)) { g.fillStyle = baseCol[ng]; for (let i = 0; i < 12; i++) { const r = hash2(h, i * 31 + dx * 7 + dy * 13), ox = r % ew, oy = (r >> 8) % eh, w2 = (r >> 16) & 1 ? 2 : 1; g.fillRect(px + ex + ox, py + ey + oy, w2, 1); } }
    }
    // rounded corners where two kinds of ground (or ground and water) meet
    if (cornerable(gr)) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const a = gAt(tx + dx, ty), c2 = gAt(tx, ty + dy);
      if (!(a === c2 || (isBaseG(a) && isBaseG(c2) && !isBaseG(gr))) || a === gr || !cornerable(a)) continue;
      if (ANIM_G(a) && !ANIM_G(gr)) anim.push([px, py, dx, dy, a]);
      const tg = ANIM_G(gr) ? og() : g, arrA = T[a] || T[GR.BASE], texA = arrA[(h >>> 3) % arrA.length];
      tg.save();
      tg.translate(px + (dx < 0 ? 0 : TS), py + (dy < 0 ? 0 : TS)); tg.scale(dx < 0 ? 1 : -1, dy < 0 ? 1 : -1);
      tg.save(); cornerPath(tg); tg.clip();
      tg.drawImage(texA, 0, 0);
      const wg = isWaterG(gr), wa = isWaterG(a);
      if (wa && !wg) { tg.strokeStyle = rgbaStr(foamOf(a), a === GR.DEEP ? 0.35 : 0.55); tg.lineWidth = 2; tg.beginPath(); tg.arc(CR, CR, CR + 1, -Math.PI / 2, Math.PI, true); tg.stroke(); }
      tg.restore();
      if (wg && !wa) { tg.strokeStyle = rgbaStr(foamOf(gr), gr === GR.DEEP ? 0.35 : 0.55); tg.lineWidth = 2; tg.beginPath(); tg.arc(CR, CR, CR - 1, -Math.PI / 2, Math.PI, true); tg.stroke(); }
      tg.restore();
    }
    // shorelines
    if (isWaterG(gr)) {
      const sg = ANIM_G(gr) ? og() : g;
      // the shadow a bridge throws on the water
      if (gAt(tx, ty - 1) === GR.BRIDGE) { sg.fillStyle = 'rgba(0,0,0,0.28)'; sg.fillRect(px, py, 16, 4); }
      if (gAt(tx - 1, ty) === GR.BRIDGE) { sg.fillStyle = 'rgba(0,0,0,0.2)'; sg.fillRect(px, py + 3, 3, 13); }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ng = gAt(tx + dx, ty + dy);
        if (isWaterG(ng) || ng === GR.BRIDGE) continue;
        sg.fillStyle = rgbaStr(foamOf(gr), gr === GR.DEEP ? 0.35 : 0.55);
        if (dx === 1) sg.fillRect(px + 14, py, 2, 16); else if (dx === -1) sg.fillRect(px, py, 2, 16); else if (dy === 1) sg.fillRect(px, py + 14, 16, 2); else sg.fillRect(px, py, 16, 2);
      }
      if (gr === GR.DEEP) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (gAt(tx + dx, ty + dy) === GR.SHALLOW) { g.fillStyle = rgbaStr(b.water[1], 0.5); if (dx === 1) g.fillRect(px + 13, py, 3, 16); else if (dx === -1) g.fillRect(px, py, 3, 16); else if (dy === 1) g.fillRect(px, py + 13, 16, 3); else g.fillRect(px, py, 16, 3); }
    } else if (gr !== GR.BRIDGE) {
      // wet ground and road edges
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ng = gAt(tx + dx, ty + dy);
        if (isWaterG(ng)) { g.fillStyle = 'rgba(0,0,0,0.18)'; if (dx === 1) g.fillRect(px + 15, py, 1, 16); else if (dx === -1) g.fillRect(px, py, 1, 16); else if (dy === 1) g.fillRect(px, py + 15, 16, 1); else g.fillRect(px, py, 16, 1); }
        else if ((gr === GR.ROAD || gr === GR.PLAZA) && ng !== GR.ROAD && ng !== GR.PLAZA && ng !== GR.BRIDGE && ng !== GR.CLIFF) { g.fillStyle = 'rgba(0,0,0,0.12)'; if (dx === 1) g.fillRect(px + 15, py, 1, 16); else if (dx === -1) g.fillRect(px, py, 1, 16); else if (dy === 1) g.fillRect(px, py + 15, 16, 1); else g.fillRect(px, py, 16, 1); }
      }
      // shade under a cliff face
      if (gAt(tx, ty - 1) === GR.CLIFF) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(px, py, TS, 3); }
    }
    if (gr === GR.BRIDGE) {
      // which way the deck runs: the longer stretch of planks through this tile
      let rh = 0, rv = 0;
      for (let d = 1; d < 6 && gAt(tx + d, ty) === GR.BRIDGE; d++) rh++; for (let d = 1; d < 6 && gAt(tx - d, ty) === GR.BRIDGE; d++) rh++;
      for (let d = 1; d < 6 && gAt(tx, ty + d) === GR.BRIDGE; d++) rv++; for (let d = 1; d < 6 && gAt(tx, ty - d) === GR.BRIDGE; d++) rv++;
      const hz = rh > rv;
      if (hz) g.drawImage(T.bridgeH[h & 1], px, py);
      g.fillStyle = '#4a2e18';
      const side = (x2, y2) => { const ng = gAt(x2, y2); return ng !== GR.BRIDGE && ng !== GR.ROAD && ng !== GR.PLAZA; };
      if (hz) { if (side(tx, ty - 1)) { g.fillRect(px, py, 16, 2); g.fillStyle = '#7a5a3a'; g.fillRect(px + 2 + (tx & 1) * 6, py - 3, 2, 4); g.fillStyle = '#4a2e18'; } if (side(tx, ty + 1)) g.fillRect(px, py + 13, 16, 3); }
      else { if (side(tx - 1, ty)) g.fillRect(px, py, 2, 16); if (side(tx + 1, ty)) g.fillRect(px + 14, py, 2, 16); }
    }
    const dc = Z.deco[k];
    if (dc && dc < 250 && t !== TILE.TREE && names[dc] && !(W.blocksRig && LIVE_DECO.has(names[dc]))) drawDeco(g, names[dc], px, py, h, b);
  }
  B = { c, o: O, anim, used: G.t };
  W.blocks.set(key, B);
  if (W.blocks.size > 24) { let old = null, ot = 1e9; for (const [kk, v] of W.blocks) if (v.used < ot && kk !== key) { ot = v.used; old = kk; } if (old != null) W.blocks.delete(old); }
  return B;
}

// seamless 128px liquid sheets: lava and poison flow across tiles without seams or visible repeats
const LIQ_N = 8, LIQ_S = 128;
function tileNoise(x, y, P, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const v = (i, j) => (hash2(((i % P) + P) % P + seed * 131, ((j % P) + P) % P + seed * 71) & 1023) / 1023;
  return lerp(lerp(v(x0, y0), v(x0 + 1, y0), sx), lerp(v(x0, y0 + 1), v(x0 + 1, y0 + 1), sx), sy);
}
function liquidSheet(kind, b) {
  return spr(kind === 'lava' ? 'liq:lava' : 'liq:tox:' + b.id, () => {
    const pal = kind === 'lava' ? ['#3a0e06', '#6a1a0c', '#a82a12', '#dc4618', '#f86e22', '#ffa040', '#ffd27a', '#fff2c0']
      : (() => { const base = mixHex(b.g[2], '#3e7a22', 0.55); return [shade(base, -0.32), shade(base, -0.2), shade(base, -0.1), base, shade(base, 0.08), shade(base, 0.16), '#7fc24a', '#c8f080']; })();
    const rgb = pal.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    const TAU = Math.PI * 2, out = [], S = LIQ_S, seed = kind === 'lava' ? 3 : 9;
    for (let f = 0; f < LIQ_N; f++) {
      const c = mkCanvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), t = f / LIQ_N;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const u = x / S, v = y / S;
        // a slow periodic warp makes the surface churn
        const wx = u * 4 + 0.35 * Math.sin(TAU * (v + t)) + 0.15 * Math.sin(TAU * (u * 2 - t)), wy = v * 4 + 0.35 * Math.cos(TAU * (u + t)) + 0.15 * Math.cos(TAU * (v * 2 + t));
        let n = tileNoise(wx, wy, 4, seed) * 0.55 + tileNoise(wx * 2, wy * 2, 8, seed + 1) * 0.3 + tileNoise(x / S * 16, y / S * 16, 16, seed + 2) * 0.15;
        n += ((hash2(x * 13 + y, y * 7 + x) & 15) - 7.5) / 160;
        let i = kind === 'lava' ? Math.floor(Math.pow(clamp((n - 0.2) / 0.62, 0, 1), 1.45) * 8) : Math.floor(clamp((n - 0.2) / 0.6, 0, 1) * 6);
        i = Math.max(0, Math.min(7, i));
        const o = (y * S + x) * 4; img.data[o] = rgb[i][0]; img.data[o + 1] = rgb[i][1]; img.data[o + 2] = rgb[i][2]; img.data[o + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      if (kind !== 'lava') for (let i = 0; i < 14; i++) {
        if ((i + f) % 5 === 0) continue;
        const bx = (i * 37 + 9) % (S - 4), by = ((i * 53 + 17) - f * 3 + S * 8) % S, r = 1 + (i % 3) * 0.5;
        g.fillStyle = pal[6]; g.beginPath(); g.arc(bx + 2, by, r, 0, TAU); g.fill(); g.fillStyle = pal[7]; g.fillRect(bx + 1, Math.floor(by - r), 1, 1);
      }
      out.push(c);
    }
    return out;
  });
}

function objSprite(o, b) {
  switch (o.kind) {
    case 'tree': return treeSprite(o.tree, o.v);
    case 'boulder': return boulderSprite(b.rocks, o.v);
    case 'building': return buildingSprite(o.bld);
    case 'chest': { const opened = W.ch && W.ch.chests && W.ch.chests[o.chest.id] && Date.now() - W.ch.chests[o.chest.id] < 20 * 60 * 1000; return chestSprite(o.chest.tier, !!opened); }
    case 'fountain': return propArt('fountain', 0, o.big ? 'big' : '');
    case 'dungeon': return propArt('dungeon', o.act);
    case 'mark': return propArt('mark', 0, o.mk);
    case 'menhir': return propArt('menhir', o.v % 3);
    case 'stall': return propArt('stall', o.v % 4);
    default: return propArt(o.kind, 0);
  }
}

/* ---------- the ground, painted for the 3D view ---------- */
// the land under a world rectangle: baked 512px blocks, moving water, lava and poison, and the shores
function realmGround(g, cx, cy, VW, VH) {
  const Z = W.Z, b = Z.b, bs = BLK * TS, blocks = [];
  g.fillStyle = b.g[2]; g.fillRect(0, 0, VW, VH);
  for (let by = Math.max(0, Math.floor(cy / bs)); by <= Math.min(ZT / BLK - 1, Math.floor((cy + VH) / bs)); by++)
    for (let bx = Math.max(0, Math.floor(cx / bs)); bx <= Math.min(ZT / BLK - 1, Math.floor((cx + VW) / bs)); bx++)
      { const B = blockCanvas(Z, bx, by); g.drawImage(B.c, bx * bs - cx, by * bs - cy); if (B.o || B.anim.length) blocks.push([B, bx * bs - cx, by * bs - cy]); }
  const tx0 = Math.max(0, Math.floor(cx / TS)), ty0 = Math.max(0, Math.floor(cy / TS)), tx1 = Math.min(ZT - 1, Math.ceil((cx + VW) / TS)), ty1 = Math.min(ZT - 1, Math.ceil((cy + VH) / TS));
  const ph = Math.floor(G.t * 1.6), lf = Math.floor(G.t * 4) % LIQ_N;
  R.lavaLights = [];
  // the flowing sheets are only made when lava or poison is actually in view
  let lavaS = null, toxS = null;
  const lavaSheet = () => lavaS || (lavaS = liquidSheet('lava', b)[lf]), toxSheet = () => toxS || (toxS = liquidSheet('tox', b)[lf]);
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
    const gr = Z.ground[y * ZT + x];
    if (gr === GR.LAVA) { g.drawImage(lavaSheet(), (x & 7) * TS, (y & 7) * TS, TS, TS, x * TS - cx, y * TS - cy, TS, TS); if (x % 3 === 0 && y % 3 === 0 && R.lavaLights.length < 90) R.lavaLights.push([x * TS + 8, y * TS + 8]); }
    else if (gr === GR.TOXIC) g.drawImage(toxSheet(), (x & 7) * TS, (y & 7) * TS, TS, TS, x * TS - cx, y * TS - cy, TS, TS);
    else if ((gr === GR.DEEP || gr === GR.SHALLOW) && (hash2(x * 7 + ph, y) & 31) === 0) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x * TS - cx + (hash2(x, y + ph) & 11), y * TS - cy + (hash2(y, x + ph) & 11), 3, 1); }
  }
  // liquid creeping into the inside corners of the land around it, then the shore overlays
  for (const [B, ox, oy] of blocks) for (const [ax, ay, dx, dy, a] of B.anim) {
    const sx = ox + ax, sy = oy + ay;
    if (sx < -TS || sy < -TS || sx > VW || sy > VH) continue;
    const sheet = a === GR.LAVA ? lavaSheet() : toxSheet(), wx = ((sx + cx) >> 4) & 7, wy = ((sy + cy) >> 4) & 7;
    g.save(); g.translate(sx + (dx < 0 ? 0 : TS), sy + (dy < 0 ? 0 : TS)); g.scale(dx < 0 ? 1 : -1, dy < 0 ? 1 : -1); cornerPath(g); g.clip(); g.scale(dx < 0 ? 1 : -1, dy < 0 ? 1 : -1); g.translate(dx < 0 ? 0 : -TS, dy < 0 ? 0 : -TS);
    g.drawImage(sheet, wx * TS, wy * TS, TS, TS, 0, 0, TS, TS);
    g.translate(dx < 0 ? 0 : TS, dy < 0 ? 0 : TS); g.scale(dx < 0 ? 1 : -1, dy < 0 ? 1 : -1);
    g.strokeStyle = rgbaStr(foamOf(a), 0.55); g.lineWidth = 2; g.beginPath(); g.arc(CR, CR, CR + 1, -Math.PI / 2, Math.PI, true); g.stroke();
    g.restore();
  }
  for (const [B, ox, oy] of blocks) if (B.o) g.drawImage(B.o, ox, oy);
}
function drawRealmObj(g, o, sp, cx, cy, faded) {
  const x = Math.round(o.x - cx), y = Math.round(o.y - cy);
  if (o.kind === 'tree' || o.kind === 'boulder' || o.kind === 'tower' || o.kind === 'mark' || o.kind === 'menhir' || o.kind === 'waystone' || o.kind === 'lamp' || o.kind === 'well' || o.kind === 'stall') { const bw = sp.baseW || sp.w; shadowEllipse(g, x, y, Math.max(4, bw * 0.32), Math.max(2, bw * 0.11), 0.22); }
  if (o.kind === 'building') shadowEllipse(g, x - sp.ax + 1.5 + sp.w / 2, y + 1, (sp.w - 3) / 2, 3, 0.25);
  if (faded) g.globalAlpha = 0.45;
  g.drawImage(sp.c, x - sp.ax, y - sp.ay);
  g.globalAlpha = 1;
  if (o.kind === 'campfire') { drawFlame(g, x, y - 3, 1.1, o.x); if (Math.random() < 0.3) burst(o.x + rnd(-3, 3), o.y - 6, 1, ['#ffd08a', '#ff7a2a'], { grav: -40, floor: false, smax: 10, glow: true, lmax: 0.8 }); }
  else if (o.kind === 'waystone') { const on = W.ch && W.ch.ways.includes(o.way.id), a = 0.5 + Math.sin(G.t * 3 + o.x) * 0.3; g.globalCompositeOperation = 'lighter'; g.globalAlpha = on ? a : 0.15; g.drawImage(LightTex.get('#7fe8ff', 0.3), x - 14, y - 34, 28, 28); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  else if (o.kind === 'fountain' && Math.random() < 0.4) burst(o.x + rnd(-2, 2), o.y - 20, 1, ['#9ad8f8', '#ffffff'], { z: 14, vz: 40, smax: 18, grav: 120, lmax: 0.6 });
  else if (o.kind === 'dungeon') { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.25 + Math.sin(G.t * 2) * 0.1; g.drawImage(LightTex.get(['#c8b48a', '#9cf0d8', '#bfe9ff', '#ff8a3c'][o.act] || '#ffffff', 0.4), x - 26, y - 34, 52, 40); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
}
function drawNpc(g, n, cx, cy) {
  const set = npcSprites(n), fi = n.moving ? 1 + (Math.floor(n.anim) % 2) : 0;
  const sp = rigHeroFrame(set, n, fi, true);
  shadow(g, n.x - cx, n.y - cy, 5);
  drawSprite(g, sp, n.x - cx, n.y - cy, n.face < 0, {});
  if (n.role !== 'folk' && n.role !== 'guard') {
    const bob = Math.sin(G.t * 3 + n.x) * 1.5, t = pixelText(n.role === 'board' ? '!' : '•', n.role === 'board' ? '#ffd35c' : '#7de08a');
    if (n.role === 'board') g.drawImage(t, Math.round(n.x - cx - t.width / 2), Math.round(n.y - cy - 30 + bob));
  }
}
function drawMount(g, p, cx, cy) {
  const sp = mountFrames()[p.moving ? 1 + (Math.floor(p.anim * 0.7) % 2) : 0];
  drawSprite(g, sp, p.x - cx, p.y - cy + 2, p.face < 0, {});
}
function mountFrames() {
  return spr('mount', () => {
    const d = { fam: 'quad', v: 'horse', c: ['#8a5a3a', '#2e1e14', '#e8d8b0'], size: 1.15, ghostly: false }, [w, h] = creatureSize('quad', 'horse', 1.15);
    return crigAttach([0, 1, 2].map((f) => { const p = new PP(w, h); paintCreature(p, d, f); p.outline(); return p.sprite(Math.floor(w / 2), h - 1); }), { w, h, ax: Math.floor(w / 2), ay: h - 1, atkF: 2, paint: (p, f) => paintCreature(p, d, f) });
  });
}
// a level over a monster that matters to you; x, y is its feet on the canvas
function drawRealmLabel(g, e, x, y) {
  const p = G.p;
  if (e.dead || !e.world || e.spawnT > 0 || e.boss) return;
  const d = Math.hypot(e.x - p.x, e.y - p.y);
  if (d > 200 || !(e.champion || (e.aggro && d < 140))) return;
  const col = e.champion ? '#ffd35c' : e.lvl > p.level + 3 ? '#ff6a5a' : e.lvl < p.level - 5 ? '#9a9aa0' : '#e8e0d0';
  const t = pixelText(`LV ${e.lvl}`, col);
  g.drawImage(t, Math.round(x - t.width / 2), Math.round(y - e.h * (e.scale || 1) - (e.eliteMods ? 22 : 13)));
}
// what a townsperson says, over their head at x, y
function drawSpeech(g, text, x, y) {
  const t = speechText(text, 64);
  x = Math.round(x); y = Math.round(y - 25 - t.height);
  g.fillStyle = 'rgba(244,236,216,0.94)'; g.fillRect(x - t.width / 2 - 3, y - 4, t.width + 6, t.height + 6); g.fillRect(x - 1, y + t.height + 2, 3, 3);
  g.drawImage(t, x - t.width / 2, y - 1);
}

/* ---------- day, night and the lights in the dark ---------- */
const NIGHT_TINT = { shadowfen: [8, 12, 14], caldera: [34, 8, 4], voidscar: [22, 6, 34], sporeveil: [6, 16, 18], feywild: [16, 10, 34], crystal: [12, 12, 30] };
// how dark the land is, the warm light of dawn and dusk, its night tint, and every light near the view
function realmLights(cx, cy, VW, VH) {
  const Z = W.Z, b = Z.b, t = realmTime();
  let dark = (1 - daylight()) * 0.62 * (b.night || 1) + (b.dark || 0);
  if (CD.settings.bright) dark *= 0.75;
  dark = clamp(dark, 0, 0.9);
  const dusk = Math.max(0, 1 - Math.abs(t - 0.27) * 10) + Math.max(0, 1 - Math.abs(t - 0.73) * 10);
  G.fl.lights = [];
  const L = lightSources([]), night = dark > 0.25;
  for (const l of Z.lights) {
    if (l.x < cx - 120 || l.x > cx + VW + 120 || l.y < cy - 120 || l.y > cy + VH + 120 || (l.lamp && !night)) continue;
    L.push({ x: l.x, y: l.y, r: l.r * (l.fire ? 1 + Math.sin(G.t * 9 + l.x) * 0.06 : 1), c: l.c, a: 0.35 });
  }
  for (let cyy = Math.max(0, Math.floor((cy - 60) / TS / ZCH)); cyy <= Math.min(ZCN - 1, Math.floor((cy + VH + 60) / TS / ZCH)); cyy++) for (let cxx = Math.max(0, Math.floor((cx - 60) / TS / ZCH)); cxx <= Math.min(ZCN - 1, Math.floor((cx + VW + 60) / TS / ZCH)); cxx++)
    for (const o of Z.objs[cyy * ZCN + cxx]) {
      if (o.x < cx - 60 || o.x > cx + VW + 60 || o.y < cy - 40 || o.y > cy + VH + 80) continue;
      if (o.kind === 'waystone') L.push({ x: o.x, y: o.y - 16, r: 50, c: '#7fe8ff', a: 0.3 });
      else if (o.kind === 'dungeon') L.push({ x: o.x, y: o.y - 14, r: 70, c: ['#ffb766', '#9cf0d8', '#bfe9ff', '#ff7a2a'][o.act] || '#ffb766', a: 0.35 });
      else if (o.kind === 'building' && night) L.push({ x: o.x, y: o.y - 18, r: 46, c: '#ffd890', a: 0.25 });
      else if (o.kind === 'tree' && (o.tree === 'glowshroom' || o.tree === 'crystaltree' || o.tree === 'feytree')) L.push({ x: o.x, y: o.y - 10, r: 34, c: o.tree === 'glowshroom' ? '#7fe8ff' : '#c8a8ff', a: 0.25 });
    }
  for (const n of W.npcs) if (n.role === 'guard' && night && Math.abs(n.x - G.cam.x) < VW) L.push({ x: n.x, y: n.y - 10, r: 40, c: '#ffb766', a: 0.25 });
  if (L[0]) L[0].r = (110 + (G.p.stats.light || 0) + ascStage(G.p) * 6) * (G.lightMul || 1);
  return { dark, dusk, L, tint: NIGHT_TINT[b.id] || [10, 14, 34] };
}

/* ---------- weather for every biome ---------- */
Object.assign(WX_CFG, {
  pollen: { n: 24, spawn(P, W2, H, init) { P.x = rnd(W2); P.y = init ? rnd(H) : rndPick([-4, H + 4]); P.vx = rnd(-6, 6); P.vy = rnd(-4, 4); P.s = 1; P.c = rndPick(['#fff6c0', '#ffffff', '#e8ffd0']); P.a = rnd(0.3, 0.7); P.par = rnd(0.3, 1); P.glow = true; } },
  leaves: { n: 22, spawn(P, W2, H, init) { P.x = init ? rnd(W2) : rnd(-20, W2); P.y = init ? rnd(H) : -4; P.vx = rnd(4, 14); P.vy = rnd(8, 16); P.s = 2; P.c = rndPick(['#e8642a', '#c8a02a', '#7aa83a', '#a84a1a']); P.a = rnd(0.5, 0.9); P.par = rnd(0.5, 1.2); P.glow = false; } },
  petals: { n: 30, spawn(P, W2, H, init) { P.x = init ? rnd(W2) : rnd(-20, W2); P.y = init ? rnd(H) : -4; P.vx = rnd(6, 16); P.vy = rnd(6, 14); P.s = 2; P.c = rndPick(['#ffb8d8', '#ff8ac0', '#fff0f6']); P.a = rnd(0.5, 0.9); P.par = rnd(0.4, 1.2); P.glow = false; } },
  dust: { n: 18, spawn(P, W2, H, init) { P.x = init ? rnd(W2) : -4; P.y = rnd(H); P.vx = rnd(10, 24); P.vy = rnd(-2, 2); P.s = 1; P.c = rndPick(['#e8d0a0', '#c8b080']); P.a = rnd(0.25, 0.5); P.par = rnd(0.4, 1); P.glow = false; } },
  mist: { n: 14, spawn(P, W2, H, init) { P.x = init ? rnd(W2) : -10; P.y = rnd(H); P.vx = rnd(3, 8); P.vy = rnd(-1, 1); P.s = 3; P.c = '#dfe8f2'; P.a = rnd(0.08, 0.18); P.par = rnd(0.2, 0.6); P.glow = false; } },
  ash: { n: 34, spawn(P, W2, H, init) { P.x = rnd(W2); P.y = init ? rnd(H) : -4; P.vx = rnd(-4, 4); P.vy = rnd(6, 12); P.s = Math.random() < 0.2 ? 2 : 1; P.c = rndPick(['#8a8078', '#5a524e', '#ff7a2a']); P.a = rnd(0.3, 0.7); P.par = rnd(0.3, 1); P.glow = false; } },
  swamp: { n: 22, spawn(P, W2, H, init) { P.x = rnd(W2); P.y = init ? rnd(H) : H + 4; P.vx = rnd(-3, 3); P.vy = rnd(-8, -3); P.s = 1; P.c = rndPick(['#c8ff6a', '#a8e070', '#e8ffd0']); P.a = rnd(0.3, 0.6); P.par = rnd(0.3, 0.9); P.glow = true; } },
  spores: WX_CFG.grotto,
  snow: WX_CFG.frost,
  blizzard: { n: 110, spawn(P, W2, H, init) { P.x = init ? rnd(W2) : rnd(0, W2 + 60); P.y = init ? rnd(H) : -4; P.vx = rnd(-40, -22); P.vy = rnd(30, 50); P.s = Math.random() < 0.3 ? 2 : 1; P.c = '#ffffff'; P.a = rnd(0.4, 0.9); P.par = rnd(0.4, 1.2); P.glow = false; P.streak = 2; } },
  rain: { n: 90, spawn(P, W2, H, init) { P.x = init ? rnd(W2) : rnd(-20, W2 + 40); P.y = init ? rnd(H) : -6; P.vx = rnd(-30, -20); P.vy = rnd(200, 260); P.s = 1; P.c = '#a8c8e8'; P.a = rnd(0.25, 0.5); P.par = rnd(0.6, 1.2); P.glow = false; P.streak = 4; } },
  sand: { n: 50, spawn(P, W2, H, init) { P.x = init ? rnd(W2) : -4; P.y = rnd(H); P.vx = rnd(40, 70); P.vy = rnd(-4, 6); P.s = 1; P.c = rndPick(['#e8c888', '#d8b070', '#f4e0b0']); P.a = rnd(0.3, 0.6); P.par = rnd(0.5, 1.2); P.glow = false; P.streak = 2; } },
  embers: WX_CFG.core,
  sea: { n: 16, spawn(P, W2, H, init) { P.x = rnd(W2); P.y = init ? rnd(H) : H + 4; P.vx = rnd(-4, 4); P.vy = rnd(-6, -2); P.s = 1; P.c = '#e8f8ff'; P.a = rnd(0.2, 0.5); P.par = rnd(0.3, 0.8); P.glow = true; } },
  glitter: { n: 26, spawn(P, W2, H, init) { P.x = rnd(W2); P.y = init ? rnd(H) : rndPick([-4, H + 4]); P.vx = rnd(-5, 5); P.vy = rnd(-5, 5); P.s = 1; P.c = rndPick(['#ffffff', '#b8a8ff', '#9fe0ff', '#ff9ae8']); P.a = rnd(0.4, 0.9); P.par = rnd(0.2, 1); P.glow = true; } },
  fireflies: { n: 20, spawn(P, W2, H, init) { P.x = rnd(W2); P.y = init ? rnd(H) : rndPick([-4, H + 4]); P.vx = rnd(-8, 8); P.vy = rnd(-8, 8); P.s = 1; P.c = rndPick(['#e8ff8a', '#ffd35c', '#c8ffe8']); P.a = rnd(0.5, 1); P.par = rnd(0.3, 1); P.glow = true; } },
});
const _weatherKeyRealm = weatherKey;
weatherKey = function () { if (W.on && !W.inInst && W.Z) { const k = W.Z.b.wx; return k === 'fireflies' && daylight() > 0.4 ? 'pollen' : k; } return _weatherKeyRealm(); };
const _drawWeatherRealm = drawWeather;
drawWeather = function (g) {
  _drawWeatherRealm(g);
  // streaks for rain, blizzards and blowing sand
  if (!(W.on && !W.inInst)) return;
  const cfg = WX_CFG[weatherKey()];
  if (!cfg || !WX.parts.length || !WX.parts[0].streak) return;
  for (const P of WX.parts) { g.globalAlpha = P.a; g.strokeStyle = P.c; g.beginPath(); g.moveTo(Math.round(P.x), Math.round(P.y)); g.lineTo(Math.round(P.x - P.vx * 0.02 * P.streak), Math.round(P.y - P.vy * 0.02 * Math.min(1, P.streak))); g.stroke(); }
  g.globalAlpha = 1;
  if (weatherKey() === 'rain' && Math.random() < 0.002 && !CD.settings.lowFx) { g.fillStyle = 'rgba(230,240,255,0.5)'; g.fillRect(0, 0, R.VW, R.VH); Sound.play('thunder', { v: 0.4 }); }
};

// dark words on a speech bubble: no outline, wrapped to a few short lines
function speechText(str, max = 48) {
  str = String(str).toUpperCase().slice(0, max);
  const key = 'sp:' + str;
  let c = textCache.get(key);
  if (c) return c;
  const words = str.split(' '), lines = [];
  let cur = '';
  for (const w of words) { if (cur && (cur + ' ' + w).length > 22) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
  if (cur) lines.push(cur);
  const wd = Math.max(...lines.map((l) => l.length)) * 4 - 1, p = new PP(Math.max(1, wd), lines.length * 7 - 2);
  lines.forEach((l, li) => [...l].forEach((ch, i) => { const g = GLYPH[ch] || GLYPH[' ']; for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (g[y * 3 + x] === '1') p.px(i * 4 + x + Math.floor((wd - (l.length * 4 - 1)) / 2), li * 7 + y, '#1e1418'); }));
  c = p.canvas();
  if (textCache.size > 400) textCache.clear();
  textCache.set(key, c);
  return c;
}

