/* ============================================================
   Cinderdeep — the 3D view. three.js draws the dungeon as a lit
   space: rooms become floors, walls stand up, shut doors block,
   and torches, lava and spells cast real light. Heroes, monsters,
   props and loot keep their painted sprites, stood upright in the
   scene, so everything the 2D painters know (held weapons, rigs,
   tints, elements) carries over. The simulation is unchanged: this
   is a renderer, and the Realm still draws in 2D for now.
   ============================================================ */
DEFAULT_SETTINGS.view3d = true;
const V3 = {
  ok: typeof THREE !== 'undefined', failed: false, live: false, frame: 0,
  renderer: null, scene: null, camera: null, canvas: null, ui: null, ug: null,
  fl: null, level: null, rooms: [], doors: [], lights: [], bills: new Map(), mats: {},
  ground: null, fx: null, ray: null, plane: null, v: null,
};
// The camera looks straight ahead with its lens shifted down, as architects photograph
// buildings: upright things stay upright anywhere on screen and sprites keep their painted size.
const V3_TILT = 0.8; // how far the floor recedes: its depth shows at this fraction of its width
const V3_BACK = 1.4; // camera distance in screen heights; further is flatter, nearer is more dramatic
const V3_WALL = 26, V3_WALL_LOW = 7; // wall heights in world pixels; the low ones are between you and the room
const V3_LIGHTS = 10; // a fixed number, so lighting never recompiles shaders mid-fight
const V3_RES = 2; // the 3D image is drawn at this many times the pixel canvas, then scaled up crisp

function v3Wanted() {
  return CD.settings.view3d !== false && V3.ok && !V3.failed && G.fl && G.fl.rooms && !G.fl.realm && G.p
    && !(typeof DIORAMA !== 'undefined' && DIORAMA.active);
}
function v3Init() {
  if (V3.renderer || V3.failed) return !!V3.renderer;
  try {
    const css = { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'none', pointerEvents: 'none', imageRendering: 'pixelated' };
    V3.canvas = h('canvas', { id: 'screen3d', 'aria-hidden': 'true', style: css });
    V3.ui = h('canvas', { id: 'screen3d-ui', 'aria-hidden': 'true', style: css });
    R.screen.after(V3.canvas); V3.canvas.after(V3.ui);
    V3.ug = V3.ui.getContext('2d');
    const r = new THREE.WebGLRenderer({ canvas: V3.canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    r.setPixelRatio(1);
    V3.renderer = r;
    V3.scene = new THREE.Scene();
    V3.scene.background = new THREE.Color('#050305');
    V3.camera = new THREE.PerspectiveCamera(30, 16 / 9, 4, 6000);
    V3.ambient = new THREE.AmbientLight('#ffffff', 1); V3.scene.add(V3.ambient);
    for (let i = 0; i < V3_LIGHTS; i++) { const l = new THREE.PointLight('#ffffff', 0, 100, 1); V3.lights.push(l); V3.scene.add(l); }
    V3.ray = new THREE.Raycaster(); V3.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); V3.v = new THREE.Vector3();
    V3.ground = v3Layer(true, -2); V3.fx = v3Layer(false, -1);
    V3.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); V3.failed = true; v3Show(false); });
    return true;
  } catch (e) {
    console.warn('3D view unavailable, staying in 2D', e);
    V3.failed = true;
    if (V3.canvas) V3.canvas.remove();
    if (V3.ui) V3.ui.remove();
    V3.renderer = null;
    return false;
  }
}
function v3Show(on) {
  V3.live = on;
  if (V3.canvas) V3.canvas.style.display = on ? 'block' : 'none';
  if (V3.ui) V3.ui.style.display = on ? 'block' : 'none';
}
const v3Tex = (c) => { const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; return t; };
// a canvas laid flat on the floor around the camera: lit for the ground, unlit for effects
function v3Layer(lit, order) {
  const c = mkCanvas(8, 8), g = c.getContext('2d'), tex = v3Tex(c);
  const o = { map: tex, transparent: true, depthWrite: false };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), lit ? new THREE.MeshLambertMaterial(o) : new THREE.MeshBasicMaterial(o));
  mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = order;
  V3.scene.add(mesh);
  return { c, g, tex, mesh, ox: 0, oy: 0 };
}

