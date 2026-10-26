/* ============================================================
   Cinderdeep — the 3D renderer. three.js draws every place the
   game goes: dungeon rooms become floors with walls standing up,
   shut doors block their gaps, the Realm's land lies under its
   trees, buildings and people, and torches, lava, lamps and spells
   cast real light. Still things, props and loot are built from their
   pixel art into solid models; heroes and monsters are still painted
   onto cards that stand upright in the scene.
   The simulation is the same one either way: this only draws it.
   ============================================================ */
const V3 = {
  renderer: null, scene: null, camera: null, ui: null, ug: null, frame: 0,
  fl: null, level: null, rooms: [], doors: [], lights: [], cards: new Map(), casters: [],
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
// hot colours glow by themselves in the dark: fire, lava, lit windows, eyes and magic, but not white bone or pale cloth
const V3_SELF_GLOW = { value: 0 };
function v3SelfGlow(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.selfGlow = V3_SELF_GLOW;
    sh.fragmentShader = 'uniform float selfGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { vec3 t = diffuseColor.rgb; float hi = max(t.r, max(t.g, t.b)), sat = (hi - min(t.r, min(t.g, t.b))) / max(hi, 0.001);
        totalEmissiveRadiance += t * smoothstep(0.65, 0.95, hi) * smoothstep(0.7, 0.9, sat) * selfGlow; }`);
  };
  mat.customProgramCacheKey = () => 'v3-self-glow';
  return mat;
}
const v3Tex = (c) => { const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; return t; };
// a canvas laid flat on the floor around the camera: lit for the ground, unlit for effects
function v3Layer(lit, order) {
  const c = mkCanvas(8, 8), tex = v3Tex(c), o = { map: tex, transparent: true, depthWrite: false };
  const mesh = new THREE.Mesh(V3_QUAD, lit ? v3SelfGlow(new THREE.MeshLambertMaterial(o)) : new THREE.MeshBasicMaterial(o));
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
    const group = new THREE.Group(), canvas = roomCanvas(r), floorMat = v3SelfGlow(new THREE.MeshLambertMaterial({ map: v3Tex(canvas) }));
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
  // the dark falls off steeply, so night and deep dungeons belong to the lights; cards keep a little of their own glow
  const lit = Math.pow(1 - dark, 1.6);
  V3.ambient.intensity = 0.06 + lit * 1.4;
  V3.ambient.color.set(tint);
  const own = 0.06 + lit * 0.24;
  V3_SELF_GLOW.value = 0.9 * (1 - lit);
  V3_OWN_GLOW.value = own;
  if (own !== V3.ownGlow) { V3.ownGlow = own; for (const c of V3.cards.values()) if (!c.selfLit) c.mesh.material.emissiveIntensity = own; }
  const p = G.p;
  L.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  R.lights = L;
  V3.lights.forEach((l, i) => {
    const s = L[i];
    if (!s) { l.intensity = 0; return; }
    l.color.set(s.c); l.position.set(s.x, 22, s.y); l.distance = s.r * 2.2;
    // about one unit of light at a quarter of its radius, fading out by twice its radius, like the 2D light pools
    l.intensity = (0.45 + s.a * 1.9) * s.r * (i === 0 ? 1.3 : 1);
  });
}

/* ---------- cast shadows: the sun and moon in the Realm, the nearest flame below ground ---------- */
// a standing card lays a dark copy of its own picture on the floor, from its feet away from the light,
// longer the lower the light; it shares the card's texture, so it costs no painting. The picture is turned
// to face the light, as a body would, so a shadow thrown sideways is a figure and not a sliver
const V3_SHADE_M = new THREE.Matrix4();
function v3Shade(c, dx, dz, len, a) {
  if (!c.shade) {
    c.shade = new THREE.Mesh(V3_QUAD, new THREE.MeshBasicMaterial({ map: c.tex, color: 0x000000, transparent: true, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.02 }));
    c.shade.matrixAutoUpdate = false; c.shade.frustumCulled = false; c.shade.renderOrder = -1.5;
    V3.scene.add(c.shade);
  }
  const { w, hgt, below } = c, x = c.mesh.position.x, z = c.mesh.position.z, mid = hgt / 2 - below;
  // across the shadow, kept pointing east so the figure is never mirrored
  const k = -dz > 0 || (dz === 0 && dx > 0) ? 1 : -1, rx = -dz * k * w, rz = dx * k * w;
  V3_SHADE_M.set(rx, hgt * len * dx, 0, x + mid * len * dx, 0, 0, 1, 0.45, rz, hgt * len * dz, 0, z + mid * len * dz, 0, 0, 0, 1);
  c.shade.matrix.copy(V3_SHADE_M); c.shade.matrixWorldNeedsUpdate = true;
  c.shade.material.opacity = a; c.shade.visible = true; c.shadeF = V3.frame;
}
// the strongest nearby light that is not one the card carries; below ground the hero's light throws the monsters' shadows
function v3NearLight(c, L, skipHero) {
  const x = c.mesh.position.x, z = c.mesh.position.z;
  let best = null, bs = 0;
  for (let i = skipHero ? 1 : 0; i < Math.min(L.length, 8); i++) {
    const s = L[i], d = Math.hypot(x - s.x, z - s.y), reach = s.r * 1.6;
    if (d < 14 || d > reach) continue;
    const k = (s.a + 0.3) * (1 - d / reach);
    if (k > bs) { bs = k; best = { dx: (x - s.x) / d, dz: (z - s.y) / d, len: clamp(d / 22, 0.35, 2.2), a: clamp(k * 1.1, 0, 0.55) }; }
  }
  return best;
}
// a card is in the scene when its picture is, or the solid or model built in its place (whose shape its canvas still holds)
const v3Shown = (c) => c.mesh.visible || !!(c.vox && c.vox.visible) || !!(c.model && c.model.visible);
function v3Shadows(realm, dark) {
  const on = !CD.settings.lowFx;
  if (on) {
    let sun = null;
    if (realm) {
      // the sun crosses from the east at dawn to the west at dusk, south of overhead; the moon takes the same road by night
      const t = realmTime(), ph = (((t - 0.25) % 0.5) + 0.5) % 0.5 / 0.5, up = Math.sin(ph * Math.PI), day = daylight() > 0.5;
      const el = up * (day ? 1.2 : 0.9), dx = -Math.cos(ph * Math.PI), dz = -0.45, n = Math.hypot(dx, dz);
      sun = { dx: dx / n, dz: dz / n, len: clamp(1 / Math.tan(Math.max(0.05, el)), 0.45, 2.6), a: (day ? 0.4 : 0.14) * clamp((up - 0.06) * 5, 0, 1) };
    }
    for (const c of V3.casters) {
      if (!v3Shown(c)) continue;
      let s = sun;
      // at night, and always below ground, the lamps and torches throw the shadows
      if (!realm || dark > 0.3) { const near = v3NearLight(c, R.lights || [], realm); if (near && (!s || near.a > s.a)) s = near; }
      if (s && s.a > 0.02) v3Shade(c, s.dx, s.dz, s.len, s.a);
    }
  }
  let n = 0;
  for (const c of V3.cards.values()) if (c.shade) { if (c.shadeF !== V3.frame || !v3Shown(c)) c.shade.visible = false; else n++; }
  V3.shadeCount = n;
}

// distance fades into the dark below ground, and into a haze in the Realm that darkens with the night
function v3Fog(color, near, far) {
  const D = R.VH * V3_BACK * Math.hypot(1, V3_TILT);
  if (!V3.scene.fog) V3.scene.fog = new THREE.Fog(color, 1, 2);
  V3.scene.fog.color.set(color); V3.scene.fog.near = D * near; V3.scene.fog.far = D * far;
}

/* ---------- cards: things stood upright ---------- */
// each is painted by its pixel painter onto a canvas of its own. A card whose look has not changed
// since the last frame (same key) is only moved, not repainted.
function v3Card(id, x, y, w, hgt, below, paint, look) {
  let c = V3.cards.get(id);
  if (!c || c.w !== w || c.hgt !== hgt) {
    if (c) v3DropCard(id, c);
    const cv = mkCanvas(w, hgt), tex = v3Tex(cv);
    const mat = v3SelfGlow(new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.04, depthWrite: false, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: V3.ownGlow ?? 0.28 }));
    const mesh = new THREE.Mesh(V3_QUAD, mat);
    mesh.scale.set(w, hgt, 1);
    V3.scene.add(mesh);
    c = { cv, g: cv.getContext('2d'), tex, mesh, w, hgt, below, look: undefined };
    V3.cards.set(id, c);
  }
  c.used = V3.frame; c.below = below;
  c.mesh.position.set(x, hgt / 2 - below, y);
  c.mesh.visible = true;
  if (look !== undefined && look === c.look) return c;
  c.look = look;
  const g = c.g, cx = x - w / 2, cy = y - (hgt - below);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, hgt);
  // painters draw as if the canvas's corner were here, which puts the feet at the card's anchor
  R.ox = cx; R.oy = cy;
  paint(g, cx, cy);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  c.tex.needsUpdate = true;
  return c;
}
function v3DropCard(id, c) { V3.scene.remove(c.mesh); c.mesh.material.dispose(); if (c.vox) V3.scene.remove(c.vox); if (c.shade) { V3.scene.remove(c.shade); c.shade.material.dispose(); } c.tex.dispose(); V3.cards.delete(id); }
// painters cull against the view; a card is the whole view while it is painted, and its shadows go to the floor
function v3PaintCards(fn) {
  // too many models kept: let them go now, before this frame places any, and the solids that held them rebuild
  if (V3_SOLIDS.size > 600) { for (const g of V3_SOLIDS.values()) g.dispose(); V3_SOLIDS.clear(); for (const k of V3.cards.values()) if (k.vox) { k.vox.geometry = null; k.vox.visible = false; } }
  // the rig's models give off a little of their own colour, as cards do, a little more for their deeper shading
  if (rigmOn()) { RigShapes.flush(); RigShapes.ownLight(Math.min(0.6, V3_OWN_GLOW.value + 0.2)); }
  const vw = R.VW, vh = R.VH, ox = R.ox, oy = R.oy;
  R.VW = 512; R.VH = 512; R.shadows = []; V3.casters = [];
  // later modules stand their own things up here: card(id, x, y, w, hgt, below, paint)
  try { fn(); runHooks('renderCards', v3Card); } finally { R.VW = vw; R.VH = vh; R.ox = ox; R.oy = oy; }
  const shadows = R.shadows; R.shadows = null;
  for (const [id, c] of V3.cards) {
    if (c.used === V3.frame) continue;
    c.mesh.visible = false; if (c.vox) c.vox.visible = false;
    if (V3.frame - c.used > 240) v3DropCard(id, c);
  }
  rigmTidy();
  return shadows;
}
// cards that throw a shadow of their shape across the floor (see v3Shadows)
const v3Caster = (c) => { V3.casters.push(c); return c; };
// the hero stands as the rig's 3D model where it has one (59-rig-models.js); its card is painted all the same, for its shadow
const v3HeroCard = (p) => { const c = v3Caster(v3Card(p, p.x, p.y, 128, 128, 18, (g, cx, cy) => {
  if (p.mounted && !p.dead) { drawMount(g, p, cx, cy); const z0 = p.z; p.z = (z0 || 0) + 9; drawPlayer(g, p, cx, cy); p.z = z0; } else drawPlayer(g, p, cx, cy);
})); rigmHero(c, p); return c; };
const v3EntCard = (e) => { const s = e.boss ? 320 : e.big || (e.scale || 1) > 1.3 ? 192 : 112; v3Caster(v3Card(e, e.x, e.y, s, s, e.boss ? 48 : 14, (g, cx, cy) => drawEnt(g, e, cx, cy))); };
function v3DeepCards(vis) {
  const fl = G.fl, rid = G.room ? G.room.id : -1;
  return v3PaintCards(() => {
    for (const r of vis) for (const pid of r.props) {
      const pr = fl.props[pid];
      if (!pr.decal && pr.kind !== 'stairs' && pr.kind !== 'spikes' && !pr.broken) v3PropCard(pr);
    }
    for (const e of G.ents) if (!e.dead && (e.room === rid || e.boss)) v3EntCard(e);
    v3LootCards();
    v3ProjCards();
    v3GhostCards();
    v3HeroCard(G.p);
  });
}
/* ---------- solids: pixel pictures built into voxel models ---------- */
// The silhouette is extruded, deeper toward the middle in a few steps so it reads round; every pixel keeps
// its colour. A model is built once per picture and shared by everything that looks the same.
const V3_OWN_GLOW = { value: 0.28 };
const V3_SOLIDS = new Map(), V3_SOLID_DEPTH = 1 + 3 * 1.6;
const V3_SOLID_MAT = [false, true].map((faded) => {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: faded, opacity: faded ? 0.38 : 1, depthWrite: !faded });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.selfGlow = V3_SELF_GLOW; sh.uniforms.ownGlow = V3_OWN_GLOW;
    sh.fragmentShader = 'uniform float selfGlow;\nuniform float ownGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { vec3 t = diffuseColor.rgb; float hi = max(t.r, max(t.g, t.b)), sat = (hi - min(t.r, min(t.g, t.b))) / max(hi, 0.001);
        totalEmissiveRadiance += t * (ownGlow + smoothstep(0.65, 0.95, hi) * smoothstep(0.7, 0.9, sat) * selfGlow); }`);
  };
  m.customProgramCacheKey = () => 'v3-solid';
  return m;
});
const v3Lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
function v3SolidGeo(cv, w, hgt, below, ax = w / 2, shadeK = 1) {
  const d = cv.getContext('2d').getImageData(0, 0, w, hgt).data, n = w * hgt, solid = new Uint8Array(n), dist = new Uint8Array(n);
  for (let i = 0; i < n; i++) { solid[i] = d[i * 4 + 3] > 24 ? 1 : 0; dist[i] = solid[i] ? 255 : 0; }
  // how far each pixel is from the edge, then a few depth steps from that
  for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!solid[i]) continue; dist[i] = Math.min(dist[i], x ? dist[i - 1] + 1 : 1, y ? dist[i - w] + 1 : 1); }
  for (let y = hgt - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (!solid[i]) continue; dist[i] = Math.min(dist[i], x < w - 1 ? dist[i + 1] + 1 : 1, y < hgt - 1 ? dist[i + w] + 1 : 1); }
  const half = (i) => (solid[i] ? Math.min(V3_SOLID_DEPTH, 1 + Math.min(3, (dist[i] - 1) >> 1) * 1.6) : 0);
  const pos = [], col = [], nor = [], top = hgt - below;
  const quad = (a, b, c, e, nx, ny, nz, r, g, bl) => {
    for (const v of [a, b, c, a, c, e]) { pos.push(v[0], v[1], v[2]); nor.push(nx, ny, nz); col.push(r, g, bl); }
  };
  const rgb = (i) => [v3Lin(d[i * 4]) * shadeK, v3Lin(d[i * 4 + 1]) * shadeK, v3Lin(d[i * 4 + 2]) * shadeK];
  for (let y = 0; y < hgt; y++) {
    const u0 = top - y, u1 = top - y - 1;
    // faces front and back, merged along runs of one colour and depth
    for (let x = 0; x < w;) {
      const i = y * w + x;
      if (!solid[i]) { x++; continue; }
      let e = x + 1;
      while (e < w && solid[i + e - x] && half(i + e - x) === half(i) && d[(i + e - x) * 4] === d[i * 4] && d[(i + e - x) * 4 + 1] === d[i * 4 + 1] && d[(i + e - x) * 4 + 2] === d[i * 4 + 2]) e++;
      const z = half(i), [r, g, b] = rgb(i), x0 = x - ax, x1 = e - ax;
      quad([x0, u1, z], [x1, u1, z], [x1, u0, z], [x0, u0, z], 0, 0, 1, r, g, b);
      quad([x1, u1, -z], [x0, u1, -z], [x0, u0, -z], [x1, u0, -z], 0, 0, -1, r, g, b);
      x = e;
    }
    // sides wherever a neighbour is shallower
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!solid[i]) continue;
      const z = half(i), [r, g, b] = rgb(i), x0 = x - ax, x1 = x0 + 1;
      const side = (nz, mk) => { if (nz >= z) return; mk(nz, z); mk(-z, -nz); };
      side(x ? half(i - 1) : 0, (a, b2) => quad([x0, u1, a], [x0, u1, b2], [x0, u0, b2], [x0, u0, a], -1, 0, 0, r, g, b));
      side(x < w - 1 ? half(i + 1) : 0, (a, b2) => quad([x1, u1, b2], [x1, u1, a], [x1, u0, a], [x1, u0, b2], 1, 0, 0, r, g, b));
      side(y ? half(i - w) : 0, (a, b2) => quad([x0, u0, b2], [x1, u0, b2], [x1, u0, a], [x0, u0, a], 0, 1, 0, r, g, b));
      side(y < hgt - 1 ? half(i + w) : 0, (a, b2) => quad([x0, u1, a], [x1, u1, a], [x1, u1, b2], [x0, u1, b2], 0, -1, 0, r, g, b));
    }
  }
  // the bundle carries only the shapes the game uses, so a box is emptied and given these buffers
  const geo = new THREE.BoxGeometry(1, 1, 1), Attr = geo.attributes.position.constructor;
  geo.setIndex(null); geo.clearGroups(); geo.deleteAttribute('uv');
  geo.setAttribute('position', new Attr(new Float32Array(pos), 3));
  geo.setAttribute('normal', new Attr(new Float32Array(nor), 3));
  geo.setAttribute('color', new Attr(new Float32Array(col), 3));
  geo.computeBoundingSphere();
  return geo;
}
function v3SolidFor(key, build) {
  let geo = V3_SOLIDS.get(key);
  if (!geo) {
    geo = build(); V3_SOLIDS.set(key, geo);
  }
  return geo;
}
// give a card its solid, pushed back by its deepest point so it never reaches in front of whatever stands where it stands
function v3PlaceSolid(c, geo, x, y, faded, up = 0) {
  if (!c.vox) { c.vox = new THREE.Mesh(geo, V3_SOLID_MAT[0]); V3.scene.add(c.vox); }
  c.vox.geometry = geo; c.vox.material = V3_SOLID_MAT[faded ? 1 : 0];
  c.vox.position.set(x, up, y - V3_SOLID_DEPTH);
  c.vox.visible = true;
  return c;
}
// a card whose picture is still is shown as its solid instead
function v3Solid(c, key, faded) {
  v3PlaceSolid(c, v3SolidFor(key, () => v3SolidGeo(c.cv, c.w, c.hgt, c.below)), c.mesh.position.x, c.mesh.position.z, faded);
  c.mesh.visible = false;
  return c;
}
// a sprite as a solid, standing on its anchor
const V3_SPRITE_CV = mkCanvas(8, 8);
function v3SpriteSolid(sp, shadeK = 1) {
  return v3SolidFor(`sp${v3SpriteId(sp)}:${shadeK}`, () => {
    const cv = V3_SPRITE_CV;
    cv.width = sp.w; cv.height = sp.h;
    const g = cv.getContext('2d'); g.clearRect(0, 0, sp.w, sp.h); g.drawImage(sp.c, 0, 0);
    return v3SolidGeo(cv, sp.w, sp.h, sp.h - sp.ay, sp.ax, shadeK);
  });
}
/* ---------- loot: weapons, relics, potions, gold, souls and keys as small spinning solids ---------- */
// A turning solid reaches out by half its width every way, so its pivot sits that far behind its anchor: it never
// comes in front of whatever stands where it lies. up is the height of the sprite's foot; the anchor is lifted to it.
const v3LootBack = (sp) => sp.w / 2;
function v3SpinSolid(c, sp, x, y, up, spin) {
  v3PlaceSolid(c, v3SpriteSolid(sp), x, y - v3LootBack(sp) + V3_SOLID_DEPTH, false, up + sp.h - sp.ay);
  c.vox.rotation.y = spin;
  return c;
}
function v3LootCards() {
  for (const it of G.items) {
    it.t += 1 / 60;
    // behind the model, at its height: a halo in the item's colour, ringed when better than common; its price above
    const ic = itemIcon(it), col = itemColor(it), rare = itemRare(it), price = it.shop ? `${it.price}:${G.p.gold >= it.price}` : '';
    const c = v3Card(it, it.x, it.y - v3LootBack(ic), 48, 48, 10, (g, cx, cy) => {
      const x = it.x - cx, y = it.y - v3LootBack(ic) - cy - 6 - ic.h / 2;
      g.fillStyle = rgbaStr(col, 0.22); g.beginPath(); g.arc(Math.round(x), Math.round(y), 10, 0, TAU); g.fill();
      if (rare) { g.strokeStyle = rgbaStr(col, 0.85); g.lineWidth = 1; g.beginPath(); g.arc(Math.round(x), Math.round(y), 11, 0, TAU); g.stroke(); }
      if (it.shop) { const tc = pixelText(it.price + 'G', G.p.gold >= it.price ? '#ffd35c' : '#a87a6a'); g.drawImage(tc, Math.round(x - tc.width / 2), Math.round(y - 20)); }
    }, `${col}:${rare}:${price}`);
    v3SpinSolid(c, ic, it.x, it.y, itemBob(it), G.t * 1.6 + it.x);
  }
  for (const k of G.picks) {
    // a pickup is only its solid and its shadow on the floor; the card holds the solid and is never drawn
    const sp = pickSprite(k), c = v3Card(k, k.x, k.y, 2, 2, 0, () => {}, 'pick');
    c.mesh.visible = false;
    R.ox = R.oy = 0; shadow(null, k.x, k.y - v3LootBack(sp), 3, k.z);
    v3SpinSolid(c, sp, k.x, k.y, k.z - pickBob(k), G.t * 3 + k.x);
  }
}
/* ---------- dungeon props: the thing itself solid, what moves on it (flames, sparkles, drips, runes) on a card ---------- */
function v3PropLook(pr) {
  if (pr.npc) return null;
  if (pr.kind === 'chest') {
    const st = chestSwing(pr, pr.opened);
    return { sp: st && st < 3 ? chestLidSprite(pr.chest, st) : chestSprite(pr.chest, pr.opened), shadow: 8, dx: pr.mimic && Math.sin(G.t * 9 + pr.x) > 0.96 ? 1 : 0, up: pr.appear != null && pr.appear < 1 ? (pr.appear += 0.05, (1 - pr.appear) * 10) : 0 };
  }
  if (pr.kind === 'altar' && pr.relicChoice) return { sp: propSprite('altar', G.fl.actIdx) };
  let sp = propSprite(pr.kind, G.fl.actIdx, pr.v || 0);
  if (crigOn() && pr.kind === 'banner') sp = waveFrames(sp, `banner:${G.fl.actIdx}`)[Math.floor(G.t * 5 + pr.x * 0.1) % 4];
  else if (crigOn() && pr.kind === 'mushroom') sp = bendFrames(sp, `mush:${G.fl.actIdx}:${pr.v || 0}`)[clamp(Math.round(windAt(pr.x, pr.y) * 0.6), -SWAY_N, SWAY_N) + SWAY_N];
  const big = pr.kind === 'pedestal' || pr.kind === 'altar' || pr.kind === 'anvil' || pr.kind === 'fountain' || pr.kind === 'shrine' || pr.kind === 'statue' || pr.kind === 'table' || pr.kind === 'brazier';
  return { sp, shadow: big ? (pr.r || 6) + 1 : 0, shadeK: (pr.shrine || pr.fountain) && pr.used ? 0.7 : 1 };
}
function v3PropExtras(g, pr, x, y) {
  if (pr.kind === 'chest') { if (!pr.opened && Math.sin(G.t * 3 + pr.x) > 0.85) { g.fillStyle = '#ffffff'; g.fillRect(Math.round(x + rnd(-6, 6)), Math.round(y - rnd(4, 12)), 1, 1); } return; }
  if (pr.kind === 'altar' && pr.relicChoice) { if (!pr.used) { g.globalAlpha = 0.6 + Math.sin(G.t * 3) * 0.3; g.drawImage(miscIcon('rune').c, Math.round(x - 8), Math.round(y - 30 + Math.sin(G.t * 2) * 2)); g.globalAlpha = 1; } return; }
  if (pr.fountain && !pr.used) { g.fillStyle = 'rgba(200,240,255,0.7)'; const k = (G.t * 6) % 6; g.fillRect(Math.round(x - 1), Math.round(y - 17 + k), 2, 2); }
  if (pr.kind === 'brazier' || pr.kind === 'candles') drawFlame(g, x, y - (pr.kind === 'brazier' ? 9 : 7), pr.kind === 'brazier' ? 1.4 : 0.7, pr.x);
}
function v3PropCard(pr) {
  const L = v3PropLook(pr), el = !pr.npc && mycThingElem(pr);
  // a prop grown over a vein of the Mycelium wears its element
  if (L && L.sp && el) L.sp = elemSprite(L.sp, el);
  // a prop with no sprite of its own stays a card, and throws its shadow; a solid's card holds only its flames and sparkles
  if (!L || !L.sp) { v3Caster(v3Card(pr, pr.x, pr.y, 64, 72, 12, (g, cx, cy) => drawProp(g, pr, cx, cy))); return; }
  const c = v3Card(pr, pr.x, pr.y, 64, 72, 12, (g, cx, cy) => { const x = pr.x - cx, y = pr.y - cy; if (L.shadow) shadow(g, x, y, L.shadow); v3PropExtras(g, pr, x, y); });
  v3PlaceSolid(c, v3SpriteSolid(L.sp, L.shadeK || 1), pr.x + (L.dx || 0), pr.y, false, L.up || 0);
}

