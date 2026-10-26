/* ============================================================
   Cinderdeep — content: heroes, weapons, abilities, skills,
   relics, enemies, regions, camp upgrades, heat
   ============================================================ */

const RARITY = {
  common: { name: 'Common', w: 60, mul: 1, affixes: 0, color: '#cfc6b6', price: 1 },
  uncommon: { name: 'Uncommon', w: 28, mul: 1.12, affixes: 1, color: '#74d672', price: 1.4 },
  rare: { name: 'Rare', w: 12, mul: 1.26, affixes: 2, color: '#58aaff', price: 2 },
  epic: { name: 'Epic', w: 4, mul: 1.42, affixes: 2, color: '#c873ff', price: 2.8 },
  legendary: { name: 'Legendary', w: 1, mul: 1.62, affixes: 3, color: '#ffa53d', price: 4 },
};
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

/* ---------- heroes ---------- */
const CLASSES = [
  { id: 'knight', name: 'Knight', blurb: 'Steel and nerve. Built to take a beating and keep swinging.', hp: 120, spd: 1, armor: 1,
    weapon: 'sword', ability: 'bash', passive: { name: 'Steadfast', desc: 'Take 15% less damage.' }, cost: 0,
    look: { skin: '#e8b48c', hair: '#6b4428', main: '#8fa3b8', dark: '#55677c', trim: '#2f5fa8', cloth: '#2f5fa8', head: 'helm', eye: '#1a1214' } },
  { id: 'ranger', name: 'Ranger', blurb: 'Quick on her feet, deadly at range. Arrows find the gaps.', hp: 95, spd: 1.08, armor: 0,
    weapon: 'bow', ability: 'rain', passive: { name: 'Eagle Eye', desc: '+10% crit chance. Projectiles pierce one more foe.' }, cost: 0,
    look: { skin: '#d9a07a', hair: '#9a4d22', main: '#4f7a3a', dark: '#2f4d24', trim: '#8a5a32', cloth: '#6b4a2a', head: 'hood', eye: '#1a1214' } },
  { id: 'pyro', name: 'Pyromancer', blurb: 'Every room is kindling. Calls meteors down on the crowd.', hp: 85, spd: 1, armor: 0,
    weapon: 'firestaff', ability: 'meteor', passive: { name: 'Kindling', desc: 'Burns last 50% longer. Abilities deal 15% more damage.' }, cost: 0,
    look: { skin: '#f0c09a', hair: '#e8e2d6', main: '#b33a2a', dark: '#6e1f1a', trim: '#f2b53c', cloth: '#b33a2a', head: 'wizard', eye: '#1a1214' } },
  { id: 'rogue', name: 'Rogue', blurb: 'In, out, gone. Twin daggers and a talent for vanishing.', hp: 90, spd: 1.14, armor: 0,
    weapon: 'daggers', ability: 'shadowstep', passive: { name: 'Cutthroat', desc: 'Crits deal 50% more damage. +1 dash.' }, cost: 120,
    look: { skin: '#c99272', hair: '#2a2230', main: '#4a3a5e', dark: '#2a2036', trim: '#b04060', cloth: '#3a2c4a', head: 'mask', eye: '#ffe08a' } },
  { id: 'berserker', name: 'Berserker', blurb: 'The closer to death, the harder he hits. Then he hits harder.', hp: 140, spd: 1.02, armor: 0,
    weapon: 'axe', ability: 'whirlwind', passive: { name: 'Bloodrage', desc: 'Up to 50% more damage as your health drops. Kills heal 1.' }, cost: 220,
    look: { skin: '#d79c74', hair: '#c4501f', main: '#7a5a3a', dark: '#4a3424', trim: '#d8d0c0', cloth: '#7a2a24', head: 'horns', eye: '#1a1214', bare: true } },
  { id: 'storm', name: 'Stormcaller', blurb: 'Lightning arcs from foe to foe. The air tastes of copper.', hp: 90, spd: 1.04, armor: 0,
    weapon: 'stormrod', ability: 'chain', passive: { name: 'Static', desc: 'Every 5th hit calls down a shock.' }, cost: 320,
    look: { skin: '#e2b896', hair: '#dfe8f2', main: '#3a5e9a', dark: '#22385e', trim: '#fff27a', cloth: '#3a5e9a', head: 'cowl', eye: '#9ff6ff' } },
  { id: 'necro', name: 'Necromancer', blurb: 'The dead owe her favors. She collects in skeletons.', hp: 90, spd: 1, armor: 0,
    weapon: 'venomtome', ability: 'legion', passive: { name: 'Harvest', desc: 'Slain foes have a 12% chance to rise as your skeleton for 12s.' }, cost: 450,
    look: { skin: '#b8c4b0', hair: '#1c1a20', main: '#2c2a34', dark: '#18161e', trim: '#8fe05c', cloth: '#2c2a34', head: 'skullhood', eye: '#8fe05c' } },
];
const CLASS = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

/* ---------- weapons ----------
   kind: melee | ranged. style picks the attack routine.
   dmg per hit, rate in attacks per second, reach in px (melee), speed px/s and life s (ranged). */
