// 40-favours.js: the favours of the row (docs/design/04-progression.md, "Favours and the row"): a mourner's gift or a
// household custom, each taken by walking into it at a run level, and kept for the vigil.
// Owns: (none)
// Public: nothing; it only registers definitions with Defs.add, of the kind favour:
//   plain    (flat and inc only)   arval-bread, lyke-wake, sprig-of-rosemary, stopped-clock, laying-out, bearers-rest,
//            corpse-road, picture-to-the-wall, ringers-jug, mourning-hatband, crape-on-the-door, glove-money,
//            open-window, bidders-round, bellmans-walk, worn-sally, stay-and-slider, walking-mourners, heavy-coffin,
//            hearse-house
//   turned   (a flag.<id> a rule reads; the rules live in 26-director.js and 27-favours.js)   muffle-the-toll,
//            pass-the-gate, coins-on-your-own-eyes, nail-in-the-candle, ring-your-own-passing-bell
// icon is the id of the motif the screens paint for it (62-glyphs.js). The favours that raise harm (bellmans-walk,
// ringers-jug, walking-mourners) come to about 30% together at their most.
(function () {
  'use strict';

  // ---- plain favours: numbers only ----

  Defs.add('favour', {
    id: 'arval-bread', name: 'Arval Bread', text: 'Bread of the funeral feast: +16 greatest life.', icon: 'loaf',
    rarity: 'plain', weight: 10, maxStacks: 3, scope: 'global', requires: {}, mods: [{ stat: 'life-max', op: 'flat', value: 16 }],
  });
  Defs.add('favour', {
    id: 'lyke-wake', name: 'Lyke-wake', text: 'A night kept beside the dead: +20 Heed, so every Swell shows 0.2 s sooner.', icon: 'candle',
    rarity: 'plain', weight: 10, maxStacks: 2, scope: 'global', requires: {}, mods: [{ stat: 'heed-max', op: 'flat', value: 20 }],
  });
  Defs.add('favour', {
    id: 'sprig-of-rosemary', name: 'Sprig of Rosemary', text: 'Carried for remembrance: every Swell aimed at you shows 0.1 s sooner.',
    icon: 'sprig', rarity: 'plain', weight: 10, maxStacks: 2, scope: 'global', requires: {}, mods: [{ stat: 'warn', op: 'flat', value: 0.1 }],
  });
  Defs.add('favour', {
    id: 'stopped-clock', name: 'Stopped Clock', text: 'The clock of the house stopped at the hour: wounds wait 20 s longer before they scar.',
    icon: 'clock', rarity: 'plain', weight: 10, maxStacks: 2, scope: 'global', requires: {}, mods: [{ stat: 'wound-term', op: 'flat', value: 20 }],
  });
  Defs.add('favour', {
    id: 'laying-out', name: 'Laying Out', text: 'Washed and laid out by the household: wounds give life back 30% faster.', icon: 'basin',
    rarity: 'plain', weight: 10, maxStacks: 3, scope: 'global', requires: {}, mods: [{ stat: 'mend-rate', op: 'inc', value: 30 }],
  });
  Defs.add('favour', {
    id: 'bearers-rest', name: 'Bearers\' Rest', text: 'The stone where the bearers set the coffin down: Brace takes hold 0.08 s sooner.',
    icon: 'stone', rarity: 'plain', weight: 10, maxStacks: 2, scope: 'global', requires: {}, mods: [{ stat: 'brace-time', op: 'flat', value: -0.08 }],
  });
  Defs.add('favour', {
    id: 'corpse-road', name: 'Corpse Road', text: 'The old way to the churchyard: +6% top speed.', icon: 'road',
    rarity: 'plain', weight: 10, maxStacks: 3, scope: 'global', requires: {}, mods: [{ stat: 'move-speed', op: 'inc', value: 6 }],
  });
  Defs.add('favour', {
    id: 'picture-to-the-wall', name: 'Picture to the Wall',
    text: 'The house turns its pictures round: you turn 15 degrees harder before you are Wrong-footed.', icon: 'frame',
    rarity: 'plain', weight: 10, maxStacks: 2, scope: 'global', requires: {}, mods: [{ stat: 'turn-limit', op: 'flat', value: 15 }],
  });
  Defs.add('favour', {
    id: 'ringers-jug', name: 'Ringers\' Jug', text: 'The belfry\'s jug passed round: your voices speak 6% more often.', icon: 'jug',
    rarity: 'plain', weight: 10, maxStacks: 2, scope: 'voices', requires: {}, mods: [{ stat: 'speed', op: 'inc', value: 6 }],
  });
  Defs.add('favour', {
    id: 'mourning-hatband', name: 'Mourning Hatband', text: 'Given to every mourner at the door: +5 to the guard of Brace.', icon: 'hatband',
    rarity: 'plain', weight: 10, maxStacks: 3, scope: 'global', requires: {}, mods: [{ stat: 'guard.blow', op: 'flat', value: 5 }],
  });
  Defs.add('favour', {
    id: 'crape-on-the-door', name: 'Crape on the Door', text: 'The house hung in black: +5 to the guard of Stride.', icon: 'crape',
    rarity: 'plain', weight: 10, maxStacks: 3, scope: 'global', requires: {}, mods: [{ stat: 'guard.drag', op: 'flat', value: 5 }],
  });
  Defs.add('favour', {
    id: 'glove-money', name: 'Glove Money', text: 'Paid to the bearers for their gloves: the dead drop 30% more coin.', icon: 'gloves',
    rarity: 'plain', weight: 10, maxStacks: 3, scope: 'global', requires: {}, mods: [{ stat: 'coin-find', op: 'inc', value: 30 }],
  });
  Defs.add('favour', {
    id: 'open-window', name: 'Open Window', text: 'Opened to let the soul go: embers and coin come to you from 40% farther.', icon: 'window',
    rarity: 'plain', weight: 10, maxStacks: 2, scope: 'global', requires: {}, mods: [{ stat: 'pickup-reach', op: 'inc', value: 40 }],
  });
  Defs.add('favour', {
    id: 'bidders-round', name: 'The Bidder\'s Round', text: 'The bidder knocks at every door to bid the neighbours come: +12% experience.',
    icon: 'door', rarity: 'plain', weight: 10, maxStacks: 3, scope: 'global', requires: {}, mods: [{ stat: 'xp-gain', op: 'inc', value: 12 }],
  });
  Defs.add('favour', {
    id: 'bellmans-walk', name: 'Bellman\'s Walk', text: 'The bellman walks before the coffin with his hand-bell: +6% harm.', icon: 'handbell',
    rarity: 'plain', weight: 10, maxStacks: 2, scope: 'voices', requires: {}, mods: [{ stat: 'damage', op: 'inc', value: 6 }],
  });
  Defs.add('favour', {
    id: 'worn-sally', name: 'Worn Sally', text: 'A sally worn soft in the hand: a reversal may take 0.05 s longer and still be a pull.',
    icon: 'sally', rarity: 'plain', weight: 8, maxStacks: 2, scope: 'global', requires: { class: 'change-ringer' },
    mods: [{ stat: 'pull-window', op: 'flat', value: 0.05 }],
  });
  Defs.add('favour', {
    id: 'stay-and-slider', name: 'Stay and Slider', text: 'The bell rests mouth-up on its stay: it sets 0.15 s sooner.', icon: 'stay',
    rarity: 'plain', weight: 8, maxStacks: 2, scope: 'global', requires: { class: 'change-ringer' },
    mods: [{ stat: 'set-time', op: 'flat', value: -0.15 }],
  });
  Defs.add('favour', {
    id: 'walking-mourners', name: 'Walking Mourners', text: 'The mourners walk close behind: +10% harm to the dead In Procession.',
    icon: 'mourners', rarity: 'plain', weight: 10, maxStacks: 1, scope: 'voices', requires: {},
    mods: [{ stat: 'procession-bonus', op: 'flat', value: 10 }],
  });
  Defs.add('favour', {
    id: 'heavy-coffin', name: 'Heavy Coffin', text: 'The bearers go slowly: the dead walk your path 0.25 s farther behind you.', icon: 'coffin',
    rarity: 'plain', weight: 10, maxStacks: 2, scope: 'global', requires: {}, mods: [{ stat: 'wake-lag', op: 'flat', value: 0.25 }],
  });
  Defs.add('favour', {
    id: 'hearse-house', name: 'Hearse House', text: 'Shelter by the churchyard gate: lee holds 1 m farther from its cover.', icon: 'roof',
    rarity: 'plain', weight: 10, maxStacks: 2, scope: 'global', requires: {}, mods: [{ stat: 'lee-reach', op: 'flat', value: 1 }],
  });

  // ---- turned favours: each raises its own flag, and the rule that reads it lives in 26-director.js or 27-favours.js

  Defs.add('favour', {
    id: 'muffle-the-toll', name: 'Muffle the Toll', icon: 'muffle', rarity: 'turned', weight: 5, maxStacks: 1, scope: 'global',
    text: 'The next toll rings muffled and the danger does not rise. The toll after it rings for two.',
    requires: {}, mods: [{ stat: 'flag.muffle-the-toll', op: 'flat', value: 1 }],
  });
  Defs.add('favour', {
    id: 'pass-the-gate', name: 'Pass the Gate', icon: 'arch', rarity: 'turned', weight: 5, maxStacks: 1, scope: 'global',
    text: 'Each lychgate that opens and closes unrung: +8% experience from the dead, and the dead walk 4% faster, for the rest of the vigil.',
    requires: {}, mods: [{ stat: 'flag.pass-the-gate', op: 'flat', value: 1 }],
  });
  Defs.add('favour', {
    id: 'coins-on-your-own-eyes', name: 'Coins on Your Own Eyes', icon: 'coins', rarity: 'turned', weight: 4, maxStacks: 1, scope: 'global',
    text: 'At every toll a lychgate opens 20 m away for 15 s. The fare is 2 coins a toll, rising by 1 each toll; the first you cannot pay ends it, and then no lychgate opens for two tolls.',
    requires: {}, mods: [{ stat: 'flag.coins-on-your-own-eyes', op: 'flat', value: 1 }],
  });
  Defs.add('favour', {
    id: 'nail-in-the-candle', name: 'Nail in the Candle', icon: 'nail', rarity: 'turned', weight: 5, maxStacks: 2, scope: 'global',
    text: 'Nothing now. When the second toll from now rings, the two favours at the front of the row are yours.',
    requires: {}, mods: [{ stat: 'flag.nail-in-the-candle', op: 'flat', value: 1 }],
  });
  Defs.add('favour', {
    id: 'ring-your-own-passing-bell', name: 'Ring Your Own Passing Bell', icon: 'passing-bell', rarity: 'turned', weight: 4,
    maxStacks: 1, scope: 'global', text: 'Tolled-for, your lychgate opens 12 m from you instead of at the far edge of the district.',
    requires: {}, mods: [{ stat: 'flag.ring-your-own-passing-bell', op: 'flat', value: 1 }],
  });
})();