// objects that look the same frame to frame; the rest (fires, glowing stones, things you can use) repaint
// a short name for each sprite, so a card can tell whether its picture changed
const V3_SPRITE_IDS = new WeakMap();
let v3SpriteCount = 0;
const v3SpriteId = (sp) => V3_SPRITE_IDS.get(sp) || (V3_SPRITE_IDS.set(sp, ++v3SpriteCount), v3SpriteCount);
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
          const day1 = o.kind === 'building' ? day : '';
          const c = v3Card(o, o.x, o.y, w, sp.ay + 10 + below, below, (g, cx2, cy2) => drawRealmObj(g, o, sp, cx2, cy2, faded), still ? `${v3SpriteId(sp)}:${faded}:${day1}` : undefined);
          if (still) v3Solid(c, `${v3SpriteId(sp)}:${day1}:${c.w}x${c.hgt}`, faded);
          if (o.kind !== 'mark') v3Caster(c);
        }
    for (const e of G.ents) if (!e.dead && inView(e.x, e.y)) v3EntCard(e);
    for (const n of W.npcs) if (inView(n.x, n.y)) v3Caster(v3Card(n, n.x, n.y, 176, 128, 12, (g, cx, cy) => drawNpc(g, n, cx, cy)));
    if (typeof mmoGhosts === 'function') for (const q of mmoGhosts()) if (inView(q.x, q.y)) v3Caster(v3Card(q, q.x, q.y, 128, 128, 18, (g, cx, cy) => drawGhostPlayer(g, q, cx, cy)));
    v3LootCards();
    v3ProjCards();
    v3GhostCards();
    v3HeroCard(p);
  });
}

