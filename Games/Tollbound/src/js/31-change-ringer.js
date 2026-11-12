// 31-change-ringer.js: the Change-ringer, the first class (docs/design/03-classes.md), and its three starting voices.
// Owns: (none)
// Public: nothing; it only registers definitions with Defs.add:
//   class  'change-ringer'   Hand, then Knee: 10 and 5 to start, 2 and 1 more each level. Its rule (the pull, the set
//                            bell) and its trade, Set (recharge 8 s), are run by 21-player.js. Callings 'stander'
//                            and 'backward-ringer' (defined with the callings, later). Its figure is the puppet
//                            'change-ringer' of 46-puppets-dial.js.
//   voice  'tenor-stroke'    place 1, the voice the pull rings. ring round you, a Blow: every 3 s, on every one of the
//                            dead within 2.5 m (03-classes.md). Hand.
//   voice  'tellers'         place 2. rap, Drag: every 2.5 s the hand-bell tells the nearest of the dead within 8 m,
//                            three strokes for a small body, six for a large one, nine for an elite or a keeper, four
//                            a second, each biting it and everything within 2 m of it; if it falls before its count
//                            is told, the strokes left are told on its nearest neighbour and count double (the pool's
//                            customs-33, clean). Hand.
//   voice  'plumb'           place 3. ring at the mark, a Swell: every 3 s a weight falls on the place where you last
//                            stood still for half a second, a circle 2.5 m round it, filling 1 s; 10% more for each
//                            second the mark has stayed put, to twice (the pool's thumbs-26, clean). Knee, as a voice
//                            tagged still, so it works at half its harm until Knee reaches 10.
//   attack 'tenor-stroke', 'tellers', 'plumb'   the shapes of the areas these voices leave (a Blow's ring, a told
//                            zone, a falling circle), which the scene draws as it draws the dead's
// The numbers are the design's where it gives them (Tenor Stroke's 2.5 m every 3 s, the tellers' 3, 6 and 9, the
// plumb's +10% a second to +100%); the harm is set for the Dial at level 1 to 9 and rises seven times by voice level 20.
(function () {
  'use strict';

  Defs.add('class', {
    id: 'change-ringer',
    name: 'Change-ringer',
    text: 'A tower ringer who kept hold of the rope. Rock back and forth in the crowd: every sharp reversal is a pull, and your first voice speaks at once. Stand still a moment and the bell is set: the next pull speaks twice.',
    attrs: { hand: 10, knee: 5 },
    perLevel: { hand: 2, knee: 1 },
    base: [],
    voices: ['tenor-stroke', 'tellers', 'plumb'],
    startGear: [],
    trade: { name: 'Set', text: 'Set the bell mouth-up at once, wherever you are: your next pull speaks twice.', icon: 'set', recharge: 8 },
    callings: ['stander', 'backward-ringer'],
    unlock: null,
    puppet: 'change-ringer',
    palette: ['#A7312C', '#ECE9E1', '#2E4E8E'],
  });

  Defs.add('voice', {
    id: 'tenor-stroke',
    name: 'Tenor Stroke',
    text: 'Every 3 s, a heavy Blow on every one of the dead within 2.5 m of you. Your pull makes it speak at once.',
    icon: 'tenor-stroke',
    attr: 'hand',
    tier: 1,
    tags: ['round'],
    weapon: null,
    archetype: 'ring',
    target: 'self',
    rate: 1 / 3,
    damage: { blow: [{ a: 8, b: 56, curve: 'exp' }, { a: 12, b: 84, curve: 'exp' }] },
    weaponPct: 0,
    eff: 1,
    crit: 0,
    params: { radius: 2.5 },
    mods: [],
    fx: { color: '#ECE9E1' },
  });

  Defs.add('voice', {
    id: 'tellers',
    name: 'Tellers',
    text: 'Every 2.5 s the hand-bell tells the nearest of the dead within 8 m: three strokes for the small, six for the large, nine for the great, each biting everything within 2 m of it. Strokes left when it falls are told on its neighbour, twice as hard.',
    icon: 'tellers',
    attr: 'hand',
    tier: 1,
    tags: ['held'],
    weapon: null,
    archetype: 'rap',
    target: 'nearest',
    rate: 0.4,
    damage: { drag: [{ a: 22, b: 154, curve: 'exp' }, { a: 28, b: 196, curve: 'exp' }] },
    weaponPct: 0,
    eff: 1,
    crit: 0,
    params: { reach: 8, count: 1, splash: 2, strokes: 3, strokesLarge: 6, strokesElite: 9, pass: 2 },
    mods: [],
    fx: { color: '#D6A23E' },
  });

  Defs.add('voice', {
    id: 'plumb',
    name: 'Plumb',
    text: 'Every 3 s a weight falls on the place where you last stood still, 2.5 m round. It strikes harder for every second that place has stayed the same, up to twice as hard.',
    icon: 'plumb',
    attr: 'knee',
    tier: 1,
    tags: ['still', 'planted'],
    weapon: null,
    archetype: 'ring',
    target: 'mark',
    rate: 1 / 3,
    damage: { swell: [{ a: 20, b: 140, curve: 'exp' }, { a: 28, b: 196, curve: 'exp' }] },
    weaponPct: 0,
    eff: 1,
    crit: 0,
    params: { radius: 2.5, fill: 1, still: 10, stillMost: 100 },
    mods: [],
    fx: { color: '#8A5F37' },
  });

  // the shapes of their areas, read by the scene as it reads an attack of the dead
  Defs.add('attack', {
    id: 'tenor-stroke', kind: 'strike', type: 'blow', mult: 1, cooldown: 3, range: 0, windup: 0, shape: 'circle', radius: 2.5,
    angle: 0, count: 1, spread: 0, speed: 0, evadable: false, ailment: null, summon: null, fx: { color: '#ECE9E1' },
  });
  Defs.add('attack', {
    id: 'tellers', kind: 'zone', type: 'drag', mult: 1, cooldown: 2.5, range: 8, windup: 0, shape: 'circle', radius: 2,
    angle: 0, count: 1, spread: 0, speed: 0, evadable: false, ailment: null, summon: null, fx: { color: '#D6A23E' },
  });
  Defs.add('attack', {
    id: 'plumb', kind: 'fall', type: 'swell', mult: 1, cooldown: 3, range: 0, windup: 1, shape: 'circle', radius: 2.5,
    angle: 0, count: 1, spread: 0, speed: 0, evadable: false, ailment: null, summon: null, fx: { color: '#8A5F37' },
  });
})();
