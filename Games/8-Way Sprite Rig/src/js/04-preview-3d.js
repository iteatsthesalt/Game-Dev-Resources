// ---------- the 3D preview: a three.js scene of the parts a painter records ----------
// Parts are capsules (bones), balls (joints, heads, leaves) and quads (faces, wings, capes) in pose
// space. The camera matches the rig's own projection exactly, so the picture lands where the
// sprite would and the stage can draw it in place.
window.Preview3D = (() => {
  let three = null, failed = false;
  const stats = { parts: 0, gl: null };
  const UP = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  const geos = new Map(), mats = new Map(), pool = { round: [], quad: [] };

  function init() {
    if (three || failed) return three;
    try {
      const canvas = document.createElement("canvas");
      // the drawing buffer is kept so the stage (and the tests) can read the picture after the frame
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
      camera.position.set(0, 0, 500);
      // pitch (outer) then turn (inner), the same order as the rig's project()
      const pitch = new THREE.Group(), turn = new THREE.Group();
      pitch.add(turn); scene.add(pitch);
      const sun = new THREE.DirectionalLight(0xffffff, 2.2);
      scene.add(sun, new THREE.HemisphereLight(0xcfe4ff, 0x3a2a24, 1.1));
      three = { renderer, scene, camera, pitch, turn, sun };
    } catch (e) {
      failed = true;
    }
    stats.gl = !!three;
    return three;
  }

  // a capsule along Y: a subdivided box pushed onto a sphere and stretched at the equator.
  // An odd number of rows keeps every vertex off the equator, so none is left unstretched.
  function roundGeo(r, half) {
    const key = `${r.toFixed(2)}:${half.toFixed(1)}`;
    let g = geos.get(key);
    if (g) return g;
    g = new THREE.BoxGeometry(1, 1, 1, 6, 7, 6);
    const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      n.setXYZ(i, v.x, v.y, v.z);
      p.setXYZ(i, v.x * r, v.y * r + Math.sign(v.y) * half, v.z * r);
    }
    g.computeBoundingSphere();
    geos.set(key, g);
    return g;
  }
  const mat = (c, quad) => {
    const key = c + (quad ? ":2" : "");
    if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial({ color: new THREE.Color(c), side: quad ? THREE.DoubleSide : THREE.FrontSide }));
    return mats.get(key);
  };
  const take = (kind, i, make) => {
    const list = pool[kind];
    if (!list[i]) { list[i] = make(); three.turn.add(list[i]); }
    list[i].visible = true;
    return list[i];
  };
  // pose space has its depth axis the other way round from three.js
  const at = (p) => new THREE.Vector3(p[0], p[1], -p[2]);

  function place(parts) {
    let nr = 0, nq = 0;
    // the shape cache empties between frames, before any mesh of this frame has taken a shape from it
    if (geos.size > 400) { for (const x of geos.values()) x.dispose(); geos.clear(); }
    for (const part of parts) {
      if (part.kind === "quad") {
        const m = take("quad", nq++, () => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat("#ffffff", true)));
        const pos = m.geometry.attributes.position, [a, b, c, d = c] = part.pts;
        // PlaneGeometry's corners run top-left, top-right, bottom-left, bottom-right
        for (const [i, q] of [[0, a], [1, b], [3, c], [2, d]]) pos.setXYZ(i, q[0], q[1], -q[2]);
        pos.needsUpdate = true;
        m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere();
        m.material = mat(part.c, true);
        continue;
      }
      const p = at(part.p), q = part.q ? at(part.q) : p, len = p.distanceTo(q);
      const m = take("round", nr++, () => new THREE.Mesh(roundGeo(1, 0), mat("#ffffff")));
      m.geometry = roundGeo(part.r, len / 2);
      m.material = mat(part.c);
      m.position.copy(p).add(q).multiplyScalar(0.5);
      if (len > 1e-4) m.quaternion.setFromUnitVectors(UP, dir.copy(q).sub(p).normalize());
      else m.quaternion.identity();
    }
    for (let i = nr; i < pool.round.length; i++) pool.round[i].visible = false;
    for (let i = nq; i < pool.quad.length; i++) pool.quad[i].visible = false;
    return nr + nq;
  }

  // v: { w, h } the picture in CSS pixels, { cx, cy } where the feet stand, S pixels per unit,
  // rel the turn and elev the pitch in radians, az the light's direction in degrees
  function render(parts, v) {
    if (!init()) return null;
    const { renderer, camera, pitch, turn, sun } = three, dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(dpr);
    renderer.setSize(Math.max(1, Math.round(v.w)), Math.max(1, Math.round(v.h)), false);
    camera.left = -v.cx / v.S; camera.right = (v.w - v.cx) / v.S;
    camera.top = v.cy / v.S; camera.bottom = -(v.h - v.cy) / v.S;
    camera.updateProjectionMatrix();
    pitch.rotation.x = v.elev; turn.rotation.y = -v.rel;
    const az = (v.az * Math.PI) / 180;
    sun.position.set(Math.cos(az), 1.2, Math.sin(az));
    const shown = place(parts);
    renderer.render(three.scene, camera);
    stats.parts = shown;
    return renderer.domElement;
  }
  return { render, get canvas() { return three && three.renderer.domElement; }, stats };
})();
