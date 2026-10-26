/* ============================================================
   Cinderdeep — more of everything: heroes, beasts, weapons,
   evolutions, abilities, skills, relics, monsters, bosses,
   omens and feats. Later modules give them behaviour.
   ============================================================ */
function addAll(list, map, items) { for (const it of items) { list.push(it); map[it.id] = it; } }
const WEAPON_STYLE = {};   // style id -> fire(p, def, w, dmg, ang, echo, hand, base)
const ABILITY_CAST = {};   // ability id -> cast(p, a, def, dmg, ang, tx, ty, aimD)

RARITY.natural = { name: 'Innate', w: 0, mul: 1, affixes: 0, color: '#ffb35e', price: 1 };
RARITY.evolved = { name: 'Evolved', w: 0, mul: 1.62, affixes: 3, color: '#ff4a6e', price: 6 };

/* ---------- six new heroes ---------- */
addAll(CLASSES, CLASS, [
  { id: 'paladin', name: 'Paladin', blurb: 'Holy steel. Hallows the ground and turns aside the first blow in every room.', hp: 130, spd: 0.98, armor: 2,
    weapon: 'mace', ability: 'consecrate', passive: { name: 'Aegis', desc: 'The first hit you take in each fight is blocked.' }, cost: 150,
    look: { skin: '#e8b48c', hair: '#d8c8a0', main: '#e8e0d0', dark: '#a89880', trim: '#ffd35c', cloth: '#c8a040', head: 'greathelm', eye: '#1a1214' } },
  { id: 'monk', name: 'Monk', blurb: 'Fists like falling rain. Untouchable, unhurried, unstoppable.', hp: 100, spd: 1.12, armor: 0,
    weapon: 'gauntlets', ability: 'flurry', passive: { name: 'Inner Calm', desc: '+12% dodge. Dashing heals 2 health.' }, cost: 150,
    look: { skin: '#d9a07a', hair: '#2a1a14', main: '#e8902a', dark: '#a85a1a', trim: '#c8301a', cloth: '#a85a1a', head: 'monk', eye: '#1a1214', bare: true } },
  { id: 'gunslinger', name: 'Gunslinger', blurb: 'Two pistols and no patience. Fans the hammer when it counts.', hp: 95, spd: 1.06, armor: 0,
    weapon: 'pistols', ability: 'fanhammer', passive: { name: 'Quickdraw', desc: 'Your first hit after a dash is a guaranteed critical hit.' }, cost: 200,
    look: { skin: '#c99272', hair: '#5a3a1a', main: '#8a5a32', dark: '#5e3a1e', trim: '#d8c8a0', cloth: '#3a4a6a', head: 'stetson', eye: '#1a1214' } },
  { id: 'witch', name: 'Hex Witch', blurb: 'Curses that stick and potions that bite. Bends space into a hungry dark.', hp: 88, spd: 1.02, armor: 0,
    weapon: 'hexstaff', ability: 'blackhole', passive: { name: 'Coven', desc: 'Drinking a potion hexes every foe nearby. +1 potion.' }, cost: 250,
    look: { skin: '#b8d0a8', hair: '#3a1a4a', main: '#4a2a5a', dark: '#2a1a36', trim: '#8fe05c', cloth: '#4a2a5a', head: 'witchhat', eye: '#ffe08a' } },
  { id: 'samurai', name: 'Samurai', blurb: 'One draw, one cut. Every kill sharpens the next.', hp: 105, spd: 1.06, armor: 1,
    weapon: 'katana', ability: 'iaido', passive: { name: 'Bushido', desc: '+30% crit damage. Kills restore a dash.' }, cost: 300,
    look: { skin: '#e2b896', hair: '#1a1a24', main: '#8a1a24', dark: '#5a1018', trim: '#ffd35c', cloth: '#2a2a3a', head: 'kabuto', eye: '#1a1214' } },
  { id: 'bard', name: 'Bard', blurb: 'Plays the deep like an instrument. The deep plays back.', hp: 95, spd: 1.04, armor: 0,
    weapon: 'lute', ability: 'warsong', passive: { name: 'Encore', desc: 'Every 4th ability you cast recharges instantly.' }, cost: 200,
    look: { skin: '#f0c09a', hair: '#c4501f', main: '#3a7a5a', dark: '#2a5a3a', trim: '#ffd35c', cloth: '#7a2a5a', head: 'feathercap', eye: '#1a1214' } },
]);
CLASS.necro.cost = 380;

/* ---------- new weapons ---------- */
addAll(WEAPONS, WEAPON, [
  { id: 'mace', name: 'Flanged Mace', kind: 'melee', style: 'slash', dmg: 16, rate: 1.7, reach: 26, arc: 1.9, kb: 120, combo: 2, stunCh: 0.2, desc: 'Crushing blows with a 20% chance to stun.', cost: 70 },
  { id: 'pistols', name: 'Twin Pistols', kind: 'ranged', style: 'bullet', dmg: 8, rate: 4.2, speed: 420, life: 0.6, ricochet: 1, kb: 30, desc: 'Rapid shots from alternating hands. Bullets ricochet off walls.', cost: 90 },
  { id: 'hexstaff', name: 'Hex Staff', kind: 'ranged', style: 'hex', dmg: 10, rate: 1.9, speed: 210, life: 1, kb: 20, desc: 'Hexed foes take 25% more damage and burst when they die.', cost: 100 },
  { id: 'katana', name: 'Katana', kind: 'melee', style: 'katana', dmg: 13, rate: 2.6, reach: 30, arc: 1.7, kb: 60, combo: 3, crit: 0.08, desc: 'Two quick cuts, then a third that carries you forward in a dashing slash.', cost: 110 },
  { id: 'lute', name: 'War Lute', kind: 'ranged', style: 'note', dmg: 9, rate: 2.2, speed: 180, life: 0.9, pierce: 99, kb: 30, desc: 'Notes that pass through everything. Every 4th strum rings out a chord.', cost: 90 },
  { id: 'whip', name: 'Barbed Whip', kind: 'melee', style: 'whip', dmg: 14, rate: 1.8, reach: 52, width: 7, kb: 50, desc: 'Lashes a long line. The tip bites for 60% more.', cost: 80 },
  { id: 'chakram', name: 'Chakram', kind: 'ranged', style: 'chakram', dmg: 12, rate: 1.4, speed: 270, life: 1.1, kb: 40, desc: 'Ricochets between three foes, then returns to your hand.', cost: 100 },
  { id: 'flasks', name: 'Alchemist Flasks', kind: 'ranged', style: 'flask', dmg: 16, rate: 1.3, aoe: 26, kb: 60, desc: 'Lobbed flasks of fire, frost, poison or lightning. Never the same twice.', cost: 110 },
  { id: 'rapier', name: 'Rapier', kind: 'melee', style: 'thrust', dmg: 9, rate: 3.6, reach: 36, width: 5, kb: 30, crit: 0.2, desc: 'Swift lunges. +20% crit chance.', cost: 80 },
  { id: 'harpoon', name: 'Harpoon Gun', kind: 'ranged', style: 'harpoon', dmg: 22, rate: 0.9, speed: 390, life: 0.6, pierce: 1, kb: -230, desc: 'Spears two foes and drags them to your feet.', cost: 100 },
]);