/* ---------- effects in the air: sparks, glows, bursts, beams, bolts and after-images ---------- */
// soft white pictures, tinted per particle and added onto the scene as light
function v3FxTex(w, hgt, paint) {
  const c = mkCanvas(w, hgt); paint(c.getContext('2d'), w, hgt);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter;
  return t;
}
function v3PaintDot(g, w, hgt) {
  const r = g.createRadialGradient(w / 2, hgt / 2, 0, w / 2, hgt / 2, w / 2);
  r.addColorStop(0, '#fff'); r.addColorStop(0.2, 'rgba(255,255,255,0.65)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, hgt);
}
// seven rays around a hot centre
function v3PaintBurst(g, w) {
  g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineWidth = w / 40;
  for (let i = 0; i < 7; i++) { const a = (i * TAU) / 7; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * w * 0.1, w / 2 + Math.sin(a) * w * 0.1); g.lineTo(w / 2 + Math.cos(a) * w * 0.48, w / 2 + Math.sin(a) * w * 0.48); g.stroke(); }
}
// a shaft of light, wide and bright at the floor, narrowing and fading as it rises
function v3PaintBeam(g, w, hgt) {
  for (let i = 0; i < 8; i++) {
    const s = 1 - i / 8, gr = g.createLinearGradient(0, hgt, 0, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0.13)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(w / 2 - (w / 2) * s, hgt); g.lineTo(w / 2 - w * 0.1 * s, 0); g.lineTo(w / 2 + w * 0.1 * s, 0); g.lineTo(w / 2 + (w / 2) * s, hgt); g.fill();
  }
}
// a forked stroke from the sky, 48 by 150 world pixels; a few shapes are enough
const v3PaintBolt = (seed) => (g, w, hgt) => {
  g.scale(w / 48, hgt / 150); g.strokeStyle = '#fff'; g.lineJoin = g.lineCap = 'round';
  const pts = []; for (let i = 0; i < 10; i++) pts.push([24 + (i === 9 ? 0 : Math.sin(seed + i * 17.1) * 8), 150 * (i / 9)]);
  for (const [width, alpha] of [[7, 0.1], [3, 0.35], [1, 1]]) { g.lineWidth = width; g.globalAlpha = alpha; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
};
// one draw for every particle sharing a picture
function v3Batch(tex, cap, mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })) {
  const mesh = new THREE.InstancedMesh(V3_QUAD, mat, cap);
  mesh.setColorAt(0, new THREE.Color()); mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.count = 0;
  V3.scene.add(mesh);
  return mesh;
}
const V3_M = new THREE.Matrix4(), V3_C = new THREE.Color();
// an upright picture w by hgt centred up off the floor at x, y, turned by rot and lit by colour times a
function v3Put(mesh, x, up, y, w, hgt, rot, color, a) {
  const i = mesh.count;
  if (i >= mesh.instanceMatrix.count || a <= 0.01) return;
  const c = Math.cos(rot), s = Math.sin(rot);
  V3_M.set(c * w, -s * hgt, 0, x, s * w, c * hgt, 0, up, 0, 0, 1, y, 0, 0, 0, 1);
  mesh.setMatrixAt(i, V3_M); mesh.setColorAt(i, V3_C.set(color).multiplyScalar(a));
  mesh.count = i + 1;
}
function v3AirFx(on) {
  if (!V3.air) V3.air = {
    dot: v3Batch(v3FxTex(64, 64, v3PaintDot), 420), burst: v3Batch(v3FxTex(64, 64, v3PaintBurst), 40),
    beam: v3Batch(v3FxTex(64, 256, v3PaintBeam), 16), bolts: [1, 2, 3, 4].map((seed) => v3Batch(v3FxTex(64, 256, v3PaintBolt(seed)), 6)),
    // the game's own particles are square pixels: glowing ones added on as light, the rest (blood, grit, soot) lit like anything else
    shine: v3Batch(null, 720), bits: v3Batch(null, 720, new THREE.MeshLambertMaterial()),
  };
  const A = V3.air, all = [A.dot, A.burst, A.beam, ...A.bolts, A.shine, A.bits];
  for (const m of all) m.count = 0;
  if (on) for (const q of G.parts) {
    const a = clamp(q.life / q.max, 0, 1), z = q.z || 0;
    if (q.glow) v3Put(A.shine, q.x, z + q.size / 2, q.y, q.size, q.size, 0, q.color, a);
    else { const s = q.size * Math.min(1, a * 1.6); v3Put(A.bits, q.x, z + s / 2, q.y, s, s, 0, q.color, 1); }
  }
  if (on) for (const q of fxLive()) {
    if (!FX_UPRIGHT.has(q.type)) continue;
    const { age, k, fade, x, y, z } = fxState(q);
    if (q.type === 'spark') {
      // a streak along the way it is flying; going away from the camera reads as going up
      const sp = Math.exp(-age * 4), up = (q.vz || 0) - (q.grav || 0) * age - (q.vy || 0) * sp * 0.6, len = 3 + Math.hypot(q.vx || 0, q.vy || 0) * sp * 0.05;
      v3Put(A.dot, x, z, y, len * 2, (q.size || 0.8) * 3, Math.atan2(up, (q.vx || 0) * sp), q.color, fade);
    } else if (q.type === 'glow') v3Put(A.dot, x, z, y, q.r * 2, q.r * 2, 0, q.color, fade * 0.45);
    else if (q.type === 'impact') {
      const r = q.r * (0.4 + k);
      v3Put(A.dot, x, z, y, r * 4, r * 4, 0, q.color, fade * 0.6);
      v3Put(A.burst, x, z, y, r * 2, r * 2, q.seed, q.color, fade);
    } else if (q.type === 'pillar') {
      const r = q.r * (1 - k * 0.5), hh = q.height * (0.5 + 0.5 * (1 - k));
      v3Put(A.beam, x, hh / 2 - 3, y + 0.5, r * 2.4, hh, 0, q.color, fade);
      v3Put(A.dot, x, 4, y + 0.5, r * 3, r * 2, 0, q.color, fade * 0.5);
    } else if (q.type === 'bolt') v3Put(A.bolts[Math.floor(q.seed) % 4], x, q.height / 2, y, 48, q.height, 0, q.color, fade * 1.4);
  }
  for (const m of all) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}