const WEAPONS = [
  { id: 'sword', name: 'Shortsword', kind: 'melee', style: 'slash', dmg: 11, rate: 2.5, reach: 27, arc: 2.0, kb: 70, combo: 3, desc: 'Three-hit combo. The third cut is wider and hits harder.', start: true },
  { id: 'greatsword', name: 'Greatsword', kind: 'melee', style: 'slash', dmg: 27, rate: 1.15, reach: 35, arc: 2.7, kb: 170, combo: 2, heavy: true, desc: 'Slow, sweeping arcs that send foes flying.', cost: 60 },
  { id: 'daggers', name: 'Twin Daggers', kind: 'melee', style: 'stab', dmg: 6.5, rate: 5.2, reach: 22, arc: 0.85, kb: 22, crit: 0.15, desc: 'A flurry of quick stabs. +15% crit chance.', start: true },
  { id: 'spear', name: 'Spear', kind: 'melee', style: 'thrust', dmg: 15, rate: 2, reach: 48, width: 8, kb: 80, desc: 'A long thrust that skewers everything in a line.', cost: 60 },
  { id: 'axe', name: 'War Axe', kind: 'melee', style: 'slash', dmg: 18, rate: 1.65, reach: 29, arc: 2.4, kb: 110, combo: 2, rend: true, desc: 'Wide cleaves. Deals 30% more to wounded foes.', start: true },
  { id: 'hammer', name: 'Warhammer', kind: 'melee', style: 'slam', dmg: 30, rate: 0.95, reach: 30, aoe: 26, stun: 0.45, kb: 130, desc: 'Each blow cracks the floor and stuns everything nearby.', cost: 90 },
  { id: 'scythe', name: 'Reaper Scythe', kind: 'melee', style: 'spin', dmg: 14, rate: 1.45, reach: 33, kb: 60, leech: 0.02, desc: 'A full circle of steel. Heals 2% of damage dealt.', cost: 110 },
  { id: 'gauntlets', name: 'Iron Fists', kind: 'melee', style: 'punch', dmg: 6, rate: 6.2, reach: 19, arc: 0.95, kb: 18, combo: 4, desc: 'Rapid punches. Every fourth one hits twice as hard and knocks foes back.', cost: 80 },
  { id: 'bow', name: 'Shortbow', kind: 'ranged', style: 'arrow', dmg: 10, rate: 2.4, speed: 300, life: 0.85, kb: 40, desc: 'Fast arrows with good range.', start: true },
  { id: 'crossbow', name: 'Crossbow', kind: 'ranged', style: 'bolt', dmg: 25, rate: 1.1, speed: 430, life: 0.7, pierce: 2, kb: 90, desc: 'Heavy bolts that punch through two foes.', cost: 70 },
  { id: 'knives', name: 'Throwing Knives', kind: 'ranged', style: 'knives', dmg: 7, rate: 2.6, speed: 290, life: 0.5, count: 3, spread: 0.32, kb: 25, desc: 'Throws a fan of three knives.', start: true },
  { id: 'boomerang', name: 'Boomerang', kind: 'ranged', style: 'boomerang', dmg: 12, rate: 1.5, speed: 250, life: 0.95, pierce: 99, kb: 45, desc: 'Curves out and back, cutting everything twice.', cost: 90 },
  { id: 'firestaff', name: 'Fire Staff', kind: 'ranged', style: 'fireball', dmg: 13, rate: 1.6, speed: 210, life: 0.9, aoe: 24, burn: 0.4, kb: 40, desc: 'Fireballs that burst on impact. 40% chance to burn.', start: true },
  { id: 'frostwand', name: 'Frost Wand', kind: 'ranged', style: 'shard', dmg: 4.6, rate: 5.6, speed: 330, life: 0.55, spread: 0.08, chill: 0.3, kb: 12, desc: 'A stream of ice shards. 30% chance to chill.', start: true },
  { id: 'stormrod', name: 'Storm Rod', kind: 'ranged', style: 'chain', dmg: 9, rate: 2.3, range: 125, chains: 3, shock: 0.15, kb: 20, desc: 'Lightning leaps between three foes. Never misses.', start: true },
  { id: 'venomtome', name: 'Venom Tome', kind: 'ranged', style: 'venom', dmg: 8, rate: 1.4, speed: 160, life: 0.8, aoe: 22, poison: 1, kb: 20, desc: 'Lobs toxic orbs that leave poison pools.', cost: 100 },
  { id: 'cannon', name: 'Hand Cannon', kind: 'ranged', style: 'blast', dmg: 5.5, rate: 1.2, speed: 340, life: 0.33, count: 6, spread: 0.6, kb: 120, desc: 'A close-range blast of six pellets.', cost: 120 },
  { id: 'orb', name: 'Arcane Orb', kind: 'ranged', style: 'missile', dmg: 9, rate: 2, speed: 175, life: 1.6, homing: 5, kb: 25, desc: 'Magic missiles that seek out foes.', cost: 100 },
];
const WEAPON = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

