// 47-dial-ground.js: the ground of the Dial (docs/design/01-world.md, "The five districts"): a round plaza of chalk
// slabs, the bell-post at its middle that throws the clock's shadow, the eight stones on its radii and the low ring
// wall round its edge, in the Dial's five colours (chalk, noon gold, slate violet, bronze, moss).
// Owns: (none)
// Public: nothing; it only registers definitions with Defs.add:
//   prop    'dial.bell-post'   role 'bell-post'. A slate column on a chalk plinth, Great Hour hung dumb in a bronze
//                              frame on top; 5.6 m tall, its collider 0.75 m round
//   prop    'dial.stone'       one of the eight hour stones on the radii: a chalk block 1.2 m across, 1.5 m tall,
//                              collider 0.65 m. The zone gives the landmarks among them their role in its place list.
//   puppet  'dial.bell-post', 'dial.stone'   their figures (rig 'static'); a stone faces the middle of the region
//                              when the zone sets it down by hand (68-scene.js turns placed props to the middle)
//   puppet  'dial.wall'        one length of the low ring wall, 2.4 m long, drawn by the scene round the region's edge
//   tileset 'dial'             weathered chalk slabs with slate joints and moss (recipe 'flags', 8 m across), kept
//                              a mid grey so that under the Dial's warm sun a Swell's pale bone still stands out from
//                              the ground. Its own fields, read by 68-scene.js (a tileset may carry more fields):
//                                edge   {puppet, step}: a figure set down every step metres round the edge of the
//                                       region, facing its middle (the low ring wall)
//                                hours  {count, color, width, alpha}: count faint lines on the ground, evenly round,
//                                       from the bell-post out to the edge, the first pointing north (the hour lines
//                                       the shadow sweeps over)
//                                shadow {color, alpha}: how the district's shade looks on this ground (the Dial's
//                                       shadow, which 26-director.js keeps in S.vigil.shade: a wedge from the
//                                       bell-post whose leading edge is on the north line at each toll and sweeps
//                                       sunwise round the plaza once in each toll interval)
// Colours are [r, g, b] from 0 to 1. A prop's puppet is written as in 48-puppets-test.js: each part one unit shape
// scaled to size (metres), the centre of its base at "at" from the root; the static rig neither turns nor bends.
(function () {
  'use strict';

  // ---- the bell-post: plinth, column, frame, and the dumb bell ----
  Defs.add('puppet', {
    id: 'dial.bell-post', rig: 'static', scale: 1,
    parts: [
      { key: 'step', shape: 'cyl', size: [2.1, 0.26, 2.1], at: [0, 0, 0], joint: 'root', color: 'chalk' },
      { key: 'plinth', shape: 'cyl', size: [1.5, 0.34, 1.5], at: [0, 0.26, 0], joint: 'root', color: 'stone' },
      { key: 'column', shape: 'cyl', size: [0.66, 3.8, 0.66], at: [0, 0.6, 0], joint: 'root', color: 'slate' },
      { key: 'band', shape: 'cyl', size: [0.72, 0.1, 0.72], at: [0, 2.3, 0], joint: 'root', color: 'gold', detail: true },
      { key: 'collar', shape: 'cyl', size: [0.8, 0.16, 0.8], at: [0, 4.24, 0], joint: 'root', color: 'chalk' },
      { key: 'headstock', shape: 'box', size: [1.16, 0.16, 0.42], at: [0, 4.4, 0], joint: 'root', color: 'oak' },
      { key: 'frameL', shape: 'box', size: [0.1, 1.0, 0.12], at: [0.5, 4.56, 0], joint: 'root', color: 'oak' },
      { key: 'frameR', shape: 'box', size: [0.1, 1.0, 0.12], at: [-0.5, 4.56, 0], joint: 'root', color: 'oak' },
      { key: 'beam', shape: 'box', size: [1.16, 0.12, 0.18], at: [0, 5.5, 0], joint: 'root', color: 'oak' },
      { key: 'bell', shape: 'cone', size: [0.84, 0.78, 0.84], at: [0, 4.76, 0], joint: 'root', color: 'bronze' },
      { key: 'lip', shape: 'cyl', size: [0.9, 0.09, 0.9], at: [0, 4.72, 0], joint: 'root', color: 'bronze' },
      { key: 'verdigris', shape: 'cyl', size: [0.62, 0.07, 0.62], at: [0, 5.02, 0], joint: 'root', color: 'moss', detail: true },
      { key: 'clapper', shape: 'sphere', size: [0.16, 0.16, 0.16], at: [0, 4.6, 0], joint: 'root', color: 'iron', detail: true },
    ],
    palette: {
      chalk: [0.86, 0.84, 0.78], stone: [0.7, 0.68, 0.63], slate: [0.37, 0.34, 0.44], gold: [0.84, 0.63, 0.24],
      oak: [0.3, 0.23, 0.17], bronze: [0.54, 0.37, 0.21], moss: [0.36, 0.42, 0.22], iron: [0.16, 0.15, 0.16],
    },
    anim: {},
  });

  Defs.add('prop', { id: 'dial.bell-post', puppet: 'dial.bell-post', radius: 0.75, role: 'bell-post' });

  // ---- an hour stone: a squat chalk block with a slate line cut down its faces ----
  Defs.add('puppet', {
    id: 'dial.stone', rig: 'static', scale: 1,
    parts: [
      { key: 'footing', shape: 'box', size: [1.34, 0.12, 0.78], at: [0, 0, 0], joint: 'root', color: 'stone' },
      { key: 'block', shape: 'box', size: [1.16, 1.28, 0.6], at: [0, 0.12, 0], joint: 'root', color: 'chalk' },
      { key: 'moss', shape: 'box', size: [1.18, 0.16, 0.62], at: [0, 0.12, 0], joint: 'root', color: 'moss', detail: true },
      { key: 'line', shape: 'box', size: [0.09, 0.98, 0.62], at: [0, 0.3, 0], joint: 'root', color: 'slate', detail: true },
      { key: 'cap', shape: 'box', size: [1.24, 0.12, 0.68], at: [0, 1.4, 0], joint: 'root', color: 'stone' },
    ],
    palette: { chalk: [0.8, 0.78, 0.72], stone: [0.62, 0.6, 0.56], moss: [0.36, 0.42, 0.22], slate: [0.33, 0.3, 0.39] },
    anim: {},
  });

  Defs.add('prop', { id: 'dial.stone', puppet: 'dial.stone', radius: 0.65 });

  // ---- a length of the low ring wall (no prop: the region's own edge holds everything in) ----
  Defs.add('puppet', {
    id: 'dial.wall', rig: 'static', scale: 1,
    parts: [
      { key: 'wall', shape: 'box', size: [2.46, 0.56, 0.5], at: [0, 0, 0], joint: 'root', color: 'slate' },
      { key: 'coping', shape: 'box', size: [2.5, 0.1, 0.62], at: [0, 0.56, 0], joint: 'root', color: 'chalk' },
      { key: 'moss', shape: 'box', size: [2.47, 0.1, 0.52], at: [0, 0, 0], joint: 'root', color: 'moss', detail: true },
    ],
    palette: { slate: [0.4, 0.37, 0.47], chalk: [0.82, 0.8, 0.74], moss: [0.34, 0.4, 0.21] },
    anim: {},
  });

  // ---- the floor ----
  Defs.add('tileset', {
    id: 'dial', recipe: 'flags', span: 8,
    colors: { stone: [0.53, 0.53, 0.51], joint: [0.25, 0.23, 0.28], wear: [0.6, 0.6, 0.57], moss: [0.33, 0.38, 0.2] },
    edge: { puppet: 'dial.wall', step: 2.4 },
    hours: { count: 8, color: [0.33, 0.3, 0.38], width: 0.12, alpha: 0.35 },
    shadow: { color: [0.11, 0.09, 0.16], alpha: 0.38 },
  });
})();
