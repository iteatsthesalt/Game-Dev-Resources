// ---------- the 3D preview: the bench's own three.js scene of a model's parts ----------
// Models and their shapes come from the rig kit (src/kit/). The camera matches the rig's own projection exactly,
// so the picture lands where the sprite would and the stage draws it in place.
window.Preview3D = (() => {
  let three = null, failed = false;
  const stats = { parts: 0, gl: null };

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
      three = { renderer, scene, camera, pitch, turn, sun, rim, parts: window.RigShapes.placer(turn) };
    } catch (e) {
      failed = true;
    }
    stats.gl = !!three;
    return three;
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
    window.RigShapes.flush();
    stats.parts = three.parts.place(parts);
    renderer.render(three.scene, camera);
    return renderer.domElement;
  }
  return { render, get canvas() { return three && three.renderer.domElement; }, stats };
})();