/* ---------- evolved weapons: a +3 weapon and its matching relic, joined at the forge ---------- */
addAll(WEAPONS, WEAPON, [
  { id: 'bloodreaver', name: 'Bloodreaver', kind: 'melee', style: 'slash', dmg: 16, rate: 2.7, reach: 30, arc: 2.2, kb: 80, combo: 3, leech: 0.05, fx: 'bloodwave', evolved: true, from: 'sword', relic: 'fang', desc: 'Heals 5% of damage dealt. The third cut hurls a crimson wave.' },
  { id: 'dawnbreaker', name: 'Dawnbreaker', kind: 'melee', style: 'slash', dmg: 38, rate: 1.2, reach: 40, arc: 2.9, kb: 200, combo: 2, heavy: true, fx: 'holywave', evolved: true, from: 'greatsword', relic: 'halo', desc: 'Every swing releases a wave of searing light.' },
  { id: 'twinfangs', name: 'Twin Fangs', kind: 'melee', style: 'stab', dmg: 9, rate: 6.4, reach: 24, arc: 0.95, kb: 24, crit: 0.3, fx: 'bleed', evolved: true, from: 'daggers', relic: 'mark', desc: '+30% crit chance. Critical hits open bleeding wounds.' },
  { id: 'skypiercer', name: 'Skypiercer', kind: 'melee', style: 'thrust', dmg: 21, rate: 2.2, reach: 64, width: 10, kb: 100, fx: 'windlance', evolved: true, from: 'spear', relic: 'wings', desc: 'Each thrust launches a piercing lance of wind.' },
  { id: 'butcher', name: 'The Butcher', kind: 'melee', style: 'slash', dmg: 25, rate: 1.75, reach: 32, arc: 2.8, kb: 130, combo: 2, rend: true, fx: 'feast', evolved: true, from: 'axe', relic: 'chalice', desc: 'Cleaves wide. Wounded foes take 30% more. Kills heal 3.' },
  { id: 'earthshaker', name: 'Earthshaker', kind: 'melee', style: 'slam', dmg: 42, rate: 1, reach: 32, aoe: 40, stun: 0.8, kb: 160, fx: 'quakering', evolved: true, from: 'hammer', relic: 'boots', desc: 'Every blow throws a ring of stone shards outward.' },
  { id: 'soulharvester', name: 'Soul Harvester', kind: 'melee', style: 'spin', dmg: 20, rate: 1.55, reach: 38, kb: 70, leech: 0.04, fx: 'souls', evolved: true, from: 'scythe', relic: 'skull', desc: 'Kills tear loose souls that hunt the living.' },
  { id: 'titanknuckles', name: 'Titan Knuckles', kind: 'melee', style: 'punch', dmg: 9, rate: 6.6, reach: 21, arc: 1, kb: 22, combo: 4, fx: 'knuckleboom', evolved: true, from: 'gauntlets', relic: 'thorncrown', desc: 'Every fourth punch detonates.' },
  { id: 'hawkeye', name: 'Hawkeye', kind: 'ranged', style: 'arrow', dmg: 15, rate: 2.7, speed: 380, life: 0.95, pierce: 2, crit: 0.2, homing: 2.5, kb: 50, evolved: true, from: 'bow', relic: 'glasseye', desc: 'Seeking arrows that pierce two foes. +20% crit chance.' },
  { id: 'siegeballista', name: 'Siege Ballista', kind: 'ranged', style: 'bolt', dmg: 34, rate: 1.15, speed: 480, life: 0.75, pierce: 5, kb: 140, fx: 'boombolt', evolved: true, from: 'crossbow', relic: 'powder', desc: 'Bolts punch through five foes and explode where they stop.' },
  { id: 'thousandedges', name: 'Thousand Edges', kind: 'ranged', style: 'knives', dmg: 8, rate: 2.9, speed: 320, life: 0.55, count: 7, spread: 0.7, kb: 25, evolved: true, from: 'knives', relic: 'blades', desc: 'A storm of seven knives.' },
  { id: 'thunderdisc', name: 'Thunder Disc', kind: 'ranged', style: 'boomerang', dmg: 16, rate: 1.6, speed: 280, life: 1, pierce: 99, kb: 50, shock: 0.35, evolved: true, from: 'boomerang', relic: 'idol', desc: 'A crackling disc with a 35% chance to shock.' },
  { id: 'sunfire', name: 'Sunfire Scepter', kind: 'ranged', style: 'fireball', dmg: 19, rate: 1.75, speed: 240, life: 0.9, aoe: 38, burn: 1, kb: 60, evolved: true, from: 'firestaff', relic: 'emberheart', desc: 'Miniature suns. They always burn.' },
  { id: 'wintersgrasp', name: "Winter's Grasp", kind: 'ranged', style: 'shard', dmg: 6.4, rate: 6.2, speed: 360, life: 0.6, spread: 0.08, chill: 0.6, pierce: 1, kb: 14, evolved: true, from: 'frostwand', relic: 'frostcrown', desc: 'Piercing shards with a 60% chance to chill.' },
  { id: 'prismrod', name: 'Prism Rod', kind: 'ranged', style: 'chain', dmg: 12, rate: 2.5, range: 150, chains: 6, shock: 0.25, kb: 25, evolved: true, from: 'stormrod', relic: 'mirror', desc: 'Lightning that splits across six foes.' },
  { id: 'plaguegrimoire', name: 'Plague Grimoire', kind: 'ranged', style: 'venom', dmg: 10, rate: 1.5, speed: 170, life: 0.8, aoe: 26, count: 3, spread: 0.4, kb: 20, evolved: true, from: 'venomtome', relic: 'satchel', desc: 'Three toxic orbs at once.' },
  { id: 'dragonsroar', name: "Dragon's Roar", kind: 'ranged', style: 'blast', dmg: 6.5, rate: 1.3, speed: 360, life: 0.38, count: 10, spread: 0.75, kb: 150, burn: 0.5, evolved: true, from: 'cannon', relic: 'lantern', desc: 'Ten burning pellets. Half of them set foes alight.' },
  { id: 'astraleye', name: 'Astral Eye', kind: 'ranged', style: 'missile', dmg: 11, rate: 2.2, speed: 190, life: 1.8, count: 3, spread: 0.6, homing: 6, kb: 25, evolved: true, from: 'orb', relic: 'hourglass', desc: 'Three seeking stars per cast.' },
  { id: 'muramasa', name: 'Muramasa', kind: 'melee', style: 'katana', dmg: 18, rate: 2.9, reach: 34, arc: 1.9, kb: 70, combo: 2, crit: 0.15, evolved: true, from: 'katana', relic: 'echostone', desc: 'Every second cut is a dashing slash. +15% crit chance.' },
  { id: 'goldenguns', name: 'Golden Guns', kind: 'ranged', style: 'bullet', dmg: 11, rate: 4.8, speed: 460, life: 0.65, ricochet: 2, kb: 34, fx: 'midas', evolved: true, from: 'pistols', relic: 'coin', desc: 'Gilded rounds that ricochet twice. Hits shake loose coins.' },
  { id: 'thornlash', name: 'Thornlash', kind: 'melee', style: 'whip', dmg: 19, rate: 1.9, reach: 64, width: 8, kb: 50, poison: 0.5, fx: 'thorntrail', evolved: true, from: 'whip', relic: 'cloak', desc: 'A long lash that poisons and seeds thorns where it lands.' },
]);
const EVOLVE_FROM = Object.fromEntries(WEAPONS.filter((w) => w.evolved).map((w) => [w.from, w.id]));

