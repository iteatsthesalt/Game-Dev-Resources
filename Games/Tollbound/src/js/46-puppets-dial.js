// 46-puppets-dial.js: the cast of the Dial (docs/design/01-world.md, "Art direction"): the Change-ringer, the dead of
// the Dial, their keeper and the lychgate. Every figure is built of the five unit shapes on the rigs of 61-rigs.js.
// Owns: (none)
// Public: nothing; it only registers definitions with Defs.add (the ids both sides need, docs/engine.md):
//   puppet 'change-ringer'              the player: an upright ringer in a wool-red jerkin (the class colour, the first
//                                       of the class's palette: #A7312C), sphere head held high, a bell-rope rising
//                                       plumb from its clasped hands, far above its head, with a red, white and blue
//                                       sally at the hands; a small lamp at the belt. 1.75 m, the rope to 3.5 m.
//   puppet 'dial.wake-walker'           the common dead: a drowned parish mourner in a long violet-grey coat with a
//                                       dark tide line at the knee, hat low and bowed, a white weeper band and
//                                       streamer; arms hang, feet drag. 1.5 m, about 0.32 m round.
//   puppet 'dial.hanger-on'             a half-height box figure in a noon-gold cap that moves in quick hops.
//                                       0.95 m, about 0.22 m round.
//   puppet 'dial.heavy'                 a broad lumper of the parish, twice as wide on short legs, a hessian bale on its
//                                       back held by a bronze strap: shelter you can see. 1.75 m, 0.7 m round.
//   puppet 'dial.half-muffled-keeper'   the keeper: Great Hour's keeper as a walking bronze bell 4.2 m tall, its
//                                       crown for a head, a great clapper in its right hand with leather strapped to
//                                       one side of the ball. 1.2 m round at scale 1.
//   puppet 'gate'                       the lychgate: four oak posts under a steep hipped slate roof, a small bell hung
//                                       under the ridge and two lit lamps at the front. 3.7 m wide, 3.9 m tall; it
//                                       faces +z.
//   puppet 'favour.<motif>'             what rises from the ground for a favour whose icon names that motif (68-scene.js
//                                       draws pickups of kind 3 with them): loaf, candle, sprig, clock, basin, stone,
//                                       road, frame, jug, hatband, crape, gloves, window, door, handbell, sally, stay,
//                                       mourners, coffin, roof, muffle, arch, coins, nail, passing-bell: the motifs of
//                                       40-favours.js, each in the forms and colours 62-glyphs.js paints its icon in,
//                                       on a low plinth, about 0.6 m tall
// The dead wear the Dial's colours at low saturation, each family with one bright accent (the wake-walkers' white
// weeper, the hangers-on's gold cap, the heavy's bronze strap, the keeper's bronze); only flames glow. A figure
// faces +z with its left side at +x; a part's "at" is the centre of its base from its joint (see 48-puppets-test.js).
// The anim numbers the biped reads beyond stride, swing, bob, lean, lift and reach are listed in 61-rigs.js
// (droop, sway, hop, plumb, clasp, pull); joints moves a joint's rest place.
(function () {
  'use strict';

  // ---- the player: the Change-ringer ----
  Defs.add('puppet', {
    id: 'change-ringer', rig: 'biped', scale: 1,
    parts: [
      { key: 'legL', shape: 'box', size: [0.14, 0.84, 0.15], at: [0, -0.86, 0], joint: 'legL', color: 'breeches' },
      { key: 'legR', shape: 'box', size: [0.14, 0.84, 0.15], at: [0, -0.86, 0], joint: 'legR', color: 'breeches' },
      { key: 'bootL', shape: 'box', size: [0.13, 0.1, 0.24], at: [0, -0.92, 0.03], joint: 'legL', color: 'leather', detail: true },
      { key: 'bootR', shape: 'box', size: [0.13, 0.1, 0.24], at: [0, -0.92, 0.03], joint: 'legR', color: 'leather', detail: true },
      { key: 'hips', shape: 'box', size: [0.34, 0.22, 0.22], at: [0, -0.14, 0], joint: 'torso', color: 'breeches' },
      { key: 'body', shape: 'box', size: [0.4, 0.5, 0.26], at: [0, 0.06, 0], joint: 'torso', color: 'jerkin' },
      { key: 'belt', shape: 'box', size: [0.41, 0.06, 0.27], at: [0, 0.05, 0], joint: 'torso', color: 'leather', detail: true },
      { key: 'lamp', shape: 'box', size: [0.07, 0.09, 0.07], at: [0.16, -0.04, 0.13], joint: 'torso', color: 'flame', glow: 1 },
      { key: 'lampCap', shape: 'box', size: [0.09, 0.03, 0.09], at: [0.16, 0.05, 0.13], joint: 'torso', color: 'iron', detail: true },
      { key: 'collar', shape: 'box', size: [0.3, 0.06, 0.24], at: [0, 0.54, 0], joint: 'torso', color: 'white', detail: true },
      { key: 'head', shape: 'sphere', size: [0.25, 0.27, 0.25], at: [0, 0, 0.01], joint: 'head', color: 'skin' },
      { key: 'hair', shape: 'sphere', size: [0.26, 0.17, 0.26], at: [0, 0.12, -0.01], joint: 'head', color: 'hair', detail: true },
      { key: 'armL', shape: 'box', size: [0.1, 0.56, 0.11], at: [0, -0.56, 0], joint: 'armL', color: 'jerkin' },
      { key: 'armR', shape: 'box', size: [0.1, 0.56, 0.11], at: [0, -0.56, 0], joint: 'armR', color: 'jerkin' },
      { key: 'handL', shape: 'box', size: [0.08, 0.08, 0.08], at: [0, -0.62, 0], joint: 'armL', color: 'skin', detail: true },
      { key: 'tail', shape: 'cyl', size: [0.04, 0.5, 0.04], at: [0, -0.5, 0], joint: 'handR', color: 'rope' },
      { key: 'sallyRed', shape: 'cyl', size: [0.12, 0.16, 0.12], at: [0, -0.06, 0], joint: 'handR', color: 'red' },
      { key: 'sallyWhite', shape: 'cyl', size: [0.12, 0.16, 0.12], at: [0, 0.1, 0], joint: 'handR', color: 'white' },
      { key: 'sallyBlue', shape: 'cyl', size: [0.12, 0.16, 0.12], at: [0, 0.26, 0], joint: 'handR', color: 'blue' },
      { key: 'rope', shape: 'cyl', size: [0.045, 2.3, 0.045], at: [0, 0.42, 0], joint: 'handR', color: 'rope' },
    ],
    palette: {
      breeches: [0.25, 0.21, 0.19], leather: [0.38, 0.25, 0.14], jerkin: '#A7312C', flame: [1, 0.76, 0.36], iron: [0.16, 0.15, 0.15],
      white: [0.94, 0.93, 0.88], skin: [0.88, 0.68, 0.52], hair: [0.3, 0.2, 0.13], rope: [0.82, 0.72, 0.52],
      red: [0.8, 0.13, 0.12], blue: [0.15, 0.25, 0.62],
    },
    anim: {
      stride: 1.5, swing: 0.1, bob: 0.02, lean: 0, lift: 0.12, reach: 0.9, clasp: 0.3, plumb: 1, pull: 1,
      joints: { handR: [0, -0.56, 0.03] },
    },
  });

  // ---- the common dead: a wake-walker ----
  Defs.add('puppet', {
    id: 'dial.wake-walker', rig: 'biped', scale: 1,
    parts: [
      { key: 'legL', shape: 'box', size: [0.12, 0.8, 0.14], at: [0, -0.84, 0], joint: 'legL', color: 'trousers' },
      { key: 'legR', shape: 'box', size: [0.12, 0.8, 0.14], at: [0, -0.84, 0], joint: 'legR', color: 'trousers' },
      { key: 'footL', shape: 'box', size: [0.11, 0.06, 0.2], at: [0, -0.84, 0.03], joint: 'legL', color: 'hat', detail: true },
      { key: 'footR', shape: 'box', size: [0.11, 0.06, 0.2], at: [0, -0.84, 0.03], joint: 'legR', color: 'hat', detail: true },
      { key: 'skirt', shape: 'taper', size: [0.44, 0.58, 0.32], at: [0, -0.52, -0.01], joint: 'torso', color: 'coat' },
      { key: 'tide', shape: 'box', size: [0.45, 0.05, 0.33], at: [0, -0.45, -0.01], joint: 'torso', color: 'tide', detail: true },
      { key: 'body', shape: 'taper', size: [0.4, 0.52, 0.28], at: [0, 0, 0], joint: 'torso', color: 'coat' },
      { key: 'head', shape: 'box', size: [0.18, 0.2, 0.19], at: [0, -0.02, 0.01], joint: 'head', color: 'face' },
      { key: 'brim', shape: 'box', size: [0.27, 0.03, 0.27], at: [0, 0.15, 0.01], joint: 'head', color: 'hat' },
      { key: 'crown', shape: 'box', size: [0.17, 0.12, 0.17], at: [0, 0.18, 0], joint: 'head', color: 'hat' },
      { key: 'band', shape: 'box', size: [0.18, 0.035, 0.18], at: [0, 0.19, 0], joint: 'head', color: 'weeper' },
      { key: 'streamer', shape: 'box', size: [0.07, 0.46, 0.02], at: [0, -0.27, -0.1], joint: 'head', color: 'weeper' },
      { key: 'armL', shape: 'box', size: [0.085, 0.58, 0.09], at: [0, -0.58, 0], joint: 'armL', color: 'coat' },
      { key: 'armR', shape: 'box', size: [0.085, 0.58, 0.09], at: [0, -0.58, 0], joint: 'armR', color: 'coat' },
      { key: 'handL', shape: 'box', size: [0.07, 0.07, 0.08], at: [0, -0.64, 0], joint: 'armL', color: 'face', detail: true },
      { key: 'handR', shape: 'box', size: [0.07, 0.07, 0.08], at: [0, -0.64, 0], joint: 'armR', color: 'face', detail: true },
    ],
    palette: {
      coat: [0.36, 0.34, 0.41], trousers: [0.26, 0.25, 0.29], tide: [0.2, 0.2, 0.24], face: [0.64, 0.62, 0.58],
      hat: [0.17, 0.16, 0.19], weeper: [0.93, 0.91, 0.86],
    },
    anim: {
      stride: 0.9, swing: 0.1, bob: 0.015, lean: 0.26, lift: 0.03, reach: 0, droop: 0.32, sway: 0.035,
      joints: {
        torso: [0, 0.84, 0], head: [0, 0.42, 0.1], armL: [0.17, 0.42, 0.02], armR: [-0.17, 0.42, 0.02],
        legL: [0.09, 0.84, 0], legR: [-0.09, 0.84, 0],
      },
    },
  });

  // ---- a hanger-on: half height, boxy, in quick hops ----
  Defs.add('puppet', {
    id: 'dial.hanger-on', rig: 'biped', scale: 1,
    parts: [
      { key: 'legL', shape: 'box', size: [0.1, 0.38, 0.11], at: [0, -0.4, 0], joint: 'legL', color: 'legs' },
      { key: 'legR', shape: 'box', size: [0.1, 0.38, 0.11], at: [0, -0.4, 0], joint: 'legR', color: 'legs' },
      { key: 'body', shape: 'box', size: [0.3, 0.3, 0.22], at: [0, -0.04, 0], joint: 'torso', color: 'smock' },
      { key: 'head', shape: 'box', size: [0.24, 0.22, 0.22], at: [0, 0, 0.01], joint: 'head', color: 'face' },
      { key: 'cap', shape: 'box', size: [0.25, 0.06, 0.24], at: [0, 0.2, -0.01], joint: 'head', color: 'cap' },
      { key: 'peak', shape: 'box', size: [0.16, 0.03, 0.1], at: [0, 0.2, 0.15], joint: 'head', color: 'cap', detail: true },
      { key: 'armL', shape: 'box', size: [0.07, 0.26, 0.08], at: [0, -0.26, 0], joint: 'armL', color: 'smock' },
      { key: 'armR', shape: 'box', size: [0.07, 0.26, 0.08], at: [0, -0.26, 0], joint: 'armR', color: 'smock' },
    ],
    palette: { smock: [0.42, 0.37, 0.31], legs: [0.27, 0.24, 0.22], face: [0.66, 0.63, 0.57], cap: [0.76, 0.55, 0.18] },
    anim: {
      stride: 0.9, swing: 0.45, bob: 0, lean: 0.12, lift: 0.05, reach: 0, droop: 0.1, hop: 0.14,
      joints: {
        torso: [0, 0.4, 0], head: [0, 0.28, 0.04], armL: [0.15, 0.24, 0], armR: [-0.15, 0.24, 0],
        legL: [0.07, 0.4, 0], legR: [-0.07, 0.4, 0], handR: [0, -0.26, 0.02],
      },
    },
  });

  // ---- the heavy dead: twice as wide, short legs, a bale on the shoulders ----
  Defs.add('puppet', {
    id: 'dial.heavy', rig: 'biped', scale: 1,
    parts: [
      { key: 'legL', shape: 'box', size: [0.26, 0.6, 0.28], at: [0, -0.62, 0], joint: 'legL', color: 'legs' },
      { key: 'legR', shape: 'box', size: [0.26, 0.6, 0.28], at: [0, -0.62, 0], joint: 'legR', color: 'legs' },
      { key: 'footL', shape: 'box', size: [0.26, 0.08, 0.34], at: [0, -0.62, 0.04], joint: 'legL', color: 'legs', detail: true },
      { key: 'footR', shape: 'box', size: [0.26, 0.08, 0.34], at: [0, -0.62, 0.04], joint: 'legR', color: 'legs', detail: true },
      { key: 'body', shape: 'taper', size: [1.08, 0.76, 0.6], at: [0, -0.1, 0], joint: 'torso', color: 'smock' },
      { key: 'apron', shape: 'box', size: [0.66, 0.52, 0.05], at: [0, -0.08, 0.28], joint: 'torso', color: 'leather' },
      { key: 'tide', shape: 'box', size: [1.1, 0.05, 0.62], at: [0, 0.0, 0], joint: 'torso', color: 'tide', detail: true },
      { key: 'knot', shape: 'box', size: [0.96, 0.16, 0.5], at: [0, 0.58, -0.04], joint: 'torso', color: 'pad' },
      { key: 'bale', shape: 'box', size: [1.3, 0.52, 0.48], at: [0, 0.52, -0.34], joint: 'torso', color: 'bale' },
      { key: 'strap', shape: 'box', size: [1.32, 0.08, 0.5], at: [0, 0.74, -0.34], joint: 'torso', color: 'bronze' },
      { key: 'head', shape: 'box', size: [0.26, 0.26, 0.26], at: [0, -0.04, 0.02], joint: 'head', color: 'face' },
      { key: 'armL', shape: 'box', size: [0.17, 0.58, 0.18], at: [0, -0.58, 0], joint: 'armL', color: 'smock' },
      { key: 'armR', shape: 'box', size: [0.17, 0.58, 0.18], at: [0, -0.58, 0], joint: 'armR', color: 'smock' },
      { key: 'handL', shape: 'box', size: [0.15, 0.12, 0.16], at: [0, -0.66, 0], joint: 'armL', color: 'face', detail: true },
      { key: 'handR', shape: 'box', size: [0.15, 0.12, 0.16], at: [0, -0.66, 0], joint: 'armR', color: 'face', detail: true },
    ],
    palette: {
      smock: [0.4, 0.4, 0.34], legs: [0.28, 0.27, 0.24], leather: [0.33, 0.26, 0.2], tide: [0.25, 0.26, 0.22],
      pad: [0.46, 0.42, 0.36], bale: [0.36, 0.31, 0.26], bronze: [0.72, 0.47, 0.22], face: [0.64, 0.62, 0.57],
    },
    anim: {
      stride: 0.85, swing: 0.12, bob: 0.03, lean: 0.2, lift: 0.04, reach: 0, droop: 0.15, sway: 0.07,
      joints: {
        torso: [0, 0.62, 0], head: [0, 0.6, 0.16], armL: [0.55, 0.5, 0.02], armR: [-0.55, 0.5, 0.02],
        legL: [0.24, 0.62, 0], legR: [-0.24, 0.62, 0],
      },
    },
  });

  // ---- the keeper: a walking bell with its clapper ----
  Defs.add('puppet', {
    id: 'dial.half-muffled-keeper', rig: 'biped', scale: 2.3,
    parts: [
      { key: 'legL', shape: 'box', size: [0.14, 0.6, 0.16], at: [0, -0.62, 0], joint: 'legL', color: 'iron' },
      { key: 'legR', shape: 'box', size: [0.14, 0.6, 0.16], at: [0, -0.62, 0], joint: 'legR', color: 'iron' },
      { key: 'lip', shape: 'cyl', size: [1.04, 0.12, 1.04], at: [0, -0.58, 0], joint: 'torso', color: 'lip' },
      { key: 'bell', shape: 'cone', size: [0.98, 1.6, 0.98], at: [0, -0.46, 0], joint: 'torso', color: 'bronze' },
      { key: 'bow', shape: 'cyl', size: [0.8, 0.06, 0.8], at: [0, -0.3, 0], joint: 'torso', color: 'verdigris', detail: true },
      { key: 'waist', shape: 'cyl', size: [0.5, 0.06, 0.5], at: [0, 0.22, 0], joint: 'torso', color: 'verdigris', detail: true },
      { key: 'shoulder', shape: 'cyl', size: [0.5, 0.2, 0.5], at: [0, 0.5, 0], joint: 'torso', color: 'bronze' },
      { key: 'crown', shape: 'sphere', size: [0.44, 0.42, 0.44], at: [0, -0.08, 0], joint: 'head', color: 'bronze' },
      { key: 'canons', shape: 'box', size: [0.09, 0.16, 0.24], at: [0, 0.3, 0], joint: 'head', color: 'iron', detail: true },
      { key: 'armL', shape: 'box', size: [0.12, 0.72, 0.12], at: [0, -0.72, 0], joint: 'armL', color: 'robe' },
      { key: 'armR', shape: 'box', size: [0.12, 0.72, 0.12], at: [0, -0.72, 0], joint: 'armR', color: 'robe' },
      { key: 'shaft', shape: 'cyl', size: [0.07, 1.2, 0.07], at: [0, -0.22, 0], joint: 'handR', color: 'iron' },
      { key: 'ball', shape: 'sphere', size: [0.3, 0.3, 0.3], at: [0, 0.96, 0], joint: 'handR', color: 'iron' },
      { key: 'muffle', shape: 'box', size: [0.15, 0.3, 0.3], at: [0.12, 0.96, 0], joint: 'handR', color: 'leather' },
    ],
    palette: {
      bronze: [0.6, 0.41, 0.22], lip: [0.47, 0.31, 0.17], verdigris: [0.36, 0.5, 0.38], iron: [0.17, 0.16, 0.17],
      robe: [0.24, 0.22, 0.27], leather: [0.38, 0.23, 0.13],
    },
    anim: {
      stride: 0.9, swing: 0.15, bob: 0.02, lean: 0.05, lift: 0.06, reach: 0.25, sway: 0.03,
      joints: {
        torso: [0, 0.62, 0], head: [0, 0.86, 0.02], armL: [0.36, 0.7, 0], armR: [-0.36, 0.7, 0],
        legL: [0.14, 0.62, 0], legR: [-0.14, 0.62, 0], handR: [0, -0.7, 0.04],
      },
    },
  });

  // ---- the lychgate: the roofed gate where the bier waited ----
  Defs.add('puppet', {
    id: 'gate', rig: 'static', scale: 1,
    parts: [
      { key: 'sill', shape: 'box', size: [2.2, 0.12, 0.8], at: [0, 0, 0], joint: 'root', color: 'stone' },
      { key: 'postFL', shape: 'box', size: [0.22, 2.4, 0.22], at: [1.35, 0, 0.6], joint: 'root', color: 'oak' },
      { key: 'postFR', shape: 'box', size: [0.22, 2.4, 0.22], at: [-1.35, 0, 0.6], joint: 'root', color: 'oak' },
      { key: 'postBL', shape: 'box', size: [0.22, 2.4, 0.22], at: [1.35, 0, -0.6], joint: 'root', color: 'oak' },
      { key: 'postBR', shape: 'box', size: [0.22, 2.4, 0.22], at: [-1.35, 0, -0.6], joint: 'root', color: 'oak' },
      { key: 'beamF', shape: 'box', size: [3.0, 0.16, 0.2], at: [0, 2.4, 0.6], joint: 'root', color: 'oak' },
      { key: 'beamB', shape: 'box', size: [3.0, 0.16, 0.2], at: [0, 2.4, -0.6], joint: 'root', color: 'oak' },
      { key: 'eaves', shape: 'taper', size: [3.7, 0.55, 2.1], at: [0, 2.56, 0], joint: 'root', color: 'slate' },
      { key: 'roof', shape: 'taper', size: [2.2, 0.75, 1.24], at: [0, 3.1, 0], joint: 'root', color: 'slate' },
      { key: 'ridge', shape: 'box', size: [1.5, 0.12, 0.16], at: [0, 3.84, 0], joint: 'root', color: 'oak', detail: true },
      { key: 'bell', shape: 'cone', size: [0.34, 0.34, 0.34], at: [0, 2.1, 0], joint: 'root', color: 'bronze' },
      { key: 'bellLip', shape: 'cyl', size: [0.36, 0.05, 0.36], at: [0, 2.08, 0], joint: 'root', color: 'bronze', detail: true },
      { key: 'lampL', shape: 'box', size: [0.22, 0.28, 0.22], at: [1.35, 1.7, 0.84], joint: 'root', color: 'flame', glow: 1 },
      { key: 'lampR', shape: 'box', size: [0.22, 0.28, 0.22], at: [-1.35, 1.7, 0.84], joint: 'root', color: 'flame', glow: 1 },
      { key: 'capL', shape: 'cone', size: [0.3, 0.16, 0.3], at: [1.35, 1.98, 0.84], joint: 'root', color: 'iron' },
      { key: 'capR', shape: 'cone', size: [0.3, 0.16, 0.3], at: [-1.35, 1.98, 0.84], joint: 'root', color: 'iron' },
    ],
    palette: {
      stone: [0.62, 0.6, 0.56], oak: [0.34, 0.25, 0.18], slate: [0.38, 0.35, 0.46], bronze: [0.6, 0.41, 0.22],
      flame: [1, 0.78, 0.38], iron: [0.18, 0.17, 0.18],
    },
    anim: {},
  });

  // ---- the favours' shapes: what rises from the ground for each motif a favour's icon names (40-favours.js), in
  // the forms and colours its icon is painted in (62-glyphs.js), each on a low lead plinth ----
  Defs.add('puppet', { id: 'favour.loaf', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', hemp: '#c7a86f', oak: '#8a5f37' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.56, 0.06, 0.56], at: [0, 0, 0], color: 'lead' },
    { key: 'loaf', shape: 'taper', size: [0.52, 0.26, 0.34], at: [0, 0.06, 0], color: 'hemp' },
    { key: 'crown', shape: 'taper', size: [0.3, 0.1, 0.2], at: [0, 0.32, 0], color: 'hemp' },
    { key: 'score', shape: 'box', size: [0.05, 0.04, 0.22], at: [0.06, 0.4, 0], color: 'oak' },
  ] });
  Defs.add('puppet', { id: 'favour.candle', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', chalk: '#e4dfd1', lamp: '#e6c25a' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.4, 0.06, 0.4], at: [0, 0, 0], color: 'lead' },
    { key: 'wax', shape: 'cyl', size: [0.17, 0.5, 0.17], at: [0, 0.06, 0], color: 'chalk' },
    { key: 'flame', shape: 'cone', size: [0.09, 0.16, 0.09], at: [0, 0.58, 0], color: 'lamp', glow: 1 },
  ] });
  Defs.add('puppet', { id: 'favour.sprig', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', oak: '#8a5f37', moss: '#5d6a39' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.4, 0.06, 0.4], at: [0, 0, 0], color: 'lead' },
    { key: 'stem', shape: 'cyl', size: [0.04, 0.62, 0.04], at: [0, 0.06, 0], color: 'oak' },
    { key: 'leaves', shape: 'cone', size: [0.3, 0.34, 0.3], at: [0, 0.24, 0], color: 'moss' },
    { key: 'top', shape: 'cone', size: [0.2, 0.26, 0.2], at: [0, 0.48, 0], color: 'moss' },
  ] });
  Defs.add('puppet', { id: 'favour.clock', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', oak: '#8a5f37', chalk: '#e4dfd1' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.48, 0.06, 0.48], at: [0, 0, 0], color: 'lead' },
    { key: 'case', shape: 'box', size: [0.34, 0.66, 0.2], at: [0, 0.06, 0], color: 'oak' },
    { key: 'face', shape: 'box', size: [0.24, 0.24, 0.22], at: [0, 0.42, 0], color: 'chalk' },
  ] });
  Defs.add('puppet', { id: 'favour.basin', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', chalk: '#e4dfd1', water: '#4a6f8e' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.4, 0.2, 0.4], at: [0, 0, 0], color: 'lead' },
    { key: 'bowl', shape: 'cyl', size: [0.6, 0.18, 0.6], at: [0, 0.2, 0], color: 'chalk' },
    { key: 'water', shape: 'cyl', size: [0.5, 0.02, 0.5], at: [0, 0.38, 0], color: 'water' },
  ] });
  Defs.add('puppet', { id: 'favour.stone', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', slate: '#5b5470' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.56, 0.06, 0.56], at: [0, 0, 0], color: 'slate' },
    { key: 'stone', shape: 'box', size: [0.5, 0.34, 0.32], at: [0, 0.06, 0], color: 'lead' },
    { key: 'step', shape: 'box', size: [0.16, 0.2, 0.34], at: [0.12, 0.4, 0], color: 'lead' },
  ] });
  Defs.add('puppet', { id: 'favour.road', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', loam: '#79593b', hemp: '#c7a86f' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.62, 0.06, 0.62], at: [0, 0, 0], color: 'lead' },
    { key: 'road', shape: 'taper', size: [0.6, 0.16, 0.42], at: [0, 0.06, 0], color: 'loam' },
    { key: 'line', shape: 'box', size: [0.05, 0.04, 0.3], at: [0, 0.2, 0], color: 'hemp' },
  ] });
  Defs.add('puppet', { id: 'favour.frame', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', hemp: '#c7a86f', soot: '#25211e' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.44, 0.06, 0.44], at: [0, 0, 0], color: 'lead' },
    { key: 'frame', shape: 'box', size: [0.46, 0.56, 0.06], at: [0, 0.06, 0], color: 'hemp' },
    { key: 'back', shape: 'box', size: [0.34, 0.42, 0.07], at: [0, 0.13, 0], color: 'soot' },
  ] });
  Defs.add('puppet', { id: 'favour.jug', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', hemp: '#c7a86f' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.44, 0.06, 0.44], at: [0, 0, 0], color: 'lead' },
    { key: 'belly', shape: 'sphere', size: [0.4, 0.42, 0.4], at: [0, 0.06, 0], color: 'hemp' },
    { key: 'neck', shape: 'cyl', size: [0.16, 0.18, 0.16], at: [0, 0.42, 0], color: 'hemp' },
    { key: 'handle', shape: 'box', size: [0.06, 0.24, 0.1], at: [0.22, 0.16, 0], color: 'hemp' },
  ] });
  Defs.add('puppet', { id: 'favour.hatband', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', dark: '#0a0c11', soot: '#25211e' }, parts: [
    { key: 'brim', shape: 'cyl', size: [0.5, 0.04, 0.5], at: [0, 0, 0], color: 'soot' },
    { key: 'crown', shape: 'cyl', size: [0.32, 0.4, 0.32], at: [0, 0.04, 0], color: 'lead' },
    { key: 'band', shape: 'cyl', size: [0.34, 0.1, 0.34], at: [0, 0.06, 0], color: 'dark' },
  ] });
  Defs.add('puppet', { id: 'favour.crape', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', oak: '#8a5f37', dark: '#0a0c11' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.44, 0.06, 0.44], at: [0, 0, 0], color: 'lead' },
    { key: 'door', shape: 'box', size: [0.4, 0.66, 0.08], at: [0, 0.06, 0], color: 'oak' },
    { key: 'crape', shape: 'taper', size: [0.28, 0.28, 0.1], at: [0, 0.3, 0], color: 'dark' },
  ] });
  Defs.add('puppet', { id: 'favour.gloves', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', chalk: '#e4dfd1' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.44, 0.06, 0.44], at: [0, 0, 0], color: 'lead' },
    { key: 'palm', shape: 'box', size: [0.26, 0.26, 0.1], at: [0, 0.06, 0], color: 'chalk' },
    { key: 'fingers', shape: 'box', size: [0.24, 0.2, 0.08], at: [0, 0.32, 0], color: 'chalk' },
    { key: 'thumb', shape: 'box', size: [0.07, 0.14, 0.08], at: [0.17, 0.18, 0], color: 'chalk' },
  ] });
  Defs.add('puppet', { id: 'favour.window', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', oak: '#8a5f37', soot: '#25211e' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.44, 0.06, 0.44], at: [0, 0, 0], color: 'lead' },
    { key: 'frame', shape: 'box', size: [0.44, 0.56, 0.08], at: [0, 0.06, 0], color: 'oak' },
    { key: 'pane', shape: 'box', size: [0.3, 0.42, 0.09], at: [0, 0.13, 0], color: 'soot' },
  ] });
  Defs.add('puppet', { id: 'favour.door', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', oak: '#8a5f37', timber: '#6a492d' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.44, 0.06, 0.44], at: [0, 0, 0], color: 'lead' },
    { key: 'door', shape: 'box', size: [0.38, 0.68, 0.1], at: [0, 0.06, 0], color: 'oak' },
    { key: 'joint', shape: 'box', size: [0.04, 0.64, 0.11], at: [0, 0.08, 0], color: 'timber' },
  ] });
  Defs.add('puppet', { id: 'favour.handbell', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', bronze: '#c79a45', oak: '#8a5f37' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.44, 0.06, 0.44], at: [0, 0, 0], color: 'lead' },
    { key: 'lip', shape: 'cyl', size: [0.42, 0.05, 0.42], at: [0, 0.06, 0], color: 'bronze' },
    { key: 'bell', shape: 'cone', size: [0.4, 0.4, 0.4], at: [0, 0.06, 0], color: 'bronze' },
    { key: 'handle', shape: 'cyl', size: [0.07, 0.22, 0.07], at: [0, 0.4, 0], color: 'oak' },
  ] });
  Defs.add('puppet', { id: 'favour.sally', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', hemp: '#c7a86f', red: '#a7312c', white: '#ece9e1', blue: '#2e4e8e' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.4, 0.06, 0.4], at: [0, 0, 0], color: 'lead' },
    { key: 'rope', shape: 'cyl', size: [0.04, 0.78, 0.04], at: [0, 0.06, 0], color: 'hemp' },
    { key: 'red', shape: 'cyl', size: [0.12, 0.12, 0.12], at: [0, 0.18, 0], color: 'red' },
    { key: 'white', shape: 'cyl', size: [0.12, 0.12, 0.12], at: [0, 0.3, 0], color: 'white' },
    { key: 'blue', shape: 'cyl', size: [0.12, 0.12, 0.12], at: [0, 0.42, 0], color: 'blue' },
  ] });
  Defs.add('puppet', { id: 'favour.stay', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', oak: '#8a5f37', timber: '#6a492d' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.44, 0.06, 0.44], at: [0, 0, 0], color: 'lead' },
    { key: 'stay', shape: 'box', size: [0.08, 0.62, 0.08], at: [0, 0.06, 0], color: 'oak' },
    { key: 'slider', shape: 'box', size: [0.34, 0.07, 0.1], at: [0, 0.5, 0], color: 'timber' },
  ] });
  Defs.add('puppet', { id: 'favour.mourners', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', slate: '#5b5470', dark: '#0a0c11' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.6, 0.06, 0.6], at: [0, 0, 0], color: 'lead' },
    { key: 'one', shape: 'cone', size: [0.17, 0.46, 0.17], at: [-0.17, 0.06, 0], color: 'slate' },
    { key: 'two', shape: 'cone', size: [0.17, 0.52, 0.17], at: [0, 0.06, 0], color: 'dark' },
    { key: 'three', shape: 'cone', size: [0.17, 0.46, 0.17], at: [0.17, 0.06, 0], color: 'slate' },
  ] });
  Defs.add('puppet', { id: 'favour.coffin', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', oak: '#8a5f37', timber: '#6a492d' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.56, 0.06, 0.56], at: [0, 0, 0], color: 'lead' },
    { key: 'coffin', shape: 'taper', size: [0.34, 0.2, 0.66], at: [0, 0.06, 0], color: 'oak' },
    { key: 'band', shape: 'box', size: [0.3, 0.03, 0.06], at: [0, 0.26, 0.1], color: 'timber' },
  ] });
  Defs.add('puppet', { id: 'favour.roof', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', chalk: '#e4dfd1', oak: '#8a5f37' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.56, 0.06, 0.56], at: [0, 0, 0], color: 'lead' },
    { key: 'walls', shape: 'box', size: [0.4, 0.26, 0.3], at: [0, 0.06, 0], color: 'chalk' },
    { key: 'roof', shape: 'taper', size: [0.54, 0.26, 0.42], at: [0, 0.32, 0], color: 'oak' },
  ] });
  Defs.add('puppet', { id: 'favour.muffle', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', bronze: '#c79a45', timber: '#6a492d' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.5, 0.06, 0.5], at: [0, 0, 0], color: 'lead' },
    { key: 'bell', shape: 'cone', size: [0.46, 0.46, 0.46], at: [0, 0.06, 0], color: 'bronze' },
    { key: 'leather', shape: 'box', size: [0.14, 0.2, 0.22], at: [0.2, 0.08, 0], color: 'timber' },
  ] });
  Defs.add('puppet', { id: 'favour.arch', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', slate: '#5b5470' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.56, 0.06, 0.56], at: [0, 0, 0], color: 'slate' },
    { key: 'piers', shape: 'box', size: [0.46, 0.34, 0.2], at: [0, 0.06, 0], color: 'lead' },
    { key: 'arch', shape: 'sphere', size: [0.46, 0.36, 0.2], at: [0, 0.22, 0], color: 'lead' },
  ] });
  Defs.add('puppet', { id: 'favour.coins', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', gold: '#d6a23e' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.44, 0.06, 0.44], at: [0, 0, 0], color: 'lead' },
    { key: 'one', shape: 'cyl', size: [0.24, 0.05, 0.24], at: [0, 0.06, 0], color: 'gold', glow: 0.25 },
    { key: 'two', shape: 'cyl', size: [0.24, 0.05, 0.24], at: [0.04, 0.11, 0.02], color: 'gold', glow: 0.25 },
    { key: 'three', shape: 'cyl', size: [0.24, 0.05, 0.24], at: [-0.02, 0.16, -0.03], color: 'gold', glow: 0.25 },
  ] });
  Defs.add('puppet', { id: 'favour.nail', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', chalk: '#e4dfd1', lamp: '#e6c25a' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.4, 0.06, 0.4], at: [0, 0, 0], color: 'lead' },
    { key: 'wax', shape: 'cyl', size: [0.18, 0.46, 0.18], at: [0, 0.06, 0], color: 'chalk' },
    { key: 'nail', shape: 'box', size: [0.2, 0.03, 0.03], at: [0.04, 0.32, 0], color: 'lead' },
    { key: 'flame', shape: 'cone', size: [0.09, 0.16, 0.09], at: [0, 0.54, 0], color: 'lamp', glow: 1 },
  ] });
  Defs.add('puppet', { id: 'favour.passing-bell', rig: 'static', scale: 1, anim: {}, palette: { lead: '#6d7276', bronze: '#c79a45', hemp: '#c7a86f' }, parts: [
    { key: 'plinth', shape: 'cyl', size: [0.44, 0.06, 0.44], at: [0, 0, 0], color: 'lead' },
    { key: 'bell', shape: 'cone', size: [0.4, 0.4, 0.4], at: [0, 0.18, 0], color: 'bronze' },
    { key: 'lip', shape: 'cyl', size: [0.42, 0.05, 0.42], at: [0, 0.16, 0], color: 'bronze' },
    { key: 'rope', shape: 'cyl', size: [0.03, 0.16, 0.03], at: [0, 0.06, 0], color: 'hemp' },
  ] });
})();
