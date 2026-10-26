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

The same check and tests run on GitHub for every change under `Games/8-Way Sprite Rig/`.

## Layout

- `src/page/`: `head.html`, `style.css` (the one stylesheet: tokens, layout, controls, overlays), `body.html` (the markup, with no inline styles) and `tail.html`.
- `src/js/`, run in file-name order:
  - `01-fx.js`: the stage's particles, glow and synthesized sound (`window.FX`).
  - `02-stage-fx.js`: weather, lightning, rings, coins and the page's boot screen, pointer trail, ripples and panel tilt.
  - `03-rig.js`: the tool: skeletons and clips for every subject, painters, the bake and its material maps, the turntable, playground, radar and atlas, export, and the controls. `RIG` holds the bench's morphs, shading and playground extras; `window.SpriteRig` is a small handle the tests read.
- `tests/`: `scenarios.js` holds the scenarios, `helpers.js` is loaded into the page for them, `run.js` runs them.
- `tools/build.js`: the build.
- `TOOL-PLAN.md`: where the tool is going next, step by step.

Add a scenario to `tests/scenarios.js` for anything new, and run `npm test` before committing.