const AFFIXES = [
  { id: 'flaming', name: 'Flaming', desc: '+20% chance to burn', tag: 'fire', apply: (s) => { s.burnCh += 0.2; } },
  { id: 'venom', name: 'Venomous', desc: '+20% chance to poison', tag: 'venom', apply: (s) => { s.poisonCh += 0.2; } },
  { id: 'frost', name: 'Frozen', desc: '+20% chance to chill', tag: 'frost', apply: (s) => { s.chillCh += 0.2; } },
  { id: 'storm', name: 'Charged', desc: '+15% chance to shock', tag: 'storm', apply: (s) => { s.shockCh += 0.15; } },
  { id: 'vamp', name: 'Vampiric', desc: 'Heals 2% of damage dealt', apply: (s) => { s.lifesteal += 0.02; } },
  { id: 'swift', name: 'Swift', desc: '+20% attack speed', apply: (s) => { s.atkSpd += 0.2; } },
  { id: 'heavy', name: 'Heavy', desc: '+25% damage, 30% more knockback, 8% slower', apply: (s) => { s.wDmg += 0.25; s.kbMul += 0.3; s.atkSpd -= 0.08; } },
  { id: 'keen', name: 'Keen', desc: '+10% crit chance', apply: (s) => { s.crit += 0.1; } },
  { id: 'brutal', name: 'Brutal', desc: '+40% crit damage', apply: (s) => { s.critMul += 0.4; } },
  { id: 'reach', name: 'Long', desc: '+20% reach and range', apply: (s) => { s.reachMul += 0.2; } },
  { id: 'twin', name: 'Twin', desc: '+1 projectile', ranged: true, apply: (s) => { s.projBonus += 1; } },
  { id: 'pierce', name: 'Piercing', desc: '+1 pierce', ranged: true, apply: (s) => { s.pierceBonus += 1; } },
  { id: 'gilded', name: 'Gilded', desc: '+20% gold from foes', apply: (s) => { s.goldMul += 0.2; } },
  { id: 'thirsty', name: 'Bloodthirsty', desc: 'Kills heal 1 health', apply: (s) => { s.killHeal += 1; } },
];
const AFFIX = Object.fromEntries(AFFIXES.map((a) => [a.id, a]));

const LEGENDS = [
  { id: 'echo', name: 'Echoing', desc: 'Every fourth attack repeats itself.' },
  { id: 'inferno', name: 'Infernal', desc: 'Burning foes explode when they die.' },
  { id: 'tempest', name: 'Tempest', desc: 'Critical hits call lightning on the target.' },
  { id: 'ravenous', name: 'Ravenous', desc: 'Kills heal 3 health.' },
  { id: 'glacial', name: 'Glacial', desc: 'Chilled foes burst into ice shards when they die.' },
  { id: 'midas', name: 'Midas', desc: 'Hits have an 8% chance to knock loose a coin.' },
];
const LEGEND = Object.fromEntries(LEGENDS.map((a) => [a.id, a]));

/* ---------- abilities ---------- */
const ABILITIES = [
  { id: 'bash', name: 'Shield Bash', cd: 6, desc: 'Charge forward, stunning and hurling foes aside.', dmg: 26, start: true },
  { id: 'rain', name: 'Arrow Rain', cd: 8, desc: 'Arrows pour down on the target area for 1.5s.', dmg: 9, start: true },
  { id: 'meteor', name: 'Meteor', cd: 9, desc: 'A meteor crashes down after a moment, leaving fire behind.', dmg: 70, start: true },
  { id: 'shadowstep', name: 'Shadow Step', cd: 5, desc: 'Blink toward your aim. Your next two attacks are critical hits.', dmg: 0, start: true },
  { id: 'whirlwind', name: 'Whirlwind', cd: 9, desc: 'Spin for 2.5s, cutting everything around you.', dmg: 9, start: true },
  { id: 'chain', name: 'Chain Lightning', cd: 5, desc: 'A bolt that jumps between up to six foes.', dmg: 22, start: true },
  { id: 'legion', name: 'Bone Legion', cd: 14, desc: 'Raise three skeleton warriors to fight for 15s.', dmg: 10, cost: 0, cls: 'necro' },
  { id: 'fireball', name: 'Fireball', cd: 5, desc: 'Hurl a great fireball that bursts and burns.', dmg: 34, start: true },
  { id: 'nova', name: 'Frost Nova', cd: 8, desc: 'A ring of frost that freezes nearby foes solid.', dmg: 16, start: true },
  { id: 'slam', name: 'Ground Slam', cd: 8, desc: 'Leap to the target and crash down, stunning foes.', dmg: 38, start: true },
  { id: 'fan', name: 'Fan of Blades', cd: 6, desc: 'Throw fourteen blades in every direction.', dmg: 11, start: true },
  { id: 'heal', name: 'Mending Light', cd: 18, desc: 'Heal 25% of your health and shake off ailments.', dmg: 0, start: true },
  { id: 'warp', name: 'Time Warp', cd: 15, desc: 'For 4s, foes and their missiles crawl at 40% speed.', dmg: 0, cost: 80 },
  { id: 'turret', name: 'Arcane Turret', cd: 12, desc: 'Place a turret that fires at foes for 10s.', dmg: 8, cost: 70 },
  { id: 'wolf', name: 'Spirit Wolf', cd: 16, desc: 'Summon a ghostly wolf to fight beside you for 18s.', dmg: 12, cost: 90 },
  { id: 'cloud', name: 'Plague Cloud', cd: 10, desc: 'A choking cloud that poisons everything inside for 5s.', dmg: 0, cost: 70 },
  { id: 'barrier', name: 'Barrier', cd: 12, desc: 'Become untouchable for 2.5s and reflect missiles.', dmg: 0, cost: 80 },
];
const ABILITY = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
const AB_LEVEL = [null, { dmg: 1, cd: 1 }, { dmg: 1.4, cd: 0.88 }, { dmg: 1.85, cd: 0.76 }];