/* ---------- the level: a floor and walls for every room ---------- */
const v3Floorish = (t) => t === TILE.FLOOR || t === TILE.ICE || t === TILE.TOXIC || t === TILE.LAVA || t === TILE.SPIKE || t === TILE.PIT || t === TILE.DOOR || t === TILE.ROCK;
function v3Dispose(obj) {
  obj.traverse((o) => {
    if (o.geometry && !o.geometry._shared) o.geometry.dispose();
    for (const m of [].concat(o.material || [])) { if (m.map) m.map.dispose(); m.dispose(); }
  });
}
// shared unit shapes, scaled per use: a box standing on the floor, and a flat card
const V3_BOX = V3.ok ? new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0) : null;
const V3_QUAD = V3.ok ? new THREE.PlaneGeometry(1, 1) : null;
if (V3.ok) V3_BOX._shared = V3_QUAD._shared = true;
function v3BuildLevel() {
  if (V3.level) { V3.scene.remove(V3.level); v3Dispose(V3.level); }
  const fl = G.fl, T = getTileset(fl.actIdx), level = new THREE.Group();
  V3.level = level; V3.fl = fl; V3.rooms = [];
  const top = v3Tex(T.top), faces = T.face.map(v3Tex);
  for (const r of fl.rooms) {
    const group = new THREE.Group(), canvas = roomCanvas(r);
    const floorMat = new THREE.MeshLambertMaterial({ map: v3Tex(canvas) });
    const floor = new THREE.Mesh(V3_QUAD, floorMat);
    floor.rotation.x = -Math.PI / 2; floor.scale.set(r.w * TS, r.h * TS, 1);
    floor.position.set((r.x + r.w / 2) * TS, 0, (r.y + r.h / 2) * TS);
    group.add(floor);
    // walls: every wall and wall-face tile stands up; the ones on the near side of a room stay low so they never hide it
    const tiles = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const t = tileAt(fl, x, y);
      if (t !== TILE.WALL && t !== TILE.FACE) continue;
      tiles.push([x, y, v3Floorish(tileAt(fl, x, y - 1)) ? V3_WALL_LOW : V3_WALL, fl.vari[y * fl.W + x]]);
    }
    const sideMat = new THREE.MeshLambertMaterial({ map: faces[0] }), topMat = new THREE.MeshLambertMaterial({ map: top });
    const walls = new THREE.InstancedMesh(V3_BOX, [sideMat, sideMat, topMat, topMat, sideMat, sideMat], Math.max(1, tiles.length));
    const m = new THREE.Matrix4();
    tiles.forEach(([x, y, ht], i) => { m.makeScale(TS, ht, TS); m.setPosition(x * TS + TS / 2, 0, y * TS + TS / 2); walls.setMatrixAt(i, m); });
    walls.count = tiles.length;
    group.add(walls);
    level.add(group);
    V3.rooms.push({ r, group, canvas, floorMat, mats: [floorMat, sideMat, topMat] });
  }
  V3.scene.add(level);
}
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
function v3SyncDoors() {
  const fl = G.fl;
  let n = 0;
  for (const d of fl.doors) {
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

/* ---------- the camera, and where the mouse points on the floor ---------- */
function v3Camera() {
  const cam = V3.camera, D = R.VH * V3_BACK, k = 0.5 / V3_BACK, aspect = R.VW / R.VH, n = cam.near;
  const tx = G.cam.x + G.cam.sx, ty = G.cam.y + G.cam.sy;
  cam.position.set(tx, D * V3_TILT, ty + D);
  cam.rotation.set(0, 0, 0);
  cam.updateMatrixWorld();
  // the frustum is centred on the slope down to the target, k either side: one world pixel there is one screen pixel
  cam.projectionMatrix.makePerspective(-n * k * aspect, n * k * aspect, n * (k - V3_TILT), n * (-k - V3_TILT), n, cam.far);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  return D;
}
const _screenToWorld3d = screenToWorld;
screenToWorld = function (mx, my) {
  if (!V3.live) return _screenToWorld3d(mx, my);
  V3.ray.setFromCamera(new THREE.Vector2((mx / R.cssW) * 2 - 1, -(my / R.cssH) * 2 + 1), V3.camera);
  const hit = V3.ray.ray.intersectPlane(V3.plane, V3.v);
  return hit ? { x: hit.x, y: hit.z } : _screenToWorld3d(mx, my);
};
// a point on the floor, in pixels of the 2D canvas
function v3Project(x, y, up = 0) {
  const v = V3.v.set(x, up, y).project(V3.camera);
  return { x: ((v.x + 1) / 2) * R.VW, y: ((1 - v.y) / 2) * R.VH, behind: v.z > 1 };
}

/* ---------- light ---------- */
function v3Light(vis) {
  const A = ACTS[G.fl.actIdx], dark = clamp(A.dark[3] * (CD.settings.bright ? 0.75 : 1) * (G.darkMul || 1), 0, 0.96);
  V3.ambient.intensity = 0.35 + (1 - dark) * 1.1;
  V3.ambient.color.set(G.darkTint || '#b8b0c8');
  const L = lightSources(vis), p = G.p;
  R.lights = L;
  L.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  V3.lights.forEach((l, i) => {
    const s = L[i];
    if (!s) { l.intensity = 0; return; }
    l.color.set(s.c); l.position.set(s.x, 22, s.y); l.distance = s.r * 2.2;
    l.intensity = (0.9 + s.a * 4) * s.r * (i === 0 ? 1.4 : 1);
  });
}

/* ---------- sprites stood upright ---------- */
// each thing is painted by its 2D painter into a canvas of its own, which becomes an upright card in the scene
function v3Bill(key, w, hgt, below) {
  let b = V3.bills.get(key);
  if (!b || b.w !== w || b.hgt !== hgt) {
    if (b) v3DropBill(key, b);
    const c = mkCanvas(w, hgt), tex = v3Tex(c);
    const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.04, depthWrite: false, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.28 });
    const mesh = new THREE.Mesh(V3_QUAD, mat);
    mesh.scale.set(w, hgt, 1);
    V3.scene.add(mesh);
    b = { c, g: c.getContext('2d'), tex, mesh, w, hgt, below };
    V3.bills.set(key, b);
  }
  b.used = V3.frame;
  return b;
}
function v3DropBill(key, b) { V3.scene.remove(b.mesh); b.mesh.material.dispose(); b.tex.dispose(); V3.bills.delete(key); }
function v3Card(key, x, y, w, hgt, draw, below = 10) {
  const b = v3Bill(key, w, hgt, below), g = b.g;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, hgt);
  // the painter draws as if the camera's corner were here, which puts the feet at the card's anchor
  draw(g, x - w / 2, y - (hgt - below));
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  b.tex.needsUpdate = true;
  b.mesh.position.set(x, hgt / 2 - below, y);
  b.mesh.visible = true;
  b.mesh.renderOrder = 0;
}
function v3Cards(vis) {
  const fl = G.fl, room = G.room, rid = room ? room.id : -1;
  // painters cull against the view; a card is the whole view while it is painted
  const vw = R.VW, vh = R.VH;
  R.VW = 512; R.VH = 512;
  try {
    for (const r of vis) for (const pid of r.props) {
      const pr = fl.props[pid];
      if (pr.decal || pr.kind === 'stairs' || pr.kind === 'spikes' || pr.broken) continue;
      v3Card(pr, pr.x, pr.y, 64, 72, (g, cx, cy) => drawProp(g, pr, cx, cy), 12);
    }
    for (const e of G.ents) {
      if (e.dead || !(e.room === rid || e.boss)) continue;
      const big = e.boss ? 320 : e.big || (e.scale || 1) > 1.3 ? 192 : 112;
      v3Card(e, e.x, e.y, big, big, (g, cx, cy) => drawEnt(g, e, cx, cy), e.boss ? 48 : 14);
    }
    for (const it of G.items) v3Card(it, it.x, it.y, 48, 48, (g, cx, cy) => drawItem(g, it, cx, cy), 10);
    for (const k of G.picks) v3Card(k, k.x, k.y, 32, 32, (g, cx, cy) => drawPick(g, k, cx, cy), 8);
    const p = G.p;
    v3Card(p, p.x, p.y, 128, 128, (g, cx, cy) => drawPlayer(g, p, cx, cy), 18);
  } finally { R.VW = vw; R.VH = vh; }
  for (const [key, b] of V3.bills) {
    if (b.used === V3.frame) continue;
    b.mesh.visible = false;
    if (V3.frame - b.used > 240) v3DropBill(key, b);
  }
}

