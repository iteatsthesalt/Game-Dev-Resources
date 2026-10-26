/* ============================================================
   Cinderdeep — the camp, as a small 3D scene: a fire among
   stones and logs, tents and pines at the edge of the light, a
   moon and stars, and the party standing round it in the rig's
   models, each in its idle, turned to the flames. The camp
   screen has it as its banner and the title as its backdrop.
   ============================================================ */
const CAMP_R = 36; // how far from the fire the party stands, in pose units (a person is 42 tall)

// who is at the fire: the living characters first, then the last hero played, then whoever fills the circle
function campParty() {
  const party = [];
  for (const ch of realmStore().chars) if (!ch.fell && CLASS[ch.cls] && !party.includes(ch.cls)) party.push(ch.cls);
  for (const id of [CD.save.lastClass, 'knight', 'ranger', 'witch', 'bard', 'monk', 'samurai']) if (party.length < 4 && CLASS[id] && !party.includes(id)) party.push(id);
  return party.slice(0, 6);
}

function camp3d() {
  const gl = c3Gl();
  if (!gl) return null;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, 1, 3000);
  const box = new THREE.BoxGeometry(1, 1, 1), quad = new THREE.PlaneGeometry(1, 1), geos = [box, quad], mats = [];
  const lambert = (color, o = {}) => { const m = new THREE.MeshLambertMaterial({ color, ...o }); mats.push(m); return m; };
  const additive = (tex) => { const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }); mats.push(m); return m; };
  const part = (geo, mat, x, y, z, sx, sy, sz, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(0, ry, rz); scene.add(m); return m; };
  scene.fog = new THREE.Fog('#07060a', 260, 900);

  // light: a cold ambient and moon, and the fire's own
  scene.add(new THREE.AmbientLight('#6a78a8', 0.9));
  const moon = new THREE.DirectionalLight('#b4c8ff', 1.1); moon.position.set(-200, 300, -250); scene.add(moon);
  const fire = new THREE.PointLight('#ff9040', 130, 340, 1); fire.position.set(0, 16, 0); scene.add(fire);

  // the ground, the fire's pool of light on it, stones and logs
  part(box, lambert('#1f1812'), 0, -2, 0, 1400, 4, 1400);
  const pool = new THREE.Mesh(quad, additive(c3Glow())); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.4; pool.scale.set(260, 260, 1); pool.material.color.set('#ff8a3a'); scene.add(pool);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + hashU(i, 1, 9) * 0.3, r = 17 + hashU(i, 2, 9) * 3; part(box, lambert('#5a5552'), Math.cos(a) * r, 2, Math.sin(a) * r, 5 + hashU(i, 3, 9) * 3, 4 + hashU(i, 4, 9) * 2, 5 + hashU(i, 5, 9) * 3, a); }
  for (let i = 0; i < 3; i++) part(box, lambert('#4a3220', { emissive: '#ff5a18', emissiveIntensity: 0.3 }), 0, 3 + i * 0.4, 0, 28, 4, 4, (i * Math.PI) / 3 + 0.2, 0.1);

  // two tents at the edge of the light: two leaning planes and a dark mouth
  [[200, 95, '#7a6a52'], [255, 110, '#566650']].forEach(([deg, d, col], i) => {
    const a = (deg * Math.PI) / 180, x = Math.cos(a) * d, z = Math.sin(a) * d, face = Math.atan2(x, z) + Math.PI;
    const t = new THREE.Group(); t.position.set(x, 0, z); t.rotation.y = face + (i ? -0.3 : 0.3); scene.add(t);
    for (const s of [-1, 1]) { const m = new THREE.Mesh(box, lambert(col)); m.scale.set(1.5, 30, 44); m.position.set(s * 11, 13, 0); m.rotation.z = -s * 0.62; t.add(m); }
    const mouth = new THREE.Mesh(box, lambert('#0c0a0a')); mouth.scale.set(1, 18, 16); mouth.position.set(0, 9, 22); t.add(mouth);
  });

  // pines, the rig's own, merged into one mesh each and set round the dark
  const pine = RigKit.TREE_PRESETS.pine, treeMat = new THREE.MeshLambertMaterial({ vertexColors: true }); mats.push(treeMat);
  const look = { ...pine, pal: { trunk: '#4a3320', leaf: '#1f4a30', light: '#356b42', accent: null } }, TM = RigShapes.builder(1);
  RigModels.tree(RigKit.treePose('sway', 0, look), look, TM);
  const treeGeo = RigShapes.merge(TM.parts), treeH = TM.bounds.h; geos.push(treeGeo);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + hashU(i, 7, 9) * 0.3, d = 190 + hashU(i, 8, 9) * 120, k = (120 + hashU(i, 9, 9) * 90) / treeH, m = new THREE.Mesh(treeGeo, treeMat);
    m.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); m.scale.setScalar(k); m.rotation.y = hashU(i, 6, 9) * TAU; scene.add(m);
  }

  // the sky: stars and a moon, always facing the viewer
  const faces = [];
  const sky = (tex, n, spread, size, col, a0) => {
    for (let i = 0; i < n; i++) {
      const az = hashU(i, 11, n) * TAU, el = 0.12 + hashU(i, 12, n) * 1.2, m = new THREE.Mesh(quad, additive(tex)), s = size * (0.5 + hashU(i, 13, n));
      m.position.set(Math.cos(az) * Math.cos(el) * spread, Math.sin(el) * spread, Math.sin(az) * Math.cos(el) * spread); m.scale.set(s, s, 1); m.material.color.set(col).multiplyScalar(a0 * (0.4 + hashU(i, 14, n)));
      m.renderOrder = -2; scene.add(m); faces.push(m);
    }
  };
  sky(c3Glow(), 160, 1200, 14, '#fff0dc', 0.8);
  const bigMoon = new THREE.Mesh(quad, additive(c3Glow())); bigMoon.position.set(-420, 420, -900); bigMoon.scale.set(260, 260, 1); bigMoon.material.color.set('#9ab4e8'); bigMoon.renderOrder = -2; scene.add(bigMoon); faces.push(bigMoon);

  // flames and embers
  const flames = Array.from({ length: 8 }, (_, i) => { const m = new THREE.Mesh(quad, additive(c3Glow())); m.material.color.set(['#ff5a14', '#ff8a2a', '#ffc050', '#fff0a0'][i % 4]); scene.add(m); faces.push(m); return m; });
  const embers = Array.from({ length: 40 }, (_, i) => { const m = new THREE.Mesh(quad, additive(c3Glow())); m.material.color.set('#ffb060'); scene.add(m); faces.push(m); return m; });

  // the party: each a placer of its own, rebuilt every frame in its idle
  const people = [];
  const C = { dead: false };
  // draws the party (class ids) into the 2D context g of W by H pixels at time; o.shift moves the fire sideways in the picture, in units
  C.draw = (g, W, H, party, time, o = {}) => {
    while (people.length < party.length) { const group = new THREE.Group(); scene.add(group); people.push({ group, parts: RigShapes.placer(group) }); }
    RigShapes.ownLight(0.2);
    party.forEach((id, i) => {
      const P = people[i], who = stageWho(id), M = who && stageBuild(who, time * 0.9 + i * 0.37);
      P.group.visible = !!M;
      if (!M) return;
      P.parts.place(M.parts);
      const a = (i / party.length) * TAU + 0.6, x = Math.cos(a) * CAMP_R, z = Math.sin(a) * CAMP_R;
      P.group.position.set(x, -M.bounds.lo[1], z); P.group.rotation.y = Math.atan2(x, z);
      if (who.beast) P.group.scale.setScalar(0.9);
    });
    for (let i = party.length; i < people.length; i++) people[i].group.visible = false;
    // the fire: flames lick up in turns, the light flickers with them
    const flick = 1 + Math.sin(time * 9) * 0.06 + Math.sin(time * 23.7) * 0.05;
    fire.intensity = 130 * flick;
    flames.forEach((m, i) => { const k = (time * (1.4 + i * 0.13) + i * 0.37) % 1, s = (22 - i * 1.5) * (1 - k * 0.5); m.position.set(Math.sin(time * 3 + i) * 2.5, 5 + k * (16 + i), Math.cos(time * 2.6 + i * 2) * 2.5); m.scale.set(s, s * 1.4, 1); m.material.opacity = 1 - k * 0.6; });
    embers.forEach((m, i) => { const k = (time * (0.16 + hashU(i, 1, 4) * 0.2) + hashU(i, 2, 4)) % 1, a = hashU(i, 3, 4) * TAU; m.position.set(Math.cos(a) * (4 + k * 14) + Math.sin(time + i) * 3, 8 + k * 80, Math.sin(a) * (4 + k * 14)); const s = 1.6 * (1 - k); m.scale.set(s, s, 1); });
    pool.scale.setScalar(250 * flick); pool.material.opacity = 1;
    // the camera drifts slowly about the fire
    const yaw = Math.sin(time * 0.12) * 0.5 + 0.3, aspect = W / H, dist = o.dist || 250, high = o.high || 85;
    camera.aspect = aspect; camera.position.set(Math.sin(yaw) * dist, high, Math.cos(yaw) * dist);
    camera.lookAt(0, 26, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    if (o.shift) { const right = V_RIGHT.setFromMatrixColumn(camera.matrixWorld, 0); camera.position.addScaledVector(right, -o.shift); camera.lookAt(camera.position.x - Math.sin(yaw) * dist, 26, camera.position.z - Math.cos(yaw) * dist); camera.updateMatrixWorld(); }
    for (const m of faces) m.quaternion.copy(camera.quaternion);
    gl.getSize(c3Size);
    if (c3Size.x !== W || c3Size.y !== H) gl.setSize(W, H, false);
    gl.setClearColor('#07060a', 1);
    gl.render(scene, camera);
    g.drawImage(gl.domElement, 0, 0, W, H);
  };
  C.dispose = () => {
    if (C.dead) return;
    C.dead = true; for (const x of geos) x.dispose(); for (const m of mats) m.dispose(); scene.clear();
  };
  return C;
}
const V_RIGHT = new THREE.Vector3();

