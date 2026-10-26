/* ============================================================
   Cinderdeep — the circles in 3D. The Talent Tree, the skill
   wheel and the DNA circle are networks: nodes joined by hyphae.
   This builds one as a small three.js scene of its own (nodes and
   hypha segments are instanced boxes, glows and light are added
   quads) and paints it into the screen's canvas, so a screen
   keeps its own pointer, tooltip and button code. The camera can
   be turned (yaw) and tilted, and the screen asks it where a
   point on the glass falls on the floor, and which node is under
   it. Nothing here touches the game's own renderer.
   ============================================================ */
const C3 = { gl: null, live: 0, last: null, tex: {}, colors: new Map(), dims: new Map() };
const C3_FOV = 40; // degrees, vertical
const C3_SEG = 8; // most boxes along one hypha
const C3_BASE = '#1e171a'; // what unlit things fade toward

const c3Color = (css) => { let c = C3.colors.get(css); if (!c) { c = new THREE.Color(css); C3.colors.set(css, c); } return c; };
// a colour faded toward the dark by k (1 keeps it), as a hex string so callers can cache it
function c3Dim(css, k, base = C3_BASE) {
  const key = `${css}|${k}|${base}`;
  let s = C3.dims.get(key);
  if (!s) { s = '#' + c3Color(css).clone().lerp(c3Color(base), 1 - k).getHexString(); C3.dims.set(key, s); }
  return s;
}
// one renderer for every circle, drawn into whichever canvas is open
function c3Gl() {
  if (C3.gl) return C3.gl;
  try {
    const r = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: false, alpha: false });
    r.setPixelRatio(1); r.setClearColor('#060406');
    C3.gl = r;
  } catch (e) { console.error('Cinderdeep could not start a second WebGL view for its circles', e); }
  return C3.gl;
}
function c3Tex(name, paint) {
  if (C3.tex[name]) return C3.tex[name];
  const c = document.createElement('canvas'); c.width = c.height = 64; paint(c.getContext('2d'), 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter;
  return (C3.tex[name] = t);
}
const c3Glow = () => c3Tex('glow', (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
const c3Ring = () => c3Tex('ring', (g, s) => { g.strokeStyle = '#fff'; g.lineWidth = s * 0.07; g.beginPath(); g.arc(s / 2, s / 2, s * 0.43, 0, TAU); g.stroke(); });

/* nodes: [{ x, y }] in the circle's own units, edges: [[a, b]] indexes, o: {
     radius        how far the circle reaches, for the ground and the stars
     height(n, i)  how high a node floats above the ground
     seed(ei)      each hypha's own bend
     radiusOf(i)   a node's size in units, until the first frame says otherwise
     ground(g, size, key)  paints the ground square, -radius..radius each way
   } */
function circle3d(nodes, edges, o = {}) {
  const gl = c3Gl();
  if (!gl) return null;
  const N = nodes.length, E = edges.length, R0 = o.radius || 1000, GR = R0 * 1.25;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(C3_FOV, 1, 1, 20000);
  scene.fog = new THREE.Fog('#060406', 1, 2);
  const box = new THREE.BoxGeometry(1, 1, 1), quad = new THREE.PlaneGeometry(1, 1), geos = [box, quad], mats = [];
  const mat = (m) => (mats.push(m), m);
  const addMat = (tex) => mat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const inst = (geo, material, cap, order = 0) => {
    const m = new THREE.InstancedMesh(geo, material, Math.max(1, cap));
    m.frustumCulled = false; m.renderOrder = order; m.count = 0; m.setColorAt(0, c3Color('#ffffff'));
    scene.add(m);
    return m;
  };
  const hs = nodes.map((n, i) => (o.height ? o.height(n, i) : 0));
  const C = { scene, camera, nodes, edges, hs, cssW: 1, cssH: 1, D: 1, pixel: 1, groundKey: undefined, r: new Float32Array(N), cy: Float32Array.from(hs), on: new Uint8Array(N).fill(1), cards: new Map(), dead: false };
  for (let i = 0; i < N; i++) C.r[i] = o.radiusOf ? o.radiusOf(i) : 8;

  scene.add(new THREE.AmbientLight('#ffffff', 1.5));
  const sun = new THREE.DirectionalLight('#fff0d8', 2.2); sun.position.set(-1, 2.4, 1.4); scene.add(sun);

  // the ground: a square picture under everything, repainted when its key changes
  const groundCv = document.createElement('canvas'); groundCv.width = groundCv.height = 1024;
  const groundTex = new THREE.CanvasTexture(groundCv); groundTex.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(quad, mat(new THREE.MeshBasicMaterial({ map: groundTex, depthWrite: false, fog: false })));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -24; ground.scale.set(GR * 2, GR * 2, 1); ground.renderOrder = -3;
  scene.add(ground);

  // stars, floating in the dark above and below the circle
  const stars = inst(quad, addMat(c3Glow()), 300, -2);
  { const M = new THREE.Matrix4();
    for (let i = 0; i < 300; i++) {
      const s = 5 + hashU(i, 3, 7) * 10;
      M.makeScale(s, s, 1).setPosition((hashU(i, 1, 7) - 0.5) * GR * 3.2, -260 + hashU(i, 2, 7) * 1100, (hashU(i, 4, 7) - 0.5) * GR * 3.2);
      stars.setMatrixAt(i, M); stars.setColorAt(i, c3Color('#fff0dc').clone().multiplyScalar(0.18 + hashU(i, 5, 7) * 0.4));
    }
    stars.count = 300; stars.instanceMatrix.needsUpdate = true; stars.instanceColor.needsUpdate = true; stars.userData.still = true;
  }

  // hyphae: each a bowed curve above the ground, cut into boxes
  const segAt = new Int32Array(E + 1), curve = [];
  let segs = 0;
  edges.forEach(([a, b], ei) => {
    const A = nodes[a], B = nodes[b], ha = hs[a], hb = hs[b], dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
    const k = (hashU(o.seed ? o.seed(ei) : ei * 2654435761, 7, 3) - 0.5) * 0.36;
    const cx = (A.x + B.x) / 2 - dy * k, cy = (A.y + B.y) / 2 + dx * k, ch = (ha + hb) / 2 + Math.min(36, len * 0.1), n = clamp(Math.ceil(len / 60), 2, C3_SEG), pts = new Float32Array((n + 1) * 3);
    for (let s = 0; s <= n; s++) { const u = s / n, p = (1 - u) * (1 - u), q = 2 * u * (1 - u), r = u * u; pts[s * 3] = p * A.x + q * cx + r * B.x; pts[s * 3 + 1] = p * ha + q * ch + r * hb; pts[s * 3 + 2] = p * A.y + q * cy + r * B.y; }
    curve.push({ pts, n, a: A, b: B, cx, cy, ch, ha, hb, speed: 0.25 + hashU(o.seed ? o.seed(ei) : ei * 2654435761, 9, 1) * 0.35, off: hashU(o.seed ? o.seed(ei) : ei * 2654435761, 5, 2) });
    segAt[ei] = segs; segs += n;
  });
  segAt[E] = segs;
  // each piece is a ribbon turned toward the viewer: two triangles where a box would have twelve
  const edgeMesh = inst(quad, mat(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), segs, 0); edgeMesh.count = segs;
  const ekeys = new Array(E).fill(null), ew = new Float32Array(E), segEdge = new Int32Array(segs);
  for (let ei = 0; ei < E; ei++) segEdge.fill(ei, segAt[ei], segAt[ei + 1]);

  const nodeMesh = inst(box, mat(new THREE.MeshLambertMaterial({})), N, 1); nodeMesh.count = N;
  const stems = inst(box, mat(new THREE.MeshBasicMaterial({})), N, 0);
  const glows = inst(quad, addMat(c3Glow()), N + 800, 5), rings = inst(quad, addMat(c3Ring()), N * 2 + 80, 6), beads = inst(quad, addMat(c3Glow()), E + 40, 6);
  const cap = { glow: glows.instanceMatrix.count, ring: rings.instanceMatrix.count, bead: beads.instanceMatrix.count };

  const M = new THREE.Matrix4(), M2 = new THREE.Matrix4(), M3 = new THREE.Matrix4(), BB = new THREE.Matrix4(), VX = new THREE.Vector3(), VY = new THREE.Vector3(), VZ = new THREE.Vector3(), V = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0), HIT = new THREE.Vector3(), RAY = new THREE.Raycaster(), NDC = new THREE.Vector2(), PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), TMP = new THREE.Color();
  let gn = 0, rn = 0, bn = 0;
  const L0 = { col: '#000000', w: 0 };

  // a quad facing the viewer: a glow of light, a ring, a bead
  const bill = (mesh, i, x, y, z, w, hgt, col, a) => { M.copy(BB).scale(V.set(w, hgt, 1)).setPosition(x, y, z); mesh.setMatrixAt(i, M); mesh.setColorAt(i, TMP.copy(c3Color(col)).multiplyScalar(a)); };
  C.glow = (x, y, z, size, col, a = 1) => { if (gn < cap.glow) bill(glows, gn++, x, y, z, size, size, col, a); };
  C.ring = (x, y, z, size, col, a = 1) => { if (rn < cap.ring) bill(rings, rn++, x, y, z, size, size, col, a); };
  C.bead = (x, y, z, size, col, a = 1) => { if (bn < cap.bead) bill(beads, bn++, x, y, z, size, size, col, a); };

  // the camera: view is { x, y } the point looked at, z pixels per unit there, yaw and tilt in radians (0 tilt looks straight down)
  C.aim = (view, w, hgt) => {
    C.cssW = w; C.cssH = hgt;
    const D = hgt / view.z / (2 * Math.tan((C3_FOV * Math.PI) / 360)), tilt = clamp(view.tilt ?? 0.9, 0.1, 1.3), yaw = view.yaw || 0;
    camera.aspect = w / hgt; camera.near = D * 0.05; camera.far = D + GR * 4;
    camera.position.set(view.x + D * Math.sin(tilt) * Math.sin(yaw), D * Math.cos(tilt), view.y + D * Math.sin(tilt) * Math.cos(yaw));
    camera.lookAt(view.x, 0, view.y);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    C.D = D; C.pixel = 1 / view.z; // one pixel, in units, where the view is aimed
  };
  // a point of the circle on the glass, in CSS pixels, and how many pixels a unit is there
  const proj = (x, y, z) => {
    V.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    const depth = Math.max(1, -V.z), k = C.cssH / (2 * Math.tan((C3_FOV * Math.PI) / 360) * depth);
    V.set(x, y, z).project(camera);
    return { x: ((V.x + 1) / 2) * C.cssW, y: ((1 - V.y) / 2) * C.cssH, k, behind: V.z > 1 };
  };
  C.project = (i) => proj(nodes[i].x, C.cy[i], nodes[i].y);
  C.at = (x, y, z) => proj(x, z, y);
  // where a point on the glass falls on the ground, in the circle's own units
  C.worldAt = (px, py, view = C.view, w = C.cssW, hgt = C.cssH) => {
    C.aim(view, w, hgt);
    RAY.setFromCamera(NDC.set((px / w) * 2 - 1, -(py / hgt) * 2 + 1), camera);
    const p = RAY.ray.intersectPlane(PLANE, HIT);
    return p ? { x: p.x, y: p.z } : { x: view.x, y: view.y };
  };
  // the node under a point on the glass, or -1
  C.pick = (px, py, view = C.view, w = C.cssW, hgt = C.cssH, slop = 6) => {
    C.aim(view, w, hgt);
    let best = -1, bd = 1e9;
    for (let i = 0; i < N; i++) {
      if (!C.on[i]) continue;
      const p = C.project(i);
      if (p.behind) continue;
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < C.r[i] * p.k * 0.9 + slop && d < bd) { bd = d; best = i; }
    }
    return best;
  };
  C.client = (i, view = C.view, w = C.cssW, hgt = C.cssH) => { C.aim(view, w, hgt); return C.project(i); };

  // one ribbon piece, turned to face the camera, never thinner than a pixel and a bit
  const putSeg = (ei, s) => {
    const c = curve[ei], p = c.pts, i = s * 3, dx = p[i + 3] - p[i], dy = p[i + 4] - p[i + 1], dz = p[i + 5] - p[i + 2], len = Math.hypot(dx, dy, dz) || 1;
    const mx = (p[i] + p[i + 3]) / 2, my = (p[i + 1] + p[i + 4]) / 2, mz = (p[i + 2] + p[i + 5]) / 2;
    VX.set(dx / len, dy / len, dz / len);
    VZ.set(camera.position.x - mx, camera.position.y - my, camera.position.z - mz); VZ.addScaledVector(VX, -VZ.dot(VX)); if (VZ.lengthSq() < 1e-6) VZ.set(0, 1, 0); VZ.normalize();
    VY.crossVectors(VZ, VX);
    M.makeBasis(VX.multiplyScalar(len * 1.04), VY.multiplyScalar(ew[ei] ? Math.max(ew[ei], C.pixel * 1.3) : 0), VZ); M.setPosition(mx, my, mz);
    edgeMesh.setMatrixAt(segAt[ei] + s, M);
  };
  const writeEdge = (ei, L) => {
    ew[ei] = L.w; const col = c3Color(L.col);
    for (let s = 0; s < curve[ei].n; s++) { putSeg(ei, s); edgeMesh.setColorAt(segAt[ei] + s, col); }
  };

  /* A frame. look is { t, groundKey, node(i), edge(ei), extras(C, t) }:
       node(i)  → null (hide) or { r, shape: cube|gem|slab|pedestal, col, glow, glowCol, ring, mark, markScale, flash: { size, col }, stem, card }
       edge(ei) → { col, w, key, bead } and is only rewritten when key changes
       card     → { canvas, w, h, key } a sprite standing on the node
     g is the screen's 2D canvas, W by H device pixels at dpr. */
  C.draw = (g, W, H, dpr, view, look) => {
    const t = look.t ?? performance.now() / 1000;
    gl.getSize(NDC);
    if (NDC.x !== W || NDC.y !== H) gl.setSize(W, H, false);
    C.view = view;
    C.aim(view, W / dpr, H / dpr);
    scene.fog.near = C.D * 0.9; scene.fog.far = C.D * 3.6;
    BB.extractRotation(camera.matrixWorld);
    gn = rn = bn = 0;
    if (look.groundKey !== C.groundKey && o.ground) { C.groundKey = look.groundKey; o.ground(groundCv.getContext('2d'), 1024, look.groundKey); groundTex.needsUpdate = true; }
    let edgesChanged = false;
    for (let ei = 0; ei < E; ei++) {
      const L = look.edge(ei);
      if (!L) { if (ekeys[ei] !== 'x') { ekeys[ei] = 'x'; writeEdge(ei, L0); edgesChanged = true; } continue; }
      if (L.key !== ekeys[ei]) { ekeys[ei] = L.key; writeEdge(ei, L); edgesChanged = true; }
      if (L.bead) {
        const c = curve[ei], u = (t * c.speed + c.off) % 1, p = (1 - u) * (1 - u), q = 2 * u * (1 - u), r = u * u;
        C.bead(p * c.a.x + q * c.cx + r * c.b.x, p * c.ha + q * c.ch + r * c.hb, p * c.a.y + q * c.cy + r * c.b.y, L.w * 1.9 + 7, L.col, 0.9);
      }
    }
    const camKey = `${camera.position.x.toFixed(1)}|${camera.position.y.toFixed(1)}|${camera.position.z.toFixed(1)}`;
    if (camKey !== C.camKey) { C.camKey = camKey; for (let si = 0; si < segs; si++) putSeg(segEdge[si], si - segAt[segEdge[si]]); edgesChanged = true; }
    if (edgesChanged) { edgeMesh.instanceMatrix.needsUpdate = true; edgeMesh.instanceColor.needsUpdate = true; }
    let sn = 0;
    for (let i = 0; i < N; i++) {
      const L = look.node(i), n = nodes[i];
      if (!L) { C.on[i] = 0; M.makeScale(0, 0, 0); nodeMesh.setMatrixAt(i, M); continue; }
      C.on[i] = 1; C.r[i] = L.r;
      const s = L.r * 1.6;
      let y = hs[i] + s * 0.5;
      if (L.shape === 'gem') { M.makeRotationY(t * 0.6 + i).multiply(M2.makeRotationX(0.6155)).multiply(M3.makeRotationZ(Math.PI / 4)).scale(V.set(s * 0.8, s * 0.8, s * 0.8)); y = hs[i] + s * 0.75; }
      else if (L.shape === 'slab') { M.makeRotationY(Math.PI / 4 + t * 0.25).scale(V.set(s * 1.05, s * 0.55, s * 1.05)); y = hs[i] + s * 0.3; }
      else if (L.shape === 'pedestal') { M.makeScale(s * 1.4, s * 0.5, s * 1.4); y = hs[i] + s * 0.25; }
      else M.makeScale(s, s, s);
      M.setPosition(n.x, y, n.y); C.cy[i] = y;
      nodeMesh.setMatrixAt(i, M); nodeMesh.setColorAt(i, c3Color(L.col));
      if (L.glow) C.glow(n.x, y, n.y, L.r * 4.2, L.glowCol || L.col, L.glow);
      if (L.ring) C.ring(n.x, y, n.y, L.r * 3.1, L.ring, 0.95);
      if (L.mark) C.ring(n.x, y, n.y, L.r * (L.markScale || 3.9), L.mark, 1);
      if (L.flash) C.ring(n.x, y, n.y, L.r * L.flash.size, L.flash.col, 1);
      if (L.stem && y > 30) { M.makeScale(1.4, y + 24, 1.4).setPosition(n.x, (y - 24) / 2, n.y); stems.setMatrixAt(sn, M); stems.setColorAt(sn++, c3Color(c3Dim(L.col, 0.35))); }
      if (L.card) cardAt(i, L.card, n.x, hs[i] + s * 0.5 + L.card.h * 0.5, n.y);
    }
    stems.count = sn; nodeMesh.instanceMatrix.needsUpdate = true; nodeMesh.instanceColor.needsUpdate = true; stems.instanceMatrix.needsUpdate = true; stems.instanceColor.needsUpdate = true;
    if (look.extras) look.extras(C, t);
    for (const [m, n] of [[glows, gn], [rings, rn], [beads, bn]]) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    // cards stand where they are told this frame; the rest are put away
    for (const c of C.cards.values()) { c.mesh.visible = c.shown; c.shown = false; }
    gl.render(scene, camera);
    g.drawImage(gl.domElement, 0, 0, W, H);
  };
  function cardAt(i, card, x, y, z) {
    let c = C.cards.get(i);
    if (!c || c.key !== card.key) {
      if (c) { scene.remove(c.mesh); c.mesh.material.map.dispose(); c.mesh.material.dispose(); }
      const tex = new THREE.CanvasTexture(card.canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false;
      const mesh = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, fog: false }));
      mesh.renderOrder = 3; scene.add(mesh);
      c = { mesh, key: card.key, shown: false }; C.cards.set(i, c);
    }
    c.shown = true; c.mesh.quaternion.copy(camera.quaternion); c.mesh.position.set(x, y, z); c.mesh.scale.set(card.w, card.h, 1);
  }

  C.dispose = () => {
    if (C.dead) return;
    C.dead = true; C3.live--; if (C3.last === C) C3.last = null;
    for (const c of C.cards.values()) { c.mesh.material.map.dispose(); c.mesh.material.dispose(); }
    for (const m of scene.children) if (m.isInstancedMesh) m.dispose();
    for (const m of mats) m.dispose();
    groundTex.dispose();
    for (const x of geos) x.dispose();
    scene.clear();
  };
  C3.live++; C3.last = C;
  return C;
}
// a circle fills the screen, so the game behind it is not drawn while one is open
const _renderC3 = render;
render = function () { if (!C3.live) _renderC3(); };
CD.circles = () => ({ gl: !!C3.gl, live: C3.live, nodes: C3.last ? C3.last.nodes.length : 0, edges: C3.last ? C3.last.edges.length : 0 });
