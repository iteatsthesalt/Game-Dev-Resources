/* ============================================================
   Cinderdeep — the screens in 3D. Each circle is drawn by
   circle3d (59-circles-3d.js): the Talent Tree here, the skill
   wheel and the DNA circle below it. A screen keeps its own
   buttons, tooltips and pointer code; what changed is how its
   picture is made.
   ============================================================ */

/* ---------- the Talent Tree: a mound of mycelium, the chaos heart at its crown ---------- */
const TREE_DOME = 300; // how high the heart stands over the rim
const treeDome = (r) => TREE_DOME * Math.pow(Math.max(0, 1 - r / TREE.radius), 1.3);
const treeHeight = (n) => (n.type === 'start' ? 0 : treeDome(Math.hypot(n.x, n.y)) + (n.chaos ? (hashU(n.id, 5, 5) - 0.5) * 80 : 0));
const treeCircle = () => circle3d(TREE.nodes, TREE.edges, { radius: TREE.radius, seed: (ei) => ei * 2654435761, height: treeHeight, radiusOf: (i) => nodeR(TREE.nodes[i]), ground: paintTreeGround });
// the picture under the tree: a sector glow behind each element, the chaos heart's halo, and the seals the Chaos Level opens
function paintTreeGround(g, size, CL) {
  const GR = TREE.radius * 1.25, k = size / (GR * 2), P = (v) => (v + GR) * k;
  const bg = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.5);
  bg.addColorStop(0, '#1c1418'); bg.addColorStop(1, '#060406');
  g.fillStyle = bg; g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'lighter';
  for (const G0 of TREE.glows || SECTORS.map((S, s) => ({ deg: -90 + s * 60, col: S.color }))) {
    const a = (G0.deg * Math.PI) / 180, x = P(Math.cos(a) * 1100), y = P(Math.sin(a) * 1100), r = 520 * k, sg = g.createRadialGradient(x, y, 0, x, y, r);
    sg.addColorStop(0, rgbaStr(G0.col, 0.22)); sg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const hr = 660 * k, hg = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, hr);
  hg.addColorStop(0, `rgba(255,74,208,${0.16 + 0.02 * Math.min(CL, 6)})`); hg.addColorStop(0.55, 'rgba(127,232,255,0.05)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = hg; g.fillRect(size / 2 - hr, size / 2 - hr, hr * 2, hr * 2);
  g.globalCompositeOperation = 'source-over';
  for (const B of [...CHAOS_BANDS.filter((b) => b.seal > 0), { r1: 70, seal: CHAOS_HEART_SEAL }]) {
    if (CL >= B.seal) continue;
    g.setLineDash([8, 8]); g.strokeStyle = 'rgba(255,74,208,0.6)'; g.lineWidth = 3;
    g.beginPath(); g.arc(size / 2, size / 2, (B.r1 + 22) * k, 0, TAU); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(255,190,235,0.9)'; g.font = '10px "Jersey 15", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.fillText(`SEALED · CHAOS LEVEL ${B.seal}`, size / 2, size / 2 - (B.r1 + 26) * k);
  }
}
const treeCardOf = (n) => {
  if (n.type !== 'start' || !n.cls || !CLASS[n.cls]) return null;
  const C1 = CLASS[n.cls], sp = C1.beast ? beastFrames(n.cls)[0] : heroSprites(C1.look, n.cls).front[0], k = 74 / Math.max(sp.w, sp.h);
  return { canvas: sp.c, w: sp.w * k, h: sp.h * k, key: sp.c };
};
// draws the tree into the screen's canvas. C is the screen's circle3d; o is what the screen is pointing at
function renderTree(C, g, W, H, dpr, view, cls, o) {
  const alloc = new Set(treeAlloc(cls)), st = treeStart(cls), t = performance.now() / 1000, q = o.query, CL = typeof chaosLevel === 'function' ? chaosLevel() : 0;
  const pathSet = new Set(o.hover >= 0 ? treePath(cls, o.hover) || [] : []);
  const have = new Set([st.id, ...alloc, ...(talentLayer(cls) === 'shared' ? TREE.starts.map((n) => n.id) : [])]);
  // who placed each passive: everyone's points ring gold, yours white, the living blue, the fallen violet
  const owners = talentOwners(), trails = talentShared().trails || {}, me = talentLayer(cls) === 'own' && curChar() ? curChar().id : null;
  const ringOf = (id) => { if (!owners.has(id)) return null; const k = owners.get(id); return k == null ? '#ffc65a' : k === me ? '#ffffff' : trails[k] && trails[k].fell ? '#9a86c8' : '#7fe8ff'; };
  const lit = (id) => alloc.has(id) || TREE.nodes[id].type === 'start';
  const colOf = (n) => (n.chaos ? CHAOS_HUES[(n.id + Math.floor(t * 2)) % CHAOS_HUES.length] : n.col || (SECTORS[n.sector] ? SECTORS[n.sector].color : '#ff4ad0'));
  const heart = TREE.nodes[TREE.heart];
  C.draw(g, W, H, dpr, view, {
    t, groundKey: CL,
    edge: (ei) => {
      const [a, b] = TREE.edges[ei], ch = TREE.nodes[a].chaos || TREE.nodes[b].chaos;
      const on = lit(a) && lit(b) && (alloc.has(a) || alloc.has(b)), prev = (pathSet.has(a) || have.has(a)) && (pathSet.has(b) || have.has(b)) && (pathSet.has(a) || pathSet.has(b));
      const col = on ? (ch ? CHAOS_HUES[(ei + Math.floor(t * 3)) % CHAOS_HUES.length] : '#ffc65a') : prev ? '#7fe8ff' : have.has(a) || have.has(b) ? '#6a5a4e' : ch ? '#3e2440' : '#33292c';
      return { col, w: on ? 7 : prev ? 5.5 : 3.2, key: `${col}${on ? 3 : prev ? 2 : 1}`, bead: on || prev };
    },
    node: (i) => {
      const n = TREE.nodes[i], r = nodeR(n), col = colOf(n), sealed = talentSealed(n);
      const isAlloc = alloc.has(n.id) || n.id === st.id, avail = !isAlloc && n.type !== 'start' && n.links.some((l) => have.has(l));
      let body = isAlloc ? (n.type === 'minor' ? (n.attr ? ATTR[treeAttrOf(cls, n)].col : '#ffd35c') : col) : n.type === 'start' ? '#4a3c42' : c3Dim(n.attr ? ATTR[n.attr].col : col, avail ? 0.6 : 0.3);
      if (sealed) body = c3Dim(body, 0.35);
      const hot = n.id === o.hover || n.id === o.cursor, match = q && (nodeName(n) + ' ' + nodeDesc(n)).toLowerCase().includes(q);
      return {
        r, col: body, shape: n.type === 'start' ? 'pedestal' : n.type === 'keystone' ? 'gem' : n.type === 'evo' ? 'slab' : 'cube',
        glow: isAlloc && n.type !== 'minor' ? 0.5 : 0, glowCol: col, stem: n.type !== 'minor',
        ring: isAlloc ? ringOf(n.id) || (n.type === 'start' ? null : '#fff3c0') : avail ? '#ffd35c' : null,
        mark: hot ? '#ffffff' : match ? c3Dim('#ffffff', 0.5 + Math.sin(t * 8) * 0.4, '#000000') : null,
        flash: n.id === o.flashN ? { size: 3.9 + (0.4 - o.flashT) * 12, col: c3Dim('#ffffff', Math.min(1, o.flashT * 2.5), '#000000') } : null,
        card: treeCardOf(n),
      };
    },
    // the chaos heart: a pulse of light at the crown, and arms of it turning slowly down the mound
    extras: (C2) => {
      const hy = C2.hs[heart.id] + 24;
      C2.glow(0, hy, 0, 560 * (0.88 + Math.sin(t * 2) * 0.12), '#ff4ad0', 0.3 + 0.04 * Math.min(CL, 6));
      for (let k = 0; k < 5; k++) for (let j = 1; j < 17; j++) {
        const u = j / 16, a = t * 0.12 + (k * TAU) / 5 + u * 4.4, r = u * 630;
        C2.glow(Math.cos(a) * r, treeDome(r) + 14, Math.sin(a) * r, 52 * (1 - u * 0.5), CHAOS_HUES[k], 0.2 * (1 - u * 0.6));
      }
    },
  });
  // names stand on the glass: starts always, keystones and evolutions up close, notables closer
  g.textAlign = 'center';
  for (const n of TREE.nodes) {
    const start = n.type === 'start', named = n.type === 'keystone' || n.type === 'evo' || n.type === 'notable';
    if (!start && !named) continue;
    const p = C.project(n.id);
    if (p.behind || p.x < -80 || p.y < -80 || p.x > C.cssW + 80 || p.y > C.cssH + 80) continue;
    const z = Math.max(0.7, p.k), r = nodeR(n) * p.k * dpr, x = p.x * dpr, y = p.y * dpr;
    if (start) {
      g.fillStyle = rgbaStr(colOf(n), 0.9); g.font = `${Math.round(12 * dpr * z)}px "Jersey 15", sans-serif`; g.textBaseline = 'middle';
      g.fillText((n.cls && CLASS[n.cls] ? CLASS[n.cls].name : SECTORS[n.sector] ? SECTORS[n.sector].name : '').toUpperCase(), x, y + r + 12 * dpr * z);
    } else if (p.k > 0.45 && (n.type !== 'notable' || p.k > 0.9)) {
      g.fillStyle = alloc.has(n.id) ? '#fff3c0' : n.type === 'notable' ? '#bfae94' : colOf(n); g.font = `${Math.round((n.type === 'notable' ? 11 : 13) * dpr * Math.max(0.8, p.k))}px "Jersey 15", sans-serif`; g.textBaseline = 'top';
      g.fillText(nodeName(n), x, y + r + 4 * dpr);
    }
  }
}

