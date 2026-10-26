/* ============================================================
   Cinderdeep — the 3D renderer. three.js draws every place the
   game goes: dungeon rooms become floors with walls standing up,
   shut doors block their gaps, the Realm's land lies under its
   trees, buildings and people, and torches, lava, lamps and spells
   cast real light. Heroes, monsters, props and loot are painted by
   their pixel painters onto cards that stand upright in the scene.
   The simulation is the same one either way: this only draws it.
   ============================================================ */
const V3 = {
  renderer: null, scene: null, camera: null, ui: null, ug: null, frame: 0,
  fl: null, level: null, rooms: [], doors: [], lights: [], cards: new Map(),
  ground: null, fx: null, ambient: null, ray: null, plane: null, v: null, size: null,
};
// The camera looks straight ahead with its lens shifted down, as architects photograph
// buildings: upright things stay upright anywhere on screen and sprites keep their painted size.
const V3_TILT = 0.8; // how far the floor recedes: its depth shows at this fraction of its width
const V3_BACK = 1.4; // camera distance in screen heights; further is flatter, nearer is more dramatic
const V3_WALL = 26, V3_WALL_LOW = 7; // wall heights in world pixels; the low ones are between you and the room
const V3_LIGHTS = 10; // a fixed number, so lighting never recompiles shaders mid-fight
const V3_RES = 2; // the scene is drawn at this many times the view's pixels, then scaled up crisp
// shared unit shapes, scaled per use: a box standing on the floor, and a flat card
const V3_BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const V3_QUAD = new THREE.PlaneGeometry(1, 1);

function v3Init() {
  try {
    const r = new THREE.WebGLRenderer({ canvas: R.screen, antialias: false, alpha: false, powerPreference: 'high-performance' });
    r.setPixelRatio(1);
    V3.renderer = r;
  } catch (e) {
    console.error('Cinderdeep needs WebGL', e);
    $('app').append(h('div', { class: 'screen center' }, h('div', { class: 'panel' }, h('h2', {}, 'WebGL is needed'), h('p', {}, 'Cinderdeep draws in 3D with WebGL, which this browser has turned off or does not offer. Try another browser, or turn on hardware acceleration.'))));
    return false;
  }
  V3.ui = h('canvas', { id: 'screen-ui', 'aria-hidden': 'true' });
  R.screen.after(V3.ui);
  V3.ug = V3.ui.getContext('2d');
  V3.scene = new THREE.Scene();
  V3.scene.background = new THREE.Color('#050305');
  V3.camera = new THREE.PerspectiveCamera(30, 16 / 9, 4, 6000);
  V3.ambient = new THREE.AmbientLight('#ffffff', 1); V3.scene.add(V3.ambient);
  for (let i = 0; i < V3_LIGHTS; i++) { const l = new THREE.PointLight('#ffffff', 0, 100, 1); V3.lights.push(l); V3.scene.add(l); }
  V3.ray = new THREE.Raycaster(); V3.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); V3.v = new THREE.Vector3(); V3.size = new THREE.Vector2();
  V3.ground = v3Layer(true, -2); V3.fx = v3Layer(false, -1);
  return true;
}
const v3Tex = (c) => { const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; return t; };
// a canvas laid flat on the floor around the camera: lit for the ground, unlit for effects
function v3Layer(lit, order) {
  const c = mkCanvas(8, 8), tex = v3Tex(c), o = { map: tex, transparent: true, depthWrite: false };
  const mesh = new THREE.Mesh(V3_QUAD, lit ? new THREE.MeshLambertMaterial(o) : new THREE.MeshBasicMaterial(o));
  mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = order;
  V3.scene.add(mesh);
  return { c, g: c.getContext('2d'), tex, mesh };
}
function v3Dispose(obj) {
  obj.traverse((o) => { if (o.geometry && o.geometry !== V3_BOX && o.geometry !== V3_QUAD) o.geometry.dispose(); for (const m of [].concat(o.material || [])) { if (m.map) m.map.dispose(); m.dispose(); } });
}