/* ---------- beasts: playable monsters that grow up ----------
   Stage 2 at level 5, stage 3 at level 12 with a choice of two forms. */
const BEASTS = [
  { id: 'emberpup', name: 'Emberpup', element: 'fire', cost: 0, blurb: 'A pup of living cinder. Becomes a three-headed hellhound or a blazing hunter.',
    passive: { name: 'Fireborn', desc: 'Fire and lava cannot hurt you. Your burns last 50% longer.' }, stages: ['emberpup', 'cinderhound', ['cerberus', 'ashfang']] },
  { id: 'mossling', name: 'Mossling', element: 'nature', cost: 100, blurb: 'A curious sprout. Becomes an ancient treant or a carnivorous maw.',
    passive: { name: 'Photosynthesis', desc: 'Regenerate 0.6 health every second.' }, stages: ['mossling', 'thornback', ['treant', 'venusmaw']] },
  { id: 'frostkit', name: 'Frostkit', element: 'frost', cost: 160, blurb: 'A fox kit with frost in its fur. Becomes a nine-tailed kitsune or a silent stalker.',
    passive: { name: 'Cold Blood', desc: 'Chilled and frozen foes take 25% more damage from you.' }, stages: ['frostkit', 'rimefox', ['kitsune', 'snowstalker']] },
  { id: 'sparkmite', name: 'Sparkmite', element: 'storm', cost: 220, blurb: 'A beetle that hums with static. Becomes a thunder-horned juggernaut or a stormwing.',
    passive: { name: 'Conductive', desc: 'Every 4th hit arcs lightning to two more foes.' }, stages: ['sparkmite', 'voltbeetle', ['thunderhorn', 'stormwing']] },
  { id: 'pebblet', name: 'Pebblet', element: 'earth', cost: 260, blurb: 'A pebble that wandered off. Becomes a mountain titan or a crystal golem.',
    passive: { name: 'Stoneborn', desc: '+2 armor. Spikes and knockback cannot move you.' }, stages: ['pebblet', 'boulderback', ['titan', 'crystalgolem']] },
  { id: 'gloomling', name: 'Gloomling', element: 'shadow', cost: 300, blurb: 'A scrap of floating dark. Becomes a void reaper or a living nightmare.',
    passive: { name: 'Night Feeder', desc: 'Floats over pits. Kills heal 2. +10% dodge.' }, stages: ['gloomling', 'shade', ['reaper', 'nightmare']] },
];
const BEAST = Object.fromEntries(BEASTS.map((b) => [b.id, b]));
// fam: which painter draws it; c1..c3: body, light, dark; eye; acc: accent
const FORMS = {
  emberpup: { name: 'Emberpup', line: 'emberpup', stage: 1, hp: 95, spd: 1.06, armor: 0, weapon: 'n_emberpup', ability: 'pounce', fam: 'hound', c1: '#e8642a', c2: '#ffb35e', c3: '#8a2a14', eye: '#ffe08a', acc: '#ffd08a' },
  cinderhound: { name: 'Cinderhound', line: 'emberpup', stage: 2, hp: 135, spd: 1.08, armor: 0, weapon: 'n_cinderhound', ability: 'howl', fam: 'hound', c1: '#c8401c', c2: '#ff9a3c', c3: '#5a1a10', eye: '#fff3c0', acc: '#ffd08a', blurb: 'Breathes a steady stream of flame.' },
  cerberus: { name: 'Hellmaw Cerberus', line: 'emberpup', stage: 3, branch: 0, hp: 190, spd: 1.02, armor: 1, weapon: 'n_cerberus', ability: 'hellfire', fam: 'hound', c1: '#3a1414', c2: '#e8521c', c3: '#1a0808', eye: '#ffe08a', acc: '#ff7a2a', blurb: 'Three heads, three streams of fire. A walking furnace.' },
  ashfang: { name: 'Ashfang', line: 'emberpup', stage: 3, branch: 1, hp: 160, spd: 1.22, armor: 0, weapon: 'n_ashfang', ability: 'blazedash', fam: 'hound', c1: '#4a4040', c2: '#ffb35e', c3: '#221c1c', eye: '#ff5a2a', acc: '#ffd08a', blurb: 'Lean and fast. Bites that burn and drink.' },
  mossling: { name: 'Mossling', line: 'mossling', stage: 1, hp: 100, spd: 0.98, armor: 0, weapon: 'n_mossling', ability: 'overgrowth', fam: 'plant', c1: '#5aa84a', c2: '#a8e070', c3: '#2f5a2a', eye: '#1a1214', acc: '#ff8ab0' },
  thornback: { name: 'Thornback', line: 'mossling', stage: 2, hp: 145, spd: 0.98, armor: 1, weapon: 'n_thornback', ability: 'briar', fam: 'plant', c1: '#4a8a3a', c2: '#8fd060', c3: '#264a20', eye: '#ffe08a', acc: '#e8e0cc', blurb: 'Fires volleys of thorns.' },
  treant: { name: 'Elder Treant', line: 'mossling', stage: 3, branch: 0, hp: 220, spd: 0.9, armor: 3, weapon: 'n_treant', ability: 'entangle', fam: 'plant', c1: '#6a4a2a', c2: '#5aa84a', c3: '#3a2614', eye: '#c8ff6a', acc: '#8fd060', blurb: 'An ancient wood giant. Slams the earth and binds foes in roots.' },
  venusmaw: { name: 'Venus Maw', line: 'mossling', stage: 3, branch: 1, hp: 170, spd: 1, armor: 1, weapon: 'n_venusmaw', ability: 'devour', fam: 'plant', c1: '#3f9a2a', c2: '#e2434f', c3: '#1f4a14', eye: '#ffe08a', acc: '#ffd0d8', blurb: 'All mouth. Spits acid and swallows foes whole.' },
  frostkit: { name: 'Frostkit', line: 'frostkit', stage: 1, hp: 85, spd: 1.12, armor: 0, weapon: 'n_frostkit', ability: 'snowveil', fam: 'fox', c1: '#cfe6f8', c2: '#ffffff', c3: '#7a9ab8', eye: '#3a6a9a', acc: '#9fe0ff' },
  rimefox: { name: 'Rimefox', line: 'frostkit', stage: 2, hp: 120, spd: 1.14, armor: 0, weapon: 'n_rimefox', ability: 'nova', fam: 'fox', c1: '#a8d0f0', c2: '#e9f8ff', c3: '#5a7a9a', eye: '#1a3a6a', acc: '#9fe0ff', blurb: 'Fires streams of frost shards.' },
  kitsune: { name: 'Glacier Kitsune', line: 'frostkit', stage: 3, branch: 0, hp: 160, spd: 1.14, armor: 0, weapon: 'n_kitsune', ability: 'foxfire', fam: 'fox', c1: '#e9f8ff', c2: '#ffffff', c3: '#8ab0d8', eye: '#58aaff', acc: '#7fc8ff', blurb: 'Nine tails of living frost. Its foxfire never misses.' },
  snowstalker: { name: 'Snowstalker', line: 'frostkit', stage: 3, branch: 1, hp: 170, spd: 1.18, armor: 1, weapon: 'n_snowstalker', ability: 'whiteout', fam: 'fox', c1: '#dfe8f2', c2: '#ffffff', c3: '#5a6a7a', eye: '#58e0ff', acc: '#2a3a4a', blurb: 'A great white predator. Claws that freeze.' },
  sparkmite: { name: 'Sparkmite', line: 'sparkmite', stage: 1, hp: 90, spd: 1.1, armor: 0, weapon: 'n_sparkmite', ability: 'staticfield', fam: 'beetle', c1: '#3a5e9a', c2: '#fff27a', c3: '#1e2e4e', eye: '#fff27a', acc: '#9ff6ff' },
  voltbeetle: { name: 'Voltbeetle', line: 'sparkmite', stage: 2, hp: 140, spd: 1, armor: 2, weapon: 'n_voltbeetle', ability: 'chain', fam: 'beetle', c1: '#2a4a8a', c2: '#fff27a', c3: '#141e3a', eye: '#ffffff', acc: '#9ff6ff', blurb: 'Hurls arcs of lightning between foes.' },
  thunderhorn: { name: 'Thunderhorn', line: 'sparkmite', stage: 3, branch: 0, hp: 210, spd: 1.04, armor: 2, weapon: 'n_thunderhorn', ability: 'stampede', fam: 'beetle', c1: '#22306a', c2: '#ffe08a', c3: '#0e142e', eye: '#fff27a', acc: '#dde3ec', blurb: 'A living battering ram with a lightning horn.' },
  stormwing: { name: 'Stormwing', line: 'sparkmite', stage: 3, branch: 1, hp: 160, spd: 1.16, armor: 0, weapon: 'n_stormwing', ability: 'thunderstorm', fam: 'beetle', fly: true, c1: '#4a6aaa', c2: '#fff27a', c3: '#222e5a', eye: '#ffffff', acc: '#cfe9ff', blurb: 'Takes to the air. Stings that seek and shock.' },
  pebblet: { name: 'Pebblet', line: 'pebblet', stage: 1, hp: 120, spd: 0.92, armor: 0, weapon: 'n_pebblet', ability: 'stoneskin', fam: 'golem', c1: '#8a8478', c2: '#b8b0a0', c3: '#4a463e', eye: '#7dff9a', acc: '#5fc48a' },
  boulderback: { name: 'Boulderback', line: 'pebblet', stage: 2, hp: 175, spd: 0.92, armor: 1, weapon: 'n_boulderback', ability: 'slam', fam: 'golem', c1: '#7a7468', c2: '#a8a090', c3: '#3e3a32', eye: '#ffd35c', acc: '#5fc48a', blurb: 'Hurls boulders that crack the floor.' },
  titan: { name: 'Mountain Titan', line: 'pebblet', stage: 3, branch: 0, hp: 260, spd: 0.88, armor: 4, weapon: 'n_titan', ability: 'quake', fam: 'golem', c1: '#6a6458', c2: '#9a9284', c3: '#2e2a24', eye: '#ff9a3c', acc: '#ffd35c', blurb: 'A walking mountain. Every step is an earthquake.' },
  crystalgolem: { name: 'Crystal Golem', line: 'pebblet', stage: 3, branch: 1, hp: 200, spd: 0.96, armor: 2, weapon: 'n_crystalgolem', ability: 'prism', fam: 'golem', c1: '#8a6ac8', c2: '#e8d8ff', c3: '#4a3a7a', eye: '#ffffff', acc: '#9ff6ff', blurb: 'Faceted and bright. Shards that pierce, missiles turned aside.' },
  gloomling: { name: 'Gloomling', line: 'gloomling', stage: 1, hp: 85, spd: 1.1, armor: 0, weapon: 'n_gloomling', ability: 'shadowstep', fam: 'shade', fly: true, c1: '#2a2036', c2: '#5a4a7a', c3: '#120c1a', eye: '#ffe08a', acc: '#b98cff' },
  shade: { name: 'Shade', line: 'gloomling', stage: 2, hp: 125, spd: 1.1, armor: 0, weapon: 'n_shade', ability: 'siphon', fam: 'shade', fly: true, c1: '#241a30', c2: '#6a4a9a', c3: '#0e0814', eye: '#9ff6ff', acc: '#b98cff', blurb: 'Seeking bolts of shadow. Drinks the life of the living.' },
  reaper: { name: 'Void Reaper', line: 'gloomling', stage: 3, branch: 0, hp: 175, spd: 1.12, armor: 0, weapon: 'n_reaper', ability: 'reap', fam: 'shade', fly: true, c1: '#1a1424', c2: '#c873ff', c3: '#08040e', eye: '#ff4ad0', acc: '#dde3ec', blurb: 'The scythe at the end of everything.' },
  nightmare: { name: 'Nightmare', line: 'gloomling', stage: 3, branch: 1, hp: 160, spd: 1.16, armor: 0, weapon: 'n_nightmare', ability: 'terror', fam: 'shade', fly: true, c1: '#2a1430', c2: '#e2434f', c3: '#10060e', eye: '#ffe08a', acc: '#ff6f9c', blurb: 'Too many eyes. Its gaze cuts, and its presence terrifies.' },
};
// natural weapons (only beasts wield them)
addAll(WEAPONS, WEAPON, [
  { id: 'n_emberpup', name: 'Ember Bite', kind: 'melee', style: 'bite', dmg: 9, rate: 3.2, reach: 22, arc: 1.4, kb: 50, burn: 0.2, natural: true, desc: 'Quick bites with a 20% chance to burn.' },
  { id: 'n_cinderhound', name: 'Fire Breath', kind: 'ranged', style: 'breath', dmg: 3.2, rate: 9, speed: 170, life: 0.34, burn: 0.15, kb: 8, natural: true, desc: 'A steady stream of fire. Hold to keep breathing.' },
  { id: 'n_cerberus', name: 'Triple Breath', kind: 'ranged', style: 'breath', dmg: 3.6, rate: 9, speed: 180, life: 0.36, count: 3, burn: 0.2, kb: 8, natural: true, desc: 'Three heads, three streams of fire.' },
  { id: 'n_ashfang', name: 'Searing Fangs', kind: 'melee', style: 'bite', dmg: 16, rate: 3.4, reach: 26, arc: 1.5, kb: 70, burn: 0.3, leech: 0.03, natural: true, desc: 'Burning bites that heal 3% of damage dealt.' },
  { id: 'n_mossling', name: 'Seed Spit', kind: 'ranged', style: 'seed', dmg: 8, rate: 2.6, speed: 220, life: 0.7, poison: 0.4, kb: 20, natural: true, desc: 'Spits hard seeds with a 40% chance to poison.' },
  { id: 'n_thornback', name: 'Thorn Volley', kind: 'ranged', style: 'thornvolley', dmg: 7, rate: 2.6, speed: 260, life: 0.55, count: 3, spread: 0.35, poison: 0.15, kb: 25, natural: true, desc: 'Three thorns at once.' },
  { id: 'n_treant', name: 'Root Slam', kind: 'melee', style: 'slam', dmg: 30, rate: 0.95, reach: 30, aoe: 30, stun: 0.4, kb: 120, natural: true, desc: 'Crushing slams that stun everything nearby.' },
  { id: 'n_venusmaw', name: 'Acid Spit', kind: 'ranged', style: 'venom', dmg: 11, rate: 1.6, speed: 180, life: 0.75, aoe: 24, kb: 20, natural: true, desc: 'Globs of acid that leave burning pools.' },
  { id: 'n_frostkit', name: 'Ice Nip', kind: 'melee', style: 'bite', dmg: 8, rate: 3.4, reach: 22, arc: 1.4, kb: 40, chill: 0.25, natural: true, desc: 'Nips with a 25% chance to chill.' },
  { id: 'n_rimefox', name: 'Frost Shards', kind: 'ranged', style: 'shard', dmg: 5, rate: 5.4, speed: 330, life: 0.55, spread: 0.08, chill: 0.3, kb: 12, natural: true, desc: 'A stream of shards. 30% chance to chill.' },
  { id: 'n_kitsune', name: 'Foxfire', kind: 'ranged', style: 'foxfire', dmg: 9, rate: 2.2, speed: 180, life: 1.6, count: 2, spread: 0.5, homing: 5, chill: 0.2, kb: 20, natural: true, desc: 'Pairs of homing wisps of cold fire.' },
  { id: 'n_snowstalker', name: 'Frost Claws', kind: 'melee', style: 'slash', dmg: 15, rate: 2.6, reach: 28, arc: 2.2, kb: 70, combo: 3, chill: 0.4, crit: 0.15, natural: true, desc: 'Raking claws. 40% chance to chill, +15% crit chance.' },
  { id: 'n_sparkmite', name: 'Zap', kind: 'ranged', style: 'chain', dmg: 7, rate: 2.6, range: 100, chains: 2, shock: 0.15, kb: 15, natural: true, desc: 'Sparks that leap between two foes.' },
  { id: 'n_voltbeetle', name: 'Arc Bolt', kind: 'ranged', style: 'chain', dmg: 9, rate: 2.4, range: 130, chains: 4, shock: 0.2, kb: 20, natural: true, desc: 'Lightning that leaps between four foes.' },
  { id: 'n_thunderhorn', name: 'Horn Thrust', kind: 'melee', style: 'thrust', dmg: 22, rate: 2, reach: 40, width: 10, kb: 150, shock: 0.3, natural: true, desc: 'A charging thrust. 30% chance to shock.' },
  { id: 'n_stormwing', name: 'Homing Sting', kind: 'ranged', style: 'sting', dmg: 10, rate: 2.6, speed: 220, life: 1.3, homing: 6, shock: 0.2, kb: 20, natural: true, desc: 'Stingers that seek their target.' },
  { id: 'n_gloomling', name: 'Shadow Claw', kind: 'melee', style: 'slash', dmg: 9, rate: 3, reach: 24, arc: 1.8, kb: 40, combo: 2, natural: true, desc: 'Claws of solid dark.' },
  { id: 'n_shade', name: 'Shade Bolt', kind: 'ranged', style: 'shadebolt', dmg: 11, rate: 2.2, speed: 170, life: 1.5, homing: 5, kb: 20, leech: 0.02, natural: true, desc: 'Seeking bolts that drain life.' },
  { id: 'n_reaper', name: 'Reaping Spin', kind: 'melee', style: 'spin', dmg: 20, rate: 1.5, reach: 36, kb: 60, leech: 0.03, natural: true, desc: 'A full circle of void. Heals 3% of damage dealt.' },
  { id: 'n_nightmare', name: 'Gaze Shards', kind: 'ranged', style: 'gaze', dmg: 6, rate: 6, speed: 340, life: 0.55, spread: 0.1, kb: 10, natural: true, desc: 'A torrent of cutting stares. Sometimes they terrify.' },
  { id: 'n_pebblet', name: 'Rock Punch', kind: 'melee', style: 'punch', dmg: 7, rate: 5, reach: 20, arc: 1, kb: 22, combo: 4, natural: true, desc: 'Pebble-hard punches. The fourth one knocks foes flying.' },
  { id: 'n_boulderback', name: 'Boulder Toss', kind: 'ranged', style: 'boulder', dmg: 20, rate: 1.1, aoe: 28, kb: 90, natural: true, desc: 'Lobs boulders that crash down on a crowd.' },
  { id: 'n_titan', name: 'Quake Slam', kind: 'melee', style: 'slam', dmg: 40, rate: 0.85, reach: 34, aoe: 38, stun: 0.6, kb: 160, natural: true, desc: 'Each slam shakes the room.' },
  { id: 'n_crystalgolem', name: 'Crystal Spray', kind: 'ranged', style: 'crystals', dmg: 8, rate: 2.3, speed: 300, life: 0.6, count: 5, spread: 0.6, pierce: 2, kb: 25, natural: true, desc: 'Five piercing crystals.' },
]);
// beasts sit in the class table too, so runs, records and saves treat them alike
addAll(CLASSES, CLASS, BEASTS.map((b) => {
  const F = FORMS[b.id];
  return { id: b.id, name: b.name, blurb: b.blurb, hp: F.hp, spd: F.spd, armor: F.armor, weapon: F.weapon, ability: F.ability, passive: b.passive, cost: b.cost, beast: true, element: b.element, look: CLASS.knight.look };
}));

