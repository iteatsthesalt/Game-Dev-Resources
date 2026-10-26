/* ============================================================
   Cinderdeep — the 8-Way Sprite Rig's 3D models in the game.
   The rig kit (RigKit, RigShapes, RigModels: built in from the
   tool's src/kit/) dresses a skeleton in solid shapes; here a
   hero becomes that model: its class gives the look, its weapon
   what it holds, its state the clip and the moment in it, its
   aim the way it faces. Its card is still painted, unseen, so
   its shadow still falls. Chests stand as the rig's chest, Realm
   trees as the rig's trees, each merged into one mesh. Playable
   hounds and foxes are the rig's beast, golems its heavy figure.
   Heroes drawn from a custom sheet, heroes on a mount, and the
   beetle, plant and shade beasts stay on their cards for now.
   ============================================================ */
const RIGM = { groups: new Map() };
const rigmOn = () => CD.settings.rigModels !== false && typeof RigModels === 'object';
// a person is this many pose units tall (hips at 20, head at 38, skull round it)
const RIGM_PERSON = 42;

/* ---------- a hero's look in the rig's terms ---------- */
const RIGM_HEAD = { helm: 'helmet', greathelm: 'helmet', kabuto: 'helmet', hood: 'hood', cowl: 'hood', mask: 'hood', skullhood: 'plague', wizard: 'hat', witchhat: 'hat', stetson: 'hat', feathercap: 'hat', horns: 'viking' };
const RIGM_BACK = { knight: 'cape', ranger: 'quiver', pyro: 'cape', berserker: 'pack', storm: 'cape', necro: 'cape', paladin: 'cape', witch: 'cape', samurai: 'banner', bard: 'pack', gunslinger: 'pack' };
const RIGM_PAULDRON = { knight: 'plate', berserker: 'fur', paladin: 'plate', samurai: 'plate', storm: 'orbs' };
// what each weapon is held as: its own entry, or the one it evolved from
const RIGM_HOLD = {
  sword: ['sword'], greatsword: ['sword'], katana: ['sword'], rapier: ['sword'], daggers: ['dagger', 'dagger'], knives: ['dagger', 'dagger'],
  spear: ['spear'], harpoon: ['spear'], axe: ['axe'], hammer: ['hammer'], mace: ['hammer'], scythe: ['scythe'],
  bow: ['bow'], crossbow: ['bow'], firestaff: ['staff'], frostwand: ['frostblade'], stormrod: ['staff'], hexstaff: ['staff'], orb: ['staff'],
  venomtome: ['none', 'tome'], flasks: ['lantern'],
};
const RIGM_ENCHANT = { fire: 'fire', frost: 'frost', storm: 'storm', venom: 'venom', shadow: 'void' };
function rigmHold(id) {
  for (let k = id, i = 0; k && i < 4; k = WEAPON[k] && WEAPON[k].from, i++) if (RIGM_HOLD[k]) return RIGM_HOLD[k];
  return ['none'];
}
function rigmLook(p) {
  const L = p.look || (CLASS[p.cls] && CLASS[p.cls].look) || {}, w = p.weapon, [right, left = 'none'] = w ? rigmHold(w.id) : ['none'];
  const el = w && w.el && ELEM[w.el] ? ELEM[w.el].of[0] : null;
  return {
    pal: { shirt: L.main || '#8fa3b8', pants: L.dark || '#454b59', skin: L.skin || '#e8b48c', hair: L.hair || '#5a3a22', gear: L.cloth || L.trim || '#6b5136' },
    head: RIGM_HEAD[L.head] || 'none', back: RIGM_BACK[p.cls] || 'none', pauldron: RIGM_PAULDRON[p.cls] || 'none',
    right, left, enchant: (el && RIGM_ENCHANT[el]) || 'none',
  };
}

/* ---------- the moment: which clip, and how far through it ---------- */
function rigmClip(p) {
  if (p.dead) return ['hurt', 1];
  if (p.swing) return [p.swing.style === 'spin' ? 'spin' : 'attack', clamp(p.swing.t / (p.swing.dur || 0.3), 0, 0.999)];
  if (p.dashT > 0) return ['dash', clamp(1 - p.dashT / 0.17, 0, 0.999)];
  if (p.moving) return [Math.hypot(p.vx, p.vy) > 95 ? 'run' : 'walk', (p.anim / 2) % 1];
  return ['idle', (G.t * 0.35) % 1];
}