/* ---------- a dungeon: a floor and walls for every room ---------- */
const v3Floorish = (t) => t === TILE.FLOOR || t === TILE.ICE || t === TILE.TOXIC || t === TILE.LAVA || t === TILE.SPIKE || t === TILE.PIT || t === TILE.DOOR || t === TILE.ROCK;
function v3BuildLevel() {
  if (V3.level) { V3.scene.remove(V3.level); v3Dispose(V3.level); }
  const fl = G.fl, T = getTileset(fl.actIdx), level = new THREE.Group();
  V3.level = level; V3.fl = fl; V3.rooms = [];
  const top = v3Tex(T.top), face = v3Tex(T.face[0]), m = new THREE.Matrix4();
  for (const r of fl.rooms) {
    const group = new THREE.Group(), canvas = roomCanvas(r), floorMat = new THREE.MeshLambertMaterial({ map: v3Tex(canvas) });
    const floor = new THREE.Mesh(V3_QUAD, floorMat);
    floor.rotation.x = -Math.PI / 2; floor.scale.set(r.w * TS, r.h * TS, 1);
    floor.position.set((r.x + r.w / 2) * TS, 0, (r.y + r.h / 2) * TS);
    group.add(floor);
    // every wall and wall-face tile stands up; the ones on the near side of a room stay low so they never hide it
    const tiles = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const t = tileAt(fl, x, y);
      if (t === TILE.WALL || t === TILE.FACE) tiles.push([x, y, v3Floorish(tileAt(fl, x, y - 1)) ? V3_WALL_LOW : V3_WALL]);
    }
    const sideMat = new THREE.MeshLambertMaterial({ map: face }), topMat = new THREE.MeshLambertMaterial({ map: top });
    const walls = new THREE.InstancedMesh(V3_BOX, [sideMat, sideMat, topMat, topMat, sideMat, sideMat], Math.max(1, tiles.length));
    tiles.forEach(([x, y, ht], i) => { m.makeScale(TS, ht, TS); m.setPosition(x * TS + TS / 2, 0, y * TS + TS / 2); walls.setMatrixAt(i, m); });
    walls.count = tiles.length;
    group.add(walls);
    level.add(group);
    V3.rooms.push({ r, group, canvas, floorMat, mats: [floorMat, sideMat, topMat] });
  }
  V3.scene.add(level);
}
// unseen rooms stay hidden and the rooms you are not in are dimmed; a repainted room picture is picked up
function v3SyncRooms() {
  for (const e of V3.rooms) {
    const cur = e.r === G.room;
    e.group.visible = e.r.seen || cur;
    if (!e.group.visible) continue;
    for (const m of e.mats) m.color.setScalar(cur ? 1 : 0.45);
    const c = roomCanvas(e.r);
    if (c !== e.canvas) { e.canvas = c; e.floorMat.map.image = c; e.floorMat.map.needsUpdate = true; }
  }
}
// shut doors stand as boxes across the gap
function v3SyncDoors(on) {
  const fl = G.fl;
  let n = 0;
  if (on) for (const d of fl.doors) {
    if (d.hidden || (d.open && !d.locked) || (!fl.rooms[d.a].seen && !fl.rooms[d.b].seen)) continue;
    for (const [x, y] of d.tiles) {
      let b = V3.doors[n];
      if (!b) { b = new THREE.Mesh(V3_BOX, new THREE.MeshLambertMaterial()); V3.doors.push(b); V3.scene.add(b); }
      b.material.color.set(d.kind === 'boss' ? '#5a2420' : d.locked ? '#8a6a2a' : '#6a4426');
      b.scale.set(d.dir === 'v' ? 6 : TS, 20, d.dir === 'v' ? TS : 6);
      b.position.set(x * TS + TS / 2, 0, y * TS + TS / 2);
      b.visible = true; n++;
    }
  }
  for (let i = n; i < V3.doors.length; i++) V3.doors[i].visible = false;
}