/* ---------- abilities ---------- */
addAll(ABILITIES, ABILITY, [
  { id: 'consecrate', name: 'Consecrate', cd: 10, dmg: 8, desc: 'Hallow the ground around you for 5s. Foes inside burn with holy fire; you heal.', cls: 'paladin' },
  { id: 'flurry', name: 'Flurry of Blows', cd: 7, dmg: 7, desc: 'Twelve lightning-fast strikes at everything in front of you.', cls: 'monk' },
  { id: 'fanhammer', name: 'Fan the Hammer', cd: 7, dmg: 12, desc: 'Empty six shots in a wide arc, then six more.', cls: 'gunslinger' },
  { id: 'blackhole', name: 'Black Hole', cd: 12, dmg: 6, desc: 'Open a rift that drags foes in for 3s, then collapses with a bang.', cls: 'witch' },
  { id: 'iaido', name: 'Iaido', cd: 6, dmg: 48, desc: 'Dash through foes with a single perfect cut.', cls: 'samurai' },
  { id: 'warsong', name: 'War Song', cd: 14, dmg: 0, desc: 'For 6s, you and your allies attack 40% faster and heal 1 health per second.', cls: 'bard' },
  { id: 'blizzard', name: 'Blizzard', cd: 12, dmg: 7, desc: 'A freezing storm rages around the target for 4s.', cost: 90 },
  { id: 'quake', name: 'Earthquake', cd: 11, dmg: 30, desc: 'Three shockwaves ripple out from you, stunning foes.', cost: 90 },
  { id: 'clones', name: 'Mirror Clones', cd: 16, dmg: 9, desc: 'Two shadow copies of you fight for 8s.', cost: 110 },
  { id: 'thunderstorm', name: 'Thunderstorm', cd: 14, dmg: 34, desc: 'Lightning strikes random foes eight times.', cost: 100 },
  { id: 'siphon', name: 'Soul Siphon', cd: 9, dmg: 10, desc: 'Drain every nearby foe for 2s, healing yourself.', cost: 80 },
  { id: 'dragon', name: 'Dragon Breath', cd: 9, dmg: 4, desc: 'Breathe a roaring cone of fire for 1.5s.', cost: 100 },
  // beast abilities
  { id: 'pounce', name: 'Pounce', cd: 5, dmg: 24, desc: 'Leap onto the target, mauling everything where you land.', beast: true },
  { id: 'howl', name: 'Blazing Howl', cd: 12, dmg: 0, desc: 'Foes nearby flee in terror for 2s, and you deal 30% more for 5s.', beast: true },
  { id: 'hellfire', name: 'Hellfire', cd: 10, dmg: 36, desc: 'Three heads breathe at once: fire in every direction.', beast: true },
  { id: 'blazedash', name: 'Blaze Dash', cd: 5, dmg: 28, desc: 'Charge through foes, leaving a trail of fire.', beast: true },
  { id: 'overgrowth', name: 'Overgrowth', cd: 12, dmg: 6, desc: 'Grow a thicket that roots foes and heals you while you stand in it.', beast: true },
  { id: 'briar', name: 'Briar Burst', cd: 7, dmg: 14, desc: 'Fire a ring of sixteen thorns.', beast: true },
  { id: 'entangle', name: 'Entangle', cd: 10, dmg: 12, desc: 'Roots burst from the ground and hold every nearby foe for 2.5s.', beast: true },
  { id: 'devour', name: 'Devour', cd: 9, dmg: 60, desc: 'Swallow a weakened foe whole and heal. Huge damage to anything else.', beast: true },
  { id: 'foxfire', name: 'Foxfire', cd: 8, dmg: 14, desc: 'Nine wisps of cold fire hunt down foes.', beast: true },
  { id: 'whiteout', name: 'Whiteout', cd: 12, dmg: 10, desc: 'Vanish into a blizzard for 3s: untouchable, with foes chilled all around.', beast: true },
  { id: 'snowveil', name: 'Snow Veil', cd: 9, dmg: 8, desc: 'Burst into snow, chilling foes and becoming untouchable for a moment.', beast: true },
  { id: 'staticfield', name: 'Static Field', cd: 9, dmg: 6, desc: 'A crackling field around you shocks foes for 4s.', beast: true },
  { id: 'stampede', name: 'Stampede', cd: 8, dmg: 34, desc: 'Charge headlong, trampling and shocking everything in your path.', beast: true },
  { id: 'reap', name: 'Reap', cd: 8, dmg: 40, desc: 'A great sweep of shadow. Kills refund half the recharge.', beast: true },
  { id: 'terror', name: 'Terror', cd: 11, dmg: 18, desc: 'Foes nearby are struck with terror and flee for 3s.', beast: true },
  { id: 'stoneskin', name: 'Stoneskin', cd: 13, dmg: 0, desc: 'Turn to stone for 4s: take 70% less damage and turn missiles aside.', beast: true },
  { id: 'prism', name: 'Prism Beam', cd: 8, dmg: 9, desc: 'A rainbow beam that sweeps through foes for 1.2s.', beast: true },
]);

