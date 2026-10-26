// ---------- the rig kit: skeletons, clips and looks ----------
// Shared by the 8-Way Sprite Rig and Cinderdeep 3D (both builds include src/kit/). Every subject's pose is a
// function of its clip and clip time t (0..1): joints in pose units, y up, z forward, feet at the origin.
window.RigKit = (() => {
  const TAU = Math.PI * 2;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const limb = (ang, len) => [0, -len * Math.cos(ang), len * Math.sin(ang)];
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  // the body's height, breadth and head size; the bench changes them, the game leaves them be
  const NO_MORPH = { h: 1, b: 1, hd: 1 };

  const CHAR_CLIPS = {
    idle: { name: "Idle", rate: 0.35, sym: true, shift: 0 },
    walk: { name: "Walk", rate: 1, sym: true, shift: 0.5 },
    run: { name: "Run", rate: 1.6, sym: true, shift: 0.5 },
    attack: { name: "Attack", rate: 1.1, sym: false, shift: 0, loop: false, why: "Attack swings the right arm. Flipped, it would swing the left, so this clip bakes and uses every row even with mirroring on." },
    dash: { name: "Dash", rate: 1.8, sym: true, shift: 0, loop: false },
    cast: { name: "Cast", rate: 0.9, sym: true, shift: 0 },
    spin: { name: "Whirl", rate: 1.7, sym: false, shift: 0, why: "Whirlwind spins 360° counter-clockwise in 3D space, so every direction row is uniquely baked." },
    hurt: { name: "Collapse", rate: 0.9, sym: true, shift: 0, loop: false },
  };
  function charPose(clip, t, morph = NO_MORPH) {
    const ph = t * TAU, j = {}, Lg = {}, Ar = {};
    let hy = 20, lean = 0, twist = 0, breath = 0, capeZ = -3.2, capeY = 0;
    if (clip === "idle") {
      hy = 20 + 0.2 * Math.sin(ph); breath = 0.35 * Math.sin(ph);
      for (const s of ["L", "R"]) { Lg[s] = [0.02, 0.06]; Ar[s] = [0.08 + 0.03 * Math.sin(ph), 0.2 + 0.05 * Math.sin(ph)]; }
      capeZ = -2.6 - 0.2 * Math.sin(ph);
    } else if (clip === "walk" || clip === "run") {
      const run = clip === "run";
      hy = run ? 18.6 + 1.3 * Math.cos(2 * ph) : 20 + 0.8 * Math.cos(2 * ph);
      lean = run ? 2.4 : 0.3;
      for (const [s, off] of [["L", 0], ["R", Math.PI]]) {
        const p = ph + off;
        Lg[s] = run ? [0.95 * Math.sin(p), 1.45 * Math.max(0, Math.sin(p - 0.7)) + 0.2] : [0.55 * Math.sin(p), 0.85 * Math.max(0, Math.sin(p - 0.9))];
        Ar[s] = run ? [-0.95 * Math.sin(p), 1.35 + 0.25 * Math.max(0, Math.sin(p))] : [-0.5 * Math.sin(p), 0.45 + 0.3 * Math.max(0, Math.sin(p))];
      }
      capeZ = run ? -6.5 - 0.8 * Math.sin(2 * ph) : -3.4 - 0.6 * Math.sin(2 * ph);
      capeY = run ? 3 : 0.5;
    } else if (clip === "dash") {
      // a low lunge: legs reaching, arms swept back
      const k = Math.sin(t * Math.PI);
      hy = 17 - 2.5 * k; lean = 5.2 * k;
      for (const [s, off] of [["L", 0], ["R", Math.PI]]) { Lg[s] = [1.1 * Math.sin(ph + off), 1.6]; Ar[s] = [-0.9, 1.2]; }
      capeZ = -7 - 2 * k; capeY = 3;
    } else {
      // wind up overhead, chop, follow through, recover
      const seg = (a, b) => ease((t - a) / (b - a));
      let sw, fe;
      if (t < 0.38) { const k = seg(0, 0.38); sw = lerp(0.2, -2.55, k); fe = lerp(0.45, 1.3, k); twist = lerp(0, 0.35, k); lean = lerp(0, -0.8, k); }
      else if (t < 0.56) { const k = seg(0.38, 0.56); sw = lerp(-2.55, 1.35, k); fe = lerp(1.3, 0.1, k); twist = lerp(0.35, -0.3, k); lean = lerp(-0.8, 2.2, k); hy -= 1.2 * k; }
      else if (t < 0.78) { const k = seg(0.56, 0.78); sw = lerp(1.35, 1.05, k); fe = lerp(0.1, 0.25, k); twist = -0.3; lean = 2.2; hy -= 1.2; }
      else { const k = seg(0.78, 1); sw = lerp(1.05, 0.2, k); fe = lerp(0.25, 0.45, k); twist = lerp(-0.3, 0, k); lean = lerp(2.2, 0, k); hy -= lerp(1.2, 0, k); }
      Ar.R = [sw, fe]; Ar.L = [0.75, 1.25];
      Lg.L = [0.32, 0.35]; Lg.R = [-0.3, 0.12];
      capeZ = -3 - lean * 0.6; capeY = 0.4;
    }
    const b = breath;
    j.hip = [0, hy, 0];
    j.chest = [0, hy + 11 + b, 1]; j.neck = [0, hy + 14 + b, 1.2]; j.head = [0, hy + 18 + b, 1.4]; j.visor = [0, hy + 18.4 + b, 4.3];
    j.pack0 = [0, hy + 4, -2.4]; j.pack1 = [0, hy + 10 + b, -2.0];
    j.capeTL = [-4, hy + 10.6 + b, -1.5]; j.capeTR = [4, hy + 10.6 + b, -1.5];
    j.capeBL = [-5.4, hy - 6.5 + capeY, capeZ]; j.capeBR = [5.4, hy - 6.5 + capeY, capeZ];
    j.crest0 = [0, hy + 22.3 + b, 1.4]; j.crest1 = [0, hy + 21.3 + b, -2.8];
    j.hood0 = [0, hy + 20.2 + b, -1.6]; j.hood1 = [0, hy + 17.4 + b, -4.8];
    j.hat0 = [0, hy + 21.4 + b, 1.2]; j.hat1 = [0, hy + 25 + b, 0.2]; j.hat2 = [0, hy + 28.6 + b, -1.8];
    for (const [s, sx] of [["L", -1], ["R", 1]]) {
      const [a, k] = Lg[s], [sw, fe] = Ar[s];
      const hp = [sx * 3, hy, 0], kn = add(hp, limb(a, 10)), ft = add(kn, limb(a - k, 10));
      const sh = [sx * 5, hy + 10 + b, 1], el = add(sh, limb(sw, 7)), ha = add(el, limb(sw + fe, 7));
      Object.assign(j, { ["hp" + s]: hp, ["kn" + s]: kn, ["ft" + s]: ft, ["sh" + s]: sh, ["el" + s]: el, ["ha" + s]: ha });
    }
    // twist the shoulders round the spine, then lean the upper body over the hips
    if (twist) {
      const c = Math.cos(twist), sn = Math.sin(twist), cz = j.chest[2];
      for (const k of ["shL", "elL", "haL", "shR", "elR", "haR"]) { const [x, y, z] = j[k]; j[k] = [x * c + (z - cz) * sn, y, -x * sn + (z - cz) * c + cz]; }
    }
    if (clip === "cast") {
      const lift = 1.8 * Math.sin(ph);
      hy = 21.5 + lift; lean = -1.2;
      for (const s of ["L", "R"]) {
        const hp = [s === "L" ? -3 : 3, hy, 0];
        j["hp" + s] = hp; j["kn" + s] = add(hp, [0, -9, 1.5]); j["ft" + s] = add(hp, [0, -18, -1]);
        const sh = [s === "L" ? -5 : 5, hy + 10.5, 1];
        j["sh" + s] = sh; j["el" + s] = add(sh, [s === "L" ? -3 : 3, 5 + Math.sin(ph * 2), 3]);
        j["ha" + s] = add(j["el" + s], [s === "L" ? -1 : 1, 6 + Math.cos(ph * 2), 4]);
      }
    } else if (clip === "spin") {
      const spA = t * TAU;
      const c = Math.cos(spA), sn = Math.sin(spA);
      for (const s of ["L", "R"]) {
        const sx = s === "L" ? -1 : 1;
        j["sh" + s] = [sx * 5, hy + 10, 1];
        j["el" + s] = [sx * 10, hy + 10, 2];
        j["ha" + s] = [sx * 16, hy + 10.5, 3];
      }
      for (const k in j) {
        const [x, y, z] = j[k];
        j[k] = [x * c + z * sn, y, -x * sn + z * c];
      }
    } else if (clip === "hurt") {
      const k = ease(Math.min(1, t * 1.35));
      hy = 20 - 11 * k; lean = -4.5 * k;
      for (const s of ["L", "R"]) {
        const sx = s === "L" ? -3 : 3;
        j["hp" + s] = [sx, hy, 0];
        j["kn" + s] = [sx * 1.2, Math.max(2, hy - 8 * (1 - 0.4 * k)), 4 * k];
        j["ft" + s] = [sx * 1.3, 0.5, 8 * k];
        j["el" + s] = [sx * 2.2, hy + 6 * (1 - k * 0.5), -3 * k];
        j["ha" + s] = [sx * 2.6, Math.max(1, hy + 2 * (1 - k)), -5 * k];
      }
    }
    if (lean) for (const k in j) {
      if (/^(hip|hp|kn|ft|capeB)/.test(k)) continue;
      const f = clamp((j[k][1] - hy) / 18, 0, 1);
      j[k] = [j[k][0], j[k][1], j[k][2] + lean * f];
    }
    const pH = morph.h, pB = morph.b;
    if (pH !== 1 || pB !== 1) {
      for (const k in j) j[k] = [j[k][0] * pB, j[k][1] * pH, j[k][2] * pB];
    }
    return j;
  }
  const PRESETS = {
    scout: { name: "Scout", pal: { shirt: "#d9822b", pants: "#3b4a6b", skin: "#f0c79c", hair: "#2a1f1a", gear: "#6b5136" }, head: "none", back: "pack", right: "torch", left: "none", pauldron: "none", enchant: "none" },
    knight: { name: "Knight", pal: { shirt: "#8d99ae", pants: "#454b59", skin: "#e8b48c", hair: "#5a3a22", gear: "#a8322d" }, head: "helmet", back: "cape", right: "sword", left: "shield", pauldron: "plate", enchant: "none" },
    ranger: { name: "Ranger", pal: { shirt: "#4f7a3a", pants: "#5a4632", skin: "#c99272", hair: "#c4501f", gear: "#2f4d24" }, head: "hood", back: "quiver", right: "bow", left: "dagger", pauldron: "fur", enchant: "venom" },
    mage: { name: "Mage", pal: { shirt: "#5a3e8a", pants: "#2c2440", skin: "#f0c09a", hair: "#e8e0d0", gear: "#3a2a5a" }, head: "hat", back: "cape", right: "staff", left: "tome", pauldron: "orbs", enchant: "storm" },
    paladin: { name: "Paladin", pal: { shirt: "#e6c875", pants: "#5c6478", skin: "#f4cbb0", hair: "#fff1c2", gear: "#2b5bd8" }, head: "crown", back: "wings", right: "hammer", left: "tshield", pauldron: "plate", enchant: "fire" },
    necromancer: { name: "Necro", pal: { shirt: "#281e38", pants: "#14101c", skin: "#c8d0d8", hair: "#7cf9ff", gear: "#6a1b4d" }, head: "plague", back: "dwings", right: "scythe", left: "skull", pauldron: "spikes", enchant: "void" },
    berserker: { name: "Berserker", pal: { shirt: "#8a2820", pants: "#3a261e", skin: "#d89c74", hair: "#1a1210", gear: "#5a3e28" }, head: "viking", back: "banner", right: "axe", left: "torch", pauldron: "fur", enchant: "fire" },
    assassin: { name: "Assassin", pal: { shirt: "#1e2636", pants: "#121722", skin: "#e0b89c", hair: "#a8b4c8", gear: "#00a8c4" }, head: "horns", back: "crystal", right: "frostblade", left: "dagger", pauldron: "spikes", enchant: "frost" },
  };
  const STEEL = "#aab3c2", CREST = "#c8372d", VISOR = "#1b2232";
  const seg = (t, a, b) => ease((t - a) / (b - a));
  const BEAST_CLIPS = {
    idle: { name: "Idle", rate: 0.35, sym: true, shift: 0 },
    walk: { name: "Trot", rate: 1, sym: true, shift: 0.5 },
    run: { name: "Bound", rate: 1.5, sym: true, shift: 0 },
    attack: { name: "Pounce", rate: 1.1, sym: true, shift: 0 },
  };
  function beastPose(clip, t, look) {
    const ph = t * TAU, j = {}, b = look.build, L = {};
    let lift = 0, pitch = 0, fwd = 0, hy = 0, hz = 0, jaw = 0.15, tailA = 0, tailUp = 0.5;
    for (const k of ["FL", "FR", "HL", "HR"]) L[k] = [0, 0.1];
    if (clip === "idle") { lift = 0.25 * Math.sin(ph); hy = 0.35 * Math.sin(ph + 1); tailA = 0.3 * Math.sin(ph); }
    else if (clip === "walk") {
      // a trot: diagonal pairs move together
      const pp = { FL: 0, HR: 0, FR: Math.PI, HL: Math.PI };
      for (const k in L) { const p = ph + pp[k]; L[k] = [0.5 * Math.sin(p), 0.8 * Math.max(0, Math.sin(p - 0.8)) + 0.1]; }
      lift = 0.5 * Math.abs(Math.sin(ph)); hy = 0.45 * Math.sin(2 * ph); tailA = 0.45 * Math.sin(ph); tailUp = 0.6;
    } else if (clip === "run") {
      // a bound: hind legs push together, front legs land together, the spine flexes between
      const hp = ph, fp = ph + Math.PI;
      for (const k of ["HL", "HR"]) L[k] = [0.85 * Math.sin(hp), 1.1 * Math.max(0, Math.sin(hp - 0.7)) + 0.1];
      for (const k of ["FL", "FR"]) L[k] = [0.85 * Math.sin(fp), 1.1 * Math.max(0, Math.sin(fp - 0.7)) + 0.1];
      lift = 1.4 * Math.max(0, Math.sin(ph * 2 + 0.5)); pitch = 0.16 * Math.sin(ph); hy = -0.4 * Math.sin(2 * ph); tailA = 0.15 * Math.sin(ph); tailUp = 0.9;
    } else {
      // crouch, leap, bite, land
      if (t < 0.35) { const k = seg(t, 0, 0.35); lift = -2.2 * k; fwd = -1.2 * k; pitch = -0.1 * k; hy = -1 * k; for (const q in L) L[q] = [q[0] === "F" ? 0.3 * k : -0.2 * k, 0.9 * k + 0.1]; }
      else if (t < 0.6) { const k = seg(t, 0.35, 0.6); lift = lerp(-2.2, 2.6, k); fwd = lerp(-1.2, 5, k); pitch = lerp(-0.1, -0.22, k); hy = lerp(-1, 1, k); jaw = lerp(0.15, 1.1, k); for (const q in L) L[q] = q[0] === "F" ? [lerp(0.3, 1.2, k), 0.2] : [lerp(-0.2, -0.9, k), 0.3]; }
      else if (t < 0.78) { const k = seg(t, 0.6, 0.78); lift = lerp(2.6, 0, k); fwd = 5; pitch = lerp(-0.22, 0.12, k); hy = lerp(1, -1.4, k); jaw = lerp(1.1, 0.1, k); for (const q in L) L[q] = q[0] === "F" ? [lerp(1.2, 0.2, k), 0.5] : [lerp(-0.9, -0.2, k), 0.3]; }
      else { const k = seg(t, 0.78, 1); fwd = lerp(5, 0, k); pitch = lerp(0.12, 0, k); hy = lerp(-1.4, 0, k); for (const q in L) L[q] = [lerp(q[0] === "F" ? 0.2 : -0.2, 0, k), 0.1]; }
      tailUp = 0.8; tailA = 0.1 * Math.sin(ph * 3);
    }
    const H = b.leg * 2 + 1.5, half = b.len / 2;
    j.hips = [0, H + lift - pitch * half, -half + fwd]; j.shoulders = [0, H + lift + pitch * half + 0.6, half + fwd];
    j.belly0 = add(j.hips, [0, -b.body * 0.32, 1]); j.belly1 = add(j.shoulders, [0, -b.body * 0.32, -1]);
    j.neck = add(j.shoulders, [0, 2.6 + hy * 0.5, 2.2 + hz]);
    j.head = add(j.shoulders, [0, 4.4 + hy, 4.4 + hz]);
    j.snout = add(j.head, [0, -0.8 - jaw * 0.4, b.snout]); j.nose = add(j.snout, [0, 0.2, 0.6]);
    j.jaw = add(j.head, [0, -1.8 - jaw * 1.6, b.snout * 0.85]); j.mouth = add(j.head, [0, -1.1 - jaw * 0.8, b.snout * 0.7]);
    for (const [s, sx] of [["L", -1], ["R", 1]]) {
      j["ear" + s] = add(j.head, [sx * 1.4, 1.8, -0.6]); j["earT" + s] = add(j.head, b.ear === "round" ? [sx * 2.4, 3, -0.6] : [sx * 2.3, 4.7, -0.4]);
      j["eye" + s] = add(j.head, [sx * 1.25, 0.6, 1.6]); j["tusk" + s] = add(j.snout, [sx * 1.1, -0.6, -0.2]); j["tuskT" + s] = add(j["tusk" + s], [sx * 0.4, 1.4, 0.6]);
    }
    // the tail curls up and back, swinging side to side
    const tb = add(j.hips, [0, 0.6, -1.4]);
    j.tail0 = tb; j.tail1 = add(tb, [Math.sin(tailA) * b.tail * 0.5, tailUp * b.tail * 0.45, -b.tail * 0.45]);
    j.tail2 = add(j.tail1, [Math.sin(tailA * 1.6) * b.tail * 0.5, (tailUp - 0.45) * b.tail * 0.5, -b.tail * 0.42]);
    for (const k of ["FL", "FR", "HL", "HR"]) {
      // legs hang from the outside of the chest and haunch, so the beast has shoulders when it faces you
      const sx = k[1] === "L" ? -1 : 1, top = add(k[0] === "F" ? j.shoulders : j.hips, [sx * b.body * 0.4, -0.6, 0]), [a, kb] = L[k];
      const knee = add(top, limb(a, b.leg)), foot = add(add(knee, limb(a - kb * (k[0] === "F" ? 1 : -0.6), b.leg)), [sx * 0.3, 0, 0]);
      if (foot[1] < 0) foot[1] = 0;
      j["top" + k] = top; j["kn" + k] = knee; j["ft" + k] = foot;
    }
    return j;
  }
  const BEAST_PRESETS = {
    wolf: { name: "Wolf", metres: 0.9, pal: { coat: "#8d96a3", belly: "#d9dde3", mane: "#6d7480", eye: "#e8c04a" }, build: { len: 11, body: 6.2, leg: 4.6, legW: 2, tail: 7, tailW: 2.2, snout: 3.6, ear: "point" }, mane: true },
    fox: { name: "Fox", metres: 0.5, pal: { coat: "#d8752e", belly: "#f4ead8", mane: "#c4602a", eye: "#2a1f1a" }, build: { len: 9.5, body: 5.2, leg: 4, legW: 1.6, tail: 8.5, tailW: 3.2, snout: 3.4, ear: "point" }, tip: true },
    bear: { name: "Bear", metres: 1.6, hump: true, pal: { coat: "#6b4a30", belly: "#8a6a48", mane: "#5a3e28", eye: "#1b1416" }, build: { len: 12, body: 9, leg: 4.2, legW: 3, tail: 2, tailW: 2, snout: 2.6, ear: "round" } },
    boar: { name: "Boar", metres: 0.95, feet: "hoof", pal: { coat: "#5a4238", belly: "#7a6052", mane: "#3a2a24", eye: "#1b1416" }, build: { len: 10.5, body: 7.6, leg: 3.4, legW: 2.2, tail: 2.6, tailW: 1, snout: 3, ear: "point" }, mane: true, tusks: true },
    tiger: { name: "Dire Tiger", metres: 1.25, stripes: true, pal: { coat: "#e07a28", belly: "#f8ecd8", mane: "#2a1810", eye: "#7cf9ff" }, build: { len: 12.5, body: 6.8, leg: 4.8, legW: 2.3, tail: 8.5, tailW: 1.8, snout: 3.2, ear: "round" }, mane: true, tusks: true },
    stag: { name: "Runic Stag", metres: 1.9, feet: "hoof", antlers: true, pal: { coat: "#8a6240", belly: "#decbb4", mane: "#ffd35c", eye: "#00e5ff" }, build: { len: 11.5, body: 5.8, leg: 6.0, legW: 1.6, tail: 3.0, tailW: 1.5, snout: 3.8, ear: "point" }, mane: true },
    drake: { name: "Cinder Drake", metres: 1.5, pal: { coat: "#a82820", belly: "#ffb35e", mane: "#ff5a20", eye: "#fff27a" }, build: { len: 13.0, body: 7.2, leg: 4.4, legW: 2.5, tail: 10.0, tailW: 2.6, snout: 4.2, ear: "point" }, mane: true, tusks: true },
    hound: { name: "Hellhound", metres: 1.1, ember: true, pal: { coat: "#281c24", belly: "#ff6a28", mane: "#ff2a4a", eye: "#fff27a" }, build: { len: 11.2, body: 6.5, leg: 4.7, legW: 2.1, tail: 6.5, tailW: 2.0, snout: 3.8, ear: "point" }, mane: true, tusks: true },
  };
  const WIND = "The wind blows one way. Flipped, the tree would lean into it, so this clip bakes every row.";
  const TREE_CLIPS = {
    sway: { name: "Sway", rate: 0.3, sym: false, shift: 0, why: WIND },
    gust: { name: "Gust", rate: 0.55, sym: false, shift: 0, why: WIND },
    shaken: { name: "Shaken", rate: 0.9, sym: false, shift: 0, loop: false, why: "A blow from one side rings out to the other: flipped, it would come from the wrong side, so every row is baked." },
  };
  function treePose(clip, t, look) {
    const ph = t * TAU, j = {}, Ht = look.build.h;
    let lean = 0, side = 0, flutter = 0.25;
    if (clip === "sway") { lean = 0.05 + 0.05 * Math.sin(ph); side = 0.02 * Math.sin(ph * 2 + 1); }
    else if (clip === "gust") { lean = 0.15 + 0.09 * Math.sin(ph) + 0.03 * Math.sin(ph * 3); side = 0.05 * Math.sin(ph * 2); flutter = 0.8; }
    else { const k = Math.exp(-t * 4.5); lean = 0.24 * Math.sin(t * TAU * 4) * k; side = 0.1 * Math.cos(t * TAU * 4) * k; flutter = 1.4 * k + 0.2; }
    // the wind blows along +x; each trunk joint leans further than the one below
    const bend = (y) => { const f = Math.pow(y / Ht, 1.6); return [lean * Ht * f, y, side * Ht * f]; };
    for (let i = 0; i <= 4; i++) j["t" + i] = bend((Ht * i) / 4);
    const top = j.t4, dx = top[0], dz = top[2];
    const R = look.build.r;
    (look.blobs || []).forEach(([x, y, z, r], i) => {
      const f = 1 + y / (Ht * 0.6), w = flutter * 0.5 * Math.sin(ph * 2 + i * 1.7);
      j["c" + i] = [x * R + dx * f + w, Ht - R * 0.3 + y * R, z * R + dz * f + w * 0.6];
    });
    if (look.kind === "willow") for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU, ax = Math.cos(a) * R * 0.85 + dx * 1.05, az = Math.sin(a) * R * 0.85 + dz * 1.05, ay = Ht - R * 0.35;
      // strands hang from the canopy rim and trail behind its swing
      j["s" + i] = [ax, ay, az]; j["sT" + i] = [ax - lean * Ht * 0.5 + 0.4 * Math.sin(ph + i), ay - Ht * 0.55, az - side * Ht * 0.5];
    }
    if (look.kind === "palm") for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.3, c = Math.cos(a), s = Math.sin(a), wob = flutter * 0.6 * Math.sin(ph * 2 + i);
      j["f0" + i] = top; j["f1" + i] = [top[0] + c * 4.5 + dx * 0.3, top[1] + 2.2 + wob, top[2] + s * 4.5 + dz * 0.3];
      j["f2" + i] = [top[0] + c * 9 + dx * 0.6 + lean * 6, top[1] - 1.5 + wob * 1.6, top[2] + s * 9 + dz * 0.6];
    }
    if (look.kind === "pine") for (let i = 0; i < 4; i++) {
      const y = Ht * (0.32 + i * 0.2), c = bend(y), r = R * (1 - i * 0.22);
      j["pT" + i] = add(bend(Math.min(Ht * 1.08, y + Ht * 0.3)), [0, 0, 0]); j["pC" + i] = c; j["pR" + i] = [r, 0, 0];
    }
    return j;
  }
  const TREE_PRESETS = {
    oak: { name: "Oak", metres: 10, kind: "oak", pal: { trunk: "#6a4a2a", leaf: "#3e8a3a", light: "#6cb85a", accent: null }, build: { h: 18, r: 9, trunk: 3.6 }, blobs: [[0, 0.9, 0, 0.75], [-0.6, 0.4, 0.3, 0.55], [0.6, 0.45, -0.2, 0.55], [0.1, 0.35, 0.65, 0.5], [-0.2, 0.5, -0.65, 0.5], [0.35, 1.3, 0.2, 0.45]] },
    pine: { name: "Pine", metres: 16, kind: "pine", pal: { trunk: "#5a3e24", leaf: "#2e6a3e", light: "#3e8a4e", accent: null }, build: { h: 30, r: 9, trunk: 2.6 } },
    willow: { name: "Willow", metres: 9, kind: "willow", pal: { trunk: "#4a3a2a", leaf: "#5a7a3a", light: "#8aac5a", accent: null }, build: { h: 16, r: 10, trunk: 4 }, blobs: [[0, 0.7, 0, 0.8], [-0.55, 0.35, 0.2, 0.55], [0.55, 0.35, -0.2, 0.55], [0, 0.3, 0.6, 0.5], [0, 0.4, -0.6, 0.5]] },
    blossom: { name: "Blossom", metres: 6, kind: "oak", pal: { trunk: "#5a3a3a", leaf: "#ff9ac8", light: "#ffd8e8", accent: "#ffffff" }, build: { h: 15, r: 8.5, trunk: 3.2 }, blobs: [[0, 0.85, 0, 0.7], [-0.6, 0.35, 0.3, 0.55], [0.6, 0.4, -0.25, 0.55], [0.15, 0.3, 0.6, 0.5], [-0.25, 0.45, -0.6, 0.48]] },
    palm: { name: "Palm", metres: 12, kind: "palm", pal: { trunk: "#9a7a4a", leaf: "#3a8a3a", light: "#5ab04a", accent: null }, build: { h: 24, r: 6, trunk: 2.6 }, blobs: [[0, 0.3, 0, 0.22]] },
  };
  const CHEST_CLIPS = {
    shut: { name: "Shut", rate: 0.4, sym: true, shift: 0 },
    open: { name: "Open", rate: 0.8, sym: true, shift: 0, loop: false },
    close: { name: "Close", rate: 1, sym: true, shift: 0, loop: false },
    rattle: { name: "Rattle", rate: 1.2, sym: true, shift: 0 },
  };
  const BOX = { w: 7, d: 4.5, h: 6.5, lid: 2.6 };
  function chestPose(clip, t, look) {
    const ph = t * TAU, { w, d, h, lid: lt } = BOX;
    let lid = 0, hop = 0, yaw = 0;
    if (clip === "shut") lid = look.mimic ? 0.06 + 0.06 * Math.sin(ph) : 0;
    else if (clip === "open") { const k = seg(t, 0, 0.55); lid = 1.95 * k + (t > 0.55 ? 0.14 * Math.sin((t - 0.55) * 18) * Math.exp(-(t - 0.55) * 7) : 0); }
    else if (clip === "close") { const k = seg(t, 0, 0.45); lid = 1.95 * (1 - k); hop = t > 0.45 && t < 0.62 ? 0.6 * Math.sin(((t - 0.45) / 0.17) * Math.PI) : 0; }
    else { lid = 0.25 + 0.3 * Math.abs(Math.sin(ph * 3)); hop = 1.4 * Math.abs(Math.sin(ph * 2)); yaw = 0.14 * Math.sin(ph * 4); }
    const j = { lidA: [lid, 0, 0] }, c = Math.cos(yaw), s = Math.sin(yaw), put = (k, p) => { j[k] = [p[0] * c + p[2] * s, p[1] + hop, -p[0] * s + p[2] * c]; };
    // the lid turns about the back top edge of the box
    const ca = Math.cos(lid), sa = Math.sin(lid), lp = (x, y, z) => { const dy = y - h, dz = z + d; return [x, h + dy * ca + dz * sa, -d - dy * sa + dz * ca]; };
    // corners named by side (L/R), height (b/t) and depth (f front, k back), for the box (B) and the lid (L)
    for (const [sx, xs] of [["L", -1], ["R", 1]]) for (const [sz, z] of [["f", d], ["k", -d]]) {
      put("B" + sx + "b" + sz, [xs * w, 0, z]); put("B" + sx + "t" + sz, [xs * w, h, z]);
      put("L" + sx + "b" + sz, lp(xs * w, h, z)); put("L" + sx + "t" + sz, lp(xs * w, h + lt, z));
    }
    for (const [i, x] of [[0, -4.2], [1, 4.2]]) { put("bb" + i, [x, 0.2, d + 0.06]); put("bt" + i, [x, h - 0.2, d + 0.06]); put("lb" + i, lp(x, h + 0.2, d + 0.06)); put("lt" + i, lp(x, h + lt - 0.2, d + 0.06)); }
    put("lock", lp(0, h + 0.5, d + 0.08)); put("lockB", [0, h - 1.3, d + 0.08]);
    for (let i = 0; i < 5; i++) { put("tt" + i, lp(-w + 1.6 + i * 2.7, h - 0.1, d + 0.05)); put("tb" + i, [-w + 2.9 + i * 2.7, h - 0.2, d + 0.05]); }
    put("eyeL", lp(-2.4, h + 1.6, d + 0.1)); put("eyeR", lp(2.4, h + 1.6, d + 0.1)); put("in", [0, h - 1.4, 0]);
    return j;
  }
  const CHEST_PRESETS = {
    wood: { name: "Wooden", pal: { wood: "#8a5a32", lid: "#a8743e", band: "#4a3a2a" } },
    iron: { name: "Iron-bound", pal: { wood: "#5a4632", lid: "#6a5440", band: "#aab3c2" } },
    gold: { name: "Golden", pal: { wood: "#c8901c", lid: "#e0a82a", band: "#fff1a8" } },
    mimic: { name: "Mimic", pal: { wood: "#7a4a2a", lid: "#93603a", band: "#3a2a1a" }, mimic: true },
  };
  const DRAGON_CLIPS = {
    idle: { name: "Hover", rate: 0.45, sym: true, shift: 0 },
    walk: { name: "Stalk", rate: 0.9, sym: true, shift: 0.5 },
    run: { name: "Soar", rate: 1.5, sym: true, shift: 0 },
    attack: { name: "Firebreath", rate: 1.0, sym: true, shift: 0, loop: false },
  };
  function dragonPose(clip, t, look) {
    const ph = t * TAU, j = beastPose(clip === "run" ? "run" : clip === "walk" ? "walk" : clip === "attack" ? "attack" : "idle", t, look);
    const flap = clip === "run" ? Math.sin(ph * 2) * 9 : clip === "attack" ? 6 * Math.sin(t * Math.PI) : Math.sin(ph) * 4.5;
    const lift = clip === "run" ? 4 + 2 * Math.sin(ph) : 0;
    for (const k in j) j[k] = [j[k][0], j[k][1] + lift, j[k][2]];
    for (const [s, sx] of [["L", -1], ["R", 1]]) {
      j["wRoot" + s] = add(j.shoulders, [sx * 2.5, 2.5, -1]);
      j["wMid" + s] = add(j["wRoot" + s], [sx * 9, 5 + flap * 0.7, -2]);
      j["wTip" + s] = add(j["wMid" + s], [sx * 8, flap * 1.1 - 2, -4]);
      j["wBack" + s] = add(j["wRoot" + s], [sx * 10, -2 + flap * 0.4, -7]);
    }
    return j;
  }
  const DRAGON_PRESETS = {
    ember: { name: "Ember Wyrm", pal: { coat: "#b8281e", belly: "#ffb35e", mane: "#ff6a28", eye: "#fff27a" }, build: { len: 13, body: 7, leg: 4.5, legW: 2.4, tail: 10, tailW: 2.5, snout: 4.4, ear: "point" }, mane: true, tusks: true },
    frost: { name: "Frost Wyvern", pal: { coat: "#3a7ab8", belly: "#d6f6ff", mane: "#00e5ff", eye: "#ffffff" }, build: { len: 12.5, body: 6.4, leg: 4.2, legW: 2.1, tail: 11, tailW: 2.2, snout: 4.2, ear: "point" }, mane: true, tusks: true },
    storm: { name: "Storm Drake", pal: { coat: "#3a3868", belly: "#9fa8ff", mane: "#fff27a", eye: "#00e5ff" }, build: { len: 13, body: 6.8, leg: 4.6, legW: 2.3, tail: 9.5, tailW: 2.4, snout: 4.0, ear: "point" }, mane: true },
    void: { name: "Void Dragon", pal: { coat: "#221434", belly: "#b98cff", mane: "#ff3d7f", eye: "#00e5ff" }, build: { len: 13.5, body: 7.4, leg: 4.8, legW: 2.5, tail: 10.5, tailW: 2.6, snout: 4.5, ear: "point" }, mane: true, tusks: true },
  };
  const GOLEM_PRESETS = {
    colossus: { name: "Iron Colossus", pal: { shirt: "#6c7686", pants: "#464e5c", skin: "#9aa4b4", hair: "#00e5ff", gear: "#ff7a3c" }, head: "helmet", back: "crystal", right: "hammer", left: "tshield", pauldron: "plate", enchant: "storm" },
    crystal: { name: "Crystal Titan", pal: { shirt: "#3898c8", pants: "#245878", skin: "#8cf4ff", hair: "#ffffff", gear: "#c873ff" }, head: "crown", back: "crystal", right: "frostblade", left: "shield", pauldron: "orbs", enchant: "frost" },
    magma: { name: "Magma Golem", pal: { shirt: "#4a221e", pants: "#2a1412", skin: "#ff6a28", hair: "#ffd35c", gear: "#ff3d20" }, head: "horns", back: "pack", right: "axe", left: "torch", pauldron: "spikes", enchant: "fire" },
  };

  return {
    CHAR_CLIPS, charPose, PRESETS, STEEL, CREST, VISOR,
    BEAST_CLIPS, beastPose, BEAST_PRESETS, TREE_CLIPS, treePose, TREE_PRESETS, WIND,
    CHEST_CLIPS, chestPose, CHEST_PRESETS, BOX, DRAGON_CLIPS, dragonPose, DRAGON_PRESETS, GOLEM_PRESETS,
  };
})();
