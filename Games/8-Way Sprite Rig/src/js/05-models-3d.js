// ---------- 3D models: each subject's skeleton dressed in solid shapes ----------
// A model reads the pose's joints (pose units, y up, z forward) and the look, and builds into M,
// a Preview3D builder. o carries the head size (hk), the rig's metal colours, and heavy for the Golem.
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
  function figure(j, look, M, o) {
    const pal = look.pal, w = o.heavy ? 1.35 : 1, hk = o.hk || 1, { STEEL, CREST, VISOR } = o;
    const up = norm(sub(j.neck, j.hip)), fwd = norm(sub(j.visor, j.head));
    const B = frameYZ(up, fwd.map((v, i) => (i === 1 ? 0 : v)));
    const P = frameYZ(up, cross(norm(sub(j.hpR, j.hpL)), up));
    const boot = o.heavy ? shade(pal.pants, 0.7) : "#3a2a22";
    // hips, belly, chest and belt
    M.block(off(j.hip, P, 0, 1, 0), P, [4.3 * w, 2.7, 2.7 * w], 1.4, pal.pants);
    M.block(lerp(j.hip, j.chest, 0.38), B, [3.9 * w, 3.4, 2.5 * w], 1.6, pal.shirt);
    M.block(off(j.chest, B, 0, -1, -0.2), B, [4.9 * w, 3.7, 3 * w], 1.9, pal.shirt);
    M.block(off(j.hip, P, 0, 2.6, 0), P, [4.2 * w, 0.75, 2.8 * w], 0.5, pal.gear);
    M.block(off(j.hip, P, 0, 2.6, 2.8 * w), P, [1, 0.9, 0.3], 0.2, "#ffd35c");
    M.limb(off(j.chest, B, 0, 2, 0), off(j.neck, B, 0, 1, 0), 1.4 * w, 1.3 * w, pal.skin);
    // arms: shoulder, upper arm in the shirt, bare forearm, hand
    for (const s of ["L", "R"]) {
      const sh = j["sh" + s], el = j["el" + s], ha = j["ha" + s];
      M.ball(sh, 2.1 * w, pal.shirt);
      M.limb(sh, el, 1.85 * w, 1.5 * w, pal.shirt);
      M.limb(el, ha, 1.45 * w, 1.15 * w, o.heavy ? pal.gear : pal.skin);
      M.ball(ha, 1.4 * w, o.heavy ? pal.gear : pal.skin);
      if (o.heavy) M.ball(el, 1.7 * w, pal.gear);
    }
    // legs: thigh, shin, boot pointing where the body faces
    const toe = norm([B.z[0], 0, B.z[2]]), F = frameYZ(UPV, toe);
    for (const s of ["L", "R"]) {
      const hp = j["hp" + s], kn = j["kn" + s], ft = j["ft" + s];
      M.limb(hp, kn, 2.35 * w, 1.85 * w, pal.pants);
      M.limb(kn, ft, 1.8 * w, 1.35 * w, pal.pants);
      if (o.heavy) M.ball(kn, 2 * w, pal.gear);
      M.block(off(ft, F, 0, 1.1, 0.9 * w), F, [1.55 * w, 1.25, 2.7 * w], 0.8, boot);
    }
    // the head: skull, hair, eyes and nose, then whatever is worn on it
    const head = j.head, H = frameYZ(norm(sub(j.head, j.neck)), fwd), h = (v) => v * hk;
    const face = (x, y, z) => off(head, H, h(x), h(y), h(z));
    M.block(head, H, [h(3.1), h(3.4), h(3.2)], h(2.1), pal.skin);
    for (const sx of [-1, 1]) M.ball(face(sx * 1.2, 0.3, 3.05), h(0.5), VISOR);
    M.ball(face(0, -0.7, 3.3), h(0.55), shade(pal.skin, 0.9));
    const hair = () => M.block(face(0, 0.95, -0.55), H, [h(3.35), h(2.7), h(3.25)], h(2.2), pal.hair);
    const hd = look.head;
    if (hd === "helmet" || hd === "viking") {
      M.block(face(0, 0.4, -0.1), H, [h(3.6), h(3.8), h(3.55)], h(2.4), STEEL);
      M.block(face(0, 0.3, 3.5), H, [h(2.5), h(0.4), h(0.3)], h(0.2), VISOR);
      if (hd === "helmet") M.limb(j.crest0, j.crest1, h(1), h(0.6), CREST);
      else for (const sx of [-1, 1]) {
        const base = face(sx * 3, 2, 0), mid = face(sx * 5.4, 3.6, 0.2);
        M.limb(base, mid, h(1), h(0.65), "#efe6d0"); M.limb(mid, face(sx * 5.6, 6.6, 0.6), h(0.65), h(0.12), "#efe6d0");
      }
    } else if (hd === "hood" || hd === "plague") {
      const cloth = hd === "hood" ? pal.gear : "#2b2d38";
      M.block(face(0, 0.5, -0.9), H, [h(3.75), h(3.95), h(3.4)], h(2.6), cloth);
      if (hd === "hood") M.limb(j.hood0, j.hood1, h(2), h(0.5), cloth);
      else M.limb(face(0, -0.3, 3.2), face(0, -2.4, 8), h(1.25), h(0.2), "#d8d0c0");
    } else if (hd === "hat") {
      hair();
      M.ellipsoid(j.hat0, H, [h(6.6), h(0.55), h(6.6)], shade(pal.gear, 0.8));
      M.limb(j.hat0, j.hat1, h(4.2), h(2.3), pal.gear, { flat: 0.3 });
      M.limb(j.hat1, j.hat2, h(2.3), h(0.3), pal.gear);
    } else if (hd === "crown") {
      hair();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2, base = face(Math.cos(a) * 2.9, 3.2, Math.sin(a) * 2.9);
        M.limb(base, off(base, H, 0, h(2.3), 0), h(0.75), h(0.12), "#ffd35c");
      }
      M.block(face(0, 3.1, 0), H, [h(3.3), h(0.65), h(3.3)], h(0.5), "#ffd35c");
    } else if (hd === "horns") {
      hair();
      for (const sx of [-1, 1]) { const b = face(sx * 2.4, 2.6, 0.4), m = face(sx * 4.6, 4.6, -0.6); M.limb(b, m, h(0.95), h(0.6), "#3a1a20"); M.limb(m, face(sx * 5.4, 7, -2), h(0.6), h(0.1), "#3a1a20"); }
    } else hair();
    if (hd === "halo") for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; M.ball(off(j.hat1, H, h(Math.cos(a) * 4.8), 0, h(Math.sin(a) * 4.8)), h(0.55), "#fff27a", { glow: true }); }
    // pauldrons
    const pd = look.pauldron;
    if (pd && pd !== "none") {
      const pc = pd === "plate" ? STEEL : pd === "spikes" ? "#454b59" : pd === "orbs" ? "#00e5ff" : pd === "fur" ? shade(pal.gear, 1.25) : pal.gear;
      for (const s of ["L", "R"]) {
        const sh = off(j["sh" + s], B, 0, 0.7, 0);
        M.ellipsoid(sh, B, [3 * w, 2 * w, 3 * w], pc, { glow: pd === "orbs" });
        if (pd === "spikes") M.limb(sh, off(sh, B, 0, 4.5, 0), 0.9, 0.1, "#e5e8ef");
      }
    }
    // the back: pack, quiver, cape, wings, banner or crystal
    const bk = look.back, back = (y, z) => off(j.chest, B, 0, y, z);
    if (bk === "pack") M.block(back(-3, -4.4), B, [3.2, 4.2, 1.8], 1.1, pal.gear);
    if (bk === "quiver") {
      M.limb(back(-6, -3.8), back(4, -3.6), 1.6, 1.6, "#6b4426");
      for (const x of [-0.7, 0, 0.7]) M.limb(back(4, -3.6), off(back(8, -3.4), B, x, 0, 0), 0.25, 0.25, "#d9dde3");
    }
    if (bk === "cape") {
      const TL = j.capeTL, TR = j.capeTR, BL = j.capeBL, BR = j.capeBR;
      const mL = off(lerp(TL, BL, 0.5), B, 0, 0, -0.8), mR = off(lerp(TR, BR, 0.5), B, 0, 0, -0.8);
      M.quad([TL, TR, mR, mL], pal.gear); M.quad([mL, mR, BR, BL], shade(pal.gear, 0.85));
    }
    if (bk === "wings" || bk === "dwings") {
      const wc = bk === "wings" ? "#eef6ff" : "#8a1e38";
      for (const sx of [-1, 1]) {
        const root = back(0, -3), tip = off(root, B, sx * 12, 8, -3), low = off(root, B, sx * 14, -2, -4), inner = off(root, B, sx * 6, -9, -2);
        M.quad([root, tip, low, inner], wc);
        M.limb(root, tip, 0.7, 0.3, shade(wc, 0.8));
      }
    }
    if (bk === "banner") {
      M.limb(j.pack0, j.hat2, 0.6, 0.6, "#8a6236");
      const top = lerp(j.pack0, j.hat2, 0.95), low = lerp(j.pack0, j.hat2, 0.6);
      M.quad([top, off(top, B, 8, 0, 0), off(low, B, 8, 0, 0), low], pal.gear);
    }
    if (bk === "crystal") M.ellipsoid(back(3, -4.5), B, [2, 3.6, 2], "#00e5ff", { glow: true });
  }

  // ---------- four legs: the beast, and the dragon on top of it ----------
  function beast(j, look, M) {
    const pal = look.pal, b = look.build;
    const S = frameZY(sub(j.shoulders, j.hips), UPV), len = Math.hypot(...sub(j.shoulders, j.hips));
    const coat = pal.coat, under = pal.belly, dark = shade(coat, 0.75);
    // body: barrel, deep chest, haunch, pale belly, mane
    M.ellipsoid(lerp(j.hips, j.shoulders, 0.5), S, [b.body * 0.47, b.body * 0.5, len / 2 + b.body * 0.3], coat);
    M.ellipsoid(off(j.shoulders, S, 0, -0.2, -0.6), S, [b.body * 0.52, b.body * 0.64, b.body * 0.6], coat);
    M.ellipsoid(j.hips, S, [b.body * 0.5, b.body * 0.56, b.body * 0.55], coat);
    M.ellipsoid(off(lerp(j.belly0, j.belly1, 0.5), S, 0, 0.6, 0), S, [b.body * 0.36, b.body * 0.3, len / 2], under);
    if (look.mane) M.ellipsoid(lerp(j.shoulders, j.neck, 0.55), frameYZ(sub(j.head, j.shoulders), S.z), [b.body * 0.56, b.body * 0.62, b.body * 0.5], pal.mane);
    // neck and head
    M.limb(j.shoulders, j.neck, b.body * 0.4, b.body * 0.32, coat);
    M.limb(j.neck, j.head, b.body * 0.32, 2.3, coat);
    const Hd = frameZY(sub(j.snout, j.head), UPV);
    M.ellipsoid(j.head, Hd, [2.7, 2.5, 2.9], coat);
    M.limb(j.head, j.snout, 1.9, 1.15, coat);
    M.limb(j.head, j.jaw, 1.35, 0.85, shade(under, 0.9));
    M.ball(j.mouth, 0.9, "#5a1a1e");
    M.ball(j.nose, 0.75, "#1b1416");
    for (const s of ["L", "R"]) {
      M.ball(j["eye" + s], 0.55, pal.eye, { glow: true });
      const round = b.ear === "round";
      M.limb(j["ear" + s], j["earT" + s], round ? 1.25 : 1.05, round ? 0.85 : 0.15, pal.mane);
      if (look.tusks) M.limb(j["tusk" + s], j["tuskT" + s], 0.5, 0.1, "#efe6d0");
    }
    // legs: muscled upper leg, lower leg, paw
    for (const k of ["FL", "FR", "HL", "HR"]) {
      const top = j["top" + k], kn = j["kn" + k], ft = j["ft" + k], lw = b.legW;
      M.ellipsoid(lerp(top, kn, 0.3), frameYZ(sub(top, kn), S.z), [lw * 0.62, b.leg * 0.42, lw * 0.75], coat);
      M.limb(top, kn, lw * 0.6, lw * 0.44, coat);
      M.limb(kn, ft, lw * 0.44, lw * 0.34, coat);
      M.ellipsoid(add(ft, [0, 0.45, 0]), frameZY([S.z[0], 0, S.z[2]], UPV), [lw * 0.55, 0.55, lw * 0.75], dark);
    }
    // tail
    M.limb(j.tail0, j.tail1, b.tailW * 0.55, b.tailW * 0.45, coat);
    M.limb(j.tail1, j.tail2, b.tailW * 0.45, b.tailW * 0.2, look.tip ? under : coat);
    return S;
  }
  function dragon(j, look, M) {
    const S = beast(j, look, M), pal = look.pal;
    for (const s of ["L", "R"]) {
      const r = j["wRoot" + s], m = j["wMid" + s], t = j["wTip" + s], k = j["wBack" + s];
      M.quad([r, m, t, k], pal.mane);
      M.limb(r, m, 1.1, 0.75, pal.coat); M.limb(m, t, 0.75, 0.15, pal.coat); M.limb(m, k, 0.4, 0.15, shade(pal.coat, 0.8));
    }
    // spines along the back and neck, and horns
    for (let i = 0; i <= 5; i++) {
      const p = i < 4 ? lerp(j.hips, j.shoulders, i / 3) : lerp(j.shoulders, j.head, (i - 3) / 3);
      const base = off(p, S, 0, look.build.body * (i < 4 ? 0.5 : 0.3), 0);
      M.limb(base, off(base, S, 0, 2.2, -1.2), 0.8, 0.1, pal.mane);
    }
    const Hd = frameZY(sub(j.snout, j.head), UPV);
    for (const sx of [-1, 1]) { const b = off(j.head, Hd, sx * 1.2, 1.8, -1), m = off(b, Hd, sx * 0.6, 2, -2.4); M.limb(b, m, 0.7, 0.45, "#efe6d0"); M.limb(m, off(m, Hd, 0, 0.6, -2.6), 0.45, 0.08, "#efe6d0"); }
  }

  // ---------- trees ----------
  function tree(j, look, M) {
    const pal = look.pal, tw = look.build.trunk, R = look.build.r;
    for (let i = 0; i < 4; i++) M.limb(j["t" + i], j["t" + (i + 1)], tw * 0.55 * (1 - i * 0.18), tw * 0.55 * (1 - (i + 1) * 0.18), pal.trunk);
    // roots flare out at the foot
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.4; M.limb(add(j.t0, [0, tw * 0.6, 0]), [Math.cos(a) * tw * 1.5, 0.2, Math.sin(a) * tw * 1.5], tw * 0.32, tw * 0.12, shade(pal.trunk, 0.85)); }
    // canopy: each blob a lumpy cluster, lighter on top, with flowers when it has them
    (look.blobs || []).forEach(([, by, , r], i) => {
      const c = j["c" + i], rr = R * r;
      M.limb(lerp(j.t3, j.t4, 0.5), lerp(j.t4, c, 0.75), tw * 0.2, tw * 0.1, pal.trunk);
      M.ellipsoid(c, frameYZ(UPV, [0, 0, 1]), [rr, rr * 0.82, rr], pal.leaf);
      for (let k = 0; k < 5; k++) {
        const a = k * 2.4 + i, lift = k % 2 ? 0.35 : -0.1, d = [Math.cos(a) * 0.62, lift, Math.sin(a) * 0.62];
        M.ball(add(c, mul(d, rr)), rr * 0.55, k % 2 ? pal.light : shade(pal.leaf, 0.9));
      }
      if (pal.accent) for (let k = 0; k < 6; k++) { const a = k * 1.9 + i * 0.7, d = norm([Math.cos(a), 0.6, Math.sin(a)]); M.ball(add(c, mul(d, rr * 0.98)), rr * 0.12, pal.accent); }
    });
    if (look.kind === "pine") for (let i = 0; i < 4; i++) M.limb(j["pC" + i], j["pT" + i], j["pR" + i][0], 0.3, i % 2 ? pal.light : pal.leaf, { flat: 0.2 });
    if (look.kind === "willow") for (let i = 0; i < 10; i++) M.limb(j["s" + i], j["sT" + i], 0.45, 0.2, pal.light);
    if (look.kind === "palm") {
      for (let i = 0; i < 7; i++) {
        const a = j["f0" + i], b = j["f1" + i], c = j["f2" + i], side = mul(norm(cross(sub(c, a), UPV)), 1.7);
        M.quad([add(a, mul(side, 0.3)), add(b, side), sub(b, side), sub(a, mul(side, 0.3))], pal.leaf);
        M.quad([add(b, side), add(c, mul(side, 0.2)), sub(c, mul(side, 0.2)), sub(b, side)], pal.light);
      }
      for (let i = 0; i < 3; i++) { const a = i * 2.1; M.ball(add(j.t4, [Math.cos(a) * 1.2, -1, Math.sin(a) * 1.2]), 1.1, "#6a4a2a"); }
    }
  }

  // ---------- the chest: a box and a lid, banded and locked ----------
  function chest(j, look, M) {
    const pal = look.pal;
    // a box from its eight named corners: centre, frame and half sizes
    const boxOf = (n) => {
      const c = (k) => j[n + k], ks = ["Lbf", "Rbf", "Ltf", "Rtf", "Lbk", "Rbk", "Ltk", "Rtk"];
      const mid = mul(ks.reduce((s, k) => add(s, c(k)), [0, 0, 0]), 1 / 8);
      const f = frameYZ(sub(c("Ltf"), c("Lbf")), sub(c("Lbf"), c("Lbk")));
      return { mid, f, half: [Math.hypot(...sub(c("Rbf"), c("Lbf"))) / 2, Math.hypot(...sub(c("Ltf"), c("Lbf"))) / 2, Math.hypot(...sub(c("Lbf"), c("Lbk"))) / 2], c };
    };
    const B = boxOf("B"), L = boxOf("L");
    M.block(B.mid, B.f, B.half, 0.7, pal.wood);
    M.block(L.mid, L.f, L.half, 1, pal.lid);
    // bands round box and lid, metal caps on the box's corners, the lock
    // a band is named by its front edge; it sits at the box's middle depth and wraps front, top and back
    const band = (a, b, X) => M.block(off(lerp(a, b, 0.5), X.f, 0, 0, -X.half[2] - 0.06), X.f, [0.65, X.half[1] + 0.12, X.half[2] + 0.15], 0.2, pal.band);
    for (const i of [0, 1]) { band(j["bb" + i], j["bt" + i], B); band(j["lb" + i], j["lt" + i], L); }
    for (const k of ["Lbf", "Rbf", "Ltf", "Rtf", "Lbk", "Rbk", "Ltk", "Rtk"]) M.ball(B.c(k), 0.6, pal.band);
    M.block(j.lockB, B.f, [1.25, 1.3, 0.35], 0.25, pal.band);
    M.block(off(j.lockB, B.f, 0, -0.1, 0.3), B.f, [0.3, 0.55, 0.1], 0.05, "#1a1214");
    if (j.lidA[0] > 0.4 && !look.mimic) M.ball(j.in, 2.2, "#ffd35c", { glow: true });
    if (look.mimic) {
      for (let i = 0; i < 5; i++) {
        M.limb(j["tt" + i], off(j["tt" + i], L.f, 0, -1.7, 0), 0.55, 0.06, "#f4ead8");
        M.limb(j["tb" + i], off(j["tb" + i], B.f, 0, 1.5, 0), 0.5, 0.06, "#f4ead8");
      }
      for (const s of ["L", "R"]) M.ball(j["eye" + s], 0.9, "#ff3a2a", { glow: true });
      if (j.lidA[0] > 0.2) M.limb(j.in, off(j.lockB, B.f, 0, 1.6, 1.5), 1.2, 0.7, "#c8344a");
    }
  }

  return { figure, beast, dragon, tree, chest };
})();