/* ---------- skills ---------- */
addAll(SKILLS, SKILL, [
  { id: 'bloodlust', name: 'Bloodlust', rar: 'rare', max: 1, tag: 'offense', desc: 'Kills grant +3% damage for 6s, stacking 15 times', apply: (s) => { s.bloodlust = true; } },
  { id: 'giantslayer', name: 'Giant Slayer', rar: 'rare', max: 2, tag: 'offense', desc: '+25% damage to elites and bosses', apply: (s) => { s.giantSlayer += 0.25; } },
  { id: 'laststand', name: 'Last Stand', rar: 'rare', max: 1, tag: 'defense', desc: 'Below 35% health: deal 40% more damage and take 25% less', apply: (s) => { s.lastStand = true; } },
  { id: 'wildfire', name: 'Wildfire', rar: 'rare', max: 1, tag: 'fire', desc: 'Burning foes set a neighbor alight every second', apply: (s) => { s.wildfire = true; } },
  { id: 'vengeance', name: 'Vengeance', rar: 'rare', max: 2, tag: 'defense', desc: 'Getting hit releases a shockwave that deals 30 damage', apply: (s) => { s.vengeance += 30; } },
  { id: 'spellweaver', name: 'Spellweaver', rar: 'rare', max: 2, tag: 'ability', desc: 'Weapon hits shave 0.08s off ability recharge', apply: (s) => { s.spellweaver += 0.08; } },
  { id: 'overcharge', name: 'Overcharge', rar: 'epic', max: 1, tag: 'storm', desc: 'Every 12th weapon hit calls down a lightning nova', apply: (s) => { s.overcharge = true; } },
  { id: 'cascade', name: 'Cascade', rar: 'rare', max: 1, tag: 'ability', desc: 'Casting an ability recharges your other one by 3s', apply: (s) => { s.cascade = 3; } },
  { id: 'opportunist', name: 'Opportunist', rar: 'common', max: 3, tag: 'offense', desc: '+20% damage to stunned, frozen or chilled foes', apply: (s) => { s.opportunist += 0.2; } },
  { id: 'demolition', name: 'Demolition', rar: 'rare', max: 2, tag: 'fire', desc: 'Your explosions are 30% bigger and hit 30% harder', apply: (s) => { s.boomMul += 0.3; } },
  { id: 'crescendo', name: 'Crescendo', rar: 'rare', max: 2, tag: 'offense', desc: '+1% damage for every kill in your combo, up to +30%', apply: (s) => { s.comboDmg += 0.01; } },
  { id: 'adrenaline', name: 'Adrenaline', rar: 'common', max: 2, tag: 'utility', desc: 'Dashing grants +25% attack speed for 1.5s', apply: (s) => { s.adrenaline += 0.25; } },
  { id: 'staticdash', name: 'Static Dash', rar: 'rare', max: 1, tag: 'storm', desc: 'Dashing shocks the foes you pass', apply: (s) => { s.staticDash = true; } },
  { id: 'frostarmor', name: 'Frost Armor', rar: 'rare', max: 1, tag: 'frost', desc: 'Foes that hit you are frozen solid', apply: (s) => { s.frostArmor = true; } },
  { id: 'venomblood', name: 'Venom Blood', rar: 'rare', max: 1, tag: 'venom', desc: 'Foes that hit you are badly poisoned', apply: (s) => { s.venomBlood = true; } },
  { id: 'infernoaura', name: 'Inferno Aura', rar: 'rare', max: 2, tag: 'fire', desc: 'Every 2s, set foes near you alight', apply: (s) => { s.burnAura += 1; } },
  { id: 'hunter', name: 'Treasure Hunter', rar: 'common', max: 2, tag: 'utility', desc: '+15% gold. Foes drop keys three times as often', apply: (s) => { s.goldMul += 0.15; s.keyHunter = true; } },
  { id: 'secondskin', name: 'Second Skin', rar: 'epic', max: 1, tag: 'defense', desc: 'The first hit you take in every fight is ignored', apply: (s) => { s.secondSkin = true; } },
  { id: 'berserk', name: 'Berserk', rar: 'epic', max: 1, tag: 'offense', desc: '+60% attack speed while below half health', apply: (s) => { s.berserk = true; } },
  { id: 'twinsouls', name: 'Twin Souls', rar: 'epic', max: 1, tag: 'ability', desc: 'Abilities have a 35% chance to cast twice', apply: (s) => { s.twinSouls = 0.35; } },
]);

