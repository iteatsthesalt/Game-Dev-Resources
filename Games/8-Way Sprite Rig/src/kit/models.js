// ---------- the rig kit: 3D models, each subject's skeleton dressed in solid shapes ----------
// Shared by the 8-Way Sprite Rig and Cinderdeep 3D.
// A model reads the pose's joints (pose units, y up, z forward) and the look, and builds into M,
// a RigShapes builder. o carries the head size (hk), the rig's metal colours, and heavy for the Golem.
window.RigModels = (() => {
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(...a) || 1; return mul(a, 1 / l); };
  // a point offset along a frame: f.x * x + f.y * y + f.z * z
  const off = (p, f, x, y, z) => add(p, add(add(mul(f.x, x), mul(f.y, y)), mul(f.z, z)));
  const UPV = [0, 1, 0];
  // frames: y is kept and z (or x) is made square to it
  const frameYZ = (y, zHint) => { y = norm(y); const z = norm(sub(zHint, mul(y, dot(zHint, y)))); return { x: cross(y, z), y, z }; };
  const frameZY = (z, yHint) => { z = norm(z); const y = norm(sub(yHint, mul(z, dot(yHint, z)))); return { x: cross(y, z), y, z }; };
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16), c = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return "#" + ((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, "0");
  };

  // ---------- people: the character, and the Golem built heavier ----------
  const ENCHANT = { fire: "#ff7a28", frost: "#78dcff", storm: "#fff064", venom: "#82eb50", void: "#be64ff" };
  // look.bones: a skeleton; look.robe: a robe to the ground; look.float: no legs, the body trailing off into a wisp
  function figure(j, look, M, o) {
    const pal = look.pal, heavy = !!o.heavy, bones = !!look.bones, w = heavy ? 1.35 : bones ? 0.45 : 1, hk = o.hk || 1, { STEEL, CREST, VISOR } = o;
    const up = norm(sub(j.neck, j.hip)), fwd = norm(sub(j.visor, j.head));
    const B = frameYZ(up, fwd.map((v, i) => (i === 1 ? 0 : v)));
    const P = frameYZ(up, cross(norm(sub(j.hpR, j.hpL)), up));
    const cloth = heavy ? "metal" : "cloth", skin = heavy ? { pat: "stone" } : { pat: "skin" };
    const boot = heavy ? shade(pal.pants, 0.7) : "#3a2a22", sole = "#1e1612", leather = "#5a3d24";
    const core = ENCHANT[look.enchant] || "#00e5ff";
    // hips, tunic, belly, chest, collar and belt; a skeleton has a spine, ribs and a pelvis instead
    if (bones) {
      M.limb(j.hip, j.neck, 0.7, 0.6, pal.skin, { pat: "stone" });
      M.ellipsoid(off(j.hip, P, 0, 0.8, 0), P, [2.6, 1.2, 1.6], pal.skin, { pat: "stone" });
      for (let i = 0; i < 4; i++) { const at = lerp(j.hip, j.chest, 0.45 + i * 0.17); M.ellipsoid(off(at, B, 0, 0, 0.6), B, [3.6 - i * 0.2, 0.45, 2.2], pal.skin, { pat: "stone" }); }
    } else {
    M.block(off(j.hip, P, 0, 1, 0), P, [4.3 * w, 2.7, 2.7 * w], 1.4, pal.pants, { pat: cloth });
    if (!heavy) M.limb(off(j.hip, P, 0, -3.4, 0), off(j.hip, P, 0, 1.6, 0), 4.7, 4.3, shade(pal.shirt, 0.88), { flat: 0.04, flatTop: 0.04, pat: "cloth" });
    M.block(lerp(j.hip, j.chest, 0.38), B, [3.9 * w, 3.4, 2.5 * w], 1.6, pal.shirt, { pat: cloth });
    M.block(off(j.chest, B, 0, -1, -0.2), B, [4.9 * w, 3.7, 3 * w], 1.9, pal.shirt, { pat: cloth });
    if (heavy) {
      for (const sx of [-1, 1]) M.block(off(j.chest, B, sx * 2.3, -0.6, 2.4), B, [2, 2.6, 0.7], 0.6, shade(pal.shirt, 1.15), { pat: "metal" });
      M.ball(off(j.chest, B, 0, -1.4, 3), 1.5, core, { glow: true });
    } else M.limb(off(j.chest, B, 0, 2.2, -0.4), off(j.chest, B, 0, 3.1, -0.2), 2.9, 2.2, shade(pal.shirt, 0.78), { flat: 0.4, flatTop: 0.4, pat: "cloth" });
    M.block(off(j.hip, P, 0, 2.6, 0), P, [4.3 * w, 0.75, 2.85 * w], 0.5, heavy ? pal.gear : leather, { pat: "cloth" });
    M.block(off(j.hip, P, 0, 2.6, 2.85 * w), P, [1, 0.9, 0.3], 0.2, "#ffd35c", { pat: "metal" });
    if (!heavy) M.block(off(j.hip, P, 3.6, 1.4, 1.2), P, [1, 1.3, 0.9], 0.5, leather, { pat: "cloth" });
    M.limb(off(j.chest, B, 0, 2, 0), off(j.neck, B, 0, 1, 0), 1.4 * w, 1.3 * w, pal.skin, skin);
    }
    // a robe falls from the hips to the ground; a floating body trails off below them
    if (look.robe) M.limb([j.hip[0], 0.6, j.hip[2]], off(j.hip, P, 0, 2.4, 0), 6, 4.2, shade(pal.shirt, 0.9), { flat: 0.05, flatTop: 0.3, pat: "cloth" });
    if (look.float) M.limb([j.hip[0], 3, j.hip[2] - 1.5], off(j.hip, P, 0, 2, 0), 0.6, 4.4, pal.shirt, { flat: 0.3, pat: "cloth" });
    // arms: shoulder, sleeve, cuff, bare forearm, fist and thumb
    for (const s of ["L", "R"]) {
      const sh = j["sh" + s], el = j["el" + s], ha = j["ha" + s], fa = norm(sub(ha, el)), Hf = frameYZ(fa, B.z);
      M.ball(sh, 2.1 * w, bones ? pal.skin : pal.shirt, { pat: bones ? "stone" : cloth });
      M.limb(sh, el, 1.85 * w, 1.5 * w, bones ? pal.skin : pal.shirt, { pat: bones ? "stone" : cloth });
      if (heavy) M.ball(el, 1.75 * w, pal.gear, { pat: "metal" });
      else if (!bones) M.limb(lerp(sh, el, 0.82), lerp(sh, el, 1.04), 1.62, 1.62, shade(pal.shirt, 0.8), { flat: 0.4, flatTop: 0.4, pat: "cloth" });
      M.limb(el, ha, 1.45 * w, 1.15 * w, heavy ? pal.gear : pal.skin, heavy ? { pat: "metal" } : skin);
      if (!heavy && !bones) M.limb(lerp(el, ha, 0.45), lerp(el, ha, 0.9), 1.4, 1.3, leather, { flat: 0.5, flatTop: 0.5, pat: "cloth" });
      M.block(add(ha, mul(fa, 0.5)), Hf, [1.15 * w, 1.35 * w, 1.25 * w], 0.6 * w, heavy ? pal.gear : pal.skin, heavy ? { pat: "metal" } : skin);
      M.limb(off(ha, Hf, 0, 0, 0.9 * w), off(ha, Hf, 0, 1.2 * w, 1.5 * w), 0.45 * w, 0.4 * w, heavy ? pal.gear : pal.skin, skin);
    }
    // legs: thigh, shin, knee, boot with its cuff and sole, pointing where the body faces
    const toe = norm([B.z[0], 0, B.z[2]]), F = frameYZ(UPV, toe);
    for (const s of ["L", "R"]) {
      if (look.float) break;
      const hp = j["hp" + s], kn = j["kn" + s], ft = j["ft" + s];
      const leg = bones ? pal.skin : pal.pants, legPat = bones ? "stone" : cloth;
      M.limb(hp, kn, 2.35 * w, 1.85 * w, leg, { pat: legPat });
      M.limb(kn, ft, 1.8 * w, 1.35 * w, leg, { pat: legPat });
      if (bones) continue;
      M.ball(kn, 1.95 * w, heavy ? pal.gear : shade(pal.pants, 0.9), { pat: heavy ? "metal" : "cloth" });
      M.limb(add(ft, [0, 1.6, 0]), add(ft, [0, 4.2, 0]), 1.75 * w, 1.85 * w, boot, { flat: 0.4, flatTop: 0.3, pat: "cloth" });
      M.block(off(ft, F, 0, 1.25, 0.9 * w), F, [1.6 * w, 1.25, 2.8 * w], 0.85, boot, { pat: "cloth" });
      M.block(off(ft, F, 0, 0.25, 0.95 * w), F, [1.7 * w, 0.28, 2.95 * w], 0.2, sole);
    }
    // the head: skull, ears, eyes with brows, nose and mouth, hair; then whatever is worn on it
    const head = j.head, H = frameYZ(norm(sub(j.head, j.neck)), fwd), h = (v) => v * hk;
    const face = (x, y, z) => off(head, H, h(x), h(y), h(z));
    if (bones) {
      // a skull: dark sockets with a light in them, a jaw; whatever is worn goes on as on anyone
      M.block(head, H, [h(3), h(3.2), h(3.1)], h(2.2), pal.skin, { pat: "stone" });
      for (const sx of [-1, 1]) { M.ball(face(sx * 1.2, 0.2, 2.6), h(0.9), "#1a0a10"); M.ball(face(sx * 1.2, 0.2, 3.1), h(0.4), look.eye || "#ff4a4a", { glow: true }); }
      M.block(face(0, -2.6, 0.9), H, [h(2.1), h(0.8), h(1.8)], h(0.4), shade(pal.skin, 0.85), { pat: "stone" });
    } else {
    M.block(head, H, [h(3.1), h(3.4), h(3.2)], h(2.1), pal.skin, skin);
    for (const sx of [-1, 1]) {
      M.ellipsoid(face(sx * 3.1, -0.1, -0.3), H, [h(0.55), h(1.05), h(0.8)], pal.skin, skin);
      if (heavy) M.ball(face(sx * 1.2, 0.3, 3), h(0.6), core, { glow: true });
      else {
        M.ball(face(sx * 1.2, 0.3, 2.85), h(0.62), "#f4f1ea");
        M.ball(face(sx * 1.2, 0.3, 3.3), h(0.34), VISOR);
        M.block(face(sx * 1.25, 1.25, 3.05), H, [h(0.8), h(0.2), h(0.25)], h(0.12), pal.hair);
      }
    }
    M.limb(face(0, 0.1, 3), face(0, -0.8, 3.75), h(0.4), h(0.55), shade(pal.skin, 0.92), skin);
    if (!heavy) M.block(face(0, -1.75, 3.05), H, [h(0.9), h(0.16), h(0.2)], h(0.1), shade(pal.skin, 0.55));
    }
    const hair = () => {
      M.block(face(0, 1.05, -0.55), H, [h(3.35), h(2.6), h(3.2)], h(2.2), pal.hair, { pat: "fur" });
      M.block(face(0, 2.2, 2.4), H, [h(2.9), h(0.75), h(1)], h(0.6), pal.hair, { pat: "fur" });
      M.block(face(0, -1.2, -2.6), H, [h(3), h(2.2), h(1)], h(0.9), pal.hair, { pat: "fur" });
    };
    const hd = look.head;
    if (hd === "helmet" || hd === "viking") {
      M.block(face(0, 0.4, -0.1), H, [h(3.6), h(3.8), h(3.55)], h(2.4), STEEL, { pat: "metal" });
      M.block(face(0, 0.3, 3.5), H, [h(2.5), h(0.4), h(0.3)], h(0.2), VISOR);
      for (const sx of [-1, 1]) M.block(face(sx * 2.6, -1.8, 2.4), H, [h(0.6), h(1.6), h(1.2)], h(0.4), shade(STEEL, 0.85), { pat: "metal" });
      M.block(face(0, 1.6, 0), H, [h(0.45), h(2.5), h(3.7)], h(0.3), shade(STEEL, 1.1), { pat: "metal" });
      if (hd === "helmet") for (let i = 0; i < 4; i++) { const a = lerp(j.crest0, j.crest1, i / 3); M.limb(a, off(a, H, 0, h(1.4 - i * 0.2), h(-1.2 - i * 0.4)), h(0.9), h(0.35), CREST, { pat: "fur" }); }
      else for (const sx of [-1, 1]) {
        const base = face(sx * 3, 2, 0), mid = face(sx * 5.4, 3.6, 0.2);
        M.limb(base, mid, h(1), h(0.65), "#efe6d0"); M.limb(mid, face(sx * 5.6, 6.6, 0.6), h(0.65), h(0.12), "#efe6d0");
      }
    } else if (hd === "hood" || hd === "plague") {
      const cl = hd === "hood" ? pal.gear : "#2b2d38";
      M.block(face(0, 0.5, -0.9), H, [h(3.75), h(3.95), h(3.4)], h(2.6), cl, { pat: "cloth" });
      M.limb(face(0, -3, -1.2), face(0, -2, 1.8), h(3.2), h(3.6), cl, { flat: 0.5, flatTop: 0.5, pat: "cloth" });
      if (hd === "hood") M.limb(j.hood0, j.hood1, h(2), h(0.5), cl, { pat: "cloth" });
      else { M.limb(face(0, -0.3, 3.2), face(0, -2.4, 8), h(1.25), h(0.2), "#d8d0c0"); for (const sx of [-1, 1]) M.ball(face(sx * 1.3, 0.5, 3.4), h(0.75), "#7cf9ff", { glow: true }); }
    } else if (hd === "hat") {
      hair();
      M.limb(add(j.hat0, mul(H.y, -h(0.3))), add(j.hat0, mul(H.y, h(0.3))), h(6.8), h(6.6), shade(pal.gear, 0.8), { flat: 0.08, flatTop: 0.08, pat: "cloth" });
      M.limb(j.hat0, j.hat1, h(4.2), h(2.4), pal.gear, { flat: 0.3, pat: "cloth" });
      M.limb(j.hat1, j.hat2, h(2.4), h(0.3), pal.gear, { pat: "cloth" });
      M.limb(add(j.hat0, mul(H.y, h(0.6))), add(j.hat0, mul(H.y, h(1.4))), h(4.3), h(4.1), "#ffd35c", { flat: 0.2, flatTop: 0.2, pat: "metal" });
    } else if (hd === "crown") {
      hair();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2, base = face(Math.cos(a) * 2.9, 3.2, Math.sin(a) * 2.9);
        M.limb(base, off(base, H, 0, h(2.3), 0), h(0.75), h(0.12), "#ffd35c", { pat: "metal" });
        M.ball(off(base, H, 0, h(0.2), 0), h(0.45), i % 2 ? "#ff3d7f" : "#00e5ff", { glow: true });
      }
      M.limb(face(0, 2.6, 0), face(0, 3.6, 0), h(3.3), h(3.3), "#ffd35c", { flat: 0.1, flatTop: 0.1, pat: "metal" });
    } else if (hd === "horns") {
      hair();
      for (const sx of [-1, 1]) { const b = face(sx * 2.4, 2.6, 0.4), m = face(sx * 4.6, 4.6, -0.6); M.limb(b, m, h(0.95), h(0.6), "#3a1a20", { pat: "stone" }); M.limb(m, face(sx * 5.4, 7, -2), h(0.6), h(0.1), "#3a1a20", { pat: "stone" }); }
    } else if (!bones) hair();
    if (hd === "halo") for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; M.ball(off(j.hat1, H, h(Math.cos(a) * 4.8), 0, h(Math.sin(a) * 4.8)), h(0.5), "#fff27a", { glow: true }); }
    // pauldrons
    const pd = look.pauldron;
    if (pd && pd !== "none") for (const s of ["L", "R"]) {
      const sh = off(j["sh" + s], B, 0, 0.7, 0), sx = s === "L" ? -1 : 1;
      if (pd === "plate") { M.ellipsoid(sh, B, [3.1 * w, 2 * w, 3.1 * w], STEEL, { pat: "metal" }); M.ellipsoid(off(sh, B, sx * 0.8 * w, -1.4, 0), B, [2.8 * w, 1.4 * w, 2.9 * w], shade(STEEL, 0.85), { pat: "metal" }); }
      else if (pd === "fur") M.ellipsoid(sh, B, [3.4 * w, 2.3 * w, 3.4 * w], shade(pal.gear, 1.25), { pat: "fur" });
      else if (pd === "orbs") { M.ellipsoid(sh, B, [2.8 * w, 1.7 * w, 2.8 * w], "#2a3448", { pat: "metal" }); M.ball(off(sh, B, sx * 1.2, 1.6, 0), 1.2, "#00e5ff", { glow: true }); }
      else if (pd === "spikes") { M.ellipsoid(sh, B, [3 * w, 2 * w, 3 * w], "#454b59", { pat: "metal" }); for (const dz of [-1.4, 0, 1.4]) M.limb(off(sh, B, sx * 0.6, 1.4, dz), off(sh, B, sx * 1.6, 4.6, dz * 1.3), 0.7, 0.08, "#e5e8ef", { pat: "metal" }); }
      else M.ellipsoid(sh, B, [3 * w, 2 * w, 3 * w], pal.gear, { pat: "cloth" });
    }
    // the back: pack, quiver, cape, wings, banner or crystal
    const bk = look.back, back = (y, z) => off(j.chest, B, 0, y, z);
    if (bk === "pack") {
      M.block(back(-3, -4.4), B, [3.2, 4.2, 1.8], 1.1, pal.gear, { pat: "cloth" });
      M.block(back(-5.6, -6), B, [2.6, 1.6, 0.8], 0.6, shade(pal.gear, 0.85), { pat: "cloth" });
      M.limb(off(back(1.4, -4.4), B, -3.3, 0, 0), off(back(1.4, -4.4), B, 3.3, 0, 0), 1.2, 1.2, "#8a6236", { pat: "cloth" });
      for (const sx of [-2.4, 2.4]) M.limb(off(back(2.6, 1.9), B, sx, 0, 0), off(back(-6, 2.4), B, sx, 0, 0), 0.35, 0.35, leather);
    }
    if (bk === "quiver") {
      M.limb(back(-6, -3.8), back(4, -3.6), 1.6, 1.7, "#6b4426", { pat: "cloth" });
      for (const x of [-0.7, 0, 0.7]) { const t = off(back(8, -3.4), B, x, 0, 0); M.limb(back(4, -3.6), t, 0.22, 0.22, "#d9dde3", { pat: "wood" }); M.block(t, B, [0.5, 0.9, 0.08], 0.05, "#c8372d"); }
    }
    if (bk === "cape") {
      const TL = j.capeTL, TR = j.capeTR, BL = j.capeBL, BR = j.capeBR, rows = 3;
      for (let i = 0; i < rows; i++) {
        const a = i / rows, b = (i + 1) / rows, bow = (t) => -1.1 * Math.sin(t * Math.PI);
        const L0 = off(lerp(TL, BL, a), B, 0, 0, bow(a)), R0 = off(lerp(TR, BR, a), B, 0, 0, bow(a)), L1 = off(lerp(TL, BL, b), B, 0, 0, bow(b)), R1 = off(lerp(TR, BR, b), B, 0, 0, bow(b));
        M.quad([L0, R0, R1, L1], shade(pal.gear, 1 - i * 0.08));
      }
      for (const sx of [-1, 1]) M.ball(off(j.chest, B, sx * 3.6, 1.6, 1.2), 0.8, "#ffd35c");
    }
    if (bk === "wings") {
      // feathered: a bone along the top, and long feathers fanned beneath it
      for (const sx of [-1, 1]) {
        const root = back(0, -3), tip = off(root, B, sx * 13, 9, -3);
        M.limb(root, tip, 1.1, 0.4, "#eef6ff", { pat: "fur" });
        // long flight feathers fanned beneath the bone, then a row of short coverts over their roots
        for (let i = 0; i < 10; i++) {
          const b0 = lerp(root, tip, 0.08 + i * 0.1), len = 7 + i * 1.1, d = norm(add(mul(B.x, sx * (0.1 + i * 0.09)), add(mul(B.y, -1), mul(B.z, -0.25 - i * 0.02)))), e = mul(norm(cross(d, B.z)), 1.6);
          const t0 = add(b0, mul(d, len));
          M.quad([add(b0, e), sub(b0, e), sub(t0, mul(e, 0.55)), add(t0, mul(e, 0.55))], shade("#eef6ff", 0.92 + (i % 2) * 0.08));
        }
        for (let i = 0; i < 6; i++) {
          const b0 = lerp(root, tip, 0.1 + i * 0.15), d = norm(add(mul(B.x, sx * 0.3), add(mul(B.y, -1), mul(B.z, 0.15)))), e = mul(norm(cross(d, B.z)), 1.7);
          const t0 = add(b0, mul(d, 3.6));
          M.quad([add(b0, e), sub(b0, e), sub(t0, mul(e, 0.8)), add(t0, mul(e, 0.8))], "#ffffff");
        }
      }
    }
    if (bk === "dwings") {
      // a bat's wing: an arm, three fingers, and skin stretched between them
      for (const sx of [-1, 1]) {
        const root = back(0, -3), wrist = off(root, B, sx * 9, 8, -3), tips = [off(wrist, B, sx * 7, 3, -1), off(wrist, B, sx * 6, -4, -1.5), off(wrist, B, sx * 3, -9, -1.5)];
        M.limb(root, wrist, 0.9, 0.6, "#3a1420"); for (const t of tips) M.limb(wrist, t, 0.55, 0.12, "#3a1420");
        M.quad([root, wrist, tips[2], off(root, B, sx * 1, -9, -1)], "#8a1e38");
        M.quad([wrist, tips[0], tips[1], tips[1]], "#8a1e38"); M.quad([wrist, tips[1], tips[2], tips[2]], shade("#8a1e38", 0.85));
      }
    }
    if (bk === "banner") {
      M.limb(j.pack0, j.hat2, 0.6, 0.6, "#8a6236", { pat: "wood" });
      M.ball(j.hat2, 1, "#ffd35c", { pat: "metal" });
      const top = lerp(j.pack0, j.hat2, 0.95), low = lerp(j.pack0, j.hat2, 0.55), mid = lerp(top, low, 0.5);
      M.quad([top, off(top, B, 8, 0, -0.6), off(mid, B, 8.4, 0, 0.4), mid], pal.gear);
      M.quad([mid, off(mid, B, 8.4, 0, 0.4), off(low, B, 6.5, -1.5, -0.4), low], shade(pal.gear, 0.88));
    }
    if (bk === "crystal") { M.ellipsoid(back(3, -4.5), B, [2, 3.6, 2], "#00e5ff", { glow: true }); M.block(back(-1.5, -4), B, [2, 1, 1.2], 0.4, "#454b59", { pat: "metal" }); }
    props(j, look, M, B, o);
  }

  // ---------- what the hands hold, held along the forearm as the sprite holds it ----------
  function props(j, look, M, B, o) {
    const wood = "#6b4a2a", steel = o.STEEL, gold = "#d4a63a", glow = ENCHANT[look.enchant];
    for (const [side, kind] of [["R", look.right], ["L", look.left]]) {
      if (!kind || kind === "none") continue;
      const ha = j["ha" + side], el = j["el" + side], dir = norm(sub(ha, el));
      // the blade's flat faces sideways from the body; across is its edge-to-edge direction
      const G = frameYZ(dir, cross(dir, B.y).some((v) => Math.abs(v) > 1e-3) ? norm(cross(dir, B.y)) : B.x), at = (t) => add(ha, mul(dir, t));
      if (kind === "torch") {
        const top = add(ha, [0, 7, 1.6]);
        M.limb(add(ha, [0, -2, -0.4]), top, 0.55, 0.7, wood, { pat: "wood" });
        M.limb(add(top, [0, -1.4, 0]), add(top, [0, 0.4, 0]), 1, 1.1, "#3a2a1e", { pat: "cloth" });
        M.limb(add(top, [0, 0.6, 0]), add(top, [0, 4, 0]), 1.3, 0.2, "#ff7a2e", { glow: true });
        M.limb(add(top, [0, 0.8, 0]), add(top, [0, 2.8, 0]), 0.8, 0.15, "#ffcf6b", { glow: true });
      } else if (kind === "sword" || kind === "frostblade" || kind === "dagger") {
        const len = kind === "dagger" ? 7 : 13, ice = kind === "frostblade", wide = kind === "dagger" ? 0.6 : 0.95;
        M.block(at(1.6 + len / 2), G, [0.18, len / 2, wide], 0.12, ice ? "#8cf4ff" : "#c9d1dc", { pat: "metal", glow: ice });
        M.limb(at(1.6 + len - 0.3), at(1.6 + len + 1.6), wide * 0.9, 0.05, ice ? "#d8fbff" : "#e5e8ef", { glow: ice });
        M.block(at(1.4), G, [0.45, 0.35, kind === "dagger" ? 1.6 : 2.6], 0.2, gold, { pat: "metal" });
        M.limb(at(-2.4), at(1.2), 0.55, 0.55, "#4a3628", { pat: "cloth" });
        M.ball(at(-2.6), 0.8, gold, { pat: "metal" });
        if (glow) M.ball(at(1.6 + len), 0.9, glow, { glow: true });
      } else if (kind === "staff") {
        const lo = add(ha, [0, -9, -0.2]), hi = add(ha, [0, 15, 0.8]);
        M.limb(lo, hi, 0.55, 0.5, wood, { pat: "wood" });
        M.ball(hi, 2.1, "#b9a6ff", { glow: true });
        for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2, b = add(hi, [Math.cos(a) * 1.8, -2.2, Math.sin(a) * 1.8]); M.limb(b, add(hi, [Math.cos(a) * 1.6, 1.6, Math.sin(a) * 1.6]), 0.35, 0.12, wood, { pat: "wood" }); }
      } else if (kind === "lantern") {
        const C = add(ha, [0, -5, 0.4]), L = frameYZ(UPV, B.z);
        M.limb(ha, add(ha, [0, -2.6, 0.4]), 0.18, 0.18, "#3a3a42");
        M.block(C, L, [1.8, 2.3, 1.8], 0.3, "#3a3a42", { pat: "metal" });
        M.block(C, L, [1.4, 1.8, 1.95], 0.2, "#ffd890", { glow: true });
        M.limb(add(C, [0, 2.3, 0]), add(C, [0, 3.3, 0]), 1.4, 0.3, "#3a3a42", { pat: "metal" });
      } else if (kind === "shield") {
        const C = add(ha, [-1.4, 1.2, 1.6]), n = norm([-0.45, 0, 0.89]);
        M.limb(sub(C, mul(n, 0.4)), add(C, mul(n, 0.3)), 5.9, 5.9, "#5c6573", { flat: 0.05, flatTop: 0.05, pat: "metal" });
        M.limb(add(C, mul(n, 0.2)), add(C, mul(n, 0.7)), 5.2, 5.2, look.pal.gear, { flat: 0.05, flatTop: 0.15, pat: "cloth" });
        M.ball(add(C, mul(n, 0.9)), 1.6, gold, { pat: "metal" });
      } else if (kind === "tshield") {
        const C = add(ha, [-1.6, 0.5, 2.0]), T = frameYZ(UPV, [-0.4, 0, 0.91]);
        M.block(C, T, [5.6, 8.6, 0.45], 0.5, steel, { pat: "metal" });
        M.block(off(C, T, 0, 0, 0.35), T, [4.8, 7.8, 0.3], 0.3, look.pal.gear, { pat: "cloth" });
        M.block(off(C, T, 0, 0, 0.65), T, [0.8, 5.5, 0.15], 0.1, "#ffd35c", { pat: "metal" });
        M.block(off(C, T, 0, 1.6, 0.65), T, [3.4, 0.8, 0.15], 0.1, "#ffd35c", { pat: "metal" });
      } else if (kind === "axe" || kind === "hammer" || kind === "spear" || kind === "scythe") {
        const len = kind === "spear" ? 19 : 15, head = at(len * 0.78);
        M.limb(at(-3.2), at(len), 0.55, 0.5, wood, { pat: "wood" });
        if (kind === "axe") {
          M.block(off(head, G, 0, 0, 2.4), G, [0.3, 2.2, 2.2], 0.3, "#c9d1dc", { pat: "metal" });
          M.limb(off(head, G, 0, -2.6, 4.4), off(head, G, 0, 2.6, 4.4), 0.4, 0.4, "#eef2f7", { pat: "metal" });
        } else if (kind === "hammer") {
          M.block(head, G, [2.6, 2.4, 3.6], 0.5, "#9aa3b2", { pat: "metal" });
          M.block(head, G, [2.8, 0.5, 3.8], 0.2, gold, { pat: "metal" });
        } else if (kind === "spear") M.limb(head, at(len + 3), 1.1, 0.05, "#e5e8ef", { pat: "metal" });
        else for (let i = 0; i < 4; i++) {
          const a = off(at(len), G, 0, -i * 1.1, -i * 2), b = off(at(len), G, 0, -(i + 1) * 1.1 - (i === 3 ? 1 : 0), -(i + 1) * 2);
          M.limb(a, b, 0.9 - i * 0.18, 0.75 - i * 0.18, "#c873ff", { pat: "metal" });
        }
        if (glow) M.ball(at(len), 1, glow, { glow: true });
      } else if (kind === "bow") {
        const pts = [-1, -0.5, 0, 0.5, 1].map((t) => add(ha, [0, 9 * t, 2 + 3.2 * (1 - t * t)]));
        for (let i = 0; i < 4; i++) M.limb(pts[i], pts[i + 1], 0.55 - Math.abs(i - 1.5) * 0.12, 0.55 - Math.abs(i - 0.5) * 0.12, "#8a5a32", { pat: "wood" });
        M.limb(pts[0], pts[4], 0.1, 0.1, "#d6dae3");
      } else if (kind === "tome" || kind === "skull") {
        const C = add(ha, [0, 2.5, 2.2]), T = frameYZ(UPV, B.z);
        if (kind === "tome") {
          M.block(C, T, [2.4, 3, 0.9], 0.3, "#6a2448", { pat: "cloth" });
          M.block(off(C, T, 0.2, 0, 0), T, [2.3, 2.8, 0.7], 0.1, "#f4ead8");
          M.ball(off(C, T, 0, 0, 1), 0.7, "#00e5ff", { glow: true });
        } else {
          M.ellipsoid(C, T, [2.2, 2.3, 2.4], "#e8e0d0", { pat: "stone" });
          M.block(off(C, T, 0, -1.9, 0.7), T, [1.5, 0.8, 1.2], 0.4, "#d8d0c0", { pat: "stone" });
          for (const sx of [-1, 1]) M.ball(off(C, T, sx * 0.85, 0.2, 2), 0.6, "#be64ff", { glow: true });
        }
      }
    }
  }

  // ---------- four legs: the beast, and the dragon on top of it ----------
  // look extras from the presets: feet ("hoof"), antlers, stripes, hump, ember (glows from within)
  function beast(j, look, M, o = {}) {
    const pal = look.pal, b = look.build, coatPat = o.scales ? "scale" : "fur";
    const S = frameZY(sub(j.shoulders, j.hips), UPV), len = Math.hypot(...sub(j.shoulders, j.hips));
    const coat = pal.coat, under = pal.belly, dark = shade(coat, 0.72), fur = { pat: coatPat };
    const R = { x: b.body * 0.47, y: b.body * 0.5, z: len / 2 + b.body * 0.3 }, mid = lerp(j.hips, j.shoulders, 0.5);
    // body: barrel, deep chest, haunch, pale belly, a hump on the big ones, mane
    M.ellipsoid(mid, S, [R.x, R.y, R.z], coat, fur);
    M.ellipsoid(off(j.shoulders, S, 0, -0.2, -0.6), S, [b.body * 0.52, b.body * 0.64, b.body * 0.6], coat, fur);
    M.ellipsoid(j.hips, S, [b.body * 0.5, b.body * 0.56, b.body * 0.55], coat, fur);
    M.ellipsoid(off(lerp(j.belly0, j.belly1, 0.5), S, 0, 0.6, 0), S, [b.body * 0.36, b.body * 0.3, len / 2], under, { pat: o.scales ? "scale" : "fur", glow: look.ember });
    if (look.hump) M.ellipsoid(off(j.shoulders, S, 0, b.body * 0.45, -1), S, [b.body * 0.38, b.body * 0.36, b.body * 0.55], coat, fur);
    // a ruff at the neck; stripes and antlers carry the preset's mane colour instead
    if (look.mane && !look.stripes && !look.antlers) M.ellipsoid(lerp(j.shoulders, j.neck, 0.55), frameYZ(sub(j.head, j.shoulders), S.z), [b.body * 0.58, b.body * 0.64, b.body * 0.52], pal.mane, { pat: "leaf" });
    // tiger stripes: thin dark slices round the barrel, sized to its girth where they sit
    if (look.stripes) for (let i = -3; i <= 3; i++) {
      const t = i / 4.2, g = Math.sqrt(1 - t * t) * 1.03;
      M.ellipsoid(off(mid, S, 0, R.y * 0.12, t * R.z), S, [R.x * g, R.y * g * 0.94, 0.32], pal.mane);
    }
    // boar's bristles along the spine
    if (look.feet === "hoof" && look.mane && !look.antlers) for (let i = 0; i < 6; i++) { const p = off(lerp(j.hips, j.shoulders, i / 5), S, 0, b.body * 0.48, 0); M.limb(p, off(p, S, 0, 1.6, -0.6), 0.5, 0.08, pal.mane); }
    // neck and head: skull, brow, muzzle with nose pad and nostrils, jaw, fangs, eyes, ears with their insides
    M.limb(j.shoulders, j.neck, b.body * 0.42, b.body * 0.34, coat, fur);
    M.limb(j.neck, j.head, b.body * 0.34, 2.3, coat, fur);
    const Hd = frameZY(sub(j.snout, j.head), UPV);
    M.ellipsoid(j.head, Hd, [2.7, 2.5, 2.9], coat, fur);
    M.ellipsoid(off(j.head, Hd, 0, 1.2, 1.2), Hd, [2.3, 0.9, 1.5], shade(coat, 0.9), fur);
    M.limb(j.head, j.snout, 1.95, 1.2, coat, fur);
    M.limb(off(j.snout, Hd, 0, -0.5, -1.2), off(j.snout, Hd, 0, -0.3, 0.2), 1.05, 0.95, under, fur);
    M.limb(j.head, j.jaw, 1.35, 0.85, shade(under, 0.9), fur);
    M.ball(j.mouth, 0.9, "#5a1a1e");
    M.ellipsoid(j.nose, Hd, [0.95, 0.7, 0.55], "#1b1416", { pat: "skin" });
    if (look.tusks || look.ember) for (const sx of [-1, 1]) M.limb(off(j.snout, Hd, sx * 0.7, -0.9, -0.4), off(j.snout, Hd, sx * 0.7, -1.9, -0.3), 0.3, 0.05, "#efe6d0");
    for (const s of ["L", "R"]) {
      const sx = s === "L" ? -1 : 1;
      M.ball(j["eye" + s], 0.6, pal.eye, { glow: true });
      M.ball(off(j["eye" + s], Hd, 0, 0, 0.32), 0.3, "#0b0b10");
      M.limb(off(j["eye" + s], Hd, -sx * 0.4, 0.7, -0.2), off(j["eye" + s], Hd, sx * 0.5, 0.55, 0.2), 0.32, 0.25, shade(coat, 0.8), fur);
      const round = b.ear === "round", ear = j["ear" + s], tip = j["earT" + s];
      M.limb(ear, tip, round ? 1.25 : 1.05, round ? 0.85 : 0.15, pal.mane, fur);
      M.limb(off(ear, Hd, 0, 0.2, 0.45), off(lerp(ear, tip, 0.85), Hd, 0, 0, 0.45), round ? 0.8 : 0.6, round ? 0.5 : 0.08, shade(under, 0.85));
      if (look.tusks) M.limb(j["tusk" + s], j["tuskT" + s], 0.5, 0.1, "#efe6d0", { pat: "stone" });
    }
    // the stag's antlers: a beam that forks twice, runes glowing at the points
    if (look.antlers) for (const sx of [-1, 1]) {
      const base = off(j.head, Hd, sx * 1.2, 2.2, -0.8), a = off(base, Hd, sx * 2.2, 4.2, -1.4), c = off(a, Hd, sx * 1.6, 4, -1.6);
      M.limb(base, a, 0.6, 0.45, "#d8c8a0", { pat: "bark" }); M.limb(a, c, 0.45, 0.3, "#d8c8a0", { pat: "bark" });
      for (const [from, to] of [[a, off(a, Hd, sx * 0.4, 2.6, 1.4)], [c, off(c, Hd, sx * 1.6, 1.8, 0.6)], [c, off(c, Hd, -sx * 0.2, 2.6, -0.8)], [lerp(base, a, 0.5), off(lerp(base, a, 0.5), Hd, sx * 0.2, 1.4, 1.6)]]) {
        M.limb(from, to, 0.3, 0.12, "#d8c8a0", { pat: "bark" }); M.ball(to, 0.32, pal.mane, { glow: true });
      }
    }
    // legs: muscled upper leg, lower leg, and a paw with toes and claws, or a hoof
    for (const k of ["FL", "FR", "HL", "HR"]) {
      const top = j["top" + k], kn = j["kn" + k], ft = j["ft" + k], lw = b.legW, P = frameZY([S.z[0], 0, S.z[2]], UPV);
      M.ellipsoid(lerp(top, kn, 0.3), frameYZ(sub(top, kn), S.z), [lw * 0.66, b.leg * 0.44, lw * 0.8], coat, fur);
      M.limb(top, kn, lw * 0.6, lw * 0.44, coat, fur);
      M.limb(kn, ft, lw * 0.44, lw * 0.34, coat, fur);
      if (look.feet === "hoof") {
        M.limb(add(ft, [0, 0.1, 0]), add(ft, [0, 1.2, 0]), lw * 0.42, lw * 0.36, "#2a2024", { flat: 0.1, pat: "stone" });
        M.limb(add(ft, [0, 1.2, 0]), add(ft, [0, 1.9, 0]), lw * 0.5, lw * 0.4, shade(coat, 0.85), fur);
      } else {
        M.ellipsoid(off(ft, P, 0, 0.5, 0.2), P, [lw * 0.58, 0.6, lw * 0.78], dark, fur);
        for (const tx of [-1, 0, 1]) {
          const toe = off(ft, P, tx * lw * 0.32, 0.38, lw * 0.75);
          M.ball(toe, lw * 0.2, dark, fur);
          M.limb(toe, off(toe, P, 0, -0.25, lw * 0.32), 0.18, 0.04, "#efe6d0");
        }
      }
    }
    // tail: fur grows thick where the preset says it is broad
    M.limb(j.tail0, j.tail1, b.tailW * 0.5, b.tailW * 0.55, coat, fur);
    M.limb(j.tail1, j.tail2, b.tailW * 0.55, b.tailW * 0.18, look.tip ? under : coat, fur);
    if (b.tailW > 2) M.ellipsoid(lerp(j.tail1, j.tail2, 0.35), frameYZ(sub(j.tail2, j.tail1), S.x), [b.tailW * 0.6, Math.hypot(...sub(j.tail2, j.tail1)) * 0.45, b.tailW * 0.6], look.tip ? under : coat, { pat: "leaf" });
    return S;
  }
  function dragon(j, look, M) {
    const pal = look.pal, S = beast(j, look, M, { scales: true }), b = look.build;
    // belly plates
    for (let i = 0; i < 6; i++) M.ellipsoid(off(lerp(j.belly0, j.belly1, i / 5), S, 0, 0.25, 0), S, [b.body * 0.3, 0.45, 1.2], shade(pal.belly, 1 - (i % 2) * 0.12), { pat: "scale" });
    for (const s of ["L", "R"]) {
      // the wing: arm to the wrist, three fingers, skin stretched between them and back to the body
      const r = j["wRoot" + s], m = j["wMid" + s], t = j["wTip" + s], k = j["wBack" + s];
      const f2 = lerp(t, k, 0.45), f3 = lerp(t, k, 0.8);
      M.limb(r, m, 1.15, 0.8, pal.coat, { pat: "scale" });
      M.limb(m, t, 0.7, 0.12, pal.coat); M.limb(m, f2, 0.6, 0.12, pal.coat); M.limb(m, f3, 0.55, 0.12, pal.coat); M.limb(m, k, 0.5, 0.12, pal.coat);
      M.limb(m, add(m, [0, 1.6, 0.6]), 0.5, 0.05, "#efe6d0");
      const skin = pal.mane;
      M.quad([m, t, f2, f2], skin); M.quad([m, f2, f3, f3], shade(skin, 0.9)); M.quad([m, f3, k, k], skin); M.quad([r, m, k, add(r, [0, -1.5, -3])], shade(skin, 0.82));
    }
    // spines along the back and neck, horns, a spade at the tail's end
    for (let i = 0; i <= 7; i++) {
      const p = i < 5 ? lerp(j.hips, j.shoulders, i / 4) : lerp(j.shoulders, j.head, (i - 4) / 4);
      const base = off(p, S, 0, b.body * (i < 5 ? 0.5 : 0.3), 0);
      M.limb(base, off(base, S, 0, 2.4 - Math.abs(i - 3) * 0.2, -1.2), 0.85, 0.08, pal.mane);
    }
    for (let i = 1; i <= 3; i++) { const p = lerp(j.tail0, j.tail2, i / 4); M.limb(p, add(p, [0, 1.4, 0]), 0.5, 0.06, pal.mane); }
    const T = frameYZ(sub(j.tail2, j.tail1), S.x);
    M.block(j.tail2, { x: T.z, y: T.y, z: T.x }, [0.25, 1.8, 1.6], 0.2, pal.mane, { pat: "scale" });
    const Hd = frameZY(sub(j.snout, j.head), UPV);
    for (const sx of [-1, 1]) {
      const b0 = off(j.head, Hd, sx * 1.2, 1.8, -1), m = off(b0, Hd, sx * 0.6, 2, -2.4);
      M.limb(b0, m, 0.75, 0.5, "#efe6d0", { pat: "stone" }); M.limb(m, off(m, Hd, 0, 0.6, -2.8), 0.5, 0.08, "#efe6d0", { pat: "stone" });
      for (let i = 0; i < 3; i++) M.limb(off(j.snout, Hd, sx * 0.9, -0.8, -0.6 - i * 1.1), off(j.snout, Hd, sx * 0.9, -1.7, -0.6 - i * 1.1), 0.25, 0.04, "#fff8e8");
    }
  }

  // ---------- trees ----------
  function tree(j, look, M) {
    const pal = look.pal, tw = look.build.trunk, R = look.build.r, bark = { pat: "bark" }, leaf = { pat: "leaf" };
    const rad = (i) => tw * 0.55 * (1 - i * 0.18);
    for (let i = 0; i < 4; i++) M.limb(j["t" + i], j["t" + (i + 1)], rad(i), rad(i + 1), pal.trunk, bark);
    // roots flare out at the foot; grass and stones round it
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.4, l = 1.3 + (i % 2) * 0.5; M.limb(add(j.t0, [0, tw * 0.7, 0]), [Math.cos(a) * tw * l, 0.15, Math.sin(a) * tw * l], tw * 0.34, tw * 0.1, shade(pal.trunk, 0.85), bark); }
    const grass = shade(look.kind === "palm" ? "#6a8a3a" : "#3e7a34", 1);
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39996, d = tw * (1.6 + (i % 5) * 0.55), base = [Math.cos(a) * d, 0, Math.sin(a) * d];
      for (let k = 0; k < 3; k++) M.limb(base, add(base, [Math.cos(a + k * 2) * 0.5, 1.2 + ((i + k) % 3) * 0.5, Math.sin(a + k * 2) * 0.5]), 0.22, 0.03, shade(grass, 0.85 + k * 0.1));
      if (i % 4 === 0) M.ellipsoid(add(base, [0.8, 0.2, 0.4]), frameYZ(UPV, [Math.cos(a), 0, Math.sin(a)]), [0.9, 0.5, 0.7], "#5a5a62", { pat: "stone" });
    }
    // canopy: each blob a branch to it and a dense cluster of lumpy leaf masses, dark beneath and light on top
    (look.blobs || []).forEach(([, , , r], i) => {
      const c = j["c" + i], rr = R * r, from = lerp(j.t3, j.t4, 0.4 + (i % 3) * 0.2);
      M.limb(from, lerp(from, c, 0.85), rad(3) * 0.55, rad(3) * 0.25, pal.trunk, bark);
      M.ellipsoid(c, frameYZ(UPV, [0, 0, 1]), [rr * 0.92, rr * 0.75, rr * 0.92], shade(pal.leaf, 0.8), leaf);
      for (let k = 0; k < 9; k++) {
        const a = k * 2.39996 + i, y = 1 - ((k + 0.5) / 9) * 2, ring = Math.sqrt(1 - y * y), d = [Math.cos(a) * ring * 0.62, y * 0.5, Math.sin(a) * ring * 0.62];
        M.ball(add(c, mul(d, rr)), rr * (0.42 + (k % 3) * 0.06), y > 0.2 ? pal.light : y < -0.4 ? shade(pal.leaf, 0.72) : pal.leaf, leaf);
      }
      if (pal.accent) for (let k = 0; k < 14; k++) { const a = k * 1.9 + i * 0.7, d = norm([Math.cos(a), 0.5 + (k % 4) * 0.15, Math.sin(a)]); M.ball(add(c, mul(d, rr * 0.95)), rr * 0.09, k % 3 ? pal.accent : "#ffd8e8"); }
    });
    // pine: each tier a drooping skirt, with a smaller one between to fill it out
    if (look.kind === "pine") for (let i = 0; i < 4; i++) {
      const C = j["pC" + i], T = j["pT" + i], r = j["pR" + i][0];
      M.limb(add(C, [0, -r * 0.18, 0]), T, r, 0.3, i % 2 ? pal.light : pal.leaf, { flat: 0.22, pat: "leaf" });
      M.limb(lerp(C, T, 0.3), lerp(C, T, 0.95), r * 0.72, 0.2, shade(pal.leaf, 0.85), { flat: 0.25, pat: "leaf" });
    }
    if (look.kind === "willow") for (let i = 0; i < 10; i++) {
      const a = j["s" + i], b = j["sT" + i], n = j["s" + ((i + 1) % 10)], bn = j["sT" + ((i + 1) % 10)];
      for (const [s0, s1, c] of [[a, b, pal.light], [lerp(a, n, 0.5), lerp(b, bn, 0.5), shade(pal.leaf, 1.1)]]) {
        const m = add(lerp(s0, s1, 0.5), [0, 0, 0.3]);
        M.limb(s0, m, 0.3, 0.24, c, leaf); M.limb(m, s1, 0.24, 0.1, c, leaf);
      }
    }
    if (look.kind === "palm") {
      for (let i = 1; i < 12; i++) { const t = i / 12, k = Math.min(3, Math.floor(t * 4)), p = lerp(j["t" + k], j["t" + Math.min(4, k + 1)], t * 4 - k); M.limb(add(p, [0, -0.25, 0]), add(p, [0, 0.25, 0]), rad(t * 4) * 1.12, rad(t * 4) * 1.12, shade(pal.trunk, 0.82), { flat: 0.3, flatTop: 0.3, pat: "bark" }); }
      for (let i = 0; i < 7; i++) {
        const a = j["f0" + i], b = j["f1" + i], c = j["f2" + i];
        M.limb(a, b, 0.35, 0.28, shade(pal.leaf, 0.7)); M.limb(b, c, 0.28, 0.08, shade(pal.leaf, 0.7));
        // leaflets along the frond, both sides, hanging down and out
        for (let k = 1; k < 9; k++) {
          const t = k / 9, p = t < 0.5 ? lerp(a, b, t * 2) : lerp(b, c, t * 2 - 1), d = norm(t < 0.5 ? sub(b, a) : sub(c, b)), side = norm(cross(d, UPV)), L = 3.2 * Math.sin(Math.PI * (0.15 + t * 0.8));
          for (const sx of [-1, 1]) {
            const tip = add(add(p, mul(side, sx * L)), [0, -L * 0.5, 0]), w = mul(d, 0.45);
            M.quad([sub(p, w), add(p, w), add(tip, mul(w, 0.3)), sub(tip, mul(w, 0.3))], k % 2 ? pal.leaf : pal.light);
          }
        }
      }
      for (let i = 0; i < 4; i++) { const a = i * 1.7; M.ball(add(j.t4, [Math.cos(a) * 1.3, -1.1, Math.sin(a) * 1.3]), 1.15, "#6a4a2a", { pat: "wood" }); }
    }
  }

  // ---------- the chest: a box and a lid, planked, banded, studded and locked ----------
  function chest(j, look, M) {
    const pal = look.pal, wood = { pat: "wood" }, metal = { pat: "metal" };
    // a box from its eight named corners: centre, frame and half sizes
    const boxOf = (n) => {
      const c = (k) => j[n + k], ks = ["Lbf", "Rbf", "Ltf", "Rtf", "Lbk", "Rbk", "Ltk", "Rtk"];
      const mid = mul(ks.reduce((s, k) => add(s, c(k)), [0, 0, 0]), 1 / 8);
      const f = frameYZ(sub(c("Ltf"), c("Lbf")), sub(c("Lbf"), c("Lbk")));
      return { mid, f, half: [Math.hypot(...sub(c("Rbf"), c("Lbf"))) / 2, Math.hypot(...sub(c("Ltf"), c("Lbf"))) / 2, Math.hypot(...sub(c("Lbf"), c("Lbk"))) / 2], c };
    };
    const B = boxOf("B"), L = boxOf("L"), open = j.lidA[0];
    M.block(B.mid, B.f, B.half, 0.7, pal.wood, wood);
    M.block(L.mid, L.f, L.half, 1.1, pal.lid, wood);
    // plank seams round the box
    for (const y of [-B.half[1] / 3, B.half[1] / 3]) M.block(off(B.mid, B.f, 0, y, 0), B.f, [B.half[0] + 0.05, 0.12, B.half[2] + 0.05], 0.05, shade(pal.wood, 0.55));
    // bands: named by their front edge, they sit at the box's middle depth and wrap front, top and back, studded
    const band = (a, b, X) => {
      const c = off(lerp(a, b, 0.5), X.f, 0, 0, -X.half[2] - 0.06);
      M.block(c, X.f, [0.65, X.half[1] + 0.12, X.half[2] + 0.15], 0.2, pal.band, metal);
      for (const y of [-0.6, 0, 0.6]) M.ball(off(c, X.f, 0, y * X.half[1], X.half[2] + 0.2), 0.28, shade(pal.band, 1.2), metal);
    };
    for (const i of [0, 1]) { band(j["bb" + i], j["bt" + i], B); band(j["lb" + i], j["lt" + i], L); }
    for (const k of ["Lbf", "Rbf", "Ltf", "Rtf", "Lbk", "Rbk", "Ltk", "Rtk"]) M.ball(B.c(k), 0.62, pal.band, metal);
    // side handles, back hinges, the lock and its keyhole
    for (const sx of [-1, 1]) {
      const h0 = off(B.mid, B.f, sx * (B.half[0] + 0.25), 0.6, 0);
      M.limb(off(h0, B.f, 0, 0, -1.3), off(h0, B.f, sx * 0.6, -0.8, -0.9), 0.22, 0.22, pal.band, metal);
      M.limb(off(h0, B.f, sx * 0.6, -0.8, -0.9), off(h0, B.f, sx * 0.6, -0.8, 0.9), 0.22, 0.22, pal.band, metal);
      M.limb(off(h0, B.f, sx * 0.6, -0.8, 0.9), off(h0, B.f, 0, 0, 1.3), 0.22, 0.22, pal.band, metal);
      M.block(off(B.mid, B.f, sx * B.half[0] * 0.55, B.half[1], -B.half[2] - 0.1), B.f, [0.9, 0.7, 0.2], 0.15, pal.band, metal);
    }
    M.block(j.lockB, B.f, [1.25, 1.35, 0.35], 0.25, pal.band, metal);
    M.block(off(j.lockB, B.f, 0, -0.1, 0.3), B.f, [0.3, 0.55, 0.1], 0.05, "#1a1214");
    if (open > 0.4 && !look.mimic) {
      M.block(off(B.mid, B.f, 0, B.half[1] - 0.6, 0), B.f, [B.half[0] - 0.6, 0.4, B.half[2] - 0.6], 0.2, "#ffd35c", { glow: true });
      for (let i = 0; i < 9; i++) M.limb(off(B.mid, B.f, ((i % 3) - 1) * 3, B.half[1] - 0.1 + (i % 2) * 0.3, (Math.floor(i / 3) - 1) * 2), off(B.mid, B.f, ((i % 3) - 1) * 3, B.half[1] + 0.15 + (i % 2) * 0.3, (Math.floor(i / 3) - 1) * 2), 0.9, 0.9, "#ffe27a", { flat: 0.2, flatTop: 0.2, pat: "metal" });
    }
    if (look.mimic) {
      M.block(off(B.mid, B.f, 0, B.half[1] - 0.3, 0), B.f, [B.half[0] - 0.5, 0.3, B.half[2] - 0.5], 0.2, "#3a0a12");
      for (let i = 0; i < 5; i++) {
        M.limb(j["tt" + i], off(j["tt" + i], L.f, 0, -1.8, 0), 0.6, 0.06, "#f4ead8", { pat: "stone" });
        M.limb(j["tb" + i], off(j["tb" + i], B.f, 0, 1.6, 0), 0.55, 0.06, "#f4ead8", { pat: "stone" });
      }
      for (const s of ["L", "R"]) { M.ball(j["eye" + s], 0.95, "#ff3a2a", { glow: true }); M.ball(off(j["eye" + s], L.f, 0, 0, 0.6), 0.4, "#1a0508"); }
      if (open > 0.2) { const t0 = off(B.mid, B.f, 0, B.half[1], -1), t1 = off(j.lockB, B.f, 0, 1.6, 2.4); M.limb(t0, lerp(t0, t1, 0.6), 1.3, 1.1, "#c8344a", { pat: "skin" }); M.limb(lerp(t0, t1, 0.6), t1, 1.1, 0.6, "#c8344a", { pat: "skin" }); }
    }
  }

  /* ---------- creatures with bodies of their own. look.pal: main, dark, light, eye, accent; look.build: sizes ---------- */
  const FWD = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  // two eyes looking forward from a point, w apart
  const eyes = (M, at, w, r, col, white) => { for (const sx of [-1, 1]) { const e = add(at, [sx * w, 0, 0]); if (white) M.ball(e, r * 1.5, "#f4f1ea"); M.ball(add(e, [0, 0, white ? r * 1.1 : 0]), r, col, { glow: !white }); } };
  // slimes, bloats, sporelings, bombers: a squashing body with a face; a cap, a fuse or a molten core as the look says
  function blob(j, look, M) {
    const pal = look.pal, R = (look.build && look.build.r) || 6, sq = j.sq[0], wide = 1 / Math.sqrt(sq), c = add(j.c, [0, R * 0.8 * sq, j.lunge[0]]);
    M.ellipsoid(c, FWD, [R * wide, R * 0.8 * sq, R * wide], pal.main, { pat: "skin" });
    M.ellipsoid(add(c, [0, -R * 0.45 * sq, 0]), FWD, [R * wide * 1.02, R * 0.4 * sq, R * wide * 1.02], pal.dark, { pat: "skin" });
    M.ball(add(c, [-R * 0.35, R * 0.4 * sq, R * 0.5]), R * 0.18, pal.light);
    eyes(M, add(c, [0, R * 0.15 * sq, R * 0.78 * wide]), R * 0.32, R * 0.14, look.mean ? pal.eye : "#1a1214", !look.mean);
    M.block(add(c, [0, -R * 0.2 * sq, R * 0.86 * wide]), FWD, [R * 0.28, R * 0.07, R * 0.08], R * 0.05, "#2a0a10");
    if (look.cap) {
      M.ellipsoid(add(c, [0, R * 0.75 * sq, 0]), FWD, [R * 1.25, R * 0.45, R * 1.25], look.cap, { pat: "skin" });
      for (let i = 0; i < 6; i++) { const a = i * 2.4; M.ball(add(c, [Math.cos(a) * R * 0.75, R * 1.05 * sq, Math.sin(a) * R * 0.75]), R * 0.13, "#f4e8d8"); }
    }
    if (look.fuse) { const top = add(c, [0, R * 0.8 * sq, 0]); M.limb(top, add(top, [R * 0.3, R * 0.5, 0]), R * 0.08, R * 0.06, "#3a2a1e"); M.ball(add(top, [R * 0.32, R * 0.55, 0]), R * 0.14, "#ffd35c", { glow: true }); }
    if (look.molten) for (let i = 0; i < 5; i++) { const a = i * 1.3; M.ball(add(c, [Math.cos(a) * R * 0.7, (i % 3 - 1) * R * 0.3, Math.sin(a) * R * 0.7]), R * 0.12, "#ffd08a", { glow: true }); }
  }
  // bats and fireflies: a body, a head, and wings that beat
  function flyer(j, look, M) {
    const pal = look.pal, R = (look.build && look.build.r) || 2.6, c = j.c, f = j.flap[0];
    M.ellipsoid(c, FWD, [R, R * 1.1, R * 1.2], pal.main, { pat: "fur" });
    const head = add(c, [0, R * 0.9, R * 0.6]);
    M.ball(head, R * 0.75, pal.main, { pat: "fur" });
    eyes(M, add(head, [0, R * 0.1, R * 0.6]), R * 0.3, R * 0.16, pal.eye, false);
    if (look.insect) M.ellipsoid(add(c, [0, -R * 0.3, -R * 1.6]), FWD, [R * 0.9, R * 0.9, R * 1.3], pal.accent, { glow: true });
    else for (const sx of [-1, 1]) M.limb(add(head, [sx * R * 0.4, R * 0.5, 0]), add(head, [sx * R * 0.7, R * 1.3, -R * 0.2]), R * 0.25, R * 0.05, pal.dark);
    for (const sx of [-1, 1]) {
      const root = add(c, [sx * R * 0.7, R * 0.3, 0]), W = R * (look.insect ? 2.4 : 3.2), tip = add(root, [sx * W * Math.cos(f), W * Math.sin(f), -R * 0.3]), back = add(root, [sx * W * 0.6 * Math.cos(f), W * 0.6 * Math.sin(f) - R * 0.8, -R * 1.1]);
      M.quad([root, tip, back, add(root, [0, -R * 0.4, -R * 0.4])], look.insect ? pal.light : pal.dark);
      if (!look.insect) M.limb(root, tip, R * 0.12, R * 0.05, pal.main);
    }
  }
  // spiders and crawlers: a head, a swollen abdomen, eight jointed legs, a cluster of eyes
  function spider(j, look, M) {
    const pal = look.pal, c = j.c;
    M.ellipsoid(add(c, [0, 0.6, 1.5]), FWD, [3.2, 2.4, 3], pal.main, { pat: "fur" });
    M.ellipsoid(add(c, [0, 1.8, -4]), FWD, [4.4, 3.8, 5], pal.dark, { pat: "fur" });
    M.ellipsoid(add(c, [0, 3.4, -4.6]), FWD, [2.4, 0.9, 3], pal.accent, { pat: "skin" });
    for (let i = 0; i < 4; i++) M.ball(add(c, [(i - 1.5) * 0.8, 1.6 + (i % 2) * 0.5, 4.1]), 0.42, pal.eye, { glow: true });
    for (const sx of [-1, 1]) M.limb(add(c, [sx * 0.8, -0.4, 4]), add(c, [sx * 0.6, -1.6, 5.2]), 0.45, 0.12, pal.dark);
    for (let i = 0; i < 8; i++) { const hip = add(c, [i < 4 ? -2.2 : 2.2, 0.4, ((i % 4) - 1.5) * 1.1 + 1]); M.limb(hip, j["knee" + i], 0.55, 0.42, pal.main, { pat: "fur" }); M.limb(j["knee" + i], j["foot" + i], 0.42, 0.12, pal.main, { pat: "fur" }); }
  }
  // beetles: a shell in two halves, a horned head with mandibles, six short legs
  function bug(j, look, M) {
    const pal = look.pal, c = j.c, sn = j.snap[0];
    for (const sx of [-1, 1]) M.ellipsoid(add(c, [sx * 1.9, 1.4, -0.8]), FWD, [2.3, 2.6, 5], pal.main, { pat: "scale" });
    M.limb(add(c, [0, 3.8, 3.4]), add(c, [0, 3.9, -5.4]), 0.25, 0.25, pal.dark);
    const head = add(c, [0, 0.8, 4.6]);
    M.ellipsoid(head, FWD, [2.3, 1.8, 2], pal.dark, { pat: "scale" });
    eyes(M, add(head, [0, 0.6, 1.6]), 1.3, 0.38, pal.eye, false);
    if (look.horn) { const b = add(head, [0, 1.2, 1]); M.limb(b, add(b, [0, 3.6, 2.4]), 0.8, 0.12, pal.accent, { pat: "stone" }); }
    for (const sx of [-1, 1]) M.limb(add(head, [sx * 1, -0.6, 1.8]), add(head, [sx * (0.4 + sn * 1.2), -0.8, 3.6]), 0.4, 0.08, pal.accent);
    for (let i = 0; i < 6; i++) { const hip = add(c, [i < 3 ? -2 : 2, 0, ((i % 3) - 1) * 2.4]); M.limb(hip, j["knee" + i], 0.42, 0.34, pal.dark); M.limb(j["knee" + i], j["foot" + i], 0.34, 0.1, pal.dark); }
  }
  // thornvines and carnivorous plants: a swaying thorned stalk from a root ball, leaves, and a head that gapes
  function plant(j, look, M) {
    const pal = look.pal, k = (look.build && look.build.k) || 1, sc = (p) => mul(p, k);
    M.ellipsoid([0, 1.2 * k, 0], FWD, [4 * k, 1.8 * k, 4 * k], pal.dark, { pat: "bark" });
    for (let i = 0; i < 5; i++) { const a = i * 1.26, l = 4.5 * k; M.quad([[0, 1.5 * k, 0], [Math.cos(a + 0.35) * l, 0.6 * k, Math.sin(a + 0.35) * l], [Math.cos(a) * l * 1.4, 0.2, Math.sin(a) * l * 1.4], [Math.cos(a - 0.35) * l, 0.6 * k, Math.sin(a - 0.35) * l]], i % 2 ? pal.main : pal.light); }
    for (let i = 0; i < 5; i++) {
      const a = sc(j["s" + i]), b = sc(j["s" + (i + 1)]);
      M.limb(a, b, (1.3 - i * 0.15) * k, (1.15 - i * 0.15) * k, pal.main, { pat: "bark" });
      M.limb(lerp(a, b, 0.5), add(lerp(a, b, 0.5), [(i % 2 ? 1 : -1) * 1.6 * k, 0.6 * k, 0.4 * k]), 0.3 * k, 0.04, pal.accent);
    }
    const h = sc(j.head), o = j.open[0];
    M.ellipsoid(add(h, [0, 0.9 * k * (1 + o * 0.4), 0]), FWD, [2.6 * k, 1.4 * k, 2.4 * k], look.bloom || pal.accent, { pat: "skin" });
    M.ellipsoid(add(h, [0, -0.9 * k * (1 + o * 0.4), 0]), FWD, [2.4 * k, 1.2 * k, 2.2 * k], look.bloom || pal.accent, { pat: "skin" });
    M.ellipsoid(h, FWD, [2 * k, 0.6 * k * (0.3 + o), 2 * k], "#3a0a14");
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; M.limb(add(h, [Math.cos(a) * 1.7 * k, 0.2 * k, Math.sin(a) * 1.7 * k]), add(h, [Math.cos(a) * 1.5 * k, -0.6 * k * o, Math.sin(a) * 1.5 * k]), 0.25 * k, 0.04, "#f4ead8"); }
  }
  // elementals and crystals: a glowing heart, shards turning round it; a crystal stands its shards in the ground
  function elemental(j, look, M) {
    const pal = look.pal, c = j.c, spin = j.spin[0], sp = j.spread[0];
    if (look.rooted) {
      for (let i = 0; i < 7; i++) { const a = i * 0.9, r = i ? 2.4 : 0, b = [Math.cos(a) * r, 0, Math.sin(a) * r], h = i ? 6 + (i % 3) * 2 : 12; M.limb(b, add(b, [Math.cos(a) * r * 0.4, h, Math.sin(a) * r * 0.4]), i ? 1.2 : 2, 0.2, i % 2 ? pal.main : pal.light, { pat: "metal" }); }
      M.ball([0, 7, 0], 1.5, pal.eye, { glow: true });
      return;
    }
    M.ball(c, 2.6, pal.eye, { glow: true });
    M.ball(c, 3.4, pal.main, { pat: "stone" });
    for (let i = 0; i < 6; i++) {
      const a = spin + (i / 6) * Math.PI * 2, y = Math.sin(spin * 0.7 + i) * 2, p = add(c, [Math.cos(a) * 5.5 * sp, y, Math.sin(a) * 5.5 * sp]);
      M.block(p, frameYZ(norm([Math.cos(a), 0.6, Math.sin(a)]), [0, 0, 1]), [1.3, 2.2, 1.1], 0.4, i % 2 ? pal.dark : pal.light, { pat: "stone" });
    }
  }
  // turrets: a block on a post, a head that turns and a barrel that kicks
  function turret(j, look, M) {
    const pal = look.pal;
    M.block([0, 2, 0], FWD, [4, 2, 4], 0.6, pal.dark, { pat: "stone" });
    M.limb([0, 4, 0], [0, 8, 0], 1.4, 1.2, pal.main, { pat: "metal" });
    const H = frameYZ([0, 1, 0], [Math.sin(j.aim[0]), 0, Math.cos(j.aim[0])]), head = [0, 10, 0];
    M.block(head, H, [3, 2.4, 3], 0.8, pal.main, { pat: "metal" });
    M.limb(off(head, H, 0, 0, 1.5 - j.recoil[0]), off(head, H, 0, 0, 6 - j.recoil[0]), 0.9, 0.8, pal.dark, { pat: "metal" });
    M.ball(off(head, H, 0, 0.9, 2.9), 0.7, pal.eye, { glow: true });
  }
  // serpents: a chain of segments tapering to the tail, a horned head that rears
  function serpent(j, look, M) {
    const pal = look.pal;
    for (let i = 8; i >= 0; i--) {
      const p = j["s" + i], r = 3.4 - i * 0.25;
      M.ball(p, r, i % 2 ? pal.main : pal.dark, { pat: "scale" });
      M.limb(add(p, [0, r * 0.7, 0]), add(p, [0, r * 1.5, -1]), 0.6, 0.08, pal.light);
    }
    const h = j.head, H = frameZY(sub(h, j.s0), [0, 1, 0]);
    M.ellipsoid(h, H, [3, 2.6, 3.6], pal.main, { pat: "scale" });
    eyes(M, off(h, H, 0, 1, 2.2), 1.5, 0.5, pal.eye, false);
    for (const sx of [-1, 1]) M.limb(off(h, H, sx * 1.6, 1.8, -1), off(h, H, sx * 3.4, 4.6, -3), 0.6, 0.08, pal.light);
  }

  return { figure, beast, dragon, tree, chest, blob, flyer, spider, bug, plant, elemental, turret, serpent };
})();
