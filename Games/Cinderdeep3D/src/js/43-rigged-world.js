/* ============================================================
   Cinderdeep — the rigged world. Monsters, Realm creatures,
   playable beasts and the mount are rebuilt from their paintings
   the way heroes are. Painters name the parts they paint; bodies,
   heads and tails are inflated from the flat picture into rounded
   solids, legs and arms become textures carried on bones, wings
   flap about their roots and tails wag about theirs. Five baked
   turns, mirrored, cover eight directions, and each turn bakes its
   clips a few at a time so a crowded room never stalls.
   ============================================================ */
const crigOn = () => CD.settings.rigWorld !== false;
// painters say how they were drawn: from the front (the default), side on facing right, or from above;
// how deep the body is for its width, whether it floats rather than walks, and which way a creature painted from above faces
function rigOrient(P, o, opt = {}) {
  const c = P && P.cap;
  if (!c) return;
  if (typeof opt === 'number') opt = { depth: opt };
  c.orient = o; c.depth = opt.depth || 1; c.float = !!opt.float; c.slither = !!opt.slither; c.fwd = opt.fwd === 'right' ? Math.PI / 2 : 0;
}
// where a limb joins the body, for limbs that splay out before they come down
function rigRoot(P, x, y) { const c = P && P.cap; if (c) (c.roots || (c.roots = {}))[c.part] = ((c.roots || {})[c.part] || []).concat([[x, y]]); }
function crigCapture(def, f) {
  if (def.capture) return def.capture(f);
  const P = new PP(def.w, def.h);
  const c = { part: 'body', names: [], layers: Object.create(null), w: P.w, h: P.h, own: new Uint8Array(P.w * P.h), orient: def.orient || 'front' };
  P.cap = c;
  try { def.paint(P, f); } finally { P.cap = null; }
  return c;
}

// a pixel written straight onto the layer being painted
function crigPut(Q, x, y, v) {
  const c = Q.cap, i = y * Q.w + x;
  Q.d[i] = v;
  let k = c.names.indexOf(c.part);
  if (k < 0) { k = c.names.push(c.part) - 1; c.layers[c.part] = new Uint32Array(Q.w * Q.h); }
  c.layers[c.part][i] = v; c.own[i] = k + 1;
}
// a captured body grown the way resamplePP grows a picture, one layer at a time
function crigResample(c, k) {
  if (k <= 1.02) return c;
  const out = { ...c, layers: Object.create(null), roots: c.roots && Object.fromEntries(Object.entries(c.roots).map(([n, L]) => [n, L.map(([x, y]) => [x * k, y * k])])) };
  for (const n of c.names) { const P = new PP(c.w, c.h); P.d.set(c.layers[n]); const Q = resamplePP(P, k); out.layers[n] = Q.d; out.w = Q.w; out.h = Q.h; }
  out.own = new Uint8Array(out.w * out.h);
  out.names.forEach((n, k2) => { const L = out.layers[n]; for (let i = 0; i < L.length; i++) if (L[i] >>> 24) out.own[i] = k2 + 1; });
  return out;
}

/* ---------- a little 3D: affine matrices over (u across the picture, y down it, z out of it) ---------- */
const CRIG_DOWN = [0, 1, 0];
const CRIG_AX = { side: { F: [1, 0, 0], L: [0, 0, 1] }, front: { F: [0, 0, 1], L: [1, 0, 0] } };
const mI = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
function mMul(A, B) {
  const o = new Array(12);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) o[r * 4 + c] = A[r * 4] * B[c] + A[r * 4 + 1] * B[4 + c] + A[r * 4 + 2] * B[8 + c];
    o[r * 4 + 3] = A[r * 4] * B[3] + A[r * 4 + 1] * B[7] + A[r * 4 + 2] * B[11] + A[r * 4 + 3];
  }
  return o;
}
const mApply = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3], m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7], m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]];
const mMove = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
// turn b toward a by th, about the point c
function mTurn(a, b, th, c) {
  if (!th) return mI();
  const cs = Math.cos(th) - 1, sn = Math.sin(th), m = mI();
  for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) m[r * 4 + k] += cs * (a[r] * a[k] + b[r] * b[k]) + sn * (a[r] * b[k] - b[r] * a[k]);
  return c ? mMul(mMove(c[0], c[1], c[2]), mMul(m, mMove(-c[0], -c[1], -c[2]))) : m;
}
function mScale(sx, sy, sz, c) { return mMul(mMove(c[0], c[1], c[2]), mMul([sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0], mMove(-c[0], -c[1], -c[2]))); }

/* ---------- inflating a flat part: thick in its middle, thin at its edges ---------- */
function crigDist(A, W, H) {
  const D = new Float32Array(W * H), r2 = Math.SQRT2;
  for (let i = 0; i < W * H; i++) D[i] = A[i] >>> 24 ? 1e6 : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : D[y * W + x]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (D[i]) D[i] = Math.min(D[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + r2, at(x + 1, y - 1) + r2); }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (D[i]) D[i] = Math.min(D[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + r2, at(x - 1, y + 1) + r2); }
  return D;
}
function crigThick(A, W, H, k) {
  const D = crigDist(A, W, H), R = new Float32Array(W * H), T = new Float32Array(W * H);
  // the local radius: the biggest circle that fits inside and covers the pixel, so an ear on a head stays thin and a belly stays round
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = D[y * W + x];
    if (!r) continue;
    let inner = false;
    for (let dy = -1; dy <= 1 && !inner; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if ((dx || dy) && xx >= 0 && yy >= 0 && xx < W && yy < H && D[yy * W + xx] >= r + 0.95) { inner = true; break; } }
    if (inner) continue;
    const n = Math.floor(r);
    for (let dy = -n; dy <= n; dy++) for (let dx = -n; dx <= n; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H || dx * dx + dy * dy > r * r) continue;
      const j = yy * W + xx;
      if (D[j] && r > R[j]) R[j] = r;
    }
  }
  for (let i = 0; i < W * H; i++) {
    if (!D[i]) continue;
    const d = D[i] - 0.5, r = Math.max(R[i], D[i]) - 0.5;
    T[i] = k * Math.sqrt(Math.max(0.25, d * (2 * r - d)));
  }
  return T;
}
function crigComps(A, W, H) {
  const seen = new Uint8Array(W * H), out = [];
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || !(A[i] >>> 24)) continue;
    const st = [i], comp = [];
    seen[i] = 1;
    while (st.length) {
      const j = st.pop(), x = j % W, y = (j / W) | 0;
      comp.push(j);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const k = yy * W + xx;
        if (!seen[k] && A[k] >>> 24) { seen[k] = 1; st.push(k); }
      }
    }
    out.push(comp);
  }
  // crumbs join the nearest piece
  const big = out.filter((c) => c.length > 2);
  if (!big.length) return out;
  for (const c of out) if (c.length <= 2) {
    let best = big[0], bd = 1e9;
    for (const b of big) for (const j of b) { const d = Math.hypot((j % W) - (c[0] % W), ((j / W) | 0) - ((c[0] / W) | 0)); if (d < bd) { bd = d; best = b; } }
    best.push(...c);
  }
  return big;
}

