/* ============================================================
   Cinderdeep — the 8-Way Sprite Rig's 3D models in the game.
   The rig kit (RigKit, RigShapes, RigModels: built in from the
   tool's src/kit/) dresses a skeleton in solid shapes; here a
   hero becomes that model: its class gives the look, its weapon
   what it holds, its state the clip and the moment in it, its
   aim the way it faces. Its card is still painted, unseen, so
   its shadow still falls. Heroes drawn from a custom sheet,
   heroes on a mount, and beasts stay on their cards for now.
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
function rigmHero(c, p) {
  if (!rigmOn() || p.sheet || p.mounted || p.beast) { c.model = null; return; }
  const [clip, t] = rigmClip(p), M = RigShapes.builder(1);
  RigModels.figure(RigKit.charPose(clip, t), rigmLook(p), M, { hk: 1.1, STEEL: RigKit.STEEL, CREST: RigKit.CREST, VISOR: RigKit.VISOR });
  const g = rigmGroup(p), sp = heroFrame(p), k = Math.max(0.3, (sp ? sp.ay : 26) / RIGM_PERSON);
  g.parts.place(M.parts);
  g.group.scale.setScalar(k);
  g.group.position.set(p.x, (p.z || 0) + (p.fly ? 4 : 0), p.y);
  g.group.rotation.y = rigmYaw(p.aim || 0);
  // it blinks while it cannot be hurt, as the sprite does
  g.group.visible = !(p.iframes > 0 && p.dashT <= 0 && p.barrierT <= 0 && Math.floor(G.t * 16) % 2 === 0);
  c.model = g.group;
  c.mesh.visible = false;
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