/* ---------- what lies on the floor: the ground, then effects ---------- */
function v3Ground(vis, D) {
  // the floor the camera sees reaches much further north than south, and widens with distance
  const Wd = Math.ceil(R.VW * 1.9), Hd = Math.ceil(R.VH * 1.6), ox = Math.round(G.cam.x - Wd / 2), oy = Math.round(G.cam.y - Hd * 0.72);
  const fl = G.fl, T = getTileset(fl.actIdx), room = G.room, rid = room ? room.id : -1;
  for (const L of [V3.ground, V3.fx]) {
    if (L.c.width !== Wd || L.c.height !== Hd) { L.c.width = Wd; L.c.height = Hd; L.tex.dispose(); L.mesh.material.map = L.tex = v3Tex(L.c); L.g = L.c.getContext('2d'); }
    L.g.setTransform(1, 0, 0, 1, 0, 0); L.g.globalAlpha = 1; L.g.globalCompositeOperation = 'source-over'; L.g.clearRect(0, 0, Wd, Hd);
    L.mesh.scale.set(Wd, Hd, 1); L.mesh.position.set(ox + Wd / 2, L === V3.ground ? 0.3 : 0.6, oy + Hd / 2);
    L.tex.needsUpdate = true;
  }
  const vw = R.VW, vh = R.VH, rox = R.ox, roy = R.oy;
  R.VW = Wd; R.VH = Hd; R.ox = ox; R.oy = oy;
  try {
    const g = V3.ground.g;
    const fr = Math.floor(G.t * 3) % 4;
    R.lavaLights = [];
    for (let y = Math.max(0, Math.floor(oy / TS)); y <= Math.min(fl.H - 1, Math.ceil((oy + Hd) / TS)); y++) for (let x = Math.max(0, Math.floor(ox / TS)); x <= Math.min(fl.W - 1, Math.ceil((ox + Wd) / TS)); x++) {
      const t = fl.tiles[y * fl.W + x];
      if (t === TILE.LAVA) { g.drawImage(T.lava[(fr + x + y) % 4], x * TS - ox, y * TS - oy); if ((x + y) % 2 === 0) R.lavaLights.push([x * TS + 8, y * TS + 8]); }
      else if (t === TILE.TOXIC) g.drawImage(T.toxic[(fr + x * 3 + y) % 4], x * TS - ox, y * TS - oy);
    }
    drawDoors(g, ox, oy);
    for (const r of vis) for (const pid of r.props) { const pr = fl.props[pid]; if (pr.decal || pr.kind === 'stairs' || pr.kind === 'spikes') drawFlatProp(g, pr, ox, oy); }
    runHooks('renderFloor', g, ox, oy, vis);
    for (const f of G.fx) if (GROUND_FX[f.kind]) GROUND_FX[f.kind](g, f, ox, oy);
    for (const f of G.fx) if (f.kind === 'corpse' && f.sp) drawCorpse(g, f, ox, oy);
    for (const e of G.ents) if (e.room === rid && !e.hidden && !e.dead) shadow(g, e.x - ox, e.y - oy, e.r * (e.scale || 1) * (e.boss ? 1.4 : 1.1), e.z || 0);
    shadow(g, G.p.x - ox, G.p.y - oy, 6, G.p.z || 0);
    const f = V3.fx.g;
    for (const pr of G.projs) drawProj(f, pr, ox, oy);
    drawParticles(f, ox, oy, false);
    runHooks('renderWorld', f, ox, oy);
    for (const q of G.fx) if (TOP_FX[q.kind]) TOP_FX[q.kind](f, q, ox, oy);
    for (const q of G.fx) if (q.kind === 'tele') drawTele(f, q, ox, oy);
    drawGlow(f, ox, oy);
    drawParticles(f, ox, oy, true);
    runHooks('renderTop', f, ox, oy);
    // CinderFX sparks and rings land on the floor too
    if (typeof cfxEnabled === 'function' && cfxEnabled()) { const layer = cfxLayer(); f.drawImage(layer, 0, 0, Wd, Hd); }
  } finally { R.VW = vw; R.VH = vh; R.ox = rox; R.oy = roy; }
}

