/* ============================================================
   Cinderdeep — heroes that turn. Bodies are painted from the
   front and from behind, and while they are painted every part
   lands on a layer of its own. A turned view rebuilds the body
   the way a sprite rig does: heads and torsos wrap round like
   lathed shapes (the face slides toward where you look and the
   far side tucks away), arms and legs swing round the middle,
   capes and wings hang behind. Five baked turns, mirrored,
   cover eight directions.
   ============================================================ */
const RIG_YAW = [0, 45, 90, 135, 180];
// lathed parts: [how deep for their width, how flat the face reads]
const RIG_LATHE = { skirt: [0.74, 0.6], torso: [0.62, 0.55], head: [1, 0.6] };
const RIG_LIMB = ['paul', 'arms', 'legs'];
function rigClaim(P) {
  if (P.cap !== undefined) return P.cap;
  const c = rigPart.arm;
  if (!c) return null;
  rigPart.arm = null;
  c.w = P.w; c.h = P.h; c.own = new Uint8Array(P.w * P.h);
  P.cap = c;
  return c;
}
// painters name the part they are about to paint; outside a capture this does nothing
function rigPart(P, part) { const c = rigClaim(P); if (c) c.part = part; }
const _pxRig = PP.prototype.px;
PP.prototype.px = function (x, y, hex, a = 255) {
  const c = this.cap;
  if (!c) return _pxRig.call(this, x, y, hex, a);
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= this.w || y >= this.h || !hex) return;
  const i = y * this.w + x, v = hex === '#00000000' ? 0 : PP.pack(hex, a);
  this.d[i] = v;
  // touch-ups (rim light, seams) belong to whatever part is already there
  let n = c.part;
  if (n === 'auto') { const o = c.own[i]; if (!o) return; n = c.names[o - 1]; }
  let k = c.names.indexOf(n);
  if (k < 0) { k = c.names.push(n) - 1; c.layers[n] = new Uint32Array(this.w * this.h); }
  c.layers[n][i] = v;
  if (v) c.own[i] = k + 1;
};
function rigCapture(fn) {
  const c = { part: 'body', names: [], layers: Object.create(null) };
  rigPart.arm = c;
  try { fn(); } catch (e) { return null; } finally { rigPart.arm = null; }
  return c.own ? c : null;
}
// a set of front and back frames learns how to paint itself again, for turning and for the skeleton
function rigSet(set, paint) { Object.defineProperty(set, 'paint', { value: paint, enumerable: false }); return set; }
// townsfolk and other heroes bake a few clips at a time, so a crowded square never stalls a frame
const RIG_BUDGET = { at: 0, spent: 0 };
function rigBudgetOk(lazy) {
  if (!lazy) return true;
  const now = performance.now();
  if (now - RIG_BUDGET.at > 30) { RIG_BUDGET.at = now; RIG_BUDGET.spent = 0; }
  return RIG_BUDGET.spent <= 4;
}
// 0 faces the camera, 2 is side on, 4 faces away; a little stickiness stops flicker at the edges
function pickTurn(cur, dx, dy) {
  const th = Math.atan2(Math.abs(dx), dy) / (Math.PI / 4);
  if (cur != null && Math.abs(th - cur) < 0.65) return cur;
  return clamp(Math.round(th), 0, 4);
}
function heroTurn(p) {
  const t = p.turn;
  if (CD.settings.turn8 === false || typeof t !== 'number' || !Number.isFinite(t)) return p.view === 'back' ? 4 : 0;
  return clamp(Math.round(t), 0, 4);
}

