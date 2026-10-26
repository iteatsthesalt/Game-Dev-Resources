/* ============================================================
   Cinderdeep — the Realm: 25 biome zones on a 5×5 map. Each zone
   is its own huge map of 10×10 chunks (128×128 tiles each) and
   only the zone you stand in is loaded. This file holds the data:
   biomes, the map, the monsters of every zone, and scaling.
   ============================================================ */
const REALM_SEED = hashStr('cinderdeep-realm-1');
const ZCH = 128, ZCN = 10, ZT = ZCH * ZCN, WGRID = 5;
Object.assign(TILE, { WATER: 11, SHALLOW: 12, TREE: 13 });
SOLID_TILE[TILE.WATER] = 1; SOLID_TILE[TILE.TREE] = 1;

/* ---------- the 25 biomes ---------- */
// at: [col, row] on the realm map. lvl: monster levels. g: ground colours. wl/ml: water and mountain lines.
const BIOMES = [
  { id: 'meadows', name: 'Verdant Meadows', at: [2, 2], lvl: [1, 7], song: 'w_meadow', wx: 'pollen', g: ['#5f9a3e', '#6aa646', '#538a36', '#7ab452'], road: '#b89a6a', water: ['#2f6a9a', '#4a8ac0'], cliff: ['#8a8478', '#5e5a52'], trees: [['oak', 5], ['birch', 2], ['bush', 3]], tdens: 0.32, rocks: 'grey', deco: ['flower', 'tuft', 'tuft', 'flower2', 'mushroom'], wl: 0.27, ml: 0.8, act: 0, house: 'timber', blurb: 'Rolling green fields around Emberhold, the capital.' },
  { id: 'whisper', name: 'Whispering Forest', at: [1, 2], lvl: [5, 11], song: 'w_forest', wx: 'leaves', g: ['#3e7a34', '#4a8a3c', '#35692c', '#58904a'], road: '#8a7050', water: ['#2a5a7a', '#3a7a9a'], cliff: ['#7a7468', '#4e4a42'], trees: [['oak', 4], ['pine', 3], ['bush', 2], ['bigoak', 1]], tdens: 0.62, rocks: 'mossy', deco: ['tuft', 'fern', 'mushroom', 'flower', 'stump'], wl: 0.25, ml: 0.82, act: 1, house: 'timber', blurb: 'Old woods full of bandits and boars.' },
  { id: 'sakura', name: 'Sakura Hills', at: [2, 1], lvl: [5, 11], song: 'w_sakura', wx: 'petals', g: ['#6aa04a', '#78ac56', '#5e9040', '#8ab866'], road: '#c8a888', water: ['#3a7aaa', '#5a9ac8'], cliff: ['#9a8a8a', '#6a5a5a'], trees: [['cherry', 6], ['bush', 2], ['pine', 1]], tdens: 0.3, rocks: 'grey', deco: ['petal', 'tuft', 'flower', 'lantern'], wl: 0.26, ml: 0.76, act: 0, house: 'pagoda', blurb: 'Blossom hills where the oni roam.' },
  { id: 'autumn', name: 'Autumn Vale', at: [3, 2], lvl: [6, 12], song: 'w_autumn', wx: 'leaves', g: ['#8a8a3a', '#9a8a40', '#7a7a32', '#a89a4a'], road: '#a07a4a', water: ['#2f5a7a', '#4a7a9a'], cliff: ['#8a7a68', '#5a4a3a'], trees: [['autumn', 5], ['autumn2', 3], ['bush', 2]], tdens: 0.4, rocks: 'grey', deco: ['leafpile', 'pumpkin', 'tuft', 'stump'], wl: 0.26, ml: 0.8, act: 0, house: 'timber', blurb: 'A harvest vale. The scarecrows walk at night.' },
  { id: 'savanna', name: 'Golden Savanna', at: [2, 4], lvl: [7, 13], song: 'w_savanna', wx: 'dust', g: ['#b8a048', '#c8ac52', '#a89040', '#d0b860'], road: '#c89a5a', water: ['#3a7a8a', '#5a9aa8'], cliff: ['#a88a5a', '#7a5e3a'], trees: [['acacia', 5], ['bush', 2], ['baobab', 1]], tdens: 0.12, rocks: 'sand', deco: ['tallgrass', 'tallgrass', 'tuft', 'bones'], wl: 0.2, ml: 0.84, act: 3, house: 'hut', blurb: 'Endless gold grass, lions and gnoll raiders.' },
  { id: 'pine', name: 'Pine Highlands', at: [1, 1], lvl: [10, 16], song: 'w_highland', wx: 'mist', g: ['#4a7a4a', '#527e50', '#3e6a40', '#6a8a62'], road: '#8a7a62', water: ['#2a5a7a', '#3a7a9a'], cliff: ['#8a8a8a', '#5a5a5e'], trees: [['pine', 7], ['pine2', 3], ['bush', 1]], tdens: 0.5, rocks: 'grey', deco: ['tuft', 'fern', 'stump', 'rockling'], wl: 0.24, ml: 0.66, act: 2, house: 'stone', blurb: 'Steep pine country ruled by trolls.' },
  { id: 'ossplains', name: 'Ossuary Plains', at: [3, 1], lvl: [10, 17], song: 'w_bone', wx: 'ash', night: 1.15, g: ['#7a7660', '#847e66', '#6a6654', '#948e74'], road: '#a89a7a', water: ['#3a4a5a', '#4a5a6a'], cliff: ['#a8a090', '#6e6858'], trees: [['deadtree', 4], ['bonespike', 3], ['bush', 1]], tdens: 0.16, rocks: 'bone', deco: ['bones', 'skull', 'tuft', 'grave'], wl: 0.22, ml: 0.82, act: 0, house: 'stone', blurb: 'The dead never stopped walking here. The Ossuary lies below.' },
  { id: 'murkmire', name: 'Murkmire Swamp', at: [1, 3], lvl: [12, 18], song: 'w_swamp', wx: 'swamp', night: 1.1, g: ['#4a5a32', '#52623a', '#3e4e2a', '#5a6a40'], road: '#6a5a3a', water: ['#2a3a2a', '#3e5236'], cliff: ['#5a5a4a', '#3a3a30'], trees: [['willow', 4], ['deadtree', 2], ['reedbush', 3]], tdens: 0.42, rocks: 'mossy', deco: ['reed', 'reed', 'lily', 'mushroom', 'tuft'], haz: 'toxic', wl: 0.4, ml: 0.86, act: 1, house: 'stilt', blurb: 'Fog, toads and the hags of the bog.' },
  { id: 'sporeveil', name: 'Sporeveil Grove', at: [2, 3], lvl: [12, 18], song: 'w_spore', wx: 'spores', night: 1.2, g: ['#3a4a46', '#42524c', '#32403c', '#4a6050'], road: '#6a5a6a', water: ['#2a3a4a', '#3a5a6a'], cliff: ['#5a6a62', '#3a4842'], trees: [['shroom', 5], ['shroom2', 3], ['glowshroom', 2]], tdens: 0.45, rocks: 'mossy', deco: ['mushroom', 'glowcap', 'spore', 'tuft'], haz: 'toxic', wl: 0.28, ml: 0.82, act: 1, house: 'mushroom', blurb: 'A glowing fungal wood. The Mycelium Grotto opens beneath it.' },
  { id: 'elderwood', name: 'Elderwood', at: [0, 1], lvl: [16, 23], song: 'w_forest', wx: 'leaves', night: 1.15, g: ['#2e5a2a', '#36662e', '#284e24', '#467a3a'], road: '#6a5a40', water: ['#1e4a5a', '#2e6a7a'], cliff: ['#5a6a50', '#3a4a32'], trees: [['bigoak', 5], ['oak', 3], ['pine', 2], ['bush', 2]], tdens: 0.72, rocks: 'mossy', deco: ['fern', 'mushroom', 'tuft', 'stump', 'flower'], wl: 0.24, ml: 0.84, act: 1, house: 'treehouse', blurb: 'Trees older than the kingdom, and angrier.' },
  { id: 'mangrove', name: 'Mangrove Coast', at: [0, 2], lvl: [18, 24], song: 'w_coast', wx: 'swamp', g: ['#6a7a4a', '#748452', '#5e6e40', '#c8b47a'], road: '#a89a6a', water: ['#2a6a7a', '#4a9aa0'], cliff: ['#7a7a62', '#4e4e40'], trees: [['mangrove', 6], ['palm', 2], ['reedbush', 2]], tdens: 0.4, rocks: 'sand', deco: ['reed', 'shell', 'tuft', 'lily'], wl: 0.42, ml: 0.88, act: 1, house: 'stilt', blurb: 'Roots, mud and crocodiles where the sea meets the swamp.' },
  { id: 'storm', name: 'Storm Steppes', at: [2, 0], lvl: [20, 28], song: 'w_steppe', wx: 'rain', night: 1.1, g: ['#6a7a5a', '#748262', '#5e6e50', '#8a9070'], road: '#8a8068', water: ['#2a4a6a', '#3a6a8a'], cliff: ['#7a7a80', '#4e4e56'], trees: [['deadtree', 2], ['bush', 3], ['stormpine', 2]], tdens: 0.1, rocks: 'grey', deco: ['tallgrass', 'tuft', 'rockling', 'tallgrass'], wl: 0.22, ml: 0.78, act: 2, house: 'tent', blurb: 'Wind, rain and lightning that never stops.' },
  { id: 'coral', name: 'Coral Shoals', at: [0, 3], lvl: [20, 26], song: 'w_coast', wx: 'sea', g: ['#e8d8a0', '#f0e0aa', '#dccc92', '#c8e8d8'], road: '#c8b080', water: ['#1e7aa0', '#3ab8c8'], cliff: ['#d8a8a0', '#a87070'], trees: [['palm', 6], ['coral', 3], ['bush', 1]], tdens: 0.18, rocks: 'coral', deco: ['shell', 'starfish', 'coralbit', 'tuft'], wl: 0.46, ml: 0.9, act: 2, house: 'hut', blurb: 'White sand, warm shallows and things beneath them.' },
  { id: 'frostpeak', name: 'Frostpeak Tundra', at: [1, 0], lvl: [22, 30], song: 'w_snow', wx: 'snow', g: ['#d8e4ec', '#e4eef4', '#c8d6e0', '#b8c8d4'], road: '#a8b4c0', water: ['#5a8ab0', '#8ab8d8'], cliff: ['#9aaabc', '#6a7a8c'], trees: [['snowpine', 6], ['deadtree', 1], ['icespike', 1]], tdens: 0.3, rocks: 'snow', deco: ['snowdrift', 'tuft', 'icecrystal'], haz: 'ice', wl: 0.25, ml: 0.72, act: 2, house: 'stone', blurb: 'Yetis, wolves and the Frostvault in the ice.' },
  { id: 'desert', name: 'Sunscorch Desert', at: [3, 4], lvl: [22, 30], song: 'w_desert', wx: 'sand', g: ['#e0c080', '#e8c888', '#d4b474', '#c8a868'], road: '#b8905a', water: ['#2a8aa0', '#4ab0c0'], cliff: ['#c89a62', '#9a6e40'], trees: [['cactus', 5], ['palm', 1], ['deadtree', 1]], tdens: 0.08, rocks: 'sand', deco: ['bones', 'dune', 'tuft', 'skull'], wl: 0.12, ml: 0.82, act: 3, house: 'adobe', blurb: 'Dunes, mummies and the worm beneath the sand.' },
  { id: 'ashlands', name: 'Ashlands', at: [4, 2], lvl: [26, 34], song: 'w_ash', wx: 'ash', night: 1.25, g: ['#4a4442', '#544c4a', '#3e3836', '#62584e'], road: '#6a5e54', water: ['#3a2a2a', '#5a3a2a'], cliff: ['#5a524e', '#383230'], trees: [['charred', 6], ['deadtree', 2]], tdens: 0.22, rocks: 'ash', deco: ['ember', 'bones', 'ashpile', 'tuft'], haz: 'lava', wl: 0.2, ml: 0.8, act: 3, house: 'stone', blurb: 'Burnt forest under a sky of falling ash.' },
  { id: 'canyon', name: 'Red Canyon', at: [3, 3], lvl: [26, 34], song: 'w_desert', wx: 'dust', g: ['#b8603a', '#c46a42', '#a85434', '#d08050'], road: '#c8905a', water: ['#2a6a7a', '#4a8a9a'], cliff: ['#a0482a', '#6e2e1a'], trees: [['cactus', 3], ['deadtree', 2], ['bush', 1]], tdens: 0.08, rocks: 'red', deco: ['bones', 'tuft', 'rockling', 'skull'], wl: 0.16, ml: 0.62, act: 3, house: 'adobe', blurb: 'Mesas and gulches full of outlaws.' },
  { id: 'jungle', name: 'Emerald Jungle', at: [0, 4], lvl: [24, 32], song: 'w_jungle', wx: 'rain', night: 1.2, g: ['#2e7a3a', '#368644', '#286a32', '#4a9a4a'], road: '#7a6a4a', water: ['#1e5a5a', '#2e7a7a'], cliff: ['#4a7a5a', '#2e4e3a'], trees: [['jungle', 5], ['palm', 2], ['bigoak', 1], ['fern', 3]], tdens: 0.7, rocks: 'mossy', deco: ['fern', 'flower2', 'flower', 'tuft'], wl: 0.3, ml: 0.82, act: 1, house: 'stilt', blurb: 'Hot, green and full of teeth.' },
  { id: 'feywild', name: 'Feywild Glade', at: [1, 4], lvl: [28, 36], song: 'w_fey', wx: 'fireflies', night: 0.7, g: ['#5aa08a', '#66ac96', '#4e907c', '#8ac8a8'], road: '#c8b8e8', water: ['#4a6aca', '#7a9ae8'], cliff: ['#8a7aaa', '#5a4a7a'], trees: [['feytree', 5], ['cherry', 2], ['glowshroom', 2]], tdens: 0.36, rocks: 'crystal', deco: ['flower', 'flower2', 'glowcap', 'fairyring'], wl: 0.28, ml: 0.82, act: 1, house: 'mushroom', blurb: 'Too beautiful. Do not eat anything here.' },
  { id: 'crystal', name: 'Crystal Barrens', at: [3, 0], lvl: [30, 38], song: 'w_crystal', wx: 'glitter', night: 0.85, g: ['#5a5a7a', '#646484', '#4e4e6a', '#7a7a9a'], road: '#9a9ab8', water: ['#4a5aaa', '#7a8ad8'], cliff: ['#7a7aa8', '#4a4a72'], trees: [['crystaltree', 5], ['icespike', 2]], tdens: 0.2, rocks: 'crystal', deco: ['crystalbit', 'crystalbit', 'tuft'], wl: 0.2, ml: 0.74, act: 2, house: 'crystal', blurb: 'A wasteland of singing crystal.' },
  { id: 'shadowfen', name: 'Shadowfen', at: [4, 1], lvl: [34, 42], song: 'w_dark', wx: 'mist', night: 1.5, dark: 0.45, g: ['#2e3438', '#363e42', '#282e30', '#3e4a48'], road: '#4a4a52', water: ['#141c22', '#22303a'], cliff: ['#3e4448', '#24282a'], trees: [['willow', 3], ['deadtree', 4], ['glowshroom', 1]], tdens: 0.4, rocks: 'mossy', deco: ['grave', 'skull', 'reed', 'wisplight'], haz: 'toxic', wl: 0.36, ml: 0.86, act: 0, house: 'stilt', blurb: 'Where light goes to drown.' },
  { id: 'caldera', name: 'Cinder Caldera', at: [4, 3], lvl: [36, 44], song: 'w_volcano', wx: 'embers', night: 1.1, dark: 0.25, g: ['#3a2826', '#44302c', '#32221e', '#5a3a2e'], road: '#6a4a3a', water: ['#ff6a1a', '#ffa03a'], cliff: ['#4a3430', '#2a1a16'], trees: [['charred', 4], ['obsidian', 3]], tdens: 0.14, rocks: 'obsidian', deco: ['ember', 'ashpile', 'bones'], haz: 'lava', lavaWater: true, wl: 0.24, ml: 0.74, act: 3, house: 'stone', blurb: 'The mountain is awake. The Cinder Core burns beneath.' },
  { id: 'glacier', name: 'Glacier Wastes', at: [0, 0], lvl: [38, 46], song: 'w_snow', wx: 'blizzard', g: ['#e8f0f8', '#f4f8fc', '#d8e6f0', '#c0d8ea'], road: '#b8c8d8', water: ['#7ab0d8', '#a8d4ec'], cliff: ['#a8c4dc', '#6a8aa8'], trees: [['icespike', 4], ['snowpine', 2]], tdens: 0.14, rocks: 'snow', deco: ['snowdrift', 'icecrystal', 'snowdrift'], haz: 'ice', iceWater: true, wl: 0.3, ml: 0.7, act: 2, house: 'igloo', blurb: 'A white silence. Giants live in it.' },
  { id: 'saltflats', name: 'Salt Flats', at: [4, 4], lvl: [40, 48], song: 'w_desert', wx: 'glitter', g: ['#ece8e0', '#f4f0ea', '#e0dcd2', '#d8d0c4'], road: '#c8bca8', water: ['#7ac0c8', '#a8e0e4'], cliff: ['#c8c0b4', '#8a8478'], trees: [['saltspire', 4], ['deadtree', 1]], tdens: 0.08, rocks: 'salt', deco: ['saltcrust', 'crystalbit', 'bones'], wl: 0.14, ml: 0.8, act: 3, house: 'adobe', blurb: 'Blinding white for as far as you can see.' },
  { id: 'voidscar', name: 'Voidscar Rift', at: [4, 0], lvl: [45, 52], song: 'w_void', wx: 'chaos', night: 1.4, dark: 0.35, g: ['#2a1e3a', '#342446', '#22182e', '#4a2a5a'], road: '#5a3a7a', water: ['#0a0612', '#3a1a5a'], cliff: ['#4a2a6a', '#24123a'], trees: [['voidtree', 4], ['tentacle', 2], ['crystaltree', 1]], tdens: 0.2, rocks: 'void', deco: ['eyes', 'voidbit', 'crystalbit'], haz: 'toxic', wl: 0.26, ml: 0.76, act: 3, house: 'crystal', blurb: 'The world is torn here. Something watches through the tear.' },
];
const BIOME = Object.fromEntries(BIOMES.map((b, i) => { b.idx = i; return [b.id, b]; }));
const zoneAt = (c, r) => BIOMES.find((b) => b.at[0] === c && b.at[1] === r) || null;

