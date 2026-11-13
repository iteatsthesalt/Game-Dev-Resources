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
//   and the voices found blank (the dead leave them, 27-observances.js; any class may take one into its loadout):
//   voice  'hand-bell'       tier 1. ring round you, a Blow: every 1.5 s on every one of the dead within 2 m (the
//                            design's own, the Watch-night's first voice, 04-progression.md). Hand.
//   voice  'beating-pair'    tier 1. ring round you, a Blow, every second, 4 m round: two forks a tenth apart, so each
//                            stroke swells to three times and fades to nothing once every 11 s (the pool's bells-24,
//                            clean). Ear, as a voice tagged timed.
//   voice  'held-breath'     tier 1. cone, a Blow, on your first step after standing still: 60 degrees wide toward the
//                            step, 4 m long and 2 m more for each second you stood, to 3 s (the pool's thumbs-30,
//                            clean). Knee, as a voice tagged still.
//   voice  'hitch'           tier 2. ring where your path crosses your own wake, a Blow on every one of the dead within
//                            2.5 m, times how many it catches, to 12; every 1.5 s at most (the pool's thumbs-27,
//                            clean). Hand.
//   voice  'long-draw'       tier 2. spark, a Blow, every second: one thrown straight ahead and one straight back, the
//                            one behind 10% stronger and 0.5 m wider for each second your heading has held, to 10 s
//                            (the pool's thumbs-28, clean). Heel, as a voice tagged moving.
//   attack 'tenor-stroke', 'tellers', 'plumb', and one of each found voice's id   the shapes of the areas and thrown
//                            things these voices leave (a Blow's ring, a told zone, a falling circle), which the scene
//                            draws as it draws the dead's
// Every voice carries the tag of its kind of harm, so a knot may require or exclude it (35-knots.js).
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
    startGear: ['base.bell-rope', 'base.ringers-jerkin'],
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
    tags: ['blow', 'round'],
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
    tags: ['drag', 'held'],
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
    tags: ['swell', 'still', 'planted'],
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

  // ---- the voices found blank ----

  Defs.add('voice', {
    id: 'hand-bell', name: 'Hand-bell', icon: 'hand-bell', attr: 'hand', tier: 1, tags: ['blow', 'round'], weapon: null,
    text: 'Every 1.5 s, a Blow on every one of the dead within 2 m of you.',
    archetype: 'ring', target: 'self', rate: 1 / 1.5, damage: { blow: [{ a: 5, b: 35, curve: 'exp' }, { a: 7, b: 49, curve: 'exp' }] },
    weaponPct: 0, eff: 1, crit: 0, params: { radius: 2 }, mods: [], fx: { color: '#E6C25A' },
  });
  Defs.add('attack', {
    id: 'hand-bell', kind: 'strike', type: 'blow', mult: 1, cooldown: 1.5, range: 0, windup: 0, shape: 'circle', radius: 2,
    angle: 0, count: 1, spread: 0, speed: 0, evadable: false, ailment: null, summon: null, fx: { color: '#E6C25A' },
  });

  Defs.add('voice', {
    id: 'beating-pair', name: 'Beating Pair', icon: 'beating-pair', attr: 'ear', tier: 1, tags: ['blow', 'round', 'timed'], weapon: null,
    text: 'Every second, a Blow on every one of the dead within 4 m of you. Two forks a tenth apart beat against each other: each stroke swells to three times its harm and fades to nothing, once every 11 s.',
    archetype: 'ring', target: 'self', rate: 1, damage: { blow: [{ a: 3, b: 21, curve: 'exp' }, { a: 5, b: 35, curve: 'exp' }] },
    weaponPct: 0, eff: 1, crit: 0, params: { radius: 4, beat: 1.1, beatMost: 3 }, mods: [], fx: { color: '#A9DDD1' },
  });
  Defs.add('attack', {
    id: 'beating-pair', kind: 'strike', type: 'blow', mult: 1, cooldown: 1, range: 0, windup: 0, shape: 'circle', radius: 4,
    angle: 0, count: 1, spread: 0, speed: 0, evadable: false, ailment: null, summon: null, fx: { color: '#A9DDD1' },
  });

  Defs.add('voice', {
    id: 'held-breath', name: 'Held Breath', icon: 'held-breath', attr: 'knee', tier: 1, tags: ['blow', 'still'], weapon: null,
    text: 'Stand still to draw a breath; on your first step it goes out ahead of you: a Blow in a wedge 60° wide toward the step, 4 m long and 2 m longer for each second you stood, to 3 s. Every 2 s at most.',
    archetype: 'cone', target: 'step', rate: 0.5, damage: { blow: [{ a: 14, b: 98, curve: 'exp' }, { a: 20, b: 140, curve: 'exp' }] },
    weaponPct: 0, eff: 1, crit: 0, params: { length: 4, angle: 60, held: 2, heldMost: 3 }, mods: [], fx: { color: '#ECE9E1' },
  });
  Defs.add('attack', {
    id: 'held-breath', kind: 'strike', type: 'blow', mult: 1, cooldown: 2, range: 10, windup: 0, shape: 'wedge', radius: 4,
    angle: 1.0471976, count: 1, spread: 0, speed: 0, evadable: false, ailment: null, summon: null, fx: { color: '#ECE9E1' },
  });

  Defs.add('voice', {
    id: 'hitch', name: 'Hitch', icon: 'hitch', attr: 'hand', tier: 2, tags: ['blow', 'crossing'], weapon: null,
    text: 'Where your path crosses your own wake, a Blow on every one of the dead within 2.5 m of the crossing, its harm times how many it catches, up to twelve. Every 1.5 s at most.',
    archetype: 'ring', target: 'crossing', rate: 1 / 1.5, damage: { blow: [{ a: 2, b: 14, curve: 'exp' }, { a: 3, b: 21, curve: 'exp' }] },
    weaponPct: 0, eff: 1, crit: 0, params: { radius: 2.5, byCount: 12 }, mods: [], fx: { color: '#C7A86F' },
  });
  Defs.add('attack', {
    id: 'hitch', kind: 'strike', type: 'blow', mult: 1, cooldown: 1.5, range: 0, windup: 0, shape: 'circle', radius: 2.5,
    angle: 0, count: 1, spread: 0, speed: 0, evadable: false, ailment: null, summon: null, fx: { color: '#C7A86F' },
  });

  Defs.add('voice', {
    id: 'long-draw', name: 'Long Draw', icon: 'long-draw', attr: 'heel', tier: 2, tags: ['blow', 'thrown', 'moving'], weapon: null,
    text: 'Every second, one thrown thing straight ahead and one straight back along your way. The one behind strikes 10% harder and flies 0.5 m wider for each second your heading has held within 15°, up to 10 s.',
    archetype: 'spark', target: 'ahead', rate: 1, damage: { blow: [{ a: 6, b: 42, curve: 'exp' }, { a: 9, b: 63, curve: 'exp' }] },
    weaponPct: 0, eff: 1, crit: 0, params: { reach: 10, speed: 16, size: 0.25, count: 1, behind: 1, rearGrow: 10, rearWide: 0.5, rearMost: 10 },
    mods: [], fx: { color: '#D6A23E' },
  });
  Defs.add('attack', {
    id: 'long-draw', kind: 'throw', type: 'blow', mult: 1, cooldown: 1, range: 10, windup: 0, shape: 'line', radius: 0.25,
    angle: 0, count: 1, spread: 0, speed: 16, evadable: false, ailment: null, summon: null, fx: { color: '#D6A23E' },
  });
})();