/* ---------- placing one in the scene, under its card ---------- */
function rigmGroup(id) {
  let g = RIGM.groups.get(id);
  if (!g) { const group = new THREE.Group(); V3.scene.add(group); g = { group, parts: RigShapes.placer(group), used: 0 }; RIGM.groups.set(id, g); }
  g.used = V3.frame;
  return g;
}
// the model faces where the hero aims: pose space looks along +z, which the kit lays along three.js's -z
const rigmYaw = (a) => Math.atan2(-Math.cos(a), -Math.sin(a));
/* ---------- beasts: hounds and foxes as the rig's beast, golems as its heavy figure, in their form's colours ---------- */
const RIGM_BEAST = { hound: 'wolf', fox: 'fox' };
function rigmBeastLook(F, el) {
  const P = RigKit.BEAST_PRESETS[RIGM_BEAST[F.fam]];
  return { ...P, pal: { coat: F.c1, belly: F.c2, mane: F.c3, eye: F.eye || P.pal.eye }, mane: F.fam === 'hound', tip: F.fam === 'fox', tusks: F.stage >= 3 && F.fam === 'hound', ember: el === 'fire' };
}
function rigmGolemLook(F) {
  return { pal: { shirt: F.c1, pants: F.c3, skin: F.c2, hair: F.acc || F.c2, gear: F.acc || F.c3 }, head: 'helmet', back: F.stage >= 3 ? 'crystal' : 'none', pauldron: 'plate', right: 'none', left: 'none', enchant: 'none' };
}
// the beast's moment: the rig's beasts trot, bound and pounce
function rigmBeastClip(p) {
  if (p.swing) return ['attack', clamp(p.swing.t / (p.swing.dur || 0.3), 0, 0.999)];
  if (p.dashT > 0 || (p.moving && Math.hypot(p.vx, p.vy) > 95)) return ['run', (p.anim / 2) % 1];
  if (p.moving) return ['walk', (p.anim / 2) % 1];
  return ['idle', (G.t * 0.35) % 1];
}
// what model a hero is built as this frame, into M: a person, a beast or a golem; null for those still on their card
function rigmBuild(p, M) {
  const o = { hk: 1.1, STEEL: RigKit.STEEL, CREST: RigKit.CREST, VISOR: RigKit.VISOR };
  if (!p.beast) { const [clip, t] = rigmClip(p); RigModels.figure(RigKit.charPose(clip, t), rigmLook(p), M, o); return M; }
  const F = p.form && FORMS[p.form];
  if (!F) return null;
  if (F.fam === 'golem') { const [clip, t] = rigmClip(p); RigModels.figure(RigKit.charPose(clip, t), rigmGolemLook(F), M, { ...o, heavy: true }); return M; }
  if (!RIGM_BEAST[F.fam]) return null;
  const look = rigmBeastLook(F, BEAST[F.line] && BEAST[F.line].element), [clip, t] = rigmBeastClip(p);
  RigModels.beast(RigKit.beastPose(clip, t, look), look, M);
  return M;
}
function rigmHero(c, p) {
  const M = rigmOn() && !p.sheet && !p.mounted ? rigmBuild(p, RigShapes.builder(1)) : null;
  if (!M) { c.model = null; return; }
  // as tall as its sprite: a hero by the person it is, a beast by its own build at rest
  const g = rigmGroup(p), sp = heroFrame(p), tall = p.beast ? rigmRestHeight(p) : RIGM_PERSON, k = Math.max(0.2, (sp ? sp.ay : 26) / tall);
  g.parts.place(M.parts);
  g.group.scale.setScalar(k);
  g.group.position.set(p.x, (p.z || 0) + (p.fly ? 4 : 0), p.y);
  g.group.rotation.y = rigmYaw(p.aim || 0);
  // it blinks while it cannot be hurt, as the sprite does
  g.group.visible = !(p.iframes > 0 && p.dashT <= 0 && p.barrierT <= 0 && Math.floor(G.t * 16) % 2 === 0);
  c.model = g.group;
  c.mesh.visible = false;
}
/* ---------- chests: the rig's chest at its real size, facing you, its lid swinging open as the game opens it ---------- */
// the world's scale: a hero's sprite is a person, 1.8 m tall
const rigmMetre = () => (G.p ? (heroFrame(G.p) || { ay: 20 }).ay : 20) / 1.8;
const RIGM_CHEST = { gold: 'gold', silver: 'iron' };
// a mimic looks like any other chest until it wakes; only the shiver its sprite has (dx) gives it away
function rigmChest(c, pr, dx = 0) {
  if (!rigmOn()) return false;
  const P = RigKit.CHEST_PRESETS[RIGM_CHEST[pr.chest] || 'wood'], el = mycThingElem(pr), E = el && ELEM[el];
  const look = { ...P, pal: E ? { wood: E.ramp[1], lid: E.ramp[2], band: E.ramp[3] } : P.pal };
  chestSwing(pr, pr.opened);
  // the lid rises through the first half of the open clip in the quarter second the game takes to open it
  const t = !pr.opened ? 0 : pr.openAt == null ? 0.6 : clamp(((G.t - pr.openAt) / 0.24) * 0.55, 0, 0.6);
  const M = RigShapes.builder(1);
  RigModels.chest(RigKit.chestPose(pr.opened ? 'open' : 'shut', t, look), look, M);
  const g = rigmGroup(pr), k = (0.75 * rigmMetre()) / M.bounds.h;
  g.parts.place(M.parts);
  g.group.scale.setScalar(k);
  g.group.position.set(pr.x + dx, 0, pr.y);
  g.group.rotation.y = rigmYaw(Math.PI / 2);
  g.group.visible = true;
  c.model = g.group;
  return true;
}