/* ---------- the camera, and where a point on the screen falls on the floor ---------- */
function v3Camera() {
  const cam = V3.camera, D = R.VH * V3_BACK, k = 0.5 / V3_BACK, aspect = R.VW / R.VH, n = cam.near;
  const tx = G.cam.x + G.cam.sx, ty = G.cam.y + G.cam.sy;
  cam.position.set(tx, D * V3_TILT, ty + D);
  cam.updateMatrixWorld();
  // the frustum is centred on the slope down to the target, k either side: one world pixel there is one view pixel
  cam.projectionMatrix.makePerspective(-n * k * aspect, n * k * aspect, n * (k - V3_TILT), n * (-k - V3_TILT), n, cam.far);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
}
function screenToWorld(mx, my) {
  if (!V3.renderer) return { x: G.cam.x, y: G.cam.y };
  V3.ray.setFromCamera(new THREE.Vector2((mx / R.cssW) * 2 - 1, -(my / R.cssH) * 2 + 1), V3.camera);
  const hit = V3.ray.ray.intersectPlane(V3.plane, V3.v);
  return hit ? { x: hit.x, y: hit.z } : { x: G.cam.x, y: G.cam.y };
}
// a point on the floor (lifted by up), in view pixels
function v3Project(x, y, up = 0) {
  const v = V3.v.set(x, up, y).project(V3.camera);
  return { x: ((v.x + 1) / 2) * R.VW, y: ((1 - v.y) / 2) * R.VH, behind: v.z > 1 };
}

/* ---------- light ---------- */
function v3Light(L, dark, tint) {
  V3.ambient.intensity = 0.35 + (1 - dark) * 1.1;
  V3.ambient.color.set(tint);
  const p = G.p;
  L.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  R.lights = L;
  V3.lights.forEach((l, i) => {
    const s = L[i];
    if (!s) { l.intensity = 0; return; }
    l.color.set(s.c); l.position.set(s.x, 22, s.y); l.distance = s.r * 2.2;
    l.intensity = (0.9 + s.a * 4) * s.r * (i === 0 ? 1.4 : 1);
  });
}

