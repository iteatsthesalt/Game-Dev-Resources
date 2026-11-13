// 44-bellframe.js: the Bellframe (docs/design/04-progression.md, "The Bellframe and Hum"): its numbers, the pits of the
// frame that hangs below the Lantern, and the gifts the bells of the dead give whoever rings them.
// Owns: (none)
// Public: nothing; it only registers definitions with Defs.add:
//   bellframe 'main'   the first pit after the tenor costs 100 Hum and each after it half as much again as the last;
//                      ringing places likewise, one to start and eight at most; neighbouring rung bells whose weights
//                      differ by 10% to 30% of the heavier ring true, +5% on every gift rung; a gift works at level
//                      1 + floor(weight / 8); recasting a gift costs 60 Hum; a death by a cause new to the Register pays
//                      40 Hum times the toll
//   pit (12)           the frame, seen from the side as the screen draws it: three tiers of bays, five at the foot, four
//                      above, three at the top under the Lantern (x the bay, half a bay over in the tier above; y the
//                      tier, 0 the lowest, where the heavy bells hang). Each opens from the pit named by from, and is
//                      named for the bell that hung there before the flood:
//                        tenor (2, 0, the tenor pit, open from the first)   life
//                        curfew (1, 0) <- tenor, oven-bell (0, 0) <- curfew, sermon-bell (0.5, 1) <- oven-bell,
//                        evening-bell (1, 2) <- sermon-bell               standing: Brace, mending, the still, life
//                        tide-bell (3, 0) <- tenor, ferry-bell (4, 0) <- tide-bell, post-bell (3.5, 1) <- ferry-bell,
//                        gleaning-bell (3, 2) <- post-bell                moving: speed, the moving, Stride, reach
//                        market-bell (1.5, 1) <- tenor, fire-bell (2, 2) <- market-bell, harvest-bell (2.5, 1) <- tenor
//                                                                         the Household: coin, warning, experience
//   gift (3)           one for each class without a calling and one for each calling, of the classes there are: the
//                      Change-ringer's ('change-ringer') and its callings' ('stander', 'backward-ringer'). Each gift's
//                      id is the id of the class or calling it belongs to; the other classes bring theirs with them.
// Grants and gifts add with flat and inc only. A gift's numbers run from its bell's level 1 to 20.
(function () {
  'use strict';

  Defs.add('bellframe', {
    id: 'main', pitFirst: 100, pitGrowth: 1.5, placeFirst: 100, placeGrowth: 1.5, placesMost: 8, trueLow: 10, trueHigh: 30,
    trueGain: 5, weighPer: 8, recast: 60, deathHum: 40,
  });

  // ---- the pits: the foot of the frame ----

  Defs.add('pit', {
    id: 'tenor', name: 'The Tenor Pit', icon: null, from: null, x: 2, y: 0,
    text: 'The great pit at the foot of the frame, cut for the heaviest bell of the ring. Open from the first: every character stands with 6 more greatest life.',
    grant: [{ stat: 'life-max', op: 'flat', value: 6 }],
  });
  Defs.add('pit', {
    id: 'curfew', name: 'Curfew', icon: null, from: 'tenor', x: 1, y: 0,
    text: 'Where the curfew bell hung, that told the town to cover its fires and bar its doors. Brace takes 3 more from every Blow.',
    grant: [{ stat: 'guard.blow', op: 'flat', value: 3 }],
  });
  Defs.add('pit', {
    id: 'tide-bell', name: 'Tide Bell', icon: null, from: 'tenor', x: 3, y: 0,
    text: 'Where the bell hung that rang at every turn of the tide, so that the watermen knew to cast off. 3% faster on your feet.',
    grant: [{ stat: 'move-speed', op: 'inc', value: 3 }],
  });
  Defs.add('pit', {
    id: 'oven-bell', name: 'Oven Bell', icon: null, from: 'curfew', x: 0, y: 0,
    text: 'Rung when the common oven was hot, so that every house could bring its bread. Wounds give life back 12% faster.',
    grant: [{ stat: 'mend-rate', op: 'inc', value: 12 }],
  });
  Defs.add('pit', {
    id: 'ferry-bell', name: 'Ferry Bell', icon: null, from: 'tide-bell', x: 4, y: 0,
    text: 'Rung from the water stair to call the ferry over. Voices that speak while you move strike 5% harder.',
    grant: [{ stat: 'damage', op: 'inc', value: 5, tags: ['moving'] }],
  });

  // ---- the middle tier ----

  Defs.add('pit', {
    id: 'sermon-bell', name: 'Sermon Bell', icon: null, from: 'oven-bell', x: 0.5, y: 1,
    text: 'Rung to call the parish in to sit and listen. Voices that speak while you stand still strike 6% harder.',
    grant: [{ stat: 'damage', op: 'inc', value: 6, tags: ['still'] }],
  });
  Defs.add('pit', {
    id: 'market-bell', name: 'Market Bell', icon: null, from: 'tenor', x: 1.5, y: 1,
    text: 'Rung to open the market on the bridge. The dead let fall 10% more coin.',
    grant: [{ stat: 'coin-find', op: 'inc', value: 10 }],
  });
  Defs.add('pit', {
    id: 'harvest-bell', name: 'Harvest Bell', icon: null, from: 'tenor', x: 2.5, y: 1,
    text: 'Rung at dawn in harvest time to send the reapers out. 8% more experience from every ember.',
    grant: [{ stat: 'xp-gain', op: 'inc', value: 8 }],
  });
  Defs.add('pit', {
    id: 'post-bell', name: 'Post Bell', icon: null, from: 'ferry-bell', x: 3.5, y: 1,
    text: 'Rung as the post set out along the river road. You Stride at 3% less of your top speed.',
    grant: [{ stat: 'stride-share', op: 'flat', value: -3 }],
  });

  // ---- the top tier, under the Lantern ----

  Defs.add('pit', {
    id: 'evening-bell', name: 'Evening Bell', icon: null, from: 'sermon-bell', x: 1, y: 2,
    text: 'Rung when the day\'s work was done and the river shut its gates. Every character stands with 12 more greatest life.',
    grant: [{ stat: 'life-max', op: 'flat', value: 12 }],
  });
  Defs.add('pit', {
    id: 'fire-bell', name: 'Fire Bell', icon: null, from: 'market-bell', x: 2, y: 2,
    text: 'Rung backward when a roof caught. Every Swell aimed at you shows 0.06 s sooner.',
    grant: [{ stat: 'warn', op: 'flat', value: 0.06 }],
  });
  Defs.add('pit', {
    id: 'gleaning-bell', name: 'Gleaning Bell', icon: null, from: 'post-bell', x: 3, y: 2,
    text: 'Rung when the reaped fields were open to the poor to glean. You draw in what lies on the ground from 20% further off.',
    grant: [{ stat: 'pickup-reach', op: 'inc', value: 20 }],
  });

  // ---- the gifts: what a bell gives those who ring it ----

  Defs.add('gift', {
    id: 'change-ringer', name: 'The Ringer\'s Turn', icon: null, class: 'change-ringer', calling: null,
    text: 'A ringer who kept hold of the rope knew how far a body can turn. You can turn 2 to 20 degrees further before you are Wrong-footed, and your voices strike the Wrong-footed 4 to 30% harder.',
    mods: [
      { stat: 'turn-limit', op: 'flat', value: { a: 2, b: 20, curve: 'lin' } },
      { stat: 'wrong-foot', op: 'flat', value: { a: 4, b: 30, curve: 'lin' } },
    ],
  });
  Defs.add('gift', {
    id: 'stander', name: 'Weight on the Stay', icon: null, class: 'change-ringer', calling: 'stander',
    text: 'A Stander let the crowd lean on the stay and held. Brace takes 1 to 10 more from every Blow, and takes hold 0.01 to 0.1 s sooner.',
    mods: [
      { stat: 'guard.blow', op: 'flat', value: { a: 1, b: 10, curve: 'lin' } },
      { stat: 'brace-time', op: 'flat', value: { a: -0.01, b: -0.1, curve: 'lin' } },
    ],
  });
  Defs.add('gift', {
    id: 'backward-ringer', name: 'Rung Backward', icon: null, class: 'change-ringer', calling: 'backward-ringer',
    text: 'A Backward-ringer gathered the district behind it. The common dead steer at where you were 0.03 to 0.3 s further back, and your voices strike those In Procession 2 to 15% harder.',
    mods: [
      { stat: 'wake-lag', op: 'flat', value: { a: 0.03, b: 0.3, curve: 'lin' } },
      { stat: 'procession-bonus', op: 'flat', value: { a: 2, b: 15, curve: 'lin' } },
    ],
  });
})();