/* ---------- the model: solid pieces and limbs, from one painted frame ---------- */
const CRIG_K = { side: { body: 1.15, head: 1, tail: 0.6, wing: 0.16, def: 0.8 }, front: { body: 0.75, head: 0.85, tail: 0.6, wing: 0.16, def: 0.65 } };
const crigJoint = (b) => (b === 'body' ? 'body' : b.startsWith('head') ? 'head' : b.startsWith('tail') ? 'tail' : b.startsWith('wing') ? 'wing' : b.startsWith('gear') ? 'gear' : 'body');
function crigModel(def, f) {
  const c = crigCapture(def, f), W = c.w, H = c.h, ax = def.ax, side = c.orient === 'side';
  if (c.orient === 'top') return { orient: 'top', fwd: c.fwd, W, H, ax, ay: def.ay, pieces: [], limbs: [], stride: 10, s: 1 };
  const AXS = CRIG_AX[side ? 'side' : 'front'], K = CRIG_K[side ? 'side' : 'front'];
  const M = { W, H, ax, ay: def.ay, orient: side ? 'side' : 'front', F: AXS.F, L: AXS.L, pieces: [], limbs: [], gy: def.ay + 1 };
  const parts = c.names.map((n, ord) => { const [base, sd] = n.split(':'); return { n, base, sd, ord, A: c.layers[n] }; });
  // solids first; the body's thickness sets how far apart near and far parts sit
  let hmax = 0;
  for (const q of parts) if (!/^(leg|arm|face)/.test(q.base)) {
    q.T = crigThick(q.A, W, H, (K[q.base] ?? K[crigJoint(q.base)] ?? K.def) * (q.base === 'body' ? c.depth || 1 : 1));
    if (q.base === 'body') for (const v of q.T) hmax = Math.max(hmax, v);
  }
  if (!hmax) for (const q of parts) if (q.T) for (const v of q.T) hmax = Math.max(hmax, v);
  let hh = 0;
  for (const q of parts) if (q.base === 'head' && q.T) for (const v of q.T) hh = Math.max(hh, v);
  const zs = Math.max(1, hmax * 0.9), zh = Math.max(1, (hh || hmax) * 0.8);
  const zOf = (sd, base) => { const z = base && crigJoint(base) === 'head' ? zh : zs; return sd === 'n' ? z : sd === 'f' ? -z : 0; };
  M.zs = zs;
  // the middle of the body, where roots are measured from
  let bu = 0, by = 0, bn = 0;
  const bodyQ = parts.find((q) => q.base === 'body');
  for (const q of bodyQ ? [bodyQ] : parts.filter((r) => r.T)) for (let i = 0; i < W * H; i++) if (q.A[i] >>> 24) { bu += (i % W) + 0.5 - ax; by += ((i / W) | 0) + 0.5; bn++; }
  M.bc = bn ? [bu / bn, by / bn, 0] : [0, H / 2, 0];
  M.hip = [M.bc[0], M.bc[1], 0];
  const nearest = (idx) => { let best = idx[0], bd = 1e9; for (const j of idx) { const d = Math.hypot((j % W) + 0.5 - ax - M.bc[0], ((j / W) | 0) + 0.5 - M.bc[1]); if (d < bd) { bd = d; best = j; } } return [(best % W) + 0.5 - ax, ((best / W) | 0) + 0.5, 0]; };
  // the pieces; wings and tails come apart into one piece each
  for (const q of parts) {
    if (!q.T) continue;
    const joint = crigJoint(q.base), zo = zOf(q.sd, q.base);
    const groups = joint === 'wing' || joint === 'tail' ? crigComps(q.A, W, H) : [[...Array(W * H).keys()].filter((i) => q.A[i] >>> 24)];
    for (const idx of groups) {
      if (!idx.length) continue;
      const pts = [], cols = [];
      for (const i of idx) {
        const x = i % W, y = (i / W) | 0, v = q.A[i], h = q.T[i], u = x + 0.5 - ax;
        const hn = Math.min(x > 0 && q.A[i - 1] >>> 24 ? q.T[i - 1] : 0, x < W - 1 && q.A[i + 1] >>> 24 ? q.T[i + 1] : 0);
        if (h < 0.7) { pts.push(u, y + 0.5, zo); cols.push(v); continue; }
        // only the skin: whatever the neighbours already cover cannot be seen from any side
        const n = Math.ceil((2 * h) / 0.7), lim = Math.min(hn, h) - 0.8;
        for (let k = 0; k <= n; k++) { const z = -h + (2 * h * k) / n; if (Math.abs(z) >= lim) { pts.push(u, y + 0.5, zo + z); cols.push(v); } }
      }
      const root = joint === 'body' ? M.hip : nearest(idx);
      let cu = 0;
      for (const i of idx) cu += (i % W) + 0.5 - ax;
      const lat = side ? (zo > 0 ? 1 : zo < 0 ? -1 : 1) : Math.sign(cu / idx.length - M.bc[0]) || 1;
      M.pieces.push({ n: q.n, joint, ord: q.ord, pts, cols, root, lat, zo });
    }
  }
  // faces sit on the skin of whatever they were painted on; seen from behind they are not there
  for (const q of parts) {
    if (q.base !== 'face') continue;
    for (let i = 0; i < W * H; i++) {
      const v = q.A[i];
      if (!(v >>> 24)) continue;
      const u = (i % W) + 0.5 - ax, y = ((i / W) | 0) + 0.5;
      let pc = null;
      for (const r of parts) if (r.T && r.ord < q.ord && r.A[i] >>> 24) pc = r;
      // the piece it belongs to; a wing or a tail split in two goes to the half whose root is closer
      let under = null, ud = 1e9;
      for (const m of M.pieces) if (pc ? m.n === pc.n : m.joint === 'body') { const d = Math.hypot(m.root[0] - u, m.root[1] - y); if (d < ud) { ud = d; under = m; } }
      if (!under) under = M.pieces[0];
      if (!under) continue;
      const h = pc ? pc.T[i] : 0.5;
      under.pts.push(u, y, under.zo + h + 0.35); under.cols.push(v);
      if (side) { under.pts.push(u, y, under.zo - h - 0.35); under.cols.push(v); }
    }
  }
  for (const pc of M.pieces) { pc.pts = Float32Array.from(pc.pts); pc.cols = Uint32Array.from(pc.cols); }
  const neck = M.pieces.find((m) => m.n === 'head');
  if (neck) for (const pc of M.pieces) if (pc.joint === 'head') pc.root = neck.root;
  // limbs: one texture each, straightened along the bones they hang on
  for (const q of parts) {
    if (!/^(leg|arm)/.test(q.base)) continue;
    const kind = q.base.startsWith('arm') ? 'arm' : 'leg', hints = (c.roots && c.roots[q.n]) || [];
    for (const idx of crigComps(q.A, W, H)) {
      const inC = new Set(idx), P = idx.map((i) => [(i % W) + 0.5, ((i / W) | 0) + 0.5]);
      let root = null, hd = 3.5;
      for (const [hx, hy] of hints) for (const [x, y] of P) { const d = Math.hypot(x - hx - 0.5, y - hy - 0.5); if (d < hd) { hd = d; root = [hx + 0.5, hy + 0.5]; } }
      if (!root) { let top = 1e9; for (const [, y] of P) top = Math.min(top, y); const row = P.filter(([, y]) => y === top); root = [row.reduce((s, [x]) => s + x, 0) / row.length, top - 0.5]; }
      // the foot is the middle of the lowest row, unless the limb reaches further sideways than down
      let foot = root, fd = -1, low = -1e9;
      for (const [, y] of P) low = Math.max(low, y);
      const bottom = P.filter(([, y]) => y === low), bx = bottom.reduce((s, [x]) => s + x, 0) / bottom.length;
      for (const p of P) { const d = Math.hypot(p[0] - root[0], p[1] - root[1]); if (d > fd) { fd = d; foot = p; } }
      if (low - root[1] >= Math.abs(foot[0] - root[0]) * 0.6) { foot = [bx, low]; fd = Math.hypot(foot[0] - root[0], foot[1] - root[1]); }
      // a limb a pixel long is too short to bend: it stays with the body
      if (fd < 1) { const b = M.pieces.find((m) => m.joint === 'body') || M.pieces[0]; if (b) for (const i of idx) { b.pts = Float32Array.from([...b.pts, (i % W) + 0.5 - ax, ((i / W) | 0) + 0.5, 0]); b.cols = Uint32Array.from([...b.cols, q.A[i]]); } continue; }
      const len0 = fd, dx = (foot[0] - root[0]) / len0, dy = (foot[1] - root[1]) / len0;
      // the bone runs to the far edge of the last pixel, not its middle
      foot = [foot[0] + dx * 0.5, foot[1] + dy * 0.5];
      // a knee only where the limb bends further than it is wide
      let knee = [(root[0] + foot[0]) / 2, (root[1] + foot[1]) / 2], kd = Math.max(1.5, P.length / Math.max(1, fd) / 2 + 1.2);
      for (const p of P) { const d = Math.abs((p[0] - root[0]) * dy - (p[1] - root[1]) * dx); if (d > kd) { kd = d; knee = p; } }
      const segs = [[root, knee], [knee, foot]].map(([a, b]) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6; return { a, ux: (b[0] - a[0]) / l, uy: (b[1] - a[1]) / l, l }; });
      const total = segs[0].l + segs[1].l;
      let wide = 0;
      for (const p of P) { let best = 1e9; for (const s of segs) { const t = clamp((p[0] - s.a[0]) * s.ux + (p[1] - s.a[1]) * s.uy, 0, s.l); best = Math.min(best, Math.hypot(p[0] - s.a[0] - s.ux * t, p[1] - s.a[1] - s.uy * t)); } wide = Math.max(wide, best); }
      const tw = clamp(Math.round(wide * 2 + 1), 1, 9), th = Math.max(2, Math.round(total)), px = new Uint32Array(tw * th);
      for (let r = 0; r < th; r++) {
        let s = ((r + 0.5) / th) * total, sg = segs[0];
        if (s > sg.l) { s -= sg.l; sg = segs[1]; }
        const X = sg.a[0] + sg.ux * s, Y = sg.a[1] + sg.uy * s;
        for (let j = 0; j < tw; j++) {
          const off = j + 0.5 - tw / 2, sx = Math.floor(X + sg.uy * off), sy = Math.floor(Y - sg.ux * off), k = sy * W + sx;
          if (sx >= 0 && sy >= 0 && sx < W && sy < H && inC.has(k)) px[r * tw + j] = q.A[k];
        }
      }
      const z = side ? zOf(q.sd || 'n') : 0, m = (p) => [p[0] - ax, p[1], z];
      M.limbs.push({ kind, sd: q.sd, ord: q.ord, pts: [m(root), m(knee), m(foot)], tex: { w: tw, h: th, px }, len: total });
    }
  }
  // gaits: legs alternate front to back and side to side, so diagonal pairs move together; arms swing against the legs
  const byU = (a, b) => a.pts[0][0] - b.pts[0][0];
  const legs = M.limbs.filter((l) => l.kind === 'leg'), arms = M.limbs.filter((l) => l.kind === 'arm');
  if (side) for (const sd of ['n', 'f']) { const g = legs.filter((l) => (l.sd || 'n') === sd).sort((a, b) => b.pts[0][0] - a.pts[0][0]); g.forEach((l, i) => { l.phase = Math.PI * ((i + (sd === 'f' ? 1 : 0)) % 2); }); }
  else legs.sort(byU).forEach((l, i) => { l.phase = Math.PI * (i % 2); });
  arms.sort(byU).forEach((l, i) => { l.phase = Math.PI * ((i + 1) % 2); });
  for (const l of M.limbs) if (l.phase == null) l.phase = 0;
  // gear rides the hand nearest to it
  for (const pc of M.pieces) if (pc.joint === 'gear' && arms.length) {
    let best = null, bd = 1e9;
    for (const l of arms) { const d = Math.hypot(l.pts[2][0] - pc.root[0], l.pts[2][1] - pc.root[1]); if (d < bd) { bd = d; best = l; } }
    pc.arm = best;
  }
  M.legless = !legs.length;
  M.flyer = M.pieces.some((p) => p.joint === 'wing');
  M.float = !!c.float;
  M.slither = !!c.slither;
  const ll = legs.length ? legs.reduce((s, l) => s + l.len, 0) / legs.length : 4;
  M.stride = Math.max(8, ll * 2.6);
  M.s = clamp(H / 18, 0.7, 2.4);
  return M;
}