/* ---------- relics ---------- */
addAll(RELICS, RELIC, [
  { id: 'dragonscale', name: 'Dragon Scale', desc: '+3 armor. Foes that touch you burst into flame.', apply: (s) => { s.armor += 3; s.burnTouch = true; } },
  { id: 'diamond', name: 'Blood Diamond', desc: '+50% crit damage. Critical hits heal 1.', apply: (s) => { s.critMul += 0.5; s.critHeal += 1; } },
  { id: 'moons', name: 'Twin Moons', desc: 'Two moons circle you and fire at nearby foes.', apply: (s) => { s.moons += 2; } },
  { id: 'crown', name: 'Crown of Kings', desc: '+15% damage, max health, move speed and gold.', apply: (s) => { s.dmgMul += 0.15; s.hpMul += 0.15; s.spdMul += 0.15; s.goldMul += 0.15; } },
  { id: 'necronomicon', name: 'Necronomicon', desc: 'Every 6th kill raises a skeleton warrior for 20s.', apply: (s) => { s.necroBook = true; } },
  { id: 'dice', name: "Gambler's Dice", desc: 'Every hit rolls: anywhere from half to double damage. +2 luck.', apply: (s) => { s.dice = true; s.luck += 2; } },
  { id: 'hydra', name: 'Hydra Tooth', desc: 'Your missiles split in two when they hit.', apply: (s) => { s.hydra = true; } },
  { id: 'voidshard', name: 'Void Shard', desc: 'Kills have a 15% chance to tear open a rift that drags foes in.', apply: (s) => { s.voidRift += 0.15; } },
  { id: 'icarus', name: 'Wings of Icarus', desc: '+30% move speed. Dashing scorches the ground. You take 15% more damage.', apply: (s) => { s.spdMul += 0.3; s.dashFire = true; s.dmgTaken *= 1.15; } },
  { id: 'phylactery', name: 'Phylactery', desc: 'When you would die, revive at full health. Afterwards your max health is 30% lower.', apply: (s) => { s.phylactery = true; } },
  { id: 'stormcrown', name: 'Storm Crown', desc: 'Every third dash calls lightning down on nearby foes.', apply: (s) => { s.stormDash = true; } },
  { id: 'ragemask', name: 'Rage Mask', desc: 'Getting hit grants +35% damage for 4s.', apply: (s) => { s.rageMask = true; } },
  { id: 'midastouch', name: 'Midas Touch', desc: 'Kills have a 10% chance to turn the foe to solid gold.', apply: (s) => { s.midasKill += 0.1; } },
  { id: 'frozenheart', name: 'Frozen Heart', desc: 'Every 8s, release a frost nova around you.', apply: (s) => { s.frostPulse = 8; } },
  { id: 'cursedblade', name: 'Cursed Blade', desc: '+45% damage, but you bleed 1 health per second during fights.', apply: (s) => { s.dmgMul += 0.45; s.curseBleed = 1; } },
  { id: 'batfamiliar', name: 'Bat Familiar', desc: 'A vampire bat circles you, biting foes and feeding you.', apply: (s) => { s.bat = true; } },
  { id: 'meteorcharm', name: 'Meteor Charm', desc: 'Every 10s, a meteor falls on the toughest foe in the room.', apply: (s) => { s.meteorCharm = 10; } },
  { id: 'chaoseye', name: 'Eye of Chaos', desc: 'Every fight brings an extra elite. Elites drop relics 12% of the time.', apply: (s) => { s.chaosEye = true; } },
  { id: 'clover', name: 'Four-Leaf Clover', desc: '+3 luck and +8% dodge.', apply: (s) => { s.luck += 3; s.dodge += 0.08; } },
  { id: 'sands', name: 'Sands of Time', desc: 'Killing an elite or boss recharges your abilities.', apply: (s) => { s.sands = true; } },
  { id: 'atlas', name: 'Ancient Atlas', desc: 'Every floor is mapped as you arrive, secret rooms included.', apply: (s) => { s.atlas = true; }, now: () => { if (typeof revealFloor === 'function') revealFloor(); } },
]);