/* ---------- the skeleton: the Sprite Rig's clips, in rig units (legs 20 tall, arms 14 long) ---------- */
const RIG_CLIPS = { idle: 4, walk: 8, run: 8, dash: 1, hurt: 1 };
const RIG_CE = Math.cos((28 * Math.PI) / 180), RIG_SE = Math.sin((28 * Math.PI) / 180);
const rigBone = (ang, len) => [0, -len * Math.cos(ang), len * Math.sin(ang)];
const v3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
function rigSkel(clip, t) {
  const Lg = {}, Ar = {};
  let hy = 20, lean = 0, breath = 0;
  if (clip === 'walk' || clip === 'run' || clip === 'dash') {
    const run = clip !== 'walk', ph = (clip === 'dash' ? 0.3 : t) * TAU;
    hy = run ? 18.6 + 1.3 * Math.cos(2 * ph) : 20 + 0.8 * Math.cos(2 * ph);
    lean = clip === 'dash' ? 3.6 : run ? 2.4 : 0.3;
    for (const [s, off] of [['L', 0], ['R', Math.PI]]) {
      const p = ph + off;
      Lg[s] = run ? [0.95 * Math.sin(p), 1.45 * Math.max(0, Math.sin(p - 0.7)) + 0.2] : [0.55 * Math.sin(p), 0.85 * Math.max(0, Math.sin(p - 0.9))];
      Ar[s] = run ? [-0.95 * Math.sin(p), 1.35 + 0.25 * Math.max(0, Math.sin(p))] : [-0.5 * Math.sin(p), 0.45 + 0.3 * Math.max(0, Math.sin(p))];
    }
  } else if (clip === 'hurt') {
    // knocked back on its heels, arms thrown up
    hy = 19.3; lean = -1.8;
    for (const s of ['L', 'R']) { Lg[s] = [0.12, 0.4]; Ar[s] = [-0.45, 1]; }
  } else {
    // breathing
    const ph = t * TAU;
    hy = 20 + 0.15 * Math.sin(ph); breath = 0.75 * Math.sin(ph);
    for (const s of ['L', 'R']) { Lg[s] = [0.02, 0.05]; Ar[s] = [0.06 + 0.04 * Math.sin(ph), 0.18 + 0.06 * Math.sin(ph)]; }
  }
  const j = {};
  for (const [s, sx] of [['L', -1], ['R', 1]]) {
    const [a, k] = Lg[s], [sw, fe] = Ar[s];
    const hp = [sx * 3, hy, 0], kn = v3(hp, rigBone(a, 10)), ft = v3(kn, rigBone(a - k, 10));
    const sh = [sx * 5, hy + 10 + breath, 1], el = v3(sh, rigBone(sw, 7)), ha = v3(el, rigBone(sw + fe, 7));
    Object.assign(j, { ['hp' + s]: hp, ['kn' + s]: kn, ['ft' + s]: ft, ['sh' + s]: sh, ['el' + s]: el, ['ha' + s]: ha });
  }
  return { hy, lean, breath, j };
}
// which clip and frame a hero shows right now
function rigClipOf(p) {
  if (p.dead) return ['idle', 0];
  if (p.dashT > 0 || p.leapT > 0 || p.bashT > 0) return ['dash', 0];
  if (p.hurtT > 0.1) return ['hurt', 0];
  if (p.moving && !p.mounted) { const run = W.on && !W.inInst && (p.realmSpd || 1) > 1.15; return [run ? 'run' : 'walk', Math.floor((p.anim || 0) * (run ? 2.2 : 2.7)) % 8]; }
  return ['idle', ((Math.floor((G.t || 0) * 2.2 + (p.x || 0) * 0.05) % 4) + 4) % 4];
}
// your own hero holds the weapon with a live arm; townsfolk and other heroes keep both arms baked
const rigArmSide = (p, t) => (p === G.p && !p.dead && p.weapon && !p.beast && !p.sheet ? (t === 0 ? 'L' : 'R') : '');
function rigStore(set) {
  if (!set.rig) Object.defineProperty(set, 'rig', { value: { caps: null, bodies: [], clips: new Map(), failed: false }, enumerable: false });
  return set.rig;
}
function rigFrame(set, t, clip, f, arm, lazy) {
  if (!set.paint) return null;
  const R = rigStore(set);
  if (R.failed) return null;
  const key = t + clip + arm;
  let fr = R.clips.get(key);
  if (!fr) {
    if (!rigBudgetOk(lazy)) return null;
    const now = performance.now();
    try {
      if (!R.caps) {
        const F = rigCapture(() => set.paint('front', 0)), B = rigCapture(() => set.paint('back', 0));
        if (!F || !B) { R.failed = true; return null; }
        R.caps = { F, B };
      }
      const body = R.bodies[t] || (R.bodies[t] = rigTurnBody(R.caps.F, R.caps.B, RIG_YAW[t], set.front[0]));
      fr = Array.from({ length: RIG_CLIPS[clip] }, (_, i) => rigPose(body, clip, i / RIG_CLIPS[clip], set.front[0], arm));
    } catch (e) { console.error(e); R.failed = true; return null; }
    R.clips.set(key, fr);
    RIG_BUDGET.spent += performance.now() - now;
  }
  return fr[f % fr.length];
}
function rigHeroFrame(set, p, fi, lazy = p.rigLazy) {
  if (CD.settings.turn8 === false || !set.paint) return (p.view === 'back' ? set.back : set.front)[fi];
  const t = heroTurn(p), [clip, f] = rigClipOf(p);
  return rigFrame(set, t, clip, f, rigArmSide(p, t), lazy) || (t >= 3 ? set.back : set.front)[fi];
}
// the frames your hero will need are baked while nothing is happening, one clip at a time, the way you face first
function rigHeroSet(p) {
  if (p.beast || p.sheet) return null;
  if (p.asc && p.asc.length && ASPECT[ascAspect(p)]) return ascFramesFor(p);
  return heroSprites(p.look, p.cls + (p.dyeKey ? ':' + p.dyeKey : ''));
}
let rigWarmT = 0;
hook('update', (dt) => {
  const p = G.p;
  if (!p || p.dead || CD.settings.turn8 === false || (rigWarmT -= dt) > 0) return;
  rigWarmT = 0.2;
  const set = rigHeroSet(p);
  if (!set) return;
  const R = rigStore(set);
  for (const t of [heroTurn(p), 0, 1, 2, 3, 4]) for (const clip in RIG_CLIPS) if (!R.clips.has(t + clip + rigArmSide(p, t))) { rigFrame(set, t, clip, 0, rigArmSide(p, t), false); return; }
});