/* ---------- the skill wheel: eight arms rising from the core like a crown ---------- */
const SK_RISE = 30; // how much higher each step of an arm stands than the one before
const skNodeR = (n) => (n.kind === 'core' ? 16 : n.kind === 'heart' ? 12 : n.kind === 'att' || n.kind === 'focus' || n.kind === 'mastery' || n.kind === 'bridge' ? 7 : 10);
const skStepH = (n) => (n.kind === 'core' ? 0 : n.kind === 'bridge' ? 16 + 2 * SK_RISE : 16 + SK_STEP.indexOf(n.kind) * SK_RISE);
// the wheel of one skill tree T as a circle of its own; the nodes keep T's order in circle.nodes, and circle.idx finds one by id
function skillCircle(T) {
  const list = Object.values(T.nodes), idx = {};
  list.forEach((n, i) => { idx[n.id] = i; });
  const rot = WHEEL.indexOf(T.native);
  const ground = (g, size) => {
    const k = size / (330 * 1.25 * 2), bg = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.5);
    bg.addColorStop(0, '#1a1418'); bg.addColorStop(1, '#060406');
    g.fillStyle = bg; g.fillRect(0, 0, size, size);
    g.globalCompositeOperation = 'lighter';
    WHEEL.forEach((pid, i) => {
      const a = -Math.PI / 2 + ((i - rot) * TAU) / 8, x = size / 2 + Math.cos(a) * 190 * k, y = size / 2 + Math.sin(a) * 190 * k, r = 150 * k, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rgbaStr(PATH[pid].col, 0.22)); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    });
  };
  const c = circle3d(list, T.edges.map(([a, b]) => [idx[a], idx[b]]), { radius: 330, seed: (ei) => ei * 7907 + 3, height: skStepH, radiusOf: (i) => skNodeR(list[i]), ground });
  if (c) c.idx = idx;
  return c;
}
// draws the wheel into the screen's canvas. o: { T, A the taken ids, can(id), hover, colOf(n) }
function renderSkill(C, g, W, H, dpr, view, o) {
  const t = performance.now() / 1000, T = o.T;
  C.draw(g, W, H, dpr, view, {
    t, groundKey: 0,
    edge: (ei) => {
      const [a, b] = C.edges[ei], na = C.nodes[a], nb = C.nodes[b], on = o.A.has(na.id) && o.A.has(nb.id), col = on ? o.colOf(nb.kind === 'core' ? na : nb) : '#3a3236';
      return { col, w: on ? 6 : 3, key: col, bead: on };
    },
    node: (i) => {
      const n = C.nodes[i], on = o.A.has(n.id), can = !on && o.can(n.id), col = o.colOf(n), big = n.kind === 'core' || n.kind === 'heart';
      return {
        r: skNodeR(n), col: on ? col : c3Dim(col, can ? 0.6 : 0.28), shape: big ? 'gem' : n.kind === 'acc' || n.kind === 'bridge' ? 'slab' : 'cube',
        glow: on ? (big ? 0.6 : 0.25) : 0, stem: n.kind === 'heart',
        ring: can ? c3Dim('#ffd35c', 0.55 + Math.sin(t * 5) * 0.3, '#000000') : null, mark: n === o.hover ? '#ffffff' : null,
      };
    },
    extras: (C2) => { C2.glow(0, 20, 0, 190 + Math.sin(t * 2) * 14, '#ffd35c', 0.22); },
  });
  g.textAlign = 'center'; g.textBaseline = 'bottom'; g.font = `${Math.round(15 * dpr)}px var(--f-ui), sans-serif`;
  for (const P of PATHS) { const i = C.idx[`${P.id}:heart`], p = C.project(i); if (p.behind) continue; g.fillStyle = P.col; g.fillText(P.name.toUpperCase(), p.x * dpr, (p.y - 18) * dpr); }
}