/* ---------- cards: things stood upright ---------- */
// each is painted by its pixel painter onto a canvas of its own. A card whose look has not changed
// since the last frame (same key) is only moved, not repainted.
function v3Card(id, x, y, w, hgt, below, paint, look) {
  let c = V3.cards.get(id);
  if (!c || c.w !== w || c.hgt !== hgt) {
    if (c) v3DropCard(id, c);
    const cv = mkCanvas(w, hgt), tex = v3Tex(cv);
    const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.04, depthWrite: false, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.28 });
    const mesh = new THREE.Mesh(V3_QUAD, mat);
    mesh.scale.set(w, hgt, 1);
    V3.scene.add(mesh);
    c = { cv, g: cv.getContext('2d'), tex, mesh, w, hgt, look: undefined };
    V3.cards.set(id, c);
  }
  c.used = V3.frame;
  c.mesh.position.set(x, hgt / 2 - below, y);
  c.mesh.visible = true;
  if (look !== undefined && look === c.look) return;
  c.look = look;
  const g = c.g, cx = x - w / 2, cy = y - (hgt - below);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, hgt);
  // painters draw as if the canvas's corner were here, which puts the feet at the card's anchor
  R.ox = cx; R.oy = cy;
  paint(g, cx, cy);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  c.tex.needsUpdate = true;
}
function v3DropCard(id, c) { V3.scene.remove(c.mesh); c.mesh.material.dispose(); c.tex.dispose(); V3.cards.delete(id); }
// painters cull against the view; a card is the whole view while it is painted, and its shadows go to the floor
function v3PaintCards(fn) {
  const vw = R.VW, vh = R.VH, ox = R.ox, oy = R.oy;
  R.VW = 512; R.VH = 512; R.shadows = [];
  try { fn(); } finally { R.VW = vw; R.VH = vh; R.ox = ox; R.oy = oy; }
  const shadows = R.shadows; R.shadows = null;
  for (const [id, c] of V3.cards) {
    if (c.used === V3.frame) continue;
    c.mesh.visible = false;
    if (V3.frame - c.used > 240) v3DropCard(id, c);
  }
  return shadows;
}
const v3HeroCard = (p) => v3Card(p, p.x, p.y, 128, 128, 18, (g, cx, cy) => {
  if (p.mounted && !p.dead) { drawMount(g, p, cx, cy); const z0 = p.z; p.z = (z0 || 0) + 9; drawPlayer(g, p, cx, cy); p.z = z0; } else drawPlayer(g, p, cx, cy);
});
const v3EntCard = (e) => { const s = e.boss ? 320 : e.big || (e.scale || 1) > 1.3 ? 192 : 112; v3Card(e, e.x, e.y, s, s, e.boss ? 48 : 14, (g, cx, cy) => drawEnt(g, e, cx, cy)); };
function v3DeepCards(vis) {
  const fl = G.fl, rid = G.room ? G.room.id : -1;
  return v3PaintCards(() => {
    for (const r of vis) for (const pid of r.props) {
      const pr = fl.props[pid];
      if (!pr.decal && pr.kind !== 'stairs' && pr.kind !== 'spikes' && !pr.broken) v3Card(pr, pr.x, pr.y, 64, 72, 12, (g, cx, cy) => drawProp(g, pr, cx, cy));
    }
    for (const e of G.ents) if (!e.dead && (e.room === rid || e.boss)) v3EntCard(e);
    for (const it of G.items) v3Card(it, it.x, it.y, 48, 48, 10, (g, cx, cy) => drawItem(g, it, cx, cy));
    for (const k of G.picks) v3Card(k, k.x, k.y, 32, 32, 8, (g, cx, cy) => drawPick(g, k, cx, cy));
    v3HeroCard(G.p);
  });
}
// objects that look the same frame to frame; the rest (fires, glowing stones, things you can use) repaint
// a short name for each sprite, so a card can tell whether its picture changed
const V3_SPRITE_IDS = new WeakMap();
const v3SpriteId = (sp) => V3_SPRITE_IDS.get(sp) || (V3_SPRITE_IDS.set(sp, V3_SPRITE_IDS.size + 1), V3_SPRITE_IDS.get(sp));
const V3_STILL = new Set(['tree', 'boulder', 'building', 'mark', 'menhir', 'stall', 'tower', 'well', 'lamp', 'chest', 'fence', 'rock', 'bush', 'grave', 'statue']);
function v3RealmCards(x0, y0, x1, y1) {
  const Z = W.Z, b = Z.b, p = G.p, day = Math.round(daylight() * 8);
  const near = (o, sp) => !p.dead && p.y < o.y - 2 && p.y > o.y - sp.ay + 4 && Math.abs(p.x - o.x) < sp.w * 0.42;
  const inView = (x, y) => x > x0 && x < x1 && y > y0 && y < y1;
  return v3PaintCards(() => {
    for (let cy = Math.max(0, Math.floor(y0 / TS / ZCH)); cy <= Math.min(ZCN - 1, Math.floor(y1 / TS / ZCH)); cy++)
      for (let cx = Math.max(0, Math.floor(x0 / TS / ZCH)); cx <= Math.min(ZCN - 1, Math.floor(x1 / TS / ZCH)); cx++)
        for (const o of Z.objs[cy * ZCN + cx]) {
          if (!inView(o.x, o.y)) continue;
          const sp = objSprite(o, b);
          if (!sp) continue;
          const faded = (o.kind === 'tree' || o.kind === 'building' || o.kind === 'tower' || o.kind === 'mark') && near(o, sp);
          const still = V3_STILL.has(o.kind) || (o.kind === 'lw' && !o.actor && !o.id);
          const w = 2 * Math.max(sp.ax, sp.w - sp.ax) + 8, below = Math.max(8, sp.h - sp.ay + 6);
          v3Card(o, o.x, o.y, w, sp.ay + 10 + below, below, (g, cx2, cy2) => drawRealmObj(g, o, sp, cx2, cy2, faded), still ? `${v3SpriteId(sp)}:${faded}:${o.kind === 'building' ? day : ''}` : undefined);
        }
    for (const e of G.ents) if (!e.dead && inView(e.x, e.y)) v3EntCard(e);
    for (const n of W.npcs) if (inView(n.x, n.y)) v3Card(n, n.x, n.y, 176, 128, 12, (g, cx, cy) => drawNpc(g, n, cx, cy));
    if (typeof mmoGhosts === 'function') for (const q of mmoGhosts()) if (inView(q.x, q.y)) v3Card(q, q.x, q.y, 128, 128, 18, (g, cx, cy) => drawGhostPlayer(g, q, cx, cy));
    for (const it of G.items) v3Card(it, it.x, it.y, 48, 48, 10, (g, cx, cy) => drawItem(g, it, cx, cy));
    for (const k of G.picks) v3Card(k, k.x, k.y, 32, 32, 8, (g, cx, cy) => drawPick(g, k, cx, cy));
    v3HeroCard(p);
  });
}