// missiles fly at hand height over a shadow of their own, lit by themselves; their cards are a pool, so a storm of them leaves nothing behind
const V3_FLY = 9;
function v3ProjCards() {
  G.projs.forEach((pr, i) => {
    if (i >= 120) return;
    const c = v3Card(`proj${i}`, pr.x, pr.y, 48, pr.lob ? 112 : 56, 8, (g, cx, cy) => {
      if (!pr.lob) shadow(g, pr.x - cx, pr.y - cy, 3, V3_FLY);
      const z = pr.z; pr.z = (z || 0) + (pr.lob ? 0 : V3_FLY);
      try { drawProj(g, pr, cx, cy); } finally { pr.z = z; }
    });
    c.selfLit = true; c.mesh.material.emissiveIntensity = 1;
  });
}
// a dash leaves after-images: cards of the hero's frame, added on as light and fading
function v3GhostCards() {
  let i = 0;
  for (const q of FX.particles) {
    if (q.type !== 'ghost' || G.t - q.born >= q.life || i >= 12) continue;
    const c = v3Card(`ghost${i++}`, q.x, q.y - 1, 128, 128, 18, (g) => { const pt = fxPoint(q.x, q.y, q.z); drawSprite(g, q.sp, pt.x, pt.y, q.flip, { scale: q.scale, tint: q.color, tintA: 0.8 }); }, q.seed);
    const m = c.mesh.material;
    c.selfLit = true; m.blending = THREE.AdditiveBlending; m.emissiveIntensity = 1; m.opacity = fxState(q).fade * 0.28;
  }
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
    runHooks('renderWorld', f, ox, oy);
    for (const q of G.fx) if (TOP_FX[q.kind]) TOP_FX[q.kind](f, q, ox, oy);
    for (const q of G.fx) if (q.kind === 'tele') drawTele(f, q, ox, oy);
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
  // what later modules keep on the glass: the compass, speech, and the edges of strange places
  runHooks('renderGlass', g);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (G.hurtFlash > 0) { const grd = g.createRadialGradient(VW / 2, VH / 2, VH * 0.2, VW / 2, VH / 2, VH * 0.8); grd.addColorStop(0, 'rgba(180,20,30,0)'); grd.addColorStop(1, `rgba(180,20,30,${(G.hurtFlash * 0.9).toFixed(3)})`); g.fillStyle = grd; g.fillRect(0, 0, VW, VH); }
  if (G.p.hp > 0 && G.p.hp / G.p.maxHp < 0.25) { const a = 0.18 + Math.sin(G.t * 6) * 0.08, grd = g.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.85); grd.addColorStop(0, 'rgba(120,0,10,0)'); grd.addColorStop(1, `rgba(120,0,10,${a.toFixed(3)})`); g.fillStyle = grd; g.fillRect(0, 0, VW, VH); }
  if (G.warp > 0) { g.fillStyle = 'rgba(255,220,120,0.08)'; g.fillRect(0, 0, VW, VH); }
}