/* ---------- clips: where every joint is, a moment at a time ---------- */
const CRIG_CLIPS = { idle: 4, walk: 8, run: 8, fly: 6, atk: 2, hurt: 1 };
function crigPose(M, clip, t, painted) {
  const ph = t * TAU, s = M.s;
  const P = { fwd: 0, bob: 0, lean: 0, sq: 0, head: 0, tail: 0, tailUp: 0, wing: 0, legs: M.limbs.map(() => [0, 0]), planted: true };
  if (clip === 'idle') {
    P.bob = -0.5 * s * (0.5 + 0.5 * Math.sin(ph)); P.head = 0.06 * Math.sin(ph + 1); P.tail = 0.22 * Math.sin(ph);
    if (M.flyer) P.wing = 0.18 * Math.sin(ph);
    if (M.float) P.bob = -1.2 * s * (0.5 + 0.5 * Math.sin(ph));
    else if (M.slither) { P.wave = ph; P.waveA = 0.6; }
    else if (M.legless) P.sq = 0.06 * Math.sin(ph);
    M.limbs.forEach((l, i) => { if (l.kind === 'arm') P.legs[i] = [0.05 * Math.sin(ph + l.phase), 0.1]; });
  } else if (clip === 'walk' || clip === 'run') {
    const run = clip === 'run', A = run ? 0.72 : 0.45, B = run ? 1.15 : 0.75;
    M.limbs.forEach((l, i) => {
      const p = ph + l.phase;
      P.legs[i] = l.kind === 'arm' ? [(run ? 0.7 : 0.4) * Math.sin(p), 0.25 + 0.25 * Math.max(0, Math.sin(p))] : [A * Math.sin(p), B * Math.max(0, Math.sin(p - 0.9))];
    });
    P.bob = -(run ? 1.1 : 0.55) * s * Math.abs(Math.sin(ph));
    P.lean = run ? 0.1 : 0.02; P.head = (run ? 0.08 : 0.05) * Math.sin(2 * ph); P.tail = (run ? 0.18 : 0.32) * Math.sin(ph); P.tailUp = run ? 0.2 : 0;
    if (M.flyer) P.wing = 0.55 * Math.sin(2 * ph);
    // floaters glide, leaning into it; serpents send a wave down their length; anything else with no legs hops, squashing as it lands
    if (M.slither) { P.wave = ph; P.waveA = run ? 2.2 : 1.6; }
    else if (M.float) { P.bob = -1.2 * s * (0.5 + 0.5 * Math.sin(ph)); P.lean = run ? 0.2 : 0.12; }
    else if (M.legless && !M.flyer) { const hop = Math.max(0, Math.sin(ph)); P.bob = -2 * s * hop * (run ? 1.3 : 1); P.sq = hop > 0.05 ? -0.08 * hop : 0.12 * Math.max(0, -Math.sin(ph)); }
  } else if (clip === 'fly') {
    P.wing = 0.8 * Math.sin(ph); P.bob = -1.2 * s * Math.sin(ph + 0.7); P.tail = 0.2 * Math.sin(ph); P.planted = false;
    M.limbs.forEach((l, i) => { P.legs[i] = l.kind === 'arm' ? [0.15 * Math.sin(ph), 0.3] : [-0.35, 0.6]; });
  } else if (clip === 'atk') {
    const strike = t >= 0.5;
    P.fwd = (strike ? 2 : -1) * s; P.lean = strike ? 0.12 : -0.1; P.head = strike ? 0.12 : -0.18;
    // the strike is the painter's own attack frame, so its arms stay where they were painted
    M.limbs.forEach((l, i) => { P.legs[i] = l.kind === 'arm' ? (painted ? [0, 0] : strike ? [0.9, 0.1] : [-0.7, 0.5]) : [strike ? 0.25 : -0.15, 0]; });
    if (M.flyer) P.wing = strike ? -0.4 : 0.6;
  } else if (clip === 'hurt') {
    P.fwd = -1.5 * s; P.lean = -0.14; P.head = -0.22; P.sq = 0.08;
    M.limbs.forEach((l, i) => { P.legs[i] = l.kind === 'arm' ? [-0.5, 0.8] : [0.2, 0.3]; });
    if (M.flyer) P.wing = 0.5;
  }
  return P;
}
function crigBodyXf(M, P) {
  const { F } = M;
  let m = mI();
  if (P.sq) m = mScale(1 + P.sq * 0.6, 1 - P.sq, 1 + P.sq * 0.6, [0, M.gy, 0]);
  if (P.lean) m = mMul(mTurn(F, CRIG_DOWN, -P.lean, M.hip), m);
  return mMul(mMove(F[0] * P.fwd, P.bob, F[2] * P.fwd), m);
}
// where each limb's root, knee and foot are, and how its lower bone turned (for whatever it holds)
function crigLimbPose(M, l, a, k) {
  const [R, K, Fo] = l.pts, m1 = mTurn(M.F, CRIG_DOWN, a, R), K1 = mApply(m1, K), m2 = mTurn(M.F, CRIG_DOWN, -k, K1);
  return { R, K: K1, F: mApply(m2, mApply(m1, Fo)), lower: mMul(m2, m1) };
}