/* ---------- what stays flat on the glass: numbers, bars, warnings ---------- */
function v3Ui() {
  const ui = V3.ui, g = V3.ug;
  if (ui.width !== R.VW || ui.height !== R.VH) { ui.width = R.VW; ui.height = R.VH; }
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, R.VW, R.VH);
  const rid = G.room ? G.room.id : -1;
  for (const e of G.ents) {
    if (e.room !== rid || e.dead) continue;
    const q = v3Project(e.x, e.y);
    if (!q.behind) drawEntOverlay(g, e, e.x - q.x, e.y - q.y);
  }
  for (const t of G.texts) {
    const q = v3Project(t.x, t.y, 6);
    if (q.behind) continue;
    const c = pixelText(t.str, t.color, t.big ? 2 : 1);
    g.globalAlpha = clamp(t.life / (t.max * 0.4), 0, 1);
    const age = t.max - t.life, pop = age < 0.12 ? 1 + (1 - age / 0.12) * (t.big ? 0.7 : 0.45) : 1;
    const w2 = Math.round(c.width * pop), h2 = Math.round(c.height * pop);
    g.drawImage(c, Math.round(q.x - w2 / 2), Math.round(q.y - h2 / 2), w2, h2);
  }
  g.globalAlpha = 1;
  const VW = R.VW, VH = R.VH;
  if (G.hurtFlash > 0) { const grd = g.createRadialGradient(VW / 2, VH / 2, VH * 0.2, VW / 2, VH / 2, VH * 0.8); grd.addColorStop(0, 'rgba(180,20,30,0)'); grd.addColorStop(1, `rgba(180,20,30,${(G.hurtFlash * 0.9).toFixed(3)})`); g.fillStyle = grd; g.fillRect(0, 0, VW, VH); }
  if (G.p.hp > 0 && G.p.hp / G.p.maxHp < 0.25) { const a = 0.18 + Math.sin(G.t * 6) * 0.08, grd = g.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.85); grd.addColorStop(0, 'rgba(120,0,10,0)'); grd.addColorStop(1, `rgba(120,0,10,${a.toFixed(3)})`); g.fillStyle = grd; g.fillRect(0, 0, VW, VH); }
  if (G.warp > 0) { g.fillStyle = 'rgba(255,220,120,0.08)'; g.fillRect(0, 0, VW, VH); }
}

