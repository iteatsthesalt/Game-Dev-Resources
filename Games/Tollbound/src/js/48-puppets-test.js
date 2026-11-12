// 48-puppets-test.js: test figures, one for each rig, the figure of the debug scene's enemy, and the figures of
// the test props and the gate. They are for judging the rigs and the renderer, not the game's cast.
// Owns: (none)
// Public: nothing; it only registers definitions with Defs.add:
//   puppet 'debug.husk'       the enemy of Sim.debugScene: a hunched biped of exactly ten parts
//   puppet 'test.biped'       a person of about 1.75 m with a cape and a sword in the right hand (the stand-in
//                             player figure while a run has no character)
//   puppet 'test.quadruped'   a four-legged beast    'test.floater'   a hovering robed figure with a lantern
//   puppet 'test.crawler'     a six-legged crawler   'test.winged'    a flapping flyer
//   puppet 'test.serpent'     a segmented serpent    'test.static'    a standing stone
//   puppet 'test.pillar', 'test.slab', 'test.candles'   the figures of the props of 49-tilesets-test.js
//   puppet 'test.gate'        the gate of a vigil, until the game has its own (68-scene.js looks for 'gate' first)
//
// How a figure is written (61-rigs.js has the rigs and their joints): a part is one unit shape scaled to size
// (metres) with the centre of its base at "at", measured from the origin of its joint. A figure faces +z, its
// left side is +x and up is +y. A limb hangs from its joint, so its "at" is [0, -length, 0]. A thing held in
// handR is written standing up from the grip: the rig points the hand's +y forward and up. Colours are
// [r, g, b] from 0 to 1; glow is how much a part shines by itself; parts with detail: true are left out when
// the screen is crowded.
(function () {
  'use strict';

  // ---- the debug scene's enemy: ten parts, none of them detail ----
  Defs.add('puppet', {
    id: 'debug.husk', rig: 'biped', scale: 1,
    parts: [
      { key: 'legL', shape: 'box', size: [0.15, 0.9, 0.17], at: [0, -0.92, 0], joint: 'legL', color: 'rag' },
      { key: 'legR', shape: 'box', size: [0.15, 0.9, 0.17], at: [0, -0.92, 0], joint: 'legR', color: 'rag' },
      { key: 'hips', shape: 'box', size: [0.32, 0.2, 0.2], at: [0, -0.12, 0], joint: 'torso', color: 'rag' },
      { key: 'body', shape: 'box', size: [0.38, 0.46, 0.26], at: [0, 0.04, 0], joint: 'torso', color: 'flesh' },
      { key: 'hump', shape: 'box', size: [0.3, 0.18, 0.2], at: [0, 0.36, -0.08], joint: 'torso', color: 'flesh' },
      { key: 'tabard', shape: 'box', size: [0.3, 0.46, 0.04], at: [0, -0.2, 0.14], joint: 'torso', color: 'rag' },
      { key: 'head', shape: 'box', size: [0.21, 0.23, 0.23], at: [0, -0.03, 0.07], joint: 'head', color: 'bone' },
      { key: 'eyes', shape: 'box', size: [0.15, 0.045, 0.03], at: [0, 0.09, 0.18], joint: 'head', color: 'eye', glow: 0.9 },
      { key: 'armL', shape: 'box', size: [0.09, 0.66, 0.1], at: [0, -0.66, 0], joint: 'armL', color: 'flesh' },
      { key: 'armR', shape: 'box', size: [0.09, 0.66, 0.1], at: [0, -0.66, 0], joint: 'armR', color: 'flesh' },
    ],
    palette: { flesh: [0.52, 0.56, 0.47], rag: [0.3, 0.25, 0.22], bone: [0.76, 0.72, 0.6], eye: [1, 0.55, 0.22] },
    anim: { stride: 1.15, swing: 0.3, bob: 0.02, lean: 0.38, lift: 0.08, reach: 0.45 },
  });

  // ---- one figure for each rig ----
  Defs.add('puppet', {
    id: 'test.biped', rig: 'biped', scale: 1,
    parts: [
      { key: 'legL', shape: 'box', size: [0.15, 0.84, 0.16], at: [0, -0.86, 0], joint: 'legL', color: 'cloth' },
      { key: 'legR', shape: 'box', size: [0.15, 0.84, 0.16], at: [0, -0.86, 0], joint: 'legR', color: 'cloth' },
      { key: 'footL', shape: 'box', size: [0.13, 0.08, 0.25], at: [0, -0.92, 0.04], joint: 'legL', color: 'leather', detail: true },
      { key: 'footR', shape: 'box', size: [0.13, 0.08, 0.25], at: [0, -0.92, 0.04], joint: 'legR', color: 'leather', detail: true },
      { key: 'hips', shape: 'box', size: [0.34, 0.22, 0.22], at: [0, -0.14, 0], joint: 'torso', color: 'cloth' },
      { key: 'body', shape: 'box', size: [0.4, 0.5, 0.24], at: [0, 0.06, 0], joint: 'torso', color: 'tunic' },
      { key: 'belt', shape: 'box', size: [0.37, 0.06, 0.25], at: [0, 0.04, 0], joint: 'torso', color: 'leather', detail: true },
      { key: 'cape', shape: 'taper', size: [0.42, 0.84, 0.05], at: [0, -0.32, -0.15], joint: 'torso', color: 'cape' },
      { key: 'head', shape: 'box', size: [0.22, 0.25, 0.23], at: [0, 0, 0.01], joint: 'head', color: 'skin' },
      { key: 'hair', shape: 'box', size: [0.24, 0.1, 0.25], at: [0, 0.18, -0.01], joint: 'head', color: 'hair', detail: true },
      { key: 'hairBack', shape: 'box', size: [0.23, 0.14, 0.05], at: [0, 0.05, -0.1], joint: 'head', color: 'hair', detail: true },
      { key: 'armL', shape: 'box', size: [0.1, 0.6, 0.11], at: [0, -0.6, 0], joint: 'armL', color: 'tunic' },
      { key: 'armR', shape: 'box', size: [0.1, 0.6, 0.11], at: [0, -0.6, 0], joint: 'armR', color: 'tunic' },
      { key: 'handL', shape: 'box', size: [0.08, 0.09, 0.09], at: [0, -0.68, 0], joint: 'armL', color: 'skin', detail: true },
      { key: 'grip', shape: 'box', size: [0.05, 0.2, 0.05], at: [0, -0.08, 0], joint: 'handR', color: 'leather' },
      { key: 'guard', shape: 'box', size: [0.2, 0.04, 0.06], at: [0, 0.1, 0], joint: 'handR', color: 'brass' },
      { key: 'blade', shape: 'box', size: [0.06, 0.8, 0.02], at: [0, 0.14, 0], joint: 'handR', color: 'steel', glow: 0.15 },
    ],
    palette: {
      cloth: [0.24, 0.26, 0.33], tunic: [0.64, 0.22, 0.17], cape: [0.17, 0.3, 0.55], skin: [0.86, 0.66, 0.5], hair: [0.3, 0.2, 0.12],
      leather: [0.4, 0.26, 0.15], steel: [0.84, 0.88, 0.94], brass: [0.84, 0.64, 0.26],
    },
    anim: { stride: 1.45, swing: 0.55, bob: 0.02, lift: 0.12 },
  });

  Defs.add('puppet', {
    id: 'test.quadruped', rig: 'quadruped', scale: 1,
    parts: [
      { key: 'body', shape: 'box', size: [0.4, 0.34, 0.96], at: [0, -0.14, -0.02], joint: 'torso', color: 'fur' },
      { key: 'chest', shape: 'box', size: [0.44, 0.4, 0.34], at: [0, -0.16, 0.3], joint: 'torso', color: 'fur' },
      { key: 'ridge', shape: 'box', size: [0.22, 0.1, 0.5], at: [0, 0.18, 0.1], joint: 'torso', color: 'mane', detail: true },
      { key: 'head', shape: 'box', size: [0.24, 0.24, 0.32], at: [0, -0.06, 0.1], joint: 'head', color: 'fur' },
      { key: 'snout', shape: 'box', size: [0.15, 0.12, 0.2], at: [0, -0.05, 0.34], joint: 'head', color: 'dark' },
      { key: 'earL', shape: 'cone', size: [0.07, 0.14, 0.06], at: [0.08, 0.17, 0.06], joint: 'head', color: 'dark', detail: true },
      { key: 'earR', shape: 'cone', size: [0.07, 0.14, 0.06], at: [-0.08, 0.17, 0.06], joint: 'head', color: 'dark', detail: true },
      { key: 'eyes', shape: 'box', size: [0.18, 0.035, 0.02], at: [0, 0.09, 0.27], joint: 'head', color: 'eye', glow: 0.8 },
      { key: 'legFL', shape: 'box', size: [0.11, 0.62, 0.12], at: [0, -0.62, 0], joint: 'legFL', color: 'dark' },
      { key: 'legFR', shape: 'box', size: [0.11, 0.62, 0.12], at: [0, -0.62, 0], joint: 'legFR', color: 'dark' },
      { key: 'legBL', shape: 'box', size: [0.12, 0.62, 0.13], at: [0, -0.62, 0], joint: 'legBL', color: 'dark' },
      { key: 'legBR', shape: 'box', size: [0.12, 0.62, 0.13], at: [0, -0.62, 0], joint: 'legBR', color: 'dark' },
      { key: 'tail', shape: 'box', size: [0.06, 0.06, 0.44], at: [0, -0.03, -0.44], joint: 'tail', color: 'fur' },
    ],
    palette: { fur: [0.55, 0.44, 0.3], mane: [0.45, 0.35, 0.23], dark: [0.26, 0.21, 0.17], eye: [0.95, 0.85, 0.3] },
    anim: { stride: 1.3, swing: 0.15, bob: 0.02, lift: 0.1 },
  });

  Defs.add('puppet', {
    id: 'test.floater', rig: 'floater', scale: 1,
    parts: [
      { key: 'robe', shape: 'taper', size: [0.5, 0.76, 0.4], at: [0, -0.3, 0], joint: 'torso', color: 'robe' },
      { key: 'skirt', shape: 'taper', size: [0.62, 0.46, 0.5], at: [0, -0.44, 0.02], joint: 'tail', color: 'hem' },
      { key: 'shoulders', shape: 'box', size: [0.38, 0.14, 0.26], at: [0, 0.36, 0], joint: 'torso', color: 'robe' },
      { key: 'hood', shape: 'cone', size: [0.34, 0.44, 0.34], at: [0, -0.04, -0.02], joint: 'head', color: 'robe' },
      { key: 'face', shape: 'box', size: [0.17, 0.14, 0.05], at: [0, 0.06, 0.12], joint: 'head', color: 'void' },
      { key: 'eyes', shape: 'box', size: [0.12, 0.03, 0.02], at: [0, 0.12, 0.145], joint: 'head', color: 'eye', glow: 1 },
      { key: 'armL', shape: 'box', size: [0.09, 0.48, 0.1], at: [0, -0.48, 0], joint: 'armL', color: 'robe' },
      { key: 'armR', shape: 'box', size: [0.09, 0.48, 0.1], at: [0, -0.48, 0], joint: 'armR', color: 'robe' },
      { key: 'lantern', shape: 'box', size: [0.12, 0.15, 0.12], at: [0, -0.2, 0], joint: 'handR', color: 'flame', glow: 0.9 },
      { key: 'lanternTop', shape: 'cone', size: [0.15, 0.08, 0.15], at: [0, -0.05, 0], joint: 'handR', color: 'metal', detail: true },
    ],
    palette: { robe: [0.36, 0.38, 0.5], hem: [0.28, 0.3, 0.42], void: [0.05, 0.05, 0.08], eye: [0.6, 0.9, 1], flame: [1, 0.78, 0.4], metal: [0.3, 0.3, 0.3] },
    anim: { hover: 0.3, bob: 0.07, swing: 0.25 },
  });

  Defs.add('puppet', {
    id: 'test.crawler', rig: 'crawler', scale: 1,
    parts: [
      { key: 'thorax', shape: 'box', size: [0.32, 0.18, 0.46], at: [0, -0.08, 0], joint: 'torso', color: 'shell' },
      { key: 'abdomen', shape: 'sphere', size: [0.42, 0.3, 0.6], at: [0, -0.12, -0.32], joint: 'tail', color: 'back' },
      { key: 'head', shape: 'box', size: [0.2, 0.15, 0.18], at: [0, -0.08, 0.03], joint: 'head', color: 'shell' },
      { key: 'eyes', shape: 'box', size: [0.15, 0.035, 0.02], at: [0, 0, 0.12], joint: 'head', color: 'eye', glow: 1 },
      { key: 'leg1L', shape: 'box', size: [0.045, 0.5, 0.045], at: [0, -0.5, 0], joint: 'leg1L', color: 'leg' },
      { key: 'leg1R', shape: 'box', size: [0.045, 0.5, 0.045], at: [0, -0.5, 0], joint: 'leg1R', color: 'leg' },
      { key: 'leg2L', shape: 'box', size: [0.045, 0.5, 0.045], at: [0, -0.5, 0], joint: 'leg2L', color: 'leg' },
      { key: 'leg2R', shape: 'box', size: [0.045, 0.5, 0.045], at: [0, -0.5, 0], joint: 'leg2R', color: 'leg' },
      { key: 'leg3L', shape: 'box', size: [0.045, 0.5, 0.045], at: [0, -0.5, 0], joint: 'leg3L', color: 'leg' },
      { key: 'leg3R', shape: 'box', size: [0.045, 0.5, 0.045], at: [0, -0.5, 0], joint: 'leg3R', color: 'leg' },
    ],
    palette: { shell: [0.42, 0.46, 0.3], back: [0.5, 0.36, 0.22], leg: [0.2, 0.18, 0.14], eye: [1, 0.3, 0.2] },
    anim: { stride: 0.6, lift: 0.06, leg: 0.5 },
  });

  Defs.add('puppet', {
    id: 'test.winged', rig: 'winged', scale: 1,
    parts: [
      { key: 'body', shape: 'sphere', size: [0.3, 0.3, 0.44], at: [0, -0.16, -0.02], joint: 'torso', color: 'fur' },
      { key: 'head', shape: 'box', size: [0.18, 0.16, 0.18], at: [0, -0.03, 0.04], joint: 'head', color: 'fur' },
      { key: 'earL', shape: 'cone', size: [0.06, 0.12, 0.05], at: [0.06, 0.12, 0.02], joint: 'head', color: 'wing', detail: true },
      { key: 'earR', shape: 'cone', size: [0.06, 0.12, 0.05], at: [-0.06, 0.12, 0.02], joint: 'head', color: 'wing', detail: true },
      { key: 'eyes', shape: 'box', size: [0.12, 0.035, 0.02], at: [0, 0.05, 0.13], joint: 'head', color: 'eye', glow: 1 },
      { key: 'wingL', shape: 'box', size: [0.4, 0.03, 0.42], at: [0.24, 0, -0.06], joint: 'wingL', color: 'wing' },
      { key: 'midL', shape: 'box', size: [0.34, 0.025, 0.28], at: [0.58, 0, -0.14], joint: 'wingL', color: 'wing' },
      { key: 'tipL', shape: 'box', size: [0.22, 0.02, 0.14], at: [0.84, 0, -0.22], joint: 'wingL', color: 'tip' },
      { key: 'wingR', shape: 'box', size: [0.4, 0.03, 0.42], at: [-0.24, 0, -0.06], joint: 'wingR', color: 'wing' },
      { key: 'midR', shape: 'box', size: [0.34, 0.025, 0.28], at: [-0.58, 0, -0.14], joint: 'wingR', color: 'wing' },
      { key: 'tipR', shape: 'box', size: [0.22, 0.02, 0.14], at: [-0.84, 0, -0.22], joint: 'wingR', color: 'tip' },
      { key: 'tail', shape: 'box', size: [0.05, 0.04, 0.26], at: [0, -0.02, -0.22], joint: 'tail', color: 'fur', detail: true },
      { key: 'legL', shape: 'box', size: [0.04, 0.16, 0.04], at: [0, -0.16, 0], joint: 'legL', color: 'tip', detail: true },
      { key: 'legR', shape: 'box', size: [0.04, 0.16, 0.04], at: [0, -0.16, 0], joint: 'legR', color: 'tip', detail: true },
    ],
    palette: { fur: [0.26, 0.21, 0.24], wing: [0.62, 0.36, 0.33], tip: [0.42, 0.24, 0.24], eye: [1, 0.9, 0.4] },
    anim: { hover: 1.3, flap: 3.2, swing: 0.55 },
  });

  Defs.add('puppet', {
    id: 'test.serpent', rig: 'serpent', scale: 1,
    parts: [
      { key: 'head', shape: 'box', size: [0.34, 0.2, 0.42], at: [0, -0.1, 0.1], joint: 's0', color: 'scale' },
      { key: 'eyes', shape: 'box', size: [0.28, 0.04, 0.03], at: [0, 0.03, 0.29], joint: 's0', color: 'eye', glow: 1 },
      { key: 'crest', shape: 'cone', size: [0.08, 0.16, 0.14], at: [0, 0.08, -0.02], joint: 's0', color: 'belly', detail: true },
      { key: 'seg1', shape: 'sphere', size: [0.4, 0.28, 0.44], at: [0, -0.13, 0], joint: 's1', color: 'band' },
      { key: 'seg2', shape: 'sphere', size: [0.39, 0.27, 0.44], at: [0, -0.13, 0], joint: 's2', color: 'scale' },
      { key: 'seg3', shape: 'sphere', size: [0.36, 0.25, 0.44], at: [0, -0.12, 0], joint: 's3', color: 'band' },
      { key: 'seg4', shape: 'sphere', size: [0.32, 0.23, 0.42], at: [0, -0.11, 0], joint: 's4', color: 'scale' },
      { key: 'seg5', shape: 'sphere', size: [0.27, 0.2, 0.4], at: [0, -0.1, 0], joint: 's5', color: 'band' },
      { key: 'seg6', shape: 'sphere', size: [0.22, 0.16, 0.38], at: [0, -0.08, 0], joint: 's6', color: 'scale' },
      { key: 'seg7', shape: 'sphere', size: [0.15, 0.12, 0.36], at: [0, -0.06, 0], joint: 's7', color: 'band' },
    ],
    palette: { scale: [0.36, 0.56, 0.36], band: [0.62, 0.6, 0.3], belly: [0.85, 0.74, 0.42], eye: [1, 0.85, 0.3] },
    anim: { stride: 2, swing: 0.2 },
  });

  Defs.add('puppet', {
    id: 'test.static', rig: 'static', scale: 1,
    parts: [
      { key: 'base', shape: 'box', size: [0.7, 0.3, 0.7], at: [0, 0, 0], joint: 'root', color: 'stone' },
      { key: 'shaft', shape: 'taper', size: [0.5, 1.8, 0.5], at: [0, 0.3, 0], joint: 'root', color: 'stone' },
      { key: 'cap', shape: 'cone', size: [0.32, 0.3, 0.32], at: [0, 2.1, 0], joint: 'root', color: 'dark' },
    ],
    palette: { stone: [0.5, 0.5, 0.52], dark: [0.3, 0.3, 0.33] },
    anim: {},
  });

  // ---- the figures of the test props, and of the gate ----
  Defs.add('puppet', {
    id: 'test.pillar', rig: 'static', scale: 1,
    parts: [
      { key: 'base', shape: 'box', size: [0.95, 0.28, 0.95], at: [0, 0, 0], joint: 'root', color: 'stone' },
      { key: 'shaft', shape: 'cyl', size: [0.62, 2.5, 0.62], at: [0, 0.28, 0], joint: 'root', color: 'stone' },
      { key: 'ring', shape: 'cyl', size: [0.68, 0.1, 0.68], at: [0, 0.5, 0], joint: 'root', color: 'dark', detail: true },
      { key: 'capital', shape: 'box', size: [0.86, 0.24, 0.86], at: [0, 2.78, 0], joint: 'root', color: 'stone' },
    ],
    palette: { stone: [0.56, 0.55, 0.52], dark: [0.36, 0.35, 0.34] },
    anim: {},
  });

  Defs.add('puppet', {
    id: 'test.slab', rig: 'static', scale: 1,
    parts: [
      { key: 'slab', shape: 'box', size: [1.7, 0.22, 1], at: [0, 0, 0], joint: 'root', color: 'stone' },
      { key: 'shard', shape: 'box', size: [0.5, 0.18, 0.4], at: [0.98, 0, 0.56], joint: 'root', color: 'stone' },
      { key: 'chip', shape: 'box', size: [0.5, 0.1, 0.3], at: [-0.45, 0.22, -0.2], joint: 'root', color: 'dark', detail: true },
    ],
    palette: { stone: [0.5, 0.49, 0.47], dark: [0.38, 0.37, 0.36] },
    anim: {},
  });

  Defs.add('puppet', {
    id: 'test.candles', rig: 'static', scale: 1,
    parts: [
      { key: 'base', shape: 'cyl', size: [0.42, 0.07, 0.42], at: [0, 0, 0], joint: 'root', color: 'iron' },
      { key: 'foot', shape: 'cyl', size: [0.16, 0.16, 0.16], at: [0, 0.07, 0], joint: 'root', color: 'iron' },
      { key: 'stem', shape: 'cyl', size: [0.06, 1.05, 0.06], at: [0, 0.2, 0], joint: 'root', color: 'iron' },
      { key: 'tray', shape: 'cyl', size: [0.38, 0.04, 0.38], at: [0, 1.25, 0], joint: 'root', color: 'iron' },
      { key: 'candle1', shape: 'cyl', size: [0.06, 0.16, 0.06], at: [0.08, 1.29, 0.04], joint: 'root', color: 'wax' },
      { key: 'candle2', shape: 'cyl', size: [0.06, 0.12, 0.06], at: [-0.08, 1.29, 0.03], joint: 'root', color: 'wax' },
      { key: 'candle3', shape: 'cyl', size: [0.06, 0.2, 0.06], at: [0, 1.29, -0.09], joint: 'root', color: 'wax' },
      { key: 'flame1', shape: 'cone', size: [0.05, 0.1, 0.05], at: [0.08, 1.45, 0.04], joint: 'root', color: 'flame', glow: 1 },
      { key: 'flame2', shape: 'cone', size: [0.05, 0.1, 0.05], at: [-0.08, 1.41, 0.03], joint: 'root', color: 'flame', glow: 1 },
      { key: 'flame3', shape: 'cone', size: [0.05, 0.1, 0.05], at: [0, 1.49, -0.09], joint: 'root', color: 'flame', glow: 1 },
    ],
    palette: { iron: [0.2, 0.19, 0.18], wax: [0.9, 0.86, 0.74], flame: [1, 0.78, 0.36] },
    anim: {},
  });

  Defs.add('puppet', {
    id: 'test.gate', rig: 'static', scale: 1,
    parts: [
      { key: 'step', shape: 'box', size: [2.9, 0.08, 0.9], at: [0, 0, 0], joint: 'root', color: 'stone' },
      { key: 'postL', shape: 'box', size: [0.38, 2.7, 0.38], at: [1.15, 0, 0], joint: 'root', color: 'stone' },
      { key: 'postR', shape: 'box', size: [0.38, 2.7, 0.38], at: [-1.15, 0, 0], joint: 'root', color: 'stone' },
      { key: 'lintel', shape: 'box', size: [2.8, 0.36, 0.46], at: [0, 2.7, 0], joint: 'root', color: 'stone' },
      { key: 'veil', shape: 'box', size: [1.9, 2.6, 0.04], at: [0, 0.06, 0], joint: 'root', color: 'veil', glow: 0.85 },
      { key: 'bell', shape: 'cone', size: [0.34, 0.34, 0.34], at: [0, 2.3, 0], joint: 'root', color: 'bronze' },
      { key: 'clapper', shape: 'sphere', size: [0.1, 0.1, 0.1], at: [0, 2.22, 0], joint: 'root', color: 'dark', detail: true },
    ],
    palette: { stone: [0.52, 0.5, 0.47], veil: [0.55, 0.8, 0.95], bronze: [0.72, 0.52, 0.24], dark: [0.2, 0.18, 0.16] },
    anim: {},
  });
})();