/* ---------- drawing a pose seen from one direction ---------- */
// the camera looks down a little: what turns toward you sinks on the screen, what turns away rises. The picture
// as painted stays exactly as painted; only turning, and limbs reaching toward you, lean on the tilt
const CRIG_TILT = 0.42;
const crigTilt = (u, dz, cp, sp) => CRIG_TILT * (-u * sp + dz * cp);
function crigDraw(M, phi, P) {
  const pad = Math.ceil(Math.max(M.W, M.H) * 0.3) + 3, OW = M.W + pad * 2, OH = M.H + pad * 2;
  const out = new PP(OW, OH), Z = new Float32Array(OW * OH).fill(-1e9), part = new Uint8Array(OW * OH);
  const cp = Math.cos(phi), sp = Math.sin(phi), ox = M.ax + pad, oy = pad;
  const put = (x, y, v, d, kind) => { if (x < 0 || y < 0 || x >= OW || y >= OH) return; const i = y * OW + x; if (d > Z[i]) { Z[i] = d; out.d[i] = v; part[i] = kind; } };
  const body = crigBodyXf(M, P), L = M.L, F = M.F;
  const lp = M.limbs.map((l, i) => crigLimbPose(M, l, P.legs[i][0], P.legs[i][1]));
  for (const pc of M.pieces) {
    let j = mI();
    if (pc.joint === 'head') j = mTurn(F, CRIG_DOWN, -P.head, pc.root);
    else if (pc.joint === 'tail') j = mMul(mTurn(L, F, P.tail, pc.root), mTurn(F, CRIG_DOWN, -P.tailUp, pc.root));
    else if (pc.joint === 'wing') j = mTurn(L, CRIG_DOWN, P.wing * pc.lat, pc.root);
    else if (pc.joint === 'gear' && pc.arm) j = lp[M.limbs.indexOf(pc.arm)].lower;
    const m = mMul(body, j), pts = pc.pts, bias = pc.ord * 0.8 * cp, wa = P.waveA || 0;
    for (let i = 0, n = 0; i < pts.length; i += 3, n++) {
      const x = pts[i], y = pts[i + 1], z = pts[i + 2];
      const u2 = m[0] * x + m[1] * y + m[2] * z + m[3], y2 = m[4] * x + m[5] * y + m[6] * z + m[7] + (wa ? wa * 0.25 * Math.cos(x * 0.45 - P.wave) : 0);
      const z2 = m[8] * x + m[9] * y + m[10] * z + m[11] + (wa ? wa * Math.sin(x * 0.45 - P.wave) * clamp((M.W - M.ax - x) / M.W, 0.3, 1) : 0);
      put(Math.floor(u2 * cp + z2 * sp + ox), Math.floor(y2 + oy + crigTilt(u2, z2 - z, cp, sp)), pc.cols[n], -u2 * sp + z2 * cp + bias, 1);
    }
  }
  // close the pinholes a turn leaves in a solid
  for (let y = 0; y < OH; y++) for (let x = 1; x < OW - 1; x++) {
    const i = y * OW + x;
    if (part[i] || part[i - 1] !== 1 || part[i + 1] !== 1) continue;
    out.d[i] = Z[i - 1] >= Z[i + 1] ? out.d[i - 1] : out.d[i + 1]; Z[i] = Math.min(Z[i - 1], Z[i + 1]); part[i] = 2;
  }
  // limbs, on their bones
  M.limbs.forEach((l, i) => {
    const q = lp[i], bias = l.ord * 0.8 * cp;
    const R = mApply(body, q.R), K = mApply(body, q.K), Fo = P.planted && l.kind === 'leg' ? [q.F[0] + F[0] * P.fwd, q.F[1], q.F[2] + F[2] * P.fwd] : mApply(body, q.F);
    const proj = (p, rest) => [p[0] * cp + p[2] * sp + ox, p[1] + oy + crigTilt(p[0], p[2] - rest[2], cp, sp), -p[0] * sp + p[2] * cp];
    crigLimbDraw(l.tex, [proj(R, l.pts[0]), proj(K, l.pts[1]), proj(Fo, l.pts[2])], (x, y, v, d) => put(x, y, v, d + bias, 3));
  });
  out.outline();
  // trimmed to what was drawn, keeping the anchor
  let x0 = OW, x1 = -1, y0 = OH, y1 = -1;
  for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) if (out.d[y * OW + x] >>> 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const T = new PP(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) T.d[(y - y0) * T.w + x - x0] = out.d[y * OW + x];
  return T.sprite(ox - x0, M.ay + oy - y0);
}
// a texture laid along bones, with depth for every sample
function crigLimbDraw(tex, pts, put) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dx, dy);
    if (l > 1e-6) { segs.push([pts[i], pts[i + 1], dx / l, dy / l, l]); total += l; }
  }
  if (!segs.length) return;
  const { w, h, px } = tex;
  let si = 0, acc = 0;
  for (let s = 0; s < total; s += 0.5) {
    while (si < segs.length - 1 && s >= acc + segs[si][4]) { acc += segs[si][4]; si++; }
    const [o, e, ux, uy, l] = segs[si], u = s - acc, X = o[0] + ux * u, Y = o[1] + uy * u, D = o[2] + ((e[2] - o[2]) * u) / l, row = Math.min(h - 1, Math.floor((s / total) * h));
    for (let j = 0; j < 2 * w; j++) {
      const v = px[row * w + (j >> 1)];
      if (!(v >>> 24)) continue;
      const off = (j + 0.5) / 2 - w / 2;
      put(Math.floor(X + uy * off), Math.floor(Y - ux * off), v, D);
    }
  }
}

