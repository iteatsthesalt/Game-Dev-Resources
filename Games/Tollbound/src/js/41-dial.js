// 41-dial.js: the Dial, the first district (docs/design/01-world.md): its zone, its dead and their attacks, the
// traits of its elites, its timeline toll by toll, and its keeper, the Half-muffled Keeper.
// Owns: (none)
// Public: nothing; it only registers definitions with Defs.add:
//   zone    'dial'                       a round plaza 70 m across: the bell-post at its middle, eight stones on the
//                                        radii 21 m out (the north stone and the four between the quarters are
//                                        landmarks; with the bell-post, the district's six), the start 7 m south of
//                                        the post; its shadow (districtRules 'dial.shadow', 26-director.js); levels 1 to 9
//   enemy   'dial.wake-walker'           the common dead: small, in trains (ai 'wake'); a clutching Blow, and its press
//   enemy   'dial.hanger-on'             small, in quick hops; it leaps on from 1.5 m and rides (the condition clung)
//   enemy   'dial.heavy'                 the heavy dead, the Lumper: large (lee, Sounded, Coiled), slow; a shouldering
//                                        Blow, and its load dropped where the player stands (a falling Swell)
//   boss    'dial.half-muffled-keeper'   the keeper, at the eighth toll (ai 'keeper', 25-boss.js): strokes that land
//                                        twice on the same ground, in the order of its phase
//   attack  'dial.clutch', 'dial.leap', 'dial.shoulder', 'dial.load', 'dial.keeper.stroke', 'dial.keeper.sweep',
//           'dial.keeper.round'
//   trait   'dial.lead-lined', 'dial.long-watched', 'dial.in-haste', 'dial.hard-handed', 'dial.double-shrouded'
//                                        the elites' traits: an elite with no trait named by its event draws one of these
// Puppets, props and the tileset are the ids agreed with the figures' package (docs/engine.md, "Ids both sides need"):
// every enemy and the keeper name a puppet of their own id (46-puppets-dial.js); the props 'dial.bell-post' and
// 'dial.stone' and the tileset 'dial' are 47-dial-ground.js's.
// Numbers are a body's at level 1: the level curves of 30-modes-curves.js scale life, damage and xp.
(function () {
  'use strict';

  const PUPPET = { walker: 'dial.wake-walker', hanger: 'dial.hanger-on', heavy: 'dial.heavy', keeper: 'dial.half-muffled-keeper' };
  const PROP = { post: 'dial.bell-post', stone: 'dial.stone' };
  const TILESET = 'dial';

  const WALKER = 'dial.wake-walker', HANGER = 'dial.hanger-on', HEAVY = 'dial.heavy', KEEPER = 'dial.half-muffled-keeper';
  const STONE_R = 21, DIAG = 14.849242;            // the stones' radius, and its share on each axis at 45 degrees

  // ---- attacks ----

  Defs.add('attack', {
    id: 'dial.clutch', kind: 'strike', type: 'blow', mult: 1, cooldown: 3.2, range: 0.55, windup: 0.6, shape: 'arc',
    radius: 0, angle: 1.75, count: 1, spread: 0, speed: 0, evadable: false, ailment: null, summon: null,
    fx: { part: 'arms', color: '#E4DFD1' },
  });
  Defs.add('attack', {
    id: 'dial.leap', kind: 'press', type: 'drag', mult: 0.5, cooldown: 2.5, range: 1.5, windup: 0.35, shape: 'line',
    radius: 0.4, angle: 0, count: 1, spread: 0, speed: 0, evadable: false, ailment: 'clung', summon: null,
    fx: { part: 'body', color: '#5D6A39' },
  });
  Defs.add('attack', {
    id: 'dial.shoulder', kind: 'strike', type: 'blow', mult: 1, cooldown: 4.5, range: 0.9, windup: 0.8, shape: 'arc',
    radius: 0, angle: 2.1, count: 1, spread: 0, speed: 0, evadable: false, ailment: null, summon: null,
    fx: { part: 'shoulder', color: '#8A5F37' },
  });
  Defs.add('attack', {
    id: 'dial.load', kind: 'fall', type: 'swell', mult: 1.8, cooldown: 12, range: 9, windup: 1.6, shape: 'circle',
    radius: 2, angle: 0, count: 1, spread: 0, speed: 0, evadable: false, ailment: null, summon: null,
    fx: { color: '#8A5F37' },
  });
  Defs.add('attack', {
    id: 'dial.keeper.stroke', kind: 'fall', type: 'swell', mult: 2.2, cooldown: 0, range: 40, windup: 1.5, shape: 'circle',
    radius: 3.2, angle: 0, count: 1, spread: 0, speed: 0, evadable: false, ailment: null, summon: null,
    fx: { color: '#D6A23E' },
  });
  Defs.add('attack', {
    id: 'dial.keeper.sweep', kind: 'spread', type: 'swell', mult: 2, cooldown: 0, range: 14, windup: 1.7, shape: 'wedge',
    radius: 11, angle: 1.75, count: 1, spread: 0, speed: 0, evadable: false, ailment: null, summon: null,
    fx: { color: '#D6A23E' },
  });
  Defs.add('attack', {
    id: 'dial.keeper.round', kind: 'spread', type: 'swell', mult: 1.6, cooldown: 0, range: 8, windup: 1.6, shape: 'ring',
    radius: 6.5, angle: 0, count: 1, spread: 0, speed: 0, evadable: false, ailment: null, summon: null,
    fx: { color: '#5B5470' },
  });

  // ---- the dead ----

  Defs.add('enemy', {
    id: WALKER, name: 'Wake-walker', puppet: PUPPET.walker, radius: 0.38, life: 11, damage: 1.1, speed: 2.4, xp: 1, cost: 1,
    loot: null, ai: 'wake', aiParams: {}, attacks: ['dial.clutch'], guard: {}, size: 'small', press: 0.3, tags: ['wake-walker'],
  });
  Defs.add('enemy', {
    id: HANGER, name: 'Hanger-on', puppet: PUPPET.hanger, radius: 0.3, life: 7, damage: 0.9, speed: 2.8, xp: 1, cost: 1,
    loot: null, ai: 'wake', aiParams: { hop: 0.42 }, attacks: ['dial.leap'], guard: {}, size: 'small', press: 0.3,
    tags: ['hanger-on'],
  });
  Defs.add('enemy', {
    id: HEAVY, name: 'Lumper', puppet: PUPPET.heavy, radius: 0.75, life: 60, damage: 2.3, speed: 1.6, xp: 6, cost: 5,
    loot: null, ai: 'wake', aiParams: {}, attacks: ['dial.shoulder', 'dial.load'], guard: { blow: 60 }, size: 'large',
    press: 0.8, tags: ['heavy'],
  });

  Defs.add('boss', {
    id: KEEPER, name: 'the Half-muffled Keeper', puppet: PUPPET.keeper, radius: 1.3, life: 1100, damage: 6, speed: 1.9,
    xp: 120, cost: 0, loot: null, ai: 'keeper',
    aiParams: { keep: 2.5, echo: 0.3, after: 2, before: 1.2, lay: 0.7, reverse: [1.2, 2, 2.8], order: ['after', 'before', 'reverse'], first: 4 },
    attacks: ['dial.keeper.stroke', 'dial.keeper.sweep', 'dial.keeper.round'], guard: {}, size: 'large', press: 1,
    tags: ['keeper'], arena: { radius: 30 },
    phases: [
      { until: 0.6, speed: 1, onEnter: [], loop: ['dial.keeper.stroke', { wait: 2.2 }, 'dial.keeper.sweep', { wait: 2.6 }] },
      { until: 0.25, speed: 1.15, onEnter: ['dial.keeper.round'], loop: ['dial.keeper.sweep', { wait: 2.4 }, 'dial.keeper.stroke', { wait: 2.2 }] },
      { until: 0, speed: 1.3, onEnter: [], loop: ['dial.keeper.stroke', { wait: 5.5 }] },
    ],
  });

  // ---- the elites' traits ----

  Defs.add('trait', { id: 'dial.lead-lined', name: 'Lead-lined', text: 'Buried in lead: a third less from Blows.',
    mods: [{ stat: 'taken', op: 'inc', value: -33, tags: ['blow'] }] });
  Defs.add('trait', { id: 'dial.long-watched', name: 'Long-watched', text: 'Watched over for many nights: half again its life.',
    mods: [{ stat: 'life-max', op: 'inc', value: 50 }] });
  Defs.add('trait', { id: 'dial.in-haste', name: 'In Haste', text: 'Buried in haste: it walks 30% faster.',
    mods: [{ stat: 'move-speed', op: 'inc', value: 30 }] });
  Defs.add('trait', { id: 'dial.hard-handed', name: 'Hard-handed', text: 'Its blows and its press are 35% heavier.',
    mods: [{ stat: 'damage', op: 'inc', value: 35 }] });
  Defs.add('trait', { id: 'dial.double-shrouded', name: 'Double-shrouded', text: 'Wound twice in its shroud: a third less from Drag.',
    mods: [{ stat: 'taken', op: 'inc', value: -33, tags: ['drag'] }] });

  // ---- the district ----

  Defs.add('zone', {
    id: 'dial', name: 'the Dial', kind: 'district', level: 1, tollSeconds: 75, keeperToll: 8, gateEvery: 3,
    region: { radius: 35 }, start: { x: 0, y: 7 }, tileset: TILESET,
    place: [
      { prop: PROP.post, x: 0, y: 0, role: 'bell-post' },
      { prop: PROP.stone, x: 0, y: -STONE_R, role: 'landmark' },          // north: the toll rings as the shadow crosses it
      { prop: PROP.stone, x: DIAG, y: -DIAG, role: 'landmark' },
      { prop: PROP.stone, x: STONE_R, y: 0 },
      { prop: PROP.stone, x: DIAG, y: DIAG, role: 'landmark' },
      { prop: PROP.stone, x: 0, y: STONE_R },
      { prop: PROP.stone, x: -DIAG, y: DIAG, role: 'landmark' },
      { prop: PROP.stone, x: -STONE_R, y: 0 },
      { prop: PROP.stone, x: -DIAG, y: -DIAG, role: 'landmark' },
    ],
    props: [],
    ambient: {
      light: [0.62, 0.57, 0.5], fog: { color: [0.36, 0.33, 0.42], near: 12, far: 42 },
      sun: { dir: [-0.42, -1, -0.55], color: [1, 0.9, 0.72] },
      palette: { chalk: '#E4DFD1', gold: '#D6A23E', slate: '#5B5470', bronze: '#8A5F37', moss: '#5D6A39' },
    },
    music: 'vigil',
    timeline: [
      { toll: 0, rate: 1, cap: 40, pool: [{ enemy: WALKER, w: 10 }] },
      { toll: 1, rate: 1.5, cap: 70, pool: [{ enemy: WALKER, w: 9 }, { enemy: HEAVY, w: 1 }] },
      { toll: 2, rate: 2.1, cap: 100, pool: [{ enemy: WALKER, w: 7 }, { enemy: HANGER, w: 2 }, { enemy: HEAVY, w: 1 }] },
      { toll: 3, rate: 2.8, cap: 140, pool: [{ enemy: WALKER, w: 6 }, { enemy: HANGER, w: 3 }, { enemy: HEAVY, w: 1.2 }] },
      { toll: 4, rate: 3, cap: 160, pool: [{ enemy: WALKER, w: 5 }, { enemy: HANGER, w: 2 }, { enemy: HEAVY, w: 3 }] },
      { toll: 5, rate: 2.9, cap: 180, pool: [{ enemy: WALKER, w: 8 }, { enemy: HANGER, w: 3 }, { enemy: HEAVY, w: 1.2 }] },
      { toll: 6, rate: 2.8, cap: 200, pool: [{ enemy: WALKER, w: 4.5 }, { enemy: HANGER, w: 1 }, { enemy: HEAVY, w: 4.5 }] },
      { toll: 7, rate: 2.7, cap: 220, pool: [{ enemy: WALKER, w: 6 }, { enemy: HANGER, w: 3 }, { enemy: HEAVY, w: 2 }] },
      { toll: 8, rate: 2.4, cap: 160, pool: [{ enemy: WALKER, w: 7 }, { enemy: HANGER, w: 2 }, { enemy: HEAVY, w: 1 }] },
      { toll: 9, rate: 5, cap: 300, pool: [{ enemy: WALKER, w: 6 }, { enemy: HANGER, w: 3 }, { enemy: HEAVY, w: 2 }] },
    ],
    overtoll: { rateMul: 1.3, levelPer: 2, rewardPer: 0.25 },
    events: [
      { toll: 1, kind: 'elite', enemy: WALKER },
      { toll: 2, kind: 'elite', enemy: HEAVY },
      { toll: 2, kind: 'swarm', enemy: WALKER, shape: 'ring', count: 9 },
      { toll: 3, kind: 'elite', enemy: WALKER },
      { toll: 3, kind: 'swarm', enemy: HANGER, shape: 'arc', count: 6 },
      { toll: 4, kind: 'elite', enemy: WALKER, count: 2 },
      { toll: 5, kind: 'elite', enemy: WALKER },
      { toll: 5, kind: 'swarm', enemy: WALKER, shape: 'column', count: 12 },
      { toll: 6, kind: 'elite', enemy: WALKER, count: 2 },
      { toll: 6, kind: 'swarm', enemy: WALKER, shape: 'ring', count: 10 },
      { toll: 7, kind: 'elite', enemy: WALKER },
      { toll: 7, kind: 'swarm', enemy: HANGER, shape: 'arc', count: 6 },
      { toll: 8, kind: 'swarm', enemy: WALKER, shape: 'ring', count: 12 },
    ],
    boss: KEEPER,
    rules: { overElites: 2, shadowSpan: 1.5707963, shadowSpeed: 1.3, shadowWarn: 0.3 },
    unlock: null, next: null,
    districtRules: ['dial.shadow'], ordinal: 1,
  });
})();