/* ---------- camp ---------- */
addAll(META, METAD, [
  { id: 'bond', name: 'Beast Bond', desc: 'Beasts evolve one level sooner', costs: [80, 160], apply: () => {} },
  { id: 'armory', name: 'Armory Stock', desc: 'Shops stock an extra, finer weapon', costs: [70], apply: () => {} },
  { id: 'sense', name: 'Treasure Sense', desc: 'Secret rooms show on your map and chests hold more gold', costs: [90], apply: () => {} },
  { id: 'combo', name: 'Combo Master', desc: '+0.5s to the combo window', costs: [40, 80, 120], apply: () => {} },
  { id: 'chaos', name: 'Chaos Affinity', desc: 'Omens come more often and pay 20% more embers', costs: [60, 120], apply: () => {} },
  { id: 'heirloom', name: 'Heirloom', desc: 'Begin every descent holding a random relic', costs: [400], apply: () => {} },
]);

/* ---------- new monsters ---------- */
Object.assign(ENEMIES, {
  // Ossuary
  boneknight: { name: 'Bone Knight', hp: 62, spd: 34, r: 7, dmg: 13, xp: 9, gold: 2, ai: 'knight', reach: 24, windup: 0.5, lunge: 160, shield: true, sprite: 'boneknight', bone: true },
  crawler: { name: 'Crawler', hp: 18, spd: 64, r: 5, dmg: 9, xp: 3, gold: 0.6, ai: 'lunger', sprite: 'crawler', bone: true },
  banshee: { name: 'Banshee', hp: 30, spd: 44, r: 6, dmg: 9, xp: 7, gold: 1, ai: 'banshee', fly: true, range: 130, rate: 3.6, sprite: 'banshee' },
  // Grotto
  firefly: { name: 'Glowfly', hp: 10, spd: 92, r: 4, dmg: 6, xp: 2, gold: 0.4, ai: 'firefly', fly: true, rate: 2.8, sprite: 'firefly' },
  toad: { name: 'Bog Toad', hp: 44, spd: 60, r: 7, dmg: 11, xp: 6, gold: 1, ai: 'toad', range: 74, sprite: 'toad' },
  shroombrute: { name: 'Shroom Brute', hp: 120, spd: 28, r: 10, dmg: 17, xp: 12, gold: 3, ai: 'slammer', big: true, sprite: 'shroombrute', sporeSlam: true },
  // Frostvault
  frostmage: { name: 'Rime Mage', hp: 36, spd: 36, r: 6, dmg: 11, xp: 8, gold: 2, ai: 'frostmage', range: 170, rate: 3.2, sprite: 'frostmage' },
  mammoth: { name: 'Mammoth', hp: 160, spd: 30, r: 11, dmg: 20, xp: 15, gold: 4, ai: 'charger', big: true, armor: 0.15, sprite: 'mammoth', trample: true },
  // Cinder Core
  elemental: { name: 'Fire Elemental', hp: 54, spd: 40, r: 7, dmg: 12, xp: 9, gold: 2, ai: 'elemental', fly: true, fireproof: true, rate: 2.4, sprite: 'elemental' },
  hellhound: { name: 'Hellhound', hp: 46, spd: 76, r: 7, dmg: 13, xp: 8, gold: 2, ai: 'hellhound', fireproof: true, trail: 'fire', sprite: 'hellhound' },
  // anywhere
  mimic: { name: 'Mimic', hp: 90, spd: 62, r: 8, dmg: 16, xp: 20, gold: 12, ai: 'mimic', sprite: 'mimic' },
  // allies
  ally_clone: { name: 'Shadow Clone', hp: 50, spd: 92, r: 5, dmg: 10, ai: 'ally', sprite: 'clone', ally: true },
  ally_bat: { name: 'Bat Familiar', hp: 1e9, spd: 0, r: 4, dmg: 6, ai: 'none', sprite: 'bat', ally: true, tint: '#c43a5a', fly: true },
});
ACTS[0].enemies.push(['boneknight', 3], ['crawler', 5], ['banshee', 3]); ACTS[0].elites.push('boneknight');
ACTS[1].enemies.push(['firefly', 5], ['toad', 4], ['shroombrute', 2]); ACTS[1].elites.push('toad');
ACTS[2].enemies.push(['frostmage', 4], ['mammoth', 2]); ACTS[2].elites.push('frostmage');
ACTS[3].enemies.push(['elemental', 4], ['hellhound', 5]); ACTS[3].elites.push('hellhound');