/* ---------- creatures painted from above turn in the plane they lie in ---------- */
function crigEpx(d, W, H) {
  const o = new Uint32Array(W * H * 4), W2 = W * 2, at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : d[y * W + x]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const P = d[y * W + x], A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
    o[2 * y * W2 + 2 * x] = C === A && C !== D && A !== B ? A : P;
    o[2 * y * W2 + 2 * x + 1] = A === B && A !== C && B !== D ? B : P;
    o[(2 * y + 1) * W2 + 2 * x] = D === C && D !== B && C !== A ? C : P;
    o[(2 * y + 1) * W2 + 2 * x + 1] = B === D && B !== A && D !== C ? D : P;
  }
  return o;
}
function crigSpin(P, ang, def) {
  // smoothed up four times, turned, then sampled back down: diagonals stay clean
  const W = P.w, H = P.h, big = crigEpx(crigEpx(P.d, W, H), W * 2, H * 2), W4 = W * 4, H4 = H * 4;
  const S = Math.ceil(Math.hypot(W, H)) + 2, out = new PP(S, S), cs = Math.cos(ang), sn = Math.sin(ang), cx = W / 2, cy = H / 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const rx = x + 0.5 - S / 2, ry = y + 0.5 - S / 2, sx = rx * cs + ry * sn + cx, sy = -rx * sn + ry * cs + cy;
    const bx = Math.floor(sx * 4), by = Math.floor(sy * 4);
    if (bx >= 0 && by >= 0 && bx < W4 && by < H4) out.d[y * S + x] = big[by * W4 + bx];
  }
  out.outline();
  return out.sprite(S / 2 - W / 2 + def.ax, S / 2 - H / 2 + def.ay);
}

/* ---------- baking: one clip in one direction at a time, within the frame's budget ---------- */
function crigAttach(fr, def) { if (!fr.crig) Object.defineProperty(fr, 'crig', { value: { def, models: {}, clips: new Map(), failed: false, orient: null }, enumerable: false }); return fr; }
function crigModelOf(S, f) { return S.models[f] || (S.models[f] = crigModel(S.def, f)); }
function crigBake(S, t, clip) {
  const def = S.def, n = CRIG_CLIPS[clip];
  const M = crigModelOf(S, 0);
  if (M.orient === 'top') {
    const ang = ((4 - t) * Math.PI) / 4 - (M.fwd || 0), src = (f) => { const P = new PP(def.w, def.h); def.paint(P, f); return P; };
    const pick = (i) => (clip === 'atk' && i === 1 ? def.atkF : clip === 'walk' || clip === 'run' || clip === 'fly' ? (i % 2 ? def.stepF ?? 1 : 0) : 0);
    const cache = {};
    return Array.from({ length: n }, (_, i) => { const f = pick(i); return cache[f] || (cache[f] = crigSpin(src(f), ang, def)); });
  }
  const phi = ((M.orient === 'side' ? t * 45 - 90 : t * 45) * Math.PI) / 180;
  return Array.from({ length: n }, (_, i) => {
    const painted = clip === 'atk' && i === 1 && def.atkF != null, Mi = painted ? crigModelOf(S, def.atkF) : M;
    return crigDraw(Mi, phi, crigPose(Mi, clip, i / n, painted));
  });
}
function crigFrame(fr, t, clip, i, lazy) {
  const S = fr && fr.crig;
  if (!S || S.failed || !crigOn()) return null;
  const key = t + clip;
  let arr = S.clips.get(key);
  if (!arr) {
    if (!rigBudgetOk(lazy)) return null;
    const now = performance.now();
    try { arr = crigBake(S, t, clip); } catch (e) { console.error(e); S.failed = true; return null; }
    S.clips.set(key, arr);
    RIG_BUDGET.spent += performance.now() - now;
  }
  return arr[((i % arr.length) + arr.length) % arr.length] || null;
}