/* ---------- trees: the rig's trees at their real height, merged into one mesh each and shared ---------- */
// which of the rig's trees a Realm tree is, and how tall it grows (m); kinds not here keep their solid
const RIGM_TREE = {
  oak: ['oak', 10], bigoak: ['oak', 14], birch: ['oak', 11], autumn: ['oak', 9], acacia: ['oak', 8], baobab: ['oak', 12], jungle: ['oak', 14], voidtree: ['oak', 9],
  cherry: ['blossom', 6], feytree: ['blossom', 8], pine: ['pine', 16], snowpine: ['pine', 14], stormpine: ['pine', 15],
  willow: ['willow', 9], mangrove: ['willow', 8], palm: ['palm', 12],
};
// a tree's colours, taken from its own sprite so lands, seasons and elements carry over: leaves from the top, bark from the foot
function rigmTreePal(sp) {
  const d = sp.c.getContext('2d').getImageData(0, 0, sp.w, sp.h).data, leaf = [0, 0, 0, 0], bark = [0, 0, 0, 0];
  for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) {
    const i = (y * sp.w + x) * 4;
    if (d[i + 3] < 128 || d[i] + d[i + 1] + d[i + 2] < 60) continue;
    const to = y < sp.h * 0.55 ? leaf : y > sp.h * 0.8 && Math.abs(x - sp.ax) < 3 ? bark : null;
    if (to) { to[0] += d[i]; to[1] += d[i + 1]; to[2] += d[i + 2]; to[3]++; }
  }
  const hex = (a, k, or) => (a[3] ? '#' + [0, 1, 2].map((j) => Math.min(255, Math.round((a[j] / a[3]) * k)).toString(16).padStart(2, '0')).join('') : or);
  return { trunk: hex(bark, 1, '#6a4a2a'), leaf: hex(leaf, 1, '#3e8a3a'), light: hex(leaf, 1.3, '#6cb85a'), accent: null };
}
const RIGM_TREES = new Map();
function rigmTreeModel(o, sp) {
  const [kind, metres] = RIGM_TREE[o.tree], key = `${o.tree}:${v3SpriteId(sp)}`;
  let T = RIGM_TREES.get(key);
  if (!T) {
    const P = RigKit.TREE_PRESETS[kind], pal = rigmTreePal(sp), look = { ...P, pal: { ...pal, accent: kind === 'blossom' ? '#ffffff' : null } };
    const M = RigShapes.builder(1);
    RigModels.tree(RigKit.treePose('sway', 0, look), look, M);
    T = { geo: RigShapes.merge(M.parts), h: M.bounds.h, metres };
    RIGM_TREES.set(key, T);
  }
  return T;
}
// stands a Realm tree as its model in its card's place; false for kinds the rig has no tree for
function rigmTree(c, o, sp, faded) {
  if (!rigmOn() || o.kind !== 'tree' || !RIGM_TREE[o.tree]) return false;
  const T = rigmTreeModel(o, sp);
  if (!c.tree) { c.tree = new THREE.Mesh(T.geo, V3_SOLID_MAT[0]); V3.scene.add(c.tree); }
  // each tree its own size and turn, and a slow sway in the wind
  const k = (T.metres * rigmMetre() * (0.85 + 0.3 * hashU(o.x | 0, o.y | 0, 3))) / T.h;
  c.tree.geometry = T.geo; c.tree.material = V3_SOLID_MAT[faded ? 1 : 0];
  c.tree.scale.setScalar(k);
  c.tree.position.set(o.x, 0, o.y);
  c.tree.rotation.set(0, hashU(o.x | 0, o.y | 0, 4) * Math.PI * 2, Math.sin(G.t * 0.9 + o.x * 0.05) * 0.025);
  c.tree.visible = true;
  c.model = c.tree;
  c.mesh.visible = false;
  if (c.vox) c.vox.visible = false;
  return true;
}

// a beast form's height at rest, in pose units, measured once
const RIGM_REST = new Map();
function rigmRestHeight(p) {
  if (!RIGM_REST.has(p.form)) {
    const F = FORMS[p.form], M = RigShapes.builder(1);
    if (F.fam === 'golem') RigModels.figure(RigKit.charPose('idle', 0), rigmGolemLook(F), M, { hk: 1.1, heavy: true, STEEL: RigKit.STEEL, CREST: RigKit.CREST, VISOR: RigKit.VISOR });
    else { const look = rigmBeastLook(F); RigModels.beast(RigKit.beastPose('idle', 0, look), look, M); }
    RIGM_REST.set(p.form, M.bounds.h);
  }
  return RIGM_REST.get(p.form);
}

// models whose card was not stood up this frame are put away, and dropped after a while
function rigmTidy() {
  for (const [id, g] of RIGM.groups) {
    if (g.used === V3.frame) continue;
    g.group.visible = false;
    if (V3.frame - g.used > 240) { V3.scene.remove(g.group); RIGM.groups.delete(id); }
  }
}
CD.rigModels = { look: rigmLook, clip: rigmClip, groups: RIGM.groups };
