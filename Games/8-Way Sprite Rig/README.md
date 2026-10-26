# 8-Way Sprite Rig

Cinderdeep's sprite tool. A hidden 3D skeleton drives each subject (characters, beasts, dragons, golems, trees and chests); the tool bakes it into an atlas of directions × frames with normal, depth, specular and emissive maps, lets you walk the result around a playground, and exports the atlas, its JSON contract and a Cinderdeep hero sheet. Open `sprite-rig.html` in a browser; nothing else is needed.

## Working on it

`sprite-rig.html` is built from `src/`. Edit `src/`, then rebuild. Never edit the built file by hand: the check below fails if it does not match `src/`.

```
npm install                       # once: Playwright for the tests
npx playwright install chromium   # once, if you have no Chromium for Playwright
npm run build                     # src/ -> sprite-rig.html
npm test                          # build check, then drive the tool headless
node tests/run.js export reload   # only the scenarios whose names contain these words
```

The same check and tests run on GitHub for every change under `Games/8-Way Sprite Rig/` or to the game's three.js bundle.

## Layout

- `src/page/`: `head.html`, `style.css` (the one stylesheet: tokens, layout, controls, overlays), `body.html` (the markup, with no inline styles) and `tail.html`.
- `src/kit/`: the rig kit, shared with Cinderdeep 3D (its build includes these files too, so what the tool makes the game draws). Each file keeps to one namespace:
  - `poses.js` (`window.RigKit`): skeletons, clips and looks for every subject; a pose is a function of clip and clip time.
  - `shapes.js` (`window.RigShapes`): the builder models draw into (tapered limbs, balls, ellipsoids, rounded blocks, quads), surface patterns (fur, scale, bark, leaf, stone, wood, cloth, metal, skin) that shade each vertex and roughen fur, foliage, bark and stone, and placers that put the parts in any three.js group.
  - `models.js` (`window.RigModels`): each subject's skeleton dressed in solid shapes, held props included.
- `src/js/`, run in file-name order after the kit:
  - `01-fx.js`: the stage's particles, glow and synthesized sound (`window.FX`).
  - `02-stage-fx.js`: weather, lightning, rings, coins and the page's boot screen, pointer trail, ripples and panel tilt.
  - `03-rig.js`: the tool: painters, the bake and its material maps, the turntable, playground, radar and atlas, export, and the controls. `RIG` holds the bench's morphs, shading and playground extras; `window.SpriteRig` is a small handle the tests read. Each subject names its 3D model and its real height (`metres`, per preset for beasts and trees).
  - `04-preview-3d.js`: the 3D Model view (`window.Preview3D`): a lit, shadowed three.js scene whose camera matches the rig's own projection, so the model lands exactly where the sprite would. It stands every subject at its real size on a 3D pedestal that takes its shadows, with a grey 1.8 m person beside it for scale.
- three.js comes from Cinderdeep 3D's own bundle, `Games/Cinderdeep3D/src/vendor/three.min.js`, which the build inlines; the tool and the game draw with the same library.
- `tests/`: `scenarios.js` holds the scenarios, `helpers.js` is loaded into the page for them, `run.js` runs them.
- `tools/build.js`: the build. It reads the game's three.js bundle, so build from a full checkout of the repository.
- `TOOL-PLAN.md`: where the tool is going next, step by step.

Add a scenario to `tests/scenarios.js` for anything new, and run `npm test` before committing.
