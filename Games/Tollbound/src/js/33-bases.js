// 33-bases.js: the bases finds are made from (docs/design/04-progression.md, "Finds"): for each slot the design names
// (tool, hat, coat, hands, girdle, pattens, token), what was worn and carried in the drowned city, each with its one
// fixed line. Only a tool has a family: the six trade tools, each with the fixed line 03-classes.md gives it. The gear
// each class starts with is here, the Change-ringer's bell-rope and ringer's jerkin among it (its class names them in
// startGear, 31-change-ringer.js); the other classes name theirs when they come. A base's tables lean the lines a toll
// writes on it: the weight it gives an entry of a posture's table (34-postures.js), times the entry's own w, 1 where
// it names none, so a bell-rope takes lines for round voices and the pull, pattens lines for planted feet.
// Owns: (none)
// Public: nothing; it only registers definitions with Defs.add:
//   base  tools    'base.bell-rope', 'base.verge', 'base.toll-pike', 'base.lamp-pole', 'base.hand-bellows',
//                  'base.grave-spade'
//         hats     'base.broad-hat', 'base.weeper-hat', 'base.tarred-cap', 'base.founders-coif'
//         coats    'base.ringers-jerkin', 'base.vergers-gown', 'base.oilskin', 'base.leather-apron',
//                  'base.watermans-smock', 'base.mourning-cloak'
//         hands    'base.tow-mitts', 'base.bearers-gloves', 'base.clapper-gloves'
//         girdles  'base.knotted-girdle', 'base.purse-belt', 'base.sally-cord'
//         pattens  'base.pattens', 'base.river-boots', 'base.felt-slippers'
//         tokens   'base.mourning-ring', 'base.bell-brass', 'base.sand-glass', 'base.tally-stick', 'base.coffin-plate'
//         named    'base.great-hours-baldrick' (a girdle) and 'base.keepers-muffle' (a token): finds with a name of
//                  their own and a strong fixed line, which alone of the bases use more; rare
// Every base is of level 1, so all of them drop in the Dial (Items.draw: a district drops the bases of its level and
// below), and none waits for a bequest (unlock null). weight: how often each drops, against the others: the gear of
// every day 2 to 3, the trade tools of the other classes 1.5, the named 0.25. icon: the glyph of the slot
// (75-finds.js draws them), the same for every find of a slot: a find's worth is its notches, not its look.
(function () {
  'use strict';

  // ---- tools: the six trade tools ----

  Defs.add('base', {
    id: 'base.bell-rope', name: 'Bell-rope', text: 'A tower rope with its striped sally, cut down when its bell fell dumb.',
    slot: 'tool', family: 'rope', level: 1, fixed: { stat: 'pull-window', op: 'flat', min: 0.05, max: 0.05 },
    tables: { stood: { verbs: { 'set-sooner': 3 }, objects: { round: 2 } }, pressed: { verbs: { pull: 3 }, objects: { round: 2 } } },
    icon: 'find.tool', unlock: null, weight: 3,
  });
  Defs.add('base', {
    id: 'base.verge', name: 'Verge', text: 'A verger\'s rod of office, round-headed, for clearing a way through a crowd.',
    slot: 'tool', family: 'verge', level: 1, fixed: { stat: 'wedge-length', op: 'flat', min: 0.5, max: 0.5 },
    tables: { strode: { verbs: { wedge: 4 }, objects: { line: 2, moving: 1.5 } } },
    icon: 'find.tool', unlock: null, weight: 1.5,
  });
  Defs.add('base', {
    id: 'base.toll-pike', name: 'Toll-pike', text: 'The pike a toll-gatherer barred the road with until the fee was paid.',
    slot: 'tool', family: 'pike', level: 1, fixed: { stat: 'bar-length', op: 'flat', min: 1, max: 1 },
    tables: { pressed: { verbs: { bar: 4 } }, timed: { objects: { timed: 1.5 } } },
    icon: 'find.tool', unlock: null, weight: 1.5,
  });
  Defs.add('base', {
    id: 'base.lamp-pole', name: 'Lamp-pole', text: 'A long pole with a wick at its tip, for lamps out of reach.',
    slot: 'tool', family: 'pole', level: 1, fixed: { stat: 'lamp-burn', op: 'flat', min: 5, max: 5 },
    tables: { timed: { verbs: { lamp: 4 } } },
    icon: 'find.tool', unlock: null, weight: 1.5,
  });
  Defs.add('base', {
    id: 'base.hand-bellows', name: 'Hand-bellows', text: 'Two hinged boards and a leather lung, from an organ loft.',
    slot: 'tool', family: 'bellows', level: 1, fixed: { stat: 'chest-size', op: 'flat', min: 5, max: 5 },
    tables: { timed: { verbs: { wind: 4 } }, stood: { objects: { still: 1.5 } } },
    icon: 'find.tool', unlock: null, weight: 1.5,
  });
  Defs.add('base', {
    id: 'base.grave-spade', name: 'Grave-spade', text: 'A narrow spade worn bright along its edge.',
    slot: 'tool', family: 'spade', level: 1, fixed: { stat: 'dig-rate', op: 'inc', min: 10, max: 10 },
    tables: { stood: { verbs: { digging: 4 } } },
    icon: 'find.tool', unlock: null, weight: 1.5,
  });

  // ---- hats ----

  Defs.add('base', {
    id: 'base.broad-hat', name: 'Broad Hat', text: 'A flat hat with a brim wide enough to keep the rain off a ledger.',
    slot: 'hat', family: null, level: 1, fixed: { stat: 'warn', op: 'flat', min: 0.03, max: 0.06 },
    tables: { timed: { objects: { timed: 1.5 } } },
    icon: 'find.hat', unlock: null, weight: 2,
  });
  Defs.add('base', {
    id: 'base.weeper-hat', name: 'Weeper Hat', text: 'A tall hat with mourning crape trailing from its band.',
    slot: 'hat', family: null, level: 1, fixed: { stat: 'heed-max', op: 'flat', min: 2, max: 5 },
    tables: { timed: { verbs: { heed: 2 } } },
    icon: 'find.hat', unlock: null, weight: 2,
  });
  Defs.add('base', {
    id: 'base.tarred-cap', name: 'Tarred Cap', text: 'A ropemaker\'s cap, stiff with tar from the walk.',
    slot: 'hat', family: null, level: 1, fixed: { stat: 'guard.drag', op: 'flat', min: 1, max: 3 },
    tables: { strode: { verbs: { 'stride-guard': 2 } } },
    icon: 'find.hat', unlock: null, weight: 2,
  });
  Defs.add('base', {
    id: 'base.founders-coif', name: 'Founder\'s Coif', text: 'A close linen cap a bell-founder wore under the casting hood.',
    slot: 'hat', family: null, level: 1, fixed: { stat: 'through.blow', op: 'flat', min: 2, max: 4 },
    tables: { pressed: { verbs: { 'pierce-brace': 2 } } },
    icon: 'find.hat', unlock: null, weight: 1.5,
  });

  // ---- coats ----

  Defs.add('base', {
    id: 'base.ringers-jerkin', name: 'Ringer\'s Jerkin', text: 'A short leather jerkin, rubbed thin where the rope ran.',
    slot: 'coat', family: null, level: 1, fixed: { stat: 'guard.blow', op: 'flat', min: 2, max: 4 },
    tables: { stood: { verbs: { 'brace-guard': 2 } }, pressed: { verbs: { 'every-guard': 2 } } },
    icon: 'find.coat', unlock: null, weight: 3,
  });
  Defs.add('base', {
    id: 'base.vergers-gown', name: 'Verger\'s Gown', text: 'A black gown to the ground, for walking at the head of a procession.',
    slot: 'coat', family: null, level: 1, fixed: { stat: 'guard.drag', op: 'flat', min: 2, max: 4 },
    tables: { strode: { verbs: { 'stride-guard': 2, pace: 1.5 } } },
    icon: 'find.coat', unlock: null, weight: 2,
  });
  Defs.add('base', {
    id: 'base.oilskin', name: 'Oilskin', text: 'A coat of oiled canvas that sheds the river.',
    slot: 'coat', family: null, level: 1, fixed: { stat: 'lee-reach', op: 'flat', min: 0.2, max: 0.4 },
    tables: { timed: { verbs: { lee: 3 }, objects: { swell: 2 } } },
    icon: 'find.coat', unlock: null, weight: 2,
  });
  Defs.add('base', {
    id: 'base.leather-apron', name: 'Leather Apron', text: 'A blower\'s apron, scorched along the hem.',
    slot: 'coat', family: null, level: 1, fixed: { stat: 'shove-taken', op: 'inc', min: -8, max: -4 },
    tables: { stood: { verbs: { steady: 2 }, objects: { still: 1.5 } } },
    icon: 'find.coat', unlock: null, weight: 2,
  });
  Defs.add('base', {
    id: 'base.watermans-smock', name: 'Waterman\'s Smock', text: 'A smock with deep pockets, off a boat that carried more than it should.',
    slot: 'coat', family: null, level: 1, fixed: { stat: 'find-steady', op: 'flat', min: 0.3, max: 0.6 },
    tables: { pressed: { verbs: { 'heave-harm': 3 }, objects: { heave: 2 } }, stood: { verbs: { steady: 3 } } },
    icon: 'find.coat', unlock: null, weight: 2,
  });
  Defs.add('base', {
    id: 'base.mourning-cloak', name: 'Mourning Cloak', text: 'A long black cloak, borrowed for a funeral and never given back.',
    slot: 'coat', family: null, level: 1, fixed: { stat: 'heed-max', op: 'flat', min: 3, max: 6 },
    tables: { timed: { verbs: { heed: 3, warning: 2 } } },
    icon: 'find.coat', unlock: null, weight: 2,
  });

  // ---- hands ----

  Defs.add('base', {
    id: 'base.tow-mitts', name: 'Tow Mitts', text: 'Mittens of rough hemp tow, for hauling on a rope.',
    slot: 'hands', family: null, level: 1, fixed: { stat: 'added.blow', op: 'flat', min: 1, max: 2 },
    tables: { pressed: { verbs: { 'blow-added': 2 } } },
    icon: 'find.hands', unlock: null, weight: 2,
  });
  Defs.add('base', {
    id: 'base.bearers-gloves', name: 'Bearer\'s Gloves', text: 'White gloves given to those who carried the coffin.',
    slot: 'hands', family: null, level: 1, fixed: { stat: 'shove', op: 'flat', min: 0.1, max: 0.2 },
    tables: { pressed: { verbs: { shove: 3 } } },
    icon: 'find.hands', unlock: null, weight: 2,
  });
  Defs.add('base', {
    id: 'base.clapper-gloves', name: 'Clapper Gloves', text: 'Thick gloves for greasing a clapper, black with old fat.',
    slot: 'hands', family: null, level: 1, fixed: { stat: 'wrong-foot', op: 'flat', min: 4, max: 8 },
    tables: { strode: { verbs: { footing: 2 } } },
    icon: 'find.hands', unlock: null, weight: 1.5,
  });

  // ---- girdles ----

  Defs.add('base', {
    id: 'base.knotted-girdle', name: 'Knotted Girdle', text: 'A cord tied in three knots, one for each watch of the night.',
    slot: 'girdle', family: null, level: 1, fixed: { stat: 'wound-term', op: 'flat', min: 3, max: 6 },
    tables: { stood: { verbs: { 'slow-scar': 2 } } },
    icon: 'find.girdle', unlock: null, weight: 2,
  });
  Defs.add('base', {
    id: 'base.purse-belt', name: 'Purse Belt', text: 'A belt with a coin-pouch sewn shut, and cut open again.',
    slot: 'girdle', family: null, level: 1, fixed: { stat: 'coin-find', op: 'inc', min: 4, max: 8 },
    tables: { pressed: { verbs: { coin: 3 } } },
    icon: 'find.girdle', unlock: null, weight: 2,
  });
  Defs.add('base', {
    id: 'base.sally-cord', name: 'Sally Cord', text: 'A cord of red, white and blue wool, plaited from a worn-out sally.',
    slot: 'girdle', family: null, level: 1, fixed: { stat: 'damage', op: 'inc', tags: ['round'], min: 3, max: 5 },
    tables: { pressed: { objects: { round: 2 } }, stood: { objects: { round: 1.5 } } },
    icon: 'find.girdle', unlock: null, weight: 2,
  });

  // ---- pattens ----

  Defs.add('base', {
    id: 'base.pattens', name: 'Pattens', text: 'Wooden soles on iron rings, to keep shoes out of the mud.',
    slot: 'pattens', family: null, level: 1, fixed: { stat: 'brace-time', op: 'flat', min: -0.04, max: -0.02 },
    tables: { stood: { verbs: { 'brace-sooner': 2 }, objects: { planted: 1.5 } } },
    icon: 'find.pattens', unlock: null, weight: 3,
  });
  Defs.add('base', {
    id: 'base.river-boots', name: 'River Boots', text: 'Long boots that have walked the foreshore at every tide.',
    slot: 'pattens', family: null, level: 1, fixed: { stat: 'move-speed', op: 'inc', min: 2, max: 4 },
    tables: { strode: { verbs: { pace: 2 } } },
    icon: 'find.pattens', unlock: null, weight: 2,
  });
  Defs.add('base', {
    id: 'base.felt-slippers', name: 'Felt Slippers', text: 'Soft slippers a sexton wore to walk the nave at night.',
    slot: 'pattens', family: null, level: 1, fixed: { stat: 'turn-limit', op: 'flat', min: 3, max: 6 },
    tables: { strode: { verbs: { turning: 3 } } },
    icon: 'find.pattens', unlock: null, weight: 2,
  });

  // ---- tokens: either token place takes one ----

  Defs.add('base', {
    id: 'base.mourning-ring', name: 'Mourning Ring', text: 'A jet ring given at a funeral, a name cut inside it.',
    slot: 'token', family: null, level: 1, fixed: { stat: 'heed-max', op: 'flat', min: 3, max: 6 },
    tables: { timed: { verbs: { heed: 2 } } },
    icon: 'find.token', unlock: null, weight: 2,
  });
  Defs.add('base', {
    id: 'base.bell-brass', name: 'Bell-brass', text: 'A shard of a bell that cracked as it fell.',
    slot: 'token', family: null, level: 1, fixed: { stat: 'added.swell', op: 'flat', min: 1, max: 2 },
    tables: { timed: { objects: { swell: 2 } } },
    icon: 'find.token', unlock: null, weight: 2,
  });
  Defs.add('base', {
    id: 'base.sand-glass', name: 'Sand-glass', text: 'A small glass of a quarter-hour, long run out.',
    slot: 'token', family: null, level: 1, fixed: { stat: 'warn', op: 'flat', min: 0.02, max: 0.04 },
    tables: { timed: { objects: { timed: 2 } } },
    icon: 'find.token', unlock: null, weight: 2,
  });
  Defs.add('base', {
    id: 'base.tally-stick', name: 'Tally Stick', text: 'A hazel stick notched for a debt nobody came to collect.',
    slot: 'token', family: null, level: 1, fixed: { stat: 'notch-size', op: 'inc', min: 2, max: 4 },
    tables: { timed: { verbs: { 'notch-size': 2 } } },
    icon: 'find.token', unlock: null, weight: 2,
  });
  Defs.add('base', {
    id: 'base.coffin-plate', name: 'Coffin Plate', text: 'A brass name-plate prised off a lid.',
    slot: 'token', family: null, level: 1, fixed: { stat: 'guard.all', op: 'flat', min: 1, max: 2 },
    tables: { pressed: { verbs: { 'every-guard': 2 } } },
    icon: 'find.token', unlock: null, weight: 2,
  });

  // ---- named: a name of their own and a strong fixed line ----

  Defs.add('base', {
    id: 'base.great-hours-baldrick', name: 'Great Hour\'s Baldrick',
    text: 'The leather that hung the clapper of Great Hour, the bell of the Dial. What it held rang every hour.',
    slot: 'girdle', family: null, level: 1, fixed: { stat: 'damage', op: 'more', tags: ['round'], min: 8, max: 12 },
    tables: { pressed: { objects: { round: 2 } } },
    icon: 'find.girdle', named: true, unlock: null, weight: 0.25,
  });
  Defs.add('base', {
    id: 'base.keepers-muffle', name: 'The Keeper\'s Muffle',
    text: 'A pad of leather from a half-muffled clapper. Every stroke it softened landed twice.',
    slot: 'token', family: null, level: 1, fixed: { stat: 'damage', op: 'more', cond: 't-wrong-footed', min: 6, max: 10 },
    tables: { strode: { verbs: { footing: 2 } } },
    icon: 'find.token', named: true, unlock: null, weight: 0.25,
  });
})();