/* ---------- settlement names ---------- */
const TOWN_A = ['Ash', 'Bright', 'Cold', 'Deep', 'Elder', 'Fern', 'Gold', 'High', 'Iron', 'Low', 'Mill', 'North', 'Oak', 'Red', 'Salt', 'Thorn', 'Willow', 'Wolf', 'Stone', 'Raven', 'Dusk', 'Ember', 'Frost', 'Glen', 'Moss', 'Sun', 'Hollow', 'Black', 'Silver', 'Briar'];
const TOWN_B = ['ford', 'haven', 'wick', 'stead', 'brook', 'moor', 'vale', 'crest', 'well', 'gate', 'hollow', 'watch', 'barrow', 'field', 'march', 'mere', 'rest', 'reach', 'fall', 'cross'];
function townName(seed) { const r = new RNG(seed); return r.pick(TOWN_A) + r.pick(TOWN_B); }

/* ---------- monsters of the realm ---------- */
// [id, name, family, variant, colours [main, second, accent], ai, size, extra]
const W_MOBS = {
  meadows: [['w_mslime', 'Meadow Slime', 'slime', 'plain', ['#7fd36a', '#3f9a2a', '#ffffff'], 'hop', 1],
    ['w_gwolf', 'Grey Wolf', 'quad', 'wolf', ['#9a9488', '#6a6458', '#e8e0d0'], 'lunger', 1],
    ['w_gobscout', 'Goblin Scout', 'biped', 'goblin', ['#7ab04a', '#6a4a2a', '#c8b89a'], 'melee', 0.85, { gear: 'spear' }],
    ['w_gobsling', 'Goblin Slinger', 'biped', 'goblin', ['#8ab85a', '#5a4a3a', '#c8b89a'], 'archer', 0.85, { gear: 'sling', shot: 'bone' }],
    ['w_bee', 'Giant Bee', 'insect', 'bee', ['#ffd35c', '#2a2228', '#e8f4ff'], 'flutter', 0.9, { fly: true }]],
  whisper: [['w_boar', 'Thornback Boar', 'quad', 'boar', ['#7a5a3a', '#4a3424', '#e8d8b0'], 'charger', 1.1],
    ['w_fspider', 'Forest Spider', 'spider', 'plain', ['#3a4a2a', '#8fe05c', '#ff4a4a'], 'spider', 1],
    ['w_bandit', 'Bandit', 'biped', 'human', ['#d9a07a', '#6a4a3a', '#3a3a42'], 'melee', 1, { gear: 'sword' }],
    ['w_banarch', 'Bandit Archer', 'biped', 'human', ['#c99272', '#4a5a3a', '#3a3a42'], 'archer', 1, { gear: 'bow', shot: 'arrow' }],
    ['w_pixie', 'Pixie Wisp', 'wisp', 'pixie', ['#a8ff6a', '#ffffff', '#5aa84a'], 'blinker', 0.8, { fly: true, shot: 'thorn' }]],
  sakura: [['w_kitsune', 'Kitsune Spirit', 'quad', 'fox', ['#f4e8e8', '#ff9ac8', '#ffffff'], 'lunger', 0.95, { ghostly: true }],
    ['w_petal', 'Petal Sprite', 'wisp', 'pixie', ['#ffb8d8', '#ffffff', '#e86aa0'], 'caster', 0.8, { fly: true, shot: 'orb' }],
    ['w_ronin', 'Ronin', 'biped', 'human', ['#e2b896', '#3a3a5a', '#c8301a'], 'knight', 1, { gear: 'katana' }],
    ['w_tanuki', 'Tanuki Trickster', 'quad', 'tanuki', ['#8a6a4a', '#3a2a1a', '#e8d8c0'], 'blinker', 0.85, { shot: 'orb' }],
    ['w_oni', 'Oni Grunt', 'biped', 'oni', ['#d8402a', '#3a2a2a', '#f4ead0'], 'brute', 1.25, { gear: 'club' }]],
  autumn: [['w_pslime', 'Pumpkin Slime', 'slime', 'pumpkin', ['#ff9a3c', '#c8601a', '#5a8a2a'], 'hop', 1.05],
    ['w_scarecrow', 'Scarecrow', 'biped', 'scarecrow', ['#c8a050', '#6a4a2a', '#2a1a14'], 'melee', 1, { gear: 'scythe' }],
    ['w_crow', 'Harvest Crow', 'bird', 'crow', ['#2a2430', '#4a4058', '#ffd35c'], 'flutter', 0.85, { fly: true }],
    ['w_elk', 'Rutting Elk', 'quad', 'elk', ['#8a5a3a', '#5a3a24', '#e8d8b0'], 'charger', 1.2],
    ['w_leafgolem', 'Leaf Golem', 'golem', 'leaf', ['#c8701a', '#8a4a1a', '#ffd35c'], 'slammer', 1.15]],
  savanna: [['w_hyena', 'Hyena', 'quad', 'hyena', ['#b89a6a', '#5a4a3a', '#2a2218'], 'lunger', 0.95],
    ['w_lion', 'Savanna Lion', 'quad', 'lion', ['#d8a850', '#8a5a2a', '#5a3a1a'], 'charger', 1.15],
    ['w_vulture', 'Vulture', 'bird', 'vulture', ['#5a4a42', '#e8d0c0', '#c8401a'], 'flutter', 1, { fly: true }],
    ['w_gnoll', 'Gnoll Raider', 'biped', 'gnoll', ['#b8945a', '#6a4a2a', '#3a2a1a'], 'melee', 1.05, { gear: 'axe' }],
    ['w_gnollsham', 'Gnoll Shaman', 'biped', 'gnoll', ['#a88a5a', '#8a2a2a', '#ffd35c'], 'caster', 1, { gear: 'staff', shot: 'fireball' }]],
  pine: [['w_twolf', 'Timber Wolf', 'quad', 'wolf', ['#7a6a5a', '#4a3e34', '#e8e0d0'], 'lunger', 1.05],
    ['w_bear', 'Brown Bear', 'quad', 'bear', ['#6a4a2e', '#3e2a1a', '#2a1a12'], 'slammer', 1.35],
    ['w_goat', 'Highland Goat', 'quad', 'ram', ['#d8d0c0', '#8a8070', '#5a4a3a'], 'charger', 0.95],
    ['w_troll', 'Mountain Troll', 'biped', 'troll', ['#7a8a6a', '#4a5a3a', '#c8c0a0'], 'slammer', 1.45, { gear: 'club' }],
    ['w_owl', 'Great Owl', 'bird', 'owl', ['#8a7a62', '#e8dcc0', '#ffd35c'], 'flutter', 0.95, { fly: true }]],
  ossplains: [['w_skel', 'Wandering Skeleton', 'biped', 'skeleton', ['#e8e0cc', '#b8ae96', '#ff4a4a'], 'melee', 1, { gear: 'sword', bone: true }],
    ['w_bonehound', 'Bone Hound', 'quad', 'bonehound', ['#e8e0cc', '#8a8070', '#ff4a4a'], 'lunger', 1, { bone: true }],
    ['w_cbat', 'Carrion Bat', 'bat', 'plain', ['#5a3a4a', '#2a1a22', '#ff4a4a'], 'flutter', 1, { fly: true }],
    ['w_gghost', 'Grave Ghost', 'ghost', 'plain', ['#dfe8f2', '#a8c0d8', '#2a3040'], 'ghost', 1, { fly: true, phase: true }],
    ['w_skarch', 'Bone Archer', 'biped', 'skeleton', ['#d8d0bc', '#a89e86', '#ff4a4a'], 'archer', 1, { gear: 'bow', shot: 'arrow', bone: true }]],
  murkmire: [['w_bslime', 'Bog Slime', 'slime', 'bog', ['#6a7a3a', '#3a4a1a', '#c8ff6a'], 'hop', 1.1],
    ['w_stoad', 'Swamp Toad', 'toad', 'plain', ['#5a7a3a', '#c8b86a', '#ffd35c'], 'toad', 1.1],
    ['w_lizard', 'Lizardfolk', 'biped', 'lizard', ['#5a8a4a', '#3a5a2a', '#e8d8a0'], 'melee', 1.05, { gear: 'spear' }],
    ['w_hag', 'Mire Hag', 'biped', 'hag', ['#7a9a6a', '#3a2a3a', '#c8ff6a'], 'caster', 1, { gear: 'staff', shot: 'spore' }],
    ['w_bloatfly', 'Bloatfly', 'insect', 'fly', ['#8a9a4a', '#3a4a2a', '#ff4a4a'], 'bloat', 0.95, { fly: true }]],
  sporeveil: [['w_sporeling', 'Sporeling', 'fungus', 'small', ['#c43a5a', '#e8dcc8', '#d8ff9a'], 'spore', 1],
    ['w_myconid', 'Myconid Brute', 'fungus', 'brute', ['#8a5ac4', '#e8dcc8', '#c8ff6a'], 'slammer', 1.4],
    ['w_sbat', 'Spore Bat', 'bat', 'plain', ['#4a6a5a', '#2a3a32', '#c8ff6a'], 'flutter', 1, { fly: true }],
    ['w_gspider', 'Glowcap Spider', 'spider', 'glow', ['#2a3a4a', '#7fe8ff', '#c8ff6a'], 'spider', 1.05],
    ['w_swisp', 'Shroom Wisp', 'wisp', 'plain', ['#c8ff6a', '#ffffff', '#5fc48a'], 'caster', 0.9, { fly: true, shot: 'spore' }]],
  elderwood: [['w_sapling', 'Treant Sapling', 'plant', 'walker', ['#5a8a3a', '#6a4a2a', '#c8ff6a'], 'melee', 1.1],
    ['w_espider', 'Elder Spider', 'spider', 'big', ['#3a2e22', '#c8a050', '#ff4a4a'], 'spider', 1.3],
    ['w_dryad', 'Dryad', 'biped', 'dryad', ['#8ac86a', '#4a7a3a', '#ffd35c'], 'caster', 1, { shot: 'thorn' }],
    ['w_mossbear', 'Moss Bear', 'quad', 'bear', ['#4a6a3a', '#2e4a26', '#8a6a4a'], 'slammer', 1.4],
    ['w_thornv', 'Thornvine', 'plant', 'vine', ['#5aa84a', '#3a6a2a', '#d0507a'], 'turret', 1.05, { rooted: true, shot: 'spread5' }]],
  mangrove: [['w_mcrab', 'Mud Crab', 'crab', 'plain', ['#7a6a4a', '#4a3a2a', '#e8d8b0'], 'charger', 1],
    ['w_croc', 'Mangrove Croc', 'quad', 'croc', ['#4a6a3a', '#2a3a22', '#e8e0b0'], 'lunger', 1.25],
    ['w_fishman', 'Fishfolk', 'biped', 'fish', ['#4a8a8a', '#2a5a5a', '#e8e0b0'], 'melee', 1, { gear: 'spear' }],
    ['w_fishspear', 'Fishfolk Harpooner', 'biped', 'fish', ['#3a7aaa', '#2a4a6a', '#e8e0b0'], 'archer', 1, { gear: 'spear', shot: 'thorn' }],
    ['w_gull', 'Swamp Gull', 'bird', 'gull', ['#e8e8e0', '#8a8a8a', '#ffb35e'], 'flutter', 0.85, { fly: true }]],
  storm: [['w_shawk', 'Storm Hawk', 'bird', 'hawk', ['#6a6a7a', '#fff27a', '#ffffff'], 'flutter', 1, { fly: true }],
    ['w_tram', 'Thunder Ram', 'quad', 'ram', ['#8a8a9a', '#5a5a6a', '#fff27a'], 'charger', 1.1],
    ['w_spark', 'Spark Wisp', 'wisp', 'spark', ['#fff27a', '#ffffff', '#9ff6ff'], 'caster', 0.85, { fly: true, shot: 'icebolt' }],
    ['w_raider', 'Steppe Raider', 'biped', 'human', ['#c99272', '#5a5a6a', '#8a2a2a'], 'melee', 1.05, { gear: 'axe' }],
    ['w_selem', 'Storm Elemental', 'wisp', 'elemental', ['#9ff6ff', '#3a5e9a', '#fff27a'], 'elemental', 1.2, { fly: true }]],
  coral: [['w_rcrab', 'Reef Crab', 'crab', 'plain', ['#e2434f', '#a8202a', '#ffe0c0'], 'charger', 1],
    ['w_cgolem', 'Coral Golem', 'golem', 'coral', ['#ff8aa8', '#c8506a', '#ffe0e8'], 'slammer', 1.3],
    ['w_seasnake', 'Sea Serpent', 'serpent', 'eel', ['#3a8aaa', '#1a5a7a', '#ffd35c'], 'lunger', 1.1],
    ['w_jelly', 'Jellyfish', 'wisp', 'jelly', ['#c8a8ff', '#ffffff', '#ff8ad8'], 'ghost', 0.95, { fly: true }],
    ['w_merrow', 'Merrow', 'biped', 'fish', ['#3aaa8a', '#1a6a5a', '#ffd35c'], 'caster', 1, { shot: 'icebolt' }]],
  frostpeak: [['w_fwolf', 'Frost Wolf', 'quad', 'wolf', ['#e8eef6', '#9fb8d0', '#5a8aff'], 'lunger', 1.05],
    ['w_yeti', 'Yeti', 'biped', 'yeti', ['#e8eef6', '#8aa8c8', '#2a3a5a'], 'slammer', 1.5],
    ['w_iwraith', 'Ice Wraith', 'ghost', 'wraith', ['#a8d8f0', '#e9f8ff', '#3a6a9a'], 'caster', 1, { fly: true, shot: 'icebolt' }],
    ['w_simp', 'Snow Imp', 'biped', 'imp', ['#cfe6f8', '#8ab0d0', '#3a5a8a'], 'lobber', 0.8, { shot: 'snowball' }],
    ['w_fbat', 'Frost Bat', 'bat', 'plain', ['#9fd8ff', '#5a8ab0', '#ffffff'], 'flutter', 1, { fly: true }]],
  desert: [['w_scorp', 'Sand Scorpion', 'insect', 'scorpion', ['#c8964a', '#8a5a2a', '#3a2a1a'], 'charger', 1.05],
    ['w_dsnake', 'Dune Serpent', 'serpent', 'snake', ['#d8b070', '#8a6a3a', '#3a2a1a'], 'lunger', 1.05],
    ['w_mummy', 'Mummy', 'biped', 'mummy', ['#e8dcc0', '#a8987a', '#7fe8ff'], 'melee', 1.05, { gear: 'none' }],
    ['w_nomad', 'Desert Nomad', 'biped', 'human', ['#b8825a', '#e8dcc0', '#3a7a9a'], 'archer', 1, { gear: 'bow', shot: 'arrow' }],
    ['w_sandel', 'Sand Elemental', 'wisp', 'sand', ['#e8c888', '#a8844a', '#ffffff'], 'elemental', 1.15, { fly: true }]],
  ashlands: [['w_ghoul', 'Ash Ghoul', 'biped', 'ghoul', ['#6a6460', '#3a3432', '#ff7a2a'], 'melee', 1, { gear: 'none' }],
    ['w_chound', 'Cinder Hound', 'quad', 'hound', ['#3a2a28', '#ff7a2a', '#ffd08a'], 'hellhound', 1.05, { fireproof: true }],
    ['w_ewisp', 'Ember Wisp', 'wisp', 'fire', ['#ff9a3c', '#ffd08a', '#ff5a2a'], 'blinker', 0.85, { fly: true, shot: 'fireball', fireproof: true }],
    ['w_ctreant', 'Charred Treant', 'plant', 'walker', ['#3a3230', '#2a2220', '#ff7a2a'], 'slammer', 1.35],
    ['w_avulture', 'Ash Vulture', 'bird', 'vulture', ['#4a4442', '#8a8078', '#ff7a2a'], 'flutter', 1.05, { fly: true }]],
  canyon: [['w_clizard', 'Canyon Lizard', 'quad', 'lizard', ['#c8703a', '#7a3a1a', '#ffd35c'], 'lunger', 1],
    ['w_rgolem', 'Red Rock Golem', 'golem', 'stone', ['#b8603a', '#7a3a24', '#ffd08a'], 'slammer', 1.35, { throws: true }],
    ['w_harpy', 'Harpy', 'bird', 'harpy', ['#c8a080', '#8a5a3a', '#ffe0c0'], 'flutter', 1.05, { fly: true }],
    ['w_outlaw', 'Outlaw', 'biped', 'human', ['#c99272', '#7a5a3a', '#3a2a22'], 'archer', 1, { gear: 'gun', shot: 'bone' }],
    ['w_mscorp', 'Mesa Scorpion', 'insect', 'scorpion', ['#8a3a2a', '#4a1a14', '#ffd35c'], 'charger', 1.15]],
  jungle: [['w_panther', 'Jungle Panther', 'quad', 'cat', ['#2a2830', '#4a4658', '#ffd35c'], 'lunger', 1.05],
    ['w_pfrog', 'Poison Frog', 'toad', 'frog', ['#3aaaff', '#1a1a2a', '#ffd35c'], 'toad', 0.9],
    ['w_strangler', 'Vine Strangler', 'plant', 'vine', ['#3a8a3a', '#1e5a2a', '#ff4a8a'], 'turret', 1.1, { rooted: true, shot: 'spread5' }],
    ['w_lshaman', 'Lizard Shaman', 'biped', 'lizard', ['#3a9a6a', '#8a2a5a', '#ffd35c'], 'caster', 1, { gear: 'staff', shot: 'spore' }],
    ['w_parrot', 'Razorbeak Parrot', 'bird', 'parrot', ['#e2434f', '#3a8aff', '#ffd35c'], 'flutter', 0.85, { fly: true }]],
  feywild: [['w_pixie2', 'Pixie', 'wisp', 'pixie', ['#ff9ae8', '#ffffff', '#9a6aff'], 'blinker', 0.75, { fly: true, shot: 'orb' }],
    ['w_satyr', 'Satyr', 'biped', 'satyr', ['#c8906a', '#6a4a3a', '#e8d8b0'], 'melee', 1, { gear: 'club' }],
    ['w_thistle', 'Thistle Knight', 'biped', 'thistle', ['#5a8a6a', '#c873ff', '#e8d8ff'], 'knight', 1.05, { gear: 'sword' }],
    ['w_moth', 'Moon Moth', 'insect', 'moth', ['#c8d8ff', '#6a7ac8', '#ffffff'], 'flutter', 1.05, { fly: true }],
    ['w_feystag', 'Fey Stag', 'quad', 'stag', ['#e8f0ff', '#9aa8e8', '#ffd35c'], 'charger', 1.2, { ghostly: true }]],
  crystal: [['w_crgolem', 'Crystal Golem', 'golem', 'crystal', ['#9fe0ff', '#5a7ab8', '#ffffff'], 'slammer', 1.35],
    ['w_shard', 'Shardling', 'slime', 'crystal', ['#b8a8ff', '#6a5ac8', '#ffffff'], 'hop', 0.95],
    ['w_prism', 'Prism Wisp', 'wisp', 'prism', ['#ffffff', '#ff8ae8', '#8ae8ff'], 'caster', 0.9, { fly: true, shot: 'shard' }],
    ['w_crspider', 'Crystal Spider', 'spider', 'crystal', ['#6a6aaa', '#9fe0ff', '#ffffff'], 'spider', 1.1],
    ['w_gemlizard', 'Gem Lizard', 'quad', 'lizard', ['#5a8ac8', '#2a4a8a', '#ff8ae8'], 'lunger', 1]],
  shadowfen: [['w_shade', 'Shade', 'ghost', 'shade', ['#2a2430', '#5a4a6a', '#ff4a6a'], 'ghost', 1.05, { fly: true, phase: true }],
    ['w_wight', 'Bog Wight', 'biped', 'ghoul', ['#4a5a5a', '#2a3232', '#7fe8ff'], 'knight', 1.1, { gear: 'sword' }],
    ['w_ncrawler', 'Night Crawler', 'spider', 'plain', ['#1a1820', '#5a4a6a', '#ff4a6a'], 'spider', 1.15],
    ['w_whound', 'Wraith Hound', 'quad', 'hound', ['#2a2a36', '#5a5a7a', '#7fe8ff'], 'lunger', 1.05, { ghostly: true }],
    ['w_witchlight', 'Witchlight', 'wisp', 'plain', ['#7fe8ff', '#ffffff', '#3a6aaa'], 'blinker', 0.8, { fly: true, shot: 'orb' }]],
  caldera: [['w_magslime', 'Magma Slime', 'slime', 'magma', ['#ff7a2a', '#a8301c', '#ffd08a'], 'hop', 1.1, { fireproof: true, trail: 'fire' }],
    ['w_fimp', 'Fire Imp', 'biped', 'imp', ['#d8402a', '#3a1a1a', '#ffd08a'], 'blinker', 0.85, { fly: true, shot: 'fireball', fireproof: true }],
    ['w_salam', 'Lava Salamander', 'quad', 'salamander', ['#e8642a', '#8a2a14', '#ffd35c'], 'breather', 1.05, { fireproof: true }],
    ['w_obgolem', 'Obsidian Golem', 'golem', 'obsidian', ['#2e2630', '#4a3a48', '#ff7a2a'], 'slammer', 1.45, { fireproof: true, throws: true }],
    ['w_flamel', 'Flame Elemental', 'wisp', 'fire', ['#ff7a2a', '#ffd08a', '#a8301c'], 'elemental', 1.25, { fly: true, fireproof: true }]],
  glacier: [['w_igolem', 'Ice Golem', 'golem', 'ice', ['#bfe9ff', '#6a9ac8', '#ffffff'], 'slammer', 1.4],
    ['w_mammoth', 'Mammoth', 'quad', 'mammoth', ['#8a6a4a', '#5a4030', '#f4ead0'], 'charger', 1.6, { armor: 0.15 }],
    ['w_fgiant', 'Frost Giant', 'biped', 'giant', ['#9ab8d8', '#5a6a8a', '#e8f4ff'], 'brute', 1.6, { gear: 'axe' }],
    ['w_ispider', 'Ice Spider', 'spider', 'crystal', ['#cfefff', '#5a8ab0', '#ffffff'], 'spider', 1.1],
    ['w_gwisp', 'Glacial Wisp', 'wisp', 'plain', ['#e9f8ff', '#9fe0ff', '#5a8aff'], 'caster', 0.9, { fly: true, shot: 'icebolt' }]],
  saltflats: [['w_scrab', 'Salt Crab', 'crab', 'plain', ['#f4f0ea', '#a8a094', '#ff8a6a'], 'charger', 1.05],
    ['w_brine', 'Brine Elemental', 'slime', 'crystal', ['#e8f4f4', '#8ac8c8', '#ffffff'], 'hop', 1.2],
    ['w_mirage', 'Mirage Wraith', 'ghost', 'wraith', ['#fff4d8', '#e8c888', '#ff8a6a'], 'banshee', 1, { fly: true }],
    ['w_strider', 'Salt Strider', 'insect', 'strider', ['#d8d0c4', '#6a6258', '#ff8a6a'], 'lunger', 1.1],
    ['w_dustdevil', 'Dust Devil', 'wisp', 'sand', ['#f4f0ea', '#c8bca8', '#8a8478'], 'elemental', 1.15, { fly: true }]],
  voidscar: [['w_voidspawn', 'Void Spawn', 'horror', 'blob', ['#3a1a5a', '#ff4ad0', '#4affe0'], 'hop', 1.1],
    ['w_eyestalk', 'Eye Stalker', 'horror', 'eye', ['#5a2a7a', '#ff4ad0', '#ffffff'], 'caster', 1.15, { shot: 'big' }],
    ['w_cimp', 'Chaos Imp', 'biped', 'imp', ['#ff4ad0', '#3a1a5a', '#4affe0'], 'blinker', 0.85, { fly: true, shot: 'orb' }],
    ['w_rwraith', 'Rift Wraith', 'ghost', 'shade', ['#3a1a5a', '#9a4aff', '#4affe0'], 'caster', 1.05, { fly: true, phase: true, shot: 'orb' }],
    ['w_tentacle', 'Rift Tentacle', 'plant', 'tentacle', ['#5a2a7a', '#ff4ad0', '#4affe0'], 'turret', 1.2, { rooted: true, shot: 'ring8' }]],
};
// one champion (elite) and one world boss per zone: [id, name, family, variant, colours, ai, size, extra]
const W_ELITES = {
  meadows: ['w_gobchief', 'Goblin Warchief', 'biped', 'goblin', ['#6a9a3a', '#8a2a2a', '#ffd35c'], 'brute', 1.3, { gear: 'axe' }],
  whisper: ['w_bcapt', 'Bandit Captain', 'biped', 'human', ['#d9a07a', '#8a2a2a', '#ffd35c'], 'knight', 1.15, { gear: 'sword' }],
  sakura: ['w_onibrute', 'Oni Brute', 'biped', 'oni', ['#3a5ad8', '#2a2a3a', '#f4ead0'], 'brute', 1.5, { gear: 'club' }],
  autumn: ['w_scking', 'Scarecrow King', 'biped', 'scarecrow', ['#e8b050', '#3a2a1a', '#ff7a2a'], 'knight', 1.3, { gear: 'scythe' }],
  savanna: ['w_gnollwar', 'Gnoll Warlord', 'biped', 'gnoll', ['#8a6a3a', '#c8301a', '#ffd35c'], 'brute', 1.4, { gear: 'axe' }],
  pine: ['w_alpha', 'Alpha Wolf', 'quad', 'wolf', ['#4a4440', '#2a2420', '#ff4a4a'], 'lunger', 1.35],
  ossplains: ['w_dknight', 'Death Knight', 'biped', 'skeleton', ['#5a5a6a', '#2a2a3a', '#7fe8ff'], 'knight', 1.35, { gear: 'sword', bone: true }],
  murkmire: ['w_lizchief', 'Lizardfolk Chieftain', 'biped', 'lizard', ['#3a6a2a', '#c8a050', '#ffd35c'], 'brute', 1.35, { gear: 'axe' }],
  sporeveil: ['w_myelder', 'Myconid Elder', 'fungus', 'brute', ['#c43a5a', '#e8dcc8', '#ffd35c'], 'slammer', 1.7],
  elderwood: ['w_atreant', 'Ancient Treant', 'plant', 'walker', ['#3a6a2a', '#5a3a1a', '#ffd35c'], 'slammer', 1.8],
  mangrove: ['w_tidecall', 'Fishfolk Tidecaller', 'biped', 'fish', ['#2a6aaa', '#1a3a6a', '#7fe8ff'], 'frostmage', 1.2],
  storm: ['w_khan', 'Raider Khan', 'biped', 'human', ['#b8825a', '#3a3a5a', '#fff27a'], 'knight', 1.3, { gear: 'axe' }],
  coral: ['w_hermit', 'Giant Hermit Crab', 'crab', 'hermit', ['#e2434f', '#ff8aa8', '#ffe0c0'], 'charger', 1.6, { armor: 0.25 }],
  frostpeak: ['w_yetialpha', 'Yeti Alpha', 'biped', 'yeti', ['#f4f8fc', '#5a8ab8', '#ff4a4a'], 'slammer', 1.8],
  desert: ['w_mumlord', 'Mummy Lord', 'biped', 'mummy', ['#e8d4a0', '#c8a040', '#7fe8ff'], 'frostmage', 1.3],
  ashlands: ['w_revenant', 'Ash Revenant', 'biped', 'ghoul', ['#4a4442', '#ff7a2a', '#ffd08a'], 'knight', 1.35, { gear: 'sword', fireproof: true }],
  canyon: ['w_outboss', 'Outlaw Boss', 'biped', 'human', ['#c99272', '#2a2a2a', '#ffd35c'], 'archer', 1.25, { gear: 'gun', shot: 'bone' }],
  jungle: ['w_ape', 'Silverback', 'biped', 'ape', ['#3a3a42', '#9a9aa8', '#2a2a30'], 'brute', 1.6],
  feywild: ['w_feychamp', "Queen's Champion", 'biped', 'thistle', ['#c873ff', '#ffd35c', '#ffffff'], 'knight', 1.35, { gear: 'sword' }],
  crystal: ['w_prismcol', 'Prismatic Colossus', 'golem', 'crystal', ['#ff8ae8', '#8a5ac8', '#ffffff'], 'slammer', 1.8],
  shadowfen: ['w_wightking', 'Wight King', 'biped', 'ghoul', ['#3a4a4a', '#ffd35c', '#7fe8ff'], 'knight', 1.4, { gear: 'sword' }],
  caldera: ['w_emberk', 'Ember Champion', 'biped', 'knight', ['#3a3038', '#ff7a2a', '#ffd08a'], 'knight', 1.35, { gear: 'sword', fireproof: true }],
  glacier: ['w_jarl', 'Frost Giant Jarl', 'biped', 'giant', ['#7a9ac8', '#ffd35c', '#e8f4ff'], 'brute', 1.9, { gear: 'axe' }],
  saltflats: ['w_behemoth', 'Salt Behemoth', 'golem', 'salt', ['#f4f0ea', '#a8a094', '#ff8a6a'], 'slammer', 1.9],
  voidscar: ['w_voidlord', 'Voidlord', 'horror', 'eye', ['#2a1040', '#ff4ad0', '#4affe0'], 'elemental', 1.6, { fly: true }],
};
const W_BOSSES = {
  meadows: ['wb_bramble', 'Old Bramblehorn', 'quad', 'stag', ['#7a5a3a', '#3a6a2a', '#e8d8b0'], 'charge', 2.8],
  whisper: ['wb_mossjaw', 'Mossjaw the Ancient', 'quad', 'bear', ['#4a5a32', '#2a3a1e', '#e8d8b0'], 'slam', 3.0],
  sakura: ['wb_onilord', 'The Oni Lord', 'biped', 'oni', ['#a82020', '#2a1a1a', '#ffd35c'], 'slam', 2.6, { gear: 'club' }],
  autumn: ['wb_pumpking', 'The Great Gourd', 'golem', 'pumpkin', ['#ff8a2a', '#5a3a1a', '#ffd35c'], 'slam', 2.8],
  savanna: ['wb_sunclaw', 'King Sunclaw', 'quad', 'lion', ['#e8b850', '#8a3a1a', '#3a1a0a'], 'charge', 2.8],
  pine: ['wb_gorrak', 'Gorrak the Troll King', 'biped', 'troll', ['#6a7a5a', '#8a2a2a', '#ffd35c'], 'slam', 2.8, { gear: 'club' }],
  ossplains: ['wb_bonetyrant', 'The Bone Tyrant', 'golem', 'bone', ['#e8e0cc', '#8a8070', '#ff4a4a'], 'nova', 2.8],
  murkmire: ['wb_grandmire', 'Grandmother Mire', 'toad', 'plain', ['#4a6a2a', '#c8b86a', '#ff4a4a'], 'summon', 3.2],
  sporeveil: ['wb_funcol', 'The Fungal Colossus', 'fungus', 'brute', ['#8a2a6a', '#e8dcc8', '#c8ff6a'], 'nova', 2.8],
  elderwood: ['wb_heartwood', 'Heartwood the Undying', 'plant', 'walker', ['#2e5a22', '#4a2e18', '#c8ff6a'], 'summon', 3.0],
  mangrove: ['wb_snapjaw', 'Old Snapjaw', 'quad', 'croc', ['#3a5a2a', '#1e2e18', '#ffd35c'], 'charge', 3.0],
  storm: ['wb_thunderbird', 'The Thunderbird', 'bird', 'hawk', ['#3a3a5a', '#fff27a', '#9ff6ff'], 'storm', 2.8, { fly: true }],
  coral: ['wb_maw', "The Leviathan's Maw", 'serpent', 'eel', ['#1a6a8a', '#ff8aa8', '#ffd35c'], 'nova', 3.0],
  frostpeak: ['wb_grimfrost', 'Grimfrost the Yeti King', 'biped', 'yeti', ['#f4f8fc', '#3a5a8a', '#7fe8ff'], 'frost', 2.8],
  desert: ['wb_sandworm', 'The Sandworm', 'serpent', 'worm', ['#d8b070', '#8a5a2a', '#ff7a5a'], 'charge', 3.2],
  ashlands: ['wb_behemoth', 'The Ashen Behemoth', 'golem', 'obsidian', ['#4a4442', '#ff7a2a', '#ffd08a'], 'fire', 3.0],
  canyon: ['wb_bloodrock', 'Bloodrock the Mesa Titan', 'golem', 'stone', ['#a84a2a', '#5a2a1a', '#ffd35c'], 'slam', 3.2],
  jungle: ['wb_jade', 'The Jade Serpent', 'serpent', 'snake', ['#2aaa6a', '#ffd35c', '#e2434f'], 'nova', 3.0],
  feywild: ['wb_thornqueen', 'The Thorn Queen', 'biped', 'dryad', ['#c873ff', '#3a8a5a', '#ffd35c'], 'summon', 2.6],
  crystal: ['wb_prism', 'The Shattered Prism', 'golem', 'crystal', ['#ffffff', '#ff8ae8', '#8ae8ff'], 'nova', 3.0],
  shadowfen: ['wb_drowned', 'The Drowned Witch', 'biped', 'hag', ['#3a5a5a', '#1a2a2a', '#7fe8ff'], 'summon', 2.6],
  caldera: ['wb_pyroclast', 'Pyroclast, Mountain Heart', 'golem', 'obsidian', ['#2a1a1a', '#ff5a1a', '#ffd08a'], 'fire', 3.4],
  glacier: ['wb_rimeheart', 'Rimeheart the Glacier Wyrm', 'serpent', 'eel', ['#cfefff', '#5a8ab0', '#ffffff'], 'frost', 3.2],
  saltflats: ['wb_salttitan', 'The Salt Titan', 'golem', 'salt', ['#f4f0ea', '#c8bca8', '#ff8a6a'], 'slam', 3.4],
  voidscar: ['wb_unmaker', 'The Unmaker', 'horror', 'eye', ['#1a0a2a', '#ff4ad0', '#4affe0'], 'chaos', 3.2, { fly: true }],
};