/* ---------- skills: offered three at a time on level up ---------- */
const SKILLS = [
  // offense
  { id: 'sharp', name: 'Whetstone', rar: 'common', max: 6, tag: 'offense', desc: '+10% damage', apply: (s) => { s.dmgMul += 0.1; } },
  { id: 'quick', name: 'Quick Hands', rar: 'common', max: 5, tag: 'offense', desc: '+10% attack speed', apply: (s) => { s.atkSpd += 0.1; } },
  { id: 'precision', name: 'Precision', rar: 'common', max: 5, tag: 'offense', desc: '+5% crit chance', apply: (s) => { s.crit += 0.05; } },
  { id: 'brutal', name: 'Executioner', rar: 'rare', max: 4, tag: 'offense', desc: '+30% crit damage', apply: (s) => { s.critMul += 0.3; } },
  { id: 'heavyb', name: 'Heavy Blows', rar: 'common', max: 3, tag: 'offense', desc: '+5% damage, 35% more knockback', apply: (s) => { s.dmgMul += 0.05; s.kbMul += 0.35; } },
  { id: 'reach', name: 'Long Reach', rar: 'common', max: 3, tag: 'offense', desc: '+15% weapon reach and range', apply: (s) => { s.reachMul += 0.15; } },
  { id: 'split', name: 'Split Shot', rar: 'rare', max: 2, tag: 'offense', need: 'ranged', desc: 'Ranged weapons fire +1 projectile', apply: (s) => { s.projBonus += 1; } },
  { id: 'pierce', name: 'Piercing Rounds', rar: 'common', max: 3, tag: 'offense', need: 'ranged', desc: 'Projectiles pierce +1 foe', apply: (s) => { s.pierceBonus += 1; } },
  { id: 'glass', name: 'Glass Cannon', rar: 'epic', max: 1, tag: 'offense', desc: '+35% damage, but 25% less max health', apply: (s) => { s.dmgMul += 0.35; s.hpMul -= 0.25; } },
  { id: 'firstblood', name: 'First Strike', rar: 'rare', max: 2, tag: 'offense', desc: '+50% damage to foes above 90% health', apply: (s) => { s.firstStrike += 0.5; } },
  { id: 'cull', name: 'Culling Blade', rar: 'epic', max: 1, tag: 'offense', desc: 'Foes under 12% health die on the next hit', apply: (s) => { s.cull = 0.12; } },
  { id: 'momentum', name: 'Momentum', rar: 'rare', max: 2, tag: 'offense', need: 'melee', desc: 'Every fourth melee swing sends out a cutting wave', apply: (s) => { s.wave += 1; } },
  { id: 'ricochet', name: 'Ricochet', rar: 'rare', max: 2, tag: 'offense', need: 'ranged', desc: 'Projectiles bounce to another foe', apply: (s) => { s.bounce += 1; } },
  { id: 'frenzy', name: 'Frenzy', rar: 'rare', max: 1, tag: 'offense', desc: 'Kills grant +5% attack speed for 4s, stacking 6 times', apply: (s) => { s.frenzy = true; } },
  // elements
  { id: 'kindle', name: 'Kindle', rar: 'common', max: 4, tag: 'fire', desc: '+10% chance to burn on hit', apply: (s) => { s.burnCh += 0.1; } },
  { id: 'toxin', name: 'Toxin', rar: 'common', max: 4, tag: 'venom', desc: '+10% chance to poison on hit', apply: (s) => { s.poisonCh += 0.1; } },
  { id: 'frostbite', name: 'Frostbite', rar: 'common', max: 4, tag: 'frost', desc: '+10% chance to chill on hit', apply: (s) => { s.chillCh += 0.1; } },
  { id: 'static', name: 'Static', rar: 'common', max: 4, tag: 'storm', desc: '+8% chance to shock on hit', apply: (s) => { s.shockCh += 0.08; } },
  { id: 'combust', name: 'Combustion', rar: 'epic', max: 1, tag: 'fire', desc: 'Burning foes explode when they die', apply: (s) => { s.combust = true; } },
  { id: 'plague', name: 'Plague', rar: 'rare', max: 1, tag: 'venom', desc: 'Poisoned foes spread their poison when they die', apply: (s) => { s.plague = true; } },
  { id: 'shatter', name: 'Shatter', rar: 'rare', max: 1, tag: 'frost', desc: 'Frozen foes take 60% more damage', apply: (s) => { s.shatter = 0.6; } },
  { id: 'overload', name: 'Overload', rar: 'rare', max: 2, tag: 'storm', desc: 'Shocks jump to 2 more foes', apply: (s) => { s.shockChain += 2; } },
  { id: 'pyre', name: 'Pyre', rar: 'rare', max: 2, tag: 'fire', desc: 'Burns deal 40% more damage', apply: (s) => { s.burnMul += 0.4; } },
  // defense
  { id: 'vital', name: 'Vitality', rar: 'common', max: 6, tag: 'defense', desc: '+20 max health and heal 20', apply: (s) => { s.hpAdd += 20; }, now: (p) => heal(p, 20) },
  { id: 'iron', name: 'Iron Skin', rar: 'common', max: 5, tag: 'defense', desc: '+1 armor (each point softens every hit)', apply: (s) => { s.armor += 1; } },
  { id: 'second', name: 'Second Wind', rar: 'common', max: 3, tag: 'defense', desc: 'Heal 7% of max health when a room is cleared', apply: (s) => { s.clearHeal += 0.07; } },
  { id: 'leech', name: 'Leech', rar: 'rare', max: 3, tag: 'defense', desc: 'Heal 2% of damage dealt', apply: (s) => { s.lifesteal += 0.02; } },
  { id: 'dodge', name: 'Evasion', rar: 'common', max: 4, tag: 'defense', desc: '+6% chance to dodge a hit', apply: (s) => { s.dodge += 0.06; } },
  { id: 'thorns', name: 'Thorns', rar: 'common', max: 3, tag: 'defense', desc: 'Foes that touch you take 15 damage', apply: (s) => { s.thorns += 15; } },
  { id: 'angel', name: 'Guardian Angel', rar: 'epic', max: 1, tag: 'defense', desc: 'Once per floor, survive a killing blow', apply: (s) => { s.angel = true; } },
  { id: 'regen', name: 'Regrowth', rar: 'rare', max: 3, tag: 'defense', desc: 'Regenerate 0.4 health per second', apply: (s) => { s.regen += 0.4; } },
  { id: 'bulwark', name: 'Bulwark', rar: 'rare', max: 1, tag: 'defense', desc: 'Block one hit every 12s', apply: (s) => { s.bulwark = 12; } },
  // utility
  { id: 'fleet', name: 'Fleet Foot', rar: 'common', max: 4, tag: 'utility', desc: '+7% move speed', apply: (s) => { s.spdMul += 0.07; } },
  { id: 'nimble', name: 'Nimble', rar: 'common', max: 3, tag: 'utility', desc: 'Dash recharges 20% faster', apply: (s) => { s.dashCd *= 0.8; } },
  { id: 'extradash', name: 'Double Dash', rar: 'rare', max: 2, tag: 'utility', desc: '+1 dash charge', apply: (s) => { s.dashMax += 1; } },
  { id: 'bladedash', name: 'Blade Dash', rar: 'rare', max: 1, tag: 'utility', desc: 'Dashing through foes cuts them for 120% weapon damage', apply: (s) => { s.bladeDash = 1.2; } },
  { id: 'magnet', name: 'Magnetism', rar: 'common', max: 2, tag: 'utility', desc: '+60% pickup range', apply: (s) => { s.pickR *= 1.6; } },
  { id: 'greed', name: 'Greed', rar: 'common', max: 3, tag: 'utility', desc: '+20% gold', apply: (s) => { s.goldMul += 0.2; } },
  { id: 'scholar', name: 'Scholar', rar: 'common', max: 3, tag: 'utility', desc: '+15% experience', apply: (s) => { s.xpMul += 0.15; } },
  { id: 'fortune', name: 'Fortune', rar: 'common', max: 3, tag: 'utility', desc: 'Better odds of rare loot', apply: (s) => { s.luck += 1; } },
  { id: 'alchemy', name: 'Alchemy', rar: 'common', max: 2, tag: 'utility', desc: '+1 potion slot (filled now), potions heal 25% more', apply: (s) => { s.potMax += 1; s.potHeal += 0.25; }, now: (p) => { p.potions += 1; } },
  // abilities
  { id: 'cdr', name: 'Haste', rar: 'common', max: 4, tag: 'ability', desc: 'Abilities recharge 12% faster', apply: (s) => { s.cdMul *= 0.88; } },
  { id: 'amp', name: 'Amplify', rar: 'common', max: 4, tag: 'ability', desc: '+20% ability damage', apply: (s) => { s.abDmg += 0.2; } },
  { id: 'echo', name: 'Echo Cast', rar: 'epic', max: 1, tag: 'ability', desc: '25% chance an ability recharges instantly', apply: (s) => { s.echoCast = 0.25; } },
  { id: 'surge', name: 'Arcane Surge', rar: 'rare', max: 1, tag: 'ability', desc: 'After an ability, your next 3 attacks deal 50% more', apply: (s) => { s.surge = true; } },
];
const SKILL = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
const SKILL_W = { common: 60, rare: 26, epic: 8 };

