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