/* ---------- base numbers by behaviour ---------- */
const W_AI_BASE = {
  hop: { hp: 28, spd: 70, dmg: 9, r: 6, xp: 3, gold: 0.7 },
  lunger: { hp: 32, spd: 70, dmg: 11, r: 6, xp: 5, gold: 1 },
  charger: { hp: 52, spd: 36, dmg: 14, r: 7, xp: 7, gold: 1.5, armor: 0.15 },
  melee: { hp: 36, spd: 40, dmg: 10, r: 6, xp: 5, gold: 1.2, reach: 20, windup: 0.45, lunge: 150 },
  knight: { hp: 64, spd: 36, dmg: 14, r: 7, xp: 9, gold: 2, reach: 24, windup: 0.5, lunge: 165, shield: true },
  archer: { hp: 24, spd: 34, dmg: 9, r: 6, xp: 5, gold: 1.2, range: 150, rate: 1.8 },
  caster: { hp: 32, spd: 34, dmg: 9, r: 6, xp: 6, gold: 1.5, range: 145, rate: 2.4 },
  flutter: { hp: 14, spd: 80, dmg: 7, r: 5, xp: 2, gold: 0.5 },
  spider: { hp: 26, spd: 60, dmg: 9, r: 6, xp: 5, gold: 1, range: 120, rate: 2.4, shot: 'web' },
  turret: { hp: 48, spd: 0, dmg: 9, r: 7, xp: 6, gold: 1, range: 175, rate: 2.2 },
  ghost: { hp: 26, spd: 46, dmg: 10, r: 6, xp: 5, gold: 1 },
  slammer: { hp: 110, spd: 30, dmg: 18, r: 10, xp: 12, gold: 3, big: true },
  brute: { hp: 96, spd: 34, dmg: 17, r: 9, xp: 11, gold: 3, big: true },
  lobber: { hp: 26, spd: 46, dmg: 12, r: 5, xp: 5, gold: 1, range: 160, rate: 2.6 },
  blinker: { hp: 30, spd: 44, dmg: 11, r: 5, xp: 6, gold: 1.2, range: 150, rate: 2.2 },
  breather: { hp: 44, spd: 50, dmg: 6, r: 6, xp: 7, gold: 1, range: 60 },
  spore: { hp: 34, spd: 36, dmg: 9, r: 6, xp: 4, gold: 1 },
  bloat: { hp: 30, spd: 34, dmg: 18, r: 7, xp: 5, gold: 1 },
  toad: { hp: 44, spd: 60, dmg: 11, r: 7, xp: 6, gold: 1, range: 74 },
  frostmage: { hp: 40, spd: 36, dmg: 11, r: 6, xp: 8, gold: 2, range: 170, rate: 3.2 },
  elemental: { hp: 54, spd: 40, dmg: 12, r: 7, xp: 9, gold: 2, rate: 2.4 },
  hellhound: { hp: 46, spd: 76, dmg: 13, r: 7, xp: 8, gold: 2, trail: 'fire' },
  banshee: { hp: 32, spd: 44, dmg: 9, r: 6, xp: 7, gold: 1, range: 130, rate: 3.6 },
};
function makeWorldDef(row, zone, role) {
  const [id, name, fam, v, c, ai, size, ex = {}] = row;
  const B = W_AI_BASE[ai] || W_AI_BASE.melee, k = size || 1;
  const def = {
    name, zone, fam, v, c, size: k, world: true, role,
    hp: Math.round(B.hp * (0.6 + 0.4 * k * k)), spd: B.spd * (k > 1.3 ? 0.85 : 1), r: Math.round(B.r * Math.sqrt(k) * 10) / 10, dmg: Math.round(B.dmg * (0.75 + 0.25 * k) * 10) / 10,
    xp: Math.round(B.xp * (0.7 + 0.3 * k * k) * 10) / 10, gold: B.gold * k, ai, sprite: 'w:' + id,
    reach: B.reach, windup: B.windup, lunge: B.lunge, range: B.range, rate: B.rate, shot: ex.shot || B.shot || (ai === 'turret' ? 'spread5' : ai === 'lobber' ? 'snowball' : ai === 'caster' ? 'orb' : ai === 'archer' ? 'arrow' : undefined),
    shield: B.shield, big: B.big || k >= 1.35, armor: ex.armor ?? B.armor ?? 0, trail: ex.trail || B.trail, fly: !!ex.fly, phase: !!ex.phase, rooted: !!ex.rooted,
    fireproof: !!ex.fireproof, bone: !!ex.bone, ghostly: !!ex.ghostly, throws: !!ex.throws, gear: ex.gear, blood: null,
  };
  if (role === 'elite') { def.hp = Math.round(def.hp * 3.2); def.dmg *= 1.35; def.xp *= 6; def.gold *= 6; def.champion = true; }
  return def;
}
const WORLD_KINDS = {};
const W_BOSS_DEF = {};
for (const b of BIOMES) {
  b.mobs = (W_MOBS[b.id] || []).map((row) => { const d = makeWorldDef(row, b.id, 'mob'); ENEMIES[row[0]] = d; WORLD_KINDS[row[0]] = d; return row[0]; });
  const el = W_ELITES[b.id]; if (el) { const d = makeWorldDef(el, b.id, 'elite'); ENEMIES[el[0]] = d; WORLD_KINDS[el[0]] = d; b.elite = el[0]; }
  const bo = W_BOSSES[b.id];
  if (bo) { const [id, name, fam, v, c, pattern, size, ex = {}] = bo; W_BOSS_DEF[id] = { id, name, fam, v, c, pattern, size, zone: b.id, fly: !!ex.fly, gear: ex.gear, title: `Terror of ${b.name}` }; b.boss = id; }
}

/* ---------- scaling by level ---------- */
const worldHpMul = (L) => 1 + 0.07 * (L - 1) + 0.0022 * (L - 1) * (L - 1);
const worldDmgMul = (L) => 1 + 0.045 * (L - 1);
const worldIdx = (L) => Math.max(0, Math.min(18, Math.floor((L - 1) * 0.36)));
const worldXpMul = (L) => 1 + 0.32 * L;
// the act whose dungeon a zone holds, and whose tiles and enemies an instance uses
const ACT_FOR_ZONE = (b) => b.act ?? 0;