/* ---------- relics: unique, powerful, found in chests, shops and after bosses ---------- */
const RELICS = [
  { id: 'phoenix', name: 'Phoenix Feather', desc: 'When you would die, rise again with half your health. Burns away after.', apply: (s) => { s.phoenix = true; } },
  { id: 'fang', name: 'Vampire Fang', desc: 'Heal 5% of damage dealt.', apply: (s) => { s.lifesteal += 0.05; } },
  { id: 'chalice', name: 'Blood Chalice', desc: 'Kills heal 2 health.', apply: (s) => { s.killHeal += 2; } },
  { id: 'emberheart', name: 'Ember Heart', desc: '+25 max health. Fire and lava cannot hurt you.', apply: (s) => { s.hpAdd += 25; s.fireproof = true; } },
  { id: 'frostcrown', name: 'Frost Crown', desc: 'Foes near you are chilled.', apply: (s) => { s.chillAura = 52; } },
  { id: 'idol', name: 'Thunder Idol', desc: 'Every 6s, lightning strikes a random foe for 40 damage.', apply: (s) => { s.idol = 40; } },
  { id: 'coin', name: 'Lucky Coin', desc: '+30% gold and better loot.', apply: (s) => { s.goldMul += 0.3; s.luck += 2; } },
  { id: 'hourglass', name: 'Hourglass', desc: 'Abilities recharge 25% faster.', apply: (s) => { s.cdMul *= 0.75; } },
  { id: 'mirror', name: 'Mirror Shard', desc: '20% chance to send missiles back at their owner.', apply: (s) => { s.reflect += 0.2; } },
  { id: 'totem', name: 'Wolf Totem', desc: 'A spirit wolf follows you everywhere.', apply: (s) => { s.petWolf = true; } },
  { id: 'blades', name: 'Orbiting Blades', desc: 'Two blades circle you, cutting foes for 8 damage.', apply: (s) => { s.orbit += 2; } },
  { id: 'thorncrown', name: 'Crown of Thorns', desc: 'Foes that touch you take 60 damage. 10 less max health.', apply: (s) => { s.thorns += 60; s.hpAdd -= 10; } },
  { id: 'glasseye', name: 'Glass Eye', desc: '+15% crit chance.', apply: (s) => { s.crit += 0.15; } },
  { id: 'boots', name: 'Iron Boots', desc: '+2 armor. Spikes and knockback cannot touch you.', apply: (s) => { s.armor += 2; s.sturdy = true; } },
  { id: 'wings', name: 'Winged Boots', desc: '+15% move speed and +1 dash.', apply: (s) => { s.spdMul += 0.15; s.dashMax += 1; } },
  { id: 'satchel', name: "Alchemist's Satchel", desc: '+1 potion slot. Potions heal 50% more.', apply: (s) => { s.potMax += 1; s.potHeal += 0.5; }, now: (p) => { p.potions += 1; } },
  { id: 'seal', name: "Merchant's Seal", desc: 'Shop prices are 30% lower.', apply: (s) => { s.shopMul *= 0.7; } },
  { id: 'keyring', name: 'Skeleton Key', desc: 'Gain 3 keys. Locked chests hold better loot.', apply: (s) => { s.luck += 1; }, now: (p) => { p.keys += 3; } },
  { id: 'skull', name: 'Cursed Skull', desc: 'Foes have 25% more health, but drop 60% more gold and experience.', apply: (s) => { s.foeHp += 0.25; s.goldMul += 0.6; s.xpMul += 0.6; } },
  { id: 'powder', name: 'Black Powder', desc: 'Foes have a 15% chance to explode when they die.', apply: (s) => { s.boomOnKill += 0.15; } },
  { id: 'halo', name: 'Halo', desc: 'After 8s without being hit, gain a shield that blocks one hit.', apply: (s) => { s.halo = 8; } },
  { id: 'echostone', name: 'Echo Stone', desc: 'Attacks have a 25% chance to strike twice.', apply: (s) => { s.echoAtk += 0.25; } },
  { id: 'mark', name: "Hunter's Mark", desc: 'Your first hit on each foe deals double damage.', apply: (s) => { s.markFirst = true; } },
  { id: 'lantern', name: 'Soul Lantern', desc: '+25% embers and a brighter light.', apply: (s) => { s.emberMul += 0.25; s.light += 30; } },
  { id: 'gauntlet', name: 'Gilded Gauntlet', desc: '+1% damage for every 10 gold you carry, up to 40%.', apply: (s) => { s.goldDmg = true; } },
  { id: 'cloak', name: 'Bramble Cloak', desc: 'Dashing leaves a trail of thorns that cut foes.', apply: (s) => { s.dashThorns = true; } },
];
const RELIC = Object.fromEntries(RELICS.map((r) => [r.id, r]));