// the body turned to one of the five baked directions, without its limbs; the limbs come back as textures for the skeleton to carry
function rigTurnBody(F, B, phi, base) {
  const W = F.w, H = F.h, cx = base.ax;
  const back = phi > 90, S = back ? B : F, O = back ? F : B;
  const yaw = ((back ? phi - 180 : phi) * Math.PI) / 180, cs = Math.cos(yaw), sn = Math.sin(yaw), asn = Math.abs(sn);
  const L = { under: new Uint32Array(W * H), core: new Uint32Array(W * H), over: new Uint32Array(W * H), top: new Uint32Array(W * H) };
  let tgt = L.core;
  const put = (x, y, v) => { if (v >>> 24 && x >= 0 && y >= 0 && x < W && y < H) tgt[y * W + x] = v; };
  const side = (x) => (x + 0.5 < cx ? -1 : 1);
  // how far the torso reaches, for where capes and wings hang
  let tr = 0;
  for (const C of [S, O]) { const T = C.layers.torso; if (T) for (let i = 0; i < T.length; i++) if (T[i] >>> 24) tr = Math.max(tr, Math.abs((i % W) + 0.5 - cx)); }
  if (!tr) tr = W / 4;
  // a lathed part: every row turns round the middle; front pixels come from the front painting, the far side from the back one
  const lathe = (n, depth, flat) => {
    const As = S.layers[n], Ao = O.layers[n];
    if (!As && !Ao) return;
    const pr = new Float32Array(W), col = new Uint32Array(W);
    const span = (A, y) => { let x0 = W, x1 = -1; if (A) for (let x = 0; x < W; x++) if (A[y * W + x] >>> 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; } return [x0, x1]; };
    for (let y = 0; y < H; y++) {
      // the radius comes from the nearer painting, and from its narrower side, so a ribbon or a feather does not stretch the whole head
      let [x0, x1] = span(As, y);
      if (x1 < 0) [x0, x1] = span(Ao, y);
      if (x1 < 0) continue;
      const lo = cx - x0, hi = x1 + 1 - cx, rx = Math.max(1, Math.min(lo, hi) >= 1 ? Math.min(lo, hi) : Math.max(lo, hi));
      const del = Math.atan2(rx * flat * sn, rx * cs), ws = Math.hypot(rx * cs, rx * depth * sn);
      pr.fill(-1);
      // whatever sticks out past the radius swings round whole, in front of the row or behind it
      const under = [], over = [];
      const emit = (A, far) => {
        if (!A) return;
        for (let x = 0; x < W; x++) {
          const v = A[y * W + x];
          if (!(v >>> 24)) continue;
          const d = x + 0.5 - cx;
          if (Math.abs(d) > rx + 0.01) { const z = far ? d * sn : -d * sn; (z > 0 ? over : under).push([Math.floor(cx + (far ? -d : d) * cs), v]); continue; }
          const u0 = clamp((x - cx) / rx, -1, 1), u1 = clamp((x + 1 - cx) / rx, -1, 1);
          let b0 = (far ? Math.PI : 0) + Math.asin(u0) + del, b1 = (far ? Math.PI : 0) + Math.asin(u1) + del;
          if ((b0 + b1) / 2 > Math.PI) { b0 -= TAU; b1 -= TAU; }
          b0 = Math.max(b0, -Math.PI / 2); b1 = Math.min(b1, Math.PI / 2);
          if (b1 <= b0) continue;
          const c = Math.cos((b0 + b1) / 2);
          if (c <= 0.04) continue;
          const p0 = cx + ws * Math.sin(b0), p1 = cx + ws * Math.sin(b1);
          for (let ox = Math.ceil(p0 - 0.5); ox + 0.5 < p1; ox++) if (ox >= 0 && ox < W && c > pr[ox]) { pr[ox] = c; col[ox] = v; }
        }
      };
      emit(As, false); emit(Ao, true);
      for (let x = 1; x < W - 1; x++) if (pr[x] < 0 && pr[x - 1] >= 0 && pr[x + 1] >= 0) { pr[x] = 0; col[x] = col[pr[x - 1] >= pr[x + 1] ? x - 1 : x + 1]; }
      for (const [x, v] of under) put(x, y, v);
      for (let x = 0; x < W; x++) if (pr[x] >= 0) put(x, y, col[x]);
      for (const [x, v] of over) put(x, y, v);
    }
  };
  // capes and wings hang behind: narrower side on, and toward the back
  const hang = (A) => {
    if (!A) return;
    const k = 0.55 + 0.45 * Math.abs(cs), sh = -Math.round(tr * 0.8 * asn);
    for (let i = 0; i < A.length; i++) {
      const v = A[i];
      if (!(v >>> 24)) continue;
      const x = i % W, y = (i / W) | 0, p0 = cx + (x - cx) * k + sh, p1 = cx + (x + 1 - cx) * k + sh;
      for (let ox = Math.ceil(p0 - 0.5); ox + 0.5 < p1; ox++) put(ox, y, v);
    }
  };
  if (!back) { tgt = L.under; hang(S.layers.wing); hang((phi >= 67 ? B : F).layers.cape); }
  else {
    // seen from behind, a cape painted under the torso stays under it; one painted over it stays over
    tgt = S.names.indexOf('cape') > S.names.indexOf('torso') ? L.over : L.under; hang(S.layers.cape);
    tgt = L.top; hang(S.layers.wing);
  }
  tgt = L.core;
  for (const n in RIG_LATHE) lathe(n, RIG_LATHE[n][0], RIG_LATHE[n][1]);
  for (const n of ['body', 'crown']) { const A = S.layers[n]; if (A) for (let i = 0; i < A.length; i++) put(i % W, (i / W) | 0, A[i]); }
  // each arm, leg and pauldron becomes a texture, top row at the joint it hangs from
  const limbs = [];
  for (const n of RIG_LIMB) {
    const A = S.layers[n];
    if (!A) continue;
    for (const sd of [-1, 1]) {
      let x0 = W, x1 = -1, y0 = H, y1 = -1;
      for (let i = 0; i < A.length; i++) if (A[i] >>> 24) { const x = i % W, y = (i / W) | 0; if (side(x) !== sd) continue; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) continue;
      const w = x1 - x0 + 1, h = y1 - y0 + 1, px = new Uint32Array(w * h);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const v = A[y * W + x]; if (v >>> 24 && side(x) === sd) px[(y - y0) * w + (x - x0)] = v; }
      // screen-left in the front painting is the hero's right side; in the back painting it is the left
      const d = Math.abs((x0 + x1 + 1) / 2 - cx), rs = back ? (sd < 0 ? 'L' : 'R') : (sd < 0 ? 'R' : 'L');
      limbs.push({ n, side: rs, X: rs === 'R' ? d : -d, y0, tex: { w, h, px } });
    }
  }
  const leg = limbs.find((l) => l.n === 'legs');
  return { W, H, cx, back, rel: ((180 - phi) * Math.PI) / 180, L, limbs, legH: leg ? leg.tex.h : 5 };
}
// a texture laid along a chain of bones: rows follow the bones, columns run across them
function rigLimbDraw(tex, pts, put, dark) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dx, dy);
    if (l > 1e-6) { segs.push([pts[i], dx / l, dy / l, l]); total += l; }
  }
  if (!segs.length) return;
  const { w, h, px } = tex;
  let si = 0, acc = 0;
  for (let s = 0; s < total; s += 0.5) {
    while (si < segs.length - 1 && s >= acc + segs[si][3]) { acc += segs[si][3]; si++; }
    const [o, ux, uy] = segs[si], u = s - acc, X = o[0] + ux * u, Y = o[1] + uy * u, row = Math.min(h - 1, Math.floor((s / total) * h));
    for (let j = 0; j < 2 * w; j++) {
      const v = px[row * w + (j >> 1)];
      if (!(v >>> 24)) continue;
      const off = (j + 0.5) / 2 - w / 2;
      put(Math.floor(X + uy * off), Math.floor(Y - ux * off), dark ? rigDark(v) : v);
    }
  }
}
const rigDark = (v) => ((v & 0xff000000) | ((((v >> 16) & 255) * 0.8) << 16) | ((((v >> 8) & 255) * 0.8) << 8) | ((v & 255) * 0.8)) >>> 0;
// one frame of a clip: the turned body rides the skeleton's hips and chest, the limbs follow its bones
function rigPose(TB, clip, t, base, arm) {
  const { W, H, cx, rel, L, back } = TB, out = new PP(W, H), cr = Math.cos(rel), sr = Math.sin(rel);
  const put = (x, y, v) => { if (v >>> 24 && x >= 0 && y >= 0 && x < W && y < H) out.d[y * W + x] = v; };
  const S = rigSkel(clip, t), J = S.j;
  // pixels per rig unit; small bodies get their bob and lean rounded up to a whole pixel
  const kL = TB.legH / (20 * RIG_CE), vb = Math.max(kL * RIG_CE, 0.75), hb = Math.max(kL, 0.42);
  const cY = S.hy - 20 + S.breath, cZ = S.lean * 0.6;
  const bdx = Math.round(cZ * sr * hb), bdy = Math.round(-cY * vb - cZ * cr * RIG_SE * hb);
  const blit = (A) => { for (let i = 0; i < A.length; i++) if (A[i] >>> 24) put((i % W) + bdx, ((i / W) | 0) + bdy, A[i]); };
  const proj = (o, d, k) => [o[0] + d[2] * sr * k, o[1] + (-d[1] * RIG_CE - d[2] * cr * RIG_SE) * k];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const turned = Math.abs(sr) > 0.01 && Math.abs(cr) < 0.99;
  let meta = null;
  const limb = (l) => {
    const { tex } = l, cxL = cx + l.X * cr, dark = turned && l.near < -0.01;
    if (l.n === 'paul') { const x0 = Math.round(cxL - tex.w / 2) + bdx; for (let i = 0; i < tex.px.length; i++) put(x0 + (i % tex.w), l.y0 + bdy + ((i / tex.w) | 0), dark ? rigDark(tex.px[i]) : tex.px[i]); return; }
    const s = l.side;
    if (l.n === 'legs') {
      // the hip rides the body; the foot stays planted on the ground the skeleton walks on
      const k = kL, hp = J['hp' + s], p0 = [cxL, l.y0 + bdy];
      rigLimbDraw(tex, [p0, proj(p0, sub(J['kn' + s], hp), k), proj([cxL, l.y0], sub(J['ft' + s], [hp[0], 20, 0]), k)], put, dark);
      return;
    }
    const k = tex.h / (14 * RIG_CE), sh = J['sh' + s], p0 = [cxL + bdx, l.y0 + bdy];
    if (arm && s === arm) { meta = { x: p0[0], y: p0[1], tex, len: tex.h }; return; }
    rigLimbDraw(tex, [p0, proj(p0, sub(J['el' + s], sh), k), proj(p0, sub(J['ha' + s], sh), k)], put, dark);
  };
  const limbs = TB.limbs.map((l) => ({ ...l, near: l.X * sr })).sort((a, b) => a.near - b.near);
  const far = limbs.filter((l) => l.near < -0.01), near = limbs.filter((l) => l.near >= -0.01);
  if (!back) {
    blit(L.under);
    far.forEach(limb); near.filter((l) => l.n === 'legs').forEach(limb);
    blit(L.core);
    near.filter((l) => l.n !== 'legs').forEach(limb);
  } else {
    far.forEach(limb); near.filter((l) => l.n === 'legs').forEach(limb);
    blit(L.under); blit(L.core); blit(L.over);
    near.filter((l) => l.n !== 'legs').forEach(limb);
    blit(L.top);
  }
  out.outline();
  const sp = out.sprite(base.ax, base.ay);
  for (const k of ['handY', 'handR', 'top', 'u']) if (base[k] != null) sp[k] = base[k];
  if (meta) sp.rigArm = meta;
  return sp;
}