/* ---------- the frame ---------- */
function render3d() {
  const fl = G.fl;
  V3.frame++;
  if (V3.fl !== fl) v3BuildLevel();
  const w = R.VW * V3_RES, hh = R.VH * V3_RES, size = V3.renderer.getSize(V3.v2 || (V3.v2 = new THREE.Vector2()));
  if (size.x !== w || size.y !== hh) V3.renderer.setSize(w, hh, false);
  R.camX = G.cam.x; R.camY = G.cam.y; R.ox = Math.round(G.cam.x - R.VW / 2); R.oy = Math.round(G.cam.y - R.VH / 2);
  const vis = fl.rooms.filter((r) => r.seen || r === G.room);
  const D = v3Camera();
  v3SyncRooms(); v3SyncDoors(); v3Light(vis);
  v3Ground(vis, D); v3Cards(vis); v3Ui();
  V3.renderer.render(V3.scene, V3.camera);
  // CinderFX grades the 2D picture; in 3D it would cover the scene, so it rests
  if (typeof CFX !== 'undefined' && CFX.canvas) CFX.canvas.hidden = true;
}
const _render3d = render;
render = function () {
  if (v3Wanted() && v3Init()) {
    try {
      render3d();
      if (!V3.live) v3Show(true);
      return;
    } catch (e) {
      // one bad frame should not cost the game its picture: fall back to 2D for the session
      console.error('3D view failed; drawing in 2D', e);
      V3.failed = true;
    }
  }
  if (V3.live) v3Show(false);
  return _render3d();
};
settingsRow('view3d', 5, () => h('label', { class: 'set-row' }, V3.ok && !V3.failed ? '3D view (dungeons; the Realm stays 2D for now)' : '3D view (not available on this device)',
  h('input', { type: 'checkbox', checked: CD.settings.view3d !== false, disabled: !V3.ok || V3.failed ? true : null, onchange: (e) => { CD.settings.view3d = e.target.checked; CD.save.settings = { ...CD.settings }; persist(); } })), true);
CD.view3d = { get status() { return { available: V3.ok && !V3.failed, live: V3.live, rooms: V3.rooms.length, cards: [...V3.bills.values()].filter((b) => b.mesh.visible).length, lights: V3.lights.filter((l) => l.intensity > 0).length, revision: V3.ok ? THREE.REVISION : null }; } };