/* ---------- glow and grade: the scene, its bright parts blurred twice, then composed ---------- */
DEFAULT_SETTINGS.glow = true;
const V3_POST_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }';
const V3_BRIGHT_FS = 'uniform sampler2D map; varying vec2 vUv; void main() { vec3 c = texture2D(map, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(0.55, 1.0, l), 1.0); }';
// a 9-tap gaussian along one direction
const V3_BLUR_FS = 'uniform sampler2D map; uniform vec2 step; varying vec2 vUv; void main() { vec3 c = texture2D(map, vUv).rgb * 0.227027; c += (texture2D(map, vUv + step * 1.384615).rgb + texture2D(map, vUv - step * 1.384615).rgb) * 0.316216; c += (texture2D(map, vUv + step * 3.230769).rgb + texture2D(map, vUv - step * 3.230769).rgb) * 0.070270; gl_FragColor = vec4(c, 1.0); }';
// glow added over the scene, highlights rolled off softly, a touch of saturation and a vignette
const V3_COMPOSE_FS = `uniform sampler2D map; uniform sampler2D near; uniform sampler2D wide; uniform float glow; varying vec2 vUv;
void main() {
  vec3 c = texture2D(map, vUv).rgb + (texture2D(near, vUv).rgb * 0.7 + texture2D(wide, vUv).rgb * 0.9) * glow;
  c = mix(c, 1.0 - exp(-c * 1.6), smoothstep(0.7, 1.4, max(c.r, max(c.g, c.b))));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, 1.06);
  vec2 q = vUv * (1.0 - vUv); c *= 0.8 + 0.2 * clamp(pow(q.x * q.y * 16.0, 0.25), 0.0, 1.0);
  gl_FragColor = linearToOutputTexel(vec4(clamp(c, 0.0, 1.0), 1.0));
}`;
function v3PostInit() {
  // the glow is soft, so its small buffers can be eight-bit; only the scene keeps its highlights above one
  const rt = (w, h) => new THREE.WebGLRenderTarget(w, h, { depthBuffer: false });
  const pass = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: V3_POST_VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
  V3.post = {
    scene: new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }), near: [rt(1, 1), rt(1, 1)], wide: [rt(1, 1), rt(1, 1)],
    bright: pass(V3_BRIGHT_FS, { map: { value: null } }), blur: pass(V3_BLUR_FS, { map: { value: null }, step: { value: new THREE.Vector2() } }),
    compose: pass(V3_COMPOSE_FS, { map: { value: null }, near: { value: null }, wide: { value: null }, glow: { value: 0.8 } }),
    quad: new THREE.Mesh(V3_QUAD), cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), w: 0, h: 0,
  };
}
function v3PostPass(material, target) { const P = V3.post; P.quad.material = material; V3.renderer.setRenderTarget(target); V3.renderer.render(P.quad, P.cam); }
function v3Present() {
  const r = V3.renderer;
  if (!CD.settings.glow || CD.settings.lowFx) { r.setRenderTarget(null); r.render(V3.scene, V3.camera); return; }
  if (!V3.post) v3PostInit();
  const P = V3.post, w = R.VW * V3_RES, hh = R.VH * V3_RES;
  if (P.w !== w || P.h !== hh) {
    P.w = w; P.h = hh; P.scene.setSize(w, hh);
    for (const t of P.near) t.setSize(w >> 2, hh >> 2);
    for (const t of P.wide) t.setSize(w >> 3, hh >> 3);
  }
  r.setRenderTarget(P.scene); r.render(V3.scene, V3.camera);
  P.bright.uniforms.map.value = P.scene.texture; v3PostPass(P.bright, P.near[0]);
  const blur = (from, to, dx, dy) => { P.blur.uniforms.map.value = from.texture; P.blur.uniforms.step.value.set(dx / from.width, dy / from.height); v3PostPass(P.blur, to); };
  blur(P.near[0], P.near[1], 1, 0); blur(P.near[1], P.near[0], 0, 1);
  blur(P.near[0], P.wide[0], 2, 0); blur(P.wide[0], P.wide[1], 0, 1.5);
  const U = P.compose.uniforms; U.map.value = P.scene.texture; U.near.value = P.near[0].texture; U.wide.value = P.wide[1].texture;
  v3PostPass(P.compose, null);
}
settingsRow('glow', 6, () => h('label', { class: 'set-row' }, 'Glow and colour (turn off on slow devices)',
  h('input', { type: 'checkbox', checked: CD.settings.glow !== false, onchange: (e) => { CD.settings.glow = e.target.checked; CD.save.settings = { ...CD.settings }; persist(); } })), true);

