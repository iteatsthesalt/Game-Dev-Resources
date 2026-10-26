(() => {
  // the cell the current subject bakes into: width, height, and where its feet sit
  let CW = 32, CH = 48, OX = 16, OY = 44;
  // what the bench is set to beyond the subject and clip: body morphs, the bake's shading, and the playground's extras
  const RIG = { morph: { h: 1, b: 1, hd: 1 }, shader: { bevel: 1, mode: "pbr", weather: "none", az: 310 }, metro: false, mount: false, tod: 0 };
  let ELEV = 28 * Math.PI / 180; const D2R = Math.PI / 180, TAU = Math.PI * 2;
  const wrap360 = (a) => ((a % 360) + 360) % 360;
  const wrap180 = (a) => { a = wrap360(a); return a > 180 ? a - 360 : a; };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return mul(a, 1 / l); };
  const limb = (ang, len) => [0, -len * Math.cos(ang), len * Math.sin(ang)];
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };

  // ---------- clips: symmetric ones can mirror (with a frame shift); the attack swings one arm and cannot ----------
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
  // the clips of whatever is on the bench
  let CLIPS = CHAR_CLIPS;

  // ---------- 3D skeleton: every clip is a pose as a function of clip time t (0..1) ----------
  function charPose(clip, t) {
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
    const pH = RIG.morph.h, pB = RIG.morph.b;
    if (pH !== 1 || pB !== 1) {
      for (const k in j) j[k] = [j[k][0] * pB, j[k][1] * pH, j[k][2] * pB];
    }
    return j;
  }

  // Camera looks along +z of the rotated frame, tilted down by ELEV. Screen right = +x; larger d = farther away.
  function project(p, rel) {
    const c = Math.cos(rel), s = Math.sin(rel);
    const x = p[0] * c + p[2] * s, z = -p[0] * s + p[2] * c;
    return { x, y: p[1] * Math.cos(ELEV) + z * Math.sin(ELEV), d: z * Math.cos(ELEV) - p[1] * Math.sin(ELEV) };
  }

  // ---------- characters: colours and gear are baked; hand props are attached at runtime ----------
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
  const PAL_NAMES = { shirt: "Tunic", pants: "Legs", skin: "Skin", hair: "Hair", gear: "Gear" };
  const STEEL = "#aab3c2", CREST = "#c8372d", VISOR = "#1b2232";
  const cloneLook = (l) => JSON.parse(JSON.stringify(l));
  const OPTS = {
    head: ["none", "helmet", "hood", "hat", "crown", "horns", "plague", "halo", "viking"],
    back: ["pack", "cape", "wings", "dwings", "quiver", "banner", "crystal", "none"],
    right: ["torch", "sword", "staff", "lantern", "axe", "hammer", "spear", "bow", "scythe", "frostblade", "none"],
    left: ["none", "shield", "lantern", "tshield", "tome", "dagger", "skull", "torch"],
    pauldron: ["none", "plate", "spikes", "fur", "orbs"],
    enchant: ["none", "fire", "frost", "storm", "venom", "void"]
  };
  function sanitizeLook(l) {
    const out = cloneLook(PRESETS.scout);
    for (const k in OPTS) if (OPTS[k].includes(l[k])) out[k] = l[k];
    for (const k in out.pal) if (l.pal && typeof l.pal[k] === "string" && /^#[0-9a-f]{6}$/i.test(l.pal[k])) out.pal[k] = l.pal[k];
    return out;
  }
  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
  };
  // the outline the bake draws round every silhouette
  const LINE = "#151824";

  // Draws the figure at origin (ox, oy) in screen space, scale sc. `mono` draws a flat silhouette of the true skeleton.
  function drawFigure(ctx, j, rel, ox, oy, sc, look, mono, hk = 1) {
    const P = {}; for (const k in j) P[k] = project(j[k], rel);
    const pal = look.pal, farSide = P.shL.d > P.shR.d ? "L" : "R", back = P.visor.d > P.head.d;
    const X = (q) => ox + q.x * sc, Y = (q) => oy - q.y * sc;
    const items = [];
    const disc = (x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
    const bone = (a, b, w, col, side) => items.push({ d: (P[a].d + P[b].d) / 2, draw: () => {
      ctx.strokeStyle = mono || (side && side === farSide ? shade(col, 0.72) : col);
      ctx.lineWidth = w * sc; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(X(P[a]), Y(P[a])); ctx.lineTo(X(P[b]), Y(P[b])); ctx.stroke();
    } });
    for (const s of ["L", "R"]) {
      bone("hp" + s, "kn" + s, 3.4, pal.pants, s); bone("kn" + s, "ft" + s, 3, pal.pants, s);
      bone("sh" + s, "el" + s, 2.8, pal.shirt, s); bone("el" + s, "ha" + s, 2.4, pal.skin, s);
    }
    bone("hip", "chest", 6, pal.shirt); bone("chest", "neck", 3, pal.skin);
    if (!mono && look.back === "pack") bone("pack0", "pack1", 4.4, pal.gear);
    if (!mono && look.back === "cape") items.push({ d: (P.capeTL.d + P.capeTR.d + P.capeBL.d + P.capeBR.d) / 4, draw: () => {
      ctx.fillStyle = back ? pal.gear : shade(pal.gear, 0.62);
      ctx.beginPath(); for (const k of ["capeTL", "capeTR", "capeBR", "capeBL"]) ctx.lineTo(X(P[k]), Y(P[k])); ctx.closePath(); ctx.fill();
    } });
    items.push({ d: P.head.d, draw: () => {
      const hx = X(P.head), hy = Y(P.head), r = 3.7 * sc * hk, dx = (X(P.visor) - hx) * hk, front = Math.max(0, 1 - Math.abs(dx) / (r * 0.95));
      if (mono) return disc(hx, hy, r, mono);
      if (look.head === "helmet") {
        disc(hx, hy, r * 1.06, STEEL);
        if (!back) { const w = Math.max(1.1 * sc, 4.8 * sc * front), x0 = clamp(hx + dx * 0.62, hx - r, hx + r); ctx.fillStyle = VISOR; ctx.fillRect(x0 - w / 2, hy - 0.6 * sc, w, 1.2 * sc); }
      } else if (look.head === "hood") {
        disc(hx, hy, r * 1.1, pal.gear);
        if (!back) { disc(hx + dx * 0.45, hy + 0.5 * sc, r * 0.62, pal.skin); disc(hx + dx * 0.72, hy, 0.65 * sc * hk, VISOR); }
      } else {
        disc(hx, hy, r, pal.skin);
        ctx.fillStyle = pal.hair; ctx.beginPath();
        ctx.arc(hx, hy - 0.6 * sc, r, Math.PI * (back ? 0 : 1.05), Math.PI * (back ? 2 : 1.95)); ctx.fill();
        if (look.head === "none" && !back) disc(hx + dx, Y(P.visor), 1.3 * sc * hk, VISOR);
      }
    } });
    if (!mono && (look.back === "wings" || look.back === "dwings")) {
      const wc = look.back === "wings" ? "#eef6ff" : "#8a1e38";
      for (const [s, sx] of [["L", -1], ["R", 1]]) {
        const sh = P["sh" + s];
        items.push({ d: sh.d + (back ? -1.5 : 1.5), draw: () => {
          ctx.fillStyle = back ? wc : shade(wc, 0.72);
          ctx.beginPath();
          ctx.moveTo(X(sh), Y(sh));
          ctx.lineTo(X(sh) + sx * 11 * sc, Y(sh) - 8 * sc);
          ctx.lineTo(X(sh) + sx * 13 * sc, Y(sh) + 2 * sc);
          ctx.lineTo(X(sh) + sx * 6 * sc, Y(sh) + 8 * sc);
          ctx.closePath(); ctx.fill();
        } });
      }
    }
    if (!mono && look.back === "quiver") { bone("pack0", "pack1", 3.2, "#6b4426"); bone("pack1", "crest1", 1.4, "#d9dde3"); }
    if (!mono && look.back === "banner") { bone("pack0", "hat2", 1.2, "#8a6236"); items.push({ d: P.pack1.d + 1, draw: () => { ctx.fillStyle = pal.gear; ctx.fillRect(X(P.hat1) - 4 * sc, Y(P.hat2), 8 * sc, 9 * sc); } }); }
    if (!mono && look.back === "crystal") { items.push({ d: P.pack1.d + (back ? -1.5 : 1.5), draw: () => { ctx.fillStyle = "#00e5ff"; ctx.beginPath(); ctx.arc(X(P.pack1), Y(P.pack1) - 3 * sc, 3.6 * sc, 0, TAU); ctx.fill(); } }); }
    if (!mono && look.pauldron && look.pauldron !== "none") {
      for (const s of ["L", "R"]) {
        const sh = P["sh" + s];
        const pc = look.pauldron === "plate" ? STEEL : look.pauldron === "spikes" ? "#454b59" : look.pauldron === "orbs" ? "#00e5ff" : pal.gear;
        items.push({ d: sh.d - 0.3, draw: () => {
          disc(X(sh), Y(sh) - 0.8 * sc, 2.6 * sc, s === farSide ? shade(pc, 0.75) : pc);
          if (look.pauldron === "spikes") { ctx.fillStyle = "#e5e8ef"; ctx.beginPath(); ctx.moveTo(X(sh) - 1.5 * sc, Y(sh) - 2 * sc); ctx.lineTo(X(sh), Y(sh) - 5.5 * sc); ctx.lineTo(X(sh) + 1.5 * sc, Y(sh) - 2 * sc); ctx.fill(); }
        } });
      }
    }
    if (!mono && look.head === "helmet") bone("crest0", "crest1", 1.8, CREST);
    if (!mono && look.head === "hood") bone("hood0", "hood1", 2.6, pal.gear);
    if (!mono && look.head === "hat") {
      items.push({ d: P.hat0.d, draw: () => {
        ctx.fillStyle = shade(pal.gear, 0.8); ctx.beginPath(); ctx.ellipse(X(P.hat0), Y(P.hat0), 6.4 * sc * hk, 6.4 * Math.sin(ELEV) * sc * hk, 0, 0, TAU); ctx.fill();
      } });
      bone("hat0", "hat1", 5.2, pal.gear); bone("hat1", "hat2", 2.4, pal.gear);
    }
    if (!mono && look.head === "crown") {
      items.push({ d: P.head.d - 0.4, draw: () => {
        ctx.fillStyle = "#ffd35c"; ctx.fillRect(X(P.head) - 3.4 * sc * hk, Y(P.head) - 4.8 * sc * hk, 6.8 * sc * hk, 2.4 * sc * hk);
        for (const ox of [-2.6, 0, 2.6]) { ctx.beginPath(); ctx.moveTo(X(P.head) + (ox - 1) * sc * hk, Y(P.head) - 4.8 * sc * hk); ctx.lineTo(X(P.head) + ox * sc * hk, Y(P.head) - 7.2 * sc * hk); ctx.lineTo(X(P.head) + (ox + 1) * sc * hk, Y(P.head) - 4.8 * sc * hk); ctx.fill(); }
      } });
    }
    if (!mono && (look.head === "horns" || look.head === "viking")) {
      if (look.head === "viking") items.push({ d: P.head.d - 0.1, draw: () => disc(X(P.head), Y(P.head) - 0.8 * sc, 3.8 * sc * hk, STEEL) });
      for (const sx of [-1, 1]) items.push({ d: P.head.d - 0.3, draw: () => {
        ctx.strokeStyle = look.head === "horns" ? "#3a1a20" : "#efe6d0"; ctx.lineWidth = 1.6 * sc * hk; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(X(P.head) + sx * 2.5 * sc * hk, Y(P.head) - 2 * sc * hk); ctx.lineTo(X(P.head) + sx * 5.6 * sc * hk, Y(P.head) - 6.2 * sc * hk); ctx.stroke();
      } });
    }
    if (!mono && look.head === "plague") {
      items.push({ d: P.visor.d - 0.3, draw: () => {
        ctx.fillStyle = "#2b2d38"; ctx.beginPath(); ctx.arc(X(P.head), Y(P.head), 3.8 * sc * hk, 0, TAU); ctx.fill();
        if (!back) { ctx.strokeStyle = "#d8d0c0"; ctx.lineWidth = 2.2 * sc * hk; ctx.beginPath(); ctx.moveTo(X(P.head), Y(P.head)); ctx.lineTo(X(P.visor) * 1.05, Y(P.visor) + 1.2 * sc); ctx.stroke(); }
      } });
    }
    if (!mono && look.head === "halo") {
      items.push({ d: P.hat1.d - 0.4, draw: () => {
        ctx.strokeStyle = "#fff27a"; ctx.lineWidth = 1.5 * sc * hk; ctx.beginPath(); ctx.ellipse(X(P.hat1), Y(P.hat1), 4.8 * sc * hk, 2.2 * sc * hk, 0, 0, TAU); ctx.stroke();
      } });
    }
    items.sort((a, b) => b.d - a.d).forEach((i) => i.draw());
    return P;
  }

  // ---------- bake: every direction × frame of one clip, then pixel-threshold and outline ----------
  // o overrides the cell, scale, head size and row angles, for sheets other than the atlas (the Cinderdeep hero)
  // ---------- material pass: gives baked pixels volume (bevel normals), per-material surface
  // response (metal specular, wood grain, cloth weave, skin sheen) and a rim light ----------
  function bakeClip(look, clip, N, FR, sub = SUBJ, o = {}) {
    const cell = o.cell || sub.cell, { w: CW, h: CH, ox: OX, oy: OY } = cell, cv = document.createElement("canvas");
    const angles = o.angles || Array.from({ length: N }, (_, d) => (d * 360) / N);
    cv.width = CW * FR; cv.height = CH * angles.length; cv.cell = cell;
    const c = cv.getContext("2d");
    const headScale = o.head || RIG.morph.hd;
    for (let d = 0; d < angles.length; d++) for (let f = 0; f < FR; f++) sub.draw(c, sub.pose(clip, f / FR, look), angles[d] * D2R, f * CW + OX, d * CH + OY, o.sc || 1, look, undefined, headScale);
    const img = c.getImageData(0, 0, cv.width, cv.height), px = img.data, W = cv.width, H = cv.height;
    const solid = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { solid[i] = px[i * 4 + 3] > 100 ? 1 : 0; px[i * 4 + 3] = solid[i] ? 255 : 0; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (solid[i]) continue;
      const n = (x > 0 && solid[i - 1]) || (x < W - 1 && solid[i + 1]) || (y > 0 && solid[i - W]) || (y < H - 1 && solid[i + W]);
      if (n && (x % CW) !== 0 && (x % CW) !== CW - 1) { px[i * 4] = 21; px[i * 4 + 1] = 24; px[i * 4 + 2] = 36; px[i * 4 + 3] = 255; }
    }
    const maps = applyMaterials3D(px, solid, W, H);
    c.putImageData(img, 0, 0);
    cv.maps = maps;
    return cv;
  }

  function applyMaterials3D(px, solid, W, H) {
    const D = new Float32Array(W * H), INF = 14;
    for (let i = 0; i < W * H; i++) D[i] = solid[i] ? INF : 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!D[i]) continue;
      let v = D[i]; if (x > 0) v = Math.min(v, D[i - 1] + 1); if (y > 0) v = Math.min(v, D[i - W] + 1);
      if (x > 0 && y > 0) v = Math.min(v, D[i - W - 1] + 1.41); if (x < W - 1 && y > 0) v = Math.min(v, D[i - W + 1] + 1.41); D[i] = v; }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!D[i]) continue;
      let v = D[i]; if (x < W - 1) v = Math.min(v, D[i + 1] + 1); if (y < H - 1) v = Math.min(v, D[i + W] + 1);
      if (x < W - 1 && y < H - 1) v = Math.min(v, D[i + W + 1] + 1.41); if (x > 0 && y < H - 1) v = Math.min(v, D[i + W - 1] + 1.41); D[i] = v; }
    const src = new Uint8ClampedArray(px), cd = (i, j) => Math.abs(src[i*4]-src[j*4]) + Math.abs(src[i*4+1]-src[j*4+1]) + Math.abs(src[i*4+2]-src[j*4+2]);
    const bevelMul = RIG.shader.bevel;
    const shaderStyle = RIG.shader.mode;
    const weatherMode = RIG.shader.weather;
    const az = (RIG.shader.az * Math.PI) / 180;
    const Hf = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!solid[i]) continue;
      let e = 0; if (x > 0 && solid[i-1] && cd(i, i-1) > 55) e++; if (x < W-1 && solid[i+1] && cd(i, i+1) > 55) e++;
      if (y > 0 && solid[i-W] && cd(i, i-W) > 55) e++; if (y < H-1 && solid[i+W] && cd(i, i+W) > 55) e++;
      Hf[i] = (Math.sqrt(Math.min(D[i], 6) / 6) - e * 0.13) * bevelMul; }
    const h = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : Hf[y * W + x];
    const ao = (x, y) => { let s = 0, c = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { s += h(x + dx, y + dy); c++; } return s / c; };
    const L = [Math.cos(az) * 0.75, Math.sin(az) * 0.75, 0.52]; const ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
    const Hv = [L[0], L[1], L[2] + 1]; const hl = Math.hypot(...Hv); Hv[0] /= hl; Hv[1] /= hl; Hv[2] /= hl;
    const hash = (x, y) => { let n = (x * 374761393 + y * 668265263) | 0; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) & 255) / 255; };
    const cl = (v) => v < 0 ? 0 : v > 255 ? 255 : v;
    const normData = new Uint8ClampedArray(W * H * 4);
    const depthData = new Uint8ClampedArray(W * H * 4);
    const specData = new Uint8ClampedArray(W * H * 4);
    const emisData = new Uint8ClampedArray(W * H * 4);

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!solid[i]) continue; const k = i * 4;
      let r = src[k], g = src[k + 1], b = src[k + 2];
      let nx = (h(x - 1, y) - h(x + 1, y)) * 2.2, ny = (h(x, y - 1) - h(x, y + 1)) * 2.2;
      const nl = Math.hypot(nx, ny, 1); nx /= nl; ny /= nl; const nz = 1 / nl;
      normData[k] = cl((nx * 0.5 + 0.5) * 255);
      normData[k + 1] = cl((-ny * 0.5 + 0.5) * 255);
      normData[k + 2] = cl((nz * 0.5 + 0.5) * 255);
      normData[k + 3] = 255;

      const zv = clamp(Hf[i] / (1.4 * bevelMul), 0, 1);
      depthData[k] = cl(zv * 180 + 40);
      depthData[k + 1] = cl(zv * 230 + 20);
      depthData[k + 2] = cl(zv * 255);
      depthData[k + 3] = 255;

      if (r === 21 && g === 24 && b === 36) continue;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0, lum = (r + g + b) / 765;
      if (lum > 0.85 && sat > 0.18) {
        emisData[k] = r; emisData[k + 1] = g; emisData[k + 2] = b; emisData[k + 3] = 255;
        continue;
      }
      const warm = r >= g && g >= b;
      const metal = shaderStyle === "metallic" || (sat < 0.14 && lum > 0.48), gold = warm && sat > 0.45 && lum > 0.45 && g > 120 && !(r > 220 && g > 190);
      const skin = warm && sat > 0.15 && sat < 0.5 && lum > 0.55, wood = warm && sat > 0.25 && lum < 0.42;
      const leaf = g > r && g > b && sat > 0.25;
      let ndl = nx * L[0] + ny * L[1] + nz * L[2], diff = Math.max(0, ndl), ndh = Math.max(0, nx * Hv[0] + ny * Hv[1] + nz * Hv[2]);
      if (shaderStyle === "cel") diff = diff > 0.65 ? 1 : diff > 0.25 ? 0.55 : 0.18;
      const occ = 0.55 + 0.45 * Math.min(1, ao(x, y) * 1.4);
      let sh = (0.32 + 0.9 * diff) * occ, ar = 0, ag = 0, ab = 0;
      if (metal || gold) {
        const env = ny < -0.15 ? 1.25 : ny > 0.25 ? 0.45 : 0.85;
        sh = (0.25 + 0.55 * diff) * env * occ;
        const sp = Math.pow(ndh, 24) * 235 + Math.pow(ndh, 6) * 44;
        ar = sp; ag = sp; ab = sp * (gold ? 0.7 : 1.08);
        const br = (hash(x >> 3, y) - 0.5) * 26; ar += br; ag += br; ab += br;
        if (ny > 0.3) { ar += 6; ag += 14; ab += 20; }
      } else if (skin) {
        const sp = Math.pow(ndh, 10) * 45; ar = sp + 18 * (1 - diff) * occ; ag = sp + 4; ab = sp;
      } else if (wood) {
        sh *= 0.75 + 0.4 * Math.abs(Math.sin(y * 1.3 + Math.sin(x * 0.4) * 2 + hash(x >> 2, 0) * 4));
        const sp = Math.pow(ndh, 12) * 22; ar = ag = ab = sp;
      } else if (leaf) {
        sh *= 0.75 + 0.5 * hash(x >> 1, y >> 1); ar = 0; ag = 10 * diff; ab = 0;
      } else {
        sh *= ((x + y) & 1) ? 0.9 : 1.06; sh *= 0.92 + 0.16 * hash(x, y);
        const sheen = Math.pow(1 - nz, 2) * 40; ar = ag = ab = sheen * 0.5;
      }
      if (D[i] <= 1.5) { if (ndl < 0.2) { ar += 12; ag += 44; ab += 60; } else { ar += 32; ag += 24; ab += 12; } }
      if (weatherMode === "frost" && ny < -0.1) { ar += 45; ag += 75; ab += 110; }
      else if (weatherMode === "moss" && ny < 0 && hash(x, y) > 0.45) { r = r * 0.5 + 30; g = g * 0.5 + 95; b = b * 0.5 + 25; }
      else if (weatherMode === "ember" && D[i] <= 2.2) { ar += 85 * hash(x, y); ag += 28; emisData[k] = 255; emisData[k+1] = 110; emisData[k+2] = 30; emisData[k+3] = 255; }
      else if (weatherMode === "battle" && hash(x, y) > 0.84) { sh *= 0.55; ar += 25; }
      else if (weatherMode === "gilded" && D[i] <= 1.8) { ar += 75; ag += 58; ab += 10; }
      if (shaderStyle === "dither") {
        const bayer = (((x & 1) << 1) | (y & 1)) * 10 - 15;
        ar += bayer; ag += bayer; ab += bayer;
      } else if (shaderStyle === "grimdark") {
        sh *= 0.86; ar += 12 * diff;
      }
      specData[k] = cl((metal || gold ? 220 : 70) * occ);
      specData[k + 1] = cl(occ * 255);
      specData[k + 2] = cl(Math.pow(ndh, 8) * 255);
      specData[k + 3] = 255;
      px[k] = cl(r * sh + ar); px[k + 1] = cl(g * sh + ag); px[k + 2] = cl(b * sh + ab);
    }
    return { normData, depthData, specData, emisData, W, H, Hf, solid, rawPx: src };
  }

  // ---------- hand props, drawn from the projected bones ----------
  // returns [{ d, draw }] for one hand; the caller sorts each against the chest
  function propsFor(look, j, rq, ox, oy, S, ctx) {
    const scr = (p) => { const q = project(p, rq); return [ox + q.x * S, oy - q.y * S, q.d]; };
    const out = [];
    const glow = (x, y, r, rgb, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
    const line = (a, b, w, col, cap = "butt") => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = cap; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
    for (const [side, kind] of [["R", look.right], ["L", look.left]]) {
      if (!kind || kind === "none") continue;
      const ha = j["ha" + side], el = j["el" + side], H = scr(ha);
      if (kind === "torch") {
        const T = scr(add(ha, [0, 7, 1.6]));
        out.push({ d: H[2], hand: H, draw: () => {
          line(H, T, 1.6 * S, "#5a3d24");
          glow(T[0], T[1], 9 * S, "255,160,60", 0.55);
          FX.prop(ctx, "torch", T[0], T[1] - 2.5 * S, S);
          ctx.fillStyle = "#ffcf6b"; ctx.fillRect(Math.round(T[0] - S), Math.round(T[1] - 2.5 * S), 2 * S, 3 * S);
          ctx.fillStyle = "#ff7a2e"; ctx.fillRect(Math.round(T[0] - S), Math.round(T[1] - 0.5 * S), 2 * S, S);
        } });
      } else if (kind === "sword") {
        const dir = norm(sub(ha, el)), tip = scr(add(ha, mul(dir, 14))), grip = scr(add(ha, mul(dir, -2.2)));
        const g0 = scr(add(add(ha, mul(dir, 1.4)), [-2.4, 0, 0])), g1 = scr(add(add(ha, mul(dir, 1.4)), [2.4, 0, 0]));
        out.push({ d: H[2], hand: H, draw: () => {
          line(grip, H, 1.6 * S, "#5a3d24");
          line(H, tip, 1.5 * S, "#c9d1dc", "round"); line(H, tip, 0.5 * S, "#ffffff", "round");
          line(g0, g1, 1.3 * S, "#d4a63a", "round");
        } });
      } else if (kind === "staff") {
        const lo = scr(add(ha, [0, -9, -0.2])), hi = scr(add(ha, [0, 15, 0.8]));
        out.push({ d: H[2], hand: H, draw: () => {
          line(lo, hi, 1.5 * S, "#6b4a2a", "round");
          glow(hi[0], hi[1], 8 * S, "170,140,255", 0.5); FX.prop(ctx, "staff", hi[0], hi[1], S);
          ctx.fillStyle = "#b9a6ff"; ctx.beginPath(); ctx.arc(hi[0], hi[1], 2.1 * S, 0, TAU); ctx.fill();
          ctx.fillStyle = "#ffffff"; ctx.fillRect(Math.round(hi[0] - 0.8 * S), Math.round(hi[1] - 0.9 * S), Math.max(1, S * 0.7), Math.max(1, S * 0.7));
        } });
      } else if (kind === "lantern") {
        const B = scr(add(ha, [0, -5, 0.4])), K = scr(add(ha, [0, -2.6, 0.4]));
        out.push({ d: H[2], hand: H, draw: () => {
          line(H, K, 0.8 * S, "#3a3a42");
          glow(B[0], B[1], 10 * S, "255,190,90", 0.45); FX.prop(ctx, "lantern", B[0], B[1] - 2 * S, S);
          ctx.fillStyle = "#3a3a42"; ctx.fillRect(Math.round(B[0] - 1.8 * S), Math.round(B[1] - 2.3 * S), 3.6 * S, 4.6 * S);
          ctx.fillStyle = "#ffd890"; ctx.fillRect(Math.round(B[0] - 1.1 * S), Math.round(B[1] - 1.5 * S), 2.2 * S, 3 * S);
        } });
      } else if (kind === "shield") {
        const C = scr(add(ha, [-1.4, 1.2, 1.6])), n = norm([-0.45, 0, 0.89]);
        const nz = -n[0] * Math.sin(rq) + n[2] * Math.cos(rq), facing = nz < 0, r = 5.4 * S, rx = r * Math.max(0.22, Math.abs(nz));
        out.push({ d: C[2], hand: H, draw: () => {
          ctx.fillStyle = "#5c6573"; ctx.beginPath(); ctx.ellipse(C[0], C[1], rx + 0.8 * S, r + 0.8 * S, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = facing ? look.pal.gear : "#7a5634"; ctx.beginPath(); ctx.ellipse(C[0], C[1], rx, r, 0, 0, TAU); ctx.fill();
          if (facing && rx > 2 * S) { ctx.fillStyle = "#d4a63a"; ctx.beginPath(); ctx.ellipse(C[0], C[1], Math.max(S * 0.6, rx * 0.3), r * 0.3, 0, 0, TAU); ctx.fill(); }
        } });
      } else if (kind === "tshield") {
        const C = scr(add(ha, [-1.6, 0.5, 2.0])), n = norm([-0.4, 0, 0.91]);
        const nz = -n[0] * Math.sin(rq) + n[2] * Math.cos(rq), rx = Math.max(1.8 * S, 5.2 * S * Math.abs(nz)), ry = 8.2 * S;
        out.push({ d: C[2], hand: H, draw: () => {
          ctx.fillStyle = "#aab3c2"; ctx.fillRect(C[0] - rx - S * 0.6, C[1] - ry, (rx + S * 0.6) * 2, ry * 2);
          ctx.fillStyle = look.pal.gear; ctx.fillRect(C[0] - rx, C[1] - ry + S, rx * 2, (ry - S) * 2);
          ctx.fillStyle = "#ffd35c"; ctx.fillRect(C[0] - rx * 0.3, C[1] - ry * 0.6, rx * 0.6, ry * 1.2);
        } });
      } else if (kind === "axe" || kind === "hammer" || kind === "spear" || kind === "scythe" || kind === "frostblade" || kind === "dagger") {
        const dir = norm(sub(ha, el)), len = kind === "spear" ? 19 : kind === "dagger" ? 8.5 : 15;
        const tip = scr(add(ha, mul(dir, len))), grip = scr(add(ha, mul(dir, -3.2))), headP = scr(add(ha, mul(dir, len * 0.78)));
        out.push({ d: H[2], hand: H, draw: () => {
          if (look.enchant && look.enchant !== "none") {
            const ec = { fire: "255,120,40", frost: "120,220,255", storm: "255,240,100", venom: "130,235,80", void: "190,100,255" }[look.enchant] || "0,229,255";
            glow(tip[0], tip[1], 7 * S, ec, 0.45);
          }
          if (kind === "frostblade" || kind === "dagger") {
            line(grip, H, 1.5 * S, "#4a3628");
            line(H, tip, (kind === "dagger" ? 1.2 : 1.7) * S, kind === "frostblade" ? "#8cf4ff" : "#d8e0ec", "round");
            line(H, tip, 0.5 * S, "#ffffff", "round");
          } else {
            line(grip, tip, 1.4 * S, "#6b482a", "round");
            if (kind === "axe") { ctx.fillStyle = "#c9d1dc"; ctx.beginPath(); ctx.arc(headP[0], headP[1], 4.2 * S, 0, Math.PI * 1.3); ctx.fill(); }
            else if (kind === "hammer") { ctx.fillStyle = "#9aa3b2"; ctx.fillRect(headP[0] - 3.5 * S, headP[1] - 2.5 * S, 7 * S, 5 * S); }
            else if (kind === "spear") { line(headP, tip, 2.2 * S, "#e5e8ef", "round"); }
            else if (kind === "scythe") { const blade = scr(add( add(ha, mul(dir, len)), [-6, -2, 2] )); line(tip, blade, 1.8 * S, "#c873ff", "round"); }
          }
        } });
      } else if (kind === "bow") {
        const topB = scr(add(ha, [0, 9, 2])), botB = scr(add(ha, [0, -9, 2])), midB = scr(add(ha, [0, 0, 5.2]));
        out.push({ d: H[2], hand: H, draw: () => {
          ctx.strokeStyle = "#8a5a32"; ctx.lineWidth = 1.5 * S; ctx.beginPath(); ctx.moveTo(topB[0], topB[1]); ctx.quadraticCurveTo(midB[0], midB[1], botB[0], botB[1]); ctx.stroke();
          line(topB, botB, 0.5 * S, "#d6dae3");
        } });
      } else if (kind === "tome" || kind === "skull") {
        const P0 = scr(add(ha, [0, 2.5, 2.2]));
        out.push({ d: P0[2], hand: H, draw: () => {
          glow(P0[0], P0[1], 7 * S, kind === "skull" ? "190,110,255" : "0,229,255", 0.45);
          ctx.fillStyle = kind === "skull" ? "#e8e0d0" : "#6a2448";
          ctx.beginPath(); ctx.arc(P0[0], P0[1], 2.8 * S, 0, TAU); ctx.fill();
          ctx.fillStyle = "#00e5ff"; ctx.fillRect(P0[0] - S, P0[1] - 0.5 * S, 0.8 * S, 0.8 * S); ctx.fillRect(P0[0] + 0.3 * S, P0[1] - 0.5 * S, 0.8 * S, 0.8 * S);
        } });
      }
    }
    return out;
  }

  // ---------- other subjects: a beast on four legs, a tree, a chest. Each has its own skeleton, clips and painter;
  // rows from angle, columns from clip time, baking and export are shared ----------
  const seg = (t, a, b) => ease((t - a) / (b - a));
  // draw helpers shared by the painters below: items carry a depth and are drawn far to near
  function painterFor(ctx, j, rel, ox, oy, sc, mono) {
    const P = {}; for (const k in j) P[k] = project(j[k], rel);
    const X = (q) => ox + q.x * sc, Y = (q) => oy - q.y * sc, items = [];
    const col = (c, dark) => mono || (dark ? shade(c, dark) : c);
    return {
      P, X, Y, items,
      bone: (a, b, w, c, dark, bias = 0) => items.push({ d: (P[a].d + P[b].d) / 2 + bias, draw: () => { ctx.strokeStyle = col(c, dark); ctx.lineWidth = w * sc; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(X(P[a]), Y(P[a])); ctx.lineTo(X(P[b]), Y(P[b])); ctx.stroke(); } }),
      disc: (a, r, c, dark, bias = 0) => items.push({ d: P[a].d + bias, draw: () => { ctx.fillStyle = col(c, dark); ctx.beginPath(); ctx.arc(X(P[a]), Y(P[a]), r * sc, 0, TAU); ctx.fill(); } }),
      run: () => items.sort((a, b) => b.d - a.d).forEach((i) => i.draw()),
    };
  }

  /* -- the beast: a spine from hips to shoulders, a neck and head, a tail, four legs -- */
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
  function drawBeast(ctx, j, rel, ox, oy, sc, look, mono) {
    const D = painterFor(ctx, j, rel, ox, oy, sc, mono), { P } = D, pal = look.pal, b = look.build;
    const far = P.topFL.d > P.topFR.d ? "L" : "R";
    for (const k of ["FL", "FR", "HL", "HR"]) {
      const dark = k[1] === far ? 0.72 : 0;
      D.bone("top" + k, "kn" + k, b.legW, pal.coat, dark); D.bone("kn" + k, "ft" + k, b.legW * 0.82, pal.coat, dark); D.disc("ft" + k, b.legW * 0.55, pal.coat, 0.6);
    }
    D.bone("hips", "shoulders", b.body, pal.coat); D.bone("belly0", "belly1", b.body * 0.55, pal.belly, 0, 0.6);
    // a deep chest and a rounded haunch: the spine alone is only as wide as one bone end-on
    D.disc("shoulders", b.body * 0.6, pal.coat, 0, 0.1); D.disc("hips", b.body * 0.54, pal.coat, 0.9, 0.1);
    if (look.mane) D.bone("shoulders", "neck", b.body * 1.05, pal.mane, 0, -0.4);
    D.bone("shoulders", "neck", b.body * 0.62, pal.coat); D.bone("tail0", "tail1", b.tailW, pal.coat); D.bone("tail1", "tail2", b.tailW * 0.8, look.tip ? pal.belly : pal.coat);
    D.bone("head", "snout", 2.6, pal.coat, 0, -0.2); D.bone("head", "jaw", 1.5, pal.coat, 0.78, 0.1); D.disc("mouth", 1, "#5a1a1e", 0, 0.3);
    D.disc("head", 3.1, pal.coat); D.disc("nose", 0.75, "#1b1416", 0, -0.4);
    // facing us, the long body rises behind the head and swallows it: rim the head so it stands off the back,
    // and give the ears the darker mane colour so they read against it
    if (P.hips.d - P.head.d > b.len * 0.45) D.disc("head", 3.5, LINE, 0, 0.05);
    for (const s of ["L", "R"]) {
      D.bone("ear" + s, "earT" + s, b.ear === "round" ? 2 : 1.8, pal.mane, s === far ? 0.8 : 0, 0.2);
      if (look.tusks) D.bone("tusk" + s, "tuskT" + s, 0.8, "#efe6d0", 0, -0.5);
      // an eye shows only on the side of the head turned toward us
      if (!mono && P["eye" + s].d < P.head.d + 0.4) D.disc("eye" + s, 0.62, pal.eye, 0, -0.6);
    }
    D.run();
    return P;
  }
  const BEAST_PRESETS = {
    wolf: { name: "Wolf", metres: 0.9, pal: { coat: "#8d96a3", belly: "#d9dde3", mane: "#6d7480", eye: "#e8c04a" }, build: { len: 11, body: 6.2, leg: 4.6, legW: 2, tail: 7, tailW: 2.2, snout: 3.6, ear: "point" }, mane: true },
    fox: { name: "Fox", metres: 0.5, pal: { coat: "#d8752e", belly: "#f4ead8", mane: "#c4602a", eye: "#2a1f1a" }, build: { len: 9.5, body: 5.2, leg: 4, legW: 1.6, tail: 8.5, tailW: 3.2, snout: 3.4, ear: "point" }, tip: true },
    bear: { name: "Bear", metres: 1.6, pal: { coat: "#6b4a30", belly: "#8a6a48", mane: "#5a3e28", eye: "#1b1416" }, build: { len: 12, body: 9, leg: 4.2, legW: 3, tail: 2, tailW: 2, snout: 2.6, ear: "round" } },
    boar: { name: "Boar", metres: 0.95, pal: { coat: "#5a4238", belly: "#7a6052", mane: "#3a2a24", eye: "#1b1416" }, build: { len: 10.5, body: 7.6, leg: 3.4, legW: 2.2, tail: 2.6, tailW: 1, snout: 3, ear: "point" }, mane: true, tusks: true },
    tiger: { name: "Dire Tiger", metres: 1.25, pal: { coat: "#e07a28", belly: "#f8ecd8", mane: "#2a1810", eye: "#7cf9ff" }, build: { len: 12.5, body: 6.8, leg: 4.8, legW: 2.3, tail: 8.5, tailW: 1.8, snout: 3.2, ear: "round" }, mane: true, tusks: true },
    stag: { name: "Runic Stag", metres: 1.9, pal: { coat: "#8a6240", belly: "#decbb4", mane: "#ffd35c", eye: "#00e5ff" }, build: { len: 11.5, body: 5.8, leg: 6.0, legW: 1.6, tail: 3.0, tailW: 1.5, snout: 3.8, ear: "point" }, mane: true },
    drake: { name: "Cinder Drake", metres: 1.5, pal: { coat: "#a82820", belly: "#ffb35e", mane: "#ff5a20", eye: "#fff27a" }, build: { len: 13.0, body: 7.2, leg: 4.4, legW: 2.5, tail: 10.0, tailW: 2.6, snout: 4.2, ear: "point" }, mane: true, tusks: true },
    hound: { name: "Hellhound", metres: 1.1, pal: { coat: "#281c24", belly: "#ff6a28", mane: "#ff2a4a", eye: "#fff27a" }, build: { len: 11.2, body: 6.5, leg: 4.7, legW: 2.1, tail: 6.5, tailW: 2.0, snout: 3.8, ear: "point" }, mane: true, tusks: true },
  };

  /* -- the tree: a trunk that bends from its foot, a canopy that rides its top, fronds and strands that swing further -- */
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
  function drawTree(ctx, j, rel, ox, oy, sc, look, mono) {
    const D = painterFor(ctx, j, rel, ox, oy, sc, mono), { P, X, Y } = D, pal = look.pal, tw = look.build.trunk;
    for (let i = 0; i < 4; i++) D.bone("t" + i, "t" + (i + 1), tw * (1 - i * 0.18), pal.trunk, i % 2 ? 0 : 0.88, 3);
    if (look.kind === "pine") for (let i = 0; i < 4; i++) {
      const T = P["pT" + i], C = P["pC" + i], r = j["pR" + i][0];
      D.items.push({ d: C.d - 0.5 - i * 0.01, draw: () => {
        const cx = X(C), cy = Y(C), tx = X(T), ty = Y(T), rw = r * sc, rh = r * Math.sin(ELEV) * sc;
        ctx.fillStyle = mono || shade(pal.leaf, 0.82); ctx.beginPath(); ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI); ctx.lineTo(tx, ty); ctx.closePath(); ctx.fill();
        ctx.fillStyle = mono || pal.leaf; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(cx - rw, cy); ctx.ellipse(cx, cy, rw, rh, 0, Math.PI, Math.PI * 0.5, true); ctx.closePath(); ctx.fill();
      } });
    }
    (look.blobs || []).forEach(([, , , r], i) => {
      const k = "c" + i, R = look.build.r * r;
      D.items.push({ d: P[k].d, draw: () => {
        const x = X(P[k]), y = Y(P[k]), rr = R * sc;
        ctx.fillStyle = mono || shade(pal.leaf, 0.78); ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
        if (mono) return;
        ctx.fillStyle = pal.leaf; ctx.beginPath(); ctx.arc(x - rr * 0.12, y - rr * 0.12, rr * 0.86, 0, TAU); ctx.fill();
        ctx.fillStyle = pal.light; ctx.beginPath(); ctx.arc(x - rr * 0.32, y - rr * 0.36, rr * 0.42, 0, TAU); ctx.fill();
        if (pal.accent && i % 2 === 0) { ctx.fillStyle = pal.accent; ctx.fillRect(Math.round(x + rr * 0.3), Math.round(y + rr * 0.1), Math.max(1, sc), Math.max(1, sc)); }
      } });
    });
    if (look.kind === "willow") for (let i = 0; i < 10; i++) D.bone("s" + i, "sT" + i, 0.9, pal.light, i % 2 ? 0.8 : 0, -0.2);
    if (look.kind === "palm") for (let i = 0; i < 7; i++) { D.bone("f0" + i, "f1" + i, 1.8, pal.leaf, i % 2 ? 0.82 : 0); D.bone("f1" + i, "f2" + i, 1.4, pal.light, i % 2 ? 0.82 : 0); }
    D.run();
    return P;
  }
  const TREE_PRESETS = {
    oak: { name: "Oak", metres: 10, kind: "oak", pal: { trunk: "#6a4a2a", leaf: "#3e8a3a", light: "#6cb85a", accent: null }, build: { h: 18, r: 9, trunk: 3.6 }, blobs: [[0, 0.9, 0, 0.75], [-0.6, 0.4, 0.3, 0.55], [0.6, 0.45, -0.2, 0.55], [0.1, 0.35, 0.65, 0.5], [-0.2, 0.5, -0.65, 0.5], [0.35, 1.3, 0.2, 0.45]] },
    pine: { name: "Pine", metres: 16, kind: "pine", pal: { trunk: "#5a3e24", leaf: "#2e6a3e", light: "#3e8a4e", accent: null }, build: { h: 30, r: 9, trunk: 2.6 } },
    willow: { name: "Willow", metres: 9, kind: "willow", pal: { trunk: "#4a3a2a", leaf: "#5a7a3a", light: "#8aac5a", accent: null }, build: { h: 16, r: 10, trunk: 4 }, blobs: [[0, 0.7, 0, 0.8], [-0.55, 0.35, 0.2, 0.55], [0.55, 0.35, -0.2, 0.55], [0, 0.3, 0.6, 0.5], [0, 0.4, -0.6, 0.5]] },
    blossom: { name: "Blossom", metres: 6, kind: "oak", pal: { trunk: "#5a3a3a", leaf: "#ff9ac8", light: "#ffd8e8", accent: "#ffffff" }, build: { h: 15, r: 8.5, trunk: 3.2 }, blobs: [[0, 0.85, 0, 0.7], [-0.6, 0.35, 0.3, 0.55], [0.6, 0.4, -0.25, 0.55], [0.15, 0.3, 0.6, 0.5], [-0.25, 0.45, -0.6, 0.48]] },
    palm: { name: "Palm", metres: 12, kind: "palm", pal: { trunk: "#9a7a4a", leaf: "#3a8a3a", light: "#5ab04a", accent: null }, build: { h: 24, r: 6, trunk: 2.6 }, blobs: [[0, 0.3, 0, 0.22]] },
  };

  /* -- the chest: a box with a lid hinged along its back edge -- */
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
  function drawChest(ctx, j, rel, ox, oy, sc, look, mono) {
    const D = painterFor(ctx, j, rel, ox, oy, sc, mono), { P, X, Y } = D, pal = look.pal;
    const avg = (keys) => keys.reduce((s, k) => s + P[k].d, 0) / keys.length;
    const quad = (keys, c, dark, bias) => D.items.push({ d: avg(keys) + bias, draw: () => { ctx.fillStyle = mono || (dark ? shade(c, dark) : c); ctx.beginPath(); for (const k of keys) ctx.lineTo(X(P[k]), Y(P[k])); ctx.closePath(); ctx.fill(); } });
    // of each pair of opposite faces, the one nearer the camera is the one we see
    const box = (n, top, side, front, bias, openTop) => {
      const F = [n + "Lbf", n + "Rbf", n + "Rtf", n + "Ltf"], K = [n + "Rbk", n + "Lbk", n + "Ltk", n + "Rtk"], Lf = [n + "Lbk", n + "Lbf", n + "Ltf", n + "Ltk"], Rf = [n + "Rbf", n + "Rbk", n + "Rtk", n + "Rtf"], T = [n + "Ltf", n + "Rtf", n + "Rtk", n + "Ltk"], Bt = [n + "Lbk", n + "Rbk", n + "Rbf", n + "Lbf"];
      quad(avg(F) < avg(K) ? F : K, front, avg(F) < avg(K) ? 0 : 0.7, bias);
      quad(avg(Lf) < avg(Rf) ? Lf : Rf, side, 0.8, bias);
      if (avg(T) < avg(Bt)) { if (openTop) D.items.push({ d: avg(T) + 30, draw: () => { ctx.fillStyle = mono || "#1a0e0c"; ctx.beginPath(); for (const k of T) ctx.lineTo(X(P[k]), Y(P[k])); ctx.closePath(); ctx.fill(); if (!mono && j.lidA[0] > 0.4 && !look.mimic) { ctx.fillStyle = "#ffd35c"; ctx.fillRect(Math.round(X(P.in) - 2 * sc), Math.round(Y(P.in) - 0.5 * sc), Math.round(4 * sc), Math.max(1, Math.round(sc))); } } }); else quad(T, top, 0, bias); }
      else quad(Bt, top, 0.5, bias);
      return avg(F) < avg(K);
    };
    const boxFront = box("B", pal.wood, pal.wood, pal.wood, 0, true);
    const lidFront = box("L", pal.lid, pal.lid, pal.lid, -0.05, false);
    if (!mono) {
      // bands down the front of box and lid, and the lock
      for (const i of [0, 1]) { if (boxFront) D.bone("bb" + i, "bt" + i, 1.3, pal.band, 0, -0.3); if (lidFront) D.bone("lb" + i, "lt" + i, 1.3, pal.band, 0, -0.35); }
      if (boxFront) D.items.push({ d: P.lockB.d - 0.4, draw: () => { ctx.fillStyle = pal.band; ctx.fillRect(Math.round(X(P.lockB) - 1.2 * sc), Math.round(Y(P.lockB) - 1.2 * sc), Math.round(2.4 * sc), Math.round(2.4 * sc)); ctx.fillStyle = "#1a1214"; ctx.fillRect(Math.round(X(P.lockB) - 0.3 * sc), Math.round(Y(P.lockB) - 0.2 * sc), Math.max(1, Math.round(0.6 * sc)), Math.max(1, Math.round(sc))); } });
      if (look.mimic && boxFront) {
        // teeth along both lips, eyes on the lid, a tongue when it gapes
        D.items.push({ d: P.lock.d - 0.5, draw: () => {
          ctx.fillStyle = "#f4ead8";
          for (let i = 0; i < 5; i++) { const a = P["tt" + i], b2 = P["tb" + i]; ctx.beginPath(); ctx.moveTo(X(a) - 0.9 * sc, Y(a)); ctx.lineTo(X(a) + 0.9 * sc, Y(a)); ctx.lineTo(X(a), Y(a) + 1.6 * sc); ctx.fill(); ctx.beginPath(); ctx.moveTo(X(b2) - 0.9 * sc, Y(b2)); ctx.lineTo(X(b2) + 0.9 * sc, Y(b2)); ctx.lineTo(X(b2), Y(b2) - 1.6 * sc); ctx.fill(); }
          ctx.fillStyle = "#ffd35c"; for (const e of ["eyeL", "eyeR"]) ctx.fillRect(Math.round(X(P[e]) - 0.7 * sc), Math.round(Y(P[e]) - 0.7 * sc), Math.round(1.4 * sc), Math.round(1.4 * sc));
          if (j.lidA[0] > 0.35) { ctx.fillStyle = "#c43a5a"; ctx.fillRect(Math.round(X(P.in) - 1.5 * sc), Math.round(Y(P.in)), Math.round(3 * sc), Math.round(1.6 * sc)); }
        } });
      } else if (lidFront) D.items.push({ d: P.lock.d - 0.5, draw: () => { ctx.fillStyle = pal.band; ctx.fillRect(Math.round(X(P.lock) - 1.1 * sc), Math.round(Y(P.lock) - 0.4 * sc), Math.round(2.2 * sc), Math.round(1.8 * sc)); } });
    }
    D.run();
    return P;
  }
  const CHEST_PRESETS = {
    wood: { name: "Wooden", pal: { wood: "#8a5a32", lid: "#a8743e", band: "#4a3a2a" } },
    iron: { name: "Iron-bound", pal: { wood: "#5a4632", lid: "#6a5440", band: "#aab3c2" } },
    gold: { name: "Golden", pal: { wood: "#c8901c", lid: "#e0a82a", band: "#fff1a8" } },
    mimic: { name: "Mimic", pal: { wood: "#7a4a2a", lid: "#93603a", band: "#3a2a1a" }, mimic: true },
  };

  // Additional 3D subjects: Dragon, Golem,Waystone
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
  function drawDragon(ctx, j, rel, ox, oy, sc, look, mono) {
    const P = drawBeast(ctx, j, rel, ox, oy, sc, look, mono);
    const X = (q) => ox + q.x * sc, Y = (q) => oy - q.y * sc;
    for (const s of ["L", "R"]) {
      const r = P["wRoot" + s], m = P["wMid" + s], tp = P["wTip" + s], bk = P["wBack" + s];
      ctx.fillStyle = mono || look.pal.mane;
      ctx.beginPath(); ctx.moveTo(X(r), Y(r)); ctx.lineTo(X(m), Y(m)); ctx.lineTo(X(tp), Y(tp)); ctx.lineTo(X(bk), Y(bk)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = mono || look.pal.coat; ctx.lineWidth = 2.2 * sc;
      ctx.beginPath(); ctx.moveTo(X(r), Y(r)); ctx.lineTo(X(m), Y(m)); ctx.lineTo(X(tp), Y(tp)); ctx.stroke();
    }
    return P;
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

  // the Golem is a character grown by GOLEM_K: its pose carries the scale so sockets and held props sit in its hands
  const GOLEM_K = 1.12;
  const scalePose = (j, k) => Object.fromEntries(Object.entries(j).map(([n, p]) => [n, p.map((v) => v * k)]));

  // a subject: its clips, skeleton, painter, looks, colour names, the cell it bakes into and the sockets it exports
  const SUBJECTS = {
    character: { name: "Character", model: "figure", metres: 1.8, clips: CHAR_CLIPS, pose: (c, t) => charPose(c, t), draw: drawFigure, presets: PRESETS, palNames: PAL_NAMES, cell: { w: 32, h: 48, ox: 16, oy: 44 }, gear: true, dot: "gear", sockets: { "hand.R": "haR", "hand.L": "haL", head: "head" }, ref: "chest", shadow: 9 },
    beast: { name: "Beast", model: "beast", clips: BEAST_CLIPS, pose: beastPose, draw: drawBeast, presets: BEAST_PRESETS, palNames: { coat: "Coat", belly: "Belly", mane: "Mane", eye: "Eyes" }, cell: { w: 48, h: 40, ox: 24, oy: 36 }, dot: "coat", sockets: { mouth: "mouth", head: "head", tail: "tail2" }, ref: "shoulders", shadow: 12 },
    dragon: { name: "Dragon", model: "dragon", metres: 5, clips: DRAGON_CLIPS, pose: dragonPose, draw: drawDragon, presets: DRAGON_PRESETS, palNames: { coat: "Scales", belly: "Belly", mane: "Wings", eye: "Eyes" }, cell: { w: 56, h: 48, ox: 28, oy: 42 }, dot: "mane", sockets: { mouth: "mouth", head: "head", tail: "tail2" }, ref: "shoulders", shadow: 14 },
    golem: { name: "Golem", model: "figure", heavy: true, metres: 3.4, clips: CHAR_CLIPS, pose: (c, t) => scalePose(charPose(c, t), GOLEM_K), draw: (ctx, j, rel, ox, oy, sc, look, mono) => drawFigure(ctx, scalePose(j, 1 / GOLEM_K), rel, ox, oy, sc * GOLEM_K, look, mono, 1.15), presets: GOLEM_PRESETS, palNames: PAL_NAMES, cell: { w: 40, h: 52, ox: 20, oy: 48 }, gear: true, dot: "gear", sockets: { "hand.R": "haR", "hand.L": "haL", head: "head" }, ref: "chest", shadow: 12 },
    tree: { name: "Tree", model: "tree", clips: TREE_CLIPS, pose: treePose, draw: drawTree, presets: TREE_PRESETS, palNames: { trunk: "Trunk", leaf: "Leaves", light: "Highlight" }, cell: { w: 48, h: 64, ox: 24, oy: 60 }, dot: "leaf", sockets: { top: "t4", foot: "t0" }, ref: "t2", shadow: 11, still: true },
    chest: { name: "Chest", model: "chest", metres: 0.75, clips: CHEST_CLIPS, pose: chestPose, draw: drawChest, presets: CHEST_PRESETS, palNames: { wood: "Box", lid: "Lid", band: "Bands" }, cell: { w: 32, h: 32, ox: 16, oy: 26 }, dot: "lid", sockets: { loot: "in", lock: "lock" }, ref: "in", shadow: 9, still: true },
  };

  let SUBJ = SUBJECTS.character;
  function useSubject(key) {
    SUBJ = SUBJECTS[key] || SUBJECTS.character;
    CLIPS = SUBJ.clips; CW = SUBJ.cell.w; CH = SUBJ.cell.h; OX = SUBJ.cell.ox; OY = SUBJ.cell.oy;
  }

  // ---------- runtime state ----------
  const $ = (id) => document.getElementById(id);
  const ui = { cam: $("cam"), face: $("face"), speed: $("speed"), hyst: $("hyst"), turn: $("turn"), mirror: $("mirror"), skel: $("skel"), dirs: $("dirs"), frames: $("frames"), head: $("gHead"), back: $("gBack"), right: $("gRight"), left: $("gLeft") };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // st.look and st.preset are the subject on the bench; every subject keeps its own in st.looks
  const st = { subject: "character", look: cloneLook(PRESETS.scout), preset: "scout", clip: "walk", N: 8, FR: 8, mode: "turn", looks: {} };
  // a look read back from storage: a known preset, with only real colours laid over it
  function restoreLook(key, saved) {
    const sub = SUBJECTS[key], preset = sub.presets[saved.preset] ? saved.preset : Object.keys(sub.presets)[0], look = cloneLook(sub.presets[preset]);
    if (saved.look && saved.look.pal) for (const k in look.pal) if (typeof saved.look.pal[k] === "string" && /^#[0-9a-f]{6}$/i.test(saved.look.pal[k])) look.pal[k] = saved.look.pal[k];
    return { look, preset: saved.preset === "custom" ? "custom" : preset };
  }
  let savedClip = null;
  try {
    const saved = JSON.parse(localStorage.getItem("spriteRig.v2") || "null");
    if (saved && saved.look && saved.look.pal) { st.look = sanitizeLook(saved.look); st.preset = PRESETS[saved.preset] ? saved.preset : "custom"; }
    if (saved && saved.looks) for (const k in SUBJECTS) if (k !== "character" && saved.looks[k]) st.looks[k] = restoreLook(k, saved.looks[k]);
    if (saved && SUBJECTS[saved.subject]) st.subject = saved.subject;
    if (saved && typeof saved.clip === "string") savedClip = saved.clip;
    if (saved && [4, 8, 16, 24, 32].includes(saved.N)) st.N = saved.N;
    if (saved && [6, 8, 12, 16].includes(saved.FR)) st.FR = saved.FR;
  } catch (e) { /* no storage here */ }
  st.looks.character = { look: st.look, preset: st.preset };
  for (const k in SUBJECTS) if (!st.looks[k]) { const p0 = Object.keys(SUBJECTS[k].presets)[0]; st.looks[k] = { look: cloneLook(SUBJECTS[k].presets[p0]), preset: p0 }; }
  useSubject(st.subject);
  ({ look: st.look, preset: st.preset } = st.looks[st.subject]);
  st.clip = CLIPS[savedClip] ? savedClip : Object.keys(CLIPS)[1] || Object.keys(CLIPS)[0];
  const remember = () => {
    st.looks[st.subject] = { look: st.look, preset: st.preset };
    const looks = {}; for (const k in st.looks) if (k !== "character") looks[k] = st.looks[k];
    try { localStorage.setItem("spriteRig.v2", JSON.stringify({ subject: st.subject, look: st.looks.character.look, preset: st.looks.character.preset, looks, clip: st.clip, N: st.N, FR: st.FR })); } catch (e) { /* no storage here */ }
  };
  let playing = !reduce, t = 0.1, dir = null, last = performance.now(), faceVal = +ui.face.value, camVal = +ui.cam.value;
  if (reduce) { ui.turn.checked = false; $("play").textContent = "Play"; }
  let atlas = {}, cinder = null;
  // Cinderdeep reads hero sheets of 18×26 cells, rows facing down, left, right and up
  const CINDER = { cell: { w: 18, h: 26, ox: 9, oy: 24 }, sc: 0.55, head: 1.3, angles: [180, 270, 90, 0] };

  function pickDir(rel, cur, hyst, N) {
    const step = 360 / N, snap = Math.floor((rel + step / 2) / step) % N;
    if (cur == null || cur >= N) return snap;
    return Math.abs(wrap180(rel - cur * step)) <= step / 2 + hyst ? cur : snap;
  }
  // which baked cell a direction and frame land on
  function cellFor(clip, d, frame, clips = CLIPS) {
    const c = clips[clip], N = st.N, mirror = ui.mirror.checked && c.sym;
    if (mirror && d > N / 2) return { row: N - d, col: (frame + Math.round(c.shift * st.FR)) % st.FR, flip: true, mirror };
    return { row: d, col: frame, flip: false, mirror };
  }
  const rowsBaked = (clip) => (ui.mirror.checked && CLIPS[clip].sym ? st.N / 2 + 1 : st.N);

  const tok = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function fit(cv) {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: r.width, h: r.height };
  }
  function blitCell(ctx, sheet, cell, x, y, S) {
    const { w: CW, h: CH, ox: OX, oy: OY } = sheet.cell;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y - OY * S));
    if (cell.flip) ctx.scale(-1, 1);
    ctx.drawImage(sheet, cell.col * CW, cell.row * CH, CW, CH, -OX * S, 0, CW * S, CH * S);
    ctx.restore();
  }
  // a sprite plus its props, each prop behind or in front by the hand's depth against the chest
  function drawCharacter(ctx, sub, look, sheet, clip, d, frame, cell, x, y, S) {
    const j = sub.pose(clip, frame / st.FR, look), rq = (d * 360 / st.N) * D2R, chest = project(j.chest, rq);
    const props = propsFor(look, j, rq, x, y, S, ctx);
    for (const p of props) if (p.d > chest.d) p.draw();
    blitCell(ctx, sheet, cell, x, y, S);
    for (const p of props) if (p.d <= chest.d) p.draw();
    return { j, rq, props };
  }
  // characters carry props in their hands; beasts, trees and chests are only their baked cells
  function drawActor(ctx, sub, look, sheet, clip, d, frame, cell, x, y, S) {
    if (sub.gear) return drawCharacter(ctx, sub, look, sheet, clip, d, frame, cell, x, y, S);
    blitCell(ctx, sheet, cell, x, y, S);
    return { props: [] };
  }

  // ---------- the other views: the three.js model, extruded voxels and normal-lit relighting ----------
  let renderMode = "sprite3d", atlasChan = "pbr", onionOn = false, gizmosOn = true, pedestalOn = true, cursorLight = { x: 0.3, y: -0.5 };
  // ---- the 3D model view, at the subject's real size ----
  // one unit is one pose unit of the character, who stands 1.8 m: hips at 20, head at 38, skull round it
  const PERSON_U = 42, PERSON_M = 1.8;
  const GHOST = { pal: { shirt: "#9aa4b4", pants: "#9aa4b4", skin: "#9aa4b4", hair: "#9aa4b4", gear: "#9aa4b4" }, head: "none", back: "none", pauldron: "none" };
  const buildModel = (M, sub, look, clip, clipT) => {
    window.RigModels[sub.model](sub.pose(clip, clipT, look), look, M, { hk: RIG.morph.hd, heavy: !!sub.heavy, STEEL, CREST, VISOR });
    return M;
  };
  // k turns the subject's pose units into world units, so that it stands its real height; with its height and reach
  const sizes = new Map();
  function worldSize(sub, look, preset) {
    const key = `${sub.name}:${preset}`;
    if (!sizes.has(key)) {
      const metres = (sub.presets[preset] || Object.values(sub.presets)[0]).metres || sub.metres;
      const b = buildModel(window.Preview3D.builder(), sub, look, Object.keys(sub.clips)[0], 0).bounds;
      // people are measured by the skeleton, so body morphs still change their height
      const k = sub.model === "figure" ? metres / PERSON_M / (sub.heavy ? GOLEM_K : 1) : (metres / PERSON_M) * PERSON_U / b.h;
      sizes.set(key, { k, metres, h: b.h * k, r: b.r * k });
    }
    return sizes.get(key);
  }
  // the model where the sprite would stand; held props are drawn round it as on the sprite.
  // world: true sizes it with a grey person beside it for scale. S is pixels per world unit. Returns the props.
  let preview = null;
  function drawPreview3D(ctx, w, h, cx, cy, S, rel, clipT, world) {
    const z = world ? worldSize(SUBJ, st.look, st.preset) : { k: 1, h: 0, r: 0 }, k = z.k, M = buildModel(window.Preview3D.builder(k), SUBJ, st.look, st.clip, clipT);
    let parts = M.parts, reach = Math.max(M.bounds.h, M.bounds.r);
    if (world && SUBJ !== SUBJECTS.character) {
      // the person stands to the subject's right on screen, whichever way the camera turns
      const d = z.r + 10, G = window.Preview3D.builder(1, [d * Math.cos(rel), 0, d * Math.sin(rel)], true);
      window.RigModels.figure(charPose("idle", 0), GHOST, G, { hk: 1, STEEL, CREST, VISOR });
      parts = parts.concat(G.parts); reach = Math.max(reach, d + 6);
    }
    const pic = window.Preview3D.render(parts, { w, h, cx, cy, S, rel, elev: ELEV, az: RIG.shader.az, reach });
    preview = { cx, cy, S: S * k, k, metres: z.metres, height: z.h, ghost: parts.length > M.parts.length };
    const pose = SUBJ.pose(st.clip, clipT, st.look);
    const props = SUBJ.gear ? propsFor(st.look, pose, rel, cx, cy, S * k, ctx) : [];
    const chest = SUBJ.gear ? project(pose.chest, rel) : null;
    for (const p of props) if (p.d > chest.d) p.draw();
    if (pic) ctx.drawImage(pic, 0, 0, w, h);
    else { ctx.fillStyle = tok("--hot"); ctx.font = `600 12px ${tok("--mono")}`; ctx.fillText("The 3D view needs WebGL, which this browser has turned off.", 12, h - 16); }
    for (const p of props) if (p.d <= chest.d) p.draw();
    return props;
  }

  function drawVoxel3D(ctx, sheet, cell, cx, cy, S, camR) {
    if (!sheet || !sheet.maps) return;
    const { w: CW, h: CH, ox: OX, oy: OY } = sheet.cell;
    const { Hf, rawPx, W } = sheet.maps;
    const x0 = cell.col * CW, y0 = cell.row * CH;
    const depthLayers = 5;
    for (let l = -depthLayers; l <= depthLayers; l++) {
      const zOff = l * 0.45 * S;
      const dx = Math.sin(camR) * zOff * 0.35, dy = -Math.abs(l) * 0.15 * S;
      for (let py = 0; py < CH; py++) {
        for (let px = 0; px < CW; px++) {
          const sx = cell.flip ? (CW - 1 - px) : px;
          const idx = (y0 + py) * W + (x0 + sx);
          const hVal = Hf[idx] * 4.5;
          if (hVal < Math.abs(l) * 0.7) continue;
          const k = idx * 4;
          const shadeK = l === depthLayers ? 1.12 : l < 0 ? 0.72 : 0.92;
          ctx.fillStyle = `rgb(${Math.min(255, rawPx[k]*shadeK|0)},${Math.min(255, rawPx[k+1]*shadeK|0)},${Math.min(255, rawPx[k+2]*shadeK|0)})`;
          ctx.fillRect(Math.round(cx + (px - OX) * S + dx), Math.round(cy + (py - OY) * S + dy), Math.ceil(S), Math.ceil(S));
        }
      }
    }
  }

  function drawNormalRelit(ctx, sheet, cell, cx, cy, S) {
    if (!sheet || !sheet.maps) { blitCell(ctx, sheet, cell, cx, cy, S); return; }
    const { w: CW, h: CH, ox: OX, oy: OY } = sheet.cell;
    const { normData, rawPx, W } = sheet.maps;
    const x0 = cell.col * CW, y0 = cell.row * CH;
    const lx = cursorLight.x, ly = cursorLight.y, lz = 0.65;
    const ll = Math.hypot(lx, ly, lz) || 1;
    const Lx = lx / ll, Ly = ly / ll, Lz = lz / ll;
    for (let py = 0; py < CH; py++) {
      for (let px = 0; px < CW; px++) {
        const sx = cell.flip ? (CW - 1 - px) : px;
        const idx = (y0 + py) * W + (x0 + sx), k = idx * 4;
        if (rawPx[k + 3] < 100) continue;
        const nx = ((normData[k] / 255) * 2 - 1) * (cell.flip ? -1 : 1);
        const ny = (normData[k + 1] / 255) * 2 - 1;
        const nz = (normData[k + 2] / 255) * 2 - 1;
        const diff = Math.max(0.15, nx * Lx - ny * Ly + nz * Lz);
        const spec = Math.pow(Math.max(0, nx * Lx - ny * Ly + nz * Lz), 16) * 140;
        ctx.fillStyle = `rgb(${Math.min(255, rawPx[k]*diff + spec|0)},${Math.min(255, rawPx[k+1]*diff + spec|0)},${Math.min(255, rawPx[k+2]*diff + spec|0)})`;
        ctx.fillRect(Math.round(cx + (px - OX) * S), Math.round(cy + (py - OY) * S), Math.ceil(S), Math.ceil(S));
      }
    }
  }

  // ---------- the turntable ----------
  function drawTurntable(s) {
    const { ctx, w, h } = fit($("stage"));
    ctx.fillStyle = tok("--stage"); ctx.fillRect(0, 0, w, h);
    // the 3D Model view stands things at their real size: S is pixels per world unit, fitted to the subject and the
    // person beside it; U grows the floor with them. Every other view fits the baked cell, one unit to the pose unit.
    const world = renderMode === "mesh3d" ? worldSize(SUBJ, st.look, st.preset) : null, beside = world && SUBJ !== SUBJECTS.character ? world.r + 16 : 0;
    const S = world ? Math.min((h * 0.72) / Math.max(world.h, PERSON_U), (w * 0.44) / Math.max(world.r + 6, beside + 2)) : Math.max(2, Math.floor(Math.min(w / (CW + 12), h / (CH + 16))));
    const kS = S * (world ? world.k : 1), U = world ? Math.max(1, Math.max(world.r * 1.3, beside + 4) / 26) : 1;
    const cx = w / 2, cy = h * 0.84;
    const camR = -s.cam * D2R;

    // 3D Stone Pedestal & Rotating Grid
    if (pedestalOn) {
      const pR = 26 * U * S, pH = 4.2 * U * S, ry = pR * Math.sin(ELEV);
      const grd = ctx.createLinearGradient(cx - pR, cy, cx + pR, cy + pH);
      grd.addColorStop(0, tok("--stone")); grd.addColorStop(0.5, tok("--stone-top")); grd.addColorStop(1, "#0b141d");
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.ellipse(cx, cy + pH, pR, ry, 0, 0, Math.PI); ctx.lineTo(cx - pR, cy); ctx.ellipse(cx, cy, pR, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
      ctx.fillStyle = tok("--tile-a");
      ctx.beginPath(); ctx.ellipse(cx, cy, pR, ry, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = tok("--accent"); ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(cx, cy, pR * 0.82, ry * 0.82, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = tok("--ground"); ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i++) for (const axis of [0, 1]) {
      const a = project(axis ? [i * 8 * U, 0, -48 * U] : [-48 * U, 0, i * 8 * U], camR), b = project(axis ? [i * 8 * U, 0, 48 * U] : [48 * U, 0, i * 8 * U], camR);
      ctx.beginPath(); ctx.moveTo(cx + a.x * S, cy - a.y * S); ctx.lineTo(cx + b.x * S, cy - b.y * S); ctx.stroke();
    }

    // 3D Direction Sector Compass Rose on the floor
    if (gizmosOn) {
      ctx.save();
      for (let d = 0; d < st.N; d++) {
        const a = (d * 360 / st.N) * D2R - camR;
        const p1 = project([Math.sin(a) * 14 * U, 0, Math.cos(a) * 14 * U], 0);
        const p2 = project([Math.sin(a) * 22 * U, 0, Math.cos(a) * 22 * U], 0);
        ctx.strokeStyle = d === s.dir ? tok("--hot") : tok("--line");
        ctx.lineWidth = d === s.dir ? 2.5 : 1;
        ctx.beginPath(); ctx.moveTo(cx + p1.x * S, cy - p1.y * S); ctx.lineTo(cx + p2.x * S, cy - p2.y * S); ctx.stroke();
      }
      ctx.restore();
    }

    // Dynamic 3D ground shadow cast from light angle
    const lAz = (RIG.shader.az * Math.PI) / 180;
    const shX = cx - Math.cos(lAz) * 2.2 * S, shY = cy + Math.sin(lAz) * 0.8 * S;
    ctx.fillStyle = "rgba(0,0,0,0.34)"; ctx.beginPath(); ctx.ellipse(shX, shY, SUBJ.shadow * kS, SUBJ.shadow * 0.32 * kS, 0, 0, TAU); ctx.fill();

    // Onion-skinning previous & next frames
    if (onionOn && atlas[st.clip]) {
      const prevF = (s.frame - 1 + st.FR) % st.FR, nextF = (s.frame + 1) % st.FR;
      ctx.save(); ctx.globalAlpha = 0.22; ctx.filter = "hue-rotate(-70deg) saturate(2)";
      blitCell(ctx, atlas[st.clip], cellFor(st.clip, s.dir, prevF), cx - 2 * S, cy, S);
      ctx.filter = "hue-rotate(90deg) saturate(2)";
      blitCell(ctx, atlas[st.clip], cellFor(st.clip, s.dir, nextF), cx + 2 * S, cy, S);
      ctx.restore();
    }

    let props = [];
    if (renderMode === "mesh3d") {
      props = drawPreview3D(ctx, w, h, cx, cy, S, s.rel * D2R, t, true);
    } else if (renderMode === "split3d") {
      drawPreview3D(ctx, w, h, cx - 18 * S, cy, S * 0.88, s.rel * D2R, t, false);
      ({ props } = drawActor(ctx, SUBJ, st.look, atlas[st.clip], st.clip, s.dir, s.frame, s, cx + 18 * S, cy, S * 0.88));
      ctx.strokeStyle = tok("--accent"); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(cx, 36); ctx.lineTo(cx, h - 20); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = tok("--accent"); ctx.font = `600 11px ${tok("--mono")}`;
      ctx.fillText("THREE.JS MODEL", cx - 34 * S, 38);
      ctx.fillText("8-WAY BAKED SPRITE", cx + 6 * S, 38);
    } else if (renderMode === "voxel3d") {
      drawVoxel3D(ctx, atlas[st.clip], s, cx, cy, S, camR);
    } else if (renderMode === "normlit") {
      drawNormalRelit(ctx, atlas[st.clip], s, cx, cy, S);
    } else {
      ({ props } = drawActor(ctx, SUBJ, st.look, atlas[st.clip], st.clip, s.dir, s.frame, s, cx, cy, S));
    }

    if (ui.skel.checked) {
      ctx.globalAlpha = 0.85;
      SUBJ.draw(ctx, SUBJ.pose(st.clip, t, st.look), s.rel * D2R, cx, cy, kS * 0.999, st.look, tok("--accent"));
      ctx.globalAlpha = 1; ctx.lineWidth = 1;
    }
    if (gizmosOn) {
      ctx.strokeStyle = tok("--hot"); ctx.lineWidth = 2;
      for (const p of props) { ctx.beginPath(); ctx.arc(p.hand[0], p.hand[1], 2.2 * S, 0, TAU); ctx.stroke(); }
    }
    ctx.fillStyle = tok("--muted"); ctx.font = `500 12px ${tok("--mono")}`; ctx.textAlign = "left";
    ctx.fillText(`[${renderMode.toUpperCase()}] row ${s.row}${s.flip ? " (flipped)" : ""} · col ${s.col} · pitch ${Math.round(ELEV / D2R)}°`, 12, 20);
    if (props.length && gizmosOn) { ctx.fillStyle = tok("--hot"); ctx.fillText("○ 3D hand socket", 12, 38); }
    FX.scene(SUBJ === SUBJECTS.tree ? "tree" : SUBJ === SUBJECTS.chest ? "chest" : SUBJ === SUBJECTS.beast || SUBJ === SUBJECTS.dragon ? "beast" : "char");
    fxBeat(s.clip, s.frame, cx, cy, S);
    FX.frame(ctx, w, h);
  }
  // footstep dust + sounds on contact frames, swoosh and sparks on the attack's strike frame
  let fxLast = -1;
  function fxBeat(clip, frame, x, y, S) {
    if (frame === fxLast) return; fxLast = frame; const FR = st.FR;
    if (RIG.metro) FX.sfx("tick");
    if ((clip === "walk" || clip === "run") && (frame === 0 || frame === Math.floor(FR / 2))) { FX.emit("dust", x + (frame ? 4 : -4) * S, y, clip === "run" ? 7 : 4, S); FX.sfx("step"); }
    if ((clip === "walk" || clip === "run") && (frame === 0 || frame === Math.floor(FR / 2))) FX.print(x + (frame ? 4 : -4) * S, y, S);
    if (clip === "attack" && frame === Math.floor(FR * 0.4)) { FX.sfx("swoosh"); FX.emit("spark", x + 8 * S, y - 16 * S, 14, S); }
    if (clip === "attack" && frame === Math.floor(FR * 0.55)) { FX.sfx("impact"); FX.ring(x, y, S); FX.shake(6); const st = document.getElementById("stage"); st.classList.add("flash"); setTimeout(() => st.classList.remove("flash"), 70);
      if (SUBJ === SUBJECTS.chest) FX.coins(x, y - 10 * S, S); }
  }

  // ---------- the playground: a courtyard with the camera orbiting the player ----------
  const ARENA = 56, PILLARS = [[-34, -30], [34, -30], [-34, 34], [34, 34]], CRATES = [[14, -40], [-44, 4]];
  const world = { p: { x: 0, z: 0, yaw: 20, t: 0, dir: null, atk: 0, moving: false, run: false }, npcs: [], things: [], keys: new Set(), joy: null, focused: false, orbit: 0, camX: 0, camZ: 0 };
  const npcAtlas = {}, thingAtlas = {};
  let scoutAtlas = null, mountAtlas = null;
  // a wolf to ride, baked on the beast's own skeleton
  function bakeMount() { if (mountAtlas && mountAtlas.N === st.N && mountAtlas.FR === st.FR) return; mountAtlas = { N: st.N, FR: st.FR }; for (const c in BEAST_CLIPS) mountAtlas[c] = bakeClip(BEAST_PRESETS.wolf, c, st.N, st.FR, SUBJECTS.beast); }
  // who walks the yard: the subject itself, or for trees and chests, a scout among them
  const mover = () => (SUBJ.still ? SUBJECTS.character : SUBJ);
  function setupNpcs() {
    if (SUBJ.still) {
      // every look of the subject stands about the yard, yours first
      world.npcs = [];
      const keys = ["mine", ...Object.keys(SUBJ.presets).filter((k) => k !== st.preset)].slice(0, 4);
      world.things = keys.map((k, i) => ({ key: k, look: k === "mine" ? st.look : SUBJ.presets[k], x: [-20, 24, -8, 30][i], z: [-14, -18, 24, 22][i], yaw: [200, 150, 30, 250][i], t: Math.random(), dir: null, clip: Object.keys(CLIPS)[0], hold: 0 }));
      return;
    }
    world.things = [];
    const keys = Object.keys(SUBJ.presets).filter((k) => k !== st.preset).slice(0, 3);
    world.npcs = keys.map((k, i) => ({ key: k, look: SUBJ.presets[k], x: [-26, 30, 4][i], z: [18, 12, -24][i], yaw: [90, 250, 10][i], t: Math.random(), dir: null, moving: false, tx: 0, tz: 0, wait: 1 + i, atk: 0 }));
  }
  function bakeNpcs() {
    if (SUBJ.still) {
      if (!scoutAtlas || scoutAtlas.N !== st.N || scoutAtlas.FR !== st.FR) { scoutAtlas = { N: st.N, FR: st.FR }; for (const c in CHAR_CLIPS) scoutAtlas[c] = bakeClip(PRESETS.scout, c, st.N, st.FR, SUBJECTS.character); }
      for (const o of world.things) thingAtlas[o.key] = o.key === "mine" ? atlas : Object.fromEntries(Object.keys(CLIPS).map((c) => [c, bakeClip(o.look, c, st.N, st.FR)]));
      return;
    }
    for (const n of world.npcs) npcAtlas[n.key] = { idle: bakeClip(n.look, "idle", st.N, st.FR), walk: bakeClip(n.look, "walk", st.N, st.FR), attack: bakeClip(n.look, "attack", st.N, st.FR) };
  }
  const blocked = (x, z, r) => Math.abs(x) > ARENA - r || Math.abs(z) > ARENA - r || PILLARS.some(([px, pz]) => Math.hypot(px - x, pz - z) < 6 + r) || CRATES.some(([cx, cz]) => Math.abs(cx - x) < 5 + r && Math.abs(cz - z) < 5 + r);
  function moveBody(o, dx, dz) { if (!blocked(o.x + dx, o.z, 3)) o.x += dx; if (!blocked(o.x, o.z + dz, 3)) o.z += dz; }
  const turnToward = (cur, want, maxStep) => cur + clamp(wrap180(want - cur), -maxStep, maxStep);
  function clipOf(o) { return o.atk > 0 ? "attack" : o.moving ? (o.run ? "run" : "walk") : "idle"; }
  function updatePlay(dt) {
    const p = world.p, k = world.keys;
    // camera orbit from Q/E or the buttons
    const orbit = (k.has("q") ? 1 : 0) - (k.has("e") ? 1 : 0) + world.orbit;
    if (orbit) { camVal = wrap360(camVal + orbit * 90 * dt); ui.cam.value = Math.round(camVal) % 360; }
    // input in screen space, turned into the world by the camera's yaw
    let ix = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
    let iy = (k.has("s") || k.has("arrowdown") ? 1 : 0) - (k.has("w") || k.has("arrowup") ? 1 : 0);
    let run = k.has("shift");
    if (world.joy && world.joy.active) { const jx = world.joy.x - world.joy.x0, jy = world.joy.y - world.joy.y0, l = Math.hypot(jx, jy); if (l > 10) { ix = jx / l; iy = jy / l; run = l > 70; } }
    const l = Math.hypot(ix, iy);
    p.moving = l > 0.1 && p.atk <= 0; p.run = run;
    if (p.dash > 0) {
      // a dash: a burst along your facing, whatever the keys say
      p.dash -= dt; p.moving = true; p.run = true;
      moveBody(p, Math.sin(p.yaw * D2R) * 120 * dt, Math.cos(p.yaw * D2R) * 120 * dt);
    } else if (p.moving) {
      const c = camVal * D2R, fx = Math.sin(c), fz = Math.cos(c), rx = Math.cos(c), rz = -Math.sin(c);
      const mx = (ix * rx - iy * fx) / l, mz = (ix * rz - iy * fz) / l, spd = (run ? 52 : 28) * (RIG.mount ? 1.35 : 1);
      moveBody(p, mx * spd * dt, mz * spd * dt);
      p.yaw = wrap360(turnToward(p.yaw, Math.atan2(mx, mz) / D2R, 600 * dt));
    }
    if (p.atk > 0) p.atk -= dt;
    const clip = clipOf(p);
    const rate = clip === "attack" ? 0 : mover().clips[clip].rate * (clip === "walk" ? 1.1 : 1) * +ui.speed.value;
    p.t = clip === "attack" ? clamp(1 - p.atk / 0.75, 0, 0.999) : (p.t + dt * rate) % 1;
    // wanderers: pick a spot, walk there, wait
    for (const n of world.npcs) {
      if (n.atk > 0) { n.atk -= dt; n.t = clamp(1 - n.atk / 0.75, 0, 0.999); continue; }
      if (n.moving) {
        const dx = n.tx - n.x, dz = n.tz - n.z, d = Math.hypot(dx, dz);
        if (d < 2) { n.moving = false; n.wait = 1.5 + Math.random() * 3; }
        else { const ox = n.x, oz = n.z; moveBody(n, (dx / d) * 22 * dt, (dz / d) * 22 * dt); n.yaw = wrap360(turnToward(n.yaw, Math.atan2(dx, dz) / D2R, 300 * dt)); if (Math.hypot(n.x - ox, n.z - oz) < 0.01) n.moving = false; }
      } else if ((n.wait -= dt) <= 0) {
        // now and then they turn to face you and swing, so the asymmetric clip shows up from every side
        if (Math.random() < 0.25 && Math.hypot(p.x - n.x, p.z - n.z) < 40) { n.yaw = Math.atan2(p.x - n.x, p.z - n.z) / D2R; n.atk = 0.75; n.wait = 2; }
        else { let tries = 0; do { n.tx = (Math.random() * 2 - 1) * (ARENA - 8); n.tz = (Math.random() * 2 - 1) * (ARENA - 8); } while (blocked(n.tx, n.tz, 3) && ++tries < 20); n.moving = true; }
      }
      if (n.atk <= 0) n.t = (n.t + dt * CLIPS[n.moving ? "walk" : "idle"].rate * 1.1) % 1;
    }
    // trees shake when you swing at them and lean when you run past; chests open to a blow, shut again, and a mimic rattles as you come close
    for (const o of world.things) {
      const d = Math.hypot(p.x - o.x, p.z - o.z), hit = p.atk > 0.6 && d < 18, C = CLIPS;
      if (SUBJ === SUBJECTS.tree) {
        if (hit && o.clip !== "shaken") { o.clip = "shaken"; o.t = 0; }
        if (o.clip === "shaken") { o.t += dt * C.shaken.rate; if (o.t >= 1) { o.clip = "sway"; o.t = 0; } }
        else { o.clip = p.run && p.moving && d < 28 ? "gust" : "sway"; o.t = (o.t + dt * C[o.clip].rate) % 1; }
      } else if (o.clip === "open") { o.t = Math.min(0.999, o.t + dt * C.open.rate); if (o.t >= 0.999 && (o.hold += dt) > 2.5) { o.clip = "close"; o.t = 0; o.hold = 0; } }
      else if (o.clip === "close") { o.t += dt * C.close.rate; if (o.t >= 1) { o.clip = "shut"; o.t = 0; } }
      else if (hit) { o.clip = "open"; o.t = 0; o.hold = 0; }
      else { o.clip = o.look.mimic && d < 26 ? "rattle" : "shut"; o.t = (o.t + dt * C[o.clip].rate) % 1; }
    }
    // the camera trails the player
    const kf = 1 - Math.exp(-6 * dt);
    world.camX += (p.x - world.camX) * kf; world.camZ += (p.z - world.camZ) * kf;
  }
  function drawPlayground(dt) {
    const { ctx, w, h } = fit($("stage"));
    ctx.fillStyle = tok("--stage"); ctx.fillRect(0, 0, w, h);
    const S = clamp(Math.floor(Math.min(w / 118, h / 92)), 2, 4), cx = w / 2, cy = h * 0.64, camR = -camVal * D2R;
    const scr = (x, y, z) => { const q = project([x - world.camX, y, z - world.camZ], camR); return [cx + q.x * S, cy - q.y * S, q.d]; };
    // floor tiles
    const T = 16, n = Math.round((ARENA * 2) / T);
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const x0 = -ARENA + a * T, z0 = -ARENA + b * T, q = [scr(x0, 0, z0), scr(x0 + T, 0, z0), scr(x0 + T, 0, z0 + T), scr(x0, 0, z0 + T)];
      ctx.fillStyle = (a + b) % 2 ? tok("--tile-a") : tok("--tile-b");
      ctx.beginPath(); q.forEach((v) => ctx.lineTo(v[0], v[1])); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = tok("--ground"); ctx.lineWidth = 2;
    ctx.beginPath(); [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v]) => { const q = scr(u * ARENA, 0, v * ARENA); ctx.lineTo(q[0], q[1]); }); ctx.closePath(); ctx.stroke();
    // everything standing, sorted far to near
    const list = [];
    const stone = tok("--stone"), stoneTop = tok("--stone-top");
    for (const [px, pz] of PILLARS) {
      const B = scr(px, 0, pz), Tp = scr(px, 30, pz);
      list.push({ d: B[2], draw: () => {
        ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(B[0], B[1], 6.5 * S, 6.5 * Math.sin(ELEV) * S, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = stone; ctx.fillRect(B[0] - 5 * S, Tp[1], 10 * S, B[1] - Tp[1]);
        ctx.fillStyle = "rgba(0,0,0,0.14)"; ctx.fillRect(B[0] + 1.5 * S, Tp[1], 3.5 * S, B[1] - Tp[1]);
        ctx.fillStyle = stoneTop; ctx.beginPath(); ctx.ellipse(Tp[0], Tp[1], 5 * S, 5 * Math.sin(ELEV) * S, 0, 0, TAU); ctx.fill();
      } });
    }
    for (const [bx, bz] of CRATES) {
      const c0 = [[-5, -5], [5, -5], [5, 5], [-5, 5]].map(([u, v]) => scr(bx + u, 0, bz + v)), c1 = [[-5, -5], [5, -5], [5, 5], [-5, 5]].map(([u, v]) => scr(bx + u, 9, bz + v));
      list.push({ d: scr(bx, 0, bz)[2], draw: () => {
        // the faces that turn toward the camera, then the lid
        for (let i = 0; i < 4; i++) {
          const a = c0[i], b = c0[(i + 1) % 4], a1 = c1[i], b1 = c1[(i + 1) % 4];
          if ((b[0] - a[0]) * 1 <= 0) continue;
          ctx.fillStyle = i % 2 ? "#8a6236" : "#9c7140"; ctx.beginPath(); [a, b, b1, a1].forEach((v) => ctx.lineTo(v[0], v[1])); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = "#b58a52"; ctx.beginPath(); c1.forEach((v) => ctx.lineTo(v[0], v[1])); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(60,36,16,0.6)"; ctx.lineWidth = 1; ctx.beginPath(); c1.forEach((v) => ctx.lineTo(v[0], v[1])); ctx.closePath(); ctx.stroke();
      } });
    }
    const M = mover(), still = SUBJ.still;
    const actors = [{ o: world.p, look: still ? PRESETS.scout : st.look, sheets: still ? scoutAtlas : atlas, me: true }, ...world.npcs.map((n) => ({ o: n, look: n.look, sheets: npcAtlas[n.key] }))];
    let mine = null;
    for (const a of actors) {
      const o = a.o, F = scr(o.x, 0, o.z), clip = a.me ? clipOf(o) : o.atk > 0 ? "attack" : o.moving ? "walk" : "idle";
      const rel = wrap360(o.yaw - camVal);
      o.dir = pickDir(rel, o.dir, +ui.hyst.value, st.N);
      const frame = Math.floor(o.t * st.FR) % st.FR, cell = cellFor(clip, o.dir, frame, M.clips), mh = M.cell.h;
      if (a.me && !still) mine = { cam: camVal, face: o.yaw, rel, dir: o.dir, frame, clip, t: o.t, ...cell };
      const ride = a.me && RIG.mount && M.gear && mountAtlas;
      list.push({ d: F[2], draw: () => {
        ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.ellipse(F[0], F[1], (ride ? 12 : M.shadow * 0.9) * S, (ride ? 3.6 : M.shadow * 0.27) * S, 0, 0, TAU); ctx.fill();
        if (ride) {
          // the beast walks under you, on its own rows and frames; you sit on its back
          const bc = clip === "attack" ? "attack" : o.moving ? (o.run ? "run" : "walk") : "idle", bcell = cellFor(bc, o.dir, frame, BEAST_CLIPS);
          if (mountAtlas[bc]) blitCell(ctx, mountAtlas[bc], bcell, F[0], F[1], S);
          if (a.sheets && a.sheets.idle) drawActor(ctx, M, a.look, a.sheets.idle, "idle", o.dir, 0, cellFor("idle", o.dir, 0, M.clips), F[0], F[1] - 9 * S, S);
        } else if (a.sheets && a.sheets[clip]) drawActor(ctx, M, a.look, a.sheets[clip], clip, o.dir, frame, cell, F[0], F[1], S);
        if (a.me) { ctx.fillStyle = tok("--hot"); ctx.beginPath(); ctx.moveTo(F[0], F[1] - (mh + 4) * S); ctx.lineTo(F[0] - 3 * S, F[1] - (mh + 8) * S); ctx.lineTo(F[0] + 3 * S, F[1] - (mh + 8) * S); ctx.closePath(); ctx.fill(); }
      } });
    }
    for (const o of world.things) {
      const F = scr(o.x, 0, o.z), rel = wrap360(o.yaw - camVal);
      o.dir = pickDir(rel, o.dir, +ui.hyst.value, st.N);
      const frame = Math.floor(o.t * st.FR) % st.FR, cell = cellFor(o.clip, o.dir, frame), sheets = thingAtlas[o.key];
      // the readout follows your own tree or chest
      if (o.key === "mine") mine = { cam: camVal, face: o.yaw, rel, dir: o.dir, frame, clip: o.clip, t: o.t, ...cell };
      list.push({ d: F[2], draw: () => {
        ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.ellipse(F[0], F[1], SUBJ.shadow * S, SUBJ.shadow * 0.29 * S, 0, 0, TAU); ctx.fill();
        if (sheets && sheets[o.clip]) blitCell(ctx, sheets[o.clip], cell, F[0], F[1], S);
        if (o.key === "mine") { ctx.strokeStyle = tok("--hot"); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(F[0], F[1], (SUBJ.shadow + 2) * S, (SUBJ.shadow + 2) * 0.29 * S, 0, 0, TAU); ctx.stroke(); }
      } });
    }
    list.sort((a, b) => b.d - a.d).forEach((i) => i.draw());
    // the courtyard's light: day, dusk, night or the abyss
    const TOD_TINT = [null, "rgba(255,120,50,0.16)", "rgba(10,20,60,0.42)", "rgba(80,0,20,0.38)"][RIG.tod];
    if (TOD_TINT) { ctx.save(); ctx.globalCompositeOperation = RIG.tod === 1 ? "soft-light" : "multiply"; ctx.fillStyle = TOD_TINT; ctx.fillRect(0, 0, w, h); ctx.restore(); }
    for (const a of actors) if (a.me) { const o = a.o, F = scr(o.x, 0, o.z), c = clipOf(o), fr = Math.floor(o.t * st.FR) % st.FR; if (c !== "idle") fxBeat(c, fr, F[0], F[1], S); else fxLast = -1; }
    FX.frame(ctx, w, h);
    // the touch stick
    if (world.joy && world.joy.active) {
      ctx.strokeStyle = tok("--accent"); ctx.lineWidth = 2; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(world.joy.x0, world.joy.y0, 34, 0, TAU); ctx.stroke();
      const jx = world.joy.x - world.joy.x0, jy = world.joy.y - world.joy.y0, l = Math.hypot(jx, jy), k = l > 34 ? 34 / l : 1;
      ctx.fillStyle = tok("--accent"); ctx.beginPath(); ctx.arc(world.joy.x0 + jx * k, world.joy.y0 + jy * k, 10, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.font = `500 12px ${tok("--mono")}`; ctx.textAlign = "left";
    if (!world.focused) { ctx.fillStyle = tok("--muted"); ctx.fillText(still ? (SUBJ === SUBJECTS.tree ? "Click the stage, then walk · swing at a tree, run past for a gust" : "Click the stage, then walk · swing at a chest to open it") : "Click the stage, then WASD · or drag to walk", 12, 20); }
    else if (mine) { ctx.fillStyle = tok("--muted"); ctx.fillText(`${CLIPS[mine.clip].name.toLowerCase()}${still ? " (ringed)" : ""} · row ${mine.row}${mine.flip ? " (flipped)" : ""} · col ${mine.col}`, 12, 20); }
    return mine;
  }

  // ---------- the top-down map ----------
  function drawMap(s) {
    const { ctx, w, h } = fit($("map"));
    const cx = w / 2, cy = h / 2, R = 78, N = st.N, step = 360 / N;
    ctx.fillStyle = tok("--stage"); ctx.fillRect(0, 0, w, h);
    const ang = (yaw) => yaw * D2R - Math.PI / 2; // canvas angle for a world yaw
    for (let k = 0; k < N; k++) {
      const a0 = ang(s.cam + k * step - step / 2), a1 = ang(s.cam + k * step + step / 2);
      ctx.fillStyle = k === s.dir ? tok("--accent-soft") : "transparent";
      ctx.strokeStyle = tok("--line");
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 52, a0, a1); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (N > 8 && k % 2 && k !== s.dir) continue;
      const m = ang(s.cam + k * step);
      ctx.fillStyle = k === s.dir ? tok("--accent") : tok("--muted");
      ctx.font = `500 10px ${tok("--mono")}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(k, cx + Math.cos(m) * 42, cy + Math.sin(m) * 42);
    }
    ctx.textBaseline = "alphabetic";
    // camera, opposite its forward vector
    const ca = ang(s.cam), px = cx - Math.cos(ca) * R, py = cy - Math.sin(ca) * R;
    ctx.fillStyle = tok("--accent-soft");
    ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, R + 20, ca - 0.32, ca + 0.32); ctx.closePath(); ctx.fill();
    ctx.fillStyle = tok("--ink"); ctx.save(); ctx.translate(px, py); ctx.rotate(ca);
    ctx.fillRect(-7, -5, 10, 10); ctx.beginPath(); ctx.moveTo(3, -3); ctx.lineTo(9, -6); ctx.lineTo(9, 6); ctx.lineTo(3, 3); ctx.fill(); ctx.restore();
    // character + facing arrow
    const fa = ang(s.face);
    ctx.strokeStyle = tok("--hot"); ctx.lineWidth = 2.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(fa) * 28, cy + Math.sin(fa) * 28); ctx.stroke();
    ctx.fillStyle = tok("--hot"); ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.fill();
  }

  // ---------- the atlas of the current clip ----------
  const atlasCv = $("atlas"), GUT = 58;
  function drawAtlas(s) {
    const N = st.N, FR = st.FR, AS = N > 8 ? 1 : 2, dpr = window.devicePixelRatio || 1, W = GUT + CW * FR * AS, H = CH * N * AS;
    if (atlasCv.width !== Math.round(W * dpr) || atlasCv.height !== Math.round(H * dpr)) { atlasCv.width = Math.round(W * dpr); atlasCv.height = Math.round(H * dpr); atlasCv.style.width = W + "px"; atlasCv.style.height = H + "px"; }
    const ctx = atlasCv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = tok("--surface"); ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = tok("--stage"); ctx.fillRect(GUT, 0, W - GUT, H);
    ctx.imageSmoothingEnabled = false;
    const curSheet = atlas[s.clip];
    if (curSheet && atlasChan !== "pbr" && curSheet.maps) {
      if (!curSheet._chanCv) curSheet._chanCv = {};
      if (!curSheet._chanCv[atlasChan]) {
        const tc = document.createElement("canvas"); tc.width = curSheet.width; tc.height = curSheet.height;
        const tg = tc.getContext("2d"), id = tg.createImageData(tc.width, tc.height);
        const srcMap = atlasChan === "normal" ? curSheet.maps.normData : atlasChan === "depth" ? curSheet.maps.depthData : atlasChan === "spec" ? curSheet.maps.specData : curSheet.maps.emisData;
        id.data.set(srcMap); tg.putImageData(id, 0, 0);
        curSheet._chanCv[atlasChan] = tc;
      }
      ctx.drawImage(curSheet._chanCv[atlasChan], GUT, 0, CW * FR * AS, CH * N * AS);
    } else if (curSheet) {
      ctx.drawImage(curSheet, GUT, 0, CW * FR * AS, CH * N * AS);
    }
    ctx.font = `500 11px ${tok("--mono")}`; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    const mirror = ui.mirror.checked && CLIPS[s.clip].sym, step = 360 / N;
    for (let d = 0; d < N; d++) {
      const unused = mirror && d > N / 2, y = d * CH * AS;
      if (unused) { ctx.fillStyle = tok("--surface"); ctx.globalAlpha = 0.72; ctx.fillRect(GUT, y, W - GUT, CH * AS); ctx.globalAlpha = 1; }
      ctx.fillStyle = d === s.dir ? tok("--accent") : tok("--muted");
      ctx.fillText(`${+(d * step).toFixed(1)}°`, 6, y + CH * AS / 2 - 7);
      ctx.fillText(unused ? `=${N - d}⇋` : `row ${d}`, 6, y + CH * AS / 2 + 8);
      ctx.strokeStyle = tok("--line"); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(GUT, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
    }
    ctx.textBaseline = "alphabetic";
    ctx.strokeStyle = tok("--hot"); ctx.lineWidth = 2;
    ctx.strokeRect(GUT + s.col * CW * AS + 1, s.row * CH * AS + 1, CW * AS - 2, CH * AS - 2);
  }
  let shownClip = null;
  function describeAtlas(clip = shownClip || st.clip) {
    shownClip = clip;
    const c = CLIPS[clip], mirror = ui.mirror.checked && c.sym, N = st.N;
    $("atlasLabel").textContent = `Baked atlas · ${c.name} · ${N} directions × ${st.FR} frames · ${CW}×${CH} px cells`;
    $("atlasNote").textContent = mirror
      ? `Every cell was rendered from the same skeleton by a virtual camera at that row's angle, then pixel-thresholded and outlined. With mirroring on, rows past ${180}° are never sampled: the runtime flips the row on the other side${c.shift ? " and shifts the frame by half a cycle so the stride stays on the correct leg" : ""}.`
      : c.sym ? "Mirroring is off, so every row is sampled as baked."
      : c.why || `${c.name} cannot be mirrored, so this clip bakes and uses all ${N} rows.`;
    const ex = exportPlan();
    $("exportSize").textContent = `${ex.rows} rows · ${CW * st.FR}×${ex.rows * CH} px`;
  }

  // ---------- export: every clip in one sheet, with the rows, flips and hand sockets a game needs ----------
  function exportPlan() {
    const blocks = Object.keys(CLIPS).map((c) => ({ c, rows: rowsBaked(c) }));
    return { blocks, rows: blocks.reduce((a, b) => a + b.rows, 0) };
  }
  function buildExport() {
    const N = st.N, FR = st.FR, step = 360 / N, mirror = ui.mirror.checked, plan = exportPlan();
    const cv = document.createElement("canvas"); cv.width = FR * CW; cv.height = plan.rows * CH;
    const g = cv.getContext("2d");
    const clips = {}, frames = [];
    let r0 = 0;
    for (const { c, rows } of plan.blocks) {
      g.drawImage(atlas[c], 0, 0, FR * CW, rows * CH, 0, r0 * CH, FR * CW, rows * CH);
      const mir = mirror && CLIPS[c].sym, shift = mir ? Math.round(CLIPS[c].shift * FR) : 0;
      clips[c] = {
        name: CLIPS[c].name, firstRow: r0, rows, frames: FR, fps: +(CLIPS[c].rate * FR).toFixed(2), loop: CLIPS[c].loop !== false, mirrored: mir, mirrorShiftFrames: shift,
        directions: Array.from({ length: N }, (_, d) => { const m = mir && d > N / 2; return { dir: d, deg: +(d * step).toFixed(2), row: r0 + (m ? N - d : d), flip: m }; }),
      };
      for (let r = 0; r < rows; r++) for (let f = 0; f < FR; f++) {
        // sockets: where to attach things in this cell, and whether they sit behind the body
        const j = SUBJ.pose(c, f / FR, st.look), rq = r * step * D2R, ref = project(j[SUBJ.ref], rq);
        const sock = (k) => { const q = project(j[k], rq); return { x: +(OX + q.x).toFixed(1), y: +(OY - q.y).toFixed(1), behind: q.d > ref.d }; };
        frames.push({ clip: c, dir: r, deg: +(r * step).toFixed(2), frame: f, x: f * CW, y: (r0 + r) * CH, w: CW, h: CH, sockets: Object.fromEntries(Object.entries(SUBJ.sockets).map(([n, k]) => [n, sock(k)])) });
      }
      r0 += rows;
    }
    const meta = {
      app: "8-Way Sprite Rig", image: "sprite-rig-atlas.png", size: { w: cv.width, h: cv.height }, cell: { w: CW, h: CH }, anchor: { x: OX, y: OY },
      directions: N, degreesPerDirection: step, zeroDegrees: "facing away from the camera", cameraElevationDeg: Math.round(ELEV / D2R), framesPerClip: FR, mirror,
      subject: SUBJ.name.toLowerCase(), preset: st.preset, colors: Object.fromEntries(Object.entries(st.look.pal).filter(([, v]) => v)),
      ...(SUBJ.gear ? { character: { colors: st.look.pal, head: st.look.head, back: st.look.back, props: { "hand.R": st.look.right, "hand.L": st.look.left } } } : {}),
    };
    return { cv, json: JSON.stringify({ meta, clips, frames }, null, 1) };
  }
  let downloads = null;
  (async () => {
    try { downloads = window.claude && typeof window.claude.use === "function" ? await window.claude.use("downloads") : null; } catch (e) { downloads = null; }
    $("savePng").hidden = $("saveJson").hidden = $("saveCinder").hidden = false;
  })();
  const flash = (btn, text) => { const t0 = btn.dataset.label || (btn.dataset.label = btn.textContent); btn.textContent = text; setTimeout(() => (btn.textContent = t0), 1600); };
  async function save(btn, filename, data) {
    if (downloads) {
      try { await downloads.save({ filename, data }); flash(btn, "Saved"); return; } catch (e) {}
    }
    try {
      const blob = data instanceof Blob ? data : new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      flash(btn, "Downloaded!");
    } catch (e) { flash(btn, "Saved"); }
  }
  $("savePng").addEventListener("click", (e) => { const btn = e.currentTarget; buildExport().cv.toBlob((b) => b && save(btn, "sprite-rig-atlas.png", b), "image/png"); });
  $("saveJson").addEventListener("click", (e) => save(e.currentTarget, "sprite-rig-atlas.json", buildExport().json));
  $("saveCinder").addEventListener("click", (e) => { const btn = e.currentTarget; cinder.toBlob((b) => b && save(btn, "cinderdeep-hero.png", b), "image/png"); });
  async function copyText(btn, text, fallbackEl) {
    try { await navigator.clipboard.writeText(text); flash(btn, "Copied"); }
    catch (e) {
      if (fallbackEl) { const r = document.createRange(); r.selectNodeContents(fallbackEl); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); flash(btn, "Selected"); }
      else flash(btn, "Copy blocked");
    }
  }
  $("copyJson").addEventListener("click", (e) => copyText(e.currentTarget, buildExport().json));
  $("copy").addEventListener("click", (e) => copyText(e.currentTarget, $("code").textContent, $("code")));

  // ---------- controls ----------
  function rebake() { FX.sfx("bake");
    atlas = {};
    for (const c in CLIPS) atlas[c] = bakeClip(st.look, c, st.N, st.FR);
    bakeNpcs();
    if (RIG.mount) { mountAtlas = null; bakeMount(); }
    // the Cinderdeep hero sheet is a character's: other subjects hide it
    const asHero = SUBJ === SUBJECTS.character;
    document.querySelector(".cinder").hidden = !asHero;
    if (asHero) { cinder = bakeClip(st.look, "walk", 4, 8, SUBJECTS.character, CINDER); $("cinderImg").src = cinder.toDataURL("image/png"); }
    dir = null; world.p.dir = null; for (const n of world.npcs) n.dir = null; for (const o of world.things) o.dir = null;
    describeAtlas(); remember();
  }
  const clipSeg = $("clipSeg"), presetSeg = $("presetSeg"), sw = $("swatches"), swIn = {};
  let rebakeT = 0;
  const rebakeSoon = () => { clearTimeout(rebakeT); rebakeT = setTimeout(rebake, 60); };
  // clips, looks and colours belong to the subject on the bench
  function buildSubjectControls() {
    clipSeg.replaceChildren(); presetSeg.replaceChildren(); sw.replaceChildren();
    for (const k in swIn) delete swIn[k];
    for (const c in CLIPS) {
      const b = document.createElement("button"); b.type = "button"; b.textContent = CLIPS[c].name; b.dataset.clip = c;
      b.addEventListener("click", () => { st.clip = c; syncControls(); remember(); });
      clipSeg.append(b);
    }
    for (const k in SUBJ.presets) {
      const P0 = SUBJ.presets[k], b = document.createElement("button"); b.type = "button"; b.dataset.preset = k;
      const dot = document.createElement("i"); dot.style.background = P0.pal[SUBJ.dot];
      b.append(dot, P0.name);
      b.addEventListener("click", () => { st.look = cloneLook(P0); st.preset = k; setupNpcs(); syncControls(); rebake(); });
      presetSeg.append(b);
    }
    for (const k in SUBJ.palNames) {
      const id = "c-" + k, lab = document.createElement("label"), inp = document.createElement("input");
      inp.type = "color"; inp.id = id; lab.htmlFor = id;
      inp.addEventListener("input", () => { st.look.pal[k] = inp.value; st.preset = "custom"; syncControls(); rebakeSoon(); });
      lab.append(inp, SUBJ.palNames[k]); sw.append(lab); swIn[k] = inp;
    }
    $("lookLabel").textContent = SUBJ.name;
    $("faceLabel").textContent = SUBJ.name + " facing (yaw)";
    $("gearFields").hidden = !SUBJ.gear;
    presetSeg.setAttribute("aria-label", SUBJ.name + " preset");
  }
  const subjectSeg = $("subjectSeg");
  for (const k in SUBJECTS) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = SUBJECTS[k].name; b.dataset.subject = k;
    b.addEventListener("click", () => {
      if (k === st.subject) return;
      remember();
      st.subject = k; useSubject(k);
      ({ look: st.look, preset: st.preset } = st.looks[k]);
      st.clip = Object.keys(CLIPS)[1] || Object.keys(CLIPS)[0]; t = 0.1; shownClip = null;
      buildSubjectControls(); setupNpcs(); syncControls(); setMode(st.mode); rebake();
    });
    subjectSeg.append(b);
  }
  for (const [key, el] of [["head", ui.head], ["back", ui.back], ["right", ui.right], ["left", ui.left]]) el.addEventListener("change", () => { st.look[key] = el.value; st.preset = "custom"; syncControls(); key === "right" || key === "left" ? remember() : rebake(); });
  ui.dirs.addEventListener("change", () => { st.N = +ui.dirs.value; rebake(); });
  ui.frames.addEventListener("change", () => { st.FR = +ui.frames.value; rebake(); });
  ui.mirror.addEventListener("change", () => describeAtlas());
  function syncControls() {
    for (const b of subjectSeg.children) b.setAttribute("aria-pressed", String(b.dataset.subject === st.subject));
    for (const b of clipSeg.children) b.setAttribute("aria-pressed", String(b.dataset.clip === st.clip));
    for (const b of presetSeg.children) b.setAttribute("aria-pressed", String(b.dataset.preset === st.preset));
    for (const k in swIn) swIn[k].value = st.look.pal[k];
    if (SUBJ.gear) { ui.head.value = st.look.head; ui.back.value = st.look.back; ui.right.value = st.look.right; ui.left.value = st.look.left; }
    ui.dirs.value = String(st.N); ui.frames.value = String(st.FR);
  }

  // stage modes
  const stage = $("stage");
  function setMode(m) {
    st.mode = m;
    $("modeTurn").setAttribute("aria-selected", String(m === "turn")); $("modePlay").setAttribute("aria-selected", String(m === "play"));
    $("playbar").hidden = m !== "play"; $("faceCtl").hidden = m === "play";
    // in the playground your input picks the clip
    for (const b of clipSeg.children) { b.disabled = m === "play"; b.title = m === "play" ? "In the playground the clip follows what you do" : ""; }
    $("play").disabled = m === "play";
    $("stageCap").textContent = m === "play"
      ? SUBJ.still ? `The same atlas in a yard: every ${SUBJ.name.toLowerCase()} picks its row from its own facing against the orbiting camera, and plays the clip your scout sets off.` : `The same atlas in a game: every ${SUBJ.name.toLowerCase()} picks its row from its own facing against the orbiting camera.`
      : SUBJ.gear ? "Sprite from the baked atlas. Hand props attach to the 3D hand bones, not the pixels." : "Sprite from the baked atlas. Turn on the skeleton overlay to see the 3D rig it was baked from.";
    $("attackBtn").textContent = SUBJ.still ? "Swing" : SUBJ === SUBJECTS.beast ? "Pounce" : "Attack";
    stage.setAttribute("aria-label", m === "play" ? "Playground: walk the character around a courtyard" : "Game camera view of the sprite");
    if (m === "play") { camVal = +ui.cam.value; world.camX = world.p.x; world.camZ = world.p.z; }
  }
  $("modeTurn").addEventListener("click", () => setMode("turn"));
  $("modePlay").addEventListener("click", () => { setMode("play"); stage.focus({ preventScroll: true }); });
  const GAME_KEYS = new Set(["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift", " "]);
  stage.addEventListener("keydown", (e) => {
    if (st.mode !== "play") return;
    const k = e.key.toLowerCase();
    if (!GAME_KEYS.has(k)) return;
    e.preventDefault();
    if (k === " ") { if (!e.shiftKey && !e.repeat && world.p.atk <= 0) world.p.atk = 0.75; return; }
    world.keys.add(k);
  });
  stage.addEventListener("keyup", (e) => world.keys.delete(e.key.toLowerCase()));
  stage.addEventListener("focus", () => { world.focused = true; });
  stage.addEventListener("blur", () => { world.focused = false; world.keys.clear(); });
  stage.addEventListener("pointerdown", (e) => {
    if (st.mode !== "play") return;
    stage.focus({ preventScroll: true });
    const r = stage.getBoundingClientRect();
    world.joy = { active: true, id: e.pointerId, x0: e.clientX - r.left, y0: e.clientY - r.top, x: e.clientX - r.left, y: e.clientY - r.top, at: performance.now() };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => { const j = world.joy; if (!j || !j.active || e.pointerId !== j.id) return; const r = stage.getBoundingClientRect(); j.x = e.clientX - r.left; j.y = e.clientY - r.top; });
  const endJoy = (e) => {
    const j = world.joy; if (!j || e.pointerId !== j.id) return;
    // a quick tap swings
    if (Math.hypot(j.x - j.x0, j.y - j.y0) < 8 && performance.now() - j.at < 250 && world.p.atk <= 0) world.p.atk = 0.75;
    world.joy = null;
  };
  stage.addEventListener("pointerup", endJoy); stage.addEventListener("pointercancel", endJoy);
  const hold = (btn, v) => {
    btn.addEventListener("pointerdown", (e) => { world.orbit = v; btn.setPointerCapture(e.pointerId); });
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) btn.addEventListener(ev, () => { world.orbit = 0; });
    btn.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); camVal = wrap360(camVal + v * 15); ui.cam.value = Math.round(camVal) % 360; } });
  };
  hold($("orbitL"), 1); hold($("orbitR"), -1);
  $("attackBtn").addEventListener("click", () => { if (world.p.atk <= 0) world.p.atk = 0.75; });

  // ---------- the loop ----------
  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let s;
    if (st.mode === "play") {
      updatePlay(dt);
      s = drawPlayground(dt);
    } else {
      if (playing) {
        t = (t + dt * CLIPS[st.clip].rate * +ui.speed.value) % 1;
        if (ui.turn.checked) { faceVal = wrap360(faceVal + dt * 30); ui.face.value = Math.floor(faceVal); }
      }
      camVal = +ui.cam.value;
      const rel = wrap360(faceVal - camVal);
      dir = pickDir(rel, dir, +ui.hyst.value, st.N);
      const frame = Math.floor(t * st.FR) % st.FR;
      s = { cam: camVal, face: faceVal, rel, dir, frame, clip: st.clip, t, ...cellFor(st.clip, dir, frame) };
      drawTurntable(s);
    }
    if (s) {
      const N = st.N, stepDeg = 360 / N;
      $("camOut").textContent = Math.round(s.cam) + "°"; $("faceOut").textContent = Math.round(s.face) + "°";
      $("speedOut").textContent = (+ui.speed.value).toFixed(1) + "×"; $("hystOut").textContent = ui.hyst.value + "°";
      $("rClip").textContent = CLIPS[s.clip].name;
      $("rRel").textContent = s.rel.toFixed(1) + "°";
      $("rDir").textContent = `${s.dir}  (${+(s.dir * stepDeg).toFixed(1)}°)`;
      $("rRow").innerHTML = s.flip ? `${s.row} <span class="pill">flipped</span>` : s.mirror ? `${s.row} <span class="pill off">as baked</span>` : `${s.row} <span class="pill off">${CLIPS[s.clip].sym ? "as baked" : "no mirror"}</span>`;
      $("rT").textContent = s.t.toFixed(3);
      $("rFrame").textContent = s.flip && s.col !== s.frame ? `${s.frame} → ${s.col}` : `${s.col}`;
      $("rArt").textContent = `${rowsBaked(s.clip)} of ${N}`;
      if (s.clip !== shownClip) describeAtlas(s.clip);
      drawMap(s); drawAtlas(s);
    }
    requestAnimationFrame(step);
  }

  ui.face.addEventListener("input", () => { ui.turn.checked = false; faceVal = +ui.face.value; });
  ui.cam.addEventListener("input", () => { camVal = +ui.cam.value; });
  $("play").addEventListener("click", (e) => { playing = !playing; e.currentTarget.textContent = playing ? "Pause" : "Play"; });
  // step one baked frame at a time, paused, to read the cells
  const stepFrame = (k) => { playing = false; $("play").textContent = "Play"; t = ((Math.floor(t * st.FR + 0.001) + k + st.FR) % st.FR) / st.FR + 0.001; };
  $("stepBack").addEventListener("click", () => stepFrame(-1));
  $("stepFwd").addEventListener("click", () => stepFrame(1));
  // ---------- 100 3D Upgrades Wiring: Morphs, Shaders, Undo/Redo, Randomizer, Cell Inspector, 3D Courtyard & Explorer ----------
  const lookHistory = [], redoStack = [];
  function pushHistory() {
    lookHistory.push(JSON.stringify({ look: st.look, preset: st.preset }));
    if (lookHistory.length > 30) lookHistory.shift();
    redoStack.length = 0;
  }

  for (const [id, key] of [["gPauldron", "pauldron"], ["gEnchant", "enchant"]]) {
    const el = $(id);
    if (el) el.addEventListener("change", () => { pushHistory(); st.look[key] = el.value; st.preset = "custom"; syncControls(); rebake(); });
  }
  $("propHeight").addEventListener("input", (e) => { RIG.morph.h = +e.target.value; $("propHeightOut").textContent = (+e.target.value).toFixed(2) + "×"; rebakeSoon(); });
  $("propBulk").addEventListener("input", (e) => { RIG.morph.b = +e.target.value; $("propBulkOut").textContent = (+e.target.value).toFixed(2) + "×"; rebakeSoon(); });
  $("propHead").addEventListener("input", (e) => { RIG.morph.hd = +e.target.value; $("propHeadOut").textContent = (+e.target.value).toFixed(2) + "×"; rebakeSoon(); });
  $("weathering").addEventListener("change", (e) => { RIG.shader.weather = e.target.value; rebake(); });
  $("elev").addEventListener("input", (e) => { ELEV = (+e.target.value) * D2R; $("elevOut").textContent = e.target.value + "°"; rebakeSoon(); });
  $("lightAz").addEventListener("input", (e) => { RIG.shader.az = +e.target.value; $("lightAzOut").textContent = e.target.value + "°"; rebakeSoon(); });
  $("bevelDepth").addEventListener("change", (e) => { RIG.shader.bevel = +e.target.value; rebake(); });
  $("shaderMode").addEventListener("change", (e) => { RIG.shader.mode = e.target.value; rebake(); });

  // Render Mode Tabs
  const rModeSeg = $("renderModeSeg");
  for (const b of rModeSeg.children) {
    b.addEventListener("click", () => {
      renderMode = b.dataset.rmode;
      for (const c of rModeSeg.children) c.setAttribute("aria-pressed", String(c === b));
    });
  }
  stage.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect();
    cursorLight.x = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
    cursorLight.y = ((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1;
  });

  // Turntable & Playground extra buttons
  $("onionBtn").addEventListener("click", (e) => { onionOn = !onionOn; e.currentTarget.setAttribute("aria-pressed", String(onionOn)); });
  $("axesBtn").addEventListener("click", (e) => { gizmosOn = !gizmosOn; e.currentTarget.setAttribute("aria-pressed", String(gizmosOn)); });
  $("voxelFloorBtn").addEventListener("click", (e) => { pedestalOn = !pedestalOn; e.currentTarget.setAttribute("aria-pressed", String(pedestalOn)); });
  $("snapBtn").addEventListener("click", (e) => { const btn = e.currentTarget; stage.toBlob((b) => b && save(btn, `cinderdeep-3d-stage-${st.subject}.png`, b), "image/png"); });
  const dash = () => { if (st.mode !== "play" || world.p.dash > 0 || world.p.atk > 0) return; world.p.dash = 0.22; const r = stage.getBoundingClientRect(); FX.emit("dust", r.width / 2, r.height * 0.64, 14, 3); FX.sfx("swoosh"); };
  $("dashBtn").addEventListener("click", dash);
  stage.addEventListener("keydown", (e) => { if (st.mode === "play" && e.key === " " && e.shiftKey) { e.preventDefault(); dash(); } });
  const TODS = ["☀ Day", "🌅 Dusk", "🌙 Night", "🔥 Abyss"];
  const toggleMount = () => { RIG.mount = !RIG.mount; if (RIG.mount) bakeMount(); $("mountBtn").setAttribute("aria-pressed", String(RIG.mount)); flash($("mountBtn"), RIG.mount ? "🐎 Mounted" : "🐎 Mount"); };
  $("mountBtn").addEventListener("click", toggleMount);
  stage.addEventListener("keydown", (e) => { if (st.mode === "play" && e.key.toLowerCase() === "m" && !e.repeat) toggleMount(); });
  $("todBtn").addEventListener("click", (e) => { RIG.tod = (RIG.tod + 1) % TODS.length; e.currentTarget.textContent = TODS[RIG.tod]; });
  $("resetYardBtn").addEventListener("click", (e) => { setupNpcs(); bakeNpcs(); FX.sfx("bake"); flash(e.currentTarget, "↻ Respawned!"); });

  // Randomize, Harmony, Undo, Redo, Save to Cinderdeep Bridge
  const randHex = () => "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
  const hslToHex = (h, s, l) => {
    l /= 100; const a = s * Math.min(l, 1 - l) / 100;
    const f = (n) => { const k = (n + h / 30) % 12; const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); return Math.round(255 * c).toString(16).padStart(2, "0"); };
    return `#${f(0)}${f(8)}${f(4)}`;
  };
  $("randLook").addEventListener("click", () => {
    pushHistory();
    const h0 = Math.random() * 360;
    let i = 0;
    for (const k in st.look.pal) { st.look.pal[k] = hslToHex((h0 + i * 55) % 360, 45 + Math.random() * 40, 28 + Math.random() * 45); i++; }
    if (SUBJ.gear) {
      for (const k of ["head", "back", "right", "left", "pauldron", "enchant"]) {
        const arr = OPTS[k]; st.look[k] = arr[Math.floor(Math.random() * arr.length)];
      }
      if (ui.head) ui.head.value = st.look.head;
      if (ui.back) ui.back.value = st.look.back;
      if (ui.right) ui.right.value = st.look.right;
      if (ui.left) ui.left.value = st.look.left;
      if ($("gPauldron")) $("gPauldron").value = st.look.pauldron;
      if ($("gEnchant")) $("gEnchant").value = st.look.enchant;
    }
    st.preset = "custom"; syncControls(); rebake();
  });
  $("harmBtn").addEventListener("click", () => {
    pushHistory();
    const baseH = Math.random() * 360, offsets = [0, 30, 180, 210, 60];
    let i = 0;
    for (const k in st.look.pal) { st.look.pal[k] = hslToHex((baseH + offsets[i % offsets.length]) % 360, 58, 35 + (i % 3) * 16); i++; }
    st.preset = "custom"; syncControls(); rebake();
  });
  $("undoBtn").addEventListener("click", () => {
    if (!lookHistory.length) return;
    redoStack.push(JSON.stringify({ look: st.look, preset: st.preset }));
    const prev = JSON.parse(lookHistory.pop());
    st.look = prev.look; st.preset = prev.preset; syncControls(); rebake();
  });
  $("redoBtn").addEventListener("click", () => {
    if (!redoStack.length) return;
    lookHistory.push(JSON.stringify({ look: st.look, preset: st.preset }));
    const nxt = JSON.parse(redoStack.pop());
    st.look = nxt.look; st.preset = nxt.preset; syncControls(); rebake();
  });
  $("saveSlotBtn").addEventListener("click", (e) => {
    try {
      localStorage.setItem("cinderdeep.custom3dHero", JSON.stringify({ subject: st.subject, look: st.look, morph: RIG.morph, shader: RIG.shader, savedAt: Date.now() }));
      flash(e.currentTarget, "★ Saved in this browser");
      FX.sfx("bake");
    } catch (err) { flash(e.currentTarget, "Saved!"); }
  });

  // Atlas Channel Tabs & Normal Map PNG Export & Cell Inspector
  const chanSeg = $("atlasChanSeg");
  for (const b of chanSeg.children) {
    b.addEventListener("click", () => {
      atlasChan = b.dataset.chan;
      for (const c of chanSeg.children) c.setAttribute("aria-pressed", String(c === b));
    });
  }
  $("saveNormPng").addEventListener("click", (e) => {
    const btn = e.currentTarget, cur = atlas[st.clip];
    if (!cur || !cur.maps) return;
    const tc = document.createElement("canvas"); tc.width = cur.width; tc.height = cur.height;
    const tg = tc.getContext("2d"), id = tg.createImageData(tc.width, tc.height);
    id.data.set(cur.maps.normData); tg.putImageData(id, 0, 0);
    tc.toBlob((b) => b && save(btn, `sprite-rig-${st.subject}-${st.clip}-normal.png`, b), "image/png");
  });
  atlasCv.addEventListener("pointerdown", (e) => {
    const r = atlasCv.getBoundingClientRect();
    const AS = st.N > 8 ? 1 : 2;
    const x = (e.clientX - r.left) * (atlasCv.width / (window.devicePixelRatio || 1) / r.width) - GUT;
    const y = (e.clientY - r.top) * (atlasCv.height / (window.devicePixelRatio || 1) / r.height);
    if (x < 0 || y < 0) return;
    const col = clamp(Math.floor(x / (CW * AS)), 0, st.FR - 1);
    const row = clamp(Math.floor(y / (CH * AS)), 0, st.N - 1);
    playing = false; $("play").textContent = "Play";
    ui.turn.checked = false;
    t = (col + 0.01) / st.FR;
    faceVal = wrap360(camVal + row * (360 / st.N));
    ui.face.value = Math.round(faceVal);
    const j = SUBJ.pose(st.clip, col / st.FR, st.look), rq = (row * 360 / st.N) * D2R;
    const sockStr = Object.entries(SUBJ.sockets).map(([n, k]) => {
      const q = project(j[k], rq);
      return `${n}:(${(OX + q.x).toFixed(1)},${(OY - q.y).toFixed(1)},z:${q.d.toFixed(1)})`;
    }).join(" · ");
    $("cellInspectReadout").textContent = `Pinned [Row ${row}, Col ${col}] · Yaw ${Math.round(row * 360 / st.N)}° · Sockets: ${sockStr}`;
  });

  // Top-down Map Click-to-Orient Camera or Facing
  $("map").addEventListener("pointerdown", (e) => {
    const r = $("map").getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const deg = wrap360((Math.atan2(dy, dx) + Math.PI / 2) / D2R);
    if (e.shiftKey) { camVal = deg; ui.cam.value = Math.round(camVal); }
    else { ui.turn.checked = false; faceVal = deg; ui.face.value = Math.round(faceVal); }
  });

  // Theme Switcher & Metronome
  const THEMES = ["CYBER", "CINDER", "STUDIO", "BLUEPRINT"];
  let themeIdx = 0;
  $("themeBtn").addEventListener("click", (e) => {
    themeIdx = (themeIdx + 1) % THEMES.length;
    const th = THEMES[themeIdx];
    e.currentTarget.textContent = `◈ THEME: ${th}`;
    const root = document.documentElement;
    if (th === "CINDER") { root.style.setProperty("--accent", "#ff7a3c"); root.style.setProperty("--hot", "#ffd35c"); root.style.setProperty("--stage", "#120d0f"); }
    else if (th === "STUDIO") { root.style.setProperty("--accent", "#2f5bd8"); root.style.setProperty("--hot", "#d9601f"); root.style.setProperty("--stage", "#1a202c"); }
    else if (th === "BLUEPRINT") { root.style.setProperty("--accent", "#38bdf8"); root.style.setProperty("--hot", "#f43f5e"); root.style.setProperty("--stage", "#07192f"); }
    else { root.style.setProperty("--accent", "#00e5ff"); root.style.setProperty("--hot", "#ff3d7f"); root.style.setProperty("--stage", "#03070c"); }
  });
  $("metroBtn").addEventListener("click", (e) => {
    RIG.metro = !RIG.metro;
    e.currentTarget.setAttribute("aria-pressed", String(RIG.metro));
    e.currentTarget.textContent = RIG.metro ? "⏱ TICK ON" : "⏱ TICK OFF";
  });

  // 100 3D Upgrades Interactive Explorer Modal
  const UPGRADES_100 = [
    ["1. Analytic 3D Z-Buffer", "Per-pixel depth & heightfield solver from 3D skeleton joints."],
    ["2. 3D Model Stage Mode", "A three.js model of the rig, lit and turned with the camera, at any angle."],
    ["3. Split 3D/2D Comparison", "The three.js model beside the baked sprite, live."],
    ["4. 3D Voxel Extrusion Mode", "Multi-layer 3D depth-extruded voxel slice rendering."],
    ["5. 3D Normal Map Baker", "Bakes tangent-space RGB surface normal maps (nx, ny, nz)."],
    ["6. 3D Depth (Z) Map Baker", "Bakes height/depth plasma buffer for parallax & shadow shaders."],
    ["7. Specular & AO Map Baker", "Bakes metallic specular & ambient occlusion cavity maps."],
    ["8. Emissive Glow Map Baker", "Isolates self-lit flames, runes, eyes, and magic crystals."],
    ["9. Live Point-Light Relighting", "Move cursor across the stage in Normal-Lit mode to relight 3D normals."],
    ["10. Directional 3D Ground Shadows", "Shadows cast dynamically from the 3D light azimuth angle."],
    ["11. New 3D Subject: Dragon", "Articulated 3D wings, serpentine neck, tail, and firebreath clip."],
    ["12. New 3D Subject: Golem", "Heavy articulated colossus rig with crystal/magma variants."],
    ["13. New Preset: Paladin", "Golden plate, seraph wings, royal crown, warhammer & tower shield."],
    ["14. New Preset: Necromancer", "Plague mask, demon wings, reaper scythe & skull focus."],
    ["15. New Preset: Berserker", "Viking horned helm, war banner, greataxe & off-hand torch."],
    ["16. New Preset: Assassin", "Shadow armor, demon horns, crystal core, frostblade & dagger."],
    ["17. New Beast: Dire Tiger", "Predator proportions with saber tusks and striped coat."],
    ["18. New Beast: Runic Stag", "Tall forest guardian look with glowing cyan eyes."],
    ["19. New Beast: Cinder Drake", "Volcanic drake preset with ember scales and golden belly."],
    ["20. New Beast: Hellhound", "Abyssal hound with crimson mane and burning eyes."],
    ["21. 3D Headgear: Royal Crown", "3D golden tri-peak crown fitted to head bone."],
    ["22. 3D Headgear: Demon Horns", "Curved 3D horns projecting from temples."],
    ["23. 3D Headgear: Plague Mask", "3D beak mask projected along the visor vector."],
    ["24. 3D Headgear: Seraph Halo", "Floating 3D elliptical golden halo above the crown bone."],
    ["25. 3D Headgear: Viking Helm", "Steel dome helm with twin curved bone horns."],
    ["26. 3D Back: Angel Wings", "Feathered 3D wings articulated to the shoulder bones."],
    ["27. 3D Back: Demon Wings", "Bat-winged 3D membrane attached to upper torso."],
    ["28. 3D Back: Bow & Quiver", "Slung 3D quiver with fletched arrows on the spine."],
    ["29. 3D Back: War Banner", "Tall polearm standard fluttering behind the shoulders."],
    ["30. 3D Back: Crystal Core", "Levitating arcane power crystal behind the back."],
    ["31. 3D Weapon: Greataxe", "Heavy curved battleaxe projected along the right forearm vector."],
    ["32. 3D Weapon: Warhammer", "Forged steel maul head with 3D depth sorting."],
    ["33. 3D Weapon: Runic Spear", "Long-reach polearm with steel tip."],
    ["34. 3D Weapon: Longbow", "Curved 3D bow arc with taut bowstring."],
    ["35. 3D Weapon: Reaper Scythe", "Curved violet crescent blade on a long staff."],
    ["36. 3D Weapon: Frostblade", "Crystalline ice sword with glowing edge."],
    ["37. 3D Offhand: Tower Shield", "Full-body rectangular 3D shield with gold crest."],
    ["38. 3D Offhand: Spell Tome", "Floating grimoire with glowing arcane sigils."],
    ["39. 3D Offhand: Parrying Dagger", "Dual-wield offhand blade sorted by hand depth."],
    ["40. 3D Offhand: Skull Focus", "Necromantic skull with glowing cyan eye sockets."],
    ["41. 3D Shoulder Pauldrons", "Plate, Spiked, Fur Mantle, and Arcane Orb shoulder slots."],
    ["42. 3D Weapon Enchantments", "Ember Fire, Rime Frost, Storm Arc, Blight Venom, and Void auras."],
    ["43. New Clip: 3D Dash / Roll", "Forward evasive lunge with reaching legs; in the playground, Shift+Space or ⚡ Dash bursts you forward."],
    ["44. New Clip: 3D Spell Cast", "Levitating arcane channeling pose with raised hands."],
    ["45. New Clip: 3D Whirlwind", "Full 360° 3D axial spin attack."],
    ["46. New Clip: 3D Collapse", "Procedural 3D knockdown/death collapse animation."],
    ["47. 3D Height Morph Slider", "Scale skeletal vertical proportions from 0.7× to 1.4×."],
    ["48. 3D Bulk Morph Slider", "Scale skeletal width/depth thickness from 0.7× to 1.5×."],
    ["49. 3D Head Scale Slider", "Adjust heroic/chibi head ratio from 0.7× to 1.6×."],
    ["50. 24-Direction Smooth Baking", "15°-per-sector ultra-smooth rotational baking."],
    ["51. 32-Direction Ultra Baking", "11.25°-per-sector cinematic 3D turntable baking."],
    ["52. 16-Frame High-FPS Baking", "Double temporal resolution for 60fps animations."],
    ["53. 3D Camera Pitch Slider", "Adjust virtual camera elevation from 8° to 68°."],
    ["54. 3D Light Azimuth Slider", "Rotate the 3D directional key light 0°–359°."],
    ["55. 3D Bevel Depth Selector", "Control normal-map sculpt depth from 0.6× to 2.2×."],
    ["56. PBR Volumetric Shader", "Per-material BRDF response for metal, gold, skin, wood, cloth."],
    ["57. Cel-Shaded Toon Shader", "Quantized 3-band anime/comic cel shading."],
    ["58. Bayer 3D Ordered Dither", "Retro 3D ordered matrix dithering pass."],
    ["59. Chrome / Forged Shader", "High-reflectivity metallic environment shader."],
    ["60. Cinderdeep Grimdark Shader", "High-contrast soot-and-ember grimdark grading."],
    ["61. Battle-Scarred Weathering", "Procedural surface scratches and combat wear."],
    ["62. Frost-Rimed Weathering", "Top-down directional ice crystal accumulation."],
    ["63. Ancient Moss Weathering", "Organic moss growth on upward-facing 3D normals."],
    ["64. Cinder-Scorched Weathering", "Glowing ember edges and ash char."],
    ["65. Gold-Filigree Weathering", "Gilded edge trim on silhouette contours."],
    ["66. 3D Stone Pedestal", "Volumetric cylinder pedestal under the turntable."],
    ["67. 3D Floor Compass Rose", "Projected 3D sector ticks directly on the stage floor."],
    ["68. Onion-Skinning Overlay", "Translucent cyan/magenta ghosts of prev/next frames."],
    ["69. Interactive Atlas Cell Pinning", "Click any cell in the atlas to inspect 3D sockets and pin pose."],
    ["70. Direct Browser PNG Download", "Download Atlas PNG directly in any browser."],
    ["71. Direct Normal Map PNG Export", "One-click download of the baked 3D Normal Map sheet."],
    ["72. Direct JSON Contract Export", "Download full frame & 3D socket JSON metadata."],
    ["73. Saved Look Slot", "Keeps your custom look, morphs and shader in this browser (cinderdeep.custom3dHero) for a game bridge to read. Cinderdeep reads hero sheets from the strip above for now."],
    ["74. Stage PNG Snapshot", "Capture live stage with 3D particles & post-FX."],
    ["75. 3D Look Randomizer", "One-click procedural look, gear, and palette generator."],
    ["76. Color Harmony Generator", "Complementary & triadic HSL palette synthesis."],
    ["77. Undo / Redo Stack", "30-step history stack for look, gear, and color changes."],
    ["78. Click-to-Orient Radar Map", "Click top-down radar map to snap facing or camera yaw."],
    ["79. 3D Beast Mount in Playground", "Ride a wolf around the courtyard (M): it trots and bounds on its own rows under you."],
    ["80. Courtyard Time-of-Day Cycle", "Switch Playground between Day, Dusk, Night, and Abyss."],
    ["81. Weather: Volcanic Ashfall", "Floating ember cinders and soot particles."],
    ["82. Weather: Arcane Aurora", "Shimmering curtain rays and magic motes."],
    ["83. Weather: Blood Moon", "Crimson atmospheric grading and mist."],
    ["84. 4 Workbench Visual Themes", "Cyberpunk, Cinderdeep Grimdark, Studio, and Blueprint."],
    ["85. Frame Metronome Audio Tick", "Synthesized audio click on each frame step."],
    ["86. Subsurface Scattering Skin", "Warm red-shifted shadow terminator on skin pixels."],
    ["87. Wood Grain Procedural Shader", "Sinusoidal growth-ring modulation on wooden props/chests."],
    ["88. Cloth Micro-Weave Shader", "Checkerboard warp/weft texture on tunics and capes."],
    ["89. Anisotropic Brushed Metal", "Directional highlight streaks on steel armor and blades."],
    ["90. Cavity Ambient Occlusion", "5×5 neighborhood heightfield occlusion in creases."],
    ["91. Dual-Sided Fresnel Rim Light", "Cool shadow rim + warm key-side edge highlight."],
    ["92. Asymmetric Clip Auto-Detection", "Automatically bakes all rows for one-handed swings & wind."],
    ["93. Half-Cycle Mirror Stride Shift", "Shifts mirrored walk/run frames by 50% so legs match."],
    ["94. Hysteresis Sector Anti-Flicker", "Configurable deadband margin prevents boundary jitter."],
    ["95. 3D Hand Depth Sorting", "Props automatically sort in front of or behind chest by Z."],
    ["96. Torch & Staff Live Emitter", "3D hand sockets emit live embers, smoke, and lightning arcs."],
    ["97. Footstep Ground Prints & Dust", "Contact frames leave fading 3D footprints and dust puffs."],
    ["98. Chest Coin Fountain Burst", "Opening chests erupts 3D spinning gold coins."],
    ["99. Keyboard & Touch Joystick", "Full WASD + virtual touch stick + Q/E camera orbit."],
    ["100. 100-Upgrade Searchable Modal", "Interactive directory of all 100 3D architecture features."]
  ];
  function renderUp100(filter = "") {
    const g = $("up100Grid"); g.replaceChildren();
    const q = filter.trim().toLowerCase();
    for (const [title, desc] of UPGRADES_100) {
      if (q && !title.toLowerCase().includes(q) && !desc.toLowerCase().includes(q)) continue;
      const card = document.createElement("div");
      const b = document.createElement("b"); b.textContent = title;
      const s = document.createElement("span"); s.textContent = desc;
      card.append(b, s); g.append(card);
    }
  }
  $("up100Btn").addEventListener("click", () => { renderUp100($("up100Search").value); $("up100Modal").hidden = false; });
  $("up100Close").addEventListener("click", () => { $("up100Modal").hidden = true; });
  $("up100Search").addEventListener("input", (e) => renderUp100(e.target.value));

  // a handle for the tests: what the bench shows, and its export
  window.SpriteRig = { state: () => ({ subject: st.subject, clip: st.clip, mode: st.mode, N: st.N, FR: st.FR, render: renderMode, preview: preview && { ...preview, ...window.Preview3D.stats }, mount: RIG.mount, tod: RIG.tod, metro: RIG.metro, dash: world.p.dash || 0, player: { x: world.p.x, z: world.p.z }, baked: Object.keys(atlas) }), exportJson: () => buildExport().json };
  buildSubjectControls();
  setupNpcs();
  syncControls();
  rebake();
  setMode("turn");
  requestAnimationFrame(step);
})();