/* ---------- enemies ----------
   hp and dmg are floor-1 values; the floor multiplies them. ai picks the brain in 10_enemies. */
const ENEMIES = {
  // The Ossuary
  skeleton: { name: 'Skeleton', hp: 30, spd: 40, r: 6, dmg: 10, xp: 4, gold: 1, ai: 'melee', reach: 20, windup: 0.42, lunge: 150, sprite: 'skeleton', bone: true },
  archer: { name: 'Skeleton Archer', hp: 22, spd: 34, r: 6, dmg: 9, xp: 5, gold: 1, ai: 'archer', range: 150, rate: 1.6, shot: 'arrow', sprite: 'archer', bone: true },
  bat: { name: 'Bat', hp: 12, spd: 78, r: 5, dmg: 7, xp: 2, gold: 0.5, ai: 'flutter', fly: true, sprite: 'bat' },
  slime: { name: 'Slime', hp: 26, spd: 70, r: 6, dmg: 9, xp: 3, gold: 0.7, ai: 'hop', split: 'slimelet', sprite: 'slime', tint: '#5fd36a' },
  slimelet: { name: 'Slimelet', hp: 9, spd: 80, r: 4, dmg: 6, xp: 1, gold: 0.2, ai: 'hop', sprite: 'slime', tint: '#7fe38a', small: true },
  ghost: { name: 'Ghost', hp: 24, spd: 46, r: 6, dmg: 10, xp: 5, gold: 1, ai: 'ghost', fly: true, phase: true, sprite: 'ghost' },
  cultist: { name: 'Cultist', hp: 34, spd: 32, r: 6, dmg: 9, xp: 7, gold: 2, ai: 'caster', range: 140, rate: 2.6, shot: 'orb3', summon: 'skeleton', sprite: 'cultist' },
  // Mycelium Grotto
  sporeling: { name: 'Sporeling', hp: 34, spd: 36, r: 6, dmg: 9, xp: 4, gold: 1, ai: 'spore', sprite: 'sporeling' },
  spider: { name: 'Cave Spider', hp: 26, spd: 60, r: 6, dmg: 9, xp: 5, gold: 1, ai: 'spider', range: 120, rate: 2.4, shot: 'web', sprite: 'spider' },
  bloat: { name: 'Bloat', hp: 30, spd: 30, r: 7, dmg: 18, xp: 5, gold: 1, ai: 'bloat', sprite: 'bloat' },
  thornvine: { name: 'Thornvine', hp: 46, spd: 0, r: 7, dmg: 9, xp: 6, gold: 1, ai: 'turret', range: 170, rate: 2.2, shot: 'spread5', rooted: true, sprite: 'thornvine' },
  beetle: { name: 'Horn Beetle', hp: 52, spd: 34, r: 7, dmg: 14, xp: 7, gold: 2, ai: 'charger', armor: 0.25, sprite: 'beetle' },
  // The Frostvault
  wraith: { name: 'Frost Wraith', hp: 34, spd: 40, r: 6, dmg: 10, xp: 6, gold: 1, ai: 'caster', fly: true, range: 150, rate: 2.2, shot: 'icebolt', sprite: 'wraith' },
  wolf: { name: 'Frost Wolf', hp: 32, spd: 70, r: 6, dmg: 11, xp: 5, gold: 1, ai: 'lunger', sprite: 'wolf' },
  yeti: { name: 'Yeti', hp: 110, spd: 30, r: 10, dmg: 18, xp: 12, gold: 3, ai: 'slammer', big: true, sprite: 'yeti' },
  crystal: { name: 'Ice Crystal', hp: 50, spd: 0, r: 7, dmg: 9, xp: 6, gold: 1, ai: 'turret', range: 999, rate: 2.6, shot: 'ring8', rooted: true, sprite: 'crystal' },
  snowimp: { name: 'Snow Imp', hp: 26, spd: 46, r: 5, dmg: 12, xp: 5, gold: 1, ai: 'lobber', range: 160, rate: 2.6, shot: 'snowball', sprite: 'snowimp' },
  icebat: { name: 'Ice Bat', hp: 16, spd: 84, r: 5, dmg: 8, xp: 3, gold: 0.5, ai: 'flutter', fly: true, sprite: 'bat', tint: '#9fd8ff' },
  // Cinder Core
  imp: { name: 'Fire Imp', hp: 30, spd: 44, r: 5, dmg: 11, xp: 6, gold: 1, ai: 'blinker', range: 150, rate: 2.2, shot: 'fireball', fly: true, sprite: 'imp' },
  magma: { name: 'Magma Slime', hp: 40, spd: 70, r: 7, dmg: 12, xp: 5, gold: 1, ai: 'hop', split: 'magmalet', trail: 'fire', fireproof: true, sprite: 'slime', tint: '#ff7a2a' },
  magmalet: { name: 'Magma Blob', hp: 12, spd: 82, r: 4, dmg: 8, xp: 1, gold: 0.2, ai: 'hop', fireproof: true, sprite: 'slime', tint: '#ffa04a', small: true },
  emberknight: { name: 'Ember Knight', hp: 70, spd: 36, r: 7, dmg: 16, xp: 10, gold: 2, ai: 'melee', reach: 24, windup: 0.5, lunge: 170, shield: true, fireproof: true, sprite: 'emberknight' },
  bomber: { name: 'Goblin Bomber', hp: 30, spd: 42, r: 6, dmg: 20, xp: 6, gold: 2, ai: 'lobber', range: 170, rate: 3, shot: 'bomb', sprite: 'bomber' },
  salamander: { name: 'Salamander', hp: 44, spd: 50, r: 6, dmg: 6, xp: 7, gold: 1, ai: 'breather', range: 60, fireproof: true, sprite: 'salamander' },
  golem: { name: 'Obsidian Golem', hp: 140, spd: 26, r: 10, dmg: 20, xp: 14, gold: 3, ai: 'slammer', big: true, fireproof: true, throws: true, sprite: 'golem' },
  // allies (summoned by the hero)
  ally_skel: { name: 'Skeleton', hp: 40, spd: 64, r: 6, dmg: 10, ai: 'ally', sprite: 'skeleton', ally: true, tint: '#c8f5a8' },
  ally_wolf: { name: 'Spirit Wolf', hp: 60, spd: 96, r: 6, dmg: 12, ai: 'ally', sprite: 'wolf', ally: true, tint: '#9ff6ff', ghostly: true },
  turret: { name: 'Arcane Turret', hp: 1e9, spd: 0, r: 6, dmg: 8, ai: 'allyturret', sprite: 'turret', ally: true, rooted: true },
};