// a canvas that paints the camp while it is on the page; fit(cv) says how big to make it
function campCanvas(cv, o = {}) {
  const C = camp3d();
  if (!C) return;
  if (o.covers) C3.covers.add(cv);
  const t0 = performance.now(), party = campParty(), dpr = Math.min(2, window.devicePixelRatio || 1), g = cv.getContext('2d');
  const frame = () => {
    if (!cv.isConnected) { C3.covers.delete(cv); C.dispose(); return; }
    const W = Math.max(2, Math.round(cv.clientWidth * dpr)), H = Math.max(2, Math.round(cv.clientHeight * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    C.draw(g, W, H, party, (performance.now() - t0) / 1000, { shift: o.shift ? o.shift(W / H) : 0, dist: o.dist, high: o.high });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// the camp screen has it as a banner under its title; the title has it behind everything, the fire off to the side of the menu
const _campScreen = UI.camp;
UI.camp = function (tab) {
  _campScreen(tab);
  const el = UI.top(), bar = el && el.querySelector('.topbar');
  if (!bar) return;
  const cv = h('canvas', { class: 'camp-scene', 'aria-hidden': 'true', style: { width: '100%', maxWidth: '980px', margin: '0 auto', height: '190px', display: 'block', imageRendering: 'auto', background: '#07060a', boxShadow: 'inset 0 0 0 2px var(--soot-4)' } });
  bar.after(cv);
  campCanvas(cv, { dist: 175, high: 60 });
};
const _titleScreen = UI.title;
UI.title = function () {
  _titleScreen();
  const el = UI.top();
  if (!el || !el.classList.contains('title')) return;
  const cv = h('canvas', { class: 'camp-scene', 'aria-hidden': 'true', style: { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: 0, imageRendering: 'auto' } });
  el.prepend(cv);
  const grid = el.querySelector('.tgrid');
  if (grid) { grid.style.position = 'relative'; grid.style.zIndex = 1; }
  campCanvas(cv, { covers: true, dist: 270, high: 90, shift: (aspect) => (aspect > 1.3 ? 70 : 0) });
};
CD.camp3d = () => ({ party: campParty() });