/* ---------- monsters and Realm creatures: which way they look, what they are doing ---------- */
// how fast each one really moves, measured from where it was last frame, and how far it has walked
hook('update', (dt) => {
  if (!dt) return;
  const k = 1 - Math.exp(-dt * 10);
  for (const e of G.ents) {
    if (e._rx != null) {
      const dx = e.x - e._rx, dy = e.y - e._ry, d = Math.hypot(dx, dy);
      if (d < 40) { e.rigVx = lerp(e.rigVx || 0, dx / dt, k); e.rigVy = lerp(e.rigVy || 0, dy / dt, k); e.rigDist = (e.rigDist || 0) + d; }
    }
    e._rx = e.x; e._ry = e.y;
  }
});
// moving, it looks where it goes; standing, a foe watches you
function crigEntTurn(e) {
  const p = G.p, v = Math.hypot(e.rigVx || 0, e.rigVy || 0);
  let lx = null, ly = 0;
  if (v > 8) { lx = e.rigVx; ly = e.rigVy; }
  else if (p && !p.dead && e.type !== 'ally' && (!e.world || e.aggro)) { lx = p.x - e.x; ly = p.y - e.y; }
  if (lx != null && (Math.abs(lx) > 0.5 || Math.abs(ly) > 0.5)) e.rigT = pickTurn(e.rigT, lx, ly);
  return e.rigT ?? 2;
}
function crigEntClip(e, S) {
  const M = S.models[0];
  if (e.pose === 2) return ['atk', 1];
  if (e.pose === 1 || e.st === 'windup' || e.st === 'aim' || e.st === 'crouch' || e.st === 'raise' || e.st === 'swell') return ['atk', 0];
  if (e.freezeT > 0) return ['idle', 0];
  if (e.flash > 0 || e.stunT > 0) return ['hurt', 0];
  const v = Math.hypot(e.rigVx || 0, e.rigVy || 0);
  if (e.fly && (!M || M.flyer)) return ['fly', Math.floor(G.t * 10 + (e.anim || 0) * 6)];
  if (v > 6) return [v > 70 ? 'run' : 'walk', Math.floor(((e.rigDist || 0) / (M ? M.stride : 10)) * 8)];
  return ['idle', Math.floor(G.t * 2.2 + e.x * 0.05)];
}
function crigEntFrame(e) {
  if (!crigOn() || !e.frames || !e.frames.crig) return null;
  const [clip, i] = crigEntClip(e, e.frames.crig);
  return crigFrame(e.frames, crigEntTurn(e), clip, i, true);
}

/* ---------- playable beasts, yours and everyone else's ---------- */
function crigBeastFrame(p, fr) {
  if (!crigOn() || !fr || !fr.crig) return null;
  const t = Number.isFinite(p.turn) ? clamp(Math.round(p.turn), 0, 4) : 2, M = fr.crig.models[0], F = FORMS[p.form] || {};
  let clip = 'idle', i = Math.floor((G.t || 0) * 2.2 + (p.x || 0) * 0.05);
  if (p.dead) { clip = 'hurt'; i = 0; }
  else if (p.atkPose > 0 || p.leapT > 0 || p.bashT > 0) { clip = 'atk'; i = 1; }
  else if (p.dashT > 0) { clip = 'run'; i = 2; }
  else if (p.hurtT > 0.1) { clip = 'hurt'; i = 0; }
  else if (F.fly && (!M || M.flyer)) { clip = 'fly'; i = Math.floor((G.t || 0) * 10); }
  else if (p.moving) { const run = W.on && !W.inInst && (p.realmSpd || 1) > 1.15; clip = run ? 'run' : 'walk'; i = Math.floor((p.anim || 0) * (run ? 2.2 : 2.7)); }
  return crigFrame(fr, t, clip, i, !!p.rigLazy);
}
// the flinch a creature dies in, turned the way it was looking
function crigCorpse(e) {
  if (!crigOn() || !e.frames || !e.frames.crig || e.boss) return null;
  return crigFrame(e.frames, crigEntTurn(e), 'hurt', 0, false);
}
// your beast's clips bake while nothing is happening, the way you face first
let crigWarmT = 0;
hook('update', (dt) => {
  const p = G.p;
  if (!p || !p.beast || p.dead || !crigOn() || (crigWarmT -= dt) > 0) return;
  crigWarmT = 0.2;
  const fr = p.asc && p.asc.length && ASPECT[ascAspect(p)] ? ascBeastFrames(p.form, ascAspect(p), ascStage(p)) : beastFrames(p.form), S = fr.crig;
  if (!S || S.failed) return;
  for (const t of [Number.isFinite(p.turn) ? clamp(Math.round(p.turn), 0, 4) : 2, 0, 1, 2, 3, 4]) for (const clip in CRIG_CLIPS) if (!S.clips.has(t + clip)) { crigFrame(fr, t, clip, 0, false); return; }
});
const _beastFrameRig = beastFrame;
beastFrame = function (p) { return crigBeastFrame(p, beastFrames(p.form)) || _beastFrameRig(p); };

/* ---------- the mount gallops under you ---------- */
const _drawMountRig = drawMount;
drawMount = function (g, p, cx, cy) {
  const fr = mountFrames(), t = Number.isFinite(p.turn) ? clamp(Math.round(p.turn), 0, 4) : 2;
  const sp = crigFrame(fr, t, p.moving ? 'run' : 'idle', p.moving ? Math.floor((p.anim || 0) * 2.2) : Math.floor(G.t * 2.2), false);
  if (!sp) return _drawMountRig(g, p, cx, cy);
  drawSprite(g, sp, p.x - cx, p.y - cy + 2, p.face < 0, {});
};

