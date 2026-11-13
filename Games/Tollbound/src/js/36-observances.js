// 36-observances.js: the observances of Stage 2, the six the design names (docs/design/04-progression.md, "Observances
// and Heed"; the pool's thumbs-45, thumbs-47, thumbs-46 in its changed form, customs-47, customs-46 and bells-39). Each
// holds part of the character's Heed while it is kept, in vigils and between them, and is a promise the thumb keeps:
// its promise (a rule of 27-observances.js) is run in a vigil, and while it is broken its modifiers stop until the
// next toll mends it; its Heed stays held. params are the promise's numbers. A character learns an observance from a
// bequest that opens it, or from a bell it rings whose dead knew it.
// Owns: (none)
// Public: nothing; it only registers definitions with Defs.add, of the kind observance (the Heed it holds, its promise):
//   stability          30  stay within 12 m of where you stood at the last toll; +25% harm
//   unbroken-round     35  touch the bell-post between every two tolls; +5% harm and +2% speed a period kept, to 8
//   alms               25  leave the first find of each toll period lying, a cairn; +5% experience a cairn standing
//   telling-the-bees   30  a hive fetches pickups within 10 m; tell it of each death of the great by standing still
//   full-mourning      40  the dead cannot make you out beyond 7 m (10, then 14); nothing bright is picked up
//   hand-on-the-bell   40  no Drag reaches you and nothing shoves you; a Blow over a fifth of your life scars
(function () {
  'use strict';

  Defs.add('observance', {
    id: 'stability', name: 'Stability', icon: 'obs.stability', attr: 'knee', tier: 1, heed: 30,
    text: 'Stay within 12 m of where you stood at the last toll, a ring drawn on the ground. While you keep it, your voices strike 25% harder. Step out and the promise is broken until the next toll.',
    mods: [{ stat: 'damage', op: 'inc', value: 25 }], aura: null, promise: 'stability', params: { reach: 12 },
  });

  Defs.add('observance', {
    id: 'unbroken-round', name: 'The Unbroken Round', icon: 'obs.unbroken-round', attr: 'heel', tier: 1, heed: 35,
    text: 'Touch the bell-post at least once between every two tolls. Each toll that finds the promise kept adds 5% harm and 2% to how often your voices speak, up to eight; a toll that finds it missed empties them all.',
    mods: [], aura: null, promise: 'unbroken-round', params: { touch: 1, most: 8, harm: 5, speed: 2 },
  });

  Defs.add('observance', {
    id: 'alms', name: 'Alms', icon: 'obs.alms', attr: 'hand', tier: 1, heed: 25,
    text: 'Leave the first find of each toll period lying where it fell: it stands as a small cairn, and each cairn standing pays 5% more experience. Walking back onto one to take it breaks the promise.',
    mods: [], aura: null, promise: 'alms', params: { more: 5, leave: 3 },
  });

  Defs.add('observance', {
    id: 'telling-the-bees', name: 'Telling the Bees', icon: 'obs.telling-the-bees', attr: 'ear', tier: 1, heed: 30,
    text: 'A hive on your back fetches every pickup within 10 m. When an elite or a keeper falls anywhere in the district, stand still for 1 s within 10 s to tell the bees, and they drive the five nearest dead back 3 m. A death left untold sends them away until the next toll, with what they were carrying.',
    mods: [{ stat: 'pickup-reach', op: 'flat', value: 7.5 }], aura: null, promise: 'telling-the-bees',
    params: { within: 10, still: 1, drive: 3, count: 5 },
  });

  Defs.add('observance', {
    id: 'full-mourning', name: 'Full Mourning', icon: 'obs.full-mourning', attr: 'knee', tier: 1, heed: 40,
    text: 'Beyond 7 m the dead cannot make you out. You may pick up nothing bright, only embers. At every third toll the mourning lightens a grade: grey, seen at 10 m, coin allowed; then lavender, seen at 14 m. Walking back onto something bright to take it breaks the promise.',
    mods: [], aura: null, promise: 'full-mourning', params: { black: 7, grey: 10, lavender: 14, every: 3, leave: 3 },
  });

  Defs.add('observance', {
    id: 'hand-on-the-bell', name: 'Hand on the Bell', icon: 'obs.hand-on-the-bell', attr: 'knee', tier: 1, heed: 40,
    text: 'No Drag can reach you and nothing can shove you. But a single Blow worth more than a fifth of your greatest life breaks the promise until the next toll, and half of what it was worth beyond that fifth scars at once.',
    mods: [{ stat: 'taken', op: 'set', value: 0, tags: ['drag'] }, { stat: 'shove-taken', op: 'set', value: 0 }], aura: null,
    promise: 'hand-on-the-bell', params: { heavy: 20, scar: 50 },
  });
})();
