/* ============================================================
   Cinderdeep — a stage for heroes and beasts. A small scene of
   its own (it shares the circles' renderer): the rig's model on
   a platform over a pool of its path's light, turning slowly in
   its idle. The hero screen stands the chosen hero on one, and
   every portrait in the menus is a still of one. Models come
   from rigmBuild (59-rig-models.js); beasts the rig has no model
   for yet (beetle, plant, shade) keep their sprite portraits.
   ============================================================ */
const ST = { portraits: new Map(), shared: null };

// who stands: a class, or one of a beast's forms, as the rig's models want them
function stageWho(id) {
  const c = CLASS[id];
  if (c && !c.beast) return { cls: id, look: c.look, weapon: { id: c.weapon }, moving: false };
  const F = FORMS[id];
  return F ? { cls: F.line, beast: true, form: id, moving: false } : null;
}
// the model's pose at a moment of ours: the rig reads the game's clock, which a menu does not run
function stageBuild(who, time) {
  const t0 = G.t, M = RigShapes.builder(1);
  G.t = time;
  try { return rigmBuild(who, M); } finally { G.t = t0; }
}

// w and h are the size it is drawn at, in pixels
function stage3d() {
  const gl = c3Gl();
  if (!gl) return null;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(26, 1, 1, 4000), group = new THREE.Group(), parts = RigShapes.placer(group);
  const box = new THREE.BoxGeometry(1, 1, 1), quad = new THREE.PlaneGeometry(1, 1), mats = [];
  const add = (m) => (mats.push(m), m);
  scene.add(group, new THREE.AmbientLight('#ffffff', 1.2));
  const key = new THREE.DirectionalLight('#fff0dc', 2.4), rim = new THREE.DirectionalLight('#7fb8ff', 1.2);
  key.position.set(-60, 120, 100); rim.position.set(90, 50, -90); scene.add(key, rim);
  // the platform, a pool of light on it, and a ring around the pool
  const platform = new THREE.Mesh(box, add(new THREE.MeshLambertMaterial({ color: '#2a2226' })));
  const glow = new THREE.Mesh(quad, add(new THREE.MeshBasicMaterial({ map: c3Glow(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  const ring = new THREE.Mesh(quad, add(new THREE.MeshBasicMaterial({ map: c3Ring(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  glow.rotation.x = ring.rotation.x = -Math.PI / 2; glow.position.y = 0.3; ring.position.y = 0.4;
  scene.add(platform, glow, ring);
  const S = { dead: false };
  // draws who at time, turned by spin, into the 2D context g of W by H pixels (o.pad: how much room round the model); false when there is no model for them
  S.draw = (g, W, H, who, time, spin, o = {}) => {
    const M = stageBuild(who, time);
    if (!M) return false;
    parts.place(M.parts);
    const b = M.bounds, hh = b.h, reach = Math.max(b.r, 14), tan = Math.tan((26 * Math.PI) / 360), aspect = W / H;
    group.position.y = -b.lo[1]; group.rotation.y = Math.PI + spin;
    platform.scale.set(reach * 2.6, 2.5, reach * 2.6); platform.position.y = -1.25 - b.lo[1] * 0 ;
    const col = PATH[skNative(who.cls)].col, R = reach * 2.2;
    glow.scale.set(R * 1.6, R * 1.6, 1); glow.material.color.set(col); ring.scale.set(R, R, 1); ring.material.color.set(col);
    const dist = Math.max((hh * (o.pad || 1.14)) / (2 * tan), (reach * 2.6) / (2 * tan * aspect));
    camera.aspect = aspect; camera.position.set(0, hh * 0.52 + dist * 0.16, dist); camera.lookAt(0, hh * 0.46, 0); camera.updateProjectionMatrix();
    gl.getSize(c3Size);
    if (c3Size.x !== W || c3Size.y !== H) gl.setSize(W, H, false);
    gl.setClearColor('#000000', 0);
    gl.render(scene, camera);
    gl.setClearColor('#060406', 1);
    g.clearRect(0, 0, W, H); g.drawImage(gl.domElement, 0, 0, W, H);
    return true;
  };
  S.dispose = () => {
    if (S.dead) return;
    S.dead = true; box.dispose(); quad.dispose(); for (const m of mats) m.dispose(); scene.clear();
  };
  return S;
}
const c3Size = new THREE.Vector2();

// a still of a class or beast form for a menu, or null when there is no model for it; a canvas of its own each time, sized by the page's CSS
function stagePortrait(id) {
  let still = ST.portraits.get(id);
  if (still === undefined) {
    const who = stageWho(id), S = ST.shared || (ST.shared = stage3d());
    still = null;
    if (who && S) { const cv = mkCanvas(192, 192); if (S.draw(cv.getContext('2d'), 192, 192, who, 0.15, 0.45)) still = cv; }
    ST.portraits.set(id, still);
  }
  if (!still) return null;
  const out = mkCanvas(192, 192);
  out.getContext('2d').drawImage(still, 0, 0);
  out.style.imageRendering = 'auto';
  return out;
}
CD.stage = () => ({ portraits: [...ST.portraits.values()].filter(Boolean).length, missing: [...ST.portraits.entries()].filter(([, v]) => !v).map(([k]) => k) });