/* ---------- what lies on the floor: the ground, then effects ---------- */
// the floor the camera sees reaches much further north than south, and widens with distance
function v3FloorRect() {
  const Wd = Math.ceil(R.VW * 1.9), Hd = Math.ceil(R.VH * 1.6);
  return { Wd, Hd, ox: Math.round(G.cam.x - Wd / 2), oy: Math.round(G.cam.y - Hd * 0.72) };
}
function v3Floor({ Wd, Hd, ox, oy }, paintGround, shadows) {
  for (const L of [V3.ground, V3.fx]) {
    if (L.c.width !== Wd || L.c.height !== Hd) { L.c.width = Wd; L.c.height = Hd; L.tex.dispose(); L.mesh.material.map = L.tex = v3Tex(L.c); L.g = L.c.getContext('2d'); }
    L.g.setTransform(1, 0, 0, 1, 0, 0); L.g.globalAlpha = 1; L.g.globalCompositeOperation = 'source-over'; L.g.clearRect(0, 0, Wd, Hd);
    L.mesh.scale.set(Wd, Hd, 1); L.mesh.position.set(ox + Wd / 2, L === V3.ground ? 0.3 : 0.6, oy + Hd / 2);
    L.tex.needsUpdate = true;
  }
  // painters cull against the view, and effects place themselves from R.ox, R.oy
  const vw = R.VW, vh = R.VH;
  R.VW = Wd; R.VH = Hd; R.ox = ox; R.oy = oy;
  try {
    const g = V3.ground.g;
    paintGround(g, ox, oy);
    runHooks('renderFloor', g, ox, oy, []);
    for (const f of G.fx) if (GROUND_FX[f.kind]) GROUND_FX[f.kind](g, f, ox, oy);
    for (const f of G.fx) if (f.kind === 'corpse' && f.sp) drawCorpse(g, f, ox, oy);
    for (const [x, y, rx, ry, a] of shadows) { g.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`; g.beginPath(); g.ellipse(Math.round(x - ox), Math.round(y - oy), rx, ry, 0, 0, TAU); g.fill(); }
    for (const e of G.ents) if (!e.hidden && !e.dead) shadow(g, e.x - ox, e.y - oy, e.r * (e.scale || 1) * (e.boss ? 1.4 : 1.1), e.z || 0);
    shadow(g, G.p.x - ox, G.p.y - oy, 6 + ascStage(G.p) * 0.8 + (G.p.mounted ? 4 : 0), G.p.z || 0);
    const f = V3.fx.g;
    for (const pr of G.projs) drawProj(f, pr, ox, oy);
    drawParticles(f, ox, oy, false);
    runHooks('renderWorld', f, ox, oy);
    for (const q of G.fx) if (TOP_FX[q.kind]) TOP_FX[q.kind](f, q, ox, oy);
    for (const q of G.fx) if (q.kind === 'tele') drawTele(f, q, ox, oy);
    drawGlow(f, ox, oy);
    drawParticles(f, ox, oy, true);
    runHooks('renderTop', f, ox, oy);
    fxPaint(f);
  } finally { R.VW = vw; R.VH = vh; }
}
function v3DeepGround(vis) {
  const fl = G.fl, T = getTileset(fl.actIdx);
  return (g, ox, oy) => {
    const fr = Math.floor(G.t * 3) % 4;
    R.lavaLights = [];
    for (let y = Math.max(0, Math.floor(oy / TS)); y <= Math.min(fl.H - 1, Math.ceil((oy + R.VH) / TS)); y++) for (let x = Math.max(0, Math.floor(ox / TS)); x <= Math.min(fl.W - 1, Math.ceil((ox + R.VW) / TS)); x++) {
      const t = fl.tiles[y * fl.W + x];
      if (t === TILE.LAVA) { g.drawImage(T.lava[(fr + x + y) % 4], x * TS - ox, y * TS - oy); if ((x + y) % 2 === 0) R.lavaLights.push([x * TS + 8, y * TS + 8]); }
      else if (t === TILE.TOXIC) g.drawImage(T.toxic[(fr + x * 3 + y) % 4], x * TS - ox, y * TS - oy);
    }
    drawDoors(g, ox, oy);
    for (const r of vis) for (const pid of r.props) { const pr = fl.props[pid]; if (pr.decal || pr.kind === 'stairs' || pr.kind === 'spikes') drawFlatProp(g, pr, ox, oy); }
  };
}

/* ---------- what stays flat on the glass: numbers, bars, names, speech, weather ---------- */
function v3Ui(realm, tone) {
  const ui = V3.ui, g = V3.ug, VW = R.VW, VH = R.VH;
  if (ui.width !== VW || ui.height !== VH) { ui.width = VW; ui.height = VH; }
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, VW, VH);
  if (tone) { g.fillStyle = tone; g.fillRect(0, 0, VW, VH); }
  if (G.mode === 'play' || G.demo) drawWeather(g);
  const rid = G.room ? G.room.id : -1;
  for (const e of G.ents) {
    if (e.dead || (!realm && e.room !== rid)) continue;
    const q = v3Project(e.x, e.y);
    if (q.behind || q.x < -40 || q.x > VW + 40 || q.y < -40 || q.y > VH + 60) continue;
    drawEntOverlay(g, e, e.x - q.x, e.y - q.y);
    if (realm) drawRealmLabel(g, e, q.x, q.y);
  }
  if (realm && W.say) { const q = v3Project(W.say.npc.x, W.say.npc.y); drawSpeech(g, W.say.text, q.x, q.y); }
  for (const t of G.texts) {
    const q = v3Project(t.x, t.y, 6);
    if (q.behind) continue;
    const c = pixelText(t.str, t.color, t.big ? 2 : 1), age = t.max - t.life, pop = age < 0.12 ? 1 + (1 - age / 0.12) * (t.big ? 0.7 : 0.45) : 1;
    const w2 = Math.round(c.width * pop), h2 = Math.round(c.height * pop);
    g.globalAlpha = clamp(t.life / (t.max * 0.4), 0, 1);
    g.drawImage(c, Math.round(q.x - w2 / 2), Math.round(q.y - h2 / 2), w2, h2);
  }
  g.globalAlpha = 1;
  if (G.hurtFlash > 0) { const grd = g.createRadialGradient(VW / 2, VH / 2, VH * 0.2, VW / 2, VH / 2, VH * 0.8); grd.addColorStop(0, 'rgba(180,20,30,0)'); grd.addColorStop(1, `rgba(180,20,30,${(G.hurtFlash * 0.9).toFixed(3)})`); g.fillStyle = grd; g.fillRect(0, 0, VW, VH); }
  if (G.p.hp > 0 && G.p.hp / G.p.maxHp < 0.25) { const a = 0.18 + Math.sin(G.t * 6) * 0.08, grd = g.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.85); grd.addColorStop(0, 'rgba(120,0,10,0)'); grd.addColorStop(1, `rgba(120,0,10,${a.toFixed(3)})`); g.fillStyle = grd; g.fillRect(0, 0, VW, VH); }
  if (G.warp > 0) { g.fillStyle = 'rgba(255,220,120,0.08)'; g.fillRect(0, 0, VW, VH); }
}

/* ---------- the frame ---------- */
function render() {
  if (!V3.renderer && !v3Init()) return;
  V3.frame++;
  const fl = G.fl, size = V3.renderer.getSize(V3.size), w = R.VW * V3_RES, hh = R.VH * V3_RES;
  if (size.x !== w || size.y !== hh) V3.renderer.setSize(w, hh, false);
  const realm = !!(W.on && !W.inInst && fl && fl.realm && W.Z && G.p), deep = !realm && !!(fl && fl.rooms && G.p);
  if (V3.level) V3.level.visible = deep;
  v3SyncDoors(deep);
  if (!realm && !deep) { for (const c of V3.cards.values()) c.mesh.visible = false; V3.ground.mesh.visible = V3.fx.mesh.visible = false; V3.ug && V3.ug.clearRect(0, 0, V3.ui.width, V3.ui.height); V3.renderer.render(V3.scene, V3.camera); return; }
  V3.ground.mesh.visible = V3.fx.mesh.visible = true;
  R.camX = G.cam.x; R.camY = G.cam.y;
  v3Camera();
  const rect = v3FloorRect();
  let tone = null;
  if (deep) {
    if (V3.fl !== fl) v3BuildLevel();
    v3SyncRooms();
    const vis = fl.rooms.filter((r) => r.seen || r === G.room), A = ACTS[fl.actIdx];
    const shadows = v3DeepCards(vis);
    v3Floor(rect, v3DeepGround(vis), shadows);
    v3Light(lightSources(vis), clamp(A.dark[3] * (CD.settings.bright ? 0.75 : 1) * (G.darkMul || 1), 0, 0.96), G.darkTint || '#b8b0c8');
  } else {
    const shadows = v3RealmCards(rect.ox - 80, rect.oy - 40, rect.ox + rect.Wd + 80, rect.oy + rect.Hd + 140);
    v3Floor(rect, (g, ox, oy) => realmGround(g, ox, oy, R.VW, R.VH), shadows);
    const S = realmLights(rect.ox, rect.oy, rect.Wd, rect.Hd), [r, gg, b] = S.tint, k = S.dark;
    v3Light(S.L, S.dark, `rgb(${Math.round(255 - (255 - r * 4) * k)},${Math.round(255 - (255 - gg * 4) * k)},${Math.round(255 - (255 - b * 4) * k)})`);
    if (S.dusk > 0) tone = `rgba(255,140,60,${(S.dusk * 0.1).toFixed(3)})`;
  }
  R.ox = Math.round(G.cam.x - R.VW / 2); R.oy = Math.round(G.cam.y - R.VH / 2);
  v3Ui(realm, tone);
  V3.renderer.render(V3.scene, V3.camera);
}
CD.renderer = { get status() { return { rooms: V3.rooms.length, cards: [...V3.cards.values()].filter((c) => c.mesh.visible).length, lights: V3.lights.filter((l) => l.intensity > 0).length, revision: THREE.REVISION }; } };