/* ---------- the frame ---------- */
function render() {
  if (!V3.renderer && !v3Init()) return;
  V3.frame++;
  const fl = G.fl, size = V3.renderer.getSize(V3.size), w = R.VW * V3_RES, hh = R.VH * V3_RES;
  if (size.x !== w || size.y !== hh) V3.renderer.setSize(w, hh, false);
  const realm = !!(W.on && !W.inInst && fl && fl.realm && W.Z && G.p), deep = !realm && !!(fl && fl.rooms && G.p);
  if (V3.level) V3.level.visible = deep;
  v3SyncDoors(deep);
  if (!realm && !deep) { v3AirFx(false); for (const c of V3.cards.values()) { c.mesh.visible = false; if (c.vox) c.vox.visible = false; } V3.ground.mesh.visible = V3.fx.mesh.visible = false; V3.ug && V3.ug.clearRect(0, 0, V3.ui.width, V3.ui.height); V3.renderer.render(V3.scene, V3.camera); return; }
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
    v3Shadows(false, 1);
    v3Fog(V3.scene.background, 1.1, 2.6);
  } else {
    const shadows = v3RealmCards(rect.ox - 80, rect.oy - 40, rect.ox + rect.Wd + 80, rect.oy + rect.Hd + 140);
    v3Floor(rect, (g, ox, oy) => realmGround(g, ox, oy, R.VW, R.VH), shadows);
    const S = realmLights(rect.ox, rect.oy, rect.Wd, rect.Hd), [r, gg, b] = S.tint, k = S.dark;
    v3Light(S.L, S.dark, `rgb(${Math.round(255 - (255 - r * 4) * k)},${Math.round(255 - (255 - gg * 4) * k)},${Math.round(255 - (255 - b * 4) * k)})`);
    v3Shadows(true, S.dark);
    if (S.dusk > 0) tone = `rgba(255,140,60,${(S.dusk * 0.1).toFixed(3)})`;
    const day = 1 - k, haze = (c, n) => Math.round(c * day + n * 4 * k * 0.4);
    v3Fog(`rgb(${haze(170 + S.dusk * 60, r)},${haze(184, gg)},${haze(200 - S.dusk * 50, b)})`, 1.2, 3.4);
  }
  v3AirFx(true);
  R.ox = Math.round(G.cam.x - R.VW / 2); R.oy = Math.round(G.cam.y - R.VH / 2);
  v3Ui(realm, tone);
  v3Present();
}
CD.renderer = { get status() { return { rooms: V3.rooms.length, cards: [...V3.cards.values()].filter((c) => c.mesh.visible || (c.vox && c.vox.visible)).length, solids: [...V3.cards.values()].filter((c) => c.vox && c.vox.visible).length, models: V3_SOLIDS.size, glow: !!V3.post && !!CD.settings.glow && !CD.settings.lowFx, lights: V3.lights.filter((l) => l.intensity > 0).length, shadows: V3.shadeCount || 0, revision: THREE.REVISION }; } };
