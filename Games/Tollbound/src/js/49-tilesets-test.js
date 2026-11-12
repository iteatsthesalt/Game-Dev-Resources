// 49-tilesets-test.js: test grounds, one for each recipe of 63-ground.js, and test props.
// Owns: (none)
// Public: nothing; it only registers definitions with Defs.add:
//   tileset 'test.flags'     worn flagstones with dark joints            recipe 'flags'
//   tileset 'test.cobbles'   rounded cobbles with dark gaps              recipe 'cobbles'
//   tileset 'test.silt'      smooth mud, ripple lines, standing puddles  recipe 'silt'
//   prop    'test.pillar', 'test.slab'    stone props without a light
//   prop    'test.candles'                a candle stand that carries a light
// A tileset is {id, recipe, span, colors}: the recipe that paints it, the metres of ground one texture covers,
// and colours as [r, g, b] from 0 to 1 (63-ground.js lists the names each recipe reads; a missing one keeps the
// recipe's own). A prop's light is {radius, color, height, strength}: metres, [r, g, b], metres above the
// ground, and a factor on the light's strength.
(function () {
  'use strict';

  Defs.add('tileset', {
    id: 'test.flags', recipe: 'flags', span: 6,
    colors: { stone: [0.36, 0.37, 0.4], joint: [0.1, 0.1, 0.11], wear: [0.46, 0.46, 0.47], moss: [0.2, 0.24, 0.16] },
  });

  Defs.add('tileset', {
    id: 'test.cobbles', recipe: 'cobbles', span: 4,
    colors: { stone: [0.4, 0.38, 0.36], gap: [0.11, 0.1, 0.09], cool: [0.34, 0.36, 0.4], warm: [0.44, 0.38, 0.32] },
  });

  Defs.add('tileset', {
    id: 'test.silt', recipe: 'silt', span: 10,
    colors: { mud: [0.3, 0.26, 0.2], ridge: [0.38, 0.33, 0.26], trough: [0.22, 0.19, 0.15], water: [0.12, 0.12, 0.12], sky: [0.2, 0.21, 0.23] },
  });

  Defs.add('prop', { id: 'test.pillar', puppet: 'test.pillar', radius: 0.5 });
  Defs.add('prop', { id: 'test.slab', puppet: 'test.slab', radius: 0.9 });
  Defs.add('prop', {
    id: 'test.candles', puppet: 'test.candles', radius: 0.25,
    light: { radius: 6, color: [1, 0.72, 0.38], height: 1.5, strength: 1.2 },
  });
})();