/* ---------- the arm that holds your weapon reaches for it, every frame ---------- */
function drawRigArm(g, p, x, y) {
  if (p.beast || p.sheet || p.dead || !p.weapon || CD.settings.turn8 === false) return;
  const sp = heroFrame(p), A = sp && sp.rigArm;
  if (!A) return;
  const sc = p.sizeMul || 1, fx = p.face < 0 ? -1 : 1;
  const sx = x + (A.x - sp.ax) * sc * fx, sy = y + (A.y - sp.ay) * sc;
  // the grip, found the same way the weapon finds it
  const u = sp.u ? Math.min(2.2, sp.u) : 1, handY = sp.handY || 8, reachB = sp.handR ? Math.max(4, sp.handR * 0.7) : 4;
  let ang = p.aim, ox = 0;
  const sw = p.swing;
  if (sw && (sw.style === 'slash' || sw.style === 'stab' || sw.style === 'punch' || sw.style === 'slam')) {
    const k = clamp(sw.t / sw.dur, 0, 1), e = easeOut(k);
    if (sw.style === 'slash' || sw.style === 'slam') ang = sw.ang + (sw.arc / 2) * sw.dir * (e * 2 - 1);
    else ox = Math.sin(k * Math.PI) * 6;
  } else if (sw && sw.style === 'spin') ang = sw.ang + (sw.t / sw.dur) * TAU;
  else if (sw && sw.style === 'thrust') ox = Math.sin(clamp(sw.t / sw.dur, 0, 1) * Math.PI) * 10;
  if (p.recoil > 0) ox -= p.recoil * 30;
  const gx = x + Math.cos(ang) * (reachB + ox), gy = y - handY * sc + Math.sin(ang) * (3 * u + ox * 0.6);
  // two bones; the elbow bends down and away from the body
  const len = A.len * sc, half = len / 2, dx = gx - sx, dy = gy - sy, d = Math.hypot(dx, dy) || 1;
  let ex = sx + dx / 2, ey = sy + dy / 2;
  if (d < len) {
    const hh = Math.sqrt(Math.max(0, half * half - (d / 2) * (d / 2)));
    let nx = -dy / d, ny = dx / d;
    if (ny < 0 || (Math.abs(ny) < 0.2 && nx * (sx - x) < 0)) { nx = -nx; ny = -ny; }
    ex += nx * hh; ey += ny * hh;
  }
  const pix = new Map();
  rigLimbDraw(A.tex, [[sx, sy], [ex, ey], [gx, gy]], (px, py, v) => pix.set((px + 2048) * 4096 + py + 2048, v), false);
  if (!pix.size) return;
  const blink = p.iframes > 0 && p.dashT <= 0 && p.barrierT <= 0 && Math.floor(G.t * 16) % 2 === 0;
  g.save();
  g.globalAlpha = (blink ? 0.35 : 1) * (p.veilT > 0 ? 0.45 : 1);
  // outlined like the body
  g.fillStyle = OUTLINE;
  for (const key of pix.keys()) {
    const px = Math.floor(key / 4096) - 2048, py = (key % 4096) - 2048;
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!pix.has((px + ax + 2048) * 4096 + py + ay + 2048)) g.fillRect(px + ax, py + ay, 1, 1);
  }
  const white = p.hurtT > 0.15;
  for (const [key, v] of pix) {
    const px = Math.floor(key / 4096) - 2048, py = (key % 4096) - 2048;
    g.fillStyle = white ? '#ffffff' : `rgb(${v & 255},${(v >> 8) & 255},${(v >> 16) & 255})`;
    g.fillRect(px, py, 1, 1);
  }
  g.restore();
}
const _drawHeldRig = drawHeld;
drawHeld = function (g, p, x, y) { drawRigArm(g, p, x, y); _drawHeldRig(g, p, x, y); };