/* ---------- the DNA circle: three strands, each a double helix of light with its genes along it ---------- */
const dnaNodeR = (id, genes) => (id === 'core' ? 20 : genes[id].spl ? 12 : genes[id].lib ? 9 : 10);
// L is the layout (dnaLayout); the nodes keep the order of its positions, and circle.idx finds one by gene id
function dnaCircle(L, genes) {
  const list = Object.keys(L.pos).map((id) => ({ id, x: L.pos[id].x, y: L.pos[id].y })), idx = {};
  list.forEach((n, i) => { idx[n.id] = i; });
  const ground = (g, size) => {
    const k = size / (500 * 1.25 * 2), bg = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.5);
    bg.addColorStop(0, '#10151c'); bg.addColorStop(1, '#060406');
    g.fillStyle = bg; g.fillRect(0, 0, size, size);
    [[350, 'REMEMBERED'], [440, 'REARRANGED']].forEach(([r, label]) => {
      g.setLineDash([6, 12]); g.strokeStyle = 'rgba(127,232,255,0.3)'; g.lineWidth = 2;
      g.beginPath(); g.arc(size / 2, size / 2, r * k, 0, TAU); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(127,232,255,0.7)'; g.font = '18px var(--f-ui), sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillText(label, size / 2, size / 2 + r * k + 4);
    });
  };
  const c = circle3d(list, L.edges.map(([a, b]) => [idx[a], idx[b]]), { radius: 500, seed: (ei) => ei * 7919 + 13, height: (n) => (n.id === 'core' ? 70 : 34 + Math.hypot(n.x, n.y) * 0.05), radiusOf: (i) => dnaNodeR(list[i].id, genes), ground });
  if (c) c.idx = idx;
  return c;
}
// draws the circle into the screen's canvas. o: { genes, on the held ids, can(id), hover id, colOf(id) }
function renderDna(C, g, W, H, dpr, cam, o) {
  const t = performance.now() / 1000;
  C.draw(g, W, H, dpr, cam, {
    t, groundKey: 0,
    edge: (ei) => {
      const [a, b] = C.edges[ei], ia = C.nodes[a].id, ib = C.nodes[b].id, lit = o.on.has(ia) && o.on.has(ib), col = lit ? o.colOf(ib === 'core' ? ia : ib) : '#2c3138';
      return { col, w: lit ? 5 : 2.6, key: col, bead: lit };
    },
    node: (i) => {
      const id = C.nodes[i].id, gi = o.genes[id], isOn = o.on.has(id), can = !isOn && o.can(id), c = o.colOf(id);
      return {
        r: dnaNodeR(id, o.genes), col: isOn ? c : c3Dim(c, can ? 0.6 : 0.3), shape: id === 'core' || (gi && gi.spl) ? 'gem' : 'cube',
        glow: isOn ? 0.5 : 0, ring: can ? c3Dim(c, 0.55 + Math.sin(t * 4) * 0.3, '#000000') : gi && gi.spl ? c3Dim(c, 0.6) : null, mark: id === o.hover ? '#ffffff' : null,
      };
    },
    // a double helix of light turning down each strand
    extras: (C2) => {
      for (const s of ['ab', 'wp', 'acc']) {
        const A = DNA_ANG[s], ux = Math.cos(A), uy = Math.sin(A), vx = -uy, vy = ux;
        for (const ph of [0, Math.PI]) for (let r = 20; r <= 300; r += 7) {
          const a = r / 22 + ph + t * 1.4, off = Math.sin(a) * 16;
          C2.glow(ux * r + vx * off, 44 + r * 0.05 + Math.cos(a) * 16, uy * r + vy * off, 15, DNA_COL[s], 0.5);
        }
      }
    },
  });
  g.font = `${Math.round(15 * dpr)}px var(--f-ui), sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const s of ['ab', 'wp', 'acc']) { const p = C.at(Math.cos(DNA_ANG[s]) * 470, Math.sin(DNA_ANG[s]) * 470, 40); if (!p.behind) { g.fillStyle = DNA_COL[s]; g.fillText(DNA_STRAND[s].toUpperCase(), clamp(p.x * dpr, 60, W - 60), clamp(p.y * dpr, 12, H - 12)); } }
}