const BOSSES = {
  colossus: { name: 'The Bone Colossus', title: 'Warden of the Ossuary', hp: 1100, r: 18, dmg: 16, xp: 120, sprite: 'colossus', act: 0 },
  sporecap: { name: 'Mother Sporecap', title: 'Heart of the Grotto', hp: 1700, r: 20, dmg: 14, xp: 180, sprite: 'sporecap', act: 1, rooted: true },
  wyrm: { name: 'The Rime Wyrm', title: 'Coiled Beneath the Ice', hp: 2300, r: 11, dmg: 18, xp: 240, sprite: 'wyrm', act: 2 },
  king: { name: 'The Cinder King', title: 'Lord of the Deep', hp: 3600, r: 10, dmg: 20, xp: 400, sprite: 'king', act: 3 },
};

/* ---------- regions ---------- */
const ACTS = [
  { id: 'ossuary', name: 'The Ossuary', short: 'Ossuary', boss: 'colossus', hazard: 'spikes',
    enemies: [['skeleton', 10], ['archer', 6], ['bat', 6], ['slime', 5], ['ghost', 4], ['cultist', 3]],
    elites: ['skeleton', 'archer', 'cultist', 'ghost'],
    pal: { floor: '#4a4650', floor2: '#3f3b45', grout: '#2a2730', wall: '#5d5866', wallTop: '#24212a', wallDark: '#3a3642', accent: '#c8b48a', moss: '#4f6a46', light: '#ffb766' },
    dark: [10, 8, 18, 0.74], light: [255, 170, 90], music: { root: 57, mode: [0, 2, 3, 5, 7, 8, 10], tempo: 74 } },
  { id: 'grotto', name: 'Mycelium Grotto', short: 'Grotto', boss: 'sporecap', hazard: 'toxic',
    enemies: [['sporeling', 8], ['spider', 7], ['bloat', 5], ['thornvine', 4], ['beetle', 5], ['slime', 3], ['bat', 3]],
    elites: ['spider', 'beetle', 'sporeling', 'thornvine'],
    pal: { floor: '#34433f', floor2: '#2c3936', grout: '#1d2826', wall: '#4b5a52', wallTop: '#182220', wallDark: '#2f3c37', accent: '#c58cff', moss: '#5fc48a', light: '#9cf0d8' },
    dark: [6, 14, 18, 0.7], light: [120, 255, 210], music: { root: 55, mode: [0, 1, 3, 5, 7, 8, 10], tempo: 68 } },
  { id: 'frost', name: 'The Frostvault', short: 'Frostvault', boss: 'wyrm', hazard: 'ice',
    enemies: [['wraith', 6], ['wolf', 8], ['yeti', 3], ['crystal', 4], ['snowimp', 6], ['icebat', 5]],
    elites: ['wolf', 'wraith', 'snowimp', 'yeti'],
    pal: { floor: '#7d93a8', floor2: '#6c8299', grout: '#4b5d70', wall: '#a9c0d4', wallTop: '#2c3a4c', wallDark: '#6f8aa3', accent: '#dff6ff', moss: '#cfe9f7', light: '#bfe9ff' },
    dark: [12, 22, 40, 0.58], light: [190, 230, 255], music: { root: 62, mode: [0, 2, 3, 5, 7, 9, 10], tempo: 70 } },
  { id: 'core', name: 'Cinder Core', short: 'Core', boss: 'king', hazard: 'lava',
    enemies: [['imp', 7], ['magma', 6], ['emberknight', 5], ['bomber', 5], ['salamander', 5], ['golem', 2]],
    elites: ['emberknight', 'imp', 'bomber', 'salamander'],
    pal: { floor: '#3e2a26', floor2: '#352320', grout: '#1f1311', wall: '#5a3a30', wallTop: '#1a0e0c', wallDark: '#3a241e', accent: '#ff9a3c', moss: '#7a3a22', light: '#ff8a3c' },
    dark: [26, 6, 4, 0.66], light: [255, 130, 60], music: { root: 52, mode: [0, 1, 4, 5, 7, 8, 10], tempo: 84 } },
];
const FLOORS_PER_ACT = 3;
const TOTAL_FLOORS = ACTS.length * FLOORS_PER_ACT;