Object.assign(BOSSES, {
  lich: { name: 'The Lich Queen', title: 'She Who Keeps the Dead', hp: 1150, r: 10, dmg: 15, xp: 130, sprite: 'lich', act: 0, light: '#9ff6ff' },
  brood: { name: 'The Broodmother', title: 'Mother of a Thousand Legs', hp: 1650, r: 17, dmg: 15, xp: 180, sprite: 'brood', act: 1, light: '#c8ff6a' },
  giant: { name: 'Hrimgar', title: 'Frost Giant of the Vault', hp: 2500, r: 14, dmg: 20, xp: 240, sprite: 'giant', act: 2, light: '#bfe9ff' },
  dragon: { name: 'The Ember Dragon', title: 'The Deep Remembers Fire', hp: 4400, r: 16, dmg: 22, xp: 520, sprite: 'dragon', act: 3, light: '#ff7a2a' },
});
const BOSS_POOL = { ossuary: ['colossus', 'lich'], grotto: ['sporecap', 'brood'], frost: ['wyrm', 'giant'], core: ['king'] };

/* ---------- omens: a floor-wide twist ---------- */
const OMENS = [
  { id: 'bloodmoon', name: 'Blood Moon', color: '#e2434f', desc: 'Foes hit 25% harder and move faster. Their spoils are 50% richer.' },
  { id: 'swarm', name: 'The Swarm', color: '#c8ff6a', desc: '60% more foes, each of them frailer.' },
  { id: 'giants', name: 'Giants', color: '#ffb35e', desc: 'Foes are huge: 60% more health and 50% more gold.' },
  { id: 'volatile', name: 'Volatile', color: '#ff7a2a', desc: 'Slain foes explode. Mind the blast.' },
  { id: 'haste', name: 'Haste', color: '#8ad8ff', desc: 'Everything moves 25% faster. You too.' },
  { id: 'goldrush', name: 'Gold Rush', color: '#ffd35c', desc: 'Triple gold from foes and pots.' },
  { id: 'darkness', name: 'Darkness', color: '#8a7ab8', desc: 'The dark closes in. Experience is 50% richer.' },
  { id: 'parade', name: 'Elite Parade', color: '#ff6f9c', desc: 'Two elites in every fight, carrying extra embers.' },
  { id: 'glass', name: 'Glass', color: '#cfe9ff', desc: 'Everyone deals double damage. Everyone.' },
  { id: 'youth', name: 'Fountain of Youth', color: '#7dff9a', desc: 'You regenerate, and foes drop hearts more often.' },
  { id: 'bullethell', name: 'Bullet Hell', color: '#c873ff', desc: 'Slain foes burst into a ring of bullets.' },
  { id: 'storm', name: 'Thunderstorm', color: '#fff27a', desc: 'Lightning strikes during fights. It does not pick sides.' },
  { id: 'treasure', name: 'Treasure Floor', color: '#ffa53d', desc: 'Every cleared room leaves a chest. Some of them bite.' },
  { id: 'necropolis', name: 'Necropolis', color: '#b8c4b0', desc: 'The dead keep rising mid-fight. Experience is 30% richer.' },
];
const OMEN = Object.fromEntries(OMENS.map((o) => [o.id, o]));

/* ---------- feats: lasting achievements that pay embers ---------- */
const FEATS = [
  { id: 'firstblood', name: 'First Blood', desc: 'Slay your first foe.', embers: 10 },
  { id: 'centurion', name: 'Centurion', desc: 'Slay 100 foes.', embers: 20 },
  { id: 'slayer', name: 'Slayer', desc: 'Slay 1,000 foes.', embers: 60 },
  { id: 'legionbane', name: 'Legion Bane', desc: 'Slay 5,000 foes.', embers: 150 },
  { id: 'bossfirst', name: 'Giant Killer', desc: 'Defeat a boss.', embers: 25 },
  { id: 'bossall', name: 'Bestiarch', desc: 'Defeat all eight bosses.', embers: 200 },
  { id: 'grotto', name: 'Into the Green', desc: 'Reach the Mycelium Grotto.', embers: 20 },
  { id: 'core', name: 'Heat of the Deep', desc: 'Reach the Cinder Core.', embers: 50 },
  { id: 'victory', name: 'Out of the Deep', desc: 'Win a run.', embers: 100 },
  { id: 'heat5', name: 'Fire Walker', desc: 'Win at Heat 5 or higher.', embers: 150 },
  { id: 'heat10', name: 'Living Inferno', desc: 'Win at Heat 10.', embers: 400 },
  { id: 'endless', name: 'No Bottom', desc: 'Reach floor 16 in an endless descent.', embers: 120 },
  { id: 'combo25', name: 'Rampage', desc: 'Reach a 25 kill combo.', embers: 25 },
  { id: 'combo75', name: 'Apocalypse', desc: 'Reach a 75 kill combo.', embers: 60 },
  { id: 'combo100', name: 'Godlike', desc: 'Reach a 100 kill combo.', embers: 100 },
  { id: 'evolve', name: 'Growing Pains', desc: 'Evolve a beast.', embers: 25 },
  { id: 'apex', name: 'Apex', desc: 'Reach a beast’s final form.', embers: 50 },
  { id: 'beastwin', name: 'Call of the Wild', desc: 'Win a run as a beast.', embers: 150 },
  { id: 'forged', name: 'Masterwork', desc: 'Evolve a weapon at the forge.', embers: 50 },
  { id: 'devourer', name: 'Iron Stomach', desc: 'Devour 25 weapons as a beast.', embers: 40 },
  { id: 'secret', name: 'Hidden Ways', desc: 'Find a secret room.', embers: 20 },
  { id: 'secrets10', name: 'Cartomancer', desc: 'Find 10 secret rooms.', embers: 60 },
  { id: 'mimic', name: 'Trust Issues', desc: 'Slay a mimic.', embers: 20 },
  { id: 'kegs', name: 'Powder Monkey', desc: 'Blow up 50 kegs.', embers: 30 },
  { id: 'chaoswin', name: 'Agent of Chaos', desc: 'Win a run in Chaos Mode.', embers: 200 },
  { id: 'omens', name: 'Omen Reader', desc: 'Survive 20 floors under an omen.', embers: 50 },
  { id: 'hoarder', name: 'Dragon’s Hoard', desc: 'Carry 500 gold at once.', embers: 30 },
  { id: 'relics8', name: 'Reliquary', desc: 'Hold 8 relics in a single run.', embers: 60 },
  { id: 'untouched', name: 'Untouchable', desc: 'Clear a whole floor without taking damage.', embers: 40 },
  { id: 'speedrun', name: 'Express Descent', desc: 'Win a run in under 25 minutes.', embers: 120 },
  { id: 'allheroes', name: 'Full Company', desc: 'Make a descent with every hero and beast.', embers: 100 },
];
const FEAT = Object.fromEntries(FEATS.map((f) => [f.id, f]));