/* ---------- trees and plants bend in the wind ---------- */
// how each part follows a bend: a trunk bends from its foot, a canopy rides its top and gives a little more,
// hanging strands swing further at their tips, fronds whip, stone never moves
const SWAY_FLEX = { trunk: [1, 0], canopy: [1.12, 0], strands: [1.12, 0.8], fronds: [1.45, 0], stone: [0, 0] };
const SWAY_N = 3;
// a painted thing baked bent a few steps each way; def: { key, w, h, ax, ay, paint(p) }
function swayFrames(def) {
  return spr('sway:' + def.key, () => {
    const { w, h, ax, ay } = def, c = crigCapture({ w, h, paint: def.paint }, 0), pad = 6, out = [];
    for (let b = -SWAY_N; b <= SWAY_N; b++) {
      const P = new PP(w + pad * 2, h), k = (b / SWAY_N) * Math.max(1.5, ay / 11);
      for (const n of c.names) {
        const A = c.layers[n], [fl, hang] = SWAY_FLEX[n] || SWAY_FLEX.trunk, tf = (y) => clamp((ay - y) / Math.max(1, ay), 0, 1);
        // hanging parts follow the bend where they hang from, and their tips swing further
        let top = 0;
        while (top < h - 1 && !A.slice(top * w, top * w + w).some((v) => v >>> 24)) top++;
        for (let y = 0; y < h; y++) {
          const t = tf(y), dx = Math.round(k * (hang ? fl * Math.pow(tf(top), 1.6) + hang * (tf(top) - t) * 1.5 : fl * Math.pow(t, 1.6)));
          for (let x = 0; x < w; x++) { const v = A[y * w + x]; if (v >>> 24) P.d[y * P.w + x + pad + dx] = v; }
        }
      }
      P.outline();
      const sp = P.sprite(ax + pad, ay);
      sp.baseW = w;
      out.push(sp);
    }
    // the two commonest colours of whatever is leafy, for the leaves that fall
    const tally = new Map();
    for (const n of ['canopy', 'fronds', 'strands']) { const A = c.layers[n]; if (A) for (const v of A) if (v >>> 24) tally.set(v, (tally.get(v) || 0) + 1); }
    out.leaf = [...tally.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, 2).map(([v]) => toHex(v & 255, (v >> 8) & 255, (v >> 16) & 255));
    return out;
  });
}
function treeFrames(kind, v) {
  const [w, h] = TREE_SIZE[kind] || [24, 32];
  return swayFrames({ key: `tree:${kind}:${v % 3}`, w, h, ax: Math.floor(w / 2), ay: h - 1, paint: (p) => paintTree(p, kind, v) });
}
// the wind: a slow lean with the weather, gusts that come and go, a shiver on top; storms blow harder
function windAt(x, y, o = {}) {
  const wx = W.on && W.Z ? W.Z.b.wx : '', gale = wx === 'blizzard' || wx === 'rain' || wx === 'sand' ? 1.9 : wx === 'leaves' || wx === 'petals' || wx === 'dust' || wx === 'ash' ? 1.3 : 1;
  const gust = 0.55 + 0.45 * Math.sin(G.t * 0.37 + x * 0.002);
  let v = ((Math.sin(G.t * 1.7 + x * 0.021 + y * 0.013) * 0.7 + Math.sin(G.t * 3.1 + x * 0.05) * 0.25) * gust + gust * 0.5) * gale;
  // a shake from a bump or a blow rings out
  if (o.shakeAt != null) { const k = 1 - (G.t - o.shakeAt) / 0.8; if (k > 0) v += Math.sin((G.t - o.shakeAt) * 28) * 3 * k * (o.shakeK || 1); }
  return v;
}
// shaken when you push past or swing at it, dropping leaves
function shakeObj(o, sp, k, leaf) {
  if (o.shakeAt != null && G.t - o.shakeAt < 0.35) return;
  o.shakeAt = G.t; o.shakeK = k;
  if (leaf && leaf.length && !CD.settings.lowFx) burst(o.x + rnd(-sp.w * 0.25, sp.w * 0.25), o.y, Math.round(3 + k * 4), leaf, { z: sp.h * 0.6, vz: 10, smin: 6, smax: 24, grav: 22, drag: 1.4, lmin: 1, lmax: 2, size: 1 });
}
let crigSwing = null;
hook('onAttack', (p) => { const a = p.aim || 0; crigSwing = { x: p.x + Math.cos(a) * 16, y: p.y - 4 + Math.sin(a) * 12, t: G.t }; });
function swayObj(o, sp) {
  const fr = o.kind === 'tree' ? treeFrames(o.tree, o.v) : null;
  if (!fr) return sp;
  const p = G.p, S = fr[SWAY_N];
  if (p && !p.dead) {
    if (p.moving && Math.abs(p.x - o.x) < Math.max(7, S.w * 0.22) && Math.abs(p.y - o.y) < 9) shakeObj(o, S, 0.6, fr.leaf);
    if (crigSwing && G.t - crigSwing.t < 0.12 && o.swungAt !== crigSwing.t && Math.hypot(crigSwing.x - o.x, crigSwing.y - (o.y - 6)) < 18) { o.swungAt = crigSwing.t; shakeObj(o, S, 1, fr.leaf); }
  }
  return fr[clamp(Math.round(windAt(o.x, o.y, o)), -SWAY_N, SWAY_N) + SWAY_N];
}

/* ---------- things that move: breakables shatter, lids swing, sails turn, signs and cloth stir ---------- */
// a crate, barrel or pot breaks into pieces of itself that tumble, bounce and fade
function crigShatter(x, y, sp) {
  if (!sp || CD.settings.lowFx) return;
  const cols = sp.w > 12 ? 3 : 2, rows = 2, pw = Math.ceil(sp.w / cols), ph = Math.ceil(sp.h / rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const c = mkCanvas(pw, ph), g = c.getContext('2d');
    g.drawImage(sp.c, i * pw, j * ph, pw, ph, 0, 0, pw, ph);
    const d = g.getImageData(0, 0, pw, ph).data;
    let any = false;
    for (let k = 3; k < d.length; k += 4) if (d[k]) { any = true; break; }
    if (!any) continue;
    const ox = i * pw + pw / 2 - sp.ax, oz = sp.ay - (j * ph + ph / 2), a = Math.atan2(-oz * 0.3, ox || rnd(-1, 1)), s = rnd(30, 70);
    G.fx.push({ kind: 'shard', c, w: pw, h: ph, x: x + ox, y, z: Math.max(1, oz), vx: Math.cos(a) * s, vy: rnd(-25, 25), vz: rnd(50, 110), rot: 0, vr: rnd(-12, 12), t: 0, life: 1.1, update: crigShardStep });
  }
}
function crigShardStep(f, dt) {
  f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.vz -= 320 * dt; f.rot += f.vr * dt;
  if (f.z <= 0) { f.z = 0; f.vz = Math.abs(f.vz) > 30 ? -f.vz * 0.35 : 0; f.vx *= 0.55; f.vy *= 0.55; f.vr *= 0.5; }
}
// pieces of a broken thing tumble through the air as cards lifted to their height
hook('renderCards', (card) => {
  for (const f of G.fx) {
    if (f.kind !== 'shard') continue;
    const s = Math.ceil(Math.hypot(f.w, f.h)) + 4;
    card(f, f.x, f.y, s, s, s / 2 - f.z, (g, cx, cy) => {
      g.save(); g.globalAlpha = clamp((f.life - f.t) / 0.35, 0, 1);
      g.translate(Math.round(f.x - cx), Math.round(f.y - cy - f.z)); g.rotate(f.rot);
      g.drawImage(f.c, -Math.round(f.w / 2), -Math.round(f.h / 2));
      g.restore();
    });
  }
});
const _breakPropRig = breakProp;
breakProp = function (pr) {
  const was = pr.broken, kind = pr.kind, v = pr.v || 0;
  _breakPropRig(pr);
  if (!was && pr.broken && !pr.explosive && crigOn() && G.fl) crigShatter(pr.x, pr.y, propSprite(kind, G.fl.actIdx, v));
};

// a lid that was seen shut swings up on its hinge when it opens, and settles
function chestSwing(o, opened) {
  if (!opened) { o.seenShut = true; o.openAt = null; return 0; }
  if (!o.seenShut || !crigOn()) return 3;
  if (o.openAt == null) o.openAt = G.t;
  const k = (G.t - o.openAt) / 0.24;
  return k < 0.4 ? 1 : k < 0.8 ? 2 : 3;
}