const ELITE_MODS = [
  { id: 'swift', name: 'Swift', color: '#8ad8ff' },
  { id: 'brute', name: 'Brute', color: '#ff7a5c' },
  { id: 'volatile', name: 'Volatile', color: '#ffb35e' },
  { id: 'vampiric', name: 'Vampiric', color: '#e2434f' },
  { id: 'shielded', name: 'Shielded', color: '#cfe9ff' },
  { id: 'splitter', name: 'Splitting', color: '#8fe05c' },
  { id: 'frenzied', name: 'Frenzied', color: '#ff6f9c' },
];

/* ---------- camp: permanent upgrades bought with embers ---------- */
const META = [
  { id: 'vigor', name: 'Vigor', desc: '+10 max health', costs: [25, 45, 70, 100, 140], apply: (s, r) => { s.hpAdd += 10 * r; } },
  { id: 'might', name: 'Might', desc: '+5% damage', costs: [30, 55, 85, 120, 170], apply: (s, r) => { s.dmgMul += 0.05 * r; } },
  { id: 'swiftness', name: 'Swiftness', desc: '+4% move speed', costs: [30, 60, 100], apply: (s, r) => { s.spdMul += 0.04 * r; } },
  { id: 'flask', name: 'Deep Flask', desc: '+1 potion carried', costs: [50, 120], apply: (s, r) => { s.potMax += r; } },
  { id: 'purse', name: 'Coin Purse', desc: 'Start each run with +20 gold', costs: [20, 40, 70], apply: () => {} },
  { id: 'insight', name: 'Insight', desc: '+8% experience', costs: [30, 60, 100], apply: (s, r) => { s.xpMul += 0.08 * r; } },
  { id: 'reroll', name: 'Second Thoughts', desc: '+1 skill reroll each run', costs: [40, 80, 130], apply: () => {} },
  { id: 'keen', name: 'Keen Eye', desc: '+3% crit chance', costs: [35, 70, 110], apply: (s, r) => { s.crit += 0.03 * r; } },
  { id: 'pull', name: 'Ember Pull', desc: '+10% embers', costs: [40, 80, 140], apply: (s, r) => { s.emberMul += 0.1 * r; } },
  { id: 'keys', name: 'Ring of Keys', desc: 'Start each run with +1 key', costs: [25, 60], apply: () => {} },
  { id: 'map', name: 'Cartographer', desc: 'Special rooms show on your map', costs: [60], apply: () => {} },
  { id: 'revive', name: 'Last Ember', desc: 'Once per run, rise again at 40% health', costs: [300], apply: () => {} },
];
const METAD = Object.fromEntries(META.map((m) => [m.id, m]));

const HEAT = [
  null,
  'Foes have 15% more health',
  'Elites appear more often',
  'Foes deal 15% more damage',
  'Foes move 10% faster',
  'Shops charge 25% more',
  'Bosses have 30% more health',
  'Health drops are rarer',
  'Enemy missiles fly 15% faster',
  'You start with 20% less max health',
  'Elites carry two modifiers',
];
const MAX_HEAT = HEAT.length - 1;

/* ---------- experience curve ---------- */
const xpToNext = (lv) => Math.round(12 + 12 * lv + 1.6 * lv * lv);

