/* ============================================================
   Cinderdeep — one talent tree for everyone. Every passive on it,
   whoever placed it, works for every hero and beast in every
   descent, and is never lost. Souls banked at a DMT well raise
   two Talent Levels: everyone's, whose points may be spent from
   any start, and the banking character's own, whose points they
   spend from their own start on the rim or from anything already
   placed. What a character places stays on the tree under their
   name after they fall.
   ============================================================ */
let _towners = null;   // who placed what, rebuilt when the tree changes
function talentShared() {
  const s = CD.save;
  if (!s.talent || typeof s.talent !== 'object') {
    // what every class had banked before becomes everyone's
    let xp = 0; for (const k in s.tree || {}) xp += (s.tree[k] && s.tree[k].xp) || 0;
    s.talent = { xp, alloc: [], attr: {}, ver: TREE_VER };
  }
  const T = s.talent;
  T.trails = T.trails && typeof T.trails === 'object' ? T.trails : {};
  if (T.ver !== TREE_VER) {
    // the tree has changed shape: every point comes back
    T.alloc = []; T.attr = {};
    for (const k in T.trails) { T.trails[k].alloc = []; T.trails[k].attr = {}; }
    for (const ch of (s.realm && s.realm.chars) || []) if (ch.tree) { ch.tree.alloc = []; ch.tree.attr = {}; }
    T.ver = TREE_VER; _towners = null;
  }
  T.alloc = T.alloc || []; T.attr = T.attr || {};
  return T;
}
// a character's trail across the tree: their own Talent Level and what they placed
function charTrail(ch) {
  if (!ch || !ch.id) return null;
  const T = talentShared();
  let R = T.trails[ch.id];
  if (!R) { R = T.trails[ch.id] = { name: charLabel(ch), cls: ch.cls, xp: (ch.tree && ch.tree.xp) || 0, alloc: [], attr: {} }; _towners = null; }
  R.alloc = R.alloc || []; R.attr = R.attr || {}; R.name = R.fell ? R.name : charLabel(ch);
  return R;
}
const charTalentXp = (ch) => { const R = ch && charTrail(ch); return R ? R.xp : 0; };
function talentOwn(cls) {
  const ch = curChar();
  if (!ch || ch.fell || (cls && ch.cls !== cls)) return null;
  return charTrail(ch);
}
// which points are being spent: your own while you live, everyone's otherwise
const talentLayer = (cls) => (CD.treeLayer === 'shared' || !talentOwn(cls) ? 'shared' : 'own');
const talentLevelOf = (xp) => { let x = xp || 0, lvl = 1; while (lvl < MAX_CLASS_LEVEL && x >= soulsFor(lvl)) { x -= soulsFor(lvl); lvl++; } return { lvl, into: x }; };
function treeOf(cls) { return talentLayer(cls) === 'own' ? talentOwn(cls) : talentShared(); };
// who placed what: everyone's points first, then every trail, living or fallen
function talentOwners() {
  if (_towners && _towners.save === CD.save) return _towners.m;
  const T = talentShared(), m = new Map();
  for (const id of T.alloc) m.set(id, null);
  for (const k in T.trails) for (const id of T.trails[k].alloc) if (!m.has(id)) m.set(id, k);
  _towners = { save: CD.save, m };
  return m;
}
// everything on the tree works for everyone
function treeAlloc() { return [...talentOwners().keys()]; };
const _treeChangedT = treeChanged;
treeChanged = function (cls) { _towners = null; _treeChangedT(cls); };
function talentWhose(id) {
  const m = talentOwners();
  if (!m.has(id)) return '';
  const k = m.get(id), R = k ? talentShared().trails[k] : null;
  return k == null ? "Placed with everyone's points" : R ? `Placed by ${R.name}${R.fell ? ', who has fallen' : ''}` : 'Placed long ago';
}
function classLevelInfo(cls) {
  const layer = talentLayer(cls), T = treeOf(cls), { lvl, into } = talentLevelOf(T.xp);
  const points = lvl - 1 + (layer === 'shared' ? CD.save.treeBonus || 0 : 0);
  return { lvl, into, need: soulsFor(lvl), points, spent: T.alloc.length, free: Math.max(0, points - T.alloc.length), layer };
};
function bankSouls(cls, n) {
  const S = talentShared(), O = talentOwn(cls), s0 = talentLevelOf(S.xp).lvl, o0 = O ? talentLevelOf(O.xp).lvl : s0;
  S.xp += n; if (O) O.xp += n;
  const fs = CD.save.fs; fs.soulsBanked = (fs.soulsBanked || 0) + n;
  const s1 = talentLevelOf(S.xp).lvl;
  if (s1 > s0) later(2.2, () => toast(`Everyone's Talent Level ${s1} · a point any start can spend`, '#ffd35c'), true);
  persist();
  return { before: o0, after: O ? talentLevelOf(O.xp).lvl : s1 };
};
// your own points start from your place on the rim; everyone's from any start; both may grow from anything already placed
function treePath(cls, target) {
  const layer = talentLayer(cls), all = talentOwners(), st = treeStart(cls), N0 = TREE.nodes[target];
  if (!N0) return null;
  if (all.has(target) || target === st.id) return [];
  const sealed = (n) => typeof talentSealed === 'function' && talentSealed(n);
  if (sealed(N0)) return null;
  const roots = layer === 'shared' ? [...TREE.starts.map((n) => n.id), ...all.keys()] : [st.id, ...all.keys()];
  const have = new Set(roots), prev = new Map(), q = [...have];
  for (const h0 of have) prev.set(h0, -1);
  while (q.length) {
    const u = q.shift();
    if (u === target) break;
    for (const v of TREE.nodes[u].links) { if (prev.has(v) || TREE.nodes[v].type === 'start' || sealed(TREE.nodes[v])) continue; prev.set(v, u); q.push(v); }
  }
  if (!prev.has(target)) return null;
  const path = [];
  for (let u = target; u >= 0 && !have.has(u); u = prev.get(u)) path.push(u);
  return path.reverse();
};
// a passive can come back only if everything else still reaches a start without it
function talentConnected(without) {
  const rest = new Set(talentOwners().keys());
  for (const id of without) rest.delete(id);
  const roots = TREE.starts.map((n) => n.id), seen = new Set(roots), q = [...roots];
  while (q.length) { const u = q.shift(); for (const v of TREE.nodes[u].links) if (!seen.has(v) && rest.has(v)) { seen.add(v); q.push(v); } }
  return [...rest].every((x) => seen.has(x));
}
function treeCanRefund(cls, id) { return treeOf(cls).alloc.includes(id) && talentConnected([id]); };
function treeReset(cls) {
  const T = treeOf(cls), c = resetCost(cls);
  if (!T.alloc.length) return null;
  if (!talentConnected(T.alloc)) return "Others' passives grow from these: refund them one at a time";
  if ((CD.save.embers || 0) < c) return `A full reset costs ${c} embers`;
  CD.save.embers -= c; T.alloc = []; T.attr = {}; persist(); treeChanged(cls);
  return null;
};
function treeAttrOf(cls, n) {
  const k = talentOwners().get(n.id), T = talentShared(), L = k == null ? T : T.trails[k];
  return (L && L.attr && L.attr[n.id]) || n.attr;
};
function treeCycleAttr(cls, id) {
  const T = treeOf(cls), n = TREE.nodes[id];
  const nxt = ATTR_IDS[(ATTR_IDS.indexOf(treeAttrOf(cls, n)) + 1) % 3];
  T.attr[id] = nxt;
  persist(); treeChanged(cls);
  return nxt;
};
const talentLabel = (cls) => (talentLayer(cls) === 'shared' ? 'Everyone' : charLabel(curChar()));
// a fallen character's trail stays on the tree, under their name
const _charFallT = charFall;
charFall = function (ch, where) {
  const R = ch && ch.id ? talentShared().trails[ch.id] : null;
  if (R && !R.fell) { R.fell = Date.now(); R.name = charLabel(ch); }
  _towners = null;
  _charFallT(ch, where);
};
// the tree on screen opens on your own points, and can be turned to everyone's
const _treeUILayer = UI.tree;
UI.tree = function (cls, opts = {}) {
  cls = cls || (G.run ? G.run.cls : CD.save.lastClass && CLASS[CD.save.lastClass] ? CD.save.lastClass : 'knight');
  const prev = CD.treeLayer;
  CD.treeLayer = opts.layer || (talentOwn(cls) ? 'own' : 'shared');
  _treeUILayer(cls, { ...opts, onClose: () => { CD.treeLayer = prev; if (opts.onClose) opts.onClose(); if (opts.back) opts.back(); } });
  const el = UI.top(), ctl = el && el.querySelector('.tree-ctl'), title = el && el.querySelector('.tree-title');
  if (title && typeof chaosLevel === 'function') {
    const L = chaosLevel();
    title.append(h('div', { class: 'tree-chaos', style: { color: '#ff9ae6', font: '400 15px/1.2 var(--f-ui)', marginTop: '4px' } }, `Chaos Level ${L} · ${L >= CHAOS_HEART_SEAL ? 'the heart is open' : `the heart opens at Chaos Level ${CHAOS_HEART_SEAL}`}`));
  }
  if (!ctl) return;
  if (talentOwn(cls)) {
    const other = CD.treeLayer === 'shared' ? 'own' : 'shared';
    const flip = btn(other === 'shared' ? "Spend everyone's points" : `Spend ${charLabel(curChar())}'s points`, () => { UI.close(el); CD.treeLayer = prev; UI.tree(cls, { ...opts, layer: other }); }, 'small');
    ctl.insertBefore(flip, ctl.firstChild.nextSibling);
  }
};

