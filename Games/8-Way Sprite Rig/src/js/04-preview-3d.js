// ---------- the 3D preview: a three.js scene of the parts a model is built from ----------
// A model (05-models-3d.js) is built through a builder into parts in pose space: limbs (tapered
// capsules), balls, ellipsoids, rounded blocks and quads. The camera matches the rig's own
// projection exactly, so the picture lands where the sprite would and the stage draws it in place.
window.Preview3D = (() => {
  let three = null, failed = false;
  const stats = { parts: 0, gl: null };
  const UP = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), basis = new THREE.Matrix4();
  const bx = new THREE.Vector3(), by = new THREE.Vector3(), bz = new THREE.Vector3();
  const geos = new Map(), mats = new Map(), pool = { solid: [], quad: [] };

  function init() {
    if (three || failed) return three;
    try {
      const canvas = document.createElement("canvas");
      // the drawing buffer is kept so the stage (and the tests) can read the picture after the frame
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
      renderer.setClearColor(0x000000, 0);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = 2; // PCF soft shadows
      renderer.toneMapping = 7; // neutral tone mapping: bright lights without washing out the palette
      renderer.toneMappingExposure = 1.3;
      const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 4000);
      camera.position.set(0, 0, 2000);
      // pitch (outer) then turn (inner), the same order as the rig's project()
      const pitch = new THREE.Group(), turn = new THREE.Group();
      pitch.add(turn); scene.add(pitch);
      const sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      const rim = new THREE.DirectionalLight(0x8fd8ff, 2);
      scene.add(sun, sun.target, rim, new THREE.HemisphereLight(0xdbe9ff, 0x4a3a30, 1.7));
      three = { renderer, scene, camera, pitch, turn, sun, rim };
    } catch (e) {
      failed = true;
    }
    stats.gl = !!three;
    return three;
  }

  // ---------- surfaces: value noise shades each vertex and, for fur, leaves, bark and stone, moves it ----------
  const hash = (x, y, z) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  function noise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = smooth(x - xi), fy = smooth(y - yi), fz = smooth(z - zi);
    const l = (a, b, t) => a + (b - a) * t, c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
    return l(l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy), l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy), fz);
  }
  const fbm = (x, y, z) => noise(x, y, z) * 0.65 + noise(x * 2.7 + 17, y * 2.7, z * 2.7) * 0.35;
  // f scales x, y and z before the noise; tone turns noise (0..1) into a shade; bump moves the surface out along
  // its normal, as a share of the shape's size; fine asks for a denser mesh so the surface has points to move
  const PATTERNS = {
    plain: { f: [0, 0, 0], tone: () => 1, bump: 0 },
    cloth: { f: [0.9, 0.9, 0.9], tone: (n) => 0.88 + 0.16 * n, bump: 0 },
    skin: { f: [0.6, 0.6, 0.6], tone: (n) => 0.93 + 0.09 * n, bump: 0 },
    metal: { f: [0.35, 1.6, 0.35], tone: (n) => 0.82 + 0.3 * n * n, bump: 0 },
    wood: { f: [0.12, 2.4, 2.4], tone: (n) => 0.72 + 0.34 * n, bump: 0 },
    fur: { f: [1.1, 1.1, 1.1], tone: (n) => 0.8 + 0.28 * n, bump: 0.05, fine: true },
    scale: { f: [1.4, 1.4, 1.4], tone: (n) => (n > 0.55 ? 1.08 : 0.84), bump: 0.03, fine: true },
    bark: { f: [1.7, 0.22, 1.7], tone: (n) => 0.6 + 0.5 * n, bump: 0.12, fine: true },
    leaf: { f: [0.38, 0.38, 0.38], tone: (n) => 0.68 + 0.46 * n, bump: 0.26, fine: true },
    stone: { f: [0.45, 0.45, 0.45], tone: (n) => 0.7 + 0.38 * n, bump: 0.05, fine: true },
    slab: { f: [0.12, 0.6, 0.12], tone: (n) => 0.78 + 0.3 * n, bump: 0 },
  };
  // the same pattern on a shape: shade every vertex, and move it out along its normal by the noise
  function surface(g, pat, size) {
    const P = PATTERNS[pat] || PATTERNS.plain, p = g.attributes.position, n = g.attributes.normal, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), v = P.f[0] ? fbm(x * P.f[0] + 31, y * P.f[1], z * P.f[2]) : 0.5, t = P.tone(v);
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = t;
      if (P.bump) { const d = (v - 0.45) * P.bump * size; p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d); }
    }
    // the bundle has no BufferAttribute of its own; the position attribute's class is the same thing
    g.setAttribute("color", new p.constructor(col, 3));
    if (P.bump) g.computeVertexNormals();
    return g;
  }
  // a subdivided box whose shared edges are welded, so bumps and normals do not split along the box's seams
  const ball = (fine) => { const s = fine ? 14 : 8; return new THREE.BoxGeometry(1, 1, 1, s, s + 1, s); };

  // ---------- shapes, each made once and shared ----------
  const shape = (key, make) => { let g = geos.get(key); if (!g) { g = make(); g.computeBoundingSphere(); geos.set(key, g); } return g; };
  // a tapered capsule along Y: a subdivided box pushed onto a sphere, its halves given their own radius and
  // pulled apart. An odd number of rows keeps every vertex off the equator. flat and flatTop squash the caps
  // (0.02 makes a cylinder's flat end); normals follow the squash.
  const limbGeo = (r1, r2, half, flat = 1, flatTop = 1, pat = "plain") => shape(`L${r1.toFixed(2)}:${r2.toFixed(2)}:${half.toFixed(1)}:${flat}:${flatTop}:${pat}`, () => {
    const g = ball((PATTERNS[pat] || PATTERNS.plain).fine), p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3(), m = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const top = v.y > 0, r = top ? r2 : r1, f = top ? flatTop : flat;
      m.set(v.x, v.y / f, v.z).normalize();
      n.setXYZ(i, m.x, m.y, m.z);
      p.setXYZ(i, v.x * r, top ? v.y * r * f + half : v.y * r * f - half, v.z * r);
    }
    return surface(weld(g), pat, Math.max(r1, r2));
  });
  // a box with rounded edges: each point is pulled onto the inner box and pushed back out by the radius
  const blockGeo = (hx, hy, hz, r, pat = "plain") => shape(`B${hx.toFixed(1)}:${hy.toFixed(1)}:${hz.toFixed(1)}:${r.toFixed(1)}:${pat}`, () => {
    const g = new THREE.BoxGeometry(1, 1, 1, 6, 6, 6), p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3(), c = new THREE.Vector3();
    const size = new THREE.Vector3(hx * 2, hy * 2, hz * 2), k = [hx, hy, hz].map((e) => Math.max(0, e - r));
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).multiply(size);
      c.set(Math.max(-k[0], Math.min(k[0], v.x)), Math.max(-k[1], Math.min(k[1], v.y)), Math.max(-k[2], Math.min(k[2], v.z)));
      v.sub(c).normalize();
      n.setXYZ(i, v.x, v.y, v.z);
      p.setXYZ(i, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r);
    }
    return surface(weld(g), pat, Math.min(hx, hy, hz));
  });
  // BoxGeometry gives each face its own copy of an edge's points; point the copies at one index so they move together
  function weld(g) {
    const p = g.attributes.position, idx = g.index.array, seen = new Map(), map = new Uint32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const key = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
      if (!seen.has(key)) seen.set(key, i);
      map[i] = seen.get(key);
    }
    for (let i = 0; i < idx.length; i++) idx[i] = map[idx[i]];
    g.index.needsUpdate = true;
    return g;
  }
  const mat = (c, o) => {
    const key = `${c}:${o.glow ? "g" : ""}${o.ghost ? "h" : ""}${o.quad ? "q" : ""}`;
    if (!mats.has(key)) {
      const side = o.quad ? THREE.DoubleSide : THREE.FrontSide, opts = { color: new THREE.Color(c), side, transparent: !!o.ghost, opacity: o.ghost ? 0.3 : 1, vertexColors: !o.quad };
      mats.set(key, o.glow ? new THREE.MeshBasicMaterial(opts) : new THREE.MeshLambertMaterial({ ...opts, depthWrite: !o.ghost }));
    }
    return mats.get(key);
  };

  // ---------- the builder a model draws into: pose-space points, scaled by k and moved by off ----------
  // A frame is { x, y, z }: three unit vectors in pose space, x right, y up, z forward. Options o: pat (a surface
  // pattern), glow (lit by itself, casts no shadow), flat and flatTop (squash a limb's ends).
  function builder(k = 1, off = [0, 0, 0], ghost = false) {
    const parts = [], lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const at = (p) => [p[0] * k + off[0], p[1] * k + off[1], p[2] * k + off[2]];
    const grow = (p, r) => { for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i] - r); hi[i] = Math.max(hi[i], p[i] + r); } };
    const put = (part, pts, r) => { for (const p of pts) grow(p, r); parts.push({ ghost, ...part }); };
    return {
      parts, k,
      // the space it takes, in the builder's own units: height, and reach from the middle in x and z
      get bounds() { return { lo, hi, h: hi[1], r: Math.max(Math.abs(lo[0]), Math.abs(hi[0]), Math.abs(lo[2]), Math.abs(hi[2])) }; },
      limb(p, q, r1, r2 = r1, c, o = {}) { const a = at(p), b = at(q); put({ kind: "limb", p: a, q: b, r1: r1 * k, r2: r2 * k, flat: o.flat || 1, flatTop: o.flatTop || 1, c, pat: o.pat, glow: o.glow }, [a, b], Math.max(r1, r2) * k); },
      ball(p, r, c, o = {}) { const a = at(p); put({ kind: "limb", p: a, q: a, r1: r * k, r2: r * k, flat: 1, flatTop: 1, c, pat: o.pat, glow: o.glow }, [a], r * k); },
      ellipsoid(p, f, rad, c, o = {}) { const a = at(p); put({ kind: "ellipsoid", p: a, f, rad: rad.map((x) => x * k), c, pat: o.pat, glow: o.glow }, [a], Math.max(...rad) * k); },
      block(p, f, half, r, c, o = {}) { const a = at(p); put({ kind: "block", p: a, f, half: half.map((x) => x * k), r: r * k, c, pat: o.pat, glow: o.glow }, [a], Math.max(...half) * k); },
      quad(pts, c) { const q = pts.map(at); put({ kind: "quad", pts: q, c }, q, 0); },
    };
  }

  // ---------- placing parts in the scene ----------
  const take = (kind, i, make) => {
    const list = pool[kind];
    if (!list[i]) { list[i] = make(); list[i].castShadow = list[i].receiveShadow = true; three.turn.add(list[i]); }
    list[i].visible = true;
    return list[i];
  };
  // pose space has its depth axis the other way round from three.js
  const at3 = (p) => new THREE.Vector3(p[0], p[1], -p[2]);
  // a frame turned into three.js space; z flips sign with the depth axis, which keeps the basis a rotation
  // (every shape is symmetric front to back, so the flip does not change it)
  const orient = (m, f) => {
    bx.set(f.x[0], f.x[1], -f.x[2]); by.set(f.y[0], f.y[1], -f.y[2]); bz.set(-f.z[0], -f.z[1], f.z[2]);
    m.quaternion.setFromRotationMatrix(basis.makeBasis(bx, by, bz));
  };

  function place(parts) {
    let ns = 0, nq = 0;
    // the shape cache empties between frames, before any mesh of this frame has taken a shape from it
    if (geos.size > 600) { for (const g of geos.values()) g.dispose(); geos.clear(); }
    for (const part of parts) {
      const o = { glow: part.glow, ghost: part.ghost };
      if (part.kind === "quad") {
        const m = take("quad", nq++, () => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat("#ffffff", { quad: true })));
        const pos = m.geometry.attributes.position, [a, b, c, d = c] = part.pts;
        // PlaneGeometry's corners run top-left, top-right, bottom-left, bottom-right
        for (const [i, q] of [[0, a], [1, b], [3, c], [2, d]]) pos.setXYZ(i, q[0], q[1], -q[2]);
        pos.needsUpdate = true;
        m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere();
        m.material = mat(part.c, { ...o, quad: true });
        m.castShadow = !part.ghost;
        continue;
      }
      const m = take("solid", ns++, () => new THREE.Mesh(limbGeo(1, 1, 0, 1), mat("#ffffff", {})));
      m.material = mat(part.c, o);
      m.castShadow = !part.ghost && !part.glow; m.receiveShadow = !part.ghost;
      m.scale.set(1, 1, 1);
      if (part.kind === "limb") {
        const p = at3(part.p), q = at3(part.q), len = p.distanceTo(q);
        m.geometry = limbGeo(part.r1, part.r2, len / 2, part.flat, part.flatTop, part.pat);
        m.position.copy(p).add(q).multiplyScalar(0.5);
        if (len > 1e-4) m.quaternion.setFromUnitVectors(UP, dir.copy(q).sub(p).normalize());
        else m.quaternion.identity();
      } else if (part.kind === "ellipsoid") {
        m.geometry = limbGeo(1, 1, 0, 1, 1, part.pat);
        m.position.copy(at3(part.p)); m.scale.set(...part.rad); orient(m, part.f);
      } else {
        m.geometry = blockGeo(...part.half, Math.min(part.r, ...part.half), part.pat);
        m.position.copy(at3(part.p)); orient(m, part.f);
      }
    }
    for (let i = ns; i < pool.solid.length; i++) pool.solid[i].visible = false;
    for (let i = nq; i < pool.quad.length; i++) pool.quad[i].visible = false;
    return ns + nq;
  }

  // v: { w, h } the picture in CSS pixels, { cx, cy } where the feet stand, S pixels per unit,
  // rel the turn and elev the pitch in radians, az the light's direction in degrees, reach the model's size
  function render(parts, v) {
    if (!init()) return null;
    const { renderer, camera, pitch, turn, sun, rim } = three, dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(dpr);
    renderer.setSize(Math.max(1, Math.round(v.w)), Math.max(1, Math.round(v.h)), false);
    camera.left = -v.cx / v.S; camera.right = (v.w - v.cx) / v.S;
    camera.top = v.cy / v.S; camera.bottom = -(v.h - v.cy) / v.S;
    camera.updateProjectionMatrix();
    pitch.rotation.x = v.elev; turn.rotation.y = -v.rel;
    // the sun follows the bench's light direction; its shadow box is fitted round the model
    const az = (v.az * Math.PI) / 180, R = Math.max(10, v.reach);
    sun.position.set(Math.cos(az) * R * 2, R * 2.6, Math.sin(az) * R * 2 + R);
    sun.target.position.set(0, R * 0.4, 0);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -R * 1.4; sc.right = sc.top = R * 1.4; sc.near = 1; sc.far = R * 8;
    sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = R * 0.004;
    rim.position.set(-Math.cos(az) * R, R * 1.2, -R * 2);
    stats.parts = place(parts);
    renderer.render(three.scene, camera);
    return renderer.domElement;
  }
  return { render, builder, get canvas() { return three && three.renderer.domElement; }, stats };
})();