/* ---------- dust where a foot comes down ---------- */
let rigStepF = -1;
hook('update', () => {
  const p = G.p;
  if (!p || p.dead || !p.moving || p.mounted || p.fly || p.beast || p.dashT > 0 || CD.settings.lowFx || CD.settings.turn8 === false || !G.fl || !G.fl.tiles) { rigStepF = -1; return; }
  const [clip, f] = rigClipOf(p);
  if (clip !== 'walk' && clip !== 'run') return;
  if ((f === 2 || f === 6) && f !== rigStepF) {
    const tile = tileAt(G.fl, Math.floor(p.x / TS), Math.floor(p.y / TS));
    if (tile !== TILE.WATER && tile !== TILE.SHALLOW && tile !== TILE.LAVA && tile !== TILE.TOXIC) burst(p.x + (f === 2 ? -2 : 2), p.y, clip === 'run' ? 2 : 1, ['#8a7e72', '#a89c8e', '#6e645a'], { smin: 6, smax: 18, z: 1, vz: 24, grav: 90, lmin: 0.2, lmax: 0.4, size: 1 });
  }
  rigStepF = f;
});

/* ---------- the turntable: your hero in all eight directions ---------- */
const DIR_NAMES = ['South', 'South-east', 'East', 'North-east', 'North', 'North-west', 'West', 'South-west'];
UI.heroView = function (back) {
  const p = G.p;
  if (!p) return;
  const N = 120, main = h('canvas', { width: N, height: N, class: 'tt-main', role: 'img', 'aria-label': 'Your hero, turning' });
  const strip = h('canvas', { width: 250, height: 64, class: 'tt-strip', role: 'img', 'aria-label': 'The five painted turns' });
  const label = h('div', { class: 'tt-dir' }, '');
  const st = { dir: 0, spin: true, walk: true, t: 0, last: performance.now(), acc: 0 };
  const spinBtn = btn('Stop turning', () => { st.spin = !st.spin; spinBtn.textContent = st.spin ? 'Stop turning' : 'Keep turning'; }, 'small');
  const walkBtn = btn('Stand still', () => { st.walk = !st.walk; walkBtn.textContent = st.walk ? 'Stand still' : 'Walk'; }, 'small');
  const turnBy = (k) => { st.dir = (st.dir + k + 8) % 8; st.acc = 0; };
  const close = () => { UI.close(el); if (back) back(); };
  const el = h('div', { class: 'modal' }, h('div', { class: 'panel' },
    h('h2', {}, ascTitle(p) || playerName(p)),
    h('div', { class: 'turntable' }, main, h('div', { class: 'tt-side' }, label, strip,
      h('p', { class: 'tt-note' }, p.sheet ? 'Drawn heroes turn by mirroring.' : p.beast ? (CD.settings.rigWorld === false ? 'The rigged world is off in Settings.' : 'Your beast is rebuilt from its painting: legs, tail and head on a skeleton, five turns baked, the other three their mirrors.') : CD.settings.turn8 === false ? 'Rigged heroes are off in Settings.' : 'A walking skeleton carries your painted body. Five turns are baked from your front and back; the other three are their mirrors.'))),
    h('div', { class: 'row' }, btn('◀', () => turnBy(1), 'small', { 'aria-label': 'Turn left' }), btn('▶', () => turnBy(-1), 'small', { 'aria-label': 'Turn right' }), spinBtn, walkBtn),
    h('div', { class: 'row' }, btn('Close', close, 'primary', { 'data-autofocus': true }))));
  // the hero as it looks facing one of the eight ways
  const frameFor = (k, walk) => {
    const a = Math.PI / 2 - (k * Math.PI) / 4, dx = Math.cos(a), dy = Math.sin(a);
    const turn = pickTurn(null, dx, dy);
    const q = { ...p, turn, view: turn >= 3 ? 'back' : 'front', face: dx < -0.01 ? -1 : 1, moving: walk, anim: st.t * 7, dashT: 0, atkPose: 0, leapT: 0, bashT: 0, hurtT: 0, realmSpd: 1, rigLazy: false };
    return { sp: heroFrame(q), flip: q.face < 0, turn };
  };
  const blit = (g, sp, flip, x, y, k) => { g.save(); g.translate(Math.round(x), Math.round(y)); if (flip) g.scale(-1, 1); g.drawImage(sp.c, -sp.ax * k, -sp.ay * k, sp.w * k, sp.h * k); g.restore(); };
  const tick = (now) => {
    if (!el.isConnected) return;
    const dt = Math.min(0.1, (now - st.last) / 1000);
    st.last = now; st.t += dt;
    if (st.spin && (st.acc += dt) > 0.9) { st.acc = 0; turnBy(-1); }
    const { sp, flip, turn } = frameFor(st.dir, st.walk), g = main.getContext('2d');
    g.imageSmoothingEnabled = false; g.clearRect(0, 0, N, N);
    const k = Math.max(1, Math.floor(Math.min(96 / sp.w, 100 / sp.h))), fy = N - 12;
    // a compass on the ground, lit where the hero looks
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 2 - (i * Math.PI) / 4, x = N / 2 + Math.cos(a) * 46, y = fy + Math.sin(a) * 9;
      g.fillStyle = i === st.dir ? '#ffb35e' : 'rgba(241,229,205,0.25)'; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, i === st.dir ? 3 : 2, i === st.dir ? 3 : 2);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(N / 2, fy, Math.max(6, sp.w * k * 0.3), 4, 0, 0, TAU); g.fill();
    blit(g, sp, flip, N / 2, fy, k);
    label.textContent = `Facing ${DIR_NAMES[st.dir].toLowerCase()}`;
    // the five painted turns, the one in use underlined
    const sg = strip.getContext('2d');
    sg.imageSmoothingEnabled = false; sg.clearRect(0, 0, 250, 64);
    for (let t = 0; t < 5; t++) {
      const f = frameFor(t, false).sp, k2 = Math.max(1, Math.floor(Math.min(44 / f.w, 52 / f.h)));
      blit(sg, f, false, 25 + t * 50, 56, k2);
      if (t === turn) { sg.fillStyle = '#ffb35e'; sg.fillRect(10 + t * 50, 61, 30, 2); }
    }
    requestAnimationFrame(tick);
  };
  UI.open(el, { modal: true, replace: false, onBack: close });
  requestAnimationFrame(tick);
};
pauseItem('hero', 95, (el, p) => (p ? btn('Your hero', () => { UI.close(el); UI.heroView(() => UI.pause()); }) : null));

