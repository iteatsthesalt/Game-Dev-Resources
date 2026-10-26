# Cinderdeep

A browser roguelite in one file. Open `CDCD-V9.html` to play; nothing else is needed.

## Working on it

`CDCD-V9.html` is built from `src/`. Edit `src/`, then rebuild. Never edit the built file by hand: the check below fails if it does not match `src/`.

```
npm install                       # once: Playwright for the tests
npx playwright install chromium   # once, if you have no Chromium for Playwright
npm run build                     # src/ -> CDCD-V9.html
npm test                          # build check, then play the game headless
node tests/run.js realm trail     # only the scenarios whose names contain these words
GAME=other.html node tests/run.js # test another build
```

The same check and tests run on GitHub for every change under `Games/Cinderdeep/`.

## Layout

- `src/page/`: the page around the game: `head.html`, `style.css`, `body.html` (HUD and touch controls) and `tail.html`.
- `src/js/`: the game, one module per system, run in file-name order. The number in front of a name is its place; a new module goes after the ones it builds on.
  - `00`–`15`: the core: utilities, sound, input, pixel art, content, floors, the world, the hero, monsters, loot, the renderer, HUD, screens and saving.
  - `16`–`32`: the big content and art expansions, chaos, souls, feats, audio, controls, evolutions and turning heroes.
  - `33`–`47`: the Realm: zones, art, creatures, play, people, other players, the rigged world, elementals, the Mycelium and small life.
  - `48`–`54`: progression: one life each, skill trees, the shared talent tree and DNA.
  - `55`–`59`: photo mode, the Living Realm, the Proving Trail, CinderFX and Steel & Chaos.
  - `60`: the 3D view (below).
  - `61`: the main loop and boot.
- `src/vendor/`: third-party libraries, each inlined as its own script ahead of the game. Today that is three.js, with its license beside it.
- `tests/`: `scenarios.js` holds the scenarios, `helpers.js` is loaded into the page for them, `run.js` runs them.
- `tools/build.js`: the build. `tools/bundle-three.sh` rebuilds `src/vendor/three.min.js` (see below).

## The 3D view

Dungeons draw in 3D with [three.js](https://threejs.org), on by default and switchable in Settings; the Realm still draws in 2D. It is a renderer only: the simulation, collision and saves are the 2D ones, so every system keeps working.

- Each room's floor is its 2D room picture laid flat; wall tiles stand up as boxes, low on the near side of a room so they never hide it; shut doors are boxes across the gap.
- Heroes, monsters, props and loot are painted by their 2D painters into small canvases that stand upright as cards, so held weapons, rigs, tints and elemental looks carry over.
- What lies on the floor (lava, shadows, corpses, missiles, telegraphs, particles, CinderFX sparks) is painted into two canvases laid over the floor; numbers and health bars stay flat on the screen.
- The camera looks straight ahead with its lens shifted down, so upright things stay upright anywhere on screen and sprites show at their painted size. `screenToWorld` casts the mouse onto the floor.
- Lights come from the game's own `lightSources`: the nearest ten are real point lights.
- CinderFX's grading and bloom work on the 2D picture, so they rest while the 3D view is on.

three.js comes from the [CinderDeep](https://github.com/iteatsthesalt/CinderDeep) catalog, at the commit it pins for `upstream/mrdoob/three.js`. Only the classes listed in `tools/three-entry.js` are bundled. To add one, list it there and run `tools/bundle-three.sh /path/to/three.js` against a checkout of that commit.

## Extending the game

Later modules change earlier ones by reassigning functions (`const _x = f; f = function () { … _x() … }`) or through `hook(name, fn)`. Prefer a hook, or a registry, to another wrapper:

- Pause menu: `pauseItem(id, order, (el, p, run) => button or null)` in `28-screens-upgrade.js`. Entries show in order: Resume is 10, Settings 100, CinderFX 150.
- Settings: `settingsRow(id, order, (back) => node or null, top)` in `14-screens.js`. Rows go above the Done row, or under the heading when `top` is true.

Add a scenario to `tests/scenarios.js` for anything new, and run `npm test` before committing.