// cloth hanging from its top ripples down its length
function waveFrames(sp, key, n = 4) {
  return spr('wave:' + key, () => {
    const src = mkCanvas(sp.w, sp.h).getContext('2d');
    src.drawImage(sp.c, 0, 0);
    const d = new Uint32Array(src.getImageData(0, 0, sp.w, sp.h).data.buffer);
    return Array.from({ length: n }, (_, f) => {
      const P = new PP(sp.w + 2, sp.h);
      for (let y = 0; y < sp.h; y++) {
        const dx = Math.round(Math.sin(y * 0.55 - (f / n) * TAU) * Math.min(1, y / 5));
        for (let x = 0; x < sp.w; x++) { const v = d[y * sp.w + x]; if (v >>> 24) P.d[y * P.w + x + 1 + dx] = v; }
      }
      return P.sprite(sp.ax + 1, sp.ay);
    });
  });
}
// anything that grows from the ground bends with the wind as one piece
function bendFrames(sp, key) {
  // the outline comes off before bending; the bent picture gets a fresh one
  const ol = PP.pack(OUTLINE);
  return swayFrames({ key, w: sp.w, h: sp.h, ax: sp.ax, ay: sp.ay, paint: (p) => {
    const g = mkCanvas(sp.w, sp.h).getContext('2d');
    g.drawImage(sp.c, 0, 0);
    const d = new Uint32Array(g.getImageData(0, 0, sp.w, sp.h).data.buffer);
    rigPart(p, 'canopy');
    for (let i = 0; i < d.length; i++) if (d[i] >>> 24 && d[i] !== ol) crigPut(p, i % sp.w, (i / sp.w) | 0, d[i]);
  } });
}

// windmill sails, painted at each step of a quarter turn so they stay crisp
const MILL_STEPS = 12;
function millSails(f) {
  return spr('mill:' + f, () => { const p = new PP(40, 40); paintMill(p, 0.4 + (f / MILL_STEPS) * (Math.PI / 2), true); p.outline(); return p.sprite(20, 20); });
}
function millBody() { return spr('mill:body', () => { const p = new PP(40, 52); paintMill(p, 0, false, true); p.outline(); return p.sprite(20, 51); }); }

// shop signs swing on their brackets
const SIGN_STEPS = 3;
function signSprite(type, step) {
  return spr(`sign:${type}:${step}`, () => {
    // a small swing is a shear: each row of the board slides a little further than the one above
    const p = new PP(16, 10), ic = SIGN_ICON[type], at = (y) => Math.round((step / SIGN_STEPS) * 2.2 * (y / 8));
    const R = (x, y, w, h, c) => { for (let j = 0; j < h; j++) p.rect(x + at(y + j), y + j, w, 1, c); };
    R(3, 0, 10, 9, '#5a3a22'); R(4, 1, 8, 7, '#8a6a42');
    if (ic) ic.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '1') p.px(5 + i + at(2 + j), 2 + j, SIGN_COL[type] || '#ffffff'); });
    p.outline();
    return p.sprite(8, 0);
  });
}

// what the Realm draws when it is rigged: trees bend, chests open on hinges, sails turn, signs swing, awnings flutter
const _drawRealmObjRig = drawRealmObj;
drawRealmObj = function (g, o, sp, cx, cy, faded) {
  if (!crigOn()) return _drawRealmObjRig(g, o, sp, cx, cy, faded);
  if (o.kind === 'tree') return _drawRealmObjRig(g, o, swayObj(o, sp), cx, cy, faded);
  if (o.kind === 'chest') { const st = chestSwing(o, sp === chestSprite(o.chest.tier, true)); return _drawRealmObjRig(g, o, st && st < 3 ? chestLidSprite(o.chest.tier, st) : sp, cx, cy, faded); }
  if (o.kind === 'stall') return _drawRealmObjRig(g, o, propArt('stall', o.v % 4, String(Math.floor(G.t * 5 + o.x * 0.1) % 6)), cx, cy, faded);
  if (o.kind === 'mark' && o.mk === 'windmill') {
    _drawRealmObjRig(g, o, millBody(), cx, cy, faded);
    const S = millSails(Math.floor(G.t * 9 + o.x) % MILL_STEPS);
    g.globalAlpha = faded ? 0.45 : 1; g.drawImage(S.c, Math.round(o.x - cx) - 20, Math.round(o.y - cy) - 51 + 16 - 20); g.globalAlpha = 1;
    return;
  }
  if (o.kind === 'building' && o.bld && SIGN_ICON[o.bld.type]) {
    const base = buildingSprite(o.bld, true);
    _drawRealmObjRig(g, o, base, cx, cy, faded);
    if (base.sign) {
      const w = windAt(o.x, o.y), step = clamp(Math.round(w * 0.9), -SIGN_STEPS, SIGN_STEPS), S = signSprite(o.bld.type, step);
      g.globalAlpha = faded ? 0.45 : 1; g.drawImage(S.c, Math.round(o.x - cx - base.ax + base.sign.x - S.ax), Math.round(o.y - cy - base.ay + base.sign.y - S.ay)); g.globalAlpha = 1;
    }
    return;
  }
  return _drawRealmObjRig(g, o, sp, cx, cy, faded);
};

/* ---------- grass, flowers, reeds and crops sway, and part around you ---------- */
const LIVE_DECO = new Set(['flower', 'flower2', 'tuft', 'tallgrass', 'fern', 'reed', 'crop', 'lily']);
hook('renderFloor', (g, cx, cy) => {
  if (!(W.on && !W.inInst && W.Z && G.fl && G.fl.realm)) return;
  // the ground was baked with or without them; when the setting changes, bake it again
  if (W.blocksRig !== crigOn()) { W.blocksRig = crigOn(); W.blocks.clear(); return; }
  if (!crigOn()) return;
  const Z = W.Z, b = Z.b, names = DECO_NAME(), p = G.p;
  const tx0 = Math.max(0, Math.floor(cx / TS)), ty0 = Math.max(0, Math.floor(cy / TS)), tx1 = Math.min(ZT - 1, Math.floor((cx + R.VW) / TS)), ty1 = Math.min(ZT - 1, Math.floor((cy + R.VH) / TS));
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const k = ty * ZT + tx, dc = Z.deco[k];
    if (!dc || dc >= 250 || Z.tiles[k] === TILE.TREE || !LIVE_DECO.has(names[dc])) continue;
    const x = tx * TS, y = ty * TS, h = tileHash(Z.seed, tx, ty);
    // the wind leans the tops; walking through pushes them aside
    let s = windAt(x, y) * 0.45;
    const dx = x + 8 - p.x, dy = y + 10 - p.y;
    if (Math.abs(dx) < 11 && Math.abs(dy) < 8) s = Math.sign(dx || 1) * 2.2;
    drawDecoBent(g, names[dc], x - cx, y - cy, h, b, clamp(Math.round(s), -2, 2));
  }
});
// a decoration whose upper rows lean by s pixels
function drawDecoBent(g, kind, x, y, h, b, s) {
  if (!s) return drawDeco(g, kind, x, y, h, b);
  const fill = g.fillRect;
  g.fillRect = function (X, Y, w, hh) {
    // rows above the stem's middle lean the whole way, the middle half way, the foot not at all
    const top = Y - y, lean = top < 5 ? s : top < 8 ? Math.round(s / 2) : 0;
    if (hh > 3 && lean) { const cut = Math.max(1, 8 - top); fill.call(this, X + lean, Y, w, Math.min(hh, cut)); if (hh > cut) fill.call(this, X, Y + cut, w, hh - cut); return; }
    fill.call(this, X + lean, Y, w, hh);
  };
  try { drawDeco(g, kind, x, y, h, b); } finally { g.fillRect = fill; }
}

